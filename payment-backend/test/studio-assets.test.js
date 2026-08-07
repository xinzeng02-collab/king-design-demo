import test from "node:test";
import assert from "node:assert/strict";
import * as assets from "../src/studioAssets.js";

class Bucket {
  constructor() { this.items = new Map(); }
  async put(key, body, options) { this.items.set(key, { body: new Blob([body]).stream(), httpMetadata: options.httpMetadata }); }
  async get(key) { return this.items.get(key) || null; }
  async delete(key) { this.items.delete(key); }
}

const actor = { userId: "u1", role: "designer", organizationId: "org-a" };
const env = { PREVIEWS: new Bucket() };

test("工作室文件按组织隔离并保留 MIME 类型", async () => {
  const request = new Request("https://api.example/assets", { method: "PUT", headers: { "content-type": "image/webp" }, body: new Blob(["image"]) });
  await assets.putStudioAsset(env, actor, "work_1__original", request);
  const saved = await assets.getStudioAsset(env, actor, "work_1__original");
  assert.equal(saved.httpMetadata.contentType, "image/webp");
  assert.ok(env.PREVIEWS.items.has("studio/org-a/work_1__original"));
  await assert.rejects(
    assets.getStudioAsset(env, { ...actor, organizationId: "org-b" }, "work_1__original"),
    /ASSET_NOT_FOUND/,
  );
});

test("工作室文件拒绝非员工、非法键和超限内容", async () => {
  await assert.rejects(
    assets.getStudioAsset(env, { userId: "customer", role: "customer", organizationId: "org-a" }, "work_1"),
    /FORBIDDEN_STAFF_ONLY/,
  );
  await assert.rejects(
    assets.getStudioAsset(env, actor, "../outside"),
    /INVALID_ASSET_KEY/,
  );
  const request = new Request("https://api.example/assets", { method: "PUT", headers: { "content-length": String(101 * 1024 * 1024) }, body: "x" });
  await assert.rejects(assets.putStudioAsset(env, actor, "too_large", request), /ASSET_TOO_LARGE/);
});

test("签名上传会把中文逻辑键映射为 Supabase 可接受的 ASCII 对象键", async () => {
  const originalFetch = globalThis.fetch;
  let signedObjectKey = "";
  globalThis.fetch = async (url) => {
    signedObjectKey = decodeURIComponent(String(url).split("/studio-assets/")[1] || "");
    return new Response(JSON.stringify({
      url: `/object/upload/sign/studio-assets/${signedObjectKey}?token=signed-token`,
    }), { status: 200 });
  };
  try {
    const result = await assets.createStudioAssetUploadUrl({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    }, actor, "手绘稿 0807__original");
    assert.match(signedObjectKey, /^studio\/org-a\/[A-Za-z0-9._-]+$/);
    assert.doesNotMatch(signedObjectKey, /手绘稿/);
    assert.match(result.signedUrl, /\/studio\/org-a\/[A-Za-z0-9._-]+\?token=signed-token$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Supabase 永久删除使用 Storage 批量前缀协议", async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(null, { status: 200 });
  };
  try {
    await assets.deleteStudioAsset({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    }, actor, "work_1__original");
    assert.equal(captured.url, "https://example.supabase.co/storage/v1/object/studio-assets");
    assert.equal(captured.options.method, "DELETE");
    assert.equal(captured.options.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(captured.options.body), {
      prefixes: ["studio/org-a/work_1__original"],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
