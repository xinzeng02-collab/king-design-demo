// 看稿→选稿→生成订单→签约→审核→准备交付→付款→下载→完成 全链路测试。运行: node --test
import { test } from "node:test";
import assert from "node:assert";
import { InMemoryRepo } from "../src/lib/repo.js";
import { MockProvider } from "../src/providers/MockProvider.js";
import * as sign from "../src/signing.js";
import * as core from "../src/core.js";

const ENV = { PAYMENT_MODE: "test", MOCK_NOTIFY_SECRET: "s", MOCK_MCH_ID: "MOCK_MCH_0001", MOCK_APP_ID: "MOCK_APP_0001" };
const SALES = { userId: "u-sale", role: "sales", organizationId: "org1" };
const CUST = { userId: "u-c1", role: "customer", customerId: "c1", organizationId: "org1" };
const CUST2 = { userId: "u-c2", role: "customer", customerId: "c2", organizationId: "org1" };

async function fullToOrder(repo) {
  const { session } = await sign.startReview(repo, ENV, { customerId: "c1", organizationId: "org1" }, SALES);
  await sign.addReviewItem(repo, ENV, { sessionId: session.id, patternId: "P1", patternName: "缠枝莲", patternCode: "KP-1" }, CUST);
  await sign.addReviewItem(repo, ENV, { sessionId: session.id, patternId: "P2", patternName: "宝相花", patternCode: "KP-2" }, CUST);
  await sign.completeReview(repo, ENV, { sessionId: session.id }, CUST);
  const { order } = await sign.createOrderFromReview(repo, ENV, {
    sessionId: session.id,
    items: [{ patternId: "P1", patternName: "缠枝莲", unitAmount: 60000, licenseType: "non_exclusive" },
            { patternId: "P2", patternName: "宝相花", unitAmount: 60000, licenseType: "exclusive" }],
    discountAmount: 20000,
  }, SALES);
  return { session, order };
}

test("看稿->生成订单: 金额/状态正确", async () => {
  const repo = new InMemoryRepo();
  const { session, order } = await fullToOrder(repo);
  assert.equal(repo.getReviewSession(session.id).status, "order_created");
  assert.equal(order.subtotal_amount, 120000);
  assert.equal(order.payable_amount, 100000);   // 1200 - 200 = 1000 元
  assert.equal(order.order_status, "pending_signing");
  assert.equal(order.agreement_status, "no_agreement");
  assert.equal(repo.listOrderItems(order.id).length, 2);
});

test("签约全流程: 上传->发起->回传->审核通过->订单转 active", async () => {
  const repo = new InMemoryRepo();
  const { order } = await fullToOrder(repo);
  await sign.uploadAgreement(repo, ENV, { orderId: order.id, fileUrl: "r2://c.pdf", fileName: "合同.pdf" }, SALES);
  assert.equal(repo.getOrder(order.id).agreement_status, "agreement_uploaded");
  await sign.initiateSigning(repo, ENV, { orderId: order.id }, SALES);
  assert.equal(repo.getOrder(order.id).agreement_status, "awaiting_signature");
  await sign.submitSignedFile(repo, ENV, { orderId: order.id, signedFileUrl: "r2://signed.pdf" }, CUST);
  assert.equal(repo.getOrder(order.id).agreement_status, "reviewing");
  await sign.reviewSignedFile(repo, ENV, { orderId: order.id, approve: true }, SALES);
  assert.equal(repo.getOrder(order.id).agreement_status, "signed");
  assert.equal(repo.getOrder(order.id).order_status, "active");
});

test("签约驳回 -> 客户可重新上传", async () => {
  const repo = new InMemoryRepo();
  const { order } = await fullToOrder(repo);
  await sign.uploadAgreement(repo, ENV, { orderId: order.id, fileUrl: "x", fileName: "c.pdf" }, SALES);
  await sign.initiateSigning(repo, ENV, { orderId: order.id }, SALES);
  await sign.submitSignedFile(repo, ENV, { orderId: order.id, signedFileUrl: "x" }, CUST);
  await sign.reviewSignedFile(repo, ENV, { orderId: order.id, approve: false, remark: "缺少盖章" }, SALES);
  assert.equal(repo.getOrder(order.id).agreement_status, "rejected");
  // 驳回后客户可再次回传
  await sign.submitSignedFile(repo, ENV, { orderId: order.id, signedFileUrl: "x2" }, CUST);
  assert.equal(repo.getOrder(order.id).agreement_status, "reviewing");
});

