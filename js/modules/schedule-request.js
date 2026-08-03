window.ScheduleRequest = (() => {
  async function loadDaySchedule(params = {}) {
    if (!window.SchedulePublicApi) return null;
    return window.SchedulePublicApi.getSchedule(params);
  }

  async function loadWeekSchedule({ type, id, weekStart } = {}) {
    if (!window.SchedulePublicApi) return null;
    if (!type || !id || !weekStart) return null;
    return window.SchedulePublicApi.getWeekSchedule(type, id, weekStart);
  }

  return {
    loadDaySchedule,
    loadWeekSchedule
  };
})();
