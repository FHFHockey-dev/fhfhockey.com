import { expect, test } from "@playwright/test";

/** Off-Night Edge in the post library, against a fictional edition. The lead runs this serially at 13.0. */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const editorToken = "e2e-fictional-editor-token";
const pick = (nhlId: number, name: string, pct: number | null, chips: { hot?: boolean; shortSample?: boolean } = {}) => ({ nhlId, name, positions: "C", ownership: pct === null ? { state: "unknown", pct: null, asOf: null } : { state: "known", pct, asOf: "2026-10-31" }, games: chips.shortSample ? 3 : 5, fantasyPerGame: 3.2, score: 3.4, hot: !!chips.hot, shortSample: !!chips.shortSample });
/** Evidence harness only: set to a folder to save before and after renders of the cards below. Unset in normal runs. */
const renders = process.env.OFF_NIGHT_RENDER_DIR, renderName = process.env.OFF_NIGHT_RENDER_PREFIX ?? "after";
const OPPONENTS = ["BOS", "TOR", "MTL", "OTT", "DET", "BUF", "TBL", "FLA", "PIT", "PHI", "WSH", "CAR", "CBJ", "NYI"];

function edition(dates: "rest-of-week" | "weekly", over: Record<string, unknown> = {}) {
  const generatedAt = new Date().toISOString(), weekly = dates === "weekly";
  return {
    schemaVersion: 1, id: `off-night-edge-${dates}`, post: "off-night-edge", state: "ready", reasons: [] as string[], generatedAt, expiresAt: new Date(Date.parse(generatedAt) + 600000).toISOString(), timeZone: "America/New_York",
    settings: { ownershipCeiling: 50, includeUnknown: "off", dates, period: "this-week", week: null, start: null, end: null }, teams: ["NJD", "NYR", "BOS", "TOR"], fixture: false, pageNotes: ["NJD No D: 2 over 50%, 1 unknown %.", "NYR No F: 3 over 50%."],
    evidence: { sources: [{ name: "NHL schedule (Game Grid edition)", tables: ["NHL schedule API"], state: "ready", asOf: "2026-11-01", updatedAt: null }, { name: "Yahoo ownership", tables: ["yahoo_players"], state: "ready", asOf: "2026-10-31", updatedAt: null }],
      sample: "Fictional sample", strength: "All situations", cohort: "Top 2 of 2 teams with games", coverage: { observed: 4, expected: 4, missing: 0, unit: "team games" } },
    data: { dates, window: { kind: "this-week", week: null, from: "2026-10-31", through: "2026-11-01", label: `${weekly ? "Full week" : "Rest of week"} · Oct 31 to Nov 1`, past: false, playedIncluded: false }, weekStart: "2026-10-26", weekEnd: "2026-11-01", countedGames: 2, teamsWithGames: 2, tiedOut: [], ownership: { known: 2, unknown: 1, stale: 0, asOf: "2026-10-31" },
      days: [{ date: "2026-10-31", label: "Sat", leagueGames: 12, offNight: false }, { date: "2026-11-01", label: "Sun", leagueGames: 3, offNight: true }],
      rows: [
        { team: weekly ? "NYR" : "NJD", teamName: "First", rank: 1, score: 7.5, games: 2, offNightGames: 1, gamesByDay: [1, 1], opponentsByDay: [["BOS"], ["TOR"]], picks: { F: pick(1, "Fictional Forward", 0, { hot: true }), D: null }, gaps: { F: null, D: "No D: 2 over 50%, 1 unknown %" } },
        { team: weekly ? "NJD" : "NYR", teamName: "Second", rank: 2, score: 1.5, games: 1, offNightGames: 0, gamesByDay: [1, 0], opponentsByDay: [["TOR"], []], picks: { F: null, D: pick(2, "Fictional Defenseman", 12, { shortSample: true }) }, gaps: { F: "No F: 3 over 50%", D: null } },
      ] }, ...over,
  };
}

