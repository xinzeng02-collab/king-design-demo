// 仓储层接口。业务处理器只依赖这些方法，不关心底层是 Supabase 还是内存。
// - InMemoryRepo：用于自动化测试(node --test)，无需数据库。
// - SupabaseRepo(见 supabaseRepo.js)：Cloudflare Workers 运行时用。
//
// 关键：payment_events 的 (provider, provider_event_id) 唯一约束是「回调幂等」的基石。

function uid(prefix) { return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; }

export class InMemoryRepo {
  constructor() {
    this.orders = new Map();
    this.orderItems = [];
    this.payments = new Map();
    this.paymentEvents = [];
    this.paymentEventKeys = new Set();   // `${provider}:${eventId}` 幂等去重
    this.refunds = new Map();
    this.bankTransfers = new Map();
    this.deliveryFiles = new Map();
    this.downloadTokens = [];
    this.auditLogs = [];
  }

  // ---- 订单 ----
  seedOrder(o) { const row = { id: o.id || uid("ord"), ...o }; this.orders.set(row.id, row); return row; }
  getOrder(id) { return this.orders.get(id) || null; }
  getOrderByNumber(n) { for (const o of this.orders.values()) if (o.order_number === n) return o; return null; }
  updateOrder(id, patch) { const o = this.orders.get(id); if (!o) throw new Error("ORDER_NOT_FOUND"); Object.assign(o, patch); return o; }

  seedDeliveryFile(f) { const row = { id: f.id || uid("df"), version: 1, ...f }; this.deliveryFiles.set(row.id, row); return row; }
  getDeliveryFile(id) { return this.deliveryFiles.get(id) || null; }
  listDeliveryFiles(orderId) { return [...this.deliveryFiles.values()].filter((f) => f.order_id === orderId); }

  // ---- 支付 ----
  createPayment(p) { const row = { id: uid("pay"), created_at: Date.now(), ...p }; this.payments.set(row.id, row); return row; }
  getPayment(id) { return this.payments.get(id) || null; }
  getPaymentByNumber(n) { for (const p of this.payments.values()) if (p.payment_number === n) return p; return null; }
  listPaymentsByOrder(orderId) { return [...this.payments.values()].filter((p) => p.order_id === orderId); }
  updatePayment(id, patch) { const p = this.payments.get(id); if (!p) throw new Error("PAYMENT_NOT_FOUND"); Object.assign(p, patch); return p; }

  // ---- 支付事件（幂等）----
  // 返回 { inserted:boolean }。inserted=false 表示同一事件已处理过（幂等命中）。
  insertPaymentEvent(ev) {
    const key = ev.provider_event_id ? `${ev.provider}:${ev.provider_event_id}` : null;
    if (key && this.paymentEventKeys.has(key)) {
      this.paymentEvents.push({ id: uid("evt"), ...ev, note: "duplicate" });
      return { inserted: false };
    }
    if (key) this.paymentEventKeys.add(key);
    this.paymentEvents.push({ id: uid("evt"), created_at: Date.now(), ...ev });
    return { inserted: true };
  }

  // ---- 退款 ----
  createRefund(r) { const row = { id: uid("ref"), created_at: Date.now(), ...r }; this.refunds.set(row.id, row); return row; }
  getRefund(id) { return this.refunds.get(id) || null; }
  listRefundsByPayment(pid) { return [...this.refunds.values()].filter((r) => r.payment_id === pid); }
  updateRefund(id, patch) { const r = this.refunds.get(id); if (!r) throw new Error("REFUND_NOT_FOUND"); Object.assign(r, patch); return r; }

  // ---- 对公转账 ----
  createBankTransfer(b) { const row = { id: uid("bt"), submitted_at: Date.now(), status: "submitted", ...b }; this.bankTransfers.set(row.id, row); return row; }
  getBankTransfer(id) { return this.bankTransfers.get(id) || null; }
  updateBankTransfer(id, patch) { const b = this.bankTransfers.get(id); if (!b) throw new Error("BANK_TRANSFER_NOT_FOUND"); Object.assign(b, patch); return b; }

  // ---- 下载令牌 ----
  createDownloadToken(t) { const row = { id: uid("dl"), issued_at: Date.now(), ...t }; this.downloadTokens.push(row); return row; }
  listDownloadTokens(orderId) { return this.downloadTokens.filter((t) => t.order_id === orderId); }

  // ---- 审计 ----
  insertAudit(a) { const row = { id: uid("aud"), created_at: Date.now(), ...a }; this.auditLogs.push(row); return row; }
}
