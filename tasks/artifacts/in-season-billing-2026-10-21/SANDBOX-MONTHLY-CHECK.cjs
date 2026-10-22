// Bounded internal adapter probe. Creates at most one task-owned clock/customer
// and one finite schedule; no public monthly checkout or automatic job runner.
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..'), root = '/tmp/fhfh-billing-e2e-qh0ri7vv';
const config = JSON.parse(fs.readFileSync(root + '/supabase-status.json'));
const user = JSON.parse(fs.readFileSync(root + '/synthetic-users.json'))[1];
assert.equal(config.API_URL, 'http://127.0.0.1:56421');
const key = fs.readFileSync(root + '/stripe-restricted-key', 'utf8').trim(); assert.match(key, /^rk_test_/);
Object.assign(process.env, { NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: config.API_URL, NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: config.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY, NODE_PATH: path.join(repo, 'web') });
require('node:module').Module._initPaths();
require(path.join(repo, 'web/node_modules/ts-node')).register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const Stripe = require(path.join(repo, 'web/node_modules/stripe')); const stripe = new Stripe(key, { timeout: 10000, maxNetworkRetries: 0 });
const { monthlyBillingStore } = require(path.join(repo, 'web/lib/in-season/monthlyStore.ts'));
const { createMonthlyBilling } = require(path.join(repo, 'web/lib/in-season/monthlyBilling.ts'));
const store = monthlyBillingStore();
const targetFile = root + '/monthly-target.json';
const saved = fs.existsSync(targetFile) ? JSON.parse(fs.readFileSync(targetFile)) : {};
function save() { fs.writeFileSync(targetFile, JSON.stringify(saved), { mode: 0o600 }); }
const receipt = path.join(__dirname, 'SANDBOX-MONTHLY-RESULTS.jsonl');
function record(value) { fs.appendFileSync(receipt, JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n'); console.log(JSON.stringify(value)); }
(async () => {
  const account = await stripe.accounts.retrieve(); assert.equal(account.id, 'acct_1UDRxGLaomqkve47'); assert.equal(account.default_currency, 'usd');
  const minimum = { accountId: account.id, chargeCurrency: 'usd', settlementCurrency: 'usd', minimumChargeCents: 50,
    verificationReference: 'Sandbox-only account.default_currency=usd; Stripe currencies documentation USD minimum 0.50, checked 2026-10-21. No live settlement eligibility asserted.' };
  const attempt = await store.begin(user.id, minimum); assert.equal(attempt.user_id, user.id);
  saved.attemptId = attempt.id; save();
  const clock = saved.clockId ? await stripe.testHelpers.testClocks.retrieve(saved.clockId) : await stripe.testHelpers.testClocks.create({ name: 'FHFH isolated billing E2E 2026-10-21', frozen_time: Math.floor(Date.parse(attempt.created_at) / 1000) }, { idempotencyKey: `fhfh-e2e-clock:${attempt.id}` });
  assert.equal(clock.livemode, false); saved.clockId = clock.id; save();
  const customer = saved.customerId ? await stripe.customers.retrieve(saved.customerId) : await stripe.customers.create({ test_clock: clock.id, metadata: { in_season_user_id: user.id, in_season_attempt_id: attempt.id } }, { idempotencyKey: `fhfh-e2e-clock-customer:${attempt.id}` });
  assert.equal(customer.livemode, false); assert.equal(customer.test_clock, clock.id); assert.equal(customer.metadata.in_season_user_id, user.id);
  saved.customerId = customer.id; save(); await store.customer(attempt.id, customer.id);
  const registry = JSON.parse(fs.readFileSync(root + '/stripe-objects.json')); registry.ids = [...new Set([...registry.ids, customer.id])]; fs.writeFileSync(root + '/stripe-objects.json', JSON.stringify(registry), { mode: 0o600 });
  record({ stage: 'clock_and_customer_ready', clockId: clock.id, customerId: customer.id, frozenAt: clock.frozen_time, sandboxMinimumCents: 50 });
  const result = await createMonthlyBilling({ stripe, store, userId: user.id, minimum });
  saved.result = result; save();
  record({ stage: 'monthly_adapter', success: true, state: result.state, hostedInvoiceAvailable: !!result.url });
})().catch(e => {
  record({ stage: 'monthly_adapter', success: false, error: e.type ?? e.name, code: e.code, param: e.param,
    message: String(e.message).replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+/g, '[REDACTED]') }); process.exitCode = 1;
});
