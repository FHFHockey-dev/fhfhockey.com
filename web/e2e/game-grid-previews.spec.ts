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

test('desktop sticky dates stay below the measured site navbar through resize and height changes', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date('2026-10-07T16:00:00Z'));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/?sticky-header=1');
  await page.addStyleTag({ content: '#root { padding-bottom: 100vh; }' });
  const navbar = page.locator('[data-site-header]');
  const overlay = page.locator('[class*="masterStickyHeaderOverlay"]');
  const table = page.locator('[class*="masterTableScroll"] table');
  const header = table.locator('thead');
  // Activate while the real header is behind the navbar but still above viewport zero.
  await header.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 58));
  await expect(overlay).toBeVisible();
  const aligned = async () => {
    const bottom = await navbar.evaluate(node => node.getBoundingClientRect().bottom);
    await expect.poll(() => overlay.evaluate(node => node.getBoundingClientRect().top)).toBeCloseTo(bottom, 0);
    const cells = await overlay.locator('th').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
    expect(cells.every(top => top >= bottom)).toBe(true);
  };
  await aligned();
  // A font/account/header change must update the offset without another scroll.
  await navbar.evaluate(node => node.style.setProperty('--fixture-header-height', '96px'));
  await aligned();
  await page.screenshot({ path: testInfo.outputPath('sticky-header-96px.png'), fullPage: false });
  await page.setViewportSize({ width: 1040, height: 900 });
  await navbar.evaluate(node => node.style.setProperty('--fixture-header-height', '56px'));
  // Responsive control wrapping can move the real header back below the navbar.
  // Re-establish the sticky precondition before checking the new offset.
  await header.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 20));
  await aligned();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(overlay).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await header.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 20));
  await aligned();
  await table.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().bottom - 60));
  await expect(overlay).toHaveCount(0);
});

