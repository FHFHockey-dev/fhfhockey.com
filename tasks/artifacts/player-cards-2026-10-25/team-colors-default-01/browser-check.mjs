import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../../../web/package.json'));
const { chromium } = require('@playwright/test');
const checks = [], externalAttempts = [], pageErrors = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium', headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1500 } });
  await context.route(/^https?:/, route => { externalAttempts.push(route.request().url()); return route.abort(); });
  await context.setOffline(true);
  const page = await context.newPage(); page.setDefaultTimeout(6000); page.on('pageerror', e => pageErrors.push(e.message));
  const url = pathToFileURL(path.join(here, 'preview.html')).href;
  const svg = page.locator('svg[data-share-format]');
  async function ready(style) {
    await page.waitForFunction(style => document.querySelector('svg[data-portrait-key]')?.getAttribute('data-portrait-key')?.startsWith(style + ':'), style);
    assert.equal(await page.getByLabel('Portrait style').inputValue(), style);
    assert.equal(await page.getByRole('button', { name: 'Download PNG', exact: true }).isEnabled(), true);
  }
  async function download(button, file) {
    const control = page.getByRole('button', { name: button, exact: true });
    if (button === 'Download manifest' && !await control.isVisible()) await page.getByText('Card values and provenance', { exact: true }).click();
    const [event] = await Promise.all([page.waitForEvent('download'), control.click()]);
    await event.saveAs(path.join(here, file));
  }
  await page.goto(url); await ready('team-colors');
  assert.deepEqual(await page.getByLabel('Portrait style').locator('option').evaluateAll(ns => ns.map(n => n.value)), ['original', 'posterized', 'pixelated', 'team-colors']);
  await page.getByLabel('Reviewed artwork').selectOption('8478864');
  await page.waitForFunction(() => document.querySelector('svg[data-snapshot-id]')?.getAttribute('data-snapshot-id')?.startsWith('art-study-8478864'));
  await ready('team-colors');
  await download('Download manifest', 'default-manifest.json');
  const manifest = JSON.parse(await readFile(path.join(here, 'default-manifest.json'), 'utf8'));
  const prior = JSON.parse(await readFile(path.join(here, '../portrait-treatments-01/team-colors-manifest.json'), 'utf8'));
  assert.deepEqual(manifest.artwork.treatment, prior.artwork.treatment);
  assert.deepEqual(manifest.snapshot, prior.snapshot);
  const embedded = Buffer.from((await page.locator('image').getAttribute('href')).split(',')[1], 'base64');
  assert.equal(createHash('sha256').update(embedded).digest('hex'), manifest.artwork.treatment.renderedSha256);
  assert.equal(manifest.statistics.representsPicturedPlayer, false); assert.equal(manifest.liveActivation, false); assert.equal(manifest.premiumActivation, false);
  await download('Download PNG', 'default-card.png');
  const png = await readFile(path.join(here, 'default-card.png'));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 1020]);
  await svg.screenshot({ path: path.join(here, 'desktop-card.png') });
  await page.getByRole('button', { name: 'Social Share', exact: true }).click();
  await page.getByRole('button', { name: 'Share prepared image', exact: true }).waitFor();
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  await download('Share prepared image', 'share-fallback.png');
  assert.deepEqual(await readFile(path.join(here, 'share-fallback.png')), png);
  checks.push('Fresh default Team Colors; all variants retained; exact chosen portrait and snapshot preserved; displayed image hash/manifest and same-instance social/download PNG agree');
  await page.getByLabel('Portrait style').selectOption('original'); await ready('original');
  assert.equal(await page.getByRole('button', { name: 'Share prepared image', exact: true }).count(), 0);
  await page.reload(); await ready('original');
  await page.evaluate(() => localStorage.setItem('fhfh-player-card-portrait-v1', 'invalid'));
  await page.reload(); await ready('team-colors');
  checks.push('Explicit saved Original survives reload; invalid preference falls back to Team Colors; changing style invalidates prepared share');
  await page.getByLabel('Reviewed artwork').selectOption('8478864');
  await page.waitForFunction(() => document.querySelector('svg[data-snapshot-id]')?.getAttribute('data-snapshot-id')?.startsWith('art-study-8478864'));
  await ready('team-colors');
  await page.setViewportSize({ width: 390, height: 844 });
  await svg.screenshot({ path: path.join(here, 'phone-card.png') });
  await page.screenshot({ path: path.join(here, 'phone-page.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByLabel('Statistics preview').selectOption('metric-gap');
  assert.ok((await page.locator('[data-metric-id="ixg60"] [data-unavailable]').textContent()).includes('Missing source'));
  await page.getByLabel('Statistics preview').selectOption('history-gap');
  assert.ok((await svg.getAttribute('aria-label')).includes('GP unverified'));
  assert.equal(await page.getByRole('button', { name: 'Download PNG', exact: true }).isDisabled(), true);
  checks.push('Phone390 has no overflow; missing-source and unverified-GP behavior retained');
  assert.deepEqual(externalAttempts, []); assert.deepEqual(pageErrors, []);
  const result = { checks, externalAttempts, pageErrors, portraitSha256: manifest.artwork.treatment.renderedSha256, pngSha256: createHash('sha256').update(png).digest('hex') };
  await writeFile(path.join(here, 'browser-results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} catch (error) {
  await writeFile(path.join(here, 'browser-failure.json'), JSON.stringify({ error: String(error), checks, externalAttempts, pageErrors }, null, 2)); throw error;
} finally { if (browser) await browser.close(); }
