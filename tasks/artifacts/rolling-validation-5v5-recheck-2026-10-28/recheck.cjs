// Offline source-fragment verification only: no application imports or transports.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'web/node_modules/typescript'));
const checkpoint = JSON.parse(fs.readFileSync(path.join(__dirname, 'CHECKPOINT.json'), 'utf8'));
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const fragments = [];
function extract(file, names) {
  const bytes = fs.readFileSync(path.join(__dirname, 'snapshot', file));
  assert.equal(sha(bytes), checkpoint.source_files.find(p => p.path === file).sha256);
  const ast = ts.createSourceFile(file, bytes.toString(), ts.ScriptTarget.Latest, true);
  return names.map(name => {
    const nodes = ast.statements.filter(n =>
      (ts.isFunctionDeclaration(n) && n.name?.text === name) ||
      (ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === name)));
    assert.equal(nodes.length, 1, name);
    const n = nodes[0]; const text = n.getText(ast);
    fragments.push({ file, name, line: ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1, sha256: sha(text) });
    return text.replace(/^export /, '');
  }).join('\n');
}
const code = [
  extract('web/lib/api/queryParams.ts', ['getSingleQueryParam', 'parseQueryString']),
  extract('web/pages/api/v1/debug/rolling-player-metrics.ts', ['STRENGTHS', 'parseStrength']),
  extract('web/lib/supabase/Upserts/rollingDroppedColumns.ts', ['ROLLING_DROPPED_COLUMNS', 'ROLLING_DROPPED_COLUMN_SET', 'isRollingDroppedColumn']),
  extract('web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts', ['toNumberOrNull', 'compareValues', 'getRowGameId', 'getRowGameDate', 'getRowStrength', 'getRowSeason', 'getRowTeamId', 'getRowKey', 'sortRowsByDateAsc', 'filterRowsForRequest', 'isLegacyField', 'inferMetricFamily', 'buildFamilyComparisonSummary'])
].join('\n');
assert(!/\b(?:require|process|fetch|createClient|dotenv)\s*[.(]/.test(code));
const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const ctx = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
vm.runInContext(compiled, ctx, { timeout: 1000 });
const results = [];
function check(name, actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, name);
  results.push({ name, passed: true, actual, expected });
}
const strengths = ['all', 'ev', 'pp', 'pk', '5v5'];
const fixture = { player_id: 8476453, season: 20262027, game_id: 2026020100, game_date: '2026-10-20', team_id: 14, goals_avg_last5: 0.5 };
for (const strength of strengths) {
  const request = { playerId: fixture.player_id, season: fixture.season, strength: ctx.parseStrength(strength) };
  const rows = strengths.map(s => ({ ...fixture, strength_state: s }));
  const retained = ctx.filterRowsForRequest(rows, request);
  const comparison = ctx.buildFamilyComparisonSummary({ storedRows: retained, recomputedRows: [{ ...retained[0], goals_avg_last5: 0.8 }], selectedMetricFamily: null });
  check(`${strength}: selected row survives and real mismatch remains visible`, {
    rowCount: retained.length, playerId: retained[0]?.player_id, strength: retained[0]?.strength_state,
    key: ctx.getRowKey(retained[0]), compared: comparison.rowCountCompared, mismatches: comparison.mismatchFieldCount
  }, { rowCount: 1, playerId: 8476453, strength, key: `2026-10-20:${strength}:2026020100`, compared: 1, mismatches: 1 });
}
check('Unsupported strength is rejected and never enters the 5v5 frame', {
  route: ctx.parseStrength('4v4'),
  retained: ctx.filterRowsForRequest([{ ...fixture, strength_state: '4v4' }], { season: fixture.season, strength: '5v5' }).length
}, { route: null, retained: 0 });
const request = { playerId: 8476453, season: 20262027, strength: '5v5', teamId: 14, startDate: '2026-10-20', endDate: '2026-10-20' };
const row5 = { ...fixture, strength_state: '5v5' };
check('Season, team and date restrictions still apply', ctx.filterRowsForRequest([
  row5, { ...row5, season: 20252026 }, { ...row5, team_id: 15 }, { ...row5, game_date: '2026-10-19' }, { ...row5, game_date: '2026-10-21' }
], request), [row5]);
check('5v5 comparison preserves valid zero versus missing/null', [
  ctx.compareValues(0, 0).valuesMatch,
  ctx.compareValues(null, 0).valuesMatch,
  ctx.compareValues(undefined, 0).valuesMatch,
  ctx.compareValues(null, null).valuesMatch
], [true, false, false, true]);
const pinsUnchanged = checkpoint.source_files.every(p => sha(fs.readFileSync(path.join(root, p.path))) === p.sha256);
assert(pinsUnchanged);
const result = { at: new Date().toISOString(), nodeVersion: process.version, mode: 'exact source-extracted current functions; synthetic fixtures; no full module imports',
  passed: results.length, failed: 0, sourcePinsUnchanged: pinsUnchanged, compiledSha256: sha(compiled), fragments, results,
  networkCalls: 0, databaseOperations: 0, environmentFileReads: 0, sourceEdits: 0, fullPackageTestsRun: false };
fs.writeFileSync(path.join(__dirname, 'RESULTS.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, failed: result.failed, sourcePinsUnchanged: pinsUnchanged, nodeVersion: result.nodeVersion }));
