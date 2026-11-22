// Offline Chromium replay of the Nov 21 captured production responses on the deployed Rankings page code.
// Makes zero production requests: matrix, Trending and comparison come from live/*.json, metadata from the
// local handler, season is stubbed, and every non-loopback browser request is aborted.
// Run from the repository root: node tasks/artifacts/rankings-verify-2026-11-21/replay.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";

const folder = dirname(fileURLToPath(import.meta.url));
const repo = resolve(folder, "../../..");
const require = createRequire(join(repo, "web/package.json"));
const { chromium } = require("playwright");
const esbuild = require("esbuild");
const sass = require("sass");
const deployed = "f47905d28718f6910d7acfa1471517c0235775de";
const live = name => JSON.parse(readFileSync(join(folder, "live", name)));
const captured = { matrix: live("1-matrix.json"), trending: live("2-trending-cold1.json"), comparison: live("4-comparison.json") };
const capturedQuery = Object.fromEntries(readFileSync(join(folder, "live/requests.jsonl"), "utf8").trim().split("\n")
  .map(l => JSON.parse(l)).map(r => [r.name.replace(/-(cold|warm)\d$/, ""), new URL("http://x" + r.path).searchParams]));

const temp = mkdtempSync(join(tmpdir(), "fhfh-rankings-replay-"));
const archive = join(temp, "web.tar");
execFileSync("git", ["archive", "-o", archive, deployed, ...["lib", "pages/rankings.tsx", "pages/api/v1/contextual-rankings",
  "components", "hooks", "contexts", "utils", "styles", "package.json", "tsconfig.json"].map(p => "web/" + p)], { cwd: repo });
