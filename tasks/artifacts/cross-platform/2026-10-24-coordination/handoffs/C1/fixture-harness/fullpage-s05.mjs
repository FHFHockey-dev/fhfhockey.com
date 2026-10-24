import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire("/Users/tim/Code/fhfhockey.com/web/package.json");
const { chromium } = require("@playwright/test");
const phase = process.argv[2];
const out = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-s05", phase);
const browser = await chromium.launch();
for (const width of [320, 390, 1024, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.route("**/*", (r) => { const u = new URL(r.request().url()); if (u.pathname === "/api/cors") { const t = new URL(u.searchParams.get("url")); return t.pathname.endsWith("/season") ? r.fulfill({ json: { data: [{ id: 20252026 }] } }) : r.fulfill({ json: { total: 0, data: [] } }); } return u.hostname === "127.0.0.1" && !(u.port === "3110" && u.pathname.startsWith("/api/")) ? r.continue() : r.abort(); });
  await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }));
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:3110/stats", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  const cols = await page.evaluate(() => getComputedStyle(document.getElementById("main-content")).gridTemplateColumns);
  console.log(width, "mainLayout columns:", cols, "docOverflow", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await page.screenshot({ path: path.join(out, `stats-fullpage-${width}.png`), fullPage: true });
  await ctx.close();
}
await browser.close();
