import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const candidate=path.resolve(here,'../slice-03-r1/preview.html');
const original=path.resolve(here,'../slice-03-review');
const require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test');
const checks=[],network=[],errors=[],exports=[];
let browser,page;
const ready=()=>page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='Download snapshot manifest');return b&&!b.disabled&&!!document.querySelector('svg');});
async function go(query){await page.goto(pathToFileURL(candidate).href+query);await ready();}
async function download(button,filename){const d=page.waitForEvent('download');await page.getByRole('button',{name:button,exact:true}).click();await(await d).saveAs(path.join(here,filename));}
async function capture(name){
  const id=await page.locator('svg').getAttribute('data-snapshot-id');
  await download('Download snapshot manifest',`${name}-manifest.json`);
  const bytes=await readFile(path.join(here,`${name}-manifest.json`));
  assert.deepEqual(bytes,await readFile(path.join(original,`${name}-manifest.json`)));
  const manifest=JSON.parse(bytes.toString());assert.equal(manifest.snapshot.id,id);
  await download('Download synthetic PNG',`${name}.png`);await page.getByText('Synthetic PNG downloaded from the displayed snapshot.',{exact:true}).waitFor();
  const png=await readFile(path.join(here,`${name}.png`));assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1080,1080]);
  assert.notDeepEqual(png,await readFile(path.join(original,`${name}.png`)));
  exports.push({name,snapshotId:id,manifestUnchanged:true,width:1080,height:1080,pngSha256:crypto.createHash('sha256').update(png).digest('hex')});
  return manifest;
}
try{
  browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:1250}});
  await context.route(/^https?:/,r=>{network.push(r.request().url());return r.abort();});await context.setOffline(true);
  page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
  await go('?player=1004&n=10&case=metric-gap');
  const partialText=await page.locator('svg').textContent();
  assert.ok(partialText.includes('Known short season · proposed policy · Missing source'));
  assert.ok(partialText.includes('Missing source · incomplete inputs'));
  assert.ok(!partialText.includes('Unavailable · see sample/source state'));
  const partial=await capture('partial');assert.equal(partial.snapshot.readings.find(r=>r.id==='ixg60').state,'missing');
  checks.push({name:'partial PNG contains short-sample and missing reason; original manifest unchanged',passed:true,svgText:partialText});

  await go('?player=1001&mode=calendar&start=2026-10-01&end=2026-10-01&strength=pp');
  const before=await page.getByRole('status').textContent(),zeroText=await page.locator('svg').textContent();
  assert.ok(before.includes('Some metrics undefined'));assert.ok(!before.includes('Partial source'));
  assert.ok(zeroText.includes('Undefined · zero denominator'));assert.ok(!zeroText.includes('Missing source'));
  assert.ok(zeroText.includes('1 GP · 0.0 min TOI'));assert.ok(zeroText.includes('0:00'));
  const zero=await capture('zero-pp');assert.equal(zero.snapshot.sample.gp,1);assert.equal(zero.snapshot.sample.toiSeconds,0);assert.equal(zero.coverage.sog60.missingIncomplete,0);
  checks.push({name:'zero-exposure banner measured before export; SVG reason and unchanged manifest agree',passed:true,bannerBeforeExport:before,svgText:zeroText});

  await go('?case=history-gap');
  const unknownLabel=await page.locator('svg').getAttribute('aria-label');
  assert.ok(unknownLabel.includes('GP unverified'));assert.ok(!unknownLabel.includes('null actual appearances'));
  assert.ok(await page.getByRole('button',{name:'Download synthetic PNG',exact:true}).isDisabled());
  await download('Download snapshot manifest','history-gap-manifest.json');
  const unknown=JSON.parse(await readFile(path.join(here,'history-gap-manifest.json'),'utf8'));assert.equal(unknown.snapshot.sample.gp,null);assert.equal(unknown.snapshot.sample.toiSeconds,null);
  await go('?mode=calendar&start=2026-09-01&end=2026-09-02');
  const zeroLabel=await page.locator('svg').getAttribute('aria-label');assert.ok(zeroLabel.includes('0 actual appearances'));assert.ok(!zeroLabel.includes('GP unverified'));
  assert.ok((await page.locator('svg').textContent()).includes('Undefined · no appearances'));
  assert.ok(await page.getByRole('button',{name:'Download synthetic PNG',exact:true}).isDisabled());
  checks.push({name:'unknown GP and verified zero GP keep distinct accessible states and no PNG',passed:true,unknownLabel,zeroLabel});
  assert.equal(network.length,0);assert.equal(errors.length,0);checks.push({name:'file-only context: zero page HTTP(S) attempts/errors; no server action',passed:true});
  await writeFile(path.join(here,'browser-results.json'),JSON.stringify({checks,exports,network,errors,source:candidate,serverActions:0,designAcceptance:false},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,PNGexports:exports.length,network:network.length,errors:errors.length}));
}catch(error){await writeFile(path.join(here,'browser-failure.json'),JSON.stringify({error:String(error),checks,exports,network,errors,body:page?await page.locator('body').innerText().catch(()=>'<unavailable>'):null},null,2)+'\n');throw error;}
finally{await browser?.close();}
