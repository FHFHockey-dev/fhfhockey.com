import { claimHash, claimCanonicalJson, type TweetClaimEnvelope } from "./tweetClaimExtraction";
import { getPrimaryTextForSource } from "./linesCccIngestion";
import { datedTweetClaimBinding, tweetLegacyCoverage, type TweetClaimEvidence } from "./tweetClaimEvidence";
import { adaptTweetClaimReduction, emptyTweetClaimAdapterState, type ClaimDerivationIngress } from "./tweetClaimReducerAdapter";
import { reduceTweetSemanticEvents } from "./tweetSemanticEvents";
import { sourceClaimTextVersionId } from "./tweetSourceClaimRegistry";

export type TweetClaimLineageLink = { receipt: string; originId: string; author: string; publishedAt: string; textHash: string };

/** Exact original ID + text + author + source clock only. No fuzzy text merges or relay votes. */
export function resolveTweetClaimLineage(claims: readonly TweetClaimEnvelope[], retained: readonly TweetClaimLineageLink[] = []) {
  const links: TweetClaimLineageLink[] = [...retained];
  for (const claim of claims) if (claim.attribution.status === "resolved" && claim.attribution.originalTweetId
    && claim.attribution.original?.handle && claim.attribution.originalPublishedAt) {
    const link = { receipt: claim.lineageKey, originId: claim.attribution.originalTweetId, author: claim.attribution.original.handle.toLowerCase(),
      publishedAt: claim.attribution.originalPublishedAt, textHash: claimHash(getPrimaryTextForSource(claim.source)) };
    if (!links.some(existing => claimCanonicalJson(existing) === claimCanonicalJson(link))) links.push(link);
  }
  const resolved = claims.map(claim => {
    const textHash = claimHash(getPrimaryTextForSource(claim.source));
    const candidates = links.filter(link => link.receipt === claim.lineageKey && link.textHash === textHash);
    const meanings = new Set(candidates.map(link => claimCanonicalJson([link.originId, link.author, link.publishedAt])));
    const selected = meanings.size === 1 ? candidates[0] : undefined;
    const conflicts = selected && links.some(link => link.originId === selected.originId
      && (link.textHash !== selected.textHash || link.author !== selected.author || Date.parse(link.publishedAt) !== Date.parse(selected.publishedAt)));
    return { claim, root: selected && !conflicts ? `tweet-original-v1:${selected.originId}` : null,
      link: selected && !conflicts ? selected : null,
      hold: meanings.size > 1 || conflicts ? "original_lineage_evidence_conflict" : !selected ? "original_lineage_unresolved" : null };
  });
  return { links, resolved };
}

/** Rebuild a versioned qualified view, preserving raw derivations and prior durable views separately.
 * Outbox identities remain reducer scenario/action keys; planner reservations are never dispatched.
 */
