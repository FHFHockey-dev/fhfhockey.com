import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { compile } from "sass";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import type { AddressInfo } from "node:net";
import type { PublicGameView, PublicPlayerView, PublicRevision } from "../lib/forge-v2/contracts";
import { CATEGORIES, available, unavailable } from "../lib/forge-v2/contracts";
import { fixtureMeans, fixtureOpportunity } from "../lib/forge-v2/fixtures";
import { DEFAULT_SCORING } from "../lib/forge-v2/identity";

/** Display states exercise browser rendering only; they are never qualification evidence. */
function syntheticPublicPlayerView(): PublicPlayerView {
  const revisions: PublicRevision[] = [10, 5, 8, 6.5].map((value, i) => ({ id: `synthetic-revision-${i + 1}`, sequence: i + 1,
    publishedAt: `2026-01-01T12:0${i}:00.000Z`, inputCutoffAt: "2026-01-01T12:00:00.000Z", horizon: 10, teamId: 1,
    modelVersion: "synthetic-display-model", trigger: i === 1 ? "material" : "daily", evidenceClass: "fixture", qualified: true,
    value: available(value), issuedValue: available(value), issuedProfileId: DEFAULT_SCORING.id,
    means: fixtureMeans({ G: available(value / 3), A: available(0), PPP: available(0), SOG: available(0), HIT: available(0), BLK: available(0), PIM: available(2) }),
    participation: unavailable("synthetic_fixture_not_qualified"), intervals: available([{ level: 0.5, lower: 3, upper: 8 }, { level: 0.9, lower: 0, upper: 12 }]),
    intervalVintageId: `synthetic-revision-${i + 1}`, eligiblePregame: true, artifactState: i === 0 ? "retrieval_pending" : "online", limitations: ["Synthetic display fixture; not calibrated or qualified"] }));
  const games: PublicGameView[] = Array.from({ length: 10 }, (_, i) => {
    const opportunity = fixtureOpportunity({ gameId: 2099020010 + i, id: `synthetic-opportunity-${i + 1}`, horizon: (i + 1) as PublicGameView["opportunity"]["horizon"], scheduledStartAt: `2026-01-${11 + i}T23:00:00.000Z`, sourceGameDate: `2026-01-${11 + i}` });
    const rows = revisions.map(r => ({ ...r, id: `${r.id}-g${i + 1}`, intervalVintageId: `${r.id}-g${i + 1}`, qualified: i !== 2 }));
    return { profileId: DEFAULT_SCORING.id, opportunity, revisions: i === 0 ? rows.slice(0, 2) : rows, latestRevision: rows[3], lockedFinalRevision: rows[3],
      events: i === 0 ? [{ ...opportunity, id: "synthetic-gap", at: "2026-01-01T12:01:30.000Z", kind: "missing_refresh", reason: "synthetic_source_late", vintageId: null, predecessorId: null }] : [],
      nextCursor: i === 0 ? "synthetic-page-2" : null,
      lockedFinal: { state: "selected", vintageId: rows[3].id, value: rows[3].value, lockAt: opportunity.scheduledStartAt, timingStatus: "provisional", reason: "synthetic_display_fixture" },
      actual: { revisionId: `synthetic-result-${i + 1}`, appearance: i === 1 ? "nonappearance" : "official_appearance", value: available(i === 1 ? 0 : 6.5), status: "corrected" },
      freshness: { state: i === 0 ? "stale" : "fresh", asOf: "2026-01-01T12:03:00.000Z", reason: i === 0 ? "synthetic_refresh_gap" : null },
      qualification: { state: i === 2 ? "unqualified" : "qualified", reason: "synthetic_display_state_only_no_scientific_qualification", supportedHorizons: Array.from({ length: 10 }, (_, index) => (index + 1) as PublicGameView["opportunity"]["horizon"]), supportedCategories: [...CATEGORIES] } };
  });
  return { player: { id: 9900001, name: "Synthetic Skater" }, games, excluded: [{ gameId: null, reason: "synthetic_unresolved_affiliation" }], profile: DEFAULT_SCORING, scoringLabel: "as issued",
    methodology: "Synthetic display fixture only. No real forecasts, model qualification, or calibrated uncertainty are represented.",
    accountability: { requested: 10, forecastCount: 9, outcomeCount: 2, abstentions: 1, mae: unavailable("synthetic_not_evaluated"), rmse: unavailable("synthetic_not_evaluated"), bias: unavailable("synthetic_not_evaluated"), evidenceClass: "fixture", limitations: ["Synthetic display acceptance only"] } };
}

