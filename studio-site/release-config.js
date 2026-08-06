window.KING_RELEASE_CONFIG = Object.freeze({
  // Vercel has no Socket.IO intranet channel; use the authenticated API polling path
  // so changes made on another device are pulled back into the current page.
  deployment: "vercel",
  useBackendAuth: true,
  // Vercel 同源部署：业务 API 使用当前域名的 /api 路径。
  apiBaseUrl: "",
  enabledEmployeeRoles: ["管理员", "设计师", "手绘师", "销售"],
  seedDemoData: false,
  seedCaseLibrary: false,
  showDemoShortcuts: false,
  showClientReviewEntry: false,
  enableCustomerPayments: true,
  paymentMode: "manual_collect",
  paymentQr: {
    alipay: "./assets/payment/alipay-collect.png",
    wechat: "./assets/payment/wechat-collect.png",
  },
});
