// 对公转账 Provider —— 无需渠道密钥。createPayment 只返回收款账户信息；
// 是否到账由「财务人工确认」决定(见 bank_transfer_records 流程)，绝不因客户上传截图就算 paid。
import { PaymentProvider } from "./PaymentProvider.js";
import { readProviderConfig } from "./config.js";

export class BankTransferProvider extends PaymentProvider {
  constructor(env = {}) {
    super("bank_transfer");
    this.cfg = readProviderConfig("bank_transfer", env);
  }
  async createPayment(order, method = "bank_transfer", ctx = {}) {
    return {
      providerTransactionId: null,
      action: "offline",
      offline: {
        accountName: this.cfg.BANK_ACCOUNT_NAME || "",
        accountNumber: this.cfg.BANK_ACCOUNT_NUMBER || "",
        bankName: this.cfg.BANK_NAME || "",
        note: "请客户上传付款凭证；到账以财务确认为准。",
      },
      expiresInSec: 7 * 24 * 3600,
      raw: { offline: true },
    };
  }
  // 对公转账没有渠道回调；查单等价于「查财务是否已确认」，由业务层处理。
  async queryPayment(payment) {
    return { status: payment.status || "unpaid", providerTransactionId: null, amount: payment.amount, currency: payment.currency, raw: { offline: true } };
  }
  async closePayment() { return { closed: true }; }
}
