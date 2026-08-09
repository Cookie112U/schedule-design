window.ScheduleRequest = (() => {
  const api = window.SchedulePublicApi;

  function loadGroups() {
    return api.listGroups();
  }

  function loadTeachers() {
    return api.listTeachers();
  }

  function loadClassrooms(date) {
    return api.listClassrooms(date);
  }

  function loadBuildings() {
    return api.listBuildings();
  }

  function loadDictionaries() {
    return api.getDictionaries();
  }

  function loadScheduleDates(days = 30) {
    return api.getScheduleDates(days);
  }

  function loadTimeTemplate(params = {}) {
    return api.getTimeTemplate(params);
  }

  function loadDaySchedule(params = {}) {
    return api.getSchedule(params);
  }

  function loadWeekSchedule({ type, query, weekStart } = {}) {
    if (!type || !query || !weekStart) return Promise.resolve(null);
    return api.getWeekSchedule(type, query, weekStart);
  }

  return {
    loadBuildings,
    loadClassrooms,
    loadDaySchedule,
    loadDictionaries,
    loadGroups,
    loadScheduleDates,
    loadTeachers,
    loadTimeTemplate,
    loadWeekSchedule
  };
})();
