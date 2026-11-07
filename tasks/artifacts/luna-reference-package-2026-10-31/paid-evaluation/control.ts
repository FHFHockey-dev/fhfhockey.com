import { readFileSync, writeFileSync, existsSync, openSync, closeSync, fsyncSync, renameSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { scoreLunaEvaluation } from "../../../../web/lib/sources/tweetLunaEvaluationScoring";

// Operational checks/scoring only. No credentials, environment loading or HTTP.
const root = resolve(".."), base = join(root, "tasks/artifacts/luna-reference-package-2026-10-31/paid-evaluation");
const r2 = join(base, "../repair-r2"), ledgerPath = join(base, "ledger.json");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path) as unknown as Uint8Array).digest("hex");
const save = (name: string, value: unknown) => writeFileSync(join(base, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
const plan = read(join(base, "EXECUTION-PLAN.json")), pins = read(join(r2, "FILE-PINS.json"));
const batch = read(join(r2, "rehearsal/batch.json")), ledger = read(ledgerPath);
const [action, caseId] = process.argv.slice(2), index = batch.content.entries.findIndex((e: any) => e.id === caseId);
if (!["preflight", "grade"].includes(action!) || index < 0) throw new Error("unknown_operation");
const entry = batch.content.entries[index], output = join(base, "reviews", `${caseId}.json`);
const assert = (ok: unknown, reason: string) => { if (!ok) throw new Error(reason); };
assert(sha(join(r2, "FILE-PINS.json")) === plan.r2PinsSha256 && identityDigest(batch.content) === plan.batchHash, "reviewed_plan_changed");
for (const [file, hash] of Object.entries({ ...pins.deliverables, ...pins.protected })) assert(sha(join(root, file)) === hash, "reviewed_source_changed");
const history = read(join(base, "HISTORICAL-LEDGER-READBACK.json"));
assert(sha(history.path) === plan.historicalLedgerSha256 && history.exposureNanoUsd === plan.budget.priorExposureNanoUsd, "historical_exposure_changed");
assert(!existsSync(`${ledgerPath}.lock`), "concurrent_ledger_operation");
assert(ledger.approvedPolicyId === plan.approvedPolicyId && ledger.capNanoUsd === plan.budget.capNanoUsd
  && ledger.priorExposureNanoUsd === plan.budget.priorExposureNanoUsd && ledger.maxCalls === 20 && plan.budget.maxRetries === 0
  && ledger.expiresAt === plan.budget.expiresAt, "continuation_policy_changed");
assert(identityDigest(read(join(base, "inputs", `${caseId}.json`))) === entry.inputHash, "input_changed");
const priorCases = batch.content.entries.slice(0, index).map((e: any) => e.id);
for (const id of priorCases) assert(read(join(base, `grade-${id}.json`)).proceed === true, "prior_case_did_not_pass");
const priorRequests = plan.plannedRequests.filter((r: any) => priorCases.includes(r.caseId));
const planned = plan.plannedRequests.filter((r: any) => [...priorCases, caseId].includes(r.caseId));
const attempts = Object.entries(ledger.attempts) as [string, any][];
assert(attempts.length <= 20 && attempts.every(([hash], i) => planned[i]?.hash === hash), "request_sequence_mismatch");
const exposure = ledger.priorExposureNanoUsd + attempts.reduce((sum, [, a]) => sum + (a.receipt?.chargeNanoUsd ?? a.reservedNanoUsd), 0);
assert(exposure <= ledger.capNanoUsd, "aggregate_cap_exceeded");
if (action === "preflight") {
  const funding = read(join(base, "FUNDING-AND-SCOPE.json"));
  assert(Date.now() - Date.parse(funding.observedAt) < 30 * 60_000 && Date.now() < Date.parse(funding.promotionalExpiresOn), "funding_recheck_required");
  assert(funding.promotionalRemainingNanoUsd > ledger.capNanoUsd + funding.safetyReserveNanoUsd && funding.keyMatchVerifiedInMemory, "funding_or_access_unverified");
  assert(Date.now() < Date.parse(ledger.expiresAt) && ledger.enabled && ledger.blockedReason === null, "ledger_stopped");
  assert(attempts.length === priorRequests.length && attempts.every(([, a]) => a.state === "settled"), "prior_attempt_unresolved");
  assert(!existsSync(output) && !existsSync(join(base, `grade-${caseId}.json`)), "case_already_attempted_no_retry");
  assert(exposure + plan.budget.reservationNanoUsd <= ledger.capNanoUsd, "insufficient_reservation_headroom");
  const record = { caseId, checkedAt: new Date().toISOString(), approvedRequestHashes: planned.slice(priorRequests.length).map((r: any) => r.hash),
    priorAdmittedRequests: attempts.length, aggregateExposureNanoUsd: exposure, maxTotalRequests: 20, maxRetries: 0, ready: true };
  save(`preflight-${caseId}.json`, record); process.stdout.write(JSON.stringify(record) + "\n");
} else {
  const review = read(output), score = scoreLunaEvaluation(entry.expected, review);
  const current = attempts.slice(priorRequests.length);
  const proceed = review.status === "review_only" && score.labelMatch && !review.holds.includes("decisions_unresolved")
    && attempts.length === planned.length && attempts.every(([, a]) => a.state === "settled") && ledger.blockedReason === null;
  const result = { caseId, scoredAt: new Date().toISOString(), status: review.status, score, holds: review.holds, proceed,
    admittedRequests: current.length, requestIds: review.requestIds, usagePricedCeilingNanoUsd: current.reduce((sum, [, a]) => sum + (a.receipt?.chargeNanoUsd ?? 0), 0),
    aggregateExposureNanoUsd: exposure, reportProcessDurationMs: Math.round(statSync(output).mtimeMs - statSync(output).birthtimeMs),
    providerUsage: current.map(([hash, a]) => ({ hash, state: a.state, endpoint: a.receipt?.endpoint ?? null,
      model: a.receipt?.body?.model ?? null, usage: a.receipt?.body?.usage ?? null, requestId: a.receipt?.requestId ?? a.requestId ?? null })) };
  save(`grade-${caseId}.json`, result);
  if (!proceed || index === batch.content.entries.length - 1) {
    ledger.enabled = false; ledger.blockedReason ??= proceed ? "bounded_evaluation_completed" : "bounded_evaluation_stopped";
    const tmp = `${ledgerPath}.close`, fd = openSync(tmp, "wx", 0o600);
    try { writeFileSync(fd, JSON.stringify(ledger, null, 2) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp, ledgerPath);
  }
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!proceed) process.exitCode = 2;
}
