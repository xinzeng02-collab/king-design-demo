// Public UI demo only. It deliberately has no network API, NAS, database, or desktop integration.
window.KING_RELEASE_CONFIG = Object.freeze({
  deployment: "public-demo",
  useBackendAuth: false,
  apiBaseUrl: "",
  enabledEmployeeRoles: ["管理员", "设计师", "手绘师", "销售"],
  seedDemoData: true,
  seedCaseLibrary: false,
  showDemoShortcuts: true,
  showClientReviewEntry: false,
  enableCustomerPayments: false,
  paymentMode: "disabled",
});
