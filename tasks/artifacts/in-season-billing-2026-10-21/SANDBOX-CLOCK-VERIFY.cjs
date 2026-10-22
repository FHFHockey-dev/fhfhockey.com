// Stripe virtual time is passed explicitly to the real lifecycle function.
// Wall-clock HTTP rejection is expected for future simulated paid_at values.
// Durable DB leases stay on wall time; this does not bypass future job claims.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..'), root = '/tmp/fhfh-billing-e2e-qh0ri7vv';
const config = JSON.parse(fs.readFileSync(root + '/supabase-status.json'));
const target = JSON.parse(fs.readFileSync(root + '/monthly-target.json'));
assert.equal(config.API_URL, 'http://127.0.0.1:56421'); assert.equal(new URL(config.DB_URL).host, '127.0.0.1:56422');
Object.assign(process.env, { NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: config.API_URL, NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: config.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY, NODE_PATH: path.join(repo, 'web') });
require('node:module').Module._initPaths();
require(path.join(repo, 'web/node_modules/ts-node')).register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const Stripe = require(path.join(repo, 'web/node_modules/stripe'));
const stripe = new Stripe(fs.readFileSync(root + '/stripe-restricted-key', 'utf8').trim(), { timeout: 10000, maxNetworkRetries: 0 });
const { monthlyBillingStore } = require(path.join(repo, 'web/lib/in-season/monthlyStore.ts'));
const { fulfillMonthlyEvent } = require(path.join(repo, 'web/lib/in-season/monthlyWebhook.ts'));
const { monthlyAccess } = require(path.join(repo, 'web/lib/in-season/monthlyLifecycle.ts'));
const store = monthlyBillingStore();
const receipt = path.join(__dirname, 'SANDBOX-CLOCK-RESULTS.jsonl');
function record(value) { fs.appendFileSync(receipt, JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n'); console.log(JSON.stringify(value)); }
(async () => {
  assert.equal((await stripe.accounts.retrieve()).id, 'acct_1UDRxGLaomqkve47');
  const customer = await stripe.customers.retrieve(target.customerId);
  assert.equal(customer.livemode, false); assert.equal(customer.test_clock, target.clockId); assert.equal(customer.metadata.in_season_attempt_id, target.attemptId);
  const clock = await stripe.testHelpers.testClocks.retrieve(target.clockId); assert.equal(clock.livemode, false); assert.equal(clock.status, 'ready');
  if (process.argv[2] === 'advance') {
    const dates = ['2026-12-01T04:30:00Z', '2026-12-01T07:00:00Z', '2027-02-01T07:00:00Z', '2027-04-01T07:00:00Z', '2027-05-01T07:00:00Z', '2027-06-01T07:00:00Z', '2027-06-02T05:00:00Z', '2027-06-03T05:00:00Z', '2027-07-01T07:00:00Z'];
    const date = process.argv[3]; assert.ok(dates.includes(date)); const seconds = Date.parse(date) / 1000;
    assert.ok(seconds > clock.frozen_time);
    const result = await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: seconds }, { idempotencyKey: `fhfh-e2e-clock:${clock.id}:${seconds}` });
    record({ operation: 'advance', target: date, status: result.status }); return;
  }
  const now = new Date(Math.max(clock.frozen_time * 1000, Date.now()));
  const invoiceList = await stripe.invoices.list({ subscription: target.subscriptionId, limit: 12 }); assert.equal(invoiceList.has_more, false); assert.ok(invoiceList.data.length <= 10);
  const ids = invoiceList.data.map(i => i.id);
  const logs = fs.readFileSync(path.join(__dirname, 'SANDBOX-HTTP-RESULTS.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const eventIds = [...new Set(logs.filter(l => ['invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed', 'customer.subscription.deleted'].includes(l.eventType)).map(l => l.eventId))];
  const outcomes = [];
  const completed = new Set(fs.existsSync(receipt) ? fs.readFileSync(receipt, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).flatMap(r => (r.outcomes ?? []).filter(o => o.result?.processed).map(o => o.id)) : []);
  for (const eventId of eventIds) {
    if (completed.has(eventId)) continue;
    const raw = await stripe.events.retrieve(eventId);
    if (!ids.includes(raw.data.object.id) && raw.data.object.id !== target.subscriptionId) continue;
    assert.equal(raw.livemode, false);
    const payload = JSON.stringify(raw), secret = fs.readFileSync(root + '/stripe-webhook-secret', 'utf8');
    const event = stripe.webhooks.constructEvent(payload, stripe.webhooks.generateTestHeaderString({ payload, secret }), secret);
    if (event.type === 'invoice.payment_failed' && event.data.object.attempt_count === 1 && event.created < event.data.object.created) {
      // Stripe event.created stays on wall time during a test-clock simulation.
      // Charges also retain wall time. For this one first automatic attempt,
      // the invoice-payment allocation and finalization share virtual time.
      const payments = await stripe.invoicePayments.list({ invoice: event.data.object.id, limit: 2 });
      assert.equal(payments.has_more, false); assert.equal(payments.data.length, 1);
      const intent = await stripe.paymentIntents.retrieve(payments.data[0].payment.payment_intent, { expand: ['latest_charge'] });
      const charge = intent.latest_charge;
      assert.equal(intent.livemode, false); assert.equal(intent.customer, target.customerId);
      assert.equal(charge.livemode, false); assert.equal(charge.paid, false);
      const failedAt = payments.data[0].created;
      assert.equal(failedAt, event.data.object.status_transitions.finalized_at);
      assert.ok(failedAt >= event.data.object.created && failedAt <= clock.frozen_time);
      event.created = failedAt;
      record({ operation: 'test_clock_failure_time_translation', eventId, virtualFirstInvoicePaymentTime: failedAt });
    }
    try { outcomes.push({ id: event.id, type: event.type, result: await fulfillMonthlyEvent({ stripe, store, event, now }) }); }
    catch (e) { outcomes.push({ id: event.id, type: event.type, error: e.message }); break; }
  }
  const state = await store.load(target.subscriptionId); assert.ok(state);
  record({ operation: 'verify', frozenAt: new Date(clock.frozen_time * 1000).toISOString(), invoices: invoiceList.data.map(i => ({ id: i.id, status: i.status, total: i.total, paid: i.amount_paid, created: i.created })), outcomes, storedInvoiceCount: Object.keys(state.invoices).length, access: monthlyAccess(state, now), virtualTimeInjected: true, futureJobClaimsNotExercised: true });
})().catch(e => { record({ error: e.type ?? e.name, code: e.code, message: String(e.message).replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+/g, '[REDACTED]') }); process.exitCode = 1; });
