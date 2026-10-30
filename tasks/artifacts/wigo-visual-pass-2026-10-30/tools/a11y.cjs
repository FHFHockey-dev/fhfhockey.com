// Hand accessibility checks on fixture data (Axe is parked): tab order, focus visibility, names, contrast, touch targets.
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
const collect = () => {
  const root = document.querySelector('[class*="wigoDashHeader"]');
  const parse = c => { const m = c.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/); if (m) return [+m[1]*255,+m[2]*255,+m[3]*255,1]; const r = c.match(/[\d.]+/g).map(Number); return [r[0],r[1],r[2],r[3] ?? 1]; };
  const lum = ([r,g,b]) => { const f = v => { v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
  const bgOf = el => { let stack=[]; for (let e=el;e;e=e.parentElement){ const s=getComputedStyle(e); if (s.backgroundImage!=="none") stack.push("img"); const c=parse(s.backgroundColor); if(c[3]>0){stack.push(c); if(c[3]===1)break;} } let base=[0,0,0]; let img=false; for(const c of stack.reverse()){ if(c==="img"){img=true;continue;} base=[0,1,2].map(i=>c[i]*c[3]+base[i]*(1-c[3])); } return {base,img}; };
  const low = {};
  for (const el of root.querySelectorAll("*")) {
    const r = el.getBoundingClientRect(); if (!r.width||!r.height) continue;
    if (String(el.className).includes("visuallyHidden")||el.closest("details:not([open]) > :not(summary)")) continue;
    const t = Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(""); if(!t) continue;
    const s=getComputedStyle(el), {base,img}=bgOf(el), fg=parse(s.color);
    const a=lum(fg.slice(0,3).map((v,i)=>v*fg[3]+base[i]*(1-fg[3]))), b=lum(base); const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const op=parseFloat(s.opacity);
    if (ratio<4.5||op<1) { const key=`${s.color} on rgb(${base.map(Math.round)}) ${img?"(+gradient)":""} op=${op} ${ratio.toFixed(2)}:1`; (low[key]=low[key]||[]).push(t.slice(0,18)); }
  }
  const lowOut=Object.entries(low).map(([k,v])=>`${k} ×${v.length}: ${[...new Set(v)].slice(0,5).join(" | ")}`);
  const unnamed=[...root.querySelectorAll("button,input,select,summary,a[href],meter")].filter(e=>{const r=e.getBoundingClientRect();if(!r.width)return false;const n=e.getAttribute("aria-label")||e.textContent.trim()||(e.id&&document.querySelector(`label[for="${e.id}"]`));return !n;}).map(e=>e.tagName+"."+String(e.className).slice(0,30));
  const targets=[...root.querySelectorAll("button,input,select,summary,a[href]")].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.height<24||r.width<24)}).map(e=>{const r=e.getBoundingClientRect();return `${(e.getAttribute("aria-label")||e.textContent||e.tagName).trim().slice(0,22)} ${Math.round(r.width)}x${Math.round(r.height)}`});
  const heads=[...root.querySelectorAll("h1,h2,h3,h4")].filter(e=>e.getBoundingClientRect().width).map(e=>e.tagName+":"+e.textContent.trim().slice(0,26));
  return {low:lowOut,unnamed,targets,heads};
};
(async()=>{const b=await chromium.launch();
for(const [w,h,tab] of [[1280,800,""],[390,844,""],[390,844,"trends"],[390,844,"percentiles"],[390,844,"comparison"]]){
 const c=await b.newContext({viewport:{width:w,height:h}});const p=await c.newPage();await installWigoFixtures(p,()=>{});
 await p.goto(`http://127.0.0.1:3150/wigoCharts?playerId=${SUBJECT_ID}${tab?"&tab="+tab:""}`,{waitUntil:"networkidle"});await p.waitForTimeout(2200);
 const res=await p.evaluate(collect);console.log(`\n=== ${w}x${h} ${tab}`);console.log("HEADINGS",res.heads.join(" > "));console.log("LOW",res.low.join("\n    "));console.log("UNNAMED",res.unnamed);console.log("SMALL TARGETS",res.targets.length,res.targets.slice(0,16).join("; "));
 if(w===1280){ await p.locator('[class*="wigoDashHeader"] input').first().focus(); const seq=[]; let noRing=[]; for(let i=0;i<70;i++){const inf=await p.evaluate(()=>{const e=document.activeElement;if(!e||!e.closest('[class*="wigoDashHeader"]'))return null;const s=getComputedStyle(e);const panel=e.closest("[data-coverage]")?.dataset.coverage;return {n:(e.getAttribute("aria-label")||e.textContent||e.tagName).trim().slice(0,28),p:panel,ring:(s.outlineStyle!=="none"&&parseFloat(s.outlineWidth)>0)||s.boxShadow!=="none"||e.tagName==="INPUT"&&s.borderColor}});if(!inf)break;seq.push(`${inf.p}:${inf.n}`);if(!inf.ring)noRing.push(inf.n);await p.keyboard.press("Tab");await p.waitForTimeout(25);}
  const compact=seq.filter(x=>!/Show .* game log/.test(x));console.log("TAB ORDER (metric buttons omitted, count "+(seq.length-compact.length)+")",compact.join(" → "));console.log("NO FOCUS STYLE",[...new Set(noRing)].slice(0,20));}
 await c.close();}
await b.close();})();
