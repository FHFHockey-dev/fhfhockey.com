// Read-only local probe: compile only named helpers, with a recording database fake. No route imports.
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { createRequire } = require("node:module");
const { createHash } = require("node:crypto");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = resolve(__dirname, "../../../../..");
const ts = createRequire(resolve(root, "web/package.json"))("typescript");
const path = "web/pages/api/v1/start-chart.ts", bytes = readFileSync(resolve(root, path));
const source = ts.createSourceFile(path, bytes.toString(), ts.ScriptTarget.Latest, true);
const names = ["fetchCtpiRows", "fetchYahooOwnershipHistory", "finiteOrNull", "YAHOO_HISTORY_PAGE_SIZE"];
const nodes = source.statements.filter(node => names.includes(node.name?.text)
  || ts.isVariableStatement(node) && node.declarationList.declarations.some(row => names.includes(row.name?.text)));
assert.equal(nodes.length, names.length, "Exact named helper extraction must remain complete");
const js = ts.transpileModule(nodes.map(node => node.getText(source)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

async function probe(name, helper, args, response, expectedCalls) {
  const calls = [];
  const db = { from(table) {
    const ops = [["from", table]], builder = {};
    for (const method of ["select", "in", "gte", "lte", "eq", "order", "range"]) builder[method] = (...values) => {
      ops.push([method, ...values]); return builder;
    };
    builder.then = (yes, no) => {
      assert.ok(calls.length < 30, "Probe-only safety cap reached; no source cap is implied");
      calls.push(ops); return Promise.resolve(response(ops)).then(yes, no);
    };
    return builder;
  } };
  const context = vm.createContext({ supabase: db });
  new vm.Script(js + "\nglobalThis.helpers = { fetchCtpiRows, fetchYahooOwnershipHistory };").runInContext(context);
  const result = await context.helpers[helper](...args);
  assert.equal(calls.length, expectedCalls, name);
  return { name, databaseCalls: calls.length, returnedRows: Array.isArray(result) ? result.length : result.rows.length,
    filters: calls.map(ops => ops.filter(op => ["from", "gte", "lte", "eq", "range"].includes(op[0]))) };
}
const op = (ops, name) => ops.find(row => row[0] === name);
const page = (rows, ops) => { const range = op(ops, "range"); return range ? rows.slice(range[1], range[2] + 1) : rows; };

(async () => {
  const checks = [], teams = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH"];
  for (const seasons of [1, 3]) {
    // Schema key includes season_id; the query neither selects nor filters it.
    const rows = Array.from({ length: 30 * teams.length * seasons }, (_, i) => ({
      date: `2026-10-${String(Math.floor(i / teams.length) % 30 + 1).padStart(2, "0")}`,
      team: teams[i % teams.length], ctpi_0_to_100: 50,
    }));
    checks.push(await probe(`CTPI eight teams/30 days/${seasons} synthetic season keys`, "fetchCtpiRows",
      ["2026-10-01", "2026-10-30", teams], ops => ({ data: page(rows, ops), error: null }), seasons === 1 ? 1 : 2));
  }
  const history = Array.from({ length: 5200 }, (_, i) => ({ player_key: "synthetic.p.1",
    ownership_date: new Date(Date.UTC(2026, 9, 31 - i)).toISOString().slice(0, 10), ownership_pct: null }));
  checks.push(await probe("Missing usable ownership scans all saved history", "fetchYahooOwnershipHistory",
    [["synthetic.p.1"], "2026-11-02"], ops => ({ data: op(ops, "eq") ? [] : page(history, ops), error: null }), 7));
  checks.push(await probe("Exact-date ownership avoids historical pagination", "fetchYahooOwnershipHistory",
    [["synthetic.p.1"], "2026-11-02"], () => ({ data: [{ player_key: "synthetic.p.1", ownership_date: "2026-11-02", ownership_pct: 0 }], error: null }), 1));
  checks.push(await probe("Ownership error stops without retry", "fetchYahooOwnershipHistory",
    [["synthetic.p.1"], "2026-11-02"], () => ({ data: null, error: { message: "synthetic failure" } }), 1));
  assert.ok(checks[0].filters.every(ops => !ops.some(row => row[1] === "season_id")));
  assert.ok(checks[2].filters.every(ops => !ops.some(row => row[0] === "gte")));
  process.stdout.write(JSON.stringify({ source: path, sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    helperOnly: true, fullRouteMeasured: false, syntheticInputsOnly: true, actualCostMeasured: false,
    databaseConnections: 0, networkRequests: 0, checks }, null, 2) + "\n");
})().catch(error => { console.error(error); process.exitCode = 1; });
