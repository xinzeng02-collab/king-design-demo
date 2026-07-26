// 看稿/签约/生命周期 状态机 + 派生视图 + 付款解锁交付 测试。运行: node --test
import { test } from "node:test";
import assert from "node:assert";
import { canOrderTransition, canDeliveryTransition, canReviewTransition, canAgreementTransition } from "../src/lib/statemachine.js";
import { resolvePrimaryButton, resolveOrderActions, canDeleteOrder } from "../src/lib/lifecycle.js";
import { InMemoryRepo } from "../src/lib/repo.js";
import { MockProvider } from "../src/providers/MockProvider.js";
import * as core from "../src/core.js";

// ---- 状态机 ----
test("订单: 待确认->待签约->进行中 合法; 草稿->进行中 非法", () => {
  assert.ok(canOrderTransition("pending_confirmation", "pending_signing"));
  assert.ok(canOrderTransition("pending_signing", "active"));
  assert.ok(canOrderTransition("completed", "archived"));
  assert.throws(() => canOrderTransition("draft", "active"));
});

test("交付: 准备中->已准备待付款->可下载 合法; 锁定态->已下载 非法", () => {
  assert.ok(canDeliveryTransition("preparing", "prepared_locked"));
  assert.ok(canDeliveryTransition("prepared_locked", "ready"));
  assert.throws(() => canDeliveryTransition("prepared_locked", "downloaded"));
});

test("看稿: 完成->生成订单; 退回->重新进行中", () => {
  assert.ok(canReviewTransition("in_progress", "completed"));
  assert.ok(canReviewTransition("completed", "order_created"));
  assert.ok(canReviewTransition("returned", "in_progress"));
});

test("签约: 审核->已签署/驳回; 驳回->重新待签署; 已签署为终态", () => {
  assert.ok(canAgreementTransition("reviewing", "signed"));
  assert.ok(canAgreementTransition("reviewing", "rejected"));
  assert.ok(canAgreementTransition("rejected", "awaiting_signature"));
  assert.throws(() => canAgreementTransition("signed", "reviewing"));
});

// ---- 主按钮状态机（第十六节）----
const btn = (o) => resolvePrimaryButton(o).label;
test("主按钮: 待签约 -> 查看并签署", () => {
  assert.equal(btn({ order_status: "pending_signing", agreement_status: "awaiting_signature", payment_status: "unpaid", delivery_status: "not_ready" }), "查看并签署");
});
test("主按钮: 审核中 -> 签署文件审核中(禁用)", () => {
  const b = resolvePrimaryButton({ order_status: "pending_signing", agreement_status: "reviewing", payment_status: "unpaid", delivery_status: "not_ready" });
  assert.equal(b.label, "签署文件审核中"); assert.equal(b.disabled, true);
});
test("主按钮: 驳回 -> 重新上传签署文件", () => {
  assert.equal(btn({ order_status: "pending_signing", agreement_status: "rejected", payment_status: "unpaid", delivery_status: "not_ready" }), "重新上传签署文件");
});
test("主按钮: 已签署待支付 -> 立即支付", () => {
  assert.equal(btn({ order_status: "active", agreement_status: "signed", payment_status: "unpaid", delivery_status: "prepared_locked" }), "立即支付");
});
test("主按钮: 已付款+锁定 -> 等待交付", () => {
  assert.equal(btn({ order_status: "active", agreement_status: "signed", payment_status: "paid", delivery_status: "prepared_locked" }), "等待交付");
});
test("主按钮: 已付款+可下载 -> 查看交付文件", () => {
  assert.equal(btn({ order_status: "active", agreement_status: "signed", payment_status: "paid", delivery_status: "ready" }), "查看交付文件");
});
test("主按钮: 已取消 / 已完成", () => {
  assert.equal(btn({ order_status: "cancelled", agreement_status: "signed", payment_status: "paid", delivery_status: "ready" }), "订单已取消");
  assert.equal(btn({ order_status: "completed", agreement_status: "signed", payment_status: "paid", delivery_status: "downloaded" }), "查看订单记录");
});

// ---- 订单 ··· 菜单（第六节）----
test("草稿可删除; 已支付/已签约只能取消或归档", () => {
  assert.ok(canDeleteOrder({ order_status: "draft", hasPayment: false, hasClientAction: false }));
  assert.ok(resolveOrderActions({ order_status: "draft" }).includes("delete"));
  const active = resolveOrderActions({ order_status: "active", hasPayment: true });
  assert.ok(!active.includes("delete"));
  assert.ok(active.includes("archive") && active.includes("cancel"));
  const sent = resolveOrderActions({ order_status: "pending_signing", hasClientAction: true });
  assert.ok(sent.includes("remind_sign") && !sent.includes("delete"));
});

// ---- 付款成功自动解锁交付 ----
test("交付已准备待付款 -> 付款成功后自动解锁为可下载", async () => {
  const ENV = { PAYMENT_MODE: "test", MOCK_NOTIFY_SECRET: "s", MOCK_MCH_ID: "MOCK_MCH_0001", MOCK_APP_ID: "MOCK_APP_0001" };
  const CUST = { userId: "u1", role: "customer", customerId: "c1", organizationId: "org1" };
  const repo = new InMemoryRepo();
  repo.seedOrder({ id: "o1", order_number: "DD1", organization_id: "org1", customer_id: "c1", currency: "CNY", subtotal_amount: 8500, discount_amount: 0, payable_amount: 8500, order_status: "active", agreement_status: "signed", payment_status: "unpaid", delivery_status: "prepared_locked" });
  const { payment } = await core.createPayment(repo, ENV, { orderId: "o1", method: "wechat_native", ctx: { device: "desktop" } }, CUST);
  const m = new MockProvider({ notifySecret: "s", mchId: "MOCK_MCH_0001", appId: "MOCK_APP_0001" });
  m.gateway.set(payment.payment_number, { amount: 8500, currency: "CNY", status: "SUCCESS", txId: "TX1" });
  await core.handleNotify(repo, ENV, { channel: "wechat", body: m.buildNotification(payment.payment_number) });
  assert.equal(repo.getOrder("o1").payment_status, "paid");
  assert.equal(repo.getOrder("o1").delivery_status, "ready"); // 已自动解锁
});
