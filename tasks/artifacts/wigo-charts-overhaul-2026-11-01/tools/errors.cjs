// Prints page errors and console errors with stacks for one viewport. Usage: node errors.cjs 1280x800 [tab]
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async () => {
  const [w, h] = (process.argv[2] || "1280x800").split("x").map(Number);
  const tab = process.argv[3] ? `&tab=${process.argv[3]}` : "";
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  page.on("pageerror", e => console.log("PAGEERROR", e.stack?.slice(0, 1500)));
  page.on("console", m => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 600)); });
  await installWigoFixtures(page);
  await page.goto(`http://127.0.0.1:${process.env.WIGO_PORT || 3150}/wigoCharts?playerId=${SUBJECT_ID}${tab}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.mouse.move(0, 0);
  await page.mouse.move(w / 2, h - 100);
  await page.mouse.move(w - 200, h - 100);
  await page.waitForTimeout(800);
  await browser.close();
})();
