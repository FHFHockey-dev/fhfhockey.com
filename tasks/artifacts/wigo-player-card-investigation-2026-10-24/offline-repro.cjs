// Isolated, network-free execution of the inspected application functions.
// Run from the repository root: node tasks/artifacts/wigo-player-card-investigation-2026-10-24/offline-repro.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'web/node_modules/typescript'));
const sources = {};
const quiet = { log() {}, warn() {}, error() {} };
function load(relative, mocks) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  sources[relative] = crypto.createHash('sha256').update(source).digest('hex');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, console: quiet,
    require(name) { if (!(name in mocks)) throw new Error(`Unmocked import forbidden: ${name}`); return mocks[name]; },
    fetch() { throw new Error('Network forbidden'); }
  });
  new vm.Script(code, { filename: relative }).runInContext(context, { timeout: 2000 });
  return module.exports;
}
const formatting = load('web/utils/formattingUtils.ts', {});
const metadata = load('web/components/WiGO/statMetadata.ts', { 'utils/formattingUtils': formatting });
const consumer = load('web/utils/fetchWigoPlayerStats.ts', {
  'components/WiGO/statMetadata': metadata,
  'lib/supabase': { from() { throw new Error('Consumer database access forbidden'); } },
  'lib/supabase/pagination': { fetchAllSupabasePages() { throw new Error('Pagination forbidden'); } }
});
const cases = [];
const record = (name, observed) => cases.push({ name, status: 'passed', observed });
const selectRows = rows => Object.fromEntries(rows.map(row => [row.label, { STD: row.STD, L5: row.L5, L10: row.L10, L20: row.L20 }]));
const recent = { player_id: 8476453, l5_gp: 5, l5_atoi: 20, l5_pts_per_60: 6, l5_sog_per_60: 12 };
const build = input => selectRows(consumer.buildPlayerAggregatedStats({ careerData: null, recentData: recent, ratesData: null, totalsData: null, ...input }));
assert.equal(build({})['PTS/60'].L5, 6);
assert.equal(build({ ratesData: { pts_per_60_l5: null } })['PTS/60'].L5, null);
record('null rates-table field erases a supported recent rate', { recent: 6, rates: null, displayed: null });
assert.equal(build({ ratesData: { pts_per_60_l5: 999 } })['PTS/60'].L5, 999);
record('numeric rates-table field overrides supported recent rate without a freshness check', { recent: 6, rates: 999, displayed: 999 });
assert.equal(build({ recentData: { ...recent, l5_atoi: null }, ratesData: { pts_per_60_l5: 999 } })['PTS/60'].L5, null);
record('recent coverage guard prevents revival when TOI is missing', { displayed: null });
assert.equal(build({ careerData: { player_id: 8476453, std_gp: 5 }, totalsData: { season: '20242025', points: 100 } }).Points.STD, 100);
record('prior-season totals fallback can be displayed as STD', { totalsSeason: '20242025', displayedStdPoints: 100 });
const ranking = load('web/utils/calculatePercentiles.ts', {});
const pool = [10, 8, 8, 0].map((value, index) => ({ player_id: index + 1, value }));
const tie = ranking.calculateRankingResult(pool, 2, true);
assert.equal(tie.rank, 2);
assert.equal(tie.percentile, 0.5);
const zero = ranking.calculateRankingResult(pool, 4, true);
assert.equal(zero.rank, 4);
assert.equal(zero.percentile, 0.125);
const singleton = ranking.calculateRankingResult([{ player_id: 1, value: 0 }], 1, true);
assert.equal(singleton.percentile, 0.5);
record('existing rank helper supports competition ties and same-pool midrank percentiles including zero', { pool: [10, 8, 8, 0], tiedRank: tie.rank, denominator: pool.length, tiedPercentile: tie.percentile * 100, zeroRank: zero.rank, zeroPercentile: zero.percentile * 100, singletonPercentile: singleton.percentile * 100 });

