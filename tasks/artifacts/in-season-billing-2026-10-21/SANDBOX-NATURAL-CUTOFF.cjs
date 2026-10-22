// One additional direct clock subscription; zero Checkout sessions and no stop
// worker/cancellation calls. Target IDs checkpoint privately after each creation.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..'), root = '/tmp/fhfh-billing-e2e-qh0ri7vv';
const config = JSON.parse(fs.readFileSync(root + '/supabase-status.json'));
const user = JSON.parse(fs.readFileSync(root + '/synthetic-users.json'))[1];
assert.equal(config.API_URL, 'http://127.0.0.1:56421'); assert.equal(new URL(config.DB_URL).host, '127.0.0.1:56422');
assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname, 'SANDBOX-CASE-BUDGET.json'))).cases.length, 3);
Object.assign(process.env, { NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: config.API_URL, NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: config.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY, NODE_PATH: path.join(repo, 'web') });
require('node:module').Module._initPaths();
require(path.join(repo, 'web/node_modules/ts-node')).register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const Stripe = require(path.join(repo, 'web/node_modules/stripe'));
const stripe = new Stripe(fs.readFileSync(root + '/stripe-restricted-key', 'utf8').trim(), { timeout: 10000, maxNetworkRetries: 0 });
const { Client } = require(path.join(repo, 'web/node_modules/pg')); const pg = new Client({ connectionString: config.DB_URL });
const { monthlyBillingStore } = require(path.join(repo, 'web/lib/in-season/monthlyStore.ts'));
const { createMonthlyBilling } = require(path.join(repo, 'web/lib/in-season/monthlyBilling.ts'));
const { fulfillMonthlyEvent } = require(path.join(repo, 'web/lib/in-season/monthlyWebhook.ts'));
const { loadInSeasonAccess } = require(path.join(repo, 'web/lib/in-season/server.ts'));
const store = monthlyBillingStore(), targetFile = root + '/monthly-natural-target.json';
const target = fs.existsSync(targetFile) ? JSON.parse(fs.readFileSync(targetFile)) : {};
const receipt = path.join(__dirname, 'SANDBOX-NATURAL-CUTOFF-RESULTS.jsonl');
const cutoff = Date.parse('2027-07-01T04:00:00Z') / 1000;
function save() { fs.writeFileSync(targetFile, JSON.stringify(target), { mode: 0o600 }); }
function record(value) { fs.appendFileSync(receipt, JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n'); console.log(JSON.stringify(value)); }
async function query(sql, values = []) {
  assert.deepEqual((await pg.query('select current_database() as db,inet_server_port() as port')).rows[0], { db: 'postgres', port: 5432 });
  return pg.query(sql, values);
}
(async () => {
  const account = await stripe.accounts.retrieve(); assert.equal(account.id, 'acct_1UDRxGLaomqkve47'); assert.equal(account.default_currency, 'usd');
  await pg.connect(); assert.equal((await query('select count(*)::int as count from auth.users')).rows[0].count, 2);
  const mode = process.argv[2];
  if (mode === 'setup') {
    target.eventStartAt ??= new Date().toISOString(); save();
    const old = JSON.parse(fs.readFileSync(root + '/monthly-target.json'));
    const previous = (await query('select closed from public.in_season_sandbox_monthly where subscription_id=$1 and user_id=$2', [old.subscriptionId, user.id])).rows[0];
    assert.equal(previous.closed, true);
    const minimum = { accountId: account.id, chargeCurrency: 'usd', settlementCurrency: 'usd', minimumChargeCents: 50, verificationReference: 'Sandbox-only account.default_currency=usd; Stripe currencies documentation USD minimum 0.50, checked 2026-10-21. No live settlement eligibility asserted.' };
    const attempt = await store.begin(user.id, minimum); assert.equal(attempt.user_id, user.id); assert.notEqual(attempt.id, old.attemptId);
    if (target.attemptId) assert.equal(target.attemptId, attempt.id); target.attemptId = attempt.id; save();
    const clock = target.clockId ? await stripe.testHelpers.testClocks.retrieve(target.clockId)
      : await stripe.testHelpers.testClocks.create({ name: 'FHFH natural cutoff E2E 2026-10-21', frozen_time: Math.floor(Date.parse(attempt.created_at) / 1000) }, { idempotencyKey: `fhfh-natural-clock:${attempt.id}` });
    assert.equal(clock.livemode, false); target.clockId = clock.id; save();
    const customer = target.customerId ? await stripe.customers.retrieve(target.customerId)
      : await stripe.customers.create({ test_clock: clock.id, metadata: { in_season_user_id: user.id, in_season_attempt_id: attempt.id } }, { idempotencyKey: `fhfh-natural-customer:${attempt.id}` });
    assert.equal(customer.livemode, false); assert.equal(customer.test_clock, clock.id); assert.equal(customer.metadata.in_season_user_id, user.id);
    target.customerId = customer.id; save(); await store.customer(attempt.id, customer.id);
    const registryFile = root + '/stripe-objects.json', registry = JSON.parse(fs.readFileSync(registryFile));
    registry.ids = [...new Set([...registry.ids, customer.id])]; fs.writeFileSync(registryFile, JSON.stringify(registry), { mode: 0o600 });
    const result = await createMonthlyBilling({ stripe, store, userId: user.id, minimum });
    const bound = (await query('select subscription_id,schedule_id from public.in_season_sandbox_monthly where id=$1 and user_id=$2', [attempt.id, user.id])).rows[0];
    assert.ok(bound.subscription_id); target.subscriptionId = bound.subscription_id; target.scheduleId = bound.schedule_id; save();
    record({ operation: 'direct_adapter_created', clockId: clock.id, subscriptionId: target.subscriptionId, scheduleId: target.scheduleId, state: result.state, checkoutSessionsCreated: 0 }); return;
  }
  let clock = await stripe.testHelpers.testClocks.retrieve(target.clockId); assert.equal(clock.livemode, false);
  // An accepted clock advance is asynchronous. Wait at most 30 seconds for that
  // same operation, without resubmitting it or creating another test object.
  for (let poll = 0; clock.status === 'advancing' && poll < 6; poll++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    clock = await stripe.testHelpers.testClocks.retrieve(target.clockId); assert.equal(clock.livemode, false);
  }
  assert.equal(clock.status, 'ready');
  const customer = await stripe.customers.retrieve(target.customerId); assert.equal(customer.livemode, false); assert.equal(customer.test_clock, clock.id); assert.equal(customer.metadata.in_season_attempt_id, target.attemptId);
  const subscription = await stripe.subscriptions.retrieve(target.subscriptionId); assert.equal(subscription.livemode, false); assert.equal(subscription.customer, target.customerId);
  if (mode === 'pay-initial') {
    let pm = target.paymentMethodId ? await stripe.paymentMethods.retrieve(target.paymentMethodId)
      : await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' }, metadata: { fhfh_natural_attempt: target.attemptId } }, { idempotencyKey: `fhfh-natural-pm:${target.attemptId}` });
    assert.equal(pm.livemode, false); target.paymentMethodId = pm.id; save();
    if (!pm.customer) pm = await stripe.paymentMethods.attach(pm.id, { customer: target.customerId }, { idempotencyKey: `fhfh-natural-attach:${target.attemptId}` });
    assert.equal(pm.customer, target.customerId);
    await stripe.customers.update(target.customerId, { invoice_settings: { default_payment_method: pm.id } }, { idempotencyKey: `fhfh-natural-customer-default:${target.attemptId}` });
    await stripe.subscriptions.update(target.subscriptionId, { default_payment_method: pm.id }, { idempotencyKey: `fhfh-natural-sub-default:${target.attemptId}` });
    const id = typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice.id;
    let invoice = await stripe.invoices.retrieve(id); assert.equal(invoice.customer, target.customerId); assert.equal(invoice.livemode, false); assert.equal(invoice.total, 177);
    if (invoice.status !== 'paid') { assert.equal(invoice.status, 'open'); invoice = await stripe.invoices.pay(id, { payment_method: pm.id }, { idempotencyKey: `fhfh-natural-pay:${id}` }); }
    assert.equal(invoice.status, 'paid'); target.initialInvoiceId = invoice.id; save();
    record({ operation: 'initial_paid', invoiceId: invoice.id, amount: invoice.amount_paid, checkoutSessionsCreated: 0 }); return;
  }
  if (mode === 'advance') {
    const date = process.argv[3]; assert.ok(['2026-12-01T07:00:00Z','2027-02-01T07:00:00Z','2027-04-01T07:00:00Z','2027-06-01T07:00:00Z','2027-07-01T03:59:59Z','2027-07-01T07:00:00Z'].includes(date));
    const seconds = Date.parse(date) / 1000; assert.ok(seconds > clock.frozen_time);
    const result = await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: seconds }, { idempotencyKey: `fhfh-natural-advance:${clock.id}:${seconds}` });
    record({ operation: 'advance', target: date, status: result.status }); return;
  }
  assert.equal(mode, 'verify');
  const invoices = await stripe.invoices.list({ subscription: subscription.id, limit: 12 }); assert.equal(invoices.has_more, false); assert.ok(invoices.data.length <= 10);
  for (const i of invoices.data) { assert.equal(i.livemode, false); assert.equal(i.customer, target.customerId); assert.ok(i.created < cutoff); assert.equal(i.status, 'paid'); }
  const schedule = await stripe.subscriptionSchedules.retrieve(target.scheduleId); assert.equal(schedule.livemode, false); assert.equal(schedule.customer, target.customerId); assert.equal(schedule.end_behavior, 'cancel'); assert.equal(schedule.phases.at(-1).end_date, cutoff);
  const logs = fs.readFileSync(path.join(__dirname, 'SANDBOX-HTTP-RESULTS.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const done = new Set(fs.existsSync(receipt) ? fs.readFileSync(receipt, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).flatMap(r => (r.outcomes ?? []).filter(o => o.result?.processed).map(o => o.id)) : []);
  const events = [...new Set(logs.filter(l => l.at >= target.eventStartAt && ['invoice.paid','customer.subscription.deleted'].includes(l.eventType)).map(l => l.eventId))];
  const ids = new Set(invoices.data.map(i => i.id)), outcomes = [];
  const now = new Date(Math.max(clock.frozen_time * 1000, Date.now()));
  for (const eventId of events) {
    if (done.has(eventId)) continue;
    const raw = await stripe.events.retrieve(eventId); if (!ids.has(raw.data.object.id) && raw.data.object.id !== subscription.id) continue;
    assert.equal(raw.livemode, false);
    const payload = JSON.stringify(raw), secret = fs.readFileSync(root + '/stripe-webhook-secret', 'utf8');
    const event = stripe.webhooks.constructEvent(payload, stripe.webhooks.generateTestHeaderString({ payload, secret }), secret);
    outcomes.push({ id: eventId, type: event.type, result: await fulfillMonthlyEvent({ stripe, store, event, now }) });
  }
  const state = await store.load(subscription.id); assert.ok(state); const access = await loadInSeasonAccess(user.id, { now });
  const jobs = (await query('select kind,status,jsonb_array_length(accounting_snapshots) as snapshots from public.in_season_sandbox_monthly_jobs where subscription_id=$1', [subscription.id])).rows;
  assert.ok(jobs.every(j => j.snapshots === 0 && j.status === 'pending')); assert.equal(jobs.filter(j => j.kind === 'retry').length, 0);
  if (clock.frozen_time < cutoff) { assert.notEqual(subscription.status, 'canceled'); assert.equal(access.eligible, true); }
  else {
    assert.equal(subscription.status, 'canceled'); assert.equal(subscription.ended_at, cutoff); assert.equal(schedule.status, 'completed'); assert.equal(schedule.completed_at, cutoff);
    assert.equal(invoices.data.filter(i => i.total > 0).length, 9); assert.equal(Object.keys(state.invoices).length, 9); assert.equal(access.eligible, false);
    assert.equal(state.cancelledAt, new Date(cutoff * 1000).toISOString());
    assert.equal((await loadInSeasonAccess(user.id, { now: new Date((cutoff - 1) * 1000) })).eligible, true);
    assert.ok(invoices.data.some(i => i.created === Date.parse('2027-06-01T04:00Z') / 1000 && i.total === 499));
  }
  record({ operation: 'verify', frozenAt: new Date(clock.frozen_time * 1000).toISOString(), subscription: { id: subscription.id, status: subscription.status, endedAt: subscription.ended_at, canceledAt: subscription.canceled_at }, schedule: { id: schedule.id, status: schedule.status, completedAt: schedule.completed_at, finalEnd: schedule.phases.at(-1).end_date }, invoices: invoices.data.map(i => ({ id: i.id, status: i.status, amount: i.amount_paid, created: i.created })), storedPaidPeriods: Object.keys(state.invoices).length, storedCancellationAt: state.cancelledAt, access, jobs, outcomes, checkoutSessionsCreated: 0, virtualTimeInjected: true, stopOrCutoffWorkerExecuted: false, naturalCutoffVerified: clock.frozen_time >= cutoff });
})().catch(e => { record({ error: e.type ?? e.name, code: e.code, message: String(e.message).replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+/g, '[REDACTED]') }); process.exitCode = 1; }).finally(() => pg.end());
