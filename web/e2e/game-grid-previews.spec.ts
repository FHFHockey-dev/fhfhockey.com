import { expect, test, Page, Locator } from '@playwright/test';
import axe from 'axe-core';
import { writeFile } from 'node:fs/promises';
import type { AxeResults } from 'axe-core';

async function fixture(page: Page, details = false) {
  await page.clock.install({ time: new Date('2026-10-07T16:00:00Z') });
  // Every network request is limited to this isolated local fixture server.
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(details ? '/?details=1' : '/');
}
const trigger = (page: Page, id = 1) => page.getByRole('button', { name: new RegExp(`(?:Show|Hide) Fixture Team ${String(id).padStart(2, '0')} (?:upcoming category forecasts|team preview)`) });
const panel = (page: Page, id = 1) => page.locator(`#game-grid-team-details-${id}`);
async function fits(locator: Locator, width: number) {
  const boxes = await locator.locator('dt, dd, button, a, h3, h4, h5, p').evaluateAll((nodes) => nodes.map((node) => {
    const box = node.getBoundingClientRect();
    return { left: box.left, right: box.right, width: box.width, scroll: node.scrollWidth, client: node.clientWidth };
  }));
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(width + 1);
    expect(box.scroll).toBeLessThanOrEqual(box.client + 1);
  }
}

