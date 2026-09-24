window.ScheduleTimeStore = (() => {
  const dayOrder = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayAliases = {
    понедельник: "monday",
    вторник: "tuesday",
    среда: "wednesday",
    четверг: "thursday",
    пятница: "friday",
    суббота: "saturday"
  };

  const baseSchedule = {
    monday: [
      { name: "0 урок", time: "8:30-9:00" },
      { name: "1 пара", lessons: "1-2 урок", time: "9:10-10:30" },
      { name: "3 урок", time: "10:40-11:20" },
      { name: "4 урок", time: "11:20-12:00" },
      { name: "5 урок", time: "12:00-12:40" },
      { name: "3 пара", lessons: "6-7 урок", time: "12:50-14:10" },
      { name: "4 пара", lessons: "8-9 урок", time: "14:20-15:40" },
      { name: "обед", time: "15:40-16:00", type: "lunch" },
      { name: "5 пара", lessons: "11-12 урок", time: "16:00-17:20" },
      { name: "6 пара", lessons: "13-14 урок", time: "17:30-18:50" }
    ],
    tuesday: [
      { name: "0 урок", time: "8:30-9:00" },
      { name: "1 пара", lessons: "1-2 урок", time: "9:10-10:30" },
      { name: "3 урок", time: "10:40-11:20" },
      { name: "4 урок", time: "11:20-12:00" },
      { name: "5 урок", time: "12:00-12:40" },
      { name: "3 пара", lessons: "6-7 урок", time: "12:50-14:10" },
      { name: "4 пара", lessons: "8-9 урок", time: "14:20-15:40" },
      { name: "обед", time: "15:40-16:00", type: "lunch" },
      { name: "5 пара", lessons: "11-12 урок", time: "16:00-17:20" },
      { name: "6 пара", lessons: "13-14 урок", time: "17:30-18:50" }
    ],
    wednesday: [
      { name: "1 пара", lessons: "1-2 урок", time: "8:30-9:50" },
      { name: "3 урок", time: "10:00-10:40" },
      { name: "4 урок", time: "10:40-11:20" },
      { name: "5 урок", time: "11:20-12:00" },
      { name: "3 пара", lessons: "6-7 урок", time: "12:10-13:30" },
      { name: "классный час", time: "13:40-14:10", type: "class-hour" },
      { name: "4 пара", lessons: "8-9 урок", time: "14:20-15:40" }
    ],
    thursday: [
      { name: "1 пара", lessons: "1-2 урок", time: "8:30-9:50" },
      { name: "3 урок", time: "10:00-10:40" },
      { name: "4 урок", time: "10:40-11:20" },
      { name: "5 урок", time: "11:20-12:00" },
      { name: "3 пара", lessons: "6-7 урок", time: "12:10-13:30" },
      { name: "4 пара", lessons: "8-9 урок", time: "13:40-15:00" },
      { name: "10 урок", time: "15:00-15:20" },
      { name: "5 пара", lessons: "11-12 урок", time: "15:20-16:40" },
      { name: "6 пара", lessons: "13-14 урок", time: "16:45-18:05" }
    ],
    friday: [
      { name: "1 пара", lessons: "1-2 урок", time: "8:30-9:50" },
      { name: "3 урок", time: "10:00-10:40" },
      { name: "4 урок", time: "10:40-11:20" },
      { name: "5 урок", time: "11:20-12:00" },
      { name: "3 пара", lessons: "6-7 урок", time: "12:10-13:30" },
      { name: "4 пара", lessons: "8-9 урок", time: "13:40-15:00" },
      { name: "10 урок", time: "15:00-15:20" },
      { name: "5 пара", lessons: "11-12 урок", time: "15:20-16:40" },
      { name: "6 пара", lessons: "13-14 урок", time: "16:45-18:05" }
    ],
    saturday: [
      { name: "1 пара", lessons: "1-2 урок", time: "8:30-10:55" },
      { name: "2 пара", lessons: "3-4 урок", time: "8:30-10:55" },
      { name: "3 пара", lessons: "6-7 урок", time: "11:00-13:25" },
      { name: "4 пара", lessons: "8-9 урок", time: "11:00-13:25" }
    ],
    sunday: []
  };

  const overrideSchedule = {};
  const dateOverrideSchedule = {};
  const variantCache = new Map();

  function text(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
  }

  function normalizeComparable(value) {
    return text(value).toLowerCase().replace(/ё/g, "е");
  }

  function normalizeTime(value) {
    return text(value).replace(/:00$/, "");
  }

  function joinTime(start, end, fallback = "") {
    const startTime = normalizeTime(start);
    const endTime = normalizeTime(end);
    if (startTime && endTime) return `${startTime}-${endTime}`;
    return text(fallback);
  }

  function lessonParts(value) {
    return text(value).match(/\d+/g) || [];
  }

  function lessonDisplayFromParts(parts, fallback = "") {
    if (!parts.length) return text(fallback);
    return parts.length > 1 ? `${parts[0]}-${parts[parts.length - 1]}` : parts[0];
  }

  function shiftLessonParts(parts, delta) {
    if (!delta) return parts;
    return parts.map((part) => {
      const number = Number(part);
      return Number.isFinite(number) ? String(Math.max(0, number - delta)) : part;
    });
  }

  function shiftSlotLessonNumbers(slot, delta) {
    if (!slot.lessons.length) return slot;
    const lessons = shiftLessonParts(slot.lessons, delta);
    return {
      ...slot,
      lessons,
      displayLesson: lessonDisplayFromParts(lessons, slot.displayLesson)
    };
  }

  function parseMinutes(value) {
    const match = text(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function formatMinutes(value) {
    const minutes = ((value % 1440) + 1440) % 1440;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${String(mins).padStart(2, "0")}`;
  }

  function shiftTimeRange(range, delta) {
    const [start, end] = text(range).split("-").map((item) => item.trim());
    const startMinutes = parseMinutes(start);
    const endMinutes = parseMinutes(end);
    if (startMinutes === null || endMinutes === null) return range;
    return `${formatMinutes(startMinutes - delta)}-${formatMinutes(endMinutes - delta)}`;
  }

  function duration(range) {
    const [start, end] = text(range).split("-").map((item) => item.trim());
    const startMinutes = parseMinutes(start);
    const endMinutes = parseMinutes(end);
    if (startMinutes === null || endMinutes === null) return 0;
    return Math.max(0, endMinutes - startMinutes);
  }

  function isLunchSlot(slot) {
    return normalizeComparable(slot?.type) === "lunch" || normalizeComparable(slot?.name || slot?.label).includes("обед");
  }

  function isLunchLesson(lesson) {
    return normalizeComparable(lesson?.discipline || lesson?.name || lesson?.title).includes("обед");
  }

  function isClassHour(value) {
    const normalized = normalizeComparable(value).replace(/[^а-яa-z]/g, "");
    return normalized === "клчас" || normalized.includes("классныйчас");
  }

  function dayKeyFromDate(value) {
    const raw = text(value);
    if (dayAliases[normalizeComparable(raw)]) return dayAliases[normalizeComparable(raw)];

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "monday";
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return "monday";
    return dayOrder[date.getDay()] || "monday";
  }

  function rawTemplate(dayKey, dateKey = "") {
    if (dateKey && dateOverrideSchedule[dateKey]) return dateOverrideSchedule[dateKey];
    return overrideSchedule[dayKey] || baseSchedule[dayKey] || [];
  }

  function slotKey(slot, index = 0) {
    return text(slot.value || slot.number || slot.lesson || slot.lessons || slot.name || slot.pair || slot.label || slot.time || index + 1);
  }

  function normalizeSlot(slot = {}, index = 0) {
    const label = text(slot.label || slot.name || slot.pair || slot.pairNumber || slot.pair_number);
    const lessonSource = slot.lessons || slot.lesson || slot.number || label || slot.value;
    const lessons = lessonParts(lessonSource);
    const number = text(slot.number || slot.lesson || (lessons.length === 1 ? lessons[0] : "") || index + 1);
    const time = joinTime(slot.start || slot.start_time || slot.time_start, slot.end || slot.end_time || slot.time_end, slot.time);
    const displayLesson = text(slot.displayLesson || slot.display_lesson || lessonDisplayFromParts(lessons, number));
    const type = text(slot.type || (normalizeComparable(label).includes("обед") ? "lunch" : ""));

    return {
      value: slotKey(slot, index),
      number,
      label: label || number,
      pair: text(slot.pair || label),
      lessons,
      displayLesson,
      time,
      type
    };
  }

  function buildVariant(dayKey, variant, dateKey = "") {
    const normalized = rawTemplate(dayKey, dateKey).map(normalizeSlot).filter((slot) => slot.value || slot.time);
    if (variant !== "without-lunch") return normalized;

    const lunchIndex = normalized.findIndex(isLunchSlot);
    if (lunchIndex < 0) return normalized;

    const lunchDuration = duration(normalized[lunchIndex].time);
    return normalized
      .filter((slot, index) => index !== lunchIndex)
      .map((slot, index) => {
        const afterLunch = index >= lunchIndex;
        const shiftedSlot = afterLunch ? shiftSlotLessonNumbers(slot, 1) : slot;
        return {
          ...shiftedSlot,
          time: lunchDuration && afterLunch ? shiftTimeRange(slot.time, Math.max(0, lunchDuration - 10)) : slot.time
        };
      });
  }

  function lessonRangeKey(lesson) {
    const parts = lessonParts(lesson?.lesson || lesson?.slotKey || lesson?.pair);
    return lessonDisplayFromParts(parts);
  }

  function templateVariant(dayKey, lessons = [], dateKey = "") {
    const hasLunchSlot = rawTemplate(dayKey, dateKey).some(isLunchSlot);
    if (!hasLunchSlot) return "base";
    if (lessons.some(isLunchLesson)) return "base";

    const rangeKeys = lessons.map(lessonRangeKey).filter(Boolean);
    if (rangeKeys.some((key) => ["11-12", "13-14"].includes(key))) return "base";
    if (rangeKeys.some((key) => ["10-11", "12-13"].includes(key))) return "without-lunch";

    return "without-lunch";
  }

  function getSlots(dateKey, lessons = []) {
    const dayKey = dayKeyFromDate(dateKey);
    const normalizedDate = text(dateKey);
    const variant = templateVariant(dayKey, Array.isArray(lessons) ? lessons : [], normalizedDate);
    const cacheKey = `${normalizedDate || dayKey}:${variant}`;

    if (!variantCache.has(cacheKey)) {
      variantCache.set(cacheKey, buildVariant(dayKey, variant, normalizedDate));
    }

    return variantCache.get(cacheKey).map((slot) => ({ ...slot, lessons: [...slot.lessons] }));
  }

  function setSlots(slots = [], day = "monday") {
    const dayKey = dayAliases[normalizeComparable(day)] || dayKeyFromDate(day) || "monday";
    overrideSchedule[dayKey] = Array.isArray(slots) ? slots : [];
    variantCache.clear();
  }

  function setDateSlots(dateKey, slots = []) {
    const normalizedDate = text(dateKey).slice(0, 10);
    if (!normalizedDate) return;
    dateOverrideSchedule[normalizedDate] = Array.isArray(slots) ? slots : [];
    variantCache.clear();
  }

  function clearDateSlots(dateKey) {
    const normalizedDate = text(dateKey).slice(0, 10);
    if (normalizedDate) delete dateOverrideSchedule[normalizedDate];
    variantCache.clear();
  }

  function findSlotForLesson(lesson = {}, slots = getSlots()) {
    if (!slots.length) return null;

    if (isLunchLesson(lesson)) {
      return slots.find(isLunchSlot) || null;
    }

    if (isClassHour(lesson?.discipline || lesson?.name || lesson?.lesson)) {
      return slots.find((slot) => normalizeComparable(slot?.type) === "class-hour" || isClassHour(slot?.label)) || null;
    }

    const lessonNumbers = lessonParts(lesson.lesson || lesson.slotKey || lesson.pair);
    const keys = [lesson.slotKey, lesson.lesson, lesson.pair, lesson.discipline]
      .map(normalizeComparable)
      .filter(Boolean);

    const exactSlot = slots.find((slot) => {
      const slotKeys = [slot.value, slot.number, slot.label, slot.pair, slot.displayLesson]
        .map(normalizeComparable)
        .filter(Boolean);
      if (slotKeys.some((key) => keys.includes(key))) return true;

      if (lessonNumbers.length > 1) {
        return slot.lessons.length > 1 &&
          slot.lessons[0] === lessonNumbers[0] &&
          slot.lessons[slot.lessons.length - 1] === lessonNumbers[lessonNumbers.length - 1];
      }

      return slot.lessons.some((number) => lessonNumbers.includes(number));
    }) || null;
    if (exactSlot || lessonNumbers.length < 2) return exactSlot;

    const firstNumber = lessonNumbers[0];
    const lastNumber = lessonNumbers[lessonNumbers.length - 1];
    const firstSlot = slots.find((slot) => slot.lessons.includes(firstNumber));
    const lastSlot = slots.find((slot) => slot.lessons.includes(lastNumber));
    if (!firstSlot?.time || !lastSlot?.time) return null;

    const start = text(firstSlot.time).split("-")[0];
    const end = text(lastSlot.time).split("-")[1];
    if (!start || !end) return null;
    return {
      value: lessonDisplayFromParts(lessonNumbers),
      label: lessonDisplayFromParts(lessonNumbers),
      displayLesson: lessonDisplayFromParts(lessonNumbers),
      lessons: lessonNumbers,
      time: `${start}-${end}`
    };
  }

  function displayLesson(lesson, slot) {
    const current = text(lesson.lesson);
    if (!slot) return current;
    return current || slot.displayLesson || slot.number || slot.label;
  }

  function inferredSlot(lesson, resolved, dayKey) {
    if (dayKey === "saturday" || dayKey === "sunday") return null;
    const parts = lessonParts(lesson?.lesson || lesson?.slotKey || lesson?.pair).map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;

    const first = parts[0];
    const last = parts[parts.length - 1];
    let anchor = null;
    resolved.forEach((item) => {
      const itemParts = lessonParts(item.lesson?.lesson || item.lesson?.slotKey || item.lesson?.pair).map(Number);
      const end = itemParts[itemParts.length - 1];
      const endTime = parseMinutes(text(item.slot?.time || item.lesson?.time).split("-")[1]);
      if (Number.isFinite(end) && end < first && endTime !== null && (!anchor || end > anchor.end)) {
        anchor = { end, endTime };
      }
    });
    if (!anchor) return null;

    const skippedLessons = Math.max(0, first - anchor.end - 1);
    const start = anchor.endTime + 10 + skippedLessons * 40;
    const lessonCount = Math.max(1, last - first + 1);
    return {
      value: lessonDisplayFromParts(parts.map(String)),
      label: lessonDisplayFromParts(parts.map(String)),
      displayLesson: lessonDisplayFromParts(parts.map(String)),
      time: `${formatMinutes(start)}-${formatMinutes(start + lessonCount * 40)}`
    };
  }

  function applyTimes(lessons = [], dateKey) {
    const slots = getSlots(dateKey, lessons);
    const dayKey = dayKeyFromDate(dateKey);
    const resolved = [];

    return lessons.map((lesson) => {
      const directSlot = findSlotForLesson(lesson, slots);
      const slot = directSlot || inferredSlot(lesson, resolved, dayKey);
      resolved.push({ lesson, slot });
      if (!slot?.time || lesson.time) return lesson;

      return {
        ...lesson,
        lesson: isClassHour(lesson?.discipline) ? "Кл. час" : displayLesson(lesson, slot),
        time: slot.time,
        pair: lesson.pair || slot.label,
        slotKey: lesson.slotKey || slot.value
      };
    });
  }

  return {
    applyTimes,
    findSlotForLesson,
    getSlots,
    normalizeSlot,
    setDateSlots,
    clearDateSlots,
    setSlots
  };
})();
