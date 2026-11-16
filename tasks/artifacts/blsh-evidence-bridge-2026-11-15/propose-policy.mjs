// PROPOSED acceptance-policy entry. Never installed in app code. reviewSHA256 is left null for the
// independent reviewer, which makes the entry deliberately non-installable: the gate constructor
// (currentProcessEvidence.server.ts:118-122) rejects it until a review artifact hash is filled in
// AND appended to requiredArtifactSHA256.
import { join } from "node:path";
import { BridgeRefusal, MIB, encode, need, parseJson, readBound, sha } from "./lib.mjs";

const REFS = ["nativeBodySHA256", "nativeReceiptSHA256", "producerSHA256", "redactorSHA256", "definitionSHA256", "officialFrameSHA256"];

/** `testOnlyAllowTestModeFrames` is a FUNCTION option for tests (never CLI): it admits test-mode frames and stamps
 * the result TEST_ONLY so it can never be mistaken for a reviewable proposal. Synthetic adapters stay refused. */
export function proposeAcceptance({ preparedDir, assemblyDir, testOnlyAllowTestModeFrames = false }) {
  const assembly = parseJson(readBound(join(assemblyDir, "ASSEMBLY.json"), 4 * MIB));
  need(assembly.evidenceClasses.length > 0 && assembly.evidenceClasses.every(c => c === "candidate_pending_independent_review"), "synthetic_or_unknown_evidence_class");
  need(Array.isArray(assembly.frameModes) && assembly.frameModes.length > 0 &&
    assembly.frameModes.every(m => m === "production" || (testOnlyAllowTestModeFrames && m === "test_mode")), "frames_not_from_reviewed_acquisition");
  const requestBytes = readBound(join(preparedDir, "CURRENT-REQUEST.json"), 32 * MIB);
  const bundleBytes = readBound(join(preparedDir, "PROPOSED-BUNDLE.json"), 8 * MIB), bundle = parseJson(bundleBytes);
  need(bundle.version === "fhfh.blsh.reviewed-process-evidence.v1" && bundle.sourceRequestSHA256 === sha(requestBytes), "bundle_request_mismatch");
  need(Array.isArray(bundle.witnesses) && bundle.witnesses.length > 0, "no_witnesses_to_accept");
  const required = new Set([...bundle.witnesses.flatMap(w => REFS.map(k => w[k])), ...assembly.extraBoundArtifactSHA256]);
  for (const digest of required) need(sha(readBound(join(preparedDir, "artifacts", digest), 8 * MIB)) === digest, "required_artifact_missing_from_prepared_packet");
  return {
    status: assembly.frameModes.includes("test_mode") ? "TEST_ONLY_frames_unverified_never_for_review" : "PROPOSAL_ONLY_not_installable_until_independent_review",
    acceptance: { bundleSHA256: sha(bundleBytes), requestSHA256: sha(requestBytes), reviewSHA256: null,
      reviewScope: "exact_rows_native_cells_scope_and_model", requiredArtifactSHA256: [...required].sort() },
    reviewerMustAdd: "reviewSHA256 = sha256 of the reviewer's review artifact, which must also be appended to requiredArtifactSHA256",
    witnesses: bundle.witnesses.length, installTarget: "none: this lane never edits CLOSED_PROCESS_EVIDENCE_POLICY or any server policy",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  try { process.stdout.write(encode(proposeAcceptance({ preparedDir: arg("prepared"), assemblyDir: arg("assembly") }))); }
  catch (e) { process.stdout.write(`${JSON.stringify({ ok: false, refusal: e instanceof BridgeRefusal ? e.code : e?.code === "EEXIST" ? "output_exists" : "propose_error" })}\n`); process.exitCode = 2; }
}
