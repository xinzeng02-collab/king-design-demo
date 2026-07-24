// 订单 / 支付 / 交付 三个状态机完全分离，不共用一个 status 字段。
// 每个状态机只声明「允许的迁移」，非法迁移一律抛错，保证状态只能向前/合法流转。

export const ORDER_STATUS = ["draft", "pending_confirmation", "active", "completed", "cancelled", "expired"];
// 说明：pending_manual_verification 用于「人工收款模式(B)」——客户用我方收款码付款并上传凭证后进入此态，
// 只有财务确认真实到账才能转 paid；自动支付模式(A)不会用到它。
export const PAYMENT_STATUS = ["unpaid", "processing", "pending_manual_verification", "paid", "partially_refunded", "refunding", "refunded", "failed", "expired"];
export const DELIVERY_STATUS = ["not_ready", "preparing", "ready", "downloaded", "frozen", "revoked"];

const ORDER_TRANSITIONS = {
  draft: ["pending_confirmation", "cancelled"],
  pending_confirmation: ["active", "cancelled", "expired"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  expired: [],
};

const PAYMENT_TRANSITIONS = {
  unpaid: ["processing", "pending_manual_verification", "expired", "failed"],
  pending_manual_verification: ["paid", "failed", "unpaid"], // 财务确认->paid；驳回->failed/unpaid
  processing: ["paid", "failed", "expired", "unpaid"], // unpaid: 用户取消后可重新发起
  paid: ["refunding", "partially_refunded"],
  refunding: ["refunded", "partially_refunded", "paid"], // paid: 退款失败回滚
  partially_refunded: ["refunding", "refunded"],
  refunded: [],
  failed: ["processing"], // 允许重新发起支付
  expired: ["processing"], // 允许重新发起支付
};

const DELIVERY_TRANSITIONS = {
  not_ready: ["preparing"],
  preparing: ["ready", "not_ready"],
  ready: ["downloaded", "frozen", "revoked"],
  downloaded: ["frozen", "revoked", "ready"],
  frozen: ["ready", "revoked"],
  revoked: [],
};

function guard(map, name) {
  return (from, to) => {
    if (from === to) return true; // 幂等：同状态视为通过
    const allowed = map[from];
    if (!allowed) throw new Error(`${name}_UNKNOWN_STATE:${from}`);
    if (!allowed.includes(to)) throw new Error(`${name}_ILLEGAL_TRANSITION:${from}->${to}`);
    return true;
  };
}

export const canOrderTransition = guard(ORDER_TRANSITIONS, "ORDER");
export const canPaymentTransition = guard(PAYMENT_TRANSITIONS, "PAYMENT");
export const canDeliveryTransition = guard(DELIVERY_TRANSITIONS, "DELIVERY");

// 支付渠道原始状态 -> 内部统一支付状态。所有 Provider 都要归一到这里。
export function normalizeProviderStatus(raw) {
  const map = {
    SUCCESS: "paid", TRADE_SUCCESS: "paid", PAID: "paid",
    NOTPAY: "unpaid", WAIT_BUYER_PAY: "processing", USERPAYING: "processing",
    CLOSED: "expired", TRADE_CLOSED: "expired", REVOKED: "expired",
    PAYERROR: "failed", FAIL: "failed",
    REFUND: "refunding", REFUNDING: "refunding",
  };
  return map[String(raw || "").toUpperCase()] || "unpaid";
}
