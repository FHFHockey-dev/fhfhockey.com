import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { TUESDAY_NOT_CONNECTED, buildBlockedSnapshot, buildScheduleSnapshot, calendarWeekStart, selectScheduleDates, weekDates } from "../lib/socialShare/schedule";
import type { SocialScheduleGame as GameData } from "../lib/socialShare/types";
import type { SocialShareFormat, SocialShareSnapshot } from "../lib/socialShare/types";
import { fictionalLeagueWeek, fictionalTeamStats } from "../lib/socialShare/fixtures";
import { buildOpponentLayer, easiestSchedules, streamingNights } from "../lib/socialShare/matchups";
import { attachRecent, buildPlayerLayer, pickupTiers, specialists, type ShareGoalieGameRow, type ShareRecentRollingRow } from "../lib/socialShare/players";
import { fictionalPlayerRecent, fictionalPlayerSources } from "../lib/socialShare/pickupsFixture";
import { localDate } from "../lib/rosterScheduleOptimizer/planningDates";
import { buildTrendLayer, deploymentChanges, hotCold, ownershipMovers, rateStandouts } from "../lib/socialShare/trends";
import { fictionalTrendSources } from "../lib/socialShare/trendsFixture";
import { editionLabel } from "../lib/socialShare/edition";
import { countTiers } from "../lib/socialShare/mondayGrid";
import { streamingTiers, trimEditionPlayers } from "../lib/socialShare/tiers";
import { SCORE_FORMULA, SPECIALIST_FORMULA } from "../lib/socialShare/score";

const evidence = process.env.SOCIAL_SHARE_EVIDENCE_DIR || "/tmp/fhf-social-card-readiness-evidence-20261008";
const upcomingWeek = calendarWeekStart(new Date(Date.now() + 7 * 86400000).toISOString());
type Mode = "ready" | "partial" | "stale" | "zero" | "league";
test.beforeEach(({ page }) => page.setDefaultTimeout(10000));

