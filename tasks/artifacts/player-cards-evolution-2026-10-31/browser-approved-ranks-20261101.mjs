import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../web/package.json'));
const {chromium}=require('@playwright/test'),sharp=require('sharp'),sha=b=>createHash('sha256').update(b).digest('hex');
const requests=[],errors=[],checks=[];
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true,timeout:10000});
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1050}});
 await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(here,'preview.html')).href);
 const svg=page.locator('svg[data-analysis-key]');await svg.waitFor();
 async function download(label,file){const [e]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:label,exact:true}).click()]);await e.saveAs(path.join(here,file));return readFile(path.join(here,file));}
 await page.getByLabel('Player',{exact:true}).selectOption('short');
 await page.getByLabel('Analysis view',{exact:true}).selectOption('comparison');
 await page.getByLabel('Comparison baseline',{exact:true}).selectOption('season');
 for(const n of [5,10,20]){
  await page.getByLabel('Window',{exact:true}).selectOption(String(n));
  assert.ok((await svg.textContent()).includes(`3 of ${n} appearances`));assert.match(await svg.textContent(),/verified complete season history, small sample/);
  assert.match(await page.getByLabel('Readable card details').innerText(),/competition ties \(1, 2, 2, 4\)/);
 }
 await page.getByLabel('Window',{exact:true}).selectOption('5');await page.getByLabel('Comparison baseline',{exact:true}).selectOption('season');
 for(const [selection,n,gp,name] of [['short',5,3,'fixture'],['retained',20,11,'retained']]){
  await page.getByLabel('Player',{exact:true}).selectOption(selection);await page.getByLabel('Window',{exact:true}).selectOption(String(n));
  assert.ok((await svg.textContent()).includes(`${gp} of ${n} appearances`));
  const warning=await svg.locator('text').evaluateAll(nodes=>nodes.filter(x=>x.getAttribute('y')==='979').map(x=>{const b=x.getBBox();return {right:b.x+b.width,bottom:b.y+b.height,text:x.textContent};}));
  assert.equal(warning.length,1);assert.ok(warning[0].right<=1160,JSON.stringify(warning));assert.ok(warning[0].bottom<1007);
  assert.equal(await svg.locator('[data-evidence-truncated="true"]').count(),0);
  const png=await download('Download analysis PNG',`approved-short-${name}-20261101.png`);
  const manifest=JSON.parse(await download('Download analysis manifest',`approved-short-${name}-manifest-20261101.json`));
  const snapshot=manifest.presentation.snapshot;
  assert.equal(snapshot.rankPolicy.status,'approved');assert.equal(snapshot.rankPolicy.ties,'competition');assert.equal(snapshot.rankPolicy.percentile,'midrank');assert.equal(snapshot.rankPolicy.shortSeason,'include-verified-complete');assert.equal(snapshot.rankPolicy.additionalQualifiers,'none');
  assert.equal(snapshot.recent.knownShort,true);assert.equal(snapshot.recent.gp,gp);assert.equal(snapshot.recent.requestedAppearances,n);assert.ok(snapshot.recent.sampleWarning.includes(`${gp} of ${n}`));
  assert.ok(snapshot.recent.readings.every(r=>r.rank===null));assert.ok(snapshot.recent.readings.every(r=>!r.rankReason.includes('approval')));
  const dimensions=await sharp(png).metadata();assert.equal(dimensions.width,1200);assert.equal(dimensions.height,1020);
  await page.setViewportSize({width:320,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(here,`approved-short-${name}-mobile-20261101.png`),fullPage:true});await page.setViewportSize({width:1440,height:1050});
  checks.push({selection,requested:n,actual:gp,policy:snapshot.rankPolicy,rankSourceStillUnavailable:true,pngSHA256:sha(png),warningRight:warning[0].right,mobile:320});
 }
 await page.getByLabel('Window',{exact:true}).selectOption('calendar');assert.doesNotMatch(await svg.textContent(),/verified complete season history/);
 await page.getByLabel('Player',{exact:true}).selectOption('retained-sasson');await page.getByLabel('Window',{exact:true}).selectOption('5');
 assert.equal(await page.getByRole('button',{name:'Download analysis PNG',exact:true}).isDisabled(),true);assert.doesNotMatch(await svg.textContent(),/verified complete season history/);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(path.join(here,'APPROVED-RANKS-BROWSER-20261101.json'),JSON.stringify({checks,calendarNotKnownShort:true,missingCaptureNotKnownShort:true,requests,errors},null,2)+'\n');
 console.log('Approved policy/GP warning preserved in2PNG+manifest pairs;3/5,3/10,3/20,retained11/20; missing capture and observed rank sources remain gated;320px,zeroHTTP.');
}finally{await browser.close();}
