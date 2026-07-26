// 生产仓储：通过 Supabase PostgREST 读写。用 SERVICE_ROLE_KEY(仅服务端) 执行权威写入。
// 接口与 InMemoryRepo 完全一致，业务处理器无需改动。
// 幂等：payment_events (provider, provider_event_id) 有唯一索引；插入冲突(409)即视为重复。
export class SupabaseRepo {
  constructor(env) {
    this.url = env.SUPABASE_URL;
    this.key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!this.url || !this.key) throw new Error("SUPABASE_ENV_MISSING");
  }
  async _req(path, { method = "GET", body, prefer } = {}) {
    const headers = { apikey: this.key, authorization: `Bearer ${this.key}`, "content-type": "application/json" };
    if (prefer) headers.prefer = prefer;
    const res = await fetch(`${this.url}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 409) return { _conflict: true };
    if (!res.ok) throw new Error(`SUPABASE_${res.status}:${await res.text()}`);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }
  async _one(path) { const r = await this._req(path); return Array.isArray(r) ? (r[0] || null) : r; }

  // 订单
  getOrder(id) { return this._one(`orders?id=eq.${id}&limit=1`); }
  getOrderByNumber(n) { return this._one(`orders?order_number=eq.${encodeURIComponent(n)}&limit=1`); }
  async updateOrder(id, patch) { return this._req(`orders?id=eq.${id}`, { method: "PATCH", body: patch, prefer: "return=representation" }); }
  getDeliveryFile(id) { return this._one(`delivery_files?id=eq.${id}&limit=1`); }
  async listDeliveryFiles(orderId) { return (await this._req(`delivery_files?order_id=eq.${orderId}`)) || []; }

  // 支付
  async createPayment(p) { const r = await this._req(`payments`, { method: "POST", body: p, prefer: "return=representation" }); return Array.isArray(r) ? r[0] : r; }
  getPayment(id) { return this._one(`payments?id=eq.${id}&limit=1`); }
  getPaymentByNumber(n) { return this._one(`payments?payment_number=eq.${encodeURIComponent(n)}&limit=1`); }
  async listPaymentsByOrder(orderId) { return (await this._req(`payments?order_id=eq.${orderId}`)) || []; }
  async updatePayment(id, patch) { return this._req(`payments?id=eq.${id}`, { method: "PATCH", body: patch, prefer: "return=representation" }); }

  // 支付事件（幂等）
  async insertPaymentEvent(ev) {
    const r = await this._req(`payment_events`, { method: "POST", body: ev, prefer: "return=representation,resolution=ignore-duplicates" });
    if (r && r._conflict) return { inserted: false };
    // ignore-duplicates 时冲突会返回空数组
    if (Array.isArray(r) && r.length === 0 && ev.provider_event_id) return { inserted: false };
    return { inserted: true };
  }

  // 退款
  async createRefund(r) { const x = await this._req(`refunds`, { method: "POST", body: r, prefer: "return=representation" }); return Array.isArray(x) ? x[0] : x; }
  getRefund(id) { return this._one(`refunds?id=eq.${id}&limit=1`); }
  async listRefundsByPayment(pid) { return (await this._req(`refunds?payment_id=eq.${pid}`)) || []; }
  async updateRefund(id, patch) { return this._req(`refunds?id=eq.${id}`, { method: "PATCH", body: patch }); }

  // 对公转账
  async createBankTransfer(b) { const x = await this._req(`bank_transfer_records`, { method: "POST", body: b, prefer: "return=representation" }); return Array.isArray(x) ? x[0] : x; }
  getBankTransfer(id) { return this._one(`bank_transfer_records?id=eq.${id}&limit=1`); }
  async updateBankTransfer(id, patch) { return this._req(`bank_transfer_records?id=eq.${id}`, { method: "PATCH", body: patch }); }

  // 下载令牌
  async createDownloadToken(t) { const x = await this._req(`download_tokens`, { method: "POST", body: t, prefer: "return=representation" }); return Array.isArray(x) ? x[0] : x; }

  // 审计
  async insertAudit(a) { return this._req(`audit_logs`, { method: "POST", body: a }); }

  // 成员/角色
  getMembership(userId) { return this._one(`memberships?user_id=eq.${userId}&limit=1`); }
}
