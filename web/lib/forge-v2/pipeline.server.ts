import { ArtifactReference, CATEGORIES, CategoryMeans, Component, HistoryEvent, HorizonEpisode, LockEpoch, Opportunity, PublishedVintage, ScoringProfile, Vintage, assertArtifact, assertHorizon, assertId, assertSource, assertTarget, assertVintage, available, instant, unavailable } from "./contracts";
import { FileArtifactStore } from "./artifacts.server";
import type { SourceBatchResult } from "./data";
import type { PostgresHistoryStore } from "./history.server";
import { contentHash } from "./hash.server";
import { scoringProfile, targetKey } from "./identity";
import { CandidateModel, ModelContext, modelAvailableAtCutoff, predictConditional } from "./model";
import { AppearanceModel, predictParticipation } from "./participation";
import { CalibrationArtifact, INTERVAL_CALCULATION, JOINT_DECODER, JOINT_SCHEMA, PinnedArtifact, predictJoint } from "./uncertainty";
import { RefreshBounds, RefreshJob, RefreshPlan, RefreshResult, claimRefreshBatch, finishRefresh, reconcileRefreshScopes, restoreRefreshState } from "./refresh";
import { observeHorizonEpisodes } from "./schedule";

export type PreparedHistoryStore = Pick<PostgresHistoryStore, "reserveSequence" | "getDraft" | "publish" | "publishClaimed" | "appendRecord" | "loadQueue" | "saveQueue">;
export interface PreparedLedgerObservation<T> { value: T; predecessor: T | null }
export interface PreparedLedgerInput {
  store: Pick<PreparedHistoryStore, "appendRecord">;
  opportunities: PreparedLedgerObservation<Opportunity>[];
  episodes: PreparedLedgerObservation<HorizonEpisode>[];
  locks: PreparedLedgerObservation<LockEpoch>[];
  events: PreparedLedgerObservation<HistoryEvent>[];
}
type LedgerKind = "opportunity" | "horizon_episode" | "lock_epoch" | "history_event";
type LedgerValue = Opportunity | HorizonEpisode | LockEpoch | HistoryEvent;
export function preparedLedgerRecordId(kind: LedgerKind, value: LedgerValue): string { return `ledger:${kind}:${contentHash(value)}`; }

/** Full snapshots are explicit. A predecessor must already be captured or included earlier in this call.
 * Scientific entity IDs stay inside payloads; observation IDs identify immutable snapshot bytes. */
