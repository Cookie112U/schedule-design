window.ScheduleRequest = (() => {
  const api = window.SchedulePublicApi;
  const legacyMetaCache = new Map();
  let legacyDatesPromise = null;

  function apiMode() {
    return String(window.ScheduleConfig?.apiMode || "public").toLowerCase();
  }

  function isLegacyMode() {
    return apiMode() === "legacy";
  }

  function normalizeDateKey(value) {
    const raw = String(value || "").trim();
    const ruMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (ruMatch) return `${ruMatch[3]}-${ruMatch[2]}-${ruMatch[1]}`;
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return isoMatch ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` : "";
  }

  function todayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function sortDates(dates) {
    return [...dates].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  function legacyMeta(dateKey) {
    if (!legacyMetaCache.has(dateKey)) {
      legacyMetaCache.set(dateKey, api.getLegacyMeta(dateKey).catch((error) => {
        legacyMetaCache.delete(dateKey);
        throw error;
      }));
    }
    return legacyMetaCache.get(dateKey);
  }

  function legacyDates() {
    if (!legacyDatesPromise) {
      legacyDatesPromise = api.getLegacyDates().then((dates) => sortDates((Array.isArray(dates) ? dates : []).map(normalizeDateKey))).catch((error) => { legacyDatesPromise = null; throw error; });
    }
    return legacyDatesPromise;
  }


  async function loadCatalogMeta({ date } = {}) {
    const requestedDate = normalizeDateKey(date) || todayKey();

    try {
      return await legacyMeta(requestedDate);
    } catch (error) {
      if (error?.status === 404) {
        const notFound = new Error("На данную дату нет расписания");
        notFound.status = 404;
        notFound.code = "SCHEDULE_DATE_NOT_FOUND";
        notFound.date = requestedDate;
        throw notFound;
      }
      throw error;
    }
  }

  function loadScheduleMeta(params = {}) {
    if (!isLegacyMode()) return Promise.resolve(null);
    const date = normalizeDateKey(params.date);
    return date ? api.getLegacyMeta(date) : Promise.resolve(null);
  }

  function legacyBuildingLabel(building, index) {
    const number = String(building?.number || building?.name || `Корпус ${index + 1}`).trim();
    const address = String(building?.address || "").trim();
    return [number, address].filter(Boolean).join(" ");
  }

  function legacyGroupsByBuilding(data = {}) {
    const groups = data.groups || [];
    const buildings = data.buildings || [];

    if (!Array.isArray(groups)) return groups;
    if (!groups.every(Array.isArray)) return groups;

    return groups.reduce((result, list, index) => {
      const building = legacyBuildingLabel(buildings[index], index);
      result[building] = list;
      return result;
    }, {});
  }

  async function loadGroups(params = {}) {
    if (!isLegacyMode()) return api.listGroups();
    const meta = await loadCatalogMeta(params);
    return legacyGroupsByBuilding(meta?.data || meta || {});
  }

  async function loadTeachers(params = {}) {
    if (!isLegacyMode()) return api.listTeachers();
    const meta = await loadCatalogMeta(params);
    return meta?.data?.teachers || meta?.teachers || [];
  }

  function loadClassrooms(date) {
    if (!isLegacyMode()) return api.listClassrooms(date);
    return api.getLegacySchedule({ date: normalizeDateKey(date), type: "all" });
  }

  async function loadBuildings(params = {}) {
    if (!isLegacyMode()) return api.listBuildings();
    const meta = await loadCatalogMeta(params);
    return meta?.data?.buildings || meta?.buildings || [];
  }

  function loadDictionaries() {
    if (!isLegacyMode()) return api.getDictionaries();
    return Promise.resolve(null);
  }

  function loadScheduleDates(days = 30) {
    if (!isLegacyMode()) return api.getScheduleDates(days);
    return legacyDates();
  }

  function loadTimeTemplate(params = {}) {
    if (!isLegacyMode()) return api.getTimeTemplate(params);
    return Promise.resolve(window.ScheduleTimeStore?.getSlots(params.date) || []);
  }

  function loadDaySchedule(params = {}) {
    if (!isLegacyMode()) return api.getSchedule(params);
    return api.getLegacySchedule({
      date: normalizeDateKey(params.date),
      type: params.view,
      name: params.query
    });
  }

  function loadWeekSchedule({ type, query, weekStart, dateKey } = {}) {
    if (!type || !query) return Promise.resolve(null);
    if (!isLegacyMode()) {
      if (!weekStart) return Promise.resolve(null);
      return api.getWeekSchedule(type, query, weekStart);
    }
    return api.getLegacySchedule({ date: normalizeDateKey(dateKey), type, name: query });
  }

  return {
    apiMode,
    isLegacyMode,
    loadBuildings,
    loadClassrooms,
    loadDaySchedule,
    loadDictionaries,
    loadGroups,
    loadScheduleDates,
    loadScheduleMeta,
    loadTeachers,
    loadTimeTemplate,
    loadWeekSchedule
  };
})();