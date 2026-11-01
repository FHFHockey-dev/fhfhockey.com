import { expect, test, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { riskyStartsNoUpcoming, riskyStartsResult } from "../lib/socialShare/modules/riskyStarts";
import { buildGoalieInventory } from "../lib/socialShare/modules/shared/goalieInventory.sources";
import { FIXTURE_INPUT, GOALIE_INVENTORY_FIXTURE_DETAIL } from "../lib/socialShare/modules/shared/goalieInventory.fixture";
import { startSitNoUpcoming, startSitResult } from "../lib/socialShare/modules/startSit";
import type { SharePostLoadResult } from "../lib/socialShare/modules/contract";

/** SS 11.0 posts on the handoff fixture, against the real studio. A fictional session and answered routes: no real project is read. */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const editorToken = "e2e-fictional-editor-token";
const evidence = "test-results/social-share-inventory";
const PERIOD_DEFAULTS = { days: 7, period: "days", week: null, start: null, end: null };
const LONG_WEEK = { label: "Week 6 · Nov 9 to Nov 22", from: "2026-11-09", through: "2026-11-22", listedFrom: "2026-11-09", elapsed: false, usedCalendar: true, season: 20262027 };
const PAST_WEEK = { label: "Week 3 · Oct 19 to Oct 25", from: "2026-10-19", through: "2026-10-25", listedFrom: "2026-11-02", elapsed: true, usedCalendar: true, season: 20262027 };

async function signIn(page: Page) {
  expect(supabaseOrigin.hostname.endsWith(".invalid")).toBe(true);
  const user = { id: "00000000-0000-4000-8000-00000000e2e1", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 86400;
  const session = { access_token: editorToken, refresh_token: "e2e-fictional-refresh", token_type: "bearer", expires_in: 365 * 86400, expires_at: expiresAt, user };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${supabaseOrigin.hostname.split(".")[0]}-auth-token`, JSON.stringify(session)]);
  await page.route(`${supabaseOrigin.origin}/**`, route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET") return route.abort();
    const one = (row: object | null) => route.fulfill({ json: /vnd\.pgrst\.object/.test(request.headers().accept ?? "") ? row : row ? [row] : [] });
    if (url.pathname === "/rest/v1/users") return one({ role: "social_editor" });
    if (url.pathname === "/rest/v1/user_profiles") return one({ user_id: user.id, display_name: "Fictional editor", avatar_url: null, timezone: "America/New_York" });
    if (url.pathname === "/rest/v1/user_settings") return one({ user_id: user.id });
    if (url.pathname === "/auth/v1/user") return route.fulfill({ json: user });
    return route.abort();
  });
  await page.context().route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
}
function edition(post: string, settings: Record<string, unknown>, result: SharePostLoadResult<unknown>) {
  const generatedAt = new Date().toISOString();
  return { schemaVersion: 1, id: `${post}-e2e`, post, state: result.state, reasons: result.reasons ?? [], generatedAt, expiresAt: new Date(Date.parse(generatedAt) + 600000).toISOString(), timeZone: "America/New_York", settings, fixture: false, teams: result.teams ?? [], evidence: result.evidence, data: result.data };
}
async function serve(page: Page, post: string, body: object) {
  const state = { requests: 0 };
  await page.route(`**/api/v1/social-share/posts/${post}**`, route => { state.requests++; return route.fulfill({ json: body }); });
  return state;
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
}

test("Risky Starts: a lens switch needs no refetch, changes the token and stays one lens, and the PNG exports", async ({ page }) => {
  await signIn(page);
  const served = await serve(page, "risky-starts", edition("risky-starts", { ...PERIOD_DEFAULTS, lens: "ratio" }, riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL)));
  await page.goto("/social-share/posts?post=risky-starts");
  const square = page.getByTestId("share-square");
  await expect(square).toBeVisible();
  await expect(page.getByTestId("risky-legend")).toContainText("No win or start odds");
  await expect(page.getByTestId("post-evidence")).toContainText("correlated");
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  const before = served.requests, ratioToken = await square.getAttribute("data-export-token");
  await page.getByRole("combobox", { name: /^Lens/ }).selectOption("volume");
  await expect(page.getByTestId("risky-row").first()).toBeVisible();
  await expect(square).not.toHaveAttribute("data-export-token", ratioToken!);
  await expect(page.locator('[data-testid="risky-row"][data-team="NYR"][data-game="900010"]')).toContainText("SA/GP");
  await expect(page.getByTestId("post-evidence")).toContainText("Lens: Volume upside");
  await downloadedPng(page, "risky-starts-volume");
  expect(served.requests).toBe(before);
});

test("Start/Sit: accent-free search narrows in the browser, status and forecast stay apart, and the PNG exports", async ({ page }) => {
  await signIn(page);
  const served = await serve(page, "start-sit", edition("start-sit", { ...PERIOD_DEFAULTS, search: "" }, startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL)));
  await page.goto("/social-share/posts?post=start-sit");
  const square = page.getByTestId("share-square");
  await expect(square).toBeVisible();
  const before = served.requests, allToken = await square.getAttribute("data-export-token");
  await page.getByLabel("Search goalie or team").fill("eric");
  await expect(page.getByTestId("start-sit-row")).toHaveCount(2);
  await expect(page.getByTestId("start-sit-row").first()).toContainText("Éric Testeur");
  await expect(square).toContainText("xGA / OPP xGF");
  await expect(square).toContainText("SA / OPP SF");
  await expect(square).toContainText("GF / OPP GA");
  await expect(square).not.toHaveAttribute("data-export-token", allToken!);
  await expect(page.getByTestId("start-sit-confirmation").first()).toHaveAttribute("data-state", "confirmed");
  await expect(page.getByTestId("start-sit-forecast")).toHaveCount(0);
  await downloadedPng(page, "start-sit-eric");
  await page.getByLabel("Search goalie or team").fill("toronto");
  await expect(page.locator('[data-testid="start-sit-confirmation"][data-state="conflicting"]').first()).toHaveText("Conflicting");
  await page.getByLabel("Search goalie or team").fill("nobody");
  await expect(page.getByText('No goalie or team matches "nobody"')).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
  expect(served.requests).toBe(before);
});

test("Start/Sit: with confirmation unreadable every goalie is unknown and the reason is on the card", async ({ page }) => {
  await signIn(page);
  await serve(page, "start-sit", edition("start-sit", { ...PERIOD_DEFAULTS, search: "" }, startSitResult(buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: null, forecasts: null }))));
  await page.goto("/social-share/posts?post=start-sit");
  await expect(page.getByTestId("start-sit-legend")).toContainText("Unknown = reports unreadable.");
  await expect(page.getByTestId("post-evidence")).toContainText("does not mean not starting");
  await expect(page.getByTestId("post-evidence")).toContainText("raw start_probability is not admitted");
  await expect(page.locator('[data-testid="start-sit-confirmation"]:not([data-state="none"])')).toHaveCount(0);
  await expect(page.getByTestId("start-sit-forecast")).toHaveCount(0);
});

test("A partial inventory previews under its warning and cannot export", async ({ page }) => {
  await signIn(page);
  await serve(page, "risky-starts", edition("risky-starts", { ...PERIOD_DEFAULTS, lens: "ratio" }, riskyStartsResult(buildGoalieInventory({ ...FIXTURE_INPUT, nst: FIXTURE_INPUT.nst.filter(row => row.date !== "2026-11-01") }))));
  await page.goto("/social-share/posts?post=risky-starts");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

/** Nothing in the post body runs past it, and nothing in the square past the square. */
async function expectFit(page: Page) {
  const square = page.getByTestId("share-square");
  await expect(square).toBeVisible();
  const overflow = await square.evaluate(root => {
    const body = root.querySelector('[class*="postBody"]')!, past = (node: Element, box: Element) => node.getBoundingClientRect().bottom > box.getBoundingClientRect().bottom + 1 || node.getBoundingClientRect().right > box.getBoundingClientRect().right + 1;
    return [...[...body.querySelectorAll("*")].filter(node => past(node, body)), ...[...root.querySelectorAll("*")].filter(node => past(node, root))].map(node => node.getAttribute("data-testid") ?? node.className ?? node.tagName);
  });
  expect(overflow).toEqual([]);
}
function longWeekDetail() {
  const { schedule } = FIXTURE_INPUT, more = Array.from({ length: 30 }, (_, index) => ({ ...schedule[index % schedule.length], id: 910000 + index, date: `2026-11-${String(9 + (index % 14)).padStart(2, "0")}`, startTime: `2026-11-${String(9 + (index % 14)).padStart(2, "0")}T23:00:00.000Z` }));
  return buildGoalieInventory({ ...FIXTURE_INPUT, schedule: [...schedule, ...more], request: { ...FIXTURE_INPUT.request, from: "2026-11-02", through: "2026-11-22" } });
}
async function answerCalendar(page: Page) {
  await page.route("**/api/v1/social-share/matchup-weeks", route => route.fulfill({ json: { cutoff: "2026-11-01", rows: [{ week: 3, start_date: "2026-10-19", end_date: "2026-10-25" }, { week: 5, start_date: "2026-11-02", end_date: "2026-11-08" }, { week: 6, start_date: "2026-11-09", end_date: "2026-11-22" }] } }));
}

for (const [post, settings, testid, card] of [
  ["start-sit", { search: "" }, "start-sit-period", "start-sit"],
  ["risky-starts", { lens: "volume" }, "risky-period", "risky"],
] as const) {
  test(`${post}: a 14-day matchup prints its dates and fits with no clipping`, async ({ page }) => {
    await signIn(page);
    await answerCalendar(page);
    const detail = longWeekDetail(), result = post === "start-sit" ? startSitResult(detail, LONG_WEEK) : riskyStartsResult(detail, undefined, LONG_WEEK);
    await serve(page, post, edition(post, { ...PERIOD_DEFAULTS, period: "matchup", week: 6, ...settings }, result));
    await page.goto(`/social-share/posts?post=${post}&period=matchup&week=6${post === "risky-starts" ? "&lens=volume" : ""}`);
    await expect(page.getByTestId(testid)).toContainText("Week 6 · Nov 9 to Nov 22");
    await expect(page.getByTestId("period-pager-label")).toContainText("Week 6");
    await expect(page.getByRole("button", { name: "Prior week, week 5" })).toBeEnabled();
    await expectFit(page);
    await mkdir(evidence, { recursive: true });
    await page.getByTestId("share-square").screenshot({ path: `${evidence}/${card}-14-day.png` });
  });
  test(`${post}: a past matchup says no upcoming games and cannot export`, async ({ page }) => {
    await signIn(page);
    await answerCalendar(page);
    const result = post === "start-sit" ? startSitNoUpcoming(PAST_WEEK, new Date().toISOString()) : riskyStartsNoUpcoming(PAST_WEEK);
    await serve(page, post, edition(post, { ...PERIOD_DEFAULTS, period: "matchup", week: 3, ...post === "start-sit" ? { search: "" } : { lens: "ratio" } }, result));
    await page.goto(`/social-share/posts?post=${post}&period=matchup&week=3`);
    await expect(page.getByTestId("share-square")).toContainText("No upcoming games in this period: Week 3 · Oct 19 to Oct 25");
    await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
  });
}
