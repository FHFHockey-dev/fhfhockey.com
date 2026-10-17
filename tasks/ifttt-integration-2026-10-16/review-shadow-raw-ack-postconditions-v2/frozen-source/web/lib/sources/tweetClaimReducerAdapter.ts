import { createHash } from "node:crypto";
import {
  emptySourceClaimRegistry, legacyClaimPayloadFingerprint, planSourceClaims, sourceClaimSemanticFingerprint,
  type ClaimAlignment, type ClaimEffectHistory, type ClaimEvidence, type ClaimInterpretation,
  type ClaimSourceRoot, type ClaimSpan, type LegacyClaimRef, type SourceClaimCandidate,
  type SourceClaimPlanInput, type SourceClaimProposal, type SourceClaimRegistry,
} from "./tweetSourceClaimRegistry";
import {
  reduceTweetSemanticEvents, type TweetSemanticObservation, type TweetSemanticReduction,
  type TweetSemanticScope,
} from "./tweetSemanticEvents";

/** OFFLINE NO-DISPATCH CANDIDATE. Neither this module nor its dependencies dispatch. */
export type RetainedClaimDerivation = Readonly<{
  /** Keep the reducer ID as the immutable derivation ID, never an occurrence ID. */
  observation: TweetSemanticObservation;
  source: ClaimSourceRoot;
  sourceTextVersionId: string;
  sourceText: string;
  subjectSpan: ClaimSpan;
  predicateSpan: ClaimSpan;
  evidence: ClaimEvidence;
  parserVersion: string;
  resolverVersion: string;
  polarity: ClaimInterpretation["polarity"];
  /** Caller-established source-time binding, not a current-roster inference. */
  binding:
    | { status: "verified"; basis: string; playerId: number; teamId: number; league: "NHL";
        role: "goalie" | "skater"; scopeDate: string; governingPredicateBasis: string }
    | { status: "pending"; reason: string };
}>;

export type ScopedDeliveryCoverage =
  | { status: "verified"; basis: string; scenarioKey: string; scope: TweetSemanticScope;
      effectType: string; history: Exclude<ClaimEffectHistory, { status: "unknown" }> }
  | { status: "unknown"; reason: string };

export type ClaimDerivationIngress = Readonly<{
  immutable: RetainedClaimDerivation;
  /** Mutable proof/readback inputs; these do not replace an immutable derivation. */
  compatibility: Readonly<{
    alignment?: ClaimAlignment;
    legacyRefs: readonly LegacyClaimRef[];
    delivery: ScopedDeliveryCoverage;
  }>;
}>;
export type AdapterDerivationRecord = {
  id: string;
  immutableSha256: string;
  ingress: ClaimDerivationIngress;
  /** A later generic clear/unknown proof cannot erase a retained sink receipt. */
  committedDeliveryEvidence: ScopedDeliveryCoverage[];
  links: { sourceClaimId: string; evidenceVersionId: string; interpretationVersionId: string }[];
};
export type TweetClaimAdapterState = {
  schemaVersion: "tweet-claim-reducer-adapter-v1";
  registry: SourceClaimRegistry;
  /** First-admission order is retained across retries and serialized reloads. */
  derivations: AdapterDerivationRecord[];
};
export type TweetClaimAdapterInput = Readonly<{
  batch: readonly ClaimDerivationIngress[];
  asOf: string;
  rule: SourceClaimPlanInput["rule"];
  /** Must describe the complete retained view from retainedReducerObservations. */
  reduction: TweetSemanticReduction;
}>;
export type AdapterDecisionTrace = {
  derivationId: string;
  observationIndex: number;
  reducerDisposition: TweetSemanticReduction["associations"][number]["disposition"];
  scenarioKey: string | null;
  revisionKey: string | null;
  finalScenarioStatus: TweetSemanticReduction["scenarios"][number]["status"] | null;
  adapterHolds: string[];
  proposals: SourceClaimProposal[];
};
export type TweetClaimAdapterPlan = {
  accepted: boolean;
  noDispatch: true;
  nextState: TweetClaimAdapterState;
  reduction: TweetSemanticReduction;
  holds: string[];
  trace: AdapterDecisionTrace[];
  /** Reviewable in-memory reservations, NOT outbox requests or dispatch commands. */
  reviewableEffects: { effectKey: string; scenarioKey: string; transitionId: string; status: "reserved" | "committed" }[];
  dispatchInstructions: readonly [];
};

