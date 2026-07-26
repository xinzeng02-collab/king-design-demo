// Provider 注册与解析。业务层只调用 resolveProvider(method, env)，
// 由这里决定用哪个 Provider；测试模式统一走 MockProvider。
import { MockProvider } from "./MockProvider.js";
import { WeChatPayProvider } from "./WeChatPayProvider.js";
import { AlipayProvider } from "./AlipayProvider.js";
import { UnionPayProvider } from "./UnionPayProvider.js";
import { ApplePayProvider } from "./ApplePayProvider.js";
import { BankTransferProvider } from "./BankTransferProvider.js";
import { ManualCollectProvider } from "./ManualCollectProvider.js";

// 支付方式 -> 渠道
export const METHOD_TO_CHANNEL = {
  wechat_native: "wechat",
  alipay_page: "alipay",
  alipay_qr: "alipay",
  unionpay_gateway: "unionpay",
  apple_pay: "apple_pay",
  bank_transfer: "bank_transfer",
  manual_collect: "manual_collect",
};

export function isTestMode(env = {}) {
  return String(env.PAYMENT_MODE || "").toLowerCase() === "test";
}

/**
 * 解析出 Provider 实例。
 * - 测试模式：除对公转账/人工收款外，一律用 MockProvider(标记 TEST)。
 * - 生产模式：按渠道返回真实 Provider(未配置会在调用时抛 NOT_CONFIGURED)。
 */
export function resolveProvider(method, env = {}) {
  const channel = METHOD_TO_CHANNEL[method];
  if (!channel) throw new Error(`UNKNOWN_METHOD:${method}`);

  // 对公转账 / 人工收款 永远走各自 Provider(与测试/生产无关)
  if (channel === "bank_transfer") return new BankTransferProvider(env);
  if (channel === "manual_collect") return new ManualCollectProvider(env);

  if (isTestMode(env)) {
    return new MockProvider({
      mchId: env.MOCK_MCH_ID, appId: env.MOCK_APP_ID, notifySecret: env.MOCK_NOTIFY_SECRET,
    });
  }
  return resolveProviderByChannel(channel, env);
}

/** 回调/查单按「渠道」解析 Provider 实例。测试模式统一 Mock。 */
export function resolveProviderByChannel(channel, env = {}) {
  if (channel === "bank_transfer") return new BankTransferProvider(env);
  if (channel === "manual_collect") return new ManualCollectProvider(env);
  if (isTestMode(env)) {
    return new MockProvider({ mchId: env.MOCK_MCH_ID, appId: env.MOCK_APP_ID, notifySecret: env.MOCK_NOTIFY_SECRET });
  }
  switch (channel) {
    case "wechat": return new WeChatPayProvider(env);
    case "alipay": return new AlipayProvider(env);
    case "unionpay": return new UnionPayProvider(env);
    case "apple_pay": return new ApplePayProvider(env);
    default: throw new Error(`UNKNOWN_CHANNEL:${channel}`);
  }
}
