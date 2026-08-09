window.ScheduleConfig = {
  // auto: локально запросы идут на localApiOrigin,
  // на боевом домене используются относительные /api/... рядом с сайтом.
  // file:// имеет origin null, поэтому backend должен отдельно разрешать null
  // или страницу нужно открывать через обычный статический сервер.
  apiBaseUrl: "auto",
  localApiOrigin: "http://127.0.0.1:8000",
  publicApiPrefix: "/api/v1/public"
};
