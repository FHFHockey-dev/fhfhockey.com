import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../../../web/package.json'));
const { chromium } = require('@playwright/test');
const view = JSON.parse(await readFile(path.join(here, 'OBSERVED-VIEW.json'), 'utf8'));
const network = [], errors = [], checks = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1500 } });
  await context.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); }); await context.setOffline(true);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(here, 'preview.html')).href);
  const svg = page.locator('svg');
  assert.equal(await svg.getAttribute('data-snapshot-id'), view.id);
  assert.equal(await svg.getAttribute('data-source'), 'local-observed');
  assert.ok((await svg.getAttribute('aria-label')).includes('GP unverified'));
  assert.equal(await page.getByRole('button', { name: 'Download PNG', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Social Share', exact: true }).isDisabled(), true);
  assert.deepEqual(await page.locator('[data-actual-value]').allTextContents(), ['—', '—', '—', '—', '—']);
  await svg.screenshot({ path: path.join(here, 'observed-desktop.png') });
  checks.push('Actual public-history identity reaches observed SVG through trusted server pipeline; unknown GP/metrics/ranks retained; PNG and Share correctly blocked');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await svg.screenshot({ path: path.join(here, 'observed-phone-card.png') });
  await page.getByText('Readable values and provenance', { exact: true }).click();
  assert.ok(await page.getByText('All12metric values and ranks remain unavailable.', { exact: false }).isVisible());
  await page.screenshot({ path: path.join(here, 'observed-phone-page.png'), fullPage: true });
  checks.push('Phone390 has no page overflow and readable expanded provenance outside artwork; fixed-width artwork fine print still requires zoom');
  assert.deepEqual(network, []); assert.deepEqual(errors, []);
  await writeFile(path.join(here, 'browser-results.json'), JSON.stringify({ checks, network, errors, actualObservedExport: 'blocked-unqualified', downloadedPng: false, screenshotsAreQaOnly: true }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, networkRequests: 0, pageErrors: 0, actualObservedExport: 'blocked-unqualified' }));
} catch (error) { await writeFile(path.join(here, 'browser-failure.json'), JSON.stringify({ error: String(error), checks, network, errors }, null, 2)); throw error; }
finally { if (browser) await browser.close(); }
