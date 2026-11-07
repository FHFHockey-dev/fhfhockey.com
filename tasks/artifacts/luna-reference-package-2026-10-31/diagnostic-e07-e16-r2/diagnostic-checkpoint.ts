import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";

// Inactive, read-only operator integrity helper. Hash anchors must come from the
// trusted supervising run, not be reconstructed from possibly changed files.
// These hashes detect changes; they do not authenticate a hostile local operator.
const artifactKinds = ["original", "receipts", "candidate", "diagnostic"] as const;
type Artifacts = Record<typeof artifactKinds[number], any>;
export type DiagnosticCheckpointAnchor = { caseId: string; sha256: string };
const bytesHash = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
export const DIAGNOSTIC_ARTIFACT_SERIALIZATION = "json-indent-2-trailing-newline-v1";
// Matches the unchanged review CLI exactly. Never rewrite a CLI original to fit.
export const serializeDiagnosticArtifact = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const serializedHash = (value: unknown) => bytesHash(serializeDiagnosticArtifact(value));
const metadata = (ledger: any) => { const { attempts, ...rest } = ledger; return rest; };
const rows = (ledger: any) => Object.entries(ledger.attempts).map(([hash, value]: [string, any]) => ({ hash, ...value }));
const prefix = (ledger: any, count: number) => ({ ...ledger, attempts: Object.fromEntries(Object.entries(ledger.attempts).slice(0, count)) });
const validCaseId = (id: string) => /^E(?:0[7-9]|1[0-6])$/.test(id);

/** Prove that only the current expected request prefix was appended. Compare all
 * fields of all earlier attempts/receipts and every policy/accounting field.
 */
export function assertDiagnosticLedgerExtension(before: any, after: any, expectedRequestHashes: string[]) {
  const count = Object.keys(before.attempts).length;
  assert.equal(identityDigest(prefix(after, count)), identityDigest(before), "earlier_ledger_prefix_changed");
  assert.equal(identityDigest(metadata(after)), identityDigest(metadata(before)), "ledger_policy_changed");
  const added = rows(after).slice(count);
  assert(added.length >= 1 && added.length <= expectedRequestHashes.length, "unexpected_attempt_count");
  assert.deepEqual(added.map(r => r.hash), expectedRequestHashes.slice(0, added.length), "unexpected_request_prefix");
  assert(added.every(r => r.state === "settled" && r.receipt), "unsettled_added_attempt");
  return added;
}

/** Called after all four original artifacts have been durably written. Expected
 * hashes are derived from the in-memory outputs just verified by the classifier;
 * reading a changed file cannot silently redefine its expected contents.
 */
export function prepareDiagnosticCheckpoint(args: {
  directory: string; caseId: string; previousAnchor: DiagnosticCheckpointAnchor | null;
  beforeLedger: any; afterLedger: any; expectedRequestHashes: string[]; artifacts: Artifacts;
}) {
  assert(validCaseId(args.caseId));
  const added = assertDiagnosticLedgerExtension(args.beforeLedger, args.afterLedger, args.expectedRequestHashes);
  const { original, receipts, candidate, diagnostic } = args.artifacts;
  assert.equal(identityDigest(receipts), identityDigest(added), "receipt_file_ledger_mismatch");
  assert.equal(diagnostic.originalReviewHash, identityDigest(original), "diagnostic_original_mismatch");
  assert(diagnostic.mayAdvanceDiagnosticSequence === true && ["recorded_pass", "recorded_model_failure"].includes(diagnostic.outcome));
  if (candidate?.content) {
    assert.equal(candidate.hash, identityDigest(candidate.content), "candidate_hash_invalid");
    assert.equal(candidate.content.originalReviewHash, identityDigest(original), "candidate_original_mismatch");
    assert.equal(candidate.content.receiptHash, identityDigest(added[0].receipt), "candidate_receipt_hash_mismatch");
    assert.equal(identityDigest(candidate.content.receipt), identityDigest(added[0].receipt), "candidate_receipt_mismatch");
    for (const flag of ["canApply", "canPublish", "canWriteAliases", "canChangeStatus", "canExecuteReplacement"]) assert.equal(candidate.content[flag], false);
  } else {
    assert(candidate?.candidate === null && ["held", "not_eligible"].includes(candidate.status), "explicit_candidate_absence_required");
  }
  const artifactSha256 = Object.fromEntries(artifactKinds.map(kind => [kind, serializedHash(args.artifacts[kind])]));
  for (const kind of artifactKinds) {
    assert.equal(bytesHash(readFileSync(join(args.directory, `${args.caseId}.${kind}.json`)) as unknown as Uint8Array), artifactSha256[kind], "persisted_artifact_changed_before_seal");
  }
  const checkpoint = { version: "luna-diagnostic-case-checkpoint-v2", serialization: DIAGNOSTIC_ARTIFACT_SERIALIZATION, caseId: args.caseId,
    previousCheckpointSha256: args.previousAnchor?.sha256 ?? null, artifactSha256,
    ledgerDigest: identityDigest(args.afterLedger), ledgerAttemptCount: Object.keys(args.afterLedger.attempts).length,
    requestHashes: added.map(r => r.hash) };
  return { checkpoint, anchor: { caseId: args.caseId, sha256: serializedHash(checkpoint) } };
}

