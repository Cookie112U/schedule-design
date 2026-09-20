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
    "src/app.css"
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

function assertDownloadAndRoomCacheSupport() {
  const html = read("index.html");
  const app = read("js/app.js");
  const service = read("js/modules/schedule-service.js");
  const storage = read("js/modules/storage.js");
  const scheduleCss = read("src/components/schedule.css");

  assert(/id="downloadSchedule" disabled/.test(html), "кнопка скачивания должна иметь id и стартовать disabled");
  assert(/setScheduleUrl\(catalogs\.meta\?\.url \|\| ""\)/.test(app), "app должен брать ссылку скачивания из meta.url выбранной даты");
  assert(/window\.open\(apiState\.scheduleUrl/.test(app), "кнопка скачивания должна открывать scheduleUrl");
  assert(/lastSelectedByMode/.test(app), "последний выбранный студент/педагог должен сохраняться по режимам");
  assert(/clearCatalogsAfterDateError/.test(app), "при ошибке выбранной даты списки должны очищаться");
  assert(/На данную дату нет расписания/.test(app), "404 выбранной legacy даты должен показывать понятное сообщение");

  assert(/readRoomCache/.test(storage) && /writeRoomCache/.test(storage), "storage должен иметь кеш аудиторий");
  assert(/loadRoomsForDate/.test(app) && /writeCachedRooms/.test(app), "app должен кешировать аудитории по выбранной дате");
  assert(!/settle\("classrooms", request\.loadClassrooms/.test(service), "каталоги не должны ждать загрузку всех аудиторий");

  assert(/room-meta/.test(app) && /room-person/.test(scheduleCss), "карточки аудиторий должны показывать группу/педагога чипами");
}
function assertCurrentUxRequirements() {
  const html = read("index.html");
  const app = read("js/app.js");
  const request = read("js/modules/schedule-request.js");
  const transform = read("js/modules/schedule-transform.js");
  const theme = read("src/theme.css");
  const controls = read("src/components/controls.css");
  const schedule = read("src/components/schedule.css");
  const holidayButtons = read("css/holidays/holiday-buttons.css");
  const holidayNumbers = read("css/holidays/holiday-numbers.css");

  assert(/monthLabel\.textContent = `\$\{months\[month\]\} \$\{year\}`/.test(app), "desktop month label must include year");
  assert(/data-setting="width" data-value="compact"/.test(html) && /data-setting="width" data-value="full"/.test(html), "settings must provide compact and full content widths");
  assert(/width:\s*"standard"/.test(app) && /document\.documentElement\.dataset\.width = state\.width/.test(app), "content width must be persisted and applied to the document");
  assert(/availableWidths\.has\(state\.width\)/.test(app), "invalid saved content widths must fall back safely");
  assert(/--content-max:\s*90rem/.test(theme), "large screens must have a standard content width limit");
  assert(/max-w-\(--content-max\)/.test(html), "header and layout must use the selected content width limit");
  assert(/:root\[data-width="compact"\]/.test(theme) && /:root\[data-width="full"\]/.test(theme), "compact and full widths must override the content limit");
  assert(/:root\[data-size="small"\]/.test(theme) && /:root\[data-size="large"\]/.test(theme), "size setting must scale the root font size");
  assert(/mobileMonthTitle\.textContent = `\$\{months\[month\]\} \$\{year\}`/.test(app), "mobile/tablet month label must include year");
  assert(/const maxFavorites = 18;/.test(app), "favorites list must be limited to 18 items");
  assert(/\.slice\(0, maxFavorites\)/.test(app), "rendered favorites must be capped");
  assert(!/!favorites\.includes\(entity\)/.test(app), "favorite entities must remain in the main list");

  assert(/function legacyBuildingLabel/.test(request), "legacy group headings must include building label helper");
  assert(/legacyBuildingLabel\(buildings\[index\], index\)/.test(request), "legacy groups must use building labels with addresses");
  assert(/function buildingTitle/.test(transform), "schedule transform must preserve building title and address");
  assert(/function upperGroup/.test(transform) && /toLocaleUpperCase\("ru-RU"\)/.test(transform), "groups must be uppercased during normalization");
  assert(/const labelClass = className\.includes\("building-label"\)/.test(app), "building labels must keep shared address styling");
  assert(/\.building-address \{\s*@apply block/.test(controls), "building address must render as a separate line");
  assert(/\.lesson-building \.building-address/.test(schedule), "schedule cards must style building addresses");
  assert(/\.lesson-room-number/.test(schedule), "room number must be visually separated from building");
  assert(/\.lesson-place \{\s*@apply flex items-start justify-between/.test(schedule), "lesson cards must keep building and room in one controlled row");

  assert(/href="Img\/logo_small\.png"/.test(html), "favicon must use provided logo_small.png");
  assert(/--user-accent-ink/.test(holidayButtons) && /--user-accent\b/.test(holidayButtons), "selected color must apply to primary buttons, active tabs, and header icons");
  assert(!/var\(--accent(-ink)?\)/.test(holidayButtons), "holiday overrides must not use the removed --accent variable");
  assert(/data-theme="dark"\]\[data-holiday="february-23"\]/.test(holidayNumbers), "dark mobile February 23 number contrast must be overridden");
  assert(/data-theme="dark"\]\[data-holiday="victory-day"\]/.test(holidayNumbers), "dark mobile Victory Day number contrast must be overridden");
}

function assertTailwindSetup() {
  const pkg = JSON.parse(read("package.json"));
  const entry = read("src/app.css");
  const html = read("index.html");
  const theme = read("src/theme.css");

  assert(pkg.scripts && /tailwindcss -i \.\/src\/app\.css -o \.\/css\/app\.css/.test(pkg.scripts["css:build"]), "package.json должен собирать css/app.css из src/app.css");
  assert(pkg.devDependencies && pkg.devDependencies.tailwindcss && pkg.devDependencies["@tailwindcss/cli"], "Tailwind CSS и CLI должны быть в devDependencies");
  assert(/@import "tailwindcss"/.test(entry) && /@source "\.\.\/index\.html"/.test(entry) && /@source "\.\.\/js"/.test(entry), "src/app.css должен подключать Tailwind и явные источники классов");
  assert(/@custom-variant dark \(&:where\(\.dark, \.dark \*\)\)/.test(entry), "тёмная тема должна переключаться классом .dark, как на основном сайте");
  assert(/<link rel="stylesheet" href="css\/app\.css" \/>/.test(html), "index.html должен подключать собранный css/app.css");
  assert(!/css\/main\.css|css\/base\//.test(html), "index.html не должен ссылаться на старый CSS");
  assert(!fs.existsSync(path.join(root, "css/main.css")) && !fs.existsSync(path.join(root, "css/base")), "старый css/main.css и css/base должны быть удалены");
  assert(/Merriweather/.test(theme) && /Raleway/.test(theme) && /--color-primary-600:\s*#2451b8/.test(theme), "токены основного сайта (шрифты и палитра) должны быть на месте");
  assert(/fonts\.googleapis\.com\/css\?family=Merriweather/.test(html) && /fonts\.googleapis\.com\/css\?family=Raleway/.test(html), "index.html должен подключать шрифты основного сайта");
  assert(fs.statSync(path.join(root, "css/app.css")).size > 10000, "css/app.css не собран — выполните npm run css:build");
}

function assertMobileFirst() {
  const html = read("index.html");
  const calendar = read("src/components/calendar.css");
  const sources = listFiles("src", ".css").map((file) => read(file)).join("\n");

  assert(!/@media\s*\(\s*max-width/.test(sources), "в src/ не должно быть desktop-first @media (max-width)");
  assert(/\.calendar-grid \{\s*@apply hidden grid-cols-7 gap-1 sm:grid;/.test(calendar), "сетка месяца скрыта на телефоне и появляется с sm");
  assert(/\.week-date \{[^}]*sm:hidden/.test(calendar), "кружки дат недели показываются на телефоне и скрываются с sm");
  assert(/\.mobile-month \{[^}]*sm:hidden/.test(calendar), "переключатель недели показывается только на телефоне");
  assert(/grid-cols-\[minmax\(0,1fr\)\][^"]*lg:grid-cols-\[minmax\(0,1fr\)_23rem\]/.test(html), "макет: одна колонка на телефоне, две — от lg");
  assert(/<meta name="viewport" content="width=device-width, initial-scale=1\.0" \/>/.test(html), "viewport должен быть задан");
}

function assertUiClassesAreBuilt() {
  const built = read("css/app.css");
  const app = read("js/app.js");
  const html = read("index.html");
  const classes = [
    "primary-button", "secondary-button", "icon-button", "close-button", "select-trigger", "select-menu", "select-option",
    "select-option-main", "select-check", "favorite-button", "mode-toggle", "mode-button", "segment", "segmented", "radio-card",
    "radio-indicator", "native-select", "month-menu", "month-option", "day-cell", "week-date", "lesson-card", "lesson-number",
    "lesson-room-number", "room-card", "room-person", "modal", "modal-card", "toast", "color-dot", "holiday-option"
  ];
  classes.forEach((name) => assert(built.includes(`.${name}`), `css/app.css не содержит .${name} — выполните npm run css:build`));

  ["setting-pill", "modal-lesson-card", "renderModalLessons"].forEach((legacy) => {
    assert(!app.includes(legacy) && !html.includes(legacy), `не должно остаться старого ${legacy}`);
  });
  assert(/type="radio"[^>]*data-setting="theme"/.test(html), "настройки должны быть RadioGroup");
  assert(/addEventListener\("change"/.test(app) && /radio\.dataset\.setting/.test(app), "настройки должны сохранять события через change");
  assert(/--user-accent/.test(app) && /classList\.toggle\("dark"/.test(app), "app.js должен выставлять акцент и класс .dark");
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
assertTailwindSetup();
assertMobileFirst();
assertUiClassesAreBuilt();
assertDownloadAndRoomCacheSupport();
assertErrorCatalog();
console.log("Static checks passed");
