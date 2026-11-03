import { expect, test, type Page } from "@playwright/test";
import { bshBoardModule, buildBshBoard, trimLateNights, type BshBoardSettings, type SkaterSeason } from "../lib/socialShare/modules/bshBoard";
import { buildCategoryBlueprint, categoryBlueprintModule, type CategoryBlueprintSettings } from "../lib/socialShare/modules/categoryBlueprint";
import { parseShareSettings, UNKNOWN_EVIDENCE, type AnyShareModule, type SharePostLoadResult } from "../lib/socialShare/modules/contract";
import { buildNightlyFloor, nightlyFloorModule, type NightlyFloorSettings } from "../lib/socialShare/modules/nightlyFloor";
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
  const appearances = Array.from({ length: 24 }, (_, player) => Array.from({ length: 12 }, (_, index) => game(player + 1, `Fictional Long Name ${player + 1}`, player % 2 ? "NYR" : "NJD", index, { shots: 1 + (player % 6) + (index % 3), hits: 1 + (player % 5), blocks: 1 + (player % 4), points: (player + index) % 2 }))).flat();
  const teamGames = [...new Map(appearances.map(row => [`${row.team}:${row.gameId}`, { gameId: row.gameId, date: row.date, team: row.team! }])).values()];
  return { appearances, teamGames, scheduledGames: teamGames.length / 2, through: "2026-10-30" };
})();
const bshSettings = (over: Partial<BshBoardSettings> = {}): BshBoardSettings => ({ period: "rolling", week: null, start: null, end: null, minGpRange: null, view: "leaders", window: "l10", comparison: "previous", minGp: 5, position: "all", ...over });
// The visible defaults, so the edition and the URL agree whatever the default is.
const blueprintSettings = parseShareSettings(categoryBlueprintModule, {}) as CategoryBlueprintSettings;
const floorSettings = (over: Partial<NightlyFloorSettings> = {}): NightlyFloorSettings => ({ period: "rolling", week: null, start: null, end: null, minGpRange: null, view: "sog", xSog: 2, xHits: 2, xBlk: 1, zeroCategory: "shots", window: "l10", minGp: 5, position: "all", ownMin: 0, ownMax: 100, unknownOwnership: "exclude", minCoverage: 90, ...over });
const ownership = { byPlayer: new Map([[1, ownershipOf(40, "2026-10-31")], [2, ownershipOf(12, "2026-10-31")]]), updatedAt: "2026-10-31T08:00:00" };
const edition = (post: string, settings: object, result: SharePostLoadResult<unknown>) => {
  const generatedAt = new Date().toISOString();
  return { schemaVersion: 1, id: `${post}-e2e`, post, generatedAt, expiresAt: new Date(Date.parse(generatedAt) + 600000).toISOString(), timeZone: "America/New_York", settings, fixture: false, state: result.state, reasons: result.reasons ?? [], evidence: result.evidence, data: result.data, teams: result.teams ?? [], pageNotes: result.pageNotes ?? [] };
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

/** Risers and fallers: nothing clipped, each side's last row near the body's bottom when that side is full. */
const expectMoversFit = (page: Page) => expect.poll(() => page.getByTestId("share-square").evaluate(square => {
  const body = square.querySelector("[class*=postBody]"), sides = [...square.querySelectorAll("[data-testid^=board-]")];
  if (!body || sides.length !== 2) return "no boards";
  if (body.scrollHeight > body.clientHeight + 1 || square.scrollHeight > square.clientHeight + 1 || sides.some(side => side.scrollHeight > side.clientHeight + 1)) return "clipped";
  const rows = [...square.querySelectorAll("[data-testid=change-row]")];
  if (rows.some(row => row.scrollWidth > row.clientWidth + 1 || row.scrollHeight > row.clientHeight + 1) || [...square.querySelectorAll("[class*=ident] b")].some(name => name.scrollWidth > name.clientWidth)) return "clipped row";
  const tallest = Math.max(...sides.map(side => side.lastElementChild!.getBoundingClientRect().bottom));
  const band = body.getBoundingClientRect().bottom - tallest;
  return band > 40 ? `dead band ${band}` : "fits";
})).toBe("fits");

test.beforeEach(({ page }) => page.setDefaultTimeout(10000));

test("BSH Board leaders print components, per-game values and cohort, then export", async ({ page }) => {
  await open(page, "bsh-board", () => edition("bsh-board", bshSettings(), buildBshBoard(fictional, bshSettings())));
  const square = page.getByTestId("share-square");
  for (const text of ["BLK /G", "SOG /G", "HITS /G", "BSH /G", "total", "share of BSH/G", "Fictional Riser", "L10"]) await expect(square).toContainText(text);
  await expect(square.getByTestId("bsh-bar")).toHaveCount(2);
  await expect(square.getByTestId("bsh-bar").first().locator("[data-layer=b]")).toHaveCSS("background-color", "rgb(77, 166, 222)");
  await expect(square.getByTestId("heat-tile")).toHaveCount(2);
  await expect(page.getByTestId("post-evidence")).toContainText("All situations");
  await expect(page.getByTestId("post-evidence")).toContainText("last 10 appearances");
  await expect(page.getByTestId("post-evidence")).toContainText("40 of 40 team games");
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  await expectFits(page);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
});

test("BSH Board risers and fallers state their comparison side by side, and stale settings cannot export", async ({ page }) => {
  await open(page, "bsh-board", query => {
    const active = bshSettings({ view: (query.get("view") ?? "leaders") as BshBoardSettings["view"] });
    return edition("bsh-board", active, buildBshBoard(fictional, active));
  });
  await page.locator("label", { hasText: /^View/ }).locator("select").selectOption("movers");
  // The view reloads the post on its own.
  const square = page.getByTestId("share-square");
  await expect(square).toContainText("L10 vs previous 10");
  await expect(page.getByTestId("post-evidence")).toContainText("the previous 10 appearances");
  await expect(square.getByTestId("board-up")).toContainText("Fictional Riser");
  await expect(square.getByTestId("board-down")).toContainText("Fictional Faller");
  await expect(square.getByTestId("bsh-bar").first()).toHaveAttribute("data-state", "split");
  await expect(square.getByTestId("heat-tile")).toHaveCount(2);
  await expectMoversFit(page);
});

test("Multi Cat Monsters prints percentiles and a score, and Points-First is its own card", async ({ page }) => {
  await open(page, "category-blueprint", query => {
    const active = { ...blueprintSettings, view: (query.get("view") ?? "standard") as CategoryBlueprintSettings["view"] };
    return edition("category-blueprint", active, buildCategoryBlueprint(fictional, active));
  });
  const square = page.getByTestId("share-square");
  await expect(square.getByRole("heading", { level: 2 })).toHaveText("MULTI CAT MONSTERS");
  for (const text of ["PTS/G", "SOG/G", "HITS/G", "BLK/G", "SCORE", "P100", "percentile of 2", "average of the four"]) await expect(square).toContainText(text);
  await expect(square.getByTestId("rank-cell").first()).toHaveAttribute("data-band", "p95");
  await expect(square.getByTestId("rank-cell").first()).toHaveCSS("background-color", "rgba(0, 255, 153, 0.8)");
  await expectFits(page);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  await page.locator("label", { hasText: /^View/ }).locator("select").selectOption("points-first");
  const title = square.getByRole("heading", { level: 2 });
  await expect(title).toHaveText("POINTS-FIRST MULTI CAT MONSTERS");
  expect(await title.evaluate(heading => heading.getBoundingClientRect().height <= parseFloat(getComputedStyle(heading).lineHeight) * 1.2)).toBe(true);
  await expect(square).toContainText("(2×PTS + SOG + HITS + BLK) / 5");
  await expect(square).toContainText("Points P85+ only.");
  await expectFits(page);
});

test("Nightly Floor prints numerator, denominator, missing and its strict test", async ({ page }) => {
  await open(page, "nightly-floor", () => edition("nightly-floor", floorSettings(), buildNightlyFloor(fictional, floorSettings(), ownership)));
  const square = page.getByTestId("share-square");
  for (const text of ["More than 2 SOG.", "Exactly 2 fails.", "SOG/G", "# GP", "10 / 10", "40%", "oldest to newest", "missing"]) await expect(square).toContainText(text);
  await expect(square.getByTestId("floor-metric")).toHaveText("METRIC: SOG, 3+ per game");
  await expect(square.getByRole("heading", { level: 2 })).toHaveText("GP% WITH 3+ SOG");
  await expect(square.getByTestId("floor-strip").first().locator("[data-mark]")).toHaveCount(10);
  await expect(square.getByTestId("heat-tile")).toHaveCount(2);
  await expect(page.getByTestId("post-evidence")).toContainText("A DNP is not an appearance");
  await expect(page.getByTestId("post-evidence")).toContainText("Yahoo rostered %");
  await expectFits(page);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
});

test("Nightly Floor's headline follows its settings and its longest form stays on one line", async ({ page }) => {
  await open(page, "nightly-floor", () => edition("nightly-floor", floorSettings(), buildNightlyFloor(fictional, floorSettings(), ownership)));
  const title = page.getByTestId("share-square").getByRole("heading", { level: 2 }), view = page.locator("label", { hasText: /^View/ }).locator("select");
  await view.selectOption("cardio");
  await expect(title).toHaveText("CARDIO MASTERS");
  await view.selectOption("hits");
  await page.locator("label", { hasText: /^Hits X/ }).locator("input").fill("9.5");
  await expect(title).toHaveText("GP% WITH OVER 9.5 HITS");
  expect(await title.evaluate(heading => heading.getBoundingClientRect().height <= parseFloat(getComputedStyle(heading).lineHeight) * 1.2)).toBe(true);
  await expect(page.locator("label", { hasText: /^Post/ }).locator("select")).toContainText("Nightly Floor");
});

const crowdedOwnership = { byPlayer: new Map(Array.from({ length: 24 }, (_, index) => [index + 1, ownershipOf(10 + index, "2026-10-31")])), updatedAt: "2026-10-31T08:00:00" };
test("BSH Board risers and fallers fill the body with no clipping at 7 rows a side", async ({ page }) => {
  const moving: SkaterSeason = (() => {
    const appearances = Array.from({ length: 24 }, (_, player) => Array.from({ length: 20 }, (_, index) => game(player + 1, `Fictional Long Name ${player + 1}`, player % 2 ? "NYR" : "NJD", index, { shots: (index >= 10) === (player % 2 === 0) ? 4 + (player % 5) : 1, hits: 1 + (player % 5), blocks: 1 + (player % 4) }))).flat();
    const teamGames = [...new Map(appearances.map(row => [`${row.team}:${row.gameId}`, { gameId: row.gameId, date: row.date, team: row.team! }])).values()];
    return { appearances, teamGames, scheduledGames: teamGames.length / 2, through: "2026-10-30" };
  })();
  const active = bshSettings({ view: "movers" });
  await open(page, "bsh-board", () => edition("bsh-board", active, buildBshBoard(moving, active)));
  await page.locator("label", { hasText: /^View/ }).locator("select").selectOption("movers");
  await expect(page.getByTestId("change-row")).toHaveCount(14);
  await expectMoversFit(page);
});

const crowdedRows: Record<string, number> = { "bsh-board": 12, "category-blueprint": 20, "nightly-floor": 14 };
const crowdedEditions: Record<string, () => object> = {
  "bsh-board": () => edition("bsh-board", bshSettings(), buildBshBoard(crowded, bshSettings())),
  "category-blueprint": () => edition("category-blueprint", blueprintSettings, buildCategoryBlueprint(crowded, blueprintSettings)),
  "nightly-floor": () => edition("nightly-floor", floorSettings(), buildNightlyFloor(crowded, floorSettings(), crowdedOwnership)),
};
for (const [post, build] of Object.entries(crowdedEditions)) test(`${post} fills the body with no clipping at its row limit`, async ({ page }) => {
  await open(page, post, build);
  await expect(page.getByTestId("share-square").getByText("Fictional Long Name", { exact: false })).toHaveCount(crowdedRows[post]);
  await expectFits(page);
  if (post !== "category-blueprint") return;
  // One chip width everywhere, each square inside its chip and square, and squares lined up down each column.
  const layout = await page.getByTestId("rank-cell").evaluateAll(chips => chips.map(chip => {
    const box = chip.getBoundingClientRect(), square = chip.querySelector("[data-testid=rank-percentile]")!.getBoundingClientRect(), text = chip.querySelector("[data-testid=rank-percentile]")!;
    return { width: box.width, inside: square.left >= box.left && square.right <= box.right && square.top >= box.top && square.bottom <= box.bottom, square: square.width === square.height, fits: text.scrollWidth <= text.clientWidth, left: square.left };
  }));
  expect(new Set(layout.map(chip => chip.width)).size).toBe(1);
  expect(layout.every(chip => chip.inside && chip.square && chip.fits)).toBe(true);
  for (let column = 0; column < 4; column++) expect(new Set(layout.filter((_, index) => index % 4 === column).map(chip => chip.left)).size).toBe(1);
});

test("A board nobody clears says so and cannot export", async ({ page }) => {
  const nobody = floorSettings({ xSog: 10 });
  await open(page, "nightly-floor", () => edition("nightly-floor", nobody, buildNightlyFloor(fictional, nobody, ownership)));
  await page.locator("label", { hasText: /^SOG X/ }).locator("input").fill("10");
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

/** The shared period control over a crowded board: the real builders over the dates the URL asks for. */
const WEEK_LABEL = "Week 2 · Oct 5 to Oct 11", RANGE_LABEL = "Oct 2 to Oct 9";
const periodOf = (query: URLSearchParams) => query.get("period") === "matchup" ? { label: WEEK_LABEL, from: "2026-10-05", through: "2026-10-11" } : query.get("period") === "custom" ? { label: RANGE_LABEL, from: query.get("start")!, through: query.get("end")! } : undefined;
const inPeriod = (query: URLSearchParams): SkaterSeason => {
  const period = periodOf(query);
  if (!period) return crowded;
  const inside = <Row extends { date: string }>(rows: readonly Row[]) => rows.filter(row => row.date >= period.from && row.date <= period.through);
  const teamGames = inside(crowded.teamGames);
  return { appearances: inside(crowded.appearances), teamGames, scheduledGames: teamGames.length / 2, through: period.through, period };
};
const fromQuery = <Settings>(module: AnyShareModule, query: URLSearchParams) => parseShareSettings(module, Object.fromEntries(query), "server") as Settings;
const roster = { byPlayer: new Map(Array.from({ length: 24 }, (_, index) => [index + 1, ownershipOf(40, "2026-10-31")])), updatedAt: "2026-10-31T08:00:00" };
const BOARDS: { post: string; body: (query: URLSearchParams) => object }[] = [
  { post: "bsh-board", body: query => { const active = fromQuery<BshBoardSettings>(bshBoardModule, query); return edition("bsh-board", active, buildBshBoard(inPeriod(query), active)); } },
  { post: "category-blueprint", body: query => { const active = fromQuery<CategoryBlueprintSettings>(categoryBlueprintModule, query); return edition("category-blueprint", active, buildCategoryBlueprint(inPeriod(query), active)); } },
  { post: "nightly-floor", body: query => { const active = fromQuery<NightlyFloorSettings>(nightlyFloorModule, query); return edition("nightly-floor", active, buildNightlyFloor(inPeriod(query), active, roster)); } },
];
async function openPeriod(page: Page, post: string, body: (query: URLSearchParams) => object) {
  await page.route("**/api/v1/social-share/matchup-weeks", route => route.fulfill({ json: { cutoff: "2026-10-30", rows: [{ week: 1, start_date: "2026-09-28", end_date: "2026-10-04" }, { week: 2, start_date: "2026-10-05", end_date: "2026-10-11" }, { week: 3, start_date: "2027-03-01", end_date: "2027-03-07" }] } }));
  return open(page, post, body);
}
for (const { post, body } of BOARDS) {
  test(`${post}: recent games stay the default, and a matchup week or custom dates print their dates and fit`, async ({ page }) => {
    const requests = await openPeriod(page, post, body);
    const control = page.getByTestId("period-control"), square = page.getByTestId("share-square"), period = control.locator("select");
    await expect(period).toHaveValue("rolling");
    await expect(page.getByLabel("Window")).toHaveValue("l10");
    await expect(square).toContainText("L10");
    await expectFits(page);

    await period.selectOption("matchup");
    await expect(square).toContainText(WEEK_LABEL);
    await expect(square).not.toContainText("L10");
    await expect(page.getByLabel("Window")).toHaveCount(0);
    await expect(page.getByTestId("period-pager-label")).toContainText("Week 2");
    await expect(page.getByRole("button", { name: /Next week/ })).toBeDisabled();
    expect(requests[requests.length - 1]).toContain("period=matchup");
    await expect(page.getByTestId("post-evidence")).toContainText(WEEK_LABEL);
    await expectFits(page);

    await period.selectOption("custom");
    await expect(page.getByTestId("period-reason")).toContainText("needs a start date and an end date");
    await control.getByLabel("Custom range start").fill("2026-10-02");
    await control.getByLabel("Custom range end").fill("2026-10-09");
    await expect(square).toContainText(RANGE_LABEL);
    await expectFits(page);
    await page.reload();
    await expect(square).toContainText(RANGE_LABEL);
    await expect(period).toHaveValue("custom");
  });
}
test("old URLs and landing links keep their recent window, and a board shows why a period has no dates", async ({ page }) => {
  await openPeriod(page, "nightly-floor", query => {
    const active = fromQuery<NightlyFloorSettings>(nightlyFloorModule, query);
    return active.period === "matchup" ? edition("nightly-floor", active, { state: "missing", reasons: ["Week 3 has not started; data runs through 2026-10-30."], evidence: UNKNOWN_EVIDENCE, data: null }) : edition("nightly-floor", active, buildNightlyFloor(crowded, active, roster));
  });
  await page.goto("/social-share/posts?post=nightly-floor&view=cardio&window=l5");
  const square = page.getByTestId("share-square");
  await expect(square).toContainText("L5");
  await expect(page.getByTestId("period-control").locator("select")).toHaveValue("rolling");
  await expect(page.getByLabel("Window")).toHaveValue("l5");
  await page.goto("/social-share/posts?post=nightly-floor&period=matchup&week=3");
  await expect(page.getByTestId("post-unavailable")).toContainText("Week 3 has not started");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});
test("a late newest night ends the board at its last complete night, exportable, with the note beside the card", async ({ page }) => {
  // NJD at NYR each day; the last day has only the NJD skater, and no team results at all.
  const schedule = fictional.appearances.filter(row => row.playerId === 1).map(row => ({ id: row.gameId, date: row.date, homeTeamId: 1, awayTeamId: 3 }));
  const late: SkaterSeason = { ...fictional, teamGames: [], schedule, appearances: fictional.appearances.filter(row => !(row.playerId === 2 && row.date === "2026-10-20")) };
  await open(page, "bsh-board", () => { const { season, pageNotes } = trimLateNights(late); return edition("bsh-board", bshSettings(), { ...buildBshBoard(season, bshSettings()), pageNotes }); });
  await expect(page.getByTestId("post-page-notes")).toHaveText("Oct 20 is not fully reported yet, so this card ends Oct 19.");
  await expect(page.getByTestId("share-square")).not.toContainText("not fully reported");
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
});