// Fictional public schedule mechanics, deliberately separate from live NHL evidence.
type Rates = "ready" | "stale" | "missing";
type PlayerMode = Rates | "thin";
/** Last-five-games read outcome: rows, an answered-but-empty read, or a failed read. */
type RecentRead = "ready" | "empty" | "failed";
function fixture(format: SocialShareFormat, weekStart: string, mode: Mode, pinnedAt?: string, rates: Rates = "ready", players: PlayerMode = "ready", trends: Rates = "ready", recentRead: RecentRead = "ready"): SocialShareSnapshot {
  const dates = weekDates(weekStart), generatedAt = pinnedAt ?? new Date().toISOString();
  const year = Number(weekStart.slice(0, 4)) - (Number(weekStart.slice(5, 7)) < 8 ? 1 : 0);
  const pairs = [[0, 1, 2], [0, 10, 8], [1, 3, 1], [2, 2, 4], [3, 1, 2], [4, 1, 3], [6, 2, 3]];
  const abbreviations: Record<number, string> = { 1: "NJD", 2: "NYI", 3: "NYR", 4: "PHI", 8: "MTL", 10: "TOR" };
  if (mode === "league") {
    // Fictional schedule plus fictional NST-shaped team rates for the matchup cards.
    const snapshot = buildScheduleSnapshot({ format, weekStart, generatedAt, schedule: fictionalLeagueWeek(weekStart, generatedAt) }), season = snapshot.games[0].season;
    const updatedAt = new Date(Date.parse(generatedAt) - (rates === "stale" ? 80 : 4) * 3600000).toISOString();
    snapshot.opponents = buildOpponentLayer(rates === "missing" ? null : fictionalTeamStats(season, updatedAt), { season, teams: snapshot.teams, fetchedAt: generatedAt, generatedAt });
    // Fictional Yahoo ownership (today, or three days old when stale) and WGO totals 4 h old.
    const observedOn = new Date(Date.parse(generatedAt) - (players === "stale" ? 72 : 0) * 3600000).toISOString();
    const sources = players === "missing" ? null : fictionalPlayerSources(season, localDate(observedOn, "America/New_York"), new Date(Date.parse(generatedAt) - 4 * 3600000).toISOString());
    snapshot.players = buildPlayerLayer(sources, { season, teams: snapshot.teams.map(team => team.abbreviation), fetchedAt: generatedAt, generatedAt });
    // Fictional last-five-games evidence for every joined player, as the live server attaches for shown ones.
    const recent = fictionalPlayerRecent(snapshot.players.players, season, localDate(generatedAt, "America/New_York"));
    snapshot.players = attachRecent(snapshot.players, recentRead === "failed" ? null : recentRead === "empty" ? { rolling: [], goalieGames: [] } : { rolling: recent.rolling as ShareRecentRollingRow[], goalieGames: recent.goalieGames as ShareGoalieGameRow[] }, generatedAt);
    // Fictional rolling metrics (4 h old, or 80 h when stale) and seven-day ownership timelines.
    const trendSources = trends === "missing" ? null : fictionalTrendSources(season, localDate(generatedAt, "America/New_York"), new Date(Date.parse(generatedAt) - (trends === "stale" ? 80 : 4) * 3600000).toISOString());
    snapshot.trends = buildTrendLayer(trendSources, { season, teams: snapshot.teams, fetchedAt: generatedAt, generatedAt });
    // "thin": one goalie under 20% rostered on a top-10 team, so the column renders "Only 1 qualifies".
    if (players === "thin") {
      const top = new Set(snapshot.rows.filter(row => row.rank <= 10).map(row => row.team.abbreviation));
      const kept = snapshot.players.players.find(player => player.group === "G" && player.ownership < 20 && top.has(player.team));
      snapshot.players.players = snapshot.players.players.filter(player => !(player.group === "G" && player.ownership < 20) || player === kept);
    }
    return structuredClone(snapshot);
  }
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

/**
 * Fictional social-editor session (SS1-14), the browser-run counterpart of Codex's social-access fixture:
 * a synthetic session in the Supabase client's own storage plus a mocked auth/role service, so the real
 * AuthProvider, SocialShareAccessGate and editionFetch run unchanged. Run the dev server and this spec with
 * NEXT_PUBLIC_SUPABASE_URL set to a fictional host (default below): no real project, token or id is used,
 * every Supabase request is answered here, and writes are refused.
 */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const editorToken = "e2e-fictional-editor-token";
type Access = { role: "social_editor" | null; signedIn: boolean; roleReads: number; writes: string[] };
async function signIn(page: Page, access: Access) {
  // Never against a real project: the fixture host must be a reserved .invalid name (as in CODEX-058's helper).
  expect(supabaseOrigin.hostname.endsWith(".invalid")).toBe(true);
  const user = { id: "00000000-0000-4000-8000-00000000e2e1", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
  // Far-future expiry, so pinned tests that move the browser clock forward never trigger a refresh.
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 86400;
  const session = { access_token: editorToken, refresh_token: "e2e-fictional-refresh", token_type: "bearer", expires_in: 365 * 86400, expires_at: expiresAt, user };
  if (access.signedIn) await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${supabaseOrigin.hostname.split(".")[0]}-auth-token`, JSON.stringify(session)]);
  await page.route(`${supabaseOrigin.origin}/**`, route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET") { access.writes.push(`${request.method()} ${url.pathname}`); return route.abort(); }
    const one = (row: object | null) => route.fulfill({ json: /vnd\.pgrst\.object/.test(request.headers().accept ?? "") ? row : row ? [row] : [] });
    if (url.pathname === "/rest/v1/users") { access.roleReads++; return one(access.role ? { role: access.role } : null); }
    // Existing fictional profile and settings rows, so ensureUserRecords has nothing to write.
    if (url.pathname === "/rest/v1/user_profiles") return one({ user_id: user.id, display_name: "Fictional editor", avatar_url: null, timezone: "America/New_York" });
    if (url.pathname === "/rest/v1/user_settings") return one({ user_id: user.id });
    if (url.pathname === "/auth/v1/user") return route.fulfill({ json: user });
    return route.abort();
  });
}

async function install(page: Page, access: Access = { role: "social_editor", signedIn: true, roleReads: 0, writes: [] }) {
  await signIn(page, access);
  const controller = { requests: 0, fail: false, mode: "ready" as Mode, longName: false, pinnedAt: undefined as string | undefined, rates: "ready" as Rates, players: "ready" as PlayerMode, trends: "ready" as Rates, recentRead: "ready" as RecentRead, liveTrim: false, liveTuesday: false, latest: null as SocialShareSnapshot | null };
  await page.context().route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route("**/api/v1/social-share/**", async route => {
    controller.requests++;
    // The edition API needs the fictional editor's bearer, as the real handler needs a session.
    if (route.request().headers().authorization !== `Bearer ${editorToken}`) return route.fulfill({ status: 401, json: { error: "Sign in to use the share studio." } });
    if (controller.fail) return route.fulfill({ status: 503, json: { error: "NHL schedule is unavailable. Refresh to retry." } });
    const url = new URL(route.request().url());
    // liveTuesday replays exactly what the real API returns for Tuesday today: blocked, no read.
    if (controller.liveTuesday && url.pathname.endsWith("/tuesday-trends")) {
      const selected = url.searchParams.get("selectedDates");
      controller.latest = buildBlockedSnapshot({ format: "tuesday-trends", weekStart: url.searchParams.get("weekStart")!, generatedAt: new Date().toISOString(), selectedDates: selected === null ? undefined : selected.split(",").filter(Boolean), ...TUESDAY_NOT_CONNECTED });
      return route.fulfill({ json: controller.latest, headers: { "Cache-Control": "no-store" } });
    }
    let next = fixture(url.pathname.split("/").pop() as SocialShareFormat, url.searchParams.get("weekStart")!, controller.mode, controller.pinnedAt, controller.rates, controller.players, controller.trends, controller.recentRead);
    if (url.searchParams.has("selectedDates")) next = selectScheduleDates(next, url.searchParams.get("selectedDates")?.split(",").filter(Boolean) || []);
    if (controller.longName) {
      for (const row of next.rows) if (row.team.id === 1) row.team.name = "New Jersey Extremely Long Fantasy Hockey Team Name";
      for (const team of next.teams) if (team.id === 1) team.name = "New Jersey Extremely Long Fantasy Hockey Team Name";
    }
    // liveTrim replays the live server's trim: only the cards' players leave, with tier counts.
    if (controller.liveTrim && next.players) next = { ...next, players: trimEditionPlayers(next, next.players) };
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
  await page.getByRole("combobox", { name: /^Graphic/ }).selectOption("leaders");
  const square = page.getByTestId("share-square");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  await expect(square).toContainText("New Jersey Extremely Long Fantasy Hockey Team Name");
  await expect(square.locator('img[alt="FHFH"]')).toHaveCount(0);
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
  for (const format of ["player-spotlight", "category-rescue"]) {
    await page.goto(`/social-share/${format}`);
    await expect(page.getByRole("heading", { name: "Source qualification required" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PNG" })).toHaveCount(0);
  }
  expect((await page.goto("/social-share/not-a-format"))?.status()).toBe(404);
});

test("Monday default grid ranks every team by Game Grid weekScore in square day cells and exports", async ({ page }) => {
  const source = await install(page), errors: string[] = [];
  source.mode = "league";
  page.on("pageerror", error => errors.push(error.message));
  await open(page);
  const square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(page.getByRole("combobox", { name: /^Graphic/ })).toHaveValue("grid");
  await expect(download).toBeEnabled();
  await expect(square).toContainText("BEST SCHEDULES");
  await expect(square).toContainText("SCHEDULE ONLY");
  const edition = source.latest!;
  const rows = square.locator("[data-team]");
  await expect(rows).toHaveCount(32);
  expect(await rows.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-team")))).toEqual(edition.rows.map(row => row.team.abbreviation));
  expect(await rows.evaluateAll(nodes => nodes.map(node => node.firstElementChild!.textContent))).toEqual(edition.rows.map(row => String(row.rank)));
  const geometry = await square.evaluate(node => {
    const square = node as HTMLElement, cells = Array.from(square.querySelectorAll<HTMLElement>("[data-team] > [data-date]"));
    return {
      cells: cells.length,
      squareCells: cells.every(cell => cell.offsetWidth === cell.offsetHeight && cell.offsetWidth >= 40),
      fits: square.scrollHeight <= square.offsetHeight && square.scrollWidth <= square.offsetWidth,
      awayMarks: square.querySelectorAll("[data-team] i").length,
      brokenImages: Array.from(square.querySelectorAll("img")).filter(image => !image.naturalWidth).length,
    };
  });
  // One away mark per fixture game; the fictional week has no doubleheaders.
  expect(geometry).toEqual({ cells: 32 * 7, squareCells: true, fits: true, awayMarks: edition.games.length, brokenImages: 0 });
  await expect(square).toHaveAttribute("aria-label", new RegExp(`^FHFH Best schedules, ${editionLabel(edition)} streamer grid.*1\\. ${edition.rows[0].team.name}: ${edition.rows[0].remainingGames} games left`));
  await downloadedPng(page, "monday-best-schedules-grid");
  await page.screenshot({ path: `${evidence}/monday-grid-page.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("Monday grid falls back to abbreviation tiles and never ranks an untrusted edition", async ({ page }) => {
  const source = await install(page);
  source.mode = "league";
  await page.route("**/teamLogos/NJD.png", route => route.abort());
  await open(page);
  const square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  await expect(square.locator('[data-team="NJD"] b:not([data-count-tier])')).toHaveText("NJD");
  await downloadedPng(page, "monday-grid-missing-logo");
  source.mode = "partial";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(download).toBeDisabled();
  await expect(square).toContainText("Ranking unavailable");
  await expect(square).toContainText("KNOWN SCHEDULES");
  const order = await square.locator("[data-team]").evaluateAll(nodes => nodes.map(node => [node.getAttribute("data-team"), node.firstElementChild!.textContent]));
  expect(order.map(([team]) => team)).toEqual(order.map(([team]) => team).sort());
  expect(order.every(([, rank]) => rank === "")).toBe(true);
});

test("pinned Monday grid edition exports the same PNG bytes every run", async ({ page }) => {
  // Fixed edition and browser clock: any byte change means the default card's rendering changed.
  const source = await install(page), week = "2026-10-26";
  source.mode = "league"; source.pinnedAt = `${week}T13:00:00.000Z`;
  await page.clock.install({ time: new Date(`${week}T13:05:00Z`) });
  await page.goto("/social-share/game-grid");
  await page.getByLabel("Week of (Monday)").fill(week);
  const download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  const png = await downloadedPng(page, "monday-grid-pinned");
  const digest = createHash("sha256").update(new Uint8Array(png)).digest("hex");
  await writeFile(`${evidence}/monday-grid-pinned.sha256`, `${digest}  monday-grid-pinned.png\n`);
  if (process.env.SOCIAL_SHARE_PINNED_GRID_SHA256) expect(digest).toBe(process.env.SOCIAL_SHARE_PINNED_GRID_SHA256);
  // Extra cards on the same pinned edition (fixture rates updated 4 h before the edition).
  const extras: string[] = [];
  for (const card of ["easiest", "stream"]) {
    await page.getByRole("combobox", { name: /^Graphic/ }).selectOption(card);
    await expect(download).toBeEnabled();
    const bytes = await downloadedPng(page, `monday-${card}-pinned`);
    extras.push(`${createHash("sha256").update(new Uint8Array(bytes)).digest("hex")}  monday-${card}-pinned.png`);
  }
  await writeFile(`${evidence}/monday-extra-cards-pinned.sha256`, `${extras.join("\n")}\n`);
  if (process.env.SOCIAL_SHARE_PINNED_EXTRA_SHA256) expect(extras.map(line => line.slice(0, 64)).join(",")).toBe(process.env.SOCIAL_SHARE_PINNED_EXTRA_SHA256);
  const playerCards: string[] = [];
  for (const card of ["pickups-50", "pickups-30", "pickups-20", "specialists"]) {
    await page.getByRole("combobox", { name: /^Graphic/ }).selectOption(card);
    await expect(download).toBeEnabled();
    const bytes = await downloadedPng(page, `monday-${card}-pinned`);
    playerCards.push(`${createHash("sha256").update(new Uint8Array(bytes)).digest("hex")}  monday-${card}-pinned.png`);
  }
  await writeFile(`${evidence}/monday-player-cards-pinned.sha256`, `${playerCards.join("\n")}\n`);
  if (process.env.SOCIAL_SHARE_PINNED_PLAYER_SHA256) expect(playerCards.map(line => line.slice(0, 64)).join(",")).toBe(process.env.SOCIAL_SHARE_PINNED_PLAYER_SHA256);
  const tierCards: string[] = [];
  for (const card of ["tiers", "tiers-wide"]) {
    await page.getByRole("combobox", { name: /^Graphic/ }).selectOption(card);
    await expect(download).toBeEnabled();
    const bytes = await downloadedPng(page, `monday-${card}-pinned`);
    tierCards.push(`${createHash("sha256").update(new Uint8Array(bytes)).digest("hex")}  monday-${card}-pinned.png`);
  }
  await writeFile(`${evidence}/monday-tier-cards-pinned.sha256`, `${tierCards.join("\n")}\n`);
  if (process.env.SOCIAL_SHARE_PINNED_TIERS_SHA256) expect(tierCards.map(line => line.slice(0, 64)).join(",")).toBe(process.env.SOCIAL_SHARE_PINNED_TIERS_SHA256);
});

async function matchupGeometry(page: Page) {
  return page.getByTestId("share-square").evaluate(node => {
    const square = node as HTMLElement, footer = square.querySelector("footer")!.getBoundingClientRect();
    return {
      fits: square.scrollHeight <= square.offsetHeight && square.scrollWidth <= square.offsetWidth &&
        Array.from(square.querySelectorAll("[data-team]")).every(row => row.getBoundingClientRect().bottom <= footer.top),
      rowsInside: Array.from(square.querySelectorAll<HTMLElement>("[data-team], [data-team] *")).every(item => {
        const box = item.getBoundingClientRect(), frame = square.getBoundingClientRect();
        return box.left >= frame.left - 1 && box.right <= frame.right + 1 && box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1;
      }),
      brokenImages: Array.from(square.querySelectorAll("img")).filter(image => !image.naturalWidth).length,
    };
  });
}

test("Easiest schedules and streaming matchup cards rank by Game Grid opponent DEF and export", async ({ page }) => {
  const source = await install(page), errors: string[] = [];
  source.mode = "league";
  page.on("pageerror", error => errors.push(error.message));
  await open(page);
  await page.getByRole("combobox", { name: /^Graphic/ }).selectOption("easiest");
  const square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(square).toContainText("EASIEST SCHEDULES");
  await expect(download).toBeEnabled();
  const expected = easiestSchedules(source.latest!, true).rows;
  expect(expected).toHaveLength(8);
  const rows = square.locator("[data-team]");
  await expect(rows).toHaveCount(8);
  expect(await rows.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-team")))).toEqual(expected.map(row => row.team.abbreviation));
  expect(await rows.evaluateAll(nodes => nodes.map(node => node.querySelectorAll("[data-date]").length))).toEqual(expected.map(row => row.remainingGames));
  for (const [index, row] of expected.entries()) await expect(rows.nth(index)).toContainText(String(Math.round(row.def)));
  expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
  await expect(square).toHaveAttribute("aria-label", new RegExp(`^FHFH Easiest schedules.*1\\. ${expected[0].team.name}: opponent defense ${Math.round(expected[0].def)}`));
  await downloadedPng(page, "monday-easiest-schedules");
  await page.getByRole("combobox", { name: /^Graphic/ }).selectOption("stream");
  await expect(square).toContainText("STREAMING MATCHUPS");
  const nights = streamingNights(source.latest!, true);
  expect(nights.length).toBeGreaterThan(0);
  const tiles = square.locator("[data-team]");
  await expect(tiles).toHaveCount(nights.length);
  expect(await tiles.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-team")))).toEqual(nights.map(night => night.team.abbreviation));
  expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
  await expect(download).toBeEnabled();
  await downloadedPng(page, "monday-streaming-matchups");
  expect(errors).toEqual([]);
});

test("matchup cards never rank or export without current, complete opponent ratings", async ({ page }) => {
  const source = await install(page);
  source.mode = "league"; source.rates = "stale";
  await open(page);
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  for (const card of ["easiest", "stream"]) {
    await graphic.selectOption(card);
    await expect(square).toContainText("Ranking unavailable");
    await expect(square).toContainText("stale");
    await expect(square.locator("[data-team]")).toHaveCount(0);
    await expect(download).toBeDisabled();
  }
  source.rates = "missing";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(square).toContainText("missing");
  await expect(download).toBeDisabled();
  await downloadedPreview(page, "monday-streaming-unavailable-preview");
  await graphic.selectOption("grid");
  await expect(download).toBeEnabled();
  source.rates = "ready"; source.mode = "partial";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await graphic.selectOption("easiest");
  await expect(square).toContainText("schedule edition is not ready");
  await expect(download).toBeDisabled();
});

async function downloadedPreview(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.getByTestId("share-square").screenshot({ path: `${evidence}/${name}.png` });
}

test("Pickup tier and specialist cards list ranked players from top Week Score teams and export", async ({ page }) => {
  const source = await install(page), errors: string[] = [];
  source.mode = "league";
  page.on("pageerror", error => errors.push(error.message));
  await open(page);
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  const tiers = pickupTiers(source.latest!, true);
  for (const tier of tiers) {
    await graphic.selectOption(`pickups-${tier.max}`);
    await expect(square).toContainText(`${tier.label.toUpperCase()} ROSTERED`);
    await expect(square).toContainText("bands 30–49% · 20–29% · under 20%");
    const expected = [...tier.groups.F, ...tier.groups.D, ...tier.groups.G].map(player => String(player.nhlId));
    expect(expected.length).toBeGreaterThanOrEqual(5);
    await expect(square.locator("[data-player]")).toHaveCount(expected.length);
    expect(await square.locator("[data-player]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-player")))).toEqual(expected);
    await expect(square).toContainText("Yahoo rostered % as of");
    await expect(square).toContainText("Not projections");
    // Ticket 15: L5 score, the printed formula and neon role chips (line or pair, PP unit).
    await expect(square).toContainText(SCORE_FORMULA);
    await expect(square.locator("[data-player]").first()).toContainText("L5 SCORE");
    expect(await square.locator("[data-role]").count()).toBeGreaterThan(0);
    expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
    await expect(download).toBeEnabled();
    await downloadedPng(page, `monday-pickups-under-${tier.max}`);
  }
  const board = specialists(source.latest!, true);
  await graphic.selectOption("specialists");
  await expect(square).toContainText("CATEGORY SPECIALISTS");
  const expected = [...board.hits, ...board.shots, ...board.blocks].map(player => String(player.nhlId));
  expect(await square.locator("[data-player]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-player")))).toEqual(expected);
  await expect(square.locator("[data-player]").first()).toContainText(`${(board.hits[0].l5PerGame ?? board.hits[0].perGame).toFixed(1)}HIT/GP ${board.hits[0].l5PerGame === null ? "SEASON" : "L5"}`);
  await expect(square).toContainText(SPECIALIST_FORMULA);
  expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
  await expect(square).toHaveAttribute("aria-label", new RegExp(`^FHFH Hits, shots and blocks specialists.*HITS: ${board.hits[0].name} \\(${board.hits[0].team}`));
  await downloadedPng(page, "monday-specialists");
  expect(errors).toEqual([]);
});

