import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../../web/package.json')),{chromium}=require('@playwright/test'),sharp=require('sharp');
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true,timeout:10000});const checks=[],exports=[],external=[],errors=[];
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1264,height:1500}});
 await context.route(/^https?:/,route=>route.request().url().startsWith('http://127.0.0.1:3125/')?route.continue():(external.push(route.request().url()),route.abort()));
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3125/player-cards/production-example?playerId=8476453&season=20262027&count=5&cardFormat=production-by-game');
 assert.equal(await page.getByLabel('Card category').inputValue(),'production-by-game');
 await page.getByRole('button',{name:'Load NHL results',exact:true}).click();const svg=page.locator('svg[data-current-key]');await svg.waitFor();
 async function ready(){await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Download PNG'&&!b.disabled)&&document.querySelector('[data-hero-image="true"]'));}
 async function download(label,file){const b=page.getByRole('button',{name:label,exact:true});if(!await b.isVisible())await page.getByText('Source and metric definitions',{exact:true}).click();const [event]=await Promise.all([page.waitForEvent('download'),b.click()]);await event.saveAs(path.join(here,file));return readFile(path.join(here,file));}
 await ready();assert.equal(await svg.getAttribute('data-source'),'nhl-retained');
 for(const style of ['posterized-team-colors','pixelated-team-colors']){
  await page.getByLabel('Portrait style').selectOption(style);await ready();
  if(style==='posterized-team-colors'){await page.getByLabel('Outline color').selectOption('custom');await ready();await page.getByRole('button',{name:'Reset team stack',exact:true}).click();await ready();}
  const manifest=JSON.parse((await download('Download snapshot manifest',style+'-manifest.json')).toString());
  assert.equal(manifest.renderVersion,'fhfh-current-production-v1');assert.equal(manifest.chart.games.length,5);assert.equal(manifest.card.values.points,6);assert.equal(manifest.card.values.goals,3);assert.equal(manifest.card.values.assists,3);assert.equal(manifest.card.values.shots,22);
  const games=await svg.locator('[data-game-id]').evaluateAll(nodes=>nodes.map(n=>({id:Number(n.getAttribute('data-game-id')),points:Number(n.getAttribute('data-game-points')),date:n.getAttribute('data-game-date')})));
  assert.deepEqual(games,manifest.chart.games.map(g=>({id:g.gameId,points:g.points,date:g.providerDate})));
  assert.deepEqual(manifest.chart.games,[...manifest.card.evidence.selectedGames].reverse());assert.equal(manifest.card.previous,undefined);assert.equal(manifest.card.windows,undefined);
  const png=await download('Download PNG',style+'.png');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1200,1020]);
  const header=await sharp(png).extract({left:0,top:0,width:1200,height:338}).raw().toBuffer();const oldHeader=await sharp(await readFile(path.resolve(here,'../recent-comparison-15',style+'.png'))).extract({left:0,top:0,width:1200,height:338}).raw().toBuffer();assert.ok(header.equals(oldHeader),'Approved artwork header pixels unchanged');
  exports.push({style,sha256:createHash('sha256').update(png).digest('hex'),headerPixelsIdentical15:true});
 }
 await svg.screenshot({path:path.join(here,'production-card.png')});await page.screenshot({path:path.join(here,'desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Prepare social image',exact:true}).click();await page.getByRole('button',{name:'Share prepared image',exact:true}).waitFor();
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{globalThis.__sharedBytes=Array.from(new Uint8Array(await files[0].arrayBuffer()));}});});
 await page.getByRole('button',{name:'Share prepared image',exact:true}).click();await page.waitForFunction(()=>Array.isArray(globalThis.__sharedBytes));assert.equal(createHash('sha256').update(Buffer.from(await page.evaluate(()=>globalThis.__sharedBytes))).digest('hex'),exports[1].sha256);
 checks.push('Real saved NHL input→five chronological point stacks→raw totals/manifest parity; two PNGs; approved artwork header pixels identical15; social File bytes match export');
 for(const count of ['10','20']){await page.getByLabel('Own last appearances').selectOption(count);await ready();const expected=count==='10'?10:11;assert.equal(await svg.locator('[data-game-id]').count(),expected);assert.ok((await svg.textContent()).includes(`${expected}/${count} GP`));}
 await download('Download PNG','known-short-L20.png');
 await page.getByLabel('Card category').selectOption('recent-previous');await ready();assert.equal(await svg.locator('[data-production-chart]').count(),0);await page.getByLabel('Card category').selectOption('production-by-game');await page.getByLabel('Own last appearances').selectOption('5');await ready();assert.equal((await page.evaluate(()=>globalThis.__cardApiCalls)).length,1);
 checks.push('L10/L20 selected columns, honest11/20 sample; category transitions and window changes reuse one capture; no NHL calls');
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok((await page.getByLabel('Card category').boundingBox()).height>=44);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(here,'phone.png'),fullPage:true});
 await page.goto('http://127.0.0.1:3125/player-cards/live?playerId=8484387&season=20262027&count=10&cardFormat=production-by-game');assert.equal(await page.getByLabel('Card category').inputValue(),'production-by-game');assert.equal((await page.evaluate(()=>globalThis.__cardApiCalls)).length,0);
 checks.push('390/320 reflow and category target≥44px; live route exposes new category without auto-fetch');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await writeFile(path.join(here,'BROWSER-VERIFICATION.json'),JSON.stringify({checks,exports,external,errors,newNhlCalls:0},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,exports:exports.length,newNhlCalls:0}));
}finally{await browser.close();}
