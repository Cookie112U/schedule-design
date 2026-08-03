window.ScheduleService = (() => {
  const cache = new Map();

  function cacheKey(params) {
    return JSON.stringify(params);
  }

  async function getDay(params = {}) {
    const key = cacheKey({ type: "day", ...params });
    if (cache.has(key)) return cache.get(key);

    const response = await window.ScheduleRequest.loadDaySchedule(params);
    const lessons = window.ScheduleTransform.toUiLessons(response?.lessons ?? response);
    cache.set(key, lessons);
    return lessons;
  }

  function clearCache() {
    cache.clear();
  }

  return {
    getDay,
    clearCache
  };
})();
