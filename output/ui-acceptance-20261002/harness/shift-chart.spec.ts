import { expect, test, type Page } from "./ui-acceptance-fixture";
import { gameFixture, fullRosterFixture } from "../components/ShiftChart/testFixtures";

async function fixtures(
  page: Page,
  options: { fail?: boolean; live?: boolean; full?: boolean; overtime?: boolean; missing?: boolean; wait?: Promise<void> } = {},
) {
  let failed = false;
  const requests: string[] = [];
  await page.route("**/api/cors?**", async (route) => {
    const url = new URL(route.request().url()).searchParams.get("url") ?? "";
    requests.push(url);
    if (options.fail && !failed && url.includes("boxscore")) {
      failed = true;
      await route.fulfill({
        status: 502,
        json: { message: "Fixture upstream unavailable" },
      });
      return;
    }
    if (url.includes("/schedule/")) {
      const date = url.split("/").at(-1)!;
      const games =
        date === "2026-09-25"
          ? []
          : [2026010054, 2026010055].map((id) => ({
              id,
              gameState: "FINAL",
              homeTeam: { abbrev: "UTA" },
              awayTeam: { abbrev: "COL" },
            }));
      await route.fulfill({ json: { gameWeek: [{ date, games }] } });
      return;
    }
    await options.wait;
    const id = url.includes("2026010055") ? 2026010055 : 2026010054;
    const f = options.full ? fullRosterFixture(id, options.overtime) : gameFixture(id);
    if (options.missing) f.shifts.data = [];
    if (options.live) f.box.gameState = "LIVE";
    if (f.box.id === 2026010055) {
      f.box.homeTeam.abbrev = "BOS";
      f.box.homeTeam.placeName.default = "Boston";
      f.box.homeTeam.commonName.default = "Bruins";
    }
    await route.fulfill({
      json: url.includes("boxscore")
        ? f.box
        : url.includes("shiftcharts")
          ? f.shifts
          : f.pbp,
    });
  });
  return requests;
}

async function openGame(page: Page) {
  await page.goto("/shiftChart?gameId=2026010054");
  await expect(page.getByRole("slider", { name: "Replay time", exact: true })).toBeVisible();
  await expect(page.getByLabel("Select date")).toHaveValue("2026-09-26");
  await expect(page.getByLabel("Select game")).toBeEnabled();
}

