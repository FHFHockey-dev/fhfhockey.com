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
import { assertDiagnosticLedgerExtension, prepareDiagnosticCheckpoint, verifyDiagnosticHistory, serializeDiagnosticArtifact, type DiagnosticCheckpointAnchor } from "./diagnostic-checkpoint";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path) as unknown as Uint8Array).digest("hex");
const exposure = (ledger: any) => ledger.priorExposureNanoUsd + Object.values(ledger.attempts)
  .reduce<number>((sum, a: any) => sum + (a.receipt?.chargeNanoUsd ?? a.reservedNanoUsd), 0);
function durableSaveNew(path: string, value: unknown) {
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, serializeDiagnosticArtifact(value)); fsyncSync(fd); } finally { closeSync(fd); }
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
  const root = resolve(".."), base = join(root, "tasks/artifacts/luna-reference-package-2026-10-31"), dir = join(base, "diagnostic-e07-e16-r2");
  const save = (name: string, value: unknown) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const plan = read(join(dir, "PLAN.json")), packets = read(join(dir, "PACKETS.json")), wire = read(join(dir, "REQUESTS.json"));
  assert.equal(sha(join(dir, "PLAN.json")), "af1499f51ffd1baba22aee3fbefd20a0bc1919b12bbc972289bcf0f7d5d431b5");
  assert.equal(sha(join(dir, "PACKETS.json")), plan.basePins.packetsSha256);
  assert.equal(sha(join(dir, "REQUESTS.json")), plan.basePins.requestsSha256);
  assert.equal(sha(join(dir, "diagnostic-policy.ts")), plan.basePins.diagnosticPolicySha256);
  assert.equal(sha(join(dir, "diagnostic-checkpoint.ts")), plan.basePins.diagnosticCheckpointSha256);
  assert.equal(DIAGNOSTIC_POLICY, plan.diagnosticPolicy.version);
  assert.deepEqual(COLLECTIBLE_MODEL_HOLDS, plan.diagnosticPolicy.collectibleHeldReasons);
  for (const [file, hash] of Object.entries(plan.applicationPins)) assert.equal(sha(join(root, file)), hash);
  const previousManifest = join(root, plan.basePins.previousExecutionManifestPath);
  assert.equal(sha(previousManifest), plan.basePins.previousExecutionManifestSha256);
  for (const [file, hash] of Object.entries(read(previousManifest).files)) assert.equal(sha(join(dirname(previousManifest), file)), hash);
  const priorDiagnostic = join(root, plan.basePins.previousDiagnosticManifestPath);
  assert.equal(sha(priorDiagnostic), plan.basePins.previousDiagnosticManifestSha256);
  for (const [file, hash] of Object.entries(read(priorDiagnostic).files)) assert.equal(sha(join(dirname(priorDiagnostic), file)), hash);
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
  const collectScenarios = ["all-pass", "explicit-complete", "identity-label-E07", "unsupported-goalie-E07", "decision-label-E10", "offset-E10", "three-offsets"];
  const artifactFaults = Object.fromEntries(["original", "receipts", "candidate", "diagnostic", "checkpoint"].flatMap(kind =>
    ["corrupt", "delete"].map(action => [`between-${kind}-${action}`, { caseId: "E07", kind, action }])));
  const boundCandidateFaults = ["bound-candidate-corrupt-E10", "bound-candidate-delete-E10"];
  const ledgerFaults = ["between-ledger-receipt", "between-ledger-delete", "between-starting-receipt", "between-ledger-policy", "audit-combined-E07"];
  const explicitResponseFailures = ["response-error-E07", "response-details-E07", "message-error-E07", "message-details-E07", "message-incomplete-E07"];
  const explicitDecisionFailures = ["decision-incomplete-E10", "decision-failed-E10", "decision-cancelled-E10", "decision-in-progress-E10",
    "decision-queued-E10", "decision-details-E10", "decision-error-E10", "decision-answer-error-E10", "decision-answer-details-E10"];
  const scenarios = [...collectScenarios, "schema-escape-E07", "invalid-json-E07", "incomplete-E07", "invalid-usage-E07",
    "transport-error-E07", "decision-transport-E10", "decision-unresolved-E10", "decision-budget-E10", "tampered-review-E07",
    "substituted-receipt-E07", "cli-error-E07", "pin-mismatch", "source-mismatch", "clock-invalid", "disabled-ledger",
    "insufficient-reservation", "expired-ledger", "preexisting-unsettled", "artifact-write-failure-E07",
    ...explicitResponseFailures, ...explicitDecisionFailures, ...Object.keys(artifactFaults), ...ledgerFaults, ...boundCandidateFaults,
    "during-E08-ledger-corruption", "completion-artifact-deletion"];
  const summaries: any[] = [], collectionResults: any[] = [], allPass: any[] = [];
  for (const scenario of scenarios) {
    const temp = mkdtempSync(join(tmpdir(), "luna-diagnostic-offline-")), path = join(temp, "SYNTHETIC-ONLY.json");
    const now = () => scenario === "expired-ledger" ? "2026-11-02T00:00:00Z" : scenario === "clock-invalid" ? "2026-10-15T00:00:00Z" : "2026-10-31T23:00:00Z";
    try {
      const ledger = structuredClone(original); ledger.approvedPolicyId = "OFFLINE-NO-PAID-AUTHORITY";
      if (scenario !== "disabled-ledger") { ledger.enabled = true; ledger.blockedReason = null; }
      if (scenario === "insufficient-reservation") ledger.capNanoUsd = exposure(original) + 233000000 - 1;
      if (scenario === "decision-budget-E10") ledger.capNanoUsd = exposure(original) + 4 * 38500 + 233000000 - 1;
      const trustedStartingLedger = structuredClone(ledger);
      if (scenario === "preexisting-unsettled") ledger.attempts["e".repeat(64)] = { state: "uncertain", receipt: null, reservedNanoUsd: 233000000 };
      writeFileSync(path, JSON.stringify(ledger));
      const admission = openLunaLocalAdmission(path, () => Date.parse(now()));
      const dispatched: { caseId: string; endpoint: string; hash: string }[] = [], records: any[] = [], completedHashes: string[] = [];
      const anchors: DiagnosticCheckpointAnchor[] = [];
      let active = packets.entries[0], withinCase = 0, operationalStop = false, stopReason: string | null = null;
      const transport = createLunaTransport({ enabled: true, stopped: () => operationalStop, apiKey: () => "offline-not-a-credential", admission,
        fetch: async (url, init) => {
          const endpoint = String(url).endsWith("/responses") ? "responses" : "decisions", body = JSON.parse(String(init?.body));
          const hash = identityDigest({ endpoint, body }), expected = wire.requests.filter((r: any) => r.caseId === active.id)[withinCase++];
          assert(expected && expected.hash === hash && expected.endpoint === endpoint, "unfrozen_request");
          dispatched.push({ caseId: active.id, endpoint, hash }); assert(dispatched.length <= 12);
          if (scenario === "transport-error-E07" || scenario === "decision-transport-E10" && active.id === "E10" && endpoint === "decisions") throw new Error("synthetic_transport_failure");
          const reply = structuredClone(mockLedger.attempts[hash].receipt.body);
          if (scenario === "explicit-complete") Object.assign(reply, { status: "completed", error: null, incomplete_details: null });
          if (scenario === "invalid-usage-E07") reply.usage.input_tokens = -1;
          if (scenario === "during-E08-ledger-corruption" && active.id === "E08") {
            const mutated = read(path), prior = wire.requests.find((r: any) => r.caseId === "E07");
            mutated.attempts[prior.hash].receipt.body.id = "corrupted-between-admission-and-settlement";
            writeFileSync(path, JSON.stringify(mutated));
          }
          if (endpoint === "responses") {
            const content = reply.output[0].content[0], raw = JSON.parse(content.text);
            if (scenario === "identity-label-E07" && active.id === "E07") Object.assign(raw.identity.occurrences[0], { canonicalId: null, status: "ambiguous", identityConfidence: "unknown" });
            if (scenario === "unsupported-goalie-E07" && active.id === "E07") raw.goalieStatuses = [{ occurrenceId: "subject-4", canonicalId: "nhl:900001", status: "projected",
              evidence: { start: 4, end: active.input.packet.source.text.length, text: active.input.packet.source.text.slice(4) } }];
            if ((scenario === "offset-E10" || boundCandidateFaults.includes(scenario)) && active.id === "E10" || scenario === "three-offsets" && ["E10", "E11", "E15"].includes(active.id)) raw.goalieStatuses.forEach((g: any) => g.evidence.end--);
            if (scenario === "schema-escape-E07") raw.canPublish = true;
            content.text = scenario === "invalid-json-E07" ? "{ invalid" : JSON.stringify(raw);
            if (scenario === "incomplete-E07") reply.status = "incomplete";
            if (scenario === "response-error-E07") reply.error = { code: "synthetic-error" };
            if (scenario === "response-details-E07") reply.incomplete_details = { reason: "synthetic-partial" };
            if (scenario === "message-error-E07") reply.output[0].error = { code: "synthetic-error" };
            if (scenario === "message-details-E07") reply.output[0].incomplete_details = { reason: "synthetic-partial" };
            if (scenario === "message-incomplete-E07") reply.output[0].status = "incomplete";
          } else if (active.id === "E10") {
            if (scenario === "decision-label-E10") reply.answers[0].probability = 0.05;
            if (scenario === "decision-unresolved-E10") reply.answers = [];
            const status = { "decision-incomplete-E10": "incomplete", "decision-failed-E10": "failed", "decision-cancelled-E10": "cancelled",
              "decision-in-progress-E10": "in_progress", "decision-queued-E10": "queued" }[scenario];
            if (status) reply.status = status;
            if (scenario === "decision-details-E10") reply.incomplete_details = { reason: "synthetic-partial" };
            if (scenario === "decision-error-E10") reply.error = { code: "synthetic-error" };
            if (scenario === "decision-answer-error-E10") reply.answers[0].error = { code: "synthetic-error" };
            if (scenario === "decision-answer-details-E10") reply.answers[0].incomplete_details = { reason: "synthetic-partial" };
          }
          return new Response(JSON.stringify(reply), { headers: { "x-request-id": `offline-${active.id}-${endpoint}` } });
        } });
      for (const entry of packets.entries) {
        active = entry; withinCase = 0;
        let before: any, historyVerified = false;
        try {
          before = read(path);
          verifyDiagnosticHistory({ directory: temp, anchors, expectedCaseIds: plan.selectedCaseIds, startingLedger: trustedStartingLedger, currentLedger: before });
          historyVerified = true;
          assert(records.every(r => r.persisted && r.integrityVerified && r.mayAdvanceDiagnosticSequence), "previous_case_not_recorded_or_safe");
          assert(scenario !== "pin-mismatch", "pin_mismatch");
          const packet = structuredClone(entry.input); if (scenario === "source-mismatch") packet.packet.source.text += " changed";
          assert.equal(identityDigest(packet), entry.inputHash, "source_mismatch");
          assert.deepEqual(Object.keys(before.attempts), [...Object.keys(original.attempts), ...completedHashes], "ledger_prefix_mismatch");
          assert(Object.values(before.attempts).every((a: any) => a.state === "settled"), "unsettled_attempt");
          assert(before.enabled && before.blockedReason === null && Date.parse(now()) < Date.parse(before.expiresAt), "ledger_disabled_or_expired");
          assert(exposure(before) + 233000000 <= before.capNanoUsd, "full_reservation_unavailable");
        } catch {
          if (!historyVerified) records.forEach(r => { r.integrityVerified = false; });
          operationalStop = true; stopReason = "pre_invocation_operational_gate"; durableStop(path, "diagnostic_operational_stop"); break;
        }
        const bound = await runRetainedTweetLunaReviewWithBinding({ enabled: true, input: entry.input, transport, now, bindingPolicy: LUNA_EVIDENCE_BINDING_POLICY });
        const current = read(path), currentRows = Object.entries(current.attempts).slice(7 + completedHashes.length).map(([hash, value]: [string, any]) => ({ hash, ...value }));
        const review = structuredClone(bound.review), attempts = structuredClone(currentRows);
        if (scenario === "tampered-review-E07") (review as any).canPublish = true;
        if (scenario === "substituted-receipt-E07") attempts[0].receipt.body.output[0].content[0].text = "{}";
        let result = await classifyDiagnosticReport({ input: entry.input, expected: entry.expected, originalReview: review,
          attempts, requests: wire.requests.filter((r: any) => r.caseId === entry.id), cliExitCode: scenario === "cli-error-E07" ? 1 : review.status === "held" ? 2 : 0, checkedAt: now() });
        const expectedHashes = wire.requests.filter((r: any) => r.caseId === entry.id).map((r: any) => r.hash);
        if (result.mayAdvanceDiagnosticSequence) {
          try { assertDiagnosticLedgerExtension(before, current, expectedHashes); }
          catch {
            records.forEach(r => { r.integrityVerified = false; });
            result = { ...result, outcome: "operational_stop", mayAdvanceDiagnosticSequence: false,
              reason: "ledger_extension_integrity_failed", decisionsDisposition: "unresolved_do_not_dispatch" };
          }
        }
        const originalPassed = result.outcome === "recorded_pass";
        const record = { caseId: entry.id, ...result, originalPassed, calls: currentRows.length, candidateHash: bound.candidate?.hash ?? null,
          candidateStatus: bound.bindingStatus, candidateApplied: false, requestHashes: currentRows.map((a: any) => a.hash),
          persisted: false, integrityVerified: false, diagnosticResultHash: identityDigest(result) };
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
          if (result.mayAdvanceDiagnosticSequence) {
            const sealed = prepareDiagnosticCheckpoint({ directory: temp, caseId: entry.id, previousAnchor: anchors[anchors.length - 1] ?? null,
              beforeLedger: before, afterLedger: current, expectedRequestHashes: expectedHashes,
              artifacts: { original: review, receipts: currentRows, candidate: bound.candidate ?? { status: bound.bindingStatus, candidate: null }, diagnostic: result } });
            durableSaveNew(join(temp, `${entry.id}.checkpoint.json`), sealed.checkpoint); anchors.push(sealed.anchor);
            verifyDiagnosticHistory({ directory: temp, anchors, expectedCaseIds: plan.selectedCaseIds, startingLedger: trustedStartingLedger, currentLedger: read(path) });
            record.integrityVerified = true;
          }
          record.persisted = true;
        } catch {
          operationalStop = true; stopReason = "artifact_persistence_failed"; durableStop(path, "diagnostic_operational_stop"); break;
        }
        completedHashes.push(...currentRows.map((a: any) => a.hash));
        if (!result.mayAdvanceDiagnosticSequence) {
          operationalStop = true; stopReason = result.reason; durableStop(path, "diagnostic_operational_stop"); break;
        }
        // Mutate only disposable state AFTER sealing, so the next gate must detect
        // corruption rather than blessing changed bytes as a fresh baseline.
        const artifactFault = artifactFaults[scenario];
        if (artifactFault && entry.id === artifactFault.caseId) {
          const target = join(temp, `${entry.id}.${artifactFault.kind}.json`);
          if (artifactFault.action === "delete") unlinkSync(target); else writeFileSync(target, "{}");
        }
        if (ledgerFaults.includes(scenario) && entry.id === "E07") {
          const mutated = read(path), hash = currentRows[0].hash;
          if (scenario === "between-ledger-delete") delete mutated.attempts[hash];
          else if (scenario === "between-starting-receipt") mutated.attempts[Object.keys(original.attempts)[0]!].receipt.body.id = "corrupted-prior-receipt";
          else if (scenario === "between-ledger-policy") mutated.approvedPolicyId = "corrupted-policy";
          else mutated.attempts[hash].receipt.body.id = "corrupted-collected-receipt";
          writeFileSync(path, JSON.stringify(mutated));
          if (scenario === "audit-combined-E07") {
            writeFileSync(join(temp, "E07.receipts.json"), "[]"); writeFileSync(join(temp, "E07.candidate.json"), "{}");
          }
        }
        if (boundCandidateFaults.includes(scenario) && entry.id === "E10") {
          assert(bound.candidate);
          const target = join(temp, "E10.candidate.json");
          if (scenario.includes("delete")) unlinkSync(target); else writeFileSync(target, "{}");
        }
        if (scenario === "completion-artifact-deletion" && entry.id === "E16") unlinkSync(join(temp, "E16.receipts.json"));
      }
      if (!operationalStop) {
        try {
          verifyDiagnosticHistory({ directory: temp, anchors, expectedCaseIds: plan.selectedCaseIds, startingLedger: trustedStartingLedger, currentLedger: read(path) });
          durableStop(path, "diagnostic_collection_completed");
        } catch {
          records.forEach(r => { r.integrityVerified = false; }); operationalStop = true; stopReason = "completion_integrity_failed";
          durableStop(path, "diagnostic_operational_stop");
        }
      }
      const end = read(path);
      assert.equal(end.enabled, false); assert(exposure(end) <= end.capNanoUsd);
      for (const [hash, attempt] of Object.entries(original.attempts)) {
        if (scenario === "between-starting-receipt" && hash === Object.keys(original.attempts)[0]) assert.notDeepEqual(end.attempts[hash], attempt);
        else assert.deepEqual(end.attempts[hash], attempt);
      }
      for (const field of ["priorExposureNanoUsd", "maxCalls", "expiresAt"]) assert.equal(end[field], original[field]);
      if (!["insufficient-reservation", "decision-budget-E10"].includes(scenario)) assert.equal(end.capNanoUsd, original.capNanoUsd);
      await assert.rejects(admission.reserve("f".repeat(64), 233000000), /luna_budget_stopped/);
      const collected = collectScenarios.includes(scenario);
      assert.equal(operationalStop, !collected);
      if (collected) {
        assert.equal(records.length, 10); assert.equal(end.blockedReason, "diagnostic_collection_completed");
        assert.equal(dispatched.length, scenario === "three-offsets" ? 10 : scenario === "offset-E10" ? 11 : 12);
        assert.equal(Object.keys(end.attempts).length, 7 + dispatched.length);
        assert.equal(records.filter(r => !r.originalPassed).length, ["all-pass", "explicit-complete"].includes(scenario) ? 0 : scenario === "three-offsets" ? 3 : 1);
        collectionResults.push({ scenario, records });
      } else if (boundCandidateFaults.includes(scenario)) {
        assert.equal(records.length, 4); assert.equal(dispatched.length, 4); assert.equal(stopReason, "pre_invocation_operational_gate");
      } else if (scenario === "during-E08-ledger-corruption") {
        assert.equal(records.length, 2); assert.equal(dispatched.length, 2); assert.equal(stopReason, "ledger_extension_integrity_failed");
      } else if (scenario === "completion-artifact-deletion") {
        assert.equal(records.length, 10); assert.equal(dispatched.length, 12); assert.equal(stopReason, "completion_integrity_failed");
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
        assert.equal(records.filter(r => r.persisted && r.integrityVerified && r.originalPassed).length, 0, "unverified_or_unpersisted_result_is_not_a_pass");
      }
      if (artifactFaults[scenario] || ledgerFaults.includes(scenario) || boundCandidateFaults.includes(scenario)) {
        assert.equal(stopReason, "pre_invocation_operational_gate"); assert(records.every(r => !r.integrityVerified));
      }
      summaries.push({ scenario, reportsRecorded: records.length, newMockCalls: dispatched.length, totalMockAttempts: Object.keys(end.attempts).length,
        operationalStop, stopReason, blockedReason: end.blockedReason, ledgerEnabled: end.enabled,
        priorSevenPreserved: scenario !== "between-starting-receipt", deliberatelyCorruptedSyntheticPriorReceiptDetected: scenario === "between-starting-receipt",
        originalPasses: records.filter(r => r.persisted && r.integrityVerified && r.originalPassed).length,
        originalFailures: records.filter(r => r.outcome === "recorded_model_failure").length,
        operationallyStoppedReports: records.filter(r => r.outcome === "operational_stop" || !r.persisted || !r.integrityVerified).length,
        separateCandidates: records.filter(r => r.candidateHash).length, candidateApplied: false, aggregateExposureNanoUsd: exposure(end),
        postStopAdmissionRejected: true, lastRecord: records[records.length - 1] ?? null, dispatched });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  assert.deepEqual(readFileSync(realPath), realBefore); assert.equal(sha(history.path), plan.basePins.historicalLedgerSha256);
  const output = { version: "luna-e07-e16-offline-diagnostic-verification-v2", planSha256: sha(join(dir, "PLAN.json")),
    actualProviderRequests: 0, retries: 0, realLedgerUnchangedDisabledSevenCalls: true, historicalLedgerUnchanged: true,
    originalGradesPreserved: true, applicationUnchanged: true, scenarios: summaries };
  save("OFFLINE-VERIFICATION.json", output); save("OFFLINE-RESULTS.json", allPass); save("COLLECTION-RESULTS.json", collectionResults);
  process.stdout.write(JSON.stringify({ ...output, scenarios: summaries.map(({ dispatched, lastRecord, ...summary }) => summary) }, null, 2) + "\n");
}
main().catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });
