// Offline audit evidence: exact declarations only; no application imports/network.
const fs = require('fs'), cp = require('child_process'), vm = require('vm');
const ts = require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const crypto = require('crypto');
const base = 'web/components/PlayerStats/';
const hashes = {};
function source(path) {
  const data = fs.readFileSync(path);
  if (!data.equals(cp.execFileSync('git', ['show', '89da739cb:' + path]))) throw Error('target drift: ' + path);
  hashes[path] = crypto.createHash('sha256').update(data).digest('hex');
  return ts.createSourceFile(path, data.toString(), ts.ScriptTarget.Latest, true);
}
function declarations(sf) {
  return sf.statements.filter(n => !ts.isImportDeclaration(n) && !ts.isExportDeclaration(n)).map(n => n.getText(sf).replace(/^export\s+/, '')).join('\n');
}
function evaluate(code, names, bindings = {}) {
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(js + '\n;({' + names.join(',') + '})', { ...bindings, exports: {} });
}
function named(sf, name) {
  let match;
  function walk(n) { if ((ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n)) && n.name?.getText(sf) === name) match = n; ts.forEachChild(n, walk); }
  walk(sf); if (!match) throw Error('missing ' + name); return match;
}
const types = evaluate(declarations(source(base + 'types.ts')), ['POSITION_STAT_CONFIGS', 'PER_60_STATS', 'PER_GAME_STATS', 'PERCENTAGE_STATS', 'formatStatValue', 'STAT_DISPLAY_NAMES'], { formatTOIFromSeconds: () => { throw Error('unused formatting dependency'); } });
const contract = evaluate(declarations(source(base + 'playerStatsContract.ts')), ['aggregateSummaryStat', 'summarizeQualityStarts', 'toDisplayUnits', 'formatPlayerStat'], types);
const heatmap = source(base + 'PlayerPerformanceHeatmap.tsx');
const scoreSource = ['calculateStepScore', 'calculatePerformanceLevel'].map(n => 'const ' + named(heatmap, n).getText(heatmap) + ';').join('\n');
const score = evaluate(scoreSource, ['calculatePerformanceLevel'], contract);
const statsCallback = named(heatmap, 'calendarStats').initializer.arguments[0].getText(heatmap);
function calendar(log, stats) {
  return evaluate('const getStats = ' + statsCallback, ['getStats'], { ...score, filteredGameLog: log, filteredPlayoffGameLog: [], selectedStats: stats }).getStats();
}
const missingGame = { date: '2026-11-01', games_played: 1, points: null };
const eliteGame = { date: '2026-11-02', games_played: 1, points: 2 };
const missing = calendar([missingGame], ['points']);
const mixed = calendar([missingGame, eliteGame], ['points']);
const goalieStats = types.POSITION_STAT_CONFIGS.G.primary;
const goalieGreat = { date: '2026-11-01', games_played: 1, save_pct: 1, goals_against_avg: 0, wins: 1, shutouts: 1, saves: 40 };
const goaliePoor = { date: '2026-11-02', games_played: 1, save_pct: 0.5, goals_against_avg: 10, wins: 0, shutouts: 0, saves: 10 };
const unsupported = [score.calculatePerformanceLevel(goalieGreat, goalieStats), score.calculatePerformanceLevel(goaliePoor, goalieStats)];
const dilution = [score.calculatePerformanceLevel({ games_played: 1, points: 2, sat_pct: 0.6 }, ['points']), score.calculatePerformanceLevel({ games_played: 1, points: 2, sat_pct: 0.6 }, ['points', 'sat_pct'])];
const page = source('web/pages/stats/player/[playerId].tsx');
let fields;
function selectCall(n) {
  if (ts.isCallExpression(n) && n.expression.getText(page) === 'fetchSeasonLogRows' && n.arguments[0]?.text === 'wgo_goalie_stats') fields = n.arguments[2].text.split(',').map(s => s.trim());
  ts.forEachChild(n, selectCall);
}
selectCall(page); if (!fields) throw Error('select missing');
const fullRow = { date: '2026-11-01', games_played: 1, games_started: 1, goals_against: 3, time_on_ice: 3600, goals_against_avg: 3, quality_start: 1 };
const selectedRow = Object.fromEntries(fields.filter(k => k in fullRow).map(k => [k, fullRow[k]]));
const missingPrimitives = {
  selectedFields: fields,
  complete: { gaa: contract.aggregateSummaryStat([fullRow], 'goals_against_avg'), qs: contract.summarizeQualityStarts([fullRow]) },
  pageProjection: { gaa: contract.aggregateSummaryStat([selectedRow], 'goals_against_avg'), qs: contract.summarizeQualityStarts([selectedRow]) }
};
const radarSource = source('web/lib/nst/radarSeasonStats.ts');
const radarPureNames = ['MIN_TOI_SECONDS', 'finite', 'share', 'onIceShare', 'rate', 'onIcePer60', 'NST_RADAR_STATS'];
const radar = evaluate(radarPureNames.map(n => 'const ' + named(radarSource, n).getText(radarSource) + ';').join('\n'), ['NST_RADAR_STATS']);
const hdLabel = { label: types.STAT_DISPLAY_NAMES.hdcf_per_60, value: radar.NST_RADAR_STATS.hdcf_per_60.value({ hdcf: 72, toi_seconds_oi: 18000 }), source: radar.NST_RADAR_STATS.hdcf_per_60.view, selectableInCurrentConfigs: Object.values(types.POSITION_STAT_CONFIGS).some(c => Object.values(c).flat().includes('hdcf_per_60')) };
if (missing.elitePercentage !== 0 || mixed.elitePercentage !== 50 || unsupported.some(x => x !== 'average') || dilution.join(',') !== 'elite,excellent' || missingPrimitives.complete.gaa !== 3 || missingPrimitives.pageProjection.gaa !== null || missingPrimitives.pageProjection.qs.rate !== null || hdLabel.value !== 14.4) throw Error('unexpected result');
console.log(JSON.stringify({ mode: 'offline exact-source VM; no application imports or network', target: '89da739cb', hashes, missing, mixed, unsupportedGoalieLevels: unsupported, unsupportedSkaterDilution: dilution, missingPrimitives, dormantRadarLabel: hdLabel }, null, 2));
