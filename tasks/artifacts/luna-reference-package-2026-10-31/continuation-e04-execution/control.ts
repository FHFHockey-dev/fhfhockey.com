import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, openSync, closeSync, fsyncSync, renameSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { scoreLunaEvaluation } from "../../../../web/lib/sources/tweetLunaEvaluationScoring";

// Offline operator checks/scoring only; no credential loader, activation, or HTTP.
const root = resolve(".."), base = join(root, "tasks/artifacts/luna-reference-package-2026-10-31");
const dir = join(base, "continuation-e04-execution"), frozen = join(base, "continuation-v4-e04"), ledgerPath = join(base, "paid-evaluation/ledger.json");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sha = (p: string) => createHash("sha256").update(readFileSync(p) as unknown as Uint8Array).digest("hex");
const save = (name: string, value: unknown) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
const [action, id, cliExitCode] = process.argv.slice(2), plan = read(join(frozen, "PLAN.json")), start = read(join(dir, "START-LEDGER.json"));
const ledger = read(ledgerPath), entries = read(join(frozen, "PACKETS.json")).entries;
function stop(reason: string) {
  // Use the store's lock and re-read before mutation; never overwrite a concurrent reservation.
  const lock = `${ledgerPath}.lock`, lockFd = openSync(lock, "wx", 0o600);
  try {
    const latest = read(ledgerPath);
    latest.enabled = false; latest.blockedReason ??= reason;
    const tmp = `${ledgerPath}.stop`, fd = openSync(tmp, "wx", 0o600);
    try { writeFileSync(fd, JSON.stringify(latest, null, 2) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp, ledgerPath);
    const directory = openSync(dirname(ledgerPath), "r");
    try { fsyncSync(directory); } finally { closeSync(directory); }
    Object.assign(ledger, latest);
  } finally { closeSync(lockFd); unlinkSync(lock); }
}
try {
  assert(action === "preflight" || action === "grade");
  const index = entries.findIndex((e: any) => e.id === id); assert(index >= 0);
  const entry = entries[index], beforeIds = entries.slice(0, index).map((e: any) => e.id);
  assert.equal(sha(join(frozen, "PLAN.json")), "32d4048054109b84258c70800f679809077e3bf7ffe03b2e85a833ee487d3ab1");
  assert.equal(sha(join(frozen, "FILE-PINS.json")), "dac5a4041ca57cb571fe4360952526475bcdc7b4b873488f1bda3509ba83018a");
  const manifest = read(join(frozen, "FILE-PINS.json"));
  for (const [file, hash] of Object.entries(manifest.applicationPins)) assert.equal(sha(join(root, file)), hash);
  for (const [file, hash] of Object.entries(manifest.artifacts)) assert.equal(sha(join(frozen, file)), hash);
  assert.equal(sha(join(frozen, "PACKETS.json")), plan.basePins.packetsSha256);
  assert.equal(sha(join(frozen, "REQUESTS.json")), plan.basePins.requestsSha256);
  const historical = read(join(base, "paid-evaluation/HISTORICAL-LEDGER-READBACK.json"));
  assert.equal(sha(historical.path), plan.basePins.historicalLedgerSha256);
  assert.equal(sha(join(dir, "START-LEDGER.json")), plan.basePins.realLedgerSha256);
  for (const hash of Object.keys(start.attempts)) assert.deepEqual(ledger.attempts[hash], start.attempts[hash]);
  for (const field of ["version", "priorExposureNanoUsd", "capNanoUsd", "maxCalls", "expiresAt"]) assert.deepEqual(ledger[field], start[field]);
  assert.equal(ledger.approvedPolicyId, plan.activationProposalOnly.setOnlyAfterReview.approvedPolicyId);
  assert(!existsSync(`${ledgerPath}.lock`));
  assert.equal(identityDigest(read(join(frozen, "inputs", `${id}.json`))), entry.inputHash);
  for (const previous of beforeIds) assert.equal(read(join(dir, `grade-${previous}.json`)).proceed, true);
  const before = plan.sequence.filter((r: any) => beforeIds.includes(r.caseId));
  const currentPlan = plan.sequence.filter((r: any) => r.caseId === id);
  const attempts = Object.entries(ledger.attempts) as [string, any][];
  const allowed = [...Object.keys(start.attempts), ...before.map((r: any) => r.hash), ...currentPlan.map((r: any) => r.hash)];
  assert(attempts.length <= 20 && attempts.every(([hash], i) => hash === allowed[i]), "request_prefix_mismatch");
  const exposure = ledger.priorExposureNanoUsd + attempts.reduce((sum, [, a]) => sum + (a.receipt?.chargeNanoUsd ?? a.reservedNanoUsd), 0);
  assert(exposure <= ledger.capNanoUsd);
  const output = join(dir, "reviews", `${id}.json`), candidatePath = join(dir, "candidates", `${id}.json`);
  if (action === "preflight") {
    const live = read(join(dir, "LIVE-PREFLIGHT.json"));
    assert(Date.now() >= Date.parse(live.checkedAt) && Date.now() - Date.parse(live.checkedAt) < 30 * 60_000 && Date.now() < Date.parse(live.funding.promotionalExpiresOn));
    assert(live.noSettingsChanged && live.concurrentSpendChecked && live.access.status === "Active");
    assert.deepEqual(live.access.permissions, ["api.responses.write", "api.responses.read", "api.decisions.write"]);
    assert.equal(live.planSha256, sha(join(frozen, "PLAN.json")));
    assert(live.access.localMaskMatch && live.funding.promotionalDisplayedUsd > 6);
    assert(Date.now() < Date.parse(ledger.expiresAt) && ledger.enabled && ledger.blockedReason === null);
    assert.equal(attempts.length, Object.keys(start.attempts).length + before.length); assert(attempts.every(([, a]) => a.state === "settled"));
    assert(!existsSync(output) && !existsSync(candidatePath) && !existsSync(join(dir, `grade-${id}.json`)), "no_retry");
    assert(exposure + plan.budget.reservationNanoUsd <= ledger.capNanoUsd);
    const result = { caseId: id, checkedAt: new Date().toISOString(), priorCalls: attempts.length,
      aggregateExposureNanoUsd: exposure, expectedHashes: currentPlan.map((r: any) => r.hash), ready: true };
    save(`preflight-${id}.json`, result); process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    const candidate = read(candidatePath);
    const review = read(output), score = scoreLunaEvaluation(entry.expected, review), current = attempts.slice(Object.keys(start.attempts).length + before.length);
    const proceed = cliExitCode === "0" && review.status === "review_only" && score.labelMatch && !review.holds.includes("decisions_unresolved")
      && attempts.length === allowed.length && attempts.every(([, a]) => a.state === "settled") && ledger.blockedReason === null;
    if (!proceed || index === entries.length - 1) stop(proceed ? "bounded_continuation_completed" : "bounded_continuation_stopped");
    const result = { caseId: id, cliExitCode: Number(cliExitCode), candidateArtifactSha256: sha(candidatePath), candidateVersion: candidate.version ?? null, originalReviewAloneScored: true, scoredAt: new Date().toISOString(), status: review.status, score, holds: review.holds, proceed,
      callsThisReport: current.length, cumulativeCalls: attempts.length, aggregateExposureNanoUsd: exposure,
      usagePricedCeilingNanoUsd: current.reduce((sum, [, a]) => sum + (a.receipt?.chargeNanoUsd ?? 0), 0),
      requestIds: review.requestIds, providerUsage: current.map(([hash, a]) => ({ hash, state: a.state,
        endpoint: a.receipt?.endpoint ?? null, requestId: a.receipt?.requestId ?? a.requestId ?? null,
        model: a.receipt?.body?.model ?? null, usage: a.receipt?.body?.usage ?? null })), ledgerEnabled: ledger.enabled, ledgerBlockedReason: ledger.blockedReason };
    save(`grade-${id}.json`, result); process.stdout.write(JSON.stringify(result) + "\n");
    if (!proceed) process.exitCode = 2;
  }
} catch {
  stop("continuation_operator_check_failed");
  process.stderr.write("Continuation held; durable ledger disabled. No further invocation or automatic retry.\n"); process.exitCode = 2;
}
