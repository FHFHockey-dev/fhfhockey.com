const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const web = path.join(root, 'web');
const entries = {
  probes: ['node', ['counterexamples.original.cjs'], __dirname],
  capture: ['node', ['capture-reconciliation.original.cjs'], __dirname],
  tests: ['npm', ['test', '--', '--run', '--config', '../tasks/artifacts/player-cards-2026-10-24/slice-02-r1-review/vitest.review.config.mjs', '--configLoader', 'native', '--no-cache', 'lib/player-cards/domain.test.ts', 'lib/player-cards/aggregation.r1.test.ts'], web],
  types: ['npm', ['exec', '--offline', '--', 'tsc', '--noEmit', '--project', '../tasks/artifacts/player-cards-2026-10-24/slice-02-r1-review/tsconfig.json'], web],
  lint: ['npm', ['exec', '--offline', '--', 'eslint', 'lib/player-cards/aggregation.ts', 'lib/player-cards/domain.test.ts', 'lib/player-cards/aggregation.r1.test.ts'], web],
};
const name = process.argv[2];
assert.ok(entries[name]);
if (name === 'probes' || name === 'capture') {
  const original = name === 'probes' ? 'counterexamples.cjs' : 'capture-reconciliation.cjs';
  const originalPath = path.join(root, 'tasks/artifacts/player-cards-2026-10-24/slice-02-review', original);
  const copiedPath = path.join(__dirname, entries[name][1][0]);
  fs.copyFileSync(originalPath, copiedPath);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(originalPath)).digest('hex'), crypto.createHash('sha256').update(fs.readFileSync(copiedPath)).digest('hex'));
}
const [command, args, cwd] = entries[name];
const start = new Date().toISOString();
const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(__dirname, 'npm-cache'), npm_config_update_notifier: 'false', npm_config_audit: 'false', npm_config_fund: 'false' }, timeout: 60000 });
const receipt = { name, command: [command, ...args].join(' '), cwd, start, end: new Date().toISOString(), exitCode: result.status, signal: result.signal, error: result.error?.message || null, note: 'Actual source; original probes copied byte-identically at same directory depth solely to preserve original receipts. Existing local dependencies; original tests with artifact-owned Node/no-setup/no-cache native config. Types/lint scope excludes slice03.' };
fs.writeFileSync(path.join(__dirname, name + '.log'), (result.stdout || '') + (result.stderr || ''));
fs.writeFileSync(path.join(__dirname, name + '.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
console.log(result.stdout || '');
console.error(result.stderr || '');
process.exitCode = result.status ?? 1;