for (const width of [320, 390, 430, 479]) test(`mobile grid fits all summary columns without preview controls at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  await fixture(page);
  const grid = page.locator('table').filter({ has: page.getByRole('button', { name: 'Sort by games played', exact: true }) });
  const teamLinks = grid.locator('tbody tr td:first-child a');
  await expect(teamLinks).toHaveCount(24);
  await expect(trigger(page)).toHaveCount(0);
  await expect(grid.locator('tbody button[aria-expanded]')).toHaveCount(0);
  await expect(grid.getByText('HQ', { exact: true })).toHaveCount(0);
  await expect(page.locator('[id^="game-grid-team-details-"]')).toHaveCount(0);
  const bounds = await grid.evaluate((table) => {
    const box = table.getBoundingClientRect();
    const cells = Array.from(table.querySelectorAll('tbody tr:last-child td')).map(cell => {
      const rect = cell.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    return { left: box.left, right: box.right, cells, scroll: table.parentElement!.scrollWidth, client: table.parentElement!.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(width + 1);
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
  expect(bounds.cells).toHaveLength(11);
  for (const cell of bounds.cells.slice(-3)) {
    expect(cell.left).toBeGreaterThanOrEqual(0);
    expect(cell.right).toBeLessThanOrEqual(width + 1);
  }
  const beforeSort = await teamLinks.evaluateAll(links => links.map(link => link.getAttribute('href')));
  await page.getByRole('button', { name: 'Sort by games played', exact: true }).press('Enter');
  const afterSort = await teamLinks.evaluateAll(links => links.map(link => link.getAttribute('href')));
  expect(afterSort).not.toEqual(beforeSort);
  await expect(teamLinks.first()).toHaveAttribute('href', /\/stats\/team\/F\d+/);
  await page.screenshot({ path: testInfo.outputPath(`mobile-${width}-compact.png`), fullPage: false });
  await page.getByRole('button', { name: '7-Day', exact: true }).click();
  await expect(page.getByRole('button', { name: '10-Day', exact: true })).toBeVisible();
  await expect(trigger(page)).toHaveCount(0);
  await expect(page.locator('[id^="game-grid-team-details-"]')).toHaveCount(0);
  await page.getByRole('button', { name: '10-Day', exact: true }).click();
  await expect(teamLinks).toHaveCount(24);
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
  await expect(panel(page).getByRole('button', { name: 'Refresh team forecasts' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'Selected game previews' })).toBeVisible();
  mode = 'qualified';
  await panel(page).getByRole('button', { name: 'Refresh team forecasts' }).focus();
  await panel(page).getByRole('button', { name: 'Refresh team forecasts' }).press('Enter');
  await expect(weekly.getByText('3.6', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh schedule fixture' }).click();
  await expect(weekly.getByText('1.2', { exact: true })).toBeVisible();
  await expect(panel(page).getByText(/In progress/)).toBeVisible();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger(page)).toHaveCount(0);
  await page.setViewportSize({ width: 1180, height: 900 });
  await expect(panel(page)).toBeVisible();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({ path: testInfo.outputPath('reader-wiring-restored-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger(page)).toHaveCount(0);
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => (window as unknown as { axe: { run: () => Promise<AxeResults> } }).axe.run());
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
  await writeFile(testInfo.outputPath('reader-accessibility.json'), JSON.stringify({ violations: results.violations,
    passedRules: results.passes.map(({ id }) => id), incompleteRules: results.incomplete.map(({ id }) => id),
    incompleteNodes: results.incomplete.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target }) => ({ target })) })), reads }, null, 2));
});

test('keyboard refresh keeps focus in the open preview during delayed loading, success and failure', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.clock.install({ time: new Date('2026-10-07T16:00:00Z') });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.fallback() : route.abort());
  let mode = 'error'; let hold = false; let reads = 0; let release: (() => void) | undefined;
  const context = { seasonId: 20262027, scheduleRevision: 'focus-schedule', rosterRevision: 'focus-roster', rosterScope: 'skaters',
    games: [{ gameId: 103, startsAt: '2026-10-08T23:00:00Z', state: 'scheduled' }] };
  const record = { teamId: 1, gameId: 103, seasonId: context.seasonId, category: 'G', mean: 3,
    unit: 'count', scope: 'full_game_regulation_overtime', conditioning: 'unconditional', creditDefinition: 'individual_goals_excluding_shootout',
    rosterScope: 'skaters', rosterRevision: context.rosterRevision, scheduleRevision: context.scheduleRevision, startsAt: context.games[0].startsAt,
    status: 'qualified', allowedUses: { totals: true, comparison: false }, revisionId: 'focus-output', modelVersion: 'focus-model',
    comparisonLineageId: 'focus-run', sourceWatermark: 'focus-source', sourceAvailableAt: '2026-10-07T13:00:00Z', cutoffAt: '2026-10-07T14:00:00Z',
    issuedAt: '2026-10-07T14:30:00Z', availableAt: '2026-10-07T14:31:00Z', expiresAt: '2026-10-07T22:00:00Z' };
  await page.route('**/api/v1/projections/teams?*', async route => {
    reads++;
    if (hold) await new Promise<void>(resolve => { release = resolve; });
    if (mode === 'error') return route.fulfill({ status: 503, json: { error: 'Unavailable fixture' } });
    await route.fulfill({ json: { asOfDate: '2026-10-07', horizonGames: 1, runId: 'focus-run', data: [record], context } });
  });
  await page.goto('/');
  const initialUrl = page.url();
  await trigger(page).focus(); await trigger(page).press('Enter');
  await expect(panel(page).getByText(/Team forecast reader unavailable/)).toBeVisible();
  const button = panel(page).getByRole('button', { name: 'Refresh team forecasts' });
  await button.focus();
  mode = 'qualified'; hold = true;
  await button.press('Enter');
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect.poll(() => release !== undefined).toBe(true);
  const pendingReads = reads;
  await button.press('Enter');
  expect(reads).toBe(pendingReads);
  release!(); release = undefined;
  await expect(panel(page).getByLabel('Remaining-week category forecasts').getByText('3.0', { exact: true })).toBeVisible();
  await expect(button).toBeFocused();
  await expect(button).not.toHaveAttribute('aria-disabled', 'true');
  mode = 'error';
  await button.press('Enter');
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button).toBeFocused();
  await expect.poll(() => release !== undefined).toBe(true);
  release!();
  await expect(panel(page).getByText(/Team forecast reader unavailable/)).toBeVisible();
  await expect(button).toBeFocused();
  await expect(button).not.toHaveAttribute('aria-disabled', 'true');
  expect(page.url()).toBe(initialUrl);
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await button.press('Shift+Tab');
  await expect(panel(page).getByRole('button', { name: /Close preview|Close Fixture Team 01 game previews/ })).toBeFocused();
  await page.locator(':focus').press('Enter');
  await expect(trigger(page)).toBeFocused();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
});

// Real 2025-03-17 week replayed on the fixture week (see fixtures/game-grid-previews/README.md).
async function realWeek(page: Page) {
  // Before the fixture week, so no day is auto-excluded as already played.
  await page.clock.install({ time: new Date('2026-10-04T16:00:00Z') });
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/?teams=32');
}
const realRows = (page: Page, width: number) => width >= 1024
  ? page.locator('tbody tr:has([id^="game-grid-master-trigger-"])')
  : page.locator('table').filter({ has: page.getByRole('button', { name: 'Sort by games played', exact: true }) }).locator('tbody tr:has(td:first-child a)');
const column = (rows: Locator, index: number) => rows.evaluateAll((trs, i) => trs.map((tr) => tr.querySelectorAll('td')[i]?.textContent?.trim() ?? ''), index);
const gpSum = async (rows: Locator) => (await column(rows, await rows.first().locator('td').count() === 11 ? 8 : 10)).reduce((sum, value) => sum + Number(value), 0);

for (const width of [1920, 1180, 390, 320]) test(`32-team real week keeps rows, totals and rankings through day masks and schedule states at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width >= 1024 ? 1000 : 844 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await realWeek(page);
  const rows = realRows(page, width);
  await expect(rows).toHaveCount(32);
  expect(await gpSum(rows)).toBe(104);
  if (width >= 1024) {
    const totals = page.locator('tr', { hasText: 'GP/Day' }).first().locator('td');
    expect((await totals.allTextContents()).slice(3, 11)).toEqual(['5', '9', '2', '14', '1', '14', '7', '52']);
    await page.getByRole('button', { name: 'Sort by Score descending' }).first().click();
    const scores = (await column(rows, width >= 1024 ? 12 : 10)).map(Number);
    expect(scores.every((score, i) => i === 0 || scores[i - 1] >= score)).toBe(true);
  } else {
    const fit = await rows.first().evaluate((tr) => ({ cells: tr.querySelectorAll('td').length,
      scroll: tr.closest('table')!.parentElement!.scrollWidth, client: tr.closest('table')!.parentElement!.clientWidth }));
    expect(fit.cells).toBe(11);
    expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1);
  }
  await page.screenshot({ path: testInfo.outputPath(`real-week-32-${width}.png`), fullPage: false });
  // Excluding Thursday (14 games) leaves 2 × 38 team games; restoring it returns all 52.
  await page.getByRole('switch', { name: 'Include THU games' }).first().click();
  await expect.poll(() => gpSum(rows)).toBe(76);
  await page.getByRole('switch', { name: 'Include THU games' }).first().click();
  await expect.poll(() => gpSum(rows)).toBe(104);
  // A postponement removes one game from both teams and from Thursday's slate only.
  await page.getByRole('button', { name: 'Postponed schedule fixture' }).click();
  await expect.poll(() => gpSum(rows)).toBe(102);
  if (width >= 1024) expect((await page.locator('tr', { hasText: 'GP/Day' }).first().locator('td').allTextContents())[6]).toBe('13');
  await page.getByRole('button', { name: 'Partial schedule fixture' }).click();
  await expect(page.getByText(/Selected schedule incomplete: 6\/7 days covered/)).toBeVisible();
  await expect(rows).toHaveCount(0);
  await page.getByRole('button', { name: 'Empty schedule fixture' }).click();
  await expect(rows).toHaveCount(32);
  expect(await gpSum(rows)).toBe(0);
  expect(new Set(await column(rows, width >= 1024 ? 12 : 10))).toEqual(new Set(['-']));
  expect(errors).toEqual([]);
});

