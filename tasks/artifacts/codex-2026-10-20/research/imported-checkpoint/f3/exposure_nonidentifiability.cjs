'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
assert.equal(process.version, 'v22.11.0');
const root = path.resolve(process.argv[2] || '/workspace/shared/fhfhockey.com');
const files = ['web/lib/supabase/Upserts/rollingPlayerMetricMath.ts',
  'web/lib/supabase/Upserts/rollingMetricAggregation.ts',
  'web/lib/supabase/Upserts/rollingHistoricalAverages.ts'];
const math = require(path.join(root, files[0]));
const agg = require(path.join(root, files[1]));
const hist = require(path.join(root, files[2]));
function calculate(reconstruct) {
  const rows = [{ seconds: 1200, raw: 1, per60: null },
    ...Array.from({ length: 4 }, () => ({ seconds: 1200, raw: null, per60: reconstruct ? 3 : null }))];
  const acc = agg.createRatioRollingAccumulator();
  const counts = hist.createHistoricalAverageAccumulator();
  const times = hist.createHistoricalAverageAccumulator();
  for (const row of rows) {
    const pair = math.resolvePer60Components({ rawValue: row.raw, toiSeconds: row.seconds, per60Rate: row.per60 });
    agg.updateRatioRollingAccumulator(acc, pair, { windowFamily: 'weighted_rate_performance', anchor: true });
    hist.updateHistoricalAverageAccumulator(counts, 20262027, row.raw);
    hist.updateHistoricalAverageAccumulator(times, 20262027, row.seconds);
  }
  return { rows, checkedEqualSummary: {
    recentFiveRatePer60: agg.getRatioRollingSnapshot(acc, { scale: 3600 }).windows[5],
    rawKnownCountSum: counts.careerSum, genericToiSecondsSum: times.careerSum,
    selectedPositiveToiAppearances: rows.length },
    pairedRecent: agg.getRatioRollingComponentSnapshot(acc).windows[5],
    rawKnownCountObservations: counts.careerCount, toiObservations: times.careerCount };
}
const A = calculate(false), B = calculate(true);
assert.deepEqual(A.checkedEqualSummary, B.checkedEqualSummary);
assert.deepEqual(A.checkedEqualSummary, { recentFiveRatePer60: 3,
  rawKnownCountSum: 1, genericToiSecondsSum: 6000, selectedPositiveToiAppearances: 5 });
assert.equal(A.pairedRecent.numerator, 1); assert.equal(A.pairedRecent.denominator, 1200);
assert.equal(A.pairedRecent.count, 1);
assert.equal(B.pairedRecent.numerator, 5); assert.equal(B.pairedRecent.denominator, 6000);
assert.equal(B.pairedRecent.count, 5);
const guard = globalThis.__FHFH_OFFLINE_GUARD;
assert.ok(guard); assert.deepEqual(guard.blockedNetwork, []);
assert.equal(guard.blockedClientCreates, 0); assert.equal(guard.blockedEnvLoads, 0);
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const result = { runtime: process.version, pass: true, A, B, guard,
  equalityClaimLimitedTo: Object.keys(A.checkedEqualSummary),
  notExecuted: ['deriveOutputs', 'compaction', 'sidecar persistence', 'whole-writer-row comparison'],
  sourceSha256: Object.fromEntries(files.map(f => [f, sha(path.join(root, f))])),
  harnessSha256: sha(__filename) };
fs.writeFileSync(path.join(__dirname, 'exposure-nonidentifiability-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log('PASS: actual resolver/aggregator gives equal checked rate/raw-sum/generic-TOI/selected-appearance summaries, unequal paired support.');
console.log(JSON.stringify({ equal: A.checkedEqualSummary, A: A.pairedRecent, B: B.pairedRecent }));
console.log('No claim of whole-writer-row equality; writer/compactor were not imported.');
