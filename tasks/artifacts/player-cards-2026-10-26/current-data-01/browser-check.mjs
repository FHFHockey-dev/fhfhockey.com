import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
const checks=[],externalAttempts=[],pageErrors=[],exports=[];
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1264,height:1500}});await context.setOffline(true);
 await context.route(/^https?:/,r=>{externalAttempts.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto(pathToFileURL(path.join(here,'preview.html')).href);
 const svg=page.locator('svg[data-current-key]');await svg.waitFor();
 assert.ok((await svg.textContent()).includes('SYNTHETIC CONTRACT FIXTURE'));
 assert.ok((await svg.textContent()).includes('2/5 GP'));
 assert.equal(await svg.locator('[data-metric="shots60"]').count(),1);
 checks.push('Explicit synthetic fixture; no automatic HTTP request; ready sample and actual ratios distinct from unverified population ranks');
 async function download(label,name){const[event]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:label,exact:true}).click()]);await event.saveAs(path.join(here,name));return readFile(path.join(here,name));}
 for(const format of ['rates-opportunity','results-milestones']){
  await page.getByLabel('Card category').selectOption(format);
  assert.equal(await svg.getAttribute('data-card-format'),format);
  assert.equal(await svg.locator(`[data-metric="${format==='rates-opportunity'?'shots60':'goals'}"]`).count(),1);
  if(format==='results-milestones')assert.ok((await svg.textContent()).includes('Milestone baselines unavailable'));
  const bytes=await download('Download PNG',format+'.png');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[1200,1020]);
  await page.getByText('Source and metric definitions',{exact:true}).click();
  const manifest=JSON.parse((await download('Download snapshot manifest',format+'-manifest.json')).toString());
  assert.equal(manifest.format,format);assert.equal(manifest.card.source,'contract-fixture');assert.equal(manifest.card.sample.gp,2);
  assert.deepEqual(manifest.card.values,{atoi:15,shots60:8,goals60:2,points60:6,goals:1,assists:2,points:3,shots:4,shootingPct:25});
  assert.ok(manifest.card.rankReason.includes('no verified all-NHL'));assert.ok(manifest.card.finalityStatement.includes('not supplied'));
  await page.getByText('Source and metric definitions',{exact:true}).click();
  await page.getByRole('button',{name:'Prepare social image',exact:true}).click();await page.getByRole('button',{name:'Share prepared image',exact:true}).waitFor();
  await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));
  const shared=await download('Share prepared image',format+'-share.png');assert.deepEqual(shared,bytes);
  await svg.screenshot({path:path.join(here,format+'-desktop.png')});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(here,format+'-phone.png'),fullPage:true});await page.setViewportSize({width:1264,height:1500});
  exports.push({format,sha256:createHash('sha256').update(bytes).digest('hex'),shareBytesMatch:true});
 }
 checks.push('Two functional stat suites from identical snapshot; real PNGs1200x1020/manifest/share-fallback parity; desktop and390px phone without overflow');
 await page.getByLabel('Card category').selectOption('rates-opportunity');assert.equal(await page.getByRole('button',{name:'Share prepared image',exact:true}).count(),0);
 await page.getByLabel('Own last appearances').selectOption('10');assert.equal(await svg.count(),0);assert.equal(await page.getByRole('button',{name:'Download PNG',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Load NHL results',exact:true}).click();await svg.waitFor();assert.ok((await svg.textContent()).includes('2/10 GP'));
 checks.push('Category changes discard prepared image; window changes invalidate old snapshot/export; explicit reload restores matching selected window');
 await page.getByLabel('Player NHL ID').fill('8479318');await page.getByRole('button',{name:'Load NHL results',exact:true}).click();await svg.waitFor();
 assert.ok((await svg.getAttribute('aria-label')).includes('GP unverified'));assert.equal(await page.getByRole('button',{name:'Download PNG',exact:true}).isDisabled(),true);
 assert.ok((await page.getByRole('note').textContent()).includes('Complete season appearance count'));await page.screenshot({path:path.join(here,'unavailable-state.png'),fullPage:true});
 checks.push('Incomplete history produces unknown GP/missing values and disables PNG, without replacing data with zeros');
 assert.deepEqual(externalAttempts,[]);assert.deepEqual(pageErrors,[]);
 const result={checks,exports,externalAttempts,pageErrors,liveDataQualified:false,fixture:'synthetic-contract-fixture.json'};
 await writeFile(path.join(here,'browser-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
