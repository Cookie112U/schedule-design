window.ScheduleApiClient = (() => {
const DEFAULT_BASE_URL = "";

function getBaseUrl() {
  return window.SCHEDULE_API_BASE_URL || DEFAULT_BASE_URL;
}

function buildUrl(path, query = {}) {
  const base = getBaseUrl().replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`, window.location.href);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function request(path, query) {
  const response = await fetch(buildUrl(path, query), {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Public API ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

return {
  buildUrl,
  request
};
})();
