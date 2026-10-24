// Approved bounded live check, concurrency 1: counts every local page and API GET against the cap,
// serialises them, aborts (and fails the run on) any request that starts while another is in flight.
// Records states, counts and timings only. Usage: node live-check.cjs <outDir>  (env SS1_LIVE_CAP, SS1_LIVE_FORMAT)
const path = require("node:path"), fs = require("node:fs");
const { createSerialGuard } = require("./serial-guard.cjs");
const { chromium } = require(require.resolve("@playwright/test", { paths: ["/Users/tim/Code/fhfhockey.com/web"] }));
const OUT = process.argv[2], BASE = "http://127.0.0.1:3110", CAP = Number(process.env.SS1_LIVE_CAP ?? 5), FORMAT = process.env.SS1_LIVE_FORMAT ?? "game-grid";
const guard = createSerialGuard(CAP), summary = { cap: CAP, format: FORMAT, renders: [], stoppedBecause: null };
const counted = url => url.pathname === `/social-share/${FORMAT}` || url.pathname.startsWith("/api/v1/social-share/");
const brief = body => body && body.schemaVersion ? { state: body.state, sourceState: body.source?.state, reasons: [...(body.reasons ?? []), ...(body.source?.reasons ?? [])], expiresAt: body.expiresAt,
  opponents: body.opponents && { state: body.opponents.state, teams: Object.keys(body.opponents.teams ?? {}).length }, players: body.players && { state: body.players.state, shown: body.players.players?.length, reasons: body.players.reasons } } : { error: body?.error ?? null };
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 }, acceptDownloads: true });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    if (!counted(url)) return route.continue();
    const token = guard.begin(url.pathname.startsWith("/api/") ? "api" : "page", url.pathname + url.search);
    if (!token) return route.abort();
    try {
      const response = await route.fetch();
      let details = { status: response.status(), cacheControl: response.headers()["cache-control"] };
      if (token.kind === "api") { const body = await response.json().catch(() => null); details = { ...details, ...brief(body) }; await route.fulfill({ response, body: JSON.stringify(body) }); }
      else await route.fulfill({ response });
      guard.end(token, details);
    } catch (error) { guard.end(token, { error: String(error?.message ?? error).slice(0, 200) }); throw error; }
  });
  const page = await context.newPage();
  const download = page.getByRole("button", { name: "Download PNG", exact: true }), graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square");
  await page.goto(`${BASE}/social-share/${FORMAT}`);
  await page.waitForResponse(response => response.url().includes(`/api/v1/social-share/${FORMAT}`), { timeout: 60000 });
  await page.waitForTimeout(3000);
  const cards = [];
  for (const card of ["pickups-50", "pickups-30", "pickups-20", "specialists", "grid"]) {
    await graphic.selectOption(card); await page.waitForTimeout(500);
    const enabled = await download.isEnabled(), tiles = await square.locator("[data-player], [data-team]").count();
    let png = null;
    if (enabled) { const pending = page.waitForEvent("download"); await download.click(); png = path.join(OUT, `live-${FORMAT}-${card}.png`); await (await pending).saveAs(png); }
    cards.push({ card, enabled, tiles, png: png && path.basename(png) });
  }
  summary.renders.push({ edition: "page default", cards });
  summary.stoppedBecause = "single render pass";
  await browser.close();
  Object.assign(summary, { requests: guard.log, violations: guard.violations, countedRequests: guard.started });
  fs.writeFileSync(path.join(OUT, "live-summary.json"), JSON.stringify(summary, null, 2));
  if (guard.violations.length) { console.error(`FAILED: ${guard.violations.length} concurrency/cap violation(s)`); process.exit(2); }
})().catch(error => { Object.assign(summary, { error: String(error?.message ?? error).slice(0, 500), requests: guard.log, violations: guard.violations }); fs.writeFileSync(path.join(OUT, "live-summary.json"), JSON.stringify(summary, null, 2)); process.exit(1); });
