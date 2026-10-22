// Narrow P02 supplement: actual source slices with fictional input only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = require('./actual-source.cjs');
const ts = require(path.join(source.root, 'web/node_modules/typescript'));
const constants = source.selected('web/components/PlayerStats/types.ts', ['PERCENTAGE_STATS', 'PER_GAME_STATS', 'PER_60_STATS']);
const contract = source.selected('web/components/PlayerStats/playerStatsContract.ts',
  ['finite', 'RATIO_COMPONENTS', 'aggregateSummaryStat', 'isAppearance', 'countAppearances'], constants);
const observations = { runtime: process.version, existingCompiler: source.compilerVersion, findings: {} };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

function slice(file, startText, endText, returnText, bindings) {
  const text = source.read(file), start = text.indexOf(startText), end = text.indexOf(endText, start);
  if (start < 0 || end <= start || text.indexOf(startText, start + 1) >= 0) throw Error(`Slice drift: ${file}`);
  const js = ts.transpileModule(`function auditSlice() { ${text.slice(start, end)}; return ${returnText}; } auditSlice();`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new vm.Script(js, { filename: file }).runInContext(vm.createContext(bindings), { timeout: 1000 });
}

function contextual(allGames) {
  return slice('web/components/PlayerStats/PlayerContextualStats.tsx', '      const wins = allGames.reduce(',
    '      insights.push({', '{ savePct, qsRate, qualityStarts, saves, shotsAgainst }',
    { allGames, playoffGameLog: [], gamesPlayed: contract.countAppearances(allGames) });
}

test('P02-N1: existing valid pooled SV and appearance semantics remain sound', () => {
  const rows = [{ date: '2026-10-20', games_played: 1, games_started: 1, saves: 27, shots_against: 30 },
    { date: '2026-10-21', games_played: 1, games_started: 0, saves: 10, shots_against: 10 }];
  close(contract.aggregateSummaryStat(rows, 'save_pct'), 37 / 40);
  assert.equal(contract.countAppearances(rows), 2); // a relief appearance is still an appearance
  assert.equal(contract.aggregateSummaryStat([{ date: '2026-10-21', saves: 0, shots_against: 0 }], 'save_pct'), null);
  assert.equal(contract.aggregateSummaryStat([{ date: '2026-10-21', saves: null, shots_against: 10 }], 'save_pct'), null);
  observations.findings.N1 = { pooledSavePct: 37 / 40, appearances: 2, limit: 'Appearance identity is not start identity.' };
});

test('P02-D1: QS uses appearances rather than classified starts and missing QS becomes zero', () => {
  const rows = [{ date: '2026-10-19', games_played: 1, games_started: 1, quality_start: 1 },
    { date: '2026-10-20', games_played: 1, games_started: 1, quality_start: 0 },
    { date: '2026-10-21', games_played: 1, games_started: 0, quality_start: null }];
  const mixed = contextual(rows);
  close(mixed.qsRate, 1 / 3);
  const missing = contextual([{ date: '2026-10-21', games_played: 1, games_started: 1 }]);
  assert.equal(missing.qsRate, 0);
  observations.findings.D1 = { mixed, classifiedStarts: 2, qualityStarts: 1, fractionOverClassifiedStarts: 1 / 2,
    missingClassification: missing, limit: 'No provider QS classification threshold is inferred.' };
});

test('P02-D2: contextual SV sums unmatched support while the shared summary preserves paired support', () => {
  const rows = [{ date: '2026-10-20', games_played: 1, saves: 27, shots_against: 30 },
    { date: '2026-10-21', games_played: 1, saves: null, shots_against: 10 }];
  const context = contextual(rows), summary = contract.aggregateSummaryStat(rows, 'save_pct');
  close(context.savePct, 27 / 40); close(summary, 27 / 30);
  observations.findings.D2 = { contextualSavePct: context.savePct, sharedSummarySavePct: summary,
    coverage: 'Only one of two appearances has complete paired SV primitives.' };
});

test('P02-D3: GAA summary averages game rates instead of pooling elapsed seconds', () => {
  const rows = [{ date: '2026-10-20', games_played: 1, goals_against: 3, time_on_ice: 3600, goals_against_avg: 3 },
    { date: '2026-10-21', games_played: 1, goals_against: 1, time_on_ice: 600, goals_against_avg: 6 }];
  const actual = contract.aggregateSummaryStat(rows, 'goals_against_avg');
  assert.equal(actual, 4.5);
  const exposureBasedGaa = 4 * 3600 / 4200;
  assert.notEqual(actual, exposureBasedGaa);
  observations.findings.D3 = { actual, totalGoalsAgainst: 4, totalSeconds: 4200, exposureBasedGaa,
    limit: 'Synthetic seconds are known. Current page select omits exposure; no provider-unit assumption or application formula change.' };
});

test('P02-D4: missing season GAA becomes zero and outranks an observed GAA', () => {
  const goalieData = [{ goalie_id: 999001, goalie_name: 'Synthetic missing', season_id: 20262027,
    games_played: 10, goals_against_avg: null, save_pct: null, quality_starts_pct: null },
  { goalie_id: 999002, goalie_name: 'Synthetic observed', season_id: 20262027,
    games_played: 10, goals_against_avg: 2, save_pct: 0.92, quality_starts_pct: 0.6 }];
  const actual = slice('web/lib/NHL/statsPageFetch.ts', '  const goalieStats: GoalieStat[] = goalieData',
    '  return {', '{ goalieStats, goalieLeadersGAA }', { goalieData, goaliePlayersMap: new Map(), minGamesThreshold: 1 });
  assert.equal(actual.goalieLeadersGAA[0].goalie_id, 999001);
  assert.equal(actual.goalieLeadersGAA[0].goals_against_avg, 0);
  observations.findings.D4 = actual;
});

test.after(() => fs.writeFileSync(path.join(__dirname, 'P02-OBSERVATIONS.json'), JSON.stringify(observations, null, 2) + '\n'));
