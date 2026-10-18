#!/usr/bin/env node
// Local 1080px preview renderer for the schedule-only social package.
// No dev server, no network: the real SocialShare component is bundled with
// esbuild and served to headless Chromium from intercepted routes. Every
// edition is built from SYNTHETIC fixtures and stamped as such in the image.
//
// Usage (from the repository root):
//   node tasks/artifacts/social-share-lane-2026-10-18/harness/render-previews.mjs [outDir]
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WEEK_START, syntheticGames, withStates, octoberIndexedSchedule } from "./fixtures.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const web = join(repo, "web");
const outDir = resolve(process.argv[2] ?? join(here, "..", "exports"));
const require = createRequire(join(web, "package.json"));
const esbuild = require("esbuild");
const sass = require("sass");
const { chromium } = require("playwright");
mkdirSync(outDir, { recursive: true });
const build = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "fhfh-social-preview-"));

// ---- Bundles ---------------------------------------------------------------
const scss = { name: "scss", setup(b) {
  b.onLoad({ filter: /\.scss$/ }, args => ({ contents: sass.compile(args.path, { loadPaths: [web] }).css, loader: args.path.endsWith(".module.scss") ? "local-css" : "css" }));
} };
const common = { bundle: true, tsconfig: join(web, "tsconfig.json"), nodePaths: [join(web, "node_modules")], logLevel: "warning", absWorkingDir: web };
await esbuild.build({ ...common, entryPoints: [join(here, "snapshot-entry.ts")], platform: "node", format: "esm", outfile: join(build, "snapshot.mjs") });
await esbuild.build({ ...common, entryPoints: { page: join(here, "page-entry.tsx") }, platform: "browser", format: "iife", jsx: "automatic", outdir: build, plugins: [scss], external: ["/fonts/*", "/pictures/*"],
  alias: { react: join(web, "node_modules/react"), "react-dom": join(web, "node_modules/react-dom") },
  define: { "process.env.NODE_ENV": '"production"' }, banner: { js: "var process = globalThis.process || { env: { NODE_ENV: 'production' } };" } });
const { buildScheduleSnapshot, selectScheduleDates, weekDates } = await import(pathToFileURL(join(build, "snapshot.mjs")).href);

// ---- Editions --------------------------------------------------------------
const dates = weekDates(WEEK_START);
const base = syntheticGames();
const minus = (iso, ms) => new Date(Date.parse(iso) - ms).toISOString();
function edition(format, generatedAt, mutate = games => games) {
  const games = mutate(withStates(base, generatedAt));
  return buildScheduleSnapshot({ format, weekStart: WEEK_START, generatedAt, schedule: octoberIndexedSchedule(games, minus(generatedAt, 120000)) });
}
const weekly = edition("game-grid", "2026-10-19T14:00:00Z"); // Mon 10:00 ET
const remaining = edition("remaining-week", "2026-10-21T16:00:00Z"); // Wed 12:00 ET
const thursday = base.find(game => game.gameDate === dates[3]);
const partial = edition("remaining-week", "2026-10-21T16:00:00Z", games => games.map(game => game.id === thursday.id ? { ...game, gameState: undefined } : game));
const cbj = weekly.teams.find(team => team.abbreviation === "CBJ").id;
const plus = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();

const runs = [
  { name: "weekly-top3", snapshot: weekly, clockAt: plus(weekly.generatedAt, 60000), download: true, label: "SYNTHETIC FIXTURE" },
  { name: "weekly-team-focus-cbj", snapshot: weekly, clockAt: plus(weekly.generatedAt, 60000), focus: cbj, download: true, label: "SYNTHETIC FIXTURE" },
  { name: "remaining-week-top3", snapshot: remaining, clockAt: plus(remaining.generatedAt, 60000), download: true, label: "SYNTHETIC FIXTURE" },
  { name: "remaining-week-partial", snapshot: partial, clockAt: plus(partial.generatedAt, 60000), label: "SYNTHETIC · PARTIAL EDITION" },
  { name: "weekly-expired", snapshot: weekly, clockAt: plus(weekly.expiresAt, 60000), label: "SYNTHETIC · EXPIRED EDITION" },
];

