import { getPrimaryTextForSource } from "./linesCccIngestion";
import { claimHash, type TweetClaimEnvelope } from "./tweetClaimExtraction";
import { adaptTweetClaimReduction, emptyTweetClaimAdapterState, retainedReducerObservations,
  type ClaimDerivationIngress, type TweetClaimAdapterState } from "./tweetClaimReducerAdapter";
import { reduceTweetSemanticEvents } from "./tweetSemanticEvents";
import { sourceClaimTextVersionId } from "./tweetSourceClaimRegistry";

/** Audit the reviewed occurrence/derivation planner beside the durable raw claims.
 * Exact deployed legacy payload and sink coverage are unavailable at this stage;
 * aliases alone must never be upgraded to a known-clear delivery proof.
 */
export function planReviewedTweetClaimCompatibility(scope: string, state: TweetClaimAdapterState | null,
  claims: readonly TweetClaimEnvelope[], asOf: string) {
  const current = state ?? emptyTweetClaimAdapterState(scope);
  const prior = new Map(current.derivations.map(record => [record.id, record.ingress.immutable]));
  const batch: ClaimDerivationIngress[] = claims.flatMap(claim => {
    if (!claim.claimAnchor) return [];
    const sourceText = getPrimaryTextForSource(claim.source);
    const immutable: ClaimDerivationIngress["immutable"] = prior.get(claim.semantic.id) ?? {
      observation: claim.semantic,
      source: { sourceRootId: claim.lineageKey, originalTweetId: claim.attribution.originalTweetId,
        originalAuthor: claim.attribution.original?.handle ?? null, retainedSourceId: claim.lineageKey,
        verification: claim.attribution.status === "resolved" ? { status: "verified", basis: "retained post/author relationship" }
          : { status: "pending", reason: "original attribution pending" } },
      sourceTextVersionId: sourceClaimTextVersionId(claim.lineageKey, sourceText), sourceText, ...claim.claimAnchor,
      evidence: { representationVersion: "governing-qualifier-v2", governingClauseSpan: claim.semantic.evidence,
        displaySpans: [claim.semantic.evidence], contextSpans: [] },
      parserVersion: claim.extractionVersion, resolverVersion: `identity-context-v1:${claimHash(claim.source.metadata?.interpretation ?? null)}`,
      polarity: claim.semantic.fact && claim.semantic.modality === "asserted" ? "positive" : "unknown",
      // The reviewed adapter requires more than current-membership inference.
      // Retain this exception until an automated dated identity proof is wired.
      binding: { status: "pending", reason: "dated_source_time_identity_proof_pending" },
    };
    return [{ immutable, compatibility: { legacyRefs: [], delivery: { status: "unknown", reason: "deployed legacy sink coverage not inspected" } } }];
  });
  // The reviewed pure modules intentionally reject undefined values.
  const finite = JSON.parse(JSON.stringify(batch)) as ClaimDerivationIngress[];
  const reduction = reduceTweetSemanticEvents(retainedReducerObservations(current, finite), asOf);
  const plan = adaptTweetClaimReduction(current, { batch: finite, asOf,
    rule: { ruleId: "tweet-claim-shadow", ruleVersion: "1", effectType: "semantic_evidence" }, reduction });
  if (!plan.accepted) throw new Error(`Reviewed compatibility plan rejected: ${plan.holds.join(",")}`);
  return plan;
}
