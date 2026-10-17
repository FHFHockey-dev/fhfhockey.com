import { createHash } from "node:crypto";

type Immutable<T> = T extends object ? { readonly [Key in keyof T]: Immutable<T[Key]> } : T;

/** Private candidate: consumes bound observations; never parses, persists or dispatches. */
export type TweetSemanticScope = Immutable<
  | { kind: "game"; teamId: number; gameId: number; phase: "entry" | "in_game"; group: string | null }
  | { kind: "session"; teamId: number; date: string; sessionId: string; group: string | null }
  | { kind: "effective_period"; teamId: number; periodId: string; startsAt: string; endsAt: string }>;

export type TweetSemanticFact = Immutable<
  | { kind: "lineup"; situation: "es" | "pp" | "pk"; units: readonly { slot: string; playerIds: readonly number[] }[] }
  | { kind: "starter"; playerId: number }
  | { kind: "availability"; playerId: number; status: "available" | "out" }
  | { kind: "transaction"; playerId: number; action: "ir" | "ltir" | "recall" | "assignment" | "reassignment" }
  | { kind: "observation"; playerId: number; activity: "practice" | "warmup" | "first_off"; present: boolean }>;

export type TweetSemanticObservation = Immutable<{
  /** Immutable, globally namespaced observation ID, not a semantic/action identity. */
  id: string;
  reportId: string;
  sourceKey: string;
  original: { tweetId: string | null; author: string | null; publishedAt: string | null };
  wrapper: { tweetId: string | null; publishedAt: string | null } | null;
  receivedAt: string;
  interpretedAt: string;
  evidence: { start: number; end: number; text: string };
  scope: TweetSemanticScope | null;
  fact: TweetSemanticFact | null;
  effectiveAt: string | null;
  modality: "asserted" | "uncertain" | "projected" | "observation";
  /** Supplied by existing identity/completeness/applicability gates, never source reputation. */
  support: { status: "supported"; basis: string; validUntil: string } | { status: "pending"; reason: string };
  relation: { kind: "correction" | "retraction"; targetObservationIds: readonly string[] } | null;
}>;

export type TweetSemanticAssociation = {
  observationIndex: number;
  scenarioKey: string | null;
  revisionKey: string | null;
  disposition: "pending" | "accepted" | "corroboration" | "conflict" | "stale_conflict" | "replay" | "identity_collision";
  reason: string | null;
};

export type TweetSemanticRevision = {
  key: string;
  fact: TweetSemanticFact | null;
  effectiveAt: string | null;
  observationIndexes: number[];
  /** Same-original relays share a group; groups are not independent confirmation votes. */
  supportedOrigins: { originalTweetId: string; observationIndexes: number[] }[];
};

export type TweetSemanticScenario = {
  key: string;
  scope: TweetSemanticScope;
  status: "pending" | "accepted" | "unresolved" | "expired";
  /** Historical acceptance only. Consult status before treating it as current. */
  firstAcceptance: { revisionKey: string; observationIndex: number } | null;
  revisions: TweetSemanticRevision[];
  heldObservationIndexes: number[];
};

export type TweetSemanticReduction = Immutable<{
  /** Every supplied observation, including retries, uncertainty and rejected interpretations. */
  observations: readonly TweetSemanticObservation[];
  associations: TweetSemanticAssociation[];
  scenarios: TweetSemanticScenario[];
  /** Proposals only. Durable atomic claims and downstream delivery are outside this reducer. */
  actions: { key: string; scenarioKey: string; revisionKey: string; observationIndex: number; kind: "initial_acceptance" }[];
}>;

