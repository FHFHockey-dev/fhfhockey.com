'use strict';
// Run with Node 22.11.0, offline guard and the EXISTING ts-node transpile-only
// loader. No copied app function bodies, module rewrites, or repository writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(process.argv[2] || '/workspace/shared/fhfhockey.com');
const web = path.join(repo, 'web');
assert.equal(process.version, 'v22.11.0');
const guard = globalThis.__FHFH_OFFLINE_GUARD;
assert.ok(guard, 'Offline preload is required');
assert.throws(() => require('node:net').connect(443, 'example.invalid'), /offline guard/);
assert.deepEqual(guard.blockedNetwork, ['socket.connect']);
guard.blockedNetwork.length = 0; // The deliberate guard self-test is not app activity.

const aggregation = require(path.join(web, 'lib/supabase/Upserts/rollingMetricAggregation.ts'));
const math = require(path.join(web, 'lib/supabase/Upserts/rollingPlayerMetricMath.ts'));
const adjustments = require(path.join(web, 'lib/projections/calculators/skater-adjustments.ts'));
const bootstrap = require(path.join(web, 'lib/projections/seasonBootstrap.ts'));
const historical = require(path.join(web, 'lib/supabase/Upserts/rollingHistoricalAverages.ts'));
const checks = [];
function check(name, fn) { fn(); checks.push(name); }
function close(a, b, tolerance = 1e-10) { assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`); }
const rateSpec = { scale: 3600, noPrimaryDenominatorBehavior: 'null' };

function aggregate(rows) {
  const acc = aggregation.createRatioRollingAccumulator();
  const components = [];
  for (const row of rows) {
    const pair = math.resolvePer60Components({ rawValue: row.shots,
      toiSeconds: row.seconds, per60Rate: row.per60 ?? null });
    components.push(pair);
    aggregation.updateRatioRollingAccumulator(acc, pair, {
      windowFamily: 'weighted_rate_performance',
      anchor: typeof row.seconds === 'number' && row.seconds > 0,
    });
  }
  return { resolvedComponents: components,
    rates: aggregation.getRatioRollingSnapshot(acc, rateSpec),
    pairs: aggregation.getRatioRollingComponentSnapshot(acc),
    // Fixture-derived comparison, NOT execution of writer's private simple accumulator.
    modeledGenericLast5Seconds: rows.filter(r => r.seconds != null).slice(-5)
      .reduce((s, r) => s + r.seconds, 0) };
}

const missingRows = [{ seconds: 1200, shots: 10 }, { seconds: 1200, shots: 1 },
  ...Array.from({ length: 4 }, () => ({ seconds: 1200, shots: null }))];
const missing = aggregate(missingRows);
check('actual ratio window retains missing slots, no older-known-rate backfill', () => {
  close(missing.rates.windows[5], 3);
  assert.equal(missing.pairs.windows[5].numerator, 1);
  assert.equal(missing.pairs.windows[5].denominator, 1200);
  assert.equal(missing.pairs.windows[5].count, 1);
  assert.equal(missing.pairs.all.numerator, 11);
  assert.equal(missing.pairs.all.denominator, 2400);
  assert.equal(missing.modeledGenericLast5Seconds, 6000);
});
const zero = aggregate(Array.from({ length: 5 }, () => ({ seconds: 1200, shots: 0 })));
const unknown = aggregate(Array.from({ length: 5 }, () => ({ seconds: 1200, shots: null })));
check('actual per60 composition distinguishes observed zero from missing count', () => {
  assert.equal(zero.rates.windows[5], 0);
  assert.equal(zero.pairs.windows[5].denominator, 6000);
  assert.equal(zero.pairs.windows[5].count, 5);
  assert.equal(unknown.rates.windows[5], null);
  assert.equal(unknown.pairs.windows[5].denominator, 0);
  assert.equal(unknown.pairs.windows[5].count, 0);
});
const reconstructed = aggregate(Array.from({ length: 5 }, () => ({ seconds: 1200, shots: null, per60: 3 })));
check('actual supplied-rate fallback reconstructs numerator despite absent raw count', () => {
  assert.equal(reconstructed.pairs.windows[5].numerator, 5);
  assert.equal(reconstructed.pairs.windows[5].denominator, 6000);
  assert.equal(reconstructed.rates.windows[5], 3);
});
const invalidDirectAcc = aggregation.createRatioRollingAccumulator();
aggregation.updateRatioRollingAccumulator(invalidDirectAcc,
  { numerator: null, denominator: 1200 }, { windowFamily: 'weighted_rate_performance', anchor: true });
const directNull = aggregation.getRatioRollingComponentSnapshot(invalidDirectAcc);
check('normalizer alone coerces null numerator, but actual per60 resolver prevents that input', () => {
  assert.equal(directNull.all.numerator, 0);
  assert.equal(directNull.all.denominator, 1200);
  assert.equal(math.resolvePer60Components({ rawValue: null, toiSeconds: 1200 }), null);
});

const crossStrength = [1, 80, 800].map(n => {
  const current = adjustments.computeSkaterSampleShrinkageAdjustments({
    evToiSecondsAll: 1200, ppToiSecondsAll: 300, evShotsAll: 2 * n, ppShotsAll: 1 });
  const cumulative = adjustments.computeSkaterSampleShrinkageAdjustments({
    evToiSecondsAll: 1200 * n, ppToiSecondsAll: 300, evShotsAll: 2 * n, ppShotsAll: 1 });
  return { evGames: n, fixedPP: { seconds: 300, shots: 1 }, current, cumulative };
});
check('actual sample helper pools EV and PP support into one changing weight', () => {
  assert.equal(crossStrength[0].current.sampleWeight, 0.3887);
  assert.equal(crossStrength[2].current.sampleWeight, 0.7710);
  assert.equal(crossStrength[2].cumulative.sampleWeight, 0.9880);
  assert.ok(crossStrength[2].cumulative.sampleWeight > crossStrength[0].cumulative.sampleWeight);
});
const zeroWeight = adjustments.computeSkaterSampleShrinkageAdjustments({
  evToiSecondsAll: 1200, ppToiSecondsAll: null, evShotsAll: 0, ppShotsAll: null });
const missingWeight = adjustments.computeSkaterSampleShrinkageAdjustments({
  evToiSecondsAll: 1200, ppToiSecondsAll: null, evShotsAll: null, ppShotsAll: null });
check('actual sample helper collapses missing shot evidence to zero shot evidence', () => {
  assert.deepEqual(zeroWeight, missingWeight);
});

function prior(n, previous, fantasy = {}) {
  return { previous, fantasy, currentSeasonGames: n, historyGames: 20,
    sourceIds: [], sourceRowIds: [], limitations: ['Synthetic fixture'] };
}
function effectiveWeight(n, previous, key, fantasy = {}) {
  const a = bootstrap.blendSeasonBootstrap({ [key]: 10 }, prior(n, previous, fantasy));
  const b = bootstrap.blendSeasonBootstrap({ [key]: 20 }, prior(n, previous, fantasy));
  return { effectiveOrganic: (b.stats[key] - a.stats[key]) / 10,
    withOrganic10: a.stats[key], withOrganic20: b.stats[key], disclosure: a.disclosure };
}
const bootstrapCases = [0, 1, 5, 10, 20].map(n => ({ appearances: n,
  previousAvailable: effectiveWeight(n, { HITS: 2 }, 'HITS'),
  previousMissing: effectiveWeight(n, { HITS: null }, 'HITS'),
  bothPriorsAvailable: effectiveWeight(n, { HITS: 2 }, 'HITS', { HITS: 3 }) }));
check('actual bootstrap renormalizes category weights with absent fantasy source', () => {
  close(bootstrapCases[1].previousAvailable.effectiveOrganic, 0.05 / 0.43);
  close(bootstrapCases[2].previousAvailable.effectiveOrganic, 0.25 / 0.55);
  close(bootstrapCases[3].previousAvailable.effectiveOrganic, 0.5 / 0.7);
  close(bootstrapCases[2].previousAvailable.disclosure.historyWeight, 0.3);
  close(bootstrapCases[2].previousAvailable.disclosure.fantasyWeight, 0.45);
  close(bootstrapCases[2].bothPriorsAvailable.effectiveOrganic, 0.25);
});
check('actual bootstrap missing-category and zero-parts fallbacks return organic input', () => {
  for (const c of bootstrapCases) close(c.previousMissing.effectiveOrganic, 1);
});
const categorySpecific = bootstrap.blendSeasonBootstrap({ HITS: 10, BLOCKED_SHOTS: 10 },
  prior(5, { HITS: 2, BLOCKED_SHOTS: null }));
check('actual same-player bootstrap affects categories differently under missing history', () => {
  close(categorySpecific.stats.HITS, (10 * 0.25 + 2 * 0.3) / 0.55);
  assert.equal(categorySpecific.stats.BLOCKED_SHOTS, 10);
});
// Execute the actual public historical simple accumulator as an additional
// narrow check of independent missingness; do NOT import the live writer.
const simpleCounts = historical.createHistoricalAverageAccumulator();
const simpleToi = historical.createHistoricalAverageAccumulator();
for (const r of missingRows) {
  historical.updateHistoricalAverageAccumulator(simpleCounts, 20262027, r.shots);
  historical.updateHistoricalAverageAccumulator(simpleToi, 20262027, r.seconds);
}
const independentHistorical = {
  counts: historical.getHistoricalAverageSnapshot(simpleCounts, 20262027),
  toi: historical.getHistoricalAverageSnapshot(simpleToi, 20262027),
  countSupport: { sum: simpleCounts.careerSum, observations: simpleCounts.careerCount },
  toiSupport: { sum: simpleToi.careerSum, observations: simpleToi.careerCount },
};
check('actual separate historical simple accumulators have different valid denominators', () => {
  close(independentHistorical.counts.season, 5.5);
  close(independentHistorical.toi.season, 1200);
  assert.equal(independentHistorical.countSupport.observations, 2);
  assert.equal(independentHistorical.toiSupport.observations, 6);
});
const physicalOverlap = adjustments.computeSkaterPhysicalEventRates({ position: 'C', esPpToiSeconds: 1200,
  all: { toi_seconds_total_last5: 1200, hits_per_60_last5: 30,
    hits_per_60_hits_3ya: 10, hits_per_60_toi_seconds_3ya: 6000 } });
check('actual physical HIT helper reproduces the explicit overlapping-window recency blend', () => {
  close(physicalOverlap.hitsRecentWeight, 20 / 140);
  close(physicalOverlap.hitsPer60, 9.114285714285714);
});
check('pure probes attempted no network, dotenv reads or provider client creation', () => {
  assert.deepEqual(guard.blockedNetwork, []);
  assert.equal(guard.blockedClientCreates, 0);
  assert.equal(guard.blockedEnvLoads, 0);
});

const appModules = Object.keys(require.cache).filter(p => p.startsWith(path.join(web, 'lib') + path.sep)).sort();
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const results = { runtime: process.version, checks, checkCount: checks.length,
  actualExportsExecuted: ['resolvePer60Components', 'createRatioRollingAccumulator',
    'updateRatioRollingAccumulator', 'getRatioRollingSnapshot', 'getRatioRollingComponentSnapshot',
    'computeSkaterSampleShrinkageAdjustments', 'blendSeasonBootstrap',
    'computeSkaterPhysicalEventRates',
    'createHistoricalAverageAccumulator', 'updateHistoricalAverageAccumulator', 'getHistoricalAverageSnapshot'],
  stillModeledOrUnexecuted: ['private writer simple rolling update/deriveOutputs and sidecar round trip',
    'skater-stage caller selection and downstream SOG/TOI formulas',
    'deployment/role/availability/PP allocation/team reconciliation',
    'loadSeasonBootstrap source query and actual historical source availability',
    'Gamma-Poisson references and predicted-MSE worlds from prior Python experiment'],
  fixtures: { missing, zero, unknown, reconstructed, directNull, crossStrength,
    zeroWeight, missingWeight, bootstrapCases, categorySpecific, independentHistorical, physicalOverlap },
  guards: { deliberateNetworkSelfTestBlocked: true, appAttempts: guard },
  appSourceSha256: Object.fromEntries(appModules.map(p => [path.relative(repo, p), sha(p)])),
  harnessSha256: sha(__filename), guardSha256: sha(path.join(__dirname, 'exposure_offline_guard.cjs')),
  caveat: 'Exports are executed unchanged from the repository. Existing ts-node transpiles in memory. Provider client creation is guarded to throw; none was attempted. No rewritten/extracted substitutes for app functions or app patches.' };
const output = path.join(__dirname, 'exposure-actual-results.json');
fs.writeFileSync(output, JSON.stringify(results, null, 2) + '\n');
console.log(`PASS: ${checks.length} app-executed checks; ${appModules.length} bounded app modules loaded; ${output}`);
console.log('Paired recent5:', JSON.stringify(missing.pairs.windows[5]));
console.log('Cross-strength actual weights:', JSON.stringify(crossStrength.map(x => ({ n: x.evGames,
  current: x.current.sampleWeight, cumulative: x.cumulative.sampleWeight }))));
console.log('Effective bootstrap:', JSON.stringify(bootstrapCases.map(x => ({ n: x.appearances,
  previous: x.previousAvailable.effectiveOrganic, missing: x.previousMissing.effectiveOrganic }))));
