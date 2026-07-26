// 看稿 → 选稿 → 生成订单 → 签约 → 准备交付 → 订单完成 的业务处理器。
// 与 core.js(支付) 并列，同为服务端权威。所有 repo.* 调用 await(内存/Supabase 通用)。
// 权限：看稿/生成订单/合同/审核 属员工侧；提交签署件 属客户侧；确认到账/退款见 core.js。
import { computePayable } from "./lib/money.js";
import { canOrderTransition, canReviewTransition, canAgreementTransition, canDeliveryTransition } from "./lib/statemachine.js";

function err(code, status = 400) { const e = new Error(code); e.code = code; e.status = status; return e; }
const STAFF = ["admin", "boss", "finance", "sales", "designer", "painter"];
function assertStaff(actor) { if (!actor || !STAFF.includes(actor.role)) throw err("FORBIDDEN_STAFF_ONLY", 403); }
function assertReviewer(actor) { if (!actor || !["admin", "boss", "sales"].includes(actor.role)) throw err("FORBIDDEN_REVIEWER_ONLY", 403); }
function assertOrderCustomer(order, actor) {
  if (!actor || !actor.userId) throw err("UNAUTHENTICATED", 401);
  if (actor.role === "customer" && order.customer_id !== actor.customerId) throw err("FORBIDDEN_CROSS_CUSTOMER", 403);
}

// ============ 看稿 ============
export async function startReview(repo, env, { customerId, organizationId }, actor) {
  assertStaff(actor);
  const s = await repo.createReviewSession({
    review_number: `KG${Date.now()}`, organization_id: organizationId || actor.organizationId,
    customer_id: customerId, initiated_by: actor.userId, status: "in_progress",
  });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "review_start", target_type: "review_session", target_id: s.id });
  return { session: s };
}
export async function addReviewItem(repo, env, { sessionId, patternId, patternName, patternCode, colorways }, actor) {
  const s = await repo.getReviewSession(sessionId);
  if (!s) throw err("REVIEW_SESSION_NOT_FOUND", 404);
  if (s.status !== "in_progress") throw err("REVIEW_NOT_EDITABLE");
  const it = await repo.addReviewItem({ review_session_id: sessionId, pattern_id: patternId, pattern_name: patternName, pattern_code: patternCode, selected_colorways: colorways || null });
  return { item: it };
}
export async function removeReviewItem(repo, env, { sessionId, patternId }, actor) {
  const s = await repo.getReviewSession(sessionId);
  if (!s || s.status !== "in_progress") throw err("REVIEW_NOT_EDITABLE");
  await repo.removeReviewItem(sessionId, patternId);
  return { ok: true };
}
export async function completeReview(repo, env, { sessionId }, actor) {
  const s = await repo.getReviewSession(sessionId);
  if (!s) throw err("REVIEW_SESSION_NOT_FOUND", 404);
  canReviewTransition(s.status, "completed");
  await repo.updateReviewSession(sessionId, { status: "completed" });
  await repo.insertAudit({ actor_id: actor?.userId, actor_role: actor?.role, action: "review_complete", target_type: "review_session", target_id: sessionId });
  return { ok: true };
}
export async function returnReview(repo, env, { sessionId }, actor) {
  assertStaff(actor);
  const s = await repo.getReviewSession(sessionId);
  if (!s) throw err("REVIEW_SESSION_NOT_FOUND", 404);
  canReviewTransition(s.status, "returned");
  await repo.updateReviewSession(sessionId, { status: "returned" });
  return { ok: true };
}

// ============ 销售确认并生成订单 ============
export async function createOrderFromReview(repo, env, { sessionId, items, discountAmount = 0, currency = "CNY" }, actor) {
  assertStaff(actor);
  const s = await repo.getReviewSession(sessionId);
  if (!s) throw err("REVIEW_SESSION_NOT_FOUND", 404);
  if (!Array.isArray(items) || !items.length) throw err("NO_ITEMS");
  const subtotal = items.reduce((sum, it) => sum + Number(it.unitAmount || 0), 0);
  const payable = computePayable(subtotal, Number(discountAmount || 0));
  const order = await repo.createOrder({
    order_number: `DD-${Date.now()}`, organization_id: s.organization_id, customer_id: s.customer_id,
    review_session_id: sessionId, currency, subtotal_amount: subtotal, discount_amount: Number(discountAmount || 0),
    payable_amount: payable, order_status: "pending_signing", payment_status: "unpaid",
    delivery_status: "not_ready", agreement_status: "no_agreement",
  });
  for (const it of items) {
    await repo.createOrderItem({ order_id: order.id, pattern_id: it.patternId, pattern_name: it.patternName, pattern_code: it.patternCode, license_type: it.licenseType || "non_exclusive", unit_amount: Number(it.unitAmount || 0) });
  }
  await repo.updateReviewSession(sessionId, { status: "order_created" });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "order_create_from_review", target_type: "order", target_id: order.id, after: { payable } });
  return { order };
}

