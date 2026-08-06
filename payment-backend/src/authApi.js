const EMPLOYEE_ROLE_LABELS = {
  admin: "管理员",
  boss: "管理员",
  finance: "财务",
  sales: "销售",
  designer: "设计师",
  painter: "手绘师",
};

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

export async function login(repo, env, { username, password }) {
  const loginName = String(username || "").trim();
  if (!loginName || !password) throw fail("USERNAME_AND_PASSWORD_REQUIRED");
  const email = loginName.includes("@") ? loginName : `${loginName}@${env.AUTH_EMAIL_DOMAIN || "king-design.local"}`;
  const session = await supabaseRequest(env, "/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const membership = await repo.getMembership(session.user?.id);
  const enabled = String(env.ENABLED_EMPLOYEE_ROLES || "admin,boss").split(",").map((role) => role.trim());
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
