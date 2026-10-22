// Runs the real executor with isolated storage and Stripe virtual time. Only the
// fixture's due_at is translated during the REAL claim RPC, then restored before
// execution. This is not proof of a deployed scheduler or virtual-time SQL API.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..'), root = '/tmp/fhfh-billing-e2e-qh0ri7vv';
const config = JSON.parse(fs.readFileSync(root + '/supabase-status.json'));
const targetFile = root + '/monthly-target.json', target = JSON.parse(fs.readFileSync(targetFile));
assert.equal(config.API_URL, 'http://127.0.0.1:56421'); assert.equal(new URL(config.DB_URL).host, '127.0.0.1:56422');
Object.assign(process.env, { NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: config.API_URL, NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: config.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY, NODE_PATH: path.join(repo, 'web') });
require('node:module').Module._initPaths();
require(path.join(repo, 'web/node_modules/ts-node')).register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const Stripe = require(path.join(repo, 'web/node_modules/stripe'));
const stripe = new Stripe(fs.readFileSync(root + '/stripe-restricted-key', 'utf8').trim(), { timeout: 10000, maxNetworkRetries: 0 });
const { Client } = require(path.join(repo, 'web/node_modules/pg')); const pg = new Client({ connectionString: config.DB_URL });
const { monthlyBillingStore } = require(path.join(repo, 'web/lib/in-season/monthlyStore.ts'));
const { runMonthlyBillingJobs } = require(path.join(repo, 'web/lib/in-season/monthlyExecutor.ts'));
const { monthlyAccess } = require(path.join(repo, 'web/lib/in-season/monthlyLifecycle.ts'));
const store = monthlyBillingStore();
function record(value) { fs.appendFileSync(path.join(__dirname, 'SANDBOX-JOBS-RESULTS.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n'); console.log(JSON.stringify(value)); }
async function query(sql, values = []) {
  const i = (await pg.query('select current_database() as db,inet_server_port() as port')).rows[0]; assert.deepEqual(i, { db: 'postgres', port: 5432 });
  return pg.query(sql, values);
}
(async () => {
  assert.equal((await stripe.accounts.retrieve()).id, 'acct_1UDRxGLaomqkve47');
  const clock = await stripe.testHelpers.testClocks.retrieve(target.clockId); assert.equal(clock.livemode, false); assert.equal(clock.status, 'ready');
  const customer = await stripe.customers.retrieve(target.customerId); assert.equal(customer.livemode, false); assert.equal(customer.test_clock, clock.id);
  if (process.argv[2] === 'prepare') {
    const invoices = await stripe.invoices.list({ subscription: target.subscriptionId, limit: 12 }); assert.equal(invoices.has_more, false);
    const failed = invoices.data.filter(i => i.status === 'open' && i.amount_paid === 0 && i.total === 499); assert.equal(failed.length, 1);
    let invoice = failed[0]; assert.equal(invoice.customer, target.customerId); assert.equal(invoice.livemode, false); assert.equal(invoice.attempt_count, 1);
    if (invoice.auto_advance !== false) invoice = await stripe.invoices.update(invoice.id, { auto_advance: false }, { idempotencyKey: `fhfh-e2e-manual-retries:${invoice.id}` });
    assert.equal(invoice.auto_advance, false); target.failureInvoiceId = invoice.id; fs.writeFileSync(targetFile, JSON.stringify(target), { mode: 0o600 });
    record({ operation: 'disable_competing_collection_on_test_invoice', invoiceId: invoice.id, autoAdvance: invoice.auto_advance, attemptCount: invoice.attempt_count }); return;
  }
  await pg.connect();
  const now = new Date(clock.frozen_time * 1000);
  const testStore = { ...store,
    jobs: async limit => (await query("select * from public.in_season_sandbox_monthly_jobs where subscription_id=$1 and due_at<=$2 and (status='pending' or (status='running' and lease_until<=clock_timestamp())) order by due_at,id limit $3", [target.subscriptionId, now, limit])).rows.map(j => ({ ...j, due_at: j.due_at.toISOString() })),
    claimJob: async id => {
      const job = (await query('select * from public.in_season_sandbox_monthly_jobs where id=$1 and subscription_id=$2', [id, target.subscriptionId])).rows[0]; assert.ok(job); assert.ok(job.due_at <= now);
      await query("update public.in_season_sandbox_monthly_jobs set due_at=clock_timestamp()-interval '1 second' where id=$1 and subscription_id=$2", [id, target.subscriptionId]);
      let result; try { result = await store.claimJob(id); }
      finally { await query('update public.in_season_sandbox_monthly_jobs set due_at=$1 where id=$2 and subscription_id=$3', [job.due_at, id, target.subscriptionId]); }
      return result ? { ...result, job: { ...result.job, due_at: job.due_at.toISOString() } } : null;
    },
  };
  const result = await runMonthlyBillingJobs({ stripe, store: testStore, now, limit: 4, retries: { accountId: 'acct_1UDRxGLaomqkve47', automaticRetriesDisabled: true, verificationReference: 'Task-owned failed invoice auto_advance=false, verified by prepare; executor checks it again.' } });
  const state = await store.load(target.subscriptionId);
  record({ operation: 'real_executor_with_fixture_due_translation', frozenAt: now.toISOString(), result, access: monthlyAccess(state, now), failedAttempts: Object.values(state.invoices).filter(i => !i.paidAt).map(i => i.failedAttempts), accountingSnapshots: (await query('select kind,status,jsonb_array_length(accounting_snapshots) as snapshots from public.in_season_sandbox_monthly_jobs where subscription_id=$1', [target.subscriptionId])).rows });
})().catch(e => { record({ error: e.type ?? e.name, code: e.code, message: String(e.message).replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+/g, '[REDACTED]') }); process.exitCode = 1; }).finally(() => pg.end());
