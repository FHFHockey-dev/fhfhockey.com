import { expect, test, type Page } from "@playwright/test";
import { parseShareSettings } from "../lib/socialShare/modules/contract";
import { buildLastNightsStandouts, lastNightsStandoutsModule, type LastNightsStandoutsInput, type LastNightsStandoutsSettings } from "../lib/socialShare/modules/lastNightsStandouts";
import { ownershipOf } from "../lib/socialShare/modules/shared/definitions";
import type { GoalieAppearance } from "../lib/socialShare/modules/shared/goalieLedger";
import type { SkaterAppearance } from "../lib/socialShare/modules/shared/skaterAppearances";

/**
 * Last Nights Standouts: fictional players through the real builder, with the same fictional editor session as
 * social-share.spec.ts. Run with NEXT_PUBLIC_SUPABASE_URL on a reserved .invalid host.
 */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const editorToken = "e2e-fictional-editor-token";
async function signIn(page: Page) {
  expect(supabaseOrigin.hostname.endsWith(".invalid")).toBe(true);
  const user = { id: "00000000-0000-4000-8000-00000000e2e2", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
  const session = { access_token: editorToken, refresh_token: "e2e-fictional-refresh", token_type: "bearer", expires_in: 365 * 86400, expires_at: Math.floor(Date.now() / 1000) + 365 * 86400, user };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${supabaseOrigin.hostname.split(".")[0]}-auth-token`, JSON.stringify(session)]);
  await page.route(`${supabaseOrigin.origin}/**`, route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET") return route.abort();
    const one = (row: object) => route.fulfill({ json: /vnd\.pgrst\.object/.test(request.headers().accept ?? "") ? row : [row] });
    if (url.pathname === "/rest/v1/users") return one({ role: "social_editor" });
    if (url.pathname === "/rest/v1/user_profiles") return one({ user_id: user.id, display_name: "Fictional editor", avatar_url: null, timezone: "America/New_York" });
    if (url.pathname === "/rest/v1/user_settings") return one({ user_id: user.id });
    if (url.pathname === "/auth/v1/user") return route.fulfill({ json: user });
    return route.abort();
  });
}

const SLATE = "2026-10-31", SEASON = 20262027, PRIOR = ["2026-10-20", "2026-10-22", "2026-10-24", "2026-10-26"], PLAYERS = 12;
const game = (playerId: number, date: string, gameId: number, over: Partial<SkaterAppearance> = {}): SkaterAppearance => ({
  playerId, name: `Fictional Long Name ${playerId}`, position: playerId % 3 ? "C" : "D", group: playerId % 3 ? "F" : "D", gameId, date, team: playerId % 2 ? "NJD" : "NYR", opponent: playerId % 2 ? "NYR" : "NJD", home: true,
  goals: 0, assists: 0, points: 0, shots: 2, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 1000, ppToiSeconds: playerId === 2 ? 0 : 100, penaltyMinutes: 0, ...over,
});
const LONG_NAME = "Maximilian Fictional-Vanderlongname Abdelkader-Ekman-Larsson";
const appearances = Array.from({ length: PLAYERS }, (_, index) => {
  const id = index + 1;
  // Player 12 carries real-world extremes: the longest name and goal line the sidebar has to hold.
  if (id === 12) return [...PRIOR.map((date, day) => game(id, date, 100 + day, { name: LONG_NAME })), game(id, SLATE, 900, { name: LONG_NAME, shots: 1, goals: 10, assists: 10, points: 20, ppPoints: 10, toiSeconds: 1800, ppToiSeconds: 20 })];
  return [...PRIOR.map((date, day) => game(id, date, 100 + day)), game(id, SLATE, 900, { shots: 12 - index, goals: index === 0 ? 1 : 0, assists: index === 0 ? 2 : 0, points: index === 0 ? 3 : index % 3, ppPoints: index === 0 ? 2 : 0, toiSeconds: 1000 + index * 60, ppToiSeconds: index === 1 ? 240 : index === 0 ? 100 : 20 })];
}).flat();
const nst = (date: string, playerId: number) => ({ player_id: playerId, date_scraped: date, season: SEASON, ixg: 0.5 + playerId / 10, iscfs: 2, icf: 4 });
const nstDates = [...PRIOR, SLATE];
const ids = Array.from({ length: PLAYERS }, (_, index) => index + 1);
const goalie = (goalieId: number, saves: number, shots: number): GoalieAppearance => ({ goalieId, name: `Fictional Goalie ${goalieId}`, gameId: 900, date: SLATE, team: goalieId % 2 ? "NJD" : "NYR", opponent: goalieId % 2 ? "NYR" : "NJD", home: true, started: true, wins: 1, losses: 0, otLosses: 0, saves, shotsAgainst: shots, goalsAgainst: shots - saves, toiSeconds: 3600, shutouts: 0, qualityStart: 1 });
const settingsFrom = (query: URLSearchParams) => parseShareSettings(lastNightsStandoutsModule, Object.fromEntries(query), "server") as LastNightsStandoutsSettings;
const shared = (settings: LastNightsStandoutsSettings): LastNightsStandoutsInput => ({
  slate: SLATE, season: SEASON, settings, completedTeamGames: [{ gameId: 900 }, { gameId: 900 }], scheduledGameIds: [900],
  // Rostered 5%, 10%, 15%...: player 10 sits exactly on 50 and is out of "Under 50%".
  ownership: { byPlayer: new Map(ids.map(id => [id, ownershipOf(id * 5, SLATE)])), updatedAt: `${SLATE}T08:00:00` },
});
const body = (query: URLSearchParams) => {
  const settings = settingsFrom(query), input = shared(settings);
  const result = settings.view === "goalies"
    ? buildLastNightsStandouts({ ...input, goalies: [goalie(1, 29, 30), goalie(2, 19, 20), goalie(3, 4, 5)], nstGoalies: [{ player_id: 1, player_name: "Fictional", date_scraped: SLATE, season: SEASON, toi: 60, xg_against: 3.5, goals_against: 1, shots_against: 30 }] })
    : buildLastNightsStandouts({ ...input, appearances, nstCounts: nstDates.flatMap(date => ids.map(id => nst(date, id))), nstOnIce: nstDates.flatMap(date => ids.map(id => ({ player_id: id, date_scraped: date, season: SEASON, xgf: 1, xga: 1 }))), role: { rolling: ids.map(id => ({ player_id: id, game_id: 900, line_combo_slot: 1 + (id % 3), line_combo_group: id % 3 ? "forward" : "defense" })), pp: [{ gameId: 900, playerId: 1, unit: 1 }] } });
  const generatedAt = new Date().toISOString();
  return { schemaVersion: 1, id: "standouts-e2e", post: lastNightsStandoutsModule.id, generatedAt, expiresAt: new Date(Date.parse(generatedAt) + 600000).toISOString(), timeZone: "America/New_York", settings, fixture: false, state: result.state, reasons: result.reasons ?? [], evidence: result.evidence, data: result.data, teams: result.teams ?? [] };
};
async function open(page: Page, query = "") {
  await signIn(page);
  await page.route("**/api/v1/social-share/posts/**", route => {
    const url = new URL(route.request().url());
    expect(route.request().headers().authorization).toBe(`Bearer ${editorToken}`);
    return route.fulfill({ json: body(url.searchParams) });
  });
  await page.goto(`/social-share/posts?post=${lastNightsStandoutsModule.id}${query}`);
  await expect(page.getByTestId("share-square")).toBeVisible();
}
/** Nothing clipped at 860px, no cell overflowing, and no dead band under the last row. */
const expectFits = (page: Page) => expect.poll(() => page.getByTestId("share-square").evaluate(square => {
  const body = square.querySelector("[class*=postBody]"), rows = [...square.querySelectorAll("[data-testid=standout-row]")];
  if (!body || !rows.length) return "no rows";
  if (body.scrollHeight > body.clientHeight + 1 || square.scrollHeight > square.clientHeight + 1) return "clipped";
  const overflow = (node: Element) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
  if (rows.some(overflow) || [...square.querySelectorAll("[data-testid=stat-tile]")].some(overflow) || [...square.querySelectorAll("[class*=who]")].some(overflow)) return "clipped row";
  const band = body.getBoundingClientRect().bottom - rows[rows.length - 1].getBoundingClientRect().bottom;
  return band > 40 ? `dead band ${band}` : "fits";
})).toBe("fits");
/** Every option's box is clear of the next one, and everything it prints stays inside it. */
const optionLayout = (page: Page) => page.getByTestId("standouts-list").evaluate(list => {
  const options = [...list.querySelectorAll("[data-testid=standout-option]")], boxes = options.map(node => node.getBoundingClientRect());
  for (let index = 1; index < boxes.length; index++) if (boxes[index].top < boxes[index - 1].bottom - 0.5) return `option ${index} overlaps the one before`;
  for (const [index, node] of options.entries()) for (const child of node.querySelectorAll("*")) {
    const box = child.getBoundingClientRect();
    if (box.width && (box.left < boxes[index].left - 0.5 || box.right > boxes[index].right + 0.5 || box.top < boxes[index].top - 0.5 || box.bottom > boxes[index].bottom + 0.5)) return `option ${index}: ${child.tagName} "${child.textContent}" leaves its box`;
  }
  return "clear";
});
const option = (page: Page, id: number) => page.locator(`[data-testid=standout-option][data-player="${id}"]`);
const download = (page: Page) => page.getByRole("button", { name: "Download PNG", exact: true });

test.beforeEach(({ page }) => page.setDefaultTimeout(10000));

test("a hand-built view starts blank with a clear message and no export", async ({ page }) => {
  await open(page, "&view=under");
  await expect(page.getByTestId("standouts-blank")).toContainText("Pick up to 8 skaters");
  await expect(page.getByTestId("standouts-view")).toContainText("Under 50% rostered");
  await expect(page.getByTestId("share-square")).toContainText("LAST NIGHTS STANDOUTS");
  await expect(page.getByTestId("standout-row")).toHaveCount(0);
  await expect(download(page)).toBeDisabled();
  await expect(page.getByTestId("standouts-count")).toContainText("0 of 8");
});

test("the sidebar lists only who meets the roster limit, at its boundary", async ({ page }) => {
  await open(page, "&view=under");
  // Rostered 5% through 45% are under 50; exactly 50 is not.
  await expect(page.getByTestId("standout-option")).toHaveCount(9);
  await expect(option(page, 9)).toBeVisible();
  await expect(option(page, 10)).toHaveCount(0);
  await page.locator("label", { hasText: /^Under X% rostered/ }).locator("input").fill("51");
  await expect(option(page, 10)).toBeVisible();
});

test("the card follows pick order, a click removes, and picks unlock the export", async ({ page }) => {
  await open(page, "&view=all");
  await expect(page.getByTestId("standout-option")).toHaveCount(PLAYERS);
  await option(page, 3).click();
  await option(page, 1).click();
  const rows = page.getByTestId("standout-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Fictional Long Name 3");
  await expect(rows.nth(1)).toContainText("Fictional Long Name 1");
  await expect(option(page, 3).getByTestId("pick-order")).toHaveText("1");
  await expect(page).toHaveURL(/picks=3%2C1/);
  await expect(page.getByTestId("standouts-count")).toContainText("2 of 8");
  await expect(download(page)).toBeEnabled();
  await expect(page.getByTestId("standouts-legend")).toContainText("Picked by hand");
  await expectFits(page);
  await option(page, 3).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Fictional Long Name 1");
  await option(page, 1).click();
  await expect(page.getByTestId("standouts-blank")).toBeVisible();
  await expect(download(page)).toBeDisabled();
});

test("the sidebar sorts by the night's value and by the jump, and stops at the card's maximum", async ({ page }) => {
  await open(page, "&view=all");
  const first = page.getByTestId("standout-option").first();
  await page.getByTestId("standouts-sort").selectOption("sog");
  await expect(first).toHaveAttribute("data-player", "1");
  await page.getByTestId("standouts-sort").selectOption("ppToi");
  // Player 2 has the night's most PP time, but a zero baseline: top by value, last by jump.
  await expect(first).toHaveAttribute("data-player", "2");
  await page.getByRole("button", { name: "Jump vs STD" }).click();
  await expect(first).not.toHaveAttribute("data-player", "2");
  await expect(page.getByTestId("standout-option").last()).toHaveAttribute("data-player", "2");
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) await option(page, id).click();
  await expect(page.getByTestId("standouts-count")).toContainText("8 of 8");
  await expect(option(page, 9)).toBeDisabled();
  await expect(option(page, 8)).toBeEnabled();
  await expect(page.getByTestId("standout-row")).toHaveCount(8);
  await expectFits(page);
});

test("sidebar rows take their natural height, in a list that scrolls", async ({ page }) => {
  await open(page, "&view=all");
  await option(page, 12).click();
  await option(page, 1).click();
  await expect(page.getByTestId("standouts-count")).toContainText("2 of 8");
  await expect.poll(() => optionLayout(page)).toBe("clear");
  await expect.poll(() => page.getByTestId("standouts-list").evaluate(list => getComputedStyle(list).overflowY)).toBe("auto");
  expect(await option(page, 12).evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(60);
});

test("the sidebar stays inside a phone's width with long values and picks made", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, "&view=all");
  await option(page, 12).click();
  await option(page, 2).click();
  await expect(page.getByTestId("standouts-count")).toContainText("2 of 8");
  await expect.poll(() => optionLayout(page)).toBe("clear");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect.poll(() => page.getByTestId("standouts-list").evaluate(list => list.scrollWidth <= list.clientWidth)).toBe(true);
});

