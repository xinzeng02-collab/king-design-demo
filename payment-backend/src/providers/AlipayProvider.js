// 支付宝 Provider —— PC 端：电脑网站支付(alipay_page) 或 扫码支付(alipay_qr)。
// 骨架：未配置时抛 NOT_CONFIGURED，绝不伪造成功。
import { PaymentProvider } from "./PaymentProvider.js";
import { readProviderConfig, isChannelConfigured } from "./config.js";

export class AlipayProvider extends PaymentProvider {
  constructor(env = {}) {
    super("alipay");
    this.env = env;
    this.cfg = readProviderConfig("alipay", env);
    this.configured = isChannelConfigured("alipay", env);
  }
  _guard() {
    if (!this.configured) throw new Error("alipay:NOT_CONFIGURED — 请在 Cloudflare Secrets 配置支付宝应用参数");
  }
  // alipay_page: 生成收银台跳转 URL；alipay_qr: precreate 返回二维码
  async createPayment(order, method = "alipay_page", ctx = {}) {
    this._guard();
    throw new Error("alipay:PENDING_REAL_CREDENTIALS");
  }
  async queryPayment(payment) { this._guard(); throw new Error("alipay:PENDING_REAL_CREDENTIALS"); }
  async verifyNotification(req) { this._guard(); throw new Error("alipay:PENDING_REAL_CREDENTIALS"); }
  async closePayment(payment) { this._guard(); throw new Error("alipay:PENDING_REAL_CREDENTIALS"); }
  async createRefund(payment, amountCents, reason) { this._guard(); throw new Error("alipay:PENDING_REAL_CREDENTIALS"); }
  async queryRefund(refund) { this._guard(); throw new Error("alipay:PENDING_REAL_CREDENTIALS"); }
}