test("player cards never rank or export without current player sources or a ready schedule", async ({ page }) => {
  const source = await install(page);
  source.mode = "league"; source.players = "stale";
  await open(page);
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  for (const card of ["pickups-50", "pickups-20", "specialists"]) {
    await graphic.selectOption(card);
    await expect(square).toContainText("Ranking unavailable");
    await expect(square).toContainText("older than a day");
    await expect(square.locator("[data-player]")).toHaveCount(0);
    await expect(download).toBeDisabled();
  }
  source.players = "missing";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(square).toContainText("not connected");
  await expect(download).toBeDisabled();
  await downloadedPreview(page, "monday-specialists-unavailable-preview");
  await graphic.selectOption("easiest");
  await expect(download).toBeEnabled();
  source.players = "ready"; source.mode = "partial";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await graphic.selectOption("pickups-30");
  await expect(square).toContainText("schedule edition is not ready");
  await expect(download).toBeDisabled();
});

test("short pickup columns say how many qualify and the card still exports", async ({ page }) => {
  const source = await install(page);
  source.mode = "league"; source.players = "thin";
  await open(page);
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  await graphic.selectOption("pickups-20");
  await expect(square).toContainText("UNDER 20% ROSTERED");
  const tier = pickupTiers(source.latest!, true).find(item => item.max === 20)!;
  expect(tier.groups.G).toHaveLength(1);
  const notes = (["F", "D", "G"] as const).map(group => tier.groups[group].length).filter(count => count < 3)
    .map(count => count === 0 ? "None qualify" : `Only ${count} qualif${count === 1 ? "ies" : "y"}`);
  for (const note of notes) await expect(square).toContainText(note);
  await expect(square).toContainText("Only 1 qualifies");
  await expect(square.locator("[data-player]")).toHaveCount(tier.groups.F.length + tier.groups.D.length + 1);
  expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
  await expect(square).toHaveAttribute("aria-label", new RegExp(`GOALIES: ${tier.groups.G[0].name} \\(`));
  await expect(download).toBeEnabled();
  await downloadedPng(page, "monday-pickups-under-20-thin");
});

