window.ScheduleConfig = {
  // public: /api/v1/public, legacy: /api/schedule/legacy.
  // apiBaseUrl = auto leaves production paths relative and sends local/file pages to localApiOrigin.
  apiMode: "legacy",
  apiBaseUrl: "auto",
  localApiOrigin: "http://127.0.0.1:8000",
  publicApiPrefix: "/api/v1/public",
  legacyApiBaseUrl: "https://erp.nttek.ru",
  legacyApiPrefix: "/api/schedule/legacy"
};