import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { parseShareSettings, type SharePostLoadResult } from "../lib/socialShare/modules/contract";
import { buildMultiCatStars, MULTI_CAT_CONTROL, MULTI_CAT_OWN, multiCatStarsModule, type MultiCatGame, type MultiCatSeason, type MultiCatSettings } from "../lib/socialShare/modules/multiCatStars";
import { matchupCalendar, resolvePeriodWindow } from "../lib/socialShare/modules/shared/periodWindow";

/**
 * Top Multi-Cat Stars of the Week. Fictional skaters through the real builder, with the same fictional editor session
 * as social-share.spec.ts. Run with NEXT_PUBLIC_SUPABASE_URL on a reserved .invalid host.
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
const WEEK = ["2026-10-26", "2026-10-28", "2026-10-30"];
const CUTOFF = "2026-10-31";
/** Week 3 runs 14 days over a fictional break. */
const CALENDAR = [{ week: 3, start_date: "2026-10-05", end_date: "2026-10-18" }, { week: 4, start_date: "2026-10-19", end_date: "2026-10-25" }, { week: 5, start_date: "2026-10-26", end_date: "2026-11-01" }];
const game = (playerId: number, date: string, stats: Partial<MultiCatGame> = {}): MultiCatGame => ({
  playerId, name: `Fictional Long Name ${playerId}`, position: playerId % 3 ? "C" : "D", group: playerId % 3 ? "F" : "D", gameId: Number(date.replace(/-/g, "")) * 100 + (playerId % 2), date, team: playerId % 2 ? "NYR" : "NJD", opponent: null, home: null,
  goals: playerId % 3, assists: playerId % 4, points: playerId % 3 + playerId % 4, shots: 1 + playerId % 6, hits: 1 + playerId % 5, blocks: 1 + playerId % 4, ppPoints: playerId % 2, toiSeconds: 900, ppToiSeconds: 0, penaltyMinutes: playerId % 3, plusMinus: playerId % 5 - 2, ...stats,
});
const seasonOf = (appearances: MultiCatGame[]): MultiCatSeason => {
  const teamGames = [...new Map(appearances.map(row => [`${row.team}:${row.gameId}`, { gameId: row.gameId, date: row.date, team: row.team! }])).values()];
  return { appearances, teamGames, scheduledGames: teamGames.length / 2, through: CUTOFF };
};
/** More skaters than the board holds, all with the widest values a real week could plausibly print. */
const crowded = seasonOf(Array.from({ length: 12 }, (_, player) => ["2026-10-10", "2026-10-14", "2026-10-20", "2026-10-22", ...WEEK].map(date => game(player + 1, date))).flat());
const defaults = parseShareSettings(multiCatStarsModule, {}) as MultiCatSettings;
const edition = (settings: object, result: SharePostLoadResult<unknown>) => {
  // Built on Nov 1, so the pager's cutoff is CUTOFF whatever today is; it still expires ten minutes from now.
  const generatedAt = "2026-11-01T16:00:00.000Z";
  return { schemaVersion: 1, id: "multi-cat-stars-e2e", post: "multi-cat-stars", generatedAt, expiresAt: new Date(Date.now() + 600000).toISOString(), timeZone: "America/New_York", settings, fixture: false, state: result.state, reasons: result.reasons ?? [], evidence: result.evidence, data: result.data, teams: result.teams ?? [] };
};
async function open(page: Page, season: MultiCatSeason) {
  await signIn(page);
  await page.route("**/api/v1/social-share/posts/**", route => {
    const query = new URL(route.request().url()).searchParams;
    expect(route.request().headers().authorization).toBe(`Bearer ${editorToken}`);
    const active = { ...defaults, basis: query.get("basis") ?? defaults.basis, formula: query.get("formula") ?? defaults.formula, period: query.get("period") ?? defaults.period, week: query.get("week") ? Number(query.get("week")) : null, start: query.get("start"), end: query.get("end") } as MultiCatSettings;
    const { window } = resolvePeriodWindow(active, matchupCalendar(CALENDAR), { ...MULTI_CAT_CONTROL, cutoff: CUTOFF, own: MULTI_CAT_OWN });
    return route.fulfill({ json: edition(active, buildMultiCatStars({ ...season, through: window!.through < CUTOFF ? window!.through : CUTOFF }, active, window!)) });
  });
  await page.route("**/api/v1/social-share/matchup-weeks", route => route.fulfill({ json: { rows: CALENDAR, cutoff: CUTOFF } }));
  await page.goto("/social-share/posts?post=multi-cat-stars");
  await expect(page.getByTestId("share-square")).toBeVisible();
}
/** Nothing clipped, labels inside each radar, the headline on one line, and no dead band under the panels. */
const expectFits = (page: Page) => expect.poll(() => page.getByTestId("share-square").evaluate(square => {
  // The preview scales the fixed 1080px node, so measured lengths convert back to its own pixels.
  const scale = square.getBoundingClientRect().width / (square as HTMLElement).offsetWidth;
  const body = square.querySelector("[class*=postBody]"), panels = [...square.querySelectorAll<HTMLElement>("[data-testid=multi-cat-panel]")];
  if (!body || !panels.length) return "no panels";
  if (body.scrollHeight > body.clientHeight + 1 || square.scrollHeight > square.clientHeight + 1) return "clipped body";
  const heading = square.querySelector("h2");
  if (heading && (heading.getBoundingClientRect().height / scale > parseFloat(getComputedStyle(heading).fontSize) * 1.2 || heading.scrollWidth > heading.clientWidth + 1)) return `headline wraps: ${heading.textContent}`;
  for (const panel of panels) {
    if (panel.scrollHeight > panel.clientHeight + 1 || panel.scrollWidth > panel.clientWidth + 1) return "clipped panel";
    for (const line of panel.querySelectorAll("[class*=name], small")) if (line.scrollWidth > line.clientWidth + 1) return `clipped text: ${line.textContent}`;
    const radar = panel.querySelector("svg")!, box = radar.getBoundingClientRect();
    for (const label of radar.querySelectorAll("text")) { const edge = label.getBoundingClientRect(); if (edge.left < box.left - 1 || edge.right > box.right + 1 || edge.top < box.top - 1 || edge.bottom > box.bottom + 1) return `radar label off: ${label.textContent}`; }
    if (box.height / scale < 200) return `radar small: ${box.height / scale}`;
  }
  const band = body.getBoundingClientRect().bottom - panels[panels.length - 1].getBoundingClientRect().bottom;
  return band / scale > 40 ? `dead band ${band / scale}` : "fits";
})).toBe("fits");

