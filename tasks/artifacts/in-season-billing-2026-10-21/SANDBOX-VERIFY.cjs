const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..');
const root = '/tmp/fhfh-billing-e2e-qh0ri7vv';
const config = JSON.parse(fs.readFileSync(root + '/supabase-status.json'));
const users = JSON.parse(fs.readFileSync(root + '/synthetic-users.json'));
assert.equal(config.API_URL, 'http://127.0.0.1:56421');
assert.equal(new URL(config.DB_URL).host, '127.0.0.1:56422');
const key = fs.readFileSync(root + '/stripe-restricted-key', 'utf8').trim(); assert.match(key, /^rk_test_/);
const Stripe = require(path.join(repo, 'web/node_modules/stripe'));
const stripe = new Stripe(key, { timeout: 10000, maxNetworkRetries: 0 });
const { Client } = require(path.join(repo, 'web/node_modules/pg'));
const pg = new Client({ connectionString: config.DB_URL });
Object.assign(process.env, { NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: config.API_URL, NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: config.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY, NODE_PATH: path.join(repo, 'web') });
require('node:module').Module._initPaths();
require(path.join(repo, 'web/node_modules/ts-node')).register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const receipts = path.join(__dirname, 'SANDBOX-VERIFICATION-RESULTS.jsonl');
const budgetPath = path.join(__dirname, 'SANDBOX-CASE-BUDGET.json');
function record(result) { fs.appendFileSync(receipts, JSON.stringify({ at: new Date().toISOString(), ...result }) + '\n'); console.log(JSON.stringify(result)); }
async function query(sql, values = []) {
  const identity = (await pg.query('select current_database() as db,inet_server_port() as port')).rows[0];
  assert.deepEqual(identity, { db: 'postgres', port: 5432 });
  return pg.query(sql, values);
}
async function request(body, user = users[0], route = 'checkout') {
  const r = await fetch(`http://127.0.0.1:3107/api/v1/account/in-season/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.token}` } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
}
(async () => {
  assert.equal((await stripe.accounts.retrieve()).id, 'acct_1UDRxGLaomqkve47');
  await pg.connect();
  const mode = process.argv[2];
  const rows = (await query('select * from public.in_season_sandbox_checkouts where user_id=any($1::uuid[]) order by created_at', [users.map(u => u.id)])).rows;
  const a = rows.find(r => r.user_id === users[0].id && r.status === 'paid'); assert.ok(a);
  const payment = await stripe.paymentIntents.retrieve(a.payment_intent_id);
  assert.equal(payment.livemode, false); assert.equal(payment.metadata.in_season_user_id, users[0].id); assert.equal(payment.amount, 2499);
  if (mode === 'inspect') {
    const b = rows.find(r => r.user_id === users[1].id && r.status === 'pending'); assert.ok(b);
    const session = await stripe.checkout.sessions.retrieve(b.checkout_session_id);
    assert.equal(session.livemode, false); assert.equal(session.metadata.in_season_user_id, users[1].id);
    assert.equal(session.status, 'open'); assert.equal(session.payment_status, 'unpaid');
    const declined = await stripe.paymentIntents.retrieve(session.payment_intent);
    assert.equal(declined.status, 'requires_payment_method'); assert.equal(declined.last_payment_error?.code, 'card_declined');
    assert.equal((await query('select count(*)::int as count from public.in_season_grants where user_id=$1', [users[1].id])).rows[0].count, 0);
    assert.equal((await request({ plan: 'season_pass' }, null)).status, 401);
    assert.equal((await request({ plan: 'season_pass', userId: users[0].id }, users[1])).status, 400);
    assert.equal((await request({ plan: 'monthly' }, users[1])).status, 409);
    const { loadProviderSyncAccess } = require(path.join(repo, 'web/lib/integrations/providerSyncAccessServer.ts'));
    assert.equal((await loadProviderSyncAccess(users[0].id)).eligible, true);
    assert.equal((await loadProviderSyncAccess(users[1].id)).eligible, false);
    const logs = fs.readFileSync(path.join(__dirname, 'SANDBOX-HTTP-RESULTS.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const event = await stripe.events.retrieve(logs.find(x => x.eventType === 'checkout.session.completed').eventId);
    const body = JSON.stringify(event), webhook = fs.readFileSync(root + '/stripe-webhook-secret', 'utf8');
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: webhook });
    const replay = await fetch('http://127.0.0.1:3107/api/v1/webhooks/in-season-stripe', { method: 'POST', headers: { 'stripe-signature': signature }, body });
    assert.equal(replay.status, 200); assert.equal((await replay.json()).duplicate, true);
    const bad = await fetch('http://127.0.0.1:3107/api/v1/webhooks/in-season-stripe', { method: 'POST', headers: { 'stripe-signature': signature }, body: body + ' ' }); assert.equal(bad.status, 400);
    const budget = JSON.parse(fs.readFileSync(budgetPath)); budget.cases[1].state = 'declined_no_grant'; fs.writeFileSync(budgetPath, JSON.stringify(budget, null, 2) + '\n');
    record({ check: 'success_decline_isolation_replay', passed: true, paidGrantCount: 1, declinedGrantCount: 0, replayDuplicate: true, tamperRejected: true, publicMonthlyDisabled: true });
  } else if (mode === 'refund-partial' || mode === 'refund-full') {
    const previous = await stripe.refunds.list({ payment_intent: payment.id, limit: 10 });
    const amount = mode === 'refund-partial' ? 100 : 2399;
    assert.ok(!previous.has_more);
    const matching = previous.data.find(r => r.metadata.fhfh_e2e_adjustment === mode);
    const refund = matching ?? await stripe.refunds.create({ payment_intent: payment.id, amount, metadata: { fhfh_e2e_adjustment: mode } }, { idempotencyKey: `fhfh-e2e:${payment.id}:${mode}` });
    assert.equal(refund.livemode, undefined); // Refund objects do not expose livemode; bound PI does.
    assert.equal(refund.status, 'succeeded'); assert.equal(refund.amount, amount);
    record({ check: mode, refundId: refund.id, amount, status: refund.status, sandbox: true });
  } else if (mode === 'verify-partial') {
    const grants = (await query('select * from public.in_season_grants where user_id=$1', [users[0].id])).rows;
    assert.equal(grants.length, 1); assert.equal(grants[0].status, 'active');
    await query("insert into public.in_season_grants(user_id,source,source_reference,status,effective_from,effective_to) values($1,'grandfather','e2e-independent','active',now()-interval '1 day','2027-07-01T04:00Z') on conflict(source,source_reference) do nothing", [users[0].id]);
    record({ check: 'partial_refund_retains_access', passed: true, independentSyntheticGrantSeeded: true });
  } else if (mode === 'case3') {
    const budget = JSON.parse(fs.readFileSync(budgetPath)); assert.equal(budget.cases.length, 2);
    const b = rows.find(r => r.user_id === users[1].id && r.status === 'pending'); assert.ok(b);
    let session = await stripe.checkout.sessions.retrieve(b.checkout_session_id);
    assert.equal(session.livemode, false); assert.equal(session.metadata.in_season_user_id, users[1].id);
    if (session.status === 'open') session = await stripe.checkout.sessions.expire(session.id, {}, { idempotencyKey: `fhfh-e2e-expire:${session.id}` });
    assert.equal(session.status, 'expired');
    const expired = await request({ plan: 'season_pass' }, users[1]); assert.equal(expired.data.data.state, 'expired');
    const result = await request({ plan: 'season_pass' }, users[1]); assert.equal(result.status, 200); assert.equal(result.data.data.state, 'checkout');
    fs.writeFileSync(root + '/case3-checkout.json', JSON.stringify(result.data.data), { mode: 0o600, flag: 'wx' });
    budget.cases.push({ number: 3, kind: 'season_abandonment', state: 'checkout_created' }); fs.writeFileSync(budgetPath, JSON.stringify(budget, null, 2) + '\n');
    record({ check: 'case3_created', passed: true, casesUsed: 3, cap: 3 });
  } else if (mode === 'verify-final') {
    const grants = (await query('select source,status,source_reference,effective_to from public.in_season_grants where user_id=$1', [users[0].id])).rows;
    assert.equal(grants.find(g => g.source === 'purchase').status, 'revoked');
    assert.equal(grants.find(g => g.source === 'grandfather').status, 'active');
    assert.equal((await query('select workspace from public.in_season_workspaces where user_id=$1', [users[0].id])).rows[0].workspace.preserved, true);
    assert.equal((await query('select count(*)::int as count from public.in_season_grants where user_id=$1', [users[1].id])).rows[0].count, 0);
    const b = rows.find(r => r.user_id === users[1].id && r.status === 'pending'); assert.ok(b);
    const session = await stripe.checkout.sessions.retrieve(b.checkout_session_id);
    assert.equal(session.livemode, false); assert.equal(session.status, 'open'); assert.equal(session.payment_status, 'unpaid');
    const budget = JSON.parse(fs.readFileSync(budgetPath)); assert.equal(budget.cases.length, 3); budget.cases[2].state = 'abandoned_no_grant'; fs.writeFileSync(budgetPath, JSON.stringify(budget, null, 2) + '\n');
    record({ check: 'full_refund_and_abandonment', passed: true, paidGrantRevoked: true, independentGrantPreserved: true, manualWorkspacePreserved: true, abandonedGrantCount: 0, casesUsed: 3 });
  } else throw Error('Unknown verification action');
})().catch(e => { console.error(JSON.stringify({ error: e.type ?? e.name, code: e.code, message: String(e.message).replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+/g, '[REDACTED]') })); process.exitCode = 1; }).finally(() => pg.end());
