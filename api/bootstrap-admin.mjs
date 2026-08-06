const bootstrapSecret = "kd-bootstrap-20260806";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function handle(request) {
  if (request.method !== "POST" || request.headers.get("x-bootstrap-secret") !== bootstrapSecret) {
    return json({ error: "NOT_FOUND" }, 404);
  }
  const env = process.env;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "SUPABASE_NOT_CONFIGURED" }, 503);
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
  const call = async (path, options = {}) => {
    const response = await fetch(`${base}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`${path} ${response.status} ${JSON.stringify(data)}`);
    return data;
  };
  try {
    const email = "admin@king-design.local";
    let users = await call(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
    let user = users?.users?.[0] || users?.[0];
    if (!user) {
      user = await call("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password: "admin123", email_confirm: true, user_metadata: { display_name: "管理员" } }),
      });
    } else {
      user = await call(`/auth/v1/admin/users/${user.id}`, { method: "PUT", body: JSON.stringify({ password: "admin123", email_confirm: true }) });
    }
    const orgs = await call("/rest/v1/organizations?select=id&limit=1");
    let organizationId = orgs?.[0]?.id;
    if (!organizationId) {
      const created = await call("/rest/v1/organizations", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ name: "KiNG DESiGN" }) });
      organizationId = created[0].id;
    }
    await call("/rest/v1/memberships", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: user.id, organization_id: organizationId, role: "admin" }) });
    return json({ ok: true, username: "admin", organizationId });
  } catch (error) {
    return json({ error: "BOOTSTRAP_FAILED", detail: String(error.message || error) }, 500);
  }
}

export default async function handler(req, res) {
  if (!res) return handle(req);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`https://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body });
  const response = await handle(request);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.statusCode = response.status;
  res.end(Buffer.from(await response.arrayBuffer()));
}