let tables;
let errors;
let writes;
let traces;
const from = table => {
  const trace = { table, calls: [] };
  traces.push(trace);
  const filters = [];
  let order;
  let limit;
  let select;
  const q = {};
  q.select = value => { select = value; trace.calls.push(['select', value]); return q; };
  q.eq = (key, value) => { filters.push(row => row[key] === value); trace.calls.push(['eq', key, value]); return q; };
  q.neq = (key, value) => { filters.push(row => row[key] !== value); trace.calls.push(['neq', key, value]); return q; };
  q.order = (key, options) => { order = [key, options.ascending]; trace.calls.push(['order', key, options]); return q; };
  q.limit = value => { limit = value; trace.calls.push(['limit', value]); return q; };
  q.range = () => q;
  q.upsert = rows => { writes[table] = rows; return Promise.resolve({ error: null }); };
  q.then = (resolve, reject) => {
    let rows = (tables[table] ?? []).filter(row => filters.every(filter => filter(row)));
    if (order) rows.sort((a, b) => String(a[order[0]]).localeCompare(String(b[order[0]])) * (order[1] ? 1 : -1));
    if (limit !== undefined) rows = rows.slice(0, limit);
    if (select && select !== '*') rows = rows.map(row => Object.fromEntries(select.split(',').map(key => key.trim()).map(key => [key, row[key]])));
    return Promise.resolve({ data: errors[table] ? null : rows, error: errors[table] ?? null, count: rows.length }).then(resolve, reject);
  };
  return q;
};
const writer = load('web/pages/api/v1/db/calculate-wigo-stats.ts', {
  'lib/cron/withCronJobAudit': { withCronJobAudit: handler => handler },
  'lib/cron/nhlOffSeason': { withNhlOffSeasonSkip: handler => handler },
  'lib/cron/normalizeDependencyError': { normalizeDependencyError: error => ({ message: String(error) }) },
  'utils/adminOnlyMiddleware': { default: handler => handler, __esModule: true },
  'lib/supabase/server': { default: { from }, __esModule: true },
  'lib/NHL/server': { getCurrentSeason: async () => ({ seasonId: 20262027, lastSeasonId: 20252026 }) }
}).default;
const game = (date, season = 20262027) => ({ player_id: 8476453, date, date_scraped: date, season_id: season, season, games_played: 1,
  goals: 1, assists: 1, points: 2, total_primary_assists: 1, shots: 4,
  pp_goals: 0, pp_assists: 0, pp_points: 0, pp_toi: 120, pp_toi_pct_per_game: 0.5,
  hits: 2, blocked_shots: 1, penalty_minutes: 0, toi: 1200, ixg: 0.8, icf: 10, hdcf: 2, iscfs: 4,
  gf: 3, sf: 12, off_zone_starts: 2, def_zone_starts: 2 });
const games = Array.from({ length: 5 }, (_, i) => game(`2026-10-${23 - i}`));
async function run(nhl, nst = nhl, failure = {}) {
  tables = { players: [{ id: 8476453, position: 'R' }], wgo_skater_stats: nhl, nst_gamelog_as_counts: nst, nst_gamelog_as_counts_oi: nst };
  errors = failure; writes = {}; traces = [];
  const res = { statusCode: 0, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await writer({ method: 'GET', query: {}, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  return { row: writes.wigo_recent?.[0], statusCode: res.statusCode, traces: structuredClone(traces) };
}
(async () => {
  let result = await run(games);
  assert.equal(result.row.l5_atoi, 20);
  assert.equal(result.row.l5_sog_per_60, 12);
  record('complete five-game NHL/NST intersection yields correct seconds-to-per60 math', { gp: result.row.l5_gp, atoiMinutes: result.row.l5_atoi, sogPer60: result.row.l5_sog_per_60 });
  result = await run(games, games.slice(1));
  assert.equal(result.row.l5_sog, 20);
  assert.equal(result.row.l5_sog_per_60, null);
  assert.equal(result.row.l5_ixg, null);
  record('one missing NST game invalidates affected whole-window metrics and preserves NHL counts', { gp: result.row.l5_gp, sog: result.row.l5_sog, sogPer60: result.row.l5_sog_per_60, ixg: result.row.l5_ixg });
  const crossSeason = [games[0], ...games.slice(1).map(g => game(g.date.replace('2026-10', '2026-04'), 20252026))];
  result = await run(crossSeason);
  assert.equal(result.row.l5_gp, 5);
  assert.equal(result.row.l5_sog, 20);
  record('recent window crosses season boundary and L10/L20 can contain fewer games than their label', { currentSeasonGames: 1, priorSeasonGames: 4, l5Gp: result.row.l5_gp, l10Gp: result.row.l10_gp, l20Gp: result.row.l20_gp });
  result = await run(games, [], { nst_gamelog_as_counts: { message: 'synthetic database failure' } });
  assert.equal(result.row.l5_sog_per_60, null);
  record('NST read error is treated as empty input and route still reports success', { routeStatus: result.statusCode, sogPer60: result.row.l5_sog_per_60 });
  result = await run([...games, { ...games[0], games_played: 0, date: '2026-10-24' }], games);
  assert.equal(result.row.l5_sog_per_60, null);
  record('a nonappearance row is admitted to the recent window if present upstream', { l5Gp: result.row.l5_gp, sogPer60: result.row.l5_sog_per_60, participationFilter: result.traces.find(t => t.table === 'wgo_skater_stats').calls.filter(call => call[0] === 'eq') });
  const output = { evidenceType: 'synthetic offline function execution; no live-input claims', network: 'No application module can import a real transport or database client; fetch throws.', cases, sourceSha256: sources };
  fs.writeFileSync(path.join(__dirname, 'offline-results.json'), `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
})().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
