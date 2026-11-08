const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("./wigo-fixtures.cjs");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const log = [];
  page.on("console", m => { if (/percent|Percentile|error/i.test(m.text())) log.push("console: " + m.text().slice(0, 300)); });
  await installWigoFixtures(page, e => { if (/percentile|totals/.test(e.table ?? "")) log.push(JSON.stringify(e)); });
  await page.goto(`http://127.0.0.1:3150/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(8000);
  console.log(log.join("\n"));
  console.log((await page.locator('[data-coverage="C19"]').innerText()).slice(0, 600));
  await browser.close();
})();
