// Rate percentile slot worst case at 1280: a second chip and every tile sparse. Usage: node pct-worst.cjs out.png
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
  await installWigoFixtures(page);
  await page.goto(`http://127.0.0.1:${process.env.WIGO_PORT || 3150}/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const chips = document.querySelector('[data-coverage="C19"] [class*="thresholdChips"]');
    const chip = chips.firstElementChild.cloneNode(true); chip.firstChild.textContent = "GP 7 below min 10"; chips.appendChild(chip);
    for (const tile of document.querySelectorAll('[data-coverage="C19"] [class*="percentileTile"]')) { tile.querySelector("strong").textContent = "—"; tile.querySelector("small").textContent = ""; tile.querySelector("meter").value = 0; }
  });
  const box = await page.locator('[data-coverage="C19"]').boundingBox();
  await page.screenshot({ path: process.argv[2], clip: box });
  await browser.close();
})();
