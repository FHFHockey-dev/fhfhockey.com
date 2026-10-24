import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire("/Users/tim/Code/fhfhockey.com/web/package.json");
const { chromium } = require("@playwright/test");
const out = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-s06r1", "after");
const browser = await chromium.launch();
for (const width of [320, 390]) for (const team of ["BUF", "MTL", "TOR", "BOS"]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.route("**/*", (r) => { const u = new URL(r.request().url()); return u.hostname === "127.0.0.1" && !(u.port === "3110" && u.pathname.startsWith("/api/")) ? r.continue() : r.abort(); });
  await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }));
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:3110/stats/team/${team}?tab=stats`, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  const label = team === "BUF" || team === "MTL" ? "Extra D" : "Extra F";
  const extra = page.locator(`[role="group"][aria-label^="${label}"]`);
  await extra.scrollIntoViewIfNeeded();
  await page.locator('[class*="lineCombinationsColumn"]').first().screenshot({ path: path.join(out, `${team}-lines-${width}-extras-visible.png`) });
  console.log(team, width, await extra.getAttribute("aria-label"), await extra.isVisible());
  await ctx.close();
}
await browser.close();