// ---- Contract checks on the frozen editions ---------------------------------
const remainingIn = (snap, team, selected) => base.filter(game => selected.includes(game.gameDate) && Date.parse(game.startTimeUTC) > Date.parse(snap.generatedAt) && (game.homeTeam.id === team || game.awayTeam.id === team)).length;
const allDays = selectScheduleDates(remaining, dates);
const lateWed = base.find(game => game.gameDate === dates[2] && game.startTimeUTC.startsWith(dates[3]));
const rerendered = edition("game-grid", plus(weekly.expiresAt, 60000));
const checks = {
  weeklyReady: weekly.state === "ready" && weekly.selectedDates.length === 7,
  weeklyProviderUpdateUnknown: weekly.source.updatedAt === null,
  remainingDefaultsThuToSun: JSON.stringify(remaining.selectedDates) === JSON.stringify(dates.slice(3)),
  remainingCountsOnlyFutureSelected: remaining.rows.every(row => row.remainingGames === remainingIn(remaining, row.team.id, dates.slice(3))),
  lateWednesdayGameStaysWednesday: !!lateWed && remaining.games.find(game => game.id === lateWed.id)?.date === dates[2],
  allDaysExcludesElapsedMonTue: allDays.rows.every(row => row.remainingGames === remainingIn(remaining, row.team.id, dates)),
  partialIsNotReady: partial.state === "partial" && partial.reasons.some(reason => reason.includes("unknown start or state")),
  rerenderIsNewEditionNotRenewal: rerendered.id !== weekly.id && rerendered.generatedAt !== weekly.generatedAt,
};
const reasons = { weekly: weekly.reasons, remaining: remaining.reasons, partial: partial.reasons };

// ---- Browser ---------------------------------------------------------------
const types = { ".js": "text/javascript", ".css": "text/css", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".html": "text/html" };
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/page.css"><style>body{margin:0;background:#101317}</style></head><body><div id="root"></div><script src="/page.js"></script></body></html>`;
const external = [];
const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 1, timezoneId: "America/New_York", locale: "en-US" });
await context.route("**/*", route => {
  const url = new URL(route.request().url());
  if (url.host !== "fhfh.local") { external.push(url.href); return route.abort(); }
  if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
  // Site globals (box-sizing reset etc.) with remote Google Fonts imports removed.
  if (url.pathname === "/globals.css") return route.fulfill({ contentType: "text/css", body: readFileSync(join(web, "styles/globals.css"), "utf8").replace(/^@import url\([^)]*\);$/gm, "") });
  if (url.pathname === "/page.js" || url.pathname === "/page.css") return route.fulfill({ contentType: types[extname(url.pathname)], body: readFileSync(join(build, url.pathname)) });
  if (/^\/(fonts\/social-share|pictures)\/[\w.-]+$/.test(url.pathname)) return route.fulfill({ contentType: types[extname(url.pathname)] ?? "application/octet-stream", body: readFileSync(join(web, "public", url.pathname)) });
  return route.fulfill({ status: 404, body: "not served" });
});

const sha = buf => createHash("sha256").update(buf).digest("hex");
const pngSize = buf => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });
const fromDataUrl = url => Buffer.from(url.split(",")[1], "base64");

async function openStudio(run, viewport) {
  const page = await context.newPage();
  page.on("pageerror", error => console.error(`[${run.snapshot.format}] pageerror`, error.message));
  page.on("console", message => { if (message.type() === "error") console.error(`[${run.snapshot.format}] console`, message.text()); });
  if (viewport) await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date(run.clockAt));
  await page.route("**/api/v1/social-share/**", route => route.fulfill({ json: run.snapshot }));
  await page.goto(`http://fhfh.local/?format=${run.snapshot.format}&asOf=${encodeURIComponent(run.snapshot.generatedAt)}`);
  await page.waitForSelector("[data-testid=share-square]", { timeout: 15000 }).catch(async error => { console.error(await page.evaluate(() => document.body.innerText.slice(0, 1500))); throw error; });
  await page.evaluate(() => document.fonts.ready);
  if (run.focus) await page.locator("select").selectOption(String(run.focus));
  return page;
}

