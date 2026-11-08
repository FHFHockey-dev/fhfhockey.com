import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)), require=createRequire(path.resolve(here,'../../../web/package.json'));
const {chromium}=require('@playwright/test'), sharp=require('sharp'), sha=b=>createHash('sha256').update(b).digest('hex');
const checks=[],requests=[],errors=[],exports=[];
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true,timeout:10000});
try {
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1050}});
 await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(here,'preview.html')).href);
 const svg=page.locator('svg[data-analysis-key]');await svg.waitFor();
 async function download(label,file){const [e]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:label,exact:true}).click()]);await e.saveAs(path.join(here,file));return readFile(path.join(here,file));}
 let manifest=JSON.parse((await download('Download analysis manifest','retained-manifest.json')).toString());
 assert.equal(manifest.presentation.snapshot.capture.source,'retained');assert.equal(manifest.presentation.snapshot.recent.gp,5);
 assert.equal(manifest.presentation.snapshot.recent.readings.find(r=>r.metric==='shots').value,4.4);
 assert.equal(manifest.presentation.snapshot.recent.readings.find(r=>r.metric==='bsh').value,null);
 await page.getByLabel('Analysis view',{exact:true}).selectOption('comparison');await page.getByLabel('Comparison baseline',{exact:true}).selectOption('season');
 manifest=JSON.parse((await download('Download analysis manifest','season-manifest.json')).toString());
 assert.equal(manifest.presentation.snapshot.overlap,5);assert.equal(manifest.presentation.snapshot.baseline.gp,11);
 await download('Download analysis PNG','retained-season.png');
 for(const width of [1440,390,320]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page reflow '+width);assert.ok((await page.getByLabel('Player',{exact:true}).boundingBox()).height>=44);await page.screenshot({path:path.join(here,`comparison-${width}.png`),fullPage:true});}
 await page.getByLabel('Player',{exact:true}).focus();assert.ok(await page.getByLabel('Player',{exact:true}).evaluate(e=>e.matches(':focus-visible')));await page.keyboard.press('Tab');assert.ok(await page.getByLabel('Analysis view',{exact:true}).evaluate(e=>e===document.activeElement));
 await page.evaluate(()=>document.body.style.zoom='2');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(here,'zoom-200.png'),fullPage:true});await page.evaluate(()=>document.body.style.zoom='1');
 await page.evaluate(()=>document.documentElement.dir='rtl');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(here,'rtl-320.png'),fullPage:true});await page.evaluate(()=>document.documentElement.dir='ltr');
 checks.push('Retained raw totals, 5/11 season overlap, manifest, 1440/390/320 reflow, >=44px control, keyboard focus, 200% zoom and RTL reflow');
 await page.setViewportSize({width:1440,height:1050});await page.getByLabel('Player',{exact:true}).selectOption('fixture');await page.getByLabel('Analysis view',{exact:true}).selectOption('categories');
 for(const visual of ['bars','radar']) {await page.getByLabel('Category display',{exact:true}).selectOption(visual);const png=await download('Download analysis PNG',`synthetic-${visual}.png`);assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1200,1020]);exports.push({file:`synthetic-${visual}.png`,sha256:sha(png)});}
 await page.getByRole('button',{name:'Prepare analysis share',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Share prepared image'&&!b.disabled));
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{globalThis.__shared=Array.from(new Uint8Array(await files[0].arrayBuffer()));}});});
 await page.getByRole('button',{name:'Share prepared image',exact:true}).click();await page.waitForFunction(()=>Array.isArray(globalThis.__shared));assert.equal(sha(Buffer.from(await page.evaluate(()=>globalThis.__shared))),exports.at(-1).sha256);
 await page.getByLabel('Window',{exact:true}).selectOption('10');assert.equal(await page.getByRole('button',{name:'Share prepared image',exact:true}).isDisabled(),true);
 for(const count of ['20','5'])await page.getByLabel('Window',{exact:true}).selectOption(count);
 await page.getByLabel('Window',{exact:true}).selectOption('calendar');await page.getByLabel('Start date',{exact:true}).fill('2026-10-02');await page.getByLabel('End date',{exact:true}).fill('2026-10-06');manifest=JSON.parse((await download('Download analysis manifest','calendar-manifest.json')).toString());assert.equal(manifest.presentation.snapshot.recent.gp,5);
 await page.getByLabel('Window',{exact:true}).selectOption('5');await page.getByLabel('Player',{exact:true}).selectOption('short');manifest=JSON.parse((await download('Download analysis manifest','short-manifest.json')).toString());assert.equal(manifest.presentation.snapshot.recent.gp,3);assert.match(manifest.presentation.snapshot.baseline.reason,/Needs 10/);
 checks.push('Same-snapshot bars/radar PNGs, 1200x1020 dimensions, prepared-share byte equality, stale-share clearing, L5/L10/L20/calendar and known-short controls');
 await page.getByLabel('Search supplied players',{exact:true}).fill('goalie');assert.equal(await svg.count(),0);await page.getByLabel('Player',{exact:true}).selectOption('goalie');await download('Download analysis PNG','goalie.png');
 assert.match(await svg.textContent(),/probable/);assert.match(await svg.textContent(),/Conditional forecast unavailable/);manifest=JSON.parse((await download('Download analysis manifest','goalie-manifest.json')).toString());assert.equal(manifest.presentation.goalie.state,'fixture');
 await page.getByLabel('Player',{exact:true}).selectOption('missing-goalie');assert.ok(await page.getByRole('button',{name:'Download analysis PNG',exact:true}).isDisabled());
 await page.getByLabel('Search supplied players',{exact:true}).fill('zzzz');assert.ok(await page.getByText('No matching supplied player.').isVisible());
 await page.getByLabel('Search supplied players',{exact:true}).fill('');await page.getByLabel('Player',{exact:true}).selectOption('retained');
 await page.getByLabel('Show approved retained artwork').check();
 await page.getByLabel('Outline color',{exact:true}).selectOption('custom');await page.waitForFunction(()=>!!document.querySelector('svg[data-analysis-key]')?.getAttribute('data-outline-settings'));
 for(const style of ['posterized-team-colors','pixelated-team-colors']) {
  await page.getByLabel('Portrait style',{exact:true}).selectOption(style);await page.waitForFunction(s=>document.querySelector('svg[data-analysis-key]')?.getAttribute('data-portrait-key')?.includes(s),style);
  const png=await download('Download analysis PNG',`${style}.png`);const currentHeader=await sharp(png).extract({left:590,top:0,width:610,height:338}).raw().toBuffer();const baseline=await sharp(await readFile(path.resolve(here,'../player-cards-2026-10-29/production-chart-17',`${style}.png`))).extract({left:590,top:0,width:610,height:338}).raw().toBuffer();
  assert.ok(currentHeader.equals(baseline),'Same-settings approved artwork region matches checkpoint17'); exports.push({file:`${style}.png`,sha256:sha(png),protectedArtworkRegionMatches17:true});
 }
 checks.push('Goalie selection/unknown forecast/no-source export block, empty-search recovery, both approved artwork treatments');
 await page.getByRole('button',{name:'Open preserved four-format editor',exact:true}).click();
 const category=page.getByLabel('Card category');for(const format of ['rates-opportunity','results-milestones','recent-previous','production-by-game']) {await category.selectOption(format);assert.equal(await page.locator('svg[data-current-key]').getAttribute('data-card-format'),format);}
 checks.push('Preserved original editor still renders all four retained formats with the saved capture');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(path.join(here,'BROWSER-VERIFICATION.json'),JSON.stringify({checks,exports,externalRequests:requests,pageErrors:errors,assetReads:await page.evaluate(()=>globalThis.__offlineCalls),providerRequests:0},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,exports:exports.length,externalRequests:0}));
} finally {await browser.close();}
