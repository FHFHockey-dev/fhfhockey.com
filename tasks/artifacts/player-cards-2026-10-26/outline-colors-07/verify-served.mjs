import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test'),browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
const pins=JSON.parse(await readFile(path.join(here,'candidate-pins.json'))),expected=JSON.parse(await readFile(path.join(here,'browser-results.json'))).exports;
const attempts=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1200}});await context.route(/^https?:/,r=>r.request().url().startsWith('http://127.0.0.1:3125/')?r.continue():(attempts.push(r.request().url()),r.abort()));
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:3125/player-cards/compositions?checkpoint=colors07',response=await page.goto(url),body=await response.body();
 assert.equal(response.status(),200);assert.equal(createHash('sha256').update(body).digest('hex'),pins['comparison.html'].sha256);assert.equal(await page.locator('body').getAttribute('data-checkpoint'),'colors07');
 await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth));assert.equal(await page.locator('main article').count(),4);
 for(const item of expected){const card=page.locator(`article[data-ink="${item.ink}"]`);assert.equal(await card.locator('h2').textContent(),item.label+' · 5 px');assert.equal(createHash('sha256').update(Buffer.from((await card.locator('img').getAttribute('src')).split(',')[1],'base64')).digest('hex'),item.pngSha256);}
 await page.screenshot({path:path.join(here,'served-colors-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(here,'served-colors-phone.png'),fullPage:true});
 await page.setViewportSize({width:1264,height:1500});await page.goto('http://127.0.0.1:3125/player-cards/studio?checkpoint=colors07');
 await page.waitForFunction(()=>document.querySelector('svg[data-share-format]')?.dataset.outlineKey.includes(':white:'));
 await page.getByLabel('Reviewed artwork').selectOption('8478864');await page.waitForFunction(()=>document.querySelector('svg[data-share-format]')?.dataset.snapshotId.startsWith('art-study-8478864'));
 const svg=page.locator('svg[data-share-format]');
 for(const item of expected){await page.getByLabel('Outline color').selectOption(item.ink);await page.waitForFunction(ink=>document.querySelector('svg[data-share-format]')?.dataset.outlineKey.includes(':'+ink+':'),item.ink);assert.equal(await svg.locator('[data-player-outline]').count(),1);assert.equal(await svg.locator('[data-player-outline]').getAttribute('data-outline-color'),item.color);assert.equal(await svg.locator('[data-player-outline]').getAttribute('data-outline-width'),'5');}
 await svg.screenshot({path:path.join(here,'served-selected-tan.png')});assert.deepEqual(attempts,[]);assert.deepEqual(errors,[]);
 const result={url,checkpoint:'colors07',responseSha256:pins['comparison.html'].sha256,servedPNGHashesVerified:4,interactiveSourceColorsVerified:4,single5pxRing:true,desktopAndPhoneScreenshots:true,externalAttempts:attempts,pageErrors:errors,remoteAvailabilityClaimed:false};
 await writeFile(path.join(here,'SERVED-VERIFICATION.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