test("deep links, cursor stats, active sorting, filters and playback share one data load", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = await fixtures(page);
  await openGame(page);
  expect(requests.filter((url) => !url.includes("/schedule/"))).toHaveLength(3);
  const slider = page.getByRole("slider", { name: "Replay time", exact: true });
  await slider.fill("20");
  await expect(page.getByTestId("score-68")).toHaveText("1");
  await expect(page.locator('tr[data-player-id="101"]')).toContainText("0:20");
  await slider.fill("30");
  await expect(
    page.locator('tbody[aria-label="UTA shifts"] tr[data-player-id]').first(),
  ).toHaveAttribute("data-player-id", "102");
  await page.getByLabel("Timeline players").selectOption("D");
  await expect(page.locator("tr[data-player-id]")).toHaveCount(2);
  const home = page.getByRole("group", { name: "Utah Mammoth positions" });
  await home.getByRole("button", { name: "Forwards" }).click();
  await expect(home.getByRole("button", { name: "Forwards" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page
      .getByRole("group", { name: "Colorado Avalanche positions" })
      .getByRole("button", { name: "All skaters" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Play replay" }).click();
  await expect.poll(() => slider.inputValue()).not.toBe("30");
  await page.getByRole("button", { name: "Pause replay" }).click();
  await page.getByRole("button", { name: "Skip forward 30 seconds" }).click();
  expect(Number(await slider.inputValue())).toBeGreaterThanOrEqual(60);
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("0");
  expect(requests.filter((url) => !url.includes("/schedule/"))).toHaveLength(3);
  expect(errors).toEqual([]);
});

test("game and date changes reset replay and expose empty dates", async ({
  page,
}) => {
  await fixtures(page);
  await openGame(page);
  await page.getByRole("slider", { name: "Replay time", exact: true }).fill("120");
  await page.getByLabel("Select game").selectOption("2026010055");
  await expect(page).toHaveURL(/gameId=2026010055/);
  await expect(
    page.getByRole("group", { name: "Boston Bruins positions" }),
  ).toBeVisible();
  await expect(page.getByRole("slider", { name: "Replay time", exact: true })).toHaveValue(
    "0",
  );
  await page.getByLabel("Select date").fill("2026-09-25");
  await expect(page.getByText("No games on this date.")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Replay time", exact: true })).toHaveCount(
    0,
  );
  await expect(page).not.toHaveURL(/gameId=/);
});

test("request errors can be retried", async ({ page }) => {
  await fixtures(page, { fail: true });
  await page.goto("/shiftChart?gameId=2026010054");
  await expect(
    page.getByRole("heading", { name: "Unable to load game" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Replay time", exact: true })).toBeVisible();
});

test("unfinished games explain replay availability", async ({ page }) => {
  await fixtures(page, { live: true });
  await page.goto("/shiftChart?gameId=2026010054");
  await expect(page.getByText(/Game status: LIVE/)).toBeVisible();
  await expect(page.getByLabel("Select date")).toHaveValue("2026-09-26");
  await expect(page.getByRole("slider", { name: "Replay time", exact: true })).toHaveCount(
    0,
  );
});

test("responsive layouts contain chart scrolling and support keyboard seeking with reduced motion", async ({
  page,
}) => {
  await fixtures(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openGame(page);
  for (const width of [1664, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page).toHaveTitle("Shift Chart | Five Hole Fantasy Hockey");
    await expect(page.getByRole("main", { name: "Shift Chart" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shift Chart", exact: true })).toBeVisible();
    await expect(page.locator('[class*="pageHeading"], [class*="timelineHint"]')).toHaveCount(0);
    await expect(page.getByLabel("Timeline players")).toHaveCSS("height", width >= 1200 ? "28px" : "32px");
    await expect(page.getByLabel("Select date")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/game-grid-fixture-${width}.png`,
      fullPage: true,
    });
  }
  const slider = page.getByRole("slider", { name: "Replay time", exact: true });
  await slider.focus();
  await page.keyboard.press("End");
  await expect(slider).toHaveValue("3600");
  await expect(page.locator('[aria-label="Scrollable shift chart"]')).toHaveCSS(
    "overflow-x",
    "auto",
  );
});


test("full rosters and overtime fit every desktop viewport without clipping", async ({ page }, testInfo) => {
  const requests = await fixtures(page, { full: true, overtime: true });
  await openGame(page);
  for (const [width, height] of [[1920, 1080], [1728, 900], [1708, 864], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator("tr[data-player-id]")).toHaveCount(40);
    await expect(page.locator("[data-matrix-size='18']")).toHaveCount(2);
    await expect(page.locator("[data-matrix-cell]")).toHaveCount(648);
    // Wait for container observers, then inspect drawing bounds as well as scroll sizes.
    await expect.poll(() => page.evaluate(() => {
      const chart = document.querySelector<HTMLElement>("[data-layout]")!;
      const elements = [...document.querySelectorAll<HTMLElement>("tr[data-player-id], [data-matrix-cell], [class*='leftPlayerName'], [class*='topPlayerName'] > div, [class*='periodLabels'], [class*='teamHeading'], footer")];
      const outside = elements.filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.top < 0 || rect.left < 0 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1;
      });
      const panels = [chart, ...document.querySelectorAll<HTMLElement>("[class*='matrixViewport'], [data-matrix-size]")];
      const overflow = panels.filter(el => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
      const rosters = [...document.querySelectorAll("tbody")].map(el => el.querySelectorAll("tr[data-player-id]").length);
      const rowsFit = [...document.querySelectorAll("tr[data-player-id]")].every(el => el.getBoundingClientRect().height >= 15 && el.getBoundingClientRect().bottom <= chart.getBoundingClientRect().bottom + 1);
      const squareCells = [...document.querySelectorAll("[data-matrix-cell]")].every(el => {
        const r = el.getBoundingClientRect(); return Math.abs(r.width - r.height) < 1 && r.height >= 12;
      });
      return { outside: outside.length, overflow: overflow.length, rosters, rowsFit, squareCells,
        documentFits: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight };
    })).toEqual({ outside: 0, overflow: 0, rosters: [20, 20], rowsFit: true, squareCells: true, documentFits: true });
    await page.screenshot({ path: testInfo.outputPath(`shift-chart-${width}.png`) });
  }
  await page.getByRole("slider", { name: "Replay time", exact: true }).fill("3700");
  await expect(page.getByLabel("Replay scoreboard")).toContainText("Overtime");
  for (const slider of await page.getByRole("slider").all()) await expect(slider).toHaveValue("3700");
  await page.getByRole("button", { name: "Skip back 30 seconds" }).click();
  await expect(page.getByRole("slider", { name: "Replay time", exact: true })).toHaveValue("3670");
  await page.getByLabel("Playback speed").selectOption("8");
  for (const mode of ["number", "total-toi", "pp-toi", "line-combination"]) await page.getByLabel("Linemate matrix mode").selectOption(mode);
  await expect(page.locator("[data-matrix-size='18']")).toHaveCount(2);
  const cell = page.locator("[data-matrix-cell]").last();
  await cell.hover();
  await expect(page.getByRole("tooltip")).toContainText("shared TOI");
  const bounds = await page.getByRole("tooltip").boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440);
  await page.locator("[data-matrix-cell]").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-matrix-cell]").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  expect(requests.filter(url => !url.includes("/schedule/"))).toHaveLength(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("tr[data-player-id]")).toHaveCount(40);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: testInfo.outputPath("shift-chart-mobile.png") });
});

test("loading and missing shifts stay in the page workspace", async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await fixtures(page, { wait, missing: true });
  await page.goto("/shiftChart?gameId=2026010054");
  await expect(page.getByText(/Loading game/)).toBeVisible();
  await expect(page.locator("tr[data-player-id]")).toHaveCount(0);
  release();
  await expect(page.getByText(/Shift data is not available/)).toBeVisible();
  await expect(page.locator("[data-matrix-cell]")).toHaveCount(0);
});


test("goal seeking and animated active rows preserve the dashboard", async ({ page }) => {
  await fixtures(page, { full: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openGame(page);
  await expect(page.getByRole("heading", { name: "Shift Chart", exact: true })).toBeVisible();
  await expect(page.locator("[data-goal-id]")).toHaveCount(1);
  await page.locator("[data-goal-id]").click();
  const slider = page.getByRole("slider", { name: "Replay time", exact: true });
  await expect(slider).toHaveValue("20");
  await page.evaluate(() => {
    const slider = document.querySelector<HTMLInputElement>('input[aria-label="Replay time"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(slider, "65");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect.poll(() => page.locator("tr[data-player-id]").evaluateAll(rows => rows.some(row => row.getAnimations().length > 0))).toBe(true);
  await expect.poll(() => page.locator("tr[data-player-id]").evaluateAll(rows => rows.every(row => row.getAnimations().length === 0))).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await slider.fill("0");
  expect(await page.locator("tr[data-player-id]").evaluateAll(rows => rows.flatMap(row => row.getAnimations()).length)).toBe(0);
  const homeColor = await page.locator('[data-team-side="home"] [class*="shift"][title]').first().evaluate(e => getComputedStyle(e).backgroundColor);
  const awayColor = await page.locator('[data-team-side="away"] [class*="shift"][title]').first().evaluate(e => getComputedStyle(e).backgroundColor);
  expect(homeColor).not.toBe(awayColor);
});
