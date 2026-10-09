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

test("diagnose desktop matrix minimum sizes without changing application source", async ({ page }, testInfo) => {
  const requests = await fixtures(page, { full: true, overtime: true });
  await openGame(page);
  for (const [width, height] of [[1920, 1080], [1728, 900], [1708, 864], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator("tr[data-player-id]")).toHaveCount(40);
    await expect(page.locator("[data-matrix-size='18']")).toHaveCount(2);
    await expect(page.locator("[data-matrix-cell]")).toHaveCount(648);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), {timeout:5000}).toBe(true).catch(()=>{});
    await page.waitForTimeout(300);
    const fit = await page.evaluate(() => {
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
      const cells=[...document.querySelectorAll("[data-matrix-cell]")].map(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height}});
      return { outside: outside.length, overflow: overflow.length, rosters, rowsFit, squareCells, minimumCellWidth:Math.min(...cells.map(c=>c.w)),minimumCellHeight:Math.min(...cells.map(c=>c.h)),maximumSquareDifference:Math.max(...cells.map(c=>Math.abs(c.w-c.h))),layout:chart.dataset.layout,
        documentFits: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight };
    });
    const fs = await import("node:fs"); fs.writeFileSync(testInfo.outputPath(`fit-${width}.json`),JSON.stringify({width,height,...fit},null,2));
    console.log(JSON.stringify({width,height,...fit}));
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
