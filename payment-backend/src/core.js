// 支付业务处理器（纯函数，服务端权威）。业务层永远通过统一 Provider 接口。
// 安全红线：
//  - 支付成功只认「验签通过的回调」或「主动查单确认」或「财务人工确认」；前端说成功一律不认。
//  - 回调幂等：同一 (provider, event_id) 只入账一次。
//  - 回调必核对：商户号 / appid / 金额 / 币种 / 订单。
//  - 越权隔离：客户只能操作本公司订单。
//  - 敏感操作(退款/财务确认/交付)写 audit_logs。
// 说明：所有 repo.* 调用都 await —— InMemoryRepo(测试)同步返回时 await 直接透传；
//       SupabaseRepo(生产)异步返回时 await 正常等待。同一份处理器两处通用。
import { assertCents } from "./lib/money.js";
import { canPaymentTransition } from "./lib/statemachine.js";
import { resolveProvider, resolveProviderByChannel, METHOD_TO_CHANNEL, isTestMode } from "./providers/registry.js";
import { hasFinancePower, canConfirmManualPayment } from "./lib/auth.js";
import { signR2Url } from "./lib/r2.js";

function err(code, status = 400) { const e = new Error(code); e.code = code; e.status = status; return e; }

function assertCanAccessOrder(order, actor) {
  if (!actor || !actor.userId) throw err("UNAUTHENTICATED", 401);
  if (actor.role === "customer") {
    if (order.customer_id !== actor.customerId) throw err("FORBIDDEN_CROSS_CUSTOMER", 403);
  } else if (actor.organizationId && order.organization_id !== actor.organizationId) {
    throw err("FORBIDDEN_ORG", 403);
  }
  return true;
}

function expectedMerchant(channel, env) {
  if (isTestMode(env)) return { mchId: env.MOCK_MCH_ID || "MOCK_MCH_0001", appId: env.MOCK_APP_ID || "MOCK_APP_0001" };
  const map = {
    wechat: { mchId: env.WECHAT_MCH_ID, appId: env.WECHAT_APP_ID },
    alipay: { appId: env.ALIPAY_APP_ID },
    unionpay: { mchId: env.UNIONPAY_MERCHANT_ID },
  };
  return map[channel] || {};
}

// ---- 共享入账（幂等 + 顺序保证一致性）----
// 顺序：校验幂等 -> 先更新订单(可能抛错) -> 再更新支付。
// 订单更新失败会抛出，此时支付未标 paid，可安全重试（对应"落库失败回滚"）。
// 生产(SupabaseRepo)应用单个 Postgres 事务/RPC 包裹两步以保证原子性。
async function creditPaid(repo, order, payment) {
  const p = await repo.getPayment(payment.id);
  if (p.status === "paid") return { credited: false, reason: "already_paid" };
  canPaymentTransition(p.status, "paid");
  const o = await repo.getOrder(p.order_id);
  if (o.order_status === "cancelled") {
    await repo.insertAudit({ action: "paid_on_cancelled_order", target_type: "payment", target_id: p.id });
  }
  if (o.payment_status !== "paid" && canPaymentTransition(o.payment_status, "paid")) {
    // 付款成功：交付若已准备待付款(锁定)则自动解锁为可下载
    const patch = { payment_status: "paid" };
    if (o.delivery_status === "prepared_locked") patch.delivery_status = "ready";
    await repo.updateOrder(o.id, patch);
  }
  await repo.updatePayment(p.id, { status: "paid", paid_at: Date.now() });
  await repo.insertAudit({ action: "payment_paid", target_type: "payment", target_id: p.id, after: { status: "paid" } });
  return { credited: true };
}

