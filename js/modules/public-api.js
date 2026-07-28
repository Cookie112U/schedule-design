window.SchedulePublicApi = (() => {
const api = window.ScheduleApiClient;
const PUBLIC_PREFIX = "/api/v1/public";

function listGroups() {
  return api.request(`${PUBLIC_PREFIX}/groups`);
}

function getGroup(groupCode) {
  return api.request(`${PUBLIC_PREFIX}/groups/${encodeURIComponent(groupCode)}`);
}

function getGroupHours(groupCode) {
  return api.request(`${PUBLIC_PREFIX}/groups/${encodeURIComponent(groupCode)}/hours`);
}

function listTeachers() {
  return api.request(`${PUBLIC_PREFIX}/teachers`);
}

function getTeacher(teacherName) {
  return api.request(`${PUBLIC_PREFIX}/teachers/${encodeURIComponent(teacherName)}`);
}

function getTeacherHours(teacherName) {
  return api.request(`${PUBLIC_PREFIX}/teachers/${encodeURIComponent(teacherName)}/hours`);
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

function getInfoDictionaries() {
  return api.request(`${PUBLIC_PREFIX}/info/dictionaries`);
}

function getTimeTemplate({ date, day, parity } = {}) {
  return api.request(`${PUBLIC_PREFIX}/time-template`, { date, day, parity });
}

function getSchedule({ view, id, date }) {
  return api.request(`${PUBLIC_PREFIX}/schedule`, { view, id, date });
}

function getWeekSchedule(type, id, weekStart) {
  const allowed = ["group", "teacher", "classroom"];
  if (!allowed.includes(type)) {
    throw new Error(`Unsupported week schedule type: ${type}`);
  }
  return api.request(`${PUBLIC_PREFIX}/schedule/${type}/${encodeURIComponent(id)}/week`, {
    week_start: weekStart
  });
}

function getScheduleDates(days = 10) {
  return api.request(`${PUBLIC_PREFIX}/schedule/dates`, { days });
}

function normalizePublicLessons(schedule) {
  return (schedule?.lessons || []).map((lesson) => ({
    lesson: lesson.number,
    time: [lesson.time_start, lesson.time_end].filter(Boolean).join("-"),
    discipline: lesson.event_name || lesson.discipline?.short_name || lesson.discipline?.name || "Занятие",
    teachers: (lesson.teachers || []).map((teacher) => teacher.full_name).filter(Boolean),
    classrooms: (lesson.classrooms || []).map((room) => [room.building?.number, room.number].filter(Boolean).join(" корпус ")).filter(Boolean),
    subgroups: lesson.subgroups || [],
    isRemote: Boolean(lesson.is_remote),
    notes: lesson.notes || null
  }));
}

return {
  getDictionaries,
  getGroup,
  getGroupHours,
  getInfoDictionaries,
  getSchedule,
  getScheduleDates,
  getTeacher,
  getTeacherHours,
  getTimeTemplate,
  getWeekSchedule,
  listBuildings,
  listClassrooms,
  listGroups,
  listTeachers,
  normalizePublicLessons
};
})();
