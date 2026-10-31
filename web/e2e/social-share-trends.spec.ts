import { expect, test, type Page } from "@playwright/test";
import { buildRoleWatch } from "../lib/socialShare/modules/roleWatch";
import type { SkaterAppearance } from "../lib/socialShare/modules/shared/skaterAppearances";
import { buildWhatChanged } from "../lib/socialShare/modules/whatChanged";

/**
 * Fictional editor session and fictional skaters, as in social-share.spec.ts: run the dev server and this spec with
 * NEXT_PUBLIC_SUPABASE_URL set to a reserved .invalid host. Every post response is built by the module's own builder.
 */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const editorToken = "e2e-fictional-editor-token";
async function signInEditor(page: Page) {
  expect(supabaseOrigin.hostname.endsWith(".invalid")).toBe(true);
  const user = { id: "00000000-0000-4000-8000-00000000e2e1", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 86400;
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${supabaseOrigin.hostname.split(".")[0]}-auth-token`, JSON.stringify({ access_token: editorToken, refresh_token: "e2e-fictional-refresh", token_type: "bearer", expires_in: 365 * 86400, expires_at: expiresAt, user })]);
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

const dateOf = (index: number) => new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10);
const skater = (playerId: number, name: string, team: string, points: (index: number) => number, toi: (index: number) => number, pp: (index: number) => number): SkaterAppearance[] =>
  Array.from({ length: 12 }, (_, index) => ({ playerId, name, position: "C", group: "F" as const, gameId: 1000 + index, date: dateOf(index), team, opponent: "NYR", home: true, goals: 0, assists: 0, points: points(index), shots: 2, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: toi(index), ppToiSeconds: pp(index), penaltyMinutes: 0 }));
const appearances = [
  ...skater(1, "Fictional Riser", "NJD", index => index >= 7 ? 2 : 0, index => index >= 7 ? 1300 : 1100, index => index >= 7 ? 200 : 100),
  ...skater(2, "Fictional Faller", "NYI", index => index >= 7 ? 0 : 1, index => index >= 7 ? 900 : 1100, () => 0),
];
const completion = { completedTeamGames: appearances.map(game => ({ gameId: game.gameId })), scheduledGameIds: [...new Set(appearances.map(game => game.gameId))], through: "2026-10-30" };
const edition = (post: string, settings: Record<string, string | number>, result: ReturnType<typeof buildWhatChanged> | ReturnType<typeof buildRoleWatch>, fixture: boolean) => {
  const generatedAt = new Date().toISOString();
  return { schemaVersion: 1, id: `${post}-e2e`, post, state: "ready", reasons: [], generatedAt, expiresAt: new Date(Date.parse(generatedAt) + 600000).toISOString(), timeZone: "America/New_York", settings, evidence: result.evidence, data: result.data, teams: result.teams ?? [], fixture };
};
const whatChangedSettings = { window: "l5", comparison: "std", minGp: 10, minCoverage: 90, metric: "points", basis: "perGame", player: "" } as const;
const roleSettings = { window: "l5", minToiChange: 60, minPpChange: 30 } as const;
// Each fictional game has both teams here, so the schedule's expected count is met.
const whatChanged = () => buildWhatChanged({ appearances, nstCounts: null, nstOnIce: null, ...completion, settings: whatChangedSettings });
const roleWatch = () => buildRoleWatch({ appearances, evidence: { rolling: [{ player_id: 1, game_id: 1011, line_combo_slot: 1, line_combo_group: "forward" }], pp: [{ gameId: 1011, playerId: 1, unit: 1 }] }, ...completion, settings: roleSettings });

async function open(page: Page, post: string, body: object) {
  await page.context().route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await signInEditor(page);
  await page.route("**/api/v1/social-share/posts/**", route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${editorToken}`);
    return route.fulfill({ json: body });
  });
  await page.goto(`/social-share/posts?post=${post}`);
  await expect(page.getByTestId("share-square")).toBeVisible();
}
test.beforeEach(({ page }) => page.setDefaultTimeout(10000));

test("What Changed prints its values, samples and overlap, and carries them into the export's labels", async ({ page }) => {
  await open(page, "what-changed", edition("what-changed", whatChangedSettings, whatChanged(), false));
  const square = page.getByTestId("share-square");
  for (const text of ["Points per game", "L5 versus season to date", "Fictional Riser", "Fictional Faller", "OV = recent games inside STD"]) await expect(square).toContainText(text);
  const evidence = page.getByTestId("post-evidence");
  for (const text of ["Season values contain the recent games", "All situations", "2 skaters with 10+ season GP", "Min NST coverage %: 90", "Recent window: L5"]) await expect(evidence).toContainText(text);
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});

test("What Changed with offline fixture data and no ranked player refuses export", async ({ page }) => {
  const empty = buildWhatChanged({ appearances: appearances.filter(game => game.date <= dateOf(3)), nstCounts: null, nstOnIce: null, completedTeamGames: [], scheduledGameIds: [], through: "2026-10-30", settings: whatChangedSettings });
  await open(page, "what-changed", edition("what-changed", whatChangedSettings, empty, true));
  await expect(page.getByTestId("share-square")).toContainText("No player qualifies");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("Role Watch prints seconds as m:ss, samples, role context and the observed-opportunity copy", async ({ page }) => {
  await open(page, "role-watch", edition("role-watch", roleSettings, roleWatch(), false));
  const square = page.getByTestId("share-square");
  for (const text of ["Observed opportunity, not a forecast.", "Fictional Riser", "L1 · PP1", "Line unknown · Off PP", "1:00+ CHANGE", "0:30+ CHANGE", "5/7"]) await expect(square).toContainText(text);
  await expect(page.getByTestId("post-evidence")).toContainText("No game is in both");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});