test.beforeEach(async ({ page }) => {
  const user = { id: "00000000-0000-4000-8000-00000000e2e1", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
  const session = { access_token: editorToken, refresh_token: "e2e-fictional-refresh", token_type: "bearer", expires_in: 365 * 86400, expires_at: Math.floor(Date.now() / 1000) + 365 * 86400, user };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${supabaseOrigin.hostname.split(".")[0]}-auth-token`, JSON.stringify(session)]);
  await page.context().route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route(`${supabaseOrigin.origin}/**`, route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET") return route.abort();
    if (url.pathname === "/rest/v1/users") return route.fulfill({ json: /vnd\.pgrst\.object/.test(request.headers().accept ?? "") ? { role: "social_editor" } : [{ role: "social_editor" }] });
    return route.fulfill({ json: [] });
  });
});

test("off-night edge: dates refetch a recomputed order, chips and 0% print, gaps are page notes, and export follows the settings", async ({ page }) => {
  const requested: string[] = [];
  await page.route("**/api/v1/social-share/posts/**", route => {
    const url = new URL(route.request().url());
    requested.push(url.search);
    expect(route.request().headers().authorization).toBe(`Bearer ${editorToken}`);
    return route.fulfill({ json: edition(url.searchParams.get("dates") === "weekly" ? "weekly" : "rest-of-week") });
  });
  await page.goto("/social-share/posts?post=off-night-edge");
  const square = page.getByTestId("share-square");
  await expect(square).toBeVisible();
  await expect(square).toContainText("Fictional Forward");
  await expect(square).toContainText("0%");
  await expect(square.getByTestId("off-night-gap").first()).toHaveText("No pick");
  await expect(square).not.toContainText("over 50%");
  await expect(page.getByTestId("post-page-notes")).toContainText("NJD No D: 2 over 50%, 1 unknown %.");
  await expect(square).toContainText("HOT");
  await expect(square).toContainText("Short Sample");
  await expect(square.getByRole("img", { name: "BOS" })).toBeVisible();
  await expect(page.getByTestId("post-evidence")).toContainText("Ownership ceiling %: 50");
  await expect(page.getByTestId("post-evidence")).toContainText("Dates: Rest of week");
  await expect(square.getByTestId("off-night-legend")).toContainText("Rest of week");
  await expect(page.getByTestId("post-evidence")).toContainText("Top 2 of 2 teams with games");
  await expect(square).toHaveAttribute("data-export-token", /off-night-edge-rest-of-week\|off-night-edge\|/);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  if (renders) await page.locator("main, body").first().screenshot({ path: `${renders}/${renderName}-rest-of-week-page.png` });
  if (renders) await square.screenshot({ path: `${renders}/${renderName}-rest-of-week-card.png` });

  // A changed setting reloads the post on its own, and export follows the new edition.
  await page.getByLabel("Dates").selectOption("weekly");
  await expect(square.getByTestId("off-night-legend")).toContainText("Full week");
  await expect(square).toHaveAttribute("data-export-token", /off-night-edge-weekly\|off-night-edge\|/);
  expect(requested.some(search => search.includes("dates=weekly"))).toBe(true);
});

test("off-night edge: a past 14-day matchup prints its dates and past label, and 16 long rows fit the card unclipped", async ({ page }) => {
  const days = Array.from({ length: 14 }, (_, index) => { const date = `2027-02-${String(index + 1).padStart(2, "0")}`; return { date, label: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"][index % 7], leagueGames: index % 3 ? 12 : 4, offNight: !(index % 3) }; });
  const longGap = "No D: 12 over 50%, 3 unknown %, 2 stale %, 4 unavailable, 1 no identity";
  const rows = Array.from({ length: 16 }, (_, index) => ({ team: "NJD", teamName: "Long", rank: index + 1, score: 18.5 - index, games: 8, offNightGames: 3, gamesByDay: days.map((_, day) => (day + index) % 2), opponentsByDay: days.map((_, day) => (day + index) % 2 ? [OPPONENTS[(day + index) % OPPONENTS.length]] : []), picks: { F: pick(index + 1, "Oliver Ekman-Larsson Jr", 12, { hot: index % 3 === 0, shortSample: index % 5 === 1 }), D: index % 2 ? pick(index + 100, "Trevor van Riemsdyk", null) : null }, gaps: { F: null, D: index % 2 ? null : longGap } })).map((row, index) => ({ ...row, team: `T${String(index).padStart(2, "0")}` }));
  await page.route("**/api/v1/social-share/posts/**", route => {
    const period = new URL(route.request().url()).searchParams.get("period"), past = period === "matchup";
    const base = edition("weekly"), data = base.data as Record<string, unknown>;
    return route.fulfill({ json: !past ? base : { ...base, id: "off-night-edge-week-19", teams: [...base.teams, ...OPPONENTS], settings: { ...base.settings, period: "matchup", week: 19 }, data: { ...data, days, rows, window: { kind: "matchup", week: 19, from: "2027-02-01", through: "2027-02-14", label: "Week 19 · Feb 1 to Feb 14", past: true, playedIncluded: false } } } });
  });
  await page.goto("/social-share/posts?post=off-night-edge&dates=weekly&period=matchup&week=19");
  const square = page.getByTestId("share-square");
  await expect(square.getByTestId("off-night-legend")).toContainText("Week 19 · Feb 1 to Feb 14");
  await expect(square.getByTestId("off-night-past")).toContainText("picks and ownership are current");
  await expect(page.getByTestId("period-control")).toBeVisible();
  const fit = await square.evaluate(node => {
    const body = node.querySelector('[data-dates]') as HTMLElement, table = body.firstElementChild as HTMLElement, legend = body.lastElementChild as HTMLElement, scale = node.getBoundingClientRect().width / 1080;
    const bottom = body.parentElement!.getBoundingClientRect().bottom;
    const cells = [...table.children].filter(cell => cell.scrollWidth > cell.clientWidth + 1 || cell.scrollHeight > cell.clientHeight + 1).map(cell => (cell as HTMLElement).innerText);
    const rowHeights = [...table.children].slice(21, 21 + 16 * 21).map(cell => cell.getBoundingClientRect().height / scale);
    return { cells, overflow: legend.getBoundingClientRect().bottom - bottom, legendHeight: legend.getBoundingClientRect().height / scale, minRow: Math.min(...rowHeights), wide: table.scrollWidth - table.clientWidth, deadBand: (bottom - legend.getBoundingClientRect().bottom) / scale };
  });
  expect(fit.cells).toEqual([]);
  expect(fit.wide).toBeLessThanOrEqual(1);
  expect(fit.overflow).toBeLessThanOrEqual(1);
  expect(fit.deadBand).toBeLessThanOrEqual(40);
  if (renders) await square.screenshot({ path: `${renders}/${renderName}-14-day-card.png` });
});

test("off-night edge: the pager opens next week's matchup, labelled, and a week not published gives its reason", async ({ page }) => {
  const requested: string[] = [];
  await page.route("**/api/v1/social-share/matchup-weeks", route => route.fulfill({ json: { cutoff: "2026-10-31", rows: [{ week: 5, start_date: "2026-10-26", end_date: "2026-11-01" }, { week: 6, start_date: "2026-11-02", end_date: "2026-11-08" }, { week: 7, start_date: "2026-11-09", end_date: "2026-11-15" }] } }));
  await page.route("**/api/v1/social-share/posts/**", route => {
    const url = new URL(route.request().url()), week = url.searchParams.get("week"), base = edition("weekly"), settings = { ...base.settings, period: "matchup", week: week ? Number(week) : null };
    requested.push(url.search);
    if (week === "7") return route.fulfill({ json: { ...base, id: "off-night-week-7", state: "missing", data: null, teams: [], settings, reasons: ["The NHL schedule shows no games yet for Week 7 · Nov 9 to Nov 15, so there is no ranking. It may not be published."] } });
    const next = week === "6";
    return route.fulfill({ json: { ...base, id: `off-night-week-${week ?? "blank"}`, settings, data: { ...base.data, window: { kind: "matchup", week: next ? 6 : 5, from: next ? "2026-11-02" : "2026-10-26", through: next ? "2026-11-08" : "2026-11-01", label: next ? "Week 6 · Nov 2 to Nov 8" : "Week 5 · Oct 26 to Nov 1", past: false, playedIncluded: !next, upcoming: next ? "next-week" : null } } } });
  });
  await page.goto("/social-share/posts?post=off-night-edge&period=matchup");
  const square = page.getByTestId("share-square"), next = page.getByRole("button", { name: /^Next week/ });
  await expect(page.getByTestId("period-pager-label")).toHaveText("Week 5 · Oct 26 to Nov 1");
  await expect(square.getByTestId("off-night-legend")).toContainText("Week 5");
  await next.click();
  await expect(square.getByTestId("off-night-legend")).toContainText("Next week · Week 6 · Nov 2 to Nov 8");
  await expect(square.getByTestId("off-night-upcoming")).toHaveText("Picks use recent form and ownership as of today");
  await expect(page.getByTestId("period-pager-label")).toHaveText("Week 6 · Nov 2 to Nov 8");
  expect(requested[requested.length - 1]).toContain("week=6");
  await next.click();
  await expect(page.getByTestId("post-unavailable")).toContainText("It may not be published");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("off-night edge: old links load as this week, and the period control offers matchup and custom", async ({ page }) => {
  const requested: string[] = [];
  await page.route("**/api/v1/social-share/posts/**", route => {
    requested.push(new URL(route.request().url()).search);
    return route.fulfill({ json: edition("weekly") });
  });
  await page.goto("/social-share/posts?post=off-night-edge&dates=weekly");
  await expect(page.getByTestId("share-square").getByTestId("off-night-legend")).toContainText("Full week · Oct 31 to Nov 1");
  expect(requested[0]).toContain("dates=weekly");
  expect(requested[0]).toContain("period=this-week");
  await expect(page.getByLabel("Dates")).toHaveValue("weekly");
  const period = page.getByTestId("period-control").getByLabel("Period");
  await expect(period.locator("option")).toHaveText(["This week", "Matchup week", "Custom range"]);
  await period.selectOption("custom");
  await expect(page.getByTestId("period-reason")).toContainText("start date and an end date");
  await expect(page.getByLabel("Dates")).toHaveCount(0);
});

test("team games: old days links stay rolling, the card prints its dates, and a matchup refetches", async ({ page }) => {
  const requested: string[] = [], generatedAt = new Date().toISOString();
  const body = (period: string) => ({ schemaVersion: 1, id: `team-games-${period}`, post: "team-games", state: "ready", reasons: [], generatedAt, expiresAt: new Date(Date.parse(generatedAt) + 600000).toISOString(), timeZone: "America/New_York", settings: { days: 14, period, week: null, start: null, end: null }, fixture: false, teams: ["NJD"],
    evidence: { sources: [{ name: "NHL.com team game stats", tables: ["wgo_team_stats"], state: "ready", asOf: "2026-10-30", updatedAt: null }], sample: "1 completed team game", strength: "Not applicable (game counts)", cohort: "All 1 teams", coverage: { observed: 1, expected: 1, missing: 0, unit: "team games" } },
    data: { from: "2026-10-17", through: "2026-10-30", label: period === "rolling" ? "Last 14 days · Oct 17 to Oct 30" : "Week 4 · Oct 19 to Oct 25", rows: [{ team: "NJD", games: 1, lastGame: "2026-10-30", rank: 1 }] } });
  await page.route("**/api/v1/social-share/posts/**", route => {
    const url = new URL(route.request().url());
    requested.push(url.search);
    return route.fulfill({ json: body(url.searchParams.get("period") ?? "rolling") });
  });
  await page.goto("/social-share/posts?post=team-games&days=14");
  const square = page.getByTestId("share-square");
  await expect(square.getByTestId("team-games-period")).toHaveText("Last 14 days · Oct 17 to Oct 30");
  expect(requested[0]).toBe("?days=14&period=rolling");
  await page.getByTestId("period-control").getByLabel("Period").selectOption("matchup");
  await expect(square.getByTestId("team-games-period")).toHaveText("Week 4 · Oct 19 to Oct 25");
  await expect(page.getByLabel(/^Days/)).toHaveCount(0);
});

test("off-night edge: partial previews without export, stale shows its reason and no card", async ({ page }) => {
  let body = edition("rest-of-week", { state: "partial", reasons: ["1 qualified skaters have Yahoo ownership older than a day, so they are excluded."] });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: body }));
  await page.goto("/social-share/posts?post=off-night-edge");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
  body = edition("rest-of-week", { state: "stale", data: null, teams: [], reasons: ["Most Yahoo ownership is older than a day (9 of 10 qualified skaters)."] });
  // No setting changed, so a new edition comes from reopening the page.
  await page.reload();
  await expect(page.getByTestId("post-unavailable")).toContainText("older than a day");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});
