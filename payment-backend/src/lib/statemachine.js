// 订单 / 支付 / 交付 三个状态机完全分离，不共用一个 status 字段。
// 每个状态机只声明「允许的迁移」，非法迁移一律抛错，保证状态只能向前/合法流转。

// 订单状态：草稿/待确认/待签约/进行中/已完成/已取消/已过期/已归档
export const ORDER_STATUS = ["draft", "pending_confirmation", "pending_signing", "active", "completed", "cancelled", "expired", "archived"];
// 说明：pending_manual_verification 用于「人工收款模式(B)」——客户用我方收款码付款并上传凭证后进入此态，
// 只有财务确认真实到账才能转 paid；自动支付模式(A)不会用到它。
export const PAYMENT_STATUS = ["unpaid", "processing", "pending_manual_verification", "paid", "partially_refunded", "refunding", "refunded", "failed", "expired"];
// 交付状态：未准备/准备中/已准备待付款(锁定)/可下载/已下载/已冻结/已撤回
// prepared_locked = 交付包已上传但未付款，前端显示锁定遮罩；付款成功后 -> ready(可下载)。
export const DELIVERY_STATUS = ["not_ready", "preparing", "prepared_locked", "ready", "downloaded", "frozen", "revoked"];
// 看稿状态：未开始/进行中/已完成选稿/已退回修改/已生成订单/已关闭
export const REVIEW_STATUS = ["not_started", "in_progress", "completed", "returned", "order_created", "closed"];
// 签约状态：未上传协议/协议已上传/待客户签署/客户已回传/审核中/审核驳回/已签署
export const AGREEMENT_STATUS = ["no_agreement", "agreement_uploaded", "awaiting_signature", "signed_returned", "reviewing", "rejected", "signed"];

const ORDER_TRANSITIONS = {
  draft: ["pending_confirmation", "pending_signing", "cancelled"],
  pending_confirmation: ["pending_signing", "active", "cancelled", "expired"],
  pending_signing: ["active", "cancelled", "expired"], // 签署审核通过后 -> active(进入支付)
  active: ["completed", "cancelled"],
  completed: ["archived"],
  cancelled: ["archived"],
  expired: ["cancelled", "archived"],
  archived: [],
};

const REVIEW_TRANSITIONS = {
  not_started: ["in_progress", "closed"],
  in_progress: ["completed", "closed"],
  completed: ["order_created", "returned", "closed"],
  returned: ["in_progress", "closed"], // 销售退回修改 -> 客户重新编辑
  order_created: ["closed"],
  closed: [],
};

const AGREEMENT_TRANSITIONS = {
  no_agreement: ["agreement_uploaded"],
  agreement_uploaded: ["awaiting_signature", "no_agreement"], // 可重新上传合同
  awaiting_signature: ["signed_returned", "agreement_uploaded"],
  signed_returned: ["reviewing"],
  reviewing: ["signed", "rejected"],
  rejected: ["awaiting_signature", "agreement_uploaded", "signed_returned"], // 驳回 -> 客户重新上传签署件(直接再回传)
  signed: [],
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
  preparing: ["prepared_locked", "ready", "not_ready"],
  prepared_locked: ["ready", "frozen", "revoked"], // 付款成功 -> ready(解锁)
  ready: ["downloaded", "frozen", "revoked"],
  downloaded: ["frozen", "revoked", "ready"],
  frozen: ["ready", "prepared_locked", "revoked"],
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
export const canReviewTransition = guard(REVIEW_TRANSITIONS, "REVIEW");
export const canAgreementTransition = guard(AGREEMENT_TRANSITIONS, "AGREEMENT");

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
