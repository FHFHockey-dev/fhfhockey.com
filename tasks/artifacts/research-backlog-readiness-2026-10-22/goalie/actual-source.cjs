// Isolated actual-source audit runner. No application module graph is loaded.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
// Existing repository compiler only; no installation or application bootstrap.
const ts = require(path.join(root, 'web/node_modules/typescript'));
const receipt = JSON.parse(fs.readFileSync(path.join(__dirname, 'SOURCE-REFERENCES.json'), 'utf8'));
const pinned = new Map(receipt.files.map(file => [file.path, file.sha256]));
const cache = new Map();
const allowed = new Set([
  'web/lib/sko/gap.ts', 'web/lib/skoElement/contract.ts', 'web/lib/skoElement/interpret.ts', 'web/lib/skoElement/fixtures.ts',
  'web/lib/projections/goalieModel.ts', 'web/lib/projections/constants/projection-weights.ts',
  'web/lib/projections/utils/number-utils.ts', 'web/lib/predictions/rollingWindows.ts',
  'web/lib/projections/calculators/team-context-adjustments.ts', 'web/lib/projections/calculators/goalie-save-pct-context.ts',
  'web/lib/projections/derived/buildGoalieGameV2.ts', 'web/lib/projections/derived/situation.ts',
  'web/lib/xg/aggregates.ts', 'web/lib/xg/flurryAdjusted.ts', 'web/lib/rankings/xgDenominatorSemantics.ts',
]);
function read(file) {
  if (!pinned.has(file)) throw Error(`Unpinned source: ${file}`);
  const value = fs.readFileSync(path.join(root, file), 'utf8');
  if (crypto.createHash('sha256').update(value).digest('hex') !== pinned.get(file)) throw Error(`Source drift: ${file}`);
  return value;
}
function evaluate(source, file, bindings = {}) {
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const requireLocal = name => {
    const target = name.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), name)) + '.ts'
      : name.startsWith('lib/') ? `web/${name}.ts` : null;
    if (!target || !allowed.has(target)) throw Error(`Import blocked: ${name}`);
    return load(target);
  };
  // No process, fetch, timers, sockets, service clients or filesystem in source context.
  const context = vm.createContext({ ...bindings, module, exports: module.exports, require: requireLocal });
  new vm.Script(output, { filename: file }).runInContext(context, { timeout: 1000 });
  return module.exports;
}
function load(file) {
  if (!allowed.has(file)) throw Error(`Module blocked: ${file}`);
  if (!cache.has(file)) cache.set(file, evaluate(read(file), file));
  return cache.get(file);
}
function selected(file, names, bindings = {}) {
  const source = read(file), parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const statements = parsed.statements.filter(node => names.includes(node.name?.text)
    || ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => names.includes(declaration.name.getText(parsed))));
  if (statements.length !== names.length) throw Error(`Missing/ambiguous extraction: ${file}`);
  return evaluate(statements.map(node => node.getText(parsed)).join('\n'), file, bindings);
}
function goalieQueries(db) {
  const dates = selected('web/lib/projections/utils/date-utils.ts', ['toUtcDateMs', 'daysBetweenDates']);
  return selected('web/lib/projections/queries/goalie-queries.ts', ['assertSupabase', 'fetchGoalieEvidence', 'fetchGoalieWorkloadContext'],
    { supabase: db, ...load('web/lib/projections/utils/number-utils.ts'), ...dates });
}
function teamQueries(db) {
  return selected('web/lib/projections/queries/team-context-queries.ts', [
    'assertSupabase', 'toFiniteOrNull', 'NHL_TEAM_DATA_CANDIDATE_LIMIT', 'NHL_TEAM_DATA_GP_MATCH_TOLERANCE',
    'buildTeamStrengthPriorFromNhlTeamDataRows', 'fetchTeamStrengthPrior', 'fetchTeamNstExpectedGoalsProfile',
  ], { supabase: db, fetchInHouseTeamStrengthPrior: async () => null });
}
function stageContext(inputs) {
  const file = 'web/lib/projections/stages/goalie-stage.ts', source = read(file);
  const start = source.indexOf('    let contextPct = 0;');
  const end = source.indexOf('    const adjustedTeamGoalsFor =', start);
  if (start < 0 || end <= start || source.indexOf('    let contextPct = 0;', start + 1) >= 0) throw Error('Stage slice drift');
  const body = source.slice(start, end);
  return evaluate(`export function auditSlice() { ${body}\nreturn {contextPct, shotsAgainst, leagueSavePct}; }`, file,
    { ...load('web/lib/projections/constants/projection-weights.ts'), ...load('web/lib/projections/utils/number-utils.ts'), ...inputs }).auditSlice();
}
function mockDb(responses) {
  const calls = [], pending = [...responses];
  return { calls, assertConsumed() { if (pending.length) throw Error(`${pending.length} mock responses unused`); }, from(table) {
    const response = pending.shift();
    if (!response || response.table !== table) throw Error(`Unexpected table ${table}`);
    const call = { table, operations: [] }; calls.push(call);
    const query = {};
    for (const operation of ['select', 'eq', 'lt', 'lte', 'gte', 'order', 'limit', 'maybeSingle']) {
      query[operation] = (...args) => { call.operations.push({ operation, args }); return query; };
    }
    query.then = (resolve, reject) => Promise.resolve({ data: response.data, error: response.error ?? null }).then(resolve, reject);
    return query;
  } };
}
module.exports = { root, load, read, selected, goalieQueries, teamQueries, stageContext, mockDb, compilerVersion: ts.version };
