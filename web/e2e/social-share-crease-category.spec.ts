import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { parseShareSettings } from "../lib/socialShare/modules/contract";
import { buildCreaseShift, creaseShiftModule, reconcileSchedule } from "../lib/socialShare/modules/creaseShift";
import { buildGoalieGsax } from "../lib/socialShare/modules/goalieGsax";
import { buildGoaliePeriod } from "../lib/socialShare/modules/goaliePeriod";
import { rangePeriod, seasonPeriod, weekPeriod } from "../lib/socialShare/modules/shared/categoryCounts";
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
const scheduled = days.map((date, index) => ({ id: index + 1, date, homeTeamId: teamsInfo.NJD.id, awayTeamId: teamsInfo.NYR.id, final: true }));
const reported = scheduled.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
const appearances = scheduled.flatMap((game, index) => [
  stat(index < 2 ? 1 : 2, "NJD", game.id, game.date, { wins: 1, saves: 34, shotsAgainst: 35, goalsAgainst: 1 }),
  stat(3, "NYR", game.id, game.date, { losses: 1, saves: 20, shotsAgainst: 24, goalsAgainst: 4 }),
]);
const week = { week: 4, start: "2026-10-19", end: "2026-10-25" };
const gsaxSettings = { period: "window", week: null, start: null, end: null, window: "week", strength: "all", board: "both", minAppearances: 1, minCoverage: 90 };
const adp = { goalies: [{ player_key: "465.p.1", player_id: "1", average_pick: "84.3" }, { player_key: "465.p.2", player_id: "2", average_pick: "-" }], map: [{ yahoo_player_id: "465.p.1", nhl_player_id: "1" }, { yahoo_player_id: "465.p.2", nhl_player_id: "2" }], averagePicks: ["192.0", "84.3"] };
const periodSettings = { period: "week", week: 4, month: "", start: null, end: null, minStartsWeek: 2, minStartsMonth: 5, minStartsRange: 2, minStartsSeason: 1, board: "both", categories: "wins,saves,svPct,gaa,shutouts" };
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

/** The studio's Options group starts collapsed (SS-1103): open it before touching an option field. */
const openOptions = async (page: Page) => { const toggle = page.getByRole("button", { name: /^Options/ }); if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click(); };

test("crease shift: official share over team games, labeled comparison, and it exports the same snapshot", async ({ page }) => {
  await install(page);
  const result = buildCreaseShift({ reported, appearances, scheduled, teams: ["NJD", "NYR"], window: 2, comparison: "previous", minComparisonGames: 2, through: "2026-10-30" });
  const settings = { window: 10, comparison: "previous", minComparisonGames: 2, teams: "" };
  let requests = 0;
  await page.route("**/api/v1/social-share/posts/**", route => { requests++; return route.fulfill({ json: edition("crease-shift", settings, result) }); });
  await page.goto("/social-share/posts?post=crease-shift&minComparisonGames=2");
  const square = page.getByTestId("share-square");
  await expect(page.getByTestId("post-evidence")).toContainText("Official starts ÷ completed team games");
  await expect(square).toContainText("PRIOR 2");
  await expect(page.getByTestId("crease-shift-subtitle")).toHaveText("Share of each team's starts in net: last 2 games vs the 2 before");
  await expect(square).toContainText("Fictional Goalie 2");
  await expect(square).not.toContainText(/probab|likely|odds/i);
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  await expect(square).toHaveAttribute("data-export-token", 'crease-shift-e2e|crease-shift|[["window",10],["comparison","previous"],["minComparisonGames",2],["teams",""]]');
  const before = requests;
  await download(page);
  expect(requests).toBe(before);
});

