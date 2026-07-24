// 各支付渠道的「配置结构」与「可用性判定」。
// 关键原则：
//  - 所有敏感参数(私钥/证书/APIv3密钥/密码)只在服务端(Cloudflare Workers)通过 env 读取，
//    env 的值来自 Cloudflare Secrets；前端永远拿不到这些变量。
//  - 没有配置齐全的渠道，availability = "暂未开放"，前端据此禁用/隐藏，不做假按钮。
//  - business 层永远通过统一 Provider 接口调用，切换聚合服务商只改这里，不改业务。

/** 每个字段标注 sensitive(是否敏感)，敏感字段一律来自 Secrets，不得出现在前端或日志明文。 */
export const PROVIDER_CONFIG_SCHEMA = {
  wechat: {
    label: "微信支付",
    // PC 端默认 Native 扫码支付
    defaultMethod: "wechat_native",
    fields: {
      WECHAT_MCH_ID:              { sensitive: false, desc: "微信支付商户号(mchid)" },
      WECHAT_APP_ID:              { sensitive: false, desc: "关联的公众号/应用 AppID" },
      WECHAT_MERCHANT_SERIAL_NO:  { sensitive: false, desc: "商户 API 证书序列号" },
      WECHAT_MERCHANT_PRIVATE_KEY:{ sensitive: true,  desc: "商户 API 证书私钥(PEM)" },
      WECHAT_API_V3_KEY:          { sensitive: true,  desc: "APIv3 密钥(回调解密/验签)" },
      WECHATPAY_PUBLIC_KEY_ID:    { sensitive: false, desc: "微信支付公钥 ID" },
      WECHATPAY_PUBLIC_KEY:       { sensitive: true,  desc: "微信支付平台公钥(验签)" },
      WECHAT_NOTIFY_URL:          { sensitive: false, desc: "异步通知回调地址(我方 Workers 路由)" },
    },
    required: ["WECHAT_MCH_ID", "WECHAT_APP_ID", "WECHAT_MERCHANT_SERIAL_NO", "WECHAT_MERCHANT_PRIVATE_KEY", "WECHAT_API_V3_KEY"],
  },
  alipay: {
    label: "支付宝",
    // PC 端：电脑网站支付(alipay.trade.page.pay) 或 扫码支付(precreate)
    defaultMethod: "alipay_page",
    fields: {
      ALIPAY_APP_ID:          { sensitive: false, desc: "支付宝开放平台应用 AppID" },
      ALIPAY_APP_PRIVATE_KEY: { sensitive: true,  desc: "应用私钥(PEM)" },
      ALIPAY_PUBLIC_KEY:      { sensitive: true,  desc: "支付宝公钥(验签，非证书模式)" },
      ALIPAY_APP_CERT:        { sensitive: false, desc: "应用公钥证书(证书模式)" },
      ALIPAY_CERT:            { sensitive: false, desc: "支付宝公钥证书(证书模式)" },
      ALIPAY_ROOT_CERT:       { sensitive: false, desc: "支付宝根证书(证书模式)" },
      ALIPAY_NOTIFY_URL:      { sensitive: false, desc: "异步通知回调地址(我方 Workers 路由)" },
      ALIPAY_RETURN_URL:      { sensitive: false, desc: "同步跳转地址(仅展示，不作支付依据)" },
    },
    required: ["ALIPAY_APP_ID", "ALIPAY_APP_PRIVATE_KEY"],
  },
  unionpay: {
    label: "银联支付",
    // 先保留在线网关支付 / 聚合收银台适配接口，商户通道确认后再配置
    defaultMethod: "unionpay_gateway",
    fields: {
      UNIONPAY_MERCHANT_ID:        { sensitive: false, desc: "银联商户号" },
      UNIONPAY_SIGN_CERT:          { sensitive: false, desc: "签名证书(.pfx/.p12 base64)" },
      UNIONPAY_SIGN_CERT_PASSWORD: { sensitive: true,  desc: "签名证书密码" },
      UNIONPAY_VERIFY_CERT:        { sensitive: false, desc: "验签证书" },
      UNIONPAY_FRONT_URL:          { sensitive: false, desc: "前台通知地址(页面跳转)" },
      UNIONPAY_BACK_URL:           { sensitive: false, desc: "后台通知地址(我方 Workers 路由，支付依据)" },
      UNIONPAY_ENV:                { sensitive: false, desc: "环境: test / prod" },
    },
    required: ["UNIONPAY_MERCHANT_ID", "UNIONPAY_SIGN_CERT", "UNIONPAY_SIGN_CERT_PASSWORD"],
  },
  apple_pay: {
    label: "Apple Pay",
    // 不是独立支付公司，需由支持它的 PSP 承载；且需域名验证 + 设备/浏览器支持
    defaultMethod: "apple_pay",
    fields: {
      APPLE_MERCHANT_ID:                 { sensitive: false, desc: "Apple Merchant ID (merchant.xxx)" },
      APPLE_TEAM_ID:                     { sensitive: false, desc: "Apple Developer Team ID" },
      APPLE_MERCHANT_DOMAIN:             { sensitive: false, desc: "已完成域名验证的收款域名" },
      APPLE_PAYMENT_PROCESSING_CERT:     { sensitive: false, desc: "支付处理证书" },
      APPLE_PAYMENT_PROCESSING_PRIVATE_KEY:{ sensitive: true, desc: "支付处理证书私钥" },
      APPLE_MERCHANT_IDENTITY_CERT:      { sensitive: false, desc: "商户身份证书(用于 merchant validation)" },
      APPLE_MERCHANT_IDENTITY_PRIVATE_KEY:{ sensitive: true, desc: "商户身份证书私钥" },
      APPLE_PSP_PROVIDER:                { sensitive: false, desc: "承载 Apple Pay 的 PSP 标识(如 stripe/adyen/国内PSP)" },
      APPLE_PSP_API_KEY:                 { sensitive: true,  desc: "PSP 服务端 API Key" },
    },
    // 只有 PSP 支持 + 商户开通 + 域名验证都齐全才算 configured
    required: ["APPLE_MERCHANT_ID", "APPLE_MERCHANT_DOMAIN", "APPLE_PSP_PROVIDER", "APPLE_PSP_API_KEY"],
  },
  bank_transfer: {
    label: "对公转账",
    defaultMethod: "bank_transfer",
    // 无需渠道密钥，纯人工流程；始终可用
    fields: {
      BANK_ACCOUNT_NAME:   { sensitive: false, desc: "对公收款账户名称" },
      BANK_ACCOUNT_NUMBER: { sensitive: false, desc: "对公收款账号" },
      BANK_NAME:           { sensitive: false, desc: "开户行" },
    },
    required: [],
    alwaysAvailable: true,
  },
  manual_collect: {
    label: "人工收款(收款码)",
    defaultMethod: "manual_collect",
    // 人工收款模式(B)：客户扫我方微信/支付宝个人或商户收款码付款并上传凭证 -> pending_manual_verification
    fields: {
      MANUAL_WECHAT_QR_URL: { sensitive: false, desc: "微信收款码图片地址(R2 公开或受控)" },
      MANUAL_ALIPAY_QR_URL: { sensitive: false, desc: "支付宝收款码图片地址" },
    },
    required: [],
    manualOnly: true,
  },
};

