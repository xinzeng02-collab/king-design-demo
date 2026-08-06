import { test } from "node:test";
import assert from "node:assert/strict";
import * as admin from "../src/admin.js";

class AdminRepo {
  constructor() { this.record = null; this.audits = []; }
  getStudioState(org) { return this.record?.organization_id === org ? this.record : null; }
  getStudioStateMeta(org) {
    const record = this.getStudioState(org);
    return record ? { revision: record.revision, updated_at: record.updated_at } : null;
  }
  replaceStudioState(org, state, expected, user) {
    const current = this.record?.revision || 0;
    if (current !== expected) return null;
    this.record = { organization_id: org, state, revision: current + 1, updated_by: user, updated_at: "now" };
    return this.record;
  }
  updateStudioModule(org, module, value, expected, user) {
    if ((this.record?.revision || 0) !== expected) return null;
    return this.replaceStudioState(org, { ...(this.record?.state || {}), [module]: value }, expected, user);
  }
  insertAudit(entry) { this.audits.push(entry); }
}

const ADMIN = { userId: "u1", role: "admin", organizationId: "org1" };
const SALES = { userId: "u2", role: "sales", organizationId: "org1" };
const CUSTOMER = { userId: "u3", role: "customer", organizationId: "org1" };

test("管理员可初始化工作台并读取", async () => {
  const repo = new AdminRepo();
  const saved = await admin.replaceStudioState(repo, {
    state: {
      projects: [{ id: "p1" }],
      resourceFolders: [{ id: "folder-1", name: "面料参考" }],
      resources: [{ id: "resource-1", folderId: "folder-1", key: "team_resource_1" }],
    },
    revision: 0,
  }, ADMIN);
  assert.equal(saved.revision, 1);
  const sharedState = (await admin.getStudioState(repo, SALES)).state;
  assert.deepEqual(sharedState.projects, [{ id: "p1" }]);
  assert.deepEqual(sharedState.resourceFolders, [{ id: "folder-1", name: "面料参考" }]);
  assert.deepEqual(sharedState.resources, [{ id: "resource-1", folderId: "folder-1", key: "team_resource_1" }]);
  assert.deepEqual(await admin.getStudioStateMeta(repo, SALES), { revision: 1, updatedAt: "now" });
  assert.equal(repo.audits[0].action, "studio_state_replace");
});

test("分模块更新不覆盖其他模块", async () => {
  const repo = new AdminRepo();
  await admin.replaceStudioState(repo, { state: { projects: [1], customers: [2] }, revision: 0 }, ADMIN);
  const saved = await admin.updateStudioModule(repo, { module: "projects", value: [3], revision: 1 }, ADMIN);
  assert.deepEqual(saved.state, { projects: [3], customers: [2] });
  assert.equal(saved.revision, 2);
});

test("旧 revision 写入被拒绝", async () => {
  const repo = new AdminRepo();
  await admin.replaceStudioState(repo, { state: { orders: [] }, revision: 0 }, ADMIN);
  await assert.rejects(
    admin.updateStudioModule(repo, { module: "orders", value: [1], revision: 0 }, ADMIN),
    /REVISION_CONFLICT/,
  );
});

test("销售只能写客户、订单等授权模块，客户不能读", async () => {
  const repo = new AdminRepo();
  await assert.rejects(admin.replaceStudioState(repo, { state: {}, revision: 0 }, SALES), /FORBIDDEN_ADMIN_ONLY/);
  await admin.replaceStudioState(repo, { state: { customers: [], teamMembers: [] }, revision: 0 }, ADMIN);
  const saved = await admin.updateStudioModule(repo, { module: "customers", value: [{ id: "c1" }], revision: 1 }, SALES);
  assert.deepEqual(saved.state.customers, [{ id: "c1" }]);
  await assert.rejects(
    admin.updateStudioModule(repo, { module: "teamMembers", value: [], revision: 2 }, SALES),
    /FORBIDDEN_MODULE_WRITE/,
  );
  await assert.rejects(admin.getStudioState(repo, CUSTOMER), /FORBIDDEN_STAFF_ONLY/);
});

test("拒绝未知模块和非法 revision", async () => {
  const repo = new AdminRepo();
  await assert.rejects(admin.replaceStudioState(repo, { state: { password: "x" }, revision: 0 }, ADMIN), /UNKNOWN_STATE_MODULE/);
  await assert.rejects(admin.replaceStudioState(repo, { state: {}, revision: -1 }, ADMIN), /INVALID_REVISION/);
});