function timestamp(value: string | null): number | null {
  // Require an explicit zone; the machine's local timezone must never supply missing evidence.
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = value.slice(0, 10), midnight = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

function key(kind: string, value: unknown): string {
  return `tweet-semantic-v1:${kind}:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

const nonblank = (value: string | null): boolean => Boolean(value?.trim());
const canonicalId = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

function boundScope(scope: TweetSemanticScope | null): unknown[] | null {
  if (!scope || !canonicalId(scope.teamId)) return null;
  if (scope.kind === "game") return canonicalId(scope.gameId) && ["entry", "in_game"].includes(scope.phase)
    && (scope.group === null || nonblank(scope.group))
    ? [scope.kind, scope.teamId, scope.gameId, scope.phase, scope.group] : null;
  if (scope.kind === "session") return nonblank(scope.sessionId) && /^\d{4}-\d{2}-\d{2}$/.test(scope.date)
    && Number.isFinite(Date.parse(`${scope.date}T00:00:00Z`))
    && new Date(`${scope.date}T00:00:00Z`).toISOString().slice(0, 10) === scope.date
    && (scope.group === null || nonblank(scope.group))
    ? [scope.kind, scope.teamId, scope.date, scope.sessionId, scope.group] : null;
  const start = timestamp(scope.startsAt), end = timestamp(scope.endsAt);
  return nonblank(scope.periodId) && start !== null && end !== null && start < end
    ? [scope.kind, scope.teamId, scope.periodId, start, end] : null;
}

function factIdentity(fact: TweetSemanticFact | null, scope: TweetSemanticScope): { slot: unknown[]; content: unknown } | null {
  if (!fact) return null;
  if (fact.kind === "lineup") {
    if (scope.kind === "effective_period" || !["es", "pp", "pk"].includes(fact.situation) || !fact.units.length) return null;
    if (new Set(fact.units.map((unit) => unit.slot)).size !== fact.units.length
      || fact.units.some((unit) => !nonblank(unit.slot) || !unit.playerIds.length
        || unit.playerIds.some((id) => !canonicalId(id)) || new Set(unit.playerIds).size !== unit.playerIds.length)) return null;
    // Explicit slots carry line/unit order. Player order within each slot is meaningful.
    const units = [...fact.units].sort((a, b) => a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0)
      .map((unit) => [unit.slot, unit.playerIds]);
    return { slot: [fact.kind, fact.situation], content: units };
  }
  if (!canonicalId(fact.playerId)) return null;
  if (fact.kind === "starter") return scope.kind === "game" ? { slot: [fact.kind], content: fact.playerId } : null;
  if (fact.kind === "transaction") return scope.kind === "effective_period"
    && ["ir", "ltir", "recall", "assignment", "reassignment"].includes(fact.action)
    ? { slot: [fact.kind, fact.playerId], content: fact.action } : null;
  if (fact.kind === "availability") return scope.kind === "game" && ["available", "out"].includes(fact.status)
    ? { slot: [fact.kind, fact.playerId], content: fact.status } : null;
  return scope.kind !== "effective_period" && ["practice", "warmup", "first_off"].includes(fact.activity)
    && typeof fact.present === "boolean"
    ? { slot: [fact.kind, fact.playerId, fact.activity], content: fact.present } : null;
}

function evidenceGate(observation: TweetSemanticObservation, asOf: number): string | null {
  if (!nonblank(observation.id) || !nonblank(observation.reportId) || !nonblank(observation.sourceKey)) return "missing_evidence_identity";
  const span = observation.evidence;
  if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < 0
    || span.end <= span.start || span.end - span.start !== span.text.length) return "invalid_evidence_span";
  if (!nonblank(observation.original.tweetId) || !nonblank(observation.original.author)) return "original_identity_unresolved";
  const published = timestamp(observation.original.publishedAt), received = timestamp(observation.receivedAt);
  const interpreted = timestamp(observation.interpretedAt);
  const wrapper = observation.wrapper ? timestamp(observation.wrapper.publishedAt) : null;
  if (published === null || received === null || interpreted === null
    || (observation.wrapper && (wrapper === null || !nonblank(observation.wrapper.tweetId)))) return "evidence_time_unresolved";
  if (received < published || interpreted < received || (wrapper !== null && (wrapper < published || received < wrapper))) return "inconsistent_source_chronology";
  if (published > asOf || received > asOf || interpreted > asOf || (wrapper !== null && wrapper > asOf)) return "outside_cutoff";
  return null;
}

function supportGate(observation: TweetSemanticObservation): string | null {
  if (observation.support.status !== "supported" || !nonblank(observation.support.basis)) return "support_pending";
  if (observation.modality !== (observation.fact?.kind === "observation" ? "observation" : "asserted")) return "modality_not_actionable";
  const expiry = timestamp(observation.support.validUntil);
  if (expiry === null || expiry <= timestamp(observation.interpretedAt)!) return "validity_unresolved_or_expired_on_admission";
  return null;
}

function attachRevision(scenario: TweetSemanticScenario, observation: TweetSemanticObservation,
  association: TweetSemanticAssociation, content: unknown, effective: number): TweetSemanticRevision {
  const relation = observation.relation ? [observation.relation.kind, [...observation.relation.targetObservationIds].sort()] : null;
  const revisionKey = key("revision", [scenario.key, content, effective, relation]);
  association.revisionKey = revisionKey;
  let revision = scenario.revisions.find((entry) => entry.key === revisionKey);
  if (!revision) {
    revision = { key: revisionKey, fact: observation.fact, effectiveAt: observation.effectiveAt, observationIndexes: [], supportedOrigins: [] };
    scenario.revisions.push(revision);
  }
  revision.observationIndexes.push(association.observationIndex);
  return revision;
}

/**
 * Input order is the retained arrival order, not publication/effective chronology.
 * Existing gates must bind original evidence, canonical identities, exact scope and
 * support before calling. In particular, this does not turn inferred/likely/observed
 * participation into a confirmed starter or availability fact.
 *
 * The original policy does not specify authority for resolving contradictions or
 * compensating prior actions. Changed facts and explicit corrections/retractions
 * therefore stay held, with distinct revisions and historical acceptance retained.
 * A newer timestamp, majority, or duplicate is never a resolution instruction.
 */
export function reduceTweetSemanticEvents(
  observations: readonly TweetSemanticObservation[],
  asOf: string,
): TweetSemanticReduction {
  const cutoff = timestamp(asOf);
  if (cutoff === null) throw new Error("An explicit valid decision cutoff is required.");
  const scenarios = new Map<string, TweetSemanticScenario>();
  const seen = new Map<string, { fingerprint: string; association: TweetSemanticAssociation }>();
  const associations: TweetSemanticAssociation[] = [];

  observations.forEach((observation, observationIndex) => {
    const association: TweetSemanticAssociation = { observationIndex, scenarioKey: null, revisionKey: null, disposition: "pending", reason: null };
    associations.push(association);
    association.reason = evidenceGate(observation, cutoff);
    if (association.reason) return;
    const fingerprint = canonicalJson(observation);
    const previous = seen.get(observation.id);
    if (previous) {
      association.scenarioKey = previous.association.scenarioKey;
      association.revisionKey = previous.association.revisionKey;
      association.disposition = previous.fingerprint === fingerprint ? "replay" : "identity_collision";
      association.reason = previous.fingerprint === fingerprint ? null : "immutable_observation_id_reused";
      if (previous.fingerprint !== fingerprint && association.scenarioKey) {
        const scenario = scenarios.get(association.scenarioKey)!;
        scenario.status = "unresolved";
        scenario.heldObservationIndexes.push(observationIndex);
      }
      return;
    }
    seen.set(observation.id, { fingerprint, association });
    const scope = boundScope(observation.scope);
    if (!scope) { association.reason = "scope_unresolved"; return; }

    const fact = factIdentity(observation.fact, observation.scope!);
    // A retraction without a replacement fact can only name an already bound target.
    const targets = observation.relation?.targetObservationIds.map((id) => seen.get(id)?.association) ?? [];
    const targetKeys = new Set(targets.map((target) => target?.scenarioKey));
    const target = targets.length && targetKeys.size === 1 && targets.every(Boolean)
      ? scenarios.get(targets[0]!.scenarioKey ?? "") : undefined;
    const scenarioKey = fact ? key("scenario", [scope, fact.slot])
      : observation.relation?.kind === "retraction" && target && canonicalJson(boundScope(target.scope)) === canonicalJson(scope) ? target.key : null;
    if (!scenarioKey) { association.reason = "fact_or_retraction_target_unresolved"; return; }
    association.scenarioKey = scenarioKey;
    let scenario = scenarios.get(scenarioKey);
    if (!scenario) {
      scenario = { key: scenarioKey, scope: observation.scope!, status: "pending", firstAcceptance: null, revisions: [], heldObservationIndexes: [] };
      scenarios.set(scenarioKey, scenario);
    }
    const effective = timestamp(observation.effectiveAt);
    if (effective === null || (observation.scope!.kind === "effective_period"
      && (effective < timestamp(observation.scope!.startsAt)! || effective >= timestamp(observation.scope!.endsAt)!))) {
      association.reason = "effective_time_unresolved_or_outside_period";
      return;
    }
    const revision = attachRevision(scenario, observation, association, fact?.content ?? null, effective);
    const revisionKey = revision.key;
    association.reason = supportGate(observation);
    if (association.reason) return;
    if (observation.relation) {
      association.reason = observation.relation.kind === "retraction" ? "retraction_authority_required" : "correction_authority_required";
      scenario.status = "unresolved";
      scenario.heldObservationIndexes.push(observationIndex);
      return;
    }
    const originalId = observation.original.tweetId!;
    let origin = revision.supportedOrigins.find((entry) => entry.originalTweetId === originalId);
    if (!origin) { origin = { originalTweetId: originalId, observationIndexes: [] }; revision.supportedOrigins.push(origin); }
    origin.observationIndexes.push(observationIndex);

    if (!scenario.firstAcceptance && scenario.status !== "unresolved") {
      scenario.firstAcceptance = { revisionKey, observationIndex };
      scenario.status = "accepted";
      association.disposition = "accepted";
    } else if (scenario.firstAcceptance?.revisionKey === revisionKey) {
      association.disposition = "corroboration";
    } else {
      const first = scenario.firstAcceptance ? observations[scenario.firstAcceptance.observationIndex]! : null;
      const older = first && (effective < timestamp(first.effectiveAt)!
        || timestamp(observation.original.publishedAt)! < timestamp(first.original.publishedAt)!);
      association.disposition = older ? "stale_conflict" : "conflict";
      association.reason = "revision_resolution_required";
      scenario.status = "unresolved";
      scenario.heldObservationIndexes.push(observationIndex);
    }
  });

  // A retraction can arrive before the report it names. Resolve only its binding,
  // never its authority, after all cutoff-eligible observations have been retained.
  for (const association of associations) {
    const observation = observations[association.observationIndex]!;
    if (observation.relation?.kind !== "retraction" || association.reason !== "fact_or_retraction_target_unresolved") continue;
    const targets = observation.relation.targetObservationIds.map((id) => seen.get(id)?.association);
    const scenarioKeys = new Set(targets.map((target) => target?.scenarioKey));
    const targetKey = targets[0]?.scenarioKey;
    const scenario = targetKey && scenarioKeys.size === 1 ? scenarios.get(targetKey) : undefined;
    if (!scenario || !targets.length || canonicalJson(boundScope(scenario.scope)) !== canonicalJson(boundScope(observation.scope))) continue;
    association.scenarioKey = scenario.key;
    const effective = timestamp(observation.effectiveAt);
    if (effective === null || (scenario.scope.kind === "effective_period"
      && (effective < timestamp(scenario.scope.startsAt)! || effective >= timestamp(scenario.scope.endsAt)!))) {
      association.reason = "effective_time_unresolved_or_outside_period";
      continue;
    }
    attachRevision(scenario, observation, association, null, effective);
    association.reason = supportGate(observation) ?? "retraction_authority_required";
    if (association.reason !== "retraction_authority_required") continue;
    scenario.status = "unresolved";
    scenario.heldObservationIndexes.push(association.observationIndex);
  }

  const actions: Array<TweetSemanticReduction["actions"][number]> = [];
  for (const scenario of scenarios.values()) {
    if (scenario.status !== "accepted" || !scenario.firstAcceptance) continue;
    const accepted = observations[scenario.firstAcceptance.observationIndex]!;
    // Corroboration cannot refresh the first acceptance's validity or source times.
    if (accepted.support.status !== "supported" || timestamp(accepted.support.validUntil)! <= cutoff) {
      scenario.status = "expired";
      continue;
    }
    actions.push({ key: key("action", [scenario.key, scenario.firstAcceptance.revisionKey]), scenarioKey: scenario.key,
      revisionKey: scenario.firstAcceptance.revisionKey, observationIndex: scenario.firstAcceptance.observationIndex, kind: "initial_acceptance" });
  }
  return { observations: [...observations], associations, scenarios: [...scenarios.values()], actions };
}