// ============ 签约 ============
export async function uploadAgreement(repo, env, { orderId, fileUrl, fileName }, actor) {
  assertStaff(actor);
  const order = await repo.getOrder(orderId);
  if (!order) throw err("ORDER_NOT_FOUND", 404);
  let agr = await repo.getAgreementByOrder(orderId);
  if (!agr) agr = await repo.createAgreement({ order_id: orderId, version: 1, status: "no_agreement" });
  canAgreementTransition(agr.status, "agreement_uploaded");
  await repo.updateAgreement(agr.id, { status: "agreement_uploaded", contract_file_url: fileUrl, contract_file_name: fileName, contract_uploaded_by: actor.userId, contract_uploaded_at: Date.now() });
  await repo.updateOrder(orderId, { agreement_status: "agreement_uploaded" });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "agreement_upload", target_type: "agreement", target_id: agr.id });
  return { agreement: await repo.getAgreement(agr.id) };
}
export async function initiateSigning(repo, env, { orderId, signDeadline }, actor) {
  assertStaff(actor);
  const agr = await repo.getAgreementByOrder(orderId);
  if (!agr) throw err("AGREEMENT_NOT_FOUND", 404);
  canAgreementTransition(agr.status, "awaiting_signature");
  await repo.updateAgreement(agr.id, { status: "awaiting_signature", initiated_at: Date.now(), sign_deadline: signDeadline || null });
  await repo.updateOrder(orderId, { agreement_status: "awaiting_signature" });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "signing_initiate", target_type: "agreement", target_id: agr.id });
  return { ok: true };
}
export async function submitSignedFile(repo, env, { orderId, signedFileUrl }, actor) {
  const order = await repo.getOrder(orderId);
  if (!order) throw err("ORDER_NOT_FOUND", 404);
  assertOrderCustomer(order, actor);
  const agr = await repo.getAgreementByOrder(orderId);
  if (!agr) throw err("AGREEMENT_NOT_FOUND", 404);
  canAgreementTransition(agr.status, "signed_returned");
  await repo.updateAgreement(agr.id, { status: "signed_returned", signed_file_url: signedFileUrl, submitted_at: Date.now() });
  // 回传后进入内部审核
  canAgreementTransition("signed_returned", "reviewing");
  await repo.updateAgreement(agr.id, { status: "reviewing" });
  await repo.updateOrder(orderId, { agreement_status: "reviewing" });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "signed_file_submit", target_type: "agreement", target_id: agr.id });
  return { ok: true };
}
export async function reviewSignedFile(repo, env, { orderId, approve, remark }, actor) {
  assertReviewer(actor);
  const order = await repo.getOrder(orderId);
  if (!order) throw err("ORDER_NOT_FOUND", 404);
  const agr = await repo.getAgreementByOrder(orderId);
  if (!agr) throw err("AGREEMENT_NOT_FOUND", 404);
  if (agr.status !== "reviewing") throw err("NOT_IN_REVIEW");
  if (approve) {
    await repo.updateAgreement(agr.id, { status: "signed", reviewed_by: actor.userId, reviewed_at: Date.now(), review_remark: remark || null });
    await repo.updateOrder(orderId, { agreement_status: "signed" });
    if (canOrderTransition(order.order_status, "active")) await repo.updateOrder(orderId, { order_status: "active" }); // 已签署 -> 进入支付
    await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "sign_review_approve", target_type: "agreement", target_id: agr.id });
    return { ok: true, approved: true };
  }
  await repo.updateAgreement(agr.id, { status: "rejected", reviewed_by: actor.userId, reviewed_at: Date.now(), review_remark: remark || "" });
  await repo.updateOrder(orderId, { agreement_status: "rejected" });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "sign_review_reject", target_type: "agreement", target_id: agr.id, after: { remark } });
  return { ok: true, approved: false };
}

// ============ 准备交付（签署通过后可上传，保持锁定直到付款）============
export async function prepareDelivery(repo, env, { orderId, files }, actor) {
  assertStaff(actor);
  const order = await repo.getOrder(orderId);
  if (!order) throw err("ORDER_NOT_FOUND", 404);
  if (order.agreement_status !== "signed") throw err("REQUIRE_SIGNED_AGREEMENT");
  for (const f of (files || [])) {
    await repo.createDeliveryFile({ order_id: orderId, r2_key: f.r2Key, file_type: f.fileType, version: f.version || 1 });
  }
  // not_ready -> preparing -> prepared_locked（锁定，待付款解锁）
  if (order.delivery_status === "not_ready") { canDeliveryTransition("not_ready", "preparing"); await repo.updateOrder(orderId, { delivery_status: "preparing" }); }
  canDeliveryTransition("preparing", "prepared_locked");
  await repo.updateOrder(orderId, { delivery_status: "prepared_locked" });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "delivery_prepare", target_type: "order", target_id: orderId });
  return { ok: true, delivery_status: "prepared_locked" };
}

// ============ 订单完成（付款+已下载+无退款）============
export async function completeOrder(repo, env, { orderId }, actor) {
  assertStaff(actor);
  const order = await repo.getOrder(orderId);
  if (!order) throw err("ORDER_NOT_FOUND", 404);
  const okPaid = order.payment_status === "paid";
  const okSigned = order.agreement_status === "signed";
  const okDelivered = order.delivery_status === "downloaded";
  if (!(okPaid && okSigned && okDelivered)) throw err("COMPLETE_CONDITIONS_UNMET");
  canOrderTransition(order.order_status, "completed");
  await repo.updateOrder(orderId, { order_status: "completed" });
  await repo.insertAudit({ actor_id: actor.userId, actor_role: actor.role, action: "order_complete", target_type: "order", target_id: orderId });
  return { ok: true };
}
