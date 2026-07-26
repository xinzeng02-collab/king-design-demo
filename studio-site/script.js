const titleMap = {
  dashboard: "管理员总控制台",
  review: "每日稿件评审",
  projects: "项目进度",
  team: "我的团队",
  designer: "设计师个人界面",
  library: "客户中心",
  cart: "选稿车",
  orders: "订单中心",
  sleep: "稿件休眠区",
  recycle: "回收站",
  sampling: "打样管理",
};

const roleDashboardTitles = {
  管理员: "管理员总控制台",
  设计师: "设计师总控制台",
  手绘师: "手绘师总控制台",
  打样师: "打样师总控制台",
  销售: "销售总控制台",
};

const demoAccounts = {
  admin: { password: "admin123", role: "管理员", name: "管理员 / 总控", ownerKey: "admin" },
  designer: { password: "designer123", role: "设计师", name: "许然 / 设计师", ownerKey: "designer" },
  painter: { password: "painter123", role: "手绘师", name: "阿沁 / 手绘师", ownerKey: "painter" },
  sampler: { password: "sampler123", role: "打样师", name: "陈一 / 打样师", ownerKey: "sampler" },
  sales: { password: "sales123", role: "销售", name: "沈黎 / 销售", ownerKey: "sales" },
};

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
    打样师: "Sampler",
    销售: "Sales",
  };
  return map[role] || "Team";
}

function applyProfilePrefs(account) {
  const prefs = readProfilePrefs();
  const profile = prefs[account.ownerKey] || {};
  const displayName = String(profile.name || account.name || "").split("/")[0].trim();
  currentAccount.name = displayName;
  if (profileNameInput) profileNameInput.textContent = displayName;
  if (profileRoleLabel) profileRoleLabel.textContent = `${account.ownerKey} ${roleSubtitle(account.role)}`;
  if (userBadge) userBadge.textContent = displayName;
  if (!profileAvatar) return;
  profileAvatar.textContent = profile.avatar ? "" : displayInitial(displayName);
  profileAvatar.style.backgroundImage = profile.avatar ? `url("${profile.avatar}")` : "";
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
const PROFILE_KEY = "studio_site_profile_prefs_v1";
const REGISTERED_ACCOUNT_KEY = "studio_site_registered_accounts_v1";
const SESSION_KEY = "studio_site_active_account_v1";
const SESSION_ACCOUNT_DATA_KEY = "studio_site_active_account_data_v1";
const REMEMBERED_LOGIN_KEY = "studio_site_remembered_login_v1";
const PROJECT_DRAFT_KEY = "studio_site_project_drafts_v1";
const MAX_UPLOAD_FILES = 50;
const IMAGE_DB_NAME = "studio_site_design_images";
const IMAGE_DB_VERSION = 1;

function readRegisteredAccounts() {
  try {
    return JSON.parse(localStorage.getItem(REGISTERED_ACCOUNT_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeRegisteredAccounts(accounts) {
  localStorage.setItem(REGISTERED_ACCOUNT_KEY, JSON.stringify(accounts));
}

Object.assign(demoAccounts, readRegisteredAccounts());
let currentAccount = demoAccounts.admin;

const loginScreen = document.querySelector("#loginScreen");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const employeeLoginPanel = document.querySelector("#employeeLoginPanel");
const clientLoginPanel = document.querySelector("#clientLoginPanel");
const employeeRememberPassword = document.querySelector("#employeeRememberPassword");
const openClientLogin = document.querySelector("#openClientLogin");
const openEmployeeLogin = document.querySelector("#openEmployeeLogin");
const clientLoginForm = document.querySelector("#clientLoginForm");
const clientUsername = document.querySelector("#clientUsername");
const clientPassword = document.querySelector("#clientPassword");
const clientRememberPassword = document.querySelector("#clientRememberPassword");
const clientLoginError = document.querySelector("#clientLoginError");
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
const notificationButton = document.querySelector("#notificationButton");
const notificationModal = document.querySelector("#notificationModal");
const notificationClose = document.querySelector("#notificationClose");
const notificationDismiss = document.querySelector("#notificationDismiss");
const notificationList = document.querySelector("#notificationList");
const notificationMore = document.querySelector("#notificationMore");
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
const myProjectGrid = document.querySelector(".my-project-grid");
const projectTypeFilter = document.querySelector("#projectTypeFilter");
const projectTypeFilterSummary = document.querySelector("#projectTypeFilterSummary");
const teamMetrics = document.querySelector("#teamMetrics");
const teamGrid = document.querySelector("#teamGrid");
const teamRoleFilter = document.querySelector("#teamRoleFilter");
const teamStatusFilter = document.querySelector("#teamStatusFilter");
const teamSearch = document.querySelector("#teamSearch");
const teamManageButton = document.querySelector("#teamManageButton");
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
const roleSelect = document.querySelector("#roleSelect");
const roleDashboards = document.querySelectorAll("[data-role-dashboard]");
let workCards = document.querySelectorAll("[data-work-role]");
const worksTitle = document.querySelector("#worksTitle");
const worksIntro = document.querySelector("#worksIntro");
const workSort = document.querySelector("#workSort");
const workTimeFilter = document.querySelector("#workTimeFilter");
const toggleCardInfo = document.querySelector("#toggleCardInfo");
const worksUploadRow = document.querySelector("#worksUploadRow");
const libraryFilterBar = document.querySelector("#libraryFilterBar");
const librarySelectedConditions = document.querySelector("#librarySelectedConditions");
const libraryResultCount = document.querySelector("#libraryResultCount");
const worksBoard = document.querySelector(".works-board");
const recycleList = document.querySelector("#recycleList");
const recycleSearch = document.querySelector("#recycleSearch");
const recycleStatus = document.querySelector("#recycleStatus");
const recycleSort = document.querySelector("#recycleSort");
const emptyRecycle = document.querySelector("#emptyRecycle");
const sleepList = document.querySelector("#sleepList");
const sleepSearch = document.querySelector("#sleepSearch");
const sleepDesignerFilter = document.querySelector("#sleepDesignerFilter");
const sleepTagFilter = document.querySelector("#sleepTagFilter");
const sleepSort = document.querySelector("#sleepSort");
const uploadModal = document.querySelector("#uploadModal");
const uploadTypeSwitch = document.querySelector("#uploadTypeSwitch");
const uploadModalTitle = document.querySelector("#uploadModalTitle");
const uploadClose = document.querySelector("#uploadClose");
const uploadCancel = document.querySelector("#uploadCancel");
const uploadConfirm = document.querySelector("#uploadConfirm");
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
const lightboxTitle = document.querySelector("#lightboxTitle");
const lightboxMeta = document.querySelector("#lightboxMeta");
const lightboxFile = document.querySelector("#lightboxFile");
const lightboxWorkStatus = document.querySelector("#lightboxWorkStatus");
const lightboxSleepToggle = document.querySelector("#lightboxSleepToggle");
const lightboxDeleteWork = document.querySelector("#lightboxDeleteWork");
const lightboxOwner = document.querySelector("#lightboxOwner");
const lightboxProject = document.querySelector("#lightboxProject");
const lightboxTags = document.querySelector("#lightboxTags");
const lightboxTagPicker = document.querySelector("#lightboxTagPicker");
const lightboxTagOptions = document.querySelector("#lightboxTagOptions");
const lightboxClose = document.querySelector("#lightboxClose");
const lightboxExitFullscreen = document.querySelector("#lightboxExitFullscreen");
const lightboxPrev = document.querySelector("#lightboxPrev");
const lightboxNext = document.querySelector("#lightboxNext");
const lightboxReviewActions = document.querySelector("#lightboxReviewActions");
const lightboxReviewPanel = document.querySelector(".lightbox-review-panel");
const sourceFilePanel = document.querySelector("#sourceFilePanel");
const sourceFileStatus = document.querySelector("#sourceFileStatus");
const sourceFileDownloadList = document.querySelector("#sourceFileDownloadList");
const sourceFileInput = document.querySelector("#sourceFileInput");
const orderFilePanel = document.querySelector("#orderFilePanel");
const orderFileUploadButton = document.querySelector("#orderFileUploadButton");
const orderFileStateButton = document.querySelector("#orderFileStateButton");
const orderFileStatus = document.querySelector("#orderFileStatus");
const addToCartFromLightbox = document.querySelector("#addToCartFromLightbox");
const lightboxStatusList = document.querySelector("#lightboxStatusList");
const detailWorkStatus = document.querySelector("#detailWorkStatus");
const detailSaleStatus = document.querySelector("#detailSaleStatus");
const detailCustomerStatus = document.querySelector("#detailCustomerStatus");
const detailReviewStatus = document.querySelector("#detailReviewStatus");
const reviewNotePanel = document.querySelector("#reviewNotePanel");
const reviewNoteLabel = document.querySelector("#reviewNoteLabel");
const reviewNoteText = document.querySelector("#reviewNoteText");
const saveReviewNote = document.querySelector("#saveReviewNote");
const palettePanel = document.querySelector("#palettePanel");
const paletteCount = document.querySelector("#paletteCount");
const paletteOptions = document.querySelector("#paletteOptions");
const addPaletteButton = document.querySelector("#addPaletteButton");
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
let activePreviewIndex = 0;
let activeVariant = 1;
let activeReviewAction = "";
let activeReviewDate = dateKey(new Date());
let activeReviewFilter = "pending";
let activeReviewResultFilter = "all";
let activeReviewWorkType = "设计师";
let uploadWorkType = "设计师";
let activeOrderFileContext = null;
let sourceFileTargetCard = null;
let paletteFileTargetCard = null;
let paletteEditMode = false;
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
let cardInfoHidden = false;
let dragStart = null;
let deletedWorks = [];
let selectedUploadTags = [];
let selectedUploadFiles = [];
let selectedReferenceFiles = [];
let selectedSourceFiles = [];
let selectedPaletteFiles = [];
let pendingReviewConfirmation = null;
let pendingExitConfirmation = null;
let pendingExitSaveAction = null;
let lightboxCardSet = [];
const uploadFileNames = new Map();
const referenceFileNames = new Map();
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
let uploadValidationTarget = null;
let fileObjectURLs = [];
let addReferenceTargetCard = null;
let projectSearchTimer = null;
let globalSearchMatches = [];
let projectBoardOverrides = {};
let draggingProjectPayload = null;
let pendingProjectLifecycleAction = null;
let pendingProjectLifecycleFiles = [];
let studioState = {
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
};
const defaultOrders = [];
const teamMembers = [
  { name: "许然", role: "设计师", ownerKey: "designer", tone: "blue", baseLoadScore: 2, accountStatus: "正常" },
  { name: "林若", role: "设计师", ownerKey: "linruo", tone: "violet", baseLoadScore: 7, accountStatus: "正常" },
  { name: "孟夏", role: "设计师", ownerKey: "mengxia", tone: "green", baseLoadScore: 14, accountStatus: "正常" },
  { name: "阿沁", role: "手绘师", ownerKey: "painter", tone: "pink", baseLoadScore: 2, accountStatus: "正常" },
  { name: "周禾", role: "手绘师", ownerKey: "zhouhe", tone: "orange", baseLoadScore: 7, accountStatus: "正常" },
  { name: "洛川", role: "手绘师", ownerKey: "luochuan", tone: "teal", baseLoadScore: 14, accountStatus: "已停用" },
  { name: "苏叶", role: "手绘师", ownerKey: "suye", tone: "gray", baseLoadScore: 2, accountStatus: "正常" },
];
// 按角色对应的像素头像（放在 assets/avatars/ 下）；文件缺失时自动回退到首字母。
const ROLE_AVATARS = {
  "管理员": "./assets/avatars/admin.png",
  "设计师": "./assets/avatars/designer.png",
  "手绘师": "./assets/avatars/painter.png",
  "销售": "./assets/avatars/sales.png",
};
function memberAvatarInner(member) {
  const src = ROLE_AVATARS[member.role];
  const img = src ? `<img class="team-avatar-img" src="${src}" alt="" loading="lazy" onerror="this.remove()" />` : "";
  return `${img}${escapeHtml((member.name || "?").slice(0, 1))}`;
}

let teamManageMode = false;
let projectDrafts = [];
let editingDraftId = "";
let memberPickerContext = null;
let memberPickerDraft = new Set();
let memberPickerLoadFilter = "all";
const globalTags = [];

function syncRegisteredAccountsToTeam() {
  const tones = ["blue", "violet", "green", "pink", "orange", "teal", "gray"];
  Object.entries(demoAccounts).forEach(([ownerKey, account], index) => {
    const name = String(account.name || ownerKey).split("/")[0].trim() || ownerKey;
    const existing = teamMembers.find((member) => member.ownerKey === ownerKey);
    if (existing) {
      existing.name = name;
      existing.role = account.role || existing.role;
      return;
    }
    teamMembers.push({
      name,
      role: account.role || "员工",
      ownerKey,
      tone: tones[index % tones.length],
      baseLoadScore: 0,
      accountStatus: "正常",
    });
  });
}
const pendingTagApplications = [];
const retiredDefaultTags = ["花卉", "几何", "清新", "轻奢", "儿童", "秋冬", "手绘", "四件套"];
const painterLibrary = [
  {
    file: "K-NTTM0009",
    painter: "阿沁",
    title: "暖调藤蔓手绘稿",
    project: "春夏清透花卉四件套系列",
    tags: ["手绘", "藤蔓", "花卉"],
    pattern: "pattern-c",
  },
  {
    file: "K-SCZY0010",
    painter: "阿沁",
    title: "水彩枝叶元素组",
    project: "客户 A 春夏加购方案",
    tags: ["手绘", "枝叶", "清新"],
    pattern: "pattern-a",
  },
  {
    file: "K-XHSD0011",
    painter: "阿沁",
    title: "小花散点手绘稿",
    project: "自主图库补充",
    tags: ["手绘", "小花", "散点"],
    pattern: "pattern-d",
  },
  {
    file: "K-HYSD0012",
    painter: "周禾",
    title: "手绘花园散点元素",
    project: "秋冬暖调植物图库扩充",
    tags: ["手绘", "花园", "秋冬"],
    pattern: "pattern-d",
  },
];
const projectLibrary = [
  { name: "春夏清透花卉四件套系列", status: "出稿评审", members: "许然、阿沁、周禾、陈一" },
  { name: "轻奢几何客户定制项目", status: "修改复审", members: "林若、孟禾、陈一" },
  { name: "秋冬暖调植物图库扩充", status: "自主稿筛选", members: "阿沁、周禾" },
  { name: "儿童梦境系列", status: "方案制定", members: "许然、周禾" },
  { name: "蓝白瓷感客户定制项目", status: "打样确认", members: "林若、陈一" },
  { name: "客户 A 春夏加购方案", status: "客户初选", members: "许然、阿沁" },
  { name: "自主图库补充", status: "内部补库", members: "阿沁、周禾" },
];
const projectBoardStages = [
  { status: "需求确认", color: "#aab2bf" },
  { status: "概念方案", color: "#3b82f6" },
  { status: "设计制作", color: "#8b5cf6" },
  { status: "稿件评审", color: "#f59e0b" },
  { status: "修改完善", color: "#ec4899" },
  { status: "内部定稿", color: "#10b981" },
  { status: "待交付", color: "#64748b" },
  { status: "已交付", color: "#111827" },
];
const defaultBoardProjects = [];
const baseProjectNames = new Set(projectLibrary.map((item) => item.name));
let customProjects = [];
let customCustomers = [];

function syncProjectLibrary() {
  for (let index = projectLibrary.length - 1; index >= 0; index -= 1) {
    if (!baseProjectNames.has(projectLibrary[index].name)) projectLibrary.splice(index, 1);
  }
  customProjects.forEach((project) => {
    if (project.archived || project.projectResult) return;
    if (!project?.name || projectLibrary.some((item) => item.name === project.name)) return;
    projectLibrary.unshift({
      name: project.name,
      status: project.status || "新建项目",
      members: project.members || [...(project.designers || []), ...(project.painters || [])].join("、") || project.owner || "待分配",
    });
  });
}

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
        const firstImage = sourceProject.patterns?.[0]?.images?.[0] || "";
        customProjects.push({
          id: projectId,
          name: sourceProject.source === "每日新稿" ? `每日新稿 · ${sourceProject.name}` : sourceProject.name,
          customer: ["每日新稿", "往期修改", "打样"].includes(sourceProject.source) ? "非客户项目" : sourceProject.name,
          type: ["每日新稿", "往期修改", "打样"].includes(sourceProject.source) ? "内部" : "定制",
          status: sourceProject.status || "需求确认",
          files: firstImage ? [{ name: `${sourceProject.name}-项目缩略图.jpg`, type: "image/jpeg", dataUrl: firstImage, uploader: designer.name, time: "2026-07-22" }] : [],
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
          imageData: thumbs[0],
          paletteKeys: JSON.stringify(previews),
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
    configureWorksView(roleSelect.value, currentAccount.ownerKey);
    renderDailyReviewBoard();
    renderLibraryGrid();
    if (document.querySelector("#customerCenter")) renderCustomerCenter();
    renderTeamView();
  } catch (error) {
    console.warn("king测试案例载入失败", error);
  }
}

function syncCustomerOptions() {
  customCustomers.forEach((customer) => {
    if (!customer?.name) return;
    [libraryCustomer, projectCustomerSelect].forEach((select) => {
      if (!select || [...select.options].some((option) => option.value === customer.name)) return;
      select.appendChild(new Option(customer.name, customer.name));
    });
  });
}

function projectStatusClass(status) {
  if (status === "已关闭") return "closed";
  if (status === "内部定稿" || status === "待交付" || status === "已交付" || status === "定稿交付" || status === "已完成") return "done";
  if (status === "设计制作" || status === "稿件评审" || status === "执行中") return "working";
  return "waiting";
}

function normalizeProjectBoardStatus(status) {
  const map = {
    新建: "需求确认",
    策划中: "概念方案",
    方案制定: "概念方案",
    自主稿筛选: "需求确认",
    内部补库: "需求确认",
    客户初选: "需求确认",
    执行中: "设计制作",
    出稿评审: "稿件评审",
    待评审: "稿件评审",
    修改复审: "修改完善",
    打样确认: "内部定稿",
    定稿交付: "内部定稿",
    已完成: "内部定稿",
    交付准备: "待交付",
    交付完成: "已交付",
  };
  return projectBoardStages.some((stage) => stage.status === status) ? status : map[status] || "需求确认";
}

function projectStage(project) {
  return normalizeProjectBoardStatus(project?.stage || project?.status || "需求确认");
}

function setProjectStage(project, stage) {
  const normalized = normalizeProjectBoardStatus(stage);
  project.stage = normalized;
  project.status = normalized;
  return normalized;
}

function normalizeProjectLifecycleProject(project) {
  if (!project || typeof project !== "object") return project;
  setProjectStage(project, project.stage || project.status || "需求确认");
  project.projectResult = ["completed", "cancelled", "terminated"].includes(project.projectResult) ? project.projectResult : null;
  project.archived = Boolean(project.archived || project.projectResult);
  project.projectStatus = project.projectStatus === "paused" ? "paused" : "normal";
  project.deliveryStatus = project.deliveryStatus || (projectStage(project) === "已交付" ? "delivered" : "pending");
  project.deliveryFiles = Array.isArray(project.deliveryFiles) ? project.deliveryFiles : [];
  project.deliveryNote = project.deliveryNote || "";
  project.deliveryReceiver = project.deliveryReceiver || "";
  project.deliveryVersion = project.deliveryVersion || "";
  project.archiveHistory = Array.isArray(project.archiveHistory) ? project.archiveHistory : [];
  project.changeLogs = Array.isArray(project.changeLogs) ? project.changeLogs : [];
  return project;
}

function normalizeProjectLifecycleData() {
  customProjects = (customProjects || []).map(normalizeProjectLifecycleProject).filter(Boolean);
}

function projectRuntimeStatus(project) {
  if (project?.projectStatus === "paused") return "paused";
  const days = daysUntil(project?.endAt);
  if (Number.isFinite(days) && days < 0) return "overdue";
  if (Number.isFinite(days) && days >= 0 && days <= 7) return "due-soon";
  return "normal";
}

function projectStatusDisplay(project) {
  const runtimeStatus = projectRuntimeStatus(project);
  if (runtimeStatus === "paused") return { key: "paused", label: "暂停中" };
  if (runtimeStatus === "overdue") return { key: "overdue", label: `已逾期 ${Math.abs(daysUntil(project.endAt))} 天` };
  if (runtimeStatus === "due-soon") return { key: "due-soon", label: "即将到期" };
  return { key: "normal", label: "正常" };
}

const projectResultLabels = {
  completed: "已完成",
  cancelled: "已取消",
  terminated: "已终止",
};

function canManageProjectLifecycle(project) {
  if (currentAccount.role === "管理员") return true;
  const name = currentAccountDisplayName();
  return Boolean(name && ([...(project?.owners || []), ...String(project?.owner || "").split("、")].includes(name)));
}

function projectHasValidDelivery(project) {
  return project?.deliveryStatus === "delivered"
    && Boolean(project.deliveredAt)
    && Array.isArray(project.deliveryFiles)
    && project.deliveryFiles.length > 0;
}

function projectProgressWidth(status) {
  const widths = {
    需求确认: 14,
    概念方案: 25,
    设计制作: 46,
    稿件评审: 58,
    修改完善: 72,
    内部定稿: 76,
    待交付: 88,
    已交付: 100,
    定稿交付: 76,
    新建: 14,
    策划中: 25,
    执行中: 46,
    待评审: 58,
    已完成: 100,
    已关闭: 100,
  };
  return widths[status] || 12;
}

function stageColor(status) {
  return projectBoardStages.find((stage) => stage.status === normalizeProjectBoardStatus(status))?.color || "#3b82f6";
}

function currentAccountDisplayName() {
  return String(currentAccount.name || "").split("/")[0].trim();
}

function projectParticipantCanUpload(project) {
  if (currentAccount.role === "管理员") return true;
  const name = currentAccountDisplayName();
  if (!name) return false;
  if (currentAccount.role === "设计师") return (project.designers || []).includes(name);
  if (currentAccount.role === "手绘师") return (project.painters || []).includes(name);
  return false;
}

function projectVisibleForCurrentAccount(project) {
  if (currentAccount.role === "管理员") return true;
  const name = currentAccountDisplayName();
  if (!name) return false;
  if (currentAccount.role === "设计师") return (project.designers || []).includes(name) || project.owner === name;
  if (currentAccount.role === "手绘师") return (project.painters || []).includes(name) || project.owner === name;
  if (currentAccount.role === "打样师") return project.owner === name || String(project.members || "").includes(name);
  return false;
}

function projectTypeValue(project) {
  if (project.type) return project.type;
  const customer = project.customer || "";
  if (customer.includes("内部") || customer.includes("非客户")) return "内部";
  return "定制";
}

function selectedProjectTypeFilters() {
  if (!projectTypeFilter) return ["选稿", "定制", "内部"];
  return [...projectTypeFilter.querySelectorAll('input[type="checkbox"]:checked')]
    .map((input) => input.value)
    .filter((value) => value !== "all");
}

function renderProjectTypeFilterSummary() {
  if (!projectTypeFilterSummary) return;
  const selected = selectedProjectTypeFilters();
  projectTypeFilterSummary.textContent = selected.length === 3 ? "全部类型" : selected.length ? selected.map((type) => type === "内部" ? "内部项目" : type === "定制" ? "定制项目" : type).join("、") : "未选择类型";
}

function projectVisibleOnBoard(project) {
  if (currentAccount.role === "管理员") return true;
  const name = currentAccountDisplayName();
  if (!name) return false;
  if (project.createdBy && project.createdBy === name) return true;
  const members = [...(project.members || []), ...(project.designers || []), ...(project.painters || []), project.owner || ""].join("、");
  return members.includes(name);
}

function mergedBoardProjects() {
  const defaults = defaultBoardProjects.map((project) => ({
    ...project,
    status: projectBoardOverrides[project.id] || project.status,
    source: "default",
  }));
  const created = customProjects.map((sourceProject) => {
    const project = normalizeProjectLifecycleProject(sourceProject);
    return {
    ...project,
    status: projectStage(project),
    stage: projectStage(project),
    type: projectTypeValue(project),
    due: project.endAt ? project.endAt.slice(5).replace("-", "-") : "未定",
    progress: projectProgressWidth(project.status || "需求确认"),
    swatches: project.swatches || ["mint", "coral", "gray"],
    members: Array.isArray(project.members)
      ? project.members
      : project.members
        ? String(project.members).split("、").filter(Boolean)
        : [...(project.designers || []), ...(project.painters || [])],
    source: "custom",
  };
  });
  const selectedTypes = selectedProjectTypeFilters();
  return [...created, ...defaults].filter((project) => {
    const typeOk = selectedTypes.includes(projectTypeValue(project));
    return typeOk && !project.archived && !project.projectResult && projectVisibleOnBoard(project);
  });
}

function projectBoardThumbnailHtml(project) {
  const image = projectFileEntries(project).find((file) => file.dataUrl && (String(file.type || "").startsWith("image/") || /\.(jpe?g|png)$/i.test(file.name || "")));
  return image
    ? `<span class="project-kanban-thumbnail"><img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(project.name)} 项目缩略图" /></span>`
    : `<span class="project-kanban-thumbnail empty" aria-label="暂无项目缩略图">无</span>`;
}

function projectAvatarHtml(project) {
  const members = Array.isArray(project.members) ? project.members : String(project.members || "").split("、").filter(Boolean);
  return `<div class="project-avatar-row">
    ${members.slice(0, 2).map((name, index) => `<span class="project-mini-avatar ${index % 2 ? "hot" : ""}">${escapeHtml(String(name).slice(0, 1))}</span>`).join("")}
  </div>`;
}

function projectBoardCardHtml(project) {
  const source = project.source || "custom";
  const draggable = currentAccount.role === "管理员" ? "true" : "false";
  const isClosed = project.status === "已关闭";
  const projectId = project.id;
  const canOpen = source === "custom" ? ` data-project-view="${escapeHtml(projectId)}"` : "";
  const runtime = projectStatusDisplay(project);
  const dateText = runtime.key === "overdue" || runtime.key === "paused" ? runtime.label : project.due || project.endAt || "未定";
  const customerText = project.customer === "内部图库 / 非客户项目" ? "非客户项目" : project.customer || project.owner || "未关联客户";
  return `<article class="project-kanban-card project-status-${runtime.key} ${isClosed ? "project-closed" : ""}" draggable="${draggable}" data-board-project="${escapeHtml(projectId)}" data-project-source="${escapeHtml(source)}"${canOpen}>
    <div class="project-kanban-head">
      <strong>${escapeHtml(project.name)}</strong>
      <time class="${runtime.key === "overdue" || runtime.key === "paused" ? "project-state-date" : ""}">${escapeHtml(dateText)}</time>
    </div>
    <div class="project-kanban-meta"><span>${escapeHtml(projectTypeValue(project) === "内部" ? "内部项目" : projectTypeValue(project))}</span><em>·</em><span>负责人：${escapeHtml(project.owner || "未指定")}</span></div>
    ${projectBoardThumbnailHtml(project)}
    <div class="project-kanban-foot">
      ${projectAvatarHtml(project)}
      <small>客户：${escapeHtml(customerText)}</small>
    </div>
  </article>`;
}

function renderCustomProjects() {
  if (!myProjectGrid) return;
  const projects = mergedBoardProjects();
  myProjectGrid.innerHTML = projectBoardStages
    .map((stage) => {
      const items = projects.filter((project) => normalizeProjectBoardStatus(project.status) === stage.status);
      return `<section class="project-board-column" data-project-stage="${escapeHtml(stage.status)}">
        <header>
          <div><i style="background:${stage.color}"></i><strong>${escapeHtml(stage.status)}</strong><span>${items.length}</span></div>
        </header>
        <div class="project-board-list">
          ${items.map(projectBoardCardHtml).join("") || `<button class="project-empty-column" type="button" data-project-empty-create="${escapeHtml(stage.status)}">新建项目</button>`}
        </div>
      </section>`;
    })
    .join("");
  renderProjectArchiveCount();
}

function moveProjectToStage(payload, nextStatus) {
  if (!payload?.id || !nextStatus) return;
  if (payload.source === "custom") {
    const project = customProjects.find((item) => item.id === payload.id);
    if (!project) return;
    if (project.projectStatus === "paused") {
      showToast("暂停中的项目需要先恢复，才能调整阶段。", "warning");
      return;
    }
    if (nextStatus === "已交付") {
      showToast("请在项目详情中完成交付记录后进入“已交付”。", "warning");
      return;
    }
    const previousStatus = projectStage(project);
    if (previousStatus === "已交付") {
      showToast("已交付项目请使用“重新打开交付”退回待交付。", "warning");
      return;
    }
    if (nextStatus === "待交付" && previousStatus !== "内部定稿") {
      showToast("只有内部定稿项目可以进入待交付。", "warning");
      return;
    }
    if (previousStatus === "待交付" && nextStatus !== "内部定稿") {
      showToast("待交付项目只能确认交付，或退回内部定稿。", "warning");
      return;
    }
    if (previousStatus === nextStatus) return;
    setProjectStage(project, nextStatus);
    project.changeLogs = [
      {
        time: formatDateTime(),
        user: currentAccount.name || currentAccount.role,
        action: "拖拽调整阶段",
        detail: `${previousStatus} → ${nextStatus}`,
      },
      ...(project.changeLogs || []),
    ];
  } else {
    const project = defaultBoardProjects.find((item) => item.id === payload.id);
    if (!project) return;
    const previousStatus = normalizeProjectBoardStatus(projectBoardOverrides[payload.id] || project.status);
    if (previousStatus === nextStatus) return;
    projectBoardOverrides[payload.id] = nextStatus;
  }
  saveStudioState();
  renderCustomProjects();
  showToast(`项目已移动到「${nextStatus}」。`, "success");
}

function projectDropColumn(target) {
  return target.closest(".project-board-column");
}

function editableOptions(kind) {
  if (kind === "project") {
    return projectLibrary.map((item) => item.name);
  }
  if (kind === "painter") {
    return ["无引用 / 原创设计", ...painterLibrary.map((item) => `${item.painter} / ${item.title}`)];
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
  workCards = document.querySelectorAll("[data-work-role]");
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

function validProjectDate(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatProjectDateInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join("-");
}

function projectDateText(value) {
  return validProjectDate(value) ? value : "未设置";
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

function openImageDB() {
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

async function saveImageToDB(key, imageData) {
  if (!imageData) return;
  const database = await openImageDB();
  await new Promise((resolve, reject) => {
    const tx = database.transaction("images", "readwrite");
    tx.objectStore("images").put({ key, imageData });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

async function getImageFromDB(key) {
  if (!key) return "";
  const database = await openImageDB();
  const result = await new Promise((resolve, reject) => {
    const tx = database.transaction("images", "readonly");
    const request = tx.objectStore("images").get(key);
    request.onsuccess = () => resolve(request.result?.imageData || "");
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result;
}

function isDirectImageSource(key) {
  const source = String(key || "").trim();
  return /^(data:|blob:|https?:|file:|\.{0,2}\/|assets\/)/i.test(source);
}

function resolveImageSource(key) {
  const source = String(key || "").trim();
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
    paletteFiles: card.dataset.paletteFiles || "",
    referenceKeys: card.dataset.referenceKeys || "",
    sourceFileName: card.dataset.sourceFileName || "",
    sourceFileKey: card.dataset.sourceFileKey || "",
    sourceFileType: card.dataset.sourceFileType || "",
    sourceFiles: card.dataset.sourceFiles || "",
    deletedAt: card.dataset.deletedAt || "",
    generated: card.dataset.generated === "true",
    title: card.querySelector(".work-head strong")?.textContent.trim() || card.querySelector(".file-name")?.textContent.trim() || card.dataset.file,
    project: card.querySelector(".work-body > p")?.textContent.replace(/^项目：/, "").trim() || "",
    reviewStatus: fieldValue(card, "审核状态"),
    customerStatus: fieldValue(card, "客户状态"),
    linkedPainter: fieldValue(card, "引用手绘"),
    referenceMaterial: fieldValue(card, "参考素材"),
    workStatus: fieldValue(card, "作品状态"),
    referencedDesign: fieldValue(card, "引用设计"),
    saleStatus: badgeValue(card, "销售状态：") || fieldValue(card, "作品状态") || "未出售",
    reviewNote: card.dataset.reviewNote || "",
    reviewAction: card.dataset.reviewAction || "",
    reviewLogs: card.dataset.reviewLogs || "",
    sleeping: card.dataset.sleeping === "true" || card.classList.contains("sleeping"),
    sleepPreviousReviewStatus: card.dataset.sleepPreviousReviewStatus || "",
    sleepPreviousReviewAction: card.dataset.sleepPreviousReviewAction || "",
    sleepPreviousReviewLogs: card.dataset.sleepPreviousReviewLogs || "",
    createdAt: card.dataset.createdAt || card.dataset.version || "",
    caseSeed: card.dataset.caseSeed === "true",
  };
}

function loadStudioState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      studioState = { ...studioState, ...JSON.parse(raw) };
      (studioState.globalTags || []).filter((tag) => !retiredDefaultTags.includes(tag)).forEach((tag) => {
        if (!globalTags.includes(tag)) globalTags.push(tag);
      });
      (studioState.pendingTags || []).forEach((tag) => {
        if (!pendingTagApplications.includes(tag)) pendingTagApplications.push(tag);
      });
      (studioState.dismissedNotifications || []).forEach((key) => dismissedNotifications.add(key));
      customProjects = Array.isArray(studioState.projects) ? studioState.projects : [];
      normalizeProjectLifecycleData();
      customCustomers = Array.isArray(studioState.customers) ? studioState.customers : [];
      projectBoardOverrides = studioState.projectBoardOverrides || {};
      if (Array.isArray(studioState.teamMembers) && studioState.teamMembers.length) {
        // 过滤掉 zx 测试账号，并按 ownerKey/姓名去重，避免重复累积。
        const seen = new Set();
        const cleaned = studioState.teamMembers.filter((member) => {
          const key = String(member.ownerKey || member.name || "").toLowerCase();
          const name = String(member.name || "").toLowerCase();
          if (key === "zx" || name === "zx") return false;
          const dedupeKey = member.ownerKey || member.name;
          if (seen.has(dedupeKey)) return false;
          seen.add(dedupeKey);
          return true;
        });
        teamMembers.splice(0, teamMembers.length, ...cleaned);
      }
      syncProjectLibrary();
      syncCustomerOptions();
    }
  } catch (error) {
    console.warn("Studio state load failed", error);
  }
}

/* 防抖保存：整库序列化（数百张卡）很重，合并 300ms 内的多次调用，避免每个操作都卡一下。
   页面隐藏/关闭前会立即落盘，不会丢数据。 */
let _saveTimer = null;
function saveStudioState() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { _saveTimer = null; saveStudioStateNow(); }, 300);
  return true;
}
function flushStudioState() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; saveStudioStateNow(); }
}
window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushStudioState(); });
window.addEventListener("pagehide", flushStudioState);
window.addEventListener("beforeunload", flushStudioState);

function saveStudioStateNow() {
  const overrides = {};
  const createdWorks = [];
  const removedFiles = studioState.removedFiles || [];

  workCards.forEach((card) => {
    const data = cardToData(card);
    if (data.generated) {
      createdWorks.push(data);
    } else {
      overrides[data.file] = {
        version: data.version,
        colors: data.colors,
        tags: data.tags,
        imageKey: data.imageKey,
        paletteKeys: data.paletteKeys,
        paletteFiles: data.paletteFiles,
        referenceKeys: data.referenceKeys,
        sourceFileName: data.sourceFileName,
        sourceFileKey: data.sourceFileKey,
        sourceFileType: data.sourceFileType,
        sourceFiles: data.sourceFiles,
        project: data.project,
        linkedPainter: data.linkedPainter,
        referenceMaterial: data.referenceMaterial,
        deletedAt: data.deletedAt,
        reviewNote: data.reviewNote,
        reviewAction: data.reviewAction,
        reviewLogs: data.reviewLogs,
        sleeping: data.sleeping,
      };
    }
  });

  studioState = { createdWorks, overrides, removedFiles, globalTags, pendingTags: pendingTagApplications, dismissedNotifications: [...dismissedNotifications], orders: studioOrders, projects: customProjects, customers: customCustomers, projectBoardOverrides, teamMembers };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studioState));
    return true;
  } catch (error) {
    console.warn("Studio state save failed", error);
    return false;
  }
}

function getPaletteKeys(card) {
  try {
    const keys = JSON.parse(card.dataset.paletteKeys || "[]");
    return Array.isArray(keys) ? keys : [];
  } catch {
    return [];
  }
}

function getPaletteFiles(card) {
  try {
    const files = JSON.parse(card?.dataset.paletteFiles || "[]");
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
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
}

function setPaletteFiles(card, files) {
  card.dataset.paletteFiles = JSON.stringify(files.filter(Boolean));
}

function applyImageData(card, imageData, { syncReview = true } = {}) {
  if (!imageData) return;
  card.dataset.imageData = imageData;
  const trigger = card.querySelector(".preview-trigger");
  if (trigger) {
    trigger.classList.add("has-image");
    trigger.style.backgroundImage = `url("${imageData}")`;
    trigger.style.backgroundSize = "contain";
    trigger.style.backgroundPosition = "center";
    trigger.style.aspectRatio = "1 / 1";
    trigger.style.minHeight = "0";
  }
  if (syncReview) syncReviewCardPreviews();
}

function setImageKey(card, key) {
  if (key) card.dataset.imageKey = key;
}

function updateCardProject(card, projectName) {
  const projectLine = card.querySelector(".work-body > p");
  if (!projectLine) return;
  projectLine.textContent = `项目：${projectName || "未关联项目"}`;
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
  if (text.includes("Pass")) return "pass";
  if (text.includes("待审核")) return "review";
  if (text.includes("需修改") || text.includes("未修改")) return "issue";
  return "unsold";
}

function createWorkCard(data, { deferImageSync = false } = {}) {
  const card = document.createElement("article");
  card.className = "work-card";
  card.dataset.workRole = data.role || "设计师";
  card.dataset.workOwner = data.owner || "designer";
  card.dataset.file = data.file;
  card.dataset.generated = data.generated ? "true" : "false";
  card.dataset.tags = normalizeTags(data.tags);
  card.dataset.version = data.version || formatDateTime();
  card.dataset.createdAt = data.createdAt || data.version || formatDateTime();
  if (data.caseSeed) card.dataset.caseSeed = "true";
  card.dataset.colors = data.colors || 1;
  if (data.paletteKeys) card.dataset.paletteKeys = data.paletteKeys;
  if (data.paletteFiles) card.dataset.paletteFiles = data.paletteFiles;
  if (data.referenceKeys) card.dataset.referenceKeys = data.referenceKeys;
  if (data.sourceFileName) card.dataset.sourceFileName = data.sourceFileName;
  if (data.sourceFileKey) card.dataset.sourceFileKey = data.sourceFileKey;
  if (data.sourceFileType) card.dataset.sourceFileType = data.sourceFileType;
  if (data.sourceFiles) card.dataset.sourceFiles = data.sourceFiles;
  setImageKey(card, data.imageKey || data.file);
  if (data.deletedAt) {
    card.dataset.deletedAt = data.deletedAt;
    card.classList.add("deleted");
  }
  if (data.reviewNote) card.dataset.reviewNote = data.reviewNote;
  if (data.reviewAction) card.dataset.reviewAction = data.reviewAction;
  if (data.reviewLogs) card.dataset.reviewLogs = data.reviewLogs;
  if (data.sleepPreviousReviewStatus) card.dataset.sleepPreviousReviewStatus = data.sleepPreviousReviewStatus;
  if (data.sleepPreviousReviewAction) card.dataset.sleepPreviousReviewAction = data.sleepPreviousReviewAction;
  if (data.sleepPreviousReviewLogs) card.dataset.sleepPreviousReviewLogs = data.sleepPreviousReviewLogs;
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
    <button class="preview-trigger pattern pattern-a" type="button" aria-label="放大查看 ${escapeHtml(data.file)}"></button>
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
  (studioState.createdWorks || []).forEach((work) => createWorkCard({ ...work, generated: true }));
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
      card.classList.add("deleted");
    }
    if (patch.imageKey) setImageKey(card, patch.imageKey);
    if (patch.paletteKeys) card.dataset.paletteKeys = patch.paletteKeys;
    if (patch.paletteFiles) card.dataset.paletteFiles = patch.paletteFiles;
    if (patch.referenceKeys) card.dataset.referenceKeys = patch.referenceKeys;
    if (patch.sourceFileName) card.dataset.sourceFileName = patch.sourceFileName;
    if (patch.sourceFileKey) card.dataset.sourceFileKey = patch.sourceFileKey;
    if (patch.sourceFileType) card.dataset.sourceFileType = patch.sourceFileType;
    if (patch.sourceFiles) card.dataset.sourceFiles = patch.sourceFiles;
    if (patch.project) updateCardProject(card, patch.project);
    if (patch.linkedPainter) updateCardLinkedPainter(card, patch.linkedPainter);
    if (patch.referenceMaterial) updateCardReferenceMaterial(card, patch.referenceMaterial);
    if (patch.reviewNote) card.dataset.reviewNote = patch.reviewNote;
    if (patch.reviewAction) card.dataset.reviewAction = patch.reviewAction;
    if (patch.reviewLogs) card.dataset.reviewLogs = patch.reviewLogs;
    if (patch.sleepPreviousReviewStatus) card.dataset.sleepPreviousReviewStatus = patch.sleepPreviousReviewStatus;
    if (patch.sleepPreviousReviewAction) card.dataset.sleepPreviousReviewAction = patch.sleepPreviousReviewAction;
    if (patch.sleepPreviousReviewLogs) card.dataset.sleepPreviousReviewLogs = patch.sleepPreviousReviewLogs;
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
}

async function hydrateStoredImages() {
  const cards = [...workCards].filter((card) => card.dataset.imageKey && !card.dataset.imageData);
  let cursor = 0;
  const workerCount = Math.min(6, cards.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < cards.length) {
      const card = cards[cursor++];
      try {
        const imageData = await resolveImageSource(card.dataset.imageKey);
        if (imageData) applyImageData(card, imageData, { syncReview: false });
      } catch (error) {
        console.warn("Image restore failed", card.dataset.file, error);
      }
    }
  });
  await Promise.all(workers);
  syncReviewCardPreviews();
  if (librarySessionActive) renderLibraryGrid();
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
  return [...workCards].filter((card) => !card.classList.contains("deleted"));
}