function preparedLedgerRecords(input: Omit<PreparedLedgerInput, "store">) {
  const groups: Array<[LedgerKind, PreparedLedgerObservation<LedgerValue>[]]> = [["opportunity", input.opportunities], ["horizon_episode", input.episodes], ["lock_epoch", input.locks], ["history_event", input.events]];
  if (groups.reduce((sum, [, rows]) => sum + rows.length, 0) > 200) throw new Error("prepared_ledger_capture_limit");
  const records: Array<{ id: string; kind: LedgerKind; scientificId: string; predecessorId: string | null; scopeKey: string; value: LedgerValue }> = [];
  for (const [kind, observations] of groups) for (const { value, predecessor } of observations) {
    if (!value.id?.trim() || predecessor && !predecessor.id?.trim()) throw new Error("missing_ledger_scientific_identity");
    let scopeKey: string;
    if (kind === "lock_epoch") {
      const lock = value as LockEpoch, prior = predecessor as LockEpoch | null;
      assertId(lock.gameId); instant(lock.adoptedAt); instant(lock.lockAt);
      if (!lock.scheduleRevision || typeof lock.playBegun !== "boolean" || prior && (lock.id === prior.id || lock.gameId !== prior.gameId || lock.predecessorId !== prior.id || instant(lock.adoptedAt) < instant(prior.adoptedAt) || prior.playBegun && !lock.playBegun || prior.actualStartAt !== null && lock.actualStartAt === null)
        || !prior && lock.predecessorId !== null) throw new Error("invalid_ledger_lock_predecessor");
      if (lock.actualStartAt !== null) instant(lock.actualStartAt);
      scopeKey = String(lock.gameId);
    } else {
      assertTarget(value as Opportunity | HorizonEpisode | HistoryEvent);
      if (predecessor) { assertTarget(predecessor as Opportunity | HorizonEpisode | HistoryEvent); if (targetKey(value as Opportunity) !== targetKey(predecessor as Opportunity)) throw new Error("ledger_predecessor_target_mismatch"); }
      scopeKey = targetKey(value as Opportunity);
      if (kind === "horizon_episode") {
        const episode = value as HorizonEpisode, prior = predecessor as HorizonEpisode | null;
        assertHorizon(episode.horizon); instant(episode.enteredAt);
        if (!Number.isInteger(episode.episode) || episode.episode < 1 || !episode.scheduleRevision || !episode.affiliationRevision || episode.exitedAt !== null && instant(episode.exitedAt) < instant(episode.enteredAt)) throw new Error("invalid_ledger_episode");
        if (prior) {
          if (prior.horizon !== episode.horizon) throw new Error("ledger_predecessor_horizon_mismatch");
          if (prior.id === episode.id) {
            if (prior.exitedAt !== null || episode.exitedAt === null || contentHash({ ...episode, exitedAt: null }) !== contentHash(prior)) throw new Error("episode_closure_changes_entry");
          } else if (episode.episode !== prior.episode + 1 || prior.exitedAt === null || instant(prior.exitedAt) > instant(episode.enteredAt)) throw new Error("invalid_episode_reentry_predecessor");
        } else if (episode.exitedAt !== null || episode.episode !== 1) throw new Error("episode_observation_requires_predecessor");
      } else if (kind === "opportunity") {
        const opportunity = value as Opportunity, prior = predecessor as Opportunity | null;
        assertHorizon(opportunity.horizon); assertId(opportunity.teamId); assertId(opportunity.opponentId); instant(opportunity.scheduledStartAt); instant(opportunity.observedAt);
        if (opportunity.teamId === opportunity.opponentId || !opportunity.scheduleRevision || !opportunity.affiliationRevision || prior && instant(opportunity.observedAt) <= instant(prior.observedAt)) throw new Error("invalid_ledger_opportunity_observation");
      } else {
        const event = value as HistoryEvent, prior = predecessor as HistoryEvent | null;
        instant(event.at);
        if (!event.reason.trim() || !["failed_attempt", "unavailable", "missing_refresh", "retraction", "technical_correction", "team_change"].includes(event.kind)
          || prior && (event.id === prior.id || event.predecessorId !== prior.id || instant(event.at) < instant(prior.at)) || !prior && event.predecessorId !== null) throw new Error("invalid_ledger_event_predecessor");
      }
    }
    const id = preparedLedgerRecordId(kind, value), predecessorId = predecessor ? preparedLedgerRecordId(kind, predecessor) : null;
    if (id === predecessorId) throw new Error("ledger_snapshot_cannot_precede_itself");
    records.push({ id, kind, scientificId: value.id, predecessorId, scopeKey, value });
  }
  return records;
}

export async function capturePreparedLedger(input: PreparedLedgerInput): Promise<Array<{ id: string; kind: LedgerKind; scientificId: string; predecessorId: string | null }>> {
  const records = preparedLedgerRecords(input);
  // Validate the whole bounded capture before the first write. Append-only writes are safely retryable.
  for (const record of records) await input.store.appendRecord(record.id, record.kind, record.scopeKey, record.value, record.predecessorId);
  return records.map(({ id, kind, scientificId, predecessorId }) => ({ id, kind, scientificId, predecessorId }));
}

export interface PreparedScopeReconciliation {
  store: PreparedHistoryStore; queueId: string; bounds: RefreshBounds; acceptedAt: string;
  /** Complete prior/current populations for affected targets only. Prior links remain explicit. */
  previous: PreparedLedgerObservation<Opportunity>[];
  current: Opportunity[];
  /** Latest state of each scientific episode; complete history for the affected targets. */
  episodes: HorizonEpisode[];
  locks: PreparedLedgerObservation<LockEpoch>[];
}

/** Fence obsolete claims atomically before appending accepted scope/episode observations.
 * On a capture failure, retry the same explicit transition; its plans and ledger bytes are idempotent. */
