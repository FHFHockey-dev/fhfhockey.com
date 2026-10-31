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
const periodSettings = { period: "week", week: 4, month: "", minStartsWeek: 2, minStartsMonth: 5, board: "best", categories: "wins,saves,svPct,gaa,shutouts" };
const tgv = { goalies: [{ goalie_id: 1, week: 4, weekly_gs: 2, weekly_toi_seconds: 7200, weekly_wins: 2, weekly_saves: 68, weekly_sv_pct: 0.97 }], league: [{ week: 4, avg_league_weekly_wins: 1, avg_league_weekly_saves: 40, avg_league_weekly_sv_pct: 0.9 }] } as never;

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
  const result = buildCreaseShift({ reported, appearances, scheduled, teams: ["NJD", "NYR"], window: 2, comparison: "previous", through: "2026-10-30" });
  const settings = { window: "10", comparison: "previous" };
  let requests = 0;
  await page.route("**/api/v1/social-share/posts/**", route => { requests++; return route.fulfill({ json: edition("crease-shift", settings, result) }); });
  await page.goto("/social-share/posts?post=crease-shift");
  const square = page.getByTestId("share-square");
  await expect(square).toContainText("Official starts ÷ completed team games");
  await expect(square).toContainText("Fictional Goalie 2");
  await expect(square).not.toContainText(/probab|likely|odds/i);
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  await expect(square).toHaveAttribute("data-export-token", 'crease-shift-e2e|crease-shift|[["window","10"],["comparison","previous"]]');
  const before = requests;
  await download(page);
  expect(requests).toBe(before);
});

test("crease shift: a schedule gap previews as partial and cannot export", async ({ page }) => {
  await install(page);
  const result = buildCreaseShift({ reported: reported.slice(1), appearances, scheduled, teams: ["NJD", "NYR"], window: 2, comparison: "previous", through: "2026-10-30" });
  expect(reconcileSchedule(scheduled, reported.slice(1)).missing).toBe(1);
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("crease-shift", { window: "10", comparison: "previous" }, result) }));
  await page.goto("/social-share/posts?post=crease-shift");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("goalie of the period: Category Counts and the TGV grade stay under their own labels", async ({ page }) => {
  await install(page);
  const result = buildGoaliePeriod({ settings: periodSettings, period: weekPeriod(week, "2026-10-30"), appearances, reported, scheduled, tgv });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", periodSettings, result) }));
  await page.goto("/social-share/posts?post=goalie-period");
  await expect(page.getByTestId("goalie-period-winners")).toContainText("Fictional Goalie 1");
  await expect(page.getByTestId("category-counts")).toContainText("Category Counts");
  await expect(page.getByTestId("category-counts")).not.toContainText("TGV");
  await expect(page.getByTestId("tgv-existing")).toContainText("TGV grade (existing method)");
  await expect(page.getByTestId("post-evidence")).toContainText("Categories: wins,saves,svPct,gaa,shutouts");
  await download(page);
});

test("goalie of the period: a game without one labeled starter cannot export", async ({ page }) => {
  await install(page);
  const result = buildGoaliePeriod({ settings: periodSettings, period: weekPeriod(week, "2026-10-30"), appearances: [...appearances, stat(9, "NJD", 1, days[0])], reported, scheduled, tgv });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-period", periodSettings, result) }));
  await page.goto("/social-share/posts?post=goalie-period");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("GSAx: NST model, strength, lag and the unavailable FHFH model are on the card", async ({ page }) => {
  await install(page);
  const nstGames = appearances.filter(row => row.date <= days[2]).map(row => ({ goalieId: row.goalieId, date: row.date, toiSeconds: 3600, xgAgainst: 3, goalsAgainst: row.goalsAgainst, shotsAgainst: row.shotsAgainst }));
  const result = buildGoalieGsax({ appearances, nstGames, strength: "all", window: 10, board: "best", minAppearances: 1, minCoverage: 90, reported: reported.filter(game => game.date <= days[2]), scheduled: scheduled.filter(game => game.date <= days[2]), fhfhRows: 0 });
  const settings = { window: "10", strength: "all", board: "best", minAppearances: 1, minCoverage: 90 };
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: edition("goalie-gsax", settings, result) }));
  await page.goto("/social-share/posts?post=goalie-gsax");
  const square = page.getByTestId("share-square");
  await expect(square).toContainText("NST model, All situations.");
  await expect(square).toContainText("1 day behind NHL.com");
  await expect(square).toContainText("FHFH xG model: unavailable this season");
  await expect(square).not.toContainText(/gsaa/i);
  await download(page);
});
