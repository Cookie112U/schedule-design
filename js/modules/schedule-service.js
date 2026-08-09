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

  async function getCatalogs({ force = false, dateDays = 120 } = {}) {
    const key = cacheKey({ type: "catalogs", dateDays });
    return withCache(key, ttl.catalog, async () => {
      const criticalResults = [];
      const groupsResult = await settle("groups", request.loadGroups(), transform.normalizeGroups);
      criticalResults.push(groupsResult);

      if (!groupsResult.error) {
        criticalResults.push(await settle("teachers", request.loadTeachers(), transform.normalizeTeachers));
      }

      const hasCriticalError = criticalResults.some((item) => item.error);
      const optionalResults = hasCriticalError
        ? []
        : await Promise.all([
          settle("classrooms", request.loadClassrooms(), transform.normalizeClassrooms, true),
          settle("buildings", request.loadBuildings(), transform.normalizeBuildings, true),
          settle("dictionaries", request.loadDictionaries(), (value) => value, true),
          settle("dates", request.loadScheduleDates(dateDays), transform.normalizeScheduleDates, true)
        ]);

      const results = [...criticalResults, ...optionalResults];

      return results.reduce((data, item) => {
        data[item.name] = item.value;
        if (item.error) {
          if (item.optional) data.optionalErrors.push(item.error);
          else data.errors.push(item.error);
        }
        return data;
      }, {
        groups: {},
        teachers: [],
        classrooms: [],
        buildings: [],
        dictionaries: null,
        dates: [],
        errors: [],
        optionalErrors: []
      });
    }, force);
  }

  async function getScheduleDates({ days = 120, force = false } = {}) {
    const key = cacheKey({ type: "dates", days });
    return withCache(key, ttl.dates, async () => {
      const response = await request.loadScheduleDates(days);
      return transform.normalizeScheduleDates(response);
    }, force);
  }

  async function getWeekDay({ type, query, weekStart, dateKey, force = false }) {
    const key = cacheKey({ type: "week", view: type, query, weekStart });
    const response = await withCache(key, ttl.schedule, () => request.loadWeekSchedule({ type, query, weekStart }), force);
    return transform.toUiLessonsForDate(response, dateKey);
  }

  async function getClassrooms({ dateKey, force = false } = {}) {
    const key = cacheKey({ type: "classrooms", dateKey });
    return withCache(key, ttl.classrooms, async () => {
      const response = await request.loadClassrooms(dateKey);
      return transform.normalizeClassrooms(response);
    }, force);
  }

  async function getTimeTemplate({ dateKey, force = false } = {}) {
    const key = cacheKey({ type: "time-template", dateKey });
    return withCache(key, ttl.timeTemplate, async () => {
      const response = await request.loadTimeTemplate({ date: dateKey });
      return transform.normalizeTimeSlots(response);
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
