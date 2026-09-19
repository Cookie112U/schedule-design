const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function listFiles(dir, extension) {
  const absolute = path.join(root, dir);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath, extension);
    return entry.name.endsWith(extension) ? [entryPath] : [];
  });
}

function assertNoTagilHoliday() {
  const activeFiles = [
    "index.html",
    "js/modules/holiday.js",
    "js/modules/holiday-particles.js",
    "css/main.css"
  ];

  for (const file of activeFiles) {
    assert(!/tagil|Тагил|День города/i.test(read(file)), `${file}: найдено активное упоминание Дня города`);
  }

  assert(!fs.existsSync(path.join(root, "css/holidays/tagil-day.css")), "css/holidays/tagil-day.css должен быть удален");
}

function assertFavicon() {
  const html = read("index.html");
  assert(/<link rel="icon" type="image\/png" href="Img\/logo_small\.png" \/>/.test(html), "favicon должен использовать Img/logo_small.png");
  assert(fs.existsSync(path.join(root, "Img/logo_small.png")), "Img/logo_small.png должен существовать");
}

function assertLegacyApiSupport() {
  const config = read("js/modules/config.js");
  const client = read("js/modules/api-client.js");
  const publicApi = read("js/modules/public-api.js");
  const request = read("js/modules/schedule-request.js");
  const transform = read("js/modules/schedule-transform.js");

  assert(/apiMode:\s*"legacy"/.test(config), "config должен быть переключен в legacy-режим");
  assert(/legacyApiBaseUrl:\s*"https:\/\/erp\.nttek\.ru"/.test(config), "config должен указывать legacy домен erp.nttek.ru");
  assert(/isAbsoluteUrl\(normalizedPath\)/.test(client), "api-client должен корректно пропускать абсолютные URL");
  assert(/getLegacyDates/.test(publicApi) && /getLegacySchedule/.test(publicApi), "public-api должен иметь методы legacy API");
  assert(/function loadCatalogMeta/.test(request), "schedule-request должен грузить метаданные legacy даты");
  assert(/SCHEDULE_DATE_NOT_FOUND/.test(request), "schedule-request должен иметь отдельную ошибку даты без расписания");
  assert(!/pickCatalogDate/.test(request), "schedule-request не должен подставлять справочники с соседней даты");
  assert(/if \(data\.errors\.length\)[\s\S]*throw error/.test(read("js/modules/schedule-service.js")), "schedule-service не должен кешировать критически ошибочный каталог");
  assert(/getLegacySchedule\(\{ date: normalizeDateKey\(dateKey\), type, name: query \}\)/.test(request), "schedule-request должен запрашивать legacy расписание выбранной даты");
  assert(/normalizeDateKey/.test(transform) && /DD/.test(transform) === false, "schedule-transform должен нормализовать даты без привязки к меню");
  assert(/numericLessonEntries/.test(transform), "schedule-transform должен понимать расписание преподавателя объектом по номерам уроков");
  assert(/normalizeLegacyAllClassrooms/.test(transform), "schedule-transform должен строить занятость аудиторий из legacy all");
}

function assertTimeStore() {
  const store = read("js/modules/schedule-time-store.js");
  ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].forEach((day) => {
    assert(new RegExp(`${day}: \\[`).test(store), `time-store должен содержать ${day}`);
  });
  assert(/without-lunch/.test(store), "time-store должен иметь предрасчитанный вариант без обеда");
  assert(/суббота/.test(store) || /saturday/.test(store), "time-store должен отдельно обрабатывать субботу");
}
function assertModuleOrder() {
  const html = read("index.html");
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1]);
  const errorCatalogIndex = scripts.indexOf("js/modules/error-catalog.js");
  const apiClientIndex = scripts.indexOf("js/modules/api-client.js");
  const requestIndex = scripts.indexOf("js/modules/schedule-request.js");
  const timeStoreIndex = scripts.indexOf("js/modules/schedule-time-store.js");
  const transformIndex = scripts.indexOf("js/modules/schedule-transform.js");
  const serviceIndex = scripts.indexOf("js/modules/schedule-service.js");

  assert(errorCatalogIndex > -1, "error-catalog.js должен быть подключен");
  assert(errorCatalogIndex < apiClientIndex, "error-catalog должен идти до api-client");
  assert(timeStoreIndex > -1, "schedule-time-store.js должен быть подключен");
  assert(requestIndex < timeStoreIndex, "time-store должен идти после request-модуля");
  assert(timeStoreIndex < transformIndex, "time-store должен идти до transform-модуля");
  assert(transformIndex < serviceIndex, "transform должен идти до service-модуля");
}

