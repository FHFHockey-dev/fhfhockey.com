import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, openSync, closeSync, fsyncSync, renameSync, unlinkSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { classifyDiagnosticReport } from "./diagnostic-policy";
import { prepareDiagnosticCheckpoint, verifyDiagnosticHistory, serializeDiagnosticArtifact, type DiagnosticCheckpointAnchor } from "./diagnostic-checkpoint";

// Offline integration of the unchanged, actual CLI. Only synthetic fetch fixtures
// and disposable ledgers are supplied; no env-file loader or paid mode exists here.
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path) as unknown as Uint8Array).digest("hex");
function durableSave(path: string, value: unknown) {
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, serializeDiagnosticArtifact(value)); fsyncSync(fd); } finally { closeSync(fd); }
  const folder = openSync(dirname(path), "r"); try { fsyncSync(folder); } finally { closeSync(folder); }
}
function stopLedger(path: string, reason: string) {
  const lock = `${path}.lock`, lockFd = openSync(lock, "wx", 0o600);
  try {
    const ledger = read(path); ledger.enabled = false; ledger.blockedReason ??= reason;
    const pending = `${path}.stop`; durableSave(pending, ledger); renameSync(pending, path);
    const folder = openSync(dirname(path), "r"); try { fsyncSync(folder); } finally { closeSync(folder); }
  } finally { closeSync(lockFd); unlinkSync(lock); }
}