execFileSync("tar", ["xf", archive, "-C", temp]);
const web = join(temp, "web");
symlinkSync(join(repo, "web/node_modules"), join(web, "node_modules"));
copyFileSync(join(repo, "tasks/artifacts/rankings-current-season-2026-11-18/trending/browser-page.tsx"), join(web, "browser-page.tsx"));
const settings = { absWorkingDir: web, bundle: true, minify: true, logLevel: "silent", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' } };
await esbuild.build({ ...settings, entryPoints: ["browser-page.tsx"], outfile: "app.js", platform: "browser",
  plugins: [{ name: "sass", setup(build) {
    build.onResolve({ filter: /^next\/router$/ }, () => ({ path: "router", namespace: "local-router" }));
    build.onLoad({ filter: /.*/, namespace: "local-router" }, () => ({ resolveDir: web,
      contents: 'import {useContext} from "react"; import {RouterContext} from "next/dist/shared/lib/router-context.shared-runtime"; export const useRouter=()=>useContext(RouterContext);' }));
    build.onLoad({ filter: /\.scss$/ }, ({ path }) => ({
      contents: sass.compile(path, { loadPaths: [web], logger: sass.Logger.silent }).css, loader: "local-css" }));
  } }] });
await esbuild.build({ ...settings, entryPoints: ["pages/api/v1/contextual-rankings/metadata.ts"], outfile: "metadata.cjs", platform: "node", packages: "external" });
const metadata = require(join(web, "metadata.cjs")).default;
const js = readFileSync(join(web, "app.js"));
const css = Buffer.concat([Buffer.from(execFileSync("git", ["show", deployed + ":web/styles/globals.css"], { cwd: repo, encoding: "utf8" })
  .replace(/^@import .*$/gm, "")), readFileSync(join(web, "app.css"))]);

const calls = [], failed = [], blockedImages = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const json = body => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
  if (url.pathname === "/rankings") { res.setHeader("Content-Type", "text/html");
    return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/app.css"></head><body><main id="root"></main><script src="/app.js"></script></body></html>'); }
  if (url.pathname === "/app.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(js); }
  if (url.pathname === "/app.css") { res.setHeader("Content-Type", "text/css"); return res.end(css); }
  if (/^\/(pictures|teamLogos)\/[\w.-]+\.(svg|png|webp|jpg)$/.test(url.pathname)) {
    try { const body = execFileSync("git", ["show", deployed + ":web/public" + url.pathname], { cwd: repo, maxBuffer: 1e7, stdio: ["ignore", "pipe", "ignore"] });
      const ext = url.pathname.split(".").at(-1); res.setHeader("Content-Type", "image/" + ({ svg: "svg+xml", jpg: "jpeg" }[ext] || ext)); return res.end(body);
    } catch { res.statusCode = 404; return res.end(); }
  }
  const route = url.pathname.split("/").at(-1);
  calls.push(route + url.search);
  if (url.pathname === "/api/v1/season") return json({ seasonId: 20262027 });
  if (route === "metadata") return metadata({ method: "GET", query: {} }, { status() { return this; }, setHeader() {}, json });
  if (captured[route]) {
    const want = capturedQuery[route];
    for (const [k, v] of want) if (url.searchParams.get(k) !== v) failed.push(`${route} param ${k}=${url.searchParams.get(k)} expected ${v}`);
    return json(captured[route]);
  }
  failed.push("Unexpected route " + url.pathname); res.statusCode = 404; res.end();
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ args: ["--disable-background-networking"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: "block" });
await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue()
  : ((route.request().resourceType() === "image" ? blockedImages : failed).push("External request blocked " + route.request().url()), route.abort("blockedbyclient")));
const page = await context.newPage();
page.on("pageerror", e => failed.push(String(e)));
await page.goto(origin + "/rankings", { waitUntil: "domcontentloaded" });

// 1. Default Rankings: served date label and comparison opportunity evidence.
const dateLabel = page.getByText("Dataset snapshot", { exact: true }).locator("..").locator("strong");
await page.waitForFunction(() => /2026/.test(document.body.innerText), null, { timeout: 20000 });
await page.waitForTimeout(500);
const servedLabel = await dateLabel.innerText();
const drawer = page.locator('[aria-controls="rankings-snapshot-drawer"]');
if (await drawer.count()) await drawer.first().click();
const cards = page.locator('[aria-label="Comparison context"] article');
await cards.nth(5).waitFor({ state: "visible", timeout: 15000 });
const trendRows = captured.trending.rows;
await page.waitForTimeout(500);
const rendered = await cards.evaluateAll(nodes => nodes.map(card => {
  const dt = [...card.querySelectorAll("dt")].find(el => el.textContent === "Opportunity Evidence");
  return { player: card.querySelector("h3")?.innerText, evidence: dt?.nextElementSibling?.innerText };
}));
const comparisonIds = capturedQuery.comparison.get("player_ids").split(",").map(Number);
const expectedCards = comparisonIds.map(id => {
  const row = trendRows.find(r => r.entity.id === id);
  if (!row) return "No live opportunity-change signal in the current trending sample.";
  const s = row.opportunitySignals[0];
  return s ? `${s.label}: ${s.evidence}` : "Trending sample found, but no material opportunity-change signal.";
});
assert.equal(rendered.length, 6, "six comparison cards");
assert.deepEqual(rendered.map(c => c.evidence), expectedCards, "comparison opportunity evidence");

// 2. Trending tab: 25 ordered rows, names, signal titles.
await page.getByRole("navigation", { name: "Rankings views" }).getByRole("button", { name: "Trending", exact: true }).click();
await page.waitForFunction(() => document.querySelectorAll('[aria-label="Trending players"] tbody tr').length === 25, null, { timeout: 15000 });
const visible = await page.locator('[aria-label="Trending players"] tbody tr').evaluateAll(list => list.map(tr => ({
  player: tr.querySelector("td strong").textContent, signals: [...tr.querySelectorAll("[title]")].map(el => el.title) })));
assert.deepEqual(visible.map(v => v.player), trendRows.map(r => r.entity.name ?? `Player ${r.entity.id}`), "ordered Trending names");
assert.deepEqual(visible.map(v => v.signals.filter(t => trendRows.some(r => r.opportunitySignals.some(s => s.evidence === t)))),
  trendRows.map(r => r.opportunitySignals.slice(0, 3).map(s => s.evidence)), "Trending signal explanations");
const trendingText = await page.locator('[aria-label="Trending players"]').innerText();
const chromiumVersion = browser.version();
await browser.close(); server.close();
assert.deepEqual(failed, [], "no failures or external requests");

const receipt = { deployedSha: deployed, chromium: chromiumVersion, servedDateLabel: servedLabel,
  matrixSnapshotDate: captured.matrix.meta.snapshotDate, trendingSnapshotDates: captured.trending.meta.snapshotDates,
  trendingDatesShown: [...new Set(trendingText.match(/[A-Z][a-z]{2} \d{1,2}, 2026/g) ?? [])],
  comparison: rendered.map((c, i) => ({ id: comparisonIds[i], ...c })),
  trending: visible.map((v, i) => ({ rank: i + 1, id: trendRows[i].entity.id, ...v })),
  signalBadges: visible.reduce((n, v) => n + v.signals.length, 0),
  calls, blockedExternalImages: blockedImages.length, parityKey: createHash("sha256").update(JSON.stringify({ rendered, visible })).digest("hex") };
writeFileSync(join(folder, "replay-receipt.json"), JSON.stringify(receipt, null, 1));
console.log("PASS", servedLabel, receipt.trendingDatesShown, "badges", receipt.signalBadges, "cards", rendered.map(c => c.evidence.slice(0, 40)));
