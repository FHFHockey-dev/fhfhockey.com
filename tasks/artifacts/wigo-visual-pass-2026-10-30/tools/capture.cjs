// Fixture-only capture + DOM measurement of /wigoCharts. Reuses the fictional fixtures from wigo-redesign (read-only).
// Usage: node capture.cjs <label> [--measure] [--tab=<tab>] [widthxheight ...]   Output: ../screens/<label>-<WxH>[-tab].png
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const fs = require("node:fs");
const path = require("node:path");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");

const args = process.argv.slice(2);
const label = args[0];
const measureOn = args.includes("--measure");
const tab = (args.find(a => a.startsWith("--tab=")) || "").slice(6);
const sizes = args.slice(1).filter(a => /^\d+x\d+$/.test(a)).map(s => s.split("x").map(Number));
const port = process.env.WIGO_PORT || 3150;
const outDir = path.join(__dirname, "..", "screens");
fs.mkdirSync(outDir, { recursive: true });

const measureFn = () => {
  const root = document.querySelector('[class*="wigoDashHeader"]');
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const hidden = el => String(el.className).includes("visuallyHidden") || !!el.closest("details:not([open]) > *:not(summary)");
  const all = Array.from(root.querySelectorAll("*")).filter(el => visible(el) && !hidden(el));
  const tally = (m, k) => { m[k] = (m[k] || 0) + 1; };
  const sortd = m => Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
  const summarize = els => {
    const type = {}, colors = {}, radii = {}, bg = {}, borders = {};
    let controls = 0, text = 0, chars = 0; const ctl = {};
    for (const el of els) {
      const s = getComputedStyle(el);
      if (el.matches("button,input,select,textarea,a[href],summary")) { controls++; tally(ctl, el.tagName.toLowerCase()); }
      const t = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
      if (t) { text++; chars += t.length; tally(type, `${parseFloat(s.fontSize)}/${s.fontWeight}`); tally(colors, s.color); }
      if (s.borderTopLeftRadius !== "0px") tally(radii, s.borderTopLeftRadius);
      if (s.backgroundColor !== "rgba(0, 0, 0, 0)") tally(bg, s.backgroundColor);
      if (parseFloat(s.borderTopWidth) > 0) tally(borders, s.borderTopColor);
    }
    return { nodes: els.length, controls, controlKinds: ctl, textNodes: text, chars, type: sortd(type), colors: sortd(colors), radii: sortd(radii), backgrounds: sortd(bg), borders: sortd(borders) };
  };
  const areas = {};
  for (const panel of root.querySelectorAll("[data-coverage]")) {
    if (!visible(panel)) continue;
    const r = panel.getBoundingClientRect();
    const key = panel.dataset.coverage;
    const inside = all.filter(el => panel.contains(el));
    const texts = Array.from(new Set(inside.flatMap(el => Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean)))).filter(t => /[a-zA-Z]{3,}/.test(t)).slice(0, 14);
    areas[key] = { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], ...summarize(inside), sampleText: texts };
    delete areas[key].backgrounds; delete areas[key].borders;
  }
  return { doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], rootTop: Math.round(root.getBoundingClientRect().top), page: summarize(all), areas };
};

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 500 ? 2 : 1, hasTouch: width < 500 });
    const page = await context.newPage();
    const log = [], errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await installWigoFixtures(page, e => log.push(e));
    const tabq = tab ? `&tab=${tab}` : "";
    await page.goto(`http://127.0.0.1:${port}/wigoCharts?playerId=${SUBJECT_ID}${tabq}`, { waitUntil: "networkidle", timeout: 180000 });
    if (width > 768) await page.locator('[data-coverage="C19"] meter').first().waitFor({ timeout: 45000 }).catch(() => errors.push("no C19 meters"));
    await page.waitForTimeout(2500);
    await page.mouse.move(0, 0);
    // Phone full-page shots only: the site's fixed bottom nav would land mid-image and hide content there.
    if (width < 500) await page.evaluate(() => { for (const el of document.querySelectorAll("nav, div, footer")) { const st = getComputedStyle(el); if (st.position === "fixed" && st.bottom === "0px") el.style.display = "none"; } });
    const suffix = `${width}x${height}${tab ? "-" + tab : ""}`;
    await page.screenshot({ path: path.join(outDir, `${label}-${suffix}.png`), fullPage: width < 500 });
    const blocked = log.filter(e => e.kind === "deny" || e.kind === "blocked-write");
    report[suffix] = { errors, blocked: blocked.length, ...(measureOn ? await page.evaluate(measureFn) : {}) };
    if (errors.length) console.log(errors.join("\n").slice(0,400)); console.log(suffix, "doc", report[suffix].doc?.join("x") ?? "", "errors", errors.length, "denied/blocked", blocked.length);
    await context.close();
  }
  await browser.close();
  if (measureOn) fs.writeFileSync(path.join(outDir, `${label}-measurements${tab ? "-" + tab : ""}.json`), JSON.stringify(report, null, 1));
})();
