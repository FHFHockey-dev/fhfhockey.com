import { expect, test, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { riskyStartsResult } from "../lib/socialShare/modules/riskyStarts";
import { buildGoalieInventory } from "../lib/socialShare/modules/shared/goalieInventory.sources";
import { FIXTURE_INPUT, GOALIE_INVENTORY_FIXTURE_DETAIL } from "../lib/socialShare/modules/shared/goalieInventory.fixture";
import { startSitResult } from "../lib/socialShare/modules/startSit";
import type { SharePostLoadResult } from "../lib/socialShare/modules/contract";

/** SS 11.0 posts on the handoff fixture, against the real studio. A fictional session and answered routes: no real project is read. */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const editorToken = "e2e-fictional-editor-token";
const evidence = "test-results/social-share-inventory";

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
  const served = await serve(page, "risky-starts", edition("risky-starts", { days: 7, lens: "ratio" }, riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL)));
  await page.goto("/social-share/posts?post=risky-starts");
  const square = page.getByTestId("share-square");
  await expect(square).toBeVisible();
  await expect(page.getByTestId("risky-correlation-note")).toContainText("correlated");
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  const before = served.requests, ratioToken = await square.getAttribute("data-export-token");
  await page.getByRole("combobox", { name: /^Lens/ }).selectOption("volume");
  await expect(page.getByTestId("risky-row").first()).toBeVisible();
  await expect(square).not.toHaveAttribute("data-export-token", ratioToken!);
  await expect(page.getByTestId("risky-row").filter({ hasText: "NYR vs NJD" })).toContainText("SA/GP");
  await expect(page.getByTestId("post-evidence")).toContainText("Lens: Volume upside");
  await downloadedPng(page, "risky-starts-volume");
  expect(served.requests).toBe(before);
});

test("Start/Sit: accent-free search narrows in the browser, status and forecast stay apart, and the PNG exports", async ({ page }) => {
  await signIn(page);
  const served = await serve(page, "start-sit", edition("start-sit", { days: 7, search: "" }, startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL)));
  await page.goto("/social-share/posts?post=start-sit");
  const square = page.getByTestId("share-square");
  await expect(square).toBeVisible();
  const before = served.requests, allToken = await square.getAttribute("data-export-token");
  await page.getByLabel("Search goalie or team").fill("eric");
  await expect(page.getByTestId("start-sit-row")).toHaveCount(2);
  await expect(page.getByTestId("start-sit-row").first()).toContainText("Éric Testeur");
  await expect(square).not.toHaveAttribute("data-export-token", allToken!);
  await expect(page.getByTestId("start-sit-confirmation").first()).toHaveAttribute("data-state", "confirmed");
  await expect(page.getByTestId("start-sit-forecast").first()).toHaveText("Forecast unavailable");
  await downloadedPng(page, "start-sit-eric");
  await page.getByLabel("Search goalie or team").fill("toronto");
  await expect(page.locator('[data-testid="start-sit-confirmation"][data-state="conflicting"]').first()).toHaveText("Conflicting reports");
  await page.getByLabel("Search goalie or team").fill("nobody");
  await expect(page.getByText('No goalie or team matches "nobody"')).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
  expect(served.requests).toBe(before);
});

test("Start/Sit: with confirmation unreadable every goalie is unknown and the reason is on the card", async ({ page }) => {
  await signIn(page);
  await serve(page, "start-sit", edition("start-sit", { days: 7, search: "" }, startSitResult(buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: null, forecasts: null }))));
  await page.goto("/social-share/posts?post=start-sit");
  await expect(page.getByTestId("start-sit-confirmation-note")).toContainText("does not mean not starting");
  await expect(page.getByTestId("start-sit-forecast-note")).toContainText("raw start_probability is not admitted");
  await expect(page.locator('[data-testid="start-sit-confirmation"]:not([data-state="none"])')).toHaveCount(0);
  await expect(page.getByTestId("start-sit-forecast").first()).toHaveText("Forecast unavailable");
});

test("A partial inventory previews under its warning and cannot export", async ({ page }) => {
  await signIn(page);
  await serve(page, "risky-starts", edition("risky-starts", { days: 7, lens: "ratio" }, riskyStartsResult(buildGoalieInventory({ ...FIXTURE_INPUT, nst: FIXTURE_INPUT.nst.filter(row => row.date !== "2026-11-01") }))));
  await page.goto("/social-share/posts?post=risky-starts");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});
