import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildScheduleSnapshot, calendarWeekStart, selectScheduleDates, weekDates } from "../lib/socialShare/schedule";
import type { SocialScheduleGame as GameData } from "../lib/socialShare/types";
import type { SocialShareFormat, SocialShareSnapshot } from "../lib/socialShare/types";

const evidence = process.env.SOCIAL_SHARE_EVIDENCE_DIR || "/tmp/fhf-social-card-readiness-evidence-20261008";
const upcomingWeek = calendarWeekStart(new Date(Date.now() + 7 * 86400000).toISOString());
type Mode = "ready" | "partial" | "stale" | "zero";
test.beforeEach(({ page }) => page.setDefaultTimeout(10000));

// Fictional public schedule mechanics, deliberately separate from live NHL evidence.
function fixture(format: SocialShareFormat, weekStart: string, mode: Mode): SocialShareSnapshot {
  const dates = weekDates(weekStart), generatedAt = new Date().toISOString();
  const year = Number(weekStart.slice(0, 4)) - (Number(weekStart.slice(5, 7)) < 8 ? 1 : 0);
  const pairs = [[0, 1, 2], [0, 10, 8], [1, 3, 1], [2, 2, 4], [3, 1, 2], [4, 1, 3], [6, 2, 3]];
  const abbreviations: Record<number, string> = { 1: "NJD", 2: "NYI", 3: "NYR", 4: "PHI", 8: "MTL", 10: "TOR" };
  const games: GameData[] = mode === "zero" ? [] : pairs.map(([day, home, away], i) => ({
    id: year * 1000000 + 20000 + i, season: year * 10000 + year + 1, gameType: 2,
    gameDate: dates[day], startTimeUTC: `${dates[day]}T23:00:00Z`, gameState: "FUT", gameScheduleState: "OK",
    homeTeam: { id: home, abbrev: abbreviations[home] }, awayTeam: { id: away, abbrev: abbreviations[away] },
  }));
  return structuredClone(buildScheduleSnapshot({ format, weekStart, generatedAt, schedule: {
    data: {}, games, fetchedAt: mode === "stale" ? new Date(Date.parse(generatedAt) - 7 * 3600000).toISOString() : generatedAt,
    coveredDates: mode === "partial" ? dates.slice(1) : dates,
    numGamesPerDay: dates.map(date => games.filter(game => game.gameDate === date).length),
  } }));
}

async function install(page: Page) {
  const controller = { requests: 0, fail: false, mode: "ready" as Mode, longName: false, latest: null as SocialShareSnapshot | null };
  await page.context().route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route("**/api/v1/social-share/**", async route => {
    controller.requests++;
    if (controller.fail) return route.fulfill({ status: 503, json: { error: "NHL schedule is unavailable. Refresh to retry." } });
    const url = new URL(route.request().url());
    let next = fixture(url.pathname.split("/").pop() as SocialShareFormat, url.searchParams.get("weekStart")!, controller.mode);
    if (url.searchParams.has("selectedDates")) next = selectScheduleDates(next, url.searchParams.get("selectedDates")?.split(",").filter(Boolean) || []);
    if (controller.longName) {
      for (const row of next.rows) if (row.team.id === 1) row.team.name = "New Jersey Extremely Long Fantasy Hockey Team Name";
      for (const team of next.teams) if (team.id === 1) team.name = "New Jersey Extremely Long Fantasy Hockey Team Name";
    }
    controller.latest = next;
    return route.fulfill({ json: next, headers: { "Cache-Control": "no-store" } });
  });
  return controller;
}

async function open(page: Page, format = "game-grid") {
  const response = await page.goto(`/social-share/${format}`);
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.getByRole("button", { name: "Refresh schedule", exact: true })).toBeEnabled();
  await page.getByLabel("Week of (Monday)").fill(upcomingWeek);
  await expect(page.getByRole("button", { name: "Refresh schedule", exact: true })).toBeEnabled();
}

async function downloadedPng(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const download = await pending;
  await download.saveAs(`${evidence}/${name}.png`);
  expect(await download.failure()).toBeNull();
  const bytes = await readFile(`${evidence}/${name}.png`);
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1080]);
  return bytes;
}

