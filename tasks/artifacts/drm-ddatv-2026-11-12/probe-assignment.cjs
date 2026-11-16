// Offline source-executing audit probe; no provider/database/browser access.
// Run from repository root: node tasks/artifacts/drm-ddatv-2026-11-12/probe-assignment.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'web/node_modules/typescript'));
const files = {};
function source(file) {
  const value = fs.readFileSync(path.join(root, file), 'utf8');
  files[file] = crypto.createHash('sha256').update(value).digest('hex');
  return value;
}
function evaluate(code, imports = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(code, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  new Function('require', 'module', 'exports', js)((name) => {
    if (!(name in imports)) throw new Error(`Blocked import: ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}
function declarations(file, names) {
  const code = source(file);
  const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
    .map(node => node.getText(ast)).join('\n');
}
if (process.argv.includes('--unit-reuse')) {
  const { buildEvenStrengthTeamUnitToiRows } = evaluate(source('web/lib/rankings/teamUnitToiBuilder.ts'));
  const { completeGameIds } = evaluate(source('web/lib/rankings/teamUnitToiNightly.ts'));
  const roles = ['C','LW','RW','D','D','G'];
  const players = [1,2].flatMap(team => roles.map((position, i) => ({ id: team * 100 + i + 1, position })));
  const shifts = players.map(p => ({ game_id: 1001, season_id: 20262027,
    game_date: '2026-11-01', team_id: Math.floor(p.id / 100), team_abbrev: Math.floor(p.id / 100) === 1 ? 'AAA' : 'BBB',
    player_id: p.id, period: 1, start_seconds: 0, end_seconds: 120, duration_seconds: 120 }));
  const build = supplied => buildEvenStrengthTeamUnitToiRows({ shifts: supplied, players, season: 20262027, snapshotDate: '2026-11-12' });
  const baseline = build(shifts);
  const missingSkater = build(shifts.map(s => s.player_id === 103 ? { ...s, end_seconds: 60, duration_seconds: 60 } : s));
  const compact = rows => rows.map(r => ({ team: r.team_id, type: r.unit_type,
    pooledSeconds: r.unit_toi_seconds, clockSeconds: r.unit_toi_seconds / r.player_count,
    coverage: r.coverage_status, warnings: r.coverage_warnings }));
  assert.equal(baseline[0].unit_toi_seconds, 360);
  assert.equal(missingSkater[0].unit_toi_seconds, 180);
  assert.ok(missingSkater.every(r => r.coverage_status === 'complete'));
  const noGoalies = build(shifts.filter(s => s.player_id % 100 !== 6));
  const knownFourEach = build(shifts.filter(s => s.player_id % 100 !== 3));
  assert.deepEqual(noGoalies, []);
  assert.deepEqual(knownFourEach, []);
  const partialAcceptedAsDone = [...completeGameIds(missingSkater.map(r => ({ ...r, coverage_status: 'partial' })))];
  assert.deepEqual(partialAcceptedAsDone, [1001]);
  console.log(JSON.stringify({ node: process.version, actualSourceSha256: files, assertions: 'passed', unitReuse: {
    baseline: compact(baseline), missingSkaterInterval: compact(missingSkater),
    allGoaliesMissing: noGoalies, knownNon5v5: knownFourEach, noSource: build([]),
    partialAcceptedAsDone,
  } }, null, 2));
  process.exit(0);
}
const utilities = evaluate(declarations('web/components/DateRangeMatrix/utilities.ts', ['isForward', 'isDefense']));
const { calculateLinesAndPairs } = evaluate(source('web/components/DateRangeMatrix/lineCombinationHelper.ts'), { './utilities': utilities });
const { orderForwardLineForPresentation } = evaluate(
  declarations('web/components/DateRangeMatrix/LinePairGrid.tsx', ['orderForwardLineForPresentation']) + '\nexport { orderForwardLineForPresentation };');
const forbidden = () => { throw new Error('Remote access forbidden'); };
const reduction = evaluate(source('web/components/DateRangeMatrix/fetchAggregatedData.ts') +
  '\nexport { normalizeAggregateRows, buildAggregatedPlayers };', {
    'lib/supabase': { default: { from: forbidden } },
    'lib/teamsInfo': { teamsInfo: {} },
    'lib/supabase/pagination': {
      DEFAULT_SUPABASE_FILTER_CHUNK_SIZE: 100,
      DEFAULT_SUPABASE_PAGE_SIZE: 1000,
      fetchAllSupabaseFilterChunks: forbidden, fetchAllSupabasePages: forbidden,
    },
  });
function player(id, overrides = {}) {
  return { id, teamId: 22, franchiseId: 25, position: 'C', name: `Player ${id}`,
    playerAbbrevName: `P${id}`, lastName: `${id}`, totalTOI: 600, timesOnLine: { 1: 1 },
    timesOnPair: {}, percentToiWith: {}, percentToiWithMixed: {}, timeSpentWith: {},
    timeSpentWithMixed: {}, GP: 1, timesPlayedWith: {}, ATOI: '10:00', percentOfSeason: {},
    displayPosition: 'C', comboPoints: 0, mutualSharedToi: {}, playerType: 'F', ...overrides };
}
const ids = groups => ({ lines: groups.lines.map(g => g.map(p => p.id)), pairs: groups.pairs.map(g => g.map(p => p.id)) });
const group = roster => ids(calculateLinesAndPairs(roster, 'full-roster'));
const result = {};
const asymmetric = [player(1, { totalTOI: 1200, timesOnLine: { 1: 2 }, mutualSharedToi: { 2: 600, 3: 300 } }),
  player(2, { totalTOI: 1800, mutualSharedToi: { 1: 600 } }), player(3)];
const secondsOrder = group(asymmetric);
const fallbackOrder = group(asymmetric.map(p => ({ ...p, mutualSharedToi: undefined,
  percentToiWith: Object.fromEntries(Object.entries(p.mutualSharedToi).map(([id, seconds]) => [id, 100 * seconds / p.totalTOI])) })));
assert.deepEqual(secondsOrder, fallbackOrder);
result.asymmetricShares = { AtoB: 50, BtoA: 100 * 600 / 1800, secondsOrder, fallbackOrder };
const short = [player(1, { timesOnLine: { 1: 2 }, mutualSharedToi: { 2: 1, 3: 0, 4: 0 } }), player(2), player(3), player(4)];
assert.deepEqual(group(short), { lines: [[1,2,3]], pairs: [] });
result.shortAndZero = group(short);
const tied = Array.from({ length: 6 }, (_, i) => player(i + 1));
assert.deepEqual(group(tied), group([...tied].reverse()));
result.tieOrder = group(tied);
const typedMulti = [player(1, { displayPosition: 'C/RW' }), player(2, { displayPosition: 'LW' }), player(3, { displayPosition: 'C' })];
const untypedMulti = typedMulti.map(p => ({ ...p, playerType: undefined, position: p.displayPosition }));
assert.deepEqual(group(typedMulti).lines, [[1,2,3]]);
assert.deepEqual(group(untypedMulti).lines, []);
result.positionRules = { explicitType: group(typedMulti), missingType: group(untypedMulti),
  threeCenters: group([player(1), player(2), player(3)]),
  cardOrder: orderForwardLineForPresentation(typedMulti).map(p => p.id) };
assert.equal(new Set(result.positionRules.cardOrder).size, 3);
result.frequencyPivot = group([player(1, { timesOnLine: { 4: 5 } }), player(2, { timesOnLine: { 1: 1 } }), player(3)]);
const scope = { teamId: 22, teamAbbreviation: 'EDM', franchiseId: 25, seasonId: 20262027,
  gameType: '2', startDate: '2026-11-01', endDate: '2026-11-12', gameIds: new Set([1001,1002]),
  homeOrAway: null, opponentTeamAbbreviation: null };
function clock(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}`; }
function rowsForGame(gameId, roster, shared) {
  return roster.map(id => ({ id: gameId * 10 + id, game_id: gameId, game_type: '2',
    game_date: gameId === 1001 ? '2026-11-01' : '2026-11-10', season_id: 20262027, player_id: id,
    player_first_name: 'Player', player_last_name: String(id), team_id: 22, team_abbreviation: 'EDM',
    game_toi: '10:00', home_or_away: 'home', opponent_team_abbreviation: 'TOR', opponent_team_id: 10,
    display_position: 'C', primary_position: 'C', player_type: 'F', game_length: '60:00',
    line_combination: 1, pairing_combination: null, time_spent_with_mixed: {},
    time_spent_with: Object.fromEntries(roster.filter(other => other !== id)
      .map(other => [other, clock(shared[`${Math.min(id,other)}:${Math.max(id,other)}`] ?? 0)])),
  }));
}
function reduce(rows, selectedScope = scope) {
  const normalized = reduction.normalizeAggregateRows(rows, selectedScope);
  const aggregated = reduction.buildAggregatedPlayers(normalized.rows, normalized.pairGameFacts, new Map(), 'regularSeason', selectedScope);
  const roster = Object.values(aggregated).map(p => player(p.playerId, { ...p.regularSeasonData,
    playerType: p.playerType, displayPosition: p.displayPosition }));
  return { normalized, roster };
}
const firstGame = rowsForGame(1001, [1,2,4], { '1:2':600, '1:4':600, '2:4':600 });
const secondGame = rowsForGame(1002, [1,3,5], { '1:3':600, '1:5':600, '3:5':600 });
const changed = reduce([...firstGame, ...secondGame]);
assert.deepEqual(group(changed.roster), { lines: [[1,2,3]], pairs: [] });
result.changingLinesOrSubstitutions = { observedTrios: [[1,2,4],[1,3,5]],
  observedSecondsPerTrio: 600, returned: group(changed.roster),
  returnedTrioCommonGames: [], player1: { totalTOI: changed.roster[0].totalTOI,
    mutualSharedToi: changed.roster[0].mutualSharedToi } };
const missing = reduce(firstGame);
assert.equal(missing.normalized.skippedRows, 0);
result.missingEntireGame = { requestedGameIds: [1001,1002], presentGameIds: [...new Set(missing.normalized.rows.map(r => r.gameId))],
  skippedRows: missing.normalized.skippedRows, returned: group(missing.roster) };
assert.throws(() => reduce([...firstGame, { ...secondGame[0], team_id: 10, team_abbreviation: 'TOR' }]), /selected scope/);
result.tradeScope = { foreignTeamRow: 'rejected', sameTeamDisjointTenure: result.changingLinesOrSubstitutions.returned };
const a = player(1, { timesOnLine: { 1: 2 }, mutualSharedToi: { 2: 600, 3: 600 } });
result.noSimultaneousTrio = { intervals: { 1: [[0,1200]], 2: [[0,600]], 3: [[600,1200]] },
  pairSeconds: { '1:2':600, '1:3':600, '2:3':0 }, simultaneousTrioSeconds: 0,
  returned: group([a,player(2),player(3)]) };
assert.deepEqual(result.noSimultaneousTrio.returned.lines, [[1,2,3]]);
const capped = Array.from({ length: 16 }, (_, i) => player(i+1));
result.modeLimits = { capped: ids(calculateLinesAndPairs(capped, 'line-combination')),
  full: group(capped), fullUngroupedIds: [16] };
assert.equal(result.modeLimits.capped.lines.length, 4);
assert.equal(result.modeLimits.full.lines.length, 5);
console.log(JSON.stringify({ node: process.version, actualSourceSha256: files, assertions: 'passed', result }, null, 2));
