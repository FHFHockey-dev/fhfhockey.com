const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("./wigo-fixtures.cjs");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const urls = [];
  page.on("request", r => { const u = new URL(r.url()); if (/rest\/v1\/(wgo_skater_stats|games|nst_team|wgo_team|rpc)/.test(u.pathname)) urls.push(decodeURIComponent(u.pathname.split("/rest/v1/")[1] + "?" + u.search.slice(1)).slice(0, 260)); });
  const log = [];
  await installWigoFixtures(page, e => log.push(e));
  await page.goto(`http://127.0.0.1:3150/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);
  console.log(urls.join("\n"));
  console.log(JSON.stringify(log.filter(e => /wgo_skater_stats$|games|team|rpc/.test(e.table ?? e.name ?? ""))));
  for (const id of ["C14", "C17", "C18", "C08 C09 C10 C11"]) console.log(id, (await page.locator(`[data-coverage="${id}"]`).innerText()).replace(/\s+/g, " ").slice(0, 160));
  await browser.close();
})();