const dateLabelUtc = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

async function exportCards(page: Page, cards: string[], prefix: string) {
  const lines: string[] = [];
  for (const card of cards) {
    await page.getByRole("combobox", { name: /^Graphic/ }).selectOption(card);
    await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
    const bytes = await downloadedPng(page, `${prefix}-${card}-pinned`);
    lines.push(`${createHash("sha256").update(new Uint8Array(bytes)).digest("hex")}  ${prefix}-${card}-pinned.png`);
  }
  await writeFile(`${evidence}/${prefix}-cards-pinned.sha256`, `${lines.join("\n")}\n`);
  return lines.map(line => line.slice(0, 64)).join(",");
}

test("pinned Wednesday and Tuesday editions export the same PNG bytes every run", async ({ page }) => {
  // Each edition is generated on its own posting day (Wednesday, then Tuesday), as it would be live.
  const source = await install(page), week = "2026-10-26";
  source.mode = "league"; source.pinnedAt = "2026-10-28T13:00:00.000Z";
  await page.clock.install({ time: new Date("2026-10-28T13:05:00Z") });
  await page.goto("/social-share/remaining-week");
  await page.getByLabel("Week of (Monday)").fill(week);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  const wednesday = await exportCards(page, ["grid", "easiest", "stream", "pickups-50", "pickups-30", "pickups-20", "specialists", "tiers", "tiers-wide"], "wednesday");
  if (process.env.SOCIAL_SHARE_PINNED_WEDNESDAY_SHA256) expect(wednesday).toBe(process.env.SOCIAL_SHARE_PINNED_WEDNESDAY_SHA256);
  source.pinnedAt = "2026-10-27T13:00:00.000Z";
  await page.clock.setSystemTime(new Date("2026-10-27T13:05:00Z"));
  await page.goto("/social-share/tuesday-trends");
  await page.getByLabel("Week of (Monday)").fill(week);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  const tuesday = await exportCards(page, ["hot", "deployment", "rates", "movers"], "tuesday");
  if (process.env.SOCIAL_SHARE_PINNED_TUESDAY_SHA256) expect(tuesday).toBe(process.env.SOCIAL_SHARE_PINNED_TUESDAY_SHA256);
});

