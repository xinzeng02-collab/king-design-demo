// 订单生命周期的「派生视图」——纯函数，前后端共用，保证按钮/菜单逻辑只有一处真相。
// 对应需求：第十六节(客户订单页主按钮状态机) + 第六节(订单列表 ··· 菜单规则)。

// 中文标签（前端展示用；避免在多处硬编码）
export const LABELS = {
  order: { draft: "草稿", pending_confirmation: "待确认", pending_signing: "待签约", active: "进行中", completed: "已完成", cancelled: "已取消", expired: "已过期", archived: "已归档" },
  payment: { unpaid: "未支付", processing: "支付处理中", pending_manual_verification: "待财务确认", paid: "已支付", partially_refunded: "部分退款", refunding: "退款中", refunded: "已退款", failed: "支付失败", expired: "已过期" },
  delivery: { not_ready: "未准备", preparing: "准备中", prepared_locked: "已准备待付款", ready: "可下载", downloaded: "已下载", frozen: "已冻结", revoked: "已撤回" },
  review: { not_started: "未开始", in_progress: "进行中", completed: "已完成选稿", returned: "已退回修改", order_created: "已生成订单", closed: "已关闭" },
  agreement: { no_agreement: "未上传协议", agreement_uploaded: "协议已上传", awaiting_signature: "待客户签署", signed_returned: "客户已回传", reviewing: "审核中", rejected: "审核驳回", signed: "已签署" },
};

/**
 * 客户订单页「主按钮」状态机（第十六节）。
 * @param {{order_status,agreement_status,payment_status,delivery_status}} o
 * @returns {{label,action,disabled}}
 */
export function resolvePrimaryButton(o) {
  const { order_status, agreement_status, payment_status, delivery_status } = o;
  if (order_status === "cancelled") return { label: "订单已取消", action: null, disabled: true };
  if (order_status === "completed" || order_status === "archived") return { label: "查看订单记录", action: "view_record", disabled: false };

  // 签约阶段（未进入支付前）
  if (agreement_status !== "signed") {
    if (agreement_status === "rejected") return { label: "重新上传签署文件", action: "resubmit_sign", disabled: false };
    if (agreement_status === "signed_returned" || agreement_status === "reviewing") return { label: "签署文件审核中", action: null, disabled: true };
    // no_agreement / agreement_uploaded / awaiting_signature
    return { label: "查看并签署", action: "sign", disabled: false };
  }

  // 已签署 -> 支付阶段
  if (payment_status === "unpaid" || payment_status === "failed" || payment_status === "expired") return { label: "立即支付", action: "pay", disabled: false };
  if (payment_status === "processing" || payment_status === "pending_manual_verification") return { label: "正在确认支付", action: null, disabled: true };
  if (["refunding", "refunded", "partially_refunded"].includes(payment_status)) return { label: "查看订单记录", action: "view_record", disabled: false };

  // 已支付 -> 交付阶段
  if (payment_status === "paid") {
    if (["not_ready", "preparing", "prepared_locked"].includes(delivery_status)) return { label: "等待交付", action: null, disabled: true };
    if (delivery_status === "ready") return { label: "查看交付文件", action: "view_delivery", disabled: false };
    if (delivery_status === "downloaded") return { label: "下载交付文件", action: "download", disabled: false };
    if (["frozen", "revoked"].includes(delivery_status)) return { label: "查看订单记录", action: "view_record", disabled: false };
  }
  return { label: "查看订单", action: "view_record", disabled: false };
}

/**
 * 订单列表 ··· 菜单可用操作（第六节）。
 * 删除仅限「草稿 + 无客户行为 + 无支付记录」；进入客户流程后只能取消/归档。
 * @param {{order_status, hasPayment?:boolean, hasClientAction?:boolean}} o
 * @returns {string[]} 操作 key 列表
 */
export function resolveOrderActions(o) {
  const paidOrSigned = o.hasPayment || ["active", "completed", "archived"].includes(o.order_status);
  if (o.order_status === "draft" && !o.hasPayment && !o.hasClientAction) {
    return ["view", "edit", "generate_contract", "delete"];
  }
  if (paidOrSigned) {
    // 已签约/已支付：不能删除，只能取消/归档
    return ["view", "view_contract", "view_payment", "view_delivery", "cancel", "refund", "archive"];
  }
  // 已发送但客户未签署
  return ["view", "view_contract", "remind_sign", "withdraw_sign", "cancel"];
}

/** 是否允许「删除」（区别于取消/归档）。 */
export function canDeleteOrder(o) {
  return o.order_status === "draft" && !o.hasPayment && !o.hasClientAction;
}
