'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2] || '/workspace/shared/fhfhockey.com');
const web = path.join(root, 'web');
assert.equal(process.version, 'v22.11.0');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, 'https://fhfh-synthetic.invalid');
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, 'synthetic-inert-key-not-a-secret');
const mocks = globalThis.__FHFH_WRITER_MOCK, guard = globalThis.__FHFH_OFFLINE_GUARD;
assert.ok(mocks && guard);
const writer = require(path.join(web, 'lib/supabase/Upserts/fetchRollingPlayerAverages.ts'));
const { deriveOutputs, initAccumulator } = writer.__testables;
const agg = require(path.join(web, 'lib/supabase/Upserts/rollingMetricAggregation.ts'));
const hist = require(path.join(web, 'lib/supabase/Upserts/rollingHistoricalAverages.ts'));
const math = require(path.join(web, 'lib/supabase/Upserts/rollingPlayerMetricMath.ts'));
const reader = require(path.join(web, 'lib/projections/queries/skater-queries.ts'));
const season = 20262027;

function seedSimple(values) {
  // The writer's private updateAccumulator is not exported. Seed its existing
  // public initAccumulator shape; do not claim execution of the private update.
  const acc = initAccumulator();
  const valid = values.filter(v => v !== null);
  acc.sumAll = valid.reduce((a, b) => a + b, 0); acc.countAll = valid.length;
  for (const size of [3, 5, 10, 20]) {
    const selected = valid.slice(-size);
    Object.assign(acc.windows[size], { values: selected, sum: selected.reduce((a, b) => a + b, 0), count: selected.length });
  }
  return acc;
}
function produce(reconstructed) {
  // Observed event is LAST so all emitted last-N rate aliases are equal too.
  const rows = [...Array.from({ length: 4 }, () => ({ seconds: 1200, raw: null, per60: reconstructed ? 3 : null })),
    { seconds: 1200, raw: 1, per60: null }];
  const ratio = agg.createRatioRollingAccumulator();
  const ratioHistory = agg.createHistoricalRatioAccumulator();
  const shotsHistory = hist.createHistoricalAverageAccumulator();
  const toiHistory = hist.createHistoricalAverageAccumulator();
  for (const r of rows) {
    const pair = math.resolvePer60Components({ rawValue: r.raw, toiSeconds: r.seconds, per60Rate: r.per60 });
    agg.updateRatioRollingAccumulator(ratio, pair, { windowFamily: 'weighted_rate_performance', anchor: true });
    agg.updateHistoricalRatioAccumulator(ratioHistory, season, pair);
    hist.updateHistoricalAverageAccumulator(shotsHistory, season, r.raw);
    hist.updateHistoricalAverageAccumulator(toiHistory, season, r.seconds);
  }
  const gp = hist.createHistoricalGpPctAccumulator();
  const output = deriveOutputs(
    { shots: seedSimple(rows.map(r => r.raw)), toi_seconds: seedSimple(rows.map(r => r.seconds)) },
    { sog_per_60: ratio }, {}, { shots: shotsHistory, toi_seconds: toiHistory }, {},
    { sog_per_60: ratioHistory }, hist.getHistoricalGpPctSnapshot(gp, season),
    hist.getRollingGpPctSnapshot(gp, { currentSeason: season, currentTeamId: 4, currentTeamGamesPlayed: 5 }),
    season, 'ev');
  const row = { player_id: 7, game_id: 2026020006, game_date: '2026-10-06', season,
    team_id: 4, strength_state: 'ev', ...output };
  const compacted = writer.splitRollingUpsertRowForDurableStorage(row);
  return { rows, paired: agg.getRatioRollingComponentSnapshot(ratio), output, compacted };
}
function fakeDb(rankingRows, supportRows) {
  const calls = [];
  return { calls, from(table) {
    assert.ok(['rolling_player_game_metrics', 'rolling_player_metric_support_payloads'].includes(table));
    let fields; calls.push({ table, method: 'from' });
    const q = { select(clause, options) { assert.equal(options.count, 'exact'); fields = clause.split(',');
      calls.push({ table, method: 'select', clause }); return q; },
    async range(start, end) { const rows = table === 'rolling_player_game_metrics' ? rankingRows : supportRows;
      return { error: null, count: rows.length, data: rows.slice(start, end + 1)
        .map(r => Object.fromEntries(fields.filter(k => k in r).map(k => [k, r[k]]))) }; } };
    for (const name of ['in', 'eq', 'lt', 'gt', 'order']) q[name] = () => q;
    return q;
  } };
}
(async () => {
  const A = produce(false), B = produce(true), checks = [];
  assert.equal(A.paired.windows[5].numerator, 1); assert.equal(A.paired.windows[5].denominator, 1200);
  assert.equal(B.paired.windows[5].numerator, 5); assert.equal(B.paired.windows[5].denominator, 6000);
  checks.push('actual matched ratio snapshots differ before writer emission');
  assert.deepEqual(A.output, B.output);
  checks.push('actual deriveOutputs returns equal objects for these controlled minimal states despite different paired support');
  assert.equal(A.output.sog_per_60_last5, 3);
  assert.equal(A.output.sog_per_60_shots_season, 1);
  assert.equal(A.output.sog_per_60_toi_seconds_season, 6000);
  for (const field of ['sog_per_60_shots_last5', 'sog_per_60_toi_seconds_last5', 'sog_per_60_shots_all', 'sog_per_60_toi_seconds_all']) {
    assert.equal(Object.prototype.hasOwnProperty.call(A.output, field), false);
  }
  checks.push('actual writer emits independent historical totals but no paired SOG all/last5 fields');
  assert.ok(A.compacted.supportRow);
  assert.deepEqual(A.compacted, B.compacted);
  const expectedIdentity = { player_id: 7, game_id: 2026020006, game_date: '2026-10-06', season, strength_state: 'ev' };
  for (const [key, value] of Object.entries(expectedIdentity)) {
    assert.equal(A.compacted.rankingRow[key], value); assert.equal(A.compacted.supportRow[key], value);
  }
  checks.push('actual compactor preserves snapshot identity and cannot recreate discarded pairs');
  const db = fakeDb([A.compacted.rankingRow], [A.compacted.supportRow]);
  const [restored] = await reader.fetchRollingRows([7], 'ev', '2026-10-08', db);
  for (const [key, value] of Object.entries(expectedIdentity)) assert.equal(restored[key], value);
  assert.equal(restored.sog_per_60_last5, 3); assert.equal(restored.shots_total_all, 1);
  assert.equal(restored.toi_seconds_total_last5, 6000);
  assert.equal(Object.prototype.hasOwnProperty.call(restored, 'sog_per_60_toi_seconds_last5'), false);
  checks.push('actual injected reader restores emitted selected data and identity, not missing paired support');
  assert.equal(mocks.configCalls.length, 3);
  assert.equal(mocks.inertFactoryCalls.length, 1);
  assert.deepEqual(mocks.inertClientOperationAttempts, []);
  assert.deepEqual(mocks.envFileReadAttempts, []);
  assert.deepEqual(guard.blockedNetwork, []);
  assert.equal(guard.blockedClientCreates, 0); assert.equal(guard.blockedEnvLoads, 0);
  const realServiceModules = Object.keys(require.cache).filter(p => /node_modules\/(dotenv|@supabase\/supabase-js)\//.test(p));
  assert.deepEqual(realServiceModules, []);
  checks.push('only recording mocks ran: no real dotenv/client modules, env-file reads, client operations or network attempts');
  const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const modules = Object.keys(require.cache).filter(p => p.startsWith(path.join(web, 'lib') + path.sep)).sort();
  const result = { runtime: process.version, checks, checkCount: checks.length, mocks, networkGuard: guard,
    realServiceModules, A, B, restored, readerCalls: db.calls,
    actualExportsExecuted: ['deriveOutputs', 'splitRollingUpsertRowForDurableStorage', 'fetchRollingRows',
      'initAccumulator', 'resolvePer60Components', 'ratio and historical accumulator exports'],
    notExecuted: ['private simple updateAccumulator (states seeded)', 'METRICS source extraction loop',
      'processPlayer', 'actual database persistence', 'historical inputs', 'full projection stage'],
    equalityScope: 'Only deriveOutputs output and compactor result under these explicitly seeded minimal states. Not a claim about real full writer runs or all diagnostics.',
    sourceSha256: Object.fromEntries(modules.map(p => [path.relative(root, p), sha(p)])),
    harnessSha256: sha(__filename), mockGuardSha256: sha(path.join(__dirname, 'exposure_writer_mock_guard.cjs')) };
  const out = path.join(__dirname, 'exposure-writer-roundtrip-results.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(`PASS: ${checks.length} writer-emission/compactor/reader grouped checks.`);
  console.log('Actual pre-emission paired support: A=1/1200; B=5/6000. Actual emitted minimal-state outputs and compacted rows equal.');
  console.log('Actual reader retained identity, SOG rate3, raw count1 and generic TOI6000; paired SOG exposure absent.');
  console.log(`Mock config calls=${mocks.configCalls.length}, inert factory calls=${mocks.inertFactoryCalls.length}; real modules/env-file/client/network activity=0.`);
  console.log(out);
})().catch(error => { console.error(error); process.exitCode = 1; });
