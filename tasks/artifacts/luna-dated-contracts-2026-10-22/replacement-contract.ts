import { identityDigest } from '../../../web/lib/sources/playerIdentitySnapshot';
import { exactIdentitySpan, validateFixtureIdentityProposal, type FixtureIdentityRequest,
  type IdentitySourceSpan } from '../../../web/lib/sources/tweetIdentityProposal';

export type ReplacementClause = {
  incomingOccurrenceId: string; outgoingOccurrenceId: string;
  evidence: IdentitySourceSpan; unitEvidence: IdentitySourceSpan | null;
};
const authority = { canPublish: false, canWriteAliases: false, canChangeStatus: false,
  canExecuteReplacement: false, providerDispatchEnabled: false } as const;

// Executable contract fixture for one explicit grammar, not an automatic extractor or native reducer adapter.
// The request must be trusted locally prepared/pinned input, never a request supplied by the model.
export function prepareReplacementReview(args: {
  enabled?: boolean; request: FixtureIdentityRequest; proposal: unknown; clause: ReplacementClause;
}) {
  if (args.enabled !== true) return { ...authority, status: 'disabled', packet: null } as const;
  try {
    const proposal = validateFixtureIdentityProposal(args.request, args.proposal);
    const { source } = args.request.content, clause = args.clause;
    const incoming = proposal.occurrences.find(p => p.occurrenceId === clause.incomingOccurrenceId);
    const outgoing = proposal.occurrences.find(p => p.occurrenceId === clause.outgoingOccurrenceId);
    if (!incoming || !outgoing || incoming === outgoing || incoming.status !== 'matched' || outgoing.status !== 'matched'
      || incoming.canonicalId === outgoing.canonicalId) throw new Error('two_distinct_bound_subjects_required');
    if (!exactIdentitySpan(source.text, clause.evidence) || incoming.evidence.start !== clause.evidence.start
      || incoming.evidence.end >= outgoing.evidence.start || outgoing.evidence.end > clause.evidence.end) {
      throw new Error('replacement_subject_span_mismatch');
    }
    const unit = clause.unitEvidence;
    if (unit && (!exactIdentitySpan(source.text, unit) || unit.start <= outgoing.evidence.end || unit.end !== clause.evidence.end
      || !['first unit powerplay', 'second unit powerplay'].includes(unit.text))) throw new Error('unsupported_unit_evidence');
    const suffix = unit ? ` on the ${unit.text}` : '';
    const expected = `${incoming.evidence.text} will take ${outgoing.evidence.text}’s spot${suffix}`;
    if (clause.evidence.text !== expected && clause.evidence.text !== expected.replace('’s spot', "'s spot")) {
      throw new Error('unsupported_or_misbound_replacement_clause');
    }
    const packet = {
      version: 'review-only-replacement-contract-v1', requestHash: args.request.hash,
      directoryHash: args.request.content.directory.hash, sourceHash: identityDigest(source),
      source: structuredClone(source), evidence: structuredClone(clause.evidence),
      incoming: structuredClone(incoming), outgoing: structuredClone(outgoing),
      relation: 'reported_future_replacement', predicateLiteral: 'will take',
      unit: unit ? { code: unit.text.startsWith('first') ? 'PP1' : 'PP2', evidence: structuredClone(unit) } : null,
      statement: { kind: 'literal_source_quote', text: clause.evidence.text },
      claimCertainty: 'unassessed', priorSlot: null, effectiveGame: null, sourceTimeMembership: null,
      holds: ['native_multi_player_operation_unsupported', 'prior_slot_unavailable', 'game_applicability_unavailable',
        'independent_source_time_membership_unavailable', ...(unit ? [] : ['unit_unavailable'])],
      ...authority,
    } as const;
    return { ...authority, status: 'reviewable_held', packet, packetHash: identityDigest(packet) } as const;
  } catch (error) {
    return { ...authority, status: 'held', packet: null,
      reason: error instanceof Error ? error.message : 'invalid_replacement_input' } as const;
  }
}
