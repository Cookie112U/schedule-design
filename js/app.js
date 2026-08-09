const {
  accentColors,
  monthNames,
  months,
  weekdays,
  weekdaysFull
} = window.ScheduleData;
const { activeHoliday } = window.ScheduleHoliday;
const { readSavedState, writeSavedState } = window.ScheduleStorage;
const scheduleService = window.ScheduleService;
const scheduleTransform = window.ScheduleTransform;
const { start: startHolidayParticles } = window.ScheduleHolidayParticles;

const app = document.querySelector(".app");
const calendarGrid = document.querySelector("#calendarGrid");
const weekStrip = document.querySelector("#weekStrip");
const monthLabel = document.querySelector("#monthLabel");
const monthButton = document.querySelector("#monthButton");
const monthMenu = document.querySelector("#monthMenu");
const mobileMonthTitle = document.querySelector("#mobileMonthTitle");
const modeButtons = document.querySelectorAll(".mode-button");
const showScheduleButton = document.querySelector("#showSchedule");
const resultPanel = document.querySelector("#resultPanel");
const lessonList = document.querySelector("#lessonList");
const resultDay = document.querySelector("#resultDay");
const resultMonth = document.querySelector("#resultMonth");
const resultEntity = document.querySelector("#resultEntity");
const settingsButton = document.querySelector("#settingsButton");
const roomsButton = document.querySelector("#roomsButton");
const settingsModal = document.querySelector("#settingsModal");
const scheduleModal = document.querySelector("#scheduleModal");
const roomsModal = document.querySelector("#roomsModal");
const modalLessonList = document.querySelector("#modalLessonList");
const modalTitle = document.querySelector("#modalTitle");
const modalDateLine = document.querySelector("#modalDateLine");
const colorGrid = document.querySelector("#colorGrid");
const toastStack = document.querySelector("#toastStack");
const prevWeek = document.querySelector("#prevWeek");
const nextWeek = document.querySelector("#nextWeek");
const prevMonth = document.querySelector("#prevMonth");
const nextMonth = document.querySelector("#nextMonth");
const entitySelectRoot = document.querySelector("#entitySelectRoot");
const entityTrigger = document.querySelector("#entityTrigger");
const entityTriggerText = document.querySelector("#entityTriggerText");
const selectedFavorite = document.querySelector("#selectedFavorite");
const entityMenu = document.querySelector("#entityMenu");
const entitySearch = document.querySelector("#entitySearch");
const entityOptions = document.querySelector("#entityOptions");
const buildingToggle = document.querySelector("#buildingToggle");
const roomCards = document.querySelector("#roomCards");
const pairSelect = document.querySelector("#pairSelect");
const roomDetailModal = document.querySelector("#roomDetailModal");
const roomDetailTitle = document.querySelector("#roomDetailTitle");
const roomDetailContent = document.querySelector("#roomDetailContent");
const holidayAdminButton = document.querySelector("#holidayAdminButton");
const holidayAdminModal = document.querySelector("#holidayAdminModal");

const today = new Date();
today.setHours(0, 0, 0, 0);

const maxToasts = 5;
const toastCooldownMs = 1200;
const toastLastShown = new Map();
const apiState = {
  groupsByBuilding: {},
  groups: [],
  teachers: [],
  buildings: [],
  classrooms: [],
  currentRooms: [],
  currentLessons: [],
  timeSlots: [],
  scheduleDates: new Set(),
  dictionaries: null,
  catalogsLoaded: false
};

const defaults = {
  mode: "student",
  selectedEntity: "",
  selectedDate: toDateKey(today),
  visibleDate: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
  theme: "light",
  size: "medium",
  output: "bottom",
  accent: accentColors[0],
  building: "",
  pair: "",
  holidayMode: "auto",
  favorites: []
};

const saved = readSavedState();
const state = {
  ...defaults,
  ...saved,
  selectedDate: parseDate(saved.selectedDate || defaults.selectedDate),
  visibleDate: parseDate(saved.visibleDate || defaults.visibleDate),
  favorites: Array.isArray(saved.favorites) ? saved.favorites : []
};

let scheduleWatcherErrorShown = false;
let stopScheduleWatcher = null;

