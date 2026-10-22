// Disposable native PostgreSQL verification only. No Stripe or hosted Auth calls.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const repo = path.resolve(__dirname, '../../..');
const { Client } = require(path.join(repo, 'web/node_modules/pg'));
require(path.join(repo, 'web/node_modules/ts-node')).register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const lifecycle = require(path.join(repo, 'web/lib/in-season/monthlyLifecycle.ts'));
const { IN_SEASON_SANDBOX_CATALOG: catalog } = require(path.join(repo, 'web/lib/in-season/billingConfig.ts'));
const root = fs.readFileSync('/tmp/fhfh-billing-e2e-target-path', 'utf8').trim();
assert.match(root, /^\/tmp\/fhfh-billing-e2e-[a-z0-9_]+$/);
const target = JSON.parse(fs.readFileSync(path.join(root, 'target.json'), 'utf8'));
assert.equal(target.root, root); assert.equal(target.host, '127.0.0.1'); assert.equal(target.port, 65439);
const config = { host: target.host, port: target.port, user: target.user, database: target.database,
  password: fs.readFileSync(path.join(root, 'postgres-password'), 'utf8').trim(), application_name: 'fhfh-isolated-billing-sql-check' };
const client = new Client(config);
const checks = [];
const pass = (name) => { checks.push(name); console.log(`PASS ${name}`); };
async function isolation(connection = client) {
  const row = (await connection.query('select host(inet_server_addr()) as host, inet_server_port() as port, current_database() as db')).rows[0];
  assert.deepEqual(row, { host: '127.0.0.1', port: 65439, db: 'postgres' });
}
async function query(sql, values = [], connection = client) { await isolation(connection); return connection.query(sql, values); }
async function rpc(name, values, connection = client) {
  assert.match(name, /^[a-z_]+$/);
  return (await query(`select public.${name}(${values.map((_, i) => `$${i + 1}`).join(',')}) as value`, values, connection)).rows[0].value;
}
async function rejects(name, operation, pattern) { await assert.rejects(operation, pattern); pass(name); }
async function service(connection = client) {
  await query("set role service_role; set request.jwt.claim.role='service_role'", [], connection);
}
const json = (value) => JSON.stringify(value);

