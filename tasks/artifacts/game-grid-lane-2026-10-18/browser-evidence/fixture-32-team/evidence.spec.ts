import { expect, test, Page } from '@playwright/test';
const SHOTS = process.env.SHOTS!;
async function open(page: Page, url: string) {
  await page.clock.install({ time: new Date('2026-10-18T16:00:00Z') });
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(url);
}
const desktopWidth = (w: number) => w >= 1024;
async function gridRows(page: Page, width: number) {
  return desktopWidth(width)
    ? page.locator('tbody tr:has([id^="game-grid-master-trigger-"])')
    : page.locator('table').filter({ has: page.getByRole('button', { name: 'Sort by games played', exact: true }) }).locator('tbody tr:has(td:first-child a)');
}
async function gpSum(page: Page, width: number) {
  const rows = await gridRows(page, width);
  const gp = await rows.evaluateAll((trs) => trs.map((tr) => Number(tr.querySelectorAll('td')[8]?.textContent)));
  return { count: gp.length, sum: gp.reduce((a, b) => a + b, 0) };
}

for (const width of [1920, 1180, 390, 320]) test(`32-team real week: rows, totals, day mask, postponement, partial and empty at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: desktopWidth(width) ? 1000 : 844 });
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(String(e)));
  await open(page, 'http://127.0.0.1:3116/');
  const rows = await gridRows(page, width);
  await expect(rows).toHaveCount(32);
  expect(await gpSum(page, width)).toEqual({ count: 32, sum: 104 });
  if (desktopWidth(width)) {
    const totals = page.locator('tr', { hasText: 'GP/Day' }).first().locator('td');
    expect((await totals.allTextContents()).slice(1, 9)).toEqual(['5', '9', '2', '14', '1', '14', '7', '52']);
    await page.getByRole('button', { name: 'Sort by Score descending' }).first().click();
    const scores = await rows.evaluateAll((trs) => trs.map((tr) => Number(tr.querySelectorAll('td')[10]?.textContent)));
    expect(scores.every((s, i) => i === 0 || scores[i - 1] >= s)).toBe(true);
  } else {
    const bounds = await rows.first().evaluate((tr) => ({ cells: tr.querySelectorAll('td').length, scroll: tr.closest('table')!.parentElement!.scrollWidth, client: tr.closest('table')!.parentElement!.clientWidth }));
    expect(bounds.cells).toBe(11);
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  }
  await page.screenshot({ path: `${SHOTS}/grid32-${width}-ready.png`, fullPage: false });
  // Day mask: exclude Thursday (14 games) -> 2 × 38 team games.
  await page.getByRole('switch', { name: 'Include THU games' }).first().click();
  await expect.poll(async () => (await gpSum(page, width)).sum).toBe(76);
  await page.screenshot({ path: `${SHOTS}/grid32-${width}-thu-excluded.png`, fullPage: false });
  await page.getByRole('switch', { name: 'Include THU games' }).first().click();
  await expect.poll(async () => (await gpSum(page, width)).sum).toBe(104);
  // Schedule change: S.J-CAR Thursday postponed.
  await page.getByRole('button', { name: 'postponed schedule fixture' }).click();
  await expect.poll(async () => (await gpSum(page, width)).sum).toBe(102);
  if (desktopWidth(width)) expect((await page.locator('tr', { hasText: 'GP/Day' }).first().locator('td').allTextContents())[4]).toBe('13');
  // Partial coverage withholds totals and rankings.
  await page.getByRole('button', { name: 'partial schedule fixture' }).click();
  await expect(page.getByText(/Selected schedule incomplete: 6\/7 days covered/)).toBeVisible();
  await expect(rows).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/grid32-${width}-partial.png`, fullPage: false });
  // Covered empty week: all 32 rows, zero GP, no scores.
  await page.getByRole('button', { name: 'empty schedule fixture' }).click();
  await expect(rows).toHaveCount(32);
  expect(await gpSum(page, width)).toEqual({ count: 32, sum: 0 });
  const scoreCells = await rows.evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll('td')[10]?.textContent?.trim()));
  expect(new Set(scoreCells)).toEqual(new Set(['-']));
  expect(errors).toEqual([]);
});

for (const width of [1920, 390]) test(`skater/goalie opponent perspective at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1080 });
  await open(page, 'http://127.0.0.1:3114/');
  for (const region of ['Combined Game Grid', 'Standalone OMT']) {
    const scope = page.getByRole('region', { name: region });
    const skaters = scope.getByRole('button', { name: 'Skaters' }), goalies = scope.getByRole('button', { name: 'Goalies' });
    await expect(skaters).toHaveAttribute('aria-pressed', 'true');
    const colored = () => scope.locator('tbody td[class*="Good"], tbody td[class*="Bad"], tbody td[class*="rank"]').count();
    const before = await colored();
    expect(before).toBeGreaterThan(0);
    await goalies.click();
    await expect(goalies).toHaveAttribute('aria-pressed', 'true');
    const after = await colored();
    expect(after).toBeLessThan(before);
    await scope.screenshot({ path: `${SHOTS}/opponent-${region.replace(/\s+/g, '-')}-${width}-goalie.png` });
    await skaters.click();
    expect(await colored()).toBe(before);
  }
});
