import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../../web/package.json')),{chromium}=require('@playwright/test');
const expected=JSON.parse(await readFile(path.join(here,'../../player-cards-2026-10-26/current-data-01/approved-snapshot-02/INDEPENDENT-ARITHMETIC.json')));
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true}),external=[],errors=[],checks=[],exports=[];
try {
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1264,height:1500}});
 await context.route(/^https?:/,route=>route.request().url().startsWith('http://127.0.0.1:3125/')?route.continue():(external.push(route.request().url()),route.abort()));
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('http://127.0.0.1:3125/player-cards/current?checkpoint=hero13&playerId=8476453&season=20262027&count=10&cardFormat=rates-opportunity');assert.equal(response.status(),200);assert.equal(createHash('sha256').update(await response.body()).digest('hex'),createHash('sha256').update(await readFile(path.join(here,'preview.html'))).digest('hex'));
 assert.deepEqual(await page.evaluate(()=>globalThis.__cardApiCalls),[]);
 await page.getByRole('button',{name:'Load NHL results',exact:true}).click();const svg=page.locator('svg[data-current-key]');await svg.waitFor();
 async function ready(){await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(n=>n.textContent==='Download PNG');return b&&!b.disabled&&document.querySelector('[data-hero-image="true"]');});}
 async function download(label,name){const button=page.getByRole('button',{name:label,exact:true});if(!await button.isVisible())await page.getByText('Source and metric definitions',{exact:true}).click();const [event]=await Promise.all([page.waitForEvent('download'),button.click()]);await event.saveAs(path.join(here,name));return readFile(path.join(here,name));}
 await ready();assert.equal(await page.getByLabel('Portrait style').inputValue(),'team-colors');assert.equal(await svg.locator('image[data-hero-image="true"]').count(),1);assert.equal(await svg.locator('[data-artwork-unavailable="true"]').count(),0);assert.ok((await svg.textContent()).includes('KUCHEROV'));assert.ok((await svg.textContent()).includes('Tampa Bay Lightning · R · #86'));assert.ok((await svg.textContent()).includes('RETAINED NHL CAPTURE · NOT CURRENT'));
 for(const style of ['team-colors','posterized-team-colors','pixelated-team-colors']) {
  await page.getByLabel('Portrait style').selectOption(style);await ready();
  if(style==='posterized-team-colors'){await page.getByLabel('Outline color').selectOption('custom');await ready();await page.getByRole('button',{name:'Reset team stack',exact:true}).click();await ready();}
  const metadata=JSON.parse((await download('Download snapshot manifest',style+'-L10-manifest.json')).toString());assert.deepEqual(metadata.card.values,expected.windows['10'].values);assert.equal(metadata.card.source,'nhl-retained');assert.equal(metadata.artwork.id,8476453);assert.equal(metadata.artwork.team,'TBL');assert.equal(metadata.artwork.sweater,86);assert.equal(metadata.artwork.alphaSha256,'2010d97f1e1c631f7ccf154d991517f3b6923df7739d756e39ed06140aa1f278');assert.equal(metadata.artwork.sourceSha256,'3036cb4ec324cc902ab2d797f4e69b58347c85909d6ce92daab01b7123f0711b');assert.equal(metadata.artwork.capturedAt,'2026-10-24');assert.equal(metadata.artwork.treatment.style,style);assert.equal(metadata.card.windows,undefined);assert.equal(JSON.stringify(metadata).includes('data:image'),false);
  const geo=await svg.locator('[data-hero-image="true"]').evaluate(n=>Object.fromEntries(['x','y','width','height'].map(k=>[k,n.getAttribute(k)])));assert.deepEqual(geo,{x:'600',y:'4',width:'600',height:'337.5'});
  if(style!=='team-colors'){
   assert.deepEqual(metadata.artwork.treatment.composition.order,[style.startsWith('posterized')?'posterized':'pixelated','team-colors']);assert.equal(metadata.artwork.teamLogo.team,'TBL');assert.equal(metadata.artwork.teamLogo.sha256,'51a484101a24be2f33145a58d1c7855bfc5b408bec39a7195a29aec7aaa6332c');
   assert.equal(await svg.locator('[data-team-logo="true"]').getAttribute('x'),'840');assert.equal(await svg.locator('[data-team-logo="true"]').getAttribute('y'),'-100');assert.equal(await svg.locator('[data-player-outline="true"]').getAttribute('data-outline-band-widths'),'5>5>5');assert.equal(metadata.artwork.outline.thickness,15);
  }
  const png=await download('Download PNG',style+'-L10.png');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1200,1020]);const hash=createHash('sha256').update(png).digest('hex');
  await page.getByRole('button',{name:'Prepare social image',exact:true}).click();await page.getByRole('button',{name:'Share prepared image',exact:true}).waitFor();await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));const shared=await download('Share prepared image',style+'-L10-shared.png');assert.equal(createHash('sha256').update(shared).digest('hex'),hash);
  exports.push({style,format:'rates-opportunity',count:10,sha256:hash,playerId:8476453,source:'nhl-retained'});await svg.screenshot({path:path.join(here,style+'-screen-card.png')});
 }
 checks.push('ActualKucherovcapture+ownsource/jersey/ID/team:TeamColorsdefaultand2combinedtreatments, originalgeometry,matchingTBLlogo/3x5pxcontours,PNGmanifestandnative-sharebyteparity');
 await page.getByLabel('Card category').selectOption('results-milestones');assert.equal(await page.getByRole('button',{name:'Share prepared image',exact:true}).count(),0);
 for(const count of ['5','20']) {
  await page.getByLabel('Own last appearances').selectOption(count);await ready();const data=JSON.parse((await download('Download snapshot manifest','results-L'+count+'-manifest.json')).toString());assert.deepEqual(data.card.values,expected.windows[count].values);assert.equal(data.artwork.id,8476453);assert.equal(data.artwork.team,'TBL');assert.ok((await svg.textContent()).includes(`${expected.windows[count].gp}/${count} GP`));const png=await download('Download PNG','results-L'+count+'.png');exports.push({format:'results-milestones',count:Number(count),sha256:createHash('sha256').update(png).digest('hex'),playerId:8476453,source:'nhl-retained'});
 }
 assert.equal((await page.evaluate(()=>globalThis.__cardApiCalls)).length,1);assert.equal((await page.evaluate(()=>globalThis.__cardProviderPaths)).length,3);checks.push('Real5/10/20+bothformats retainownhero/source andselected-onlyreproducibility; noadditionalAPIcapture orrankclaims');
 await page.screenshot({path:path.join(here,'styled-real-data-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(here,'styled-real-data-phone.png'),fullPage:true});await page.setViewportSize({width:1264,height:1500});
 await page.getByLabel('Player NHL ID').fill('8470001');assert.equal(await svg.count(),0);assert.equal(await page.getByLabel('Portrait style').count(),0);assert.equal(await page.getByRole('button',{name:'Download PNG',exact:true}).isDisabled(),true);checks.push('390pxnooverflow;changingselectedID immediatelyclearsKucherovportrait,stats,preparedfileandcontrols');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);const receipt={checks,exports,localApiCalls:await page.evaluate(()=>globalThis.__cardApiCalls),localAssetCalls:await page.evaluate(()=>globalThis.__cardAssetCalls),fixtureProviderPaths:await page.evaluate(()=>globalThis.__cardProviderPaths),externalAttempts:external,pageErrors:errors,newLiveRequests:0,source:'approvedretainedcaptureandbyteidenticalexistinglocalcutout;actualnativeHTTPloopbackonly'};await writeFile(path.join(here,'SERVED-VERIFICATION.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{await browser.close();}
