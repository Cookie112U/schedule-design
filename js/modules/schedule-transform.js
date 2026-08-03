window.ScheduleTransform = (() => {
  function toUiLessons(apiLessons = []) {
    if (!Array.isArray(apiLessons)) return [];
    return apiLessons.map((lesson) => ({
      lesson: lesson.lesson ?? lesson.number ?? "",
      pair: lesson.pair ?? "",
      time: lesson.time ?? "",
      teacher: lesson.teacher ?? "",
      group: lesson.group ?? "",
      discipline: lesson.discipline ?? lesson.subject ?? "",
      building: lesson.building ?? "",
      room: lesson.room ?? lesson.classroom ?? ""
    }));
  }

  return {
    toUiLessons
  };
})();
