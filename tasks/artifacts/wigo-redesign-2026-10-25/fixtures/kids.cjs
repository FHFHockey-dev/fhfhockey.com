const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("./wigo-fixtures.cjs");
(async () => {
  const [size, selector] = process.argv.slice(2);
  const [width, height] = size.split("x").map(Number);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await installWigoFixtures(page, () => {}, { longName: process.env.LONGNAME === "1" });
  await page.goto(`http://127.0.0.1:3150/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  console.log(await page.locator(selector).first().evaluate(root => {
    const out = [];
    const walk = (e, d) => { if (d > 4) return; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); out.push(`${"  ".repeat(d)}${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0].replace(/^\w+_/, "").replace(/__\w+$/, "")} ${Math.round(r.height)}h scroll${e.scrollHeight} pad ${cs.padding} margin ${cs.margin}`); for (const c of e.children) walk(c, d + 1); };
    walk(root, 0); return out.join("\n");
  }));
  await browser.close();
})();
