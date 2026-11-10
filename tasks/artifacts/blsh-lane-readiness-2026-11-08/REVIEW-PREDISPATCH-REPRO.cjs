// Frozen-candidate reproduction. Real adapter/client/lifecycle, synthetic fetch,
// in-memory local-budget substitution. No provider, database or ledger access.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const web = path.join(root, 'web');
const req = createRequire(path.join(web, 'package.json'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pins = JSON.parse(fs.readFileSync(path.join(__dirname, 'ADAPTER-CHECKS.json'))).sourcePins;
for (const pin of pins) if (sha(fs.readFileSync(path.join(root, pin.path))) !== pin.sha256) throw new Error('frozen_candidate_changed');
if (process.env.NST_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('synthetic_environment_required');
const noNetwork = () => { throw new Error('real_network_forbidden'); };
for (const [name, methods] of [['node:http', ['request', 'get']], ['node:https', ['request', 'get']], ['node:net', ['connect', 'createConnection']], ['node:tls', ['connect']]])
  for (const method of methods) require(name)[method] = noNetwork;
require('node:net').Socket.prototype.connect = noNetwork;
const budget = req(path.join(web, 'lib/nst/requestBudget.ts'));
budget.withNstRequestBudget = async (_url, control, dispatch) => { control.attemptsStarted++; return dispatch(); };
const { runNativeProcessCapture } = req(path.join(web, 'scripts/blsh/nativeProcessCaptureRunner.ts'));
const { createNativeProcessCaptureAdapter } = req(path.join(web, 'scripts/blsh/nativeProcessCaptureAdapter.ts'));
const { prepareNativeProcessCapture } = req(path.join(web, 'scripts/blsh/nativeProcessCapturePreparation.ts'));
const origin = 'https://fyhftlxokyjtpndbkfse.supabase.co';
process.env.NST_KEY = 'SYNTHETIC-PREDISPATCH-NST';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'SYNTHETIC-PREDISPATCH-SERVICE';
process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
process.env.NST_JOB_LIFECYCLE_ENABLED = 'false';
const rolePaths = { runner: 'scripts/blsh/nativeProcessCaptureRunner.ts', preparation: 'scripts/blsh/nativeProcessCapturePreparation.ts',
  adapter: 'scripts/blsh/nativeProcessCaptureAdapter.ts', client: 'lib/nst/client.ts', budget: 'lib/nst/requestBudget.ts',
  admission: 'lib/nst/sharedAdmission.ts', admissionOrigin: 'lib/nst/admissionOrigin.ts', lifecycle: 'lib/nst/jobLifecycle.server.ts', ratePolicy: 'lib/cron/nstRateLimitPolicy.ts' };
const sourceSHA256 = Object.fromEntries(Object.entries(rolePaths).map(([role, file]) => [role, sha(fs.readFileSync(path.join(web, file)))]));
const response = (body, url) => { const value = new Response(body); Object.defineProperty(value, 'url', { value: url }); return value; };
const schedule = JSON.stringify({ gameWeek: [{ date: '2026-11-07', games: [{ id: 2026020201, season: 20262027, gameType: 2,
  gameState: 'OFF', gameScheduleState: 'OK', homeTeam: { id: 1, abbrev: 'NJD' }, awayTeam: { id: 2, abbrev: 'NYI' } }] }] });
const original = { open: fs.openSync, close: fs.closeSync, sync: fs.fsyncSync, now: Date.now };
const reports = [];
async function test(kind) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'blsh-predispatch-repro-'));
  const paths = new Map(), calls = [];
  let delayed = false, offset = 0, admissionAt;
  Date.now = () => original.now() + offset;
  const startedAt = Date.now();
  fs.openSync = (file, ...args) => { const fd = original.open(file, ...args); paths.set(fd, String(file)); return fd; };
  fs.closeSync = fd => { paths.delete(fd); return original.close(fd); };
  fs.fsyncSync = fd => {
    original.sync(fd);
    if (!delayed && paths.get(fd)?.endsWith('operation-3-STARTED.json')) {
      delayed = true;
      if (kind === 'permit_expired_during_durable_write') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
      else offset += 121000;
    }
  };
  globalThis.fetch = async target => {
    const url = String(target), host = new URL(url).hostname;
    if (host === 'api-web.nhle.com') { calls.push('schedule'); return response(schedule, url); }
    if (host === 'fyhftlxokyjtpndbkfse.supabase.co') {
      calls.push('admission'); admissionAt = Date.now();
      return response(JSON.stringify({ version: 1, scope: 'global-nst', permitTtlMs: 1000, allowed: true, waitMs: 0 }), url);
    }
    if (host === 'data.naturalstattrick.com') {
      calls.push('provider');
      reports.push({ kind, calls: [...calls], delayInjected: delayed, providerAfterAdmissionMs: Date.now() - admissionAt,
        providerAfterRunStartMs: Date.now() - startedAt, providerDispatched: true });
      throw new Error('synthetic_stop_after_observation');
    }
    throw new Error('unexpected_mock_target');
  };
  try {
    const input = { plan: prepareNativeProcessCapture({ seasonId: 20262027, date: '2026-11-07', plannedAtUTC: new Date().toISOString(), groups: ['individual', 'onIce'] }),
      supabaseOrigin: origin, lifecycleMode: 'disabled', sourceSHA256 };
    try { await runNativeProcessCapture(input, createNativeProcessCaptureAdapter(input), path.join(temp, 'packet')); }
    catch (error) { if (error.message !== 'native_capture_incomplete_see_retained_packet') throw error; }
    if (!reports.some(item => item.kind === kind)) reports.push({ kind, calls, delayInjected: delayed, providerDispatched: false });
  } finally {
    Date.now = original.now; fs.openSync = original.open; fs.closeSync = original.close; fs.fsyncSync = original.sync;
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
(async () => {
  await test('permit_expired_during_durable_write');
  await test('deadline_passed_during_durable_write');
  process.stdout.write(`${JSON.stringify({ checkedAtUTC: new Date().toISOString(), probeSHA256: sha(fs.readFileSync(__filename)),
    runnerSHA256: sourceSHA256.runner, adapterSHA256: sourceSHA256.adapter, tests: reports, realNetworkRequests: 0, realLedgerOperations: 0 }, null, 2)}\n`);
})().catch(() => { process.stderr.write('reproduction_failed\n'); process.exitCode = 1; });
