// Offline, network-blocked browser measurement of the FORGE reserve payload (TJ: decode, memory and save/reopen on
// mobile as well as desktop). No Next server, no app routes, no database: fixture data only, in local Chromium.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { compactBridgeForecasts } from "lib/rosterScheduleData/bridgeForecastWire";
import { buildForgeDailyBridgeForecasts } from "lib/rosterScheduleData/forgeDailyBridge";
import { league, now, seasonId } from "lib/rosterScheduleData/forgeReservePayload.fixture";

const web = "/Users/tim/Code/fhfhockey.com/web";
const require = createRequire(resolve(web, "package.json"));
const { chromium, devices } = require("playwright") as typeof import("playwright");
const esbuild = require("esbuild") as typeof import("esbuild");
/** Bounds for the typical full-coverage week on the throttled phone profile. */
const MOBILE_BOUNDS = { decodeMs: 2000, saveReopenMs: 4000, heapUsedMb: 250 };

test("decode, memory and save/reopen for a typical full-coverage week on mobile and desktop", async () => {
  const { players, games, inputs } = league(7, "typical");
  const built = buildForgeDailyBridgeForecasts(inputs, players, games, now, seasonId, forecastCalendarPolicy(8));
  const { wire, forecasts: kept } = compactBridgeForecasts(built.forecasts, { players, games }, seasonId);
  expect(kept).toEqual([]);
  const response = JSON.stringify({ success: true, data: { players, games }, bridgeForecasts: wire });
  const bundle = (await esbuild.build({ entryPoints: [resolve(__dirname, "entry.ts")], bundle: true, write: false, format: "iife",
    platform: "browser", target: "es2020" })).outputFiles[0].text;
  const browser = await chromium.launch({ headless: true, args: ["--enable-precise-memory-info"] });
  const results: Record<string, unknown>[] = [];
  try {
    for (const profile of [{ name: "mobile (Pixel 7, 4x CPU throttle)", device: devices["Pixel 7"], throttle: 4 },
      { name: "desktop (no throttle)", device: devices["Desktop Chrome"], throttle: 1 }]) {
      const context = await browser.newContext({ ...profile.device });
      // Network blocked: nothing may leave the page.
      await context.route("**/*", route => route.abort());
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.throttle });
      await cdp.send("Performance.enable");
      await page.setContent(`<!doctype html><meta charset="utf-8"><script>${bundle}</script>`);
      const heap = async () => (await cdp.send("Performance.getMetrics")).metrics.filter(m => ["JSHeapUsedSize", "JSHeapTotalSize"].includes(m.name))
        .reduce((out, m) => ({ ...out, [m.name]: m.value }), {} as Record<string, number>);
      await cdp.send("HeapProfiler.enable"); await cdp.send("HeapProfiler.collectGarbage");
      const before = await heap();
      const decode = await page.evaluate((body: string) => {
        const t0 = performance.now();
        const parsed = JSON.parse(body);
        const t1 = performance.now();
        const forecasts = (globalThis as any).rso.expandBridgeForecasts(parsed.bridgeForecasts, parsed.data);
        const t2 = performance.now();
        (globalThis as any).snapshot = { id: "snap", context: { seasonId: parsed.bridgeForecasts.seasonId }, players: parsed.data.players,
          games: parsed.data.games, forecasts, roster: [], lockedAssignments: [], realized: {} };
        return { parseMs: t1 - t0, expandMs: t2 - t1, rows: forecasts.length };
      }, response);
      const afterDecode = await heap();
      const saveReopen = await page.evaluate(() => {
        const { packPlanningSnapshots, unpackPlanningSnapshots } = (globalThis as any).rso;
        const snapshot = (globalThis as any).snapshot;
        const t0 = performance.now();
        const saved = JSON.stringify(packPlanningSnapshots({ workspace: { version: 1 }, snapshot }));
        const t1 = performance.now();
        const reopened = unpackPlanningSnapshots(JSON.parse(saved));
        const t2 = performance.now();
        const unpackedBytes = new TextEncoder().encode(JSON.stringify(reopened)).byteLength;
        const same = reopened.snapshot.forecasts.length === snapshot.forecasts.length
          && JSON.stringify(reopened.snapshot.forecasts[0]) === JSON.stringify(snapshot.forecasts[0])
          && JSON.stringify(reopened.snapshot.forecasts.at(-1)) === JSON.stringify(snapshot.forecasts.at(-1));
        return { saveMs: t1 - t0, reopenMs: t2 - t1, savedBytes: new TextEncoder().encode(saved).byteLength, unpackedBytes, same };
      });
      const afterSave = await heap();
      const mb = (bytes: number) => Math.round(bytes / 1e5) / 10;
      const row = { profile: profile.name, rows: decode.rows, responseBytes: Buffer.byteLength(response),
        parseMs: Math.round(decode.parseMs), expandMs: Math.round(decode.expandMs), saveMs: Math.round(saveReopen.saveMs), reopenMs: Math.round(saveReopen.reopenMs),
        savedPackedBytes: saveReopen.savedBytes, reopenedUnpackedBytes: saveReopen.unpackedBytes, roundTripExact: saveReopen.same,
        heapUsedMb: { baseline: mb(before.JSHeapUsedSize), afterDecode: mb(afterDecode.JSHeapUsedSize), afterSaveReopen: mb(afterSave.JSHeapUsedSize) },
        heapAllocatedMbMax: mb(Math.max(afterDecode.JSHeapTotalSize, afterSave.JSHeapTotalSize)) };
      results.push(row);
      await context.close();
      expect(row.rows).toBe(built.forecasts.length);
      expect(row.roundTripExact).toBe(true);
    }
  } finally { await browser.close(); }
  writeFileSync(resolve(__dirname, "results.json"), JSON.stringify({ measuredAt: new Date().toISOString(), fixture: "typical 7-day full coverage (forgeReservePayload.fixture.ts)", bounds: MOBILE_BOUNDS, results }, null, 2) + "\n");
  console.info(`FORGE_RESERVE_MOBILE ${JSON.stringify(results)}`);
  const mobile = results[0] as any;
  expect(mobile.parseMs + mobile.expandMs).toBeLessThan(MOBILE_BOUNDS.decodeMs);
  expect(mobile.saveMs + mobile.reopenMs).toBeLessThan(MOBILE_BOUNDS.saveReopenMs);
  expect(Math.max(mobile.heapUsedMb.afterDecode, mobile.heapUsedMb.afterSaveReopen)).toBeLessThan(MOBILE_BOUNDS.heapUsedMb);
});