let server: Server | undefined, root: string | undefined, origin: string;
const screens = resolve(process.cwd(), "../tasks/artifacts/forge-v2-implementation-2026-10-29/screens");
test.beforeAll(async () => {
  if (process.env.PLAYWRIGHT_SKIP_WEB_SERVER !== "1") throw new Error("Fixture acceptance requires PLAYWRIGHT_SKIP_WEB_SERVER=1; do not start Next");
  root = await mkdtemp(join(tmpdir(), "forge-v2-browser-"));
  const fixture = JSON.stringify(syntheticPublicPlayerView()).replaceAll("<", "\\u003c");
  const code = `import React from 'react';
    import { createRoot } from 'react-dom/client';
    import ForecastExplorer from './components/ForgeV2/ForecastExplorer';
    import { available, unavailable } from './lib/forge-v2/contracts';
    import { scoreMeans } from './lib/forge-v2/identity';
    const original = ${fixture};
    const fullGame = original.games[0];
    const extra = [8, 6.5].map((value, index) => ({ ...fullGame.latestRevision, id: 'synthetic-revision-' + (index + 3) + '-g1', sequence: index + 3, publishedAt: '2026-01-01T12:0' + (index + 2) + ':00.000Z', value: available(value), issuedValue: available(value), means: { ...fullGame.latestRevision.means, G: available(value / 3) }, intervalVintageId: 'synthetic-revision-' + (index + 3) + '-g1' }));
    function transformed(game, profile, rescore) {
      const revision = r => ({ ...r, value: rescore ? scoreMeans(r.means, profile) : r.value, intervals: rescore ? unavailable('synthetic_profile_not_qualified') : r.intervals });
      const rows = game.revisions.map(revision);
      return { ...game, profileId: profile.id, revisions: rows, latestRevision: revision(game.latestRevision), lockedFinalRevision: revision(game.lockedFinalRevision), lockedFinal: { ...game.lockedFinal, value: revision(game.lockedFinalRevision).value }, actual: { ...game.actual, value: rescore && game.actual.appearance === 'official_appearance' ? available(2 * profile.weights.G + 2 * profile.weights.BLK + 2 * profile.weights.PIM) : game.actual.value } };
    }
    createRoot(document.getElementById('root')).render(<><aside aria-label="Fixture disclosure" style={{padding:'12px 24px',background:'#fff1ce',fontWeight:700}}>SYNTHETIC DISPLAY FIXTURE · No live forecasts or scientific qualification</aside><ForecastExplorer initialView={original} players={[original.player]} onSelectPlayer={async () => structuredClone(original)} onRescore={async (_id, profile) => ({ ...structuredClone(original), profile, scoringLabel:'re-scored under selected profile', games: original.games.map(game => transformed(game, profile, true)) })} onLoadHistory={async (_player, gameId, _cursor, profile) => { const game = original.games.find(game => game.opportunity.gameId === gameId); return transformed({ ...game, revisions: extra, nextCursor:null }, profile, profile.id !== original.profile.id); }} /></>);
  `;
  const built = await build({ stdin: { contents: code, resolveDir: process.cwd(), sourcefile: "forge-browser-fixture.tsx", loader: "tsx" }, bundle: true, platform: "browser", format: "esm", outdir: root, entryNames: "fixture", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, metafile: true, logLevel: "silent", plugins: [{ name: "real-sass-css-modules", setup(builder) { builder.onLoad({ filter: /\.module\.scss$/ }, args => ({ contents: compile(args.path).css, loader: "local-css", resolveDir: process.cwd() })); } }] });
  const forbidden = Object.keys(built.metafile!.inputs).filter(path => /forge-v2\/(?:hash\.server|history\.server|artifacts\.server|model|qualification|evaluation)\./.test(path) || /supabase|\/server\//.test(path));
  expect(forbidden).toEqual([]);
  const html = '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FORGE v2 synthetic browser acceptance</title><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;font-family:system-ui,sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
  server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (path === "/") { response.setHeader("content-type", "text/html"); response.end(html); return; }
    if (path !== "/fixture.js" && path !== "/fixture.css") { response.writeHead(404); response.end(); return; }
    try { response.setHeader("content-type", path.endsWith(".js") ? "text/javascript" : "text/css"); response.end(await readFile(join(root!, path.slice(1)))); }
    catch { response.writeHead(500); response.end("Fixture file unavailable"); }
  });
  await new Promise<void>((resolvePromise, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolvePromise); });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await mkdir(screens, { recursive: true });
});
test.afterAll(async () => {
  if (server) await new Promise<void>((resolvePromise, reject) => server!.close(error => error ? reject(error) : resolvePromise()));
  if (root) await rm(root, { recursive: true, force: true });
});

