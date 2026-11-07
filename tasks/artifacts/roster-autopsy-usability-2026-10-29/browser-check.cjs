/* Pinned-snapshot browser checks: manual merge, mobile jumps and retained state. */
const { createRequire } = require('node:module');
const { writeFileSync } = require('node:fs');
const path = require('node:path');
const requireWeb = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = requireWeb('playwright');
const origin = 'http://127.0.0.1:3135';
const out = __dirname;
const report = { fixtureOnly: true, checks: [], externalRequestsBlocked: [], localApiRequestsBlocked: [], pageErrors: [] };
const check = (name, result) => { report.checks.push({ name, result }); if (!result) throw new Error(`Failed: ${name}`); };
const sourcePlayer = (id, name, positions) => ({ id, nhlId: Number(id), name, teamAbbreviation: 'AAA', eligiblePositions: positions,
  playerClass: 'skater', availability: 'unknown', ownership: null, canDrop: null, holdValue: null, reserveEligibility: [],
  recentTotals: { games: 5, stats: { GOALS: 4, ASSISTS: 6 } } });
const rso = { version: 1, context: { provider: 'manual', seasonId: 20262027, leagueId: 'manual', teamId: 'manual',
  startDate: '2026-10-26', endDate: '2026-11-01', timeZone: 'UTC', asOf: '2026-10-29T12:00:00.000Z' },
  rules: { lineupMode: 'daily', rosterSlots: { C: 1, LW: 1, BN: 2 }, acquisitionTiming: 'unknown', acquisitionCost: null,
    periods: [], lineupPeriods: [], scoring: { mode: 'points', weights: { GOALS: 3, ASSISTS: 2 }, categories: [] },
    goalieMinimum: { required: null, credited: null, counts: 'unknown', penalty: 'unknown', periodStart: null, periodEnd: null }, unsupported: [] },
  managerRuleOverrides: {}, roster: [{ playerId: '10', position: 'bench' }, { playerId: '11', position: 'bench' }], lockedAssignments: [],
  intent: { revision: 0, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: 'accept_risk', goalieWindow: 'early', goalieSplit: 'mon_thu', alternativeCount: 10 },
  manualPlayers: [sourcePlayer('10', 'Shared Player', ['LW']), sourcePlayer('11', 'New Wing', ['RW'])], unresolvedNames: [], realized: {}, opponent: null };
const player = (id, name, eligibility) => ({ id, name, team: '', eligibility, status: 'bench', recent: null });
const current = { version: 1, slots: { C: '2', LW: '0', RW: '0', D: '0', G: '0', F: '0', W: '0', UTIL: '0' },
  slotsReviewed: true, rosterReviewed: true, players: [player('manual:one', 'Shared Player', 'C')], unresolved: [], scoring: null };
const longRoster = { version: 1, slots: { C: '2', LW: '2', RW: '2', D: '4', G: '2', F: '1', W: '0', UTIL: '1' },
  slotsReviewed: true, rosterReviewed: true, unresolved: [], scoring: null,
  players: Array.from({ length: 20 }, (_, index) => player(`manual:${index}`, `Synthetic Player ${String(index + 1).padStart(2, '0')}`, ['C', 'LW', 'RW', 'D', 'G'][index % 5])) };

