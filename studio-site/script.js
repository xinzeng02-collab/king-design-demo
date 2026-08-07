
/* ===================================================================
   「项目进度」模块已整体移除（准备重做）。
   下面是最小兼容桩：仅供尚未清理的旧调用点安全降级，不含任何业务逻辑。
   重做项目进度时，请删除本段并实现真正的函数。
   =================================================================== */
const PROJECT_MODULE_REMOVED = true;

/* ===================================================================
   项目管理 · 数据层
   =================================================================== */
const PJ_STAGES = [
  { key: "需求确认", color: "#64748b" },
  { key: "概念方案", color: "#2563eb" },
  { key: "设计制作", color: "#7c3aed" },
  { key: "稿件评审", color: "#d97706" },
  { key: "修改完善", color: "#dc2626" },
  { key: "内部定稿", color: "#168a4a" },
];
const PJ_KEY = "studio_site_projects_v1";
const PJ_DRAFT_KEY_V2 = "studio_site_project_drafts_v2";
let pjProjects = [];
let pjProjectDrafts = [];
let pjLevel = "project";
let pjActiveId = null;
const pjPendingPatternRemovals = new Map();
let pjPendingCustomerLink = null;

function pjLoad() {
  try { pjProjects = JSON.parse(localStorage.getItem(PJ_KEY) || "[]"); } catch { pjProjects = []; }
  if (!Array.isArray(pjProjects)) pjProjects = [];
  try { pjProjectDrafts = JSON.parse(localStorage.getItem(PJ_DRAFT_KEY_V2) || "[]"); } catch { pjProjectDrafts = []; }
  if (!Array.isArray(pjProjectDrafts)) pjProjectDrafts = [];
}
function pjSave() {
  // 项目管理和共享工作区必须使用同一份数据，避免只写本机项目缓存。
  customProjects = Array.isArray(pjProjects) ? pjProjects : [];
  try { localStorage.setItem(PJ_KEY, JSON.stringify(pjProjects)); } catch {}
  // 项目管理原先只写本机 localStorage，必须同时进入 NAS 同步状态。
  if (typeof saveStudioState === "function") saveStudioState();
}
function pjSaveDrafts() {
  try { localStorage.setItem(PJ_DRAFT_KEY_V2, JSON.stringify(pjProjectDrafts)); } catch {}
  if (typeof saveStudioState === "function") saveStudioState();
}
function pjById(id) { return pjProjects.find((p) => p.id === id) || null; }
function pjMe() { return currentAccount.ownerKey || currentAccount.name || "me"; }

/** 未读：每人独立。有人上传/推进后，其他成员该项目冒红点 */
function pjUnreadCount(p) {
  const me = pjMe();
  return (p.feed || []).filter((f) => f.by !== me && !(p.seen || {})[me + "|" + f.id]).length;
}
function pjMarkSeen(p) {
  const me = pjMe();
  p.seen = p.seen || {};
  (p.feed || []).forEach((f) => { p.seen[me + "|" + f.id] = 1; });
  pjSave();
}
function pjPush(p, text, kind = "info") {
  p.feed = p.feed || [];
  p.feed.unshift({ id: `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`, t: formatDateTime(), by: pjMe(), byName: currentAccount.name || "成员", text, kind });
  if (p.feed.length > 60) p.feed.length = 60;
  p.updatedAt = formatDateTime();
}

/* ---- 截止日与逾期 ---- */
function pjDaysLeft(p) {
  if (!p.deadline) return null;
  const d = new Date(p.deadline + "T23:59:59");
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}
function pjDueBadge(p) {
  const d = pjDaysLeft(p);
  if (d === null) return "";
  if (p.archived) return "";
  if (d < 0) return `<span class="pj-due over">已逾期 ${-d} 天</span>`;
  if (d === 0) return `<span class="pj-due warn">今天截止</span>`;
  if (d <= 7) return `<span class="pj-due warn">还剩 ${d} 天</span>`;
  return `<span class="pj-due">还剩 ${d} 天</span>`;
}
function pjIsOverdue(p) {
  const days = pjDaysLeft(p);
  return !p.archived && !p.completed && days !== null && days < 0;
}

/* ---- 权限 ---- */
function pjIsBoss() { return currentAccount.role === "管理员" || currentAccount.role === "老板"; }
function pjOwners(p) {
  return [...new Set([...(Array.isArray(p?.owners) ? p.owners : []), p?.owner].filter(Boolean))];
}
function pjIsOwner(p, identity = pjMe()) {
  return pjOwners(p).includes(identity);
}
function pjCanDrag(p, toStage) {
  if (pjIsBoss()) return true;
  const me = pjMe();
  if (!pjIsOwner(p, me)) return false;
  if (toStage === "内部定稿") return false;        // 只有管理员能定稿
  return true;
}
function pjMoveProjectStage(projectId, toStage) {
  const project = pjById(projectId);
  if (!project || !PJ_STAGES.some((stage) => stage.key === toStage)) return { ok: false, reason: "invalid" };
  if (!pjCanDrag(project, toStage)) return { ok: false, reason: toStage === "内部定稿" ? "final" : "permission" };
  if (project.stage === toStage) return { ok: true, unchanged: true, project };
  project.stage = toStage;
  pjPush(project, `阶段推进到「${toStage}」`, "ok");
  pjSave();
  return { ok: true, project };
}

/* ---- 任务 ---- */
function pjTaskStats(p) {
  const t = p.tasks || [];
  return { done: t.filter((x) => x.done).length, total: t.length };
}

/* ---- 关联稿件（上传时选填）---- */
function pjPatternsOf(p) {
  return [...workCards].filter((c) => c.dataset.projectId === p.id && !c.classList.contains("deleted"));
}
function pjFileType(file) {
  const ext = String(file?.name || "").split(".").pop();
  return ext && ext !== file?.name ? ext.toUpperCase() : (file?.type || "FILE").split("/").pop().toUpperCase();
}
function pjCrc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
function pjZipBlob(entries) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const u16 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255]);
  const u32 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
  entries.forEach((entry) => {
    const name = encoder.encode(entry.name || "file");
    const data = new Uint8Array(entry.data);
    const crc = pjCrc32(data);
    const local = [
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
    ];
    local.forEach((part) => parts.push(part));
    central.push([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    offset += local.reduce((sum, part) => sum + part.length, 0);
  });
  const centralSize = central.flat().reduce((sum, part) => sum + part.length, 0);
  central.forEach((record) => record.forEach((part) => parts.push(part)));
  parts.push(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralSize), u32(offset), u16(0));
  return new Blob(parts, { type: "application/zip" });
}
async function pjDownloadFileSet(files, zipName) {
  const available = (files || []).filter((file) => file?.key);
  if (!available.length) {
    showToast("没有可下载的项目文件。", "warning");
    return;
  }
  if (available.length === 1) {
    await downloadStoredFile(available[0].key, available[0].name);
    return;
  }
  try {
    const entries = [];
    for (const file of available) {
      const source = await resolveImageSource(file.key);
      if (!source) continue;
      const response = await fetch(source);
      entries.push({ name: file.name || "file", data: await response.arrayBuffer() });
    }
    if (!entries.length) throw new Error("No files");
    const url = URL.createObjectURL(pjZipBlob(entries));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${zipName || "项目文件"}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (error) {
    console.error(error);
    showToast("打包下载失败，请重试。", "warning");
  }
}

async function pjDownloadProjectArchive(project, trigger) {
  const available = (project?.files || []).filter((file) => file?.key);
  if (!available.length || trigger?.disabled) {
    showToast("没有可下载的项目文件。", "warning");
    return;
  }
  const rootName = safePackagePathPart(project.name, "项目文件");
  const originalLabel = trigger?.innerHTML || "";
  if (trigger) {
    trigger.disabled = true;
    trigger.textContent = "正在打包…";
  }
  try {
    const entries = [];
    const usedNames = new Map();
    for (const file of available) {
      const source = await resolveImageSource(file.key);
      if (!source) continue;
      const response = await fetch(source);
      if (!response.ok && response.status) continue;
      const formatFolder = packageFileExtension(file);
      const rawName = safePackagePathPart(file.name, `文件.${formatFolder.toLowerCase()}`);
      const identity = `${formatFolder}/${rawName}`;
      const duplicateIndex = (usedNames.get(identity) || 0) + 1;
      usedNames.set(identity, duplicateIndex);
      const dot = rawName.lastIndexOf(".");
      const uniqueName = duplicateIndex === 1
        ? rawName
        : dot > 0
          ? `${rawName.slice(0, dot)}-${duplicateIndex}${rawName.slice(dot)}`
          : `${rawName}-${duplicateIndex}`;
      entries.push({
        name: `${rootName}/${formatFolder}/${uniqueName}`,
        data: await response.arrayBuffer(),
      });
    }
    if (!entries.length) throw new Error("No files");
    const url = URL.createObjectURL(pjZipBlob(entries));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${rootName}-项目文件.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(`已按文件格式打包 ${entries.length} 个项目文件。`, "success");
  } catch (error) {
    console.error(error);
    showToast("项目文件打包失败，请重试。", "warning");
  } finally {
    if (trigger?.isConnected) {
      trigger.disabled = false;
      trigger.innerHTML = originalLabel;
    }
  }
}

async function pjOpenFilePreview(file) {
  if (!file?.key || !String(file.type || "").startsWith("image/")) return;
  const source = await resolveImageSource(file.key);
  if (!source) {
    showToast("图片预览加载失败。", "warning");
    return;
  }
  let overlay = document.getElementById("pjFilePreviewOv");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pjFilePreviewOv";
    overlay.className = "pj-file-preview-overlay";
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<button class="pj-file-preview-backdrop" type="button" aria-label="关闭预览"></button>
    <figure class="pj-file-preview-dialog">
      <img src="${escapeHtml(source)}" alt="${escapeHtml(file.name || "项目图片")}" width="800" height="600" />
      <figcaption>${escapeHtml(file.name || "项目图片")}</figcaption>
      <button class="pj-file-preview-close" type="button" aria-label="关闭预览">×</button>
    </figure>`;
  const close = () => {
    overlay.classList.remove("active");
    lockBodyScroll(false);
  };
  overlay.querySelector(".pj-file-preview-backdrop")?.addEventListener("click", close);
  overlay.querySelector(".pj-file-preview-close")?.addEventListener("click", close);
  overlay.classList.add("active");
  lockBodyScroll(true);
}

function safePackagePathPart(value, fallback = "未命名") {
  const clean = String(value || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return clean || fallback;
}

function packageFileExtension(file) {
  const nameMatch = String(file?.name || "").match(/\.([a-z0-9]{1,12})$/i);
  let extension = nameMatch?.[1]?.toUpperCase() || "";
  if (!extension) {
    const mime = String(file?.type || "").toLowerCase();
    const byMime = {
      "image/jpeg": "JPEG",
      "image/jpg": "JPEG",
      "image/png": "PNG",
      "image/tiff": "TIFF",
      "image/vnd.adobe.photoshop": "PSD",
      "application/pdf": "PDF",
    };
    extension = byMime[mime] || mime.split("/").pop()?.toUpperCase() || "其他文件";
  }
  if (extension === "JPG" || extension === "JPE") return "JPEG";
  if (extension === "TIF") return "TIFF";
  return safePackagePathPart(extension, "其他文件");
}

function orderPatternPackageFiles(card) {
  if (!card) return [];
  const files = [
    ...getWorkImageEntries(card).map((file, index) => ({
      name: file.name || `${card.dataset.file || "稿件"}-${index + 1}.${packageFileExtension(file).toLowerCase()}`,
      key: file.originalKey || file.previewKey || file.thumbKey,
      type: file.type || "image/jpeg",
    })),
    ...getPaletteFiles(card),
    ...getSourceFiles(card),
  ];
  const seen = new Set();
  return files.filter((file) => {
    const identity = file?.key || `${file?.name || ""}:${file?.type || ""}`;
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return Boolean(file?.key);
  });
}

function setOrderPackageProgress(percent, text) {
  const overlay = document.getElementById("orderPackageOverlay");
  const bar = document.getElementById("orderPackageProgressBar");
  const count = document.getElementById("orderPackageProgressCount");
  const label = document.getElementById("orderPackageProgressText");
  const track = overlay?.querySelector('[role="progressbar"]');
  const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  if (bar) bar.style.width = `${value}%`;
  if (count) count.textContent = `${value}%`;
  if (label && text) label.textContent = text;
  track?.setAttribute("aria-valuenow", String(value));
}

function showOrderPackageProgress() {
  const overlay = document.getElementById("orderPackageOverlay");
  if (!overlay) return;
  setOrderPackageProgress(0, "正在整理稿件文件…");
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function hideOrderPackageProgress() {
  const overlay = document.getElementById("orderPackageOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
}

function waitForPackageProgressPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function downloadOrderPackage(orderId, trigger) {
  const order = studioOrders.find((item) => item.id === orderId);
  if (!order || trigger?.disabled) return;
  const patterns = orderPatternList(order);
  const packageFileTotal = patterns.reduce((total, fileId) => {
    return total + orderPatternPackageFiles(sourceCardByFile(fileId)).length;
  }, 0);
  const originalLabel = trigger?.innerHTML || "";
  if (trigger) {
    trigger.disabled = true;
    trigger.classList.add("is-loading");
    trigger.textContent = "正在打包…";
  }
  showOrderPackageProgress();
  await waitForPackageProgressPaint();
  try {
    const entries = [];
    let processedFileCount = 0;
    const rootName = safePackagePathPart(order.id, "订单文件");
    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex += 1) {
      const fileId = patterns[patternIndex];
      const card = sourceCardByFile(fileId);
      const workName = card?.querySelector(".work-head strong")?.textContent.trim()
        || card?.querySelector(".file-name")?.textContent.trim()
        || fileId
        || `稿件-${patternIndex + 1}`;
      const workFolder = safePackagePathPart(workName, `稿件-${patternIndex + 1}`);
      const usedNames = new Map();
      for (const file of orderPatternPackageFiles(card)) {
        setOrderPackageProgress(
          packageFileTotal ? 8 + (processedFileCount / packageFileTotal) * 76 : 8,
          `正在读取 ${workName} · ${file.name || "稿件文件"}`,
        );
        const source = await resolveImageSource(file.key);
        if (!source) {
          processedFileCount += 1;
          continue;
        }
        const response = await fetch(source);
        if (!response.ok && response.status) {
          processedFileCount += 1;
          continue;
        }
        const formatFolder = packageFileExtension(file);
        const rawName = safePackagePathPart(file.name, `${workFolder}.${formatFolder.toLowerCase()}`);
        const uniqueKey = `${workFolder}/${formatFolder}/${rawName}`;
        const duplicateIndex = (usedNames.get(uniqueKey) || 0) + 1;
        usedNames.set(uniqueKey, duplicateIndex);
        const dot = rawName.lastIndexOf(".");
        const uniqueName = duplicateIndex === 1
          ? rawName
          : dot > 0
            ? `${rawName.slice(0, dot)}-${duplicateIndex}${rawName.slice(dot)}`
            : `${rawName}-${duplicateIndex}`;
        entries.push({
          name: `${rootName}/${workFolder}/${formatFolder}/${uniqueName}`,
          data: await response.arrayBuffer(),
        });
        processedFileCount += 1;
      }
    }
    if (!entries.length) {
      setOrderPackageProgress(100, "没有找到可打包的文件");
      showToast("该订单暂时没有可打包下载的文件。", "warning");
      return;
    }
    setOrderPackageProgress(90, `正在生成 ZIP · 共 ${entries.length} 个文件`);
    await waitForPackageProgressPaint();
    const url = URL.createObjectURL(pjZipBlob(entries));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${rootName}-稿件文件.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setOrderPackageProgress(100, "打包完成，下载已开始");
    showToast(`已按稿件和文件格式打包 ${entries.length} 个文件。`, "success");
  } catch (error) {
    console.error(error);
    setOrderPackageProgress(100, "打包失败，请稍后重试");
    showToast("订单文件打包失败，请稍后重试。", "error");
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 420));
    hideOrderPackageProgress();
    if (trigger?.isConnected) {
      trigger.disabled = false;
      trigger.classList.remove("is-loading");
      trigger.innerHTML = originalLabel;
    }
  }
}

function pjPatternStage(card) {
  return card.dataset.pjStage || "每日新稿";
}
// 旧页面仍会读取项目统计；统一桥接到新版项目管理数据。
function activeProjectItems() {
  return (pjProjects || []).filter((project) => !project.archived);
}
function memberProjectItems(member) {
  if (!member) return [];
  const identities = [member.ownerKey, member.name].filter(Boolean);
  return activeProjectItems().filter((project) => {
    const participants = [...pjOwners(project), ...(project.members || [])].filter(Boolean);
    return participants.some((value) => identities.includes(value));
  });
}
function riskProjectPeople(project) {
  if (!project) return "待分配";
  const identities = [...pjOwners(project), ...(project.members || [])].filter(Boolean);
  const names = identities.map((key) => {
    const member = teamMembers?.find((item) => item.ownerKey === key || item.name === key);
    return member?.name || key;
  });
  return [...new Set(names)].join("、") || "待分配";
}
function projectOptions() {
  return activeProjectItems().map((project) => project.name).filter(Boolean);
}
function projectOwnerNames(project) {
  if (!project) return [];
  return pjOwners(project).map((identity) => teamMembers?.find((member) => member.ownerKey === identity)?.name || identity);
}
function projectFileEntries(project) {
  return Array.isArray(project?.files) ? project.files : [];
}
function projectMemberCandidates(role = "") {
  return (teamMembers || []).filter((member) => !role || member.role === role);
}
function loadProjectDrafts() {
  pjLoad();
  return pjProjectDrafts;
}
// 返回对象/字符串的
function activeProject() { return pjById(activeProjectId); }
function workProjectName(card) {
  const project = pjById(card?.dataset?.projectId);
  return project?.name || card?.querySelector(".work-body > p")?.textContent?.replace(/^项目：/, "").trim() || "";
}
function projectMemberRoleLabel(r) { return r || ""; }
function formatProjectDateInput(v) { return v || ""; }
function normalizeProjectLifecycleProject(p) { return p; }
function canManageProjectLifecycle(project) {
  return Boolean(project && (pjIsBoss() || pjIsOwner(project)));
}
// 无副作用的空操作
function syncProjectLibrary() {}
function syncProjectMemberOptions() {}
function normalizeProjectLifecycleData() {}
function renderCustomProjects() {}
function renderProjectResults() {}
function renderLinkedProjects() {}
function renderProjectTypeFilterSummary() {}
function renderProjectStatusOptions() {}
function renderProjectTypeOptions() {}
function renderProjectCustomerOptions() {}
function renderProjectDetailMemberSelection() {}
function renderProjectFileReadout() {}
function renderProjectFileManager() {}
function renderProjectFileViewer() {}
function updateProjectMemberSummaries() {}
function updateCardProject() {}
function saveProjectDrafts() {}
function saveCreateProjectDraft() {}
function saveProjectDetailDraft() {}
function saveProjectDetailChanges() {}
function restoreProjectDraft() {}
function deleteProject() {}
function refreshProjectDetail() {}
function mergeProjectFiles(a) { return a || []; }
function projectStoredFileName(item) { return (item && (item.name || item.fileName)) || ""; }
function chooseProjectCustomer() {}
function createDefaultProjectCustomer() {}
function setProjectCustomerOpen() {}
function clearProjectValidation() {}
function createProjectFromModal() {}
function attachProjectDetailFiles() {}
function downloadProjectFile() {}
function removeProjectFileByEntryId() {}
function applyProjectFileTransform() {}
function resetProjectFileTransform() {}
function changeProjectFileZoom() {}
function openProjectFileViewer() {}
function closeProjectFileViewer() {}
function closeProjectFileManager() {}
function openProjectCreateModal() {
  pjOpenForm(null);
}
function requestCloseProjectCreateModal() {}
function openProjectDetail() {}
function closeProjectDetailModal() {}
function requestCloseProjectDetailModal() {}
function closeProjectDraftBox() {}
function closeProjectArchiveModal() {}
function openProjectLifecycleModal() {}
function closeProjectLifecycleModal() {}
function handleProjectLifecycleAction() {}
function submitProjectLifecycleAction() {}
function memberPerformance(member) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const periods = [
    { key: "today", label: "今日", start: startOfDay },
    { key: "week", label: "本周", start: startOfWeek },
    { key: "month", label: "本月", start: startOfMonth },
    { key: "total", label: "累计", start: null },
  ];
  const ownFiles = new Set(memberWorkItems(member).map((card) => card.dataset.file));
  const contributionEvents = soldContributionEvents();
  const orders = studioOrders.filter((order) => order.paymentStatus === "已支付").map((order) => {
    const files = orderPatternList(order);
    const ownCount = contributionEvents.filter((event) => event.order === order && ownFiles.has(event.file)).length;
    if (!ownCount) return null;
    const total = Math.max(1, files.length);
    const amount = Number(orderPriceValue(order) || 0) * (ownCount / total);
    return { order, ownCount, amount, at: new Date(order.paidAt || order.createdAt || order.time || 0) };
  }).filter(Boolean);
  return {
    orders,
    periods: periods.map((period) => {
      const rows = orders.filter((entry) => !period.start || (!Number.isNaN(entry.at.getTime()) && entry.at >= period.start));
      return {
        ...period,
        works: rows.reduce((sum, entry) => sum + entry.ownCount, 0),
        amount: rows.reduce((sum, entry) => sum + entry.amount, 0),
        orders: rows.length,
        entries: rows,
      };
    }),
  };
}

function openTeamProjectsModal(memberKey, periodKey = "total") {
  const member = teamMembers.find((item) => item.ownerKey === memberKey || item.name === memberKey);
  if (!member) return;
  const performance = memberPerformance(member);
  let overlay = document.querySelector("#teamPerformanceModal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "teamPerformanceModal";
    overlay.className = "team-performance-modal";
    overlay.innerHTML = `<button class="team-performance-backdrop" type="button" data-team-performance-close aria-label="关闭"></button><aside class="team-performance-drawer"><button class="modal-close" type="button" data-team-performance-close aria-label="关闭">×</button><div data-team-performance-body></div></aside>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (event) => {
      if (event.target.closest("[data-team-performance-close]")) closeTeamProjectsModal();
      const periodButton = event.target.closest("[data-team-performance-period]");
      if (periodButton) openTeamProjectsModal(overlay.dataset.memberKey, periodButton.dataset.teamPerformancePeriod);
      const orderButton = event.target.closest("[data-team-performance-order]");
      if (orderButton) focusOrderFromTeamPerformance(orderButton.dataset.teamPerformanceOrder);
    });
  }
  overlay.dataset.memberKey = member.ownerKey;
  const body = overlay.querySelector("[data-team-performance-body]");
  const stats = teamMemberStats(member);
  const selectedPeriod = performance.periods.find((period) => period.key === periodKey) || performance.periods.at(-1);
  body.innerHTML = `
    <p class="eyebrow">MEMBER PERFORMANCE</p>
    <h2>${escapeHtml(member.name)}的作品产出</h2>
    <p class="team-performance-role">${escapeHtml(member.role)} · 当前参与 ${stats.projects.length} 个项目</p>
    <section class="team-performance-grid">${performance.periods.map((period) => `<button type="button" class="${period.key === selectedPeriod.key ? "active" : ""}" data-team-performance-period="${period.key}"><span>${period.label}已售</span><strong>${period.works}<small>稿</small></strong><em>${period.orders} 笔已支付订单</em></button>`).join("")}</section>
    <section class="team-performance-list"><h3>${selectedPeriod.label}已售稿件记录</h3>${selectedPeriod.entries.length ? selectedPeriod.entries.map(({ order, ownCount }) => `<button type="button" class="team-performance-order" data-team-performance-order="${escapeHtml(order.id)}"><div><strong>${escapeHtml(order.id)}</strong><span>${escapeHtml(order.customer || "未设置客户")} · ${escapeHtml(order.paidAt || order.createdAt || order.time || "未记录时间")}</span></div><div><b>${ownCount} 稿已售</b><em aria-hidden="true">→</em></div></button>`).join("") : `<p>该时间范围内暂无已支付订单记录。</p>`}</section>`;
  overlay.classList.add("active");
  overlay.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeTeamProjectsModal() {
  const overlay = document.querySelector("#teamPerformanceModal");
  overlay?.classList.remove("active");
  overlay?.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

function focusOrderFromTeamPerformance(orderId) {
  closeTeamProjectsModal();
  switchView("orders");
  if (orderSearch) orderSearch.value = orderId;
  renderOrderCenter();
  requestAnimationFrame(() => {
    const target = [...orderList.querySelectorAll("[data-order-card]")].find((card) => card.dataset.orderCard === orderId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("is-located");
    window.setTimeout(() => target.classList.remove("is-located"), 1800);
  });
}
function renderProjectArchiveList() {}
function openProjectArchiveModal() {}
function openProjectDraftBox() {}
function addProjectNoteLog() {}
function projectStage(p) { return (p && (p.stage || p.status)) || ""; }
/* ===================================================================
   项目管理 · 渲染
   =================================================================== */
function pjAvatars(keys, max = 2) {
  const list = (keys || []).slice(0, max);
  const extra = (keys || []).length - list.length;
  return `<span class="pj-avs">${list.map((k) => {
    const member = (typeof teamMembers !== "undefined" && Array.isArray(teamMembers))
      ? teamMembers.find((item) => item.ownerKey === k || item.name === k)
      : null;
    const n = member?.name || (typeof workOwnerName === "function" ? workOwnerName({ dataset: { workOwner: k } }) : k) || k;
    return `<i class="pj-av" title="${escapeHtml(n)}">${escapeHtml(String(n).slice(0, 1))}</i>`;
  }).join("")}${extra > 0 ? `<i class="pj-av more">+${extra}</i>` : ""}</span>`;
}

function pjFiltered() {
  return pjProjects.filter((p) => !p.archived);
}

function pjCardHtml(p) {
  const unread = pjUnreadCount(p);
  const pats = pjPatternsOf(p);
  const projectMembers = Array.isArray(p.members)
    ? p.members
    : String(p.members || "").split(/[、,，]/).map((name) => name.trim()).filter(Boolean);
  const coverFile = (p.files || []).find((file) => file?.key && String(file.type || "").startsWith("image/"));
  const coverCard = pats[0] || null;
  const cover = coverFile ? "" : (coverCard ? cardPreviewSource(coverCard) : "");
  const coverKey = coverFile?.key || coverCard?.dataset.imageKey || "";
  const typeLabel = p.type === "定制" ? "定制" : "内部";
  const date = pjDateRangeLabel(p);
  const due = pjDaysLeft(p);
  const dueClass = due !== null && due <= 7 ? " risk" : "";
  return `<article class="pj-card" draggable="${pjIsBoss() || pjIsOwner(p)}" data-pj-card="${escapeHtml(p.id)}">
    <div class="pj-cover" data-image-shell>
      ${cover
        ? `<img src="${escapeHtml(cover)}" alt="" width="600" height="800" loading="lazy" decoding="async" />`
        : coverKey
          ? `<img data-image-key="${escapeHtml(coverKey)}" alt="" width="600" height="800" loading="lazy" decoding="async" />`
          : `<span class="pj-cover-empty">暂无封面</span>`}
      <span class="pj-card-type-corner ${p.type === "定制" ? "custom" : "internal"}">${typeLabel}</span>
      <div class="pj-card-overlay">
        <div class="pj-card-title-row">
          <strong title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</strong>
          ${unread ? `<i class="pj-dot" title="有 ${unread} 条新动态"></i>` : ""}
        </div>
        <time class="pj-card-period${dueClass}">${escapeHtml(date)}</time>
        ${pjIsOverdue(p) ? `<span class="pj-card-overdue">逾期</span>` : ""}
        <div class="pj-card-foot">
          ${pjAvatars([...new Set([...pjOwners(p), ...projectMembers].filter(Boolean))], 2)}
        </div>
      </div>
    </div>
  </article>`;
}

function pjPatternCardHtml(card) {
  const f = card.dataset.file;
  const p = pjById(card.dataset.projectId || "");
  const img = card.dataset.imageData ? `background-image:url('${card.dataset.imageData}')` : "";
  return `<article class="pj-card pj-pcard" draggable="true" data-pj-pattern="${escapeHtml(f)}">
    <div class="pj-pthumb" style="${img}"></div>
    <div class="pj-card-top"><strong>${escapeHtml(f)}</strong></div>
    ${p ? `<div class="pj-card-meta"><span class="pj-type ${p.type === "定制" ? "custom" : ""}">${escapeHtml(p.name)}</span></div>` : `<div class="pj-card-meta"><span class="pj-type">未关联项目</span></div>`}
  </article>`;
}

function renderProjectsView() {
  const board = document.querySelector("#pjBoard");
  if (!board) return;
  const toolbarEl = document.querySelector(".pj-toolbar");
  // 一个项目都没有时：不显示统计和空看板，只给一个干净的引导页
  if (!pjProjects.length) {
    if (toolbarEl) toolbarEl.style.display = "none";
    board.className = "pj-empty-wrap";
    board.innerHTML = `<div class="pj-empty">
      <svg viewBox="0 0 24 24" class="pj-empty-ic"><rect x="4" y="5" width="5" height="14" rx="1"></rect><rect x="10.5" y="5" width="5" height="9" rx="1"></rect><rect x="17" y="5" width="3" height="12" rx="1"></rect></svg>
      <h3>还没有项目</h3>
      <p>接到新单子时在这里建项目：拉上设计师和手绘师、设定交期、上传客户资料，<br/>之后所有稿件和进度都会归到这个项目下。</p>
      ${canCreateProject() ? `<button class="primary-button" id="pjEmptyNew" type="button">＋ 新建第一个项目</button>` : `<p>请联系管理员创建项目后再上传对应稿件。</p>`}
    </div>`;
    board.querySelector("#pjEmptyNew")?.addEventListener("click", () => pjOpenForm(null));
    return;
  }
  if (toolbarEl) toolbarEl.style.display = "";
  board.className = "pj-board";
  const list = pjFiltered();
  board.innerHTML = PJ_STAGES.map((st) => {
    const items = list.filter((p) => (p.stage || PJ_STAGES[0].key) === st.key);
    return `<div class="pj-col" data-pj-stage="${escapeHtml(st.key)}" style="--pj-stage-color:${st.color}">
      <div class="pj-col-head"><span>${st.key}</span><em>(${items.length})</em></div>
      <div class="pj-col-body">${items.map(pjCardHtml).join("")}
        ${canCreateProject() ? `<button class="pj-drop" data-pj-create-stage="${escapeHtml(st.key)}" type="button" aria-label="在${escapeHtml(st.key)}阶段新建项目">
          <span class="pj-drop-plus">＋</span><span class="pj-drop-label">可点击新建项目</span>
        </button>` : ""}
      </div>
    </div>`;
  }).join("");
  hydrateLazyKeyImages(board);
}

function renderProjectStats() {
  const box = document.querySelector("#pjStats");
  if (!box) return;
  const act = pjProjects.filter((p) => !p.archived);
  const overdue = act.filter((p) => (pjDaysLeft(p) ?? 99) < 0).length;
  const soon = act.filter((p) => { const d = pjDaysLeft(p); return d !== null && d >= 0 && d <= 7; }).length;
  const doneStage = act.filter((p) => p.stage === "内部定稿").length;
  const seg = PJ_STAGES.map((s) => {
    const n = act.filter((p) => (p.stage || PJ_STAGES[0].key) === s.key).length;
    return { ...s, n, pct: act.length ? (n / act.length) * 100 : 0 };
  });
  // 环形图：阶段占比
  const R = 54, C = 2 * Math.PI * R;
  let off = 0;
  const rings = seg.filter((s) => s.n).map((s) => {
    const len = C * (s.pct / 100);
    const el = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${s.color}" stroke-width="16"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;
    off += len; return el;
  }).join("");
  box.innerHTML = `
    <div class="pj-stat pj-stat-ring">
      <div class="pj-stat-h">阶段分布</div>
      <div class="pj-ring-wrap">
        <svg viewBox="0 0 140 140" class="pj-ring">
          <circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--color-border-subtle,#e7e5e4)" stroke-width="16"/>
          ${rings}
          <text x="70" y="66" text-anchor="middle" class="pj-ring-n">${act.length}</text>
          <text x="70" y="84" text-anchor="middle" class="pj-ring-l">进行中</text>
        </svg>
        <div class="pj-legend">${seg.map((s) => `<span><i style="background:${s.color}"></i>${s.key}<em>${s.n}</em></span>`).join("")}</div>
      </div>
    </div>
    <div class="pj-stat pj-stat-nums">
      <div class="pj-stat-h">概览</div>
      <div class="pj-num-grid">
        <div><b>${act.length}</b><span>进行中</span></div>
        <div><b>${doneStage}</b><span>已到定稿</span></div>
        <div class="${soon ? "warn" : ""}"><b>${soon}</b><span>7天内截止</span></div>
        <div class="${overdue ? "over" : ""}"><b>${overdue}</b><span>已逾期</span></div>
      </div>
    </div>`;
}

/* ===================================================================
   项目管理 · 独立详情页（日历 / 成员 / 文件 / 稿件 / 动态）
   =================================================================== */
function pjCloseDetail() {
  const overview = document.getElementById("pjOverview");
  const detail = document.getElementById("pjDetailPage");
  if (overview) overview.hidden = false;
  if (detail) detail.hidden = true;
  pjActiveId = null;
  renderProjectsView();
  document.getElementById("projects")?.scrollIntoView({ block: "start" });
}
function pjDateOnly(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}
function pjDateDisplay(value) {
  return pjDateOnly(value).replaceAll("-", "/");
}
function pjDateRangeLabel(p) {
  const start = pjDateDisplay(p.startDate || p.createdAt);
  const end = pjDateDisplay(p.deadline);
  if (start && end) return `${start}–${end.slice(5)}`;
  return end || start || "未设日期";
}
function pjDateRangeFields(p, canEdit) {
  const start = pjDateOnly(p.startDate || p.createdAt);
  const end = pjDateOnly(p.deadline);
  return `<div class="pjd-date-range" aria-label="项目周期">
    <label>
      <span class="visually-hidden">开始日期</span>
      <input id="pjdStartDate" type="date" value="${escapeHtml(start)}" aria-label="开始日期" ${canEdit ? "" : "disabled"} />
    </label>
    <i aria-hidden="true">–</i>
    <label>
      <span class="visually-hidden">结束日期</span>
      <input id="pjdEndDate" type="date" value="${escapeHtml(end)}" aria-label="结束日期" ${canEdit ? "" : "disabled"} />
    </label>
  </div>`;
}
function pjDetailMember(value) {
  return (typeof teamMembers !== "undefined" && Array.isArray(teamMembers))
    ? teamMembers.find((member) => member.ownerKey === value || member.name === value)
    : null;
}
function pjDetailMemberChip(value, canRemove = false, slot = "") {
  const member = pjDetailMember(value);
  const name = member?.name || value || "未命名";
  const role = member?.role || "";
  const avatar = member?.avatar || (typeof ROLE_AVATARS !== "undefined" ? ROLE_AVATARS[role] : "") || "";
  return `<span class="pjd-member-chip" title="${escapeHtml(`${name}${role ? ` · ${role}` : ""}`)}">
    ${avatar ? `<img src="${escapeHtml(avatar)}" alt="" width="48" height="48" />` : `<i>${escapeHtml(name.slice(0, 1))}</i>`}
    <b>${escapeHtml(name)}</b>
    ${canRemove ? `<button class="pjd-member-x" type="button" data-pjd-member-remove="${escapeHtml(value)}" data-pjd-member-slot="${escapeHtml(slot || "")}" aria-label="移除${escapeHtml(name)}" title="移除">×</button>` : ""}
  </span>`;
}
function pjDetailMemberRows(p, canEdit) {
  const members = Array.isArray(p.members) ? p.members : [];
  const designers = members.filter((value) => pjDetailMember(value)?.role === "设计师");
  const painters = members.filter((value) => pjDetailMember(value)?.role === "手绘师");
  const sales = members.filter((value) => pjDetailMember(value)?.role === "销售");
  const row = (type, label, values) => `<div class="pjd-member-row">
    <span>${label}：</span>
    <div class="pjd-member-strip">${
      canEdit ? `<button class="pjd-member-add" data-pjd-member-type="${type}" type="button">添加人员 <i>＋</i></button>` : ""
    }${values.map((v) => pjDetailMemberChip(v, canEdit, type)).join("")}</div>
  </div>`;
  return [
    row("sales", "销售", sales),
    row("owner", "负责人", pjOwners(p)),
    row("designer", "设计师", designers),
    row("painter", "手绘师", painters),
  ].join("");
}
function pjCustomerOptions() {
  const clients = (typeof buildCustomerCenter === "function" ? buildCustomerCenter() : customerCenterClients || []);
  const seen = new Set();
  return clients.filter((client) => {
    const company = String(client.display || client.company || client.name || "").trim();
    if (!company || seen.has(company)) return false;
    seen.add(company);
    return true;
  }).map((client) => ({
    value: String(client.display || client.company || client.name || "").trim(),
    label: String(client.display || client.company || client.name || "").trim(),
    client,
  }));
}
function pjSaveCustomerFields(p, company, customerName) {
  const nextCompany = String(company || "").trim();
  const nextName = String(customerName || "").trim();
  const changed = nextCompany !== String(p.customerCompany || p.customer || "").trim()
    || nextName !== String(p.customerName || "").trim();
  p.customerCompany = nextCompany;
  p.customerName = nextName;
  p.customer = nextCompany;
  if (!changed) return;
  pjPush(p, `客户信息更新为「${nextCompany || "未设置公司"}${nextName ? ` · ${nextName}` : ""}」`);
  pjSave();
  renderProjectsView();
}
function pjOpenCustomerCompanyMenu(anchor, options, currentValue, query, onSelect, onCreate) {
  document.querySelector(".pjd-customer-menu")?.remove();
  const rect = anchor.getBoundingClientRect();
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const matches = options.filter((option) => !normalizedQuery || option.label.toLowerCase().includes(normalizedQuery));
  const menu = document.createElement("div");
  menu.className = "pjd-customer-menu";
  menu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 342))}px`;
  menu.style.top = `${rect.bottom + 6}px`;
  menu.innerHTML = `
    <div class="pjd-customer-menu-list">
      ${matches.length ? matches.map((option) => `<button class="${option.value === currentValue ? "active" : ""}" data-pjd-customer-option="${escapeHtml(option.value)}" type="button">
        <span>${escapeHtml(option.label)}</span>${option.value === currentValue ? `<i>✓</i>` : ""}
      </button>`).join("") : `<p class="pjd-customer-empty">没有匹配的客户</p>`}
    </div>
    <button class="pjd-customer-create" data-pjd-customer-create type="button">${
      normalizedQuery && !matches.length ? `＋ 新建该客户“${escapeHtml(String(query).trim())}”` : "＋ 新建客户"
    }</button>`;
  document.body.appendChild(menu);
  const close = () => {
    menu.remove();
    document.removeEventListener("pointerdown", closeFromOutside, true);
  };
  const closeFromOutside = (event) => {
    if (!menu.contains(event.target) && !anchor.contains(event.target)) close();
  };
  menu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-pjd-customer-option]");
    if (option) {
      onSelect(option.dataset.pjdCustomerOption);
      close();
      return;
    }
    if (event.target.closest("[data-pjd-customer-create]")) {
      close();
      onCreate(String(query || "").trim());
    }
  });
  requestAnimationFrame(() => document.addEventListener("pointerdown", closeFromOutside, true));
}
function pjOpenStatusMenu(anchor, options, currentValue, onSelect) {
  document.querySelector(".pjd-status-menu")?.remove();
  const rect = anchor.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.className = "pjd-status-menu";
  menu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 210))}px`;
  menu.style.top = `${rect.bottom + 6}px`;
  menu.innerHTML = options.map((option) => `
    <button class="${option.value === currentValue ? "active" : ""}" data-pjd-status-option="${escapeHtml(option.value)}" type="button">
      <span>${escapeHtml(option.label)}</span><i aria-hidden="true">${option.value === currentValue ? "✓" : ""}</i>
    </button>`).join("");
  document.body.appendChild(menu);
  anchor.setAttribute("aria-expanded", "true");
  const close = () => {
    menu.remove();
    anchor.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", closeFromOutside, true);
  };
  const closeFromOutside = (event) => {
    if (!menu.contains(event.target) && !anchor.contains(event.target)) close();
  };
  menu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-pjd-status-option]");
    if (!option) return;
    onSelect(option.dataset.pjdStatusOption);
    close();
  });
  requestAnimationFrame(() => document.addEventListener("pointerdown", closeFromOutside, true));
}
function pjOpenNoteModal(p, canEdit) {
  document.querySelector(".pjd-note-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "pjd-note-overlay";
  overlay.innerHTML = `<div class="pjd-note-dialog" role="dialog" aria-modal="true" aria-label="项目备注">
    <header><h3>项目备注</h3><button type="button" data-pjd-note-close aria-label="关闭">×</button></header>
    ${canEdit
      ? `<textarea rows="12" placeholder="输入项目备注">${escapeHtml(p.desc || "")}</textarea>`
      : `<div class="pjd-note-full">${escapeHtml(p.desc || "暂无项目备注")}</div>`}
    <footer><button type="button" data-pjd-note-close>取消</button>${
      canEdit ? `<button class="primary-button" type="button" data-pjd-note-save>保存</button>` : ""
    }</footer>
  </div>`;
  document.body.appendChild(overlay);
  lockBodyScroll(true);
  const close = () => {
    overlay.remove();
    lockBodyScroll(false);
  };
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-pjd-note-close]")) {
      close();
      return;
    }
    if (!event.target.closest("[data-pjd-note-save]")) return;
    const next = overlay.querySelector("textarea")?.value.trim() || "";
    p.desc = next;
    pjPush(p, "更新了项目备注");
    pjSave();
    pjRenderDetail(p);
    close();
    showToast("项目备注已保存。", "success");
  });
  overlay.querySelector("textarea")?.focus();
}
function pjRenderDetail(p) {
  const body = document.getElementById("pjdBody");
  if (!body || !p) return;
  document.getElementById("pjdTitle").textContent = p.name;
  const pats = pjPatternsOf(p);
  const pendingPatternRemovals = pjPendingPatternRemovals.get(p.id) || new Set();
  const visiblePats = pats.filter((card) => !pendingPatternRemovals.has(card.dataset.file));
  const canEdit = !p.archived && (pjIsBoss() || pjIsOwner(p));
  const canEditDates = !p.archived && (currentAccount.role === "管理员" || pjIsOwner(p));
  const stage = PJ_STAGES.find((item) => item.key === p.stage) || PJ_STAGES[0];
  const headActions = document.getElementById("pjdHeadActions");
  const headTags = document.getElementById("pjdHeadTags");
  if (headTags) {
    const customerCompany = p.customerCompany || p.customer || "";
    const customerName = p.customerName || "";
    headTags.innerHTML = `
      <span class="pjd-project-status-row">
        <button class="pj-type ${p.type === "定制" ? "custom" : "internal"}" data-pjd-type type="button" aria-haspopup="menu" aria-expanded="false">${p.type === "定制" ? "客户定制项目" : "内部项目"}</button>
        <button class="pj-stagetag" data-pjd-stage type="button" aria-haspopup="menu" aria-expanded="false" style="--pj-stage-color:${stage.color}">${escapeHtml(stage.key)}</button>
        ${pjDateRangeFields(p, canEditDates)}
        ${pjIsOverdue(p) ? `<span class="pjd-overdue-status">逾期</span>` : ""}
      </span>
      <span class="pjd-customer-row">
        <label class="pjd-customer-combo">
          <span>客户公司：</span>
          <input id="pjdCustomerCompany" value="${escapeHtml(customerCompany)}" placeholder="选择或输入公司" ${canEdit ? "" : "disabled"} />
          ${canEdit ? `<button data-pjd-customer-list type="button" aria-label="选择客户公司">⌄</button>` : ""}
        </label>
        <label class="pjd-customer-name">
          <span>客户名：</span>
          <input id="pjdCustomerName" value="${escapeHtml(customerName)}" placeholder="输入客户名字" ${canEdit ? "" : "disabled"} />
        </label>
      </span>`;
  }
  if (headActions) {
    headActions.innerHTML = `<div class="pjd-head-actions">
      ${canEdit && !p.archived ? `<button class="pjd-head-complete" data-pj-complete type="button">
        <span aria-hidden="true">✓</span>项目完成
      </button>` : ""}
      ${pjIsBoss() ? `<button class="pj-detail-delete" data-pj-del type="button" title="删除项目" aria-label="删除项目">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>
      <span>删除项目</span>
    </button>` : ""}
    </div>`;
  }
  body.innerHTML = `
    <div class="pjd-overview-grid">
      <section class="pjd-card pjd-note-card">
        <div class="pjd-h">项目备注
          <button class="pjd-expand" data-pjd-note-expand type="button" aria-label="展开项目备注" title="展开项目备注">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>
          </button>
        </div>
        <p class="pjd-note-preview">${escapeHtml(p.desc || "暂无项目备注")}</p>
      </section>
      <section class="pjd-card pjd-members-card">
        <div class="pjd-h">参与人员
          ${canEdit ? `<button class="pjd-expand" data-pj-edit-members type="button" aria-label="编辑参与人员" title="编辑参与人员">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>
          </button>` : ""}
        </div>
        <div class="pjd-member-rows">${pjDetailMemberRows(p, canEdit)}</div>
      </section>
    </div>

    <div class="pjd-card">
      <div class="pjd-h">项目文件
        <span class="pjd-h-actions">
          ${(p.files || []).length ? `<button class="pjd-download-all" id="pjDownloadAll" type="button" aria-label="全部下载">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg>
            全部下载
          </button>` : ""}
        </span>
      </div>
      <div class="pjd-files">
        ${(p.files || []).map((f, i) => {
          const isImage = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(f.name || "") || String(f.type || "").startsWith("image/");
          return `<article class="pjd-file-card">
            <div class="pjd-file-preview${isImage ? " is-image" : ""}" data-image-shell>
              ${isImage && f.key
                ? `<img data-image-key="${escapeHtml(f.key)}" alt="" width="800" height="600" loading="lazy" decoding="async" />`
                : `<span class="pjd-file-kind">${escapeHtml(pjFileType(f))}</span>`}
              ${isImage ? `<button class="pjd-file-open" data-pj-file-preview="${i}" type="button" aria-label="放大查看 ${escapeHtml(f.name)}"></button>` : ""}
              <button class="pjd-file-download" data-pj-file-download="${i}" type="button" aria-label="下载 ${escapeHtml(f.name)}" title="下载">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg>
              </button>
              ${canEdit ? `<button class="pjd-file-remove" data-pj-file-remove="${i}" type="button" aria-label="删除 ${escapeHtml(f.name)}" title="删除">×</button>` : ""}
            </div>
            <strong title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</strong>
          </article>`;
        }).join("")}
        ${canEdit ? `<label class="pjd-file-upload">
          <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 13v6h14v-6"/></svg>上传文件</span>
          <input type="file" id="pjFileInput" multiple hidden/>
        </label>` : ""}
        ${!(p.files || []).length && !canEdit ? `<p class="pjd-empty">还没有客户资料/参考文件。</p>` : ""}
      </div>
    </div>

    <div class="pjd-card">
      <div class="pjd-h">项目稿件（${visiblePats.length}）
        <span class="pjd-h-actions">${canEdit ? `<button class="pjd-add" data-pj-add-patterns type="button">＋ 从作品库添加</button>` : ""}
        ${canEdit && p.stage === "内部定稿" ? `<button class="pjd-add ok" data-pj-publish type="button">定稿发布</button>` : ""}</span></div>
      <div class="pjd-pats">${visiblePats.length ? visiblePats.map((c) => {
        const source = cardPreviewSource(c);
        const key = c.dataset.imageKey || "";
        const file = c.dataset.file || "未命名稿件";
        const uploader = typeof workOwnerName === "function" ? workOwnerName(c) : (c.dataset.workOwner || "未知上传者");
        const date = String(c.dataset.createdAt || c.dataset.version || "").slice(0, 16);
        return `<article class="pjd-pat" data-pjd-pattern="${escapeHtml(file)}" title="${escapeHtml(file)}" data-image-shell>
          ${source
            ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(file)}" width="800" height="600" loading="lazy" decoding="async" />`
            : key
              ? `<img data-image-key="${escapeHtml(key)}" alt="${escapeHtml(file)}" width="800" height="600" loading="lazy" decoding="async" />`
              : `<span>图片暂不可用</span>`}
          <span class="pjd-pat-colors">配色 ${escapeHtml(c.dataset.colors || "1")}</span>
          ${canEdit ? `<button class="pjd-pat-delete" data-pjd-pattern-remove="${escapeHtml(file)}" type="button" aria-label="从项目移除 ${escapeHtml(file)}" title="从项目移除">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>
          </button>` : ""}
          <button class="pjd-pat-open" data-pjd-pattern-open="${escapeHtml(file)}" type="button" aria-label="查看 ${escapeHtml(file)}">
            <span><strong>${escapeHtml(file)}</strong><small>上传者：${escapeHtml(uploader)}</small><small>日期：${escapeHtml(date || "未知")}</small></span>
          </button>
        </article>`;
      }).join("")
        : `<p class="pjd-empty">还没有关联稿件，可从作品库中添加。</p>`}
      </div>
      ${canEdit ? `<div class="pjd-pattern-save-row">
        <button class="primary-button" data-pjd-pattern-save type="button" ${pendingPatternRemovals.size ? "" : "hidden"}>保存修改</button>
      </div>` : ""}
      ${p.published ? `<p class="pjd-note">已发布：${p.customer ? `进入「${escapeHtml(p.customer)}」专属可见范围` : "进入公共作品库"}</p>` : ""}
    </div>

    <div class="pjd-card">
      <div class="pjd-h">项目动态 ${(p.feed || []).length > 3 ? `<button class="pjd-feed-toggle" data-pj-toggle-feed type="button">展开全部（${(p.feed || []).length}）</button>` : ""}</div>
      <div class="pjd-feed" data-collapsed="true">${(p.feed || []).map((f, index) => `
        <div class="pjd-ev${index >= 3 ? " pjd-ev-more" : ""}"><i class="pjd-ev-k ${f.kind}"></i>
        <div><div class="t">${escapeHtml(f.text)}</div><div class="d">${escapeHtml(f.byName || "")} · ${escapeHtml(f.t)}</div></div></div>`).join("") || `<p class="pjd-empty">暂无动态。</p>`}
      </div>
    </div>`;

  pjMarkSeen(p);
  pjBindDetail(p);
  hydrateLazyKeyImages(body);
}
function pjOpenDetail(id) {
  const p = pjById(id); if (!p) return;
  const overview = document.getElementById("pjOverview");
  const detail = document.getElementById("pjDetailPage");
  if (!detail) return;
  pjActiveId = id;
  if (overview) overview.hidden = true;
  detail.hidden = false;
  pjRenderDetail(p);
  detail.scrollIntoView({ block: "start" });
}
function pjBindDetail(p) {
  const body = document.getElementById("pjdBody");
  if (!body) return;
  const canEdit = !p.archived && (pjIsBoss() || pjIsOwner(p));
  const title = document.getElementById("pjdTitle");
  document.querySelector("[data-pjd-type]")?.addEventListener("click", (event) => {
    if (!canEdit) return;
    pjOpenStatusMenu(
      event.currentTarget,
      [
        { value: "内部", label: "内部项目" },
        { value: "定制", label: "客户定制项目" },
      ],
      p.type || "内部",
      (value) => {
        if (value === p.type) return;
        p.type = value;
        if (value === "内部") p.customer = "";
        pjPush(p, `项目类型切换为「${value === "定制" ? "客户定制项目" : "内部项目"}」`);
        pjSave();
        pjRenderDetail(p);
        renderProjectsView();
      },
    );
  });
  document.querySelector("[data-pjd-stage]")?.addEventListener("click", (event) => {
    if (!canEdit) return;
    pjOpenStatusMenu(
      event.currentTarget,
      PJ_STAGES.map((item) => ({ value: item.key, label: item.key })),
      p.stage || PJ_STAGES[0].key,
      (value) => {
        const result = pjMoveProjectStage(p.id, value);
        if (!result.ok) {
          showToast(result.reason === "final" ? "只有管理员可以将项目推进到内部定稿。" : "你没有权限推进此项目。", "warning");
          return;
        }
        pjRenderDetail(p);
        renderProjectsView();
      },
    );
  });
  const companyInput = document.getElementById("pjdCustomerCompany");
  const customerNameInput = document.getElementById("pjdCustomerName");
  const saveCustomerFields = () => pjSaveCustomerFields(p, companyInput?.value, customerNameInput?.value);
  companyInput?.addEventListener("change", saveCustomerFields);
  companyInput?.addEventListener("blur", saveCustomerFields);
  customerNameInput?.addEventListener("change", saveCustomerFields);
  customerNameInput?.addEventListener("blur", saveCustomerFields);
  [companyInput, customerNameInput].forEach((input) => input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  }));
  const openCompanyMenu = (query = companyInput?.value || "") => {
    const customerOptions = pjCustomerOptions();
    pjOpenCustomerCompanyMenu(
      document.querySelector(".pjd-customer-combo"),
      customerOptions,
      companyInput?.value || "",
      query,
      (value) => {
        const selected = customerOptions.find((option) => option.value === value)?.client;
        if (companyInput) companyInput.value = value;
        if (customerNameInput && selected?.contact) customerNameInput.value = selected.contact;
        saveCustomerFields();
        showToast("已关联客户中心的客户。", "success");
      },
      (companyName) => {
        pjPendingCustomerLink = { projectId: p.id };
        if (typeof openCustomerModal !== "function") return;
        openCustomerModal();
        if (customerCompanyInput) customerCompanyInput.value = companyName;
        document.querySelector("#customerNameInput")?.focus();
      },
    );
  };
  document.querySelector("[data-pjd-customer-list]")?.addEventListener("click", () => openCompanyMenu());
  companyInput?.addEventListener("input", () => openCompanyMenu(companyInput.value));
  companyInput?.addEventListener("focus", () => openCompanyMenu(companyInput.value));
  if (title) {
    title.onclick = () => {
      if (!canEdit || title.isContentEditable) return;
      title.dataset.original = p.name;
      title.contentEditable = "true";
      title.classList.add("editing");
      title.focus();
      const range = document.createRange();
      range.selectNodeContents(title);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    };
    title.onkeydown = (e) => {
      if (e.key === "Enter") { e.preventDefault(); title.blur(); }
      if (e.key === "Escape") {
        e.preventDefault();
        title.textContent = title.dataset.original || p.name;
        title.dataset.cancelEdit = "1";
        title.blur();
      }
    };
    title.onblur = () => {
      if (!title.isContentEditable) return;
      title.contentEditable = "false";
      title.classList.remove("editing");
      if (title.dataset.cancelEdit === "1") { delete title.dataset.cancelEdit; return; }
      const next = title.textContent.trim();
      if (!next) { title.textContent = p.name; showToast("项目名称不能为空。", "warning"); return; }
      if (next !== p.name) {
        const old = p.name;
        p.name = next;
        pjPush(p, `项目名称由「${old}」修改为「${next}」`);
        pjSave();
        syncWorkProjectLabels(p.id);
        renderProjectsView();
        showToast("项目名称已更新。", "success");
      }
    };
  }
  body.querySelector("[data-pjd-note-expand]")?.addEventListener("click", () => pjOpenNoteModal(p, canEdit));
  body.querySelector("[data-pj-edit-members]")?.addEventListener("click", () => pjOpenMemberEditor(p));
  // 成员标签上的 × ：直接移除，无需进入编辑态
  body.querySelectorAll("[data-pjd-member-remove]").forEach((btn) => btn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const value = btn.dataset.pjdMemberRemove;
    const slot = btn.dataset.pjdMemberSlot;
    const nameOf = pjDetailMember(value)?.name || value;
    if (slot === "owner") {
      p.owners = (p.owners || (p.owner ? [p.owner] : [])).filter((v) => v !== value);
      if (p.owner === value) p.owner = p.owners[0] || "";
    } else {
      p.members = (p.members || []).filter((v) => v !== value);
    }
    pjPush(p, `移除参与人员：${nameOf}`);
    pjSave();
    pjRenderDetail(p);
    renderProjectsView();
    showToast(`已移除 ${nameOf}`, "success");
  }));
  body.querySelectorAll("[data-pjd-member-type]").forEach((button) => button.addEventListener("click", () => {
    const type = button.dataset.pjdMemberType;
    const roleByType = { sales: ["销售"], designer: ["设计师"], painter: ["手绘师"], owner: ["管理员", "销售", "设计师", "手绘师"] };
    const titleByType = { sales: "选择销售", designer: "选择设计师", painter: "选择手绘师", owner: "选择负责人" };
    const current = type === "owner"
      ? pjOwners(p)
      : (p.members || []).filter((value) => roleByType[type]?.includes(pjDetailMember(value)?.role));
    pjOpenCreateMemberPicker({
      title: titleByType[type] || "选择成员",
      roles: roleByType[type] || [],
      current,
      onSave: (values) => {
        const picked = Array.isArray(values) ? values : [values].filter(Boolean);
        if (type === "owner") {
          p.owners = picked;
          p.owner = picked[0] || "";
        } else {
          const removedRoles = roleByType[type] || [];
          p.members = (p.members || []).filter((value) => !removedRoles.includes(pjDetailMember(value)?.role));
          p.members.push(...picked);
        }
        p.members = [...new Set([...(p.members || []), ...pjOwners(p)].filter(Boolean))];
        pjPush(p, `${titleByType[type] || "项目成员"}已更新`);
        pjSave();
        pjRenderDetail(p);
        renderProjectsView();
        showToast("项目成员已更新。", "success");
      },
    });
  }));
  const syncProjectDates = () => {
    if (!canEditDates) {
      showToast("只有管理员或项目负责人可以修改项目时间。", "warning");
      return;
    }
    const startInput = document.querySelector("#pjdStartDate");
    const endInput = document.querySelector("#pjdEndDate");
    const nextStart = pjDateOnly(startInput?.value);
    const nextEnd = pjDateOnly(endInput?.value);
    if (nextStart && nextEnd && nextStart > nextEnd) {
      showToast("结束日期不能早于开始日期。", "warning");
      if (startInput) startInput.value = pjDateOnly(p.startDate);
      if (endInput) endInput.value = pjDateOnly(p.deadline);
      return;
    }
    const oldStart = pjDateOnly(p.startDate);
    const oldEnd = pjDateOnly(p.deadline);
    p.startDate = nextStart;
    p.deadline = nextEnd;
    if (oldStart !== nextStart || oldEnd !== nextEnd) {
      pjPush(p, `项目周期更新为 ${pjDateDisplay(nextStart) || "未设置"} 至 ${pjDateDisplay(nextEnd) || "未设置"}`);
      pjSave();
      renderProjectsView();
    }
  };
  document.querySelector("#pjdStartDate")?.addEventListener("change", syncProjectDates);
  document.querySelector("#pjdEndDate")?.addEventListener("change", syncProjectDates);
  body.querySelector("[data-pj-add-patterns]")?.addEventListener("click", () => pjOpenPatternPicker(p));
  body.querySelectorAll("[data-pjd-pattern-open]").forEach((button) => button.addEventListener("click", () => {
    const card = sourceCardByFile(button.dataset.pjdPatternOpen);
    if (card) openLightbox(card, { worksLibrary: true });
  }));
  body.querySelectorAll("[data-pjd-pattern-remove]").forEach((button) => button.addEventListener("click", () => {
    const removals = pjPendingPatternRemovals.get(p.id) || new Set();
    removals.add(button.dataset.pjdPatternRemove);
    pjPendingPatternRemovals.set(p.id, removals);
    pjRenderDetail(p);
    showToast("已标记移除，点击“保存修改”后生效。", "warning");
  }));
  body.querySelector("[data-pjd-pattern-save]")?.addEventListener("click", () => {
    const removals = pjPendingPatternRemovals.get(p.id) || new Set();
    let removed = 0;
    removals.forEach((file) => {
      const card = sourceCardByFile(file);
      if (!card || card.dataset.projectId !== p.id) return;
      delete card.dataset.projectId;
      markWorkRecordDirty(card);
      removed += 1;
    });
    if (removed) {
      saveStudioState();
      pjPush(p, `从项目移除了 ${removed} 款稿件`);
      pjSave();
    }
    pjPendingPatternRemovals.delete(p.id);
    pjRenderDetail(p);
    renderProjectsView();
    showToast(removed ? "项目稿件修改已保存。" : "没有待保存的修改。", removed ? "success" : "warning");
  });
  body.querySelector("[data-pj-toggle-feed]")?.addEventListener("click", (e) => {
    const feed = body.querySelector(".pjd-feed");
    const collapsed = feed?.dataset.collapsed !== "false";
    if (feed) feed.dataset.collapsed = collapsed ? "false" : "true";
    e.currentTarget.textContent = collapsed ? "收起" : `展开全部（${(p.feed || []).length}）`;
  });
  body.querySelectorAll("[data-pj-file-download]").forEach((button) => button.addEventListener("click", () => {
    const file = p.files?.[Number(button.dataset.pjFileDownload)];
    if (file) pjDownloadFileSet([file], p.name);
  }));
  body.querySelectorAll("[data-pj-file-preview]").forEach((button) => button.addEventListener("click", () => {
    const file = p.files?.[Number(button.dataset.pjFilePreview)];
    if (file) pjOpenFilePreview(file);
  }));
  body.querySelectorAll("[data-pj-file-remove]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.pjFileRemove);
    const file = p.files?.[index];
    if (!file || !window.confirm(`确认删除项目文件「${file.name}」？`)) return;
    p.files.splice(index, 1);
    pjPush(p, `删除了项目文件「${file.name}」`);
    pjSave();
    pjRenderDetail(p);
    renderProjectsView();
    showToast("项目文件已删除。", "success");
  }));
  body.querySelector("#pjDownloadAll")?.addEventListener("click", (event) => pjDownloadProjectArchive(p, event.currentTarget));
  body.querySelector("#pjFileInput")?.addEventListener("change", async (e) => {
    const fs = [...(e.target.files || [])]; if (!fs.length) return;
    p.files = p.files || [];
    for (const f of fs) {
      const key = `pjfile_${p.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try { await saveImageToDB(key, f); } catch {}
      p.files.push({
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        key,
        uploadedBy: currentAccount.name || currentAccount.role,
        uploadedAt: formatDateTime(),
      });
    }
    pjPush(p, `上传了 ${fs.length} 个项目资料`); pjSave(); pjRenderDetail(p);
    showToast("资料已上传到项目。", "success");
  });
  body.querySelector("[data-pj-publish]")?.addEventListener("click", () => pjPublish(p));
  document.querySelector("#pjdHeadActions [data-pj-complete]")?.addEventListener("click", () => {
    if (!window.confirm(`确认完成并归档项目「${p.name}」？归档后可在「历史项目」查看。`)) return;
    p.archived = true;
    p.completed = true;
    p.projectResult = "完成";
    p.completedAt = formatDateTime();
    p.archivedAt = p.completedAt;
    pjPush(p, "项目已完成并归档", "ok"); pjSave(); pjCloseDetail(); renderProjectsView();
    showToast(`项目「${p.name}」已归档。`, "success");
  });
  document.querySelector("#pjdHeadActions [data-pj-del]")?.addEventListener("click", () => {
    if (!window.confirm(`删除项目「${p.name}」？此操作不可恢复。`)) return;
    pjProjects = pjProjects.filter((x) => x.id !== p.id);
    syncWorkProjectLabels(p.id);
    pjSave(); pjCloseDetail(); renderProjectsView();
    showToast("项目已删除。", "success");
  });
}

function pjStaffValue(member) {
  return member.ownerKey || member.key || member.name || "";
}

function pjOpenCreateMemberPicker({ title, roles, multiple = true, current = [], onSave }) {
  const staff = (typeof teamMembers !== "undefined" && Array.isArray(teamMembers))
    ? teamMembers.filter((member) => member.accountStatus !== "已停用" && (!roles?.length || roles.includes(member.role)))
    : [];
  const selected = new Set((Array.isArray(current) ? current : [current]).filter(Boolean));
  let ov = document.getElementById("pjFormMemberOv");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "pjFormMemberOv";
    document.body.appendChild(ov);
  }
  const rows = staff.map((member) => {
    const value = pjStaffValue(member);
    const count = memberProjectItems(member).length;
    const load = count <= 2 ? "light" : count <= 4 ? "medium" : "high";
    const loadLabel = load === "light" ? "轻负载" : load === "medium" ? "中负载" : "高负载";
    const avatar = member.avatar || ROLE_AVATARS[member.role] || "";
    return `<label class="pjfm-person" data-pjfm-search="${escapeHtml(`${member.name} ${member.role}`.toLowerCase())}" data-pjfm-load="${load}">
      <i class="pjfm-avatar"${avatar ? ` style="background-image:url('${escapeHtml(avatar)}')"` : ""}>${avatar ? "" : escapeHtml((member.name || "?").slice(0, 1))}</i>
      <span class="pjfm-copy"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.role)} · 正在参与 ${count} 个项目</small></span>
      <span class="pjfm-load ${load}"><b></b>${loadLabel}</span>
      <span class="pjfm-count"><strong>${count}</strong><small>当前项目</small></span>
      <input type="${multiple ? "checkbox" : "radio"}" name="pjfmChoice" value="${escapeHtml(value)}" ${selected.has(value) ? "checked" : ""}/>
    </label>`;
  }).join("");
  ov.innerHTML = `<div class="pjf-scrim" data-pjfm-close></div>
    <aside class="pjm-drawer pjfm-drawer" role="dialog" aria-modal="true" aria-labelledby="pjfmTitle">
      <div class="pjf-head"><div><p class="pjm-eyebrow">PROJECT MEMBER</p><h3 id="pjfmTitle">${escapeHtml(title)}</h3></div>
        <button class="pjd-x" data-pjfm-close type="button" aria-label="关闭">×</button></div>
      <div class="pjfm-toolbar">
        <label><input id="pjfmSearch" type="search" placeholder="搜索" autocomplete="off" /><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg></label>
        <div class="pjfm-filters">
          <button class="active" data-pjfm-filter="all" type="button">全部</button>
          <button data-pjfm-filter="light" type="button">轻负载</button>
          <button data-pjfm-filter="medium" type="button">中负载</button>
          <button data-pjfm-filter="high" type="button">高负载</button>
        </div>
      </div>
      <div class="pjfm-list">${rows || `<p class="pjd-empty">暂无可选成员。</p>`}</div>
      <div class="pjf-foot"><span class="pjfm-selected">已选择 <strong>${selected.size}</strong> 人</span>
        ${multiple ? `<button class="ghost-button pjfm-select-all" data-pjfm-select-all type="button">全选</button>` : ""}
        <button class="ghost-button" data-pjfm-close type="button">取消</button>
        <button class="primary-button" data-pjfm-save type="button">确认</button></div>
    </aside>`;
  let activeFilter = "all";
  const refreshRows = () => {
    const query = ov.querySelector("#pjfmSearch")?.value.trim().toLowerCase() || "";
    ov.querySelectorAll(".pjfm-person").forEach((row) => {
      const matchSearch = !query || searchMatches(query, [row.dataset.pjfmSearch]);
      const matchLoad = activeFilter === "all" || row.dataset.pjfmLoad === activeFilter;
      row.classList.toggle("hidden", !matchSearch || !matchLoad);
    });
  };
  const close = () => ov.classList.remove("open");
  ov.querySelectorAll("[data-pjfm-close]").forEach((button) => button.addEventListener("click", close));
  ov.querySelector("#pjfmSearch")?.addEventListener("input", refreshRows);
  ov.querySelectorAll("[data-pjfm-filter]").forEach((button) => button.addEventListener("click", () => {
    activeFilter = button.dataset.pjfmFilter;
    ov.querySelectorAll("[data-pjfm-filter]").forEach((item) => item.classList.toggle("active", item === button));
    refreshRows();
  }));
  const choiceInputs = [...ov.querySelectorAll('input[name="pjfmChoice"]')];
  const refreshSelectedState = () => {
    ov.querySelector(".pjfm-selected strong").textContent = selected.size;
    const selectAll = ov.querySelector("[data-pjfm-select-all]");
    if (selectAll) selectAll.textContent = choiceInputs.length > 0 && choiceInputs.every((input) => input.checked) ? "取消全选" : "全选";
  };
  choiceInputs.forEach((input) => input.addEventListener("change", () => {
    if (!multiple) selected.clear();
    if (input.checked) selected.add(input.value); else selected.delete(input.value);
    refreshSelectedState();
  }));
  ov.querySelector("[data-pjfm-select-all]")?.addEventListener("click", () => {
    const visibleInputs = choiceInputs.filter((input) => !input.closest(".pjfm-person")?.classList.contains("hidden"));
    const shouldSelect = visibleInputs.length > 0 && !visibleInputs.every((input) => input.checked);
    visibleInputs.forEach((input) => {
      input.checked = shouldSelect;
      if (shouldSelect) selected.add(input.value); else selected.delete(input.value);
    });
    refreshSelectedState();
  });
  ov.querySelector("[data-pjfm-save]")?.addEventListener("click", () => {
    const values = [...selected];
    onSave?.(multiple ? values : (values[0] || ""));
    close();
  });
  refreshSelectedState();
  ov.classList.add("open");
}

function pjOpenMemberEditor(p) {
  const staff = (typeof teamMembers !== "undefined" && Array.isArray(teamMembers))
    ? teamMembers.filter((member) => member.accountStatus !== "已停用")
    : [];
  const roleOrder = ["管理员", "设计师", "手绘师", "销售"];
  let ov = document.getElementById("pjMemberOv");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "pjMemberOv";
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div class="pjf-scrim" data-pjm-close></div>
    <aside class="pjm-drawer" role="dialog" aria-modal="true" aria-labelledby="pjmTitle">
      <div class="pjf-head"><div><p class="pjm-eyebrow">项目成员</p><h3 id="pjmTitle">编辑项目成员</h3></div>
        <button class="pjd-x" data-pjm-close type="button" aria-label="关闭">×</button></div>
      <div class="pjm-search-wrap"><input id="pjmSearch" type="search" placeholder="搜索" autocomplete="off" /></div>
      <div class="pjf-body pjm-role-groups">
        ${roleOrder.map((role) => {
          const members = staff.filter((member) => member.role === role);
          if (!members.length) return "";
          return `<section class="pjm-role-group" data-pjm-role="${role}"><h4>${role}</h4><div class="pjm-options">
            ${members.map((member) => {
              const value = pjStaffValue(member);
              const avatar = member.avatar || ROLE_AVATARS[member.role] || "";
              const selected = (p.members || []).includes(value) || p.owner === value;
              return `<div class="pjm-person" data-pjm-search="${escapeHtml(`${member.name} ${member.role}`.toLowerCase())}">
                <label class="pjm-member-toggle">
                  <input type="checkbox" value="${escapeHtml(value)}" ${selected ? "checked" : ""}/>
                  <i${avatar ? ` style="background-image:url('${escapeHtml(avatar)}')"` : ""}>${avatar ? "" : escapeHtml((member.name || "?").slice(0, 1))}</i>
                  <span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.role || "")}</small></span>
                </label>
                <label class="pjm-owner-toggle"><input type="radio" name="pjmOwner" value="${escapeHtml(value)}" ${p.owner === value ? "checked" : ""}/><span>负责人</span></label>
              </div>`;
            }).join("")}
          </div></section>`;
        }).join("")}
      </div>
      <div class="pjf-foot"><button class="ghost-button" data-pjm-close type="button">取消</button>
        <button class="primary-button" data-pjm-save type="button">保存成员</button></div>
    </aside>`;
  const close = () => { ov.classList.remove("open"); lockBodyScroll(false); };
  ov.querySelectorAll("[data-pjm-close]").forEach((button) => button.addEventListener("click", close));
  ov.querySelector("#pjmSearch")?.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    ov.querySelectorAll(".pjm-person").forEach((row) => row.classList.toggle("hidden", Boolean(query) && !searchMatches(query, [row.dataset.pjmSearch])));
    ov.querySelectorAll(".pjm-role-group").forEach((group) => group.classList.toggle("hidden", !group.querySelector(".pjm-person:not(.hidden)")));
  });
  ov.querySelectorAll('input[name="pjmOwner"]').forEach((radio) => radio.addEventListener("change", () => {
    const memberInput = [...ov.querySelectorAll(".pjm-member-toggle input")].find((input) => input.value === radio.value);
    if (memberInput) memberInput.checked = true;
  }));
  ov.querySelector("[data-pjm-save]")?.addEventListener("click", () => {
    const owner = ov.querySelector('input[name="pjmOwner"]:checked')?.value || "";
    if (!owner) {
      showToast("请先选择一名项目负责人。", "warning");
      return;
    }
    p.owner = owner;
    p.owners = [owner];
    p.members = [...new Set([
      ...ov.querySelectorAll(".pjm-member-toggle input:checked")
    ].map((input) => input.value).concat(owner))];
    pjPush(p, "项目成员已更新");
    pjSave();
    close();
    pjRenderDetail(p);
    renderProjectsView();
    showToast("项目成员已更新。", "success");
  });
  ov.classList.add("open");
  lockBodyScroll(true);
}

function pjOpenPatternPicker(p) {
  const cards = [...workCards].filter((card) => !card.classList.contains("deleted") && !isSleepingWork(card));
  const selected = new Set(pjPatternsOf(p).map((card) => card.dataset.file));
  let ov = document.getElementById("pjPatternOv");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "pjPatternOv";
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div class="pjf-scrim" data-pjp-close></div>
    <div class="pjf-box pjp-box" role="dialog" aria-modal="true" aria-labelledby="pjpTitle">
      <div class="pjf-head"><div><p class="pjm-eyebrow">作品库</p><h3 id="pjpTitle">添加本项目稿件</h3></div>
        <button class="pjd-x" data-pjp-close type="button" aria-label="关闭">×</button></div>
      <div class="pjp-toolbar"><input id="pjpSearch" type="search" placeholder="搜索" /><span id="pjpCount"></span></div>
      <div class="pjp-grid" id="pjpGrid"></div>
      <div class="pjf-foot"><button class="ghost-button" data-pjp-close type="button">取消</button>
        <button class="primary-button" data-pjp-save type="button">添加所选稿件</button></div>
    </div>`;
  const grid = ov.querySelector("#pjpGrid");
  const count = ov.querySelector("#pjpCount");
  const render = (query = "") => {
    const q = query.trim().toLowerCase();
    const matches = cards.filter((card) => {
      const text = `${card.dataset.file || ""} ${card.dataset.designer || ""} ${card.textContent || ""}`.toLowerCase();
      return !q || searchMatches(q, [text]);
    }).slice(0, 80);
    grid.innerHTML = matches.map((card) => {
      const file = card.dataset.file || "";
      const image = cardPreviewSource(card);
      const imageKey = card.dataset.imageKey || "";
      const title = card.querySelector(".work-head strong")?.textContent.trim() || file || "未命名稿件";
      const owner = `${workRoleName(card)} · ${workOwnerName(card)}`;
      const version = String(card.dataset.createdAt || card.dataset.version || "").slice(0, 16);
      const colors = Number(card.dataset.colors || 1);
      return `<label class="pjp-item">
        <input type="checkbox" value="${escapeHtml(file)}" ${selected.has(file) ? "checked" : ""}/>
        <span class="pjp-thumb" data-image-shell>
          ${image
            ? `<img src="${escapeHtml(image)}" alt="" width="600" height="800" loading="lazy" decoding="async" />`
            : imageKey
              ? `<img data-image-key="${escapeHtml(imageKey)}" alt="" width="600" height="800" loading="lazy" decoding="async" />`
              : `<span class="pjp-thumb-empty">图片暂不可用</span>`}
          <span class="color-count">配色 ${colors}</span>
          <span class="pjp-hover-info" aria-hidden="true">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(owner)}</span>
            <span>时间：${escapeHtml(version || "未知")}</span>
            <span>配色：${colors} 个</span>
          </span>
        </span>
        <strong>${escapeHtml(title)}</strong>
      </label>`;
    }).join("") || `<p class="pjd-empty">没有匹配的稿件。</p>`;
    hydrateLazyKeyImages(grid);
    grid.querySelectorAll("input").forEach((input) => input.addEventListener("change", () => {
      if (input.checked) selected.add(input.value); else selected.delete(input.value);
      count.textContent = `已选 ${selected.size} 款`;
    }));
    count.textContent = `已选 ${selected.size} 款${matches.length < cards.length ? ` · 当前显示 ${matches.length} 款` : ""}`;
  };
  const close = () => { ov.classList.remove("open"); lockBodyScroll(false); };
  ov.querySelectorAll("[data-pjp-close]").forEach((button) => button.addEventListener("click", close));
  ov.querySelector("#pjpSearch")?.addEventListener("input", (event) => render(event.target.value));
  ov.querySelector("[data-pjp-save]")?.addEventListener("click", () => {
    let added = 0;
    cards.forEach((card) => {
      if (!selected.has(card.dataset.file)) return;
      if (card.dataset.projectId !== p.id) added += 1;
      card.dataset.projectId = p.id;
    });
    saveStudioState();
    if (added) pjPush(p, `从作品库添加了 ${added} 款稿件`, "ok");
    pjSave();
    close();
    pjRenderDetail(p);
    showToast(added ? `已添加 ${added} 款稿件。` : "所选稿件已在本项目中。", "success");
  });
  render();
  ov.classList.add("open");
  lockBodyScroll(true);
}

/** 定稿发布：挂客户 → 该客户专属可见；未挂客户 → 进公共作品库 */
function pjPublish(p) {
  const pats = pjPatternsOf(p);
  if (!pats.length) { showToast("本项目还没有关联稿件。", "warning"); return; }
  pats.forEach((c) => {
    c.dataset.published = "1";
    if (p.customer) c.dataset.exclusiveCustomer = p.customer;   // 专属客户，其他客户不可见
    else delete c.dataset.exclusiveCustomer;
  });
  p.published = true; p.publishedAt = formatDateTime();
  pjPush(p, p.customer ? `定稿发布：${pats.length} 款进入「${p.customer}」专属可见` : `定稿发布：${pats.length} 款进入公共作品库`, "ok");
  pjSave(); saveStudioState(); pjRenderDetail(p);
  if (typeof renderLibraryGrid === "function") renderLibraryGrid();
  showToast("已发布定稿花型。", "success");
}

/* ---- 新建 / 编辑项目 ---- */
function pjOpenForm(edit, draft = null, options = {}) {
  if (!canCreateProject()) {
    showToast("只有管理员可以新建或编辑项目。", "warning");
    return;
  }
  const staff = (typeof teamMembers !== "undefined" && Array.isArray(teamMembers)) ? teamMembers : [];
  const p = edit || draft || {};
  const roleOf = (value) => staff.find((member) => pjStaffValue(member) === value)?.role || "";
  let pickedDesigners = (p.members || []).filter((value) => roleOf(value) === "设计师");
  let pickedPainters = (p.members || []).filter((value) => roleOf(value) === "手绘师");
  let pickedSales = (p.members || []).filter((value) => roleOf(value) === "销售");
  let pickedOwners = pjOwners(p);
  let pickedFiles = [...(p.files || [])];
  const formFileNamespace = p.id || `PJFORM${Date.now()}`;
  let ov = document.getElementById("pjFormOv");
  if (!ov) {
    ov = document.createElement("div"); ov.id = "pjFormOv";
    ov.innerHTML = `<div class="pjf-scrim" data-pjf-close></div><div class="pjf-box pjf-project-box" id="pjfBox"></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-pjf-close]")) {
        ov.classList.remove("open");
        lockBodyScroll(ov.dataset.keepBodyLocked === "1");
      }
    });
  }
  ov.dataset.keepBodyLocked = options.keepBodyLocked ? "1" : "0";
  document.getElementById("pjfBox").innerHTML = `
    <div class="pjf-head"><h3>${edit ? "编辑项目" : "新建项目"}</h3><button class="pjd-x" data-pjf-close type="button">×</button></div>
    <div class="pjf-body">
      <label class="pjf-l" data-pjf-field="name">项目名称
        <input id="pjfName" value="${escapeHtml(p.name || "")}" placeholder="请输入项目名称" />
        <small class="pjf-error">请填写项目名称</small>
      </label>
      <div class="pjf-row">
        <label class="pjf-l">类型<select id="pjfType">
          <option value="内部" ${p.type === "内部" || !p.type ? "selected" : ""}>内部系列</option>
          <option value="定制" ${p.type === "定制" ? "selected" : ""}>客户定制项目</option></select></label>
        <label class="pjf-l" id="pjfCustWrap">客户
          <div class="pjd-customer-combo pjf-customer-combo">
            <input id="pjfCust" value="${escapeHtml(p.customerCompany || p.customer || "")}" placeholder="搜索" autocomplete="off" />
            <button data-pjf-customer-list type="button" aria-label="展开客户列表"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg></button>
          </div>
        </label>
      </div>
      <div class="pjf-row">
        <label class="pjf-l" data-pjf-field="start">开始日期
          <input id="pjfStart" type="date" value="${escapeHtml(p.startDate || "")}" />
          <small class="pjf-error">请选择开始日期</small>
        </label>
        <label class="pjf-l" data-pjf-field="deadline">结束日期
          <input id="pjfDl" type="date" value="${escapeHtml(p.deadline || "")}" />
          <small class="pjf-error">请选择结束日期</small>
        </label>
      </div>
      <section class="pjf-file-section">
        <strong>项目文件</strong>
        <div class="pjf-files" id="pjfFiles"></div>
      </section>
      <strong class="pjf-section-title">参与人员</strong>
      <div class="pjf-member-pickers">
        <section class="pjf-member-picker">
          <strong>销售：</strong>
          <button class="pjf-member-add" data-pjf-member-picker="sales" type="button">添加人员 <span>＋</span></button>
          <div class="pjf-member-summary" data-pjf-member-summary="sales"></div>
        </section>
        <section class="pjf-member-picker" data-pjf-field="owner">
          <strong>负责人：</strong>
          <button class="pjf-member-add" data-pjf-member-picker="owner" type="button">添加人员 <span>＋</span></button>
          <div class="pjf-member-summary" data-pjf-member-summary="owner"></div>
          <small class="pjf-error">请选择项目负责人</small>
        </section>
        <section class="pjf-member-picker">
          <strong>设计师：</strong>
          <button class="pjf-member-add" data-pjf-member-picker="designer" type="button">添加人员 <span>＋</span></button>
          <div class="pjf-member-summary" data-pjf-member-summary="designer"></div>
        </section>
        <section class="pjf-member-picker">
          <strong>手绘师：</strong>
          <button class="pjf-member-add" data-pjf-member-picker="painter" type="button">添加人员 <span>＋</span></button>
          <div class="pjf-member-summary" data-pjf-member-summary="painter"></div>
        </section>
      </div>
      <label class="pjf-l pjf-note">项目备注
        <textarea id="pjfDesc" rows="3" placeholder="请输入文字…">${escapeHtml(p.desc || "")}</textarea>
      </label>
    </div>
    <div class="pjf-foot">${!edit ? `<button class="ghost-button" id="pjfDraft" type="button">保存到草稿箱</button>` : ""}
      <button class="ghost-button" data-pjf-close type="button">取消</button>
      <button class="primary-button" id="pjfSave" type="button">${edit ? "保存" : "创建项目"}</button></div>`;
  const personChip = (value, target) => {
    const member = staff.find((item) => pjStaffValue(item) === value);
    const name = member?.name || value;
    const avatar = member?.avatar || ROLE_AVATARS[member?.role] || "";
    return `<span class="pjf-person-chip">
      <i${avatar ? ` style="background-image:url('${escapeHtml(avatar)}')"` : ""}>${avatar ? "" : escapeHtml(name.slice(0, 1))}</i>
      <b>${escapeHtml(name)}</b>
      <button type="button" data-pjf-remove-person="${escapeHtml(target)}" data-pjf-person-value="${escapeHtml(value)}" aria-label="移除 ${escapeHtml(name)}">×</button>
    </span>`;
  };
  const renderPickedPeople = () => {
    const render = (target, values) => {
      const el = document.querySelector(`[data-pjf-member-summary="${target}"]`);
      if (!el) return;
      const list = (Array.isArray(values) ? values : [values]).filter(Boolean);
      el.innerHTML = list.length
        ? list.map((value) => personChip(value, target)).join("")
        : `<span>尚未选择</span>`;
    };
    render("designer", pickedDesigners);
    render("painter", pickedPainters);
    render("sales", pickedSales);
    render("owner", pickedOwners);
    if (pickedOwners.length) document.querySelector('[data-pjf-field="owner"]')?.classList.remove("has-error");
    document.querySelectorAll("[data-pjf-remove-person]").forEach((button) => button.addEventListener("click", () => {
      const value = button.dataset.pjfPersonValue;
      if (button.dataset.pjfRemovePerson === "designer") pickedDesigners = pickedDesigners.filter((item) => item !== value);
      if (button.dataset.pjfRemovePerson === "painter") pickedPainters = pickedPainters.filter((item) => item !== value);
      if (button.dataset.pjfRemovePerson === "sales") pickedSales = pickedSales.filter((item) => item !== value);
      if (button.dataset.pjfRemovePerson === "owner") pickedOwners = pickedOwners.filter((item) => item !== value);
      renderPickedPeople();
    }));
  };
  const renderPickedFiles = () => {
    const host = document.getElementById("pjfFiles");
    if (!host) return;
    host.innerHTML = pickedFiles.map((file, index) => {
      const isImage = String(file.type || "").startsWith("image/");
      return `<article class="pjf-file-card">
        <div class="pjf-file-preview${isImage ? " is-image" : ""}">
          ${isImage && file.key
            ? `<img data-image-key="${escapeHtml(file.key)}" alt="${escapeHtml(file.name || "项目图片")}" width="800" height="600" loading="lazy" decoding="async" />`
            : `<span class="pjf-document-icon">${escapeHtml((file.name || "FILE").split(".").pop().slice(0, 3).toUpperCase())}</span>`}
          ${isImage ? `<button class="pjf-file-open" type="button" data-pjf-preview-file="${index}" aria-label="放大查看 ${escapeHtml(file.name || "项目图片")}"></button>` : ""}
          <button type="button" data-pjf-remove-file="${index}" aria-label="移除 ${escapeHtml(file.name || "文件")}">×</button>
        </div>
        <small title="${escapeHtml(file.name || "文件")}">${escapeHtml(file.name || "文件")}</small>
      </article>`;
    }).join("") + `<label class="pjf-file-add">
      <svg class="pjf-upload-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 13v6h14v-6"/></svg>
      <b>上传文件</b>
      <input id="pjfFileInput" type="file" multiple hidden />
    </label>`;
    hydrateLazyKeyImages(host);
    host.querySelectorAll("[data-pjf-preview-file]").forEach((button) => button.addEventListener("click", () => {
      const file = pickedFiles[Number(button.dataset.pjfPreviewFile)];
      if (file) pjOpenFilePreview(file);
    }));
    host.querySelectorAll("[data-pjf-remove-file]").forEach((button) => button.addEventListener("click", () => {
      pickedFiles.splice(Number(button.dataset.pjfRemoveFile), 1);
      renderPickedFiles();
    }));
    host.querySelector("#pjfFileInput")?.addEventListener("change", async (event) => {
      const files = [...(event.target.files || [])];
      if (!files.length) return;
      const addTile = host.querySelector(".pjf-file-add");
      addTile?.classList.add("loading");
      for (const file of files) {
        const key = `pjfile_${formFileNamespace}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        try {
          await saveImageToDB(key, file);
          pickedFiles.push({
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            key,
            uploadedBy: currentAccount.name || currentAccount.role,
            uploadedAt: formatDateTime(),
          });
        } catch (error) {
          console.error(error);
          showToast(`文件「${file.name}」上传失败。`, "error");
        }
      }
      renderPickedFiles();
    });
  };
  renderPickedPeople();
  renderPickedFiles();
  document.querySelector('[data-pjf-member-picker="designer"]')?.addEventListener("click", () => {
    pjOpenCreateMemberPicker({
      title: "选择设计师",
      roles: ["设计师"],
      current: pickedDesigners,
      onSave: (values) => { pickedDesigners = values; renderPickedPeople(); },
    });
  });
  document.querySelector('[data-pjf-member-picker="painter"]')?.addEventListener("click", () => {
    pjOpenCreateMemberPicker({
      title: "选择手绘师",
      roles: ["手绘师"],
      current: pickedPainters,
      onSave: (values) => { pickedPainters = values; renderPickedPeople(); },
    });
  });
  document.querySelector('[data-pjf-member-picker="sales"]')?.addEventListener("click", () => {
    pjOpenCreateMemberPicker({
      title: "选择销售",
      roles: ["销售"],
      current: pickedSales,
      onSave: (values) => { pickedSales = values; renderPickedPeople(); },
    });
  });
  document.querySelector('[data-pjf-member-picker="owner"]')?.addEventListener("click", () => {
    pjOpenCreateMemberPicker({
      title: "选择负责人",
      roles: ["管理员", "设计师", "手绘师", "销售"],
      current: pickedOwners,
      onSave: (values) => { pickedOwners = values; renderPickedPeople(); },
    });
  });
  const formCustomerInput = document.getElementById("pjfCust");
  const formCustomerCombo = document.querySelector(".pjf-customer-combo");
  const openFormCustomerMenu = (query = formCustomerInput?.value || "") => {
    if (!formCustomerInput || !formCustomerCombo) return;
    const customerOptions = pjCustomerOptions();
    pjOpenCustomerCompanyMenu(
      formCustomerCombo,
      customerOptions,
      formCustomerInput.value,
      query,
      (value) => {
        formCustomerInput.value = value;
        showToast("已关联客户中心的客户。", "success");
      },
      (companyName) => {
        pjPendingCustomerLink = { formCustomerInputId: "pjfCust" };
        openCustomerModal();
        if (customerCompanyInput) customerCompanyInput.value = companyName;
        customerNameInput?.focus();
      },
    );
  };
  document.querySelector("[data-pjf-customer-list]")?.addEventListener("click", () => openFormCustomerMenu());
  formCustomerInput?.addEventListener("focus", () => openFormCustomerMenu(formCustomerInput.value));
  formCustomerInput?.addEventListener("input", () => openFormCustomerMenu(formCustomerInput.value));
  const syncCust = () => {
    document.getElementById("pjfCustWrap").style.display =
      document.getElementById("pjfType").value === "定制" ? "" : "none";
  };
  document.getElementById("pjfType").addEventListener("change", syncCust); syncCust();
  const formData = () => {
    const name = document.getElementById("pjfName").value.trim();
    const type = document.getElementById("pjfType").value;
    return {
      name, type,
      customer: type === "定制" ? document.getElementById("pjfCust").value.trim() : "",
      startDate: document.getElementById("pjfStart").value,
      deadline: document.getElementById("pjfDl").value,
      desc: document.getElementById("pjfDesc").value.trim(),
      owner: pickedOwners[0] || "",
      owners: pickedOwners,
      members: [...new Set([...pickedSales, ...pickedDesigners, ...pickedPainters, ...pickedOwners].filter(Boolean))],
      files: pickedFiles,
      stage: p.stage || PJ_STAGES[0].key,
    };
  };
  const clearValidation = () => {
    ov.querySelectorAll("[data-pjf-field].has-error").forEach((field) => field.classList.remove("has-error"));
  };
  const validateForCreate = (data) => {
    clearValidation();
    const invalid = [];
    if (!data.name) invalid.push(["name", "请填写项目名称。"]);
    if (!data.startDate) invalid.push(["start", "请选择项目开始日期。"]);
    if (!data.deadline) invalid.push(["deadline", "请选择项目结束日期。"]);
    if (!data.owner) invalid.push(["owner", "请选择项目负责人。"]);
    if (data.startDate && data.deadline && data.startDate > data.deadline) {
      invalid.push(["deadline", "结束日期不能早于开始日期。"]);
      const error = ov.querySelector('[data-pjf-field="deadline"] .pjf-error');
      if (error) error.textContent = "结束日期不能早于开始日期";
    }
    invalid.forEach(([field]) => ov.querySelector(`[data-pjf-field="${field}"]`)?.classList.add("has-error"));
    if (invalid.length) {
      const first = ov.querySelector(`[data-pjf-field="${invalid[0][0]}"]`);
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.querySelector("input, button")?.focus();
      showToast(invalid[0][1], "warning");
      return false;
    }
    return true;
  };
  ov.querySelectorAll("[data-pjf-field] input").forEach((input) => input.addEventListener("input", () => {
    input.closest("[data-pjf-field]")?.classList.remove("has-error");
  }));
  document.getElementById("pjfDraft")?.addEventListener("click", () => {
    const data = formData();
    const draftId = draft?.id || `PJD${Date.now()}`;
    const nextDraft = { ...data, id: draftId, savedAt: formatDateTime() };
    pjProjectDrafts = [nextDraft, ...pjProjectDrafts.filter((item) => item.id !== draftId)];
    pjSaveDrafts();
    ov.classList.remove("open");
    lockBodyScroll(ov.dataset.keepBodyLocked === "1");
    showToast("项目已保存到草稿箱。", "success");
  });
  document.getElementById("pjfSave").addEventListener("click", () => {
    const data = formData();
    let createdProject = null;
    if (!validateForCreate(data)) return;
    if (edit) {
      Object.assign(edit, data); pjPush(edit, "项目信息已更新");
    } else {
      const np = { id: `PJ${Date.now()}`, stage: PJ_STAGES[0].key, createdAt: formatDateTime(), tasks: [], files: [], feed: [], seen: {}, ...data };
      pjPush(np, "项目已创建", "ok");
      pjProjects.unshift(np);
      createdProject = np;
      if (draft?.id) {
        pjProjectDrafts = pjProjectDrafts.filter((item) => item.id !== draft.id);
        pjSaveDrafts();
      }
    }
    pjSave(); ov.classList.remove("open"); lockBodyScroll(ov.dataset.keepBodyLocked === "1");
    renderProjectsView();
    if (pjActiveId) pjRenderDetail(pjById(pjActiveId));
    if (createdProject) options.onCreated?.(createdProject);
    showToast(edit ? "项目已更新。" : "项目已创建。", "success");
  });
  ov.classList.add("open"); lockBodyScroll(true);
}

/* ---- 草稿箱 ---- */
function pjOpenDrafts() {
  let ov = document.getElementById("pjDraftOv");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "pjDraftOv";
    document.body.appendChild(ov);
  }
  const render = () => {
    ov.innerHTML = `<div class="pjf-scrim" data-pjdraft-close></div>
      <div class="pjf-box wide" role="dialog" aria-modal="true" aria-labelledby="pjDraftTitle">
        <div class="pjf-head"><div><p class="pjm-eyebrow">PROJECT DRAFTS</p><h3 id="pjDraftTitle">草稿箱（${pjProjectDrafts.length}）</h3></div>
          <button class="pjd-x" data-pjdraft-close type="button">×</button></div>
        <div class="pjf-body pjdraft-list">${pjProjectDrafts.length ? pjProjectDrafts.map((draft) => `
          <article class="pjdraft-row">
            <div><strong>${escapeHtml(draft.name || "未命名项目")}</strong>
              <small>${draft.type === "定制" ? "客户定制项目" : "内部项目"} · 最后保存 ${escapeHtml(draft.savedAt || "—")}</small></div>
            <div class="pjdraft-actions">
              <button class="ghost-button" data-pjdraft-edit="${escapeHtml(draft.id)}" type="button">继续编辑</button>
              <button class="primary-button" data-pjdraft-create="${escapeHtml(draft.id)}" type="button">正式创建</button>
              <button class="pjdraft-delete" data-pjdraft-delete="${escapeHtml(draft.id)}" type="button">删除</button>
            </div>
          </article>`).join("") : `<p class="pjd-empty">草稿箱为空。</p>`}</div>
      </div>`;
    ov.querySelectorAll("[data-pjdraft-close]").forEach((button) => button.addEventListener("click", close));
    ov.querySelectorAll("[data-pjdraft-edit]").forEach((button) => button.addEventListener("click", () => {
      const draft = pjProjectDrafts.find((item) => item.id === button.dataset.pjdraftEdit);
      if (!draft) return;
      close();
      pjOpenForm(null, draft);
    }));
    ov.querySelectorAll("[data-pjdraft-create]").forEach((button) => button.addEventListener("click", () => {
      const draft = pjProjectDrafts.find((item) => item.id === button.dataset.pjdraftCreate);
      if (!draft) return;
      close();
      pjOpenForm(null, draft);
      showToast("请补全项目名称、项目时间和负责人后正式创建。", "info");
    }));
    ov.querySelectorAll("[data-pjdraft-delete]").forEach((button) => button.addEventListener("click", () => {
      const draft = pjProjectDrafts.find((item) => item.id === button.dataset.pjdraftDelete);
      if (!draft || !window.confirm(`删除草稿「${draft.name}」？`)) return;
      pjProjectDrafts = pjProjectDrafts.filter((item) => item.id !== draft.id);
      pjSaveDrafts();
      render();
    }));
  };
  const close = () => { ov.classList.remove("open"); lockBodyScroll(false); };
  render();
  ov.classList.add("open");
  lockBodyScroll(true);
}

/* ---- 历史项目 ---- */
function pjOpenArchive() {
  let ov = document.getElementById("pjArcOv");
  if (!ov) {
    ov = document.createElement("div"); ov.id = "pjArcOv";
    ov.innerHTML = `<div class="pjf-scrim" data-pja-close></div><div class="pjf-box wide" id="pjaBox"></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-pja-close]")) { ov.classList.remove("open"); lockBodyScroll(false); }
      const r = e.target.closest("[data-pja-open]");
      if (r) { ov.classList.remove("open"); lockBodyScroll(false); pjOpenDetail(r.dataset.pjaOpen); }
    });
  }
  const list = pjProjects.filter((p) => p.archived);
  document.getElementById("pjaBox").innerHTML = `
    <div class="pjf-head"><h3>历史项目（${list.length}）</h3><button class="pjd-x" data-pja-close type="button">×</button></div>
    <div class="pjf-body">${list.length ? list.map((p) => `
      <button class="pja-row" data-pja-open="${escapeHtml(p.id)}" type="button">
        <span class="pja-n"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.customerCompany || p.customer || p.type || "内部")} · ${p.completed ? "已完成" : "已归档"} · ${escapeHtml(p.archivedAt || "—")}</small></span>
        <span class="pja-t">${pjPatternsOf(p).length} 款稿件</span></button>`).join("")
      : `<p class="pjd-empty">还没有归档的项目。</p>`}</div>`;
  ov.classList.add("open"); lockBodyScroll(true);
}

/* ---- 事件绑定 ---- */
document.querySelector("#pjNew")?.addEventListener("click", () => pjOpenForm(null));
document.querySelector("#pjOpenDrafts")?.addEventListener("click", () => {
  if (!canCreateProject()) return;
  pjOpenDrafts();
});
document.querySelector("#pjOpenArchive")?.addEventListener("click", pjOpenArchive);
document.querySelector("#pjDetailBack")?.addEventListener("click", pjCloseDetail);

const pjBoardEl = document.querySelector("#pjBoard");
pjBoardEl?.addEventListener("click", (e) => {
  const create = e.target.closest("[data-pj-create-stage]");
  if (create) {
    pjOpenForm(null, { stage: create.dataset.pjCreateStage || PJ_STAGES[0].key });
    return;
  }
  const c = e.target.closest("[data-pj-card]");
  if (c) { pjOpenDetail(c.dataset.pjCard); return; }
  const pc = e.target.closest("[data-pj-pattern]");
  if (pc) { const card = sourceCardByFile(pc.dataset.pjPattern); if (card) openLightbox(card, { worksLibrary: true }); }
});
let pjDragId = null, pjDragFile = null;
pjBoardEl?.addEventListener("dragstart", (e) => {
  const c = e.target.closest("[data-pj-card]"); const pc = e.target.closest("[data-pj-pattern]");
  pjDragId = c?.dataset.pjCard || null; pjDragFile = pc?.dataset.pjPattern || null;
  if (c || pc) {
    e.dataTransfer.effectAllowed = "move";
    document.body.classList.add("pj-dragging");
    requestAnimationFrame(() => (c || pc)?.classList.add("is-dragging"));
  }
});
pjBoardEl?.addEventListener("dragend", () => {
  document.body.classList.remove("pj-dragging");
  pjBoardEl.querySelectorAll(".pj-col.over, .pj-card.is-dragging").forEach((item) => item.classList.remove("over", "is-dragging"));
  pjDragId = null;
  pjDragFile = null;
});
pjBoardEl?.addEventListener("dragover", (e) => {
  const col = e.target.closest(".pj-col"); if (!col) return;
  e.preventDefault(); col.classList.add("over");
});
pjBoardEl?.addEventListener("dragleave", (e) => e.target.closest(".pj-col")?.classList.remove("over"));
pjBoardEl?.addEventListener("drop", (e) => {
  const col = e.target.closest(".pj-col"); if (!col) return;
  e.preventDefault(); col.classList.remove("over");
  if (pjDragId) {
    const to = col.dataset.pjStage;
    const result = pjMoveProjectStage(pjDragId, to);
    if (!result.ok) {
      showToast(result.reason === "final" ? "只有管理员可以将项目推进到内部定稿。" : "你只能移动自己负责的项目。", "warning");
      pjDragId = null;
      document.body.classList.remove("pj-dragging");
      return;
    }
    if (!result.unchanged) {
      renderProjectsView();
      if (pjActiveId === result.project.id) pjRenderDetail(result.project);
      showToast(`「${result.project.name}」已进入${to}。`, "success");
    }
  } else if (pjDragFile) {
    const to = col.dataset.pjPstage; const card = sourceCardByFile(pjDragFile);
    if (card && to) { card.dataset.pjStage = to; saveStudioState(); renderProjectsView(); showToast(`稿件已移动到${to}。`, "success"); }
  }
  document.body.classList.remove("pj-dragging");
  pjDragId = null; pjDragFile = null;
});

/** 上传弹窗打开时填充项目下拉（只列进行中的项目） */
function pjFillUploadSelect() {
  const picker = document.querySelector("#uploadProjectPicker");
  const hidden = document.querySelector("#uploadProjectSelect");
  const search = document.querySelector("#uploadProjectSearch");
  const results = document.querySelector("#uploadProjectResults");
  if (!picker || !hidden || !search || !results) return;
  const list = () => pjProjects.filter((project) => !project.archived);
  const render = (query = "") => {
    const keyword = query.trim().toLowerCase();
    const matches = list().filter((project) =>
      !keyword || searchMatches(keyword, [project.name, project.type, project.customer])
    ).slice(0, 12);
    results.innerHTML = `
      <button class="upload-project-option none${!hidden.value ? " selected" : ""}" data-upload-project="" type="button"><span><strong>不关联项目</strong><small>作为自主稿提交评审</small></span><em>${!hidden.value ? "当前选择" : ""}</em></button>
      ${matches.map((project) => `<button class="upload-project-option${hidden.value === project.id ? " selected" : ""}" data-upload-project="${escapeHtml(project.id)}" type="button">
        <span><strong>${escapeHtml(project.name)}</strong><small>${project.type === "定制" ? "客户定制项目" : "内部项目"}${project.customer ? ` · ${escapeHtml(project.customer)}` : ""}</small></span>
        <em>${escapeHtml(project.stage || PJ_STAGES[0].key)}</em>
      </button>`).join("")}
      ${canCreateProject() ? `<button class="upload-project-create" data-upload-project-create type="button">＋ 新建项目${query.trim() ? `「${escapeHtml(query.trim())}」` : ""}</button>` : ""}`;
    results.classList.remove("hidden");
  };
  if (!picker.dataset.bound) {
    picker.dataset.bound = "true";
    search.addEventListener("focus", () => {
      if (!hidden.value && search.value === "不关联项目") search.select();
      render(!hidden.value && search.value === "不关联项目" ? "" : search.value);
    });
    search.addEventListener("input", () => render(search.value));
    results.addEventListener("mousedown", (event) => event.preventDefault());
    results.addEventListener("click", (event) => {
      const option = event.target.closest("[data-upload-project]");
      if (option) {
        hidden.value = option.dataset.uploadProject || "";
        const project = pjById(hidden.value);
        search.value = project?.name || "不关联项目";
        results.classList.add("hidden");
        return;
      }
      if (event.target.closest("[data-upload-project-create]")) {
        const name = search.value.trim();
        results.classList.add("hidden");
        pjOpenForm(null, { name, stage: PJ_STAGES[0].key }, {
          keepBodyLocked: true,
          onCreated: (project) => {
            hidden.value = project.id;
            search.value = project.name;
            renderProjectsView();
            lockBodyScroll(true);
            showToast(`已创建并关联项目「${project.name}」。`, "success");
          },
        });
      }
    });
    search.addEventListener("blur", () => setTimeout(() => results.classList.add("hidden"), 120));
  }
  hidden.value = "";
  search.value = "不关联项目";
  search.placeholder = "搜索";
  results.classList.add("hidden");
}

/** 客户可见性：关联项目且未发布的稿件不进公共池；已发布的定制稿只对该客户可见 */
function pjCustomerMatches(project, company) {
  const expected = String(project?.customerCompany || project?.customer || "").trim().toLowerCase();
  const actual = String(company || "").trim().toLowerCase();
  return Boolean(expected && actual && (expected === actual || expected.includes(actual) || actual.includes(expected)));
}

function pjVisibleToCustomer(card, company) {
  const pid = card.dataset.projectId;
  if (pid) {
    const p = pjById(pid);
    if (!p) return false;
    // 客户看稿时，已审核通过且属于该客户的定制项目稿直接可见；
    // “定稿发布”只控制是否进入公共池，不应挡住客户自己的定制稿。
    if (p.type === "定制") return pjCustomerMatches(p, company);
    if (!p.published) return false;
    const ex = card.dataset.exclusiveCustomer || "";
    if (ex) return String(ex).trim().toLowerCase() === String(company || "").trim().toLowerCase();
  }
  const ex = card.dataset.exclusiveCustomer || "";
  if (ex) return String(ex).trim().toLowerCase() === String(company || "").trim().toLowerCase();
  return true;
}

/* ============ 兼容桩结束 ============ */

const titleMap = {
  dashboard: "管理员总控制台",
  review: "每日稿件评审",
  projects: "项目管理",
  team: "我的团队",
  designer: "设计师个人界面",
  resources: "资源库",
  library: "客户中心",
  cart: "选稿车",
  orders: "订单中心",
  sleep: "稿件休眠区",
  recycle: "回收站",
};

const roleDashboardTitles = {
  管理员: "管理员总控制台",
  设计师: "设计师总控制台",
  手绘师: "手绘师总控制台",
  销售: "销售总控制台",
};

const RELEASE_CONFIG = window.KING_RELEASE_CONFIG || {};
if (RELEASE_CONFIG.seedDemoData === false) {
  try {
    const resetKey = "king_nas_empty_state_reset_v2";
    if (localStorage.getItem(resetKey) !== "1") {
      localStorage.clear();
      localStorage.setItem(resetKey, "1");
    }
  } catch (error) {
    console.warn("NAS empty-state reset unavailable", error);
  }
}
const demoAccounts = {
  admin: { password: "admin123", role: "管理员", name: "管理员 / 总控", ownerKey: "admin" },
  designer: { password: "designer123", role: "设计师", name: "设计师", ownerKey: "designer" },
  painter: { password: "painter123", role: "手绘师", name: "手绘师", ownerKey: "painter" },
  sales: { password: "sales123", role: "销售", name: "销售", ownerKey: "sales" },
};
const AUTH_SESSION_KEY = "king_backend_auth_session_v1";
const BACKEND_STUDIO_SYNC_KEY = "king_backend_studio_sync_v1";
const NAS_SYNC_TIME_KEY = "king_nas_sync_time_v1";
let backendSyncQueue = Promise.resolve();
let backendLastSyncAttempt = Promise.resolve();
let salesLibraryRefreshPromise = null;
let nasSyncWriteQueue = Promise.resolve();
let backendSyncPollTimer = null;
let nasSyncPollTimer = null;
let backendRealtimeSocket = null;
let backendRealtimeReconnectTimer = null;
const backendRealtimeSeen = new Set();
let backendAuthRefreshPromise = null;
let pendingCloudStudioCleanup = false;
let pendingCloudStudioCleanupPreviousState = null;

function backendAuthSession() {
  try { return JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY) || "null"); } catch { return null; }
}

function backendTokenExpiresAt(session) {
  if (Number(session?.expiresAt) > 0) return Number(session.expiresAt);
  try {
    const payload = JSON.parse(atob(String(session?.accessToken || "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Number(payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

function storeBackendAuthSession(session) {
  const expiresIn = Number(session?.expiresIn || 0);
  const normalized = {
    ...session,
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : backendTokenExpiresAt(session),
  };
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(normalized));
  return normalized;
}

function backendSessionIsExpired(session, leewayMs = 0) {
  const expiresAt = backendTokenExpiresAt(session);
  return Boolean(expiresAt && expiresAt <= Date.now() + leewayMs);
}

async function refreshBackendAuthSession({ force = false } = {}) {
  const session = backendAuthSession();
  if (!session?.refreshToken) return session;
  if (!force && !backendSessionIsExpired(session, 90_000)) return session;
  if (backendAuthRefreshPromise) return backendAuthRefreshPromise;
  backendAuthRefreshPromise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${String(RELEASE_CONFIG.apiBaseUrl || "").replace(/\/$/, "")}/api/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(result.error || "AUTH_REFRESH_FAILED"), {
        code: result.error || "AUTH_REFRESH_FAILED",
        status: response.status,
      });
      return storeBackendAuthSession({ ...session, ...result, account: session.account });
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => { backendAuthRefreshPromise = null; });
  return backendAuthRefreshPromise;
}

async function authenticateEmployee(username, password) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(`${String(RELEASE_CONFIG.apiBaseUrl || "").replace(/\/$/, "")}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
  } catch (error) {
    throw Object.assign(new Error(error?.name === "AbortError" ? "LOGIN_TIMEOUT" : "LOGIN_FAILED"), {
      code: error?.name === "AbortError" ? "LOGIN_TIMEOUT" : "LOGIN_FAILED",
    });
  } finally {
    clearTimeout(timeout);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "LOGIN_FAILED");
    error.code = result.error;
    throw error;
  }
  storeBackendAuthSession(result);
  return result.account;
}

function backendSyncMeta() {
  try { return JSON.parse(sessionStorage.getItem(BACKEND_STUDIO_SYNC_KEY) || "null"); } catch { return null; }
}

function writeBackendSyncMeta(record) {
  sessionStorage.setItem(BACKEND_STUDIO_SYNC_KEY, JSON.stringify(record));
}

async function backendApi(path, options = {}) {
  let session = await refreshBackendAuthSession().catch((error) => {
    const current = backendAuthSession();
    if (!backendSessionIsExpired(current)) return current;
    throw error;
  });
  if (!session?.accessToken) throw Object.assign(new Error("UNAUTHENTICATED"), { code: "UNAUTHENTICATED" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    const request = () => fetch(`${String(RELEASE_CONFIG.apiBaseUrl || "").replace(/\/$/, "")}${path}`, {
        ...options,
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "content-type": "application/json",
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });
    response = await request();
    if (response.status === 401 && session.refreshToken) {
      session = await refreshBackendAuthSession({ force: true });
      response = await request();
    }
  } catch (error) {
    throw Object.assign(new Error(error?.name === "AbortError" ? "BACKEND_REQUEST_TIMEOUT" : "BACKEND_REQUEST_FAILED"), {
      code: error?.name === "AbortError" ? "BACKEND_REQUEST_TIMEOUT" : "BACKEND_REQUEST_FAILED",
    });
  } finally {
    clearTimeout(timeout);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error || "BACKEND_REQUEST_FAILED"), {
    code: result.error || "BACKEND_REQUEST_FAILED",
    status: response.status,
  });
  return result;
}

async function backendStudioAsset(key, options = {}) {
  let session = await refreshBackendAuthSession().catch((error) => {
    const current = backendAuthSession();
    if (!backendSessionIsExpired(current)) return current;
    throw error;
  });
  if (!session?.accessToken) throw Object.assign(new Error("UNAUTHENTICATED"), { code: "UNAUTHENTICATED" });
  const { action, ...fetchOptions } = options;
  const query = `${action ? `action=${encodeURIComponent(action)}&` : ""}key=${encodeURIComponent(key)}`;
  const request = () => fetch(`${String(RELEASE_CONFIG.apiBaseUrl || "").replace(/\/$/, "")}/api/admin/studio-assets?${query}`, {
      ...fetchOptions,
      headers: { authorization: `Bearer ${session.accessToken}`, ...(options.headers || {}) },
    });
  let response = await request();
  if (response.status === 401 && session.refreshToken) {
    session = await refreshBackendAuthSession({ force: true });
    response = await request();
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw Object.assign(new Error(detail.error || "STUDIO_ASSET_REQUEST_FAILED"), { code: detail.error, status: response.status });
  }
  return response;
}

async function provisionBackendEmployeeAccount({ username, password, role, name, allowExisting = false }) {
  if (!RELEASE_CONFIG.useBackendAuth) return null;
  return backendApi("/api/admin/studio-state?action=provision-employee", {
    method: "POST",
    body: JSON.stringify({ username, password: password || "", role, name, allowExisting }),
  });
}

async function deprovisionBackendEmployeeAccount({ username }) {
  if (!RELEASE_CONFIG.useBackendAuth) return null;
  return backendApi("/api/admin/studio-state?action=deprovision-employee", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

async function uploadBackendStudioAssetOnce(key, imageData, { onProgress } = {}) {
  const ticket = await backendStudioAsset(key, { method: "POST", action: "sign-upload", headers: { "content-type": "application/json" } });
  const { signedUrl } = await ticket.json();
  if (!signedUrl) throw Object.assign(new Error("STUDIO_ASSET_SIGN_FAILED"), { code: "STUDIO_ASSET_SIGN_FAILED" });
  await new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.timeout = 600000;
    request.setRequestHeader("x-upsert", "true");
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      if (typeof onProgress === "function") onProgress(event.loaded, event.total);
      else if (appLoadingText) appLoadingText.textContent = `正在上传 ${imageData?.name || "图片"}（${percent}%）`;
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) return resolve();
      let detail = {};
      try { detail = JSON.parse(request.responseText || "{}"); } catch {}
      reject(Object.assign(new Error(detail.message || detail.error || "STUDIO_ASSET_UPLOAD_FAILED"), {
        code: detail.error || "STUDIO_ASSET_UPLOAD_FAILED",
        status: request.status,
        detail: request.responseText || "",
      }));
    };
    request.onerror = () => reject(Object.assign(new Error("STUDIO_ASSET_UPLOAD_FAILED"), { code: "STUDIO_ASSET_UPLOAD_FAILED" }));
    request.ontimeout = () => reject(Object.assign(new Error("STUDIO_ASSET_UPLOAD_TIMEOUT"), { code: "STUDIO_ASSET_UPLOAD_TIMEOUT" }));
    // Supabase signed uploads accept Blob/File payloads as multipart form data.
    // Let the browser add the boundary; setting content-type manually returns 400.
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", imageData);
    request.send(body);
  });
}

async function uploadBackendStudioAsset(key, imageData, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await uploadBackendStudioAssetOnce(key, imageData, options);
      return;
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const code = String(error?.code || error?.message || "");
      const retryable = !status || status === 408 || status === 429 || status >= 500
        || /TIMEOUT|REQUEST_FAILED|UPLOAD_FAILED|SIGN_FAILED/.test(code);
      if (!retryable || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }
  throw lastError;
}

async function deleteBackendStudioAsset(key) {
  if (!RELEASE_CONFIG.useBackendAuth || !key) return;
  try {
    await backendStudioAsset(key, { method: "DELETE" });
  } catch (error) {
    if (error?.status !== 404) throw error;
  }
}

function resetStudioRuntimeBeforeCloudHydration() {
  // 稿件分页会把未显示节点移动到 parking。云端重新水合时必须同时清掉
  // 主容器和停放区，否则每恢复一次会话就会再创建一套相同稿件。
  [...workCards].forEach((card) => card?.remove());
  worksBoard?.querySelectorAll(".work-card").forEach((card) => card.remove());
  workCardParking?.querySelectorAll(".work-card").forEach((card) => card.remove());
  workCards = [];
  invalidateCardIndex();
  workRecordCache.clear();
  dirtyWorkFiles.clear();
  workRecordCacheReady = false;
  globalTags.splice(0, globalTags.length);
  pendingTagApplications.splice(0, pendingTagApplications.length);
  dismissedNotifications.clear();
  activityNotifications = [];
  customProjects = [];
  customCustomers = [];
  projectBoardOverrides = {};
  resourceFolders = [];
  teamResources = [];
  teamMembers.splice(0, teamMembers.length);
  Object.entries(DEFAULT_TAG_CATEGORIES).forEach(([key, values]) => {
    managedTagCategories[key] = RELEASE_CONFIG.seedDemoData === false ? [] : [...values];
  });
  Object.keys(managedTagCategories).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_TAG_CATEGORIES, key)) delete managedTagCategories[key];
  });
  Object.assign(managedTagCategoryLabels, {
    workType: "作品类型",
    patternForm: "图案形式",
    theme: "主题",
    style: "风格",
  });
  studioState = createEmptyStudioState();
}

function dedupeCreatedWorks(records) {
  const unique = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const file = String(record?.file || "").trim();
    if (!file) return;
    unique.set(file, record);
  });
  return [...unique.values()];
}

function normalizeStudioStateRecords(state) {
  const normalized = state && typeof state === "object" ? { ...state } : {};
  const createdWorks = dedupeCreatedWorks(normalized.createdWorks);
  const changed = createdWorks.length !== (Array.isArray(normalized.createdWorks) ? normalized.createdWorks.length : 0);
  normalized.createdWorks = createdWorks;
  return { state: normalized, changed };
}

function changedStudioModules(localState, remoteState) {
  return [...new Set([...Object.keys(localState || {}), ...Object.keys(remoteState || {})])]
    .filter((module) => JSON.stringify(localState?.[module]) !== JSON.stringify(remoteState?.[module]));
}

function applyLightweightCloudModules(remoteState, changedModules) {
  studioState = { ...studioState, ...remoteState };
  if (changedModules.includes("orders")) studioOrders = Array.isArray(remoteState.orders) ? remoteState.orders : [];
  if (changedModules.includes("resourceFolders")) resourceFolders = Array.isArray(remoteState.resourceFolders) ? remoteState.resourceFolders : [];
  if (changedModules.includes("resources")) teamResources = Array.isArray(remoteState.resources) ? remoteState.resources : [];
  if (changedModules.includes("activityNotifications")) {
    activityNotifications = Array.isArray(remoteState.activityNotifications) ? remoteState.activityNotifications.slice(0, 80) : [];
  }
  if (changedModules.includes("dismissedNotifications")) {
    dismissedNotifications.clear();
    (remoteState.dismissedNotifications || []).forEach((key) => dismissedNotifications.add(key));
  }
  if (changedModules.includes("sharedWorkspaceLocalData")) restoreSharedWorkspaceLocalData(remoteState.sharedWorkspaceLocalData);
  if (changedModules.includes("personalWorkArchives")) {
    configureWorksView(roleSelect.value, currentAccount.ownerKey, activeWorksMode);
    renderSleepList();
    renderRecycleBin();
  }
  if (changedModules.includes("orders") && activeViewId() === "orders") renderOrderCenter();
  if ((changedModules.includes("resourceFolders") || changedModules.includes("resources")) && activeViewId() === "resources") renderResourceLibrary();
  renderNotifications();
  renderDashboardOverview(currentAccount.role);
  updateSidebarBadges();
}

function applyCloudStudioState(remoteState, remoteJson, changedModules) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  localStorage.setItem(STORAGE_KEY, remoteJson);
  lastPersistedStateJson = remoteJson;
  const lightweightModules = new Set([
    "orders", "resourceFolders", "resources", "activityNotifications",
    "dismissedNotifications", "sharedWorkspaceLocalData", "personalWorkArchives",
  ]);
  if (changedModules.length && changedModules.every((module) => lightweightModules.has(module))) {
    applyLightweightCloudModules(remoteState, changedModules);
    return;
  }
  resetStudioRuntimeBeforeCloudHydration();
  applyStoredState();
  syncRegisteredAccountsToTeam();
  syncProjectMemberOptions();
  syncCustomerOptions();
  configureWorksView(roleSelect.value, currentAccount.ownerKey, activeWorksMode);
  renderSleepList();
  renderRecycleBin();
  renderDailyReviewBoard();
  renderLibraryGrid();
  renderNotifications();
  renderDashboardOverview(currentAccount.role);
  updateSidebarBadges();
  const activeView = activeViewId();
  if (activeView === "team") renderTeamView();
  if (activeView === "projects") renderProjectsView();
  if (activeView === "orders") renderOrderCenter();
  if (activeView === "resources") renderResourceLibrary();
  requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
}

async function pullBackendStudioState({ refreshUi = false, checkRevision = false, showProgress = false } = {}) {
  if (!RELEASE_CONFIG.useBackendAuth || !backendAuthSession()?.accessToken) return false;
  if (showProgress) setAppLoadingProgress(32, "正在检查云端数据版本…");
  if (checkRevision) {
    const meta = await backendApi("/api/admin/studio-state?meta=1");
    const localRevision = Number(window.__kingLastBackendRevision || backendSyncMeta()?.revision || 0);
    if (Number(meta.revision || 0) === localRevision) return false;
  }
  if (showProgress) setAppLoadingProgress(48, "正在读取云端工作室数据…");
  const record = await backendApi("/api/admin/studio-state");
  const normalizedRemote = normalizeStudioStateRecords(record.state);
  const remoteState = normalizedRemote.state;
  if (normalizedRemote.changed) {
    pendingCloudStudioCleanup = true;
    pendingCloudStudioCleanupPreviousState = {
      createdWorks: Array.isArray(record.state?.createdWorks) ? record.state.createdWorks : [],
    };
  }
  const remoteJson = JSON.stringify(remoteState);
  const localJson = localStorage.getItem(STORAGE_KEY) || "";
  let localState = {};
  try { localState = JSON.parse(localJson || "{}"); } catch {}
  const changedModules = changedStudioModules(localState, remoteState);
  writeBackendSyncMeta({ revision: Number(record.revision || 0), state: remoteState });
  window.__kingLastBackendRevision = Number(record.revision || 0);
  if (remoteJson === localJson || (refreshUi && anyOverlayOpen())) return false;
  if (showProgress) setAppLoadingProgress(72, "正在合并云端数据…");
  if (refreshUi) applyCloudStudioState(remoteState, remoteJson, changedModules);
  else {
    localStorage.setItem(STORAGE_KEY, remoteJson);
    lastPersistedStateJson = remoteJson;
  }
  if (showProgress) setAppLoadingProgress(88, "云端数据已同步，正在打开工作台…");
  return true;
}

function backendWritableModules(role) {
  // 共享业务模块不属于某个员工的本机偏好，所有已授权员工都需要能写入，
  // 否则项目、选稿车和客户管理状态在服务端模式下会按角色丢失同步。
  const common = ["dismissedNotifications", "sharedWorkspaceLocalData"];
  if (role === "管理员") return null;
  if (role === "销售") return new Set([...common, "orders", "customers", "activityNotifications"]);
  if (role === "设计师" || role === "手绘师") {
    return new Set([...common, "createdWorks", "overrides", "removedFiles", "projects", "projectBoardOverrides", "activityNotifications", "personalWorkArchives"]);
  }
  return new Set(common);
}

function studioRecordIdentity(record) {
  if (record == null) return "";
  if (typeof record !== "object") return `${typeof record}:${String(record)}`;
  return record?.id || record?.file || record?.ownerKey || "";
}

function mergeStudioModule(module, remoteValue, localValue, previousValue) {
  // 冲突合并必须同时保留“新增/修改”和“删除”差异，否则远端旧记录会在
  // 永久删除后被重新并回数组，造成回收站看似清空但刷新后复活。
  if (Array.isArray(remoteValue) && Array.isArray(localValue)) {
    const previousRecords = new Map((Array.isArray(previousValue) ? previousValue : [])
      .map((record) => [studioRecordIdentity(record), record])
      .filter(([key]) => Boolean(key)));
    const localKeys = new Set(localValue.map(studioRecordIdentity).filter(Boolean));
    const removedKeys = new Set([...previousRecords.keys()].filter((key) => !localKeys.has(key)));
    const merged = new Map();
    remoteValue.forEach((record) => {
      const key = studioRecordIdentity(record);
      if (key && !removedKeys.has(key)) merged.set(key, record);
    });
    localValue.forEach((record) => {
      const key = studioRecordIdentity(record);
      if (!key) return;
      const previousRecord = previousRecords.get(key);
      const locallyChanged = !previousRecord || JSON.stringify(previousRecord) !== JSON.stringify(record);
      if (locallyChanged || !merged.has(key)) merged.set(key, record);
    });
    return [...merged.values()];
  }
  if (module === "personalWorkArchives" && remoteValue && localValue && typeof remoteValue === "object" && typeof localValue === "object") {
    return {
      ...remoteValue,
      [currentAccount.ownerKey]: localValue[currentAccount.ownerKey] || {},
    };
  }
  if (remoteValue && localValue && typeof remoteValue === "object" && typeof localValue === "object") {
    const merged = { ...remoteValue };
    Object.keys(previousValue || {}).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(localValue, key)) delete merged[key];
    });
    return { ...merged, ...localValue };
  }
  return localValue;
}

async function pushBackendStudioModules(previousState, nextState) {
  if (!RELEASE_CONFIG.useBackendAuth || !backendAuthSession()?.accessToken) return;
  const writable = backendWritableModules(currentAccount.role);
  const changed = Object.keys(nextState).filter((module) => {
    if (writable && !writable.has(module)) return false;
    return JSON.stringify(previousState?.[module]) !== JSON.stringify(nextState[module]);
  });
  for (const module of changed) {
    let meta = backendSyncMeta();
    if (!meta) {
      await pullBackendStudioState();
      meta = backendSyncMeta();
    }
    let valueToSend = nextState[module];
    const send = () => backendApi(`/api/admin/studio-state/modules/${encodeURIComponent(module)}`, {
      method: "PATCH",
      body: JSON.stringify({ value: valueToSend, revision: Number(backendSyncMeta()?.revision || 0) }),
    });
    let saved;
    try {
      saved = await send();
    } catch (error) {
      if (error.status !== 409) throw error;
      await pullBackendStudioState();
      valueToSend = mergeStudioModule(module, backendSyncMeta()?.state?.[module], valueToSend, previousState?.[module]);
      saved = await send();
    }
    writeBackendSyncMeta({ revision: Number(saved.revision || 0), state: saved.state || {} });
    window.__kingLastBackendRevision = Number(saved.revision || 0);
  }
}

function queueBackendStudioSync(previousState, nextState) {
  if (!RELEASE_CONFIG.useBackendAuth) {
    backendLastSyncAttempt = Promise.resolve();
    return backendLastSyncAttempt;
  }
  const syncWithRetry = async () => {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await pushBackendStudioModules(previousState, nextState);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
    throw lastError;
  };
  backendLastSyncAttempt = backendSyncQueue.then(syncWithRetry);
  backendSyncQueue = backendLastSyncAttempt
    .catch((error) => {
      console.warn("Backend studio sync failed", error);
      showToast?.("数据暂未同步到服务器，将在下次保存时重试。", "warning");
    });
  return backendLastSyncAttempt;
}

async function saveStudioStateToCloud() {
  if (!saveStudioState()) throw Object.assign(new Error("STUDIO_STATE_SAVE_FAILED"), { code: "STUDIO_STATE_SAVE_FAILED" });
  if (RELEASE_CONFIG.useBackendAuth) await backendLastSyncAttempt;
}

async function cleanupDuplicateCloudStudioRecords() {
  if (!pendingCloudStudioCleanup || !pendingCloudStudioCleanupPreviousState) return;
  if (!["管理员", "设计师", "手绘师"].includes(currentAccount.role)) return;
  const previousState = pendingCloudStudioCleanupPreviousState;
  const nextState = { createdWorks: dedupeCreatedWorks(studioState.createdWorks) };
  await pushBackendStudioModules(previousState, nextState);
  pendingCloudStudioCleanup = false;
  pendingCloudStudioCleanupPreviousState = null;
}

const ROUTABLE_VIEWS = new Set(["dashboard", "review", "team", "projects", "designer", "adminWorks", "library", "cart", "orders", "sleep", "recycle", "resources", "myLibrary", "myOrders"]);
let applyingBrowserRoute = false;

function updateBrowserRoute(view) {
  if (applyingBrowserRoute || !ROUTABLE_VIEWS.has(view)) return;
  const nextHash = `#${encodeURIComponent(view)}`;
  if (window.location.hash !== nextHash) window.history.pushState({ view }, "", nextHash);
}

function browserRouteView() {
  try {
    const view = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    return ROUTABLE_VIEWS.has(view) ? view : "";
  } catch {
    return "";
  }
}

function startBackendStudioPolling() {
  // Intranet deployment receives state changes over WebSocket. Keep polling only for legacy compatibility modes.
  if (RELEASE_CONFIG.deployment === "intranet") return;
  if (!RELEASE_CONFIG.useBackendAuth || backendSyncPollTimer) return;
  backendSyncPollTimer = setInterval(() => {
    backendSyncQueue.then(() => pullBackendStudioState({ refreshUi: true, checkRevision: true })).catch(() => {});
  }, 6000);
}

function startBackendRealtimeSync() {
  if (!RELEASE_CONFIG.useBackendAuth || RELEASE_CONFIG.deployment !== "intranet" || backendRealtimeSocket) return;
  const token = backendAuthSession()?.accessToken;
  if (!token) return;
  const connect = () => {
    if (typeof window.io !== "function") return;
    backendRealtimeSocket = window.io({ path: "/socket.io", transports: ["websocket"], auth: { token }, reconnection: true, reconnectionDelay: 1500 });
    backendRealtimeSocket.on("studio.changed", (message) => {
      const id = `${message.event || "event"}:${message.workId || message.module || ""}:${message.fileId || ""}:${message.version || ""}`;
      if (backendRealtimeSeen.has(id)) return;
      backendRealtimeSeen.add(id);
      if (backendRealtimeSeen.size > 200) backendRealtimeSeen.delete(backendRealtimeSeen.values().next().value);
      // Reconcile the authoritative snapshot in place so active work is not interrupted.
      backendSyncQueue.then(() => pullBackendStudioState({ refreshUi: true, checkRevision: true })).catch(() => {});
    });
    backendRealtimeSocket.on("disconnect", () => {
      backendRealtimeSocket = null;
      clearTimeout(backendRealtimeReconnectTimer);
      backendRealtimeReconnectTimer = setTimeout(startBackendRealtimeSync, 1500);
    });
    backendRealtimeSocket.on("connect_error", () => backendRealtimeSocket?.disconnect());
  };
  connect();
}

function startNasStudioPolling() {
  if (RELEASE_CONFIG.useBackendAuth || !window.kingNas?.syncRead || nasSyncPollTimer) return;
  nasSyncPollTimer = setInterval(() => {
    if (anyOverlayOpen() || uploadConfirm?.disabled) return;
    window.kingNas.syncRead().then((shared) => applyNasSharedState(shared, { reloadWhenChanged: true })).catch(() => {});
  }, 10000);
}

function refreshSalesLibrarySharedState() {
  if (currentAccount.role !== "销售" || salesLibraryRefreshPromise || anyOverlayOpen()) return;
  salesLibraryRefreshPromise = RELEASE_CONFIG.useBackendAuth
    ? pullBackendStudioState({ refreshUi: true })
    : window.kingNas?.syncRead
      ? window.kingNas.syncRead().then((shared) => applyNasSharedState(shared, { reloadWhenChanged: true }))
      : Promise.resolve(false);
  salesLibraryRefreshPromise
    .catch(() => {})
    .finally(() => { salesLibraryRefreshPromise = null; });
}

function applyNasSharedState(shared, { reloadWhenChanged = false } = {}) {
  if (!shared || typeof shared !== "object") return false;
  const syncedAt = Number(shared._syncedAt || 0);
  const { _syncedAt: _ignored, ...sharedState } = shared;
  const sharedJson = JSON.stringify(sharedState);
  const localJson = localStorage.getItem(STORAGE_KEY) || "";
  // 时间戳相同但内容不同，通常是本机缓存落后（例如另一台电脑刚完成写入），
  // 仍然要以共享文件内容为准，不能仅凭时间戳丢弃更新。
  if (syncedAt <= Number(window.__kingLastSync || 0) && sharedJson === localJson) return false;
  window.__kingLastSync = syncedAt;
  localStorage.setItem(NAS_SYNC_TIME_KEY, String(syncedAt));
  if (sharedJson === localJson || (reloadWhenChanged && anyOverlayOpen())) return false;
  localStorage.setItem(STORAGE_KEY, sharedJson);
  lastPersistedStateJson = sharedJson;
  if (reloadWhenChanged) location.reload();
  return true;
}

// 这些键包含业务信息，应与工作室状态一起共享；登录会话和个人偏好保持在本机。
const SHARED_WORKSPACE_LOCAL_KEYS = [
  "studio_site_projects_v1",
  "studio_site_project_drafts_v2",
  "studio_site_registered_accounts_v1",
  "studio_site_customer_management_v1",
  "studio_site_selection_carts_v1",
  "studio_site_customer_library_state_v1",
];

function readSharedWorkspaceLocalData() {
  const data = {};
  SHARED_WORKSPACE_LOCAL_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value != null) data[key] = value;
  });
  return data;
}

function restoreSharedWorkspaceLocalData(data) {
  if (!data || typeof data !== "object") return;
  SHARED_WORKSPACE_LOCAL_KEYS.forEach((key) => {
    if (typeof data[key] === "string") localStorage.setItem(key, data[key]);
  });
}

function readProfilePrefs() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeProfilePrefs(prefs) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(prefs));
}

function displayInitial(name) {
  const pureName = String(name || "").split("/")[0].trim();
  return pureName.slice(0, 1).toUpperCase() || "K";
}

function roleSubtitle(role) {
  const map = {
    管理员: "Administrator",
    设计师: "Designer",
    手绘师: "Painter",
    销售: "Sales",
  };
  return map[role] || "Team";
}

function applyProfilePrefs(account) {
  const prefs = readProfilePrefs();
  const profile = prefs[account.ownerKey] || {};
  const accountName = String(account.name || account.username || account.ownerKey || "").split("/")[0].trim();
  const displayName = RELEASE_CONFIG.useBackendAuth
    ? accountName
    : String(profile.name || accountName).split("/")[0].trim();
  if (RELEASE_CONFIG.useBackendAuth && Object.prototype.hasOwnProperty.call(profile, "name")) {
    const { name: _legacyLocalName, ...cloudProfile } = profile;
    prefs[account.ownerKey] = cloudProfile;
    writeProfilePrefs(prefs);
  }
  currentAccount.name = displayName;
  if (profileNameInput) profileNameInput.textContent = displayName;
  if (profileRoleLabel) profileRoleLabel.textContent = `${account.ownerKey} ${roleSubtitle(account.role)}`;
  if (userBadge) if (userBadge) userBadge.textContent = displayName;
  if (!profileAvatar) return;
  const avatarSource = profile.avatar || ROLE_AVATARS[account.role] || "";
  profileAvatar.textContent = avatarSource ? "" : displayInitial(displayName);
  profileAvatar.style.backgroundImage = avatarSource ? `url("${avatarSource}")` : "";
}

function saveCurrentProfilePatch(patch) {
  const prefs = readProfilePrefs();
  const key = currentAccount.ownerKey;
  prefs[key] = { ...(prefs[key] || {}), ...patch };
  writeProfilePrefs(prefs);
  applyProfilePrefs(currentAccount);
}

const STORAGE_KEY = "studio_site_design_ops_v2";
const SEED_VERSION = "library-2026-07-23c";
const SEED_VERSION_KEY = "studio_site_seed_version";
const LEGACY_AUTO_PRICE_MIGRATION_KEY = "studio_site_no_default_price_v1";
const PROFILE_KEY = "studio_site_profile_prefs_v1";
const REGISTERED_ACCOUNT_KEY = "studio_site_registered_accounts_v1";
const SESSION_KEY = "studio_site_active_account_v1";
const SESSION_ACCOUNT_DATA_KEY = "studio_site_active_account_data_v1";
const REMEMBERED_LOGIN_KEY = "studio_site_remembered_login_v1";
const PROJECT_DRAFT_KEY = "studio_site_project_drafts_v1";
const LAST_VIEW_KEY = "studio_site_last_view_by_account_v1";
const MAX_UPLOAD_FILES = 50;
// 所有上传文件统一限制为 100MB，避免 NAS 文件区被单个文件占满。
const MAX_IMAGE_FILE_BYTES = 100 * 1024 * 1024;
const MAX_SOURCE_FILE_BYTES = 100 * 1024 * 1024;
const MAX_DOCUMENT_FILE_BYTES = 100 * 1024 * 1024;
const MAX_RESOURCE_FILE_BYTES = 100 * 1024 * 1024;
const SUPPORTED_IMAGE_EXTENSIONS = ["tiff", "tif", "pcx", "psd", "psb", "ai", "eps", "jpeg", "jpg", "jepg", "png", "enc"];
const SUPPORTED_DOCUMENT_EXTENSIONS = ["zip", "pdf", "doc", "docx", "ppt", "pptx", "rar"];
const IMAGE_DB_NAME = "studio_site_design_images";
const IMAGE_DB_VERSION = 2;
const IMAGE_DATA_RESET_KEY = "king_image_data_reset_20260802_v1";
const EMPTY_WORK_LIBRARY_RESET_KEY = "king_empty_work_library_reset_20260802_v1";
const EMPTY_WORK_LIBRARY_MODE_KEY = "king_empty_work_library_mode_v1";
const EMPTY_PROJECT_LIBRARY_RESET_KEY = "king_empty_project_library_reset_20260802_v1";

function removeStoredImageReferences(record) {
  if (!record || typeof record !== "object") return;
  [
    "imageKey", "imageData", "paletteKeys", "paletteThumbKeys", "paletteFiles",
    "workImages", "referenceKeys", "sourceFileKey", "sourceFiles",
  ].forEach((key) => {
    if (key in record) record[key] = "";
  });
}

function resetAllImageDataOnce() {
  if (localStorage.getItem(IMAGE_DATA_RESET_KEY) === "1") return;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    (stored.createdWorks || []).forEach(removeStoredImageReferences);
    Object.values(stored.overrides || {}).forEach(removeStoredImageReferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn("作品图片引用清理失败。", error);
  }
  Promise.resolve(window.KingBlobStore?.clear?.())
    .then(() => {
      localStorage.setItem(IMAGE_DATA_RESET_KEY, "1");
      location.reload();
    })
    .catch((error) => console.warn("作品图片数据清理失败。", error));
}

if (RELEASE_CONFIG.deployment === "development") resetAllImageDataOnce();

function resetWorkLibraryOnce() {
  if (localStorage.getItem(EMPTY_WORK_LIBRARY_RESET_KEY) === "1") return;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    stored.createdWorks = [];
    stored.overrides = {};
    stored.removedFiles = [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    localStorage.setItem(EMPTY_WORK_LIBRARY_MODE_KEY, "1");
    localStorage.setItem(EMPTY_WORK_LIBRARY_RESET_KEY, "1");
  } catch (error) {
    console.warn("稿件库初始化失败。", error);
  }
}

if (RELEASE_CONFIG.deployment === "development") resetWorkLibraryOnce();

function resetProjectLibraryOnce() {
  if (localStorage.getItem(EMPTY_PROJECT_LIBRARY_RESET_KEY) === "1") return;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    stored.projects = [];
    stored.projectBoardOverrides = {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    localStorage.removeItem(PJ_KEY);
    localStorage.removeItem(PJ_DRAFT_KEY_V2);
    localStorage.removeItem(PROJECT_DRAFT_KEY);
    localStorage.setItem(EMPTY_PROJECT_LIBRARY_RESET_KEY, "1");
  } catch (error) {
    console.warn("项目数据初始化失败。", error);
  }
}

if (RELEASE_CONFIG.deployment === "development") resetProjectLibraryOnce();

function readRegisteredAccounts() {
  try {
    return JSON.parse(localStorage.getItem(REGISTERED_ACCOUNT_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeRegisteredAccounts(accounts) {
  localStorage.setItem(REGISTERED_ACCOUNT_KEY, JSON.stringify(accounts));
  if (typeof saveStudioState === "function") saveStudioState();
}

if (!RELEASE_CONFIG.useBackendAuth) Object.assign(demoAccounts, readRegisteredAccounts());
let currentAccount = backendAuthSession()?.account || demoAccounts.admin || { role: "管理员", name: "管理员", ownerKey: "kingadmin" };

const loginScreen = document.querySelector("#loginScreen");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const employeeLoginPanel = document.querySelector("#employeeLoginPanel");
const clientLoginPanel = document.querySelector("#clientLoginPanel");
const employeeRememberPassword = document.querySelector("#employeeRememberPassword");
const clientLoginForm = document.querySelector("#clientLoginForm");
const clientUsername = document.querySelector("#clientUsername");
const clientPassword = document.querySelector("#clientPassword");
const clientRememberPassword = document.querySelector("#clientRememberPassword");
const clientLoginError = document.querySelector("#clientLoginError");
const appLoadingOverlay = document.querySelector("#appLoadingOverlay");
const appLoadingText = document.querySelector("#appLoadingText");
const appLoadingProgress = document.querySelector("#appLoadingProgress");
const appLoadingProgressTrack = appLoadingProgress?.querySelector('[role="progressbar"]');
const appLoadingProgressBar = document.querySelector("#appLoadingProgressBar");
const appLoadingProgressDetail = document.querySelector("#appLoadingProgressDetail");
const appLoadingProgressCount = document.querySelector("#appLoadingProgressCount");
const openAccountApplication = document.querySelector("#openAccountApplication");
const accountApplicationModal = document.querySelector("#accountApplicationModal");
const closeAccountApplication = document.querySelector("#closeAccountApplication");
const accountApplicationForm = document.querySelector("#accountApplicationForm");
const applicationName = document.querySelector("#applicationName");
const applicationContact = document.querySelector("#applicationContact");
const applicationUsername = document.querySelector("#applicationUsername");
const applicationRole = document.querySelector("#applicationRole");
const applicationPassword = document.querySelector("#applicationPassword");
const applicationPasswordConfirm = document.querySelector("#applicationPasswordConfirm");
const applicationError = document.querySelector("#applicationError");
const openPasswordRecovery = document.querySelector("#openPasswordRecovery");
const passwordRecoveryModal = document.querySelector("#passwordRecoveryModal");
const closePasswordRecovery = document.querySelector("#closePasswordRecovery");
const passwordRecoveryForm = document.querySelector("#passwordRecoveryForm");
const recoveryUsername = document.querySelector("#recoveryUsername");
const recoveryContact = document.querySelector("#recoveryContact");
const recoveryPassword = document.querySelector("#recoveryPassword");
const recoveryPasswordConfirm = document.querySelector("#recoveryPasswordConfirm");
const recoveryError = document.querySelector("#recoveryError");
const userBadge = document.querySelector("#userBadge");
document.querySelector(".login-shortcuts")?.toggleAttribute("hidden", RELEASE_CONFIG.showDemoShortcuts === false);
openAccountApplication?.toggleAttribute("hidden", RELEASE_CONFIG.showAccountApplication === false || RELEASE_CONFIG.useBackendAuth === true);
const profileAvatar = document.querySelector("#profileAvatar");
const profileAvatarInput = document.querySelector("#profileAvatarInput");
const profileNameInput = document.querySelector("#profileNameInput");
const profileRoleLabel = document.querySelector("#profileRoleLabel");
const logoutButton = document.querySelector("#logoutButton");
const navItems = document.querySelectorAll(".nav-item");
const adminActions = document.querySelectorAll("[data-admin-action]");
const views = document.querySelectorAll(".view");
const pageTitle = document.querySelector("#pageTitle");
const liveUploadCarousel = document.querySelector("#liveUploadCarousel");
const reviewBoard = document.querySelector("#reviewBoard");
const reviewWorkTypeSwitch = document.querySelector("#reviewWorkTypeSwitch");
const reviewCalendar = document.querySelector("#reviewCalendar");
const reviewTodayCount = document.querySelector("#reviewTodayCount");
const reviewDateInput = document.querySelector("#reviewDateInput");
const reviewDateLabel = document.querySelector("#reviewDateLabel");
const reviewPrevDay = document.querySelector("#reviewPrevDay");
const reviewNextDay = document.querySelector("#reviewNextDay");
const reviewStatusTabs = document.querySelector("#reviewStatusTabs");
const reviewPendingCount = document.querySelector("#reviewPendingCount");
const reviewedCount = document.querySelector("#reviewedCount");
const reviewAllCount = document.querySelector("#reviewAllCount");
const libraryCustomer = document.querySelector("#libraryCustomer");
const libraryViewer = document.querySelector("#libraryViewer");
const startLibrarySession = document.querySelector("#startLibrarySession");
const libraryStatus = document.querySelector("#libraryStatus");
const libraryGrid = document.querySelector("#libraryGrid");
const toggleLibraryInfo = document.querySelector("#toggleLibraryInfo");
const compareSelected = document.querySelector("#compareSelected");
const viewerLibraryHead = document.querySelector("#viewerLibraryHead");
const viewerLibraryFilterBar = document.querySelector("#viewerLibraryFilterBar");
const viewerLibrarySelectedConditions = document.querySelector("#viewerLibrarySelectedConditions");
const viewerLibraryResultCount = document.querySelector("#viewerLibraryResultCount");
const viewerLibrarySort = document.querySelector("#viewerLibrarySort");
const libraryCartList = document.querySelector("#libraryCartList");
const libraryCartCount = document.querySelector("#libraryCartCount");
const cartNavCount = document.querySelector("#cartNavCount");
const topCartButton = document.querySelector("#topCartButton");
const cartPreviewPopover = document.querySelector("#cartPreviewPopover");
const cartPreviewClose = document.querySelector("#cartPreviewClose");
const cartPreviewList = document.querySelector("#cartPreviewList");
const openFullCart = document.querySelector("#openFullCart");
const globalSearchInput = document.querySelector("#globalSearchInput");
const globalSearchResults = document.querySelector("#globalSearchResults");
const globalSearch = document.querySelector(".global-search");
const globalSearchToggle = document.querySelector("#globalSearchToggle");
const topRefreshButton = document.querySelector("#topRefreshButton");
const notificationButton = document.querySelector("#notificationButton");
const notificationModal = document.querySelector("#notificationModal");
const notificationClose = document.querySelector("#notificationClose");
const notificationDismiss = document.querySelector("#notificationDismiss");
const notificationList = document.querySelector("#notificationList");
const notificationMore = document.querySelector("#notificationMore");
const tagManagerButton = document.querySelector("#tagManagerButton");
const tagManagerModal = document.querySelector("#tagManagerModal");
const tagManagerClose = document.querySelector("#tagManagerClose");
const tagManagerDone = document.querySelector("#tagManagerDone");
const tagManagerBody = document.querySelector("#tagManagerBody");
const riskModal = document.querySelector("#riskModal");
const riskModalClose = document.querySelector("#riskModalClose");
const riskModalBody = document.querySelector("#riskModalBody");
const quickCreateButton = document.querySelector("#quickCreateButton");
const quickCreateModal = document.querySelector("#quickCreateModal");
const quickCreateClose = document.querySelector("#quickCreateClose");
const quickCreateGrid = document.querySelector("#quickCreateGrid");
const customerModal = document.querySelector("#customerModal");
const customerClose = document.querySelector("#customerClose");
const customerCancel = document.querySelector("#customerCancel");
const customerConfirm = document.querySelector("#customerConfirm");
const customerNameInput = document.querySelector("#customerNameInput");
const customerCompanyInput = document.querySelector("#customerCompanyInput");
const customerContactInput = document.querySelector("#customerContactInput");
const customerDemandInput = document.querySelector("#customerDemandInput");
const customerGenderOptions = document.querySelector("#customerGenderOptions");
const customerPreferenceTags = document.querySelector("#customerPreferenceTags");
const customerPreferenceCount = document.querySelector("#customerPreferenceCount");
const customerValidationSummary = document.querySelector("#customerValidationSummary");
const confirmCartOrder = document.querySelector("#confirmCartOrder");
const openProjectModal = document.querySelector("#openProjectModal");
const projectModal = document.querySelector("#projectModal");
const projectModalTitle = document.querySelector("#projectModalTitle");
const projectClose = document.querySelector("#projectClose");
const projectCancel = document.querySelector("#projectCancel");
const projectConfirm = document.querySelector("#projectConfirm");
const projectNameInput = document.querySelector("#projectNameInput");
const projectCustomerSelect = document.querySelector("#projectCustomerSelect");
const projectCustomerInput = document.querySelector("#projectCustomerInput");
const projectCustomerCombobox = document.querySelector("#projectCustomerCombobox");
const projectCustomerToggle = document.querySelector("#projectCustomerToggle");
const projectCustomerOptions = document.querySelector("#projectCustomerOptions");
const projectCustomerCreateInline = document.querySelector("#projectCustomerCreateInline");
const projectStatusOptions = document.querySelector("#projectStatusOptions");
const projectTypeOptions = document.querySelector("#projectTypeOptions");
const chooseProjectFiles = document.querySelector("#chooseProjectFiles");
const projectFilesInput = document.querySelector("#projectFilesInput");
const projectFileReadout = document.querySelector("#projectFileReadout");
const projectDesignerOptions = document.querySelector("#projectDesignerOptions");
const projectDesignerSummary = document.querySelector("#projectDesignerSummary");
const projectDesignerSearch = document.querySelector("#projectDesignerSearch");
const projectPainterOptions = document.querySelector("#projectPainterOptions");
const projectPainterSummary = document.querySelector("#projectPainterSummary");
const projectPainterSearch = document.querySelector("#projectPainterSearch");
const projectOwnerDropdown = document.querySelector("#projectOwnerDropdown");
const projectOwnerSummary = document.querySelector("#projectOwnerSummary");
const projectOwnerOptions = document.querySelector("#projectOwnerOptions");
const projectOwnerSearch = document.querySelector("#projectOwnerSearch");
const projectStartDate = document.querySelector("#projectStartDate");
const projectEndDate = document.querySelector("#projectEndDate");
const projectValidationSummary = document.querySelector("#projectValidationSummary");
const projectNoteInput = document.querySelector("#projectNoteInput");
const projectAddNote = document.querySelector("#projectAddNote");
const projectNoteLog = document.querySelector("#projectNoteLog");
const projectDetailModal = document.querySelector("#projectDetailModal");
const projectDetailTitle = document.querySelector("#projectDetailTitle");
const projectDetailClose = document.querySelector("#projectDetailClose");
const projectDetailBody = document.querySelector("#projectDetailBody");
const projectDetailTopStatus = document.querySelector("#projectDetailTopStatus");
const projectDetailFileInput = document.querySelector("#projectDetailFileInput");
const projectFileViewer = document.querySelector("#projectFileViewer");
const projectFileViewerClose = document.querySelector("#projectFileViewerClose");
const projectFileViewerImage = document.querySelector("#projectFileViewerImage");
const projectFileViewerFrame = document.querySelector("#projectFileViewerFrame");
const projectFileGenericPreview = document.querySelector("#projectFileGenericPreview");
const projectFileViewerDownload = document.querySelector("#projectFileViewerDownload");
const projectFileViewerName = document.querySelector("#projectFileViewerName");
const projectFileViewerPalette = document.querySelector("#projectFileViewerPalette");
const projectFileViewerPaletteText = document.querySelector("#projectFileViewerPaletteText");
const projectFileViewerNote = document.querySelector("#projectFileViewerNote");
const projectFileManager = document.querySelector("#projectFileManager");
const projectFileManagerClose = document.querySelector("#projectFileManagerClose");
const projectFileManagerDropzone = document.querySelector("#projectFileManagerDropzone");
const projectFileManagerGrid = document.querySelector("#projectFileManagerGrid");
const projectTypeFilter = document.querySelector("#projectTypeFilter");
const projectTypeFilterSummary = document.querySelector("#projectTypeFilterSummary");
const teamMetrics = document.querySelector("#teamMetrics");
const teamGrid = document.querySelector("#teamGrid");
const teamOutputRanking = document.querySelector("#teamOutputRanking");
const teamOutputRankingModal = document.querySelector("#teamOutputRankingModal");
const teamOutputPagination = document.querySelector("#teamOutputPagination");
const teamRoleFilter = document.querySelector("#teamRoleFilter");
const teamStatusFilter = document.querySelector("#teamStatusFilter");
const teamSearch = document.querySelector("#teamSearch");
const teamNewEmployeeButton = document.querySelector("#teamNewEmployeeButton");
const teamManageButton = document.querySelector("#teamManageButton");
const employeeAccountModal = document.querySelector("#employeeAccountModal");
const employeeAccountForm = document.querySelector("#employeeAccountForm");
const employeeAccountTitle = document.querySelector("#employeeAccountTitle");
const employeeAccountClose = document.querySelector("#employeeAccountClose");
const employeeAccountCancel = document.querySelector("#employeeAccountCancel");
const employeeAccountName = document.querySelector("#employeeAccountName");
const employeeAccountUsername = document.querySelector("#employeeAccountUsername");
const employeeAccountJoinedAt = document.querySelector("#employeeAccountJoinedAt");
const employeeAccountRole = document.querySelector("#employeeAccountRole");
const employeeAccountPassword = document.querySelector("#employeeAccountPassword");
const employeeCredentialGenerate = document.querySelector("#employeeCredentialGenerate");
const employeeCreateModes = document.querySelector("#employeeCreateModes");
const employeeSingleFields = document.querySelector("#employeeSingleFields");
const employeeBatchFields = document.querySelector("#employeeBatchFields");
const employeeBatchList = document.querySelector("#employeeBatchList");
const employeeBatchAdd = document.querySelector("#employeeBatchAdd");
const employeeCredentialResults = document.querySelector("#employeeCredentialResults");
const employeeAccountError = document.querySelector("#employeeAccountError");
const employeeAccountSubmit = document.querySelector("#employeeAccountSubmit");
const teamProjectsModal = document.querySelector("#teamProjectsModal");
const teamProjectsClose = document.querySelector("#teamProjectsClose");
const teamProjectsTitle = document.querySelector("#teamProjectsTitle");
const teamProjectsBody = document.querySelector("#teamProjectsBody");
const openProjectDrafts = document.querySelector("#openProjectDrafts");
const projectDraftCount = document.querySelector("#projectDraftCount");
const openArchivedProjects = document.querySelector("#openArchivedProjects");
const projectArchiveCount = document.querySelector("#projectArchiveCount");
const projectSaveDraft = document.querySelector("#projectSaveDraft");
const projectDraftModal = document.querySelector("#projectDraftModal");
const projectDraftClose = document.querySelector("#projectDraftClose");
const projectDraftList = document.querySelector("#projectDraftList");
const projectArchiveModal = document.querySelector("#projectArchiveModal");
const projectArchiveClose = document.querySelector("#projectArchiveClose");
const projectArchiveList = document.querySelector("#projectArchiveList");
const projectArchiveResultFilter = document.querySelector("#projectArchiveResultFilter");
const projectArchiveTypeFilter = document.querySelector("#projectArchiveTypeFilter");
const projectArchiveCustomerFilter = document.querySelector("#projectArchiveCustomerFilter");
const projectArchiveOwnerFilter = document.querySelector("#projectArchiveOwnerFilter");
const projectArchiveDeadlineFilter = document.querySelector("#projectArchiveDeadlineFilter");
const projectArchiveTimeFilter = document.querySelector("#projectArchiveTimeFilter");
const projectLifecycleModal = document.querySelector("#projectLifecycleModal");
const projectLifecycleTitle = document.querySelector("#projectLifecycleTitle");
const projectLifecycleBody = document.querySelector("#projectLifecycleBody");
const projectLifecycleClose = document.querySelector("#projectLifecycleClose");
const projectLifecycleCancel = document.querySelector("#projectLifecycleCancel");
const projectLifecycleConfirm = document.querySelector("#projectLifecycleConfirm");
const memberPickerModal = document.querySelector("#memberPickerModal");
const memberPickerTitle = document.querySelector("#memberPickerTitle");
const memberPickerSearch = document.querySelector("#memberPickerSearch");
const memberPickerFilters = document.querySelector("#memberPickerFilters");
const memberPickerList = document.querySelector("#memberPickerList");
const memberPickerSelectedCount = document.querySelector("#memberPickerSelectedCount");
const memberPickerSelectedAvatars = document.querySelector("#memberPickerSelectedAvatars");
const memberPickerConfirm = document.querySelector("#memberPickerConfirm");
const orderMetrics = document.querySelector("#orderMetrics");
const orderViewMode = document.querySelector("#orderViewMode");
const orderStatusFilter = document.querySelector("#orderStatusFilter");
const orderSort = document.querySelector("#orderSort");
const orderSearch = document.querySelector("#orderSearch");
const orderList = document.querySelector("#orderList");
const orderFileLinkInput = document.querySelector("#orderFileLinkInput");
const orderManageToggle = document.querySelector("#orderManageToggle");
const orderManageSelectAll = document.querySelector("#orderManageSelectAll");
const orderManageDelete = document.querySelector("#orderManageDelete");
const orderManagePin = document.querySelector("#orderManagePin");
const orderPackageOverlay = document.querySelector("#orderPackageOverlay");
const orderPackageTitle = document.querySelector("#orderPackageTitle");
const orderPackageProgressText = document.querySelector("#orderPackageProgressText");
const orderPackageProgressBar = document.querySelector("#orderPackageProgressBar");
const orderPackageProgressCount = document.querySelector("#orderPackageProgressCount");
let orderManageMode = false;
const orderManageSelection = new Set();
const revealedCompletedOrderAmounts = new Set();
const roleSelect = document.querySelector("#roleSelect");
const roleDashboards = document.querySelectorAll("[data-role-dashboard]");
let workCards = document.querySelectorAll("[data-work-role]");
const worksTitle = document.querySelector("#worksTitle");
const worksTypeSegment = document.querySelector("#worksTypeSegment");
const worksUploadButton = document.querySelector("#worksUploadButton");
const workSort = document.querySelector("#workSort");
const workTimeFilter = document.querySelector("#workTimeFilter");
const toggleCardInfo = document.querySelector("#toggleCardInfo");
const libraryFilterBar = document.querySelector("#libraryFilterBar");
const librarySortField = document.querySelector("#librarySortField");
const librarySelectedConditions = document.querySelector("#librarySelectedConditions");
const libraryResultCount = document.querySelector("#libraryResultCount");
const libraryManageActions = document.querySelector("#libraryManageActions");
const libraryManageToggle = document.querySelector("#libraryManageToggle");
const libraryManageSelectAll = document.querySelector("#libraryManageSelectAll");
const libraryManageDelete = document.querySelector("#libraryManageDelete");
const libraryManageSleep = document.querySelector("#libraryManageSleep");
const worksBoard = document.querySelector(".works-board");
const recycleList = document.querySelector("#recycleList");
const recycleSearch = document.querySelector("#recycleSearch");
const recycleStatus = document.querySelector("#recycleStatus");
const recycleSort = document.querySelector("#recycleSort");
const recyclePatternForm = document.querySelector("#recyclePatternForm");
const recycleTheme = document.querySelector("#recycleTheme");
const recycleStyle = document.querySelector("#recycleStyle");
const emptyRecycle = document.querySelector("#emptyRecycle");
const sleepList = document.querySelector("#sleepList");
const sleepSearch = document.querySelector("#sleepSearch");
const sleepDesignerFilter = document.querySelector("#sleepDesignerFilter");
const sleepTagFilter = document.querySelector("#sleepTagFilter");
const sleepSort = document.querySelector("#sleepSort");
const sleepPatternForm = document.querySelector("#sleepPatternForm");
const sleepTheme = document.querySelector("#sleepTheme");
const sleepStyle = document.querySelector("#sleepStyle");
const sleepSalesStatus = document.querySelector("#sleepSalesStatus");
const sleepSelectedConditions = document.querySelector("#sleepSelectedConditions");
const recycleSelectedConditions = document.querySelector("#recycleSelectedConditions");
const uploadModal = document.querySelector("#uploadModal");
const uploadModalTitle = document.querySelector("#uploadModalTitle");
const uploadClose = document.querySelector("#uploadClose");
const uploadCancel = document.querySelector("#uploadCancel");
const uploadConfirm = document.querySelector("#uploadConfirm");
const uploadWorkName = document.querySelector("#uploadWorkName");
const chooseFiles = document.querySelector("#chooseFiles");
const artworkFiles = document.querySelector("#artworkFiles");
const fileReadout = document.querySelector("#fileReadout");
const referenceFiles = document.querySelector("#referenceFiles");
const chooseReferenceFiles = document.querySelector("#chooseReferenceFiles");
const referenceReadout = document.querySelector("#referenceReadout");
const artworkSourceFile = document.querySelector("#artworkSourceFile");
const chooseSourceFile = document.querySelector("#chooseSourceFile");
const sourceUploadReadout = document.querySelector("#sourceUploadReadout");
const artworkPaletteFiles = document.querySelector("#artworkPaletteFiles");
const choosePaletteFiles = document.querySelector("#choosePaletteFiles");
const paletteUploadReadout = document.querySelector("#paletteUploadReadout");
const originalDeclaration = document.querySelector("#originalDeclaration");
const uploadTagOptions = document.querySelector("#uploadTagOptions");
const newTagInput = document.querySelector("#newTagInput");
const addTagButton = document.querySelector("#addTagButton");
const openPainterPicker = document.querySelector("#openPainterPicker");
const linkedPainterSummary = document.querySelector("#linkedPainterSummary");
const linkedPainterList = document.querySelector("#linkedPainterList");
const projectSearch = document.querySelector("#projectSearch");
const projectResults = document.querySelector("#projectResults");
const linkedProjectSummary = document.querySelector("#linkedProjectSummary");
const linkedProjectList = document.querySelector("#linkedProjectList");
const clearProjectSearch = document.querySelector("#clearProjectSearch");
const addLinkedProject = document.querySelector("#addLinkedProject");
const clearLinkedProjects = document.querySelector("#clearLinkedProjects");
const painterPickerModal = document.querySelector("#painterPickerModal");
const painterPickerClose = document.querySelector("#painterPickerClose");
const painterPickerCancel = document.querySelector("#painterPickerCancel");
const painterPickerConfirm = document.querySelector("#painterPickerConfirm");
const painterFilter = document.querySelector("#painterFilter");
const painterPickerSearch = document.querySelector("#painterPickerSearch");
const painterPickerGrid = document.querySelector("#painterPickerGrid");
const painterPickerCount = document.querySelector("#painterPickerCount");
const painterSelectedCount = document.querySelector("#painterSelectedCount");
const painterSelectAll = document.querySelector("#painterSelectAll");
let painterPickerConfirmHandler = null;
const clearUploadTags = document.querySelector("#clearUploadTags");
const uploadValidationSummary = document.querySelector("#uploadValidationSummary");
const reviewConfirmModal = document.querySelector("#reviewConfirmModal");
const reviewConfirmClose = document.querySelector("#reviewConfirmClose");
const reviewConfirmCancel = document.querySelector("#reviewConfirmCancel");
const reviewConfirmSubmit = document.querySelector("#reviewConfirmSubmit");
const reviewConfirmTitle = document.querySelector("#reviewConfirmTitle");
const reviewConfirmMessage = document.querySelector("#reviewConfirmMessage");
const reviewConfirmNoteWrap = document.querySelector("#reviewConfirmNoteWrap");
const reviewConfirmNoteLabel = document.querySelector("#reviewConfirmNoteLabel");
const reviewConfirmNote = document.querySelector("#reviewConfirmNote");
const exitConfirmModal = document.querySelector("#exitConfirmModal");
const exitConfirmClose = document.querySelector("#exitConfirmClose");
const exitConfirmCancel = document.querySelector("#exitConfirmCancel");
const exitConfirmSubmit = document.querySelector("#exitConfirmSubmit");
const exitConfirmSave = document.querySelector("#exitConfirmSave");
const exitConfirmTitle = document.querySelector("#exitConfirmTitle");
const exitConfirmMessage = document.querySelector("#exitConfirmMessage");
const lightbox = document.querySelector("#imageLightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxOriginalImage = document.querySelector("#lightboxOriginalImage");
const lightboxTitle = document.querySelector("#lightboxTitle");
const lightboxMeta = document.querySelector("#lightboxMeta");
const lightboxFile = document.querySelector("#lightboxFile");
const lightboxWorkStatus = document.querySelector("#lightboxWorkStatus");
const lightboxEditWork = document.querySelector("#lightboxEditWork");
const lightboxSleepToggle = document.querySelector("#lightboxSleepToggle");
const lightboxDeleteWork = document.querySelector("#lightboxDeleteWork");
const lightboxOwner = document.querySelector("#lightboxOwner");
const lightboxSubmissionMeta = document.querySelector("#lightboxSubmissionMeta");
const lightboxProject = document.querySelector("#lightboxProject");
const lightboxProjectPicker = document.querySelector("#lightboxProjectPicker");
const lightboxProjectSearch = document.querySelector("#lightboxProjectSearch");
const lightboxProjectSearchClear = document.querySelector("#lightboxProjectSearchClear");
const lightboxProjectResults = document.querySelector("#lightboxProjectResults");
const lightboxTags = document.querySelector("#lightboxTags");
const lightboxTagPicker = document.querySelector("#lightboxTagPicker");
const lightboxTagOptions = document.querySelector("#lightboxTagOptions");
const lightboxClose = document.querySelector("#lightboxClose");
const lightboxExitFullscreen = document.querySelector("#lightboxExitFullscreen");
const lightboxPrev = document.querySelector("#lightboxPrev");
const lightboxNext = document.querySelector("#lightboxNext");
const lightboxReviewActions = document.querySelector("#lightboxReviewActions");
const lightboxResetReview = document.querySelector("#lightboxResetReview");
const lightboxReviewPanel = document.querySelector(".lightbox-review-panel");
const lightboxReviewProgress = document.querySelector("#lightboxReviewProgress");
const sourceFilePanel = document.querySelector("#sourceFilePanel");
const sourceFileStatus = document.querySelector("#sourceFileStatus");
const sourceFileDownloadList = document.querySelector("#sourceFileDownloadList");
const sourceDownloadAll = document.querySelector("#sourceDownloadAll");
const sourceFileInput = document.querySelector("#sourceFileInput");
const workImageAddInput = document.querySelector("#workImageAddInput");
const orderFilePanel = document.querySelector("#orderFilePanel");
const orderFileUploadButton = document.querySelector("#orderFileUploadButton");
const orderFileStateButton = document.querySelector("#orderFileStateButton");
const orderFileStatus = document.querySelector("#orderFileStatus");
const addToCartFromLightbox = document.querySelector("#addToCartFromLightbox");
const reviewNotePanel = document.querySelector("#reviewNotePanel");
const reviewNoteLabel = document.querySelector("#reviewNoteLabel");
const reviewNoteText = document.querySelector("#reviewNoteText");
const saveReviewNote = document.querySelector("#saveReviewNote");
const lightboxRevisionSummary = document.querySelector("#lightboxRevisionSummary");
const lightboxRevisionText = document.querySelector("#lightboxRevisionText");
const lightboxRevisionMeta = document.querySelector("#lightboxRevisionMeta");
const lightboxRevisionInput = document.querySelector("#lightboxRevisionInput");
const lightboxRevisionConfirm = document.querySelector("#lightboxRevisionConfirm");
const lightboxReviewLogPanel = document.querySelector("#lightboxReviewLogPanel");
const lightboxReviewLogList = document.querySelector("#lightboxReviewLogList");
const workImagePanel = document.querySelector("#workImagePanel");
const workImageCount = document.querySelector("#workImageCount");
const workImageOptions = document.querySelector("#workImageOptions");
const palettePanel = document.querySelector("#palettePanel");
const paletteCount = document.querySelector("#paletteCount");
const paletteOptions = document.querySelector("#paletteOptions");
const paletteFileInput = document.querySelector("#paletteFileInput");
const referenceMaterialList = document.querySelector("#referenceMaterialList");
const referenceZoomOverlay = document.querySelector("#referenceZoomOverlay");
const referenceZoomClose = document.querySelector("#referenceZoomClose");
const referenceZoomImage = document.querySelector("#referenceZoomImage");
const addReferenceInput = document.querySelector("#addReferenceInput");
const compareOverlay = document.querySelector("#compareOverlay");
const compareClose = document.querySelector("#compareClose");
const compareGrid = document.querySelector("#compareGrid");
const compareCount = document.querySelector("#compareCount");
// Keep review decisions visible while the metadata column scrolls.
lightbox.querySelector(".lightbox-side")?.append(lightboxReviewPanel);
let activePreviewIndex = 0;
let activeVariant = 1;
let activeMediaKind = "image";
let activeWorkImageIndex = 0;
let activeReviewAction = "";
let activeReviewDate = dateKey(new Date());
let activeReviewFilter = "pending";
let activeReviewResultFilter = "all";
let activeReviewWorkType = "设计师";
const viewedReviewMedia = new Map();
let uploadWorkType = "设计师";
let activeOrderFileContext = null;
let sourceFileTargetCard = null;
let workImageAddTargetCard = null;
let paletteFileTargetCard = null;
let projectDetailDirty = false;
let librarySessionActive = false;
let libraryInfoHidden = false;
let libraryCart = new Set();
let libraryCompareSelection = new Set();
let studioOrders = [];
let selectionCarts = [];
let previewZoom = 1;
let previewOffsetX = 0;
let previewOffsetY = 0;
const MAX_PREVIEW_ZOOM = 12;
let cardInfoHidden = false;
let dragStart = null;
let suppressPreviewClick = false;
let previewGestureStartZoom = 1;
const previewTouchPointers = new Map();
let previewPinchStart = null;
let lightboxReviewLogsExpanded = false;
let lightboxReviewLogsCard = "";
let deletedWorks = [];
let selectedUploadTags = [];
let selectedUploadFiles = [];
let selectedReferenceFiles = [];
let selectedSourceFiles = [];
let selectedPaletteFiles = [];
let uploadEditTargetCard = null;
let lightboxRevisionDraftCard = null;
let pendingReviewConfirmation = null;
let pendingExitConfirmation = null;
let pendingExitSaveAction = null;
let lightboxCardSet = [];
const uploadFileNames = new Map();
const uploadFilePurposes = new Map();
let pendingUploadPurpose = "";
const referenceFileNames = new Map();
let draggedUploadIndex = -1;
let selectedProjectFiles = [];
let selectedProjectStatus = "需求确认";
let selectedProjectType = "定制";
let selectedCustomerGender = "未说明";
let selectedCustomerPreferences = [];
let projectNoteLogs = [];
let editingProjectId = null;
let activeProjectId = null;
let activeProjectFileIndex = 0;
let projectFileZoom = 1;
let projectFileOffsetX = 0;
let projectFileOffsetY = 0;
let projectFileDragStart = null;
let projectManagerDragEntryId = "";
let projectFileClickTimer = null;
let projectChangeLogExpanded = false;
let selectedPainterWorks = [];
let draftPainterSelection = [];
let selectedProjects = [];
let pendingUploadTags = [];
let notificationsExpanded = false;
const dismissedNotifications = new Set();
let activityNotifications = [];
let uploadValidationTarget = null;
let fileObjectURLs = [];
let addReferenceTargetCard = null;
let projectSearchTimer = null;
let globalSearchMatches = [];
let projectBoardOverrides = {};
let pendingProjectLifecycleAction = null;
let initialImageHydration = Promise.resolve();
let resourceFolders = [];
let teamResources = [];
let activeResourceFolder = "all";
let resourceSearchText = "";
function createEmptyStudioState() {
  return {
    createdWorks: [],
    overrides: {},
    removedFiles: [],
    globalTags: [],
    orders: [],
    customers: [],
    projects: [],
    projectBoardOverrides: {},
    teamMembers: [],
    pendingTags: [],
    dismissedNotifications: [],
    resourceFolders: [],
    resources: [],
    personalWorkArchives: {},
    tagCategories: {},
    tagCategoryLabels: {},
    activityNotifications: [],
  };
}
let studioState = createEmptyStudioState();
let lastPersistedStateJson = "";
const defaultOrders = [];
const previewTeamMembers = [
  { name: "顾言", role: "设计师", ownerKey: "preview_designer_01", tone: "blue", baseLoadScore: 1, accountStatus: "正常" },
  { name: "沈清", role: "设计师", ownerKey: "preview_designer_02", tone: "violet", baseLoadScore: 2, accountStatus: "正常" },
  { name: "唐梨", role: "设计师", ownerKey: "preview_designer_03", tone: "green", baseLoadScore: 0, accountStatus: "正常" },
  { name: "陆遥", role: "设计师", ownerKey: "preview_designer_04", tone: "pink", baseLoadScore: 3, accountStatus: "正常" },
  { name: "简宁", role: "设计师", ownerKey: "preview_designer_05", tone: "orange", baseLoadScore: 1, accountStatus: "正常" },
  { name: "温岚", role: "设计师", ownerKey: "preview_designer_06", tone: "teal", baseLoadScore: 2, accountStatus: "正常" },
  { name: "乔安", role: "设计师", ownerKey: "preview_designer_07", tone: "gray", baseLoadScore: 0, accountStatus: "正常" },
  { name: "宋知", role: "设计师", ownerKey: "preview_designer_08", tone: "blue", baseLoadScore: 4, accountStatus: "正常" },
  { name: "白榆", role: "设计师", ownerKey: "preview_designer_09", tone: "violet", baseLoadScore: 1, accountStatus: "正常" },
  { name: "叶澄", role: "设计师", ownerKey: "preview_designer_10", tone: "green", baseLoadScore: 2, accountStatus: "正常" },
  { name: "江屿", role: "手绘师", ownerKey: "preview_painter_01", tone: "pink", baseLoadScore: 1, accountStatus: "正常" },
  { name: "南栀", role: "手绘师", ownerKey: "preview_painter_02", tone: "orange", baseLoadScore: 2, accountStatus: "正常" },
  { name: "夏葵", role: "手绘师", ownerKey: "preview_painter_03", tone: "teal", baseLoadScore: 0, accountStatus: "正常" },
  { name: "程野", role: "手绘师", ownerKey: "preview_painter_04", tone: "gray", baseLoadScore: 3, accountStatus: "正常" },
  { name: "安禾", role: "手绘师", ownerKey: "preview_painter_05", tone: "blue", baseLoadScore: 1, accountStatus: "正常" },
  { name: "黎月", role: "手绘师", ownerKey: "preview_painter_06", tone: "violet", baseLoadScore: 2, accountStatus: "正常" },
  { name: "秦墨", role: "手绘师", ownerKey: "preview_painter_07", tone: "green", baseLoadScore: 0, accountStatus: "正常" },
  { name: "鹿遥", role: "手绘师", ownerKey: "preview_painter_08", tone: "pink", baseLoadScore: 2, accountStatus: "正常" },
  { name: "方可", role: "销售", ownerKey: "preview_sales_01", tone: "orange", baseLoadScore: 1, accountStatus: "正常" },
  { name: "韩序", role: "管理员", ownerKey: "preview_admin_01", tone: "gray", baseLoadScore: 1, accountStatus: "正常" },
];
const seededTeamMembers = [
  { name: "林若", role: "设计师", ownerKey: "linruo", tone: "violet", baseLoadScore: 7, accountStatus: "正常" },
  { name: "孟夏", role: "设计师", ownerKey: "mengxia", tone: "green", baseLoadScore: 14, accountStatus: "正常" },
  { name: "阿沁", role: "手绘师", ownerKey: "painter", tone: "pink", baseLoadScore: 2, accountStatus: "正常" },
  { name: "周禾", role: "手绘师", ownerKey: "zhouhe", tone: "orange", baseLoadScore: 7, accountStatus: "正常" },
  { name: "洛川", role: "手绘师", ownerKey: "luochuan", tone: "teal", baseLoadScore: 14, accountStatus: "已停用" },
  { name: "苏叶", role: "手绘师", ownerKey: "suye", tone: "gray", baseLoadScore: 2, accountStatus: "正常" },
  ...previewTeamMembers,
];
const teamMembers = RELEASE_CONFIG.seedDemoData === false ? [] : seededTeamMembers.map((member) => ({ ...member }));
// 按角色对应的像素头像（放在 assets/avatars/ 下）；文件缺失时自动回退到首字母。
const ROLE_AVATARS = {
  "管理员": "./assets/avatars/admin.webp",
  "设计师": "./assets/avatars/designer.webp",
  "手绘师": "./assets/avatars/painter.webp",
  "销售": "./assets/avatars/sales.webp",
};
function memberAvatarInner(member) {
  const src = ROLE_AVATARS[member.role];
  const img = src ? `<img class="team-avatar-img" src="${src}" alt="" width="48" height="48" loading="lazy" onerror="this.remove()" />` : "";
  return `${img}${escapeHtml((member.name || "?").slice(0, 1))}`;
}

let teamManageMode = false;
let editingEmployeeAccountKey = "";
let employeeAccountSubmitting = false;
let employeeCreateMode = "single";
let teamHighLoadOnly = false;
let teamRankingPage = 0;
let projectDrafts = [];
let editingDraftId = "";
let memberPickerContext = null;
let memberPickerDraft = new Set();
let memberPickerLoadFilter = "all";
const globalTags = [];
const DEFAULT_TAG_CATEGORIES = {
  workType: ["设计稿", "手绘稿"],
  patternForm: ["四方连续", "定位印花", "单独纹样", "边花", "条纹", "格纹", "组合图案"],
  theme: ["花卉植物", "动物", "人物", "几何", "抽象", "自然", "食物", "节日", "儿童", "其他"],
  style: ["法式", "复古", "韩系", "日系", "东方", "极简", "童趣", "甜美", "暗黑", "古典", "现代"],
};
const managedTagCategories = Object.fromEntries(
  Object.entries(DEFAULT_TAG_CATEGORIES).map(([key, values]) => [key, [...values]])
);
if (RELEASE_CONFIG.seedDemoData === false) {
  Object.keys(managedTagCategories).forEach((key) => { managedTagCategories[key] = []; });
}
const managedTagCategoryLabels = {
  workType: "作品类型",
  patternForm: "图案形式",
  theme: "主题",
  style: "风格",
};
const expandedTagCategories = new Set();

function syncRegisteredAccountsToTeam() {
  const tones = ["blue", "violet", "green", "pink", "orange", "teal", "gray"];
  Object.entries(demoAccounts).forEach(([ownerKey, account], index) => {
    if (Array.isArray(RELEASE_CONFIG.enabledEmployeeRoles) && !RELEASE_CONFIG.enabledEmployeeRoles.includes(account.role)) return;
    const name = String(account.name || ownerKey).split("/")[0].trim() || ownerKey;
    const existing = teamMembers.find((member) => member.ownerKey === ownerKey);
    if (existing) {
      existing.name = name;
      existing.role = account.role || existing.role;
      existing.accountStatus = account.accountStatus || existing.accountStatus || "正常";
      return;
    }
    teamMembers.push({
      name,
      role: account.role || "员工",
      ownerKey,
      tone: tones[index % tones.length],
      baseLoadScore: 0,
      accountStatus: account.accountStatus || "正常",
    });
  });
}
const pendingTagApplications = [];
const retiredDefaultTags = ["花卉", "几何", "清新", "轻奢", "儿童", "秋冬", "手绘", "四件套"];
// Legacy demo projects were retired. Project pickers now show only projects
// created in the current workspace or loaded from the project data store.
const seededProjectLibrary = [];
const projectLibrary = RELEASE_CONFIG.seedDemoData === false ? [] : seededProjectLibrary.map((project) => ({ ...project }));
let customProjects = [];
let customCustomers = [];


function stableCaseIndex(text, length) {
  if (!length) return 0;
  let hash = 0;
  for (const char of String(text || "")) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return hash % length;
}

const CASE_SEED_IMAGE_BUDGET = 120;

function caseSeedTags(code, isPainter) {
  const themes = ["花卉植物", "动物", "人物", "几何", "抽象", "自然", "食物", "节日", "儿童", "其他"];
  const styles = ["法式", "复古", "韩系", "日系", "东方", "极简", "童趣", "甜美", "暗黑", "古典", "现代"];
  const apps = ["床品", "服装", "家居软装", "装饰用品", "包装", "文创", "箱包", "丝巾", "墙纸", "面料"];
  const designForms = ["四方连续", "定位印花", "单独纹样", "边花", "条纹", "格纹", "组合图案"];
  const painterForms = ["单体元素", "元素组合", "完整构图", "线稿", "上色稿"];
  const techniques = ["水彩", "线稿", "油画", "彩铅", "拼贴", "扁平插画", "版画", "数字绘画"];
  const pick = (arr, salt) => arr[stableCaseIndex(`${code}-${salt}`, arr.length)];
  return [
    pick(themes, "theme"),
    pick(styles, "style"),
    pick(apps, "app"),
    pick(isPainter ? painterForms : designForms, "form"),
    pick(techniques, "tech"),
  ].join(",");
}

async function seedKingCaseLibrary() {
  try {
    // 优先用内嵌的 manifest（script 标签加载，file:// 下也能用，避免 fetch 被 CORS 拦截）
    let manifest = (typeof window !== "undefined" && window.KING_CASE_MANIFEST) ? window.KING_CASE_MANIFEST : null;
    if (!manifest) {
      const response = await fetch("./assets/king-cases/manifest.json");
      if (!response.ok) return;
      manifest = await response.json();
    }
    const isSeedable = (member) => (member.accountStatus || "正常") === "正常"
      && !["admin", "zx"].includes(String(member.ownerKey || "").toLowerCase())
      && !["管理员", "zx"].includes(String(member.name || "").toLowerCase());
    const designers = teamMembers.filter((member) => member.role === "设计师" && isSeedable(member));
    const painters = teamMembers.filter((member) => member.role === "手绘师" && isSeedable(member));
    if (!designers.length) return;
    let changed = false;
    let imageBudget = CASE_SEED_IMAGE_BUDGET;
    (manifest.projects || []).forEach((sourceProject, projectIndex) => {
      const designer = designers[stableCaseIndex(sourceProject.name, designers.length)];
      const projectId = `CASE-${String(projectIndex + 1).padStart(2, "0")}`;
      if (!customProjects.some((project) => project.id === projectId)) {
        const firstPattern = sourceProject.patterns?.[0];
        const firstImage = firstPattern?.thumbs?.[0] || firstPattern?.images?.[0] || "";
        customProjects.push({
          id: projectId,
          name: sourceProject.source === "每日新稿" ? `每日新稿 · ${sourceProject.name}` : sourceProject.name,
          customer: ["每日新稿", "往期修改", "打样"].includes(sourceProject.source) ? "非客户项目" : sourceProject.name,
          type: ["每日新稿", "往期修改", "打样"].includes(sourceProject.source) ? "内部" : "定制",
          status: sourceProject.status || "需求确认",
          files: firstImage ? [{ name: `${sourceProject.name}-项目缩略图.webp`, type: "image/webp", dataUrl: firstImage, uploader: designer.name, time: "2026-07-22" }] : [],
          designers: [designer.name],
          painters: [],
          owners: [designer.name],
          owner: designer.name,
          members: designer.name,
          startAt: "2026-07-01",
          endAt: "2026-08-31",
          note: `由 king测试 案例素材整理，共 ${sourceProject.patterns?.length || 0} 套花型。`,
          logs: [],
          changeLogs: [],
          createdAt: "2026-07-22 14:00",
          uploads: [],
          caseSeed: true,
        });
        changed = true;
      }
      (sourceProject.patterns || []).forEach((pattern) => {
        if (imageBudget <= 0) return;
        if (!pattern.images?.length || [...document.querySelectorAll("[data-file]")].some((card) => card.dataset.file === pattern.code)) return;
        // 缩略图给卡片网格（秒开），高清预览给大图（点开才加载）
        const thumbs = (pattern.thumbs?.length ? pattern.thumbs : pattern.images).slice(0, 4);
        const previews = (pattern.previews?.length ? pattern.previews : thumbs).slice(0, 4);
        imageBudget -= thumbs.length;
        const isPainter = painters.length > 0 && stableCaseIndex(`${pattern.code}-role`, 3) === 0;
        const pool = isPainter ? painters : designers;
        const uploader = pool[stableCaseIndex(`${sourceProject.name}-${pattern.code}`, pool.length)];
        const paletteFiles = previews.map((path, index) => ({ name: path.split("/").pop(), key: path, type: "image/jpeg", primary: index === 0 }));
        createWorkCard({
          file: pattern.code,
          role: isPainter ? "手绘师" : "设计师",
          owner: uploader.ownerKey,
          generated: true,
          version: "2026-07-22 14:00",
          createdAt: "2026-07-20 10:00",
          colors: thumbs.length,
          tags: caseSeedTags(pattern.code, isPainter),
          imageKey: thumbs[0],
          paletteKeys: JSON.stringify(previews),
          paletteThumbKeys: JSON.stringify(thumbs),
          paletteFiles: JSON.stringify(paletteFiles),
          title: pattern.code,
          project: sourceProject.source === "每日新稿" ? `每日新稿 · ${sourceProject.name}` : sourceProject.name,
          saleStatus: "未出售",
          customerStatus: "未进入客户选稿",
          reviewStatus: "已通过 / 管理者已评审",
          linkedPainter: "无引用 / 原创设计",
          referenceMaterial: "案例资料",
          sourceFiles: "[]",
          caseSeed: true,
        }, { deferImageSync: true });
        changed = true;
      });
    });
    if (!changed) return;
    syncReviewCardPreviews();
    syncProjectLibrary();
    refreshWorkCards();
    saveStudioState();
    renderCustomProjects();
    if (activeViewId() === "designer") {
      configureWorksView(roleSelect.value, currentAccount.ownerKey);
    }
    renderDailyReviewBoard();
    renderLibraryGrid();
    if (document.querySelector("#customerCenter")) renderCustomerCenter();
    renderTeamView();
  } catch (error) {
    console.warn("king测试案例载入失败", error);
  }
}

let caseLibraryReadyPromise = null;
function ensureCaseLibraryReady() {
  if (RELEASE_CONFIG.seedCaseLibrary === false || localStorage.getItem(EMPTY_WORK_LIBRARY_MODE_KEY) === "1") return Promise.resolve();
  if (!caseLibraryReadyPromise) {
    caseLibraryReadyPromise = new Promise((resolve) => requestAnimationFrame(resolve)).then(() => seedKingCaseLibrary());
  }
  return caseLibraryReadyPromise;
}

function syncCustomerOptions() {
  if (RELEASE_CONFIG.seedDemoData === false) {
    [libraryCustomer, projectCustomerSelect].forEach((select) => {
      if (!select) return;
      [...select.options].slice(1).forEach((option) => option.remove());
    });
  }
  customCustomers.forEach((customer) => {
    if (!customer?.name) return;
    [libraryCustomer, projectCustomerSelect].forEach((select) => {
      if (!select || [...select.options].some((option) => option.value === customer.name)) return;
      select.appendChild(new Option(customer.name, customer.name));
    });
  });
}









function currentAccountDisplayName() {
  return String(currentAccount.name || "").split("/")[0].trim();
}















function editableOptions(kind) {
  if (kind === "project") {
    return projectLibrary.map((item) => item.name);
  }
  if (kind === "painter") {
    return ["无引用 / 原创设计", ...painterWorkCatalog().map((item) => `${item.painter} / ${item.title}`)];
  }
  return [];
}

function startInlineSelect(target, kind) {
  const current = target.textContent.trim();
  const select = document.createElement("select");
  select.className = "inline-editor";
  editableOptions(kind).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === current;
    select.appendChild(option);
  });
  target.replaceWith(select);
  select.focus();
  const commit = () => {
    const reviewCard = select.closest(".review-work-card");
    const sourceCard = reviewCard ? [...workCards].find((card) => card.dataset.file === reviewCard.dataset.reviewFile) : null;
    if (sourceCard && kind === "project") updateCardProject(sourceCard, select.value);
    if (sourceCard && kind === "painter") updateCardLinkedPainter(sourceCard, select.value);
    const button = document.createElement("button");
    button.className = "editable-chip";
    button.dataset.editKind = kind;
    button.type = "button";
    button.textContent = select.value;
    select.replaceWith(button);
    if (sourceCard) saveStudioState();
  };
  select.addEventListener("change", commit);
  select.addEventListener("blur", commit, { once: true });
}

function editReviewTags(target) {
  const pool = [...new Set([...retiredDefaultTags, ...globalTags])].join("、");
  const current = target.textContent.replace(/^标签：/, "").trim();
  const next = window.prompt(`选择或新增标签，最多 6 个，用顿号或逗号分隔。\n已有标签：${pool}`, current);
  if (next === null) return;
  const tags = next
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
  tags.forEach((tag) => {
    if (!globalTags.includes(tag)) globalTags.push(tag);
  });
  target.textContent = `标签：${tags.join("、") || "未设置"}`;
  const reviewCard = target.closest(".review-work-card");
  const sourceCard = target === lightboxTags
    ? activeLightboxCards()[activePreviewIndex]
    : reviewCard
      ? [...workCards].find((card) => card.dataset.file === reviewCard.dataset.reviewFile)
      : null;
  if (sourceCard) {
    sourceCard.dataset.tags = tags.join(",");
    sourceCard.querySelector(".tag-bar")?.remove();
    renderCardTags(sourceCard);
    if (target === lightboxTags) renderLightboxTagDisplay(sourceCard);
  }
  saveStudioState();
}

function refreshWorkCards() {
  const connectedCards = [...document.querySelectorAll("[data-work-role]")];
  const knownCards = [...workCards].filter((card) => card?.isConnected && card.matches?.("[data-work-role]"));
  const uniqueCards = new Map();
  [...new Set([...knownCards, ...connectedCards])].forEach((card) => {
    const file = String(card.dataset.file || "").trim();
    if (!file) return;
    if (uniqueCards.has(file)) {
      card.remove();
      return;
    }
    uniqueCards.set(file, card);
  });
  workCards = [...uniqueCards.values()];
  invalidateCardIndex();
}

function fileBaseName(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function formatDateTime(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return dateKey(new Date());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}




function displayDateLabel(key) {
  if (key === "all") return "全部日期";
  const [year, month, day] = key.split("-");
  return `${month}.${day}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readableFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
}

function uploadFileExtension(file) {
  return String(file?.name || "").split(".").pop().toLowerCase();
}

// 加密图通常由 NAS 返回 application/octet-stream，不能只依赖 MIME 判断。
function isImageUploadFile(file) {
  return Boolean(file) && (String(file.type || "").toLowerCase().startsWith("image/") || SUPPORTED_IMAGE_EXTENSIONS.includes(uploadFileExtension(file)) || uploadFileExtension(file) === "enc");
}

function acceptedUploadFiles(files, {
  label = "文件",
  maxBytes = MAX_RESOURCE_FILE_BYTES,
  extensions = [],
  imageOnly = false,
  maxCount = MAX_UPLOAD_FILES,
} = {}) {
  const list = [...(files || [])];
  const allowed = new Set(extensions.map((item) => item.toLowerCase().replace(/^\./, "")));
  const accepted = [];
  for (const file of list) {
    const ext = uploadFileExtension(file);
    if ((imageOnly && !isImageUploadFile(file)) || (allowed.size && !allowed.has(ext))) {
      showToast(`${file.name} 格式不支持，请重新选择。`, "warning");
      continue;
    }
    const effectiveMax = Math.min(maxBytes, MAX_RESOURCE_FILE_BYTES);
    if (Number.isFinite(effectiveMax) && effectiveMax > 0 && file.size > effectiveMax) {
      showToast(`${file.name} 为 ${readableFileSize(file.size)}，${label}单个文件不能超过 ${readableFileSize(effectiveMax)}。`, "warning");
      continue;
    }
    accepted.push(file);
  }
  if (accepted.length > maxCount) {
    showToast(`一次最多选择 ${maxCount} 个文件，其余文件未加入。`, "warning");
  }
  return accepted.slice(0, maxCount);
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片压缩失败")), type, quality);
  });
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function createUploadProgressTracker(plans) {
  const weights = plans.map((plan) => Math.max(1, Number(plan.file?.size || 1)));
  const progress = plans.map(() => 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const render = (detail) => {
    const weighted = progress.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
    const percent = Math.min(92, Math.max(2, Math.round(weighted * 92)));
    const completed = progress.filter((value) => value >= 1).length;
    setAppLoadingProgress(percent, detail || `已完成 ${completed}/${plans.length} 个文件`);
  };
  return {
    update(index, fraction, fileName = "") {
      progress[index] = Math.max(progress[index], Math.min(0.9, Number(fraction || 0) * 0.9));
      render(fileName ? `${fileName} · ${progress.filter((value) => value >= 1).length}/${plans.length}` : "");
    },
    complete(index, fileName = "") {
      progress[index] = 1;
      render(fileName ? `${fileName} 已上传 · ${progress.filter((value) => value >= 1).length}/${plans.length}` : "");
    },
  };
}

function artworkUploadErrorMessage(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || error?.message || "");
  const fileName = error?.uploadFileName ? `「${error.uploadFileName}」` : "该文件";
  if (status === 413 || /ASSET_TOO_LARGE|too large|maximum allowed size/i.test(code)) {
    return `${fileName}超过云端单文件上限 100MB，请确认文件大小后重试。`;
  }
  if (/TIMEOUT/.test(code)) return `${fileName}上传超时。系统已自动重试 3 次，请保持网络稳定后再次上传。`;
  if (status === 401 || /UNAUTHENTICATED/.test(code)) return "登录状态已过期，请重新登录后继续上传。";
  if (status === 403 || /FORBIDDEN/.test(code)) return "当前账号没有上传该文件的权限，请联系管理员检查员工岗位。";
  if (/InvalidKey|INVALID_ASSET_KEY/i.test(code)) return "云端存储路径生成失败，系统未修改原图；请刷新页面后重试。";
  if (status === 400) return `${fileName}被云端拒绝上传（${code || "请求格式错误"}），系统未修改原图。`;
  if (/STUDIO_STATE|BACKEND_REQUEST|revision/i.test(code)) return "图片已上传，但稿件资料同步失败；请保持页面并重试，系统不会压缩原图。";
  if (/NAS_|EACCES|EPERM|ENOENT|network|access|quota|存储|写入|UPLOAD|STORAGE/i.test(code)) {
    return RELEASE_CONFIG.useBackendAuth
      ? `${fileName}云端上传失败，系统已自动重试 3 次；请检查网络后重试。`
      : "NAS 文件写入失败，请检查连接与 files 文件夹权限。";
  }
  return `图片处理失败${code ? `：${code}` : "，请重新选择图片再试。"}`;
}

async function createImageVariantBlob(file, maxSize, square = false, quality = 0.84) {
  const bitmap = await createImageBitmap(file);
  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const canvas = document.createElement("canvas");
    let drawWidth;
    let drawHeight;
    let offsetX = 0;
    let offsetY = 0;
    if (square) {
      canvas.width = maxSize;
      canvas.height = maxSize;
      const scale = Math.max(maxSize / sourceWidth, maxSize / sourceHeight);
      drawWidth = sourceWidth * scale;
      drawHeight = sourceHeight * scale;
      offsetX = (maxSize - drawWidth) / 2;
      offsetY = (maxSize - drawHeight) / 2;
    } else {
      const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
      drawWidth = Math.max(1, Math.round(sourceWidth * scale));
      drawHeight = Math.max(1, Math.round(sourceHeight * scale));
      canvas.width = drawWidth;
      canvas.height = drawHeight;
    }
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight);
    return await canvasBlob(canvas, "image/webp", quality);
  } finally {
    bitmap.close?.();
  }
}

function normalizeStudioAssetBaseKey(value, maxLength = 210) {
  const original = String(value || "asset").trim() || "asset";
  const clean = original
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "") || "asset";
  const needsHash = clean !== original || clean.length > maxLength;
  if (!needsHash) return clean;
  let hash = 2166136261;
  for (let index = 0; index < original.length; index += 1) {
    hash ^= original.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(36).padStart(7, "0");
  return `${clean.slice(0, Math.max(1, maxLength - suffix.length - 1))}-${suffix}`;
}

async function persistArtworkImageTiers(baseKey, file, { onProgress } = {}) {
  const storageBaseKey = normalizeStudioAssetBaseKey(baseKey);
  const originalKey = `${storageBaseKey}__original`;
  const thumbKey = `${storageBaseKey}__thumb`;
  // 原图始终按 File 原字节上传；缩略图只服务列表，详情与下载不使用它。
  const originalUpload = saveImageToDB(originalKey, file, { onProgress });
  try {
    const thumbBlob = await createImageVariantBlob(file, 960, false, 0.88);
    const thumbFile = new File([thumbBlob], `${fileBaseName(file.name || baseKey)}-thumb.webp`, {
      type: thumbBlob.type || "image/webp",
      lastModified: file.lastModified || Date.now(),
    });
    await Promise.all([
      originalUpload,
      saveImageToDB(thumbKey, thumbFile, { waitForLocalCache: true }),
    ]);
    return { originalKey, thumbKey, previewKey: originalKey };
  } catch (error) {
    await originalUpload;
    console.warn("缩略图生成失败，列表暂时回退到原图。", error);
    return { originalKey, thumbKey: originalKey, previewKey: originalKey };
  }
}

function openImageDB() {
  if (window.KingBlobStore?.open) return window.KingBlobStore.open();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("images")) {
        database.createObjectStore("images", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveImageToDB(key, imageData, { waitForLocalCache = false, onProgress } = {}) {
  if (!imageData) return;
  const cacheWrite = window.KingBlobStore?.put
    ? window.KingBlobStore.put(key, imageData, {
      name: imageData?.name || "",
      type: imageData?.type || "",
    })
    : (async () => {
        const database = await openImageDB();
        await new Promise((resolve, reject) => {
          const tx = database.transaction("images", "readwrite");
          tx.objectStore("images").put({ key, imageData });
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        database.close();
      })();
  // 云端模式中，图片必须在作品元数据保存前进入 R2；本地 IndexedDB 只作缓存。
  if (RELEASE_CONFIG.useBackendAuth) {
    const upload = uploadBackendStudioAsset(key, imageData, { onProgress });
    if (waitForLocalCache) {
      await Promise.all([upload, cacheWrite]);
    } else {
      await upload;
      cacheWrite.catch((error) => console.warn("本机图片缓存写入失败，继续使用云端原图。", error));
    }
    return;
  }
  await cacheWrite;
}

async function getImageFromDB(key) {
  if (!key) return "";
  const local = window.KingBlobStore?.getUrl
    ? await window.KingBlobStore.getUrl(key)
    : await (async () => {
      const database = await openImageDB();
      const result = await new Promise((resolve, reject) => {
        const tx = database.transaction("images", "readonly");
        const request = tx.objectStore("images").get(key);
        request.onsuccess = () => resolve(request.result?.imageData || "");
        request.onerror = () => reject(request.error);
      });
      database.close();
      return result;
    })();
  if (local || !RELEASE_CONFIG.useBackendAuth) return local;
  try {
    const response = await backendStudioAsset(key);
    const blob = await response.blob();
    if (!blob.size) return "";
    // 将云端内容回填本机缓存，后续列表滚动无需重复联网请求。
    if (window.KingBlobStore?.put) await window.KingBlobStore.put(key, blob, { type: blob.type });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn("Studio asset read failed", key, error);
    return "";
  }
}

function isDirectImageSource(key) {
  const source = String(key || "").trim();
  return /^(data:|blob:|https?:|file:|\.{0,2}\/|assets\/)/i.test(source);
}

function normalizeLegacyDerivativePath(value) {
  const source = String(value || "").trim();
  if (!source || !/\/_(?:thumbs|previews)\//i.test(source)) return source;
  return source.replace(/\.(?:jpe?g|png|tiff?)(?=([?#]|$))/i, ".webp");
}

function normalizeStoredImageKeyList(value) {
  if (!value) return value;
  try {
    const keys = JSON.parse(value);
    return Array.isArray(keys)
      ? JSON.stringify(keys.map(normalizeLegacyDerivativePath))
      : value;
  } catch {
    return value;
  }
}

function normalizeStoredPaletteFiles(value) {
  if (!value) return value;
  try {
    const files = JSON.parse(value);
    return Array.isArray(files)
      ? JSON.stringify(files.map((file) => ({ ...file, key: normalizeLegacyDerivativePath(file?.key) })))
      : value;
  } catch {
    return value;
  }
}

function normalizeStoredWorkImageReferences(work) {
  if (!work || typeof work !== "object") return work;
  work.imageKey = normalizeLegacyDerivativePath(work.imageKey);
  work.imageData = normalizeLegacyDerivativePath(work.imageData);
  work.paletteKeys = normalizeStoredImageKeyList(work.paletteKeys);
  work.paletteThumbKeys = normalizeStoredImageKeyList(work.paletteThumbKeys);
  work.paletteFiles = normalizeStoredPaletteFiles(work.paletteFiles);
  if (!work.paletteThumbKeys && /\/_thumbs\//i.test(work.imageKey || "")) {
    work.paletteThumbKeys = JSON.stringify([work.imageKey]);
  }
  return work;
}

function cardPreviewSource(card) {
  if (!card) return "";
  if (card.dataset.imageData) {
    const normalizedData = normalizeLegacyDerivativePath(card.dataset.imageData);
    if (normalizedData !== card.dataset.imageData) card.dataset.imageData = normalizedData;
    return normalizedData;
  }
  const key = normalizeLegacyDerivativePath(card.dataset.imageKey);
  if (key && key !== card.dataset.imageKey) card.dataset.imageKey = key;
  return isDirectImageSource(key) ? key : "";
}

function cartPreviewImageMarkup(card) {
  const source = cardPreviewSource(card);
  if (source) {
    return `<img src="${escapeHtml(source)}" alt="" width="600" height="800" draggable="false" decoding="async">`;
  }
  const key = normalizeLegacyDerivativePath(card?.dataset.imageKey || "");
  return key
    ? `<img data-image-key="${escapeHtml(key)}" alt="" width="600" height="800" draggable="false" decoding="async">`
    : "";
}

function resolveImageSource(key) {
  const source = normalizeLegacyDerivativePath(key);
  if (!source) return Promise.resolve("");
  if (isDirectImageSource(source)) {
    try {
      return Promise.resolve(new URL(source, document.baseURI).href);
    } catch {
      return Promise.resolve(source);
    }
  }
  return getImageFromDB(source);
}

function cardToData(card) {
  return {
    file: card.dataset.file,
    role: card.dataset.workRole,
    owner: card.dataset.workOwner,
    version: card.dataset.version || formatDateTime(),
    colors: Number(card.dataset.colors || 1),
    tags: card.dataset.tags || "",
    imageKey: card.dataset.imageKey || "",
    paletteKeys: card.dataset.paletteKeys || "",
    paletteThumbKeys: card.dataset.paletteThumbKeys || "",
    paletteFiles: card.dataset.paletteFiles || "",
    workImages: card.dataset.workImages || "",
    referenceKeys: card.dataset.referenceKeys || "",
    sourceFileName: card.dataset.sourceFileName || "",
    sourceFileKey: card.dataset.sourceFileKey || "",
    sourceFileType: card.dataset.sourceFileType || "",
    sourceFiles: card.dataset.sourceFiles || "",
    deletedAt: card.dataset.deletedAt || "",
    deletedByKey: card.dataset.deletedByKey || "",
    deletedByRole: card.dataset.deletedByRole || "",
    generated: card.dataset.generated === "true",
    title: card.querySelector(".work-head strong")?.textContent.trim() || card.querySelector(".file-name")?.textContent.trim() || card.dataset.file,
    project: card.querySelector(".work-body > p")?.textContent.replace(/^项目：/, "").trim() || "",
    reviewStatus: fieldValue(card, "审核状态"),
    customerStatus: fieldValue(card, "客户状态"),
    linkedPainter: fieldValue(card, "引用手绘"),
    linkedSketches: card.dataset.linkedSketches || "",
    referenceMaterial: fieldValue(card, "参考素材"),
    workStatus: fieldValue(card, "作品状态"),
    referencedDesign: fieldValue(card, "引用设计"),
    saleStatus: badgeValue(card, "销售状态：") || fieldValue(card, "作品状态") || "未出售",
    reviewNote: card.dataset.reviewNote || "",
    reviewAction: card.dataset.reviewAction || "",
    reviewLogs: card.dataset.reviewLogs || "",
    reviewState: card.dataset.reviewState || "",
    submissionRound: Number(card.dataset.submissionRound || 1),
    resubmittedAt: card.dataset.resubmittedAt || "",
    sleeping: card.dataset.sleeping === "true" || card.classList.contains("sleeping"),
    sleepActorKey: card.dataset.sleepActorKey || "",
    sleepActorRole: card.dataset.sleepActorRole || "",
    sleepPreviousReviewStatus: card.dataset.sleepPreviousReviewStatus || "",
    sleepPreviousReviewAction: card.dataset.sleepPreviousReviewAction || "",
    sleepPreviousReviewLogs: card.dataset.sleepPreviousReviewLogs || "",
    createdAt: card.dataset.createdAt || card.dataset.version || "",
    projectId: card.dataset.projectId || "",
    caseSeed: card.dataset.caseSeed === "true",
  };
}

function loadStudioState() {
  window.__kingLastSync = Math.max(
    Number(window.__kingLastSync || 0),
    Number(localStorage.getItem(NAS_SYNC_TIME_KEY) || 0),
  );
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      lastPersistedStateJson = raw;
      const normalizedStored = normalizeStudioStateRecords(JSON.parse(raw));
      studioState = { ...studioState, ...normalizedStored.state };
      restoreSharedWorkspaceLocalData(studioState.sharedWorkspaceLocalData);
      (RELEASE_CONFIG.seedDemoData === false ? [] : (studioState.globalTags || []).filter((tag) => !retiredDefaultTags.includes(tag))).forEach((tag) => {
        if (!globalTags.includes(tag)) globalTags.push(tag);
      });
      const storedTagCategoryEntries = Object.entries(studioState.tagCategories || {});
      if (storedTagCategoryEntries.length) {
        Object.keys(managedTagCategories).forEach((key) => {
          if (RELEASE_CONFIG.seedDemoData === false) return;
          if (!Object.prototype.hasOwnProperty.call(studioState.tagCategories, key)) {
            delete managedTagCategories[key];
            delete managedTagCategoryLabels[key];
          }
        });
      }
      storedTagCategoryEntries.forEach(([key, values]) => {
        if (!Array.isArray(values)) return;
        const cleanValues = values.map((tag) => String(tag).trim()).filter(Boolean);
        if (managedTagCategories[key]) {
          managedTagCategories[key].splice(0, managedTagCategories[key].length, ...cleanValues);
        } else {
          managedTagCategories[key] = cleanValues;
        }
      });
      Object.entries(studioState.tagCategoryLabels || {}).forEach(([key, label]) => {
        const cleanLabel = String(label || "").trim();
        if (!cleanLabel || !managedTagCategories[key]) return;
        managedTagCategoryLabels[key] = cleanLabel;
      });
      (studioState.pendingTags || []).forEach((tag) => {
        if (!pendingTagApplications.includes(tag)) pendingTagApplications.push(tag);
      });
      (studioState.dismissedNotifications || []).forEach((key) => dismissedNotifications.add(key));
      activityNotifications = Array.isArray(studioState.activityNotifications)
        ? studioState.activityNotifications.slice(0, 80)
        : [];
      const sharedProjects = Array.isArray(studioState.projects) ? studioState.projects : [];
      // 兼容旧版本：如果共享状态还没有项目，保留本机项目并在下一次保存时迁移到共享状态。
      customProjects = sharedProjects.length || !pjProjects.length ? sharedProjects : pjProjects;
      pjProjects = customProjects;
      normalizeProjectLifecycleData();
      customCustomers = Array.isArray(studioState.customers)
        ? studioState.customers.map((customer) => {
          const { status: _legacyStatus, ...cleanCustomer } = customer || {};
          return cleanCustomer;
        })
        : [];
      projectBoardOverrides = studioState.projectBoardOverrides || {};
      resourceFolders = Array.isArray(studioState.resourceFolders) ? studioState.resourceFolders : [];
      teamResources = Array.isArray(studioState.resources) ? studioState.resources : [];
      studioState.personalWorkArchives = studioState.personalWorkArchives && typeof studioState.personalWorkArchives === "object"
        ? studioState.personalWorkArchives
        : {};
      if (Array.isArray(studioState.teamMembers) && studioState.teamMembers.length) {
        // 正式版只移除已知演示成员，保留管理员后来创建的真实云端员工。
        const seen = new Set();
        const productionAccountKeys = new Set(Object.keys(demoAccounts));
        const demoOnlyKeys = new Set(seededTeamMembers
          .map((member) => member.ownerKey)
          .filter((ownerKey) => !productionAccountKeys.has(ownerKey)));
        const cleaned = studioState.teamMembers.map((member) => {
          if (RELEASE_CONFIG.seedDemoData !== false) return member;
          if (member.ownerKey === "designer") return { ...member, name: "设计师" };
          if (member.ownerKey === "painter" && member.name === "阿沁") return { ...member, name: "手绘师" };
          return member;
        }).filter((member) => {
          const key = String(member.ownerKey || member.name || "").toLowerCase();
          const name = String(member.name || "").toLowerCase();
          if (key === "zx" || name === "zx") return false;
          if (RELEASE_CONFIG.seedDemoData === false && demoOnlyKeys.has(member.ownerKey)) return false;
          const dedupeKey = member.ownerKey || member.name;
          if (seen.has(dedupeKey)) return false;
          seen.add(dedupeKey);
          return true;
        });
        teamMembers.splice(0, teamMembers.length, ...cleaned);
        if (RELEASE_CONFIG.seedDemoData !== false) previewTeamMembers.forEach((member) => {
          if (!teamMembers.some((item) => item.ownerKey === member.ownerKey)) teamMembers.push({ ...member });
        });
      }
      syncProjectLibrary();
      syncCustomerOptions();
    }
  } catch (error) {
    console.warn("Studio state load failed", error);
  }
  if (!RELEASE_CONFIG.useBackendAuth && window.kingNas?.syncRead) {
    window.kingNas.syncRead()
      .then((shared) => applyNasSharedState(shared, { reloadWhenChanged: true }))
      .catch(() => {});
  }
}

/* 增量保存：只重新读取发生变化的作品卡片；非作品数据仍沿用现有存储结构。 */
let _saveTimer = null;
const workRecordCache = new Map();
const dirtyWorkFiles = new Set();
let workRecordCacheReady = false;

function markWorkRecordDirty(card) {
  const file = card?.dataset?.file;
  if (file) dirtyWorkFiles.add(file);
}

function syncDirtyWorkRecords() {
  if (!workRecordCacheReady) {
    workCards.forEach((card) => workRecordCache.set(card.dataset.file, cardToData(card)));
    workRecordCacheReady = true;
    dirtyWorkFiles.clear();
    return;
  }
  const currentFiles = new Set();
  workCards.forEach((card) => {
    const file = card.dataset.file;
    currentFiles.add(file);
    if (dirtyWorkFiles.has(file) || !workRecordCache.has(file)) {
      workRecordCache.set(file, cardToData(card));
    }
  });
  [...workRecordCache.keys()].forEach((file) => {
    if (!currentFiles.has(file)) workRecordCache.delete(file);
  });
  dirtyWorkFiles.clear();
}

function saveStudioState() {
  if (_saveTimer) {
    if (window.KingPerformance?.cancelIdle) window.KingPerformance.cancelIdle(_saveTimer);
    else clearTimeout(_saveTimer);
  }
  // 业务状态是多人协作数据，不能等空闲 800ms 再落库。删除、审核、客户
  // 编辑后先同步写入本机状态并立刻进入服务端队列，避免切换页面或刷新时丢失。
  return saveStudioStateNow();
}
function flushStudioState() {
  if (_saveTimer) {
    if (window.KingPerformance?.cancelIdle) window.KingPerformance.cancelIdle(_saveTimer);
    else clearTimeout(_saveTimer);
    _saveTimer = null;
    saveStudioStateNow();
  }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushStudioState(); });
window.addEventListener("pagehide", flushStudioState);
window.addEventListener("beforeunload", flushStudioState);
window.addEventListener("pagehide", flushOrderPriceStateSave);
window.addEventListener("beforeunload", flushOrderPriceStateSave);

function saveStudioStateNow() {
  let previousState = {};
  try { previousState = JSON.parse(lastPersistedStateJson || "{}"); } catch {}
  const overrides = {};
  const createdWorks = [];
  const removedFiles = studioState.removedFiles || [];

  syncDirtyWorkRecords();
  workRecordCache.forEach((data) => {
    if (data.generated) {
      createdWorks.push(data);
    } else {
      overrides[data.file] = {
        version: data.version,
        colors: data.colors,
        tags: data.tags,
        imageKey: data.imageKey,
        paletteKeys: data.paletteKeys,
        paletteThumbKeys: data.paletteThumbKeys,
        paletteFiles: data.paletteFiles,
        workImages: data.workImages,
        referenceKeys: data.referenceKeys,
        sourceFileName: data.sourceFileName,
        sourceFileKey: data.sourceFileKey,
        sourceFileType: data.sourceFileType,
        sourceFiles: data.sourceFiles,
        project: data.project,
        projectId: data.projectId,
        linkedPainter: data.linkedPainter,
        linkedSketches: data.linkedSketches,
        referenceMaterial: data.referenceMaterial,
        reviewStatus: data.reviewStatus,
        deletedAt: data.deletedAt,
        reviewNote: data.reviewNote,
        reviewAction: data.reviewAction,
        reviewLogs: data.reviewLogs,
        reviewState: data.reviewState,
        submissionRound: data.submissionRound,
        resubmittedAt: data.resubmittedAt,
        sleeping: data.sleeping,
      };
    }
  });

  studioState = {
    createdWorks,
    overrides,
    removedFiles,
    globalTags,
    pendingTags: pendingTagApplications,
    dismissedNotifications: [...dismissedNotifications],
    activityNotifications,
    orders: studioOrders,
    projects: customProjects,
    customers: customCustomers,
    projectBoardOverrides,
    teamMembers,
    resourceFolders,
    resources: teamResources,
    personalWorkArchives: studioState.personalWorkArchives || {},
    sharedWorkspaceLocalData: readSharedWorkspaceLocalData(),
    tagCategories: Object.fromEntries(
      Object.entries(managedTagCategories).map(([key, values]) => [key, [...values]])
    ),
    tagCategoryLabels: { ...managedTagCategoryLabels },
  };
  try {
    const nextStateJson = JSON.stringify(studioState);
    if (nextStateJson === lastPersistedStateJson) return true;
    localStorage.setItem(STORAGE_KEY, nextStateJson);
    if (!RELEASE_CONFIG.useBackendAuth && window.kingNas?.syncWrite) {
      const stateToWrite = studioState;
      nasSyncWriteQueue = nasSyncWriteQueue
        .then(() => window.kingNas.syncWrite(stateToWrite))
        .then((result) => {
          const syncedAt = Number(result?.syncedAt || 0);
          window.__kingLastSync = Math.max(Number(window.__kingLastSync || 0), syncedAt);
          if (syncedAt) localStorage.setItem(NAS_SYNC_TIME_KEY, String(syncedAt));
        })
        .catch((error) => {
          console.warn("NAS studio sync failed", error);
          showToast?.("数据未同步到共享 NAS，请检查两台电脑是否连接同一工作目录。", "warning");
        });
    }
    queueBackendStudioSync(previousState, studioState);
    lastPersistedStateJson = nextStateJson;
    return true;
  } catch (error) {
    console.warn("Studio state save failed", error);
    return false;
  }
}

if (worksBoard && "MutationObserver" in window) {
  const workMutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes"
        && mutation.target instanceof HTMLImageElement
        && ["src", "style", "class", "data-image-queued"].includes(mutation.attributeName)
      ) return;
      markWorkRecordDirty(mutation.target.nodeType === Node.ELEMENT_NODE
        ? mutation.target.closest?.("[data-work-role]")
        : mutation.target.parentElement?.closest("[data-work-role]"));
    });
  });
  workMutationObserver.observe(worksBoard, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
}

function getPaletteKeys(card) {
  try {
    const keys = JSON.parse(card.dataset.paletteKeys || "[]");
    return Array.isArray(keys) ? keys : [];
  } catch {
    return [];
  }
}

function getPaletteThumbKeys(card) {
  try {
    const keys = JSON.parse(card?.dataset.paletteThumbKeys || "[]");
    return Array.isArray(keys) ? keys : [];
  } catch {
    return [];
  }
}

function setPaletteThumbKeys(card, keys) {
  card.dataset.paletteThumbKeys = JSON.stringify(keys);
  markWorkRecordDirty(card);
}

function getPaletteFiles(card) {
  try {
    const files = JSON.parse(card?.dataset.paletteFiles || "[]");
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
}

function getWorkImageEntries(card) {
  try {
    const entries = JSON.parse(card?.dataset.workImages || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function previewWorkImageEntries(card) {
  const entries = getWorkImageEntries(card).filter((entry) =>
    entry && (entry.previewKey || entry.originalKey || entry.thumbKey)
  );
  if (entries.length) return entries;
  if (card?.dataset.workImagesCleared === "true") return [];
  const fallbackKey = getPaletteKeys(card)[0] || card?.dataset.imageKey || card?.dataset.imageData || "";
  return fallbackKey ? [{
    name: card?.dataset.file || "作品主图",
    purpose: "主图",
    previewKey: fallbackKey,
    thumbKey: getPaletteThumbKeys(card)[0] || fallbackKey,
    primary: true,
  }] : [];
}

function workImageEntryCandidateKeys(entry, { preferOriginal = false } = {}) {
  return [...new Set([
    preferOriginal ? entry?.originalKey : entry?.previewKey,
    preferOriginal ? entry?.previewKey : entry?.originalKey,
    entry?.thumbKey,
  ].filter(Boolean))];
}

async function resolveWorkImageEntry(entry, options) {
  for (const key of workImageEntryCandidateKeys(entry, options)) {
    const source = await resolveImageSource(key);
    if (source) return source;
  }
  return "";
}

function workImageCandidateKeys(card, index = 0) {
  const workImage = getWorkImageEntries(card).find((item) => item?.primary) || getWorkImageEntries(card)[0];
  const paletteFile = getPaletteFiles(card)[index];
  const palettePreviewKey = getPaletteKeys(card)[index];
  const paletteThumbKey = getPaletteThumbKeys(card)[index];
  return [...new Set((index === 0 ? [
    // 列表使用 thumbKey；详情点击后必须优先读取原图，预览图只作回退。
    workImage?.originalKey,
    paletteFile?.key,
    workImage?.previewKey,
    palettePreviewKey,
    workImage?.thumbKey,
    paletteThumbKey,
    card?.dataset.imageKey,
    // Blob URLs only live for one page session. Keep a current one as a last
    // resort, after every durable IndexedDB key has been attempted.
    card?.dataset.imageData,
  ] : [
    // 补充效果图不属于配色；配色必须读取自己的持久化图片键。
    palettePreviewKey,
    paletteFile?.key,
    paletteThumbKey,
  ]).filter(Boolean))];
}

async function resolveFirstWorkImage(card, index = 0) {
  for (const key of workImageCandidateKeys(card, index)) {
    try {
      const source = await resolveImageSource(key);
      if (source) return source;
    } catch (error) {
      console.warn("作品图片候选读取失败，继续尝试下一项。", key, error);
    }
  }
  return "";
}

async function resolvePersistedArchiveImage(card) {
  // 刷新后旧的 blob: URL 已经失效，只从可持久化的图片键重新解析。
  // IndexedDB 返回的新 URL 仍可能是 blob:，那是本次会话新生成的有效地址。
  const trigger = card?.querySelector(".preview-trigger");
  const renderedImage = trigger?.querySelector("img");
  const inlineBackground = trigger?.style?.backgroundImage?.match(/^url\(["']?(.*?)["']?\)$/i)?.[1] || "";
  const candidates = [...new Set([
    ...workImageCandidateKeys(card, 0),
    renderedImage?.dataset?.imageKey,
    renderedImage?.getAttribute("src"),
    inlineBackground,
  ].filter((key) => key && !/^blob:/i.test(key)))];
  for (const key of candidates) {
    try {
      const source = await resolveImageSource(key);
      if (source) return source;
    } catch (error) {
      console.warn("归档作品图片读取失败，继续尝试下一项。", key, error);
    }
  }
  return "";
}

function hydrateArchiveWorkImages(root, cards, itemClass, thumbClass) {
  if (!root) return;
  const rendered = new Map(
    [...root.querySelectorAll(`.${itemClass}`)].map((item) => [item.dataset.file, item])
  );
  cards.forEach((card) => {
    const item = rendered.get(card.dataset.file);
    const trigger = item?.querySelector(`.${thumbClass}`);
    const image = trigger?.querySelector("img");
    if (!image) return;
    workPreviewObserver?.unobserve(image);
    pendingWorkPreviewSources.delete(image);
    image.removeAttribute("src");
    image.removeAttribute("data-image-queued");
    image.addEventListener("error", () => trigger?.classList.add("image-load-error"), { once: true });
    resolvePersistedArchiveImage(card).then((source) => {
      if (!image.isConnected) return;
      if (!source) {
        image.remove();
        trigger?.classList.remove("has-image", "image-load-error");
        trigger?.removeAttribute("data-image-shell");
        return;
      }
      trigger?.classList.remove("image-load-error");
      trigger?.classList.add("has-image");
      image.src = source;
    });
  });
}

function ensureArchivePreviewPersisted(card) {
  if (!card) return;
  const durable = workImageCandidateKeys(card, 0).find((key) => key && !/^blob:/i.test(key));
  if (durable) return;
  const transient = card.dataset.imageData || card.querySelector(".preview-trigger img")?.getAttribute("src") || "";
  if (!/^blob:/i.test(transient)) return;
  const recoveryKey = `${card.dataset.file}__archive_preview`;
  fetch(transient)
    .then((response) => response.blob())
    .then((blob) => saveImageToDB(recoveryKey, blob))
    .then(() => {
      card.dataset.imageKey = recoveryKey;
      markWorkRecordDirty(card);
      saveStudioState();
    })
    .catch((error) => console.warn("归档图片持久化失败。", error));
}

function getReferenceKeys(card) {
  try {
    const keys = JSON.parse(card?.dataset.referenceKeys || "[]");
    return Array.isArray(keys) ? keys : [];
  } catch {
    return [];
  }
}

function getSourceFiles(card) {
  try {
    const files = JSON.parse(card?.dataset.sourceFiles || "[]");
    if (Array.isArray(files) && files.length) return files.slice(0, MAX_UPLOAD_FILES);
  } catch {}
  if (card?.dataset.sourceFileKey) {
    return [{
      name: card.dataset.sourceFileName || "源文件",
      key: card.dataset.sourceFileKey,
      type: card.dataset.sourceFileType || "application/octet-stream",
    }];
  }
  return [];
}

function setPaletteKeys(card, keys) {
  card.dataset.paletteKeys = JSON.stringify(keys.filter(Boolean));
  markWorkRecordDirty(card);
}

function setPaletteFiles(card, files) {
  card.dataset.paletteFiles = JSON.stringify(files.filter(Boolean));
  markWorkRecordDirty(card);
}

const pendingWorkPreviewSources = new WeakMap();
function loadQueuedWorkPreview(image, sourceOrResolver) {
  pendingWorkPreviewSources.delete(image);
  workPreviewObserver?.unobserve(image);
  return Promise.resolve(typeof sourceOrResolver === "function" ? sourceOrResolver() : sourceOrResolver)
    .then((source) => {
      if (source && image.isConnected && image.getAttribute("src") !== source) image.src = source;
    })
    .catch(() => image.closest("[data-image-shell]")?.classList.add("image-load-error"));
}

const WORK_PREVIEW_LOAD_CONCURRENCY = 4;
const workPreviewLoadQueue = [];
let activeWorkPreviewLoads = 0;

function drainWorkPreviewLoadQueue() {
  while (activeWorkPreviewLoads < WORK_PREVIEW_LOAD_CONCURRENCY && workPreviewLoadQueue.length) {
    const task = workPreviewLoadQueue.shift();
    if (!task.image.isConnected) continue;
    activeWorkPreviewLoads += 1;
    loadQueuedWorkPreview(task.image, task.sourceOrResolver).finally(() => {
      activeWorkPreviewLoads -= 1;
      drainWorkPreviewLoadQueue();
    });
  }
}

function enqueueWorkPreviewLoad(image, sourceOrResolver, eager = false) {
  if (!image || !sourceOrResolver) return;
  const existing = workPreviewLoadQueue.findIndex((task) => task.image === image);
  if (existing >= 0) workPreviewLoadQueue.splice(existing, 1);
  const task = { image, sourceOrResolver };
  if (eager) workPreviewLoadQueue.unshift(task);
  else workPreviewLoadQueue.push(task);
  drainWorkPreviewLoadQueue();
}

const workPreviewObserver = typeof IntersectionObserver === "function"
  ? new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const image = entry.target;
        const pending = pendingWorkPreviewSources.get(image);
        observer.unobserve(image);
        if (pending) enqueueWorkPreviewLoad(image, pending);
      });
    }, { rootMargin: "360px 0px" })
  : null;

function queueWorkPreviewImage(image, sourceOrResolver, { eager = false } = {}) {
  if (!image || !sourceOrResolver) return;
  if (typeof sourceOrResolver === "string" && image.getAttribute("src") === sourceOrResolver) return;
  pendingWorkPreviewSources.set(image, sourceOrResolver);
  if (eager || !workPreviewObserver) {
    enqueueWorkPreviewLoad(image, sourceOrResolver, eager);
  } else {
    workPreviewObserver.observe(image);
  }
}

function applyImageData(card, imageData, { syncReview = true } = {}) {
  if (!imageData) return;
  card.dataset.imageData = imageData;
  const trigger = card.querySelector(".preview-trigger");
  if (trigger) {
    trigger.classList.add("has-image");
    trigger.classList.remove("pattern", "pattern-a", "pattern-b", "pattern-c", "pattern-d");
    trigger.style.backgroundImage = "";
    trigger.style.aspectRatio = "1 / 1";
    trigger.style.minHeight = "0";
    let image = trigger.querySelector("img[data-work-preview]");
    if (!image) {
      image = document.createElement("img");
      image.dataset.workPreview = "true";
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.fetchPriority = "low";
      trigger.prepend(image);
    }
    queueWorkPreviewImage(image, imageData);
  }
  if (syncReview) syncReviewCardPreviews();
}

function prepareWorkCardPreview(card, { eager = false } = {}) {
  if (!card || (!card.dataset.imageKey && !card.dataset.imageData)) return;
  const trigger = card.querySelector(".preview-trigger");
  if (!trigger) return;
  const existingImage = trigger.querySelector("img[data-work-preview]");
  if (existingImage?.getAttribute("src") && trigger.classList.contains("has-image")) return;
  trigger.dataset.imageShell = "true";
  trigger.classList.add("has-image");
  trigger.classList.remove("pattern", "pattern-a", "pattern-b", "pattern-c", "pattern-d");
  trigger.style.backgroundImage = "";
  trigger.style.aspectRatio = "1 / 1";
  trigger.style.minHeight = "0";
  let image = existingImage;
  if (!image) {
    image = document.createElement("img");
    image.dataset.workPreview = "true";
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.fetchPriority = "low";
    trigger.prepend(image);
  }
  if (card.dataset.imageData) {
    queueWorkPreviewImage(image, card.dataset.imageData, { eager });
    return;
  }
  queueWorkPreviewImage(image, async () => {
    const source = await resolveImageSource(card.dataset.imageKey);
    if (source) card.dataset.imageData = source;
    return source;
  }, { eager });
}

function suspendWorkCardPreview(card) {
  const image = card?.querySelector("img[data-work-preview]");
  if (!image) return;
  workPreviewObserver?.unobserve(image);
  pendingWorkPreviewSources.delete(image);
  for (let index = workPreviewLoadQueue.length - 1; index >= 0; index -= 1) {
    if (workPreviewLoadQueue[index].image === image) workPreviewLoadQueue.splice(index, 1);
  }
  image.removeAttribute("src");
}

function hydrateLazyKeyImages(root = document) {
  root.querySelectorAll("img[data-image-key]:not([data-image-queued])").forEach((image) => {
    image.dataset.imageQueued = "true";
    image.closest("[data-image-shell]")?.setAttribute("data-image-shell", "true");
    queueWorkPreviewImage(image, () => resolveImageSource(image.dataset.imageKey));
  });
}

function setImageKey(card, key) {
  if (key) card.dataset.imageKey = key;
}


function updateCardLinkedPainter(card, linkedText) {
  const rows = [...card.querySelectorAll("dl div")];
  const row = rows.find((item) => item.querySelector("dt")?.textContent.trim() === "引用手绘");
  const value = row?.querySelector("dd");
  if (!value) return;
  value.textContent = linkedText || "无引用 / 原创设计";
}

function updateCardReferenceMaterial(card, referenceText) {
  const rows = [...card.querySelectorAll("dl div")];
  let row = rows.find((item) => item.querySelector("dt")?.textContent.trim() === "参考素材");
  if (!row) {
    const dl = card.querySelector("dl");
    if (!dl) return;
    row = document.createElement("div");
    row.innerHTML = `<dt>参考素材</dt><dd></dd>`;
    dl.appendChild(row);
  }
  row.querySelector("dd").textContent = referenceText || "未提供参考图";
}

function normalizeTags(tags) {
  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(",");
}

function statusBadgeClass(text) {
  if (text.includes("出售") || text.includes("已出售")) return "sold";
  if (text.includes("被引用")) return "referenced";
  if (text.includes("初选") || text.includes("修改")) return "customer";
  if (text.includes("交付")) return "delivery";
  if (text.includes("完结") || text.includes("已通过")) return "done";
  if (text.includes("休眠")) return "sleeping";
  if (text.includes("待审核")) return "review";
  if (text.includes("需修改") || text.includes("未修改")) return "issue";
  return "unsold";
}

function createWorkCard(data, { deferImageSync = false } = {}) {
  const card = document.createElement("article");
  card.className = "work-card";
  const ownerRole = teamMembers.find((member) => member.ownerKey === data.owner)?.role;
  card.dataset.workRole = ["设计师", "手绘师"].includes(ownerRole)
    ? ownerRole
    : ["设计师", "手绘师"].includes(data.role) ? data.role : "设计师";
  card.dataset.workOwner = data.owner || "designer";
  card.dataset.file = data.file;
  card.dataset.generated = data.generated ? "true" : "false";
  card.dataset.tags = normalizeTags(data.tags);
  card.dataset.version = data.version || formatDateTime();
  card.dataset.createdAt = data.createdAt || data.version || formatDateTime();
  if (data.caseSeed) card.dataset.caseSeed = "true";
  card.dataset.colors = data.colors || 1;
  if (data.paletteKeys) card.dataset.paletteKeys = data.paletteKeys;
  if (data.paletteThumbKeys) card.dataset.paletteThumbKeys = data.paletteThumbKeys;
  if (data.paletteFiles) card.dataset.paletteFiles = data.paletteFiles;
  if (data.workImages) card.dataset.workImages = data.workImages;
  if (data.linkedSketches) card.dataset.linkedSketches = data.linkedSketches;
  if (data.projectId) card.dataset.projectId = data.projectId;
  if (data.referenceKeys) card.dataset.referenceKeys = data.referenceKeys;
  if (data.sourceFileName) card.dataset.sourceFileName = data.sourceFileName;
  if (data.sourceFileKey) card.dataset.sourceFileKey = data.sourceFileKey;
  if (data.sourceFileType) card.dataset.sourceFileType = data.sourceFileType;
  if (data.sourceFiles) card.dataset.sourceFiles = data.sourceFiles;
  setImageKey(card, data.imageKey || data.file);
  if (data.deletedAt) {
    card.dataset.deletedAt = data.deletedAt;
    if (data.deletedByKey) card.dataset.deletedByKey = data.deletedByKey;
    if (data.deletedByRole) card.dataset.deletedByRole = data.deletedByRole;
    card.classList.add("deleted");
  }
  if (data.reviewNote) card.dataset.reviewNote = data.reviewNote;
  if (data.reviewAction) card.dataset.reviewAction = data.reviewAction;
  if (data.reviewLogs) card.dataset.reviewLogs = data.reviewLogs;
  card.dataset.reviewState = data.reviewState || (
    String(data.reviewStatus || "").includes("已通过") ? "approved"
      : String(data.reviewStatus || "").includes("需修改") ? "revision"
        : "pending"
  );
  card.dataset.submissionRound = String(Math.max(1, Number(data.submissionRound || 1)));
  if (data.resubmittedAt) card.dataset.resubmittedAt = data.resubmittedAt;
  if (data.sleepPreviousReviewStatus) card.dataset.sleepPreviousReviewStatus = data.sleepPreviousReviewStatus;
  if (data.sleepPreviousReviewAction) card.dataset.sleepPreviousReviewAction = data.sleepPreviousReviewAction;
  if (data.sleepPreviousReviewLogs) card.dataset.sleepPreviousReviewLogs = data.sleepPreviousReviewLogs;
  if (data.sleepActorKey) card.dataset.sleepActorKey = data.sleepActorKey;
  if (data.sleepActorRole) card.dataset.sleepActorRole = data.sleepActorRole;
  if (data.sleeping) {
    card.dataset.sleeping = "true";
    card.classList.add("sleeping");
  }

  const isPainter = card.dataset.workRole === "手绘师";
  const saleText = data.saleStatus || (isPainter ? "未出售" : "未出售");
  const customerText = data.customerStatus || (isPainter ? "未进入客户选稿" : "未进入客户选稿");
  const reviewTextValue = data.reviewStatus || (isPainter ? "不参与设计稿审核" : "待审核 / 管理者未评审");
  const linkedText = data.linkedPainter || "无引用 / 原创设计";
  const statusRow = isPainter
    ? `<span class="sale-badge ${statusBadgeClass(saleText)}">作品状态：${escapeHtml(saleText)}</span><span class="sale-badge unsold">引用稿：${escapeHtml(data.referencedDesign || "暂无")}</span>`
    : `<span class="sale-badge ${statusBadgeClass(saleText)}">销售状态：${escapeHtml(saleText)}</span><span class="sale-badge ${statusBadgeClass(customerText)}">客户状态：${escapeHtml(customerText)}</span>`;

  card.innerHTML = `
    <button class="preview-trigger" type="button" aria-label="放大查看 ${escapeHtml(data.file)}"></button>
    <div class="work-body">
      <strong class="file-name">${escapeHtml(data.file)}</strong>
      <div class="work-head">
        <strong>${escapeHtml(data.title || data.file)}</strong>
        <span class="sale-badge ${statusBadgeClass(saleText)}">${escapeHtml(saleText)}</span>
      </div>
      <div class="status-row">${statusRow}</div>
      <p>项目：${escapeHtml(data.project || "未关联项目")}</p>
      <dl>
        ${
          isPainter
            ? `<div><dt>作品状态</dt><dd>${escapeHtml(saleText)}</dd></div>
               <div><dt>引用设计</dt><dd>${escapeHtml(data.referencedDesign || "暂无")}</dd></div>
               <div><dt>客户状态</dt><dd>${escapeHtml(customerText)}</dd></div>`
            : `<div><dt>审核状态</dt><dd>${escapeHtml(reviewTextValue)}</dd></div>
               <div><dt>客户状态</dt><dd>${escapeHtml(customerText)}</dd></div>
               <div><dt>引用手绘</dt><dd>${escapeHtml(linkedText)}</dd></div>
               <div><dt>参考素材</dt><dd>${escapeHtml(data.referenceMaterial || "未提供参考图")}</dd></div>`
        }
      </dl>
    </div>
  `;

  if (data.imageData) applyImageData(card, data.imageData, { syncReview: !deferImageSync });
  worksBoard.prepend(card);
  renderCardTags(card);
  enhanceOneWorkCard(card);
  return card;
}

function applyStoredState() {
  loadStudioState();
  // 兼容历史订单/稿件保存的旧 JPG 衍生图地址；压缩后统一迁移到同名 WebP。
  const storedImageReferencesBefore = JSON.stringify({
    createdWorks: studioState.createdWorks || [],
    overrides: studioState.overrides || {},
  });
  (studioState.createdWorks || []).forEach(normalizeStoredWorkImageReferences);
  Object.values(studioState.overrides || {}).forEach(normalizeStoredWorkImageReferences);
  const migratedLegacyImageReferences = storedImageReferencesBefore !== JSON.stringify({
    createdWorks: studioState.createdWorks || [],
    overrides: studioState.overrides || {},
  });
  // 种子版本升级：清掉旧的案例种子（含旧字段），让它们按新逻辑重新生成。
  if (localStorage.getItem(SEED_VERSION_KEY) !== SEED_VERSION) {
    studioState.createdWorks = (studioState.createdWorks || []).filter(
      (work) => !work.caseSeed && work.referenceMaterial !== "案例资料"
    );
    (customProjects || []).length && (customProjects = customProjects.filter((project) => !project.caseSeed));
    try {
      localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
    } catch (error) {
      console.warn("seed version write failed", error);
    }
  }
  syncProjectMemberOptions();
  studioOrders = studioState.orders?.length ? studioState.orders : [...defaultOrders];
  if (localStorage.getItem(LEGACY_AUTO_PRICE_MIGRATION_KEY) !== "done") {
    studioOrders.forEach((order) => {
      const oldAutomaticPrice = orderPatternList(order).length * 100;
      if (!order.priceManuallySet && Number(order.price) === oldAutomaticPrice) order.price = null;
    });
    try {
      localStorage.setItem(LEGACY_AUTO_PRICE_MIGRATION_KEY, "done");
    } catch {}
    // In backend mode the server is authoritative. Before login there is no
    // authenticated session to sync this migration, so writing defaults here
    // would make the first login overwrite the cloud snapshot and trigger a
    // reload loop.
    if (!RELEASE_CONFIG.useBackendAuth) saveStudioState();
  }
  const existingWorkFiles = new Set([...workCards].map((card) => card.dataset.file));
  (studioState.createdWorks || []).forEach((work) => {
    if (!work?.file || existingWorkFiles.has(work.file)) return;
    createWorkCard({ ...work, generated: true });
    existingWorkFiles.add(work.file);
  });
  refreshWorkCards();

  workCards.forEach((card) => {
    const file = card.dataset.file;
    if ((studioState.removedFiles || []).includes(file)) {
      card.remove();
      return;
    }
    const patch = studioState.overrides?.[file];
    if (!patch) return;
    if (patch.version) card.dataset.version = patch.version;
    if (patch.colors) card.dataset.colors = patch.colors;
    if (typeof patch.tags === "string") card.dataset.tags = normalizeTags(patch.tags);
    if (patch.deletedAt) {
      card.dataset.deletedAt = patch.deletedAt;
      if (patch.deletedByKey) card.dataset.deletedByKey = patch.deletedByKey;
      if (patch.deletedByRole) card.dataset.deletedByRole = patch.deletedByRole;
      card.classList.add("deleted");
    }
    if (patch.imageKey) setImageKey(card, patch.imageKey);
    if (patch.paletteKeys) card.dataset.paletteKeys = patch.paletteKeys;
    if (patch.paletteFiles) card.dataset.paletteFiles = patch.paletteFiles;
    if (patch.workImages) card.dataset.workImages = patch.workImages;
    if (patch.paletteThumbKeys) card.dataset.paletteThumbKeys = patch.paletteThumbKeys;
    if (patch.referenceKeys) card.dataset.referenceKeys = patch.referenceKeys;
    if (patch.sourceFileName) card.dataset.sourceFileName = patch.sourceFileName;
    if (patch.sourceFileKey) card.dataset.sourceFileKey = patch.sourceFileKey;
    if (patch.sourceFileType) card.dataset.sourceFileType = patch.sourceFileType;
    if (patch.sourceFiles) card.dataset.sourceFiles = patch.sourceFiles;
    if (patch.projectId) card.dataset.projectId = patch.projectId;
    if (patch.project) updateCardProject(card, patch.project);
    if (patch.linkedPainter) updateCardLinkedPainter(card, patch.linkedPainter);
    if (patch.linkedSketches) card.dataset.linkedSketches = patch.linkedSketches;
    if (patch.referenceMaterial) updateCardReferenceMaterial(card, patch.referenceMaterial);
    if (patch.reviewStatus) updateCardReviewStatus(card, patch.reviewStatus);
    if (patch.reviewNote) card.dataset.reviewNote = patch.reviewNote;
    if (patch.reviewAction) card.dataset.reviewAction = patch.reviewAction;
    if (patch.reviewLogs) card.dataset.reviewLogs = patch.reviewLogs;
    if (patch.reviewState) card.dataset.reviewState = patch.reviewState;
    if (patch.submissionRound) card.dataset.submissionRound = patch.submissionRound;
    if (patch.resubmittedAt) card.dataset.resubmittedAt = patch.resubmittedAt;
    if (patch.sleepPreviousReviewStatus) card.dataset.sleepPreviousReviewStatus = patch.sleepPreviousReviewStatus;
    if (patch.sleepPreviousReviewAction) card.dataset.sleepPreviousReviewAction = patch.sleepPreviousReviewAction;
    if (patch.sleepPreviousReviewLogs) card.dataset.sleepPreviousReviewLogs = patch.sleepPreviousReviewLogs;
    if (patch.sleepActorKey) card.dataset.sleepActorKey = patch.sleepActorKey;
    if (patch.sleepActorRole) card.dataset.sleepActorRole = patch.sleepActorRole;
    if (patch.sleeping) {
      card.dataset.sleeping = "true";
      card.classList.add("sleeping");
    }
  });

  refreshWorkCards();
  deletedWorks = [...workCards]
    .filter((card) => card.classList.contains("deleted"))
    .map((card) => ({ card, deletedAt: card.dataset.deletedAt || new Date().toISOString() }));
  purgeExpiredRecycleBin();
  renderCustomProjects();
  if (migratedLegacyImageReferences) saveStudioState();
}

async function hydrateStoredImages() {
  // 各视图只在卡片真正进入首屏时解析图片，禁止登录阶段预建并观察整个作品库。
  return Promise.resolve();
}

const workMeta = {
  "K-WFQM0001": { version: "2026-06-24 09:30", colors: 3 },
  "K-DBHJ0002": { version: "2026-06-24 08:52", colors: 1 },
  "K-SHHY0003": { version: "2026-06-23 18:14", colors: 2 },
  "K-WTZB0004": { version: "2026-06-23 15:40", colors: 4 },
  "K-SCQZ0005": { version: "2026-06-22 17:08", colors: 2 },
  "K-XBJH0006": { version: "2026-06-22 13:25", colors: 1 },
  "K-ETMJ0007": { version: "2026-06-21 16:12", colors: 1 },
  "K-LRDB0008": { version: "2026-06-24 10:20", colors: 2 },
  "K-NTTM0009": { version: "2026-06-20 11:36", colors: 1 },
  "K-SCZY0010": { version: "2026-06-23 10:18", colors: 3 },
  "K-XHSD0011": { version: "2026-06-19 14:44", colors: 1 },
  "K-HYSD0012": { version: "2026-06-21 09:55", colors: 2 },
};

function activeViewId() {
  return document.querySelector(".view.active")?.id;
}

function activeWorkCards() {
  return [...workCards].filter((card) => !isArchivedForCurrentWorks(card));
}



function relatedOrderItems() {
  return studioOrders.filter(orderBelongsToCurrentAccount);
}

function adminRiskData() {
  const projects = activeProjectItems().filter((project) => {
    const days = pjDaysLeft(project);
    return days !== null && days <= 3;
  });
  const orders = relatedOrderItems().filter((order) => orderProgressStatus(order) === "待评审");
  return { projects, orders };
}


function renderRiskModal() {
  const { projects, orders } = adminRiskData();
  const projectItems = projects.length
    ? projects.map((project) => `<button class="risk-item" type="button" data-risk-project="${escapeHtml(project.id)}">
        <span class="risk-item-main"><strong>${escapeHtml(project.name || project.id)}</strong><small>截止 ${escapeHtml(project.deadline || "未设置")} · 参与人员：${escapeHtml(riskProjectPeople(project))}</small></span>
        <span class="risk-item-arrow" aria-hidden="true">→</span>
      </button>`).join("")
    : `<p class="risk-empty">暂无临近截止项目</p>`;
  const orderItems = orders.length
    ? orders.map((order) => `<button class="risk-item" type="button" data-risk-order="${escapeHtml(order.id)}">
        <span class="risk-item-main"><strong>${escapeHtml(order.id)} · ${escapeHtml(order.customer || "未设置客户")}</strong><small>待评审 · 交期 ${escapeHtml(order.deliveryAt || "未设置")} · 负责人：${escapeHtml(order.owner || "待分配")}</small></span>
        <span class="risk-item-arrow" aria-hidden="true">→</span>
      </button>`).join("")
    : `<p class="risk-empty">暂无待评审订单</p>`;
  riskModalBody.innerHTML = `
    <section class="risk-section"><div class="risk-section-head"><h3>临近截止项目</h3><span>${projects.length}</span></div>${projectItems}</section>
    <section class="risk-section"><div class="risk-section-head"><h3>待评审订单</h3><span>${orders.length}</span></div>${orderItems}</section>`;
}

function openRiskModal() {
  renderRiskModal();
  riskModal.classList.add("active");
  riskModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeRiskModal() {
  riskModal.classList.remove("active");
  riskModal.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

function focusRiskOrder(orderId) {
  closeRiskModal();
  orderStatusFilter.value = "待评审";
  orderSearch.value = "";
  switchView("orders");
  renderOrderCenter();
  requestAnimationFrame(() => {
    const target = [...orderList.querySelectorAll("[data-order-card]")].find((card) => card.dataset.orderCard === orderId);
    if (!target) return;
    target.classList.add("risk-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => target.classList.remove("risk-highlight"), 4200);
  });
}

function adminBusinessSnapshot() {
  const paidOrders = studioOrders.filter((order) => order.paymentStatus === "已支付");
  const paidAmount = paidOrders.reduce((sum, order) => sum + Number(orderPriceValue(order) || 0), 0);
  const soldWorks = paidOrders.reduce((sum, order) => sum + orderPatternList(order).length, 0);
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: `${date.getMonth() + 1}月`,
      amount: 0,
      works: 0,
    };
  });
  paidOrders.forEach((order) => {
    const source = String(order.paidAt || order.createdAt || order.time || "");
    const key = source.slice(0, 7).replace(/[.]/g, "-");
    const bucket = months.find((item) => item.key === key);
    if (!bucket) return;
    bucket.amount += Number(orderPriceValue(order) || 0);
    bucket.works += orderPatternList(order).length;
  });
  const ranks = teamMembers
    .filter((member) => ["设计师", "手绘师"].includes(member.role) && (member.accountStatus || "正常") === "正常")
    .map((member) => {
      const ownFiles = new Set(memberWorkItems(member).map((card) => card.dataset.file));
      const sold = soldContributionEvents().filter((event) => ownFiles.has(event.file)).length;
      return { member, sold };
    })
    .sort((a, b) => b.sold - a.sold || a.member.name.localeCompare(b.member.name, "zh-CN"));
  return { paidOrders, paidAmount, soldWorks, months, ranks };
}

function businessTrendBuckets(range = "month") {
  const now = new Date();
  const definitions = {
    day: { count: 30, step: "day", label: "近 30 天" },
    week: { count: 12, step: "week", label: "近 12 周" },
    month: { count: 12, step: "month", label: "近 12 个月" },
    year: { count: 5, step: "year", label: "近 5 年" },
  };
  const option = definitions[range] || definitions.month;
  const keyFor = (date) => {
    if (option.step === "day") return dateKey(date);
    if (option.step === "week") {
      const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      return dateKey(monday);
    }
    if (option.step === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return String(date.getFullYear());
  };
  const labelFor = (date) => {
    if (option.step === "day") return `${date.getMonth() + 1}/${date.getDate()}`;
    if (option.step === "week") return `${date.getMonth() + 1}/${date.getDate()}`;
    if (option.step === "month") return `${date.getFullYear()}/${date.getMonth() + 1}`;
    return `${date.getFullYear()} 年`;
  };
  const buckets = Array.from({ length: option.count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const distance = option.count - index - 1;
    if (option.step === "day") date.setDate(date.getDate() - distance);
    if (option.step === "week") date.setDate(date.getDate() - (distance * 7) - ((date.getDay() + 6) % 7));
    if (option.step === "month") date.setMonth(date.getMonth() - distance, 1);
    if (option.step === "year") date.setFullYear(date.getFullYear() - distance, 0, 1);
    return { key: keyFor(date), label: labelFor(date), date, amount: 0, works: 0 };
  });
  studioOrders.filter((order) => order.paymentStatus === "已支付").forEach((order) => {
    const paidDate = new Date(order.paidAt || order.createdAt || order.time || 0);
    if (Number.isNaN(paidDate.getTime())) return;
    const bucket = buckets.find((item) => item.key === keyFor(paidDate));
    if (!bucket) return;
    bucket.amount += Number(orderPriceValue(order) || 0);
    bucket.works += orderPatternList(order).length;
  });
  return { ...option, range, buckets };
}

function renderBusinessTrendPanel(range = "month") {
  const target = document.querySelector("#businessTrendPanel");
  if (!target) return;
  const trend = businessTrendBuckets(range);
  const maximum = Math.max(...trend.buckets.map((item) => item.amount), 1);
  const points = trend.buckets.map((item, index) => ({
    ...item,
    x: 20 + index * (560 / Math.max(1, trend.buckets.length - 1)),
    y: 142 - (item.amount / maximum) * 108,
    left: 3.33 + index * (93.34 / Math.max(1, trend.buckets.length - 1)),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `20,154 ${line} 580,154`;
  target.dataset.range = trend.range;
  target.innerHTML = `<div class="panel-head"><div><h3>成交趋势</h3><span>仅统计公司已支付成交额</span></div><div class="business-range-tabs" role="tablist" aria-label="成交趋势时间范围">${[["day", "日"], ["week", "周"], ["month", "月"], ["year", "年"]].map(([key, label]) => `<button type="button" data-business-range="${key}" class="${key === trend.range ? "active" : ""}" aria-pressed="${key === trend.range}">${label}</button>`).join("")}</div></div><div class="business-section-head"><h4>${trend.label}</h4></div><div class="business-plot"><svg viewBox="0 0 600 160" aria-hidden="true"><path class="business-chart-grid" d="M0 40H600M0 80H600M0 120H600"></path><polygon class="business-chart-area" points="${area}"></polygon><polyline class="business-chart-line" points="${line}"></polyline>${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="3.2"></circle>`).join("")}</svg><div class="business-chart-hits" style="grid-template-columns:repeat(${points.length},minmax(0,1fr))">${points.map((point, index) => `<button type="button" data-business-point="${index}" aria-label="${escapeHtml(point.label)}：成交额 ¥${Math.round(point.amount).toLocaleString("zh-CN")}、已售 ${point.works} 稿"></button>`).join("")}</div><div class="business-tooltip" aria-live="polite"></div></div><div class="business-chart-labels" style="grid-template-columns:repeat(${points.length},minmax(0,1fr))">${points.map((point, index) => `<span class="${index % Math.ceil(points.length / 6) ? "compact" : ""}"><b>${point.label}</b></span>`).join("")}</div>`;
  const tooltip = target.querySelector(".business-tooltip");
  target.querySelectorAll("[data-business-point]").forEach((button) => {
    const point = points[Number(button.dataset.businessPoint)];
    const show = () => {
      tooltip.textContent = `${point.label} · ¥${Math.round(point.amount).toLocaleString("zh-CN")} · ${point.works} 稿`;
      tooltip.style.left = `${point.left}%`;
      tooltip.style.top = `${Math.max(4, Math.min(96, (point.y / 160) * 100))}%`;
      tooltip.dataset.edge = Number(button.dataset.businessPoint) === 0 ? "start" : Number(button.dataset.businessPoint) === points.length - 1 ? "end" : "center";
      tooltip.classList.add("active");
    };
    button.addEventListener("mouseenter", show);
    button.addEventListener("focus", show);
    button.addEventListener("mouseleave", () => tooltip.classList.remove("active"));
    button.addEventListener("blur", () => tooltip.classList.remove("active"));
  });
}

function renderAdminDashboard() {
  const dashboard = document.querySelector('[data-role-dashboard="管理员"]');
  if (!dashboard) return;
  const metricGrid = dashboard.querySelector(".metric-grid");
  const commandGrid = dashboard.querySelector(".admin-command-grid");
  const cards = activeWorkCards();
  const today = dateKey(new Date());
  const pendingCards = cards.filter((card) => isReviewPending(card) && reviewDisplayDate(card) === today);
  const pendingDesigns = pendingCards.filter((card) => card.dataset.workRole === "设计师").length;
  const pendingPainter = pendingCards.filter((card) => card.dataset.workRole === "手绘师").length;
  const projects = activeProjectItems();
  const projectsAtReview = projects.filter((project) => projectStage(project) === "稿件评审").length;
  const projectsAtFinal = projects.filter((project) => projectStage(project) === "内部定稿").length;
  const orders = relatedOrderItems();
  const deliveryOrders = orders.filter((order) => ["已确认下单", "进行中", "待评审"].includes(orderProgressStatus(order))).length;
  const { projects: riskProjects, orders: riskOrders } = adminRiskData();
  const riskTotal = riskProjects.length + riskOrders.length;
  const teamLoadStats = teamMembers.map((member) => ({ member, stats: teamMemberStats(member) }));
  const lightLoadMembers = teamLoadStats.filter(({ stats }) => teamLoadClass(stats.loadScore) === "low");
  const mediumLoadMembers = teamLoadStats.filter(({ stats }) => teamLoadClass(stats.loadScore) === "medium");
  const highLoadMembers = teamLoadStats.filter(({ stats }) => teamLoadClass(stats.loadScore) === "hot");
  const loadTotal = Math.max(teamLoadStats.length, 1);
  const lightLoadPercent = (lightLoadMembers.length / loadTotal) * 100;
  const mediumLoadPercent = (mediumLoadMembers.length / loadTotal) * 100;
  const highLoadPercent = (highLoadMembers.length / loadTotal) * 100;
  const mediumLoadOffset = -lightLoadPercent;
  const highLoadOffset = -(lightLoadPercent + mediumLoadPercent);
  const highLoadNames = highLoadMembers.length ? highLoadMembers.map(({ member }) => member.name).join("，") : "暂无";
  const business = adminBusinessSnapshot();
  if (metricGrid) {
    metricGrid.classList.add("admin-metric-grid");
    metricGrid.innerHTML = `
      <button class="metric-card" type="button" data-dashboard-jump="review" data-review-date="${today}" aria-label="查看今天待评审稿件"><span>待评审稿件</span><strong>${pendingCards.length}</strong><p>今天 · 设计稿 ${pendingDesigns} / 手绘素材 ${pendingPainter}</p></button>
      <button class="metric-card" type="button" data-dashboard-jump="projects" aria-label="查看进行中项目"><span>进行中项目</span><strong>${projects.length}</strong><p>稿件评审 ${projectsAtReview} / 内部定稿 ${projectsAtFinal}</p></button>
      <button class="metric-card" type="button" data-dashboard-jump="orders" aria-label="查看待处理订单"><span>订单待处理</span><strong>${deliveryOrders}</strong><p>客户确认后进入订单中心</p></button>
      <button class="metric-card ${riskTotal ? "alert" : "safe"}" type="button" data-open-risk aria-label="查看风险提醒"><span>风险提醒</span><strong>${riskTotal}</strong><p class="risk-summary"><span>临近截止 ${riskProjects.length}</span><span>待评审 ${riskOrders.length}</span></p></button>
    `;
  }
  if (commandGrid) {
    const demoPendingCards = pendingCards.length;
    const demoProjects = projects.length;
    const demoDeliveryOrders = deliveryOrders;
    const rankMax = Math.max(...business.ranks.map((item) => item.sold), 1);
    commandGrid.innerHTML = `
      <section class="panel wide">
        <div class="panel-head">
          <h3>待处理</h3>
        </div>
        <div class="project-list project-command-list">
          <article data-dashboard-jump="review" data-review-date="${today}" role="button" tabindex="0">
            <div><strong>稿件审核</strong><span>今天 <b class="command-count ${demoPendingCards > 0 ? "has-value" : ""}">${demoPendingCards}</b> 张待处理，通过后才进入客户稿库。</span></div>
            <i class="command-status-dot ${demoPendingCards > 0 ? "attention" : "safe"}" aria-label="${demoPendingCards > 0 ? "待处理" : "正常"}"></i>
          </article>
          <article data-dashboard-jump="projects" role="button" tabindex="0">
            <div><strong>项目推进</strong><span><b class="command-count ${demoProjects > 0 ? "has-value" : ""}">${demoProjects}</b> 个项目进行中，${projectsAtFinal} 个等待管理员定稿。</span></div>
            <i class="command-status-dot ${riskProjects.length > 0 ? "attention" : "safe"}" aria-label="${riskProjects.length > 0 ? "临近截止" : "正常"}"></i>
          </article>
          <article data-dashboard-jump="orders" role="button" tabindex="0">
            <div><strong>订单交付</strong><span><b class="command-count ${demoDeliveryOrders > 0 ? "has-value" : ""}">${demoDeliveryOrders}</b> 个客户订单临近截止，请及时处理。</span></div>
            <i class="command-status-dot ${demoDeliveryOrders > 0 ? "attention" : "safe"}" aria-label="${demoDeliveryOrders > 0 ? "待处理" : "正常"}"></i>
          </article>
          <article data-dashboard-jump="team" role="button" tabindex="0">
            <div><strong>团队负载</strong><span>设计师与手绘师当前负载正常。</span></div>
            <i class="command-status-dot safe" aria-label="正常"></i>
          </article>
        </div>
      </section>
      <section class="panel employee-load-panel">
        <div class="panel-head">
          <div class="employee-panel-tabs"><button type="button" class="active" data-team-insight="load">员工负载</button><button type="button" data-team-insight="rank">作品产出</button></div>
          <button class="employee-team-link" type="button" data-dashboard-jump="team">查看我的团队 →</button>
        </div>
        <div class="employee-load-overview" data-team-insight-panel="load">
          <div class="employee-load-figure">
            <div class="employee-load-chart" data-active-load="">
              <div class="employee-load-ring" role="img" aria-label="团队成员负载分布">
                <svg viewBox="0 0 140 140" aria-hidden="true">
                  <circle class="employee-load-track" cx="70" cy="70" r="56"></circle>
                  <circle class="employee-load-segment low" data-load-type="low" data-load-label="轻负载" data-load-value="${lightLoadMembers.length}" tabindex="0"
                    cx="70" cy="70" r="56" pathLength="100" stroke-dasharray="${lightLoadPercent} ${100 - lightLoadPercent}" stroke-dashoffset="0"></circle>
                  <circle class="employee-load-segment medium" data-load-type="medium" data-load-label="中负载" data-load-value="${mediumLoadMembers.length}" tabindex="0"
                    cx="70" cy="70" r="56" pathLength="100" stroke-dasharray="${mediumLoadPercent} ${100 - mediumLoadPercent}" stroke-dashoffset="${mediumLoadOffset}"></circle>
                  <circle class="employee-load-segment hot" data-load-type="hot" data-load-label="高负载" data-load-value="${highLoadMembers.length}" tabindex="0"
                    cx="70" cy="70" r="56" pathLength="100" stroke-dasharray="${highLoadPercent} ${100 - highLoadPercent}" stroke-dashoffset="${highLoadOffset}"></circle>
                </svg>
                <span><strong>${teamLoadStats.length}</strong><small>成员</small></span>
              </div>
            </div>
            <p>当前团队工作负载分布</p>
          </div>
          <div class="employee-load-copy">
            <div class="employee-load-legend">
              <p data-load-type="low" data-load-label="轻负载" data-load-value="${lightLoadMembers.length}" tabindex="0"><span><i class="low"></i>轻负载</span><strong>${lightLoadMembers.length}</strong></p>
              <p data-load-type="medium" data-load-label="中负载" data-load-value="${mediumLoadMembers.length}" tabindex="0"><span><i class="medium"></i>中负载</span><strong>${mediumLoadMembers.length}</strong></p>
              <p data-load-type="hot" data-load-label="高负载" data-load-value="${highLoadMembers.length}" tabindex="0"><span><i class="hot"></i>高负载</span><strong>${highLoadMembers.length}</strong></p>
            </div>
            ${highLoadMembers.length ? `<p class="employee-high-load"><b>高负载成员</b><span>${escapeHtml(highLoadNames)}</span></p>` : ""}
          </div>
        </div>
        <div class="employee-rank-overview" data-team-insight-panel="rank">
          <p>按已售稿件数统计</p>
          <div class="business-rank-list">${business.ranks.length ? business.ranks.slice(0, 7).map((item, index) => `<button type="button" data-dashboard-performance="${escapeHtml(item.member.ownerKey)}"><b>${index + 1}</b><span class="team-avatar ${escapeHtml(item.member.tone)}">${memberAvatarInner(item.member)}</span><strong>${escapeHtml(item.member.name)}</strong><i><u style="width:${item.sold ? Math.max(12, Math.round((item.sold / rankMax) * 100)) : 0}%"></u></i><em>${item.sold} 稿</em></button>`).join("") : `<p>暂无设计或手绘人员。</p>`}</div>
        </div>
      </section>
      <div class="business-bottom-grid">
        <section class="panel business-summary-panel">
          <div class="panel-head"><div><h3>经营总览</h3><span>仅统计客户已支付订单</span></div><button type="button" data-dashboard-jump="orders">查看订单中心 →</button></div>
          <div class="business-summary-grid">
            <article><span>累计已支付成交额</span><strong>¥${Math.round(business.paidAmount).toLocaleString("zh-CN")}</strong><small>${business.paidOrders.length} 笔已支付订单</small></article>
            <article><span>累计已售稿件</span><strong>${business.soldWorks}</strong><small>按订单实际购买件数统计</small></article>
            <article><span>平均每单成交额</span><strong>¥${Math.round(business.paidOrders.length ? business.paidAmount / business.paidOrders.length : 0).toLocaleString("zh-CN")}</strong><small>仅以已支付订单计算</small></article>
          </div>
        </section>
        <section class="panel business-trend-panel" id="businessTrendPanel"></section>
      </div>
    `;
    renderBusinessTrendPanel("month");
    const loadChart = commandGrid.querySelector(".employee-load-chart");
    const loadTargets = commandGrid.querySelectorAll("[data-load-type]");
    const setActiveLoad = (target) => {
      if (!loadChart || !target) return;
      const type = target.dataset.loadType;
      loadChart.dataset.activeLoad = type;
    };
    const clearActiveLoad = () => {
      if (!loadChart) return;
      loadChart.dataset.activeLoad = "";
    };
    loadTargets.forEach((target) => {
      target.addEventListener("mouseenter", () => setActiveLoad(target));
      target.addEventListener("focus", () => setActiveLoad(target));
      target.addEventListener("mouseleave", clearActiveLoad);
      target.addEventListener("blur", clearActiveLoad);
    });
    commandGrid.querySelectorAll("[data-team-insight]").forEach((button) => {
      if (!button.dataset.teamInsight || button.dataset.dashboardJump) return;
      button.addEventListener("click", () => {
        commandGrid.querySelector(".employee-load-panel")?.setAttribute("data-team-insight", button.dataset.teamInsight);
        commandGrid.querySelectorAll("[data-team-insight]").forEach((item) => item.classList.toggle("active", item === button));
      });
    });
  }
}

let designerDashboardRange = "month";

function creativeOwnCards(role = currentAccount.role) {
  return activeWorkCards().filter((card) =>
    card.dataset.workRole === role && card.dataset.workOwner === currentAccount.ownerKey
  );
}

function designerCardDate(card) {
  const value = card.dataset.createdAt || card.dataset.version || "";
  const date = new Date(String(value).replace(/\./g, "-"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function designerRangeStart(range, now = new Date()) {
  const months = range === "six" ? 5 : range === "three" ? 2 : 0;
  return new Date(now.getFullYear(), now.getMonth() - months, 1);
}

function designerSoldEvents(cards) {
  const ownFiles = new Set(cards.map((card) => card.dataset.file));
  return soldContributionEvents().filter((event) => ownFiles.has(event.file)).sort((a, b) => b.at - a.at);
}

function designerProductionBuckets(range, cards, soldEvents) {
  const now = new Date();
  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const count = Math.ceil(daysInMonth / 7);
    return Array.from({ length: count }, (_, index) => {
      const from = new Date(start);
      from.setDate(index * 7 + 1);
      const to = new Date(start);
      to.setDate(Math.min(daysInMonth, index * 7 + 7));
      to.setHours(23, 59, 59, 999);
      const inBucket = (date) => date && date >= from && date <= to;
      const uploaded = cards.filter((card) => inBucket(designerCardDate(card)));
      return {
        label: `第${index + 1}周`,
        dateLabel: `${from.getMonth() + 1}月${from.getDate()}日-${to.getMonth() + 1}月${to.getDate()}日`,
        uploaded: uploaded.length,
        approved: uploaded.filter((card) => fieldValue(card, "审核状态").includes("已通过")).length,
        sold: soldEvents.filter((event) => inBucket(event.at)).length,
      };
    });
  }
  const count = range === "six" ? 6 : 3;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);
    const inBucket = (value) => value && value.getFullYear() === date.getFullYear() && value.getMonth() === date.getMonth();
    const uploaded = cards.filter((card) => inBucket(designerCardDate(card)));
    return {
      label: `${date.getMonth() + 1}月`,
      dateLabel: `${date.getFullYear()}年${date.getMonth() + 1}月`,
      uploaded: uploaded.length,
      approved: uploaded.filter((card) => fieldValue(card, "审核状态").includes("已通过")).length,
      sold: soldEvents.filter((event) => inBucket(event.at)).length,
    };
  });
}

function designerTaskItems(cards, projects) {
  const now = new Date();
  const today = dateKey(now);
  const revisionItems = cards
    .filter((card) => cardStatusSummary(card).includes("需修改") || cardStatusSummary(card).includes("未修改"))
    .map((card) => ({
      kind: "work",
      id: card.dataset.file,
      title: card.querySelector(".work-head strong")?.textContent.trim() || card.dataset.file,
      meta: "评审反馈 · 需要修改",
      label: "需修改",
      priority: 1,
    }));
  const projectItems = projects
    .filter((project) => project.status !== "已完成" && project.status !== "已关闭")
    .map((project) => {
      const deadline = pjDateOnly(project.deadline || project.endAt);
      const days = deadline ? daysUntil(deadline) : null;
      return {
        kind: "project",
        id: project.id,
        title: project.name || project.id,
        meta: `${projectStage(project)} · ${deadline ? `截止 ${deadline}` : "未设置截止时间"}`,
        label: deadline === today ? "今天截止" : days !== null && days <= 3 ? "临近截止" : "进行中",
        priority: deadline === today ? 0 : days !== null && days <= 3 ? 2 : 3,
      };
    });
  return [...revisionItems, ...projectItems].sort((a, b) => a.priority - b.priority).slice(0, 5);
}

function designerSoldCardHtml(event) {
  const card = sourceCardByFile(event.file);
  if (!card) return "";
  const source = cardPreviewSource(card);
  const imageKey = card.dataset.imageKey || "";
  const image = source
    ? `<img src="${escapeHtml(source)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low">`
    : imageKey
      ? `<img data-image-key="${escapeHtml(imageKey)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low">`
      : "";
  const colors = Number(card.dataset.colors || 1);
  const soldDate = `${event.at.getMonth() + 1}月${event.at.getDate()}日售出`;
  return `<button class="designer-sold-card" type="button" data-designer-work="${escapeHtml(event.file)}">
    <span class="designer-sold-thumb" data-image-shell>${image}<i>配色 ${colors}</i></span>
    <strong>${escapeHtml(event.file)}</strong>
    <small>${soldDate}</small>
  </button>`;
}

function renderDesignerDashboard(role = currentAccount.role) {
  if (!['设计师', '手绘师'].includes(role) || currentAccount.role !== role) return;
  const dashboard = document.querySelector(role === "手绘师" ? "#painterDashboard" : "#designerDashboard");
  if (!dashboard) return;
  const cards = creativeOwnCards(role);
  const pending = cards.filter(isReviewPending).length;
  const revision = cards.filter((card) => cardStatusSummary(card).includes("需修改") || cardStatusSummary(card).includes("未修改")).length;
  const soldEvents = designerSoldEvents(cards);
  const soldFiles = new Set(soldEvents.map((event) => event.file));
  const ownSketchFiles = role === "手绘师" ? new Set(cards.map((card) => card.dataset.file)) : new Set();
  const referencedCount = role === "手绘师"
    ? [...workCards]
      .filter((card) => card.dataset.workRole === "设计师")
      .reduce((sum, card) => sum + getLinkedSketches(card).filter((file) => ownSketchFiles.has(file)).length, 0)
    : 0;
  const start = designerRangeStart(designerDashboardRange);
  const rangedCards = cards.filter((card) => {
    const date = designerCardDate(card);
    return date && date >= start;
  });
  const rangedSold = soldEvents.filter((event) => event.at >= start);
  const approved = rangedCards.filter((card) => fieldValue(card, "审核状态").includes("已通过")).length;
  const buckets = designerProductionBuckets(designerDashboardRange, cards, soldEvents);
  const maxValue = Math.max(1, ...buckets.flatMap((bucket) => [bucket.uploaded, bucket.approved, bucket.sold]));
  const member = teamMembers.find((item) => item.ownerKey === currentAccount.ownerKey || item.name === currentAccount.name);
  const tasks = designerTaskItems(cards, memberProjectItems(member));
  const business = adminBusinessSnapshot();
  const roleRanks = business.ranks
    .filter((item) => item.member.role === role)
    .map((item) => item.member.ownerKey === currentAccount.ownerKey
      ? { ...item, member: { ...item.member, name: currentAccount.name || item.member.name } }
      : item)
    .sort((a, b) => b.sold - a.sold || a.member.name.localeCompare(b.member.name, "zh-CN"));
  const rankMax = Math.max(1, ...roleRanks.map((item) => item.sold));
  const currentRankIndex = roleRanks.findIndex((item) => item.member.ownerKey === currentAccount.ownerKey);
  const currentRankItem = currentRankIndex >= 0
    ? roleRanks[currentRankIndex]
    : {
      member: { ...(member || {}), name: currentAccount.name || member?.name || role, role, ownerKey: currentAccount.ownerKey, tone: member?.tone || "blue" },
      sold: soldFiles.size,
    };
  const currentRank = currentRankIndex >= 0
    ? currentRankIndex + 1
    : roleRanks.filter((item) => item.sold > currentRankItem.sold).length + 1;
  const rankingRows = [
    { ...currentRankItem, rank: currentRank, current: true },
    ...roleRanks
      .map((item, index) => ({ ...item, rank: index + 1, current: false }))
      .filter((item) => item.member.ownerKey !== currentAccount.ownerKey)
      .slice(0, 6),
  ];
  const recentSold = [...new Map(rangedSold.map((event) => [event.file, event])).values()].slice(0, 5);
  const rangeTitle = designerDashboardRange === "six" ? "近6个月" : designerDashboardRange === "three" ? "近3个月" : "本月";
  dashboard.innerHTML = `
    <div class="designer-metric-grid${role === "手绘师" ? " has-reference" : ""}">
      <button class="designer-metric" type="button" data-dashboard-jump="designer">
        <span>我的${role === "手绘师" ? "手绘稿" : "稿件"}</span><strong>${cards.length}</strong><small>统计截止至今日</small>
        <i class="metric-status-review"><b>待评审</b><em>${pending}</em></i>
      </button>
      <article class="designer-metric">
        <span>已售出</span><strong>${soldFiles.size}<em>/ ${cards.length}</em></strong><small>${role === "手绘师" ? "仅首次带动设计稿成交时计入" : "个人设计稿售出情况"}</small>
      </article>
      <button class="designer-metric designer-metric-pending" type="button" data-dashboard-jump="designer">
        <span>待处理</span><strong>${revision}</strong><small>需要修改的稿件</small>
        <i class="${revision > 0 ? "metric-status-revision" : "metric-status-clear"}"><b>需修改</b><em>${revision}</em></i>
      </button>
      ${role === "手绘师" ? `<article class="designer-metric designer-metric-reference">
        <span>被引用</span><strong>${referencedCount}</strong><small>手绘稿被设计稿引用的总次数</small>
      </article>` : ""}
    </div>
    <div class="designer-main-grid">
      <section class="panel designer-production-panel">
        <div class="panel-head"><div><h3>${rangeTitle}作品产出</h3><span>仅统计我的稿件</span></div>
          <div class="designer-range-tabs" role="tablist" aria-label="作品产出时间范围">
            <button type="button" data-designer-range="month" class="${designerDashboardRange === "month" ? "active" : ""}">本月</button>
            <button type="button" data-designer-range="three" class="${designerDashboardRange === "three" ? "active" : ""}">近3个月</button>
            <button type="button" data-designer-range="six" class="${designerDashboardRange === "six" ? "active" : ""}">近6个月</button>
          </div>
        </div>
        <div class="designer-production-summary">
          <article><span>上传数</span><strong>${rangedCards.length}</strong></article>
          <article><span>通过数</span><strong>${approved}</strong></article>
          <article><span>售出数</span><strong>${rangedSold.length}</strong></article>
        </div>
        <div class="designer-chart-legend"><span><i class="upload"></i>上传</span><span><i class="approved"></i>通过</span><span><i class="sold"></i>售出</span></div>
        <div class="designer-bar-chart">${buckets.map((bucket) => `<div class="designer-bar-group" tabindex="0" aria-label="${escapeHtml(`${bucket.dateLabel}，上传 ${bucket.uploaded} 件，通过 ${bucket.approved} 件，售出 ${bucket.sold} 件`)}">
          <div><i class="upload" style="height:${bucket.uploaded ? Math.max(3, Math.round((bucket.uploaded / maxValue) * 100)) : 0}%"></i><i class="approved" style="height:${bucket.approved ? Math.max(3, Math.round((bucket.approved / maxValue) * 100)) : 0}%"></i><i class="sold" style="height:${bucket.sold ? Math.max(3, Math.round((bucket.sold / maxValue) * 100)) : 0}%"></i></div>
          <span>${bucket.label}</span>
          <aside class="designer-chart-tooltip" role="tooltip">
            <strong>${escapeHtml(bucket.dateLabel)}</strong>
            <span><i class="upload"></i><b>上传</b><em>${bucket.uploaded} 件</em></span>
            <span><i class="approved"></i><b>通过</b><em>${bucket.approved} 件</em></span>
            <span><i class="sold"></i><b>售出</b><em>${bucket.sold} 件</em></span>
          </aside>
        </div>`).join("")}</div>
      </section>
      <section class="panel designer-ranking-panel">
        <div class="panel-head"><div><h3>作品产出</h3></div></div>
        <div class="designer-ranking-list">${rankingRows.map((item) => `<div class="${item.current ? "is-current" : ""}">
          <b>${item.rank}</b><span class="team-avatar ${escapeHtml(item.member.tone)}">${memberAvatarInner(item.member)}</span>
          <strong>${escapeHtml(item.member.name)}</strong><i><u style="width:${item.sold ? Math.max(10, Math.round((item.sold / rankMax) * 100)) : 0}%"></u></i><em>${item.sold} 稿</em>
        </div>`).join("") || `<p class="designer-empty">无</p>`}</div>
      </section>
    </div>
    <section class="panel designer-task-panel">
      <div class="panel-head"><div><h3>今日待办</h3><span>按紧急程度排序</span></div></div>
      <div class="designer-task-list">${tasks.length ? tasks.map((task) => `<button type="button" ${task.kind === "work" ? `data-designer-work="${escapeHtml(task.id)}"` : `data-designer-project="${escapeHtml(task.id)}"`}><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.meta)}</small></span><i class="${task.priority <= 1 ? "urgent" : ""}">${task.label}</i><em aria-hidden="true">→</em></button>`).join("") : `<p class="designer-empty">无</p>`}</div>
    </section>
    <section class="panel designer-recent-panel">
      <div class="panel-head"><div><h3>近期售出作品</h3><span>${rangeTitle}</span></div><button type="button" data-dashboard-jump="designer">查看全部 →</button></div>
      <div class="designer-sold-grid">${recentSold.length ? recentSold.map(designerSoldCardHtml).join("") : `<p class="designer-empty">无</p>`}</div>
    </section>`;
  hydrateLazyKeyImages(dashboard);
}

function renderCreativeDashboard(role) {
  if (role === "设计师" || role === "手绘师") {
    renderDesignerDashboard(role);
    return;
  }
  const dashboard = document.querySelector(`[data-role-dashboard="${role}"]`);
  if (!dashboard) return;
  const metricGrid = dashboard.querySelector(".metric-grid");
  const taskList = dashboard.querySelector(".personal-task-list");
  const cards = activeWorkCards().filter((card) => card.dataset.workRole === role && card.dataset.workOwner === currentAccount.ownerKey);
  const pending = cards.filter(isReviewPending).length;
  const revision = cards.filter((card) => cardStatusSummary(card).includes("需修改") || cardStatusSummary(card).includes("未修改")).length;
  const sleeping = cards.filter(isSleepingWork).length;
  const sold = cards.filter((card) => cardStatusSummary(card).includes("已出售") || cardStatusSummary(card).includes("出售")).length;
  const member = teamMembers.find((item) => item.ownerKey === currentAccount.ownerKey || item.name === currentAccount.name);
  const projects = memberProjectItems(member);
  const approved = Math.max(0, cards.length - pending - revision);
  if (metricGrid) {
    metricGrid.innerHTML = `
      <article class="metric-card"><span>我的稿件</span><strong>${cards.length}</strong><p>${pending} 张等待审核或复核</p></article>
      <article class="metric-card"><span>已出售</span><strong>${sold}</strong><p>来自客户订单和稿库成交</p></article>
      <article class="metric-card alert"><span>需处理</span><strong>${revision + sleeping}</strong><p>需修改 ${revision} / 休眠 ${sleeping}</p></article>
      <article class="metric-card"><span>已评审</span><strong>${approved}</strong><p>已完成管理员审核的个人稿件</p></article>
    `;
  }
  if (taskList) {
    taskList.innerHTML = `
      <p><b>负责项目</b><span>${projects.slice(0, 2).map((project) => project.name).join("、") || "暂无负责项目"}</span></p>
      <p><b>稿件处理</b><span>${pending} 张待审核，${revision} 张需修改</span></p>
      <p><b>休眠稿件</b><span>${sleeping} 张暂存，可继续完善后提交</span></p>
    `;
  }
}

function salesDashboardDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(/[.]/g, "-").replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function salesDashboardDaysSince(value) {
  const date = salesDashboardDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function salesDashboardRelativeDay(value) {
  const days = salesDashboardDaysSince(value);
  if (days == null) return "尚无看稿记录";
  if (days === 0) return "今天看过稿";
  if (days === 1) return "昨天看过稿";
  return `${days} 天前看过稿`;
}

function salesDashboardEmpty(text) {
  return `<div class="sales-empty"><span>${escapeHtml(text)}</span></div>`;
}

function salesDashboardCustomerItems() {
  if (!customerCenterClients.length) customerCenterClients = buildCustomerCenter();
  return customerCenterClients.map((client) => {
    const carts = selectionCarts.filter((cart) =>
      String(cart.customerId || "") === String(client.id || "")
      || String(cart.company || "").trim() === String(client.name || "").trim()
    );
    const cartFiles = carts.reduce((total, cart) => total + (cart.files || []).length, 0);
    const lastReview = customerRealLastReview(client);
    const reviewDays = salesDashboardDaysSince(lastReview);
    return { client, cartFiles, lastReview, reviewDays };
  }).filter((item) => item.reviewDays != null || item.cartFiles > 0)
    .sort((a, b) => Number(Boolean(b.cartFiles)) - Number(Boolean(a.cartFiles)) || (a.reviewDays ?? 9999) - (b.reviewDays ?? 9999));
}

function salesDashboardOrderItems() {
  return relatedOrderItems().filter((order) => !["已完成", "已关闭"].includes(orderProgressStatus(order)))
    .map((order) => ({ order, days: daysUntil(order.deliveryAt) }))
    .sort((a, b) => {
      const aDays = a.days < 0 ? a.days : a.days ?? 9999;
      const bDays = b.days < 0 ? b.days : b.days ?? 9999;
      return aDays - bDays;
    });
}

function salesDashboardOrderState(order) {
  if (order.paymentStatus !== "已支付") return "款项待确认";
  if (orderDeliverStatus(order) !== "已交付") return "交付处理中";
  return orderProgressStatus(order);
}

function salesDashboardSalesTrend(orders) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: `${date.getMonth() + 1} 月`,
      amount: 0,
      count: 0,
    };
  });
  orders.filter((order) => order.paymentStatus === "已支付").forEach((order) => {
    const date = salesDashboardDate(order.paidAt || order.createdAt || order.time);
    if (!date) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const month = months.find((item) => item.key === key);
    if (!month) return;
    month.amount += Number(orderPriceValue(order) || 0);
    month.count += 1;
  });
  return { previous: months.slice(0, 6), current: months.slice(6) };
}

function renderSalesDashboard() {
  const dashboard = document.querySelector('[data-role-dashboard="销售"]');
  if (!dashboard) return;
  const shell = dashboard.querySelector(".sales-dashboard-shell");
  if (!shell) return;
  const orders = relatedOrderItems();
  const activeOrders = salesDashboardOrderItems();
  const completed = orders.filter((order) => orderProgressStatus(order) === "已完成").length;
  const cartEntries = selectionCarts.filter((entry) => (entry.files || []).length > 0);
  const customers = salesDashboardCustomerItems();
  const priority = [
    ...activeOrders.filter(({ days }) => days != null && days <= 3).map(({ order, days }) => ({
      tone: days < 0 ? "danger" : "warning",
      text: `${order.id} · ${days < 0 ? `已超过预计交付 ${Math.abs(days)} 天` : days === 0 ? "预计今天交付" : `距离预计交付 ${days} 天`} · ${salesDashboardOrderState(order)}`,
      tag: "订单处理",
      target: "orders",
    })),
    ...cartEntries.map((entry) => ({
      tone: "warning",
      text: `${entry.company || "未命名客户"} · 已选 ${(entry.files || []).length} 款作品，等待确认下单`,
      tag: "选稿确认",
      target: "cart",
    })),
    ...customers.filter((item) => item.reviewDays >= 7 && item.cartFiles === 0).map((item) => ({
      tone: "neutral",
      text: `${item.client.name} · ${salesDashboardRelativeDay(item.lastReview)}，尚未形成选稿单`,
      tag: "客户跟进",
      target: "library",
    })),
  ].slice(0, 4);
  const customerRows = customers.slice(0, 4).map(({ client, cartFiles, lastReview }) => `
    <button class="sales-list-row" type="button" data-dashboard-jump="library">
      <strong>${escapeHtml(client.name)}</strong>
      <span>${escapeHtml(salesDashboardRelativeDay(lastReview))}${cartFiles ? ` · ${cartFiles} 款待确认` : " · 暂无待确认选稿"}</span>
      <i aria-hidden="true">›</i>
    </button>`).join("");
  const orderRows = activeOrders.slice(0, 4).map(({ order, days }) => `
    <button class="sales-list-row" type="button" data-dashboard-jump="orders">
      <strong>${escapeHtml(order.id)} · ${escapeHtml(order.customer || "未设置客户")}</strong>
      <span class="${days != null && days <= 3 ? "is-urgent" : ""}">${days == null ? "未设置预计交付" : days < 0 ? `已逾期 ${Math.abs(days)} 天` : days === 0 ? "预计今天交付" : `距离预计交付 ${days} 天`} · ${escapeHtml(salesDashboardOrderState(order))}</span>
      <i aria-hidden="true">›</i>
    </button>`).join("");
  const trend = salesDashboardSalesTrend(orders);
  const trendMaximum = Math.max(...trend.current.map((item) => item.amount), ...trend.previous.map((item) => item.amount), 1);
  const trendAmount = trend.current.reduce((total, item) => total + item.amount, 0);
  const trendCount = trend.current.reduce((total, item) => total + item.count, 0);
  const trendPoint = (item, index) => ({ x: 24 + index * 110.4, y: 142 - (item.amount / trendMaximum) * 112 });
  const currentPoints = trend.current.map(trendPoint);
  const previousPoints = trend.previous.map(trendPoint);
  shell.innerHTML = `
    <section class="sales-kpi-grid" aria-label="销售业务概览">
      <button class="sales-kpi-card" type="button" data-dashboard-jump="designer"><span>可推荐作品</span><strong>${libraryEligibleDesigns().length}</strong><small>已通过审核且可供客户选择</small></button>
      <button class="sales-kpi-card" type="button" data-dashboard-jump="cart"><span>待确认选稿</span><strong>${cartEntries.length}</strong><small>${cartEntries.reduce((total, entry) => total + (entry.files || []).length, 0)} 款作品等待客户确认</small></button>
      <button class="sales-kpi-card ${activeOrders.length ? "is-alert" : ""}" type="button" data-dashboard-jump="orders"><span>处理中订单</span><strong>${activeOrders.length}</strong><small>${activeOrders.filter(({ days }) => days != null && days <= 3).length} 单临近或超过预计交付</small></button>
      <button class="sales-kpi-card" type="button" data-dashboard-jump="orders"><span>交付完成</span><strong>${completed}</strong><small>已完成客户交付的订单</small></button>
    </section>
    <section class="sales-dashboard-section">
      <div class="sales-section-heading"><h3>当前优先事项</h3><span>按交付时间与客户进展自动排序</span></div>
      <div class="sales-priority-list">${priority.length ? priority.map((item) => `
        <button class="sales-priority-row" type="button" data-dashboard-jump="${item.target}">
          <i class="${item.tone}" aria-hidden="true"></i><strong>${escapeHtml(item.text)}</strong><span>${item.tag}</span><em aria-hidden="true">›</em>
        </button>`).join("") : salesDashboardEmpty("当前没有需要立即处理的业务事项")}</div>
    </section>
    <section class="sales-dashboard-section sales-trend-section">
      <div class="sales-section-heading"><h3>成交趋势</h3><span>近 6 个月已支付订单</span></div>
      <div class="sales-trend-card">
        <div class="sales-trend-summary"><div><span>成交金额</span><strong>¥${Math.round(trendAmount).toLocaleString("zh-CN")}</strong></div><div><span>完成订单</span><strong>${trendCount}<small> 单</small></strong></div></div>
        <div class="sales-trend-plot" role="img" aria-label="近六个月与前六个月成交金额对比折线图">
          <svg viewBox="0 0 600 160" aria-hidden="true">
            <path class="sales-chart-grid" d="M0 30H600M0 68H600M0 106H600M0 144H600"></path>
            <polyline class="sales-chart-line previous" points="${previousPoints.map((point) => `${point.x},${point.y}`).join(" ")}"></polyline>
            <polyline class="sales-chart-line current" points="${currentPoints.map((point) => `${point.x},${point.y}`).join(" ")}"></polyline>
            ${previousPoints.map((point) => `<circle class="sales-chart-dot previous" cx="${point.x}" cy="${point.y}" r="3.5"></circle>`).join("")}
            ${currentPoints.map((point) => `<circle class="sales-chart-dot current" cx="${point.x}" cy="${point.y}" r="3.5"></circle>`).join("")}
          </svg>
          <div class="sales-trend-hits">${trend.current.map((item, index) => `<button type="button" data-sales-trend-point="${index}" aria-label="${escapeHtml(item.label)}：成交金额 ¥${Math.round(item.amount).toLocaleString("zh-CN")}，完成 ${item.count} 单"></button>`).join("")}</div>
          <div class="sales-trend-tooltip" aria-live="polite"></div>
          <div class="sales-trend-labels">${trend.current.map((item) => `<span>${item.label}</span>`).join("")}</div>
          <div class="sales-trend-legend"><span><i class="current"></i>近 6 个月</span><span><i class="previous"></i>前 6 个月</span></div>
        </div>
      </div>
    </section>
    <div class="sales-detail-grid">
      <section class="sales-dashboard-section">
        <div class="sales-section-heading"><h3>客户动态</h3><span>最近看稿与待确认记录</span></div>
        <div class="sales-list">${customerRows || salesDashboardEmpty("暂无客户看稿或选稿记录")}</div>
      </section>
      <section class="sales-dashboard-section">
        <div class="sales-section-heading"><h3>订单进度</h3><span>按预计交付时间排序</span></div>
        <div class="sales-list">${orderRows || salesDashboardEmpty("暂无正在处理的客户订单")}</div>
      </section>
    </div>`;
  const trendTooltip = shell.querySelector(".sales-trend-tooltip");
  shell.querySelectorAll("[data-sales-trend-point]").forEach((button) => {
    const index = Number(button.dataset.salesTrendPoint);
    const current = trend.current[index];
    const previous = trend.previous[index];
    const show = () => {
      trendTooltip.innerHTML = `<strong>${escapeHtml(current.label)}</strong><span><i class="current"></i>本期 ¥${Math.round(current.amount).toLocaleString("zh-CN")} · ${current.count} 单</span><span><i class="previous"></i>上期 ¥${Math.round(previous.amount).toLocaleString("zh-CN")} · ${previous.count} 单</span>`;
      trendTooltip.style.left = `${8 + index * 16.8}%`;
      trendTooltip.classList.add("active");
    };
    button.addEventListener("mouseenter", show);
    button.addEventListener("focus", show);
    button.addEventListener("mouseleave", () => trendTooltip.classList.remove("active"));
    button.addEventListener("blur", () => trendTooltip.classList.remove("active"));
  });
}


function memberOrderItems(member) {
  return studioOrders.filter((order) => {
    const sourceCards = (order.files || []).map(sourceCardByFile).filter(Boolean);
    if (member.role === "设计师") {
      return sourceCards.some((card) => card.dataset.workOwner === member.ownerKey || workOwnerName(card) === member.name);
    }
    return sourceCards.some((card) => fieldValue(card, "引用手绘").includes(member.name));
  });
}

function memberWorkItems(member) {
  return activeWorkCards().filter((card) => card.dataset.workOwner === member.ownerKey || workOwnerName(card) === member.name);
}

function teamMemberStats(member) {
  const works = memberWorkItems(member);
  const projects = memberProjectItems(member);
  const orders = memberOrderItems(member).filter((order) => !["已关闭", "已完成"].includes(orderProgressStatus(order)));
  const pending = works.filter(isReviewPending).length;
  const revision = works.filter((card) => cardStatusSummary(card).includes("需修改") || cardStatusSummary(card).includes("未修改")).length;
  const sleeping = works.filter(isSleepingWork).length;
  const sold = works.filter((card) => cardStatusSummary(card).includes("已出售") || cardStatusSummary(card).includes("出售")).length;
  const referenced = works.filter((card) => cardStatusSummary(card).includes("被引用") || !["暂无", "-", "无引用 / 原创设计"].includes(fieldValue(card, "引用设计"))).length;
  const loadScore = projects.length;
  return { works, projects, orders, pending, revision, sleeping, sold, referenced, loadScore };
}

function teamLoadLabel(score) {
  if (score > 5) return "高";
  if (score > 3) return "中";
  return "轻";
}

function teamLoadClass(score) {
  if (score > 5) return "hot";
  if (score > 3) return "medium";
  return "low";
}

function persistEmployeeAccount(member, patch = {}) {
  if (!member?.ownerKey) return null;
  const accounts = readRegisteredAccounts();
  const account = {
    ...(demoAccounts[member.ownerKey] || accounts[member.ownerKey] || {}),
    name: member.name,
    role: member.role,
    ownerKey: member.ownerKey,
    accountStatus: member.accountStatus || "正常",
    ...patch,
  };
  accounts[member.ownerKey] = account;
  writeRegisteredAccounts(accounts);
  demoAccounts[member.ownerKey] = account;
  return account;
}

function closeEmployeeAccountModal({ force = false } = {}) {
  if (employeeAccountSubmitting && !force) return;
  employeeAccountModal?.classList.remove("active");
  employeeAccountModal?.setAttribute("aria-hidden", "true");
  employeeAccountForm?.reset();
  editingEmployeeAccountKey = "";
  employeeAccountSubmit.dataset.results = "";
  employeeAccountModal?.removeAttribute("aria-busy");
  lockBodyScroll(false);
}

function employeeCloudErrorMessage(error, action = "保存") {
  const messages = {
    ACCOUNT_ALREADY_EXISTS: "该登录账号已存在，请更换一个账号。",
    PASSWORD_TOO_SHORT: "登录密码至少需要 8 位。",
    INVALID_USERNAME: "登录账号需为 3-24 位英文、数字、点、下划线或短横线。",
    INVALID_EMPLOYEE_ROLE: "请选择有效的员工岗位。",
    FORBIDDEN_ADMIN_ONLY: "当前账号没有管理员权限，请重新登录管理员账号。",
    AUTH_NOT_CONFIGURED: "云端认证服务尚未配置，请检查 Vercel 环境变量。",
  };
  return messages[error?.code] || `云端账号${action}失败，请稍后重试。`;
}

function setEmployeeAccountSubmitting(active) {
  employeeAccountSubmitting = active;
  if (employeeAccountSubmit) employeeAccountSubmit.disabled = active;
  if (employeeAccountCancel) employeeAccountCancel.disabled = active;
  if (employeeAccountClose) employeeAccountClose.disabled = active;
  employeeAccountModal?.toggleAttribute("aria-busy", active);
}

async function copyTextToClipboard(value, message = "已复制。") {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  showToast(message, "success");
}

const employeePinyinMap = Object.freeze({ 顾:"gu",言:"yan",沈:"shen",清:"qing",唐:"tang",梨:"li",陆:"lu",遥:"yao",简:"jian",宁:"ning",温:"wen",岚:"lan",乔:"qiao",安:"an",宋:"song",知:"zhi",白:"bai",榆:"yu",叶:"ye",澄:"cheng",江:"jiang",屿:"yu",南:"nan",栀:"zhi",夏:"xia",葵:"kui",程:"cheng",野:"ye",禾:"he",黎:"li",月:"yue",秦:"qin",墨:"mo",方:"fang",可:"ke",韩:"han",序:"xu",许:"xu",然:"ran",林:"lin",若:"ruo",孟:"meng",阿:"a",沁:"qin",周:"zhou",洛:"luo",川:"chuan",苏:"su",李:"li",王:"wang",张:"zhang",陈:"chen",刘:"liu",杨:"yang",黄:"huang",赵:"zhao",吴:"wu",徐:"xu",朱:"zhu",胡:"hu",郑:"zheng",谢:"xie" });
function employeeNamePinyin(name) { return [...String(name || "员工")].map((char) => employeePinyinMap[char] || (/[a-z0-9]/i.test(char) ? char : "")).join("").toLowerCase() || "employee"; }

function randomEmployeeCredentials(name = "员工") {
  const accounts = { ...readRegisteredAccounts(), ...demoAccounts };
  let username = "";
  do {
    username = `${employeeNamePinyin(name)}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  } while (accounts[username]);
  const password = `${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 100)}`;
  return { username, password };
}

function fillRandomEmployeeCredentials() {
  if (editingEmployeeAccountKey) return;
  const credentials = randomEmployeeCredentials(employeeAccountName?.value || "员工");
  employeeAccountUsername.value = credentials.username;
  employeeAccountPassword.value = credentials.password;
}

function addEmployeeBatchRow(name = "", role = "") {
  employeeBatchList?.insertAdjacentHTML("beforeend", `<div class="employee-batch-row">
    <input data-batch-name maxlength="30" value="${escapeHtml(name)}" placeholder="员工姓名" aria-label="员工姓名" />
    <select data-batch-role aria-label="岗位"><option value="">选择岗位</option>${["管理员", "设计师", "手绘师", "销售"].map((item) => `<option ${item === role ? "selected" : ""}>${item}</option>`).join("")}</select>
    <button class="employee-batch-remove" type="button" aria-label="删除这位员工">×</button>
  </div>`);
}

function setEmployeeCreateMode(mode) {
  employeeCreateMode = mode === "batch" ? "batch" : "single";
  employeeCreateModes?.querySelectorAll("[data-employee-mode]").forEach((button) => button.classList.toggle("active", button.dataset.employeeMode === employeeCreateMode));
  employeeSingleFields.hidden = employeeCreateMode !== "single";
  employeeBatchFields.hidden = employeeCreateMode !== "batch";
  if (employeeCreateMode === "batch" && !employeeBatchList.children.length) {
    addEmployeeBatchRow();
    addEmployeeBatchRow();
    addEmployeeBatchRow();
  }
}

function showEmployeeCredentialResults(items) {
  employeeCreateModes.hidden = true;
  employeeSingleFields.hidden = true;
  employeeBatchFields.hidden = true;
  employeeCredentialResults.hidden = false;
  employeeCredentialResults.innerHTML = `<h3>员工账号已设置</h3><table><thead><tr><th>姓名</th><th>岗位</th><th>账号</th><th>密码</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.role)}</td><td><code>${escapeHtml(item.username)}</code></td><td><span class="employee-credential-value"><code>${escapeHtml(item.password)}</code><button type="button" class="employee-copy-button" data-employee-copy="${escapeHtml(item.password)}" aria-label="复制 ${escapeHtml(item.name)} 的密码" title="复制密码">⧉</button></span></td></tr>`).join("")}</tbody></table>`;
  employeeAccountSubmit.textContent = "完成";
  employeeAccountSubmit.dataset.results = "true";
}

function openEmployeeAccountModal(member = null) {
  if (currentAccount.role !== "管理员" || !employeeAccountModal) return;
  editingEmployeeAccountKey = member?.ownerKey || "";
  employeeAccountForm?.reset();
  employeeAccountError.textContent = "";
  employeeAccountTitle.textContent = member ? "编辑员工账号" : "新建员工";
  employeeAccountSubmit.textContent = member ? "保存账号设置" : "设置账户";
  employeeAccountSubmit.dataset.results = "";
  employeeCredentialResults.hidden = true;
  employeeCredentialResults.innerHTML = "";
  employeeCreateModes.hidden = Boolean(member);
  employeeBatchList.innerHTML = "";
  employeeAccountName.value = member?.name || "";
  employeeAccountUsername.value = member?.ownerKey || "";
  employeeAccountUsername.readOnly = Boolean(member);
  employeeAccountJoinedAt.value = member ? employeeJoinedAt(member) : formatDateTime();
  employeeAccountRole.value = member?.role || "";
  employeeAccountPassword.required = !member;
  employeeAccountPassword.placeholder = member ? "留空则不修改密码" : "可自行设置或随机生成";
  employeeCredentialGenerate.hidden = Boolean(member);
  setEmployeeCreateMode("single");
  if (!member) fillRandomEmployeeCredentials();
  employeeAccountModal.classList.add("active");
  employeeAccountModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
  requestAnimationFrame(() => (member ? employeeAccountPassword : employeeAccountName)?.focus());
}

function employeeJoinedAt(member) {
  const account = readRegisteredAccounts()[member.ownerKey] || demoAccounts[member.ownerKey] || {};
  return member.joinedAt || account.createdAt || "未记录";
}

function openTeamMemberDetail(memberKey) {
  if (currentAccount.role !== "管理员") return;
  const member = teamMembers.find((item) => item.ownerKey === memberKey);
  if (!member) return;
  const account = readRegisteredAccounts()[member.ownerKey] || demoAccounts[member.ownerKey] || {};
  let overlay = document.querySelector("#teamMemberDetailModal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "teamMemberDetailModal";
    overlay.className = "team-member-detail-modal";
    overlay.innerHTML = `<button class="team-member-detail-backdrop" type="button" data-team-member-detail-close aria-label="关闭"></button><aside class="team-member-detail-drawer"><button class="modal-close" type="button" data-team-member-detail-close aria-label="关闭">×</button><div data-team-member-detail-body></div></aside>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (event) => {
      const copyButton = event.target.closest("[data-team-member-copy]");
      if (copyButton) {
        copyTextToClipboard(copyButton.dataset.teamMemberCopy, "密码已复制。");
        return;
      }
      const orderButton = event.target.closest("[data-team-member-performance-order]");
      if (orderButton) {
        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
        lockBodyScroll(false);
        focusOrderFromTeamPerformance(orderButton.dataset.teamMemberPerformanceOrder);
        return;
      }
      const editButton = event.target.closest("[data-team-member-edit]");
      if (editButton) {
        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
        lockBodyScroll(false);
        openEmployeeAccountModal(member);
        return;
      }
      if (event.target.closest("[data-team-member-detail-close]")) {
        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
        lockBodyScroll(false);
      }
    });
  }
  const password = String(account.password || "未记录");
  const performance = memberPerformance(member);
  const stats = teamMemberStats(member);
  const totalPeriod = performance.periods.find((period) => period.key === "total");
  overlay.querySelector("[data-team-member-detail-body]").innerHTML = `
    <div class="team-member-detail-topline"><p class="eyebrow">EMPLOYEE PROFILE</p><button type="button" class="team-member-edit-button" data-team-member-edit aria-label="编辑基本信息">编辑基本信息</button></div>
    <div class="team-member-profile-head"><span class="team-avatar ${escapeHtml(member.tone)}">${memberAvatarInner(member)}</span><div><h2>${escapeHtml(member.name)}</h2><p>${escapeHtml(member.role)} · ${escapeHtml(member.accountStatus || "正常")}</p></div></div>
    <dl class="team-member-profile-list">
      <div><dt>加入时间</dt><dd>${escapeHtml(employeeJoinedAt(member))}</dd></div>
      <div><dt>姓名</dt><dd>${escapeHtml(member.name)}</dd></div>
      <div><dt>登录账号</dt><dd><code>${escapeHtml(member.ownerKey)}</code></dd></div>
      <div><dt>登录密码</dt><dd><code>${escapeHtml(password)}</code>${password === "未记录" ? "" : `<button type="button" class="employee-copy-button" data-team-member-copy="${escapeHtml(password)}" aria-label="复制登录密码" title="复制密码">⧉</button>`}</dd></div>
      <div><dt>职位</dt><dd>${escapeHtml(member.role)}</dd></div>
    </dl>
    <section class="team-member-performance"><div class="team-member-section-title"><h3>作品产出</h3><span>${stats.projects.length} 个进行中项目</span></div><div class="team-member-performance-grid">${performance.periods.map((period) => `<div><span>${period.label}已售</span><strong>${period.works}<small>稿</small></strong><em>${period.orders} 笔订单</em></div>`).join("")}</div><h4>累计已售稿件</h4>${totalPeriod.entries.length ? `<div class="team-member-performance-list">${totalPeriod.entries.slice(0, 8).map(({ order, ownCount }) => `<button type="button" data-team-member-performance-order="${escapeHtml(order.id)}"><span><strong>${escapeHtml(order.id)}</strong><small>${escapeHtml(order.customer || "未设置客户")} · ${escapeHtml(order.paidAt || order.createdAt || order.time || "未记录时间")}</small></span><b>${ownCount} 稿</b></button>`).join("")}</div>` : `<p class="team-member-performance-empty">暂无已售稿件记录。</p>`}</section>`;
  overlay.classList.add("active");
  overlay.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function teamMemberRowHtml(member) {
  const stats = teamMemberStats(member);
  const loadClass = teamLoadClass(stats.loadScore);
  const accountStatus = member.accountStatus || "正常";
  const actions = teamManageMode
    ? `<div class="team-row-actions">
        <select data-team-role="${escapeHtml(member.ownerKey)}" aria-label="调整 ${escapeHtml(member.name)} 的岗位" ${member.ownerKey === currentAccount.ownerKey ? "disabled" : ""}>
          ${["管理员", "设计师", "手绘师", "销售"].map((role) => `<option ${member.role === role ? "selected" : ""}>${role}</option>`).join("")}
        </select>
        <button type="button" data-team-account-edit="${escapeHtml(member.ownerKey)}">重置密码</button>
        <button class="${accountStatus === "正常" ? "danger" : ""}" type="button" data-team-account-toggle="${escapeHtml(member.ownerKey)}" ${member.ownerKey === currentAccount.ownerKey ? "disabled" : ""}>${accountStatus === "正常" ? "停用" : "恢复"}</button>
        <button class="danger" type="button" data-team-remove="${escapeHtml(member.ownerKey)}" ${member.ownerKey === currentAccount.ownerKey ? "disabled" : ""}>删除</button>
      </div>`
    : `<button class="team-more" type="button" data-team-row-menu="${escapeHtml(member.ownerKey)}" aria-label="管理 ${escapeHtml(member.name)}">···</button>`;
  return `<tr>
    <td><button class="team-member-cell" type="button" data-team-member-detail="${escapeHtml(member.ownerKey)}"><span class="team-avatar ${escapeHtml(member.tone)}">${memberAvatarInner(member)}</span><strong>${escapeHtml(member.name)}</strong></button></td>
    <td>${escapeHtml(member.role)}</td>
    <td><span class="team-load ${loadClass}"><i></i>${escapeHtml(teamLoadLabel(stats.loadScore))}</span></td>
    <td><button class="team-project-count" type="button" data-team-projects="${escapeHtml(member.ownerKey)}" ${stats.projects.length ? "" : "disabled"}>${stats.projects.length}</button></td>
    <td><span class="team-account-status ${accountStatus === "正常" ? "active" : "disabled"}">${escapeHtml(accountStatus)}</span></td>
    <td>${actions}</td>
  </tr>`;
}

function renderTeamView() {
  if (!teamGrid || !teamMetrics) return;
  const roleFilter = teamRoleFilter?.value || "all";
  const statusFilter = teamStatusFilter?.value || "all";
  const query = teamSearch?.value.trim().toLowerCase() || "";
  const members = teamMembers.filter((member) => {
    const roleMatch = roleFilter === "all" || member.role === roleFilter;
    const statusMatch = statusFilter === "all" || (member.accountStatus || "正常") === statusFilter;
    const loadMatch = !teamHighLoadOnly || teamLoadClass(teamMemberStats(member).loadScore) === "hot";
    return roleMatch && statusMatch && loadMatch && (!query || searchMatches(query, [member.name, member.role, member.ownerKey]));
  });
  const allStats = teamMembers.map((member) => teamMemberStats(member));
  const highLoadMembers = teamMembers.filter((member, index) => teamLoadClass(allStats[index].loadScore) === "hot");
  const highLoadMarkup = highLoadMembers.length
    ? `<span class="team-high-members">${highLoadMembers.map((member) => `<i><b class="team-avatar ${escapeHtml(member.tone)}">${memberAvatarInner(member)}</b>${escapeHtml(member.name)}</i>`).join("")}</span>`
    : "暂无高负载成员";
  const roleComposition = [...new Set(teamMembers.map((item) => item.role).filter((role) => role !== "打样师"))]
    .map((role) => `${teamMembers.filter((item) => item.role === role).length} 位${role}`)
    .join(" · ");
  const paidTeamOrders = studioOrders.filter((order) => order.paymentStatus === "已支付");
  const teamSoldEvents = soldContributionEvents();
  const teamOutputRankingData = teamMembers
    .filter((member) => (member.accountStatus || "正常") === "正常")
    .map((member) => {
      const ownFiles = new Set(memberWorkItems(member).map((card) => card.dataset.file));
      const sold = teamSoldEvents.filter((event) => ownFiles.has(event.file)).length;
      return { member, sold };
    })
    .sort((a, b) => b.sold - a.sold || a.member.name.localeCompare(b.member.name, "zh-CN"));
  const outputLeader = teamOutputRankingData[0];
  teamMetrics.innerHTML = `
    <button class="team-overview-entry" type="button" data-team-overview="all"><span>团队成员</span><strong>${teamMembers.length}</strong><p>${escapeHtml(roleComposition || "暂无成员")}</p></button>
    <button class="team-overview-entry ${teamHighLoadOnly ? "active" : ""}" type="button" data-team-overview="hot"><span>当前高负载人员</span><strong>${highLoadMembers.length} 位</strong><p>${highLoadMarkup}</p></button>
    <button class="team-overview-entry team-ranking-entry" type="button" data-team-ranking-open><span>作品产出排行</span><strong>${outputLeader ? `${escapeHtml(outputLeader.member.name)} · ${outputLeader.sold} 稿` : "暂无数据"}</strong><p>${outputLeader ? "当前已售稿件最多 · 点击查看全部" : "点击查看全员排名"} →</p></button>
  `;
  if (teamOutputRanking) {
    const ranking = teamOutputRankingData;
    const maximumSold = Math.max(...ranking.map((item) => item.sold), 1);
    const pageSize = 14;
    const pageCount = Math.max(1, Math.ceil(ranking.length / pageSize));
    teamRankingPage = Math.min(Math.max(0, teamRankingPage), pageCount - 1);
    const pageStart = teamRankingPage * pageSize;
    const pageRanking = ranking.slice(pageStart, pageStart + pageSize);
    teamOutputRanking.innerHTML = `
      <button class="modal-close" type="button" data-team-ranking-close aria-label="关闭产出排行">×</button>
      <div class="panel-head"><div><h3>全员作品产出排行</h3><p>按已支付订单中的已售稿件数统计</p></div><span>${ranking.length} 位成员</span></div>
      <div class="team-output-ranking-list">${pageRanking.map((item, index) => `<button type="button" data-dashboard-performance="${escapeHtml(item.member.ownerKey)}"><b>${pageStart + index + 1}</b><span class="team-avatar ${escapeHtml(item.member.tone)}">${memberAvatarInner(item.member)}</span><span class="team-output-person"><strong>${escapeHtml(item.member.name)}</strong><small>${escapeHtml(item.member.role)}</small></span><i><u style="width:${item.sold ? Math.max(8, Math.round((item.sold / maximumSold) * 100)) : 0}%"></u></i><em>${item.sold} 稿</em></button>`).join("")}</div>`;
    if (teamOutputPagination) {
      teamOutputPagination.innerHTML = `
        <button type="button" data-team-ranking-page="${Math.max(0, teamRankingPage - 1)}" ${teamRankingPage === 0 ? "disabled" : ""} aria-label="上一页">←</button>
        <div>${Array.from({ length: pageCount }, (_, index) => `<button type="button" class="${index === teamRankingPage ? "active" : ""}" data-team-ranking-page="${index}" aria-label="第 ${index + 1} 页">${index + 1}</button>`).join("")}</div>
        <button type="button" data-team-ranking-page="${Math.min(pageCount - 1, teamRankingPage + 1)}" ${teamRankingPage === pageCount - 1 ? "disabled" : ""} aria-label="下一页">→</button>`;
    }
    teamOutputRanking.scrollTop = 0;
  }
  teamManageButton?.classList.toggle("active", teamManageMode);
  if (teamManageButton) teamManageButton.querySelector("span").textContent = teamManageMode ? "完成管理" : "管理";
  teamGrid.innerHTML = `<table class="team-table">
    <thead><tr><th>成员</th><th>角色</th><th>工作负载</th><th>负责项目</th><th>账号状态</th><th>操作</th></tr></thead>
    <tbody>${members.length ? members.map(teamMemberRowHtml).join("") : `<tr><td colspan="6" class="team-table-empty">没有符合条件的成员</td></tr>`}</tbody>
  </table>`;
}

function closeTeamQuickMenu() {
  document.querySelector("#teamQuickMenu")?.remove();
}

function openTeamQuickMenu(member, x, y) {
  closeTeamQuickMenu();
  const menu = document.createElement("div");
  menu.id = "teamQuickMenu";
  menu.className = "team-quick-menu";
  const statusAction = (member.accountStatus || "正常") === "正常" ? "停用员工" : "恢复员工";
  menu.innerHTML = `<strong>${escapeHtml(member.name)}</strong><button type="button" data-team-quick-action="reset">重置密码</button><button type="button" data-team-quick-action="role" data-team-quick-role="管理员">更换为管理员</button><button type="button" data-team-quick-action="role" data-team-quick-role="设计师">更换为设计师</button><button type="button" data-team-quick-action="role" data-team-quick-role="手绘师">更换为手绘师</button><button type="button" data-team-quick-action="role" data-team-quick-role="销售">更换为销售</button><button type="button" data-team-quick-action="toggle">${statusAction}</button><button type="button" class="danger" data-team-quick-action="delete">删除员工</button>`;
  document.body.appendChild(menu);
  const width = 190;
  menu.style.left = `${Math.min(x, window.innerWidth - width - 12)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - menu.offsetHeight - 12)}px`;
  menu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-team-quick-action]");
    if (!button) return;
    const action = button.dataset.teamQuickAction;
    if (action === "reset") {
      closeTeamQuickMenu();
      openEmployeeAccountModal(member);
      return;
    }
    if (action === "role") {
      member.role = button.dataset.teamQuickRole;
      persistEmployeeAccount(member, { role: member.role });
      saveStudioState();
      syncProjectMemberOptions();
      renderTeamView();
      closeTeamQuickMenu();
      showToast(`${member.name} 的职位已调整为${member.role}。`, "success");
      return;
    }
    if (action === "toggle") {
      closeTeamQuickMenu();
      if ((member.accountStatus || "正常") === "正常") {
        requestDeactivateTeamMember(member);
      } else {
        member.accountStatus = "正常";
        persistEmployeeAccount(member, { accountStatus: "正常" });
        saveStudioState();
        syncProjectMemberOptions();
        renderTeamView();
        showToast(`${member.name} 的账号已启用。`, "success");
      }
      return;
    }
    if (action === "delete") {
      closeTeamQuickMenu();
      const index = teamMembers.indexOf(member);
      if (index < 0) return;
      openExitConfirmation({
        title: `将「${member.name}」移出团队？`,
        message: "移出后，该成员将不再出现在团队成员库中。",
        submitText: "确认移出",
        onConfirm: () => {
          teamMembers.splice(index, 1);
          const accounts = readRegisteredAccounts();
          delete accounts[member.ownerKey];
          writeRegisteredAccounts(accounts);
          delete demoAccounts[member.ownerKey];
          saveStudioState();
          syncProjectMemberOptions();
          renderTeamView();
          showToast(`${member.name} 已移出团队。`, "success");
        },
      });
    }
  });
}




function toggleMemberSearchEmpty(results, show) {
  if (!results) return;
  let empty = results.querySelector(".member-search-empty");
  if (show && !empty) {
    empty = document.createElement("p");
    empty.className = "member-search-empty";
    empty.textContent = "找不到该结果";
    results.appendChild(empty);
  }
  empty?.classList.toggle("hidden", !show);
}


function leastLoadedReplacement(member) {
  return teamMembers
    .filter((candidate) => candidate.ownerKey !== member.ownerKey && candidate.role === member.role && (candidate.accountStatus || "正常") === "正常")
    .sort((a, b) => memberProjectItems(a).filter((project) => project.status !== "已关闭").length - memberProjectItems(b).filter((project) => project.status !== "已关闭").length || a.name.localeCompare(b.name, "zh-CN"))[0] || null;
}

function deactivateTeamMember(member) {
  const affected = [];
  const reassigned = [];
  const unfilled = [];
  customProjects.forEach((project) => {
    let designers = (project.designers || []).filter((name) => name !== member.name);
    let painters = (project.painters || []).filter((name) => name !== member.name);
    let owners = projectOwnerNames(project).filter((name) => name !== member.name);
    const wasDesigner = (project.designers || []).includes(member.name);
    const wasPainter = (project.painters || []).includes(member.name);
    const wasOwner = projectOwnerNames(project).includes(member.name);
    if (!wasDesigner && !wasPainter && !wasOwner) return;
    affected.push(project.name);
    const roles = [wasOwner ? "负责人" : "", wasDesigner ? "设计师" : "", wasPainter ? "手绘师" : ""].filter(Boolean);
    const replacement = leastLoadedReplacement(member);
    if (replacement) {
      if (wasDesigner && !designers.includes(replacement.name)) designers.push(replacement.name);
      if (wasPainter && !painters.includes(replacement.name)) painters.push(replacement.name);
      if (wasOwner && !owners.includes(replacement.name)) owners.push(replacement.name);
      reassigned.push(`${project.name}（${roles.join("、")}）→ ${replacement.name}`);
    } else {
      unfilled.push(`${project.name}（${roles.join("、")}）`);
    }
    project.designers = designers;
    project.painters = painters;
    project.owners = owners;
    project.owner = owners.join("、") || "未指定";
    project.members = [...new Set([...designers, ...painters, ...owners])].join("、");
    project.changeLogs = [{
      time: formatDateTime(),
      user: currentAccount.name || currentAccount.role,
      action: "停用成员调整",
      detail: replacement
        ? `${member.name} 已从${roles.join("、")}角色中移除，并自动调整为 ${replacement.name}。`
        : `${member.name} 已从${roles.join("、")}角色中移除，暂无可用的同职位替代人员。`,
    }, ...(project.changeLogs || [])];
  });
  member.accountStatus = "已停用";
  persistEmployeeAccount(member, { accountStatus: "已停用" });
  syncProjectLibrary();
  saveStudioState();
  syncProjectMemberOptions();
  renderCustomProjects();
  renderTeamView();
  const reassignmentText = reassigned.length ? `，${reassigned.length} 个项目角色已自动补位` : "";
  const unfilledText = unfilled.length ? `，${unfilled.length} 个项目仍需指定人员` : "";
  showToast(`${member.name} 已停用并从 ${affected.length} 个项目中移除${reassignmentText}${unfilledText}，请进入项目详情确认。`, "success");
}

function requestDeactivateTeamMember(member) {
  const projects = memberProjectItems(member).filter((project) => project.status !== "已关闭");
  const affectedRoles = projects.reduce((total, project) => total
    + Number(projectOwnerNames(project).includes(member.name))
    + Number((project.designers || []).includes(member.name))
    + Number((project.painters || []).includes(member.name)), 0);
  const replacement = affectedRoles ? leastLoadedReplacement(member) : null;
  const replacementText = affectedRoles
    ? replacement
      ? `涉及的 ${affectedRoles} 个负责人、设计师或手绘师角色将分别由同职位低负载成员自动补位。`
      : `目前没有可用的同职位替代人员，相关角色需要管理员重新指定。`
    : "";
  openExitConfirmation({
    title: `停用「${member.name}」？`,
    message: `${member.name} 当前关联 ${projects.length} 个进行中项目。停用后会从这些项目的人员角色中移除。${replacementText}`,
    submitText: "确认停用",
    onConfirm: () => deactivateTeamMember(member),
  });
}

function renderDashboardOverview(role = roleSelect.value) {
  if (role === "管理员") renderAdminDashboard();
  if (role === "设计师" || role === "手绘师") renderCreativeDashboard(role);
  if (role === "销售") renderSalesDashboard();
}

function updateRoleDashboard(role) {
  roleDashboards.forEach((dashboard) => {
    dashboard.classList.toggle("active", dashboard.dataset.roleDashboard === role);
  });

  if (activeViewId() === "dashboard") {
    renderDashboardOverview(role);
    pageTitle.textContent = roleDashboardTitles[role];
  }
}

let activeWorksMode = "library";
let deferredPreviewCleanupVersion = 0;
let worksFilterContext = "";
let activeWorksScope = new Set();
let hasActiveWorksScope = false;
let filteredWorksScope = new Set();
let hasAppliedWorksFilter = false;
let libraryManageMode = false;
const libraryManageSelection = new Set();
let libraryManageEligibleCount = 0;

function libraryManageEligibleCards() {
  return [...filteredWorksScope].filter((card) =>
    !isArchivedForCurrentWorks(card)
  );
}

function renderLibraryManageState() {
  const available = ["管理员", "设计师", "手绘师"].includes(currentAccount.role);
  libraryManageActions?.classList.toggle("hidden", !available);
  if (!available) {
    libraryManageMode = false;
    libraryManageSelection.clear();
  }
  worksBoard?.classList.toggle("library-manage-mode", available && libraryManageMode);
  [...(worksBoard?.querySelectorAll(".work-card") || [])].forEach((card) => {
    card.classList.toggle("library-manage-selected", libraryManageSelection.has(card.dataset.file));
  });
  const selectedCount = libraryManageSelection.size;
  if (libraryManageToggle) {
    libraryManageToggle.querySelector("span").textContent = libraryManageMode ? "完成管理" : "管理";
  }
  libraryManageSelectAll?.classList.toggle("hidden", !libraryManageMode);
  libraryManageDelete?.classList.toggle("hidden", !libraryManageMode);
  libraryManageSleep?.classList.toggle("hidden", !libraryManageMode || currentAccount.role === "手绘师");
  if (libraryManageSelectAll) {
    libraryManageSelectAll.textContent = libraryManageEligibleCount > 0 && selectedCount === libraryManageEligibleCount ? "取消全选" : "全选";
  }
  if (libraryManageDelete) libraryManageDelete.disabled = selectedCount === 0;
  if (libraryManageSleep) libraryManageSleep.disabled = selectedCount === 0;
}

function deferHiddenWorkPreviewCleanup(cards) {
  const version = ++deferredPreviewCleanupVersion;
  const pending = cards.filter(Boolean);
  if (!pending.length) return;
  const runChunk = (deadline) => {
    if (version !== deferredPreviewCleanupVersion) return;
    let processed = 0;
    while (pending.length && processed < 48 && (!deadline || deadline.timeRemaining() > 2)) {
      const card = pending.shift();
      if (card?.classList.contains("hidden")) suspendWorkCardPreview(card);
      processed += 1;
    }
    if (!pending.length) return;
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runChunk, { timeout: 180 });
    } else {
      window.setTimeout(() => runChunk(), 16);
    }
  };
  // 先让个人稿件首屏完成绘制，再开始处理上一视图留下的图片。
  window.setTimeout(() => {
    if (version !== deferredPreviewCleanupVersion) return;
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runChunk, { timeout: 180 });
    } else {
      runChunk();
    }
  }, 120);
}

function switchView(target) {
  const targetNav = [...navItems].find((item) => item.dataset.view === target);
  if (targetNav && !viewAllowedForRole(targetNav, currentAccount.role)) {
    showToast("当前账号没有访问该页面的权限。", "warning");
    return false;
  }
  navItems.forEach((navItem) => navItem.classList.toggle("active", navItem.dataset.view === target));
  const actualTarget = target === "adminWorks" ? "designer" : target;
  views.forEach((view) => view.classList.toggle("active", view.id === actualTarget));
  if (target === "designer" || target === "adminWorks") {
    activeWorksMode = target === "adminWorks" ? "personal" : "library";
    configureWorksView(roleSelect.value, currentAccount.ownerKey, activeWorksMode);
  }
  if (target === "sleep") {
    renderSleepList();
  }
  if (target === "recycle") {
    purgeExpiredRecycleBin();
    renderRecycleBin();
  }
  if (target === "review") {
    renderDailyReviewBoard();
  }
  if (target === "myOrders") {
    moShown = MO_PAGE_SIZE;
    renderMyOrders();
  }
  if (target === "projects") {
    renderProjectsView();
  }
  if (typeof updateSidebarBadges === "function") updateSidebarBadges();
  if (target === "library") {
    const selectionFlow = document.querySelector("#customerSelectionFlow");
    const isViewerLibrary = selectionFlow?.classList.contains("viewer-mode");
    if (isViewerLibrary) {
      document.querySelector("#customerCenter")?.classList.add("hidden");
      selectionFlow.classList.remove("hidden");
    } else {
      document.querySelector("#customerCenter")?.classList.remove("hidden");
      selectionFlow?.classList.add("hidden");
      renderCustomerCenter();
    }
    libraryGridRenderLimit = LIBRARY_GRID_BATCH;
    renderLibraryGrid();
  }
  if (target === "cart") {
    renderLibraryCart();
    renderCartPage();
  }
  if (target === "myLibrary") {
    renderMyPatternLibrary(true);
  }
  if (target === "orders") {
    renderOrderCenter();
  }
  if (target === "projects") {
    renderCustomProjects();
  }
  if (target === "team") {
    renderTeamView();
  }
  if (target === "resources") {
    renderResourceLibrary();
  }
  if (target === "dashboard") {
    renderDashboardOverview(roleSelect.value);
    pageTitle.textContent = roleDashboardTitles[roleSelect.value];
  } else if (target === "designer" || target === "adminWorks") {
    pageTitle.textContent = target === "adminWorks" || !["管理员", "销售"].includes(roleSelect.value) ? "我的稿件" : "作品库";
  } else {
    pageTitle.textContent = titleMap[target];
  }
  if (appShell && !appShell.classList.contains("locked")) {
    rememberLastView(target);
    updateBrowserRoute(target);
  }
}

function lastViewAccountKey(accountKey = "", account = currentAccount) {
  return accountKey || account?.ownerKey || account?.username || account?.role || "default";
}

function rememberLastView(target) {
  try {
    const state = JSON.parse(localStorage.getItem(LAST_VIEW_KEY) || "{}");
    state[lastViewAccountKey(localStorage.getItem(SESSION_KEY) || "", currentAccount)] = target;
    localStorage.setItem(LAST_VIEW_KEY, JSON.stringify(state));
  } catch {}
}

function rememberedLastView(accountKey, account) {
  try {
    const state = JSON.parse(localStorage.getItem(LAST_VIEW_KEY) || "{}");
    return state[lastViewAccountKey(accountKey, account)] || "";
  } catch {
    return "";
  }
}

function restorableViewForAccount(accountKey, account) {
  const fallback = account.role === "客户" ? "myLibrary" : "dashboard";
  const saved = rememberedLastView(accountKey, account);
  if (!saved) return fallback;
  const navItem = [...navItems].find((item) => item.dataset.view === saved);
  return navItem && viewAllowedForRole(navItem, account.role) ? saved : fallback;
}

function viewAllowedForRole(navItem, role) {
  if (!navItem?.dataset?.roles) {
    return false;
  }

  return navItem.dataset.roles.split(",").includes(role);
}

function configureRoleNavigation(role) {
  if (role === "管理员" && activeViewId() !== "designer") activeWorksMode = "library";
  navItems.forEach((navItem) => {
    navItem.classList.toggle("hidden", !viewAllowedForRole(navItem, role));
  });

  const designerNav = document.querySelector('[data-view="designer"]');
  const ordersNav = document.querySelector('[data-view="orders"]');
  const designerLabel = designerNav?.querySelector(".nav-label");
  const ordersLabel = ordersNav?.querySelector(".nav-label");
  if (designerLabel) designerLabel.textContent = ["管理员", "销售"].includes(role) ? "作品库" : "我的稿件";
  if (ordersLabel) ordersLabel.textContent = "订单中心";
  navItems.forEach((item) => {
    const label = item.querySelector(".nav-label")?.textContent || "";
    item.dataset.tooltip = label;
    item.title = label;
  });
  topCartButton?.classList.toggle("hidden", !["管理员", "销售"].includes(role));
  tagManagerButton?.classList.toggle("hidden", !canManageTags());
  quickCreateButton?.classList.toggle("hidden", role === "客户");
  const canStartReview = ["管理员", "销售"].includes(role);
  const topStartReview = document.querySelector("#topStartReview");
  topStartReview?.classList.toggle("hidden", !canStartReview);
  topStartReview?.toggleAttribute("hidden", !canStartReview);
  const quickUpload = quickCreateGrid?.querySelector('[data-quick-action="design"]');
  quickUpload?.classList.toggle("hidden", role === "销售");
  const quickUploadTitle = quickUpload?.querySelector("strong");
  if (quickUploadTitle) quickUploadTitle.textContent = role === "手绘师" ? "上传手绘稿" : "上传设计稿";
  const canUploadWork = ["管理员", "设计师", "手绘师"].includes(role);
  worksUploadButton?.classList.toggle("hidden", !canUploadWork);
  const worksUploadLabel = worksUploadButton?.querySelector("span");
  if (worksUploadLabel) worksUploadLabel.textContent = role === "手绘师" ? "上传手绘稿" : "上传设计稿";
  quickCreateGrid?.querySelector('[data-quick-action="project"]')?.classList.toggle("hidden", !canCreateProject());
  quickCreateGrid?.querySelectorAll('[data-quick-action="customer"], [data-quick-action="order"]')
    .forEach((button) => button.classList.toggle("hidden", !canCreateCustomerOrOrder()));
  document.querySelector("#pjNew")?.classList.toggle("hidden", !canCreateProject());
  document.querySelector("#pjOpenDrafts")?.classList.toggle("hidden", !canCreateProject());
  syncResourceLibraryPermissions();
  document.querySelector(".sleep-manage-actions")?.classList.toggle("hidden", ["销售", "手绘师"].includes(role));
  if (["销售", "手绘师"].includes(role)) {
    sleepManageMode = false;
    sleepManageSelection.clear();
  }
  document.querySelector("#openCustomerCreate")?.classList.toggle("hidden", !canCreateCustomerOrOrder());

  adminActions.forEach((action) => action.classList.toggle("hidden", role !== "管理员"));
  if (activeViewId() === "designer") {
    configureWorksView(role, currentAccount.ownerKey);
  }
  renderSleepList();

  const currentActiveNav = document.querySelector(".nav-item.active");
  if (!currentActiveNav || !viewAllowedForRole(currentActiveNav, role)) {
    switchView(role === "客户" ? "myLibrary" : "dashboard");
  }
}

function canStartCustomerReview() {
  return ["管理员", "销售"].includes(currentAccount?.role);
}

function configureWorksView(role, ownerKey, mode = activeWorksMode) {
  const isAdmin = role === "管理员";
  const isSharedLibrary = (isAdmin && mode !== "personal") || role === "销售";
  if (role === "销售") refreshSalesLibrarySharedState();
  const isPersonalWorks = !isSharedLibrary;
  const nextFilterContext = `${role}:${ownerKey}:${isSharedLibrary ? "library" : "personal"}`;
  if (worksFilterContext !== nextFilterContext) {
    worksFilterContext = nextFilterContext;
    libraryManageMode = false;
    libraryManageSelection.clear();
    libraryFilterConfig.forEach((row) => libraryFilterState[row.key].clear());
    renderLibraryFilterBar();
  }

  worksTitle.textContent = isSharedLibrary ? "作品库" : "我的稿件";
  worksTypeSegment?.classList.remove("hidden");
  renderWorksTypeSegment();

  // 作品库是管理入口；个人稿件对管理员、设计师和手绘师使用同一套界面。
  worksBoard?.classList.toggle("library-gallery", isSharedLibrary);
  worksBoard?.classList.toggle("personal-review-gallery", isPersonalWorks);
  worksBoard?.classList.toggle("sales-readonly-library", role === "销售");

  const nextScope = new Set([...workCards].filter((card) => {
    if (card.classList.contains("deleted") || isSleepingWork(card)) return false;
    if (isPersonalWorks && isCreatorRole(role)) {
      if (isPersonallyDeleted(card, ownerKey) || isPersonallySleeping(card, ownerKey)) return false;
    }
    if (isSharedLibrary && !isApprovedSharedWork(card)) return false;
    return !isPersonalWorks || personalWorkCardMatches(card, role, ownerKey);
  }));

  // 管理员在“作品库 / 我的稿件”之间切换时，只更新当前挂载的卡片和
  // 即将展示的个人卡片。停放区中的数百张节点不再逐张写 class。
  const mountedCards = [...(worksBoard?.querySelectorAll(".work-card") || [])];
  mountedCards.forEach((card) => card.classList.toggle("hidden", !nextScope.has(card)));
  [...workCards].forEach((card) => card.classList.toggle(
    "personal-archive-visible",
    isPersonalWorks && isCreatorRole(role) && card.dataset.workOwner === ownerKey && nextScope.has(card),
  ));
  activeWorksScope = nextScope;
  hasActiveWorksScope = true;
  // 管理员的两个稿件入口共享同一批缩略图缓存。切换时不再删除 src，
  // 否则每次返回作品库都会重新请求、解码首批图片并造成明显停顿。
  deferredPreviewCleanupVersion += 1;
  applyLibraryFilters({ renderBatch: false });
  sortWorkCards();
  renderLibraryManageState();
}

function personalWorkCardMatches(card, role, ownerKey) {
  if (card.dataset.workOwner !== ownerKey) return false;
  if (role === "设计师") return card.dataset.workRole === "设计师";
  if (role === "手绘师") return card.dataset.workRole === "手绘师";
  return true;
}

function personalReviewStatus(card) {
  if (isSleepingWork(card)) return { label: "休眠中", tone: "sleeping" };
  if (card.classList.contains("deleted") || card.dataset.deletedAt) return { label: "被删除", tone: "deleted" };
  if (isReviewPending(card)) return { label: "待评审", tone: "pending" };
  const action = reviewLogs(card)[0]?.action || card.dataset.reviewAction || "";
  const summary = cardStatusSummary(card);
  if (action === "修改" || summary.includes("需修改") || summary.includes("未修改")) {
    return { label: "需修改", tone: "revision" };
  }
  if (action === "休眠" || summary.includes("休眠")) return { label: "休眠中", tone: "sleeping" };
  if (action === "通过" || summary.includes("已通过")) {
    return { label: "已通过", tone: "approved" };
  }
  return { label: "已评审", tone: "reviewed" };
}

function syncPersonalReviewStatus(card) {
  const trigger = card?.querySelector(".preview-trigger");
  if (!trigger) return;
  let badge = trigger.querySelector(".personal-review-status");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "personal-review-status";
    trigger.appendChild(badge);
  }
  const status = personalReviewStatus(card);
  badge.className = `personal-review-status ${status.tone}`;
  badge.textContent = status.label;
}

function visibleWorkCards() {
  const inSleepView = activeViewId() === "sleep";
  const usesActiveScope = !inSleepView && hasActiveWorksScope;
  const sourceCards = usesActiveScope ? [...activeWorksScope] : [...workCards];
  return sourceCards.filter(
    (card) =>
      !card.classList.contains("deleted") &&
      !card.classList.contains("time-hidden") &&
      (!usesActiveScope || !hasAppliedWorksFilter || filteredWorksScope.has(card)) &&
      (inSleepView
        ? isSleepingWork(card) && cardBelongsToCurrentAccount(card)
        : (usesActiveScope || !card.classList.contains("hidden")) && !isSleepingWork(card))
  );
}

const WORK_RENDER_BATCH = 18;
let workRenderLimit = WORK_RENDER_BATCH;
let workGalleryOrder = [];
let visibleWorkGalleryOrder = [];
const workCardParking = document.createElement("div");
workCardParking.className = "work-card-parking";
workCardParking.hidden = true;
worksBoard?.insertAdjacentElement("afterend", workCardParking);
const galleryAutoLoadObserver = typeof IntersectionObserver === "function"
  ? new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        requestAnimationFrame(() => {
          if (entry.target.isConnected) entry.target.click();
        });
      });
    }, { rootMargin: "480px 0px" })
  : null;

function observeGalleryAutoLoad(root) {
  if (!root) return;
  root.querySelectorAll("[data-gallery-auto-load]:not([data-auto-load-observed])").forEach((sentinel) => {
    sentinel.dataset.autoLoadObserved = "true";
    if (galleryAutoLoadObserver) galleryAutoLoadObserver.observe(sentinel);
  });
}

function applyWorkGalleryBatch(reset = false) {
  if (!worksBoard) return;
  if (reset) workRenderLimit = WORK_RENDER_BATCH;
  worksBoard.querySelector("[data-work-load-more]")?.remove();
  worksBoard.querySelector(".works-empty-state")?.remove();
  const orderedCards = visibleWorkGalleryOrder;
  const mountedCards = orderedCards.slice(0, workRenderLimit);
  const mountedSet = new Set(mountedCards);

  // 非当前批次停放到不参与布局的容器，保留节点、事件和完整数据引用。
  [...worksBoard.querySelectorAll(".work-card")].forEach((card) => {
    if (!mountedSet.has(card)) workCardParking.appendChild(card);
  });
  mountedCards.forEach((card, index) => {
    card.classList.remove("hidden", "filtered-hidden", "gallery-batch-hidden");
    worksBoard.appendChild(card);
    if (activeWorksMode === "personal") syncPersonalReviewStatus(card);
    prepareWorkCardPreview(card, { eager: index < 4 });
  });
  if (!orderedCards.length) {
    worksBoard.insertAdjacentHTML(
      "beforeend",
      `<p class="empty-state works-empty-state">${activeWorksMode === "personal" ? "暂无个人稿件。" : "暂无符合条件的作品。"}</p>`
    );
  }
  if (orderedCards.length > workRenderLimit) {
    worksBoard.insertAdjacentHTML(
      "beforeend",
      `<button class="gallery-auto-load-sentinel" type="button" data-gallery-auto-load data-work-load-more tabindex="-1" aria-hidden="true"></button>`
    );
  }
  observeGalleryAutoLoad(worksBoard);
  renderLibraryManageState();
}

// 当前每日评审展示的稿件集合（当天 + 当前类型/状态筛选），用于预览翻页限定范围。
function currentReviewCards() {
  const dateItems = reviewItems()
    .filter((card) => card.dataset.workRole === activeReviewWorkType)
    .filter((card) => reviewDisplayDate(card) === activeReviewDate);
  return dateItems
    .filter((card) => activeReviewFilter === "all" || (activeReviewFilter === "pending" ? isReviewPending(card) : !isReviewPending(card)))
    .sort((a, b) => new Date(b.dataset.version) - new Date(a.dataset.version));
}

function activeLightboxCards() {
  return lightboxCardSet.length ? lightboxCardSet : visibleWorkCards();
}

function cardBelongsToCurrentAccount(card) {
  const adminGlobalContext = currentAccount.role === "管理员"
    && !(activeViewId() === "designer" && activeWorksMode === "personal");
  return adminGlobalContext || card.dataset.workOwner === currentAccount.ownerKey;
}

function anyOverlayOpen() {
  return (
    lightbox.classList.contains("active") ||
    reviewConfirmModal?.classList.contains("active") ||
    compareOverlay?.classList.contains("active") ||
    uploadModal.classList.contains("active") ||
    projectModal?.classList.contains("active") ||
    projectDetailModal?.classList.contains("active") ||
    projectFileViewer?.classList.contains("active") ||
    projectFileManager?.classList.contains("active") ||
    painterPickerModal?.classList.contains("active") ||
    employeeAccountModal?.classList.contains("active") ||
    document.querySelector("#teamMemberDetailModal")?.classList.contains("active") ||
    document.getElementById("orderDetailOverlay")?.classList.contains("open") ||
    document.getElementById("payOverlay")?.classList.contains("open") ||
    document.getElementById("custPatternViewer")?.classList.contains("open")
  );
}

function lockBodyScroll(lock) {
  if (lock) {
    document.body.style.overflow = "hidden";
  } else if (!anyOverlayOpen()) {
    document.body.style.overflow = "";
  }
}

let lightboxViewerContext = false;
let lightboxWorksLibraryContext = false;
const lightboxBackStack = [];
function openLightbox(card, { nested = false, worksLibrary = activeViewId() !== "review", viewerContext = null } = {}) {
  if (!nested) lightboxBackStack.length = 0;
  lightboxWorksLibraryContext = worksLibrary;
  if (activeViewId() !== "orders") activeOrderFileContext = null;
  const inferredViewerLibrary = document.querySelector("#viewerLibrary")?.classList.contains("active") || activeViewId() === "myLibrary";
  const inViewerLibrary = viewerContext === false ? false : inferredViewerLibrary;
  lightboxViewerContext = viewerContext === null
    ? inferredViewerLibrary || currentAccount.role === "客户"
    : Boolean(viewerContext);
  let cards;
  if (inViewerLibrary) {
    // 客户花型库：点开只看这个花型自己的配色，箭头不翻到别的花型或参考图。
    cards = card ? [card] : approvedLibraryCards();
  } else if (activeViewId() === "review") {
    // 评审：只在当天展示的稿件之间翻页。
    cards = currentReviewCards();
  } else {
    // 项目稿件、作品库和我的稿件都只预览当前作品的图片与配色。
    cards = card ? [card] : visibleWorkCards().slice(0, 1);
  }
  if (card && !cards.includes(card)) {
    cards = [card];
  }
  if (!cards.length) return;
  lightboxCardSet = cards;
  activePreviewIndex = Math.max(0, cards.indexOf(card));
  activeVariant = 1;
  activeMediaKind = "image";
  activeWorkImageIndex = 0;
  previewZoom = 1;
  previewOffsetX = 0;
  previewOffsetY = 0;
  renderLightbox();
  lightbox.classList.add("active");
  lightbox.classList.remove("info-hidden");
  // 客户花型库：预览只保留大图和配色，隐藏内部信息面板。
  lightbox.classList.toggle("viewer-clean", lightboxViewerContext);
  lightbox.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function fieldValue(card, label) {
  const rows = [...card.querySelectorAll("dl div")];
  const row = rows.find((item) => item.querySelector("dt")?.textContent.trim() === label);
  return row?.querySelector("dd")?.textContent.trim() || "-";
}

function badgeValue(card, prefix) {
  const badge = [...card.querySelectorAll(".status-row .sale-badge")].find((item) =>
    item.textContent.trim().startsWith(prefix)
  );
  return badge?.textContent.replace(prefix, "").trim() || "-";
}

function setBadgeText(card, prefix, value, className) {
  const badge = [...card.querySelectorAll(".status-row .sale-badge")].find((item) =>
    item.textContent.trim().startsWith(prefix)
  );
  if (!badge) return;
  badge.textContent = `${prefix}${value}`;
  badge.className = className || `sale-badge ${statusBadgeClass(value)}`;
}

function workOwnerName(card) {
  const ownerKey = card?.dataset?.workOwner || "";
  const teamName = teamMembers.find((member) => member.ownerKey === ownerKey)?.name;
  if (teamName) return teamName;
  if (ownerKey && currentAccount?.ownerKey === ownerKey) return currentAccount.name || currentAccount.username || ownerKey;
  const legacyOwnerNames = RELEASE_CONFIG.seedDemoData === false ? {} : {
    linruo: "林若",
    mengxia: "孟夏",
    painter: "阿沁",
    zhouhe: "周禾",
    luochuan: "洛川",
    suye: "苏叶",
    sampler: "陈一",
  };
  return legacyOwnerNames[ownerKey] || ownerKey || "-";
}

function workRoleName(card) {
  const accountRole = teamMembers.find((member) => member.ownerKey === card?.dataset.workOwner)?.role;
  if (["设计师", "手绘师"].includes(accountRole)) return accountRole;
  return ["设计师", "手绘师"].includes(card?.dataset.workRole) ? card.dataset.workRole : "设计师";
}

function painterWorkCatalog() {
  return [...workCards]
    .filter((card) => card.dataset.workRole === "手绘师" && isApprovedSharedWork(card))
    .map((card) => {
      const trigger = card.querySelector(".preview-trigger");
      const pattern = [...(trigger?.classList || [])].find((className) => /^pattern-/.test(className)) || "";
      return {
        file: card.dataset.file,
        painter: workOwnerName(card),
        title: card.querySelector(".work-head > strong")?.textContent.trim() || card.dataset.file,
        project: card.querySelector(".work-body > p")?.textContent.replace(/^项目：/, "").trim() || "未关联项目",
        tags: String(card.dataset.tags || "").split(",").filter(Boolean),
        pattern,
        imageData: card.dataset.imageData || trigger?.querySelector("img[data-work-preview]")?.src || "",
        imageKey: card.dataset.imageKey || "",
        reviewStatus: workDisplayStatus(card),
        createdAt: card.dataset.createdAt || card.dataset.version || "",
      };
    })
    .sort((a, b) => a.file.localeCompare(b.file, "zh-CN"));
}

function workOwnerKeyByName(name) {
  const member = teamMembers.find((item) => item.name === name);
  if (member?.ownerKey) return member.ownerKey;
  const legacyOwnerKeys = RELEASE_CONFIG.seedDemoData === false ? {} : {
    林若: "linruo",
    孟夏: "mengxia",
    阿沁: "painter",
    周禾: "zhouhe",
    洛川: "luochuan",
    苏叶: "suye",
    陈一: "sampler",
  };
  return legacyOwnerKeys[name] || "";
}

function cardTagsText(card) {
  if (!card) return "未设置";
  return (card.dataset.tags || "").split(",").filter(Boolean).join("、") || "未设置";
}

function renderLightboxTagDisplay(card) {
  const tags = (card?.dataset.tags || "").split(",").filter(Boolean).slice(0, 6);
  const canRemove = canEditWorkMetadata(card) && !lightboxViewerContext;
  const tagMarkup = tags.length
    ? tags.map((tag) => `<span class="lightbox-tag-display-chip">${escapeHtml(tag)}${
        canRemove
          ? `<button class="lightbox-tag-remove" data-lightbox-tag-remove="${escapeHtml(tag)}" type="button" aria-label="删除标签 ${escapeHtml(tag)}" title="删除标签">×</button>`
          : ""
      }</span>`).join("")
    : canRemove ? "" : `<span class="lightbox-tag-display-chip">未设置标签</span>`;
  const addMarkup = canRemove && tags.length < 6
    ? `<button class="lightbox-tag-add" data-lightbox-tag-add type="button" aria-label="添加标签"><b aria-hidden="true">＋</b><span>添加标签</span></button>`
    : "";
  lightboxTags.innerHTML = tagMarkup + addMarkup;
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

const PINYIN_CHAR_MAP = {
  管:"guan",理:"li",员:"yuan",总:"zong",控:"kong",台:"tai",每:"mei",日:"ri",稿:"gao",件:"jian",评:"ping",审:"shen",
  项:"xiang",目:"mu",进:"jin",度:"du",我:"wo",的:"de",团:"tuan",队:"dui",作:"zuo",品:"pin",客:"ke",户:"hu",
  选:"xuan",车:"che",订:"ding",单:"dan",中:"zhong",心:"xin",手:"shou",绘:"hui",师:"shi",设:"she",计:"ji",打:"da",
  样:"yang",休:"xiu",眠:"mian",区:"qu",回:"hui",收:"shou",站:"zhan",许:"xu",然:"ran",林:"lin",若:"ruo",孟:"meng",
  夏:"xia",阿:"a",沁:"qin",周:"zhou",禾:"he",洛:"luo",川:"chuan",苏:"su",叶:"ye",陈:"chen",一:"yi",春:"chun",
  秋:"qiu",冬:"dong",清:"qing",透:"tou",花:"hua",卉:"hui",四:"si",套:"tao",系:"xi",列:"lie",南:"nan",通:"tong",晨:"chen",光:"guang",
  家:"jia",纺:"fang",杭:"hang",州:"zhou",渠:"qu",道:"dao",暖:"nuan",调:"tiao",植:"zhi",物:"wu",图:"tu",案:"an",
  开:"kai",发:"fa",内:"nei",部:"bu",定:"ding",制:"zhi",概:"gai",念:"nian",方:"fang",修:"xiu",改:"gai",完:"wan",
  善:"shan",确:"que",认:"ren",需:"xu",求:"qiu",负:"fu",责:"ze",人:"ren",状:"zhuang",态:"tai",待:"dai",已:"yi",
  喜:"xi",寐:"mei",鑫:"xin",兔:"tu",瑞:"rui",爱:"ai",福:"fu",天:"tian",丝:"si",棉:"mian",欧:"ou",阳:"yang",
  小:"xiao",芳:"fang",段:"duan",雨:"yu",刁:"diao",建:"jian",鹏:"peng",潘:"pan",玲:"ling",谢:"xie",文:"wen",
  洁:"jie",张:"zhang",桂:"gui",娟:"juan",贾:"jia",云:"yun",帆:"fan",悦:"yue",王:"wang",婷:"ting",肖:"xiao",
  晗:"han",顾:"gu",玮:"wei",璐:"lu",
  售:"shou",新:"xin",增:"zeng",删:"shan",除:"chu",搜:"sou",索:"suo",编:"bian",号:"hao",蓝:"lan",白:"bai",低:"di",
  饱:"bao",和:"he",抱:"bao",枕:"zhen",参:"can",考:"kao",素:"su",材:"cai",原:"yuan",创:"chuang",未:"wei",关:"guan",
  联:"lian",高:"gao",轻:"qing",法:"fa",式:"shi",复:"fu",古:"gu",极:"ji",简:"jian",儿:"er",童:"tong",动:"dong",
  几:"ji",何:"he",水:"shui",彩:"cai",线:"xian",数:"shu",码:"ma",拼:"pin",贴:"tie",窗:"chuang",帘:"lian",墙:"qiang",
  布:"bu",库:"ku",上:"shang",传:"chuan",者:"zhe",时:"shi",间:"jian",配:"pei",色:"se",版:"ban",本:"ben"
};

function searchForms(value) {
  const raw = normalizeSearch(value);
  let fullPinyin = "";
  let initials = "";
  for (const char of raw) {
    const syllable = PINYIN_CHAR_MAP[char];
    if (syllable) {
      fullPinyin += syllable;
      initials += syllable[0];
    } else {
      fullPinyin += char;
      if (/^[a-z0-9]$/.test(char)) initials += char;
    }
  }
  return [raw, fullPinyin, initials];
}

function searchMatches(query, values) {
  const key = normalizeSearch(query);
  if (!key) return true;
  const latinQuery = /^[a-z0-9]+$/.test(key);
  return values.some((value) => searchForms(value).some((form) => {
    if (form === normalizeSearch(value)) return form.includes(key);
    return latinQuery ? form.startsWith(key) : form.includes(key);
  }));
}

function currentUserProjectRelated(project) {
  if (isAdministrator()) return true;
  const mine = [currentAccount.ownerKey, currentAccount.name].filter(Boolean);
  const people = [
    project?.owner,
    ...(Array.isArray(project?.owners) ? project.owners : []),
    ...(Array.isArray(project?.members) ? project.members : String(project?.members || "").split(/[、,，]/)),
    ...(project?.designers || []),
    ...(project?.painters || []),
    ...(project?.sales || []),
  ].filter(Boolean);
  return people.some((person) => mine.includes(person));
}

function currentUserSearchCanAccessWork(card) {
  if (["管理员", "销售"].includes(currentAccount.role)) return true;
  if (card.dataset.workOwner === currentAccount.ownerKey) return true;
  return currentUserProjectRelated(pjById(card.dataset.projectId || ""));
}

function currentUserSearchCanAccessOrder(order) {
  return ["管理员", "销售"].includes(currentAccount.role);
}


function buildGlobalSearchMatches(query) {
  const key = normalizeSearch(query);
  if (!key) return [];
  if (currentAccount.role === "客户") {
    const company = currentAccount.company || currentAccount.name || "";
    const delivered = new Set(customerDeliveredFiles(company));
    const locked = customerLockedFiles(company);
    return [...new Set([...delivered, ...locked.keys()])].map((file) => {
      const card = sourceCardByFile(file);
      const name = card?.querySelector(".work-head strong")?.textContent.trim() || file;
      return {
        type: "client-work",
        title: name,
        meta: locked.has(file) ? `${file} · 已购买，等待交付` : `${file} · 我的花型库`,
        file,
        locked: locked.has(file),
      };
    }).filter((item) => searchMatches(key, [
      item.title,
      item.file,
      cardTagsText(sourceCardByFile(item.file)),
    ])).slice(0, 12);
  }
  const matches = [];
  if (["管理员", "销售"].includes(currentAccount.role)) {
    if (!customerCenterClients.length) customerCenterClients = buildCustomerCenter();
    customerCenterClients.forEach((customer) => {
      const values = [customer.name, customer.display, customer.contact, customer.region, customer.type];
      if (!searchMatches(key, values)) return;
      matches.push({
        type: "customer",
        title: customer.name,
        meta: `客户 · ${customer.contact || "未设置联系人"}`,
        customer,
      });
    });
  }
  [...workCards].forEach((card) => {
    if (card.classList.contains("deleted") || !currentUserSearchCanAccessWork(card)) return;
    const project = workProjectName(card);
    const linkedPainter = fieldValue(card, "引用手绘");
    const linkedDesign = fieldValue(card, "引用设计");
    const workTitle = card.querySelector(".work-head strong")?.textContent.trim()
      || card.querySelector(".file-name")?.textContent.trim()
      || card.dataset.file;
    const values = [
      workTitle,
      card.dataset.file,
      project,
      workOwnerName(card),
      linkedPainter,
      linkedDesign,
      cardTagsText(card),
      fieldValue(card, "客户状态"),
      fieldValue(card, "审核状态"),
      card.dataset.workRole,
    ];
    if (!searchMatches(key, values)) return;
    matches.push({
      type: "work",
      title: workTitle,
      meta: `${card.dataset.workRole || "稿件"} · ${workOwnerName(card)} · ${project}`,
      card,
    });
  });

  customProjects.forEach((project) => {
    if (!currentUserProjectRelated(project)) return;
    const values = [
      project.name,
      project.owner,
      project.members,
      ...(project.designers || []),
      ...(project.painters || []),
      project.status,
    ];
    if (!searchMatches(key, values)) return;
    matches.push({
      type: "custom-project",
      title: project.name,
      meta: `项目 · 负责人 ${project.owner || "待分配"}`,
      project,
    });
  });

  projectLibrary.forEach((project) => {
    if (!currentUserProjectRelated(project)) return;
    if (customProjects.some((item) => item.name === project.name)) return;
    if (!searchMatches(key, [project.name, project.status, project.members])) return;
    matches.push({
      type: "project",
      title: project.name,
      meta: `项目 · ${project.status || "未设置"} · ${project.members || "待分配"}`,
      project,
    });
  });

  studioOrders.forEach((order) => {
    if (!currentUserSearchCanAccessOrder(order)) return;
    const values = [
      order.id,
      order.customer,
      order.viewer,
      order.status,
      order.progress,
      ...(order.files || []),
      ...(order.designers || []),
      ...(order.painters || []),
      ...(order.tags || []),
    ];
    if (!searchMatches(key, values)) return;
    matches.push({
      type: "order",
      title: order.id,
      meta: `订单 · ${orderProgressStatus(order)}`,
      order,
    });
  });

  const typePriority = { work: 0, order: 1, customer: 2, "custom-project": 3, project: 4 };
  const matchRank = (item) => {
    const title = normalizeSearch(item.title);
    if (title === key) return 0;
    if (title.startsWith(key)) return 1;
    return 2;
  };
  const ordered = matches.sort((a, b) =>
    matchRank(a) - matchRank(b)
    || (typePriority[a.type] ?? 9) - (typePriority[b.type] ?? 9)
    || String(a.title || "").localeCompare(String(b.title || ""), "zh-CN")
  );
  const selected = [];
  const perType = new Map();
  ordered.forEach((item) => {
    const count = perType.get(item.type) || 0;
    if (count >= 3 || selected.length >= 12) return;
    selected.push(item);
    perType.set(item.type, count + 1);
  });
  ordered.forEach((item) => {
    if (selected.length >= 12 || selected.includes(item)) return;
    selected.push(item);
  });
  return selected;
}

function renderGlobalSearchResults() {
  if (!globalSearchResults || !globalSearchInput) return;
  const query = globalSearchInput.value.trim();
  globalSearchMatches = buildGlobalSearchMatches(query);
  if (!query) {
    globalSearchResults.classList.add("hidden");
    globalSearchResults.innerHTML = "";
    return;
  }
  globalSearchResults.classList.remove("hidden");
  globalSearchResults.innerHTML = globalSearchMatches.length
    ? globalSearchMatches
        .map((item, index) => `<button class="global-search-result" type="button" data-global-result="${index}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.meta)}</span>
        </button>`)
        .join("")
    : `<button class="global-search-result" type="button" disabled><strong>没有找到匹配内容</strong><span>可以尝试中文、完整拼音、拼音首字母或编号。</span></button>`;
}

function hideGlobalSearchResults() {
  globalSearchResults?.classList.add("hidden");
}

function openGlobalSearchResult(index) {
  const item = globalSearchMatches[index];
  if (!item) return;
  hideGlobalSearchResults();
  if (globalSearchInput) globalSearchInput.value = "";
  if (item.type === "client-work") {
    switchView("myLibrary");
    if (item.locked) {
      showToast("这款花型已购买，等待交付后解锁预览。", "warning");
    } else {
      openCustomerPatternViewer(item.file);
    }
    return;
  }
  if (item.type === "work") {
    switchView("designer");
    openLightbox(item.card);
    return;
  }
  if (item.type === "customer") {
    switchView("library");
    activeCustomerCenterId = item.customer.id;
    activeCustomerTab = "overview";
    renderCustomerCenter();
    openCustomerDrawer();
    return;
  }
  if (item.type === "custom-project") {
    switchView("projects");
    openProjectDetail(item.project.id);
    return;
  }
  if (item.type === "project") {
    switchView("projects");
    showToast(`已定位到项目：${item.project.name}`, "success");
    return;
  }
  if (item.type === "order") {
    switchView("orders");
    if (orderSearch) {
      orderSearch.value = item.order.id;
      renderOrderCenter();
    }
    return;
  }
}

function daysUntil(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function isAdministrator() {
  return currentAccount.role === "管理员";
}

function canCreateProject() {
  return isAdministrator();
}

function canManageTags() {
  return isAdministrator();
}

function canCreateCustomerOrOrder() {
  return ["管理员", "销售"].includes(currentAccount.role);
}

function recordActivityNotification({ type, title, text, relatedOwners = [], adminOnly = true }) {
  const actor = currentAccount.name || currentAccount.ownerKey || currentAccount.role || "成员";
  activityNotifications.unshift({
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    text,
    actor,
    relatedOwners: [...new Set(relatedOwners.filter(Boolean))],
    adminOnly,
    time: formatDateTime(),
  });
  if (activityNotifications.length > 80) activityNotifications.length = 80;
  saveStudioState();
}

function activityIsVisibleToCurrentUser(item) {
  if (isAdministrator()) return true;
  if (item.adminOnly) return false;
  const mine = [currentAccount.ownerKey, currentAccount.name].filter(Boolean);
  return (item.relatedOwners || []).some((owner) => mine.includes(owner));
}

function notificationItems() {
  const nearDeadlineProjects = [...pjProjects, ...customProjects].filter((project, index, list) => {
    if (list.findIndex((item) => (item.id || item.name) === (project.id || project.name)) !== index) return false;
    const days = daysUntil(project.deadline || project.endAt);
    return !project.archived && !project.projectResult && !project.completed && days >= 0 && days <= 7;
  }).length;
  const pendingOrders = studioOrders.filter((order) => {
    const days = daysUntil(order.deliveryAt);
    return orderProgressStatus(order) !== "已完成" && orderProgressStatus(order) !== "已关闭" && days >= 0 && days <= 7;
  }).length;
  const myRevisionWorks = [...workCards].filter((card) =>
    !card.classList.contains("deleted")
    && fieldValue(card, "审核状态").includes("需修改")
    && cardBelongsToCurrentAccount(card)
  ).length;
  const activity = activityNotifications
    .filter(activityIsVisibleToCurrentUser)
    .slice(0, 12)
    .map((item) => ({
      key: item.id,
      title: item.title,
      text: `${item.text} · ${item.time}`,
    }));
  const managerDeadlineItems = isAdministrator() ? [
    { key: "project-deadline", count: nearDeadlineProjects, title: "项目临近截止", text: `${nearDeadlineProjects} 个项目将在 7 天内到达截止日期。` },
    { key: "order-deadline", count: pendingOrders, title: "订单临近截止", text: `${pendingOrders} 个订单将在 7 天内到达预计交付日。` },
  ] : [];
  const personalItems = isAdministrator() ? [] : [
    { key: "work-revision", count: myRevisionWorks, title: "作品需修改", text: `${myRevisionWorks} 张与你相关的作品被打回，请修改后重新提交。` },
  ];
  return [
    ...activity,
    ...managerDeadlineItems,
    ...personalItems,
  ].filter((item) => item.count == null || item.count > 0);
}

function renderNotifications() {
  if (!notificationList) return;
  const items = notificationItems().filter((item) => !dismissedNotifications.has(item.key));
  const visibleItems = notificationsExpanded ? items : items.slice(0, 3);
  const indicator = notificationButton?.querySelector("i");
  indicator?.classList.toggle("hidden", !items.length);
  notificationList.innerHTML = visibleItems.length ? visibleItems
    .map((item) => `<article class="notice-row">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.text)}</p>
      <button type="button" data-dismiss-notification="${item.key}" aria-label="删除 ${escapeHtml(item.title)}">×</button>
    </article>`)
    .join("") : `<p class="top-popover-empty">暂无新通知。</p>`;
  notificationMore?.classList.toggle("hidden", items.length <= 3);
  if (notificationMore) notificationMore.textContent = notificationsExpanded ? "收起通知" : `展开其余 ${items.length - 3} 条通知`;
  const clearButton = document.querySelector("#notificationClear");
  clearButton?.classList.toggle("hidden", !items.length);
}

function closeTopPopovers(except = null) {
  [notificationModal, quickCreateModal, cartPreviewPopover].forEach((popover) => {
    if (!popover || popover === except) return;
    popover.classList.remove("active");
    popover.setAttribute("aria-hidden", "true");
  });
}

function openNotificationModal() {
  notificationsExpanded = false;
  renderNotifications();
  const shouldOpen = !notificationModal?.classList.contains("active");
  closeTopPopovers(notificationModal);
  notificationModal?.classList.toggle("active", shouldOpen);
  notificationModal?.setAttribute("aria-hidden", String(!shouldOpen));
}

function closeNotificationModal() {
  notificationModal?.classList.remove("active");
  notificationModal?.setAttribute("aria-hidden", "true");
}

function openQuickCreateModal() {
  const shouldOpen = !quickCreateModal?.classList.contains("active");
  closeTopPopovers(quickCreateModal);
  quickCreateModal?.classList.toggle("active", shouldOpen);
  quickCreateModal?.setAttribute("aria-hidden", String(!shouldOpen));
}

function closeQuickCreateModal() {
  quickCreateModal?.classList.remove("active");
  quickCreateModal?.setAttribute("aria-hidden", "true");
}

function allManagedTags() {
  return [...new Set(Object.values(managedTagCategories).flat())];
}

function syncManagedTagInterfaces() {
  Object.keys(libraryFilterState || {}).forEach((key) => {
    const allowed = new Set(managedTagCategories[key] || []);
    [...libraryFilterState[key]].forEach((value) => {
      if (!allowed.has(value)) libraryFilterState[key].delete(value);
    });
  });
  renderLibraryFilterBar();
  if (typeof renderUploadTags === "function") renderUploadTags();
  const lightboxCard = lightbox?.classList.contains("active") ? activeLightboxCards()[activePreviewIndex] : null;
  if (lightboxCard && typeof renderLightboxTagPicker === "function") renderLightboxTagPicker(lightboxCard);
}

function replaceManagedTagOnWorks(oldTag, newTag = "") {
  workCards.forEach((card) => {
    const tags = (card.dataset.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!tags.includes(oldTag)) return;
    card.dataset.tags = [...new Set(tags.flatMap((tag) => tag === oldTag ? (newTag ? [newTag] : []) : [tag]))].join(",");
    markWorkRecordDirty(card);
  });
}

function renderTagManager() {
  if (!tagManagerBody) return;
  tagManagerBody.innerHTML = `
    <div class="tag-manager-create-category">
      <div><strong>分类层级</strong><span>先建立大分类，再展开维护下面的小标签</span></div>
      <div>
        <input type="text" data-tag-category-new placeholder="输入新的大分类名称" maxlength="20" />
        <button type="button" data-tag-category-add>新增大分类</button>
      </div>
    </div>
    <div class="tag-manager-accordion">${libraryFilterConfig.map((category) => {
      const expanded = expandedTagCategories.has(category.key);
      return `
    <section class="tag-manager-group ${expanded ? "expanded" : ""}" data-tag-category="${category.key}">
      <div class="tag-manager-group-head">
        <button class="tag-manager-toggle" type="button" data-tag-category-toggle aria-expanded="${expanded}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"></path></svg>
          <strong>${escapeHtml(category.label)}</strong>
          <span>${category.options.length} 个标签</span>
        </button>
        <div class="tag-manager-category-actions">
          <button type="button" data-tag-category-edit title="修改大分类名称">改名</button>
          <button type="button" data-tag-category-delete title="删除大分类">删除</button>
        </div>
      </div>
      <div class="tag-manager-panel">
        <div class="tag-manager-items">
          ${category.options.map((tag) => `<div class="tag-manager-item">
            <input type="text" value="${escapeHtml(tag)}" data-tag-rename="${escapeHtml(tag)}" aria-label="修改标签 ${escapeHtml(tag)}" />
            <button type="button" data-tag-delete="${escapeHtml(tag)}" aria-label="删除标签 ${escapeHtml(tag)}">×</button>
          </div>`).join("") || `<p class="tag-manager-empty">这个分类还没有小标签。</p>`}
        </div>
        <div class="tag-manager-add">
          <input type="text" data-tag-new placeholder="输入新的${escapeHtml(category.label)}标签" maxlength="20" />
          <button type="button" data-tag-add>添加标签</button>
        </div>
      </div>
    </section>`;
    }).join("")}</div>`;
}

function openTagManager() {
  if (!canManageTags()) {
    showToast("标签管理仅管理员可用。", "warning");
    return;
  }
  renderTagManager();
  tagManagerModal?.classList.add("active");
  tagManagerModal?.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeTagManager() {
  tagManagerModal?.classList.remove("active");
  tagManagerModal?.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

function addManagedTag(categoryKey, value) {
  const tag = String(value || "").trim();
  const options = managedTagCategories[categoryKey];
  if (!tag || !options) return;
  if (options.includes(tag)) {
    showToast("这个分类中已经有同名标签。", "warning");
    return;
  }
  options.push(tag);
  if (!globalTags.includes(tag)) globalTags.push(tag);
  saveStudioState();
  syncManagedTagInterfaces();
  renderTagManager();
  showToast(`已添加标签“${tag}”。`, "success");
}

function addManagedTagCategory(value) {
  const label = String(value || "").trim();
  if (!label) return;
  if (libraryFilterConfig.some((item) => item.label === label)) {
    showToast("已经有同名的大分类。", "warning");
    return;
  }
  const key = `custom_${Date.now()}`;
  managedTagCategories[key] = [];
  managedTagCategoryLabels[key] = label;
  libraryFilterConfig.push({ key, label, options: managedTagCategories[key] });
  libraryFilterState[key] = new Set();
  uploadTagCategories.push({ name: label, tags: managedTagCategories[key] });
  expandedTagCategories.add(key);
  saveStudioState();
  syncManagedTagInterfaces();
  renderTagManager();
  tagManagerBody?.querySelector(`[data-tag-category="${key}"] [data-tag-new]`)?.focus();
  showToast(`已新增大分类“${label}”。`, "success");
}

function deleteManagedTagCategory(categoryKey) {
  const index = libraryFilterConfig.findIndex((item) => item.key === categoryKey);
  if (index < 0) return;
  const category = libraryFilterConfig[index];
  if (!window.confirm(`确认删除大分类“${category.label}”？分类下的小标签不会从现有作品中删除。`)) return;
  libraryFilterConfig.splice(index, 1);
  delete managedTagCategories[categoryKey];
  delete managedTagCategoryLabels[categoryKey];
  delete libraryFilterState[categoryKey];
  expandedTagCategories.delete(categoryKey);
  const uploadIndex = uploadTagCategories.findIndex((item) => item.tags === category.options);
  if (uploadIndex >= 0) uploadTagCategories.splice(uploadIndex, 1);
  saveStudioState();
  syncManagedTagInterfaces();
  renderTagManager();
  showToast(`已删除大分类“${category.label}”。`, "success");
}

function renameManagedTagCategory(categoryKey, value) {
  const label = String(value || "").trim();
  const category = libraryFilterConfig.find((item) => item.key === categoryKey);
  if (!category) return;
  if (!label) {
    renderTagManager();
    return;
  }
  const duplicate = libraryFilterConfig.some((item) => item.key !== categoryKey && item.label === label);
  if (duplicate) {
    showToast("已经有同名的大分类。", "warning");
    renderTagManager();
    return;
  }
  category.label = label;
  managedTagCategoryLabels[categoryKey] = label;
  const uploadCategory = uploadTagCategories.find((item) => item.tags === managedTagCategories[categoryKey]);
  if (uploadCategory) uploadCategory.name = label;
  saveStudioState();
  syncManagedTagInterfaces();
  renderTagManager();
  showToast(`大分类已修改为“${label}”。`, "success");
}

function renameManagedTag(categoryKey, oldTag, value) {
  const tag = String(value || "").trim();
  const options = managedTagCategories[categoryKey];
  if (!options || !oldTag || tag === oldTag) return renderTagManager();
  if (!tag) return renderTagManager();
  if (options.includes(tag)) {
    showToast("这个分类中已经有同名标签。", "warning");
    renderTagManager();
    return;
  }
  const index = options.indexOf(oldTag);
  if (index < 0) return;
  options[index] = tag;
  replaceManagedTagOnWorks(oldTag, tag);
  const globalIndex = globalTags.indexOf(oldTag);
  if (globalIndex >= 0) globalTags.splice(globalIndex, 1);
  if (!globalTags.includes(tag)) globalTags.push(tag);
  saveStudioState();
  syncManagedTagInterfaces();
  renderTagManager();
  showToast(`已将“${oldTag}”改为“${tag}”。`, "success");
}

function deleteManagedTag(categoryKey, tag) {
  const options = managedTagCategories[categoryKey];
  if (!options?.includes(tag)) return;
  if (!window.confirm(`确认删除标签“${tag}”？现有作品中的这个标签也会被移除。`)) return;
  options.splice(options.indexOf(tag), 1);
  replaceManagedTagOnWorks(tag);
  const globalIndex = globalTags.indexOf(tag);
  if (globalIndex >= 0) globalTags.splice(globalIndex, 1);
  saveStudioState();
  syncManagedTagInterfaces();
  renderTagManager();
  showToast(`已删除标签“${tag}”。`, "success");
}

function renderCartPreview() {
  if (!cartPreviewList) return;
  const files = (typeof allSelectedFiles === "function") ? allSelectedFiles() : [...libraryCart];
  cartPreviewList.innerHTML = files.length
    ? files.slice(0, 4).map((file) => {
        const card = sourceCardByFile(file);
        const colors = Number(card?.dataset.colors || 1);
        const name = card?.querySelector(".work-head strong")?.textContent.trim() || file;
        return `<button class="flower-line" type="button" data-cart-preview-pop="${escapeHtml(file)}" aria-label="预览 ${escapeHtml(name)}">
          <span class="flower-line-thumb" data-image-shell>${cartPreviewImageMarkup(card)}</span>
          <div class="flower-line-info"><strong>${escapeHtml(name)}</strong><small>${colors} 配色</small></div>
        </button>`;
      }).join("") + (files.length > 4 ? `<p class="cart-preview-more">还有 ${files.length - 4} 个花型</p>` : "")
    : `<p class="top-popover-empty">选稿车目前为空。</p>`;
  hydrateLazyKeyImages(cartPreviewList);
}

function openCartPreview() {
  renderCartPreview();
  const shouldOpen = !cartPreviewPopover?.classList.contains("active");
  closeTopPopovers(cartPreviewPopover);
  cartPreviewPopover?.classList.toggle("active", shouldOpen);
  cartPreviewPopover?.setAttribute("aria-hidden", String(!shouldOpen));
}

function closeCartPreview() {
  cartPreviewPopover?.classList.remove("active");
  cartPreviewPopover?.setAttribute("aria-hidden", "true");
}

function ensureCustomerOption(customer, notify = true) {
  const cleanName = customer.trim();
  if (!cleanName) return;
  [libraryCustomer, projectCustomerSelect].forEach((select) => {
    if (!select || [...select.options].some((option) => option.value === cleanName)) return;
    select.appendChild(new Option(cleanName, cleanName));
  });
  if (notify) showToast(`已新增客户：${cleanName}`, "success");
}

function renderCustomerGenderOptions() {
  customerGenderOptions?.querySelectorAll("[data-customer-gender]").forEach((button) => {
    button.classList.toggle("active", button.dataset.customerGender === selectedCustomerGender);
  });
}

function renderCustomerPreferences() {
  if (!customerPreferenceTags) return;
  customerPreferenceTags.innerHTML = uploadTagCategories.map((group) => `<section class="tag-category"><strong>${group.name}</strong><div>${group.tags.map((tag) => `<button class="tag-option ${selectedCustomerPreferences.includes(tag) ? "active" : ""}" type="button" data-customer-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}</div></section>`).join("");
  customerPreferenceCount.textContent = `已选 ${selectedCustomerPreferences.length} 项`;
}

function clearCustomerValidation() {
  customerModal?.querySelectorAll(".customer-field-invalid").forEach((field) => field.classList.remove("customer-field-invalid"));
  customerValidationSummary?.classList.add("hidden");
}

function resetCustomerModal() {
  selectedCustomerGender = "未说明";
  selectedCustomerPreferences = [];
  customerNameInput.value = "";
  customerCompanyInput.value = "";
  customerContactInput.value = "";
  customerDemandInput.value = "";
  renderCustomerGenderOptions();
  renderCustomerPreferences();
  clearCustomerValidation();
}

function openCustomerModal() {
  if (!canCreateCustomerOrOrder()) {
    showToast("只有管理员可以新增客户。", "warning");
    return;
  }
  resetCustomerModal();
  if (customerModal.parentElement !== document.body) document.body.appendChild(customerModal);
  customerModal.classList.toggle("project-customer-modal", Boolean(pjPendingCustomerLink));
  customerModal.classList.add("active");
  customerModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
  customerNameInput.focus();
}

function closeCustomerModal() {
  const returnsToProjectForm = Boolean(pjPendingCustomerLink?.formCustomerInputId && document.querySelector("#pjFormOv.open"));
  customerModal.classList.remove("active");
  customerModal.classList.remove("project-customer-modal");
  customerModal.setAttribute("aria-hidden", "true");
  lockBodyScroll(returnsToProjectForm);
  pjPendingCustomerLink = null;
}

function requestCloseCustomerModal() {
  const hasDraft = customerNameInput.value.trim() || customerCompanyInput.value.trim() || customerContactInput.value.trim() || customerDemandInput.value.trim() || selectedCustomerPreferences.length || selectedCustomerGender !== "未说明";
  if (hasDraft) {
    openExitConfirmation({
      title: "放弃新增客户？",
      message: "退出后，本次填写的客户资料和偏好标签都不会保留。",
      onConfirm: closeCustomerModal,
    });
    return;
  }
  closeCustomerModal();
}

function createCustomerFromModal() {
  if (!canCreateCustomerOrOrder()) {
    showToast("只有管理员可以新增客户。", "warning");
    return;
  }
  const name = customerNameInput.value.trim();
  if (!name) {
    customerModal.querySelector(".customer-name-field")?.classList.add("customer-field-invalid");
    customerValidationSummary.querySelector("span").textContent = "请填写客户名称";
    customerValidationSummary.classList.remove("hidden");
    return;
  }
  if (customCustomers.some((customer) => customer.name === name)) {
    customerModal.querySelector(".customer-name-field")?.classList.add("customer-field-invalid");
    customerValidationSummary.querySelector("span").textContent = "该客户已存在";
    customerValidationSummary.classList.remove("hidden");
    return;
  }
  const company = customerCompanyInput.value.trim();
  const pendingLink = pjPendingCustomerLink;
  customCustomers = [{
    id: `CU-${Date.now()}`,
    name,
    gender: selectedCustomerGender,
    company,
    contact: customerContactInput.value.trim(),
    preferences: [...selectedCustomerPreferences],
    demand: customerDemandInput.value.trim(),
    createdAt: formatDateTime(),
  }, ...customCustomers];
  ensureCustomerOption(name, false);
  saveStudioState();
  closeCustomerModal();
  if (pendingLink?.projectId) {
    const project = pjById(pendingLink.projectId);
    if (project) {
      pjSaveCustomerFields(project, company || name, name);
      if (pjActiveId === project.id) pjRenderDetail(project);
    }
  }
  if (pendingLink?.formCustomerInputId) {
    const input = document.getElementById(pendingLink.formCustomerInputId);
    if (input) {
      input.value = company || name;
    }
    lockBodyScroll(true);
  }
  showToast(`${name} 已加入客户库。`, "success");
}

function handleQuickCreate(action) {
  closeQuickCreateModal();
  if (action === "project" && !canCreateProject()) {
    showToast("该操作仅管理员可用。", "warning");
    return;
  }
  if (["customer", "order"].includes(action) && !canCreateCustomerOrOrder()) {
    showToast("当前账号没有新建客户或订单的权限。", "warning");
    return;
  }
  if (action === "design") {
    openUploadModal();
    return;
  }
  if (action === "project") {
    openProjectCreateModal();
    return;
  }
  if (action === "customer") {
    openCustomerModal();
    return;
  }
  if (action === "order") {
    const hasSelection = libraryCart.size > 0 || selectionCarts.some((entry) => (entry.files || []).length > 0);
    switchView(hasSelection ? "cart" : "library");
    showToast(hasSelection ? "请核对客户选稿并生成订单。" : "请先选择客户并开始选稿，确认作品后即可生成订单。", "info");
  }
}

function activeOrderFiles() {
  return new Set(
    studioOrders
      .filter((order) => orderProgressStatus(order) !== "已关闭")
      // 订单文件可能是 { name } 对象；统一解析为作品编号后才能正确排除。
      .flatMap((order) => orderPatternList(order))
  );
}

function libraryEligibleDesigns() {
  const occupiedFiles = activeOrderFiles();
  const soldDesigns = directSoldDesignFiles();
  return [...workCards].filter((card) => {
    if (card.dataset.workRole !== "设计师" || card.classList.contains("deleted") || isSleepingWork(card)) return false;
    if (occupiedFiles.has(card.dataset.file) || soldDesigns.has(card.dataset.file)) return false;
    const summary = cardStatusSummary(card);
    return ["已通过", "初选", "已确认修改", "交付中", "完结"].some((item) => summary.includes(item));
  });
}

function selectedCartFiles() {
  const files = new Set(libraryCart);
  (selectionCarts || []).forEach((entry) => {
    (entry.files || []).forEach((file) => files.add(file));
  });
  return files;
}

function viewerLibraryModeActive() {
  return document.querySelector("#customerSelectionFlow")?.classList.contains("viewer-mode") || false;
}

function activeViewerCompany() {
  return String(
    viewerSession?.companyName
    || (currentAccount.role === "客户" ? currentAccount.company || currentAccount.name : libraryCustomer?.value || "")
  ).trim();
}

function isCurrentCustomerCustomWork(card) {
  const project = pjById(card?.dataset.projectId || "");
  if (!project || project.type !== "定制") return false;
  return pjCustomerMatches(project, activeViewerCompany());
}

function libraryCardHtml(card, viewerMode = viewerLibraryModeActive(), options = {}) {
  const colorCount = Number(card.dataset.colors || 1);
  const storedPreviewSource = cardPreviewSource(card);
  const previewSource = options.recycle && /^blob:/i.test(storedPreviewSource) ? "" : storedPreviewSource;
  // Older work records may keep their cover only in palette/work-image metadata.
  // Use the same candidate chain as the lightbox instead of requiring imageKey.
  const imageKey = workImageCandidateKeys(card, 0)[0] || "";
  const patternClass = previewSource || imageKey ? "has-image" : "";
  const imageMarkup = previewSource
    ? `<img src="${escapeHtml(previewSource)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`
    : imageKey
      ? `<img data-image-key="${escapeHtml(imageKey)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`
      : "";
  const project = card.querySelector(".work-body > p")?.textContent.replace(/^项目：/, "").trim() || "未关联项目";
  const title = card.querySelector(".work-head strong")?.textContent.trim() || card.dataset.file;
  if (options.recycle) {
    const owner = `${workRoleName(card)} · ${workOwnerName(card)}`;
    return `<article class="work-card recycle-item" data-file="${escapeHtml(card.dataset.file)}">
      <button class="preview-trigger recycle-thumb ${patternClass}" data-image-shell type="button" aria-label="查看 ${escapeHtml(title)}">
        ${imageMarkup}
        <span class="color-count">配色 ${colorCount}</span>
        <span class="work-hover-info"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(owner)}</span></span>
      </button>
      <div class="library-card-info"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(project)}</span><p>标签：${escapeHtml(cardTagsText(card))}</p></div>
      <button class="restore-work" type="button" aria-label="恢复 ${escapeHtml(title)}" title="恢复">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8v5h5"/><path d="M5.6 17.5a8 8 0 1 0 .2-11L4 8"/></svg>
      </button>
      <button class="recycle-delete-work" type="button" aria-label="永久删除 ${escapeHtml(title)}" title="永久删除">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg>
      </button>
    </article>`;
  }
  if (options.orderCompact) {
    const remaining = Number(options.remaining || 0);
    const author = workOwnerName(card);
    return `<article class="library-card order-work-card${remaining > 0 ? " has-more" : ""}" data-library-file="${escapeHtml(card.dataset.file)}">
      <button class="preview-trigger ${patternClass}" data-image-shell type="button"
        data-order-pattern="${escapeHtml(card.dataset.file)}" data-order-id="${escapeHtml(options.orderId || "")}"
        aria-label="${remaining > 0 ? `查看全部，另有 ${remaining} 款花型` : `查看 ${escapeHtml(title)}`}">
        ${imageMarkup}
        <span class="color-count">配色 ${colorCount}</span>
        <span class="work-hover-info"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(author)}</span></span>
        ${remaining > 0 ? `<i class="order-work-more">+${remaining}</i>` : ""}
      </button>
    </article>`;
  }
  if (viewerMode) {
    const selected = libraryCart.has(card.dataset.file);
    const customWork = isCurrentCustomerCustomWork(card);
    return `<article class="library-card viewer-library-card" data-library-file="${escapeHtml(card.dataset.file)}">
      <button class="preview-trigger ${patternClass}" data-image-shell type="button" aria-label="查看 ${escapeHtml(title)}">${imageMarkup}
        <span class="color-count">配色 ${colorCount}</span>
        ${customWork ? '<span class="customer-custom-badge">定制</span>' : ""}
      </button>
      <div class="library-card-info viewer-library-card-info">
        <strong>${escapeHtml(title)}</strong>
        <span>标签：${escapeHtml(cardTagsText(card))}</span>
      </div>
      <button class="viewer-library-add ${selected ? "selected" : ""}" type="button" data-library-add="${escapeHtml(card.dataset.file)}" aria-label="${selected ? "已加入选稿车" : `将 ${escapeHtml(title)} 加入选稿车`}">${selected ? "✓" : "+"}</button>
    </article>`;
  }
  const checked = libraryCompareSelection.has(card.dataset.file) ? " checked" : "";
  return `<article class="library-card" data-library-file="${card.dataset.file}">
    <label class="library-compare"><input type="checkbox" data-library-compare="${card.dataset.file}"${checked}>比对</label>
    <button class="preview-trigger ${patternClass}" data-image-shell type="button">${imageMarkup}${colorCount > 1 ? `<span class="color-count">${colorCount}</span>` : ""}</button>
    <div class="library-card-info">
      <strong>${card.dataset.file}</strong>
      <span>${escapeHtml(project)}</span>
      <p>标签：${escapeHtml(cardTagsText(card))}</p>
    </div>
  </article>`;
}

// ================= 客户中心 =================
const seededCustomerCenterBase = [
  { display: "晨光家纺", contact: "张宇", region: "江苏·南通", type: "品牌客户", style: "法式 / 低饱和 / 水彩", product: "四件套、被套、枕套", note: "重色彩统一与细节品质，偏好手绘风格，交付需含授权文件。" },
  { display: "云朵小镇童装", contact: "林悦", region: "浙江·杭州", type: "品牌客户", style: "童趣 / 明亮 / 扁平插画", product: "童装面料、图库", note: "偏爱可爱童趣元素，色彩明快，需适配童装印花。" },
  { display: "优眠生活家居", contact: "王敏", region: "广东·佛山", type: "品牌客户", style: "极简 / 莫兰迪 / 数字绘画", product: "床品、家居软装", note: "极简风格，低饱和配色，注重面料适配。" },
  { display: "南通尚东纺织", contact: "刘洋", region: "江苏·南通", type: "渠道客户", style: "复古 / 暖调 / 水彩", product: "四件套、面料批发", note: "以四方连续为主，走量为主，交付周期敏感。" },
  { display: "澳都袋鼠家纺", contact: "赵磊", region: "澳大利亚·悉尼", type: "品牌客户", style: "现代 / 中性 / 数字绘画", product: "床品、家居用品", note: "需英文授权书与高分辨率源文件。" },
  { display: "森语家居", contact: "吴静", region: "浙江·宁波", type: "品牌客户", style: "自然 / 绿色系 / 彩铅", product: "家居软装、墙纸", note: "自然植物题材，绿色系为主。" },
  { display: "北欧简居生活", contact: "周涛", region: "北京", type: "品牌客户", style: "极简 / 黑白灰 / 线稿", product: "墙纸、面料", note: "极简线稿风格，黑白灰为主。" },
  { display: "喜寐寝具", contact: "钱蕾", region: "江苏·苏州", type: "品牌客户", style: "古典 / 东方 / 水彩", product: "四件套、枕套", note: "东方古典题材。" },
  { display: "花田里家居", contact: "孙倩", region: "云南·昆明", type: "定制客户", style: "法式 / 甜美 / 水彩", product: "床品、丝巾", note: "花卉植物为主，法式甜美风。" },
  { display: "橙意生活", contact: "郑凯", region: "福建·厦门", type: "渠道客户", style: "现代 / 橙色系 / 扁平插画", product: "家居软装", note: "尚未正式下单。" },
  { display: "月见和风", contact: "田薇", region: "日本·大阪", type: "品牌客户", style: "日系 / 低饱和 / 彩铅", product: "面料、丝巾", note: "日系风格，低饱和配色。" },
  { display: "小柯童品", contact: "何昕", region: "广东·广州", type: "品牌客户", style: "童趣 / 明亮 / 扁平插画", product: "儿童用品、面料", note: "儿童题材，安全环保面料要求。" },
  { display: "青瓷纺织", contact: "冯磊", region: "浙江·龙泉", type: "渠道客户", style: "东方 / 青色系 / 水彩", product: "四件套、墙布", note: "青瓷主题，东方审美。" },
  { display: "暖岛家纺", contact: "许诺", region: "山东·青岛", type: "品牌客户", style: "甜美 / 粉色系 / 数字绘画", product: "床品、抱枕", note: "偏甜美粉色系。" },
  { display: "拾光文创", contact: "邓超", region: "四川·成都", type: "定制客户", style: "复古 / 暖调 / 版画", product: "文创、包装、丝巾", note: "复古文创风，版画质感。" },
];
const customerCenterBase = RELEASE_CONFIG.seedDemoData === false ? [] : seededCustomerCenterBase;

const CUSTOMER_PAGE_SIZE = 11;
let customerCenterClients = [];
let activeCustomerCenterId = null;
let activeCustomerTab = "overview";
let customerCenterPage = 1;
let customerCenterFilter = "all";
let openCustomerMenuId = null;
let customerManageMode = false;
const customerManageSelection = new Set();
const CUSTOMER_MANAGEMENT_KEY = "studio_site_customer_management_v1";
let customerManagementState = { pinnedIds: [], removedIds: [], lastReviewById: {} };
try {
  customerManagementState = { ...customerManagementState, ...JSON.parse(localStorage.getItem(CUSTOMER_MANAGEMENT_KEY) || "{}") };
} catch {}
function saveCustomerManagementState() {
  try { localStorage.setItem(CUSTOMER_MANAGEMENT_KEY, JSON.stringify(customerManagementState)); } catch {}
  if (typeof saveStudioState === "function") saveStudioState();
}
function employeeRoster() {
  const names = teamMembers.filter((m) => (m.accountStatus || "正常") === "正常").map((m) => m.name);
  return [...new Set(["管理员", ...names])];
}

function openCustomerDrawer() {
  const drawer = document.querySelector("#customerDrawer");
  if (!drawer) return;
  renderCustomerDetail();
  drawer.classList.add("active");
  drawer.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeCustomerDrawer() {
  const drawer = document.querySelector("#customerDrawer");
  if (!drawer) return;
  drawer.classList.remove("active");
  drawer.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

// 为客户生成专属登录账号与密码（新建客户时自动生成，展示给客户抄写）
function customerLoginAccount(id) {
  return `KH${String(id).replace(/\D/g, "").slice(-6) || Math.floor(Math.random() * 900000 + 100000)}`;
}
function genCustomerPassword(seed) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  if (seed) {
    let n = 0;
    for (const ch of String(seed)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
    let s = "";
    for (let i = 0; i < 6; i += 1) { s += chars[n % chars.length]; n = Math.floor(n / chars.length) + 13; }
    return s;
  }
  let s = "";
  for (let i = 0; i < 6; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
// 按登录账号+密码查找客户（客户端登录用）
function customerByLogin(username, password) {
  if (!customerCenterClients.length) customerCenterClients = buildCustomerCenter();
  const normalizedUsername = String(username || "").trim().toLowerCase();
  return customerCenterClients.find((c) =>
    String(c.loginAccount || "").trim().toLowerCase() === normalizedUsername
    && String(c.loginPassword || "") === String(password || "")
  ) || null;
}

function buildCustomerCenter() {
  const owners = ["沈黎", "王远"];
  const baseClients = customerCenterBase.map((c, i) => {
    const purchased = 2 + ((i * 5 + 3) % 17);
    const buyDay = 4 + ((i * 3) % 24);
    const coopDay = 6 + ((i * 4) % 22);
    const id = `KH2026${String(701 + i).padStart(4, "0")}`;
    return {
      ...c,
      id,
      name: c.display,
      purchased,
      lastBuy: `2026.0${1 + (i % 6)}.${String(buyDay).padStart(2, "0")}`,
      owner: owners[i % owners.length],
      createdAt: `2026.0${1 + (i % 4)}.${String(10 + (i % 15)).padStart(2, "0")}`,
      lastCoop: `2026.0${2 + (i % 5)}.${String(coopDay).padStart(2, "0")}`,
      phone: `+86 1${3 + (i % 6)}8 **** ${String(1000 + i * 37).slice(-4)}`,
      wechat: `kh_${1000 + i}`,
      email: `contact${100 + i}@example.com`,
      note: c.note,
      loginAccount: customerLoginAccount(id),
      loginPassword: genCustomerPassword(id),
    };
  });
  const savedClients = (customCustomers || []).map((customer, index) => {
    const id = customer.id || `CU-${index + 1}`;
    return {
      display: customer.company || customer.name || "未命名客户",
      name: customer.company || customer.name || "未命名客户",
      contact: customer.contact || customer.name || "",
      region: customer.region || "",
      type: customer.type || "定制客户",
      style: (customer.preferences || []).join(" / "),
      product: customer.product || "",
      note: customer.demand || customer.note || "",
      purchased: Number(customer.purchased || 0),
      lastBuy: customer.lastBuy || "",
      owner: customer.owner || "管理员",
      createdAt: customer.createdAt || "",
      lastCoop: customer.lastCoop || "",
      phone: customer.phone || customer.contact || "",
      wechat: customer.wechat || "",
      email: customer.email || "",
      ...(({ status: _legacyStatus, ...rest }) => rest)(customer),
      id,
      loginAccount: customer.loginAccount || customerLoginAccount(id),
      loginPassword: customer.loginPassword || genCustomerPassword(id),
    };
  });
  const savedIds = new Set(savedClients.map((client) => client.id));
  const savedNames = new Set(savedClients.map((client) => client.name));
  const removedIds = new Set(customerManagementState.removedIds || []);
  const pinnedIds = new Set(customerManagementState.pinnedIds || []);
  return [
    ...savedClients,
    ...(RELEASE_CONFIG.seedDemoData === false ? [] : baseClients.filter((client) => !savedIds.has(client.id) && !savedNames.has(client.name))),
  ].filter((client) => !removedIds.has(client.id)).map((client) => ({
    ...client,
    pinned: pinnedIds.has(client.id),
    lastReviewAt: customerManagementState.lastReviewById?.[client.id] || client.lastReviewAt || "",
  }));
}

/* ==== 客户档案的真实统计（全部由实际订单/看稿记录推导，不用种子假数据）==== */
function customerOrdersOf(client) {
  const nm = String(client?.name || "").trim().toLowerCase();
  if (!nm) return [];
  return (studioOrders || []).filter((o) => String(o.customer || "").trim().toLowerCase() === nm);
}
/** 实际购买（已支付）的花型总数 */
function customerRealPurchased(client) {
  const files = new Set();
  customerOrdersOf(client).forEach((o) => {
    if (o.paymentStatus === "已支付") orderPatternList(o).forEach((f) => files.add(f));
  });
  return files.size;
}
/** 最近一次购买时间：取最近一笔已支付订单的付款时间 */
function customerRealLastBuy(client) {
  const paid = customerOrdersOf(client)
    .filter((o) => o.paymentStatus === "已支付")
    .map((o) => o.paidAt || o.createdAt || "")
    .filter(Boolean)
    .sort();
  return paid.length ? paid[paid.length - 1] : "—";
}
/** 最近一次看稿时间：以实际发起看稿的记录为准 */
function customerRealLastReview(client) {
  if (client?.lastReviewAt) return client.lastReviewAt;
  const created = customerOrdersOf(client).map((o) => o.createdAt || "").filter(Boolean).sort();
  return created.length ? created[created.length - 1] : "—";
}

// 最近合作：优先取该客户名下最近创建/开始的项目时间，没有则用档案里的记录。
function customerLastCoop(client) {
  const related = (customProjects || []).filter((p) =>
    String(p.customer || "").includes(client.name) || String(p.name || "").includes(client.name)
  );
  const dates = related.map((p) => (p.createdAt || p.startAt || "").slice(0, 10)).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1].replace(/-/g, ".") : client.lastCoop;
}

function activeCustomerClient() {
  return customerCenterClients.find((item) => item.id === activeCustomerCenterId) || null;
}

function filteredCustomerClients() {
  return [...customerCenterClients].sort((a, b) =>
    Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.index - b.index
  );
}

function setCustomerPinned(ids, pinned) {
  const targetIds = new Set(ids);
  customerCenterClients.forEach((client) => {
    if (targetIds.has(client.id)) client.pinned = pinned;
  });
  const storedIds = new Set(customerManagementState.pinnedIds || []);
  targetIds.forEach((id) => pinned ? storedIds.add(id) : storedIds.delete(id));
  customerManagementState.pinnedIds = [...storedIds];
  saveCustomerManagementState();
}

function approvedLibraryCards() {
  return [...workCards].filter(isApprovedSharedWork);
}

function customerRecentWorks(client, count) {
  const cards = approvedLibraryCards();
  if (!cards.length) return [];
  const start = (client.index || 0) * 3;
  const picked = [];
  for (let k = 0; k < count && k < cards.length; k += 1) {
    picked.push(cards[(start + k) % cards.length]);
  }
  return picked;
}

// 可双击编辑的字段
function ccEdit(field, value, extraClass = "") {
  return `<strong class="cc-editable ${extraClass}" data-cc-edit="${field}" title="双击编辑">${escapeHtml(value || "—")}</strong>`;
}

function renderCustomerCenter() {
  if (!customerCenterClients.length) customerCenterClients = buildCustomerCenter();
  customerCenterClients.forEach((c, i) => { c.index = i; });
  renderCustomerList();
  if (document.querySelector("#customerDrawer")?.classList.contains("active")) renderCustomerDetail();
}

function renderCustomerList() {
  const listBody = document.querySelector("#customerListBody");
  const countEl = document.querySelector("#customerListCount");
  const pager = document.querySelector("#customerListPager");
  if (!listBody) return;
  listBody.classList.toggle("customer-manage-mode", customerManageMode);
  const list = filteredCustomerClients();
  const total = list.length;
  if (countEl) countEl.textContent = `客户列表（${total}）`;
  const pages = Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE));
  customerCenterPage = Math.min(customerCenterPage, pages);
  const startIndex = (customerCenterPage - 1) * CUSTOMER_PAGE_SIZE;
  const pageItems = list.slice(startIndex, startIndex + CUSTOMER_PAGE_SIZE);
  listBody.innerHTML = pageItems.length ? pageItems.map((client) => {
    return `
    <div class="cc-row ${client.id === activeCustomerCenterId ? "active" : ""}${client.pinned ? " is-pinned" : ""}${customerManageSelection.has(client.id) ? " is-selected" : ""}" data-customer-id="${escapeHtml(client.id)}" role="button" tabindex="0">
      ${customerManageMode ? `<label class="cc-manage-check" aria-label="选择 ${escapeHtml(client.name)}"><input type="checkbox" data-customer-select="${escapeHtml(client.id)}" ${customerManageSelection.has(client.id) ? "checked" : ""}><span></span></label>` : ""}
      <span class="cc-cell cc-cell-name">${escapeHtml(client.name)}</span>
      <span class="cc-cell cc-cell-contact">${escapeHtml(client.contact)}</span>
      <span class="cc-cell cc-cell-count">${customerRealPurchased(client)} 款</span>
      <span class="cc-cell cc-cell-date">${escapeHtml(customerRealLastBuy(client))}</span>
      <span class="cc-cell cc-cell-review-date">${escapeHtml(customerRealLastReview(client))}</span>
      ${customerManageMode ? "" : `<span class="cc-row-action">
        <button class="cc-row-menu-btn" type="button" data-customer-menu="${escapeHtml(client.id)}" aria-label="更多操作">⋯</button>
        <div class="cc-row-menu ${openCustomerMenuId === client.id ? "" : "hidden"}">
          <button type="button" data-customer-pin="${escapeHtml(client.id)}">${client.pinned ? "取消置顶" : "置顶客户"}</button>
          <i class="cc-menu-sep" aria-hidden="true"></i>
          <button class="cc-menu-danger" type="button" data-customer-delete="${escapeHtml(client.id)}">删除客户</button>
        </div>
      </span>`}
    </div>`;
  }).join("") : `<p class="empty-state">该筛选下暂无客户。</p>`;
  if (pager) {
    let buttons = `<button type="button" data-cc-page="prev" ${customerCenterPage <= 1 ? "disabled" : ""}>‹</button>`;
    for (let p = 1; p <= pages; p += 1) {
      buttons += `<button type="button" data-cc-page="${p}" class="${p === customerCenterPage ? "active" : ""}">${p}</button>`;
    }
    buttons += `<button type="button" data-cc-page="next" ${customerCenterPage >= pages ? "disabled" : ""}>›</button>`;
    pager.innerHTML = buttons;
  }
  const pinButton = document.querySelector("#customerManagePin");
  const deleteButton = document.querySelector("#customerManageDelete");
  const selectedClients = customerCenterClients.filter((client) => customerManageSelection.has(client.id));
  if (pinButton) pinButton.textContent = selectedClients.length && selectedClients.every((client) => client.pinned) ? "取消置顶" : "置顶";
  [pinButton, deleteButton].forEach((button) => {
    if (button) button.disabled = customerManageSelection.size === 0;
  });
}

function renderCustomerDetail() {
  const panel = document.querySelector("#customerDetailPanel");
  if (!panel) return;
  const client = activeCustomerClient();
  if (!client) {
    panel.innerHTML = `<p class="empty-state">请选择左侧客户查看档案。</p>`;
    return;
  }
  const metaHtml = `
    <div class="cc-meta"><span>负责人</span><strong class="cc-editable cc-pick" data-cc-pick="owner" title="点击选择员工">${escapeHtml(client.owner)}</strong></div>
    <div class="cc-meta"><span>建立时间</span>${ccEdit("createdAt", client.createdAt)}</div>
    <div class="cc-meta"><span>最近合作</span><strong title="随最近为该客户创建的项目自动更新">${escapeHtml(customerLastCoop(client))}</strong></div>`;
  const tabs = [["overview", "档案概览"], ["works", "已购花型"], ["history", "历史合作"], ["profile", "客户资料"], ["follow", "跟进记录"]];
  const tabsHtml = tabs.map(([key, label]) => `<button class="cc-tab ${key === activeCustomerTab ? "active" : ""}" type="button" data-customer-tab="${key}">${label}</button>`).join("");
  panel.innerHTML = `
    <div class="cc-detail-head">
      <div>
        <h2 class="cc-editable" data-cc-edit="name" title="双击编辑">${escapeHtml(client.name)}</h2>
      </div>
    </div>
    <div class="cc-meta-row">${metaHtml}</div>
    <div class="cc-tabs">${tabsHtml}</div>
    <div class="cc-tab-body">${renderCustomerTabBody(client)}</div>`;
  hydrateLazyKeyImages(panel);
}

function renderCustomerTabBody(client) {
  if (activeCustomerTab === "overview") return customerOverviewHtml(client);
  if (activeCustomerTab === "works") return customerPurchasedOrdersHtml(client);
  if (activeCustomerTab === "history") {
    const list = customerOrdersOf(client).slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    if (!list.length) return `<div class="cc-plain">该客户还没有订单记录。</div>`;
    return `<div class="cc-history">${list.map((o) => {
      const n = orderPatternList(o).length;
      const paid = o.paymentStatus === "已支付";
      const amount = orderPriceValue(o);
      return `<div class="cc-hist-row">
        <span class="cc-hist-main"><strong>${escapeHtml(o.id)}</strong><small>${escapeHtml(o.createdAt || "—")} · ${n} 款花型</small></span>
        <span class="cc-hist-right"><em>${amount == null ? "待输入金额" : orderPriceText(o)}</em>
        <i class="cc-hist-tag ${paid ? "ok" : ""}">${paid ? "已支付" : "未支付"}</i>
        <i class="cc-hist-tag ${orderDeliverStatus(o) === "已交付" ? "ok" : ""}">${escapeHtml(orderDeliverStatus(o))}</i></span>
      </div>`;
    }).join("")}</div>`;
  }
  if (activeCustomerTab === "profile") return customerProfileCardHtml(client);
  if (activeCustomerTab === "follow") return `<div class="cc-plain">暂无跟进记录。可在此登记客户沟通、报价与回访。</div>`;
  return "";
}

function customerOverviewHtml(client) {
  const recentOrders = customerPaidOrders(client).slice(0, 2);
  const worksHtml = recentOrders.length
    ? recentOrders.map(customerPurchasedOrderCardHtml).join("")
    : `<p class="empty-state">无</p>`;
  return `
    <div class="cc-overview">
      <section class="cc-section">
        <h3>客户信息</h3>
        <div class="cc-kv-grid">
          <div><span>联系电话</span>${ccEdit("phone", client.phone)}</div>
          <div><span>主要联系人</span>${ccEdit("contact", client.contact)}</div>
          <div><span>微信</span>${ccEdit("wechat", client.wechat)}</div>
          <div><span>所在地区</span>${ccEdit("region", client.region)}</div>
          <div><span>邮箱</span>${ccEdit("email", client.email)}</div>
          <div class="cc-kv-wide"><span>主要产品</span>${ccEdit("product", client.product)}</div>
        </div>
      </section>
      <section class="cc-section">
        <h3>花型与交付</h3>
        <div class="cc-purchase-orders">${worksHtml}</div>
      </section>
    </div>`;
}

function customerPaidOrders(client) {
  return customerOrdersOf(client)
    .filter((order) => order.paymentStatus === "已支付")
    .sort((a, b) => String(b.paidAt || b.createdAt || "").localeCompare(String(a.paidAt || a.createdAt || "")));
}

function customerPurchasedOrderCardHtml(order) {
  const patterns = orderPatternList(order);
  const patternCards = patterns.map((file) => {
    const card = sourceCardByFile(file);
    return card
      ? libraryCardHtml(card, false, { orderCompact: true, orderId: order.id })
      : `<article class="library-card order-work-card missing"><span>${escapeHtml(file)}</span></article>`;
  }).join("");
  return `<article class="cc-purchase-order">
    <header>
      <div><strong>${escapeHtml(order.id)}</strong><span>${escapeHtml(order.paidAt || order.createdAt || "未记录购买时间")}</span></div>
      <div><b>${orderPriceText(order)}</b><em>${escapeHtml(orderDeliverStatus(order))}</em></div>
    </header>
    <div class="oc-pattern-strip">${patternCards}</div>
    <footer><span>共 ${patterns.length} 款花型</span></footer>
  </article>`;
}

function customerPurchasedOrdersHtml(client) {
  const orders = customerPaidOrders(client);
  if (!orders.length) return `<p class="empty-state">无</p>`;
  return `<div class="cc-purchase-orders">${orders.map(customerPurchasedOrderCardHtml).join("")}</div>`;
}

function customerProfileCardHtml(client) {
  return `<div class="cc-overview"><section class="cc-section">
    <h3>完整资料</h3>
    <div class="cc-kv-grid">
      <div><span>负责人</span><strong>${escapeHtml(client.owner)}</strong></div>
      <div><span>建立时间</span><strong>${escapeHtml(client.createdAt)}</strong></div>
      <div><span>最近合作</span><strong>${escapeHtml(customerLastCoop(client))}</strong></div>
      <div><span>已购花型</span><strong>${customerRealPurchased(client)} 款</strong></div>
      <div><span>最近看稿</span><strong>${escapeHtml(customerRealLastReview(client))}</strong></div>
      <div><span>所在地区</span><strong>${escapeHtml(client.region)}</strong></div>
    </div></section></div>`;
}

const LIBRARY_GRID_BATCH = 24;
let libraryGridRenderLimit = LIBRARY_GRID_BATCH;

function renderLibraryGrid() {
  if (!libraryGrid) return;
  syncSoldWorkBadges();
  if (!librarySessionActive) {
    libraryGrid.innerHTML = `<p class="empty-state">确认客户和选稿人后开始选稿。</p>`;
    return;
  }
  const viewerMode = viewerLibraryModeActive();
  const designs = viewerMode ? filteredViewerLibraryDesigns() : libraryEligibleDesigns();
  const visibleDesigns = designs.slice(0, libraryGridRenderLimit);
  const schemeCards = [];
  libraryGrid.innerHTML = designs.length
    ? `${[...visibleDesigns.map((card) => libraryCardHtml(card, viewerMode)), ...schemeCards].join("")}${visibleDesigns.length < designs.length
      ? `<button class="gallery-auto-load-sentinel" type="button" data-gallery-auto-load data-library-load-more tabindex="-1" aria-hidden="true"></button>`
      : ""}`
    : `<p class="empty-state">暂无可供客户选择的设计稿。审核通过后的设计稿会出现在这里。</p>`;
  libraryGrid.classList.toggle("viewer-customer-grid", viewerMode);
  libraryGrid.classList.toggle("cards-info-hidden", !viewerMode && libraryInfoHidden);
  libraryStatus.textContent = `${libraryCustomer.value} / 选稿人：${libraryViewer.value.trim()} / 可看 ${designs.length + schemeCards.length} 组稿件`;
  if (viewerLibraryResultCount) viewerLibraryResultCount.textContent = `共找到 ${designs.length} 个作品`;
  hydrateLazyKeyImages(libraryGrid);
  observeGalleryAutoLoad(libraryGrid);
}

// 用 Map 索引避免每次都展开整个 NodeList 做线性查找（订单/选稿车渲染会调用成百上千次）
let _cardIndex = null;
function invalidateCardIndex() { _cardIndex = null; }
function sourceCardByFile(file) {
  if (!file) return undefined;
  if (!_cardIndex || _cardIndex.size !== workCards.length) {
    _cardIndex = new Map();
    for (const card of workCards) _cardIndex.set(card.dataset.file, card);
  }
  return _cardIndex.get(file);
}

function renderLibraryCart() {
  if (typeof updateViewerSelectionBar === "function") updateViewerSelectionBar();
  // 右上角选稿车徽标 = 已提交的选稿 + 本次进行中，合计花型数
  const totalSelected = (typeof allSelectedFiles === "function") ? allSelectedFiles().length : libraryCart.size;
  if (cartNavCount) cartNavCount.textContent = totalSelected;
  if (typeof renderCartPreview === "function") renderCartPreview();
  if (!libraryCartList) return;
  const files = [...libraryCart];
  libraryCartCount.textContent = `${files.length} 件`;
  if (!files.length) {
    libraryCartList.innerHTML = `<p class="empty-state">客户确认喜欢的稿子，会进入这里。</p>`;
    return;
  }
  libraryCartList.innerHTML = files
    .map((file) => {
      const card = sourceCardByFile(file);
      const imageMarkup = cartPreviewImageMarkup(card);
      return `<article class="cart-item" data-cart-file="${file}">
        <button class="cart-thumb${imageMarkup ? " has-image" : ""}" type="button" data-image-shell>${imageMarkup}</button>
        <div><strong>${escapeHtml(file)}</strong><span>${escapeHtml(cardTagsText(card))}</span></div>
        <button class="cart-remove" type="button" data-cart-remove="${file}">移除</button>
      </article>`;
    })
    .join("");
  hydrateLazyKeyImages(libraryCartList);
}

function addLibraryCart(file) {
  if (!file) return;
  const beforeSize = libraryCart.size;
  libraryCart.add(file);
  renderLibraryCart();
  if (libraryCart.size > beforeSize) {
    topCartButton?.classList.remove("cart-bump");
    void topCartButton?.offsetWidth;
    topCartButton?.classList.add("cart-bump");
    if (viewerLibraryModeActive()) renderLibraryGrid();
  }
  syncVlibGalleryAfterCartChange(file);
  showToast(`${file} 已加入选稿车。`, "success");
}

function animateLibraryItemToCart(button, card) {
  const target = topCartButton || document.querySelector("#viewerSelectionBar");
  const source = card?.querySelector(".preview-trigger");
  if (!button || !source || !target) return;
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const ghost = document.createElement("span");
  ghost.className = "viewer-cart-fly";
  ghost.style.left = `${sourceRect.left + sourceRect.width / 2 - 24}px`;
  ghost.style.top = `${sourceRect.top + sourceRect.height / 2 - 24}px`;
  ghost.style.backgroundImage = getComputedStyle(source).backgroundImage;
  document.body.appendChild(ghost);
  const dx = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const dy = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
  requestAnimationFrame(() => {
    ghost.style.transform = `translate(${dx}px, ${dy}px) scale(.22)`;
    ghost.style.opacity = "0";
  });
  window.setTimeout(() => ghost.remove(), 520);
  button.classList.add("adding");
  window.setTimeout(() => button.classList.remove("adding"), 360);
}

function applyCompareVariant(tile, card, variant) {
  const image = tile.querySelector(".compare-image");
  const sourcePattern = card.querySelector(".preview-trigger");
  const paletteKey = getPaletteKeys(card)[variant - 1];
  resolveImageSource(paletteKey).then((imageData) => {
    if (variant === 1) imageData = card.dataset.imageData || imageData;
    image.className = imageData
      ? "compare-image has-image"
      : `compare-image ${sourcePattern.className.replace("preview-trigger", "").trim()} ${variant > 1 ? `variant-${variant}` : ""}`;
    image.style.backgroundImage = imageData ? `url("${imageData}")` : "";
  });
  tile.querySelectorAll("[data-compare-variant]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.compareVariant) === variant);
  });
}

function compareTileHtml(card) {
  const colorCount = Number(card.dataset.colors || 1);
  const buttons = Array.from({ length: colorCount }, (_, index) => {
    const variant = index + 1;
    return `<button type="button" data-compare-variant="${variant}" class="${variant === 1 ? "active" : ""}">${variant === 1 ? "主色" : variant}</button>`;
  }).join("");
  return `<article class="compare-tile" data-compare-file="${card.dataset.file}">
    <button class="compare-remove" type="button" data-compare-remove="${card.dataset.file}">移除</button>
    <div class="compare-image"></div>
    <div class="compare-info">
      <strong>${card.dataset.file}</strong>
      <span>${escapeHtml(cardTagsText(card))}</span>
      <div class="compare-palette">${buttons}</div>
    </div>
  </article>`;
}

function openCompareOverlay() {
  const cards = [...libraryCompareSelection].map(sourceCardByFile).filter(Boolean);
  if (cards.length < 2) {
    showToast("请至少勾选 2 个稿件再比对。", "warning");
    return;
  }
  compareCount.textContent = `已选择 ${cards.length} 组`;
  compareGrid.innerHTML = cards.map(compareTileHtml).join("");
  compareGrid.dataset.count = String(cards.length);
  compareGrid.querySelectorAll(".compare-tile").forEach((tile) => {
    const card = sourceCardByFile(tile.dataset.compareFile);
    if (card) applyCompareVariant(tile, card, 1);
  });
  compareOverlay.classList.add("active");
  compareOverlay.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeCompareOverlay() {
  compareOverlay.classList.remove("active");
  compareOverlay.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

function confirmLibraryOrder() {
  if (!canCreateCustomerOrOrder()) {
    showToast("当前账号没有新建订单的权限。", "warning");
    return;
  }
  const files = [...libraryCart];
  if (!files.length) {
    showToast("选稿车里还没有稿件。", "warning");
    return;
  }
  files.forEach((file) => {
    const card = sourceCardByFile(file);
    if (!card) return;
    setBadgeText(card, "客户状态：", "交付中 / 已确认下单", "sale-badge customer");
  });
  createOrderFromLibrary(files);
  libraryCart.clear();
  libraryCompareSelection.clear();
  saveStudioState();
  renderLibraryCart();
  renderLibraryGrid();
  renderOrderCenter();
  libraryStatus.textContent = `${libraryCustomer.value} / 选稿人：${libraryViewer.value.trim()} / 已确认 ${files.length} 组，进入交付阶段`;
  showToast("已确认下单，稿件进入交付阶段。", "success");
}

function orderParticipantKeys(sourceCards) {
  const designers = new Set();
  const painters = new Set();
  sourceCards.forEach((card) => {
    if (card.dataset.workRole === "设计师" && card.dataset.workOwner) {
      designers.add(card.dataset.workOwner);
    }
    const linkedPainter = fieldValue(card, "引用手绘");
    teamMembers.filter((member) => member.role === "手绘师").map((member) => member.name).forEach((name) => {
      if (!linkedPainter.includes(name)) return;
      const key = workOwnerKeyByName(name);
      if (key) painters.add(key);
    });
  });
  return {
    designers: [...designers],
    painters: [...painters],
  };
}

function createOrderFromLibrary(files) {
  const customer = libraryCustomer.value || "未命名客户";
  const viewer = libraryViewer.value.trim() || "未填写选稿人";
  const day = dateKey(new Date()).replaceAll("-", "");
  const baseName = customer.replace(/[\\/\s]+/g, "").slice(0, 12) || "未命名客户";
  const version = studioOrders.filter((order) => order.id.startsWith(`${baseName}-${day}`)).length + 1;
  const id = `${baseName}-${day}-${String(version).padStart(3, "0")}`;
  const sourceCards = files.map(sourceCardByFile).filter(Boolean);
  const tags = [...new Set(sourceCards.flatMap((card) => (card.dataset.tags || "").split(",").filter(Boolean)))];
  const designers = [...new Set(sourceCards.map(workOwnerName).filter(Boolean))];
  const participants = orderParticipantKeys(sourceCards);
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 7);
  const note = sourceCards
    .map((card) => {
      const log = reviewLogs(card).find((item) => item.action === "客户修改意见");
      return log?.note ? `${card.dataset.file}：${log.note}` : "";
    })
    .filter(Boolean)
    .join("；");
  const order = {
    id,
    customer,
    viewer,
    status: "已确认下单",
    time: formatDateTime(),
    deliveryAt: dateKey(deliveryDate),
    files,
    fileStates: Object.fromEntries(files.map((file) => [file, "未审核"])),
    tags,
    designers,
    participants,
    needSample: "待确认",
    owner: currentAccount.name || "管理员",
    requirement: note || "暂无客户修改要求",
    note: note || "客户已确认选稿，等待整理交付文件。",
    progress: "已确认下单",
  };
  studioOrders.unshift(order);
}

function orderProgressStatus(order) {
  if (order.status === "已关闭") return "已关闭";
  return ["已确认下单", "进行中", "待评审", "已完成"].includes(order.status) ? order.status : "已确认下单";
}

function orderStatusClass(status) {
  if (status.includes("关闭")) return "closed";
  if (status.includes("已完成")) return "done";
  if (status.includes("待评审")) return "waiting";
  if (status.includes("进行中") || status.includes("已确认")) return "working";
  return "unsold";
}

function ensureOrderFileStates(order) {
  if (!order.fileStates) order.fileStates = {};
  (order.files || []).forEach((file) => {
    if (order.fileStates[file] === "等待审核") order.fileStates[file] = "未审核";
    if (!order.fileStates[file]) order.fileStates[file] = "未审核";
  });
  return order.fileStates;
}

function orderFilesReady(order) {
  const states = ensureOrderFileStates(order);
  return (order.files || []).length > 0 && (order.files || []).every((file) => states[file] === "等待交付");
}

function nextOrderStatus(order) {
  const current = orderProgressStatus(order);
  if (current === "已确认下单") return "进行中";
  if (current === "进行中") return "待评审";
  if (current === "待评审") return orderFilesReady(order) ? "已完成" : "待评审";
  return "已完成";
}

function orderStatusButtonHtml(order, status) {
  const canAdvance = currentAccount.role === "管理员" && status !== "已关闭" && status !== "已完成";
  return `<button class="status order-status-button ${orderStatusClass(status)}" type="button" data-order-status="${escapeHtml(order.id)}" ${canAdvance ? "" : "disabled"}>${escapeHtml(status)}</button>`;
}

function orderBelongsToCurrentAccount(order) {
  if (currentAccount.role === "管理员" || currentAccount.role === "销售") return true;
  // 客户：只看本公司订单（跨客户隔离）
  if (currentAccount.role === "客户") {
    const mine = String(currentAccount.company || currentAccount.name || "").trim().toLowerCase();
    if (!mine) return false;
    return String(order.customer || "").trim().toLowerCase() === mine;
  }
  const sourceCards = (order.files || []).map(sourceCardByFile).filter(Boolean);
  const participants = order.participants || orderParticipantKeys(sourceCards);
  if (currentAccount.role === "设计师") {
    return participants.designers?.includes(currentAccount.ownerKey) || sourceCards.some((card) => card.dataset.workOwner === currentAccount.ownerKey);
  }
  if (currentAccount.role === "手绘师") {
    const currentPainterName = workOwnerName({ dataset: { workOwner: currentAccount.ownerKey } });
    return participants.painters?.includes(currentAccount.ownerKey) || sourceCards.some((card) => fieldValue(card, "引用手绘").includes(currentPainterName));
  }
  return false;
}

function filteredOrders() {
  const keyword = (orderSearch?.value || "").trim().toLowerCase();
  const status = orderStatusFilter?.value || "all";
  const mode = orderSort?.value || "time-desc";
  const statusOrder = ["已确认下单", "进行中", "待评审", "已完成", "已关闭"];
  const items = studioOrders
    .filter(orderBelongsToCurrentAccount)
    .filter((order) => status === "all" || orderProgressStatus(order) === status)
    .filter((order) => {
      if (!keyword) return true;
      return searchMatches(keyword, [order.id, order.customer, order.viewer, orderProgressStatus(order), ...(order.files || []), ...(order.tags || [])]);
    });
  items.sort((a, b) => {
    if (mode === "time-asc") return new Date(a.time) - new Date(b.time);
    if (mode === "customer-asc") return a.customer.localeCompare(b.customer, "zh-CN");
    if (mode === "status") return statusOrder.indexOf(orderProgressStatus(a)) - statusOrder.indexOf(orderProgressStatus(b));
    return new Date(b.time) - new Date(a.time);
  });
  return items;
}

function orderCardHtml(order) {
  const tags = (order.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") || "<span>未设置</span>";
  const designers = (order.designers || []).join("、") || "待识别";
  const status = orderProgressStatus(order);
  const fileStates = ensureOrderFileStates(order);
  const isClosed = status === "已关闭";
  const closeButton =
    currentAccount.role === "管理员" && !isClosed
      ? `<button class="order-close-button" type="button" data-close-order="${escapeHtml(order.id)}">关闭订单</button>`
      : "";
  const thumbnails = (order.files || [])
    .map((file) => {
      const card = sourceCardByFile(file);
      const patternClass = card?.dataset.imageData ? "has-image" : "";
      const imageStyle = card?.dataset.imageData ? ` style="background-image:url('${card.dataset.imageData}')"` : "";
      const fileState = fileStates[file] || "未审核";
      const fileLink = order.fileLinks?.[file] ? `<em>${escapeHtml(order.fileLinks[file])}</em>` : "";
      return `<button class="order-thumb" type="button" data-order-file="${file}" data-order-id="${escapeHtml(order.id)}">
        <span class="order-thumb-preview ${patternClass}"${imageStyle}></span>
        <span class="order-thumb-meta">
          <i>${escapeHtml(file)}</i>
          <b>${escapeHtml(fileState)}</b>
          ${fileLink}
        </span>
      </button>`;
    })
    .join("");
  return `<article class="order-card ${isClosed ? "order-card-closed" : ""}" data-order-card="${escapeHtml(order.id)}">
    <div class="order-card-head">
      <div>
        <strong>${escapeHtml(order.id)}</strong>
        <p>${escapeHtml(order.customer)} / 选稿人：${escapeHtml(order.viewer)}</p>
      </div>
      <div class="order-head-actions">
        ${orderStatusButtonHtml(order, status)}
        ${closeButton}
      </div>
    </div>
    <div class="order-meta">
      <p><b>下单时间</b>${escapeHtml(order.time)}</p>
      <p><b>交期</b><input class="order-date-input" type="date" data-order-date="${escapeHtml(order.id)}" value="${escapeHtml(order.deliveryAt)}"></p>
      <p><b>稿件数量</b>${order.files?.length || 0} 组</p>
      <p><b>设计师</b>${escapeHtml(designers)}</p>
      <p><b>是否打样</b>${escapeHtml(order.needSample || "待确认")}</p>
      <p><b>负责人</b>${escapeHtml(order.owner || "待分配")}</p>
    </div>
    <details class="order-artworks" open>
      <summary>选中稿件 / ${order.files?.length || 0} 组</summary>
      <div class="order-thumb-grid">${thumbnails}</div>
    </details>
    <div class="order-tags">${tags}${currentAccount.role === "管理员" || currentAccount.role === "销售" ? `<button class="order-tag-add" type="button" data-order-add-tag="${escapeHtml(order.id)}">+ 标签</button>` : ""}</div>
    <div class="order-notes">
      <p><b>当前进度</b>${escapeHtml(order.progress || "待整理交付文件")}</p>
      <p><b>修改要求</b>${escapeHtml(order.requirement || "暂无客户修改要求")}</p>
      <p><b>备注</b>${escapeHtml(order.note)}</p>
    </div>
  </article>`;
}

function renderCustomerGroups(orders) {
  const groups = new Map();
  orders.forEach((order) => {
    if (!groups.has(order.customer)) groups.set(order.customer, []);
    groups.get(order.customer).push(order);
  });
  return [...groups.entries()]
    .map(([customer, items]) => {
      const tags = [...new Set(items.flatMap((item) => item.tags || []))].slice(0, 6).join("、") || "未沉淀";
      return `<section class="customer-order-group">
        <div class="panel-head"><h3>${escapeHtml(customer)}</h3><span>${items.length} 单</span></div>
        <p>常选标签：${escapeHtml(tags)}</p>
        ${items.map(orderCardHtml).join("")}
      </section>`;
    })
    .join("");
}

function orderDeliverStatus(order) {
  return order.deliverStatus || (orderProgressStatus(order) === "已完成" ? "已交付" : "未交付");
}

let orderPriceSaveTimer = null;
function queueOrderPriceStateSave() {
  if (orderPriceSaveTimer) clearTimeout(orderPriceSaveTimer);
  orderPriceSaveTimer = window.setTimeout(() => {
    orderPriceSaveTimer = null;
    saveStudioState();
  }, 350);
}

function flushOrderPriceStateSave() {
  if (!orderPriceSaveTimer) return;
  clearTimeout(orderPriceSaveTimer);
  orderPriceSaveTimer = null;
  saveStudioState();
}

function syncOrderPriceControls(order, sourceInput) {
  const orderCard = sourceInput?.closest("[data-order-card]");
  if (!orderCard) return;
  const totalInput = orderCard.querySelector("[data-order-price-input]");
  if (totalInput) {
    totalInput.value = order.price == null ? "" : Number(order.price.toFixed(2));
    totalInput.closest(".oc-price-input")?.classList.toggle("todo", order.price == null);
  }
  orderCard.querySelectorAll("[data-order-pattern-price]").forEach((input) => {
    const { file } = parseOrderPatternControl(input.dataset.orderPatternPrice);
    const value = orderPatternPriceValue(order, file);
    input.value = value == null ? "" : Number(value.toFixed(2));
  });
}

function orderPatternList(order) {
  if (order.patternIds?.length) return order.patternIds;
  return (order.files || []).map((f) => f?.name || f).filter(Boolean);
}

function ordersContainingWork(file) {
  const target = String(file || "").trim();
  if (!target) return [];
  return studioOrders.filter((order) => orderPatternList(order).some((pattern) => String(pattern) === target));
}

function undeliveredOrdersForWork(file) {
  return ordersContainingWork(file).filter((order) =>
    orderProgressStatus(order) !== "已关闭" && orderDeliverStatus(order) !== "已交付"
  );
}

function workDeleteBlock(cards) {
  const blocked = [];
  (cards || []).forEach((card) => {
    const file = card?.dataset?.file || "";
    const orders = undeliveredOrdersForWork(file);
    if (orders.length) blocked.push({ file, orders });
  });
  return blocked;
}

function ensureWorksCanMoveToRecycle(cards) {
  const blocked = workDeleteBlock(cards);
  if (!blocked.length) return true;
  const orderIds = [...new Set(blocked.flatMap((item) => item.orders.map((order) => order.id)))];
  const files = blocked.map((item) => item.file).filter(Boolean);
  openExitConfirmation({
    title: "稿件暂时不能删除",
    message: `${files.length === 1 ? `稿件 ${files[0]}` : `${files.length} 件所选稿件`}仍关联未交付订单 ${orderIds.join("、")}。请先完成订单交付，交付后才能将稿件移入回收站。`,
    submitText: "知道了",
    singleAction: true,
    onConfirm: () => {},
  });
  return false;
}

function moneyToCents(value) {
  if (value == null || String(value).trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function centsToMoney(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

function sumMoney(values) {
  return centsToMoney(values.reduce((total, value) => total + (moneyToCents(value) || 0), 0));
}

function orderPatternPriceEntries(order) {
  const patterns = orderPatternList(order);
  const stored = order?.patternPrices && typeof order.patternPrices === "object" ? order.patternPrices : {};
  const totalCents = moneyToCents(order?.price);
  const baseCents = totalCents == null || !patterns.length ? null : Math.floor(totalCents / patterns.length);
  const remainder = totalCents == null || !patterns.length ? 0 : totalCents - baseCents * patterns.length;
  return patterns.map((file, index) => ({
    file,
    value: stored[file] != null && moneyToCents(stored[file]) != null
      ? centsToMoney(moneyToCents(stored[file]))
      : baseCents == null
        ? null
        : centsToMoney(baseCents + (index === patterns.length - 1 ? remainder : 0)),
  }));
}

function orderPatternPriceValue(order, file) {
  return orderPatternPriceEntries(order).find((item) => item.file === file)?.value ?? null;
}

function ensureOrderPatternPrices(order) {
  const entries = orderPatternPriceEntries(order);
  order.patternPrices = Object.fromEntries(entries.map(({ file, value }) => [file, value == null ? 0 : value]));
  return order.patternPrices;
}

function canEditOrderPatterns(order) {
  return canEditOrderPrice() && orderDeliverStatus(order) !== "已交付" && orderProgressStatus(order) !== "已完成";
}

function orderPrimaryActionLabel(order) {
  if (orderDeliverStatus(order) === "已交付") return "取消交付";
  return "交付";
}

function orderTableFiltered() {
  const no = (document.querySelector("#orderFilterNo")?.value || "").trim().toLowerCase();
  const name = (document.querySelector("#orderFilterName")?.value || "").trim().toLowerCase();
  const user = (document.querySelector("#orderFilterUser")?.value || "").trim().toLowerCase();
  const status = orderStatusFilter?.value || "all";
  return studioOrders.filter(orderBelongsToCurrentAccount).filter((o) => {
    if (no && !String(o.id || "").toLowerCase().includes(no)) return false;
    if (name && !orderPatternList(o).join(" ").toLowerCase().includes(name)) return false;
    if (user && !String(o.viewer || o.customer || "").toLowerCase().includes(user)) return false;
    if (status !== "all" && orderDeliverStatus(o) !== status) return false;
    return true;
  }).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.time || 0) - new Date(a.time || 0));
}

function orderPatternThumbHtml(order, file, index, visibleCount) {
  const card = sourceCardByFile(file);
  const remaining = orderPatternList(order).length - visibleCount;
  const more = index === visibleCount - 1 && remaining > 0;
  const price = orderPatternPriceValue(order, file);
  const editable = canEditOrderPatterns(order) && !more;
  const controls = `<div class="oc-pattern-price-row">
    ${editable
      ? `<label><span>¥</span><input type="text" inputmode="decimal" value="${price == null ? "" : Number(price.toFixed(2))}" placeholder="金额" data-order-pattern-price="${escapeHtml(order.id)}|${escapeHtml(file)}" aria-label="${escapeHtml(file)} 金额"></label>`
      : `<strong>${price == null ? "待定价" : `¥${price.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong>`}
    ${editable ? `<button type="button" data-order-pattern-remove="${escapeHtml(order.id)}|${escapeHtml(file)}" aria-label="从订单中删除 ${escapeHtml(file)}" title="删除作品"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg></button>` : ""}
  </div>`;
  if (card) {
    return `<div class="oc-pattern-item">${libraryCardHtml(card, false, {
      orderCompact: true,
      orderId: order.id,
      remaining: more ? remaining : 0,
    })}${controls}</div>`;
  }
  return `<div class="oc-pattern-item"><article class="library-card order-work-card missing">
    <button class="preview-trigger" type="button" data-order-pattern="${escapeHtml(file)}" data-order-id="${escapeHtml(order.id)}">
      <span>${escapeHtml(file)}</span>${more ? `<i class="order-work-more">+${remaining}</i>` : ""}
    </button>
  </article>${controls}</div>`;
}

function orderCustomerRecord(order) {
  if (!customerCenterClients.length) customerCenterClients = buildCustomerCenter();
  const customer = String(order?.customer || "").trim();
  const viewer = String(order?.viewer || "").trim();
  return customerCenterClients.find((client) =>
    [client.name, client.company, client.display].some((value) => String(value || "").trim() === customer)
    || (viewer && String(client.contact || "").trim() === viewer)
  ) || null;
}

function customerCombinedName(client) {
  return `${String(client?.name || client?.company || "").trim()}${String(client?.contact || "").trim()}`;
}

function orderCustomerDisplay(order) {
  return String(order?.customerDisplay || "").trim()
    || `${String(order?.customer || "").trim()}${String(order?.viewer || "").trim()}`
    || "";
}

function orderCustomerMatches(query) {
  const keyword = String(query || "").trim();
  const seen = new Set();
  return customerCenterClients.filter((client) => {
    if (!client?.id || seen.has(client.id)) return false;
    seen.add(client.id);
    return !keyword || searchMatches(keyword, [client.name, client.company, client.contact, customerCombinedName(client), client.phone, client.owner]);
  }).slice(0, 8);
}

function bindOrderCustomer(order, client) {
  if (!order || !client) return;
  order.customerId = client.id || null;
  order.customer = client.name || client.company || "";
  order.viewer = client.contact || "";
  order.customerDisplay = customerCombinedName(client);
  logOrderEvent(order, `订单已关联客户 ${order.customerDisplay}`, currentAccount.role || "员工");
  saveStudioState();
  renderOrderCenter();
}

function saveOrderCustomerText(order, value) {
  const text = String(value || "").trim();
  if (!order || text === orderCustomerDisplay(order)) return;
  order.customerId = null;
  order.customerDisplay = text;
  order.customer = text;
  order.viewer = "";
  saveStudioState();
  renderOrderCenter();
}

function renderOrderCustomerResults(input) {
  const order = studioOrders.find((item) => item.id === input?.dataset.orderCustomerInput);
  const panel = input?.closest(".oc-order-customer-combo")?.querySelector(".oc-order-customer-results");
  if (!order || !panel) return;
  const query = input.value.trim();
  const matches = orderCustomerMatches(query);
  panel.innerHTML = matches.map((client) => {
    const phone = String(client.phone || "").replace(/\s/g, "");
    const suffix = phone ? `手机号 ${phone.slice(-4)}` : "未填写手机号";
    return `<button type="button" data-order-customer-pick="${escapeHtml(order.id)}|${escapeHtml(client.id)}"><strong>${escapeHtml(customerCombinedName(client))}</strong><small>${escapeHtml(`${suffix}${client.owner ? ` · 负责人 ${client.owner}` : ""}`)}</small></button>`;
  }).join("") + (query && !matches.some((client) => normalizeSearch(customerCombinedName(client)) === normalizeSearch(query))
    ? `<button class="create" type="button" data-order-customer-create="${escapeHtml(order.id)}">＋ 新建客户“${escapeHtml(query)}”</button>`
    : "");
  panel.classList.toggle("hidden", !panel.innerHTML);
}

function createAndBindOrderCustomer(order, displayName) {
  const name = String(displayName || "").trim();
  if (!order || !name) return;
  const client = {
    id: `CUS-${Date.now()}`,
    name,
    display: name,
    company: name,
    contact: "",
    phone: "",
    owner: currentAccount.name || "待分配",
    type: "品牌客户",
    region: "",
    style: "",
    product: "",
    wechat: "",
    email: "",
    note: "",
    createdAt: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
  };
  customerCenterClients.unshift(client);
  customCustomers.unshift({ ...client });
  bindOrderCustomer(order, client);
  renderCustomerCenter();
  showToast(`已新建并关联客户“${name}”。`, "success");
}

function orderCardPrototypeHtml(order) {
  const patterns = orderPatternList(order);
  const visibleCount = patterns.length;
  const thumbs = patterns.slice(0, visibleCount).map((file, index) => orderPatternThumbHtml(order, file, index, visibleCount)).join("");
  const priceVal = orderPriceValue(order);
  const deliver = orderDeliverStatus(order);
  const paid = order.paymentStatus === "已支付";
  const completed = orderProgressStatus(order) === "已完成";
  const completedAmountVisible = revealedCompletedOrderAmounts.has(order.id);
  const createdAt = order.createdAt || order.time || "未记录";
  const trashIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg>';
  const nextLabel = completed ? "撤回上一步操作" : !paid ? "标记为已支付" : deliver !== "已交付" ? "标记为已交付" : "标记为已完成";
  return `<article class="oc-order-card${order.pinned ? " is-pinned" : ""}${orderManageSelection.has(order.id) ? " is-selected" : ""}" data-order-card="${escapeHtml(order.id)}">
    ${orderManageMode ? `<span class="oc-order-select" aria-hidden="true">${orderManageSelection.has(order.id) ? "✓" : ""}</span>` : ""}
    <section class="oc-order-main">
      <header class="oc-order-heading">
        <span>订单号&nbsp; ${escapeHtml(order.id)}</span>
        ${order.pinned ? `<span class="oc-pin-tag"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 8 0-1 5 3 3v1H6v-1l3-3-1-5Z"></path><path d="M12 13v7"></path></svg>已置顶</span>` : ""}
        <div class="oc-order-customer-combo">
          <input type="search" value="${escapeHtml(orderCustomerDisplay(order))}" data-order-customer-input="${escapeHtml(order.id)}" placeholder="搜索或输入客户，例如：晨光家纺张宇" autocomplete="off" aria-label="订单客户">
          <div class="oc-order-customer-results hidden"></div>
        </div>
      </header>
      <div class="oc-pattern-strip">${thumbs || `<p>该订单暂无花型</p>`}</div>
      <footer class="oc-main-footer">
        <button class="oc-pattern-count" type="button" data-order-patterns="${escapeHtml(order.id)}">共 ${patterns.length} 款花型</button>
        <span class="oc-order-package-meta">
          <time>订单创建时间：${escapeHtml(createdAt)}</time>
          <button class="oc-package-download" type="button" data-order-package="${escapeHtml(order.id)}" aria-label="打包下载订单 ${escapeHtml(order.id)} 的全部稿件文件">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v4M14 3v5h5M8 14h8M8 18h8M5 3h9v5h5v13H5z"></path><path d="M12 11v6m-2-2 2 2 2-2"></path></svg>
            打包下载
          </button>
        </span>
      </footer>
    </section>
    <section class="oc-order-side">
      <div class="oc-side-top">
        <label><span>预计交付</span><input type="date" data-order-date="${escapeHtml(order.id)}" value="${escapeHtml(order.deliveryAt || "")}" aria-label="选择预计交付日期"></label>
        <strong>${completed ? "已完成" : "订单进行中"}</strong>
      </div>
      <div class="oc-price-row">
        <span>订单金额</span>
        ${canEditOrderPrice() && !paid
          ? `<label class="oc-price-input${priceVal == null ? " todo" : ""}"><span>¥</span><input type="text" inputmode="decimal" data-order-price-input="${escapeHtml(order.id)}" value="${priceVal == null ? "" : priceVal}" placeholder="待输入金额" aria-label="订单金额"></label>`
          : completed && priceVal != null
            ? `<span class="oc-private-price"><strong>${completedAmountVisible ? orderPriceText(order) : "****"}</strong><button type="button" data-order-price-visibility="${escapeHtml(order.id)}" aria-label="${completedAmountVisible ? "隐藏订单金额" : "查看订单金额"}" aria-pressed="${completedAmountVisible}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.6"></circle>${completedAmountVisible ? "" : '<path d="m4 4 16 16"></path>'}</svg></button></span>`
            : `<strong class="${priceVal == null ? "todo" : ""}">${priceVal == null ? "待输入金额" : orderPriceText(order)}</strong>`}
      </div>
      <div class="oc-stage-row" aria-label="订单状态">
        <span class="${paid ? "done" : "active"}">${paid ? "✓" : "○"}&nbsp; 已支付</span>
        <span class="${deliver === "已交付" ? "done" : paid ? "active" : ""}">${deliver === "已交付" ? "✓" : "○"}&nbsp; 已交付</span>
        <span class="${completed ? "done" : deliver === "已交付" ? "active" : ""}">${completed ? "✓" : "○"}&nbsp; 已完成</span>
      </div>
      <button class="oc-primary-action${completed ? " is-revoke" : ""}" type="button" data-order-advance="${escapeHtml(order.id)}">${nextLabel}</button>
      ${paid && !completed ? `<button class="oc-undo-action" type="button" data-order-undo="${escapeHtml(order.id)}">撤回上一步操作</button>` : ""}
      <footer>
        <button class="${order.pinned ? "active" : ""}" type="button" data-order-pin="${escapeHtml(order.id)}">⌖&nbsp; ${order.pinned ? "取消置顶" : "置顶订单"}</button>
        <i></i>
        <button class="danger" type="button" data-order-delete="${escapeHtml(order.id)}">删除订单&nbsp; ${trashIcon}</button>
      </footer>
    </section>
  </article>`;
}

function saveOrderPriceInput(input) {
  const order = studioOrders.find((item) => item.id === input?.dataset.orderPriceInput);
  if (!order || order.paymentStatus === "已支付") return;
  const raw = String(input.value || "").trim().replace(/[,\s¥￥]/g, "");
  if (!raw && orderPriceValue(order) == null) return;
  const cents = moneyToCents(raw);
  if (!raw || cents == null || cents < 0 || cents > 99999999999999) {
    showToast("请输入有效的订单金额。", "warning");
    input.focus();
    return;
  }
  const value = centsToMoney(cents);
  if (orderPriceValue(order) === value) return;
  order.price = value;
  const patterns = orderPatternList(order);
  if (patterns.length) {
    const baseCents = Math.floor(cents / patterns.length);
    const remainder = cents - baseCents * patterns.length;
    order.patternPrices = Object.fromEntries(patterns.map((file, index) => [
      file,
      centsToMoney(baseCents + (index === patterns.length - 1 ? remainder : 0)),
    ]));
  }
  order.priceManuallySet = true;
  logOrderEvent(order, `订单金额更新为 ¥${value.toLocaleString("zh-CN")}`, currentAccount.role || "员工");
  syncOrderPriceControls(order, input);
  queueOrderPriceStateSave();
  showToast(`Update：订单金额已更新为 ¥${value.toLocaleString("zh-CN")}`, "success");
}

function parseOrderPatternControl(value) {
  const separator = String(value || "").indexOf("|");
  return separator < 0 ? { orderId: "", file: "" } : {
    orderId: value.slice(0, separator),
    file: value.slice(separator + 1),
  };
}

function saveOrderPatternPriceInput(input) {
  const { orderId, file } = parseOrderPatternControl(input?.dataset.orderPatternPrice);
  const order = studioOrders.find((item) => item.id === orderId);
  if (!order || !file || !canEditOrderPatterns(order)) return;
  const raw = String(input.value || "").trim().replace(/[,\s¥￥]/g, "");
  const cents = moneyToCents(raw);
  if (!raw || cents == null || cents < 0 || cents > 99999999999999) {
    showToast("请输入有效的作品金额。", "warning");
    input.focus();
    return;
  }
  const value = centsToMoney(cents);
  const prices = ensureOrderPatternPrices(order);
  if (Number(prices[file]) === value) return;
  prices[file] = value;
  order.price = sumMoney(orderPatternList(order).map((pattern) => prices[pattern]));
  order.priceManuallySet = true;
  logOrderEvent(order, `${file} 金额更新为 ¥${value.toLocaleString("zh-CN")}`, currentAccount.role || "员工");
  syncOrderPriceControls(order, input);
  queueOrderPriceStateSave();
  showToast(`${file} 的金额已更新，订单总额已重新计算。`, "success");
}

function removeOrderPattern(orderId, file) {
  const order = studioOrders.find((item) => item.id === orderId);
  if (!order || !file || !canEditOrderPatterns(order)) {
    showToast("订单已交付，不能再删除作品。", "warning");
    return;
  }
  const patterns = orderPatternList(order);
  if (patterns.length <= 1) {
    showToast("订单至少需要保留一款作品；如需移除，请删除整张订单。", "warning");
    return;
  }
  openExitConfirmation({
    title: "警告：从订单移除稿件",
    message: `确认从订单 ${order.id} 中移除「${file}」？此操作只会解除该稿件与当前订单的关系并重新计算金额，不会删除作品库原稿。`,
    submitText: "确认移出订单",
    cancelText: "保留稿件",
    onConfirm: () => {
      const prices = ensureOrderPatternPrices(order);
      order.patternIds = patterns.filter((pattern) => pattern !== file);
      order.files = (order.files || []).filter((entry) => String(entry?.name || entry) !== file);
      delete prices[file];
      order.price = sumMoney(order.patternIds.map((pattern) => prices[pattern]));
      logOrderEvent(order, `从订单移除作品 ${file}，订单总额调整为 ¥${order.price.toLocaleString("zh-CN")}`, currentAccount.role || "员工");
      saveStudioState();
      syncSoldWorkBadges();
      renderOrderCenter();
      showToast(`${file} 已从订单移除，总额已更新；作品库原稿仍保留。`, "success");
    },
  });
}

function advanceOrderMilestone(orderId) {
  const order = studioOrders.find((item) => item.id === orderId);
  if (!order) return;
  if (orderProgressStatus(order) === "已完成") {
    order.status = "进行中";
    order.progress = "已交付，待完成";
    logOrderEvent(order, "撤回完成操作，订单恢复为已交付", currentAccount.role || "员工");
    showToast(`订单 ${order.id} 已撤回完成操作。`, "success");
  } else if (order.paymentStatus !== "已支付") {
    order.paymentStatus = "已支付";
    order.paidAt = formatDateTime();
    logOrderEvent(order, "订单已标记为已支付，金额锁定", currentAccount.role || "员工");
    showToast(`订单 ${order.id} 已标记为已支付。`, "success");
  } else if (orderDeliverStatus(order) !== "已交付") {
    order.deliverStatus = "已交付";
    logOrderEvent(order, "订单已标记为已交付", currentAccount.role || "员工");
    showToast(`订单 ${order.id} 已标记为已交付。`, "success");
  } else if (orderProgressStatus(order) !== "已完成") {
    order.status = "已完成";
    order.progress = "已完成";
    logOrderEvent(order, "订单已标记为已完成", currentAccount.role || "员工");
    showToast(`订单 ${order.id} 已完成。`, "success");
  }
  saveStudioState();
  renderOrderCenter();
}

function undoOrderMilestone(orderId) {
  const order = studioOrders.find((item) => item.id === orderId);
  if (!order) return;
  if (orderProgressStatus(order) === "已完成") {
    order.status = "进行中";
    order.progress = "已交付，待完成";
    logOrderEvent(order, "撤回完成操作，订单恢复为已交付", currentAccount.role || "员工");
    showToast(`订单 ${order.id} 已退回已交付状态。`, "success");
  } else if (orderDeliverStatus(order) === "已交付") {
    order.deliverStatus = "未交付";
    order.progress = "已支付，待交付";
    logOrderEvent(order, "撤回交付操作，订单恢复为已支付", currentAccount.role || "员工");
    showToast(`订单 ${order.id} 已退回已支付状态。`, "success");
  } else if (order.paymentStatus === "已支付") {
    order.paymentStatus = "未支付";
    order.progress = "待支付";
    logOrderEvent(order, "撤回支付标记，订单恢复为未支付", currentAccount.role || "员工");
    showToast(`订单 ${order.id} 已退回未支付状态，金额可继续修改。`, "success");
  } else {
    return;
  }
  saveStudioState();
  renderOrderCenter();
}

function renderOrderCenter() {
  if (!orderList) return;
  syncSoldWorkBadges();
  const orders = orderTableFiltered();
  orderList.innerHTML = orders.length
    ? orders.map(orderCardPrototypeHtml).join("")
    : `<p class="empty-state">暂无订单。客户选稿后点击「生成订单」会显示在这里。</p>`;
  orderList.classList.toggle("is-managing", orderManageMode);
  renderOrderManageState();
  hydrateLazyKeyImages(orderList);
}

function renderOrderManageState() {
  const orders = orderTableFiltered();
  const selectedCount = orderManageSelection.size;
  orderManageToggle?.querySelector("span") && (orderManageToggle.querySelector("span").textContent = orderManageMode ? "完成管理" : "管理");
  [orderManageSelectAll, orderManageDelete, orderManagePin].forEach((button) => button?.classList.toggle("hidden", !orderManageMode));
  if (orderManageSelectAll) orderManageSelectAll.textContent = orders.length > 0 && selectedCount === orders.length ? "取消全选" : "全选";
  if (orderManageDelete) orderManageDelete.disabled = selectedCount === 0;
  if (orderManagePin) orderManagePin.disabled = selectedCount === 0;
}

function toggleOrderManageMode() {
  orderManageMode = !orderManageMode;
  if (!orderManageMode) orderManageSelection.clear();
  renderOrderCenter();
}

function deleteSelectedOrders() {
  const ids = [...orderManageSelection];
  if (!ids.length || !window.confirm(`确认删除选中的 ${ids.length} 个订单？此操作不可恢复。`)) return;
  studioOrders = studioOrders.filter((order) => !orderManageSelection.has(order.id));
  orderManageSelection.clear();
  saveStudioState();
  renderOrderCenter();
  showToast(`已删除 ${ids.length} 个订单。`, "success");
}

function pinSelectedOrders() {
  let count = 0;
  studioOrders.forEach((order) => {
    if (!orderManageSelection.has(order.id)) return;
    order.pinned = true;
    count += 1;
  });
  orderManageSelection.clear();
  saveStudioState();
  renderOrderCenter();
  showToast(`已置顶 ${count} 个订单。`, "success");
}

function openOrderPatterns(orderId) {
  const order = studioOrders.find((item) => item.id === orderId);
  const modal = document.querySelector("#orderPatternModal");
  const grid = document.querySelector("#orderPatternModalGrid");
  if (!order || !modal || !grid) return;
  const patterns = orderPatternList(order);
  document.querySelector("#orderPatternModalCount").textContent = `共 ${patterns.length} 款`;
  grid.innerHTML = patterns.map((file) => {
    const card = sourceCardByFile(file);
    const colorCount = Number(card?.dataset.colors || 1);
    const title = card?.querySelector(".work-head strong")?.textContent.trim() || file;
    const author = card ? workOwnerName(card) : "未记录设计师";
    return `<button class="oc-pattern-item" type="button" data-modal-order-file="${escapeHtml(file)}" data-order-id="${escapeHtml(order.id)}">
      <span data-image-shell>${orderDetailImageMarkup(card) || escapeHtml(file)}<i class="color-count">配色 ${colorCount}</i></span>
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(author)}</small>
    </button>`;
  }).join("");
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  hydrateLazyKeyImages(grid);
  lockBodyScroll(true);
}

function closeOrderPatterns() {
  const modal = document.querySelector("#orderPatternModal");
  modal?.classList.remove("active");
  modal?.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

function openOrderCustomerProfile(name) {
  if (!name) return;
  if (!customerCenterClients.length) customerCenterClients = buildCustomerCenter();
  const client = customerCenterClients.find((item) => [item.name, item.company, item.contact].some((value) => String(value || "").trim() === name.trim()));
  if (!client) { showToast("暂未找到对应客户档案。", "warning"); return; }
  activeCustomerCenterId = client.id;
  activeCustomerTab = "overview";
  switchView("library");
  renderCustomerCenter();
  openCustomerDrawer();
}

/* ============ 订单生命周期详情页（内嵌产品内，真实数据驱动） ============ */
function orderLifecycleModel(order) {
  const payment = order.paymentStatus === "已支付" ? "paid" : "unpaid";
  const delivered = orderDeliverStatus(order) === "已交付";
  const delivery = delivered ? "downloaded" : order.deliveryPrepared ? "prepared_locked" : "not_ready";
  return { payment, delivery, delivered };
}

const OD_LABELS = {
  payment: { unpaid: "未支付", paid: "已支付" },
  delivery: { not_ready: "未准备", prepared_locked: "已准备待付款", downloaded: "已交付" },
};

/* 订单价格：默认「待输入」——价格线下商定后由管理员/销售录入 */
function orderPriceValue(order) {
  if (order?.patternPrices && typeof order.patternPrices === "object" && Object.keys(order.patternPrices).length) {
    return orderPatternPriceEntries(order).reduce((total, item) => total + Number(item.value || 0), 0);
  }
  if (order && order.price != null && order.price !== "" && !Number.isNaN(Number(order.price))) return Number(order.price);
  return null;
}
function orderPriceText(order) {
  const v = orderPriceValue(order);
  return v == null ? "待输入" : `¥${v.toLocaleString("zh-CN", { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function canEditOrderPrice() {
  return currentAccount.role === "管理员" || currentAccount.role === "销售";
}
function editOrderPrice(orderId, trigger) {
  if (!canEditOrderPrice()) return;
  const order = studioOrders.find((o) => o.id === orderId);
  if (!order) return;
  if (order.paymentStatus === "已支付") { showToast("订单已支付，价格不可再修改。", "warning"); return; }
  const cur = orderPriceValue(order);
  const cell = trigger?.closest(".order-cell-price");
  if (!cell) return;
  const previousHtml = cell.innerHTML;
  cell.innerHTML = `<div class="order-price-editor">
    <input type="text" inputmode="decimal" autocomplete="off" aria-label="订单成交价格" value="${cur == null ? "" : cur}" placeholder="输入金额" />
  </div>`;
  const input = cell.querySelector("input");
  let cancelled = false;
  let committed = false;
  const cancel = () => {
    cancelled = true;
    cell.innerHTML = previousHtml;
  };
  const save = () => {
    if (cancelled || committed) return;
    const raw = String(input.value || "").trim().replace(/[,\s¥￥]/g, "");
    const v = Number(raw);
    if (!raw || !Number.isFinite(v) || v < 0 || v > 999999999999.99) {
      showToast("请输入 0 至 999,999,999,999.99 之间的有效金额。", "warning");
      requestAnimationFrame(() => input.focus());
      return;
    }
    committed = true;
    const before = cur == null ? "待输入金额" : orderPriceText(order);
    order.price = v;
    order.priceManuallySet = true;
    logOrderEvent(order, `订单价格由 ${before} 变更为 ${orderPriceText(order)}`, currentAccount.role || "员工");
    saveStudioState();
    renderOrderCenter();
    showToast(`订单 ${order.id} 价格已更新为 ${orderPriceText(order)}`, "success");
  };
  input.addEventListener("blur", save);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  });
  input.focus();
  input.select();
}

/* 订单动态：客户/员工的每一步操作都留痕，管理员在订单详情能看到 */
function logOrderEvent(order, text, who) {
  if (!order) return;
  order.activity = order.activity || [];
  order.activity.unshift({ t: formatDateTime(), text, who: who || (currentAccount.role || "系统") });
  if (order.activity.length > 40) order.activity.length = 40;
  order.unreadForStaff = (order.unreadForStaff || 0) + (currentAccount.role === "客户" ? 1 : 0);
}

function ensureOrderDetailOverlay() {
  if (document.getElementById("orderDetailOverlay")) return;
  const style = document.createElement("style");
  style.textContent = `
    #orderDetailOverlay{position:fixed;inset:0;z-index:1200;display:none}
    #orderDetailOverlay.open{display:block}
    #orderDetailOverlay .odx-scrim{position:absolute;inset:0;background:rgba(28,25,23,.45)}
    #orderDetailOverlay .odx-panel{position:absolute;top:0;right:0;height:100%;width:min(560px,100%);
      background:#fafaf9;box-shadow:-8px 0 40px rgba(0,0,0,.18);overflow-y:auto}
    .odx-head{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #eae8e4;position:sticky;top:0;background:#fafaf9;z-index:2}
    .odx-head h2{margin:0;font-size:18px}
    .odx-close{border:none;background:none;font-size:22px;color:#78716c;cursor:pointer;line-height:1}
    .odx-body{padding:22px 24px 40px}
    .odx-card{background:#fff;border:1px solid #eae8e4;border-radius:6px;padding:18px 20px;margin-bottom:16px}
    .odx-order{display:flex;gap:16px;align-items:center}
    .odx-thumb{position:relative;width:80px;height:80px;border-radius:6px;flex:none;overflow:hidden;background:transparent;border:1px solid #eae8e4}
    .odx-thumb img,.odx-lock img{display:block;width:100%;height:100%;object-fit:cover}
    .odx-order h3{margin:0 0 6px;font-size:16px}
    .odx-order .m{font-size:13px;color:#57534e;line-height:1.8}.odx-order .m b{color:#1c1917;font-weight:500}
    .odx-steps{display:flex;margin:2px 0}
    .odx-step{flex:1;text-align:center;position:relative}
    .odx-step .d{width:26px;height:26px;border-radius:50%;background:#eceae6;color:#a8a29e;display:grid;place-items:center;margin:0 auto 7px;font-size:13px;font-weight:700;position:relative;z-index:1}
    .odx-step.done .d{background:#1c1917;color:#fff}.odx-step.active .d{background:#2563eb;color:#fff}
    .odx-step .t{font-size:12px;color:#57534e}.odx-step.active .t{color:#1c1917;font-weight:600}
    .odx-step:not(:last-child):after{content:"";position:absolute;top:13px;left:50%;width:100%;height:2px;background:#eceae6;z-index:0}
    .odx-step.done:not(:last-child):after{background:#1c1917}
    .odx-stat{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
    .odx-stat .s{border:1px solid #eae8e4;border-radius:3px;padding:10px 12px}
    .odx-stat .k{font-size:12px;color:#a8a29e}.odx-stat .v{font-size:14px;font-weight:600;margin-top:2px}
    .odx-primary{width:100%;padding:14px;border:none;border-radius:6px;background:#1c1917;color:#fff;font-size:15px;font-weight:500;cursor:pointer;margin-top:18px}
    .odx-primary:hover{background:#000}.odx-primary.wait{background:#faf9f8;color:#a8a29e;border:1.5px dashed #e2e0dc;cursor:default}
    .odx-pt{font-size:15px;font-weight:600;margin:0 0 12px}
    .odx-note{font-size:13px;color:#57534e;line-height:1.6}
    .odx-locks{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
    .odx-lock{position:relative;aspect-ratio:1;border-radius:6px;overflow:hidden;background:transparent;border:1px solid #eae8e4}
    .odx-lock .ov{position:absolute;inset:0;background:rgba(20,18,16,.5);display:grid;place-items:center;color:#fff;text-align:center;font-size:11px}
    .odx-file{display:flex;align-items:center;justify-content:space-between;border:1px solid #eae8e4;border-radius:3px;padding:11px 14px;margin-top:10px}
    .odx-file .n{font-size:14px;font-weight:500}.odx-file .s{font-size:12px;color:#a8a29e}
    .odx-btn{padding:11px 16px;border-radius:3px;font-size:14px;cursor:pointer;border:1.5px solid #e2e0dc;background:#fff;color:#1c1917}
    .odx-btn:hover{border-color:#1c1917}.odx-btn.dark{background:#1c1917;color:#fff;border-color:#1c1917}.odx-btn.dark:hover{background:#000}
    .odx-btnrow{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
    .odx-feed{display:grid;gap:12px}
    .odx-ev{display:flex;gap:10px;align-items:flex-start}
    .odx-ev-who{flex:none;font-size:11px;padding:2px 8px;border-radius:6px;background:#f5f4f2;border:1px solid #eae8e4;color:#57534e}
    .odx-ev-who.cust{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}
    .odx-ev-t{font-size:13px;color:#1c1917;line-height:1.5}
    .odx-ev-d{font-size:11px;color:#a8a29e;margin-top:2px}
    .odx-badge{font-size:11px;font-weight:500;padding:2px 8px;border-radius:6px;background:#fef3c7;border:1px solid #fcd34d;color:#b45309;margin-left:6px}
    .odx-file-meta{flex:1;min-width:0;padding-left:2px}`;
  document.head.appendChild(style);
  const el = document.createElement("div");
  el.id = "orderDetailOverlay";
  el.innerHTML = `<div class="odx-scrim" data-od-close></div>
    <div class="odx-panel"><div class="odx-head"><h2>订单详情</h2><button class="odx-close" data-od-close>×</button></div>
    <div class="odx-body" id="orderDetailBody"></div></div>`;
  document.body.appendChild(el);
  el.addEventListener("click", (e) => { if (e.target.closest("[data-od-close]")) closeOrderDetail(); });
}

let activeOrderDetailId = "";
function closeOrderDetail() {
  document.getElementById("orderDetailOverlay")?.classList.remove("open");
  activeOrderDetailId = "";
  lockBodyScroll(false);
}
function orderDetailImageMarkup(card) {
  const previewSource = cardPreviewSource(card);
  const imageKey = card?.dataset.imageKey || "";
  if (previewSource) {
    return `<img src="${escapeHtml(previewSource)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`;
  }
  return imageKey
    ? `<img data-image-key="${escapeHtml(imageKey)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`
    : "";
}

function renderOrderDetailBody(order) {
  const body = document.getElementById("orderDetailBody");
  if (!body) return;
  const isCustomer = currentAccount.role === "客户";
  const L = orderLifecycleModel(order);
  const patterns = orderPatternList(order);
  const name = patterns.length ? `${patterns[0]}${patterns.length > 1 ? ` 等 ${patterns.length} 款` : ""}` : `${order.customer || "客户"} 订单`;
  const price = orderPriceText(order);
  const firstCard = sourceCardByFile(patterns[0]);
  const firstThumb = orderDetailImageMarkup(firstCard);
  // 时间线
  const stageIdx = L.payment !== "paid" ? 0 : L.delivery !== "downloaded" ? 1 : 2;
  const stages = ["支付", "交付", "完成"];
  const stepsHtml = stages.map((s, i) => `<div class="odx-step ${i < stageIdx ? "done" : i === stageIdx ? "active" : ""}"><div class="d">${i < stageIdx ? "✓" : i + 1}</div><div class="t">${s}</div></div>`).join("");
  // 主区（按角色 + 阶段）
  let action = "";
  if (L.payment !== "paid") {
    action = isCustomer
      ? `<div class="odx-note">请完成付款，付款后进入正式交付流程。</div>
         <button class="odx-btn dark" style="width:100%;margin-top:12px" data-od-action="pay">立即支付</button>`
      : `<div class="odx-note">等待客户付款，付款成功后进入交付流程。</div>`;
  } else {
    if (isCustomer) {
      action = L.delivered
        ? `<div class="odx-file"><div><div class="n">交付包（PSD/TIFF）</div><div class="s">下载链接有效期 30 分钟</div></div><button class="odx-btn" data-od-action="download">下载</button></div>`
        : `<div class="odx-note">款项已到账，交付文件正在准备中。</div>`;
    } else {
      action = `<button class="odx-btn ${L.delivered ? "" : "dark"}" style="width:100%" data-od-action="toggle-deliver">${L.delivered ? "取消交付" : "交付并解锁作品"}</button>`;
    }
  }
  const lockPreview = "";

  body.innerHTML = `
    <div class="odx-card odx-order">
      <div class="odx-thumb" data-image-shell>${firstThumb}</div>
      <div><h3>${escapeHtml(name)}</h3>
        <div class="m">订单编号　<b>${escapeHtml(order.id)}</b><br>下单用户　<b>${escapeHtml(order.viewer || order.customer || "—")}</b><br>应付金额　<b>${price === "待输入" ? "待输入金额" : price}</b></div>
      </div>
    </div>
    <div class="odx-card">
      <div class="odx-steps">${stepsHtml}</div>
      <div class="odx-stat">
        <div class="s"><div class="k">支付状态</div><div class="v">${OD_LABELS.payment[L.payment]}</div></div>
        <div class="s"><div class="k">交付状态</div><div class="v">${OD_LABELS.delivery[L.delivery]}</div></div>
        <div class="s"><div class="k">订单状态</div><div class="v">${escapeHtml(orderProgressStatus(order))}</div></div>
      </div>
      <div style="margin-top:18px">${action}</div>
    </div>
    ${lockPreview}
    ${(order.activity && order.activity.length) ? `<div class="odx-card"><div class="odx-pt">订单动态</div>
      <div class="odx-feed">${order.activity.slice(0, 12).map((a) => `<div class="odx-ev"><span class="odx-ev-who ${a.who === "客户" ? "cust" : ""}">${escapeHtml(a.who)}</span><div><div class="odx-ev-t">${escapeHtml(a.text)}</div><div class="odx-ev-d">${escapeHtml(a.t)}</div></div></div>`).join("")}</div></div>` : ""}
    <div class="odx-card"><div class="odx-pt">本单花型（${patterns.length}）</div>
      <div class="odx-locks">${patterns.slice(0, 6).map((f) => `<div class="odx-lock" data-image-shell>${orderDetailImageMarkup(sourceCardByFile(f))}</div>`).join("") || '<div class="odx-note">无花型明细</div>'}</div>
    </div>`;

  hydrateLazyKeyImages(body);
  body.querySelectorAll("[data-od-action]").forEach((btn) => {
    btn.addEventListener("click", () => onOrderDetailAction(btn.dataset.odAction, order));
  });
}
/* ============ 支付页对接：把真实订单数据交给 pay.html，并接收支付结果 ============ */
const PAY_PAYLOAD_KEY = "king_pay_payload";
const PAY_RESULT_KEY = "king_pay_result";

/* 应用内支付弹层：不跳页，避免返回后状态错乱/白屏，支付结果即时反馈 */
function openPaymentPage(order) {
  if (!order) return;
  const patterns = orderPatternList(order);
  order.itemPrices = { ...ensureOrderPatternPrices(order) };
  let ov = document.getElementById("payOverlay");
  if (!ov) {
    const st = document.createElement("style");
    st.textContent = `
      #payOverlay{position:fixed;inset:0;z-index:1400;display:none;isolation:isolate}
      #payOverlay.open{display:block}
      #payOverlay .pv-scrim{position:absolute;inset:0;background:rgba(20,18,16,.6)}
      #payOverlay .pv-box{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(1120px,94vw);height:min(760px,90dvh);max-height:90vh;background:#f5f5f5;border-radius:8px;
        overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.24)}
      #payOverlay .pv-head{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;
        background:#fff;border-bottom:1px solid #eae8e4}
      #payOverlay .pv-title{display:flex;align-items:center;gap:8px}
      #payOverlay .pv-head h3{margin:0;font-size:20px;font-weight:600}
      #payOverlay .pv-x{border:none;background:none;font-size:22px;color:#78716c;cursor:pointer}
      #payOverlay .pv-body{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(340px,.9fr);gap:16px;
        padding:22px 24px;overflow:hidden;flex:1;min-height:0}
      #payOverlay .pv-col{min-width:0;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-right:6px}
      #payOverlay .pv-card{background:#fff;border:1px solid #dedede;border-radius:6px;padding:16px 18px;margin-bottom:14px}
      #payOverlay .pv-item{display:grid;grid-template-columns:64px minmax(0,1fr) 150px;gap:14px;align-items:center}
      #payOverlay .pv-item+.pv-item{margin-top:14px;padding-top:14px;border-top:1px solid #f0eeeb}
      #payOverlay .pv-th{width:64px;height:64px;border-radius:6px;flex:none;display:block;object-fit:cover;cursor:zoom-in;
        background:#f0ece6;border:1px solid #eae8e4}
      #payOverlay .pv-th:hover{border-color:#0052d9;box-shadow:0 0 0 2px rgba(0,82,217,.12)}
      #payOverlay .pv-nm{font-size:14px;font-weight:500}
      #payOverlay .pv-cd{font-size:12px;color:#a8a29e;margin-top:3px}
      #payOverlay .pv-price-wrap{display:flex;align-items:center;height:36px;border:1px solid #dcdcdc;border-radius:4px;background:#fff;overflow:hidden}
      #payOverlay .pv-price-wrap:focus-within{border-color:#0052d9;box-shadow:0 0 0 2px rgba(0,82,217,.1)}
      #payOverlay .pv-price-wrap.invalid{border-color:#d54941}
      #payOverlay .pv-price-prefix{padding-left:10px;color:#777}
      #payOverlay .pv-item-price{min-width:0;width:100%;height:100%;border:0;outline:0;padding:0 10px 0 5px;text-align:right;font:inherit;background:transparent}
      #payOverlay .pv-row{display:flex;justify-content:space-between;font-size:14px;color:#57534e;padding:6px 0}
      #payOverlay .pv-total{display:flex;justify-content:space-between;align-items:baseline;
        border-top:1px dashed #e2e0dc;margin-top:10px;padding-top:12px}
      #payOverlay .pv-total .v{font-size:24px;font-weight:700;color:#d54941}
      #payOverlay .pv-m{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1.5px solid #e2e0dc;
        border-radius:12px;margin-bottom:10px;cursor:pointer}
      #payOverlay .pv-m:hover{border-color:#a8a29e}
      #payOverlay .pv-m.on{border-color:#1c1917;box-shadow:0 0 0 1px #1c1917 inset}
      #payOverlay .pv-ic{width:30px;height:30px;border-radius:8px;flex:none;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:700}
      #payOverlay .pv-mn{flex:1;font-size:14px}
      #payOverlay .pv-tip{font-size:12px;color:#a8a29e}
      #payOverlay .pv-actions{margin-top:14px}
      #payOverlay .pv-pay,#payOverlay .pv-later{height:42px;border:1px solid transparent;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer}
      #payOverlay .pv-pay{display:block;width:100%;background:#0052d9;color:#fff}
      #payOverlay .pv-pay:hover{background:#266fe8}
      #payOverlay .pv-pay:disabled{cursor:wait;opacity:.68}
      #payOverlay .pv-later{display:grid;place-items:center;width:32px;height:32px;padding:0;background:transparent;border-color:transparent;color:#b7b7b7;font-size:17px;letter-spacing:1px}
      #payOverlay .pv-later:hover{background:transparent;color:#777}
      #payOverlay .pv-note{font-size:12px;color:#a8a29e;text-align:center;margin-top:10px}
      #payOverlay .pv-method-detail{margin:16px 0 14px;padding-top:16px;border-top:1px solid #f0eeeb}
      #payOverlay .pv-qr-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
      #payOverlay .pv-qr-head strong{font-size:14px}
      #payOverlay .pv-qr-head span{font-size:12px;color:#a8a29e}
      #payOverlay .pv-qr{width:184px;height:184px;margin:0 auto;padding:8px;border:1px solid #e2e0dc;border-radius:6px;background:#fff}
      #payOverlay .pv-qr img{display:block;width:100%;height:100%;object-fit:contain}
      #payOverlay .pv-qr-help{margin:10px 0 0;text-align:center;color:#57534e;font-size:12px}
      #payOverlay .pv-bank{display:grid;gap:0}
      #payOverlay .pv-bank-row{display:grid;grid-template-columns:76px minmax(0,1fr);gap:12px;padding:9px 0;
        border-bottom:1px solid #f0eeeb;font-size:13px}
      #payOverlay .pv-bank-row span{color:#a8a29e}
      #payOverlay .pv-bank-row strong{min-width:0;text-align:right;overflow-wrap:anywhere;font-weight:600}
      #payOverlay .pv-bank-note{margin:12px 0 0;color:#78716c;font-size:12px;line-height:1.6}
      @media(max-width:820px){
        #payOverlay .pv-box{height:min(820px,94dvh);max-height:94vh}
        #payOverlay .pv-body{grid-template-columns:1fr;overflow-y:auto}
        #payOverlay .pv-col{overflow:visible;padding-right:0}
      }`;
    document.head.appendChild(st);
    ov = document.createElement("div");
    ov.id = "payOverlay";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-hidden", "true");
    ov.innerHTML = `<div class="pv-scrim" data-pv-close></div>
      <div class="pv-box"><div class="pv-head"><div class="pv-title"><h3>确认并支付</h3><button class="pv-later" data-pv-later aria-label="暂不支付" title="暂不支付"><span aria-hidden="true">•••</span></button></div><button class="pv-x" data-pv-close>×</button></div>
      <div class="pv-body" id="pvBody"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target.closest("[data-pv-close]")) closePaymentOverlay(); });
  }
  const METHODS = [
    { k: "wechat", n: "微信支付", c: "#22ac38", t: "微" },
    { k: "bank", n: "对公转账", c: "#78716c", t: "公" },
  ];
  document.getElementById("pvBody").innerHTML = `
    <div class="pv-col">
      <div class="pv-card">${patterns.map((f) => {
        const c = sourceCardByFile(f);
        const nm = c?.querySelector(".work-head strong")?.textContent.trim() || f;
        const imageData = c?.dataset.imageData || "";
        const imageKey = c?.dataset.imageKey || f;
        const imageSource = imageData
          ? `src="${escapeHtml(imageData)}"`
          : `data-image-key="${escapeHtml(imageKey)}"`;
        const itemPrice = order.itemPrices[f];
        return `<div class="pv-item"><img class="pv-th" ${imageSource} alt="${escapeHtml(nm)}" width="64" height="64" data-pv-preview="${escapeHtml(f)}" title="点击预览">
          <div><div class="pv-nm">${escapeHtml(nm)}</div><div class="pv-cd">${Number(c?.dataset.colors || 1)} 配色</div></div>
          <label class="pv-price-wrap" aria-label="${escapeHtml(nm)}金额"><span class="pv-price-prefix">¥</span><input class="pv-item-price" data-pv-item-price="${escapeHtml(f)}" inputmode="decimal" autocomplete="off" placeholder="输入金额" value="${itemPrice == null ? "" : Number(itemPrice).toFixed(2)}"></label></div>`;
      }).join("")}
      <div class="pv-cd" style="margin-top:14px;padding-top:12px;border-top:1px solid #f0eeeb">订单编号 ${escapeHtml(order.id)}　·　共 ${patterns.length} 款花型</div></div>
      <div class="pv-card"><div style="font-size:14px;font-weight:600;margin-bottom:12px">选择支付方式</div>
        ${METHODS.map((m, i) => `<div class="pv-m ${i === 0 ? "on" : ""}" data-pv-method="${m.n}">
          <span class="pv-ic" style="background:${m.c}">${m.t}</span><span class="pv-mn">${m.n}</span>
          <span class="pv-tip">${m.k === "bank" ? "凭证由财务确认" : "扫码支付"}</span></div>`).join("")}
      </div>
    </div>
    <div class="pv-col">
      <div class="pv-card">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px">订单摘要</div>
        <div class="pv-row"><span>商品金额</span><span id="pvGoodsTotal">待输入</span></div>
        <div class="pv-row"><span>优惠金额</span><span>¥0.00</span></div>
        <div class="pv-total"><span style="font-size:15px;font-weight:600">应付金额</span><span class="v" id="pvPayableTotal">待输入</span></div>
        <div class="pv-method-detail" id="pvMethodDetail"></div>
        <div class="pv-actions"><button class="pv-pay" data-pv-confirm="${escapeHtml(order.id)}" disabled>确认并支付</button></div>
      </div>
    </div>`;
  const body = document.getElementById("pvBody");
  hydrateLazyKeyImages(body);
  const payBtn = body.querySelector("[data-pv-confirm]");
  const totalEl = document.getElementById("pvPayableTotal");
  const goodsEl = document.getElementById("pvGoodsTotal");
  const syncItemPrices = () => {
    let total = 0;
    let validCount = 0;
    body.querySelectorAll("[data-pv-item-price]").forEach((input) => {
      const raw = String(input.value || "").trim().replace(/[,\s¥￥]/g, "");
      const cents = moneyToCents(raw);
      const valid = raw !== "" && cents != null && cents >= 0 && cents <= 99999999999999;
      const value = valid ? centsToMoney(cents) : null;
      input.closest(".pv-price-wrap")?.classList.toggle("invalid", raw !== "" && !valid);
      order.itemPrices[input.dataset.pvItemPrice] = valid ? value : null;
      if (valid) { total += cents; validCount += 1; }
    });
    const complete = validCount === patterns.length && patterns.length > 0;
    order.price = complete ? centsToMoney(total) : null;
    if (complete) {
      order.patternPrices = { ...order.itemPrices };
      order.priceManuallySet = true;
    }
    const text = complete ? `¥${centsToMoney(total).toLocaleString("zh-CN", { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "待输入";
    if (goodsEl) goodsEl.textContent = text;
    if (totalEl) totalEl.textContent = text;
    if (payBtn) payBtn.disabled = !complete;
    renderPaymentMethodDetail(body, order, body.querySelector(".pv-m.on")?.dataset.pvMethod || METHODS[0].n);
  };
  body.querySelectorAll("[data-pv-item-price]").forEach((input) => {
    input.addEventListener("input", syncItemPrices);
    input.addEventListener("blur", saveStudioState);
  });
  body.querySelectorAll("[data-pv-preview]").forEach((thumb) => thumb.addEventListener("click", () => {
    openCustomerPatternViewer(thumb.dataset.pvPreview, { previewOnly: true, contextFiles: patterns });
  }));
  syncItemPrices();
  body.querySelectorAll("[data-pv-method]").forEach((el) => {
    el.addEventListener("click", () => {
      body.querySelectorAll(".pv-m").forEach((x) => x.classList.toggle("on", x === el));
      renderPaymentMethodDetail(body, order, el.dataset.pvMethod);
    });
  });
  renderPaymentMethodDetail(body, order, METHODS[0].n);
  body.querySelector("[data-pv-confirm]")?.addEventListener("click", () => {
    const confirmButton = body.querySelector("[data-pv-confirm]");
    if (confirmButton?.disabled) return;
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = "正在确认支付…";
    }
    const method = body.querySelector(".pv-m.on")?.dataset.pvMethod || "";
    window.setTimeout(() => confirmPaymentPaid(order, method), 180);
  });
  const payLaterButton = ov.querySelector("[data-pv-later]");
  if (payLaterButton) payLaterButton.onclick = () => {
    order.paymentStatus = "未支付";
    order.progress = "待支付";
    saveStudioState();
    closePaymentOverlay();
    if (typeof renderOrderCenter === "function") renderOrderCenter();
    if (typeof renderMyOrders === "function") renderMyOrders();
    showToast("订单已保留，可稍后继续支付。", "success");
  };
  logOrderEvent(order, "客户进入支付页", "客户");
  saveStudioState();
  ov.setAttribute("aria-hidden", "false");
  ov.classList.add("open");
  lockBodyScroll(true);
}

function drawPaymentQr(canvas, seedText) {
  if (!canvas) return;
  const size = 29;
  const ctx = canvas.getContext("2d");
  const scale = canvas.width / size;
  let seed = [...String(seedText || "KING")].reduce((n, ch) => (n * 33 + ch.charCodeAt(0)) >>> 0, 5381);
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (random() > 0.52) ctx.fillRect(Math.floor(x * scale), Math.floor(y * scale), Math.ceil(scale), Math.ceil(scale));
    }
  }
  const finder = (fx, fy) => {
    ctx.fillStyle = "#fff";
    ctx.fillRect((fx - 1) * scale, (fy - 1) * scale, 9 * scale, 9 * scale);
    ctx.fillStyle = "#111";
    ctx.fillRect(fx * scale, fy * scale, 7 * scale, 7 * scale);
    ctx.fillStyle = "#fff";
    ctx.fillRect((fx + 1) * scale, (fy + 1) * scale, 5 * scale, 5 * scale);
    ctx.fillStyle = "#111";
    ctx.fillRect((fx + 2) * scale, (fy + 2) * scale, 3 * scale, 3 * scale);
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
}

function renderPaymentMethodDetail(body, order, method) {
  const panel = body?.querySelector("#pvMethodDetail");
  if (!panel) return;
  if (method === "对公转账") {
    panel.innerHTML = `<div class="pv-qr-head"><strong>对公账户信息</strong><span>转账时请备注订单号</span></div>
      <div class="pv-bank">
        <div class="pv-bank-row"><span>收款公司</span><strong>KiNG DESiGN</strong></div>
        <div class="pv-bank-row"><span>开户银行</span><strong>中国工商银行股份有限公司南通城山路支行</strong></div>
        <div class="pv-bank-row"><span>银行账号</span><strong>1111821709100428739</strong></div>
        <div class="pv-bank-row"><span>转账金额</span><strong>${orderPriceText(order)}</strong></div>
      </div>
      <p class="pv-bank-note">请在转账附言中填写“${escapeHtml(order.id)}”。到账状态以财务核对结果为准。</p>`;
    return;
  }
  const isWechat = method === "微信支付";
  panel.innerHTML = `<div class="pv-qr-head"><strong>${method}案例二维码</strong><span>有效期 5 分钟</span></div>
    <div class="pv-qr"><img src="./assets/wechat-payment-qr.png" alt="${method}收款二维码" width="184" height="184"></div>
    <p class="pv-qr-help">请使用${isWechat ? "微信扫一扫" : "支付宝"}扫码完成付款</p>`;
}
function closePaymentOverlay() {
  const overlay = document.getElementById("payOverlay");
  overlay?.classList.remove("open");
  overlay?.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}
async function confirmPaymentPaid(order, method) {
  if (order.paymentStatus === "已支付") { closePaymentOverlay(); return; }
  await runWithAppLoading("正在确认支付结果…", async () => {
    order.paymentStatus = "已支付";
    order.paidAt = formatDateTime();
    order.paidAmount = orderPriceValue(order);
    order.paidMethod = method || "";
    logOrderEvent(order, `支付成功${method ? "（" + method + "）" : ""} · TEST 模拟`, "客户");
    saveStudioState();
  }, 520);
  closePaymentOverlay();
  renderOrderCenter();
  if (typeof renderMyOrders === "function") renderMyOrders();
  if (typeof renderMyPatternLibrary === "function") renderMyPatternLibrary();
  updateSidebarBadges();
  showToast("支付成功！花型已加入你的花型库，等待交付解锁。", "success");
  if (currentAccount.role === "客户") switchView("myLibrary");
}

// 从支付页返回后，应用支付结果（支付成功以此处入账为准）
function applyPendingPaymentResult() {
  let raw = null;
  try { raw = localStorage.getItem(PAY_RESULT_KEY); } catch {}
  if (!raw) return;
  try { localStorage.removeItem(PAY_RESULT_KEY); } catch {}
  let res = null;
  try { res = JSON.parse(raw); } catch { return; }
  if (!res?.orderId || !res.paid) return;
  const order = studioOrders.find((o) => o.id === res.orderId);
  if (!order || order.paymentStatus === "已支付") return;
  order.paymentStatus = "已支付";
  order.paidAt = res.at || formatDateTime();
  order.paidAmount = res.amount;
  order.paidMethod = res.method || "";
  logOrderEvent(order, `支付成功${res.method ? "（" + res.method + "）" : ""}${res.test ? " · TEST 模拟" : ""}`, "客户");
  saveStudioState();
  if (typeof renderOrderCenter === "function") renderOrderCenter();
  if (typeof renderMyOrders === "function") renderMyOrders();
  if (typeof renderMyPatternLibrary === "function") renderMyPatternLibrary();
  updateSidebarBadges();
  showToast(`订单 ${order.id} 支付成功，花型已加入你的花型库（待交付解锁）。`, "success");
}
window.addEventListener("focus", applyPendingPaymentResult);
// 兼容旧的跳页支付结果
document.addEventListener("DOMContentLoaded", () => setTimeout(applyPendingPaymentResult, 60));
window.addEventListener("load", () => setTimeout(applyPendingPaymentResult, 120));

/* 安全兜底：若遗留了看稿全屏遮罩但遮罩本身并未激活，会导致整页黑屏。启动时清理。 */
function clearStuckOverlays() {
  const viewerLib = document.querySelector("#viewerLibrary");
  const viewerEntry = document.querySelector("#viewerEntry");
  const libActive = viewerLib?.classList.contains("active");
  const entryActive = viewerEntry?.classList.contains("active");
  if (!libActive && !entryActive) {
    document.body.classList.remove("viewer-open");
    document.body.style.overflow = "";
  }
}
window.addEventListener("load", () => setTimeout(clearStuckOverlays, 150));
// 项目数据初始化 + 侧栏红点
document.addEventListener("DOMContentLoaded", () => {
  pjLoad();
  if (typeof renderProjectsView === "function") renderProjectsView();
  if (typeof updateProjectNavBadge === "function") updateProjectNavBadge();
});
function updateProjectNavBadge() {
  const nav = document.querySelector('.nav-item[data-view="projects"]');
  if (!nav) return;
  const n = pjProjects.filter((p) => !p.archived).reduce((s, p) => s + (pjUnreadCount(p) ? 1 : 0), 0);
  const over = pjProjects.filter((p) => !p.archived && (pjDaysLeft(p) ?? 99) < 0).length;
  const total = n + over;
  let d = nav.querySelector(".nav-dot");
  if (total > 0) {
    if (!d) { d = document.createElement("span"); d.className = "nav-dot"; nav.appendChild(d); }
    d.textContent = total > 99 ? "99+" : String(total);
  } else if (d) d.remove();
}

/* ============ 侧边栏小圆点通知 ============ */
function updateSidebarBadges() {
  const dot = (viewName, count) => {
    const nav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (!nav) return;
    let d = nav.querySelector(".nav-dot");
    if (count > 0) {
      if (!d) { d = document.createElement("span"); d.className = "nav-dot"; nav.appendChild(d); }
      d.textContent = count > 99 ? "99+" : String(count);
    } else if (d) d.remove();
  };
  const statusDot = (viewName, active, label) => {
    const nav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (!nav) return;
    nav.classList.toggle("has-status-dot", Boolean(active));
    if (active) nav.dataset.statusLabel = label;
    else delete nav.dataset.statusLabel;
  };
  const mine = studioOrders.filter(orderBelongsToCurrentAccount);
  const pendingReviewCount = currentAccount.role === "管理员"
    ? reviewItems().filter(isReviewPending).length
    : 0;
  statusDot("review", pendingReviewCount > 0, `${pendingReviewCount} 件稿件待评审`);
  if (currentAccount.role === "客户") {
    const todo = mine.filter((o) => moStage(o) === "paying").length;
    dot("myOrders", todo);
    // 花型库：新解锁的交付
    dot("myLibrary", mine.filter((o) => o.deliverStatus === "已交付" && !o.customerSeenDelivery).length);
  } else {
    // 员工端只提示客户产生的新动作，不把所有未交付订单长期当作未读。
    if (activeViewId() === "orders") {
      let changed = false;
      mine.forEach((order) => {
        if (Number(order.unreadForStaff || 0) > 0) {
          order.unreadForStaff = 0;
          changed = true;
        }
      });
      if (changed) saveStudioState();
    }
    const unreadOrders = mine.filter((order) => Number(order.unreadForStaff || 0) > 0).length;
    dot("orders", unreadOrders);
  }
}

/* ================= 客户端 · 订单中心 ================= */
const MO_PAGE_SIZE = 8;
let moFilter = "all";
let moSearch = "";
let moShown = MO_PAGE_SIZE;

// 客户订单的「流程阶段」——用于筛选与主按钮
function moStage(order) {
  const L = orderLifecycleModel(order);
  if (orderProgressStatus(order) === "已关闭") return "cancelled";
  if (L.delivered && L.payment === "paid") return "done";
  if (L.payment !== "paid") return "paying";
  return "delivering";
}
function moPrimaryAction(order) {
  const L = orderLifecycleModel(order);
  const stage = moStage(order);
  if (stage === "cancelled") return { label: "订单已取消", act: null, disabled: true };
  if (stage === "done") return { label: "订单已完成", act: null, disabled: true };
  if (stage === "paying") return { label: "立即支付", act: "pay", disabled: false };
  if (stage === "delivering") return L.delivered
    ? { label: "已交付", act: null, disabled: true }
    : { label: "等待交付", act: null, disabled: true };
  return { label: "订单进行中", act: null, disabled: true };
}
function moFilteredOrders() {
  const q = moSearch.trim().toLowerCase();
  return studioOrders.filter(orderBelongsToCurrentAccount).filter((o) => {
    if (moFilter !== "all" && moStage(o) !== moFilter) return false;
    if (!q) return true;
    return searchMatches(q, [o.id, ...orderPatternList(o)]);
  });
}
function renderMyOrders() {
  const list = document.querySelector("#moList");
  if (!list) return;
  const all = moFilteredOrders();
  const rows = all.slice(0, moShown);
  list.innerHTML = rows.length ? rows.map((o) => {
    const L = orderLifecycleModel(o);
    const patterns = orderPatternList(o);
    const first = sourceCardByFile(patterns[0]);
    const bg = first?.dataset.imageData ? `background-image:url('${first.dataset.imageData}')` : "";
    const name = patterns.length ? `${patterns[0]}${patterns.length > 1 ? ` 等 ${patterns.length} 款` : ""}` : "订单";
    const btn = moPrimaryAction(o);
    const ICON = {
      ok: `<svg viewBox="0 0 24 24" class="mo-ic"><path d="M20 6 9 17l-5-5"/></svg>`,
      wait: `<svg viewBox="0 0 24 24" class="mo-ic"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
      lock: `<svg viewBox="0 0 24 24" class="mo-ic"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>`,
      pen: `<svg viewBox="0 0 24 24" class="mo-ic"><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>`,
    };
    const tag = (icon, label, ok) => `<span class="mo-tag ${ok ? "ok" : ""}">${icon}${label}</span>`;
    return `<article class="mo-card">
      <div class="mo-cover" style="${bg}"></div>
      <div class="mo-main">
        <div class="mo-l1"><strong>${escapeHtml(name)}</strong></div>
        <div class="mo-l2">订单编号 ${escapeHtml(o.id)}　·　${escapeHtml(o.createdAt || "—")}　·　${patterns.length} 款花型</div>
        <div class="mo-tags">
          ${tag(L.payment === "paid" ? ICON.ok : ICON.wait, OD_LABELS.payment[L.payment], L.payment === "paid")}
          ${tag(L.delivered ? ICON.ok : ICON.lock, OD_LABELS.delivery[L.delivery], L.delivered)}
        </div>
      </div>
      <div class="mo-right">
        <div class="mo-price ${orderPriceValue(o) == null ? "todo" : ""}">${orderPriceText(o)}</div>
        <button class="mo-btn ${btn.disabled ? "wait" : ""}" type="button" ${btn.disabled ? "disabled" : ""} data-mo-act="${btn.act || ""}" data-mo-id="${escapeHtml(o.id)}">${btn.label}</button>
      </div>
    </article>`;
  }).join("") : `<p class="empty-state">${moSearch || moFilter !== "all" ? "没有符合条件的订单。" : "还没有订单。完成选稿后，订单会出现在这里。"}</p>`;
  const more = document.querySelector("#moLoadMore");
  if (more) {
    const hasMore = all.length > moShown;
    more.classList.toggle("hidden", !hasMore);
    more.textContent = `加载更多订单（还有 ${Math.max(all.length - moShown, 0)} 条）`;
  }
}
document.querySelector("#moTabs")?.addEventListener("click", (e) => {
  const tab = e.target.closest("[data-mo-filter]");
  if (!tab) return;
  moFilter = tab.dataset.moFilter; moShown = MO_PAGE_SIZE;
  document.querySelectorAll("#moTabs .mo-tab").forEach((t) => t.classList.toggle("on", t === tab));
  renderMyOrders();
});
document.querySelector("#moSearch")?.addEventListener("input", (e) => {
  moSearch = e.target.value; moShown = MO_PAGE_SIZE; renderMyOrders();
});
document.querySelector("#moLoadMore")?.addEventListener("click", () => { moShown += MO_PAGE_SIZE; renderMyOrders(); });
document.querySelector("#moList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-mo-act]");
  if (btn) {
    e.stopPropagation();
    const order = studioOrders.find((o) => o.id === btn.dataset.moId);
    if (!order) return;
    const act = btn.dataset.moAct;
    if (act === "pay") openPaymentPage(order);
    return;
  }
});

function onOrderDetailAction(action, order) {
  const refresh = (msg) => {
    saveStudioState(); renderOrderCenter();
    if (typeof renderMyOrders === "function") renderMyOrders();
    renderOrderDetailBody(order);
    if (msg) showToast(msg, "success");
  };
  if (action === "pay") {
    closeOrderDetail();
    openPaymentPage(order);
  } else if (action === "toggle-deliver") {
    order.deliverStatus = orderDeliverStatus(order) === "已交付" ? "未交付" : "已交付";
    logOrderEvent(order, `订单已标记为${order.deliverStatus}`, currentAccount.role || "员工");
    refresh(`订单 ${order.id} 已标记为${order.deliverStatus}。`);
  } else if (action === "download") {
    logOrderEvent(order, "客户下载了交付文件", "客户");
    refresh("已生成 30 分钟短期下载链接（TEST 占位）。");
  }
}

function closeOrder(orderId) {
  const order = studioOrders.find((item) => item.id === orderId);
  if (!order || orderProgressStatus(order) === "已关闭") return;
  const confirmed = window.confirm(`确认关闭订单 ${order.id}？关闭后，订单里的设计稿会回到客户稿库。`);
  if (!confirmed) return;
  order.status = "已关闭";
  order.progress = "已关闭 / 客户取消需求";
  order.closedAt = formatDateTime();
  order.note = `${order.note || ""} 订单已关闭，稿件已释放回客户稿库。`.trim();
  (order.files || []).forEach((file) => {
    const card = sourceCardByFile(file);
    if (!card) return;
    setBadgeText(card, "客户状态：", "未进入客户选稿", "sale-badge unsold");
  });
  recordActivityNotification({
    type: "order-close",
    title: "订单已关闭",
    text: `${currentAccount.name || currentAccount.role} 关闭了订单「${order.id}」`,
    relatedOwners: orderParticipantKeys((order.files || []).map(sourceCardByFile).filter(Boolean)).designers || [],
    adminOnly: !isAdministrator(),
  });
  saveStudioState();
  renderOrderCenter();
  renderLibraryGrid();
  renderLibraryCart();
  showToast(`${order.id} 已关闭，稿件已回到客户稿库。`, "success");
}

function deleteStudioOrder(orderId) {
  const order = studioOrders.find((item) => item.id === orderId);
  if (!order) return;
  if (!window.confirm(`确认删除订单 ${order.id}？此操作不可恢复。`)) return;
  studioOrders = studioOrders.filter((item) => item.id !== orderId);
  saveStudioState();
  renderOrderCenter();
  showToast(`订单 ${order.id} 已删除。`, "success");
}

function advanceOrderStatus(orderId) {
  const order = studioOrders.find((item) => item.id === orderId);
  if (!order || currentAccount.role !== "管理员") return;
  const current = orderProgressStatus(order);
  if (current === "待评审" && !orderFilesReady(order)) {
    showToast("所有设计稿都变成“等待交付”后，订单才能完成。", "warning");
    return;
  }
  const next = nextOrderStatus(order);
  order.status = next;
  order.progress = next;
  order.note = next === "已完成" ? `${order.note || ""} 管理员已确认交付完成。`.trim() : order.note;
  saveStudioState();
  renderOrderCenter();
  showToast(`${order.id} 已更新为 ${next}。`, "success");
}

function addOrderTag(orderId) {
  const order = studioOrders.find((item) => item.id === orderId);
  if (!order) return;
  const tag = window.prompt("请输入客户订单标签");
  if (!tag) return;
  const cleanTag = tag.trim();
  if (!cleanTag) return;
  order.tags = [...new Set([...(order.tags || []), cleanTag])].slice(0, 8);
  if (!globalTags.includes(cleanTag) && !retiredDefaultTags.includes(cleanTag)) globalTags.push(cleanTag);
  saveStudioState();
  renderOrderCenter();
  showToast(`已为 ${order.id} 添加标签：${cleanTag}`, "success");
}

function activeOrder() {
  return activeOrderFileContext ? studioOrders.find((order) => order.id === activeOrderFileContext.orderId) : null;
}

function renderOrderFilePanel() {
  const order = activeOrder();
  const file = activeOrderFileContext?.file;
  if (!order || !file) return;
  const states = ensureOrderFileStates(order);
  const state = states[file] || "未审核";
  const linkedFolder = order.fileLinks?.[file];
  orderFileStateButton.textContent = state;
  orderFileStateButton.classList.toggle("ready", state === "等待交付");
  orderFileStateButton.disabled = !["管理员", "销售"].includes(currentAccount.role);
  orderFileUploadButton.textContent = linkedFolder ? "查看文件夹" : "关联文件夹";
  orderFileStatus.textContent = linkedFolder ? `交付文件夹：${linkedFolder}` : "未关联交付文件夹";
}

function toggleOrderFileState() {
  const order = activeOrder();
  const file = activeOrderFileContext?.file;
  if (!order || !file) return;
  const states = ensureOrderFileStates(order);
  states[file] = states[file] === "未审核" ? "等待交付" : "未审核";
  if (states[file] === "等待交付" && orderProgressStatus(order) === "进行中") {
    order.status = "待评审";
    order.progress = "待评审";
  }
  saveStudioState();
  renderOrderFilePanel();
  renderOrderCenter();
  showToast(`${file} 已更新为 ${states[file]}。`, "success");
}

function attachOrderFileLink(fileList) {
  const order = activeOrder();
  const file = activeOrderFileContext?.file;
  const selected = fileList?.[0];
  if (!order || !file || !selected) return;
  if (!order.fileLinks) order.fileLinks = {};
  order.fileLinks[file] = selected.webkitRelativePath ? selected.webkitRelativePath.split("/")[0] : selected.name;
  if (orderProgressStatus(order) === "已确认下单") {
    order.status = "进行中";
    order.progress = "进行中";
  }
  saveStudioState();
  renderOrderFilePanel();
  renderOrderCenter();
  showToast(`${file} 已关联交付文件夹。`, "success");
}

function renderCustomerReviewNote(card) {
  activeReviewAction = "客户修改意见";
  reviewNotePanel.classList.remove("hidden");
  reviewNoteLabel.textContent = "客户修改意见";
  reviewNoteText.placeholder = "记录客户看稿时提出的修改意见";
  const today = dateKey(new Date());
  const log = reviewLogs(card).find((item) => item.date === today && item.action === activeReviewAction);
  reviewNoteText.value = log?.note || "";
  renderReviewLogList(card);
}

async function appendReferenceFiles(card, files) {
  const imageFiles = acceptedUploadFiles(files, {
    label: "参考图",
    maxBytes: MAX_IMAGE_FILE_BYTES,
    imageOnly: true,
    extensions: SUPPORTED_IMAGE_EXTENSIONS,
  });
  if (!card || !imageFiles.length) return;
  const keys = getReferenceKeys(card);
  for (let index = 0; index < imageFiles.length; index += 1) {
    const key = normalizeStudioAssetBaseKey(`${card.dataset.file}__reference_${keys.length + index + 1}_${Date.now()}`, 230);
    await saveImageToDB(key, imageFiles[index]);
    keys.push(key);
  }
  card.dataset.referenceKeys = JSON.stringify(keys);
  updateCardReferenceMaterial(card, `参考图 ${keys.length} 张`);
  markWorkRecordDirty(card);
  saveStudioState();
  renderReferenceMaterials(card);
  showToast(`已为 ${card.dataset.file} 添加 ${imageFiles.length} 张参考图。`, "success");
}

function syncReviewCardPreviews() {
  document.querySelectorAll(".review-work-card[data-review-file]").forEach((reviewCard) => {
    const sourceCard = sourceCardByFile(reviewCard.dataset.reviewFile);
    const reviewTrigger = reviewCard.querySelector(".preview-trigger");
    if (!sourceCard || !reviewTrigger) return;
    reviewTrigger.classList.add("has-image");
    reviewTrigger.dataset.imageShell = "true";
    let image = reviewTrigger.querySelector("img");
    if (!image) {
      image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.fetchPriority = "low";
      reviewTrigger.prepend(image);
    }
    const source = cardPreviewSource(sourceCard);
    if (source) image.src = source;
    else if (sourceCard.dataset.imageKey) {
      image.dataset.imageKey = sourceCard.dataset.imageKey;
      delete image.dataset.imageQueued;
      hydrateLazyKeyImages(reviewTrigger);
    }
    const colorCount = Number(sourceCard.dataset.colors || 1);
    reviewTrigger.querySelector(".color-count")?.remove();
    const badge = document.createElement("span");
    badge.className = "color-count";
    badge.textContent = `配色 ${colorCount}`;
    reviewTrigger.appendChild(badge);
  });
}

function isReviewPending(card) {
  if (card.dataset.reviewState) return card.dataset.reviewState === "pending" && !isSleepingWork(card);
  const summary = cardStatusSummary(card);
  return !reviewLogs(card).length && !card.dataset.reviewAction && !summary.includes("已通过") && !summary.includes("已出售") && !isSleepingWork(card);
}

function isApprovedSharedWork(card) {
  if (!card || card.classList.contains("deleted") || isSleepingWork(card)) return false;
  const reviewState = String(card.dataset.reviewState || "").trim();
  if (reviewState === "approved") return true;
  const reviewAction = String(reviewLogs(card)[0]?.action || card.dataset.reviewAction || "").trim();
  if (reviewAction) return reviewAction === "通过";
  const summary = cardStatusSummary(card);
  return ["已通过", "已出售", "交付中", "完结"].some((status) => summary.includes(status));
}

function reviewItems() {
  return [...workCards].filter(
    (card) =>
      !card.classList.contains("deleted") &&
      !isSleepingWork(card) &&
      ["设计师", "手绘师"].includes(card.dataset.workRole)
  );
}

function reviewDisplayDate(card) {
  // The calendar represents the submission batch, not the day an admin
  // happened to review it. A revision gets a new batch date; a late review
  // remains discoverable under its original submission date.
  return dateKey(card.dataset.resubmittedAt || card.dataset.createdAt || card.dataset.version);
}

function reviewDateText(key) {
  const today = dateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === today) return "今天";
  if (key === dateKey(yesterday)) return "昨天";
  const [year, month, day] = key.split("-");
  return Number(year) === new Date().getFullYear() ? `${Number(month)}月${Number(day)}日` : `${year}.${month}.${day}`;
}

function reviewResultMeta(card) {
  const action = reviewLogs(card)[0]?.action || card.dataset.reviewAction || "";
  if (action === "修改") return { label: "需修改", tone: "revision" };
  if (action === "通过") return { label: "通过", tone: "approved" };
  if (action === "休眠" || action === "Pass") return { label: "休眠", tone: "rejected" };
  if (card.dataset.reviewState === "approved" || cardStatusSummary(card).includes("已通过")) {
    return { label: "通过", tone: "approved" };
  }
  return { label: "已评审", tone: "reviewed" };
}

function renderReviewCalendar() {
  if (!reviewCalendar) return;
  const today = dateKey(new Date());
  reviewDateInput.value = activeReviewDate;
  reviewDateInput.max = today;
  reviewDateLabel.textContent = reviewDateText(activeReviewDate);
  reviewNextDay.disabled = activeReviewDate >= today;
  const todayPending = reviewItems().filter((card) => isReviewPending(card) && reviewDisplayDate(card) === today).length;
  reviewTodayCount.textContent = todayPending;
  reviewTodayCount.title = `今天 ${todayPending} 件待评审`;
}

function reviewCardHtml(card) {
  const colorCount = Number(card.dataset.colors || 1);
  const previewSource = cardPreviewSource(card);
  const imageKey = card.dataset.imageKey || "";
  const pending = isReviewPending(card);
  const result = pending ? { label: "待评审", tone: "pending" } : reviewResultMeta(card);
  const submittedDate = reviewDisplayDate(card);
  const initialDate = dateKey(card.dataset.createdAt || card.dataset.version);
  const reviewedDate = reviewLogs(card)[0]?.date || "";
  const round = Math.max(1, Number(card.dataset.submissionRound || 1));
  const timingHint = round > 1
    ? `第 ${round} 版 · 初稿 ${reviewDateText(initialDate)}`
    : reviewedDate && reviewedDate !== submittedDate
      ? `提交 ${reviewDateText(submittedDate)} · 处理 ${reviewDateText(reviewedDate)}`
      : `提交 ${reviewDateText(submittedDate)}`;
  return `<article class="review-work-card${pending ? "" : ` reviewed reviewed-${result.tone}`}" data-review-file="${card.dataset.file}">
    <button class="preview-trigger has-image" type="button" data-image-shell aria-label="查看 ${card.dataset.file}">
      ${previewSource
        ? `<img src="${escapeHtml(previewSource)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`
        : imageKey
          ? `<img data-image-key="${escapeHtml(imageKey)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`
          : ""}
      <span class="color-count">配色 ${colorCount}</span>
      <span class="review-result-badge ${result.tone}">${result.label}</span>
    </button>
    <button class="work-trash-button" type="button" data-delete-file="${escapeHtml(card.dataset.file)}" aria-label="将 ${escapeHtml(card.dataset.file)} 移入回收站" title="移入回收站"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg></button>
    <div class="review-hover-info" aria-hidden="true">
      <strong>${escapeHtml(card.dataset.file)}</strong>
      <span>上传者：${escapeHtml(workOwnerName(card))}</span>
      <span>${escapeHtml(timingHint)}</span>
    </div>
  </article>`;
}

const REVIEW_RENDER_BATCH = 24;
let reviewRenderLimit = REVIEW_RENDER_BATCH;

function renderDailyReviewBoard() {
  if (!reviewBoard) return;
  renderReviewCalendar();
  reviewWorkTypeSwitch?.querySelectorAll("[data-review-worktype]").forEach((button) =>
    button.classList.toggle("active", button.dataset.reviewWorktype === activeReviewWorkType)
  );
  reviewWorkTypeSwitch?.classList.toggle("show-painter", activeReviewWorkType === "手绘师");
  const dateItems = reviewItems()
    .filter((card) => card.dataset.workRole === activeReviewWorkType)
    .filter((card) => reviewDisplayDate(card) === activeReviewDate);
  const pendingItems = dateItems.filter(isReviewPending);
  const reviewedItems = dateItems.filter((card) => !isReviewPending(card));
  reviewPendingCount.textContent = pendingItems.length;
  reviewedCount.textContent = reviewedItems.length;
  reviewAllCount.textContent = dateItems.length;
  reviewStatusTabs.querySelectorAll("[data-review-filter]").forEach((button) => button.classList.toggle("active", button.dataset.reviewFilter === activeReviewFilter));
  const items = dateItems
    .filter((card) => activeReviewFilter === "all" || (activeReviewFilter === "pending" ? isReviewPending(card) : !isReviewPending(card)))
    .sort((a, b) => new Date(b.dataset.version) - new Date(a.dataset.version));
  const emptyLabel = activeReviewFilter === "pending" ? "待评审" : activeReviewFilter === "reviewed" ? "已评审" : "评审";
  const workTypeLabel = activeReviewWorkType === "手绘师" ? "手绘稿" : "设计稿";
  const visibleItems = items.slice(0, reviewRenderLimit);
  reviewBoard.innerHTML = items.length
    ? `${visibleItems.map(reviewCardHtml).join("")}${visibleItems.length < items.length
      ? `<button class="gallery-auto-load-sentinel" type="button" data-gallery-auto-load data-review-load-more tabindex="-1" aria-hidden="true"></button>`
      : ""}`
    : `<p class="empty-state review-empty-state">无</p>`;
  hydrateLazyKeyImages(reviewBoard);
  observeGalleryAutoLoad(reviewBoard);
  updateSidebarBadges();
}

function lightboxImageFitScale() {
  if (!lightboxOriginalImage?.naturalWidth || !lightboxOriginalImage?.naturalHeight) return 1;
  const width = lightboxImage.clientWidth || 1;
  const height = lightboxImage.clientHeight || 1;
  return Math.min(1, width / lightboxOriginalImage.naturalWidth, height / lightboxOriginalImage.naturalHeight);
}

function setLightboxOriginalSource(source) {
  if (!lightboxOriginalImage) return;
  const nextSource = String(source || "");
  if (!nextSource) {
    lightboxOriginalImage.hidden = true;
    lightboxOriginalImage.removeAttribute("src");
    lightboxOriginalImage.style.transform = "";
    return;
  }
  lightboxOriginalImage.hidden = false;
  if (lightboxOriginalImage.getAttribute("src") !== nextSource) lightboxOriginalImage.src = nextSource;
}

function applyPreviewZoom() {
  lightboxImage.dataset.zoomed = previewZoom > 1.01 ? "true" : "false";
  lightboxImage.removeAttribute("title");
  const zoomLevel = lightbox.querySelector(".lightbox-zoom-level");
  const pixelScale = lightboxImageFitScale() * previewZoom;
  if (zoomLevel) zoomLevel.textContent = lightboxOriginalImage?.hidden ? `${Math.round(previewZoom * 100)}%` : `${Math.round(pixelScale * 100)}%`;
  if (lightboxImage.classList.contains("has-image")) {
    lightboxImage.style.backgroundImage = "";
    lightboxImage.style.backgroundPosition = "center";
    lightboxImage.style.transform = "";
    lightboxOriginalImage.style.transform = `matrix(${previewZoom}, 0, 0, ${previewZoom}, ${previewOffsetX}, ${previewOffsetY})`;
    return;
  } else {
    if (lightboxOriginalImage) lightboxOriginalImage.style.transform = "";
    const tileSize = Math.round(120 * previewZoom);
    lightboxImage.style.backgroundSize = `${tileSize}px ${tileSize}px, cover`;
  }
  lightboxImage.style.transform = "";
  lightboxImage.style.backgroundPosition = `calc(50% + ${previewOffsetX}px) calc(50% + ${previewOffsetY}px), center`;
}

let previewImageRequestId = 0;

async function applyVariant(card, variant) {
  const requestId = ++previewImageRequestId;
  const sourcePattern = card.querySelector(".preview-trigger");
  // 从预览、缩略图到原始文件逐级回退，回收站也能读取完整图片。
  const imageData = await resolveFirstWorkImage(card, variant - 1);
  const activeCard = activeLightboxCards()[activePreviewIndex];
  if (requestId !== previewImageRequestId || activeCard !== card || activeMediaKind !== "palette" || activeVariant !== variant) return;
  if (variant === 1 && imageData && !card.dataset.imageData) card.dataset.imageData = imageData;
  const paletteEntry = getPaletteFiles(card)[variant - 1];
  const canPreview = variant === 1 || isPreviewablePaletteData(imageData, paletteEntry);
  lightboxImage.className = imageData && canPreview
    ? "lightbox-image has-image"
    : imageData
      ? "lightbox-image palette-file-placeholder"
      : `lightbox-image ${sourcePattern.className.replace("preview-trigger", "").trim()} ${
        variant > 1 ? `variant-${variant}` : ""
      }`;
  lightboxImage.dataset.fileType = imageData && !canPreview ? paletteFileExtension({ name: paletteEntry?.name || "FILE" }) : "";
  setLightboxOriginalSource(imageData && canPreview ? imageData : "");
  lightboxImage.style.backgroundImage = "";
  applyPreviewZoom();
}

async function applyWorkImage(card, index) {
  const requestId = ++previewImageRequestId;
  const entry = previewWorkImageEntries(card)[index];
  const imageData = await resolveWorkImageEntry(entry, { preferOriginal: true });
  const activeCard = activeLightboxCards()[activePreviewIndex];
  if (requestId !== previewImageRequestId || activeCard !== card || activeMediaKind !== "image" || activeWorkImageIndex !== index) return;
  const sourcePattern = card.querySelector(".preview-trigger");
  lightboxImage.className = imageData
    ? "lightbox-image has-image"
    : `lightbox-image ${sourcePattern?.className.replace("preview-trigger", "").trim() || ""}`;
  lightboxImage.dataset.fileType = "";
  setLightboxOriginalSource(imageData);
  lightboxImage.style.backgroundImage = "";
  applyPreviewZoom();
}

/* ============ 预览：手绘素材（配色与参考图之间） ============ */
function getLinkedSketches(card) {
  try {
    const v = JSON.parse(card.dataset.linkedSketches || "[]");
    if (Array.isArray(v) && v.length) return [...new Set(v.filter(Boolean))];
  } catch {}

  // 兼容设计师上传页原先写入“引用手绘”文字的已有稿件。
  const linkedText = fieldValue(card, "引用手绘");
  if (!linkedText || linkedText === "无引用 / 原创设计") return [];
  return [...new Set(
    painterWorkCatalog()
      .filter((item) => linkedText.includes(item.file))
      .map((item) => item.file)
  )];
}
function setLinkedSketches(card, list) {
  const files = [...new Set(list.filter(Boolean))];
  card.dataset.linkedSketches = JSON.stringify(files);
  const catalog = painterWorkCatalog();
  const linkedText = files.length
    ? files.map((file) => {
      const item = catalog.find((entry) => entry.file === file);
      return `${item?.painter || "手绘师"} / ${file}`;
    }).join("、")
    : "无引用 / 原创设计";
  updateCardLinkedPainter(card, linkedText);
  markWorkRecordDirty(card);
  saveStudioState();
}

function createPreviewMediaOption({ label, active = false, thumbClass = "", loadThumbnail, onSelect, removeTitle = "", onRemove }) {
  const option = document.createElement("button");
  option.type = "button";
  option.className = `palette-option ${active ? "active" : ""}`;
  option.setAttribute("aria-label", `查看${label}`);
  option.innerHTML = `<span class="palette-thumb ${thumbClass}"></span><span class="palette-name">${escapeHtml(label)}</span>`;
  const thumb = option.querySelector(".palette-thumb");
  loadThumbnail?.(thumb);
  option.addEventListener("click", onSelect);
  if (onRemove) {
    const removeButton = document.createElement("span");
    removeButton.className = "palette-remove";
    removeButton.setAttribute("role", "button");
    removeButton.setAttribute("aria-label", removeTitle || "删除");
    removeButton.title = removeTitle;
    removeButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg>`;
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onRemove(event);
    });
    option.appendChild(removeButton);
  }
  return option;
}

function createPreviewMediaAddOption(label, onSelect) {
  const option = document.createElement("button");
  option.type = "button";
  option.className = "palette-option palette-add-tile";
  option.innerHTML = `<span class="media-add-visual"><i>＋</i></span><span class="palette-name">${escapeHtml(label)}</span>`;
  option.addEventListener("click", onSelect);
  return option;
}
/** 手绘稿库：所有手绘师作品 */
function sketchLibraryCards() {
  return [...workCards].filter((card) =>
    (card.dataset.workRole === "手绘师" || card.dataset.role === "手绘师")
    && !card.dataset.deletedAt
    && !card.classList.contains("deleted")
  );
}
function renderSketchOptions(card) {
  const panel = document.querySelector("#sketchPanel");
  const box = document.querySelector("#sketchOptions");
  const countEl = document.querySelector("#sketchCount");
  if (!panel || !box) return;
  // 手绘稿本身不显示这个面板
  if (card.dataset.workRole === "手绘师" || card.dataset.role === "手绘师") {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  const links = getLinkedSketches(card);
  const canEdit = canEditWorkMetadata(card);
  const keepVisibleInWorksLibrary = lightboxWorksLibraryContext;
  if (!links.length && !canEdit && !keepVisibleInWorksLibrary) {
    panel.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  if (countEl) countEl.textContent = links.length ? `共 ${links.length} 个手绘稿` : "未关联";

  box.innerHTML = "";
  if (!links.length && !canEdit && keepVisibleInWorksLibrary) {
    box.innerHTML = `<p class="preview-media-empty">未关联手绘素材</p>`;
    return;
  }
  links.forEach((file) => {
    const src = sourceCardByFile(file);
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "palette-option";
    opt.innerHTML = `<span class="palette-thumb"></span><span class="palette-name">${escapeHtml(file)}</span>
      ${canEdit ? `<span class="palette-remove" data-sketch-remove="${escapeHtml(file)}" role="button" aria-label="删除手绘素材" title="删除手绘素材"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg></span>` : ""}`;
    const th = opt.querySelector(".palette-thumb");
    const directPreview = cardPreviewSource(src);
    if (directPreview) {
      th.style.backgroundImage = `url('${directPreview}')`;
    } else if (src?.dataset.imageKey) {
      resolveImageSource(src.dataset.imageKey).then((imageData) => {
        if (imageData) th.style.backgroundImage = `url("${imageData}")`;
      });
    }
    opt.addEventListener("click", (e) => {
      if (e.target.closest("[data-sketch-remove]")) {
        setLinkedSketches(card, getLinkedSketches(card).filter((f) => f !== file));
        renderSketchOptions(card);
        showToast("已移除该手绘稿。", "success");
        return;
      }
      markReviewMediaViewed(card, "sketch", links.indexOf(file));
      if (src) {
        lightboxBackStack.push({
          cards: [...lightboxCardSet],
          index: activePreviewIndex,
          variant: activeVariant,
          mediaKind: activeMediaKind,
          workImageIndex: activeWorkImageIndex,
          viewerContext: lightboxViewerContext,
          worksLibraryContext: lightboxWorksLibraryContext,
          zoom: previewZoom,
          offsetX: previewOffsetX,
          offsetY: previewOffsetY,
        });
        // 关联手绘稿属于当前作品详情的第二层预览，继承作品库展示模式；
        // 否则设计师/手绘师会重新落回旧版评审状态面板。
        openLightbox(src, { nested: true, worksLibrary: lightboxWorksLibraryContext });
      }
    });
    box.appendChild(opt);
  });
  if (canEdit) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "palette-option palette-add-tile";
    add.innerHTML = `<span class="media-add-visual"><i>＋</i></span><span class="palette-name">添加手绘稿</span>`;
    add.addEventListener("click", () => openSketchPicker(card));
    box.appendChild(add);
  }
}
/** 从手绘稿库快捷选择 */
function openSketchPicker(card) {
  const catalog = painterWorkCatalog();
  const selection = getLinkedSketches(card)
    .map((file) => catalog.find((item) => item.file === file))
    .filter(Boolean);
  openPainterPickerModal({
    selection,
    onConfirm: (items) => {
      setLinkedSketches(card, items.map((item) => item.file));
      renderSketchOptions(card);
      showToast(`已关联 ${items.length} 幅手绘稿。`, "success");
    },
  });
}

function renderPaletteOptions(card) {
  if (workRoleName(card) === "手绘师") {
    paletteOptions.innerHTML = "";
    palettePanel.classList.add("hidden");
    return;
  }
  const colorCount = Math.max(0, Number(card.dataset.colors || 0));
  paletteOptions.innerHTML = "";
  palettePanel.classList.remove("hidden");
  paletteCount.textContent = `共 ${colorCount} 个配色`;
  const paletteFiles = getPaletteFiles(card);
  const canEditPalette = canEditWorkMetadata(card);
  for (let index = 1; index <= colorCount; index += 1) {
    const sourcePattern = card.querySelector(".preview-trigger");
    const paletteEntry = paletteFiles[index - 1];
    const option = createPreviewMediaOption({
      label: index === 1 ? "主配色" : paletteEntry?.name || `配色 ${index}`,
      active: activeMediaKind === "palette" && index === activeVariant,
      thumbClass: `${sourcePattern.className.replace("preview-trigger", "").trim()} ${index > 1 ? `variant-${index}` : ""}`,
      loadThumbnail: (thumb) => {
        if (!workImageCandidateKeys(card, index - 1).length) return;
        resolveFirstWorkImage(card, index - 1).then((imageData) => {
          if (!imageData || !thumb.isConnected) return;
          if (isPreviewablePaletteData(imageData, paletteEntry)) {
            thumb.className = "palette-thumb";
            thumb.style.backgroundImage = `url("${imageData}")`;
          } else {
            thumb.className = "palette-thumb palette-file-type";
            thumb.textContent = paletteFileExtension({ name: paletteEntry?.name || "FILE" });
          }
        });
      },
      onSelect: () => {
        activeMediaKind = "palette";
        activeVariant = index;
        markReviewMediaViewed(card, "palette", index);
        previewZoom = 1;
        previewOffsetX = 0;
        previewOffsetY = 0;
        renderPaletteOptions(card);
        renderWorkImageOptions(card);
        if (typeof renderSketchOptions === "function") renderSketchOptions(card);
        applyVariant(card, activeVariant);
        updateLightboxMediaMeta(card);
      },
      removeTitle: "删除该配色",
      onRemove: canEditPalette ? () => deletePaletteVariant(card, index) : null,
    });
    paletteOptions.appendChild(option);
  }

  if (canEditPalette) {
    paletteOptions.appendChild(createPreviewMediaAddOption("添加配色", () => {
      paletteFileTargetCard = card;
      paletteFileInput.value = "";
      paletteFileInput.click();
    }));
  }
}

function renderWorkImageOptions(card) {
  const entries = previewWorkImageEntries(card);
  // 管理员在每日评审中可以补充或删除稿件图片。
  const canEditImages = canEditWorkMetadata(card)
    || (currentAccount.role === "管理员" && activeViewId() === "review");
  workImagePanel?.classList.toggle("hidden", !entries.length && !canEditImages);
  if (!workImageOptions) return;
  if (workImageCount) workImageCount.textContent = `共 ${entries.length} 张图片`;
  workImageOptions.innerHTML = "";
  entries.forEach((entry, index) => {
    const purpose = uploadPurposeLabel(normalizeUploadPurposeValue(entry.purpose, index === 0 ? "主图" : `补充图 ${index + 1}`));
    workImageOptions.appendChild(createPreviewMediaOption({
      label: purpose,
      active: activeMediaKind === "image" && index === activeWorkImageIndex,
      loadThumbnail: (thumb) => resolveWorkImageEntry(entry).then((imageData) => {
        if (imageData && thumb.isConnected) thumb.style.backgroundImage = `url("${imageData}")`;
      }),
      onSelect: () => {
        markReviewMediaViewed(card, "image", index);
        activeMediaKind = "image";
        activeWorkImageIndex = index;
        previewZoom = 1;
        previewOffsetX = 0;
        previewOffsetY = 0;
        renderWorkImageOptions(card);
        renderPaletteOptions(card);
        applyWorkImage(card, activeWorkImageIndex);
        updateLightboxMediaMeta(card);
      },
      removeTitle: "删除该图片",
      onRemove: canEditImages ? () => deleteWorkImage(card, index) : null,
    }));
  });
  if (canEditImages) {
    workImageOptions.appendChild(createPreviewMediaAddOption("添加图片", () => {
      workImageAddTargetCard = card;
      workImageAddInput.value = "";
      workImageAddInput.click();
    }));
  }
}

function deleteWorkImage(card, index) {
  const canEditImages = canEditWorkMetadata(card)
    || (currentAccount.role === "管理员" && activeViewId() === "review");
  if (index < 0 || !canEditImages) return;
  const storedEntries = getWorkImageEntries(card);
  const entries = storedEntries.length ? storedEntries : previewWorkImageEntries(card);
  if (index >= entries.length) return;
  entries.splice(index, 1);
  card.dataset.workImages = JSON.stringify(entries);
  card.dataset.workImagesCleared = entries.length ? "false" : "true";
  activeWorkImageIndex = Math.min(activeWorkImageIndex, Math.max(0, entries.length - 1));
  setReviewLog(card, "图片删除", `删除了图片 ${index + 1}`, { setCurrent: false });
  markWorkRecordDirty(card);
  saveStudioState();
  renderWorkImageOptions(card);
  applyWorkImage(card, activeWorkImageIndex);
  updateLightboxMediaMeta(card);
  renderDailyReviewBoard();
  showToast("已删除该图片。", "success");
}

async function appendWorkImages(card, files) {
  const imageFiles = acceptedUploadFiles(files, {
    label: "作品图片",
    maxBytes: MAX_IMAGE_FILE_BYTES,
    imageOnly: true,
    extensions: SUPPORTED_IMAGE_EXTENSIONS,
  });
  if (!card || !imageFiles.length) return;
  const entries = getWorkImageEntries(card);
  const existingEntries = entries.length ? entries : previewWorkImageEntries(card);
  const availableSlots = Math.max(0, MAX_UPLOAD_FILES - existingEntries.length);
  const accepted = imageFiles.slice(0, availableSlots);
  if (!accepted.length) {
    showToast("作品图片已达到最大数量。", "warning");
    return;
  }
  const startedAt = Date.now();
  const uploaded = await mapWithConcurrency(accepted, 3, async (file, index) => ({
    file,
    tiers: await persistArtworkImageTiers(`${card.dataset.file}__view_${existingEntries.length + index + 1}_${startedAt}`, file),
  }));
  uploaded.forEach(({ file, tiers }) => {
    existingEntries.push({
      name: file.name,
      purpose: `补充图 ${existingEntries.length + 1}`,
      thumbKey: tiers.thumbKey,
      previewKey: tiers.previewKey,
      originalKey: tiers.originalKey,
      type: file.type || "image/jpeg",
      primary: false,
    });
  });
  card.dataset.workImages = JSON.stringify(existingEntries);
  card.dataset.workImagesCleared = "false";
  setReviewLog(card, "图片补充", `补充了 ${accepted.length} 张图片`, { setCurrent: false });
  activeMediaKind = "image";
  activeWorkImageIndex = existingEntries.length - accepted.length;
  markWorkRecordDirty(card);
  await saveStudioStateToCloud();
  renderWorkImageOptions(card);
  applyWorkImage(card, activeWorkImageIndex);
  updateLightboxMediaMeta(card);
  renderDailyReviewBoard();
  showToast(`已直接添加 ${accepted.length} 张作品图片。`, "success");
}

function updateLightboxMediaMeta(card) {
  const cards = activeLightboxCards();
  if (activeMediaKind === "image") {
    const imageCount = previewWorkImageEntries(card).length || 1;
    lightboxMeta.textContent = `花型 ${activePreviewIndex + 1} / ${cards.length} · 图片 ${activeWorkImageIndex + 1} / ${imageCount}`;
    return;
  }
  lightboxMeta.textContent = `花型 ${activePreviewIndex + 1} / ${cards.length} · 配色 ${activeVariant} / ${Number(card.dataset.colors || 1)}`;
}

function reviewMediaTokens(card) {
  return [
    ...previewWorkImageEntries(card).map((_, index) => `image:${index}`),
    ...Array.from({ length: Number(card.dataset.colors || 1) }, (_, index) => `palette:${index + 1}`),
    ...getLinkedSketches(card).map((_, index) => `sketch:${index}`),
    ...getReferenceKeys(card).map((_, index) => `reference:${index}`),
  ];
}

function updateReviewMediaProgress(card) {
  if (!lightboxReviewProgress) return;
  const tokens = reviewMediaTokens(card);
  const seen = viewedReviewMedia.get(card.dataset.file) || new Set();
  const viewed = tokens.filter((token) => seen.has(token)).length;
  lightboxReviewProgress.textContent = `已查看 ${viewed}/${tokens.length} 项`;
}

function markReviewMediaViewed(card, kind, index) {
  if (!card) return;
  const seen = viewedReviewMedia.get(card.dataset.file) || new Set();
  seen.add(`${kind}:${index}`);
  viewedReviewMedia.set(card.dataset.file, seen);
  updateReviewMediaProgress(card);
}

function deletePaletteVariant(card, index) {
  if (index < 1) return;
  const colorCount = Math.max(0, Number(card.dataset.colors || 0));
  if (index > colorCount) return;
  const keys = getPaletteKeys(card);
  const thumbKeys = getPaletteThumbKeys(card);
  const entries = getPaletteFiles(card);
  if (index <= keys.length) keys.splice(index - 1, 1);
  if (index <= thumbKeys.length) thumbKeys.splice(index - 1, 1);
  if (index <= entries.length) entries.splice(index - 1, 1);
  setPaletteKeys(card, keys);
  setPaletteThumbKeys(card, thumbKeys);
  setPaletteFiles(card, entries);
  card.dataset.colors = Math.max(0, colorCount - 1);
  if (activeVariant > Number(card.dataset.colors)) activeVariant = Math.max(1, Number(card.dataset.colors));
  enhanceOneWorkCard(card);
  renderPaletteOptions(card);
  if (typeof renderSketchOptions === "function") renderSketchOptions(card);
  applyVariant(card, activeVariant);
  renderDailyReviewBoard();
  saveStudioState();
  showToast("已删除该配色。", "success");
}

async function appendPaletteFiles(card, files) {
  const supportedFiles = acceptedUploadFiles([...files].filter(isSupportedPaletteFile), {
    label: "配色",
    maxBytes: MAX_IMAGE_FILE_BYTES,
    extensions: SUPPORTED_IMAGE_EXTENSIONS,
  });
  if (!card || !supportedFiles.length) return;
  const keys = getPaletteKeys(card);
  const thumbKeys = getPaletteThumbKeys(card);
  const entries = getPaletteFiles(card);
  if (!keys.length) keys.push(card.dataset.imageKey || card.dataset.file);
  if (!thumbKeys.length) thumbKeys.push(card.dataset.imageKey || card.dataset.file);
  if (!entries.length) entries.push({ name: card.dataset.file, key: keys[0], type: "image/jpeg", primary: true });
  const availableSlots = Math.max(0, MAX_UPLOAD_FILES - (keys.length - 1));
  const accepted = supportedFiles.slice(0, availableSlots);
  if (supportedFiles.length > accepted.length) showToast("超过最大上传数量", "warning");
  for (let index = 0; index < accepted.length; index += 1) {
    const file = accepted[index];
    const baseKey = `${card.dataset.file}__color_${keys.length + 1}_${Date.now()}_${index}`;
    const tiers = await persistArtworkImageTiers(baseKey, file);
    keys.push(tiers.previewKey);
    thumbKeys.push(tiers.thumbKey);
    entries.push({ name: file.name, key: tiers.originalKey, type: file.type || "application/octet-stream", primary: false });
  }
  setPaletteKeys(card, keys);
  setPaletteThumbKeys(card, thumbKeys);
  setPaletteFiles(card, entries);
  card.dataset.colors = keys.length;
  enhanceOneWorkCard(card);
  renderPaletteOptions(card);
  if (typeof renderSketchOptions === "function") renderSketchOptions(card);
  renderDailyReviewBoard();
  saveStudioState();
  showToast(`已增加 ${accepted.length} 个配色。`, "success");
}

function renderReferenceMaterials(card) {
  const linkedPainter = fieldValue(card, "引用手绘");
  const linkedPainterWork = painterWorkCatalog().find((item) => linkedPainter.includes(item.file) || (linkedPainter.includes(item.painter) && linkedPainter.includes(item.title)));
  const referenceMaterial = fieldValue(card, "参考素材");
  const referenceKeys = getReferenceKeys(card);
  const referenceText = referenceMaterial.includes("原创声明") ? "原创声明" : referenceMaterial || "未提供参考图";
  const focusedReviewDetail = canEditWorkMetadata(card) || lightboxWorksLibraryContext;
  const canEditReference = focusedReviewDetail;
  const normalizedReferenceText = String(referenceText || "").trim();
  const referencePlaceholder = !normalizedReferenceText
    || normalizedReferenceText === "未提供参考图"
    || /^[\-\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]+$/u.test(normalizedReferenceText);
  const addReferenceTile = canEditReference
    ? `<button class="palette-option palette-add-tile add-reference-button" type="button"><span class="media-add-visual"><i>＋</i></span><span class="palette-name">添加参考图</span></button>`
    : "";
  const items = [
    focusedReviewDetail ? "" : `<article><strong>手绘素材</strong>${linkedPainterWork ? `<button class="lightbox-painter-link" type="button" data-linked-painter-file="${escapeHtml(linkedPainterWork.file)}">${escapeHtml(linkedPainter)}</button>` : `<span>${escapeHtml(linkedPainter || "无引用 / 原创设计")}</span>`}</article>`,
    `<article class="reference-image-row"><strong>参考图 / 原创声明</strong><div class="reference-preview-grid">${
      referenceKeys.length
        ? referenceKeys.map((key, index) => `<button class="palette-option reference-preview" type="button" data-reference-key="${escapeHtml(key)}"><span class="palette-thumb"></span><span class="palette-name">参考图 ${index + 1}</span>${
            canEditReference ? `<span class="reference-remove" data-reference-remove="${index}" role="button" aria-label="删除参考图" title="删除参考图"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg></span>` : ""
          }</button>`).join("")
        : canEditReference && referencePlaceholder
          ? ""
          : `<p class="reference-empty-state">${escapeHtml(referencePlaceholder ? "未提供参考图" : referenceText)}</p>`
    }${addReferenceTile}</div></article>`,
  ];
  referenceMaterialList.innerHTML = items.filter(Boolean).join("");
  referenceMaterialList.querySelectorAll("[data-reference-key]").forEach((item) => {
    getImageFromDB(item.dataset.referenceKey).then((imageData) => {
      if (!imageData) return;
      const thumb = item.querySelector(".palette-thumb");
      if (thumb) thumb.style.backgroundImage = `url("${imageData}")`;
    });
  });
}

function resetLightboxReviewPanel() {
  activeReviewAction = "";
  lightboxReviewActions.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
  reviewNotePanel.classList.add("hidden");
  reviewNoteText.value = "";
  reviewNotePanel.querySelector(".review-log-list")?.remove();
}

function reviewLogs(card) {
  try {
    const logs = JSON.parse(card?.dataset.reviewLogs || "[]");
    return Array.isArray(logs) ? logs : [];
  } catch {
    return [];
  }
}

function setReviewLog(card, action, note, { setCurrent = true } = {}) {
  const today = dateKey(new Date());
  const version = Number(card.dataset.submissionRound || 1);
  const logs = reviewLogs(card);
  const existing = logs.find((item) => item.date === today && item.action === action && Number(item.version || 1) === version);
  if (existing) {
    existing.note = note;
    existing.time = formatDateTime();
    existing.author = currentAccount.name || "管理员";
    existing.version = version;
  } else {
    logs.unshift({ date: today, time: formatDateTime(), action, note, author: currentAccount.name || "管理员", version });
  }
  card.dataset.reviewLogs = JSON.stringify(logs);
  if (setCurrent) {
    card.dataset.reviewNote = note;
    card.dataset.reviewAction = action;
  }
  markWorkRecordDirty(card);
}

function clearReviewLogs(card) {
  card.dataset.reviewLogs = "";
  card.dataset.reviewNote = "";
  card.dataset.reviewAction = "";
  markWorkRecordDirty(card);
}

function renderReviewLogList(card) {
  reviewNotePanel.querySelector(".review-log-list")?.remove();
  const logs = reviewLogs(card);
  if (!logs.length) return;
  const list = document.createElement("div");
  list.className = "review-log-list";
  list.innerHTML = logs
    .map((item) => `<article><strong>V${Number(item.version || 1)} · ${escapeHtml(item.date)} / ${escapeHtml(item.action)}</strong><p>${escapeHtml(item.note)}</p></article>`)
    .join("");
  reviewNotePanel.appendChild(list);
}

function showStoredReviewNote(card) {
  if (!card?.dataset.reviewNote && !card?.dataset.reviewLogs) return;
  activeReviewAction = card.dataset.reviewAction || "修改";
  reviewNotePanel.classList.remove("hidden");
  reviewNoteLabel.textContent = "修改意见";
  reviewNoteText.placeholder = "请输入需要设计师修改的意见";
  reviewNoteText.value = card.dataset.reviewNote;
  renderReviewLogList(card);
}

function isUploaderDetailContext(card) {
  return ["designer", "sleep", "projects"].includes(activeViewId())
    && card?.dataset.workOwner === currentAccount.ownerKey;
}

function isAdminReviewContext() {
  return currentAccount.role === "管理员" && ["review", "sleep"].includes(activeViewId());
}

function isAdminMetadataContext() {
  return currentAccount.role === "管理员"
    && (lightboxWorksLibraryContext || ["designer", "projects"].includes(activeViewId()));
}

function canEditWorkMetadata(card) {
  if (activeViewId() === "recycle") return false;
  return isUploaderDetailContext(card) || isAdminReviewContext() || isAdminMetadataContext();
}

function renderUploaderReviewHistory(card) {
  const uploaderContext = isUploaderDetailContext(card);
  const adminReviewContext = isAdminReviewContext();
  const adminMetadataContext = isAdminMetadataContext();
  const canViewHistory = uploaderContext || adminReviewContext || adminMetadataContext;
  const logs = reviewLogs(card);
  if (lightboxReviewLogsCard !== card.dataset.file) {
    lightboxReviewLogsCard = card.dataset.file;
    lightboxReviewLogsExpanded = false;
  }
  const revision = logs.find((item) => item.action === "修改") || null;
  const editingRevision = adminReviewContext && lightboxRevisionDraftCard === card;
  const showRevision = (uploaderContext || adminReviewContext) && (Boolean(revision) || editingRevision);
  lightboxRevisionSummary?.classList.toggle("hidden", !showRevision);
  lightboxRevisionSummary?.classList.toggle("editing", editingRevision);
  lightboxRevisionText?.classList.toggle("hidden", editingRevision);
  lightboxRevisionInput?.classList.toggle("hidden", !editingRevision);
  lightboxRevisionConfirm?.classList.toggle("hidden", !adminReviewContext || (!editingRevision && !revision));
  if (lightboxRevisionConfirm) {
    lightboxRevisionConfirm.classList.toggle("is-edit", Boolean(revision) && !editingRevision);
    lightboxRevisionConfirm.setAttribute("aria-label", editingRevision ? "确认修改要求" : "再次编辑修改要求");
    lightboxRevisionConfirm.title = editingRevision ? "确认修改要求" : "再次编辑";
  }
  lightboxRevisionMeta?.classList.toggle("hidden", editingRevision);
  if (editingRevision && lightboxRevisionInput && !lightboxRevisionInput.value) {
    lightboxRevisionInput.value = revision?.note || "";
  }
  if (revision) {
    lightboxRevisionText.textContent = revision.note || "管理员要求修改后重新提交。";
    lightboxRevisionMeta.textContent = `${revision.author || "管理员"} · ${revision.time || revision.date || ""}`;
  }
  lightboxReviewLogPanel?.classList.toggle("hidden", !canViewHistory || !logs.length);
  if (lightboxReviewLogList) {
    const visibleLogs = lightboxReviewLogsExpanded ? logs : logs.slice(0, 3);
    lightboxReviewLogList.innerHTML = visibleLogs
      .map((item) => `<article><strong>V${Number(item.version || 1)} · ${escapeHtml(item.action)}</strong><span>${escapeHtml(item.note || "状态已更新")}</span><time>${escapeHtml(item.time || item.date || "")}</time></article>`)
      .join("") + (logs.length > 3
        ? `<button class="lightbox-log-toggle" data-lightbox-log-toggle type="button">${
            lightboxReviewLogsExpanded ? "收起" : `展开全部（${logs.length}）`
          }</button>`
        : "");
  }
}

function renderLightbox() {
  const cards = activeLightboxCards();
  const card = cards[activePreviewIndex];
  if (!card) {
    return;
  }

  const workImages = previewWorkImageEntries(card);
  if (activeMediaKind === "image") {
    activeWorkImageIndex = Math.min(activeWorkImageIndex, Math.max(0, workImages.length - 1));
    applyWorkImage(card, activeWorkImageIndex);
  } else {
    applyVariant(card, activeVariant);
  }
  lightboxTitle.textContent = "";
  const workTitle = card.querySelector(".work-head strong")?.textContent.trim() || card.dataset.file;
  lightboxFile.textContent = workTitle;
  const sleeping = isSleepingWork(card);
  const uploaderContext = isUploaderDetailContext(card);
  const adminReviewContext = isAdminReviewContext();
  const metadataContext = isAdminMetadataContext();
  const canEditMetadata = canEditWorkMetadata(card);
  const customerContext = lightboxViewerContext;
  const inWorksLibrary = lightboxWorksLibraryContext
    || (activeViewId() === "designer" && currentAccount.role === "管理员" && activeWorksMode === "library");
  const recycleDetailContext = activeViewId() === "recycle";
  lightbox.classList.toggle("daily-review-context", activeViewId() === "review");
  lightboxFile.classList.toggle("lightbox-editable-title", canEditMetadata && !customerContext);
  lightboxFile.title = canEditMetadata && !customerContext ? "点击修改作品名称" : "";
  lightboxFile.setAttribute("aria-label", canEditMetadata && !customerContext ? `作品名称：${workTitle}，点击修改` : `作品名称：${workTitle}`);
  const latestReviewAction = reviewLogs(card)[0]?.action || card.dataset.reviewAction || "";
  const workStatus = sleeping
    ? "休眠中"
    : latestReviewAction === "修改"
      ? "需修改"
      : workDisplayStatus(card);
  lightboxWorkStatus.textContent = workStatus;
  lightboxWorkStatus.dataset.status = sleeping
    ? "sleeping"
    : latestReviewAction === "修改"
      ? "revision"
      : latestReviewAction === "通过" || workStatus.includes("通过")
        ? "approved"
        : isReviewPending(card)
          ? "pending"
          : "reviewed";
  const hideReviewStatusBadge = customerContext || inWorksLibrary;
  lightboxWorkStatus.classList.toggle("hidden", hideReviewStatusBadge);
  lightboxEditWork?.classList.toggle("hidden", recycleDetailContext || !(adminReviewContext || uploaderContext || metadataContext));
  lightboxSleepToggle.classList.toggle("hidden", recycleDetailContext || !(adminReviewContext || metadataContext));
  lightboxSleepToggle.classList.toggle("active", sleeping);
  lightboxSleepToggle.setAttribute("aria-label", sleeping ? "取消作品休眠" : "将作品移入休眠区");
  lightboxSleepToggle.title = sleeping ? "取消休眠" : "移入休眠区";
  lightboxDeleteWork.classList.toggle("hidden", recycleDetailContext || !(adminReviewContext || metadataContext || uploaderContext));
  lightboxOwner.textContent = `${workRoleName(card)}：${workOwnerName(card)}`;
  lightboxOwner.dataset.memberName = workOwnerName(card);
  lightboxOwner.disabled = currentAccount.role !== "管理员";
  lightboxOwner.title = currentAccount.role === "管理员" ? "查看成员档案" : "";
  lightboxOwner.classList.toggle("hidden", customerContext);
  if (lightboxSubmissionMeta) {
    const batchDate = reviewDisplayDate(card);
    const initialDate = dateKey(card.dataset.createdAt || card.dataset.version);
    const reviewedDate = reviewLogs(card)[0]?.date || "";
    const round = Math.max(1, Number(card.dataset.submissionRound || 1));
    lightboxSubmissionMeta.textContent = round > 1
      ? `第 ${round} 版 · 初稿 ${reviewDateText(initialDate)} · 本版 ${reviewDateText(batchDate)}`
      : reviewedDate && reviewedDate !== batchDate
        ? `提交 ${reviewDateText(batchDate)} · ${reviewDateText(reviewedDate)}完成评审`
        : `提交 ${reviewDateText(batchDate)}`;
    lightboxSubmissionMeta.classList.toggle("hidden", customerContext);
  }
  const linkedProject = pjById(card.dataset.projectId || "");
  lightboxProject.textContent = `项目：${linkedProject?.name || "未关联项目"}`;
  lightboxProject.classList.toggle("hidden", customerContext);
  lightboxProject.classList.toggle("lightbox-editable", canEditMetadata && !customerContext);
  closeLightboxProjectPicker();
  renderLightboxTagDisplay(card);
  lightboxTags.classList.remove("hidden");
  lightboxTags.classList.toggle("lightbox-editable", canEditMetadata && !customerContext);
  lightboxTags.title = canEditMetadata && !customerContext ? "点击编辑标签" : "";
  lightboxTagPicker.classList.add("hidden");
  renderLightboxTagPicker(card);
  updateLightboxMediaMeta(card);
  resetLightboxReviewPanel();
  const inLibrary = activeViewId() === "library";
  // 作品库（管理员作品总览）不做评审操作，只查看。
  const inOrder = activeViewId() === "orders" && activeOrderFileContext?.file === card.dataset.file;
  const showSourceFile = !customerContext && !inOrder && ["设计师", "手绘师"].includes(card.dataset.workRole);
  lightbox.classList.toggle("library-mode", inLibrary);
  addToCartFromLightbox.classList.toggle("hidden", !inLibrary);
  lightboxReviewPanel.classList.toggle("hidden", !adminReviewContext || sleeping || inOrder || inWorksLibrary);
  lightboxReviewActions.classList.toggle("hidden", !adminReviewContext || sleeping || inOrder || inLibrary || inWorksLibrary);
  const currentReviewAction = reviewLogs(card)[0]?.action || card.dataset.reviewAction || (cardStatusSummary(card).includes("已通过") ? "通过" : "");
  const reviewPending = isReviewPending(card);
  lightboxReviewActions.querySelectorAll("[data-review-action]").forEach((button) => {
    const action = button.dataset.reviewAction;
    const show = reviewPending
      ? ["修改", "通过"].includes(action)
      : currentReviewAction === "修改"
        ? action === "通过"
        : action === "修改";
    button.classList.toggle("hidden", !show);
  });
  lightboxResetReview?.classList.toggle("hidden", reviewPending);
  sourceFilePanel.classList.toggle("hidden", !showSourceFile);
  document.querySelector("#sketchPanel")?.classList.toggle("customer-hidden", customerContext);
  document.querySelector("#referenceMaterialPanel")?.classList.toggle("customer-hidden", customerContext);
  orderFilePanel.classList.toggle("hidden", !inOrder);
  if (showSourceFile) {
    sourceFileTargetCard = card;
    const sourceFiles = getSourceFiles(card);
    if (sourceFileStatus) if (sourceFileStatus) sourceFileStatus.textContent = "";
    sourceFileDownloadList.innerHTML = `${sourceFiles.map((file, index) => `<div class="source-file-row"><button class="source-file-download-item" type="button" data-source-file-index="${index}"><span>${escapeHtml(file.name || `源文件 ${index + 1}`)}</span><b>下载</b></button>${canEditMetadata ? `<button class="source-file-remove" type="button" data-source-file-remove="${index}" aria-label="删除 ${escapeHtml(file.name || `源文件 ${index + 1}`)}" title="删除"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg></button>` : ""}</div>`).join("")}
      <button class="source-file-add" type="button" data-source-file-add><span>＋</span><b>${sourceFiles.length ? "继续添加" : "未上传源文件 · 点击上传"}</b></button>`;
    sourceDownloadAll?.classList.toggle("hidden", !sourceFiles.length);
  }
  if (inOrder) {
    renderOrderFilePanel();
  }
  renderUploaderReviewHistory(card);
  if (inLibrary) {
    renderCustomerReviewNote(card);
  }
  renderWorkImageOptions(card);
  renderPaletteOptions(card);
  if (typeof renderSketchOptions === "function") renderSketchOptions(card);
  renderReferenceMaterials(card);
  markReviewMediaViewed(
    card,
    activeMediaKind,
    activeMediaKind === "image" ? activeWorkImageIndex : activeVariant,
  );
}

function moveLightbox(direction) {
  const cards = activeLightboxCards();
  if (!cards.length) {
    return;
  }

  const currentCard = cards[activePreviewIndex];
  const groupCount = activeMediaKind === "image"
    ? previewWorkImageEntries(currentCard).length
    : Number(currentCard?.dataset.colors || 1);
  const groupIndex = activeMediaKind === "image" ? activeWorkImageIndex : activeVariant - 1;
  const nextGroupIndex = groupIndex + direction;
  if (nextGroupIndex >= 0 && nextGroupIndex < groupCount) {
    if (activeMediaKind === "image") activeWorkImageIndex = nextGroupIndex;
    else activeVariant = nextGroupIndex + 1;
  } else {
    const nextIndex = activePreviewIndex + direction;
    if (nextIndex < 0 || nextIndex >= cards.length) {
      if (direction > 0) {
        showToast(
          activeViewId() === "review"
            ? `当前页面的 ${cards.length} 件稿件已全部看完。`
            : "当前预览队列已全部看完。",
          "hint",
        );
      }
      return;
    }
    const previousLabel = currentCard.querySelector(".work-head strong")?.textContent.trim()
      || currentCard.dataset.file
      || `第 ${activePreviewIndex + 1} 件稿件`;
    activePreviewIndex = nextIndex;
    activeMediaKind = "image";
    const nextImageCount = previewWorkImageEntries(cards[activePreviewIndex]).length;
    activeWorkImageIndex = direction < 0 ? Math.max(0, nextImageCount - 1) : 0;
    activeVariant = 1;
    if (direction > 0) {
      const nextCard = cards[activePreviewIndex];
      const nextLabel = nextCard.querySelector(".work-head strong")?.textContent.trim()
        || nextCard.dataset.file
        || `第 ${activePreviewIndex + 1} 件稿件`;
      showToast(
        `“${previousLabel}”已查看完成，正在查看第 ${activePreviewIndex + 1}/${cards.length} 件“${nextLabel}”。`,
        "hint",
      );
    }
  }
  previewZoom = 1;
  previewOffsetX = 0;
  previewOffsetY = 0;
  renderLightbox();
}

function changeZoom(delta) {
  previewZoom = Math.min(MAX_PREVIEW_ZOOM, Math.max(1, Number((previewZoom + delta).toFixed(2))));
  if (previewZoom === 1) {
    previewOffsetX = 0;
    previewOffsetY = 0;
  }
  applyPreviewZoom();
}

function changeZoomAtPointer(delta, event) {
  const previousZoom = previewZoom;
  const nextZoom = Math.min(MAX_PREVIEW_ZOOM, Math.max(1, Number((previousZoom + delta).toFixed(2))));
  if (nextZoom === previousZoom) return;
  const rect = lightboxFigure?.getBoundingClientRect() || lightboxImage.getBoundingClientRect();
  const pointerX = event.clientX - rect.left - rect.width / 2;
  const pointerY = event.clientY - rect.top - rect.height / 2;
  const scaleChange = nextZoom / previousZoom - 1;
  previewOffsetX -= (pointerX - previewOffsetX) * scaleChange;
  previewOffsetY -= (pointerY - previewOffsetY) * scaleChange;
  previewZoom = nextZoom;
  if (previewZoom === 1) {
    previewOffsetX = 0;
    previewOffsetY = 0;
  }
  applyPreviewZoom();
}

function setContinuousZoomAtPointer(nextZoom, event) {
  const previousZoom = previewZoom;
  const clampedZoom = Math.min(MAX_PREVIEW_ZOOM, Math.max(1, nextZoom));
  if (Math.abs(clampedZoom - previousZoom) < 0.001) return;
  const rect = lightboxFigure?.getBoundingClientRect() || lightboxImage.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const pointerX = event.clientX - centerX;
  const pointerY = event.clientY - centerY;
  const scaleRatio = clampedZoom / previousZoom;
  previewOffsetX = pointerX - (pointerX - previewOffsetX) * scaleRatio;
  previewOffsetY = pointerY - (pointerY - previewOffsetY) * scaleRatio;
  previewZoom = clampedZoom;
  if (previewZoom <= 1.001) {
    previewZoom = 1;
    previewOffsetX = 0;
    previewOffsetY = 0;
  }
  applyPreviewZoom();
}

function resetPreviewTransform() {
  previewZoom = 1;
  previewOffsetX = 0;
  previewOffsetY = 0;
  applyPreviewZoom();
}

function showActualPreviewPixels() {
  const fitScale = lightboxImageFitScale();
  previewZoom = Math.min(MAX_PREVIEW_ZOOM, Math.max(1, 1 / Math.max(fitScale, 0.001)));
  previewOffsetX = 0;
  previewOffsetY = 0;
  applyPreviewZoom();
}

function statusText(card, prefix) {
  return badgeValue(card, prefix) || "";
}

function reviewText(card) {
  return fieldValue(card, "审核状态");
}

function sortWeight(value, order) {
  const found = order.findIndex((item) => value.includes(item));
  return found === -1 ? order.length : found;
}

function sortWorkCards() {
  const mode = workSort.value;
  const sourceCards = hasActiveWorksScope ? [...activeWorksScope] : [...workCards];
  const cards = sourceCards.filter((card) => !hasAppliedWorksFilter || filteredWorksScope.has(card));

  cards.forEach((card) => {
    card.classList.toggle("time-hidden", !workInTimeRange(card));
  });

  cards.sort((a, b) => {
    if (mode === "version-asc") {
      return new Date(a.dataset.version) - new Date(b.dataset.version);
    }
    if (mode === "created-desc") {
      return new Date(b.dataset.createdAt || b.dataset.version) - new Date(a.dataset.createdAt || a.dataset.version);
    }
    if (mode === "colors-desc") {
      const colorDifference = Number(b.dataset.colors || 1) - Number(a.dataset.colors || 1);
      return colorDifference || new Date(b.dataset.version) - new Date(a.dataset.version);
    }
    if (mode === "name-asc") {
      return String(a.dataset.file || "").localeCompare(String(b.dataset.file || ""), "zh-Hans-CN");
    }
    if (mode === "selection-desc") {
      return Number(b.dataset.selectionCount || 0) - Number(a.dataset.selectionCount || 0);
    }
    if (mode === "sales-desc") {
      return Number(b.dataset.salesCount || 0) - Number(a.dataset.salesCount || 0);
    }
    return new Date(b.dataset.version) - new Date(a.dataset.version);
  });

  workGalleryOrder = cards;
  visibleWorkGalleryOrder = cards.filter((card) =>
    !isArchivedForCurrentWorks(card)
    && !card.classList.contains("time-hidden")
  );
  applyWorkGalleryBatch();
}

function workInTimeRange(card) {
  const mode = workTimeFilter.value;
  if (mode === "all") {
    return true;
  }

  const versionTime = new Date(card.dataset.version);
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const diffMs = now - versionTime;
  const diffDays = diffMs / 86400000;

  if (mode === "today") {
    return versionTime.toDateString() === now.toDateString();
  }

  if (mode === "3days") {
    return diffDays <= 3;
  }

  return diffDays <= 7;
}

// ---- 作品库筛选 ----
const libraryFilterConfig = Object.keys(managedTagCategories).map((key) => ({
  key,
  label: managedTagCategoryLabels[key] || key,
  options: managedTagCategories[key],
}));
const libraryFilterState = libraryFilterConfig.reduce((acc, item) => {
  acc[item.key] = new Set();
  return acc;
}, {});
const librarySalesFilter = { key: "salesStatus", label: "销售状态", options: ["已售出", "未售出"] };
let librarySalesStatus = "";

function directSoldDesignFiles() {
  return new Set((studioOrders || [])
    .filter((order) => order.paymentStatus === "已支付")
    .flatMap((order) => orderPatternList(order))
    .filter((file) => sourceCardByFile(file)?.dataset.workRole === "设计师"));
}

/*
 * 已售产出按作品去重：
 * - 订单中的设计稿只计一次；
 * - 设计稿引用的手绘稿在首次带动成交时计一次；
 * - 后续设计稿再次引用同一手绘稿，不重复计入手绘师业绩。
 */
function soldContributionEvents() {
  const seen = new Set();
  const events = [];
  const paidOrders = (studioOrders || [])
    .filter((order) => order.paymentStatus === "已支付")
    .slice()
    .sort((a, b) => new Date(a.paidAt || a.createdAt || a.time || 0) - new Date(b.paidAt || b.createdAt || b.time || 0));
  paidOrders.forEach((order) => {
    const at = new Date(order.paidAt || order.createdAt || order.time || 0);
    const safeAt = Number.isNaN(at.getTime()) ? new Date(0) : at;
    orderPatternList(order).forEach((file) => {
      const designCard = sourceCardByFile(file);
      if (!designCard || designCard.dataset.workRole !== "设计师") return;
      if (!seen.has(file)) {
        seen.add(file);
        events.push({ file, at: safeAt, order, kind: "direct", role: "设计师", ownerKey: designCard.dataset.workOwner || "" });
      }
      getLinkedSketches(designCard).forEach((sketchFile) => {
        const sketchCard = sourceCardByFile(sketchFile);
        if (seen.has(sketchFile) || !sketchCard || sketchCard.dataset.workRole !== "手绘师") return;
        seen.add(sketchFile);
        events.push({ file: sketchFile, at: safeAt, order, kind: "linked-sketch", role: "手绘师", ownerKey: sketchCard.dataset.workOwner || "", sourceDesign: file });
      });
    });
  });
  return events;
}

function syncSoldWorkBadges() {
  const soldFiles = new Set(soldContributionEvents().map((event) => event.file));
  [...workCards].forEach((card) => {
    const prefix = card.dataset.workRole === "手绘师" ? "作品状态：" : "销售状态：";
    const isSold = soldFiles.has(card.dataset.file);
    if (isSold) {
      if (card.dataset.derivedSaleStatus !== "sold") {
        card.dataset.preDerivedSaleStatus = badgeValue(card, prefix) || "未出售";
        card.dataset.derivedSaleStatus = "sold";
      }
      setBadgeText(card, prefix, "已出售", "sale-badge sold");
      return;
    }
    if (card.dataset.derivedSaleStatus === "sold") {
      const previous = card.dataset.preDerivedSaleStatus || "未出售";
      setBadgeText(card, prefix, previous, `sale-badge ${statusBadgeClass(previous)}`);
      delete card.dataset.derivedSaleStatus;
      delete card.dataset.preDerivedSaleStatus;
    }
  });
}

function soldPatternFiles() {
  return directSoldDesignFiles();
}

function cardLibraryValues(card, key) {
  if (key === "workType") return [card.dataset.workRole === "手绘师" ? "手绘稿" : "设计稿"];
  return (card.dataset.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

function libSelectTagsMarkup(cat) {
  const state = libraryFilterState[cat];
  const config = libraryFilterConfig.find((row) => row.key === cat);
  if (!state.size) return `<span class="lib-select-value">全部${escapeHtml(config?.label || "")}</span>`;
  const values = [...state];
  return `<span class="lib-select-value">${escapeHtml(values[0])}${values.length > 1 ? `<b>+${values.length - 1}</b>` : ""}</span>`;
}

function renderLibraryFilterBar() {
  if (!libraryFilterBar) return;
  // 保留排序控件（它有独立监听），仅替换筛选行。
  libraryFilterBar.querySelectorAll(".library-filter-row:not(.library-sort-row)").forEach((row) => row.remove());
  const rowsHtml = libraryFilterConfig.filter((row) => row.key !== "workType").map((row) => {
    const state = libraryFilterState[row.key];
    const options = `<label class="lib-opt ${state.size === 0 ? "selected" : ""}"><input type="checkbox" data-lib-cat="${row.key}" value="__all__" ${state.size === 0 ? "checked" : ""} /><span>全部${escapeHtml(row.label)}</span><i aria-hidden="true">✓</i></label>`
      + row.options.map((option) =>
        `<label class="lib-opt ${state.has(option) ? "selected" : ""}"><input type="checkbox" data-lib-cat="${row.key}" value="${escapeHtml(option)}" ${state.has(option) ? "checked" : ""} /><span>${escapeHtml(option)}</span><i aria-hidden="true">✓</i></label>`
      ).join("");
    return `<div class="library-filter-row">
      <div class="lib-select" data-lib-select="${row.key}">
        <button class="lib-select-trigger" type="button" data-lib-toggle="${row.key}" aria-haspopup="listbox" aria-expanded="false">
          ${libSelectTagsMarkup(row.key)}
          <i class="lib-select-caret" aria-hidden="true"></i>
        </button>
        <div class="lib-select-panel hidden">${options}</div>
      </div>
    </div>`;
  }).join("");
  const showSales = ["管理员", "设计师", "手绘师"].includes(currentAccount.role);
  const salesRow = showSales ? `<div class="library-filter-row library-sales-filter-row">
      <div class="lib-select" data-lib-select="${librarySalesFilter.key}">
        <button class="lib-select-trigger" type="button" data-lib-toggle="${librarySalesFilter.key}" aria-haspopup="listbox" aria-expanded="false">
          <span class="lib-select-value">${librarySalesStatus || `全部${librarySalesFilter.label}`}</span><i class="lib-select-caret" aria-hidden="true"></i>
        </button>
        <div class="lib-select-panel hidden">
          <label class="lib-opt ${librarySalesStatus ? "" : "selected"}"><input type="radio" name="library-sales-status" data-lib-sales-status value="__all__" ${librarySalesStatus ? "" : "checked"} /><span>全部${librarySalesFilter.label}</span><i aria-hidden="true">✓</i></label>
          ${librarySalesFilter.options.map((option) => `<label class="lib-opt ${librarySalesStatus === option ? "selected" : ""}"><input type="radio" name="library-sales-status" data-lib-sales-status value="${option}" ${librarySalesStatus === option ? "checked" : ""} /><span>${option}</span><i aria-hidden="true">✓</i></label>`).join("")}
        </div>
      </div>
    </div>` : "";
  const sortRow = libraryFilterBar.querySelector(".library-sort-row");
  if (sortRow) sortRow.insertAdjacentHTML("beforebegin", rowsHtml + salesRow);
  else libraryFilterBar.insertAdjacentHTML("afterbegin", rowsHtml);
}

function renderLibSelectTrigger(cat) {
  const trigger = libraryFilterBar?.querySelector(`[data-lib-toggle="${cat}"]`);
  if (!trigger) return;
  trigger.innerHTML = `${libSelectTagsMarkup(cat)}<i class="lib-select-caret" aria-hidden="true"></i>`;
}

function syncLibraryRowCheckboxes(cat) {
  if (!libraryFilterBar) return;
  const state = libraryFilterState[cat];
  libraryFilterBar.querySelectorAll(`input[data-lib-cat="${cat}"]`).forEach((input) => {
    input.checked = input.value === "__all__" ? state.size === 0 : state.has(input.value);
    input.closest(".lib-opt")?.classList.toggle("selected", input.checked);
  });
  renderLibSelectTrigger(cat);
}

function closeLibrarySelects(except = null) {
  libraryFilterBar?.querySelectorAll(".lib-select").forEach((box) => {
    if (box === except) return;
    box.querySelector(".lib-select-panel")?.classList.add("hidden");
    box.classList.remove("open");
    box.querySelector(".lib-select-trigger")?.setAttribute("aria-expanded", "false");
  });
}

function renderLibrarySelectedConditions() {
  if (!librarySelectedConditions) return;
  const chips = [];
  libraryFilterConfig.filter((row) => row.key !== "workType").forEach((row) => {
    [...libraryFilterState[row.key]].forEach((val) => chips.push({ key: row.key, val }));
  });
  if (librarySalesStatus && ["管理员", "设计师", "手绘师"].includes(currentAccount.role)) chips.push({ key: "salesStatus", val: librarySalesStatus });
  if (!chips.length) {
    librarySelectedConditions.innerHTML = "";
    return;
  }
  librarySelectedConditions.innerHTML = `<span class="library-selected-label">已选条件：</span>`
    + chips.map((chip) => `<button class="library-selected-chip" type="button" data-lib-remove-cat="${chip.key}" data-lib-remove-val="${escapeHtml(chip.val)}">${escapeHtml(chip.val)}<i aria-hidden="true">×</i></button>`).join("")
    + `<button class="library-clear" type="button" data-lib-clear>清空筛选</button>`;
}

function updateLibraryResultCount() {
  if (!libraryResultCount) return;
  const count = hasAppliedWorksFilter
    ? [...filteredWorksScope].filter((card) => !card.classList.contains("time-hidden")).length
    : 0;
  if (libraryResultCount) libraryResultCount.textContent = `共找到 ${count} 个作品`;
}

function applyLibraryFilters({ renderBatch = true } = {}) {
  // 管理员作品库只展示已审核通过的作品；设计师/手绘师仍能看到自己需修改的稿件。
  const approvedOnly = currentAccount.role === "管理员" && activeWorksMode !== "personal";
  const sourceCards = hasActiveWorksScope ? [...activeWorksScope] : [...workCards];
  const soldFiles = librarySalesStatus ? soldPatternFiles() : null;
  const nextFilteredScope = new Set();
  sourceCards.forEach((card) => {
    const matchesFilters = libraryFilterConfig.every((row) => {
      const state = libraryFilterState[row.key];
      if (!state.size) return true;
      return cardLibraryValues(card, row.key).some((value) => state.has(value));
    });
    const approvedOk = !approvedOnly
      || card.dataset.reviewState === "approved"
      || card.dataset.reviewAction === "通过"
      || (!card.dataset.reviewState && fieldValue(card, "审核状态").includes("已通过"));
    const salesOk = !soldFiles || (librarySalesStatus === "已售出" ? soldFiles.has(card.dataset.file) : !soldFiles.has(card.dataset.file));
    if (matchesFilters && approvedOk && salesOk) nextFilteredScope.add(card);
  });
  filteredWorksScope = nextFilteredScope;
  libraryManageEligibleCount = [...nextFilteredScope].reduce(
    (count, card) => count + Number(!isArchivedForCurrentWorks(card)),
    0
  );
  hasAppliedWorksFilter = true;
  // 仅同步当前画廊节点的兼容 class；停放区不做数百次 DOM 写入。
  worksBoard?.querySelectorAll(".work-card").forEach((card) => {
    card.classList.toggle("filtered-hidden", !filteredWorksScope.has(card));
  });
  renderLibrarySelectedConditions();
  updateLibraryResultCount();
  if (renderBatch) {
    const orderedSource = workGalleryOrder.length ? workGalleryOrder : sourceCards;
    visibleWorkGalleryOrder = orderedSource.filter((card) =>
      nextFilteredScope.has(card)
      && !card.classList.contains("time-hidden")
      && !isArchivedForCurrentWorks(card)
    );
    applyWorkGalleryBatch(true);
  }
}

libraryFilterBar?.addEventListener("change", (event) => {
  if (event.target.id === "librarySortField") {
    workSort.value = event.target.value;
    sortWorkCards();
    return;
  }
  const salesInput = event.target.closest("input[data-lib-sales-status]");
  if (salesInput) {
    librarySalesStatus = salesInput.value === "__all__" ? "" : salesInput.value;
    renderLibraryFilterBar();
    applyLibraryFilters();
    return;
  }
  const input = event.target.closest("input[data-lib-cat]");
  if (!input) return;
  const state = libraryFilterState[input.dataset.libCat];
  if (input.value === "__all__") {
    state.clear();
  } else if (input.checked) {
    state.add(input.value);
  } else {
    state.delete(input.value);
  }
  syncLibraryRowCheckboxes(input.dataset.libCat);
  applyLibraryFilters();
});

function renderWorksTypeSegment() {
  if (!worksTypeSegment) return;
  const state = libraryFilterState.workType;
  const value = state.has("设计稿") ? "design" : state.has("手绘稿") ? "painter" : "all";
  worksTypeSegment.dataset.value = value;
  worksTypeSegment.querySelectorAll("[data-works-type]").forEach((button) => {
    const active = button.dataset.worksType === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

worksTypeSegment?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-works-type]");
  if (!button) return;
  const state = libraryFilterState.workType;
  state.clear();
  if (button.dataset.worksType === "design") state.add("设计稿");
  if (button.dataset.worksType === "painter") state.add("手绘稿");
  renderWorksTypeSegment();
  applyLibraryFilters();
});

libraryFilterBar?.addEventListener("click", (event) => {
  const sortOption = event.target.closest("[data-lib-sort-value]");
  if (sortOption) {
    const value = sortOption.dataset.libSortValue;
    const label = sortOption.querySelector("span")?.textContent || "";
    librarySortField.value = value;
    workSort.value = value;
    libraryFilterBar.querySelector("[data-lib-sort-label]").textContent = label;
    libraryFilterBar.querySelectorAll("[data-lib-sort-value]").forEach((button) => {
      button.classList.toggle("selected", button === sortOption);
    });
    closeLibrarySelects();
    workRenderLimit = WORK_RENDER_BATCH;
    sortWorkCards();
    return;
  }
  // 删除触发器里的单个标签
  const removeTag = event.target.closest("[data-lib-remove-cat]");
  if (removeTag) {
    event.stopPropagation();
    if (removeTag.dataset.libRemoveCat === "salesStatus") {
      librarySalesStatus = "";
      renderLibraryFilterBar();
      applyLibraryFilters();
      return;
    }
    libraryFilterState[removeTag.dataset.libRemoveCat].delete(removeTag.dataset.libRemoveVal);
    syncLibraryRowCheckboxes(removeTag.dataset.libRemoveCat);
    applyLibraryFilters();
    return;
  }
  const toggle = event.target.closest("[data-lib-toggle]");
  if (toggle) {
    const box = toggle.closest(".lib-select");
    const panel = box.querySelector(".lib-select-panel");
    const willOpen = panel.classList.contains("hidden");
    closeLibrarySelects(box);
    panel.classList.toggle("hidden", !willOpen);
    box.classList.toggle("open", willOpen);
    toggle.setAttribute("aria-expanded", String(willOpen));
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".lib-select")) closeLibrarySelects();
});

librarySelectedConditions?.addEventListener("click", (event) => {
  const clearButton = event.target.closest("[data-lib-clear]");
  if (clearButton) {
    libraryFilterConfig.forEach((row) => libraryFilterState[row.key].clear());
    librarySalesStatus = "";
    renderLibraryFilterBar();
    renderWorksTypeSegment();
    applyLibraryFilters();
    return;
  }
  const removeButton = event.target.closest("[data-lib-remove-cat]");
  if (removeButton) {
    if (removeButton.dataset.libRemoveCat === "salesStatus") {
      librarySalesStatus = "";
      renderLibraryFilterBar();
      applyLibraryFilters();
      return;
    }
    libraryFilterState[removeButton.dataset.libRemoveCat].delete(removeButton.dataset.libRemoveVal);
    syncLibraryRowCheckboxes(removeButton.dataset.libRemoveCat);
    applyLibraryFilters();
  }
});

renderLibraryFilterBar();
renderWorksTypeSegment();

// ---- 客户专属选稿：复用作品库筛选词库，但保持独立筛选状态 ----
const viewerLibraryFilterConfig = libraryFilterConfig.filter((item) => item.key !== "workType");
const viewerLibraryFilterState = viewerLibraryFilterConfig.reduce((state, item) => {
  state[item.key] = new Set();
  return state;
}, {});

function viewerFilterTriggerMarkup(key) {
  const values = [...viewerLibraryFilterState[key]];
  return values.length
    ? `<span class="lib-select-tags">${values.map((value) => `<span class="lib-select-tag">${escapeHtml(value)}<i data-viewer-lib-remove-cat="${key}" data-viewer-lib-remove-val="${escapeHtml(value)}" aria-hidden="true">×</i></span>`).join("")}</span>`
    : `<span class="lib-select-placeholder">全部</span>`;
}

function renderViewerLibraryFilterBar() {
  if (!viewerLibraryFilterBar) return;
  viewerLibraryFilterBar.innerHTML = viewerLibraryFilterConfig.map((row) => {
    const selected = viewerLibraryFilterState[row.key];
    const options = `<label class="lib-opt"><input type="checkbox" data-viewer-lib-cat="${row.key}" value="__all__" ${selected.size ? "" : "checked"} /><span>全部</span></label>`
      + row.options.map((option) => `<label class="lib-opt"><input type="checkbox" data-viewer-lib-cat="${row.key}" value="${escapeHtml(option)}" ${selected.has(option) ? "checked" : ""} /><span>${escapeHtml(option)}</span></label>`).join("");
    return `<div class="library-filter-row">
      <span class="library-filter-label">${row.label}</span>
      <div class="lib-select" data-viewer-lib-select="${row.key}">
        <button class="lib-select-trigger" type="button" data-viewer-lib-toggle="${row.key}">${viewerFilterTriggerMarkup(row.key)}<i class="lib-select-caret" aria-hidden="true"></i></button>
        <div class="lib-select-panel hidden">${options}</div>
      </div>
    </div>`;
  }).join("");
}

function renderViewerLibrarySelectedConditions() {
  if (!viewerLibrarySelectedConditions) return;
  const chips = viewerLibraryFilterConfig.flatMap((row) => [...viewerLibraryFilterState[row.key]].map((value) => ({ key: row.key, value })));
  viewerLibrarySelectedConditions.innerHTML = chips.length
    ? `<span class="library-selected-label">已选条件：</span>${chips.map((chip) => `<button class="library-selected-chip" type="button" data-viewer-lib-remove-cat="${chip.key}" data-viewer-lib-remove-val="${escapeHtml(chip.value)}">${escapeHtml(chip.value)}<i aria-hidden="true">×</i></button>`).join("")}<button class="library-clear" type="button" data-viewer-lib-clear>清空筛选</button>`
    : "";
}

function filteredViewerLibraryDesigns() {
  const selectedFiles = selectedCartFiles();
  const cards = libraryEligibleDesigns().filter((card) =>
    !selectedFiles.has(card.dataset.file) && viewerLibraryFilterConfig.every((row) => {
      const selected = viewerLibraryFilterState[row.key];
      return !selected.size || cardLibraryValues(card, row.key).some((value) => selected.has(value));
    })
  );
  const mode = viewerLibrarySort?.value || "version-desc";
  return cards.sort((a, b) => {
    if (mode === "version-asc") return new Date(a.dataset.version) - new Date(b.dataset.version);
    if (mode === "name-asc") {
      const aName = a.querySelector(".work-head strong")?.textContent.trim() || a.dataset.file;
      const bName = b.querySelector(".work-head strong")?.textContent.trim() || b.dataset.file;
      return aName.localeCompare(bName, "zh-CN", { numeric: true });
    }
    if (mode === "color-desc") return Number(b.dataset.colors || 1) - Number(a.dataset.colors || 1);
    return new Date(b.dataset.version) - new Date(a.dataset.version);
  });
}

function clearViewerLibraryFilters() {
  viewerLibraryFilterConfig.forEach((row) => viewerLibraryFilterState[row.key].clear());
  renderViewerLibraryFilterBar();
  renderViewerLibrarySelectedConditions();
  libraryGridRenderLimit = LIBRARY_GRID_BATCH;
  renderLibraryGrid();
}

viewerLibraryFilterBar?.addEventListener("change", (event) => {
  const input = event.target.closest("input[data-viewer-lib-cat]");
  if (!input) return;
  const state = viewerLibraryFilterState[input.dataset.viewerLibCat];
  if (input.value === "__all__") state.clear();
  else if (input.checked) state.add(input.value);
  else state.delete(input.value);
  renderViewerLibraryFilterBar();
  renderViewerLibrarySelectedConditions();
  libraryGridRenderLimit = LIBRARY_GRID_BATCH;
  renderLibraryGrid();
});

viewerLibraryFilterBar?.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-viewer-lib-remove-cat]");
  if (remove) {
    event.stopPropagation();
    viewerLibraryFilterState[remove.dataset.viewerLibRemoveCat].delete(remove.dataset.viewerLibRemoveVal);
    renderViewerLibraryFilterBar();
    renderViewerLibrarySelectedConditions();
    libraryGridRenderLimit = LIBRARY_GRID_BATCH;
    renderLibraryGrid();
    return;
  }
  const toggle = event.target.closest("[data-viewer-lib-toggle]");
  if (!toggle) return;
  const box = toggle.closest(".lib-select");
  const panel = box.querySelector(".lib-select-panel");
  const willOpen = panel.classList.contains("hidden");
  viewerLibraryFilterBar.querySelectorAll(".lib-select-panel").forEach((item) => item.classList.add("hidden"));
  viewerLibraryFilterBar.querySelectorAll(".lib-select").forEach((item) => item.classList.remove("open"));
  panel.classList.toggle("hidden", !willOpen);
  box.classList.toggle("open", willOpen);
});

document.addEventListener("click", (event) => {
  if (event.target.closest("#viewerLibraryFilterBar .lib-select")) return;
  viewerLibraryFilterBar?.querySelectorAll(".lib-select-panel").forEach((item) => item.classList.add("hidden"));
  viewerLibraryFilterBar?.querySelectorAll(".lib-select").forEach((item) => item.classList.remove("open"));
});

viewerLibrarySelectedConditions?.addEventListener("click", (event) => {
  if (event.target.closest("[data-viewer-lib-clear]")) {
    clearViewerLibraryFilters();
    return;
  }
  const remove = event.target.closest("[data-viewer-lib-remove-cat]");
  if (!remove) return;
  viewerLibraryFilterState[remove.dataset.viewerLibRemoveCat].delete(remove.dataset.viewerLibRemoveVal);
  renderViewerLibraryFilterBar();
  renderViewerLibrarySelectedConditions();
  libraryGridRenderLimit = LIBRARY_GRID_BATCH;
  renderLibraryGrid();
});

viewerLibrarySort?.addEventListener("change", () => {
  libraryGridRenderLimit = LIBRARY_GRID_BATCH;
  renderLibraryGrid();
});
renderViewerLibraryFilterBar();

function enhanceOneWorkCard(card) {
  card.dataset.workRole = workRoleName(card);
  const meta = workMeta[card.dataset.file] || { version: card.dataset.version || "2026-06-24 00:00", colors: Number(card.dataset.colors || 1) };
  card.dataset.version = card.dataset.version || meta.version;
  card.dataset.colors = card.dataset.colors || meta.colors;

  const trigger = card.querySelector(".preview-trigger");
  if (trigger) {
    const isPainter = card.dataset.workRole === "手绘师";
    const colorBadge = document.createElement("span");
    const existingBadge = trigger.querySelector(".color-count");
    if (isPainter) {
      existingBadge?.remove();
    } else if (existingBadge) {
      existingBadge.textContent = `配色 ${Number(card.dataset.colors || 1)}`;
    } else {
      colorBadge.className = "color-count";
      colorBadge.textContent = `配色 ${Number(card.dataset.colors || 1)}`;
      trigger.appendChild(colorBadge);
    }
  }

  if (trigger) {
    const isPainter = card.dataset.workRole === "手绘师";
    let typeBadge = trigger.querySelector(".work-type-badge");
    if (!typeBadge) {
      typeBadge = document.createElement("span");
      trigger.appendChild(typeBadge);
    }
    typeBadge.className = `work-type-badge ${isPainter ? "painter" : "designer"}`;
    typeBadge.textContent = isPainter ? "手绘稿" : "设计稿";

    // 画廊模式 hover 信息（参考每日评审卡片）
    let hover = card.querySelector(".work-hover-info");
    if (!hover) {
      hover = document.createElement("div");
      hover.className = "work-hover-info";
      trigger.appendChild(hover);
    }
    hover.innerHTML = `<strong>${escapeHtml(card.dataset.file)}</strong>`
      + `<span>${isPainter ? "手绘稿" : "设计稿"} · ${escapeHtml(workOwnerName(card))}</span>`
      + `<span>时间：${escapeHtml(card.dataset.version || "-")}</span>`
      + (isPainter ? "" : `<span>配色：${Number(card.dataset.colors || 1)} 个</span>`);
  }

  if (!card.querySelector(".work-trash-button")) {
    const trashButton = document.createElement("button");
    trashButton.className = "delete-work work-trash-button";
    trashButton.type = "button";
    trashButton.setAttribute("aria-label", `将 ${card.dataset.file} 移入回收站`);
    trashButton.title = "移入回收站";
    trashButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg>';
    card.appendChild(trashButton);
  }

  const fileName = card.querySelector(".file-name");
  if (fileName && !card.querySelector(".version-row")) {
    const versionRow = document.createElement("div");
    versionRow.className = "version-row";
    versionRow.innerHTML = `<span>版本 ${card.dataset.version}</span><span class="version-actions"><button class="replace-image" type="button">替换图片</button><button class="delete-work" type="button">删除作品</button></span>`;
    fileName.insertAdjacentElement("afterend", versionRow);
  } else {
    const versionRow = card.querySelector(".version-row");
    const versionText = versionRow?.querySelector("span:first-child");
    const versionActions = versionRow?.querySelector(".version-actions");
    if (versionText) versionText.textContent = `版本 ${card.dataset.version}`;
    if (versionActions && versionActions.querySelector(".replace-palette")) {
      versionActions.innerHTML = `<button class="replace-image" type="button">替换图片</button><button class="delete-work" type="button">删除作品</button>`;
    }
  }

  if (!card.querySelector(".tag-bar")) {
    renderCardTags(card);
  }

  if (cardStatusSummary(card).includes("Pass")) {
    card.classList.add("sleeping");
    card.dataset.sleeping = "true";
    card.dataset.sleepPreviousReviewStatus ||= "待审核 / 管理者未评审";
    card.dataset.reviewAction = "";
  }
  const reviewSummary = fieldValue(card, "审核状态");
  card.classList.toggle("needs-revision", reviewSummary.includes("需修改") || reviewSummary.includes("未修改"));
  syncPersonalReviewStatus(card);
}

function enhanceWorkCards() {
  workCards.forEach(enhanceOneWorkCard);
}

function renderCardTags(card) {
  const existing = card.dataset.tags ? normalizeTags(card.dataset.tags).split(",").filter(Boolean) : [];
  card.dataset.tags = existing.slice(0, 6).join(",");
  const tagBar = document.createElement("div");
  tagBar.className = "tag-bar";
  tagBar.innerHTML = (card.dataset.tags ? card.dataset.tags.split(",") : [])
    .map((tag) => `<button class="tag-chip active" type="button">${tag}</button>`)
    .join("");
  tagBar.insertAdjacentHTML("beforeend", `<button class="tag-chip add" type="button">+ 标签</button>`);
  card.querySelector(".status-row")?.insertAdjacentElement("afterend", tagBar);
}

function selectFromDataSource({ anchor, options, currentValue, onSelect }) {
  if (!anchor || anchor.querySelector(".inline-editor")) return;
  const editor = document.createElement("select");
  editor.className = "inline-editor";
  editor.innerHTML = options
    .map((item) => {
      const selected = item.value === currentValue ? "selected" : "";
      return `<option value="${escapeHtml(item.value)}" ${selected}>${escapeHtml(item.label)}</option>`;
    })
    .join("");

  const originalHTML = anchor.innerHTML;
  anchor.innerHTML = "";
  anchor.appendChild(editor);
  editor.focus();

  const commit = () => {
    onSelect(editor.value);
    saveStudioState();
    showToast("字段已更新。", "success");
  };
  const restore = () => {
    if (anchor.contains(editor)) anchor.innerHTML = originalHTML;
  };

  editor.addEventListener("change", commit);
  editor.addEventListener("blur", restore);
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") restore();
    if (event.key === "Enter") commit();
  });
}


function painterWorkOptions() {
  return [
    { value: "无引用 / 原创设计", label: "无引用 / 原创设计" },
    ...painterWorkCatalog().map((item) => ({
      value: `${item.painter} / ${item.title}`,
      label: `${item.painter} / ${item.title} / ${item.file}`,
    })),
  ];
}

const uploadTagCategories = libraryFilterConfig
  .filter((category) => category.key !== "workType")
  .map((category) => ({
    name: category.label,
    tags: category.options,
  }));

function tagOptionMarkup(tag) {
  const active = selectedUploadTags.includes(tag) ? "active" : "";
  return `<button class="tag-option ${active}" type="button" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`;
}

function renderUploadTags() {
  uploadTagOptions.innerHTML = uploadTagCategories
    .map((group) => `<section class="tag-category"><strong>${group.name}</strong><div>${group.tags.map(tagOptionMarkup).join("")}</div></section>`)
    .join("");
}

function renderLightboxTagPicker(card) {
  if (!card || !lightboxTagOptions) return;
  const selected = new Set((card.dataset.tags || "").split(",").filter(Boolean));
  const available = [...new Set([...uploadTagCategories.flatMap((group) => group.tags), ...globalTags])];
  lightboxTagOptions.innerHTML = available
    .map((tag) => `<button class="lightbox-tag-option ${selected.has(tag) ? "active" : ""}" data-lightbox-tag="${escapeHtml(tag)}" type="button">${escapeHtml(tag)}</button>`)
    .join("");
}

function lightboxProjectChoices(query = "") {
  const keyword = String(query || "").trim().toLowerCase();
  const projects = (pjProjects || []).filter((project) => !project.archived);
  const unique = new Map();
  projects.forEach((project) => {
    const name = String(project?.name || "").trim();
    if (!name || unique.has(name)) return;
    unique.set(name, {
      id: project.id || "",
      name,
      type: project.type || "内部项目",
      customer: project.customer || "",
    });
  });
  return [...unique.values()]
    .filter((project) => !keyword || searchMatches(keyword, [project.name, project.type, project.customer]))
    .slice(0, 12);
}

function syncWorkProjectLabels(projectId = "") {
  let changed = false;
  [...workCards].forEach((card) => {
    const linkedId = card.dataset.projectId || "";
    if (projectId && linkedId !== projectId) return;
    const project = pjById(linkedId);
    const projectLine = card.querySelector(".work-body > p");
    const nextLabel = project?.name || "未关联项目";
    if (!project && linkedId) delete card.dataset.projectId;
    if (projectLine && projectLine.textContent !== `项目：${nextLabel}`) {
      projectLine.textContent = `项目：${nextLabel}`;
      markWorkRecordDirty(card);
      changed = true;
    }
  });
  if (changed) saveStudioState();
}

function renderLightboxProjectResults(query = "") {
  if (!lightboxProjectResults) return;
  const choices = lightboxProjectChoices(query);
  lightboxProjectResults.innerHTML = choices.length
    ? choices.map((project) => `
        <button type="button" data-lightbox-project="${escapeHtml(project.name)}" data-lightbox-project-id="${escapeHtml(project.id)}">
          <strong>${escapeHtml(project.name)}</strong>
          <span>${escapeHtml(project.type)}${project.customer ? ` · ${escapeHtml(project.customer)}` : ""}</span>
        </button>`).join("")
    : `<p>没有匹配的项目</p>${canCreateProject() ? `
       <button class="lightbox-project-create" type="button" data-lightbox-new-project="${escapeHtml(String(query || "").trim())}">
         <strong>＋ 新建项目</strong>
         <span>${query.trim() ? `使用“${escapeHtml(query.trim())}”作为项目名称` : "打开新建项目窗口"}</span>
       </button>` : ""}`;
}

function closeLightboxProjectPicker() {
  lightboxProjectPicker?.classList.add("hidden");
}

function openLightboxProjectPicker() {
  if (!lightboxProjectPicker || !lightboxProjectSearch) return;
  const current = lightboxProject.textContent.replace(/^项目：/, "").trim();
  lightboxProjectSearch.value = current === "未关联项目" ? "" : current;
  lightboxProjectPicker.classList.remove("hidden");
  renderLightboxProjectResults(lightboxProjectSearch.value);
  requestAnimationFrame(() => {
    lightboxProjectSearch.focus();
    lightboxProjectSearch.select();
  });
}

function emptyAddButtonMarkup(type) {
  return `<button class="empty-upload-button standard-add-button" type="button" data-empty-${type}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg><span>增加</span></button>`;
}

function updateUploadTypeUI() {
  const isPainter = uploadWorkType === "手绘师";
  if (uploadModalTitle) uploadModalTitle.textContent = isPainter ? "上传手绘稿" : "上传设计稿";
  document.querySelector(".palette-upload-section")?.classList.toggle("hidden", isPainter);
  document.querySelector(".painter-link-panel")?.classList.toggle("hidden", isPainter);
}

async function storedUploadFile(key, fallbackName, fallbackType = "application/octet-stream") {
  if (!key) return null;
  try {
    const record = await window.KingBlobStore?.getRecord?.(key);
    if (record?.blob instanceof Blob) {
      return new File([record.blob], fallbackName || record.name || "文件", {
        type: record.type || record.blob.type || fallbackType,
        lastModified: record.updatedAt || Date.now(),
      });
    }
    const source = await resolveImageSource(key);
    if (!source) return null;
    const response = await fetch(source);
    const blob = await response.blob();
    return new File([blob], fallbackName || key.split("/").pop() || "图片", {
      type: blob.type || fallbackType,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("无法回填文件", key, error);
    return null;
  }
}

async function hydrateUploadEditForm(card) {
  if (uploadWorkName) uploadWorkName.value = card.querySelector(".work-head strong")?.textContent.trim() || card.dataset.file || "";
  const workImages = (() => {
    try { return JSON.parse(card.dataset.workImages || "[]"); } catch { return []; }
  })();
  let imageEntries = workImages.length
    ? workImages
    : getPaletteFiles(card).slice(0, 1).map((item) => ({
        name: item.name,
        purpose: "主图",
        originalKey: item.key,
        type: item.type,
        primary: true,
      }));
  if (!imageEntries.length) {
    const fallbackKey = getPaletteKeys(card)[0] || card.dataset.imageKey || "";
    if (fallbackKey) {
      imageEntries = [{
        name: `${card.dataset.file}.jpg`,
        purpose: "主图",
        originalKey: fallbackKey,
        type: "image/jpeg",
        primary: true,
      }];
    }
  }
  const loadedImages = await Promise.all(imageEntries.map((item, index) =>
    storedUploadFile(item.originalKey || item.previewKey || item.thumbKey, item.name || `${card.dataset.file}-${index + 1}.jpg`, item.type || "image/jpeg")
  ));
  selectedUploadFiles = loadedImages.filter(Boolean);
  selectedUploadFiles.forEach((file, index) => {
    const entry = imageEntries[index] || {};
    uploadFileNames.set(fileIdentity(file), entry.name || file.name);
    uploadFilePurposes.set(fileIdentity(file), entry.primary ? "主图" : normalizeUploadPurposeValue(entry.purpose, DEFAULT_UPLOAD_PURPOSES[index] || `补充图 ${index + 1}`));
  });

  let paletteEntries = getPaletteFiles(card).slice(1);
  if (!paletteEntries.length) {
    paletteEntries = getPaletteKeys(card).slice(1).map((key, index) => ({
      key,
      name: `${card.dataset.file}-配色-${index + 2}.jpg`,
      type: "image/jpeg",
    }));
  }
  selectedPaletteFiles = (await Promise.all(paletteEntries.map((item) =>
    storedUploadFile(item.key, item.name, item.type)
  ))).filter(Boolean);

  const referenceKeys = getReferenceKeys(card);
  selectedReferenceFiles = (await Promise.all(referenceKeys.map((key, index) =>
    storedUploadFile(key, `参考图-${index + 1}.jpg`, "image/jpeg")
  ))).filter(Boolean);

  selectedSourceFiles = (await Promise.all(getSourceFiles(card).map((item) =>
    storedUploadFile(item.key, item.name, item.type)
  ))).filter(Boolean);

  selectedUploadTags = (card.dataset.tags || "")
    .split(",")
    .filter((tag) => tag && tag !== "设计稿" && tag !== "手绘稿");
  const painterCatalog = painterWorkCatalog();
  selectedPainterWorks = getLinkedSketches(card)
    .map((file) => painterCatalog.find((item) => item.file === file))
    .filter(Boolean);
  draftPainterSelection = [...selectedPainterWorks];
  updateLinkedPainterSummary();
  originalDeclaration.checked = fieldValue(card, "参考素材").includes("原创声明") && !selectedReferenceFiles.length;
  const projectId = card.dataset.projectId || customProjects.find((project) =>
    project.name === card.querySelector(".work-body > p")?.textContent.replace(/^项目：/, "").trim()
  )?.id || "";
  const projectSelect = document.querySelector("#uploadProjectSelect");
  const projectSearchInput = document.querySelector("#uploadProjectSearch");
  if (projectSelect) projectSelect.value = projectId;
  if (projectSearchInput) projectSearchInput.value = projectId ? pjById(projectId)?.name || "" : "不关联项目";

  renderSelectedFiles();
  renderSourceUploadFiles();
  renderPaletteUploadFiles();
  renderUploadTags();
  renderProjectResults(projectSearchInput?.value || "");
  referenceReadout.innerHTML = "";
  selectedReferenceFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    fileObjectURLs.push(url);
    referenceReadout.insertAdjacentHTML("beforeend", `<article class="reference-thumb"><span style="background-image:url('${url}')"></span><button type="button" data-remove-reference="${index}" aria-label="删除参考图">×</button></article>`);
  });
  if (!selectedReferenceFiles.length) referenceReadout.innerHTML = emptyAddButtonMarkup("reference");
}

async function openUploadModal(editCard = null) {
  // 上一次上传异常时也不能把按钮状态带入新的角色/新的上传弹窗。
  uploadConfirm.disabled = false;
  uploadConfirm.textContent = editCard ? "保存并重新提交" : "确认上传";
  hideAppLoading();
  uploadEditTargetCard = editCard;
  const accountUploadRole = currentAccount.role === "手绘师" ? "手绘师" : "设计师";
  uploadWorkType = editCard?.dataset.workRole || accountUploadRole;
  updateUploadTypeUI();
  selectedUploadTags = [];
  selectedUploadFiles = [];
  selectedReferenceFiles = [];
  selectedSourceFiles = [];
  selectedPaletteFiles = [];
  uploadFileNames.clear();
  uploadFilePurposes.clear();
  pendingUploadPurpose = "";
  referenceFileNames.clear();
  selectedPainterWorks = [];
  draftPainterSelection = [];
  selectedProjects = [];
  pendingUploadTags = [];
  artworkFiles.value = "";
  referenceFiles.value = "";
  artworkSourceFile.value = "";
  artworkPaletteFiles.value = "";
  originalDeclaration.checked = false;
  if (uploadWorkName) uploadWorkName.value = "";
  linkedPainterSummary.textContent = "未关联";
  linkedPainterList.innerHTML = "";
  renderLinkedProjects();
  if (projectSearch) projectSearch.value = "";
  releaseFileURLs();
  renderSelectedFiles();
  referenceReadout.innerHTML = emptyAddButtonMarkup("reference");
  renderSourceUploadFiles();
  renderPaletteUploadFiles();
  chooseReferenceFiles.classList.add("hidden");
  uploadValidationSummary.classList.add("hidden");
  uploadValidationTarget = null;
  renderUploadTags();
  renderProjectResults("");
  if (typeof pjFillUploadSelect === "function") pjFillUploadSelect();
  if (editCard) {
    uploadModalTitle.textContent = uploadWorkType === "手绘师" ? "编辑手绘稿" : "编辑设计稿";
    uploadConfirm.textContent = "保存并重新提交";
  } else {
    uploadConfirm.textContent = "确认上传";
  }
  if (editCard) {
    showAppLoading("正在载入稿件资料…");
    try {
      await hydrateUploadEditForm(editCard);
      if (uploadWorkType === "手绘师") {
        selectedPaletteFiles = [];
        selectedPainterWorks = [];
        draftPainterSelection = [];
        renderPaletteUploadFiles();
        updateLinkedPainterSummary();
        renderSelectedFiles();
      }
    } catch (error) {
      console.error(error);
      showToast("部分历史文件无法读取，其他资料已为你保留。", "warning");
    } finally {
      hideAppLoading();
    }
  }
  uploadModal.classList.add("active");
  uploadModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeUploadModal() {
  uploadModal.classList.remove("active");
  uploadModal.setAttribute("aria-hidden", "true");
  releaseFileURLs();
  uploadEditTargetCard = null;
  lockBodyScroll(false);
}

function requestCloseUploadModal() {
  const hasDraft = uploadWorkName?.value.trim() || selectedUploadFiles.length || selectedReferenceFiles.length || selectedSourceFiles.length || selectedPaletteFiles.length || selectedPainterWorks.length || selectedProjects.length || selectedUploadTags.length || originalDeclaration.checked || document.querySelector("#uploadProjectSelect")?.value;
  if (hasDraft) {
    openExitConfirmation({
      title: `放弃上传${uploadWorkType === "手绘师" ? "手绘稿" : "设计稿"}？`,
      message: "退出后，本次添加的图片、源文件、关联项目和标签都不会保留。",
      onConfirm: closeUploadModal,
    });
    return;
  }
  closeUploadModal();
}

function checkedMemberValues(container) {
  return [...(container?.querySelectorAll("input:checked") || [])].map((input) => input.value);
}



function updateMemberSummary(container, summary, emptyText, role) {
  if (!summary) return;
  const values = checkedMemberValues(container);
  summary.innerHTML = `<div class="project-member-summary-chips">${values.length
    ? values.map((value) => `<span>${escapeHtml(value)}<button type="button" data-project-member-remove="${escapeHtml(value)}" aria-label="删除 ${escapeHtml(value)}">×</button></span>`).join("")
    : `<em>${escapeHtml(emptyText)}</em>`}<button class="member-inline-add" type="button" data-open-member-picker="${role}">＋ 添加</button></div>`;
}


function memberPickerSelectedValues(context = memberPickerContext) {
  if (!context) return [];
  if (context.mode === "create") {
    const containers = { designer: projectDesignerOptions, painter: projectPainterOptions, owner: projectOwnerOptions };
    return checkedMemberValues(containers[context.role]);
  }
  return [...projectDetailBody.querySelectorAll(`[data-project-detail-member-option="${context.role}"].active`)].map((button) => button.dataset.value);
}

function renderMemberPicker() {
  if (!memberPickerContext || !memberPickerList) return;
  const query = memberPickerSearch.value.trim();
  const candidates = projectMemberCandidates(memberPickerContext.role).filter((member) => {
    const stats = teamMemberStats(member);
    const loadClass = teamLoadClass(stats.projects.length);
    const filterMatch = memberPickerLoadFilter === "all"
      || (memberPickerLoadFilter === "available" && loadClass !== "hot")
      || memberPickerLoadFilter === loadClass;
    return filterMatch && (!query || searchMatches(query, [member.name, member.role, member.ownerKey]));
  });
  memberPickerList.innerHTML = candidates.length ? candidates.map((member) => {
    const stats = teamMemberStats(member);
    const loadClass = teamLoadClass(stats.projects.length);
    const selected = memberPickerDraft.has(member.name);
    return `<button class="member-picker-row ${selected ? "selected" : ""}" type="button" data-member-picker-value="${escapeHtml(member.name)}">
      <span class="team-avatar ${escapeHtml(member.tone)}">${memberAvatarInner(member)}</span>
      <span class="member-picker-person"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.role)} · 正在参与 ${stats.projects.length} 个项目</small></span>
      <span class="member-picker-load"><i class="${loadClass}"></i>${escapeHtml(teamLoadLabel(stats.projects.length))}负载</span>
      <span class="member-picker-projects">${stats.projects.length}<small>当前项目</small></span>
      <span class="member-picker-check" aria-hidden="true">${selected ? "✓" : ""}</span>
    </button>`;
  }).join("") : `<p class="member-picker-empty">找不到该结果</p>`;
  memberPickerSelectedCount.textContent = `已选择 ${memberPickerDraft.size} 人`;
  memberPickerSelectedAvatars.innerHTML = [...memberPickerDraft].slice(0, 5).map((name) => `<span title="${escapeHtml(name)}">${escapeHtml(name.slice(0, 1))}</span>`).join("");
}

function openMemberPicker(role, mode = "create") {
  memberPickerContext = { role, mode };
  memberPickerDraft = new Set(memberPickerSelectedValues(memberPickerContext));
  memberPickerLoadFilter = "all";
  memberPickerSearch.value = "";
  memberPickerTitle.textContent = `选择${projectMemberRoleLabel(role)}`;
  memberPickerFilters.querySelectorAll("[data-member-load-filter]").forEach((button) => button.classList.toggle("active", button.dataset.memberLoadFilter === "all"));
  renderMemberPicker();
  memberPickerModal.classList.add("active");
  memberPickerModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
  setTimeout(() => memberPickerSearch.focus(), 50);
}

function closeMemberPicker() {
  memberPickerModal?.classList.remove("active");
  memberPickerModal?.setAttribute("aria-hidden", "true");
  memberPickerContext = null;
  lockBodyScroll(Boolean(projectModal?.classList.contains("active") || projectDetailModal?.classList.contains("active")));
}

function confirmMemberPicker() {
  if (!memberPickerContext) return;
  const selected = [...memberPickerDraft];
  if (memberPickerContext.mode === "create") {
    const containers = { designer: projectDesignerOptions, painter: projectPainterOptions, owner: projectOwnerOptions };
    setCheckedMemberValues(containers[memberPickerContext.role], selected);
    updateProjectMemberSummaries();
  } else {
    projectDetailBody.querySelectorAll(`[data-project-detail-member-option="${memberPickerContext.role}"]`).forEach((button) => {
      button.classList.toggle("active", memberPickerDraft.has(button.dataset.value));
    });
    renderProjectDetailMemberSelection(projectDetailBody.querySelector(`[data-project-detail-member-picker="${memberPickerContext.role}"]`));
  }
  closeMemberPicker();
}

function setCheckedMemberValues(container, values) {
  const selected = new Set(values || []);
  container?.querySelectorAll("input").forEach((input) => {
    input.checked = selected.has(input.value);
  });
}




















function isBrowserFile(file) {
  return typeof File !== "undefined" && file instanceof File;
}













function arrayText(items) {
  return (items || []).filter(Boolean).join("、") || "未设置";
}


function fileNameText(items) {
  return (items || []).map(projectStoredFileName).filter(Boolean).join("、") || "无";
}

function logKey(item) {
  return `${item.time || ""}|${item.text || ""}`;
}


function fileExtension(name) {
  const ext = String(name || "").split(".").pop();
  return ext && ext !== name ? ext.toUpperCase() : "FILE";
}























function archiveTimeMatches(project, days) {
  if (days === "all") return true;
  const archivedAt = new Date(String(project.archivedAt || "").replace(" ", "T"));
  if (Number.isNaN(archivedAt.getTime())) return false;
  return Date.now() - archivedAt.getTime() <= Number(days) * 86400000;
}




function lifecycleFieldValue(name) {
  return projectLifecycleBody?.querySelector(`[name="${name}"]`)?.value.trim() || "";
}






















function releaseFileURLs() {
  fileObjectURLs.forEach((url) => URL.revokeObjectURL(url));
  fileObjectURLs = [];
}

function fileIdentity(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function uploadDisplayName(file) {
  return uploadFileNames.get(fileIdentity(file)) || file.name;
}
const DEFAULT_UPLOAD_PURPOSES = ["主图", "细节图", "样机图", "效果图"];
function uploadPurposeLabel(purpose) {
  return purpose === "主图" ? "作品主图" : purpose;
}
function normalizeUploadPurposeValue(value, fallback = "补充图") {
  const normalized = String(value || "").trim();
  if (normalized === "作品主图") return "主图";
  return normalized || fallback;
}
function uploadPurpose(file, index) {
  return uploadFilePurposes.get(fileIdentity(file)) || DEFAULT_UPLOAD_PURPOSES[index] || `补充图 ${index + 1}`;
}

function referenceDisplayName(file) {
  return referenceFileNames.get(fileIdentity(file)) || file.name;
}

function renderSelectedFiles() {
  if (uploadWorkType === "手绘师") {
    fileReadout.innerHTML = selectedUploadFiles.map((file, index) => {
      const url = URL.createObjectURL(file);
      fileObjectURLs.push(url);
      return `<article class="upload-thumb-card" draggable="true" data-upload-drag-index="${index}" aria-label="拖拽调整图片顺序">
        <span class="file-thumb" style="background-image:url('${url}')"></span>
        <button class="thumb-remove" type="button" data-remove-upload="${index}" aria-label="删除 ${escapeHtml(file.name)}">×</button>
      </article>`;
    }).join("") + `<article class="upload-slot-card painter-upload-slot">
      <button class="upload-slot-add" data-upload-slot-add type="button" aria-label="添加手绘图片">
        <span class="upload-slot-plus">＋</span><span>添加图片</span>
      </button>
    </article>`;
    return;
  }
  const usedFileIndexes = new Set();
  const slots = DEFAULT_UPLOAD_PURPOSES.map((purpose) => {
    const fileIndex = selectedUploadFiles.findIndex((file, index) =>
      !usedFileIndexes.has(index) && uploadPurpose(file, index) === purpose
    );
    if (fileIndex >= 0) usedFileIndexes.add(fileIndex);
    return { purpose, fileIndex };
  });
  selectedUploadFiles.forEach((file, fileIndex) => {
    if (!usedFileIndexes.has(fileIndex)) slots.push({ purpose: uploadPurpose(file, fileIndex), fileIndex });
  });
  fileReadout.innerHTML = slots.map((slot) => {
    const index = slot.fileIndex;
    const file = index >= 0 ? selectedUploadFiles[index] : null;
    if (!file) {
      return `<article class="upload-slot-card">
        <button class="upload-slot-add" data-upload-slot-add data-upload-slot-default="${escapeHtml(slot.purpose)}" type="button" aria-label="添加${escapeHtml(uploadPurposeLabel(slot.purpose))}">
          <span class="upload-slot-plus">＋</span><span>添加图片</span>
        </button>
        <span class="upload-purpose-badge">${escapeHtml(uploadPurposeLabel(slot.purpose))}</span>
      </article>`;
    }
      const url = URL.createObjectURL(file);
      fileObjectURLs.push(url);
      return `<article class="upload-thumb-card" draggable="true" data-upload-drag-index="${index}" aria-label="拖拽调整图片顺序">
        <span class="file-thumb" style="background-image:url('${url}')"></span>
        <span class="upload-purpose-badge">${escapeHtml(uploadPurposeLabel(slot.purpose))}</span>
        <button class="thumb-remove" type="button" data-remove-upload="${index}" aria-label="删除 ${escapeHtml(file.name)}">×</button>
      </article>`;
  }).join("");
}

function renderReferenceFiles() {
  if (!selectedReferenceFiles.length) {
    referenceReadout.innerHTML = emptyAddButtonMarkup("reference");
    chooseReferenceFiles.classList.add("hidden");
    return;
  }

  chooseReferenceFiles.classList.remove("hidden");

  referenceReadout.innerHTML = selectedReferenceFiles
    .map((file, index) => {
      const url = URL.createObjectURL(file);
      fileObjectURLs.push(url);
      return `<article class="upload-thumb-card reference-thumb-card">
        <span class="file-thumb" style="background-image:url('${url}')"></span>
        <div><button class="editable-upload-name" type="button" data-edit-reference-name="${index}" title="点击修改名称">${escapeHtml(referenceDisplayName(file))}</button><small>参考图 ${index + 1}</small></div>
        <button class="thumb-remove" type="button" data-remove-reference="${index}" aria-label="删除 ${escapeHtml(file.name)}">×</button>
      </article>`;
    })
    .join("");
}

function renderSourceUploadFiles() {
  if (!selectedSourceFiles.length) {
    sourceUploadReadout.classList.add("hidden");
    sourceUploadReadout.innerHTML = "";
    chooseSourceFile.classList.remove("hidden");
    return;
  }
  sourceUploadReadout.innerHTML = selectedSourceFiles.map((file, index) => {
    const sizeMb = Math.max(0.01, file.size / 1024 / 1024).toFixed(2);
    return `<article class="source-upload-item"><div><strong>${escapeHtml(file.name)}</strong><span>${sizeMb} MB · 源文件 ${index + 1}</span></div><button type="button" data-remove-source-file="${index}" aria-label="删除 ${escapeHtml(file.name)}">×</button></article>`;
  }).join("");
  sourceUploadReadout.classList.remove("hidden");
  chooseSourceFile.classList.toggle("hidden", selectedSourceFiles.length >= MAX_UPLOAD_FILES);
}

function paletteFileExtension(file) {
  return String(file?.name || "FILE").split(".").pop().toUpperCase();
}

function isSupportedPaletteFile(file) {
  return SUPPORTED_IMAGE_EXTENSIONS.includes(uploadFileExtension(file));
}

function isPreviewablePaletteData(source, file = null) {
  if (/^data:image\/(jpeg|jpg|png|webp|gif);/i.test(source || "")) return true;
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || source || "");
  return ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"].includes(type)
    || /\.(?:jpe?g|png|webp|gif)(?:$|[?#])/i.test(name);
}

function renderPaletteUploadFiles() {
  if (!selectedPaletteFiles.length) {
    paletteUploadReadout.classList.add("hidden");
    paletteUploadReadout.innerHTML = "";
    choosePaletteFiles.classList.remove("hidden");
    return;
  }
  paletteUploadReadout.innerHTML = selectedPaletteFiles.map((file, index) => {
    const previewable = /^image\/(jpeg|png|webp|gif)$/i.test(file.type || "");
    const previewUrl = previewable ? URL.createObjectURL(file) : "";
    if (previewUrl) fileObjectURLs.push(previewUrl);
    const thumb = previewUrl
      ? `<span class="palette-upload-thumb" style="background-image:url('${previewUrl}')"></span>`
      : `<span class="palette-upload-thumb file-type">${escapeHtml(paletteFileExtension(file))}</span>`;
    return `<article class="palette-upload-item">${thumb}<div><strong>${escapeHtml(file.name)}</strong><span>配色 ${index + 1}</span></div><button type="button" data-remove-palette-file="${index}" aria-label="删除 ${escapeHtml(file.name)}">×</button></article>`;
  }).join("");
  paletteUploadReadout.classList.remove("hidden");
  choosePaletteFiles.classList.toggle("hidden", selectedPaletteFiles.length >= MAX_UPLOAD_FILES);
}


function updatePainterPickerCount() {
  painterSelectedCount.textContent = `已选 ${draftPainterSelection.length} 幅`;
}

function painterPickerImageMarkup(item) {
  if (item.imageData) {
    return `<img src="${escapeHtml(item.imageData)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`;
  }
  return item.imageKey
    ? `<img data-image-key="${escapeHtml(item.imageKey)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`
    : "";
}

function renderPainterPicker() {
  const query = painterPickerSearch.value.trim().toLowerCase();
  const catalog = painterWorkCatalog();
  const painterNames = [...new Set(catalog.map((item) => item.painter))];
  const previousPainter = painterFilter.value;
  painterFilter.innerHTML = `<option value="all">全部手绘师</option>${painterNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  painterFilter.value = painterNames.includes(previousPainter) ? previousPainter : "all";
  const activePainter = painterFilter.value;
  const results = catalog.filter((item) => {
    const indexText = `${item.file} ${item.painter} ${item.project} ${item.tags.join(" ")}`.toLowerCase();
    const painterMatch = activePainter === "all" || item.painter === activePainter;
    return painterMatch && (!query || searchMatches(query, [indexText]));
  });

  painterPickerCount.textContent = `共 ${results.length} 幅`;
  painterSelectAll.textContent = results.length && results.every((item) => draftPainterSelection.some((selected) => selected.file === item.file)) ? "取消全选" : "全选";

  if (!results.length) {
    painterPickerGrid.innerHTML = `<p class="empty-state">没有匹配的手绘作品。</p>`;
    updatePainterPickerCount();
    return;
  }

  painterPickerGrid.innerHTML = results
    .map((item) => {
      const active = draftPainterSelection.some((selected) => selected.file === item.file) ? "active" : "";
      return `<button class="upload-thumb-card painter-pick-card ${active}" type="button" data-file="${item.file}">
        <span class="painter-pick-thumb${item.pattern ? ` pattern ${item.pattern}` : ""}" data-image-shell>${painterPickerImageMarkup(item)}</span>
        <div class="painter-pick-copy"><strong>${item.file}</strong>
        <span>${escapeHtml(item.painter)} · ${escapeHtml(item.createdAt || "未记录时间")}</span></div>
      </button>`;
    })
    .join("");
  hydrateLazyKeyImages(painterPickerGrid);
  updatePainterPickerCount();
}

function openPainterPickerModal({ selection = selectedPainterWorks, onConfirm = null } = {}) {
  painterPickerConfirmHandler = onConfirm;
  draftPainterSelection = [...selection];
  painterPickerSearch.value = "";
  painterFilter.value = "all";
  renderPainterPicker();
  painterPickerModal?.classList.add("active");
  painterPickerModal?.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closePainterPickerModal() {
  painterPickerModal?.classList.remove("active");
  painterPickerModal?.setAttribute("aria-hidden", "true");
  painterPickerConfirmHandler = null;
  lockBodyScroll(false);
}

function updateLinkedPainterSummary() {
  if (!selectedPainterWorks.length) {
    linkedPainterSummary.textContent = "未关联";
    linkedPainterList.innerHTML = "";
    return;
  }
  linkedPainterSummary.textContent = `已关联 ${selectedPainterWorks.length} 幅`;
  linkedPainterList.innerHTML = selectedPainterWorks.map((item) => `<article class="linked-selection-item">
    <span class="painter-pick-thumb${item.pattern ? ` pattern ${item.pattern}` : ""}" data-image-shell>${painterPickerImageMarkup(item)}</span>
    <div><strong>${escapeHtml(item.file)}</strong><small>${escapeHtml(item.painter)} · ${escapeHtml(item.title)}</small></div>
    <button type="button" data-remove-painter="${escapeHtml(item.file)}" aria-label="移除 ${escapeHtml(item.file)}">×</button>
  </article>`).join("");
  hydrateLazyKeyImages(linkedPainterList);
}


function mergeUniqueFiles(existing, incoming) {
  const keys = new Set(existing.map(fileIdentity));
  return [...existing, ...incoming.filter((file) => {
    const key = fileIdentity(file);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  })];
}

function beginUploadNameEdit(button) {
  const index = Number(button.dataset.editUploadName);
  const file = selectedUploadFiles[index];
  if (!file) return;
  const input = document.createElement("input");
  input.className = "upload-name-editor";
  input.value = uploadDisplayName(file);
  button.replaceWith(input);
  input.focus();
  const dotIndex = input.value.lastIndexOf(".");
  input.setSelectionRange(0, dotIndex > 0 ? dotIndex : input.value.length);
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const nextName = input.value.trim();
    if (save && nextName) uploadFileNames.set(fileIdentity(file), nextName);
    renderSelectedFiles();
  };
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
}

function beginReferenceNameEdit(button) {
  const index = Number(button.dataset.editReferenceName);
  const file = selectedReferenceFiles[index];
  if (!file) return;
  const input = document.createElement("input");
  input.className = "upload-name-editor";
  input.value = referenceDisplayName(file);
  button.replaceWith(input);
  input.focus();
  const dotIndex = input.value.lastIndexOf(".");
  input.setSelectionRange(0, dotIndex > 0 ? dotIndex : input.value.length);
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const nextName = input.value.trim();
    if (save && nextName) referenceFileNames.set(fileIdentity(file), nextName);
    renderReferenceFiles();
  };
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
}

function cardStatusSummary(card) {
  return [
    badgeValue(card, "销售状态："),
    badgeValue(card, "客户状态："),
    fieldValue(card, "审核状态"),
    fieldValue(card, "作品状态"),
  ]
    .filter(Boolean)
    .join(" / ");
}

function isSleepingWork(card) {
  return card.classList.contains("sleeping") || card.dataset.sleeping === "true";
}

function isCreatorRole(role = currentAccount.role) {
  return role === "设计师" || role === "手绘师";
}

function personalArchiveBucket(ownerKey = currentAccount.ownerKey) {
  studioState.personalWorkArchives ||= {};
  studioState.personalWorkArchives[ownerKey] ||= { sleeping: {}, deleted: {}, removed: {} };
  studioState.personalWorkArchives[ownerKey].sleeping ||= {};
  studioState.personalWorkArchives[ownerKey].deleted ||= {};
  studioState.personalWorkArchives[ownerKey].removed ||= {};
  return studioState.personalWorkArchives[ownerKey];
}

function isPersonallySleeping(card, ownerKey = currentAccount.ownerKey) {
  return Boolean(personalArchiveBucket(ownerKey).sleeping?.[card.dataset.file]);
}

function isPersonallyDeleted(card, ownerKey = currentAccount.ownerKey) {
  const bucket = personalArchiveBucket(ownerKey);
  return Boolean(bucket.deleted?.[card.dataset.file] || bucket.removed?.[card.dataset.file]);
}

function setPersonalArchiveState(card, mode, active) {
  const bucket = personalArchiveBucket();
  const target = mode === "sleep" ? bucket.sleeping : bucket.deleted;
  if (active) target[card.dataset.file] = new Date().toISOString();
  else delete target[card.dataset.file];
  if (mode === "delete" && active) delete bucket.sleeping[card.dataset.file];
}

function isArchivedForCurrentWorks(card) {
  if (isCreatorRole() && card.dataset.workOwner === currentAccount.ownerKey) {
    return isPersonallyDeleted(card) || isPersonallySleeping(card);
  }
  return card.classList.contains("deleted") || isSleepingWork(card);
}

function workDisplayStatus(card) {
  if (card.classList.contains("deleted")) return "回收站";
  if (isSleepingWork(card)) return "休眠中";
  if (isReviewPending(card)) return "待评审";
  const action = reviewLogs(card)[0]?.action || card.dataset.reviewAction || "";
  if (action) return `已评审 · ${action}`;
  if (cardStatusSummary(card).includes("已通过")) return "已评审 · 通过";
  return "已评审";
}

function updateCardReviewStatus(card, value) {
  const rows = [...card.querySelectorAll("dl div")];
  const reviewRow = rows.find((item) => item.querySelector("dt")?.textContent.trim() === "审核状态");
  const reviewValue = reviewRow?.querySelector("dd");
  if (reviewValue) reviewValue.textContent = value;

  const badge = card.querySelector(".work-head .sale-badge");
  if (badge) {
    badge.textContent = value.split("/")[0].trim();
    badge.className = `sale-badge ${statusBadgeClass(value)}`;
  }
  card.classList.toggle("needs-revision", value.includes("需修改") || value.includes("未修改"));
  syncPersonalReviewStatus(card);
  markWorkRecordDirty(card);
}

async function setWorkSleeping(card, sleeping, { silent = false } = {}) {
  if (currentAccount.role === "手绘师") return;
  if (isCreatorRole()) {
    if (card.dataset.workOwner !== currentAccount.ownerKey) return;
    if (sleeping) ensureArchivePreviewPersisted(card);
    setPersonalArchiveState(card, "sleep", sleeping);
    if (!silent) {
      renderSleepList();
      renderRecycleBin();
      configureWorksView(roleSelect.value, currentAccount.ownerKey);
      try {
        await saveStudioStateToCloud();
        showToast(sleeping ? `${card.dataset.file} 已移入休眠区。` : `${card.dataset.file} 已取消休眠。`, "success");
      } catch {
        showToast("休眠状态已在本页更新，但云端同步失败，请保持页面并重试。", "error");
      }
    }
    return;
  }
  if (currentAccount.role !== "管理员") return;
  if (sleeping) ensureArchivePreviewPersisted(card);
  card.classList.toggle("sleeping", sleeping);
  card.dataset.sleeping = sleeping ? "true" : "";
  if (sleeping) {
    const currentStatus = fieldValue(card, "审核状态");
    const currentAction = card.dataset.reviewAction || "";
    card.dataset.sleepPreviousReviewStatus = currentStatus && !/Pass|休眠/.test(currentStatus)
      ? currentStatus
      : "待审核 / 管理者未评审";
    card.dataset.sleepPreviousReviewAction = /^(Pass|休眠)$/.test(currentAction) ? "" : currentAction;
    card.dataset.sleepPreviousReviewLogs = card.dataset.reviewLogs || "";
    updateCardReviewStatus(card, "休眠 / 管理者已移入休眠区");
  } else {
    const previousStatus = card.dataset.sleepPreviousReviewStatus || "";
    const restoredStatus = previousStatus && !/Pass|休眠/.test(previousStatus)
      ? previousStatus
      : "待审核 / 管理者未评审";
    const previousAction = card.dataset.sleepPreviousReviewAction || "";
    const restoredAction = /^(Pass|休眠)$/.test(previousAction) ? "" : previousAction;
    let restoredLogs = [];
    try {
      restoredLogs = JSON.parse(card.dataset.sleepPreviousReviewLogs || "[]")
        .filter((item) => !/^(Pass|休眠)$/.test(item?.action || ""));
    } catch {
      restoredLogs = [];
    }
    card.dataset.reviewAction = restoredAction;
    card.dataset.reviewLogs = restoredLogs.length ? JSON.stringify(restoredLogs) : "";
    card.dataset.reviewNote = restoredLogs[0]?.note || "";
    updateCardReviewStatus(card, restoredStatus);
    delete card.dataset.sleepPreviousReviewStatus;
    delete card.dataset.sleepPreviousReviewAction;
    delete card.dataset.sleepPreviousReviewLogs;
  }
  markWorkRecordDirty(card);
  if (!silent) {
    renderSleepList();
    renderDailyReviewBoard();
    sortWorkCards();
    try {
      await saveStudioStateToCloud();
      showToast(sleeping ? `${card.dataset.file} 已移入休眠区。` : `${card.dataset.file} 已取消休眠并恢复到原状态。`, "success");
    } catch {
      showToast("休眠状态已在本页更新，但云端同步失败，请保持页面并重试。", "error");
    }
  }
}

function setWorkSleepingForBatch(card) {
  if (currentAccount.role === "手绘师") return;
  if (isCreatorRole()) {
    setWorkSleeping(card, true, { silent: true });
    return;
  }
  if (currentAccount.role !== "管理员") return;
  card.classList.add("sleeping");
  card.dataset.sleeping = "true";
  const currentStatus = fieldValue(card, "审核状态");
  const currentAction = card.dataset.reviewAction || "";
  card.dataset.sleepPreviousReviewStatus = currentStatus && !/Pass|休眠/.test(currentStatus)
    ? currentStatus
    : "待审核 / 管理者未评审";
  card.dataset.sleepPreviousReviewAction = /^(Pass|休眠)$/.test(currentAction) ? "" : currentAction;
  card.dataset.sleepPreviousReviewLogs = card.dataset.reviewLogs || "";
  updateCardReviewStatus(card, "休眠 / 管理者已移入休眠区");
}

function selectedLibraryManageCards() {
  return [...workCards].filter((card) => libraryManageSelection.has(card.dataset.file));
}

libraryManageToggle?.addEventListener("click", () => {
  libraryManageMode = !libraryManageMode;
  libraryManageSelection.clear();
  renderLibraryManageState();
});

libraryManageSelectAll?.addEventListener("click", () => {
  const eligible = libraryManageEligibleCards();
  if (eligible.length > 0 && libraryManageSelection.size === eligible.length) {
    libraryManageSelection.clear();
  } else {
    libraryManageSelection.clear();
    eligible.forEach((card) => libraryManageSelection.add(card.dataset.file));
  }
  renderLibraryManageState();
});

libraryManageDelete?.addEventListener("click", async () => {
  let cards = selectedLibraryManageCards();
  if (isCreatorRole()) {
    cards = cards.filter((card) => card.dataset.workOwner === currentAccount.ownerKey);
  }
  if (!cards.length || !["管理员", "设计师", "手绘师"].includes(currentAccount.role)) return;
  if (!ensureWorksCanMoveToRecycle(cards)) return;
  const deleteMessage = currentAccount.role === "手绘师"
    ? `确认删除已选中的 ${cards.length} 件手绘稿吗？删除后将立即从“我的稿件”移除。`
    : `确认删除已选中的 ${cards.length} 件作品吗？删除后会进入回收站。`;
  if (!window.confirm(deleteMessage)) return;
  if (currentAccount.role === "设计师") {
    cards.forEach((card) => setPersonalArchiveState(card, "delete", true));
    libraryManageSelection.clear();
    renderRecycleBin();
    renderSleepList();
    configureWorksView(roleSelect.value, currentAccount.ownerKey);
    try {
      await saveStudioStateToCloud();
      showToast(`已将 ${cards.length} 件作品移入回收站。`, "warning");
    } catch {
      showToast("稿件已在本页移入回收站，但云端同步失败，请保持页面并重试。", "error");
    }
    return;
  }
  const deletedAt = new Date().toISOString();
  cards.forEach((card) => markWorkDeletedGlobally(card, deletedAt));
  libraryManageSelection.clear();
  renderRecycleBin();
  renderDailyReviewBoard();
  configureWorksView(roleSelect.value, currentAccount.ownerKey);
  try {
    await saveStudioStateToCloud();
    showToast(`已将 ${cards.length} 件作品移入回收站。`, "warning");
  } catch {
    showToast("稿件已在本页移入回收站，但云端同步失败，请保持页面并重试。", "error");
  }
});

libraryManageSleep?.addEventListener("click", async () => {
  if (currentAccount.role === "手绘师") return;
  const cards = selectedLibraryManageCards();
  if (!cards.length || !window.confirm(`确认将已选中的 ${cards.length} 件作品移入休眠区吗？`)) return;
  cards.forEach(setWorkSleepingForBatch);
  libraryManageSelection.clear();
  renderSleepList();
  renderDailyReviewBoard();
  configureWorksView(roleSelect.value, currentAccount.ownerKey);
  try {
    await saveStudioStateToCloud();
    showToast(`已将 ${cards.length} 件作品移入休眠区。`, "success");
  } catch {
    showToast("稿件已在本页移入休眠区，但云端同步失败，请保持页面并重试。", "error");
  }
});

worksBoard?.addEventListener("click", (event) => {
  if (!libraryManageMode || !["管理员", "设计师", "手绘师"].includes(currentAccount.role)) return;
  const card = event.target.closest(".work-card");
  if (!card || !filteredWorksScope.has(card)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const file = card.dataset.file;
  if (libraryManageSelection.has(file)) libraryManageSelection.delete(file);
  else libraryManageSelection.add(file);
  renderLibraryManageState();
}, true);

function sleepItemsForRole() {
  if (currentAccount.role === "管理员" || currentAccount.role === "销售") {
    return uniqueWorkCardsByFile([...workCards].filter((card) => !card.classList.contains("deleted") && isSleepingWork(card)));
  }
  if (isCreatorRole()) {
    return uniqueWorkCardsByFile([...workCards].filter((card) => card.dataset.workOwner === currentAccount.ownerKey && isPersonallySleeping(card)));
  }
  return [];
}

function uniqueWorkCardsByFile(cards) {
  const unique = new Map();
  (cards || []).forEach((card) => {
    const file = String(card?.dataset?.file || "").trim();
    if (file && !unique.has(file)) unique.set(file, card);
  });
  return [...unique.values()];
}

let sleepManageMode = false;
const sleepManageSelection = new Set();
let sleepArchiveType = "all";
let recycleArchiveType = "all";

function archiveTypeMatches(card, type) {
  if (type === "design") return card.dataset.workRole === "设计师";
  if (type === "painter") return card.dataset.workRole === "手绘师";
  return true;
}

const archiveRestoreIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7H5l3-3"></path><path d="M5 7l3 3"></path><path d="M5.5 7H14a6 6 0 1 1 0 12H9"></path></svg>';
const archiveDeleteIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg>';

function archiveWorkCardHtml(card, mode) {
  const clone = card.cloneNode(true);
  clone.classList.remove("deleted", "sleeping", "hidden", "library-manage-selected");
  clone.classList.add(mode === "sleep" ? "sleep-item" : "recycle-item");
  clone.dataset.file = card.dataset.file;
  clone.querySelectorAll(".work-trash-button,.sleep-restore-button,.restore-work,.recycle-delete-work,.library-manage-check").forEach((item) => item.remove());
  const trigger = clone.querySelector(".preview-trigger");
  trigger?.classList.add(mode === "sleep" ? "sleep-thumb" : "recycle-thumb");
  if (trigger) {
    let image = trigger.querySelector("img");
    const currentSource = image?.getAttribute("src") || "";
    const originalTrigger = card.querySelector(".preview-trigger");
    const originalImage = originalTrigger?.querySelector("img");
    const inlineBackground = originalTrigger?.style?.backgroundImage?.match(/^url\(["']?(.*?)["']?\)$/i)?.[1] || "";
    const durableKey = [
      ...workImageCandidateKeys(card, 0),
      originalImage?.dataset?.imageKey,
      originalImage?.getAttribute("src"),
      inlineBackground,
    ].find((key) => key && !/^blob:/i.test(key)) || "";
    if (!image && durableKey) {
      image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.dataset.workPreview = "true";
      trigger.prepend(image);
    }
    if (image && (/^blob:/i.test(currentSource) || !currentSource)) {
      image.removeAttribute("src");
      image.removeAttribute("data-image-queued");
      if (durableKey) image.dataset.imageKey = durableKey;
      trigger.dataset.imageShell = "true";
    }
  }
  const canManageArchive = currentAccount.role === "管理员" || isCreatorRole();
  if (mode === "sleep" && sleepManageMode && canManageArchive) {
    clone.insertAdjacentHTML("afterbegin", `<label class="library-manage-check sleep-manage-check" aria-label="选择 ${escapeHtml(card.dataset.file)}"><input type="checkbox" data-sleep-select="${escapeHtml(card.dataset.file)}" ${sleepManageSelection.has(card.dataset.file) ? "checked" : ""}><span></span></label>`);
  }
  if (mode === "sleep" && !sleepManageMode && canManageArchive) {
    clone.insertAdjacentHTML("beforeend", `<button class="sleep-restore-button" type="button" data-sleep-action="restore" aria-label="恢复 ${escapeHtml(card.dataset.file)}" title="恢复稿件">${archiveRestoreIcon}</button><button class="work-trash-button" type="button" data-delete-file="${escapeHtml(card.dataset.file)}" aria-label="将 ${escapeHtml(card.dataset.file)} 移入回收站" title="移入回收站">${archiveDeleteIcon}</button>`);
  }
  if (mode === "recycle" && canManageArchive) {
    clone.insertAdjacentHTML("beforeend", `<button class="restore-work" type="button" aria-label="恢复 ${escapeHtml(card.dataset.file)}" title="恢复">${archiveRestoreIcon}</button><button class="recycle-delete-work" type="button" aria-label="永久删除 ${escapeHtml(card.dataset.file)}" title="永久删除">${archiveDeleteIcon}</button>`);
  }
  clone.dataset.manageSelected = String(sleepManageSelection.has(card.dataset.file));
  return clone.outerHTML;
}

function bindArchiveTypeSegment(id, onChange) {
  const segment = document.getElementById(id);
  segment?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-archive-type]");
    if (!button) return;
    const value = button.dataset.archiveType;
    segment.dataset.value = value;
    segment.querySelectorAll("[data-archive-type]").forEach((item) => item.classList.toggle("active", item === button));
    onChange(value);
  });
}

function populateSelect(select, values, allLabel) {
  if (!select) return;
  const current = select.value || "all";
  select.innerHTML = `<option value="all">${allLabel}</option>${values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("")}`;
  select.value = values.includes(current) ? current : "all";
}

function updateSleepFilters(items) {
  const designers = [...new Set(items.map((card) => workOwnerName(card)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const tags = [
    ...new Set(
      items.flatMap((card) => (card.dataset.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean))
    ),
  ].sort((a, b) => a.localeCompare(b, "zh-CN"));
  populateSelect(sleepDesignerFilter, designers, "全部");
  populateSelect(sleepTagFilter, tags, "全部标签");
}

function populateArchiveTagFilters() {
  [[sleepPatternForm, "patternForm", "全部图案形式"], [sleepTheme, "theme", "全部主题"], [sleepStyle, "style", "全部风格"], [recyclePatternForm, "patternForm", "全部图案形式"], [recycleTheme, "theme", "全部主题"], [recycleStyle, "style", "全部风格"]].forEach(([select, key, label]) => populateSelect(select, managedTagCategories[key] || [], label));
  [sleepPatternForm, sleepTheme, sleepStyle, sleepSort, recyclePatternForm, recycleTheme, recycleStyle, recycleSort].forEach(syncArchiveLibSelect);
  renderArchiveSelectedConditions();
}

function renderArchiveSelectedConditions() {
  [[sleepSelectedConditions, [sleepPatternForm, sleepTheme, sleepStyle], "sleep"], [recycleSelectedConditions, [recyclePatternForm, recycleTheme, recycleStyle], "recycle"]].forEach(([target, selects, group]) => {
    if (!target) return;
    const active = selects.filter((select) => select && select.value !== "all");
    target.innerHTML = active.length ? `<span class="library-selected-label">已选条件：</span>${active.map((select) => `<button class="library-selected-chip" type="button" data-archive-clear-one="${group}:${select.id}">${escapeHtml(select.options[select.selectedIndex]?.textContent || select.value)} <i aria-hidden="true">×</i></button>`).join("")}<button class="library-clear" type="button" data-archive-clear-all="${group}">清空筛选</button>` : "";
  });
}

document.addEventListener("click", (event) => {
  const one = event.target.closest("[data-archive-clear-one]");
  const all = event.target.closest("[data-archive-clear-all]");
  if (!one && !all) return;
  const [group, id] = String(one?.dataset.archiveClearOne || "").split(":");
  const targetGroup = all?.dataset.archiveClearAll || group;
  if (one) document.getElementById(id).value = "all";
  if (all) (targetGroup === "sleep" ? [sleepPatternForm, sleepTheme, sleepStyle] : [recyclePatternForm, recycleTheme, recycleStyle]).forEach((select) => { select.value = "all"; });
  if (targetGroup === "sleep") renderSleepList(); else renderRecycleBin();
});

function syncArchiveLibSelect(select) {
  if (!select) return;
  select.classList.add("visually-hidden");
  const label = select.closest("label");
  if (!label) return;
  let control = label.querySelector(".archive-lib-select");
  if (!control) {
    control = document.createElement("div");
    control.className = "lib-select archive-lib-select";
    label.insertBefore(control, select);
  }
  const selected = select.options[select.selectedIndex] || select.options[0];
  control.innerHTML = `<button class="lib-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="lib-select-value">${escapeHtml(selected?.textContent || "全部")}</span><i class="lib-select-caret" aria-hidden="true"></i></button><div class="lib-select-panel hidden" role="listbox">${[...select.options].map((option) => `<button class="lib-sort-opt ${option.value === select.value ? "selected" : ""}" type="button" data-archive-option="${escapeHtml(option.value)}"><span>${escapeHtml(option.textContent)}</span><i aria-hidden="true">✓</i></button>`).join("")}</div>`;
  const trigger = control.querySelector(".lib-select-trigger");
  const panel = control.querySelector(".lib-select-panel");
  trigger.onclick = () => {
    const open = panel.classList.toggle("hidden") === false;
    control.classList.toggle("open", open);
    trigger.setAttribute("aria-expanded", String(open));
  };
  panel.onclick = (event) => {
    const option = event.target.closest("[data-archive-option]");
    if (!option) return;
    select.value = option.dataset.archiveOption;
    panel.classList.add("hidden");
    control.classList.remove("open");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };
}

function archiveTagFiltersMatch(card, prefix) {
  const selects = prefix === "sleep" ? [sleepPatternForm, sleepTheme, sleepStyle] : [recyclePatternForm, recycleTheme, recycleStyle];
  const tags = new Set((card.dataset.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean));
  return selects.every((select) => !select || select.value === "all" || tags.has(select.value));
}

function renderSleepList() {
  if (!sleepList) return;
  let items = sleepItemsForRole().filter((card) => archiveTypeMatches(card, sleepArchiveType));
  updateSleepFilters(items);
  populateArchiveTagFilters();

  const keyword = (sleepSearch?.value || "").trim().toLowerCase();
  const designer = sleepDesignerFilter?.value || "all";
  const tag = sleepTagFilter?.value || "all";
  items = items.filter((card) => {
    const tags = (card.dataset.tags || "").split(",").filter(Boolean);
    const text = `${card.dataset.file} ${workOwnerName(card)} ${tags.join(" ")} ${card.querySelector(".work-body > p")?.textContent || ""}`.toLowerCase();
    const sales = sleepSalesStatus?.value || "all";
    const sold = soldPatternFiles().has(card.dataset.file);
    return (!keyword || searchMatches(keyword, [text])) && archiveTagFiltersMatch(card, "sleep") && (sales === "all" || (sales === "sold") === sold) && (designer === "all" || workOwnerName(card) === designer) && (tag === "all" || tags.includes(tag));
  });

  items.sort((a, b) => {
    const mode = sleepSort?.value || "time-desc";
    if (mode === "file-asc") return a.dataset.file.localeCompare(b.dataset.file, "zh-CN", { numeric: true });
    if (mode === "designer-asc") return workOwnerName(a).localeCompare(workOwnerName(b), "zh-CN");
    if (mode === "time-asc") return new Date(a.dataset.version) - new Date(b.dataset.version);
    return new Date(b.dataset.version) - new Date(a.dataset.version);
  });

  if (!items.length) {
    sleepList.innerHTML = `<p class="empty-state">暂无休眠稿件。</p>`;
    return;
  }

  sleepList.innerHTML = items.map((card) => archiveWorkCardHtml(card, "sleep")).join("");
  hydrateArchiveWorkImages(sleepList, items, "sleep-item", "sleep-thumb");
  const selectedCount = sleepManageSelection.size;
  ["#sleepManageRestore", "#sleepManageDelete"].forEach((selector) => {
    const button = document.querySelector(selector);
    if (button) button.disabled = selectedCount === 0;
  });
}

async function resubmitSleepingWork(card, mode) {
  card.classList.remove("sleeping");
  card.dataset.sleeping = "";
  card.dataset.reviewState = "pending";
  card.dataset.submissionRound = String(Number(card.dataset.submissionRound || 1) + 1);
  card.dataset.resubmittedAt = formatDateTime();
  card.dataset.reviewAction = "";
  updateCardReviewStatus(card, mode === "recreate" ? "待审核 / 二次创作重新提交" : "待审核 / 修改后重新提交");
  delete card.dataset.sleepPreviousReviewStatus;
  delete card.dataset.sleepPreviousReviewAction;
  delete card.dataset.sleepPreviousReviewLogs;
  markWorkRecordDirty(card);
  dismissedNotifications.delete("draft-review");
  renderSleepList();
  renderDailyReviewBoard();
  renderNotifications();
  sortWorkCards();
  try {
    await saveStudioStateToCloud();
    showToast(`${card.dataset.file} 已作为 V${card.dataset.submissionRound} 重新提交到评审区。`, "success");
  } catch {
    showToast("稿件已在本页重新提交，但云端同步失败，请保持页面并重试。", "error");
  }
}

function markWorkDeletedGlobally(card, deletedAt = new Date().toISOString()) {
  card.classList.add("deleted");
  card.dataset.deletedAt = deletedAt;
  card.dataset.deletedByKey = currentAccount.ownerKey || "";
  card.dataset.deletedByRole = currentAccount.role || "";
  markWorkRecordDirty(card);
  deletedWorks = deletedWorks.filter((item) => item.card.dataset.file !== card.dataset.file);
  deletedWorks.push({ card, deletedAt });
}

async function deleteWorkCard(card) {
  const file = card.dataset.file;
  if (isCreatorRole() && card.dataset.workOwner !== currentAccount.ownerKey) return;
  if (!["管理员", "设计师", "手绘师"].includes(currentAccount.role)) return;
  if (!ensureWorksCanMoveToRecycle([card])) return;
  const confirmed = window.confirm(currentAccount.role === "手绘师"
    ? `确认删除 ${file} 吗？删除后将立即从“我的稿件”移除。`
    : `确认删除 ${file} 吗？删除后会进入回收站。`);
  if (!confirmed) return;

  ensureArchivePreviewPersisted(card);
  if (currentAccount.role === "设计师") {
    setPersonalArchiveState(card, "delete", true);
    recordActivityNotification({
      type: "work-delete",
      title: "稿件已移入回收站",
      text: `${currentAccount.name || currentAccount.role} 删除了「${file}」`,
      relatedOwners: [card.dataset.workOwner],
      adminOnly: true,
    });
    renderRecycleBin();
    renderSleepList();
    configureWorksView(roleSelect.value, currentAccount.ownerKey);
    try {
      await saveStudioStateToCloud();
      showToast(`${file} 已移入回收站，可在回收站中恢复。`, "warning");
    } catch {
      showToast("稿件已在本页移入回收站，但云端同步失败，请保持页面并重试。", "error");
    }
    return;
  }
  markWorkDeletedGlobally(card);
  recordActivityNotification({
    type: "work-delete",
    title: "稿件已移入回收站",
    text: `${currentAccount.name || currentAccount.role} 删除了「${file}」`,
    relatedOwners: [card.dataset.workOwner],
    adminOnly: !isAdministrator(),
  });
  renderRecycleBin();
  renderDailyReviewBoard();
  renderSleepList();
  configureWorksView(roleSelect.value, currentAccount.ownerKey);
  try {
    await saveStudioStateToCloud();
    showToast(currentAccount.role === "手绘师"
      ? `${file} 已从你的稿件中删除，由管理员统一处理。`
      : `${file} 已移入回收站，可在回收站中恢复。`, "warning");
  } catch {
    showToast("稿件已在本页移入回收站，但云端同步失败，请保持页面并重试。", "error");
  }
}

async function restoreWorkCard(card) {
  const file = card.dataset.file;
  if (isCreatorRole()) {
    if (card.dataset.workOwner !== currentAccount.ownerKey) return;
    const bucket = personalArchiveBucket();
    delete bucket.deleted[file];
    delete bucket.removed[file];
    configureWorksView(roleSelect.value, currentAccount.ownerKey);
    renderRecycleBin();
    renderSleepList();
    try {
      await saveStudioStateToCloud();
      showToast(`${file} 已恢复，重新显示在我的稿件中。`, "success");
    } catch {
      showToast("稿件已在本页恢复，但云端同步失败，请保持页面并重试。", "error");
    }
    return;
  }
  if (currentAccount.role !== "管理员") return;
  card.classList.remove("deleted");
  delete card.dataset.deletedAt;
  markWorkRecordDirty(card);
  deletedWorks = deletedWorks.filter((item) => item.card.dataset.file !== file);
  configureWorksView(roleSelect.value, currentAccount.ownerKey);
  renderRecycleBin();
  renderSleepList();
  renderDailyReviewBoard();
  renderLibraryGrid();
  try {
    await saveStudioStateToCloud();
    showToast(`${file} 已恢复，重新显示在作品列表中。`, "success");
  } catch {
    showToast("稿件已在本页恢复，但云端同步失败，请保持页面并重试。", "error");
  }
}

function requestRestoreWorkCard(card) {
  if (!card) return;
  openExitConfirmation({
    title: `恢复「${card.dataset.file}」？`,
    message: "确认后该稿件会离开回收站，并恢复到删除前的作品列表中。",
    submitText: "确认恢复",
    cancelText: "取消",
    onConfirm: async () => restoreWorkCard(card),
  });
}

function workStorageKeys(card) {
  const keys = new Set([
    card.dataset.imageKey,
    ...getPaletteKeys(card),
    ...getPaletteFiles(card).map((file) => file.key),
    ...getReferenceKeys(card),
    ...getSourceFiles(card).map((file) => file.key),
  ].filter(Boolean));
  try {
    JSON.parse(card.dataset.paletteThumbKeys || "[]").forEach((key) => key && keys.add(key));
  } catch {}
  try {
    JSON.parse(card.dataset.workImages || "[]").forEach((image) => {
      [image?.thumbKey, image?.previewKey, image?.originalKey].filter(Boolean).forEach((key) => keys.add(key));
    });
  } catch {}
  return [...keys];
}

function permanentlyRemoveWorkCards(cards) {
  const protectedFiles = [...new Set((cards || [])
    .map((card) => card?.dataset?.file)
    .filter((file) => file && ordersContainingWork(file).length))];
  const requestedFiles = new Set((cards || [])
    .map((card) => card?.dataset?.file)
    .filter((file) => file && !protectedFiles.includes(file)));
  const list = [...new Set([
    ...(cards || []).filter((card) => requestedFiles.has(card?.dataset?.file)),
    ...[...workCards].filter((card) => requestedFiles.has(card.dataset.file)),
  ])];
  const files = [...requestedFiles];
  const storageKeys = [...new Set(list.flatMap(workStorageKeys))];
  studioState.removedFiles = [...new Set([...(studioState.removedFiles || []), ...files])];
  list.forEach((card) => card.remove());
  refreshWorkCards();
  files.forEach((file) => {
    workRecordCache.delete(file);
    dirtyWorkFiles.delete(file);
  });
  files.cleanupPromise = Promise.allSettled(storageKeys.flatMap((key) => [
    window.KingBlobStore?.remove ? window.KingBlobStore.remove(key) : Promise.resolve(),
    deleteBackendStudioAsset(key),
  ])).then((results) => {
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) throw Object.assign(new Error("STUDIO_ASSET_DELETE_FAILED"), { failures: failed.length });
  });
  files.protectedFiles = protectedFiles;
  return files;
}

function purgeExpiredRecycleBin() {
  const retentionMs = 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const expired = deletedWorks.filter(({ deletedAt }) => {
    const deletedTime = new Date(deletedAt).getTime();
    return Number.isFinite(deletedTime) && now - deletedTime >= retentionMs;
  });
  if (!expired.length) return;
  const expiredFiles = permanentlyRemoveWorkCards(expired.map(({ card }) => card));
  expiredFiles.cleanupPromise.catch((error) => console.warn("过期回收站文件清理失败。", error));
  deletedWorks = deletedWorks.filter(({ card }) => !expiredFiles.includes(card.dataset.file));
  refreshWorkCards();
  saveStudioState();
}

function recycleStatusMatches(card) {
  const mode = recycleStatus.value;
  const summary = cardStatusSummary(card);
  if (mode === "all") return true;
  if (mode === "sold") return summary.includes("已出售") || summary.includes("出售");
  if (mode === "unsold") return summary.includes("未出售");
  if (mode === "customer") return ["初选", "已确认修改", "交付中", "完结"].some((item) => summary.includes(item));
  return ["待审核", "需修改", "未修改", "休眠", "Pass"].some((item) => summary.includes(item));
}

function renderRecycleBin() {
  populateArchiveTagFilters();
  const keyword = recycleSearch.value.trim().toLowerCase();
  const sourceItems = currentAccount.role === "管理员"
    ? deletedWorks
    : isCreatorRole()
      ? [...workCards]
        .filter((card) => card.dataset.workOwner === currentAccount.ownerKey && personalArchiveBucket().deleted?.[card.dataset.file])
        .map((card) => ({ card, deletedAt: personalArchiveBucket().deleted[card.dataset.file] }))
      : [];
  const uniqueSourceItems = new Map();
  sourceItems.forEach((item) => {
    const file = item.card?.dataset?.file;
    if (file) uniqueSourceItems.set(file, item);
  });
  let items = [...uniqueSourceItems.values()].filter(({ card }) => {
    const text = `${card.dataset.file} ${card.textContent}`.toLowerCase();
    return (!keyword || searchMatches(keyword, [text])) && archiveTypeMatches(card, recycleArchiveType) && archiveTagFiltersMatch(card, "recycle") && recycleStatusMatches(card);
  });

  items.sort((a, b) => {
    if (recycleSort.value === "file-asc") {
      return a.card.dataset.file.localeCompare(b.card.dataset.file);
    }
    if (recycleSort.value === "version-desc") {
      return new Date(b.card.dataset.version) - new Date(a.card.dataset.version);
    }
    return new Date(b.deletedAt) - new Date(a.deletedAt);
  });

  if (!items.length) {
    recycleList.innerHTML = `<p class="empty-state">回收站暂无作品。</p>`;
    return;
  }

  recycleList.innerHTML = items.map(({ card }) => archiveWorkCardHtml(card, "recycle")).join("");
  hydrateArchiveWorkImages(recycleList, items.map(({ card }) => card), "recycle-item", "recycle-thumb");
}

lightboxReviewLogList?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-lightbox-log-toggle]")) return;
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card) return;
  lightboxReviewLogsExpanded = !lightboxReviewLogsExpanded;
  renderUploaderReviewHistory(card);
});

function closeLightbox() {
  closeReferenceZoom();
  closeLightboxProjectPicker();
  lightboxTagPicker?.classList.add("hidden");
  const previous = lightboxBackStack.pop();
  if (previous) {
    lightboxCardSet = previous.cards;
    activePreviewIndex = previous.index;
    activeVariant = previous.variant;
    activeMediaKind = previous.mediaKind || "image";
    activeWorkImageIndex = Number(previous.workImageIndex || 0);
    lightboxViewerContext = previous.viewerContext;
    lightboxWorksLibraryContext = Boolean(previous.worksLibraryContext);
    previewZoom = previous.zoom;
    previewOffsetX = previous.offsetX;
    previewOffsetY = previous.offsetY;
    lightbox.classList.add("active");
    lightbox.classList.toggle("viewer-clean", lightboxViewerContext);
    lightbox.setAttribute("aria-hidden", "false");
    renderLightbox();
    return;
  }
  lightbox.classList.remove("active");
  lightbox.classList.remove("info-hidden");
  lightbox.classList.remove("library-mode");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxCardSet = [];
  lightboxViewerContext = false;
  lightboxWorksLibraryContext = false;
  lightboxRevisionDraftCard = null;
  if (lightboxRevisionInput) lightboxRevisionInput.value = "";
  lockBodyScroll(false);
}

function readRememberedLogin() {
  try {
    return JSON.parse(localStorage.getItem(REMEMBERED_LOGIN_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveRememberedLogin(portal, username, password, remember) {
  const remembered = readRememberedLogin();
  if (remember) {
    remembered[portal] = { username, password };
  } else {
    delete remembered[portal];
  }
  localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify(remembered));
}

function restoreRememberedLogins() {
  const remembered = readRememberedLogin();
  if (!RELEASE_CONFIG.useBackendAuth && remembered.employee) {
    usernameInput.value = remembered.employee.username || "";
    passwordInput.value = remembered.employee.password || "";
    employeeRememberPassword.checked = true;
  }
  if (remembered.client) {
    clientUsername.value = remembered.client.username || "";
    clientPassword.value = remembered.client.password || "";
    clientRememberPassword.checked = true;
  }
}

function switchLoginPortal(portal) {
  if (window.KingLoginPortal) {
    window.KingLoginPortal.show(portal);
    loginError.textContent = "";
    clientLoginError.textContent = "";
    return;
  }
  const clientMode = portal === "client";
  employeeLoginPanel.classList.toggle("hidden", clientMode);
  clientLoginPanel.classList.toggle("hidden", !clientMode);
  loginError.textContent = "";
  clientLoginError.textContent = "";
  (clientMode ? clientUsername : usernameInput).focus();
}

function setAppLoadingProgress(value, detail = "") {
  const percent = Math.min(100, Math.max(0, Math.round(Number(value || 0))));
  if (appLoadingProgressBar) appLoadingProgressBar.style.width = `${percent}%`;
  if (appLoadingProgressTrack) appLoadingProgressTrack.setAttribute("aria-valuenow", String(percent));
  if (appLoadingProgressCount) appLoadingProgressCount.textContent = `${percent}%`;
  if (appLoadingProgressDetail && detail) appLoadingProgressDetail.textContent = detail;
}

function showAppLoading(message = "正在加载…", { progress = false } = {}) {
  if (!appLoadingOverlay) return;
  if (appLoadingText) appLoadingText.textContent = message;
  if (appLoadingProgress) appLoadingProgress.hidden = !progress;
  if (progress) setAppLoadingProgress(0, "正在准备文件…");
  appLoadingOverlay.classList.remove("hidden");
  appLoadingOverlay.setAttribute("aria-hidden", "false");
}

function hideAppLoading() {
  if (!appLoadingOverlay) return;
  appLoadingOverlay.classList.add("hidden");
  appLoadingOverlay.setAttribute("aria-hidden", "true");
  if (appLoadingProgress) appLoadingProgress.hidden = true;
  setAppLoadingProgress(0, "正在准备文件…");
}

function waitForUiPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function runWithAppLoading(message, task, minimumMs = 360) {
  const startedAt = Date.now();
  showAppLoading(message);
  await waitForUiPaint();
  try {
    return await task();
  } finally {
    const remaining = minimumMs - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    hideAppLoading();
  }
}

let loginInProgress = false;
function applyLogin(accountKey, account) {
  if (loginInProgress) return;
  loginInProgress = true;
  const loginPortal = account.role === "客户" ? "client" : "employee";
  window.KingLoginPortal?.setSubmitting(loginPortal, true);
  const loginLoadingStartedAt = Date.now();
  showAppLoading(account.role === "客户" ? "正在进入客户端…" : "正在进入总控台…", { progress: true });
  setAppLoadingProgress(90, "正在渲染工作台…");
  // 先让遮罩真正绘制一帧，再进行页面切换和数据渲染，避免点击后像“没有反应”。
  waitForUiPaint().then(() => {
    currentAccount = { ...account };
    document.documentElement.classList.remove("backend-session-restoring");
    localStorage.setItem(SESSION_KEY, accountKey);
    localStorage.setItem(SESSION_ACCOUNT_DATA_KEY, JSON.stringify({ accountKey, account }));
    roleSelect.value = account.role;
    roleSelect.disabled = true;
    applyProfilePrefs(currentAccount);
    updateRoleDashboard(account.role);
    configureRoleNavigation(account.role);
    renderNotifications();
    if (globalSearchInput) {
      const clientMode = account.role === "客户";
      globalSearchInput.value = "";
      globalSearchInput.placeholder = "搜索";
      globalSearchInput.setAttribute("aria-label", clientMode ? "搜索我的花型库" : "全局搜索，支持拼音");
    }
    globalSearchMatches = [];
    if (globalSearchResults) {
      globalSearchResults.innerHTML = "";
      globalSearchResults.classList.add("hidden");
    }
    const requestedView = browserRouteView();
    const requestedNav = requestedView && [...navItems].find((item) => item.dataset.view === requestedView);
    switchView(requestedNav && viewAllowedForRole(requestedNav, account.role)
      ? requestedView
      : restorableViewForAccount(accountKey, account));
    loginScreen.classList.add("hidden");
    appShell.classList.remove("locked");
    loginError.textContent = "";
    const cloudCleanup = pendingCloudStudioCleanup
      ? cleanupDuplicateCloudStudioRecords().catch((error) => {
          console.warn("重复稿件云端清理失败，将在下次登录继续重试。", error);
        })
      : Promise.resolve();
    const workspaceReady = account.role === "客户"
      ? initialImageHydration
      : Promise.all([initialImageHydration, ensureCaseLibraryReady()]);
    const ready = Promise.all([workspaceReady, cloudCleanup]);
    ready.finally(() => {
      setAppLoadingProgress(100, "工作台已准备完成");
      const remaining = Math.max(0, 560 - (Date.now() - loginLoadingStartedAt));
      setTimeout(() => requestAnimationFrame(() => {
        hideAppLoading();
        window.KingLoginPortal?.setSubmitting(loginPortal, false);
        loginInProgress = false;
        startBackendStudioPolling();
        startBackendRealtimeSync();
        startNasStudioPolling();
      }), remaining);
    });
  });
}

/* ----- Toast notification system ----- */
function showToast(message, type) {
  type = type || "success";
  const container = document.querySelector("#toastContainer");
  if (!container) return;
  // 限流：同一时间只保留一个提示，避免连续操作弹出一堆。
  container.querySelectorAll(".toast").forEach((old) => old.remove());
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  const remove = () => {
    if (toast.parentNode) {
      toast.classList.add("removing");
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 260);
    }
  };

  // 1.6 秒后自动消失
  setTimeout(remove, 1600);
}

/* ----- Review action handlers ----- */
function renderInlineReviewNote(container, action) {
  const oldNote = container.parentElement.querySelector(".inline-review-note");
  if (oldNote) oldNote.remove();

  if (action !== "修改" && action !== "需修改") {
    return;
  }

  const note = document.createElement("div");
  note.className = "inline-review-note";
  note.innerHTML = `
    <label>修改意见</label>
    <textarea rows="2" placeholder="请输入需要修改的意见"></textarea>
    <button type="button">保存备注</button>
  `;
  note.querySelector("button").addEventListener("click", () => {
    const value = note.querySelector("textarea").value.trim();
    if (!value) {
      note.querySelector("textarea").focus();
      showToast("请先填写评审备注。", "warning");
      return;
    }
    showToast("修改意见已保存。", "warning");
  });
  container.insertAdjacentElement("afterend", note);
}

function closeReviewConfirmation() {
  reviewConfirmModal.classList.remove("active");
  reviewConfirmModal.setAttribute("aria-hidden", "true");
  reviewConfirmNote.value = "";
  pendingReviewConfirmation = null;
  lockBodyScroll(false);
}

function closeExitConfirmation() {
  exitConfirmModal?.classList.remove("active");
  exitConfirmModal?.setAttribute("aria-hidden", "true");
  pendingExitConfirmation = null;
  pendingExitSaveAction = null;
  const formStillOpen = [uploadModal, projectModal, customerModal, projectDetailModal, projectArchiveModal, projectLifecycleModal].some((modal) => modal?.classList.contains("active"));
  lockBodyScroll(formStillOpen);
}

function openExitConfirmation({ title, message, submitText = "放弃并退出", cancelText = "继续编辑", saveText = "保存并退出", onConfirm, onSave = null, singleAction = false }) {
  pendingExitConfirmation = onConfirm;
  pendingExitSaveAction = onSave;
  exitConfirmTitle.textContent = title || "确认退出";
  exitConfirmMessage.textContent = message || "当前内容尚未保存，退出后本次填写将不会保留。";
  exitConfirmSubmit.textContent = submitText;
  exitConfirmCancel.textContent = cancelText;
  exitConfirmCancel.classList.toggle("hidden", singleAction);
  exitConfirmCancel.style.display = singleAction ? "none" : "";
  // With a save action the discard button is secondary and the save button becomes the primary CTA.
  exitConfirmSubmit.classList.toggle("primary-button", !onSave);
  exitConfirmSubmit.classList.toggle("text-dialog-button", Boolean(onSave));
  if (exitConfirmSave) {
    exitConfirmSave.textContent = saveText;
    exitConfirmSave.classList.toggle("hidden", !onSave);
    exitConfirmSave.style.display = onSave ? "" : "none";
  }
  // 3-button: 不保存并退出 / 取消 / 保存并退出. 2-button: 继续编辑 / 放弃并退出.
  exitConfirmSubmit.style.order = onSave ? "1" : "2";
  exitConfirmCancel.style.order = onSave ? "2" : "1";
  if (exitConfirmSave) exitConfirmSave.style.order = "3";
  exitConfirmModal.classList.add("active");
  exitConfirmModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function openReviewConfirmation(card, action, onConfirm) {
  const normalizedAction = action === "需修改" ? "修改" : action === "通过入库" ? "通过" : action;
  const needsNote = normalizedAction === "修改";
  pendingReviewConfirmation = { card, action: normalizedAction, onConfirm };
  reviewConfirmTitle.textContent = normalizedAction === "待评审" ? "改为待评审" : normalizedAction === "通过" ? "确认通过稿件" : "退回修改";
  reviewConfirmMessage.textContent = normalizedAction === "待评审"
    ? `确认撤销「${card.dataset.file}」当前的评审结果，并将它移回待评审吗？`
    : normalizedAction === "修改"
      ? `请填写「${card.dataset.file}」需要修改的具体内容，提交后会同步给上传者。`
      : `将「${card.dataset.file}」标记为“${normalizedAction}”${normalizedAction === "通过" ? "，通过后会进入已评审和作品库。" : "。"}`;
  reviewConfirmNoteWrap.classList.toggle("hidden", !needsNote);
  reviewConfirmNoteLabel.textContent = "修改意见";
  reviewConfirmNote.placeholder = "请输入需要调整的内容";
  reviewConfirmSubmit.textContent = normalizedAction === "待评审" ? "确认移回" : normalizedAction === "通过" ? "确认通过" : "确认";
  reviewConfirmSubmit.className = `primary-button review-confirm-${normalizedAction === "修改" ? "revise" : "approve"}`;
  reviewConfirmModal.classList.add("active");
  reviewConfirmModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
  if (needsNote) reviewConfirmNote.focus();
}

function applyReviewDecision(sourceCard, action, note = "") {
  setReviewLog(sourceCard, action, note || `审核状态更改为${action}`);
  if (action === "通过") {
    sourceCard.classList.remove("sleeping");
    sourceCard.dataset.sleeping = "";
    sourceCard.dataset.reviewState = "approved";
    updateCardReviewStatus(sourceCard, "已通过");
    showToast("已通过，作品已进入作品库。", "success");
  } else if (action === "修改") {
    sourceCard.classList.remove("sleeping");
    sourceCard.dataset.sleeping = "";
    sourceCard.dataset.reviewState = "revision";
    updateCardReviewStatus(sourceCard, "需修改 / 管理者已填写修改意见");
    // 新的打回必须重新提醒对应上传者，即使旧提醒曾被手动关闭。
    dismissedNotifications.delete("work-revision");
    showToast(`作品未通过，已通知${sourceCard.dataset.workRole === "手绘师" ? "手绘师" : "设计师"}修改。`, "warning");
  }
  markWorkRecordDirty(sourceCard);
  renderSleepList();
  renderDailyReviewBoard();
  applyLibraryFilters();
  sortWorkCards();
  renderLibraryGrid();
  renderDashboardOverview(currentAccount.role);
  renderNotifications();
  saveStudioState();
}

function advanceLightboxAfterReview(reviewedCard) {
  if (!lightbox.classList.contains("active") || activeViewId() !== "review") return;
  const cards = activeLightboxCards();
  const reviewedIndex = cards.indexOf(reviewedCard);
  const nextCard = reviewedIndex >= 0 ? cards[reviewedIndex + 1] : null;
  window.setTimeout(() => {
    if (!lightbox.classList.contains("active")) return;
    if (!nextCard) {
      closeLightbox();
      showToast("当前筛选中的稿件已全部处理完成。", "success");
      return;
    }
    activePreviewIndex = reviewedIndex + 1;
    activeMediaKind = "image";
    activeWorkImageIndex = 0;
    activeVariant = 1;
    previewZoom = 1;
    previewOffsetX = 0;
    previewOffsetY = 0;
    renderLightbox();
  }, 320);
}

function resetReviewDecision(sourceCard) {
  clearReviewLogs(sourceCard);
  sourceCard.classList.remove("sleeping");
  sourceCard.dataset.sleeping = "";
  sourceCard.dataset.reviewState = "pending";
  updateCardReviewStatus(sourceCard, "待审核 / 管理者未评审");
  renderSleepList();
  renderDailyReviewBoard();
  applyLibraryFilters();
  sortWorkCards();
  renderLibraryGrid();
  renderDashboardOverview(currentAccount.role);
  renderNotifications();
  saveStudioState();
  showToast("稿件已移回待评审。", "success");
}

function handleReviewAction(button, container) {
  const text = button.dataset.reviewAction || button.textContent.trim();
  const card = container.closest(".review-work-card, .live-draft-card, .draft-card");
  const file = card?.dataset.reviewFile || card?.dataset.file || "该稿件";
  const sourceCard = [...workCards].find((item) => item.dataset.file === file);
  if (!sourceCard) return;
  const action = text === "需修改" ? "修改" : text === "通过入库" ? "通过" : text;
  if (isReviewPending(sourceCard) && action !== "修改") {
    applyReviewDecision(sourceCard, action);
    return;
  }
  openReviewConfirmation(sourceCard, action, (confirmedAction, note) => applyReviewDecision(sourceCard, confirmedAction, note));
}

reviewConfirmClose.addEventListener("click", closeReviewConfirmation);
reviewConfirmCancel.addEventListener("click", closeReviewConfirmation);
reviewConfirmModal.addEventListener("click", (event) => {
  if (event.target === reviewConfirmModal) closeReviewConfirmation();
});
reviewConfirmSubmit.addEventListener("click", () => {
  if (!pendingReviewConfirmation) return;
  const { action, onConfirm } = pendingReviewConfirmation;
  const note = reviewConfirmNote.value.trim();
  if (action === "修改" && !note) {
    reviewConfirmNote.focus();
    showToast("请先填写修改要求与原因。", "warning");
    return;
  }
  onConfirm(action, note);
  closeReviewConfirmation();
});
exitConfirmClose?.addEventListener("click", closeExitConfirmation);
exitConfirmCancel?.addEventListener("click", closeExitConfirmation);
exitConfirmSubmit?.addEventListener("click", () => {
  const onConfirm = pendingExitConfirmation;
  if (typeof onConfirm === "function") onConfirm();
  closeExitConfirmation();
});
exitConfirmSave?.addEventListener("click", () => {
  const onSave = pendingExitSaveAction;
  closeExitConfirmation();
  if (typeof onSave === "function") onSave();
});
exitConfirmModal?.addEventListener("click", (event) => {
  if (event.target === exitConfirmModal) closeExitConfirmation();
});

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    const target = item.dataset.view;

    switchView(target);
  });
});

window.addEventListener("popstate", () => {
  const target = browserRouteView();
  const nav = target && [...navItems].find((item) => item.dataset.view === target);
  if (!nav || !viewAllowedForRole(nav, currentAccount.role)) return;
  applyingBrowserRoute = true;
  switchView(target);
  applyingBrowserRoute = false;
});

document.addEventListener("click", (event) => {
  const jumpButton = event.target.closest("[data-dashboard-jump]");
  if (!jumpButton) return;
  if (jumpButton.dataset.dashboardJump === "review") {
    activeReviewDate = jumpButton.dataset.reviewDate || dateKey(new Date());
    activeReviewFilter = "pending";
    activeReviewResultFilter = "all";
  }
  switchView(jumpButton.dataset.dashboardJump);
});

document.addEventListener("click", (event) => {
  const performanceButton = event.target.closest("[data-dashboard-performance]");
  if (!performanceButton) return;
  openTeamMemberDetail(performanceButton.dataset.dashboardPerformance);
});

document.addEventListener("click", (event) => {
  const rangeButton = event.target.closest("[data-business-range]");
  if (!rangeButton) return;
  renderBusinessTrendPanel(rangeButton.dataset.businessRange);
});

document.addEventListener("click", (event) => {
  const rangeButton = event.target.closest("[data-designer-range]");
  if (rangeButton) {
    designerDashboardRange = rangeButton.dataset.designerRange;
    renderDesignerDashboard();
    return;
  }
  const workButton = event.target.closest("[data-designer-work]");
  if (workButton) {
    const card = sourceCardByFile(workButton.dataset.designerWork);
    if (card) openLightbox(card, { worksLibrary: true });
    return;
  }
  const projectButton = event.target.closest("[data-designer-project]");
  if (projectButton) {
    const projectId = projectButton.dataset.designerProject;
    switchView("projects");
    requestAnimationFrame(() => {
      const project = pjById(projectId);
      if (project) pjOpenDetail(project.id);
    });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const jumpTarget = event.target.closest("[data-dashboard-jump]");
  if (!jumpTarget || jumpTarget.tagName === "BUTTON") return;
  event.preventDefault();
  if (jumpTarget.dataset.dashboardJump === "review") {
    activeReviewDate = jumpTarget.dataset.reviewDate || dateKey(new Date());
    activeReviewFilter = "pending";
    activeReviewResultFilter = "all";
  }
  switchView(jumpTarget.dataset.dashboardJump);
});

document.addEventListener("click", (event) => {
  const riskButton = event.target.closest("[data-open-risk]");
  if (riskButton) openRiskModal();
});

riskModalClose?.addEventListener("click", closeRiskModal);
riskModal?.addEventListener("click", (event) => {
  if (event.target === riskModal) closeRiskModal();
});
riskModalBody?.addEventListener("click", (event) => {
  const projectButton = event.target.closest("[data-risk-project]");
  if (projectButton) {
    const projectId = projectButton.dataset.riskProject;
    closeRiskModal();
    switchView("projects");
    renderProjectsView();
    requestAnimationFrame(() => {
      const project = pjById(projectId);
      if (project) pjOpenDetail(project.id);
    });
    return;
  }
  const orderButton = event.target.closest("[data-risk-order]");
  if (orderButton) focusRiskOrder(orderButton.dataset.riskOrder);
});

roleSelect.addEventListener("change", (event) => {
  const role = event.target.value;
  configureRoleNavigation(role);
  updateRoleDashboard(role);
});

function setAuthModal(modal, open) {
  modal.classList.toggle("active", open);
  modal.setAttribute("aria-hidden", String(!open));
  lockBodyScroll(open);
}

openAccountApplication.addEventListener("click", () => {
  applicationError.textContent = "";
  setAuthModal(accountApplicationModal, true);
  applicationName.focus();
});

closeAccountApplication.addEventListener("click", () => setAuthModal(accountApplicationModal, false));

openPasswordRecovery.addEventListener("click", () => {
  passwordRecoveryForm.reset();
  recoveryError.textContent = "";
  setAuthModal(passwordRecoveryModal, true);
  recoveryUsername.focus();
});

closePasswordRecovery.addEventListener("click", () => setAuthModal(passwordRecoveryModal, false));

accountApplicationModal.addEventListener("click", (event) => {
  if (event.target === accountApplicationModal) setAuthModal(accountApplicationModal, false);
});

passwordRecoveryModal.addEventListener("click", (event) => {
  if (event.target === passwordRecoveryModal) setAuthModal(passwordRecoveryModal, false);
});

accountApplicationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (RELEASE_CONFIG.useBackendAuth) {
    applicationError.textContent = "云端账号请联系管理员创建。";
    return;
  }
  const username = applicationUsername.value.trim().toLowerCase();
  const contact = applicationContact.value.trim().toLowerCase();
  const password = applicationPassword.value;
  const role = applicationRole.value;
  const allowedRoles = ["管理员", "设计师", "手绘师", "销售"];

  if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(username)) {
    applicationError.textContent = "登录账号需为 3–24 位英文、数字、点、下划线或短横线。";
    return;
  }
  if (demoAccounts[username]) {
    applicationError.textContent = "该登录账号已存在，请更换一个账号。";
    return;
  }
  if (!allowedRoles.includes(role)) {
    applicationError.textContent = "请选择一个开放注册的员工岗位。";
    return;
  }
  if (password.length < 8 || password !== applicationPasswordConfirm.value) {
    applicationError.textContent = password.length < 8 ? "密码至少需要 8 位。" : "两次输入的密码不一致。";
    return;
  }

  const account = {
    password,
    contact,
    role,
    name: applicationName.value.trim(),
    ownerKey: username,
  };
  const registeredAccounts = readRegisteredAccounts();
  registeredAccounts[username] = account;
  writeRegisteredAccounts(registeredAccounts);
  demoAccounts[username] = account;
  syncRegisteredAccountsToTeam();
  syncProjectMemberOptions();
  saveStudioState();
  accountApplicationForm.reset();
  setAuthModal(accountApplicationModal, false);
  applyLogin(username, account);
  showToast("账号创建成功，已进入你的工作台。", "success");
});

passwordRecoveryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (RELEASE_CONFIG.useBackendAuth) {
    recoveryError.textContent = "云端密码请联系管理员重置。";
    return;
  }
  const username = recoveryUsername.value.trim().toLowerCase();
  const account = demoAccounts[username];
  const password = recoveryPassword.value;

  if (!account || !account.contact || account.contact !== recoveryContact.value.trim().toLowerCase()) {
    recoveryError.textContent = "账号或绑定的联系方式不匹配。";
    return;
  }
  if (password.length < 8 || password !== recoveryPasswordConfirm.value) {
    recoveryError.textContent = password.length < 8 ? "新密码至少需要 8 位。" : "两次输入的新密码不一致。";
    return;
  }

  account.password = password;
  const registeredAccounts = readRegisteredAccounts();
  registeredAccounts[username] = account;
  writeRegisteredAccounts(registeredAccounts);
  const remembered = readRememberedLogin();
  if (remembered.employee?.username === username) {
    saveRememberedLogin("employee", username, password, true);
  }
  passwordRecoveryForm.reset();
  setAuthModal(passwordRecoveryModal, false);
  usernameInput.value = username;
  passwordInput.value = "";
  loginError.textContent = "密码已重置，请使用新密码登录。";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const accountKey = usernameInput.value.trim().toLowerCase();
  loginError.textContent = "";
  window.KingLoginPortal?.setSubmitting("employee", true);
  showAppLoading("正在验证账号…", { progress: true });
  setAppLoadingProgress(12, "正在验证账号和岗位权限…");
  try {
    const account = RELEASE_CONFIG.useBackendAuth
      ? await authenticateEmployee(accountKey, passwordInput.value)
      : demoAccounts[accountKey]?.password === passwordInput.value ? demoAccounts[accountKey] : null;
    if (!account) throw Object.assign(new Error("INVALID_CREDENTIALS"), { code: "INVALID_CREDENTIALS" });
    setAppLoadingProgress(26, "登录成功，正在连接云端工作室…");
    if (account.accountStatus === "已停用") throw Object.assign(new Error("ACCOUNT_DISABLED"), { code: "ACCOUNT_DISABLED" });
    if (!RELEASE_CONFIG.enabledEmployeeRoles?.includes(account.role)) throw Object.assign(new Error("ROLE_NOT_ENABLED"), { code: "ROLE_NOT_ENABLED" });
    if (RELEASE_CONFIG.useBackendAuth) await pullBackendStudioState({ refreshUi: true, showProgress: true });
    if (!RELEASE_CONFIG.useBackendAuth) saveRememberedLogin("employee", accountKey, passwordInput.value, employeeRememberPassword.checked);
    applyLogin(accountKey, account);
    return;
  } catch (error) {
    hideAppLoading();
    loginError.textContent = error.code === "ACCOUNT_DISABLED" ? "该账号已被管理员停用。" : error.code === "ROLE_NOT_ENABLED" ? "该岗位暂未开放登录。" : error.code === "AUTH_NOT_CONFIGURED" ? "认证服务尚未配置。" : "账号或密码不正确。";
  } finally {
    window.KingLoginPortal?.setSubmitting("employee", false);
  }
});

clientLoginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const accountKey = clientUsername.value.trim();
  const password = clientPassword.value;
  const client = customerByLogin(accountKey, password);
  if (client) {
    saveRememberedLogin("client", accountKey, password, clientRememberPassword.checked);
    applyLogin(accountKey, {
      role: "客户",
      name: `${client.name}`,
      ownerKey: "customer",
      customerId: client.id,
      company: client.name,
      password,
    });
    return;
  }
  clientLoginError.textContent = "账号或密码不正确。";
});

document.querySelectorAll("[data-demo-account]").forEach((button) => {
  button.addEventListener("click", () => {
    usernameInput.value = button.dataset.demoAccount;
    if (!RELEASE_CONFIG.useBackendAuth) passwordInput.value = demoAccounts[button.dataset.demoAccount]?.password || "";
  });
});

document.querySelectorAll(".preview-trigger").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    const card = trigger.closest(".work-card");
    if (!card) return;
    event.stopPropagation();
    openLightbox(card, { worksLibrary: activeViewId() === "designer" });
  });
});

lightboxClose.addEventListener("click", closeLightbox);
lightboxOwner?.addEventListener("click", () => {
  if (currentAccount.role !== "管理员") return;
  const memberName = lightboxOwner.dataset.memberName || "";
  const member = teamMembers.find((item) => item.name === memberName || item.ownerKey === memberName);
  if (!member) {
    showToast("暂未找到该成员档案。", "warning");
    return;
  }
  closeLightbox();
  switchView("team");
  openTeamMemberDetail(member.ownerKey || member.name);
});
lightboxSleepToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || currentAccount.role !== "管理员") return;
  setWorkSleeping(card, !isSleepingWork(card));
  renderLightbox();
});
lightboxDeleteWork?.addEventListener("click", (event) => {
  event.stopPropagation();
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || !(isAdminReviewContext() || isAdminMetadataContext() || isUploaderDetailContext(card))) return;
  deleteWorkCard(card);
  if (card.classList.contains("deleted")) closeLightbox();
});
lightboxEditWork?.addEventListener("click", async (event) => {
  event.stopPropagation();
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || !(currentAccount.role === "管理员" || isUploaderDetailContext(card) || isAdminMetadataContext())) return;
  closeLightbox();
  await openUploadModal(card);
});
paletteFileInput.addEventListener("change", async () => {
  if (!paletteFileTargetCard || !paletteFileInput.files.length) return;
  try {
    await appendPaletteFiles(paletteFileTargetCard, paletteFileInput.files);
  } catch (error) {
    console.error(error);
    showToast("配色上传失败，请重新选择文件。", "error");
  } finally {
    paletteFileInput.value = "";
    paletteFileTargetCard = null;
  }
});
workImageAddInput?.addEventListener("change", async () => {
  if (!workImageAddTargetCard || !workImageAddInput.files.length) return;
  try {
    await appendWorkImages(workImageAddTargetCard, workImageAddInput.files);
  } catch (error) {
    console.error(error);
    showToast("作品图片添加失败，请重新选择。", "error");
  } finally {
    workImageAddInput.value = "";
    workImageAddTargetCard = null;
  }
});
lightboxPrev.addEventListener("click", () => moveLightbox(-1));
lightboxNext.addEventListener("click", () => moveLightbox(1));
function finishLightboxTitleEdit({ cancel = false } = {}) {
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || !lightboxFile.isContentEditable) return;
  const previous = lightboxFile.dataset.originalTitle || card.querySelector(".work-head strong")?.textContent.trim() || card.dataset.file;
  const next = cancel ? previous : lightboxFile.textContent.trim();
  lightboxFile.contentEditable = "false";
  lightboxFile.classList.remove("editing");
  delete lightboxFile.dataset.originalTitle;
  if (!next) {
    lightboxFile.textContent = previous;
    showToast("作品名称不能为空。", "warning");
    return;
  }
  lightboxFile.textContent = next;
  if (next === previous) return;
  const cardTitle = card.querySelector(".work-head strong");
  if (cardTitle) cardTitle.textContent = next;
  markWorkRecordDirty(card);
  saveStudioState();
  renderDailyReviewBoard();
  renderWorksLibrary();
  renderProjectsView();
  showToast("作品名称已更新。", "success");
}
lightboxFile.addEventListener("click", () => {
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || !canEditWorkMetadata(card) || lightboxViewerContext || lightboxFile.isContentEditable) return;
  lightboxFile.dataset.originalTitle = lightboxFile.textContent.trim();
  lightboxFile.contentEditable = "true";
  lightboxFile.classList.add("editing");
  lightboxFile.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(lightboxFile);
  selection.removeAllRanges();
  selection.addRange(range);
});
lightboxFile.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    lightboxFile.blur();
  } else if (event.key === "Escape") {
    event.preventDefault();
    finishLightboxTitleEdit({ cancel: true });
  }
});
lightboxFile.addEventListener("blur", () => finishLightboxTitleEdit());
lightboxTags.addEventListener("click", (event) => {
  event.stopPropagation();
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || !canEditWorkMetadata(card)) return;
  const removeButton = event.target.closest("[data-lightbox-tag-remove]");
  if (removeButton) {
    const tag = removeButton.dataset.lightboxTagRemove;
    card.dataset.tags = (card.dataset.tags || "")
      .split(",")
      .filter((item) => item && item !== tag)
      .join(",");
    card.querySelector(".tag-bar")?.remove();
    renderCardTags(card);
    renderLightboxTagDisplay(card);
    renderLightboxTagPicker(card);
    renderDailyReviewBoard();
    markWorkRecordDirty(card);
    saveStudioState();
    showToast(`已删除标签“${tag}”。`, "success");
    return;
  }
  lightboxTagPicker.classList.toggle("hidden");
});
lightboxTagOptions.addEventListener("click", (event) => {
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || !canEditWorkMetadata(card)) return;
  const option = event.target.closest("[data-lightbox-tag]");
  if (!option) return;
  event.stopPropagation();
  const tags = (card.dataset.tags || "").split(",").filter(Boolean);
  const tag = option.dataset.lightboxTag;
  const next = tags.includes(tag) ? tags.filter((item) => item !== tag) : tags.length < 6 ? [...tags, tag] : tags;
  if (!tags.includes(tag) && tags.length >= 6) {
    showToast("最多选择 6 个标签。", "warning");
    return;
  }
  card.dataset.tags = next.join(",");
  card.querySelector(".tag-bar")?.remove();
  renderCardTags(card);
  renderLightboxTagDisplay(card);
  renderLightboxTagPicker(card);
  renderDailyReviewBoard();
  markWorkRecordDirty(card);
  saveStudioState();
});
lightboxProject.addEventListener("click", (event) => {
  event.stopPropagation();
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || !canEditWorkMetadata(card)) return;
  lightboxProjectPicker?.classList.contains("hidden") ? openLightboxProjectPicker() : closeLightboxProjectPicker();
});
lightboxProjectSearch?.addEventListener("input", () => renderLightboxProjectResults(lightboxProjectSearch.value));
lightboxProjectSearchClear?.addEventListener("click", () => {
  lightboxProjectSearch.value = "";
  renderLightboxProjectResults();
  lightboxProjectSearch.focus();
});
lightboxProjectResults?.addEventListener("click", (event) => {
  const createButton = event.target.closest("[data-lightbox-new-project]");
  const option = event.target.closest("[data-lightbox-project]");
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || !canEditWorkMetadata(card)) return;
  if (createButton) {
    if (!canCreateProject()) {
      showToast("只有管理员可以新建项目，请选择已有项目。", "warning");
      return;
    }
    const suggestedName = createButton.dataset.lightboxNewProject || lightboxProjectSearch?.value.trim() || "";
    closeLightboxProjectPicker();
    pjOpenForm(null, { name: suggestedName, stage: PJ_STAGES[0].key }, {
      keepBodyLocked: true,
      onCreated: (project) => {
        card.dataset.projectId = project.id;
        const projectLine = card.querySelector(".work-body > p");
        if (projectLine) projectLine.textContent = `项目：${project.name}`;
        lightboxProject.textContent = `项目：${project.name}`;
        markWorkRecordDirty(card);
        saveStudioState();
        renderDailyReviewBoard();
        lockBodyScroll(true);
        showToast(`已创建并关联项目“${project.name}”。`, "success");
      },
    });
    return;
  }
  if (!option) return;
  const projectName = option.dataset.lightboxProject;
  const projectId = option.dataset.lightboxProjectId || "";
  card.dataset.projectId = projectId;
  const projectLine = card.querySelector(".work-body > p");
  if (projectLine) projectLine.textContent = `项目：${projectName}`;
  lightboxProject.textContent = `项目：${projectName}`;
  closeLightboxProjectPicker();
  renderDailyReviewBoard();
  markWorkRecordDirty(card);
  saveStudioState();
  showToast(`已重新关联项目“${projectName}”。`, "success");
});
lightboxExitFullscreen.addEventListener("click", (event) => {
  event.stopPropagation();
  lightbox.classList.remove("info-hidden");
  resetPreviewTransform();
});
lightboxReviewActions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-action]");
  if (!button) return;

  const card = activeLightboxCards()[activePreviewIndex];
  if (!card) return;
  const action = button.dataset.reviewAction;
  if (action === "修改") {
    lightboxRevisionDraftCard = card;
    lightboxRevisionInput.value = card.dataset.reviewAction === "修改" ? card.dataset.reviewNote || "" : "";
    lightboxWorkStatus.textContent = "需修改";
    lightboxWorkStatus.dataset.status = "revision";
    renderUploaderReviewHistory(card);
    lightboxRevisionInput.focus();
    return;
  }
  const commit = (confirmedAction, note = "") => {
    applyReviewDecision(card, confirmedAction, note);
    advanceLightboxAfterReview(card);
  };
  if (isReviewPending(card)) {
    commit(action);
  } else {
    openReviewConfirmation(card, action, commit);
  }
});
lightboxRevisionConfirm?.addEventListener("click", () => {
  let card = lightboxRevisionDraftCard;
  if (!card && isAdminReviewContext()) {
    card = activeLightboxCards()[activePreviewIndex];
    const revision = reviewLogs(card).find((item) => item.action === "修改");
    if (!card || !revision) return;
    lightboxRevisionDraftCard = card;
    lightboxRevisionInput.value = revision.note || "";
    renderUploaderReviewHistory(card);
    requestAnimationFrame(() => {
      lightboxRevisionInput.focus();
      lightboxRevisionInput.setSelectionRange(lightboxRevisionInput.value.length, lightboxRevisionInput.value.length);
    });
    return;
  }
  const note = lightboxRevisionInput?.value.trim() || "";
  if (!card) return;
  if (!note) {
    lightboxRevisionInput.focus();
    showToast("请先填写修改要求和原因。", "warning");
    return;
  }
  applyReviewDecision(card, "修改", note);
  lightboxRevisionDraftCard = null;
  lightboxRevisionInput.value = "";
  advanceLightboxAfterReview(card);
});
lightboxResetReview?.addEventListener("click", () => {
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || isReviewPending(card)) return;
  openReviewConfirmation(card, "待评审", () => {
    resetReviewDecision(card);
    renderLightbox();
  });
});
saveReviewNote.addEventListener("click", () => {
  const card = activeLightboxCards()[activePreviewIndex];
  const note = reviewNoteText.value.trim();
  if (!note) {
    reviewNoteText.focus();
    showToast("请先填写评审备注。", "warning");
    return;
  }
  setReviewLog(card, activeReviewAction, note);
  renderReviewLogList(card);
  if (activeReviewAction === "修改") {
    updateCardReviewStatus(card, "需修改 / 管理者已填写修改意见");
  }
  renderDailyReviewBoard();
  saveStudioState();
  showToast(`已保存 ${card?.dataset.file || "稿件"} 的修改意见。`, "warning");
});
document.addEventListener(
  "pointerdown",
  (event) => {
    if (!event.target.closest("#lightboxExitFullscreen")) return;
    event.preventDefault();
    event.stopPropagation();
    lightbox.classList.remove("info-hidden");
    resetPreviewTransform();
  },
  true
);
toggleCardInfo?.addEventListener("click", () => {
  cardInfoHidden = !cardInfoHidden;
  worksBoard.classList.toggle("cards-info-hidden", cardInfoHidden);
  if (toggleCardInfo) toggleCardInfo.textContent = cardInfoHidden ? "显示卡片信息" : "隐藏卡片信息";
});
workSort.addEventListener("change", () => {
  workRenderLimit = WORK_RENDER_BATCH;
  sortWorkCards();
});
workTimeFilter.addEventListener("change", () => {
  workRenderLimit = WORK_RENDER_BATCH;
  sortWorkCards();
});
function resetReviewBatch() {
  reviewRenderLimit = REVIEW_RENDER_BATCH;
}
function shiftReviewDate(days) {
  const date = new Date(`${activeReviewDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  const next = dateKey(date);
  const today = dateKey(new Date());
  activeReviewDate = next > today ? today : next;
  resetReviewBatch();
  renderDailyReviewBoard();
}

function selectReviewDate(value) {
  if (!value) return;
  const today = dateKey(new Date());
  activeReviewDate = value > today ? today : value;
  reviewDateInput.value = activeReviewDate;
  resetReviewBatch();
  renderDailyReviewBoard();
}

reviewCalendar?.addEventListener("click", (event) => {
  if (event.target.closest("#reviewPrevDay")) {
    shiftReviewDate(-1);
    return;
  }
  if (event.target.closest("#reviewNextDay")) {
    if (!reviewNextDay.disabled) shiftReviewDate(1);
    return;
  }
  const current = event.target.closest(".review-date-current");
  if (!current || event.target === reviewDateInput) return;
  event.preventDefault();
  try {
    reviewDateInput.showPicker();
  } catch {
    reviewDateInput.focus();
    reviewDateInput.click();
  }
});
reviewDateInput?.addEventListener("change", () => {
  if (!reviewDateInput.value) return;
  selectReviewDate(reviewDateInput.value);
});
reviewDateInput?.addEventListener("click", (event) => {
  event.stopPropagation();
  try {
    reviewDateInput.showPicker();
  } catch {
    reviewDateInput.focus();
  }
});
reviewCalendar?.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    shiftReviewDate(-1);
  }
  if (event.key === "ArrowRight" && !reviewNextDay.disabled) {
    event.preventDefault();
    shiftReviewDate(1);
  }
});
reviewWorkTypeSwitch?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-worktype]");
  if (!button || button.dataset.reviewWorktype === activeReviewWorkType) return;
  activeReviewWorkType = button.dataset.reviewWorktype;
  resetReviewBatch();
  renderDailyReviewBoard();
});
reviewStatusTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-filter]");
  if (!button) return;
  activeReviewFilter = button.dataset.reviewFilter;
  activeReviewResultFilter = "all";
  resetReviewBatch();
  renderDailyReviewBoard();
});
startLibrarySession.addEventListener("click", () => {
  if (!canStartCustomerReview()) return;
  if (!libraryCustomer.value || !libraryViewer.value.trim()) {
    libraryStatus.textContent = "请先选择客户，并填写选稿人。";
    return;
  }
  librarySessionActive = true;
  renderLibraryGrid();
  showToast("已开始客户选稿。", "success");
});
toggleLibraryInfo.addEventListener("click", () => {
  libraryInfoHidden = !libraryInfoHidden;
  libraryGrid.classList.toggle("cards-info-hidden", libraryInfoHidden);
  toggleLibraryInfo.textContent = libraryInfoHidden ? "显示卡片信息" : "隐藏卡片信息";
});
compareSelected.addEventListener("click", openCompareOverlay);
topRefreshButton?.addEventListener("click", () => window.location.reload());
topCartButton?.addEventListener("click", openCartPreview);
cartPreviewClose?.addEventListener("click", closeCartPreview);
cartPreviewList?.addEventListener("click", (event) => {
  const preview = event.target.closest("[data-cart-preview-pop]");
  if (!preview) return;
  closeCartPreview();
  openCustomerPatternViewer(preview.dataset.cartPreviewPop, { previewOnly: true, contextFiles: customerCartContextFiles(preview.dataset.cartPreviewPop) });
});
openFullCart?.addEventListener("click", () => {
  closeCartPreview();
  switchView("cart");
});
globalSearchInput?.addEventListener("input", renderGlobalSearchResults);
function setGlobalSearchExpanded(expanded, { focus = false } = {}) {
  if (!globalSearch) return;
  globalSearch.classList.toggle("expanded", expanded);
  globalSearchToggle?.setAttribute("aria-expanded", String(expanded));
  globalSearchToggle?.setAttribute("aria-label", expanded ? "收起全局搜索" : "展开全局搜索");
  if (expanded && focus) requestAnimationFrame(() => globalSearchInput?.focus());
  if (!expanded) hideGlobalSearchResults();
}
globalSearchToggle?.addEventListener("click", () => {
  const expanded = !globalSearch?.classList.contains("expanded");
  setGlobalSearchExpanded(expanded, { focus: expanded });
});
globalSearchInput?.addEventListener("focus", () => {
  setGlobalSearchExpanded(true);
  renderGlobalSearchResults();
});
globalSearchResults?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-global-result]");
  if (!button) return;
  openGlobalSearchResult(Number(button.dataset.globalResult));
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".global-search")) {
    hideGlobalSearchResults();
    if (!globalSearchInput?.value.trim()) setGlobalSearchExpanded(false);
  }
});
notificationButton?.addEventListener("click", openNotificationModal);
notificationClose?.addEventListener("click", closeNotificationModal);
notificationList?.addEventListener("click", (event) => {
  const dismissButton = event.target.closest("[data-dismiss-notification]");
  if (!dismissButton) return;
  event.preventDefault();
  event.stopPropagation();
  const row = dismissButton.closest(".notice-row");
  dismissButton.disabled = true;
  row?.classList.add("removing");
  window.setTimeout(() => {
    dismissedNotifications.add(dismissButton.dataset.dismissNotification);
    saveStudioState();
    renderNotifications();
  }, 130);
});
notificationMore?.addEventListener("click", () => {
  notificationsExpanded = !notificationsExpanded;
  renderNotifications();
});
document.querySelector("#notificationClear")?.addEventListener("click", () => {
  notificationItems().forEach((item) => dismissedNotifications.add(item.key));
  notificationsExpanded = false;
  saveStudioState();
  renderNotifications();
  showToast("通知已清空。", "success");
});
notificationDismiss?.addEventListener("click", closeNotificationModal);
tagManagerButton?.addEventListener("click", openTagManager);
tagManagerClose?.addEventListener("click", closeTagManager);
tagManagerDone?.addEventListener("click", closeTagManager);
tagManagerModal?.addEventListener("click", (event) => {
  if (event.target === tagManagerModal) closeTagManager();
});
tagManagerBody?.addEventListener("click", (event) => {
  const categoryAddButton = event.target.closest("[data-tag-category-add]");
  if (categoryAddButton) {
    addManagedTagCategory(tagManagerBody.querySelector("[data-tag-category-new]")?.value);
    return;
  }
  const group = event.target.closest("[data-tag-category]");
  if (!group) return;
  const categoryKey = group.dataset.tagCategory;
  if (event.target.closest("[data-tag-category-toggle]")) {
    if (expandedTagCategories.has(categoryKey)) expandedTagCategories.delete(categoryKey);
    else expandedTagCategories.add(categoryKey);
    renderTagManager();
    return;
  }
  if (event.target.closest("[data-tag-category-edit]")) {
    const category = libraryFilterConfig.find((item) => item.key === categoryKey);
    const nextName = window.prompt("修改大分类名称", category?.label || "");
    if (nextName !== null) renameManagedTagCategory(categoryKey, nextName);
    return;
  }
  if (event.target.closest("[data-tag-category-delete]")) {
    deleteManagedTagCategory(categoryKey);
    return;
  }
  const deleteButton = event.target.closest("[data-tag-delete]");
  if (deleteButton) {
    deleteManagedTag(categoryKey, deleteButton.dataset.tagDelete);
    return;
  }
  const addButton = event.target.closest("[data-tag-add]");
  if (addButton) {
    const input = group.querySelector("[data-tag-new]");
    addManagedTag(categoryKey, input?.value);
  }
});
tagManagerBody?.addEventListener("change", (event) => {
  const group = event.target.closest("[data-tag-category]");
  if (!group) return;
  const categoryInput = event.target.closest("[data-tag-category-rename]");
  if (categoryInput) {
    renameManagedTagCategory(group.dataset.tagCategory, categoryInput.value);
    return;
  }
  const input = event.target.closest("[data-tag-rename]");
  if (input) renameManagedTag(group.dataset.tagCategory, input.dataset.tagRename, input.value);
});
tagManagerBody?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (event.target.matches("[data-tag-category-new]")) {
    event.preventDefault();
    addManagedTagCategory(event.target.value);
    return;
  }
  const group = event.target.closest("[data-tag-category]");
  if (!group) return;
  event.preventDefault();
  if (event.target.matches("[data-tag-new]")) addManagedTag(group.dataset.tagCategory, event.target.value);
  if (event.target.matches("[data-tag-rename], [data-tag-category-rename]")) event.target.blur();
});
quickCreateButton?.addEventListener("click", openQuickCreateModal);
quickCreateClose?.addEventListener("click", closeQuickCreateModal);
quickCreateGrid?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-quick-action]");
  if (actionButton) handleQuickCreate(actionButton.dataset.quickAction);
});
customerClose?.addEventListener("click", requestCloseCustomerModal);
customerCancel?.addEventListener("click", requestCloseCustomerModal);
customerConfirm?.addEventListener("click", createCustomerFromModal);
customerNameInput?.addEventListener("input", clearCustomerValidation);
customerGenderOptions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-customer-gender]");
  if (!button) return;
  selectedCustomerGender = button.dataset.customerGender;
  renderCustomerGenderOptions();
});
customerPreferenceTags?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-customer-tag]");
  if (!button) return;
  const tag = button.dataset.customerTag;
  if (selectedCustomerPreferences.includes(tag)) {
    selectedCustomerPreferences = selectedCustomerPreferences.filter((item) => item !== tag);
  } else if (selectedCustomerPreferences.length < 6) {
    selectedCustomerPreferences = [...selectedCustomerPreferences, tag];
  } else {
    showToast("客户偏好最多选择 6 项。", "error");
  }
  renderCustomerPreferences();
});
customerValidationSummary?.addEventListener("click", () => {
  customerModal.querySelector(".customer-name-field")?.scrollIntoView({ behavior: "smooth", block: "center" });
  customerNameInput.focus();
});
customerModal?.addEventListener("click", (event) => {
  if (event.target === customerModal) requestCloseCustomerModal();
});
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-dismiss-notification]")) return;
  if (event.target.closest(".top-actions") || event.target.closest(".top-popover")) return;
  closeTopPopovers();
});
openProjectModal?.addEventListener("click", openProjectCreateModal);
openProjectDrafts?.addEventListener("click", openProjectDraftBox);
openArchivedProjects?.addEventListener("click", openProjectArchiveModal);
projectDraftClose?.addEventListener("click", closeProjectDraftBox);
projectSaveDraft?.addEventListener("click", () => {
  saveCreateProjectDraft().catch((error) => {
    console.error(error);
    showToast("草稿保存失败，请重试。", "error");
  });
});
projectDraftModal?.addEventListener("click", (event) => {
  if (event.target === projectDraftModal) closeProjectDraftBox();
  const openButton = event.target.closest("[data-project-draft-open]");
  if (openButton) restoreProjectDraft(openButton.dataset.projectDraftOpen);
  const deleteButton = event.target.closest("[data-project-draft-delete]");
  if (deleteButton) {
    projectDrafts = projectDrafts.filter((draft) => draft.id !== deleteButton.dataset.projectDraftDelete);
    saveProjectDrafts();
  }
});
projectArchiveClose?.addEventListener("click", closeProjectArchiveModal);
projectArchiveModal?.addEventListener("click", (event) => {
  if (event.target === projectArchiveModal) closeProjectArchiveModal();
  const reopenButton = event.target.closest("[data-project-archive-reopen]");
  if (!reopenButton) return;
  const project = customProjects.find((item) => item.id === reopenButton.dataset.projectArchiveReopen);
  if (project && canManageProjectLifecycle(project)) openProjectLifecycleModal(project, "reopen");
});
[projectArchiveResultFilter, projectArchiveTypeFilter, projectArchiveTimeFilter].forEach((control) => control?.addEventListener("change", renderProjectArchiveList));
[projectArchiveCustomerFilter, projectArchiveOwnerFilter, projectArchiveDeadlineFilter].forEach((control) => control?.addEventListener("input", renderProjectArchiveList));
projectLifecycleClose?.addEventListener("click", closeProjectLifecycleModal);
projectLifecycleCancel?.addEventListener("click", closeProjectLifecycleModal);
projectLifecycleConfirm?.addEventListener("click", () => {
  submitProjectLifecycleAction().catch((error) => {
    console.error(error);
    showToast("项目操作失败，请重试。", "error");
  });
});
projectLifecycleModal?.addEventListener("click", (event) => {
  if (event.target === projectLifecycleModal) closeProjectLifecycleModal();
});
projectClose?.addEventListener("click", requestCloseProjectCreateModal);
projectCancel?.addEventListener("click", requestCloseProjectCreateModal);
chooseProjectFiles?.addEventListener("click", () => projectFilesInput.click());
projectFilesInput?.addEventListener("change", () => {
  selectedProjectFiles = mergeProjectFiles(selectedProjectFiles, [...projectFilesInput.files]);
  projectFilesInput.value = "";
  renderProjectFileReadout();
});
projectFileReadout?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-project-file]");
  if (!removeButton) return;
  selectedProjectFiles.splice(Number(removeButton.dataset.removeProjectFile), 1);
  renderProjectFileReadout();
});
projectNameInput?.addEventListener("input", () => {
  clearProjectValidation();
});
projectCustomerInput?.addEventListener("input", () => {
  const exactMatch = [...projectCustomerSelect.options].find((option) => option.textContent === projectCustomerInput?.value.trim());
  if (exactMatch) projectCustomerSelect && (projectCustomerSelect.value = exactMatch.value)
  renderProjectCustomerOptions(projectCustomerInput?.value);
});
projectCustomerOptions?.addEventListener("click", (event) => {
  const createButton = event.target.closest("[data-project-customer-create]");
  if (createButton) {
    event.preventDefault();
    createDefaultProjectCustomer(createButton.dataset.projectCustomerCreate);
    return;
  }
  const option = event.target.closest("[data-project-customer]");
  if (!option) return;
  event.preventDefault();
  chooseProjectCustomer(option.dataset.projectCustomer);
});
projectCustomerCreateInline?.addEventListener("click", () => {
  createDefaultProjectCustomer(projectCustomerCreateInline.dataset.customerName || projectCustomerInput?.value);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("#projectCustomerCombobox")) setProjectCustomerOpen(false);
  const activeMemberBox = event.target.closest(".project-member-combobox");
  projectModal?.querySelectorAll(".project-member-results.open").forEach((results) => {
    if (results.closest(".project-member-combobox") !== activeMemberBox) results.classList.remove("open");
  });
  const activeDetailSearch = event.target.closest(".detail-search-combobox, .project-detail-member-picker");
  projectDetailBody?.querySelectorAll(".detail-search-results.open").forEach((results) => {
    if (results.closest(".detail-search-combobox, .project-detail-member-picker") !== activeDetailSearch) results.classList.remove("open");
  });
});
document.querySelectorAll("[data-member-search]").forEach((input) => {
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    const box = input.closest(".project-member-combobox");
    const results = box?.querySelector(".project-member-results");
    const options = [...(results?.querySelectorAll("label, button") || [])].filter((option) => !option.classList.contains("member-search-empty"));
    options.forEach((option) => {
      option.hidden = Boolean(query) && !searchMatches(query, [option.textContent]);
    });
    toggleMemberSearchEmpty(results, Boolean(query) && !options.some((option) => !option.hidden));
    results?.classList.toggle("open", Boolean(query));
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const results = input.closest(".project-member-combobox")?.querySelector(".project-member-results");
    const firstVisible = [...(results?.querySelectorAll("label, button") || [])].find((option) => !option.hidden);
    if (!firstVisible || !input.value.trim()) return;
    event.preventDefault();
    const checkbox = firstVisible.querySelector("input[type='checkbox']");
    if (checkbox) checkbox.click();
    else firstVisible.click();
    input.value = "";
    toggleMemberSearchEmpty(results, false);
    results.classList.remove("open");
  });
});
projectValidationSummary?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-validation-target]");
  if (!button) return;
  projectModal.querySelector(button.dataset.projectValidationTarget)?.scrollIntoView({ behavior: "smooth", block: "center" });
});
[projectStartDate, projectEndDate].forEach((input) => input?.addEventListener("input", () => {
  input.value = formatProjectDateInput(input.value);
  clearProjectValidation();
}));
[
  [projectDesignerOptions, projectDesignerSearch],
  [projectPainterOptions, projectPainterSearch],
  [projectOwnerOptions, projectOwnerSearch],
].forEach(([container, searchInput]) => container?.addEventListener("change", () => {
  updateProjectMemberSummaries();
  if (searchInput) searchInput.value = "";
  container.querySelectorAll("label, button").forEach((option) => { option.hidden = false; });
  toggleMemberSearchEmpty(container, false);
  container.classList.remove("open");
}));
projectStatusOptions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-status]");
  if (!button) return;
  selectedProjectStatus = button.dataset.projectStatus;
  renderProjectStatusOptions();
});
projectTypeOptions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-type]");
  if (!button) return;
  selectedProjectType = button.dataset.projectType;
  renderProjectTypeOptions();
});
projectAddNote?.addEventListener("click", addProjectNoteLog);
projectConfirm?.addEventListener("click", () => {
  createProjectFromModal().catch((error) => {
    console.error(error);
    showToast("项目保存失败，请重新选择资料。", "error");
  });
});
projectModal?.addEventListener("click", (event) => {
  const removeMember = event.target.closest("[data-project-member-remove]");
  if (removeMember) {
    const box = removeMember.closest(".project-member-combobox");
    const container = box?.querySelector(".project-member-results")
      || (removeMember.closest(".project-member-selected") === projectDesignerSummary ? projectDesignerOptions
        : removeMember.closest(".project-member-selected") === projectPainterSummary ? projectPainterOptions
        : projectOwnerOptions);
    const value = removeMember.dataset.projectMemberRemove;
    const input = [...(container?.querySelectorAll("input") || [])].find((item) => item.value === value);
    if (input) input.checked = false;
    updateProjectMemberSummaries();
    return;
  }
  if (event.target === projectModal) requestCloseProjectCreateModal();
});
// ===== 客户中心交互 =====
document.querySelector("#openCustomerCreate")?.addEventListener("click", () => openCustomerModal());
document.querySelector("#customerManageToggle")?.addEventListener("click", () => {
  customerManageMode = !customerManageMode;
  customerManageSelection.clear();
  document.querySelector("#customerManageToggle span").textContent = customerManageMode ? "完成管理" : "管理";
  document.querySelector("#customerManagePin")?.classList.toggle("hidden", !customerManageMode);
  document.querySelector("#customerManageDelete")?.classList.toggle("hidden", !customerManageMode);
  renderCustomerList();
});
document.querySelector("#customerManagePin")?.addEventListener("click", () => {
  const selected = customerCenterClients.filter((client) => customerManageSelection.has(client.id));
  if (!selected.length) return;
  const shouldPin = !selected.every((client) => client.pinned);
  setCustomerPinned(selected.map((client) => client.id), shouldPin);
  customerManageSelection.clear();
  renderCustomerList();
  showToast(shouldPin ? "已将所选客户置顶。" : "已取消所选客户置顶。", "success");
});
document.querySelector("#customerManageDelete")?.addEventListener("click", () => {
  const selected = customerCenterClients.filter((client) => customerManageSelection.has(client.id));
  if (!selected.length) return;
  openExitConfirmation({
    title: `删除所选 ${selected.length} 位客户？`,
    message: "删除后客户档案会从列表中移除。",
    submitText: "确认删除",
    onConfirm: () => {
      const ids = new Set(selected.map((client) => client.id));
      customerCenterClients = customerCenterClients.filter((client) => !ids.has(client.id));
      customerManagementState.removedIds = [...new Set([...(customerManagementState.removedIds || []), ...ids])];
      customerManagementState.pinnedIds = (customerManagementState.pinnedIds || []).filter((id) => !ids.has(id));
      saveCustomerManagementState();
      customerManageSelection.clear();
      renderCustomerList();
      showToast(`已删除 ${selected.length} 位客户。`, "success");
    },
  });
});
document.querySelector("#customerListBody")?.addEventListener("click", (event) => {
  const selection = event.target.closest("[data-customer-select]");
  if (selection) {
    event.stopPropagation();
    if (selection.checked) customerManageSelection.add(selection.dataset.customerSelect);
    else customerManageSelection.delete(selection.dataset.customerSelect);
    renderCustomerList();
    return;
  }
  if (customerManageMode) {
    const managedRow = event.target.closest("[data-customer-id]");
    if (managedRow) {
      const id = managedRow.dataset.customerId;
      if (customerManageSelection.has(id)) customerManageSelection.delete(id);
      else customerManageSelection.add(id);
      renderCustomerList();
    }
    return;
  }
  // ⋯ 菜单开关
  const menuBtn = event.target.closest("[data-customer-menu]");
  if (menuBtn) {
    event.stopPropagation();
    openCustomerMenuId = openCustomerMenuId === menuBtn.dataset.customerMenu ? null : menuBtn.dataset.customerMenu;
    renderCustomerList();
    return;
  }
  const pin = event.target.closest("[data-customer-pin]");
  if (pin) {
    event.stopPropagation();
    const client = customerCenterClients.find((item) => item.id === pin.dataset.customerPin);
    if (!client) return;
    setCustomerPinned([client.id], !client.pinned);
    openCustomerMenuId = null;
    renderCustomerList();
    showToast(client.pinned ? "客户已置顶。" : "已取消客户置顶。", "success");
    return;
  }
  // 删除客户
  const del = event.target.closest("[data-customer-delete]");
  if (del) {
    event.stopPropagation();
    const client = customerCenterClients.find((c) => c.id === del.dataset.customerDelete);
    if (!client) return;
    openCustomerMenuId = null;
    openExitConfirmation({
      title: `删除客户「${client.name}」？`,
      message: "删除后该客户档案会从列表中移除。",
      submitText: "确认删除",
      onConfirm: () => {
        customerCenterClients = customerCenterClients.filter((c) => c.id !== client.id);
        customerManagementState.removedIds = [...new Set([...(customerManagementState.removedIds || []), client.id])];
        customerManagementState.pinnedIds = (customerManagementState.pinnedIds || []).filter((id) => id !== client.id);
        saveCustomerManagementState();
        if (activeCustomerCenterId === client.id) { activeCustomerCenterId = null; closeCustomerDrawer(); }
        renderCustomerList();
        showToast("客户已删除。", "success");
      },
    });
    return;
  }
  // 点击整行 → 打开档案抽屉
  const row = event.target.closest("[data-customer-id]");
  if (!row) return;
  activeCustomerCenterId = row.dataset.customerId;
  activeCustomerTab = "overview";
  openCustomerMenuId = null;
  renderCustomerList();
  openCustomerDrawer();
});
document.querySelector("#customerListBody")?.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key) || event.target.closest("button")) return;
  const row = event.target.closest("[data-customer-id]");
  if (!row) return;
  event.preventDefault();
  row.click();
});
document.addEventListener("click", (event) => {
  if (openCustomerMenuId && !event.target.closest(".cc-row-action")) {
    openCustomerMenuId = null;
    if (document.querySelector("#customerListBody")) renderCustomerList();
  }
});
document.querySelector("#customerListPager")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-cc-page]");
  if (!btn || btn.disabled) return;
  const val = btn.dataset.ccPage;
  const pages = Math.max(1, Math.ceil(filteredCustomerClients().length / CUSTOMER_PAGE_SIZE));
  if (val === "prev") customerCenterPage = Math.max(1, customerCenterPage - 1);
  else if (val === "next") customerCenterPage = Math.min(pages, customerCenterPage + 1);
  else customerCenterPage = Number(val);
  renderCustomerList();
});
document.querySelector("#customerDrawerClose")?.addEventListener("click", closeCustomerDrawer);
document.querySelector("#customerDrawerBackdrop")?.addEventListener("click", closeCustomerDrawer);
document.querySelector("#customerDetailPanel")?.addEventListener("click", (event) => {
  // 负责人：点击弹出员工选择
  const pick = event.target.closest("[data-cc-pick]");
  if (pick) {
    startOwnerPick(pick);
    return;
  }
  // 单击就地编辑
  const editEl = event.target.closest("[data-cc-edit]");
  if (editEl) {
    startInlineEdit(editEl);
    return;
  }
  const tab = event.target.closest("[data-customer-tab]");
  if (tab) {
    activeCustomerTab = tab.dataset.customerTab;
    renderCustomerDetail();
    return;
  }
  const workBtn = event.target.closest("[data-customer-open-work]");
  if (workBtn) {
    const card = [...workCards].find((c) => c.dataset.file === workBtn.dataset.customerOpenWork);
    if (card) openLightbox(card);
  }
});
function startInlineEdit(el) {
  const client = activeCustomerClient();
  if (!client) return;
  const field = el.dataset.ccEdit;
  const previousValue = client[field] || "";
  const input = document.createElement("input");
  input.className = "cc-inline-input";
  input.value = client[field] || "";
  el.replaceWith(input);
  input.focus();
  input.select?.();
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const nextValue = input.value.trim();
    client[field] = nextValue;
    renderCustomerList();
    renderCustomerDetail();
    if (nextValue !== previousValue) showToast("客户信息已更新。", "success");
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); commit(); }
    if (ev.key === "Escape") { done = true; renderCustomerDetail(); }
  });
}
function startOwnerPick(el) {
  const client = activeCustomerClient();
  if (!client) return;
  const previousOwner = client.owner;
  const roster = employeeRoster();
  const combo = document.createElement("div");
  combo.className = "cc-owner-combobox";
  combo.innerHTML = `
    <input class="cc-inline-input" type="search" value="${escapeHtml(client.owner || "")}" placeholder="搜索" autocomplete="off" aria-label="搜索并选择负责人" aria-expanded="true">
    <span class="cc-owner-caret" aria-hidden="true"></span>
    <div class="cc-owner-options" role="listbox"></div>`;
  el.replaceWith(combo);
  const input = combo.querySelector("input");
  const options = combo.querySelector(".cc-owner-options");
  let done = false;
  const filtered = () => {
    const query = input.value.trim().toLowerCase();
    return roster.filter((name) => !query || searchMatches(query, [name]));
  };
  const renderOptions = () => {
    const list = filtered();
    options.innerHTML = list.length
      ? list.map((name, index) => `<button class="${name === client.owner ? "selected" : ""}" type="button" role="option" data-cc-owner-option="${escapeHtml(name)}" ${index === 0 ? 'data-cc-owner-first="true"' : ""}><span>${escapeHtml(name)}</span>${name === client.owner ? "<i>✓</i>" : ""}</button>`).join("")
      : `<p>未找到相关人员</p>`;
  };
  const commit = (owner) => {
    if (done) return;
    done = true;
    client.owner = owner;
    renderCustomerDetail();
    if (client.owner !== previousOwner) showToast("客户负责人已更新。", "success");
  };
  renderOptions();
  input.focus();
  input.select();
  input.addEventListener("input", renderOptions);
  options.addEventListener("mousedown", (event) => event.preventDefault());
  options.addEventListener("click", (event) => {
    const option = event.target.closest("[data-cc-owner-option]");
    if (option) commit(option.dataset.ccOwnerOption);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const exact = roster.find((name) => name.toLowerCase() === input.value.trim().toLowerCase());
      const first = filtered()[0];
      if (exact || first) commit(exact || first);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      done = true;
      renderCustomerDetail();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      options.querySelector("button")?.focus();
    }
  });
  combo.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      if (!done && !combo.contains(document.activeElement)) {
        done = true;
        renderCustomerDetail();
      }
    });
  });
}
document.querySelector("#backToCustomerCenter")?.addEventListener("click", () => {
  const flow = document.querySelector("#customerSelectionFlow");
  flow?.classList.remove("viewer-mode");
  flow?.classList.add("hidden");
  document.querySelector("#library")?.classList.remove("viewer-library-active");
  document.querySelector("#customerCenter")?.classList.remove("hidden");
  if (pageTitle) pageTitle.textContent = titleMap.library || "客户中心";
  viewerLibraryHead?.classList.add("hidden");
  viewerLibraryFilterBar?.classList.add("hidden");
  viewerLibrarySelectedConditions?.classList.add("hidden");
  document.querySelector("#viewerSelectionBar")?.classList.add("hidden");
});

projectDetailClose?.addEventListener("click", requestCloseProjectDetailModal);
// 详情内任何输入/勾选/成员改动都视为有未保存修改。
projectDetailBody?.addEventListener("input", () => { projectDetailDirty = true; });
projectDetailBody?.addEventListener("change", () => { projectDetailDirty = true; });
projectDetailBody?.addEventListener("click", (event) => {
  const lifecycleButton = event.target.closest("[data-project-lifecycle-action]");
  if (lifecycleButton) {
    const project = customProjects.find((item) => item.id === lifecycleButton.dataset.projectId);
    handleProjectLifecycleAction(project, lifecycleButton.dataset.projectLifecycleAction);
    return;
  }
  if (event.target.closest("[data-project-detail-status-option],[data-project-detail-type-option],[data-project-detail-member-remove],[data-open-detail-member-picker],[data-project-detail-search-option]")) {
    projectDetailDirty = true;
  }
});
projectDetailTopStatus?.addEventListener("click", (event) => {
  const draftButton = event.target.closest("[data-project-detail-draft]");
  if (draftButton) {
    saveProjectDetailDraft(draftButton.dataset.projectDetailDraft);
    return;
  }
  const saveButton = event.target.closest("[data-project-detail-save]");
  if (saveButton) {
    saveProjectDetailChanges(saveButton.dataset.projectDetailSave);
    return;
  }
  const deleteButton = event.target.closest("[data-project-delete]");
  if (deleteButton) deleteProject(deleteButton.dataset.projectDelete);
});
projectDetailModal?.addEventListener("click", (event) => {
  if (event.target === projectDetailModal) requestCloseProjectDetailModal();
});
document.addEventListener("click", (event) => {
  const createButton = event.target.closest("[data-open-member-picker]");
  if (createButton) {
    event.preventDefault();
    openMemberPicker(createButton.dataset.openMemberPicker, "create");
    return;
  }
  const detailButton = event.target.closest("[data-open-detail-member-picker]");
  if (detailButton) {
    event.preventDefault();
    openMemberPicker(detailButton.dataset.openDetailMemberPicker, "detail");
  }
});
memberPickerModal?.querySelectorAll("[data-member-picker-close]").forEach((button) => button.addEventListener("click", closeMemberPicker));
memberPickerSearch?.addEventListener("input", renderMemberPicker);
memberPickerFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-member-load-filter]");
  if (!button) return;
  memberPickerLoadFilter = button.dataset.memberLoadFilter;
  memberPickerFilters.querySelectorAll("[data-member-load-filter]").forEach((item) => item.classList.toggle("active", item === button));
  renderMemberPicker();
});
memberPickerList?.addEventListener("click", (event) => {
  const row = event.target.closest("[data-member-picker-value]");
  if (!row) return;
  const name = row.dataset.memberPickerValue;
  if (memberPickerDraft.has(name)) memberPickerDraft.delete(name);
  else memberPickerDraft.add(name);
  renderMemberPicker();
});
memberPickerConfirm?.addEventListener("click", confirmMemberPicker);
projectDetailBody?.addEventListener("input", (event) => {
  const dateField = event.target.closest('[data-project-detail-field="startAt"], [data-project-detail-field="endAt"]');
  if (dateField) dateField.value = formatProjectDateInput(dateField.value);
  const searchInput = event.target.closest('[data-project-detail-field="customer"]');
  if (searchInput) {
    const query = searchInput.value.trim().toLowerCase();
    const box = searchInput.closest(".detail-search-combobox");
    const results = box?.querySelector(".detail-search-results");
    results?.querySelectorAll("button").forEach((button) => { button.hidden = !query || !searchMatches(query, [button.textContent]); });
    results?.classList.toggle("open", Boolean(query));
  }
  const memberSearch = event.target.closest("[data-project-detail-member-search]");
  if (memberSearch) {
    const query = memberSearch.value.trim().toLowerCase();
    const results = memberSearch.closest(".project-detail-member-picker")?.querySelector(".detail-search-results");
    const options = [...(results?.querySelectorAll("[data-project-detail-member-option]") || [])];
    options.forEach((button) => { button.hidden = !query || !searchMatches(query, [button.textContent]); });
    toggleMemberSearchEmpty(results, Boolean(query) && !options.some((button) => !button.hidden));
    results?.classList.toggle("open", Boolean(query));
  }
});
projectDetailBody?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const searchInput = event.target.closest('[data-project-detail-field="customer"], [data-project-detail-member-search]');
  if (!searchInput || !searchInput.value.trim()) return;
  const container = searchInput.closest(".detail-search-combobox, .project-detail-member-picker");
  const firstVisible = [...(container?.querySelectorAll(".detail-search-results button") || [])].find((button) => !button.hidden);
  if (!firstVisible) return;
  event.preventDefault();
  firstVisible.click();
});
projectDetailBody?.addEventListener("click", (event) => {
  const removeSelectedMember = event.target.closest("[data-project-detail-member-remove]");
  if (removeSelectedMember) {
    const picker = removeSelectedMember.closest(".project-detail-member-picker");
    const role = removeSelectedMember.dataset.projectDetailMemberRemove;
    const option = [...picker.querySelectorAll(`[data-project-detail-member-option="${role}"]`)].find((button) => button.dataset.value === removeSelectedMember.dataset.value);
    option?.classList.remove("active");
    renderProjectDetailMemberSelection(picker);
    return;
  }
  const searchOption = event.target.closest("[data-project-detail-search-option]");
  if (searchOption) {
    const key = searchOption.dataset.projectDetailSearchOption;
    const box = searchOption.closest(".detail-search-combobox");
    const input = box?.querySelector(`[data-project-detail-field="${key}"]`);
    if (input) input.value = searchOption.dataset.value;
    box?.querySelector(".detail-search-results")?.classList.remove("open");
    return;
  }
  const memberOption = event.target.closest("[data-project-detail-member-option]");
  if (memberOption) {
    memberOption.classList.toggle("active");
    const picker = memberOption.closest(".project-detail-member-picker");
    renderProjectDetailMemberSelection(picker);
    const input = picker.querySelector("[data-project-detail-member-search]");
    input.value = "";
    const results = picker.querySelector(".detail-search-results");
    results.querySelectorAll("[data-project-detail-member-option]").forEach((button) => { button.hidden = false; });
    toggleMemberSearchEmpty(results, false);
    results.classList.remove("open");
    return;
  }
  const typeOption = event.target.closest("[data-project-detail-type-option]");
  if (typeOption) {
    typeOption.closest("[data-project-detail-type]").querySelectorAll("button").forEach((button) => button.classList.toggle("active", button === typeOption));
    return;
  }
  const statusOption = event.target.closest("[data-project-detail-status-option]");
  if (statusOption) {
    statusOption.closest("[data-project-detail-status]").querySelectorAll("button").forEach((button) => button.classList.toggle("active", button === statusOption));
    return;
  }
  const uploadButton = event.target.closest("[data-project-upload]");
  if (uploadButton) {
    activeProjectId = uploadButton.dataset.projectUpload;
    if (projectDetailFileInput) projectDetailFileInput.value = "";
    projectDetailFileInput.click();
    return;
  }
  const downloadButton = event.target.closest("[data-project-file-download-index]");
  if (downloadButton) {
    const project = activeProject();
    const file = project ? projectFileEntries(project)[Number(downloadButton.dataset.projectFileDownloadIndex)] : null;
    downloadProjectFile(file);
    return;
  }
  const fileButton = event.target.closest("[data-project-file-index]");
  if (!fileButton) return;
  const project = activeProject();
  const index = Number(fileButton.dataset.projectFileIndex);
  const file = project ? projectFileEntries(project)[index] : null;
  openProjectFileViewer(file, index);
});
projectDetailBody?.addEventListener("dblclick", (event) => {
  const changeLogSection = event.target.closest("[data-project-change-log]");
  if (changeLogSection) {
    const project = activeProject();
    if (!project) return;
    projectChangeLogExpanded = !projectChangeLogExpanded;
    refreshProjectDetail(project);
    return;
  }
});
projectDetailFileInput?.addEventListener("change", async () => {
  try {
    await attachProjectDetailFiles(projectDetailFileInput?.files);
  } catch (error) {
    console.error(error);
    showToast("项目文件上传失败，请重新选择。", "error");
  } finally {
    if (projectDetailFileInput) projectDetailFileInput.value = "";
  }
});
projectFileViewerClose?.addEventListener("click", closeProjectFileViewer);
projectFileViewerDownload?.addEventListener("click", () => {
  const file = projectFileEntries(activeProject())[activeProjectFileIndex];
  downloadProjectFile(file);
});
projectFileViewer?.addEventListener("click", (event) => {
  if (event.target === projectFileViewer) closeProjectFileViewer();
});
projectFileViewerPalette?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-viewer-palette]");
  if (!button) return;
  activeProjectFileIndex = Number(button.dataset.projectViewerPalette);
  renderProjectFileViewer();
});
projectFileViewerImage?.addEventListener("wheel", (event) => {
  event.preventDefault();
  event.stopPropagation();
  changeProjectFileZoom(event.deltaY > 0 ? -0.18 : 0.18);
}, { passive: false });
projectFileViewerImage?.addEventListener("dblclick", (event) => {
  event.preventDefault();
  resetProjectFileTransform();
});
projectFileViewerImage?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  projectFileDragStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: projectFileOffsetX,
    offsetY: projectFileOffsetY,
  };
  projectFileViewerImage.classList.add("dragging");
  projectFileViewerImage.setPointerCapture(event.pointerId);
});
projectFileViewerImage?.addEventListener("pointermove", (event) => {
  if (!projectFileDragStart) return;
  event.preventDefault();
  projectFileOffsetX = projectFileDragStart.offsetX + event.clientX - projectFileDragStart.x;
  projectFileOffsetY = projectFileDragStart.offsetY + event.clientY - projectFileDragStart.y;
  applyProjectFileTransform();
});
projectFileViewerImage?.addEventListener("pointerup", () => {
  projectFileDragStart = null;
  projectFileViewerImage.classList.remove("dragging");
});
projectFileViewerImage?.addEventListener("pointercancel", () => {
  projectFileDragStart = null;
  projectFileViewerImage.classList.remove("dragging");
});
projectFileManagerClose?.addEventListener("click", closeProjectFileManager);
projectFileManager?.addEventListener("click", (event) => {
  if (event.target === projectFileManager) closeProjectFileManager();
});
projectFileManagerGrid?.addEventListener("dragstart", (event) => {
  const tile = event.target.closest("[data-project-file-entry]");
  if (!tile) return;
  projectManagerDragEntryId = tile.dataset.projectFileEntry;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", projectManagerDragEntryId);
});
projectFileManagerGrid?.addEventListener("dragend", (event) => {
  if (!projectManagerDragEntryId) return;
  const dialog = projectFileManager?.querySelector(".project-file-manager-dialog");
  const rect = dialog?.getBoundingClientRect();
  const outside = rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  const entryId = projectManagerDragEntryId;
  projectManagerDragEntryId = "";
  if (outside && window.confirm("确认删除这个项目文件吗？")) {
    removeProjectFileByEntryId(entryId);
  }
});
projectFileManagerDropzone?.addEventListener("dragover", (event) => {
  event.preventDefault();
  projectFileManagerDropzone?.classList.add("drag-active");
});
projectFileManagerDropzone?.addEventListener("dragleave", (event) => {
  if (!projectFileManagerDropzone?.contains(event.relatedTarget)) projectFileManagerDropzone?.classList.remove("drag-active");
});
projectFileManagerDropzone?.addEventListener("drop", async (event) => {
  event.preventDefault();
  projectFileManagerDropzone?.classList.remove("drag-active");
  if (!event.dataTransfer?.files?.length) return;
  await attachProjectDetailFiles(event.dataTransfer.files);
  renderProjectFileManager();
});
projectTypeFilter?.addEventListener("change", (event) => {
  const changed = event.target.closest('input[type="checkbox"]');
  if (!changed) return;
  const typeInputs = [...projectTypeFilter.querySelectorAll('input[type="checkbox"]')];
  const allInput = typeInputs.find((input) => input.value === "all");
  const categoryInputs = typeInputs.filter((input) => input.value !== "all");
  if (changed.value === "all") {
    categoryInputs.forEach((input) => { input.checked = changed.checked; });
  } else {
    allInput.checked = categoryInputs.every((input) => input.checked);
  }
  renderProjectTypeFilterSummary();
  renderCustomProjects();
});

[teamRoleFilter, teamStatusFilter].forEach((control) => control?.addEventListener("change", renderTeamView));
teamSearch?.addEventListener("input", renderTeamView);
teamMetrics?.addEventListener("click", (event) => {
  const rankingButton = event.target.closest("[data-team-ranking-open]");
  if (rankingButton) {
    teamRankingPage = 0;
    renderTeamView();
    if (teamOutputRanking) teamOutputRanking.scrollTop = 0;
    teamOutputRankingModal?.classList.add("active");
    teamOutputRankingModal?.setAttribute("aria-hidden", "false");
    lockBodyScroll(true);
    return;
  }
  const overviewButton = event.target.closest("[data-team-overview]");
  if (!overviewButton) return;
  if (teamRoleFilter) teamRoleFilter.value = "all";
  if (teamStatusFilter) teamStatusFilter.value = "all";
  if (teamSearch) teamSearch.value = "";
  teamHighLoadOnly = overviewButton.dataset.teamOverview === "hot";
  renderTeamView();
  if (teamHighLoadOnly && !teamMembers.some((member) => teamLoadClass(teamMemberStats(member).loadScore) === "hot")) {
    showToast("当前暂无高负载成员。");
  }
  requestAnimationFrame(() => document.querySelector("#team .team-library")?.scrollIntoView({ behavior: "smooth", block: "start" }));
});
teamOutputRankingModal?.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-team-ranking-page]");
  if (pageButton && !pageButton.disabled) {
    teamRankingPage = Number(pageButton.dataset.teamRankingPage || 0);
    renderTeamView();
    return;
  }
  if (event.target.closest("[data-team-ranking-close]") || event.target.closest("[data-dashboard-performance]")) {
    teamOutputRankingModal.classList.remove("active");
    teamOutputRankingModal.setAttribute("aria-hidden", "true");
    lockBodyScroll(false);
  }
});
teamManageButton?.addEventListener("click", () => {
  teamManageMode = !teamManageMode;
  renderTeamView();
});
teamNewEmployeeButton?.addEventListener("click", () => openEmployeeAccountModal());
employeeCredentialGenerate?.addEventListener("click", fillRandomEmployeeCredentials);
employeeCredentialResults?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-employee-copy]");
  if (button) copyTextToClipboard(button.dataset.employeeCopy, "密码已复制。");
});
employeeCreateModes?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-employee-mode]");
  if (button) setEmployeeCreateMode(button.dataset.employeeMode);
});
employeeBatchAdd?.addEventListener("click", () => addEmployeeBatchRow());
employeeBatchList?.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".employee-batch-remove");
  if (!removeButton) return;
  removeButton.closest(".employee-batch-row")?.remove();
  if (!employeeBatchList.children.length) addEmployeeBatchRow();
});
employeeAccountClose?.addEventListener("click", closeEmployeeAccountModal);
employeeAccountCancel?.addEventListener("click", closeEmployeeAccountModal);
employeeAccountForm?.addEventListener("click", (event) => event.stopPropagation());
employeeAccountForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (currentAccount.role !== "管理员") return;
  if (employeeAccountSubmit.dataset.results) {
    closeEmployeeAccountModal();
    renderTeamView();
    return;
  }
  const allowedRoles = ["管理员", "设计师", "手绘师", "销售"];
  employeeAccountError.textContent = "";
  if (!editingEmployeeAccountKey && employeeCreateMode === "batch") {
    const rows = [...employeeBatchList.querySelectorAll(".employee-batch-row")]
      .map((row) => ({ name: row.querySelector("[data-batch-name]").value.trim(), role: row.querySelector("[data-batch-role]").value }))
      .filter((item) => item.name || item.role);
    if (!rows.length || rows.some((item) => !item.name || !allowedRoles.includes(item.role))) {
      employeeAccountError.textContent = "请完整填写每位员工的姓名和岗位。";
      return;
    }
    const results = rows.map(({ name, role }) => {
      const { username, password } = randomEmployeeCredentials(name);
      const joinedAt = formatDateTime();
      return { name, role, username, password, joinedAt };
    });
    const provisionedAccounts = [];
    setEmployeeAccountSubmitting(true);
    showAppLoading(`正在创建 ${results.length} 个员工账号`, { progress: true });
    setAppLoadingProgress(5, `正在准备 · 0/${results.length}`);
    await waitForUiPaint();
    try {
      if (RELEASE_CONFIG.useBackendAuth) {
        for (let index = 0; index < results.length; index += 1) {
          const item = results[index];
          setAppLoadingProgress(10 + Math.round((index / results.length) * 55), `正在创建 ${item.name} 的云端登录账号 · ${index}/${results.length}`);
          const provisioned = await provisionBackendEmployeeAccount(item);
          if (provisioned?.created) provisionedAccounts.push(item.username);
          setAppLoadingProgress(10 + Math.round(((index + 1) / results.length) * 55), `${item.name} 的登录账号已创建 · ${index + 1}/${results.length}`);
        }
      }
      setAppLoadingProgress(76, "正在写入员工资料…");
      results.forEach((item) => {
        const member = { name: item.name, role: item.role, ownerKey: item.username, tone: "blue", baseLoadScore: 0, accountStatus: "正常", joinedAt: item.joinedAt };
        teamMembers.push(member);
        persistEmployeeAccount(member, { password: item.password, createdAt: item.joinedAt });
      });
      syncProjectMemberOptions();
      setAppLoadingProgress(88, "正在同步员工资料到云端…");
      await saveStudioStateToCloud();
      setAppLoadingProgress(100, `${results.length} 个员工账号已创建`);
    } catch (error) {
      const failedKeys = new Set(results.map((item) => item.username));
      for (let index = teamMembers.length - 1; index >= 0; index -= 1) {
        if (failedKeys.has(teamMembers[index].ownerKey)) teamMembers.splice(index, 1);
      }
      const accounts = readRegisteredAccounts();
      failedKeys.forEach((key) => {
        delete accounts[key];
        delete demoAccounts[key];
      });
      writeRegisteredAccounts(accounts);
      await Promise.allSettled(provisionedAccounts.map((username) => deprovisionBackendEmployeeAccount({ username })));
      employeeAccountError.textContent = employeeCloudErrorMessage(error, "创建");
      return;
    } finally {
      setEmployeeAccountSubmitting(false);
      hideAppLoading();
    }
    renderTeamView();
    showEmployeeCredentialResults(results.map(({ joinedAt: _joinedAt, ...item }) => item));
    showToast(`已为 ${results.length} 位员工设置账号。`, "success");
    return;
  }
  const username = employeeAccountUsername.value.trim().toLowerCase();
  const joinedAt = employeeAccountJoinedAt.value.trim();
  const name = employeeAccountName.value.trim();
  const role = employeeAccountRole.value;
  const password = employeeAccountPassword.value;
  if (!name) {
    employeeAccountError.textContent = "请输入员工姓名。";
    return;
  }
  if (!username) {
    employeeAccountError.textContent = "请输入登录账号。";
    return;
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(username)) {
    employeeAccountError.textContent = "登录账号需为 3-24 位英文、数字、点、下划线或短横线。";
    return;
  }
  const registeredAccounts = readRegisteredAccounts();
  if (username !== editingEmployeeAccountKey && (demoAccounts[username] || registeredAccounts[username])) {
    employeeAccountError.textContent = "该登录账号已存在，请更换一个账号。";
    return;
  }
  if (!joinedAt) {
    employeeAccountError.textContent = "请输入加入时间。";
    return;
  }
  if (!allowedRoles.includes(role)) {
    employeeAccountError.textContent = "请选择员工岗位。";
    return;
  }
  if (!editingEmployeeAccountKey && !password) {
    employeeAccountError.textContent = "请输入登录密码。";
    return;
  }
  if (password && password.length < 8) {
    employeeAccountError.textContent = "登录密码至少需要 8 位。";
    return;
  }
  const wasEditing = Boolean(editingEmployeeAccountKey);
  let member = teamMembers.find((item) => item.ownerKey === editingEmployeeAccountKey);
  const originalMember = member ? { ...member } : null;
  const originalAccount = member ? { ...(registeredAccounts[username] || demoAccounts[username] || {}) } : null;
  const joinedAtValue = joinedAt;
  const accountPatch = { createdAt: joinedAt };
  if (password) accountPatch.password = password;
  let provisioned = null;
  setEmployeeAccountSubmitting(true);
  showAppLoading(wasEditing ? "正在保存员工账号" : "正在创建员工账号", { progress: true });
  setAppLoadingProgress(8, "正在校验账号资料…");
  await waitForUiPaint();
  try {
    if (RELEASE_CONFIG.useBackendAuth) {
      setAppLoadingProgress(28, wasEditing ? "正在更新云端登录账号…" : "正在创建云端登录账号…");
      provisioned = await provisionBackendEmployeeAccount({ username, password, role, name, allowExisting: wasEditing });
    }
    setAppLoadingProgress(64, "正在写入员工资料…");
    if (!member) {
      member = { name, role, ownerKey: username, tone: "blue", baseLoadScore: 0, accountStatus: "正常", joinedAt: joinedAtValue };
      teamMembers.push(member);
    } else {
      member.name = name;
      member.role = role;
      member.joinedAt = joinedAtValue;
      member.ownerKey = username;
    }
    persistEmployeeAccount(member, accountPatch);
    syncProjectMemberOptions();
    setAppLoadingProgress(86, "正在同步员工资料到云端…");
    await saveStudioStateToCloud();
    setAppLoadingProgress(100, wasEditing ? "员工账号已更新" : "员工账号已创建");
  } catch (error) {
    if (member && !originalMember) teamMembers.splice(teamMembers.indexOf(member), 1);
    if (member && originalMember) Object.assign(member, originalMember);
    const rollbackAccounts = readRegisteredAccounts();
    if (originalAccount) {
      rollbackAccounts[username] = originalAccount;
      demoAccounts[username] = originalAccount;
    } else {
      delete rollbackAccounts[username];
      delete demoAccounts[username];
    }
    writeRegisteredAccounts(rollbackAccounts);
    if (provisioned?.created) await deprovisionBackendEmployeeAccount({ username }).catch(() => {});
    employeeAccountError.textContent = employeeCloudErrorMessage(error);
    return;
  } finally {
    setEmployeeAccountSubmitting(false);
    hideAppLoading();
  }
  renderTeamView();
  if (wasEditing) {
    closeEmployeeAccountModal();
    showToast(`${name} 的账号设置已保存。`, "success");
  } else {
    showEmployeeCredentialResults([{ name, role, username, password }]);
    showToast(`员工账号 ${username} 已创建。`, "success");
  }
});
teamGrid?.addEventListener("click", (event) => {
  const memberButton = event.target.closest("[data-team-member-detail]");
  if (memberButton) {
    openTeamMemberDetail(memberButton.dataset.teamMemberDetail);
    return;
  }
  const projectsButton = event.target.closest("[data-team-projects]");
  if (projectsButton && !projectsButton.disabled) {
    openTeamMemberDetail(projectsButton.dataset.teamProjects);
    return;
  }
  const menuButton = event.target.closest("[data-team-row-menu]");
  if (menuButton) {
    teamManageMode = true;
    renderTeamView();
    return;
  }
  const editAccountButton = event.target.closest("[data-team-account-edit]");
  if (editAccountButton) {
    const member = teamMembers.find((item) => item.ownerKey === editAccountButton.dataset.teamAccountEdit);
    if (member) openEmployeeAccountModal(member);
    return;
  }
  const accountButton = event.target.closest("[data-team-account-toggle]");
  if (accountButton) {
    const member = teamMembers.find((item) => item.ownerKey === accountButton.dataset.teamAccountToggle);
    if (!member) return;
    if ((member.accountStatus || "正常") === "正常") {
      requestDeactivateTeamMember(member);
      return;
    }
    member.accountStatus = "正常";
    persistEmployeeAccount(member, { accountStatus: "正常" });
    saveStudioState();
    syncProjectMemberOptions();
    renderTeamView();
    showToast(`${member.name} 的账号已启用，可以重新加入项目。`, "success");
    return;
  }
  const removeButton = event.target.closest("[data-team-remove]");
  if (removeButton) {
    const index = teamMembers.findIndex((item) => item.ownerKey === removeButton.dataset.teamRemove);
    if (index < 0) return;
    const member = teamMembers[index];
    openExitConfirmation({
      title: `将「${member.name}」移出团队？`,
      message: "移出后，该成员将不再出现在团队成员库中。",
      submitText: "确认移出",
      onConfirm: async () => {
        try {
          await deprovisionBackendEmployeeAccount({ username: member.ownerKey });
          const currentIndex = teamMembers.findIndex((item) => item.ownerKey === member.ownerKey);
          if (currentIndex >= 0) teamMembers.splice(currentIndex, 1);
          const accounts = readRegisteredAccounts();
          delete accounts[member.ownerKey];
          writeRegisteredAccounts(accounts);
          delete demoAccounts[member.ownerKey];
          await saveStudioStateToCloud();
          syncProjectMemberOptions();
          renderTeamView();
          showToast(`${member.name} 的云端账号已撤销，并已移出团队。`, "success");
        } catch (error) {
          console.warn("Deprovision employee failed", error);
          showToast("云端账号撤销失败，员工暂未移出，请重试。", "warning");
        }
      },
    });
  }
});
teamGrid?.addEventListener("contextmenu", (event) => {
  const row = event.target.closest("tr");
  const memberButton = row?.querySelector("[data-team-member-detail]");
  if (!memberButton) return;
  const member = teamMembers.find((item) => item.ownerKey === memberButton.dataset.teamMemberDetail);
  if (!member) return;
  event.preventDefault();
  openTeamQuickMenu(member, event.clientX, event.clientY);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("#teamQuickMenu")) closeTeamQuickMenu();
});
teamGrid?.addEventListener("change", (event) => {
  const roleSelectControl = event.target.closest("[data-team-role]");
  if (!roleSelectControl || currentAccount.role !== "管理员") return;
  const member = teamMembers.find((item) => item.ownerKey === roleSelectControl.dataset.teamRole);
  if (!member || member.ownerKey === currentAccount.ownerKey) {
    renderTeamView();
    return;
  }
  member.role = roleSelectControl.value;
  persistEmployeeAccount(member, { role: member.role });
  saveStudioState();
  syncProjectMemberOptions();
  renderTeamView();
  showToast(`${member.name} 的岗位已调整为${member.role}。`, "success");
});
teamProjectsClose?.addEventListener("click", closeTeamProjectsModal);
teamProjectsModal?.addEventListener("click", (event) => {
  if (event.target === teamProjectsModal) closeTeamProjectsModal();
});
teamProjectsBody?.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-team-project-detail]");
  if (!detailButton) return;
  closeTeamProjectsModal();
  openProjectDetail(detailButton.dataset.teamProjectDetail);
});
compareClose.addEventListener("click", closeCompareOverlay);
compareOverlay.addEventListener("click", (event) => {
  if (event.target === compareOverlay) closeCompareOverlay();
  const removeButton = event.target.closest("[data-compare-remove]");
  if (removeButton) {
    libraryCompareSelection.delete(removeButton.dataset.compareRemove);
    const cards = [...libraryCompareSelection].map(sourceCardByFile).filter(Boolean);
    if (cards.length < 2) {
      closeCompareOverlay();
      renderLibraryGrid();
      showToast("已移除，少于 2 个稿件，比对已退出。", "warning");
      return;
    }
    compareCount.textContent = `已选择 ${cards.length} 组`;
    compareGrid.innerHTML = cards.map(compareTileHtml).join("");
    compareGrid.dataset.count = String(cards.length);
    compareGrid.querySelectorAll(".compare-tile").forEach((tile) => {
      const card = sourceCardByFile(tile.dataset.compareFile);
      if (card) applyCompareVariant(tile, card, 1);
    });
    renderLibraryGrid();
    return;
  }
  const variantButton = event.target.closest("[data-compare-variant]");
  if (!variantButton) return;
  const tile = variantButton.closest(".compare-tile");
  const card = sourceCardByFile(tile?.dataset.compareFile);
  if (tile && card) applyCompareVariant(tile, card, Number(variantButton.dataset.compareVariant));
});
confirmCartOrder.addEventListener("click", confirmLibraryOrder);
orderStatusFilter.addEventListener("change", renderOrderCenter);
["#orderFilterNo", "#orderFilterName", "#orderFilterUser"].forEach((sel) => {
  const el = document.querySelector(sel);
  el?.addEventListener("input", renderOrderCenter);
  el?.addEventListener("keydown", (e) => { if (e.key === "Enter") renderOrderCenter(); });
});
orderList.addEventListener("click", (event) => {
  if (orderManageMode) {
    const card = event.target.closest("[data-order-card]");
    if (!card) return;
    const id = card.dataset.orderCard;
    if (orderManageSelection.has(id)) orderManageSelection.delete(id);
    else orderManageSelection.add(id);
    renderOrderCenter();
    return;
  }
  const customerPick = event.target.closest("[data-order-customer-pick]");
  if (customerPick) {
    const [orderId, customerId] = customerPick.dataset.orderCustomerPick.split("|");
    const order = studioOrders.find((item) => item.id === orderId);
    const client = customerCenterClients.find((item) => item.id === customerId);
    if (order && client) bindOrderCustomer(order, client);
    return;
  }
  const customerCreate = event.target.closest("[data-order-customer-create]");
  if (customerCreate) {
    const order = studioOrders.find((item) => item.id === customerCreate.dataset.orderCustomerCreate);
    const input = customerCreate.closest(".oc-order-customer-combo")?.querySelector("[data-order-customer-input]");
    createAndBindOrderCustomer(order, input?.value);
    return;
  }
  // 价格：点击修改（管理员/销售）
  const priceVisibilityButton = event.target.closest("[data-order-price-visibility]");
  if (priceVisibilityButton) {
    const id = priceVisibilityButton.dataset.orderPriceVisibility;
    if (revealedCompletedOrderAmounts.has(id)) revealedCompletedOrderAmounts.delete(id);
    else revealedCompletedOrderAmounts.add(id);
    renderOrderCenter();
    return;
  }
  const priceBtn = event.target.closest("[data-order-price]");
  if (priceBtn) { editOrderPrice(priceBtn.dataset.orderPrice, priceBtn); return; }
  const deleteBtn = event.target.closest("[data-order-delete]");
  if (deleteBtn) { deleteStudioOrder(deleteBtn.dataset.orderDelete); return; }
  const advanceBtn = event.target.closest("[data-order-advance]");
  if (advanceBtn) { advanceOrderMilestone(advanceBtn.dataset.orderAdvance); return; }
  const undoBtn = event.target.closest("[data-order-undo]");
  if (undoBtn) { undoOrderMilestone(undoBtn.dataset.orderUndo); return; }
  const paidBtn = event.target.closest("[data-order-confirm-paid]");
  if (paidBtn) {
    const order = studioOrders.find((item) => item.id === paidBtn.dataset.orderConfirmPaid);
    if (!order) return;
    order.paymentStatus = "已支付";
    logOrderEvent(order, "订单已确认收款，金额锁定", currentAccount.role || "员工");
    saveStudioState();
    renderOrderCenter();
    showToast(`订单 ${order.id} 已更新为已支付。`, "success");
    return;
  }
  const pinBtn = event.target.closest("[data-order-pin]");
  if (pinBtn) {
    const order = studioOrders.find((item) => item.id === pinBtn.dataset.orderPin);
    if (!order) return;
    order.pinned = !order.pinned;
    saveStudioState();
    renderOrderCenter();
    showToast(order.pinned ? "订单已置顶。" : "已取消置顶。", "success");
    return;
  }
  const customerBtn = event.target.closest("[data-order-customer]");
  if (customerBtn) { openOrderCustomerProfile(customerBtn.dataset.orderCustomer); return; }
  const patternsBtn = event.target.closest("[data-order-patterns]");
  if (patternsBtn) { openOrderPatterns(patternsBtn.dataset.orderPatterns); return; }
  const packageBtn = event.target.closest("[data-order-package]");
  if (packageBtn) {
    downloadOrderPackage(packageBtn.dataset.orderPackage, packageBtn);
    return;
  }
  const patternRemove = event.target.closest("[data-order-pattern-remove]");
  if (patternRemove) {
    event.stopPropagation();
    const { orderId, file } = parseOrderPatternControl(patternRemove.dataset.orderPatternRemove);
    removeOrderPattern(orderId, file);
    return;
  }
  const patternBtn = event.target.closest("[data-order-pattern]");
  if (patternBtn) {
    event.stopPropagation();
    const order = studioOrders.find((item) => item.id === patternBtn.dataset.orderId);
    if (orderPatternList(order || {}).length > 4 && patternBtn.closest(".order-work-card")?.classList.contains("has-more")) {
      openOrderPatterns(patternBtn.dataset.orderId);
      return;
    }
    const card = sourceCardByFile(patternBtn.dataset.orderPattern);
    if (card) openLightbox(card, { worksLibrary: true });
    return;
  }

  const deliverBtn = event.target.closest("[data-order-toggle-deliver]");
  if (deliverBtn) {
    const order = studioOrders.find((o) => o.id === deliverBtn.dataset.orderToggleDeliver);
    if (order) {
      order.deliverStatus = orderDeliverStatus(order) === "已交付" ? "未交付" : "已交付";
      logOrderEvent(order, `订单已标记为${order.deliverStatus}`, currentAccount.role || "员工");
      saveStudioState();
      renderOrderCenter();
      showToast(`订单 ${order.id} 已标记为${order.deliverStatus}。`, "success");
    }
    return;
  }
  const closeButton = event.target.closest("[data-close-order]");
  if (closeButton) {
    closeOrder(closeButton.dataset.closeOrder);
    return;
  }
  const statusButton = event.target.closest("[data-order-status]");
  if (statusButton) {
    advanceOrderStatus(statusButton.dataset.orderStatus);
    return;
  }
  const addTagButton = event.target.closest("[data-order-add-tag]");
  if (addTagButton) {
    addOrderTag(addTagButton.dataset.orderAddTag);
    return;
  }
  const fileButton = event.target.closest("[data-order-file]");
  if (!fileButton) return;
  const card = sourceCardByFile(fileButton.dataset.orderFile);
  if (card) {
    activeOrderFileContext = { orderId: fileButton.dataset.orderId, file: fileButton.dataset.orderFile };
    openLightbox(card);
  }
});
orderList.addEventListener("input", (event) => {
  const input = event.target.closest("[data-order-customer-input]");
  if (input) renderOrderCustomerResults(input);
});
orderList.addEventListener("focusin", (event) => {
  const input = event.target.closest("[data-order-customer-input]");
  if (input) renderOrderCustomerResults(input);
});
orderList.addEventListener("change", (event) => {
  const input = event.target.closest("[data-order-customer-input]");
  if (!input) return;
  const order = studioOrders.find((item) => item.id === input.dataset.orderCustomerInput);
  saveOrderCustomerText(order, input.value);
});
orderList.addEventListener("keydown", (event) => {
  const input = event.target.closest("[data-order-customer-input]");
  if (!input || event.key !== "Enter") return;
  event.preventDefault();
  const order = studioOrders.find((item) => item.id === input.dataset.orderCustomerInput);
  const exact = orderCustomerMatches(input.value).find((client) => normalizeSearch(customerCombinedName(client)) === normalizeSearch(input.value));
  if (exact) bindOrderCustomer(order, exact);
  else saveOrderCustomerText(order, input.value);
});
document.addEventListener("click", (event) => {
  if (event.target.closest(".oc-order-customer-combo")) return;
  orderList?.querySelectorAll(".oc-order-customer-results").forEach((panel) => panel.classList.add("hidden"));
});
orderManageToggle?.addEventListener("click", toggleOrderManageMode);
orderManageSelectAll?.addEventListener("click", () => {
  const ids = orderTableFiltered().map((order) => order.id);
  if (ids.length && ids.every((id) => orderManageSelection.has(id))) orderManageSelection.clear();
  else ids.forEach((id) => orderManageSelection.add(id));
  renderOrderCenter();
});
orderManageDelete?.addEventListener("click", deleteSelectedOrders);
orderManagePin?.addEventListener("click", pinSelectedOrders);
orderList.addEventListener("keydown", (event) => {
  const input = event.target.closest("[data-order-price-input], [data-order-pattern-price]");
  if (!input) return;
  if (event.key === "Enter") {
    event.preventDefault();
    input.blur();
  }
});
orderList.addEventListener("focusout", (event) => {
  const input = event.target.closest("[data-order-price-input]");
  if (input) {
    saveOrderPriceInput(input);
    return;
  }
  const patternPriceInput = event.target.closest("[data-order-pattern-price]");
  if (patternPriceInput) saveOrderPatternPriceInput(patternPriceInput);
});
document.querySelector("#orderPatternModal")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-order-pattern-close]")) { closeOrderPatterns(); return; }
  const item = event.target.closest("[data-modal-order-file]");
  if (!item) return;
  const card = sourceCardByFile(item.dataset.modalOrderFile);
  if (card) openLightbox(card, { nested: true, worksLibrary: true });
});
orderList.addEventListener("change", (event) => {
  const input = event.target.closest("[data-order-date]");
  if (!input) return;
  const order = studioOrders.find((item) => item.id === input.dataset.orderDate);
  if (!order) return;
  order.deliveryAt = input.value;
  saveStudioState();
  renderOrderCenter();
  showToast(`${order.id} 的交期已更新。`, "success");
});
libraryCartList.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-cart-remove]");
  if (remove) {
    const file = remove.dataset.cartRemove;
    libraryCart.delete(file);
    renderLibraryCart();
    if (viewerLibraryModeActive()) renderLibraryGrid();
    syncVlibGalleryAfterCartChange(file);
    return;
  }
  const item = event.target.closest(".cart-item");
  const card = item ? sourceCardByFile(item.dataset.cartFile) : null;
  if (card) openLightbox(card);
});
addToCartFromLightbox.addEventListener("click", () => {
  const card = activeLightboxCards()[activePreviewIndex];
  addLibraryCart(card?.dataset.file);
});
sourceFileDownloadList?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-source-file-remove]");
  if (removeButton) {
    if (!sourceFileTargetCard || !canEditWorkMetadata(sourceFileTargetCard)) return;
    const index = Number(removeButton.dataset.sourceFileRemove);
    const files = getSourceFiles(sourceFileTargetCard);
    const sourceFile = files[index];
    if (!sourceFile || !window.confirm(`确认删除源文件「${sourceFile.name || `源文件 ${index + 1}`}」？`)) return;
    files.splice(index, 1);
    sourceFileTargetCard.dataset.sourceFiles = JSON.stringify(files);
    const first = files[0];
    sourceFileTargetCard.dataset.sourceFileName = first?.name || "";
    sourceFileTargetCard.dataset.sourceFileKey = first?.key || "";
    sourceFileTargetCard.dataset.sourceFileType = first?.type || "";
    if (sourceFile.key) window.KingBlobStore?.remove(sourceFile.key).catch((error) => console.warn("源文件存储清理失败。", error));
    markWorkRecordDirty(sourceFileTargetCard);
    saveStudioState();
    renderLightbox();
    showToast("源文件已删除。", "success");
    return;
  }
  const addButton = event.target.closest("[data-source-file-add]");
  if (addButton) {
    if (!sourceFileTargetCard || !canEditWorkMetadata(sourceFileTargetCard)) return;
    sourceFileInput.value = "";
    sourceFileInput.click();
    return;
  }
  const button = event.target.closest("[data-source-file-index]");
  if (!button || !sourceFileTargetCard) return;
  const sourceFile = getSourceFiles(sourceFileTargetCard)[Number(button.dataset.sourceFileIndex)];
  if (!sourceFile?.key) return;
  getImageFromDB(sourceFile.key).then((dataUrl) => {
    if (!dataUrl) {
      showToast("源文件暂时无法读取。", "error");
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = sourceFile.name || `${sourceFileTargetCard.dataset.file}-源文件`;
    link.click();
    showToast(`${sourceFile.name || "源文件"} 下载已开始。`, "success");
  });
});

async function appendSourceFiles(card, files) {
  if (!card) return;
  const existing = getSourceFiles(card);
  const incoming = [...files].slice(0, Math.max(0, MAX_UPLOAD_FILES - existing.length));
  if (!incoming.length) {
    showToast("源文件已达到最大数量。", "warning");
    return;
  }
  for (let index = 0; index < incoming.length; index += 1) {
    const file = incoming[index];
    const key = normalizeStudioAssetBaseKey(`${card.dataset.file}__source_${existing.length + index + 1}_${Date.now()}`, 230);
    await saveImageToDB(key, file);
    existing.push({ name: file.name, key, type: file.type || "application/octet-stream", size: file.size || 0 });
  }
  card.dataset.sourceFiles = JSON.stringify(existing);
  const first = existing[0];
  card.dataset.sourceFileName = first?.name || "";
  card.dataset.sourceFileKey = first?.key || "";
  card.dataset.sourceFileType = first?.type || "";
  markWorkRecordDirty(card);
  saveStudioState();
  renderLightbox();
  showToast(`已添加 ${incoming.length} 个源文件。`, "success");
}

sourceFileInput?.addEventListener("change", async () => {
  if (!sourceFileTargetCard || !sourceFileInput.files.length) return;
  try {
    await appendSourceFiles(sourceFileTargetCard, sourceFileInput.files);
  } catch (error) {
    console.error(error);
    showToast("源文件上传失败，请重新选择。", "error");
  } finally {
    sourceFileInput.value = "";
  }
});
sourceDownloadAll?.addEventListener("click", async () => {
  if (!sourceFileTargetCard) return;
  const files = getSourceFiles(sourceFileTargetCard);
  for (const file of files) {
    await downloadStoredFile(file.key, file.name || `${sourceFileTargetCard.dataset.file}-源文件`);
  }
  if (files.length) showToast(`${files.length} 个源文件已开始下载。`, "success");
});
orderFileUploadButton?.addEventListener("click", () => {
  const order = activeOrder();
  const file = activeOrderFileContext?.file;
  const linkedFolder = order?.fileLinks?.[file];
  if (linkedFolder) {
    showToast(`交付文件夹：${linkedFolder}`, "success");
    return;
  }
  orderFileLinkInput.value = "";
  orderFileLinkInput.click();
});
orderFileLinkInput?.addEventListener("change", () => {
  attachOrderFileLink(orderFileLinkInput.files);
  orderFileLinkInput.value = "";
});
orderFileStateButton?.addEventListener("click", toggleOrderFileState);
referenceMaterialList.addEventListener("click", (event) => {
  const painterLink = event.target.closest("[data-linked-painter-file]");
  if (painterLink) {
    const file = painterLink.dataset.linkedPainterFile;
    closeLightbox();
    switchView("designer");
    const painterCard = sourceCardByFile(file);
    if (painterCard) {
      painterCard.scrollIntoView({ behavior: "smooth", block: "center" });
      painterCard.classList.add("search-match-focus");
      setTimeout(() => painterCard.classList.remove("search-match-focus"), 1400);
    }
    return;
  }
  const referenceRemove = event.target.closest("[data-reference-remove]");
  if (referenceRemove) {
    const card = activeLightboxCards()[activePreviewIndex];
    if (!card || !canEditWorkMetadata(card)) return;
    const keys = getReferenceKeys(card);
    keys.splice(Number(referenceRemove.dataset.referenceRemove), 1);
    card.dataset.referenceKeys = JSON.stringify(keys);
    updateCardReferenceMaterial(card, keys.length ? `参考图 ${keys.length} 张` : "未提供参考图");
    markWorkRecordDirty(card);
    saveStudioState();
    renderReferenceMaterials(card);
    showToast("已删除该参考图。", "success");
    return;
  }
  const referencePreview = event.target.closest("[data-reference-key]");
  if (referencePreview) {
    const card = activeLightboxCards()[activePreviewIndex];
    const referenceIndex = getReferenceKeys(card).indexOf(referencePreview.dataset.referenceKey);
    markReviewMediaViewed(card, "reference", Math.max(0, referenceIndex));
    getImageFromDB(referencePreview.dataset.referenceKey).then((imageData) => {
      if (!imageData) {
        showToast("参考图暂时无法读取。", "error");
        return;
      }
      referenceZoomImage.src = imageData;
      referenceZoomOverlay.classList.add("active");
      referenceZoomOverlay.setAttribute("aria-hidden", "false");
    });
    return;
  }
  const addButton = event.target.closest(".add-reference-button");
  if (!addButton) return;
  addReferenceTargetCard = activeLightboxCards()[activePreviewIndex];
  if (!addReferenceTargetCard || !canEditWorkMetadata(addReferenceTargetCard)) return;
  addReferenceInput.value = "";
  addReferenceInput.click();
});
function closeReferenceZoom() {
  referenceZoomOverlay.classList.remove("active");
  referenceZoomOverlay.setAttribute("aria-hidden", "true");
  referenceZoomImage.removeAttribute("src");
}
referenceZoomClose.addEventListener("click", closeReferenceZoom);
referenceZoomOverlay.addEventListener("click", (event) => {
  if (event.target === referenceZoomOverlay) closeReferenceZoom();
});
addReferenceInput.addEventListener("change", async () => {
  if (!addReferenceInput.files.length) return;
  try {
    await appendReferenceFiles(addReferenceTargetCard, addReferenceInput.files);
  } catch (error) {
    console.error(error);
    showToast("参考图添加失败，请重新选择图片。", "error");
  } finally {
    addReferenceInput.value = "";
    addReferenceTargetCard = null;
  }
});
document.querySelectorAll(".open-upload").forEach((button) => {
  button.addEventListener("click", () => openUploadModal());
});
worksUploadButton?.addEventListener("click", () => openUploadModal());
chooseFiles.addEventListener("click", () => {
  pendingUploadPurpose = "";
  artworkFiles.click();
});
chooseSourceFile.addEventListener("click", () => artworkSourceFile.click());
choosePaletteFiles.addEventListener("click", () => artworkPaletteFiles.click());
artworkPaletteFiles.addEventListener("change", () => {
  const incomingFiles = [...(artworkPaletteFiles.files || [])];
  const supportedFiles = acceptedUploadFiles(incomingFiles.filter(isSupportedPaletteFile), {
    label: "配色",
    maxBytes: MAX_IMAGE_FILE_BYTES,
    extensions: SUPPORTED_IMAGE_EXTENSIONS,
  });
  if (supportedFiles.length !== incomingFiles.length) showToast("配色仅支持 TIFF、PCX、PSD、PSB、AI、EPS、JPEG、JPG、JEPG、PNG、ENC 文件。", "warning");
  const mergedFiles = mergeUniqueFiles(selectedPaletteFiles, supportedFiles);
  if (mergedFiles.length > MAX_UPLOAD_FILES) showToast("超过最大上传数量", "warning");
  selectedPaletteFiles = mergedFiles.slice(0, MAX_UPLOAD_FILES);
  artworkPaletteFiles.value = "";
  renderPaletteUploadFiles();
});
paletteUploadReadout.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-palette-file]");
  if (!removeButton) return;
  selectedPaletteFiles.splice(Number(removeButton.dataset.removePaletteFile), 1);
  renderPaletteUploadFiles();
});
artworkSourceFile.addEventListener("change", () => {
  const incomingFiles = acceptedUploadFiles(artworkSourceFile.files, {
    label: "源文件",
    maxBytes: MAX_SOURCE_FILE_BYTES,
    extensions: [...SUPPORTED_IMAGE_EXTENSIONS, ...SUPPORTED_DOCUMENT_EXTENSIONS, "ps"],
  });
  const mergedFiles = mergeUniqueFiles(selectedSourceFiles, incomingFiles);
  if (mergedFiles.length > MAX_UPLOAD_FILES) showToast("超过最大上传数量", "warning");
  selectedSourceFiles = mergedFiles.slice(0, MAX_UPLOAD_FILES);
  artworkSourceFile.value = "";
  renderSourceUploadFiles();
});
sourceUploadReadout.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-source-file]");
  if (!removeButton) return;
  selectedSourceFiles.splice(Number(removeButton.dataset.removeSourceFile), 1);
  renderSourceUploadFiles();
});
fileReadout.addEventListener("click", (event) => {
  const slot = event.target.closest("[data-upload-slot-add]");
  if (!slot) return;
  pendingUploadPurpose = slot.dataset.uploadSlotDefault || `补充图 ${selectedUploadFiles.length + 1}`;
  artworkFiles.click();
});
artworkFiles.addEventListener("change", () => {
  if (!artworkFiles.files.length) return;
  clearUploadValidation();
  const incomingFiles = acceptedUploadFiles(artworkFiles.files, {
    label: "作品图片",
    maxBytes: MAX_IMAGE_FILE_BYTES,
    imageOnly: true,
    extensions: SUPPORTED_IMAGE_EXTENSIONS,
    maxCount: Number.POSITIVE_INFINITY,
  });
  incomingFiles.forEach((file) => {
    if (!uploadFileNames.has(fileIdentity(file))) uploadFileNames.set(fileIdentity(file), file.name);
  });
  const existingIdentities = new Set(selectedUploadFiles.map(fileIdentity));
  const newFiles = incomingFiles.filter((file) => !existingIdentities.has(fileIdentity(file)));
  const mergedFiles = mergeUniqueFiles(selectedUploadFiles, incomingFiles);
  selectedUploadFiles = mergedFiles;
  if (uploadWorkName && !uploadWorkName.value.trim() && mergedFiles[0]) {
    uploadWorkName.value = fileBaseName(mergedFiles[0].name);
  }
  selectedUploadFiles.forEach((file, index) => {
    if (!uploadFilePurposes.has(fileIdentity(file))) {
      uploadFilePurposes.set(fileIdentity(file), DEFAULT_UPLOAD_PURPOSES[index] || `补充图 ${index + 1}`);
    }
  });
  if (pendingUploadPurpose && newFiles[0]) {
    uploadFilePurposes.set(fileIdentity(newFiles[0]), pendingUploadPurpose);
  }
  pendingUploadPurpose = "";
  artworkFiles.value = "";
  renderSelectedFiles();
});
chooseReferenceFiles.addEventListener("click", () => referenceFiles.click());
referenceFiles.addEventListener("change", () => {
  if (!referenceFiles.files.length) return;
  clearUploadValidation();
  const incomingFiles = acceptedUploadFiles(referenceFiles.files, {
    label: "参考图",
    maxBytes: MAX_IMAGE_FILE_BYTES,
    imageOnly: true,
    extensions: SUPPORTED_IMAGE_EXTENSIONS,
  });
  incomingFiles.forEach((file) => {
    if (!referenceFileNames.has(fileIdentity(file))) referenceFileNames.set(fileIdentity(file), file.name);
  });
  const mergedFiles = mergeUniqueFiles(selectedReferenceFiles, incomingFiles);
  if (mergedFiles.length > MAX_UPLOAD_FILES) showToast("超过最大上传数量", "warning");
  selectedReferenceFiles = mergedFiles.slice(0, MAX_UPLOAD_FILES);
  referenceFiles.value = "";
  if (selectedReferenceFiles.length) {
    originalDeclaration.checked = false;
  }
  renderReferenceFiles();
});
fileReadout.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-upload]");
  const editButton = event.target.closest("[data-edit-upload-name]");
  if (removeButton) {
    const [removedFile] = selectedUploadFiles.splice(Number(removeButton.dataset.removeUpload), 1);
    if (removedFile) {
      uploadFileNames.delete(fileIdentity(removedFile));
      uploadFilePurposes.delete(fileIdentity(removedFile));
    }
    renderSelectedFiles();
  }
  if (editButton) beginUploadNameEdit(editButton);
});
fileReadout.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-upload-drag-index]");
  if (!card) return;
  draggedUploadIndex = Number(card.dataset.uploadDragIndex);
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});
fileReadout.addEventListener("dragover", (event) => {
  const card = event.target.closest("[data-upload-drag-index]");
  if (!card || draggedUploadIndex < 0) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  fileReadout.querySelectorAll(".drag-over").forEach((item) => item.classList.remove("drag-over"));
  card.classList.add("drag-over");
});
fileReadout.addEventListener("drop", (event) => {
  const card = event.target.closest("[data-upload-drag-index]");
  if (!card || draggedUploadIndex < 0) return;
  event.preventDefault();
  const targetIndex = Number(card.dataset.uploadDragIndex);
  const sourceFile = selectedUploadFiles[draggedUploadIndex];
  const targetFile = selectedUploadFiles[targetIndex];
  if (sourceFile && targetFile && sourceFile !== targetFile) {
    const sourcePurpose = uploadPurpose(sourceFile, draggedUploadIndex);
    const targetPurpose = uploadPurpose(targetFile, targetIndex);
    uploadFilePurposes.set(fileIdentity(sourceFile), targetPurpose);
    uploadFilePurposes.set(fileIdentity(targetFile), sourcePurpose);
  }
  draggedUploadIndex = -1;
  renderSelectedFiles();
});
fileReadout.addEventListener("dragend", () => {
  draggedUploadIndex = -1;
  fileReadout.querySelectorAll(".dragging, .drag-over").forEach((item) => item.classList.remove("dragging", "drag-over"));
});
referenceReadout.addEventListener("click", (event) => {
  if (event.target.closest("[data-empty-reference]")) referenceFiles.click();
});
referenceReadout.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-reference]");
  const editButton = event.target.closest("[data-edit-reference-name]");
  if (removeButton) {
    const [removedFile] = selectedReferenceFiles.splice(Number(removeButton.dataset.removeReference), 1);
    if (removedFile) referenceFileNames.delete(fileIdentity(removedFile));
    renderReferenceFiles();
  }
  if (editButton) beginReferenceNameEdit(editButton);
});
originalDeclaration.addEventListener("change", () => {
  clearUploadValidation();
  if (!originalDeclaration.checked) {
    renderReferenceFiles();
    return;
  }
  selectedReferenceFiles = [];
  referenceFileNames.clear();
  referenceFiles.value = "";
  chooseReferenceFiles.classList.add("hidden");
  referenceReadout.innerHTML = `<p class="original-state">已选择原创声明，不需要上传参考图。</p>`;
});
openPainterPicker.addEventListener("click", openPainterPickerModal);
painterPickerClose.addEventListener("click", closePainterPickerModal);
painterPickerCancel.addEventListener("click", closePainterPickerModal);
painterPickerConfirm.addEventListener("click", () => {
  const handler = painterPickerConfirmHandler;
  if (handler) {
    handler([...draftPainterSelection]);
  } else {
    selectedPainterWorks = [...draftPainterSelection];
    updateLinkedPainterSummary();
  }
  closePainterPickerModal();
});
painterPickerModal?.addEventListener("click", (event) => {
  if (event.target === painterPickerModal) {
    closePainterPickerModal();
  }
});
let painterPickerTimer = null;

painterFilter.addEventListener("change", renderPainterPicker);
painterSelectAll.addEventListener("click", () => {
  const query = painterPickerSearch.value.trim().toLowerCase();
  const painter = painterFilter.value;
  const visibleItems = painterWorkCatalog().filter((item) => {
    const indexText = `${item.file} ${item.painter} ${item.project} ${item.tags.join(" ")}`.toLowerCase();
    return (painter === "all" || item.painter === painter) && (!query || searchMatches(query, [indexText]));
  });
  const allSelected = visibleItems.every((item) => draftPainterSelection.some((selected) => selected.file === item.file));
  draftPainterSelection = allSelected
    ? draftPainterSelection.filter((selected) => !visibleItems.some((item) => item.file === selected.file))
    : [...draftPainterSelection, ...visibleItems.filter((item) => !draftPainterSelection.some((selected) => selected.file === item.file))];
  painterSelectAll.textContent = allSelected ? "全选" : "取消全选";
  renderPainterPicker();
});
painterPickerSearch.addEventListener("input", () => {
  clearTimeout(painterPickerTimer);
  painterPickerTimer = setTimeout(renderPainterPicker, 200);
});
painterPickerGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".painter-pick-card");
  if (!card) return;
  const item = painterWorkCatalog().find((entry) => entry.file === card.dataset.file);
  if (!item) return;
  const alreadySelected = draftPainterSelection.some((entry) => entry.file === item.file);
  draftPainterSelection = alreadySelected
    ? draftPainterSelection.filter((entry) => entry.file !== item.file)
    : [...draftPainterSelection, item];
  renderPainterPicker();
});
projectSearch?.addEventListener("focus", () => renderProjectResults(projectSearch?.value));
projectSearch?.addEventListener("click", () => renderProjectResults(projectSearch?.value));
projectSearch?.addEventListener("input", () => {
  clearTimeout(projectSearchTimer);
  projectSearchTimer = setTimeout(() => renderProjectResults(projectSearch?.value), 200);
});
projectResults?.addEventListener("click", (event) => {
  const createButton = event.target.closest("[data-create-linked-project]");
  if (createButton) {
    if (!canCreateProject()) {
      showToast("只有管理员可以新建项目，请选择已有项目。", "warning");
      return;
    }
    const name = createButton.dataset.createLinkedProject.trim();
    if (!name) {
      projectSearch.placeholder = "先输入新项目名称";
      projectSearch?.focus();
      return;
    }
    const now = formatDateTime();
    const project = {
      id: `PJ-${Date.now()}`,
      name,
      customer: "非客户项目",
      type: "内部",
      status: "需求确认",
      stage: "需求确认",
      projectStatus: "normal",
      files: [],
      designers: currentAccount.role === "设计师" ? [currentAccount.name] : [],
      painters: currentAccount.role === "手绘师" ? [currentAccount.name] : [],
      owners: currentAccount.name ? [currentAccount.name] : [],
      owner: currentAccount.name || "待分配",
      members: currentAccount.name || "待分配",
      startAt: "",
      endAt: "",
      note: "",
      logs: [],
      createdAt: now,
      createdBy: currentAccountDisplayName() || currentAccount.name || "",
      uploads: [],
      deliveryStatus: "pending",
      deliveryFiles: [],
    };
    normalizeProjectLifecycleProject(project);
    customProjects.unshift(project);
    syncProjectLibrary();
    const created = projectLibrary.find((item) => item.name === name);
    if (created) selectedProjects.push(created);
    if (projectSearch) projectSearch.value = "";
    saveStudioState();
    renderLinkedProjects();
    renderProjectResults("");
    showToast(`项目“${name}”已新建并关联。`, "success");
    return;
  }
  const option = event.target.closest(".project-option");
  if (!option) return;
  const project = projectLibrary.find((item) => item.name === option.dataset.project);
  if (!project) return;
  const exists = selectedProjects.some((item) => item.name === project.name);
  selectedProjects = exists ? selectedProjects.filter((item) => item.name !== project.name) : [...selectedProjects, project];
  if (projectSearch) projectSearch.value = "";
  renderLinkedProjects();
  renderProjectResults("");
});
linkedProjectList?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-project]");
  const primaryButton = event.target.closest("[data-make-primary]");
  if (removeButton) selectedProjects = selectedProjects.filter((item) => item.name !== removeButton.dataset.removeProject);
  if (primaryButton) {
    const index = selectedProjects.findIndex((item) => item.name === primaryButton.dataset.makePrimary);
    if (index > 0) selectedProjects.unshift(...selectedProjects.splice(index, 1));
  }
  if (!removeButton && !primaryButton) return;
  renderLinkedProjects();
  renderProjectResults(projectSearch?.value);
});
clearLinkedProjects?.addEventListener("click", () => {
  selectedProjects = [];
  renderLinkedProjects();
  renderProjectResults(projectSearch?.value);
});
clearProjectSearch?.addEventListener("click", () => {
  projectSearch?.focus();
});
addLinkedProject?.addEventListener("click", () => {
  if (projectSearch) projectSearch.value = "";
  renderProjectResults("");
  projectSearch?.focus();
});
linkedPainterList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-painter]");
  if (!removeButton) return;
  selectedPainterWorks = selectedPainterWorks.filter((item) => item.file !== removeButton.dataset.removePainter);
  updateLinkedPainterSummary();
});
uploadClose.addEventListener("click", requestCloseUploadModal);
uploadCancel.addEventListener("click", requestCloseUploadModal);
uploadModal.addEventListener("click", (event) => {
  if (event.target === uploadModal) {
    requestCloseUploadModal();
  }
});
uploadTagOptions.addEventListener("click", (event) => {
  const option = event.target.closest(".tag-option");
  if (!option) return;
  const tag = option.dataset.tag;
  if (selectedUploadTags.includes(tag)) {
    selectedUploadTags = selectedUploadTags.filter((item) => item !== tag);
  } else if (selectedUploadTags.length < 6) {
    selectedUploadTags.push(tag);
  }
  renderUploadTags();
});
addTagButton?.addEventListener("click", () => {
  const tag = newTagInput.value.trim();
  if (!tag) return;
  if (!globalTags.includes(tag) && !pendingTagApplications.includes(tag)) pendingTagApplications.push(tag);
  const canSelect = selectedUploadTags.includes(tag) || selectedUploadTags.length < 6;
  if (canSelect && !selectedUploadTags.includes(tag)) {
    selectedUploadTags.push(tag);
  }
  if (newTagInput) newTagInput.value = "";
  renderUploadTags();
  saveStudioState();
  showToast(canSelect ? "新标签已提交审批，并用于本次作品；审批前不会进入公共标签库。" : "新标签已提交审批；当前已选满 6 个标签。", canSelect ? "success" : "warning");
});
clearUploadTags.addEventListener("click", () => {
  selectedUploadTags = [];
  renderUploadTags();
});

function clearUploadValidation() {
  uploadModal.querySelectorAll(".upload-field-invalid").forEach((section) => section.classList.remove("upload-field-invalid"));
  uploadModal.querySelectorAll(".upload-field-warning").forEach((warning) => warning.remove());
  uploadValidationSummary.classList.add("hidden");
  uploadValidationTarget = null;
}

function showUploadValidation(errors) {
  clearUploadValidation();
  errors.forEach(({ selector, message }) => {
    const section = uploadModal.querySelector(selector);
    if (!section) return;
    section.classList.add("upload-field-invalid");
    section.insertAdjacentHTML("beforeend", `<p class="upload-field-warning">${escapeHtml(message)}</p>`);
  });
  uploadValidationTarget = errors[0]?.selector || null;
  uploadValidationSummary.querySelector("span").textContent = errors.map((item) => item.short).join("；");
  uploadValidationSummary.classList.toggle("hidden", !errors.length);
}

uploadValidationSummary.addEventListener("click", () => {
  if (!uploadValidationTarget) return;
  uploadModal.querySelector(uploadValidationTarget)?.scrollIntoView({ behavior: "smooth", block: "center" });
});

uploadConfirm.addEventListener("click", async () => {
  const editTarget = uploadEditTargetCard;
  if (!editTarget) uploadWorkType = currentAccount.role === "手绘师" ? "手绘师" : "设计师";
  if (uploadWorkType === "手绘师") {
    selectedPaletteFiles = [];
    selectedPainterWorks = [];
    draftPainterSelection = [];
  }
  const validationErrors = [];
  const workName = uploadWorkName?.value.trim() || "";
  if (!workName) validationErrors.push({ selector: ".upload-name-field", short: "缺少作品名称", message: "请输入作品名称。" });
  if (!selectedUploadFiles.length) validationErrors.push({ selector: ".asset-upload-section", short: "缺少作品图片", message: "请至少添加 1 张作品图片。" });
  if (uploadWorkType !== "手绘师" && !selectedReferenceFiles.length && !originalDeclaration.checked) validationErrors.push({ selector: ".reference-panel", short: "缺少参考声明", message: "请添加参考图；如为原创作品，请勾选原创声明。" });
  if (validationErrors.length) {
    showUploadValidation(validationErrors);
    return;
  }
  clearUploadValidation();

  if (window.kingNas?.diagnostics) {
    const storageStatus = await window.kingNas.diagnostics().catch((error) => ({ ok: false, error: error?.message }));
    if (!storageStatus?.ok) {
      showToast(`NAS 存储不可写：${storageStatus?.error || "请检查连接和文件夹权限。"}`, "error");
      return;
    }
  }

  const count = 1 + selectedPaletteFiles.length;
  const painterText = selectedPainterWorks.length ? ` / 手绘 ${selectedPainterWorks.length} 幅` : "";
  const uploadProjectId = document.querySelector("#uploadProjectSelect")?.value || "";
  const uploadProject = pjById(uploadProjectId);
  const projectText = uploadProject ? ` / 关联项目「${uploadProject.name}」` : "";
  const referenceText = selectedReferenceFiles.length
    ? `参考图 ${selectedReferenceFiles.length} 张`
    : originalDeclaration.checked
      ? "原创声明"
      : "未提供参考图";

  uploadConfirm.textContent = "上传中…";
  uploadConfirm.disabled = true;

  try {
    const files = selectedUploadFiles.filter(isImageUploadFile);
    if (!files.length) {
      throw new Error("No image files selected");
    }
    const mainFile = files.find((file, index) => uploadPurpose(file, selectedUploadFiles.indexOf(file)) === "主图") || files[0];
    const baseName = fileBaseName(uploadDisplayName(mainFile));
    const linkedPainterText = selectedPainterWorks.length
      ? selectedPainterWorks.map((item) => `${item.painter} / ${item.file}`).join("、")
      : editTarget
        ? fieldValue(editTarget, "引用手绘") || "无引用 / 原创设计"
        : "无引用 / 原创设计";
    const linkedSketchFiles = selectedPainterWorks.length
      ? selectedPainterWorks.map((item) => item.file)
      : editTarget
        ? getLinkedSketches(editTarget)
        : [];
    const role = editTarget?.dataset.workRole || uploadWorkType;
    const owner = editTarget?.dataset.workOwner || currentAccount.ownerKey;
    const nowText = formatDateTime();
    const editReviewSummary = editTarget ? fieldValue(editTarget, "审核状态") : "";
    const editReviewState = editTarget?.dataset.reviewState || (
      editReviewSummary.includes("已通过") ? "approved"
        : editReviewSummary.includes("需修改") ? "revision"
          : "pending"
    );
    const isRevisionResubmission = Boolean(editTarget && editReviewState === "revision" && currentAccount.role !== "管理员");
    const suffix = !editTarget && [...document.querySelectorAll("[data-file]")].some((item) => item.dataset.file === baseName)
      ? `-${Date.now().toString().slice(-4)}`
      : "";
    const fileId = editTarget?.dataset.file || `${baseName}${suffix}`;
    const uploadStartedAt = Date.now();
    const storageFileId = normalizeStudioAssetBaseKey(fileId);
    const uploadPlans = [
      ...files.map((file, imageIndex) => ({
        kind: "work",
        file,
        index: imageIndex,
        baseKey: file === mainFile ? storageFileId : `${storageFileId}__view_${imageIndex + 1}_${uploadStartedAt}`,
      })),
      ...selectedPaletteFiles.map((file, paletteIndex) => ({
        kind: "palette",
        file,
        index: paletteIndex,
        baseKey: `${storageFileId}__color_${paletteIndex + 2}_${uploadStartedAt}`,
      })),
      ...selectedReferenceFiles.filter(isImageUploadFile).map((file, refIndex) => ({
        kind: "reference",
        file,
        index: refIndex,
        key: normalizeStudioAssetBaseKey(`${storageFileId}__reference_${refIndex + 1}_${uploadStartedAt}`, 230),
      })),
      ...selectedSourceFiles.map((file, sourceIndex) => ({
        kind: "source",
        file,
        index: sourceIndex,
        key: normalizeStudioAssetBaseKey(`${storageFileId}__source_${sourceIndex + 1}_${uploadStartedAt}`, 230),
      })),
    ];
    const uploadProgress = createUploadProgressTracker(uploadPlans);
    showAppLoading(`正在上传 ${uploadPlans.length} 个文件`, { progress: true });
    setAppLoadingProgress(2, `准备上传 · 0/${uploadPlans.length}`);
    await waitForUiPaint();
    const largestUploadBytes = Math.max(...uploadPlans.map((plan) => Number(plan.file?.size || 0)), 0);
    const uploadConcurrency = largestUploadBytes >= 30 * 1024 * 1024 ? 1 : largestUploadBytes >= 10 * 1024 * 1024 ? 2 : 3;
    const uploadedFiles = await mapWithConcurrency(uploadPlans, uploadConcurrency, async (plan, planIndex) => {
      const updateProgress = (loaded, total) => uploadProgress.update(
        planIndex,
        total > 0 ? loaded / total : 0,
        uploadDisplayName(plan.file),
      );
      try {
        let uploaded;
        if (plan.kind === "work" || plan.kind === "palette") {
          uploaded = { ...plan, tiers: await persistArtworkImageTiers(plan.baseKey, plan.file, { onProgress: updateProgress }) };
        } else {
          await saveImageToDB(plan.key, plan.file, { onProgress: updateProgress });
          uploaded = plan;
        }
        uploadProgress.complete(planIndex, uploadDisplayName(plan.file));
        return uploaded;
      } catch (error) {
        if (error && typeof error === "object") error.uploadFileName ||= uploadDisplayName(plan.file);
        throw error;
      }
    });
    setAppLoadingProgress(94, "正在生成预览并整理稿件信息…");
    const workUploads = uploadedFiles.filter((item) => item.kind === "work");
    const mainTiers = workUploads.find((item) => item.file === mainFile)?.tiers;
    if (!mainTiers) throw new Error("Main artwork upload missing");
    const imageData = await resolveImageSource(mainTiers.thumbKey);
    const workImages = workUploads.map(({ file: workImage, tiers }) => ({
      name: uploadDisplayName(workImage),
      purpose: uploadPurpose(workImage, selectedUploadFiles.indexOf(workImage)),
      thumbKey: tiers.thumbKey,
      previewKey: tiers.previewKey,
      originalKey: tiers.originalKey,
      type: workImage.type || "image/jpeg",
      primary: workImage === mainFile,
    }));
    const paletteKeys = [mainTiers.previewKey];
    const paletteThumbKeys = [mainTiers.thumbKey];
    const paletteFileEntries = [{ name: mainFile.name, key: mainTiers.originalKey, type: mainFile.type || "image/jpeg", primary: true }];
    uploadedFiles.filter((item) => item.kind === "palette").forEach(({ file: paletteFile, tiers }) => {
      paletteKeys.push(tiers.previewKey);
      paletteThumbKeys.push(tiers.thumbKey);
      paletteFileEntries.push({ name: paletteFile.name, key: tiers.originalKey, type: paletteFile.type || "application/octet-stream", primary: false });
    });
    const referenceKeys = uploadedFiles.filter((item) => item.kind === "reference").map((item) => item.key);
    const storedSourceFiles = uploadedFiles.filter((item) => item.kind === "source").map(({ file: sourceFile, key }) => ({
      name: sourceFile.name,
      key,
      type: sourceFile.type || "application/octet-stream",
    }));
    const card = createWorkCard({
      file: fileId,
      role,
      owner,
      generated: true,
      version: nowText,
      colors: paletteKeys.length,
      tags: selectedUploadTags.join(","),
      // 列表/瀑布流使用轻量缩略图；详情由 workImageEntries 优先读取高清预览/原图。
      imageKey: mainTiers.thumbKey,
      paletteKeys: JSON.stringify(paletteKeys),
      paletteThumbKeys: JSON.stringify(paletteThumbKeys),
      paletteFiles: JSON.stringify(paletteFileEntries),
      imageData,
      title: workName,
      project: uploadProject?.name || "未关联项目",
      saleStatus: role === "手绘师" ? "未出售" : "未出售",
      customerStatus: "未进入客户选稿",
      reviewStatus: isRevisionResubmission
        ? "待复审 / 修改后重新提交"
        : editTarget
          ? editReviewSummary
          : "待审核 / 管理者未评审",
      reviewState: isRevisionResubmission ? "pending" : editTarget ? editReviewState : "pending",
      submissionRound: isRevisionResubmission
        ? Number(editTarget.dataset.submissionRound || 1) + 1
        : Number(editTarget?.dataset.submissionRound || 1),
      resubmittedAt: isRevisionResubmission ? nowText : editTarget?.dataset.resubmittedAt || "",
      reviewLogs: editTarget?.dataset.reviewLogs || "",
      reviewNote: editTarget?.dataset.reviewNote || "",
      reviewAction: isRevisionResubmission ? "" : editTarget?.dataset.reviewAction || "",
      linkedPainter: linkedPainterText,
      linkedSketches: JSON.stringify(linkedSketchFiles),
      referenceMaterial: referenceText,
      referenceKeys: JSON.stringify(referenceKeys),
      sourceFileName: storedSourceFiles[0]?.name || "",
      sourceFileKey: storedSourceFiles[0]?.key || "",
      sourceFileType: storedSourceFiles[0]?.type || "application/octet-stream",
      sourceFiles: JSON.stringify(storedSourceFiles),
      workImages: JSON.stringify(workImages),
      projectId: uploadProjectId,
      createdAt: editTarget?.dataset.createdAt || nowText,
    });
    card.dataset.version = nowText;
    // 关联项目（选填）：关联后归入项目、暂不进公共作品库
    const pjId = uploadProjectId;
    if (pjId) {
      const proj = pjById(pjId);
      card.dataset.projectId = pjId;
      card.dataset.pjStage = "每日新稿";
      if (proj) {
        pjPush(proj, `${currentAccount.name || "成员"} 上传了稿件：${workName}`, "new");
        pjSave();
        if (typeof updateProjectNavBadge === "function") updateProjectNavBadge();
      }
    }
    if (editTarget) {
      editTarget.remove();
      workRecordCache.delete(fileId);
      markWorkRecordDirty(card);
    }
    if (isRevisionResubmission) dismissedNotifications.delete("draft-review");
    if (!editTarget && !isAdministrator()) {
      recordActivityNotification({
        type: "work-upload",
        title: `${role === "手绘师" ? "手绘稿" : "设计稿"}待审核`,
        text: `${currentAccount.name || role} 上传了「${workName}」${uploadProject ? `，关联项目「${uploadProject.name}」` : ""}`,
        relatedOwners: [owner],
        adminOnly: true,
      });
    }
    refreshWorkCards();
    setAppLoadingProgress(97, "正在同步到云端工作台…");
    await saveStudioStateToCloud();
    setAppLoadingProgress(100, "上传完成，正在打开稿件…");
    configureWorksView(roleSelect.value, currentAccount.ownerKey);
    sortWorkCards();
    renderRecycleBin();
    renderDailyReviewBoard();
    renderLibraryGrid();
    renderNotifications();
    uploadConfirm.textContent = "确认上传";
    uploadConfirm.disabled = false;
    closeUploadModal();
    showToast(editTarget
      ? isRevisionResubmission
        ? `V${Number(card.dataset.submissionRound || 1)} 已重新提交并进入待复审，包含 ${count} 个配色${projectText}。`
        : `稿件资料已更新，当前评审状态保持不变。`
      : `成功上传 1 个作品，包含 ${count} 个配色${painterText}${projectText}，等待管理员审核。`, "success");
  } catch (error) {
    console.error(error);
    uploadConfirm.textContent = "确认上传";
    uploadConfirm.disabled = false;
    // 上传失败时也必须释放全屏弹层，否则它会继续拦截工作台的所有输入。
    closeUploadModal();
    showToast(artworkUploadErrorMessage(error), "error");
  } finally {
    // 无论失败发生在压缩、IPC 写入还是状态保存，都必须释放上传弹窗的锁。
    uploadConfirm.disabled = false;
    hideAppLoading();
    if (uploadModal?.classList.contains("active")) closeUploadModal();
    if (!anyOverlayOpen()) {
      document.body.style.overflow = "";
      document.body.classList.remove("modal-open", "viewer-open", "app-loading");
    }
  }
});
let replaceTargetCard = null;

/* ----- 替换图片 ----- */
const replaceImageInput = document.querySelector("#replaceImageInput");
replaceImageInput.addEventListener("change", async () => {
  if (!replaceTargetCard || !replaceImageInput.files.length) return;
  const files = acceptedUploadFiles(replaceImageInput.files, {
    label: "作品图片",
    maxBytes: MAX_IMAGE_FILE_BYTES,
    imageOnly: true,
    extensions: SUPPORTED_IMAGE_EXTENSIONS,
  })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));

  if (!files.length) {
    replaceImageInput.value = "";
    replaceTargetCard = null;
    showToast("请选择图片文件。", "error");
    return;
  }

  try {
    const nowText = formatDateTime();
    const keys = [];
    const thumbKeys = [];
    const entries = [];
    const startedAt = Date.now();
    const uploaded = await mapWithConcurrency(files, 3, async (file, index) => ({
      file,
      tiers: await persistArtworkImageTiers(`${replaceTargetCard.dataset.file}__color_${index + 1}_${startedAt}`, file),
    }));
    for (let index = 0; index < uploaded.length; index += 1) {
      const { file, tiers } = uploaded[index];
      keys.push(tiers.previewKey);
      thumbKeys.push(tiers.thumbKey);
      entries.push({ name: file.name, key: tiers.originalKey, type: file.type || "image/jpeg", primary: index === 0 });
      if (index === 0) {
        setImageKey(replaceTargetCard, tiers.thumbKey);
        applyImageData(replaceTargetCard, await resolveImageSource(tiers.thumbKey));
      }
    }

    setPaletteKeys(replaceTargetCard, keys);
    setPaletteThumbKeys(replaceTargetCard, thumbKeys);
    setPaletteFiles(replaceTargetCard, entries);
    replaceTargetCard.dataset.colors = files.length;
    replaceTargetCard.dataset.version = nowText;
    const meta = workMeta[replaceTargetCard.dataset.file] || {};
    meta.version = nowText;
    meta.colors = files.length;
    workMeta[replaceTargetCard.dataset.file] = meta;

    const verSpan = replaceTargetCard.querySelector(".version-row span:first-child");
    if (verSpan) verSpan.textContent = `版本 ${nowText}`;
    enhanceOneWorkCard(replaceTargetCard);
    await saveStudioStateToCloud();
    showToast(`已替换为一花 ${files.length} 色。`, "success");
  } catch (error) {
    console.error(error);
    showToast("替换失败，请重新选择图片。", "error");
  }

  replaceImageInput.value = "";
  replaceTargetCard = null;
});

document.addEventListener("dblclick", (event) => {
  const card = event.target.closest(".work-card");
  if (!card) return;

  const projectLine = event.target.closest(".work-body > p");
  if (projectLine) {
    event.preventDefault();
    event.stopPropagation();
    const currentValue = projectLine.textContent.replace(/^项目：/, "").trim();
    selectFromDataSource({
      anchor: projectLine,
      options: projectOptions(),
      currentValue,
      onSelect: (value) => updateCardProject(card, value),
    });
    return;
  }

  const linkedPainterValue = event.target.closest("dd");
  const linkedRow = linkedPainterValue?.closest("dl div");
  if (linkedPainterValue && linkedRow?.querySelector("dt")?.textContent.trim() === "引用手绘") {
    event.preventDefault();
    event.stopPropagation();
    selectFromDataSource({
      anchor: linkedPainterValue,
      options: painterWorkOptions(),
      currentValue: linkedPainterValue.textContent.trim(),
      onSelect: (value) => updateCardLinkedPainter(card, value),
    });
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".review-filter-tab")) return;
});

document.addEventListener("click", (event) => {
  const renderedDeleteButton = event.target.closest("[data-delete-file]");
  if (renderedDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    const card = sourceCardByFile(renderedDeleteButton.dataset.deleteFile);
    if (card) deleteWorkCard(card);
    return;
  }

  const addToSelection = event.target.closest("[data-library-add]");
  if (addToSelection) {
    event.preventDefault();
    event.stopPropagation();
    const file = addToSelection.dataset.libraryAdd;
    if (!libraryCart.has(file)) {
      animateLibraryItemToCart(addToSelection, addToSelection.closest(".library-card"));
      addLibraryCart(file);
    }
    return;
  }

  const compareInput = event.target.closest("[data-library-compare]");
  if (compareInput) {
    event.stopPropagation();
    if (compareInput.checked) {
      libraryCompareSelection.add(compareInput.dataset.libraryCompare);
    } else {
      libraryCompareSelection.delete(compareInput.dataset.libraryCompare);
    }
    return;
  }

  const libraryCard = event.target.closest(".library-card[data-library-file]");
  if (libraryCard) {
    if (event.target.closest(".library-compare")) return;
    const targetCard = sourceCardByFile(libraryCard.dataset.libraryFile);
    if (targetCard) {
      openLightbox(targetCard);
    }
    return;
  }

  const sleepAction = event.target.closest("[data-sleep-action]");
  if (sleepAction) {
    const file = sleepAction.closest(".sleep-item")?.dataset.file;
    const card = [...workCards].find((item) => item.dataset.file === file);
    if (card) {
      if (sleepAction.dataset.sleepAction === "restore") setWorkSleeping(card, false);
      else resubmitSleepingWork(card, sleepAction.dataset.sleepAction);
    }
    return;
  }

  const resetReview = event.target.closest("[data-reset-review]");
  if (resetReview) {
    event.stopPropagation();
    const reviewCard = resetReview.closest(".review-work-card");
    const sourceCard = reviewCard ? sourceCardByFile(reviewCard.dataset.reviewFile) : null;
    if (sourceCard) openReviewConfirmation(sourceCard, "待评审", () => resetReviewDecision(sourceCard));
    return;
  }

  const workLoadMore = event.target.closest("[data-work-load-more]");
  if (workLoadMore) {
    workRenderLimit += WORK_RENDER_BATCH;
    applyWorkGalleryBatch();
    return;
  }

  const libraryLoadMore = event.target.closest("[data-library-load-more]");
  if (libraryLoadMore) {
    libraryGridRenderLimit += LIBRARY_GRID_BATCH;
    renderLibraryGrid();
    return;
  }

  const reviewLoadMore = event.target.closest("[data-review-load-more]");
  if (reviewLoadMore) {
    reviewRenderLimit += REVIEW_RENDER_BATCH;
    renderDailyReviewBoard();
    return;
  }

  const reviewCard = event.target.closest(".review-work-card");
  if (reviewCard && !event.target.closest(".review-actions") && !event.target.closest(".review-change-control") && !event.target.closest("[data-edit-kind]") && !event.target.closest("[data-linked-painter-file]")) {
    const targetCard = [...workCards].find((card) => card.dataset.file === reviewCard.dataset.reviewFile);
    if (targetCard) {
      openLightbox(targetCard);
    }
    return;
  }

  const linkedPainterButton = event.target.closest("[data-linked-painter-file]");
  if (linkedPainterButton) {
    event.stopPropagation();
    const painterCard = sourceCardByFile(linkedPainterButton.dataset.linkedPainterFile);
    switchView("designer");
    if (painterCard) {
      painterCard.scrollIntoView({ behavior: "smooth", block: "center" });
      painterCard.classList.add("search-match-focus");
      setTimeout(() => painterCard.classList.remove("search-match-focus"), 1400);
    } else {
      showToast(`已进入手绘素材页：${linkedPainterButton.dataset.linkedPainterFile}`, "success");
    }
    return;
  }

  const previewTrigger = event.target.closest(".preview-trigger");
  const previewCard = previewTrigger?.closest(".work-card");
  if (previewCard) {
    openLightbox(previewCard, { worksLibrary: activeViewId() === "designer" });
    return;
  }

  /* 审核按钮 */
  const reviewBtn = event.target.closest(".review-actions button");
  if (reviewBtn && !reviewBtn.classList.contains("reviewed-btn") && !reviewBtn.classList.contains("reviewed-active")) {
    event.stopPropagation();
    const container = reviewBtn.closest(".review-actions");
    if (container) handleReviewAction(reviewBtn, container);
    return;
  }

  /* 标签：点击已有标签可移除；点 + 标签可添加 */
  const tagChip = event.target.closest(".tag-chip");
  if (tagChip) {
    event.stopPropagation();
    const card = tagChip.closest(".work-card");
    if (!card) return;

    if (tagChip.classList.contains("add")) {
      // 添加新标签
      const tag = window.prompt("输入新标签，会加入全网公共标签");
      if (!tag) return;
      if (!globalTags.includes(tag)) globalTags.push(tag);
      const tags = card.dataset.tags ? card.dataset.tags.split(",") : [];
      if (tags.length >= 6) { showToast("最多 6 个标签。", "warning"); return; }
      if (tags.includes(tag)) { showToast(`标签"${tag}"已存在。`, "warning"); return; }
      card.dataset.tags = [...tags, tag].join(",");
      card.querySelector(".tag-bar")?.remove();
      renderCardTags(card);
      saveStudioState();
      showToast(`已添加：${tag}`, "success");
    } else {
      // 点击已有标签 → 移除
      const tagText = tagChip.textContent.trim();
      const tags = card.dataset.tags ? card.dataset.tags.split(",") : [];
      card.dataset.tags = tags.filter((t) => t !== tagText).join(",");
      card.querySelector(".tag-bar")?.remove();
      renderCardTags(card);
      saveStudioState();
      showToast(`已移除标签：${tagText}`, "warning");
    }
    return;
  }

  /* 删除作品 */
  const deleteButton = event.target.closest(".delete-work");
  if (deleteButton) {
    event.stopPropagation();
    deleteWorkCard(deleteButton.closest(".work-card"));
    return;
  }

  /* 恢复作品 */
  const restoreButton = event.target.closest(".restore-work");
  if (restoreButton) {
    event.stopPropagation();
    const file = restoreButton.closest(".recycle-item")?.dataset.file;
    const item = deletedWorks.find((entry) => entry.card.dataset.file === file);
    if (item) requestRestoreWorkCard(item.card);
    return;
  }

  /* 替换图片 → 打开文件选择器 */
  const replaceBtn = event.target.closest(".replace-image");
  if (replaceBtn) {
    event.stopPropagation();
    replaceTargetCard = replaceBtn.closest(".work-card");
    replaceImageInput.click();
    return;
  }
});
recycleSearch.addEventListener("input", renderRecycleBin);
recycleStatus.addEventListener("change", renderRecycleBin);
recycleSort.addEventListener("change", renderRecycleBin);
recycleList?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest(".recycle-delete-work");
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    const file = deleteButton.closest(".recycle-item")?.dataset.file;
    if (isCreatorRole()) {
      const bucket = personalArchiveBucket();
      const card = sourceCardByFile(file);
      if (!card || !bucket.deleted?.[file] || !window.confirm(`永久删除 ${file} 吗？此操作不会影响管理员作品库。`)) return;
      bucket.removed[file] = new Date().toISOString();
      delete bucket.deleted[file];
      renderRecycleBin();
      try {
        await saveStudioStateToCloud();
        showToast(`${file} 已从你的回收站移除。`, "warning");
      } catch {
        showToast("回收站已在本页更新，但云端同步失败，请保持页面并重试。", "error");
      }
      return;
    }
    if (currentAccount.role !== "管理员") return;
    const entry = deletedWorks.find((item) => item.card.dataset.file === file);
    const linkedOrders = ordersContainingWork(file);
    if (linkedOrders.length) {
      showToast(`${file} 仍用于订单 ${linkedOrders.map((order) => order.id).join("、")}，为保留订单历史不能永久删除。`, "warning");
      return;
    }
    if (!entry || !window.confirm(`永久删除 ${file} 吗？此操作不可恢复。`)) return;
    const removedFiles = permanentlyRemoveWorkCards([entry.card]);
    deletedWorks = deletedWorks.filter((item) => !removedFiles.includes(item.card.dataset.file));
    try {
      await saveStudioStateToCloud();
      await removedFiles.cleanupPromise;
      renderRecycleBin();
      showToast(`${file} 已永久删除。`, "warning");
    } catch {
      renderRecycleBin();
      showToast("稿件元数据已删除，但云端原图清理未完全成功，系统会在后续同步中继续处理。", "error");
    }
    return;
  }
  const restoreButton = event.target.closest(".restore-work");
  if (restoreButton) {
    event.preventDefault();
    event.stopPropagation();
    const file = restoreButton.closest(".recycle-item")?.dataset.file;
    const card = isCreatorRole()
      ? sourceCardByFile(file)
      : deletedWorks.find((entry) => entry.card.dataset.file === file)?.card;
    if (card) requestRestoreWorkCard(card);
    return;
  }
  const thumb = event.target.closest(".recycle-thumb");
  if (!thumb) return;
  event.preventDefault();
  event.stopPropagation();
  const file = thumb.closest(".recycle-item")?.dataset.file;
  const card = isCreatorRole()
    ? sourceCardByFile(file)
    : deletedWorks.find((entry) => entry.card.dataset.file === file)?.card;
  if (card) openLightbox(card, { worksLibrary: true });
  else showToast("未找到该回收站稿件，请刷新后重试。", "warning");
});
sleepSearch.addEventListener("input", renderSleepList);
sleepDesignerFilter.addEventListener("change", renderSleepList);
sleepTagFilter.addEventListener("change", renderSleepList);
sleepSort.addEventListener("change", renderSleepList);
[sleepPatternForm, sleepTheme, sleepStyle, sleepSalesStatus].forEach((select) => select?.addEventListener("change", renderSleepList));
[recyclePatternForm, recycleTheme, recycleStyle].forEach((select) => select?.addEventListener("change", renderRecycleBin));
bindArchiveTypeSegment("sleepTypeSegment", (value) => {
  sleepArchiveType = value;
  sleepManageSelection.clear();
  renderSleepList();
});
bindArchiveTypeSegment("recycleTypeSegment", (value) => {
  recycleArchiveType = value;
  renderRecycleBin();
});
document.querySelector("#sleepManageToggle")?.addEventListener("click", () => {
  if (currentAccount.role === "销售") return;
  sleepManageMode = !sleepManageMode;
  sleepManageSelection.clear();
  document.querySelector("#sleepManageToggle span").textContent = sleepManageMode ? "完成管理" : "管理";
  ["#sleepManageSelectAll", "#sleepManageRestore", "#sleepManageDelete"].forEach((selector) =>
    document.querySelector(selector)?.classList.toggle("hidden", !sleepManageMode)
  );
  renderSleepList();
});
document.querySelector("#sleepManageSelectAll")?.addEventListener("click", () => {
  if (currentAccount.role === "销售") return;
  const cards = sleepItemsForRole().filter((card) => archiveTypeMatches(card, sleepArchiveType));
  if (cards.length && cards.every((card) => sleepManageSelection.has(card.dataset.file))) {
    sleepManageSelection.clear();
  } else {
    cards.forEach((card) => sleepManageSelection.add(card.dataset.file));
  }
  renderSleepList();
});
document.querySelector("#sleepManageRestore")?.addEventListener("click", async () => {
  if (currentAccount.role === "销售") return;
  const cards = sleepItemsForRole().filter((card) => sleepManageSelection.has(card.dataset.file));
  await Promise.all(cards.map((card) => setWorkSleeping(card, false, { silent: true })));
  sleepManageSelection.clear();
  renderSleepList();
  renderDailyReviewBoard();
  sortWorkCards();
  try {
    await saveStudioStateToCloud();
    showToast(`已恢复 ${cards.length} 件稿件。`, "success");
  } catch {
    showToast("稿件已在本页恢复，但云端同步失败，请保持页面并重试。", "error");
  }
});
document.querySelector("#sleepManageDelete")?.addEventListener("click", async () => {
  if (currentAccount.role === "销售") return;
  const cards = sleepItemsForRole().filter((card) => sleepManageSelection.has(card.dataset.file));
  if (!cards.length || !ensureWorksCanMoveToRecycle(cards)) return;
  if (!window.confirm(`确认删除已选中的 ${cards.length} 件休眠稿件吗？删除后会进入回收站。`)) return;
  const deletedAt = new Date().toISOString();
  if (isCreatorRole()) {
    cards.forEach((card) => setPersonalArchiveState(card, "delete", true));
    sleepManageSelection.clear();
    renderSleepList();
    renderRecycleBin();
    try {
      await saveStudioStateToCloud();
      showToast(`已将 ${cards.length} 件休眠稿件移入回收站。`, "warning");
    } catch {
      showToast("稿件已在本页移入回收站，但云端同步失败，请保持页面并重试。", "error");
    }
    return;
  }
  cards.forEach((card) => {
    card.classList.add("deleted");
    card.dataset.deletedAt = deletedAt;
    markWorkRecordDirty(card);
    deletedWorks = deletedWorks.filter((item) => item.card.dataset.file !== card.dataset.file);
    deletedWorks.push({ card, deletedAt });
  });
  sleepManageSelection.clear();
  renderSleepList();
  renderRecycleBin();
  try {
    await saveStudioStateToCloud();
    showToast(`已将 ${cards.length} 件休眠稿件移入回收站。`, "warning");
  } catch {
    showToast("稿件已在本页移入回收站，但云端同步失败，请保持页面并重试。", "error");
  }
});
sleepList?.addEventListener("click", (event) => {
  const selection = event.target.closest("[data-sleep-select]");
  if (selection) {
    event.stopPropagation();
    if (selection.checked) sleepManageSelection.add(selection.dataset.sleepSelect);
    else sleepManageSelection.delete(selection.dataset.sleepSelect);
    renderSleepList();
    return;
  }
  if (sleepManageMode) {
    const item = event.target.closest(".sleep-item");
    if (item) {
      if (sleepManageSelection.has(item.dataset.file)) sleepManageSelection.delete(item.dataset.file);
      else sleepManageSelection.add(item.dataset.file);
      renderSleepList();
    }
    return;
  }
  const thumb = event.target.closest(".sleep-thumb");
  if (!thumb) return;
  event.preventDefault();
  event.stopPropagation();
  const card = sourceCardByFile(thumb.closest(".sleep-item")?.dataset.file);
  if (card) openLightbox(card, { worksLibrary: true });
});
emptyRecycle.addEventListener("click", async () => {
  if (currentAccount.role !== "管理员") return;
  if (!deletedWorks.length) {
    return;
  }

  const confirmed = window.confirm("确认一键清空回收站吗？未关联订单的稿件会被永久删除；订单历史中仍在使用的稿件会继续保留。");
  if (!confirmed) {
    return;
  }

  const removedFiles = permanentlyRemoveWorkCards(deletedWorks.map(({ card }) => card));
  deletedWorks = deletedWorks.filter(({ card }) => !removedFiles.includes(card.dataset.file));
  try {
    await saveStudioStateToCloud();
    await removedFiles.cleanupPromise;
    renderRecycleBin();
    showToast(removedFiles.protectedFiles.length
      ? `已清理 ${removedFiles.length} 件稿件；${removedFiles.protectedFiles.length} 件因关联订单而保留。`
      : "回收站已清空。", "warning");
  } catch {
    renderRecycleBin();
    showToast("回收站元数据已清空，但部分云端原图仍在清理中。", "error");
  }
});
const lightboxFigure = lightbox.querySelector(".lightbox-figure");
lightboxOriginalImage?.addEventListener("load", applyPreviewZoom);
window.addEventListener("resize", () => {
  if (lightbox.classList.contains("active")) applyPreviewZoom();
});
lightboxFigure?.addEventListener("wheel", (event) => {
  event.preventDefault();
  event.stopPropagation();
  const sensitivity = event.ctrlKey ? 0.012 : 0.0035;
  const nextZoom = previewZoom * Math.exp(-event.deltaY * sensitivity);
  setContinuousZoomAtPointer(nextZoom, event);
}, { passive: false, capture: true });
lightboxFigure?.addEventListener("gesturestart", (event) => {
  event.preventDefault();
  previewGestureStartZoom = previewZoom;
}, { passive: false });
lightboxFigure?.addEventListener("gesturechange", (event) => {
  event.preventDefault();
  setContinuousZoomAtPointer(previewGestureStartZoom * event.scale, event);
}, { passive: false });
lightboxImage.addEventListener("dblclick", (event) => {
  event.preventDefault();
  event.stopPropagation();
  lightbox.classList.toggle("info-hidden");
  resetPreviewTransform();
});
lightboxFigure?.addEventListener("click", (event) => {
  if (event.target.closest(".lightbox-nav, .lightbox-zoom-controls")) return;
  if (suppressPreviewClick) {
    suppressPreviewClick = false;
    return;
  }
  // Clicking the artwork only selects/focuses it. Zoom is intentionally
  // limited to wheel, trackpad pinch and the explicit controls.
});
document.querySelector("#lightboxZoomControls")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-lightbox-zoom]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  if (button.dataset.lightboxZoom === "reset") {
    resetPreviewTransform();
    return;
  }
  if (button.dataset.lightboxZoom === "actual") {
    showActualPreviewPixels();
    return;
  }
  changeZoom(button.dataset.lightboxZoom === "in" ? 0.5 : -0.5);
});
lightboxImage.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") {
    previewTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    lightboxImage.setPointerCapture(event.pointerId);
    if (previewTouchPointers.size === 2) {
      const [a, b] = [...previewTouchPointers.values()];
      previewPinchStart = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: previewZoom,
      };
    }
    event.preventDefault();
    return;
  }
  if (previewZoom <= 1.01) return;
  event.preventDefault();
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: previewOffsetX,
    offsetY: previewOffsetY,
    moved: false,
  };
  lightboxImage.classList.add("dragging");
  lightboxImage.setPointerCapture(event.pointerId);
});
lightboxImage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" && previewTouchPointers.has(event.pointerId)) {
    previewTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (previewTouchPointers.size === 2 && previewPinchStart) {
      const [a, b] = [...previewTouchPointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      setContinuousZoomAtPointer(previewPinchStart.zoom * distance / Math.max(previewPinchStart.distance, 1), {
        clientX: (a.x + b.x) / 2,
        clientY: (a.y + b.y) / 2,
      });
    }
    event.preventDefault();
    return;
  }
  if (!dragStart) {
    return;
  }
  event.preventDefault();
  if (Math.abs(event.clientX - dragStart.x) > 3 || Math.abs(event.clientY - dragStart.y) > 3) {
    dragStart.moved = true;
  }
  previewOffsetX = dragStart.offsetX + event.clientX - dragStart.x;
  previewOffsetY = dragStart.offsetY + event.clientY - dragStart.y;
  applyPreviewZoom();
});
lightboxImage.addEventListener("pointerup", (event) => {
  previewTouchPointers.delete(event.pointerId);
  if (previewTouchPointers.size < 2) previewPinchStart = null;
  suppressPreviewClick = Boolean(dragStart?.moved);
  dragStart = null;
  lightboxImage.classList.remove("dragging");
});
lightboxImage.addEventListener("pointercancel", (event) => {
  previewTouchPointers.delete(event.pointerId);
  if (previewTouchPointers.size < 2) previewPinchStart = null;
  dragStart = null;
  lightboxImage.classList.remove("dragging");
});
lightboxImage.addEventListener("touchmove", (event) => {
  if (dragStart) event.preventDefault();
}, { passive: false });
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (exitConfirmModal?.classList.contains("active")) {
      closeExitConfirmation();
      return;
    }
    if (referenceZoomOverlay.classList.contains("active")) {
      closeReferenceZoom();
      return;
    }
    if (reviewConfirmModal.classList.contains("active")) {
      closeReviewConfirmation();
      return;
    }
    if (compareOverlay.classList.contains("active")) {
      closeCompareOverlay();
      return;
    }
    if (lightbox.classList.contains("active")) {
      closeLightbox();
      return;
    }
    if (painterPickerModal?.classList.contains("active")) {
      closePainterPickerModal();
      return;
    }
    if (uploadModal.classList.contains("active")) {
      requestCloseUploadModal();
      return;
    }
    if (projectModal?.classList.contains("active")) {
      requestCloseProjectCreateModal();
      return;
    }
    if (customerModal?.classList.contains("active")) {
      requestCloseCustomerModal();
      return;
    }
    if (projectFileViewer?.classList.contains("active")) {
      closeProjectFileViewer();
      return;
    }
    if (projectFileManager?.classList.contains("active")) {
      closeProjectFileManager();
      return;
    }
    if (projectDetailModal?.classList.contains("active")) {
      closeProjectDetailModal();
      return;
    }
    if (tagManagerModal?.classList.contains("active")) {
      closeTagManager();
      return;
    }
    if (riskModal?.classList.contains("active")) {
      closeRiskModal();
      return;
    }
    if (cartPreviewPopover?.classList.contains("active")) {
      closeCartPreview();
      return;
    }
    if (notificationModal?.classList.contains("active")) {
      closeNotificationModal();
      return;
    }
    if (quickCreateModal?.classList.contains("active")) {
      closeQuickCreateModal();
      return;
    }
    if (globalSearchResults && !globalSearchResults.classList.contains("hidden")) {
      hideGlobalSearchResults();
      return;
    }
    return;
  }

  if (!lightbox.classList.contains("active")) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveLightbox(-1);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveLightbox(1);
  }
});

document.addEventListener("dblclick", (event) => {
  const editable = event.target.closest("[data-edit-kind]");
  if (!editable || currentAccount.role !== "管理员") return;
  const kind = editable.dataset.editKind;
  if (editable === lightboxProject) {
    const card = activeLightboxCards()[activePreviewIndex];
    if (!card) return;
    selectFromDataSource({
      anchor: editable,
      options: projectOptions(),
      currentValue: editable.textContent.replace(/^项目：/, "").trim(),
      onSelect: (value) => {
        updateCardProject(card, value);
        lightboxProject.textContent = `项目：${value}`;
        saveStudioState();
      },
    });
    return;
  }
  if (kind === "tags") {
    editReviewTags(editable);
    return;
  }
  if (editable.matches("button")) {
    startInlineSelect(editable, kind);
  }
});

profileAvatar?.addEventListener("click", () => {
  profileAvatarInput?.click();
});

profileAvatarInput?.addEventListener("change", async () => {
  const [file] = acceptedUploadFiles(profileAvatarInput.files, {
    label: "头像",
    maxBytes: 5 * 1024 * 1024,
    imageOnly: true,
    maxCount: 1,
  });
  if (!file) return;
  const imageData = await readFileAsDataURL(file);
  saveCurrentProfilePatch({ avatar: imageData });
  showToast("头像已更新。", "success");
  profileAvatarInput.value = "";
});

logoutButton.addEventListener("click", async () => {
  // 切换账号前立即落盘，确保管理员刚完成的审核结果能被创作者账号读到。
  flushStudioState();
  if (RELEASE_CONFIG.useBackendAuth) {
    showAppLoading("正在同步云端数据…", { progress: true });
    setAppLoadingProgress(20, "正在提交本页变更…");
    try {
      await backendLastSyncAttempt;
      setAppLoadingProgress(100, "云端数据同步完成");
    } catch (error) {
      hideAppLoading();
      showToast("云端同步尚未完成，请保持当前页面并稍后重试退出。", "error");
      return;
    }
  }
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_ACCOUNT_DATA_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  document.documentElement.classList.remove("backend-session-restoring");
  appShell.classList.add("locked");
  loginScreen.classList.remove("hidden");
  roleSelect.disabled = false;
  if (userBadge) if (userBadge) userBadge.textContent = "未登录";
  if (profileNameInput) profileNameInput.textContent = "";
  if (profileRoleLabel) profileRoleLabel.textContent = "";
  if (profileAvatar) {
    profileAvatar.textContent = "KD";
    profileAvatar.style.backgroundImage = "";
  }
  const remembered = readRememberedLogin();
  if (!remembered.employee) {
    usernameInput.value = "";
    passwordInput.value = "";
    employeeRememberPassword.checked = false;
  }
  if (!remembered.client) {
    clientUsername.value = "";
    clientPassword.value = "";
    clientRememberPassword.checked = false;
  }
  window.KingLoginPortal?.setSubmitting("employee", false);
  window.KingLoginPortal?.setSubmitting("client", false);
  switchLoginPortal("entry");
  lockBodyScroll(false);
  releaseFileURLs();
  hideAppLoading();
});

// 控制台首次渲染前先恢复项目数据，避免登录后项目数短暂显示为 0。
pjLoad();
applyStoredState();
syncRegisteredAccountsToTeam();
syncProjectMemberOptions();
loadProjectDrafts();
enhanceWorkCards();
syncWorkProjectLabels();
syncReviewCardPreviews();
configureRoleNavigation(roleSelect.value);
updateRoleDashboard(roleSelect.value);
initialImageHydration = hydrateStoredImages();
renderSleepList();
renderDailyReviewBoard();
restoreRememberedLogins();
const storedSessionAccount = localStorage.getItem(SESSION_KEY);
const requestedPortal = new URLSearchParams(window.location.search).get("portal");
let storedSessionContext = null;
try {
  storedSessionContext = JSON.parse(localStorage.getItem(SESSION_ACCOUNT_DATA_KEY) || "null");
} catch {
  storedSessionContext = null;
}
if (requestedPortal === "client" && storedSessionContext?.account?.role !== "客户") {
  switchLoginPortal("client");
} else if (requestedPortal === "employee" && storedSessionContext?.account?.role === "客户") {
  switchLoginPortal("employee");
} else if (RELEASE_CONFIG.useBackendAuth && backendAuthSession()?.account) {
  const sessionAccount = backendAuthSession().account;
  showAppLoading("正在同步云端数据…", { progress: true });
  setAppLoadingProgress(18, "正在恢复登录状态…");
  pullBackendStudioState({ refreshUi: true, showProgress: true })
      .then(() => applyLogin(sessionAccount.username, sessionAccount))
      .catch((error) => {
        const authenticationFailed = error?.status === 401
          || ["UNAUTHENTICATED", "INVALID_CREDENTIALS", "REFRESH_TOKEN_REQUIRED"].includes(error?.code);
        if (authenticationFailed) {
          sessionStorage.removeItem(AUTH_SESSION_KEY);
          sessionStorage.removeItem(BACKEND_STUDIO_SYNC_KEY);
          document.documentElement.classList.remove("backend-session-restoring");
          appShell.classList.add("locked");
          loginScreen.classList.remove("hidden");
          switchLoginPortal("employee");
          loginError.textContent = "登录已过期，请重新登录。";
          return;
        }
        // 短时断网或接口超时不能等同于退出登录；先进入本地缓存的工作台，
        // 后续轮询会继续拉取服务端权威状态。
        applyLogin(sessionAccount.username, sessionAccount);
        setTimeout(() => showToast?.("云端暂时无法连接，恢复网络后会自动同步。", "warning"), 0);
      });
} else if (!RELEASE_CONFIG.useBackendAuth && storedSessionContext?.accountKey && storedSessionContext?.account) {
  const freshAccount = demoAccounts[storedSessionContext.accountKey] || storedSessionContext.account;
  if (freshAccount.accountStatus === "已停用") {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_ACCOUNT_DATA_KEY);
    switchLoginPortal("employee");
    loginError.textContent = "该账号已被管理员停用。";
  } else {
    applyLogin(storedSessionContext.accountKey, freshAccount);
  }
} else if (!RELEASE_CONFIG.useBackendAuth && storedSessionAccount && demoAccounts[storedSessionAccount]) {
  if (demoAccounts[storedSessionAccount].accountStatus === "已停用") {
    localStorage.removeItem(SESSION_KEY);
    switchLoginPortal("employee");
    loginError.textContent = "该账号已被管理员停用。";
  } else {
    applyLogin(storedSessionAccount, demoAccounts[storedSessionAccount]);
  }
} else {
  switchLoginPortal(requestedPortal === "client" ? "client" : requestedPortal === "employee" ? "employee" : "entry");
}

// ================= 客户看稿入口页（Silk 背景 + 玻璃面板） =================
const VIEWER_SESSION_KEY = "studio_site_viewer_session_v1";
let viewerSession = null;
let viewerSilkRaf = null;
let resumeViewerSilk = null;
let viewerStarting = false;
let viewerLastSelectionCount = -1;

// —— Silk WebGL 着色器（移植自 React Bits Silk）——
function initViewerSilk() {
  if (resumeViewerSilk) {
    resumeViewerSilk();
    return;
  }
  const canvas = document.querySelector("#viewerSilk");
  const fallback = document.querySelector(".viewer-silk-fallback");
  if (!canvas) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let gl;
  try { gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl"); } catch (e) { gl = null; }
  if (!gl) { canvas.style.display = "none"; if (fallback) fallback.style.opacity = "1"; return; }

  const vs = `attribute vec2 aPos; attribute vec2 aUv; varying vec2 vUv;
    void main(){ vUv = aUv; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const fs = `precision highp float;
    varying vec2 vUv;
    uniform float uTime, uSpeed, uScale, uRotation, uNoiseIntensity;
    uniform vec3 uColor;
    const float e = 2.71828182845904523536;
    float noise(vec2 texCoord){ float G=e; vec2 r=(G*sin(G*texCoord)); return fract(r.x*r.y*(1.0+texCoord.x)); }
    vec2 rotateUvs(vec2 uv, float angle){ float c=cos(angle); float s=sin(angle); mat2 rot=mat2(c,-s,s,c); return rot*uv; }
    void main(){
      float rnd = noise(gl_FragCoord.xy);
      vec2 uv = rotateUvs(vUv * uScale, uRotation);
      vec2 tex = uv * uScale;
      float tOffset = uSpeed * uTime;
      tex.y += 0.03 * sin(8.0*tex.x - tOffset);
      float pattern = 0.6 + 0.4*sin(5.0*(tex.x+tex.y+cos(3.0*tex.x+5.0*tex.y)+0.02*tOffset)+sin(20.0*(tex.x+tex.y-0.1*tOffset)));
      vec4 col = vec4(uColor,1.0)*vec4(pattern) - rnd/15.0*uNoiseIntensity;
      col.a = 1.0;
      gl_FragColor = col;
    }`;
  function compile(type, src) {
    const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(sh)); return null; }
    return sh;
  }
  const vsh = compile(gl.VERTEX_SHADER, vs), fsh = compile(gl.FRAGMENT_SHADER, fs);
  if (!vsh || !fsh) { canvas.style.display = "none"; if (fallback) fallback.style.opacity = "1"; return; }
  const prog = gl.createProgram(); gl.attachShader(prog, vsh); gl.attachShader(prog, fsh); gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  // 两个三角形铺满，附带 uv
  const data = new Float32Array([-1,-1, 0,0,  1,-1, 1,0,  -1,1, 0,1,  -1,1, 0,1,  1,-1, 1,0,  1,1, 1,1]);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos"), aUv = gl.getAttribLocation(prog, "aUv");
  gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
  const uTime = gl.getUniformLocation(prog, "uTime");
  gl.uniform1f(gl.getUniformLocation(prog, "uSpeed"), 6.2);
  gl.uniform1f(gl.getUniformLocation(prog, "uScale"), 1.0);
  gl.uniform1f(gl.getUniformLocation(prog, "uRotation"), 4.35);
  gl.uniform1f(gl.getUniformLocation(prog, "uNoiseIntensity"), 1.5);
  const c = [0x95/255, 0x95/255, 0x95/255]; // #959595
  gl.uniform3f(gl.getUniformLocation(prog, "uColor"), c[0], c[1], c[2]);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener("resize", resize);

  let t = 0, last = performance.now();
  function frame(now) {
    const delta = Math.min((now - last) / 1000, 0.05); last = now;
    t += 0.1 * delta;
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    viewerSilkRaf = requestAnimationFrame(frame);
  }
  resumeViewerSilk = () => {
    resize();
    if (reduce) {
      gl.uniform1f(uTime, 2.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return;
    }
    last = performance.now();
    cancelAnimationFrame(viewerSilkRaf);
    viewerSilkRaf = requestAnimationFrame(frame);
  };
  resumeViewerSilk();
}

// —— 漂浮花型卡片（氛围装饰）——
function renderViewerFloaters() {
  const layer = document.querySelector("#viewerFloatLayer");
  if (!layer) return;
  // 专属选稿入口只保留 Silk 动态背景，不叠加床品或花型图片。
  layer.innerHTML = "";
}

function openViewerEntry(prefill) {
  if (!canStartCustomerReview()) return;
  const entry = document.querySelector("#viewerEntry");
  if (!entry) return;
  const companyInput = document.querySelector("#viewerCompany");
  const nameInput = document.querySelector("#viewerName");
  if (companyInput) companyInput.value = prefill?.name || "";
  if (nameInput) nameInput.value = prefill?.contact || "";
  viewerStarting = false;
  document.querySelector("#viewerLoading")?.classList.add("hidden");
  document.querySelector("#viewerPanel")?.classList.remove("viewer-panel-exit");
  entry.classList.add("active");
  entry.setAttribute("aria-hidden", "false");
  document.body.classList.add("viewer-open");
  if (location.hash !== "#viewer") location.hash = "#viewer";
  renderViewerFloaters();
  initViewerSilk();
  updateViewerMatchTag();
  updateViewerStartState();
  setTimeout(() => companyInput?.focus(), 60);
}

function closeViewerEntry() {
  const entry = document.querySelector("#viewerEntry");
  if (!entry) return;
  entry.classList.remove("active");
  entry.setAttribute("aria-hidden", "true");
  document.body.classList.remove("viewer-open");
  cancelAnimationFrame(viewerSilkRaf);
  viewerSilkRaf = null;
  if (location.hash === "#viewer") history.replaceState(null, "", location.pathname + location.search);
}

function viewerMatchedClient() {
  const val = (document.querySelector("#viewerCompany")?.value || "").trim();
  if (!val) return null;
  return customerCenterClients.find((c) => c.name === val)
    || customerCenterClients.find((c) => c.name.includes(val) && val.length >= 2) || null;
}

function updateViewerMatchTag() {
  const tag = document.querySelector("#viewerMatchTag");
  if (!tag) return;
  const exact = customerCenterClients.find((c) => c.name === (document.querySelector("#viewerCompany")?.value || "").trim());
  tag.classList.toggle("hidden", !exact);
}

function updateViewerStartState() {
  const btn = document.querySelector("#viewerStart");
  const company = (document.querySelector("#viewerCompany")?.value || "").trim();
  const name = (document.querySelector("#viewerName")?.value || "").trim();
  if (btn) btn.disabled = !(company && name) || viewerStarting;
}

function renderViewerCompanySuggest() {
  const box = document.querySelector("#viewerCompanySuggest");
  const input = document.querySelector("#viewerCompany");
  if (!box || !input) return;
  const q = input.value.trim();
  if (!q) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  const matches = customerCenterClients.filter((c) => searchMatches(q, [c.name, c.contact])).slice(0, 6);
  if (!matches.length) {
    box.innerHTML = `<div class="viewer-suggest-empty">未找到客户，可新建客户档案。</div>`;
    box.classList.remove("hidden");
    return;
  }
  box.innerHTML = matches.map((c) => `<button type="button" class="viewer-suggest-item" data-viewer-pick="${escapeHtml(c.id)}">
    <strong>${escapeHtml(c.name)}</strong>
    <span>${escapeHtml(c.contact)} · 已购 ${customerRealPurchased(c)} 款 · 最近看稿 ${escapeHtml(customerRealLastReview(c))}</span>
  </button>`).join("");
  box.classList.remove("hidden");
}

function renderViewerNameSuggest() {
  const box = document.querySelector("#viewerNameSuggest");
  const nameInput = document.querySelector("#viewerName");
  if (!box || !nameInput) return;
  const client = customerCenterClients.find((c) => c.name === (document.querySelector("#viewerCompany")?.value || "").trim());
  if (!client) { box.classList.add("hidden"); return; }
  const q = nameInput.value.trim();
  const contacts = [client.contact].filter(Boolean);
  const matchedContact = q ? contacts.find((contact) => searchMatches(q, [contact])) : null;
  if (matchedContact && normalizeSearch(matchedContact) === normalizeSearch(q)) {
    box.innerHTML = "";
    box.classList.add("hidden");
    return;
  }
  const visibleContacts = q ? contacts.filter((contact) => searchMatches(q, [contact])) : contacts;
  const isNew = q && !matchedContact;
  box.innerHTML = visibleContacts.map((n) => `<button type="button" class="viewer-suggest-item" data-viewer-name="${escapeHtml(n)}"><strong>${escapeHtml(n)}</strong><span>已有联系人</span></button>`).join("")
    + (isNew ? `<div class="viewer-suggest-empty">「${escapeHtml(q)}」将作为新联系人</div>` : "");
  box.classList.toggle("hidden", !box.innerHTML);
}

// —— 开始看稿：保存会话 + 过渡 + 进入作品库 ——
function startViewing() {
  if (!canStartCustomerReview()) return;
  if (viewerStarting) return;
  const company = (document.querySelector("#viewerCompany")?.value || "").trim();
  const name = (document.querySelector("#viewerName")?.value || "").trim();
  if (!company || !name) return;
  viewerStarting = true;
  updateViewerStartState();
  const matched = customerCenterClients.find((c) => c.name === company);
  viewerSession = {
    customerId: matched?.id || null,
    companyName: company,
    contactName: name,
    sessionId: `S-${Date.now()}`,
    createdAt: new Date().toISOString(),
    selectedPatternIds: [],
  };
  // 记录真实「最近一次看稿时间」到客户档案
  if (matched) {
    matched.lastReviewAt = formatDateTime();
    matched.reviewCount = (matched.reviewCount || 0) + 1;
    customerManagementState.lastReviewById = customerManagementState.lastReviewById || {};
    customerManagementState.lastReviewById[matched.id] = matched.lastReviewAt;
    saveCustomerManagementState();
    renderCustomerList();
    saveStudioState();
  }
  try { localStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(viewerSession)); } catch (e) {}
  document.querySelector("#viewerLoading")?.classList.remove("hidden");
  document.querySelector("#viewerPanel")?.classList.add("viewer-panel-exit");
  document.querySelector("#viewerFloatLayer")?.classList.add("viewer-float-sharpen");
  setTimeout(() => {
    closeViewerEntry();
    enterViewerLibrary();
    viewerStarting = false;
  }, 800);
}

function startAnonymousViewing() {
  if (!canStartCustomerReview()) return;
  libraryCart = new Set();
  viewerSession = {
    customerId: null,
    companyName: "",
    contactName: "",
    anonymous: true,
    sessionId: `S-${Date.now()}`,
    createdAt: new Date().toISOString(),
    selectedPatternIds: [],
  };
  try { localStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(viewerSession)); } catch {}
  enterViewerLibrary();
}

// —— 全屏客户花型库 ——
let vlibFilterState = null;
let vlibSelectedOnly = false;
let vlibSearchText = "";
let vlibSearchTimer = 0;
const VLIB_RENDER_BATCH = 24;
let vlibRenderLimit = VLIB_RENDER_BATCH;
let vlibVisibleCards = [];
let vlibLockedBySales = new Set();
let vlibKeyboardIndex = 0;
let vlibCompareActive = false;
let vlibCompareFiles = new Set();
function vlibEnsureState() {
  if (!vlibFilterState) {
    vlibFilterState = {};
    libraryFilterConfig.forEach((r) => { vlibFilterState[r.key] = new Set(); });
  }
  return vlibFilterState;
}
function vlibFilteredCards() {
  const state = vlibEnsureState();
  const soldFiles = soldPatternFiles();
  const selectedFiles = selectedCartFiles();
  let cards = approvedLibraryCards().filter((card) =>
    !soldFiles.has(card.dataset.file)
    && (vlibSelectedOnly ? libraryCart.has(card.dataset.file) : !selectedFiles.has(card.dataset.file))
    && libraryFilterConfig.every((row) => {
      const sel = state[row.key];
      if (!sel.size) return true;
      return cardLibraryValues(card, row.key).some((v) => sel.has(v));
    })
  );
  if (vlibSearchText) {
    cards = cards.filter((card) => {
      const title = card.querySelector(".work-head strong")?.textContent || "";
      return searchMatches(vlibSearchText, [card.dataset.file, title, card.dataset.tags]);
    });
  }
  return cards;
}
function renderVlibFilters() {
  const bar = document.querySelector("#vlibFilter");
  if (!bar) return;
  const state = vlibEnsureState();
  bar.innerHTML = libraryFilterConfig.map((row) => {
    const st = state[row.key];
    const values = [...st];
    const trigger = values.length
      ? `<span class="lib-select-value">${escapeHtml(values[0])}${values.length > 1 ? `<b>+${values.length - 1}</b>` : ""}</span>`
      : `<span class="lib-select-value">全部${escapeHtml(row.label)}</span>`;
    const opts = `<label class="lib-opt ${st.size === 0 ? "selected" : ""}"><input type="checkbox" data-vlib-cat="${row.key}" value="__all__" ${st.size === 0 ? "checked" : ""}/><span>全部${escapeHtml(row.label)}</span><i aria-hidden="true">✓</i></label>`
      + row.options.map((o) => `<label class="lib-opt ${st.has(o) ? "selected" : ""}"><input type="checkbox" data-vlib-cat="${row.key}" value="${escapeHtml(o)}" ${st.has(o) ? "checked" : ""}/><span>${escapeHtml(o)}</span><i aria-hidden="true">✓</i></label>`).join("");
    return `<div class="library-filter-row">
      <div class="lib-select" data-vlib-select="${row.key}">
        <button class="lib-select-trigger" type="button" data-vlib-toggle="${row.key}" aria-haspopup="listbox" aria-expanded="false">${trigger}<i class="lib-select-caret" aria-hidden="true"></i></button>
        <div class="lib-select-panel hidden">${opts}</div>
      </div></div>`;
  }).join("");
  renderVlibSelectedConditions();
}
function renderVlibSelectedConditions() {
  const target = document.querySelector("#vlibSelectedConditions");
  if (!target) return;
  const state = vlibEnsureState();
  const selected = libraryFilterConfig.flatMap((row) =>
    [...state[row.key]].map((value) => ({ key: row.key, value }))
  );
  target.innerHTML = selected.length
    ? `<span class="library-selected-label">已选条件：</span>${selected.map((item) =>
      `<button class="library-selected-chip" type="button" data-vlib-remove-cat="${item.key}" data-vlib-remove-val="${escapeHtml(item.value)}">${escapeHtml(item.value)}<i aria-hidden="true">×</i></button>`
    ).join("")}<button class="library-clear" type="button" data-vlib-clear>清空筛选</button>`
    : "";
}
function vlibCardHtml(card, lockedBySales) {
  const file = card.dataset.file;
  const soldOut = lockedBySales.has(file);
  const picked = libraryCart.has(file);
  const colors = Number(card.dataset.colors || 1);
  const customWork = isCurrentCustomerCustomWork(card);
  const check = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const previewSrc = cardPreviewSource(card);
  const imageKey = card.dataset.imageKey || "";
  const imageMarkup = previewSrc
    ? `<img src="${escapeHtml(previewSrc)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`
    : imageKey
      ? `<img data-image-key="${escapeHtml(imageKey)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`
      : "";
  return `<div class="vlib-card ${picked ? "picked" : ""} ${soldOut ? "owned" : ""}" data-vlib-work="${escapeHtml(file)}" role="button" tabindex="-1" aria-label="${escapeHtml(file)}，${colors} 个配色">
    <div class="vlib-thumb" data-image-shell>${imageMarkup}
      <span class="color-count">配色 ${colors}</span>
      ${customWork ? '<span class="customer-custom-badge">定制</span>' : ""}
    </div>
    ${soldOut
      ? `<span class="vlib-owned-tag">已独家售出</span>`
      : `<button class="vlib-add ${picked ? "added" : ""}" type="button" data-vlib-add="${escapeHtml(file)}" aria-label="${picked ? "已选，点击取消" : "加入选稿"}">${picked ? check : "+"}</button>`}
    <div class="vlib-hover"><strong>${escapeHtml(file)}</strong><span>${soldOut ? "已独家售出" : `${colors} 配色`}</span></div>
  </div>`;
}

function syncVlibGalleryAfterCartChange(file) {
  const grid = document.querySelector("#vlibGallery");
  const overlay = document.querySelector("#viewerLibrary");
  if (!grid || !overlay?.classList.contains("active")) return;
  const hidden = vlibSelectedOnly ? !libraryCart.has(file) : selectedCartFiles().has(file);
  if (!hidden) {
    renderVlibGallery(true);
    return;
  }
  vlibVisibleCards = vlibVisibleCards.filter((card) => card.dataset.file !== file);
  [...grid.querySelectorAll("[data-vlib-work]")]
    .find((card) => card.dataset.vlibWork === file)
    ?.remove();
  renderVlibGallery();
}

function renderVlibGallery(reset = false) {
  const grid = document.querySelector("#vlibGallery");
  if (!grid) return;
  if (reset || !vlibVisibleCards.length) {
    // 筛选与客户可见性判断会读取每张源卡片的元数据，只在条件变化时执行。
    const company = viewerSession?.companyName || currentAccount.company || "";
    vlibVisibleCards = vlibFilteredCards().filter((card) =>
      pjVisibleToCustomer(card, company)
    );
    vlibLockedBySales = new Set();
    grid.innerHTML = "";
    vlibRenderLimit = VLIB_RENDER_BATCH;
    grid.scrollTop = 0;
  }
  const cards = vlibVisibleCards;
  if (!cards.length) {
    grid.innerHTML = `<p class="empty-state">未找到符合条件的花型。</p>`;
    return;
  }
  grid.querySelector("[data-vlib-load-more]")?.remove();
  const rendered = grid.querySelectorAll(".vlib-card").length;
  const target = Math.min(cards.length, Math.max(vlibRenderLimit, VLIB_RENDER_BATCH));
  if (target > rendered) {
    grid.insertAdjacentHTML("beforeend", cards.slice(rendered, target).map((card) => vlibCardHtml(card, vlibLockedBySales)).join(""));
  }
  vlibRenderLimit = target;
  if (target < cards.length) {
    grid.insertAdjacentHTML("beforeend", `<button class="gallery-auto-load-sentinel" type="button" data-gallery-auto-load data-vlib-load-more tabindex="-1" aria-hidden="true"></button>`);
  }
  hydrateLazyKeyImages(grid);
  const renderedCards = [...grid.querySelectorAll(".vlib-card")];
  if (renderedCards.length) {
    vlibKeyboardIndex = Math.min(vlibKeyboardIndex, renderedCards.length - 1);
    renderedCards.forEach((item, index) => item.tabIndex = index === vlibKeyboardIndex ? 0 : -1);
  }
}

function syncVlibSelectionSummary() {
  updateViewerSelectionBar();
  if (cartNavCount) cartNavCount.textContent = allSelectedFiles().length;
}
function openViewerLibraryOverlay() {
  const ov = document.querySelector("#viewerLibrary");
  if (!ov) return;
  vlibEnsureState();
  vlibSelectedOnly = false;
  if (viewerSession?.selectedPatternIds?.length) libraryCart = new Set(viewerSession.selectedPatternIds);
  const sub = document.querySelector("#vlibSubtitle");
  if (sub && viewerSession) sub.textContent = viewerSession.anonymous
    ? "匿名看稿 · 客户将在订单生成后补充"
    : `正在为 ${viewerSession.companyName} · ${viewerSession.contactName} 选稿`;
  renderVlibFilters();
  const search = document.querySelector("#vlibSearch");
  if (search) search.value = vlibSearchText;
  renderVlibGallery(true);
  vlibKeyboardIndex = 0;
  ov.classList.add("active");
  ov.setAttribute("aria-hidden", "false");
  document.body.classList.add("viewer-open");
  updateViewerSelectionBar();
}
function closeViewerLibraryOverlay() {
  const ov = document.querySelector("#viewerLibrary");
  closeVlibCompare();
  ov?.classList.remove("active");
  ov?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("viewer-open");
}
function renderVlibSelectedPop() {
  const pop = document.querySelector("#vlibSelectedPop");
  if (!pop) return;
  const files = [...libraryCart];
  pop.innerHTML = `<div class="vlib-selected-head">本次已选 ${files.length} 款</div>`
    + (files.length ? `<div class="vlib-selected-rows">${files.map((f) => {
      const card = sourceCardByFile(f);
      const colors = Number(card?.dataset.colors || 1);
      const name = card?.querySelector(".work-head strong")?.textContent.trim() || f;
      return `<div class="flower-line"><span class="flower-line-thumb" data-image-shell>${cartPreviewImageMarkup(card)}</span><div class="flower-line-info"><strong>${escapeHtml(name)}</strong><small>${colors} 配色</small></div><button class="flower-line-remove" type="button" data-vlib-unpick="${escapeHtml(f)}">×</button></div>`;
    }).join("")}</div>` : `<p class="vlib-selected-empty">还没有选择花型。</p>`);
  hydrateLazyKeyImages(pop);
}

function vlibColorName(card, index) {
  if (index === 0) return "主配色";
  return getPaletteFiles(card)[index]?.name || `配色 ${index + 1}`;
}

async function vlibVariantSource(card, index) {
  if (!card) return "";
  if (index === 0) {
    const direct = cardPreviewSource(card);
    if (direct) return direct;
  }
  try {
    const resolved = await resolveFirstWorkImage(card, index);
    if (resolved) return resolved;
  } catch (error) {}
  const key = getPaletteKeys(card)[index];
  return key ? resolveImageSource(key) : "";
}

function closeVlibCompare() {
  vlibCompareActive = false;
  const overlay = document.querySelector("#viewerLibrary");
  overlay?.classList.remove("is-comparing");
  document.querySelector("#vlibCompareLayout")?.classList.add("hidden");
  document.querySelector("#vlibCompareCartPop")?.classList.add("hidden");
}

function vlibCompareCards() {
  return [...vlibCompareFiles].map(sourceCardByFile).filter(Boolean).slice(0, 4);
}

function renderVlibCompareCart() {
  const list = document.querySelector("#vlibCompareCartList");
  const count = document.querySelector("#vlibCompareCartCount");
  if (!list) return;
  const files = [...libraryCart];
  if (count) count.textContent = String(files.length);
  list.innerHTML = files.length ? files.map((file) => {
    const card = sourceCardByFile(file);
    const inCompare = vlibCompareFiles.has(file);
    return `<article class="vlib-compare-cart-item ${inCompare ? "in-compare" : ""}" data-compare-cart-file="${escapeHtml(file)}">
      <span class="vlib-compare-cart-thumb" data-image-shell>${cartPreviewImageMarkup(card)}</span>
      <span><strong>${escapeHtml(file)}</strong><small>${escapeHtml(vlibColorName(card, Number(card?.dataset.vlibCompareVariant || 0)))}</small></span>
      <button type="button" class="vlib-cart-remove" data-vlib-compare-cart-remove="${escapeHtml(file)}" aria-label="从选稿车删除 ${escapeHtml(file)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
      <button type="button" class="vlib-cart-add ${inCompare ? "in-compare" : ""}" data-vlib-compare-cart-add="${escapeHtml(file)}" aria-label="${inCompare ? "已在对比中" : "加入对比"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg></button>
    </article>`;
  }).join("") : `<p class="vlib-compare-cart-empty">选稿车还没有确认的花型。</p>`;
  hydrateLazyKeyImages(list);
}

function renderVlibCompare() {
  const layout = document.querySelector("#vlibCompareLayout");
  const columns = document.querySelector("#vlibCompareColumns");
  if (!layout || !columns) return;
  const cards = vlibCompareCards();
  vlibCompareFiles = new Set(cards.map((card) => card.dataset.file));
  columns.dataset.count = String(cards.length);
  columns.innerHTML = cards.map((card) => {
    const colorCount = Math.max(1, Number(card.dataset.colors || 1));
    const active = Math.min(colorCount - 1, Number(card.dataset.vlibCompareVariant || 0));
    const palette = Array.from({ length: colorCount }, (_, index) =>
      `<button type="button" class="vlib-compare-swatch ${index === active ? "active" : ""}" data-vlib-compare-color="${index}" data-compare-file="${escapeHtml(card.dataset.file)}" title="${escapeHtml(vlibColorName(card, index))}" aria-label="切换到${escapeHtml(vlibColorName(card, index))}"><span data-compare-swatch-image="${index}"></span></button>`
    ).join("");
    const confirmed = libraryCart.has(card.dataset.file);
    return `<article class="vlib-compare-column ${confirmed ? "confirmed" : ""}" data-vlib-compare-column="${escapeHtml(card.dataset.file)}">
      <button class="vlib-compare-preview" type="button" data-vlib-compare-preview="${escapeHtml(card.dataset.file)}" aria-label="查看 ${escapeHtml(card.dataset.file)} 大图"><div class="vlib-compare-image" data-compare-main-image="${active}"></div></button>
      <div class="vlib-compare-hover-actions" aria-label="卡片操作"><button class="vlib-compare-remove" type="button" data-vlib-compare-remove="${escapeHtml(card.dataset.file)}" aria-label="从对比中移除"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button><button class="vlib-compare-confirm" type="button" data-vlib-compare-confirm="${escapeHtml(card.dataset.file)}" aria-label="确认加入选稿车"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"></path></svg></button></div>
      <div class="vlib-compare-palette" aria-label="选择配色">${palette}</div>
    </article>`;
  }).join("");
  renderVlibCompareCart();
  cards.forEach((card) => {
    const column = columns.querySelector(`[data-vlib-compare-column="${CSS.escape(card.dataset.file)}"]`);
    if (!column) return;
    const colorCount = Math.max(1, Number(card.dataset.colors || 1));
    const active = Math.min(colorCount - 1, Number(card.dataset.vlibCompareVariant || 0));
    vlibVariantSource(card, active).then((src) => {
      if (src && column.isConnected) {
        const encoded = `url("${src.replace(/"/g, "\\\"")}")`;
        column.querySelector(".vlib-compare-image").style.backgroundImage = encoded;
      }
    });
    for (let index = 0; index < colorCount; index += 1) {
      vlibVariantSource(card, index).then((src) => {
        const swatch = column.querySelector(`[data-compare-swatch-image="${index}"]`);
        if (src && swatch) {
          const encoded = `url("${src.replace(/"/g, "\\\"")}")`;
          swatch.style.backgroundImage = encoded;
        }
      });
    }
  });
}

function openVlibCompare() {
  if (libraryCart.size < 2) return;
  vlibCompareActive = true;
  vlibCompareFiles = new Set([...libraryCart].slice(0, 4));
  const overlay = document.querySelector("#viewerLibrary");
  overlay?.classList.add("is-comparing");
  document.querySelector("#vlibCompareLayout")?.classList.remove("hidden");
  renderVlibCompare();
}
function enterViewerLibrary() {
  librarySessionActive = true;
  openViewerLibraryOverlay();
}

function updateViewerSelectionBar() {
  const els = [document.querySelector("#vlibSelectCount"), document.querySelector("#viewerSelectCount")].filter(Boolean);
  els.forEach((countEl) => {
    countEl.textContent = `本次已选 ${libraryCart.size} 款`;
    if (viewerLastSelectionCount >= 0 && viewerLastSelectionCount !== libraryCart.size) {
      countEl.classList.remove("viewer-count-bump");
      void countEl.offsetWidth;
      countEl.classList.add("viewer-count-bump");
    }
  });
  viewerLastSelectionCount = libraryCart.size;
  const compareStart = document.querySelector("#vlibCompareStart");
  if (compareStart) {
    compareStart.classList.toggle("hidden", libraryCart.size < 2);
    compareStart.textContent = `对比选中的 ${libraryCart.size} 款`;
  }
  if (vlibCompareActive) renderVlibCompare();
  if (viewerSession) {
    viewerSession.selectedPatternIds = [...libraryCart];
    try { localStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(viewerSession)); } catch (e) {}
  }
}

// —— 新建客户档案（迷你）——
function openViewerNewClient() {
  const modal = document.querySelector("#viewerNewClientModal");
  if (!modal) return;
  document.querySelector("#ncCompany").value = (document.querySelector("#viewerCompany")?.value || "").trim();
  document.querySelector("#ncName").value = (document.querySelector("#viewerName")?.value || "").trim();
  document.querySelector("#ncPhone").value = "";
  const ownerInput = document.querySelector("#ncOwner");
  if (ownerInput) ownerInput.value = (currentAccount?.name || "").split(" ")[0] || employeeRoster()[0] || "";
  document.querySelector("#ncOwnerSuggest")?.classList.add("hidden");
  // 同款玻璃卡片：隐藏主面板，展示建档面板
  document.querySelector("#viewerPanel")?.classList.add("hidden");
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}
function closeViewerNewClient() {
  const modal = document.querySelector("#viewerNewClientModal");
  modal?.classList.add("hidden");
  modal?.setAttribute("aria-hidden", "true");
  document.querySelector("#viewerPanel")?.classList.remove("hidden");
}
function saveViewerNewClient(startAfter) {
  const company = document.querySelector("#ncCompany")?.value.trim();
  const name = document.querySelector("#ncName")?.value.trim();
  if (!company || !name) { showToast("请填写公司名称和客户姓名。", "warning"); return; }
  const owner = document.querySelector("#ncOwner")?.value || "管理员";
  if (!customerCenterClients.length) customerCenterClients = buildCustomerCenter();
  const id = `KH${Date.now()}`;
  const client = {
    id, name: company, display: company, contact: name,
    phone: document.querySelector("#ncPhone")?.value.trim() || "",
    owner, type: "品牌客户", region: "", style: "", product: "",
    wechat: "", email: "", note: "", purchased: 0,
    lastBuy: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    createdAt: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    lastCoop: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    loginAccount: customerLoginAccount(id),
    loginPassword: genCustomerPassword(id),
  };
  customerCenterClients = [client, ...customerCenterClients];
  showToast(`客户档案已创建｜登录账号 ${client.loginAccount}｜密码 ${client.loginPassword}`, "success");
  closeViewerNewClient();
  const companyInput = document.querySelector("#viewerCompany");
  const nameInput = document.querySelector("#viewerName");
  if (companyInput) companyInput.value = company;
  if (nameInput) nameInput.value = name;
  updateViewerMatchTag();
  updateViewerStartState();
  if (startAfter) startViewing();
}

// —— 事件绑定 ——
(function bindViewerEntry() {
  const companyInput = document.querySelector("#viewerCompany");
  const nameInput = document.querySelector("#viewerName");
  companyInput?.addEventListener("input", () => {
    renderViewerCompanySuggest(); updateViewerMatchTag(); updateViewerStartState();
    renderViewerNameSuggest();
  });
  companyInput?.addEventListener("focus", renderViewerCompanySuggest);
  nameInput?.addEventListener("input", () => { renderViewerNameSuggest(); updateViewerStartState(); });
  nameInput?.addEventListener("focus", renderViewerNameSuggest);
  document.querySelector("#viewerCompanySuggest")?.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-viewer-pick]");
    if (!pick) return;
    const client = customerCenterClients.find((c) => c.id === pick.dataset.viewerPick);
    if (!client) return;
    companyInput.value = client.name;
    if (nameInput && !nameInput.value.trim()) nameInput.value = client.contact;
    document.querySelector("#viewerCompanySuggest").classList.add("hidden");
    updateViewerMatchTag(); updateViewerStartState();
  });
  document.querySelector("#viewerNameSuggest")?.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-viewer-name]");
    if (!pick) return;
    nameInput.value = pick.dataset.viewerName;
    document.querySelector("#viewerNameSuggest").classList.add("hidden");
    updateViewerStartState();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".viewer-combo")) {
      document.querySelector("#viewerCompanySuggest")?.classList.add("hidden");
      document.querySelector("#viewerNameSuggest")?.classList.add("hidden");
    }
  });
  document.querySelector("#viewerStart")?.addEventListener("click", startViewing);
  document.querySelector("#viewerNewClient")?.addEventListener("click", openViewerNewClient);
  document.querySelector("#ncBack")?.addEventListener("click", closeViewerNewClient);
  document.querySelector("#ncSaveStart")?.addEventListener("click", () => saveViewerNewClient(true));
  document.querySelector("#viewerFinishSelection")?.addEventListener("click", () => {
    updateViewerSelectionBar();
    showToast(`本次选稿已保存，共 ${libraryCart.size} 款。`, "success");
    document.querySelector("#viewerBanner")?.classList.add("hidden");
    document.querySelector("#viewerSelectionBar")?.classList.add("hidden");
    const flow = document.querySelector("#customerSelectionFlow");
    flow?.classList.remove("viewer-mode");
    flow?.classList.add("hidden");
    document.querySelector("#library")?.classList.remove("viewer-library-active");
    document.querySelector("#customerCenter")?.classList.remove("hidden");
    if (pageTitle) pageTitle.textContent = titleMap.library || "客户中心";
    viewerLibraryHead?.classList.add("hidden");
    viewerLibraryFilterBar?.classList.add("hidden");
    viewerLibrarySelectedConditions?.classList.add("hidden");
  });
  document.querySelector("#viewerViewSelected")?.addEventListener("click", () => {
    if (!libraryCart.size) { showToast("尚未选择花型。", "warning"); return; }
    switchView("cart");
  });
  window.addEventListener("hashchange", () => {
    if (location.hash !== "#viewer") closeViewerEntry();
  });
  // 恢复未完成会话
  try {
    const raw = localStorage.getItem(VIEWER_SESSION_KEY);
    if (raw) {
      viewerSession = JSON.parse(raw);
      if (Array.isArray(viewerSession?.selectedPatternIds)) {
        libraryCart = new Set(viewerSession.selectedPatternIds);
      }
    }
  } catch (e) {}
})();

// ===== 全屏花型库 + 入口页 返回/入口 交互 =====
(function bindViewerLibrary() {
  document.querySelector("#topStartReview")?.addEventListener("click", () => {
    if (!["管理员", "销售"].includes(currentAccount.role)) return;
    startAnonymousViewing();
  });
  // 入口页左上角 返回客户中心
  document.querySelector("#viewerBack")?.addEventListener("click", () => {
    closeViewerEntry();
    document.querySelector("#customerCenter")?.classList.remove("hidden");
  });
  // 花型库 返回 → 回到入口页
  document.querySelector("#vlibBack")?.addEventListener("click", () => {
    closeViewerLibraryOverlay();
    if (viewerSession?.anonymous) {
      switchView(libraryCart.size ? "cart" : "dashboard");
      return;
    }
    const client = viewerSession?.customerId
      ? customerCenterClients.find((c) => c.id === viewerSession.customerId)
      : (viewerSession ? { name: viewerSession.companyName, contact: viewerSession.contactName } : null);
    openViewerEntry(client);
  });
  // 筛选：勾选
  document.querySelector("#vlibFilter")?.addEventListener("change", (e) => {
    const input = e.target.closest("input[data-vlib-cat]");
    if (!input) return;
    const st = vlibEnsureState()[input.dataset.vlibCat];
    if (input.value === "__all__") st.clear();
    else if (input.checked) st.add(input.value);
    else st.delete(input.value);
    renderVlibFilters();
    renderVlibGallery(true);
  });
  document.querySelector("#vlibSearch")?.addEventListener("input", (event) => {
    const nextSearchText = event.target.value.trim().toLowerCase();
    clearTimeout(vlibSearchTimer);
    vlibSearchTimer = window.setTimeout(() => {
      vlibSearchText = nextSearchText;
      renderVlibGallery(true);
    }, 120);
  });
  // 筛选：下拉开关
  document.querySelector("#vlibFilter")?.addEventListener("click", (e) => {
    const t = e.target.closest("[data-vlib-toggle]");
    if (!t) return;
    const box = t.closest(".lib-select");
    const panel = box.querySelector(".lib-select-panel");
    const willOpen = panel.classList.contains("hidden");
    document.querySelectorAll("#vlibFilter .lib-select-panel").forEach((p) => p.classList.add("hidden"));
    document.querySelectorAll("#vlibFilter .lib-select").forEach((s) => {
      s.classList.remove("open");
      s.querySelector("[data-vlib-toggle]")?.setAttribute("aria-expanded", "false");
    });
    panel.classList.toggle("hidden", !willOpen);
    box.classList.toggle("open", willOpen);
    t.setAttribute("aria-expanded", String(willOpen));
  });
  document.querySelector("#vlibSelectedConditions")?.addEventListener("click", (e) => {
    const remove = e.target.closest("[data-vlib-remove-cat]");
    if (remove) {
      vlibEnsureState()[remove.dataset.vlibRemoveCat].delete(remove.dataset.vlibRemoveVal);
      renderVlibFilters();
      renderVlibGallery(true);
      return;
    }
    if (e.target.closest("[data-vlib-clear]")) {
      libraryFilterConfig.forEach((row) => vlibEnsureState()[row.key].clear());
      renderVlibFilters();
      renderVlibGallery(true);
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#vlibFilter .lib-select")) {
      document.querySelectorAll("#vlibFilter .lib-select-panel").forEach((p) => p.classList.add("hidden"));
      document.querySelectorAll("#vlibFilter .lib-select").forEach((s) => {
        s.classList.remove("open");
        s.querySelector("[data-vlib-toggle]")?.setAttribute("aria-expanded", "false");
      });
    }
  });
  // 画廊：加入/取消 + 预览
  document.querySelector("#vlibGallery")?.addEventListener("click", (e) => {
    const more = e.target.closest("[data-vlib-load-more]");
    if (more) {
      vlibRenderLimit += VLIB_RENDER_BATCH;
      renderVlibGallery();
      return;
    }
    const add = e.target.closest("[data-vlib-add]");
    if (add) {
      e.stopPropagation();
      const file = add.dataset.vlibAdd;
      const picked = !libraryCart.has(file);
      if (picked) libraryCart.add(file); else libraryCart.delete(file);
      syncVlibSelectionSummary();
      syncVlibGalleryAfterCartChange(file);
      return;
    }
    const work = e.target.closest("[data-vlib-work]");
    if (work) {
      const card = [...workCards].find((c) => c.dataset.file === work.dataset.vlibWork);
      if (card) openCustomerPatternViewer(card.dataset.file, { previewOnly: true, contextFiles: vlibVisibleCards.map((item) => item.dataset.file) });
    }
  });
  document.querySelector("#vlibGallery")?.addEventListener("focusin", (event) => {
    const cards = [...event.currentTarget.querySelectorAll(".vlib-card")];
    const focused = event.target.closest(".vlib-card");
    const index = cards.indexOf(focused);
    if (index < 0) return;
    vlibKeyboardIndex = index;
    cards.forEach((card, cardIndex) => card.tabIndex = cardIndex === index ? 0 : -1);
  });
  document.addEventListener("keydown", (event) => {
    const overlay = document.querySelector("#viewerLibrary");
    if (!overlay?.classList.contains("active")) return;
    if (document.querySelector("#custPatternViewer")?.classList.contains("open")) return;
    if (vlibCompareActive) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeVlibCompare();
      }
      return;
    }
    const typing = event.target.matches("input, textarea, select") || event.target.isContentEditable;
    if (typing) {
      if (event.key === "Escape") event.target.blur();
      return;
    }
    const grid = document.querySelector("#vlibGallery");
    const cards = [...(grid?.querySelectorAll(".vlib-card") || [])];
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && cards.length) {
      event.preventDefault();
      const cardWidth = cards[0].getBoundingClientRect().width || 1;
      const columns = Math.max(1, Math.floor((grid.clientWidth + 18) / (cardWidth + 18)));
      const shift = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -columns : columns;
      vlibKeyboardIndex = Math.max(0, Math.min(cards.length - 1, vlibKeyboardIndex + shift));
      cards.forEach((card, index) => card.tabIndex = index === vlibKeyboardIndex ? 0 : -1);
      cards[vlibKeyboardIndex].focus({ preventScroll: true });
      cards[vlibKeyboardIndex].scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
    const activeCard = cards[vlibKeyboardIndex];
    if (event.key === "Enter" && activeCard) {
      event.preventDefault();
      const source = sourceCardByFile(activeCard.dataset.vlibWork);
      if (source) openCustomerPatternViewer(source.dataset.file, { previewOnly: true, contextFiles: vlibVisibleCards.map((item) => item.dataset.file) });
      return;
    }
    if ((event.key === " " || event.key.toLowerCase() === "a") && activeCard) {
      event.preventDefault();
      activeCard.querySelector("[data-vlib-add]")?.click();
      return;
    }
    if (["f", "/"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      document.querySelector("#vlibSearch")?.focus();
      return;
    }
    if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      document.querySelector("#vlibViewSelected")?.click();
      return;
    }
    if (event.key === "Escape") {
      const pop = document.querySelector("#vlibSelectedPop");
      const openPanels = [...document.querySelectorAll("#vlibFilter .lib-select-panel:not(.hidden)")];
      if (pop && !pop.classList.contains("hidden")) pop.classList.add("hidden");
      else if (openPanels.length) openPanels.forEach((panel) => panel.classList.add("hidden"));
      else document.querySelector("#vlibBack")?.click();
      return;
    }
    if (event.key === "?" || (event.shiftKey && event.key === "/")) {
      showToast("快捷键：←↑↓→ 切换｜Enter 预览｜空格/A 选择｜F 搜索｜C 已选｜Esc 返回", "success");
    }
  });
  let vlibScrollFrame = 0;
  document.querySelector("#vlibGallery")?.addEventListener("scroll", (e) => {
    if (vlibScrollFrame) return;
    vlibScrollFrame = requestAnimationFrame(() => {
      vlibScrollFrame = 0;
      const grid = e.currentTarget;
      if (grid.scrollHeight - grid.scrollTop - grid.clientHeight < 420 && grid.querySelector("[data-vlib-load-more]")) {
        vlibRenderLimit += VLIB_RENDER_BATCH;
        renderVlibGallery();
      }
    });
  }, { passive: true });
  // 查看已选 → 小悬浮窗展示已选花型
  document.querySelector("#vlibViewSelected")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const pop = document.querySelector("#vlibSelectedPop");
    if (!pop) return;
    if (!pop.classList.contains("hidden")) { pop.classList.add("hidden"); return; }
    renderVlibSelectedPop();
    pop.classList.remove("hidden");
  });
  document.addEventListener("click", (e) => {
    const pop = document.querySelector("#vlibSelectedPop");
    if (pop && !pop.classList.contains("hidden") && !e.target.closest("#vlibSelectedPop") && !e.target.closest("#vlibViewSelected")) {
      pop.classList.add("hidden");
    }
  });
  document.querySelector("#vlibSelectedPop")?.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-vlib-unpick]");
    if (rm) {
      const file = rm.dataset.vlibUnpick;
      libraryCart.delete(file);
      syncVlibSelectionSummary();
      syncVlibGalleryAfterCartChange(file);
      renderVlibSelectedPop();
    }
  });
  document.querySelector("#vlibCompareStart")?.addEventListener("click", openVlibCompare);
  document.querySelector("#vlibCompareFinish")?.addEventListener("click", () => document.querySelector("#vlibFinish")?.click());
  document.querySelector("#vlibCompareCartToggle")?.addEventListener("click", () => {
    const pop = document.querySelector("#vlibCompareCartPop");
    renderVlibCompareCart();
    pop?.classList.toggle("hidden");
  });
  document.querySelector("#vlibCompareCartClose")?.addEventListener("click", () => document.querySelector("#vlibCompareCartPop")?.classList.add("hidden"));
  document.querySelector("#vlibCompareCartList")?.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-vlib-compare-cart-remove]");
    if (remove) {
      const file = remove.dataset.vlibCompareCartRemove;
      libraryCart.delete(file);
      vlibCompareFiles.delete(file);
      syncVlibSelectionSummary();
      syncVlibGalleryAfterCartChange(file);
      if (!vlibCompareFiles.size) closeVlibCompare();
      return;
    }
    const add = event.target.closest("[data-vlib-compare-cart-add]");
    if (!add) return;
    const file = add.dataset.vlibCompareCartAdd;
    if (!vlibCompareFiles.has(file) && vlibCompareFiles.size >= 4) {
      showToast("稿件对比最多支持 4 款。", "warning");
      return;
    }
    vlibCompareFiles.add(file);
    renderVlibCompare();
  });
  document.querySelector("#vlibCompareColumns")?.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-vlib-compare-remove]");
    if (remove) {
      vlibCompareFiles.delete(remove.dataset.vlibCompareRemove);
      if (!vlibCompareFiles.size) {
        closeVlibCompare();
        return;
      }
      renderVlibCompare();
      return;
    }
    const confirm = event.target.closest("[data-vlib-compare-confirm]");
    if (confirm) {
      const file = confirm.dataset.vlibCompareConfirm;
      if (libraryCart.has(file)) libraryCart.delete(file); else libraryCart.add(file);
      syncVlibSelectionSummary();
      syncVlibGalleryAfterCartChange(file);
      return;
    }
    const preview = event.target.closest("[data-vlib-compare-preview]");
    if (preview) {
      event.stopPropagation();
      openCustomerPatternViewer(preview.dataset.vlibComparePreview, { previewOnly: true, contextFiles: [...libraryCart] });
      return;
    }
    const swatch = event.target.closest("[data-vlib-compare-color]");
    if (!swatch) return;
    const card = sourceCardByFile(swatch.dataset.compareFile);
    const column = swatch.closest("[data-vlib-compare-column]");
    if (!card || !column) return;
    const index = Number(swatch.dataset.vlibCompareColor || 0);
    card.dataset.vlibCompareVariant = String(index);
    column.querySelectorAll("[data-vlib-compare-color]").forEach((button) => button.classList.toggle("active", button === swatch));
    vlibVariantSource(card, index).then((src) => {
      if (src && column.isConnected) column.querySelector(".vlib-compare-image").style.backgroundImage = `url("${src.replace(/"/g, "\\\"")}")`;
    });
    renderVlibCompareCart();
  });
  document.querySelector("#vlibCompareColumns")?.addEventListener("wheel", (event) => {
    const preview = event.target.closest(".vlib-compare-preview");
    const image = preview?.querySelector(".vlib-compare-image");
    if (!image) return;
    event.preventDefault();
    const current = Number(image.dataset.zoom || 1);
    const next = Math.max(1, Math.min(3, current + (event.deltaY < 0 ? 0.12 : -0.12)));
    image.dataset.zoom = String(next);
    image.style.transform = `scale(${next})`;
  }, { passive: false });
  document.querySelector("#vlibCompareContinue")?.addEventListener("click", () => {
    closeVlibCompare();
    document.querySelector("#vlibGallery")?.scrollIntoView({ block: "start" });
  });
  // 完成本次选稿 → 汇总到该客户的选稿车
  document.querySelector("#vlibFinish")?.addEventListener("click", async () => {
    const n = libraryCart.size;
    await runWithAppLoading("正在保存本次选稿…", async () => {
      updateViewerSelectionBar();
      commitViewerSelection();
      libraryCart = new Set();
      if (viewerSession) { viewerSession.selectedPatternIds = []; try { localStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(viewerSession)); } catch (e) {} }
      closeViewerLibraryOverlay();
      renderCartPreview();
      switchView("cart");
    }, 460);
    showToast(`本次选稿已保存到选稿车，共 ${n} 款。`, "success");
  });
})();

// ================= 选稿车：按客户汇总 + 生成订单 =================
const SELECTION_CARTS_KEY = "studio_site_selection_carts_v1";
try { selectionCarts = JSON.parse(localStorage.getItem(SELECTION_CARTS_KEY) || "[]"); } catch (e) { selectionCarts = []; }
function saveSelectionCarts() {
  try { localStorage.setItem(SELECTION_CARTS_KEY, JSON.stringify(selectionCarts)); } catch (e) {}
  if (typeof saveStudioState === "function") saveStudioState();
}
const expandedSelectionCartIds = new Set();

// 右上角选稿车：已提交（各客户选稿车）+ 本次进行中，合并去重
function allSelectedFiles() {
  return [...selectedCartFiles()];
}
function customerCartContextFiles(file) {
  const activeCustomerKey = viewerSession?.customerId || viewerSession?.companyName;
  const activeEntry = selectionCarts.find((entry) =>
    (entry.customerId || entry.company) === activeCustomerKey && (entry.files || []).includes(file)
  );
  if (activeEntry) return [...activeEntry.files];
  const entry = selectionCarts.find((item) => (item.files || []).includes(file));
  if (entry) return [...entry.files];
  if (libraryCart.has(file)) return [...libraryCart];
  return [file];
}

// 已提交选稿在脚本后段恢复；恢复后统一刷新角标、快捷预览和完整选稿车。
renderLibraryCart();
renderCartPage();

function commitViewerSelection() {
  if (!viewerSession) return;
  const files = [...libraryCart];
  if (!files.length) return;
  const key = viewerSession.customerId || viewerSession.companyName || viewerSession.sessionId;
  let entry = selectionCarts.find((c) => (c.customerId || c.company || c.sessionId) === key);
  if (!entry) {
    entry = { id: `SC-${Date.now()}`, sessionId: viewerSession.sessionId, customerId: viewerSession.customerId || null, company: viewerSession.companyName || "", contact: viewerSession.contactName || "", files: [], createdAt: formatDateTime() };
    selectionCarts.unshift(entry);
  }
  entry.files = [...new Set([...(entry.files || []), ...files])];
  entry.contact = viewerSession.contactName;
  saveSelectionCarts();
  renderCartPage();
}

function renderCartPage() {
  const list = document.querySelector("#cartCustomerList");
  if (!list) return;
  const submittedFiles = new Set(selectionCarts.flatMap((entry) => entry.files || []));
  const draftFiles = [...libraryCart].filter((file) => !submittedFiles.has(file));
  const entries = [
    ...(draftFiles.length && viewerSession
      ? [{
          id: "__current__",
          company: viewerSession.companyName || "当前客户",
          contact: viewerSession.contactName || "",
          files: draftFiles,
          isDraft: true,
        }]
      : []),
    ...selectionCarts,
  ];
  if (!entries.length) {
    list.innerHTML = `<p class="empty-state">还没有客户选稿。完成一次客户看稿后会出现在这里。</p>`;
    return;
  }
  list.innerHTML = entries.map((entry) => {
    const expanded = expandedSelectionCartIds.has(entry.id);
    const visibleFiles = expanded ? entry.files : entry.files.slice(0, 4);
    const rows = visibleFiles.map((f) => {
      const card = sourceCardByFile(f);
      const colors = Number(card?.dataset.colors || 1);
      const name = card?.querySelector(".work-head strong")?.textContent.trim() || f;
      return `<div class="flower-line" data-cart-preview="${escapeHtml(f)}" role="button" tabindex="0" aria-label="预览 ${escapeHtml(name)}">
        <span class="flower-line-thumb" data-image-shell>${cartPreviewImageMarkup(card)}</span>
        <div class="flower-line-info"><strong>${escapeHtml(name)}</strong><small>${colors} 配色</small></div>
        <button class="flower-line-remove" type="button" ${entry.isDraft ? `data-cart-remove-current="${escapeHtml(f)}"` : `data-cart-remove-file="${escapeHtml(entry.id)}|${escapeHtml(f)}"`} aria-label="移除">×</button>
      </div>`;
    }).join("");
    return `<article class="cart-cust-card" data-cart-entry="${escapeHtml(entry.id)}">
      <div class="cart-cust-head">
        <div><strong>${escapeHtml(entry.company || "待补充客户")}</strong><small>${entry.isDraft ? "本次选稿中 · " : ""}共 ${entry.files.length} 款花型</small></div>
        <div class="cart-cust-actions">
          ${entry.files.length > 4 ? `<button class="cart-cust-fold" type="button" data-cart-fold="${escapeHtml(entry.id)}">${expanded ? "收起" : `展开其余 ${entry.files.length - 4} 张`}</button>` : ""}
          ${entry.isDraft
            ? `<button class="ghost-button" type="button" data-cart-clear-current>清空</button><button class="primary-button" type="button" data-cart-continue>继续选稿</button>`
            : `<button class="ghost-button" type="button" data-cart-clear="${escapeHtml(entry.id)}">清空</button><button class="primary-button" type="button" data-cart-order="${escapeHtml(entry.id)}">生成订单</button>`}
        </div>
      </div>
      <div class="cart-flower-rows">${rows}</div>
    </article>`;
  }).join("");
  hydrateLazyKeyImages(list);
}

async function cartEntryToOrder(entryId) {
  const entry = selectionCarts.find((c) => c.id === entryId);
  if (!entry) return;
  const order = {
    id: `DD-${Date.now().toString().slice(-8)}`,
    customerId: entry.customerId || null,
    customer: entry.company || "",
    viewer: entry.contact || "",
    customerDisplay: entry.company && entry.contact ? `${entry.company}${entry.contact}` : entry.company || "",
    status: "已确认下单",
    progress: "已确认下单 / 待整理交付",
    deliverStatus: "未交付",
    price: null,
    patternIds: [...entry.files],
    files: entry.files.map((f) => ({ name: f })),
    designers: [],
    painters: [],
    createdAt: formatDateTime(),
  };
  await runWithAppLoading("正在生成订单…", async () => {
    studioOrders.unshift(order);
    if (typeof renderOrderCenter === "function") renderOrderCenter();
    switchView("orders");
    selectionCarts = selectionCarts.filter((c) => c.id !== entryId);
    saveSelectionCarts();
    saveStudioState();
    renderCartPage();
  }, 460);
  showToast(`${entry.company ? `已为 ${entry.company}` : "已"}生成订单，客户可稍后补充。`, "success");
  if (entry.customerId || entry.company) openPaymentPage(order);
}

document.querySelector("#cartCustomerList")?.addEventListener("click", (event) => {
  const fold = event.target.closest("[data-cart-fold]");
  if (fold) {
    const id = fold.dataset.cartFold;
    if (expandedSelectionCartIds.has(id)) expandedSelectionCartIds.delete(id);
    else expandedSelectionCartIds.add(id);
    renderCartPage();
    return;
  }
  if (event.target.closest("[data-cart-continue]")) {
    enterViewerLibrary();
    return;
  }
  if (event.target.closest("[data-cart-clear-current]")) {
    libraryCart.clear();
    updateViewerSelectionBar();
    renderLibraryCart();
    renderCartPage();
    showToast("已清空本次选稿。", "success");
    return;
  }
  const removeCurrent = event.target.closest("[data-cart-remove-current]");
  if (removeCurrent) {
    libraryCart.delete(removeCurrent.dataset.cartRemoveCurrent);
    updateViewerSelectionBar();
    renderLibraryCart();
    renderCartPage();
    return;
  }
  const orderBtn = event.target.closest("[data-cart-order]");
  if (orderBtn) { cartEntryToOrder(orderBtn.dataset.cartOrder); return; }
  const clearBtn = event.target.closest("[data-cart-clear]");
  if (clearBtn) {
    selectionCarts = selectionCarts.filter((c) => c.id !== clearBtn.dataset.cartClear);
    saveSelectionCarts();
    renderCartPage();
    showToast("已清空该客户的选稿。", "success");
    return;
  }
  const removeFile = event.target.closest("[data-cart-remove-file]");
  if (removeFile) {
    const [entryId, file] = removeFile.dataset.cartRemoveFile.split("|");
    const entry = selectionCarts.find((c) => c.id === entryId);
    if (entry) {
      entry.files = entry.files.filter((f) => f !== file);
      if (!entry.files.length) selectionCarts = selectionCarts.filter((c) => c.id !== entryId);
      saveSelectionCarts();
      renderCartPage();
    }
    return;
  }
  const preview = event.target.closest("[data-cart-preview]");
  if (preview) {
    const card = sourceCardByFile(preview.dataset.cartPreview);
    if (card) openLightbox(card, { worksLibrary: true, viewerContext: false });
  }
});
document.querySelector("#cartCustomerList")?.addEventListener("keydown", (event) => {
  if (!(["Enter", " "].includes(event.key))) return;
  const preview = event.target.closest("[data-cart-preview]");
  if (!preview || event.target.closest("button")) return;
  event.preventDefault();
  const card = sourceCardByFile(preview.dataset.cartPreview);
  if (card) openLightbox(card, { worksLibrary: true, viewerContext: false });
});

// ===== 新建客户档案：负责人 输入+下拉 组合框 =====
(function bindNcOwner() {
  const input = document.querySelector("#ncOwner");
  const box = document.querySelector("#ncOwnerSuggest");
  if (!input || !box) return;
  function render() {
    const q = input.value.trim();
    const list = employeeRoster().filter((n) => !q || searchMatches(q, [n]));
    box.innerHTML = list.length
      ? list.map((n) => `<button type="button" class="viewer-suggest-item" data-nc-owner="${escapeHtml(n)}"><strong>${escapeHtml(n)}</strong></button>`).join("")
      : `<div class="viewer-suggest-empty">无匹配员工</div>`;
    box.classList.remove("hidden");
  }
  input.addEventListener("focus", render);
  input.addEventListener("input", render);
  box.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-nc-owner]");
    if (!pick) return;
    input.value = pick.dataset.ncOwner;
    box.classList.add("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#ncOwner") && !e.target.closest("#ncOwnerSuggest")) box.classList.add("hidden");
  });
})();

// ================= 客户端：我的花型库（已交付） =================
function customerOwnsOrder(o, company) {
  const mine = String(company || "").trim().toLowerCase();
  return !!mine && String(o.customer || "").trim().toLowerCase() === mine;
}
function customerDeliveredFiles(company) {
  const files = new Set();
  (studioOrders || []).forEach((o) => {
    if (orderDeliverStatus(o) === "已交付" && customerOwnsOrder(o, company)) {
      orderPatternList(o).forEach((f) => files.add(f));
    }
  });
  return [...files];
}
/** 已付款但尚未交付 -> 花型已属于客户，但处于「待解锁」状态 */
function customerLockedFiles(company) {
  const delivered = new Set(customerDeliveredFiles(company));
  const locked = new Map(); // file -> orderId
  (studioOrders || []).forEach((o) => {
    if (o.paymentStatus === "已支付" && orderDeliverStatus(o) !== "已交付" && customerOwnsOrder(o, company)) {
      orderPatternList(o).forEach((f) => { if (!delivered.has(f)) locked.set(f, o.id); });
    }
  });
  return locked;
}
/** 被「独家 / 买断」售出的花型 —— 只有这种才真正下架；非独家可继续售卖。
 *  授权类型由管理员在订单上设置，因此下架与否完全由管理员决定。 */
function exclusivelySoldFiles() {
  const set = new Set();
  (studioOrders || []).forEach((o) => {
    if (o.paymentStatus !== "已支付") return;
    const lic = String(o.licenseType || "");
    if (lic.includes("独家") && !lic.includes("非独家")) orderPatternList(o).forEach((f) => set.add(f));
    else if (lic.includes("买断")) orderPatternList(o).forEach((f) => set.add(f));
  });
  return set;
}

/** 客户已购买（含待解锁）的全部花型 —— 用于客户档案与购买记录统计 */
function customerPurchasedFiles(company) {
  const set = new Set(customerDeliveredFiles(company));
  customerLockedFiles(company).forEach((_id, f) => set.add(f));
  return set;
}

const CUSTOMER_LIBRARY_STATE_KEY = "studio_site_customer_library_state_v1";
let myLibraryUnlockNoticeTimer = 0;
let recentLibraryUnlock = { company: "", files: [], until: 0 };
const MY_LIBRARY_BATCH = 24;
let myLibraryRenderLimit = MY_LIBRARY_BATCH;
function readCustomerLibraryState() {
  try {
    const value = JSON.parse(localStorage.getItem(CUSTOMER_LIBRARY_STATE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
function writeCustomerLibraryState(value) {
  try { localStorage.setItem(CUSTOMER_LIBRARY_STATE_KEY, JSON.stringify(value)); } catch {}
  if (typeof saveStudioState === "function") saveStudioState();
}

function renderMyPatternLibrary(reset = false) {
  const grid = document.querySelector("#myLibraryGrid");
  if (!grid) return;
  if (reset) myLibraryRenderLimit = MY_LIBRARY_BATCH;
  const company = currentAccount.company || currentAccount.name || "";
  const title = document.querySelector("#myLibraryTitle");
  if (title) title.textContent = "我的花型库";
  const files = customerDeliveredFiles(company);
  const locked = customerLockedFiles(company);
  const libraryState = readCustomerLibraryState();
  const previousState = libraryState[company];
  const previouslyLocked = new Set(previousState?.locked || []);
  const newlyUnlocked = previousState
    ? files.filter((file) => previouslyLocked.has(file))
    : [];
  if (newlyUnlocked.length) {
    recentLibraryUnlock = { company, files: [...newlyUnlocked], until: Date.now() + 6000 };
  }
  const visibleUnlocks = recentLibraryUnlock.company === company && recentLibraryUnlock.until > Date.now()
    ? recentLibraryUnlock.files.filter((file) => files.includes(file))
    : newlyUnlocked;
  libraryState[company] = { delivered: [...files], locked: [...locked.keys()] };
  writeCustomerLibraryState(libraryState);
  const newlyUnlockedSet = new Set(visibleUnlocks);
  const unlockNotice = document.querySelector("#myLibraryUnlockNotice");
  if (unlockNotice) {
    clearTimeout(myLibraryUnlockNoticeTimer);
    unlockNotice.classList.toggle("hidden", visibleUnlocks.length === 0);
    unlockNotice.textContent = visibleUnlocks.length
      ? `${visibleUnlocks.length} 款花型已完成交付，现在可以预览和下载。`
      : "";
  }
  const lockIcon = `<svg class="mylib-lock-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/><circle cx="12" cy="15.4" r="1.5"/></svg>`;
  const cell = (f, isLocked, orderId, unlockIndex = -1) => {
    const card = sourceCardByFile(f);
    const previewSrc = cardPreviewSource(card);
    const imageKey = card?.dataset.imageKey || "";
    const imageMarkup = previewSrc
      ? `<img src="${escapeHtml(previewSrc)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`
      : imageKey
        ? `<img data-image-key="${escapeHtml(imageKey)}" alt="" width="600" height="800" loading="lazy" decoding="async" fetchpriority="low" />`
        : "";
    const colors = Number(card?.dataset.colors || 1);
    const name = card?.querySelector(".work-head strong")?.textContent.trim() || f;
    const justUnlocked = !isLocked && newlyUnlockedSet.has(f);
    return `<button class="mylib-card ${isLocked ? "locked" : ""} ${justUnlocked ? "just-unlocked" : ""}" type="button" ${justUnlocked ? `style="--unlock-index:${unlockIndex}"` : ""} ${isLocked ? `disabled aria-disabled="true" title="等待交付后解锁"` : `data-mylib-file="${escapeHtml(f)}"`}>
      <span class="mylib-thumb" data-image-shell>${imageMarkup}${isLocked ? `<span class="mylib-lock">${lockIcon}<small>等待交付解锁</small></span>` : ""}</span>
      <span class="mylib-info"><strong>${escapeHtml(name)}</strong><small>${isLocked ? "已购买 · 待解锁" : `${colors} 配色`}</small></span>
    </button>`;
  };
  const deliveredFiles = [...visibleUnlocks, ...files.filter((file) => !newlyUnlockedSet.has(file))];
  const entries = [
    ...[...locked.keys()].map((file) => ({ file, locked: true, orderId: locked.get(file) })),
    ...deliveredFiles.map((file) => ({ file, locked: false, orderId: "" })),
  ];
  const visibleEntries = entries.slice(0, myLibraryRenderLimit);
  const html = visibleEntries.map((entry) => cell(entry.file, entry.locked, entry.orderId, visibleUnlocks.indexOf(entry.file))).join("");
  grid.innerHTML = html
    ? `${html}${visibleEntries.length < entries.length
      ? `<button class="gallery-auto-load-sentinel" type="button" data-gallery-auto-load data-mylib-load-more tabindex="-1" aria-hidden="true"></button>`
      : ""}`
    : `<p class="empty-state">还没有属于你的花型。完成付款后，购买的花型会出现在这里。</p>`;
  hydrateLazyKeyImages(grid);
  observeGalleryAutoLoad(grid);
  // 客户已看过交付
  if (files.length) {
    studioOrders.forEach((o) => { if (customerOwnsOrder(o, company) && orderDeliverStatus(o) === "已交付") o.customerSeenDelivery = true; });
  }
  updateSidebarBadges();
}
document.querySelector("#myLibraryGrid")?.addEventListener("click", (e) => {
  if (e.target.closest("[data-mylib-load-more]")) {
    myLibraryRenderLimit += MY_LIBRARY_BATCH;
    renderMyPatternLibrary();
    return;
  }
  const c = e.target.closest("[data-mylib-file]");
  if (!c) return;
  openCustomerPatternViewer(c.dataset.mylibFile);
});

/* 客户端花型查看器：沿用大图 + 右侧资料结构，仅开放客户需要的信息 */
function openCustomerPatternViewer(file, options = {}) {
  const card = sourceCardByFile(file);
  if (!card) return;
  const isLocked = Boolean(options.locked);
  const previewOnly = Boolean(options.previewOnly);
  const contextFiles = [...new Set(Array.isArray(options.contextFiles) ? options.contextFiles : [file])]
    .filter((item) => sourceCardByFile(item));
  const contextIndex = Math.max(0, contextFiles.indexOf(file));
  let ov = document.getElementById("custPatternViewer");
  if (!ov) {
    const st = document.createElement("style");
    st.textContent = `
      #custPatternViewer{z-index:1600}
      #custPatternViewer.open{display:flex;opacity:1}
      #custPatternViewer .cpv-main{position:relative;background-color:transparent}
      #custPatternViewer .cpv-main.locked:after{content:"预览图 · 交付后可下载源文件";position:absolute;right:12px;bottom:12px;
        padding:6px 10px;border-radius:7px;background:rgba(20,18,16,.72);color:#fff;font-size:11px;letter-spacing:.03em}
      #custPatternViewer .cpv-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px}
      #custPatternViewer .cpv-name-wrap{min-width:0;flex:1}
      #custPatternViewer .cpv-name{margin:0;overflow-wrap:anywhere;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
        font-size:20px;line-height:1.3;cursor:text}
      #custPatternViewer .cpv-name:hover:after{content:"  点击修改";color:rgba(255,255,255,.42);font-size:11px;font-weight:400}
      #custPatternViewer .cpv-name.readonly{cursor:default}
      #custPatternViewer .cpv-name.readonly:hover:after{content:""}
      #custPatternViewer .cpv-name[contenteditable="true"]{outline:none;border-bottom:1px solid rgba(255,255,255,.6)}
      #custPatternViewer .cpv-code{display:block;margin-top:8px;color:rgba(255,255,255,.48);font-size:12px}
      #custPatternViewer .cpv-section{margin-top:12px;border-top:1px solid rgba(255,255,255,.12);padding-top:12px}
      #custPatternViewer .cpv-section h4{margin:0 0 8px;font-size:14px}
      #custPatternViewer .cpv-tags{display:flex;gap:8px;flex-wrap:wrap}
      #custPatternViewer .cpv-tag{padding:6px 10px;border:1px solid rgba(255,255,255,.16);border-radius:6px;
        background:rgba(255,255,255,.07);color:rgba(255,255,255,.86);font-size:12px}
      #custPatternViewer .cpv-file{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;padding:12px 14px;
        border:1px solid rgba(255,255,255,.16);border-radius:8px;background:rgba(255,255,255,.06);cursor:pointer}
      #custPatternViewer .cpv-file+.cpv-file{margin-top:8px}
      #custPatternViewer .cpv-file span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,.72);font-size:13px}
      #custPatternViewer .cpv-file b{color:#9bc9ff;font-size:13px}
      #custPatternViewer .cpv-empty{margin:0;color:rgba(255,255,255,.48);font-size:13px}`;
    document.head.appendChild(st);
    ov = document.createElement("div");
    ov.id = "custPatternViewer";
    ov.className = "lightbox";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.innerHTML = `<button class="lightbox-close cpv-x" data-cpv-close aria-label="关闭预览">×</button>
      <div class="lightbox-content cpv-shell" id="cpvBox"></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-cpv-close]")) {
        ov._cpvResizeObserver?.disconnect();
        ov.classList.remove("open", "active");
        lockBodyScroll(false);
      }
    });
  }
  // 每次重新打开作品时从完整资料视角开始，避免上一张作品的全屏状态残留。
  ov.classList.remove("info-hidden");
  const name = card.querySelector(".work-head strong")?.textContent.trim() || file;
  const main = cardPreviewSource(card);
  const workImages = previewWorkImageEntries(card);
  let palette = [];
  try { palette = JSON.parse(card.dataset.paletteKeys || "[]"); } catch {}
  const variants = [...new Set((palette.length ? palette : [card.dataset.imageKey]).filter(Boolean))];
  const variantThumbs = getPaletteThumbKeys(card);
  const tags = (card.dataset.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  const customWork = isCurrentCustomerCustomWork(card);
  const sourceFiles = getSourceFiles(card);
  const deliveryFiles = sourceFiles;
  const box = document.getElementById("cpvBox");
  const prevIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"></path></svg>';
  const nextIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"></path></svg>';
  const workNavigationVisible = contextFiles.length > 1;
  box.innerHTML = `<figure class="lightbox-figure cpv-stage">
      <div class="lightbox-image has-image cpv-main ${isLocked ? "locked" : ""}" id="cpvMain">
        <span class="color-count customer-preview-count" id="cpvMediaCount">图片 1 / ${workImages.length || 1}</span>
        ${customWork ? '<span class="customer-custom-badge">定制</span>' : ""}
      </div>
      <div class="lightbox-image-nav">
        ${workNavigationVisible ? `<button class="lightbox-nav lightbox-prev cpv-nav cpv-prev" type="button" data-cpv-work-shift="-1" aria-label="上一件作品">${prevIcon}</button>` : ""}
        ${workNavigationVisible ? `<button class="lightbox-nav lightbox-next cpv-nav cpv-next" type="button" data-cpv-work-shift="1" aria-label="下一件作品">${nextIcon}</button>` : ""}
      </div>
      <div class="lightbox-zoom-controls cpv-zoom-controls" aria-label="图片缩放">
        <button type="button" data-cpv-zoom="out" aria-label="缩小图片">−</button>
        <button class="lightbox-zoom-level" type="button" data-cpv-zoom="reset" aria-label="恢复原始大小">100%</button>
        <button type="button" data-cpv-zoom="in" aria-label="放大图片">＋</button>
      </div>
    </figure>
    <aside class="lightbox-side cpv-side">
      <div class="cpv-side-scroll" id="cpvSideScroll">
        <div class="cpv-head"><div class="cpv-name-wrap"><h3 class="cpv-name ${previewOnly ? "readonly" : ""}" id="cpvName" ${previewOnly ? "" : 'title="点击修改名称"'}>${escapeHtml(name)}</h3>
          <span class="cpv-code">花型编号 ${escapeHtml(file)}</span></div></div>
        <section class="cpv-section"><h4>标签</h4><div class="cpv-tags">${tags.length
          ? tags.map((tag) => `<span class="cpv-tag">${escapeHtml(tag)}</span>`).join("")
          : `<p class="cpv-empty">未设置标签</p>`}</div></section>
        <section class="palette-panel work-image-panel cpv-media-panel">
          <div class="panel-head">
            <h3>图片</h3>
            <div class="palette-panel-actions"><span>共 ${workImages.length || 1} 张图片</span></div>
          </div>
          <div class="palette-options" id="cpvImages"></div>
        </section>
        <section class="palette-panel cpv-media-panel">
          <div class="panel-head">
            <h3>其他配色</h3>
            <div class="palette-panel-actions"><span>共 ${variants.length || 1} 个配色</span></div>
          </div>
          <div class="palette-options" id="cpvColors"></div>
        </section>
        ${previewOnly ? "" : `<section class="cpv-section"><h4>源文件</h4>${!isLocked && deliveryFiles.length
          ? deliveryFiles.map((source, index) => `<button class="cpv-file" type="button" data-cpv-source="${index}"><span>${escapeHtml(source.name || `源文件 ${index + 1}`)}</span><b>下载</b></button>`).join("")
          : `<p class="cpv-empty">${isLocked ? "交付完成后可下载源文件" : "未上传源文件"}</p>`}</section>`}
      </div>
      ${previewOnly ? `<button class="cpv-cart-action${libraryCart.has(file) ? " selected" : ""}" type="button" data-cpv-add-cart>${libraryCart.has(file) ? "已加入选稿车" : "加入选稿车"}</button>` : ""}
    </aside>`;
  let activeCustomerMediaKind = "image";
  let activeCustomerImageIndex = 0;
  let activeVariantIndex = 0;
  const mainElement = box.querySelector("#cpvMain");
  const mediaCountElement = box.querySelector("#cpvMediaCount");
  const stageElement = box.querySelector(".cpv-stage");
  const zoomLevelElement = box.querySelector(".cpv-zoom-controls .lightbox-zoom-level");
  let customerPreviewZoom = 1;
  let customerPreviewOffsetX = 0;
  let customerPreviewOffsetY = 0;
  let customerPreviewDrag = null;
  const applyCustomerPreviewZoom = () => {
    if (!mainElement) return;
    mainElement.style.transform = `matrix(${customerPreviewZoom}, 0, 0, ${customerPreviewZoom}, ${customerPreviewOffsetX}, ${customerPreviewOffsetY})`;
    mainElement.dataset.zoomed = customerPreviewZoom > 1.01 ? "true" : "false";
    mainElement.style.cursor = customerPreviewZoom > 1.01 ? "grab" : "zoom-in";
    if (zoomLevelElement) zoomLevelElement.textContent = `${Math.round(customerPreviewZoom * 100)}%`;
  };
  const setCustomerPreviewZoom = (nextZoom) => {
    customerPreviewZoom = Math.min(4, Math.max(1, nextZoom));
    if (customerPreviewZoom <= 1.001) {
      customerPreviewZoom = 1;
      customerPreviewOffsetX = 0;
      customerPreviewOffsetY = 0;
    }
    applyCustomerPreviewZoom();
  };
  const resetCustomerPreviewZoom = () => {
    customerPreviewZoom = 1;
    customerPreviewOffsetX = 0;
    customerPreviewOffsetY = 0;
    applyCustomerPreviewZoom();
  };
  const setPreviewSource = (src) => {
    if (!src || !mainElement) return;
    mainElement.style.backgroundImage = `url(${JSON.stringify(src)})`;
    resetCustomerPreviewZoom();
  };
  ov._cpvResizeObserver?.disconnect();
  ov._cpvResizeObserver = null;
  const renderCustomerMediaOptions = () => {
    const imageOptions = box.querySelector("#cpvImages");
    const colorOptions = box.querySelector("#cpvColors");
    if (imageOptions) {
      imageOptions.innerHTML = "";
      workImages.forEach((entry, index) => {
        const purpose = uploadPurposeLabel(normalizeUploadPurposeValue(entry.purpose, index === 0 ? "主图" : `补充图 ${index + 1}`));
        imageOptions.appendChild(createPreviewMediaOption({
          label: purpose,
          active: activeCustomerMediaKind === "image" && index === activeCustomerImageIndex,
          loadThumbnail: (thumb) => resolveWorkImageEntry(entry).then((src) => {
            if (src && thumb.isConnected) thumb.style.backgroundImage = `url(${JSON.stringify(src)})`;
          }),
          onSelect: () => activateImage(index),
        }));
      });
    }
    if (colorOptions) {
      colorOptions.innerHTML = "";
      variants.forEach((key, index) => {
        colorOptions.appendChild(createPreviewMediaOption({
          label: index === 0 ? "主配色" : getPaletteFiles(card)[index]?.name || `配色 ${index + 1}`,
          active: activeCustomerMediaKind === "palette" && index === activeVariantIndex,
          loadThumbnail: (thumb) => resolveImageSource(variantThumbs[index] || key).then((src) => {
            if (src && thumb.isConnected) thumb.style.backgroundImage = `url(${JSON.stringify(src)})`;
          }),
          onSelect: () => activateVariant(index),
        }));
      });
    }
  };
  const activateImage = async (index) => {
    if (!workImages.length) return;
    activeCustomerMediaKind = "image";
    activeCustomerImageIndex = (index + workImages.length) % workImages.length;
    renderCustomerMediaOptions();
    if (mediaCountElement) mediaCountElement.textContent = `图片 ${activeCustomerImageIndex + 1} / ${workImages.length}`;
    const src = await resolveWorkImageEntry(workImages[activeCustomerImageIndex], { preferOriginal: true });
    if (src) setPreviewSource(src);
  };
  const activateVariant = async (index) => {
    if (!variants.length) return;
    activeCustomerMediaKind = "palette";
    activeVariantIndex = (index + variants.length) % variants.length;
    const key = variants[activeVariantIndex];
    renderCustomerMediaOptions();
    if (mediaCountElement) mediaCountElement.textContent = `配色 ${activeVariantIndex + 1} / ${variants.length}`;
    const src = await resolveImageSource(key);
    if (src) setPreviewSource(src);
  };
  if (main) setPreviewSource(main);
  renderCustomerMediaOptions();
  activateImage(0).catch(() => {});
  const switchCustomerPreviewWork = (shift) => {
    if (contextFiles.length < 2) return;
    const nextIndex = (contextIndex + shift + contextFiles.length) % contextFiles.length;
    openCustomerPatternViewer(contextFiles[nextIndex], { ...options, contextFiles });
  };
  box.querySelectorAll("[data-cpv-work-shift]").forEach((button) => {
    button.addEventListener("click", () => {
      switchCustomerPreviewWork(Number(button.dataset.cpvWorkShift || 0));
    });
  });
  box.querySelector(".cpv-zoom-controls")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cpv-zoom]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.cpvZoom === "reset") resetCustomerPreviewZoom();
    else setCustomerPreviewZoom(customerPreviewZoom + (button.dataset.cpvZoom === "in" ? 0.5 : -0.5));
  });
  stageElement?.addEventListener("wheel", (event) => {
    event.preventDefault();
    setCustomerPreviewZoom(customerPreviewZoom * Math.exp(-event.deltaY * (event.ctrlKey ? 0.012 : 0.0035)));
  }, { passive: false });
  mainElement?.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    ov.classList.toggle("info-hidden");
    resetCustomerPreviewZoom();
  });
  if (box._cpvDoubleClickHandler) box.removeEventListener("dblclick", box._cpvDoubleClickHandler);
  box._cpvDoubleClickHandler = (event) => {
    if (!event.target.closest(".cpv-media-panel .palette-option")) return;
    event.preventDefault();
    event.stopPropagation();
    ov.classList.add("info-hidden");
    resetCustomerPreviewZoom();
  };
  box.addEventListener("dblclick", box._cpvDoubleClickHandler);
  mainElement?.addEventListener("pointerdown", (event) => {
    if (customerPreviewZoom <= 1.01) return;
    event.preventDefault();
    customerPreviewDrag = { x: event.clientX, y: event.clientY, offsetX: customerPreviewOffsetX, offsetY: customerPreviewOffsetY };
    mainElement.setPointerCapture(event.pointerId);
    mainElement.style.cursor = "grabbing";
  });
  mainElement?.addEventListener("pointermove", (event) => {
    if (!customerPreviewDrag) return;
    event.preventDefault();
    customerPreviewOffsetX = customerPreviewDrag.offsetX + event.clientX - customerPreviewDrag.x;
    customerPreviewOffsetY = customerPreviewDrag.offsetY + event.clientY - customerPreviewDrag.y;
    applyCustomerPreviewZoom();
  });
  const finishCustomerPreviewDrag = () => {
    customerPreviewDrag = null;
    if (mainElement) mainElement.style.cursor = customerPreviewZoom > 1.01 ? "grab" : "zoom-in";
  };
  mainElement?.addEventListener("pointerup", finishCustomerPreviewDrag);
  mainElement?.addEventListener("pointercancel", finishCustomerPreviewDrag);
  if (ov._cpvKeyHandler) document.removeEventListener("keydown", ov._cpvKeyHandler);
  ov._cpvKeyHandler = (event) => {
    if (!ov.classList.contains("open")) return;
    if (event.key === "Escape") {
      ov.classList.remove("open", "active");
      lockBodyScroll(false);
      return;
    }
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const shift = event.key === "ArrowLeft" ? -1 : 1;
    switchCustomerPreviewWork(shift);
  };
  document.addEventListener("keydown", ov._cpvKeyHandler);
  box.querySelectorAll("[data-cpv-source]").forEach((button) => {
    button.addEventListener("click", async () => {
      const source = deliveryFiles[Number(button.dataset.cpvSource)];
      if (source?.key) await downloadStoredFile(source.key, source.name);
      else showToast("未上传源文件。", "warning");
    });
  });
  box.querySelector("[data-cpv-add-cart]")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    if (libraryCart.has(file)) {
      libraryCart.delete(file);
      renderLibraryCart();
      if (viewerLibraryModeActive()) renderLibraryGrid();
      syncVlibGalleryAfterCartChange(file);
      button.textContent = "加入选稿车";
      button.classList.remove("selected");
      showToast(`${file} 已移出选稿车。`, "success");
      return;
    }
    addLibraryCart(file);
    button.textContent = "已加入选稿车";
    button.classList.add("selected");
  });
  const nameElement = box.querySelector("#cpvName");
  if (!previewOnly) nameElement?.addEventListener("click", () => {
    if (nameElement.isContentEditable) return;
    const previous = nameElement.textContent.trim();
    nameElement.contentEditable = "true";
    nameElement.focus();
    const range = document.createRange();
    range.selectNodeContents(nameElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const commit = () => {
      const next = nameElement.textContent.trim();
      nameElement.contentEditable = "false";
      if (!next) {
        nameElement.textContent = previous;
        return;
      }
      const cardTitle = card.querySelector(".work-head strong");
      if (cardTitle) cardTitle.textContent = next;
      nameElement.textContent = next;
      saveStudioState();
      renderMyPatternLibrary();
      showToast("花型名称已更新。", "success");
    };
    nameElement.addEventListener("blur", commit, { once: true });
    nameElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        nameElement.blur();
      }
      if (event.key === "Escape") {
        nameElement.textContent = previous;
        nameElement.blur();
      }
    }, { once: true });
  });
  ov.classList.add("open", "active");
  lockBodyScroll(true);
}

/* ================= 团队资源库 ================= */
function resourceTypeMeta(resource) {
  if (resource.type === "link") return { icon: "↗", label: "常用网站" };
  const ext = String(resource.name || "").split(".").pop()?.toUpperCase() || "文件";
  return { icon: ext.slice(0, 4), label: resource.mime?.startsWith("image/") ? "灵感参考" : ext };
}

function resourceFolderName(folderId) {
  return resourceFolders.find((folder) => folder.id === folderId)?.name || "未分类";
}

function resourceFolderOptions(selectedId = "") {
  return `<option value="" ${selectedId ? "" : "selected"}>未分类</option>`
    + resourceFolders.map((folder) => `<option value="${escapeHtml(folder.id)}" ${folder.id === selectedId ? "selected" : ""}>${escapeHtml(folder.name)}</option>`).join("");
}

function canManageResourceLibrary() {
  return currentAccount.role === "管理员";
}

function syncResourceLibraryPermissions() {
  const readOnly = !canManageResourceLibrary();
  [document.querySelector("#resourceNewFolder"), document.querySelector("#resourceUploadMenuButton")].forEach((button) => {
    if (!button) return;
    button.hidden = readOnly;
    button.classList.toggle("hidden", readOnly);
  });
  document.querySelector("#resources")?.classList.toggle("resource-readonly", readOnly);
  if (readOnly) toggleResourceComposer("", false);
}

function resourceCardHtml(resource) {
  const meta = resourceTypeMeta(resource);
  const actionLabel = resource.type === "link" ? "打开网站" : "下载";
  const displayName = resource.type === "link" ? resource.title : (resource.name || resource.title);
  const previewClass = resource.type === "link" ? "is-link" : resource.mime?.startsWith("image/") ? "is-image" : "is-file";
  const canManage = canManageResourceLibrary();
  return `<article class="resource-card${canManage ? "" : " is-readonly"}" data-resource-id="${escapeHtml(resource.id)}">
    <button class="resource-card-preview ${previewClass}" type="button" data-resource-open="${escapeHtml(resource.id)}" ${resource.key && resource.mime?.startsWith("image/") ? `data-resource-preview-key="${escapeHtml(resource.key)}"` : ""} aria-label="${actionLabel} ${escapeHtml(displayName)}">
      <span class="resource-type-icon">${escapeHtml(meta.icon)}</span>
      ${resource.type === "link" ? `<small>${escapeHtml((() => { try { return new URL(resource.url).hostname.replace(/^www\./, ""); } catch { return resource.url || "网站"; } })())}</small>` : ""}
    </button>
    <div class="resource-card-copy">
      ${canManage
        ? `<button class="resource-card-name" type="button" data-resource-rename="${escapeHtml(resource.id)}" title="点击修改名称">${escapeHtml(displayName)}</button>`
        : `<strong class="resource-card-name">${escapeHtml(displayName)}</strong>`}
      <small>${escapeHtml(meta.label)}</small>
    </div>
    <div class="resource-card-tools">
      ${resource.type === "file" ? `<button class="resource-download" type="button" data-resource-download="${escapeHtml(resource.id)}" aria-label="下载 ${escapeHtml(displayName)}" title="下载"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 17v3h14v-3"></path></svg></button>` : ""}
      ${canManage ? `<button class="resource-delete" type="button" data-resource-delete="${escapeHtml(resource.id)}" aria-label="删除 ${escapeHtml(resource.title)}">×</button>
      <select data-resource-move="${escapeHtml(resource.id)}" aria-label="移动资源到文件夹">${resourceFolderOptions(resource.folderId)}</select>` : ""}
    </div>
  </article>`;
}

async function openResourceImagePreview(resource) {
  const source = await getImageFromDB(resource?.key);
  if (!source) { showToast("图片暂时无法读取。", "error"); return; }
  let overlay = document.querySelector("#resourceImagePreview");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "resourceImagePreview";
    overlay.className = "resource-image-preview";
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<button class="resource-preview-backdrop" type="button" data-resource-preview-close aria-label="关闭预览"></button><figure><img src="${escapeHtml(source)}" alt="${escapeHtml(resource.name || resource.title)}" width="800" height="600"><figcaption><strong>${escapeHtml(resource.name || resource.title)}</strong><button type="button" data-resource-download="${escapeHtml(resource.id)}">下载</button></figcaption><button class="resource-preview-close" type="button" data-resource-preview-close aria-label="关闭预览">×</button></figure>`;
  overlay.classList.add("active");
  lockBodyScroll(true);
}

function closeResourceImagePreview() {
  document.querySelector("#resourceImagePreview")?.classList.remove("active");
  lockBodyScroll(false);
}

function beginResourceRename(resource, button) {
  if (!resource || !button || button.querySelector("input")) return;
  const previous = resource.type === "link" ? resource.title : (resource.name || resource.title);
  const input = document.createElement("input");
  input.className = "resource-name-editor";
  input.value = previous;
  button.textContent = "";
  button.appendChild(input);
  input.focus();
  input.select();
  let complete = false;
  const finish = (save) => {
    if (complete) return;
    complete = true;
    const next = input.value.trim();
    if (save && next) {
      if (resource.type === "link") resource.title = next;
      else {
        const extension = String(resource.name || "").match(/\.[^.]+$/)?.[0] || "";
        resource.name = extension && !next.toLowerCase().endsWith(extension.toLowerCase()) ? `${next}${extension}` : next;
        resource.title = resource.name.replace(/\.[^.]+$/, "") || resource.name;
      }
      saveStudioState();
    }
    renderResourceLibrary();
  };
  input.addEventListener("blur", () => finish(true), { once: true });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
}

async function hydrateResourcePreviews(root) {
  const previews = [...(root?.querySelectorAll("[data-resource-preview-key]") || [])];
  await Promise.all(previews.map(async (preview) => {
    const dataUrl = await getImageFromDB(preview.dataset.resourcePreviewKey);
    if (!dataUrl || !preview.isConnected) return;
    preview.style.backgroundImage = `url("${String(dataUrl).replace(/"/g, "%22")}")`;
    preview.classList.add("loaded");
  }));
}

function renderResourceLibrary() {
  const folderList = document.querySelector("#resourceFolderList");
  const grid = document.querySelector("#resourceGrid");
  if (!folderList || !grid) return;
  syncResourceLibraryPermissions();
  if (activeResourceFolder !== "all" && !resourceFolders.some((folder) => folder.id === activeResourceFolder)) activeResourceFolder = "all";
  const canManage = canManageResourceLibrary();
  folderList.innerHTML = `
    ${resourceFolders.map((folder) => {
      return `<div class="resource-folder-entry"><button class="resource-folder-row ${activeResourceFolder === folder.id ? "active" : ""}" type="button" data-resource-folder="${escapeHtml(folder.id)}"><span>${escapeHtml(folder.name)}</span></button>${canManage ? `<button class="resource-folder-delete" type="button" data-resource-folder-delete="${escapeHtml(folder.id)}" aria-label="删除文件夹 ${escapeHtml(folder.name)}">×</button>` : ""}</div>`;
    }).join("") || `<p class="resource-sidebar-empty">暂无文件夹</p>`}`;
  const folderCount = document.querySelector("#resourceFolderCount");
  if (folderCount) folderCount.textContent = String(resourceFolders.length);
  const currentTitle = activeResourceFolder === "all" ? "资源" : resourceFolderName(activeResourceFolder);
  const title = document.querySelector("#resourceCurrentTitle");
  if (title) title.textContent = currentTitle;
  const keyword = resourceSearchText.trim().toLowerCase();
  const resources = teamResources
    .filter((resource) => activeResourceFolder === "all"
      || resource.folderId === activeResourceFolder)
    .filter((resource) => !keyword || searchMatches(keyword, [resource.title, resource.name, resource.url]))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const count = document.querySelector("#resourceResultCount");
  if (count) count.textContent = `${resources.length} 项`;
  const dropCard = canManage ? `<button class="resource-drop-card" type="button" data-resource-drop-upload><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5m0 0L8 9m4-4 4 4M5 15v4h14v-4"/></svg><span>拖拽文件到这里</span><small>或点击选择文件</small></button>` : "";
  grid.innerHTML = dropCard + resources.map(resourceCardHtml).join("");
  hydrateResourcePreviews(grid);
  const websiteFolder = document.querySelector("#resourceWebsiteFolder");
  if (websiteFolder) websiteFolder.innerHTML = resourceFolderOptions(activeResourceFolder === "all" ? "" : activeResourceFolder);
}

function toggleResourceComposer(id, show) {
  ["resourceFolderComposer", "resourceWebsiteComposer"].forEach((composerId) => {
    const composer = document.getElementById(composerId);
    if (composer) composer.classList.toggle("hidden", !(show && composerId === id));
  });
  if (show) requestAnimationFrame(() => document.querySelector(`#${id} input`)?.focus());
}

async function openTeamResource(resource) {
  if (!resource) return;
  if (resource.type === "link") {
    window.open(resource.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (resource.mime?.startsWith("image/")) {
    await openResourceImagePreview(resource);
    return;
  }
  const dataUrl = await getImageFromDB(resource.key);
  if (!dataUrl) {
    showToast("资源文件暂时无法读取。", "error");
    return;
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = resource.name || resource.title || "团队资源";
  link.click();
}

function createResourceFolder() {
  if (!canManageResourceLibrary()) return;
  const input = document.querySelector("#resourceFolderName");
  const name = input?.value.trim();
  if (!name) {
    showToast("请先输入文件夹名称。", "warning");
    input?.focus();
    return;
  }
  if (resourceFolders.some((folder) => folder.name === name)) {
    showToast("已经有同名文件夹。", "warning");
    return;
  }
  const folder = { id: `RF-${Date.now()}`, name, createdAt: formatDateTime(), creator: currentAccount.name };
  resourceFolders.push(folder);
  activeResourceFolder = folder.id;
  if (input) input.value = "";
  toggleResourceComposer("", false);
  saveStudioState();
  renderResourceLibrary();
  showToast(`文件夹「${name}」已创建。`, "success");
}

function saveWebsiteResource() {
  if (!canManageResourceLibrary()) return;
  const nameInput = document.querySelector("#resourceWebsiteName");
  const urlInput = document.querySelector("#resourceWebsiteUrl");
  const folderInput = document.querySelector("#resourceWebsiteFolder");
  const title = nameInput?.value.trim();
  let url = urlInput?.value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  try { new URL(url); } catch { showToast("请输入有效的网站地址。", "warning"); urlInput?.focus(); return; }
  if (!title) { showToast("请填写网站名称。", "warning"); nameInput?.focus(); return; }
  teamResources.push({
    id: `RS-${Date.now()}`,
    type: "link",
    title,
    url,
    folderId: folderInput?.value || "",
    creator: currentAccount.name,
    createdAt: formatDateTime(),
  });
  if (nameInput) nameInput.value = "";
  if (urlInput) urlInput.value = "";
  toggleResourceComposer("", false);
  saveStudioState();
  renderResourceLibrary();
  showToast("网站已加入资源库。", "success");
}

async function uploadTeamResources(files) {
  if (!canManageResourceLibrary()) return;
  const accepted = acceptedUploadFiles(files, {
    label: "团队资源",
    maxBytes: MAX_RESOURCE_FILE_BYTES,
    maxCount: 20,
  });
  if (!accepted.length) return;
  await runWithAppLoading(`正在上传 ${accepted.length} 个资源…`, async () => {
    for (let index = 0; index < accepted.length; index += 1) {
      const file = accepted[index];
      const id = `RS-${Date.now()}-${index}`;
      const key = `team_resource_${id}`;
      await saveImageToDB(key, file);
      teamResources.push({
        id,
        type: "file",
        title: file.name.replace(/\.[^.]+$/, "") || file.name,
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        key,
        folderId: activeResourceFolder === "all" || activeResourceFolder === "unfiled" ? "" : activeResourceFolder,
        creator: currentAccount.name,
        createdAt: formatDateTime(),
      });
    }
    saveStudioState();
    renderResourceLibrary();
  }, 420);
  showToast(`已上传 ${accepted.length} 个团队资源。`, "success");
}

function applyIncomingSharedResourceState(raw) {
  if (!raw) return;
  let incoming;
  try { incoming = JSON.parse(raw); } catch { return; }
  const nextFolders = Array.isArray(incoming.resourceFolders) ? incoming.resourceFolders : [];
  const nextResources = Array.isArray(incoming.resources) ? incoming.resources : [];
  const changed = JSON.stringify([nextFolders, nextResources]) !== JSON.stringify([resourceFolders, teamResources]);
  if (!changed) return;
  resourceFolders = nextFolders;
  teamResources = nextResources;
  if (activeViewId() === "resources") renderResourceLibrary();
}

/* 资源库事件 */
document.querySelector("#resourceNewFolder")?.addEventListener("click", () => toggleResourceComposer("resourceFolderComposer", true));
const resourceUploadMenuButton = document.querySelector("#resourceUploadMenuButton");
const resourceUploadMenu = document.querySelector("#resourceUploadMenu");
resourceUploadMenuButton?.addEventListener("click", () => {
  if (!canManageResourceLibrary()) return;
  const open = resourceUploadMenu?.classList.toggle("hidden") === false;
  resourceUploadMenuButton.setAttribute("aria-expanded", String(open));
});
resourceUploadMenu?.addEventListener("click", (event) => {
  if (!canManageResourceLibrary()) return;
  const choice = event.target.closest("[data-resource-upload-kind]");
  if (!choice) return;
  resourceUploadMenu.classList.add("hidden");
  resourceUploadMenuButton?.setAttribute("aria-expanded", "false");
  if (choice.dataset.resourceUploadKind === "file") {
    toggleResourceComposer("", false);
    document.querySelector("#resourceFileInput")?.click();
  } else {
    renderResourceLibrary();
    toggleResourceComposer("resourceWebsiteComposer", true);
  }
});
document.addEventListener("click", (event) => {
  if (event.target.closest(".resource-upload-menu")) return;
  resourceUploadMenu?.classList.add("hidden");
  resourceUploadMenuButton?.setAttribute("aria-expanded", "false");
});
document.querySelector("#resourceFolderSave")?.addEventListener("click", createResourceFolder);
document.querySelector("#resourceFolderCancel")?.addEventListener("click", () => toggleResourceComposer("", false));
document.querySelector("#resourceWebsiteSave")?.addEventListener("click", saveWebsiteResource);
document.querySelector("#resourceWebsiteCancel")?.addEventListener("click", () => toggleResourceComposer("", false));
document.querySelector("#resourceFolderName")?.addEventListener("keydown", (event) => { if (event.key === "Enter") createResourceFolder(); });
document.querySelector("#resourceFileInput")?.addEventListener("change", async (event) => {
  await uploadTeamResources(event.target.files);
  event.target.value = "";
});
document.querySelector("#resourceSearch")?.addEventListener("input", (event) => {
  resourceSearchText = event.target.value;
  renderResourceLibrary();
});
document.querySelector("#resourceFolderList")?.addEventListener("click", (event) => {
  const folderButton = event.target.closest("[data-resource-folder]");
  if (folderButton) {
    activeResourceFolder = folderButton.dataset.resourceFolder;
    renderResourceLibrary();
    return;
  }
  const deleteButton = event.target.closest("[data-resource-folder-delete]");
  if (!deleteButton) return;
  if (!canManageResourceLibrary()) return;
  const folder = resourceFolders.find((item) => item.id === deleteButton.dataset.resourceFolderDelete);
  if (!folder) return;
  openExitConfirmation({
    title: `删除文件夹「${folder.name}」？`,
    message: "文件夹中的资源不会被删除，将统一移动到「未分类」。",
    submitText: "删除文件夹",
    onConfirm: () => {
      teamResources.forEach((resource) => { if (resource.folderId === folder.id) resource.folderId = ""; });
      resourceFolders = resourceFolders.filter((item) => item.id !== folder.id);
      if (activeResourceFolder === folder.id) activeResourceFolder = "all";
      saveStudioState();
      renderResourceLibrary();
    },
  });
});
document.querySelector("#resourceGrid")?.addEventListener("click", async (event) => {
  if (event.target.closest("[data-resource-drop-upload]")) {
    if (!canManageResourceLibrary()) return;
    document.querySelector("#resourceFileInput")?.click();
    return;
  }
  const renameButton = event.target.closest("[data-resource-rename]");
  if (renameButton) {
    if (!canManageResourceLibrary()) return;
    beginResourceRename(teamResources.find((item) => item.id === renameButton.dataset.resourceRename), renameButton);
    return;
  }
  const downloadButton = event.target.closest("[data-resource-download]");
  if (downloadButton) {
    const resource = teamResources.find((item) => item.id === downloadButton.dataset.resourceDownload);
    if (resource) await openTeamResource({ ...resource, mime: "application/octet-stream" });
    return;
  }
  const openButton = event.target.closest("[data-resource-open]");
  if (openButton) {
    await openTeamResource(teamResources.find((item) => item.id === openButton.dataset.resourceOpen));
    return;
  }
  const deleteButton = event.target.closest("[data-resource-delete]");
  if (!deleteButton) return;
  if (!canManageResourceLibrary()) return;
  const resource = teamResources.find((item) => item.id === deleteButton.dataset.resourceDelete);
  if (!resource) return;
  openExitConfirmation({
    title: `删除资源「${resource.title}」？`,
    message: "资源将从团队资源库中移除。",
    submitText: "确认删除",
    onConfirm: () => {
      teamResources = teamResources.filter((item) => item.id !== resource.id);
      saveStudioState();
      renderResourceLibrary();
    },
  });
});
document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-resource-preview-close]")) {
    closeResourceImagePreview();
    return;
  }
  const downloadButton = event.target.closest("#resourceImagePreview [data-resource-download]");
  if (!downloadButton) return;
  const resource = teamResources.find((item) => item.id === downloadButton.dataset.resourceDownload);
  if (resource) await openTeamResource({ ...resource, mime: "application/octet-stream" });
});
const resourceGridElement = document.querySelector("#resourceGrid");
resourceGridElement?.addEventListener("dragover", (event) => {
  if (!canManageResourceLibrary()) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  resourceGridElement.querySelector(".resource-drop-card")?.classList.add("is-dragover");
});
resourceGridElement?.addEventListener("dragleave", (event) => {
  if (!resourceGridElement.contains(event.relatedTarget)) resourceGridElement.querySelector(".resource-drop-card")?.classList.remove("is-dragover");
});
resourceGridElement?.addEventListener("drop", async (event) => {
  if (!canManageResourceLibrary()) return;
  event.preventDefault();
  resourceGridElement.querySelector(".resource-drop-card")?.classList.remove("is-dragover");
  await uploadTeamResources(event.dataTransfer?.files || []);
});
document.querySelector("#resourceGrid")?.addEventListener("change", (event) => {
  const select = event.target.closest("[data-resource-move]");
  if (!select) return;
  if (!canManageResourceLibrary()) return;
  const resource = teamResources.find((item) => item.id === select.dataset.resourceMove);
  if (!resource) return;
  resource.folderId = select.value;
  saveStudioState();
  renderResourceLibrary();
});

function refreshCustomerOrderViews() {
  if (currentAccount.role !== "客户") return;
  if (typeof renderMyOrders === "function") renderMyOrders();
  if (activeViewId() === "myLibrary" && typeof renderMyPatternLibrary === "function") renderMyPatternLibrary();
  updateSidebarBadges();
}

function applyIncomingCustomerOrderState(raw) {
  if (currentAccount.role !== "客户" || !raw) return false;
  let incoming;
  try { incoming = JSON.parse(raw); } catch { return false; }
  if (!Array.isArray(incoming.orders)) return false;
  const comparableOrders = (orders) => JSON.stringify((orders || []).map(({ customerSeenDelivery, ...order }) => order));
  if (comparableOrders(incoming.orders) === comparableOrders(studioOrders)) return false;
  const seenDelivery = new Set(studioOrders.filter((order) => order.customerSeenDelivery).map((order) => order.id));
  studioState = { ...studioState, ...incoming };
  lastPersistedStateJson = raw;
  studioOrders = incoming.orders.map((order) => seenDelivery.has(order.id) ? { ...order, customerSeenDelivery: true } : order);
  refreshCustomerOrderViews();
  return true;
}

function syncCustomerOrdersFromStorage(retry = true) {
  if (currentAccount.role !== "客户") return;
  if (_saveTimer) {
    if (retry) setTimeout(() => syncCustomerOrdersFromStorage(false), 380);
    return;
  }
  try { applyIncomingCustomerOrderState(localStorage.getItem(STORAGE_KEY)); } catch {}
}

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY && event.newValue) {
    applyIncomingCustomerOrderState(event.newValue);
    applyIncomingSharedResourceState(event.newValue);
  }
});
window.addEventListener("focus", () => setTimeout(() => syncCustomerOrdersFromStorage(), 80));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncCustomerOrdersFromStorage();
});
