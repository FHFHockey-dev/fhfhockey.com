import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../../../web/package.json'));
const { chromium } = require('@playwright/test');
const sharp = require('sharp');
const checks = [], network = [], errors = [], variants = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium', headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1500 } });
  await context.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
  await context.setOffline(true);
  const page = await context.newPage(); page.setDefaultTimeout(6000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(here, 'preview.html')).href);
  const svg = page.locator('svg[data-share-format]');
  async function ready(style) {
    await page.waitForFunction(style => {
      const svg = document.querySelector('svg[data-share-format]');
      return svg?.getAttribute('data-snapshot-id')?.startsWith('art-study-8478864') && svg.getAttribute('data-portrait-key')?.startsWith(style + ':');
    }, style);
    await page.getByRole('button', { name: 'Download PNG', exact: true }).waitFor();
  }
  async function download(button, filename) {
    const control = page.getByRole('button', { name: button, exact: true });
    if (button === 'Download manifest' && !await control.isVisible()) await page.getByText('Card values and provenance', { exact: true }).click();
    const [event] = await Promise.all([page.waitForEvent('download'), control.click()]);
    await event.saveAs(path.join(here, filename));
  }
  await page.getByLabel('Reviewed artwork').selectOption('8478864'); await ready('original');
  const original = await page.locator('image').getAttribute('href');
  let snapshot, metricPixels;
  for (const style of ['posterized', 'pixelated', 'team-colors']) {
    const started = performance.now();
    await page.getByLabel('Portrait style').selectOption(style); await ready(style);
    const elapsedMs = Math.round(performance.now() - started);
    const imageData = await page.locator('image').getAttribute('href');
    const alpha = await page.evaluate(async ({ original, imageData }) => {
      async function pixels(src) {
        const image = new Image(); image.src = src; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        return { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
      }
      const a = await pixels(original), b = await pixels(imageData);
      let alphaDifferences = 0, rgbDifferences = 0;
      for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) { if (i % 4 === 3) alphaDifferences++; else rgbDifferences++; }
      return { alphaDifferences, rgbDifferences, dimensions: [b.width, b.height], originalDimensions: [a.width, a.height] };
    }, { original, imageData });
    assert.equal(alpha.alphaDifferences, 0); assert.ok(alpha.rgbDifferences > 1000); assert.deepEqual(alpha.dimensions, alpha.originalDimensions);
    await download('Download manifest', `${style}-manifest.json`);
    const manifest = JSON.parse(await readFile(path.join(here, `${style}-manifest.json`), 'utf8'));
    assert.equal(manifest.artwork.treatment.style, style); assert.equal(manifest.artwork.treatment.sourceAlphaSha256, manifest.artwork.alphaSha256);
    assert.equal(manifest.statistics.representsPicturedPlayer, false); assert.equal(manifest.liveActivation, false);
    if (snapshot) assert.deepEqual(manifest.snapshot, snapshot); else snapshot = manifest.snapshot;
    const embedded = Buffer.from(imageData.split(',')[1], 'base64');
    const { createHash } = await import('node:crypto');
    assert.equal(createHash('sha256').update(embedded).digest('hex'), manifest.artwork.treatment.renderedSha256);
    await writeFile(path.join(here, `${style}-portrait.png`), embedded);
    await download('Download PNG', `${style}-card.png`);
    const png = await readFile(path.join(here, `${style}-card.png`)); assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 1020]);
    const body = await sharp(png).extract({ left: 0, top: 338, width: 1200, height: 682 }).raw().toBuffer();
    if (metricPixels) assert.deepEqual(body, metricPixels); else metricPixels = body;
    await svg.screenshot({ path: path.join(here, `${style}-screen.png`) });
    variants.push({ style, elapsedMs, ...alpha, renderedSha256: manifest.artwork.treatment.renderedSha256, pngBytes: png.length });
  }
  checks.push('Three actual card PNGs: identical snapshot and byte-identical analytics-region pixels; each transformed portrait hash matches manifest and displayed embedded bytes; alpha/dimensions unchanged');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('svg[data-portrait-key]')?.getAttribute('data-portrait-key')?.startsWith('team-colors:'));
  assert.equal(await page.getByLabel('Portrait style').inputValue(), 'team-colors');
  await page.getByLabel('Reviewed artwork').selectOption('8478864'); await ready('team-colors');
  await page.getByRole('button', { name: 'Social Share', exact: true }).click(); await page.getByRole('button', { name: 'Share prepared image' }).waitFor();
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  await download('Share prepared image', 'share-fallback.png');
  await download('Download manifest', 'reload-manifest.json');
  const reloaded = JSON.parse(await readFile(path.join(here, 'reload-manifest.json'), 'utf8'));
  const prior = JSON.parse(await readFile(path.join(here, 'team-colors-manifest.json'), 'utf8'));
  console.log(JSON.stringify({ reloadPortrait: reloaded.artwork.treatment, priorPortrait: prior.artwork.treatment }));
  assert.deepEqual(reloaded.artwork.treatment, prior.artwork.treatment);
  await download('Download PNG', 'reload-card.png');
  assert.deepEqual(await readFile(path.join(here, 'share-fallback.png')), await readFile(path.join(here, 'reload-card.png')));
  await page.getByLabel('Portrait style').selectOption('posterized'); await ready('posterized');
  assert.equal(await page.getByRole('button', { name: 'Share prepared image' }).count(), 0);
  checks.push('Style persists on reload; prepared social PNG equals the styled export; style change invalidates old prepared image');
  await page.getByLabel('Statistics preview').selectOption('metric-gap');
  assert.ok((await page.locator('[data-metric-id="ixg60"] [data-unavailable]').textContent()).includes('Missing source'));
  await download('Download PNG', 'missing-metric-card.png');
  await page.getByLabel('Statistics preview').selectOption('history-gap');
  assert.ok((await svg.getAttribute('aria-label')).includes('GP unverified')); assert.ok(await page.getByRole('button', { name: 'Download PNG', exact: true }).isDisabled());
  checks.push('Styled export retains missing-source explanation; unverified GP remains accessible and cannot export');
  await page.getByLabel('Statistics preview').selectOption('complete'); await page.getByLabel('Image format').selectOption('social-square');
  await download('Download PNG', 'posterized-social-square.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await svg.screenshot({ path: path.join(here, 'phone-card.png') }); await page.screenshot({ path: path.join(here, 'phone-page.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok((await page.locator('button,select').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height).filter(h => h > 0))).every(h => h >= 44));
  checks.push('Social square exported; mobile390 has no overflow and controls at least44px');
  const labels = { posterized: 'Posterized', pixelated: 'Pixelated', 'team-colors': 'Team colors' };
  const cards = await Promise.all(variants.map(async v => `<article><h2>${labels[v.style]}</h2><img alt="Kirill Kaprizov ${labels[v.style]} portrait; illustrative statistics" src="data:image/png;base64,${(await readFile(path.join(here, `${v.style}-card.png`))).toString('base64')}"><p>Same source photo · same synthetic snapshot</p></article>`));
  const comparison = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>FHFH portrait comparison</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#101214;color:#f2f1eb;font:18px Arial}h1{margin:0 0 8px;color:#07aae2}p{color:#b9bec3}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}h2{font-size:22px}img{width:100%;height:auto;display:block}a{color:#80dfff}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>FHFH / Three portrait treatments</h1><p>One reviewed Kaprizov photo. Original silhouette preserved. All statistics are fabricated. <a href="/player-cards">Open the interactive preview →</a></p><main>${cards.join('')}</main></html>`;
  await writeFile(path.join(here, 'comparison.html'), comparison);
  await page.setViewportSize({ width: 2400, height: 900 });
  await page.goto(pathToFileURL(path.join(here, 'comparison.html')).href); await page.screenshot({ path: path.join(here, 'comparison.png'), fullPage: true });
  assert.deepEqual(network, []); assert.deepEqual(errors, []);
  await writeFile(path.join(here, 'browser-results.json'), JSON.stringify({ checks, variants, externalAttempts: network, pageErrors: errors }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, variants, externalAttempts: 0, pageErrors: 0 }));
} catch (error) { await writeFile(path.join(here, 'browser-failure.json'), JSON.stringify({ error: String(error), checks, network, errors }, null, 2)); throw error; }
finally { if (browser) await browser.close(); }