export async function reconcilePreparedQueueScopes(input: PreparedScopeReconciliation) {
  if (!input.queueId.trim() || input.episodes.length > 200 || input.locks.length > 200 || new Set(input.episodes.map(row => row.id)).size !== input.episodes.length) throw new Error("invalid_prepared_reconciliation_bounds");
  const snapshot = await input.store.loadQueue(input.queueId);
  if (!snapshot) return { state: "queue_missing" as const };
  const previous = input.previous.map(observation => observation.value), affected = new Set([...previous, ...input.current].map(targetKey));
  const lockTimes = Object.fromEntries(input.locks.map(({ value }) => [value.gameId, value.lockAt]));
  const proposal = reconcileRefreshScopes(restoreRefreshState(snapshot.state, input.bounds), { previous, current: input.current, acceptedAt: input.acceptedAt }, input.bounds, lockTimes);
  const scoped = observeHorizonEpisodes(input.episodes.filter(row => affected.has(targetKey(row))), input.current, input.acceptedAt);
  const episodes = [...input.episodes.filter(row => !affected.has(targetKey(row))), ...scoped];
  const opportunityObservations = input.current.map(value => {
    const prior = input.previous.find(row => targetKey(row.value) === targetKey(value));
    return prior && contentHash(prior.value) === contentHash(value) ? prior : { value, predecessor: prior?.value ?? null };
  });
  const episodeObservations: PreparedLedgerObservation<HorizonEpisode>[] = [];
  for (const episode of [...scoped].sort((a, b) => instant(a.enteredAt) - instant(b.enteredAt) || a.episode - b.episode || a.id.localeCompare(b.id))) {
    const entry = episode.exitedAt === null ? episode : { ...episode, exitedAt: null };
    const prior = scoped.find(row => targetKey(row) === targetKey(episode) && row.horizon === episode.horizon && row.episode === episode.episode - 1) ?? null;
    episodeObservations.push({ value: entry, predecessor: prior });
    if (episode.exitedAt !== null) episodeObservations.push({ value: episode, predecessor: entry });
  }
  const capture: PreparedLedgerInput = { store: input.store, opportunities: [...input.previous, ...opportunityObservations], episodes: episodeObservations, locks: input.locks, events: proposal.events.map(value => ({ value, predecessor: null })) };
  preparedLedgerRecords(capture); // No invalid ledger proposal may close valid work.
  let revision: number;
  try { revision = await input.store.saveQueue(input.queueId, snapshot.revision, proposal.state); }
  catch (error) { if (revisionConflict(error)) return { state: "revision_conflict" as const }; throw error; }
  const observations = await capturePreparedLedger(capture);
  return { state: "captured" as const, revision, plans: proposal.plans, closed: proposal.closed, opened: proposal.opened, events: proposal.events, opportunities: opportunityObservations, episodes, episodeObservations, observations };
}
export interface PreparedFeatures { features: ModelContext["features"] }
export interface PreparedIssuance {
  accepted: SourceBatchResult<PreparedFeatures>;
  context: ModelContext;
  episode: HorizonEpisode;
  lock: LockEpoch;
  model: CandidateModel | null;
  participationModel: AppearanceModel | null;
  calibration: PinnedArtifact<CalibrationArtifact> | null;
  scoring: ScoringProfile;
  featureVersion: string;
  codeVersion: string;
  cohort: string;
  evidenceClass: "fixture" | "retrospective_reconstruction";
  predecessorId: string | null;
  /** Required for linked reentry/closed episode and replacement lock observations. */
  episodePredecessor?: HorizonEpisode;
  lockPredecessor?: LockEpoch;
  opportunityPredecessor?: Opportunity;
}
export interface QueueClaim { queueId: string; job: RefreshJob; bounds: RefreshBounds }
export interface PreparedRunInput {
  store: PreparedHistoryStore;
  artifacts: Pick<FileArtifactStore, "put">;
  plan: RefreshPlan;
  prepared: PreparedIssuance | null;
  /** Explicit execution clock; no implicit scheduler or network discovery. */
  clock: () => string;
  claim?: QueueClaim;
}
export type PreparedRunResult = { state: "published"; publication: PublishedVintage; reusedDraft: boolean }
  | { state: "unavailable"; reason: string; retryable: boolean };