async function contextFor(browser, mobile) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
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
async function openFixture(browser, mobile, workspace) {
  const context = await contextFor(browser, mobile);
  await context.addInitScript(({ stored, input }) => {
    localStorage.setItem('fhfh:rso:workspace:v1:anonymous', JSON.stringify(input));
    localStorage.setItem('fhfh:roster-autopsy:v1:anonymous', JSON.stringify(stored));
  }, { stored: workspace, input: rso });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  const response = await page.goto(`${origin}/roster-autopsy`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  check(`${mobile ? 'phone' : 'desktop'} route HTTP 200`, response?.status() === 200);
  await page.getByRole('heading', { name: 'Know your roster' }).waitFor({ timeout: 30000 });
  return { context, page };
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    const desktop = await openFixture(browser, false, current), page = desktop.page;
    const savedBefore = await page.evaluate(() => localStorage.getItem('fhfh:roster-autopsy:v1:anonymous'));
    const rsoBefore = await page.evaluate(() => localStorage.getItem('fhfh:rso:workspace:v1:anonymous'));
    await page.getByRole('button', { name: 'Review manual RSO import' }).click();
    const review = page.getByRole('region', { name: 'Review RSO import' });
    check('possible duplicate is not preselected', !await review.getByRole('checkbox', { name: /Shared Player/ }).isChecked());
    check('new player is preselected', await review.getByRole('checkbox', { name: /New Wing/ }).isChecked());
    check('existing slot counts are not preselected for replacement', !await review.getByLabel('Use RSO starting slots (replaces the counts shown here).').isChecked());
    check('review has not modified stored roster', await page.evaluate(() => localStorage.getItem('fhfh:roster-autopsy:v1:anonymous')) === savedBefore);
    await page.screenshot({ path: path.join(out, 'desktop-review.png'), fullPage: true });
    await review.getByRole('button', { name: 'Cancel' }).click();
    check('cancel preserves stored roster', await page.evaluate(() => localStorage.getItem('fhfh:roster-autopsy:v1:anonymous')) === savedBefore);
    await page.getByRole('button', { name: 'Review manual RSO import' }).click();
    await review.getByRole('button', { name: 'Add selected players' }).click();
    check('merge retains manual player and adds selected player', await page.getByRole('button', { name: 'Remove Shared Player' }).count() === 1 && await page.getByRole('button', { name: 'Remove New Wing' }).count() === 1);
    check('merge retains current positions and slot count', await page.getByLabel('Shared Player positions').inputValue() === 'C' && await page.getByLabel('C starting slots').inputValue() === '2');
    check('source RSO workspace is unchanged', await page.evaluate(() => localStorage.getItem('fhfh:rso:workspace:v1:anonymous')) === rsoBefore);
    check('changed roster requires renewed review', !await page.getByLabel('I reviewed this roster and its league positions.').isChecked());
    await page.getByRole('button', { name: 'Review manual RSO import' }).click();
    check('already imported identity is marked and disabled', await review.getByText('Already in your roster').isVisible() && await review.getByRole('checkbox', { name: /New Wing/ }).isDisabled());
    await review.getByRole('checkbox', { name: /Shared Player/ }).check();
    await review.getByRole('button', { name: 'Add selected players' }).click();
    check('a possible duplicate requires an explicit choice', await page.getByRole('button', { name: 'Remove Shared Player' }).count() === 2);
    await page.getByRole('button', { name: 'Review manual RSO import' }).click();
    await review.getByLabel('Use RSO starting slots (replaces the counts shown here).').check();
    await review.getByRole('button', { name: 'Add selected players' }).click();
    check('explicit slot replacement applies RSO slots', await page.getByLabel('C starting slots').inputValue() === '1' && await page.getByLabel('LW starting slots').inputValue() === '1');
    check('replaced slots require renewed review', !await page.getByLabel('I reviewed these starting slots.').isChecked());
    await page.getByRole('button', { name: 'Review manual RSO import' }).click();
    await page.getByLabel('C starting slots').fill('3');
    check('stale preview cannot apply', await review.getByRole('button', { name: 'Add selected players' }).isDisabled());
    await review.getByRole('button', { name: 'Cancel' }).click();
    check('stale review leaves manual edit intact', await page.getByLabel('C starting slots').inputValue() === '3');
    check('desktop has no horizontal page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await desktop.context.close();

    const phone = await openFixture(browser, true, longRoster), mobile = phone.page;
    await mobile.getByText('20 players', { exact: true }).waitFor();
    const nav = mobile.getByRole('navigation', { name: 'Roster autopsy sections' });
    check('phone section navigation is visible', await nav.isVisible());
    const navInitial = await nav.boundingBox();
    await mobile.evaluate(() => window.scrollTo(0, 3000));
    const navScrolled = await nav.boundingBox();
    report.mobileNav = { initialTop: navInitial?.y, scrolledTop: navScrolled?.y, height: navScrolled?.height };
    check('phone navigation stays reachable while scrolling', Boolean(navScrolled && navScrolled.y >= 50 && navScrolled.y <= 65));
    const coverageLink = nav.getByRole('link', { name: 'Coverage' });
    const size = await coverageLink.boundingBox();
    check('phone jump link has at least a 44px target', Boolean(size && size.width >= 44 && size.height >= 44));
    await coverageLink.tap();
    const coverage = mobile.getByRole('heading', { name: 'Coverage', exact: true });
    const box = await coverage.boundingBox();
    report.coverageAfterJump = { y: box?.y, scrollY: await mobile.evaluate(() => Math.round(scrollY)), activeId: await mobile.evaluate(() => document.activeElement?.id) };
    check('phone jump exposes coverage below the fixed navigation', Boolean(box && navScrolled && box.y >= navScrolled.y + navScrolled.height - 2 && box.y < 844));
    check('phone jump moves focus to coverage', report.coverageAfterJump.activeId === 'autopsy-coverage-heading');
    await mobile.screenshot({ path: path.join(out, 'phone-coverage.png') });
    await nav.getByRole('link', { name: 'Roster', exact: true }).tap();
    const roster = mobile.getByRole('heading', { name: 'Roster', exact: true });
    const rosterBox = await roster.boundingBox();
    check('phone return jump exposes the roster', Boolean(rosterBox && navScrolled && rosterBox.y >= navScrolled.y + navScrolled.height - 2 && rosterBox.y < 844));
    check('phone jumps preserve the 20-player roster', await mobile.getByText('20 players', { exact: true }).isVisible());
    check('phone has no horizontal page overflow', await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await mobile.screenshot({ path: path.join(out, 'phone-roster.png') });
    await phone.context.close();

    const phoneMerge = await openFixture(browser, true, current), mp = phoneMerge.page;
    await mp.getByRole('button', { name: 'Review manual RSO import' }).tap();
    const mobileReview = mp.getByRole('region', { name: 'Review RSO import' });
    await mobileReview.getByRole('button', { name: 'Add selected players' }).scrollIntoViewIfNeeded();
    await mp.screenshot({ path: path.join(out, 'phone-review.png') });
    await mobileReview.getByRole('button', { name: 'Add selected players' }).tap();
    check('phone touch applies reviewed merge', await mp.getByRole('button', { name: 'Remove Shared Player' }).count() === 1 && await mp.getByRole('button', { name: 'Remove New Wing' }).count() === 1);
    check('phone merge keeps existing slot count', await mp.getByLabel('C starting slots').inputValue() === '2');
    check('no uncaught browser errors', report.pageErrors.length === 0);
    await phoneMerge.context.close();
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
