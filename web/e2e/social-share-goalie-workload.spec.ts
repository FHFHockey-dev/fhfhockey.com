import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBusyQuiet, type BusyQuietSettings } from "../lib/socialShare/modules/busyQuiet";
import type { SharePostLoadResult } from "../lib/socialShare/modules/contract";
import { buildGoalieRescue, type GoalieRescueSettings } from "../lib/socialShare/modules/goalieRescue";
import { buildRatioImpact, manualBase, type RatioImpactSettings } from "../lib/socialShare/modules/ratioImpact";
import { ownershipOf } from "../lib/socialShare/modules/shared/definitions";
import type { GoalieAppearance } from "../lib/socialShare/modules/shared/goalieLedger";

/** Fictional editor and fictional goalies: the API is mocked with editions built by the posts' own pure builders. */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const editorToken = "e2e-fictional-editor-token";
async function signIn(page: Page) {
  expect(supabaseOrigin.hostname.endsWith(".invalid")).toBe(true);
  const user = { id: "00000000-0000-4000-8000-00000000e2e1", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
  const session = { access_token: editorToken, refresh_token: "e2e-fictional-refresh", token_type: "bearer", expires_in: 365 * 86400, expires_at: Math.floor(Date.now() / 1000) + 365 * 86400, user };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${supabaseOrigin.hostname.split(".")[0]}-auth-token`, JSON.stringify(session)]);
  await page.context().route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
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

const date = (day: number) => `2026-10-${String(day).padStart(2, "0")}`;
const appearance = (over: Partial<GoalieAppearance> & { goalieId: number; gameId: number; date: string }): GoalieAppearance => ({ name: `Fictional Goalie ${over.goalieId}`, team: "NJD", opponent: "NYR", home: true, started: true, wins: 1, losses: 0, otLosses: 0, saves: 27, shotsAgainst: 30, goalsAgainst: 3, toiSeconds: 3600, shutouts: 0, qualityStart: 1, ...over });
/** Each fictional game is NJD (goalie 1) against NYR (goalie 2), with goalie 2 relieved once by goalie 3. */
const days = [1, 2, 3, 4];
const appearances = days.flatMap(day => [appearance({ goalieId: 1, gameId: day, date: date(day) }), appearance({ goalieId: 2, gameId: day, date: date(day), team: "NYR", opponent: "NJD", shotsAgainst: 20, saves: 18, goalsAgainst: 2, wins: 0 })]).concat(appearance({ goalieId: 3, gameId: 4, date: date(4), team: "NYR", opponent: "NJD", started: false, shotsAgainst: 5, saves: 5, goalsAgainst: 0, toiSeconds: 1200, wins: 0 }));
const teamGames = days.flatMap(day => [{ gameId: day, date: date(day), team: "NJD" }, { gameId: day, date: date(day), team: "NYR" }]);
const ledger = { appearances, teamGames, scheduledDates: days.map(date), through: date(30) };
const nst = {
  nstGoalie: days.flatMap(day => [1, 2].map(id => ({ player_id: id, date_scraped: date(day), toi: "60", hd_shots_against: 8, md_shots_against: 6, ld_shots_against: 6 }))),
  nstTeam: days.flatMap(day => ["NJD", "NYR"].map(team => ({ team_abbreviation: team, date: date(day), sca: 22, hdca: 9 }))),
};

function edition<Settings extends Record<string, string | number | null>, Data>(post: string, settings: Settings, result: SharePostLoadResult<Data>) {
  const generatedAt = new Date().toISOString();
  return { schemaVersion: 1, id: `${post}-e2e-${JSON.stringify(settings).length}-${Object.values(settings).join("-")}`, post, state: result.state, reasons: result.reasons ?? [], generatedAt, expiresAt: new Date(Date.parse(generatedAt) + 600000).toISOString(), timeZone: "America/New_York", settings, fixture: false, teams: result.teams ?? [], evidence: result.evidence, data: result.data };
}
const fromQuery = (url: URL) => Object.fromEntries(url.searchParams);
const busyQuiet = (url: URL) => {
  const query = fromQuery(url), settings: BusyQuietSettings = { basis: (query.basis ?? "start") as BusyQuietSettings["basis"], window: (query.window ?? "l10") as BusyQuietSettings["window"], minStarts: Number(query.minStarts ?? 3) };
  return edition("busy-quiet-goalies", settings, buildBusyQuiet({ settings, ...ledger, ...nst }));
};
const rescue = (url: URL) => {
  const query = fromQuery(url), settings: GoalieRescueSettings = { category: (query.category ?? "wins") as GoalieRescueSettings["category"], window: (query.window ?? "l10") as GoalieRescueSettings["window"], ownershipCeiling: Number(query.ownershipCeiling ?? 50), includeUnknown: (query.includeUnknown ?? "off") as GoalieRescueSettings["includeUnknown"], minStarts: Number(query.minStarts ?? 3) };
  return edition("goalie-rescue", settings, buildGoalieRescue({ settings, ...ledger, availability: new Map([[1, { ownership: ownershipOf(20, date(30)), status: "" }], [2, { ownership: ownershipOf(null), status: "" }]]), ownershipAsOf: date(30), ownershipFresh: true, teamGamesLeft: new Map([["NJD", 2], ["NYR", 1]]), weekEnd: "2026-11-01" }));
};
const ratio = (url: URL) => {
  const query = fromQuery(url), value = (key: string, fallback: number | null) => key in query ? Number(query[key]) : fallback;
  const settings: RatioImpactSettings = { baseGoalieId: value("baseGoalieId", null), baseShots: value("baseShots", null), baseGoals: value("baseGoals", null), baseMinutes: value("baseMinutes", null), scenarioShots: value("scenarioShots", 30)!, scenarioGoals: value("scenarioGoals", 3)!, scenarioMinutes: value("scenarioMinutes", 60)!, sensitivityGoalsFrom: value("sensitivityGoalsFrom", 0)!, sensitivityGoalsTo: value("sensitivityGoalsTo", 6)! };
  return edition("ratio-impact", settings, buildRatioImpact(settings, manualBase(settings), null));
};
async function serve(page: Page, build: (url: URL) => object) {
  const requests: string[] = [];
  await page.route("**/api/v1/social-share/posts/**", route => {
    requests.push(route.request().url());
    expect(route.request().headers().authorization).toBe(`Bearer ${editorToken}`);
    return route.fulfill({ json: build(new URL(route.request().url())) });
  });
  return requests;
}
async function downloadsPng(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const download = await pending, file = join(tmpdir(), `${name}-${Date.now()}.png`);
  await download.saveAs(file);
  const bytes = await readFile(file);
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1080]);
}

test.beforeEach(({ page }) => page.setDefaultTimeout(10000));

test("Busy and Quiet keeps volume apart from performance, and basis changes the read", async ({ page }) => {
  await signIn(page);
  const requests = await serve(page, busyQuiet);
  const response = await page.goto("/social-share/posts?post=busy-quiet-goalies");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  const card = page.getByTestId("busy-quiet-card");
  await expect(card).toContainText("Workload only");
  await expect(card).toContainText("SA/GS");
  await expect(card).toContainText("HD SHOTS/GS");
  await expect(card).toContainText("TEAM SCA");
  await expect(card.locator("svg[data-sparkline]").first()).toBeVisible();
  await expect(card).not.toContainText(/SV%|GAA/);
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  await expect(page.getByTestId("post-evidence")).toContainText("All situations");
  await expect(page.getByTestId("post-evidence")).toContainText("Basis: Per start");
  expect(requests[0]).toContain("basis=start");
  await expect(page.getByText("Works for a Thursday or Friday post.")).toBeVisible();
  await page.getByLabel("Basis").selectOption("per60");
  await page.getByRole("button", { name: "Refresh post" }).click();
  await expect(card).toContainText("SA/60");
  expect(requests.at(-1)).toContain("basis=per60");
  await downloadsPng(page, "busy-quiet");
});

test("an empty Busy and Quiet pool says why and cannot export", async ({ page }) => {
  await signIn(page);
  await serve(page, busyQuiet);
  await page.goto("/social-share/posts?post=busy-quiet-goalies&minStarts=20");
  await expect(page.getByText("No goalie has 20 official starts in this window")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("Goalie Category Rescue orders by one category and shows ownership states", async ({ page }) => {
  await signIn(page);
  const requests = await serve(page, rescue);
  await page.goto("/social-share/posts?post=goalie-rescue");
  const card = page.getByTestId("goalie-rescue-card");
  await expect(card).toContainText("Rostered % is Yahoo-wide");
  await expect(card).toContainText("20%");
  await expect(card).toContainText("Volume");
  await expect(card.locator('[data-head][data-selected]')).toHaveText("W");
  await expect(card).not.toContainText("Fictional Goalie 2");
  await expect(page.getByTestId("post-evidence")).toContainText("1 unknown ownership excluded");
  await expect(page.getByText("Works for a Thursday or Friday post.")).toBeVisible();
  await page.getByLabel("Include unknown ownership").selectOption("on");
  await page.getByRole("button", { name: "Refresh post" }).click();
  await expect(card).toContainText("Fictional Goalie 2");
  expect(requests.at(-1)).toContain("includeUnknown=on");
  await page.getByRole("combobox", { name: /^Category/ }).selectOption("gaa");
  await page.getByRole("button", { name: "Refresh post" }).click();
  expect(new URL(page.url()).searchParams.get("category")).toBe("gaa");
  await downloadsPng(page, "goalie-rescue");
});

test("Ratio Impact is hypothetical, works with no base and pools with one", async ({ page }) => {
  await signIn(page);
  await serve(page, ratio);
  await page.goto("/social-share/posts?post=ratio-impact");
  const card = page.getByTestId("ratio-impact-card");
  await expect(page.getByTestId("post-watermark")).toHaveText("HYPOTHETICAL SCENARIO");
  await expect(card).toContainText("Before: No base entered");
  await expect(card).toContainText("Sensitivity at 30 SA and 60:00 TOI");
  await expect(card).not.toContainText(/forecast|transaction/i);
  await page.goto("/social-share/posts?post=ratio-impact&baseShots=1000&baseGoals=80&baseMinutes=2000");
  await expect(card).toContainText("Before: Entered base");
  await expect(card).toContainText("2060:00");
  await expect(card).toContainText(".920");
  await downloadsPng(page, "ratio-impact");
});
