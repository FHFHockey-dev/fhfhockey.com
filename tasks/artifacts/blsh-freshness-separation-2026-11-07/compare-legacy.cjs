// Offline synthetic parity proof. Does not load receipts, providers or databases.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const web = path.resolve(__dirname, '../../../web');
const ts = require(path.join(web, 'node_modules/typescript'));
function load(source, imports = {}) {
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => imports[name] ?? require(name), module, module.exports);
  return module.exports;
}
const currentInput = load(fs.readFileSync(path.join(web, 'lib/buyLowSellHigh/currentInput.ts'), 'utf8'));
const canonical = load(fs.readFileSync(path.join(web, 'lib/buyLowSellHigh/currentProcessEvidence.server.ts'), 'utf8'), { './currentInput': currentInput });
const baseline = load(fs.readFileSync(path.join(__dirname, 'currentProcessEvidence.server.base.ts'), 'utf8'), { './currentInput': currentInput });
const test = fs.readFileSync(path.join(web, 'lib/buyLowSellHigh/currentProcessEvidence.server.test.ts'), 'utf8');
const helper = test.slice(0, test.indexOf('describe("current process')).replace('import { describe, expect, it } from "vitest";', '') +
  test.slice(test.indexOf('function windowFixture'), test.indexOf('describe("source observation')) +
  '\nexport { fixture, windowFixture, RECENT_WINDOW, AT };';
const { fixture, windowFixture, RECENT_WINDOW, AT } = load(helper, { './currentInput': currentInput, './currentProcessEvidence.server': canonical });
function legacyShape(value) {
  const out = structuredClone(value);
  delete out.freshnessDiagnosticsVersion; delete out.capturedWindows;
  delete out.coverage.sourceObservationIndividualQualified; delete out.coverage.sourceObservationOnIceQualified;
  for (const row of out.records) for (const group of ['individual', 'onIce']) delete row[group].sourceObservation;
  return out;
}
const cases = [
  ['recent', fixture()],
  ['wide-recent-window', windowFixture(RECENT_WINDOW)],
  ['old-window', windowFixture(['2026-10-11','2026-10-13','2026-10-15','2026-10-17','2026-10-24'])],
  ['short-window', windowFixture(RECENT_WINDOW.slice(-4))],
  ['missing-other-feed', fixture(s => { s.request.onIce = null; })],
  ['invalid-metric', fixture(s => { s.request.individual.rows[0].ixg = null; })],
  ['unreviewed-scope', fixture(s => { s.overrides.individual.nativeValuesMatched = false; })],
  ['exposure-mismatch', fixture(s => { s.frame.totalToiSeconds = 899; })],
  ['row-drift', fixture(s => { s.overrides.individual.processRowSHA256 = 'b'.repeat(64); })],
  ['native-future-microsecond', fixture(s => { s.receipts.individual.retrievedAtUTC = '2026-11-01T20:00:00.000001Z'; })],
  ['capture-age-microsecond', fixture(s => { s.request.freshnessPolicy.maxCaptureAgeHours = 1; })],
];
const results = [];
for (const [name, f] of cases) {
  for (const at of [AT, '2026-11-01T20:00:00.000001Z', '2026-11-03T20:00:00Z']) {
    for (const accepted of [true, false]) {
      const policy = accepted ? f.policy : undefined;
      const args = [f.requestBytes, at, f.bundleBytes, f.artifacts];
      const before = baseline.createCurrentProcessEvidenceGate(policy)(...args);
      const after = canonical.createCurrentProcessEvidenceGate(policy)(...args);
      assert.deepStrictEqual(legacyShape(after), before);
      results.push({ name, evaluatedAtUTC: at, acceptedSyntheticPolicy: accepted, unchanged: true });
    }
  }
}
fs.writeFileSync(path.join(__dirname, 'LEGACY-PARITY.json'), JSON.stringify({ cases: results.length, passed: true, results }, null, 2) + '\n');
console.log(`${results.length} complete legacy-output comparisons passed`);
