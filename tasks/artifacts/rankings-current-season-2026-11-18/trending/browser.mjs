// From any directory: node /path/to/trending/browser.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { checkComparisonStates } from "./browser-comparison-states.mjs";

const folder = dirname(fileURLToPath(import.meta.url));
const repo = resolve(folder, "../../../..");
const require = createRequire(join(repo, "web/package.json"));
const { chromium } = require("playwright");
const esbuild = require("esbuild");
const sass = require("sass");
const hash = value => createHash("sha256").update(value).digest("hex");
const old = "83750b4abd672399113659b96c279a1ddaeb425b";
const candidate = "50dea27b84a34b05a1aa6e67dc24d2774e5d3f24";
const expected = JSON.parse(readFileSync(join(folder, "before-rows.json")));
const reps = Number(process.env.BROWSER_BENCH_REPS || 5);
const statesOnly = process.argv.includes("--comparison-states");
const pinned = Date.parse("2026-11-17T23:00:00Z");
const temp = mkdtempSync(join(tmpdir(), "fhfh-ranking-browser-"));
const browser = await chromium.launch({ args: ["--disable-background-networking"] });
const receipt = { chromium: browser.version(), node: process.version, reps, cutoff: "2026-11-17",
  fixtureSha256: hash(readFileSync(join(folder, "fixture.mjs"))), runs: [] };

