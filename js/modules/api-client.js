window.ScheduleApiClient = (() => {
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
  const DEFAULT_LOCAL_API_ORIGIN = "http://127.0.0.1:8000";

  function config() {
    return window.ScheduleConfig || {};
  }

  function normalizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/$/, "");
  }

  function isAbsoluteUrl(value) {
    return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
  }

  function getStoredBaseUrl() {
    try {
      return window.localStorage.getItem("scheduleApiBaseUrl") || "";
    } catch {
      return "";
    }
  }

  function getQueryBaseUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("apiBaseUrl") || params.get("api") || "";
    } catch {
      return "";
    }
  }

  function isFileFrontend() {
    return window.location.protocol === "file:";
  }

  function isLocalFrontend() {
    const host = window.location.hostname;
    const port = window.location.port;
    return LOCAL_HOSTS.has(host) && Boolean(port) && port !== "8000";
  }

  function getLocalApiOrigin() {
    return normalizeBaseUrl(config().localApiOrigin || DEFAULT_LOCAL_API_ORIGIN);
  }

  function getExplicitBaseUrl() {
    const runtimeBaseUrl = normalizeBaseUrl(window.SCHEDULE_API_BASE_URL);
    if (runtimeBaseUrl) return runtimeBaseUrl;

    const configuredBaseUrl = normalizeBaseUrl(config().apiBaseUrl);
    if (configuredBaseUrl && configuredBaseUrl !== "auto") return configuredBaseUrl;

    const queryBaseUrl = normalizeBaseUrl(getQueryBaseUrl());
    if (queryBaseUrl) return queryBaseUrl;

    return normalizeBaseUrl(getStoredBaseUrl());
  }

  function getBaseUrl() {
    const explicitBaseUrl = getExplicitBaseUrl();
    if (explicitBaseUrl) return explicitBaseUrl;
    if (isLocalFrontend() || isFileFrontend()) return getLocalApiOrigin();
    return "";
  }

  function setBaseUrl(value) {
    window.SCHEDULE_API_BASE_URL = value || "";

    try {
      if (value) window.localStorage.setItem("scheduleApiBaseUrl", value);
      else window.localStorage.removeItem("scheduleApiBaseUrl");
    } catch {
      /* ignore storage restrictions */
    }
  }

  function createClientError(message, code, cause) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  function buildUrl(path, query = {}, base = getBaseUrl()) {
    const rawPath = String(path || "");
    const normalizedPath = isAbsoluteUrl(rawPath) ? rawPath : rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const normalizedBase = normalizeBaseUrl(base);
    const href = isAbsoluteUrl(normalizedPath) ? normalizedPath : normalizedBase ? `${normalizedBase}${normalizedPath}` : normalizedPath;
    const baseHref = window.location.origin === "null" ? window.location.href : window.location.origin;
    const url = isAbsoluteUrl(href) ? new URL(href) : new URL(href, baseHref);

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }

  async function readError(response) {
    try {
      const payload = await response.json();
      return payload?.detail || payload?.message || response.statusText;
    } catch {
      return response.statusText;
    }
  }

  function wrapNetworkError(error, targetUrl = getLocalApiOrigin()) {
    if (error?.code) return error;

    const reason = typeof navigator !== "undefined" && navigator.onLine === false
      ? "offline"
      : isFileFrontend()
        ? "file-origin"
        : isLocalFrontend()
          ? "local-origin"
          : "network";
    const wrapped = createClientError("Не удалось получить данные расписания", "NETWORK_ERROR", error);
    wrapped.reason = reason;
    wrapped.url = targetUrl;
    return wrapped;
  }

  async function request(path, query) {
    const base = getBaseUrl();
    const url = buildUrl(path, query, base);

    let response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" }
      });
    } catch (error) {
      throw wrapNetworkError(error, url);
    }

    if (!response.ok) {
      const error = new Error(await readError(response));
      error.status = response.status;
      error.statusText = response.statusText;
      error.retryAfter = response.headers.get("Retry-After");
      error.url = response.url;
      throw error;
    }

    if (response.status === 204) return null;
    return response.json();
  }

  return {
    buildUrl,
    getBaseUrl,
    isFileFrontend,
    isLocalFrontend,
    request,
    setBaseUrl
  };
})();
