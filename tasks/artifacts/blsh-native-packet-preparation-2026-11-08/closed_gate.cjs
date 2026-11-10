// Offline canonical hashing and default-closed replay. No policy input is accepted.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'web/node_modules/typescript'));
const pins = require('./SOURCE-PINS.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const deny = () => { throw new Error('offline_network_denied'); };
globalThis.fetch = deny;
for (const name of ['node:http', 'node:https']) {
  const mod = require(name); mod.request = deny; mod.get = deny;
}
const net = require('node:net');
net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny;
require('node:tls').connect = deny;

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const pin = pins[name];
  if (!pin || !['currentInput', 'gate'].includes(name)) throw new Error('unlisted_source');
  const bytes = fs.readFileSync(path.join(root, pin.path));
  if (sha(bytes) !== pin.sha256) throw new Error('canonical_source_drift');
  const module = { exports: {} };
  const code = ts.transpileModule(bytes.toString('utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const requirePure = dependency => {
    if (dependency === 'node:crypto') return crypto;
    if (dependency === './currentInput') return load('currentInput');
    throw new Error('unexpected_gate_dependency');
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: requirePure,
    TextEncoder, TextDecoder, Uint8Array, structuredClone, URL }, { timeout: 5000 });
  cache.set(name, module.exports);
  return module.exports;
}

function replay(input) {
  const requestBytes = Buffer.from(input.requestBase64, 'base64');
  if (!requestBytes.length || requestBytes.length > 32 * 1024 * 1024) throw new Error('request_byte_bound');
  const request = JSON.parse(requestBytes.toString('utf8'));
  const bundle = input.bundleBase64 ? Buffer.from(input.bundleBase64, 'base64') : null;
  const { createCurrentProcessEvidenceGate, processEvidenceRowSHA256, CLOSED_PROCESS_EVIDENCE_POLICY } = load('gate');
  if (CLOSED_PROCESS_EVIDENCE_POLICY.acceptances.length) throw new Error('default_policy_changed');
  const result = createCurrentProcessEvidenceGate()(requestBytes, input.evaluatedAtUTC, bundle);
  if (result.coverage.individualQualified || result.coverage.onIceQualified || result.score !== null || result.trusted || result.productionAdopted) {
    throw new Error('closed_policy_invariant_failed');
  }
  const hashes = Object.fromEntries(['wgo', 'individual', 'onIce'].map(group => [group,
    (request[group]?.rows ?? []).map(row => ({ id: row.id, sha256: processEvidenceRowSHA256(row) }))]));
  return { hashes, replay: {
    evaluatedAtUTC: input.evaluatedAtUTC, sourceRequestAsOfUTC: result.sourceRequestAsOfUTC,
    sourceRequestSHA256: sha(requestBytes), bundleSHA256: bundle ? sha(bundle) : null,
    defaultPolicyAcceptedBundles: 0, coverage: result.coverage, capturedWindows: result.capturedWindows,
    rowDecisions: result.records.map(row => ({ sourceId: row.record.id,
      individual: { qualified: row.individual.qualified, reasons: row.individual.provenance.reasons },
      onIce: { qualified: row.onIce.qualified, reasons: row.onIce.provenance.reasons } })),
    score: null, trusted: false, productionAdopted: false, networkRequests: 0,
  } };
}

if (require.main === module) {
  try {
    const parts = []; let size = 0; const chunk = Buffer.alloc(64 * 1024);
    while (true) {
      const count = fs.readSync(0, chunk, 0, chunk.length, null);
      if (!count) break;
      size += count; if (size > 56 * 1024 * 1024) throw new Error('bridge_input_bound');
      parts.push(Buffer.from(chunk.subarray(0, count)));
    }
    process.stdout.write(JSON.stringify(replay(JSON.parse(Buffer.concat(parts).toString('utf8')))));
  } catch {
    process.stderr.write('closed_gate_replay_failed\n'); process.exitCode = 1;
  }
}

// Tests can exercise a synthetic reviewer policy without adding a policy CLI.
module.exports = { replay, loadGate: () => load('gate') };