// Measures the fixed 1080 layout (undoing the preview scale) before stamping.
const measure = () => {
  const square = document.querySelector("[data-testid=share-square]");
  const box = square.getBoundingClientRect(), scale = box.width / 1080;
  const outside = [], unsafe = [], overflow = [];
  for (const el of square.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const rel = { left: (r.left - box.left) / scale, top: (r.top - box.top) / scale, right: (r.right - box.left) / scale, bottom: (r.bottom - box.top) / scale };
    const id = `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split("_")[1] : ""}: ${(el.textContent || "").trim().slice(0, 40)}`;
    if (rel.left < -0.5 || rel.top < -0.5 || rel.right > 1080.5 || rel.bottom > 1080.5) outside.push({ id, rel });
    else if (rel.left < 47.5 || rel.top < 47.5 || rel.right > 1032.5 || rel.bottom > 1032.5) unsafe.push({ id, rel });
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) overflow.push({ id, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
  }
  const families = ["Share Roboto Condensed", "Share Train One", "Share Martian Mono"];
  const smallest = Math.min(...[...square.querySelectorAll("*")].filter(el => el.childNodes[0]?.nodeType === 3).map(el => parseFloat(getComputedStyle(el).fontSize)));
  return { scale, outside, outsideSafeArea: unsafe, horizontalOverflow: overflow, fontsLoaded: Object.fromEntries(families.map(f => [f, document.fonts.check(`16px "${f}"`)])), smallestFontPx: smallest,
    watermark: square.querySelector("[class*=watermark]")?.textContent, status: document.querySelector("[aria-live=polite]")?.innerText };
};
const stamp = ({ label, id }) => {
  const square = document.querySelector("[data-testid=share-square]");
  for (const [edge, text] of [["top", `${label} · NOT CURRENT NHL DATA · NOT FOR POSTING`], ["bottom", `Local preview · edition ${id} · fictional matchups`]]) {
    const band = document.createElement("div");
    band.setAttribute("data-harness-stamp", edge);
    band.textContent = text;
    band.style.cssText = `position:absolute;left:0;right:0;${edge}:${edge === "top" ? 8 : 4}px;height:36px;display:flex;align-items:center;justify-content:center;background:#b3261e;color:#fff;font:700 22px "Share Roboto Condensed",sans-serif;letter-spacing:2px;z-index:10;`;
    square.appendChild(band);
  }
};

const manifest = { generatedBy: "tasks/artifacts/social-share-lane-2026-10-18/harness/render-previews.mjs", synthetic: true, fixtureWeek: WEEK_START,
  note: "Fictional matchups for mechanics review. Not NHL data, not a captured edition, not a recommendation, not cleared for posting.", checks, reasons, files: [] };
const record = (file, buf, extra) => { writeFileSync(join(outDir, file), buf); manifest.files.push({ file, sha256: sha(buf), ...pngSize(buf), ...extra }); };

for (const run of runs) {
  const page = await openStudio(run);
  const geometry = await page.evaluate(measure);
  const downloadButton = page.getByRole("button", { name: "Download PNG" });
  geometry.downloadEnabled = await downloadButton.isEnabled();
  await page.evaluate(stamp, { label: run.label, id: run.snapshot.id });
  const captures = [fromDataUrl(await page.evaluate(() => window.__capture())), fromDataUrl(await page.evaluate(() => window.__capture()))];
  const meta = { edition: run.snapshot.id, format: run.snapshot.format, state: run.snapshot.state, label: run.label, generatedAt: run.snapshot.generatedAt, checkedAt: run.snapshot.source.fetchedAt,
    providerUpdatedAt: run.snapshot.source.updatedAt, expiresAt: run.snapshot.expiresAt, renderClock: run.clockAt, selectedDates: run.snapshot.selectedDates, focusTeamId: run.focus ?? null,
    clientExpired: Date.parse(run.clockAt) >= Date.parse(run.snapshot.expiresAt), deterministicRepeat: sha(captures[0]) === sha(captures[1]), geometry };
  if (run.download) {
    const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
    const file = await download.path();
    const real = readFileSync(file);
    meta.realExport = { suggestedFilename: download.suggestedFilename(), sha256: sha(real), matchesHarnessCapture: sha(real) === sha(captures[0]) };
    record(`${run.name}.png`, real, { ...meta, path: "real downloadSharePng export" });
  } else {
    record(`${run.name}.png`, captures[0], { ...meta, path: "harness capture (export gate closed)" });
  }
  await page.close();
}

// Page-level views: mobile studio, feed-scale legibility and a blocked weekday format.
for (const [name, viewport] of [["studio-mobile-390", { width: 390, height: 844 }], ["studio-mobile-320", { width: 320, height: 700 }]]) {
  const page = await openStudio(runs[0], viewport);
  await page.evaluate(stamp, { label: runs[0].label, id: runs[0].snapshot.id });
  const buf = await page.screenshot({ fullPage: true });
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  record(`${name}.png`, buf, { path: "page screenshot", viewport, horizontalPageOverflowPx: pageOverflow, edition: runs[0].snapshot.id });
  await page.close();
}
{
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 390 });
  const exported = manifest.files.find(file => file.file === "weekly-top3.png");
  await page.setContent(`<body style="margin:0;background:#000"><img width="390" height="390" src="data:image/png;base64,${readFileSync(join(outDir, exported.file)).toString("base64")}"></body>`);
  record("weekly-top3-feed-390.png", await page.screenshot(), { path: "1080 export downscaled to a 390px feed width", smallestFontEffectivePx: +(exported.geometry.smallestFontPx * 390 / 1080).toFixed(1) });
  await page.close();
}
{
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(weekly.generatedAt));
  await page.goto(`http://fhfh.local/?format=tuesday-trends&asOf=${encodeURIComponent(weekly.generatedAt)}`);
  await page.getByText("Source qualification required").waitFor();
  record("tuesday-trends-blocked.png", await page.screenshot({ fullPage: true }), { path: "page screenshot", format: "tuesday-trends", state: "blocked", apiRequests: 0 });
  await page.close();
}
await browser.close();
manifest.externalRequestsBlocked = external;
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ outDir, checks, external: external.length, files: manifest.files.map(f => [f.file, f.width, f.height, f.state ?? "", f.deterministicRepeat ?? "", f.realExport?.matchesHarnessCapture ?? ""]) }, null, 1));