test("a skater row prints the goal line, chips, every stat and a dash for a zero baseline", async ({ page }) => {
  await open(page, "&view=all&picks=1,2,3");
  const [one, two] = [page.getByTestId("standout-row").first(), page.getByTestId("standout-row").nth(1)];
  await expect(one.getByTestId("goal-line")).toHaveText("1G-2A-3P-2PPP");
  await expect(two.getByTestId("goal-line")).toHaveText("0G-0A-1P");
  await expect(one.getByTestId("pp-chip")).toHaveText("PP1");
  // Player 2 has no unit but 4:00 of NHL.com PP time, so "Off PP" would contradict it. Player 3 has 0:20 and really is off.
  await expect(two.getByTestId("pp-chip")).toHaveText("PP —");
  await expect(page.getByTestId("standout-row").nth(2).getByTestId("pp-chip")).toHaveText("Off PP");
  await expect(one.getByTestId("line-chip")).toHaveText("L2");
  await expect(one.getByTestId("stat-tile")).toHaveCount(7);
  await expect(one.locator("[data-stat=sog]")).toContainText("+500%");
  await expect(two.locator("[data-stat=ppToi]")).toContainText("—");
  await expect(two.locator("[data-stat=ppToi]")).not.toContainText("%");
  await expect(one.locator("[data-stat=sog]")).toHaveCSS("background-color", "rgba(0, 255, 153, 0.14)");
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  await expect(page.getByTestId("share-square")).not.toContainText(/monstrous|forecast|projected/i);
});

