import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { runRetainedTweetLunaReview } from "../../../../web/lib/sources/tweetLunaReview";
import { createLunaTransport } from "../../../../web/lib/sources/tweetLunaTransport";
import { openLunaLocalAdmission } from "../../../../web/lib/sources/tweetLunaLocalStore";
import { scoreLunaEvaluation } from "../../../../web/lib/sources/tweetLunaEvaluationScoring";

// OFFLINE ONLY. No env/key loader, real fetch, activation, or paid dispatch option.
async function main() {
  assert.equal(process.argv.length, 2, "no_dispatch_or_other_arguments_supported");
  const root = resolve(".."), base = join(root, "tasks/artifacts/luna-reference-package-2026-10-31");
  const dir = join(base, "continuation-v4-e03"), read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
  const sha = (p: string) => createHash("sha256").update(readFileSync(p) as unknown as Uint8Array).digest("hex");
  const plan = read(join(dir, "PLAN.json")), packets = read(join(dir, "PACKETS.json")), wire = read(join(dir, "REQUESTS.json"));
  assert.equal(sha(join(dir, "PLAN.json")), "4714db6b50a246bc05ca2b7cd8f6f90a45e01d39e3a8627e0fece91da9016946");
  assert.equal(sha(join(dir, "PACKETS.json")), plan.basePins.packetsSha256);
  assert.equal(sha(join(dir, "REQUESTS.json")), plan.basePins.requestsSha256);
  for (const [p, hash] of Object.entries(plan.applicationPins)) assert.equal(sha(join(root, p)), hash);
  const paidPath = join(root, plan.basePins.realLedgerPath), paidBefore = readFileSync(paidPath);
  assert.equal(sha(paidPath), plan.basePins.realLedgerSha256);
  const original = read(paidPath), originalHashes = Object.keys(original.attempts);
  assert.equal(original.enabled, false); assert.equal(original.blockedReason, "bounded_continuation_stopped");
  assert.equal(originalHashes.length, 3); assert.equal(original.maxCalls, 20);
  const history = read(join(base, "paid-evaluation/HISTORICAL-LEDGER-READBACK.json"));
  assert.equal(sha(history.path), plan.basePins.historicalLedgerSha256);
  const previousBatch = read(join(base, "omission-diagnosis/rehearsal/batch.json"));
  const previousWire = read(join(base, "omission-diagnosis/rehearsal/requests.json"));
  const mockLedger = read(join(base, "omission-diagnosis/rehearsal/SYNTHETIC-ONLY-ledger.json"));
  const expectedIds = Array.from({ length: 14 }, (_, i) => `E${String(i + 3).padStart(2, "0")}`);
  assert.deepEqual(plan.selectedCaseIds, expectedIds);
  assert.deepEqual(packets.entries.map((e: any) => e.id), expectedIds);
  assert.deepEqual(packets.entries, previousBatch.content.entries.slice(2));
  assert.deepEqual(wire.requests, previousWire.requests.filter((r: any) => !["E01", "E02"].includes(r.caseId)));
  assert.equal(wire.requests.length, 17); assert.equal(new Set(wire.requests.map((r: any) => r.hash)).size, 17);
  assert.equal(wire.requests.filter((r: any) => r.endpoint === "responses").length, 14);
  assert.deepEqual(wire.requests.filter((r: any) => r.endpoint === "decisions").map((r: any) => r.caseId), ["E06", "E10", "E11"]);
  assert.equal(packets.provenance.independentHoldout, false);
  assert.equal(packets.provenance.split, "exposed_synthetic_development");
  for (const entry of packets.entries) {
    assert.equal(identityDigest(entry.input), entry.inputHash);
    assert.equal(identityDigest(entry.expected), entry.expectedHash);
    assert.deepEqual(read(join(dir, "inputs", `${entry.id}.json`)), entry.input);
  }
  for (const [i, r] of wire.requests.entries()) {
    assert.equal(r.hash, identityDigest({ endpoint: r.endpoint, body: r.body }));
    assert.equal(original.attempts[r.hash], undefined);
    assert.deepEqual(plan.sequence[i], { sequence: i + 1, cumulativeCallNumber: i + 4,
      caseId: r.caseId, endpoint: r.endpoint, hash: r.hash, bytes: r.bytes });
    assert.equal(Buffer.byteLength(JSON.stringify(r.body)), r.bytes);
    assert(r.bytes <= 65_536);
    if (r.endpoint === "responses") {
      const input = JSON.parse(r.body.input);
      assert.deepEqual(input.referencePackage, plan.referencePackage);
      assert.equal(input.developmentExamples, undefined); assert.equal(input.developmentLibrary, undefined);
    }
  }
  const exposure = (ledger: any) => ledger.priorExposureNanoUsd + Object.values(ledger.attempts)
    .reduce<number>((sum, a: any) => sum + (a.receipt?.chargeNanoUsd ?? a.reservedNanoUsd), 0);
  assert.equal(exposure(original), 263_485_646);
  assert.equal(plan.budget.maximumAdditionalExposureNanoUsd, original.capNanoUsd - exposure(original));
  const now = () => "2026-10-31T21:10:00Z", summaries = [], normalResults = [];
  for (const scenario of ["all-pass", "uncertain-first-call", "label-mismatch-first-report", "disabled-ledger", "insufficient-reservation"]) {
    const tmp = mkdtempSync(join(tmpdir(), "luna-continuation-offline-"));
    try {
      const path = join(tmp, "SYNTHETIC-ONLY.json"), ledger = structuredClone(original);
      ledger.approvedPolicyId = "OFFLINE-SIMULATION-NO-PAID-AUTHORITY";
      if (scenario !== "disabled-ledger") { ledger.enabled = true; ledger.blockedReason = null; }
      if (scenario === "insufficient-reservation") ledger.capNanoUsd = exposure(original) + plan.budget.reservationNanoUsd - 1;
      writeFileSync(path, JSON.stringify(ledger));
      const admission = openLunaLocalAdmission(path, () => Date.parse(now()));
      const dispatched: string[] = [], results = []; let stopped = false, active = packets.entries[0];
      const transport = createLunaTransport({ enabled: true, stopped: () => stopped, apiKey: () => "offline-not-a-credential", admission,
        fetch: async (url, init) => {
          const endpoint = String(url).endsWith("/responses") ? "responses" : "decisions";
          const body = JSON.parse(String(init?.body)), hash = identityDigest({ endpoint, body });
          const expected = wire.requests[dispatched.length];
          assert(expected && expected.caseId === active.id && expected.endpoint === endpoint && expected.hash === hash, "unfrozen_request");
          dispatched.push(hash); assert(dispatched.length <= 17);
          if (scenario === "uncertain-first-call") throw new Error("synthetic_unknown_outcome");
          const reply = structuredClone(mockLedger.attempts[hash].receipt.body);
          if (scenario === "label-mismatch-first-report" && endpoint === "responses") {
            const content = reply.output[0].content[0], output = JSON.parse(content.text);
            output.goalieStatuses = []; content.text = JSON.stringify(output);
          }
          return new Response(JSON.stringify(reply), { headers: { "x-request-id": `offline-continuation-${active.id}-${endpoint}` } });
        } });
      for (const entry of packets.entries) {
        active = entry;
        const review = await runRetainedTweetLunaReview({ enabled: true, input: entry.input, transport, now });
        const score = scoreLunaEvaluation(entry.expected, review);
        results.push({ caseId: entry.id, score, review });
        if (review.status !== "review_only" || !score.labelMatch || review.holds.includes("decisions_unresolved")) { stopped = true; break; }
      }
      const end = read(path);
      for (const hash of originalHashes) assert.deepEqual(end.attempts[hash], original.attempts[hash]);
      for (const field of ["priorExposureNanoUsd", "maxCalls", "expiresAt"]) assert.deepEqual(end[field], original[field]);
      if (scenario !== "insufficient-reservation") assert.equal(end.capNanoUsd, original.capNanoUsd);
      let request21Rejected = false;
      if (scenario === "all-pass") {
        assert.equal(stopped, false); assert.equal(results.length, 14); assert.equal(dispatched.length, 17);
        assert.equal(Object.keys(end.attempts).length, 20); assert.equal(end.blockedReason, null);
        await assert.rejects(admission.reserve("0".repeat(64), plan.budget.reservationNanoUsd), /luna_budget_exhausted/);
        request21Rejected = true; normalResults.push(...results);
      } else {
        assert.equal(stopped, true); assert.equal(results.length, 1);
        assert.equal(dispatched.length, scenario === "disabled-ledger" || scenario === "insufficient-reservation" ? 0 : 1);
        if (scenario === "uncertain-first-call") {
          assert.equal(end.attempts[wire.requests[0].hash].state, "uncertain");
          assert.equal(end.attempts[wire.requests[0].hash].reservedNanoUsd, plan.budget.reservationNanoUsd);
          assert.equal(end.blockedReason, "unknown_billed_outcome");
        }
      }
      summaries.push({ scenario, reportsReached: results.length, newMockCalls: dispatched.length,
        simulatedTotalAttempts: Object.keys(end.attempts).length, startingAttemptsPreserved: true,
        aggregateExposureNanoUsd: exposure(end), stopped, request21Rejected, blockedReason: end.blockedReason,
        firstReportScore: results[0].score, dispatchedHashes: dispatched });
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  assert.deepEqual(readFileSync(paidPath), paidBefore);
  assert.equal(sha(history.path), plan.basePins.historicalLedgerSha256);
  const output = { version: "luna-v4-e03-continuation-offline-verification-v1", planSha256: sha(join(dir, "PLAN.json")),
    allPacketsLabelsBindingsUnchanged: true, excludedE01: true, excludedE02: true, actualProviderRequests: 0, retries: 0,
    realLedgerUnchangedAndDisabled: true, historicalLedgerUnchanged: true, scenarios: summaries };
  writeFileSync(join(dir, "OFFLINE-VERIFICATION.json"), JSON.stringify(output, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  writeFileSync(join(dir, "OFFLINE-RESULTS.json"), JSON.stringify(normalResults, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify({ ...output, scenarios: summaries.map(({ dispatchedHashes, ...s }) => s) }, null, 2) + "\n");
}
main().catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });
