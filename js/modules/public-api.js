window.SchedulePublicApi = (() => {
  const api = window.ScheduleApiClient;
  const PUBLIC_PREFIX = window.ScheduleConfig?.publicApiPrefix || "/api/v1/public";

  function byName(path, name) {
    return `${path}/${encodeURIComponent(name)}`;
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

  return {
    getDictionaries,
    getGroup,
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
