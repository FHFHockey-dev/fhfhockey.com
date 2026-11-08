import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, openSync, closeSync, fsyncSync, renameSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { runRetainedTweetLunaReviewWithBinding } from "../../../../web/lib/sources/tweetLunaBindingWorkflow";
import { LUNA_EVIDENCE_BINDING_POLICY } from "../../../../web/lib/sources/tweetLunaEvidenceBinding";
import { createLunaTransport } from "../../../../web/lib/sources/tweetLunaTransport";
import { openLunaLocalAdmission } from "../../../../web/lib/sources/tweetLunaLocalStore";
import { classifyDiagnosticReport, COLLECTIBLE_MODEL_HOLDS, DIAGNOSTIC_POLICY } from "./diagnostic-policy";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path) as unknown as Uint8Array).digest("hex");
const exposure = (ledger: any) => ledger.priorExposureNanoUsd + Object.values(ledger.attempts)
  .reduce<number>((sum, a: any) => sum + (a.receipt?.chargeNanoUsd ?? a.reservedNanoUsd), 0);
function durableSaveNew(path: string, value: unknown) {
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  const directory = openSync(dirname(path), "r");
  try { fsyncSync(directory); } finally { closeSync(directory); }
}
function durableStop(path: string, reason: string) {
  const lock = `${path}.lock`, lockFd = openSync(lock, "wx", 0o600);
  try {
    const ledger = read(path); ledger.enabled = false; ledger.blockedReason ??= reason;
    const pending = `${path}.stop`, fd = openSync(pending, "wx", 0o600);
    try { writeFileSync(fd, JSON.stringify(ledger)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(pending, path); const directory = openSync(dirname(path), "r");
    try { fsyncSync(directory); } finally { closeSync(directory); }
  } finally { closeSync(lockFd); unlinkSync(lock); }
}

// OFFLINE ONLY. No env/key loader, activation or dispatch mode. Fetch is always a
// prescribed synthetic mock; the real ledger is read only and compared at exit.
async function main() {
  assert.equal(process.argv.length, 2);
  const root = resolve(".."), base = join(root, "tasks/artifacts/luna-reference-package-2026-10-31"), dir = join(base, "diagnostic-e07-e16");
  const save = (name: string, value: unknown) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const plan = read(join(dir, "PLAN.json")), packets = read(join(dir, "PACKETS.json")), wire = read(join(dir, "REQUESTS.json"));
  assert.equal(sha(join(dir, "PLAN.json")), "69745e85933a552a6e425a0443d5dacc25157fa4ca1169ffd7df89d119f57419");
  assert.equal(sha(join(dir, "PACKETS.json")), plan.basePins.packetsSha256);
  assert.equal(sha(join(dir, "REQUESTS.json")), plan.basePins.requestsSha256);
  assert.equal(sha(join(dir, "diagnostic-policy.ts")), plan.basePins.diagnosticPolicySha256);
  assert.equal(DIAGNOSTIC_POLICY, plan.diagnosticPolicy.version);
  assert.deepEqual(COLLECTIBLE_MODEL_HOLDS, plan.diagnosticPolicy.collectibleHeldReasons);
  for (const [file, hash] of Object.entries(plan.applicationPins)) assert.equal(sha(join(root, file)), hash);
  const previousManifest = join(root, plan.basePins.previousExecutionManifestPath);
  assert.equal(sha(previousManifest), plan.basePins.previousExecutionManifestSha256);
  for (const [file, hash] of Object.entries(read(previousManifest).files)) assert.equal(sha(join(dirname(previousManifest), file)), hash);
  const realPath = join(root, plan.basePins.realLedgerPath), realBefore = readFileSync(realPath), original = read(realPath);
  assert.equal(sha(realPath), plan.basePins.realLedgerSha256); assert.deepEqual(realBefore, readFileSync(join(dir, "START-LEDGER.json")));
  assert.equal(original.enabled, false); assert.equal(original.blockedReason, "bounded_continuation_stopped");
  assert.equal(Object.keys(original.attempts).length, 7); assert.equal(exposure(original), 265263690);
  const history = read(join(base, "paid-evaluation/HISTORICAL-LEDGER-READBACK.json"));
  assert.equal(sha(history.path), plan.basePins.historicalLedgerSha256);
  const full = read(join(base, "omission-diagnosis/rehearsal/batch.json"));
  const fullWire = read(join(base, "omission-diagnosis/rehearsal/requests.json"));
  const mockLedger = read(join(base, "omission-diagnosis/rehearsal/SYNTHETIC-ONLY-ledger.json"));
  assert.deepEqual(packets.entries, full.content.entries.slice(6));
  assert.deepEqual(wire.requests, fullWire.requests.filter((r: any) => plan.selectedCaseIds.includes(r.caseId)));
  assert.equal(wire.requests.length, 12); assert.equal(new Set(wire.requests.map((r: any) => r.hash)).size, 12);
  assert.deepEqual(wire.requests.filter((r: any) => r.endpoint === "decisions").map((r: any) => r.caseId), ["E10", "E11"]);
  assert.equal(plan.budget.maximumCumulativeCallsForThisPlan, 19); assert.equal(plan.budget.cumulativeMaxCalls, 20);
  assert.equal(plan.budget.maximumAdditionalExposureNanoUsd, original.capNanoUsd - exposure(original));
  assert.equal(packets.provenance.independentHoldout, false); assert.equal(packets.provenance.split, "exposed_synthetic_development");
  for (const entry of packets.entries) {
    assert.equal(identityDigest(entry.input), entry.inputHash); assert.equal(identityDigest(entry.expected), entry.expectedHash);
    assert.deepEqual(read(join(dir, "inputs", `${entry.id}.json`)), entry.input);
  }
  for (const [index, request] of wire.requests.entries()) {
    assert.equal(request.hash, identityDigest({ endpoint: request.endpoint, body: request.body }));
    assert.equal(original.attempts[request.hash], undefined); assert.equal(Buffer.byteLength(JSON.stringify(request.body)), request.bytes);
    assert.equal(plan.sequence[index].hash, request.hash); assert.equal(plan.sequence[index].maximumCumulativeCallNumber, index + 8);
    if (request.endpoint === "responses") {
      const input = JSON.parse(request.body.input); assert.deepEqual(input.referencePackage, plan.referencePackage);
      assert.equal(input.developmentExamples, undefined); assert.equal(input.developmentLibrary, undefined);
    }
  }
  const collectScenarios = ["all-pass", "identity-label-E07", "unsupported-goalie-E07", "decision-label-E10", "offset-E10", "three-offsets"];
  const scenarios = [...collectScenarios, "schema-escape-E07", "invalid-json-E07", "incomplete-E07", "invalid-usage-E07",
    "transport-error-E07", "decision-transport-E10", "decision-unresolved-E10", "decision-budget-E10", "tampered-review-E07",
    "substituted-receipt-E07", "cli-error-E07", "pin-mismatch", "source-mismatch", "clock-invalid", "disabled-ledger",
    "insufficient-reservation", "expired-ledger", "preexisting-unsettled", "artifact-write-failure-E07"];
  const summaries: any[] = [], collectionResults: any[] = [], allPass: any[] = [];
  for (const scenario of scenarios) {
    const temp = mkdtempSync(join(tmpdir(), "luna-diagnostic-offline-")), path = join(temp, "SYNTHETIC-ONLY.json");
    const now = () => scenario === "expired-ledger" ? "2026-11-02T00:00:00Z" : scenario === "clock-invalid" ? "2026-10-15T00:00:00Z" : "2026-10-31T23:00:00Z";
    try {
      const ledger = structuredClone(original); ledger.approvedPolicyId = "OFFLINE-NO-PAID-AUTHORITY";
      if (scenario !== "disabled-ledger") { ledger.enabled = true; ledger.blockedReason = null; }
      if (scenario === "insufficient-reservation") ledger.capNanoUsd = exposure(original) + 233000000 - 1;
      if (scenario === "decision-budget-E10") ledger.capNanoUsd = exposure(original) + 4 * 38500 + 233000000 - 1;
      if (scenario === "preexisting-unsettled") ledger.attempts["e".repeat(64)] = { state: "uncertain", receipt: null, reservedNanoUsd: 233000000 };
      writeFileSync(path, JSON.stringify(ledger));
      const admission = openLunaLocalAdmission(path, () => Date.parse(now()));
      const dispatched: { caseId: string; endpoint: string; hash: string }[] = [], records: any[] = [], completedHashes: string[] = [];
      let active = packets.entries[0], withinCase = 0, operationalStop = false, stopReason: string | null = null;
      const transport = createLunaTransport({ enabled: true, stopped: () => operationalStop, apiKey: () => "offline-not-a-credential", admission,
        fetch: async (url, init) => {
          const endpoint = String(url).endsWith("/responses") ? "responses" : "decisions", body = JSON.parse(String(init?.body));
          const hash = identityDigest({ endpoint, body }), expected = wire.requests.filter((r: any) => r.caseId === active.id)[withinCase++];
          assert(expected && expected.hash === hash && expected.endpoint === endpoint, "unfrozen_request");
          dispatched.push({ caseId: active.id, endpoint, hash }); assert(dispatched.length <= 12);
          if (scenario === "transport-error-E07" || scenario === "decision-transport-E10" && active.id === "E10" && endpoint === "decisions") throw new Error("synthetic_transport_failure");
          const reply = structuredClone(mockLedger.attempts[hash].receipt.body);
          if (scenario === "invalid-usage-E07") reply.usage.input_tokens = -1;
          if (endpoint === "responses") {
            const content = reply.output[0].content[0], raw = JSON.parse(content.text);
            if (scenario === "identity-label-E07" && active.id === "E07") Object.assign(raw.identity.occurrences[0], { canonicalId: null, status: "ambiguous", identityConfidence: "unknown" });
            if (scenario === "unsupported-goalie-E07" && active.id === "E07") raw.goalieStatuses = [{ occurrenceId: "subject-4", canonicalId: "nhl:900001", status: "projected",
              evidence: { start: 4, end: active.input.packet.source.text.length, text: active.input.packet.source.text.slice(4) } }];
            if (scenario === "offset-E10" && active.id === "E10" || scenario === "three-offsets" && ["E10", "E11", "E15"].includes(active.id)) raw.goalieStatuses.forEach((g: any) => g.evidence.end--);
            if (scenario === "schema-escape-E07") raw.canPublish = true;
            content.text = scenario === "invalid-json-E07" ? "{ invalid" : JSON.stringify(raw);
            if (scenario === "incomplete-E07") reply.status = "incomplete";
          } else if (active.id === "E10") {
            if (scenario === "decision-label-E10") reply.answers[0].probability = 0.05;
            if (scenario === "decision-unresolved-E10") reply.answers = [];
          }
          return new Response(JSON.stringify(reply), { headers: { "x-request-id": `offline-${active.id}-${endpoint}` } });
        } });
      for (const entry of packets.entries) {
        active = entry; withinCase = 0;
        try {
          const before = read(path);
          for (const previous of records) {
            assert(previous.persisted && previous.mayAdvanceDiagnosticSequence, "previous_case_not_recorded_or_safe");
            assert.equal(identityDigest(read(join(temp, `${previous.caseId}.original.json`))), previous.originalReviewHash);
            assert.equal(identityDigest(read(join(temp, `${previous.caseId}.diagnostic.json`))), previous.diagnosticResultHash);
          }
          assert(scenario !== "pin-mismatch", "pin_mismatch");
          const packet = structuredClone(entry.input); if (scenario === "source-mismatch") packet.packet.source.text += " changed";
          assert.equal(identityDigest(packet), entry.inputHash, "source_mismatch");
          assert.deepEqual(Object.keys(before.attempts), [...Object.keys(original.attempts), ...completedHashes], "ledger_prefix_mismatch");
          assert(Object.values(before.attempts).every((a: any) => a.state === "settled"), "unsettled_attempt");
          assert(before.enabled && before.blockedReason === null && Date.parse(now()) < Date.parse(before.expiresAt), "ledger_disabled_or_expired");
          assert(exposure(before) + 233000000 <= before.capNanoUsd, "full_reservation_unavailable");
        } catch {
          operationalStop = true; stopReason = "pre_invocation_operational_gate"; durableStop(path, "diagnostic_operational_stop"); break;
        }
        const bound = await runRetainedTweetLunaReviewWithBinding({ enabled: true, input: entry.input, transport, now, bindingPolicy: LUNA_EVIDENCE_BINDING_POLICY });
        const current = read(path), currentRows = Object.entries(current.attempts).slice(7 + completedHashes.length).map(([hash, value]: [string, any]) => ({ hash, ...value }));
        const review = structuredClone(bound.review), attempts = structuredClone(currentRows);
        if (scenario === "tampered-review-E07") (review as any).canPublish = true;
        if (scenario === "substituted-receipt-E07") attempts[0].receipt.body.output[0].content[0].text = "{}";
        const result = await classifyDiagnosticReport({ input: entry.input, expected: entry.expected, originalReview: review,
          attempts, requests: wire.requests.filter((r: any) => r.caseId === entry.id), cliExitCode: scenario === "cli-error-E07" ? 1 : review.status === "held" ? 2 : 0, checkedAt: now() });
        const originalPassed = result.outcome === "recorded_pass";
        const record = { caseId: entry.id, ...result, originalPassed, calls: currentRows.length, candidateHash: bound.candidate?.hash ?? null,
          candidateStatus: bound.bindingStatus, candidateApplied: false, requestHashes: currentRows.map((a: any) => a.hash),
          persisted: false, diagnosticResultHash: identityDigest(result) };
        records.push(record);
        if (scenario === "all-pass") allPass.push({ caseId: entry.id, originalReview: review, diagnostic: result });
        if (scenario === "offset-E10" && entry.id === "E10") {
          assert(bound.candidate && !originalPassed && result.outcome === "recorded_model_failure" && result.mayAdvanceDiagnosticSequence);
          assert.equal(result.decisionsDisposition, "not_run_original_responses_held"); assert.equal(bound.candidate.content.canApply, false);
          save("OFFSET-E10-original-review.json", review); save("OFFSET-E10-separate-candidate.json", bound.candidate);
        }
        if (scenario === "unsupported-goalie-E07" && entry.id === "E07") {
          assert.equal(review.status, "held"); assert.equal(result.outcome, "recorded_model_failure");
          assert.equal(originalPassed, false); // Empty rejected statuses can match an abstention label; status still makes this a failure.
        }
        try {
          // The next case cannot start until all independent artifacts are durable.
          const originalPath = join(temp, `${entry.id}.original.json`);
          if (scenario === "artifact-write-failure-E07") writeFileSync(originalPath, "occupied");
          durableSaveNew(originalPath, review);
          durableSaveNew(join(temp, `${entry.id}.receipts.json`), currentRows);
          durableSaveNew(join(temp, `${entry.id}.candidate.json`), bound.candidate ?? { status: bound.bindingStatus, candidate: null });
          durableSaveNew(join(temp, `${entry.id}.diagnostic.json`), result);
          record.persisted = true;
        } catch {
          operationalStop = true; stopReason = "artifact_persistence_failed"; durableStop(path, "diagnostic_operational_stop"); break;
        }
        completedHashes.push(...currentRows.map((a: any) => a.hash));
        if (!result.mayAdvanceDiagnosticSequence) {
          operationalStop = true; stopReason = result.reason; durableStop(path, "diagnostic_operational_stop"); break;
        }
      }
      if (!operationalStop) durableStop(path, "diagnostic_collection_completed");
      const end = read(path);
      assert.equal(end.enabled, false); assert(exposure(end) <= end.capNanoUsd);
      for (const [hash, attempt] of Object.entries(original.attempts)) assert.deepEqual(end.attempts[hash], attempt);
      for (const field of ["priorExposureNanoUsd", "maxCalls", "expiresAt"]) assert.equal(end[field], original[field]);
      if (!["insufficient-reservation", "decision-budget-E10"].includes(scenario)) assert.equal(end.capNanoUsd, original.capNanoUsd);
      await assert.rejects(admission.reserve("f".repeat(64), 233000000), /luna_budget_stopped/);
      const collected = collectScenarios.includes(scenario);
      assert.equal(operationalStop, !collected);
      if (collected) {
        assert.equal(records.length, 10); assert.equal(end.blockedReason, "diagnostic_collection_completed");
        assert.equal(dispatched.length, scenario === "three-offsets" ? 10 : scenario === "offset-E10" ? 11 : 12);
        assert.equal(Object.keys(end.attempts).length, 7 + dispatched.length);
        assert.equal(records.filter(r => !r.originalPassed).length, scenario === "all-pass" ? 0 : scenario === "three-offsets" ? 3 : 1);
        collectionResults.push({ scenario, records });
      } else if (scenario.startsWith("decision-")) {
        assert.equal(records.length, 4); assert.equal(dispatched.length, scenario === "decision-budget-E10" ? 4 : 5);
      } else if (["pin-mismatch", "source-mismatch", "disabled-ledger", "insufficient-reservation", "expired-ledger", "preexisting-unsettled"].includes(scenario)) {
        assert.equal(records.length, 0); assert.equal(dispatched.length, 0);
      } else { assert.equal(records.length, 1); assert.equal(dispatched.length, scenario === "clock-invalid" ? 0 : 1); }
      if (["transport-error-E07", "invalid-usage-E07", "decision-transport-E10"].includes(scenario)) {
        const last = dispatched[dispatched.length - 1]!; assert.equal(end.attempts[last.hash].state, "uncertain");
        assert.equal(end.attempts[last.hash].reservedNanoUsd, 233000000); assert.equal(end.blockedReason, "unknown_billed_outcome");
      }
      if (scenario === "artifact-write-failure-E07") {
        assert.equal(stopReason, "artifact_persistence_failed"); assert.equal(records[0].persisted, false);
      }
      if (["tampered-review-E07", "substituted-receipt-E07", "cli-error-E07", "artifact-write-failure-E07"].includes(scenario)) {
        assert.equal(records.filter(r => r.persisted && r.originalPassed).length, 0, "unverified_or_unpersisted_result_is_not_a_pass");
      }
      summaries.push({ scenario, reportsRecorded: records.length, newMockCalls: dispatched.length, totalMockAttempts: Object.keys(end.attempts).length,
        operationalStop, stopReason, blockedReason: end.blockedReason, ledgerEnabled: end.enabled, priorSevenPreserved: true,
        originalPasses: records.filter(r => r.persisted && r.originalPassed).length, originalFailures: records.filter(r => r.outcome === "recorded_model_failure").length,
        operationallyStoppedReports: records.filter(r => r.outcome === "operational_stop" || !r.persisted).length,
        separateCandidates: records.filter(r => r.candidateHash).length, candidateApplied: false, aggregateExposureNanoUsd: exposure(end),
        postStopAdmissionRejected: true, lastRecord: records[records.length - 1] ?? null, dispatched });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  assert.deepEqual(readFileSync(realPath), realBefore); assert.equal(sha(history.path), plan.basePins.historicalLedgerSha256);
  const output = { version: "luna-e07-e16-offline-diagnostic-verification-v1", planSha256: sha(join(dir, "PLAN.json")),
    actualProviderRequests: 0, retries: 0, realLedgerUnchangedDisabledSevenCalls: true, historicalLedgerUnchanged: true,
    originalGradesPreserved: true, applicationUnchanged: true, scenarios: summaries };
  save("OFFLINE-VERIFICATION.json", output); save("OFFLINE-RESULTS.json", allPass); save("COLLECTION-RESULTS.json", collectionResults);
  process.stdout.write(JSON.stringify({ ...output, scenarios: summaries.map(({ dispatched, lastRecord, ...summary }) => summary) }, null, 2) + "\n");
}
main().catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });
