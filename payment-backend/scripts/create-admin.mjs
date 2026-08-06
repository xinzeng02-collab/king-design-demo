const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);

const base = process.env.SUPABASE_URL.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = process.env.ADMIN_USERNAME || "kingadmin";
const email = `${username}@${process.env.AUTH_EMAIL_DOMAIN || "king-design.local"}`;
const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

const user = await request("/auth/v1/admin/users", {
  method: "POST",
  body: JSON.stringify({ email, password: process.env.ADMIN_PASSWORD, email_confirm: true, user_metadata: { display_name: "管理员" } }),
});
const organizations = await request("/rest/v1/organizations?select=id&limit=1");
let organizationId = organizations[0]?.id;
if (!organizationId) {
  const created = await request("/rest/v1/organizations", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ name: "KiNG DESiGN" }),
  });
  organizationId = created[0].id;
}
await request("/rest/v1/memberships", {
  method: "POST",
  headers: { prefer: "resolution=merge-duplicates" },
  body: JSON.stringify({ user_id: user.id, organization_id: organizationId, role: "admin" }),
});
console.log(`Administrator created: ${username}`);