test("Wednesday edition recomputes every card for Thursday to Sunday and names the covered dates", async ({ page }) => {
  const source = await install(page), errors: string[] = [];
  source.mode = "league";
  page.on("pageerror", error => errors.push(error.message));
  await open(page, "remaining-week");
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(graphic).toHaveValue("grid");
  await expect(download).toBeEnabled();
  const edition = source.latest!, covered = weekDates(upcomingWeek).slice(3);
  expect(edition.selectedDates).toEqual(covered);
  const label = editionLabel(edition);
  await expect(square).toContainText(`${label} · Rest of week`, { ignoreCase: true });
  await expect(square).toContainText("COVERS THU–SUN");
  await expect(square.locator("[data-covered]")).toHaveAttribute("data-covered", covered.join(","));
  expect(await square.locator("[data-team]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-team")))).toEqual(edition.rows.map(row => row.team.abbreviation));
  await downloadedPng(page, "wednesday-best-schedules-grid");
  const cards: [string, string[]][] = [
    ["easiest", easiestSchedules(edition, true).rows.map(row => row.team.abbreviation)],
    ["stream", streamingNights(edition, true).map(night => night.team.abbreviation)],
    ["pickups-50", Object.values(pickupTiers(edition, true)[0].groups).flat().map(player => player.team)],
    ["specialists", Object.values(specialists(edition, true)).flat().map(player => player.team)],
  ];
  for (const [card, teams] of cards) {
    await graphic.selectOption(card);
    await expect(square).toContainText("COVERS THU–SUN");
    await expect(square).toContainText(`${label} ·`);
    expect(teams.length).toBeGreaterThan(0);
    expect(await square.locator("[data-team]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-team")))).toEqual(teams);
    expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
    await expect(download).toBeEnabled();
    await downloadedPng(page, `wednesday-${card}`);
  }
  expect(errors).toEqual([]);
});

