// Phone band at 390x844: start, after "Per 60", after "On-ice". Usage: node phone-band.cjs <prefix>
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
  await installWigoFixtures(page);
  await page.goto(`http://127.0.0.1:${process.env.WIGO_PORT || 3150}/wigoCharts?playerId=${SUBJECT_ID}&tab=comparison`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const panel = page.locator('[data-coverage="C12"]');
  await panel.screenshot({ path: `screens/${process.argv[2]}-start-390.png` });
  for (const [name, file] of [["Per 60", "per60"], ["On-ice", "onice"]]) {
    await panel.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(900);
    await panel.screenshot({ path: `screens/${process.argv[2]}-${file}-390.png` });
  }
  await browser.close();
})();