/** 读取某渠道配置(只在服务端调用)。 */
export function readProviderConfig(channel, env = {}) {
  const schema = PROVIDER_CONFIG_SCHEMA[channel];
  if (!schema) throw new Error(`UNKNOWN_CHANNEL:${channel}`);
  const cfg = {};
  for (const key of Object.keys(schema.fields)) cfg[key] = env[key];
  return cfg;
}

/** 渠道是否已配置齐全(required 全部有值)。 */
export function isChannelConfigured(channel, env = {}) {
  const schema = PROVIDER_CONFIG_SCHEMA[channel];
  if (!schema) return false;
  if (schema.alwaysAvailable) return true;
  return schema.required.every((k) => env[k] != null && String(env[k]).trim() !== "");
}

/**
 * 计算前端展示用的渠道可用性 map。
 * @param {Object} env   Workers 环境(含 Secrets)。TEST 模式看 PAYMENT_MODE=test。
 * @param {Object} ctx   { applePaySupported: boolean }  由前端探测传入
 * @returns 每个渠道 { channel, label, available, display, reason }
 */
export function channelAvailability(env = {}, ctx = {}) {
  const isTest = String(env.PAYMENT_MODE || "").toLowerCase() === "test";
  const out = [];
  for (const [channel, schema] of Object.entries(PROVIDER_CONFIG_SCHEMA)) {
    let available = false;
    let reason = "";
    if (isTest && channel !== "bank_transfer") {
      // 测试模式：走 MockProvider，标记 TEST
      available = true;
      reason = "TEST 模式(MockProvider)";
    } else if (schema.alwaysAvailable) {
      available = true;
    } else if (!isChannelConfigured(channel, env)) {
      available = false;
      reason = "未配置商户参数";
    } else if (channel === "apple_pay") {
      // Apple Pay 额外要求当前设备/浏览器支持
      available = ctx.applePaySupported === true;
      reason = available ? "" : "当前设备/浏览器不支持或未开通";
    } else {
      available = true;
    }
    out.push({
      channel,
      label: schema.label,
      available,
      display: available ? (isTest && channel !== "bank_transfer" ? `${schema.label}（TEST）` : schema.label) : `${schema.label}｜暂未开放`,
      reason,
    });
  }
  return out;
}
