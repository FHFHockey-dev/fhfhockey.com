// Offline synthetic review. No real source inputs, providers or databases.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
global.fetch = () => { throw new Error('Network forbidden in independent review'); };
const root = path.resolve(__dirname, '../../..');
const web = path.join(root, 'web');
const prior = path.join(root, 'tasks/artifacts/blsh-freshness-separation-2026-11-07');
const ts = require(path.join(web, 'node_modules/typescript'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
function load(source, imports = {}) {
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => {
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name === 'node:crypto') return crypto;
    throw new Error(`Unexpected import: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const manifest = JSON.parse(fs.readFileSync(path.join(prior, 'MANIFEST.json')));
for (const [relative, pin] of Object.entries(manifest)) {
  const actual = fs.readFileSync(path.join(root, relative));
  assert.equal(actual.length, pin.bytes, relative);
  assert.equal(sha(actual), pin.sha256, relative);
}
assert.equal(sha(fs.readFileSync(path.join(web, 'lib/nst/client.ts'))), '48d82fc40ca06d9abe4675f4a1896add55c4e53d4dee661bbe082d424c944e4f');
const input = load(fs.readFileSync(path.join(web, 'lib/buyLowSellHigh/currentInput.ts'), 'utf8'));
const gate = load(fs.readFileSync(path.join(web, 'lib/buyLowSellHigh/currentProcessEvidence.server.ts'), 'utf8'), { './currentInput': input });
const old = load(fs.readFileSync(path.join(prior, 'currentProcessEvidence.server.base.ts'), 'utf8'), { './currentInput': input });
const test = fs.readFileSync(path.join(web, 'lib/buyLowSellHigh/currentProcessEvidence.server.test.ts'), 'utf8');
const fixtureSource = test.slice(0, test.indexOf('describe("current process')).replace('import { describe, expect, it } from "vitest";', '') +
  test.slice(test.indexOf('function windowFixture'), test.indexOf('describe("source observation')) +
  '\nexport { fixture, windowFixture, RECENT_WINDOW, AT };';
const { fixture, windowFixture, RECENT_WINDOW, AT } = load(fixtureSource, { './currentInput': input, './currentProcessEvidence.server': gate });
function rebindRequest(f, change) {
  const request = JSON.parse(new TextDecoder().decode(f.requestBytes));
  change(request, f);
  f.requestBytes = bytes(request);
  f.bundle.sourceRequestSHA256 = sha(f.requestBytes);
  f.bundleBytes = bytes(f.bundle);
  f.policy.acceptances[0].requestSHA256 = sha(f.requestBytes);
  f.policy.acceptances[0].bundleSHA256 = sha(f.bundleBytes);
  return f;
}
function legacyShape(value) {
  const out = structuredClone(value);
  delete out.freshnessDiagnosticsVersion;
  delete out.capturedWindows;
  delete out.coverage.sourceObservationIndividualQualified;
  delete out.coverage.sourceObservationOnIceQualified;
  for (const row of out.records) for (const group of ['individual', 'onIce']) delete row[group].sourceObservation;
  return out;
}
const results = [];
let parityComparisons = 0;
function check(name, f, inspect) {
  const originalRequestBytes = Array.from(f.requestBytes);
  for (const at of [AT, '2026-11-02T00:00:00Z', '2026-11-03T20:00:00Z']) {
    for (const accepted of [false, true]) {
      const policy = accepted ? f.policy : undefined;
      const args = [f.requestBytes, at, f.bundleBytes, f.artifacts];
      const actual = gate.createCurrentProcessEvidenceGate(policy)(...args);
      const baseline = old.createCurrentProcessEvidenceGate(policy)(...args);
      assert.deepStrictEqual(legacyShape(actual), baseline, `${name}: complete v1 output parity`);
      parityComparisons++;
      for (const w of actual.capturedWindows) {
        assert.equal(w.completeLatestFiveEstablished, false);
        assert.equal(w.currentUseQualified, false);
        assert.ok(w.reasons.includes('latest_five_completed_appearances_not_independently_established'));
      }
      assert.equal(actual.score, null);
      assert.equal(actual.trusted, false);
      assert.equal(actual.productionAdopted, false);
    }
  }
  const out = gate.createCurrentProcessEvidenceGate(f.policy)(f.requestBytes, AT, f.bundleBytes, f.artifacts);
  inspect(out);
  assert.deepEqual(Array.from(f.requestBytes), originalRequestBytes, `${name}: caller request bytes unchanged`);
  results.push({ name, passed: true });
}

check('shuffled feeds select latest captured five without mutating caller bytes', rebindRequest(windowFixture(['2026-10-23', ...RECENT_WINDOW]), r => {
  for (const key of ['calendar', 'wgo', 'individual', 'onIce']) r[key].rows.reverse();
}), out => {
  assert.deepEqual(out.capturedWindows[0].sourceIds, [2, 3, 4, 5, 6]);
  assert.deepEqual(out.capturedWindows[0].dates, RECENT_WINDOW);
});

check('separate players cannot fill each other’s incomplete windows', windowFixture(RECENT_WINDOW, (s, i) => {
  const player = 8470001 + i % 2;
  s.request.wgo.rows[0].player_id = player;
  s.frame.playerId = player;
  for (const group of ['individual', 'onIce']) {
    s.request[group].rows[0].player_id = player;
    s.overrides[group].playerId = player;
  }
}), out => {
  assert.deepEqual(out.capturedWindows.map(w => [w.playerId, w.sourceIds]), [[8470001, [1, 3, 5]], [8470002, [2, 4]]]);
  assert.ok(out.capturedWindows.every(w => w.reasons.includes('fewer_than_five_captured_records')));
});

check('empty capture remains empty and unadmitted', rebindRequest(fixture(), (r, f) => {
  for (const key of ['calendar', 'wgo', 'individual', 'onIce']) r[key].rows = [];
  f.bundle.witnesses = [];
}), out => assert.deepEqual(out.capturedWindows, []));

check('ambiguous duplicate player dates remain counted records, never complete appearances', windowFixture(['2026-10-24', '2026-10-25', '2026-10-27', '2026-10-31', '2026-10-31']), out => {
  assert.deepEqual(out.capturedWindows[0].sourceIds, [1, 2, 3, 4, 5]);
  assert.ok(out.capturedWindows[0].reasons.includes('captured_member_identity_or_exposure_unqualified'));
  assert.equal(out.records[4].individual.sourceObservation.qualified, false);
});

check('invalid latest captured date is unknown, not silently backfilled', windowFixture(['2026-10-23', ...RECENT_WINDOW.slice(0, 4), 'not-a-date']), out => {
  assert.deepEqual(out.capturedWindows[0].sourceIds, [2, 3, 4, 5, 6]);
  assert.equal(out.capturedWindows[0].recency.state, 'unknown');
  assert.equal(out.capturedWindows[0].recency.latestEventAgeDays, null);
  assert.equal(out.capturedWindows[0].sourceObservations.individual.allMembersQualified, false);
});

check('future captured event is unknown and unqualified', windowFixture(['2026-10-24', '2026-10-25', '2026-10-27', '2026-10-31', '2026-11-02']), out => {
  assert.equal(out.capturedWindows[0].recency.state, 'unknown');
  assert.equal(out.records[4].individual.sourceObservation.qualified, false);
});

check('missing latest witness stays a selected held member', (() => {
  const f = windowFixture(['2026-10-23', ...RECENT_WINDOW]);
  f.bundle.witnesses = f.bundle.witnesses.filter(w => !(w.wgoSourceId === 6 && w.group === 'individual'));
  return rebindRequest(f, () => {});
})(), out => {
  assert.deepEqual(out.capturedWindows[0].sourceIds, [2, 3, 4, 5, 6]);
  assert.equal(out.capturedWindows[0].sourceObservations.individual.qualifiedMembers, 4);
  assert.equal(out.capturedWindows[0].sourceObservations.onIce.qualifiedMembers, 5);
  assert.ok(out.records[5].individual.sourceObservation.reasons.includes('no_exact_row_witness'));
});

check('zero day policy keeps source observations separate from row and window recency', rebindRequest(windowFixture(RECENT_WINDOW), r => {
  r.freshnessPolicy.maxEventAgeDays = 0;
}), out => {
  assert.equal(out.coverage.individualQualified, 0);
  assert.equal(out.coverage.sourceObservationIndividualQualified, 5);
  assert.equal(out.capturedWindows[0].recency.state, 'stale');
});

check('unaccepted native bytes cannot gain source qualification through fresh windows', (() => {
  const f = windowFixture(RECENT_WINDOW);
  f.policy.acceptances = [];
  return f;
})(), out => {
  assert.equal(out.capturedWindows[0].recency.state, 'recent');
  assert.equal(out.coverage.sourceObservationIndividualQualified, 0);
  assert.equal(out.coverage.sourceObservationOnIceQualified, 0);
});

const report = { syntheticOnly: true, passed: true, checkedManifestEntries: Object.keys(manifest).length, independentCases: results.length,
  completeLegacyOutputComparisons: parityComparisons, results, providerRequests: 0, databaseOperations: 0, realAcceptancesAdded: 0 };
fs.writeFileSync(path.join(__dirname, 'RESULT.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
