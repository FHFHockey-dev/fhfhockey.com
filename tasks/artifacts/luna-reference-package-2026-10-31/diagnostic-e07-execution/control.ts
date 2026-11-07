import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, openSync, closeSync, fsyncSync, renameSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { classifyDiagnosticReport } from "../diagnostic-e07-e16-r2/diagnostic-policy";
import { prepareDiagnosticCheckpoint, verifyDiagnosticHistory, serializeDiagnosticArtifact, type DiagnosticCheckpointAnchor } from "../diagnostic-e07-e16-r2/diagnostic-checkpoint";

// Manual one-report supervisor. No credential loader, HTTP, retries or case loop.
export const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
export const sha = (path: string) => createHash("sha256").update(readFileSync(path) as unknown as Uint8Array).digest("hex");
export function save(path: string, value: unknown) {
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, serializeDiagnosticArtifact(value)); fsyncSync(fd); } finally { closeSync(fd); }
  const folder = openSync(dirname(path), "r"); try { fsyncSync(folder); } finally { closeSync(folder); }
}
export function stop(path: string, reason: string) {
  const lock = `${path}.lock`, fd = openSync(lock, "wx", 0o600);
  try {
    const ledger = read(path); ledger.enabled = false; ledger.blockedReason ??= reason;
    const pending = `${path}.stop`; save(pending, ledger); renameSync(pending, path);
    const folder = openSync(dirname(path), "r"); try { fsyncSync(folder); } finally { closeSync(folder); }
  } finally { closeSync(fd); unlinkSync(lock); }
}
type Config = { root: string; directory: string; ledgerPath: string; now?: () => number };
export async function operate(config: Config, action: "preflight" | "grade", id: string,
  anchors: DiagnosticCheckpointAnchor[], cliExitCode?: number, preflightHash?: string) {
  const { root, directory: dir, ledgerPath } = config, now = config.now ?? Date.now;
  const base = join(root, "tasks/artifacts/luna-reference-package-2026-10-31"), frozen = join(base, "diagnostic-e07-e16-r2");
  try {
    assert.equal(sha(join(frozen, "FILE-PINS.json")), "a198008bd70525a4f70f30b7d283db46e5834623dad7c1b180494c79c1a544e1");
    const manifest = read(join(frozen, "FILE-PINS.json")), plan = read(join(frozen, "PLAN.json"));
    for (const [file, hash] of Object.entries(manifest.applicationPins)) assert.equal(sha(join(root, file)), hash);
    for (const [file, hash] of Object.entries(manifest.files)) assert.equal(sha(join(frozen, file)), hash);
    assert.equal(sha(join(dir, "START-LEDGER.json")), plan.basePins.realLedgerSha256);
    assert.equal(sha(read(join(base, "paid-evaluation/HISTORICAL-LEDGER-READBACK.json")).path), plan.basePins.historicalLedgerSha256);
    const start = { ...read(join(dir, "START-LEDGER.json")), ...plan.activationProposalOnly.setOnlyAfterReview };
    const entries = read(join(frozen, "PACKETS.json")).entries, entry = entries[anchors.length];
    assert(entry && entry.id === id, "case_sequence_changed");
    assert.equal(identityDigest(read(join(frozen, "inputs", `${id}.json`))), entry.inputHash);
    const requests = read(join(frozen, "REQUESTS.json")).requests.filter((r: any) => r.caseId === id);
    const ledger = read(ledgerPath), rows = Object.entries(ledger.attempts).map(([hash, a]: [string, any]) => ({ hash, ...a }));
    const exposure = ledger.priorExposureNanoUsd + rows.reduce((sum, a) => sum + (a.receipt?.chargeNanoUsd ?? a.reservedNanoUsd), 0);
    assert(rows.length <= 19 && exposure <= 1_000_000_000);
    const history = (state: any, expectedAnchors = anchors) => verifyDiagnosticHistory({ directory: dir, anchors: expectedAnchors,
      expectedCaseIds: plan.selectedCaseIds, startingLedger: start, currentLedger: state });
    const prePath = join(dir, `${id}.preflight.json`);
    if (action === "preflight") {
      history(ledger);
      assert(!existsSync(`${ledgerPath}.lock`));
      assert(ledger.enabled && ledger.blockedReason === null && now() < Date.parse(ledger.expiresAt));
      const live = read(join(dir, "LIVE-PREFLIGHT.json"));
      assert(now() >= Date.parse(live.checkedAt) && now() - Date.parse(live.checkedAt) < 30 * 60_000);
      assert(now() < Date.parse(live.funding.promotionalExpiresOn) && live.funding.promotionalDisplayedUsd > 6);
      assert(live.noSettingsChanged && live.concurrentSpendChecked && live.access.localMaskMatch && live.access.status === "Active");
      assert.deepEqual(live.access.permissions, ["api.responses.write", "api.responses.read", "api.decisions.write"]);
      assert.equal(live.planSha256, sha(join(frozen, "PLAN.json")));
      assert(rows.length + requests.length <= 19 && exposure + plan.budget.reservationNanoUsd <= ledger.capNanoUsd);
      for (const r of requests) assert(!ledger.attempts[r.hash], "no_retry");
      for (const kind of ["original", "candidate", "receipts", "diagnostic", "checkpoint", "preflight", "result"]) assert(!existsSync(join(dir, `${id}.${kind}.json`)), "no_overwrite");
      save(prePath, { caseId: id, checkedAt: new Date(now()).toISOString(), anchors, ledger, expectedRequestHashes: requests.map((r: any) => r.hash) });
      return { ready: true, caseId: id, preflightHash: sha(prePath), priorCalls: rows.length, exposureNanoUsd: exposure };
    }
    assert.equal(sha(prePath), preflightHash, "preflight_changed");
    const pre = read(prePath); assert.deepEqual(pre.anchors, anchors); assert.equal(pre.caseId, id);
    history(pre.ledger); // Recheck all earlier artifacts and the trusted pre-call ledger.
    const review = read(join(dir, `${id}.original.json`)), candidate = read(join(dir, `${id}.candidate.json`));
    const current = rows.slice(Object.keys(pre.ledger.attempts).length);
    const diagnostic = await classifyDiagnosticReport({ input: entry.input, expected: entry.expected, originalReview: review,
      attempts: current, requests, cliExitCode: cliExitCode!, checkedAt: new Date(now()).toISOString() });
    // Stop first on an operational failure, including an unknown outcome.
    if (!diagnostic.mayAdvanceDiagnosticSequence) stop(ledgerPath, "diagnostic_operational_stop");
    save(join(dir, `${id}.receipts.json`), current); save(join(dir, `${id}.diagnostic.json`), diagnostic);
    let anchor: DiagnosticCheckpointAnchor | null = null;
    if (diagnostic.mayAdvanceDiagnosticSequence) {
      const sealed = prepareDiagnosticCheckpoint({ directory: dir, caseId: id, previousAnchor: anchors.at(-1) ?? null,
        beforeLedger: pre.ledger, afterLedger: ledger, expectedRequestHashes: requests.map((r: any) => r.hash),
        artifacts: { original: review, receipts: current, candidate, diagnostic } });
      save(join(dir, `${id}.checkpoint.json`), sealed.checkpoint); anchor = sealed.anchor;
      history(read(ledgerPath), [...anchors, anchor]);
      if (id === "E16") stop(ledgerPath, "diagnostic_collection_completed");
    }
    const final = read(ledgerPath);
    const result = { caseId: id, outcome: diagnostic.outcome, rawGrade: diagnostic.rawGrade, reason: diagnostic.reason,
      decisionsDisposition: diagnostic.decisionsDisposition, anchor, candidateAvailable: Boolean(candidate.content), candidateApplied: false,
      callsThisReport: current.length, cumulativeCalls: rows.length, exposureNanoUsd: exposure,
      currentChargeNanoUsd: current.reduce((sum, a) => sum + (a.receipt?.chargeNanoUsd ?? 0), 0),
      ledgerEnabled: final.enabled, blockedReason: final.blockedReason, proceed: diagnostic.mayAdvanceDiagnosticSequence && id !== "E16" };
    save(join(dir, `${id}.result.json`), result); return result;
  } catch {
    stop(ledgerPath, "diagnostic_operator_check_failed");
    throw new Error("Diagnostic stopped durably; no retry or further invocation.");
  }
}
if (require.main === module) {
  const root = resolve(".."), dir = join(root, "tasks/artifacts/luna-reference-package-2026-10-31/diagnostic-e07-execution");
  const config = { root, directory: dir, ledgerPath: join(dir, "../paid-evaluation/ledger.json") };
  const [action, id, anchors, exitCode, hash] = process.argv.slice(2);
  if (action === "stop") stop(config.ledgerPath, "diagnostic_operator_check_failed");
  else operate(config, action as "preflight" | "grade", id!, JSON.parse(anchors!), exitCode === undefined ? undefined : Number(exitCode), hash)
    .then(result => { process.stdout.write(JSON.stringify(result) + "\n"); if ("proceed" in result && !result.proceed && result.caseId !== "E16") process.exitCode = 2; })
    .catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 2; });
}
