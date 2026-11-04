import { createHash } from "node:crypto";
import { z } from "zod";
import { freezeIdentityValue, identityDigest } from "./playerIdentitySnapshot";
import { exactIdentitySpan, validateFixtureIdentityProposal, type FixtureIdentityRequest, type IdentitySourceSpan } from "./tweetIdentityProposal";
import { LUNA_REVIEW_AUTHORITY, lunaGoalieStatusesSchema, validateLunaGoalieStatuses } from "./tweetLunaReview";

export const LUNA_EVIDENCE_BINDING_POLICY = "luna-unique-exact-quote-review-v1";
const rawProposal = z.object({ identity: z.unknown(), goalieStatuses: lunaGoalieStatusesSchema }).strict();
const safeReasons = new Set(["binding_quote_missing", "binding_quote_ambiguous", "binding_quote_boundary_invalid",
  "binding_raw_output_too_large", "duplicate_goalie_subject", "goalie_subject_binding_invalid", "goalie_certainty_inflation",
  "goalie_definite_wording_unsupported", "goalie_context_unresolved", "goalie_conflict_or_correction_unresolved", "goalie_tentative_wording_unsupported"]);

/** Pure correction proposal only. The optional binding workflow supplies receipt
 * and retained-source lineage before persisting a separate review artifact.
 * A unique exact quote can identify coordinates, not establish semantic truth.
 * Raw text, original offsets, and historical review outcomes remain unchanged.
 */
export function proposeLunaEvidenceBindingReview(args: {
  policy?: typeof LUNA_EVIDENCE_BINDING_POLICY;
  request: FixtureIdentityRequest;
  rawOutputText: string;
}) {
  const base = { version: LUNA_EVIDENCE_BINDING_POLICY, ...LUNA_REVIEW_AUTHORITY, canApply: false as const,
    status: "disabled" as "disabled" | "held" | "not_needed" | "candidate_for_human_review",
    reason: null as string | null, holds: ["human_review_required", "no_publication_authority"],
    requestHash: null as string | null, sourceHash: null as string | null,
    rawOutputText: null as string | null, rawOutputSha256: null as string | null, candidateHash: null as string | null,
    corrections: [] as { occurrenceId: string; before: IdentitySourceSpan; proposed: IdentitySourceSpan }[],
    candidate: null as null | { identity: ReturnType<typeof validateFixtureIdentityProposal>; goalieStatuses: ReturnType<typeof validateLunaGoalieStatuses> } };
  // Policy is a caller decision, never a field read from untrusted model/source text.
  if (args.policy !== LUNA_EVIDENCE_BINDING_POLICY) return freezeIdentityValue({ ...base, reason: "binding_policy_not_enabled" });
  try {
    if (Buffer.byteLength(args.rawOutputText) > 65_536) throw new Error("binding_raw_output_too_large");
    base.rawOutputText = args.rawOutputText;
    base.rawOutputSha256 = createHash("sha256").update(args.rawOutputText).digest("hex");
    const raw = rawProposal.parse(JSON.parse(args.rawOutputText));
    // Identity offsets/candidates/request hash are never repaired by this policy.
    const identity = validateFixtureIdentityProposal(args.request, raw.identity);
    base.requestHash = args.request.hash;
    base.sourceHash = identityDigest(args.request.content.source);
    const source = args.request.content.source.text;
    const corrections: typeof base.corrections = [];
    const rebound = raw.goalieStatuses.map(proposal => {
      const text = proposal.evidence.text, start = source.indexOf(text);
      if (start < 0) throw new Error("binding_quote_missing");
      // Advance one UTF-16 unit, not the quote length: overlapping matches count.
      if (source.indexOf(text, start + 1) >= 0) throw new Error("binding_quote_ambiguous");
      const evidence = { start, end: start + text.length, text };
      // Reuse surrogate/grapheme checks; never normalize case, whitespace or Unicode.
      if (!exactIdentitySpan(source, evidence)) throw new Error("binding_quote_boundary_invalid");
      if (proposal.evidence.start !== evidence.start || proposal.evidence.end !== evidence.end) {
        corrections.push({ occurrenceId: proposal.occurrenceId, before: proposal.evidence, proposed: evidence });
      }
      return { ...proposal, evidence };
    });
    // Includes selected goalie/occurrence, overlap, full context, negation, repeated
    // identity, correction and uncertainty gates. All proposals must pass together.
    const goalieStatuses = validateLunaGoalieStatuses(args.request, identity, rebound);
    if (!corrections.length) return freezeIdentityValue({ ...base, status: "not_needed" as const });
    base.status = "candidate_for_human_review";
    base.holds.push("original_response_remains_held", "evidence_binding_human_review_required");
    base.corrections = corrections;
    base.candidate = { identity, goalieStatuses };
    base.candidateHash = identityDigest({ version: base.version, requestHash: base.requestHash, sourceHash: base.sourceHash,
      rawOutputSha256: base.rawOutputSha256, corrections, candidate: base.candidate });
    return freezeIdentityValue(base);
  } catch (error) {
    const reason = error instanceof Error && safeReasons.has(error.message) ? error.message : "binding_invalid_request_or_proposal";
    return freezeIdentityValue({ ...base, status: "held" as const, reason });
  }
}
