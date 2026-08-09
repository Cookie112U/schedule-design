window.ScheduleTransform = (() => {
  function text(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
  }

  function compact(list) {
    return list.map(text).filter(Boolean);
  }

  function normalizeTime(value) {
    const result = text(value);
    return result.replace(/:00$/, "");
  }

  function joinTime(start, end, fallback = "") {
    const parts = compact([normalizeTime(start), normalizeTime(end)]);
    return parts.length === 2 ? parts.join("-") : text(fallback);
  }

  function buildingNumber(value) {
    const result = text(value);
    const match = result.match(/\d+/);
    return match ? match[0] : result;
  }

  function buildingName(value) {
    const result = text(value);
    if (!result) return "";
    if (/корпус/i.test(result)) return result;
    return /\d/.test(result) ? `${buildingNumber(result)} корпус` : result;
  }

  function teacherName(teacher) {
    if (typeof teacher === "string") return teacher;
    return teacher?.full_name || teacher?.full_name_long || teacher?.name || teacher?.short_name || "";
  }

  function groupCode(group) {
    if (typeof group === "string") return group;
    return group?.code || group?.name || group?.group_code || "";
  }

  function classroomName(room) {
    if (typeof room === "string") return room;
    if (room?.classroom && typeof room.classroom === "object") return classroomName(room.classroom);
    if (room?.room && typeof room.room === "object") return classroomName(room.room);
    return room?.number || room?.name || room?.classroom || room?.classroom_name || room?.room || "";
  }

  function classroomBuilding(room) {
    if (!room || typeof room === "string") return "";
    return room?.building?.number || room?.building?.name || room?.building || room?.building_name || "";
  }

  function normalizeGroups(payload) {
    if (payload?.groups) return normalizeGroups(payload.groups);
    if (payload?.items) return normalizeGroups(payload.items);
    if (payload?.results) return normalizeGroups(payload.results);

    if (Array.isArray(payload)) {
      return payload.reduce((result, group) => {
        const code = groupCode(group);
        if (!code) return result;
        const building = buildingName(group?.building?.name || group?.building_name || group?.building || group?.corpus || "Группы");
        if (!result[building]) result[building] = [];
        result[building].push(code);
        return result;
      }, {});
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
    return Object.fromEntries(
      Object.entries(payload).map(([building, list]) => [
        buildingName(building),
        Array.isArray(list) ? compact(list.map(groupCode)).sort(sortRu) : []
      ])
    );
  }

  function normalizeTeachers(payload) {
    if (payload?.teachers) return normalizeTeachers(payload.teachers);
    if (payload?.items) return normalizeTeachers(payload.items);
    if (payload?.results) return normalizeTeachers(payload.results);
    if (!Array.isArray(payload)) return [];
    return compact(payload.map(teacherName)).sort(sortRu);
  }

  function normalizeBuildings(payload) {
    if (payload?.buildings) return normalizeBuildings(payload.buildings);
    if (payload?.items) return normalizeBuildings(payload.items);
    if (payload?.results) return normalizeBuildings(payload.results);
    if (!Array.isArray(payload)) return [];
    return payload.map((building) => {
      const name = text(building?.name || building?.title || building?.code || building);
      const number = buildingNumber(building?.number || building?.code || name);
      return {
        code: text(building?.code || number || name),
        name,
        number
      };
    }).filter((building) => building.name || building.number);
  }

  function normalizeScheduleDates(payload) {
    if (payload?.dates) return normalizeScheduleDates(payload.dates);
    if (payload?.schedule_dates) return normalizeScheduleDates(payload.schedule_dates);
    if (payload?.items) return normalizeScheduleDates(payload.items);
    if (payload?.results) return normalizeScheduleDates(payload.results);
    if (!Array.isArray(payload)) return [];
    return compact(payload);
  }

  function normalizeTimeSlots(payload) {
    const slots = Array.isArray(payload?.slots) ? payload.slots : Array.isArray(payload) ? payload : [];
    return slots.map((slot) => {
      const number = text(slot?.number || slot?.slot_number || slot?.id);
      const label = text(slot?.label || slot?.name || (number ? `${number} пара` : ""));
      const time = joinTime(slot?.start_time || slot?.time_start, slot?.end_time || slot?.time_end, slot?.time);
      return {
        value: number || label || time,
        number,
        label,
        time,
        type: text(slot?.type)
      };
    }).filter((slot) => slot.value);
  }

  function getLessonsContainer(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.lessons)) return payload.lessons;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.schedule)) return payload.schedule;
    if (payload.discipline || payload.subject || payload.event_name || payload.time_start || payload.start_time || payload.slot) return [payload];
    return [];
  }

  function readLessonDate(lesson) {
    return text(lesson?.date || lesson?.day || lesson?.schedule_date || lesson?.lesson_date).slice(0, 10);
  }

  function dayPayloadFromWeek(payload, dateKey) {
    if (!payload) return null;
    if (payload[dateKey]) return payload[dateKey];
    if (payload.days?.[dateKey]) return payload.days[dateKey];
    if (payload.schedule?.[dateKey]) return payload.schedule[dateKey];

    const containers = [payload.days, payload.schedule, payload.dates, payload.items].filter(Array.isArray);
    for (const container of containers) {
      const found = container.find((item) => readLessonDate(item) === dateKey);
      if (found) return found;
    }

    if (Array.isArray(payload)) {
      const day = payload.find((item) => readLessonDate(item) === dateKey && (item.lessons || item.items || item.schedule));
      if (day) return day;
      return payload.filter((lesson) => readLessonDate(lesson) === dateKey);
    }

    if (Array.isArray(payload.lessons)) {
      const withDate = payload.lessons.filter((lesson) => readLessonDate(lesson) === dateKey);
      return withDate.length ? withDate : payload;
    }

    return payload;
  }

  function lessonNumber(lesson) {
    return text(
      lesson?.lesson ||
      lesson?.lesson_number ||
      lesson?.number_label ||
      lesson?.slot_label ||
      lesson?.slot?.lessons ||
      lesson?.slot?.number ||
      lesson?.number
    );
  }

  function lessonPair(lesson) {
    return text(lesson?.pair || lesson?.pair_label || lesson?.slot?.label || lesson?.label);
  }

  function lessonDiscipline(lesson) {
    return text(
      lesson?.event_name ||
      lesson?.discipline?.short_name ||
      lesson?.discipline?.name ||
      lesson?.subject?.short_name ||
      lesson?.subject?.name ||
      lesson?.discipline ||
      lesson?.subject ||
      lesson?.name ||
      lesson?.title ||
      "Занятие"
    );
  }

  function lessonTeachers(lesson) {
    if (Array.isArray(lesson?.teachers)) return compact(lesson.teachers.map(teacherName));
    return compact([lesson?.teacher, lesson?.teacher_name, lesson?.teacher_full_name].map(teacherName));
  }

  function lessonGroups(lesson) {
    if (Array.isArray(lesson?.groups)) return compact(lesson.groups.map(groupCode));
    if (Array.isArray(lesson?.subgroups)) return compact(lesson.subgroups.map(groupCode));
    return compact([lesson?.group, lesson?.group_code, lesson?.subgroup].map(groupCode));
  }

  function lessonClassrooms(lesson) {
    const rooms = Array.isArray(lesson?.classrooms)
      ? lesson.classrooms
      : [lesson?.classroom, lesson?.room, lesson?.classroom_name].filter(Boolean);

    return rooms.map((room) => ({
      building: buildingName(classroomBuilding(room)),
      room: classroomName(room)
    })).filter((room) => room.building || room.room);
  }

  function toUiLesson(lesson = {}) {
    const classrooms = lessonClassrooms(lesson);
    const firstRoom = classrooms[0] || {};
    return {
      lesson: lessonNumber(lesson),
      pair: lessonPair(lesson),
      slotKey: text(lesson?.slot?.number || lesson?.slot_number || lesson?.pair_number || lesson?.number),
      time: joinTime(
        lesson?.time_start || lesson?.start_time || lesson?.slot?.start_time || lesson?.start,
        lesson?.time_end || lesson?.end_time || lesson?.slot?.end_time || lesson?.end,
        lesson?.time
      ),
      teacher: lessonTeachers(lesson).join(", "),
      group: lessonGroups(lesson).join(", "),
      discipline: lessonDiscipline(lesson),
      building: firstRoom.building,
      room: firstRoom.room,
      place: classrooms.map((room) => compact([room.building, room.room]).join(" ")).join(", ")
    };
  }

  function toUiLessons(payload = []) {
    return getLessonsContainer(payload).map(toUiLesson);
  }

  function toUiLessonsForDate(payload, dateKey) {
    return toUiLessons(dayPayloadFromWeek(payload, dateKey));
  }

  function normalizeClassroomRecord(record, building) {
    const room = classroomName(record);
    const rawLessons = record?.lessons || record?.schedule || record?.items || record?.occupied_lessons || record?.occupied_by || [];
    const lessons = Array.isArray(rawLessons) ? toUiLessons(rawLessons) : toUiLessons([rawLessons]);
    return {
      room,
      building: buildingName(building || classroomBuilding(record)),
      busy: Boolean(record?.busy || record?.is_busy || record?.occupied || record?.is_occupied || lessons.length),
      lessons
    };
  }

  function normalizeClassrooms(payload) {
    if (!payload) return [];

    if (Array.isArray(payload)) {
      return payload.map((record) => normalizeClassroomRecord(record)).filter((room) => room.room);
    }

    if (Array.isArray(payload.classrooms)) {
      return payload.classrooms.map((record) => normalizeClassroomRecord(record)).filter((room) => room.room);
    }

    if (Array.isArray(payload.buildings)) {
      return payload.buildings.flatMap((building) => {
        const rooms = building.classrooms || building.rooms || [];
        return rooms.map((record) => normalizeClassroomRecord(record, building.name || building.number || building.code));
      }).filter((room) => room.room);
    }

    if (typeof payload === "object") {
      return Object.entries(payload).flatMap(([building, list]) => {
        if (!Array.isArray(list)) return [];
        return list.map((record) => normalizeClassroomRecord(record, building));
      }).filter((room) => room.room);
    }

    return [];
  }

  function sortRu(a, b) {
    return a.localeCompare(b, "ru", { numeric: true, sensitivity: "base" });
  }

  return {
    buildingName,
    buildingNumber,
    normalizeBuildings,
    normalizeClassrooms,
    normalizeGroups,
    normalizeScheduleDates,
    normalizeTeachers,
    normalizeTimeSlots,
    toUiLessons,
    toUiLessonsForDate
  };
})();
