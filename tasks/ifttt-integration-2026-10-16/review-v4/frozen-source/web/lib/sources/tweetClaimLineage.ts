import { claimHash, claimCanonicalJson, type TweetClaimEnvelope } from "./tweetClaimExtraction";
import { getPrimaryTextForSource } from "./linesCccIngestion";
import { datedTweetClaimBinding, tweetLegacyCoverage, type TweetClaimEvidence, type TweetLegacySinkRead } from "./tweetClaimEvidence";
import { adaptTweetClaimReduction, emptyTweetClaimAdapterState, retainedReducerObservations, type TweetClaimAdapterState, type ClaimDerivationIngress } from "./tweetClaimReducerAdapter";
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

export type TweetClaimOccurrenceMeaning = { occurrenceId: string; root: string; scopeKey: string; fingerprint: string };
export type TweetClaimContinuity = { state?: TweetClaimAdapterState; sinks?: TweetLegacySinkRead[]; meanings?: TweetClaimOccurrenceMeaning[] };

/** Preserve canonical occurrence allocation, admission clocks and disputes across durable reloads. */
export function qualifyTweetClaimScope(scope: string, claims: readonly TweetClaimEnvelope[], evidence: TweetClaimEvidence,
  links: readonly TweetClaimLineageLink[], asOf: string, continuity: TweetClaimContinuity = {}) {
  const lineage = resolveTweetClaimLineage(claims, links);
  const sinks = evidence.sinks.map(read => {
    const prior = continuity.sinks?.find(old => old.sink === read.sink);
    const rows = [...new Map([...(prior?.rows ?? []), ...read.rows].map(row => [claimHash(row), row])).values()];
    return { ...read, complete: read.complete && rows.length <= 256, rows: rows.slice(0, 257) };
  });
  const legacy = tweetLegacyCoverage({ ...evidence, sinks }, claims.flatMap(c => c.semantic.original.publishedAt ? [c.semantic.original.publishedAt] : []));
  const state = continuity.state ?? emptyTweetClaimAdapterState(`${scope}:qualified-v1`);
  const batchById = new Map(state.derivations.map(record => [record.id, record.ingress]));
  const holds: Array<{ observationId: string; reason: string }> = [];
  const bindings: Array<{ observationId: string; occurrenceId: string; root: string }> = [];
  const meanings: TweetClaimOccurrenceMeaning[] = [...(continuity.meanings ?? [])];
  for (const item of lineage.resolved) {
    const c = item.claim;
    if (!item.root || !item.link || !c.claimAnchor) {
      holds.push({ observationId: c.semantic.id, reason: item.hold ?? "lexical_anchor_unresolved" }); continue;
    }
    const text = getPrimaryTextForSource(c.source), anchor = c.claimAnchor;
    const occurrenceId = `tweet-occurrence-v1:${claimHash([item.root, text, anchor.subjectSpan, anchor.predicateSpan])}`;
    bindings.push({ observationId: c.semantic.id, occurrenceId, root: item.root });
    const sourceClaim = { ...c, semantic: { ...c.semantic, original: { tweetId: item.link.originId, author: item.link.author, publishedAt: item.link.publishedAt } } };
    const binding = datedTweetClaimBinding(sourceClaim, evidence);
    if (binding.status !== "verified") { holds.push({ observationId: c.semantic.id, reason: binding.reason }); continue; }
    const hint = c.source.metadata?.tweetSourceDirectoryHint as { status?: string; teamId?: number; bindingAuthority?: boolean } | undefined;
    const interpretation = c.source.metadata?.interpretation as { unresolved?: unknown[] } | undefined;
    const hintSupported = hint?.status === "consistent_prior" && hint.teamId === binding.teamId && hint.bindingAuthority === false
      && c.source.nhlFilterStatus === "accepted" && c.source.detectedLeague === "NHL" && !interpretation?.unresolved?.length;
    const support = c.semantic.support.status === "pending" && (c.semantic.support.reason === "source_time_identity_unverified"
      || c.semantic.support.reason === "source_time_team_not_explicit" && hintSupported)
      && c.semantic.effectiveAt && Date.parse(c.semantic.effectiveAt) > Date.parse(asOf)
      ? { status: "supported" as const, basis: binding.basis, validUntil: c.semantic.effectiveAt } : c.semantic.support;
    if (support.status !== "supported") { holds.push({ observationId: c.semantic.id, reason: support.reason }); continue; }
    const meaning = { occurrenceId, root: item.root, scopeKey: c.scopeKey,
      fingerprint: claimHash([c.semantic.scope, c.semantic.fact, c.semantic.modality]) };
    if (!meanings.some(old => old.occurrenceId === occurrenceId && old.fingerprint === meaning.fingerprint)) meanings.push(meaning);
    // Detect global meaning before projecting this particular storage scope.
    if (c.scopeKey !== scope) continue;
    const id = `tweet-qualified-v2:${claimHash([occurrenceId, c.semantic.id, binding])}`;
    const immutable = batchById.get(id)?.immutable ?? {
      observation: { ...sourceClaim.semantic, id, effectiveAt: item.link.publishedAt, reportId: item.root, wrapper: null, support },
      source: { sourceRootId: item.root, originalTweetId: item.link.originId, originalAuthor: item.link.author,
        retainedSourceId: item.root, verification: { status: "verified" as const, basis: "exact retained original identity and immutable lexical text" } },
      sourceTextVersionId: sourceClaimTextVersionId(item.root, text), sourceText: text, ...anchor,
      evidence: { representationVersion: "governing-qualifier-v2", governingClauseSpan: c.semantic.evidence,
        displaySpans: [c.semantic.evidence], contextSpans: [] },
      parserVersion: c.extractionVersion, resolverVersion: "dated-official-game-roster-v1", binding,
      polarity: c.semantic.fact && c.semantic.modality === "asserted" ? "positive" as const : "unknown" as const,
    };
    batchById.set(id, { immutable, compatibility: { legacyRefs: [], delivery: { status: "unknown", reason: "scope_planning" } } });
  }
  const globalDisputes = [...new Set(meanings.filter(m => meanings.some(other => other.occurrenceId === m.occurrenceId
    && other.fingerprint !== m.fingerprint)).map(m => m.occurrenceId))];
  for (const binding of bindings) if (globalDisputes.includes(binding.occurrenceId)) holds.push({ observationId: binding.observationId,
    reason: "global_material_occurrence_reinterpretation_requires_resolution" });
  const batch = [...batchById.values()];
  if (batch.length > 256) throw new Error("Canonical proof-version capacity exceeded; review required");
  // Admission order and allocator state come from the durable prior adapter.
  const reduction = reduceTweetSemanticEvents(retainedReducerObservations(state, batch), asOf);
  for (const [index, entry] of batch.entries()) {
    const observationIndex = reduction.observations.findIndex(o => o.id === entry.immutable.observation.id);
    const scenario = reduction.scenarios.find(s => s.key === reduction.associations[observationIndex]?.scenarioKey);
    batch[index] = { ...entry, compatibility: { ...entry.compatibility, delivery: scenario && !globalDisputes.length && legacy.status === "known_clear" ? {
      status: "verified", basis: legacy.basis, scenarioKey: scenario.key, scope: scenario.scope, effectType: "semantic_evidence",
      history: { status: "known_clear", basis: legacy.basis, coveredLegacyRefs: [] } }
      : { status: "unknown", reason: globalDisputes.length ? "global_material_occurrence_reinterpretation_requires_resolution"
        : legacy.status === "known_clear" ? "scope_unresolved" : legacy.reason } } };
  }
  const finite = JSON.parse(JSON.stringify(batch)) as ClaimDerivationIngress[];
  const plan = adaptTweetClaimReduction(state, { batch: finite, asOf,
    rule: { ruleId: "tweet-claim-shadow", ruleVersion: "1", effectType: "semantic_evidence" }, reduction });
  if (!plan.accepted) for (const c of claims.filter(claim => claim.scopeKey === scope)) holds.push({ observationId: c.semantic.id,
    reason: `canonical_adapter_rejected:${plan.holds.join(",")}` });
  if (globalDisputes.length) {
    plan.reviewableEffects = []; plan.holds.push("global_material_occurrence_reinterpretation_requires_resolution");
    for (const effect of plan.nextState.registry.effects) effect.disputeStatus = "disputed";
  }
  return { version: "qualified-tweet-claims-v2", lineage, bindings, holds, legacy, plan, meanings, globalDisputes,
    fingerprint: claimHash([lineage.links, bindings, holds, legacy, plan, meanings, globalDisputes]), noDispatch: true as const };
}