export function qualifyTweetClaimScope(scope: string, claims: readonly TweetClaimEnvelope[], evidence: TweetClaimEvidence,
  links: readonly TweetClaimLineageLink[], asOf: string) {
  const lineage = resolveTweetClaimLineage(claims, links), legacy = tweetLegacyCoverage(evidence, claims.flatMap(c => c.semantic.original.publishedAt ? [c.semantic.original.publishedAt] : []));
  const occurrences = new Map<string, ClaimDerivationIngress>();
  const holds: Array<{ observationId: string; reason: string }> = [];
  const bindings: Array<{ observationId: string; occurrenceId: string; root: string }> = [];
  for (const item of lineage.resolved) {
    const c = item.claim;
    if (!item.root || !item.link || !c.claimAnchor) {
      holds.push({ observationId: c.semantic.id, reason: item.hold ?? "lexical_anchor_unresolved" }); continue;
    }
    const text = getPrimaryTextForSource(c.source), anchor = c.claimAnchor;
    const occurrenceId = `tweet-occurrence-v1:${claimHash([item.root, text, anchor.subjectSpan, anchor.predicateSpan])}`;
    bindings.push({ observationId: c.semantic.id, occurrenceId, root: item.root });
    if (c.scopeKey !== scope) continue;
    // A later exact wrapper/original link may qualify a previously provisional observation.
    const sourceClaim = { ...c, semantic: { ...c.semantic, original: { tweetId: item.link.originId, author: item.link.author, publishedAt: item.link.publishedAt } } };
    const binding = datedTweetClaimBinding(sourceClaim, evidence);
    if (binding.status !== "verified") { holds.push({ observationId: c.semantic.id, reason: binding.reason }); continue; }
    const support = c.semantic.support.status === "pending" && c.semantic.support.reason === "source_time_identity_unverified"
      && c.semantic.effectiveAt && Date.parse(c.semantic.effectiveAt) > Date.parse(asOf)
      ? { status: "supported" as const, basis: binding.basis, validUntil: c.semantic.effectiveAt } : c.semantic.support;
    if (support.status !== "supported") { holds.push({ observationId: c.semantic.id, reason: support.reason }); continue; }
    const immutable = {
      observation: { ...sourceClaim.semantic, id: `tweet-qualified-v1:${claimHash([occurrenceId, c.semantic.fact, c.semantic.scope])}`,
        // Selection applies from publication until game start. Raw extraction's
        // scheduled-game clock stays immutable in the retained observation.
        effectiveAt: item.link.publishedAt, reportId: item.root, wrapper: null, support },
      source: { sourceRootId: item.root, originalTweetId: item.link.originId, originalAuthor: item.link.author,
        retainedSourceId: item.root, verification: { status: "verified" as const, basis: "exact retained original identity and immutable lexical text" } },
      sourceTextVersionId: sourceClaimTextVersionId(item.root, text), sourceText: text, ...anchor,
      evidence: { representationVersion: "governing-qualifier-v2", governingClauseSpan: c.semantic.evidence,
        displaySpans: [c.semantic.evidence], contextSpans: [] },
      parserVersion: c.extractionVersion, resolverVersion: "dated-official-game-roster-v1", binding,
      polarity: c.semantic.fact && c.semantic.modality === "asserted" ? "positive" as const : "unknown" as const,
    };
    const prior = occurrences.get(occurrenceId);
    if (prior && claimCanonicalJson([prior.immutable.observation.fact, prior.immutable.observation.scope]) !== claimCanonicalJson([immutable.observation.fact, immutable.observation.scope])) {
      holds.push({ observationId: c.semantic.id, reason: "material_occurrence_reinterpretation_requires_resolution" }); occurrences.delete(occurrenceId); continue;
    }
    // Earliest admission wins; the receipt clock is never refreshed by a relay or reparse.
    if (!prior || Date.parse(immutable.observation.interpretedAt) < Date.parse(prior.immutable.observation.interpretedAt)) {
      occurrences.set(occurrenceId, { immutable, compatibility: { legacyRefs: [], delivery: { status: "unknown", reason: legacy.status === "known_clear" ? "scope_planning" : legacy.reason } } });
    }
  }
  // Material reinterpretations require explicit resolution; a third replay may
  // not restore the first meaning by winning admission order.
  const disputed = new Set(holds.filter(h => h.reason === "material_occurrence_reinterpretation_requires_resolution")
    .flatMap(h => bindings.filter(b => b.observationId === h.observationId).map(b => b.occurrenceId)));
  const batch = [...occurrences.entries()].filter(([key]) => !disputed.has(key)).sort(([a], [b]) => a.localeCompare(b)).map(([, entry]) => entry);
  let reduction = reduceTweetSemanticEvents(batch.map(entry => entry.immutable.observation), asOf);
  for (const [index, entry] of batch.entries()) {
    const scenario = reduction.scenarios.find(s => s.key === reduction.associations[index]!.scenarioKey);
    if (scenario && legacy.status === "known_clear") batch[index] = { ...entry, compatibility: { legacyRefs: [], delivery: {
      status: "verified", basis: legacy.basis, scenarioKey: scenario.key, scope: scenario.scope, effectType: "semantic_evidence",
      history: { status: "known_clear", basis: legacy.basis, coveredLegacyRefs: [] } } } };
  }
  // Finite JSON removes optional undefined properties accepted by upstream source types.
  const finite = JSON.parse(JSON.stringify(batch)) as ClaimDerivationIngress[];
  reduction = reduceTweetSemanticEvents(finite.map(entry => entry.immutable.observation), asOf);
  const plan = adaptTweetClaimReduction(emptyTweetClaimAdapterState(`${scope}:qualified-v1`), { batch: finite, asOf,
    rule: { ruleId: "tweet-claim-shadow", ruleVersion: "1", effectType: "semantic_evidence" }, reduction });
  return { version: "qualified-tweet-claims-v1", lineage, bindings, holds, legacy, plan,
    fingerprint: claimHash([lineage.links, bindings, holds, legacy, plan]), noDispatch: true as const };
}