test.beforeEach(({ page }) => page.setDefaultTimeout(10000));

test("all four views rank, retitle, fit the square and can export", async ({ page }) => {
  await open(page, crowded);
  const square = page.getByTestId("share-square");
  const views = [
    { basis: "Period Total", formula: "Standard", headline: "TOP MULTI-CAT STARS OF THE WEEK", rule: "PTS + BLK + SOG + HIT, total" },
    { basis: "Period Total", formula: "Points-First", headline: "TOP POINTS-FIRST STARS OF THE WEEK", rule: "2 x PTS + BLK + SOG + HIT, total" },
    { basis: "Per Game", formula: "Standard", headline: "TOP MULTI-CAT STARS PER GAME", rule: "PTS + BLK + SOG + HIT, per game, 2+ GP" },
    { basis: "Per Game", formula: "Points-First", headline: "TOP POINTS-FIRST STARS PER GAME", rule: "2 x PTS + BLK + SOG + HIT, per game, 2+ GP" },
  ];
  for (const view of views) {
    await page.locator("label", { hasText: /^Ranking/ }).locator("select").selectOption({ label: view.basis === "Per Game" ? "Per Game (min 2 GP)" : view.basis });
    await page.locator("label", { hasText: /^Formula/ }).locator("select").selectOption({ label: `${view.formula}: ${view.formula === "Standard" ? "" : "2 x "}PTS + BLK + SOG + HIT` });
    await expect(square.locator("h2")).toHaveText(view.headline);
    await expect(square).toContainText(view.rule);
    await expect(square.getByTestId("multi-cat-panel")).toHaveCount(4);
    await expectFits(page);
    await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
    if (process.env.MULTI_CAT_SHOTS) await square.screenshot({ path: `${process.env.MULTI_CAT_SHOTS}/${view.basis.replace(/ /g, "-")}-${view.formula}.png` });
  }
});

