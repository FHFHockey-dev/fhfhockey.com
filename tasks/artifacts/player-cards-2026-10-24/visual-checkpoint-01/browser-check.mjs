import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../../../web/package.json'));
const { chromium } = require('@playwright/test');
const checks = [], network = [], errors = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium', headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1264, height: 1240 } });
  await context.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
  await context.setOffline(true);
  const page = await context.newPage(); page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(here, 'preview.html')).href);
  await page.locator('svg[data-renderer="fhfh-editorial-checkpoint-01"]').waitFor();
  const svg = page.locator('svg');
  await svg.screenshot({ path: path.join(here, 'card-desktop.png') });
  await writeFile(path.join(here, 'card.svg'), await svg.evaluate(node => new XMLSerializer().serializeToString(node)));
  async function download(name, filename) {
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    await (await event).saveAs(path.join(here, filename));
  }
  await download('Download snapshot manifest', 'snapshot-manifest.json');
  const manifest = JSON.parse(await readFile(path.join(here, 'snapshot-manifest.json'), 'utf8'));
  assert.equal(manifest.snapshot.id, await svg.getAttribute('data-snapshot-id'));
  assert.equal(manifest.liveActivation, false); assert.equal(manifest.premiumActivation, false);
  assert.deepEqual(manifest.dimensions, { width: 1200, height: 900 });
  for (const id of manifest.selectedMetrics) {
    const row = page.locator(`[data-metric-id="${id}"]`), reading = manifest.snapshot.readings.find(r => r.id === id);
    const actual = await row.locator('[data-actual-value]').textContent();
    const expected = id === 'atoi' ? `${Math.floor(Math.round(reading.value * 60) / 60)}:${String(Math.round(reading.value * 60) % 60).padStart(2, '0')}` : `${reading.value.toFixed(['xgPct', 'ipp', 'shPct', 'oiShPct'].includes(id) ? 1 : 2)}${['xgPct', 'ipp', 'shPct', 'oiShPct'].includes(id) ? '%' : ''}`;
    assert.equal(actual, expected);
    assert.ok((await row.locator('[data-raw-rank]').textContent()).includes(`${reading.rank.tied ? 'T-' : ''}${reading.rank.ordinal}/${reading.rank.population}`));
    assert.ok((await row.locator('[data-percentile]').textContent()).includes(reading.rank.percentile.toFixed(1)));
    const bar = row.locator('[data-percentile-bar]');
    if (await bar.count()) assert.ok(Math.abs(Number(await bar.getAttribute('width')) - 274 * reading.rank.percentile / 100) < 1e-9);
  }
  checks.push({ name: 'all nine actuals, raw rank/N, percentiles and bar lengths reconcile to the same manifest snapshot', passed: true });
  await download('Download synthetic PNG', 'card.png');
  await page.getByRole('status').filter({ hasText: 'Synthetic PNG downloaded from the displayed snapshot.' }).waitFor();
  const png = await readFile(path.join(here, 'card.png'));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 900]);
  assert.equal(await svg.getAttribute('data-snapshot-id'), manifest.snapshot.id);
  checks.push({ name: 'actual native-canvas landscape PNG and unchanged displayed snapshot', passed: true, pngBytes: png.length, pngSha256: crypto.createHash('sha256').update(png).digest('hex') });
  const boxes = await svg.evaluate(node => [...node.querySelectorAll('text')].filter(t => t.getAttribute('x') === '1160').map(t => ({ text: t.textContent, x: t.getBBox().x, right: t.getBBox().x + t.getBBox().width })));
  assert.ok(boxes.every(box => box.x >= 0 && box.right <= 1161));
  assert.ok((await svg.getAttribute('aria-label')).includes('10 actual appearances'));
  assert.ok((await svg.textContent()).includes('SYNTHETIC FIXTURE'));
  assert.ok((await svg.textContent()).includes('ACTUAL PERCENTAGES'));
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => ({ tag: document.activeElement.tagName, outline: getComputedStyle(document.activeElement).outlineStyle }));
  assert.notEqual(focus.outline, 'none');
  checks.push({ name: 'synthetic/actual-ratio labels, accessible snapshot description, right-edge bounds and keyboard focus', passed: true, focus });
  await page.setViewportSize({ width: 390, height: 844 });
  await svg.screenshot({ path: path.join(here, 'card-phone.png') });
  await page.screenshot({ path: path.join(here, 'preview-phone.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const hitTargets = await page.getByRole('button').evaluateAll(buttons => buttons.map(b => b.getBoundingClientRect().height));
  assert.ok(hitTargets.every(height => height >= 44));
  checks.push({ name: '390px phone layout has no page overflow and export controls have 44px touch targets', passed: true, hitTargets });
  assert.deepEqual(network, []); assert.deepEqual(errors, []);
  await writeFile(path.join(here, 'browser-results.json'), JSON.stringify({ checks, externalAttempts: network, pageErrors: errors, snapshotId: manifest.snapshot.id }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, externalAttempts: network.length, pageErrors: errors.length }));
} catch (error) {
  await writeFile(path.join(here, 'browser-failure.json'), JSON.stringify({ error: String(error), checks, network, errors }, null, 2) + '\n');
  throw error;
} finally { if (browser) await browser.close(); }