test("crease shift: a schedule gap previews as partial and cannot export", async ({ page }) => {
  await install(page);
  const result = buildCreaseShift({ reported: reported.slice(1), appearances, scheduled, teams: ["NJD", "NYR"], window: 2, comparison: "previous", minComparisonGames: 2, through: "2026-10-30" });
  expect(reconcileSchedule(scheduled, reported.slice(1)).missing).toBe(1);
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("crease-shift", { window: 10, comparison: "previous", minComparisonGames: 2, teams: "" }, result) }));
  await page.goto("/social-share/posts?post=crease-shift&minComparisonGames=2");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("goalie of the period: Category Counts and the TGV grade stay under their own labels", async ({ page }) => {
  await install(page);
  const result = buildGoaliePeriod({ settings: periodSettings, period: weekPeriod(week, "2026-10-30"), appearances, reported, scheduled, tgv, adp });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", periodSettings, result) }));
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  await expect(page.getByTestId("goalie-period-winners")).toContainText("Fictional Goalie 1");
  await expect(page.getByTestId("category-counts")).toContainText("Category Counts");
  await expect(page.getByTestId("category-counts")).not.toContainText("TGV");
  await expect(page.getByTestId("tgv-existing")).toHaveCount(0);
  await expect(page.getByTestId("board-best")).toContainText("TGV grade (existing method)");
  await expect(page.getByTestId("goalie-period-adp")).toContainText("Counted as undrafted (200)");
  await expect(page.getByTestId("post-evidence")).toContainText("Categories: W, SV, SV%, GAA, SO");
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
  const fit = names.map((_, index) => ({ id: index + 1, date: `2026-10-${19 + index % 7}`, homeTeamId: teamsInfo.NJD.id, awayTeamId: teamsInfo.NYR.id, final: true }));
  const rows = fit.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
  const stats = rows.map((game, index) => stat(index % 20 + 1, game.team, game.gameId, game.date, { name: names[index % 20], wins: index % 3 === 0 ? 1 : 0, saves: 20 + index, shotsAgainst: 24 + index, goalsAgainst: index % 4 }));
  const weeks = [1, 2, 3].map(number => ({ week: number, start: `2026-10-0${number}`, end: `2026-10-0${number}` }));
  const season = { weeks: [...weeks, week], league: [1, 2, 3, 4].map(number => ({ week: number, avg_league_weekly_wins: 1, avg_league_weekly_saves: 40, avg_league_weekly_sv_pct: 0.9 })),
    goalies: names.flatMap((_, goalie) => [1, 3, 4].map(number => ({ goalie_id: goalie + 1, week: number, weekly_gs: 2, weekly_toi_seconds: 7200, weekly_wins: goalie % 3, weekly_saves: 30 + goalie * 3, weekly_sv_pct: 0.88 + goalie * 0.005 }))) } as never;
  const result = buildGoaliePeriod({ settings: periodSettings, period: weekPeriod(week, "2026-10-30"), appearances: stats, reported: rows, scheduled: fit, tgv: season, adp });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", periodSettings, result) }));
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  await expect(page.getByTestId("board-best").getByTestId("goalie-period-row")).toHaveCount(8);
  await expect(page.getByTestId("board-worst").getByTestId("goalie-period-row")).toHaveCount(8);
  await expect(page.getByTestId("goalie-period-row").first().locator("svg[data-sparkline]")).toBeVisible();
  await expect(page.getByTestId("goalie-period-card")).toContainText("W 2/2 = better than league average in 2 of 2 starts.");
  await expect(page.getByTestId("goalie-period-adp")).toContainText("Avg ADP: Best");
  await expectBodyFilled(page, "goalie-period-card");
  await download(page);
});

test("goalie of the season: a full season fits the body with readable bars", async ({ page }) => {
  await install(page);
  const seasonWeeks = Array.from({ length: 26 }, (_, index) => ({ week: index + 1, start: new Date(Date.UTC(2026, 9, 5 + index * 7)).toISOString().slice(0, 10), end: new Date(Date.UTC(2026, 9, 11 + index * 7)).toISOString().slice(0, 10) }));
  const shapes = ["Ukko-Pekka Luukkonen", "Sergei Bobrovsky", "Andrei Vasilevskiy", "Connor Hellebuyck"];
  const fit = seasonWeeks.flatMap(entry => Array.from({ length: 30 }, (_, game) => ({ id: entry.week * 100 + game, date: entry.start, homeTeamId: teamsInfo.NJD.id, awayTeamId: teamsInfo.NYR.id, final: true })));
  const rows = fit.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
  const stats = rows.map((game, index) => stat(index % 60 + 1, game.team, game.gameId, game.date, { name: shapes[index % 4], wins: index % 3 === 0 ? 1 : 0, saves: 15 + index % 30, shotsAgainst: 20 + index % 30, goalsAgainst: index % 5 }));
  const season = { weeks: seasonWeeks, league: seasonWeeks.map(entry => ({ week: entry.week, avg_league_weekly_wins: 1, avg_league_weekly_saves: 40, avg_league_weekly_sv_pct: 0.9 })),
    goalies: Array.from({ length: 60 }, (_, goalie) => seasonWeeks.filter(entry => entry.week % 7).map(entry => ({ goalie_id: goalie + 1, week: entry.week, weekly_gs: 2, weekly_toi_seconds: 7200, weekly_wins: goalie % 3, weekly_saves: 30 + goalie, weekly_sv_pct: 0.88 + (goalie % 10) * 0.005 }))).flat() } as never;
  const settings = { ...periodSettings, period: "season", week: null };
  const result = buildGoaliePeriod({ settings, period: seasonPeriod(seasonWeeks, "2027-04-04"), appearances: stats, reported: rows, scheduled: fit, tgv: season, adp });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", settings, result) }));
  await page.goto("/social-share/posts?post=goalie-period&period=season");
  await expect(page.getByTestId("share-square")).toContainText("GOALIE OF THE SEASON");
  await expect(page.getByTestId("goalie-period-card")).toContainText("Season to date, through 2027-04-04. Min 1 start.");
  await expect(page.getByTestId("board-best").getByTestId("goalie-period-row")).toHaveCount(8);
  await expect(page.getByTestId("board-worst").getByTestId("goalie-period-row")).toHaveCount(8);
  await expect(page.getByTestId("goalie-period-row").first().locator("svg[data-bars]")).toBeVisible();
  await expect(page.getByTestId("goalie-period-adp")).toContainText("Avg ADP: Best");
  await expectBodyFilled(page, "goalie-period-card");
  await download(page);
});

