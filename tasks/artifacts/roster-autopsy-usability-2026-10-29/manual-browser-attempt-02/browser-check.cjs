/* Verify fresh manual entry and saved-workspace conflict protection on the pinned snapshot. */
const { createRequire } = require('node:module');
const { writeFileSync } = require('node:fs');
const path = require('node:path');
const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('playwright');
const origin = 'http://127.0.0.1:3135';
const report = { fixtureOnly: true, checks: [], externalRequestsBlocked: [], localApiRequestsBlocked: [], pageErrors: [] };
const check = (name, result) => { report.checks.push({ name, result }); if (!result) throw new Error(`Failed: ${name}`); };

async function run(browser, mobile) {
  const label = mobile ? 'phone' : 'desktop';
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
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  const response = await page.goto(`${origin}/roster-autopsy`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  check(`${label}: route HTTP 200`, response?.status() === 200);
  await page.getByRole('heading', { name: 'Roster', exact: true }).waitFor({ timeout: 30000 });
  await page.getByLabel('Player name').fill('Manual Dual');
  await page.getByLabel('League positions', { exact: true }).fill('C/LW');
  await page.getByRole('button', { name: 'Add player' }).click();
  check(`${label}: fresh manual player added`, await page.getByRole('button', { name: 'Remove Manual Dual' }).count() === 1);
  await page.getByLabel('C starting slots').fill('1');
  await page.getByLabel('LW starting slots').fill('1');
  await page.getByLabel('I reviewed these starting slots.').check();
  await page.getByLabel('I reviewed this roster and its league positions.').check();
  check(`${label}: multi-position player fills one of two simultaneous slots`, await page.getByText(/1 \/ 2/).isVisible());
  await page.waitForFunction(() => localStorage.getItem('fhfh:roster-autopsy:v1:anonymous')?.includes('Manual Dual'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Roster', exact: true }).waitFor();
  check(`${label}: manual player survives reload`, await page.getByLabel('Manual Dual positions').inputValue() === 'C/LW');
  check(`${label}: slot counts and coverage survive reload`, await page.getByLabel('C starting slots').inputValue() === '1'
    && await page.getByLabel('LW starting slots').inputValue() === '1' && await page.getByText(/1 \/ 2/).isVisible());
  await page.evaluate(() => localStorage.setItem('fhfh:roster-autopsy:v1:anonymous', 'newer external workspace'));
  await page.getByLabel('Manual Dual positions').fill('D');
  await page.getByRole('alert').waitFor();
  check(`${label}: conflict warning appears`, (await page.getByRole('alert').textContent()).includes('changed in another tab'));
  check(`${label}: conflict does not overwrite newer stored bytes`, await page.evaluate(() => localStorage.getItem('fhfh:roster-autopsy:v1:anonymous')) === 'newer external workspace');
  check(`${label}: conflict retains current session edit`, await page.getByLabel('Manual Dual positions').inputValue() === 'D');
  await context.close();
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    await run(browser, false);
    await run(browser, true);
    check('no uncaught browser errors', report.pageErrors.length === 0);
    report.result = 'passed';
  } catch (error) {
    report.result = 'failed';
    report.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    writeFileSync(path.join(__dirname, 'BROWSER-RESULT.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report, null, 2));
  }
})();