test("Tuesday trend cards rank real rolling windows and ownership movers and export", async ({ page }) => {
  const source = await install(page), errors: string[] = [];
  source.mode = "league";
  page.on("pageerror", error => errors.push(error.message));
  await open(page, "tuesday-trends");
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(graphic).toHaveValue("hot");
  await expect(download).toBeEnabled();
  const edition = source.latest!, keys = (list: { nhlId: number }[]) => list.map(item => String(item.nhlId));
  const cards: [string, string, string[], string][] = [
    ["hot", "HOT & COLD", [...keys(hotCold(edition, true).hot), ...keys(hotCold(edition, true).cold)], "Window: last 5 games played vs season to date"],
    ["deployment", "DEPLOYMENT CHANGES", [...keys(deploymentChanges(edition, true).up), ...keys(deploymentChanges(edition, true).down)], "Line and PP unit: latest game vs 5 games earlier"],
    ["rates", "RATE STANDOUTS", Object.values(rateStandouts(edition, true)).flatMap(keys), "Min 50 last-5 minutes"],
    ["movers", "OWNERSHIP MOVERS", [...ownershipMovers(edition, true).risers, ...ownershipMovers(edition, true).fallers].map(mover => mover.key), "Add/drop counts are not in FHFH's sources"],
  ];
  for (const [card, title, expected, legend] of cards) {
    await graphic.selectOption(card);
    await expect(square).toContainText(title);
    await expect(square).toContainText(legend);
    await expect(square).toContainText(card === "movers" ? "Source: Yahoo ownership timelines" : "Source: FHFH rolling game metrics (all situations) through");
    expect(expected.length).toBeGreaterThanOrEqual(8);
    expect(await square.locator("[data-player]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-player")))).toEqual(expected);
    expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
    await expect(download).toBeEnabled();
    await downloadedPng(page, `tuesday-${card}`);
  }
  await expect(square).toHaveAttribute("aria-label", /^FHFH Tuesday trends, ownership movers.*add and drop counts are not in FHFH's sources\.$/);
  expect(errors).toEqual([]);
});

test("Tuesday cards never rank stale or missing sources, and stale metrics do not block movers", async ({ page }) => {
  const source = await install(page);
  source.mode = "league"; source.trends = "stale";
  await open(page, "tuesday-trends");
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  for (const card of ["hot", "deployment", "rates"]) {
    await graphic.selectOption(card);
    await expect(square).toContainText("Ranking unavailable");
    await expect(square).toContainText("Most rolling metric rows are stale");
    await expect(square.locator("[data-player]")).toHaveCount(0);
    await expect(download).toBeDisabled();
  }
  await graphic.selectOption("movers");
  await expect(download).toBeEnabled();
  source.trends = "missing";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(square).toContainText("not connected");
  await expect(download).toBeDisabled();
  await downloadedPreview(page, "tuesday-movers-unavailable-preview");
});

test("live Tuesday answer is an honest not-connected edition with Download disabled", async ({ page }) => {
  const source = await install(page);
  source.liveTuesday = true;
  await open(page, "tuesday-trends");
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(page.getByText("Schedule blocked: Rolling game metrics and ownership are not connected.")).toBeVisible();
  expect(source.latest).toMatchObject({ state: "blocked", source: { fetchedAt: null, state: "blocked" } });
  for (const card of ["hot", "deployment", "rates", "movers"]) {
    await graphic.selectOption(card);
    await expect(square).toContainText("Ranking unavailable");
    await expect(square).toContainText("rolling game metrics and ownership are not connected");
    await expect(square).not.toContainText("schedule edition is not ready");
    await expect(square.locator("[data-player]")).toHaveCount(0);
    await expect(download).toBeDisabled();
  }
  await downloadedPreview(page, "tuesday-live-not-connected-preview");
});

