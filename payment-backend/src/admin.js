const ADMIN_ROLES = new Set(["admin", "boss"]);
const STAFF_ROLES = new Set(["admin", "boss", "finance", "sales", "designer", "painter"]);

export const STUDIO_STATE_MODULES = new Set([
  "createdWorks", "overrides", "removedFiles", "globalTags", "pendingTags",
  "dismissedNotifications", "activityNotifications", "orders", "projects",
  "customers", "projectBoardOverrides", "teamMembers", "resourceFolders",
  "resources", "tagCategories", "tagCategoryLabels",
  "personalWorkArchives", "sharedWorkspaceLocalData",
]);

const ROLE_WRITABLE_MODULES = {
  sales: new Set(["orders", "customers", "activityNotifications", "dismissedNotifications", "sharedWorkspaceLocalData"]),
  designer: new Set(["createdWorks", "overrides", "removedFiles", "projects", "projectBoardOverrides", "activityNotifications", "dismissedNotifications", "personalWorkArchives", "sharedWorkspaceLocalData"]),
  painter: new Set(["createdWorks", "overrides", "removedFiles", "projects", "projectBoardOverrides", "activityNotifications", "dismissedNotifications", "personalWorkArchives", "sharedWorkspaceLocalData"]),
  finance: new Set(["orders", "activityNotifications", "dismissedNotifications", "sharedWorkspaceLocalData"]),
};

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function requireOrganization(actor) {
  if (!actor?.userId) throw fail("UNAUTHENTICATED", 401);
  if (!actor.organizationId) throw fail("ORGANIZATION_REQUIRED", 403);
}

function requireStaff(actor) {
  requireOrganization(actor);
  if (!STAFF_ROLES.has(actor.role)) throw fail("FORBIDDEN_STAFF_ONLY", 403);
}

function requireAdmin(actor) {
  requireOrganization(actor);
  if (!ADMIN_ROLES.has(actor.role)) throw fail("FORBIDDEN_ADMIN_ONLY", 403);
}

function requireModuleWrite(actor, module) {
  requireStaff(actor);
  if (ADMIN_ROLES.has(actor.role)) return;
  if (!ROLE_WRITABLE_MODULES[actor.role]?.has(module)) throw fail("FORBIDDEN_MODULE_WRITE", 403);
}

function validateRevision(revision) {
  if (!Number.isInteger(revision) || revision < 0) throw fail("INVALID_REVISION");
}

function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw fail("INVALID_STATE");
  const unknown = Object.keys(state).filter((key) => !STUDIO_STATE_MODULES.has(key));
  if (unknown.length) throw fail("UNKNOWN_STATE_MODULE");
  if (JSON.stringify(state).length > 4_000_000) throw fail("STATE_TOO_LARGE", 413);
  return state;
}

export async function getStudioState(repo, actor) {
  requireStaff(actor);
  const record = await repo.getStudioState(actor.organizationId);
  return {
    state: record?.state || {},
    revision: Number(record?.revision || 0),
    updatedAt: record?.updated_at || null,
  };
}

export async function getStudioStateMeta(repo, actor) {
  requireStaff(actor);
  const record = repo.getStudioStateMeta
    ? await repo.getStudioStateMeta(actor.organizationId)
    : await repo.getStudioState(actor.organizationId);
  return {
    revision: Number(record?.revision || 0),
    updatedAt: record?.updated_at || null,
  };
}

export async function replaceStudioState(repo, { state, revision }, actor) {
  requireAdmin(actor);
  validateRevision(revision);
  validateState(state);
  const record = await repo.replaceStudioState(actor.organizationId, state, revision, actor.userId);
  if (!record) throw fail("REVISION_CONFLICT", 409);
  await repo.insertAudit({
    actor_id: actor.userId, actor_role: actor.role, action: "studio_state_replace",
    target_type: "studio_state", target_id: actor.organizationId,
    after: { revision: record.revision, modules: Object.keys(state) },
  });
  return { state: record.state, revision: record.revision, updatedAt: record.updated_at };
}

export async function updateStudioModule(repo, { module, value, revision }, actor) {
  requireModuleWrite(actor, module);
  validateRevision(revision);
  if (!STUDIO_STATE_MODULES.has(module)) throw fail("UNKNOWN_STATE_MODULE");
  validateState({ [module]: value });
  const record = await repo.updateStudioModule(actor.organizationId, module, value, revision, actor.userId);
  if (!record) throw fail("REVISION_CONFLICT", 409);
  await repo.insertAudit({
    actor_id: actor.userId, actor_role: actor.role, action: "studio_module_update",
    target_type: "studio_state", target_id: actor.organizationId,
    after: { revision: record.revision, module },
  });
  return { state: record.state, revision: record.revision, updatedAt: record.updated_at };
}
