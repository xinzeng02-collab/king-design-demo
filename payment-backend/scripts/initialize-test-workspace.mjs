const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);

const base = process.env.SUPABASE_URL.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const emailDomain = process.env.AUTH_EMAIL_DOMAIN || "king-design.local";
const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  "content-type": "application/json",
};

const accounts = [
  { username: "admin", password: process.env.ADMIN_PASSWORD || "admin123", role: "admin", displayName: "管理员", appRole: "管理员" },
  { username: "designer", password: process.env.DESIGNER_PASSWORD || "designer123", role: "designer", displayName: "设计师", appRole: "设计师" },
  { username: "painter", password: process.env.PAINTER_PASSWORD || "painter123", role: "painter", displayName: "手绘师", appRole: "手绘师" },
  { username: "sales", password: process.env.SALES_PASSWORD || "sales123", role: "sales", displayName: "销售", appRole: "销售" },
];

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function ensureOrganization() {
  const organizations = await request(`/rest/v1/organizations?name=eq.${encodeURIComponent("KiNG DESiGN")}&select=id&limit=1`);
  if (organizations[0]?.id) return organizations[0].id;
  const created = await request("/rest/v1/organizations", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ name: "KiNG DESiGN" }),
  });
  return created[0].id;
}

async function ensureUser(account, existingUsers) {
  const email = `${account.username}@${emailDomain}`;
  const existing = existingUsers.find((user) => user.email === email);
  const body = {
    email,
    password: account.password,
    email_confirm: true,
    user_metadata: { display_name: account.displayName },
  };
  if (existing) {
    await request(`/auth/v1/admin/users/${existing.id}`, { method: "PUT", body: JSON.stringify(body) });
    return existing.id;
  }
  const created = await request("/auth/v1/admin/users", { method: "POST", body: JSON.stringify(body) });
  return created.id;
}

const organizationId = await ensureOrganization();
const userList = await request("/auth/v1/admin/users?per_page=1000");
const existingUsers = userList.users || [];
const teamMembers = [];

for (const account of accounts) {
  const userId = await ensureUser(account, existingUsers);
  await request("/rest/v1/memberships?on_conflict=user_id,organization_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: userId, organization_id: organizationId, role: account.role }),
  });
  teamMembers.push({
    name: account.displayName,
    role: account.appRole,
    ownerKey: account.username,
    accountStatus: "正常",
  });
}

const initialState = {
  createdWorks: [], overrides: {}, removedFiles: [], globalTags: [], pendingTags: [],
  dismissedNotifications: [], activityNotifications: [], orders: [], projects: [],
  customers: [], projectBoardOverrides: {}, teamMembers, resourceFolders: [], resources: [],
  personalWorkArchives: {}, tagCategories: {}, tagCategoryLabels: {},
};

await request("/rest/v1/studio_states?on_conflict=organization_id", {
  method: "POST",
  headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
  body: JSON.stringify({ organization_id: organizationId, state: initialState, revision: 0 }),
});

console.log(JSON.stringify({
  organizationId,
  accounts: accounts.map(({ username, password, appRole }) => ({ username, password, role: appRole })),
}, null, 2));
