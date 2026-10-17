import { createHash } from "node:crypto";

/**
 * OFFLINE CANDIDATE ONLY. Pure, additive compatibility planning; no database,
 * parser, clock, network, dispatch or legacy-key replacement lives here.
 * nextRegistry is a proposed snapshot, not evidence of a durable commit/effect.
 */
export type ClaimJson = null | boolean | number | string | readonly ClaimJson[] | { readonly [key: string]: ClaimJson };
export type ClaimSpan = Readonly<{ start: number; end: number; text: string }>;
export type ClaimSourceRoot = Readonly<{
  sourceRootId: string;
  originalTweetId: string | null;
  originalAuthor: string | null;
  retainedSourceId?: string;
  verification: { status: "verified"; basis: string } | { status: "pending"; reason: string };
}>;
export type ClaimOccurrenceAnchor = Readonly<{
  sourceTextVersionId: string;
  subjectSpan: ClaimSpan;
  predicateSpan: ClaimSpan;
}>;
export type ClaimInterpretation = Readonly<{
  parserVersion: string;
  resolverVersion: string;
  subject: { playerId: number | null; teamId: number | null };
  scope: { kind: "game"; gameId: number; date: string; teamId: number } | { kind: "session"; sessionId: string; date: string; teamId: number } | null;
  fact: { kind: "availability"; status: "out" | "available" } | { kind: "starter" } | { kind: "observation"; activity: "practice" | "warmup" | "first_off"; present: boolean } | null;
  polarity: "positive" | "negative" | "unknown";
  assertionStrength: "asserted" | "uncertain" | "projected" | "observed";
  validation: { status: "supported"; basis: string } | { status: "pending" | "conflict"; reason: string };
}>;
export type ClaimEvidence = Readonly<{
  representationVersion: string;
  governingClauseSpan: ClaimSpan;
  displaySpans: readonly ClaimSpan[];
  contextSpans: readonly ClaimSpan[];
}>;
export type LegacyClaimCoverageRef = Readonly<{ kind: "report" | "event" | "capture"; key: string; payloadFingerprint: string }>;
export type LegacyClaimRef = Readonly<{
  kind: LegacyClaimCoverageRef["kind"]; key: string; payload: ClaimJson;
  /** Exact retained-source/lexical relationship; missing proof is retained held. */
  bindingProof?: { sourceRootId: string; anchor: ClaimOccurrenceAnchor; basis: string };
}>;
export type ClaimAlignment =
  | { kind: "verified_one_to_one"; sourceClaimId: string; priorAnchor: ClaimOccurrenceAnchor; sourceRootId: string; basis: string }
  | { kind: "verified_new_occurrence"; sourceRootId: string; basis: string };
export type ClaimEffectHistory =
  | { status: "known_clear"; basis: string; coveredLegacyRefs?: readonly LegacyClaimCoverageRef[] }
  | { status: "unknown"; reason: string }
  | { status: "committed"; effectKey: string; scenarioId: string; semanticFingerprint: string;
      /** Original verified sink receipt clocks, not this reparse's clocks. */
      acceptedTimes: ClaimTimes; basis: string; coveredLegacyRefs?: readonly LegacyClaimCoverageRef[] };
