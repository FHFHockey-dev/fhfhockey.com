const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '../../../..');
const { chromium, expect } = require(path.join(repo, 'web/node_modules/@playwright/test'));
const origin = 'https://social-access.fixture.invalid';
const results = {
  status: 'running',
  scope: 'Actual pinned AuthProvider, gate, SocialShare and editionFetch; synthetic auth, stubbed ensureUserRecords; fictional route responses. No Next server or live handler/Supabase.',
  checks: [], apiRequests: [], assetRequests: [], aborted: [], pageErrors: [], launches: 0,
};
let browser;
let page;
const check = name => results.checks.push({ name, passed: true });
const marker = info => 'EDITION_' + info.authorization.slice('Bearer synthetic-'.length) + '_' + info.number;
const workspace = () => page.getByRole('heading', { name: 'Weekly schedule', exact: true });

(async () => {
  results.launches++;
  browser = await chromium.launch({ headless: true, args: ['--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--no-first-run', '--disable-sync', '--metrics-recording-only', '--disable-domain-reliability'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => results.pageErrors.push(error.message));
  const holds = [];
  let holdNext = false;
  let failNext = false;
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const authorization = request.headers().authorization;
    if (url.origin !== origin) { results.aborted.push(url.href); return route.abort('blockedbyclient'); }
    if (url.pathname === '/studio') return route.fulfill({ contentType: 'text/html', headers: { 'Cache-Control': 'private, no-store, max-age=0' }, body: '<!doctype html><html><head><meta charset="utf-8"><title>Offline social access R1</title></head><body><aside>OFFLINE AUTHORIZATION FIXTURE — synthetic sessions, neutral styles</aside><div id="root"></div><script src="/bundle.js"></script></body></html>' });
    if (url.pathname === '/bundle.js') return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'bundle.js'), 'utf8') });
    if (url.pathname.startsWith('/api/v1/social-share/')) {
      const info = { url: url.pathname + url.search, authorization, number: results.apiRequests.length + 1, held: holdNext, failedFixtureResponse: failNext };
      results.apiRequests.push(info);
      const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization' };
      if (!authorization?.startsWith('Bearer synthetic-')) return route.fulfill({ status: 401, json: { error: 'Fixture credentials denied' }, headers });
      if (failNext) { failNext = false; info.completed = true; return route.fulfill({ status: 503, json: { error: 'Fixture edition temporarily unavailable.' }, headers }); }
      const body = await page.evaluate(input => window.fixture.makeSnapshot(input), url.href);
      body.state = 'partial'; body.reasons = [marker(info)];
      if (holdNext) { holdNext = false; await new Promise(resolve => holds.push({ resolve, info })); }
      try { await route.fulfill({ status: 200, json: body, headers }); info.completed = true; }
      catch (error) { info.fulfillError = error.message; }
      return;
    }
    if (url.pathname.startsWith('/pictures/') || url.pathname.startsWith('/teamLogos/')) {
      results.assetRequests.push({ path: url.pathname, authorization: authorization ?? null });
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#888"/></svg>' });
    }
    results.aborted.push(url.href); return route.abort('blockedbyclient');
  });
  await page.clock.install({ time: new Date('2026-10-26T12:00:00.000Z') });
  await page.goto(origin + '/studio');
  await expect(page.getByRole('alert')).toHaveText('Sign in with your FHFH social editor account to continue.');
  await expect(workspace()).toHaveCount(0); expect(results.apiRequests).toHaveLength(0);
  check('Signed-out page denies actual workspace and makes no edition request');

  await page.evaluate(() => window.fixture.setSession('basic', null));
  await expect(page.getByRole('alert')).toHaveText('Social editor access is required to use this studio.');
  await expect(workspace()).toHaveCount(0); expect(results.apiRequests).toHaveLength(0);
  check('Signed-in non-editor denies actual workspace and makes no edition request');

  holdNext = true;
  await page.evaluate(() => window.fixture.setSession('A', 'social_editor'));
  await expect(workspace()).toBeVisible(); await expect.poll(() => holds.length).toBe(1);
  const first = holds[0].info;
  expect(first.authorization).toBe('Bearer synthetic-A');
  check('Editor mounts actual renderer and starts an allowlisted bearer edition read');
  await page.evaluate(() => window.fixture.setSession('B', 'social_editor'));
  await expect.poll(() => results.apiRequests.length).toBe(2);
  const second = results.apiRequests[1];
  expect(second.url).toBe(first.url); expect(second.authorization).toBe('Bearer synthetic-B');
  await expect(page.getByText('Schedule partial: ' + marker(second))).toBeVisible();
  const oldAccount = holds.shift(); oldAccount.resolve();
  await expect.poll(() => oldAccount.info.completed).toBe(true);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByText(new RegExp(marker(first)))).toHaveCount(0);
  check('Concurrent exact-same-URL reads use separate account bearers; old account content never renders');
  await page.screenshot({ path: path.join(__dirname, '01-account-B.png'), fullPage: true });

  holdNext = true;
  await page.getByRole('button', { name: 'Refresh schedule', exact: true }).click();
  await expect.poll(() => holds.length).toBe(1);
  const oldToken = holds[0];
  // Observe the actual shared helper promise, rather than assume an automatic renderer reload.
  await page.evaluate(input => {
    window.editionProbe = { state: 'pending' };
    window.fixture.fetchEdition(input).then(
      value => { window.editionProbe = { state: 'resolved', body: value.body }; },
      error => { window.editionProbe = { state: 'rejected', message: error.message }; },
    );
  }, oldToken.info.url);
  await page.evaluate(() => window.fixture.setSession('B', 'social_editor', 'synthetic-B2'));
  holds.shift().resolve();
  await expect.poll(() => page.evaluate(() => window.editionProbe.state)).toBe('rejected');
  expect(await page.evaluate(() => window.editionProbe.message)).toContain('session changed');
  await expect(page.getByText(new RegExp(marker(oldToken.info)))).toHaveCount(0);
  check('Actual pending old-token edition promise rejects after refresh; no stale renderer data');
  await expect(page.getByRole('button', { name: 'Refresh schedule', exact: true })).toBeEnabled();
  const beforeManual = results.apiRequests.length;
  await page.getByRole('button', { name: 'Refresh schedule', exact: true }).click();
  await expect.poll(() => results.apiRequests.length).toBe(beforeManual + 1);
  const freshToken = results.apiRequests.at(-1);
  expect(freshToken.authorization).toBe('Bearer synthetic-B2');
  await expect(page.getByText('Schedule partial: ' + marker(freshToken))).toBeVisible();
  check('Legitimate manual refresh obtains new-token edition and displays it');

  const beforeInvalid = results.apiRequests.length;
  const targets = ['https://other.invalid/api/v1/social-share/game-grid', '//other.invalid/api/v1/social-share/game-grid', '/api/v1/social-share/publish', '/api/v1/db/update-players', '/api/v1/social-share/game-grid#x', '/api/v1/social-share/game-grid?x=\\evil'];
  const denials = await page.evaluate(async inputs => Promise.all(inputs.map(async input => {
    try { await window.fixture.fetchEdition(input); return { input, rejected: false }; }
    catch (error) { return { input, rejected: true, message: error.message }; }
  })), targets);
  expect(denials.every(item => item.rejected && item.message.includes('Invalid share studio request'))).toBe(true);
  expect(results.apiRequests.length).toBe(beforeInvalid); expect(results.aborted).toEqual([]);
  results.invalidUrlDenials = denials;
  check('Actual bearer helper rejects unallowlisted URLs before any page/network request');

  failNext = true;
  await page.getByRole('button', { name: 'Refresh schedule', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Fixture edition temporarily unavailable.' })).toBeVisible();
  check('Actual renderer handles a mocked edition failure and exposes retry');
  const beforeRetry = results.apiRequests.length;
  await page.getByRole('button', { name: 'Retry schedule', exact: true }).click();
  await expect.poll(() => results.apiRequests.length).toBe(beforeRetry + 1);
  await expect(page.getByText('Schedule partial: ' + marker(results.apiRequests.at(-1)))).toBeVisible();
  check('Actual renderer retry recovers with the current bearer');

  await page.evaluate(() => window.fixture.setSession('B', null, 'synthetic-B2'));
  await expect(workspace()).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveText('Social editor access is required to use this studio.');
  check('Revoked stored role closes actual protected workspace');
  const beforeStaleRole = results.apiRequests.length;
  await page.evaluate(() => { window.fixture.deferRole('old'); return window.fixture.setSession('old', 'social_editor'); });
  await expect(page.getByRole('status')).toHaveText('Checking share studio access…');
  await page.evaluate(() => window.fixture.setSession('new', null));
  await page.evaluate(() => window.fixture.resolveRole('old', 'social_editor'));
  await expect(page.locator('#fixture-auth')).toHaveText('new:none');
  await expect(workspace()).toHaveCount(0); expect(results.apiRequests).toHaveLength(beforeStaleRole);
  check('Late prior-account role grant cannot reopen workspace or fetch an edition');

  const beforeC = results.apiRequests.length;
  await page.evaluate(() => window.fixture.setSession('C', 'social_editor'));
  await expect.poll(() => results.apiRequests.length).toBe(beforeC + 1);
  await expect(page.getByText('Schedule partial: ' + marker(results.apiRequests.at(-1)))).toBeVisible();
  await page.evaluate(() => { window.fixture.deferRole('C'); return window.fixture.setSession('C', 'social_editor', 'synthetic-C2'); });
  await expect(page.getByRole('status')).toHaveText('Checking share studio access…');
  await expect(workspace()).toHaveCount(0);
  await page.evaluate(() => window.fixture.resolveRole('C', 'social_editor', { message: 'Synthetic role lookup unavailable' }));
  await expect(page.locator('#fixture-auth')).toHaveText('C:none'); await expect(workspace()).toHaveCount(0);
  check('Failed role revalidation clears authority and leaves workspace closed');

  const beforeD = results.apiRequests.length;
  await page.evaluate(() => window.fixture.setSession('D', 'social_editor'));
  await expect.poll(() => results.apiRequests.length).toBe(beforeD + 1);
  await expect(page.getByText('Schedule partial: ' + marker(results.apiRequests.at(-1)))).toBeVisible();
  holdNext = true;
  await page.getByRole('button', { name: 'Refresh schedule', exact: true }).click();
  await expect.poll(() => holds.length).toBe(1); const logoutPending = holds[0];
  await page.evaluate(input => {
    window.logoutProbe = { state: 'pending' };
    window.fixture.fetchEdition(input).then(
      () => { window.logoutProbe = { state: 'resolved' }; },
      error => { window.logoutProbe = { state: 'rejected', message: error.message }; },
    );
  }, logoutPending.info.url);
  await page.locator('#fixture-signout').click();
  await expect(workspace()).toHaveCount(0); await expect(page.locator('#fixture-auth')).toHaveText('none:none');
  holds.shift().resolve();
  await expect.poll(() => page.evaluate(() => window.logoutProbe.state)).toBe('rejected');
  expect(await page.evaluate(() => window.logoutProbe.message)).toContain('session changed');
  await expect(page.getByText(new RegExp(marker(logoutPending.info)))).toHaveCount(0);
  check('Logout immediately closes workspace and actual pending edition rejects after logout');
  await page.screenshot({ path: path.join(__dirname, '02-signed-out.png'), fullPage: true });

  expect(results.apiRequests.every(info => /^\/api\/v1\/social-share\/game-grid\?/.test(info.url))).toBe(true);
  expect(results.assetRequests.every(info => info.authorization === null)).toBe(true);
  expect(results.aborted).toEqual([]); expect(results.pageErrors).toEqual([]);
  results.ensureUserRecords = await page.evaluate(() => window.fixture.ensureCalls);
  check('Bearer stays on allowlisted edition routes, assets receive none, no external or uncaught page errors');
  results.status = 'passed';
})().catch(async error => {
  results.status = browser ? 'failed' : 'blocked_browser_launch';
  results.error = { name: error.name, message: error.message, stack: error.stack };
  if (page) try { await page.screenshot({ path: path.join(__dirname, 'failure.png'), fullPage: true }); } catch {}
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  results.screenshots = {};
  for (const name of ['01-account-B.png', '02-signed-out.png', 'failure.png']) {
    const file = path.join(__dirname, name);
    if (fs.existsSync(file)) results.screenshots[name] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  fs.writeFileSync(path.join(__dirname, 'RESULTS.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ status: results.status, checks: results.checks.length, requests: results.apiRequests.length, aborted: results.aborted.length, error: results.error?.message }, null, 2));
});
