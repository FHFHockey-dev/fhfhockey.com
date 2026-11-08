import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../web/package.json'));
const {chromium}=require('@playwright/test'),sharp=require('sharp'),sha=b=>createHash('sha256').update(b).digest('hex');
const supplied=JSON.parse(await readFile(path.join(here,'retained-blsh-current-box-inputs.json'),'utf8'));
const requests=[],errors=[],checks=[];
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true,timeout:10000});
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1050}});
 await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(here,'preview.html')).href);
 const svg=page.locator('svg[data-analysis-key]');await svg.waitFor();
 async function download(label,file){const [e]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:label,exact:true}).click()]);await e.saveAs(path.join(here,file));return readFile(path.join(here,file));}
 for(const [selection,id,expected] of [['retained',8476453,'5 match / 0 differ / 0 unknown'],['retained-sasson',8484136,'3 match / 1 differ / 1 unknown']]){
  await page.getByLabel('Player',{exact:true}).selectOption(selection);
  await page.getByLabel('Analysis view',{exact:true}).selectOption('evidence');
  const details=page.getByLabel('Readable card details');
  assert.ok((await svg.textContent()).includes(expected));assert.match(await svg.textContent(),/Box TOI \+ 5 counts/);
  assert.match(await svg.textContent(),/Stale research/);assert.match(await svg.textContent(),/saved values unchanged/);
  assert.equal(await svg.locator('[data-evidence-truncated="true"]').count(),0,'Full research evidence must fit');
  const footer=await svg.locator('text').evaluateAll(nodes=>nodes.filter(n=>n.getAttribute('y')==='922').map(n=>{const b=n.getBBox();return {right:b.x+b.width,bottom:b.y+b.height,text:n.textContent};}));
  assert.ok(footer.length===1&&footer[0].right<=1160,JSON.stringify(footer));
  if(id===8476453){assert.match(await details.innerText(),/5\/5 rows have later-attached/);assert.match(await svg.textContent(),/PPP 2 unknown/);}
  else{assert.match(await details.innerText(),/G differs: WGO 1, box 0/);assert.match(await details.innerText(),/A differs: WGO 0, box 1/);assert.match(await details.innerText(),/SOG differs: WGO 3, box 2/);assert.match(await details.innerText(),/no pinned box/);}
  const png=await download('Download analysis PNG',`current-box-${id}-20261101.png`);
  const manifest=JSON.parse(await download('Download analysis manifest',`current-box-${id}-manifest-20261101.json`));
  const research=manifest.presentation.blsh.retained,boxes=research.currentBoxes;
  assert.deepEqual(research.profile,supplied[String(id)].profile);assert.deepEqual(boxes.evidence.rows,supplied[String(id)].currentBoxes.rows);
  assert.equal(boxes.currentBinding,false);assert.equal(boxes.state,'reviewed-comparison-only');assert.equal(research.provenance.currentBinding,false);assert.equal(research.provenance.captureStale,true);assert.equal(manifest.presentation.blsh.receipt,null);
  const dimensions=await sharp(png).metadata();assert.equal(dimensions.width,1200);assert.equal(dimensions.height,1020);
  if(id===8484136){
   const row=boxes.evidence.rows.find(r=>r.sourceId===5595292);assert.equal(row.state,'identity_team_exposure_qualified');assert.equal(row.counts.goals.state,'mismatch');assert.equal(boxes.evidence.rows.find(r=>r.sourceId===5598977).TOI,null);
   assert.match(manifest.presentation.snapshot.recent.reason,/unavailable/);
   await page.getByLabel('Analysis view',{exact:true}).selectOption('comparison');assert.equal(await page.getByRole('button',{name:'Download analysis PNG',exact:true}).isDisabled(),true);
   await page.getByLabel('Analysis view',{exact:true}).selectOption('evidence');assert.equal(await page.getByRole('button',{name:'Download analysis PNG',exact:true}).isEnabled(),true);
  }
  await page.setViewportSize({width:320,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(here,`current-box-${id}-mobile-20261101.png`),fullPage:true});await page.setViewportSize({width:1440,height:1050});
  checks.push({id,summary:boxes.summary,sourceRowsPreserved:true,profileUnchanged:true,dimensions:[dimensions.width,dimensions.height],pngSHA256:sha(png),footerRight:footer[0].right,mobile:320});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(path.join(here,'CURRENT-BOX-BROWSER-20261101.json'),JSON.stringify({checks,unknownNhlAnalysisStillBlocked:true,separateResearchExport:true,requests,errors},null,2)+'\n');
 console.log('Both dated research PNGs/manifests and320px flow pass; original counts/field discrepancies preserved; no HTTP.');
}finally{await browser.close();}