function json(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(json).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${json(v)}`).join(",")}}`;
  throw new Error("Adapter inputs must be finite plain JSON without undefined.");
}
const same = (a: unknown, b: unknown) => json(a) === json(b);
const clone = <T>(value: T): T => JSON.parse(json(value)) as T;
const digest = (value: unknown) => createHash("sha256").update(json(value)).digest("hex");
const nonblank = (value: string) => value.trim().length > 0;
const positiveId = (value: number) => Number.isSafeInteger(value) && value > 0;

export function emptyTweetClaimAdapterState(registryId: string): TweetClaimAdapterState {
  return { schemaVersion: "tweet-claim-reducer-adapter-v1", registry: emptySourceClaimRegistry(registryId), derivations: [] };
}

function merge(state: TweetClaimAdapterState, batch: readonly ClaimDerivationIngress[]): AdapterDerivationRecord[] {
  if (state.schemaVersion !== "tweet-claim-reducer-adapter-v1") throw new Error("adapter_state_schema_invalid");
  const records = clone(state.derivations);
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id) || record.id !== record.ingress.immutable.observation.id
      || record.immutableSha256 !== digest(record.ingress.immutable)) throw new Error("retained_derivation_identity_collision");
    if (!Array.isArray(record.committedDeliveryEvidence) || record.committedDeliveryEvidence.some((proof) => proof.status !== "verified" || proof.history.status !== "committed"))
      throw new Error("retained_committed_delivery_evidence_invalid");
    seen.add(record.id);
    for (const link of record.links) {
      const interpretation = state.registry.interpretationVersions.find((entry) => entry.interpretationVersionId === link.interpretationVersionId);
      if (!interpretation || interpretation.sourceClaimId !== link.sourceClaimId || interpretation.evidenceVersionId !== link.evidenceVersionId)
        throw new Error("retained_derivation_link_invalid");
    }
  }
  for (const ingress of batch) {
    const id = ingress.immutable.observation.id;
    if (!nonblank(id) || id.startsWith(`${ingress.immutable.source.sourceRootId}:occurrence:`)
      || state.registry.claims.some((claim) => claim.sourceClaimId === id)) throw new Error("observation_id_must_remain_derivation_id");
    const immutableSha256 = digest(ingress.immutable);
    const previous = records.find((record) => record.id === id);
    if (previous && (previous.immutableSha256 !== immutableSha256 || !same(previous.ingress.immutable, ingress.immutable)))
      throw new Error("immutable_derivation_payload_collision");
    if (previous) {
      // A retry may add readback proofs, but cannot hide a legacy row already
      // supplied in this same batch (before any planner call has retained it).
      const legacyRefs = clone([...previous.ingress.compatibility.legacyRefs]);
      for (const ref of ingress.compatibility.legacyRefs) {
        const index = legacyRefs.findIndex((old) => old.kind === ref.kind && old.key === ref.key);
        if (index < 0) legacyRefs.push(clone(ref));
        else {
          if (!same(legacyRefs[index]!.payload, ref.payload)) throw new Error("immutable_legacy_payload_collision");
          if (ref.bindingProof) legacyRefs[index] = clone(ref);
        }
      }
      previous.ingress = { immutable: clone(ingress.immutable), compatibility: { ...clone(ingress.compatibility), legacyRefs } };
      const delivery = ingress.compatibility.delivery;
      if (delivery.status === "verified" && delivery.history.status === "committed"
        && !previous.committedDeliveryEvidence.some((proof) => same(proof, delivery))) previous.committedDeliveryEvidence.push(clone(delivery));
    }
    else {
      const delivery = ingress.compatibility.delivery;
      records.push({ id, immutableSha256, ingress: clone(ingress), links: [],
        committedDeliveryEvidence: delivery.status === "verified" && delivery.history.status === "committed" ? [clone(delivery)] : [] });
    }
  }
  return records;
}

