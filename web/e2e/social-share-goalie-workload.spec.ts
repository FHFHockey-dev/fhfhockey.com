import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBusyQuiet, type BusyQuietSettings, type GoalieDateRange } from "../lib/socialShare/modules/busyQuiet";
import type { SharePostLoadResult } from "../lib/socialShare/modules/contract";
import { buildGoalieRescue, type GoalieRescueSettings } from "../lib/socialShare/modules/goalieRescue";
import { buildRatioImpact, goalieBase, manualBase, type RatioImpactSettings } from "../lib/socialShare/modules/ratioImpact";
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
const periodQuery = (query: Record<string, string>) => ({ period: query.period ?? "rolling", week: query.week ? Number(query.week) : null, start: query.start ?? null, end: query.end ?? null });
/** Week 1 ended before the last games, and week 2 is under way. */
const fixtureRange = (query: Record<string, string>): GoalieDateRange | null => query.period !== "matchup" ? null : query.week === "1" ? { from: date(2), through: date(3), line: "Week 1 · Oct 2 to Oct 3", past: true } : { from: date(1), through: date(4), line: "Week 2 · Oct 1 to Oct 7, games through Oct 4", past: false };
/** minStartsWeek=1 on a matchup week is the fullest card: every goalie tied, past the row caps, with long names. */
const fullPool = Array.from({ length: 34 }, (_, index) => index + 10), fullLedger = { ...ledger, appearances: fullPool.flatMap(goalieId => [1, 2, 3].map(day => appearance({ goalieId, gameId: goalieId * 10 + day, date: date(day), name: `Alexandar Georgiev-Hildeby ${goalieId}` }))) };
const fullCard = (query: Record<string, string>) => query.minStartsWeek === "1" && query.period === "matchup";
const busyQuiet = (url: URL) => {
  const query = fromQuery(url), settings: BusyQuietSettings = { basis: (query.basis ?? "start") as BusyQuietSettings["basis"], window: (query.window ?? "l10") as BusyQuietSettings["window"], minStarts: Number(query.minStarts ?? 3), minStartsWeek: Number(query.minStartsWeek ?? 2), minStartsRange: Number(query.minStartsRange ?? 2), ...periodQuery(query) };
  return edition("busy-quiet-goalies", settings, buildBusyQuiet({ settings, ...(fullCard(query) ? fullLedger : ledger), ...nst, range: fixtureRange(query) }));
};
const rescue = (url: URL) => {
  const query = fromQuery(url), settings: GoalieRescueSettings = { category: (query.category ?? "wins") as GoalieRescueSettings["category"], window: (query.window ?? "l10") as GoalieRescueSettings["window"], ownershipCeiling: Number(query.ownershipCeiling ?? 50), includeUnknown: (query.includeUnknown ?? "off") as GoalieRescueSettings["includeUnknown"], minStarts: Number(query.minStarts ?? 3), minStartsWeek: Number(query.minStartsWeek ?? 2), minStartsRange: Number(query.minStartsRange ?? 2), ...periodQuery(query) };
  return edition("goalie-rescue", settings, buildGoalieRescue({ settings, ...(fullCard(query) ? fullLedger : ledger), availability: new Map([[1, { ownership: ownershipOf(20, date(30)), status: "" }], [2, { ownership: ownershipOf(null), status: "" }], ...fullPool.map((id, index) => [id, { ownership: ownershipOf(index < 11 ? 5 : 10, date(30)), status: "" }] as const)]), teamGamesLeft: new Map([["NJD", 2], ["NYR", 1]]), scheduleReasons: [], weekEnd: "2026-11-01", range: fixtureRange(query) }));
};
const ratio = (url: URL) => {
  const query = fromQuery(url), value = (key: string, fallback: number | null) => key in query ? Number(query[key]) : fallback;
  const settings: RatioImpactSettings = { baseGoalieId: value("baseGoalieId", null), baseShots: value("baseShots", null), baseGoals: value("baseGoals", null), baseMinutes: value("baseMinutes", null), scenarioShots: value("scenarioShots", 30)!, scenarioGoals: value("scenarioGoals", 3)!, scenarioMinutes: value("scenarioMinutes", 60)!, sensitivityGoalsFrom: value("sensitivityGoalsFrom", 0)!, sensitivityGoalsTo: value("sensitivityGoalsTo", 6)! };
  const base = settings.baseGoalieId === null ? manualBase(settings) : goalieBase(settings.baseGoalieId, appearances.filter(row => row.goalieId === settings.baseGoalieId), date(30));
  return edition("ratio-impact", settings, buildRatioImpact(settings, base, null));
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
const matchupWeeks = (page: Page) => page.route("**/api/v1/social-share/matchup-weeks", route => route.fulfill({ json: { rows: [{ week: 1, start_date: date(2), end_date: date(3) }, { week: 2, start_date: date(4), end_date: date(10) }], cutoff: date(4) } }));
/** Nothing in the fitted card runs past it. */
const overflowing = (card: ReturnType<Page["getByTestId"]>) => card.evaluate(element => { const edge = element.getBoundingClientRect(); return [...element.querySelectorAll("*")].filter(node => { const box = node.getBoundingClientRect(); return box.right > edge.right + 0.5 || box.bottom > edge.bottom + 0.5; }).length; });
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
  await expect(card.locator("[data-stat='hd']").first()).toContainText("HD/GS");
  await expect(card.locator("[data-stat='sca']").first()).toContainText("TEAM SCA");
  await expect(card.locator("[data-stat='hdca']").first()).toContainText("HDCA");
  // Every stat tile holds its text, and no tile runs past its own row.
  const clipped = await card.locator("[data-stat]").evaluateAll(tiles => tiles.filter(tile => tile.scrollWidth > tile.clientWidth || tile.getBoundingClientRect().right > tile.parentElement!.parentElement!.getBoundingClientRect().right + 0.5).map(tile => tile.textContent));
  expect(clipped).toEqual([]);
  await expect(card.locator("svg[data-sparkline]").first()).toBeVisible();
  await expect(card).not.toContainText(/SV%|GAA/);
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  await expect(page.getByTestId("post-evidence")).toContainText("All situations");
  await expect(page.getByTestId("post-evidence")).toContainText("Basis: Per start");
  expect(requests[0]).toContain("basis=start");
  await expect(page.getByText("Works for a Thursday or Friday post.")).toBeVisible();
  await page.getByLabel("Basis").selectOption("per60");
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
  // Names show whole, the table stays inside the card, and each group head spans exactly its columns.
  const layout = await card.evaluate(element => {
    const box = (node: Element) => node.getBoundingClientRect(), heads = [...element.querySelectorAll("[data-head]")];
    const groups = [...new Set(heads.map(head => head.getAttribute("data-group")))].map(group => heads.filter(head => head.getAttribute("data-group") === group));
    return {
      cutNames: [...element.querySelectorAll<HTMLElement>("[data-goalie-name]")].filter(name => name.scrollWidth > name.clientWidth).map(name => name.textContent),
      overflow: Math.max(...[...element.querySelectorAll("[data-column='left']")].map(cell => box(cell).right)) - box(element).right,
      misaligned: [...element.querySelectorAll("[data-group-head]")].filter((head, index) => Math.abs(box(head).left - box(groups[index][0]).left) > 0.5 || Math.abs(box(head).right - box(groups[index][groups[index].length - 1]).right) > 0.5).map(head => head.textContent),
    };
  });
  expect(layout.cutNames).toEqual([]);
  expect(layout.overflow).toBeLessThanOrEqual(0.5);
  expect(layout.misaligned).toEqual([]);
  await expect(card).not.toContainText("Fictional Goalie 2");
  await expect(page.getByTestId("post-evidence")).toContainText("1 unknown ownership excluded");
  await expect(page.getByText("Works for a Thursday or Friday post.")).toBeVisible();
  await page.getByLabel("Include unknown ownership").selectOption("on");
  await expect(card).toContainText("Fictional Goalie 2");
  expect(requests.at(-1)).toContain("includeUnknown=on");
  await page.getByRole("combobox", { name: /^Category/ }).selectOption("gaa");
  expect(new URL(page.url()).searchParams.get("category")).toBe("gaa");
  await downloadsPng(page, "goalie-rescue");
});