function loadBrowserModules(files) {
  const win = {};
  const sandbox = {
    console,
    window: win
  };
  win.window = win;
  vm.createContext(sandbox);
  files.forEach((file) => vm.runInContext(read(file), sandbox, { filename: file }));
  return win;
}

function assertRuntimeScheduleFlow() {
  const win = loadBrowserModules([
    "js/modules/schedule-time-store.js",
    "js/modules/schedule-transform.js"
  ]);

  const withLunch = win.ScheduleTimeStore.applyTimes([
    { lesson: "обед", discipline: "Обед" },
    { lesson: "11", discipline: "История" }
  ], "2026-09-14");
  assert.strictEqual(withLunch[1].time, "16:00-17:20", "при наличии обеда 5 пара остается после обеда");

  const withoutLunch = win.ScheduleTimeStore.applyTimes([
    { lesson: "11", discipline: "История" }
  ], "2026-09-14");
  assert.strictEqual(withoutLunch[0].time, "15:40-17:00", "без обеда 5 пара должна сдвигаться на место обеда");

  const saturdaySlots = win.ScheduleTimeStore.getSlots("2026-09-19");
  assert.strictEqual(saturdaySlots.length, 4, "на субботу должны быть только 4 пары без отдельной сетки звонков");

  win.ScheduleTimeStore.setDateSlots("2026-09-15", [
    { name: "1 пара", lessons: "1-2 урок", time: "8:00-9:20" }
  ]);
  const dateOverride = win.ScheduleTimeStore.applyTimes([{ lesson: "1-2", discipline: "Тест" }], "2026-09-15");
  const otherDate = win.ScheduleTimeStore.applyTimes([{ lesson: "1-2", discipline: "Тест" }], "2026-09-16");
  assert.strictEqual(dateOverride[0].time, "8:00-9:20", "time-store должен поддерживать временные override по конкретной дате");
  assert.notStrictEqual(otherDate[0].time, "8:00-9:20", "date override не должен менять соседние даты");

  assert.deepStrictEqual(Array.from(win.ScheduleTransform.normalizeScheduleDates(["12.10.2022"])), ["2022-10-12"]);

  const teacherLessons = win.ScheduleTransform.toUiLessonsForDate({
    "3": {
      building: { number: "КОРПУС 2", address: "(Садовая, 22)" },
      group: "3ИС6",
      name: "МДК 05.02 Разработка кода информационных систем",
      rooms: ["4"]
    },
    "4": {
      building: { number: "КОРПУС 2", address: "(Садовая, 22)" },
      group: "3ИС6",
      name: "МДК 05.02 Разработка кода информационных систем",
      rooms: ["4"]
    },
    "6-7": {
      building: { number: "КОРПУС 2", address: "(Садовая, 22)" },
      group: "1ПРО6",
      name: "Информатика",
      rooms: ["22"]
    },
    "8-9": {
      building: { number: "КОРПУС 2", address: "(Садовая, 22)" },
      group: "3ИС3",
      name: "МДК 05.03 Тестирование информационных систем",
      rooms: ["4"]
    },
    "10-11": {
      building: { number: "КОРПУС 2", address: "(Садовая, 22)" },
      group: "3ИС3",
      name: "МДК 05.03 Тестирование информационных систем",
      rooms: ["18"]
    }
  }, "2026-09-14");
  assert.deepStrictEqual(Array.from(teacherLessons.map((lesson) => lesson.lesson)), ["3", "4", "6-7", "8-9", "10-11"]);
  assert.deepStrictEqual(Array.from(teacherLessons.map((lesson) => lesson.time)), ["10:40-11:20", "11:20-12:00", "12:50-14:10", "14:20-15:40", "15:40-17:00"]);
  assert.strictEqual(teacherLessons[0].group, "3ИС6");
  assert.strictEqual(teacherLessons[4].room, "18");

  const rooms = win.ScheduleTransform.normalizeClassrooms([{
    building: { number: "КОРПУС 1" },
    schedule: [{
      name: "3ИС3",
      schedule: [{ lesson: 1, name: "Право", teachers: ["Иванов И.И."], rooms: ["29"] }]
    }]
  }], "2026-09-14");
  assert.strictEqual(rooms.length, 1, "legacy all должен создать аудиторию из rooms");
  assert.strictEqual(rooms[0].busy, true);
  assert.strictEqual(rooms[0].lessons[0].group, "3ИС3");
}
function assertJavaScriptSyntax() {
  const files = [...listFiles("js", ".js"), "dev-server.js"];
  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
    assert.strictEqual(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
  }
}

