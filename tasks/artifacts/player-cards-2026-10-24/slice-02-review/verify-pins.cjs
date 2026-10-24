const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const packet = 'tasks/artifacts/player-cards-2026-10-24/slice-02';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const evidence = JSON.parse(fs.readFileSync(path.join(root, packet, 'EVIDENCE.json')));
const pins = [...evidence.source_files, ...evidence.artifacts, ...evidence.read_only_source_dependencies, evidence.local_evidence_source];
const checks = pins.map(pin => {
  const bytes = fs.readFileSync(path.join(root, pin.path));
  return { path: pin.path, expectedSha256: pin.sha256, actualSha256: sha(bytes), expectedSize: pin.size_bytes, actualSize: bytes.length, passed: sha(bytes) === pin.sha256 && bytes.length === pin.size_bytes };
});
const result = { at: new Date().toISOString(), evidenceSha256: sha(fs.readFileSync(path.join(root, packet, 'EVIDENCE.json'))), node: process.version, checks, passed: checks.every(check => check.passed), scope: 'Four sources, three direct dependencies, fourteen listed author artifacts, and prior capture; excludes slice01 UI/TestingGrounds. No Git.' };
const phase = process.argv[2] || 'initial';
if (!['initial', 'final'].includes(phase)) throw new Error('Invalid phase');
fs.writeFileSync(path.join(__dirname, `pins-${phase}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ phase, passed: result.passed, matched: checks.filter(x => x.passed).length, total: checks.length, changed: checks.filter(x => !x.passed) }));
process.exitCode = result.passed ? 0 : 1;
