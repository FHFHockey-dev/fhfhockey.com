import { z } from "zod";
import { freezeIdentityValue, identityDigest } from "./playerIdentitySnapshot";
import { exactIdentitySpan, validateFixtureIdentityProposal, type FixtureIdentityRequest } from "./tweetIdentityProposal";

const span = z.object({ start: z.number().int().nonnegative().safe(), end: z.number().int().positive().safe(),
  text: z.string().min(1).max(16000) }).strict();
const clauseSchema = z.object({ incomingOccurrenceId: z.string().min(1).max(200), outgoingOccurrenceId: z.string().min(1).max(200),
  evidence: span, unitEvidence: span.nullable() }).strict();
export type IdentityReplacementClause = z.infer<typeof clauseSchema>;
const authority = { canPublish: false, canWriteAliases: false, canChangeStatus: false,
  canExecuteReplacement: false, providerDispatchEnabled: false } as const;

/** Default-off review only. Request must be trusted locally prepared input, never model-supplied context.
 * Validates explicit caller annotations for one grammar; does not extract clauses or create native effects. */
export function prepareTweetIdentityReplacementReview(args: {
  enabled?: boolean; request: FixtureIdentityRequest; proposal: unknown; clause: unknown;
}) {
  if (args.enabled !== true) return { ...authority, status: "disabled", packet: null } as const;
  try {
    const proposal = validateFixtureIdentityProposal(args.request, args.proposal);
    const { source } = args.request.content, clause = clauseSchema.parse(args.clause);
    const incoming = proposal.occurrences.find(p => p.occurrenceId === clause.incomingOccurrenceId);
    const outgoing = proposal.occurrences.find(p => p.occurrenceId === clause.outgoingOccurrenceId);
    if (!incoming || !outgoing || incoming === outgoing || incoming.status !== "matched" || outgoing.status !== "matched"
      || incoming.canonicalId === outgoing.canonicalId) throw new Error("two_distinct_bound_subjects_required");
    if (!exactIdentitySpan(source.text, clause.evidence) || incoming.evidence.start !== clause.evidence.start
      || outgoing.evidence.start !== incoming.evidence.end + " will take ".length || outgoing.evidence.end > clause.evidence.end) {
      throw new Error("replacement_subject_span_mismatch");
    }
    const unit = clause.unitEvidence;
    if (unit && (!exactIdentitySpan(source.text, unit) || unit.start <= outgoing.evidence.end || unit.end !== clause.evidence.end
      || !["first unit powerplay", "second unit powerplay"].includes(unit.text))) throw new Error("unsupported_unit_evidence");
    const suffix = unit ? ` on the ${unit.text}` : "";
    const expected = `${incoming.evidence.text} will take ${outgoing.evidence.text}’s spot${suffix}`;
    if (clause.evidence.text !== expected && clause.evidence.text !== expected.replace("’s spot", "'s spot")) {
      throw new Error("unsupported_or_misbound_replacement_clause");
    }
    const packet = {
      version: "tweet-identity-replacement-review-v1", requestHash: args.request.hash,
      directoryHash: args.request.content.directory.hash, sourceHash: identityDigest(source),
      source: structuredClone(source), evidence: clause.evidence,
      incoming: structuredClone(incoming), outgoing: structuredClone(outgoing),
      relation: "replacement_wording_for_review", predicateLiteral: "will take",
      unit: unit ? { code: unit.text.startsWith("first") ? "PP1" : "PP2", evidence: unit } : null,
      statement: { kind: "literal_source_quote", text: clause.evidence.text },
      claimCertainty: "unassessed", governingContext: "unassessed", priorSlot: null, effectiveGame: null, sourceTimeMembership: null,
      holds: ["governing_context_unassessed", "native_multi_player_operation_unsupported", "prior_slot_unavailable", "game_applicability_unavailable",
        "independent_source_time_membership_unavailable", ...(unit ? [] : ["unit_unavailable"])],
      ...authority,
    } as const;
    return freezeIdentityValue({ ...authority, status: "reviewable_held", packet, packetHash: identityDigest(packet) } as const);
  } catch (error) {
    return { ...authority, status: "held", packet: null,
      reason: error instanceof z.ZodError ? "invalid_replacement_input" : error instanceof Error ? error.message : "invalid_replacement_input" } as const;
  }
}
