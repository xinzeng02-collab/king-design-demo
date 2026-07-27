import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(siteDir, file), "utf8");

test("页面不存在重复 id，侧栏入口都有对应视图", async () => {
  const html = await read("index.html");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicateIds)], []);

  const views = new Set([...html.matchAll(/<section[^>]+\bid="([^"]+)"/g)].map((match) => match[1]));
  const targets = [...html.matchAll(/\bdata-view="([^"]+)"/g)].map((match) => match[1]);
  const missing = [...new Set(targets)].filter((target) => !views.has(target));
  assert.deepEqual(missing, []);
});

test("已删除的灵感画布、打样页不再残留", async () => {
  const sources = await Promise.all(["index.html", "script.js", "styles.css"].map(read));
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /brainstorm|灵感画布|data-view="sampling"|id="sampling"|sample-grid|sample-card/i);
});

test("员工与客户核心流程入口仍然存在", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  [
    "loginForm",
    "clientLoginForm",
    "orders",
    "library",
    "myLibrary",
    "resources",
    "uploadModal",
  ].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  [
    "renderOrderCenter",
    "renderLibraryGrid",
    "renderMyPatternLibrary",
    "openCustomerPatternViewer",
    "renderDailyReviewBoard",
  ].forEach((fn) => assert.match(script, new RegExp(`function ${fn}\\b`)));
});

test("上传使用 Blob 存储，并保留源文件缺失提示", async () => {
  const script = await read("script.js");
  assert.match(script, /KingBlobStore/);
  assert.match(script, /persistArtworkImageTiers\(fileId, firstFile\)/);
  assert.match(script, /saveImageToDB\(originalKey, file\)/);
  assert.match(script, /await saveImageToDB\(sourceKey, sourceFile\)/);
  assert.match(script, /未上传源文件/);
  assert.doesNotMatch(script, /saveImageToDB\([^,\n]+,\s*await readFileAsDataURL/);
});

test("列表采用分批渲染，并在需要时才解析图片", async () => {
  const script = await read("script.js");
  [
    "WORK_RENDER_BATCH",
    "REVIEW_RENDER_BATCH",
    "LIBRARY_GRID_BATCH",
    "MY_LIBRARY_BATCH",
    "hydrateLazyKeyImages",
    "prepareWorkCardPreview",
  ].forEach((token) => assert.match(script, new RegExp(`\\b${token}\\b`)));
  assert.match(script, /galleryAutoLoadObserver/);
  assert.match(script, /observeGalleryAutoLoad/);
  assert.doesNotMatch(script, /继续加载（剩余/);
});

test("历史 JPG 衍生图地址会迁移到 WebP，避免客户旧订单图片失效", async () => {
  const script = await read("script.js");
  const html = await read("index.html");
  assert.match(script, /function normalizeLegacyDerivativePath/);
  assert.ok(script.includes("thumbs|previews"));
  assert.ok(script.includes('".webp"'));
  assert.match(script, /normalizeStoredWorkImageReferences/);
  assert.match(script, /migratedLegacyImageReferences/);
  assert.match(html, /script\.js\?v=20260727-project-flow-v33/);
});

test("订单详情会解析延迟图片，登录视觉不显示工作室副标题", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  assert.doesNotMatch(html, /PATTERN DESIGN STUDIO/);
  assert.match(script, /function orderDetailImageMarkup/);
  assert.match(script, /hydrateLazyKeyImages\(body\)/);
});

test("项目看板使用六阶段完成归档流程，手绘选择器会解析延迟图片", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");
  const stageBlock = script.match(/const projectBoardStages = \[[\s\S]*?\n\];/)?.[0] || "";
  assert.doesNotMatch(stageBlock, /待交付|已交付/);
  assert.match(script, /actions\.push\(action\("complete", "完成并归档"/);
  assert.match(script, /previousResult === "completed" \? "内部定稿"/);
  assert.match(script, /function painterPickerImageMarkup/);
  assert.match(script, /hydrateLazyKeyImages\(painterPickerGrid\)/);
  assert.match(styles, /\.project-kanban-thumbnail[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(script, /function projectBoardThumbnailSource/);
  assert.match(styles, /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(script, /const unreadOrders = mine\.filter/);
  assert.doesNotMatch(script, /const need = mine\.filter\(\(o\) => o\.signedReviewPending/);
});

test("订单支付保留微信、支付宝二维码和对公账户信息", async () => {
  const script = await read("script.js");
  assert.match(script, /微信支付/);
  assert.match(script, /支付宝/);
  assert.match(script, /对公转账/);
  assert.match(script, /drawPaymentQr/);
  assert.match(script, /pv-bank-row/);
  assert.match(script, /confirmPaymentPaid/);
});

test("登录主视觉使用指定图片，角色头像使用压缩后的 WebP", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  assert.match(html, /textile-studio-hero\.png/);
  await access(path.join(siteDir, "assets", "textile-studio-hero.png"));
  for (const name of ["admin", "designer", "painter", "sales"]) {
    assert.match(script, new RegExp(`avatars/${name}\\.webp`));
    await access(path.join(siteDir, "assets", "avatars", `${name}.webp`));
  }
});