test("each window is labelled, and radar colours are attributes the PNG capture keeps", async ({ page }) => {
  await open(page, crowded);
  const square = page.getByTestId("share-square");
  for (const text of ["RANKED", "fantasy week 5 · Oct 26 to Nov 1, through Oct 31", "last 7 days, Oct 25-Oct 31", "season per-game percentile through Oct 31 among 12 skaters", "Ties share a rank"]) await expect(square).toContainText(text);
  await expect(square.getByText("LAST 7 DAYS", { exact: true })).toHaveCount(4);
  await expect(square.getByText("SEASON PERCENTILE", { exact: true })).toHaveCount(4);
  const shape = square.getByTestId("multi-cat-shape").first();
  await expect(shape).toHaveAttribute("fill", "rgba(43, 168, 242, 0.65)");
  await expect(shape).toHaveAttribute("stroke", "#07aae2");
  await expect(page.getByTestId("post-watermark")).toHaveText("OBSERVED RESULTS");
});

test("the exported PNG is the 1080 square with the radar's colours in it", async ({ page }) => {
  await open(page, crowded);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const file = await (await download).path();
  const png = readFileSync(file);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1080]);
  if (process.env.MULTI_CAT_SHOTS) writeFileSync(`${process.env.MULTI_CAT_SHOTS}/export.png`, new Uint8Array(png));
  const hasRadarBlue = await page.evaluate(async bytes => {
    const image = new Image();
    image.src = `data:image/png;base64,${bytes}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1080;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, 1080, 1080);
    let blue = 0;
    for (let index = 0; index < data.length; index += 4) if (data[index + 2] > 150 && data[index] < 70 && data[index + 1] > 100) blue++;
    return blue;
  }, png.toString("base64"));
  expect(hasRadarBlue).toBeGreaterThan(5000); // Four filled shapes: a dropped fill would leave only outlines and text.
});

test("missing values stay visibly missing, and the radar does not close over them", async ({ page }) => {
  const gaps = seasonOf(Array.from({ length: 4 }, (_, player) => WEEK.map(date => game(player + 1, date, player === 0 ? { plusMinus: null, ppPoints: null } : {}))).flat());
  await open(page, gaps);
  const square = page.getByTestId("share-square"), panel = square.getByTestId("multi-cat-panel").filter({ hasText: "Fictional Long Name 1" });
  await expect(panel.getByTestId("multi-cat-radar")).toHaveAttribute("data-closed", "false");
  await expect(panel.getByTestId("multi-cat-gap")).toHaveCount(2);
  await expect(panel.getByTestId("multi-cat-shape")).toHaveCount(0);
  await expect(panel.getByTestId("multi-cat-table").getByText("—")).toHaveCount(2);
  await expectFits(page);
});

test("a traded skater's longest identity line still fits", async ({ page }) => {
  const wide = { points: 10, shots: 10, hits: 10, blocks: 10 };
  await open(page, seasonOf(Array.from({ length: 4 }, (_, player) => WEEK.map((date, index) => game(player + 1, date, { ...wide, team: index ? "NYR" : "NJD" }))).flat()));
  await expect(page.getByTestId("share-square").getByTestId("multi-cat-panel").first()).toContainText("NYR/NJD");
  await expectFits(page);
});

test("an odd board leaves no empty quadrant, and an empty one says why and cannot export", async ({ page }) => {
  await open(page, seasonOf(Array.from({ length: 3 }, (_, player) => WEEK.map(date => game(player + 1, date))).flat()));
  await expect(page.getByTestId("share-square").getByTestId("multi-cat-panel")).toHaveCount(3);
  await expectFits(page);
  await page.unrouteAll();
  await open(page, seasonOf([game(1, "2026-10-27")]));
  await page.locator("label", { hasText: /^Ranking/ }).locator("select").selectOption({ label: "Per Game (min 2 GP)" });
  await expect(page.getByTestId("share-square")).toContainText("No skater has 2 GP this fantasy week yet");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});

test("the period control ranks a past matchup, a long matchup and a custom range, each with a true headline and table label", async ({ page }) => {
  await open(page, crowded);
  const square = page.getByTestId("share-square"), panels = square.getByTestId("multi-cat-panel");
  const period = page.getByTestId("period-control");
  await expect(square.locator("h2")).toHaveText("TOP MULTI-CAT STARS OF THE WEEK");
  await expect(square.getByText("LAST 7 DAYS", { exact: true })).toHaveCount(4);

  await period.locator("select").selectOption({ label: "Matchup week" });
  await expect(page.getByTestId("period-pager-label")).toHaveText("Week 4 · Oct 19 to Oct 25"); // A blank past-only week is the last completed.
  await expect(square.locator("h2")).toHaveText("TOP MULTI-CAT STARS OF THE WEEK");
  await expect(square).toContainText("fantasy week 4 · Oct 19 to Oct 25");
  await expect(square).toContainText("same dates as the ranking");
  await expect(square).toContainText("through Oct 25 among 12 skaters");
  await expect(square.getByText("SAME DATES", { exact: true })).toHaveCount(4);
  await expect(panels.first().getByTestId("multi-cat-table").locator("b").first()).toHaveText("2");
  await expectFits(page);
  if (process.env.MULTI_CAT_SHOTS) await square.screenshot({ path: `${process.env.MULTI_CAT_SHOTS}/matchup.png` });

  await page.getByRole("button", { name: /^Prior week/ }).click();
  await expect(square.locator("h2")).toHaveText("TOP MULTI-CAT STARS OF THE MATCHUP");
  await expect(square).toContainText("fantasy week 3 · Oct 5 to Oct 18");
  await expect(panels.first().getByTestId("multi-cat-score")).toContainText("MATCHUP");
  await expectFits(page);

  await period.locator("select").selectOption({ label: "Custom range" });
  await period.locator("label", { hasText: "start" }).locator("input").fill("2026-10-14");
  await period.locator("label", { hasText: "end" }).locator("input").fill("2026-10-28");
  await expect(square.locator("h2")).toHaveText("TOP MULTI-CAT STARS");
  await expect(square).toContainText("Oct 14 to Oct 28");
  await expect(panels.first().getByTestId("multi-cat-score")).toContainText("TOTAL");
  await expect(panels.first().getByTestId("multi-cat-table").locator("b").first()).toHaveText("5"); // Oct 14, 20, 22, 26 and 28.
  await expectFits(page);
  if (process.env.MULTI_CAT_SHOTS) await square.screenshot({ path: `${process.env.MULTI_CAT_SHOTS}/custom.png` });
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
});

test("a landing link naming only the view still opens on the current fantasy week", async ({ page }) => {
  await open(page, crowded);
  await page.goto("/social-share/posts?post=multi-cat-stars&basis=perGame&formula=pointsFirst");
  const square = page.getByTestId("share-square");
  await expect(square.locator("h2")).toHaveText("TOP POINTS-FIRST STARS PER GAME");
  await expect(square.getByText("LAST 7 DAYS", { exact: true })).toHaveCount(4);
  await expect(square).toContainText("fantasy week 5 · Oct 26 to Nov 1");
  await expectFits(page);
});
