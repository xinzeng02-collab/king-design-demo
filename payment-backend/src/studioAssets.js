const STAFF_ROLES = new Set(["admin", "boss", "finance", "sales", "designer", "painter"]);
const MAX_ASSET_BYTES = 100 * 1024 * 1024;

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function requireStaff(actor) {
  if (!actor?.userId) throw fail("UNAUTHENTICATED", 401);
  if (!actor.organizationId || !STAFF_ROLES.has(actor.role)) throw fail("FORBIDDEN_STAFF_ONLY", 403);
}

function assetKey(actor, key) {
  const clean = String(key || "").trim();
  if (!clean || clean.length > 240 || clean.includes("..") || /[\\/]/.test(clean)) throw fail("INVALID_ASSET_KEY");
  return `studio/${actor.organizationId}/${clean}`;
}

function bucket(env) {
  if (env.PREVIEWS) return env.PREVIEWS;
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) return supabaseStorageBucket(env);
  throw fail("STUDIO_ASSET_STORAGE_NOT_CONFIGURED", 503);
}

function supabaseStorageBucket(env) {
  const base = `${String(env.SUPABASE_URL).replace(/\/$/, "")}/storage/v1/object/studio-assets`;
  const headers = (extra = {}) => ({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  });
  const request = async (path, options) => {
    const response = await fetch(`${base}/${path}`, options);
    if (!response.ok) throw fail(`SUPABASE_STORAGE_${response.status}`, response.status === 404 ? 404 : 502);
    return response;
  };
  return {
    async put(key, body, options = {}) {
      await request(encodeURI(key), {
        method: "POST",
        headers: headers({
          "content-type": options.httpMetadata?.contentType || "application/octet-stream",
          "x-upsert": "true",
        }),
        body,
      });
    },
    async get(key) {
      const response = await fetch(`${base.replace("/object/studio-assets", "/object/authenticated/studio-assets")}/${encodeURI(key)}`, { headers: headers() });
      if (response.status === 404) return null;
      if (!response.ok) throw fail(`SUPABASE_STORAGE_${response.status}`, 502);
      return { body: response.body, httpMetadata: { contentType: response.headers.get("content-type") || "application/octet-stream" } };
    },
    async delete(key) {
      const response = await fetch(`${base}/${encodeURI(key)}`, { method: "DELETE", headers: headers() });
      if (!response.ok && response.status !== 404) throw fail(`SUPABASE_STORAGE_${response.status}`, 502);
    },
  };
}

export async function putStudioAsset(env, actor, key, request) {
  requireStaff(actor);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_ASSET_BYTES) throw fail("ASSET_TOO_LARGE", 413);
  const body = await request.arrayBuffer();
  if (!body.byteLength) throw fail("EMPTY_ASSET");
  if (body.byteLength > MAX_ASSET_BYTES) throw fail("ASSET_TOO_LARGE", 413);
  await bucket(env).put(assetKey(actor, key), body, {
    httpMetadata: { contentType: request.headers.get("content-type") || "application/octet-stream" },
    customMetadata: { uploadedBy: actor.userId },
  });
  return { ok: true, key };
}

export async function createStudioAssetUploadUrl(env, actor, key) {
  requireStaff(actor);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw fail("STUDIO_ASSET_STORAGE_NOT_CONFIGURED", 503);
  const objectKey = assetKey(actor, key);
  const base = String(env.SUPABASE_URL).replace(/\/$/, "");
  const response = await fetch(`${base}/storage/v1/object/upload/sign/studio-assets/${encodeURIComponent(objectKey)}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      "x-upsert": "true",
    },
    body: "{}",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.url) throw fail(`SUPABASE_SIGN_UPLOAD_${response.status}`, 502);
  return {
    key,
    signedUrl: result.url.startsWith("http") ? result.url : `${base}/storage/v1${result.url}`,
  };
}

export async function getStudioAsset(env, actor, key) {
  requireStaff(actor);
  const object = await bucket(env).get(assetKey(actor, key));
  if (!object) throw fail("ASSET_NOT_FOUND", 404);
  return object;
}

export async function deleteStudioAsset(env, actor, key) {
  requireStaff(actor);
  await bucket(env).delete(assetKey(actor, key));
  return { ok: true, key };
}