test("Busy and Quiet takes a matchup week, and an old window link still works", async ({ page }) => {
  await signIn(page);
  await matchupWeeks(page);
  const requests = await serve(page, busyQuiet);
  await page.goto("/social-share/posts?post=busy-quiet-goalies&window=std&minStarts=1");
  const card = page.getByTestId("busy-quiet-card");
  await expect(card).toContainText("Season to date, Oct 1 to Oct 4");
  expect(requests[0]).toContain("window=std");
  await expect(page.getByTestId("period-control").getByLabel("Period")).toHaveValue("rolling");
  await expect(page.getByRole("combobox", { name: /^Window/ })).toHaveValue("std");
  await page.goto("/social-share/posts?post=busy-quiet-goalies&period=matchup&week=1");
  await expect(card).toContainText("Week 1 · Oct 2 to Oct 3");
  await expect(page.getByTestId("period-pager-label")).toContainText("Week 1");
  await expect(page.getByRole("combobox", { name: /^Window/ })).toHaveCount(0);
  expect(await overflowing(card)).toBe(0);
  await page.goto("/social-share/posts?post=busy-quiet-goalies&period=matchup&week=10");
  await expect(page.getByText("Min starts counts these dates only")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("Goalie Rescue hides GMS LEFT for a past week and labels ownership as current", async ({ page }) => {
  await signIn(page);
  await matchupWeeks(page);
  await serve(page, rescue);
  await page.goto("/social-share/posts?post=goalie-rescue&period=matchup&week=1");
  const card = page.getByTestId("goalie-rescue-card");
  await expect(card).toContainText("Rostered % and status are current and Yahoo-wide, not as of these dates.");
  await expect(card).toContainText("Week 1 · Oct 2 to Oct 3. Min 2 starts.");
  await expect(page.getByRole("spinbutton", { name: /^Min starts in week/ })).toHaveValue("2");
  await expect(page.getByRole("spinbutton", { name: /^Min starts in window/ })).toHaveCount(0);
  await expect(card).not.toContainText("GMS LEFT");
  await expect(card.locator("[data-column='left']")).toHaveCount(0);
  expect(await overflowing(card)).toBe(0);
  await expect(page.getByTestId("post-evidence")).toContainText("GMS LEFT is hidden");
  await downloadsPng(page, "goalie-rescue-past");
  await page.goto("/social-share/posts?post=goalie-rescue&period=matchup&week=2");
  await expect(card).toContainText("GMS LEFT count the current week, through Nov 1.");
  await expect(card.locator("[data-column='left']").first()).toBeVisible();
  expect(await overflowing(card)).toBe(0);
});

test("the fullest cards fit with the period's longer legend", async ({ page }) => {
  await signIn(page);
  await matchupWeeks(page);
  await serve(page, busyQuiet);
  await page.goto("/social-share/posts?post=busy-quiet-goalies&period=matchup&week=2&minStartsWeek=1");
  const quiet = page.getByTestId("busy-quiet-card");
  await expect(quiet).toContainText("Week 2 · Oct 1 to Oct 7, games through Oct 4");
  await expect(page.getByTestId("board-busy").locator("svg[data-sparkline]")).toHaveCount(12);
  expect(await overflowing(quiet)).toBe(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signIn(page);
  await matchupWeeks(page);
  await serve(page, rescue);
  for (const [week, rows] of [[1, 27], [2, 27]]) {
    await page.goto(`/social-share/posts?post=goalie-rescue&period=matchup&week=${week}&minStartsWeek=1`);
    const card = page.getByTestId("goalie-rescue-card");
    await expect(card.locator("[data-goalie-name]")).toHaveCount(rows);
    expect(await overflowing(card)).toBe(0);
  }
  // Week 4's real size: eleven goalies fill the card, with no blank area under them.
  await page.goto("/social-share/posts?post=goalie-rescue&period=matchup&week=1&minStartsWeek=1&ownershipCeiling=5");
  const short = page.getByTestId("goalie-rescue-card");
  await expect(short.locator("[data-goalie-name]")).toHaveCount(11);
  const blank = await short.evaluate(element => { const table = element.querySelector("[data-past]")!, cells = [...table.children]; return Math.abs(table.getBoundingClientRect().bottom - Math.max(...cells.map(cell => cell.getBoundingClientRect().bottom))); });
  expect(blank).toBeLessThanOrEqual(1);
  expect(await overflowing(short)).toBe(0);
});

test("Ratio Impact is hypothetical, works with no base and pools with one", async ({ page }) => {
  await signIn(page);
  await serve(page, ratio);
  await page.goto("/social-share/posts?post=ratio-impact");
  const card = page.getByTestId("ratio-impact-card");
  await expect(page.getByTestId("post-watermark")).toHaveText("HYPOTHETICAL SCENARIO");
  await expect(page.getByText("Choose a base goalie by goalie id")).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
  await page.goto("/social-share/posts?post=ratio-impact&baseGoalieId=1");
  await expect(page.getByTestId("share-square").getByRole("heading", { level: 2 })).toHaveText(/^WHAT ONE START DOES TO /);
  await expect(card.getByTestId("ratio-sentence")).toContainText("If 1 allows 3 goals on 30 shots, SV% goes");
  await expect(card).toContainText("Hypothetical");
  await expect(card.locator('svg[data-chart="whatIf"] circle[data-series="savePct"]')).toHaveCount(7);
  await expect(card.getByTestId("ratio-change")).toHaveCount(2);
  await expect(card).not.toContainText(/forecast|transaction|sensitivity/i);
  // Nothing in the fitted card runs past it.
  const overflow = await card.evaluate(element => { const edge = element.getBoundingClientRect(); return [...element.querySelectorAll("*")].filter(node => { const box = node.getBoundingClientRect(); return box.right > edge.right + 0.5 || box.bottom > edge.bottom + 0.5; }).length; });
  expect(overflow).toBe(0);
  await page.goto("/social-share/posts?post=ratio-impact&baseShots=1000&baseGoals=80&baseMinutes=2000");
  await expect(card).toContainText("Before: Entered base");
  await expect(card).toContainText("2060:00");
  await expect(card.getByTestId("ratio-change")).toHaveCount(2);
  await expect(card).toContainText(".920");
  await downloadsPng(page, "ratio-impact");
});
