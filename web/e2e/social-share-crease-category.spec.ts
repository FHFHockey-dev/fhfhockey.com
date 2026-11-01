import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { buildCreaseShift, reconcileSchedule } from "../lib/socialShare/modules/creaseShift";
import { buildGoalieGsax } from "../lib/socialShare/modules/goalieGsax";
import { buildGoaliePeriod } from "../lib/socialShare/modules/goaliePeriod";
import { weekPeriod } from "../lib/socialShare/modules/shared/categoryCounts";
import type { GoalieAppearance } from "../lib/socialShare/modules/shared/goalieLedger";
import { teamsInfo } from "../lib/teamsInfo";

/*
 * Crease Shift and Category Counts (SS 8.0, 9.0), run serially by the lead at 13.0. Fictional goalies on real team ids go
 * through the post builders, so the served snapshots have their real shapes; nothing reaches Supabase.
 * Run the dev server and this spec with NEXT_PUBLIC_SUPABASE_URL set to a fictional .invalid host, as for social-share.spec.ts.
 */
const editorToken = "e2e-fictional-editor-token";
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const generatedAt = () => new Date().toISOString();
const stat = (goalieId: number, team: string, gameId: number, date: string, values: Partial<GoalieAppearance> = {}): GoalieAppearance => ({ goalieId, name: `Fictional Goalie ${goalieId}`, gameId, date, team, opponent: null, home: null, started: true, wins: 0, losses: 0, otLosses: 0, saves: 25, shotsAgainst: 28, goalsAgainst: 3, toiSeconds: 3600, shutouts: 0, qualityStart: 0, ...values });
const days = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"];
const scheduled = days.map((date, index) => ({ id: index + 1, date, homeTeamId: teamsInfo.NJD.id, awayTeamId: teamsInfo.NYR.id }));
const reported = scheduled.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
const appearances = scheduled.flatMap((game, index) => [
  stat(index < 2 ? 1 : 2, "NJD", game.id, game.date, { wins: 1, saves: 34, shotsAgainst: 35, goalsAgainst: 1 }),
  stat(3, "NYR", game.id, game.date, { losses: 1, saves: 20, shotsAgainst: 24, goalsAgainst: 4 }),
]);
const week = { week: 4, start: "2026-10-19", end: "2026-10-25" };
const periodSettings = { period: "week", week: 4, month: "", minStartsWeek: 2, minStartsMonth: 5, board: "both", categories: "wins,saves,svPct,gaa,shutouts" };
const tgv = { goalies: [{ goalie_id: 1, week: 4, weekly_gs: 2, weekly_toi_seconds: 7200, weekly_wins: 2, weekly_saves: 68, weekly_sv_pct: 0.97 }], league: [{ week: 4, avg_league_weekly_wins: 1, avg_league_weekly_saves: 40, avg_league_weekly_sv_pct: 0.9 }], weeks: [week] } as never;

