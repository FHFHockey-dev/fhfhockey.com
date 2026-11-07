// Pass B redo: measure rating box sizes per viewport (fixture only).
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tab] of [[1280, 800], [1440, 900], [1920, 1080], [390, 844, "Percentiles"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await installWigoFixtures(p);
    await p.goto(`http://127.0.0.1:3150/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
    if (tab) await p.getByRole("tab", { name: tab }).click().catch(() => p.getByRole("button", { name: tab }).click());
    await p.waitForTimeout(1200);
    console.log(`${w}x${h}`, JSON.stringify(await p.evaluate(() => {
      const r = el => { const x = el.getBoundingClientRect(); return `${Math.round(x.width)}x${Math.round(x.height)}`; };
      const box = document.querySelector('[class*="ratingBox"]'); const root = document.querySelector('[class*="ratingsRoot"]');
      return { root: root && r(root), box: box && r(box), section: root && r(root.firstElementChild) };
    })));
    await p.close();
  }
  await b.close();
})();
