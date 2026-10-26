import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildScheduleSnapshot, calendarWeekStart, selectScheduleDates, weekDates } from "../lib/socialShare/schedule";
import type { SocialScheduleGame as GameData } from "../lib/socialShare/types";
import type { SocialShareFormat, SocialShareSnapshot } from "../lib/socialShare/types";
import { fictionalLeagueWeek, fictionalTeamStats } from "../lib/socialShare/fixtures";
import { buildOpponentLayer, easiestSchedules, streamingNights } from "../lib/socialShare/matchups";
import { attachRecent, buildPlayerLayer, pickupTiers, specialists, type ShareGoalieGameRow, type ShareRecentRollingRow } from "../lib/socialShare/players";
import { fictionalPlayerRecent, fictionalPlayerSources } from "../lib/socialShare/pickupsFixture";
import { localDate } from "../lib/rosterScheduleOptimizer/planningDates";
import { buildTrendLayer, deploymentChanges, hotCold, ownershipMovers, rateStandouts, trendDefinitions } from "../lib/socialShare/trends";
import { fictionalTrendSources } from "../lib/socialShare/trendsFixture";
import { editionLabel } from "../lib/socialShare/edition";
import { countTiers } from "../lib/socialShare/mondayGrid";
import { streamingTiers, trimEditionPlayers } from "../lib/socialShare/tiers";
import { SCORE_FORMULA, SPECIALIST_FORMULA } from "../lib/socialShare/score";
import { streakOf, type StreakContext } from "../lib/socialShare/streak";
import { roleLabel, targetKey, targetPicks } from "../lib/socialShare/targets";

const evidence = process.env.SOCIAL_SHARE_EVIDENCE_DIR || "/tmp/fhf-social-card-readiness-evidence-20261008";
const upcomingWeek = calendarWeekStart(new Date(Date.now() + 7 * 86400000).toISOString());
type Mode = "ready" | "partial" | "stale" | "zero" | "league";
test.beforeEach(({ page }) => page.setDefaultTimeout(10000));

