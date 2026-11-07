import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../../../web/package.json'));
const { chromium } = require('@playwright/test');
const checks = [], network = [], errors = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium', headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1500 } });
  await context.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
  await context.setOffline(true);
  const page = await context.newPage(); page.setDefaultTimeout(6000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(here, 'preview.html')).href);
  const svg = page.locator('svg[data-share-format]');
  const ready = () => page.getByRole('button', { name: 'Social Share', exact: true }).isEnabled();
  await page.waitForFunction(() => !!document.querySelector('svg[data-share-format]'));
  assert.ok(await ready());
  async function download(button, filename) {
    const control=page.getByRole('button', { name: button, exact: true });
    if (button==='Download manifest' && !await control.isVisible()) await page.getByText('Card values and provenance', {exact:true}).click();
    const [event] = await Promise.all([page.waitForEvent('download'), control.click()]);
    await event.saveAs(path.join(here, filename));
  }
  await page.getByText('Card values and provenance', { exact: true }).click();
  await download('Download manifest', 'matthews-landscape-manifest.json');
  const manifest = JSON.parse(await readFile(path.join(here, 'matthews-landscape-manifest.json'), 'utf8'));
  assert.equal(manifest.artwork.id, 8479318); assert.equal(manifest.statistics.representsPicturedPlayer, false);
  assert.equal(manifest.snapshot.id, await svg.getAttribute('data-snapshot-id'));
  assert.equal(manifest.artwork.alphaSha256, await svg.getAttribute('data-artwork-hash'));
  assert.ok((await page.locator('image').getAttribute('href')).startsWith('data:image/png;base64,'));
  for (const id of manifest.selectedMetrics) {
    const row = page.locator(`[data-metric-id="${id}"]`), reading = manifest.snapshot.readings.find(r => r.id === id);
    const expected = id === 'atoi' ? `${Math.floor(Math.round(reading.value * 60) / 60)}:${String(Math.round(reading.value * 60) % 60).padStart(2,'0')}` : `${reading.value.toFixed(['xgPct','ipp','shPct','oiShPct'].includes(id)?1:2)}${['xgPct','ipp','shPct','oiShPct'].includes(id)?'%':''}`;
    assert.equal(await row.locator('[data-actual-value]').textContent(), expected);
    assert.ok((await row.locator('[data-raw-rank]').textContent()).includes(`${reading.rank.tied?'T-':''}${reading.rank.ordinal}/${reading.rank.population}`));
    assert.ok((await row.locator('[data-percentile]').textContent()).includes(reading.rank.percentile.toFixed(1)));
  }
  await download('Download PNG', 'matthews-landscape.png');
  let png = await readFile(path.join(here,'matthews-landscape.png')); assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1200,1020]);
  await svg.screenshot({ path: path.join(here, 'desktop.png') });
  checks.push('Matthews artwork verified/embedded; nine actuals/ranks/percentiles reconcile to same manifest; real landscapePNG1200x1020');
  await page.getByLabel('Image format').selectOption('social-square');
  await page.getByLabel('Reviewed artwork').selectOption('8478864');
  await page.waitForFunction(() => document.querySelector('svg[data-share-format]')?.getAttribute('data-snapshot-id')?.startsWith('art-study-8478864'));
  await download('Download PNG', 'kaprizov-social-square.png');
  png = await readFile(path.join(here,'kaprizov-social-square.png')); assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1200,1200]);
  await download('Download manifest', 'kaprizov-social-manifest.json');
  assert.ok((await svg.textContent()).includes('KAPRIZOV'));
  assert.ok((await svg.textContent()).includes('NOT KIRILL KAPRIZOV’S RESULTS'));
  checks.push('Second accepted identity and team palette; square1200x1200 with explicit fictitious-stat warning');
  await page.getByRole('button',{name:'Social Share',exact:true}).click();
  await page.getByRole('button',{name:'Share prepared image'}).waitFor();
  await page.evaluate(() => {
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancelled','AbortError');}});
  });
  await page.getByRole('button',{name:'Share prepared image'}).click();
  await page.getByText('Sharing cancelled. Nothing was posted.',{exact:true}).waitFor();
  await page.evaluate(() => Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));
  await download('Share prepared image','share-fallback.png');
  assert.deepEqual(await readFile(path.join(here,'share-fallback.png')),png);
  await page.getByLabel('Image format').selectOption('landscape');
  assert.equal(await page.getByRole('button',{name:'Share prepared image'}).count(),0);
  checks.push('Native share cancellation performs no download/post; unsupported-share download equals prepared PNG; formatchange invalidates prepared image');
  await page.getByLabel('Statistics preview').selectOption('metric-gap');
  assert.ok((await page.locator('[data-metric-id="ixg60"] [data-unavailable]').textContent()).includes('Missing source'));
  await download('Download PNG','missing-metric.png');
  await page.getByLabel('Statistics preview').selectOption('history-gap');
  assert.ok((await svg.getAttribute('aria-label')).includes('GP unverified')); assert.ok(await page.getByRole('button',{name:'Download PNG',exact:true}).isDisabled());
  checks.push('Missing-source reason survives new artwork/export; unverifiedGP announced and export blocked');
  await page.getByLabel('Statistics preview').selectOption('complete'); await page.getByLabel('Image format').selectOption('social-square');
  await page.setViewportSize({width:390,height:844});
  await svg.screenshot({path:path.join(here,'phone-card.png')}); await page.screenshot({path:path.join(here,'phone-page.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  const heights=await page.getByRole('button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));assert.ok(heights.every(h=>h>=44));
  checks.push('Phone390px no horizontal overflow; controls44px; actual image and whole-page screenshots retained');
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  await writeFile(path.join(here,'browser-results.json'),JSON.stringify({checks,externalAttempts:network,pageErrors:errors},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,externalAttempts:network.length,pageErrors:errors.length}));
} catch(error) { await writeFile(path.join(here,'browser-failure.json'),JSON.stringify({error:String(error),checks,network,errors},null,2));throw error; }
finally { if(browser)await browser.close(); }
