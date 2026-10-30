// Opens each help note at 1280x800 and saves a screenshot. Usage: node help-shots.cjs <prefix>
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();await installWigoFixtures(p,()=>{});
await p.goto(`http://127.0.0.1:3150/wigoCharts?playerId=${SUBJECT_ID}`,{waitUntil:"networkidle",timeout:60000});await p.waitForTimeout(2200);
const n=await p.locator('[class*="wigoDashboardContent"] [popovertarget]').count();console.log("help buttons",n);
for(let i=0;i<n;i++){const s=p.locator('[class*="wigoDashboardContent"] [popovertarget]').nth(i);await s.click({timeout:5000});await p.waitForTimeout(200);await p.screenshot({path:`../screens/${process.argv[2]}-${i}.png`});await p.keyboard.press("Escape");}
await b.close();})();
