// Run from web with its installed ts-node register and repository compiler options.
// Import/factory provenance only: never invoke schedule, nst, withJob or the runner.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const web = path.join(root, 'web');
const req = createRequire(path.join(web, 'package.json'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const pins = JSON.parse(fs.readFileSync(path.join(__dirname, 'ADAPTER-CHECKS.json'))).sourcePins;
if (process.cwd() !== web || process.env.NODE_PATH !== '.' || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('probe_runtime_mismatch');
if (process.env.NST_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('probe_requires_no_real_capture_environment');
const candidate = pins.filter(pin => !pin.path.endsWith('.test.ts') && !pin.path.endsWith('.tsx') && !pin.path.includes('/skoElement/'));
for (const pin of candidate) {
  const bytes = fs.readFileSync(path.join(root, pin.path));
  if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) throw new Error('candidate_pin_mismatch');
}
let attemptedNetwork = 0, attemptedWrites = 0;
const noNetwork = () => { attemptedNetwork++; throw new Error('probe_network_forbidden'); };
const noWrite = () => { attemptedWrites++; throw new Error('probe_write_forbidden'); };
globalThis.fetch = noNetwork;
for (const [module, names] of [
  ['node:http', ['request', 'get']], ['node:https', ['request', 'get']],
  ['node:net', ['connect', 'createConnection']], ['node:tls', ['connect']],
  ['node:dgram', ['createSocket']], ['node:dns', ['lookup', 'resolve']],
]) for (const name of names) require(module)[name] = noNetwork;
require('node:net').Socket.prototype.connect = noNetwork;
for (const name of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync', 'unlinkSync', 'rmSync', 'rmdirSync', 'linkSync']) fs[name] = noWrite;
for (const name of ['writeFile', 'appendFile', 'mkdir', 'rename', 'unlink', 'rm', 'rmdir', 'link']) fs.promises[name] = noWrite;

const runner = req(path.join(web, 'scripts/blsh/nativeProcessCaptureRunner.ts'));
const { createNativeProcessCaptureAdapter } = req(path.join(web, 'scripts/blsh/nativeProcessCaptureAdapter.ts'));
let missingProjectRefused = false;
const target = { supabaseOrigin: 'https://fyhftlxokyjtpndbkfse.supabase.co', lifecycleMode: 'disabled' };
try { createNativeProcessCaptureAdapter(target); }
catch (error) { missingProjectRefused = error.message === 'capture_adapter_project_changed'; }
// Synthetic child-process values are never used for transport or written to disk.
process.env.NEXT_PUBLIC_SUPABASE_URL = target.supabaseOrigin;
process.env.NST_JOB_LIFECYCLE_ENABLED = 'false';
process.env.NST_KEY = 'BLSH-IMPORT-PROBE-SYNTHETIC-NST';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'BLSH-IMPORT-PROBE-SYNTHETIC-SERVICE';
const adapter = createNativeProcessCaptureAdapter(target);
const loaded = candidate.map(pin => ({ path: pin.path, sha256: pin.sha256,
  loadedFromPinnedPath: Boolean(require.cache[path.join(root, pin.path)]) }));
const dependencies = ['ts-node', 'typescript', 'cheerio', 'memory-cache'].map(name => {
  const entry = req.resolve(name);
  const manifest = req.resolve(`${name}/package.json`);
  return { name, version: req(manifest).version, entry: path.relative(web, entry),
    entrySHA256: hash(fs.readFileSync(entry)), manifestSHA256: hash(fs.readFileSync(manifest)) };
});
const passed = missingProjectRefused && adapter.sourcePath === path.join(web, 'scripts/blsh/nativeProcessCaptureAdapter.ts')
  && typeof runner.runNativeProcessCapture === 'function' && loaded.every(pin => pin.loadedFromPinnedPath)
  && attemptedNetwork === 0 && attemptedWrites === 0;
process.stdout.write(`${JSON.stringify({ purpose: 'real_module_import_and_factory_probe_no_capture_execution',
  checkedAtUTC: new Date().toISOString(), node: process.version, execPath: process.execPath,
  execSHA256: hash(fs.readFileSync(process.execPath)), probeSHA256: hash(fs.readFileSync(__filename)),
  loader: 'ts-node/register/transpile-only', compilerOptions: JSON.parse(process.env.TS_NODE_COMPILER_OPTIONS),
  tsconfigSHA256: hash(fs.readFileSync(path.join(web, 'tsconfig.json'))),
  dependencies, loaded, missingProjectRefused, sourcePathMatchesPinnedAdapter: adapter.sourcePath === path.join(web, 'scripts/blsh/nativeProcessCaptureAdapter.ts'),
  syntheticFactoryMode: adapter.lifecycleMode, attemptedNetwork, attemptedWrites, runInvoked: false,
  providerTLSVerified: null, captureExecutionEnvironmentVerified: false, passed }, null, 2)}\n`);
if (!passed) process.exitCode = 1;
