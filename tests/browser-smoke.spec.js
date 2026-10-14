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
  await expect(page.locator("html")).toHaveClass(/ui-ready/);
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
  await expect(page.locator("html")).toHaveClass(/ui-ready/);
  await expect(page.locator("#entityTrigger")).toContainText("Воинкова НА");
  await page.locator("#entityTrigger").click();
  await page.locator("#entitySearch").fill("Воинкова");
  await expect(page.locator(".select-option-main", { hasText: "Воинкова НА" })).toBeVisible();
});

test("first paint stays hidden until the saved dark theme is ready", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("nttek-schedule-ui-v2", JSON.stringify({ theme: "dark", holidayMode: "new-year" }));
  });
  await page.route("**/css/app.css*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });

  const navigation = page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(80);
  const earlyPaint = await page.evaluate(() => ({
    ready: document.documentElement.classList.contains("ui-ready"),
    background: getComputedStyle(document.documentElement).backgroundColor,
    bodyVisibility: document.body ? getComputedStyle(document.body).visibility : "hidden"
  }));
  expect(earlyPaint.ready).toBeFalsy();
  expect(earlyPaint.bodyVisibility).toBe("hidden");
  expect(earlyPaint.background).not.toBe("rgb(255, 255, 255)");
  await navigation;
  await expect(page.locator("html")).toHaveClass(/ui-ready/);
});
