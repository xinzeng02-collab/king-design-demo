const EMPLOYEE_ROLE_LABELS = {
  admin: "管理员",
  boss: "管理员",
  finance: "财务",
  sales: "销售",
  designer: "设计师",
  painter: "手绘师",
};

const DEFAULT_EMPLOYEE_ROLES = ["admin", "boss", "finance", "sales", "designer", "painter"];
const EMPLOYEE_ROLE_KEYS = new Map([
  ["管理员", "admin"],
  ["老板", "boss"],
  ["财务", "finance"],
  ["销售", "sales"],
  ["设计师", "designer"],
  ["手绘师", "painter"],
]);

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

async function supabaseRequest(env, path, options = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw fail("AUTH_NOT_CONFIGURED", 503);
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw fail(response.status === 400 ? "INVALID_CREDENTIALS" : "AUTH_PROVIDER_ERROR", response.status === 400 ? 401 : 502);
  return data;
}

async function supabaseAdminRequest(env, path, options = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw fail("AUTH_NOT_CONFIGURED", 503);
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw fail(response.status === 409 ? "ACCOUNT_ALREADY_EXISTS" : "AUTH_PROVIDER_ERROR", response.status === 409 ? 409 : 502);
  return data;
}

export async function login(repo, env, { username, password }) {
  const loginName = String(username || "").trim();
  if (!loginName || !password) throw fail("USERNAME_AND_PASSWORD_REQUIRED");
  const email = loginName.includes("@") ? loginName : `${loginName}@${env.AUTH_EMAIL_DOMAIN || "king-design.local"}`;
  const session = await supabaseRequest(env, "/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const membership = await repo.getMembership(session.user?.id);
  const enabled = String(env.ENABLED_EMPLOYEE_ROLES || DEFAULT_EMPLOYEE_ROLES.join(","))
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
  if (!membership || !enabled.includes(membership.role)) throw fail("ROLE_NOT_ENABLED", 403);
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    account: {
      id: session.user.id,
      username: loginName,
      role: EMPLOYEE_ROLE_LABELS[membership.role] || membership.role,
      backendRole: membership.role,
      name: session.user.user_metadata?.display_name || loginName,
      ownerKey: loginName,
      organizationId: membership.organization_id,
    },
  };
}

export async function refresh(env, { refreshToken }) {
  if (!refreshToken) throw fail("REFRESH_TOKEN_REQUIRED", 401);
  const session = await supabaseRequest(env, "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return { accessToken: session.access_token, refreshToken: session.refresh_token, expiresIn: session.expires_in };
}

export async function provisionEmployee(repo, env, actor, { username, password, role, name }) {
  if (!actor?.userId || !["admin", "boss"].includes(actor.role)) throw fail("FORBIDDEN_ADMIN_ONLY", 403);
  const loginName = String(username || "").trim().toLowerCase();
  const backendRole = EMPLOYEE_ROLE_KEYS.get(String(role || "").trim()) || String(role || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(loginName)) throw fail("INVALID_USERNAME");
  if (!DEFAULT_EMPLOYEE_ROLES.includes(backendRole) || backendRole === "customer") throw fail("INVALID_EMPLOYEE_ROLE");
  const cleanPassword = password == null ? "" : String(password);
  if (cleanPassword && cleanPassword.length < 8) throw fail("PASSWORD_TOO_SHORT");
  if (!actor.organizationId) throw fail("ORGANIZATION_NOT_FOUND", 404);
  const email = `${loginName}@${env.AUTH_EMAIL_DOMAIN || "king-design.local"}`;
  const users = await supabaseAdminRequest(env, "/auth/v1/admin/users?per_page=1000");
  const existing = (users.users || []).find((user) => String(user.email || "").toLowerCase() === email);
  const userBody = {
    email,
    email_confirm: true,
    user_metadata: { display_name: String(name || loginName).trim() || loginName },
  };
  if (cleanPassword) userBody.password = cleanPassword;
  const user = existing
    ? await supabaseAdminRequest(env, `/auth/v1/admin/users/${encodeURIComponent(existing.id)}`, { method: "PUT", body: JSON.stringify(userBody) })
    : await supabaseAdminRequest(env, "/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ ...userBody, password: cleanPassword }) });
  const membershipResponse = await supabaseAdminRequest(env, "/rest/v1/memberships?on_conflict=user_id,organization_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: user.id, organization_id: actor.organizationId, role: backendRole }),
  });
  return { ok: true, created: !existing, userId: user.id, role: backendRole, membership: membershipResponse };
}

export async function deprovisionEmployee(repo, env, actor, { username }) {
  if (!actor?.userId || !["admin", "boss"].includes(actor.role)) throw fail("FORBIDDEN_ADMIN_ONLY", 403);
  if (!actor.organizationId) throw fail("ORGANIZATION_NOT_FOUND", 404);
  const loginName = String(username || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(loginName)) throw fail("INVALID_USERNAME");
  const email = `${loginName}@${env.AUTH_EMAIL_DOMAIN || "king-design.local"}`;
  const users = await supabaseAdminRequest(env, "/auth/v1/admin/users?per_page=1000");
  const existing = (users.users || []).find((user) => String(user.email || "").toLowerCase() === email);
  if (!existing) return { ok: true, removed: false };
  if (existing.id === actor.userId) throw fail("CANNOT_REMOVE_SELF", 409);

  const userId = encodeURIComponent(existing.id);
  const organizationId = encodeURIComponent(actor.organizationId);
  await supabaseAdminRequest(env, `/rest/v1/memberships?user_id=eq.${userId}&organization_id=eq.${organizationId}`, {
    method: "DELETE",
    headers: { prefer: "return=minimal" },
  });
  await supabaseAdminRequest(env, `/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  return { ok: true, removed: true, userId: existing.id };
}
