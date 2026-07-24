// Apple Pay Provider —— 不是独立支付公司，需由支持它的 PSP 承载。
// 三个条件同时满足才可用：① PSP 支持并已开通；② 域名验证成功；③ 当前设备/浏览器支持(前端探测)。
// 任一不满足则渠道「暂未开放」，前端隐藏入口 —— 绝不做假按钮、绝不伪造成功。
import { PaymentProvider } from "./PaymentProvider.js";
import { readProviderConfig, isChannelConfigured } from "./config.js";

export class ApplePayProvider extends PaymentProvider {
  constructor(env = {}) {
    super("apple_pay");
    this.env = env;
    this.cfg = readProviderConfig("apple_pay", env);
    this.configured = isChannelConfigured("apple_pay", env);
  }
  _guard() {
    if (!this.configured) throw new Error("apple_pay:NOT_CONFIGURED — 需 PSP 支持 + 商户开通 + 域名验证");
  }
  // POST /api/payments/apple-pay/session —— merchant validation，需商户身份证书
  async createSession(validationURL, ctx = {}) {
    this._guard();
    throw new Error("apple_pay:PENDING_REAL_CREDENTIALS");
  }
  // 拿到 Apple 加密支付令牌后，交给 PSP 完成实际扣款
  async createPayment(order, method = "apple_pay", ctx = {}) {
    this._guard();
    throw new Error("apple_pay:PENDING_REAL_CREDENTIALS");
  }
  async queryPayment(payment) { this._guard(); throw new Error("apple_pay:PENDING_REAL_CREDENTIALS"); }
  async verifyNotification(req) { this._guard(); throw new Error("apple_pay:PENDING_REAL_CREDENTIALS"); }
  async closePayment(payment) { this._guard(); throw new Error("apple_pay:PENDING_REAL_CREDENTIALS"); }
  async createRefund(payment, amountCents, reason) { this._guard(); throw new Error("apple_pay:PENDING_REAL_CREDENTIALS"); }
  async queryRefund(refund) { this._guard(); throw new Error("apple_pay:PENDING_REAL_CREDENTIALS"); }
}
