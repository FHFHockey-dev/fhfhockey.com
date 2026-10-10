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
  await page.getByLabel('Preview fixture').selectOption('mixed');
  await expect(weekly.getByText('3.6', { exact: true })).toHaveCount(0);
  await expect(weekly.getByText('Unavailable', { exact: true })).toHaveCount(6);
  await expect(weekly.getByText(/Mixed forecast vintages — weekly total unavailable/)).toBeVisible();
  await expect(weekly.getByText('Per-game coverage: 2 of 2 games')).toBeVisible();
  await expect(weekly.getByText('0.0', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Game 103 category forecasts').getByText('2.4', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Game 106 category forecasts').getByText('1.2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Game 106 category forecasts').getByText(/Model: different-model. Cutoff: 2026-10-07T13:30:00Z/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mixed-vintage-desktop.png'), fullPage: true });
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
  await page.getByLabel('Preview fixture').selectOption('mixed');
  await expect(weekly.getByText(/Mixed forecast vintages — weekly total unavailable/)).toBeVisible();
  await fits(page.getByRole('region', { name: 'Fixture Team 01 game previews' }), 320);
  await page.screenshot({ path: testInfo.outputPath('mixed-vintage-320.png'), fullPage: true });
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

test('real reader reaches expandable rows: qualified, partial, stale, legacy, error/retry and elapsed refresh', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  let reads = 0;
  let mode = 'qualified';
  const context = { seasonId: 20262027, scheduleRevision: 'http-schedule-r1', rosterRevision: 'http-roster-r1', rosterScope: 'skaters',
    games: [{ gameId: 103, startsAt: '2026-10-08T23:00:00Z', state: 'scheduled' },
      { gameId: 106, startsAt: '2026-10-11T23:00:00Z', state: 'scheduled' }] };
  const records = context.games.flatMap((game, index) => ['G', 'A'].map(category => ({
    teamId: 1, gameId: game.gameId, seasonId: context.seasonId, category, mean: category === 'A' ? 0 : index ? 1.24 : 2.44,
    unit: 'count', scope: 'full_game_regulation_overtime', conditioning: 'unconditional',
    creditDefinition: category === 'A' ? 'awarded_assists' : 'individual_goals_excluding_shootout',
    rosterScope: context.rosterScope, rosterRevision: context.rosterRevision, scheduleRevision: context.scheduleRevision,
    startsAt: game.startsAt, status: 'qualified', allowedUses: { totals: true, comparison: false },
    revisionId: 'http-output-' + game.gameId + category, modelVersion: 'http-model-v1', comparisonLineageId: 'http-run-r1', sourceWatermark: 'http-source-r1',
    sourceAvailableAt: '2026-10-07T13:00:00Z', cutoffAt: '2026-10-07T14:00:00Z', issuedAt: '2026-10-07T14:30:00Z',
    availableAt: '2026-10-07T14:31:00Z', expiresAt: '2026-10-07T22:00:00Z',
  })));
  await page.route('**/api/v1/projections/teams?*', async route => {
    reads++;
    expect(route.request().method()).toBe('GET');
    expect(route.request().url()).toContain('horizon=1');
    if (mode === 'error') return route.fulfill({ status: 503, json: { error: 'Fixture unavailable' } });
    const data = mode === 'legacy' ? [{ run_id: 'http-run-r1', game_id: 103, team_id: 1, proj_goals_es: 2, proj_goals_pp: 1, proj_goals_pk: null }]
      : mode === 'partial' ? records.filter(record => record.gameId === 103)
      : mode === 'stale' ? records.map(record => ({ ...record, expiresAt: '2026-10-07T16:00:00Z' }))
      : mode === 'mixed' ? records.map(record => record.gameId === 106 && record.category === 'G' ? { ...record, sourceWatermark: 'other-source' } : record)
      : records;
    await route.fulfill({ json: { asOfDate: '2026-10-07', horizonGames: 1, runId: 'http-run-r1', data, context } });
  });
  // Register the network boundary before the specific local fixture override.
  await page.clock.install({ time: new Date('2026-10-07T16:00:00Z') });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.fallback() : route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Show Fixture Team .* (?:upcoming category forecasts|team preview)/ })).toHaveCount(24);
  await trigger(page).focus(); await trigger(page).press('Enter');
  const weekly = panel(page).getByLabel('Remaining-week category forecasts');
  await expect(weekly.getByText('3.6', { exact: true })).toBeVisible();
  await expect(weekly.getByText('0.0', { exact: true })).toBeVisible();
  await expect(weekly.getByText('Unavailable', { exact: true })).toHaveCount(5);
  await expect(panel(page).getByText('Schedule retrieved: 2026-10-07T15:59:00Z.', { exact: false })).toHaveCount(2);
  expect(reads).toBe(1);
  await page.getByRole('button', { name: /Sort by Team/ }).first().click();
  await expect(weekly.getByText('3.6', { exact: true })).toBeVisible();
  expect(reads).toBe(1);
  await panel(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('reader-wiring-desktop.png'), fullPage: false });
  const refresh = async (next: string) => { mode = next; await page.clock.runFor(300001); };
  await refresh('partial');
  await expect(weekly.getByText('2.4', { exact: true })).toBeVisible();
  await expect(weekly.getByText('Known subtotal, 1 of 2 games', { exact: false })).toHaveCount(2);
  await refresh('mixed');
  await expect(weekly.getByText(/Mixed forecast vintages/)).toBeVisible();
  await expect(weekly.getByText('0.0', { exact: true })).toBeVisible();
  await refresh('stale');
  await expect(weekly.getByText('Unavailable', { exact: true })).toHaveCount(7);
  await refresh('legacy');
  await expect(panel(page).getByText(/1 lack the required category admission contract/)).toBeVisible();
  await expect(weekly.getByText('Unavailable', { exact: true })).toHaveCount(7);
  await refresh('error');
  await expect(panel(page).getByRole('button', { name: 'Retry team forecasts' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'Selected game previews' })).toBeVisible();
  mode = 'qualified';
  await panel(page).getByRole('button', { name: 'Retry team forecasts' }).focus();
  await panel(page).getByRole('button', { name: 'Retry team forecasts' }).press('Enter');
  await expect(weekly.getByText('3.6', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh schedule fixture' }).click();
  await expect(weekly.getByText('1.2', { exact: true })).toBeVisible();
  await expect(panel(page).getByText(/In progress/)).toBeVisible();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await page.setViewportSize({ width: 320, height: 844 });
  await fits(panel(page), 320);
  await page.screenshot({ path: testInfo.outputPath('reader-wiring-320.png'), fullPage: true });
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => (window as unknown as { axe: { run: () => Promise<AxeResults> } }).axe.run());
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
  await writeFile(testInfo.outputPath('reader-accessibility.json'), JSON.stringify({ violations: results.violations,
    passedRules: results.passes.map(({ id }) => id), incompleteRules: results.incomplete.map(({ id }) => id),
    incompleteNodes: results.incomplete.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, summary }) => ({ target, summary })) })), reads }, null, 2));
});
