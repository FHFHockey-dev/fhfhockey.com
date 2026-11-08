// Offline verification. Explicit version loading; no credentials or network fallback.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const Module = require('node:module'), ts = require(path.resolve('node_modules/typescript')), assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const base = path.resolve('../tasks/artifacts/luna-reference-package-2026-10-31');
const read = p => JSON.parse(fs.readFileSync(path.join(base, p), 'utf8'));
const paid = read('paid-evaluation/ledger.json'), paidBytes = fs.readFileSync(path.join(base, 'paid-evaluation/ledger.json'));
assert.equal(paid.enabled, false); assert.equal(Object.keys(paid.attempts).length, 2);
const receipts = Object.values(paid.attempts).map(a => a.receipt);
const frozen = read('repair-r2/rehearsal/batch.json').content.entries[0];
const priorRequests = read('repair-r2/rehearsal/requests.json').requests.filter(r => r.caseId === 'E01');
async function main() {
  const checks = [];
  for (const mode of ['baseline', 'candidate']) {
    for (const key of Object.keys(require.cache)) if (key.includes('/web/lib/sources/')) delete require.cache[key];
    if (mode === 'baseline') {
      // Archived v3 source is compiled at its original virtual location so imports
      // resolve normally; the live v4 file is never replaced or edited.
      const filename = path.resolve('lib/sources/tweetLunaReference.ts');
      const code = ts.transpileModule(fs.readFileSync(path.join(base, 'omission-diagnosis/baseline/tweetLunaReference.ts'), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true } }).outputText;
      const mod = new Module(filename, module); mod.filename = filename;
      mod.paths = Module._nodeModulePaths(path.dirname(filename)); require.cache[filename] = mod;
      mod._compile(code, filename); mod.loaded = true;
    }
    const { runRetainedTweetLunaReview } = require(path.resolve('lib/sources/tweetLunaReview'));
    const { createLunaTransport } = require(path.resolve('lib/sources/tweetLunaTransport'));
    const { openLunaLocalAdmission } = require(path.resolve('lib/sources/tweetLunaLocalStore'));
    const { scoreLunaEvaluation } = require(path.resolve('lib/sources/tweetLunaEvaluationScoring'));
    const { identityDigest } = require(path.resolve('lib/sources/playerIdentitySnapshot'));
    for (const positive of [false, true]) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-versioned-replay-offline-'));
      try {
        const file = path.join(tmp, 'SYNTHETIC-ONLY.json'), now = () => '2026-10-31T20:53:30Z', requests = [];
        fs.writeFileSync(file, JSON.stringify({ version: 'luna-local-admission-v1', approvedPolicyId: 'OFFLINE-REPLAY-NO-AUTHORITY',
          enabled: true, blockedReason: null, expiresAt: '2026-11-01T23:59:59Z', capNanoUsd: 1e9, priorExposureNanoUsd: 0, maxCalls: 2, attempts: {} }));
        const transport = createLunaTransport({ enabled: true, stopped: () => false, apiKey: () => 'offline-not-a-credential',
          admission: openLunaLocalAdmission(file, () => Date.parse(now())), fetch: async (url, init) => {
            const endpoint = String(url).endsWith('/responses') ? 'responses' : 'decisions', body = JSON.parse(init.body);
            const receipt = receipts.find(r => r.endpoint === endpoint); assert(receipt && requests.length < 2);
            requests.push({ endpoint, body, hash: identityDigest({ endpoint, body }) });
            const reply = structuredClone(receipt.body);
            if (positive && endpoint === 'responses') {
              const content = reply.output[0].content[0], proposal = JSON.parse(content.text);
              proposal.goalieStatuses = structuredClone(frozen.expected.goalie); content.text = JSON.stringify(proposal);
            }
            return new Response(JSON.stringify(reply), { headers: { 'x-request-id': receipt.requestId } });
          } });
        const review = await runRetainedTweetLunaReview({ enabled: true, input: frozen.input, transport, now });
        const saved = read(`omission-diagnosis/${mode}-replay.json`).results[positive ? 1 : 0];
        assert.deepEqual(review, saved.review); assert.deepEqual(requests, saved.requests);
        assert.deepEqual(scoreLunaEvaluation(frozen.expected, review), { identity: true, goalie: positive, decisions: true, labelMatch: positive });
        checks.push({ mode, positiveControl: positive, exactSavedResultAndRequests: true,
          samePaidRequestHashes: requests.every((r, i) => r.hash === priorRequests[i].hash),
          samePaidReview: isDeepStrictEqual(review, read('paid-evaluation/reviews/E01.json')), paidCalls: 0 });
      } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    }
  }
  assert.deepEqual(fs.readFileSync(path.join(base, 'paid-evaluation/ledger.json')), paidBytes);
  process.stdout.write(JSON.stringify({ versionSelection: 'explicit archived-v3 or current-v4 module', checks, realLedgerUnchanged: true }, null, 2) + '\n');
}
main().catch(error => { process.stderr.write(String(error) + '\n'); process.exitCode = 1; });
