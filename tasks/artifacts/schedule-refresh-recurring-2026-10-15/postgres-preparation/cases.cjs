// PREPARED ONLY. Running this requires separate isolated-fixture authorization.
// No environment-derived PostgreSQL connection configuration is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../../../..');
const { Client } = require(path.join(ROOT, 'web/node_modules/pg'));
const [socket, dataDirectory, marker] = process.argv.slice(2);
assert.ok(socket && dataDirectory && marker, 'Use the owned-cluster launcher');
const cluster = path.dirname(dataDirectory);
assert.equal(fs.realpathSync(socket), path.join(fs.realpathSync(cluster), 'socket'));
assert.equal(fs.readFileSync(path.join(cluster, 'OWNED-SYNTHETIC-FIXTURE'), 'utf8'), marker);
assert.ok(fs.realpathSync(cluster).startsWith('/private/tmp/fhfh-schedule-pg-')
  || fs.realpathSync(cluster).startsWith('/tmp/fhfh-schedule-pg-'));
const clients = [];
const columns = ['yahoo_matchup_week_id','game_key','season','week','source_game_id','source_season_id','game_date','start_time',
  'game_type','game_status','schedule_status','mapping_status','is_countable','team_id','team_abbreviation','opponent_team_id',
  'opponent_abbreviation','home_away','source_url','source_updated_at','source_metadata','fetched_at'];
const identity = new Set(['game_key','source_game_id','team_id']);
const quote = value => '"' + value + '"';
const directSql = `INSERT INTO public.roster_optimizer_team_games (${columns.map(quote)})
  SELECT ${columns.map(name => 'r.' + quote(name))} FROM jsonb_populate_recordset(NULL::public.roster_optimizer_team_games,$1::jsonb) r
  ON CONFLICT(game_key,source_game_id,team_id) DO UPDATE SET ${columns.filter(name => !identity.has(name)).map(name => `${quote(name)}=EXCLUDED.${quote(name)}`)}`;
function rows(timestamp, state = 'FUT', gameId = 2026020112, date = '2026-10-15') {
  const common = { yahoo_matchup_week_id: 2, game_key:'477',season:'2026',week:2,source_game_id:gameId,
    source_season_id:20262027,game_date:date,start_time:'2026-10-15T23:00:00Z',game_type:2,game_status:state,
    schedule_status:'OK',mapping_status:'mapped',is_countable:true,source_url:'https://synthetic.invalid/schedule',
    source_updated_at:null,source_metadata:{synthetic:true},fetched_at:timestamp };
  return [{...common,team_id:3,team_abbreviation:'NYR',opponent_team_id:4,opponent_abbreviation:'PHI',home_away:'home'},
    {...common,team_id:4,team_abbreviation:'PHI',opponent_team_id:3,opponent_abbreviation:'NYR',home_away:'away'}];
}
async function connect() {
  const client = new Client({host:socket,port:65439,database:'roster_schedule_fixture',user:'fixture_owner',
    password:'synthetic-local-only',ssl:false,connectionTimeoutMillis:3000,query_timeout:10000,
    application_name:'fhfh-owned-synthetic-schedule-test'});
  clients.push(client); await client.connect();
  const proof = (await client.query("SELECT current_database() db, current_setting('data_directory') directory, inet_server_addr() addr, current_setting('listen_addresses') listen")).rows[0];
  assert.equal(proof.db,'roster_schedule_fixture'); assert.equal(fs.realpathSync(proof.directory),fs.realpathSync(dataDirectory));
  assert.equal(proof.addr,null); assert.equal(proof.listen,'');
  return client;
}
async function rpc(client, incoming, observedAt) {
  return (await client.query('SELECT public.commit_recurring_roster_schedule($1::jsonb,$2::timestamptz,$3::date,$4::date) result',
    [JSON.stringify(incoming), observedAt, '2026-10-11','2026-10-26'])).rows[0].result;
}
async function snapshot(client) {
  return (await client.query('SELECT source_game_id::text,team_id,game_status,fetched_at::text FROM public.roster_optimizer_team_games ORDER BY source_game_id,team_id')).rows;
}
async function assertFailure(promise, codes) { await assert.rejects(promise, failure => codes.includes(failure.code)); }