function edition(post: string, settings: Record<string, unknown>, result: { state: string; reasons?: string[]; evidence: unknown; data: unknown; teams?: string[] }) {
  const at = generatedAt();
  return { schemaVersion: 1, id: `${post}-e2e`, post, state: result.state, reasons: result.reasons ?? [], generatedAt: at, expiresAt: new Date(Date.parse(at) + 600000).toISOString(), timeZone: "America/New_York", settings, fixture: false, teams: result.teams ?? [], evidence: result.evidence, data: result.data };
}
async function install(page: Page) {
  page.setDefaultTimeout(10000);
  // Never against a real project: the fixture host must be a reserved .invalid name, as in social-share.spec.ts.
  expect(supabaseOrigin.hostname.endsWith(".invalid")).toBe(true);
  const user = { id: "00000000-0000-4000-8000-00000000e2e1", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
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
const download = async (page: Page) => {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PNG", exact: true }).click()]);
  const path = await file.path();
  expect((await readFile(path)).subarray(1, 4).toString()).toBe("PNG");
};

test("crease shift: official share over team games, labeled comparison, and it exports the same snapshot", async ({ page }) => {
  await install(page);
  const result = buildCreaseShift({ reported, appearances, scheduled, teams: ["NJD", "NYR"], window: 2, comparison: "previous", minComparisonGames: 2, through: "2026-10-30" });
  const settings = { window: "10", comparison: "previous", minComparisonGames: 2 };
  let requests = 0;
  await page.route("**/api/v1/social-share/posts/**", route => { requests++; return route.fulfill({ json: edition("crease-shift", settings, result) }); });
  await page.goto("/social-share/posts?post=crease-shift&minComparisonGames=2");
  const square = page.getByTestId("share-square");
  await expect(page.getByTestId("post-evidence")).toContainText("Official starts ÷ completed team games");
  await expect(square).toContainText("PREV 2 GP");
  await expect(square).toContainText("Fictional Goalie 2");
  await expect(square).not.toContainText(/probab|likely|odds/i);
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  await expect(square).toHaveAttribute("data-export-token", 'crease-shift-e2e|crease-shift|[["window","10"],["comparison","previous"],["minComparisonGames",2]]');
  const before = requests;
  await download(page);
  expect(requests).toBe(before);
});

test("crease shift: a schedule gap previews as partial and cannot export", async ({ page }) => {
  await install(page);
  const result = buildCreaseShift({ reported: reported.slice(1), appearances, scheduled, teams: ["NJD", "NYR"], window: 2, comparison: "previous", minComparisonGames: 2, through: "2026-10-30" });
  expect(reconcileSchedule(scheduled, reported.slice(1)).missing).toBe(1);
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("crease-shift", { window: "10", comparison: "previous", minComparisonGames: 2 }, result) }));
  await page.goto("/social-share/posts?post=crease-shift&minComparisonGames=2");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("goalie of the period: Category Counts and the TGV grade stay under their own labels", async ({ page }) => {
  await install(page);
  const result = buildGoaliePeriod({ settings: periodSettings, period: weekPeriod(week, "2026-10-30"), appearances, reported, scheduled, tgv });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", periodSettings, result) }));
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  await expect(page.getByTestId("goalie-period-winners")).toContainText("Fictional Goalie 1");
  await expect(page.getByTestId("category-counts")).toContainText("Category Counts");
  await expect(page.getByTestId("category-counts")).not.toContainText("TGV");
  await expect(page.getByTestId("tgv-existing")).toContainText("TGV grade (existing method)");
  await expect(page.getByTestId("post-evidence")).toContainText("Categories: wins,saves,svPct,gaa,shutouts");
  await download(page);
});

/** The post body clips overflow: nothing may run past it, and no band over 40px may be left under the card. */
const expectBodyFilled = async (page: Page, testId: string) => {
  const fit = await page.getByTestId(testId).evaluate(element => { const body = element.parentElement!, last = element.lastElementChild!; return { client: body.clientHeight, scroll: body.scrollHeight, band: body.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom, wide: element.scrollWidth - element.clientWidth }; });
  expect(fit.scroll).toBeLessThanOrEqual(fit.client);
  expect(fit.band).toBeGreaterThanOrEqual(0);
  expect(fit.band).toBeLessThan(40);
  expect(fit.wide).toBeLessThanOrEqual(0);
};

test("goalie of the period: eight rows a side fill the body at five categories", async ({ page }) => {
  await install(page);
  // Twenty goalies, so the sides do not overlap; long real name shapes; four weeks of TGV with a gap in week 2.
  const shapes = ["Ukko-Pekka Luukkonen", "Sergei Bobrovsky", "Andrei Vasilevskiy", "Connor Hellebuyck"];
  const names = Array.from({ length: 20 }, (_, index) => shapes[index % 4]);
  const fit = names.map((_, index) => ({ id: index + 1, date: `2026-10-${19 + index % 7}`, homeTeamId: teamsInfo.NJD.id, awayTeamId: teamsInfo.NYR.id }));
  const rows = fit.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
  const stats = rows.map((game, index) => stat(index % 20 + 1, game.team, game.gameId, game.date, { name: names[index % 20], wins: index % 3 === 0 ? 1 : 0, saves: 20 + index, shotsAgainst: 24 + index, goalsAgainst: index % 4 }));
  const weeks = [1, 2, 3].map(number => ({ week: number, start: `2026-10-0${number}`, end: `2026-10-0${number}` }));
  const season = { weeks: [...weeks, week], league: [1, 2, 3, 4].map(number => ({ week: number, avg_league_weekly_wins: 1, avg_league_weekly_saves: 40, avg_league_weekly_sv_pct: 0.9 })),
    goalies: names.flatMap((_, goalie) => [1, 3, 4].map(number => ({ goalie_id: goalie + 1, week: number, weekly_gs: 2, weekly_toi_seconds: 7200, weekly_wins: goalie % 3, weekly_saves: 30 + goalie * 3, weekly_sv_pct: 0.88 + goalie * 0.005 }))) } as never;
  const result = buildGoaliePeriod({ settings: periodSettings, period: weekPeriod(week, "2026-10-30"), appearances: stats, reported: rows, scheduled: fit, tgv: season });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", periodSettings, result) }));
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  await expect(page.getByTestId("board-best").getByTestId("goalie-period-row")).toHaveCount(8);
  await expect(page.getByTestId("board-worst").getByTestId("goalie-period-row")).toHaveCount(8);
  await expect(page.getByTestId("goalie-period-row").first().locator("svg[data-sparkline]")).toBeVisible();
  await expect(page.getByTestId("goalie-period-card")).toContainText("W 2/2 = better than league average in 2 of 2 starts.");
  await expectBodyFilled(page, "goalie-period-card");
  await download(page);
});

test("GSAx: ten rows a side fill the body", async ({ page }) => {
  await install(page);
  const goalies = Array.from({ length: 24 }, (_, index) => index + 1);
  const games = goalies.map((_, index) => ({ id: index + 1, date: `2026-10-${19 + index % 7}`, homeTeamId: teamsInfo.NJD.id, awayTeamId: teamsInfo.NYR.id }));
  const rows = games.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
  const stats = rows.map((game, index) => stat(index % 24 + 1, game.team, game.gameId, game.date, { name: "Ukko-Pekka Luukkonen" }));
  const nstGames = stats.map((row, index) => ({ goalieId: row.goalieId, date: row.date, toiSeconds: 3600, xgAgainst: 1 + index % 7, goalsAgainst: 3, shotsAgainst: 30 })).filter((row, index, all) => all.findIndex(other => other.goalieId === row.goalieId && other.date === row.date) === index);
  const result = buildGoalieGsax({ appearances: stats, nstGames, strength: "all", window: "week", weeks: [week], board: "both", minAppearances: 1, minCoverage: 50, reported: rows, scheduled: games, fhfhRows: 0 });
  const settings = { window: "week", strength: "all", board: "both", minAppearances: 1, minCoverage: 50 };
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-gsax", settings, result) }));
  await page.goto("/social-share/posts?post=goalie-gsax&minCoverage=50");
  await expect(page.getByTestId("board-best").getByTestId("goalie-gsax-row")).toHaveCount(10);
  await expectBodyFilled(page, "goalie-gsax-card");
});

for (const teamCount of [6, 12]) test(`crease shift: ${teamCount} ranked teams fill the body`, async ({ page }) => {
  await install(page);
  const teams = ["NJD", "NYR", "PHI", "PIT", "BOS", "BUF", "MTL", "OTT", "TOR", "DET", "FLA", "TBL"].slice(0, teamCount) as (keyof typeof teamsInfo)[];
  const twenty = Array.from({ length: 20 }, (_, game) => game), day = (game: number) => `2026-10-${String(game + 1).padStart(2, "0")}`;
  const games = teams.flatMap((team, index) => index % 2 ? [] : twenty.map(game => ({ id: 100 * (index + 1) + game, date: day(game), homeTeamId: teamsInfo[team].id, awayTeamId: teamsInfo[teams[index + 1]].id })));
  const reportedGames = teams.flatMap((team, index) => twenty.map(game => ({ gameId: 100 * ((index - index % 2) + 1) + game, date: day(game), team: String(team) })));
  const stats = reportedGames.map((game, index) => stat((teams.indexOf(game.team as keyof typeof teamsInfo) + 1) * 10 + (index % 4 < 2 ? 1 : 2), game.team, game.gameId, game.date, { name: "Ukko-Pekka Luukkonen" }));
  const result = buildCreaseShift({ reported: reportedGames, appearances: stats, scheduled: games, teams: teams.map(String), window: 10, comparison: "previous", minComparisonGames: 2, through: "2026-10-30" });
  const settings = { window: "10", comparison: "previous", minComparisonGames: 2 };
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("crease-shift", settings, result) }));
  await page.goto("/social-share/posts?post=crease-shift&minComparisonGames=2");
  await expect(page.getByTestId("crease-shift-rank")).toHaveCount(teamCount);
  // Ten blocks and a line per starter in each row, in the PNG's own attributes.
  await expect(page.locator('[data-testid="crease-shift-card"] svg rect[data-block="started"]')).toHaveCount(teamCount * 10);
  await expect(page.locator('[data-testid="crease-shift-card"] svg rect[data-block="started"]').first()).toHaveAttribute("fill", /^#/);
  await expect(page.locator('[data-testid="crease-shift-card"] svg g[data-goalie]')).toHaveCount(teamCount * 2);
  await expect(page.locator('[data-testid="crease-shift-card"] svg g[data-goalie] path').first()).toHaveAttribute("stroke", /^#/);
  await expectBodyFilled(page, "crease-shift-card");
  await download(page);
});

