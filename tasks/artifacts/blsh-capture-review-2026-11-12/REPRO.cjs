// Offline independent review. Only synthetic responses and an in-memory budget.
// Run from web/: NODE_PATH=. node ../tasks/artifacts/blsh-capture-review-2026-11-12/REPRO.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const web = path.join(root, 'web');
const req = createRequire(path.join(web, 'package.json'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pins = JSON.parse(fs.readFileSync(path.join(root, 'tasks/artifacts/blsh-lane-readiness-2026-11-08/ADAPTER-CHECKS.json'))).sourcePins;
const rolePaths = {
  runner: 'scripts/blsh/nativeProcessCaptureRunner.ts', preparation: 'scripts/blsh/nativeProcessCapturePreparation.ts',
  adapter: 'scripts/blsh/nativeProcessCaptureAdapter.ts', client: 'lib/nst/client.ts', budget: 'lib/nst/requestBudget.ts',
  admission: 'lib/nst/sharedAdmission.ts', admissionOrigin: 'lib/nst/admissionOrigin.ts',
  lifecycle: 'lib/nst/jobLifecycle.server.ts', ratePolicy: 'lib/cron/nstRateLimitPolicy.ts',
};
for (const file of Object.values(rolePaths)) {
  const pin = pins.find(item => item.path === `web/${file}`);
  if (!pin || hash(fs.readFileSync(path.join(web, file))) !== pin.sha256) throw new Error('capture_source_pin_changed');
}
if (process.env.NST_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('synthetic_environment_required');
let realNetworkAttempts = 0;
const noNetwork = () => { realNetworkAttempts++; throw new Error('real_network_forbidden'); };
for (const [name, methods] of [['node:http', ['request', 'get']], ['node:https', ['request', 'get']], ['node:net', ['connect', 'createConnection']], ['node:tls', ['connect']]]) {
  for (const method of methods) require(name)[method] = noNetwork;
}
require('node:net').Socket.prototype.connect = noNetwork;
globalThis.fetch = noNetwork;
req('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } });
const budget = req(path.join(web, 'lib/nst/requestBudget.ts'));
const actualBudget = budget.withNstRequestBudget;
let memoryLedger, memoryBudgetTransactions;
budget.withNstRequestBudget = (url, control, start) => actualBudget(url, control, start, {
  transaction(update) { memoryBudgetTransactions++; return update(memoryLedger, () => {}); },
});
const { runNativeProcessCapture } = req(path.join(web, 'scripts/blsh/nativeProcessCaptureRunner.ts'));
const { createNativeProcessCaptureAdapter } = req(path.join(web, 'scripts/blsh/nativeProcessCaptureAdapter.ts'));
const { prepareNativeProcessCapture } = req(path.join(web, 'scripts/blsh/nativeProcessCapturePreparation.ts'));
const origin = 'https://fyhftlxokyjtpndbkfse.supabase.co';
process.env.NST_KEY = 'synthetic-review-nst';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-review-service';
process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
const sourceSHA256 = Object.fromEntries(Object.entries(rolePaths).map(([role, file]) => [role, hash(fs.readFileSync(path.join(web, file)))]));
const response = (body, url) => { const value = new Response(body); Object.defineProperty(value, 'url', { value: url }); return value; };
const schedule = JSON.stringify({ gameWeek: [{ date: '2026-11-07', games: [{ id: 2026020201, season: 20262027,
  gameType: 2, gameState: 'OFF', gameScheduleState: 'OK', homeTeam: { id: 1, abbrev: 'NJD' }, awayTeam: { id: 2, abbrev: 'NYI' } }] }] });
const original = { open: fs.openSync, close: fs.closeSync, sync: fs.fsyncSync, now: Date.now,
  performanceNow: performance.now.bind(performance), performanceDescriptor: Object.getOwnPropertyDescriptor(performance, 'now') };
const reports = [];
async function probe(kind) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'blsh-independent-review-'));
  const packet = path.join(temp, 'packet');
  const descriptors = new Map(), events = [], calls = [];
  let wallOffset = 0, monotonicOffset = 0, injected = false;
  memoryLedger = { version: 1, attempts: [] }; memoryBudgetTransactions = 0;
  const mode = kind === 'journal_before_begin' ? 'enabled' : 'disabled';
  process.env.NST_JOB_LIFECYCLE_ENABLED = mode === 'enabled' ? 'true' : 'false';
  Date.now = () => original.now() + wallOffset;
  Object.defineProperty(performance, 'now', { configurable: true, value: () => original.performanceNow() + monotonicOffset });
  const monotonicStart = performance.now();
  fs.openSync = (file, ...args) => {
    const fd = original.open(file, ...args); descriptors.set(fd, String(file));
    if (String(file).startsWith(packet)) events.push({ type: 'open', file: path.relative(temp, String(file)) });
    return fd;
  };
  fs.closeSync = fd => { descriptors.delete(fd); return original.close(fd); };
  fs.fsyncSync = fd => {
    original.sync(fd);
    const file = descriptors.get(fd);
    if (file?.startsWith(packet)) events.push({ type: 'fsync', file: path.relative(temp, file) });
    if (injected) return;
    if (kind === 'forward_clock_spacing' && file === packet && fs.existsSync(path.join(packet, 'individual.TRANSPORT-OBSERVATION.json'))) {
      injected = true; wallOffset += 22000;
    }
    if (kind === 'whole_run_monotonic_expiry' && file?.endsWith('source-ratePolicy.ts')) {
      injected = true; monotonicOffset += 121000;
    }
    if (kind.startsWith('corrected_') && file?.endsWith('operation-3-STARTED.json')) {
      injected = true;
      const elapsed = kind === 'corrected_permit_fence' ? 1001 : 121001;
      wallOffset += elapsed; monotonicOffset += elapsed;
    }
  };
  globalThis.fetch = async (target, init = {}) => {
    const url = String(target), parsed = new URL(url);
    let operation;
    if (parsed.hostname === 'api-web.nhle.com') operation = 'schedule';
    else if (parsed.hostname === 'data.naturalstattrick.com') operation = parsed.searchParams.get('stdoi') === 'std' ? 'nst:individual' : 'nst:onIce';
    else if (parsed.origin === origin) operation = parsed.pathname.split('/').at(-1);
    else throw new Error('unexpected_mock_target');
    const started = events.findLastIndex(e => e.type === 'fsync' && /operation-\d+-STARTED\.json$/.test(e.file));
    const lastDirectorySync = events.findLastIndex(e => e.type === 'fsync' && e.file === 'packet');
    calls.push({ operation, wall: Date.now(), monotonic: performance.now(), monotonicSinceStartMs: performance.now() - monotonicStart,
      startedFileFsynced: started >= 0, packetDirectoryFsyncedAfterStartedFile: lastDirectorySync > started,
      startedFile: events[started]?.file });
    if (operation === 'schedule') {
      if (kind === 'whole_run_monotonic_expiry') throw new Error('stop_after_observed_expired_dispatch');
      return response(schedule, url);
    }
    if (operation === 'nst_job_begin_v1') throw new Error('stop_after_observed_begin_dispatch');
    if (operation.startsWith('nst_admit_')) return response(JSON.stringify({ version: 1, scope: 'global-nst', permitTtlMs: 1000, allowed: true, waitMs: 0 }), url);
    if (operation === 'nst:individual') return response('<table><tr><td>synthetic player</td></tr></table>', url);
    if (operation === 'nst:onIce') throw new Error('stop_after_observed_second_dispatch');
    throw new Error('unexpected_mock_operation');
  };
  try {
    const input = { plan: prepareNativeProcessCapture({ seasonId: 20262027, date: '2026-11-07', plannedAtUTC: new Date().toISOString(), groups: ['individual', 'onIce'] }),
      supabaseOrigin: origin, lifecycleMode: mode, sourceSHA256 };
    let outcome = 'unexpected_success';
    try { await runNativeProcessCapture(input, createNativeProcessCaptureAdapter(input), packet); }
    catch (error) { outcome = error.message; }
    const providers = calls.filter(call => call.operation.startsWith('nst:'));
    const failed = fs.existsSync(path.join(packet, 'FAILED.json')) ? JSON.parse(fs.readFileSync(path.join(packet, 'FAILED.json'))) : null;
    reports.push({ kind, outcome, injected, calls, memoryBudgetTransactions,
      providerCount: providers.length,
      providerSpacingWallMs: providers.length === 2 ? providers[1].wall - providers[0].wall : null,
      providerSpacingMonotonicMs: providers.length === 2 ? providers[1].monotonic - providers[0].monotonic : null,
      completionManifestExists: fs.existsSync(path.join(packet, 'MANIFEST.json')),
      failureReceiptExists: !!failed,
      attemptedOperationStates: failed?.operations.map(({ operation, state }) => ({ operation, state })),
      note: 'Clock changes are injected fixtures; no real elapsed 121-second wait and no crash/power-cut simulation.' });
  } finally {
    Date.now = original.now; fs.openSync = original.open; fs.closeSync = original.close; fs.fsyncSync = original.sync;
    if (original.performanceDescriptor) Object.defineProperty(performance, 'now', original.performanceDescriptor);
    else delete performance.now;
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
(async () => {
  for (const kind of ['corrected_permit_fence', 'corrected_work_fence', 'journal_before_begin', 'forward_clock_spacing', 'whole_run_monotonic_expiry']) await probe(kind);
  if (realNetworkAttempts !== 0) throw new Error('unexpected_network_attempt');
  process.stdout.write(JSON.stringify({ checkedAtUTC: new Date().toISOString(), node: process.version, probeSHA256: hash(fs.readFileSync(__filename)),
    sourceSHA256, realNetworkAttempts, realLedgerOperations: 0, reports }, null, 2) + '\n');
})().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
