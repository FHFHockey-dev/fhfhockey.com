/* Targeted phone-sized RSO import, touch, and long-roster usability check. */
const { createRequire } = require('node:module');
const { writeFileSync } = require('node:fs');
const path = require('node:path');
const requireWeb = createRequire('/Users/tim/Code/fhfhockey.com/web/package.json');
const { chromium } = requireWeb('playwright');
const origin = 'http://127.0.0.1:3135';
const out = __dirname;
const report = { fixtureOnly: true, checks: [], externalRequestsBlocked: [], localApiRequestsBlocked: [], pageErrors: [] };
const check = (name, result) => { report.checks.push({ name, result }); if (!result) throw new Error(`Failed: ${name}`); };
const basePlayer = (id, name, positions) => ({ id, nhlId: Number(id), name, teamAbbreviation: 'AAA', eligiblePositions: positions,
  playerClass: 'skater', availability: 'unknown', ownership: null, canDrop: null, holdValue: null, reserveEligibility: [],
  recentTotals: { games: 5, stats: { GOALS: 4, ASSISTS: 6 } } });
const rso = { version: 1, context: { provider: 'manual', seasonId: 20262027, leagueId: 'manual', teamId: 'manual',
  startDate: '2026-10-26', endDate: '2026-11-01', timeZone: 'UTC', asOf: '2026-10-29T12:00:00.000Z' },
  rules: { lineupMode: 'daily', rosterSlots: { C: 1, LW: 1, BN: 2 }, acquisitionTiming: 'unknown', acquisitionCost: null,
    periods: [], lineupPeriods: [], scoring: { mode: 'points', weights: { GOALS: 3, ASSISTS: 2 }, categories: [] },
    goalieMinimum: { required: null, credited: null, counts: 'unknown', penalty: 'unknown', periodStart: null, periodEnd: null }, unsupported: [] },
  managerRuleOverrides: {}, roster: [{ playerId: '10', position: 'bench' }], lockedAssignments: [],
  intent: { revision: 0, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: 'accept_risk', goalieWindow: 'early', goalieSplit: 'mon_thu', alternativeCount: 10 },
  manualPlayers: [basePlayer('10', 'Synthetic Import', ['C', 'LW'])], unresolvedNames: [], realized: {}, opponent: null };
const longRoster = { version: 1, slots: { C: '2', LW: '2', RW: '2', D: '4', G: '2', F: '1', W: '0', UTIL: '1' },
  slotsReviewed: true, rosterReviewed: true, unresolved: [], scoring: null,
  players: Array.from({ length: 20 }, (_, index) => ({ id: `manual:${index}`, name: `Synthetic Player ${String(index + 1).padStart(2, '0')}`,
    team: 'AAA', eligibility: ['C', 'LW', 'RW', 'D', 'G'][index % 5], status: 'bench', recent: null })) };

async function contextFor(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { report.externalRequestsBlocked.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_vercel/') || request.method() !== 'GET') {
      report.localApiRequestsBlocked.push(`${request.method()} ${url.pathname}`); return route.abort();
    }
    return route.continue();
  });
  return context;
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    const context = await contextFor(browser);
    await context.addInitScript(value => localStorage.setItem('fhfh:rso:workspace:v1:anonymous', JSON.stringify(value)), rso);
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.goto(`${origin}/roster-autopsy`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('heading', { name: 'Know your roster' }).waitFor({ timeout: 30000 });
    const original = await page.evaluate(() => localStorage.getItem('fhfh:rso:workspace:v1:anonymous'));
    await page.getByRole('button', { name: 'Copy manual RSO roster' }).tap();
    check('touch import copies manual RSO roster', await page.getByText('Synthetic Import', { exact: true }).first().isVisible());
    check('retained RSO points have historical disclosure', await page.getByText(/4.80 recent league pts\/appearance · 5 games · saved RSO stats, date unknown/).isVisible());
    check('RSO workspace unchanged', await page.evaluate(() => localStorage.getItem('fhfh:rso:workspace:v1:anonymous')) === original);
    check('reimport disabled when roster exists', await page.getByRole('button', { name: 'Copy manual RSO roster' }).isDisabled());
    await page.getByLabel('Player name', { exact: true }).fill('Synthetic Touch');
    await page.getByLabel('League positions', { exact: true }).fill('C');
    await page.getByRole('button', { name: 'Add player' }).tap();
    check('touch can add a player past fixed navigation', await page.getByText('Synthetic Touch', { exact: true }).first().isVisible());
    await context.close();

    const longContext = await contextFor(browser);
    await longContext.addInitScript(value => localStorage.setItem('fhfh:roster-autopsy:v1:anonymous', JSON.stringify(value)), longRoster);
    const longPage = await longContext.newPage();
    longPage.on('pageerror', error => report.pageErrors.push(error.message));
    await longPage.goto(`${origin}/roster-autopsy`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await longPage.getByText('20 players', { exact: true }).waitFor({ timeout: 30000 });
    const coverage = longPage.getByRole('heading', { name: 'Coverage', exact: true });
    report.longRoster = await coverage.evaluate(element => ({ coverageDocumentTop: Math.round(element.getBoundingClientRect().top + scrollY),
      viewportHeight: innerHeight, documentHeight: document.documentElement.scrollHeight }));
    await longPage.screenshot({ path: path.join(out, 'mobile-20-top.png') });
    await coverage.scrollIntoViewIfNeeded();
    check('coverage remains reachable with 20 players', await coverage.isVisible());
    report.longRoster.scrollToCoverage = await longPage.evaluate(() => Math.round(scrollY));
    await longPage.screenshot({ path: path.join(out, 'mobile-20-coverage.png') });
    check('no uncaught browser errors', report.pageErrors.length === 0);
    await longContext.close();
    report.result = 'passed';
  } catch (error) {
    report.result = 'failed';
    report.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    writeFileSync(path.join(out, 'BROWSER-RESULT.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report, null, 2));
  }
})();