test("default summary, recalculated dates and actual PNG match one frozen edition", async ({ page }) => {
  const source = await install(page), errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await open(page);
  const square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  await expect(page.getByRole("region", { name: "Complete ranked schedule" }).locator("ol > li")).toHaveCount(32);
  await expect(square).toContainText("SCHEDULE ONLY");
  await expect(square).not.toContainText("Refresh schedule");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const requests = source.requests, before = await square.innerText();
  await page.getByRole("button", { name: /^Mon /i }).click();
  await expect(square).not.toHaveText(before, { useInnerText: true });
  const selected = await square.innerText();
  expect(source.requests).toBe(requests);
  expect(selected).not.toBe(before);
  await page.getByRole("button", { name: "All days", exact: true }).click();
  await expect(square).toHaveText(before, { useInnerText: true });
  const png = await downloadedPng(page, "default-fixture");
  expect(source.requests).toBe(requests);
  expect(await square.innerText()).toBe(before);
  await page.screenshot({ path: `${evidence}/fixture-desktop.png`, fullPage: true });
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 1440, height: 1400 });
  const isolation = await page.addStyleTag({ content: 'body * { visibility: hidden !important; } [data-testid="share-square"], [data-testid="share-square"] * { visibility: visible !important; }' });
  const saved = await square.evaluate(node => {
    const parent = node.parentElement!;
    const previous = { node: node.getAttribute("style"), parent: parent.getAttribute("style") };
    node.style.transform = "none"; node.style.position = "fixed"; node.style.left = "0"; node.style.top = "0"; node.style.zIndex = "2147483647";
    parent.style.overflow = "visible"; parent.style.maxWidth = "1080px"; parent.style.width = "1080px"; parent.style.height = "1080px";
    return previous;
  });
  const preview = await square.screenshot({ path: `${evidence}/default-fixture-preview.png` });
  await square.evaluate((node, saved) => {
    for (const [target, value] of [[node, saved.node], [node.parentElement!, saved.parent]] as const) {
      if (value === null) target.removeAttribute("style"); else target.setAttribute("style", value);
    }
  }, saved);
  await isolation.evaluate(node => node.parentNode?.removeChild(node));
  await page.setViewportSize(viewport);
  const differentPixels = await page.evaluate(async ({ exported, preview }) => {
    async function pixels(base64: string) {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1080;
      const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, 1080, 1080).data;
    }
    const a = await pixels(exported), b = await pixels(preview);
    // Chromium's DOM and foreignObject rasterizers differ at glyph edges.
    // Tolerate at most one pixel locally, in both directions; content/layout gaps still fail.
    function mismatches(first: Uint8ClampedArray, second: Uint8ClampedArray) {
      let different = 0;
      for (let y = 0; y < 1080; y++) for (let x = 0; x < 1080; x++) {
        const i = (y * 1080 + x) * 4;
        const delta = (j: number) => Math.max(Math.abs(first[i] - second[j]), Math.abs(first[i + 1] - second[j + 1]), Math.abs(first[i + 2] - second[j + 2]));
        if (delta(i) <= 12) continue;
        let matched = false;
        for (let dy = -1; dy <= 1 && !matched; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (x + dx >= 0 && x + dx < 1080 && y + dy >= 0 && y + dy < 1080 && delta(((y + dy) * 1080 + x + dx) * 4) <= 12) { matched = true; break; }
        }
        if (!matched) different++;
      }
      return different / (1080 * 1080);
    }
    return Math.max(mismatches(a, b), mismatches(b, a));
  }, { exported: png.toString("base64"), preview: preview.toString("base64") });
  await writeFile(`${evidence}/fixture-fidelity.json`, JSON.stringify({ differentPixels, localRasterTolerancePx: 1, channelTolerance: 12, snapshotId: source.latest!.id, source: "fictional fixture" }, null, 2));
  expect(differentPixels).toBeLessThan(0.02);
  expect(errors).toEqual([]);
});