test("goalie of the period: a failed TGV read shows grades as unavailable and cannot export", async ({ page }) => {
  await install(page);
  const result = buildGoaliePeriod({ settings: periodSettings, period: weekPeriod(week, "2026-10-30"), appearances, reported, scheduled, tgv: null });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", periodSettings, result) }));
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  await expect(page.getByTestId("goalie-period-row").first().locator('[data-group="tgv"]')).toHaveText("Unavailable");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("goalie of the period: a game without one labeled starter cannot export", async ({ page }) => {
  await install(page);
  const result = buildGoaliePeriod({ settings: periodSettings, period: weekPeriod(week, "2026-10-30"), appearances: [...appearances, stat(9, "NJD", 1, days[0])], reported, scheduled, tgv });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", periodSettings, result) }));
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("GSAx: Best and Worst, NST model and through-date", async ({ page }) => {
  await install(page);
  const nstGames = appearances.filter(row => row.date <= days[2]).map(row => ({ goalieId: row.goalieId, date: row.date, toiSeconds: 3600, xgAgainst: 3, goalsAgainst: row.goalsAgainst, shotsAgainst: row.shotsAgainst }));
  const result = buildGoalieGsax({ appearances, nstGames, strength: "all", window: "week", weeks: [week], board: "both", minAppearances: 1, minCoverage: 90, reported: reported.filter(game => game.date <= days[2]), scheduled: scheduled.filter(game => game.date <= days[2]), fhfhRows: 0 });
  const settings = { window: "week", strength: "all", board: "both", minAppearances: 1, minCoverage: 90 };
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-gsax", settings, result) }));
  await page.goto("/social-share/posts?post=goalie-gsax");
  const square = page.getByTestId("share-square");
  await expect(page.getByTestId("board-best")).toBeVisible();
  await expect(page.getByTestId("board-worst")).toBeVisible();
  await expect(square).toContainText("NST model, All situations, through 2026-10-21");
  await expect(square).toContainText("Week 4");
  await expect(page.getByTestId("post-evidence")).toContainText("FHFH xG model: unavailable this season");
  await expect(square).not.toContainText(/gsaa/i);
  const clipped = await page.getByTestId("board-best").evaluate(element => { const body = element.closest("[class*=postBody]")!; return body.scrollHeight - body.clientHeight; });
  expect(clipped).toBeLessThanOrEqual(0);
  await download(page);
});