async function main() {
  const owner = await connect(), a = await connect(), b = await connect();
  await a.query('SET ROLE service_role'); await b.query('SET ROLE service_role');
  const clock = async () => {
    const value = (await owner.query("SELECT clock_timestamp()-interval '2 seconds' earlier,clock_timestamp()-interval '1 second' later")).rows[0];
    return [value.earlier.toISOString(),value.later.toISOString()];
  };
  let passed = 0;
  const run = async (name, action) => {
    await a.query('ROLLBACK'); await b.query('ROLLBACK');
    await owner.query('TRUNCATE public.roster_optimizer_team_games RESTART IDENTITY');
    await action(await clock()); passed++; process.stdout.write(`PASS ${name}\n`);
  };
  await run('reviewer interleaving, READ COMMITTED: later LIVE wins, delayed FUT skips', async ([old,newer]) => {
    await a.query('BEGIN ISOLATION LEVEL READ COMMITTED'); await a.query('SELECT count(*) FROM public.roster_optimizer_team_games');
    assert.equal((await rpc(b,rows(newer,'LIVE'),newer)).outcome,'applied');
    const before = await snapshot(owner);
    assert.deepEqual(await rpc(a,rows(old),old),{outcome:'skipped_stale',rowsUpserted:0}); await a.query('COMMIT');
    assert.deepEqual(await snapshot(owner),before);
  });
  for (const isolation of ['REPEATABLE READ','SERIALIZABLE']) {
    await run(`older ${isolation} snapshot cannot overwrite newer commit`, async ([old,newer]) => {
      await a.query(`BEGIN ISOLATION LEVEL ${isolation}`); await a.query('SELECT count(*) FROM public.roster_optimizer_team_games');
      assert.equal((await rpc(b,rows(newer,'LIVE'),newer)).outcome,'applied'); const before = await snapshot(owner);
      try { const result = await rpc(a,rows(old),old); assert.equal(result.outcome,'skipped_stale'); }
      catch (failure) { assert.equal(failure.code,'40001'); }
      await a.query('ROLLBACK'); assert.deepEqual(await snapshot(owner),before);
    });
  }
  await run('equal-clock conflicting replay is a whole-batch no-op', async ([_old,newer]) => {
    await rpc(b,rows(newer,'LIVE'),newer); const before=await snapshot(owner);
    assert.equal((await rpc(a,rows(newer),newer)).outcome,'skipped_stale'); assert.deepEqual(await snapshot(owner),before);
  });
  await run('one stale identity rejects mixed existing/new-game batch', async ([old,newer]) => {
    await rpc(b,rows(newer,'LIVE'),newer); const before=await snapshot(owner);
    assert.equal((await rpc(a,[...rows(old),...rows(old,'FUT',2026020113)],old)).outcome,'skipped_stale');
    assert.deepEqual(await snapshot(owner),before);
  });
  await run('busy shared transaction returns no-op and blocks direct manual statement', async ([old]) => {
    await a.query('BEGIN'); await a.query('SELECT pg_advisory_xact_lock(20260829,161013)');
    assert.deepEqual(await rpc(b,rows(old),old),{outcome:'skipped_busy',rowsUpserted:0});
    await assertFailure(b.query(directSql,[JSON.stringify(rows(old))]),['RS002']);
    await a.query('ROLLBACK'); assert.equal((await snapshot(owner)).length,0);
  });
  await run('recurring newer observation rejects delayed direct/manual ON CONFLICT', async ([old,newer]) => {
    await rpc(b,rows(newer,'LIVE'),newer); const before=await snapshot(owner);
    await assertFailure(a.query(directSql,[JSON.stringify(rows(old))]),['RS001']); assert.deepEqual(await snapshot(owner),before);
  });
  await run('direct/manual newer observation fences recurring older observation', async ([old,newer]) => {
    await b.query(directSql,[JSON.stringify(rows(newer,'LIVE'))]); const before=await snapshot(owner);
    assert.equal((await rpc(a,rows(old),old)).outcome,'skipped_stale'); assert.deepEqual(await snapshot(owner),before);
  });
  await run('late stale row rolls back earlier direct/manual batch updates', async ([old,newer]) => {
    const baseline=rows(old,'LIVE'); baseline[0].fetched_at=new Date(Date.parse(old)-1000).toISOString(); baseline[1].fetched_at=newer;
    await b.query(directSql,[JSON.stringify(baseline)]); const before=await snapshot(owner);
    await assertFailure(a.query(directSql,[JSON.stringify(rows(old))]),['RS001']); assert.deepEqual(await snapshot(owner),before);
  });
  await run('newer identity outside refreshed date range still fences a moved incoming game', async ([old,newer]) => {
    await b.query(directSql,[JSON.stringify(rows(newer,'LIVE',2026020112,'2026-10-30'))]); const before=await snapshot(owner);
    assert.equal((await rpc(a,rows(old),old)).outcome,'skipped_stale'); assert.deepEqual(await snapshot(owner),before);
  });
  await run('missing cached identity rejects without writes', async ([old,newer]) => {
    await b.query(directSql,[JSON.stringify(rows(old,'LIVE',2026020113))]); const before=await snapshot(owner);
    assert.equal((await rpc(a,rows(newer),newer)).outcome,'rejected'); assert.deepEqual(await snapshot(owner),before);
  });
  await run('anonymous/authenticated cannot execute clock/commit RPC or mutate cache', async ([old]) => {
    for (const role of ['anon','authenticated']) {
      await owner.query(`SET ROLE ${role}`);
      await assertFailure(owner.query('SELECT public.roster_schedule_observation_clock()'),['42501']);
      await assertFailure(rpc(owner,rows(old),old),['42501']);
      await assertFailure(owner.query(directSql,[JSON.stringify(rows(old))]),['42501']);
      await owner.query('RESET ROLE');
    }
  });
  process.stdout.write(`${passed} real PostgreSQL fixture cases passed. No HTTP/audit-delivery claim.\n`);
}
main().catch(failure => { process.stderr.write(`${failure.stack}\n`); process.exitCode=1; })
  .finally(async () => { await Promise.allSettled(clients.map(client => client.end())); });
