import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1400}});
const page=await context.newPage(),network=[],errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
await context.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
await context.setOffline(true);
const ready=()=>page.getByText('Fixture snapshot ready.',{exact:true}).waitFor();
async function download(button,filename){const event=page.waitForEvent('download');await page.getByRole('button',{name:button,exact:true}).click();await(await event).saveAs(path.join(here,filename));}
async function capture(name){
  const text=await page.locator('svg').textContent(),id=await page.locator('svg').getAttribute('data-snapshot-id');
  await download('Download snapshot manifest',`${name}-manifest.json`);
  const manifest=JSON.parse(await readFile(path.join(here,`${name}-manifest.json`),'utf8'));
  assert.equal(manifest.snapshot.id,id);assert.equal(manifest.snapshot.source,'synthetic');
  for(const metric of manifest.selectedMetrics){const value=manifest.snapshot.readings.find(row=>row.id===metric);if(value.rank)assert.ok(text.includes(`${value.rank.ordinal} of ${value.rank.population}`));}
  await download('Download synthetic PNG',`${name}.png`);
  await page.getByText('Synthetic PNG downloaded from the displayed snapshot.').waitFor();
  const png=await readFile(path.join(here,`${name}.png`));assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1080);
  checks.push({name:`${name} PNG/manifest snapshot equality`,passed:true,snapshotId:id,gameIds:manifest.snapshot.sample.gameIds,settings:manifest.snapshot.settings});
  return manifest;
}
try{
  await page.goto(pathToFileURL(path.join(here,'preview.html')).href);await ready();
  await page.getByLabel('Appearances per player').selectOption('5');await ready();
  const l5=await capture('own-l5');assert.equal(l5.snapshot.sample.gp,5);assert.equal(l5.snapshot.sample.gameIds.length,5);
  await page.screenshot({path:path.join(here,'qa-desktop.png'),fullPage:true});
  await page.getByLabel('Appearances per player').selectOption('10');await ready();
  await page.goBack();await ready();assert.equal(await page.getByLabel('Appearances per player').inputValue(),'5');
  await page.goForward();await ready();assert.equal(await page.getByLabel('Appearances per player').inputValue(),'10');checks.push({name:'actual Back/Forward restores period',passed:true});
  await page.getByLabel('Period mode').selectOption('calendar');await ready();
  await page.getByLabel('Start date · inclusive UTC').fill('2026-10-17');await ready();
  const calendar=await capture('calendar');assert.equal(calendar.snapshot.settings.period.mode,'calendar');assert.equal(calendar.snapshot.settings.period.start,'2026-10-17');
  assert.notDeepEqual(calendar.snapshot.sample.gameIds,l5.snapshot.sample.gameIds);
  await page.getByLabel('Start date · inclusive UTC').fill('2026-10-30');await page.getByText('Invalid inclusive UTC calendar range',{exact:true}).waitFor();
  assert.ok((await page.getByRole('button',{name:'Retry local fixture'}).boundingBox()).height>=44);
  await page.getByRole('button',{name:'Retry local fixture'}).click();await page.getByText('Invalid inclusive UTC calendar range',{exact:true}).waitFor();
  await page.getByLabel('Start date · inclusive UTC').fill('2026-10-17');await ready();checks.push({name:'invalid-range recovery and touch-sized retry',passed:true});
  await page.getByLabel('Search example skaters').fill('Alex Morgan');
  await page.getByRole('button',{name:'Alex Morgan · Summit · C · ID 1002'}).click();await ready();assert.ok((await page.locator('svg').textContent()).includes('Example ID 1002'));
  await page.getByLabel('Search example skaters').fill('Jamie');await page.getByRole('button',{name:'Jamie Chen · Harbour · LW · ID 1004'}).click();await ready();
  await page.getByLabel('Period mode').selectOption('appearances');await ready();assert.ok((await page.locator('svg').textContent()).includes('3 of 10 GP'));
  checks.push({name:'duplicate identity and honestly short sample',passed:true});
  await page.getByLabel('Short season policy · proposed').selectOption('full');await page.getByText('Known short season sample excluded by the proposed full-N policy',{exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Download synthetic PNG',exact:true}).isDisabled());
  await page.getByLabel('Short season policy · proposed').selectOption('allow');await ready();
  await page.getByLabel('Source scenario · synthetic').selectOption('metric-gap');await page.getByText('Partial source: affected values and ranks are unavailable.',{exact:true}).waitFor();
  assert.ok((await page.locator('svg').textContent()).includes('—'));await capture('partial');
  await page.getByLabel('Source scenario · synthetic').selectOption('unknown-pool');await ready();assert.ok((await page.locator('svg').textContent()).includes('Rank unavailable · incomplete pool'));
  await page.getByLabel('Source scenario · synthetic').selectOption('history-gap');await page.getByText('Complete appearance history through the common cutoff is unverified',{exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Download synthetic PNG',exact:true}).isDisabled());
  await page.getByLabel('Source scenario · synthetic').selectOption('stale');await page.getByText('Source unavailable: no exportable values.',{exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Download synthetic PNG',exact:true}).isDisabled());
  checks.push({name:'partial/unknown/stale/history gates',passed:true});
  await page.getByLabel('Source scenario · synthetic').selectOption('complete');await ready();
  await page.getByLabel('Strength · synthetic coverage').selectOption('pp');await ready();assert.ok((await page.locator('svg').textContent()).includes('Power play'));
  await page.getByLabel('Card content · proposed').selectOption('extra');await page.screenshot({path:path.join(here,'qa-extra-pp.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(here,'qa-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByText('Read values, source states and coverage at text size',{exact:true}).click();assert.ok(await page.getByRole('heading',{name:'Opportunity',exact:true}).isVisible());
  await page.getByLabel('Card content · proposed').focus();await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle!=='none'));
  checks.push({name:'PP/extra/mobile/text reading/keyboard focus',passed:true});
  assert.equal(network.length,0);assert.equal(errors.length,0);checks.push({name:'zero external requests/page errors',passed:true});
  await writeFile(path.join(here,'browser-results.json'),JSON.stringify({checks,network,errors},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,PNGexports:3,network:network.length,errors:errors.length}));
}catch(error){await writeFile(path.join(here,'browser-failure.json'),JSON.stringify({error:String(error),network,errors,checks,body:await page.locator('body').innerText()},null,2)+'\n');throw error;}finally{await browser.close();}
