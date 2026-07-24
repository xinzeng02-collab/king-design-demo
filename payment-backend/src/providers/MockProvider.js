// ⚠️ 测试模式(TEST/SANDBOX)专用渠道。绝不可在正式环境当成真实收款。
// 它模拟一个支付网关：内部维护交易状态，测试可驱动其"付款成功/失败/超时"；
// 通知用真实 HMAC 签名，以便验证「验签 + 商户号/appid/金额/币种/订单/幂等」这套逻辑是可用的。

import { createHmac } from "node:crypto";
import { PaymentProvider } from "./PaymentProvider.js";
import { normalizeProviderStatus } from "../lib/statemachine.js";

export class MockProvider extends PaymentProvider {
  /**
   * @param {Object} cfg { mchId, appId, notifySecret }  测试用凭证(非真实密钥)
   */
  constructor(cfg = {}) {
    super("mock");
    this.mchId = cfg.mchId || "MOCK_MCH_0001";
    this.appId = cfg.appId || "MOCK_APP_0001";
    this.notifySecret = cfg.notifySecret || "MOCK_TEST_SECRET_DO_NOT_USE_IN_PROD";
    this.currency = cfg.currency || "CNY";
    // 模拟网关内部账本：outTradeNo -> { amount, currency, status, txId }
    this.gateway = new Map();
  }

  sign(payloadObj) {
    const base = Object.keys(payloadObj).filter((k) => k !== "sign").sort()
      .map((k) => `${k}=${payloadObj[k]}`).join("&");
    return createHmac("sha256", this.notifySecret).update(base).digest("hex");
  }

  async createPayment(order, method, ctx = {}) {
    const txId = `MOCKTX${Date.now()}${Math.floor(Math.random() * 1000)}`;
    this.gateway.set(order.payment_number, {
      amount: order.amount, currency: order.currency, status: "NOTPAY", txId,
    });
    // 按设备/渠道返回不同呈现方式(仅测试形态)
    const action = method === "apple_pay" ? "applepay_session"
      : ctx.device === "mobile" ? "redirect" : "qrcode";
    return {
      providerTransactionId: txId,
      action,
      qrContent: action === "qrcode" ? `mockpay://qr/${txId}` : undefined,
      redirectUrl: action === "redirect" ? `https://sandbox.mock/pay/${txId}` : undefined,
      sessionPayload: action === "applepay_session" ? { merchantSession: "MOCK", txId } : undefined,
      expiresInSec: 15 * 60,
      raw: { mock: true, txId },
    };
  }

  // 测试驱动：模拟用户在渠道侧完成/失败付款
  _simulatePay(outTradeNo, ok = true) {
    const g = this.gateway.get(outTradeNo);
    if (!g) throw new Error("MOCK_TX_NOT_FOUND");
    g.status = ok ? "SUCCESS" : "PAYERROR";
    return g;
  }
  _simulateExpire(outTradeNo) {
    const g = this.gateway.get(outTradeNo);
    if (g) g.status = "CLOSED";
    return g;
  }

  async queryPayment(payment) {
    const g = this.gateway.get(payment.payment_number);
    if (!g) return { status: "unpaid", providerTransactionId: null, amount: payment.amount, currency: payment.currency, raw: { mock: true } };
    return {
      status: normalizeProviderStatus(g.status),
      providerTransactionId: g.txId,
      amount: g.amount, currency: g.currency, raw: { mock: true, gwStatus: g.status },
    };
  }

  // 生成一条「渠道异步通知」(测试用)。真实环境这是渠道服务器 POST 过来的。
  buildNotification(outTradeNo, overrides = {}) {
    const g = this.gateway.get(outTradeNo) || {};
    const payload = {
      event_id: `EVT${Date.now()}${Math.floor(Math.random() * 1000)}`,
      transaction_id: g.txId, out_trade_no: outTradeNo,
      mch_id: this.mchId, app_id: this.appId,
      total_fee: g.amount, fee_type: g.currency,
      trade_state: g.status || "SUCCESS",
      ...overrides,
    };
    payload.sign = this.sign(payload);
    return payload;
  }

  async verifyNotification(req) {
    const p = req.body || req;
    // 1) 验签
    const expect = this.sign(p);
    if (!p.sign || p.sign !== expect) return null; // 伪造/篡改 -> 拒绝
    // 2) 归一为内部结构(商户号/appid/金额/币种核对交给业务处理器做，这里只做结构化)
    return {
      providerEventId: p.event_id,
      providerTransactionId: p.transaction_id,
      outTradeNo: p.out_trade_no,
      amount: Number(p.total_fee),
      currency: p.fee_type,
      status: normalizeProviderStatus(p.trade_state),
      mchId: p.mch_id, appId: p.app_id,
      raw: p,
    };
  }

  async closePayment(payment) {
    const g = this.gateway.get(payment.payment_number);
    if (g && g.status === "NOTPAY") g.status = "CLOSED";
    return { closed: true };
  }

  async createRefund(payment, amountCents, reason) {
    const refundId = `MOCKRF${Date.now()}${Math.floor(Math.random() * 1000)}`;
    return { providerRefundId: refundId, status: "refunding", amount: amountCents, reason, raw: { mock: true } };
  }
  async queryRefund(refund) {
    return { status: "refunded", providerRefundId: refund.provider_refund_id, raw: { mock: true } };
  }
}
