// Post-ship critique: computed sizes of a few elements at phone and 1920 (fixture only).
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tab] of [[390, 844, "Percentiles"], [390, 844, "Overview"], [1920, 1080, null], [1280, 800, null]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await installWigoFixtures(p);
    await p.goto(`http://127.0.0.1:3150/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
    if (tab) await p.getByRole("tab", { name: tab }).click().catch(() => p.getByRole("button", { name: tab }).click());
    await p.waitForTimeout(1500);
    const out = await p.evaluate(() => {
      const q = (sel) => { const el = document.querySelector(sel); if (!el) return null; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return `${s.fontSize} ${s.fontFamily.split(",")[0]} ls=${s.letterSpacing} w=${Math.round(r.width)}x${Math.round(r.height)}`; };
      return {
        radarContext: q('[class*="radarContext"]'),
        radarTitle: q('[class*="radarContext"]')?.toString() && (() => { const t = document.querySelector('[class*="radarContext"]').parentElement; return getComputedStyle(t.firstElementChild).fontSize + " " + t.firstElementChild.textContent.slice(0, 30); })(),
        perGameValue: q('[class*="valueCell"]') || q('[class*="perGame"] td:nth-child(2)'),
        driverValue: q('[class*="driverValue"], [class*="metricValue"]'),
        identity: q('[class*="playerName"], [class*="identityName"]'),
        ratingValue: q('[class*="ratingValue"]'),
        tileValue: q('[class*="productionValue"], [class*="tileValue"]'),
      };
    });
    console.log(`${w}x${h} ${tab || ""}`, JSON.stringify(out, null, 1));
    await p.close();
  }
  await b.close();
})();