for (const [name, width] of [["desktop", 1440], ["phone", 390]] as const) test(`real FORGE fixture keyboard, history, scoring and responsive layout: ${name}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: name === "desktop" ? 1080 : 844 });
  const errors: string[] = [], blocked: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    blocked.push(route.request().url()); return route.abort();
  });
  const started = performance.now(); await page.goto(origin);
  await expect(page.getByRole("heading", { name: "One skater. Ten games." })).toBeVisible();
  const initialReadyMs = performance.now() - started;
  expect(await page.getByRole("main").evaluate(node => getComputedStyle(node).display)).toBe("grid");
  await expect(page.getByRole("complementary", { name: "Fixture disclosure" })).toContainText("SYNTHETIC DISPLAY FIXTURE");
  const cards = page.getByRole("group", { name: "Choose a scheduled game" }).getByRole("button");
  await expect(cards).toHaveCount(10);
  const overflow = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, elements: Array.from(document.querySelectorAll('main *')).filter(node => !node.closest('[role="region"]') && node.getBoundingClientRect().right > innerWidth).slice(0, 12).map(node => ({ tag: node.tagName, className: node.getAttribute('class'), width: node.getBoundingClientRect().width, right: node.getBoundingClientRect().right, text: node.textContent?.slice(0, 80) })) }));
  if (overflow.documentWidth > overflow.width) console.info("FORGE fixture overflow diagnostic", overflow);
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.width);
  await page.getByRole("searchbox", { name: "Search players" }).focus();
  await page.keyboard.press("Tab"); await expect(page.getByRole("combobox", { name: "Player", exact: true })).toBeFocused();
  await cards.nth(1).focus(); await page.keyboard.press("Enter");
  await expect(cards.nth(1)).toHaveAttribute("aria-pressed", "true");
  const actual = page.getByText("Actual result · diamond", { exact: true }).locator("..");
  await expect(actual).toContainText("nonappearance"); await expect(actual).toContainText("Not a zero-performance appearance");
  await cards.nth(2).focus(); await page.keyboard.press("Space");
  await expect(cards.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Forecast values unavailable for this scope/)).toBeVisible();
  await cards.first().focus(); await page.keyboard.press("Enter");
  await expect(page.getByText("Latest eligible revision", { exact: true }).locator("..")).toContainText("6.5");
  await expect(page.getByText("Locked-final forecast · dashed line", { exact: true }).locator("..")).toContainText("6.5");
  await expect(page.getByText("Loaded history low / high", { exact: true }).locator("..")).toContainText("5 / 10");
  await expect(page.getByLabel("Uncertainty vintage")).toHaveValue("synthetic-revision-4-g1");
  await expect(page.getByText("50% outcome interval: 3–8 fantasy points", { exact: true })).toBeVisible();
  await page.getByLabel("Uncertainty vintage").selectOption("synthetic-revision-1-g1");
  await expect(page.getByText(/Artifact retrieval pending/)).toBeVisible();
  await expect(page.getByText(/Intervals unavailable/)).toBeVisible();
  await page.getByLabel("Uncertainty vintage").selectOption("synthetic-revision-4-g1");
  await page.getByText("History events and gaps (1)", { exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByText(/missing refresh: synthetic source late/)).toBeVisible();
  const history = page.getByRole("region", { name: "Revision history table; scroll horizontally for all columns" });
  await history.focus();
  await expect(history).toBeFocused();
  expect(await history.evaluate(node => getComputedStyle(node).outlineWidth)).toBe("3px");
  if (name === "phone") {
    expect(await history.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => history.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  }
  await page.getByRole("button", { name: "Load more history" }).click();
  await expect(page.getByText(/4 revisions loaded/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Load more history" })).toHaveCount(0);
  await expect(history.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("spinbutton", { name: "G weight", exact: true }).fill("-3");
  await page.getByRole("spinbutton", { name: "PIM weight", exact: true }).fill("-0.5");
  await page.getByRole("button", { name: "Apply scoring" }).click();
  await expect(page.getByText(/Re-scored under selected profile. Original issued values and grades remain unchanged/)).toBeVisible();
  await expect(history.locator("tbody tr").first().locator("td").nth(0)).toHaveText("-11");
  await expect(history.locator("tbody tr").first().locator("td").nth(1)).toHaveText("10");
  await expect(page.getByText(/Intervals unavailable — synthetic profile not qualified/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "View player" }).click();
  await expect(page.getByText("Showing original issued scoring.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Load more history" }).click();
  await expect(page.getByText(/4 revisions loaded/)).toBeVisible();
  await page.getByText("History events and gaps (1)", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: join(screens, `${name}.png`), fullPage: true });
  const metrics = { evidence: "synthetic_browser_only", viewport: { width, height: name === "desktop" ? 1080 : 844 }, initialReadyMs, interactionSequenceMs: performance.now() - started, pageOverflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), blockedRequests: blocked.length };
  await testInfo.attach("fixture-browser-metrics", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  console.info("FORGE real browser fixture", metrics);
  expect(blocked).toEqual([]); expect(errors).toEqual([]);
});
