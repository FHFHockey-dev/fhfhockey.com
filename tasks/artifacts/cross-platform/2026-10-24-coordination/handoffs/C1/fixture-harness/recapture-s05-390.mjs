// Re-captures S05 narrow states at 390px with the chart below any fixed chrome, and
// hit-tests what covers the chart. Fixture-only: /api/cors answered here, others aborted.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire("/Users/tim/Code/fhfhockey.com/web/package.json");
const { chromium } = require("@playwright/test");
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(dir, "shots-s05", "r1");
fs.mkdirSync(out, { recursive: true });

const TEAMS = ["ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH"];
const rowsFor = (teams) => teams.flatMap((team, t) => Array.from({ length: 12 }, (_, g) => {
  const starter = g % 4 !== 3;
  return { gameId: 2025020001 + t * 20 + g, gameDate: `2025-10-${String(8 + g).padStart(2, "0")}`, teamAbbrev: team,
    playerId: 8470000 + t * 10 + (starter ? 1 : 2), goalieFullName: `${team} ${starter ? "Starter" : "Backup"}`,
    gamesPlayed: 1, wins: g % 2, losses: 1 - (g % 2), otLosses: 0, saves: 27, shotsAgainst: 30, goalsAgainst: 3, timeOnIce: 3600 };
}));

const report = [];
const browser = await chromium.launch();
async function open(scenario) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const state = { failing: !!scenario.failFirstRun };
  const rows = rowsFor(scenario.teams);
  await ctx.route("**/*", (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === "127.0.0.1" && u.port === "3110" && u.pathname === "/api/cors") {
      const t = new URL(u.searchParams.get("url"));
      if (t.pathname.endsWith("/season")) return r.fulfill({ json: { data: [{ id: 20252026 }] } });
      const start = Number(t.searchParams.get("start"));
      if (state.failing && start === 100) return r.fulfill({ status: 429, json: { message: "fixture 429" } });
      return r.fulfill({ json: { total: rows.length, data: rows.slice(start, start + 100) } });
    }
    if (u.hostname === "127.0.0.1" && !(u.port === "3110" && u.pathname.startsWith("/api/"))) return r.continue();
    return r.abort();
  });
  await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s);
  }));
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:3110/stats", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(4500);
  return { page, state, close: () => ctx.close() };
}

// Fixed/sticky chrome, then scroll the chart so it starts just below the top chrome.
async function placeAndProbe(page, label) {
  const info = await page.evaluate(() => {
    const chart = document.querySelector('section[aria-labelledby="goalie-share-heading"] [class*="goalieShareChart"]');
    const describe = (el) => el ? `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className).split(" ").map((c) => c.replace(/__.*$/, "")).filter(Boolean).join(".")}` : null;
    const chrome = Array.from(document.querySelectorAll("body *")).filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (cs.position === "fixed" || cs.position === "sticky") && r.width >= innerWidth * 0.8 && r.height > 20 && cs.visibility !== "hidden" && cs.display !== "none";
    }).map((el) => ({ el: describe(el), position: getComputedStyle(el).position, top: Math.round(el.getBoundingClientRect().top), height: Math.round(el.getBoundingClientRect().height), inChart: chart?.contains(el) ?? false }));
    return { chrome };
  });
  // Sticky chrome only sticks once scrolled, so settle iteratively: put the chart's top
  // just below the lowest stuck/fixed bar that starts in the upper half of the viewport.
  let topChrome = 0;
  for (let i = 0; i < 5; i++) {
    await page.evaluate((offset) => {
      const chart = document.querySelector('section[aria-labelledby="goalie-share-heading"] [class*="goalieShareChart"]');
      window.scrollTo(0, window.scrollY + chart.getBoundingClientRect().top - offset - 8);
    }, topChrome);
    await page.waitForTimeout(400);
    const next = await page.evaluate(() => {
      const chart = document.querySelector('section[aria-labelledby="goalie-share-heading"] [class*="goalieShareChart"]');
      return Array.from(document.querySelectorAll("body *")).filter((el) => {
        const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        return (cs.position === "fixed" || cs.position === "sticky") && !chart.contains(el) && r.width >= innerWidth * 0.8 && r.height > 20 && r.top < innerHeight / 2 && r.bottom > 0;
      }).reduce((m, el) => Math.max(m, Math.round(el.getBoundingClientRect().bottom)), 0);
    });
    if (next === topChrome) break;
    topChrome = next;
  }
  const probe = await page.evaluate(() => {
    const chart = document.querySelector('section[aria-labelledby="goalie-share-heading"] [class*="goalieShareChart"]');
    const describe = (el) => el ? `${el.tagName.toLowerCase()}.${String(el.className).split(" ").map((c) => c.replace(/__.*$/, "")).filter(Boolean).join(".")}` : null;
    const r = chart.getBoundingClientRect();
    const covered = [];
    for (let y = Math.max(0, r.top + 4); y < Math.min(innerHeight, r.bottom); y += 24) {
      for (const x of [r.left + 8, r.left + r.width / 2, r.right - 8]) {
        const hit = document.elementFromPoint(x, y);
        if (hit && !chart.contains(hit)) covered.push({ x: Math.round(x), y: Math.round(y), by: describe(hit.closest("header, nav, [class*='Header'], [class*='header'], [class*='Nav'], [class*='nav']") ?? hit) });
      }
    }
    const select = chart.querySelector("select");
    const logo = chart.querySelector("img");
    return {
      chartTop: Math.round(r.top), chartBottom: Math.round(r.bottom),
      coveredPoints: covered.length,
      coveredBy: [...new Set(covered.map((c) => c.by))],
      coveredYRange: covered.length ? [covered[0].y, covered[covered.length - 1].y] : null,
      selectValue: select?.value ?? null,
      teamHeader: logo?.alt ?? null,
      alert: chart.querySelector('[role="alert"]')?.textContent ?? null,
      retry: Array.from(chart.querySelectorAll("button")).some((b) => b.textContent === "Try again"),
      charts: chart.querySelectorAll("canvas").length
    };
  });
  report.push({ label, chromeAtLoad: info.chrome, stuckChromeBottomAfterScroll: topChrome, ...probe });
  await page.screenshot({ path: path.join(out, `${label}-viewport.png`) });
}

{
  const { page, close } = await open({ teams: TEAMS.filter((t) => t !== "ANA") });
  await placeAndProbe(page, "no-ANA-390");
  await close();
}
{
  const { page, state, close } = await open({ teams: TEAMS, failFirstRun: true });
  await placeAndProbe(page, "withheld-390");
  state.failing = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await page.waitForTimeout(4000);
  await placeAndProbe(page, "after-retry-390");
  await close();
}
// The original element-screenshot method, to show where the band came from.
{
  const { page, close } = await open({ teams: TEAMS.filter((t) => t !== "ANA") });
  const section = page.locator('section[aria-labelledby="goalie-share-heading"]');
  await section.scrollIntoViewIfNeeded();
  const r = await page.evaluate(() => {
    const s = document.querySelector('section[aria-labelledby="goalie-share-heading"]').getBoundingClientRect();
    const hit = document.elementFromPoint(s.left + s.width / 2, Math.max(1, s.top + 10));
    return { sectionTopInViewport: Math.round(s.top), hitAtSectionTop: hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).split(" ").map((c) => c.replace(/__.*$/, "")).join(".")}` : null };
  });
  report.push({ label: "old-method-scrollIntoViewIfNeeded", ...r });
  await close();
}
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
