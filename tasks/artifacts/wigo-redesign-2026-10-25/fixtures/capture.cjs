// Usage: node capture.cjs <label> [widthxheight ...]
// Captures viewport-only screenshots of /wigoCharts on :3150 with fixture data, plus layout measurements.
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const fs = require("node:fs");
const path = require("node:path");
const { installWigoFixtures, SUBJECT_ID } = require("./wigo-fixtures.cjs");

const label = process.argv[2] ?? "before";
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ["1440x900", "1280x800", "1024x768", "390x844"]).map(s => s.split("x").map(Number));
const outDir = path.join(__dirname, "..", "screenshots", label);
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const log = [];
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text().slice(0, 200)); });
    await installWigoFixtures(page, entry => log.push(entry));
    await page.goto(`http://127.0.0.1:3150/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.locator('[data-coverage="C19"] meter').first().waitFor({ timeout: 45000 }).catch(() => errors.push("C19 meters not rendered in 45s"));
    await page.waitForTimeout(2500);
    await page.mouse.move(0, 0);
    const measure = await page.evaluate(() => {
      const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const panels = Array.from(document.querySelectorAll("[data-coverage]")).filter(visible).map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.dataset.coverage, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), outside: r.bottom > innerHeight + 1 || r.right > innerWidth + 1 };
      });
      const overflowing = Array.from(document.querySelectorAll("main *, [class*=wigo] *")).filter(el => visible(el) && !String(el.className).includes("visuallyHidden") && !el.closest("details:not([open])") && getComputedStyle(el).display !== "inline" && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && !["HTML", "BODY"].includes(el.tagName)).length;
      const small = Array.from(document.querySelectorAll("[class*=wigo] *")).filter(el => visible(el) && Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11).length;
      return { doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], panels, overflowing, smallTextUnder11: small };
    });
    report[`${width}x${height}`] = { ...measure, errors: errors.slice(0, 20), requests: log.length, denied: log.filter(e => e.kind === "deny" || e.kind === "blocked-write"), localApi: log.filter(e => e.kind === "local-api"), tables: [...new Set(log.filter(e => e.kind === "rest" || e.kind === "rpc").map(e => e.table ?? e.name))] };
    await page.screenshot({ path: path.join(outDir, `${label}-${width}x${height}.png`) });
    if (process.env.FULL) await page.screenshot({ path: path.join(outDir, `${label}-${width}x${height}-full.png`), fullPage: true });
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-measurements.json`), JSON.stringify(report, null, 2));
  for (const [size, r] of Object.entries(report)) console.log(size, "doc", r.doc.join("x"), "panels", r.panels.length, "outside", r.panels.filter(p => p.outside).map(p => p.id).join(" "), "overflow", r.overflowing, "small", r.smallTextUnder11, "errors", r.errors.length, "denied", r.denied.length);
})();
