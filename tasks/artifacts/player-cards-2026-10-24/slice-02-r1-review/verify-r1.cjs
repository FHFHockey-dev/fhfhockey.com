const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../..');
const base = 'tasks/artifacts/player-cards-2026-10-24/';
const read = file => fs.readFileSync(path.join(root, file));
const json = file => JSON.parse(read(file));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const r1 = json(base + 'slice-02-r1/EVIDENCE.json');
const original = json(base + 'slice-02/EVIDENCE.json');
const priorReview = json(base + 'slice-02-review/EVIDENCE.json');
const priorPins = json(base + 'slice-02-review/pins-final.json');
const pins = [
  ...r1.source_files, ...r1.artifacts,
  ...original.artifacts,
  { path: base + 'slice-02/EVIDENCE.json', sha256: priorPins.evidenceSha256 },
  ...priorReview.files.map(file => ({ path: base + 'slice-02-review/' + file.path, sha256: file.sha256, size_bytes: file.sizeBytes })),
  ...original.source_files.filter(file => /\/(windows|adapter)\.ts$/.test(file.path)),
  ...original.read_only_source_dependencies, original.local_evidence_source,
];
const checks = pins.map(pin => {
  const actual = read(pin.path);
  return { path: pin.path, sha256: sha(actual), expectedSha256: pin.sha256, passed: sha(actual) === pin.sha256 && (pin.size_bytes === undefined || actual.length === pin.size_bytes) };
});
for (const name of ['aggregation.ts', 'domain.test.ts']) {
  const expected = original.source_files.find(file => file.path.endsWith('/' + name)).sha256;
  assert.equal(sha(read(base + 'slice-02-r1/baseline/' + name)), expected);
}
// Apply the supplied unified patch entirely in memory against verified originals.
const sections = read(base + 'slice-02-r1/source.patch').toString().trimEnd().split(/\n(?=--- )/);
const patchChecks = [];
for (const section of sections) {
  const lines = section.split('\n');
  const oldPath = lines.shift().slice(4), target = lines.shift().slice(4);
  assert.ok(['web/lib/player-cards/aggregation.ts', 'web/lib/player-cards/domain.test.ts', 'web/lib/player-cards/aggregation.r1.test.ts'].includes(target));
  const baseline = oldPath === '/dev/null' ? '' : read(base + 'slice-02-r1/baseline/' + path.basename(oldPath)).toString();
  const originalLines = baseline ? baseline.trimEnd().split('\n') : [];
  let cursor = 0;
  const out = [];
  for (const line of lines) {
    if (line.startsWith('@@ ')) {
      const match = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/.exec(line); assert.ok(match);
      const start = Math.max(0, Number(match[1]) - 1);
      while (cursor < start) out.push(originalLines[cursor++]);
    } else if (line.startsWith(' ') || line.startsWith('-')) {
      assert.equal(originalLines[cursor++], line.slice(1));
      if (line.startsWith(' ')) out.push(line.slice(1));
    } else if (line.startsWith('+')) out.push(line.slice(1));
    else throw new Error('Unexpected patch line');
  }
  while (cursor < originalLines.length) out.push(originalLines[cursor++]);
  // Preserve the untouched original trailing newline/blank lines exactly.
  const suffix = baseline ? baseline.slice(baseline.trimEnd().length) : '\n';
  const reconstructed = out.join('\n') + suffix;
  assert.equal(reconstructed, read(target).toString());
  patchChecks.push({ path: target, exactReconstruction: true });
}
assert.equal(patchChecks.length, 3);
const originalProbe = read(base + 'slice-02-review/counterexamples.cjs');
assert.equal(sha(originalProbe), sha(read(base + 'slice-02-r1/counterexamples.original.cjs')));
const phase = process.argv[2] || 'initial';
assert.ok(['initial', 'final'].includes(phase));
const result = { phase, at: new Date().toISOString(), passed: checks.every(check => check.passed), checks, patchChecks, originalProbeSha256: sha(originalProbe), authorR1EvidenceSha256: sha(read(base + 'slice-02-r1/EVIDENCE.json')), originalReviewEvidenceSha256: sha(read(base + 'slice-02-review/EVIDENCE.json')), note: 'Only slice02 scope; no duplicate slice01 UI review. All patch reconstruction is in memory.' };
fs.writeFileSync(path.join(__dirname, `pins-${phase}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ phase, passed: result.passed, matched: checks.filter(x => x.passed).length, total: checks.length, exactPatchFiles: patchChecks.length, changed: checks.filter(x => !x.passed) }));
process.exitCode = result.passed ? 0 : 1;