// ============ 1. 创建支付 ============
export async function createPayment(repo, env, { orderId, method, ctx = {} }, actor) {
  const order = await repo.getOrder(orderId);
  if (!order) throw err("ORDER_NOT_FOUND", 404);
  assertCanAccessOrder(order, actor);
  if (["cancelled", "expired", "completed"].includes(order.order_status)) throw err("ORDER_NOT_PAYABLE");
  if (order.payment_status === "paid") throw err("ALREADY_PAID");
  if (!METHOD_TO_CHANNEL[method]) throw err("UNKNOWN_METHOD");

  const channel = METHOD_TO_CHANNEL[method];
  const isOffline = channel === "bank_transfer" || channel === "manual_collect";

  const payments = await repo.listPaymentsByOrder(orderId);
  const active = payments.find((p) => p.status === "processing" && (!p.expired_at || p.expired_at > Date.now()));
  if (active && !isOffline) return { payment: active, reused: true, presentation: active.presentation };

  const provider = resolveProvider(method, env);
  const paymentNumber = `PZ${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const created = await provider.createPayment(
    { payment_number: paymentNumber, amount: order.payable_amount, currency: order.currency }, method, ctx
  );
  const payStatus = isOffline ? "unpaid" : "processing";
  const payment = await repo.createPayment({
    order_id: orderId, payment_number: paymentNumber, provider: channel, payment_method: method,
    provider_transaction_id: created.providerTransactionId || null,
    amount: order.payable_amount, currency: order.currency, status: payStatus,
    expired_at: Date.now() + (created.expiresInSec || 900) * 1000,
    presentation: created, raw_response: created.raw,
  });
  if (!isOffline && canPaymentTransition(order.payment_status, "processing")) {
    await repo.updateOrder(orderId, { payment_status: "processing" });
  }
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "payment_create", target_type: "payment", target_id: payment.id, after: { amount: payment.amount, method } });
  return { payment, reused: false, presentation: created };
}

// ============ 2. 查询支付状态（服务端权威）============
export async function getPaymentStatus(repo, env, { paymentId }, actor) {
  const p = await repo.getPayment(paymentId);
  if (!p) throw err("PAYMENT_NOT_FOUND", 404);
  const order = await repo.getOrder(p.order_id);
  assertCanAccessOrder(order, actor);
  return { status: p.status, amount: p.amount, currency: p.currency, paid_at: p.paid_at || null, order_payment_status: order.payment_status };
}

// ============ 3. 异步回调（验签 + 核对 + 幂等 + 入账）============
export async function handleNotify(repo, env, { channel, body }) {
  const provider = resolveProviderByChannel(channel, env);
  const verified = await provider.verifyNotification({ body });
  if (!verified) {
    await repo.insertPaymentEvent({ provider: channel, event_type: "notify", provider_event_id: body?.event_id || null, verification_status: "failed", payload: body });
    throw err("INVALID_SIGNATURE", 400);
  }
  const ins = await repo.insertPaymentEvent({ provider: channel, event_type: "notify", provider_event_id: verified.providerEventId, verification_status: "verified", payload: verified.raw, processed_at: Date.now() });
  if (!ins.inserted) return { ok: true, idempotent: true };

  const payment = await repo.getPaymentByNumber(verified.outTradeNo);
  if (!payment) throw err("PAYMENT_NOT_FOUND", 404);

  const exp = expectedMerchant(channel, env);
  const failVerify = async (reason) => {
    await repo.insertPaymentEvent({ provider: channel, event_type: "notify_reject", verification_status: "failed", payload: { reason } });
    return err(reason, 400);
  };
  if (exp.mchId && verified.mchId !== exp.mchId) throw await failVerify("MCHID_MISMATCH");
  if (exp.appId && verified.appId !== exp.appId) throw await failVerify("APPID_MISMATCH");
  if (verified.amount !== payment.amount) throw await failVerify("AMOUNT_MISMATCH");
  if (verified.currency !== payment.currency) throw await failVerify("CURRENCY_MISMATCH");

  const order = await repo.getOrder(payment.order_id);
  if (verified.status === "paid") {
    const r = await creditPaid(repo, order, payment);
    return { ok: true, credited: r.credited };
  }
  if (verified.status === "failed") { await repo.updatePayment(payment.id, { status: "failed" }); return { ok: true, status: "failed" }; }
  return { ok: true, status: verified.status };
}

// ============ 4. 主动查单并对账（第二权威来源）============
export async function queryAndReconcile(repo, env, { paymentId }, actor) {
  const p = await repo.getPayment(paymentId);
  if (!p) throw err("PAYMENT_NOT_FOUND", 404);
  const order = await repo.getOrder(p.order_id);
  assertCanAccessOrder(order, actor);
  const provider = resolveProviderByChannel(p.provider, env);
  const res = await provider.queryPayment(p);
  if (res.status === "paid" && res.amount === p.amount && res.currency === p.currency) {
    const r = await creditPaid(repo, order, p);
    return { status: "paid", credited: r.credited };
  }
  return { status: res.status };
}

// ============ 5. 关闭支付 ============
export async function closePayment(repo, env, { paymentId }, actor) {
  const p = await repo.getPayment(paymentId);
  if (!p) throw err("PAYMENT_NOT_FOUND", 404);
  const order = await repo.getOrder(p.order_id);
  assertCanAccessOrder(order, actor);
  if (p.status === "paid") throw err("CANNOT_CLOSE_PAID");
  const provider = resolveProviderByChannel(p.provider, env);
  if (provider.closePayment) await provider.closePayment(p);
  await repo.updatePayment(p.id, { status: "expired" });
  if (order.payment_status === "processing") await repo.updateOrder(order.id, { payment_status: "unpaid" });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "payment_close", target_type: "payment", target_id: p.id });
  return { ok: true };
}

// ============ 6. 创建退款（仅财务）============
export async function createRefund(repo, env, { paymentId, amount, reason }, actor) {
  if (!hasFinancePower(actor && actor.role)) throw err("FORBIDDEN_NOT_FINANCE", 403);
  const p = await repo.getPayment(paymentId);
  if (!p) throw err("PAYMENT_NOT_FOUND", 404);
  if (!["paid", "partially_refunded"].includes(p.status)) throw err("REFUND_REQUIRES_PAID");
  assertCents(amount);
  const refundsList = await repo.listRefundsByPayment(p.id);
  const already = refundsList.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amount, 0);
  if (amount <= 0 || already + amount > p.amount) throw err("REFUND_AMOUNT_EXCEEDS");
  const provider = resolveProviderByChannel(p.provider, env);
  const pr = await provider.createRefund(p, amount, reason);
  const refund = await repo.createRefund({ payment_id: p.id, refund_number: `RF${Date.now()}${Math.floor(Math.random() * 1000)}`, provider_refund_id: pr.providerRefundId, amount, status: "refunding", reason });
  await repo.updatePayment(p.id, { status: "refunding" });
  const order = await repo.getOrder(p.order_id);
  if (canPaymentTransition(order.payment_status, "refunding")) await repo.updateOrder(order.id, { payment_status: "refunding" });
  if (["ready", "downloaded"].includes(order.delivery_status)) await repo.updateOrder(order.id, { delivery_status: "frozen" });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "refund_create", target_type: "refund", target_id: refund.id, after: { amount } });
  return { refund };
}

// ============ 7. 退款完成（渠道回调/查单）============
export async function completeRefund(repo, env, { refundId }) {
  const r = await repo.getRefund(refundId);
  if (!r) throw err("REFUND_NOT_FOUND", 404);
  if (r.status === "refunded") return { ok: true, idempotent: true };
  await repo.updateRefund(r.id, { status: "refunded", refunded_at: Date.now() });
  const p = await repo.getPayment(r.payment_id);
  const refundsList = await repo.listRefundsByPayment(p.id);
  const total = refundsList.filter((x) => x.status === "refunded").reduce((s, x) => s + x.amount, 0);
  const full = total >= p.amount;
  await repo.updatePayment(p.id, { status: full ? "refunded" : "partially_refunded" });
  const order = await repo.getOrder(p.order_id);
  await repo.updateOrder(order.id, { payment_status: full ? "refunded" : "partially_refunded", delivery_status: full ? "revoked" : order.delivery_status });
  await repo.insertAudit({ action: "refund_complete", target_type: "refund", target_id: r.id, after: { full, total } });
  return { ok: true, full };
}

// ============ 8. 对公转账：客户提交凭证 ============
export async function submitBankTransfer(repo, env, { orderId, proofUrl, payerName, transferReference }, actor) {
  const order = await repo.getOrder(orderId);
  if (!order) throw err("ORDER_NOT_FOUND", 404);
  assertCanAccessOrder(order, actor);
  const rec = await repo.createBankTransfer({ order_id: orderId, payment_proof_url: proofUrl, payer_name: payerName, transfer_reference: transferReference, status: "submitted" });
  if (canPaymentTransition(order.payment_status, "pending_manual_verification")) {
    await repo.updateOrder(orderId, { payment_status: "pending_manual_verification" });
  }
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "bank_transfer_submit", target_type: "bank_transfer", target_id: rec.id });
  return { record: rec };
}

// ============ 9. 对公转账：财务确认到账（仅财务/管理员/老板）============
export async function confirmBankTransfer(repo, env, { recordId, amount, approve, remark }, actor) {
  if (!canConfirmManualPayment(actor && actor.role)) throw err("FORBIDDEN_NOT_FINANCE", 403);
  const rec = await repo.getBankTransfer(recordId);
  if (!rec) throw err("RECORD_NOT_FOUND", 404);
  if (rec.status !== "submitted") return { ok: true, idempotent: true, status: rec.status };
  const order = await repo.getOrder(rec.order_id);
  if (approve) {
    await repo.updateBankTransfer(recordId, { status: "confirmed", amount, confirmed_by: actor.userId, confirmed_at: Date.now(), remark });
    const pay = await repo.createPayment({ order_id: order.id, payment_number: `PZBT${Date.now()}`, provider: "bank_transfer", payment_method: "bank_transfer", amount: amount != null ? amount : order.payable_amount, currency: order.currency, status: "paid", paid_at: Date.now() });
    if (order.payment_status !== "paid" && canPaymentTransition(order.payment_status, "paid")) await repo.updateOrder(order.id, { payment_status: "paid" });
    await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "bank_transfer_confirm", target_type: "bank_transfer", target_id: recordId, after: { amount } });
    return { ok: true, approved: true, payment: pay };
  }
  await repo.updateBankTransfer(recordId, { status: "rejected", confirmed_by: actor.userId, confirmed_at: Date.now(), remark });
  if (canPaymentTransition(order.payment_status, "unpaid")) await repo.updateOrder(order.id, { payment_status: "unpaid" });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "bank_transfer_reject", target_type: "bank_transfer", target_id: recordId });
  return { ok: true, approved: false };
}

// ============ 10. 受控交付：生成短期下载链接 ============
export async function createDownloadUrl(repo, env, { orderId, fileId }, actor) {
  const order = await repo.getOrder(orderId);
  if (!order) throw err("ORDER_NOT_FOUND", 404);
  assertCanAccessOrder(order, actor);
  if (order.payment_status !== "paid") throw err("NOT_PAID", 403);
  if (["refunding", "refunded", "partially_refunded"].includes(order.payment_status)) throw err("ORDER_REFUNDED", 403);
  if (["frozen", "revoked"].includes(order.delivery_status)) throw err("DELIVERY_FROZEN", 403);
  if (!["ready", "downloaded"].includes(order.delivery_status)) throw err("DELIVERY_NOT_READY", 403);
  const file = await repo.getDeliveryFile(fileId);
  if (!file || file.order_id !== orderId) throw err("FILE_NOT_IN_ORDER", 404);

  const ttl = Number(env.R2_DOWNLOAD_URL_TTL || 1800);
  const token = await repo.createDownloadToken({ delivery_file_id: fileId, order_id: orderId, issued_to: actor.userId, expires_at: Date.now() + ttl * 1000, version: file.version });
  if (order.delivery_status === "ready") await repo.updateOrder(orderId, { delivery_status: "downloaded" });
  const url = await signR2Url(env, file.r2_key, ttl);
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "download_url_issue", target_type: "delivery_file", target_id: fileId });
  return { url, expiresInSec: ttl, tokenId: token.id };
}