test("goalie of the period: a custom range shows its dates and headline", async ({ page }) => {
  await install(page);
  const settings = { ...periodSettings, period: "custom", week: null, start: "2026-10-19", end: "2026-10-22", minStartsRange: 1 };
  const result = buildGoaliePeriod({ settings, period: rangePeriod([week], "2026-10-19", "2026-10-22", "2026-10-30"), appearances, reported, scheduled, tgv, adp });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", settings, result) }));
  await page.goto("/social-share/posts?post=goalie-period&period=custom&start=2026-10-19&end=2026-10-22&minStartsRange=1");
  await expect(page.getByTestId("share-square")).toContainText("GOALIE OF THE PERIOD");
  await expect(page.getByTestId("goalie-period-card")).toContainText("2026-10-19 to 2026-10-22. Min 1 start.");
  await expect(page.getByTestId("post-evidence")).toContainText("Custom range uses Category Counts' month rules");
});

/** Weeks 3 to 6 and an edition per week. Only week 4 has fictional games; week 6 has not started. */
async function servePeriods(page: Page) {
  const calendar = [{ week: 3, start_date: "2026-10-12", end_date: "2026-10-18" }, { week: 4, start_date: week.start, end_date: week.end }, { week: 5, start_date: "2026-10-26", end_date: "2026-11-01" }, { week: 6, start_date: "2026-11-02", end_date: "2026-11-08" }];
  await page.route("**/api/v1/social-share/matchup-weeks", route => route.fulfill({ json: { rows: calendar, cutoff: "2026-10-28" } }));
  const requested: (string | null)[] = [];
  await page.route("**/api/v1/social-share/posts/**", route => {
    const query = new URL(route.request().url()).searchParams, number = Number(query.get("week") ?? 4), row = calendar.find(entry => entry.week === number)!, chosen = { week: row.week, start: row.start_date, end: row.end_date };
    requested.push(query.get("week"));
    const settings = { ...periodSettings, week: query.get("week") ? number : null, period: query.get("period") ?? "week", start: query.get("start"), end: query.get("end") };
    const games = number === 4 ? { appearances, reported, scheduled } : { appearances: [], reported: [], scheduled: [] };
    // Built on Oct 29, so the pager's cutoff is Oct 28 whatever today is; it still expires ten minutes from now.
    return route.fulfill({ json: { ...edition("goalie-period", settings, buildGoaliePeriod({ settings, period: weekPeriod(chosen, "2026-10-28"), tgv, adp, ...games })), generatedAt: "2026-10-29T16:00:00.000Z" } });
  });
  return requested;
}

