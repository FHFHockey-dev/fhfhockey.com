'use strict';
// Reader-only contract probes. Hand-authored payloads are NOT writer output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(process.argv[2] || '/workspace/shared/fhfhockey.com');
assert.equal(process.version, 'v22.11.0');
const guard = globalThis.__FHFH_OFFLINE_GUARD;
assert.ok(guard);
const readerPath = path.join(repo, 'web/lib/projections/queries/skater-queries.ts');
const payloadPath = path.join(repo, 'web/lib/supabase/Upserts/rollingPlayerSupportPayload.ts');
const { fetchRollingRows, ROLLING_ROW_SELECT_CLAUSE } = require(readerPath);
const { mergeRollingSupportPayloadFields } = require(payloadPath);
const selected = new Set(ROLLING_ROW_SELECT_CLAUSE.split(','));
const omittedPairFields = ['sog_per_60_shots_last5', 'sog_per_60_toi_seconds_last5', 'toi_seconds_total_all'];
const base = { player_id: 7, game_id: 2026020006, game_date: '2026-10-06', season: 20262027,
  strength_state: 'ev', toi_seconds_avg_all: 1200, toi_seconds_avg_last5: 1200,
  sog_per_60_last5: 3, sog_per_60_all: null, shots_total_all: null,
  toi_seconds_total_last5: null };
const payload = { historicalCompatibility: { sog_per_60_all: 16.5, shots_total_all: 11,
  toi_seconds_total_last5: 6000, sog_per_60_shots_last5: 1,
  sog_per_60_toi_seconds_last5: 1200, toi_seconds_total_all: 7200 } };
const sidecar = { player_id: base.player_id, game_id: base.game_id,
  game_date: base.game_date, season: base.season, strength_state: base.strength_state,
  payload_schema_version: 1, support_payload: payload };

function client(wideRows, supportRows) {
  const calls = [];
  return { calls, from(table) {
    assert.ok(['rolling_player_game_metrics', 'rolling_player_metric_support_payloads'].includes(table));
    calls.push({ table, method: 'from' });
    let fields;
    const query = { select(clause, options) {
      assert.equal(options.count, 'exact'); fields = clause.split(',');
      calls.push({ table, method: 'select', clause }); return query;
    }, async range(start, end) {
      const rows = table === 'rolling_player_game_metrics' ? wideRows : supportRows;
      calls.push({ table, method: 'range', start, end });
      return { count: rows.length, error: null,
        data: rows.slice(start, end + 1).map(r => Object.fromEntries(fields.filter(f => f in r).map(f => [f, r[f]]))) };
    } };
    for (const name of ['in', 'eq', 'lt', 'gt', 'order']) query[name] = (...args) => {
      calls.push({ table, method: name, args }); return query;
    };
    return query;
  } };
}

(async () => {
  const checks = [];
  const fixtureBefore = JSON.stringify({ base, sidecar });
  const db = client([base], [sidecar]);
  const [restored] = await fetchRollingRows([7], 'ev', '2026-10-08', db);
  assert.equal(restored.shots_total_all, 11);
  assert.equal(restored.toi_seconds_total_last5, 6000);
  assert.equal(restored.sog_per_60_all, 16.5);
  checks.push('actual reader restores selected scalar fields from matching sidecar');
  for (const field of omittedPairFields) {
    assert.equal(selected.has(field), false);
    assert.equal(Object.prototype.hasOwnProperty.call(restored, field), false);
  }
  checks.push('actual reader does not restore unselected paired-SOG or cumulative-TOI fields, even when payload contains them');
  assert.equal(JSON.stringify({ base, sidecar }), fixtureBefore);
  checks.push('reader leaves injected wide and support inputs unchanged');

  const identityFailures = [];
  for (const changed of [{ game_id: 2026020099 }, { game_date: '2026-10-05' },
    { season: 20252026 }, { strength_state: 'pp' }, { player_id: 99 }, { payload_schema_version: 2 }]) {
    try { await fetchRollingRows([7], 'ev', '2026-10-08', client([base], [{ ...sidecar, ...changed }])); }
    catch (error) { assert.equal(error.reason, 'invalid_support_row'); identityFailures.push({ changed, reason: error.reason }); continue; }
    throw new Error(`Reader wrongly admitted substituted identity: ${JSON.stringify(changed)}`);
  }
  checks.push('actual reader rejects substituted game, date, season, strength, player or schema identity');
  await assert.rejects(fetchRollingRows([7], 'ev', '2026-10-08', client([{ ...base, shots_total_all: 5 }], [sidecar])),
    e => e.reason === 'invalid_support_row');
  checks.push('actual reader rejects wide-versus-sidecar numeric conflict');
  const [withoutSupport] = await fetchRollingRows([7], 'ev', '2026-10-08', client([base], []));
  assert.equal(withoutSupport.shots_total_all, null);
  checks.push('missing sidecar leaves selected count unknown rather than inventing zero');

  const carried = { sog_per_60_shots_last5: null, sog_per_60_toi_seconds_last5: null };
  const mergeMissingSchema = mergeRollingSupportPayloadFields({}, payload);
  const mergePresentSchema = mergeRollingSupportPayloadFields(carried, payload);
  assert.deepEqual(mergeMissingSchema, {});
  assert.deepEqual(mergePresentSchema, { sog_per_60_shots_last5: 1, sog_per_60_toi_seconds_last5: 1200 });
  checks.push('actual generic merge only fills fields the consumer row already carries');
  assert.deepEqual(guard.blockedNetwork, []);
  assert.equal(guard.blockedClientCreates, 0);
  assert.equal(guard.blockedEnvLoads, 0);
  checks.push('no network, dotenv or provider-client creation attempt');

  const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const modules = Object.keys(require.cache).filter(p => p.startsWith(path.join(repo, 'web/lib') + path.sep)).sort();
  const output = { runtime: process.version, checks, checkCount: checks.length,
    fixturesAreHandAuthoredPostCompactionShapes: true, compactorExecuted: false,
    blocker: 'Actual splitRollingUpsertRowForDurableStorage is exported only from fetchRollingPlayerAverages.ts, which imports dotenv, calls dotenv.config at module evaluation and requires/initializes a provider client. The guard was not bypassed and that module was not imported.',
    selectedFields: [...selected], omittedPairFields, restored, withoutSupport,
    identityFailures, readerCalls: db.calls, guard,
    genericMerge: { missingConsumerSchema: mergeMissingSchema, presentConsumerSchema: mergePresentSchema },
    sourceSha256: Object.fromEntries(modules.map(p => [path.relative(repo, p), sha(p)])),
    compactorSourceInspectedOnlySha256: sha(path.join(repo, 'web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts')),
    harnessSha256: sha(__filename) };
  const outPath = path.join(__dirname, 'exposure-reader-results.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`PASS: ${checks.length} actual-reader assertions; six substituted identities rejected.`);
  console.log('Selected fields restored: shots_total_all=11; toi_seconds_total_last5=6000; sog_per_60_all=16.5');
  console.log(`Unavailable despite payload: ${omittedPairFields.join(', ')}`);
  console.log('Full writer/compaction round trip: NOT EXECUTED; pure export blocked by import-time env/client setup.');
  console.log(outPath);
})().catch(error => { console.error(error); process.exitCode = 1; });
