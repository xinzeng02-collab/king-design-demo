// 人工收款(收款码) Provider —— 收款模式 B。
// 客户扫我方微信/支付宝收款码付款并上传凭证 -> 订单进入 pending_manual_verification。
// 只有财务在银行/商户后台确认真实到账，业务层才把 payment_status 改为 paid。
// 客户上传截图 != 支付成功。
import { PaymentProvider } from "./PaymentProvider.js";
import { readProviderConfig } from "./config.js";

export class ManualCollectProvider extends PaymentProvider {
  constructor(env = {}) {
    super("manual_collect");
    this.cfg = readProviderConfig("manual_collect", env);
  }
  async createPayment(order, method = "manual_collect", ctx = {}) {
    const qr = ctx.channelHint === "alipay" ? this.cfg.MANUAL_ALIPAY_QR_URL : this.cfg.MANUAL_WECHAT_QR_URL;
    return {
      providerTransactionId: null,
      action: "offline",
      offline: {
        qrUrl: qr || "",
        note: "扫码付款后请上传付款凭证；到账以财务确认为准（pending_manual_verification）。",
      },
      expiresInSec: 24 * 3600,
      raw: { manual: true },
    };
  }
  async queryPayment(payment) {
    return { status: payment.status || "unpaid", providerTransactionId: null, amount: payment.amount, currency: payment.currency, raw: { manual: true } };
  }
  async closePayment() { return { closed: true }; }
}
