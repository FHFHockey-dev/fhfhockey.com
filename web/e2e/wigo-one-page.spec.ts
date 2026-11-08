import { expect, test, type Page } from "@playwright/test";
import { WIGO_STAT_ORDER } from "../components/WiGO/statMetadata";
import { installWigoFixtures, WIGO_FIXTURE_PLAYER_ID, type FixtureLogEntry } from "./fixtures/wigo/wigoFixtures";

// TJ's one-page WiGO dashboard (2026-10-25): at ≥1280×800 every component is on one screen with nothing scrolling,
// clipped or below 11px; narrower or shorter viewports flow the same panels and let the page scroll instead.
// All data is fictional (fixtures/wigo); no request leaves the local server.

const COVERAGE = Array.from({ length: 19 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`);
const PERIODS = ["STD", "LY", "CA", "3YA", "L5", "L10", "L20"];

async function installOfflineWigoFixtures(page: Page, options: Parameters<typeof installWigoFixtures>[1]) {
  await installWigoFixtures(page, options);
  // The shared fixtures permit public fonts; this suite stays entirely offline.
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => route.abort());
}

const browserDiagnostics = new WeakMap<Page, { pageErrors: string[]; consoleErrors: string[] }>();

test.beforeEach(async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  browserDiagnostics.set(page, { pageErrors, consoleErrors });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const diagnostics = browserDiagnostics.get(page);
  if (!diagnostics) return;
  await testInfo.attach("browser-diagnostics", {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: "application/json",
  });
  expect(diagnostics.pageErrors).toEqual([]);
});

async function open(page: Page, { player = true, longName = false, teamGameGaps = 0 } = {}) {
  const log: FixtureLogEntry[] = [];
  await installOfflineWigoFixtures(page, { longName, teamGameGaps, log: (entry) => log.push(entry) });
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
      // The band's wrapper is a deliberate side-scroller below 1280 (flow layout), so its width is exempt.
      overflowing: Array.from(root.querySelectorAll<HTMLElement>("*"))
        .filter((element) =>
          visible(element) && !ignored(element) && getComputedStyle(element).display !== "inline" &&
          ((element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX !== "auto") ||
            element.scrollHeight > element.clientHeight + 1))
        .map((element) => `${element.closest<HTMLElement>("[data-coverage]")?.dataset.coverage} ${element.className} "${(element.innerText ?? element.textContent ?? "").slice(0, 40)}"`),
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

for (const [width, height] of [[1280, 800], [1440, 900], [1440, 790], [1920, 1080]]) {
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
    // A wider selected-stat plot establishes the hierarchy; the full matrix
    // stays beneath the analytical workspace instead of hiding any panels.
    const selected = await page.locator('[data-coverage="C13"]').boundingBox();
    const toi = await page.locator('[data-coverage="C16"]').boundingBox();
    const matrix = await page.locator('[data-coverage="C12"]').boundingBox();
    expect(selected!.width).toBeGreaterThan(toi!.width * 1.5);
    expect(matrix!.y).toBeGreaterThanOrEqual(selected!.y + selected!.height);
    const ratings = page.locator('[data-coverage="C07"]');
    await expect(ratings.getByRole("heading", { name: "Player ratings", exact: true })).toHaveCount(1);
    await expect(ratings.getByRole("meter", { name: "Offense Even", exact: true })).toHaveCount(1);
    await expect(page.getByText("WiGO workflow")).toHaveCount(0);
    expect(log.filter((entry) => entry.kind === "blocked-write")).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`wigo-one-page-${width}x${height}.png`) });
  });
}

test("the comparison band shows 36 metric columns by period with a DIFF row, and drives the game log", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const matrix = page.locator('[data-coverage="C12"]');
  const table = matrix.locator("table");
  await expect(table).toHaveCount(1);
  // TJ's band (2026-11-01): a group row, one header per metric, periods as rows, DIFF last.
  expect(await table.locator('thead th[scope="colgroup"]').allTextContents()).toEqual(["Totals", "Per 60", "On-ice"]);
  await expect(table.locator('thead th[scope="col"]')).toHaveCount(1 + WIGO_STAT_ORDER.length);
  expect(await table.locator('tbody th > [aria-hidden="true"]').allTextContents()).toEqual(["STDL", "LY", "CAR", "3YA", "L5", "L10", "L20", "DIFF"]);
  const metrics = await table.locator("thead button").evaluateAll(buttons => buttons.map(button => button.getAttribute("data-metric")));
  expect(["GP", ...metrics].sort()).toEqual([...WIGO_STAT_ORDER].sort());
  // Per 60 drops "/60" in the header text; PTS1 sits under Per 60; names are full.
  await expect(table.getByRole("button", { name: "Primary points per 60", exact: true })).toHaveText("PTS1");
  const names = await table.locator("thead button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label")));
  expect(new Set(names).size).toBe(names.length);
  // Keyboard: Tab reaches one header button, arrows move focus without swapping the chart.
  const shots = table.getByRole("button", { name: "Shots per 60", exact: true });
  await shots.focus();
  await page.keyboard.press("ArrowRight");
  await expect(table.getByRole("button", { name: "Individual expected goals per 60", exact: true })).toBeFocused();
  await expect(shots).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator("#wigo-selected-stat h3")).toContainText("ixG/60");
  // DIFF has no decimal.
  for (const text of await table.locator("tbody tr").last().locator("td").allTextContents()) expect(text).not.toMatch(/\.\d%/);

  const selected = page.locator("#wigo-selected-stat");
  const before = await selected.boundingBox();
  for (const [metric, name] of [["Goals", "Goals"], ["ATOI", "Average time on ice"], ["S%", "Shooting percentage"], ["PPP/60", "Power-play points per 60 power-play minutes"]]) {
    await table.getByRole("button", { name, exact: true }).click();
    await expect(selected.locator("h3")).toContainText(metric);
    await expect(selected).not.toContainText("Couldn't load");
    expect(await selected.boundingBox()).toEqual(before);
  }
  await expect(page.getByRole("button", { name: /^Toggle .* reference$/ })).toHaveCount(PERIODS.length);
  // Counts are bars; rates are straight segments (no curve commands) and the
  // game mean sits in the title line, not over the marks (U7).
  await table.getByRole("button", { name: "Goals", exact: true }).click();
  await expect(selected.locator(".recharts-bar-rectangle").first()).toBeVisible();
  await expect(selected.locator("h3")).toContainText("Game mean:");
  await table.getByRole("button", { name: "Shots per 60", exact: true }).click();
  await expect(selected.locator(".recharts-line-curve")).toHaveCount(1);
  expect(await selected.locator(".recharts-line-curve").getAttribute("d")).not.toMatch(/C/);
  await expect(selected.locator(".recharts-reference-line text")).toHaveCount(0);

  await page.getByLabel("Select left timeframe for comparison").selectOption("L10");
  await expect(table.locator('tbody tr[data-left] th > [aria-hidden="true"]')).toHaveText("L10L");
  // The worst case, +999% in every DIFF cell, still fits without side-scrolling at 1280.
  await page.evaluate(() => {
    for (const cell of document.querySelectorAll('[data-coverage="C12"] tbody tr:last-child td')) cell.textContent = "+999%";
  });
  const band = matrix.locator('[class*="matrixBand"]');
  expect(await band.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect((await measure(page)).overflowing).toEqual([]);
});

test("the rate percentile slot holds two chips and sparse tiles on two filter lines at 1280×800", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const panel = page.locator('[data-coverage="C19"]');
  await expect(panel).toContainText("all skaters");
  // Worst case (E, proto2): a second chip, and every tile sparse, as for a player with no rows.
  await page.evaluate(() => {
    const chips = document.querySelector('[data-coverage="C19"] [class*="thresholdChips"]')!;
    const chip = chips.firstElementChild!.cloneNode(true) as HTMLElement;
    chip.firstChild!.textContent = "GP 7 below min 10";
    chips.appendChild(chip);
    for (const tile of document.querySelectorAll('[data-coverage="C19"] [class*="percentileTile"]')) {
      tile.querySelector("strong")!.textContent = "—";
      tile.querySelector("small")!.innerHTML = '<span class="visuallyHidden-test" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Rank unavailable</span>';
    }
  });
  await expect(panel.locator("meter")).toHaveCount(16);
  const title = await panel.locator("h3").boundingBox();
  const slider = await panel.locator("#gpSlider").boundingBox();
  expect(Math.abs(title!.y - slider!.y)).toBeLessThan(12);
  const result = await measure(page);
  expect(result.document).toEqual([1280, 800]);
  expect(result.overflowing.filter(entry => entry.startsWith("C19"))).toEqual([]);
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

test("a team-driver card at 95% coverage shows its N-of-M label and still fits 1280×800", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, { teamGameGaps: 4 });
  const drivers = page.locator('[data-coverage="C08 C09 C10 C11"]');
  await expect(drivers).toContainText("5v5: 78 of 82 games to");
  await expect(drivers).toContainText("Special teams: 78 of 82 games to");
  await expect(drivers).toContainText("Partial: covered games only");
  const result = await measure(page);
  expect(result.document).toEqual([1280, 800]);
  expect(result.outside).toEqual([]);
  expect(result.overflowing).toEqual([]);
});

test("every help note opens fully inside the 1280×800 screen and Escape closes it", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const buttons = page.locator('[class*="wigoDashboardContent"] [popovertarget]');
  await expect(buttons).toHaveCount(5);
  for (const button of await buttons.all()) {
    await button.click();
    const panel = page.locator(`[id="${await button.getAttribute("popovertarget")}"]`);
    await expect(panel).toBeVisible();
    const bounds = (await panel.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1280);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  }
});

test("the phone comparison tab shows the band with a pinned period column, jump buttons and every period and DIFF", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installOfflineWigoFixtures(page, {});
  await page.goto(`/wigoCharts?playerId=${WIGO_FIXTURE_PLAYER_ID}&tab=comparison`);
  const band = page.getByRole("region", { name: "Comparison band, scrolls sideways" });
  await expect(band).toBeVisible({ timeout: 60_000 });
  await expect(band).toHaveAttribute("tabindex", "0");
  expect(await band.locator('tbody th > [aria-hidden="true"]').allTextContents()).toEqual(["STDL", "LY", "CAR", "3YA", "L5", "L10", "L20", "DIFF"]);
  expect(await band.locator("tbody td").first().evaluate(cell => getComputedStyle(cell).fontSize)).toBe("13px");
  const pinned = band.locator("tbody th").first();
  const before = (await pinned.boundingBox())!;
  await page.getByRole("button", { name: "On-ice", exact: true }).click();
  const lastHeader = band.getByRole("button", { name: "Primary share of points", exact: true });
  await expect.poll(async () => (await lastHeader.boundingBox())!.x + (await lastHeader.boundingBox())!.width).toBeLessThanOrEqual(390);
  expect((await pinned.boundingBox())!.x).toBeCloseTo(before.x, 0);
  await expect(page.locator("#wigo-selected-stat")).toBeVisible();
});

for (const [width, height] of [[1024, 768], [1279, 800], [1280, 700]]) {
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
