// Offline investigation only. All rows are synthetic unless explicitly identified as relayed schedule metadata.
const assert = require('node:assert/strict');
const { loadPlanningInputs } = require('lib/rosterScheduleData/planningInputs');
const { defaultWorkspace, defaultIntent, retainedScheduleSnapshot } = require('lib/rosterScheduleOptimizer/workspace');
const { withCachedYahooEligibility, cachedYahooPlayer } = require('lib/rosterScheduleOptimizer/yahooEligibility');
const { supplementProviderRules } = require('lib/rosterScheduleOptimizer/providerRules');
const { candidatePlanMetrics } = require('lib/rosterScheduleOptimizer/candidatePlanMetrics');
const { readYahooEligibilityCache } = require('lib/rosterScheduleOptimizer/yahooEligibilityCache');
global.fetch = () => { throw new Error('Network is prohibited in this reproduction.'); };
for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(global, key, { get() { throw new Error('Storage is prohibited.'); } });
const now = new Date('2026-10-15T22:38:00.000Z');
const query = { seasonId: 20262027, startDate: '2026-10-15', endDate: '2026-10-18', timeZone: 'UTC' };
const ids = Array.from({ length: 198 }, (_, i) => String(10001 + i));
const rows = {
  teams: [{ id: 9, abbreviation: 'OTT' }, { id: 23, abbreviation: 'VAN' }, { id: 13, abbreviation: 'FLA' }],
  fhfh_player_identities: ids.map((id, i) => ({ id: Number(id), nhl_player_id: 9000000 + i, canonical_name: `Fixture ${i}`, canonical_position: 'C', verification_status: 'verified', lifecycle_status: 'active_nhl', merged_into_id: null, updated_at: now.toISOString() })),
  rosters: ids.map((id, i) => ({ playerId: 9000000 + i, teamId: i ? 23 : 9, seasonId: query.seasonId, is_current: true, created_at: '2026-09-01T00:00:00Z' })),
  roster_optimizer_team_games: [ ['OTT', 'FLA', '2026-10-17', 2026029991], ['VAN', 'FLA', '2026-10-16', 2026029992] ].map(([team, opponent, date, id], i) => ({ id: i + 1, source_game_id: id, source_season_id: query.seasonId, game_date: date, start_time: `${date}T23:00:00Z`, team_abbreviation: team, opponent_abbreviation: opponent, home_away: 'home', game_status: 'FUT', schedule_status: 'OK', is_countable: true, game_type: 2, fetched_at: '2026-10-15T21:00:00Z' })),
  yahoo_game_keys: [{ game_id: 477, game_key: '477', code: 'nhl', season: 2026 }],
  fhfh_player_external_identities: ids.map((id, i) => ({ external_player_id: `477.p.${5000 + i}`, fhfh_player_id: Number(id), provider: 'yahoo', context_key: 'yahoo:game:477:season:2026', season_id: query.seasonId, verification_status: 'verified' })),
  yahoo_players: ids.map((id, i) => ({ player_key: `477.p.${5000 + i}`, player_id: String(5000 + i), game_id: 477, season: 2026, eligible_positions: [{ position: 'C' }], position_type: 'P', last_updated: '2026-10-15 08:41:00' })),
};
const reads = [];
function database(tables) {
  return { from(table) {
    assert.ok(Object.hasOwn(tables, table), `Unknown fixture table ${table}`); reads.push(table);
    const filters = []; let start = 0, end = Infinity;
    const result = () => { const selected = tables[table].filter(row => filters.every(test => test(row))); return { data: structuredClone(selected.slice(start, end + 1)), count: selected.length, error: null }; };
    const chain = { select() { return chain; }, order() { return chain; }, abortSignal() { return chain; },
      eq(key, value) { filters.push(row => row[key] === value); return chain; }, is(key, value) { return chain.eq(key, value); },
      in(key, values) { filters.push(row => values.map(String).includes(String(row[key]))); return chain; },
      not(key, operator, value) { assert.equal(operator, 'is'); filters.push(row => row[key] !== value); return chain; },
      gte(key, value) { filters.push(row => row[key] >= value); return chain; }, lte(key, value) { filters.push(row => row[key] <= value); return chain; },
      range(from, to) { start = from; end = to; return chain; }, limit(count) { end = count - 1; return chain; },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); } };
    return chain;
  } };
}
const summaries = [];
function summarize(label, snapshot) {
  const candidates = snapshot.players.filter(player => player.id !== ids[0]);
  const metrics = candidatePlanMetrics(snapshot, defaultIntent(), { maxCandidates: 1, maxEvaluations: 12, maxProposalsPerCandidate: 2 });
  const first = metrics.diagnostics.find(row => row.playerId === ids[1]);
  const summary = { label, candidates: candidates.length, unverifiedEligibility: candidates.filter(player => !player.eligibilityVerified).length,
    unknownAvailability: candidates.filter(player => player.availability === 'unknown').length, schedule: snapshot.evidence.schedule.completeness,
    acquisitionTiming: snapshot.rules.acquisitionTiming, acquisitionCost: snapshot.rules.acquisitionCost, periods: snapshot.rules.periods.length,
    firstCandidate: first, firstPlans: metrics.candidates.find(row => row.playerId === ids[1])?.plans.map(plan => ({ netAGP: plan.netAGP, netPoints: plan.netPoints })) ?? [] };
  summaries.push(summary); return summary;
}
(async () => {
  const inputs = await loadPlanningInputs(database(rows), query, now);
  const data = { ...inputs, forecasts: [] };
  const workspace = defaultWorkspace(now); workspace.context = { ...workspace.context, ...query, provider: 'yahoo', leagueId: 'fixture-league', teamId: 'fixture-team' };
  workspace.roster = [{ playerId: ids[0], position: 'bench' }]; workspace.manualPlayers = [data.players[0]];
  const managerRules = { acquisitionTiming: 'same_day', acquisitionCost: 1, periods: [{ id: 'fixture-period', start: '2026-10-15T00:00:00Z', end: '2026-10-19T00:00:00Z', remaining: 2, source: 'manager' }] };
  workspace.rules = { ...workspace.rules, ...managerRules, rosterSlots: { C: 1, BN: 1 }, scoring: { mode: 'points', weights: { GOALS: 1 }, categories: [] } };
  workspace.managerRuleOverrides = structuredClone(managerRules);
  const before = JSON.stringify(workspace);
  const retained = retainedScheduleSnapshot(workspace, data, now.toISOString());
  const manual = summarize('manual public catalogue without explicit candidate/rule inputs', { ...retained, id: 'manual:fixture',
    context: { ...workspace.context, provider: 'manual' }, players: data.players, rules: defaultWorkspace(now).rules });
  assert.equal(manual.unverifiedEligibility, 197); assert.equal(manual.unknownAvailability, 197);
  const missing = summarize('retained fallback with no cache; manager rules stored', retained);
  assert.equal(missing.unverifiedEligibility, 197); assert.equal(missing.unknownAvailability, 197);
  assert.equal(missing.acquisitionTiming, 'unknown'); assert.equal(missing.acquisitionCost, null); assert.equal(missing.periods, 0);
  const receipts = [];
  for (let offset = 0; offset < ids.length; offset += 60) receipts.push(await readYahooEligibilityCache(database(rows), query.seasonId, ids.slice(offset, offset + 60), now));
  assert.ok(receipts.every(receipt => receipt.status === 'ready'));
  const receipt = { ...receipts[0], players: receipts.flatMap(receipt => receipt.players) };
  const cached = withCachedYahooEligibility(retained, receipt, now);
  const improved = summarize('retained fallback with all 198 exact current cache records', cached);
  assert.equal(improved.unverifiedEligibility, 0); assert.equal(improved.unknownAvailability, 197);
  assert.equal(improved.firstCandidate.status, 'filtered'); assert.deepEqual(improved.firstCandidate.reasons, ['League availability is not verified for acquisition.']);
  const noMembership = structuredClone(retained); noMembership.players.forEach(player => { delete player.nhlTeamId; delete player.rosterRevision; });
  const lineage = summarize('ready cache but no current roster lineage in planning snapshot', withCachedYahooEligibility(noMembership, receipt, now));
  assert.equal(lineage.unverifiedEligibility, 197);
  assert.equal(cachedYahooPlayer(noMembership.players[1], receipt, query.seasonId, now).eligibilityVerified, true);
  const old = { ...receipt, expiresAt: '2026-10-15T08:40:00.000Z' };
  assert.equal(summarize('previous daily cache cycle', withCachedYahooEligibility(retained, old, now)).unverifiedEligibility, 197);
  const connected = { ...structuredClone(cached), id: 'yahoo:fixture-current',
    rules: { ...structuredClone(workspace.rules), acquisitionTiming: 'unknown', acquisitionCost: null, periods: [] },
    evidence: { ...data.evidence, roster: { source: 'Synthetic current provider roster', asOf: now.toISOString(), seasonId: query.seasonId, completeness: 'complete', limitations: [] } },
    players: cached.players.map(player => ({ ...player, availability: player.id === ids[1] ? 'free_agent' : 'unknown', canDrop: true })) };
  assert.equal(summarize('connected named ownership supplied; transaction rules absent', connected).firstCandidate.status, 'no_proposals');
  const costMissing = supplementProviderRules(connected, { acquisitionTiming: 'same_day' }).snapshot;
  const noBudget = summarize('timing supplied; cost and periods absent; bounded two-proposal search', costMissing);
  assert.equal(noBudget.firstPlans.length, 0); assert.ok(noBudget.firstCandidate.illegal > 0);
  assert.ok(noBudget.firstCandidate.reasons.some(reason => /period|allowance|cost/i.test(reason)));
  const qualified = supplementProviderRules(connected, managerRules).snapshot;
  const working = summarize('named fixture candidate with explicit manager rules and fresh game evidence', qualified);
  assert.ok(working.firstPlans.some(plan => plan.netAGP === 1 && plan.netPoints === null));
  const staleRows = structuredClone(rows);
  staleRows.roster_optimizer_team_games.forEach(row => { row.fetched_at = '2026-10-14T00:12:54.911Z'; });
  const staleInputs = await loadPlanningInputs(database(staleRows), query, now);
  const stale = summarize('same qualified fixture with stale schedule source receipt', { ...qualified, evidence: { ...qualified.evidence, schedule: staleInputs.evidence.schedule } });
  assert.equal(stale.schedule, 'partial'); assert.ok(stale.firstPlans.length); assert.ok(stale.firstPlans.every(plan => plan.netAGP === null));
  const relayed = { gameId: '2026020112', seasonId: 20262027, rowIds: [353, 354], teams: ['VAN', 'FLA'], fetchedAt: '2026-10-14T00:12:54.911Z', readAt: '2026-10-15T22:37:25.275Z', provenance: 'FORGE owner relay; no database read performed here' };
  relayed.ageMs = Date.parse(relayed.readAt) - Date.parse(relayed.fetchedAt); relayed.exceeds36HoursByMs = relayed.ageMs - 36 * 3600000;
  assert.equal(relayed.ageMs, 167070364); assert.equal(relayed.exceeds36HoursByMs, 37470364);
  assert.equal(JSON.stringify(workspace), before);
  process.stdout.write(JSON.stringify({ status: 'passed', synthetic: true, cases: summaries, relayedScheduleEvidence: relayed, mockQueryCount: reads.length, actualNetworkRequests: 0, ownerStorageAccess: 0, workspaceMutated: false }, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