test('24-team keyboard disclosures survive sorting, refresh, mode and orientation; a new week resets', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixture(page);
  await expect(page.getByRole('button', { name: /Show Fixture Team .* (?:upcoming category forecasts|team preview)/ })).toHaveCount(24);
  await trigger(page).focus();
  await trigger(page).press('Enter');
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(panel(page)).toBeVisible();
  await expect(page.locator(':focus')).toHaveCSS('outline-style', 'solid');
  await trigger(page, 24).focus();
  await trigger(page, 24).press('Space');
  await expect(panel(page, 24)).toBeVisible();
  const firstOrder = await page.locator('tbody tr button[aria-expanded]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  // The table repeats its header below the rows; use the upper Team control.
  await page.getByRole('button', { name: /Sort by Team/ }).first().click();
  const sortedOrder = await page.locator('tbody tr button[aria-expanded]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  expect(sortedOrder).not.toEqual(firstOrder);
  await expect(panel(page)).toBeVisible();
  await expect(panel(page, 24)).toBeVisible();
  await page.getByRole('button', { name: 'Refresh schedule fixture' }).click();
  await expect(panel(page).getByText(/In progress/)).toBeVisible();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(panel(page).getByLabel('Remaining-week category forecasts').getByText('Unavailable', { exact: true })).toHaveCount(7);
  await page.getByRole('button', { name: '10-Day', exact: true }).click();
  await expect(panel(page).getByRole('heading', { name: 'Selected 10-day game previews' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop-24-team-expanded.png'), fullPage: false });
  await page.getByRole('button', { name: 'Open grid controls' }).click();
  await page.getByRole('button', { name: 'Toggle orientation' }).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page, 24)).toBeVisible();
  await expect(panel(page).locator('..')).not.toHaveJSProperty('tagName', 'TD');
  await panel(page).getByRole('button', { name: /Close Fixture Team 01 game previews/ }).click();
  await expect(trigger(page)).toBeFocused();
  await expect(panel(page)).toHaveCount(0);
  await expect(panel(page, 24)).toBeVisible();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(panel(page, 24)).toHaveCount(0);
});

for (const width of [390, 320]) test(`expanded details reflow and stay keyboard reachable at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  await fixture(page);
  await expect(page.getByRole('button', { name: /Show Fixture Team .* (?:upcoming category forecasts|team preview)/ })).toHaveCount(24);
  await trigger(page).focus();
  await trigger(page).press('Enter');
  await expect(panel(page)).toBeVisible();
  const beforeSort = await page.locator('tbody tr button[aria-expanded]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  await page.getByRole('button', { name: 'Sort by games played', exact: true }).press('Enter');
  const afterSort = await page.locator('tbody tr button[aria-expanded]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  expect(afterSort).not.toEqual(beforeSort);
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await panel(page).scrollIntoViewIfNeeded();
  await fits(panel(page), width);
  await panel(page).evaluate((node) => node.scrollIntoView({ block: 'start', inline: 'nearest' }));
  const triggerBox = await trigger(page).boundingBox();
  expect(triggerBox!.width).toBeGreaterThanOrEqual(44);
  expect(triggerBox!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath(`narrow-${width}-expanded.png`), fullPage: false });
  const close = panel(page).getByRole('button', { name: /Close Fixture Team 01 game previews/ });
  await close.focus();
  await close.press('Space');
  await expect(trigger(page)).toBeFocused();
});

test('qualifying fixture payloads reconcile, preserve zero, and disclose partial, missing, stale and empty states', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await fixture(page, true);
  const weekly = page.getByLabel('Remaining-week category forecasts');
  await expect(weekly.getByText('3.6', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Game 103 category forecasts').getByText('2.4', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Game 106 category forecasts').getByText('1.2', { exact: true })).toBeVisible();
  await expect(weekly.getByText('0.0', { exact: true })).toBeVisible();
  await expect(weekly.getByText('Unavailable', { exact: true })).toHaveCount(5);
  await expect(page.getByText(/Model: fixture-model-v1. Cutoff:/)).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath('qualified-payload-desktop.png'), fullPage: true });
  await page.getByLabel('Preview fixture').selectOption('partial');
  await expect(weekly.getByText('Known subtotal, 1 of 2 games')).toBeVisible();
  await expect(weekly.getByText('2.4', { exact: true })).toBeVisible();
  await page.getByLabel('Preview fixture').selectOption('stale');
  await expect(weekly.getByText('Unavailable', { exact: true })).toHaveCount(6);
  await expect(page.getByText(/Forecast is stale or its expiry is unknown/)).toHaveCount(2);
  await page.getByLabel('Preview fixture').selectOption('missing');
  await expect(weekly.getByText('Unavailable', { exact: true })).toHaveCount(7);
  await expect(page.getByText(/Model: fixture-model-v1/)).toHaveCount(0);
  await page.getByLabel('Preview fixture').selectOption('bye');
  await expect(weekly.getByText('No remaining games')).toHaveCount(7);
  await page.getByLabel('Preview fixture').selectOption('unknown');
  await expect(weekly.getByText('Unavailable', { exact: true })).toHaveCount(7);
  await expect(weekly.getByText('No remaining games')).toHaveCount(0);
  await page.getByLabel('Preview fixture').selectOption('qualified');
  await page.setViewportSize({ width: 320, height: 844 });
  await fits(page.getByRole('region', { name: 'Fixture Team 01 game previews' }), 320);
  await page.screenshot({ path: testInfo.outputPath('qualified-payload-320.png'), fullPage: true });
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => (window as unknown as { axe: { run: () => Promise<AxeResults> } }).axe.run());
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
  const auditPath = testInfo.outputPath('accessibility-audit.json');
  await writeFile(auditPath, JSON.stringify({ engine: results.testEngine, url: results.url, viewport: 320, violations: results.violations, passedRules: results.passes.map(({ id }) => id), incompleteRules: results.incomplete.map(({ id }) => id) }, null, 2));
  await testInfo.attach('accessibility-audit.json', { path: auditPath, contentType: 'application/json' });
});

test('same-week refresh preserves open panels through partial and covered empty schedules', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixture(page);
  await trigger(page).click();
  await page.getByRole('button', { name: 'Partial schedule fixture' }).click();
  // Corrected schedule semantics withhold rows during an incomplete read.
  await expect(trigger(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh schedule fixture' }).click();
  await expect(panel(page)).toBeVisible();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Empty schedule fixture' }).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByLabel('Remaining-week category forecasts').getByText('No remaining games')).toHaveCount(7);
});
