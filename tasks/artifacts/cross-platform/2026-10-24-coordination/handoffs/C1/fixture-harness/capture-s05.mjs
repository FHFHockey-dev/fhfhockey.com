// Usage: node capture-s05.mjs <phase>; drives /stats on :3110. Only 127.0.0.1 traffic
// reaches a server; /api/cors goalie/season calls are answered from fixtures here.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire("/Users/tim/Code/fhfhockey.com/web/package.json");
const { chromium } = require("@playwright/test");

const phase = process.argv[2] ?? "run";
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(dir, "shots-s05", phase);
fs.mkdirSync(out, { recursive: true });
const BASE = "http://127.0.0.1:3110";

const TEAMS = ["ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH"];
function goalieRows(teams) {
  const rows = [];
  teams.forEach((team, t) => {
    for (let g = 0; g < 12; g++) {
      const starter = g % 4 !== 3;
      rows.push({ gameId: 2025020001 + t * 20 + g, gameDate: `2025-10-${String(8 + g).padStart(2, "0")}`, teamAbbrev: team,
        playerId: 8470000 + t * 10 + (starter ? 1 : 2), goalieFullName: `${team} ${starter ? "Starter" : "Backup"}`,
        gamesPlayed: 1, wins: g % 2, losses: 1 - (g % 2), otLosses: 0, saves: 27, shotsAgainst: 30, goalsAgainst: 3, timeOnIce: 3600 });
    }
  });
  return rows;
}

const report = [];
const browser = await chromium.launch();
async function newPage(width, scenario) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const state = { failing: scenario.failFirstRun, goalieCalls: 0 };
  const rows = goalieRows(scenario.teams);
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" && u.port === "3110" && u.pathname === "/api/cors") {
      const target = new URL(u.searchParams.get("url"));
      if (target.pathname.endsWith("/season")) return route.fulfill({ json: { data: [{ id: 20252026 }] } });
      if (target.pathname.endsWith("/goalie/summary")) {
        state.goalieCalls++;
        const start = Number(target.searchParams.get("start"));
        if (state.failing && start === 100) return route.fulfill({ status: 429, json: { message: "fixture 429" } });
        return route.fulfill({ json: { total: rows.length, data: rows.slice(start, start + 100) } });
      }
      return route.fulfill({ status: 503, json: { success: false, message: "fixture: blocked" } });
    }
    if (u.hostname === "127.0.0.1" && !(u.port === "3110" && u.pathname.startsWith("/api/"))) return route.continue();
    return route.abort();
  });
  await ctx.addInitScript(() => {
    const st = document.createElement("style");
    st.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
  });
  const page = await ctx.newPage();
  return { page, state, close: () => ctx.close() };
}
async function measure(page, label) {
  const section = page.locator('section[aria-labelledby="goalie-share-heading"]');
  await section.scrollIntoViewIfNeeded();
  const m = await page.evaluate(() => {
    const s = document.querySelector('section[aria-labelledby="goalie-share-heading"]');
    const chart = s?.querySelector('[class*="goalieShareChart"]');
    const select = s?.querySelector("select");
    return {
      docOverflowPx: document.documentElement.scrollWidth - window.innerWidth,
      sectionOverflowPx: s ? s.scrollWidth - s.clientWidth : null,
      chartOverflowPx: chart ? chart.scrollWidth - chart.clientWidth : null,
      chartRightEdgeBeyondViewportPx: chart ? Math.round(chart.getBoundingClientRect().right - window.innerWidth) : null,
      charts: s ? s.querySelectorAll("canvas").length : 0,
      selectValue: select ? select.value : null,
      alert: s?.querySelector('[role="alert"]')?.textContent ?? null,
      retryButtons: s ? Array.from(s.querySelectorAll("button")).filter((b) => b.textContent === "Try again").length : 0
    };
  });
  report.push({ label, ...m });
  await section.screenshot({ path: path.join(out, `${label}.png`) });
}

// Warm compile.
{ const { page, close } = await newPage(1440, { teams: TEAMS }); await page.goto(BASE + "/stats", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(3000); await close(); }

for (const width of [320, 390, 1024, 1440]) {
  const { page, close } = await newPage(width, { teams: TEAMS });
  await page.goto(BASE + "/stats", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(3500);
  await measure(page, `all-teams-${width}`);
  await close();
}
// Selected team: season start where ANA (alphabetical default) has no appearances yet.
{
  const { page, close } = await newPage(390, { teams: TEAMS.filter((t) => t !== "ANA") });
  await page.goto(BASE + "/stats", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(3500);
  await measure(page, "no-ANA-390");
  await close();
}
// Recovery: page at start=100 is rate-limited for the first run.
for (const width of [390, 1440]) {
  const { page, state, close } = await newPage(width, { teams: TEAMS, failFirstRun: true });
  await page.goto(BASE + "/stats", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(5000);
  await measure(page, `withheld-${width}`);
  const callsAfterFailure = state.goalieCalls;
  state.failing = false;
  const retry = page.getByRole("button", { name: "Try again" });
  if (await retry.count()) {
    await retry.click();
    await page.waitForTimeout(4000);
    await measure(page, `after-retry-${width}`);
  }
  report.push({ label: `goalie page calls ${width}`, untilFailure: callsAfterFailure, total: state.goalieCalls });
  await close();
}
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
