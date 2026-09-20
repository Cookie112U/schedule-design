const {
  accentColors,
  monthNames,
  months,
  weekdays,
  weekdaysFull
} = window.ScheduleData;
const { activeHoliday } = window.ScheduleHoliday;
const {
  readSavedState,
  readRoomCache,
  writeRoomCache,
  writeSavedState
} = window.ScheduleStorage;
const scheduleService = window.ScheduleService;
const scheduleTransform = window.ScheduleTransform;
const errorCatalog = window.ScheduleErrorCatalog;
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
const downloadScheduleButton = document.querySelector("#downloadSchedule");
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
const maxFavorites = 18;
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
  scheduleUrl: "",
  catalogsLoaded: false
};

const defaults = {
  mode: "student",
  selectedEntity: "",
  lastSelectedByMode: { student: "", teacher: "" },
  selectedDate: toDateKey(today),
  visibleDate: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
  theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  size: "medium",
  width: "standard",
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
  favorites: Array.isArray(saved.favorites) ? saved.favorites : [],
  lastSelectedByMode: {
    ...defaults.lastSelectedByMode,
    ...(saved.lastSelectedByMode && typeof saved.lastSelectedByMode === "object" ? saved.lastSelectedByMode : {})
  }
};

if (state.selectedEntity && !state.lastSelectedByMode[state.mode]) {
  state.lastSelectedByMode[state.mode] = state.selectedEntity;
}

const roomCache = typeof readRoomCache === "function" ? readRoomCache() : {};
const roomCacheTtlMs = 6 * 60 * 60 * 1000;
const maxRoomCacheDates = 20;

const isAuditMode = new URLSearchParams(window.location.search).has("audit");
const availableHolidayModes = new Set(Array.from(document.querySelectorAll("[data-holiday]")).map((button) => button.dataset.holiday));
if (!availableHolidayModes.has(state.holidayMode)) {
  state.holidayMode = defaults.holidayMode;
}
const availableWidths = new Set(["compact", "standard", "full"]);
if (!availableWidths.has(state.width)) {
  state.width = defaults.width;
}

let scheduleWatcherErrorShown = false;
let stopScheduleWatcher = null;
let catalogLoadRequestId = 0;
let roomsLoadRequestId = 0;
let catalogRefreshTimer = 0;
let roomsRefreshTimer = 0;

