// Keyboard focus on the band header: Tab into the band, ArrowRight once, then crop the band. Usage: node focus-shot.cjs out.png
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
  await installWigoFixtures(page);
  await page.goto(`http://127.0.0.1:${process.env.WIGO_PORT || 3150}/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.locator('[data-coverage="C12"] thead button[tabindex="0"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const box = await page.locator('[data-coverage="C12"]').boundingBox();
  await page.screenshot({ path: process.argv[2], clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  await browser.close();
})();
