// Local operational transport only: the same three existing RPCs over verified PostgreSQL TLS.
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const signatures = {
  persist_projection_game_inputs_v1: {
    p_game_id: 'bigint', p_expected_current_input_fingerprint: 'text', p_input_fingerprint: 'text',
    p_pbp_source_hash: 'text', p_shift_source_hash: 'text', p_pbp_raw_payload_id: 'bigint',
    p_pbp_raw_snapshot_version: 'bigint', p_pbp_raw_payload_hash: 'text', p_shift_raw_payload_id: 'bigint',
    p_shift_raw_snapshot_version: 'bigint', p_shift_raw_payload_hash: 'text', p_parser_version: 'text',
    p_materializer_version: 'text', p_game_row: 'jsonb', p_play_rows: 'jsonb', p_strength_rows: 'jsonb',
    p_expected_play_rows: 'integer', p_expected_strength_rows: 'integer',
  },
  persist_shift_chart_relationships_v1: {
    p_game_id: 'bigint', p_expected_input_fingerprint: 'text', p_expected_input_version: 'bigint',
    p_relationship_fingerprint: 'text', p_algorithm_version: 'text', p_rows: 'jsonb', p_expected_rows: 'integer',
  },
  persist_projection_game_derived_v1: {
    p_game_id: 'bigint', p_expected_input_fingerprint: 'text', p_expected_input_version: 'bigint',
    p_derived_fingerprint: 'text', p_algorithm_version: 'text', p_player_rows: 'jsonb', p_team_rows: 'jsonb',
    p_goalie_rows: 'jsonb', p_expected_player_rows: 'integer', p_expected_team_rows: 'integer',
    p_expected_goalie_rows: 'integer', p_goalie_outcome: 'text', p_goalie_justification: 'text',
  },
};

function rpcSql(name, args) {
  assert.ok(Object.hasOwn(signatures, name), 'Unexpected RPC');
  const signature = signatures[name];
  assert.deepEqual(Object.keys(args).sort(), Object.keys(signature).sort(), 'RPC parameter shape changed');
  assert.ok(Number.isSafeInteger(args.p_game_id) && args.p_game_id >= 2026020001 && args.p_game_id <= 2026020298);
  const parameters = Object.entries(signature).map(([key, type]) => {
    const value = args[key];
    if (value === null) return `${key} => NULL::${type}`;
    assert.notEqual(value, undefined);
    if (type === 'integer' || type === 'bigint') assert.ok(Number.isSafeInteger(value));
    else if (type === 'text') assert.equal(typeof value, 'string');
    else assert.ok(typeof value === 'object');
    const text = type === 'jsonb' ? JSON.stringify(value) : String(value);
    const tag = `$drm_${crypto.randomBytes(16).toString('hex')}$`;
    assert.ok(!text.includes(tag));
    return `${key} => ${tag}${text}${tag}::${type}`;
  });
  return `begin; set local role service_role; set local statement_timeout='5s'; set local lock_timeout='5s'; select coalesce(jsonb_agg(to_jsonb(receipt)), '[]'::jsonb) from public.${name}(${parameters.join(',')}) receipt; commit;`;
}

function rpcFetch(input, init) {
  const target = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
  assert.equal(target.origin, 'https://fyhftlxokyjtpndbkfse.supabase.co');
  assert.equal(init.method, 'POST');
  assert.ok(init.signal, 'A five-second caller deadline is required');
  const name = target.pathname.replace('/rest/v1/rpc/', '');
  const sql = rpcSql(name, JSON.parse(init.body));
  const connection = new URL(process.env.SUPABASE_DB_URL);
  assert.equal(connection.protocol, 'postgresql:');
  assert.equal(connection.hostname, 'db.fyhftlxokyjtpndbkfse.supabase.co');
  assert.equal(connection.pathname, '/postgres');
  assert.ok(!connection.port || connection.port === '5432');
  const environment = { ...process.env };
  delete environment.PGSERVICE;
  delete environment.PGSERVICEFILE;
  return new Promise((resolve, reject) => {
    // Password stays in the child environment; SQL/data go through stdin, never argv or files.
    const child = spawn('/opt/homebrew/opt/libpq/bin/psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
      env: { ...environment, PGHOST: connection.hostname, PGPORT: '5432', PGDATABASE: 'postgres',
        PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password),
        PGSSLMODE: 'verify-full', PGSSLROOTCERT: path.join(__dirname, 'production/step5/supabase-prod-ca-2021.crt'),
        PGAPPNAME: 'codex-drm-step5-repair' },
      stdio: ['pipe', 'pipe', 'pipe'], signal: init.signal,
    });
    let output = '', diagnostic = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { diagnostic += chunk; });
    child.on('error', reject);
    // psql may close stdin while reporting a startup error; retain its diagnostic.
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
    child.on('close', code => {
      if (code !== 0) {
        // Do not include SQL CONTEXT/LINE excerpts, which may contain full payloads.
        const error = new Error(`PostgreSQL client failed (${code}): ${diagnostic.split('\n').find(line => /ERROR|FATAL|psql: error/.test(line))?.slice(0, 350) ?? 'no successful commit receipt'}`);
        error.code = `PSQL_${code}`; reject(error); return;
      }
      try {
        const receipt = JSON.parse(output.trim());
        assert.ok(Array.isArray(receipt) && receipt.length === 1, 'Expected exactly one committed RPC receipt');
        resolve(Object.assign(new Response(JSON.stringify(receipt), {
          status: 200, headers: { 'content-type': 'application/json' },
        }), { transport: 'direct-postgres-psql' }));
      } catch (error) { reject(error); }
    });
    child.stdin.end(sql);
  });
}
module.exports = { rpcFetch, rpcSql, signatures };