test("a page load makes exactly one edition API call even under the dev strict-mode double mount", async ({ page }) => {
  const source = await install(page), apiCalls: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/v1/social-share/")) apiCalls.push(new URL(request.url()).search); });
  await page.goto("/social-share/game-grid");
  await expect(page.getByRole("button", { name: "Refresh schedule", exact: true })).toBeEnabled();
  await page.waitForTimeout(1500);
  expect(apiCalls).toHaveLength(1);
  expect(source.requests).toBe(1);
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect.poll(() => source.requests).toBe(2);
  await page.waitForTimeout(500);
  expect(source.requests).toBe(2);
});

test("the eyebrow names the real date context, not the format's posting day", async ({ page }) => {
  const source = await install(page);
  source.mode = "league";
  await open(page);
  const square = page.getByTestId("share-square");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  const label = editionLabel(source.latest!);
  // open() loads next week's edition, so it is always generated before that week starts.
  expect(label).toBe("Week ahead");
  await expect(square).toContainText(`${label} · Streamer grid`, { ignoreCase: true });
  await page.getByRole("combobox", { name: /^Graphic/ }).selectOption("pickups-20");
  await expect(square).toContainText(`${label} · Pickups · top-10 schedules first`, { ignoreCase: true });
});

test("ticket 10 flair: striped player banners with L5 evidence, three per list, tiered grid scores and cherry picks", async ({ page }) => {
  const source = await install(page), errors: string[] = [];
  source.mode = "league";
  page.on("pageerror", error => errors.push(error.message));
  await open(page);
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  // Wait for the requested week's trusted render (a week switch briefly shows the previous edition unranked).
  await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  await expect(square).toContainText(`${dateLabelUtc(upcomingWeek)} –`);
  const edition = source.latest!;
  // Grid: every ranked row carries a tier, scores are shown, and streaming picks are bordered.
  const tiers = await square.locator("[data-team][data-tier]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-tier")));
  expect(tiers).toHaveLength(32);
  expect(new Set(tiers)).toEqual(new Set(["tierBest", "tierGood", "tierAverage", "tierBelow", "tierWorst"]));
  await expect(square.locator('[data-team="' + edition.rows[0].team.abbreviation + '"]')).toContainText(edition.rows[0].score.toFixed(1));
  await expect(square.locator("[data-cherry]")).toHaveCount(streamingNights(edition, true).length);
  await downloadedPng(page, "flair-grid");
  // Every pickup band fills three per position; fill players are marked; every tile shows L5 evidence.
  let widened = 0;
  for (const tier of pickupTiers(edition, true)) {
    await graphic.selectOption(`pickups-${tier.max}`);
    const tiles = square.locator("[data-player]");
    await expect(tiles).toHaveCount(9);
    for (let i = 0; i < 9; i++) await expect(tiles.nth(i)).toContainText("L5 GP");
    const fills = await square.locator("[data-widened]").count();
    if (fills) await expect(square.locator("[data-widened]").first()).toContainText("WIDER POOL");
    widened += fills;
    const first = tier.groups.F[0];
    await expect(tiles.first()).toContainText(first.name);
    await expect(tiles.first()).toContainText(`${Math.floor(first.ownership)}%`);
    expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
    await downloadedPng(page, `flair-pickups-${tier.max}`);
  }
  expect(widened).toBeGreaterThan(0);
  await graphic.selectOption("specialists");
  await downloadedPng(page, "flair-specialists");
  for (const card of ["easiest", "stream"]) {
    await graphic.selectOption(card);
    expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
    await downloadedPng(page, `flair-${card}`);
  }
  await expect(square).toContainText("TILT →");
  await graphic.selectOption("leaders");
  await expect(square.locator("[data-team]")).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(square.locator("[data-team]").nth(i).locator("[data-date]")).toHaveCount(7);
  expect(await square.evaluate(node => node.scrollHeight <= (node as HTMLElement).offsetHeight)).toBe(true);
  await downloadedPng(page, "flair-leaders");
  expect(errors).toEqual([]);
});

test("player tiles never claim 'no recent game' when the last-five-games read failed", async ({ page }) => {
  const source = await install(page);
  source.mode = "league"; source.recentRead = "failed";
  await open(page);
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square");
  await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  await graphic.selectOption("pickups-20");
  const tiles = square.locator("[data-player]");
  await expect(tiles).toHaveCount(9);
  for (let i = 0; i < 9; i++) await expect(tiles.nth(i)).toContainText("Recent form unavailable");
  await expect(square).not.toContainText("No game in the last two weeks");
  source.recentRead = "empty";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(tiles.first()).toContainText("No game in the last two weeks");
  await expect(square).not.toContainText("Recent form unavailable");
});

