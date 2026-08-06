// Public cloud demo. Business works use Supabase; legacy modules remain browser-local until migrated.
window.KING_RELEASE_CONFIG = Object.freeze({
  deployment: "public-demo",
  useBackendAuth: false,
  apiBaseUrl: "",
  enabledEmployeeRoles: ["管理员", "设计师", "手绘师", "销售"],
  seedDemoData: false,
  seedCaseLibrary: false,
  showDemoShortcuts: true,
  showClientReviewEntry: false,
  enableCustomerPayments: false,
  paymentMode: "disabled",
  supabase: {
    url: "https://pplvtjddgxzmbppxoajl.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwbHZ0amRkZ3h6bWJwcHhvYWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NTIxMzgsImV4cCI6MjEwMTUyODEzOH0.vLxVWTJFS_VU56Og74nK1C_R-1lqGalZCxmIbeEoSn0",
  },
});
