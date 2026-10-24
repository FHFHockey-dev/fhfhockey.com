import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const frozen=path.resolve(here,'../slice-03');
const require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test');
const checks=[],network=[],errors=[];
let browser,context,page;
async function download(button,filename){
  const event=page.waitForEvent('download');
  await page.getByRole('button',{name:button,exact:true}).click();
  await(await event).saveAs(path.join(here,filename));
}
async function manifest(filename){await download('Download snapshot manifest',filename);return JSON.parse(await readFile(path.join(here,filename),'utf8'));}
const ready=()=>page.waitForFunction(()=>{const button=[...document.querySelectorAll('button')].find(x=>x.textContent==='Download snapshot manifest');return button && !button.disabled && !!document.querySelector('svg');});
try{
  browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
  context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:1250}});
  await context.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
  await context.setOffline(true);
  page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(frozen,'preview.html')).href+'?player=1001&mode=calendar&start=2026-10-01&end=2026-10-01&strength=pp');await ready();
  const zero=await manifest('zero-pp-manifest.json');
  assert.equal(zero.snapshot.sample.gp,1);assert.equal(zero.snapshot.sample.toiSeconds,0);assert.equal(zero.snapshot.sample.gameIds.length,1);
  assert.equal(zero.snapshot.readings.find(r=>r.id==='atoi').value,0);
  assert.equal(zero.snapshot.readings.find(r=>r.id==='sog60').value,null);
  assert.equal(zero.snapshot.readings.find(r=>r.id==='sog60').state,'undefined');
  const zeroText=await page.locator('svg').textContent(),zeroId=await page.locator('svg').getAttribute('data-snapshot-id');
  assert.ok(zeroText.includes('1 GP · 0.0 min TOI'));assert.ok(zeroText.includes('Power play'));assert.equal(zero.snapshot.id,zeroId);
  await download('Download synthetic PNG','zero-pp.png');await page.getByText('Synthetic PNG downloaded from the displayed snapshot.',{exact:true}).waitFor();
  const zeroPng=await readFile(path.join(here,'zero-pp.png'));assert.deepEqual([zeroPng.readUInt32BE(16),zeroPng.readUInt32BE(20)],[1080,1080]);
  checks.push({name:'zero-PP exposure retains one appearance; undefined ratios and PNG/manifest agree',passed:true,snapshotId:zeroId,pngSha256:crypto.createHash('sha256').update(zeroPng).digest('hex')});

  assert.ok(Object.values(zero.coverage).every(c=>c.missingIncomplete===0));
  const zeroStatus=await page.locator('[role=status]').allTextContents();
  checks.push({name:'PC-S03-02: known undefined zero-exposure ratios are not labeled missing source',passed:!zeroStatus.some(t=>t.includes('Partial source')),observed:zeroStatus,coverage:zero.coverage.sog60});

  await page.getByLabel('Period mode').selectOption('appearances');await ready();
  await page.getByLabel('Appearances per player').selectOption('20');await ready();
  await page.getByLabel('Strength · synthetic coverage').selectOption('5v5');await ready();
  await page.getByLabel('Search example skaters').fill('Alex Morgan');
  await page.getByRole('button',{name:'Alex Morgan · Summit · C · ID 1002'}).click();await ready();
  await page.goBack();await ready();assert.ok((await page.locator('svg').textContent()).includes('Example ID 1001'));
  await page.goForward();await ready();assert.ok((await page.locator('svg').textContent()).includes('Example ID 1002'));
  const current=await manifest('selected-5v5-manifest.json');assert.equal(current.snapshot.player.id,'1002');assert.equal(current.snapshot.settings.strength,'5v5');assert.deepEqual(current.snapshot.settings.period,{mode:'appearances',count:20});
  checks.push({name:'duplicate identity, period/strength and actual Back/Forward keep one consistent snapshot',passed:true,snapshotId:current.snapshot.id});

  await page.getByLabel('Source scenario · synthetic').selectOption('unknown-pool');await ready();
  const unknown=await manifest('unknown-pool-manifest.json');assert.ok(unknown.snapshot.readings.some(r=>r.value!==null));assert.ok(unknown.snapshot.readings.every(r=>r.rank===null));
  await page.getByLabel('Source scenario · synthetic').selectOption('history-gap');
  await page.getByText('Complete appearance history through the common cutoff is unverified',{exact:true}).waitFor();
  assert.ok(await page.getByRole('button',{name:'Download synthetic PNG',exact:true}).isDisabled());
  const missing=await manifest('history-gap-manifest.json');assert.equal(missing.snapshot.sample.gp,null);assert.equal(missing.snapshot.sample.toiSeconds,null);
  const aria=await page.locator('svg').getAttribute('aria-label');
  checks.push({name:'PC-S03-01: accessible unverified GP state',passed:aria.includes('GP unverified'),observed:aria});
  for(const state of ['stale','source-error']){
    await page.getByLabel('Source scenario · synthetic').selectOption(state);await page.getByText('Source unavailable: no exportable values.',{exact:true}).waitFor();
    assert.ok(await page.getByRole('button',{name:'Download synthetic PNG',exact:true}).isDisabled());
    const unavailable=await manifest(`${state}-manifest.json`);assert.equal(unavailable.snapshot.sample.toiSeconds,null);assert.ok(unavailable.snapshot.readings.every(r=>r.value===null));
  }
  checks.push({name:'unknown rank coverage retains values; history/stale/source-error cannot export fabricated zero',passed:true});

  await page.getByLabel('Source scenario · synthetic').selectOption('complete');await ready();
  await page.getByLabel('Strength · synthetic coverage').selectOption('all');await ready();
  await page.getByLabel('Appearances per player').selectOption('10');await ready();
  await page.getByLabel('Search example skaters').fill('Jamie');await page.getByRole('button',{name:'Jamie Chen · Harbour · LW · ID 1004'}).click();await ready();
  await page.getByLabel('Source scenario · synthetic').selectOption('metric-gap');await page.getByText('Partial source: affected values and ranks are unavailable.',{exact:true}).waitFor();
  const partial=await manifest('partial-manifest.json');assert.deepEqual(partial,JSON.parse(await readFile(path.join(frozen,'partial-manifest.json'),'utf8')));
  const text=await page.locator('svg').textContent();assert.ok(text.includes('Known short season'));assert.equal(partial.snapshot.readings.find(r=>r.id==='ixg60').state,'missing');
  await download('Download synthetic PNG','partial.png');await page.getByText('Synthetic PNG downloaded from the displayed snapshot.',{exact:true}).waitFor();
  const png=await readFile(path.join(here,'partial.png'));assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1080,1080]);
  await page.screenshot({path:path.join(here,'partial-page.png'),fullPage:true});
  checks.push({name:'PC-S03-02: exported partial SVG retains missing-input explanation',passed:/missing|incomplete/i.test(text),cardText:text,manifestReason:partial.snapshot.readings.find(r=>r.id==='ixg60').reason,pngSha256:crypto.createHash('sha256').update(png).digest('hex')});
  assert.equal(network.length,0);assert.equal(errors.length,0);
  checks.push({name:'file-only browser context: zero HTTP(S) attempts and page errors',passed:true});
  await writeFile(path.join(here,'browser-results.json'),JSON.stringify({checks,network,errors,PNGexports:2,source:path.join(frozen,'preview.html'),serverActions:0},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,PNGexports:2,network:network.length,errors:errors.length}));
  if(checks.some(c=>!c.passed))process.exitCode=1;
}catch(error){
  await writeFile(path.join(here,'browser-failure.json'),JSON.stringify({error:String(error),checks,network,errors,body:page?await page.locator('body').innerText().catch(()=>'<unavailable>'):null},null,2)+'\n');
  throw error;
}finally{await browser?.close();}
