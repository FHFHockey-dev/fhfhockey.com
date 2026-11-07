// Band width budget at one viewport, as rendered and with +999% in every DIFF cell. Usage: node band-width.cjs 1280x800
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async () => {
  const [w, h] = (process.argv[2] || "1280x800").split("x").map(Number);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  await installWigoFixtures(page);
  await page.goto(`http://127.0.0.1:${process.env.WIGO_PORT || 3150}/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const read = () => page.evaluate(() => {
    const band = document.querySelector('[class*="matrixBand"]'); const table = band.querySelector("table");
    const cs = getComputedStyle(table.querySelector("td"));
    return { client: band.clientWidth, scroll: band.scrollWidth, table: Math.round(table.getBoundingClientRect().width), pad: cs.paddingLeft, font: cs.fontSize, rowH: Math.round(table.querySelector("tbody tr").getBoundingClientRect().height), tableH: Math.round(table.getBoundingClientRect().height) };
  });
  console.log("as rendered", JSON.stringify(await read()));
  await page.evaluate(() => { for (const c of document.querySelectorAll('[data-coverage="C12"] tbody tr:last-child td')) c.textContent = "+999%"; });
  console.log("+999% DIFF", JSON.stringify(await read()));
  await browser.close();
})();