(async () => {
  await client.connect(); await isolation();
  const data = (await client.query('show data_directory')).rows[0].data_directory;
  assert.equal(fs.realpathSync(data), fs.realpathSync(path.join(root, 'data')));
  assert.equal((await client.query('show listen_addresses')).rows[0].listen_addresses, '127.0.0.1');
  assert.equal((await client.query("select count(*)::int as count from pg_tables where schemaname='public'")).rows[0].count, 0);
  pass('fresh task-owned loopback cluster, empty public schema');
  // These are minimal Auth SQL fixtures, not the GoTrue/Auth HTTP service.
  await query(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text unique not null);
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  await query(fs.readFileSync(path.join(repo, 'supabase/migrations/20260927104934_in_season_access_workspace.sql'), 'utf8'));
  await query(fs.readFileSync(path.join(repo, 'supabase/migrations/20261021210000_in_season_sandbox_billing.sql'), 'utf8'));
  pass('prerequisite and billing draft SQL executed successfully in disposable cluster');
  const a = randomUUID(), b = randomUUID();
  await query('insert into auth.users(id,email) values($1,$2),($3,$4)', [a,'billing-a@example.invalid',b,'billing-b@example.invalid']);
  await query("insert into public.in_season_grants(user_id,source,source_reference,status,effective_from,effective_to) values($1,'grandfather','fixture-independent','active',now()-interval '1 day','2027-07-01T04:00Z')", [a]);
  await query("insert into public.in_season_workspaces(user_id,provider,league_id,team_id,season_id,start_date,end_date,workspace) values($1,'manual','fixture-league','fixture-team',20262027,'2026-10-21','2026-10-27','{\"preserved\":true}')", [a]);
  pass('exactly two synthetic Auth rows and independent grant/manual workspace seeded');
  for (const role of ['anon','authenticated']) {
    await query(`set role ${role}; set request.jwt.claim.role='service_role'`);
    await rejects(`${role} cannot read billing ledger`, () => query('select * from public.in_season_sandbox_monthly'), /permission denied/);
    await rejects(`${role} cannot call privileged billing RPC even with forged role claim`, () => rpc('begin_in_season_sandbox_monthly',[a,json({})]), /permission denied/);
    await query('reset role');
  }
  await service();
  const seasonA = (await query('select * from public.begin_in_season_sandbox_checkout($1)', [a])).rows[0];
  const seasonB = (await query('select * from public.begin_in_season_sandbox_checkout($1)', [b])).rows[0];
  assert.notEqual(seasonA.id, seasonB.id);
  await rpc('attach_in_season_sandbox_checkout',[seasonA.id,'cs_test_fixture_a']);
  const claimA = await rpc('claim_in_season_sandbox_reconciliation',[seasonA.id,'evt_sql_paid']);
  const paidAt = new Date(Math.floor(Date.now()/1000)*1000).toISOString();
  const seasonArgs = [seasonA.id,a,'evt_sql_paid',claimA.token,'cs_test_fixture_a','pi_sql_season',paidAt,true,json({fixture:true})];
  const wrongOwner = [...seasonArgs]; wrongOwner[1] = b;
  await rejects('season reconciliation refuses another account', () => rpc('reconcile_in_season_sandbox_payment', wrongOwner), /binding.*mismatch/);
  await rpc('reconcile_in_season_sandbox_payment',seasonArgs);
  assert.equal((await rpc('claim_in_season_sandbox_reconciliation',[seasonA.id,'evt_sql_paid'])).duplicate,true);
  await rejects('global season receipt cannot move to another account', () => rpc('claim_in_season_sandbox_reconciliation',[seasonB.id,'evt_sql_paid']), /ownership mismatch/);
  pass('season payment persists one grant and duplicate receipt');
  for (const [event, active] of [['evt_sql_refund',false],['evt_sql_won',true]]) {
    const claim = await rpc('claim_in_season_sandbox_reconciliation',[seasonA.id,event]);
    await rpc('reconcile_in_season_sandbox_payment',[seasonA.id,a,event,claim.token,'cs_test_fixture_a','pi_sql_season',paidAt,active,json({fixture:true,event})]);
    const row = (await query("select status,effective_from,effective_to from public.in_season_grants where source_reference='stripe:sandbox:pi_sql_season'")).rows[0];
    assert.equal(row.status,active?'active':'revoked'); assert.equal(row.effective_from.toISOString(),paidAt);
    assert.equal(row.effective_to.toISOString(),'2027-07-01T04:00:00.000Z');
  }
  pass('season adjustment changes only status and retains original coverage');
  const minimum = { accountId:catalog.accountId,chargeCurrency:'usd',settlementCurrency:'usd',minimumChargeCents:50,verificationReference:'SQL fixture only' };
  async function monthly(user, suffix) {
    const attempt=await rpc('begin_in_season_sandbox_monthly',[user,json(minimum)]);
    await rpc('bind_in_season_sandbox_monthly_customer',[attempt.id,`cus_sql_${suffix}`]);
    const identity={userId:user,attemptId:attempt.id,customerId:`cus_sql_${suffix}`,verifiedMinimum:minimum};
    const periods=lifecycle.buildSettledMonthlyPlan({...identity,startsAt:new Date(attempt.created_at)}).periods;
    const state=lifecycle.createMonthlyState({...identity,periods,subscriptionId:`sub_sql_${suffix}`,scheduleId:`sub_sched_sql_${suffix}`});
    await rpc('attach_in_season_sandbox_monthly',[attempt.id,json(state)]);
    return state;
  }
  let stateA=await monthly(a,'a'); const stateB=await monthly(b,'b');
  const claimed=await rpc('claim_in_season_sandbox_monthly',[stateA.binding.subscriptionId,'evt_monthly_paid']);
  const second=new Client(config); await second.connect(); await service(second);
  try {
    await rejects('concurrent reconciliation is fenced on separate database connection', () => rpc('claim_in_season_sandbox_monthly',[stateA.binding.subscriptionId,'evt_competing'],second), /busy/);
  } finally { await second.end(); }
  const now=new Date();
  stateA=lifecycle.reduceMonthlyEvent(stateA,{kind:'paid',eventId:'evt_monthly_paid',userId:a,subscriptionId:stateA.binding.subscriptionId,invoiceId:'in_sql_a',period:0,paymentIntentId:'pi_sql_monthly',paidAt:now.toISOString()},now);
  const commitArgs=[stateA.binding.subscriptionId,'evt_monthly_paid',claimed.token,json(stateA),json(lifecycle.monthlyPurchaseGrants(stateA)),'[]',false];
  await rejects('wrong lease token cannot persist payment or grant', () => rpc('commit_in_season_sandbox_monthly',[...commitArgs.slice(0,2),randomUUID(),...commitArgs.slice(3)]), /lease mismatch/);
  await rpc('commit_in_season_sandbox_monthly',commitArgs);
  assert.equal((await rpc('claim_in_season_sandbox_monthly',[stateA.binding.subscriptionId,'evt_monthly_paid'])).duplicate,true);
  pass('monthly state, payment binding, receipt and grant commit together');
  const claimedB=await rpc('claim_in_season_sandbox_monthly',[stateB.binding.subscriptionId,'evt_monthly_b']);
  const nextB=lifecycle.reduceMonthlyEvent(stateB,{kind:'paid',eventId:'evt_monthly_b',userId:b,subscriptionId:stateB.binding.subscriptionId,invoiceId:'in_sql_b',period:0,paymentIntentId:'pi_sql_monthly',paidAt:now.toISOString()},now);
  await rejects('payment cannot fund a second account', () => rpc('commit_in_season_sandbox_monthly',[stateB.binding.subscriptionId,'evt_monthly_b',claimedB.token,json(nextB),json(lifecycle.monthlyPurchaseGrants(nextB)),'[]',false]), /duplicate key/);
  assert.equal((await rpc('get_in_season_sandbox_monthly',[stateB.binding.subscriptionId])).version,0);
  assert.equal((await query('select count(*)::int as count from public.in_season_grants where user_id=$1',[b])).rows[0].count,0);
  pass('rejected cross-account payment rolls back state and grants');
  const cancel=await rpc('claim_in_season_sandbox_monthly',[stateA.binding.subscriptionId,'cancel:sql']);
  stateA=lifecycle.acceptMonthlyCancellation(cancel.state,a,'sql',new Date());
  await rpc('commit_in_season_sandbox_monthly',[stateA.binding.subscriptionId,'cancel:sql',cancel.token,json(stateA),json(lifecycle.monthlyPurchaseGrants(stateA)),'[]',true]);
  const jobs=await rpc('list_in_season_sandbox_monthly_jobs',[10]);
  const stop=jobs.find(j=>j.subscription_id===stateA.binding.subscriptionId && j.kind==='stop'); assert.ok(stop);
  const job=await rpc('claim_in_season_sandbox_monthly_job',[stop.id]); assert.ok(job.token);
  assert.equal(await rpc('claim_in_season_sandbox_monthly_job',[stop.id]),null);
  await rpc('snapshot_in_season_sandbox_monthly_job',[stop.id,job.token,json({fixture:true,operation:'stop'})]);
  await rpc('finish_in_season_sandbox_monthly_job',[stop.id,job.token]);
  assert.equal(await rpc('claim_in_season_sandbox_monthly_job',[stop.id]),null);
  pass('cancellation queues one stop; job lease, snapshot and completion execute');
  await query('reset role');
  assert.equal((await query("select status from public.in_season_grants where source_reference='fixture-independent'")).rows[0].status,'active');
  assert.equal((await query('select workspace from public.in_season_workspaces where user_id=$1',[a])).rows[0].workspace.preserved,true);
  assert.equal((await query('select count(*)::int as count from auth.users')).rows[0].count,2);
  pass('independent grandfather access and manual workspace remain unchanged');
  const result={success:true,checks:checks.length,passed:checks,postgres:'17.11',target:'disposable 127.0.0.1:65439',auth:'minimal SQL fixtures; GoTrue/HTTP Auth not run',stripeCasesExecuted:0};
  fs.writeFileSync(path.join(__dirname,'LOCAL-SQL-RESULTS.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({success:true,checks:checks.length,stripeCasesExecuted:0}));
})().catch((error)=>{console.error(JSON.stringify({success:false,passed:checks,error:error.message,code:error.code}));process.exitCode=1;}).finally(()=>client.end());
