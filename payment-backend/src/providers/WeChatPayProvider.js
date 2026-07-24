// 微信支付 Provider —— PC 端默认 Native 扫码支付(wechat_native)。
// 骨架：结构与统一接口就位；真实调用需 Cloudflare Secrets 里的商户参数。
// 未配置时抛 NOT_CONFIGURED，绝不伪造成功。
import { PaymentProvider } from "./PaymentProvider.js";
import { readProviderConfig, isChannelConfigured } from "./config.js";

export class WeChatPayProvider extends PaymentProvider {
  constructor(env = {}) {
    super("wechat");
    this.env = env;
    this.cfg = readProviderConfig("wechat", env);
    this.configured = isChannelConfigured("wechat", env);
  }
  _guard() {
    if (!this.configured) throw new Error("wechat:NOT_CONFIGURED — 请在 Cloudflare Secrets 配置微信支付商户参数");
  }
  // PC Native：调用 /v3/pay/transactions/native，返回二维码 code_url
  async createPayment(order, method = "wechat_native", ctx = {}) {
    this._guard();
    // TODO(接入真实密钥后)：APIv3 签名 + 请求 native 下单 -> 返回 code_url
    throw new Error("wechat:PENDING_REAL_CREDENTIALS");
  }
  async queryPayment(payment) { this._guard(); throw new Error("wechat:PENDING_REAL_CREDENTIALS"); }
  async verifyNotification(req) { this._guard(); throw new Error("wechat:PENDING_REAL_CREDENTIALS"); }
  async closePayment(payment) { this._guard(); throw new Error("wechat:PENDING_REAL_CREDENTIALS"); }
  async createRefund(payment, amountCents, reason) { this._guard(); throw new Error("wechat:PENDING_REAL_CREDENTIALS"); }
  async queryRefund(refund) { this._guard(); throw new Error("wechat:PENDING_REAL_CREDENTIALS"); }
}