function visibleProjectItems() {
  return mergedBoardProjects().filter((project) => projectVisibleForCurrentAccount(project));
}

function activeProjectItems() {
  return visibleProjectItems().filter((project) => !project.archived && !project.projectResult);
}

function relatedOrderItems() {
  return studioOrders.filter(orderBelongsToCurrentAccount);
}

function adminRiskData() {
  const projects = activeProjectItems().filter((project) => {
    const days = daysUntil(project.endAt);
    return days >= 0 && days <= 3;
  });
  const orders = relatedOrderItems().filter((order) => orderProgressStatus(order) === "待评审");
  return { projects, orders };
}

function riskProjectPeople(project) {
  return [project.owner, ...(project.designers || []), ...(project.painters || [])].filter(Boolean).join("、") || "待分配";
}

function renderRiskModal() {
  const { projects, orders } = adminRiskData();
  const projectItems = projects.length
    ? projects.map((project) => `<button class="risk-item" type="button" data-risk-project="${escapeHtml(project.id)}">
        <span class="risk-item-main"><strong>${escapeHtml(project.name || project.id)}</strong><small>截止 ${escapeHtml(project.endAt || "未设置")} · 参与人员：${escapeHtml(riskProjectPeople(project))}</small></span>
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
  const reviewProjects = projects.filter((project) => normalizeProjectBoardStatus(project.status) === "稿件评审").length;
  const orders = relatedOrderItems();
  const deliveryOrders = orders.filter((order) => ["已确认下单", "进行中", "待评审"].includes(orderProgressStatus(order))).length;
  const { projects: riskProjects, orders: riskOrders } = adminRiskData();
  const riskTotal = riskProjects.length + riskOrders.length;
  const teamLoadStats = teamMembers.map((member) => ({ member, stats: teamMemberStats(member) }));
  const lightLoadMembers = teamLoadStats.filter(({ stats }) => teamLoadClass(stats.loadScore) === "low");
  const mediumLoadMembers = teamLoadStats.filter(({ stats }) => teamLoadClass(stats.loadScore) === "medium");
  const highLoadMembers = teamLoadStats.filter(({ stats }) => teamLoadClass(stats.loadScore) === "hot");
  const loadTotal = Math.max(teamLoadStats.length, 1);
  const lightLoadEnd = (lightLoadMembers.length / loadTotal) * 360;
  const mediumLoadEnd = lightLoadEnd + (mediumLoadMembers.length / loadTotal) * 360;
  const highLoadNames = highLoadMembers.length ? highLoadMembers.map(({ member }) => member.name).join("，") : "暂无";
  if (metricGrid) {
    metricGrid.classList.add("admin-metric-grid");
    metricGrid.innerHTML = `
      <button class="metric-card" type="button" data-dashboard-jump="review" data-review-date="${today}" aria-label="查看今天待评审稿件"><span>待评审稿件</span><strong>${pendingCards.length}</strong><p>今天 · 设计稿 ${pendingDesigns} / 手绘素材 ${pendingPainter}</p></button>
      <button class="metric-card" type="button" data-dashboard-jump="projects" aria-label="查看进行中项目"><span>进行中项目</span><strong>${projects.length}</strong><p>${reviewProjects} 个项目处于稿件评审</p></button>
      <button class="metric-card" type="button" data-dashboard-jump="orders" aria-label="查看待处理订单"><span>订单待处理</span><strong>${deliveryOrders}</strong><p>客户确认后进入订单中心</p></button>
      <button class="metric-card ${riskTotal ? "alert" : "safe"}" type="button" data-open-risk aria-label="查看风险提醒"><span>风险提醒</span><strong>${riskTotal}</strong><p class="risk-summary"><span>临近截止 ${riskProjects.length}</span><span>待评审 ${riskOrders.length}</span></p></button>
    `;
  }
  if (commandGrid) {
    const demoPendingCards = pendingCards.length;
    const demoProjects = projects.length || 2;
    const demoDeliveryOrders = deliveryOrders || 1;
    commandGrid.innerHTML = `
      <section class="panel wide">
        <div class="panel-head">
          <h3>待处理</h3>
        </div>
        <div class="project-list project-command-list">
          <article data-dashboard-jump="review" data-review-date="${today}" role="button" tabindex="0">
            <div><strong>稿件审核</strong><span>今天 ${demoPendingCards} 张待处理，通过后才进入客户稿库。</span></div>
            <i class="command-status-dot attention" aria-label="警告"></i>
          </article>
          <article data-dashboard-jump="projects" role="button" tabindex="0">
            <div><strong>项目推进</strong><span>${demoProjects} 个内部项目执行中，进度正常。</span></div>
            <i class="command-status-dot safe" aria-label="正常"></i>
          </article>
          <article data-dashboard-jump="orders" role="button" tabindex="0">
            <div><strong>订单交付</strong><span>${demoDeliveryOrders} 个客户订单临近截止，请及时处理。</span></div>
            <i class="command-status-dot attention" aria-label="警告"></i>
          </article>
          <article data-dashboard-jump="team" role="button" tabindex="0">
            <div><strong>团队负载</strong><span>设计师与手绘师当前负载正常。</span></div>
            <i class="command-status-dot safe" aria-label="正常"></i>
          </article>
        </div>
      </section>
      <section class="panel employee-load-panel">
        <div class="panel-head">
          <h3>员工负载</h3>
        </div>
        <div class="employee-load-overview">
          <div class="employee-load-figure">
            <div class="employee-load-ring" style="background:conic-gradient(#53d679 0deg,#22c55e ${lightLoadEnd}deg,#ffc05c ${lightLoadEnd}deg,#f59e0b ${mediumLoadEnd}deg,#ff7a7a ${mediumLoadEnd}deg,#ef4444 360deg)"><span><strong>${teamLoadStats.length}</strong><small>成员</small></span></div>
            <p>当前团队工作负载分布</p>
          </div>
          <div class="employee-load-copy">
            <div class="employee-load-legend">
              <p><span><i class="low"></i>轻负载</span><strong>${lightLoadMembers.length}</strong></p>
              <p><span><i class="medium"></i>中负载</span><strong>${mediumLoadMembers.length}</strong></p>
              <p><span><i class="hot"></i>高负载</span><strong>${highLoadMembers.length}</strong></p>
            </div>
            ${highLoadMembers.length ? `<p class="employee-high-load"><b>高负载成员</b><span>${escapeHtml(highLoadNames)}</span></p>` : ""}
          </div>
        </div>
      </section>
    `;
  }
}

function renderCreativeDashboard(role) {
  const dashboard = document.querySelector(`[data-role-dashboard="${role}"]`);
  if (!dashboard) return;
  const metricGrid = dashboard.querySelector(".metric-grid");
  const taskList = dashboard.querySelector(".personal-task-list");
  const cards = activeWorkCards().filter((card) => card.dataset.workRole === role && card.dataset.workOwner === currentAccount.ownerKey);
  const pending = cards.filter(isReviewPending).length;
  const revision = cards.filter((card) => cardStatusSummary(card).includes("需修改") || cardStatusSummary(card).includes("未修改")).length;
  const sleeping = cards.filter(isSleepingWork).length;
  const sold = cards.filter((card) => cardStatusSummary(card).includes("已出售") || cardStatusSummary(card).includes("出售")).length;
  const projects = activeProjectItems();
  const orders = relatedOrderItems().filter((order) => orderProgressStatus(order) !== "已完成" && orderProgressStatus(order) !== "已关闭");
  if (metricGrid) {
    metricGrid.innerHTML = `
      <article class="metric-card"><span>我的稿件</span><strong>${cards.length}</strong><p>${pending} 张等待审核或复核</p></article>
      <article class="metric-card"><span>已出售</span><strong>${sold}</strong><p>来自客户订单和稿库成交</p></article>
      <article class="metric-card alert"><span>需处理</span><strong>${revision + sleeping}</strong><p>需修改 ${revision} / 休眠 ${sleeping}</p></article>
      <article class="metric-card"><span>关联项目</span><strong>${projects.length}</strong><p>当前账号参与的内部项目</p></article>
    `;
  }
  if (taskList) {
    taskList.innerHTML = `
      <p><b>我的项目</b><span>${projects.slice(0, 2).map((project) => project.name).join("、") || "暂无进行中项目"}</span></p>
      <p><b>我的订单</b><span>${orders.slice(0, 2).map((order) => order.id).join("、") || "暂无关联订单"}</span></p>
      <p><b>稿件处理</b><span>${pending} 张待审核，${revision} 张需修改</span></p>
    `;
  }
}

function renderSalesDashboard() {
  const dashboard = document.querySelector('[data-role-dashboard="销售"]');
  if (!dashboard) return;
  const metricGrid = dashboard.querySelector(".metric-grid");
  const taskList = dashboard.querySelector(".personal-task-list");
  const orders = relatedOrderItems();
  const activeOrders = orders.filter((order) => ["已确认下单", "进行中", "待评审"].includes(orderProgressStatus(order)));
  const completed = orders.filter((order) => orderProgressStatus(order) === "已完成").length;
  if (metricGrid) {
    metricGrid.innerHTML = `
      <article class="metric-card"><span>可选稿件</span><strong>${libraryEligibleDesigns().length}</strong><p>已通过且未占用订单</p></article>
      <article class="metric-card"><span>选稿车</span><strong>${libraryCart.size}</strong><p>等待客户确认</p></article>
      <article class="metric-card alert"><span>待跟进订单</span><strong>${activeOrders.length}</strong><p>确认后进入交付链路</p></article>
      <article class="metric-card"><span>已完成</span><strong>${completed}</strong><p>客户交付完成订单</p></article>
    `;
  }
  if (taskList) {
    taskList.innerHTML = `
      <p><b>客户稿库</b><span>${libraryEligibleDesigns().length} 组可推荐稿件</span></p>
      <p><b>选稿车</b><span>${libraryCart.size} 组等待确认下单</span></p>
      <p><b>订单中心</b><span>${activeOrders.length} 单需要跟进交付</span></p>
    `;
  }
}

function renderSamplerDashboard() {
  const dashboard = document.querySelector('[data-role-dashboard="打样师"]');
  if (!dashboard) return;
  const metricGrid = dashboard.querySelector(".metric-grid");
  const projects = activeProjectItems();
  if (metricGrid) {
    metricGrid.innerHTML = `
      <article class="metric-card"><span>关联项目</span><strong>${projects.length}</strong><p>需要关注定稿和打样节点</p></article>
      <article class="metric-card"><span>内部定稿</span><strong>${visibleProjectItems().filter((project) => normalizeProjectBoardStatus(project.status) === "内部定稿").length}</strong><p>可准备进入打样</p></article>
      <article class="metric-card alert"><span>待确认</span><strong>${projects.filter((project) => normalizeProjectBoardStatus(project.status) === "稿件评审").length}</strong><p>等待设计稿定版</p></article>
      <article class="metric-card"><span>订单参考</span><strong>${relatedOrderItems().length}</strong><p>客户订单由订单中心跟进</p></article>
    `;
  }
}

function memberProjectItems(member) {
  return customProjects.filter((project) => {
    if (project.archived || project.projectResult) return false;
    const members = [
      project.owner,
      ...(project.designers || []),
      ...(project.painters || []),
      ...(Array.isArray(project.members) ? project.members : String(project.members || "").split("、")),
    ];
    return members.some((name) => String(name || "").includes(member.name));
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

function teamMemberRowHtml(member) {
  const stats = teamMemberStats(member);
  const loadClass = teamLoadClass(stats.loadScore);
  const accountStatus = member.accountStatus || "正常";
  const actions = teamManageMode
    ? `<div class="team-row-actions">
        <button type="button" data-team-account-toggle="${escapeHtml(member.ownerKey)}">${accountStatus === "正常" ? "停用" : "启用"}</button>
        <button class="danger" type="button" data-team-remove="${escapeHtml(member.ownerKey)}">移出</button>
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
    return roleMatch && statusMatch && (!query || searchMatches(query, [member.name, member.role, member.ownerKey]));
  });
  const allStats = teamMembers.map((member) => teamMemberStats(member));
  const highLoadMembers = teamMembers.filter((member, index) => teamLoadClass(allStats[index].loadScore) === "hot");
  const highLoadMarkup = highLoadMembers.length
    ? `<span class="team-high-members">${highLoadMembers.map((member) => `<i><b class="team-avatar ${escapeHtml(member.tone)}">${memberAvatarInner(member)}</b>${escapeHtml(member.name)}</i>`).join("")}</span>`
    : "暂无高负载成员";
  const roleComposition = [...new Set(teamMembers.map((item) => item.role))]
    .map((role) => `${teamMembers.filter((item) => item.role === role).length} 位${role}`)
    .join(" · ");
  teamMetrics.innerHTML = `
    <article><span>团队成员</span><strong>${teamMembers.length}</strong><p>${escapeHtml(roleComposition || "暂无成员")}</p></article>
    <article><span>当前高负载人员</span><strong>${highLoadMembers.length} 位</strong><p>${highLoadMarkup}</p></article>
  `;
  teamManageButton?.classList.toggle("active", teamManageMode);
  if (teamManageButton) teamManageButton.textContent = teamManageMode ? "完成管理" : "管理成员";
  teamGrid.innerHTML = `<table class="team-table">
    <thead><tr><th>成员</th><th>角色</th><th>工作负载</th><th>负责项目</th><th>账号状态</th><th>操作</th></tr></thead>
    <tbody>${members.length ? members.map(teamMemberRowHtml).join("") : `<tr><td colspan="6" class="team-table-empty">没有符合条件的成员</td></tr>`}</tbody>
  </table>`;
}

function closeTeamProjectsModal() {
  teamProjectsModal?.classList.remove("active");
  teamProjectsModal?.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

function openTeamProjectsModal(memberKey) {
  const member = teamMembers.find((item) => item.ownerKey === memberKey);
  if (!member || !teamProjectsModal || !teamProjectsBody) return;
  const stats = teamMemberStats(member);
  const projects = stats.projects;
  const resultCount = member.role === "设计师" ? stats.sold : stats.referenced;
  const resultLabel = member.role === "设计师" ? "已出售" : "被引用";
  const projectRows = projects.length
    ? `<div class="team-project-list-head"><span>项目名称</span><span>类型</span><span>阶段</span><span>项目时间</span><span>客户</span></div>${projects.map((project) => `<button class="team-project-row" type="button" data-team-project-detail="${escapeHtml(project.id)}">
        <strong>${escapeHtml(project.name)}</strong>
        <span>${escapeHtml(projectTypeValue(project) === "内部" ? "内部项目" : `${projectTypeValue(project)}项目`)}</span>
        <span>${escapeHtml(normalizeProjectBoardStatus(project.status))}</span>
        <span>${escapeHtml(project.startAt || "未定")} — ${escapeHtml(project.endAt || "未定")}</span>
        <span>${escapeHtml(project.customer || "非客户项目")}</span>
      </button>`).join("")}`
    : `<p class="team-projects-empty">暂无负责项目</p>`;
  const orderRows = stats.orders.length
    ? stats.orders.map((order) => `<div class="team-order-row"><strong>${escapeHtml(order.id || "订单")}</strong><span>${escapeHtml(order.customer || "未关联客户")}</span><small>${escapeHtml(orderProgressStatus(order))}</small></div>`).join("")
    : `<p class="team-projects-empty compact">暂无关联订单</p>`;
  teamProjectsTitle.textContent = `${member.name} · 成员详情`;
  teamProjectsBody.innerHTML = `<div class="team-member-detail-summary">
      <div><strong>${stats.works.length}</strong><span>作品</span></div>
      <div><strong>${stats.pending}</strong><span>待审</span></div>
      <div><strong>${stats.revision}</strong><span>需改</span></div>
      <div><strong>${stats.sleeping}</strong><span>休眠</span></div>
      <div><strong>${resultCount}</strong><span>${resultLabel}</span></div>
      <div><strong>${stats.projects.length}</strong><span>项目</span></div>
    </div>
    <section class="team-member-related"><h3>负责项目</h3>${projectRows}</section>
    <section class="team-member-related"><h3>关联订单</h3>${orderRows}</section>`;
  teamProjectsModal.classList.add("active");
  teamProjectsModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function syncProjectMemberOptions() {
  const selectedDesigners = new Set(checkedMemberValues(projectDesignerOptions));
  const selectedPainters = new Set(checkedMemberValues(projectPainterOptions));
  const selectedOwners = new Set(checkedMemberValues(projectOwnerOptions));
  const optionMarkup = (member, selected) => `<label><input type="checkbox" value="${escapeHtml(member.name)}" ${selected.has(member.name) ? "checked" : ""} /><span>${escapeHtml(member.name)}</span></label>`;
  const enabledMembers = teamMembers.filter((member) => (member.accountStatus || "正常") === "正常");
  if (projectDesignerOptions) projectDesignerOptions.innerHTML = enabledMembers.filter((member) => member.role === "设计师").map((member) => optionMarkup(member, selectedDesigners)).join("");
  if (projectPainterOptions) projectPainterOptions.innerHTML = enabledMembers.filter((member) => member.role === "手绘师").map((member) => optionMarkup(member, selectedPainters)).join("");
  if (projectOwnerOptions) {
    const admin = { name: "管理员 / 总控" };
    projectOwnerOptions.innerHTML = [admin, ...enabledMembers].map((member) => optionMarkup(member, selectedOwners)).join("");
  }
  updateProjectMemberSummaries();
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

function projectOwnerNames(project) {
  if (Array.isArray(project.owners)) return [...project.owners];
  if (!project.owner || project.owner === "未指定") return [];
  return String(project.owner).split("、").map((name) => name.trim()).filter(Boolean);
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
  if (role === "打样师") renderSamplerDashboard();
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

function switchView(target) {
  navItems.forEach((navItem) => navItem.classList.toggle("active", navItem.dataset.view === target));
  views.forEach((view) => view.classList.toggle("active", view.id === target));
  if (target === "sleep") {
    renderSleepList();
  }
  if (target === "review") {
    renderDailyReviewBoard();
  }
  if (target === "myOrders") {
    moShown = MO_PAGE_SIZE;
    renderMyOrders();
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
    renderLibraryGrid();
  }
  if (target === "cart") {
    renderLibraryCart();
    renderCartPage();
  }
  if (target === "myLibrary") {
    renderMyPatternLibrary();
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
  if (target === "dashboard") {
    renderDashboardOverview(roleSelect.value);
    pageTitle.textContent = roleDashboardTitles[roleSelect.value];
  } else if (target === "designer") {
    pageTitle.textContent = roleSelect.value === "管理员" ? "作品库" : roleSelect.value === "手绘师" ? "我的手绘稿" : "我的设计稿";
  } else if (target === "projects" && roleSelect.value !== "管理员") {
    pageTitle.textContent = "我的项目";
  } else if (target === "orders" && (roleSelect.value === "设计师" || roleSelect.value === "手绘师")) {
    pageTitle.textContent = "我的订单";
  } else if (target === "sampling" && roleSelect.value === "打样师") {
    pageTitle.textContent = "我的打样";
  } else {
    pageTitle.textContent = titleMap[target];
  }
}

function viewAllowedForRole(navItem, role) {
  if (!navItem?.dataset?.roles) {
    return false;
  }

  return navItem.dataset.roles.split(",").includes(role);
}

function configureRoleNavigation(role) {
  navItems.forEach((navItem) => {
    navItem.classList.toggle("hidden", !viewAllowedForRole(navItem, role));
  });

  const designerNav = document.querySelector('[data-view="designer"]');
  const projectNav = document.querySelector('[data-view="projects"]');
  const ordersNav = document.querySelector('[data-view="orders"]');
  const samplingNav = document.querySelector('[data-view="sampling"]');

  designerNav.querySelector(".nav-label").textContent = role === "管理员" ? "作品库" : role === "手绘师" ? "我的手绘稿" : "我的设计稿";
  projectNav.querySelector(".nav-label").textContent = role === "管理员" ? "项目进度" : "我的项目";
  ordersNav.querySelector(".nav-label").textContent = role === "设计师" || role === "手绘师" ? "我的订单" : "订单中心";
  if (samplingNav) samplingNav.querySelector(".nav-label").textContent = role === "打样师" ? "我的打样" : "打样管理";
  navItems.forEach((item) => {
    const label = item.querySelector(".nav-label")?.textContent || "";
    item.dataset.tooltip = label;
    item.title = label;
  });
  topCartButton?.classList.toggle("hidden", !["管理员", "销售"].includes(role));

  adminActions.forEach((action) => action.classList.toggle("hidden", role !== "管理员"));
  configureWorksView(role, currentAccount.ownerKey);
  renderSleepList();

  const currentActiveNav = document.querySelector(".nav-item.active");
  if (!currentActiveNav || !viewAllowedForRole(currentActiveNav, role)) {
    switchView(role === "客户" ? "myLibrary" : "dashboard");
  }
}

function configureWorksView(role, ownerKey) {
  const isAdmin = role === "管理员";
  const isPainter = role === "手绘师";
  const activeWorkRole = isPainter ? "手绘师" : "设计师";

  worksTitle.textContent = isAdmin ? "作品库" : isPainter ? "我的手绘稿" : "我的设计稿";
  worksIntro.textContent = isAdmin
    ? "查看已审核通过的设计稿、手绘稿及其引用关系。"
    : isPainter
      ? "只显示当前手绘师自己的作品，状态分为未出售、被引用、出售。"
      : "只显示当前设计师自己的作品，状态包含管理者审核状态和客户选择后的流程状态。";

  // 管理员的作品库不显示上传入口（管理员不上传）。
  worksUploadRow?.classList.toggle("hidden", isAdmin);
  // 管理员作品库使用图片画廊布局（方形瓷砖、hover 显示信息）。
  worksBoard?.classList.toggle("library-gallery", isAdmin);

  workCards.forEach((card) => {
    const belongsToRole = card.dataset.workRole === activeWorkRole;
    const belongsToAccount = card.dataset.workOwner === ownerKey;
    card.classList.toggle("hidden", !isAdmin && (!belongsToRole || !belongsToAccount));
  });
  applyLibraryFilters();
  sortWorkCards();
}

function visibleWorkCards() {
  const inSleepView = activeViewId() === "sleep";
  return [...workCards].filter(
    (card) =>
      !card.classList.contains("deleted") &&
      !card.classList.contains("time-hidden") &&
      !card.classList.contains("filtered-hidden") &&
      (inSleepView ? isSleepingWork(card) && cardBelongsToCurrentAccount(card) : !card.classList.contains("hidden") && !isSleepingWork(card))
  );
}

// 当前每日评审展示的稿件集合（当天 + 当前类型/状态筛选），用于预览翻页限定范围。
function currentReviewCards() {
  const dateItems = reviewItems()
    .filter((card) => card.dataset.workRole === activeReviewWorkType)
    .filter((card) => reviewDisplayDate(card) === activeReviewDate);
  return dateItems
    .filter((card) => activeReviewFilter === "all" || (activeReviewFilter === "pending" ? isReviewPending(card) : !isReviewPending(card)))
    .filter((card) => activeReviewFilter === "pending" || activeReviewResultFilter === "all" || (!isReviewPending(card) && (reviewLogs(card)[0]?.action || card.dataset.reviewAction || "") === activeReviewResultFilter))
    .sort((a, b) => new Date(b.dataset.version) - new Date(a.dataset.version));
}

function activeLightboxCards() {
  return lightboxCardSet.length ? lightboxCardSet : visibleWorkCards();
}

function cardBelongsToCurrentAccount(card) {
  return currentAccount.role === "管理员" || card.dataset.workOwner === currentAccount.ownerKey;
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
    painterPickerModal.classList.contains("active")
  );
}

function lockBodyScroll(lock) {
  if (lock) {
    document.body.style.overflow = "hidden";
  } else if (!anyOverlayOpen()) {
    document.body.style.overflow = "";
  }
}

function openLightbox(card) {
  if (activeViewId() !== "orders") activeOrderFileContext = null;
  const inViewerLibrary = document.querySelector("#viewerLibrary")?.classList.contains("active") || activeViewId() === "myLibrary";
  let cards;
  if (inViewerLibrary) {
    // 客户花型库：点开只看这个花型自己的配色，箭头不翻到别的花型或参考图。
    cards = card ? [card] : approvedLibraryCards();
  } else if (activeViewId() === "review") {
    // 评审：只在当天展示的稿件之间翻页。
    cards = currentReviewCards();
  } else if (activeViewId() === "designer" && currentAccount.role === "管理员") {
    // 作品库：只看当前作品自己的配色，不跳到下一个作品。
    cards = card ? [card] : visibleWorkCards();
  } else {
    cards = visibleWorkCards();
  }
  if (card && !cards.includes(card)) {
    cards = [card];
  }
  if (!cards.length) return;
  paletteEditMode = false;
  lightboxCardSet = cards;
  activePreviewIndex = Math.max(0, cards.indexOf(card));
  activeVariant = 1;
  previewZoom = 1;
  previewOffsetX = 0;
  previewOffsetY = 0;
  renderLightbox();
  lightbox.classList.add("active");
  lightbox.classList.remove("info-hidden");
  // 客户花型库：预览只保留大图和配色，隐藏内部信息面板。
  lightbox.classList.toggle("viewer-clean", !!inViewerLibrary);
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
  const ownerNames = {
    designer: "许然",
    linruo: "林若",
    mengxia: "孟夏",
    painter: "阿沁",
    zhouhe: "周禾",
    luochuan: "洛川",
    suye: "苏叶",
    sampler: "陈一",
  };
  return teamMembers.find((member) => member.ownerKey === card.dataset.workOwner)?.name || ownerNames[card.dataset.workOwner] || card.dataset.workOwner || "-";
}

function workOwnerKeyByName(name) {
  const ownerKeys = {
    许然: "designer",
    林若: "linruo",
    孟夏: "mengxia",
    阿沁: "painter",
    周禾: "zhouhe",
    洛川: "luochuan",
    苏叶: "suye",
    陈一: "sampler",
  };
  return ownerKeys[name] || "";
}

function cardTagsText(card) {
  if (!card) return "未设置";
  return (card.dataset.tags || "").split(",").filter(Boolean).join("、") || "未设置";
}

function renderLightboxTagDisplay(card) {
  const tags = (card?.dataset.tags || "").split(",").filter(Boolean).slice(0, 6);
  lightboxTags.innerHTML = tags.length
    ? tags.map((tag) => `<span class="lightbox-tag-display-chip">${escapeHtml(tag)}</span>`).join("")
    : `<span class="lightbox-tag-display-chip">未设置标签</span>`;
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
  秋:"qiu",冬:"dong",清:"qing",透:"tou",花:"hua",卉:"hui",四:"si",套:"tao",系:"xi",列:"lie",南:"nan",通:"tong",
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
  return values.some((value) => searchForms(value).some((form) => form.includes(key)));
}

function workProjectName(card) {
  return card?.querySelector(".work-body > p")?.textContent.replace(/^项目：/, "").trim() || "未关联项目";
}

function buildGlobalSearchMatches(query) {
  const key = normalizeSearch(query);
  if (!key) return [];
  const matches = [];
  [...workCards].forEach((card) => {
    if (card.classList.contains("deleted")) return;
    const project = workProjectName(card);
    const linkedPainter = fieldValue(card, "引用手绘");
    const linkedDesign = fieldValue(card, "引用设计");
    const values = [
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
      title: card.dataset.file,
      meta: `${card.dataset.workRole || "稿件"} · ${workOwnerName(card)} · ${project}`,
      card,
    });
  });

  customProjects.forEach((project) => {
    const values = [
      project.name,
      project.customer,
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
      meta: `项目 · ${project.customer || "内部图库"} · 负责人 ${project.owner || "待分配"}`,
      project,
    });
  });

  projectLibrary.forEach((project) => {
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
      meta: `订单 · ${order.customer || "未设置客户"} · ${orderProgressStatus(order)}`,
      order,
    });
  });

  const customerNames = new Set();
  [libraryCustomer, projectCustomerSelect].forEach((select) => {
    select?.querySelectorAll("option").forEach((option) => customerNames.add(option.value || option.textContent));
  });
  customerNames.forEach((customer) => {
    if (!customer || !searchMatches(key, [customer])) return;
    matches.push({ type: "customer", title: customer, meta: "客户 · 可进入客户稿库选稿", customer });
  });

  return matches.slice(0, 12);
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
  if (item.type === "work") {
    switchView("designer");
    openLightbox(item.card);
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
  if (item.type === "customer") {
    switchView("library");
    document.querySelector("#customerCenter")?.classList.add("hidden");
    document.querySelector("#customerSelectionFlow")?.classList.remove("hidden");
    if (libraryCustomer) libraryCustomer.value = item.customer;
    renderLibraryGrid();
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

function notificationItems() {
  const pendingDrafts = [...workCards].filter((card) => !card.classList.contains("deleted") && isReviewPending(card)).length;
  const nearDeadlineProjects = customProjects.filter((project) => {
    const days = daysUntil(project.endAt);
    return !project.archived && !project.projectResult && days >= 0 && days <= 7;
  }).length;
  const pendingOrders = studioOrders.filter((order) => orderProgressStatus(order) === "待评审").length;
  const sensitiveActions = deletedWorks.length + studioOrders.filter((order) => orderProgressStatus(order) === "已关闭").length;
  const myRevisionWorks = [...workCards].filter((card) =>
    !card.classList.contains("deleted")
    && fieldValue(card, "审核状态").includes("需修改")
    && cardBelongsToCurrentAccount(card)
  ).length;
  return [
    { key: "work-revision", count: myRevisionWorks, title: "作品需修改", text: `${myRevisionWorks} 张作品被打回，请修改后重新提交。` },
    { key: "draft-review", count: pendingDrafts, title: "稿件审核提醒", text: `${pendingDrafts} 张稿件正在等待审核。` },
    { key: "project-deadline", count: nearDeadlineProjects, title: "项目截止提醒", text: `${nearDeadlineProjects} 个项目将在 7 天内到达截止日期。` },
    { key: "order-review", count: pendingOrders, title: "订单进度提醒", text: `${pendingOrders} 个订单处于待评审状态，需要负责人处理。` },
    { key: "sensitive-action", count: sensitiveActions, title: "员工风险操作", text: `系统记录到 ${sensitiveActions} 项删除稿件或关闭订单操作。` },
  ].filter((item) => item.count > 0);
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
  if (notificationMore) notificationMore.textContent = notificationsExpanded ? "收起" : `查看更多（${items.length}）`;
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

function renderCartPreview() {
  if (!cartPreviewList) return;
  const files = (typeof allSelectedFiles === "function") ? allSelectedFiles() : [...libraryCart];
  cartPreviewList.innerHTML = files.length
    ? files.slice(0, 5).map((file) => {
        const card = sourceCardByFile(file);
        const colors = Number(card?.dataset.colors || 1);
        const img = card?.dataset.imageData ? `background-image:url('${card.dataset.imageData}')` : "";
        const name = card?.querySelector(".work-head strong")?.textContent.trim() || file;
        return `<div class="flower-line">
          <span class="flower-line-thumb" style="${img}"></span>
          <div class="flower-line-info"><strong>${escapeHtml(name)}</strong><small>${colors} 配色</small></div>
        </div>`;
      }).join("") + (files.length > 5 ? `<p class="cart-preview-more">还有 ${files.length - 5} 个花型</p>` : "")
    : `<p class="top-popover-empty">选稿车目前为空。</p>`;
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
  resetCustomerModal();
  customerModal.classList.add("active");
  customerModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
  customerNameInput.focus();
}

function closeCustomerModal() {
  customerModal.classList.remove("active");
  customerModal.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
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
  customCustomers = [{
    id: `CU-${Date.now()}`,
    name,
    gender: selectedCustomerGender,
    company: customerCompanyInput.value.trim(),
    contact: customerContactInput.value.trim(),
    preferences: [...selectedCustomerPreferences],
    demand: customerDemandInput.value.trim(),
    createdAt: formatDateTime(),
  }, ...customCustomers];
  ensureCustomerOption(name, false);
  saveStudioState();
  closeCustomerModal();
  showToast(`${name} 已加入客户库。`, "success");
}

function handleQuickCreate(action) {
  closeQuickCreateModal();
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
    if (!libraryCart.size) {
      switchView("library");
      document.querySelector("#customerCenter")?.classList.add("hidden");
      document.querySelector("#customerSelectionFlow")?.classList.remove("hidden");
      showToast("选稿车为空，请先选择客户并开始看稿。", "warning");
      if (!libraryCustomer.value) libraryCustomer.focus();
      else if (!libraryViewer.value.trim()) libraryViewer.focus();
      return;
    }
    switchView("cart");
    showToast(`已打开选稿车，请先核对 ${libraryCart.size} 件稿件。`, "success");
  }
}

function activeOrderFiles() {
  return new Set(
    studioOrders
      .filter((order) => orderProgressStatus(order) !== "已关闭")
      .flatMap((order) => order.files || [])
  );
}

function libraryEligibleDesigns() {
  const occupiedFiles = activeOrderFiles();
  return [...workCards].filter((card) => {
    if (card.dataset.workRole !== "设计师" || card.classList.contains("deleted") || isSleepingWork(card)) return false;
    if (occupiedFiles.has(card.dataset.file)) return false;
    const summary = cardStatusSummary(card);
    return ["已通过", "初选", "已确认修改", "交付中", "完结"].some((item) => summary.includes(item));
  });
}

function viewerLibraryModeActive() {
  return document.querySelector("#customerSelectionFlow")?.classList.contains("viewer-mode") || false;
}

function libraryCardHtml(card, viewerMode = viewerLibraryModeActive()) {
  const trigger = card.querySelector(".preview-trigger");
  const colorCount = Number(card.dataset.colors || 1);
  const patternClass = trigger?.className.replace("preview-trigger", "").trim() || "pattern pattern-a";
  const imageStyle = card.dataset.imageData ? ` style="background-image:url('${card.dataset.imageData}')"` : "";
  const project = card.querySelector(".work-body > p")?.textContent.replace(/^项目：/, "").trim() || "未关联项目";
  const title = card.querySelector(".work-head strong")?.textContent.trim() || card.dataset.file;
  if (viewerMode) {
    const selected = libraryCart.has(card.dataset.file);
    return `<article class="library-card viewer-library-card" data-library-file="${escapeHtml(card.dataset.file)}">
      <button class="preview-trigger ${patternClass}" type="button"${imageStyle} aria-label="查看 ${escapeHtml(title)}"></button>
      <div class="library-card-info viewer-library-card-info">
        <strong>${escapeHtml(title)}</strong>
        <span>配色 ${colorCount}</span>
      </div>
      <button class="viewer-library-add ${selected ? "selected" : ""}" type="button" data-library-add="${escapeHtml(card.dataset.file)}" aria-label="${selected ? "已加入选稿车" : `将 ${escapeHtml(title)} 加入选稿车`}">${selected ? "✓" : "+"}</button>
    </article>`;
  }
  const checked = libraryCompareSelection.has(card.dataset.file) ? " checked" : "";
  return `<article class="library-card" data-library-file="${card.dataset.file}">
    <label class="library-compare"><input type="checkbox" data-library-compare="${card.dataset.file}"${checked}>比对</label>
    <button class="preview-trigger ${patternClass}" type="button"${imageStyle}>${colorCount > 1 ? `<span class="color-count">${colorCount}</span>` : ""}</button>
    <div class="library-card-info">
      <strong>${card.dataset.file}</strong>
      <span>${escapeHtml(project)}</span>
      <p>标签：${escapeHtml(cardTagsText(card))}</p>
    </div>
  </article>`;
}

// ================= 客户中心 =================
const customerCenterBase = [
  { display: "晨光家纺", contact: "张宇", region: "江苏·南通", type: "品牌客户", status: "合作中", style: "法式 / 低饱和 / 水彩", product: "四件套、被套、枕套", note: "重色彩统一与细节品质，偏好手绘风格，交付需含授权文件。" },
  { display: "云朵小镇童装", contact: "林悦", region: "浙江·杭州", type: "品牌客户", status: "合作中", style: "童趣 / 明亮 / 扁平插画", product: "童装面料、图库", note: "偏爱可爱童趣元素，色彩明快，需适配童装印花。" },
  { display: "优眠生活家居", contact: "王敏", region: "广东·佛山", type: "品牌客户", status: "合作中", style: "极简 / 莫兰迪 / 数字绘画", product: "床品、家居软装", note: "极简风格，低饱和配色，注重面料适配。" },
  { display: "南通尚东纺织", contact: "刘洋", region: "江苏·南通", type: "渠道客户", status: "合作中", style: "复古 / 暖调 / 水彩", product: "四件套、面料批发", note: "以四方连续为主，走量为主，交付周期敏感。" },
  { display: "澳都袋鼠家纺", contact: "赵磊", region: "澳大利亚·悉尼", type: "品牌客户", status: "合作中", style: "现代 / 中性 / 数字绘画", product: "床品、家居用品", note: "需英文授权书与高分辨率源文件。" },
  { display: "森语家居", contact: "吴静", region: "浙江·宁波", type: "品牌客户", status: "合作中", style: "自然 / 绿色系 / 彩铅", product: "家居软装、墙纸", note: "自然植物题材，绿色系为主。" },
  { display: "北欧简居生活", contact: "周涛", region: "北京", type: "品牌客户", status: "合作中", style: "极简 / 黑白灰 / 线稿", product: "墙纸、面料", note: "极简线稿风格，黑白灰为主。" },
  { display: "喜寐寝具", contact: "钱蕾", region: "江苏·苏州", type: "品牌客户", status: "暂停合作", style: "古典 / 东方 / 水彩", product: "四件套、枕套", note: "东方古典题材，目前合作暂停。" },
  { display: "花田里家居", contact: "孙倩", region: "云南·昆明", type: "定制客户", status: "合作中", style: "法式 / 甜美 / 水彩", product: "床品、丝巾", note: "花卉植物为主，法式甜美风。" },
  { display: "橙意生活", contact: "郑凯", region: "福建·厦门", type: "渠道客户", status: "潜在客户", style: "现代 / 橙色系 / 扁平插画", product: "家居软装", note: "潜在客户，尚未正式下单。" },
  { display: "月见和风", contact: "田薇", region: "日本·大阪", type: "品牌客户", status: "合作中", style: "日系 / 低饱和 / 彩铅", product: "面料、丝巾", note: "日系风格，低饱和配色。" },
  { display: "小柯童品", contact: "何昕", region: "广东·广州", type: "品牌客户", status: "合作中", style: "童趣 / 明亮 / 扁平插画", product: "儿童用品、面料", note: "儿童题材，安全环保面料要求。" },
  { display: "青瓷纺织", contact: "冯磊", region: "浙江·龙泉", type: "渠道客户", status: "合作中", style: "东方 / 青色系 / 水彩", product: "四件套、墙布", note: "青瓷主题，东方审美。" },
  { display: "暖岛家纺", contact: "许诺", region: "山东·青岛", type: "品牌客户", status: "潜在客户", style: "甜美 / 粉色系 / 数字绘画", product: "床品、抱枕", note: "潜在客户，偏甜美粉色系。" },
  { display: "拾光文创", contact: "邓超", region: "四川·成都", type: "定制客户", status: "合作中", style: "复古 / 暖调 / 版画", product: "文创、包装、丝巾", note: "复古文创风，版画质感。" },
];

const CUSTOMER_PAGE_SIZE = 11;
let customerCenterClients = [];
let activeCustomerCenterId = null;
let activeCustomerTab = "overview";
let customerCenterPage = 1;
let customerCenterFilter = "all";
let openCustomerMenuId = null;
const CUSTOMER_STATUS_OPTIONS = ["合作中", "暂停合作", "潜在客户"];
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
      status: customer.status || "合作中",
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
      ...customer,
      id,
      loginAccount: customer.loginAccount || customerLoginAccount(id),
      loginPassword: customer.loginPassword || genCustomerPassword(id),
    };
  });
  const savedIds = new Set(savedClients.map((client) => client.id));
  const savedNames = new Set(savedClients.map((client) => client.name));
  return [
    ...savedClients,
    ...baseClients.filter((client) => !savedIds.has(client.id) && !savedNames.has(client.name)),
  ];
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
  if (customerCenterFilter === "all") return customerCenterClients;
  return customerCenterClients.filter((c) => c.status === customerCenterFilter);
}