export type ClaimTimes = Readonly<{
  originalPublishedAt: string;
  wrapperPublishedAt: string | null;
  receivedAt: string;
  interpretedAt: string;
  effectiveAt: string;
  validUntil: string;
}>;
/** Supplied by the existing bound semantic reducer, not inferred from tweet text. */
export type ClaimSemanticAssociation = Readonly<{
  scenarioId: string;
  revisionId: string;
  disposition: "initial_acceptance" | "corroboration" | "conflict" | "pending";
}>;
export type SourceClaimCandidate = Readonly<{
  subjectSpan: ClaimSpan;
  predicateSpan: ClaimSpan;
  evidence: ClaimEvidence;
  interpretation: ClaimInterpretation;
  association: ClaimSemanticAssociation;
  times: ClaimTimes;
  alignment?: ClaimAlignment;
  legacyRefs: readonly LegacyClaimRef[];
  /** Required proof before proposing a first effect; missing/unknown always holds. */
  effectHistory?: ClaimEffectHistory;
}>;
export type SourceClaimPlanInput = Readonly<{
  source: ClaimSourceRoot;
  sourceTextVersionId: string;
  sourceText: string;
  asOf: string;
  rule: { ruleId: string; ruleVersion: string; effectType: string };
  claims: readonly SourceClaimCandidate[];
}>;
export type SourceClaimRecord = {
  sourceClaimId: string;
  sourceRootId: string;
  /** Allocated once; never recomputed from a proposition, resolved ID or span. */
  occurrenceToken: number;
  anchors: ClaimOccurrenceAnchor[];
};
export type SourceClaimRegistry = {
  schemaVersion: "tweet-source-claim-registry-v1";
  registryId: string;
  nextOccurrenceToken: number;
  nextTransitionToken: number;
  roots: ClaimSourceRoot[];
  sourceTexts: { sourceRootId: string; sourceTextVersionId: string; text: string; utf8Sha256: string; encoding: "utf8"; offsetUnit: "utf16_code_unit" }[];
  claims: SourceClaimRecord[];
  associations: { sourceClaimId: string; interpretationVersionId: string; association: ClaimSemanticAssociation }[];
  scenarioHolds: { scenarioId: string; sourceClaimId: string; interpretationVersionId: string; reason: string }[];
  alignments: { sourceClaimId: string; anchor: ClaimOccurrenceAnchor; alignment: ClaimAlignment }[];
  /** Suspected legacy relationships are retained even without sufficient proof. */
  legacyBindings: { sourceClaimId: string; kind: LegacyClaimRef["kind"]; key: string; payloadFingerprint: string; anchor: ClaimOccurrenceAnchor; basis: string | null }[];
  legacyCoverage: { sourceClaimId: string; kind: LegacyClaimRef["kind"]; key: string; payloadFingerprint: string; semanticFingerprint: string; status: "known_clear" | "committed"; effectKey: string | null; basis: string }[];
  evidenceVersions: { evidenceVersionId: string; sourceClaimId: string; anchor: ClaimOccurrenceAnchor; evidence: ClaimEvidence }[];
  interpretationVersions: { interpretationVersionId: string; sourceClaimId: string; evidenceVersionId: string; semanticFingerprint: string; interpretation: ClaimInterpretation; times: ClaimTimes }[];
  legacyRows: { kind: LegacyClaimRef["kind"]; key: string; payloadFingerprint: string; payload: ClaimJson; links: { sourceClaimId: string; evidenceVersionId: string; interpretationVersionId: string }[] }[];
  effects: { effectKey: string; transitionId: string; scenarioId: string; revisionId: string; sourceClaimIds: string[];
    rule: SourceClaimPlanInput["rule"]; semanticFingerprint: string; interpretationVersionId: string;
    acceptedTimes: ClaimTimes; plannedAtAsOf: string; status: "reserved" | "committed"; disputeStatus: "clear" | "disputed" }[];
};
export type SourceClaimProposal =
  | { kind: "record_evidence"; claimIndex: number; sourceClaimId: string; evidenceVersionId: string; interpretationVersionId: string; newEvidence: boolean; newInterpretation: boolean }
  | { kind: "reuse_effect"; claimIndex: number; sourceClaimId: string; effectKey: string; status: "reserved" | "committed" }
  | { kind: "propose_effect"; claimIndex: number; sourceClaimId: string; effectKey: string; interpretationVersionId: string }
  | { kind: "hold"; claimIndex: number; sourceClaimId: string | null; reason: string };
export type SourceClaimPlan = Readonly<{
  nextRegistry: SourceClaimRegistry;
  proposals: readonly SourceClaimProposal[];
  /** False means the whole proposed batch was discarded, including effect reservations. */
  accepted: boolean;
}>;

const nonblank = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const date = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, entry]) => `${JSON.stringify(name)}:${canonicalJson(entry)}`).join(",")}}`;
  throw new Error("Claim registry values must be finite plain JSON.");
}
function hash(kind: string, value: unknown): string {
  return `tweet-source-claim-v1:${kind}:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}
const clone = <T>(value: T): T => JSON.parse(canonicalJson(value)) as T;
const same = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);

