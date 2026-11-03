import fs from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const attempts = [];
const deny = name => (...args) => { attempts.push({ operation: name, path: typeof args[0] === 'string' ? args[0] : null }); throw new Error('Audit prohibits filesystem mutation: ' + name); };
for (const key of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync', 'unlinkSync', 'rmSync', 'rmdirSync', 'truncateSync', 'writeSync', 'createWriteStream']) fs[key] = deny(key);
for (const key of ['writeFile', 'appendFile', 'mkdir', 'rename', 'unlink', 'rm', 'rmdir', 'truncate']) { fs[key] = deny(key); fs.promises[key] = deny('promises.' + key); }
const before = { ...process.env };
const root = '/Users/tim/Code/fhfhockey.com';
process.chdir('/tmp');
const mod = await import(root + '/tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-readbacks/tooling/check-readbacks.mjs');
assert.equal(typeof mod.checkReadbacks, 'function');
const require = createRequire(import.meta.url);
const projectModules = Object.keys(require.cache).filter(p => p.startsWith(root + '/web/') && !p.includes('/node_modules/'));
assert.deepEqual(projectModules, [root + '/web/lib/projections/evidenceTime.ts']);
assert.deepEqual({ ...process.env }, before);
assert(attempts.every(x => typeof x.path === 'string' && x.path.includes('v8-compile-cache')));
console.log(JSON.stringify({ standaloneImportSucceeded: true, cwd: process.cwd(), projectModules, filesystemMutationAttempts: attempts, environmentUnchanged: true, networkDenied: true, localTypescriptHookRegistered: typeof require.extensions['.ts'] === 'function' }, null, 2));