// Fictional public schedule mechanics, deliberately separate from live NHL evidence.
type Rates = "ready" | "stale" | "missing";
type PlayerMode = Rates | "thin";
/** Last-five-games read outcome: rows, an answered-but-empty read, or a failed read. */
type RecentRead = "ready" | "empty" | "failed" | "goalies-failed" | "chunk-failed";
function fixture(format: SocialShareFormat, weekStart: string, mode: Mode, pinnedAt?: string, rates: Rates = "ready", players: PlayerMode = "ready", trends: Rates = "ready", recentRead: RecentRead = "ready", ownershipStale = false): SocialShareSnapshot {
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
    snapshot.players = attachRecent(snapshot.players, recentRead === "failed" ? null : recentRead === "empty" ? { rolling: [], goalieGames: [] } : { rolling: recent.rolling as ShareRecentRollingRow[], goalieGames: recentRead === "goalies-failed" ? null : recent.goalieGames as ShareGoalieGameRow[],
      // chunk-failed (SS1-24): every other skater's id chunk timed out; only those players lose recent form.
      ...(recentRead === "chunk-failed" ? { failedIds: snapshot.players.players.filter((player, index) => player.group !== "G" && index % 2 === 0).map(player => player.nhlId) } : {}) }, generatedAt);
    // Fictional Tuesday source rows (lane TT): rolling rows 4 h old (80 h when stale), PP rows, Yahoo ownership history
    // (through today, or three days old when ownership is stale). "missing" replays the live server's loader failure.
    const trendContext = { season, fetchedAt: generatedAt, generatedAt }, today = localDate(generatedAt, "America/New_York");
    snapshot.trends = trends === "missing" ? buildTrendLayer(null, trendContext, "Trend sources could not be read.")
      : buildTrendLayer(fictionalTrendSources(season, today, new Date(Date.parse(generatedAt) - (trends === "stale" ? 80 : 4) * 3600000).toISOString(), { ownershipThrough: ownershipStale ? new Date(Date.parse(`${today}T12:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10) : today }), trendContext);
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
  const controller = { requests: 0, fail: false, mode: "ready" as Mode, longName: false, pinnedAt: undefined as string | undefined, rates: "ready" as Rates, players: "ready" as PlayerMode, trends: "ready" as Rates, recentRead: "ready" as RecentRead, liveTrim: false, longPlayer: false, widestLegend: false, ownershipStale: false, formEmpty: false, layoutStress: false, genuine: null as SocialShareSnapshot["trends"], latest: null as SocialShareSnapshot | null };
  await page.context().route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  // Evidence harness only (lane TT): serve committed logo bytes from a folder, so PNG pins can be checked while a
  // working-tree logo is modified by someone else. Unset in normal runs.
  const logoOverride = process.env.SOCIAL_SHARE_LOGO_OVERRIDE_DIR;
  if (logoOverride) await page.route("**/teamLogos/*.png", async route => {
    const file = `${logoOverride}/${new URL(route.request().url()).pathname.split("/").pop()}`;
    try { return route.fulfill({ body: await readFile(file), contentType: "image/png" }); } catch { return route.continue(); }
  });
  await page.route("**/api/v1/social-share/**", async route => {
    controller.requests++;
    // The edition API needs the fictional editor's bearer, as the real handler needs a session.
    if (route.request().headers().authorization !== `Bearer ${editorToken}`) return route.fulfill({ status: 401, json: { error: "Sign in to use the share studio." } });
    if (controller.fail) return route.fulfill({ status: 503, json: { error: "NHL schedule is unavailable. Refresh to retry." } });
    const url = new URL(route.request().url());
    let next = fixture(url.pathname.split("/").pop() as SocialShareFormat, url.searchParams.get("weekStart")!, controller.mode, controller.pinnedAt, controller.rates, controller.players, controller.trends, controller.recentRead, controller.ownershipStale);
    if (url.searchParams.has("selectedDates")) next = selectScheduleDates(next, url.searchParams.get("selectedDates")?.split(",").filter(Boolean) || []);
    if (controller.longName) {
      for (const row of next.rows) if (row.team.id === 1) row.team.name = "New Jersey Extremely Long Fantasy Hockey Team Name";
      for (const team of next.teams) if (team.id === 1) team.name = "New Jersey Extremely Long Fantasy Hockey Team Name";
    }
    // longPlayer: every night's first target gets a long real-world-style name (ticket 22 no-overflow check).
    if (controller.longPlayer && next.players) {
      const ids = new Set(streamingNights(next, true).flatMap(night => targetPicks(next, night, true).slice(0, 1).map(pick => pick.player.nhlId)));
      next = { ...next, players: { ...next.players, players: next.players.players.map(player => ids.has(player.nhlId) ? { ...player, name: "Jean-Gabriel Ekman-Larsson" } : player) } };
    }
    // liveTrim replays the live server's trim: only the cards' players leave, with tier counts.
    if (controller.liveTrim && next.players) next = { ...next, players: trimEditionPlayers(next, next.players) };
    // widestLegend (C7 R24 S1): the first night's first recorded pick covers all three tilts, the widest real legend.
    if (controller.widestLegend && next.players?.targets) {
      const first = streamingNights(next, true)[0], key = first && targetKey(first), list = key ? next.players.targets[key] : undefined;
      if (list?.length) next = { ...next, players: { ...next.players, targets: { ...next.players.targets, [key!]: [{ ...list[0], roles: ["scorer", "shooter", "blocker"] }, ...list.slice(1)] } } };
    }
    // layoutStress (TT-7b): whole-number movers (one-digit heroes, e.g. "−8" with 74% beside it) and the longest
    // real-world names on the first tiles of every list, so the geometry check sees the tightest layouts.
    if (controller.layoutStress && next.trends) {
      const long = ["Charle-Edouard D'Astous", "Oliver Bjorkstrand", "Ryan Nugent-Hopkins"];
      const rename = <T extends { name: string }>(list: T[], at = 0) => list.map((row, index) => index === 0 ? { ...row, name: long[at % long.length] } : row);
      const whole = <T extends { latest: number; previous: number; delta: number }>(list: T[], deltas: number[]): T[] => list.map((row, index) => ({ ...row, previous: Math.round(row.previous), latest: Math.round(row.previous) + deltas[index % deltas.length], delta: deltas[index % deltas.length] }));
      const { hot, deployment, rates, movers } = next.trends.sections;
      next = { ...next, trends: { ...next.trends, sections: {
        hot: { ...hot, hot: rename(hot.hot, 0), cold: rename(hot.cold, 1) },
        deployment: { ...deployment, up: rename(deployment.up, 1), down: rename(deployment.down, 2) },
        rates: { ...rates, sogPer60: rename(rates.sogPer60, 0), icfPer60: rename(rates.icfPer60, 1), ixgPer60: rename(rates.ixgPer60, 2) },
        movers: { ...movers, risers: rename(whole(movers.risers, [9, 3, 2, 1, 1]), 0), fallers: rename(whole(movers.fallers, [-8, -3, -2, -1, -1]), 2).map((row, index) => index === 0 ? { ...row, previous: 82, latest: 74, delta: -8 } : row) },
      } } };
    }
    // genuine (TT-2): a captured production trend layer on the offline fixture schedule. Schedule row abbreviations are
    // masked so no fixture "GP this week" chip sits beside a genuine player; logos still come from the edition's teams.
    // formEmpty (TT-3): Recent Form has no qualifier (early season); the other sections are unchanged.
    if (controller.formEmpty && next.trends) next = { ...next, trends: { ...next.trends, sections: { ...next.trends.sections, hot: { ...next.trends.sections.hot, qualifiers: 0, hot: [], cold: [] } } } };
    if (controller.genuine) next = { ...next, trends: controller.genuine, rows: next.rows.map(row => ({ ...row, team: { ...row.team, abbreviation: `x${row.team.abbreviation}` } })) };
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
  await expect(square).toContainText("TARGETED MATCHUPS");
  await expect(square).toContainText("Cherry-picked games");
  await expect(square).not.toContainText("STREAMING MATCHUPS");
  await expect(square).not.toContainText("Most signals first");
  const nights = streamingNights(source.latest!, true);
  expect(nights.length).toBeGreaterThan(0);
  const tiles = square.locator("[data-team]");
  await expect(tiles).toHaveCount(nights.length);
  expect(await tiles.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-team")))).toEqual(nights.map(night => night.team.abbreviation));
  // Ticket 22: up to 3 target mini-cards per night, from the tilt team only, exactly the library's picks and roles.
  const targetView = () => tiles.evaluateAll(nodes => nodes.map(node => Array.from(node.querySelectorAll("[data-target]")).map(card => `${card.getAttribute("data-target")}:${card.getAttribute("data-roles")}`)));
  const expectedTargets = nights.map(night => targetPicks(source.latest!, night, true).map(pick => `${pick.player.nhlId}:${pick.roles.join("|")}`));
  expect(await targetView()).toEqual(expectedTargets);
  expect(expectedTargets.flat().length).toBeGreaterThan(0);
  // TJ: fieldset cards with the role as a notched legend; the full name, position and value fit, nothing clipped.
  const cardText = () => square.locator("[data-target]").evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect(), parts = ["legend", "strong", "small", "em"].map(tag => node.querySelector(tag) as HTMLElement);
    // The legend sits in the border line, so "inside" can't catch it: compare its layout width with the inner width.
    const field = node as HTMLElement, style = getComputedStyle(field), inner = field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return { tag: node.tagName, legend: parts[0].textContent, name: parts[1].textContent, pos: parts[2].textContent, value: parts[3].textContent, legendFits: parts[0].offsetWidth <= inner + 0.5,
      inside: parts.every(part => { const r = part.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1; }),
      unclipped: parts.every(part => part.scrollWidth <= part.clientWidth + 1) };
  }));
  const checkCards = async () => {
    const cards = await cardText(), picks = nights.flatMap(night => targetPicks(source.latest!, night, true));
    expect(cards.map(card => [card.tag, card.legend, card.name, card.pos, card.value])).toEqual(picks.map(pick => ["FIELDSET", roleLabel(pick.roles), pick.player.name, pick.player.positions, pick.stat]));
    expect(cards.every(card => card.inside && card.unclipped && card.legendFits)).toBe(true);
  };
  await checkCards();
  await expect(square).toContainText("Picks = rostered <50% (Yahoo), season rates");
  for (const night of nights) for (const pick of targetPicks(source.latest!, night, true)) expect(pick.player.team).toBe(night.team.abbreviation);
  expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
  await expect(download).toBeEnabled();
  await downloadedPng(page, "monday-streaming-matchups");
  // A long name wraps inside its card instead of clipping, and the tiles still fit the square.
  source.longPlayer = true;
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(square).toContainText("Jean-Gabriel Ekman-Larsson");
  await checkCards();
  expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
  source.longPlayer = false;
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(square).not.toContainText("Jean-Gabriel Ekman-Larsson");
  // Live-shaped edition: the server trim keeps the picks, so the card shows the same targets.
  source.liveTrim = true;
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(tiles).toHaveCount(nights.length);
  await expect.poll(targetView).toEqual(expectedTargets);
  // The widest real legend (all three tilts) still fits inside its fieldset (C7 R24 S1).
  source.widestLegend = true;
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(square.locator("[data-roles='scorer|shooter|blocker']")).toHaveCount(1);
  await checkCards();
  await downloadedPng(page, "targeted-widest-legend");
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
    await expect(square).toContainText("Bands 30–49% · 20–29% · under 20%");
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

/** Tuesday card evidence (lane TT): listed player ids per card, from the edition the page received. */
function tuesdayCards(edition: SocialShareSnapshot): [string, string, string[]][] {
  const ids = (list: { nhlId: number }[]) => list.map(item => String(item.nhlId));
  return [
    ["hot", "RECENT FORM", [...ids(hotCold(edition, true).hot), ...ids(hotCold(edition, true).cold)]],
    ["deployment", "DEPLOYMENT CHANGES", [...ids(deploymentChanges(edition, true).up), ...ids(deploymentChanges(edition, true).down)]],
    ["rates", "RATE STANDOUTS", Object.values(rateStandouts(edition, true)).flatMap(ids)],
    ["movers", "OWNERSHIP MOVERS", [...ids(ownershipMovers(edition, true).risers), ...ids(ownershipMovers(edition, true).fallers)]],
  ];
}

test("Tuesday trend cards list the server's sections with definitions and a source line, and export", async ({ page }) => {
  const source = await install(page), errors: string[] = [];
  source.mode = "league";
  page.on("pageerror", error => errors.push(error.message));
  await open(page, "tuesday-trends");
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(graphic).toHaveValue("hot");
  await expect(download).toBeEnabled();
  const edition = source.latest!;
  for (const [card, title, expected] of tuesdayCards(edition)) {
    await graphic.selectOption(card);
    await expect(square).toContainText(title);
    for (const definition of trendDefinitions[card as "hot"]) await expect(square).toContainText(definition);
    // Compact source + freshness line: dates the reader can check on a phone.
    await expect(square.locator("[data-trend-source]")).toHaveText(card === "movers" ? /^Yahoo rostered % · [A-Z][a-z]{2} \d{1,2} → [A-Z][a-z]{2} \d{1,2} · not adds\/drops$/ : /^FHFH rolling metrics · games thru [A-Z][a-z]{2} \d{1,2} · updated [A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} [AP]M E[DS]T · not projections$/);
    await expect(square).toHaveAttribute("data-export-token", `${edition.id}|${card}|${edition.selectedDates.join(",")}`);
    expect(expected.length).toBeGreaterThanOrEqual(8);
    expect(await square.locator("[data-player]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-player")))).toEqual(expected);
    expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
    await expect(download).toBeEnabled();
    await downloadedPng(page, `tuesday-${card}`);
  }
  // Recent Form says what it is on the card (and so in the PNG): early season, small sample, rule id.
  await graphic.selectOption("hot");
  await expect(square).toContainText("Early season · small sample");
  await expect(square).toContainText("recent-form-v1-early");
  // Deployment: a hero never contradicts its column (TOI sign, or the role arrow for role-only rows).
  await graphic.selectOption("deployment");
  for (const column of ["up", "down"]) {
    const heroes = await square.locator(`[data-column="${column}"] [data-player] [class*="trendHero"] > strong`).allTextContents();
    expect(heroes.length).toBeGreaterThan(0);
    for (const hero of heroes) expect(hero.startsWith(column === "up" ? "+" : "−") || hero.startsWith(column === "up" ? "▲" : "▼")).toBe(true);
  }
  // TT-4: every tile's accent is the sign of its hero, and each sparkline shows the layer's observed values exactly.
  for (const [card, , expected] of tuesdayCards(edition)) {
    await graphic.selectOption(card);
    const tiles = square.locator("[data-player][data-tone]");
    await expect(tiles).toHaveCount(expected.length);
    for (const tile of await tiles.all()) {
      const hero = (await tile.locator("[class*='trendHero'] > strong").textContent())!;
      await expect(tile).toHaveAttribute("data-tone", /^[+▲]/.test(hero) ? "up" : /^[−▼]/.test(hero) ? "down" : "flat");
    }
    expect(await square.locator("[data-sparkline]").count()).toBeGreaterThan(0);
    // TT-5: every tile has art, inlined as a data URL (so the PNG carries it), neon in the tile's tone or the card fallback.
    for (const tile of await tiles.all()) {
      const art = tile.locator("[data-art]");
      await expect(art).toHaveCount(1);
      if (await art.getAttribute("data-art") === "neon") { await expect(art).toHaveAttribute("data-tone", (await tile.getAttribute("data-tone"))!); expect(await art.locator("img").getAttribute("src")).toMatch(/^data:image\/png;base64,/); }
    }
  }
  const shown = new Map([...edition.trends!.sections.hot.hot, ...edition.trends!.sections.hot.cold].map(row => [String(row.nhlId), row.series]));
  await graphic.selectOption("hot");
  for (const tile of await square.locator("[data-player]").all()) {
    const series = shown.get((await tile.getAttribute("data-player"))!), drawn = await tile.locator("[data-sparkline]").getAttribute("data-sparkline").catch(() => null);
    expect(drawn).toBe(series?.length && series.some(value => value !== null) ? series.map(value => value ?? "gap").join(",") : null);
  }
  // Movers are in percentage points of rostered %, never adds or drops.
  await graphic.selectOption("movers");
  await expect(square).toContainText("PCT PTS ROSTERED");
  // Fixture ownership carries decimals, so the change keeps one; whole-number sources show "+17" (unit test).
  expect(await square.locator("[data-player] [class*='trendHero'] strong").first().textContent()).toMatch(/^[+−]\d+\.\d$/);
  await expect(square).toHaveAttribute("aria-label", /^FHFH Tuesday trends, ownership movers.*PCT PTS ROSTERED.*pct pts = percentage-point change in Yahoo rostered %.*not adds\/drops\.$/);
  await graphic.selectOption("deployment");
  // Unknown PP is "PP ?", never "no PP".
  await expect(square.locator("[data-badge]").filter({ hasText: /no PP/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

/** TT-7b: per tile, the parts that must never collide, and whether the name stays in its column and off the logo. */
async function tileCollisions(page: Page) {
  return page.getByTestId("share-square").evaluate(square => {
    const problems: string[] = [];
    const overlap = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    for (const tile of Array.from(square.querySelectorAll<HTMLElement>("[data-player][data-tone]"))) {
      const id = tile.getAttribute("data-player"), box = tile.getBoundingClientRect(), find = (selector: string) => tile.querySelector<HTMLElement>(selector);
      const name = find("[class*='trendTileName']")!, parts: [string, Element | null][] = [["name", name], ["hero", find("[class*='trendHero'] > strong")], ["absolute", find("[class*='trendTileAbsolute']")],
        ["kind", find("[class*='trendTileKind']")], ...Array.from(tile.querySelectorAll("[class*='trendTileDetail']")).map((detail, index): [string, Element] => [`detail${index}`, detail]), ["chips", find("[class*='trendTileChips']")]];
      const rects = parts.filter((part): part is [string, Element] => !!part[1]).map(([label, element]) => [label, element.getBoundingClientRect()] as const);
      for (let i = 0; i < rects.length; i++) {
        const [label, rect] = rects[i];
        if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5 || rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5) problems.push(`${id}: ${label} outside the tile`);
        for (let j = i + 1; j < rects.length; j++) if (overlap(rect, rects[j][1])) problems.push(`${id}: ${label} overlaps ${rects[j][0]}`);
      }
      // The export (html-to-image) re-lays out a clone, where a wrapping hero row once dropped the absolute block onto
      // the label (TT-7b): the row must be no-wrap, one line, with the absolute block level with the hero.
      const heroRow = find("[class*='trendTileHeroRow']"), heroText = find("[class*='trendHero'] > strong"), absolute = find("[class*='trendTileAbsolute']");
      if (heroRow && heroText && absolute) {
        const row = heroRow.getBoundingClientRect(), heroBox = heroText.getBoundingClientRect(), absBox = absolute.getBoundingClientRect();
        if (getComputedStyle(heroRow).flexWrap !== "nowrap") problems.push(`${id}: hero row may wrap`);
        if (absBox.left < heroBox.right - 0.5 || absBox.top > heroBox.bottom || row.height > Math.max(heroBox.height, absBox.height) + 1) problems.push(`${id}: absolute value not beside the hero`);
      }
      const column = name.parentElement!.getBoundingClientRect(), nameBox = name.getBoundingClientRect(), logo = find("[data-art] img")?.getBoundingClientRect();
      if (nameBox.left < column.left - 0.5 || nameBox.right > column.right + 0.5 || name.scrollWidth > name.clientWidth + 1) problems.push(`${id}: name leaves its column`);
      if (logo) {
        const visible = new DOMRect(Math.max(logo.left, box.left), Math.max(logo.top, box.top), Math.min(logo.right, box.right) - Math.max(logo.left, box.left), Math.min(logo.bottom, box.bottom) - Math.max(logo.top, box.top));
        if (overlap(nameBox, visible)) problems.push(`${id}: name overlaps the logo`);
      }
    }
    return problems;
  });
}

test("Tuesday tiles never collide: hero, absolute, label, details and chips stay apart; names stay in their column (TT-7b)", async ({ page }) => {
  const source = await install(page);
  source.mode = "league"; source.layoutStress = true;
  await open(page, "tuesday-trends");
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  for (const card of ["hot", "deployment", "rates", "movers"]) {
    await graphic.selectOption(card);
    await expect(square.locator("[data-player][data-tone]").first()).toBeVisible();
    expect(await tileCollisions(page), card).toEqual([]);
  }
  // The stress set reached the tight cases: a one-digit hero with its absolute beside it, and the longest names.
  const heroes = await square.locator("[class*='trendHero'] > strong").allTextContents();
  expect(heroes).toContain("−8");
  await expect(square.locator("[data-player]").first()).toContainText("CHARLE-EDOUARD D'ASTOUS", { ignoreCase: true });
  await graphic.selectOption("rates");
  await expect(square).toContainText("Oliver Bjorkstrand", { ignoreCase: true });
});

test("an empty Recent Form shows an honest empty state and never blocks the other Tuesday exports (TT-3)", async ({ page }) => {
  const source = await install(page);
  source.mode = "league"; source.formEmpty = true;
  await open(page, "tuesday-trends");
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(graphic).toHaveValue("hot");
  await expect(square.locator("[data-empty-form]")).toContainText("No qualifiers yet");
  await expect(square.locator("[data-player]")).toHaveCount(0);
  await expect(download).toBeDisabled();
  for (const card of ["deployment", "rates", "movers"]) {
    await graphic.selectOption(card);
    await expect(square.locator("[data-player]").first()).toBeVisible();
    await expect(download).toBeEnabled();
    await downloadedPng(page, `tuesday-${card}-with-empty-form`);
  }
});

test("Tuesday cards never rank stale or failed sources, and say why with the as-of date", async ({ page }) => {
  const source = await install(page);
  source.mode = "league"; source.trends = "stale";
  await open(page, "tuesday-trends");
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  for (const card of ["hot", "deployment", "rates", "movers"]) {
    await graphic.selectOption(card);
    await expect(square).toContainText("Ranking unavailable");
    await expect(square).toContainText(card === "movers" ? "Team identity needs current rolling rows: Rolling metrics are stale: last updated" : "Rolling metrics are stale: last updated");
    await expect(square.locator("[data-player]")).toHaveCount(0);
    await expect(download).toBeDisabled();
  }
  // Stale ownership blocks only the movers card.
  source.trends = "ready"; source.ownershipStale = true;
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await graphic.selectOption("movers");
  await expect(square).toContainText("Yahoo ownership is stale: last observed");
  await expect(download).toBeDisabled();
  await downloadedPreview(page, "tuesday-movers-stale-preview");
  await graphic.selectOption("rates");
  await expect(download).toBeEnabled();
  // A failed live read: every section unavailable with the server's reason, never fixture values.
  source.ownershipStale = false; source.trends = "missing";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  for (const card of ["hot", "deployment", "rates", "movers"]) {
    await graphic.selectOption(card);
    await expect(square).toContainText("Trend sources could not be read");
    await expect(square.locator("[data-player]")).toHaveCount(0);
    await expect(download).toBeDisabled();
  }
  await downloadedPreview(page, "tuesday-sources-unavailable-preview");
});

test("a Tuesday PNG is refused when the preview changes between click and capture", async ({ page }) => {
  const source = await install(page);
  source.mode = "league";
  await open(page, "tuesday-trends");
  const square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(download).toBeEnabled();
  // Hold the export's font embedding, swap the preview's token, then let the capture continue.
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/fonts/social-share/**", async route => { await held; await route.continue(); });
  const downloads: string[] = [];
  page.on("download", item => downloads.push(item.suggestedFilename()));
  await download.click();
  await expect(page.getByRole("button", { name: "Creating PNG…", exact: true })).toBeVisible();
  await square.evaluate(node => node.setAttribute("data-export-token", "another-edition|hot|"));
  release();
  await expect(page.getByRole("status")).toHaveText("The preview changed after Download was clicked. Download again.");
  expect(downloads).toEqual([]);
});

test("Tuesday OFFLINE FIXTURE evidence: desktop, phone and 1080 PNG per card", async ({ page }) => {
  const source = await install(page), shots = process.env.TUESDAY_EVIDENCE_DIR || evidence;
  source.mode = "league";
  await mkdir(shots, { recursive: true });
  const label = () => page.evaluate(() => {
    if (document.querySelector("[data-offline-fixture]")) return;
    const banner = document.createElement("div");
    banner.setAttribute("data-offline-fixture", "");
    banner.textContent = "OFFLINE FIXTURE · fictional rows shaped like the real columns · not production data";
    Object.assign(banner.style, { position: "fixed", top: "0", left: "0", right: "0", zIndex: "9999", padding: "6px 12px", font: "700 14px sans-serif", background: "#ffcc00", color: "#000", textAlign: "center" });
    document.body.appendChild(banner);
  });
  for (const [viewport, name] of [[{ width: 1440, height: 1100 }, "desktop"], [{ width: 390, height: 844 }, "phone"]] as const) {
    await page.setViewportSize(viewport);
    await open(page, "tuesday-trends");
    for (const card of ["hot", "deployment", "rates", "movers"]) {
      await page.getByRole("combobox", { name: /^Graphic/ }).selectOption(card);
      await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
      await page.getByTestId("share-square").scrollIntoViewIfNeeded();
      await label();
      await page.screenshot({ path: `${shots}/OFFLINE-FIXTURE-${name}-${card}.png`, fullPage: name === "phone" ? false : true });
      if (name === "desktop") {
        const pending = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download PNG", exact: true }).click();
        await (await pending).saveAs(`${shots}/OFFLINE-FIXTURE-png-${card}.png`);
      }
    }
  }
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
  await expect(square).toContainText(`${label} · Pickups`, { ignoreCase: true });
  await expect(square).not.toContainText("schedules first", { ignoreCase: true });
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
  // SS1-17: only the goalie source failed, so only goalie tiles say so; skaters keep their L5 lines.
  source.recentRead = "goalies-failed";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(tiles).toHaveCount(9);
  for (let i = 0; i < 6; i++) { await expect(tiles.nth(i)).not.toContainText("Recent form unavailable"); await expect(tiles.nth(i)).toContainText("SOG"); }
  for (let i = 6; i < 9; i++) await expect(tiles.nth(i)).toContainText("Recent form unavailable");
  // SS1-24: one failed id chunk costs only its own players; each tile matches its own player's state.
  source.recentRead = "chunk-failed";
  await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  await expect(tiles).toHaveCount(9);
  await expect.poll(() => source.latest?.players?.recentUnavailableIds?.length ?? 0).toBeGreaterThan(0);
  const failedIds = new Set(source.latest!.players!.recentUnavailableIds!.map(String));
  const states = await tiles.evaluateAll(nodes => nodes.map(node => [node.getAttribute("data-player"), node.textContent?.includes("Recent form unavailable") ?? false] as const));
  expect(states.some(([, unavailable]) => unavailable)).toBe(true);
  expect(states.some(([, unavailable]) => !unavailable)).toBe(true);
  for (const [id, unavailable] of states) expect([id, unavailable]).toEqual([id, failedIds.has(id!)]);
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
    await expect(square).toContainText("Under 50% rostered");
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

test("cards carry no ordering or selection-rule captions (SS1-17, TJ)", async ({ page }) => {
  const source = await install(page);
  source.mode = "league";
  await open(page);
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square");
  await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  const removed = ["Ranked by Game Grid Week Score", "Most signals first", "one night per team", "Week Score teams first", "wider pool fills to three", "schedules first",
    "ranked by L5 score", "each by L5 score", "best Week Score first", "fold in the next pair", "Strictly tier teams only", "games left ·"];
  for (const card of ["grid", "leaders", "easiest", "stream", "pickups-50", "pickups-30", "pickups-20", "specialists", "tiers", "tiers-wide"]) {
    await graphic.selectOption(card);
    await expect(square.locator("footer")).toBeVisible();
    const text = await square.innerText();
    for (const caption of removed) expect(text, `${card}: ${caption}`).not.toContain(caption);
  }
  // Source and as-of lines, ownership bands and limitation disclosures stay.
  await graphic.selectOption("pickups-50");
  await expect(square).toContainText("Bands 30–49% · 20–29% · under 20%");
  await expect(square).toContainText("Not projections");
  await expect(square).toContainText("Yahoo rostered % as of");
  await graphic.selectOption("grid");
  await expect(square).toContainText("No odds or projections");
});

test("hot and cold streak badges sit beside the L5 line and match the streak rules (SS1-18)", async ({ page }) => {
  const source = await install(page);
  source.mode = "league";
  await open(page);
  const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square");
  await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  const counts = { hot: 0, cold: 0 };
  for (const [card, context] of [["pickups-50", "pickup"], ["pickups-30", "pickup"], ["pickups-20", "pickup"], ["specialists", "specialist"], ["tiers", "tier"], ["tiers-wide", "tier"]] as [string, StreakContext][]) {
    await graphic.selectOption(card);
    await expect(square.locator("[data-player]").first()).toBeVisible();
    const byId = new Map(source.latest!.players!.players.map(player => [String(player.nhlId), player]));
    const rows = await square.locator("[data-player]").evaluateAll(nodes => nodes.map(node => ({ id: node.getAttribute("data-player")!, streak: node.querySelector("[data-streak]")?.getAttribute("data-streak") ?? null,
      reasons: node.querySelector("[data-streak]")?.getAttribute("data-reasons") ?? null })));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const expected = streakOf(byId.get(row.id)!, context);
      expect({ id: row.id, card, streak: row.streak, reasons: row.reasons }).toEqual({ id: row.id, card, streak: expected?.kind ?? null, reasons: expected ? expected.reasons.join("|") : null });
      if (expected) counts[expected.kind]++;
    }
    expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
  }
  // The fixture exercises both kinds.
  expect(counts.hot).toBeGreaterThan(0);
  expect(counts.cold).toBeGreaterThan(0);
  await graphic.selectOption("pickups-50");
  await downloadedPng(page, "streaks-pickups-50");
  await graphic.selectOption("specialists");
  await downloadedPng(page, "streaks-specialists");
  await graphic.selectOption("tiers-wide");
  await downloadedPng(page, "streaks-tiers-wide");
});

test("Tuesday GENUINE DATA render: captured layer, offline, export token per card", async ({ page }) => {
  const file = process.env.TUESDAY_GENUINE_LAYER;
  test.skip(!file, "Set TUESDAY_GENUINE_LAYER to a captured layer.json (TT-2).");
  const capture = JSON.parse(await readFile(file!, "utf8")) as { capturedAt: string; layer: NonNullable<SocialShareSnapshot["trends"]> };
  const source = await install(page), shots = process.env.TUESDAY_GENUINE_DIR || evidence;
  source.mode = "league"; source.genuine = capture.layer;
  await mkdir(shots, { recursive: true });
  const label = () => page.evaluate(text => {
    if (document.querySelector("[data-genuine]")) return;
    const banner = document.createElement("div");
    banner.setAttribute("data-genuine", "");
    banner.textContent = text;
    Object.assign(banner.style, { position: "fixed", top: "0", left: "0", right: "0", zIndex: "9999", padding: "6px 12px", font: "700 14px sans-serif", background: "#00c853", color: "#000", textAlign: "center" });
    document.body.appendChild(banner);
  }, `GENUINE DATA (captured ${capture.capturedAt}), rendered locally · schedule panel is the offline fixture`);
  const tokens: Record<string, { token: string; expected: string; png: string }> = {};
  for (const [viewport, name] of [[{ width: 1440, height: 1100 }, "desktop"], [{ width: 390, height: 844 }, "phone"]] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/social-share/tuesday-trends");
    await page.getByLabel("Week of (Monday)").fill("2026-10-26");
    await expect(page.getByRole("button", { name: "Refresh schedule", exact: true })).toBeEnabled();
    for (const card of ["hot", "deployment", "rates", "movers"]) {
      await page.getByRole("combobox", { name: /^Graphic/ }).selectOption(card);
      const square = page.getByTestId("share-square");
      await expect(square).toContainText(card === "hot" ? "RECENT FORM" : card === "deployment" ? "DEPLOYMENT CHANGES" : card === "rates" ? "RATE STANDOUTS" : "OWNERSHIP MOVERS");
      await expect(square).not.toContainText("GP this week");
      expect(await tileCollisions(page), `genuine ${card}`).toEqual([]);
      await square.scrollIntoViewIfNeeded();
      await label();
      await page.screenshot({ path: `${shots}/GENUINE-DATA-${name}-${card}.png`, fullPage: name === "desktop" });
      if (name !== "desktop") continue;
      const edition = source.latest!, expected = `${edition.id}|${card}|${edition.selectedDates.join(",")}`, token = (await square.getAttribute("data-export-token"))!;
      expect(token).toBe(expected);
      const download = page.getByRole("button", { name: "Download PNG", exact: true });
      if (await download.isDisabled()) { tokens[card] = { token, expected, png: "not exportable (no rows qualify)" }; await square.screenshot({ path: `${shots}/GENUINE-DATA-preview-${card}.png` }); continue; }
      const pending = page.waitForEvent("download");
      await download.click();
      const saved = await pending, png = `${shots}/GENUINE-DATA-png-${card}.png`;
      await saved.saveAs(png);
      expect(saved.suggestedFilename()).toContain(edition.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20));
      tokens[card] = { token, expected, png: saved.suggestedFilename() };
    }
  }
  await writeFile(`${shots}/GENUINE-DATA-export-tokens.json`, `${JSON.stringify({ capturedAt: capture.capturedAt, tokens }, null, 2)}\n`);
});
