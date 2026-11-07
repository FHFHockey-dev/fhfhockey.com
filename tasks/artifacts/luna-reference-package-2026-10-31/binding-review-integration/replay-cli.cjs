const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const base = path.resolve("../tasks/artifacts/luna-reference-package-2026-10-31");
const dir = path.join(base, "binding-review-integration");
const read = name => JSON.parse(fs.readFileSync(path.join(base, name), "utf8"));
const digest = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sha = name => crypto.createHash("sha256").update(fs.readFileSync(path.join(base, name))).digest("hex");
const start = read("binding-review-integration/START-PINS.json"), ledger = read("paid-evaluation/ledger.json");
assert.equal(sha("paid-evaluation/ledger.json"), start.realLedgerSha256);
assert.equal(ledger.enabled, false); assert.equal(Object.keys(ledger.attempts).length, 4);
const results = [];
for (const [id, prep, prior] of [["E02", "continuation-v4", "continuation-execution"], ["E03", "continuation-v4-e03", "continuation-e03-execution"]]) {
  const outputDir = path.join(dir, `replay-${id}`); fs.mkdirSync(outputDir);
  const entry = read(`${prep}/PACKETS.json`).entries[0], wire = read(`${prep}/REQUESTS.json`).requests[0];
  assert.equal(entry.id, id);
  const requestHash = digest({ endpoint: "responses", body: wire.body }), receipt = ledger.attempts[requestHash].receipt;
  const fixturePath = path.join(outputDir, "SAVED-RECEIPT-FIXTURE.json"), callLog = path.join(outputDir, "mock-calls.json");
  fs.writeFileSync(fixturePath, JSON.stringify({ requestBody: wire.body, requestHash, receipt }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "luna-cli-binding-offline-"));
  try {
    const syntheticLedger = path.join(temp, "SYNTHETIC-ONLY-ledger.json");
    fs.writeFileSync(syntheticLedger, JSON.stringify({ version: "luna-local-admission-v1", approvedPolicyId: "OFFLINE-REPLAY-NO-PAID-AUTHORITY",
      enabled: true, blockedReason: null, expiresAt: "2099-01-01T00:00:00Z", capNanoUsd: 1_000_000_000, priorExposureNanoUsd: 0, maxCalls: 1, attempts: {} }));
    const result = spawnSync(process.execPath, ["--experimental-require-module", "-r", "ts-node/register/transpile-only", "-r", path.join(dir, "mock-receipt.cjs"),
      "scripts/review-ifttt-luna.ts", "--input", path.join(base, prep, "inputs", `${id}.json`), "--output", path.join(outputDir, "original-review.json"),
      "--binding-candidate-output", path.join(outputDir, "binding-candidate.json"), "--dispatch", "--ledger", syntheticLedger], {
      encoding: "utf8", env: { PATH: process.env.PATH, TMPDIR: os.tmpdir(), NODE_PATH: ".", NODE_ENV: "test",
        NODE_OPTIONS: `--require=${path.join(base, "deny-network.cjs")}`, TS_NODE_COMPILER_OPTIONS: '{"module":"CommonJS","moduleResolution":"node","allowJs":false}',
        OPENAI_API_KEY: "offline-not-a-credential", IFTTT_LUNA_REVIEW_ENABLED: "true", IFTTT_LUNA_REVIEW_STOP: "false",
        LUNA_REPLAY_RESPONSE: fixturePath, LUNA_REPLAY_CALLLOG: callLog } });
    fs.writeFileSync(path.join(outputDir, "cli.log"), result.stdout + result.stderr, { flag: "wx" });
    assert.equal(result.status, 2, result.stdout + result.stderr);
    const original = JSON.parse(fs.readFileSync(path.join(outputDir, "original-review.json"), "utf8"));
    assert.deepEqual(original, read(`${prior}/reviews/${id}.json`));
    const candidate = JSON.parse(fs.readFileSync(path.join(outputDir, "binding-candidate.json"), "utf8")), c = candidate.content;
    assert.equal(candidate.hash, digest(c)); assert.equal(c.originalReviewHash, digest(original));
    assert.deepEqual(c.receipt, receipt); assert.equal(c.receiptHash, digest(receipt));
    assert.equal(c.derivation.rawOutputText, receipt.body.output[0].content[0].text);
    assert.equal(c.derivation.corrections[0].proposed.end, id === "E02" ? 40 : 46);
    assert.equal(c.sourcePolicy.source.sourceTextVersionId, entry.input.packet.source.sourceTextVersionId);
    assert.equal(c.canApply, false); assert.equal(c.derivation.candidate.goalieStatuses[0].verified, false);
    assert.equal(original.status, "held"); assert.equal(original.goalieStatuses.length, 0);
    const calls = JSON.parse(fs.readFileSync(callLog, "utf8")); assert.equal(calls.mockCalls, 1); assert.equal(calls.actualProviderRequests, 0);
    results.push({ id, cliExit: result.status, originalReviewReproducedExactly: true, originalFailurePreserved: true,
      separateBoundCandidate: true, candidateHash: candidate.hash, proposedEnd: c.derivation.corrections[0].proposed.end,
      mockCalls: 1, actualProviderRequests: 0, humanDecision: "not_recorded" });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
assert.equal(sha("paid-evaluation/ledger.json"), start.realLedgerSha256);
const output = { version: "luna-binding-cli-offline-replay-v1", actualProviderRequests: 0, credentialsUsed: "synthetic literal only",
  realLedgerUnchanged: true, historicalGradesUnchanged: true, results };
fs.writeFileSync(path.join(dir, "OFFLINE-CLI-REPLAY.json"), JSON.stringify(output, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify(output, null, 2) + "\n");
