const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("./wigo-fixtures.cjs");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Number(process.argv[2] || 1280), height: Number(process.argv[3] || 800) } });
  const errors = [];
  page.on("pageerror", e => errors.push("PAGEERROR " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  await installWigoFixtures(page);
  await page.goto(`http://127.0.0.1:3150/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  console.log(errors.join("\n") || "no errors");
  console.log((await page.locator("body").innerText()).slice(0, 300));
  await browser.close();
})();