test("客户不能替他人订单提交签署件", async () => {
  const repo = new InMemoryRepo();
  const { order } = await fullToOrder(repo);
  await sign.uploadAgreement(repo, ENV, { orderId: order.id, fileUrl: "x", fileName: "c.pdf" }, SALES);
  await sign.initiateSigning(repo, ENV, { orderId: order.id }, SALES);
  await assert.rejects(() => sign.submitSignedFile(repo, ENV, { orderId: order.id, signedFileUrl: "x" }, CUST2), /FORBIDDEN_CROSS_CUSTOMER/);
});

test("客户不能生成订单/审核签约", async () => {
  const repo = new InMemoryRepo();
  const { session } = await fullToOrder(repo);
  await assert.rejects(() => sign.createOrderFromReview(repo, ENV, { sessionId: session.id, items: [{ patternId: "P1", unitAmount: 1 }] }, CUST), /FORBIDDEN_STAFF_ONLY/);
});

test("准备交付需已签署; 交付进入锁定态", async () => {
  const repo = new InMemoryRepo();
  const { order } = await fullToOrder(repo);
  await assert.rejects(() => sign.prepareDelivery(repo, ENV, { orderId: order.id, files: [{ r2Key: "k", fileType: "psd" }] }, SALES), /REQUIRE_SIGNED_AGREEMENT/);
  await sign.uploadAgreement(repo, ENV, { orderId: order.id, fileUrl: "x", fileName: "c.pdf" }, SALES);
  await sign.initiateSigning(repo, ENV, { orderId: order.id }, SALES);
  await sign.submitSignedFile(repo, ENV, { orderId: order.id, signedFileUrl: "x" }, CUST);
  await sign.reviewSignedFile(repo, ENV, { orderId: order.id, approve: true }, SALES);
  await sign.prepareDelivery(repo, ENV, { orderId: order.id, files: [{ r2Key: "delivery/k.psd", fileType: "psd" }] }, SALES);
  assert.equal(repo.getOrder(order.id).delivery_status, "prepared_locked");
});

test("端到端: 签约通过->准备交付(锁定)->付款解锁->下载->完成", async () => {
  const repo = new InMemoryRepo();
  const { order } = await fullToOrder(repo);
  await sign.uploadAgreement(repo, ENV, { orderId: order.id, fileUrl: "x", fileName: "c.pdf" }, SALES);
  await sign.initiateSigning(repo, ENV, { orderId: order.id }, SALES);
  await sign.submitSignedFile(repo, ENV, { orderId: order.id, signedFileUrl: "x" }, CUST);
  await sign.reviewSignedFile(repo, ENV, { orderId: order.id, approve: true }, SALES);
  await sign.prepareDelivery(repo, ENV, { orderId: order.id, files: [{ r2Key: "delivery/k.psd", fileType: "psd" }] }, SALES);

  // 付款前不能下载
  const files = repo.listDeliveryFiles(order.id);
  await assert.rejects(() => core.createDownloadUrl(repo, ENV, { orderId: order.id, fileId: files[0].id }, CUST), /NOT_PAID/);

  // 付款
  const { payment } = await core.createPayment(repo, ENV, { orderId: order.id, method: "wechat_native", ctx: { device: "desktop" } }, CUST);
  const m = new MockProvider({ notifySecret: "s", mchId: "MOCK_MCH_0001", appId: "MOCK_APP_0001" });
  m.gateway.set(payment.payment_number, { amount: 100000, currency: "CNY", status: "SUCCESS", txId: "TX" });
  await core.handleNotify(repo, ENV, { channel: "wechat", body: m.buildNotification(payment.payment_number) });
  assert.equal(repo.getOrder(order.id).payment_status, "paid");
  assert.equal(repo.getOrder(order.id).delivery_status, "ready"); // 自动解锁

  // 下载
  const dl = await core.createDownloadUrl(repo, ENV, { orderId: order.id, fileId: files[0].id }, CUST);
  assert.ok(dl.url);
  assert.equal(repo.getOrder(order.id).delivery_status, "downloaded");

  // 完成
  await sign.completeOrder(repo, ENV, { orderId: order.id }, SALES);
  assert.equal(repo.getOrder(order.id).order_status, "completed");
});
