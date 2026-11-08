import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test');
const pins=JSON.parse(await readFile(path.join(here,'candidate-pins.json')));
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1200}});
const attempts=[],errors=[];
await context.route(/^https?:/,route=>route.request().url().startsWith('http://127.0.0.1:3125/')?route.continue():(attempts.push(route.request().url()),route.abort()));
try{
 const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:3125/player-cards/compositions?checkpoint=sequential03';
 const response=await page.goto(url);const bytes=await response.body();assert.equal(response.status(),200);assert.equal(response.headers()['cache-control'],'no-store');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),pins['comparison.html'].sha256);
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
 assert.equal(await page.locator('body').getAttribute('data-checkpoint'),'sequential03');
 assert.deepEqual(await page.locator('h2').allTextContents(),['1. Posterize → 2. Team Colors','1. Pixelate → 2. Team Colors']);
 const images=await page.locator('img.card').evaluateAll(ns=>ns.map(n=>n.src));
 for(let i=0;i<images.length;i++){const name=i===0?'posterized-team-colors-card.png':'pixelated-team-colors-card.png';assert.equal(createHash('sha256').update(Buffer.from(images[i].split(',')[1],'base64')).digest('hex'),pins[name].sha256);}
 await page.screenshot({path:path.join(here,'served-comparison-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(here,'served-comparison-phone.png'),fullPage:true});
 await page.setViewportSize({width:1264,height:1500});await page.goto('http://127.0.0.1:3125/player-cards/studio?checkpoint=sequential03');
 await page.waitForFunction(()=>document.querySelector('svg[data-portrait-key]')?.getAttribute('data-portrait-key')?.startsWith('team-colors:'));
 for(const style of ['posterized-team-colors','pixelated-team-colors']){
  await page.getByLabel('Portrait style').selectOption(style);
  await page.waitForFunction(s=>document.querySelector('svg[data-portrait-key]')?.getAttribute('data-portrait-key')?.startsWith(s+':'),style);
  const svg=page.locator('svg[data-share-format]');assert.ok((await svg.getAttribute('data-pipeline-key')).startsWith('fhfh-sequential-v1:'));
  assert.equal(await svg.locator('[data-team-logo]').count(),1);
  assert.deepEqual(await svg.locator('image').evaluateAll(ns=>ns.map(n=>n.hasAttribute('data-team-logo')?'logo':'hero')),['logo','hero']);
  await svg.screenshot({path:path.join(here,'served-studio-'+style+'.png')});
 }
 assert.deepEqual(attempts,[]);assert.deepEqual(errors,[]);
 const result={url,checkpoint:'sequential03',comparisonBytes:bytes.length,comparisonSha256:pins['comparison.html'].sha256,latestExportHashesVerified:2,servedComparisonScreenshots:['served-comparison-desktop.png','served-comparison-phone.png'],servedInteractivePipelineAndLogoVerified:2,externalAttempts:attempts,pageErrors:errors,remoteAvailabilityClaimed:false};
 await writeFile(path.join(here,'SERVED-VERIFICATION.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
