import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import * as authApi from "../src/authApi.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  AUTH_EMAIL_DOMAIN: "king-design.local",
  ENABLED_EMPLOYEE_ROLES: "admin,boss",
};

test("管理员账号通过 Supabase Auth 登录并返回数据库角色", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { email: "kingadmin@king-design.local", password: "secret" });
    return new Response(JSON.stringify({
      access_token: "access", refresh_token: "refresh", expires_in: 3600,
      user: { id: "u1", user_metadata: { display_name: "管理员" } },
    }), { status: 200 });
  };
  const repo = { getMembership: async () => ({ role: "admin", organization_id: "org1" }) };
  const result = await authApi.login(repo, env, { username: "kingadmin", password: "secret" });
  assert.equal(result.account.role, "管理员");
  assert.equal(result.account.organizationId, "org1");
  assert.equal(result.accessToken, "access");
});

test("发布版拒绝未开放的设计师角色", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    access_token: "access", refresh_token: "refresh", expires_in: 3600, user: { id: "u2" },
  }), { status: 200 });
  const repo = { getMembership: async () => ({ role: "designer", organization_id: "org1" }) };
  await assert.rejects(authApi.login(repo, env, { username: "designer", password: "secret" }), /ROLE_NOT_ENABLED/);
});

test("错误密码不会降级为前端演示认证", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
  const repo = { getMembership: async () => null };
  await assert.rejects(authApi.login(repo, env, { username: "kingadmin", password: "wrong" }), /INVALID_CREDENTIALS/);
});
