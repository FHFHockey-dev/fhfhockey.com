// Usage: node capture-s06r1.mjs <phase>; team Season Stats lines + Shot Map on :3110 against pgrst-stub.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire("/Users/tim/Code/fhfhockey.com/web/package.json");
const { chromium } = require("@playwright/test");

const phase = process.argv[2] ?? "run";
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(dir, "shots-s06r1", phase);
fs.mkdirSync(out, { recursive: true });
const BASE = "http://127.0.0.1:3110";
const report = [];
const browser = await chromium.launch();

async function newPage(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" && !(u.port === "3110" && u.pathname.startsWith("/api/"))) return route.continue();
    return route.abort();
  });
  await ctx.addInitScript(() => {
    const st = document.createElement("style");
    st.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
  });
  return { page: await ctx.newPage(), close: () => ctx.close() };
}

{ const { page, close } = await newPage(1440); await page.goto(BASE + "/stats/team/TOR?tab=stats", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(3000); await close(); }

for (const width of [320, 390, 1024, 1440]) {
  for (const team of ["TOR", "BOS", "BUF", "MTL", "EDM"]) {
    const { page, close } = await newPage(width);
    await page.goto(`${BASE}/stats/team/${team}?tab=stats`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(3000);
    const m = await page.evaluate(() => {
      const cards = (el) => el ? Array.from(el.querySelectorAll("a")).map((a) => a.textContent.replace(/\s+/g, " ").trim()) : [];
      const group = (name) => document.querySelector(`[role="group"][aria-label="${name}"]`);
      const extras = Array.from(document.querySelectorAll('[role="group"][aria-label^="Extra"]')).map((g) => ({ label: g.getAttribute("aria-label"), cards: cards(g) }));
      const lines = document.querySelector('[class*="lineCombinationsFixedHeight"]');
      return {
        docOverflowPx: document.documentElement.scrollWidth - window.innerWidth,
        linesPanelScrolls: lines ? lines.scrollHeight > lines.clientHeight : null,
        forwards: cards(group("Forwards")).length, defense: cards(group("Defense")).length, goalies: cards(group("Goalies")).length,
        extras
      };
    });
    report.push({ label: `${team}-lines-${width}`, ...m });
    const panel = page.locator('[class*="lineCombinationsColumn"]');
    if (await panel.count()) await panel.first().screenshot({ path: path.join(out, `${team}-lines-${width}.png`) });
    else await page.screenshot({ path: path.join(out, `${team}-lines-${width}.png`), fullPage: true });
    await close();
  }
  const { page, close } = await newPage(width);
  await page.goto(`${BASE}/stats/team/EDM?tab=visualization`, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(4000);
  report.push({ label: `EDM-shotmap-${width}`, docOverflowPx: await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) });
  await page.screenshot({ path: path.join(out, `EDM-shotmap-${width}.png`), fullPage: true });
  await close();
}
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