test("Wednesday excludes Wednesday; mobile controls and detail PNG preserve selected games", async ({ page }) => {
  const source = await install(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page, "remaining-week");
  for (const day of ["Mon", "Tue", "Wed"]) await expect(page.getByRole("button", { name: new RegExp(`^${day} `, "i") })).toHaveAttribute("aria-pressed", "false");
  for (const day of ["Thu", "Fri", "Sat", "Sun"]) await expect(page.getByRole("button", { name: new RegExp(`^${day} `, "i") })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Default: Monday, Tuesday and Wednesday OFF/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("combobox", { name: /^Graphic/ }).selectOption("1");
  await expect(page.getByTestId("share-square")).toContainText("New Jersey Devils");
  await downloadedPng(page, "team-fixture");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("share-square").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/fixture-mobile.png` });
  const requests = source.requests;
  await page.getByRole("button", { name: "None", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
  await expect(page.getByText("No days selected. Choose days to compare schedule opportunities.")).toBeVisible();
  expect(source.requests).toBe(requests);
  await page.getByRole("button", { name: "All days", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^Wed /i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Complete ranked schedule" })).toContainText("Odds and player projections are excluded.");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.body.style.zoom = "2"; });
  const zoomBounds = await page.getByRole("main").evaluate(node => ({
    socialContentFits: node.scrollWidth <= node.clientWidth,
    pageFits: document.documentElement.scrollWidth <= innerWidth,
    mode: "200% CSS body zoom; shared navbar outside social ownership",
  }));
  await writeFile(`${evidence}/fixture-zoom.json`, JSON.stringify(zoomBounds, null, 2));
  expect(zoomBounds.socialContentFits).toBe(true);
  await page.screenshot({ path: `${evidence}/fixture-zoom.png` });
});

test("long text and missing logo stay inside the square and export with a branded fallback", async ({ page }) => {
  const source = await install(page); source.longName = true;
  await page.route("**/pictures/logo-fhfh.svg", route => route.abort());
  await open(page);
  const square = page.getByTestId("share-square");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  await expect(square).toContainText("New Jersey Extremely Long Fantasy Hockey Team Name");
  await expect(square.locator("img")).toHaveCount(0);
  expect(await square.evaluate(node => node.scrollHeight <= (node as HTMLElement).offsetHeight && node.scrollWidth <= (node as HTMLElement).offsetWidth)).toBe(true);
  await downloadedPng(page, "long-name-no-logo-fixture");
});

test("failed refresh preserves only a nonexportable preview and retries the same selection", async ({ page }) => {
  const source = await install(page);
  await open(page);
  const download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  await page.getByRole("button", { name: /^Mon /i }).click();
  source.fail = true;
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("NHL schedule is unavailable");
  await expect(download).toBeDisabled();
  await expect(page.getByTestId("share-square")).toContainText("Ranking unavailable");
  await expect(page.getByTestId("share-square")).not.toContainText("#1");
  source.fail = false;
  await page.getByRole("button", { name: "Retry schedule", exact: true }).click();
  await expect(download).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Mon /i })).toHaveAttribute("aria-pressed", "false");
  const nextWeek = new Date(Date.parse(`${upcomingWeek}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  source.fail = true;
  await page.getByLabel("Week of (Monday)").fill(nextWeek);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("NHL schedule is unavailable");
  await expect(page.getByRole("button", { name: /^Mon /i })).toBeDisabled();
  await expect(page.getByText(/Showing the previous week,/)).toBeVisible();
  await expect(download).toBeDisabled();
  source.fail = false;
  await page.getByRole("button", { name: "Retry schedule", exact: true }).click();
  await expect(download).toBeEnabled();
  await expect(page.getByLabel("Week of (Monday)")).toHaveValue(nextWeek);
  await expect(page.getByRole("button", { name: /^Mon /i })).toHaveAttribute("aria-pressed", "true");
});

test("partial, stale and valid zero-game sources do not publish rankings", async ({ page }) => {
  const source = await install(page);
  source.mode = "partial";
  await open(page);
  const square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(square).toContainText("Ranking unavailable");
  await expect(square).not.toContainText("#1");
  await expect(download).toBeDisabled();
  source.mode = "stale";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(page.getByText(/Schedule stale:/)).toBeVisible();
  await expect(download).toBeDisabled();
  source.mode = "zero";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(page.getByText("No remaining eligible games on the selected dates.")).toBeVisible();
  await expect(download).toBeDisabled();
  await expect(page.getByRole("region", { name: "Complete ranked schedule" }).locator("ol > li")).toHaveCount(32);
});

test("export font failures are explicit and retry without refetching schedule data", async ({ page }) => {
  const source = await install(page);
  await open(page);
  const download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  const requests = source.requests;
  await page.route("**/fonts/social-share/**", route => route.fulfill({ status: 503, body: "unavailable" }));
  await download.click();
  await expect(page.getByRole("status")).toContainText("Local font file unavailable");
  await page.unroute("**/fonts/social-share/**");
  await downloadedPng(page, "recovered-export-fixture");
  expect(source.requests).toBe(requests);
});

test("edition expiry disables export and unsupported formats stay explicitly gated", async ({ page }) => {
  await install(page);
  await page.clock.install();
  await open(page);
  const download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  await page.clock.fastForward(6 * 3600000 + 60000);
  await expect(download).toBeDisabled();
  await expect(page.getByText("This edition has expired. Refresh the schedule to download.")).toBeVisible();
  for (const format of ["tuesday-trends", "player-spotlight", "category-rescue"]) {
    await page.goto(`/social-share/${format}`);
    await expect(page.getByRole("heading", { name: "Source qualification required" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PNG" })).toHaveCount(0);
  }
  expect((await page.goto("/social-share/not-a-format"))?.status()).toBe(404);
});