export function emptySourceClaimRegistry(registryId: string): SourceClaimRegistry {
  if (!nonblank(registryId)) throw new Error("A persisted registry namespace is required.");
  return { schemaVersion: "tweet-source-claim-registry-v1", registryId, nextOccurrenceToken: 1, nextTransitionToken: 1, roots: [], sourceTexts: [], claims: [], associations: [], scenarioHolds: [], alignments: [], legacyBindings: [], legacyCoverage: [], evidenceVersions: [], interpretationVersions: [], legacyRows: [], effects: [] };
}
export function legacyClaimPayloadFingerprint(payload: ClaimJson): string {
  return hash("legacy-payload", payload);
}
export function sourceClaimTextVersionId(sourceRootId: string, text: string): string {
  return hash("text", [sourceRootId, text]);
}
/** Excludes parser/resolver/evidence versions; includes all resolved meaning fields. */
export function sourceClaimSemanticFingerprint(interpretation: ClaimInterpretation, effectiveAt: string): string {
  return hash("meaning", [interpretation.subject, interpretation.scope, interpretation.fact, interpretation.polarity, interpretation.assertionStrength, timestamp(effectiveAt)]);
}
function timestamp(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !date(value.slice(0, 10))) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function timeGate(times: ClaimTimes, asOf: number): string | null {
  const published = timestamp(times.originalPublishedAt), received = timestamp(times.receivedAt), interpreted = timestamp(times.interpretedAt);
  const effective = timestamp(times.effectiveAt), until = timestamp(times.validUntil), wrapper = times.wrapperPublishedAt === null ? null : timestamp(times.wrapperPublishedAt);
  if (published === null || received === null || interpreted === null || effective === null || until === null || (times.wrapperPublishedAt !== null && wrapper === null)) return "claim_times_unresolved";
  if (received < published || interpreted < received || (wrapper !== null && (wrapper < published || wrapper > received))) return "source_chronology_inconsistent";
  if (published > asOf || received > asOf || interpreted > asOf) return "outside_reporting_cutoff";
  if (until <= interpreted || until <= asOf || until <= effective) return "claim_validity_expired_or_unresolved";
  return null;
}
function validSpan(span: ClaimSpan, text: string): boolean {
  return Boolean(span) && Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) && span.start >= 0 && span.end > span.start && span.end <= text.length && text.slice(span.start, span.end) === span.text;
}
const contains = (parent: ClaimSpan, child: ClaimSpan): boolean => parent.start <= child.start && parent.end >= child.end;
function interpretationGate(value: ClaimInterpretation): string | null {
  if (!nonblank(value.parserVersion) || !nonblank(value.resolverVersion)) return "interpretation_version_unresolved";
  if (!positiveId(value.subject.playerId) || !positiveId(value.subject.teamId)) return "subject_unresolved";
  const scope = value.scope;
  if (!scope || !positiveId(scope.teamId) || scope.teamId !== value.subject.teamId || !date(scope.date)
    || (scope.kind === "game" ? !positiveId(scope.gameId) : scope.kind !== "session" || !nonblank(scope.sessionId))) return "scope_unresolved";
  if (!value.fact || !["positive", "negative"].includes(value.polarity)) return "fact_unresolved";
  if (value.validation.status !== "supported" || !nonblank(value.validation.basis)) return "validation_not_supported";
  if (value.fact.kind === "observation") {
    if (value.assertionStrength !== "observed" || !["practice", "warmup", "first_off"].includes(value.fact.activity) || typeof value.fact.present !== "boolean") return "modality_not_actionable";
  } else {
    if (value.assertionStrength !== "asserted") return "modality_not_actionable";
    if (scope.kind !== "game" || (value.fact.kind === "availability" && !["out", "available"].includes(value.fact.status)) || !["starter", "availability"].includes(value.fact.kind)) return "fact_scope_invalid";
  }
  return null;
}

function scenarioLegacyGate(registry: SourceClaimRegistry, scenarioId: string, semanticFingerprint: string): string | null {
  const claimIds = new Set(registry.associations.filter((entry) => entry.association.scenarioId === scenarioId).map((entry) => entry.sourceClaimId));
  const bindings = registry.legacyBindings.filter((entry) => claimIds.has(entry.sourceClaimId));
  if (bindings.some((binding) => !registry.legacyCoverage.some((coverage) => coverage.sourceClaimId === binding.sourceClaimId && coverage.kind === binding.kind && coverage.key === binding.key
    && coverage.payloadFingerprint === binding.payloadFingerprint && coverage.semanticFingerprint === semanticFingerprint))) return "legacy_or_prior_effect_history_unknown";
  if (bindings.some((binding) => !bindings.some((other) => other.sourceClaimId === binding.sourceClaimId && other.kind === binding.kind && other.key === binding.key
    && other.payloadFingerprint === binding.payloadFingerprint && other.basis !== null))) return "legacy_binding_unverified";
  return null;
}

/**
 * Plans one source-text batch atomically against a caller-retained snapshot.
 * Offsets use JavaScript UTF-16 units and are checked against exact source text.
 * Source verification, alignment and effect-history proofs must be established by
 * the caller; a string marked verified is not independent external verification.
 * Production use requires a transactional registry/outbox and immutable readback.
 */