function saveState() {
  writeSavedState({
    mode: state.mode,
    selectedEntity: state.selectedEntity,
    selectedDate: toDateKey(state.selectedDate),
    visibleDate: toDateKey(state.visibleDate),
    theme: state.theme,
    size: state.size,
    output: state.output,
    accent: state.accent,
    building: state.building,
    pair: state.pair,
    holidayMode: state.holidayMode,
    favorites: state.favorites
  });
}

function parseDate(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date(today) : date;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function mondayOf(date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  return result;
}

function dayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function selectedDateKey() {
  return toDateKey(state.selectedDate);
}

function selectedWeekStartKey() {
  return toDateKey(mondayOf(state.selectedDate));
}

function scheduleType() {
  return state.mode === "student" ? "group" : "teacher";
}

function formatDateText(date) {
  return `${monthNames[date.getMonth()]}<br />${weekdaysFull[dayIndex(date)]}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setModalDateLine(date) {
  modalDateLine.innerHTML = `
    <span>${date.getDate()} ${monthNames[date.getMonth()]}</span>
    <span>${capitalize(weekdaysFull[dayIndex(date)])}</span>
  `;
}

function sortRu(a, b) {
  return a.localeCompare(b, "ru", { numeric: true, sensitivity: "base" });
}

function getEntities() {
  return [...(state.mode === "student" ? apiState.groups : apiState.teachers)].sort(sortRu);
}

function accentInkFor(color) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  if (["f4ff00", "ff9f1c"].includes(hex.toLowerCase())) return "#252525";
  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.72 ? "#252525" : "#ffffff";
}

function apiErrorText(error, fallback = "Не удалось загрузить данные") {
  if (error?.code === "NETWORK_ERROR") {
    return error.message;
  }

  if (error?.status === 429) {
    return error.retryAfter
      ? `Слишком много запросов. Попробуйте через ${error.retryAfter} сек.`
      : "Слишком много запросов. Попробуйте чуть позже.";
  }

  if (error?.status === 404) {
    return `${fallback}: эндпоинт не найден`;
  }

  return error?.message ? `${fallback}: ${error.message}` : fallback;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function renderInlineStatus(target, text) {
  target.innerHTML = "";
  target.append(createElement("div", "inline-state", text));
}

function favoriteKey(entity, mode = state.mode) {
  return `${mode}:${entity}`;
}

function isFavorite(entity, mode = state.mode) {
  return state.favorites.includes(favoriteKey(entity, mode));
}

function toggleFavorite(entity, mode = state.mode) {
  const key = favoriteKey(entity, mode);
  state.favorites = isFavorite(entity, mode)
    ? state.favorites.filter((item) => item !== key)
    : [key, ...state.favorites];
  saveState();
  updateTrigger();
  renderEntityOptions();
}

function openSelect() {
  entityMenu.hidden = false;
  entityTrigger.setAttribute("aria-expanded", "true");
  entitySearch.value = "";
  renderEntityOptions();
  entitySearch.focus();
}

function closeSelect() {
  entityMenu.hidden = true;
  entityTrigger.setAttribute("aria-expanded", "false");
}

function updateTrigger() {
  const placeholder = state.mode === "student" ? "Выберите группу" : "Выберите преподавателя";
  entityTriggerText.textContent = state.selectedEntity || placeholder;
  selectedFavorite.textContent = state.selectedEntity && isFavorite(state.selectedEntity) ? "★" : "☆";
}

function addOption(entity) {
  const star = createElement("button", `favorite-button${isFavorite(entity) ? " active" : ""}`, isFavorite(entity) ? "★" : "☆");
  star.type = "button";
  star.title = "Избранное";
  star.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(entity);
  });

  const button = createElement("button", "select-option");
  button.type = "button";
  button.classList.toggle("active", entity === state.selectedEntity);
  button.append(star, createElement("strong", "", entity));
  button.addEventListener("click", () => {
    state.selectedEntity = entity;
    hideResult();
    saveState();
    updateTrigger();
    closeSelect();
  });
  entityOptions.append(button);
}

function addGroupTitle(text) {
  entityOptions.append(createElement("div", "select-group-title", text));
}

function renderEntityOptions() {
  const query = entitySearch.value.trim().toLowerCase();
  entityOptions.innerHTML = "";

  if (!apiState.catalogsLoaded) {
    addGroupTitle("Загрузка списка...");
    return;
  }

  const entities = getEntities();
  const favorites = entities.filter((entity) => isFavorite(entity) && entity.toLowerCase().includes(query));

  if (favorites.length) {
    addGroupTitle("Избранное");
    favorites.forEach(addOption);
  }

  if (state.mode === "student") {
    Object.entries(apiState.groupsByBuilding).forEach(([building, list]) => {
      const filtered = [...list]
        .sort(sortRu)
        .filter((entity) => entity.toLowerCase().includes(query) && !favorites.includes(entity));
      if (!filtered.length) return;
      addGroupTitle(building);
      filtered.forEach(addOption);
    });
  } else {
    const filtered = apiState.teachers.filter((entity) => entity.toLowerCase().includes(query) && !favorites.includes(entity));
    if (filtered.length) {
      addGroupTitle("Преподаватели");
      filtered.forEach(addOption);
    }
  }

  if (!entityOptions.children.length) {
    addGroupTitle(entities.length
      ? "Ничего не найдено"
      : state.mode === "student" ? "Список групп не загружен" : "Список преподавателей не загружен");
  }
}

function hasScheduleDate(date) {
  return apiState.scheduleDates.has(toDateKey(date));
}

function selectDate(date) {
  state.selectedDate = date;
  state.visibleDate = new Date(date.getFullYear(), date.getMonth(), 1);
  resetTimeSlotsForDate();
  hideResult();
  saveState();
  renderCalendar();
  refreshRoomsIfOpen();
}

function resetTimeSlotsForDate() {
  apiState.timeSlots = [];
  state.pair = "";
  renderPairOptions();
}

function refreshRoomsIfOpen() {
  if (roomsModal.open) {
    renderRooms({ force: true });
  }
}

function renderCalendar() {
  const year = state.visibleDate.getFullYear();
  const month = state.visibleDate.getMonth();
  monthLabel.textContent = months[month];
  mobileMonthTitle.textContent = `${months[month]} ${year}`;
  renderMonthMenu();

  weekStrip.innerHTML = "";
  const weekStart = mondayOf(state.selectedDate);
  weekdays.forEach((day, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const button = createElement("button", [
      "week-date",
      sameDate(date, state.selectedDate) ? "active" : "",
      hasScheduleDate(date) ? "has-schedule" : ""
    ].filter(Boolean).join(" "), String(date.getDate()));
    button.type = "button";
    button.addEventListener("click", () => selectDate(date));

    const item = createElement("div", "week-day");
    item.append(createElement("span", "", day), button);
    weekStrip.append(item);
  });

  calendarGrid.innerHTML = "";
  const first = new Date(year, month, 1);
  const offset = dayIndex(first);
  const start = new Date(year, month, 1 - offset);

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const isCurrentMonth = date.getMonth() === month;
    const isStudy = isCurrentMonth && date.getDay() !== 0 && date.getDay() !== 6;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const button = createElement("button", [
      "day-cell",
      isStudy ? "study" : "",
      isWeekend ? "weekend" : "",
      isCurrentMonth ? "" : "other-month",
      sameDate(date, state.selectedDate) ? "active" : "",
      hasScheduleDate(date) ? "has-schedule" : ""
    ].filter(Boolean).join(" "));
    button.type = "button";
    button.append(createElement("strong", "", String(date.getDate())));
    if (sameDate(date, today)) {
      button.append(createElement("span", "", "Сегодня"));
    }
    button.addEventListener("click", () => selectDate(date));
    calendarGrid.append(button);
  }
}

function renderMonthMenu() {
  if (!monthMenu) return;
  const activeMonth = state.visibleDate.getMonth();
  monthMenu.innerHTML = "";
  months.forEach((monthName, index) => {
    const button = createElement("button", `month-option${index === activeMonth ? " active" : ""}`, monthName);
    button.type = "button";
    button.addEventListener("click", () => {
      const year = state.visibleDate.getFullYear();
      state.visibleDate = new Date(year, index, 1);
      state.selectedDate = new Date(year, index, Math.min(state.selectedDate.getDate(), daysInMonth(year, index)));
      resetTimeSlotsForDate();
      hideResult();
      saveState();
      monthMenu.hidden = true;
      renderCalendar();
      refreshRoomsIfOpen();
    });
    monthMenu.append(button);
  });
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function isLunchLesson(lesson) {
  return String(lesson.discipline || "").trim().toLowerCase().includes("обед");
}

function lessonSideValue(lesson) {
  if (isLunchLesson(lesson)) return "";
  return state.mode === "student" ? lesson.teacher : lesson.group;
}

function lessonPlaceValue(lesson) {
  if (isLunchLesson(lesson)) return "";
  return lesson.place || [lesson.building, lesson.room].filter(Boolean).join(" ");
}

function renderLessons(target, lessons) {
  target.innerHTML = "";
  target.className = "lesson-list";

  if (!lessons.length) {
    renderInlineStatus(target, "На выбранную дату расписание не найдено");
    return;
  }

  lessons.forEach((lesson) => {
    const card = createElement("article", "lesson-card");
    const row = createElement("div", "lesson-row");
    row.append(
      createElement("span", "lesson-number", lesson.lesson || "—"),
      createElement("span", "lesson-time", isLunchLesson(lesson) ? "" : lesson.time),
      createElement("span", "lesson-side", lessonSideValue(lesson))
    );
    card.append(row, createElement("p", "lesson-subject", lesson.discipline || "Занятие"));

    const place = lessonPlaceValue(lesson);
    if (place) {
      card.append(createElement("div", "lesson-room", place));
    }

    target.append(card);
  });
}

function renderModalLessons(target, lessons) {
  target.innerHTML = "";
  target.className = "modal-schedule-list";

  if (!lessons.length) {
    renderInlineStatus(target, "На выбранную дату расписание не найдено");
    return;
  }

  lessons.forEach((lesson) => {
    const card = createElement("article", "modal-lesson-card");
    const top = createElement("div", "modal-lesson-top");
    top.append(
      createElement("span", "modal-lesson-number", lesson.lesson || "—"),
      createElement("span", "modal-lesson-time", isLunchLesson(lesson) ? "" : lesson.time),
      createElement("span", "modal-lesson-side", lessonSideValue(lesson))
    );

    const bottom = createElement("div", "modal-lesson-bottom");
    bottom.append(createElement("div", "modal-lesson-subject", lesson.discipline || "Занятие"));
    bottom.append(createElement("div", "modal-lesson-place", lessonPlaceValue(lesson)));
    card.append(top, bottom);
    target.append(card);
  });
}

function setResultDate(dayTarget, monthTarget) {
  dayTarget.textContent = state.selectedDate.getDate();
  monthTarget.innerHTML = formatDateText(state.selectedDate);
}

function formatResultEntity() {
  if (!state.selectedEntity) return "";
  return state.mode === "student" ? state.selectedEntity.toUpperCase() : state.selectedEntity;
}

function showMessage(text) {
  const now = Date.now();
  const lastShown = toastLastShown.get(text) || 0;
  if (now - lastShown < toastCooldownMs) return;
  toastLastShown.set(text, now);

  const duplicate = Array.from(toastStack.querySelectorAll(".toast")).find((item) => item.dataset.message === text);
  if (duplicate) {
    const count = Number(duplicate.dataset.count || 1) + 1;
    duplicate.dataset.count = String(count);
    duplicate.textContent = `${text} x${count}`;
    duplicate.classList.remove("pulse");
    duplicate.offsetWidth;
    duplicate.classList.add("pulse");
    window.clearTimeout(duplicate.removeTimer);
    duplicate.removeTimer = window.setTimeout(() => duplicate.remove(), 3200);
    return;
  }

  const existing = toastStack.querySelectorAll(".toast");
  if (existing.length >= maxToasts) {
    existing[0].remove();
  }

  const toast = createElement("div", "toast", text);
  toast.dataset.message = text;
  toast.dataset.count = "1";
  toastStack.append(toast);
  toast.removeTimer = window.setTimeout(() => toast.remove(), 3200);
}

function hideResult() {
  resultPanel.classList.add("hidden");
}

async function loadLessonsForSelection() {
  return scheduleService.getWeekDay({
    type: scheduleType(),
    query: state.selectedEntity,
    weekStart: selectedWeekStartKey(),
    dateKey: selectedDateKey()
  });
}

async function showSchedule() {
  if (!state.selectedEntity) {
    showMessage(state.mode === "student" ? "Сначала выберите группу" : "Сначала выберите преподавателя");
    return;
  }

  const originalText = showScheduleButton.textContent;
  showScheduleButton.disabled = true;
  showScheduleButton.textContent = "Загрузка...";

  try {
    const lessons = await loadLessonsForSelection();
    apiState.currentLessons = lessons;

    if (state.output === "modal") {
      modalTitle.textContent = state.mode === "student"
        ? `Группа ${state.selectedEntity}`
        : `Преподаватель ${state.selectedEntity}`;
      setModalDateLine(state.selectedDate);
      renderModalLessons(modalLessonList, lessons);
      scheduleModal.showModal();
      return;
    }

    setResultDate(resultDay, resultMonth);
    resultEntity.textContent = formatResultEntity();
    renderLessons(lessonList, lessons);
    resultPanel.classList.remove("hidden");
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (error?.status === 404) {
      const lessons = [];
      apiState.currentLessons = lessons;

      if (state.output === "modal") {
        modalTitle.textContent = state.mode === "student"
          ? `Группа ${state.selectedEntity}`
          : `Преподаватель ${state.selectedEntity}`;
        setModalDateLine(state.selectedDate);
        renderModalLessons(modalLessonList, lessons);
        scheduleModal.showModal();
        return;
      }

      setResultDate(resultDay, resultMonth);
      resultEntity.textContent = formatResultEntity();
      renderLessons(lessonList, lessons);
      resultPanel.classList.remove("hidden");
      resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    showMessage(apiErrorText(error, "Не удалось загрузить расписание"));
  } finally {
    showScheduleButton.disabled = false;
    showScheduleButton.textContent = originalText;
  }
}

function renderColorButtons() {
  colorGrid.innerHTML = "";
  accentColors.forEach((color, index) => {
    const button = createElement("button", `color-dot${color === state.accent ? " active" : ""}`);
    button.type = "button";
    button.style.setProperty("--dot", color);
    button.setAttribute("aria-label", `Цвет ${index + 1}`);
    button.addEventListener("click", () => {
      state.accent = color;
      applySettings();
      saveState();
      colorGrid.querySelectorAll(".color-dot").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
    colorGrid.append(button);
  });
}

function deriveBuildingsFromRooms() {
  const map = new Map();
  apiState.classrooms.forEach((room) => {
    const name = room.building || "";
    const number = scheduleTransform.buildingNumber(name);
    if (number && !map.has(number)) {
      map.set(number, { name, number, code: number });
    }
  });
  return Array.from(map.values()).sort((a, b) => sortRu(a.number, b.number));
}

function currentBuildings() {
  return apiState.buildings.length ? apiState.buildings : deriveBuildingsFromRooms();
}

function renderBuildingButtons() {
  buildingToggle.innerHTML = "";
  const buildings = currentBuildings();

  if (!apiState.catalogsLoaded) {
    const button = createElement("button", "setting-pill active", "Загрузка...");
    button.type = "button";
    button.disabled = true;
    buildingToggle.append(button);
    return;
  }

  if (!buildings.length) {
    const button = createElement("button", "setting-pill active", "Корпуса не загружены");
    button.type = "button";
    button.disabled = true;
    buildingToggle.append(button);
    return;
  }

  if (!state.building || !buildings.some((building) => building.number === state.building)) {
    state.building = buildings[0].number;
    saveState();
  }

  buildings.forEach((building) => {
    const button = createElement("button", `setting-pill${building.number === state.building ? " active" : ""}`, building.name || `${building.number} корпус`);
    button.type = "button";
    button.dataset.building = building.number;
    buildingToggle.append(button);
  });
}

function formatSlotLabel(slot) {
  return [slot.label, slot.time ? `(${slot.time})` : ""].filter(Boolean).join(" ");
}

function renderPairOptions(loading = false) {
  pairSelect.innerHTML = "";

  if (loading) {
    pairSelect.disabled = true;
    pairSelect.append(new Option("Загрузка пар...", ""));
    return;
  }

  if (!apiState.timeSlots.length) {
    state.pair = "";
    pairSelect.disabled = true;
    pairSelect.append(new Option("Пары не загружены", ""));
    saveState();
    return;
  }

  pairSelect.disabled = false;
  if (!state.pair || !apiState.timeSlots.some((slot) => slot.value === state.pair)) {
    state.pair = apiState.timeSlots[0].value;
    saveState();
  }

  apiState.timeSlots.forEach((slot) => {
    pairSelect.append(new Option(formatSlotLabel(slot), slot.value));
  });
  pairSelect.value = state.pair;
}

async function loadTimeSlotsForDate() {
  renderPairOptions(true);
  try {
    apiState.timeSlots = await scheduleService.getTimeTemplate({ dateKey: selectedDateKey() });
    renderPairOptions();
    return true;
  } catch (error) {
    apiState.timeSlots = [];
    renderPairOptions();
    if (error?.status !== 404) {
      showMessage(apiErrorText(error, "Не удалось загрузить расписание звонков"));
    }
    return false;
  }
}

function selectedSlot() {
  return apiState.timeSlots.find((slot) => slot.value === state.pair) || null;
}

function deriveTimeSlotsFromRooms(rooms) {
  const slots = new Map();
  rooms.flatMap((room) => room.lessons || []).forEach((lesson) => {
    const value = lesson.slotKey || lesson.lesson || lesson.pair || lesson.time;
    if (!value || slots.has(value)) return;
    slots.set(value, {
      value,
      number: lesson.slotKey || lesson.lesson || "",
      label: lesson.pair || lesson.lesson || value,
      time: lesson.time || ""
    });
  });
  return Array.from(slots.values()).sort((a, b) => sortRu(a.label || a.value, b.label || b.value));
}

function lessonMatchesSlot(lesson, slot) {
  if (!slot) return true;
  const candidates = [lesson.slotKey, lesson.lesson, lesson.pair, lesson.time].map((value) => String(value || "").toLowerCase());
  const targets = [slot.value, slot.number, slot.label, slot.time].map((value) => String(value || "").toLowerCase()).filter(Boolean);
  if (targets.some((target) => candidates.includes(target))) return true;

  const lessonNumbers = String(lesson.lesson || "").split(/\D+/).filter(Boolean);
  return Boolean(slot.number && lessonNumbers.includes(String(slot.number)));
}

function normalizeRoomForSelectedSlot(room) {
  const slot = selectedSlot();
  const matchedLessons = (room.lessons || []).filter((lesson) => lessonMatchesSlot(lesson, slot));
  return {
    ...room,
    busy: matchedLessons.length ? true : Boolean(room.busy && !(room.lessons || []).length),
    matchedLessons
  };
}

function roomMatchesBuilding(room) {
  if (!state.building) return true;
  return scheduleTransform.buildingNumber(room.building) === state.building;
}

async function renderRooms({ force = false } = {}) {
  renderInlineStatus(roomCards, "Загрузка аудиторий...");

  try {
    if (!apiState.timeSlots.length) {
      await loadTimeSlotsForDate();
    }

    const rooms = await scheduleService.getClassrooms({ dateKey: selectedDateKey(), force });
    apiState.currentRooms = rooms;

    if (!apiState.timeSlots.length) {
      apiState.timeSlots = deriveTimeSlotsFromRooms(rooms);
      renderPairOptions();
    }

    roomCards.innerHTML = "";

    const preparedRooms = rooms
      .filter(roomMatchesBuilding)
      .map(normalizeRoomForSelectedSlot)
      .sort((a, b) => sortRu(a.room, b.room));

    if (!preparedRooms.length) {
      renderInlineStatus(roomCards, "Аудитории на выбранную дату не найдены");
      return;
    }

    preparedRooms.forEach((item) => {
      const card = createElement("button", `room-card${item.busy ? " busy" : ""}`);
      card.type = "button";
      const title = createElement("div", "room-title");
      title.append(createElement("strong", "", item.room), createElement("span", "status-dot"));
      card.append(title, createElement("div", "room-status", item.busy ? "Занята" : "Свободна"));
      card.addEventListener("click", () => showRoomDetail(item));
      roomCards.append(card);
    });
  } catch (error) {
    renderInlineStatus(roomCards, "Не удалось загрузить аудитории");
    showMessage(apiErrorText(error, "Не удалось загрузить аудитории"));
  }
}

function selectedSlotLabel() {
  const slot = selectedSlot();
  return slot ? formatSlotLabel(slot) : "Выбранная пара";
}

function appendDetailLine(label, value) {
  if (!value) return;
  const paragraph = createElement("p");
  paragraph.append(createElement("strong", "", label), document.createTextNode(` ${value}`));
  roomDetailContent.append(paragraph);
}

function showRoomDetail(item) {
  if (roomsModal.open) {
    roomsModal.close();
  }

  roomDetailTitle.textContent = `Аудитория ${item.room}`;
  roomDetailContent.className = "room-detail-content";
  roomDetailContent.innerHTML = "";
  appendDetailLine("Статус:", item.busy ? "занята" : "свободна");
  appendDetailLine("Пара:", selectedSlotLabel());

  if (item.busy && item.matchedLessons.length) {
    item.matchedLessons.forEach((lesson, index) => {
      if (item.matchedLessons.length > 1) {
        appendDetailLine("Занятие:", String(index + 1));
      }
      appendDetailLine("Группа:", lesson.group);
      appendDetailLine("Педагог:", lesson.teacher);
      appendDetailLine("Дисциплина:", lesson.discipline);
      appendDetailLine("Время:", lesson.time);
    });
  } else if (item.busy) {
    roomDetailContent.append(createElement("p", "", "Аудитория занята, но API не передал детали занятия для выбранной пары."));
  } else {
    roomDetailContent.append(createElement("p", "", "На выбранной паре аудитория свободна."));
  }

  roomDetailModal.showModal();
}

function applySettings() {
  const holiday = activeHoliday(state.holidayMode, today);
  app.dataset.theme = state.theme;
  app.dataset.size = state.size;
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.size = state.size;
  document.documentElement.style.setProperty("--accent", state.accent);
  document.documentElement.style.setProperty("--accent-ink", accentInkFor(state.accent));
  app.dataset.holiday = holiday;
  startHolidayParticles(holiday);
  document.querySelectorAll("[data-setting]").forEach((button) => {
    button.classList.toggle("active", state[button.dataset.setting] === button.dataset.value);
  });
  renderBuildingButtons();
  pairSelect.value = state.pair;
  modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === state.mode));
  document.querySelectorAll("[data-holiday]").forEach((button) => {
    button.classList.toggle("active", button.dataset.holiday === state.holidayMode);
  });
}

function applyCatalogs(catalogs) {
  apiState.groupsByBuilding = catalogs.groups || {};
  apiState.groups = Object.values(apiState.groupsByBuilding).flat().sort(sortRu);
  apiState.teachers = (catalogs.teachers || []).sort(sortRu);
  apiState.buildings = catalogs.buildings || [];
  apiState.classrooms = catalogs.classrooms || [];
  apiState.dictionaries = catalogs.dictionaries;
  apiState.scheduleDates = new Set(catalogs.dates || []);
  apiState.catalogsLoaded = true;

  const entities = getEntities();
  if (state.selectedEntity && !entities.includes(state.selectedEntity)) {
    state.selectedEntity = "";
    hideResult();
    saveState();
  }

  updateTrigger();
  renderEntityOptions();
  renderBuildingButtons();
  renderCalendar();

  if (catalogs.errors?.length) {
    showMessage(apiErrorText(catalogs.errors[0], "Не удалось загрузить списки групп и преподавателей"));
    return;
  }

  startScheduleWatcher();

  if (!apiState.groups.length) {
    showMessage("Не удалось загрузить список групп");
  }

  if (!apiState.teachers.length) {
    showMessage("Не удалось загрузить список преподавателей");
  }

  if (catalogs.optionalErrors?.length) {
    const visibleError = catalogs.optionalErrors.find((error) => error?.status !== 404) || catalogs.optionalErrors[0];
    if (visibleError?.status !== 404) {
      showMessage(apiErrorText(visibleError, "Часть публичных данных API не загрузилась"));
    }
  }
}

async function loadCatalogs() {
  try {
    const catalogs = await scheduleService.getCatalogs({ dateDays: 180 });
    applyCatalogs(catalogs);
  } catch (error) {
    apiState.catalogsLoaded = true;
    renderEntityOptions();
    renderBuildingButtons();
    showMessage(apiErrorText(error, "Не удалось загрузить публичные справочники"));
  }
}

function handleScheduleDateAdded(dateKey) {
  apiState.scheduleDates.add(dateKey);
  scheduleService.clearDateCache(dateKey);
  renderCalendar();
  showMessage(`Появилось расписание на ${dateKey}`);
}

function handleScheduleNotice(payload = {}) {
  const dateKey = String(payload.date || "").slice(0, 10);
  if (dateKey) {
    apiState.scheduleDates.add(dateKey);
    scheduleService.clearDateCache(dateKey);
    renderCalendar();

    if (dateKey === selectedDateKey()) {
      hideResult();
    }
  }

  const fallback = payload.event_type === "schedule_updated"
    ? `Расписание на ${dateKey || "выбранную дату"} обновлено`
    : `Добавлено расписание на ${dateKey || "новую дату"}`;
  showMessage(payload.message || fallback);
}

function startScheduleWatcher() {
  if (stopScheduleWatcher) return;

  stopScheduleWatcher = scheduleService.startScheduleDatesWatcher({
    days: 180,
    intervalMs: 180000,
    onAdded: handleScheduleDateAdded,
    onError: (error) => {
      if (error?.status === 404) return;
      if (!scheduleWatcherErrorShown) {
        scheduleWatcherErrorShown = true;
        showMessage(apiErrorText(error, "Не удалось проверить обновления расписания"));
      }
    }
  });
}

window.addEventListener("schedule:changed", (event) => {
  handleScheduleNotice(event.detail || {});
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    state.selectedEntity = "";
    hideResult();
    saveState();
    updateTrigger();
    renderEntityOptions();
    applySettings();
  });
});

entityTrigger.addEventListener("click", () => {
  if (entityMenu.hidden) openSelect();
  else closeSelect();
});

monthButton.addEventListener("click", (event) => {
  event.stopPropagation();
  monthMenu.hidden = !monthMenu.hidden;
});

mobileMonthTitle.addEventListener("click", (event) => {
  event.stopPropagation();
  monthMenu.hidden = !monthMenu.hidden;
});

selectedFavorite.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!state.selectedEntity) {
    showMessage("Сначала выберите элемент списка");
    return;
  }
  toggleFavorite(state.selectedEntity);
});

entitySearch.addEventListener("input", renderEntityOptions);

document.addEventListener("click", (event) => {
  if (!entitySelectRoot.contains(event.target)) {
    closeSelect();
  }
  if (monthMenu && !monthMenu.hidden && !monthMenu.contains(event.target) && event.target !== monthButton && event.target !== mobileMonthTitle) {
    monthMenu.hidden = true;
  }
});

showScheduleButton.addEventListener("click", showSchedule);
settingsButton.addEventListener("click", () => settingsModal.showModal());
roomsButton.addEventListener("click", () => {
  roomsModal.showModal();
  renderRooms();
});
holidayAdminButton.addEventListener("click", () => holidayAdminModal.showModal());

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close());
});

document.querySelectorAll("[data-setting]").forEach((button) => {
  button.addEventListener("click", () => {
    const setting = button.dataset.setting;
    state[setting] = button.dataset.value;
    hideResult();
    applySettings();
    saveState();
  });
});

buildingToggle.addEventListener("click", (event) => {
  const button = event.target.closest("[data-building]");
  if (!button) return;
  state.building = button.dataset.building;
  applySettings();
  saveState();
  if (roomsModal.open) renderRooms();
});

pairSelect.addEventListener("change", (event) => {
  state.pair = event.target.value;
  saveState();
  if (roomsModal.open) renderRooms();
});

document.querySelectorAll("[data-holiday]").forEach((button) => {
  button.addEventListener("click", () => {
    state.holidayMode = button.dataset.holiday;
    applySettings();
    saveState();
  });
});

prevWeek.addEventListener("click", () => {
  state.selectedDate.setDate(state.selectedDate.getDate() - 7);
  state.visibleDate = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
  resetTimeSlotsForDate();
  hideResult();
  saveState();
  renderCalendar();
  refreshRoomsIfOpen();
});

nextWeek.addEventListener("click", () => {
  state.selectedDate.setDate(state.selectedDate.getDate() + 7);
  state.visibleDate = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
  resetTimeSlotsForDate();
  hideResult();
  saveState();
  renderCalendar();
  refreshRoomsIfOpen();
});

prevMonth.addEventListener("click", () => {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() - 1, 1);
  state.selectedDate = new Date(state.visibleDate);
  resetTimeSlotsForDate();
  hideResult();
  saveState();
  renderCalendar();
  refreshRoomsIfOpen();
});

nextMonth.addEventListener("click", () => {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() + 1, 1);
  state.selectedDate = new Date(state.visibleDate);
  resetTimeSlotsForDate();
  hideResult();
  saveState();
  renderCalendar();
  refreshRoomsIfOpen();
});

applySettings();
updateTrigger();
renderEntityOptions();
renderCalendar();
renderColorButtons();
renderPairOptions();
loadCatalogs();