/** Build the complete immutable view; exact retries are traced by ingress, not reallocated. */
export function retainedReducerObservations(state: TweetClaimAdapterState, batch: readonly ClaimDerivationIngress[]): TweetSemanticObservation[] {
  return merge(state, batch).map((record) => record.ingress.immutable.observation);
}

function bindingHold(derivation: RetainedClaimDerivation): string | null {
  const { observation: o, binding: b } = derivation;
  if (!same(o.evidence, derivation.evidence.displaySpans[0] ?? null)) return "observation_display_evidence_mismatch";
  if (o.original.tweetId !== derivation.source.originalTweetId || o.original.author?.toLowerCase() !== derivation.source.originalAuthor?.toLowerCase())
    return "observation_retained_source_mismatch";
  if (b.status !== "verified" || !nonblank(b.basis) || !nonblank(b.governingPredicateBasis)) return "source_time_binding_pending";
  if (!positiveId(b.playerId) || !positiveId(b.teamId) || b.league !== "NHL" || !/^\d{4}-\d{2}-\d{2}$/.test(b.scopeDate)
    || !Number.isFinite(Date.parse(`${b.scopeDate}T00:00:00Z`)) || new Date(`${b.scopeDate}T00:00:00Z`).toISOString().slice(0, 10) !== b.scopeDate)
    return "source_time_binding_invalid";
  if (!o.scope || o.scope.teamId !== b.teamId || o.scope.kind === "effective_period"
    || (o.scope.kind === "session" && o.scope.date !== b.scopeDate)) return "source_time_scope_mismatch_or_unsupported";
  if (o.fact && "playerId" in o.fact && o.fact.playerId !== b.playerId) return "source_time_subject_mismatch";
  if (o.fact?.kind === "starter" && b.role !== "goalie") return "starter_requires_source_time_goalie_role";
  if (derivation.polarity !== "positive") return "polarity_not_supported_for_reducer_fact";
  if (!nonblank(derivation.parserVersion) || !nonblank(derivation.resolverVersion)) return "derivation_version_unresolved";
  return null;
}

function interpretation(derivation: RetainedClaimDerivation): ClaimInterpretation {
  const o = derivation.observation, b = derivation.binding;
  const hold = bindingHold(derivation);
  const scope = b.status === "verified" && o.scope?.kind === "game"
    ? { kind: "game" as const, gameId: o.scope.gameId, date: b.scopeDate, teamId: o.scope.teamId }
    : o.scope?.kind === "session" ? { kind: "session" as const, sessionId: o.scope.sessionId, date: o.scope.date, teamId: o.scope.teamId } : null;
  const fact = o.fact?.kind === "availability" ? { kind: "availability" as const, status: o.fact.status }
    : o.fact?.kind === "starter" ? { kind: "starter" as const }
    : o.fact?.kind === "observation" ? { kind: "observation" as const, activity: o.fact.activity, present: o.fact.present } : null;
  return {
    parserVersion: derivation.parserVersion, resolverVersion: derivation.resolverVersion,
    subject: { playerId: b.status === "verified" ? b.playerId : null, teamId: b.status === "verified" ? b.teamId : null },
    scope, fact, polarity: derivation.polarity,
    assertionStrength: o.modality === "observation" ? "observed" : o.modality,
    validation: hold ? { status: "pending", reason: hold }
      : o.support.status === "supported" ? { status: "supported", basis: `${b.status === "verified" ? b.basis : ""}; ${o.support.basis}` }
      : { status: "pending", reason: o.support.reason },
  };
}