export function planSourceClaims(registry: SourceClaimRegistry, input: SourceClaimPlanInput): SourceClaimPlan {
  const fail = (reason: string): SourceClaimPlan => ({ nextRegistry: clone(registry), accepted: false, proposals: input.claims.map((_, claimIndex) => ({ kind: "hold", claimIndex, sourceClaimId: null, reason })) });
  if (registry.schemaVersion !== "tweet-source-claim-registry-v1" || !nonblank(registry.registryId) || !positiveId(registry.nextOccurrenceToken) || !positiveId(registry.nextTransitionToken) || !Array.isArray(registry.legacyBindings) || !Array.isArray(registry.legacyCoverage) || !Array.isArray(registry.alignments) || !Array.isArray(registry.associations) || !Array.isArray(registry.scenarioHolds)) return fail("registry_schema_or_allocator_invalid");
  const unique = <T>(entries: readonly T[], identity: (entry: T) => string): boolean => new Set(entries.map(identity)).size === entries.length;
  if (!unique(registry.roots, (entry) => entry.sourceRootId) || !unique(registry.sourceTexts, (entry) => entry.sourceTextVersionId)
    || !unique(registry.claims, (entry) => entry.sourceClaimId) || !unique(registry.evidenceVersions, (entry) => entry.evidenceVersionId)
    || !unique(registry.interpretationVersions, (entry) => entry.interpretationVersionId) || !unique(registry.legacyRows, (entry) => canonicalJson([entry.kind, entry.key]))
    || !unique(registry.effects, (entry) => entry.effectKey) || !unique(registry.effects, (entry) => entry.transitionId) || !unique(registry.effects, (entry) => entry.scenarioId)
    || registry.legacyRows.some((entry) => entry.payloadFingerprint !== legacyClaimPayloadFingerprint(entry.payload))
    || registry.effects.some((entry) => !entry.sourceClaimIds.length || entry.sourceClaimIds.some((id) => !registry.claims.some((claim) => claim.sourceClaimId === id))
      || !registry.interpretationVersions.some((version) => version.interpretationVersionId === entry.interpretationVersionId && version.semanticFingerprint === entry.semanticFingerprint))) return fail("registry_identity_collision_or_inconsistent");
  const cutoff = timestamp(input.asOf);
  if (cutoff === null) return fail("decision_cutoff_unresolved");
  const root = input.source;
  if (!nonblank(root.sourceRootId)) return fail("source_identity_unresolved");
  const qualifiedOriginal = root.verification.status === "verified" && nonblank(root.verification.basis)
    && typeof root.originalTweetId === "string" && /^\d+$/.test(root.originalTweetId)
    && typeof root.originalAuthor === "string" && /^[A-Za-z0-9_]{1,15}$/.test(root.originalAuthor);
  if (!qualifiedOriginal && (!nonblank(root.retainedSourceId) || root.verification.status !== "pending" || !nonblank(root.verification.reason))) return fail("source_lineage_unverified");
  if (input.sourceTextVersionId !== sourceClaimTextVersionId(root.sourceRootId, input.sourceText)) return fail("source_text_version_mismatch");
  if (!nonblank(input.rule.ruleId) || !nonblank(input.rule.ruleVersion) || !nonblank(input.rule.effectType)) return fail("rule_identity_unresolved");
  const existingRoot = registry.roots.find((entry) => entry.sourceRootId === root.sourceRootId);
  if (existingRoot && (existingRoot.originalTweetId !== root.originalTweetId || existingRoot.originalAuthor?.toLowerCase() !== root.originalAuthor?.toLowerCase() || existingRoot.retainedSourceId !== root.retainedSourceId)) return fail("source_root_identity_collision");
  if (registry.roots.some((entry) => entry.sourceRootId !== root.sourceRootId && root.originalTweetId !== null && entry.originalTweetId === root.originalTweetId)) return fail("source_root_alias_unresolved");
  if (registry.roots.some((entry) => entry.sourceRootId !== root.sourceRootId && nonblank(root.retainedSourceId) && entry.retainedSourceId === root.retainedSourceId)) return fail("retained_source_root_alias_unresolved");
  const existingText = registry.sourceTexts.find((entry) => entry.sourceTextVersionId === input.sourceTextVersionId);
  if (existingText && (existingText.sourceRootId !== root.sourceRootId || existingText.text !== input.sourceText || existingText.utf8Sha256 !== createHash("sha256").update(input.sourceText, "utf8").digest("hex") || existingText.encoding !== "utf8" || existingText.offsetUnit !== "utf16_code_unit")) return fail("immutable_source_text_collision");
  const anchors = input.claims.map((candidate) => ({ sourceTextVersionId: input.sourceTextVersionId, subjectSpan: candidate.subjectSpan, predicateSpan: candidate.predicateSpan }));
  if (new Set(anchors.map(canonicalJson)).size !== anchors.length) return fail("duplicate_or_split_occurrence_alignment");
  const alignedIds = input.claims.flatMap((candidate) => candidate.alignment?.kind === "verified_one_to_one" ? [candidate.alignment.sourceClaimId] : []);
  if (new Set(alignedIds).size !== alignedIds.length) return fail("split_merge_alignment_held");
  for (const [claimIndex, candidate] of input.claims.entries()) {
    const spans = [candidate.subjectSpan, candidate.predicateSpan, candidate.evidence.governingClauseSpan, ...candidate.evidence.displaySpans, ...candidate.evidence.contextSpans];
    if (!nonblank(candidate.evidence.representationVersion) || !candidate.evidence.displaySpans.length || spans.some((span) => !validSpan(span, input.sourceText))
      || !contains(candidate.evidence.governingClauseSpan, candidate.subjectSpan) || !contains(candidate.evidence.governingClauseSpan, candidate.predicateSpan)) return fail(`invalid_lexical_or_evidence_span:${claimIndex}`);
    for (const legacy of candidate.legacyRefs) {
      if (!["report", "event", "capture"].includes(legacy.kind) || !nonblank(legacy.key)) return fail("invalid_legacy_reference");
      const previous = registry.legacyRows.find((row) => row.kind === legacy.kind && row.key === legacy.key);
      if (previous && previous.payloadFingerprint !== legacyClaimPayloadFingerprint(legacy.payload)) return fail("immutable_legacy_payload_collision");
    }
  }
  // Detect differing payloads in this batch before any evidence/effect proposal.
  const incomingLegacy = new Map<string, string>();
  for (const candidate of input.claims) for (const legacy of candidate.legacyRefs) {
    const identity = canonicalJson([legacy.kind, legacy.key]), payload = legacyClaimPayloadFingerprint(legacy.payload);
    if (incomingLegacy.has(identity) && incomingLegacy.get(identity) !== payload) return fail("immutable_legacy_payload_collision");
    incomingLegacy.set(identity, payload);
  }
  const next = clone(registry), proposals: SourceClaimProposal[] = [];
  if (!existingRoot) next.roots.push(clone(root));
  if (!existingText) next.sourceTexts.push({ sourceRootId: root.sourceRootId, sourceTextVersionId: input.sourceTextVersionId, text: input.sourceText, utf8Sha256: createHash("sha256").update(input.sourceText, "utf8").digest("hex"), encoding: "utf8", offsetUnit: "utf16_code_unit" });
  for (const [claimIndex, candidate] of input.claims.entries()) {
    const anchor = anchors[claimIndex]!;
    const exact = next.claims.filter((entry) => entry.sourceRootId === root.sourceRootId && entry.anchors.some((existing) => same(existing, anchor)));
    if (exact.length > 1) return fail("ambiguous_occurrence_alignment");
    let claim = exact[0];
    const alignment = candidate.alignment;
    if (alignment && (!nonblank(alignment.basis) || alignment.sourceRootId !== root.sourceRootId)) return fail("alignment_lineage_unverified");
    if (alignment?.kind === "verified_one_to_one") {
      const aligned = next.claims.find((entry) => entry.sourceClaimId === alignment.sourceClaimId);
      if (!aligned || aligned.sourceRootId !== root.sourceRootId || !aligned.anchors.some((existing) => same(existing, alignment.priorAnchor)) || (claim && claim.sourceClaimId !== aligned.sourceClaimId)) return fail("alignment_target_invalid_or_conflicting");
      if (aligned.anchors.some((existing) => existing.sourceTextVersionId === input.sourceTextVersionId && !same(existing, anchor))) return fail("split_merge_alignment_held");
      claim = aligned;
    }
    if (!claim) {
      // Overlapping lexical anchors in the SAME immutable text are a changed
      // extraction of an existing occurrence, not evidence of an independent
      // claim. Disjoint repeated subjects/shared-clause subjects stay distinct.
      const overlaps = (a: ClaimSpan, b: ClaimSpan) => a.start < b.end && b.start < a.end;
      if (next.claims.some((entry) => entry.sourceRootId === root.sourceRootId && entry.anchors.some((existing) => existing.sourceTextVersionId === input.sourceTextVersionId
        && overlaps(existing.subjectSpan, anchor.subjectSpan) && overlaps(existing.predicateSpan, anchor.predicateSpan)))) return fail("overlapping_same_text_anchor_change_held");
      const hasPriorText = next.claims.some((entry) => entry.sourceRootId === root.sourceRootId && entry.anchors.some((existing) => existing.sourceTextVersionId !== input.sourceTextVersionId));
      if (hasPriorText && alignment?.kind !== "verified_new_occurrence") return fail("cross_variant_alignment_required");
      const occurrenceToken = next.nextOccurrenceToken++;
      claim = { sourceClaimId: `${root.sourceRootId}:occurrence:${occurrenceToken}`, sourceRootId: root.sourceRootId, occurrenceToken, anchors: [] };
      if (next.claims.some((entry) => entry.sourceClaimId === claim!.sourceClaimId)) return fail("occurrence_allocator_collision");
      next.claims.push(claim);
    }
    if (!claim.anchors.some((existing) => same(existing, anchor))) claim.anchors.push(clone(anchor));
    if (alignment) {
      const alignmentRecord = { sourceClaimId: claim.sourceClaimId, anchor: clone(anchor), alignment: clone(alignment) };
      if (!next.alignments.some((existing) => same(existing, alignmentRecord))) next.alignments.push(alignmentRecord);
    }
    const evidenceVersionId = hash("evidence", [claim.sourceClaimId, anchor, candidate.evidence]);
    const semanticFingerprint = sourceClaimSemanticFingerprint(candidate.interpretation, candidate.times.effectiveAt);
    const interpretationVersionId = hash("interpretation", [claim.sourceClaimId, evidenceVersionId, candidate.interpretation, candidate.times]);
    const expectedEvidence = { evidenceVersionId, sourceClaimId: claim.sourceClaimId, anchor: clone(anchor), evidence: clone(candidate.evidence) };
    const expectedInterpretation = { interpretationVersionId, sourceClaimId: claim.sourceClaimId, evidenceVersionId, semanticFingerprint, interpretation: clone(candidate.interpretation), times: clone(candidate.times) };
    const retainedEvidence = next.evidenceVersions.filter((entry) => entry.evidenceVersionId === evidenceVersionId);
    const retainedInterpretation = next.interpretationVersions.filter((entry) => entry.interpretationVersionId === interpretationVersionId);
    if (retainedEvidence.length > 1 || (retainedEvidence[0] && !same(retainedEvidence[0], expectedEvidence))) return fail("immutable_evidence_version_collision");
    if (retainedInterpretation.length > 1 || (retainedInterpretation[0] && !same(retainedInterpretation[0], expectedInterpretation))) return fail("immutable_interpretation_version_collision");
    const newEvidence = !retainedEvidence.length;
    const newInterpretation = !retainedInterpretation.length;
    if (newEvidence) next.evidenceVersions.push(expectedEvidence);
    if (newInterpretation) next.interpretationVersions.push(expectedInterpretation);
    for (const legacy of candidate.legacyRefs) {
      let row = next.legacyRows.find((entry) => entry.kind === legacy.kind && entry.key === legacy.key);
      if (!row) { row = { kind: legacy.kind, key: legacy.key, payloadFingerprint: legacyClaimPayloadFingerprint(legacy.payload), payload: clone(legacy.payload), links: [] }; next.legacyRows.push(row); }
      // Event keys name one lexical event. Parent reports/captures may name several.
      if (row.kind === "event" && (row.links.some((link) => link.sourceClaimId !== claim!.sourceClaimId) || next.legacyBindings.some((binding) => binding.kind === row!.kind && binding.key === row!.key && binding.sourceClaimId !== claim!.sourceClaimId))) return fail("legacy_event_alignment_ambiguous");
      const proof = legacy.bindingProof;
      const verifiedBinding = proof && nonblank(proof.basis) && proof.sourceRootId === root.sourceRootId && same(proof.anchor, anchor);
      const binding = { sourceClaimId: claim.sourceClaimId, kind: legacy.kind, key: legacy.key, payloadFingerprint: row.payloadFingerprint, anchor: clone(anchor), basis: verifiedBinding ? proof.basis : null };
      if (!next.legacyBindings.some((existing) => same(existing, binding))) next.legacyBindings.push(binding);
      const link = { sourceClaimId: claim.sourceClaimId, evidenceVersionId, interpretationVersionId };
      if (verifiedBinding && !row.links.some((existing) => same(existing, link))) row.links.push(link);
    }
    const associationRecord = { sourceClaimId: claim.sourceClaimId, interpretationVersionId, association: clone(candidate.association) };
    if (!next.associations.some((existing) => same(existing, associationRecord))) next.associations.push(associationRecord);
    const holdScenario = (scenarioId: string, reason: string) => {
      const record = { scenarioId, sourceClaimId: claim!.sourceClaimId, interpretationVersionId, reason };
      if (!next.scenarioHolds.some((existing) => same(existing, record))) next.scenarioHolds.push(record);
      for (const effect of next.effects.filter((entry) => entry.scenarioId === scenarioId)) effect.disputeStatus = "disputed";
    };
    proposals.push({ kind: "record_evidence", claimIndex, sourceClaimId: claim.sourceClaimId, evidenceVersionId, interpretationVersionId, newEvidence, newInterpretation });
    const hold = (reason: string) => proposals.push({ kind: "hold", claimIndex, sourceClaimId: claim!.sourceClaimId, reason });
    if (!qualifiedOriginal) { hold("original_identity_unresolved"); continue; }
    const priorQualified = registry.interpretationVersions.filter((entry) => entry.sourceClaimId === claim!.sourceClaimId && interpretationGate(entry.interpretation) === null);
    if (interpretationGate(candidate.interpretation) === null && priorQualified.some((entry) => entry.semanticFingerprint !== semanticFingerprint)) {
      for (const entry of next.associations.filter((item) => item.sourceClaimId === claim!.sourceClaimId)) holdScenario(entry.association.scenarioId, "material_qualified_reinterpretation_requires_resolution");
      hold("material_qualified_reinterpretation_requires_resolution"); continue;
    }
    const priorEffects = next.effects.filter((entry) => entry.sourceClaimIds.includes(claim!.sourceClaimId));
    // A changed interpretation after even a reserved effect is never a fresh
    // acceptance in another scenario. An explicit resolution policy is needed.
    if (priorEffects.some((entry) => entry.semanticFingerprint !== semanticFingerprint)) { hold("material_reinterpretation_after_effect"); continue; }
    const gate = interpretationGate(candidate.interpretation) ?? timeGate(candidate.times, cutoff);
    if (gate) { hold(gate); continue; }
    const association = candidate.association;
    if (!nonblank(association.scenarioId) || !nonblank(association.revisionId)) { hold("semantic_association_unresolved"); continue; }
    // Retained unknown legacy coverage is monotonic: omitting refs on a later
    // replay or supplying generic known_clear never clears an earlier hold.
    // A resolution must enumerate exact payloads and independently prove their
    // unique source binding and scoped sink coverage.
    const scenarioClaimIds = new Set(next.associations.filter((entry) => entry.association.scenarioId === association.scenarioId).map((entry) => entry.sourceClaimId));
    const bindings = next.legacyBindings.filter((entry) => scenarioClaimIds.has(entry.sourceClaimId));
    const history = candidate.effectHistory;
    const scenarioEffects = next.effects.filter((entry) => entry.scenarioId === association.scenarioId);
    // Semantic conflicts are independent of legacy delivery uncertainty. Record
    // them before any coverage/receipt gate can short-circuit this claim.
    if (association.disposition === "conflict" || scenarioEffects.some((entry) => entry.revisionId !== association.revisionId)) {
      holdScenario(association.scenarioId, "semantic_scenario_conflict");
      hold("semantic_scenario_conflict"); continue;
    }

    if (history?.status === "committed" && (!nonblank(history.basis) || !nonblank(history.effectKey) || history.scenarioId !== association.scenarioId
      || history.semanticFingerprint !== semanticFingerprint || timestamp(history.acceptedTimes.effectiveAt) !== timestamp(candidate.times.effectiveAt)
      || timeGate(history.acceptedTimes, cutoff) !== null || scenarioEffects.some((effect) => effect.effectKey !== history.effectKey || !same(effect.acceptedTimes, history.acceptedTimes))
      || next.effects.some((effect) => effect.effectKey === history.effectKey && effect.scenarioId !== association.scenarioId))) {
      hold("legacy_effect_binding_unverified_or_conflicting"); continue;
    }
    if (history && history.status !== "unknown" && nonblank(history.basis)) {
      for (const covered of history.coveredLegacyRefs ?? []) {
        for (const bound of bindings.filter((entry) => entry.kind === covered.kind && entry.key === covered.key && entry.payloadFingerprint === covered.payloadFingerprint && entry.basis !== null)) {
          const coverage = { sourceClaimId: bound.sourceClaimId, kind: covered.kind, key: covered.key, payloadFingerprint: covered.payloadFingerprint, semanticFingerprint,
            status: history.status, effectKey: history.status === "committed" ? history.effectKey : null, basis: history.basis };
          if (!next.legacyCoverage.some((existing) => same(existing, coverage))) next.legacyCoverage.push(coverage);
        }
      }
    }
    const legacyGate = scenarioLegacyGate(next, association.scenarioId, semanticFingerprint);
    if (legacyGate) { hold(legacyGate); continue; }
    if (!["initial_acceptance", "corroboration"].includes(association.disposition)) { hold("semantic_association_pending"); continue; }
    if (next.scenarioHolds.some((entry) => entry.scenarioId === association.scenarioId)) { hold("semantic_scenario_disputed"); continue; }
    const effect = scenarioEffects[0];
    if (effect && candidate.effectHistory?.status === "committed" && (candidate.effectHistory.effectKey !== effect.effectKey || candidate.effectHistory.scenarioId !== association.scenarioId || candidate.effectHistory.semanticFingerprint !== semanticFingerprint || !same(candidate.effectHistory.acceptedTimes, effect.acceptedTimes))) {
      hold("multiple_or_conflicting_prior_effects_require_resolution"); continue;
    }
    if (effect) {
      if (effect.semanticFingerprint !== semanticFingerprint) return fail("immutable_semantic_revision_collision");
      if (timestamp(effect.acceptedTimes.validUntil)! <= cutoff) { hold("initial_acceptance_expired"); continue; }
      if (effect.disputeStatus !== "clear") { hold("semantic_scenario_disputed"); continue; }
      if (!same(effect.rule, input.rule)) { hold("rule_change_requires_effect_policy"); continue; }
      if (history?.status === "committed") effect.status = "committed";
      if (!effect.sourceClaimIds.includes(claim.sourceClaimId)) effect.sourceClaimIds.push(claim.sourceClaimId);
      proposals.push({ kind: "reuse_effect", claimIndex, sourceClaimId: claim.sourceClaimId, effectKey: effect.effectKey, status: effect.status });
      continue;
    }
    if (priorEffects.length) { hold("semantic_scenario_rebind_requires_resolution"); continue; }
    if (!history || history.status === "unknown") { hold("legacy_or_prior_effect_history_unknown"); continue; }
    if (!nonblank(history.basis)) { hold("effect_history_proof_missing"); continue; }
    if (association.disposition !== "initial_acceptance") { hold("initial_acceptance_not_established"); continue; }
    if (history.status === "committed" && (!nonblank(history.effectKey) || history.scenarioId !== association.scenarioId || history.semanticFingerprint !== semanticFingerprint || timestamp(history.acceptedTimes.effectiveAt) !== timestamp(candidate.times.effectiveAt) || timeGate(history.acceptedTimes, cutoff) !== null || next.effects.some((entry) => entry.effectKey === history.effectKey))) { hold("legacy_effect_binding_unverified_or_conflicting"); continue; }
    const transitionId = `${next.registryId}:transition:${next.nextTransitionToken++}`;
    if (next.effects.some((entry) => entry.transitionId === transitionId)) return fail("transition_allocator_collision");
    const effectKey = history.status === "committed" ? history.effectKey : hash("effect", [input.rule.effectType, association.scenarioId, transitionId]);
    const status = history.status === "committed" ? "committed" : "reserved";
    next.effects.push({ effectKey, transitionId, scenarioId: association.scenarioId, revisionId: association.revisionId,
      sourceClaimIds: [claim.sourceClaimId], rule: clone(input.rule), semanticFingerprint, interpretationVersionId,
      acceptedTimes: clone(history.status === "committed" ? history.acceptedTimes : candidate.times), plannedAtAsOf: input.asOf, status, disputeStatus: "clear" });
    if (status === "committed") proposals.push({ kind: "reuse_effect", claimIndex, sourceClaimId: claim.sourceClaimId, effectKey, status });
    else proposals.push({ kind: "propose_effect", claimIndex, sourceClaimId: claim.sourceClaimId, effectKey, interpretationVersionId });
  }
  // Evaluate final scenario-wide eligibility after ALL claims. A later conflict
  // or newly discovered unknown legacy row suppresses earlier proposals/reuse.
  // Reservation history remains retained; it is never a dispatch instruction.
  const finalProposals = proposals.map((proposal): SourceClaimProposal => {
    if (proposal.kind !== "propose_effect" && proposal.kind !== "reuse_effect") return proposal;
    const effect = next.effects.find((entry) => entry.effectKey === proposal.effectKey)!;
    const reason = effect.disputeStatus !== "clear" || next.scenarioHolds.some((entry) => entry.scenarioId === effect.scenarioId)
      ? "semantic_scenario_disputed" : scenarioLegacyGate(next, effect.scenarioId, effect.semanticFingerprint)
      ?? (timestamp(effect.acceptedTimes.validUntil)! <= cutoff ? "initial_acceptance_expired" : null);
    return reason ? { kind: "hold", claimIndex: proposal.claimIndex, sourceClaimId: proposal.sourceClaimId, reason } : proposal;
  });
  return { nextRegistry: next, proposals: finalProposals, accepted: true };
}