function saveState() {
  writeSavedState({
    mode: state.mode,
    selectedEntity: state.selectedEntity,
    lastSelectedByMode: state.lastSelectedByMode,
    selectedDate: toDateKey(state.selectedDate),
    visibleDate: toDateKey(state.visibleDate),
    theme: state.theme,
    size: state.size,
    width: state.width,
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
  if (error?.code === "SCHEDULE_DATE_NOT_FOUND") {
    return "На данную дату нет расписания";
  }

  if (errorCatalog?.userMessage) {
    return errorCatalog.userMessage(error, fallback);
  }

  if (error?.code === "NETWORK_ERROR") {
    return error.message;
  }

  if (error?.status === 429) {
    return error.retryAfter
      ? `Слишком много запросов. Попробуйте через ${error.retryAfter} сек.`
      : "Слишком много запросов. Попробуйте чуть позже.";
  }

  if (error?.status === 404) {
    return error?.message && !/not found/i.test(error.message)
      ? error.message
      : `${fallback}: эндпоинт не найден`;
  }

  return error?.message ? `${fallback}: ${error.message}` : fallback;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function roomCacheScope() {
  return window.ScheduleRequest?.apiMode?.() || "api";
}

function roomCacheKey(dateKey) {
  return `${roomCacheScope()}:${dateKey}`;
}

function persistRoomCache() {
  if (typeof writeRoomCache === "function") {
    writeRoomCache(roomCache);
  }
}

function pruneRoomCache() {
  const entries = Object.entries(roomCache)
    .sort(([, first], [, second]) => Number(second?.savedAt || 0) - Number(first?.savedAt || 0));
  entries.slice(maxRoomCacheDates).forEach(([key]) => delete roomCache[key]);
}

function readCachedRooms(dateKey) {
  const key = roomCacheKey(dateKey);
  const cached = roomCache[key];
  if (!cached || !Array.isArray(cached.rooms)) return null;

  if (Date.now() - Number(cached.savedAt || 0) > roomCacheTtlMs) {
    delete roomCache[key];
    persistRoomCache();
    return null;
  }

  return cached.rooms;
}

function writeCachedRooms(dateKey, rooms) {
  roomCache[roomCacheKey(dateKey)] = {
    savedAt: Date.now(),
    rooms
  };
  pruneRoomCache();
  persistRoomCache();
}

function setScheduleUrl(url = "") {
  apiState.scheduleUrl = String(url || "").trim();
  updateDownloadButton();
}

function updateDownloadButton() {
  if (!downloadScheduleButton) return;
  downloadScheduleButton.disabled = !apiState.scheduleUrl;
  downloadScheduleButton.title = apiState.scheduleUrl
    ? "Скачать таблицу расписания"
    : "На выбранную дату файл расписания не найден";
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

function chooseAvailableEntity(entities) {
  const pinned = state.lastSelectedByMode?.[state.mode] || "";
  if (pinned && entities.includes(pinned)) return pinned;

  const favorite = entities.find((entity) => isFavorite(entity));
  if (favorite) return favorite;

  return state.selectedEntity && entities.includes(state.selectedEntity) ? state.selectedEntity : "";
}

function toggleFavorite(entity, mode = state.mode) {
  const key = favoriteKey(entity, mode);
  if (isFavorite(entity, mode)) {
    state.favorites = state.favorites.filter((item) => item !== key);
  } else {
    const sameMode = state.favorites
      .filter((item) => item !== key && item.startsWith(`${mode}:`))
      .slice(0, maxFavorites - 1);
    const otherMode = state.favorites.filter((item) => !item.startsWith(`${mode}:`));
    state.favorites = [key, ...sameMode, ...otherMode];
  }

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
  const favorite = Boolean(state.selectedEntity && isFavorite(state.selectedEntity));
  selectedFavorite.textContent = favorite ? "★" : "☆";
  selectedFavorite.classList.toggle("active", favorite);
  selectedFavorite.setAttribute("aria-label", favorite ? "Убрать из избранного" : "Добавить в избранное");
}

const checkIconMarkup = '<svg class="select-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>';

function addOption(entity) {
  const star = createElement("button", `favorite-button${isFavorite(entity) ? " active" : ""}`, isFavorite(entity) ? "★" : "☆");
  star.type = "button";
  star.title = "Избранное";
  star.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(entity);
  });

  const isSelected = entity === state.selectedEntity;
  const option = createElement("div", `select-option${isSelected ? " active" : ""}`);
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", String(isSelected));

  const button = createElement("button", "select-option-main");
  button.type = "button";
  button.append(createElement("span", "truncate", entity));
  if (isSelected) button.insertAdjacentHTML("beforeend", checkIconMarkup);
  button.addEventListener("click", () => {
    state.selectedEntity = entity;
    state.lastSelectedByMode[state.mode] = entity;
    hideResult();
    saveState();
    updateTrigger();
    closeSelect();
  });
  option.append(star, button);
  entityOptions.append(option);
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
  const favorites = entities
    .filter((entity) => isFavorite(entity) && entity.toLowerCase().includes(query))
    .slice(0, maxFavorites);

  if (favorites.length) {
    addGroupTitle("Избранное");
    favorites.forEach(addOption);
  }

  if (state.mode === "student") {
    Object.entries(apiState.groupsByBuilding).forEach(([building, list]) => {
      const filtered = [...list]
        .sort(sortRu)
        .filter((entity) => entity.toLowerCase().includes(query));
      if (!filtered.length) return;
      addGroupTitle(building);
      filtered.forEach(addOption);
    });
  } else {
    const filtered = apiState.teachers.filter((entity) => entity.toLowerCase().includes(query));
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
  refreshCatalogsForDate();
}

function resetTimeSlotsForDate() {
  apiState.timeSlots = [];
  state.pair = "";
  setScheduleUrl("");
  renderPairOptions();
}

function refreshRoomsIfOpen(force = false) {
  if (!roomsModal.open) return;
  window.clearTimeout(roomsRefreshTimer);
  roomsRefreshTimer = window.setTimeout(() => renderRooms({ force }), 60);
}

function refreshCatalogsForDate(force = false) {
  if (isAuditMode) return;
  window.clearTimeout(catalogRefreshTimer);
  catalogRefreshTimer = window.setTimeout(() => loadCatalogs({ force }), 80);
}

function renderCalendar() {
  const year = state.visibleDate.getFullYear();
  const month = state.visibleDate.getMonth();
  monthLabel.textContent = `${months[month]} ${year}`;
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
      refreshCatalogsForDate();
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

function splitBuildingLabel(value) {
  const raw = String(value || "").trim();
  const addressMatch = raw.match(/\(([^)]*)\)/);
  const name = raw.replace(/\s*\([^)]*\)/g, "").trim();
  const normalizedName = name
    ? name.replace(/^корпус/i, "Корпус").replace(/^КОРПУС/i, "Корпус")
    : "";

  return {
    name: normalizedName,
    address: addressMatch?.[1]?.trim() || ""
  };
}

function normalizeBuildingLabel(value) {
  return splitBuildingLabel(value).name;
}

function createBuildingLabel(value, className = "building-label") {
  const building = splitBuildingLabel(value);
  if (!building.name && !building.address) return null;

  const labelClass = className.includes("building-label") ? className : `${className} building-label`;
  const element = createElement("span", labelClass);
  if (building.name) element.append(createElement("span", "building-name", building.name));
  if (building.address) element.append(createElement("span", "building-address", building.address));
  return element;
}

function normalizeRoomLabel(value) {
  const room = String(value || "").trim();
  if (!room) return "";
  return /^каб/i.test(room) ? room : `каб. ${room}`;
}

function lessonPlaceValue(lesson) {
  if (isLunchLesson(lesson)) return "";
  return lesson.place || [lesson.building, lesson.room].filter(Boolean).join(" ");
}

function createLessonPlace(className, lesson) {
  if (isLunchLesson(lesson)) return null;
  const building = normalizeBuildingLabel(lesson.building);
  const room = normalizeRoomLabel(lesson.room);

  if (!building && !room) {
    const fallback = lessonPlaceValue(lesson);
    return fallback ? createElement("div", className, fallback) : null;
  }

  const element = createElement("div", `${className} lesson-place`);
  const buildingLabel = createBuildingLabel(lesson.building, "lesson-building");
  if (buildingLabel) element.append(buildingLabel);
  if (room) element.append(createElement("span", "lesson-room-number", room));
  return element;
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

    const place = createLessonPlace("lesson-room", lesson);
    if (place) {
      card.append(place);
    }

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
      renderLessons(modalLessonList, lessons);
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
        renderLessons(modalLessonList, lessons);
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
    error.publicKey = error.publicKey || "SCHEDULE_FAILED";
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
    button.setAttribute("aria-pressed", String(color === state.accent));
    button.addEventListener("click", () => {
      state.accent = color;
      applySettings();
      saveState();
      colorGrid.querySelectorAll(".color-dot").forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-pressed", "false");
      });
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
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
    const button = createElement("button", "segment active", "Загрузка...");
    button.type = "button";
    button.disabled = true;
    buildingToggle.append(button);
    return;
  }

  if (!buildings.length) {
    const button = createElement("button", "segment active", "Корпуса не загружены");
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
    const button = createElement("button", `segment building-pill${building.number === state.building ? " active" : ""}`);
    button.append(createBuildingLabel(building.name || `${building.number} корпус`) || document.createTextNode(building.name || `${building.number} корпус`));
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
      error.publicKey = error.publicKey || "TIME_TEMPLATE_FAILED";
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
  const targets = [slot.value, slot.number, slot.label, slot.time, slot.displayLesson].map((value) => String(value || "").toLowerCase()).filter(Boolean);
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

function roomLessonPreview(item) {
  return item.matchedLessons?.[0] || item.lessons?.[0] || null;
}

async function loadRoomsForDate(dateKey, force = false) {
  const cached = force ? null : readCachedRooms(dateKey);
  if (cached) return cached;

  const rooms = await scheduleService.getClassrooms({ dateKey, force });
  writeCachedRooms(dateKey, rooms);
  return rooms;
}

function roomMatchesBuilding(room) {
  if (!state.building) return true;
  return scheduleTransform.buildingNumber(room.building) === state.building;
}

async function renderRooms({ force = false } = {}) {
  const requestId = ++roomsLoadRequestId;
  const dateKey = selectedDateKey();
  renderInlineStatus(roomCards, "Загрузка аудиторий...");

  try {
    if (!apiState.timeSlots.length) {
      await loadTimeSlotsForDate();
      if (requestId !== roomsLoadRequestId || dateKey !== selectedDateKey()) return;
    }

    const rooms = await loadRoomsForDate(dateKey, force);
    if (requestId !== roomsLoadRequestId || dateKey !== selectedDateKey()) return;
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
      const preview = roomLessonPreview(item);
      const meta = createElement("div", "room-meta");
      if (item.busy && preview?.group) meta.append(createElement("span", "room-person room-group", preview.group));
      if (item.busy && preview?.teacher) meta.append(createElement("span", "room-person room-teacher", preview.teacher));
      if (meta.children.length) card.append(meta);
      card.addEventListener("click", () => showRoomDetail(item));
      roomCards.append(card);
    });
  } catch (error) {
    renderInlineStatus(roomCards, "Не удалось загрузить аудитории");
    error.publicKey = error.publicKey || "CLASSROOMS_FAILED";
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
  const roomBuilding = splitBuildingLabel(item.building);
  appendDetailLine("Корпус:", roomBuilding.name);
  appendDetailLine("Адрес:", roomBuilding.address);
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
  app.dataset.width = state.width;
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.classList.toggle("dark", state.theme === "dark");
  document.documentElement.dataset.size = state.size;
  document.documentElement.dataset.width = state.width;
  document.documentElement.style.setProperty("--user-accent", state.accent);
  document.documentElement.style.setProperty("--user-accent-ink", accentInkFor(state.accent));
  app.dataset.holiday = holiday;
  startHolidayParticles(holiday);
  document.querySelectorAll("[data-setting]").forEach((radio) => {
    radio.checked = state[radio.dataset.setting] === radio.dataset.value;
  });
  renderBuildingButtons();
  pairSelect.value = state.pair;
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  document.querySelectorAll("[data-holiday]").forEach((button) => {
    button.classList.toggle("active", button.dataset.holiday === state.holidayMode);
  });
}

function clearCatalogsAfterDateError() {
  apiState.groupsByBuilding = {};
  apiState.groups = [];
  apiState.teachers = [];
  apiState.buildings = [];
  apiState.classrooms = [];
  apiState.currentRooms = [];
  apiState.currentLessons = [];
  apiState.dictionaries = null;
  apiState.catalogsLoaded = true;
  state.selectedEntity = "";
  setScheduleUrl("");
  hideResult();
  updateTrigger();
  renderEntityOptions();
  renderBuildingButtons();
  renderCalendar();
}
function applyCatalogs(catalogs) {
  apiState.groupsByBuilding = catalogs.groups || {};
  apiState.groups = Object.values(apiState.groupsByBuilding).flat().sort(sortRu);
  apiState.teachers = (catalogs.teachers || []).sort(sortRu);
  apiState.buildings = catalogs.buildings || [];
  apiState.classrooms = catalogs.classrooms || apiState.classrooms || [];
  apiState.dictionaries = catalogs.dictionaries;
  setScheduleUrl(catalogs.meta?.url || "");
  apiState.scheduleDates = new Set(catalogs.dates || []);
  apiState.catalogsLoaded = true;

  const entities = getEntities();
  const nextEntity = chooseAvailableEntity(entities);
  if (nextEntity !== state.selectedEntity) {
    state.selectedEntity = nextEntity;
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

  if (!apiState.groups.length || !apiState.teachers.length) {
    showMessage(apiErrorText({
      publicKey: "CATALOG_EMPTY",
      message: [
        !apiState.groups.length ? "groups" : "",
        !apiState.teachers.length ? "teachers" : ""
      ].filter(Boolean).join(",")
    }, "Списки групп и преподавателей временно недоступны"));
  }

  if (catalogs.optionalErrors?.length) {
    const visibleError = catalogs.optionalErrors.find((error) => error?.status !== 404) || catalogs.optionalErrors[0];
    if (visibleError?.status !== 404) {
      visibleError.publicKey = visibleError.publicKey || "CATALOG_PARTIAL";
      showMessage(apiErrorText(visibleError, "Часть данных расписания временно недоступна"));
    }
  }
}

async function loadCatalogs({ force = false } = {}) {
  const requestId = ++catalogLoadRequestId;
  const dateKey = selectedDateKey();

  try {
    const catalogs = await scheduleService.getCatalogs({ dateDays: 180, dateKey, force });
    if (requestId !== catalogLoadRequestId || dateKey !== selectedDateKey()) return;
    applyCatalogs(catalogs);
  } catch (error) {
    if (requestId !== catalogLoadRequestId || dateKey !== selectedDateKey()) return;
    clearCatalogsAfterDateError();
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
        error.publicKey = error.publicKey || "CATALOG_PARTIAL";
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
    const nextMode = button.dataset.mode;
    if (state.mode === nextMode) return;

    state.mode = nextMode;
    state.selectedEntity = chooseAvailableEntity(getEntities());
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
downloadScheduleButton.addEventListener("click", () => {
  if (!apiState.scheduleUrl) {
    showMessage("На выбранную дату файл расписания не найден");
    return;
  }
  window.open(apiState.scheduleUrl, "_blank", "noopener");
});
settingsButton.addEventListener("click", () => settingsModal.showModal());
roomsButton.addEventListener("click", () => {
  roomsModal.showModal();
  renderRooms();
});
holidayAdminButton.addEventListener("click", () => holidayAdminModal.showModal());

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close());
});

document.querySelectorAll("[data-setting]").forEach((radio) => {
  radio.addEventListener("change", () => {
    const setting = radio.dataset.setting;
    state[setting] = radio.dataset.value;
    if (setting === "output") hideResult();
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
  refreshCatalogsForDate();
});

nextWeek.addEventListener("click", () => {
  state.selectedDate.setDate(state.selectedDate.getDate() + 7);
  state.visibleDate = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
  resetTimeSlotsForDate();
  hideResult();
  saveState();
  renderCalendar();
  refreshRoomsIfOpen();
  refreshCatalogsForDate();
});

prevMonth.addEventListener("click", () => {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() - 1, 1);
  state.selectedDate = new Date(state.visibleDate);
  resetTimeSlotsForDate();
  hideResult();
  saveState();
  renderCalendar();
  refreshRoomsIfOpen();
  refreshCatalogsForDate();
});

nextMonth.addEventListener("click", () => {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() + 1, 1);
  state.selectedDate = new Date(state.visibleDate);
  resetTimeSlotsForDate();
  hideResult();
  saveState();
  renderCalendar();
  refreshRoomsIfOpen();
  refreshCatalogsForDate();
});

if (isAuditMode) {
  apiState.catalogsLoaded = true;
}

applySettings();
updateTrigger();
renderEntityOptions();
renderCalendar();
renderColorButtons();
renderPairOptions();
updateDownloadButton();

if (!isAuditMode) {
  loadCatalogs();
}
