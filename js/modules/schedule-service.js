window.ScheduleService = (() => {
  const request = window.ScheduleRequest;
  const transform = window.ScheduleTransform;
  const cache = new Map();
  const ttl = {
    catalog: 10 * 60 * 1000,
    schedule: 45 * 1000,
    dates: 2 * 60 * 1000,
    classrooms: 45 * 1000,
    timeTemplate: 15 * 60 * 1000
  };

  function cacheKey(params) {
    return JSON.stringify(params);
  }

  function fromCache(key) {
    const item = cache.get(key);
    if (!item || item.expiresAt < Date.now()) {
      cache.delete(key);
      return null;
    }
    return item.value;
  }

  async function withCache(key, maxAge, loader, force = false) {
    if (!force) {
      const cached = fromCache(key);
      if (cached) return cached;
    }

    const value = await loader();
    cache.set(key, { value, expiresAt: Date.now() + maxAge });
    return value;
  }

  function settle(name, promise, normalize = (value) => value, optional = false) {
    return promise
      .then((value) => ({ name, value: normalize(value), error: null, optional }))
      .catch((error) => ({ name, value: null, error, optional }));
  }

  async function getCatalogs({ force = false, dateDays = 120, dateKey } = {}) {
    const key = cacheKey({ type: "catalogs", dateDays, dateKey, mode: request.apiMode?.() });
    return withCache(key, ttl.catalog, async () => {
      const criticalResults = [];
      const groupsResult = await settle("groups", request.loadGroups({ date: dateKey }), transform.normalizeGroups);
      criticalResults.push(groupsResult);

      if (!groupsResult.error) {
        criticalResults.push(await settle("teachers", request.loadTeachers({ date: dateKey }), transform.normalizeTeachers));
      }

      const hasCriticalError = criticalResults.some((item) => item.error);
      const optionalResults = hasCriticalError
        ? []
        : await Promise.all([
          settle("buildings", request.loadBuildings({ date: dateKey }), transform.normalizeBuildings, true),
          settle("dictionaries", request.loadDictionaries(), (value) => value, true),
          settle("dates", request.loadScheduleDates(dateDays), transform.normalizeScheduleDates, true),
          settle("meta", request.loadScheduleMeta({ date: dateKey }), (value) => value, true)
        ]);

      const results = [...criticalResults, ...optionalResults];
      const data = results.reduce((catalogs, item) => {
        catalogs[item.name] = item.value;
        if (item.error) {
          if (item.optional) catalogs.optionalErrors.push(item.error);
          else catalogs.errors.push(item.error);
        }
        return catalogs;
      }, {
        groups: {},
        teachers: [],
        classrooms: [],
        buildings: [],
        dictionaries: null,
        dates: [],
        meta: null,
        errors: [],
        optionalErrors: []
      });

      if (data.errors.length) {
        const error = data.errors[0];
        error.partial = data;
        throw error;
      }

      return data;
    }, force);
  }

  async function getScheduleDates({ days = 120, force = false } = {}) {
    const key = cacheKey({ type: "dates", days, mode: request.apiMode?.() });
    return withCache(key, ttl.dates, async () => {
      const response = await request.loadScheduleDates(days);
      return transform.normalizeScheduleDates(response);
    }, force);
  }

  async function getWeekDay({ type, query, weekStart, dateKey, force = false }) {
    const key = cacheKey({ type: "week", view: type, query, weekStart, dateKey, mode: request.apiMode?.() });
    const response = await withCache(key, ttl.schedule, () => request.loadWeekSchedule({ type, query, weekStart, dateKey }), force);
    return transform.toUiLessonsForDate(response, dateKey);
  }

  async function getClassrooms({ dateKey, force = false } = {}) {
    const key = cacheKey({ type: "classrooms", dateKey, mode: request.apiMode?.() });
    return withCache(key, ttl.classrooms, async () => {
      const response = await request.loadClassrooms(dateKey);
      return transform.normalizeClassrooms(response, dateKey);
    }, force);
  }

  function fallbackTimeSlots(dateKey) {
    return window.ScheduleTimeStore?.getSlots ? window.ScheduleTimeStore.getSlots(dateKey) : [];
  }

  async function getTimeTemplate({ dateKey, force = false } = {}) {
    const key = cacheKey({ type: "time-template", dateKey, mode: request.apiMode?.() });
    return withCache(key, ttl.timeTemplate, async () => {
      try {
        const response = await request.loadTimeTemplate({ date: dateKey });
        const slots = transform.normalizeTimeSlots(response);
        return slots.length ? slots : fallbackTimeSlots(dateKey);
      } catch (error) {
        if (error?.status === 404) return fallbackTimeSlots(dateKey);
        throw error;
      }
    }, force);
  }

  function clearCache() {
    cache.clear();
  }

  function clearDateCache(dateKey) {
    Array.from(cache.keys()).forEach((key) => {
      if (key.includes(dateKey) || key.includes('"type":"dates"')) {
        cache.delete(key);
      }
    });
  }

  function startScheduleDatesWatcher({ days = 120, intervalMs = 120000, onAdded, onError } = {}) {
    let previous = new Set();
    let stopped = false;
    let timer = 0;

    async function tick(force = false) {
      try {
        const dates = await getScheduleDates({ days, force });
        const next = new Set(dates);
        if (previous.size) {
          dates.filter((date) => !previous.has(date)).forEach((date) => {
            if (typeof onAdded === "function") onAdded(date);
          });
        }
        previous = next;
      } catch (error) {
        if (typeof onError === "function") onError(error);
      }

      if (!stopped) {
        timer = window.setTimeout(() => tick(true), intervalMs);
      }
    }

    tick();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }

  return {
    clearCache,
    clearDateCache,
    getCatalogs,
    getClassrooms,
    getScheduleDates,
    getTimeTemplate,
    getWeekDay,
    startScheduleDatesWatcher
  };
})();