test("period control: the pager pages matchups by keyboard, updates the URL and loads each edition without Refresh", async ({ page }) => {
  await install(page);
  const requested = await servePeriods(page);
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  const label = page.getByTestId("period-pager-label"), prior = page.getByRole("button", { name: /^Prior week/ }), next = page.getByRole("button", { name: /^Next week/ }), evidence = page.getByTestId("post-evidence");
  await expect(label).toHaveText("Week 4 · Oct 19 to Oct 25");
  await expect(page.getByRole("spinbutton", { name: /^Week/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();

  await prior.focus();
  await page.keyboard.press("Enter");
  await expect(label).toHaveText("Week 3 · Oct 12 to Oct 18");
  await expect(evidence).toContainText("Week 3, 2026-10-12 to 2026-10-18");
  await expect(page).toHaveURL(/[?&]week=3(&|$)/);
  expect(requested.at(-1)).toBe("3");
  // The first week here: nothing before it, and the keyboard stays on the pager.
  await expect(prior).toBeDisabled();
  await expect(next).toBeFocused();
  // No games that week, so nothing to export.
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();

  await page.keyboard.press("Enter");
  await expect(label).toHaveText("Week 4 · Oct 19 to Oct 25");
  await expect(page.getByTestId("goalie-period-winners")).toContainText("Fictional Goalie");
  await download(page);

  await next.click();
  await expect(label).toHaveText("Week 5 · Oct 26 to Nov 1");
  // Results stop at the week under way: week 6 has not started.
  await expect(next).toBeDisabled();
  await expect(prior).toBeEnabled();

  await page.reload();
  await expect(label).toHaveText("Week 5 · Oct 26 to Nov 1");
});

test("period control: custom dates show only for Custom, a bad range is never sent, and a good one loads on its own", async ({ page }) => {
  await install(page);
  const requested = await servePeriods(page);
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  const start = page.getByLabel("Custom range start"), end = page.getByLabel("Custom range end"), downloadButton = page.getByRole("button", { name: "Download PNG", exact: true });
  await expect(downloadButton).toBeEnabled();
  const loads = requested.length;
  await expect(start).toHaveCount(0);
  await page.getByTestId("period-control").locator("select").selectOption("custom");
  await expect(page.getByTestId("period-pager-label")).toHaveCount(0);
  await expect(page.getByTestId("period-reason")).toHaveText("A custom range needs a start date and an end date.");
  // The loaded edition is a week's, so the mismatched settings block its export.
  await expect(downloadButton).toBeDisabled();
  await start.fill("2026-10-22");
  await end.fill("2026-10-19");
  await expect(page.getByTestId("period-reason")).toHaveText("The start date must be before the end date.");
  expect(requested).toHaveLength(loads);
  await end.fill("2026-10-25");
  await expect(page.getByTestId("period-reason")).toHaveCount(0);
  await expect(page).toHaveURL(/period=custom/);
  await expect(page).toHaveURL(/start=2026-10-22/);
  await expect(page).toHaveURL(/end=2026-10-25/);
  await expect.poll(() => requested.length).toBe(loads + 1);
  await page.getByTestId("period-control").locator("select").selectOption("week");
  await expect(page.getByTestId("period-pager-label")).toHaveText("Week 4 · Oct 19 to Oct 25");
  await expect(downloadButton).toBeEnabled();
});

test("period control: fits a 375 phone with no page overflow", async ({ page }) => {
  await install(page);
  await servePeriods(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  await expect(page.getByTestId("period-pager-label")).toHaveText("Week 4 · Oct 19 to Oct 25");
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  const control = await page.getByTestId("period-control").boundingBox();
  expect(control!.x + control!.width).toBeLessThanOrEqual(375);
  await page.getByTestId("period-control").locator("select").selectOption("custom");
  await expect(page.getByLabel("Custom range end")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("GSAx: ten rows a side fill the body", async ({ page }) => {
  await install(page);
  const goalies = Array.from({ length: 24 }, (_, index) => index + 1);
  const games = goalies.map((_, index) => ({ id: index + 1, date: `2026-10-${19 + index % 7}`, homeTeamId: teamsInfo.NJD.id, awayTeamId: teamsInfo.NYR.id, final: true }));
  const rows = games.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
  const stats = rows.map((game, index) => stat(index % 24 + 1, game.team, game.gameId, game.date, { name: "Ukko-Pekka Luukkonen" }));
  const nstGames = stats.map((row, index) => ({ goalieId: row.goalieId, date: row.date, toiSeconds: 3600, xgAgainst: 1 + index % 7, goalsAgainst: 3, shotsAgainst: 30 })).filter((row, index, all) => all.findIndex(other => other.goalieId === row.goalieId && other.date === row.date) === index);
  const result = buildGoalieGsax({ appearances: stats, nstGames, strength: "all", window: "week", weeks: [week], board: "both", minAppearances: 1, minCoverage: 50, reported: rows, scheduled: games, fhfhRows: 0 });
  const settings = { ...gsaxSettings, minCoverage: 50 };
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-gsax", settings, result) }));
  await page.goto("/social-share/posts?post=goalie-gsax&minCoverage=50");
  await expect(page.getByTestId("board-best").getByTestId("goalie-gsax-row")).toHaveCount(10);
  await expectBodyFilled(page, "goalie-gsax-card");
});

/** Crease Shift fixtures: `teams` in pairs over 20 games, each starter split two and two, so every team ranks at 0. */
const CREASE_TEAMS = ["NJD", "NYR", "PHI", "PIT", "BOS", "BUF", "MTL", "OTT", "TOR", "DET", "FLA", "TBL", "EDM", "VAN"] as (keyof typeof teamsInfo)[];
function creaseLeague(teams = CREASE_TEAMS) {
  const twenty = Array.from({ length: 20 }, (_, game) => game), day = (game: number) => `2026-10-${String(game + 1).padStart(2, "0")}`;
  const games = teams.flatMap((team, index) => index % 2 ? [] : twenty.map(game => ({ id: 100 * (index + 1) + game, date: day(game), homeTeamId: teamsInfo[team].id, awayTeamId: teamsInfo[teams[index + 1]].id, final: true })));
  const reportedGames = teams.flatMap((team, index) => twenty.map(game => ({ gameId: 100 * ((index - index % 2) + 1) + game, date: day(game), team: String(team) })));
  const stats = reportedGames.map((game, index) => stat((teams.indexOf(game.team as keyof typeof teamsInfo) + 1) * 10 + (index % 4 < 2 ? 1 : 2), game.team, game.gameId, game.date, { name: "Ukko-Pekka Luukkonen" }));
  return { reported: reportedGames, appearances: stats, scheduled: games, teams: teams.map(String), through: "2026-10-30" };
}
/** Serves each request's own settings, as the route would, and counts the requests. */
async function serveCrease(page: Page, league = creaseLeague()) {
  const requests: URLSearchParams[] = [];
  await page.route("**/api/v1/social-share/posts/**", route => {
    const query = new URL(route.request().url()).searchParams, settings = parseShareSettings(creaseShiftModule, Object.fromEntries(query));
    requests.push(query);
    const result = buildCreaseShift({ ...league, picked: String(settings.teams).split(",").filter(Boolean), window: Number(settings.window), comparison: settings.comparison === "std" ? "std" : "previous", minComparisonGames: Number(settings.minComparisonGames) });
    return route.fulfill({ json: { ...edition("crease-shift", settings, result), pageNotes: result.pageNotes } });
  });
  return requests;
}
/** No row keeps an empty band over or beside its chart, nothing in the table runs into the note under it, and the subtitle and note each fit their one line. */
const expectCreaseRowsFilled = async (page: Page) => {
  const rows = await page.getByTestId("crease-shift-card").evaluate(card => {
    const scale = card.closest("[data-testid=share-square]")!.getBoundingClientRect().width / 1080, subtitle = card.querySelector('[data-testid="crease-shift-subtitle"]')!, table = subtitle.nextElementSibling as HTMLElement, note = card.querySelector('[data-testid="crease-shift-note"]')!;
    const charts = [...card.querySelectorAll("svg[role=img]")];
    return { overflow: table.scrollHeight - table.clientHeight, gap: (note.getBoundingClientRect().top - charts.at(-1)!.getBoundingClientRect().bottom) / scale, slack: charts.map(svg => (svg.parentElement!.getBoundingClientRect().height - svg.getBoundingClientRect().height) / scale), clipped: [subtitle, note].filter(line => line.scrollWidth > line.clientWidth).map(line => line.textContent) };
  });
  expect(rows.overflow).toBeLessThanOrEqual(0);
  expect(rows.gap).toBeGreaterThanOrEqual(0);
  for (const slack of rows.slack) expect(slack).toBeLessThan(24);
  expect(rows.clipped).toEqual([]);
};

for (const teamCount of [6, 12]) test(`crease shift: ${teamCount} ranked teams fill the body`, async ({ page }) => {
  await install(page);
  await serveCrease(page, creaseLeague(CREASE_TEAMS.slice(0, teamCount)));
  await page.goto("/social-share/posts?post=crease-shift&minComparisonGames=2");
  await expect(page.getByTestId("crease-shift-rank")).toHaveCount(teamCount);
  // Ten blocks and a line per starter in each row, in the PNG's own attributes.
  await expect(page.locator('[data-testid="crease-shift-card"] svg rect[data-block="started"]')).toHaveCount(teamCount * 10);
  await expect(page.locator('[data-testid="crease-shift-card"] svg rect[data-block="started"]').first()).toHaveAttribute("fill", /^#/);
  await expect(page.locator('[data-testid="crease-shift-card"] svg g[data-goalie]')).toHaveCount(teamCount * 2);
  await expect(page.locator('[data-testid="crease-shift-card"] svg g[data-goalie] path').first()).toHaveAttribute("stroke", /^#/);
  await expectBodyFilled(page, "crease-shift-card");
  await expectCreaseRowsFilled(page);
  await download(page);
});

for (const [picked, window] of [[["NJD"], 10], [["NJD"], 1], [["NJD", "NYR"], 10], [["EDM", "NJD", "TOR"], 10], [["BOS", "NJD", "NYR", "PHI"], 10], [["NJD", "NYR", "PHI", "PIT"], 20]] as const) test(`crease shift: ${picked.length} picked over ${window} game${window === 1 ? "" : "s"} stack and fill the body`, async ({ page }) => {
  await install(page);
  await serveCrease(page);
  await page.goto(`/social-share/posts?post=crease-shift&minComparisonGames=2&window=${window}&teams=${picked.join(",")}`);
  await expect(page.getByTestId("crease-shift-rank")).toHaveCount(picked.length);
  await expect(page.getByTestId("crease-shift-card")).toHaveAttribute("data-size", `rows-${picked.length}`);
  await expect(page.locator('[data-testid="crease-shift-card"] svg[role=img]').first()).toHaveAttribute("width", "1008");
  await expect(page.locator('[data-testid="crease-shift-card"] svg rect[data-block]')).toHaveCount(picked.length * window);
  await expectBodyFilled(page, "crease-shift-card");
  await expectCreaseRowsFilled(page);
  await download(page);
});

test("crease shift: the headers, subtitle and note follow the window and the comparison", async ({ page }) => {
  await install(page);
  const requests = await serveCrease(page), heads = page.locator('[data-testid="crease-shift-card"] [class*="head"]');
  await page.goto("/social-share/posts?post=crease-shift&minComparisonGames=2&window=5&comparison=std&teams=NJD,NYR");
  await expect(heads).toHaveText(["RK", "TEAM", "GOALIE", "LAST 5", "SEASON", "CHANGE"]);
  await expect(page.getByTestId("crease-shift-subtitle")).toHaveText("Share of each team's starts in net: last 5 games vs the season so far (20 games)");
  await expect(page.getByTestId("crease-shift-note")).toContainText("ending at LAST 5. CHANGE is LAST 5 minus SEASON in percentage points.");
  // Starters go two and two, so the last 5 are 40/60 against a 50/50 season: arrows, in the row's own text colour.
  const card = page.getByTestId("crease-shift-card");
  await expect(card).toContainText("▲10");
  await expect(card).toContainText("▼10");
  expect(await card.locator('[class*="arrow"]').evaluateAll(arrows => arrows.map(arrow => getComputedStyle(arrow).color === getComputedStyle(arrow.closest('[data-testid="crease-shift-card"]')!).color))).toEqual([true, true, true, true]);
  await expect(page.getByTestId("post-evidence")).toContainText("CHANGE is LAST 5 minus SEASON in percentage points");
  await openOptions(page);
  await page.getByRole("combobox", { name: "Comparison" }).selectOption("previous");
  await expect.poll(() => requests.at(-1)?.get("comparison")).toBe("previous");
  await expect(heads).toHaveText(["RK", "TEAM", "GOALIE", "LAST 5", "PRIOR 5", "CHANGE"]);
  await expect(page.getByTestId("crease-shift-subtitle")).toHaveText("Share of each team's starts in net: last 5 games vs the 5 before");
  await expect(page.getByTestId("crease-shift-note")).toContainText("CHANGE is LAST 5 minus PRIOR 5 in percentage points.");
  // The 5 before were 40/60 too: no change, so no arrow.
  await expect(card).not.toContainText(/[▲▼]/);
  await expectCreaseRowsFilled(page);
});

test("crease shift: teams are picked from a capped grid, blank goes back to the top 12, and old window links still work", async ({ page }) => {
  await install(page);
  // Fourteen teams, so blank shows twelve of them; an old L5 link opens a 5-game window, whose 5-game comparison is short of 6.
  const requests = await serveCrease(page);
  await page.goto("/social-share/posts?post=crease-shift&minComparisonGames=2&window=5");
  await expect(page.getByTestId("crease-shift-rank")).toHaveCount(12);
  await openOptions(page);
  await expect(page.getByRole("spinbutton", { name: "Window (team games)" })).toHaveValue("5");
  const grid = page.getByRole("group", { name: "Teams (up to 12)" }), box = (team: string) => grid.getByRole("checkbox", { name: team, exact: true });
  await expect(grid.getByRole("checkbox")).toHaveCount(32);
  await expect(page.getByText("Leave blank for the top 12 by share change.")).toBeVisible();

  await box("NJD").check();
  await expect.poll(() => requests.at(-1)?.get("teams")).toBe("NJD");
  await expect(page.getByTestId("crease-shift-rank")).toHaveCount(1);
  // RK is NJD's rank among every team, not 1 of 1: all fourteen tie at 0, so it is 1 here, and a short comparison prints "—".
  await expect(page.getByTestId("crease-shift-rank")).toHaveText("1");
  await page.getByRole("spinbutton", { name: /^Min comparison games/ }).fill("6");
  await expect(page.getByTestId("crease-shift-rank")).toHaveText("—");
  await expect(page.getByTestId("post-page-notes")).toContainText("NJD is unranked: Only 5 comparison games outside the window, under the minimum of 6.");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();

  // The last box can come off: blank is the top 12 again.
  await page.getByRole("spinbutton", { name: /^Min comparison games/ }).fill("2");
  await box("NJD").uncheck();
  await expect.poll(() => requests.at(-1)?.get("teams")).toBe("");
  await expect(page.getByTestId("crease-shift-rank")).toHaveCount(12);

  const twelve = ["BOS", "BUF", "DET", "EDM", "FLA", "MTL", "NJD", "NYR", "OTT", "PHI", "PIT", "TBL"];
  for (const team of twelve) await box(team).check();
  await expect.poll(() => requests.at(-1)?.get("teams")).toBe(twelve.join(","));
  await expect(box("TOR")).toBeDisabled();
  await expect(box("NJD")).toBeEnabled();
  await expect(page.getByTestId("crease-shift-rank")).toHaveCount(12);
  await expect(page.getByTestId("post-evidence")).toContainText(`Teams picked: ${twelve.join(", ")}; RK is each team's rank among all 14`);
  await box("NJD").uncheck();
  await expect(box("TOR")).toBeEnabled();
});

test("goalie of the period: a failed TGV read shows grades as unavailable and cannot export", async ({ page }) => {
  await install(page);
  const result = buildGoaliePeriod({ settings: periodSettings, period: weekPeriod(week, "2026-10-30"), appearances, reported, scheduled, tgv: null, adp });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", periodSettings, result) }));
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  await expect(page.getByTestId("goalie-period-row").first().locator('[data-group="tgv"]')).toHaveText("Unavailable");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("goalie of the period: a game without one labeled starter cannot export", async ({ page }) => {
  await install(page);
  const result = buildGoaliePeriod({ settings: periodSettings, period: weekPeriod(week, "2026-10-30"), appearances: [...appearances, stat(9, "NJD", 1, days[0])], reported, scheduled, tgv, adp });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", periodSettings, result) }));
  await page.goto("/social-share/posts?post=goalie-period&week=4");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("GSAx: a chosen matchup prints its dates and fills the body, and its pager follows the week", async ({ page }) => {
  await install(page);
  const calendar = [{ week: 3, start_date: "2026-10-12", end_date: "2026-10-18" }, { week: 4, start_date: week.start, end_date: week.end }];
  await page.route("**/api/v1/social-share/matchup-weeks", route => route.fulfill({ json: { rows: calendar, cutoff: "2026-10-28" } }));
  const goalies = Array.from({ length: 24 }, (_, index) => index + 1);
  const games = goalies.map((_, index) => ({ id: index + 1, date: `2026-10-${19 + index % 7}`, homeTeamId: teamsInfo.NJD.id, awayTeamId: teamsInfo.NYR.id, final: true }));
  const rows = games.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
  const stats = rows.map((game, index) => stat(index % 24 + 1, game.team, game.gameId, game.date, { name: "Ukko-Pekka Luukkonen" }));
  const nstGames = stats.map((row, index) => ({ goalieId: row.goalieId, date: row.date, toiSeconds: 3600, xgAgainst: 1 + index % 7, goalsAgainst: 3, shotsAgainst: 30 })).filter((row, index, all) => all.findIndex(other => other.goalieId === row.goalieId && other.date === row.date) === index);
  const settings = { ...gsaxSettings, period: "matchup", week: 4, minCoverage: 50 };
  const result = buildGoalieGsax({ appearances: stats, nstGames, strength: "all", window: { from: week.start, through: week.end, label: "Week 4 · Oct 19 to Oct 25", week: 4 }, weeks: [week], board: "both", minAppearances: 1, minCoverage: 50, reported: rows, scheduled: games, fhfhRows: 0 });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-gsax", settings, result) }));
  await page.goto("/social-share/posts?post=goalie-gsax&period=matchup&week=4&minCoverage=50");
  await expect(page.getByTestId("period-pager-label")).toHaveText("Week 4 · Oct 19 to Oct 25");
  await expect(page.getByTestId("goalie-gsax-card")).toContainText("Week 4 · Oct 19 to Oct 25.");
  await expect(page.getByRole("combobox", { name: /^Window/ })).toHaveCount(0);
  await expect(page.getByTestId("board-best").getByTestId("goalie-gsax-row")).toHaveCount(10);
  await expectBodyFilled(page, "goalie-gsax-card");
  await download(page);
});

test("GSAx: a custom range past NST's newest date shows the lag and cannot export", async ({ page }) => {
  await install(page);
  const nstGames = appearances.filter(row => row.date <= days[1]).map(row => ({ goalieId: row.goalieId, date: row.date, toiSeconds: 3600, xgAgainst: 3, goalsAgainst: row.goalsAgainst, shotsAgainst: row.shotsAgainst }));
  const settings = { ...gsaxSettings, period: "custom", start: days[0], end: days[3] };
  const result = buildGoalieGsax({ appearances, nstGames, strength: "all", window: { from: days[0], through: days[3], label: "Oct 19 to Oct 22", week: null }, weeks: [week], board: "both", minAppearances: 1, minCoverage: 90, reported, scheduled, fhfhRows: 0 });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-gsax", settings, result) }));
  await page.goto(`/social-share/posts?post=goalie-gsax&period=custom&start=${days[0]}&end=${days[3]}`);
  await expect(page.getByTestId("goalie-gsax-card")).toContainText("Oct 19 to Oct 22.");
  await expect(page.getByTestId("goalie-gsax-card")).toContainText(`through ${days[1]}, 2 days behind NHL.com`);
  await expect(page.getByTestId("post-evidence-line")).toContainText("runs past NST's newest date");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("GSAx: an old window URL keeps its window and shows the field", async ({ page }) => {
  await install(page);
  const nstGames = appearances.map(row => ({ goalieId: row.goalieId, date: row.date, toiSeconds: 3600, xgAgainst: 3, goalsAgainst: row.goalsAgainst, shotsAgainst: row.shotsAgainst }));
  const settings = { ...gsaxSettings, window: "5" };
  const result = buildGoalieGsax({ appearances, nstGames, strength: "all", window: 5, weeks: [week], board: "both", minAppearances: 1, minCoverage: 90, reported, scheduled, fhfhRows: 0 });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-gsax", settings, result) }));
  await page.goto("/social-share/posts?post=goalie-gsax&window=5");
  await expect(page.getByTestId("goalie-gsax-card")).toContainText("Last 5 appearances per goalie.");
  await openOptions(page);
  await expect(page.getByRole("combobox", { name: /^Window/ })).toHaveValue("5");
});

test("GSAx: Best and Worst, NST model and through-date", async ({ page }) => {
  await install(page);
  const nstGames = appearances.filter(row => row.date <= days[2]).map(row => ({ goalieId: row.goalieId, date: row.date, toiSeconds: 3600, xgAgainst: 3, goalsAgainst: row.goalsAgainst, shotsAgainst: row.shotsAgainst }));
  const result = buildGoalieGsax({ appearances, nstGames, strength: "all", window: "week", weeks: [week], board: "both", minAppearances: 1, minCoverage: 90, reported: reported.filter(game => game.date <= days[2]), scheduled: scheduled.filter(game => game.date <= days[2]), fhfhRows: 0 });
  const settings = gsaxSettings;
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
