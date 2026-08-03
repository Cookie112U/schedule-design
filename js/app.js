const {
  accentColors,
  groups,
  groupsByBuilding,
  lessonPairs,
  monthNames,
  months,
  teachers,
  weekdays,
  weekdaysFull
} = window.ScheduleData;
const { activeHoliday } = window.ScheduleHoliday;
const { readSavedState, writeSavedState } = window.ScheduleStorage;
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

const defaults = {
  mode: "student",
  selectedEntity: "",
  selectedDate: toDateKey(today),
  visibleDate: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
  theme: "light",
  size: "medium",
  output: "bottom",
  accent: accentColors[0],
  building: "1",
  pair: "1",
  holidayMode: "auto",
  favorites: []
};

const saved = readSavedState();
const state = {
  ...defaults,
  ...saved,
  selectedDate: parseDate(defaults.selectedDate),
  visibleDate: parseDate(defaults.visibleDate),
  favorites: Array.isArray(saved.favorites) ? saved.favorites : []
};

function saveState() {
  writeSavedState({
    mode: state.mode,
    selectedEntity: state.selectedEntity,
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
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
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

function getEntities() {
  return [...(state.mode === "student" ? groups : teachers)].sort(sortRu);
}

function sortRu(a, b) {
  return a.localeCompare(b, "ru", { numeric: true, sensitivity: "base" });
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

function addOption(entity, groupTitle) {
  const row = document.createElement("div");
  row.className = `select-option${entity === state.selectedEntity ? " active" : ""}`;

  const star = document.createElement("button");
  star.type = "button";
  star.className = `favorite-button${isFavorite(entity) ? " active" : ""}`;
  star.textContent = isFavorite(entity) ? "★" : "☆";
  star.title = "Избранное";
  star.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(entity);
  });

  const button = document.createElement("button");
  button.type = "button";
  button.className = "select-option";
  button.innerHTML = `<span></span><strong>${entity}</strong>`;
  button.querySelector("span").replaceWith(star);
  button.addEventListener("click", () => {
    state.selectedEntity = entity;
    hideResult();
    saveState();
    updateTrigger();
    closeSelect();
  });

  row.replaceWith(button);
  entityOptions.append(button);
}

function addGroupTitle(text) {
  const title = document.createElement("div");
  title.className = "select-group-title";
  title.textContent = text;
  entityOptions.append(title);
}

function renderEntityOptions() {
  const query = entitySearch.value.trim().toLowerCase();
  entityOptions.innerHTML = "";
  const entities = getEntities();
  const favorites = entities.filter((entity) => isFavorite(entity) && entity.toLowerCase().includes(query));

  if (favorites.length) {
    addGroupTitle("Избранное");
    favorites.forEach((entity) => addOption(entity));
  }

  if (state.mode === "student") {
    Object.entries(groupsByBuilding).forEach(([building, list]) => {
      const filtered = [...list]
        .sort(sortRu)
        .filter((entity) => entity.toLowerCase().includes(query) && !favorites.includes(entity));
      if (!filtered.length) return;
      addGroupTitle(building);
      filtered.forEach((entity) => addOption(entity));
    });
  } else {
    const filtered = [...teachers].sort(sortRu).filter((entity) => entity.toLowerCase().includes(query) && !favorites.includes(entity));
    if (filtered.length) {
      addGroupTitle("Преподаватели");
      filtered.forEach((entity) => addOption(entity));
    }
  }

  if (!entityOptions.children.length) {
    addGroupTitle("Ничего не найдено");
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
    const item = document.createElement("div");
    item.className = "week-day";
    item.innerHTML = `
      <span>${day}</span>
      <button class="week-date${sameDate(date, state.selectedDate) ? " active" : ""}" type="button">${date.getDate()}</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      state.selectedDate = date;
      state.visibleDate = new Date(date.getFullYear(), date.getMonth(), 1);
      hideResult();
      saveState();
      renderCalendar();
    });
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "day-cell",
      isStudy ? "study" : "",
      isWeekend ? "weekend" : "",
      isCurrentMonth ? "" : "other-month",
      sameDate(date, state.selectedDate) ? "active" : ""
    ].filter(Boolean).join(" ");
    button.innerHTML = `<strong>${date.getDate()}</strong>${sameDate(date, today) ? "<span>Сегодня</span>" : ""}`;
    button.addEventListener("click", () => {
      state.selectedDate = date;
      state.visibleDate = new Date(date.getFullYear(), date.getMonth(), 1);
      hideResult();
      saveState();
      renderCalendar();
    });
    calendarGrid.append(button);
  }
}

function renderMonthMenu() {
  if (!monthMenu) return;
  const activeMonth = state.visibleDate.getMonth();
  monthMenu.innerHTML = "";
  months.forEach((monthName, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `month-option${index === activeMonth ? " active" : ""}`;
    button.textContent = monthName;
    button.addEventListener("click", () => {
      const year = state.visibleDate.getFullYear();
      state.visibleDate = new Date(year, index, 1);
      state.selectedDate = new Date(year, index, Math.min(state.selectedDate.getDate(), daysInMonth(year, index)));
      hideResult();
      saveState();
      monthMenu.hidden = true;
      renderCalendar();
    });
    monthMenu.append(button);
  });
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function lessonsForSelection() {
  const base = state.selectedEntity || "demo";
  const seed = Array.from(`${base}-${toDateKey(state.selectedDate)}`).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const subjects = [
    "Техническое оснащение организаций питания",
    "Информационные технологии",
    "Проектирование интерфейсов",
    "Экономика организации",
    "Иностранный язык"
  ];
  const numbers = ["1-2", "3-4", "5", "6-7"];
  return numbers.map((number, index) => {
    const pair = lessonPairs[index + 1];
    return {
      lesson: number,
      pair: pair.label,
      time: pair.time,
      teacher: index === 2 ? "" : teachers[(seed + index) % teachers.length],
      group: groups[(seed + index) % groups.length],
      discipline: index === 2 ? "Обед" : subjects[(seed + index) % subjects.length],
      building: `${(seed + index) % 2 ? "1" : "2"} корпус`,
      room: index === 2 ? "Столовая" : `${30 + index} кб`
    };
  });
}

function renderLessons(target) {
  target.innerHTML = "";
  lessonsForSelection().forEach((lesson) => {
    const sideLabel = state.mode === "student" ? "Педагог" : "Группа";
    const sideValue = state.mode === "student" ? lesson.teacher || "Не назначен" : lesson.group;
    const card = document.createElement("article");
    card.className = "lesson-card";
    card.innerHTML = `
      <div class="lesson-badge">
        <span>Урок</span>
        <strong>${lesson.lesson}</strong>
        <small>${lesson.time}</small>
      </div>
      <div class="lesson-detail-grid">
        <div>
          <div class="lesson-detail-label">Пара</div>
          <div class="lesson-detail-value">${lesson.pair}</div>
        </div>
        <div>
          <div class="lesson-detail-label">Дисциплина</div>
          <div class="lesson-detail-value">${lesson.discipline}</div>
        </div>
        <div>
          <div class="lesson-detail-label">${sideLabel}</div>
          <div class="lesson-detail-value">${sideValue}</div>
        </div>
        <div>
          <div class="lesson-detail-label">Корпус</div>
          <div class="lesson-detail-value">${lesson.building}</div>
        </div>
      </div>
      <div>
        <div class="lesson-detail-label">Кабинет</div>
        <div class="lesson-detail-value">${lesson.room}</div>
      </div>
    `;
    target.append(card);
  });
}

function renderModalLessons(target) {
  const columns = ["№ Урока", "Время", "Пара", "Дисциплина", "Педагог", "Кабинет", "Корпус"];
  target.innerHTML = "";
  target.className = "modal-schedule-table";

  const header = document.createElement("div");
  header.className = "modal-schedule-row modal-schedule-head";
  header.innerHTML = columns.map((column) => `<div>${column}</div>`).join("");
  target.append(header);

  lessonsForSelection().forEach((lesson) => {
    const fields = [
      ["№ Урока", lesson.lesson],
      ["Время", lesson.time],
      ["Пара", lesson.pair],
      ["Дисциплина", lesson.discipline],
      ["Педагог", lesson.teacher || "Не назначен"],
      ["Кабинет", lesson.room],
      ["Корпус", lesson.building]
    ];
    const row = document.createElement("div");
    row.className = "modal-schedule-row";
    row.innerHTML = fields.map(([label, value]) => `<div data-label="${label}">${value}</div>`).join("");
    target.append(row);
  });
}

function setResultDate(dayTarget, monthTarget) {
  dayTarget.textContent = state.selectedDate.getDate();
  monthTarget.innerHTML = formatDateText(state.selectedDate);
}

function showMessage(text) {
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

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.message = text;
  toast.dataset.count = "1";
  toast.textContent = text;
  toastStack.append(toast);
  toast.removeTimer = window.setTimeout(() => toast.remove(), 3200);
}

function hideResult() {
  resultPanel.classList.add("hidden");
}

function showSchedule() {
  if (!state.selectedEntity) {
    showMessage(state.mode === "student" ? "Сначала выберите группу" : "Сначала выберите преподавателя");
    return;
  }

  if (state.output === "modal") {
    modalTitle.textContent = state.selectedEntity;
    setModalDateLine(state.selectedDate);
    renderModalLessons(modalLessonList);
    scheduleModal.showModal();
    return;
  }

  setResultDate(resultDay, resultMonth);
  renderLessons(lessonList);
  resultPanel.classList.remove("hidden");
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderColorButtons() {
  colorGrid.innerHTML = "";
  accentColors.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `color-dot${color === state.accent ? " active" : ""}`;
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

function roomData() {
  const names = state.building === "1"
    ? ["33 кб", "21 кб", "Лаб. 4", "Актовый зал", "12 кб", "Коворкинг", "44 кб", "31 кб"]
    : ["201", "214", "207", "305", "Лаб. 2", "301", "216", "220"];
  return names.map((room, index) => {
    const busy = (index + Number(state.pair) + Number(state.building)) % 3 !== 0;
    return {
      room,
      busy,
      group: groups[(index + Number(state.pair)) % groups.length],
      teacher: teachers[(index + Number(state.building)) % teachers.length],
      discipline: ["Базы данных", "Экономика", "Веб-разработка", "Иностранный язык"][index % 4]
    };
  });
}

function renderRooms() {
  roomCards.innerHTML = "";
  roomData().forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `room-card${item.busy ? " busy" : ""}`;
    card.innerHTML = `
      <div class="room-title">
        <strong>${item.room}</strong>
        <span class="status-dot"></span>
      </div>
      <div class="room-status">${item.busy ? "Занята" : "Свободна"}</div>
    `;
    card.addEventListener("click", () => showRoomDetail(item));
    roomCards.append(card);
  });
}

function showRoomDetail(item) {
  if (roomsModal.open) {
    roomsModal.close();
  }
  roomDetailTitle.textContent = `Аудитория ${item.room}`;
  roomDetailContent.className = "room-detail-content";
  roomDetailContent.innerHTML = item.busy
    ? `
      <p><strong>Статус:</strong> занята</p>
      <p><strong>Пара:</strong> ${lessonPairs[state.pair].label} (${lessonPairs[state.pair].lessons})</p>
      <p><strong>Группа:</strong> ${item.group}</p>
      <p><strong>Педагог:</strong> ${item.teacher}</p>
      <p><strong>Дисциплина:</strong> ${item.discipline}</p>
    `
    : `
      <p><strong>Статус:</strong> свободна</p>
      <p><strong>Пара:</strong> ${lessonPairs[state.pair].label} (${lessonPairs[state.pair].lessons})</p>
      <p>На выбранной паре аудитория свободна.</p>
    `;
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
  document.querySelectorAll("[data-building]").forEach((button) => {
    button.classList.toggle("active", state.building === button.dataset.building);
  });
  pairSelect.value = state.pair;
  modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === state.mode));
  document.querySelectorAll("[data-holiday]").forEach((button) => {
    button.classList.toggle("active", button.dataset.holiday === state.holidayMode);
  });
}

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
  renderRooms();
  roomsModal.showModal();
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

document.querySelectorAll("[data-building]").forEach((button) => {
  button.addEventListener("click", () => {
    state.building = button.dataset.building;
    applySettings();
    saveState();
    renderRooms();
  });
});

pairSelect.addEventListener("change", (event) => {
  state.pair = event.target.value;
  saveState();
  renderRooms();
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
  hideResult();
  saveState();
  renderCalendar();
});

nextWeek.addEventListener("click", () => {
  state.selectedDate.setDate(state.selectedDate.getDate() + 7);
  state.visibleDate = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
  hideResult();
  saveState();
  renderCalendar();
});

prevMonth.addEventListener("click", () => {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() - 1, 1);
  state.selectedDate = new Date(state.visibleDate);
  hideResult();
  saveState();
  renderCalendar();
});

nextMonth.addEventListener("click", () => {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() + 1, 1);
  state.selectedDate = new Date(state.visibleDate);
  hideResult();
  saveState();
  renderCalendar();
});

applySettings();
updateTrigger();
renderEntityOptions();
renderCalendar();
renderColorButtons();
renderRooms();