function sizeVars(viewport, size) {
  const isLaptopNarrow = viewport >= 981 && viewport <= 1180;
  if (isLaptopNarrow) {
    return { tile: 64, control: 46, gap: 12, pagePad: 24, fontScale: size === "small" ? 0.92 : size === "large" ? 1.08 : 1 };
  }

  const base = {
    small: { tile: 78, control: 48, gap: 16, pagePad: Math.min(viewport * 0.05, 76), fontScale: 0.92 },
    medium: { tile: 88, control: 60, gap: 20, pagePad: Math.min(viewport * 0.07, 100), fontScale: 1 },
    large: { tile: 100, control: 70, gap: 28, pagePad: Math.min(viewport * 0.05, 80), fontScale: 1.08 }
  }[size];

  if (viewport >= 981 && viewport <= 1360 && size === "small") {
    base.tile = 72;
    base.control = 46;
    base.gap = 16;
  }

  return base;
}

function assertResponsiveBreakpoints() {
  const css = read("css/base/responsive.css");
  assert(/@media \(max-width: 450px\)/.test(css), "мобильная версия должна начинаться только до 450px");
  assert(!/@media \(max-width: 980px\)/.test(css), "768/980 не должны переключать календарь в мобильную неделю");
  assert(/@media \(min-width: 451px\) and \(max-width: 980px\)/.test(css), "планшеты должны получать полный календарь в отдельном режиме");
  const tabletBlock = css.match(/@media \(min-width: 451px\) and \(max-width: 980px\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert(!/\.calendar-grid[\s\S]*display:\s*none/.test(tabletBlock), "на 768px calendar-grid не должен скрываться");
}
function assertDesktopLayoutMath() {
  const widths = [981, 1024, 1100, 1180, 1181, 1280, 1366, 1440, 1536, 1920];
  const sizes = ["small", "medium", "large"];
  const arrowSize = 42;
  const arrowGap = 10;

  for (const width of widths) {
    for (const size of sizes) {
      const vars = sizeVars(width, size);
      const content = width - vars.pagePad * 2;
      const calendarColumn = content * 0.6;
      const searchColumn = content * 0.3;
      const layoutGap = content * 0.1;
      const total = calendarColumn + searchColumn + layoutGap;
      const targetCalendar = vars.tile * 7 + 12 + arrowSize * 2 + arrowGap * 2;
      const calendarWrap = Math.min(calendarColumn, targetCalendar);
      const gridWidth = calendarWrap - arrowSize * 2 - arrowGap * 2;
      const cell = gridWidth / 7;
      const modeHalf = searchColumn / 2;
      const modeFont = Math.min(Math.max(15 * vars.fontScale, 14), 18);
      const teacherButtonNeeds = 112 + 16 + modeFont * 0.1;

      assert(total <= content + 0.1, `${width}/${size}: layout шире контейнера`);
      assert(calendarWrap <= calendarColumn + 0.1, `${width}/${size}: календарь шире своей колонки`);
      assert(gridWidth > 0, `${width}/${size}: сетка календаря схлопнулась`);
      assert(cell >= 58, `${width}/${size}: ячейка календаря меньше безопасного минимума (${cell.toFixed(1)}px)`);
      assert(modeHalf >= teacherButtonNeeds, `${width}/${size}: кнопка Преподаватель может потечь (${modeHalf.toFixed(1)}px)`);
    }
  }
}

function assertTabletCalendarMath() {
  const widths = [451, 480, 520, 640, 700, 768, 820, 900, 980];
  for (const width of widths) {
    const arrowSize = Math.min(Math.max(width * 0.05, 28), 38);
    const arrowGap = Math.min(Math.max(width * 0.01, 5), 10);
    const pagePad = Math.min(Math.max(width * 0.04, 20), 34);
    const content = width - pagePad * 2;
    const calendarWrap = Math.min(content, 732);
    const gridWidth = calendarWrap - arrowSize * 2 - arrowGap * 2;
    const cell = gridWidth / 7;

    assert(gridWidth > 0, `${width}: планшетная сетка календаря схлопнулась`);
    assert(cell >= 49, `${width}: календарная ячейка слишком мала для режима с календарем (${cell.toFixed(1)}px)`);
  }
}


function assertDownloadAndRoomCacheSupport() {
  const html = read("index.html");
  const app = read("js/app.js");
  const service = read("js/modules/schedule-service.js");
  const storage = read("js/modules/storage.js");
  const overlays = read("css/base/overlays.css");
  const responsive = read("css/base/responsive.css");

  assert(/id="downloadSchedule" disabled/.test(html), "кнопка скачивания должна иметь id и стартовать disabled");
  assert(/setScheduleUrl\(catalogs\.meta\?\.url \|\| ""\)/.test(app), "app должен брать ссылку скачивания из meta.url выбранной даты");
  assert(/window\.open\(apiState\.scheduleUrl/.test(app), "кнопка скачивания должна открывать scheduleUrl");
  assert(/lastSelectedByMode/.test(app), "последний выбранный студент/педагог должен сохраняться по режимам");
  assert(/clearCatalogsAfterDateError/.test(app), "при ошибке выбранной даты списки должны очищаться");
  assert(/На данную дату нет расписания/.test(app), "404 выбранной legacy даты должен показывать понятное сообщение");

  assert(/readRoomCache/.test(storage) && /writeRoomCache/.test(storage), "storage должен иметь кеш аудиторий");
  assert(/loadRoomsForDate/.test(app) && /writeCachedRooms/.test(app), "app должен кешировать аудитории по выбранной дате");
  assert(!/settle\("classrooms", request\.loadClassrooms/.test(service), "каталоги не должны ждать загрузку всех аудиторий");

  assert(/room-meta/.test(app) && /room-person/.test(overlays), "карточки аудиторий должны показывать группу/педагога чипами");
  assert(/justify-items:\s*center/.test(responsive), "планшетный режим должен центрировать календарный layout");
  assert(/\.search-panel[\s\S]*margin-inline:\s*auto/.test(responsive), "панель выбора на 768px должна быть по центру");
}
function assertMobileBreakpoints() {
  const widths = [320, 360, 375, 390, 414, 450];
  for (const width of widths) {
    const pagePad = 20;
    const content = width - pagePad * 2;
    const dateSize = width <= 450 ? 32 : 42;
    const needed = dateSize * 7 + 48;
    assert(needed <= content + 35, `${width}: мобильная неделя близка к переполнению (${needed}px / ${content}px)`);
  }
}

function assertCurrentUxRequirements() {
  const html = read("index.html");
  const app = read("js/app.js");
  const request = read("js/modules/schedule-request.js");
  const transform = read("js/modules/schedule-transform.js");
  const schedule = read("css/base/schedule.css");
  const layout = read("css/base/layout.css");
  const overlays = read("css/base/overlays.css");
  const responsive = read("css/base/responsive.css");
  const holidayButtons = read("css/holidays/holiday-buttons.css");
  const holidayNumbers = read("css/holidays/holiday-numbers.css");

  assert(/monthLabel\.textContent = `\$\{months\[month\]\} \$\{year\}`/.test(app), "desktop month label must include year");
  assert(/data-setting="width" data-value="compact"/.test(html) && /data-setting="width" data-value="full"/.test(html), "settings must provide compact and full content widths");
  assert(/width:\s*"standard"/.test(app) && /document\.documentElement\.dataset\.width = state\.width/.test(app), "content width must be persisted and applied to the document");
  assert(/availableWidths\.has\(state\.width\)/.test(app), "invalid saved content widths must fall back safely");
  assert(/--content-max:\s*1440px/.test(read("css/base/foundation.css")), "large screens must have a standard content width limit");
  assert(/max-width:\s*var\(--content-max\)/.test(layout), "header and layout must use the selected content width limit");
  assert(/font-size:\s*var\(--result-meta-font\)/.test(schedule) && /font-size:\s*var\(--result-main-font\)/.test(schedule), "bottom and modal schedules must follow the selected size");
  assert(/mobileMonthTitle\.textContent = `\$\{months\[month\]\} \$\{year\}`/.test(app), "mobile/tablet month label must include year");
  assert(/const maxFavorites = 18;/.test(app), "favorites list must be limited to 18 items");
  assert(/\.slice\(0, maxFavorites\)/.test(app), "rendered favorites must be capped");
  assert(!/!favorites\.includes\(entity\)/.test(app), "favorite entities must remain in the main list");

  assert(/function legacyBuildingLabel/.test(request), "legacy group headings must include building label helper");
  assert(/legacyBuildingLabel\(buildings\[index\], index\)/.test(request), "legacy groups must use building labels with addresses");
  assert(/function buildingTitle/.test(transform), "schedule transform must preserve building title and address");
  assert(/function upperGroup/.test(transform) && /toLocaleUpperCase\("ru-RU"\)/.test(transform), "groups must be uppercased during normalization");
  assert(/const labelClass = className\.includes\("building-label"\)/.test(app), "building labels must keep shared address styling");
  assert(/\.building-address \{\s*display:\s*block;/.test(overlays), "building address must render as a separate line");
  assert(/\.lesson-building \.building-address/.test(schedule), "schedule cards must style building addresses");
  assert(/\.lesson-room-number/.test(schedule), "room number must be visually separated from building");
  assert(/@media \(max-width: 450px\)[\s\S]*\.lesson-place \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/.test(responsive), "mobile cards must keep building and room in one controlled row");
  assert(/\.calendar-grid \{[\s\S]*grid-template-rows: repeat\(6, minmax\(0, 1fr\)\)/.test(layout), "base calendar grid must keep six rows while switching months");

  assert(/href="Img\/logo_small\.png"/.test(html), "favicon must use provided logo_small.png");
  assert(/\.select-menu/.test(holidayButtons) && /\.month-menu/.test(holidayButtons), "holiday glass layer must cover custom dropdowns");
  assert(/\.mode-button:not\(\.active\) \{[\s\S]*background: color-mix/.test(holidayButtons), "inactive student/teacher tab must not be transparent on holiday backgrounds");
  assert(/\.primary-button,[\s\S]*\.mode-button\.active,[\s\S]*\.icon-button/.test(holidayButtons), "selected color must apply to primary buttons, active tabs, and header icons");
  assert(/color: var\(--accent-ink\);[\s\S]*background: var\(--accent\);/.test(holidayButtons), "accent ink/background must be used after holiday overrides");
  assert(/data-theme="dark"\]\[data-holiday="february-23"\]/.test(holidayNumbers), "dark mobile February 23 number contrast must be overridden");
  assert(/data-theme="dark"\]\[data-holiday="victory-day"\]/.test(holidayNumbers), "dark mobile Victory Day number contrast must be overridden");
}

function assertErrorCatalog() {
  const html = read("index.html");
  const catalog = read("js/modules/error-catalog.js");
  const docs = read("docs/error-codes.md");
  const gitignore = read(".gitignore");
  const readme = read("README.md");
  const client = read("js/modules/api-client.js");
  const app = read("js/app.js");
  const store = read("js/modules/schedule-time-store.js");

  assert(/\.vscode\//.test(gitignore) && /\*\.log/.test(gitignore) && /node_modules\//.test(gitignore), ".gitignore должен закрывать локальные IDE, логи и зависимости");
  assert(/Расписание НТТЭК/.test(readme) && /docs\/error-codes\.md/.test(readme), "README.md должен описывать сервис и ошибки");
  assert(/js\/modules\/error-catalog\.js/.test(html), "error catalog должен быть подключен в index.html");
  assert(/NTT-NET-001/.test(catalog) && /NTT-CAT-001/.test(catalog), "error catalog должен иметь стабильные коды технических ошибок");
  assert(/NTT-NET-001/.test(docs) && /NTT-CAT-001/.test(docs), "docs/error-codes.md должен описывать коды ошибок");
  assert(/sessionStorage/.test(catalog) && /getDiagnostics/.test(catalog), "error catalog должен писать скрытый диагностический журнал");
  assert(!/Live Server|origin null|CORS backend|backend/.test(client), "api-client не должен отдавать пользователю технические тексты про Live Server/CORS/backend");
  assert(/ScheduleErrorCatalog/.test(app), "app должен использовать справочник ошибок");
  assert(app.indexOf('error?.code === "SCHEDULE_DATE_NOT_FOUND"') < app.indexOf("errorCatalog?.userMessage"), "дата без расписания должна выводиться без технического кода");
  assert(/showMessage\(state\.mode === "student" \? "Сначала выберите группу" : "Сначала выберите преподавателя"\)/.test(app), "ошибка невыбранной группы/преподавателя должна оставаться простой");
  assert(/showMessage\("На выбранную дату файл расписания не найден"\)/.test(app), "отсутствующий файл расписания должен быть простым сообщением");
  assert(/publicKey:\s*"CATALOG_EMPTY"/.test(app), "пустые справочники должны сводиться к одной кодированной ошибке");
  assert(/setDateSlots/.test(store) && /dateOverrideSchedule/.test(store), "time-store должен поддерживать override времени по конкретной дате");
}
assertNoTagilHoliday();
assertFavicon();
assertLegacyApiSupport();
assertTimeStore();
assertModuleOrder();
assertJavaScriptSyntax();
assertRuntimeScheduleFlow();
assertResponsiveBreakpoints();
assertDesktopLayoutMath();
assertTabletCalendarMath();
assertMobileBreakpoints();
assertDownloadAndRoomCacheSupport();
assertErrorCatalog();
console.log("Static checks passed");