function coverageHolds(record: AdapterDerivationRecord, scenarioKey: string, scope: TweetSemanticScope, effectType: string): string[] {
  const { immutable: d, compatibility: c } = record.ingress;
  const coverage = c.delivery;
  if (coverage.status !== "verified") return ["scoped_sink_history_unknown"];
  if (!nonblank(coverage.basis) || coverage.scenarioKey !== scenarioKey || !same(coverage.scope, scope) || coverage.effectType !== effectType
    || !nonblank(coverage.history.basis)) return ["scoped_sink_coverage_mismatch"];
  if (coverage.history.status === "committed" && (!nonblank(coverage.history.effectKey) || coverage.history.scenarioId !== scenarioKey
    || coverage.history.semanticFingerprint !== sourceClaimSemanticFingerprint(interpretation(d), d.observation.effectiveAt ?? "")))
    return ["committed_receipt_scope_or_meaning_mismatch"];
  const anchor = { sourceTextVersionId: d.sourceTextVersionId, subjectSpan: d.subjectSpan, predicateSpan: d.predicateSpan };
  for (const ref of c.legacyRefs) {
    if (!ref.bindingProof || ref.bindingProof.sourceRootId !== d.source.sourceRootId
      || !nonblank(ref.bindingProof.basis) || !same(ref.bindingProof.anchor, anchor)) return ["legacy_source_occurrence_binding_unverified"];
    if (!(coverage.history.coveredLegacyRefs ?? []).some((covered) => covered.kind === ref.kind && covered.key === ref.key
      && covered.payloadFingerprint === legacyClaimPayloadFingerprint(ref.payload))) return ["exact_legacy_sink_coverage_missing"];
  }
  return [];
}

/**
 * Rechecks the complete final reducer result, retains every derivation, and plans
 * against ALL retained sources before exposing reviewable effects. No callbacks,
 * I/O, clock reads, persistence, outbox insertion or dispatch are supported.
 */
