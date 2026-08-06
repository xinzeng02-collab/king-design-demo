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

  // 管理工作台（RPC 内用 revision 做原子乐观锁）
  getStudioState(organizationId) { return this._one(`studio_states?organization_id=eq.${organizationId}&limit=1`); }
  async replaceStudioState(organizationId, state, revision, updatedBy) {
    const result = await this._req("rpc/replace_studio_state", { method: "POST", body: {
      p_organization_id: organizationId, p_state: state,
      p_expected_revision: revision, p_updated_by: updatedBy,
    } });
    return Array.isArray(result) ? (result[0] || null) : result;
  }
  async updateStudioModule(organizationId, module, value, revision, updatedBy) {
    const result = await this._req("rpc/update_studio_module", { method: "POST", body: {
      p_organization_id: organizationId, p_module: module, p_value: value,
      p_expected_revision: revision, p_updated_by: updatedBy,
    } });
    return Array.isArray(result) ? (result[0] || null) : result;
  }

  // 看稿会话
  async createReviewSession(s) { const x = await this._req(`review_sessions`, { method: "POST", body: s, prefer: "return=representation" }); return Array.isArray(x) ? x[0] : x; }
  getReviewSession(id) { return this._one(`review_sessions?id=eq.${id}&limit=1`); }
  async updateReviewSession(id, patch) { return this._req(`review_sessions?id=eq.${id}`, { method: "PATCH", body: patch }); }
  async addReviewItem(it) { const x = await this._req(`review_items`, { method: "POST", body: it, prefer: "return=representation,resolution=merge-duplicates" }); return Array.isArray(x) ? x[0] : x; }
  async removeReviewItem(sessionId, patternId) { return this._req(`review_items?review_session_id=eq.${sessionId}&pattern_id=eq.${encodeURIComponent(patternId)}`, { method: "DELETE" }); }
  async listReviewItems(sessionId) { return (await this._req(`review_items?review_session_id=eq.${sessionId}`)) || []; }

  // 签约
  async createAgreement(a) { const x = await this._req(`agreements`, { method: "POST", body: a, prefer: "return=representation" }); return Array.isArray(x) ? x[0] : x; }
  getAgreement(id) { return this._one(`agreements?id=eq.${id}&limit=1`); }
  getAgreementByOrder(orderId) { return this._one(`agreements?order_id=eq.${orderId}&order=version.desc&limit=1`); }
  async updateAgreement(id, patch) { return this._req(`agreements?id=eq.${id}`, { method: "PATCH", body: patch }); }

  // 订单明细 / 订单
  async createOrder(o) { const x = await this._req(`orders`, { method: "POST", body: o, prefer: "return=representation" }); return Array.isArray(x) ? x[0] : x; }
  async createOrderItem(it) { const x = await this._req(`order_items`, { method: "POST", body: it, prefer: "return=representation" }); return Array.isArray(x) ? x[0] : x; }
  async listOrderItems(orderId) { return (await this._req(`order_items?order_id=eq.${orderId}`)) || []; }
  async createDeliveryFile(f) { const x = await this._req(`delivery_files`, { method: "POST", body: f, prefer: "return=representation" }); return Array.isArray(x) ? x[0] : x; }
}