test('32-team stale schedule receipts are disclosed in previews and never become forecast totals', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await realWeek(page);
  await page.getByRole('button', { name: 'Stale schedule fixture' }).click();
  const bos = page.getByRole('button', { name: /Show Real Week BOS (?:upcoming category forecasts|team preview)/ });
  const id = await bos.getAttribute('aria-controls');
  await bos.click();
  const details = page.locator(`#${id}`);
  await expect(details.getByText(/Schedule retrieved: 2026-09-30T12:00:00Z\. Provider source freshness unavailable\./).first()).toBeVisible();
  await expect(details.getByLabel('Remaining-week category forecasts').getByText('Unavailable', { exact: true })).toHaveCount(7);
});


for (const width of [1440, 520]) test(`Game Grid UI corrections keep info readable and controls unchanged at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await fixture(page);
  if (width >= 1024) await page.goto('/?sticky-header=1');
  await expect(page.getByRole('button', { name: /^(Skaters|Goalies)$/ })).toHaveCount(0);
  const help = page.getByRole('button', { name: 'Week Score i', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Week score formula' });
  const grid = width >= 1024 ? page.locator('[class*="masterTableScroll"] table')
    : page.locator('table').filter({ has: page.getByRole('button', { name: 'Sort by games played', exact: true }) });
  const rowsBefore = await grid.locator('tbody').innerText();
  if (width >= 1024) {
    const legend = page.getByRole('group', { name: 'Game Grid legend' });
    const summary = legend.locator('summary[aria-label="Info about Game Grid metrics"]');
    await expect(summary).toHaveCount(1);
    await expect(page.locator('[class*="masterTableShell"] summary')).toHaveCount(0);
    await summary.press('Enter');
    await expect(legend.getByText(/Metrics per game/)).toBeVisible();
    await expect(legend.getByText(/Lower OPP%/)).toBeVisible();
    await summary.press('Enter');
    await expect(summary.locator('..')).not.toHaveAttribute('open');
  }
  await page.screenshot({ path: testInfo.outputPath(`game-grid-legend-full-${width}.png`), fullPage: false });
  await help.focus();
  await help.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await expect(dialog.getByText(/Adjusted Team Games = Team Games/)).toBeVisible();
  const readable = async () => {
    const bounds = await dialog.evaluate(node => {
      const box = node.getBoundingClientRect();
      const points = [0.1, 0.5, 0.9].map(part => ({ x: box.left + box.width / 2, y: box.top + box.height * part }));
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
        portaled: node.parentElement === document.body,
        unobscured: points.every(({x, y}) => node.contains(document.elementFromPoint(x, y))) };
    });
    const viewport = page.viewportSize()!;
    const headerBottom = await page.locator('[data-site-header]').evaluateAll(nodes =>
      Math.max(0, ...nodes.map(node => node.getBoundingClientRect().bottom)));
    const drawerTop = await page.locator('#gg-bottom-drawer').evaluate(node => {
      const box = node.getBoundingClientRect();
      return box.height > 0 ? box.top : window.innerHeight;
    });
    expect(bounds.portaled).toBe(true);
    expect(bounds.left).toBeGreaterThanOrEqual(8);
    expect(bounds.right).toBeLessThanOrEqual(viewport.width - 7);
    expect(bounds.top).toBeGreaterThanOrEqual(headerBottom + 8);
    expect(bounds.bottom).toBeLessThanOrEqual(drawerTop - 7);
    expect(bounds.bottom).toBeLessThanOrEqual(viewport.height - 7);
    expect(bounds.unobscured).toBe(true);
  };
  await readable();
  await page.screenshot({ path: testInfo.outputPath(`game-grid-help-${width}.png`), fullPage: false });
  // Keep the anchor visible while scrolling; the body portal follows it.
  await page.evaluate(() => window.scrollBy(0, 20));
  await readable();
  await page.setViewportSize({ width, height: 420 });
  await expect.poll(() => dialog.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(413);
  await readable();
  if (width >= 1024) {
    await page.locator('[data-site-header]').evaluate(node => node.style.setProperty('--fixture-header-height', '96px'));
    await expect.poll(() => dialog.evaluate(node => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(104);
    await readable();
  }
  await page.screenshot({ path: testInfo.outputPath(`game-grid-help-short-${width}.png`), fullPage: false });
  await dialog.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(dialog.getByText(/Adjusted Team Games = Team Games/)).toBeInViewport();
  await dialog.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(help).toBeFocused();
  await help.press('Enter');
  await page.getByRole('button', { name: 'Next week', exact: true }).focus();
  await expect(dialog).toHaveCount(0);
  await help.click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: '7-Day', exact: true }).dispatchEvent('pointerdown', { pointerType: 'touch' });
  await expect(dialog).toHaveCount(0);
  expect(await grid.locator('tbody').innerText()).toEqual(rowsBefore);
  await page.screenshot({ path: testInfo.outputPath(`game-grid-legend-${width}.png`), fullPage: false });
  await help.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Skaters|Goalies)$/ })).toHaveCount(0);
});


for (const width of [1440, 1024, 520, 390, 320]) for (const warning of [true, false]) {
  test(`Game Grid legend and warning footer at ${width}px with warning ${warning ? 'present' : 'absent'}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    if (!warning) await page.goto('/?complete-schedule=1');
    // Match production's global box sizing without importing remote fonts/assets.
    await page.addStyleTag({ content: '* { box-sizing: border-box; }' });
    const footer = page.locator('[data-game-grid-warning-footer]');
    const message = 'Schedule incomplete. Affected totals are unavailable; check back after schedule updates.';
    await expect(footer).toHaveCount(1);
    if (warning) {
      await expect(footer.getByRole('status')).toHaveText(message);
      await expect(page.getByRole('status').filter({ hasText: message })).toHaveCount(1);
      const fit = await footer.evaluate(node => {
        const parent = node.parentElement!;
        const box = node.getBoundingClientRect(), controls = parent.getBoundingClientRect();
        const style = getComputedStyle(parent), text = node.querySelector('[role="status"]')!;
        const warning = text.getBoundingClientRect();
        return { left: box.left, right: box.right, bottom: box.bottom,
          warningLeft: warning.left, warningRight: warning.right, warningBottom: warning.bottom,
          expectedLeft: controls.left + parseFloat(style.borderLeftWidth),
          expectedRight: controls.right - parseFloat(style.borderRightWidth),
          expectedBottom: controls.bottom - parseFloat(style.borderBottomWidth),
          scroll: text.scrollWidth, client: text.clientWidth };
      });
      expect(fit.left).toBeCloseTo(fit.expectedLeft, 0);
      expect(fit.right).toBeCloseTo(fit.expectedRight, 0);
      expect(fit.bottom).toBeCloseTo(fit.expectedBottom, 0);
      expect(fit.warningLeft).toBeCloseTo(fit.left, 0);
      expect(fit.warningRight).toBeCloseTo(fit.right, 0);
      expect(fit.warningBottom).toBeCloseTo(fit.bottom, 0);
      expect(fit.left).toBeGreaterThanOrEqual(0);
      expect(fit.right).toBeLessThanOrEqual(width + 1);
      expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1);
    } else {
      await expect(footer).toBeHidden();
      await expect(footer.getByRole('status')).toHaveCount(0);
      await expect(page.getByRole('status').filter({ hasText: message })).toHaveCount(0);
      expect(await footer.evaluate(node => node.getBoundingClientRect().height)).toBe(0);
    }
    if (width >= 1024) {
      const legend = page.getByRole('group', { name: 'Game Grid legend' });
      const summary = legend.locator('summary[aria-label="Info about Game Grid metrics"]');
      await expect(summary).toHaveCount(1);
      await expect(legend.getByRole('status')).toHaveCount(0);
      const swatches = await legend.locator('ul').boundingBox();
      const info = await summary.boundingBox();
      expect(info!.x).toBeGreaterThan(swatches!.x + swatches!.width);
      await summary.press('Enter');
      await expect(legend.getByText(/Metrics per game/)).toBeVisible();
      await expect(legend.getByText(/Lower OPP%/)).toBeVisible();
      const contentFits = await summary.locator('..').evaluate(node => node.scrollWidth <= node.clientWidth + 1);
      expect(contentFits).toBe(true);
      await summary.press('Enter');
    }
    if (width >= 1024) {
      const sizes = await page.evaluate(() => ({
        header: document.querySelector('[class*="gameGridHeaderContent"]')!.getBoundingClientRect().height,
        controls: document.querySelector('[class*="controlsBar"]')!.getBoundingClientRect().height,
      }));
      expect(sizes.header).toBeCloseTo(sizes.controls, 0);
    }
    await expect(page.getByRole('button', { name: /^(Skaters|Goalies)$/ })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`legend-footer-${width}-${warning ? 'warning' : 'complete'}.png`), fullPage: false });
  });
}

