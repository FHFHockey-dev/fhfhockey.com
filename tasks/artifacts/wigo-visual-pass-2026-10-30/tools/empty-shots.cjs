// No-player state at desktop and phone, fixture-only. Usage: node empty-shots.cjs <label>
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async()=>{const b=await chromium.launch();
for(const [w,h,tab] of [[1280,800,""],[390,844,""],[390,844,"trends"]]){const p=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:w<500?2:1})).newPage();await installWigoFixtures(p,()=>{});
await p.goto(`http://127.0.0.1:3150/wigoCharts${tab?"?tab="+tab:""}`,{waitUntil:"networkidle",timeout:90000});await p.waitForTimeout(1500);
const texts=await p.evaluate(()=>{const c={};const walk=document.createTreeWalker(document.querySelector('[class*="wigoDashHeader"]'),NodeFilter.SHOW_TEXT);let n;while((n=walk.nextNode())){const t=n.textContent.trim();if(/select|search for|no game log|please/i.test(t)&&n.parentElement.getBoundingClientRect().width){const s=getComputedStyle(n.parentElement);const k=`${t} [${parseFloat(s.fontSize)}/${s.fontWeight}/${s.fontStyle}/${s.color}]`;c[k]=(c[k]||0)+1;}}return c});console.log(w,tab,JSON.stringify(texts));
if(w<500) await p.evaluate(()=>{for(const el of document.querySelectorAll("nav, div, footer")){const st=getComputedStyle(el);if(st.position==="fixed"&&st.bottom==="0px")el.style.display="none";}});
await p.screenshot({path:`../screens/${process.argv[2]}-${w}x${h}${tab?"-"+tab:""}.png`,fullPage:w<500});}
await b.close();})();
