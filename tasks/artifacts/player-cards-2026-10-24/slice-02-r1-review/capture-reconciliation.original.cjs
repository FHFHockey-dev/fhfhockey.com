const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../../..');
const web = path.join(root, 'web');
const fromWeb = createRequire(path.join(web, 'package.json'));
let networkAttempts = 0;
const deny = () => { networkAttempts++; throw new Error('No network in capture reconciliation'); };
global.fetch = deny;
for (const protocol of ['node:http', 'node:https']) { const module = require(protocol); module.get = deny; module.request = deny; }
require('node:net').Socket.prototype.connect = deny;
fromWeb('ts-node').register({ project: path.join(web, 'tsconfig.json'), transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } });
const { pooledMetric } = require(path.join(web, 'lib/player-cards/aggregation.ts'));
const { METRICS } = require(path.join(web, 'lib/player-cards/registry.ts'));
const { selectWindow } = require(path.join(web, 'lib/player-cards/windows.ts'));
const sourcePath = 'tasks/artifacts/wigo-player-card-investigation-2026-10-24/production-diagnostic/query-2-rows.json';
const bytes = fs.readFileSync(path.join(root, sourcePath));
const sourceSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sourceSha256, '52ea73b19894b2d379e77230f7a7d14089548774b6f5c1411299a4f55cc7d201');
const raw = JSON.parse(bytes);
const nhl = raw.filter(row => row.source === 'nhl_log' && row.payload.season_id === 20262027).map(row => row.payload);
nhl.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
const selected = nhl.slice(0, 5);
assert.equal(selected.length, 5);
const lookup = (source, game) => raw.filter(row => row.source === source && row.payload.season === game.season_id && row.payload.date_scraped === game.date).map(row => row.payload);
const records = selected.map(game => {
  const individual = lookup('nst_individual_log', game), onIce = lookup('nst_on_ice_log', game);
  assert.equal(individual.length, 1); assert.equal(onIce.length, 1);
  return { toiUnit: 'seconds', individual: individual[0], onIce: onIce[0] };
});
// Independent raw reductions are compared to actual application arithmetic.
const totals = records.reduce((sum, r) => ({ toi: sum.toi + r.individual.toi, shots: sum.shots + r.individual.shots, ixg: sum.ixg + r.individual.ixg, icf: sum.icf + r.individual.icf }), { toi: 0, shots: 0, ixg: 0, icf: 0 });
assert.equal(totals.toi, 6313); assert.equal(totals.shots, 21); assert.ok(Math.abs(totals.ixg - 1.82) < 1e-12); assert.equal(totals.icf, 35);
const expected = { atoi: totals.toi / selected.length / 60, sog60: totals.shots / totals.toi * 3600, ixg60: totals.ixg / totals.toi * 3600, icf60: totals.icf / totals.toi * 3600 };
const values = {};
for (const [id, value] of Object.entries(expected)) {
  const actual = pooledMetric(METRICS.find(m => m.id === id), records, selected.length);
  assert.equal(actual.state, 'valid'); assert.ok(Math.abs(actual.value - value) < 1e-12);
  values[id] = { expected: value, actual: actual.value, passed: true };
}
const settings = { season: 20262027, gameType: 'regular', strength: 'all', cutoff: '2026-10-24T00:00:00Z', period: { mode: 'appearances', count: 5 }, seasonPolicy: 'season-only-proposed', shortSamplePolicy: 'allow-known-short-proposed', rankPolicy: 'competition-midrank-proposed' };
const appearanceFrame = { playerId: nhl[0].player_id || 8476453, season: 20262027, gameType: 'regular', dateBasis: 'UTC', completeHistory: false, historyThrough: settings.cutoff, historyReference: 'Review negative control; not evidence of completeness', appearances: [] };
appearanceFrame.appearances = nhl.map(row => ({ playerId: appearanceFrame.playerId, gameId: row.game_id, season: row.season_id, gameType: 'regular', date: row.date, played: row.games_played === 1, completion: { status: 'unverified' } }));
const missingHistory = selectWindow(appearanceFrame, settings);
assert.equal(missingHistory.state, 'missing'); assert.match(missingHistory.reason, /history/);
const missingFinalProof = selectWindow({ ...appearanceFrame, completeHistory: true }, settings);
assert.equal(missingFinalProof.state, 'missing'); assert.match(missingFinalProof.reason, /Completed-game evidence/);
const l10Gaps = nhl.slice(0, 10).filter(game => lookup('nst_individual_log', game).length !== 1 || lookup('nst_on_ice_log', game).length !== 1).map(game => game.date);
assert.deepEqual(l10Gaps, ['2026-10-05']);
const result = { at: new Date().toISOString(), source: sourcePath, sourceSha256, passed: true, rawTotals: totals, gpForArithmeticOnly: 5, values, unavailableControls: { missingHistory: { state: missingHistory.state, reason: missingHistory.reason }, missingFinalProof: { state: missingFinalProof.state, reason: missingFinalProof.reason } }, currentSeasonNhlRowsInBoundedCapture: nhl.length, l10Gaps, networkAttempts, limits: ['Prior captured one-player rows only; no new provider/DB requests', 'Date-based raw matching verifies four arithmetic claims, not inspected official game/strength/provider semantics', 'No complete season-history or per-game final-proof established; ten rows cannot prove an honestly short L20', 'No full-league population/rights/readiness proof; no live cards enabled'] };
fs.writeFileSync(path.join(__dirname, 'capture-reconciliation-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
