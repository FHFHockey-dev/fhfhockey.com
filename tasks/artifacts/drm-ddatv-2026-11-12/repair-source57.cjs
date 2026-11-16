// Approved one-game source exception. Immutable backups; atomic snapshot + normalization.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), { spawn } = require('node:child_process');
const { compareRows, assertStep5Health, assertStep5Approval } = require('./apply-stored-repair.cjs');
const root = path.resolve(__dirname, '../../..'), dir = path.join(__dirname, 'production/step5');
const read = file => JSON.parse(fs.readFileSync(path.join(dir, file)));
const save = (file, value) => fs.writeFileSync(path.join(dir, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const literal = value => {
  if (value === null) return 'NULL';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const tag = `$source57_${crypto.randomBytes(12).toString('hex')}$`;
  assert.ok(!text.includes(tag)); return tag + text + tag;
};

function sourceSql(snapshot, candidate, normalized, manifest) {
  const pbp = snapshot.heads.find(x => x.endpoint === 'play-by-play');
  const shifts = snapshot.heads.find(x => x.endpoint === 'shiftcharts');
  const args = {
    p_game_id: [2026020057, 'bigint'], p_season_id: [20262027, 'bigint'], p_game_date: ['2026-10-08', 'date'],
    p_expected_pbp_payload_hash: [normalized.pbpPayloadHash, 'text'], p_expected_shift_payload_hash: [normalized.shiftPayloadHash, 'text'],
    p_expected_current_fingerprint: [manifest.normalization_fingerprint, 'text'], p_expected_current_version: [manifest.normalization_version, 'bigint'],
    p_parser_fingerprint: [normalized.parserFingerprint, 'text'], p_parser_version: [normalized.parserVersion, 'integer'],
    p_strength_version: [normalized.strengthVersion, 'integer'], p_materializer_version: [normalized.materializerVersion, 'text'],
    p_roster_rows: [normalized.rosterRows, 'jsonb'], p_event_rows: [normalized.eventRows, 'jsonb'], p_shift_rows: [normalized.shiftRows, 'jsonb'],
    p_expected_roster_rows: [normalized.rosterRows.length, 'integer'], p_expected_event_rows: [normalized.eventRows.length, 'integer'],
    p_expected_shift_rows: [normalized.shiftRows.length, 'integer'],
  };
  const guard = [pbp, shifts].map(head => `if not exists(select 1 from public.nhl_api_game_payload_snapshot_heads where game_id=2026020057 and endpoint=${literal(head.endpoint)} and raw_payload_id=${head.raw_payload_id} and payload_hash=${literal(head.payload_hash)} and snapshot_version=${head.snapshot_version}) then raise exception 'Source head changed'; end if;`).join('\n');
  return `begin;set local role service_role;set local statement_timeout='5s';set local lock_timeout='5s';
do $guard57$ begin
perform 1 from public.nhl_api_game_payload_snapshot_heads where game_id=2026020057 and endpoint in ('play-by-play','shiftcharts') order by endpoint for update;
${guard}
end $guard57$;
insert into public.nhl_api_game_payloads_raw(game_id,endpoint,season_id,game_date,source_url,payload_hash,payload,fetched_at)
values(2026020057,'shiftcharts',20262027,'2026-10-08',${literal(candidate.htmlReports.visitorUrl)},${literal(normalized.shiftPayloadHash)},${literal(candidate)}::jsonb,clock_timestamp());
select coalesce(jsonb_agg(to_jsonb(receipt)), '[]'::jsonb) from public.persist_nhl_api_gamecenter_normalized_v2(${Object.entries(args).map(([key, [value, type]]) => `${key}=>${literal(value)}::${type}`).join(',')}) receipt;
commit;`;
}

async function main() {
  const approval = read('SOURCE57-APPROVAL.json'), scope = read('APPROVED-SCOPE.json');
  assert.equal(approval.status, 'approved_by_TJ'); assert.equal(approval.gameId, 2026020057);
  assert.equal(process.argv[2], '--write'); assertStep5Approval(scope);
  const health = JSON.parse(fs.readFileSync(process.argv[3])); assertStep5Health(health, Date.now(), null);
  assert.ok(health.ioLockWaits === 0 && health.longestActiveSeconds <= 5 && Date.now() - Date.parse(health.checkedAt) < 60000);
  const snapshot = read('2026020057-before.json'), candidate = read('game-57-reports/shift-candidate.json');
  const normalized = read('game-57-reports/normalized-offline-candidate.json'), qualification = read('game-57-reports/QUALIFICATION.json');
  const hash = crypto.createHash('sha256').update(JSON.stringify(candidate)).digest('hex');
  assert.equal(hash, approval.candidateHash); assert.equal(hash, normalized.shiftPayloadHash);
  assert.equal(qualification.passed, true); assert.equal(qualification.officialValues, 152); assert.deepEqual(qualification.overlaps, []);
  assert.equal(normalized.gameId, 2026020057); assert.equal(normalized.rosterRows.length, 40);
  assert.equal(normalized.eventRows.length, 322); assert.equal(normalized.shiftRows.length, 749);
  require(path.join(root, 'web/node_modules/dotenv')).config({ path: path.join(root, 'web/.env.local'), quiet: true });
  const { createClient } = require(path.join(root, 'web/node_modules/@supabase/supabase-js'));
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL); assert.equal(api.origin, 'https://fyhftlxokyjtpndbkfse.supabase.co');
  let requests = 0, mutations = 0;
  const prefix = process.argv[4] ?? 'SOURCE57'; assert.ok(/^SOURCE57(?:-resume-\d+)?$/.test(prefix));
  const journalFile = path.join(dir, `${prefix}-JOURNAL.jsonl`); fs.writeFileSync(journalFile, '', { flag: 'wx', mode: 0o600 });
  const journal = data => fs.appendFileSync(journalFile, JSON.stringify({ at: new Date().toISOString(), requests, mutations, ...data }) + '\n');
  const database = createClient(api.href, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init = {}) => {
      const url = new URL(String(input)); assert.equal(url.origin, api.origin); assert.equal(init.method ?? 'GET', 'GET');
      assert.ok(++requests <= 15); const start = Date.now(); const response = await fetch(input, { ...init, signal: AbortSignal.timeout(5000) });
      const text = await response.text(); assert.ok(response.ok && Date.now() - start < 5000); journal({ event: 'read_response', durationMs: Date.now() - start });
      return new Response(text, { status: response.status, headers: response.headers });
    } } });
  const get = async (table, key = 'game_id', limit = 1000) => { const { data, error } = await database.from(table).select('*').eq(key, 2026020057).limit(limit); if (error) throw error; assert.ok(data.length < limit); return data; };
  try {
    const heads = (await get('nhl_api_game_payload_snapshot_heads')).filter(x => ['play-by-play', 'shiftcharts'].includes(x.endpoint)).sort((a,b)=>a.endpoint.localeCompare(b.endpoint));
    assert.deepEqual(heads, snapshot.heads);
    const manifests = await get('nhl_api_game_normalization_status'); assert.equal(manifests.length, 1);
    const manifest = manifests[0]; assert.equal(manifest.status, 'complete');
    const tables = [['nhl_api_game_roster_spots', 'player_id', normalized.rosterRows], ['nhl_api_pbp_events', 'event_id', normalized.eventRows], ['nhl_api_shift_rows', 'shift_id', normalized.shiftRows]];
    const before = {}; for (const [table] of tables) before[table] = await get(table);
    save(`${prefix}-BEFORE.json`, { heads, manifest, before });
    const sql = sourceSql(snapshot, candidate, normalized, manifest);
    const connection = new URL(process.env.SUPABASE_DB_URL); assert.equal(connection.hostname, 'db.fyhftlxokyjtpndbkfse.supabase.co'); assert.equal(connection.pathname, '/postgres');
    const environment = { ...process.env }; delete environment.PGSERVICE; delete environment.PGSERVICEFILE;
    const started = Date.now(); requests++; mutations += 2; journal({ event: 'source_and_normalization_requested', candidateHash: hash });
    const receipts = await new Promise((resolve, reject) => {
      const child = spawn('/opt/homebrew/opt/libpq/bin/psql', ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'], {
        env: { ...environment, PGHOST: connection.hostname, PGPORT:'5432', PGDATABASE:'postgres', PGUSER:decodeURIComponent(connection.username), PGPASSWORD:decodeURIComponent(connection.password),
          PGSSLMODE:'verify-full', PGSSLROOTCERT:path.join(dir,'supabase-prod-ca-2021.crt'), PGAPPNAME:'codex-drm-source57' },
        stdio:['pipe','pipe','pipe'], signal:AbortSignal.timeout(5000) });
      let output='', error=''; child.stdout.on('data', x=>output+=x);child.stderr.on('data',x=>error+=x);child.on('error',reject);child.stdin.on('error',e=>{if(e.code!=='EPIPE')reject(e)});
      child.on('close',code=>{if(code!==0)return reject(new Error(`psql ${code}: ${error.split('\n').find(x=>/ERROR|FATAL|psql: error/.test(x))?.slice(0,350)}`));try{resolve(JSON.parse(output.trim()))}catch(e){reject(e)}});child.stdin.end(sql);
    });
    assert.ok(Date.now()-started<5000);assert.equal(receipts.length,1);const receipt=receipts[0];
    assert.equal(receipt.game_id,2026020057);assert.equal(receipt.normalization_status,'complete');assert.equal(receipt.shift_raw_payload_hash,hash);
    assert.equal(receipt.observed_shift_rows,749);assert.equal(receipt.observed_event_rows,322);assert.equal(receipt.observed_roster_rows,40);
    journal({ event:'source_and_normalization_committed', durationMs:Date.now()-started, receipt });
    const afterHeads=await get('nhl_api_game_payload_snapshot_heads'),afterManifests=await get('nhl_api_game_normalization_status');
    const newHead=afterHeads.find(x=>x.endpoint==='shiftcharts');assert.equal(newHead.payload_hash,hash);assert.equal(newHead.raw_payload_id,receipt.shift_raw_payload_id);
    assert.deepEqual(afterHeads.find(x=>x.endpoint==='play-by-play'),heads.find(x=>x.endpoint==='play-by-play'));
    assert.equal(afterManifests.length,1);assert.equal(afterManifests[0].status,'complete');assert.equal(afterManifests[0].normalization_fingerprint,receipt.normalization_fingerprint);
    const after={};for(const [table,key,expected] of tables){after[table]=await get(table);compareRows(after[table],expected,key,table)}
    save(`${prefix}-AFTER.json`,{heads:afterHeads,manifest:afterManifests[0],after,receipt});journal({event:'verified'});
    console.log(JSON.stringify({status:'verified',requests,mutations,gameId:2026020057,rawPayloadId:newHead.raw_payload_id,rawVersion:newHead.snapshot_version}));
  } catch(error) { journal({event:'stopped',error:error.message});throw error; }
}
module.exports={sourceSql};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