for (const timezoneId of ['UTC', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Auckland']) {
  test(`four-week opportunity keeps future NHL Sunday starts across viewer midnight in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId, viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      await page.clock.install({ time: new Date('2026-11-01T23:00:00Z') });
      await page.clock.setFixedTime(new Date('2026-11-01T23:00:00Z'));
      await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      await page.goto('/?teams=32&opportunity=1');
      const sparks = page.getByRole('button', { name: / 4-week opportunity / });
      await expect(sparks).toHaveCount(32);
      const values = await sparks.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')!.match(/4-week opportunity ([^,;]+)/)![1]));
      expect(values.filter(v => v === '1.3')).toHaveLength(14);
      expect(values.filter(v => v === '0.0')).toHaveLength(18);
      expect(new Set(await sparks.locator('svg').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-shared-scale'))))).toEqual(new Set(['2']));
      const target = page.getByRole('button', { name: / 4-week opportunity 1\.3[,;]/ }).first();
      await target.focus();
      const card = page.getByRole('tooltip');
      await expect(card).toBeVisible();
      await expect(card.getByText('Oct 26', { exact: true })).toBeVisible();
      await expect(card.getByText('1 GP · 1 OFF', { exact: true })).toBeVisible();
      await target.press('Escape');
      await expect(card).toHaveCount(0);
      await expect(target).toBeFocused();
    } finally { await context.close(); }
  });
}

for (const width of [1920, 1440, 1024, 520, 390, 320]) for (const dayCount of width >= 1024 ? [7, 10] : [7]) test(`opponent ratings and four-week opportunity expand independently at ${width}px in ${dayCount}-day mode`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await fixture(page);
  await page.goto('/?teams=32&opportunity=1');
  await page.addStyleTag({ content: '* { box-sizing: border-box; }' });
  if (dayCount === 10) await page.getByRole('button', { name: '10-Day', exact: true }).click();
  let gridWidths: number[] | undefined;
  const opponent = page.getByRole('button', { name: 'Expand opponent details' }).first();
  const fourWeek = page.getByRole('button', { name: 'Expand four-week columns' }).first();
  await expect(opponent).toHaveAttribute('aria-expanded', 'false');
  await expect(fourWeek).toHaveAttribute('aria-expanded', 'false');
  const check = async (left: boolean, right: boolean) => {
    if (width >= 1024) {
      const table = page.locator('[class*="masterTableScroll"] table');
      const expected = 2 + (left ? 7 : 0) + 1 + dayCount + 3 + (right ? 5 : 2);
      await expect(table.locator('col')).toHaveCount(expected);
      const widths = await table.locator('col').evaluateAll(cols => cols.map(col => col.getBoundingClientRect().width));
      // Team and day columns keep one width in every expansion state.
      const grid = widths.slice(left ? 9 : 2, (left ? 9 : 2) + 1 + dayCount);
      if (!gridWidths) gridWidths = grid;
      else grid.forEach((gridWidth, index) => expect(gridWidth).toBeCloseTo(gridWidths![index], 0));
      const geometry = await table.evaluate(node => ({ width: node.getBoundingClientRect().width, container: node.parentElement!.clientWidth, center: (node.getBoundingClientRect().left + node.getBoundingClientRect().right) / 2, parentCenter: (node.parentElement!.getBoundingClientRect().left + node.parentElement!.getBoundingClientRect().right) / 2 }));
      if (geometry.width <= geometry.container) expect(geometry.center).toBeCloseTo(geometry.parentCenter, 0);
      // Collapsed groups fit everywhere; fully expanded groups fit once the container holds their minimums.
      if (!left || width >= 1920) expect(geometry.width).toBeLessThanOrEqual(Math.max(geometry.container, 380 + 72 + dayCount * 80 + 248 + 288) + 1);
      if (width >= 1920) expect(geometry.width).toBeLessThanOrEqual(geometry.container + 1);
      const rows = table.locator('tbody tr').filter({ has: page.locator('[id^="game-grid-master-trigger-"]') });
      await expect(rows).toHaveCount(32);
      expect(await rows.evaluateAll(trs => new Set(trs.map(tr => tr.querySelectorAll('td').length)).size)).toBe(1);
      expect(await rows.first().locator('td').count()).toBe(expected);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  };
  await check(false, false);
  await opponent.click();
  await check(true, false);
  await fourWeek.click();
  await check(true, true);
  await page.getByRole('button', { name: 'Collapse opponent details' }).first().click();
  await check(false, true);
  await page.getByRole('button', { name: 'Collapse four-week columns' }).first().click();
  await check(false, false);
  await expect(page.getByRole('button', { name: /^(Skaters|Goalies)$/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`compact-opportunity-${width}-${dayCount}.png`), fullPage: false });
});

test('four-week opportunity preserves unknown gaps and exposes touch and keyboard context', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto('/?opportunity=1&gap=1');
  const target = page.getByRole('button', { name: /^F1 4-week opportunity / });
  await expect(target).toHaveAccessibleName(/^F1 4-week opportunity —/);
  await expect(target.locator('circle')).toHaveCount(3);
  expect((await target.locator('path[stroke]:not([filter])').getAttribute('d'))!.match(/M/g)).toHaveLength(2);
  await target.click();
  const card = page.getByRole('tooltip');
  await expect(card).toBeVisible();
  await expect(card.getByText('Schedule pending')).toBeVisible();
  await page.addScriptTag({ content: axe.source });
  expect(await card.evaluate(async node => (await (window as any).axe.run(node, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map((v: any) => v.id))).toEqual([]);
  await target.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(target).toBeFocused();
  await target.press('Enter');
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'Ready schedule fixture' }).click();
  await expect(card).toHaveCount(0);
});

test('sparkline gradient colors weeks by skater matchup and sticky headers stay aligned', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await fixture(page);
  await page.goto('/?teams=32&opportunity=1');
  await page.addStyleTag({ content: '* { box-sizing: border-box; } #root { padding-bottom: 100vh; }' });
  const table = page.locator('[class*="masterTableScroll"] table');
  const stopColors = await Promise.all(['easier', 'average', 'harder'].map(grade =>
    table.locator(`stop[data-matchup="${grade}"]`).first().evaluate(node => getComputedStyle(node).stopColor)));
  expect(new Set(stopColors).size).toBe(3);
  const trigger = table.locator('button:has(stop[data-matchup="harder"])').first();
  await trigger.hover();
  await expect(page.getByRole('tooltip').getByText('Hard', { exact: true }).first()).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('centered-grid-skater-markers.png'), fullPage: false });
  const overlay = page.locator('[class*="masterStickyHeaderOverlay"]');
  await table.locator('thead').evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top + 10));
  await expect(overlay).toBeVisible();
  const actualHeader = table.locator('thead th').nth(2);
  const stickyHeader = overlay.locator('thead th').nth(2);
  await expect.poll(async () => {
    const a = await actualHeader.boundingBox(), b = await stickyHeader.boundingBox();
    return Math.abs(a!.x - b!.x);
  }).toBeLessThanOrEqual(1);
});

test('Game Grid stays responsive while the four-week reader is slow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (/Maximum update depth|Too many re-renders/i.test(message.text())) errors.push(message.text()); });
  await fixture(page);
  await page.goto('/?teams=32&opportunity=1&slow-four-week=1');
  const table = page.locator('[class*="masterTableScroll"] table');
  const spark = table.getByRole('button', { name: / 4-week opportunity / }).first();
  await expect(table.locator('[data-loading-placeholder][data-shape="trend"]')).toHaveCount(32);
  const daySwitch = page.getByRole('switch', { name: 'Include THU games', exact: true }).first();
  await daySwitch.click({ timeout: 1500 });
  await expect(daySwitch).toHaveAttribute('aria-checked', 'false', { timeout: 1000 });
  await daySwitch.click({ timeout: 1500 });
  await expect(daySwitch).toHaveAttribute('aria-checked', 'true', { timeout: 1000 });
  await expect(spark.locator('circle')).toHaveCount(4, { timeout: 6000 });
  await expect(table.locator('tbody tr:has([id^="game-grid-master-trigger-"])')).toHaveCount(32);
  expect(errors).toEqual([]);
});


test('sparkline keeps the original team card while the pointer crosses the gap and reads it', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await fixture(page);
  await page.goto('/?teams=32&opportunity=1');
  const target = page.getByRole('button', { name: / 4-week opportunity / }).first();
  await target.hover();
  const cardId = await page.getByRole('tooltip').getAttribute('id');
  const card = page.locator(`#${cardId}`);
  const originalText = await card.textContent();
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  await expect(card, 'The original team card must survive pointer transit').toBeVisible();
  await expect(page.getByRole('tooltip')).toHaveCount(1);
  await expect(card).toHaveText(originalText!);
  await expect(card.getByText(/GP ·/).first()).toBeVisible();
  await card.click();
  await expect(card).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('original-team-hover-card.png') });
  await target.hover();
  await expect(card).toBeVisible();
  await page.mouse.move(4, 4);
  await expect(card).toHaveCount(0);
});