async function main() {
  const compare = process.argv.length === 3 && process.argv[2] === "--compare";
  assert(process.argv.length === 2 || compare, "only_offline_compare_supported");
  const root = resolve(".."), base = join(root, "tasks/artifacts/luna-reference-package-2026-10-31"), dir = join(base, "diagnostic-e07-e16-r2");
  const emitBytes = (name: string, bytes: Buffer) => {
    const path = join(dir, name);
    if (compare) assert.deepEqual(readFileSync(path), bytes, name);
    else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes as unknown as Uint8Array, { flag: "wx", mode: 0o600 }); }
  };
  const emit = (name: string, value: unknown) => emitBytes(name, Buffer.from(serializeDiagnosticArtifact(value)));
  const plan = read(join(dir, "PLAN.json"));
  assert.equal(sha(join(dir, "PLAN.json")), "af1499f51ffd1baba22aee3fbefd20a0bc1919b12bbc972289bcf0f7d5d431b5");
  for (const [file, hash] of Object.entries(plan.applicationPins)) assert.equal(sha(join(root, file)), hash);
  for (const [file, hash] of Object.entries(plan.basePins.cliPathPins)) assert.equal(sha(join(dir, file)), hash);
  const paidPath = join(root, plan.basePins.realLedgerPath), paidBefore = readFileSync(paidPath);
  assert.equal(sha(paidPath), plan.basePins.realLedgerSha256);
  const original = read(paidPath); assert.equal(original.enabled, false); assert.equal(Object.keys(original.attempts).length, 7);
  const packets = read(join(dir, "PACKETS.json")), wire = read(join(dir, "REQUESTS.json"));
  assert.equal(sha(join(dir, "PACKETS.json")), plan.basePins.packetsSha256); assert.equal(sha(join(dir, "REQUESTS.json")), plan.basePins.requestsSha256);
  const mock = read(join(base, "omission-diagnosis/rehearsal/SYNTHETIC-ONLY-ledger.json"));
  const history = read(join(base, "paid-evaluation/HISTORICAL-LEDGER-READBACK.json"));
  assert.equal(sha(history.path), plan.basePins.historicalLedgerSha256);
  const scenarios = ["all-pass", "identity-label", "offset-E10", "uncertain-responses-E07", "uncertain-decisions-E10",
    "incomplete-decisions-E10", "schema-E07", "candidate-file-exists-E07", "post-seal-corruption-E07"];
  const results: any[] = [];
  let compactCopyRejected = false, totalCliInvocations = 0;
  for (const scenario of scenarios) {
    const temp = mkdtempSync(join(tmpdir(), "luna-real-cli-offline-")), path = join(temp, "SYNTHETIC-ONLY-ledger.json");
    const starting = structuredClone(original); starting.enabled = true; starting.blockedReason = null;
    starting.approvedPolicyId = "OFFLINE-REAL-CLI-PATH-NO-PAID-AUTHORITY";
    writeFileSync(path, serializeDiagnosticArtifact(starting));
    const anchors: DiagnosticCheckpointAnchor[] = [], records: any[] = [];
    let stopReason: string | null = null, mockCalls = 0, stopped = false, cliInvocations = 0;
    try {
      for (const entry of packets.entries) {
        const id = entry.id, before = read(path);
        try { verifyDiagnosticHistory({ directory: temp, anchors, expectedCaseIds: plan.selectedCaseIds, startingLedger: starting, currentLedger: before }); }
        catch { stopped = true; stopReason = "pre_invocation_integrity_failure"; stopLedger(path, "diagnostic_operational_stop"); break; }
        assert(before.enabled && before.blockedReason === null);
        assert.equal(identityDigest(read(join(dir, "inputs", `${id}.json`))), entry.inputHash);
        const requests = wire.requests.filter((r: any) => r.caseId === id);
        const fixtureRequests = requests.map((request: any) => {
          const reply = structuredClone(mock.attempts[request.hash].receipt.body);
          if (request.endpoint === "responses") {
            const raw = JSON.parse(reply.output[0].content[0].text);
            if (scenario === "identity-label" && id === "E07") Object.assign(raw.identity.occurrences[0], { status: "ambiguous", canonicalId: null, identityConfidence: "unknown" });
            if (scenario === "offset-E10" && id === "E10") raw.goalieStatuses[0].evidence.end--;
            if (scenario === "schema-E07") raw.canPublish = true;
            reply.output[0].content[0].text = JSON.stringify(raw);
          }
          if (scenario === "incomplete-decisions-E10" && id === "E10" && request.endpoint === "decisions") reply.status = "incomplete";
          return { ...request, reply, requestId: `offline-cli-${id}-${request.endpoint}`,
            throwUncertain: scenario === "uncertain-responses-E07" || scenario === "uncertain-decisions-E10" && id === "E10" && request.endpoint === "decisions" };
        });
        const fixturePath = join(temp, `${id}.fixture.json`), callsPath = join(temp, `${id}.mock-calls.json`);
        durableSave(fixturePath, { requests: fixtureRequests });
        const originalPath = join(temp, `${id}.original.json`), candidatePath = join(temp, `${id}.candidate.json`);
        if (scenario === "candidate-file-exists-E07") writeFileSync(candidatePath, "occupied");
        // The child environment is deliberately rebuilt. It cannot load .env.local.
        const cli = spawnSync(process.execPath, ["--experimental-require-module", "-r", "ts-node/register/transpile-only", "-r", join(dir, "mock-cli-provider.cjs"),
          "scripts/review-ifttt-luna.ts", "--input", join(dir, "inputs", `${id}.json`), "--output", originalPath,
          "--binding-candidate-output", candidatePath, "--ledger", path, "--dispatch"], {
          cwd: join(root, "web"), encoding: "utf8", env: { PATH: process.env.PATH, TMPDIR: tmpdir(), NODE_PATH: ".:./node_modules", NODE_ENV: "test",
            NODE_OPTIONS: `--require=${join(base, "deny-network.cjs")}`, TS_NODE_COMPILER_OPTIONS: '{"module":"CommonJS","moduleResolution":"node","allowJs":false}',
            OPENAI_API_KEY: "offline-not-a-credential", IFTTT_LUNA_REVIEW_ENABLED: "true", IFTTT_LUNA_REVIEW_STOP: "false",
            LUNA_OFFLINE_FIXTURE: fixturePath, LUNA_OFFLINE_CALLS: callsPath } });
        cliInvocations++; totalCliInvocations++;
        const observed = existsSync(callsPath) ? read(callsPath) : { calls: [], actualProviderRequests: 0 };
        assert.equal(observed.actualProviderRequests, 0); mockCalls += observed.calls.length;
        if (scenario === "candidate-file-exists-E07") {
          assert.equal(cli.status, 1); assert.equal(observed.calls.length, 0); assert.equal(readFileSync(candidatePath, "utf8"), "occupied");
          assert.equal(readFileSync(originalPath).length, 0); stopped = true; stopReason = "cli_failed_before_complete_artifacts";
          stopLedger(path, "diagnostic_operational_stop"); break;
        }
        assert(cli.status === 0 || cli.status === 2, cli.stderr);
        const originalBytes = readFileSync(originalPath), candidateBytes = readFileSync(candidatePath);
        const review = JSON.parse(originalBytes.toString("utf8")), candidate = JSON.parse(candidateBytes.toString("utf8"));
        // These are the actual unchanged CLI bytes, not a hand-built equivalent.
        assert.equal(originalBytes.toString("utf8"), serializeDiagnosticArtifact(review));
        assert.equal(candidateBytes.toString("utf8"), serializeDiagnosticArtifact(candidate));
        const after = read(path), oldCount = Object.keys(before.attempts).length;
        const attempts = Object.entries(after.attempts).slice(oldCount).map(([hash, a]: [string, any]) => ({ hash, ...a }));
        assert.deepEqual(attempts.map(a => a.hash), observed.calls.map((c: any) => c.hash));
        const classification = await classifyDiagnosticReport({ input: entry.input, expected: entry.expected, originalReview: review,
          attempts, requests, cliExitCode: cli.status!, checkedAt: "2026-10-31T23:00:00Z" });
        durableSave(join(temp, `${id}.receipts.json`), attempts); durableSave(join(temp, `${id}.diagnostic.json`), classification);
        let checkpointSealed = false;
        if (classification.mayAdvanceDiagnosticSequence) {
          const args = { directory: temp, caseId: id, previousAnchor: anchors[anchors.length - 1] ?? null,
            beforeLedger: before, afterLedger: after, expectedRequestHashes: requests.map((r: any) => r.hash),
            artifacts: { original: review, receipts: attempts, candidate, diagnostic: classification } };
          if (scenario === "all-pass" && id === "E07") {
            const probe = join(temp, "compact-copy-probe"); mkdirSync(probe);
            for (const kind of ["original", "candidate", "receipts", "diagnostic"]) writeFileSync(join(probe, `${id}.${kind}.json`), readFileSync(join(temp, `${id}.${kind}.json`)) as unknown as Uint8Array);
            writeFileSync(join(probe, `${id}.original.json`), JSON.stringify(review));
            assert.throws(() => prepareDiagnosticCheckpoint({ ...args, directory: probe }), /persisted_artifact_changed_before_seal/);
            compactCopyRejected = true;
          }
          const sealed = prepareDiagnosticCheckpoint(args);
          durableSave(join(temp, `${id}.checkpoint.json`), sealed.checkpoint); anchors.push(sealed.anchor);
          verifyDiagnosticHistory({ directory: temp, anchors, expectedCaseIds: plan.selectedCaseIds, startingLedger: starting, currentLedger: read(path) });
          checkpointSealed = true;
        }
        // Neither sealing nor classification rewrites CLI originals or ledger receipts.
        assert.deepEqual(readFileSync(originalPath), originalBytes); assert.deepEqual(readFileSync(candidatePath), candidateBytes);
        assert.deepEqual(read(path), after);
        records.push({ caseId: id, cliExit: cli.status, mockCalls: observed.calls.length, actualProviderRequests: 0,
          originalFileSha256: sha(originalPath), candidateFileSha256: sha(candidatePath), originalCliBytesUnchanged: true, receiptDataUnchanged: true,
          originalStatus: review.status, rawGrade: classification.rawGrade, outcome: classification.outcome,
          mayAdvance: classification.mayAdvanceDiagnosticSequence, reason: classification.reason,
          decisionsDisposition: classification.decisionsDisposition, candidateAvailable: Boolean(candidate.content), candidateApplied: false,
          checkpointSealed, checkpointAnchor: anchors[anchors.length - 1] ?? null });
        if (scenario === "offset-E10" && id === "E10") {
          assert.equal(classification.outcome, "recorded_model_failure"); assert(candidate.content && checkpointSealed);
          assert.equal(classification.decisionsDisposition, "not_run_original_responses_held"); assert.equal(observed.calls.length, 1);
        }
        if (!classification.mayAdvanceDiagnosticSequence) {
          stopped = true; stopReason = classification.reason; stopLedger(path, "diagnostic_operational_stop"); break;
        }
        if (scenario === "post-seal-corruption-E07") writeFileSync(originalPath, originalBytes.toString("utf8") + "\n");
      }
      if (!stopped) {
        verifyDiagnosticHistory({ directory: temp, anchors, expectedCaseIds: plan.selectedCaseIds, startingLedger: starting, currentLedger: read(path) });
        stopLedger(path, "diagnostic_collection_completed");
      }
      const final = read(path); assert.equal(final.enabled, false);
      for (const [hash, value] of Object.entries(original.attempts)) assert.deepEqual(final.attempts[hash], value);
      for (const field of ["capNanoUsd", "maxCalls", "expiresAt", "priorExposureNanoUsd"]) assert.equal(final[field], original[field]);
      const fullCollection = ["all-pass", "identity-label", "offset-E10"].includes(scenario);
      assert.equal(stopped, !fullCollection);
      if (fullCollection) { assert.equal(records.length, 10); assert.equal(mockCalls, scenario === "offset-E10" ? 11 : 12); }
      else if (["uncertain-decisions-E10", "incomplete-decisions-E10"].includes(scenario)) { assert.equal(records.length, 4); assert.equal(mockCalls, 5); }
      else if (scenario === "candidate-file-exists-E07") { assert.equal(records.length, 0); assert.equal(mockCalls, 0); }
      else { assert.equal(records.length, 1); assert.equal(mockCalls, 1); }
      if (scenario.startsWith("uncertain-")) {
        const last: any = Object.values(final.attempts).at(-1); assert.equal(last.state, "uncertain"); assert.equal(last.reservedNanoUsd, 233000000);
        assert.equal(final.blockedReason, "unknown_billed_outcome"); assert.equal(records.at(-1)!.checkpointSealed, false);
      }
      // Retain exact file bytes from actual child CLI runs for independent inspection.
      for (const name of readdirSync(temp)) if (/^E\d+\.(original|candidate|receipts|diagnostic|checkpoint)\.json$/.test(name)) {
        emitBytes(join("CLI-EVIDENCE", scenario, name), readFileSync(join(temp, name)));
      }
      emit(join("CLI-EVIDENCE", scenario, "FINAL-SYNTHETIC-LEDGER.json"), final);
      results.push({ scenario, cliInvocations, mockCalls, actualProviderRequests: 0, reportsClassified: records.length, stopped, stopReason,
        ledgerEnabled: final.enabled, blockedReason: final.blockedReason, cumulativeSyntheticAttempts: Object.keys(final.attempts).length,
        priorSevenPreserved: true, originalCliBytesPreservedDuringNormalProcessing: true,
        deliberatePostSealCorruption: scenario === "post-seal-corruption-E07", trustedAnchors: anchors, records });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  assert(compactCopyRejected); assert.deepEqual(readFileSync(paidPath), paidBefore); assert.equal(sha(history.path), plan.basePins.historicalLedgerSha256);
  const output = { version: "luna-real-cli-checkpoint-offline-v1", planSha256: sha(join(dir, "PLAN.json")), actualProviderRequests: 0,
    realCredentialsRead: false, syntheticCredentialLiteralOnly: true, realLedgerUnchangedDisabled: true, historicalLedgerUnchanged: true,
    compactCopyRejectedWithoutModifyingCliOriginal: compactCopyRejected, totalCliInvocations, scenarios: results };
  emit("CLI-VERIFICATION.json", output);
  process.stdout.write(JSON.stringify({ scenariosPassed: results.length, totalCliInvocations, actualProviderRequests: 0,
    compactCopyRejected, realLedgerUnchangedDisabled: true, scenarios: results.map(({ records, trustedAnchors, ...r }) => r) }, null, 2) + "\n");
}
main().catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });
