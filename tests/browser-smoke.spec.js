const { test, expect } = require("@playwright/test");

const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:5512";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function mockLegacySchedule(page, countOfChanges = 2) {
  const dateKey = todayKey();
  let teacherRequests = 0;
  await page.route("**/api/schedule/legacy", (route) => route.fulfill({ json: [dateKey] }));
  await page.route("**/api/schedule/legacy/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes("/teacher/")) {
      teacherRequests += 1;
      return route.fulfill({ json: {
        "3": {
          building: { number: "КОРПУС 2", address: "(Садовая, 22)" },
          group: "3ИС6",
          name: "Информатика",
          rooms: ["4"]
        }
      } });
    }
    return route.fulfill({ json: {
      date: dateKey,
      countOfChanges,
      lastChange: `${dateKey}T09:00:00Z`,
      url: "https://erp.nttek.ru/storage/test.xlsx",
      data: {
        buildings: [{ number: "КОРПУС 2", address: "(Садовая, 22)" }],
        groups: [[], ["3ИС6"]],
        teachers: [" Воинкова\u00a0 НА "]
      }
    } });
  });
  return { dateKey, teacherRequests: () => teacherRequests };
}

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 }
]) {
  test(`${viewport.name}: layout stays inside viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".calendar-panel")).toBeVisible();
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("teacher catalog keeps Воинкова and prefetched schedule opens locally", async ({ page }) => {
  const api = await mockLegacySchedule(page);
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator('[data-mode="teacher"]').click();
  await page.locator("#entityTrigger").click();
  await page.locator("#entitySearch").fill("Воинкова");
  const option = page.locator(".select-option-main", { hasText: "Воинкова НА" });
  await expect(option).toBeVisible({ timeout: 15000 });
  const prefetched = page.waitForResponse((response) => response.url().includes("/teacher/") && response.request().method() === "GET", { timeout: 15000 });
  await option.click();
  await prefetched;
  const startedAt = Date.now();
  await page.locator("#showSchedule").click();
  await expect(page.locator("#resultPanel:not(.hidden)")).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(500);
  expect(api.teacherRequests()).toBe(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#showSchedule")).toBeEnabled();
  const cachedStartedAt = Date.now();
  await page.locator("#showSchedule").click();
  await expect(page.locator("#resultPanel:not(.hidden)")).toBeVisible();
  expect(Date.now() - cachedStartedAt).toBeLessThan(300);
  expect(api.teacherRequests()).toBe(1);
});

test("increased countOfChanges shows a user notification", async ({ page }) => {
  const { dateKey } = await mockLegacySchedule(page, 2);

  await page.addInitScript(({ key }) => {
    localStorage.setItem("nttek-schedule-ui-v2:schedule-meta", JSON.stringify({
      [key]: { count: 1, lastChange: "" }
    }));
  }, { key: dateKey });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".toast", { hasText: "было изменено" })).toBeVisible({ timeout: 15000 });
});

test("cached catalogs survive a temporary API failure after reload", async ({ page }) => {
  await mockLegacySchedule(page);
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator('[data-mode="teacher"]').click();
  await page.locator("#entityTrigger").click();
  await page.locator("#entitySearch").fill("Воинкова");
  await page.locator(".select-option-main", { hasText: "Воинкова НА" }).click();

  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/api/schedule/legacy**", (route) => route.abort("failed"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#entityTrigger")).toContainText("Воинкова НА");
  await page.locator("#entityTrigger").click();
  await page.locator("#entitySearch").fill("Воинкова");
  await expect(page.locator(".select-option-main", { hasText: "Воинкова НА" })).toBeVisible();
});

test("Saturday rooms keep a multi-column layout and switch occupancy by lesson", async ({ page }) => {
  const dateKey = "2026-10-17";
  const meta = {
    date: "17.10.2026",
    countOfChanges: 1,
    lastChange: "2026-10-16T09:00:00Z",
    url: "https://erp.nttek.ru/storage/test.xlsx",
    data: {
      buildings: [{ number: "КОРПУС 1", address: "(Ленина, 2а)" }],
      groups: [["1ИС1"]],
      teachers: ["Иванов ИИ"]
    }
  };
  const saturday = [{
    building: meta.data.buildings[0],
    schedule: [
      { name: "1ИС1", schedule: [{ lesson: "1-2", name: "Тест", teachers: ["Иванов ИИ"], rooms: ["дистант"] }] },
      { name: "1ИС2", schedule: [{ lesson: "1-2", name: "Тест", teachers: ["Петров ПП"], rooms: ["дистант"] }] },
      { name: "1ИС3", schedule: [{ lesson: "1-2", name: "Тест", teachers: ["Сидоров СС"], rooms: ["дистант"] }] },
      { name: "1ИС4", schedule: [{ lesson: "3-4", name: "Тест", teachers: ["Иванов ИИ"], rooms: ["11"] }] },
      { name: "1ИС5", schedule: [{ lesson: "3-4", name: "Тест", teachers: ["Петров ПП"], rooms: ["дистант"] }] }
    ]
  }];

  await page.addInitScript(({ date }) => {
    localStorage.setItem("nttek-schedule-ui-v2", JSON.stringify({ selectedDate: date, visibleDate: date }));
  }, { date: dateKey });
  await page.route("**/api/schedule/legacy**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith(`/${dateKey}/all`)) return route.fulfill({ json: saturday });
    if (pathname.endsWith(`/${dateKey}`)) return route.fulfill({ json: meta });
    return route.fulfill({ json: [dateKey] });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator("#roomsButton").click();
  await expect(page.locator("#roomCards .room-card")).toHaveCount(3);
  await expect(page.locator("#roomCards .room-card", { hasText: "дистант" })).toHaveCount(3);
  await expect(page.locator("#roomCards .room-status", { hasText: "Свободна" })).toHaveCount(0);

  const columns = await page.locator("#roomCards .room-card").evaluateAll((cards) =>
    new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size
  );
  expect(columns).toBeGreaterThanOrEqual(2);

  await page.locator("#pairSelect").selectOption({ index: 1 });
  await expect(page.locator("#roomCards .room-card.busy")).toHaveCount(2);
  await expect(page.locator("#roomCards .room-card", { hasText: "11" })).toHaveCount(1);
  await expect(page.locator("#roomCards .room-card", { hasText: "дистант" })).toHaveCount(1);
});

test("saved theme and holiday are applied before app initialization", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("nttek-schedule-ui-v2", JSON.stringify({ theme: "dark", holidayMode: "new-year" }));
  });
  await page.route("**/js/app.js*", (route) => route.abort("failed"));
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-holiday", "new-year");
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".app")).toHaveAttribute("data-holiday", "new-year");
  await expect(page.locator("body")).toBeVisible();
});

test("all settings radio groups remain interactive", async ({ page }) => {
  await mockLegacySchedule(page);
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator("#settingsButton").click();
  const settings = page.locator("#settingsModal");
  await expect(settings).toBeVisible();

  const choices = [
    ["theme", "dark", "theme"],
    ["size", "small", "size"],
    ["width", "compact", "width"],
    ["output", "modal", "output"],
    ["favoriteSide", "left", "favoriteSide"],
    ["mobileCalendarView", "month", "mobileCalendarView"]
  ];

  for (const [name, value, stateKey] of choices) {
    const radio = settings.locator(`input[name="${name}"][data-value="${value}"]`);
    await radio.locator("..").click();
    await expect(radio).toBeChecked();
    const savedValue = await page.evaluate((key) => JSON.parse(localStorage.getItem("nttek-schedule-ui-v2") || "{}")[key], stateKey);
    expect(savedValue).toBe(value);
  }

  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".app")).toHaveAttribute("data-size", "small");
  await expect(page.locator(".app")).toHaveAttribute("data-width", "compact");
  await expect(page.locator(".app")).toHaveAttribute("data-favorite-side", "left");
  await expect(page.locator(".app")).toHaveAttribute("data-mobile-calendar-view", "month");
});

test("every holiday theme renders in light and dark modes", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "visual matrix runs once; browser compatibility is covered separately");
  await mockLegacySchedule(page);
  const holidays = ["none", "new-year", "russia-day", "easter", "september", "march-8", "february-23", "victory-day"];
  for (const theme of ["light", "dark"]) {
    for (const holidayMode of holidays) {
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await page.evaluate(({ theme, holidayMode }) => {
        const current = JSON.parse(localStorage.getItem("nttek-schedule-ui-v2") || "{}");
        localStorage.setItem("nttek-schedule-ui-v2", JSON.stringify({ ...current, theme, holidayMode }));
      }, { theme, holidayMode });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".app")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".app")).toHaveAttribute("data-holiday", holidayMode);
      const visual = await page.evaluate(() => {
        const app = document.querySelector(".app");
        const calendar = document.querySelector(".calendar-panel");
        const search = document.querySelector(".search-panel");
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          appHeight: app.getBoundingClientRect().height,
          calendarWidth: calendar.getBoundingClientRect().width,
          searchWidth: search.getBoundingClientRect().width,
          background: getComputedStyle(document.body).backgroundColor
        };
      });
      expect(visual.overflow).toBeLessThanOrEqual(1);
      expect(visual.appHeight).toBeGreaterThan(500);
      expect(visual.calendarWidth).toBeGreaterThan(250);
      expect(visual.searchWidth).toBeGreaterThan(200);
      expect(visual.background).not.toBe("rgba(0, 0, 0, 0)");
    }
  }

  await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem("nttek-schedule-ui-v2") || "{}");
    localStorage.setItem("nttek-schedule-ui-v2", JSON.stringify({ ...current, holidayMode: "auto" }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const automaticHoliday = await page.evaluate(() => window.ScheduleHoliday.autoHoliday(new Date()));
  await expect(page.locator(".app")).toHaveAttribute("data-holiday", automaticHoliday);
});
