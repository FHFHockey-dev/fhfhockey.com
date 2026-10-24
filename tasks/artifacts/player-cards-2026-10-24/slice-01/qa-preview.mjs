import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../../../web/package.json'));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium', headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1300 } });
const page = await context.newPage();
const errors = [], network = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
await context.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
await context.setOffline(true);
try {
  await page.goto(pathToFileURL(path.join(here, 'preview.html')).href);
  await page.getByRole('heading', { name: 'The player. The numbers. The context.' }).waitFor();
  await page.screenshot({ path: path.join(here, 'qa-desktop.png'), fullPage: true });
  const svgText = await page.locator('svg').textContent();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download example PNG', exact: true }).click();
  await (await download).saveAs(path.join(here, 'preview.png'));
  await page.getByText('Synthetic example PNG downloaded.').waitFor();
  const manifestDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download example manifest' }).click();
  await (await manifestDownload).saveAs(path.join(here, 'manifest.json'));
  checks.push({ name: 'desktop export and manifest', passed: true, cardText: svgText });
  for (const kind of ['long-name','partial','missing']) {
    await page.getByLabel('Example scenario').selectOption(kind);
    await page.screenshot({ path: path.join(here, `qa-${kind}.png`), fullPage: true });
    checks.push({ name: `scenario ${kind}`, passed: true, cardText: await page.locator('svg').textContent() });
  }
  await page.getByLabel('Example scenario').selectOption('curated');
  await page.getByLabel('Card content · proposed').selectOption('extra');
  await page.screenshot({ path: path.join(here, 'qa-extra.png'), fullPage: true });
  await page.getByLabel('Card content · proposed').selectOption('curated');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(here, 'qa-mobile.png'), fullPage: true });
  checks.push({ name: 'mobile overflow', passed: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) });
  await page.getByText('Read card values at text size', { exact: true }).click();
  checks.push({ name: 'mobile reading size', passed: await page.getByRole('heading', { name: 'Opportunity', exact: true }).isVisible() });
  await page.getByLabel('Search example players').fill('unknown');
  await page.getByText('No example players found.').waitFor();
  await page.getByLabel('Search example players').fill('Alex');
  await page.getByRole('button', { name: 'Alex Morgan · Example Hockey Club · RW' }).click();
  checks.push({ name: 'fixture search empty / select', passed: true });
  await page.getByLabel('Card content · proposed').focus();
  await page.keyboard.press('Tab');
  checks.push({ name: 'keyboard focus', passed: await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none') });
  checks.push({ name: 'no external requests', passed: network.length === 0 }, { name: 'no browser errors', passed: errors.length === 0 });
  await writeFile(path.join(here, 'browser-results.json'), JSON.stringify({ checks, errors, network, syntheticOnly: true }, null, 2)+'\n');
  if (checks.some(check => !check.passed)) throw new Error('Browser check failed');
  console.log(JSON.stringify({ passed: checks.length, externalRequests: network.length, errors: errors.length, exportedPng: 'preview.png' }));
} catch (error) {
  await writeFile(path.join(here, 'browser-failure.json'), JSON.stringify({ error: String(error), errors, network, bodyText: await page.locator('body').innerText() }, null, 2)+'\n');
  throw error;
} finally { await browser.close(); }