async function setup(sha) {
  const archive = join(temp, "web.tar");
  execFileSync("git", ["archive", "-o", archive, sha, ...["lib", "pages/rankings.tsx", "pages/api/v1/contextual-rankings",
    "components", "hooks", "contexts", "utils", "styles", "package.json", "tsconfig.json"].map(p => "web/" + p)], { cwd: repo });
  const out = mkdtempSync(join(temp, "version-"));
  execFileSync("tar", ["xf", archive, "-C", out]);
  const web = join(out, "web");
  symlinkSync(join(repo, "web/node_modules"), join(web, "node_modules"));
  for (const file of ["browser-api.ts", "browser-page.tsx", "fixture.mjs"]) copyFileSync(join(folder, file), join(web, file));
  if (statesOnly) execFileSync("patch", ["-p0", "-i", join(folder, "browser-comparison-inputs.patch")], { cwd: web });
  const settings = { absWorkingDir: web, bundle: true, minify: true, logLevel: "silent", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' } };
  await esbuild.build({ ...settings, entryPoints: ["browser-page.tsx"], outfile: "app.js", platform: "browser",
    plugins: [{ name: "sass", setup(build) {
      build.onResolve({ filter: /^next\/router$/ }, () => ({ path: "router", namespace: "local-router" }));
      build.onLoad({ filter: /.*/, namespace: "local-router" }, () => ({ resolveDir: web,
        contents: 'import {useContext} from "react"; import {RouterContext} from "next/dist/shared/lib/router-context.shared-runtime"; export const useRouter=()=>useContext(RouterContext);' }));
      build.onLoad({ filter: /\.scss$/ }, ({ path }) => ({
        contents: sass.compile(path, { loadPaths: [web], logger: sass.Logger.silent }).css, loader: "local-css",
      }));
    } }] });
  writeFileSync(join(web, "pinned-date.mjs"),
    `export const PinnedDate = class extends globalThis.Date { constructor(...a){super(...(a.length?a:[${pinned}]))} static now(){return ${pinned}} }`);
  await esbuild.build({ ...settings, define: { ...settings.define, Date: "PinnedDate" }, inject: [join(web,"pinned-date.mjs")], entryPoints: ["browser-api.ts"], outfile: "server.cjs", platform: "node",
    plugins: [{ name: "offline-query", setup(build) {
      build.onResolve({ filter: /^lib\/supabase\/server$/ }, () => ({ path: "data", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ resolveDir: web,
        contents: 'import {query} from "./fixture.mjs"; export const supabase={from:query}; export default supabase; export const getServiceRoleClient=()=>supabase;' }));
    } }] });
  return { web, api: require(join(web, "server.cjs")), js: readFileSync(join(web, "app.js")), css: readFileSync(join(web, "app.css")) };
}

globalThis.fetch = async input => { throw Error("Unexpected server fetch " + input); };

async function measure(sha) {
  const { api, js, css: moduleStyles } = await setup(sha);
  const globalStyles = execFileSync("git", ["show", sha + ":web/styles/globals.css"], { cwd: repo, encoding: "utf8" })
    .replace(/^@import .*$/gm, "");
  const css = Buffer.concat([Buffer.from(globalStyles), moduleStyles]);
  const images = new Map();
  const calls = [], failed = [];
  const rows = {};
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/rankings") {
        res.setHeader("Content-Type", "text/html");
        return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/app.css"></head><body><main id="root"></main><script src="/app.js"></script></body></html>');
      }
      if (url.pathname === "/app.js" || url.pathname === "/app.css") {
        res.setHeader("Content-Type", url.pathname.endsWith("js") ? "text/javascript" : "text/css");
        return res.end(url.pathname.endsWith("js") ? js : css);
      }
      if (/^\/(pictures|teamLogos)\/[\w.-]+\.(svg|png|webp|jpg)$/.test(url.pathname)) {
        // The fixture teams use synthetic abbreviations; trigger the page's normal fallback.
        if (/^\/teamLogos\/T\d+\.png$/.test(url.pathname)) { res.statusCode = 404; return res.end(); }
        if (!images.has(url.pathname)) images.set(url.pathname, execFileSync("git", ["show", sha + ":web/public" + url.pathname], { cwd: repo, maxBuffer: 10_000_000 }));
        const ext = url.pathname.split(".").at(-1);
        res.setHeader("Content-Type", "image/" + ({ svg: "svg+xml", jpg:"jpeg" }[ext] || ext));
        return res.end(images.get(url.pathname));
      }
      const route = url.pathname.split("/").at(-1);
      assert.ok(url.pathname.startsWith("/api/v1/") && (route === "season" || api.routes[route]), "Unknown route " + url.pathname);
      const call = { route, ms: null }; calls.push(call);
      const start = performance.now();
      const finish = payload => {
        if (["matrix", "comparison", "trending"].includes(route)) rows[route] = payload;
        call.ms = Math.round(performance.now() - start);
        res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(payload));
      };
      if (route === "season") return finish({ seasonId: 20262027 });
      await api.routes[route]({ method: "GET", query: Object.fromEntries(url.searchParams) }, {
        status(code) { assert.equal(code, 200, route); return this; }, setHeader() {}, json: finish,
      });
    } catch (e) { failed.push(String(e)); res.statusCode = 500; res.end(String(e)); }
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  const samples = [];
  async function open(query) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: "block" });
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      failed.push("External browser request " + route.request().url()); return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("pageerror", e => failed.push(String(e)));
    await page.addInitScript(value => {
      const NativeDate = Date;
      globalThis.Date = class extends NativeDate {
        constructor(...a) { super(...(a.length ? a : [value])); }
        static now() { return value; }
      };
    }, pinned);
    await page.goto(origin + "/rankings" + query, { waitUntil: "domcontentloaded" });
    return { page, context };
  }
  const drawer = '[aria-controls="rankings-snapshot-drawer"]';
  const tab = (p, name) => p.getByRole("navigation", { name: "Rankings views" }).getByRole("button", { name, exact: true });
  async function click(page, locator) {
    // Time the browser's actual click dispatch, after Playwright's actionability wait.
    await locator.evaluate(el => el.addEventListener("click", () => performance.mark("click"), { once: true, capture: true }));
    await locator.click();
  }
  async function observed(page, kind, mark) {
    await page.waitForFunction(kind => {
      const shown = e => e && e.checkVisibility() && e.getBoundingClientRect().height > 0;
      if (kind === "trending") {
        const all = [...document.querySelectorAll('[aria-label="Trending players"] tbody tr td:first-child strong')];
        return all.length === 25 && all.every(e => shown(e) && e.textContent.trim());
      }
      const all = [...document.querySelectorAll('[aria-label="Comparison context"] article')];
      return document.querySelector('[aria-controls="rankings-snapshot-drawer"]')?.getAttribute("aria-expanded") === "true" &&
        all.length === 6 && all.every(a => [...a.querySelectorAll("dt")].some(dt => dt.textContent === "Opportunity Evidence" &&
          shown(dt.nextElementSibling) && /^(TOI Up|Usage Drop|Shot Volume Spike):/.test(dt.nextElementSibling.textContent)));
    }, kind, { timeout: 20000 });
    // Cross a paint opportunity after the laid-out content satisfies the gate.
    return page.evaluate(async mark => {
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      return Math.round((performance.now() - performance.getEntriesByName(mark).at(-1).startTime) * 10) / 10;
    }, mark);
  }
  async function record(page, name, mark, from, rep) {
    const kind = name.split(".")[0], ms = await observed(page, kind, mark);
    assert.deepEqual(failed, []);
    assert.deepEqual(rows.trending.rows, expected.apiRows);
    if (kind === "comparison") {
      assert.equal(rows.matrix.meta.totalRankedRows, 750);
      assert.equal(rows.matrix.meta.rankingSource, "entity_metric_rankings");
      assert.equal(rows.matrix.meta.snapshotDate, "2026-11-17");
      for (const row of [...rows.matrix.rows, ...rows.comparison.subjects.map(s => s.row)]) {
        assert.equal(row.composite.snapshotDate, "2026-11-17");
        assert.equal(row.composite.methodologyVersion, "contextual_composites_v3");
        assert.equal(row.composite.mcmScore, 90 - (row.entity.id - 8470000) % 70);
      }
      const subjects = await page.locator('[aria-label="Comparison context"] article').evaluateAll(list =>
        list.map(a => ({ subject: a.querySelector("h3").textContent,
          evidence: [...a.querySelectorAll("dt")].find(dt => dt.textContent === "Opportunity Evidence").nextElementSibling.textContent })));
      assert.deepEqual(subjects.map((s,i) => ({ id: rows.comparison.subjects[i].row.entity.id, ...s })), expected.comparison);
    } else {
      const visible = await page.locator('[aria-label="Trending players"] tbody tr').evaluateAll(list =>
        list.map(tr => ({ player: tr.querySelector("td strong").textContent, cells: [...tr.querySelectorAll("td")].map(td => td.textContent),
          signals: [...tr.querySelectorAll("[title]")].map(el => el.title) })));
      assert.deepEqual(visible.map((r,i) => ({ id: rows.trending.rows[i].entity.id, ...r })), expected.trending);
    }
    if (rep) samples.push({ name, rep, ms, requests: calls.slice(from) });
  }
  try {
    if (statesOnly) {
      api.reset();
      const { page, context } = await open("");
      try {
        const states = await checkComparisonStates(page, rows, drawer, tab);
        assert.deepEqual(failed, []);
        return { sha, browserJsSha256: hash(js), cssSha256: hash(css), states };
      } finally { await context.close(); }
    }
    for (let rep = 0; rep <= reps; rep++) {
      for (const temperature of ["cold", "warm-server"]) {
        if (temperature === "cold") api.reset();
        const from = calls.length;
        const { page, context } = await open("");
        await page.locator(drawer).click();
        await record(page, "comparison." + temperature, "mount", from, rep);
        if (temperature === "warm-server") {
          let from = calls.length;
          await click(page, tab(page,"Trending")); await record(page,"trending.warm-client","click",from,rep);
          from = calls.length;
          await click(page, tab(page,"Rankings"));
          if ((await page.locator(drawer).getAttribute("aria-expanded")) !== "true") await page.locator(drawer).click();
          await record(page,"comparison.warm-client","click",from,rep);
        }
        await context.close();
      }
      for (const temperature of ["cold", "warm-server"]) {
        if (temperature === "cold") api.reset();
        const { page, context } = await open("?tab=war");
        await page.locator('[aria-label="Wins Above Replacement status"] article').first().waitFor();
        const from = calls.length;
        await click(page,tab(page,"Trending")); await record(page,"trending." + temperature,"click",from,rep);
        await context.close();
      }
    }
    return { sha, browserJsSha256: hash(js), cssSha256: hash(css), orderedParitySha256: hash(JSON.stringify(expected)), samples };
  } catch(error) { console.error({ failed, calls: calls.slice(-8) }); throw error; }
  finally { await new Promise(r => server.close(r)); }
}
try {
  for (const sha of [old, candidate]) { receipt.runs.push(await measure(sha)); }
  assert.equal(receipt.runs[0].browserJsSha256, receipt.runs[1].browserJsSha256);
  assert.equal(receipt.runs[0].cssSha256, receipt.runs[1].cssSha256);
  if (statesOnly) {
    assert.deepEqual(receipt.runs[0].states, receipt.runs[1].states);
    delete receipt.reps;
    receipt.inputPatchSha256 = hash(readFileSync(join(folder, "browser-comparison-inputs.patch")));
  }
  writeFileSync(join(folder, statesOnly ? "browser-comparison-results.json" : "browser-samples.json"), JSON.stringify(receipt,null,2)+"\n");
} finally { await browser.close(); rmSync(temp, { recursive: true, force: true }); }
