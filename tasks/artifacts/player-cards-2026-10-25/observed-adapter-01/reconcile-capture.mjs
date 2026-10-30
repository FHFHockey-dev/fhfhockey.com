import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const own = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(own, '../../../..');
const require = createRequire(path.join(repo, 'web/package.json'));
const { buildSync } = require('esbuild');
globalThis.fetch = async () => { throw new Error('Offline capture reconciliation; network prohibited'); };
const code = buildSync({ stdin: { contents: 'export { mapNstCapture } from "./web/lib/player-cards/nstCapture"; export { adaptLocalSnapshot } from "./web/lib/player-cards/adapter";', resolveDir: repo }, bundle: true, platform: 'node', format: 'esm', write: false }).outputFiles[0].text;
const { mapNstCapture, adaptLocalSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const diagnostic = path.join(repo, 'tasks/artifacts/wigo-player-card-investigation-2026-10-24/production-diagnostic');
const bytes = readFileSync(path.join(diagnostic, 'query-2-rows.json'));
const sha = createHash('sha256').update(bytes).digest('hex');
if (sha !== '52ea73b19894b2d379e77230f7a7d14089548774b6f5c1411299a4f55cc7d201') throw new Error('Approved capture changed');
const data = JSON.parse(bytes), rows = source => data.filter(row => row.source === source).map(row => row.payload);
const nhl = rows('nhl_log');
const settings = { season: 20262027, gameType: 'regular', strength: 'all', cutoff: '2026-10-24T00:00:00Z', period: { mode: 'appearances', count: 5 }, seasonPolicy: 'season-only-proposed', shortSamplePolicy: 'allow-known-short-proposed', rankPolicy: 'competition-midrank-proposed' };
const capturedAt = '2026-10-24T16:26:03.736Z';
const batch = { toiUnit: 'seconds', capturedAt, reference: `query-2-rows.json sha256:${sha}`, readStatus: 'ok', identity: { mode: 'single-player-query', playerId: 8476453, reference: 'production-diagnostic/query-2.sql: exact WHERE player_id = 8476453 in all three branches' } };
const capture = {
  id: `historical-nst-mapping-${sha}`, capturedAt, settings,
  source: { definition: 'NST stored count contract; provider model/event-universe not yet verified', version: `captured-bytes-sha256:${sha}`, definitionReference: '', verifiedMetrics: [] },
  population: { scope: 'all-nhl', complete: false, expectedPlayerIds: [], reference: 'One-player diagnostic only; eligible NHL population is unknown' },
  frames: [{ playerId: 8476453, season: settings.season, gameType: 'regular', dateBasis: 'UTC', completeHistory: false, historyThrough: settings.cutoff, historyReference: '', appearances: nhl.map(row => ({ playerId: 8476453, gameId: row.game_id, season: row.season_id, gameType: 'regular', date: row.date, played: row.games_played === 1 ? true : row.games_played === 0 ? false : null, completion: { status: 'unverified' } })) }],
  individual: { ...batch, table: 'nst_gamelog_as_counts', rows: rows('nst_individual_log') },
  onIce: { ...batch, table: 'nst_gamelog_as_counts_oi', rows: rows('nst_on_ice_log') },
};
const mapped = mapNstCapture(capture);
if (mapped.state !== 'mapped') throw new Error(mapped.reason);
const adapted = adaptLocalSnapshot(mapped.input, 8476453);
if (adapted.state === 'rejected') throw new Error(adapted.reason);
if (adapted.readings.some(row => row.rank || row.state === 'valid')) throw new Error('Historical capture was incorrectly promoted to a qualified card');
const result = {
  inputSha256: sha, inputRows: data.length, nhlRows: nhl.length,
  captureTimeBasis: 'query-2-result start_utc request envelope; not a row source-update or database transaction timestamp',
  currentSeasonRowsMapped: mapped.input.players[0].records.length,
  joinedGames: mapped.input.players[0].records.map(row => ({ gameId: row.gameId, date: row.date, individualPresent: Object.keys(row.individual).length > 0, onIcePresent: Object.keys(row.onIce).length > 0 })),
  issues: mapped.issues, adapted,
  qualification: { historyVerified: false, completedGamesVerified: false, gameTypeAndUtcDateEvidence: 'Frame declaration only; game rows were not joined in the capture', providerModelVerified: false, fullPopulationVerified: false, currentData: false, liveActivation: false, premiumActivation: false },
  result: 'Source mapping reconciled; all 12 observed card values/ranks remain unavailable. No final-game, history, UTC-date, provider-model or league-population proof invented.',
};
writeFileSync(path.join(own, 'capture-reconciliation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ mappedCurrentSeasonGames: result.currentSeasonRowsMapped, matchingIndividual: result.joinedGames.filter(g => g.individualPresent).length, matchingOnIce: result.joinedGames.filter(g => g.onIcePresent).length, adaptedState: adapted.state, qualifiedValues: 0, ranks: 0, networkRequests: 0 }));