function validPlan(plan: RefreshPlan): void {
  assertTarget(plan.scope); assertHorizon(plan.scope.horizon);
  assertId(plan.scope.teamId); assertId(plan.scope.opponentId);
  if (plan.scope.teamId === plan.scope.opponentId || typeof plan.scope.home !== "boolean") throw new Error("invalid_prepared_game_sides");
  if (!plan.issuanceKey.trim() || !plan.scope.id || !plan.scope.scheduleRevision || !plan.scope.affiliationRevision || !["daily", "pregame", "material"].includes(plan.trigger)) throw new Error("invalid_prepared_plan");
  instant(plan.scope.observedAt); instant(plan.readyAt);
  if (instant(plan.deadlineAt) > instant(plan.lockAt) || instant(plan.lockAt) > instant(plan.scope.scheduledStartAt)) throw new Error("invalid_prepared_plan_lock");
}

function sameIssuedScope(vintage: Vintage, plan: RefreshPlan): boolean {
  return vintage.issuanceKey === plan.issuanceKey && targetKey(vintage) === targetKey(plan.scope) && vintage.trigger === plan.trigger
    && ["teamId", "opponentId", "home", "horizon", "scheduleRevision", "affiliationRevision", "scheduledStartAt", "sourceGameDate"].every(key => vintage[key as keyof Vintage] === plan.scope[key as keyof typeof plan.scope]);
}

async function assertClaim(input: PreparedRunInput): Promise<void> {
  if (!input.claim) return;
  const { queueId, job, bounds } = input.claim;
  const current = await input.store.loadQueue(queueId);
  if (!current) throw new Error("stale_refresh_claim");
  const live = restoreRefreshState(current.state, bounds).jobs.find(row => row.id === job.id);
  if (!live || live.status !== "running" || live.attempts !== job.attempts || live.startedAt !== job.startedAt || live.leaseUntil !== job.leaseUntil || instant(live.leaseUntil!) <= instant(input.clock())
    || live.issuanceKey !== input.plan.issuanceKey || contentHash(live.scope) !== contentHash(input.plan.scope) || contentHash(job.scope) !== contentHash(live.scope)) throw new Error("stale_refresh_claim");
}

function validatePrepared(plan: RefreshPlan, prepared: PreparedIssuance): void {
  const { context, episode, lock, accepted } = prepared, scope = plan.scope;
  if (!["fixture", "retrospective_reconstruction"].includes(prepared.evidenceClass)) throw new Error("development_pipeline_cannot_issue_prospective_or_public_evidence");
  assertTarget(context); assertTarget(episode);
  const cutoff = instant(context.inputCutoffAt);
  if (targetKey(context) !== targetKey(scope) || targetKey(episode) !== targetKey(scope) || episode.horizon !== scope.horizon || !episode.id || !lock.id || lock.gameId !== scope.gameId
    // Episode entry and lock adoption revisions are historical lineage, not current-context versions.
    || !episode.scheduleRevision || !episode.affiliationRevision || !lock.scheduleRevision
    || instant(scope.observedAt) > cutoff || instant(episode.enteredAt) > cutoff || episode.exitedAt !== null && cutoff >= instant(episode.exitedAt)
    || instant(lock.adoptedAt) > cutoff || lock.playBegun || lock.actualStartAt !== null || lock.lockAt !== plan.lockAt || cutoff >= instant(lock.lockAt)) throw new Error("prepared_identity_episode_or_lock_mismatch");
  if (![prepared.featureVersion, prepared.codeVersion, prepared.cohort].every(value => typeof value === "string" && value.trim())) throw new Error("missing_prepared_versions");
  if (scoringProfile(prepared.scoring.weights).id !== prepared.scoring.id || prepared.scoring.ruleVersion !== "linear-seven-v1") throw new Error("invalid_prepared_scoring");
  if (accepted.state !== "available" || !accepted.records.length || !accepted.approvalEvidenceIds.length || contentHash(accepted.records) !== accepted.manifestHash) throw new Error("accepted_sources_unavailable");
  const features: ModelContext["features"] = {};
  for (const record of accepted.records) {
    const identity = record.identity;
    if (!identity.verified || identity.playerId !== scope.playerId || identity.gameId !== scope.gameId || identity.seasonId !== scope.seasonId || identity.teamId !== scope.teamId || !identity.mappingRevision || contentHash(record.payload) !== record.source.sha256) throw new Error("accepted_source_identity_or_hash_mismatch");
    assertSource(record.source, context.inputCutoffAt);
    for (const [key, value] of Object.entries(record.payload.features)) {
      if (Object.hasOwn(features, key) && contentHash(features[key]) !== contentHash(value)) throw new Error("conflicting_prepared_features");
      features[key] = value;
    }
  }
  if (contentHash(features) !== contentHash(context.features) || contentHash(accepted.records.map(row => row.source)) !== contentHash(context.sources)) throw new Error("prepared_context_not_bound_to_accepted_sources");
}