test('sparkline card preserves keyboard focus and dismisses on Escape and focus away', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await fixture(page);
  await page.goto('/?teams=32&opportunity=1');
  const target = page.getByRole('button', { name: / 4-week opportunity / }).first();
  await target.focus();
  const cardId = await page.getByRole('tooltip').getAttribute('id');
  const card = page.locator(`#${cardId}`);
  await target.hover();
  await page.mouse.move(4, 4);
  await expect(card).toBeVisible();
  await target.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(target).toBeFocused();
  await target.press('Enter');
  await expect(card).toBeVisible();
  await target.press('Tab');
  await expect(card).toHaveCount(0);
});

test('sparkline real touch supports card reading, second-tap and outside dismissal', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3112', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await fixture(page);
    await page.goto('http://127.0.0.1:3112/?opportunity=1&gap=1');
    const target = page.getByRole('button', { name: /^F1 4-week opportunity / });
    await target.tap();
    const cardId = await page.getByRole('tooltip').getAttribute('id');
    const card = page.locator(`#${cardId}`);
    await expect(card).toBeVisible();
    await card.tap();
    await expect(card).toBeVisible();
    await target.tap();
    await expect(card).toHaveCount(0);
    await target.tap();
    await expect(card).toBeVisible();
    await page.getByRole('button', { name: 'Ready schedule fixture' }).tap();
    await expect(card).toHaveCount(0);
  } finally { await context.close(); }
});


