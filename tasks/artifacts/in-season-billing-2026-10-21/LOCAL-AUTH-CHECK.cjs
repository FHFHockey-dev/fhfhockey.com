// Real GoTrue/PostgREST against this task's disposable loopback stack only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../..');
const root = '/tmp/fhfh-billing-e2e-qh0ri7vv';
const config = JSON.parse(fs.readFileSync(root + '/supabase-status.json', 'utf8'));
assert.equal(config.API_URL, 'http://127.0.0.1:56421');
const dbUrl = new URL(config.DB_URL);
assert.equal(dbUrl.hostname, '127.0.0.1'); assert.equal(dbUrl.port, '56422');
const dockerEnv = { ...process.env, DOCKER_HOST: 'unix:///Users/tim/.colima/fhfh-billing-e2e/docker.sock', DOCKER_CONFIG: root + '/docker-config' };
delete dockerEnv.DOCKER_CONTEXT;
const container = JSON.parse(execFileSync('docker', ['inspect', 'supabase_db_fhfh-billing-e2e-20261021'], { env: dockerEnv, encoding: 'utf8' }))[0];
assert.deepEqual(container.NetworkSettings.Ports['5432/tcp'], [{ HostIp: '127.0.0.1', HostPort: '56422' }]);
const ips = Object.values(container.NetworkSettings.Networks).map(n => n.IPAddress);
const { Client } = require(path.join(repo, 'web/node_modules/pg'));
const { createClient } = require(path.join(repo, 'web/node_modules/@supabase/supabase-js'));
const pg = new Client({ connectionString: config.DB_URL });
const originalFetch = global.fetch;
global.fetch = (url, options) => {
  assert.equal(new URL(typeof url === 'string' ? url : url.url ?? url.href).origin, config.API_URL, 'Nonlocal HTTP prohibited');
  return originalFetch(url, options);
};
Object.assign(process.env, { NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: config.API_URL, NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: config.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY, NODE_PATH: path.join(repo, 'web') });
require('node:module').Module._initPaths();
require(path.join(repo, 'web/node_modules/ts-node')).register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const service = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const checks = [];
function pass(name) { checks.push(name); console.log('PASS ' + name); }
async function query(sql, values = []) {
  const identity = (await pg.query('select host(inet_server_addr()) as host, inet_server_port() as port, current_database() as db')).rows[0];
  assert.ok(ips.includes(identity.host)); assert.equal(identity.port, 5432); assert.equal(identity.db, 'postgres');
  return pg.query(sql, values);
}
const ok = result => { if (result.error) throw Error(result.error.code ?? result.error.name ?? 'Local API failure'); return result.data; };
(async () => {
  await pg.connect();
  assert.equal((await query("select count(*)::int as count from pg_tables where schemaname='public'")).rows[0].count, 0);
  assert.equal((await query('select count(*)::int as count from auth.users')).rows[0].count, 0);
  pass('fresh task container and loopback Auth/REST/PostgreSQL verified');
  await query(`create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at=current_timestamp; return new; end $$;
    create table public.user_entitlements(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), source_provider text, entitlement_key text, source_account_id text, source_reference text, entitlement_status text, effective_from timestamptz, effective_to timestamptz, metadata jsonb);
    alter table public.user_entitlements enable row level security;
    revoke all on public.user_entitlements from anon,authenticated;
    grant select,insert,update,delete on public.user_entitlements to service_role;`);
  // Legacy table above is an empty, minimal read-contract fixture; no provider is connected.
  for (const file of ['supabase/migrations/20260927104934_in_season_access_workspace.sql', 'tasks/artifacts/in-season-billing-2026-10-21/drafts/20261021210000_in_season_sandbox_billing.sql']) await query(fs.readFileSync(path.join(repo, file), 'utf8'));
  await query("notify pgrst,'reload schema'");
  pass('required billing SQL applied only to the fresh disposable Supabase database');
  const users = [];
  for (const suffix of ['a', 'b']) {
    const email = `billing-${suffix}@example.invalid`, password = randomBytes(24).toString('base64url');
    const created = ok(await service.auth.admin.createUser({ email, password, email_confirm: true }));
    const publicClient = createClient(config.API_URL, config.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = ok(await publicClient.auth.signInWithPassword({ email, password }));
    assert.equal(signed.user.id, created.user.id);
    users.push({ id: created.user.id, email, password, token: signed.session.access_token });
  }
  fs.writeFileSync(root + '/synthetic-users.json', JSON.stringify(users), { mode: 0o600, flag: 'wx' });
  pass('exactly two synthetic users created and signed in through real local Auth');
  const { requireApiUser } = require(path.join(repo, 'web/lib/api/requireApiUser.ts'));
  function response() { return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
  for (const headers of [{}, { authorization: 'Bearer invalid-synthetic-token' }]) {
    const res = response(); assert.equal(await requireApiUser({ headers }, res), null); assert.equal(res.code, 401);
  }
  for (const user of users) assert.equal((await requireApiUser({ headers: { authorization: `Bearer ${user.token}` }, body: { userId: users.find(x => x.id !== user.id).id } }, response())).id, user.id);
  pass('real API Auth rejects anonymous/invalid sessions and binds each token to its own account');
  const { inSeasonBillingStore } = require(path.join(repo, 'web/lib/in-season/billingStore.ts'));
  const store = inSeasonBillingStore(service);
  const attempts = [];
  for (const user of users) {
    const attempt = await store.begin(user.id); assert.equal(attempt.user_id, user.id); assert.equal(attempt.status, 'pending'); attempts.push(attempt.id);
  }
  assert.notEqual(attempts[0], attempts[1]);
  pass('real PostgREST service RPC returns separate owner-bound pending checkouts');
  for (const token of [config.ANON_KEY, ...users.map(u => u.token)]) {
    const untrusted = createClient(config.API_URL, config.ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await untrusted.from('in_season_sandbox_checkouts').select('*')).error?.code, '42501');
    assert.ok((await untrusted.rpc('begin_in_season_sandbox_checkout', { p_user_id: users[0].id })).error);
  }
  pass('anonymous and both real user tokens cannot bypass service-only billing RPC/ledger access');
  const { loadProviderSyncAccess } = require(path.join(repo, 'web/lib/integrations/providerSyncAccessServer.ts'));
  for (const user of users) { const access = await loadProviderSyncAccess(user.id); assert.equal(access.eligible, false); assert.equal(access.reason, 'no_active_grant'); }
  pass('central access loader verifies both synthetic accounts are free with no provider calls');
  await query("insert into public.in_season_workspaces(user_id,provider,league_id,team_id,season_id,start_date,end_date,workspace) values($1,'manual','e2e-local','e2e-local',20262027,'2026-10-21','2026-10-27','{\"preserved\":true}')", [users[0].id]);
  assert.equal((await query('select count(*)::int as count from public.in_season_grants')).rows[0].count, 0);
  assert.equal((await query('select count(*)::int as count from auth.users')).rows[0].count, 2);
  pass('manual workspace retained; no payment grant created by sign-in or checkout preparation');
  const result = { success: true, checks: checks.length, passed: checks, api: config.API_URL, database: '127.0.0.1:56422', auth: 'real local GoTrue password sessions and PostgREST RPC', stripeCasesExecuted: 0 };
  fs.writeFileSync(path.join(__dirname, 'LOCAL-AUTH-RESULTS.json'), JSON.stringify(result, null, 2) + '\n');
})().catch(error => { console.error(JSON.stringify({ success: false, passed: checks, error: error.message, code: error.code })); process.exitCode = 1; }).finally(() => pg.end());