function approvedLibraryCards() {
  return [...workCards].filter((card) =>
    !card.classList.contains("deleted") && fieldValue(card, "审核状态").includes("已通过")
  );
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

function customerTagClass(tag) {
  if (tag === "合作中") return "cc-tag-green";
  if (["暂停合作", "潜在客户"].includes(tag)) return "cc-tag-amber";
  return "cc-tag-gray";
}

function customerStatusClass(status) {
  if (status === "合作中") return "cc-status-green";
  if (status === "暂停合作") return "cc-status-amber";
  return "cc-status-gray";
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
  const filterBar = document.querySelector("#customerListFilter");
  if (!listBody) return;
  if (filterBar) {
    const filters = [["all", "全部"], ["合作中", "合作中"], ["暂停合作", "暂停合作"], ["潜在客户", "潜在客户"]];
    filterBar.innerHTML = filters.map(([key, label]) =>
      `<button type="button" class="cc-filter-pill ${key === customerCenterFilter ? "active" : ""}" data-cc-filter="${key}">${label}</button>`
    ).join("");
  }
  const list = filteredCustomerClients();
  const total = list.length;
  if (countEl) countEl.textContent = `客户列表（${total}）`;
  const pages = Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE));
  customerCenterPage = Math.min(customerCenterPage, pages);
  const startIndex = (customerCenterPage - 1) * CUSTOMER_PAGE_SIZE;
  const pageItems = list.slice(startIndex, startIndex + CUSTOMER_PAGE_SIZE);
  listBody.innerHTML = pageItems.length ? pageItems.map((client) => {
    const statusButtons = CUSTOMER_STATUS_OPTIONS.map((s) =>
      `<button type="button" data-cc-set-status="${s}" data-cc-status-id="${escapeHtml(client.id)}" class="${s === client.status ? "current" : ""}">${s}</button>`
    ).join("");
    return `
    <div class="cc-row ${client.id === activeCustomerCenterId ? "active" : ""}" data-customer-id="${escapeHtml(client.id)}" role="button" tabindex="0">
      <span class="cc-cell cc-cell-name">${escapeHtml(client.name)}</span>
      <span class="cc-cell cc-cell-contact">${escapeHtml(client.contact)}</span>
      <span class="cc-cell cc-cell-count">${customerRealPurchased(client)} 款</span>
      <span class="cc-cell cc-cell-date">${escapeHtml(customerRealLastBuy(client))}</span>
      <span class="cc-cell cc-cell-status"><em class="${customerStatusClass(client.status)}">${escapeHtml(client.status)}</em></span>
      <span class="cc-row-action">
        <button class="cc-row-menu-btn" type="button" data-customer-menu="${escapeHtml(client.id)}" aria-label="更多操作">⋯</button>
        <div class="cc-row-menu ${openCustomerMenuId === client.id ? "" : "hidden"}">
          <div class="cc-menu-label">更改合作状态</div>
          ${statusButtons}
          <div class="cc-menu-sep"></div>
          <button class="cc-menu-danger" type="button" data-customer-delete="${escapeHtml(client.id)}">删除客户</button>
        </div>
      </span>
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
}

function renderCustomerDetail() {
  const panel = document.querySelector("#customerDetailPanel");
  if (!panel) return;
  const client = activeCustomerClient();
  if (!client) {
    panel.innerHTML = `<p class="empty-state">请选择左侧客户查看档案。</p>`;
    return;
  }
  if (!client.loginAccount) client.loginAccount = customerLoginAccount(client.id);
  if (!client.loginPassword) client.loginPassword = genCustomerPassword(client.id);
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
        <div class="cc-detail-tags"><span class="cc-detail-tag ${customerTagClass(client.status)}">${escapeHtml(client.status)}</span></div>
      </div>
      <div class="cc-detail-actions">
        <button class="primary-button" type="button" data-customer-start-selection="${escapeHtml(client.id)}">开始选稿</button>
      </div>
    </div>
    <div class="cc-meta-row">${metaHtml}</div>
    <div class="cc-login-box">
      <div class="cc-login-field"><span>客户登录账号</span><strong>${escapeHtml(client.loginAccount)}</strong></div>
      <div class="cc-login-field"><span>登录密码</span><strong>${escapeHtml(client.loginPassword)}</strong></div>
      <button class="ghost-button" type="button" data-cc-copy-login="${escapeHtml(client.id)}">复制发给客户</button>
    </div>
    <div class="cc-tabs">${tabsHtml}</div>
    <div class="cc-tab-body">${renderCustomerTabBody(client)}</div>`;
}

function renderCustomerTabBody(client) {
  if (activeCustomerTab === "overview") return customerOverviewHtml(client);
  if (activeCustomerTab === "works") return customerWorksHtml(client, 12);
  if (activeCustomerTab === "history") {
    const list = customerOrdersOf(client).slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    if (!list.length) return `<div class="cc-plain">该客户还没有订单记录。</div>`;
    return `<div class="cc-history">${list.map((o) => {
      const n = orderPatternList(o).length;
      const paid = o.paymentStatus === "已支付";
      const amount = (o.price != null ? Number(o.price) : n * 100).toFixed(2);
      return `<button class="cc-hist-row" type="button" data-cc-open-order="${escapeHtml(o.id)}">
        <span class="cc-hist-main"><strong>${escapeHtml(o.id)}</strong><small>${escapeHtml(o.createdAt || "—")} · ${n} 款花型</small></span>
        <span class="cc-hist-right"><em>¥${amount}</em>
        <i class="cc-hist-tag ${paid ? "ok" : ""}">${paid ? "已支付" : "未支付"}</i>
        <i class="cc-hist-tag ${orderDeliverStatus(o) === "已交付" ? "ok" : ""}">${escapeHtml(orderDeliverStatus(o))}</i></span>
      </button>`;
    }).join("")}</div>`;
  }
  if (activeCustomerTab === "profile") return customerProfileCardHtml(client);
  if (activeCustomerTab === "follow") return `<div class="cc-plain">暂无跟进记录。可在此登记客户沟通、报价与回访。</div>`;
  return "";
}

function customerOverviewHtml(client) {
  const works = customerRecentWorks(client, 8);
  const worksHtml = works.length
    ? works.map((card) => `<button class="cc-flower-item" type="button" data-customer-open-work="${escapeHtml(card.dataset.file)}">
        <span class="cc-flower-thumb" style="${card.dataset.imageData ? `background-image:url('${card.dataset.imageData}')` : ""}"></span>
        <span class="cc-flower-code">${escapeHtml(card.dataset.file)}</span>
      </button>`).join("")
    : `<p class="empty-state">暂无花型记录。</p>`;
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
        <div class="cc-flower-grid">${worksHtml}</div>
      </section>
    </div>`;
}

function customerWorksHtml(client, count) {
  const works = customerRecentWorks(client, count);
  if (!works.length) return `<p class="empty-state">暂无已购花型。</p>`;
  return `<div class="cc-works-grid">${works.map((card) => `
    <button class="cc-work-tile" type="button" data-customer-open-work="${escapeHtml(card.dataset.file)}">
      <span class="cc-work-thumb" style="${card.dataset.imageData ? `background-image:url('${card.dataset.imageData}')` : ""}"></span>
      <strong>${escapeHtml(card.dataset.file)}</strong>
    </button>`).join("")}</div>`;
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
      <div><span>状态</span><strong>${escapeHtml(client.status)}</strong></div>
      <div><span>所在地区</span><strong>${escapeHtml(client.region)}</strong></div>
    </div></section></div>`;
}

function renderLibraryGrid() {
  if (!libraryGrid) return;
  if (!librarySessionActive) {
    libraryGrid.innerHTML = `<p class="empty-state">确认客户和选稿人后开始选稿。</p>`;
    return;
  }
  const viewerMode = viewerLibraryModeActive();
  const designs = viewerMode ? filteredViewerLibraryDesigns() : libraryEligibleDesigns();
  const schemeCards = [];
  libraryGrid.innerHTML = designs.length
    ? [...designs.map((card) => libraryCardHtml(card, viewerMode)), ...schemeCards].join("")
    : `<p class="empty-state">暂无可供客户选择的设计稿。审核通过后的设计稿会出现在这里。</p>`;
  libraryGrid.classList.toggle("viewer-customer-grid", viewerMode);
  libraryGrid.classList.toggle("cards-info-hidden", !viewerMode && libraryInfoHidden);
  libraryStatus.textContent = `${libraryCustomer.value} / 选稿人：${libraryViewer.value.trim()} / 可看 ${designs.length + schemeCards.length} 组稿件`;
  if (viewerLibraryResultCount) viewerLibraryResultCount.textContent = `共找到 ${designs.length} 个作品`;
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
      const trigger = card?.querySelector(".preview-trigger");
      const patternClass = trigger?.className.replace("preview-trigger", "").trim() || "pattern pattern-a";
      const imageStyle = card?.dataset.imageData ? ` style="background-image:url('${card.dataset.imageData}')"` : "";
      return `<article class="cart-item" data-cart-file="${file}">
        <button class="cart-thumb ${patternClass}" type="button"${imageStyle}></button>
        <div><strong>${escapeHtml(file)}</strong><span>${escapeHtml(cardTagsText(card))}</span></div>
        <button class="cart-remove" type="button" data-cart-remove="${file}">移除</button>
      </article>`;
    })
    .join("");
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
    ["许然", "林若", "阿沁", "陈一"].forEach((name) => {
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
    agreementStatus: "未发起",
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
      return [order.id, order.customer, order.viewer, orderProgressStatus(order), ...(order.files || []), ...(order.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
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
      const trigger = card?.querySelector(".preview-trigger");
      const patternClass = trigger?.className.replace("preview-trigger", "").trim() || "pattern pattern-a";
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

let orderExpandedId = null;

function orderDeliverStatus(order) {
  return order.deliverStatus || (orderProgressStatus(order) === "已完成" ? "已交付" : "未交付");
}

function orderAgreementStatus(order) {
  return order.agreementStatus || "未发起";
}

function orderPatternList(order) {
  if (order.patternIds?.length) return order.patternIds;
  return (order.files || []).map((f) => f?.name || f).filter(Boolean);
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
  });
}

function orderRowHtml(order, idx) {
  const patterns = orderPatternList(order);
  const name = patterns.length ? `${patterns[0]}${patterns.length > 1 ? ` 等 ${patterns.length} 款` : ""}` : `${order.customer || "客户"} 订单`;
  const priceVal = orderPriceValue(order);
  const priceCell = canEditOrderPrice()
    ? `<button class="order-price-btn ${priceVal == null ? "todo" : ""}" type="button" data-order-price="${escapeHtml(order.id)}" title="点击修改价格">${priceVal == null ? "待输入" : `¥${priceVal.toFixed(2)}`}</button>`
    : `<span class="${priceVal == null ? "order-price-todo" : ""}">${orderPriceText(order)}</span>`;
  const time = order.createdAt || order.time || "—";
  const user = order.viewer || order.customer || "—";
  const deliver = orderDeliverStatus(order);
  const agreement = orderAgreementStatus(order);
  const expanded = orderExpandedId === order.id;
  // 只有展开的那一行才生成缩略图（base64 内联很重，折叠时不渲染，避免生成订单/刷新列表卡顿）
  const thumbs = expanded ? patterns.slice(0, 12).map((f) => {
    const c = sourceCardByFile(f);
    const img = c?.dataset.imageData ? `background-image:url('${c.dataset.imageData}')` : "";
    return `<span class="order-flower" style="${img}" title="${escapeHtml(f)}"></span>`;
  }).join("") : "";
  return `<tr class="order-row" data-order-row="${escapeHtml(order.id)}">
      <td class="order-cell-index">${idx + 1}</td>
      <td class="order-cell-number">${escapeHtml(order.id)}</td>
      <td class="order-cell-product">${escapeHtml(name)}</td>
      <td class="order-cell-price">${priceCell}</td>
      <td class="order-cell-time">${escapeHtml(time)}</td>
      <td class="order-cell-user">${escapeHtml(user)}</td>
      <td class="order-cell-status">
        <span class="order-deliver ${deliver === "已交付" ? "done" : "pending"}">${deliver}</span>
        ${agreement === "客户已回传" ? `<span class="order-flag act">待审核签署件</span>` : ""}
        ${order.paymentStatus === "已支付" ? `<span class="order-flag paid">已支付</span>` : ""}
      </td>
      <td class="order-cell-operation">
        <div class="order-actions">
          <div class="order-actions-main">
            <button class="order-deliver-btn ${deliver === "已交付" ? "delivered" : ""} ${agreement === "待客户签署" && deliver !== "已交付" ? "awaiting-signature" : ""}" type="button" data-order-toggle-deliver="${escapeHtml(order.id)}" title="${deliver === "已交付" ? "取消本次交付" : agreement === "已签署" ? "交付已解锁作品" : "客户签署协议后方可交付"}">${deliver === "已交付" ? "取消交付" : agreement === "待客户签署" ? "待签署" : "交付"}</button>
            <div class="order-menu-wrap">
              <button class="order-menu-btn" type="button" data-order-menu="${escapeHtml(order.id)}" aria-label="更多操作" title="更多操作">⋯</button>
              <div class="order-menu-pop hidden" data-order-menu-pop="${escapeHtml(order.id)}">
                <button type="button" data-order-detail="${escapeHtml(order.id)}">查看详情</button>
                ${agreement !== "已签署" ? `<button type="button" data-order-upload-agreement="${escapeHtml(order.id)}">上传协议</button>` : ""}
                <button type="button" data-order-close="${escapeHtml(order.id)}">关闭订单</button>
                ${deliver !== "已交付" ? `<button type="button" class="danger" data-order-delete="${escapeHtml(order.id)}">删除订单</button>` : ""}
              </div>
            </div>
          </div>
          <button class="order-expand-btn ${expanded ? "open" : ""}" type="button" data-order-expand="${escapeHtml(order.id)}" aria-label="查看详情" title="${expanded ? "收起" : "展开详情"}">▾</button>
        </div>
      </td>
    </tr>
    <tr class="order-expand ${expanded ? "" : "hidden"}"><td colspan="8">
      <div class="order-expand-inner">
        <strong>本单花型（${patterns.length}）</strong>
        <div class="order-flowers">${thumbs || '<span class="order-flower-empty">无花型明细</span>'}${patterns.length > 12 ? `<span class="order-flower-more">+${patterns.length - 12}</span>` : ""}</div>
      </div>
    </td></tr>`;
}

function renderOrderCenter() {
  if (!orderList) return;
  const orders = orderTableFiltered();
  orderList.innerHTML = orders.length
    ? `<table class="order-table">
      <colgroup>
        <col class="order-col-index" />
        <col class="order-col-number" />
        <col class="order-col-product" />
        <col class="order-col-price" />
        <col class="order-col-time" />
        <col class="order-col-user" />
        <col class="order-col-status" />
        <col class="order-col-operation" />
      </colgroup>
      <thead><tr>
        <th>序号</th><th>订单号</th><th>商品名称</th><th>商品价格</th><th>下单时间</th><th>下单用户</th><th>订单状态</th><th>操作</th>
      </tr></thead><tbody>${orders.map((o, i) => orderRowHtml(o, i)).join("")}</tbody></table>`
    : `<p class="empty-state">暂无订单。客户选稿后点击「生成订单」会显示在这里。</p>`;
}

/* ============ 订单生命周期详情页（内嵌产品内，真实数据驱动） ============ */
function orderLifecycleModel(order) {
  const agrRaw = orderAgreementStatus(order); // 未发起 / 待客户签署 / 客户已回传 / 审核驳回 / 已签署
  const agreement = agrRaw === "已签署" ? "signed"
    : agrRaw === "客户已回传" ? "reviewing"
    : agrRaw === "审核驳回" ? "rejected"
    : agrRaw === "待客户签署" ? "awaiting_signature"
    : order.agreementUploaded ? "agreement_uploaded" : "no_agreement";
  // 支付状态只认显式标记，绝不因"已交付"就推断成已支付
  const payment = order.paymentStatus === "已支付" ? "paid" : "unpaid";
  const delivered = orderDeliverStatus(order) === "已交付";
  const delivery = delivered ? "downloaded" : order.deliveryPrepared ? "prepared_locked" : "not_ready";
  return { agreement, payment, delivery, delivered };
}

const OD_LABELS = {
  agreement: { no_agreement: "未上传协议", agreement_uploaded: "协议已上传", awaiting_signature: "待客户签署", reviewing: "客户已回传 · 待审核", rejected: "审核驳回", signed: "已签署" },
  payment: { unpaid: "未支付", paid: "已支付" },
  delivery: { not_ready: "未准备", prepared_locked: "已准备待付款", downloaded: "已交付" },
};

/* 订单价格：默认「待输入」——价格线下商定后由管理员/销售录入 */
function orderPriceValue(order) {
  if (order && order.price != null && order.price !== "" && !Number.isNaN(Number(order.price))) return Number(order.price);
  return null;
}
function orderPriceText(order) {
  const v = orderPriceValue(order);
  return v == null ? "待输入" : `¥${v.toFixed(2)}`;
}
function canEditOrderPrice() {
  return currentAccount.role === "管理员" || currentAccount.role === "销售";
}
function editOrderPrice(orderId) {
  if (!canEditOrderPrice()) return;
  const order = studioOrders.find((o) => o.id === orderId);
  if (!order) return;
  if (order.paymentStatus === "已支付") { showToast("订单已支付，价格不可再修改。", "warning"); return; }
  const cur = orderPriceValue(order);
  const input = window.prompt(`设置订单 ${order.id} 的成交价格（元）：`, cur == null ? "" : String(cur));
  if (input === null) return;
  const v = Number(String(input).trim());
  if (!Number.isFinite(v) || v < 0) { showToast("请输入有效的价格数字。", "warning"); return; }
  const before = cur == null ? "待输入" : `¥${cur.toFixed(2)}`;
  order.price = v;
  logOrderEvent(order, `订单价格由 ${before} 变更为 ¥${v.toFixed(2)}`, currentAccount.role || "员工");
  saveStudioState();
  renderOrderCenter();
  if (activeOrderDetailId === order.id) renderOrderDetailBody(order);
  showToast(`订单 ${order.id} 价格已更新为 ¥${v.toFixed(2)}`, "success");
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
      background:#fafaf9;box-shadow:-8px 0 40px rgba(0,0,0,.18);overflow-y:auto;animation:odxIn .2s ease}
    @keyframes odxIn{from{transform:translateX(30px);opacity:.6}to{transform:none;opacity:1}}
    .odx-head{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #eae8e4;position:sticky;top:0;background:#fafaf9;z-index:2}
    .odx-head h2{margin:0;font-size:18px}
    .odx-close{border:none;background:none;font-size:22px;color:#78716c;cursor:pointer;line-height:1}
    .odx-body{padding:22px 24px 40px}
    .odx-card{background:#fff;border:1px solid #eae8e4;border-radius:16px;padding:18px 20px;margin-bottom:16px}
    .odx-order{display:flex;gap:16px;align-items:center}
    .odx-thumb{width:80px;height:80px;border-radius:10px;flex:none;background:linear-gradient(135deg,#efe9df,#e6ded0);border:1px solid #eae8e4;background-size:cover;background-position:center}
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
    .odx-stat .s{border:1px solid #eae8e4;border-radius:10px;padding:10px 12px}
    .odx-stat .k{font-size:12px;color:#a8a29e}.odx-stat .v{font-size:14px;font-weight:600;margin-top:2px}
    .odx-primary{width:100%;padding:14px;border:none;border-radius:10px;background:#1c1917;color:#fff;font-size:15px;font-weight:500;cursor:pointer;margin-top:18px}
    .odx-primary:hover{background:#000}.odx-primary.wait{background:#faf9f8;color:#a8a29e;border:1.5px dashed #e2e0dc;cursor:default}
    .odx-pt{font-size:15px;font-weight:600;margin:0 0 12px}
    .odx-note{font-size:13px;color:#57534e;line-height:1.6}
    .odx-locks{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
    .odx-lock{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#efe9df,#e6ded0);border:1px solid #eae8e4;background-size:cover;background-position:center}
    .odx-lock .ov{position:absolute;inset:0;background:rgba(20,18,16,.5);display:grid;place-items:center;color:#fff;text-align:center;font-size:11px}
    .odx-file{display:flex;align-items:center;justify-content:space-between;border:1px solid #eae8e4;border-radius:10px;padding:11px 14px;margin-top:10px}
    .odx-file .n{font-size:14px;font-weight:500}.odx-file .s{font-size:12px;color:#a8a29e}
    .odx-btn{padding:11px 16px;border-radius:10px;font-size:14px;cursor:pointer;border:1.5px solid #e2e0dc;background:#fff;color:#1c1917}
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
function openOrderDetail(orderId) {
  const order = studioOrders.find((o) => o.id === orderId);
  if (!order) return;
  ensureOrderDetailOverlay();
  activeOrderDetailId = orderId;
  renderOrderDetailBody(order);
  document.getElementById("orderDetailOverlay").classList.add("open");
  lockBodyScroll(true);
}
function renderOrderDetailBody(order) {
  const body = document.getElementById("orderDetailBody");
  if (!body) return;
  const isCustomer = currentAccount.role === "客户";
  const L = orderLifecycleModel(order);
  const patterns = orderPatternList(order);
  const name = patterns.length ? `${patterns[0]}${patterns.length > 1 ? ` 等 ${patterns.length} 款` : ""}` : `${order.customer || "客户"} 订单`;
  const price = order.price != null ? Number(order.price).toFixed(2) : (patterns.length * 100).toFixed(2);
  const firstCard = sourceCardByFile(patterns[0]);
  const thumbBg = firstCard?.dataset.imageData ? `background-image:url('${firstCard.dataset.imageData}')` : "";
  // 时间线
  const stageIdx = L.agreement !== "signed" ? 0 : L.payment !== "paid" ? 1 : L.delivery !== "downloaded" ? 2 : 3;
  const stages = ["签约", "支付", "交付", "完成"];
  const stepsHtml = stages.map((s, i) => `<div class="odx-step ${i < stageIdx ? "done" : i === stageIdx ? "active" : ""}"><div class="d">${i < stageIdx ? "✓" : i + 1}</div><div class="t">${s}</div></div>`).join("");
  // 主区（按角色 + 阶段）
  let action = "";
  if (L.agreement !== "signed") {
    if (isCustomer) {
      action = (L.agreement === "awaiting_signature" || L.agreement === "rejected")
        ? `${L.agreement === "rejected" ? `<div class="odx-note" style="color:#dc2626;margin-bottom:10px">签署文件被驳回${order.reviewRemark ? "：" + escapeHtml(order.reviewRemark) : ""}，请重新上传。</div>` : ""}<button class="odx-btn dark" style="width:100%" data-od-action="sign">${L.agreement === "rejected" ? "重新上传签署文件" : "查看并签署"}</button>`
        : L.agreement === "reviewing"
        ? `<div class="odx-note">已回传签署文件，工作室审核中，通过后即可支付。</div>`
        : `<div class="odx-note">销售正在准备协议，请稍候。</div>`;
    } else {
      action = L.agreement === "no_agreement"
        ? `<button class="odx-btn dark" style="width:100%" data-od-action="upload-agreement">上传协议</button>`
        : L.agreement === "agreement_uploaded"
        ? `<button class="odx-btn dark" style="width:100%" data-od-action="upload-agreement">发起签约</button>`
        : L.agreement === "rejected"
        ? `<div class="odx-note">已驳回，等待客户重新上传签署文件。</div>`
        : `<div class="odx-note">已发起签约，等待客户下载、签署并回传。</div><button class="odx-btn" style="margin-top:12px" data-od-action="upload-agreement">提醒客户签署</button>`;
    }
  } else if (L.payment !== "paid") {
    action = isCustomer
      ? `<div class="odx-note">合同已生效，请完成付款以解锁正式交付文件。</div>
         <button class="odx-btn dark" style="width:100%;margin-top:12px" data-od-action="pay">立即支付</button>`
      : `<div class="odx-note">已签署，等待客户付款。付款成功后自动解锁交付。</div>`;
  } else {
    // 已付款 / 已签署
    if (isCustomer) {
      action = L.delivered
        ? `<div class="odx-file"><div><div class="n">交付包（PSD/TIFF/授权书）</div><div class="s">下载链接有效期 30 分钟</div></div><button class="odx-btn" data-od-action="download">下载</button></div>`
        : `<div class="odx-note">款项已到账，工作室正在准备交付文件。</div>`;
    } else {
      action = `<button class="odx-btn ${L.delivered ? "" : "dark"}" style="width:100%" data-od-action="toggle-deliver">${L.delivered ? "取消交付" : "交付并解锁作品"}</button>`;
    }
  }
  // 员工端：客户回传的签署文件（不阻塞支付，仅供核验存档）
  const signedCard = (!isCustomer && order.signedFileUploaded) ? `<div class="odx-card">
    <div class="odx-pt">客户签署文件${order.signedReviewPending ? ` <span class="odx-badge">待核验</span>` : ""}</div>
    <div class="odx-file">
      <div class="odx-file-meta"><div class="n">${escapeHtml(order.signedFileName || "已签署文件")}</div>
      <div class="s">回传于 ${escapeHtml(order.signedSubmittedAt || "—")}</div></div>
      <button class="odx-btn" data-od-action="view-signed">下载</button>
    </div>
    ${order.signedReviewPending ? `<div class="odx-btnrow"><button class="odx-btn dark" data-od-action="ack-signed">标记已核验</button><button class="odx-btn" style="color:#dc2626;border-color:#f3c0c0" data-od-action="reject-sign">要求重新签署</button></div>` : ""}
  </div>` : "";
  const lockPreview = "";

  body.innerHTML = `
    <div class="odx-card odx-order">
      <div class="odx-thumb" style="${thumbBg}"></div>
      <div><h3>${escapeHtml(name)}</h3>
        <div class="m">订单编号　<b>${escapeHtml(order.id)}</b><br>下单用户　<b>${escapeHtml(order.viewer || order.customer || "—")}</b><br>应付金额　<b>¥${price}</b></div>
      </div>
    </div>
    <div class="odx-card">
      <div class="odx-steps">${stepsHtml}</div>
      <div class="odx-stat">
        <div class="s"><div class="k">签约状态</div><div class="v">${OD_LABELS.agreement[L.agreement]}</div></div>
        <div class="s"><div class="k">支付状态</div><div class="v">${OD_LABELS.payment[L.payment]}</div></div>
        <div class="s"><div class="k">交付状态</div><div class="v">${OD_LABELS.delivery[L.delivery]}</div></div>
        <div class="s"><div class="k">订单状态</div><div class="v">${escapeHtml(orderProgressStatus(order))}</div></div>
      </div>
      <div style="margin-top:18px">${action}</div>
    </div>
    ${signedCard}${lockPreview}
    ${(order.activity && order.activity.length) ? `<div class="odx-card"><div class="odx-pt">订单动态</div>
      <div class="odx-feed">${order.activity.slice(0, 12).map((a) => `<div class="odx-ev"><span class="odx-ev-who ${a.who === "客户" ? "cust" : ""}">${escapeHtml(a.who)}</span><div><div class="odx-ev-t">${escapeHtml(a.text)}</div><div class="odx-ev-d">${escapeHtml(a.t)}</div></div></div>`).join("")}</div></div>` : ""}
    <div class="odx-card"><div class="odx-pt">本单花型（${patterns.length}）</div>
      <div class="odx-locks">${patterns.slice(0, 6).map((f) => { const c = sourceCardByFile(f); const bg = c?.dataset.imageData ? `background-image:url('${c.dataset.imageData}')` : ""; return `<div class="odx-lock" style="${bg}"></div>`; }).join("") || '<div class="odx-note">无花型明细</div>'}</div>
    </div>`;

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
  if (orderPriceValue(order) == null) {
    showToast("该订单尚未定价，请联系工作室确认价格后再支付。", "warning");
    return;
  }
  const patterns = orderPatternList(order);
  const payable = orderPriceValue(order) || 0;
  let ov = document.getElementById("payOverlay");
  if (!ov) {
    const st = document.createElement("style");
    st.textContent = `
      #payOverlay{position:fixed;inset:0;z-index:1400;display:none}
      #payOverlay.open{display:block}
      #payOverlay .pv-scrim{position:absolute;inset:0;background:rgba(20,18,16,.6)}
      #payOverlay .pv-box{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(920px,94vw);max-height:88vh;background:#fafaf9;border-radius:18px;overflow:hidden;display:flex;flex-direction:column}
      #payOverlay .pv-head{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;
        background:#fff;border-bottom:1px solid #eae8e4}
      #payOverlay .pv-head h3{margin:0;font-size:18px}
      #payOverlay .pv-x{border:none;background:none;font-size:22px;color:#78716c;cursor:pointer}
      #payOverlay .pv-body{display:grid;grid-template-columns:1.3fr 1fr;gap:20px;padding:22px 24px;overflow:hidden;flex:1}
      #payOverlay .pv-col{overflow-y:auto;overscroll-behavior:contain;padding-right:6px}
      #payOverlay .pv-card{background:#fff;border:1px solid #eae8e4;border-radius:14px;padding:16px 18px;margin-bottom:14px}
      #payOverlay .pv-item{display:flex;gap:14px;align-items:center}
      #payOverlay .pv-item+.pv-item{margin-top:14px;padding-top:14px;border-top:1px solid #f0eeeb}
      #payOverlay .pv-th{width:64px;height:64px;border-radius:10px;flex:none;background:#f0ece6 center/cover no-repeat;border:1px solid #eae8e4}
      #payOverlay .pv-nm{font-size:14px;font-weight:500}
      #payOverlay .pv-cd{font-size:12px;color:#a8a29e;margin-top:3px}
      #payOverlay .pv-row{display:flex;justify-content:space-between;font-size:14px;color:#57534e;padding:6px 0}
      #payOverlay .pv-total{display:flex;justify-content:space-between;align-items:baseline;
        border-top:1px dashed #e2e0dc;margin-top:10px;padding-top:12px}
      #payOverlay .pv-total .v{font-size:24px;font-weight:800;color:#e02424}
      #payOverlay .pv-m{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1.5px solid #e2e0dc;
        border-radius:12px;margin-bottom:10px;cursor:pointer}
      #payOverlay .pv-m:hover{border-color:#a8a29e}
      #payOverlay .pv-m.on{border-color:#1c1917;box-shadow:0 0 0 1px #1c1917 inset}
      #payOverlay .pv-ic{width:30px;height:30px;border-radius:8px;flex:none;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:700}
      #payOverlay .pv-mn{flex:1;font-size:14px}
      #payOverlay .pv-tip{font-size:12px;color:#a8a29e}
      #payOverlay .pv-pay{width:100%;padding:14px;border:none;border-radius:10px;background:#15703c;color:#fff;
        font-size:15px;font-weight:500;cursor:pointer;margin-top:6px}
      #payOverlay .pv-pay:hover{background:#125f33}
      #payOverlay .pv-note{font-size:12px;color:#a8a29e;text-align:center;margin-top:10px}
      @media(max-width:820px){#payOverlay .pv-body{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
    ov = document.createElement("div");
    ov.id = "payOverlay";
    ov.innerHTML = `<div class="pv-scrim" data-pv-close></div>
      <div class="pv-box"><div class="pv-head"><h3>确认并支付</h3><button class="pv-x" data-pv-close>×</button></div>
      <div class="pv-body" id="pvBody"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target.closest("[data-pv-close]")) closePaymentOverlay(); });
  }
  const METHODS = [
    { k: "wechat", n: "微信支付", c: "#22ac38", t: "微" },
    { k: "alipay", n: "支付宝", c: "#1677ff", t: "支" },
    { k: "bank", n: "对公转账", c: "#78716c", t: "公" },
  ];
  document.getElementById("pvBody").innerHTML = `
    <div class="pv-col">
      <div class="pv-card">${patterns.map((f) => {
        const c = sourceCardByFile(f);
        const nm = c?.querySelector(".work-head strong")?.textContent.trim() || f;
        const bg = c?.dataset.imageData ? `background-image:url('${c.dataset.imageData}')` : "";
        return `<div class="pv-item"><div class="pv-th" style="${bg}"></div>
          <div><div class="pv-nm">${escapeHtml(nm)}</div><div class="pv-cd">${Number(c?.dataset.colors || 1)} 配色</div></div></div>`;
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
        <div class="pv-row"><span>商品金额</span><span>¥${payable.toFixed(2)}</span></div>
        <div class="pv-row"><span>优惠金额</span><span>¥0.00</span></div>
        <div class="pv-total"><span style="font-size:15px;font-weight:600">应付金额</span><span class="v">¥${payable.toFixed(2)}</span></div>
        <button class="pv-pay" data-pv-confirm="${escapeHtml(order.id)}">标记为已支付（TEST）</button>
        <div class="pv-note">测试模式：真实支付通道接入后此按钮将移除</div>
      </div>
    </div>`;
  const body = document.getElementById("pvBody");
  body.querySelectorAll("[data-pv-method]").forEach((el) => {
    el.addEventListener("click", () => body.querySelectorAll(".pv-m").forEach((x) => x.classList.toggle("on", x === el)));
  });
  body.querySelector("[data-pv-confirm]")?.addEventListener("click", () => {
    const method = body.querySelector(".pv-m.on")?.dataset.pvMethod || "";
    confirmPaymentPaid(order, method);
  });
  logOrderEvent(order, "客户进入支付页", "客户");
  saveStudioState();
  ov.classList.add("open");
  lockBodyScroll(true);
}
function closePaymentOverlay() {
  document.getElementById("payOverlay")?.classList.remove("open");
  lockBodyScroll(false);
}
function confirmPaymentPaid(order, method) {
  if (order.paymentStatus === "已支付") { closePaymentOverlay(); return; }
  order.paymentStatus = "已支付";
  order.paidAt = formatDateTime();
  order.paidAmount = orderPriceValue(order);
  order.paidMethod = method || "";
  logOrderEvent(order, `支付成功${method ? "（" + method + "）" : ""} · TEST 模拟`, "客户");
  saveStudioState();
  closePaymentOverlay();
  renderOrderCenter();
  if (typeof renderMyOrders === "function") renderMyOrders();
  if (typeof renderMyPatternLibrary === "function") renderMyPatternLibrary();
  updateSidebarBadges();
  showToast(`支付成功！花型已加入你的花型库，等待工作室交付解锁。`, "success");
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
  const mine = studioOrders.filter(orderBelongsToCurrentAccount);
  if (currentAccount.role === "客户") {
    // 客户：需要我处理的（待签署 / 待支付）
    const todo = mine.filter((o) => ["signing", "paying"].includes(moStage(o))).length;
    dot("myOrders", todo);
    // 花型库：新解锁的交付
    dot("myLibrary", mine.filter((o) => o.deliverStatus === "已交付" && !o.customerSeenDelivery).length);
  } else {
    // 员工：客户有新动作（回传签署件 / 已支付待交付）
    const need = mine.filter((o) => o.signedReviewPending || (o.paymentStatus === "已支付" && orderDeliverStatus(o) !== "已交付")).length;
    dot("orders", need);
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
  if (L.agreement !== "signed") {
    if (L.agreement === "reviewing") return "reviewing";
    return "signing";                 // 未上传/待签署/驳回都归入待签约
  }
  if (L.payment !== "paid") return "paying";
  return "delivering";
}
function moPrimaryAction(order) {
  const L = orderLifecycleModel(order);
  const stage = moStage(order);
  if (stage === "cancelled") return { label: "订单已取消", act: null, disabled: true };
  if (stage === "done") return { label: "查看订单详情", act: "open", disabled: false };
  if (stage === "signing") {
    if (L.agreement === "rejected") return { label: "重新上传", act: "sign", disabled: false };
    if (L.agreement === "awaiting_signature") return { label: "查看并签署", act: "sign", disabled: false };
    return { label: "等待协议", act: "open", disabled: true };
  }
  if (stage === "reviewing") return { label: "等待审核", act: null, disabled: true };
  if (stage === "paying") return { label: "立即支付", act: "pay", disabled: false };
  if (stage === "delivering") return L.delivered
    ? { label: "查看交付文件", act: "open", disabled: false }
    : { label: "等待交付", act: null, disabled: true };
  return { label: "查看订单详情", act: "open", disabled: false };
}
function moFilteredOrders() {
  const q = moSearch.trim().toLowerCase();
  return studioOrders.filter(orderBelongsToCurrentAccount).filter((o) => {
    if (moFilter !== "all" && moStage(o) !== moFilter) return false;
    if (!q) return true;
    return String(o.id || "").toLowerCase().includes(q)
      || orderPatternList(o).join(" ").toLowerCase().includes(q);
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
    return `<article class="mo-card" data-mo-open="${escapeHtml(o.id)}">
      <div class="mo-cover" style="${bg}"></div>
      <div class="mo-main">
        <div class="mo-l1"><strong>${escapeHtml(name)}</strong></div>
        <div class="mo-l2">订单编号 ${escapeHtml(o.id)}　·　${escapeHtml(o.createdAt || "—")}　·　${patterns.length} 款花型</div>
        ${o.customerNotice && L.agreement !== "signed" ? `<div class="mo-notice">${escapeHtml(o.customerNotice)}</div>` : ""}
        <div class="mo-tags">
          ${tag(L.agreement === "signed" ? ICON.ok : ICON.pen, OD_LABELS.agreement[L.agreement], L.agreement === "signed")}
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
    if (act === "sign") openDeliveryAgreementModal(order, true);
    else if (act === "pay") onOrderDetailAction("pay", order);
    else if (act === "open") openOrderDetail(order.id);
    return;
  }
  const card = e.target.closest("[data-mo-open]");
  if (card) openOrderDetail(card.dataset.moOpen);
});

function onOrderDetailAction(action, order) {
  const refresh = (msg) => {
    saveStudioState(); renderOrderCenter();
    if (typeof renderMyOrders === "function") renderMyOrders();
    renderOrderDetailBody(order);
    if (msg) showToast(msg, "success");
  };
  if (action === "upload-agreement") { closeOrderDetail(); openDeliveryAgreementModal(order, false); }
  else if (action === "sign") { closeOrderDetail(); openDeliveryAgreementModal(order, true); }
  else if (action === "view-signed") {
    if (order.signedFileKey) downloadStoredFile(order.signedFileKey, order.signedFileName);
    else showToast("暂无可下载的签署文件。", "warning");
  }
  else if (action === "ack-signed") {
    order.signedReviewPending = false;
    logOrderEvent(order, "签署文件已核验存档", currentAccount.role || "员工");
    updateSidebarBadges();
    refresh("已标记为核验通过。");
  } else if (action === "reject-sign") {
    const remark = window.prompt("要求重新签署的原因（会展示给客户）：", "缺少盖章");
    if (remark === null) return;
    order.agreementStatus = "审核驳回";
    order.reviewRemark = remark;
    order.signedFileUploaded = false;
    order.signedReviewPending = false;
    logOrderEvent(order, `要求客户重新签署：${remark}`, currentAccount.role || "员工");
    updateSidebarBadges();
    refresh("已通知客户重新上传签署文件。");
  } else if (action === "pay") {
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

let activeAgreementOrderId = "";

function closeDeliveryAgreementModal() {
  const modal = document.querySelector("#deliveryAgreementModal");
  modal?.classList.remove("active");
  modal?.setAttribute("aria-hidden", "true");
  activeAgreementOrderId = "";
  const check = document.querySelector("#deliveryAgreementCheck");
  if (check) check.checked = false;
  lockBodyScroll(false);
}

function agreementTermsHtml(order) {
  const count = orderPatternList(order).length;
  return `<div><span>订单</span><strong>${escapeHtml(order.id)}</strong></div>
    <div><span>签约客户</span><strong>${escapeHtml(order.customer || "未命名客户")}</strong></div>
    <div><span>授权作品</span><strong>${count} 款花型</strong></div>
    <ol>
      <li>签署后，工作室才会解锁本订单的高清图及可交付文件。</li>
      <li>作品仅可在本订单约定的产品及用途范围内使用。</li>
      <li>未经书面许可，不得转售、转授权或向第三方提供源文件。</li>
    </ol>`;
}

function agreementCustomerHtml(order) {
  const signed = order.signedFileUploaded;
  return `<div class="agr-info">
      <div><span>订单</span><strong>${escapeHtml(order.id)}</strong></div>
      <div><span>授权作品</span><strong>${orderPatternList(order).length} 款花型</strong></div>
      <div><span>订单金额</span><strong>¥${(order.price != null ? Number(order.price) : orderPatternList(order).length * 100).toFixed(2)}</strong></div>
    </div>
    <div class="agr-file-plain">
      <div class="agr-file-meta">
        <div class="agr-file-n">${escapeHtml(order.agreementFileName || "KiNG_授权协议.pdf")}</div>
        <div class="agr-file-s">${escapeHtml((order.agreementFileName || "pdf").split(".").pop().toUpperCase())} 文件</div>
      </div>
      <button class="agr-view-btn" type="button" id="agreementViewFile">下载</button>
    </div>
    <label class="agr-upload ${signed ? "done" : ""}">
      <input type="file" id="signedFileInput" accept=".pdf,.doc,.docx,.jpg,.png" hidden />
      <div class="agr-up-ic">${signed ? "✓" : "↑"}</div>
      <div class="agr-up-t">${signed ? escapeHtml(order.signedFileName || "已上传签署文件") : "上传已签署文件"}</div>
      <div class="agr-up-h">${signed ? "点击可重新上传" : "线下签署后回传，支持 PDF / Word / 图片"}</div>
    </label>`;
}

function agreementUploadHtml(order) {
  const uploaded = order.agreementUploaded;
  return `<div class="agr-info">
      <div><span>订单</span><strong>${escapeHtml(order.id)}</strong></div>
      <div><span>签约客户</span><strong>${escapeHtml(order.customer || "未命名客户")}</strong></div>
      <div><span>授权作品</span><strong>${orderPatternList(order).length} 款花型</strong></div>
    </div>
    <label class="agr-upload ${uploaded ? "done" : ""}">
      <input type="file" id="agreementFileInput" accept=".pdf,.doc,.docx" hidden />
      <div class="agr-up-ic">${uploaded ? "✓" : "↑"}</div>
      <div class="agr-up-t">${uploaded ? escapeHtml(order.agreementFileName || "已上传合同文件") : "上传合同 / 协议"}</div>
      <div class="agr-up-h">${uploaded ? "点击可重新上传" : "支持 PDF / Word / DOCX"}</div>
    </label>`;
}

/* 真实文件存取：上传的协议 / 签署件存入 IndexedDB，下载时还原成真实文件 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function downloadStoredFile(key, filename) {
  try {
    const data = await resolveImageSource(key);
    if (!data) { showToast("文件不存在或已失效。", "warning"); return; }
    const a = document.createElement("a");
    a.href = data;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    showToast("下载失败，请重试。", "warning");
  }
}

document.querySelector("#deliveryAgreementSummary")?.addEventListener("change", async (event) => {
  const order = studioOrders.find((item) => item.id === activeAgreementOrderId);
  if (!order) return;
  // 员工端：上传合同/协议
  const agrInput = event.target.closest("#agreementFileInput");
  if (agrInput && agrInput.files?.length) {
    const file = agrInput.files[0];
    const key = `agreement_${order.id}_${Date.now()}`;
    try { await saveImageToDB(key, await readFileAsDataUrl(file)); } catch {}
    order.agreementUploaded = true;
    order.agreementFileName = file.name;
    order.agreementFileKey = key;
    order.agreementFileSize = file.size;
    order.agreementUploadedAt = formatDateTime();
    logOrderEvent(order, `上传协议：${order.agreementFileName}`, currentAccount.role || "员工");
    saveStudioState();
    openDeliveryAgreementModal(order, false); // 重渲染以启用「发起签约」
    showToast(`已上传合同：${order.agreementFileName}`, "success");
    return;
  }
  // 客户端：上传已签署文件
  const signedInput = event.target.closest("#signedFileInput");
  if (signedInput && signedInput.files?.length) {
    const file = signedInput.files[0];
    const key = `signed_${order.id}_${Date.now()}`;
    try { await saveImageToDB(key, await readFileAsDataUrl(file)); } catch {}
    order.signedFileUploaded = true;
    order.signedFileName = file.name;
    order.signedFileKey = key;
    saveStudioState();
    openDeliveryAgreementModal(order, true); // 重渲染以启用「提交签署文件」
    showToast(`已上传签署文件：${order.signedFileName}`, "success");
  }
});
document.querySelector("#deliveryAgreementSummary")?.addEventListener("click", (event) => {
  if (!event.target.closest("#agreementViewFile")) return;
  const order = studioOrders.find((item) => item.id === activeAgreementOrderId);
  if (!order) return;
  if (order.agreementFileKey) downloadStoredFile(order.agreementFileKey, order.agreementFileName);
  else showToast("工作室尚未上传协议文件。", "warning");
});

function openDeliveryAgreementModal(order, customerMode = false) {
  const modal = document.querySelector("#deliveryAgreementModal");
  if (!modal || !order) return;
  activeAgreementOrderId = order.id;
  const status = orderAgreementStatus(order);
  const title = document.querySelector("#deliveryAgreementTitle");
  const message = document.querySelector("#deliveryAgreementMessage");
  const summary = document.querySelector("#deliveryAgreementSummary");
  const consent = document.querySelector("#deliveryAgreementConsent");
  const check = document.querySelector("#deliveryAgreementCheck");
  const submit = document.querySelector("#deliveryAgreementSubmit");
  if (title) title.textContent = customerMode ? "查看并签署协议" : "上传协议 / 发起签约";
  // 同意勾选框不再使用（员工端和客户端都不需要）
  consent?.classList.add("hidden");
  if (check) check.checked = false;
  if (customerMode) {
    if (summary) summary.innerHTML = agreementCustomerHtml(order);
    if (message) message.textContent = "请下载协议文件，线下完成签署后回传。审核通过即可进入支付。";
    if (submit) {
      submit.textContent = order.signedFileUploaded ? "提交签署文件" : "请先上传已签署文件";
      submit.disabled = !order.signedFileUploaded;
      submit.dataset.agreementMode = "customer";
    }
  } else {
    if (summary) summary.innerHTML = agreementUploadHtml(order);
    if (message) {
      message.textContent = status === "待客户签署"
        ? "协议已发给客户，当前仍在等待客户签署。签署完成前不能交付或解锁高清文件。"
        : "上传合同 / 协议文件（PDF 或 Word），上传后点击「发起签约」发送给客户下载、签署并回传。";
    }
    if (submit) {
      submit.textContent = status === "待客户签署" ? "提醒客户签署" : "发起签约";
      // 未发起且未上传合同时，禁用发起，先引导上传
      submit.disabled = status !== "待客户签署" && !order.agreementUploaded;
      submit.dataset.agreementMode = "admin";
    }
  }
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

document.querySelector("#deliveryAgreementClose")?.addEventListener("click", closeDeliveryAgreementModal);
document.querySelector("#deliveryAgreementCancel")?.addEventListener("click", closeDeliveryAgreementModal);
document.querySelector("#deliveryAgreementModal")?.addEventListener("click", (event) => {
  if (event.target.id === "deliveryAgreementModal") closeDeliveryAgreementModal();
});
document.querySelector("#deliveryAgreementCheck")?.addEventListener("change", (event) => {
  const submit = document.querySelector("#deliveryAgreementSubmit");
  if (submit?.dataset.agreementMode === "customer") submit.disabled = !event.target.checked;
});
document.querySelector("#deliveryAgreementSubmit")?.addEventListener("click", (event) => {
  const order = studioOrders.find((item) => item.id === activeAgreementOrderId);
  if (!order) return;
  const customerMode = event.currentTarget.dataset.agreementMode === "customer";
  if (customerMode) {
    if (!order.signedFileUploaded) return;               // 必须先上传已签署文件
    // 回传即完成签约，直接进入待支付（内部核验不阻塞客户付款）
    order.agreementStatus = "已签署";
    order.signedSubmittedAt = formatDateTime();
    order.signedReviewPending = true;                     // 员工侧提示：有签署件待核验
    order.agreementSignedBy = currentAccount.name || currentAccount.company || "客户";
    logOrderEvent(order, `客户回传签署文件：${order.signedFileName || "已签署文件"}`, "客户");
    saveStudioState();
    renderMyPatternLibrary();
    renderOrderCenter();
    if (typeof renderMyOrders === "function") renderMyOrders();
    closeDeliveryAgreementModal();
    showToast("签署完成，正在前往支付…", "success");
    openPaymentPage(order);                               // 直接跳转支付
    return;
  }
  if (orderAgreementStatus(order) !== "待客户签署") {
    order.agreementStatus = "待客户签署";
    order.agreementRequestedAt = formatDateTime();
    order.customerNotice = "工作室已发起签约，请查看并签署协议。";
    order.customerNoticeAt = formatDateTime();
    logOrderEvent(order, "已发起签约，等待客户签署", currentAccount.role || "员工");
    saveStudioState();
    updateSidebarBadges();
    renderOrderCenter();
    closeDeliveryAgreementModal();
    if (activeOrderDetailId === order.id) openOrderDetail(order.id);
    showToast(`订单 ${order.id} 的协议已发给客户。`, "success");
    return;
  }
  order.agreementRemindedAt = formatDateTime();
  order.customerNotice = "工作室提醒你尽快签署本订单协议。";
  order.customerNoticeAt = formatDateTime();
  logOrderEvent(order, "提醒客户签署协议", currentAccount.role || "员工");
  saveStudioState();
  updateSidebarBadges();
  closeDeliveryAgreementModal();
  showToast(`已提醒客户签署订单 ${order.id} 的协议。`, "success");
});

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
  saveStudioState();
  renderOrderCenter();
  renderLibraryGrid();
  renderLibraryCart();
  showToast(`${order.id} 已关闭，稿件已回到客户稿库。`, "success");
}

function deleteStudioOrder(orderId) {
  const order = studioOrders.find((item) => item.id === orderId);
  if (!order) return;
  if (orderDeliverStatus(order) === "已交付") {
    showToast("已交付的订单不能删除，请改用关闭或归档。", "warning");
    return;
  }
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
  const imageFiles = [...files].filter((file) => file.type.startsWith("image/"));
  if (!card || !imageFiles.length) return;
  const keys = getReferenceKeys(card);
  for (let index = 0; index < imageFiles.length; index += 1) {
    const imageData = await readFileAsDataURL(imageFiles[index]);
    const key = `${card.dataset.file}__reference_${keys.length + index + 1}_${Date.now()}`;
    await saveImageToDB(key, imageData);
    keys.push(key);
  }
  card.dataset.referenceKeys = JSON.stringify(keys);
  updateCardReferenceMaterial(card, `参考图 ${keys.length} 张`);
  saveStudioState();
  renderReferenceMaterials(card);
  showToast(`已为 ${card.dataset.file} 添加 ${imageFiles.length} 张参考图。`, "success");
}

function syncReviewCardPreviews() {
  document.querySelectorAll(".review-work-card[data-review-file]").forEach((reviewCard) => {
    const sourceCard = [...workCards].find((card) => card.dataset.file === reviewCard.dataset.reviewFile);
    const sourceTrigger = sourceCard?.querySelector(".preview-trigger");
    const reviewTrigger = reviewCard.querySelector(".preview-trigger");
    if (!sourceCard || !sourceTrigger || !reviewTrigger) return;

    reviewTrigger.className = sourceTrigger.className;
    reviewTrigger.style.backgroundImage = sourceTrigger.style.backgroundImage;
    reviewTrigger.style.backgroundSize = "cover";
    reviewTrigger.style.backgroundPosition = "center";
    reviewTrigger.style.backgroundRepeat = "no-repeat";
    reviewTrigger.style.aspectRatio = "";
    reviewTrigger.style.minHeight = "";
    reviewTrigger.innerHTML = "";

    const colorCount = Number(sourceCard.dataset.colors || 1);
    if (colorCount > 1) {
      const badge = document.createElement("span");
      badge.className = "color-count";
      badge.textContent = colorCount;
      reviewTrigger.appendChild(badge);
    }
  });
}

function isReviewPending(card) {
  const summary = cardStatusSummary(card);
  return !reviewLogs(card).length && !card.dataset.reviewAction && !summary.includes("已通过") && !summary.includes("已出售") && !isSleepingWork(card);
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
  return reviewLogs(card)[0]?.date || dateKey(card.dataset.version);
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

function renderReviewCalendar() {
  if (!reviewCalendar) return;
  const today = dateKey(new Date());
  reviewDateInput.value = activeReviewDate;
  reviewDateInput.max = today;
  reviewDateLabel.textContent = reviewDateText(activeReviewDate);
  reviewNextDay.disabled = activeReviewDate >= today;
  const todayPending = reviewItems().filter((card) => isReviewPending(card) && dateKey(card.dataset.version) === today).length;
  reviewTodayCount.textContent = todayPending;
  reviewTodayCount.title = `今天 ${todayPending} 件待评审`;
}

function reviewCardHtml(card) {
  const colorCount = Number(card.dataset.colors || 1);
  const trigger = card.querySelector(".preview-trigger");
  const patternClass = trigger?.className.replace("preview-trigger", "").trim() || "pattern pattern-a";
  const imageStyle = card.dataset.imageData ? ` style="background-image:url('${card.dataset.imageData}')"` : "";
  return `<article class="review-work-card${isReviewPending(card) ? "" : " reviewed"}" data-review-file="${card.dataset.file}">
    <button class="preview-trigger ${patternClass}" type="button" aria-label="查看 ${card.dataset.file}"${imageStyle}>${colorCount > 1 ? `<span class="color-count">${colorCount}</span>` : ""}</button>
    <button class="work-trash-button" type="button" data-delete-file="${escapeHtml(card.dataset.file)}" aria-label="将 ${escapeHtml(card.dataset.file)} 移入回收站" title="移入回收站"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg></button>
    <div class="review-hover-info" aria-hidden="true">
      <strong>${escapeHtml(card.dataset.file)}</strong>
      <span>上传者：${escapeHtml(workOwnerName(card))}</span>
      <span>日期：${escapeHtml(card.dataset.version || "-")}</span>
      <span>包含花色：${colorCount} 个</span>
    </div>
  </article>`;
}

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
  reviewStatusTabs.querySelectorAll("[data-review-result]").forEach((button) => button.classList.toggle("active", button.dataset.reviewResult === activeReviewResultFilter));
  const items = dateItems
    .filter((card) => activeReviewFilter === "all" || (activeReviewFilter === "pending" ? isReviewPending(card) : !isReviewPending(card)))
    .filter((card) => activeReviewFilter === "pending" || activeReviewResultFilter === "all" || (!isReviewPending(card) && (reviewLogs(card)[0]?.action || card.dataset.reviewAction || "") === activeReviewResultFilter))
    .sort((a, b) => new Date(b.dataset.version) - new Date(a.dataset.version));
  const emptyLabel = activeReviewFilter === "pending" ? "待评审" : activeReviewFilter === "reviewed" ? "已评审" : "评审";
  const workTypeLabel = activeReviewWorkType === "手绘师" ? "手绘稿" : "设计稿";
  reviewBoard.innerHTML = items.length ? items.map(reviewCardHtml).join("") : `<p class="empty-state">${reviewDateText(activeReviewDate)}没有${emptyLabel}${workTypeLabel}。</p>`;
  syncReviewCardPreviews();
}

function applyPreviewZoom() {
  const card = activeLightboxCards()[activePreviewIndex];
  if (card?.dataset.imageData) {
    lightboxImage.style.backgroundSize = previewZoom === 1 ? "contain" : `${Math.round(100 * previewZoom)}% auto`;
    lightboxImage.style.backgroundPosition = `calc(50% + ${previewOffsetX}px) calc(50% + ${previewOffsetY}px)`;
    return;
  } else {
    const tileSize = Math.round(120 * previewZoom);
    lightboxImage.style.backgroundSize = `${tileSize}px ${tileSize}px, cover`;
  }
  lightboxImage.style.backgroundPosition = `calc(50% + ${previewOffsetX}px) calc(50% + ${previewOffsetY}px), center`;
}

async function applyVariant(card, variant) {
  const sourcePattern = card.querySelector(".preview-trigger");
  const paletteKey = getPaletteKeys(card)[variant - 1];
  // 大图优先用配色对应的高清预览；没有则回退到卡片缩略图
  const imageData = paletteKey ? await resolveImageSource(paletteKey) : (variant === 1 ? card.dataset.imageData : "");
  const paletteEntry = getPaletteFiles(card)[variant - 1];
  const canPreview = variant === 1 || isPreviewablePaletteData(imageData);
  lightboxImage.className = imageData && canPreview
    ? "lightbox-image has-image"
    : imageData
      ? "lightbox-image palette-file-placeholder"
      : `lightbox-image ${sourcePattern.className.replace("preview-trigger", "").trim()} ${
        variant > 1 ? `variant-${variant}` : ""
      }`;
  lightboxImage.dataset.fileType = imageData && !canPreview ? paletteFileExtension({ name: paletteEntry?.name || "FILE" }) : "";
  lightboxImage.style.backgroundImage = imageData && canPreview ? `url("${imageData}")` : "";
  applyPreviewZoom();
}

function renderPaletteOptions(card) {
  const colorCount = Number(card.dataset.colors || 1);
  paletteOptions.innerHTML = "";
  palettePanel.classList.remove("hidden");
  paletteCount.textContent = `共 ${colorCount} 个配色`;
  const paletteFiles = getPaletteFiles(card);
  const canEditPalette = currentAccount.role === "管理员" || cardBelongsToCurrentAccount(card);
  if (!canEditPalette) paletteEditMode = false;
  // 编辑按钮：仅归属者/管理员可见；编辑态显示"完成"并展开删除/增加。
  if (addPaletteButton) {
    addPaletteButton.classList.toggle("hidden", !canEditPalette);
    addPaletteButton.innerHTML = paletteEditMode ? `完成 <i class="palette-edit-caret up"></i>` : `编辑 <i class="palette-edit-caret"></i>`;
    addPaletteButton.classList.toggle("editing", paletteEditMode);
  }
  palettePanel.classList.toggle("palette-editing", paletteEditMode && canEditPalette);

  for (let index = 1; index <= colorCount; index += 1) {
    const sourcePattern = card.querySelector(".preview-trigger");
    const option = document.createElement("button");
    const paletteKey = getPaletteKeys(card)[index - 1];
    option.type = "button";
    option.className = `palette-option ${index === activeVariant ? "active" : ""}`;
    const paletteEntry = paletteFiles[index - 1];
    option.innerHTML = `<span class="palette-thumb ${sourcePattern.className
      .replace("preview-trigger", "")
      .trim()} ${index > 1 ? `variant-${index}` : ""}"></span><span>${index === 1 ? "主配色" : escapeHtml(paletteEntry?.name || `配色 ${index}`)}</span>`;
    const thumb = option.querySelector(".palette-thumb");
    if (paletteKey) {
      resolveImageSource(paletteKey).then((imageData) => {
        if (!imageData) return;
        if (isPreviewablePaletteData(imageData)) {
          thumb.className = "palette-thumb";
          thumb.style.backgroundImage = `url("${imageData}")`;
          thumb.style.backgroundSize = "contain";
          thumb.style.backgroundPosition = "center";
          thumb.style.backgroundRepeat = "no-repeat";
        } else {
          thumb.className = "palette-thumb palette-file-type";
          thumb.textContent = paletteFileExtension({ name: paletteEntry?.name || "FILE" });
        }
      });
    }
    option.addEventListener("click", () => {
      activeVariant = index;
      previewZoom = 1;
      previewOffsetX = 0;
      previewOffsetY = 0;
      renderPaletteOptions(card);
      applyVariant(card, activeVariant);
    });
    // 编辑态下，非主配色显示删除按钮。
    if (paletteEditMode && canEditPalette && index > 1) {
      const removeBtn = document.createElement("span");
      removeBtn.className = "palette-remove";
      removeBtn.setAttribute("role", "button");
      removeBtn.title = "删除该配色";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        deletePaletteVariant(card, index);
      });
      option.appendChild(removeBtn);
    }
    paletteOptions.appendChild(option);
  }

  // 编辑态下追加一个"增加配色"格子。
  if (paletteEditMode && canEditPalette) {
    const addTile = document.createElement("button");
    addTile.type = "button";
    addTile.className = "palette-option palette-add-tile";
    addTile.innerHTML = `<span class="palette-add-plus">＋</span><span>增加配色</span>`;
    addTile.addEventListener("click", () => {
      paletteFileTargetCard = card;
      paletteFileInput.value = "";
      paletteFileInput.click();
    });
    paletteOptions.appendChild(addTile);
  }
}

function deletePaletteVariant(card, index) {
  if (index <= 1) return;
  const keys = getPaletteKeys(card);
  const entries = getPaletteFiles(card);
  if (index > keys.length) return;
  keys.splice(index - 1, 1);
  entries.splice(index - 1, 1);
  setPaletteKeys(card, keys);
  setPaletteFiles(card, entries);
  card.dataset.colors = Math.max(1, keys.length);
  if (activeVariant > keys.length) activeVariant = keys.length;
  enhanceOneWorkCard(card);
  renderPaletteOptions(card);
  applyVariant(card, activeVariant);
  renderDailyReviewBoard();
  saveStudioState();
  showToast("已删除该配色。", "success");
}

async function appendPaletteFiles(card, files) {
  const supportedFiles = [...files].filter(isSupportedPaletteFile);
  if (!card || !supportedFiles.length) return;
  const keys = getPaletteKeys(card);
  const entries = getPaletteFiles(card);
  if (!keys.length) keys.push(card.dataset.imageKey || card.dataset.file);
  if (!entries.length) entries.push({ name: card.dataset.file, key: keys[0], type: "image/jpeg", primary: true });
  const availableSlots = Math.max(0, MAX_UPLOAD_FILES - (keys.length - 1));
  const accepted = supportedFiles.slice(0, availableSlots);
  if (supportedFiles.length > accepted.length) showToast("超过最大上传数量", "warning");
  for (let index = 0; index < accepted.length; index += 1) {
    const file = accepted[index];
    const imageData = await readFileAsDataURL(file);
    const key = `${card.dataset.file}__color_${keys.length + 1}_${Date.now()}_${index}`;
    await saveImageToDB(key, imageData);
    keys.push(key);
    entries.push({ name: file.name, key, type: file.type || "application/octet-stream", primary: false });
  }
  setPaletteKeys(card, keys);
  setPaletteFiles(card, entries);
  card.dataset.colors = keys.length;
  enhanceOneWorkCard(card);
  renderPaletteOptions(card);
  renderDailyReviewBoard();
  saveStudioState();
  showToast(`已增加 ${accepted.length} 个配色。`, "success");
}

function renderReferenceMaterials(card) {
  const linkedPainter = fieldValue(card, "引用手绘");
  const linkedPainterWork = painterLibrary.find((item) => linkedPainter.includes(item.file) || (linkedPainter.includes(item.painter) && linkedPainter.includes(item.title)));
  const referenceMaterial = fieldValue(card, "参考素材");
  const referenceKeys = getReferenceKeys(card);
  const items = [
    `<article><strong>手绘素材</strong>${linkedPainterWork ? `<button class="lightbox-painter-link" type="button" data-linked-painter-file="${escapeHtml(linkedPainterWork.file)}">${escapeHtml(linkedPainter)}</button>` : `<span>${escapeHtml(linkedPainter || "无引用 / 原创设计")}</span>`}</article>`,
    `<article class="reference-image-row"><strong>参考图</strong><div class="reference-preview-grid">${
      referenceKeys.length
        ? referenceKeys.map((key, index) => `<button class="reference-preview" type="button" data-reference-key="${escapeHtml(key)}">参考图 ${index + 1}</button>`).join("")
        : `<span class="reference-text-only">${escapeHtml(referenceMaterial || "未提供参考图")}</span>`
    }</div>${referenceKeys.length ? "" : `<em>${escapeHtml(referenceMaterial || "未提供参考图")}</em>`}</article>`,
  ];
  referenceMaterialList.innerHTML = items.join("");
  referenceMaterialList.querySelectorAll("[data-reference-key]").forEach((item) => {
    getImageFromDB(item.dataset.referenceKey).then((imageData) => {
      if (!imageData) return;
      item.textContent = "";
      item.style.backgroundImage = `url("${imageData}")`;
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

function setReviewLog(card, action, note) {
  const today = dateKey(new Date());
  const logs = reviewLogs(card);
  const existing = logs.find((item) => item.date === today && item.action === action);
  if (existing) {
    existing.note = note;
    existing.time = formatDateTime();
  } else {
    logs.unshift({ date: today, time: formatDateTime(), action, note });
  }
  card.dataset.reviewLogs = JSON.stringify(logs);
  card.dataset.reviewNote = note;
  card.dataset.reviewAction = action;
}

function clearReviewLogs(card) {
  card.dataset.reviewLogs = "";
  card.dataset.reviewNote = "";
  card.dataset.reviewAction = "";
}

function renderReviewLogList(card) {
  reviewNotePanel.querySelector(".review-log-list")?.remove();
  const logs = reviewLogs(card);
  if (!logs.length) return;
  const list = document.createElement("div");
  list.className = "review-log-list";
  list.innerHTML = logs
    .map((item) => `<article><strong>${escapeHtml(item.date)} / ${escapeHtml(item.action)}</strong><p>${escapeHtml(item.note)}</p></article>`)
    .join("");
  reviewNotePanel.appendChild(list);
}

function showStoredReviewNote(card) {
  if (!card?.dataset.reviewNote && !card?.dataset.reviewLogs) return;
  activeReviewAction = card.dataset.reviewAction || "修改";
  reviewNotePanel.classList.remove("hidden");
  reviewNoteLabel.textContent = activeReviewAction === "Pass" ? "Pass 理由" : "修改意见";
  reviewNoteText.placeholder = activeReviewAction === "Pass" ? "请输入 Pass 理由" : "请输入需要设计师修改的意见";
  reviewNoteText.value = card.dataset.reviewNote;
  renderReviewLogList(card);
}

function renderLightbox() {
  const cards = activeLightboxCards();
  const card = cards[activePreviewIndex];
  if (!card) {
    return;
  }

  applyVariant(card, activeVariant);
  lightboxTitle.textContent = "";
  lightboxFile.textContent = card.dataset.file;
  const sleeping = isSleepingWork(card);
  const workStatus = workDisplayStatus(card);
  lightboxWorkStatus.textContent = workStatus;
  lightboxWorkStatus.dataset.status = sleeping ? "sleeping" : isReviewPending(card) ? "pending" : "reviewed";
  const canManageState = currentAccount.role === "管理员" && ["review", "sleep"].includes(activeViewId());
  lightboxSleepToggle.classList.toggle("hidden", !canManageState);
  lightboxSleepToggle.classList.toggle("active", sleeping);
  lightboxSleepToggle.setAttribute("aria-label", sleeping ? "取消作品休眠" : "将作品移入休眠区");
  lightboxSleepToggle.title = sleeping ? "取消休眠" : "移入休眠区";
  lightboxDeleteWork.classList.toggle("hidden", currentAccount.role !== "管理员" || !["review", "designer", "sleep"].includes(activeViewId()));
  lightboxOwner.textContent = `${card.dataset.workRole || "设计师"}：${workOwnerName(card)}`;
  lightboxProject.textContent = `项目：${card.querySelector(".work-body > p")?.textContent.replace(/^项目：/, "").trim() || "未关联项目"}`;
  renderLightboxTagDisplay(card);
  lightboxTagPicker.classList.add("hidden");
  renderLightboxTagPicker(card);
  lightboxMeta.textContent = `花型 ${activePreviewIndex + 1} / ${cards.length} · 配色 ${activeVariant} / ${Number(card.dataset.colors || 1)}`;
  resetLightboxReviewPanel();
  const inLibrary = activeViewId() === "library";
  // 作品库（管理员作品总览）不做评审操作，只查看。
  const inWorksLibrary = activeViewId() === "designer" && currentAccount.role === "管理员";
  const inOrder = activeViewId() === "orders" && activeOrderFileContext?.file === card.dataset.file;
  const showSourceFile = !inOrder && card.dataset.workRole === "设计师";
  lightbox.classList.toggle("library-mode", inLibrary);
  addToCartFromLightbox.classList.toggle("hidden", !inLibrary);
  lightboxReviewPanel.classList.toggle("hidden", sleeping || inOrder || inWorksLibrary || (!inLibrary && currentAccount.role !== "管理员"));
  lightboxReviewActions.classList.toggle("hidden", sleeping || inOrder || inLibrary || inWorksLibrary);
  const currentReviewAction = reviewLogs(card)[0]?.action || card.dataset.reviewAction || (cardStatusSummary(card).includes("已通过") ? "通过" : "");
  lightboxReviewActions.querySelectorAll("[data-review-action]").forEach((button) => {
    button.classList.toggle("hidden", !isReviewPending(card) && button.dataset.reviewAction === currentReviewAction);
  });
  lightboxStatusList.classList.toggle("hidden", inLibrary || currentAccount.role === "管理员");
  sourceFilePanel.classList.toggle("hidden", !showSourceFile);
  orderFilePanel.classList.toggle("hidden", !inOrder);
  if (showSourceFile) {
    sourceFileTargetCard = card;
    const sourceFiles = getSourceFiles(card);
    if (sourceFileStatus) sourceFileStatus.textContent = "";
    sourceFileDownloadList.innerHTML = sourceFiles.length
      ? sourceFiles.map((file, index) => `<button class="source-file-download-item" type="button" data-source-file-index="${index}"><span>${escapeHtml(file.name || `源文件 ${index + 1}`)}</span><b>下载</b></button>`).join("")
      : '<p class="source-file-empty">上传者未提供源文件</p>';
  }
  if (inOrder) {
    renderOrderFilePanel();
  }
  detailWorkStatus.textContent =
    card.dataset.workRole === "手绘师"
      ? fieldValue(card, "作品状态")
      : card.querySelector(".work-head .sale-badge")?.textContent.trim() || "-";
  detailSaleStatus.textContent =
    card.dataset.workRole === "手绘师" ? fieldValue(card, "作品状态") : badgeValue(card, "销售状态：");
  detailCustomerStatus.textContent = fieldValue(card, "客户状态");
  detailReviewStatus.textContent = card.dataset.workRole === "手绘师" ? "不参与设计稿审核" : fieldValue(card, "审核状态");
  if (!inOrder) showStoredReviewNote(card);
  if (inLibrary) {
    renderCustomerReviewNote(card);
  }
  renderPaletteOptions(card);
  renderReferenceMaterials(card);
}

function moveLightbox(direction) {
  const cards = activeLightboxCards();
  if (!cards.length) {
    return;
  }

  const currentCard = cards[activePreviewIndex];
  const colorCount = Number(currentCard?.dataset.colors || 1);
  if (direction > 0 && activeVariant < colorCount) {
    activeVariant += 1;
  } else if (direction < 0 && activeVariant > 1) {
    activeVariant -= 1;
  } else {
    // 到达集合边界时不再循环到其它集合的作品。
    const nextIndex = activePreviewIndex + direction;
    if (nextIndex < 0 || nextIndex >= cards.length) {
      if (direction > 0) {
        showToast(activeViewId() === "review" ? "今天的稿件已全部看完。" : "已经到底了，没有更多了。", "hint");
      }
      return;
    }
    activePreviewIndex = nextIndex;
    const nextCard = cards[activePreviewIndex];
    activeVariant = direction < 0 ? Number(nextCard?.dataset.colors || 1) : 1;
  }
  previewZoom = 1;
  previewOffsetX = 0;
  previewOffsetY = 0;
  renderLightbox();
}

function changeZoom(delta) {
  previewZoom = Math.min(4, Math.max(0.7, Number((previewZoom + delta).toFixed(2))));
  applyPreviewZoom();
}

function resetPreviewTransform() {
  previewZoom = 1;
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
  const cards = [...workCards];

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

  cards.forEach((card) => worksBoard.appendChild(card));
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
const libraryFilterConfig = [
  { key: "workType", label: "作品类型", options: ["设计稿", "手绘稿"] },
  { key: "patternForm", label: "图案形式", options: ["四方连续", "定位印花", "单独纹样", "边花", "条纹", "格纹", "组合图案"] },
  { key: "theme", label: "主题", options: ["花卉植物", "动物", "人物", "几何", "抽象", "自然", "食物", "节日", "儿童", "其他"] },
  { key: "style", label: "风格", options: ["法式", "复古", "韩系", "日系", "东方", "极简", "童趣", "甜美", "暗黑", "古典", "现代"] },
];
const libraryFilterState = libraryFilterConfig.reduce((acc, item) => {
  acc[item.key] = new Set();
  return acc;
}, {});

function cardLibraryValues(card, key) {
  if (key === "workType") return [card.dataset.workRole === "手绘师" ? "手绘稿" : "设计稿"];
  return (card.dataset.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

function libSelectTagsMarkup(cat) {
  const state = libraryFilterState[cat];
  if (!state.size) return `<span class="lib-select-placeholder">全部</span>`;
  return `<span class="lib-select-tags">${[...state].map((val) =>
    `<span class="lib-select-tag">${escapeHtml(val)}<i data-lib-remove-cat="${cat}" data-lib-remove-val="${escapeHtml(val)}" aria-hidden="true">×</i></span>`
  ).join("")}</span>`;
}

function renderLibraryFilterBar() {
  if (!libraryFilterBar) return;
  // 保留排序控件（它有独立监听），仅替换筛选行。
  libraryFilterBar.querySelectorAll(".library-filter-row").forEach((row) => row.remove());
  const rowsHtml = libraryFilterConfig.map((row) => {
    const state = libraryFilterState[row.key];
    const options = `<label class="lib-opt"><input type="checkbox" data-lib-cat="${row.key}" value="__all__" ${state.size === 0 ? "checked" : ""} /><span>全部</span></label>`
      + row.options.map((option) =>
        `<label class="lib-opt"><input type="checkbox" data-lib-cat="${row.key}" value="${escapeHtml(option)}" ${state.has(option) ? "checked" : ""} /><span>${escapeHtml(option)}</span></label>`
      ).join("");
    return `<div class="library-filter-row">
      <span class="library-filter-label">${row.label}</span>
      <div class="lib-select" data-lib-select="${row.key}">
        <button class="lib-select-trigger" type="button" data-lib-toggle="${row.key}">
          ${libSelectTagsMarkup(row.key)}
          <i class="lib-select-caret" aria-hidden="true"></i>
        </button>
        <div class="lib-select-panel hidden">${options}</div>
      </div>
    </div>`;
  }).join("");
  const sortField = libraryFilterBar.querySelector("#librarySortField");
  if (sortField) sortField.insertAdjacentHTML("beforebegin", rowsHtml);
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
  });
  renderLibSelectTrigger(cat);
}

function closeLibrarySelects(except = null) {
  libraryFilterBar?.querySelectorAll(".lib-select").forEach((box) => {
    if (box === except) return;
    box.querySelector(".lib-select-panel")?.classList.add("hidden");
    box.classList.remove("open");
  });
}

function renderLibrarySelectedConditions() {
  if (!librarySelectedConditions) return;
  const chips = [];
  libraryFilterConfig.forEach((row) => {
    [...libraryFilterState[row.key]].forEach((val) => chips.push({ key: row.key, val }));
  });
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
  const count = [...workCards].filter((card) =>
    !card.classList.contains("deleted")
    && !card.classList.contains("hidden")
    && !card.classList.contains("filtered-hidden")
    && !card.classList.contains("time-hidden")
  ).length;
  libraryResultCount.textContent = `共找到 ${count} 个作品`;
}

function applyLibraryFilters() {
  // 管理员作品库只展示已审核通过的作品；设计师/手绘师仍能看到自己需修改的稿件。
  const approvedOnly = currentAccount.role === "管理员";
  [...workCards].forEach((card) => {
    const matchesFilters = libraryFilterConfig.every((row) => {
      const state = libraryFilterState[row.key];
      if (!state.size) return true;
      return cardLibraryValues(card, row.key).some((value) => state.has(value));
    });
    const approvedOk = !approvedOnly || fieldValue(card, "审核状态").includes("已通过");
    card.classList.toggle("filtered-hidden", !(matchesFilters && approvedOk));
  });
  renderLibrarySelectedConditions();
  updateLibraryResultCount();
}

libraryFilterBar?.addEventListener("change", (event) => {
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

libraryFilterBar?.addEventListener("click", (event) => {
  // 删除触发器里的单个标签
  const removeTag = event.target.closest("[data-lib-remove-cat]");
  if (removeTag) {
    event.stopPropagation();
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
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".lib-select")) closeLibrarySelects();
});

librarySelectedConditions?.addEventListener("click", (event) => {
  const clearButton = event.target.closest("[data-lib-clear]");
  if (clearButton) {
    libraryFilterConfig.forEach((row) => libraryFilterState[row.key].clear());
    renderLibraryFilterBar();
    applyLibraryFilters();
    return;
  }
  const removeButton = event.target.closest("[data-lib-remove-cat]");
  if (removeButton) {
    libraryFilterState[removeButton.dataset.libRemoveCat].delete(removeButton.dataset.libRemoveVal);
    syncLibraryRowCheckboxes(removeButton.dataset.libRemoveCat);
    applyLibraryFilters();
  }
});

renderLibraryFilterBar();

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
  const cards = libraryEligibleDesigns().filter((card) => viewerLibraryFilterConfig.every((row) => {
    const selected = viewerLibraryFilterState[row.key];
    return !selected.size || cardLibraryValues(card, row.key).some((value) => selected.has(value));
  }));
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
  renderLibraryGrid();
});

viewerLibraryFilterBar?.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-viewer-lib-remove-cat]");
  if (remove) {
    event.stopPropagation();
    viewerLibraryFilterState[remove.dataset.viewerLibRemoveCat].delete(remove.dataset.viewerLibRemoveVal);
    renderViewerLibraryFilterBar();
    renderViewerLibrarySelectedConditions();
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
  renderLibraryGrid();
});

viewerLibrarySort?.addEventListener("change", renderLibraryGrid);
renderViewerLibraryFilterBar();

function enhanceOneWorkCard(card) {
  const meta = workMeta[card.dataset.file] || { version: card.dataset.version || "2026-06-24 00:00", colors: Number(card.dataset.colors || 1) };
  card.dataset.version = card.dataset.version || meta.version;
  card.dataset.colors = card.dataset.colors || meta.colors;

  const trigger = card.querySelector(".preview-trigger");
  if (trigger && Number(card.dataset.colors || 1) > 1) {
    const colorBadge = document.createElement("span");
    const existingBadge = trigger.querySelector(".color-count");
    if (existingBadge) {
      existingBadge.textContent = card.dataset.colors;
    } else {
      colorBadge.className = "color-count";
      colorBadge.textContent = card.dataset.colors;
      trigger.appendChild(colorBadge);
    }
  } else {
    trigger?.querySelector(".color-count")?.remove();
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
    hover.innerHTML = `<span>上传者：${escapeHtml(workOwnerName(card))}</span>`
      + `<span>时间：${escapeHtml(card.dataset.version || "-")}</span>`
      + `<span>配色：${Number(card.dataset.colors || 1)} 个</span>`;
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
  }
  const reviewSummary = fieldValue(card, "审核状态");
  card.classList.toggle("needs-revision", reviewSummary.includes("需修改") || reviewSummary.includes("未修改"));
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

function projectOptions() {
  return projectLibrary.map((item) => ({
    value: item.name,
    label: `${item.name} / ${item.status}`,
  }));
}

function painterWorkOptions() {
  return [
    { value: "无引用 / 原创设计", label: "无引用 / 原创设计" },
    ...painterLibrary.map((item) => ({
      value: `${item.painter} / ${item.title}`,
      label: `${item.painter} / ${item.title} / ${item.file}`,
    })),
  ];
}

const uploadTagCategories = [
  { name: "题材", tags: ["花卉", "植物", "几何", "动物", "儿童"] },
  { name: "风格", tags: ["新中式", "法式", "轻奢", "复古", "极简", "清新"] },
  { name: "色系", tags: ["蓝白", "暖调", "低饱和", "高明度", "莫兰迪"] },
  { name: "表现", tags: ["手绘", "水彩", "线稿", "数码", "拼贴"] },
  { name: "应用", tags: ["四件套", "窗帘", "抱枕", "墙布", "图库"] },
];

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

function emptyAddButtonMarkup(type) {
  return `<button class="empty-upload-button standard-add-button" type="button" data-empty-${type}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg><span>增加</span></button>`;
}

function updateUploadTypeUI() {
  const isPainter = uploadWorkType === "手绘师";
  if (uploadModalTitle) uploadModalTitle.textContent = isPainter ? "上传手绘稿" : "上传设计稿";
  uploadTypeSwitch?.classList.toggle("show-painter", isPainter);
  uploadTypeSwitch?.querySelectorAll("[data-upload-worktype]").forEach((button) =>
    button.classList.toggle("active", button.dataset.uploadWorktype === uploadWorkType)
  );
}

function openUploadModal() {
  uploadWorkType = currentAccount.role === "手绘师" ? "手绘师" : "设计师";
  updateUploadTypeUI();
  selectedUploadTags = [];
  selectedUploadFiles = [];
  selectedReferenceFiles = [];
  selectedSourceFiles = [];
  selectedPaletteFiles = [];
  uploadFileNames.clear();
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
  linkedPainterSummary.textContent = "未关联";
  linkedPainterList.innerHTML = "";
  renderLinkedProjects();
  projectSearch.value = "";
  releaseFileURLs();
  fileReadout.innerHTML = emptyAddButtonMarkup("upload");
  referenceReadout.innerHTML = emptyAddButtonMarkup("reference");
  renderSourceUploadFiles();
  renderPaletteUploadFiles();
  chooseFiles.classList.add("hidden");
  chooseReferenceFiles.classList.add("hidden");
  uploadValidationSummary.classList.add("hidden");
  uploadValidationTarget = null;
  renderUploadTags();
  renderProjectResults("");
  uploadModal.classList.add("active");
  uploadModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeUploadModal() {
  uploadModal.classList.remove("active");
  uploadModal.setAttribute("aria-hidden", "true");
  releaseFileURLs();
  lockBodyScroll(false);
}

function requestCloseUploadModal() {
  const hasDraft = selectedUploadFiles.length || selectedReferenceFiles.length || selectedSourceFiles.length || selectedPaletteFiles.length || selectedPainterWorks.length || selectedProjects.length || selectedUploadTags.length || originalDeclaration.checked;
  if (hasDraft) {
    openExitConfirmation({
      title: "放弃上传设计稿？",
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

function projectMemberRoleLabel(role) {
  return { designer: "设计师", painter: "手绘师", owner: "负责人", designers: "设计师", painters: "手绘师", owners: "负责人" }[role] || "成员";
}

function projectMemberCandidates(role) {
  const enabled = teamMembers.filter((member) => (member.accountStatus || "正常") === "正常");
  if (["designer", "designers"].includes(role)) return enabled.filter((member) => member.role === "设计师");
  if (["painter", "painters"].includes(role)) return enabled.filter((member) => member.role === "手绘师");
  return enabled;
}

function updateMemberSummary(container, summary, emptyText, role) {
  if (!summary) return;
  const values = checkedMemberValues(container);
  summary.innerHTML = `<div class="project-member-summary-chips">${values.length
    ? values.map((value) => `<span>${escapeHtml(value)}<button type="button" data-project-member-remove="${escapeHtml(value)}" aria-label="删除 ${escapeHtml(value)}">×</button></span>`).join("")
    : `<em>${escapeHtml(emptyText)}</em>`}<button class="member-inline-add" type="button" data-open-member-picker="${role}">＋ 添加</button></div>`;
}

function updateProjectMemberSummaries() {
  updateMemberSummary(projectDesignerOptions, projectDesignerSummary, "尚未选择", "designer");
  updateMemberSummary(projectPainterOptions, projectPainterSummary, "尚未选择", "painter");
  updateMemberSummary(projectOwnerOptions, projectOwnerSummary, "尚未选择", "owner");
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

function renderProjectStatusOptions() {
  projectStatusOptions?.querySelectorAll("[data-project-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.projectStatus === selectedProjectStatus);
  });
}

function renderProjectTypeOptions() {
  projectTypeOptions?.querySelectorAll("[data-project-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.projectType === selectedProjectType);
  });
}

function renderProjectNoteLog() {
  if (!projectNoteLog) return;
  if (!projectNoteLogs.length) {
    projectNoteLog.textContent = "暂无备注日志。";
    return;
  }
  projectNoteLog.innerHTML = projectNoteLogs
    .map((item) => `<article><strong>${escapeHtml(item.time)}${item.user ? ` / ${escapeHtml(item.user)}` : ""}</strong><p>${escapeHtml(item.text)}</p></article>`)
    .join("");
}

function addProjectNoteLog() {
  const text = projectNoteInput.value.trim();
  if (!text) {
    showToast("请先填写备注内容。", "warning");
    projectNoteInput.focus();
    return false;
  }
  projectNoteLogs.unshift({ time: formatDateTime(), user: currentAccount.name, text });
  projectNoteInput.value = "";
  renderProjectNoteLog();
  return true;
}

function renderProjectFileReadout() {
  if (!projectFileReadout) return;
  if (!selectedProjectFiles.length) {
    projectFileReadout.innerHTML = "";
    return;
  }
  projectFileReadout.innerHTML = selectedProjectFiles
    .map((file, index) => `<article class="project-file-item">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"></path><path d="M14 3v5h5"></path></svg>
      <span>${escapeHtml(projectStoredFileName(file))}</span>
      <button type="button" data-remove-project-file="${index}" aria-label="删除 ${escapeHtml(projectStoredFileName(file))}">×</button>
    </article>`)
    .join("");
}

function projectFileIdentity(file) {
  return `${projectStoredFileName(file)}:${file?.size || 0}:${file?.lastModified || file?.time || ""}`;
}

function mergeProjectFiles(existing, incoming) {
  const keys = new Set(existing.map(projectFileIdentity));
  const merged = [...existing, ...incoming.filter((file) => {
    const key = projectFileIdentity(file);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  })];
  if (merged.length > MAX_UPLOAD_FILES) showToast("超过最大上传数量", "warning");
  return merged.slice(0, MAX_UPLOAD_FILES);
}

function projectCustomerNames() {
  return [...(projectCustomerSelect?.options || [])].map((option) => option.value).filter(Boolean);
}

function renderProjectCustomerOptions(keyword = projectCustomerInput?.value || "") {
  if (!projectCustomerOptions) return;
  const query = keyword.trim().toLowerCase();
  if (!query) {
    projectCustomerOptions.innerHTML = "";
    projectCustomerCreateInline?.classList.add("hidden");
    if (projectCustomerCreateInline) projectCustomerCreateInline.dataset.customerName = "";
    setProjectCustomerOpen(false);
    return;
  }
  const matches = projectCustomerNames().filter((name) => searchMatches(query, [name]));
  const resultHtml = matches.map((name) => `<button type="button" data-project-customer="${escapeHtml(name)}" class="${projectCustomerInput.value === name ? "active" : ""}"><span>${escapeHtml(name)}</span>${projectCustomerInput.value === name ? '<i aria-hidden="true">✓</i>' : ""}</button>`).join("");
  projectCustomerOptions.innerHTML = resultHtml;
  projectCustomerCreateInline?.classList.toggle("hidden", Boolean(matches.length));
  if (projectCustomerCreateInline) projectCustomerCreateInline.dataset.customerName = matches.length ? "" : keyword.trim();
  setProjectCustomerOpen(Boolean(matches.length));
}

function setProjectCustomerOpen(open) {
  projectCustomerCombobox?.classList.toggle("open", open);
  projectCustomerInput?.setAttribute("aria-expanded", String(open));
}

function chooseProjectCustomer(name) {
  projectCustomerInput.value = name;
  if ([...projectCustomerSelect.options].some((option) => option.value === name)) projectCustomerSelect.value = name;
  projectCustomerCreateInline?.classList.add("hidden");
  setProjectCustomerOpen(false);
}

function createDefaultProjectCustomer(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return;
  if (!customCustomers.some((customer) => customer.name === cleanName)) {
    customCustomers = [{
      id: `CU-${Date.now()}`,
      name: cleanName,
      gender: "未说明",
      company: "默认",
      contact: "",
      preferences: [],
      demand: "",
      createdAt: formatDateTime(),
    }, ...customCustomers];
    ensureCustomerOption(cleanName, false);
    saveStudioState();
  }
  chooseProjectCustomer(cleanName);
  showToast(`${cleanName} 已用默认资料加入客户库。`, "success");
}

function resetProjectMemberSearches() {
  projectModal?.querySelectorAll("[data-member-search]").forEach((input) => { input.value = ""; });
  projectModal?.querySelectorAll(".member-checkbox-grid label, .owner-option-list label").forEach((option) => { option.hidden = false; });
  projectModal?.querySelectorAll(".project-member-results").forEach((results) => {
    results.classList.remove("open");
    toggleMemberSearchEmpty(results, false);
  });
}

function resetProjectModal() {
  selectedProjectFiles = [];
  selectedProjectStatus = "需求确认";
  selectedProjectType = "定制";
  projectNoteLogs = [];
  editingProjectId = null;
  projectModalTitle.textContent = "新建项目";
  projectConfirm.textContent = "确认";
  projectNameInput.value = "";
  projectFilesInput.value = "";
  projectCustomerSelect.value = "非客户项目";
  projectCustomerInput.value = "";
  setProjectCustomerOpen(false);
  projectNoteInput.value = "";
  projectStartDate.value = "";
  projectEndDate.value = "";
  projectDesignerOptions?.querySelectorAll("input").forEach((input) => {
    input.checked = false;
  });
  projectPainterOptions?.querySelectorAll("input").forEach((input) => {
    input.checked = false;
  });
  projectOwnerOptions?.querySelectorAll("input").forEach((input) => {
    input.checked = false;
  });
  renderProjectFileReadout();
  updateProjectMemberSummaries();
  renderProjectStatusOptions();
  renderProjectTypeOptions();
  renderProjectNoteLog();
  resetProjectMemberSearches();
  clearProjectValidation();
}

function fillProjectModal(project) {
  editingProjectId = project.id;
  selectedProjectFiles = [...(project.files || [])];
  selectedProjectStatus = normalizeProjectBoardStatus(project.status || "需求确认");
  selectedProjectType = projectTypeValue(project);
  projectNoteLogs = [...(project.logs || [])];
  projectModalTitle.textContent = "修改项目";
  projectConfirm.textContent = "保存修改";
  projectNameInput.value = project.name || "";
  projectFilesInput.value = "";
  projectCustomerSelect.value = project.customer === "内部图库 / 非客户项目" ? "非客户项目" : project.customer || "非客户项目";
  projectCustomerInput.value = projectCustomerSelect.value;
  setProjectCustomerOpen(false);
  projectNoteInput.value = "";
  projectStartDate.value = project.startAt || "";
  projectEndDate.value = project.endAt || "";
  setCheckedMemberValues(projectDesignerOptions, project.designers || []);
  setCheckedMemberValues(projectPainterOptions, project.painters || []);
  setCheckedMemberValues(projectOwnerOptions, project.owners || (project.owner && project.owner !== "未指定" ? String(project.owner).split("、").filter(Boolean) : []));
  renderProjectFileReadout();
  updateProjectMemberSummaries();
  renderProjectStatusOptions();
  renderProjectTypeOptions();
  renderProjectNoteLog();
  resetProjectMemberSearches();
  clearProjectValidation();
}

function openProjectCreateModal() {
  resetProjectModal();
  projectModal.classList.add("active");
  projectModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
  projectNameInput.focus();
}

function openProjectEditModal(projectId) {
  if (currentAccount.role !== "管理员") return;
  const project = customProjects.find((item) => item.id === projectId);
  if (!project) return;
  fillProjectModal(project);
  projectModal.classList.add("active");
  projectModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
  projectNameInput.focus();
}

function closeProjectCreateModal() {
  projectModal.classList.remove("active");
  projectModal.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

function requestCloseProjectCreateModal() {
  const hasDraft = editingProjectId || projectNameInput.value.trim() || selectedProjectFiles.length || projectStartDate.value || projectEndDate.value || projectNoteInput.value.trim() || checkedMemberValues(projectDesignerOptions).length || checkedMemberValues(projectPainterOptions).length || checkedMemberValues(projectOwnerOptions).length;
  if (hasDraft) {
    // Editing a real project keeps the old two-button discard flow.
    if (editingProjectId) {
      openExitConfirmation({
        title: "放弃项目修改？",
        message: "退出后，本次填写的项目资料、类别、人员和时间设置都不会保留。",
        onConfirm: closeProjectCreateModal,
      });
      return;
    }
    // New-project drafting: exiting must not delete an existing draft.
    openExitConfirmation({
      title: "尚未保存",
      message: "当前修改尚未保存，是否保存后退出？",
      submitText: "不保存并退出",
      cancelText: "取消",
      saveText: "保存并退出",
      onConfirm: closeProjectCreateModal,
      onSave: () => {
        saveCreateProjectDraft().catch((error) => {
          console.error(error);
          showToast("草稿保存失败，请重试。", "error");
        });
      },
    });
    return;
  }
  closeProjectCreateModal();
}

function isBrowserFile(file) {
  return typeof File !== "undefined" && file instanceof File;
}

async function serializeProjectFiles(files, uploadedAt, previousCreatedAt) {
  const stored = [];
  for (const file of files || []) {
    if (!file) continue;
    if (isBrowserFile(file)) {
      stored.push({
        name: file.name,
        type: file.type || "",
        size: file.size || 0,
        time: uploadedAt,
        uploader: currentAccount.name,
        dataUrl: await readFileAsDataURL(file),
      });
    } else if (typeof file === "string") {
      stored.push({
        name: file,
        type: "",
        size: 0,
        time: previousCreatedAt || uploadedAt,
        uploader: "项目资料",
        dataUrl: "",
      });
    } else {
      stored.push({
        name: file.name || "项目资料",
        type: file.type || "",
        size: file.size || 0,
        time: file.time || previousCreatedAt || uploadedAt,
        uploader: file.uploader || "项目资料",
        dataUrl: file.dataUrl || "",
      });
    }
  }
  return stored;
}

function clearProjectValidation() {
  projectModal?.querySelectorAll(".project-field-invalid").forEach((field) => field.classList.remove("project-field-invalid"));
  if (projectValidationSummary) projectValidationSummary.innerHTML = "";
  projectValidationSummary?.classList.add("hidden");
}

function showProjectValidation(errors) {
  clearProjectValidation();
  if (!projectValidationSummary) return;
  errors.forEach((item) => projectModal.querySelector(item.selector)?.classList.add("project-field-invalid"));
  projectValidationSummary.innerHTML = errors.map((item) => `<button type="button" data-project-validation-target="${escapeHtml(item.selector)}"><span>${escapeHtml(item.message)}</span><b aria-hidden="true">↑</b></button>`).join("");
  projectValidationSummary.classList.toggle("hidden", !errors.length);
}

async function createProjectFromModal() {
  const name = projectNameInput.value.trim();
  const designers = checkedMemberValues(projectDesignerOptions);
  const painters = checkedMemberValues(projectPainterOptions);
  const owners = checkedMemberValues(projectOwnerOptions);
  const owner = owners.join("、") || "未指定";
  const validationErrors = [];
  if (!name) validationErrors.push({ selector: ".project-name-field", message: "请填写项目名称" });
  if (!validProjectDate(projectStartDate.value) || !validProjectDate(projectEndDate.value)) validationErrors.push({ selector: ".project-time-field", message: "项目时间有缺失或有误" });
  if (validationErrors.length) {
    showProjectValidation(validationErrors);
    return;
  }
  clearProjectValidation();
  const pendingNote = projectNoteInput.value.trim();
  const logs = pendingNote ? [{ time: formatDateTime(), user: currentAccount.name, text: pendingNote }, ...projectNoteLogs] : projectNoteLogs;
  const members = [...new Set([...designers, ...painters, ...owners])].join("、");
  const previous = editingProjectId ? customProjects.find((item) => item.id === editingProjectId) : null;
  const now = formatDateTime();
  const storedFiles = await serializeProjectFiles(selectedProjectFiles, now, previous?.createdAt);
  const project = {
    ...(previous || {}),
    id: previous?.id || `PJ-${Date.now()}`,
    name,
    customer: projectCustomerInput.value.trim() || projectCustomerSelect.value || "非客户项目",
    type: selectedProjectType,
    status: selectedProjectStatus,
    stage: selectedProjectStatus,
    projectStatus: previous?.projectStatus || "normal",
    projectResult: previous?.projectResult || null,
    archived: previous?.archived || false,
    files: storedFiles,
    designers,
    painters,
    owners,
    owner,
    members,
    startAt: projectStartDate.value,
    endAt: projectEndDate.value,
    note: logs[0]?.text || "",
    logs,
    createdAt: previous?.createdAt || now,
    createdBy: previous?.createdBy || currentAccountDisplayName() || currentAccount.name || "",
    uploads: previous?.uploads || [],
    deliveryStatus: previous?.deliveryStatus || "pending",
    deliveryFiles: previous?.deliveryFiles || [],
    deliveryNote: previous?.deliveryNote || "",
    deliveryReceiver: previous?.deliveryReceiver || "",
    deliveryVersion: previous?.deliveryVersion || "",
    archiveHistory: previous?.archiveHistory || [],
  };
  normalizeProjectLifecycleProject(project);
  project.changeLogs = [...projectChangeLogEntries(previous, project, now), ...(previous?.changeLogs || [])];
  customProjects = [project, ...customProjects.filter((item) => item.id !== project.id && item.name !== name)];
  syncProjectLibrary();
  saveStudioState();
  if (editingDraftId) {
    projectDrafts = projectDrafts.filter((draft) => draft.id !== editingDraftId);
    editingDraftId = "";
    saveProjectDrafts();
  }
  renderCustomProjects();
  closeProjectCreateModal();
  if (!previous && typeof switchView === "function") switchView("projects");
  showToast(previous ? `${name} 已保存修改。` : `${name} 已创建，已进入项目流程页。`, "success");
}

function loadProjectDrafts() {
  try {
    projectDrafts = JSON.parse(localStorage.getItem(PROJECT_DRAFT_KEY) || "[]");
  } catch {
    projectDrafts = [];
  }
  renderProjectDrafts();
}

function saveProjectDrafts() {
  localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(projectDrafts));
  renderProjectDrafts();
}

async function saveCreateProjectDraft() {
  const now = formatDateTime();
  const files = await serializeProjectFiles(selectedProjectFiles, now, now);
  const draft = {
    id: editingDraftId || `PD-${Date.now()}`,
    kind: "create",
    savedAt: now,
    name: projectNameInput.value.trim(),
    customer: projectCustomerInput.value.trim(),
    type: selectedProjectType,
    status: selectedProjectStatus,
    files,
    designers: checkedMemberValues(projectDesignerOptions),
    painters: checkedMemberValues(projectPainterOptions),
    owners: checkedMemberValues(projectOwnerOptions),
    startAt: projectStartDate.value,
    endAt: projectEndDate.value,
    note: projectNoteInput.value,
  };
  projectDrafts = [draft, ...projectDrafts.filter((item) => item.id !== draft.id)];
  editingDraftId = draft.id;
  saveProjectDrafts();
  closeProjectCreateModal();
  showToast("项目已存入草稿箱。", "success");
}

function saveProjectDetailDraft(projectId) {
  const project = customProjects.find((item) => item.id === projectId);
  if (!project) return;
  const draft = {
    id: `PD-EDIT-${projectId}`,
    kind: "edit",
    projectId,
    savedAt: formatDateTime(),
    name: projectDetailTitle.value.trim(),
    customer: projectDetailBody.querySelector('[data-project-detail-field="customer"]')?.value.trim() || "",
    type: projectDetailBody.querySelector("[data-project-detail-type-option].active")?.dataset.projectDetailTypeOption || projectTypeValue(project),
    status: projectDetailBody.querySelector("[data-project-detail-status-option].active")?.dataset.projectDetailStatusOption || projectStage(project),
    startAt: projectDetailBody.querySelector('[data-project-detail-field="startAt"]')?.value || "",
    endAt: projectDetailBody.querySelector('[data-project-detail-field="endAt"]')?.value || "",
    designers: projectDetailSelectedMembers("designers"),
    painters: projectDetailSelectedMembers("painters"),
    owners: projectDetailSelectedMembers("owners"),
  };
  projectDrafts = [draft, ...projectDrafts.filter((item) => item.id !== draft.id)];
  saveProjectDrafts();
  closeProjectDetailModal();
  showToast("项目修改已存入草稿箱，尚未写入正式项目。", "success");
}

function renderProjectDrafts() {
  if (projectDraftCount) projectDraftCount.textContent = String(projectDrafts.length);
  if (!projectDraftList) return;
  projectDraftList.innerHTML = projectDrafts.length ? projectDrafts.map((draft) => `<article class="project-draft-row">
    <button type="button" data-project-draft-open="${escapeHtml(draft.id)}"><strong>${escapeHtml(draft.name || "未命名项目")}</strong><span>${draft.kind === "edit" ? "项目修改" : "新建项目"} · ${escapeHtml(draft.savedAt || "")}</span></button>
    <button class="project-draft-delete" type="button" data-project-draft-delete="${escapeHtml(draft.id)}">删除</button>
  </article>`).join("") : `<p class="empty-state">暂无项目草稿。</p>`;
}

function openProjectDraftBox() {
  renderProjectDrafts();
  projectDraftModal.classList.add("active");
  projectDraftModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeProjectDraftBox() {
  projectDraftModal.classList.remove("active");
  projectDraftModal.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

function restoreProjectDraft(draftId) {
  const draft = projectDrafts.find((item) => item.id === draftId);
  if (!draft) return;
  closeProjectDraftBox();
  if (draft.kind === "edit") {
    openProjectDetail(draft.projectId);
    projectDetailTitle.value = draft.name || "";
    const customer = projectDetailBody.querySelector('[data-project-detail-field="customer"]');
    if (customer) customer.value = draft.customer || "";
    const start = projectDetailBody.querySelector('[data-project-detail-field="startAt"]');
    const end = projectDetailBody.querySelector('[data-project-detail-field="endAt"]');
    if (start) start.value = draft.startAt || "";
    if (end) end.value = draft.endAt || "";
    projectDetailBody.querySelectorAll("[data-project-detail-type-option]").forEach((button) => button.classList.toggle("active", button.dataset.projectDetailTypeOption === draft.type));
    projectDetailBody.querySelectorAll("[data-project-detail-status-option]").forEach((button) => button.classList.toggle("active", button.dataset.projectDetailStatusOption === draft.status));
    [["designers", draft.designers], ["painters", draft.painters], ["owners", draft.owners]].forEach(([role, names]) => {
      projectDetailBody.querySelectorAll(`[data-project-detail-member-option="${role}"]`).forEach((button) => button.classList.toggle("active", (names || []).includes(button.dataset.value)));
      renderProjectDetailMemberSelection(projectDetailBody.querySelector(`[data-project-detail-member-picker="${role}"]`));
    });
    return;
  }
  openProjectCreateModal();
  editingDraftId = draft.id;
  projectNameInput.value = draft.name || "";
  projectCustomerInput.value = draft.customer || "";
  selectedProjectType = draft.type || "定制";
  selectedProjectStatus = draft.status || "需求确认";
  selectedProjectFiles = [...(draft.files || [])];
  projectStartDate.value = draft.startAt || "";
  projectEndDate.value = draft.endAt || "";
  projectNoteInput.value = draft.note || "";
  setCheckedMemberValues(projectDesignerOptions, draft.designers || []);
  setCheckedMemberValues(projectPainterOptions, draft.painters || []);
  setCheckedMemberValues(projectOwnerOptions, draft.owners || []);
  renderProjectFileReadout();
  updateProjectMemberSummaries();
  renderProjectTypeOptions();
  renderProjectStatusOptions();
}

function arrayText(items) {
  return (items || []).filter(Boolean).join("、") || "未设置";
}

function projectStoredFileName(item) {
  return typeof item === "string" ? item : item?.name || "";
}

function fileNameText(items) {
  return (items || []).map(projectStoredFileName).filter(Boolean).join("、") || "无";
}

function logKey(item) {
  return `${item.time || ""}|${item.text || ""}`;
}

function projectChangeLogEntries(previous, next, time) {
  const user = currentAccount.name;
  if (!previous) {
    return [{ time, user, action: "创建项目", detail: "项目资料已建立。" }];
  }

  const changes = [];
  const pushChange = (label, before, after) => {
    if (String(before || "") === String(after || "")) return;
    changes.push(`${label}：${before || "未设置"} → ${after || "未设置"}`);
  };

  pushChange("项目名称", previous.name, next.name);
  pushChange("客户", previous.customer, next.customer);
  pushChange("项目类别", projectTypeValue(previous), projectTypeValue(next));
  pushChange("项目状态", previous.status, next.status);
  pushChange("负责人", previous.owner, next.owner);
  pushChange("开始时间", previous.startAt, next.startAt);
  pushChange("结束时间", previous.endAt, next.endAt);
  pushChange("参与设计师", arrayText(previous.designers), arrayText(next.designers));
  pushChange("参与手绘师", arrayText(previous.painters), arrayText(next.painters));

  const previousFiles = new Set((previous.files || []).map(projectStoredFileName).filter(Boolean));
  const nextFiles = new Set((next.files || []).map(projectStoredFileName).filter(Boolean));
  const addedFiles = [...nextFiles].filter((file) => !previousFiles.has(file));
  const removedFiles = [...previousFiles].filter((file) => !nextFiles.has(file));
  if (addedFiles.length) changes.push(`新增项目资料：${fileNameText(addedFiles)}`);
  if (removedFiles.length) changes.push(`移除项目资料：${fileNameText(removedFiles)}`);

  const previousLogKeys = new Set((previous.logs || []).map(logKey));
  const addedNotes = (next.logs || []).filter((item) => !previousLogKeys.has(logKey(item)));
  if (addedNotes.length) changes.push(`新增备注：${addedNotes.map((item) => item.text).join("；")}`);

  return changes.length ? [{ time, user, action: "修改项目", detail: changes.join("；") }] : [];
}

function fileExtension(name) {
  const ext = String(name || "").split(".").pop();
  return ext && ext !== name ? ext.toUpperCase() : "FILE";
}

function projectFileEntries(project) {
  const initialFiles = (project.files || []).map((item, index) => {
    const file = typeof item === "string" ? { name: item } : item || {};
    return {
      id: `initial-${index}`,
      entryId: `initial-${index}`,
      sourceType: "initial",
      sourceIndex: index,
      name: file.name || "项目资料",
      type: file.type || "",
      size: file.size || 0,
      time: file.time || project.createdAt || "",
      uploader: file.uploader || "项目资料",
      source: "立项资料",
      dataUrl: file.dataUrl || "",
    };
  });
  const uploads = (project.uploads || []).map((item, index) => ({
    id: `upload-${index}`,
    entryId: `upload-${index}`,
    sourceType: "upload",
    sourceIndex: index,
    source: "上传文件",
    ...item,
  }));
  return [...initialFiles, ...uploads];
}

function projectFileTileHtml(file, index, mode = "detail") {
  const isImage = Boolean(file.dataUrl) && (String(file.type || "").startsWith("image/") || /\.(jpe?g|png)$/i.test(file.name || ""));
  const preview = isImage
    ? `<span class="project-file-thumb" style="background-image:url('${file.dataUrl}')"></span>`
    : `<span class="project-file-thumb file-icon">${escapeHtml(fileExtension(file.name))}</span>`;
  const draggable = mode === "manager" ? ` draggable="true" data-project-file-entry="${escapeHtml(file.entryId)}"` : "";
  return `<article class="project-file-tile ${isImage ? "is-image" : ""}"${draggable}>
    <button class="project-file-preview-button" type="button" data-project-file-index="${index}">${preview}<strong>${escapeHtml(file.name)}</strong></button>
    <button class="project-file-download-mini" type="button" data-project-file-download-index="${index}">下载</button>
  </article>`;
}

function projectFolderHtml(project) {
  const files = projectFileEntries(project);
  const uploadButton = projectParticipantCanUpload(project) && !project.archived && projectStage(project) !== "已交付"
    ? `<button class="primary-button project-upload-button" type="button" data-project-upload="${escapeHtml(project.id)}">上传文件</button>`
    : "";
  return `<div class="project-folder-head">
      <div><h3>项目文件</h3></div>
      ${uploadButton}
    </div>
    <div class="project-folder-window" data-project-folder-window="${escapeHtml(project.id)}">
      ${files.length ? files.map(projectFileTileHtml).join("") : `<p class="project-empty-file">无文件</p>`}
    </div>`;
}

function renderProjectLogItems(items, emptyText, options = {}) {
  const visibleItems = (items || []).filter((item) => !String(item.text || "").startsWith("拖拽到"));
  if (!visibleItems.length) return `<p class="empty-state compact">${escapeHtml(emptyText)}</p>`;
  const shownItems = options.limit && !options.expanded ? visibleItems.slice(0, options.limit) : visibleItems;
  const hint = options.limit && visibleItems.length > options.limit
    ? `<p class="project-log-expand-hint">${options.expanded ? "双击收起最近 3 条" : `双击展开全部 ${visibleItems.length} 条记录`}</p>`
    : "";
  return shownItems
    .map((item) => `<article>
      <strong>${escapeHtml(item.time || "-")} ${item.user ? `/ ${escapeHtml(item.user)}` : ""}</strong>
      <p>${escapeHtml(item.action ? `${item.action}：${item.detail || ""}` : item.text || item.detail || "")}</p>
    </article>`)
    .join("") + hint;
}

function projectDetailTopHtml(project) {
  if (!project) return "";
  const adminActions = currentAccount.role === "管理员"
    ? `<span class="project-detail-top-actions">
        <button class="project-save-draft detail" type="button" data-project-detail-draft="${escapeHtml(project.id)}">存入草稿箱</button>
        <button class="primary-button" type="button" data-project-detail-save="${escapeHtml(project.id)}">确认修改项目</button>
      </span>`
    : "";
  return adminActions;
}

function updateProjectDetailTop(project) {
  if (projectDetailTopStatus) projectDetailTopStatus.innerHTML = projectDetailTopHtml(project);
}

function projectLifecyclePanelHtml(project) {
  const stage = projectStage(project);
  const runtime = projectStatusDisplay(project);
  const manageable = canManageProjectLifecycle(project);
  const action = (key, label, tone = "") => `<button class="${tone}" type="button" data-project-lifecycle-action="${key}" data-project-id="${escapeHtml(project.id)}">${label}</button>`;
  const actions = [];
  if (manageable) {
    if (project.projectStatus === "paused") {
      actions.push(action("resume", "恢复项目", "primary"));
      actions.push(action("deadline", "修改截止日期"));
      actions.push(action("terminate", "终止项目", "danger"));
    } else if (stage === "内部定稿") {
      actions.push(action("to-delivery", "进入待交付", "primary"));
      actions.push(action("back-revision", "退回修改完善"));
      actions.push(action("terminate", "终止项目", "danger"));
    } else if (stage === "待交付") {
      actions.push(action("edit-delivery", "编辑交付内容"));
      actions.push(action("deliver", "确认已交付", "primary"));
      actions.push(action("back-final", "退回内部定稿"));
      actions.push(action("terminate", "终止项目", "danger"));
    } else if (stage === "已交付") {
      actions.push(action("view-delivery", "查看交付内容"));
      actions.push(action("complete", "完成项目", "primary"));
      actions.push(action("reopen-delivery", "重新打开交付"));
    } else {
      actions.push(action("pause", "暂停项目"));
      actions.push(action("deadline", "修改截止日期"));
      if (["需求确认", "概念方案"].includes(stage)) actions.push(action("cancel", "取消项目", "danger"));
      if (["概念方案", "设计制作", "稿件评审", "修改完善"].includes(stage)) actions.push(action("terminate", "终止项目", "danger"));
    }
  }
  return `<section class="project-lifecycle-panel">
    <div class="project-lifecycle-state">
      <span>当前阶段 <strong>${escapeHtml(stage)}</strong></span>
      <span class="project-runtime-status ${runtime.key}">${escapeHtml(runtime.label)}</span>
    </div>
    ${actions.length ? `<div class="project-lifecycle-actions">${actions.join("")}</div>` : ""}
  </section>`;
}

function projectDetailHtml(project) {
  const customerText = project.customer === "内部图库 / 非客户项目" ? "非客户项目" : project.customer || "未关联客户";
  const enabledMembers = teamMembers.filter((member) => (member.accountStatus || "正常") === "正常");
  const ownerNames = ["管理员 / 总控", ...enabledMembers.map((member) => member.name)];
  const designerNames = enabledMembers.filter((member) => member.role === "设计师").map((member) => member.name);
  const painterNames = enabledMembers.filter((member) => member.role === "手绘师").map((member) => member.name);
  const searchOptions = (names, key) => names.map((name) => `<button type="button" data-project-detail-search-option="${key}" data-value="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("");
  const selectedMemberMarkup = (selected, role) => (selected || []).length
    ? selected.map((name) => `<span>${escapeHtml(name)}<button type="button" data-project-detail-member-remove="${role}" data-value="${escapeHtml(name)}" aria-label="删除 ${escapeHtml(name)}">×</button></span>`).join("")
    : "<em>尚未选择</em>";
  const memberPicker = (title, names, selected, role) => `<div class="project-detail-member-picker" data-project-detail-member-picker="${role}">
    <h3>${title}</h3>
    <div class="project-member-selected"><div class="project-member-summary-chips">${selectedMemberMarkup(selected, role)}<button class="member-inline-add" type="button" data-open-detail-member-picker="${role}">＋ 添加</button></div></div>
    <div class="detail-search-results member-picker-state-store">${names.map((name) => `<button class="${(selected || []).includes(name) ? "active" : ""}" type="button" data-project-detail-member-option="${role}" data-value="${escapeHtml(name)}">${escapeHtml(name)}<i aria-hidden="true">✓</i></button>`).join("")}</div>
  </div>`;
  return `${projectLifecyclePanelHtml(project)}
  <div class="project-detail-summary project-detail-fields">
    <section class="project-detail-edit-field detail-search-combobox" data-project-detail-search="customer"><b>客户</b><div class="detail-search-control"><input data-project-detail-field="customer" value="${escapeHtml(customerText)}" placeholder="输入名称搜索客户" autocomplete="off" /><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg></div><div class="detail-search-results">${searchOptions([...new Set([...projectCustomerNames(), customerText])], "customer")}</div></section>
    <section class="project-detail-type-field"><b>项目类别</b><div class="project-type-options" data-project-detail-type>${["选稿", "定制", "内部"].map((type) => `<button class="${projectTypeValue(project) === type ? "active" : ""}" type="button" data-project-detail-type-option="${type}">${type === "内部" ? "内部项目" : type}</button>`).join("")}</div></section>
    <section class="project-detail-status-field"><b>项目阶段</b><div class="project-status-options" data-project-detail-status>${projectBoardStages.map((item) => `<button class="${projectStage(project) === item.status ? "active" : ""}" type="button" data-project-detail-status-option="${escapeHtml(item.status)}" ${item.status === "已交付" ? "disabled title=\"需要先完成交付记录\"" : ""}>${escapeHtml(item.status)}</button>`).join("")}</div></section>
    <section class="project-time-card"><b>项目时间</b>
      <div class="project-time-strip">
        <label><i>开始</i><input type="date" min="1000-01-01" max="9999-12-31" value="${escapeHtml(validProjectDate(project.startAt) ? project.startAt : "")}" data-project-detail-field="startAt" /></label>
        <label><i>结束</i><input type="date" min="1000-01-01" max="9999-12-31" value="${escapeHtml(validProjectDate(project.endAt) ? project.endAt : "")}" data-project-detail-field="endAt" /></label>
      </div>
    </section>
  </div>
  <section class="project-detail-section project-detail-plain-section">
    ${projectFolderHtml(project)}
  </section>
  <section class="project-detail-section project-detail-plain-section three-col">
    ${memberPicker("参与设计师", designerNames, project.designers, "designers")}
    ${memberPicker("参与手绘师", painterNames, project.painters, "painters")}
    ${memberPicker("负责人", ownerNames, project.owners || (project.owner && project.owner !== "未指定" ? String(project.owner).split("、").filter(Boolean) : []), "owners")}
  </section>
  <section class="project-detail-section project-detail-plain-section project-change-log-section" data-project-change-log="true">
    <h3>项目修改日志</h3>
    <div class="project-note-log detail-log">${renderProjectLogItems(project.changeLogs, "暂无修改记录。", { limit: 3, expanded: projectChangeLogExpanded })}</div>
  </section>`;
}

function openProjectDetail(projectId) {
  const project = customProjects.find((item) => item.id === projectId);
  if (!project) return;
  activeProjectId = projectId;
  projectChangeLogExpanded = false;
  projectDetailTitle.value = project.name || "项目详情";
  updateProjectDetailTop(project);
  projectDetailBody.innerHTML = projectDetailHtml(project);
  projectDetailModal.classList.add("active");
  projectDetailModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
  projectDetailDirty = false;
}

// 在项目详情里做了未保存的修改后，退出时提示存草稿。
function requestCloseProjectDetailModal() {
  if (!projectDetailDirty) {
    closeProjectDetailModal();
    return;
  }
  const projectId = activeProjectId;
  openExitConfirmation({
    title: "尚未保存",
    message: "当前项目修改尚未保存，是否保存后退出？",
    submitText: "不保存并退出",
    cancelText: "取消",
    saveText: "保存并退出",
    onConfirm: closeProjectDetailModal,
    onSave: () => saveProjectDetailDraft(projectId),
  });
}

function closeProjectDetailModal() {
  projectDetailModal.classList.remove("active");
  projectDetailModal.setAttribute("aria-hidden", "true");
  updateProjectDetailTop(null);
  activeProjectId = null;
  projectChangeLogExpanded = false;
  projectDetailDirty = false;
  lockBodyScroll(false);
}

function deleteProject(projectId) {
  if (currentAccount.role !== "管理员") return;
  const project = customProjects.find((item) => item.id === projectId);
  if (!project) return;
  openExitConfirmation({
    title: `删除项目「${project.name}」？`,
    message: "删除后，该项目会从项目看板和关联项目选项中移除，此操作不能在当前原型中撤销。",
    submitText: "确认删除",
    onConfirm: () => {
      customProjects = customProjects.filter((item) => item.id !== projectId);
      syncProjectLibrary();
      saveStudioState();
      closeProjectDetailModal();
      renderCustomProjects();
      renderDashboardOverview(currentAccount.role);
      showToast(`${project.name} 已删除。`, "warning");
    },
  });
}

function activeProject() {
  return customProjects.find((item) => item.id === activeProjectId);
}

function refreshProjectDetail(project) {
  if (!project || !projectDetailModal.classList.contains("active")) return;
  projectDetailTitle.value = project.name || "项目详情";
  updateProjectDetailTop(project);
  projectDetailBody.innerHTML = projectDetailHtml(project);
}

function projectDetailSelectedMembers(role) {
  return [...projectDetailBody.querySelectorAll(`[data-project-detail-member-option="${role}"].active`)].map((button) => button.dataset.value);
}

function renderProjectDetailMemberSelection(picker) {
  if (!picker) return;
  const role = picker.dataset.projectDetailMemberPicker;
  const selected = [...picker.querySelectorAll(`[data-project-detail-member-option="${role}"].active`)].map((button) => button.dataset.value);
  picker.querySelector(".project-member-selected").innerHTML = `<div class="project-member-summary-chips">${selected.length
    ? selected.map((name) => `<span>${escapeHtml(name)}<button type="button" data-project-detail-member-remove="${role}" data-value="${escapeHtml(name)}" aria-label="删除 ${escapeHtml(name)}">×</button></span>`).join("")
    : "<em>尚未选择</em>"}<button class="member-inline-add" type="button" data-open-detail-member-picker="${role}">＋ 添加</button></div>`;
}

function saveProjectDetailChanges(projectId) {
  const project = customProjects.find((item) => item.id === projectId);
  if (!project || currentAccount.role !== "管理员") return;
  const customer = projectDetailBody.querySelector('[data-project-detail-field="customer"]')?.value.trim() || "非客户项目";
  const owners = projectDetailSelectedMembers("owners");
  const owner = owners.join("、") || "未指定";
  const name = projectDetailTitle.value.trim();
  const startAt = projectDetailBody.querySelector('[data-project-detail-field="startAt"]')?.value.trim() || "";
  const endAt = projectDetailBody.querySelector('[data-project-detail-field="endAt"]')?.value.trim() || "";
  if (!name) {
    showToast("请填写项目名称。", "warning");
    projectDetailTitle.focus();
    return;
  }
  if (!validProjectDate(startAt) || !validProjectDate(endAt)) {
    showToast("项目时间有缺失或有误。", "warning");
    return;
  }
  const activeType = projectDetailBody.querySelector("[data-project-detail-type-option].active")?.dataset.projectDetailTypeOption || projectTypeValue(project);
  const activeStatus = projectDetailBody.querySelector("[data-project-detail-status-option].active")?.dataset.projectDetailStatusOption || projectStage(project);
  const previousStage = projectStage(project);
  if (activeStatus === "已交付" && !projectHasValidDelivery(project)) {
    showToast("请先完成交付记录，再进入已交付阶段。", "warning");
    return;
  }
  if (previousStage === "已交付" && activeStatus !== "已交付") {
    showToast("已交付项目请使用“重新打开交付”。", "warning");
    return;
  }
  if (activeStatus === "待交付" && previousStage !== "内部定稿" && previousStage !== "待交付") {
    showToast("只有内部定稿项目可以进入待交付。", "warning");
    return;
  }
  if (previousStage === "待交付" && !["待交付", "内部定稿"].includes(activeStatus)) {
    showToast("待交付项目只能保留当前阶段或退回内部定稿。", "warning");
    return;
  }
  const previous = {
    ...project,
    designers: [...(project.designers || [])],
    painters: [...(project.painters || [])],
    files: [...(project.files || [])],
    logs: [...(project.logs || [])],
  };
  const next = {
    ...project,
    name,
    customer,
    owner,
    owners,
    startAt,
    endAt,
    type: activeType,
    status: activeStatus,
    stage: activeStatus,
    designers: projectDetailSelectedMembers("designers"),
    painters: projectDetailSelectedMembers("painters"),
  };
  next.members = [...new Set([...next.designers, ...next.painters, ...owners])].join("、");
  const entries = projectChangeLogEntries(previous, next, formatDateTime());
  if (!entries.length) {
    showToast("当前没有需要保存的修改。", "warning");
    return;
  }
  Object.assign(project, next, { changeLogs: [...entries, ...(project.changeLogs || [])] });
  setProjectStage(project, activeStatus);
  projectDrafts = projectDrafts.filter((draft) => draft.id !== `PD-EDIT-${projectId}`);
  saveProjectDrafts();
  syncProjectLibrary();
  saveStudioState();
  renderCustomProjects();
  refreshProjectDetail(project);
  showToast("项目修改已确认并写入日志。", "success");
}

function projectLog(project, action, detail) {
  project.changeLogs = [{
    time: formatDateTime(),
    user: currentAccount.name || currentAccount.role,
    action,
    detail,
  }, ...(project.changeLogs || [])];
}

function persistProjectLifecycle(project, message, type = "success") {
  normalizeProjectLifecycleProject(project);
  syncProjectLibrary();
  saveStudioState();
  renderCustomProjects();
  renderProjectArchiveCount();
  if (projectDetailModal?.classList.contains("active") && activeProjectId === project.id && !project.archived) {
    refreshProjectDetail(project);
    projectDetailDirty = false;
  }
  renderDashboardOverview(currentAccount.role);
  if (message) showToast(message, type);
}

function changeProjectStage(project, nextStage, actionLabel) {
  const previous = projectStage(project);
  if (previous === nextStage) return;
  setProjectStage(project, nextStage);
  if (nextStage !== "已交付") project.deliveryStatus = project.deliveryStatus === "delivered" ? "pending" : project.deliveryStatus;
  projectLog(project, actionLabel || "调整阶段", `${previous} → ${nextStage}`);
  persistProjectLifecycle(project, `项目已进入「${nextStage}」。`);
}

function archiveProject(project, result, reason, extra = {}) {
  const now = formatDateTime();
  const fromStage = projectStage(project);
  project.projectResult = result;
  project.archived = true;
  project.archivedAt = now;
  project.archivedFromStage = fromStage;
  project.archiveReason = reason;
  Object.assign(project, extra);
  project.archiveHistory = [{
    result,
    archivedAt: now,
    archivedBy: currentAccount.name || currentAccount.role,
    fromStage,
    reason,
  }, ...(project.archiveHistory || [])];
  projectLog(project, "归档项目", `${projectResultLabels[result]}：${reason}`);
  persistProjectLifecycle(project, `${project.name} 已归档为“${projectResultLabels[result]}”。`);
  closeProjectDetailModal();
}

function renderProjectArchiveCount() {
  if (!projectArchiveCount) return;
  projectArchiveCount.textContent = String(customProjects.filter((project) => project.archived || project.projectResult).length);
}

function archiveTimeMatches(project, days) {
  if (days === "all") return true;
  const archivedAt = new Date(String(project.archivedAt || "").replace(" ", "T"));
  if (Number.isNaN(archivedAt.getTime())) return false;
  return Date.now() - archivedAt.getTime() <= Number(days) * 86400000;
}

function renderProjectArchiveList() {
  if (!projectArchiveList) return;
  const result = projectArchiveResultFilter?.value || "all";
  const type = projectArchiveTypeFilter?.value || "all";
  const customer = projectArchiveCustomerFilter?.value.trim().toLowerCase() || "";
  const owner = projectArchiveOwnerFilter?.value.trim().toLowerCase() || "";
  const deadline = projectArchiveDeadlineFilter?.value || "";
  const time = projectArchiveTimeFilter?.value || "all";
  const projects = customProjects
    .filter((project) => project.archived || project.projectResult)
    .filter((project) => result === "all" || project.projectResult === result)
    .filter((project) => type === "all" || projectTypeValue(project) === type)
    .filter((project) => !customer || String(project.customer || "").toLowerCase().includes(customer))
    .filter((project) => !owner || String(project.owner || "").toLowerCase().includes(owner))
    .filter((project) => !deadline || project.endAt === deadline)
    .filter((project) => archiveTimeMatches(project, time))
    .sort((a, b) => String(b.archivedAt || "").localeCompare(String(a.archivedAt || "")));
  projectArchiveList.innerHTML = projects.length ? projects.map((project) => {
    const resultLabel = projectResultLabels[project.projectResult] || "已归档";
    const actualDate = project.completedAt || project.cancelledAt || project.terminatedAt || project.archivedAt || "-";
    const reopen = canManageProjectLifecycle(project)
      ? `<button class="primary-button compact" type="button" data-project-archive-reopen="${escapeHtml(project.id)}">重新打开项目</button>`
      : "";
    return `<article class="project-archive-row">
      <div class="project-archive-main">
        <span class="project-archive-result result-${escapeHtml(project.projectResult || "")}">${escapeHtml(resultLabel)}</span>
        <strong>${escapeHtml(project.name || project.id)}</strong>
        <small>${escapeHtml(projectTypeValue(project))} · 客户：${escapeHtml(project.customer || "非客户项目")}</small>
      </div>
      <dl>
        <div><dt>负责人</dt><dd>${escapeHtml(project.owner || "未指定")}</dd></div>
        <div><dt>原截止日期</dt><dd>${escapeHtml(project.endAt || "-")}</dd></div>
        <div><dt>实际结束</dt><dd>${escapeHtml(actualDate)}</dd></div>
        <div><dt>归档原因</dt><dd>${escapeHtml(project.archiveReason || "-")}</dd></div>
      </dl>
      ${reopen}
    </article>`;
  }).join("") : `<p class="empty-state">没有符合条件的归档项目。</p>`;
}

function openProjectArchiveModal() {
  renderProjectArchiveList();
  projectArchiveModal?.classList.add("active");
  projectArchiveModal?.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeProjectArchiveModal() {
  projectArchiveModal?.classList.remove("active");
  projectArchiveModal?.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

function lifecycleFieldValue(name) {
  return projectLifecycleBody?.querySelector(`[name="${name}"]`)?.value.trim() || "";
}

function closeProjectLifecycleModal() {
  projectLifecycleModal?.classList.remove("active");
  projectLifecycleModal?.setAttribute("aria-hidden", "true");
  pendingProjectLifecycleAction = null;
  pendingProjectLifecycleFiles = [];
  lockBodyScroll(Boolean(projectDetailModal?.classList.contains("active") || projectArchiveModal?.classList.contains("active")));
}

function deliveryFilesSummary(files) {
  return files.length
    ? `<div class="project-delivery-file-list">${files.map((file) => `<span>${escapeHtml(file.name || "交付文件")}<small>${escapeHtml(file.version || "")}</small></span>`).join("")}</div>`
    : `<p class="project-delivery-empty">尚未上传交付文件</p>`;
}

function updateDeliveryConfirmationState() {
  if (!pendingProjectLifecycleAction || !["delivery", "deliver"].includes(pendingProjectLifecycleAction.action)) return;
  const contractRequired = projectLifecycleBody.querySelector('[name="requiresContract"]')?.checked;
  const contractSigned = projectLifecycleBody.querySelector('[name="contractSigned"]')?.checked;
  const paymentRequired = projectLifecycleBody.querySelector('[name="requiresPayment"]')?.checked;
  const paymentSatisfied = projectLifecycleBody.querySelector('[name="paymentSatisfied"]')?.checked;
  const missing = [];
  if (!pendingProjectLifecycleFiles.length) missing.push("交付文件");
  if (contractRequired && !contractSigned) missing.push("已签署合同");
  if (paymentRequired && !paymentSatisfied) missing.push("支付条件");
  const guard = projectLifecycleBody.querySelector("[data-delivery-guard]");
  if (guard) guard.textContent = missing.length ? `确认交付前还需要：${missing.join("、")}` : "交付条件已满足。";
  if (pendingProjectLifecycleAction.action === "deliver") projectLifecycleConfirm.disabled = missing.length > 0;
}

function projectLifecycleFormHtml(project, action) {
  if (action === "pause") return `
    <label><span>暂停原因</span><textarea name="reason" rows="3" placeholder="请说明暂停原因"></textarea></label>
    <label><span>预计恢复时间</span><input name="expectedResumeAt" type="date" /></label>`;
  if (action === "deadline") return `<label><span>新的截止日期</span><input name="deadline" type="date" value="${escapeHtml(project.endAt || "")}" /></label>`;
  if (action === "cancel") return `<label><span>取消原因</span><textarea name="reason" rows="4" placeholder="请填写取消原因"></textarea></label>`;
  if (action === "terminate") return `
    <label><span>终止原因</span><textarea name="reason" rows="3" placeholder="请填写终止原因"></textarea></label>
    <label><span>当前完成情况</span><textarea name="completion" rows="3" placeholder="说明目前已经完成的内容"></textarea></label>
    <label class="project-lifecycle-check"><input name="hasDeliveredContent" type="checkbox" /><span>存在已交付内容</span></label>
    <label><span>补充说明</span><textarea name="note" rows="3" placeholder="可选"></textarea></label>`;
  if (["delivery", "deliver", "view-delivery"].includes(action)) {
    const readOnly = action === "view-delivery";
    return `
      <label><span>接收方</span><input name="receiver" value="${escapeHtml(project.deliveryReceiver || project.customer || "")}" ${readOnly ? "readonly" : ""} /></label>
      <label><span>文件版本</span><input name="version" value="${escapeHtml(project.deliveryVersion || "V1")}" ${readOnly ? "readonly" : ""} /></label>
      ${readOnly ? "" : `<label class="project-delivery-upload"><span>交付文件</span><input name="deliveryFiles" type="file" multiple /><small>可一次选择多个文件</small></label>`}
      ${deliveryFilesSummary(pendingProjectLifecycleFiles)}
      <label><span>交付备注</span><textarea name="note" rows="4" ${readOnly ? "readonly" : ""}>${escapeHtml(project.deliveryNote || "")}</textarea></label>
      ${readOnly ? "" : `<div class="project-delivery-conditions">
        <label class="project-lifecycle-check"><input name="requiresContract" type="checkbox" ${project.requiresContract ? "checked" : ""} /><span>项目需要合同</span></label>
        <label class="project-lifecycle-check"><input name="contractSigned" type="checkbox" ${project.contractSigned ? "checked" : ""} /><span>合同已签署</span></label>
        <label class="project-lifecycle-check"><input name="requiresPayment" type="checkbox" ${project.requiresPayment ? "checked" : ""} /><span>项目需要满足支付条件</span></label>
        <label class="project-lifecycle-check"><input name="paymentSatisfied" type="checkbox" ${project.paymentSatisfied ? "checked" : ""} /><span>支付条件已满足</span></label>
      </div><p class="project-delivery-guard" data-delivery-guard></p>`}
      ${readOnly ? `<dl class="project-delivery-record"><div><dt>交付时间</dt><dd>${escapeHtml(project.deliveredAt || "-")}</dd></div><div><dt>交付负责人</dt><dd>${escapeHtml(project.deliveredBy || "-")}</dd></div></dl>` : ""}`;
  }
  if (action === "reopen") return `<label><span>重新打开原因</span><textarea name="reason" rows="4" placeholder="请说明重新打开项目的原因"></textarea></label>`;
  return "";
}

function openProjectLifecycleModal(project, action) {
  pendingProjectLifecycleAction = { projectId: project.id, action };
  pendingProjectLifecycleFiles = [...(project.deliveryFiles || [])];
  const titleMap = {
    pause: "暂停项目",
    deadline: "修改截止日期",
    cancel: "取消项目",
    terminate: "终止项目",
    delivery: "编辑交付内容",
    deliver: "确认项目交付",
    "view-delivery": "查看交付内容",
    reopen: "重新打开项目",
  };
  projectLifecycleTitle.textContent = titleMap[action] || "项目操作";
  projectLifecycleBody.innerHTML = projectLifecycleFormHtml(project, action);
  projectLifecycleConfirm.textContent = action === "view-delivery" ? "关闭" : action === "delivery" ? "保存交付内容" : action === "deliver" ? "确认已交付" : "确认";
  projectLifecycleConfirm.classList.toggle("danger-button", ["cancel", "terminate"].includes(action));
  projectLifecycleConfirm.classList.toggle("primary-button", !["cancel", "terminate"].includes(action));
  projectLifecycleConfirm.disabled = false;
  projectLifecycleModal.classList.add("active");
  projectLifecycleModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
  updateDeliveryConfirmationState();
}

function handleProjectLifecycleAction(project, action) {
  if (!project || !canManageProjectLifecycle(project)) return;
  const stage = projectStage(project);
  if (["pause", "deadline", "cancel", "terminate"].includes(action)) {
    if (action === "cancel" && !["需求确认", "概念方案"].includes(stage)) {
      showToast("只有需求确认或概念方案阶段可以取消项目。", "warning");
      return;
    }
    openProjectLifecycleModal(project, action);
    return;
  }
  if (action === "resume") {
    project.projectStatus = "normal";
    project.resumedAt = formatDateTime();
    projectLog(project, "恢复项目", `继续原阶段：${stage}`);
    persistProjectLifecycle(project, `${project.name} 已恢复。`);
    return;
  }
  if (action === "to-delivery") {
    if (stage !== "内部定稿") return showToast("只有内部定稿阶段可以进入待交付。", "warning");
    changeProjectStage(project, "待交付", "进入交付");
    return;
  }
  if (action === "back-revision") {
    changeProjectStage(project, "修改完善", "退回修改");
    return;
  }
  if (action === "back-final") {
    changeProjectStage(project, "内部定稿", "退回内部定稿");
    return;
  }
  if (action === "edit-delivery") {
    openProjectLifecycleModal(project, "delivery");
    return;
  }
  if (action === "deliver") {
    openProjectLifecycleModal(project, "deliver");
    return;
  }
  if (action === "view-delivery") {
    openProjectLifecycleModal(project, "view-delivery");
    return;
  }
  if (action === "reopen-delivery") {
    openExitConfirmation({
      title: "重新打开交付？",
      message: "项目将退回待交付，已保存的交付内容和历史记录会继续保留。",
      submitText: "确认重新打开",
      onConfirm: () => {
        project.deliveryHistory = [{
          deliveredAt: project.deliveredAt,
          deliveredBy: project.deliveredBy,
          files: [...(project.deliveryFiles || [])],
          note: project.deliveryNote || "",
        }, ...(project.deliveryHistory || [])];
        project.deliveryStatus = "prepared";
        setProjectStage(project, "待交付");
        projectLog(project, "重新打开交付", "已交付 → 待交付");
        persistProjectLifecycle(project, "交付已重新打开。");
      },
    });
    return;
  }
  if (action === "complete") {
    if (stage !== "已交付" || !projectHasValidDelivery(project)) {
      showToast("只有存在有效交付记录的已交付项目才能完成。", "warning");
      return;
    }
    openExitConfirmation({
      title: "完成并归档项目？",
      message: "确认后项目会从当前看板移除，并进入已归档项目。",
      submitText: "完成项目",
      onConfirm: () => {
        const now = formatDateTime();
        project.completedAt = now;
        project.completedBy = currentAccount.name || currentAccount.role;
        archiveProject(project, "completed", "项目已完成并交付");
      },
    });
  }
}

async function submitProjectLifecycleAction() {
  const pending = pendingProjectLifecycleAction;
  if (!pending) return;
  const project = customProjects.find((item) => item.id === pending.projectId);
  if (!project) return closeProjectLifecycleModal();
  const now = formatDateTime();
  if (pending.action === "view-delivery") return closeProjectLifecycleModal();
  if (pending.action === "pause") {
    const reason = lifecycleFieldValue("reason");
    if (!reason) return showToast("请填写暂停原因。", "warning");
    project.projectStatus = "paused";
    project.pauseReason = reason;
    project.pausedAt = now;
    project.expectedResumeAt = lifecycleFieldValue("expectedResumeAt");
    projectLog(project, "暂停项目", reason);
    closeProjectLifecycleModal();
    return persistProjectLifecycle(project, `${project.name} 已暂停。`, "warning");
  }
  if (pending.action === "deadline") {
    const deadline = lifecycleFieldValue("deadline");
    if (!validProjectDate(deadline)) return showToast("截止日期有缺失或有误。", "warning");
    const previous = project.endAt || "未设置";
    project.endAt = deadline;
    projectLog(project, "修改截止日期", `${previous} → ${deadline}`);
    closeProjectLifecycleModal();
    return persistProjectLifecycle(project, "截止日期已更新。");
  }
  if (pending.action === "cancel") {
    const reason = lifecycleFieldValue("reason");
    if (!reason) return showToast("请填写取消原因。", "warning");
    project.cancelledAt = now;
    project.cancelledBy = currentAccount.name || currentAccount.role;
    closeProjectLifecycleModal();
    return archiveProject(project, "cancelled", reason, { cancellationReason: reason });
  }
  if (pending.action === "terminate") {
    const reason = lifecycleFieldValue("reason");
    const completion = lifecycleFieldValue("completion");
    if (!reason || !completion) return showToast("请填写终止原因和当前完成情况。", "warning");
    const note = lifecycleFieldValue("note");
    const hasDeliveredContent = Boolean(projectLifecycleBody?.querySelector('[name="hasDeliveredContent"]')?.checked);
    project.terminatedAt = now;
    project.terminatedBy = currentAccount.name || currentAccount.role;
    closeProjectLifecycleModal();
    return archiveProject(project, "terminated", reason, {
      terminationReason: reason,
      terminationCompletion: completion,
      hasDeliveredContent,
      terminationNote: note,
    });
  }
  if (pending.action === "reopen") {
    const reason = lifecycleFieldValue("reason");
    if (!reason) return showToast("请填写重新打开原因。", "warning");
    const previousResult = project.projectResult;
    const nextStage = previousResult === "completed" ? "待交付" : previousResult === "cancelled" ? "需求确认" : normalizeProjectBoardStatus(project.archivedFromStage || "需求确认");
    project.archiveHistory = [{
      reopenedAt: now,
      reopenedBy: currentAccount.name || currentAccount.role,
      reopenReason: reason,
      previousResult,
    }, ...(project.archiveHistory || [])];
    project.reopenedAt = now;
    project.reopenedBy = currentAccount.name || currentAccount.role;
    project.reopenReason = reason;
    project.projectResult = null;
    project.archived = false;
    project.archivedAt = "";
    project.projectStatus = "normal";
    if (previousResult === "completed") project.deliveryStatus = "prepared";
    setProjectStage(project, nextStage);
    projectLog(project, "重新打开项目", `${projectResultLabels[previousResult] || "归档"} → ${nextStage}；${reason}`);
    closeProjectLifecycleModal();
    closeProjectArchiveModal();
    return persistProjectLifecycle(project, `${project.name} 已重新打开。`);
  }
  if (["delivery", "deliver"].includes(pending.action)) {
    const receiver = lifecycleFieldValue("receiver");
    const version = lifecycleFieldValue("version");
    if (!receiver) return showToast("请填写接收方。", "warning");
    if (!pendingProjectLifecycleFiles.length) return showToast("请上传至少一份交付文件。", "warning");
    project.deliveryFiles = await serializeProjectFiles(pendingProjectLifecycleFiles, now, project.createdAt);
    project.deliveryFiles = project.deliveryFiles.map((file) => ({ ...file, version }));
    project.deliveryReceiver = receiver;
    project.deliveryVersion = version;
    project.deliveryNote = lifecycleFieldValue("note");
    project.requiresContract = Boolean(projectLifecycleBody.querySelector('[name="requiresContract"]')?.checked);
    project.contractSigned = Boolean(projectLifecycleBody.querySelector('[name="contractSigned"]')?.checked);
    project.requiresPayment = Boolean(projectLifecycleBody.querySelector('[name="requiresPayment"]')?.checked);
    project.paymentSatisfied = Boolean(projectLifecycleBody.querySelector('[name="paymentSatisfied"]')?.checked);
    if (pending.action === "deliver") {
      if ((project.requiresContract && !project.contractSigned) || (project.requiresPayment && !project.paymentSatisfied)) {
        return showToast("合同或支付条件尚未满足，暂时不能确认交付。", "warning");
      }
      project.deliveryStatus = "delivered";
      project.deliveredAt = now;
      project.deliveredBy = currentAccount.name || currentAccount.role;
      setProjectStage(project, "已交付");
      projectLog(project, "确认交付", `${receiver} · ${version || "未标注版本"} · ${project.deliveryFiles.length} 份文件`);
    } else {
      project.deliveryStatus = "prepared";
      projectLog(project, "更新交付内容", `${receiver} · ${project.deliveryFiles.length} 份文件`);
    }
    closeProjectLifecycleModal();
    return persistProjectLifecycle(project, pending.action === "deliver" ? "项目已确认交付。" : "交付内容已保存。");
  }
}

function projectImageEntries(project = activeProject()) {
  return projectFileEntries(project).filter((file) => String(file.type || "").startsWith("image/") || /\.(jpe?g|png)$/i.test(file.name || ""));
}

function isProjectPdfFile(file) {
  return String(file?.type || "").includes("pdf") || /\.pdf$/i.test(file?.name || "");
}

function downloadProjectFile(file) {
  if (!file?.dataUrl) {
    showToast("这个历史文件没有保存实体内容，请重新上传后下载。", "warning");
    return;
  }
  const link = document.createElement("a");
  link.href = file.dataUrl;
  link.download = file.name || "项目文件";
  link.click();
  showToast(`${file.name || "项目文件"} 下载已开始。`, "success");
}

function applyProjectFileTransform() {
  if (!projectFileViewerImage) return;
  projectFileViewerImage.style.transform = `translate(${projectFileOffsetX}px, ${projectFileOffsetY}px) scale(${projectFileZoom})`;
}

function resetProjectFileTransform() {
  projectFileZoom = 1;
  projectFileOffsetX = 0;
  projectFileOffsetY = 0;
  applyProjectFileTransform();
}

function changeProjectFileZoom(delta) {
  projectFileZoom = Math.min(5, Math.max(0.5, projectFileZoom + delta));
  applyProjectFileTransform();
}

function renderProjectFilePalette(project, files) {
  if (!projectFileViewerPalette) return;
  projectFileViewerPalette.innerHTML = files
    .map((file, index) => {
      const active = index === activeProjectFileIndex ? "active" : "";
      return `<button class="${active}" type="button" data-project-viewer-palette="${index}">
        <span style="background-image:url('${file.dataUrl}')"></span>
        <small>${index === 0 ? "主图" : `配色 ${index + 1}`}</small>
      </button>`;
    })
    .join("");
  if (projectFileViewerPaletteText) projectFileViewerPaletteText.textContent = files.length > 1 ? `共 ${files.length} 色 / 当前 ${activeProjectFileIndex + 1}` : "主图 / 1 色";
  if (projectFileViewerNote) projectFileViewerNote.textContent = project?.note || "暂无设计备注";
}

function renderProjectFileViewer() {
  const project = activeProject();
  const files = projectFileEntries(project);
  const file = files[activeProjectFileIndex];
  if (!project || !file) return;
  const isImage = String(file.type || "").startsWith("image/") || /\.(jpe?g|png)$/i.test(file.name || "");
  const isPdf = isProjectPdfFile(file);
  const showImage = isImage && Boolean(file.dataUrl);
  const showPdf = isPdf && Boolean(file.dataUrl);
  projectFileViewerImage.classList.toggle("hidden", !showImage);
  projectFileViewerFrame.classList.toggle("hidden", !showPdf);
  projectFileGenericPreview.classList.toggle("hidden", showImage || showPdf);
  projectFileViewerImage.src = showImage ? file.dataUrl : "";
  projectFileViewerFrame.src = showPdf ? file.dataUrl : "about:blank";
  projectFileGenericPreview.innerHTML = !showImage && !showPdf
    ? `<strong>${escapeHtml(fileExtension(file.name))}</strong><p>${file.dataUrl ? "文件已保存，可下载后在对应软件中查看。" : "历史文件未保存实体内容，请重新上传。"}</p>`
    : "";
  projectFileViewerName.textContent = file.name || "项目文件";
  projectFileViewerPalette.innerHTML = "";
  projectFileViewerPalette.classList.add("hidden");
  projectFileViewerPaletteText.textContent = `${escapeHtml(fileExtension(file.name))} · ${file.size ? `${Math.max(0.01, file.size / 1024 / 1024).toFixed(2)} MB` : "文件预览"}`;
  projectFileViewerNote.textContent = project?.note || "暂无设计备注";
  projectFileViewerDownload.disabled = !file.dataUrl;
  resetProjectFileTransform();
}

function openProjectFileViewer(file, index = 0) {
  const project = activeProject();
  const files = projectFileEntries(project);
  if (!files.length) {
    showToast("该项目暂无文件。", "warning");
    return;
  }
  const matchedIndex = files.findIndex((item) => item.entryId === file?.entryId);
  activeProjectFileIndex = matchedIndex >= 0 ? matchedIndex : 0;
  renderProjectFileViewer();
  projectFileViewer.classList.add("active");
  projectFileViewer.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeProjectFileViewer() {
  projectFileViewer.classList.remove("active");
  projectFileViewer.setAttribute("aria-hidden", "true");
  projectFileViewerImage.src = "";
  projectFileViewerFrame.src = "about:blank";
  projectFileGenericPreview.innerHTML = "";
  projectFileViewerImage.style.transform = "";
  activeProjectFileIndex = 0;
  lockBodyScroll(false);
}

function renderProjectFileManager() {
  const project = activeProject();
  if (!projectFileManagerGrid || !project) return;
  const files = projectFileEntries(project);
  projectFileManagerGrid.innerHTML = files.length
    ? files.map((file, index) => projectFileTileHtml(file, index, "manager")).join("")
    : `<p class="project-empty-file">无文件</p>`;
}

function openProjectFileManager() {
  const project = activeProject();
  if (!project) return;
  renderProjectFileManager();
  projectFileManager.classList.add("active");
  projectFileManager.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeProjectFileManager() {
  projectFileManager.classList.remove("active");
  projectFileManager.setAttribute("aria-hidden", "true");
  projectManagerDragEntryId = "";
  lockBodyScroll(false);
}

function removeProjectFileByEntryId(entryId) {
  const project = activeProject();
  if (!project || !entryId) return;
  const files = projectFileEntries(project);
  const target = files.find((file) => file.entryId === entryId);
  if (!target) return;
  if (target.sourceType === "initial") {
    project.files = (project.files || []).filter((_, index) => index !== target.sourceIndex);
  } else {
    project.uploads = (project.uploads || []).filter((_, index) => index !== target.sourceIndex);
  }
  project.changeLogs = [
    {
      time: formatDateTime(),
      user: currentAccount.name,
      action: "删除项目文件",
      detail: target.name,
    },
    ...(project.changeLogs || []),
  ];
  saveStudioState();
  refreshProjectDetail(project);
  renderProjectFileManager();
  showToast(`已删除 ${target.name}。`, "warning");
}

async function attachProjectDetailFiles(fileList) {
  const project = activeProject();
  const existingCount = (project?.files || []).length + (project?.uploads || []).length;
  const availableSlots = Math.max(0, MAX_UPLOAD_FILES - existingCount);
  const incomingFiles = [...(fileList || [])];
  const files = incomingFiles.slice(0, availableSlots);
  if (incomingFiles.length > files.length) showToast("超过最大上传数量", "warning");
  if (!project || !files.length || !projectParticipantCanUpload(project)) return;
  const uploadedAt = formatDateTime();
  const uploads = [];
  for (const file of files) {
    uploads.push({
      name: file.name,
      type: file.type || "",
      size: file.size || 0,
      uploader: currentAccount.name,
      time: uploadedAt,
      dataUrl: await readFileAsDataURL(file),
    });
  }
  project.uploads = [...uploads, ...(project.uploads || [])];
  saveStudioState();
  renderCustomProjects();
  refreshProjectDetail(project);
  showToast(`已上传 ${uploads.length} 个项目文件。`, "success");
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

function referenceDisplayName(file) {
  return referenceFileNames.get(fileIdentity(file)) || file.name;
}

function renderSelectedFiles() {
  if (!selectedUploadFiles.length) {
    fileReadout.innerHTML = emptyAddButtonMarkup("upload");
    chooseFiles.classList.add("hidden");
    return;
  }

  chooseFiles.classList.remove("hidden");

  fileReadout.innerHTML = selectedUploadFiles
    .map((file, index) => {
      const url = URL.createObjectURL(file);
      fileObjectURLs.push(url);
      return `<article class="upload-thumb-card">
        <span class="file-thumb" style="background-image:url('${url}')"></span>
        <div><button class="editable-upload-name" type="button" data-edit-upload-name="${index}" title="点击修改名称">${escapeHtml(uploadDisplayName(file))}</button><small>图片 ${index + 1}</small></div>
        <button class="thumb-remove" type="button" data-remove-upload="${index}" aria-label="删除 ${escapeHtml(file.name)}">×</button>
      </article>`;
    })
    .join("");
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
  return /\.(jpe?g|png|psd|tiff?)$/i.test(file?.name || "");
}

function isPreviewablePaletteData(dataUrl) {
  return /^data:image\/(jpeg|jpg|png|webp|gif);/i.test(dataUrl || "");
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

function renderProjectResults(keyword) {
  const query = keyword.trim().toLowerCase();
  const results = projectLibrary.filter((item) => {
    const indexText = `${item.name} ${item.status} ${item.members}`.toLowerCase();
    return !query || indexText.includes(query);
  });

  if (!results.length) {
    projectResults.innerHTML = `<p class="empty-state">没有匹配的项目。</p>`;
    return;
  }

  projectResults.innerHTML = results
    .map((item) => {
      const active = selectedProjects.some((project) => project.name === item.name) ? "active" : "";
      return `<button class="project-option ${active}" type="button" data-project="${item.name}">
        <div>
          <strong>${item.name}</strong>
          <span>${item.status} / ${item.members}</span>
        </div>
        <i>${active ? "✓" : "+"}</i>
      </button>`;
    })
    .join("");
}

function updatePainterPickerCount() {
  painterSelectedCount.textContent = `已选 ${draftPainterSelection.length} 幅`;
}

function renderPainterPicker() {
  const query = painterPickerSearch.value.trim().toLowerCase();
  const painter = painterFilter.value;
  const results = painterLibrary.filter((item) => {
    const indexText = `${item.file} ${item.painter} ${item.project} ${item.tags.join(" ")}`.toLowerCase();
    const painterMatch = painter === "all" || item.painter === painter;
    return painterMatch && (!query || indexText.includes(query));
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
        <span class="painter-pick-thumb pattern ${item.pattern}"></span>
        <div class="painter-pick-copy"><strong>${item.file}</strong>
        <span>${item.painter} / ${item.project}</span>
        <span class="painter-pick-tags">${item.tags.join("、")}</span></div>
      </button>`;
    })
    .join("");
  updatePainterPickerCount();
}

function openPainterPickerModal() {
  draftPainterSelection = [...selectedPainterWorks];
  painterPickerSearch.value = "";
  painterFilter.value = "all";
  renderPainterPicker();
  painterPickerModal.classList.add("active");
  painterPickerModal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closePainterPickerModal() {
  painterPickerModal.classList.remove("active");
  painterPickerModal.setAttribute("aria-hidden", "true");
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
    <span class="painter-pick-thumb pattern ${item.pattern}"></span>
    <div><strong>${escapeHtml(item.file)}</strong><small>${escapeHtml(item.painter)} · ${escapeHtml(item.title)}</small></div>
    <button type="button" data-remove-painter="${escapeHtml(item.file)}" aria-label="移除 ${escapeHtml(item.file)}">×</button>
  </article>`).join("");
}

function renderLinkedProjects() {
  linkedProjectSummary.textContent = selectedProjects.length ? `已关联 ${selectedProjects.length} 个` : "未选择";
  clearLinkedProjects.classList.toggle("hidden", !selectedProjects.length);
  linkedProjectList.innerHTML = selectedProjects.map((item, index) => `<article class="linked-selection-item project-selection-item">
    <div><strong>${escapeHtml(item.name)}</strong><button class="project-role-tag ${index === 0 ? "primary" : ""}" type="button" data-make-primary="${escapeHtml(item.name)}">${index === 0 ? "主项目" : "设为主项目"}</button></div>
    <button type="button" data-remove-project="${escapeHtml(item.name)}" aria-label="移除 ${escapeHtml(item.name)}">×</button>
  </article>`).join("");
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
}

function setWorkSleeping(card, sleeping) {
  card.classList.toggle("sleeping", sleeping);
  card.dataset.sleeping = sleeping ? "true" : "";
  if (sleeping) {
    card.dataset.sleepPreviousReviewStatus = fieldValue(card, "审核状态") || "待审核 / 管理者未评审";
    card.dataset.sleepPreviousReviewAction = card.dataset.reviewAction || "";
    card.dataset.sleepPreviousReviewLogs = card.dataset.reviewLogs || "";
    updateCardReviewStatus(card, "休眠 / 管理者已移入休眠区");
  } else {
    updateCardReviewStatus(card, card.dataset.sleepPreviousReviewStatus || "待审核 / 管理者未评审");
    card.dataset.reviewAction = card.dataset.sleepPreviousReviewAction || "";
    card.dataset.reviewLogs = card.dataset.sleepPreviousReviewLogs || "";
    delete card.dataset.sleepPreviousReviewStatus;
    delete card.dataset.sleepPreviousReviewAction;
    delete card.dataset.sleepPreviousReviewLogs;
  }
  renderSleepList();
  renderDailyReviewBoard();
  sortWorkCards();
  saveStudioState();
  showToast(sleeping ? `${card.dataset.file} 已移入休眠区。` : `${card.dataset.file} 已取消休眠并恢复到原状态。`, "success");
}

function sleepItemsForRole() {
  return [...workCards].filter((card) => !card.classList.contains("deleted") && isSleepingWork(card) && cardBelongsToCurrentAccount(card));
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

function renderSleepList() {
  if (!sleepList) return;
  let items = sleepItemsForRole();
  updateSleepFilters(items);

  const keyword = (sleepSearch?.value || "").trim().toLowerCase();
  const designer = sleepDesignerFilter?.value || "all";
  const tag = sleepTagFilter?.value || "all";
  items = items.filter((card) => {
    const tags = (card.dataset.tags || "").split(",").filter(Boolean);
    const text = `${card.dataset.file} ${workOwnerName(card)} ${tags.join(" ")} ${card.querySelector(".work-body > p")?.textContent || ""}`.toLowerCase();
    return (!keyword || text.includes(keyword)) && (designer === "all" || workOwnerName(card) === designer) && (tag === "all" || tags.includes(tag));
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

  sleepList.innerHTML = items
    .map((card) => {
      const trigger = card.querySelector(".preview-trigger");
      const colorCount = Number(card.dataset.colors || 1);
      const note = card.dataset.reviewNote || "暂无备注";
      const owner = `${card.dataset.workRole || "设计师"}：${workOwnerName(card)}`;
      const patternClass = trigger?.className.replace("preview-trigger", "").trim() || "pattern pattern-a";
      const imageStyle = card.dataset.imageData ? ` style="background-image:url('${card.dataset.imageData}')"` : "";
      return `<article class="sleep-item" data-file="${card.dataset.file}">
        <button class="sleep-thumb ${patternClass}" type="button"${imageStyle}>${colorCount > 1 ? `<span class="color-count">${colorCount}</span>` : ""}</button>
        <div class="sleep-unavailable-overlay" aria-hidden="true"><span>休眠中</span></div>
        <button class="work-trash-button" type="button" data-delete-file="${escapeHtml(card.dataset.file)}" aria-label="将 ${escapeHtml(card.dataset.file)} 移入回收站" title="移入回收站"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg></button>
        <div class="sleep-hover-info">
          <div class="sleep-title-line"><strong>${escapeHtml(card.dataset.file)}</strong><span>休眠中</span></div>
          <p>${escapeHtml(owner)}</p>
          <p>${escapeHtml((card.dataset.tags || "").split(",").filter(Boolean).join(" · ") || "暂无标签")}</p>
          <p class="sleep-note">备注：${escapeHtml(note)}</p>
        </div>
      </article>`;
    })
    .join("");
}

function resubmitSleepingWork(card, mode) {
  card.classList.remove("sleeping");
  card.dataset.sleeping = "";
  updateCardReviewStatus(card, mode === "recreate" ? "待审核 / 二次创作重新提交" : "待审核 / 修改后重新提交");
  card.dataset.reviewAction = "重新提交";
  renderSleepList();
  renderDailyReviewBoard();
  sortWorkCards();
  saveStudioState();
  showToast(`${card.dataset.file} 已重新提交到评审区。`, "success");
}

function deleteWorkCard(card) {
  const file = card.dataset.file;
  const confirmed = window.confirm(`确认删除 ${file} 吗？删除后会进入回收站。`);
  if (!confirmed) {
    return;
  }

  card.classList.add("deleted");
  card.dataset.deletedAt = new Date().toISOString();
  deletedWorks = deletedWorks.filter((item) => item.card !== card);
  deletedWorks.push({ card, deletedAt: card.dataset.deletedAt });
  saveStudioState();
  renderRecycleBin();
  renderDailyReviewBoard();
  renderSleepList();
  configureWorksView(roleSelect.value, currentAccount.ownerKey);
  showToast(`${file} 已移入回收站，可在回收站中恢复。`, "warning");
}

function restoreWorkCard(card) {
  const file = card.dataset.file;
  card.classList.remove("deleted");
  delete card.dataset.deletedAt;
  deletedWorks = deletedWorks.filter((item) => item.card !== card);
  saveStudioState();
  configureWorksView(roleSelect.value, currentAccount.ownerKey);
  renderRecycleBin();
  showToast(`${file} 已恢复，重新显示在作品列表中。`, "success");
}

function purgeExpiredRecycleBin() {
  const retentionMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const expired = deletedWorks.filter(({ deletedAt }) => {
    const deletedTime = new Date(deletedAt).getTime();
    return Number.isFinite(deletedTime) && now - deletedTime >= retentionMs;
  });
  if (!expired.length) return;
  const expiredFiles = expired.map(({ card }) => card.dataset.file);
  studioState.removedFiles = [...new Set([...(studioState.removedFiles || []), ...expiredFiles])];
  expired.forEach(({ card }) => card.remove());
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
  return ["待审核", "需修改", "未修改", "Pass"].some((item) => summary.includes(item));
}

function renderRecycleBin() {
  const keyword = recycleSearch.value.trim().toLowerCase();
  let items = deletedWorks.filter(({ card }) => {
    const text = `${card.dataset.file} ${card.textContent}`.toLowerCase();
    return (!keyword || text.includes(keyword)) && recycleStatusMatches(card);
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

  recycleList.innerHTML = items
    .map(({ card }) => {
      const deletedAt = new Date(card.dataset.deletedAt).toLocaleString("zh-CN", { hour12: false });
      const trigger = card.querySelector(".preview-trigger");
      const colorCount = Number(card.dataset.colors || 1);
      const patternClass = trigger?.className.replace("preview-trigger", "").trim() || "pattern pattern-a";
      const imageStyle = card.dataset.imageData ? ` style="background-image:url('${card.dataset.imageData}')"` : "";
      return `<article class="recycle-item" data-file="${card.dataset.file}">
        <button class="recycle-thumb ${patternClass}" type="button"${imageStyle}>${colorCount > 1 ? `<span class="color-count">${colorCount}</span>` : ""}</button>
        <div class="recycle-hover-info">
          <strong>${escapeHtml(card.dataset.file)}</strong>
          <p>${escapeHtml(card.dataset.workRole || "设计稿")} · ${escapeHtml(workOwnerName(card))}</p>
          <p>${escapeHtml((card.dataset.tags || "").split(",").filter(Boolean).join(" · ") || "暂无标签")}</p>
          <p>删除于 ${escapeHtml(deletedAt)}</p>
        </div>
        <button class="restore-work" type="button" aria-label="恢复 ${escapeHtml(card.dataset.file)}">恢复</button>
      </article>`;
    })
    .join("");
}

function closeLightbox() {
  closeReferenceZoom();
  lightbox.classList.remove("active");
  lightbox.classList.remove("info-hidden");
  lightbox.classList.remove("library-mode");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxCardSet = [];
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
  if (remembered.employee) {
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
  const clientMode = portal === "client";
  employeeLoginPanel.classList.toggle("hidden", clientMode);
  clientLoginPanel.classList.toggle("hidden", !clientMode);
  loginError.textContent = "";
  clientLoginError.textContent = "";
  (clientMode ? clientUsername : usernameInput).focus();
}

function applyLogin(accountKey, account) {
  currentAccount = { ...account };
  localStorage.setItem(SESSION_KEY, accountKey);
  localStorage.setItem(SESSION_ACCOUNT_DATA_KEY, JSON.stringify({ accountKey, account }));
  roleSelect.value = account.role;
  roleSelect.disabled = true;
  applyProfilePrefs(currentAccount);
  updateRoleDashboard(account.role);
  configureRoleNavigation(account.role);
  renderNotifications();
  // 客户端只进"我的花型库"
  if (account.role === "客户") {
    switchView("myLibrary");
    renderMyPatternLibrary();
  } else {
    switchView("dashboard");
  }
  loginScreen.classList.add("hidden");
  appShell.classList.remove("locked");
  loginError.textContent = "";
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

  if (action !== "修改" && action !== "需修改" && action !== "Pass") {
    return;
  }

  const note = document.createElement("div");
  note.className = "inline-review-note";
  const isPass = action === "Pass";
  note.innerHTML = `
    <label>${isPass ? "Pass 理由" : "修改意见"}</label>
    <textarea rows="2" placeholder="${isPass ? "请输入 Pass 理由" : "请输入需要修改的意见"}"></textarea>
    <button type="button">保存备注</button>
  `;
  note.querySelector("button").addEventListener("click", () => {
    const value = note.querySelector("textarea").value.trim();
    if (!value) {
      note.querySelector("textarea").focus();
      showToast("请先填写评审备注。", "warning");
      return;
    }
    showToast(isPass ? "Pass 理由已保存。" : "修改意见已保存。", isPass ? "error" : "warning");
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

function openExitConfirmation({ title, message, submitText = "放弃并退出", cancelText = "继续编辑", saveText = "保存并退出", onConfirm, onSave = null }) {
  pendingExitConfirmation = onConfirm;
  pendingExitSaveAction = onSave;
  exitConfirmTitle.textContent = title || "确认退出";
  exitConfirmMessage.textContent = message || "当前内容尚未保存，退出后本次填写将不会保留。";
  exitConfirmSubmit.textContent = submitText;
  exitConfirmCancel.textContent = cancelText;
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
  const needsNote = false;
  pendingReviewConfirmation = { card, action: normalizedAction, onConfirm };
  reviewConfirmTitle.textContent = normalizedAction === "待评审" ? "改为待评审" : normalizedAction === "通过" ? "确认通过稿件" : normalizedAction === "修改" ? "退回修改" : "确认 Pass";
  reviewConfirmMessage.textContent = normalizedAction === "待评审"
    ? `确认撤销「${card.dataset.file}」当前的评审结果，并将它移回待评审吗？`
    : `将「${card.dataset.file}」标记为“${normalizedAction}”${normalizedAction === "通过" ? "，通过后会进入已评审。" : "。"}`;
  reviewConfirmNoteWrap.classList.toggle("hidden", !needsNote);
  reviewConfirmNoteLabel.textContent = normalizedAction === "Pass" ? "Pass 理由" : "修改意见";
  reviewConfirmNote.placeholder = normalizedAction === "Pass" ? "请输入 Pass 理由" : "请输入需要调整的内容";
  reviewConfirmSubmit.textContent = normalizedAction === "待评审" ? "确认移回" : normalizedAction === "通过" ? "确认通过" : "确认";
  reviewConfirmSubmit.className = `primary-button review-confirm-${normalizedAction === "待评审" ? "approve" : normalizedAction === "通过" ? "approve" : normalizedAction === "修改" ? "revise" : "pass"}`;
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
    updateCardReviewStatus(sourceCard, "已通过");
    showToast("审核通过，稿件已入库并可销售。", "success");
  } else if (action === "修改") {
    sourceCard.classList.remove("sleeping");
    sourceCard.dataset.sleeping = "";
    updateCardReviewStatus(sourceCard, "需修改 / 管理者已填写修改意见");
    showToast(`作品未通过，已通知${sourceCard.dataset.workRole === "手绘师" ? "手绘师" : "设计师"}修改。`, "warning");
  } else {
    sourceCard.classList.add("sleeping");
    sourceCard.dataset.sleeping = "true";
    updateCardReviewStatus(sourceCard, "Pass / 管理者已移入休眠区");
    showToast("已 Pass，稿件不会进入稿库。", "error");
  }
  renderSleepList();
  renderDailyReviewBoard();
  renderLibraryGrid();
  renderDashboardOverview(currentAccount.role);
  renderNotifications();
  saveStudioState();
}

function resetReviewDecision(sourceCard) {
  clearReviewLogs(sourceCard);
  sourceCard.classList.remove("sleeping");
  sourceCard.dataset.sleeping = "";
  updateCardReviewStatus(sourceCard, "待审核 / 管理者未评审");
  renderSleepList();
  renderDailyReviewBoard();
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
  if (isReviewPending(sourceCard)) {
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
    renderCustomProjects();
    if (customProjects.some((project) => project.id === projectId)) {
      openProjectDetail(projectId);
    } else {
      requestAnimationFrame(() => {
        const target = [...document.querySelectorAll("[data-board-project]")].find((card) => card.dataset.boardProject === projectId);
        if (!target) return;
        target.classList.add("risk-highlight");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => target.classList.remove("risk-highlight"), 4200);
      });
    }
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
  const username = applicationUsername.value.trim().toLowerCase();
  const contact = applicationContact.value.trim().toLowerCase();
  const password = applicationPassword.value;
  const role = applicationRole.value;
  const allowedRoles = ["设计师", "手绘师", "打样师", "销售"];

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

openClientLogin?.addEventListener("click", () => switchLoginPortal("client"));
openEmployeeLogin?.addEventListener("click", () => switchLoginPortal("employee"));

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const accountKey = usernameInput.value.trim();
  const account = demoAccounts[accountKey];

  if (account && account.password === passwordInput.value) {
    saveRememberedLogin("employee", accountKey, passwordInput.value, employeeRememberPassword.checked);
    applyLogin(accountKey, account);
    return;
  }

  // 客户专属账号也允许在主登录表单登录（兼容"原来的平台"）
  const client = customerByLogin(accountKey, passwordInput.value);
  if (client) {
    saveRememberedLogin("employee", accountKey, passwordInput.value, employeeRememberPassword.checked);
    applyLogin(accountKey, {
      role: "客户",
      name: `${client.name}`,
      ownerKey: "customer",
      customerId: client.id,
      company: client.name,
      password: passwordInput.value,
    });
    return;
  }

  loginError.textContent = "账号或密码不正确。可以使用下方演示账号快速进入。";
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
    const accountKey = button.dataset.demoAccount;
    usernameInput.value = accountKey;
    passwordInput.value = demoAccounts[accountKey].password;
  });
});

document.querySelectorAll(".preview-trigger").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    const card = trigger.closest(".work-card");
    if (!card) return;
    event.stopPropagation();
    openLightbox(card);
  });
});

lightboxClose.addEventListener("click", closeLightbox);
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
  if (!card || currentAccount.role !== "管理员") return;
  deleteWorkCard(card);
  if (card.classList.contains("deleted")) closeLightbox();
});
addPaletteButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const card = activeLightboxCards()[activePreviewIndex] || null;
  if (!card) return;
  paletteEditMode = !paletteEditMode;
  renderPaletteOptions(card);
});
// 点击配色面板以外的空白处退出编辑态。
document.addEventListener("click", (event) => {
  if (!paletteEditMode) return;
  if (event.target.closest("#palettePanel")) return;
  paletteEditMode = false;
  const card = activeLightboxCards()[activePreviewIndex];
  if (card && lightbox.classList.contains("active")) renderPaletteOptions(card);
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
lightboxPrev.addEventListener("click", () => moveLightbox(-1));
lightboxNext.addEventListener("click", () => moveLightbox(1));
lightboxFile.addEventListener("click", (event) => {
  event.stopPropagation();
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || lightboxFile.isContentEditable) return;
  const previous = card.dataset.file;
  lightboxFile.contentEditable = "true";
  lightboxFile.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(lightboxFile);
  selection.removeAllRanges();
  selection.addRange(range);
  const commit = () => {
    const next = lightboxFile.textContent.trim();
    lightboxFile.contentEditable = "false";
    if (!next || (next !== previous && [...workCards].some((item) => item.dataset.file === next))) {
      lightboxFile.textContent = previous;
      if (next) showToast("稿件名称已存在，请换一个名称。", "warning");
      return;
    }
    card.dataset.file = next;
    const cardTitle = card.querySelector(".work-head strong");
    if (cardTitle) cardTitle.textContent = next;
    if (libraryCart.delete(previous)) libraryCart.add(next);
    renderDailyReviewBoard();
    renderLibraryGrid();
    renderCartPreview();
    renderLibraryCart();
    saveStudioState();
  };
  lightboxFile.addEventListener("blur", commit, { once: true });
  lightboxFile.addEventListener("keydown", (keyEvent) => {
    if (keyEvent.key === "Enter") {
      keyEvent.preventDefault();
      lightboxFile.blur();
    }
    if (keyEvent.key === "Escape") {
      lightboxFile.textContent = previous;
      lightboxFile.blur();
    }
  }, { once: true });
});
lightboxTags.addEventListener("click", (event) => {
  event.stopPropagation();
  lightboxTagPicker.classList.toggle("hidden");
});
lightboxTagOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-lightbox-tag]");
  if (!option) return;
  event.stopPropagation();
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card) return;
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
  saveStudioState();
});
lightboxProject.addEventListener("click", (event) => {
  event.stopPropagation();
  const card = activeLightboxCards()[activePreviewIndex];
  if (!card || currentAccount.role !== "管理员") return;
  selectFromDataSource({
    anchor: lightboxProject,
    options: projectOptions(),
    currentValue: lightboxProject.textContent.replace(/^项目：/, "").trim(),
    onSelect: (value) => {
      updateCardProject(card, value);
      lightboxProject.textContent = `项目：${value}`;
      renderDailyReviewBoard();
      saveStudioState();
    },
  });
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
  const commit = (confirmedAction, note = "") => {
    applyReviewDecision(card, confirmedAction, note);
    renderLightbox();
  };
  if (isReviewPending(card)) {
    commit(action);
  } else {
    openReviewConfirmation(card, action, commit);
  }
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
  if (activeReviewAction === "Pass") {
    setWorkSleeping(card, true);
  } else {
    renderDailyReviewBoard();
    saveStudioState();
  }
  showToast(`已保存 ${card?.dataset.file || "稿件"} 的${activeReviewAction === "Pass" ? "Pass 理由" : "修改意见"}。`, activeReviewAction === "Pass" ? "error" : "warning");
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
  toggleCardInfo.textContent = cardInfoHidden ? "显示卡片信息" : "隐藏卡片信息";
});
workSort.addEventListener("change", sortWorkCards);
workTimeFilter.addEventListener("change", sortWorkCards);
function shiftReviewDate(days) {
  const date = new Date(`${activeReviewDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  const next = dateKey(date);
  const today = dateKey(new Date());
  activeReviewDate = next > today ? today : next;
  renderDailyReviewBoard();
}

reviewPrevDay.addEventListener("click", () => shiftReviewDate(-1));
reviewNextDay.addEventListener("click", () => shiftReviewDate(1));
reviewDateInput.addEventListener("change", () => {
  if (!reviewDateInput.value) return;
  activeReviewDate = reviewDateInput.value;
  renderDailyReviewBoard();
});
reviewWorkTypeSwitch?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-worktype]");
  if (!button || button.dataset.reviewWorktype === activeReviewWorkType) return;
  activeReviewWorkType = button.dataset.reviewWorktype;
  renderDailyReviewBoard();
});
reviewStatusTabs.addEventListener("click", (event) => {
  const result = event.target.closest("[data-review-result]");
  if (result) {
    const group = result.closest("[data-review-filter-group]");
    activeReviewFilter = group.dataset.reviewFilterGroup;
    activeReviewResultFilter = result.dataset.reviewResult;
    reviewStatusTabs.querySelectorAll(".review-tab-menu").forEach((menu) => menu.classList.add("hidden"));
    renderDailyReviewBoard();
    return;
  }
  const menuToggle = event.target.closest("[data-review-menu-toggle]");
  if (menuToggle) {
    const group = menuToggle.closest("[data-review-filter-group]");
    const menu = group.querySelector(".review-tab-menu");
    const willOpen = menu.classList.contains("hidden");
    activeReviewFilter = group.dataset.reviewFilterGroup;
    renderDailyReviewBoard();
    reviewStatusTabs.querySelectorAll(".review-tab-menu").forEach((item) => item.classList.add("hidden"));
    if (willOpen) menu.classList.remove("hidden");
    return;
  }
  const button = event.target.closest("[data-review-filter]");
  if (!button) return;
  activeReviewFilter = button.dataset.reviewFilter;
  activeReviewResultFilter = "all";
  reviewStatusTabs.querySelectorAll(".review-tab-menu").forEach((menu) => menu.classList.add("hidden"));
  renderDailyReviewBoard();
});
startLibrarySession.addEventListener("click", () => {
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
topCartButton?.addEventListener("click", openCartPreview);
cartPreviewClose?.addEventListener("click", closeCartPreview);
openFullCart?.addEventListener("click", () => {
  closeCartPreview();
  switchView("cart");
});
globalSearchInput?.addEventListener("input", renderGlobalSearchResults);
globalSearchInput?.addEventListener("focus", renderGlobalSearchResults);
globalSearchResults?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-global-result]");
  if (!button) return;
  openGlobalSearchResult(Number(button.dataset.globalResult));
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".global-search")) hideGlobalSearchResults();
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
notificationDismiss?.addEventListener("click", closeNotificationModal);
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
projectLifecycleBody?.addEventListener("change", (event) => {
  if (event.target.matches('[name="deliveryFiles"]')) {
    const additions = [...(event.target.files || [])];
    const bySignature = new Map(pendingProjectLifecycleFiles.map((file) => [`${file.name}-${file.size || 0}`, file]));
    additions.forEach((file) => bySignature.set(`${file.name}-${file.size || 0}`, file));
    pendingProjectLifecycleFiles = [...bySignature.values()].slice(0, 50);
    const current = projectLifecycleBody.querySelector(".project-delivery-file-list, .project-delivery-empty");
    current?.insertAdjacentHTML("afterend", deliveryFilesSummary(pendingProjectLifecycleFiles));
    current?.remove();
    event.target.value = "";
  }
  updateDeliveryConfirmationState();
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
  const exactMatch = [...projectCustomerSelect.options].find((option) => option.textContent === projectCustomerInput.value.trim());
  if (exactMatch) projectCustomerSelect.value = exactMatch.value;
  renderProjectCustomerOptions(projectCustomerInput.value);
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
  createDefaultProjectCustomer(projectCustomerCreateInline.dataset.customerName || projectCustomerInput.value);
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
document.querySelector("#customerListFilter")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-cc-filter]");
  if (!btn) return;
  customerCenterFilter = btn.dataset.ccFilter;
  customerCenterPage = 1;
  openCustomerMenuId = null;
  renderCustomerList();
});
document.querySelector("#customerListBody")?.addEventListener("click", (event) => {
  // ⋯ 菜单开关
  const menuBtn = event.target.closest("[data-customer-menu]");
  if (menuBtn) {
    event.stopPropagation();
    openCustomerMenuId = openCustomerMenuId === menuBtn.dataset.customerMenu ? null : menuBtn.dataset.customerMenu;
    renderCustomerList();
    return;
  }
  // 更改合作状态
  const statusBtn = event.target.closest("[data-cc-set-status]");
  if (statusBtn) {
    event.stopPropagation();
    const client = customerCenterClients.find((c) => c.id === statusBtn.dataset.ccStatusId);
    if (client) client.status = statusBtn.dataset.ccSetStatus;
    openCustomerMenuId = null;
    renderCustomerList();
    if (document.querySelector("#customerDrawer")?.classList.contains("active")) renderCustomerDetail();
    showToast("合作状态已更新。", "success");
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
  // 复制客户登录账号密码
  const copyLogin = event.target.closest("[data-cc-copy-login]");
  if (copyLogin) {
    const client = customerCenterClients.find((c) => c.id === copyLogin.dataset.ccCopyLogin);
    if (client) {
      const text = `${client.name} 花型库登录\n账号：${client.loginAccount}\n密码：${client.loginPassword}`;
      navigator.clipboard?.writeText(text).catch(() => {});
      showToast("已复制账号密码，可发给客户。", "success");
    }
    return;
  }
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
  const startBtn = event.target.closest("[data-customer-start-selection]");
  if (startBtn) {
    const client = customerCenterClients.find((c) => c.id === startBtn.dataset.customerStartSelection);
    closeCustomerDrawer();
    openViewerEntry(client);
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
  const select = document.createElement("select");
  select.className = "cc-inline-input";
  select.innerHTML = employeeRoster().map((name) => `<option ${name === client.owner ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
  el.replaceWith(select);
  select.focus();
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    client.owner = select.value;
    renderCustomerDetail();
    if (client.owner !== previousOwner) showToast("客户负责人已更新。", "success");
  };
  select.addEventListener("change", commit);
  select.addEventListener("blur", commit);
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
    projectDetailFileInput.value = "";
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
    await attachProjectDetailFiles(projectDetailFileInput.files);
  } catch (error) {
    console.error(error);
    showToast("项目文件上传失败，请重新选择。", "error");
  } finally {
    projectDetailFileInput.value = "";
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
  projectFileManagerDropzone.classList.add("drag-active");
});
projectFileManagerDropzone?.addEventListener("dragleave", (event) => {
  if (!projectFileManagerDropzone.contains(event.relatedTarget)) projectFileManagerDropzone.classList.remove("drag-active");
});
projectFileManagerDropzone?.addEventListener("drop", async (event) => {
  event.preventDefault();
  projectFileManagerDropzone.classList.remove("drag-active");
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
teamManageButton?.addEventListener("click", () => {
  teamManageMode = !teamManageMode;
  renderTeamView();
});
teamGrid?.addEventListener("click", (event) => {
  const memberButton = event.target.closest("[data-team-member-detail]");
  if (memberButton) {
    openTeamProjectsModal(memberButton.dataset.teamMemberDetail);
    return;
  }
  const projectsButton = event.target.closest("[data-team-projects]");
  if (projectsButton && !projectsButton.disabled) {
    openTeamProjectsModal(projectsButton.dataset.teamProjects);
    return;
  }
  const menuButton = event.target.closest("[data-team-row-menu]");
  if (menuButton) {
    teamManageMode = true;
    renderTeamView();
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
      onConfirm: () => {
        teamMembers.splice(index, 1);
        saveStudioState();
        syncProjectMemberOptions();
        renderTeamView();
        showToast(`${member.name} 已移出团队。`, "success");
      },
    });
  }
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
renderProjectTypeFilterSummary();
myProjectGrid?.addEventListener("click", (event) => {
  const emptyCreateButton = event.target.closest("[data-project-empty-create]");
  if (emptyCreateButton) {
    openProjectCreateModal();
    selectedProjectStatus = emptyCreateButton.dataset.projectEmptyCreate || "需求确认";
    renderProjectStatusOptions();
    return;
  }
  const editButton = event.target.closest("[data-project-edit]");
  if (editButton) {
    event.stopPropagation();
    openProjectEditModal(editButton.dataset.projectEdit);
    return;
  }
  const deleteButton = event.target.closest("[data-project-delete]");
  if (deleteButton) {
    event.stopPropagation();
    deleteProject(deleteButton.dataset.projectDelete);
    return;
  }
  if (event.target.closest(".project-kanban-card")?.dataset.projectSource === "default") {
    showToast("演示项目可拖拽调整阶段；正式项目请通过新建项目建立。", "success");
    return;
  }
  const viewButton = event.target.closest("[data-project-view]");
  if (viewButton) {
    openProjectDetail(viewButton.dataset.projectView);
    return;
  }
});
myProjectGrid?.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".project-kanban-card");
  if (!card || currentAccount.role !== "管理员") {
    event.preventDefault();
    return;
  }
  draggingProjectPayload = {
    id: card.dataset.boardProject,
    source: card.dataset.projectSource,
  };
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(draggingProjectPayload));
});
myProjectGrid?.addEventListener("dragend", (event) => {
  event.target.closest(".project-kanban-card")?.classList.remove("dragging");
  myProjectGrid.querySelectorAll(".drop-active").forEach((column) => column.classList.remove("drop-active"));
  draggingProjectPayload = null;
});
myProjectGrid?.addEventListener("dragover", (event) => {
  const column = projectDropColumn(event.target);
  if (!column || currentAccount.role !== "管理员") return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});
myProjectGrid?.addEventListener("dragenter", (event) => {
  const column = projectDropColumn(event.target);
  if (!column || currentAccount.role !== "管理员") return;
  column.classList.add("drop-active");
});
myProjectGrid?.addEventListener("dragleave", (event) => {
  const column = projectDropColumn(event.target);
  if (!column || column.contains(event.relatedTarget)) return;
  column.classList.remove("drop-active");
});
myProjectGrid?.addEventListener("drop", (event) => {
  const column = projectDropColumn(event.target);
  if (!column || currentAccount.role !== "管理员") return;
  event.preventDefault();
  column.classList.remove("drop-active");
  const payload = draggingProjectPayload || (() => {
    try {
      return JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return null;
    }
  })();
  moveProjectToStage(payload, column.dataset.projectStage);
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
document.querySelector("#orderSearchBtn")?.addEventListener("click", renderOrderCenter);
orderList.addEventListener("click", (event) => {
  // 价格：点击修改（管理员/销售）
  const priceBtn = event.target.closest("[data-order-price]");
  if (priceBtn) { editOrderPrice(priceBtn.dataset.orderPrice); return; }
  // ⋯ 更多操作菜单：开关
  const menuBtn = event.target.closest("[data-order-menu]");
  if (menuBtn) {
    const pop = orderList.querySelector(`[data-order-menu-pop="${CSS.escape(menuBtn.dataset.orderMenu)}"]`);
    const willOpen = pop && pop.classList.contains("hidden");
    orderList.querySelectorAll(".order-menu-pop").forEach((el) => el.classList.add("hidden"));
    if (willOpen) pop.classList.remove("hidden");
    return;
  }
  // 菜单项：查看详情（打开订单生命周期详情页）
  const detailBtn = event.target.closest("[data-order-detail]");
  if (detailBtn) {
    openOrderDetail(detailBtn.dataset.orderDetail);
    return;
  }
  // 菜单项：上传协议
  const uploadAgrBtn = event.target.closest("[data-order-upload-agreement]");
  if (uploadAgrBtn) {
    const order = studioOrders.find((o) => o.id === uploadAgrBtn.dataset.orderUploadAgreement);
    if (order) openDeliveryAgreementModal(order, false);
    return;
  }
  // 菜单项：关闭订单
  const closeMenuBtn = event.target.closest("[data-order-close]");
  if (closeMenuBtn) { closeOrder(closeMenuBtn.dataset.orderClose); return; }
  // 菜单项：删除订单
  const deleteBtn = event.target.closest("[data-order-delete]");
  if (deleteBtn) { deleteStudioOrder(deleteBtn.dataset.orderDelete); return; }

  const expandBtn = event.target.closest("[data-order-expand]");
  if (expandBtn) {
    openOrderDetail(expandBtn.dataset.orderExpand);
    return;
  }
  const deliverBtn = event.target.closest("[data-order-toggle-deliver]");
  if (deliverBtn) {
    const order = studioOrders.find((o) => o.id === deliverBtn.dataset.orderToggleDeliver);
    if (order) {
      if (orderDeliverStatus(order) !== "已交付" && orderAgreementStatus(order) !== "已签署") {
        openDeliveryAgreementModal(order, false);
        return;
      }
      order.deliverStatus = orderDeliverStatus(order) === "已交付" ? "未交付" : "已交付";
      saveStudioState();
      renderOrderCenter();
      showToast(`订单 ${order.id} 已标记为${order.deliverStatus}。`, "success");
    }
    return;
  }
  const flower = event.target.closest(".order-flower");
  if (flower) {
    const card = sourceCardByFile(flower.getAttribute("title"));
    if (card) openLightbox(card);
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
// 点击空白处关闭 ⋯ 菜单
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-order-menu]") || event.target.closest(".order-menu-pop")) return;
  orderList.querySelectorAll(".order-menu-pop:not(.hidden)").forEach((el) => el.classList.add("hidden"));
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
    libraryCart.delete(remove.dataset.cartRemove);
    renderLibraryCart();
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
  const referencePreview = event.target.closest("[data-reference-key]");
  if (referencePreview) {
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
  button.addEventListener("click", openUploadModal);
});
uploadTypeSwitch?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upload-worktype]");
  if (!button || button.dataset.uploadWorktype === uploadWorkType) return;
  uploadWorkType = button.dataset.uploadWorktype;
  updateUploadTypeUI();
});
chooseFiles.addEventListener("click", () => artworkFiles.click());
chooseSourceFile.addEventListener("click", () => artworkSourceFile.click());
choosePaletteFiles.addEventListener("click", () => artworkPaletteFiles.click());
artworkPaletteFiles.addEventListener("change", () => {
  const incomingFiles = [...(artworkPaletteFiles.files || [])];
  const supportedFiles = incomingFiles.filter(isSupportedPaletteFile);
  if (supportedFiles.length !== incomingFiles.length) showToast("配色仅支持 JPEG、JPG、PNG、PSD、TIFF 文件。", "warning");
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
  const incomingFiles = [...(artworkSourceFile.files || [])];
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
  if (event.target.closest("[data-empty-upload]")) artworkFiles.click();
});
artworkFiles.addEventListener("change", () => {
  if (!artworkFiles.files.length) return;
  clearUploadValidation();
  const incomingFiles = [...artworkFiles.files];
  incomingFiles.forEach((file) => {
    if (!uploadFileNames.has(fileIdentity(file))) uploadFileNames.set(fileIdentity(file), file.name);
  });
  const mergedFiles = mergeUniqueFiles(selectedUploadFiles, incomingFiles);
  if (mergedFiles.length > MAX_UPLOAD_FILES) showToast("超过最大上传数量", "warning");
  selectedUploadFiles = mergedFiles.slice(0, MAX_UPLOAD_FILES);
  artworkFiles.value = "";
  renderSelectedFiles();
});
chooseReferenceFiles.addEventListener("click", () => referenceFiles.click());
referenceFiles.addEventListener("change", () => {
  if (!referenceFiles.files.length) return;
  clearUploadValidation();
  const incomingFiles = [...referenceFiles.files];
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
    if (removedFile) uploadFileNames.delete(fileIdentity(removedFile));
    renderSelectedFiles();
  }
  if (editButton) beginUploadNameEdit(editButton);
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
  selectedPainterWorks = [...draftPainterSelection];
  updateLinkedPainterSummary();
  closePainterPickerModal();
});
painterPickerModal.addEventListener("click", (event) => {
  if (event.target === painterPickerModal) {
    closePainterPickerModal();
  }
});
let painterPickerTimer = null;

painterFilter.addEventListener("change", renderPainterPicker);
painterSelectAll.addEventListener("click", () => {
  const query = painterPickerSearch.value.trim().toLowerCase();
  const painter = painterFilter.value;
  const visibleItems = painterLibrary.filter((item) => {
    const indexText = `${item.file} ${item.painter} ${item.project} ${item.tags.join(" ")}`.toLowerCase();
    return (painter === "all" || item.painter === painter) && (!query || indexText.includes(query));
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
  const item = painterLibrary.find((entry) => entry.file === card.dataset.file);
  if (!item) return;
  const alreadySelected = draftPainterSelection.some((entry) => entry.file === item.file);
  draftPainterSelection = alreadySelected
    ? draftPainterSelection.filter((entry) => entry.file !== item.file)
    : [...draftPainterSelection, item];
  renderPainterPicker();
});
projectSearch.addEventListener("focus", () => renderProjectResults(projectSearch.value));
projectSearch.addEventListener("click", () => renderProjectResults(projectSearch.value));
projectSearch.addEventListener("input", () => {
  clearTimeout(projectSearchTimer);
  projectSearchTimer = setTimeout(() => renderProjectResults(projectSearch.value), 200);
});
projectResults.addEventListener("click", (event) => {
  const option = event.target.closest(".project-option");
  if (!option) return;
  const project = projectLibrary.find((item) => item.name === option.dataset.project);
  if (!project) return;
  const exists = selectedProjects.some((item) => item.name === project.name);
  selectedProjects = exists ? selectedProjects.filter((item) => item.name !== project.name) : [...selectedProjects, project];
  projectSearch.value = "";
  renderLinkedProjects();
  renderProjectResults("");
});
linkedProjectList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-project]");
  const primaryButton = event.target.closest("[data-make-primary]");
  if (removeButton) selectedProjects = selectedProjects.filter((item) => item.name !== removeButton.dataset.removeProject);
  if (primaryButton) {
    const index = selectedProjects.findIndex((item) => item.name === primaryButton.dataset.makePrimary);
    if (index > 0) selectedProjects.unshift(...selectedProjects.splice(index, 1));
  }
  if (!removeButton && !primaryButton) return;
  renderLinkedProjects();
  renderProjectResults(projectSearch.value);
});
clearLinkedProjects.addEventListener("click", () => {
  selectedProjects = [];
  renderLinkedProjects();
  renderProjectResults(projectSearch.value);
});
clearProjectSearch.addEventListener("click", () => {
  projectSearch.focus();
});
addLinkedProject.addEventListener("click", () => {
  projectSearch.value = "";
  renderProjectResults("");
  projectSearch.focus();
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
  newTagInput.value = "";
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
  const validationErrors = [];
  if (!selectedUploadFiles.length) validationErrors.push({ selector: ".asset-upload-section", short: "缺少作品图片", message: "请至少添加 1 张作品图片。" });
  if (uploadWorkType !== "手绘师" && !selectedReferenceFiles.length && !originalDeclaration.checked) validationErrors.push({ selector: ".reference-panel", short: "缺少参考声明", message: "请添加参考图；如为原创作品，请勾选原创声明。" });
  if (validationErrors.length) {
    showUploadValidation(validationErrors);
    return;
  }
  clearUploadValidation();

  const count = 1 + selectedPaletteFiles.length;
  const painterText = selectedPainterWorks.length ? ` / 手绘 ${selectedPainterWorks.length} 幅` : "";
  const projectText = selectedProjects.length ? ` / 关联项目 ${selectedProjects.length} 个` : "";
  const referenceText = selectedReferenceFiles.length
    ? `参考图 ${selectedReferenceFiles.length} 张`
    : originalDeclaration.checked
      ? "原创声明"
      : "未提供参考图";

  uploadConfirm.textContent = "上传中…";
  uploadConfirm.disabled = true;

  try {
    const files = selectedUploadFiles.filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
      throw new Error("No image files selected");
    }
    const firstFile = files[0];
    const baseName = fileBaseName(uploadDisplayName(firstFile));
    const linkedPainterText = selectedPainterWorks.length
      ? selectedPainterWorks.map((item) => `${item.painter} / ${item.file}`).join("、")
      : "无引用 / 原创设计";
    const role = uploadWorkType;
    const owner = currentAccount.ownerKey;
    const nowText = formatDateTime();
    const suffix = [...document.querySelectorAll("[data-file]")].some((item) => item.dataset.file === baseName)
      ? `-${Date.now().toString().slice(-4)}`
      : "";
    const fileId = `${baseName}${suffix}`;
    const imageData = await readFileAsDataURL(firstFile);
    await saveImageToDB(fileId, imageData);
    const paletteKeys = [fileId];
    const paletteFileEntries = [{ name: firstFile.name, key: fileId, type: firstFile.type || "image/jpeg", primary: true }];
    for (let paletteIndex = 0; paletteIndex < selectedPaletteFiles.length; paletteIndex += 1) {
      const paletteFile = selectedPaletteFiles[paletteIndex];
      const paletteData = await readFileAsDataURL(paletteFile);
      const paletteKey = `${fileId}__color_${paletteIndex + 2}_${Date.now()}`;
      await saveImageToDB(paletteKey, paletteData);
      paletteKeys.push(paletteKey);
      paletteFileEntries.push({ name: paletteFile.name, key: paletteKey, type: paletteFile.type || "application/octet-stream", primary: false });
    }
    const referenceKeys = [];
    for (let refIndex = 0; refIndex < selectedReferenceFiles.length; refIndex += 1) {
      const referenceFile = selectedReferenceFiles[refIndex];
      if (!referenceFile.type.startsWith("image/")) continue;
      const referenceData = await readFileAsDataURL(referenceFile);
      const referenceKey = `${fileId}__reference_${refIndex + 1}_${Date.now()}`;
      await saveImageToDB(referenceKey, referenceData);
      referenceKeys.push(referenceKey);
    }
    const storedSourceFiles = [];
    for (let sourceIndex = 0; sourceIndex < selectedSourceFiles.length; sourceIndex += 1) {
      const sourceFile = selectedSourceFiles[sourceIndex];
      const sourceData = await readFileAsDataURL(sourceFile);
      const sourceKey = `${fileId}__source_${sourceIndex + 1}_${Date.now()}`;
      await saveImageToDB(sourceKey, sourceData);
      storedSourceFiles.push({ name: sourceFile.name, key: sourceKey, type: sourceFile.type || "application/octet-stream" });
    }
    const card = createWorkCard({
      file: fileId,
      role,
      owner,
      generated: true,
      version: nowText,
      colors: paletteKeys.length,
      tags: selectedUploadTags.join(","),
      imageKey: fileId,
      paletteKeys: JSON.stringify(paletteKeys),
      paletteFiles: JSON.stringify(paletteFileEntries),
      imageData,
      title: baseName,
      project: selectedProjects.length ? selectedProjects.map((item) => item.name).join("、") : "未关联项目",
      saleStatus: role === "手绘师" ? "未出售" : "未出售",
      customerStatus: "未进入客户选稿",
      reviewStatus: role === "手绘师" ? "不参与设计稿审核" : "待审核 / 管理者未评审",
      linkedPainter: linkedPainterText,
      referenceMaterial: referenceText,
      referenceKeys: JSON.stringify(referenceKeys),
      sourceFileName: storedSourceFiles[0]?.name || "",
      sourceFileKey: storedSourceFiles[0]?.key || "",
      sourceFileType: storedSourceFiles[0]?.type || "application/octet-stream",
      sourceFiles: JSON.stringify(storedSourceFiles),
    });
    card.dataset.version = nowText;
    refreshWorkCards();
    saveStudioState();
    configureWorksView(roleSelect.value, currentAccount.ownerKey);
    sortWorkCards();
    renderRecycleBin();
    renderDailyReviewBoard();
    renderLibraryGrid();
    uploadConfirm.textContent = "确认上传";
    uploadConfirm.disabled = false;
    closeUploadModal();
    showToast(`成功上传 1 个作品，包含 ${count} 个配色${painterText}${projectText}，等待管理员审核。`, "success");
  } catch (error) {
    console.error(error);
    uploadConfirm.textContent = "确认上传";
    uploadConfirm.disabled = false;
    showToast("上传失败，请重新选择图片再试。", "error");
  }
});
let replaceTargetCard = null;

/* ----- 替换图片 ----- */
const replaceImageInput = document.querySelector("#replaceImageInput");
replaceImageInput.addEventListener("change", async () => {
  if (!replaceTargetCard || !replaceImageInput.files.length) return;
  const files = [...replaceImageInput.files]
    .filter((file) => file.type.startsWith("image/"))
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
    const entries = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const dataUrl = await readFileAsDataURL(file);
      const key = `${replaceTargetCard.dataset.file}__color_${index + 1}_${Date.now()}`;
      await saveImageToDB(key, dataUrl);
      keys.push(key);
      entries.push({ name: file.name, key, type: file.type || "image/jpeg", primary: index === 0 });
      if (index === 0) {
        setImageKey(replaceTargetCard, key);
        applyImageData(replaceTargetCard, dataUrl);
      }
    }

    setPaletteKeys(replaceTargetCard, keys);
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
    saveStudioState();
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
  if (!event.target.closest(".review-filter-tab")) {
    reviewStatusTabs.querySelectorAll(".review-tab-menu").forEach((menu) => menu.classList.add("hidden"));
  }
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

  const libraryCard = event.target.closest(".library-card");
  if (libraryCard) {
    if (event.target.closest(".library-compare")) return;
    const targetCard = [...workCards].find((card) => card.dataset.file === libraryCard.dataset.libraryFile);
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
      resubmitSleepingWork(card, sleepAction.dataset.sleepAction);
    }
    return;
  }

  const sleepThumb = event.target.closest(".sleep-thumb");
  if (sleepThumb) {
    const file = sleepThumb.closest(".sleep-item")?.dataset.file;
    const card = [...workCards].find((item) => item.dataset.file === file);
    if (card) {
      openLightbox(card);
    }
    return;
  }

  const recycleThumb = event.target.closest(".recycle-thumb");
  if (recycleThumb) {
    const file = recycleThumb.closest(".recycle-item")?.dataset.file;
    const card = [...workCards].find((item) => item.dataset.file === file);
    if (card) openLightbox(card);
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
    openLightbox(previewCard);
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
    if (item) restoreWorkCard(item.card);
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
sleepSearch.addEventListener("input", renderSleepList);
sleepDesignerFilter.addEventListener("change", renderSleepList);
sleepTagFilter.addEventListener("change", renderSleepList);
sleepSort.addEventListener("change", renderSleepList);
emptyRecycle.addEventListener("click", () => {
  if (!deletedWorks.length) {
    return;
  }

  const confirmed = window.confirm("确认一键清空回收站吗？清空后当前原型中不会再显示这些作品。");
  if (!confirmed) {
    return;
  }

  const removedFiles = deletedWorks.map(({ card }) => card.dataset.file);
  studioState.removedFiles = [...new Set([...(studioState.removedFiles || []), ...removedFiles])];
  deletedWorks.forEach(({ card }) => card.remove());
  refreshWorkCards();
  deletedWorks = [];
  saveStudioState();
  renderRecycleBin();
  showToast("回收站已清空。", "warning");
});
lightboxImage.addEventListener("wheel", (event) => {
  event.preventDefault();
  event.stopPropagation();
  changeZoom(event.deltaY > 0 ? -0.18 : 0.18);
}, { passive: false });
lightboxImage.addEventListener("dblclick", (event) => {
  event.preventDefault();
  if (lightbox.classList.contains("info-hidden")) {
    lightbox.classList.remove("info-hidden");
  } else {
    lightbox.classList.add("info-hidden");
  }
  resetPreviewTransform();
});
lightboxImage.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: previewOffsetX,
    offsetY: previewOffsetY,
  };
  lightboxImage.classList.add("dragging");
  lightboxImage.setPointerCapture(event.pointerId);
});
lightboxImage.addEventListener("pointermove", (event) => {
  if (!dragStart) {
    return;
  }
  event.preventDefault();
  previewOffsetX = dragStart.offsetX + event.clientX - dragStart.x;
  previewOffsetY = dragStart.offsetY + event.clientY - dragStart.y;
  applyPreviewZoom();
});
lightboxImage.addEventListener("pointerup", () => {
  dragStart = null;
  lightboxImage.classList.remove("dragging");
});
lightboxImage.addEventListener("pointercancel", () => {
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
    if (painterPickerModal.classList.contains("active")) {
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
  const file = profileAvatarInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("请选择图片作为头像。", "warning");
    return;
  }
  const imageData = await readFileAsDataURL(file);
  saveCurrentProfilePatch({ avatar: imageData });
  showToast("头像已更新。", "success");
  profileAvatarInput.value = "";
});

logoutButton.addEventListener("click", () => {
  const portal = currentAccount.role === "客户" ? "client" : "employee";
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_ACCOUNT_DATA_KEY);
  appShell.classList.add("locked");
  loginScreen.classList.remove("hidden");
  roleSelect.disabled = false;
  if (userBadge) userBadge.textContent = "未登录";
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
  switchLoginPortal(portal);
  lockBodyScroll(false);
  releaseFileURLs();
});

applyStoredState();
syncRegisteredAccountsToTeam();
syncProjectMemberOptions();
loadProjectDrafts();
enhanceWorkCards();
syncReviewCardPreviews();
configureRoleNavigation(roleSelect.value);
updateRoleDashboard(roleSelect.value);
hydrateStoredImages();
renderSleepList();
renderDailyReviewBoard();
seedKingCaseLibrary();
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
} else if (storedSessionContext?.accountKey && storedSessionContext?.account) {
  applyLogin(storedSessionContext.accountKey, storedSessionContext.account);
} else if (storedSessionAccount && demoAccounts[storedSessionAccount]) {
  applyLogin(storedSessionAccount, demoAccounts[storedSessionAccount]);
} else {
  switchLoginPortal(requestedPortal === "client" ? "client" : "employee");
}

// ================= 客户看稿入口页（Silk 背景 + 玻璃面板） =================
const VIEWER_SESSION_KEY = "studio_site_viewer_session_v1";
let viewerSession = null;
let viewerSilkRaf = null;
let viewerStarting = false;
let viewerLastSelectionCount = -1;

// —— Silk WebGL 着色器（移植自 React Bits Silk）——
function initViewerSilk() {
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
  if (reduce) { gl.uniform1f(uTime, 2.0); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  else { cancelAnimationFrame(viewerSilkRaf); viewerSilkRaf = requestAnimationFrame(frame); }
}

// —— 漂浮花型卡片（氛围装饰）——
function renderViewerFloaters() {
  const layer = document.querySelector("#viewerFloatLayer");
  if (!layer) return;
  // 专属选稿入口只保留 Silk 动态背景，不叠加床品或花型图片。
  layer.innerHTML = "";
}

function openViewerEntry(prefill) {
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
  const matches = customerCenterClients.filter((c) => c.name.includes(q) || c.contact.includes(q)).slice(0, 6);
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
  const isNew = q && !contacts.includes(q);
  box.innerHTML = contacts.map((n) => `<button type="button" class="viewer-suggest-item" data-viewer-name="${escapeHtml(n)}"><strong>${escapeHtml(n)}</strong><span>已有联系人</span></button>`).join("")
    + (isNew ? `<div class="viewer-suggest-empty">「${escapeHtml(q)}」将作为新联系人</div>` : "");
  box.classList.toggle("hidden", !box.innerHTML);
}

// —— 开始看稿：保存会话 + 过渡 + 进入作品库 ——
function startViewing() {
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

// —— 全屏客户花型库 ——
let vlibFilterState = null;
let vlibSelectedOnly = false;
function vlibEnsureState() {
  if (!vlibFilterState) {
    vlibFilterState = {};
    libraryFilterConfig.forEach((r) => { vlibFilterState[r.key] = new Set(); });
  }
  return vlibFilterState;
}
function vlibFilteredCards() {
  const state = vlibEnsureState();
  let cards = approvedLibraryCards().filter((card) =>
    libraryFilterConfig.every((row) => {
      const sel = state[row.key];
      if (!sel.size) return true;
      return cardLibraryValues(card, row.key).some((v) => sel.has(v));
    })
  );
  if (vlibSelectedOnly) cards = cards.filter((c) => libraryCart.has(c.dataset.file));
  return cards;
}
function renderVlibFilters() {
  const bar = document.querySelector("#vlibFilter");
  if (!bar) return;
  const state = vlibEnsureState();
  bar.innerHTML = libraryFilterConfig.map((row) => {
    const st = state[row.key];
    const tags = st.size ? [...st].join("、") : "全部";
    const opts = `<label class="lib-opt"><input type="checkbox" data-vlib-cat="${row.key}" value="__all__" ${st.size === 0 ? "checked" : ""}/><span>全部</span></label>`
      + row.options.map((o) => `<label class="lib-opt"><input type="checkbox" data-vlib-cat="${row.key}" value="${escapeHtml(o)}" ${st.has(o) ? "checked" : ""}/><span>${escapeHtml(o)}</span></label>`).join("");
    return `<div class="library-filter-row"><span class="library-filter-label">${row.label}</span>
      <div class="lib-select" data-vlib-select="${row.key}">
        <button class="lib-select-trigger" type="button" data-vlib-toggle="${row.key}"><span class="lib-select-tags">${escapeHtml(tags)}</span><i class="lib-select-caret"></i></button>
        <div class="lib-select-panel hidden">${opts}</div>
      </div></div>`;
  }).join("");
}
function renderVlibGallery() {
  const grid = document.querySelector("#vlibGallery");
  if (!grid) return;
  const cards = vlibFilteredCards();
  // 该客户已买过的花型：只做提示，不禁止（非独家可重复售卖；是否停售由管理员决定）
  const ownedByThisCustomer = customerPurchasedFiles(viewerSession?.companyName || currentAccount.company || "");
  const lockedBySales = exclusivelySoldFiles();   // 管理员标记为独家/买断 -> 才真正下架
  grid.innerHTML = cards.length ? cards.map((card) => {
    const file = card.dataset.file;
    const repeat = ownedByThisCustomer.has(file);
    const soldOut = lockedBySales.has(file);
    const picked = libraryCart.has(file);
    const colors = Number(card.dataset.colors || 1);
    const check = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return `<div class="vlib-card ${picked ? "picked" : ""} ${soldOut ? "owned" : ""}" data-vlib-work="${escapeHtml(file)}">
      <div class="vlib-thumb" style="${card.dataset.imageData ? `background-image:url('${card.dataset.imageData}')` : ""}"></div>
      ${soldOut
        ? `<span class="vlib-owned-tag">已独家售出</span>`
        : `${repeat ? `<span class="vlib-owned-tag soft">已购买过</span>` : ""}
           <button class="vlib-add ${picked ? "added" : ""}" type="button" data-vlib-add="${escapeHtml(file)}" aria-label="${picked ? "已选，点击取消" : "加入选稿"}">${picked ? check : "+"}</button>`}
      <div class="vlib-hover"><strong>${escapeHtml(file)}</strong><span>${soldOut ? "已独家售出" : repeat ? `${colors} 配色 · 该客户已购买过` : `${colors} 配色`}</span></div>
    </div>`;
  }).join("") : `<p class="empty-state">未找到符合条件的花型。</p>`;
}
function openViewerLibraryOverlay() {
  const ov = document.querySelector("#viewerLibrary");
  if (!ov) return;
  vlibEnsureState();
  vlibSelectedOnly = false;
  if (viewerSession?.selectedPatternIds?.length) libraryCart = new Set(viewerSession.selectedPatternIds);
  const sub = document.querySelector("#vlibSubtitle");
  if (sub && viewerSession) sub.textContent = `正在为 ${viewerSession.companyName} · ${viewerSession.contactName} 选稿`;
  renderVlibFilters();
  renderVlibGallery();
  ov.classList.add("active");
  ov.setAttribute("aria-hidden", "false");
  document.body.classList.add("viewer-open");
  updateViewerSelectionBar();
}
function closeViewerLibraryOverlay() {
  const ov = document.querySelector("#viewerLibrary");
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
      const img = card?.dataset.imageData ? `background-image:url('${card.dataset.imageData}')` : "";
      const colors = Number(card?.dataset.colors || 1);
      const name = card?.querySelector(".work-head strong")?.textContent.trim() || f;
      return `<div class="flower-line"><span class="flower-line-thumb" style="${img}"></span><div class="flower-line-info"><strong>${escapeHtml(name)}</strong><small>${colors} 配色</small></div><button class="flower-line-remove" type="button" data-vlib-unpick="${escapeHtml(f)}">×</button></div>`;
    }).join("")}</div>` : `<p class="vlib-selected-empty">还没有选择花型。</p>`);
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
    owner, status: "潜在客户", type: "品牌客户", region: "", style: "", product: "",
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
    if (raw) viewerSession = JSON.parse(raw);
  } catch (e) {}
})();

// ===== 全屏花型库 + 入口页 返回/入口 交互 =====
(function bindViewerLibrary() {
  // 客户中心「开始看稿」直接入口
  document.querySelector("#openViewerFromCenter")?.addEventListener("click", () => openViewerEntry(null));
  // 入口页左上角 返回客户中心
  document.querySelector("#viewerBack")?.addEventListener("click", () => {
    closeViewerEntry();
    document.querySelector("#customerCenter")?.classList.remove("hidden");
  });
  // 花型库 返回 → 回到入口页
  document.querySelector("#vlibBack")?.addEventListener("click", () => {
    closeViewerLibraryOverlay();
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
    renderVlibGallery();
  });
  // 筛选：下拉开关
  document.querySelector("#vlibFilter")?.addEventListener("click", (e) => {
    const t = e.target.closest("[data-vlib-toggle]");
    if (!t) return;
    const box = t.closest(".lib-select");
    const panel = box.querySelector(".lib-select-panel");
    const willOpen = panel.classList.contains("hidden");
    document.querySelectorAll("#vlibFilter .lib-select-panel").forEach((p) => p.classList.add("hidden"));
    document.querySelectorAll("#vlibFilter .lib-select").forEach((s) => s.classList.remove("open"));
    panel.classList.toggle("hidden", !willOpen);
    box.classList.toggle("open", willOpen);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#vlibFilter .lib-select")) {
      document.querySelectorAll("#vlibFilter .lib-select-panel").forEach((p) => p.classList.add("hidden"));
      document.querySelectorAll("#vlibFilter .lib-select").forEach((s) => s.classList.remove("open"));
    }
  });
  // 画廊：加入/取消 + 预览
  document.querySelector("#vlibGallery")?.addEventListener("click", (e) => {
    const add = e.target.closest("[data-vlib-add]");
    if (add) {
      e.stopPropagation();
      const file = add.dataset.vlibAdd;
      const picked = !libraryCart.has(file);
      if (picked) libraryCart.add(file); else libraryCart.delete(file);
      // 只更新被点击的这一张卡（不再整库重绘，避免上百张图重新解码造成卡顿）
      const check = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      add.classList.toggle("added", picked);
      add.innerHTML = picked ? check : "+";
      add.setAttribute("aria-label", picked ? "已选，点击取消" : "加入选稿");
      add.closest(".vlib-card")?.classList.toggle("picked", picked);
      if (vlibSelectedOnly && !picked) add.closest(".vlib-card")?.remove(); // 仅看已选时移除
      renderLibraryCart();
      return;
    }
    const work = e.target.closest("[data-vlib-work]");
    if (work) {
      const card = [...workCards].find((c) => c.dataset.file === work.dataset.vlibWork);
      if (card) openLightbox(card);
    }
  });
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
      libraryCart.delete(rm.dataset.vlibUnpick);
      renderLibraryCart();
      renderVlibGallery();
      renderVlibSelectedPop();
    }
  });
  // 完成本次选稿 → 汇总到该客户的选稿车
  document.querySelector("#vlibFinish")?.addEventListener("click", () => {
    updateViewerSelectionBar();
    commitViewerSelection();
    const n = libraryCart.size;
    libraryCart = new Set();
    if (viewerSession) { viewerSession.selectedPatternIds = []; try { localStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(viewerSession)); } catch (e) {} }
    closeViewerLibraryOverlay();
    renderCartPreview();
    switchView("cart");
    showToast(`本次选稿已保存到选稿车，共 ${n} 款。`, "success");
  });
})();

// ================= 选稿车：按客户汇总 + 生成订单 =================
const SELECTION_CARTS_KEY = "studio_site_selection_carts_v1";
try { selectionCarts = JSON.parse(localStorage.getItem(SELECTION_CARTS_KEY) || "[]"); } catch (e) { selectionCarts = []; }
function saveSelectionCarts() { try { localStorage.setItem(SELECTION_CARTS_KEY, JSON.stringify(selectionCarts)); } catch (e) {} }

// 右上角选稿车：已提交（各客户选稿车）+ 本次进行中，合并去重
function allSelectedFiles() {
  const set = new Set([...libraryCart]);
  (selectionCarts || []).forEach((c) => (c.files || []).forEach((f) => set.add(f)));
  return [...set];
}

function commitViewerSelection() {
  if (!viewerSession) return;
  const files = [...libraryCart];
  if (!files.length) return;
  const key = viewerSession.customerId || viewerSession.companyName;
  let entry = selectionCarts.find((c) => (c.customerId || c.company) === key);
  if (!entry) {
    entry = { id: `SC-${Date.now()}`, customerId: viewerSession.customerId || null, company: viewerSession.companyName, contact: viewerSession.contactName, files: [], createdAt: formatDateTime() };
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
  if (!selectionCarts.length) {
    list.innerHTML = `<p class="empty-state">还没有客户选稿。完成一次客户看稿后会出现在这里。</p>`;
    return;
  }
  list.innerHTML = selectionCarts.map((entry) => {
    const rows = entry.files.map((f) => {
      const card = sourceCardByFile(f);
      const img = card?.dataset.imageData ? `background-image:url('${card.dataset.imageData}')` : "";
      const colors = Number(card?.dataset.colors || 1);
      const name = card?.querySelector(".work-head strong")?.textContent.trim() || f;
      return `<div class="flower-line">
        <span class="flower-line-thumb" style="${img}"></span>
        <div class="flower-line-info"><strong>${escapeHtml(name)}</strong><small>${colors} 配色</small></div>
        <button class="flower-line-remove" type="button" data-cart-remove-file="${escapeHtml(entry.id)}|${escapeHtml(f)}" aria-label="移除">×</button>
      </div>`;
    }).join("");
    return `<article class="cart-cust-card" data-cart-entry="${escapeHtml(entry.id)}">
      <div class="cart-cust-head">
        <div><strong>${escapeHtml(entry.company)}</strong><small>共 ${entry.files.length} 款花型</small></div>
        <div class="cart-cust-actions">
          <button class="ghost-button" type="button" data-cart-clear="${escapeHtml(entry.id)}">清空</button>
          <button class="primary-button" type="button" data-cart-order="${escapeHtml(entry.id)}">生成订单</button>
        </div>
      </div>
      <div class="cart-flower-rows">${rows}</div>
    </article>`;
  }).join("");
}

function cartEntryToOrder(entryId) {
  const entry = selectionCarts.find((c) => c.id === entryId);
  if (!entry) return;
  const order = {
    id: `DD-${Date.now().toString().slice(-8)}`,
    customer: entry.company,
    viewer: entry.contact,
    status: "已确认下单",
    progress: "已确认下单 / 待整理交付",
    deliverStatus: "未交付",
    agreementStatus: "未发起",
    price: entry.files.length * 100,
    patternIds: [...entry.files],
    files: entry.files.map((f) => ({ name: f })),
    designers: [],
    painters: [],
    createdAt: formatDateTime(),
  };
  studioOrders.unshift(order);
  selectionCarts = selectionCarts.filter((c) => c.id !== entryId);
  saveSelectionCarts();
  saveStudioState();
  renderCartPage();
  if (typeof renderOrderCenter === "function") renderOrderCenter();
  showToast(`已为 ${entry.company} 生成订单，进入订单中心。`, "success");
  switchView("orders");
}

document.querySelector("#cartCustomerList")?.addEventListener("click", (event) => {
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
  }
});

// ===== 新建客户档案：负责人 输入+下拉 组合框 =====
(function bindNcOwner() {
  const input = document.querySelector("#ncOwner");
  const box = document.querySelector("#ncOwnerSuggest");
  if (!input || !box) return;
  function render() {
    const q = input.value.trim();
    const list = employeeRoster().filter((n) => !q || n.includes(q));
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
    if (orderDeliverStatus(o) === "已交付" && orderAgreementStatus(o) === "已签署" && customerOwnsOrder(o, company)) {
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

/** 客户已购买（含待解锁）的全部花型 —— 仅用于提示"已购买过" */
function customerPurchasedFiles(company) {
  const set = new Set(customerDeliveredFiles(company));
  customerLockedFiles(company).forEach((_id, f) => set.add(f));
  return set;
}

function customerAgreementOrders(company) {
  if (!company) return [];
  return (studioOrders || []).filter((order) => (
    String(order.customer || "").includes(company)
    && orderDeliverStatus(order) !== "已交付"
    && ["待客户签署", "已签署"].includes(orderAgreementStatus(order))
  ));
}

function renderCustomerAgreementSection(company) {
  // 「待完成的交付协议」已统一移到「订单中心」处理，花型库只负责浏览花型。
  const section = document.querySelector("#customerAgreementSection");
  if (!section) return;
  section.classList.add("hidden");
  section.innerHTML = "";
  if (true) return;
  const orders = customerAgreementOrders(company);
  section.classList.toggle("hidden", orders.length === 0);
  section.innerHTML = orders.length ? `
    <div class="customer-agreement-head">
      <div><h3>待完成的交付协议</h3><p>签署后工作室才能交付并解锁高清文件。</p></div>
      <span>${orders.length} 份</span>
    </div>
    <div class="customer-agreement-list">
      ${orders.map((order) => {
        const signed = orderAgreementStatus(order) === "已签署";
        return `<div class="customer-agreement-row">
          <div>
            <strong>${escapeHtml(order.id)}</strong>
            <span>${orderPatternList(order).length} 款花型 · ${signed ? "已签署，等待工作室交付" : "等待你签署"}</span>
          </div>
          ${signed
            ? '<span class="customer-agreement-signed">已签署</span>'
            : `<button class="primary-button customer-agreement-button" type="button" data-customer-sign-agreement="${escapeHtml(order.id)}">查看并签署</button>`}
        </div>`;
      }).join("")}
    </div>` : "";
}

function renderMyPatternLibrary() {
  const grid = document.querySelector("#myLibraryGrid");
  if (!grid) return;
  const company = currentAccount.company || currentAccount.name || "";
  const title = document.querySelector("#myLibraryTitle");
  if (title) title.textContent = `我的花型库 · ${company}`;
  renderCustomerAgreementSection(company);
  const files = customerDeliveredFiles(company);
  const locked = customerLockedFiles(company);
  const lockIcon = `<svg class="mylib-lock-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/><circle cx="12" cy="15.4" r="1.5"/></svg>`;
  const cell = (f, isLocked, orderId) => {
    const card = sourceCardByFile(f);
    const img = card?.dataset.imageData ? `background-image:url('${card.dataset.imageData}')` : "";
    const colors = Number(card?.dataset.colors || 1);
    const name = card?.querySelector(".work-head strong")?.textContent.trim() || f;
    return `<button class="mylib-card ${isLocked ? "locked" : ""}" type="button" ${isLocked ? `data-mylib-locked="${escapeHtml(orderId || "")}"` : `data-mylib-file="${escapeHtml(f)}"`}>
      <span class="mylib-thumb" style="${img}">${isLocked ? `<span class="mylib-lock">${lockIcon}<small>等待交付解锁</small></span>` : ""}</span>
      <span class="mylib-info"><strong>${escapeHtml(name)}</strong><small>${isLocked ? "已购买 · 待解锁" : `${colors} 配色`}</small></span>
    </button>`;
  };
  const html = [...locked.keys()].map((f) => cell(f, true, locked.get(f))).join("") + files.map((f) => cell(f, false)).join("");
  grid.innerHTML = html || `<p class="empty-state">还没有属于你的花型。完成付款后，购买的花型会出现在这里。</p>`;
  // 客户已看过交付
  if (files.length) {
    studioOrders.forEach((o) => { if (customerOwnsOrder(o, company) && orderDeliverStatus(o) === "已交付") o.customerSeenDelivery = true; });
  }
  updateSidebarBadges();
}
document.querySelector("#myLibraryGrid")?.addEventListener("click", (e) => {
  const lockedCell = e.target.closest("[data-mylib-locked]");
  if (lockedCell) {
    const oid = lockedCell.dataset.mylibLocked;
    if (oid) openOrderDetail(oid); else showToast("该花型待工作室交付后解锁。", "warning");
    return;
  }
  const c = e.target.closest("[data-mylib-file]");
  if (!c) return;
  openCustomerPatternViewer(c.dataset.mylibFile);
});

/* 客户端花型查看器：只有多配色浏览 + 下载原文件，不暴露任何内部信息 */
function openCustomerPatternViewer(file) {
  const card = sourceCardByFile(file);
  if (!card) return;
  let ov = document.getElementById("custPatternViewer");
  if (!ov) {
    const st = document.createElement("style");
    st.textContent = `
      #custPatternViewer{position:fixed;inset:0;z-index:1300;display:none}
      #custPatternViewer.open{display:block}
      #custPatternViewer .cpv-scrim{position:absolute;inset:0;background:rgba(20,18,16,.72)}
      #custPatternViewer .cpv-box{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(760px,92vw);max-height:88vh;overflow:auto;background:#fff;border-radius:18px;padding:24px}
      #custPatternViewer .cpv-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
      #custPatternViewer .cpv-head h3{margin:0;font-size:18px}
      #custPatternViewer .cpv-x{border:none;background:none;font-size:22px;color:#78716c;cursor:pointer}
      #custPatternViewer .cpv-main{width:100%;aspect-ratio:4/3;border-radius:12px;background:#f5f4f2 center/cover no-repeat;border:1px solid #eae8e4}
      #custPatternViewer .cpv-sub{font-size:13px;color:#57534e;margin:14px 0 8px}
      #custPatternViewer .cpv-colors{display:flex;gap:10px;flex-wrap:wrap}
      #custPatternViewer .cpv-c{width:64px;height:64px;border-radius:8px;background:#f5f4f2 center/cover no-repeat;
        border:2px solid transparent;cursor:pointer}
      #custPatternViewer .cpv-c.on{border-color:#1c1917}
      #custPatternViewer .cpv-dl{margin-top:20px;width:100%;padding:14px;border:none;border-radius:10px;
        background:#1c1917;color:#fff;font-size:15px;cursor:pointer}
      #custPatternViewer .cpv-dl:hover{background:#000}`;
    document.head.appendChild(st);
    ov = document.createElement("div");
    ov.id = "custPatternViewer";
    ov.innerHTML = `<div class="cpv-scrim" data-cpv-close></div><div class="cpv-box" id="cpvBox"></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target.closest("[data-cpv-close]")) { ov.classList.remove("open"); lockBodyScroll(false); } });
  }
  const name = card.querySelector(".work-head strong")?.textContent.trim() || file;
  const main = card.dataset.imageData || "";
  let palette = [];
  try { palette = JSON.parse(card.dataset.paletteKeys || "[]"); } catch {}
  const box = document.getElementById("cpvBox");
  box.innerHTML = `<div class="cpv-head"><h3>${escapeHtml(name)}</h3><button class="cpv-x" data-cpv-close>×</button></div>
    <div class="cpv-main" id="cpvMain" style="${main ? `background-image:url('${main}')` : ""}"></div>
    ${palette.length > 1 ? `<div class="cpv-sub">配色（${palette.length}）</div>
      <div class="cpv-colors" id="cpvColors">${palette.map((k, i) => `<div class="cpv-c ${i === 0 ? "on" : ""}" data-cpv-key="${escapeHtml(k)}"></div>`).join("")}</div>` : ""}
    <button class="cpv-dl" data-cpv-download="${escapeHtml(file)}">下载原文件</button>`;
  // 异步载入配色缩略图
  palette.forEach(async (k, i) => {
    try {
      const src = await resolveImageSource(k);
      const el = box.querySelector(`[data-cpv-key="${CSS.escape(k)}"]`);
      if (el && src) el.style.backgroundImage = `url('${src}')`;
      if (i === 0 && src) document.getElementById("cpvMain").style.backgroundImage = `url('${src}')`;
    } catch {}
  });
  box.querySelector("#cpvColors")?.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-cpv-key]");
    if (!c) return;
    box.querySelectorAll(".cpv-c").forEach((x) => x.classList.toggle("on", x === c));
    const src = await resolveImageSource(c.dataset.cpvKey);
    if (src) document.getElementById("cpvMain").style.backgroundImage = `url('${src}')`;
  });
  box.querySelector("[data-cpv-download]")?.addEventListener("click", async () => {
    const key = card.dataset.sourceFileKey || card.dataset.imageKey;
    const fname = card.dataset.sourceFileName || `${name}.png`;
    if (key) await downloadStoredFile(key, fname);
    else showToast("原文件尚未上传，请联系工作室。", "warning");
  });
  ov.classList.add("open");
  lockBodyScroll(true);
}
// 客户档案 · 历史订单 → 打开订单详情
document.addEventListener("click", (event) => {
  const row = event.target.closest("[data-cc-open-order]");
  if (!row) return;
  openOrderDetail(row.dataset.ccOpenOrder);
});
document.querySelector("#customerAgreementSection")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-customer-sign-agreement]");
  if (!button) return;
  const order = studioOrders.find((item) => item.id === button.dataset.customerSignAgreement);
  if (order) openDeliveryAgreementModal(order, true);
});
