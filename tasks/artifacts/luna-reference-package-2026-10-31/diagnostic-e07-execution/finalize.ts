import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { read, sha, save } from "./control";
import { verifyDiagnosticHistory } from "../diagnostic-e07-e16-r2/diagnostic-checkpoint";

// Expected anchors copied from supervisor-observed successful grading results,
// not recalculated from mutable artifacts. Read-only reconciliation; no API.
const anchors = [
  { caseId: "E07", sha256: "a3417e922a78c83b5aead29e284ce93fcaf874f4a1797999da3bee8265b27d09" },
  { caseId: "E08", sha256: "ca546fe2cecd1bd6f6a9f7b05d454d077473d55d10cc4c1ba6d2ca6fadd844d6" },
  { caseId: "E09", sha256: "6e73c855576c8f570ff5b86ba9b3bfd90c56c407e212a05493949572aa6951e6" },
  { caseId: "E10", sha256: "2afcd0fa848f54e6b05b62810f8edd10e9e937ef929a88aae63ceec7adb434bd" },
  { caseId: "E11", sha256: "57bbfb7a110aba4f4b095080da675d7cb2cdbda8c3350181043edc175be8c24a" },
  { caseId: "E12", sha256: "214e4e143f896af872503f2651e7e0cf045d560d756f18d01c5967a53c98f4f3" },
  { caseId: "E13", sha256: "43ddbad54dccacb0e7c788edfbbf53fa0d4fa5aee7c73a1407b97e6c42e59226" },
  { caseId: "E14", sha256: "59ee11738843e5a94bb6c17efc1f7e3ef4d0d12613ca853dbabd903c8ca1a256" },
  { caseId: "E15", sha256: "6bac0dbd6726b22decfdc6044963ccadacf180964389d95a88766f98aa214966" },
  { caseId: "E16", sha256: "93220e25d2c81e507037c9a8eabe538e86278a9fbedb37e7e43d22ca3b0cbed7" },
];
const root = resolve(".."), base = join(root, "tasks/artifacts/luna-reference-package-2026-10-31"), dir = join(base, "diagnostic-e07-execution"), frozen = join(base, "diagnostic-e07-e16-r2");
const ledgerPath = join(base, "paid-evaluation/ledger.json"), originalBytes = readFileSync(ledgerPath), ledger = read(ledgerPath), start = read(join(dir, "START-LEDGER.json"));
const plan = read(join(frozen, "PLAN.json")), manifest = read(join(frozen, "FILE-PINS.json"));
assert.equal(sha(join(frozen, "FILE-PINS.json")), "a198008bd70525a4f70f30b7d283db46e5834623dad7c1b180494c79c1a544e1");
for (const [file, hash] of Object.entries(manifest.applicationPins)) assert.equal(sha(join(root, file)), hash);
for (const [file, hash] of Object.entries(manifest.files)) assert.equal(sha(join(frozen, file)), hash);
for (const [file, hash] of Object.entries(read(join(dir, "OPERATOR-PINS.json")))) assert.equal(sha(join(dir, file)), hash);
assert.equal(ledger.enabled, false); assert.equal(ledger.blockedReason, "diagnostic_collection_completed");
assert(!existsSync(`${ledgerPath}.lock`)); assert.equal(Object.keys(ledger.attempts).length, 17);
for (const [hash, row] of Object.entries(start.attempts)) assert.deepEqual(ledger.attempts[hash], row);
for (const field of ["version", "priorExposureNanoUsd", "capNanoUsd", "maxCalls", "expiresAt"]) assert.deepEqual(ledger[field], start[field]);
const activatedStart = { ...start, ...plan.activationProposalOnly.setOnlyAfterReview };
// Model the verified pre-stop state in memory only. The real ledger stays disabled.
verifyDiagnosticHistory({ directory: dir, anchors, expectedCaseIds: plan.selectedCaseIds, startingLedger: activatedStart,
  currentLedger: { ...ledger, enabled: true, blockedReason: null } });
