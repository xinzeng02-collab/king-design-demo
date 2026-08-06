import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casesDir = path.join(siteDir, "assets", "king-cases");
const sitePath = (relative) => path.resolve(siteDir, relative.replace(/^\.\//, ""));

test("每张原图都有缩略图和预览图，且清单只引用 WebP 衍生图", async () => {
  const manifest = JSON.parse(await readFile(path.join(casesDir, "manifest.json"), "utf8"));
  const patterns = manifest.projects.flatMap((project) => project.patterns || []);
  let imageCount = 0;
  for (const pattern of patterns) {
    assert.equal(pattern.images.length, pattern.thumbs.length);
    assert.equal(pattern.images.length, pattern.previews.length);
    imageCount += pattern.images.length;
    for (const relative of [...pattern.thumbs, ...pattern.previews]) {
      assert.match(relative, /\.webp$/i);
      await stat(sitePath(relative));
    }
  }
  assert.equal(imageCount, 373);
});

test("缩略图、预览图和品牌资源不超过性能预算", async () => {
  const report = JSON.parse(await readFile(path.join(casesDir, "image-variants-report.json"), "utf8"));
  assert.ok(report.cases.thumbBytes < 15 * 1024 * 1024);
  assert.ok(report.cases.previewBytes < 90 * 1024 * 1024);
  for (const asset of report.brandAssets) {
    assert.ok(asset.after < 400 * 1024, `${asset.output} 超过 400KB`);
  }

  const manifest = JSON.parse(await readFile(path.join(casesDir, "manifest.json"), "utf8"));
  const derivatives = manifest.projects.flatMap((project) =>
    (project.patterns || []).flatMap((pattern) => [...pattern.thumbs, ...pattern.previews])
  );
  let maxThumb = 0;
  let maxPreview = 0;
  for (const relative of derivatives) {
    const size = (await stat(sitePath(relative))).size;
    if (relative.includes("/_thumbs/")) maxThumb = Math.max(maxThumb, size);
    if (relative.includes("/_previews/")) maxPreview = Math.max(maxPreview, size);
  }
  assert.ok(maxThumb < 150 * 1024, `最大缩略图 ${maxThumb}B 超过 150KB`);
  assert.ok(maxPreview < 900 * 1024, `最大预览图 ${maxPreview}B 超过 900KB`);
});

test("运行时包含长任务、图片错误和对象 URL 回收监测", async () => {
  const runtime = await readFile(path.join(siteDir, "performance-runtime.js"), "utf8");
  assert.match(runtime, /PerformanceObserver/);
  assert.match(runtime, /longtask/);
  assert.match(runtime, /imageErrors/);
  assert.match(runtime, /releaseAll/);
});

test("客户花型库翻页不重复筛库或重绘完整选稿车", async () => {
  const script = await readFile(path.join(siteDir, "script.js"), "utf8");
  const galleryRenderer = script.match(/function renderVlibGallery\(reset = false\) \{[\s\S]*?\n\}/)?.[0] || "";
  const viewerBindings = script.match(/\(function bindViewerLibrary\(\) \{[\s\S]*?\n\}\)\(\);/)?.[0] || "";

  assert.match(galleryRenderer, /if \(reset \|\| !vlibVisibleCards\.length\)/);
  assert.doesNotMatch(galleryRenderer, /renderSignature|observeGalleryAutoLoad/);
  assert.doesNotMatch(viewerBindings, /renderLibraryCart\(\)/);
  assert.match(viewerBindings, /syncVlibSelectionSummary\(\)/);
});

test("客户看稿入口复用 Silk 动画并隐藏已匹配联系人建议", async () => {
  const script = await readFile(path.join(siteDir, "script.js"), "utf8");
  const silkInitializer = script.match(/function initViewerSilk\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const nameSuggestions = script.match(/function renderViewerNameSuggest\(\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(silkInitializer, /if \(resumeViewerSilk\)/);
  assert.match(silkInitializer, /resumeViewerSilk = \(\) =>/);
  assert.match(nameSuggestions, /contacts\.find\(\(contact\) => searchMatches\(q, \[contact\]\)\)/);
  assert.match(nameSuggestions, /box\.classList\.add\("hidden"\)/);
});
