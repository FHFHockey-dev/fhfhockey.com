import { expect, test, type Page } from "@playwright/test";
import { buildBshBoard, type BshBoardSettings, type SkaterSeason } from "../lib/socialShare/modules/bshBoard";
import { buildCategoryBlueprint, categoryBlueprintModule, type CategoryBlueprintSettings } from "../lib/socialShare/modules/categoryBlueprint";
import { parseShareSettings, type SharePostLoadResult } from "../lib/socialShare/modules/contract";
import { buildNightlyFloor, type NightlyFloorSettings } from "../lib/socialShare/modules/nightlyFloor";
import { ownershipOf } from "../lib/socialShare/modules/shared/definitions";
import type { SkaterAppearance } from "../lib/socialShare/modules/shared/skaterAppearances";

/**
 * Lane B: BSH Board, Category Blueprint, Nightly Floor. Fictional skaters through the real builders, with the same
 * fictional editor session as social-share.spec.ts. Run with NEXT_PUBLIC_SUPABASE_URL on a reserved .invalid host.
 */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const editorToken = "e2e-fictional-editor-token";
async function signIn(page: Page) {
  expect(supabaseOrigin.hostname.endsWith(".invalid")).toBe(true);
  const user = { id: "00000000-0000-4000-8000-00000000e2e2", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
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
const game = (playerId: number, name: string, team: string, index: number, stats: Partial<SkaterAppearance>): SkaterAppearance => ({
  playerId, name, position: "C", group: "F", gameId: 1000 + index, date: `2026-10-${String(index + 1).padStart(2, "0")}`, team, opponent: null, home: null,
  goals: 0, assists: 0, points: 0, shots: 1, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 900, ppToiSeconds: 0, penaltyMinutes: 0, ...stats,
});
const fictional: SkaterSeason = (() => {
  const appearances = Array.from({ length: 20 }, (_, index) => [
    game(1, "Fictional Riser", "NJD", index, { shots: index >= 10 ? 4 : 1, hits: 3, blocks: 2, points: index % 2 }),
    game(2, "Fictional Faller", "NYR", index, { shots: index >= 10 ? 1 : 4, hits: 2, blocks: 1, points: 0 }),
  ]).flat();
  const teamGames = appearances.map(row => ({ gameId: row.gameId, date: row.date, team: row.team! }));
  return { appearances, teamGames, scheduledGames: 20, through: "2026-10-30" };
})();
/** A full board: more ranked skaters than the card holds, so every post is measured at its row limit. */
const crowded: SkaterSeason = (() => {
  const appearances = Array.from({ length: 24 }, (_, player) => Array.from({ length: 12 }, (_, index) => game(player + 1, `Fictional Longname Skater ${player + 1}`, player % 2 ? "NYR" : "NJD", index, { shots: 1 + (player % 6) + (index % 3), hits: 1 + (player % 5), blocks: 1 + (player % 4), points: (player + index) % 2 }))).flat();
  const teamGames = [...new Map(appearances.map(row => [`${row.team}:${row.gameId}`, { gameId: row.gameId, date: row.date, team: row.team! }])).values()];
  return { appearances, teamGames, scheduledGames: teamGames.length / 2, through: "2026-10-30" };
})();
const bshSettings = (over: Partial<BshBoardSettings> = {}): BshBoardSettings => ({ view: "leaders", window: "l10", comparison: "previous", minGp: 5, position: "all", ...over });
// The visible defaults, so the edition and the URL agree whatever the default is.
const blueprintSettings = parseShareSettings(categoryBlueprintModule, {}) as CategoryBlueprintSettings;
const floorSettings = (over: Partial<NightlyFloorSettings> = {}): NightlyFloorSettings => ({ view: "sog", xSog: 2, xHits: 2, xBlk: 1, zeroCategory: "shots", window: "l10", minGp: 5, position: "all", ownMin: 0, ownMax: 100, unknownOwnership: "exclude", minCoverage: 90, ...over });
const ownership = { byPlayer: new Map([[1, ownershipOf(40, "2026-10-31")], [2, ownershipOf(12, "2026-10-31")]]), updatedAt: "2026-10-31T08:00:00" };
const edition = (post: string, settings: object, result: SharePostLoadResult<unknown>) => {
  const generatedAt = new Date().toISOString();
  return { schemaVersion: 1, id: `${post}-e2e`, post, generatedAt, expiresAt: new Date(Date.parse(generatedAt) + 600000).toISOString(), timeZone: "America/New_York", settings, fixture: false, state: result.state, reasons: result.reasons ?? [], evidence: result.evidence, data: result.data, teams: result.teams ?? [] };
};
async function open(page: Page, post: string, body: (query: URLSearchParams) => object) {
  await signIn(page);
  const requests: string[] = [];
  await page.route("**/api/v1/social-share/posts/**", route => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    expect(route.request().headers().authorization).toBe(`Bearer ${editorToken}`);
    return route.fulfill({ json: body(url.searchParams) });
  });
  await page.goto(`/social-share/posts?post=${post}`);
  await expect(page.getByTestId("share-square")).toBeVisible();
  return requests;
}
/** Nothing clipped and no dead band over 40px: the table's last row must end near the bottom of the post body. */
const expectFits = (page: Page) => expect.poll(() => page.getByTestId("share-square").evaluate(square => {
  const body = square.querySelector("[class*=postBody]"), board = body?.firstElementChild, table = board?.lastElementChild?.firstElementChild;
  if (!body || !board || !table) return "no table";
  if (table.scrollHeight > table.clientHeight + 1 || body.scrollHeight > body.clientHeight + 1 || square.scrollHeight > square.clientHeight + 1) return "clipped";
  const clippedCell = [...table.children].some(cell => cell.scrollWidth > cell.clientWidth + 1) || [...table.querySelectorAll("[class*=name]")].some(name => name.scrollWidth > name.clientWidth);
  const band = body.getBoundingClientRect().bottom - table.lastElementChild!.getBoundingClientRect().bottom;
  return clippedCell ? "clipped cell" : band > 40 ? `dead band ${band}` : "fits";
})).toBe("fits");

test.beforeEach(({ page }) => page.setDefaultTimeout(10000));

test("BSH Board leaders print components, per-game values and cohort, then export", async ({ page }) => {
  await open(page, "bsh-board", () => edition("bsh-board", bshSettings(), buildBshBoard(fictional, bshSettings())));
  const square = page.getByTestId("share-square");
  for (const text of ["BLK /G", "SOG /G", "HITS /G", "BSH /G", "Fictional Riser", "L10"]) await expect(square).toContainText(text);
  await expect(page.getByTestId("post-evidence")).toContainText("All situations");
  await expect(page.getByTestId("post-evidence")).toContainText("last 10 appearances");
  await expect(page.getByTestId("post-evidence")).toContainText("40 of 40 team games");
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  await expectFits(page);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
});

test("BSH Board risers state their comparison, and stale settings cannot export", async ({ page }) => {
  await open(page, "bsh-board", query => {
    const active = bshSettings({ view: (query.get("view") ?? "leaders") as BshBoardSettings["view"] });
    return edition("bsh-board", active, buildBshBoard(fictional, active));
  });
  await page.locator("label", { hasText: /^View/ }).locator("select").selectOption("risers");
  // The view changed but the edition did not: the old data must not ship under the new label.
  await expect(page.getByTestId("share-square")).toContainText("Refresh this post");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh post", exact: true }).click();
  await expect(page.getByTestId("share-square")).toContainText("L10, then previous 10 in grey");
  await expect(page.getByTestId("post-evidence")).toContainText("the previous 10 appearances");
  await expect(page.getByTestId("share-square")).toContainText("Fictional Riser");
  await expect(page.getByTestId("share-square")).not.toContainText("Fictional Faller");
  await expectFits(page);
});

test("Category Blueprint keeps categories separate with their own ranks", async ({ page }) => {
  await open(page, "category-blueprint", () => edition("category-blueprint", blueprintSettings, buildCategoryBlueprint(fictional, blueprintSettings)));
  const square = page.getByTestId("share-square");
  for (const text of ["PTS/G", "SOG/G", "HITS/G", "BLK/G", "#1", "no combined score", "among 2"]) await expect(square).toContainText(text);
  await expectFits(page);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
});

test("Nightly Floor prints numerator, denominator, missing and its strict test", async ({ page }) => {
  await open(page, "nightly-floor", () => edition("nightly-floor", floorSettings(), buildNightlyFloor(fictional, floorSettings(), ownership)));
  const square = page.getByTestId("share-square");
  for (const text of ["More than 2 SOG.", "Exactly 2 fails.", "MET / KNOWN", "10 / 10", "MISSING", "40%"]) await expect(square).toContainText(text);
  await expect(page.getByTestId("post-evidence")).toContainText("A DNP is not an appearance");
  await expect(page.getByTestId("post-evidence")).toContainText("Yahoo rostered %");
  await expectFits(page);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
});

const crowdedOwnership = { byPlayer: new Map(Array.from({ length: 24 }, (_, index) => [index + 1, ownershipOf(10 + index, "2026-10-31")])), updatedAt: "2026-10-31T08:00:00" };
const crowdedEditions: Record<string, () => object> = {
  "bsh-board": () => edition("bsh-board", bshSettings(), buildBshBoard(crowded, bshSettings())),
  "category-blueprint": () => edition("category-blueprint", blueprintSettings, buildCategoryBlueprint(crowded, blueprintSettings)),
  "nightly-floor": () => edition("nightly-floor", floorSettings(), buildNightlyFloor(crowded, floorSettings(), crowdedOwnership)),
};
for (const [post, build] of Object.entries(crowdedEditions)) test(`${post} fills the body with no clipping at its row limit`, async ({ page }) => {
  await open(page, post, build);
  await expect(page.getByTestId("share-square").getByText("Fictional Longname Skater", { exact: false })).toHaveCount(20);
  await expectFits(page);
});

test("A board nobody clears says so and cannot export", async ({ page }) => {
  const nobody = floorSettings({ xSog: 10 });
  await open(page, "nightly-floor", () => edition("nightly-floor", nobody, buildNightlyFloor(fictional, nobody, ownership)));
  await page.locator("label", { hasText: /^SOG X/ }).locator("input").fill("10");
  await page.getByRole("button", { name: "Refresh post", exact: true }).click();
  await expect(page.getByTestId("share-square")).toContainText("No skater meets this test");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("A failed or partial edition stays unexportable", async ({ page }) => {
  const incomplete = { ...fictional, scheduledGames: 21 };
  await open(page, "bsh-board", () => edition("bsh-board", bshSettings(), buildBshBoard(incomplete, bshSettings())));
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByTestId("post-evidence")).toContainText("2 missing");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});
