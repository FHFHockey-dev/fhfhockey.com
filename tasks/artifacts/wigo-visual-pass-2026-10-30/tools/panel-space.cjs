// Per-panel: panel height, chart (canvas/svg) height, share of the panel the chart gets. Fixture-only.
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async()=>{const b=await chromium.launch();for(const[w,h]of[[1280,800],[1440,900]]){const p=await (await b.newContext({viewport:{width:w,height:h}})).newPage();await installWigoFixtures(p,()=>{});
await p.goto(`http://127.0.0.1:${process.env.WIGO_PORT||3150}/wigoCharts?playerId=${SUBJECT_ID}`,{waitUntil:"networkidle"});await p.waitForTimeout(2500);
const r=await p.evaluate(()=>["C13","C16","C17","C18","C14","C15"].map(id=>{const e=document.querySelector(`[data-coverage="${id}"]`);const c=[...e.querySelectorAll("canvas,svg.recharts-surface")].map(x=>x.getBoundingClientRect()).sort((a,b)=>b.height-a.height)[0];const pr=e.getBoundingClientRect();return `${id} panel ${Math.round(pr.height)} chart ${c?Math.round(c.height):0} (${c?Math.round(c.height/pr.height*100):0}%)`}));console.log(w,r.join(" | "));}await b.close()})();
