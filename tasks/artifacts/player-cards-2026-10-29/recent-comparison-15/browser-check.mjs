import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../../web/package.json')),{chromium}=require('@playwright/test');
const capture=path.join(here,'current-snapshot-15');
const history=JSON.parse(await readFile(path.join(capture,'game-log.json'))),schedule=JSON.parse(await readFile(path.join(capture,'team-schedule.json')));
const ordered=[...history.gameLog].sort((a,b)=>Date.parse(schedule.games.find(g=>g.id===b.gameId).startTimeUTC)-Date.parse(schedule.games.find(g=>g.id===a.gameId).startTimeUTC));
function expected(rows){const total={goals:0,assists:0,points:0,shots:0,seconds:0};for(const g of rows){for(const k of ['goals','assists','points','shots'])total[k]+=g[k];const [m,s]=g.toi.split(':').map(Number);total.seconds+=m*60+s;}return {values:{goals:total.goals,assists:total.assists,points:total.points,shots:total.shots,atoi:total.seconds/rows.length/60,shots60:total.shots*3600/total.seconds,goals60:total.goals*3600/total.seconds,points60:total.points*3600/total.seconds,shootingPct:total.shots?total.goals/total.shots*100:null},seconds:total.seconds,ids:rows.map(g=>g.gameId)};}
const recent=expected(ordered.slice(0,5)),previous=expected(ordered.slice(5,10));
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true}),external=[],errors=[],checks=[],exports=[];
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1264,height:1500}});
 await context.route(/^https?:/,route=>route.request().url().startsWith('http://127.0.0.1:3125/')?route.continue():(external.push(route.request().url()),route.abort()));
 const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('http://127.0.0.1:3125/player-cards/recent?checkpoint=recent15');assert.equal(response.status(),200);assert.equal(createHash('sha256').update(await response.body()).digest('hex'),createHash('sha256').update(await readFile(path.join(here,'preview.html'))).digest('hex'));
 await page.getByLabel('Player name, team or NHL ID').fill('Kucherov');await page.getByRole('button',{name:/Nikita Kucherov.*8476453/}).click();
 await page.getByLabel('Own last appearances').selectOption('5');await page.getByLabel('Card category').selectOption('recent-previous');
 assert.deepEqual(await page.evaluate(()=>globalThis.__cardApiCalls),[]);
 await page.getByRole('button',{name:'Load NHL results',exact:true}).click();const svg=page.locator('svg[data-current-key]');await svg.waitFor();
 async function ready(){await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(n=>n.textContent==='Download PNG');return b&&!b.disabled&&document.querySelector('[data-hero-image="true"]');});}
 async function download(label,name){const b=page.getByRole('button',{name:label,exact:true});if(!await b.isVisible())await page.getByText('Source and metric definitions',{exact:true}).click();const [event]=await Promise.all([page.waitForEvent('download'),b.click()]);await event.saveAs(path.join(here,name));return readFile(path.join(here,name));}
 await ready();assert.ok((await svg.textContent()).includes('PREVIOUS 5'));assert.ok((await svg.textContent()).includes('RETAINED NHL CAPTURE · NOT CURRENT'));
 for(const style of ['posterized-team-colors','pixelated-team-colors']){
  await page.getByLabel('Portrait style').selectOption(style);await ready();
  if(style==='posterized-team-colors'){await page.getByLabel('Outline color').selectOption('custom');await ready();await page.getByRole('button',{name:'Reset team stack',exact:true}).click();await ready();}
  const manifest=JSON.parse((await download('Download snapshot manifest',style+'-manifest.json')).toString());
  assert.deepEqual(manifest.card.values,recent.values);assert.deepEqual(manifest.card.previous.values,previous.values);assert.deepEqual(manifest.card.previous.games.map(g=>g.gameId),previous.ids);assert.equal(manifest.card.previous.toiSeconds,previous.seconds);assert.equal(manifest.card.previous.state,'ready');assert.equal(manifest.renderVersion,'fhfh-current-comparison-v1');assert.equal(manifest.card.windows,undefined);
  assert.equal(manifest.artwork.id,8476453);assert.equal(manifest.artwork.team,'TBL');assert.deepEqual(manifest.artwork.treatment.composition.order,[style.startsWith('posterized')?'posterized':'pixelated','team-colors']);
  const geo=await svg.locator('[data-hero-image="true"]').evaluate(n=>Object.fromEntries(['x','y','width','height'].map(k=>[k,n.getAttribute(k)])));assert.deepEqual(geo,{x:'600',y:'4',width:'600',height:'337.5'});
  assert.equal(await svg.locator('[data-team-logo="true"]').getAttribute('x'),'840');assert.equal(await svg.locator('[data-player-outline="true"]').getAttribute('data-outline-band-widths'),'5>5>5');
  const png=await download('Download PNG',style+'.png');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1200,1020]);exports.push({style,sha256:createHash('sha256').update(png).digest('hex')});
 }
 await svg.screenshot({path:path.join(here,'comparison-card.png')});await page.screenshot({path:path.join(here,'desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Prepare social image',exact:true}).click();await page.getByRole('button',{name:'Share prepared image',exact:true}).waitFor();
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{globalThis.__sharedBytes=Array.from(new Uint8Array(await files[0].arrayBuffer()));}});});
 await page.getByRole('button',{name:'Share prepared image',exact:true}).click();
 await page.waitForFunction(()=>Array.isArray(globalThis.__sharedBytes));
 assert.equal(createHash('sha256').update(Buffer.from(await page.evaluate(()=>globalThis.__sharedBytes))).digest('hex'),exports[1].sha256);
 checks.push('Actual name→load→one retained provider capture→recent and prior5 independent arithmetic→two combined portrait PNGs; unchanged player/logo/5px stack geometry; native share exact PNG bytes');
 await page.getByLabel('Own last appearances').selectOption('10');await ready();assert.ok((await svg.textContent()).includes('Needs 20 season appearances'));assert.ok((await svg.getAttribute('aria-label')).includes('preceding 10: unavailable'));assert.equal(await page.getByRole('button',{name:'Share prepared image',exact:true}).count(),0);
 const missing=JSON.parse((await download('Download snapshot manifest','insufficient-L10-manifest.json')).toString());assert.equal(missing.card.previous.state,'unavailable');assert.equal(missing.card.sample.gp,10);
 await download('Download PNG','insufficient-L10.png');
 await page.getByLabel('Card category').selectOption('results-milestones');await ready();assert.ok((await svg.textContent()).includes('Milestone baselines unavailable'));
 const results=JSON.parse((await download('Download snapshot manifest','results-manifest.json')).toString());assert.equal(results.card.previous,undefined);assert.equal(results.card.windows,undefined);
 await page.getByLabel('Card category').selectOption('recent-previous');await page.getByLabel('Own last appearances').selectOption('5');await ready();
 assert.equal((await page.evaluate(()=>globalThis.__cardApiCalls)).length,1);
 checks.push('L10 insufficient baseline exports explicit missingness; current data retained, format/window transitions reuse capture and clear prepared PNG; ordinary manifests exclude comparison inputs');
 for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok((await page.getByLabel('Card category').boundingBox()).height>=44);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(here,'phone.png'),fullPage:true});
 await page.getByLabel('Player name, team or NHL ID').fill('McDavid');await page.getByRole('button',{name:/Connor McDavid.*8478402/}).click();assert.equal(await svg.count(),0);assert.equal((await page.evaluate(()=>globalThis.__cardApiCalls)).length,1);
 checks.push('390/320 responsive layout, native category control≥44px; another named selection clears comparison/artwork without fetching');
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 await writeFile(path.join(here,'BROWSER-VERIFICATION.json'),JSON.stringify({checks,exports,recent,previous,apiCalls:await page.evaluate(()=>globalThis.__cardApiCalls),externalAttempts:external,pageErrors:errors,newLiveRequests:0},null,2)+'\n');
 console.log(JSON.stringify({checks:checks.length,exports:exports.length,external,errors}));
}finally{await browser.close();}
