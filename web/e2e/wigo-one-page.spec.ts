import { expect, test, type Page } from "@playwright/test";
import { WIGO_STAT_ORDER } from "../components/WiGO/statMetadata";
import { installWigoFixtures, WIGO_FIXTURE_PLAYER_ID, type FixtureLogEntry } from "./fixtures/wigo/wigoFixtures";

// TJ's one-page WiGO dashboard (2026-10-25): at ≥1280×800 every component is on one screen with nothing scrolling,
// clipped or below 11px; narrower or shorter viewports flow the same panels and let the page scroll instead.
// All data is fictional (fixtures/wigo); no request leaves the local server.

const COVERAGE = Array.from({ length: 19 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`);
const PERIODS = ["STD", "LY", "CA", "3YA", "L5", "L10", "L20"];

async function open(page: Page, { player = true, longName = false } = {}) {
  const log: FixtureLogEntry[] = [];
  await installWigoFixtures(page, { longName, log: (entry) => log.push(entry) });
  await page.goto(player ? `/wigoCharts?playerId=${WIGO_FIXTURE_PLAYER_ID}` : "/wigoCharts");
  if (player) {
    await expect(page.locator('[data-coverage="C19"] meter')).toHaveCount(16, { timeout: 60_000 });
    await expect(page.locator('[data-coverage="C14"]')).toContainText("GP", { timeout: 60_000 });
    await expect(page.locator('[data-coverage="C08 C09 C10 C11"] article')).toHaveCount(4, { timeout: 60_000 });
  } else {
    await expect(page.locator('[data-coverage="C12"]')).toBeVisible({ timeout: 60_000 });
  }
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  return log;
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('[class*="wigoDashboardContent"]')!;
    const visible = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0;
    };
    const ignored = (element: Element) =>
      String(element.className).includes("visuallyHidden") || !!element.closest("details:not([open])");
    const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-coverage]")).filter(visible);
    return {
      document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      coverage: panels.flatMap((element) => element.dataset.coverage!.split(" ")),
      outside: panels
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < -1 || bounds.top < -1 || bounds.right > innerWidth + 1 || bounds.bottom > innerHeight + 1;
        })
        .map((element) => element.dataset.coverage),
      overflowing: Array.from(root.querySelectorAll<HTMLElement>("*"))
        .filter((element) =>
          visible(element) && !ignored(element) && getComputedStyle(element).display !== "inline" &&
          (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1))
        .map((element) => `${element.closest<HTMLElement>("[data-coverage]")?.dataset.coverage} ${element.className} "${element.innerText.slice(0, 40)}"`),
      clippedCells: Array.from(root.querySelectorAll("th, td"))
        .filter((cell) => {
          const bounds = cell.getBoundingClientRect();
          const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            if (!node.textContent?.trim() || ignored(node.parentElement!)) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            const text = range.getBoundingClientRect();
            if (text.left < bounds.left - 1 || text.right > bounds.right + 1 || text.top < bounds.top - 1 || text.bottom > bounds.bottom + 1) return true;
          }
          return false;
        })
        .map((cell) => cell.textContent),
      smallText: Array.from(root.querySelectorAll<HTMLElement>("*"))
        .filter((element) =>
          visible(element) && !ignored(element) &&
          Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) &&
          parseFloat(getComputedStyle(element).fontSize) < 11)
        .map((element) => `${element.textContent?.slice(0, 30)} ${getComputedStyle(element).fontSize}`)
    };
  });
}

for (const [width, height] of [[1280, 800], [1440, 900], [1920, 1080]]) {
  test(`every WiGO component fits one ${width}×${height} screen`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height });
    const log = await open(page);
    const result = await measure(page);
    expect(result.document, JSON.stringify(result)).toEqual([width, height]);
    for (const id of COVERAGE) expect(result.coverage).toContain(id);
    expect(result.outside).toEqual([]);
    expect(result.overflowing).toEqual([]);
    expect(result.clippedCells).toEqual([]);
    expect(result.smallText).toEqual([]);
    await expect(page.getByText("WiGO workflow")).toHaveCount(0);
    expect(log.filter((entry) => entry.kind === "blocked-write")).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`wigo-one-page-${width}x${height}.png`) });
  });
}

test("the comparison matrix shows all 36 metrics in two transposed halves and drives the game log", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const matrix = page.locator('[data-coverage="C12"]');
  const tables = matrix.locator("table");
  await expect(tables).toHaveCount(2);
  const labels: string[] = [];
  for (const table of await tables.all()) {
    await expect(table.locator("thead th")).toHaveCount(9);
    await expect(table.locator("tbody tr")).toHaveCount(18);
    labels.push(...(await table.getByRole("rowheader").allTextContents()));
  }
  expect([...labels].sort()).toEqual([...WIGO_STAT_ORDER].sort());
  expect(await tables.first().locator("thead th").allTextContents()).toEqual(["Totals", "STDL", "LY", "CAR", "3YA", "L5", "L10", "L20", "DIFF"]);
  await expect(matrix.getByRole("button", { name: "Show GP game log", exact: true })).toHaveCount(0);

  const selected = page.locator("#wigo-selected-stat");
  const before = await selected.boundingBox();
  for (const metric of ["Goals", "ATOI", "S%", "PPP/60"]) {
    await matrix.getByRole("button", { name: `Show ${metric} game log`, exact: true }).click();
    await expect(selected.locator("h3")).toContainText(metric);
    await expect(selected).not.toContainText("Failed to load");
    expect(await selected.boundingBox()).toEqual(before);
  }
  await expect(page.getByRole("button", { name: /^Toggle .* reference$/ })).toHaveCount(PERIODS.length);

  await page.getByLabel("Select left timeframe for comparison").selectOption("L10");
  await expect(tables.first().locator('thead th[data-left]')).toHaveText("L10L");
  await expect(tables.first().locator("tbody tr").first().locator("td[data-left]")).toHaveCount(1);
  expect((await measure(page)).overflowing).toEqual([]);
});

test("a long name and the no-player state stay on one 1280×800 screen", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, { longName: true });
  await expect(page.locator('[data-coverage="C02 C03"]')).toContainText("Beauvillier-Johnson", { ignoreCase: true });
  let result = await measure(page);
  expect(result.document).toEqual([1280, 800]);
  expect(result.overflowing).toEqual([]);

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page).not.toHaveURL(/playerId=/);
  // Clear refocuses search; its transient status line floats over the page like the results list.
  await expect(page.locator('[data-coverage="C01"]').getByText("Loading...", { exact: true })).toHaveCount(0);
  result = await measure(page);
  expect(result.document).toEqual([1280, 800]);
  expect(result.outside).toEqual([]);
  expect(result.overflowing).toEqual([]);
});

for (const [width, height] of [[1024, 768], [1280, 700]]) {
  test(`${width}×${height} flows every panel without clipping instead of fitting one screen`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height });
    await open(page);
    const result = await measure(page);
    for (const id of COVERAGE) expect(result.coverage).toContain(id);
    expect(result.document[0]).toBe(width);
    expect(result.document[1]).toBeGreaterThan(height);
    expect(result.overflowing).toEqual([]);
    expect(result.clippedCells).toEqual([]);
    expect(result.smallText).toEqual([]);
  });
}