test("top forwards and top defensemen rank themselves and state the sort", async ({ page }) => {
  await open(page, "&view=forwards");
  await expect(page.getByTestId("standouts-view")).toContainText("Top forwards");
  await expect(page.getByTestId("standout-row")).toHaveCount(8);
  await expect(page.getByTestId("standout-row").first()).toContainText("Fictional Long Name 1");
  await expect(page.getByTestId("standouts-legend")).toContainText("Top 8 of 8 by points, then SOG, xG, TOI.");
  await expect(page.getByTestId("standouts-auto-note")).toBeVisible();
  await expect(download(page)).toBeEnabled();
  await expectFits(page);
  await page.goto(`/social-share/posts?post=${lastNightsStandoutsModule.id}&view=defensemen`);
  await expect(page.getByTestId("standouts-view")).toContainText("Top defensemen");
  await expect(page.getByTestId("standout-row")).toHaveCount(4);
  await expectFits(page);
});

test("goalies say when NST lags, and a missing GSAx stays a dash", async ({ page }) => {
  await open(page, "&view=goalies");
  const square = page.getByTestId("share-square");
  await expect(page.getByTestId("standouts-view")).toContainText("Goalies");
  await expect(square.locator("[class*=gridTitle] p")).toHaveText("Goalies", { ignoreCase: true });
  for (const label of ["SV", "SA", "GA", "SV%", "TOI", "GSAx"]) await expect(square).toContainText(label);
  await expect(page.getByTestId("goalie-gsax")).toHaveText("+2.50");
  await expect(page.getByTestId("nst-goalie-note")).toContainText("NST has no row yet for 2 of 3 goalies");
  await expect(square).not.toContainText("Fictional Goalie 3");
  await expect(download(page)).toBeEnabled();
});
