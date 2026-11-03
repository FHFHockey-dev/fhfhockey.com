// Metric Game Log for one count and one rate at 1280x800. Usage: node gamelog-shots.cjs <label-prefix>
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
  await installWigoFixtures(page);
  await page.goto(`http://127.0.0.1:${process.env.WIGO_PORT || 3150}/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  for (const [name, file] of [["Goals", "goals"], ["Shots per 60", "sog60"]]) {
    await page.locator('[data-coverage="C12"]').getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(1500);
    await page.mouse.move(0, 0);
    await page.locator("#wigo-selected-stat").screenshot({ path: `screens/${process.argv[2]}-${file}-1280.png` });
  }
  await browser.close();
})();