const history = read(join(base, "paid-evaluation/HISTORICAL-LEDGER-READBACK.json"));
assert.equal(sha(history.path), plan.basePins.historicalLedgerSha256);
const rows = Object.entries(ledger.attempts).slice(7).map(([hash, row]: [string, any]) => ({ hash, ...row }));
const wire = read(join(frozen, "REQUESTS.json")).requests;
assert.deepEqual(rows.map(r => r.hash), wire.filter((r: any) => r.endpoint === "responses").map((r: any) => r.hash));
assert(rows.every(r => r.state === "settled" && r.receipt.endpoint === "responses"));
const packets = read(join(frozen, "PACKETS.json")).entries;
const reports = packets.map((entry: any) => {
  const id = entry.id, result = read(join(dir, `${id}.result.json`)), diagnostic = read(join(dir, `${id}.diagnostic.json`));
  const receipt = read(join(dir, `${id}.receipts.json`))[0].receipt, raw = JSON.parse(receipt.body.output[0].content[0].text);
  const candidate = read(join(dir, `${id}.candidate.json`)), source: string = entry.input.packet.source.text;
  const evidence = raw.goalieStatuses.map((g: any) => {
    const quote: string = g.evidence.text, start = source.indexOf(quote), unique = start >= 0 && source.indexOf(quote, start + 1) === -1;
    return { occurrenceId: g.occurrenceId, status: g.status, supplied: g.evidence,
      originalUtf16Slice: source.slice(g.evidence.start, g.evidence.end), exactOriginalSpan: source.slice(g.evidence.start, g.evidence.end) === quote,
      uniqueExactQuote: unique, exactLocatedSpan: unique ? { start, end: start + quote.length, text: quote } : null };
  });
  assert.deepEqual(result.rawGrade, diagnostic.rawGrade); assert.deepEqual(result.anchor, anchors.find(a => a.caseId === id));
  return { caseId: id, source, result, requestId: receipt.requestId, model: receipt.body.model, usage: receipt.body.usage,
    originalRawGoalieEvidence: evidence, candidateAvailable: Boolean(candidate.content), candidateApplied: false,
    candidateCorrections: candidate.content?.derivation.corrections ?? [], canPublish: false };
});
const failed = reports.filter((r: any) => r.result.outcome === "recorded_model_failure");
assert.deepEqual(failed.map((r: any) => r.caseId), ["E10", "E11", "E15"]);
assert(failed.every((r: any) => r.originalRawGoalieEvidence.every((g: any) => !g.exactOriginalSpan && g.uniqueExactQuote)));
const inputTokens = rows.reduce((s, r) => s + r.receipt.body.usage.input_tokens, 0), outputTokens = rows.reduce((s, r) => s + r.receipt.body.usage.output_tokens, 0);
const newCharge = rows.reduce((s, r) => s + r.receipt.chargeNanoUsd, 0);
const cumulativeCharge = Object.values(ledger.attempts).reduce<number>((s, a: any) => s + a.receipt.chargeNanoUsd, 0);
const result = { state: "completed_disabled", completedAt: new Date().toISOString(), planSha256: sha(join(frozen, "PLAN.json")),
  preparationManifestSha256: sha(join(frozen, "FILE-PINS.json")), finalLedgerSha256: sha(ledgerPath), trustedAnchors: anchors,
  reportsCompleted: reports.length, originalPasses: reports.length - failed.length, originalFailures: failed.length,
  newRequests: 10, responsesRequests: 10, decisionsRequests: 0, withheldDecisions: ["E10", "E11"], cumulativeRequests: 17,
  retries: 0, newUncertainOutcomes: 0, historicalUncertainReservationNanoUsd: 254394800,
  inputTokens, outputTokens, cachedTokens: 0, estimatedStandardRateNanoUsd: inputTokens * 100 + outputTokens * 500,
  newConservativeUsageChargeNanoUsd: newCharge, cumulativeConservativeUsageChargeNanoUsd: cumulativeCharge,
  historicalCarriedExposureNanoUsd: ledger.priorExposureNanoUsd, aggregateExposureNanoUsd: ledger.priorExposureNanoUsd + cumulativeCharge,
  aggregateCapNanoUsd: ledger.capNanoUsd, ledgerEnabled: ledger.enabled, blockedReason: ledger.blockedReason, expiry: ledger.expiresAt,
  invoiceOrGrantAttributionVerified: false, split: "exposed_synthetic_development", independentHoldout: false,
  currentPinsMatched: 263, originalSevenReceiptsPreserved: true, historicalLedgerUnchanged: true, applicationUnchanged: true,
  candidatesApplied: 0, humanBindingDecisionsRecorded: 0, productionActions: 0, reports };
save(join(dir, "RESULTS.json"), result); writeFileSync(join(dir, "FINAL-LEDGER.json"), originalBytes as unknown as Uint8Array, { flag: "wx", mode: 0o600 });
assert.deepEqual(readFileSync(ledgerPath), originalBytes);
process.stdout.write(JSON.stringify({ ...result, reports: undefined, trustedAnchors: undefined }, null, 2) + "\n");
