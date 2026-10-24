const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const cwd = path.join(root, 'web');
const checks = {
  'author-tests': ['test', '--', '--run', '--config', '../tasks/artifacts/player-cards-2026-10-24/slice-02-review/vitest.review.config.mjs', '--configLoader', 'native', '--no-cache', 'lib/player-cards/domain.test.ts'],
  types: ['exec', '--offline', '--', 'tsc', '--noEmit', '--project', '../tasks/artifacts/player-cards-2026-10-24/slice-02/tsconfig.json'],
  lint: ['exec', '--offline', '--', 'eslint', 'lib/player-cards/windows.ts', 'lib/player-cards/aggregation.ts', 'lib/player-cards/adapter.ts', 'lib/player-cards/domain.test.ts'],
};
const name = process.argv[2];
if (!checks[name]) throw new Error('Unknown check');
const args = checks[name];
const start = new Date().toISOString();
const result = spawnSync('npm', args, { cwd, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(__dirname, 'npm-cache'), npm_config_update_notifier: 'false', npm_config_audit: 'false', npm_config_fund: 'false' }, timeout: 60000 });
const receipt = { name, command: ['npm', ...args].join(' '), cwd, start, end: new Date().toISOString(), exitCode: result.status, signal: result.signal, error: result.error?.message || null, note: 'Existing local dependencies only. Author tests run unedited with artifact-owned native ESM configuration, node environment, no setup files and cache disabled. No broad suite.' };
fs.writeFileSync(path.join(__dirname, `${name}.log`), (result.stdout || '') + (result.stderr || ''));
fs.writeFileSync(path.join(__dirname, `${name}.json`), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
console.log(result.stdout || '');
console.error(result.stderr || '');
process.exitCode = result.status ?? 1;