/** Recheck all four files, checkpoint chain and full ledger prefix for every
 * recorded case. Call before each next invocation and before final completion.
 * Missing files, changed receipts/candidates and policy/history changes all throw.
 */
export function verifyDiagnosticHistory(args: {
  directory: string; anchors: DiagnosticCheckpointAnchor[]; expectedCaseIds: string[];
  startingLedger: any; currentLedger: any;
}) {
  assert.deepEqual(args.anchors.map(a => a.caseId), args.expectedCaseIds.slice(0, args.anchors.length), "case_sequence_changed");
  const baselineCount = Object.keys(args.startingLedger.attempts).length;
  assert.equal(identityDigest(prefix(args.currentLedger, baselineCount)), identityDigest(args.startingLedger), "starting_ledger_changed");
  let count = baselineCount, previous: string | null = null;
  for (const anchor of args.anchors) {
    assert(validCaseId(anchor.caseId));
    const raw = readFileSync(join(args.directory, `${anchor.caseId}.checkpoint.json`));
    assert.equal(bytesHash(raw as unknown as Uint8Array), anchor.sha256, "checkpoint_changed");
    const checkpoint = JSON.parse(raw.toString("utf8"));
    assert.equal(checkpoint.version, "luna-diagnostic-case-checkpoint-v2");
    assert.equal(checkpoint.serialization, DIAGNOSTIC_ARTIFACT_SERIALIZATION); assert.equal(checkpoint.caseId, anchor.caseId);
    assert.equal(checkpoint.previousCheckpointSha256, previous, "checkpoint_chain_changed");
    assert.deepEqual(Object.keys(checkpoint.artifactSha256), [...artifactKinds]);
    const artifacts = Object.fromEntries(artifactKinds.map(kind => {
      const bytes = readFileSync(join(args.directory, `${anchor.caseId}.${kind}.json`));
      assert.equal(bytesHash(bytes as unknown as Uint8Array), checkpoint.artifactSha256[kind], `${kind}_artifact_changed`);
      return [kind, JSON.parse(bytes.toString("utf8"))];
    }));
    assert.equal(checkpoint.ledgerAttemptCount, count + checkpoint.requestHashes.length);
    assert.equal(identityDigest(prefix(args.currentLedger, checkpoint.ledgerAttemptCount)), checkpoint.ledgerDigest, "recorded_ledger_prefix_changed");
    const caseRows = rows(args.currentLedger).slice(count, checkpoint.ledgerAttemptCount);
    assert.deepEqual(caseRows.map(r => r.hash), checkpoint.requestHashes);
    assert.equal(identityDigest(artifacts.receipts), identityDigest(caseRows), "saved_receipts_ledger_mismatch");
    assert.equal(artifacts.diagnostic.originalReviewHash, identityDigest(artifacts.original));
    assert.equal(artifacts.diagnostic.mayAdvanceDiagnosticSequence, true);
    count = checkpoint.ledgerAttemptCount; previous = anchor.sha256;
  }
  assert.equal(Object.keys(args.currentLedger.attempts).length, count, "unrecorded_ledger_attempts");
  assert(Object.values(args.currentLedger.attempts).every((a: any) => a.state === "settled" && a.receipt), "ledger_unsettled");
}
