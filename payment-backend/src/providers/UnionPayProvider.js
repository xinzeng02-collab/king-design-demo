// 银联 Provider —— 先保留「在线网关支付 / 聚合收银台」适配接口，商户通道确认后再配置。
// 骨架：未配置时抛 NOT_CONFIGURED，绝不伪造成功。
import { PaymentProvider } from "./PaymentProvider.js";
import { readProviderConfig, isChannelConfigured } from "./config.js";

export class UnionPayProvider extends PaymentProvider {
  constructor(env = {}) {
    super("unionpay");
    this.env = env;
    this.cfg = readProviderConfig("unionpay", env);
    this.configured = isChannelConfigured("unionpay", env);
  }
  _guard() {
    if (!this.configured) throw new Error("unionpay:NOT_CONFIGURED — 请在 Cloudflare Secrets 配置银联商户参数");
  }
  // unionpay_gateway: 跳转银联在线网关收银台
  async createPayment(order, method = "unionpay_gateway", ctx = {}) {
    this._guard();
    throw new Error("unionpay:PENDING_REAL_CREDENTIALS");
  }
  async queryPayment(payment) { this._guard(); throw new Error("unionpay:PENDING_REAL_CREDENTIALS"); }
  async verifyNotification(req) { this._guard(); throw new Error("unionpay:PENDING_REAL_CREDENTIALS"); }
  async closePayment(payment) { this._guard(); throw new Error("unionpay:PENDING_REAL_CREDENTIALS"); }
  async createRefund(payment, amountCents, reason) { this._guard(); throw new Error("unionpay:PENDING_REAL_CREDENTIALS"); }
  async queryRefund(refund) { this._guard(); throw new Error("unionpay:PENDING_REAL_CREDENTIALS"); }
}
