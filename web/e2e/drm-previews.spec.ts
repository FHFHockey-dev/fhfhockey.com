import { expect, test } from '@playwright/test';

const custom = '/?season=20262027&timeframe=Custom&team=EDM&start=2026-11-03&end=2026-11-10&daterange-matrix-mode=total-toi';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2026-11-12T15:00:00Z');
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
});

test('accepted source rows determine total ordering, asymmetric shares and Custom card scope', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(custom);
  const grid = page.getByRole('grid');
  await expect(grid).toBeVisible();
  await expect(grid.getByRole('columnheader')).toHaveText([
    'Players', 'R. Center', 'S. Wing', 'L. Defender', 'R. Defender', 'E. Goalie', 'R. Wing', 'S. Substitute',
  ]);
  await expect(grid.getByRole('columnheader').first()).toHaveAccessibleName('Players');
  // Source intervals: Center180min; Substitute61min, all shared with Center.
  await expect(page.locator('#matrix-cell-6-1-meaning')).toHaveText("Short Substitute shared 33.89% of Regular Center's ice time (All strengths)");
  await expect(page.locator('#matrix-cell-1-6-meaning')).toHaveText("Regular Center shared 100.00% of Short Substitute's ice time (All strengths)");
  await expect(page.getByText('Played 3 of 3 games').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '5-on-5 forward lines', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Power play · 5 skaters', exact: true })).toBeVisible();
  await expect(page.getByText('119:00 together')).toBeVisible();
  await grid.getByRole('gridcell', { name: 'Regular Center average time on ice', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(grid.getByRole('gridcell', { name: 'Regular Center with Steady Wing', exact: true })).toBeFocused();
  await expect(page.getByLabel('Selected cell value', { exact: true })).toHaveText("Regular Center shared 100.00% of Steady Wing's ice time (All strengths)");
  await page.screenshot({ path: testInfo.outputPath('drm-desktop.png'), fullPage: true });
});

test('calendar presets keep sparse games, filters narrow that same date window and layouts work', async ({ page }) => {
  await page.goto(custom);
  await page.getByRole('button', { name: 'Last 7 days', exact: true }).click();
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('11/06/2026');
  await expect(page.getByLabel('End date', { exact: true })).toHaveValue('11/12/2026');
  await expect(page.getByText('Played 2 of 2 games').first()).toBeVisible();
  await page.getByRole('button', { name: 'Away', exact: true }).click();
  await expect(page.locator('#matrix-cell-6-1-meaning')).toHaveText("Short Substitute shared 28.33% of Regular Center's ice time (All strengths)");
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('11/06/2026');
  await page.getByRole('button', { name: 'Away', exact: true }).click();
  await page.getByRole('button', { name: 'Last 30 days', exact: true }).click();
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('10/14/2026');
  await expect(page.getByText('Played 3 of 3 games').first()).toBeVisible();
  await page.getByLabel('Matrix layout', { exact: true }).selectOption('line-combination');
  await expect(page.getByRole('columnheader', { name: 'Short Substitute', exact: true })).toHaveCount(0);
  await page.getByLabel('Matrix layout', { exact: true }).selectOption('full-roster');
  await expect(page.getByRole('columnheader', { name: 'Short Substitute', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Season to date', exact: true }).click();
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('10/01/2026');
  await expect(page.getByLabel('End date', { exact: true })).toHaveValue('11/12/2026');
});

test('pending games stay partial and errors do not become empty successful matrices', async ({ page }) => {
  await page.goto(custom + '&scenario=partial');
  await expect(page.getByText("Partial data: some games in this range aren't included yet.")).toBeVisible();
  await expect(page.getByText('2 of 3 completed games have full shift data (3 scheduled in this range).')).toBeVisible();
  await page.getByText('Games outside the matrix (1)').click();
  await expect(page.getByText(/pending \(1\)/)).toBeVisible();
  await expect(page.getByText(/2026020103/)).toBeVisible();
  await expect(page.locator('#matrix-cell-6-1-meaning')).toHaveText("Short Substitute shared 24.17% of Regular Center's ice time (All strengths)");
  await expect(page.getByText('Played 2 of 2 games').first()).toBeVisible();
  await page.goto(custom + '&scenario=error');
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to load matrix data.' })).toBeVisible();
  await expect(page.getByRole('grid')).toHaveCount(0);
  await page.goto(custom + '&scenario=empty');
  await expect(page.getByText('No matrix data is available for this selection.')).toBeVisible();
  await page.goto(custom + '&scenario=unqualified');
  await expect(page.getByText('0 of 3 completed games have full shift data (3 scheduled in this range).')).toBeVisible();
  await expect(page.getByText('Stored calculations need the current qualified source version (3)')).toBeVisible();
  await expect(page.getByText(/2026020101/)).toBeVisible();
  await expect(page.getByText(/check back after tonight's update/)).toBeVisible();
  await expect(page.getByText(/Line and goalie cards need at least one game with full shift data/)).toBeVisible();
  await expect(page.getByRole('grid')).toHaveCount(0);
  await expect(page.getByText(/Switch the layout to Full Roster or Total TOI/)).toHaveCount(0);
});

test('strength views use one qualified response, keep alternatives separate and distinguish zero from an undefined share', async ({ page }) => {
  let matrixRequests = 0;
  page.on('request', request => { if (request.url().includes('/api/v1/drm?')) matrixRequests++; });
  await page.goto(custom);
  await expect(page.getByRole('grid')).toBeVisible();
  const requests = matrixRequests;
  const observed = page.getByRole('region', { name: 'Observed combinations', exact: true });
  await observed.getByText('Other combinations (1)', { exact: true }).click();
  await expect(observed.getByText('55:00 together')).toBeVisible();
  await page.getByLabel('Strength', { exact: true }).selectOption('pp');
  await expect(page.getByRole('heading', { name: '5-on-5 forward lines', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Power play · 5 skaters', exact: true })).toBeVisible();
  await expect(page.locator('#matrix-cell-6-1-meaning')).toHaveText("Short Substitute shared 100.00% of Regular Center's ice time (Power play)");
  await expect(page.locator('#matrix-cell-1-3-meaning')).toHaveText('Returning Wing has no ice time in these games (Power play).');
  await expect(page.locator('#matrix-cell-3-3-meaning')).toHaveText('Returning Wing: 00:00 average ice time per game (Power play)');
  await page.getByLabel('Strength', { exact: true }).selectOption('pk');
  await expect(page.locator('#matrix-cell-6-1-meaning')).toContainText('has no ice time in these games (Penalty kill)');
  await page.getByLabel('Strength', { exact: true }).selectOption('otherEs');
  await expect(page.getByText(/Other even strength covers 4-on-4/)).toBeVisible();
  await page.getByLabel('Matrix layout', { exact: true }).selectOption('line-combination');
  await expect(page.getByText('No full lines or pairs were found at this strength. Switch the layout to Full Roster or Total TOI to see each player’s time.')).toBeVisible();
  expect(matrixRequests).toBe(requests);
});

test('mobile controls and the full roster fit the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(custom);
  await expect(page.getByRole('grid')).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: innerWidth, page: document.documentElement.scrollWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.width + 1);
  await page.getByLabel('Matrix layout', { exact: true }).selectOption('full-roster');
  await expect(page.getByRole('columnheader', { name: 'Short Substitute', exact: true })).toBeAttached();
  await page.screenshot({ path: testInfo.outputPath('drm-mobile.png'), fullPage: true });
});

test('history keeps verified game dates and uncertain publication reports in separate sections', async ({ page }) => {
  const modes: string[] = [];
  await page.route('**/api/v1/lines/history?*', async route => {
    const mode = new URL(route.request().url()).searchParams.get('mode')!;
    modes.push(mode);
    const verified = mode === 'game';
    await route.fulfill({ json: {
      enabled: true, nextCursor: null, skippedRecords: 0, scannedRecords: 1, coverage: 'unknown', correctionHistory: 'unverified',
      items: [{ id: mode, reportDate: '2026-11-07', gameId: 2026020103, gameDate: verified ? '2026-11-10' : null,
        gameLink: verified ? 'verified' : 'unverified', recordType: verified ? 'entry' : 'legacy_report',
        originalPublishedAt: '2026-11-07T16:00:00Z', storedPublishedAt: '2026-11-07T16:00:00Z', receivedAt: null, interpretedAt: null,
        sourceUrl: verified ? 'https://x.com/reporter/status/123' : null, text: verified ? 'Synthetic game-linked report' : 'Synthetic uncertain report',
        context: verified ? 'game' : 'practice', version: 'fixture-v1', units: verified ? [[1, 2, 3], [1, 3, 6]].map(ids => ({ situation: 'es_forward', number: 1, complete: true, players: ids.map(playerId => ({ playerId, name: `Player ${playerId}` })) })) : [] }],
    } });
  });
  await page.goto(custom);
  const history = page.getByRole('region', { name: 'Reported line history', exact: true });
  await expect(history).toBeVisible();
  expect(modes).toEqual([]);
  await history.getByRole('button', { name: 'Load game-day lineups' }).click();
  const game = history.getByRole('region', { name: 'Game-day lineups', exact: true });
  await expect(game.getByText('Game date: 2026-11-10.')).toBeVisible();
  await expect(game.getByText('Published Nov 7, 2026, 11:00 AM ET · game')).toBeVisible();
  await expect(game.getByText('Observed together for 28:00 at 5-on-5 in this game.')).toBeVisible();
  await expect(game.getByText(/This exact unit didn’t play together/)).toBeVisible();
  await history.getByRole('button', { name: 'Load other reports' }).click();
  const publication = history.getByRole('region', { name: 'Other lineup reports', exact: true });
  await expect(publication.getByText('Synthetic uncertain report')).toBeVisible();
  await expect(publication.getByText(/Game date:/)).toHaveCount(0);
  await expect(publication.getByText('Not matched to a game.')).toBeVisible();
  await history.getByRole('button', { name: 'Browse more reports' }).click();
  const additional = history.getByRole('region', { name: 'More lineup reports', exact: true });
  await expect(additional.getByText('Synthetic uncertain report')).toBeVisible();
  await expect(additional.getByText('1 retained interpretations checked for publication dates in this range.')).toBeVisible();
  await history.getByLabel('Group reports by').selectOption('publication');
  await expect(game).toHaveCount(0);
  expect(modes).toEqual(['game', 'publication', 'claimPublication']);
  await page.getByRole('button', { name: 'Last 7 days', exact: true }).click();
  await expect(history.getByText('Synthetic uncertain report')).toHaveCount(0);
  await expect(history.getByRole('button', { name: 'Load game-day lineups' })).toBeVisible();
});
