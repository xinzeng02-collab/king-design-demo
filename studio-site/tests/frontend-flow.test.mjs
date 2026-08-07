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
  const viewAliases = new Set(["adminWorks"]);
  const missing = [...new Set(targets)].filter((target) => !views.has(target) && !viewAliases.has(target));
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
  const styles = await read("styles.css");
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

test("订单客户使用搜索输入且不展示邮箱控件", async () => {
  const script = await read("script.js");
  const orderCard = script.match(/function orderCardPrototypeHtml\(order\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(orderCard, /data-order-customer-input/);
  assert.match(orderCard, /搜索或输入客户，例如：晨光家纺张宇/);
  assert.doesNotMatch(orderCard, /客户邮箱|data-order-email|oc-customer-email/);
  assert.doesNotMatch(script, /copyOrderCustomerEmail|saveOrderCustomerEmail/);
});

test("开始看稿的客户与联系人选择支持中文、全拼和拼音首字母搜索", async () => {
  const script = await read("script.js");
  const companySuggest = script.match(/function renderViewerCompanySuggest\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const nameSuggest = script.match(/function renderViewerNameSuggest\(\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(companySuggest, /searchMatches\(q, \[c\.name, c\.contact\]\)/);
  assert.match(nameSuggest, /searchMatches\(q, \[contact\]\)/);
  assert.match(script, /晨:"chen"/);
  assert.match(script, /latinQuery \? form\.startsWith\(key\) : form\.includes\(key\)/);
});

test("全部可见搜索框使用统一提示并复用拼音匹配", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const searchInputs = [
    ...html.matchAll(/<input[^>]*(?:type="search"|id="(?:teamSearch|painterPickerSearch|memberPickerSearch|viewerCompany|viewerName|ncOwner)")[^>]*>/g),
  ].map((match) => match[0]);

  searchInputs.forEach((input) => assert.match(input, /placeholder="搜索"/));
  assert.match(script, /return searchMatches\(keyword, \[order\.id, order\.customer/);
  assert.match(script, /return painterMatch && \(!query \|\| searchMatches\(query, \[indexText\]\)\)/);
  assert.match(script, /searchMatches\(vlibSearchText, \[card\.dataset\.file, title, card\.dataset\.tags\]\)/);
  assert.match(script, /searchMatches\(keyword, \[resource\.title, resource\.name, resource\.url\]\)/);
});

test("全局搜索包含客户和项目，并使用纯文字左对齐结果行", async () => {
  const script = await read("script.js");
  const styles = await read("tdesign-strict.css");
  const search = script.match(/function buildGlobalSearchMatches\(query\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(search, /customerCenterClients\.forEach\(\(customer\) =>/);
  assert.match(search, /type: "customer"/);
  assert.match(script, /if \(item\.type === "customer"\)[\s\S]*?openCustomerDrawer\(\)/);
  assert.match(styles, /body \.global-search-result\s*\{[\s\S]*?justify-content: stretch;[\s\S]*?text-align: left/);
});

test("客户档案不再保留合作状态字段", async () => {
  const script = await read("script.js");
  const customerCenter = script.match(/\/\/ ================= 客户中心 =================[\s\S]*?\/\* ==== 客户档案的真实统计/)[0];
  assert.doesNotMatch(customerCenter, /合作中|暂停合作|潜在客户|CUSTOMER_STATUS_OPTIONS|customerStatusClass|customerTagClass/);
  assert.match(script, /const \{ status: _legacyStatus, \.\.\.cleanCustomer \} = customer \|\| \{\};/);
  assert.doesNotMatch(script.match(/function buildGlobalSearchMatches\(query\) \{[\s\S]*?\n\}/)?.[0] || "", /customer\.status|未设置状态/);
});

test("独立客户花型预览使用紧凑媒体卡并可加入选稿车", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("styles.css");

  assert.match(script, /class="cpv-cart-action\$\{libraryCart\.has\(file\)/);
  assert.match(script, /data-cpv-add-cart/);
  assert.match(script, /addLibraryCart\(file\)/);
  assert.match(styles, /\.palette-options\s*\{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /#custPatternViewer \.cpv-cart-action[\s\S]*?background:\s*#fff;[\s\S]*?color:\s*#168a4a/);
  assert.match(html, /script\.js\?v=/);
});

test("客户预览双击切换作品库同款全屏图片视角", async () => {
  const script = await read("script.js");
  const viewer = script.match(/function openCustomerPatternViewer\(file, options = \{\}\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(viewer, /ov\.classList\.toggle\("info-hidden"\)/);
  assert.match(viewer, /cpv-media-panel \.palette-option/);
  assert.match(viewer, /ov\.classList\.remove\("info-hidden"\)/);
  assert.doesNotMatch(viewer, /setCustomerPreviewZoom\(customerPreviewZoom > 1\.01 \? 1 : 2\)/);
});

test("客户对比视图遵循全屏竖版对比与选稿车交互", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("tdesign-strict.css");
  assert.match(html, /id="vlibCompareCartToggle"/);
  assert.match(html, /id="vlibCompareCartPop"/);
  assert.match(styles, /aspect-ratio:\s*3 \/ 4/);
  assert.match(styles, /vlib-compare-columns\[data-count="4"\][\s\S]*?repeat\(4/);
  assert.match(styles, /vlib-compare-columns\s*\{[\s\S]*?overflow:\s*visible/);
  assert.match(styles, /vlib-compare-columns\s*\{[\s\S]*?justify-content:\s*center[\s\S]*?padding:\s*0/);
  assert.match(styles, /vlib-compare-actions \{ all: unset/);
  assert.match(script, /let vlibCompareFiles = new Set/);
  assert.match(script, /稿件对比最多支持 4 款/);
  assert.match(script, /data-vlib-compare-confirm/);
  assert.match(script, /data-vlib-compare-cart-add/);
  assert.match(script, /addEventListener\("wheel"/);
  assert.match(html, /tdesign-strict\.css\?v=20260802-compare-image-v74/);
});

test("完整选稿车页面点击图片使用作品库标准预览", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const cartHandlers = script.match(/document\.querySelector\("#cartCustomerList"\)\?\.addEventListener\("click"[\s\S]*?\/\/ ===== 新建客户档案/)?.[0] || "";
  assert.match(script, /function openLightbox\(card, \{ nested = false, worksLibrary = activeViewId\(\) !== "review", viewerContext = null \} = \{\}\)/);
  assert.match(cartHandlers, /openLightbox\(card, \{ worksLibrary: true, viewerContext: false \}\)/);
  assert.doesNotMatch(cartHandlers, /openCustomerPatternViewer/);
  assert.match(html, /script\.js\?v=/);
});

test("共享作品库和手绘关联只接收审核通过且未归档的稿件", async () => {
  const script = await read("script.js");
  const catalog = script.match(/function painterWorkCatalog\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const sharedApproval = script.match(/function isApprovedSharedWork\(card\) \{[\s\S]*?\n\}/)?.[0] || "";
  const worksView = script.match(/function configureWorksView\([^)]*\) \{[\s\S]*?function personalWorkCardMatches/)?.[0] || "";

  assert.match(catalog, /card\.dataset\.workRole === "手绘师"/);
  assert.match(catalog, /isApprovedSharedWork\(card\)/);
  assert.match(sharedApproval, /reviewState === "approved"/);
  assert.match(sharedApproval, /card\.classList\.contains\("deleted"\)/);
  assert.match(sharedApproval, /isSleepingWork\(card\)/);
  assert.match(sharedApproval, /\["已通过", "已出售", "交付中", "完结"\]/);
  assert.match(worksView, /isSharedLibrary && !isApprovedSharedWork\(card\)/);
  assert.match(script.match(/function approvedLibraryCards\(\) \{[\s\S]*?\n\}/)?.[0] || "", /filter\(isApprovedSharedWork\)/);

  const isApproved = new Function("reviewLogs", "isSleepingWork", "cardStatusSummary", `${sharedApproval}; return isApprovedSharedWork;`)(
    (card) => card.logs || [],
    (card) => Boolean(card.sleeping),
    (card) => card.summary || "",
  );
  const card = (reviewState, summary = "", options = {}) => ({
    dataset: { reviewState, reviewAction: options.reviewAction || "" },
    classList: { contains: (name) => name === "deleted" && Boolean(options.deleted) },
    summary,
    sleeping: Boolean(options.sleeping),
  });
  assert.equal(isApproved(card("pending")), false);
  assert.equal(isApproved(card("revision", "需修改")), false);
  assert.equal(isApproved(card("approved")), true);
  assert.equal(isApproved(card("pending", "销售状态：已出售")), true);
  assert.equal(isApproved(card("approved", "已通过", { sleeping: true })), false);
});

test("客户看稿花型库排除选稿车稿件且已选视图保留本次稿件", async () => {
  const script = await read("script.js");
  const selectedSource = script.match(/function selectedCartFiles\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const filterSource = script.match(/function vlibFilteredCards\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const legacyFilter = script.match(/function filteredViewerLibraryDesigns\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const syncSource = script.match(/function syncVlibGalleryAfterCartChange\(file\) \{[\s\S]*?\n\}/)?.[0] || "";

  const currentCart = new Set(["current.jpg"]);
  const submittedCarts = [{ files: ["submitted.jpg"] }];
  const selectedCartFiles = new Function("libraryCart", "selectionCarts", `${selectedSource}; return selectedCartFiles;`)(currentCart, submittedCarts);
  assert.deepEqual([...selectedCartFiles()].sort(), ["current.jpg", "submitted.jpg"]);

  const cards = ["current.jpg", "submitted.jpg", "available.jpg"].map((file) => ({
    dataset: { file, tags: "" },
    querySelector: () => ({ textContent: file }),
  }));
  const makeFilter = (selectedOnly) => new Function(
    "approvedLibraryCards", "soldPatternFiles", "selectedCartFiles", "libraryCart",
    "libraryFilterConfig", "vlibEnsureState", "cardLibraryValues", "vlibSearchText",
    "searchMatches", "vlibSelectedOnly",
    `${filterSource}; return vlibFilteredCards;`,
  )(
    () => cards,
    () => new Set(),
    selectedCartFiles,
    currentCart,
    [],
    () => ({}),
    () => [],
    "",
    () => true,
    selectedOnly,
  );

  assert.deepEqual(makeFilter(false)().map((card) => card.dataset.file), ["available.jpg"]);
  assert.deepEqual(makeFilter(true)().map((card) => card.dataset.file), ["current.jpg"]);
  assert.match(legacyFilter, /!selectedFiles\.has\(card\.dataset\.file\)/);
  assert.match(syncSource, /vlibVisibleCards = vlibVisibleCards\.filter/);
  assert.match(syncSource, /renderVlibGallery\(true\)/);
  assert.match(syncSource, /renderVlibGallery\(\)/);
});

test("品牌入口暂时隐藏客户看稿但保留完整客户能力", async () => {
  const html = await read("index.html");
  const loginStyles = await read("login-experience.css");

  assert.match(html, /id="openClientLogin"[^>]*hidden/);
  assert.match(html, /id="clientLoginPanel"/);
  assert.match(html, /id="viewerLibrary"/);
  assert.match(loginStyles, /\.login-entry-button\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

test("登录入口使用统一蓝色点缀与冷调白背景", async () => {
  const loginStyles = await read("login-experience.css");

  assert.match(loginStyles, /--login-accent:\s*#2563eb/);
  assert.match(loginStyles, /--login-warm-white:\s*#f5f7fa/);
  assert.doesNotMatch(loginStyles, /--login-red|#b51f28|#f2f0eb/);
  assert.match(loginStyles, /\.login-password-control:focus-within\s*\{[\s\S]*?border-color:\s*var\(--login-accent\)/);
});

test("登录密码控件不出现嵌套边框且空错误提示不占位", async () => {
  const html = await read("index.html");
  const styles = await read("tdesign-strict.css");

  assert.match(styles, /\.login-password-control\s*\{\s*padding:\s*0\s*!important/);
  assert.match(styles, /\.login-password-control > input[\s\S]*?border:\s*0\s*!important/);
  assert.match(styles, /body \.login-error:empty[\s\S]*?display:\s*none\s*!important/);
  assert.match(html, /tdesign-strict\.css\?v=/);
});

test("登录面板与冷灰页面背景融合", async () => {
  const html = await read("index.html");
  const styles = await read("tdesign-strict.css");

  assert.match(styles, /\.login-screen\s*\{\s*background:\s*var\(--td-page\)/);
  assert.match(styles, /\.login-side,[\s\S]*?\.login-panel\s*\{\s*background:\s*var\(--td-page\) !important/);
  assert.match(html, /tdesign-strict\.css\?v=/);
});

test("管理员拥有独立的个人稿件入口并复用创作者稿件模式", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("styles.css");
  assert.match(html, /data-view="adminWorks" data-roles="管理员"/);
  const personalWorksIcons = [...html.matchAll(/data-view="(?:designer|adminWorks)"[^>]*><svg[^>]*>([\s\S]*?)<\/svg><span class="nav-label">(?:我的稿件|作品库)<\/span>/g)]
    .map((match) => match[1].replace(/\s+/g, ""));
  assert.equal(personalWorksIcons.length, 2);
  assert.notEqual(personalWorksIcons[0], personalWorksIcons[1]);
  assert.match(script, /activeWorksMode = target === "adminWorks" \? "personal" : "library"/);
  assert.match(script, /const isPersonalWorks = !isSharedLibrary/);
  assert.doesNotMatch(html, /id="worksUploadRow"|class="upload-card open-upload"/);
  assert.doesNotMatch(script, /worksUploadRow/);
  assert.match(script, /worksFilterContext !== nextFilterContext[\s\S]*?libraryFilterState\[row\.key\]\.clear\(\)[\s\S]*?renderLibraryFilterBar\(\)/);
  assert.match(script, /worksBoard\?\.classList\.toggle\("personal-review-gallery", isPersonalWorks\)/);
  assert.match(script, /function personalWorkCardMatches\(card, role, ownerKey\)/);
  assert.match(script, /return !isPersonalWorks \|\| personalWorkCardMatches\(card, role, ownerKey\)/);
  assert.match(script, /const mountedCards = \[\.\.\.\(worksBoard\?\.querySelectorAll\("\.work-card"\)/);
  assert.match(script, /function deferHiddenWorkPreviewCleanup\(cards\)/);
  assert.match(script, /requestIdleCallback\(runChunk, \{ timeout: 180 \}\)/);
  assert.match(script, /\}, 120\);\s*\}/);
  assert.match(script, /const adminGlobalContext = currentAccount\.role === "管理员"[\s\S]*?activeWorksMode === "personal"/);
  assert.match(script, /currentAccount\.role === "管理员" && activeWorksMode !== "personal"/);
  assert.match(script, /if \(activeViewId\(\) === "designer"\) \{\s*configureWorksView\(role, currentAccount\.ownerKey\)/);
  assert.match(script, /button\.addEventListener\("click", \(\) => openUploadModal\(\)\)/);
  assert.match(script, /filteredWorksScope = nextFilteredScope/);
  assert.match(script, /const cards = sourceCards\.filter\(\(card\) => !hasAppliedWorksFilter \|\| filteredWorksScope\.has\(card\)\)/);
  assert.match(html, /id="globalSearchToggle"[\s\S]*?aria-expanded="false"/);
  assert.match(script, /function setGlobalSearchExpanded\(expanded/);
  assert.match(styles, /\.global-search:not\(\.expanded\) \.global-search-toggle:hover\s*\{[\s\S]*?background:\s*#111/);
});

test("上传使用 Blob 存储，并保留源文件缺失提示", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");
  assert.match(script, /KingBlobStore/);
  assert.match(script, /mapWithConcurrency\(uploadPlans, uploadConcurrency/);
  assert.match(script, /largestUploadBytes >= 30 \* 1024 \* 1024 \? 1/);
  assert.match(script, /saveImageToDB\(originalKey, file, \{ onProgress \}\)/);
  assert.match(script, /saveImageToDB\(plan\.key, plan\.file, \{ onProgress: updateProgress \}\)/);
  assert.match(script, /MAX_IMAGE_FILE_BYTES = 100 \* 1024 \* 1024/);
  assert.match(script, /return \{ originalKey, thumbKey, previewKey: originalKey \}/);
  assert.match(script, /workImages: JSON\.stringify\(workImages\)/);
  assert.match(script, /class="upload-slot-card"[\s\S]*?class="upload-slot-add"/);
  assert.match(script, /data-upload-slot-add/);
  assert.match(script, /maxCount: Number\.POSITIVE_INFINITY/);
  assert.match(script, /selectedUploadFiles = mergedFiles;/);
  assert.doesNotMatch(script, /slots\.push\(\{ purpose: "编辑名称 \+"/);
  assert.match(styles, /\.upload-slot-card-add\s*\{[\s\S]*?border:\s*1px dashed #1f1f1f;[\s\S]*?background:\s*#fff/);
  assert.match(script, /draggable="true" data-upload-drag-index=/);
  assert.match(script, /fileReadout\.addEventListener\("drop"/);
  assert.doesNotMatch(script, /data-move-upload|data-upload-purpose|upload-order-actions/);
  assert.doesNotMatch(styles, /\.upload-purpose-label|\.upload-order-actions|\.upload-slot-purpose/);
  assert.match(script, /未上传源文件/);
  assert.doesNotMatch(script, /saveImageToDB\([^,\n]+,\s*await readFileAsDataURL/);
});

test("云端协作的作品文件与状态冲突具备明确处理路径", async () => {
  const html = await read("index.html");
  const script = await read("script.js");

  assert.match(html, /script\.js\?v=20260807-production-sync-v15/);
  assert.match(script, /function backendStudioAsset\(key, options = \{\}\)/);
  assert.match(script, /await backendStudioAsset\(key, \{[\s\S]*?action: "sign-upload"/);
  assert.match(script, /request\.open\("PUT", signedUrl\)/);
  assert.match(script, /const body = new FormData\(\)[\s\S]*?body\.append\("cacheControl", "3600"\)[\s\S]*?body\.append\("", imageData\)[\s\S]*?request\.send\(body\)/);
  assert.doesNotMatch(script.match(/async function uploadBackendStudioAsset[\s\S]*?\n\}/)?.[0] || "", /setRequestHeader\("content-type"/);
  assert.match(script, /function mergeStudioModule\(module, remoteValue, localValue, previousValue\)/);
  assert.match(script, /valueToSend = mergeStudioModule\(module, backendSyncMeta\(\)\?\.state\?\.\[module\], valueToSend, previousState\?\.\[module\]\)/);
  assert.match(script, /const removedKeys = new Set/);
  assert.match(script, /const locallyChanged = !previousRecord/);
  assert.match(script, /async function uploadBackendStudioAssetOnce/);
  assert.match(script, /for \(let attempt = 1; attempt <= 3; attempt \+= 1\)/);
  assert.match(script, /request\.timeout = 600000/);
  assert.match(script, /function normalizeStudioAssetBaseKey/);
  const keyNormalizerSource = script.match(/function normalizeStudioAssetBaseKey\([^)]*\) \{[\s\S]*?\n\}/)?.[0] || "";
  const normalizeAssetKey = new Function(`${keyNormalizerSource}; return normalizeStudioAssetBaseKey;`)();
  const chineseKey = normalizeAssetKey("K-XH0708_看图王");
  assert.match(chineseKey, /^[A-Za-z0-9._-]+$/);
  assert.doesNotMatch(chineseKey, /看图王/);
  assert.notEqual(chineseKey, normalizeAssetKey("K-XH0708_另一张图"));
  assert.equal(normalizeAssetKey("K-XH0708_original"), "K-XH0708_original");
  assert.match(script, /backendLastSyncAttempt = backendSyncQueue\.then\(syncWithRetry\)/);
  assert.match(script, /await saveStudioStateToCloud\(\)/);
  assert.match(script, /logoutButton\.addEventListener\("click", async[\s\S]*?await backendLastSyncAttempt/);
  assert.match(script, /return saveStudioStateNow\(\);/);
  assert.match(script, /function deprovisionBackendEmployeeAccount/);
  assert.match(script, /action=deprovision-employee/);
  assert.match(script, /await deprovisionBackendEmployeeAccount\(\{ username: member\.ownerKey \}\)/);

  const mergeHelpers = script.match(/function studioRecordIdentity\(record\)[\s\S]*?async function pushBackendStudioModules/)?.[0]
    .replace(/async function pushBackendStudioModules[\s\S]*$/, "") || "";
  const mergeModule = new Function("currentAccount", `${mergeHelpers}; return mergeStudioModule;`)({ ownerKey: "painter-a" });
  const previous = [{ file: "A", reviewState: "pending" }];
  const local = [{ file: "A", reviewState: "pending" }, { file: "B", reviewState: "pending" }];
  const remote = [{ file: "A", reviewState: "approved" }];
  const merged = mergeModule("createdWorks", remote, local, previous);
  assert.equal(merged.find((item) => item.file === "A")?.reviewState, "approved");
  assert.equal(merged.find((item) => item.file === "B")?.reviewState, "pending");

  const previousWork = [{ file: "C", imageKey: "old", reviewState: "pending", reviewNote: "" }];
  const localWork = [{ file: "C", imageKey: "new", reviewState: "pending", reviewNote: "" }];
  const remoteWork = [{ file: "C", imageKey: "old", reviewState: "revision", reviewNote: "调整配色" }];
  const mergedWork = mergeModule("createdWorks", remoteWork, localWork, previousWork)[0];
  assert.equal(mergedWork.imageKey, "new");
  assert.equal(mergedWork.reviewState, "revision");
  assert.equal(mergedWork.reviewNote, "调整配色");

  const mergedOverride = mergeModule(
    "overrides",
    { C: remoteWork[0] },
    { C: localWork[0] },
    { C: previousWork[0] },
  ).C;
  assert.equal(mergedOverride.imageKey, "new");
  assert.equal(mergedOverride.reviewState, "revision");
  assert.equal(mergedOverride.reviewNote, "调整配色");

  const pull = script.match(/async function pullBackendStudioState\([\s\S]*?\n\}/)?.[0] || "";
  assert.ok(pull.indexOf("refreshUi && remoteJson !== localJson && anyOverlayOpen()") < pull.indexOf("writeBackendSyncMeta"));
  assert.match(script, /function scheduleDeferredBackendRefresh\(\)[\s\S]*?pullBackendStudioState\(\{ refreshUi: true, checkRevision: true \}\)/);
});

test("正式版不泄漏演示设计师身份，成员档案只对管理员开放", async () => {
  const html = await read("index.html");
  const script = await read("script.js");

  assert.doesNotMatch(html, /id="profileNameInput">许然/);
  assert.doesNotMatch(html, /id="lightboxOwner"[^>]*>设计师：许然/);
  assert.doesNotMatch(script, /许然/);
  assert.match(script, /const legacyOwnerNames = RELEASE_CONFIG\.seedDemoData === false \? \{\} : \{/);
  assert.match(script, /if \(currentAccount\.role !== "管理员"\) return;[\s\S]*?lightboxOwner\.dataset\.memberName/);
  assert.match(script, /function openTeamMemberDetail\(memberKey\) \{\s*if \(currentAccount\.role !== "管理员"\) return;/);
  assert.match(script, /if \(targetNav && !viewAllowedForRole\(targetNav, currentAccount\.role\)\)/);
  assert.match(script, /const demoOnlyKeys = new Set/);
  assert.doesNotMatch(script, /key !== "admin" && name !== "管理员"/);
});

test("订单逐稿定价局部更新并合并保存，输入时不重绘整张订单", async () => {
  const script = await read("script.js");
  const saver = script.match(/function saveOrderPatternPriceInput\(input\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(script, /function queueOrderPriceStateSave\(\)/);
  assert.match(script, /function syncOrderPriceControls\(order, sourceInput\)/);
  assert.match(saver, /syncOrderPriceControls\(order, input\)/);
  assert.match(saver, /queueOrderPriceStateSave\(\)/);
  assert.doesNotMatch(saver, /renderOrderCenter\(\)/);
});

test("设计师和手绘师有直达上传入口，并显示真实云端上传进度", async () => {
  const html = await read("index.html");
  const script = await read("script.js");

  assert.match(html, /id="worksUploadButton"/);
  assert.match(html, /id="appLoadingProgress"[\s\S]*?role="progressbar"/);
  assert.match(script, /worksUploadButton\?\.addEventListener\("click", \(\) => openUploadModal\(\)\)/);
  assert.match(script, /function createUploadProgressTracker\(plans\)/);
  assert.match(script, /request\.upload\.onprogress/);
  assert.match(script, /persistArtworkImageTiers\(plan\.baseKey, plan\.file, \{ onProgress: updateProgress \}\)/);
  assert.match(script, /setAppLoadingProgress\(100, "上传完成，正在打开稿件…"\)/);
  assert.match(script, /topStartReview\?\.toggleAttribute\("hidden", !canStartReview\)/);
  assert.match(script, /if \(!\["管理员", "销售"\]\.includes\(currentAccount\.role\)\) return;/);
});

test("客户、员工、订单、作品及评审关系都进入云端状态模块", async () => {
  const script = await read("script.js");
  for (const module of [
    "createdWorks", "overrides", "removedFiles", "activityNotifications", "orders",
    "projects", "customers", "teamMembers", "personalWorkArchives", "sharedWorkspaceLocalData",
    "resourceFolders", "resources",
  ]) {
    assert.match(script, new RegExp(`${module}[,:]`));
  }
  assert.match(script, /linkedSketches:\s*data\.linkedSketches/);
  assert.match(script, /reviewStatus:\s*data\.reviewStatus/);
  assert.match(script, /sleeping:\s*data\.sleeping/);
});

test("云端同步原地增量更新界面，不再自动整页刷新", async () => {
  const html = await read("index.html");
  const script = await read("script.js");

  assert.match(script, /function applyCloudStudioState\(remoteState, remoteJson, changedModules\)/);
  assert.match(script, /function applyLightweightCloudModules/);
  assert.match(script, /pullBackendStudioState\(\{ refreshUi: true, checkRevision: true \}\)/);
  assert.match(script, /backendApi\("\/api\/admin\/studio-state\?meta=1"\)/);
  assert.doesNotMatch(script, /BACKEND_LOGIN_RELOAD_KEY/);
  const puller = script.match(/async function pullBackendStudioState[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(puller, /location\.reload\(\)/);
  assert.match(script, /function refreshBackendAuthSession/);
  assert.match(script, /response\.status === 401 && session\.refreshToken/);
  assert.match(script, /短时断网或接口超时不能等同于退出登录/);
  assert.match(script, /showAppLoading\("正在验证账号…", \{ progress: true \}\)/);
  assert.match(script, /setAppLoadingProgress\(100, "工作台已准备完成"\)/);
  assert.match(script, /showAppLoading\("正在同步云端数据…", \{ progress: true \}\)/);
  assert.match(html, /if \(sessionStorage\.getItem\("kingDesignBootShown"\) && !restoringBackendSession\)/);
  assert.match(html, /\.backend-session-restoring \.app-shell\.locked\{display:none!important;visibility:hidden;pointer-events:none\}/);
  assert.doesNotMatch(html, /\.backend-session-restoring \.app-shell\.locked\{display:grid/);
});

test("云端稿件恢复会清理分页暂存副本并将去重结果写回服务器", async () => {
  const script = await read("script.js");
  const reset = script.match(/function resetStudioRuntimeBeforeCloudHydration\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const refresh = script.match(/function refreshWorkCards\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const cleanup = script.match(/async function cleanupDuplicateCloudStudioRecords\(\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(script, /function dedupeCreatedWorks\(records\)/);
  assert.match(script, /unique\.set\(file, record\)/);
  assert.match(reset, /workCardParking\?\.querySelectorAll\("\.work-card"\)/);
  assert.match(reset, /workCards = \[\]/);
  assert.match(refresh, /if \(uniqueCards\.has\(file\)\) \{\s*card\.remove\(\)/);
  assert.match(script, /if \(!work\?\.file \|\| existingWorkFiles\.has\(work\.file\)\) return/);
  assert.match(cleanup, /pushBackendStudioModules\(previousState, nextState\)/);
  assert.match(script, /pendingCloudStudioCleanupPreviousState = \{[\s\S]*?createdWorks:/);
});

test("未关闭订单中的花型不会再次出现在花型库", async () => {
  const script = await read("script.js");
  const activeOrders = script.match(/function activeOrderFiles\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(activeOrders, /orderProgressStatus\(order\) !== "已关闭"/);
  assert.match(activeOrders, /flatMap\(\(order\) => orderPatternList\(order\)\)/);
  assert.doesNotMatch(activeOrders, /flatMap\(\(order\) => order\.files \|\| \[\]\)/);
});

test("每日评审区分管理员审核与上传者编辑视角", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("styles.css");
  [
    "lightboxEditWork",
    "lightboxSleepToggle",
    "lightboxDeleteWork",
    "lightboxRevisionSummary",
    "lightboxRevisionInput",
    "lightboxRevisionConfirm",
    "lightboxReviewLogPanel",
  ].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  assert.match(script, /function isUploaderDetailContext/);
  assert.match(script, /function isAdminReviewContext/);
  assert.match(script, /await openUploadModal\(card\)/);
  assert.match(script, /async function hydrateUploadEditForm/);
  assert.match(script, /uploadEditTargetCard/);
  assert.match(script, /保存并重新提交/);
  assert.match(script, /lightboxRevisionDraftCard = card/);
  assert.match(script, /applyReviewDecision\(card, "修改", note\)/);
  assert.match(script, /async function applyReviewDecision/);
  assert.match(script, /async function syncReviewChangeToCloud[\s\S]*?await saveStudioStateToCloud\(\)/);
  assert.match(script, /reviewConfirmSubmit\.addEventListener\("click", async[\s\S]*?await onConfirm\(action, note\)/);
  assert.match(script, /action === "修改" && !note/);
  assert.match(script, /currentReviewAction === "修改"[\s\S]*?action === "通过"/);
  assert.match(script, /badge\.textContent = `配色 \$\{colorCount\}`/);
  assert.match(script, /lightboxRevisionConfirm[\s\S]*?再次编辑/);
  assert.match(script, /lightboxProjectChoices/);
  assert.doesNotMatch(script, /sourceFileEdit/);
  assert.doesNotMatch(html, /id="sourceFileEdit"/);
  assert.doesNotMatch(script, /lightboxStatusList/);
  assert.doesNotMatch(html, /id="addPaletteButton"|id="sketchEditButton"/);
  assert.doesNotMatch(script, /addPaletteButton|sketchEditButton|paletteEditMode|sketchEditMode/);
  assert.match(styles, /\.lightbox-revision-summary/);
  assert.match(styles, /\.review-work-card \.color-count\s*\{[\s\S]*?left:\s*10px/);
  assert.match(styles, /\.review-date-current svg/);
  assert.match(styles, /\.review-work-card,[\s\S]*?aspect-ratio:\s*3\s*\/\s*4/);
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
  assert.match(script, /const mountedCards = orderedCards\.slice\(0, workRenderLimit\)/);
  assert.match(script, /workCardParking\.appendChild\(card\)/);
  assert.match(script, /applyLibraryFilters\(\{ renderBatch: false \}\);\s*sortWorkCards\(\)/);
  assert.match(script, /function suspendWorkCardPreview\(card\)[\s\S]*?workPreviewObserver\?\.unobserve\(image\)[\s\S]*?image\.removeAttribute\("src"\)/);
  assert.match(script, /if \(card\.dataset\.imageData\) \{\s*queueWorkPreviewImage\(image, card\.dataset\.imageData, \{ eager \}\)/);
  assert.match(script, /prepareWorkCardPreview\(card, \{ eager: index < 4 \}\)/);
  const initialHydration = script.match(/async function hydrateStoredImages\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(initialHydration, /cards\.forEach\(prepareWorkCardPreview\)/);
  assert.match(script, /function loadQueuedWorkPreview\(image, sourceOrResolver\)/);
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
  assert.match(html, /script\.js\?v=/);
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
  const html = await read("index.html");
  const styles = await read("styles.css");
  const stageBlock = script.match(/const PJ_STAGES = \[[\s\S]*?\n\];/)?.[0] || "";
  assert.doesNotMatch(stageBlock, /待交付|已交付/);
  ["需求确认", "概念方案", "设计制作", "稿件评审", "修改完善", "内部定稿"]
    .forEach((stage) => assert.match(stageBlock, new RegExp(stage)));
  assert.match(script, /data-pj-complete/);
  assert.match(script, /项目已完成并归档/);
  assert.match(script, /if \(toStage === "内部定稿"\) return false/);
  assert.match(script, /function painterPickerImageMarkup/);
  assert.match(script, /hydrateLazyKeyImages\(painterPickerGrid\)/);
  assert.match(script, /function renderProjectsView/);
  assert.match(script, /const unreadOrders = mine\.filter/);
  assert.doesNotMatch(script, /const need = mine\.filter\(\(o\) => o\.signedReviewPending/);
  assert.match(html, /id="pjDetailPage" hidden/);
  assert.match(html, /id="pjDetailBack"[^>]*>← 返回项目管理/);
  assert.doesNotMatch(html, /id="pjTypeFilter"|id="pjOwnerFilter"|id="pjSearch"/);
  assert.doesNotMatch(script, /pjEnsureDrawer|id = "pjDrawer"/);
  assert.match(script, /data-pj-add-patterns/);
  assert.match(script, /data-pj-toggle-feed/);
  assert.match(script, /function pjIsOwner/);
  assert.doesNotMatch(html, /vanilla-calendar-pro/);
  assert.doesNotMatch(script, /VanillaCalendarPro|selectionDatesMode|pjCalendar|pj-cal/);
  assert.match(script, /function pjDateRangeFields/);
  assert.match(script, /id="pjdStartDate" type="date"/);
  assert.match(script, /id="pjdEndDate" type="date"/);
  assert.doesNotMatch(styles, /\.pj-range-line/);
  assert.doesNotMatch(script, /projectBoardStages|projectResultLabels|defaultBoardProjects|stageColor/);
  assert.match(styles, /\.pj-board\s*\{[\s\S]*?grid-template-columns:\s*repeat\(6/);
  assert.match(styles, /\.pj-card\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(script, /function pjAvatars\(keys, max = 2\)/);
  assert.match(script, /pjAvatars\(\[\.\.\.new Set\([\s\S]*?\], 2\)/);
  assert.match(styles, /\.pj-drop\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(script, /data-pj-create-stage/);
  assert.match(script, /function pjOpenCreateMemberPicker/);
  assert.match(script, /data-pjf-member-picker="designer"/);
  assert.match(script, /data-pjf-member-picker="painter"/);
  assert.match(script, /data-pjf-member-picker="owner"/);
  assert.match(script, /pjOpenForm\(null, \{ name, stage: PJ_STAGES\[0\]\.key \}, \{/);
  assert.match(styles, /\.pjd-pat\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(styles, /\.pjp-thumb\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(script, /class="pjp-hover-info"/);
  assert.match(script, /<span class="color-count">配色 \$\{colors\}<\/span>/);
  assert.match(styles, /\.pjp-item:hover \.pjp-hover-info/);
});

test("新建项目遵循原型并校验名称、时间和负责人", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");
  assert.match(script, /class="pjf-file-section"/);
  assert.match(script, /id="pjfFiles"/);
  assert.match(script, /id="pjfFileInput"/);
  assert.match(script, /data-pjf-member-summary="designer"/);
  assert.match(script, /data-pjf-member-summary="painter"/);
  assert.match(script, /data-pjf-member-summary="owner"/);
  assert.match(script, /保存到草稿箱/);
  assert.match(script, /if \(!data\.name\) invalid\.push\(\["name"/);
  assert.match(script, /if \(!data\.startDate\) invalid\.push\(\["start"/);
  assert.match(script, /if \(!data\.deadline\) invalid\.push\(\["deadline"/);
  assert.match(script, /if \(!data\.owner\) invalid\.push\(\["owner"/);
  assert.match(script, /pjOpenForm\(null, draft\)/);
  assert.match(styles, /\.pjf-file-add\s*\{[\s\S]*?border:\s*1px dashed/);
  assert.match(styles, /\.pjf-person-chip/);
  assert.match(styles, /\[data-pjf-field\]\.has-error/);
});

test("总控台恢复四项统计并读取新版项目数据", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");
  assert.match(script, /function activeProjectItems\(\)[\s\S]*?pjProjects[\s\S]*?!project\.archived/);
  assert.match(script, /<span>待评审稿件<\/span>/);
  assert.match(script, /<span>进行中项目<\/span>/);
  assert.match(script, /<span>订单待处理<\/span>/);
  assert.match(script, /<span>风险提醒<\/span>/);
  assert.match(script, /const projects = memberProjectItems\(member\)/);
  assert.match(script, /class="employee-load-segment low"/);
  assert.match(script, /data-active-load/);
  assert.match(script, /setActiveLoad/);
  assert.doesNotMatch(styles, /\.employee-load-callout/);
  assert.match(styles, /\.employee-load-segment:hover/);
  assert.ok(script.indexOf("pjLoad();\napplyStoredState();") > -1);
  assert.match(styles, /\.project-list article\s*\{[\s\S]*?display:\s*flex[\s\S]*?border-bottom:/);
  assert.match(styles, /\.team-project-count:not\(:disabled\):hover[\s\S]*?text-decoration:\s*underline/);
});

test("设计师总控台使用个人数据、只读排行和独立作品趋势", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("styles.css");
  assert.match(html, /data-role-dashboard="设计师"[\s\S]*?id="designerDashboard"/);
  assert.match(script, /function renderDesignerDashboard\(role = currentAccount\.role\)/);
  assert.match(script, /function designerProductionBuckets\(/);
  assert.match(script, /data-designer-range="month"/);
  assert.match(script, /data-designer-range="three"/);
  assert.match(script, /data-designer-range="six"/);
  assert.match(script, /<h3>作品产出<\/h3>/);
  assert.doesNotMatch(script.match(/function renderDesignerDashboard\([^)]*\)[\s\S]*?function renderCreativeDashboard/)?.[0] || "", /作品产出排行榜|前 7 名 · 仅展示/);
  assert.doesNotMatch(script.match(/function renderDesignerDashboard\([^)]*\)[\s\S]*?function renderCreativeDashboard/)?.[0] || "", /data-dashboard-performance/);
  assert.match(script, /data-designer-work=/);
  assert.match(script, /data-designer-project=/);
  assert.match(styles, /\.designer-main-grid/);
  assert.match(styles, /\.tag-manager-button\.hidden\s*\{\s*display:\s*none/);
});

test("订单支付保留微信、支付宝二维码和对公账户信息", async () => {
  const script = await read("script.js");
  assert.match(script, /微信支付/);
  assert.match(script, /支付宝/);
  assert.match(script, /对公转账/);
  assert.match(script, /drawPaymentQr/);
  assert.match(script, /pv-bank-row/);
  assert.match(script, /confirmPaymentPaid/);
  assert.doesNotMatch(script, /resolveDeferredImages/);
  assert.match(script, /function renderOrderCenter\(\)[\s\S]*?hydrateLazyKeyImages\(orderList\)/);
  const generateOrder = script.match(/async function cartEntryToOrder\(entryId\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.ok(generateOrder.indexOf('switchView("orders")') < generateOrder.indexOf("selectionCarts = selectionCarts.filter"));
  assert.match(generateOrder, /openPaymentPage\(order\)/);
});

test("订单全部花型弹窗复用稿件信息且详情预览位于弹窗上层", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");
  const modal = script.match(/function openOrderPatterns\(orderId\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(modal, /class="color-count">配色 \$\{colorCount\}/);
  assert.match(modal, /workOwnerName\(card\)/);
  assert.doesNotMatch(modal, /↗|已购买/);
  assert.match(styles, /\.lightbox\s*\{[\s\S]*?z-index:\s*2400/);
  assert.match(styles, /\.oc-pattern-item > span \.color-count/);
  assert.match(script, /const patternBtn = event\.target\.closest\("\[data-order-pattern\]"\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?openOrderPatterns/);
});

test("客户单行菜单和批量管理共用可逆置顶逻辑", async () => {
  const script = await read("script.js");
  assert.match(script, /function setCustomerPinned\(ids, pinned\)/);
  assert.match(script, /data-customer-pin=/);
  assert.match(script, /client\.pinned \? "取消置顶" : "置顶客户"/);
  assert.match(script, /selectedClients\.every\(\(client\) => client\.pinned\) \? "取消置顶" : "置顶"/);
  assert.match(script, /const shouldPin = !selected\.every\(\(client\) => client\.pinned\)/);
  assert.match(script, /setCustomerPinned\(\[client\.id\], !client\.pinned\)/);
});

test("客户档案使用真实已支付订单展示已购花型", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");
  assert.match(script, /function customerPaidOrders\(client\)[\s\S]*?paymentStatus === "已支付"/);
  assert.match(script, /function customerPurchasedOrderCardHtml\(order\)/);
  assert.match(script, /libraryCardHtml\(card, false, \{ orderCompact: true, orderId: order\.id \}\)/);
  assert.match(script, /function customerPurchasedOrdersHtml\(client\)/);
  assert.match(script, /hydrateLazyKeyImages\(panel\)/);
  assert.doesNotMatch(script.match(/function customerOverviewHtml\(client\)[\s\S]*?\n\}/)?.[0] || "", /customerRecentWorks/);
  assert.match(styles, /\.cc-purchase-order \.oc-pattern-strip/);
});

test("休眠、回收站和人员选择遵循统一状态与保留规则", async () => {
  const script = await read("script.js");
  const html = await read("index.html");
  const styles = await read("styles.css");
  assert.match(html, /id="emptyRecycle" data-admin-action/);
  assert.match(script, /emptyRecycle\.addEventListener\("click", async \(\) => \{\s*if \(currentAccount\.role !== "管理员"\) return/);
  assert.match(script, /const retentionMs = 90 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(script, /function permanentlyRemoveWorkCards/);
  assert.match(script, /window\.KingBlobStore\?\.remove/);
  assert.match(script, /deleteBackendStudioAsset\(key\)/);
  assert.match(script, /await saveStudioStateToCloud\(\)/);
  assert.match(script, /personalArchiveBucket\(\)\.deleted\?\.\[card\.dataset\.file\]/);
  assert.match(script, /clone\.classList\.add\(mode === "sleep" \? "sleep-item" : "recycle-item"\)/);
  assert.match(html, /class="works-board library-gallery review-card-grid recycle-list"/);
  assert.match(script, /clone\.classList\.add\(mode === "sleep" \? "sleep-item" : "recycle-item"\)/);
  assert.match(script, /class="work-card recycle-item"/);
  assert.match(script, /hydrateArchiveWorkImages\(sleepList, items, "sleep-item", "sleep-thumb"\)/);
  assert.match(styles, /\.sleep-item\s*\{[\s\S]*?aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(styles, /\.recycle-item \.restore-work\s*\{/);
  assert.match(styles, /\.works-board\.library-gallery\.recycle-list\s*\{[\s\S]*?minmax\(min\(180px,\s*100%\),\s*1fr\)/);
  assert.match(script, /recycleList\?\.addEventListener\("click"[\s\S]*?const restoreButton = event\.target\.closest\("\.restore-work"\)/);
  assert.match(script, /openLightbox\(card, \{ worksLibrary: true \}\)/);
  assert.match(script, /lightboxWorksLibraryContext \|\| \["designer", "projects"\]\.includes\(activeViewId\(\)\)/);
  assert.match(script, /if \(activeViewId\(\) === "recycle"\) return false/);
  assert.match(script, /\["designer", "sleep", "projects"\]\.includes\(activeViewId\(\)\)/);
  assert.match(script, /lightboxEditWork\?\.classList\.toggle\("hidden", recycleDetailContext \|\| !\(adminReviewContext \|\| uploaderContext \|\| metadataContext\)\)/);
  assert.match(script, /lightboxSleepToggle\.classList\.toggle\("hidden", recycleDetailContext \|\| !\(adminReviewContext \|\| metadataContext\)\)/);
  assert.match(script, /lightboxDeleteWork\.classList\.toggle\("hidden", recycleDetailContext \|\| !\(adminReviewContext \|\| metadataContext \|\| uploaderContext\)\)/);
  assert.match(script, /event\.target\.closest\("\.library-card\[data-library-file\]"\)/);
  const resubmitBlock = script.match(/async function resubmitSleepingWork\(card, mode\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(resubmitBlock, /reviewState = "pending"/);
  assert.match(resubmitBlock, /submissionRound/);
  assert.match(resubmitBlock, /await saveStudioStateToCloud\(\)/);
  assert.doesNotMatch(resubmitBlock, /clearReviewLogs/);
  assert.match(script, /async function restoreWorkCard\(card\)[\s\S]*?await saveStudioStateToCloud\(\)/);
  assert.match(script, /#sleepManageRestore"\)\?\.addEventListener\("click", async \(\) =>[\s\S]*?await saveStudioStateToCloud\(\)/);
  assert.match(script, /const visibleInputs = choiceInputs\.filter/);
  assert.match(script, /const values = \[\.\.\.selected\]/);
  assert.match(script, /p\.owners = \[owner\]/);
  assert.match(script, /const cards = \[\.\.\.workCards\]\.filter\(\(card\) => !card\.classList\.contains\("deleted"\) && !isSleepingWork\(card\)\)/);
  assert.match(script, /if \(card\.classList\.contains\("deleted"\) \|\| isSleepingWork\(card\)\) return false/);
  assert.match(script, /return !isPersonalWorks \|\| personalWorkCardMatches\(card, role, ownerKey\)/);
  assert.match(styles, /\.personal-review-status\s*\{[\s\S]*?right:\s*10px;[\s\S]*?left:\s*auto/);
});

test("项目稿件复用作品库详情且作品名称支持权限内直接修改", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");
  const html = await read("index.html");
  assert.match(script, /data-pjd-pattern-open[\s\S]*?openLightbox\(card, \{ worksLibrary: true \}\)/);
  assert.match(script, /openLightbox\(previewCard, \{ worksLibrary: activeViewId\(\) === "designer" \}\)/);
  assert.match(script, /sleep-item[\s\S]*?openLightbox\(card, \{ worksLibrary: true \}\)/);
  assert.match(script, /openLightbox\(src, \{ nested: true, worksLibrary: lightboxWorksLibraryContext \}\)/);
  assert.match(script, /if \(!links\.length && !canEdit && !keepVisibleInWorksLibrary\) \{/);
  assert.match(script, /const normalizedReferenceText = String\(referenceText \|\| ""\)\.trim\(\)/);
  assert.match(script, /\\u2012\\u2013\\u2014\\u2015\\u2212\\uFE58\\uFE63\\uFF0D/);
  assert.doesNotMatch(html, /id="lightboxStatusList"/);
  assert.doesNotMatch(script, /lightboxStatusList/);
  assert.match(script, /worksLibrary = activeViewId\(\) !== "review"/);
  assert.match(script, /lightboxFile\.addEventListener\("click"/);
  assert.match(script, /card\.querySelector\("\.work-head strong"\)/);
  assert.match(script, /showToast\("作品名称已更新。", "success"\)/);
  assert.match(script, /data-lightbox-tag-remove=/);
  assert.match(script, /data-lightbox-tag-add/);
  assert.match(script, /showToast\(`已删除标签“\$\{tag\}”。`, "success"\)/);
  assert.match(styles, /\.lightbox-title-row h2\.lightbox-editable-title:hover/);
  assert.match(styles, /\.library-sort-row\s*\{[^}]*width:\s*auto;[^}]*max-width:\s*100%/);
  assert.match(styles, /\.visually-hidden\s*\{[^}]*width:\s*1px !important;[^}]*height:\s*1px !important/);
  assert.doesNotMatch(styles, /\.agr-file-row/);
  assert.match(styles, /\.lightbox-tag-remove:hover/);
  assert.match(styles, /\.lightbox-tag-add:hover/);
  assert.match(script, /worksTitle\.textContent = isSharedLibrary \? "作品库" : "我的稿件"/);
  assert.match(script, /function pjCustomerMatches\(project, company\)/);
  assert.match(script, /if \(p\.type === "定制"\) return pjCustomerMatches\(p, company\)/);
  assert.match(script, /customer-custom-badge/);
});

test("客户看稿复用大图缩放并提供触屏可见控件", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("styles.css");
  assert.match(html, /id="lightboxZoomControls"[\s\S]*?data-lightbox-zoom="out"[\s\S]*?data-lightbox-zoom="reset"[\s\S]*?data-lightbox-zoom="actual"[\s\S]*?data-lightbox-zoom="in"/);
  assert.match(script, /#lightboxZoomControls[\s\S]*?showActualPreviewPixels\(\)[\s\S]*?changeZoom\(button\.dataset\.lightboxZoom === "in" \? 0\.5 : -0\.5\)/);
  assert.match(script, /const pixelScale = lightboxImageFitScale\(\) \* previewZoom/);
  assert.match(styles, /\.lightbox\.viewer-clean \.lightbox-zoom-controls\s*\{\s*display:\s*flex/);
});

test("作品详情优先加载完整预览图并防止异步切换串图", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");
  const candidates = script.match(/function workImageCandidateKeys\(card, index = 0\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.ok(candidates.indexOf("workImage?.originalKey") < candidates.indexOf("workImage?.previewKey"));
  assert.ok(candidates.indexOf("workImage?.previewKey") < candidates.indexOf("card?.dataset.imageKey"));
  assert.match(candidates, /index === 0 \? \[[\s\S]*?\] : \[[\s\S]*?palettePreviewKey/);
  assert.match(script, /const requestId = \+\+previewImageRequestId/);
  assert.match(script, /requestId !== previewImageRequestId \|\| activeCard !== card \|\| activeMediaKind !== "palette" \|\| activeVariant !== variant/);
  assert.match(script, /function changeZoom\(delta\) \{[\s\S]*?Math\.max\(1,/);
  assert.match(script, /function changeZoomAtPointer\(delta, event\) \{[\s\S]*?Math\.max\(1,/);
  assert.match(styles, /#lightboxOriginalImage\s*\{[\s\S]*?object-fit:\s*scale-down/);
  assert.match(script, /setLightboxOriginalSource\(imageData\)/);
});

test("作品预览将作品图片与其他配色分区并复用媒体缩略图组件", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("tdesign-strict.css");
  assert.ok(html.indexOf('id="workImagePanel"') < html.indexOf('id="palettePanel"'));
  assert.match(html, /id="workImagePanel"[\s\S]*?<h3>图片<\/h3>[\s\S]*?id="workImageOptions"/);
  const entries = script.match(/function previewWorkImageEntries\(card\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(entries, /getWorkImageEntries\(card\)/);
  assert.doesNotMatch(entries, /getReferenceKeys|getLinkedSketches|getSourceFiles/);
  assert.match(script, /function createPreviewMediaOption/);
  assert.match(script, /function renderPaletteOptions\(card\)[\s\S]*?createPreviewMediaOption/);
  assert.match(script, /function renderWorkImageOptions\(card\)[\s\S]*?createPreviewMediaOption/);
  assert.match(script, /renderWorkImageOptions\(card\)[\s\S]*?createPreviewMediaAddOption\("添加图片"[\s\S]*?openUploadModal\(card\)/);
  assert.match(script, /id="cpvImages"[\s\S]*?id="cpvColors"/);
  assert.match(script, /class="palette-panel work-image-panel cpv-media-panel"[\s\S]*?<h3>图片<\/h3>[\s\S]*?id="cpvImages"/);
  assert.match(script, /class="palette-panel cpv-media-panel"[\s\S]*?<h3>其他配色<\/h3>[\s\S]*?id="cpvColors"/);
  assert.match(script, /class="cpv-side-scroll" id="cpvSideScroll"/);
  assert.match(script, /workImages\.forEach\([\s\S]*?createPreviewMediaOption/);
  assert.match(script, /activeCustomerMediaKind === "image"[\s\S]*?activateImage/);
  assert.match(styles, /:is\(#imageLightbox, #custPatternViewer\) \.lightbox-side :is\(\.palette-options, \.reference-preview-grid\)/);
  assert.match(styles, /:is\(#imageLightbox, #custPatternViewer\) \.lightbox-side :is\(\.palette-option, \.reference-preview, \.add-reference-button\)/);
  assert.match(styles, /#custPatternViewer \.cpv-side-scroll\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain/);
  assert.match(styles, /#custPatternViewer \.cpv-side\s*\{[\s\S]*?padding:\s*0 !important/);
  assert.match(styles, /#custPatternViewer \.cpv-cart-action\s*\{[\s\S]*?position:\s*static !important/);
});

test("选稿车缩略图使用持久图片源，不依赖作品卡片当前加载状态", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");
  const helper = script.match(/function cartPreviewImageMarkup\(card\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(helper, /cardPreviewSource\(card\)/);
  assert.match(helper, /data-image-key=/);
  assert.match(script, /function renderCartPreview\(\)[\s\S]*?hydrateLazyKeyImages\(cartPreviewList\)/);
  assert.match(script, /function renderLibraryCart\(\)[\s\S]*?hydrateLazyKeyImages\(libraryCartList\)/);
  assert.match(script, /function renderVlibSelectedPop\(\)[\s\S]*?hydrateLazyKeyImages\(pop\)/);
  assert.match(script, /function renderCartPage\(\)[\s\S]*?hydrateLazyKeyImages\(list\)/);
  assert.match(script, /function openPaymentPage\(order\)[\s\S]*?data-image-key=[\s\S]*?hydrateLazyKeyImages\(body\)/);
  assert.doesNotMatch(script, /data-cc-open-order/);
  assert.match(script, /viewerSession = JSON\.parse\(raw\)[\s\S]*?libraryCart = new Set\(viewerSession\.selectedPatternIds\)/);
  assert.match(script, /本次选稿中/);
  assert.match(script, /data-cart-remove-current/);
  assert.match(styles, /\.cart-thumb img,[\s\S]*?\.flower-line-thumb img[\s\S]*?object-fit:\s*cover/);
});

test("管理员作品库滚动分页复用缓存后的可见顺序", async () => {
  const script = await read("script.js");
  const batch = script.match(/function applyWorkGalleryBatch\(reset = false\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(script, /const WORK_RENDER_BATCH = 18/);
  assert.match(script, /let visibleWorkGalleryOrder = \[\]/);
  assert.match(batch, /const orderedCards = visibleWorkGalleryOrder/);
  assert.doesNotMatch(batch, /visibleWorkCards\(\)/);
  assert.match(script, /const targetCard = sourceCardByFile\(libraryCard\.dataset\.libraryFile\)/);
});

test("同类管理入口复用订单中心管理按钮组件", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("styles.css");
  assert.equal((html.match(/manage-control-primary/g) || []).length, 4);
  assert.match(styles, /\.manage-control-primary\s*\{[\s\S]*?background:\s*#111\s*!important/);
  assert.match(styles, /\.manage-control-primary:hover\s*\{[\s\S]*?transform:\s*translateY\(-1px\)/);
  assert.match(script, /libraryManageToggle\?\.addEventListener\("click"/);
  assert.match(script, /customerManageToggle"\)\?\.addEventListener\("click"/);
  assert.match(script, /sleepManageToggle"\)\?\.addEventListener\("click"/);
  assert.match(script, /orderManageToggle\?\.addEventListener\("click"/);
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

test("常用增删改、确认、上传与下载控件具备统一交互反馈", async () => {
  const styles = await read("styles.css");
  assert.match(styles, /操作反馈兜底/);
  for (const action of ["delete", "download", "upload", "edit", "confirm"]) {
    assert.ok(styles.includes(`button[class*="${action}"]`));
  }
  assert.match(styles, /transform:\s*translateY\(-1px\)/);
  assert.match(styles, /transform:\s*translateY\(0\) scale\(\.97\)/);
  assert.match(styles, /transition-delay:\s*0ms/);
  assert.match(styles, /transform 90ms cubic-bezier/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("通知记录与员工权限遵循角色边界", async () => {
  const script = await read("script.js");
  assert.match(script, /function recordActivityNotification/);
  assert.match(script, /type: "work-upload"/);
  assert.match(script, /type: "work-delete"/);
  assert.match(script, /type: "order-close"/);
  assert.match(script, /function activityIsVisibleToCurrentUser/);
  assert.match(script, /function canCreateProject\(\)/);
  assert.match(script, /function canManageTags\(\)/);
  assert.doesNotMatch(script, /设计师和手绘师上传稿件时必须关联已有项目/);
  assert.match(script, /currentUserSearchCanAccessWork/);
  assert.doesNotMatch(script.match(/function renderPainterPicker\(\)[\s\S]*?function openPainterPickerModal/)?.[0] || "", /painter-pick-tags/);
  assert.match(script, /item\.createdAt \|\| "未记录时间"/);
});

test("评审卡片操作对齐、成员业绩和通知折叠可用", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("styles.css");
  assert.match(html, /id="notificationClear"/);
  assert.match(script, /function memberPerformance/);
  assert.match(script, /function openTeamProjectsModal\(memberKey,\s*periodKey/);
  assert.match(script, /展开其余/);
  assert.match(script, /通知已清空/);
  assert.match(styles, /\.review-result-badge\s*\{[\s\S]*?top:\s*10px/);
  assert.match(styles, /\.review-work-card > \.work-trash-button,[\s\S]*?top:\s*10px/);
  assert.match(styles, /\.review-work-card\.reviewed > \.work-trash-button\s*\{\s*top:\s*46px/);
  assert.match(styles, /\.team-performance-modal/);
  assert.match(script, /function adminBusinessSnapshot/);
  assert.match(script, /function businessTrendBuckets/);
  assert.match(script, /function renderBusinessTrendPanel/);
  assert.match(script, /累计已支付成交额/);
  assert.match(script, /累计已售稿件/);
  assert.match(script, /作品产出/);
  assert.match(script, /data-dashboard-performance/);
  assert.match(script, /focusOrderFromTeamPerformance/);
  const performanceOrderJump = script.match(/function focusOrderFromTeamPerformance\(orderId\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(performanceOrderJump, /openOrderDetail/);
  assert.match(performanceOrderJump, /classList\.add\("is-located"\)/);
  assert.doesNotMatch(script, /openOrderDetail/);
  assert.match(script, /data-business-range/);
  assert.match(styles, /\.business-overview-panel/);
  assert.match(styles, /\.business-line-chart/);
  assert.match(styles, /\.business-trend-panel/);
  assert.match(styles, /\.business-bottom-grid/);
  assert.match(script, /data-team-insight="rank"/);
  assert.match(styles, /\.employee-load-panel \.business-rank-list button > i > u\s*\{\s*background:\s*#22c55e/);
  assert.match(html, /id="teamOutputRanking"/);
  assert.match(html, /id="teamOutputRankingModal"/);
  assert.match(script, /全员作品产出排行/);
  assert.match(script, /data-team-ranking-open/);
  assert.match(script, /data-team-overview="hot"/);
  assert.match(script, /teamHighLoadOnly/);
  assert.match(styles, /\.team-output-ranking-list/);
  assert.match(script, /const pageSize = 14/);
  assert.match(styles, /\.team-output-pagination/);
  assert.match(html, /id="teamOutputPagination"/);
  assert.match(script, /const previewTeamMembers = \[/);
  assert.match(script, /preview_designer_10/);
  assert.match(script, /preview_painter_08/);
});

test("销售状态在作品页统一筛选且已支付花型退出客户看稿库", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");
  const soldFilesHelper = script.match(/function soldPatternFiles\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const galleryRenderer = script.match(/function renderVlibGallery\(reset = false\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(soldFilesHelper, /directSoldDesignFiles\(\)/);
  assert.match(script.match(/function directSoldDesignFiles\(\) \{[\s\S]*?\n\}/)?.[0] || "", /paymentStatus === "已支付"/);
  assert.match(script, /data-lib-sales-status/);
  assert.match(script, /\["管理员", "设计师", "手绘师"\]\.includes\(currentAccount\.role\)/);
  assert.match(script, /librarySalesStatus === "已售出" \? soldFiles\.has\(card\.dataset\.file\) : !soldFiles\.has\(card\.dataset\.file\)/);
  assert.match(styles, /\.works-sticky-head \.library-filter-bar\s*\{[\s\S]*?flex-wrap:\s*nowrap/);
});

test("设计师产出图表提供日期悬停数据且榜单头像不重叠", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");

  assert.match(script, /class="designer-chart-tooltip" role="tooltip"/);
  assert.match(script, /dateLabel:/);
  assert.match(script, /<h3>作品产出<\/h3>/);
  assert.doesNotMatch(script.match(/function renderDesignerDashboard\([^)]*\)[\s\S]*?function renderCreativeDashboard/)?.[0] || "", /作品产出排行榜|前 7 名 · 仅展示/);
  assert.match(styles, /\.designer-bar-group:hover \.designer-chart-tooltip/);
  assert.match(styles, /\.designer-ranking-list \.team-avatar/);
  assert.match(styles, /\.designer-main-grid\s*\{[^}]*align-items:\s*stretch/);
});

test("销售订单链路不含协议，金额与搜索遵循当前业务规则", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("styles.css");

  assert.doesNotMatch(`${html}\n${script}\n${styles}`, /agreementStatus|deliveryAgreement|交付协议|待签约|签署文件/);
  assert.match(script, /function moneyToCents/);
  assert.match(script, /function centsToMoney/);
  assert.match(script, /function sumMoney/);
  assert.match(script, /totalCents - baseCents \* patterns\.length/);
  assert.match(script, /order\.price = sumMoney\(order\.patternIds\.map/);
  assert.match(script, /function canEditOrderPatterns\(order\)[\s\S]*?orderDeliverStatus\(order\) !== "已交付"/);
  assert.match(script, /order\.id,\s*order\.customer,\s*order\.viewer/);
  assert.match(script, /const perType = new Map\(\)/);
  assert.match(script, /function pjOpenForm\(edit, draft = null, options = \{\}\) \{[\s\S]*?if \(!canCreateProject\(\)\)/);
  assert.match(script, /没有匹配的项目<\/p>\$\{canCreateProject\(\) \?/);
  assert.match(script, /if \(createButton\) \{\s*if \(!canCreateProject\(\)\)/);
  assert.match(script, /function pullBackendStudioState/);
  assert.match(script, /function pushBackendStudioModules/);
  assert.match(script, /function startNasStudioPolling/);
  assert.match(script, /error\.status !== 409/);
  assert.match(script, /if \(!RELEASE_CONFIG\.useBackendAuth && window\.kingNas\?\.syncWrite\)/);
  assert.match(styles, /\.oc-order-card\s*\{[\s\S]*?border-radius:\s*var\(--td-radius-m\)/);
  assert.match(styles, /\.oc-stage-row span[^}]*border-radius:\s*var\(--td-radius-s\)/);
  const strictStyles = await read("tdesign-strict.css");
  assert.match(strictStyles, /#pjFormMemberOv,[\s\S]*?z-index:\s*4100/);
  assert.match(strictStyles, /\.pj-file-preview-overlay\s*\{\s*z-index:\s*4200/);
});

test("员工账号弹窗保护编辑过程，并提供详情与密码复制", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("styles.css");

  assert.match(html, /id="employeeAccountPassword" type="text" autocomplete="off"/);
  assert.doesNotMatch(html, /id="employeeAccountPassword"[^>]*(minlength|maxlength)/);
  assert.match(script, /employeeAccountModal\?\.classList\.contains\("active"\)/);
  assert.match(script, /function openTeamMemberDetail\(memberKey\)/);
  assert.match(script, /data-team-member-edit/);
  assert.match(script, /openEmployeeAccountModal\(member\)/);
  assert.match(script, /data-team-member-detail[\s\S]*?openTeamMemberDetail/);
  assert.match(script, /<h3>作品产出<\/h3>/);
  assert.match(script, /projectsButton\.dataset\.teamProjects\);/);
  assert.match(script, /加入时间/);
  assert.match(script, /data-employee-copy/);
  assert.match(script, /data-team-member-copy/);
  assert.match(script, /if \(password && password\.length < 8\)/);
  assert.match(script, /登录密码至少需要 8 位/);
  assert.match(script, /if \(employeeAccountSubmitting && !force\) return/);
  assert.match(script, /employeeAccountUsername\.readOnly = Boolean\(member\)/);
  assert.doesNotMatch(script, /employeeAccountModal\?\.addEventListener\("click"/);
  assert.match(script, /provisioned = await provisionBackendEmployeeAccount[\s\S]*?teamMembers\.push\(member\)/);
  assert.match(script, /showAppLoading\(wasEditing \? "正在保存员工账号" : "正在创建员工账号", \{ progress: true \}\)/);
  assert.match(script, /setAppLoadingProgress\(86, "正在同步员工资料到云端…"\)/);
  assert.match(script, /showAppLoading\(`正在创建 \$\{results\.length\} 个员工账号`, \{ progress: true \}\)/);
  assert.match(styles, /\.team-member-cell \.team-avatar\s*\{\s*flex:\s*0 0 30px/);
  assert.match(styles, /\.team-member-detail-modal/);
});

test("稿件删除遵循订单交付状态并保留订单历史", async () => {
  const html = await read("index.html");
  const script = await read("script.js");
  const styles = await read("styles.css");

  assert.match(script, /function ordersContainingWork\(file\)/);
  assert.match(script, /function undeliveredOrdersForWork\(file\)[\s\S]*?orderDeliverStatus\(order\) !== "已交付"/);
  assert.match(script, /function ensureWorksCanMoveToRecycle\(cards\)[\s\S]*?title: "稿件暂时不能删除"[\s\S]*?singleAction: true/);
  assert.match(script, /async function deleteWorkCard\(card\)[\s\S]*?ensureWorksCanMoveToRecycle\(\[card\]\)/);
  assert.match(script, /libraryManageDelete\?\.addEventListener[\s\S]*?ensureWorksCanMoveToRecycle\(cards\)/);
  assert.match(script, /#sleepManageDelete[\s\S]*?ensureWorksCanMoveToRecycle\(cards\)/);
  assert.match(script, /function permanentlyRemoveWorkCards\(cards\)[\s\S]*?ordersContainingWork\(file\)\.length/);
  assert.match(script, /title: "警告：从订单移除稿件"/);
  assert.match(script, /此操作只会解除该稿件与当前订单的关系并重新计算金额，不会删除作品库原稿/);
  assert.match(script, /worksBoard\?\.classList\.toggle\("sales-readonly-library", role === "销售"\)/);
  assert.match(styles, /\.works-board\.sales-readonly-library \.work-card > \.work-trash-button/);
  assert.match(html, /data-view="sleep" data-roles="管理员,设计师"/);
  assert.match(html, /data-view="recycle" data-roles="管理员,设计师"/);
  assert.doesNotMatch(html, /data-view="(?:sleep|recycle)" data-roles="[^"]*手绘师/);
  assert.match(script, /if \(currentAccount\.role === "设计师"\) \{[\s\S]*?setPersonalArchiveState\(card, "delete", true\)/);
  assert.match(script, /function markWorkDeletedGlobally\(card/);
  assert.match(script, /currentAccount\.role === "手绘师"[\s\S]*?删除后将立即从“我的稿件”移除/);
  assert.match(script, /libraryManageSleep\?\.classList\.toggle\("hidden", !libraryManageMode \|\| currentAccount\.role === "手绘师"\)/);
  const worksView = script.match(/function configureWorksView\([^)]*\) \{[\s\S]*?function personalWorkCardMatches/)?.[0] || "";
  assert.ok(worksView.indexOf('card.classList.contains("deleted")') < worksView.indexOf("isPersonalWorks && isCreatorRole(role)"));
});

test("管理员待评审稿件在侧栏标题旁显示状态红点", async () => {
  const script = await read("script.js");
  const styles = await read("styles.css");

  assert.match(script, /const pendingReviewCount = currentAccount\.role === "管理员"/);
  assert.match(script, /statusDot\("review", pendingReviewCount > 0/);
  assert.match(script, /renderDailyReviewBoard\(\)[\s\S]*?updateSidebarBadges\(\)/);
  assert.match(styles, /\.nav-item\.has-status-dot \.nav-label::after\s*\{[\s\S]*?background:\s*#d54941/);
});