function calibrationReference(prepared: PreparedIssuance, plan: RefreshPlan): Component<ArtifactReference> {
  const artifact = prepared.calibration;
  if (!artifact) return unavailable("not_calibrated");
  try {
    assertArtifact(artifact.reference);
    const ref = artifact.reference, payload = artifact.payload;
    if (ref.kind !== "calibration" || contentHash(payload) !== ref.sha256 || ref.schemaVersion !== "profile-tail-padding-v1" || ref.decoderVersion !== JOINT_DECODER || ref.calculationVersion !== INTERVAL_CALCULATION
      || payload.schemaVersion !== ref.schemaVersion || payload.calculationVersion !== INTERVAL_CALCULATION || !modelAvailableAtCutoff(payload, prepared.context.inputCutoffAt)
      || payload.modelVersion !== prepared.model?.version || payload.profileId !== prepared.scoring.id || payload.horizon !== plan.scope.horizon || payload.cohort !== prepared.cohort
      || !payload.protocolId || !payload.sampleIds.length || payload.padding.length !== 2 || ([0.5, 0.9] as const).some(level => payload.padding.filter(p => p.level === level).length !== 1)
      || payload.padding.some(p => !Number.isFinite(p.lower) || !Number.isFinite(p.upper) || p.lower < 0 || p.upper < 0)
      || !ref.horizons.includes(plan.scope.horizon) || !ref.cohorts.includes(prepared.cohort) || !ref.profileIds.includes(prepared.scoring.id)
      || CATEGORIES.some(c => prepared.scoring.weights[c] !== 0 && !ref.categories.includes(c))) return unavailable("calibration_incompatible_with_prepared_issuance");
    return available(ref);
  } catch { return unavailable("invalid_prepared_calibration"); }
}

async function publishDraft(input: PreparedRunInput, draft: Vintage, reusedDraft: boolean): Promise<PreparedRunResult> {
  await assertClaim(input);
  const publication = input.claim ? await input.store.publishClaimed(draft, { queueId: input.claim.queueId, jobId: input.claim.job.id, attempt: input.claim.job.attempts }) : await input.store.publish(draft);
  assertVintage(publication.vintage);
  if (contentHash(publication.vintage) !== contentHash(draft) || publication.receipt.vintageId !== draft.id || publication.receipt.outputHash !== contentHash(draft) || publication.receipt.witness !== "committed_readback"
    || publication.receipt.evidenceClass !== draft.evidenceClass || instant(publication.receipt.confirmedAt) < instant(draft.generatedAt)) throw new Error("publication_readback_mismatch");
  return { state: "published", publication, reusedDraft };
}