export function adaptTweetClaimReduction(state: TweetClaimAdapterState, input: TweetClaimAdapterInput): TweetClaimAdapterPlan {
  const failed = (reason: string): TweetClaimAdapterPlan => ({ accepted: false, noDispatch: true, nextState: clone(state), reduction: input.reduction,
    holds: [reason], trace: [], reviewableEffects: [], dispatchInstructions: [] });
  let records: AdapterDerivationRecord[], reduction: TweetSemanticReduction;
  try {
    records = merge(state, input.batch);
    reduction = reduceTweetSemanticEvents(records.map((record) => record.ingress.immutable.observation), input.asOf);
    if (!same(reduction, input.reduction)) return failed("reduction_not_complete_final_retained_view");
  } catch (error) { return failed(error instanceof Error ? error.message : "adapter_input_invalid"); }

  const scenarioHolds = new Map<string, Set<string>>();
  const addHold = (key: string, reason: string) => {
    const reasons = scenarioHolds.get(key) ?? new Set<string>(); reasons.add(reason); scenarioHolds.set(key, reasons);
  };
  const traces: AdapterDecisionTrace[] = [];
  for (const [index, record] of records.entries()) {
    const a = reduction.associations[index]!, scenario = reduction.scenarios.find((s) => s.key === a.scenarioKey);
    const localHolds: string[] = [];
    const binding = bindingHold(record.ingress.immutable);
    if (binding) localHolds.push(binding);
    if (a.reason) localHolds.push(`reducer:${a.reason}`);
    if (!scenario || scenario.status !== "accepted") localHolds.push(`final_scenario:${scenario?.status ?? "unbound"}`);
    const actionable = a.disposition === "accepted" || a.disposition === "corroboration";
    if (scenario && (actionable || record.ingress.compatibility.legacyRefs.length)) {
      const coverage = coverageHolds(record, scenario.key, scenario.scope, input.rule.effectType);
      localHolds.push(...coverage); coverage.forEach((reason) => addHold(scenario.key, reason));
    }
    if (binding && actionable && scenario) addHold(scenario.key, binding);
    traces.push({ derivationId: record.id, observationIndex: index, reducerDisposition: a.disposition, scenarioKey: a.scenarioKey,
      revisionKey: a.revisionKey, finalScenarioStatus: scenario?.status ?? null, adapterHolds: localHolds, proposals: [] });
  }
  // Complete scenario receipt consistency is required before the first planner
  // call. A clear sink history and a committed receipt for the SAME exact scope
  // conflict; neither source order nor the first successful reservation resolves it.
  for (const scenario of reduction.scenarios) {
    const histories = records.flatMap((record, index) => reduction.associations[index]!.scenarioKey === scenario.key
      ? [record.ingress.compatibility.delivery, ...record.committedDeliveryEvidence].flatMap((proof) => proof.status === "verified" ? [proof.history] : []) : []);
    const committed = histories.filter((history) => history.status === "committed");
    if (committed.length && histories.some((history) => history.status === "known_clear")) addHold(scenario.key, "scenario_sink_receipts_inconsistent");
    const receiptIdentities = new Set(committed.map((history) => json([history.effectKey, history.scenarioId, history.semanticFingerprint, history.acceptedTimes])));
    if (receiptIdentities.size > 1) addHold(scenario.key, "scenario_committed_receipts_conflict");
  }

  let registry = clone(state.registry);
  // Pass one retains every source/legacy row and all proofs; pass two evaluates
  // first acceptance after later-source coverage is visible. No intermediate
  // proposal is returned as eligible. This is not a durable transaction.
  for (const pass of [0, 1]) for (const [index, record] of records.entries()) {
    const { immutable: d, compatibility: c } = record.ingress;
    const o = d.observation, a = reduction.associations[index]!, scenario = reduction.scenarios.find((s) => s.key === a.scenarioKey);
    const action = reduction.actions.find((entry) => entry.scenarioKey === a.scenarioKey && entry.revisionKey === a.revisionKey);
    const disposition = scenario?.status === "unresolved" ? "conflict" as const
      : scenario?.status !== "accepted" || !action ? "pending" as const
      : a.disposition === "accepted" && action.observationIndex === index ? "initial_acceptance" as const
      : a.disposition === "corroboration" ? "corroboration" as const : "pending" as const;
    const coverage = scenario && !scenarioHolds.has(scenario.key) && c.delivery.status === "verified" ? c.delivery.history
      : { status: "unknown" as const, reason: "adapter_final_scope_or_coverage_held" };
    const candidate: SourceClaimCandidate = {
      subjectSpan: d.subjectSpan, predicateSpan: d.predicateSpan, evidence: d.evidence, interpretation: interpretation(d),
      association: { scenarioId: a.scenarioKey ?? "", revisionId: a.revisionKey ?? "", disposition },
      times: { originalPublishedAt: o.original.publishedAt ?? "", wrapperPublishedAt: o.wrapper?.publishedAt ?? null,
        receivedAt: o.receivedAt, interpretedAt: o.interpretedAt, effectiveAt: o.effectiveAt ?? "",
        validUntil: o.support.status === "supported" ? o.support.validUntil : "" },
      ...(c.alignment ? { alignment: c.alignment } : {}), legacyRefs: c.legacyRefs, effectHistory: coverage,
    };
    const plan = planSourceClaims(registry, { source: d.source, sourceTextVersionId: d.sourceTextVersionId,
      sourceText: d.sourceText, asOf: input.asOf, rule: input.rule, claims: [candidate] });
    if (!plan.accepted) return failed(`planner_rejected:${plan.proposals.flatMap((p) => p.kind === "hold" ? [p.reason] : []).join(",")}`);
    registry = plan.nextRegistry;
    for (const proposal of plan.proposals) if (proposal.kind === "record_evidence") {
      const link = { sourceClaimId: proposal.sourceClaimId, evidenceVersionId: proposal.evidenceVersionId, interpretationVersionId: proposal.interpretationVersionId };
      if (record.links.some((retained) => !same(retained, link))) return failed("retained_derivation_link_mismatch");
      if (!record.links.some((retained) => same(retained, link))) record.links.push(link);
    }
    if (pass === 1) {
      traces[index]!.proposals = [...clone(plan.proposals)];
      if (scenario && (a.disposition === "accepted" || a.disposition === "corroboration" || c.legacyRefs.length))
        for (const proposal of plan.proposals) if (proposal.kind === "hold") addHold(scenario.key, `planner:${proposal.reason}`);
    }
  }
  if (records.some((record) => registry.claims.some((claim) => claim.sourceClaimId === record.id)))
    return failed("observation_id_must_remain_derivation_id");

  const reviewableEffects: TweetClaimAdapterPlan["reviewableEffects"] = [];
  // A later claim can invalidate earlier proposals even across source batches.
  // Only final reducer actions + final registry-wide coverage may expose a reviewable reservation.
  for (const action of reduction.actions) {
    const scenario = reduction.scenarios.find((s) => s.key === action.scenarioKey)!;
    const reasons = scenarioHolds.get(scenario.key) ?? new Set<string>();
    const effect = registry.effects.find((e) => e.scenarioId === scenario.key && e.revisionId === action.revisionKey);
    const claimIds = new Set(registry.associations.filter((a) => a.association.scenarioId === scenario.key).map((a) => a.sourceClaimId));
    for (const binding of registry.legacyBindings.filter((b) => claimIds.has(b.sourceClaimId))) {
      if (!effect || !registry.legacyCoverage.some((c) => c.sourceClaimId === binding.sourceClaimId && c.kind === binding.kind
        && c.key === binding.key && c.payloadFingerprint === binding.payloadFingerprint && c.semanticFingerprint === effect.semanticFingerprint))
        reasons.add("retained_legacy_sink_history_unknown");
      if (!registry.legacyBindings.some((b) => b.sourceClaimId === binding.sourceClaimId && b.kind === binding.kind && b.key === binding.key
        && b.payloadFingerprint === binding.payloadFingerprint && b.basis !== null)) reasons.add("retained_legacy_binding_unverified");
    }
    if (!effect) reasons.add("no_eligible_initial_reservation");
    if (effect && (effect.disputeStatus !== "clear" || registry.scenarioHolds.some((h) => h.scenarioId === scenario.key))) reasons.add("retained_scenario_disputed");
    if (effect && !same(effect.rule, input.rule)) reasons.add("rule_change_requires_effect_policy");
    if (effect && Date.parse(effect.acceptedTimes.validUntil) <= Date.parse(input.asOf)) reasons.add("initial_acceptance_expired");
    if (reasons.size) {
      scenarioHolds.set(scenario.key, reasons);
      for (const trace of traces.filter((trace) => trace.scenarioKey === scenario.key)) trace.adapterHolds.push(...reasons);
    } else if (effect) reviewableEffects.push({ effectKey: effect.effectKey, scenarioKey: scenario.key, transitionId: effect.transitionId, status: effect.status });
  }
  for (const trace of traces) {
    trace.adapterHolds = [...new Set(trace.adapterHolds)];
    const permitted = new Set(reviewableEffects.map((effect) => effect.effectKey));
    trace.proposals = trace.proposals.map((p) => (p.kind === "propose_effect" || p.kind === "reuse_effect") && !permitted.has(p.effectKey)
      ? { kind: "hold", claimIndex: p.claimIndex, sourceClaimId: p.sourceClaimId, reason: "adapter_complete_batch_held" } : p);
  }
  return { accepted: true, noDispatch: true, nextState: { schemaVersion: "tweet-claim-reducer-adapter-v1", registry, derivations: records }, reduction,
    holds: [...new Set(traces.flatMap((trace) => trace.adapterHolds))], trace: traces, reviewableEffects, dispatchInstructions: [] };
}