test("GP and off-night counts are coloured per column on Monday and Wednesday editions", async ({ page }) => {
  const source = await install(page);
  source.mode = "league";
  for (const format of ["game-grid", "remaining-week"]) {
    await open(page, format);
    const square = page.getByTestId("share-square"), graphic = page.getByRole("combobox", { name: /^Graphic/ });
    await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
    const edition = source.latest!;
    expect(edition.format).toBe(format);
    const gp = countTiers(edition.rows.map(row => row.remainingGames)), off = countTiers(edition.rows.map(row => row.offNightGames));
    const rows = await square.locator("[data-team][data-tier]").evaluateAll(nodes => nodes.map(node => [node.getAttribute("data-team"), node.getAttribute("data-gp-tier"), node.getAttribute("data-off-tier")]));
    expect(rows).toEqual(edition.rows.map(row => [row.team.abbreviation, gp.get(row.remainingGames), off.get(row.offNightGames)]));
    expect(rows.some(([, gpTier, offTier]) => gpTier !== offTier)).toBe(true);
    expect(new Set(rows.map(([, gpTier]) => gpTier))).toContain("high");
    expect(new Set(rows.map(([, gpTier]) => gpTier))).toContain("low");
    await expect(square).toContainText("GP · OFF");
    await downloadedPng(page, `counts-${format}-grid`);
    for (const card of ["pickups-20", "easiest", "leaders"]) {
      await graphic.selectOption(card);
      const counts = await square.locator("[data-count-tier]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-count-tier")));
      expect(counts.length).toBeGreaterThan(0);
      expect(counts.every(tier => ["high", "second", "between", "low"].includes(tier!))).toBe(true);
    }
  }
});

test("schedule-aware tier list shows only tier teams' players as list rows, strict and widened", async ({ page }) => {
  const source = await install(page), expected: Record<string, string[]> = {};
  source.mode = "league";
  await open(page);
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  for (const [card, mode] of [["tiers", "strict"], ["tiers-wide", "widened"]] as const) {
    await graphic.selectOption(card);
    await expect(square).toContainText("STREAMING OPTIONS");
    await expect(square).toContainText("skaters, then goalies, each by L5 score");
    const tiers = streamingTiers(source.latest!, true, mode);
    expect(tiers).toHaveLength(3);
    await expect(square.locator("[data-tier-index]")).toHaveCount(3);
    expect(await square.locator("[data-player]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-player")))).toEqual(tiers.flatMap(tier => tier.shown.map(player => String(player.nhlId))));
    for (const tier of tiers) {
      const block = square.locator(`[data-tier-index="${tier.index}"]`);
      for (const player of tier.shown) expect(tier.teams.map(team => team.abbreviation)).toContain(player.team);
      if (tier.more) await expect(block).toContainText(`+${tier.more} more`);
      await expect(block.locator("[data-player]").first()).toContainText("L5 GP");
    }
    expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
    await expect(download).toBeEnabled();
    await downloadedPng(page, `streaming-tiers-${mode}`);
    expected[mode] = tiers.flatMap(tier => tier.shown.map(player => String(player.nhlId)));
  }
  // Live-shaped edition (SS1-14): the server trims the layer to the cards' players and records tier counts;
  // the tier list still renders the same rows instead of "Ranking unavailable".
  source.liveTrim = true;
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  for (const [card, mode] of [["tiers", "strict"], ["tiers-wide", "widened"]] as const) {
    await graphic.selectOption(card);
    await expect(square.locator("[data-tier-index]")).toHaveCount(3);
    expect(source.latest!.players!.tierCounts).toBeTruthy();
    expect(await square.locator("[data-player]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-player")))).toEqual(expected[mode]);
    await expect(square).not.toContainText("Ranking unavailable");
    await expect(download).toBeEnabled();
  }
});

test("share studio stays closed without a social editor role, and the edition is never requested", async ({ page }) => {
  // Negative control for the fictional sign-in fixture: signed out, then signed in with no role.
  for (const access of [{ role: null, signedIn: false, roleReads: 0, writes: [] as string[] }, { role: null, signedIn: true, roleReads: 0, writes: [] as string[] }] satisfies Access[]) {
    const source = await install(page, access);
    await page.goto("/social-share/game-grid");
    await expect(page.locator("section[aria-labelledby=\"share-access-title\"] [role=\"alert\"]")).toHaveText(access.signedIn ? "Social editor access is required to use this studio." : "Sign in with your FHFH social editor account to continue.");
    await expect(page.getByTestId("share-square")).toHaveCount(0);
    expect(source.requests).toBe(0);
    expect(access.roleReads > 0).toBe(access.signedIn);
    expect(access.writes).toEqual([]);
    await page.unrouteAll({ behavior: "ignoreErrors" }); await page.context().unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("returning to the tab keeps the week, days and card: the gate's re-check remounts the studio without a reset (ticket 15)", async ({ page }) => {
  const access: Access = { role: "social_editor", signedIn: true, roleReads: 0, writes: [] };
  const source = await install(page, access);
  source.mode = "league";
  await open(page);
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square");
  await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  await page.getByRole("button", { name: /^Tue /i }).click();
  await graphic.selectOption("tiers");
  await expect(square).toContainText("STREAMING OPTIONS");
  await expect(page).toHaveURL(/[?&]card=tiers/);
  const url = new URL(page.url()), requests = source.requests, reads = access.roleReads;
  expect(url.searchParams.get("week")).toBe(upcomingWeek);
  expect(url.searchParams.get("dates")!.split(",").length).toBe(6);
  // Supabase re-announces the session when the tab becomes visible again; the gate re-reads the role.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
  await expect.poll(() => access.roleReads).toBeGreaterThan(reads);
  await expect(square).toContainText("STREAMING OPTIONS");
  await expect(graphic).toHaveValue("tiers");
  await expect(page.getByLabel("Week of (Monday)")).toHaveValue(upcomingWeek);
  expect(new URL(page.url()).searchParams.get("dates")).toBe(url.searchParams.get("dates"));
  expect(source.requests).toBe(requests);
  // A full reload restores the same selection from the URL (one fresh edition read).
  await page.reload();
  await expect(graphic).toHaveValue("tiers");
  await expect(page.getByLabel("Week of (Monday)")).toHaveValue(upcomingWeek);
  expect(new URL(page.url()).searchParams.get("dates")).toBe(url.searchParams.get("dates"));
  expect(access.writes).toEqual([]);
});