/** Local prepared-input issuance. No provider acquisition, fitting, qualification or activation occurs here. */
export async function runPreparedIssuance(input: PreparedRunInput): Promise<PreparedRunResult> {
  validPlan(input.plan);
  await assertClaim(input);
  const existing = await input.store.getDraft(input.plan.issuanceKey);
  if (existing) {
    if (existing.issuanceAttempt && !input.claim) throw new Error("queued_draft_requires_current_claim");
    if (!sameIssuedScope(existing, input.plan) || !["fixture", "retrospective_reconstruction"].includes(existing.evidenceClass)) throw new Error("stored_draft_scope_or_authority_mismatch");
    return publishDraft(input, existing, true);
  }
  // This population observation survives rejected/missing models and source gaps.
  await capturePreparedLedger({ store: input.store, opportunities: [{ value: input.plan.scope, predecessor: input.prepared?.opportunityPredecessor ?? null }], episodes: [], locks: [], events: [] });
  if (!input.prepared) return { state: "unavailable", reason: "prepared_inputs_missing", retryable: false };
  const prepared = structuredClone(input.prepared);
  try { validatePrepared(input.plan, prepared); } catch (error) { return { state: "unavailable", reason: error instanceof Error ? error.message : "invalid_prepared_inputs", retryable: false }; }
  if (instant(input.clock()) < instant(prepared.context.inputCutoffAt) || instant(input.clock()) >= instant(input.plan.lockAt)) return { state: "unavailable", reason: "issuance_clock_outside_cutoff_or_lock", retryable: false };
  await assertClaim(input);
  await capturePreparedLedger({ store: input.store, opportunities: [], episodes: [{ value: prepared.episode, predecessor: prepared.episodePredecessor ?? null }], locks: [{ value: prepared.lock, predecessor: prepared.lockPredecessor ?? null }], events: [] });
  let means: CategoryMeans, limitations: string[];
  try {
    const prediction = prepared.model ? predictConditional(prepared.model, prepared.context) : { means: Object.fromEntries(CATEGORIES.map(c => [c, unavailable("conditional_model_unavailable")])) as CategoryMeans, limitations: prepared.context.limitations };
    means = prediction.means; limitations = [...prediction.limitations, "private_development_unqualified"];
  } catch { return { state: "unavailable", reason: "conditional_model_generation_failed", retryable: false }; }
  const participation = predictParticipation(prepared.participationModel, prepared.context);
  let distribution: Component<ArtifactReference> = unavailable("joint_model_unavailable");
  if (prepared.model) {
    const categories = CATEGORIES.filter(c => means[c].state === "available");
    const joint = predictJoint(prepared.model, prepared.context, categories);
    distribution = joint.state === "unavailable" ? joint : unavailable("joint_mean_mismatch");
    if (joint.state === "available" && categories.every(c => means[c].state === "available" && Math.abs((means[c] as { value: number }).value - joint.value.outcomes.reduce((sum, row) => sum + row.probability * row.values[c]!, 0)) <= 1e-10)) {
      const sha256 = contentHash(joint.value);
      const reference: ArtifactReference = { id: `joint:${contentHash(input.plan.issuanceKey)}:${sha256}`, version: "v1", sha256, kind: "joint_distribution", schemaVersion: JOINT_SCHEMA, decoderVersion: JOINT_DECODER, calculationVersion: INTERVAL_CALCULATION, categories, horizons: [input.plan.scope.horizon], cohorts: [prepared.cohort], profileIds: [prepared.scoring.id], targetVersion: input.plan.scope.targetVersion, conditioning: input.plan.scope.conditioning };
      await assertClaim(input); await input.artifacts.put(reference, joint.value);
      distribution = available(reference);
    }
  }
  const calibration = calibrationReference(prepared, input.plan);
  if (calibration.state === "available") { await assertClaim(input); await input.artifacts.put(calibration.value, prepared.calibration!.payload); }
  await assertClaim(input);
  const sequence = await input.store.reserveSequence(), generatedAt = input.clock();
  if (instant(generatedAt) >= instant(input.plan.lockAt)) return { state: "unavailable", reason: "generation_crossed_lock", retryable: false };
  const scope = input.plan.scope;
  const draft: Vintage = {
    playerId: scope.playerId, gameId: scope.gameId, seasonId: scope.seasonId, targetVersion: scope.targetVersion, conditioning: scope.conditioning,
    id: `vintage:${contentHash(input.plan.issuanceKey)}`, issuanceKey: input.plan.issuanceKey, sequence,
    teamId: scope.teamId, opponentId: scope.opponentId, home: scope.home, horizon: scope.horizon, episodeId: prepared.episode.id, lockEpochId: prepared.lock.id,
    scheduleRevision: scope.scheduleRevision, affiliationRevision: scope.affiliationRevision, sourceGameDate: scope.sourceGameDate, scheduledStartAt: scope.scheduledStartAt,
    inputCutoffAt: prepared.context.inputCutoffAt, generatedAt, means, participation, distribution, calibration, scoring: prepared.scoring,
    modelVersion: prepared.model?.version ?? "unavailable-model-v1", featureVersion: prepared.featureVersion, codeVersion: prepared.codeVersion, cohort: prepared.cohort,
    qualificationId: null, sourceManifest: prepared.context.sources, trigger: input.plan.trigger, predecessorId: prepared.predecessorId, evidenceClass: prepared.evidenceClass, limitations,
    ...(input.claim ? { issuanceAttempt: { queueId: input.claim.queueId, jobId: input.claim.job.id, attempt: input.claim.job.attempts, startedAt: input.claim.job.startedAt! } } : {}),
  };
  assertVintage(draft);
  return publishDraft(input, draft, false);
}

