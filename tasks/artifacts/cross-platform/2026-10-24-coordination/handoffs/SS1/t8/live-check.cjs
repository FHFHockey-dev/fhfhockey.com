// SS1-8 bounded live check (TJ-approved): sequential page-driven GETs to the local social-share API,
// hard cap 5, stop at the first correct render. Records states, counts and timings only (no names).
const path = require("node:path"), fs = require("node:fs");
const web = "/Users/tim/Code/fhfhockey.com/web";
const { chromium } = require(require.resolve("@playwright/test", { paths: [web] }));
const OUT = process.argv[2], BASE = "http://127.0.0.1:3110", CAP = 5;
const summary = { cap: CAP, apiRequests: [], renders: [], stoppedBecause: null };
const brief = (body, ms, url) => body && body.schemaVersion ? {
  url: url.replace(BASE, ""), ms, format: body.format, weekStart: body.weekStart, state: body.state, sourceState: body.source?.state, reasons: [...(body.reasons ?? []), ...(body.source?.reasons ?? [])],
  generatedAt: body.generatedAt, expiresAt: body.expiresAt, games: body.games?.length, teams: body.teams?.length,
  opponents: body.opponents && { state: body.opponents.state, teams: Object.keys(body.opponents.teams ?? {}).length, reasons: body.opponents.reasons, updatedAt: body.opponents.updatedAt },
  players: body.players && { state: body.players.state, shown: body.players.players?.length, reasons: body.players.reasons, ownershipAsOf: body.players.ownershipAsOf, statsUpdatedAt: body.players.statsUpdatedAt, selectedDates: body.players.selectedDates?.length },
} : { url: url.replace(BASE, ""), ms, error: body?.error ?? "non-snapshot body" };
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 }, acceptDownloads: true });
  let apiCount = 0;
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    if (url.pathname.startsWith("/api/v1/social-share/")) {
      if (++apiCount > CAP) return route.abort();
      const started = Date.now(), response = await route.fetch(), ms = Date.now() - started;
      let body = null; try { body = await response.json(); } catch {}
      summary.apiRequests.push({ n: apiCount, status: response.status(), cacheControl: response.headers()["cache-control"], ...brief(body, ms, url.href) });
      return route.fulfill({ response, body: JSON.stringify(body) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  const download = page.getByRole("button", { name: "Download PNG", exact: true }), graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square");
  async function renderCards(label) {
    const results = [];
    for (const card of ["pickups-50", "pickups-30", "pickups-20", "specialists", "grid"]) {
      await graphic.selectOption(card);
      await page.waitForTimeout(500);
      const enabled = await download.isEnabled(), tiles = await square.locator("[data-player], [data-team]").count();
      const reason = enabled ? null : (await square.locator("p").first().innerText().catch(() => "")).slice(0, 300);
      let png = null;
      if (enabled) {
        const pending = page.waitForEvent("download"); await download.click(); const file = await pending;
        png = path.join(OUT, `live-${label}-${card}.png`); await file.saveAs(png);
      }
      results.push({ card, enabled, tiles, unreadyReason: reason, png: png && path.basename(png) });
    }
    return results;
  }
  await page.goto(`${BASE}/social-share/game-grid`);
  await page.waitForResponse(response => response.url().includes("/api/v1/social-share/game-grid"), { timeout: 60000 });
  await page.waitForTimeout(3000);
  const first = await renderCards("current-week");
  summary.renders.push({ edition: "current week (page default)", cards: first });
  const ok = list => list.filter(item => item.card.startsWith("pickups") || item.card === "specialists").every(item => item.enabled && item.tiles > 0);
  if (ok(first)) summary.stoppedBecause = "first render correct (current week)";
  else {
    await page.getByLabel("Week of (Monday)").fill("2026-10-26");
    await page.waitForResponse(response => response.url().includes("weekStart=2026-10-26"), { timeout: 60000 });
    await page.waitForTimeout(3000);
    const second = await renderCards("week-2026-10-26");
    summary.renders.push({ edition: "week of 2026-10-26", cards: second });
    summary.stoppedBecause = ok(second) ? "second render correct (upcoming week)" : "stopped after two editions; see reasons";
  }
  summary.apiRequestCount = apiCount;
  fs.writeFileSync(path.join(OUT, "live-summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
})().catch(error => { summary.error = String(error?.message ?? error).slice(0, 500); fs.writeFileSync(path.join(OUT, "live-summary.json"), JSON.stringify(summary, null, 2)); process.exit(1); });
