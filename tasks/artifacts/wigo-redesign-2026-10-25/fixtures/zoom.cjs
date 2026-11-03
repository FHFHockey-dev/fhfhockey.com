// node zoom.cjs WxH selector out.png — element screenshot plus its subtree overflow report
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("./wigo-fixtures.cjs");
(async () => {
  const [size, selector, out] = process.argv.slice(2);
  const [width, height] = size.split("x").map(Number);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await installWigoFixtures(page);
  await page.goto(`http://127.0.0.1:3150/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.locator('[data-coverage="C19"] meter').first().waitFor({ timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const el = page.locator(selector).first();
  await el.screenshot({ path: out });
  console.log(JSON.stringify(await el.evaluate(root => Array.from(root.querySelectorAll("*")).filter(e => (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) && getComputedStyle(e).display !== "inline").map(e => ({ c: String(e.className).slice(0, 60), t: (e.innerText || "").slice(0, 30), client: [e.clientWidth, e.clientHeight], scroll: [e.scrollWidth, e.scrollHeight] })))));
  await browser.close();
})();