export interface PreparedBatchInput {
  queueId: string; store: PreparedHistoryStore; artifacts: Pick<FileArtifactStore, "put">;
  prepared: ReadonlyMap<string, PreparedIssuance>; bounds: RefreshBounds; clock: () => string; maximumMergeAttempts?: number;
}
export interface PreparedBatchResult {
  state: "completed" | "claim_conflict" | "queue_missing";
  jobs: Array<{ jobId: string; attempt: number; result: PreparedRunResult | { state: "failed"; reason: string }; acknowledgement: "saved" | "stale_claim" | "revision_conflict" }>;
}
const revisionConflict = (error: unknown) => error instanceof Error && error.message === "Queue revision conflict";

/** One bounded batch; claim CAS precedes all work, and acknowledgements merge only their current attempt. */
export async function runPreparedQueueBatch(input: PreparedBatchInput): Promise<PreparedBatchResult> {
  const mergeLimit = input.maximumMergeAttempts ?? 3;
  if (!input.queueId.trim() || !Number.isInteger(mergeLimit) || mergeLimit < 1 || mergeLimit > 5) throw new Error("invalid_prepared_batch_bounds");
  const snapshot = await input.store.loadQueue(input.queueId);
  if (!snapshot) return { state: "queue_missing", jobs: [] };
  const claimed = claimRefreshBatch(restoreRefreshState(snapshot.state, input.bounds), input.clock(), input.bounds);
  try { await input.store.saveQueue(input.queueId, snapshot.revision, claimed.state); }
  catch (error) { if (revisionConflict(error)) return { state: "claim_conflict", jobs: [] }; throw error; }
  const results: PreparedBatchResult["jobs"] = [];
  for (const job of claimed.jobs) {
    const runInput: PreparedRunInput = { store: input.store, artifacts: input.artifacts, plan: job, prepared: input.prepared.get(job.issuanceKey) ?? null, clock: input.clock, claim: { queueId: input.queueId, job, bounds: input.bounds } };
    let result: PreparedBatchResult["jobs"][number]["result"];
    try { result = await runPreparedIssuance(runInput); }
    catch (error) { result = { state: "failed", reason: error instanceof Error ? error.message : "prepared_issuance_failed" }; }
    let acknowledgement: PreparedBatchResult["jobs"][number]["acknowledgement"] = "revision_conflict";
    for (let merge = 0; merge < mergeLimit; merge++) {
      const current = await input.store.loadQueue(input.queueId);
      const now = input.clock();
      const state = current && restoreRefreshState(current.state, input.bounds), live = state?.jobs.find(row => row.id === job.id);
      if (!current || !state || !live || live.status !== "running" || live.attempts !== job.attempts || live.startedAt !== job.startedAt || live.leaseUntil !== job.leaseUntil || instant(live.leaseUntil!) <= instant(now)
        || live.issuanceKey !== job.issuanceKey || live.lockAt !== job.lockAt || live.trigger !== job.trigger || contentHash(live.scope) !== contentHash(job.scope)) { acknowledgement = "stale_claim"; break; }
      let completion: RefreshResult;
      if (result.state === "published") {
        const publication = result.publication;
        completion = { state: "published", vintageId: publication.vintage.id, confirmedAt: publication.receipt.confirmedAt,
          ...(instant(publication.receipt.confirmedAt) < instant(job.startedAt!) ? { recoveredPublication: publication } : {}) };
      } else completion = { state: result.state, reason: result.reason, retryable: result.state === "unavailable" ? result.retryable : true };
      const merged = finishRefresh(state, job.id, job.attempts, completion, now, input.bounds, input.queueId);
      try { await input.store.saveQueue(input.queueId, current.revision, merged); acknowledgement = "saved"; break; }
      catch (error) { if (!revisionConflict(error)) throw error; }
    }
    results.push({ jobId: job.id, attempt: job.attempts, result, acknowledgement });
  }
  return { state: "completed", jobs: results };
}
