// Independent finite probes against original modules, never copies of application logic.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../../..');
const web = path.join(root, 'web');
const fromWeb = createRequire(path.join(web, 'package.json'));
let networkAttempts = 0;
const denyNetwork = () => { networkAttempts++; throw new Error('Network prohibited in offline review'); };
global.fetch = denyNetwork;
for (const protocol of ['node:http', 'node:https']) {
  const module = require(protocol); module.request = denyNetwork; module.get = denyNetwork;
}
require('node:net').connect = denyNetwork;
require('node:net').createConnection = denyNetwork;
require('node:net').Socket.prototype.connect = denyNetwork;
fromWeb('ts-node').register({ project: path.join(web, 'tsconfig.json'), transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } });
const { selectWindow, settingsError } = require(path.join(web, 'lib/player-cards/windows.ts'));
const { pooledMetric, aggregateWindow } = require(path.join(web, 'lib/player-cards/aggregation.ts'));
const { adaptLocalSnapshot } = require(path.join(web, 'lib/player-cards/adapter.ts'));
const { METRICS } = require(path.join(web, 'lib/player-cards/registry.ts'));
const settings = { season: 20262027, gameType: 'regular', strength: 'all', cutoff: '2026-10-24T00:00:00Z', period: { mode: 'appearances', count: 5 }, seasonPolicy: 'season-only-proposed', shortSamplePolicy: 'allow-known-short-proposed', rankPolicy: 'competition-midrank-proposed' };
const source = { definition: 'review-model', version: 'review-v1', capturedAt: '2026-10-24T01:00:00Z' };
const metric = id => METRICS.find(m => m.id === id);
function game(day, playerId = 1, gameId = 2026020000 + day) {
  const date = `2026-10-${String(day).padStart(2, '0')}`;
  return { playerId, gameId, season: settings.season, gameType: 'regular', date, played: true, completion: { status: 'verified-final', completedAt: `${date}T23:00:00Z`, reference: 'review-final' } };
}
function frame(games, playerId = games[0]?.playerId || 1) {
  return { playerId, season: settings.season, gameType: 'regular', dateBasis: 'UTC', completeHistory: true, historyThrough: settings.cutoff, historyReference: 'review-history', appearances: games };
}
function counts() {
  return { toiUnit: 'seconds', individual: { toi: 600, shots: 2, icf: 4, iscfs: 2, ixg: 0.25, total_points: 1, goals: 1 }, onIce: { toi: 600, cf: 10, scf: 5, xgf: 0.5, xga: 1.5, gf: 2, sf: 8 } };
}
function record(g) {
  return { ...counts(), playerId: g.playerId, gameId: g.gameId, season: g.season, date: g.date, strength: 'all', sourceDefinition: source.definition, sourceVersion: source.version, capturedAt: source.capturedAt, state: 'ready' };
}
function input(playerGames = [[game(20, 1)], [game(20, 2)]]) {
  return { id: 'independent-review', origin: 'synthetic', capturedAt: source.capturedAt, settings: structuredClone(settings), source: { definition: source.definition, version: source.version, definitionReference: 'review-definition', verifiedMetrics: METRICS.map(m => m.id) }, population: { scope: 'synthetic-all-values', complete: true, reference: 'review-membership', expectedPlayerIds: playerGames.map(games => games[0].playerId) }, players: playerGames.map(games => ({ frame: frame(games), records: games.map(record) })) };
}
function card(data, playerId = 1) { const result = adaptLocalSnapshot(data, playerId); assert.notEqual(result.state, 'rejected'); return result; }
const results = [];
let observation;
function observed(value) { observation = value; return value; }
function probe(id, purpose, fn) {
  observation = undefined;
  try { const actual = fn(); results.push({ id, purpose, passed: true, actual }); }
  catch (error) { results.push({ id, purpose, passed: false, error: error.message, actual: error.actual, expected: error.expected, observation }); }
}
function expectState(actual, expected) { observed(actual); assert.equal(actual.state, expected); return actual; }
probe('W01', 'Cutoff is inclusive by exact final timestamp, including midnight crossover', () => {
  const a = game(23), b = game(22), c = game(21);
  a.completion.completedAt = settings.cutoff;
  b.completion.completedAt = '2026-10-24T00:00:00.001Z';
  const selected = selectWindow(frame([b, c, a]), settings);
  assert.deepEqual(selected.games.map(g => g.gameId), [a.gameId, c.gameId]); return selected.games.map(g => g.gameId);
});
probe('W02', 'Filter other player/season/game type and scratch before own N', () => {
  const wanted = [18, 19, 20, 21, 22].map(day => game(day));
  const other = [{ ...game(23), playerId: 2 }, { ...game(23), season: 20252026 }, { ...game(23), gameType: 'playoffs' }, { ...game(23), played: false, completion: { status: 'unverified' } }];
  const selected = selectWindow(frame([...other, ...wanted], 1), settings);
  assert.equal(selected.state, 'ready'); assert.equal(selected.actualGp, 5); assert.equal(selected.firstDate, '2026-10-18'); return selected.actualGp;
});
probe('W03', 'Independent 5/10/20 selection uses descending identities from shuffled input', () => {
  const games = Array.from({ length: 23 }, (_, i) => game(i + 1)).reverse();
  for (const n of [5, 10, 20]) { const selected = selectWindow(frame(games), { ...settings, period: { mode: 'appearances', count: n } }); assert.equal(selected.actualGp, n); assert.equal(selected.firstDate, `2026-10-${String(24 - n).padStart(2, '0')}`); } return [5, 10, 20];
});
probe('W04', 'Calendar lower/upper bounds inclusive, common completion cutoff still applies', () => {
  const selected = selectWindow(frame([19, 20, 21, 22, 23, 24].map(d => game(d))), { ...settings, period: { mode: 'calendar', start: '2026-10-20', end: '2026-10-24', timezone: 'UTC' } });
  assert.deepEqual(selected.games.map(g => g.date), ['2026-10-23', '2026-10-22', '2026-10-21', '2026-10-20']); return selected.actualGp;
});
probe('W05', 'Known short versus incomplete history and strict-full alternative', () => {
  const f = frame([game(20)]); assert.equal(selectWindow(f, settings).knownShort, true);
  expectState(selectWindow({ ...f, completeHistory: false }, settings), 'missing');
  expectState(selectWindow(f, { ...settings, shortSamplePolicy: 'require-full-proposed' }), 'undefined'); return true;
});
probe('W06', 'Invalid official identity/unknown participation/completion do not become known short', () => {
  for (const patch of [{ gameId: 0 }, { played: null }, { completion: { status: 'unverified' } }]) {
    const selected = selectWindow(frame([{ ...game(20), ...patch }]), settings); expectState(selected, 'missing'); assert.equal(selected.knownShort, false);
  } return true;
});
probe('W07', 'Conflicting duplicate game dates are rejected', () => expectState(selectWindow(frame([game(20), { ...game(21), gameId: game(20).gameId }]), settings), 'missing'));
probe('W08', 'Invalid normalized dates, cutoffs, and unsupported policies rejected', () => {
  for (const patch of [{ cutoff: '2026-02-30T00:00:00Z' }, { gameType: 'playoffs' }, { season: 20262028 }, { period: { mode: 'calendar', start: '2026-10-22', end: '2026-10-21', timezone: 'UTC' } }]) assert.ok(settingsError({ ...settings, ...patch })); return true;
});
probe('W09', 'Zero-strength exposure stays in official GP, no older replacement appearance', () => {
  const data = input([[18, 19, 20, 21, 22, 23].map(day => game(day, 1))]); data.settings.strength = 'pp';
  data.players[0].records.forEach(row => { row.strength = 'pp'; row.individual.toi = row.date === '2026-10-23' ? 0 : 60; row.individual.shots = 0; });
  const result = card(data); assert.equal(result.selection.actualGp, 5); assert.equal(result.selection.firstDate, '2026-10-19'); assert.equal(result.readings.find(r => r.id === 'atoi').value, 0.8); return result.selection.actualGp;
});
probe('A01', 'Pooled numerator/exposure not mean game rates; fractional xG survives', () => {
  const a = counts(), b = counts(); a.individual = { ...a.individual, toi: 60, shots: 1, ixg: 0.05 }; b.individual = { ...b.individual, toi: 3540, shots: 9, ixg: 0.55 };
  assert.equal(pooledMetric(metric('sog60'), [a, b], 2).value, 10); assert.ok(Math.abs(pooledMetric(metric('ixg60'), [a, b], 2).value - 0.6) < 1e-14); return true;
});
probe('A02', 'Valid measured zero/zero exposure/missing/nonfinite stay distinct', () => {
  const c = counts(); c.individual.shots = 0; assert.equal(pooledMetric(metric('sog60'), [c], 1).value, 0);
  c.individual.toi = 0; expectState(pooledMetric(metric('sog60'), [c], 1), 'undefined');
  for (const value of [null, undefined, NaN, Infinity, -1]) { c.individual.shots = value; expectState(pooledMetric(metric('sog60'), [c], 1), 'missing'); } return true;
});
probe('A03', 'Missing one selected game never shrinks official sample', () => {
  const games = [game(20), game(21)]; const selection = selectWindow(frame(games), settings); const actual = aggregateWindow(selection, [record(games[0])], source);
  assert.equal(selection.actualGp, 2); expectState(actual.values.sog60, 'missing'); return actual.matchedGames;
});
probe('A04', 'Missing one component affects only dependent metrics', () => {
  const g = game(20), r = record(g); delete r.individual.ixg;
  const result = aggregateWindow(selectWindow(frame([g]), settings), [r], source); expectState(result.values.ixg60, 'missing'); expectState(result.values.sog60, 'valid'); return true;
});
probe('A05', 'Exact identity join rejects same-game wrong date/strength/season/version/timing', () => {
  const g = game(20), r = record(g), selection = selectWindow(frame([g]), settings);
  for (const patch of [{ date: '2026-10-21' }, { strength: 'pp' }, { season: 20252026 }, { sourceVersion: 'other' }, { capturedAt: '2026-10-19T00:00:00Z' }, { capturedAt: '2026-10-25T00:00:00Z' }]) expectState(aggregateWindow(selection, [{ ...r, ...patch }], source).values.sog60, 'missing'); return true;
});
probe('R01', 'Competition raw ranks and midrank percentiles, all same full pool', () => {
  const data = input([1, 2, 3, 4].map(id => [game(20, id)]));
  [5, 3, 3, 1].forEach((shots, i) => { data.players[i].records[0].individual.shots = shots; });
  const ranks = [1, 2, 3, 4].map(id => card(data, id).readings.find(r => r.id === 'sog60').rank);
  assert.deepEqual(ranks.map(r => r.ordinal), [1, 2, 2, 4]); assert.deepEqual(ranks.map(r => r.percentile), [87.5, 50, 50, 12.5]); assert.ok(ranks.every(r => r.population === 4)); return ranks;
});
probe('R02', 'Rank canonical values before display rounding', () => {
  const data = input(); data.players[0].records[0].individual.ixg = 0.1000001; data.players[1].records[0].individual.ixg = 0.1000002;
  const reading = card(data).readings.find(r => r.id === 'ixg60'); assert.equal(reading.rank.ordinal, 2); assert.equal(reading.rank.tied, false); return reading.rank;
});
probe('R03', 'Valid zero and one-second exposure remain in full pool', () => {
  const data = input(); data.players[1].records[0].individual.shots = 0; data.players[1].records[0].individual.toi = 1;
  assert.equal(card(data).readings.find(r => r.id === 'sog60').rank.population, 2); return true;
});
probe('R04', 'Unknown coverage and wrong population membership withhold ranks, preserve values', () => {
  for (const population of [{ complete: false }, { expectedPlayerIds: [1, 3] }, { expectedPlayerIds: [1, 2, 3] }, { expectedPlayerIds: [1, 1] }, { reference: '' }]) {
    const data = input(); Object.assign(data.population, population); const result = card(data); assert.equal(result.readings[0].state, 'valid'); assert.ok(result.readings.every(r => r.rank === null));
  } return true;
});
probe('R05', 'Metric-specific missing peer suppresses only affected ranks', () => {
  const data = input(); data.players[1].records[0].individual.ixg = null; const result = card(data);
  assert.equal(result.readings.find(r => r.id === 'ixg60').rank, null); assert.equal(result.readings.find(r => r.id === 'sog60').rank.population, 2); return result.coverage.ixg60;
});
probe('R06', 'Known valid zero-denominator peer is excluded without inventing zero', () => {
  const data = input(); data.players[1].records[0].individual.shots = 0; data.players[1].records[0].individual.goals = 0;
  const result = card(data); assert.equal(result.coverage.shPct.knownUndefined, 1); assert.equal(result.readings.find(r => r.id === 'shPct').rank.population, 1); return result.coverage.shPct;
});
probe('R07', 'Complete-history failure remains missing and blocks full pool', () => {
  const data = input(); data.players[1].frame.completeHistory = false; const result = card(data); assert.equal(result.readings[0].rank, null); assert.equal(result.coverage.atoi.missingIncomplete, 1); return true;
});
probe('R08', 'All-tie and singleton populations use declared midrank 50', () => {
  assert.equal(card(input()).readings[0].rank.percentile, 50); const only = input([[game(20, 1)]]); const rank = card(only).readings[0].rank; assert.equal(rank.percentile, 50); assert.equal(rank.population, 1); return rank;
});
probe('R09', 'All-zero exposure pool is undefined, not zero-valued rank', () => {
  const data = input(); data.players.forEach(p => p.records.forEach(r => { r.individual.toi = 0; r.individual.shots = 0; })); const result = card(data);
  assert.equal(result.readings.find(r => r.id === 'sog60').rank, null); assert.equal(result.coverage.sog60.valid, 0); assert.equal(result.coverage.sog60.knownUndefined, 2); return result.coverage.sog60;
});
probe('F01a', 'Invalid game positive events with zero exposure must not borrow another game TOI', () => {
  const a = counts(), b = counts(); a.individual.toi = 0; a.individual.shots = 10; b.individual.shots = 0;
  return expectState(pooledMetric(metric('sog60'), [a, b], 2), 'missing');
});
probe('F01b', 'Invalid per-game goals > shots must not be concealed by later valid shots', () => {
  const a = counts(), b = counts(); a.individual.shots = 1; a.individual.goals = 2; b.individual.shots = 9; b.individual.goals = 0;
  return expectState(pooledMetric(metric('shPct'), [a, b], 2), 'missing');
});
probe('F01c', 'Invalid on-ice game goals > shots must not be concealed by another game', () => {
  const a = counts(), b = counts(); a.onIce.sf = 1; a.onIce.gf = 2; b.onIce.sf = 9; b.onIce.gf = 0;
  return expectState(pooledMetric(metric('oiShPct'), [a, b], 2), 'missing');
});
probe('F02a', 'Positive goals / zero shots is inconsistent source, not known undefined', () => {
  const a = counts(); a.individual.goals = 1; a.individual.shots = 0;
  return expectState(pooledMetric(metric('shPct'), [a], 1), 'missing');
});
probe('F02b', 'An inconsistent peer must not leave full coverage and rank enabled', () => {
  const data = input(); data.players[1].records[0].individual.shots = 0; data.players[1].records[0].individual.goals = 1;
  const result = card(data); const reading = result.readings.find(r => r.id === 'shPct');
  observed({ reading, coverage: result.coverage.shPct });
  assert.equal(reading.rank, null); assert.equal(result.coverage.shPct.missingIncomplete, 1); return { reading, coverage: result.coverage.shPct };
});
probe('F01d', 'Invalid exposure peer must not change valid player raw rank', () => {
  const data = input([[game(20, 1)], [game(20, 2), game(21, 2)]]);
  data.players[0].records[0].individual.shots = 1;
  const [a, b] = data.players[1].records; a.individual.toi = 0; a.individual.shots = 10; b.individual.shots = 0;
  const result = card(data); const reading = result.readings.find(r => r.id === 'sog60'); observed({ reading, coverage: result.coverage.sog60 }); assert.equal(reading.rank, null); return reading;
});
const summary = { at: new Date().toISOString(), node: process.version, total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, networkAttempts, results, claim: 'Synthetic finite counterexamples against actual frozen source only, no live data or coverage proof' };
fs.writeFileSync(path.join(__dirname, 'counterexamples-results.json'), JSON.stringify(summary, null, 2) + '\n');
for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.id}: ${r.purpose}${r.passed ? '' : ` (${r.error.split('\n')[0]})`}`);
console.log(JSON.stringify({ total: summary.total, passed: summary.passed, failed: summary.failed, networkAttempts }));
process.exitCode = summary.failed ? 1 : 0;