for (const width of [1440, 768, 390]) test(`loading shell keeps its footprint on cold, warm and hard refresh at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.setFixedTime(new Date('2026-10-07T16:00:00Z'));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/?teams=32&opportunity=1&schedule-delay=1600&four-week-delay=3200&nst-delay=2400');
  const table = width >= 1024 ? page.locator('[class*="masterTableScroll"] table')
    : width < 480 ? page.locator('table[class*="mobileCompactTable"]') : page.locator('[class*="centerGrid"] table').first();
  await expect(table).toHaveAttribute('aria-busy', 'true');
  await expect(table.locator('[data-placeholder-row="team"]')).toHaveCount(32);
  await expect(table.locator('[data-placeholder-row]').first()).not.toHaveText(/\b0\b/);
  await expect(page.locator('[class*="overlaySpinner"]')).toHaveCount(0);
  if (width >= 1024) await expect(page.locator('[class*="desktopMasterSection"] [class*="titleText"]')).toHaveCount(0);
  const secondaryHeights = async () => page.locator('[data-opponent-state], [data-four-week-state]').evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().height));
  const secondaryBefore = await secondaryHeights();
  const before = await table.evaluate(node => ({ x: node.getBoundingClientRect().x, top: node.getBoundingClientRect().top, width: node.getBoundingClientRect().width, columns: [...node.querySelectorAll('col')].map(c => c.getBoundingClientRect().width) }));
  await page.screenshot({ path: testInfo.outputPath(`loading-${width}.png`) });
  await expect(table).toHaveAttribute('aria-busy', 'false');
  const selectedReadyAt = await page.evaluate(() => performance.now());
  await expect(table.locator('[data-placeholder-row]')).toHaveCount(0);
  await expect(table.locator('tbody tr')).toHaveCount(33);
  if (width >= 1024) {
    await expect(table.locator('[data-shape="trend"][data-loading-placeholder]')).toHaveCount(32);
    await page.getByRole('switch', { name: 'Include THU games', exact: true }).first().click();
  }
  const sparklines = page.getByRole('button', { name: / 4-week opportunity / });
  await expect(sparklines.first().locator('circle')).toHaveCount(4);
  const ready = await table.evaluate(node => ({ x: node.getBoundingClientRect().x, top: node.getBoundingClientRect().top, width: node.getBoundingClientRect().width, columns: [...node.querySelectorAll('col')].map(c => c.getBoundingClientRect().width), rowHeight: node.querySelector('tbody tr:nth-child(2)')!.getBoundingClientRect().height }));
  await writeFile(testInfo.outputPath(`geometry-${width}.json`), JSON.stringify({ before, ready, overflow: await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, className: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })).slice(0, 25)) }, null, 2));
  (await secondaryHeights()).forEach((height, index) => expect(height).toBeCloseTo(secondaryBefore[index], 0));
  expect(ready.width).toBeCloseTo(before.width, 0);
  expect(ready.top).toBeCloseTo(before.top, 0);
  ready.columns.forEach((value, index) => expect(value).toBeCloseTo(before.columns[index], 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`ready-${width}.png`) });
  const profile = await page.evaluate(() => ({ timeline: (window as any).__fixtureTimeline, paints: performance.getEntriesByType('paint').map(e => ({ name: e.name, at: e.startTime })), commits: (window as any).__gridProfile }));
  await writeFile(testInfo.outputPath(`profile-${width}.json`), JSON.stringify({ before, ready, selectedReadyAt, profile }, null, 2));
  await page.getByRole('button', { name: 'Remount grid fixture' }).click();
  await expect(table).toHaveAttribute('aria-busy', 'false');
  await expect(table.locator('[data-placeholder-row]')).toHaveCount(0);
  await page.reload();
  await expect(table).toHaveAttribute('aria-busy', 'true');
  await expect(table.locator('[data-placeholder-row="team"]')).toHaveCount(32);
});

test('loading failures settle without fake totals and reload can recover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date('2026-10-07T16:00:00Z'));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/?teams=32&opportunity=1&schedule-error-once=1');
  await expect(page.getByText('Selected schedule unavailable.', { exact: false })).toBeVisible();
  const table = page.locator('[class*="masterTableScroll"] table');
  await expect(table).toHaveAttribute('aria-busy', 'false');
  await expect(table.locator('[data-loading-placeholder]')).toHaveCount(0);
  await expect(table.locator('[data-placeholder-row="team"]')).toHaveCount(32);
  await page.getByRole('button', { name: 'Reload to retry', exact: true }).click();
  await expect(table.locator('[data-placeholder-row]')).toHaveCount(0);
  await expect(table.locator('tbody tr')).toHaveCount(33);
  await page.getByRole('button', { name: 'Partial schedule fixture' }).click();
  await expect(page.locator('[data-grid-loading-status]')).toContainText('Selected schedule incomplete');
  await expect(table.locator('[data-loading-placeholder]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ready schedule fixture' }).click();
  await expect(table.locator('[data-placeholder-row]')).toHaveCount(0);
});

for (const source of ['four-week', 'nst']) test(`optional ${source} failure leaves the selected schedule usable`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date('2026-10-07T16:00:00Z'));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(`/?teams=32&opportunity=1&${source}-error=1`);
  const table = page.locator('[class*="masterTableScroll"] table');
  await expect(table).toHaveAttribute('aria-busy', 'false');
  await expect(table.locator('tbody tr')).toHaveCount(33);
  await expect(page.locator('[data-grid-loading-status]')).toContainText('unavailable');
  await expect(page.getByRole('button', { name: 'Reload to retry' })).toBeVisible();
  await expect(table.locator('[data-loading-placeholder]')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Include THU games', exact: true }).first().click();
  await expect(page.getByRole('switch', { name: 'Include THU games', exact: true }).first()).toHaveAttribute('aria-checked', 'false');
  await page.screenshot({ path: testInfo.outputPath(`optional-${source}-error.png`) });
});

test('vertical pending grid preserves 32 unknown columns under reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-10-07T16:00:00Z'));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/?teams=32&opportunity=1&schedule-delay=2400');
  await page.getByRole('button', { name: 'Open grid controls' }).click();
  await page.getByRole('button', { name: 'Toggle orientation' }).click();
  const table = page.locator('table[class*="transposedGrid"]');
  await expect(table).toHaveAttribute('aria-busy', 'true');
  await expect(table.locator('thead th')).toHaveCount(34);
  await expect(table.locator('tbody tr').first().locator('td')).toHaveCount(34);
  const cell = table.locator('[data-loading-placeholder]').first();
  expect(await cell.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect(table).toHaveAttribute('aria-busy', 'false');
  await expect(table.locator('thead th')).toHaveCount(34);
  await expect(table.locator('[data-loading-placeholder]')).toHaveCount(0);
});

for (const width of [2048, 1440, 1024, 768, 520, 390]) test(`Game Grid visual footprint and semantic headers at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.setFixedTime(new Date('2026-10-07T16:00:00Z'));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/?teams=32&opportunity=1');
  await expect(page.getByRole('button', { name: / 4-week opportunity / }).first()).toBeVisible();
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r && { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
    const header = document.querySelector('[class*="gameGridHeaderContent"]');
    return { header: rect('[class*="gameGridHeaderContent"]'),
      headerBorder: header && { width: getComputedStyle(header).borderBottomWidth, color: getComputedStyle(header).borderBottomColor },
      controls:rect('[class*="controlsBar"]'), badge:rect('[class*="badgeAndWeekNav"]'), nav:rect('[aria-label="Week navigation"]'),
      menu:rect('[class*="controlsMenuTrigger"]'), right:rect('[class*="rightControls"]'), forecast:rect('[class*="forecastControls"]'),
      mode:rect('[aria-label="Forecast span"]'), help:rect('[aria-controls="gg-week-score-help"]'),
      legend:rect('[aria-label="Game Grid legend"]'), info:rect('summary[aria-label="Info about Game Grid metrics"]'),
      panel:rect('[class*="desktopMasterSection"] [class*="scheduleGridContainer"]'), table:rect('[class*="masterTableScroll"] table'), viewport:innerWidth };

  });
  await writeFile(testInfo.outputPath(`visual-${width}.json`), JSON.stringify(geometry,null,2));
  await page.screenshot({ path: testInfo.outputPath(`visual-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (width >= 480) {
    const centerX = (r: { x: number; width: number }) => r.x + r.width / 2;
    const centerY = (r: { y: number; height: number }) => r.y + r.height / 2;
    expect(geometry.controls!.y - geometry.header!.bottom).toBeCloseTo(6, 0);
    expect(geometry.headerBorder).toEqual({ width: '4px', color: 'rgba(7, 170, 226, 0.22)' });
    expect(centerX(geometry.badge!)).toBeCloseTo(centerX(geometry.controls!), 0);
    expect(centerX(geometry.nav!)).toBeCloseTo(centerX(geometry.controls!), 0);
    expect(centerY(geometry.menu!)).toBeCloseTo(centerY(geometry.badge!), 0);
    expect(geometry.forecast!.right).toBeCloseTo(geometry.right!.right, 0);
    if (width > 900) expect(centerY(geometry.right!)).toBeCloseTo(centerY(geometry.badge!), 0);
    if (Math.abs(centerY(geometry.mode!) - centerY(geometry.help!)) < 1) {
      expect(centerY(geometry.mode!)).toBeCloseTo(centerY(geometry.help!), 0);
    } else {
      expect(geometry.mode!.right).toBeCloseTo(geometry.forecast!.right, 0);
      expect(geometry.help!.right).toBeCloseTo(geometry.forecast!.right, 0);
    }
    for (const rect of [geometry.menu!, geometry.nav!, geometry.right!]) {
      expect(rect.x).toBeGreaterThanOrEqual(geometry.controls!.x);
      expect(rect.right).toBeLessThanOrEqual(geometry.controls!.right);
    }
    await page.screenshot({ path: testInfo.outputPath(`header-${width}.png`), clip: {
      x: geometry.header!.x, y: geometry.header!.y, width: geometry.header!.width,
      height: geometry.controls!.bottom - geometry.header!.y,
    } });
  } else {
    const buttons = await page.locator('[class*="navButtonRow"] button').evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(); return { y:r.y, height:r.height };
    }));
    expect(buttons).toHaveLength(4);
    for (const button of buttons) expect(button.y + button.height / 2).toBeCloseTo(buttons[0].y + buttons[0].height / 2, 0);
  }
  if (width >= 1024) {
    expect(geometry.header!.height).toBeCloseTo(geometry.controls!.height, 0);
    const topSpace = geometry.forecast!.y - geometry.controls!.y;
    const bottomSpace = geometry.controls!.bottom - geometry.legend!.bottom;
    expect(topSpace).toBeCloseTo(bottomSpace, 0);
    expect(topSpace).toBeCloseTo(13, 0); // 12px padding plus border, above/below actual content.
    expect(geometry.info!.height).toBeGreaterThanOrEqual(24);
    // A tall viewport must not stretch the equal header rows into empty space.
    await page.setViewportSize({ width, height: 3200 });
    expect(await page.locator('[class*="gameGridHeaderContent"]').evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(geometry.header!.height, 0);
    await page.setViewportSize({ width, height: 900 });
    expect(geometry.table!.y - geometry.controls!.bottom).toBeLessThanOrEqual(28);
    expect(geometry.panel!.width).toBeLessThanOrEqual(width * .9 + 1);
    expect(await page.locator('[class*="desktopMasterSection"] [class*="scheduleGridContainer"]').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    const table = page.locator('[class*="masterTableScroll"] table');
    await expect(table.getByRole('button', { name: /Sort by opponent attack strength/ })).toBeVisible();
    await expect(table.getByRole('button', { name: /Sort by opponent defense strength/ })).toBeVisible();
    await expect(table.getByText('↑ Stronger', { exact: true })).toHaveCount(2);
    await expect(table.getByText('4-Week Opportunity', { exact: true })).toBeVisible();
    await expect(table.getByLabel('Line color: easier to harder skater matchups')).toBeVisible();
  } else {
    await page.locator('[data-opponent-state]').evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - 150));
    await expect(page.getByRole('button', { name: /Sort by opponent attack strength/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('mobile-opponent-panel.png') });
    await page.locator('[data-four-week-state]').evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - 150));
    await page.screenshot({ path: testInfo.outputPath('mobile-opportunity-panel.png') });
    const fourWeek = page.locator('[data-four-week-state]');
    const headerBottom = await fourWeek.locator('thead').evaluate(el => el.getBoundingClientRect().bottom);
    const averageTop = await fourWeek.locator('tbody tr').first().evaluate(el => el.getBoundingClientRect().top);
    expect(averageTop).toBeGreaterThanOrEqual(headerBottom - .5);
    await page.getByRole('button', { name: 'Expand four-week columns' }).click();
    expect(await fourWeek.locator('tbody tr').first().evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(await fourWeek.locator('thead').evaluate(el => el.getBoundingClientRect().bottom) - .5);

  }

});
