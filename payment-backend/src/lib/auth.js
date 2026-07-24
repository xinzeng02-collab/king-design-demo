// 真实鉴权框架：校验 Supabase 签发的用户 JWT(HS256)，取出 user_id 与角色。
// 在 Cloudflare Workers 用 Web Crypto 实现，无外部依赖。
// 关键：所有「权威操作」都必须先经过这里拿到可信身份，前端传的角色/状态一律不采信。

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 校验 HS256 JWT，返回 payload；失败返回 null。 */
export async function verifyJwt(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`)
  );
  if (!valid) return null;
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))); } catch { return null; }
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;  // 过期
  return payload;
}

/**
 * 从请求解析可信身份。
 * @returns {Promise<{userId:string, email?:string}|null>}
 */
export async function authenticate(request, env) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const payload = await verifyJwt(token, env.SUPABASE_JWT_SECRET);
  if (!payload) return null;
  return { userId: payload.sub, email: payload.email, raw: payload };
}

/**
 * 取用户在组织内的角色（需查 memberships 表）。这里给出接口，具体查询由 db 层实现。
 * 角色一律以数据库为准，不信前端。
 */
export function hasFinancePower(role) {
  return role === "finance" || role === "admin" || role === "boss";
}
export function canConfirmManualPayment(role) {
  // 只有财务/管理员/老板能确认到账；销售/设计师/手绘/客户不能
  return hasFinancePower(role);
}
