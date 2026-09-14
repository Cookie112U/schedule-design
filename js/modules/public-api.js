window.SchedulePublicApi = (() => {
  const api = window.ScheduleApiClient;
  const config = window.ScheduleConfig || {};
  const PUBLIC_PREFIX = config.publicApiPrefix || "/api/v1/public";
  const LEGACY_PREFIX = config.legacyApiPrefix || "/api/schedule/legacy";

  function trimSlash(value) {
    return String(value || "").replace(/\/$/, "");
  }

  function byName(path, name) {
    return `${path}/${encodeURIComponent(name)}`;
  }

  function legacyBaseUrl() {
    const runtime = window.SCHEDULE_LEGACY_API_BASE_URL || "";
    return trimSlash(runtime || config.legacyApiBaseUrl || "");
  }

  function legacyUrl(path = "") {
    const prefix = trimSlash(LEGACY_PREFIX);
    const suffix = String(path || "").replace(/^\//, "");
    const href = suffix ? `${prefix}/${suffix}` : prefix;
    const base = legacyBaseUrl();
    return base ? `${base}${href}` : href;
  }

  function listGroups() {
    return api.request(`${PUBLIC_PREFIX}/groups`);
  }

  function getGroup(groupCode) {
    return api.request(byName(`${PUBLIC_PREFIX}/groups`, groupCode));
  }

  function listTeachers() {
    return api.request(`${PUBLIC_PREFIX}/teachers`);
  }

  function getTeacher(teacherName) {
    return api.request(byName(`${PUBLIC_PREFIX}/teachers`, teacherName));
  }

  function listClassrooms(date) {
    return api.request(`${PUBLIC_PREFIX}/classrooms`, { date });
  }

  function listBuildings() {
    return api.request(`${PUBLIC_PREFIX}/buildings`);
  }

  function getDictionaries() {
    return api.request(`${PUBLIC_PREFIX}/dictionaries`);
  }

  function getTimeTemplate({ date, day } = {}) {
    return api.request(`${PUBLIC_PREFIX}/time-template`, { date, day });
  }

  function getSchedule({ view, query, date }) {
    return api.request(`${PUBLIC_PREFIX}/schedule`, { view, query, date });
  }

  function getWeekSchedule(type, query, weekStart) {
    const allowed = ["group", "teacher", "classroom"];
    if (!allowed.includes(type)) {
      throw new Error(`Unsupported week schedule type: ${type}`);
    }
    return api.request(`${PUBLIC_PREFIX}/schedule/${type}/${encodeURIComponent(query)}/week`, {
      week_start: weekStart
    });
  }

  function getScheduleDates(days = 30) {
    return api.request(`${PUBLIC_PREFIX}/schedule/dates`, { days });
  }

  function getLegacyDates() {
    return api.request(legacyUrl());
  }

  function getLegacyMeta(date) {
    return api.request(legacyUrl(date));
  }

  function getLegacySchedule({ date, type = "all", name } = {}) {
    if (!date) return Promise.resolve(null);
    const parts = [date, type].filter(Boolean).map((part) => encodeURIComponent(part));
    if (name) parts.push(encodeURIComponent(name));
    return api.request(legacyUrl(parts.join("/")));
  }

  return {
    getDictionaries,
    getGroup,
    getLegacyDates,
    getLegacyMeta,
    getLegacySchedule,
    getSchedule,
    getScheduleDates,
    getTeacher,
    getTimeTemplate,
    getWeekSchedule,
    listBuildings,
    listClassrooms,
    listGroups,
    listTeachers
  };
})();