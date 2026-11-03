import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../../web/package.json')),{chromium}=require('@playwright/test');
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true,timeout:10000});
const checks=[],external=[],errors=[];
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1264,height:1500}});
 await context.route(/^https?:/,route=>route.request().url().startsWith('http://127.0.0.1:3125/')?route.continue():(external.push(route.request().url()),route.abort()));
 const page=await context.newPage();page.setDefaultTimeout(18000);page.on('pageerror',e=>errors.push(e.message));
 async function download(label,file){const button=page.getByRole('button',{name:label,exact:true});if(!await button.isVisible())await page.getByText('Source and metric definitions',{exact:true}).click();const [event]=await Promise.all([page.waitForEvent('download'),button.click()]);await event.saveAs(path.join(here,file));return readFile(path.join(here,file));}
 for(const [id,name] of [[8484387,'Matvei Michkov'],[8478439,'Travis Konecny']]){
  await page.goto(`http://127.0.0.1:3125/player-cards/live?playerId=${id}&season=20262027&count=10`);
  assert.equal((await page.evaluate(()=>globalThis.__cardApiCalls)).length,0);
  const pending=page.waitForResponse(r=>r.url().includes('/api/v1/player-cards-live'));
  await page.getByRole('button',{name:'Load NHL results',exact:true}).click();const response=await pending;
  const status=response.status();console.log(JSON.stringify({id,status}));
  if(status!==200){await page.screenshot({path:path.join(here,`${id}-failure.png`),fullPage:true});throw new Error(`Live ${id} status ${status}: `+(await page.locator('body').innerText()).slice(-3000));}
  const svg=page.locator('svg[data-current-key]');await svg.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Download PNG'&&!b.disabled));
  assert.ok((await svg.textContent()).includes(name));assert.equal(await svg.getAttribute('data-source'),'nhl-current');assert.equal(await svg.locator('[data-hero-image="true"]').count(),0);
  const manifest=JSON.parse((await download('Download snapshot manifest',`${id}-manifest.json`)).toString());assert.equal(manifest.card.player.id,id);assert.equal(manifest.card.state,'ready');assert.equal(manifest.card.player.team,'PHI');assert.equal(manifest.card.source,'nhl-current');
  const png=await download('Download PNG',`${id}.png`);assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1200,1020]);
  await page.screenshot({path:path.join(here,`${id}-desktop.png`),fullPage:true});
  await page.getByLabel('Own last appearances').selectOption('5');await page.getByLabel('Card category').selectOption('recent-previous');
  assert.equal((await page.evaluate(()=>globalThis.__cardApiCalls)).length,1);
  await page.getByLabel('Card category').selectOption('results-milestones');assert.ok((await svg.textContent()).includes('Milestone baselines unavailable'));
  for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.screenshot({path:path.join(here,`${id}-phone.png`),fullPage:true});await page.setViewportSize({width:1264,height:1500});
  checks.push({id,name,status,sourceReads:response.headers()['x-fhfh-source-reads'],sample:manifest.card.sample,values:manifest.card.values,observedAt:manifest.card.observedAt,pngSha256:createHash('sha256').update(png).digest('hex'),missingImage:true,windowAndFormatChangesNoReads:true});
 }
 // One explicit reload is served from the same recent capture, not another NHL batch.
 const cached=page.waitForResponse(r=>r.url().includes('/api/v1/player-cards-live'));await page.getByRole('button',{name:'Load NHL results',exact:true}).click();const hit=await cached;assert.equal(hit.status(),200);assert.equal(hit.headers()['x-fhfh-source-reads'],'0');assert.equal(hit.headers()['x-fhfh-capture-cache'],'hit');
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 await writeFile(path.join(here,'BROWSER-VERIFICATION.json'),JSON.stringify({checks,cachedReload:true,external,errors},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,cachedReload:true,external,errors}));
}finally{await browser.close();}
