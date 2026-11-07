/* Fixture-only browser verification against an isolated local Next runtime. */
const { createRequire } = require('node:module');
const { writeFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const requireWeb = createRequire('/Users/tim/Code/fhfhockey.com/web/package.json');
const { chromium } = requireWeb('playwright');

const origin = 'http://127.0.0.1:3135';
const out = __dirname;
const report = { route: `${origin}/roster-autopsy`, fixtureOnly: true, externalRequestsBlocked: [], localApiRequestsBlocked: [], pageErrors: [], checks: [] };
const check = (name, result) => { report.checks.push({ name, result }); if (!result) throw new Error(`Failed: ${name}`); };

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) {
        report.externalRequestsBlocked.push(`${request.method()} ${url.origin}${url.pathname}`);
        return route.abort();
      }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_vercel/') || request.method() !== 'GET') {
        report.localApiRequestsBlocked.push(`${request.method()} ${url.pathname}`);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(error.message));
    const response = await page.goto(`${origin}/roster-autopsy`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    check('route returns HTTP 200', response?.status() === 200);
    await page.getByRole('heading', { name: 'Know your roster' }).waitFor({ timeout: 30000 });
    check('empty manual workspace visible', await page.getByText('Add a player or copy your manual RSO roster to begin.').isVisible());
    check('no unsupported quality grade is claimed', await page.getByText('League comparisons and player grades need more data.').isVisible());

    async function add(name, eligibility) {
      await page.getByLabel('Player name', { exact: true }).fill(name);
      await page.getByLabel('League positions', { exact: true }).fill(eligibility);
      await page.getByRole('button', { name: 'Add player' }).click();
    }
    await add('Synthetic Dual', 'C/LW');
    await add('Synthetic Center', 'C');
    await page.getByLabel('C starting slots').fill('1');
    await page.getByLabel('LW starting slots').fill('1');
    await page.getByLabel('I reviewed these starting slots.').check();
    await page.getByLabel('I reviewed this roster and its league positions.').check();
    await page.getByText('2 / 2', { exact: true }).waitFor();
    check('two eligible players fill both slots', await page.getByText('2 / 2', { exact: true }).isVisible());
    check('position cards explain overlap', await page.getByText(/Each player is used only once in the simultaneous slot total/).isVisible());
    check('C and LW show individual coverage', await page.getByText('Covered individually', { exact: true }).count() === 2);
    await page.screenshot({ path: path.join(out, 'desktop.png'), fullPage: true });

    await page.getByLabel('Synthetic Center status').selectOption('IR');
    await page.getByLabel('I reviewed this roster and its league positions.').check();
    check('reserve player excluded from simultaneous total', await page.getByText('1 / 2', { exact: true }).isVisible());
    check('reserve count shown', await page.getByText(/1 in reserve/).isVisible());
    await page.getByLabel('Synthetic Dual positions').fill('');
    check('missing eligibility is marked invalid', await page.getByLabel('Synthetic Dual positions').getAttribute('aria-invalid') === 'true');
    check('incomplete data prompts review', await page.getByText(/review needed/).isVisible());
    await page.getByLabel('Synthetic Dual positions').fill('C/LW');
    await page.getByLabel('Synthetic Center status').selectOption('bench');
    await page.getByLabel('I reviewed this roster and its league positions.').check();
    await page.waitForFunction(() => localStorage.getItem('fhfh:roster-autopsy:v1:anonymous')?.includes('Synthetic Dual'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Synthetic Dual', { exact: true }).first().waitFor();
    check('roster survives reload', await page.getByText('Synthetic Center', { exact: true }).first().isVisible());
    check('confirmed slot analysis survives reload', await page.getByText('2 / 2', { exact: true }).isVisible());

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true });
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    report.mobileDimensions = dimensions;
    check('mobile page has no horizontal overflow', dimensions.scroll <= dimensions.client);
    check('mobile roster and coverage are reachable', await page.getByRole('heading', { name: 'Roster', exact: true }).isVisible() && await page.getByRole('heading', { name: 'Coverage', exact: true }).isVisible());
    await page.getByLabel('Player name', { exact: true }).focus();
    await page.keyboard.press('Tab');
    check('keyboard reaches positions input', await page.getByLabel('League positions', { exact: true }).evaluate(element => document.activeElement === element));
    const box = await page.getByRole('button', { name: 'Add player' }).boundingBox();
    check('mobile add button meets 44px target', Boolean(box && box.width >= 44 && box.height >= 44));
    check('no uncaught browser errors', report.pageErrors.length === 0);
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
