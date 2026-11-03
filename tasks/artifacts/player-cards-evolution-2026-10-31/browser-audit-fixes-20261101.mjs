import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(path.resolve(here, '../../../web/package.json'));
const { chromium } = require('@playwright/test'), sharp = require('sharp'), sha = b => createHash('sha256').update(b).digest('hex');
const results = [], requests = [], errors = [], downloads = [];
const browser = await chromium.launch({ executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium', headless: true, timeout: 10000 });
try {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1100 } });
  await context.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message)); page.on('download', d => downloads.push(d.suggestedFilename()));
  await page.goto(pathToFileURL(path.join(here, 'audit-fixes-repro-20261101.html')).href);
  for (const [name, accepted] of [['normal', true], ['long-token', false], ['wide-token', false], ['wrapped-wide', true]]) {
    await page.evaluate(name => globalThis.auditSelect(name), name);
    const probe = await page.evaluate(() => globalThis.auditProbe());
    assert.equal(probe.accepted, accepted, JSON.stringify(probe)); assert.equal(probe.ariaPreservesFullWarning, true);
    assert.ok(probe.spans.every(s => s.length > 0));
    if (name === 'long-token') { assert.equal(probe.truncated, true); assert.ok(probe.right <= 1160); assert.match(probe.spans.join(' '), /PNG export is unavailable/); }
    if (name === 'wide-token') { assert.equal(probe.truncated, false); assert.ok(probe.width > 1120); }
    const before = downloads.length;
    if (accepted) {
      const [download, status] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => globalThis.auditDownload())]);
      assert.equal(status.exported, true); const filename = `audit-fix-${name}-20261101.png`; await download.saveAs(path.join(here, filename));
      const bytes = await readFile(path.join(here, filename)), meta = await sharp(bytes).metadata(); assert.equal(meta.width, 1200); assert.equal(meta.height, 1020);
      probe.png = { filename, sha256: sha(bytes), width: meta.width, height: meta.height }; assert.ok(probe.right <= 1160);
    } else { const status = await page.evaluate(() => globalThis.auditDownload()); assert.equal(status.exported, false); assert.equal(downloads.length, before); }
    await writeFile(path.join(here, `audit-fix-${name}-manifest-20261101.json`), JSON.stringify(probe.manifest, null, 2) + '\n');
    probe.manifestPreservesFullWarning = JSON.stringify(probe.manifest.presentation.goalie.sharedProvenance.confirmationWarnings);
    delete probe.manifest; results.push(probe);
    if (name === 'long-token') await page.screenshot({ path: path.join(here, 'audit-fix-long-token-blocked-20261101.png') });
  }
  await page.goto(pathToFileURL(path.join(here, 'preview.html')).href);
  const notice = await page.getByText(/Offline review only\./).innerText();
  assert.match(notice, /Retained NHL observations and BLSH research/); assert.match(notice, /separately dated box comparisons/); assert.doesNotMatch(notice, /All other data are synthetic/);
  for (const selection of ['retained', 'retained-sasson']) {
    await page.getByLabel('Player', { exact: true }).selectOption(selection); await page.getByLabel('Analysis view').selectOption('evidence');
    const svg = page.locator('svg[data-analysis-key]'); assert.match(await svg.getAttribute('aria-label'), /RETAINED BLSH/);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download analysis PNG', exact: true }).click()]);
    const filename = `audit-fix-${selection}-20261101.png`; await download.saveAs(path.join(here, filename));
    const bytes = await readFile(path.join(here, filename)); results.push({ selection, retainedResearchExported: true, filename, sha256: sha(bytes) });
  }
  await page.setViewportSize({ width: 320, height: 960 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(here, 'audit-fix-preview-mobile-20261101.png'), fullPage: true });
  assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  await writeFile(path.join(here, 'AUDIT-FIXES-BROWSER-20261101.json'), JSON.stringify({ results, notice, mobileWidth: 320, requests, errors, downloads }, null, 2) + '\n');
  console.log('Exact URL and wide token blocked; normal/wrapped warnings and both retained research PNGs exported. Preview notice and320px passed.');
} finally { await browser.close(); }
