// Executes audited TypeScript with all transports and imported dependencies mocked.
// Does not load application env files, actual Supabase clients, or real credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'web/node_modules/typescript'));
const results = [];

function load(relative, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  }}).outputText;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error(`Unmocked dependency blocked: ${name}`);
    },
    URL, URLSearchParams, Buffer, TextEncoder, TextDecoder, console: { log() {}, warn() {}, error() {} },
    process: { env: { NODE_ENV: 'production' } }, ...globals,
  });
  vm.runInContext(js, context, { filename: relative, timeout: 1000 });
  return module.exports;
}
function response() {
  return { statusCode: 200, headersSent: false, headers: {}, body: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    redirect(location) { this.statusCode = 307; this.headers.Location = location; return this; },
    end(body) { this.body = body; return this; },
  };
}
async function main() {
  const calls = [];
  const { default: cors } = load('web/pages/api/cors/index.ts', {}, {
    fetch: async (target, options) => {
      calls.push({ url: String(target), ...options });
      return { ok: true, headers: { get: () => 'application/json' },
        text: async () => '{"synthetic_internal_response":true}' };
    },
  });
  const res = response();
  await cors({ method: 'GET', headers: {}, query: { url: 'http://127.0.0.1:7777/synthetic', method: 'DELETE' } }, res);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:7777/synthetic');
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].signal, undefined);
  assert.equal(calls[0].redirect, undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.synthetic_internal_response, true);
  results.push({ test: 'Unauthenticated cors proxy accepts loopback URL, caller method, and returns mocked body', result: 'PASS', networkRequests: 0 });

  const service = { syntheticServiceRole: true };
  let authCalls = 0;
  const mocks = { 'lib/supabase': { createClientWithToken() { authCalls++; throw new Error('Unexpected auth call'); } },
    'lib/supabase/server': { __esModule: true, default: service } };
  const admin = load('web/utils/adminOnlyMiddleware.ts', mocks, { process: { env: { NODE_ENV: 'development' } } }).default;
  let invoked = false;
  const devRes = response();
  await admin(async req => { invoked = req.supabase === service; })({ headers: { host: 'localhost:3000' }, socket: { remoteAddress: '198.51.100.10' } }, devRes);
  assert.equal(invoked, true);
  assert.equal(authCalls, 0);
  results.push({ test: 'Development admin bypass trusts Host even when peer is non-loopback (synthetic address)', result: 'PASS', networkRequests: 0 });

  const prod = load('web/utils/adminOnlyMiddleware.ts', mocks).default;
  let prodInvoked = false;
  const prodRes = response();
  await prod(async () => { prodInvoked = true; })({ headers: { host: 'localhost:3000' } }, prodRes);
  assert.equal(prodInvoked, false);
  assert.equal(prodRes.statusCode, 401);
  results.push({ test: 'Production does not accept the Host-only development bypass', result: 'PASS', networkRequests: 0 });

  const auditRows = [];
  const audit = load('web/lib/cron/withCronJobAudit.ts', {
    'lib/cron/timingContract': {
      buildCronJobTiming: (start, end) => ({ durationMs: end - start }),
      hasCronTimingEnvelope: () => false,
      withCronJobTiming: (value) => value,
    },
    'lib/supabase/server': { __esModule: true, default: {
      from(table) { assert.equal(table, 'cron_job_audit'); return {
        async insert(row) { auditRows.push(row); return { error: null }; },
      }; },
    } },
  }).withCronJobAudit;
  const rejectedRes = response();
  await audit(prod(async () => { throw new Error('Must not execute'); }))({ method: 'GET', url: '/api/synthetic?marker=synthetic', headers: {} }, rejectedRes);
  assert.equal(rejectedRes.statusCode, 401);
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].details.url, '/api/synthetic?marker=synthetic');
  results.push({ test: 'Audit-outside-auth wrapper inserts a database audit row after rejecting an unauthenticated request', result: 'PASS', databaseRequests: 0 });

  const patreon = load('web/lib/integrations/patreon/oauth.ts', {
    crypto: require('node:crypto'),
    './config': { getPatreonConfiguration: () => ({ clientSecret: 'synthetic-audit-only-key' }),
      PATREON_CALLBACK_PATH: '/api/v1/account/patreon/callback', PATREON_CONNECT_DEFAULT_NEXT: '/account' },
  });
  const state = patreon.createPatreonOAuthState('synthetic-initiating-user', '/account');
  assert.equal(patreon.verifyPatreonOAuthState(state).userId, 'synthetic-initiating-user');
  assert.equal(patreon.verifyPatreonOAuthState(state).userId, 'synthetic-initiating-user');
  const connections = [];
  const callback = load('web/pages/api/v1/account/patreon/callback.ts', {
    'lib/integrations/patreon/oauth': { ...patreon,
      exchangePatreonAuthorizationCode: async () => ({ syntheticProviderIdentity: 'different-browser-user' }),
    },
    'lib/integrations/patreon/config': { PATREON_CONNECT_DEFAULT_NEXT: '/account' },
    'lib/integrations/patreon/sync': {
      async connectPatreonAccount(args) { connections.push(args); return { snapshot: { isEligibleSupporter: false } }; },
    },
  }).default;
  await callback({ method: 'GET', headers: {}, cookies: {}, query: { code: 'synthetic-code', state } }, response());
  assert.equal(connections.length, 1);
  assert.equal(connections[0].userId, 'synthetic-initiating-user');
  results.push({ test: 'Patreon callback accepts a signed state without a browser binding and permits repeated state verification', result: 'PASS', networkRequests: 0, databaseRequests: 0 });

  let replayFetches = 0;
  const replayAudit = load('web/pages/api/v1/db/audit-nhl-ppt-replay-coverage.ts', {
    'lib/supabase/server': { __esModule: true, default: {} },
    'lib/NHL/pptReplayCoverage': { async fetchPptReplayCoverageForGame() {
      replayFetches++;
      return { playCount: 0, replayEventCount: 0, nonGoalReplayEventCount: 0, replayEventTypes: {}, events: [] };
    } },
  }).default;
  const replayRes = response();
  await replayAudit({ method: 'GET', headers: {}, query: { gameIds: Array.from({length: 250}, (_, i) => String(i + 1)).join(','), limit: '250' } }, replayRes);
  assert.equal(replayRes.statusCode, 200);
  assert.equal(replayFetches, 250);
  results.push({ test: 'Unauthenticated replay audit dispatches 250 mocked per-game upstream operations', result: 'PASS', mockedOperations: replayFetches, networkRequests: 0 });

  const ddl = [];
  const csv = load('web/pages/api/v1/db/upsert-csv.ts', {
    'lib/cron/withCronJobAudit': { withCronJobAudit: handler => handler },
    'utils/adminOnlyMiddleware': { __esModule: true, default: handler => handler },
    'lib/standardization/nameStandardization': { standardizePlayerName: name => name },
  }).default;
  const csvRes = response();
  await csv({ method: 'POST', headers: {}, body: {
    tableName: 'audit_synthetic_import', columns: [{ name: 'player_name', type: 'TEXT', isPlayerNameSource: true }],
    csvData: [], playerIdentifierColumnName: 'player_name',
  }, supabase: { async rpc(name, args) {
    assert.equal(name, 'execute_sql'); ddl.push(args.sql_statement); return { error: null };
  } } }, csvRes);
  assert.equal(ddl.length, 1);
  assert.match(ddl[0], /CREATE TABLE IF NOT EXISTS public\./);
  assert.doesNotMatch(ddl[0], /ROW LEVEL SECURITY|REVOKE|POLICY/i);
  assert.equal(csvRes.statusCode, 400);
  results.push({ test: 'Authorized CSV import path creates a public table without RLS or grants hardening even before rejecting empty data', result: 'PASS', databaseRequests: 0, note: 'Auth wrappers replaced with identity functions to isolate the already-authorized DDL path.' });

  const comments = [];
  const createComment = load('web/pages/api/createComment.ts', {
    '@sanity/client': { __esModule: true, default: () => ({ async create(value) { comments.push(value); } }) },
    'lib/sanity/config': { config: {} },
  }).default;
  const commentRes = response();
  await createComment({ method: 'PUT', headers: {}, body: {
    postId: 'synthetic-post', name: { unexpected: 'object' }, comment: ['unexpected-array'],
  } }, commentRes);
  assert.equal(commentRes.statusCode, 200);
  assert.equal(comments.length, 1);
  assert.equal(comments[0].name.unexpected, 'object');
  assert.equal(comments[0].comment[0], 'unexpected-array');
  results.push({ test: 'Anonymous comment endpoint forwards invalid field types and non-POST method to privileged CMS create', result: 'PASS', networkRequests: 0, databaseRequests: 0 });

  const auditExposureRes = response();
  await audit(async (_req, out) => out.json({ internalDiagnostic: 'synthetic-only' }))({
    method: 'GET', url: '/api/synthetic?private_marker=synthetic-only', headers: {},
  }, auditExposureRes);
  assert.match(auditRows.at(-1).details.response, /internalDiagnostic/);
  assert.match(auditRows.at(-1).details.url, /private_marker/);
  results.push({ test: 'Cron audit stores unsanitized query string and response fields (synthetic markers only)', result: 'PASS', networkRequests: 0, databaseRequests: 0, note: 'Public-read exposure derives separately from baseline SQL, not a live database test.' });

  const output = { generatedAt: new Date().toISOString(), tests: results,
    limits: 'Synthetic isolated module tests; no live application or database requests; deployed reachability unverified.' };
  fs.writeFileSync(path.join(__dirname, 'safe-local-checks.json'), JSON.stringify(output, null, 2) + '\n');
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
