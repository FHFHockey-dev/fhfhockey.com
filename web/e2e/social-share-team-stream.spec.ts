import { expect, test, type Page } from "@playwright/test";

/** Team Stream in the post library, against a fictional edition: the rail picks a team in the browser, with no reload. */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const editorToken = "e2e-fictional-editor-token";
/** Evidence harness only: set to a folder to save renders of the cards below. Unset in normal runs. */
const renders = process.env.TEAM_STREAM_RENDER_DIR;
/** Set to a saved real edition (JSON) to render it instead of the fictional one. Unset in normal runs. */
const realEdition = process.env.TEAM_STREAM_EDITION;

type Totals = { goals: number; assists: number; ppPoints: number; shots: number; pim: number | null; hits: number; blocks: number };
const METRICS = ["fp", "points", "ixg60", "iscf60", "icf60", "sog60", "toi", "ppToi"] as const;
function skater(nhlId: number, name: string, group: "F" | "D", pct: number, totals: Totals, fp: [number, number], extra: { hot?: boolean; line?: string | null; pp?: 1 | 2 | null; positions?: string; peripheral?: number } = {}) {
  const metrics = Object.fromEntries(METRICS.map(id => [id, id === "fp" ? { l5: fp[1], prior: fp[0] } : id === "toi" ? { l5: group === "D" ? 1290 : 1015, prior: group === "D" ? 1220 : 950 } : { l5: 1.2, prior: 1 }]));
  return { nhlId, name, positions: extra.positions ?? (group === "D" ? "D" : "C"), group, ownership: { state: "known", pct, asOf: "2026-11-06" }, yahooStatus: null, games: 5, shortSample: false, hot: !!extra.hot, score: fp[1], totals, metrics, peripheral: extra.peripheral ?? 0.5, role: { line: extra.line ?? null, pp: extra.pp ?? null } };
}
const DAYS = [{ date: "2026-11-06", label: "Thu", leagueGames: 9, offNight: false }, { date: "2026-11-07", label: "Fri", leagueGames: 5, offNight: true }, { date: "2026-11-08", label: "Sat", leagueGames: 13, offNight: false }, { date: "2026-11-09", label: "Sun", leagueGames: 4, offNight: true }];
const TEAMS: [string, string, number, (string | null)[], boolean[]][] = [
  ["NJD", "New Jersey Devils", 9.4, ["@BOS", "CHI", null, "@NYI"], []], ["COL", "Colorado Avalanche", 8.8, ["@SEA", null, "VAN", "@UTA"], []],
  ["TBL", "Tampa Bay Lightning", 8.1, [null, "FLA", "@MTL", "DET"], []], ["VAN", "Vancouver Canucks", 7.6, ["EDM", "@CGY", "@COL", null], []],
  ["MIN", "Minnesota Wild", 7.2, ["WPG", null, "@STL", "DAL"], []], ["SEA", "Seattle Kraken", 6.9, ["COL", "@LAK", null, "@ANA"], []],
  ["UTA", "Utah Mammoth", 6.5, [null, "@VGK", "SJS", "COL"], []], ["CHI", "Chicago Blackhawks", 6.1, [null, "@NJD", "PIT", "@CBJ"], []],
];
function edition(over: Record<string, unknown> = {}) {
  const generatedAt = new Date().toISOString();
  const teams = TEAMS.map(([team, teamName, score, slate], index) => {
    const schedule = slate.map(entry => entry ? [{ opponent: entry.replace("@", ""), home: !entry.startsWith("@"), played: false }] : []);
    const base = 100 * (index + 1);
    return { team, teamName, rank: index + 1, score, games: schedule.flat().length, offNightGames: schedule.filter((games, day) => games.length && DAYS[day].offNight).length, schedule,
      candidates: index === 6 ? [] : [
        skater(base + 1, `Fictional ${team} Winger`, "F", 31, { goals: 3, assists: 4, ppPoints: 3, shots: 17, pim: 2, hits: 6, blocks: 2 }, [2.4, 3.9], { hot: index === 0, line: "L1", pp: 1, positions: "LW,RW" }),
        skater(base + 2, index === 0 ? "Alexandre Fictionelli-Dubois" : `Fictional ${team} Center`, "F", 18, { goals: 2, assists: 2, ppPoints: 1, shots: 13, pim: 4, hits: 9, blocks: 3 }, [2.6, 2.9], { line: "L2", pp: 2 }),
        skater(base + 3, `Fictional ${team} Grinder`, "F", 4, { goals: 0, assists: 1, ppPoints: 0, shots: 8, pim: 12, hits: 21, blocks: 4 }, [1.9, 1.6], { line: "L3", peripheral: 0.9 }),
        skater(base + 4, `Fictional ${team} Defender`, "D", 12, { goals: 0, assists: 3, ppPoints: 1, shots: 9, pim: null, hits: 8, blocks: 14 }, [1.8, 2.2], { line: "P2", peripheral: 0.8 }),
      ] };
  });
  const settings = { ownershipCeiling: 50, includeUnknown: "off", focus: "overall", metric: "fp", team: "", period: "this-week", week: null, start: null, end: null };
  return {
    schemaVersion: 1, id: "team-stream-fixture", post: "team-stream", state: "ready", reasons: [] as string[], generatedAt, expiresAt: new Date(Date.parse(generatedAt) + 600000).toISOString(), timeZone: "America/New_York",
    settings, teams: [...new Set(teams.flatMap(team => [team.team, ...team.schedule.flat().map(game => game.opponent)]))], fixture: false, pageNotes: ["UTA: no streamer qualifies (No F: 6 over 50%; No D: 4 over 50%)."],
    evidence: { sources: [{ name: "NHL schedule (Game Grid edition)", tables: ["NHL schedule API"], state: "ready", asOf: "2026-11-09", updatedAt: null }, { name: "NHL.com game stats", tables: ["wgo_skater_stats"], state: "ready", asOf: "2026-11-05", updatedAt: null }, { name: "Yahoo ownership", tables: ["yahoo_players"], state: "ready", asOf: "2026-11-06", updatedAt: null }, { name: "NST game logs", tables: ["nst_gamelog_as_counts"], state: "ready", asOf: "2026-11-05", updatedAt: null }],
      sample: "Fictional sample", strength: "All situations", cohort: "Top 8 of 28 teams with games; skaters at or under 50% rostered, unknown % excluded", coverage: { observed: 84, expected: 84, missing: 0, unit: "team games" } },
    data: { window: { kind: "this-week", week: null, from: "2026-11-06", through: "2026-11-09", label: "Rest of week · Nov 6 to Nov 9", past: false, playedIncluded: false, upcoming: null }, days: DAYS, teams, teamsWithGames: 28, countedGames: 31, tiedOut: [], formThrough: "2026-11-05", ownership: { known: 40, unknown: 0, stale: 0, asOf: "2026-11-06" } },
    ...over,
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

/** The studio's Options group starts collapsed (SS-1103): open it before touching an option field. */
const openOptions = async (page: Page) => { const toggle = page.getByRole("button", { name: /^Options/ }); if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click(); };
const loadEdition = async () => realEdition ? JSON.parse(await import("node:fs").then(fs => fs.readFileSync(realEdition, "utf8"))) : edition();

test("team stream: the rail picks a team and the streamer focus without reloading, and export follows the choice", async ({ page }) => {
  const served = await loadEdition(), requested: string[] = [];
  await page.route("**/api/v1/social-share/posts/**", route => {
    requested.push(new URL(route.request().url()).search);
    expect(route.request().headers().authorization).toBe(`Bearer ${editorToken}`);
    return route.fulfill({ json: { ...served, generatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() } });
  });
  // The studio's settings come from the URL, so open it on the edition's own settings: a mismatch holds export.
  const query = new URLSearchParams([["post", "team-stream"], ...Object.entries(served.settings as Record<string, unknown>).flatMap(([id, value]) => value === null || value === "" ? [] : [[id, String(value)]])]);
  await page.goto(`/social-share/posts?${query}`);
  const square = page.getByTestId("share-square"), rail = page.getByTestId("team-stream-panel");
  await expect(square).toBeVisible();
  const [first, second] = served.data.teams;
  await expect(square.getByTestId("team-stream-hero")).toContainText(first.teamName);
  await expect(square.getByTestId("team-stream-player")).toHaveCount(3);
  await expect(rail.getByTestId("team-stream-team")).toHaveCount(served.data.teams.length);
  await expect(rail.getByTestId("team-stream-team").first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  // The card's rows fit its body: the last row ends above the legend.
  const lastRow = await square.getByTestId("team-stream-player").last().boundingBox(), legend = await square.getByTestId("team-stream-legend").boundingBox();
  expect(lastRow!.y + lastRow!.height).toBeLessThanOrEqual(legend!.y + 1);
  if (renders) {
    await page.locator("main, body").first().screenshot({ path: `${renders}/team-stream-page.png` });
    await square.screenshot({ path: `${renders}/team-stream-card.png` });
  }

  const token = await square.getAttribute("data-export-token");
  await rail.getByTestId("team-stream-team").nth(1).click();
  await expect(square.getByTestId("team-stream-hero")).toContainText(second.teamName);
  await expect(rail.getByTestId("team-stream-team").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(square).not.toHaveAttribute("data-export-token", token!);
  if (renders) await square.screenshot({ path: `${renders}/team-stream-card-second.png` });

  await openOptions(page);
  await page.getByRole("combobox", { name: "Streamers", exact: true }).selectOption("peripherals");
  await page.getByRole("combobox", { name: "Delta metric", exact: true }).selectOption("toi");
  await expect(square.getByTestId("team-stream-player").first()).toBeVisible();
  await expect(square).toContainText("TOI/GP Δ");
  if (renders) await square.screenshot({ path: `${renders}/team-stream-card-peripherals.png` });
  expect(requested).toHaveLength(1);
});
