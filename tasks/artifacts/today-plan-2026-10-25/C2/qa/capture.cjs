// C2 offline capture: studio screenshots, real exported PNGs, text-geometry measurements.
// Usage: node capture.cjs <outDir>
const fs = require("fs"), path = require("path");
process.env.PLAYWRIGHT_BROWSERS_PATH = "/Users/tim/Code/fhfhockey.com/web/.ms-playwright";
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const BASE = "http://127.0.0.1:3140";
const out = path.resolve(process.argv[2]); fs.mkdirSync(out, { recursive: true });
const KAPRIZOV = "8478864";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000, dsf: 1 },
  { name: "390", width: 390, height: 844, dsf: 3 },
  { name: "320", width: 320, height: 640, dsf: 2 },
];
const HERO_CASES = [
  { name: "undefined-pp-day", flow: { mode: "calendar", start: "2026-10-01", end: "2026-10-01", strength: "pp" } },
  { name: "partial-unknown-pool", scenario: "unknown-pool" },
  { name: "worst-warnings-long-range", flow: { playerId: 1004, mode: "calendar", start: "2026-10-01", end: "2026-10-23", strength: "pp" }, scenario: "metric-gap" },
  { name: "long-inline-notice", flow: { playerId: 1004, strength: "pp" }, scenario: "metric-gap" },
  { name: "stacked-notice-fulln-short", flow: { playerId: 1004, fullN: true }, previewOnly: true },
  { name: "fulln-5v5-range", flow: { mode: "calendar", start: "2026-10-02", end: "2026-10-23", strength: "5v5", fullN: true } },
];

async function block(context) {
  await context.route("**/*", route => route.request().url().startsWith(BASE) ? route.continue() : route.abort());
}
async function measure(page) {
  return page.evaluate(() => {
    const svg = document.querySelector("svg[data-share-format]");
    const box = svg.getBoundingClientRect(), unit = box.width / 1200;
    const texts = [...svg.querySelectorAll("text")].filter(t => t.textContent.trim()).map(t => {
      const r = t.getBoundingClientRect();
      return { text: t.textContent.trim().slice(0, 90), svgFont: parseFloat(getComputedStyle(t).fontSize), cssPx: +(parseFloat(getComputedStyle(t).fontSize) * unit * (t.closest("svg[viewBox='0 0 1200 1020']") ? 1 : 1)).toFixed(2),
        x0: (r.left - box.left) / unit, x1: (r.right - box.left) / unit, y0: (r.top - box.top) / unit, y1: (r.bottom - box.top) / unit };
    });
    const overlaps = [];
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ox > 1 && oy > 3) overlaps.push({ a: a.text, b: b.text, ox: +ox.toFixed(1), oy: +oy.toFixed(1) });
    }
    const outOfBounds = texts.filter(t => t.x0 < 30 || t.x1 > 1170).map(t => ({ text: t.text, x0: +t.x0.toFixed(1), x1: +t.x1.toFixed(1) }));
    return { cardCssWidth: box.width, unit, overlaps, outOfBounds, texts };
  });
}
async function unpin(page) {
  await page.evaluate(() => document.querySelectorAll("body *").forEach(el => { const p = getComputedStyle(el).position; if (p === "fixed" || p === "sticky") el.style.position = "static"; }));
}
async function waitCard(page) { await page.waitForSelector("svg[data-share-format] image[data-hero-image]", { timeout: 120000 }); await page.waitForTimeout(400); }
async function downloadVia(page, clicker, file) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), clicker()]);
  await dl.saveAs(path.join(out, file)); return file;
}

(async () => {
  const browser = await chromium.launch();
  const report = { studio: {}, hero: {}, pngs: [] };
  for (const vp of process.env.ONLY_HERO ? [] : VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, acceptDownloads: true });
    await block(context);
    const page = await context.newPage();
    await page.goto(`${BASE}/c2-harness`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.selectOption("select[aria-label='Reviewed artwork']", KAPRIZOV);
    for (const format of ["landscape", "social-square"]) {
      await page.selectOption("select[aria-label='Image format']", format);
      for (const scenario of ["complete", "metric-gap", "history-gap"]) {
        if (format === "social-square" && scenario === "history-gap") continue;
        await page.selectOption("select[aria-label='Statistics preview']", scenario);
        await waitCard(page); await unpin(page);
        const name = `studio-${vp.name}-${format}-${scenario}`;
        await page.locator("section[aria-label='Player card preview']").screenshot({ path: path.join(out, `${name}-card.png`) });
        if (vp.name !== "desktop" && format === "landscape" && scenario === "complete") await page.screenshot({ path: path.join(out, `${name}-page.png`), fullPage: true });
        report.studio[name] = await measure(page);
        if (vp.name === "desktop" && scenario !== "history-gap") {
          report.pngs.push(await downloadVia(page, () => page.click("button:has-text('Download PNG')"), `export-studio-${format}-${scenario}.png`));
        }
      }
    }
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await block(context);
  const page = await context.newPage();
  for (const c of HERO_CASES) for (const format of ["landscape", "social-square"]) {
    const q = new URLSearchParams({ mode: "hero", player: KAPRIZOV, format, name: `${c.name}-${format}`, scenario: c.scenario || "complete", flow: JSON.stringify(c.flow || {}) });
    await page.goto(`${BASE}/c2-harness?${q}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await waitCard(page);
    report.hero[`${c.name}-${format}`] = await measure(page);
    if (c.previewOnly) { await unpin(page); await page.locator("section[aria-label='Player card preview']").screenshot({ path: path.join(out, `preview-hero-${c.name}-${format}.png`) }); continue; }
    report.pngs.push(await downloadVia(page, () => page.click("button[data-export]"), `export-hero-${c.name}-${format}.png`));
  }
  // Phone-size view of every real PNG: the exported file shown at 366 CSS px (390 viewport minus gutters), DPR 3.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const pp = await phone.newPage();
  for (const file of report.pngs) {
    const data = fs.readFileSync(path.join(out, file)).toString("base64");
    await pp.setContent(`<body style="margin:12px;background:#000"><img id=i style="width:366px;display:block" src="data:image/png;base64,${data}"></body>`);
    await pp.locator("#i").screenshot({ path: path.join(out, `phoneview-${file}`) });
  }
  await browser.close();
  fs.writeFileSync(path.join(out, "measurements.json"), JSON.stringify(report, null, 1));
  const summary = Object.entries({ ...report.studio, ...report.hero }).map(([k, m]) => `${k}: card ${m.cardCssWidth.toFixed(0)}px, overlaps ${m.overlaps.length}, outOfBounds ${m.outOfBounds.length}, min footer/label cssPx ${Math.min(...m.texts.map(t => t.cssPx))}`);
  fs.writeFileSync(path.join(out, "summary.txt"), summary.join("\n") + "\n");
  console.log(summary.join("\n")); console.log("pngs", report.pngs.length);
})().catch(e => { console.error(e); process.exit(1); });
