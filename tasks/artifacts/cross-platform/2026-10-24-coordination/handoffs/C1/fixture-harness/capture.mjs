// Usage: node capture.mjs <phase> ; drives :3110 with only 127.0.0.1 traffic allowed.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire("/Users/tim/Code/fhfhockey.com/web/package.json");
const { chromium } = require("@playwright/test");

const phase = process.argv[2] ?? "run";
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(dir, "shots", phase);
fs.mkdirSync(out, { recursive: true });
const LOG = path.join(dir, "stub-requests.log");
const BASE = "http://127.0.0.1:3110";
const tables = () => fs.readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => l.split(" ")[2]);

const report = [];
const browser = await chromium.launch();
const blocked = new Set();
const consoleErrors = new Set();
async function newPage(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" && !(u.port === "3110" && u.pathname.startsWith("/api/"))) return route.continue();
    blocked.add(`${u.hostname}${u.pathname.startsWith("/api/") ? u.pathname : ""}`);
    return route.abort();
  });
  // The dev error overlay reacts to aborted third-party calls; keep it out of the way and log errors instead.
  await ctx.addInitScript(() => {
    const st = document.createElement("style");
    st.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.add(`pageerror: ${String(e.message).slice(0, 160)}`));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.add(m.text().slice(0, 160)); });
  return page;
}
async function step(page, label, url, waitMs = 2500) {
  const before = tables().length;
  if (url) await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(waitMs);
  const reads = tables().slice(before);
  report.push({ label, reads: [...new Set(reads)].sort(), count: reads.length });
  return reads;
}

// Warm compile so read logs are not dominated by first-compile retries.
{
  const p = await newPage(1440);
  await p.goto(BASE + "/stats/team/EDM", { waitUntil: "load", timeout: 180000 });
  await p.waitForTimeout(3000);
  await p.close();
}

const desk = await newPage(1440);
await step(desk, "dashboard EDM (fresh load)", "/stats/team/EDM", 4000);
await desk.getByRole("button", { name: /Season Stats/ }).click();
await step(desk, "click Season Stats EDM", null, 2500);
await desk.screenshot({ path: path.join(out, "lines-EDM-1440.png"), fullPage: true });
await desk.getByRole("button", { name: /Shot Map/ }).click();
await step(desk, "click Shot Map EDM", null, 4000);
await desk.screenshot({ path: path.join(out, "shotmap-EDM-1440.png"), fullPage: true });
// Playoff-only filter: the fixture has exactly one playoff game per team.
const gameSel = desk.locator("#gameTypeFilter");
if (await gameSel.count()) {
  await gameSel.selectOption(["03"]);
  await step(desk, "Shot Map EDM playoffs only", null, 4000);
  const legendText = await desk.locator("body").innerText();
  report.push({ label: "playoff-only body excerpt", text: (legendText.match(/(Total|Events|Goals)[^\n]*\n?[^\n]*/g) ?? []).slice(0, 6) });
  await desk.screenshot({ path: path.join(out, "shotmap-EDM-playoffs-1440.png"), fullPage: true });
  await gameSel.selectOption([]);
  await step(desk, "Shot Map EDM no game types", null, 3000);
  await desk.screenshot({ path: path.join(out, "shotmap-EDM-empty-1440.png"), fullPage: true });
  report.push({ label: "filters visible in empty state", visible: await desk.locator("#gameTypeFilter").count() > 0, reset: await desk.getByRole("button", { name: /Reset filters/ }).count() });
}
await step(desk, "TOR 13F/5D lines (fresh load)", "/stats/team/TOR?tab=stats", 4000);
await desk.screenshot({ path: path.join(out, "lines-TOR-13F5D-1440.png"), fullPage: true });
report.push({ label: "TOR forward 13 shown", shown: await desk.getByText("Fixture Leafs 13", { exact: true }).count() });

const narrow = await newPage(390);
await step(narrow, "narrow EDM stats", "/stats/team/EDM?tab=stats", 4000);
await narrow.screenshot({ path: path.join(out, "lines-EDM-390.png"), fullPage: true });
await step(narrow, "narrow EDM shot map", "/stats/team/EDM?tab=visualization", 5000);
await narrow.screenshot({ path: path.join(out, "shotmap-EDM-390.png"), fullPage: true });
report.push({ label: "narrow horizontal overflow px", overflow: await narrow.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) });

report.push({ label: "console errors (deduped)", errors: [...consoleErrors].slice(0, 25) });
report.push({ label: "blocked non-local hosts", hosts: [...blocked].sort() });
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
