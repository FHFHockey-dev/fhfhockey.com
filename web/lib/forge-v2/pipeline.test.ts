// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CATEGORIES, CategoryMeans, HistoryEvent, PublishedVintage, Vintage, assertVintage, available } from "./contracts";
import { FileArtifactStore } from "./artifacts.server";
import { normalizeSourceBatch } from "./data";
import { FIXTURE_CLOCK, FIXTURE_TARGET, fixtureAffiliation, fixtureOpportunity, fixtureSchedule, fixtureSource } from "./fixtures";
import { contentHash } from "./hash.server";
import { DEFAULT_SCORING } from "./identity";
import { CandidateModel, ModelExample, predictConditional } from "./model";
import { PreparedHistoryStore, PreparedIssuance, capturePreparedLedger, preparedLedgerRecordId, reconcilePreparedQueueScopes, runPreparedIssuance, runPreparedQueueBatch } from "./pipeline.server";
import { CalibrationArtifact, INTERVAL_CALCULATION, JOINT_DECODER } from "./uncertainty";
import { RefreshBounds, RefreshState, claimRefreshBatch, createRefreshState, enqueueMaterialEvent, enqueueRefresh, planScheduledRefresh, restoreRefreshState } from "./refresh";
import { advanceLock, buildOpportunities, observeHorizonEpisodes } from "./schedule";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const bounds: RefreshBounds = { maximumJobs: 10, maximumEvents: 10, concurrency: 1, batchSize: 1, maximumAttempts: 3, retryDelayMs: 1000, leaseMs: 60000 };
const later = (at: string, ms: number) => new Date(Date.parse(at) + ms).toISOString();
const scope = fixtureOpportunity();
const plan = planScheduledRefresh([scope], FIXTURE_CLOCK)[0];

/** Explicit durable-store double: copies all writes/reads, enforces revision CAS and claim fences.
 * Real PostgreSQL transaction semantics are verified separately by the store owner. */
class DurableStore implements PreparedHistoryStore {
  sequence = 0;
  records = new Map<string, { kind: string; scopeKey: string; payload: object; predecessorId: string | null }>();
  drafts = new Map<string, Vintage>();
  publications = new Map<string, PublishedVintage>();
  queues = new Map<string, { revision: number; state: object }>();
  lostAcknowledgement = false;
  onSave: ((expectedRevision: number, state: object) => void) | null = null;
  afterSave: (() => void) | null = null;
  beforePublish: (() => void) | null = null;
  beforeAppend: (() => void) | null = null;
  constructor(readonly clock: () => string) {}
  async reserveSequence() { return ++this.sequence; }
  async getDraft(key: string) { return structuredClone(this.drafts.get(key) ?? null); }
  async appendRecord(id: string, kind: Parameters<PreparedHistoryStore["appendRecord"]>[1], scopeKey: string, payload: object, predecessorId: string | null = null) {
    this.beforeAppend?.();
    const next = { kind, scopeKey, payload, predecessorId }, prior = this.records.get(id);
    if (prior && contentHash(prior) !== contentHash(next)) throw new Error("Immutable record identity conflict");
    this.records.set(id, structuredClone(next));
  }
  async loadQueue(id: string) { return structuredClone(this.queues.get(id) ?? null); }
  async saveQueue(id: string, expectedRevision: number, state: object) {
    this.onSave?.(expectedRevision, state);
    const actual = this.queues.get(id)?.revision ?? 0;
    if (actual !== expectedRevision) throw new Error("Queue revision conflict");
    this.queues.set(id, { revision: actual + 1, state: structuredClone(state) });
    this.afterSave?.();
    return actual + 1;
  }
  private committed(vintage: Vintage) {
    assertVintage(vintage);
    const previous = this.drafts.get(vintage.issuanceKey);
    if (previous && contentHash(previous) !== contentHash(vintage)) throw new Error("Idempotency conflict: issuance bytes changed");
    this.drafts.set(vintage.issuanceKey, structuredClone(vintage));
    if (!this.publications.has(vintage.id)) this.publications.set(vintage.id, { vintage: structuredClone(vintage), receipt: { id: `publication:${vintage.id}`, vintageId: vintage.id, outputHash: contentHash(vintage), confirmedAt: this.clock(), witness: "committed_readback", evidenceClass: vintage.evidenceClass } });
    if (this.lostAcknowledgement) { this.lostAcknowledgement = false; throw new Error("Publication acknowledgement unavailable"); }
    return structuredClone(this.publications.get(vintage.id)!);
  }
  async publish(vintage: Vintage) { this.beforePublish?.(); return this.committed(vintage); }
  async publishClaimed(vintage: Vintage, claim: { queueId: string; jobId: string; attempt: number }) {
    this.beforePublish?.();
    const state = this.queues.get(claim.queueId)?.state as RefreshState | undefined;
    const job = state?.jobs.find(j => j.id === claim.jobId), stamp = vintage.issuanceAttempt;
    if (!job || job.status !== "running" || job.attempts !== claim.attempt || Date.parse(job.leaseUntil!) <= Date.parse(this.clock()) || job.issuanceKey !== vintage.issuanceKey || !stamp || stamp.queueId !== claim.queueId || stamp.jobId !== claim.jobId || stamp.attempt > claim.attempt
      || !this.drafts.has(vintage.issuanceKey) && (stamp.attempt !== claim.attempt || stamp.startedAt !== job.startedAt)) throw new Error("stale_publication_claim");
    return this.committed(vintage);
  }
}

function prepared(): PreparedIssuance {
  const features = { opponent: available(1) }, payload = { features };
  const source = fixtureSource({ sha256: contentHash(payload) });
  const accepted = normalizeSourceBatch({ complete: true, expectedCount: 1, pages: [{ index: 0, records: [{ identity: { playerId: scope.playerId, gameId: scope.gameId, seasonId: scope.seasonId, teamId: scope.teamId, mappingRevision: "fixture-map", verified: true }, source, payload }] }] }, { cutoffAt: FIXTURE_CLOCK, maximumAgeMs: 1000, maximumRecords: 1, maximumPages: 1, intendedUse: "local_fixture", approvals: [{ source: "fixture", evidenceId: "synthetic-rights-only", approvedAt: FIXTURE_CLOCK, intendedUse: "local_fixture" }] }, row => !!row.features);
  const training: ModelExample[] = [0, 1].map(i => ({ ...FIXTURE_TARGET, id: `training-${i}`, gameId: 2099010001 + i, inputCutoffAt: `2025-12-${10 + i}T12:00:00.000Z`, gameStartAt: `2025-12-${10 + i}T23:00:00.000Z`, outcomeAvailableAt: `2025-12-${11 + i}T03:00:00.000Z`, appearance: "official_appearance", features: { opponent: available(i) }, values: Object.fromEntries(CATEGORIES.map(c => [c, available(c === "PPP" ? 0 : i)])) as CategoryMeans, sources: [fixtureSource({ observedAt: "2025-12-01T00:00:00.000Z", firstReceivedAt: "2025-12-01T00:00:00.000Z", publishedAt: null })], outcomeSource: fixtureSource({ observedAt: `2025-12-${11 + i}T03:00:00.000Z`, firstReceivedAt: `2025-12-${11 + i}T03:00:00.000Z`, publishedAt: null }) }));
  const model: CandidateModel = { algorithm: "official-appearance-kernel-means-v1", version: "synthetic-kernel-v1", recipe: { id: "kernel", featureNames: ["opponent"], bandwidth: 1, minimumSupport: 1 }, training, evidence: "development_only", protocolId: "synthetic-protocol", fittedAt: "2025-12-15T00:00:00.000Z", availableAt: "2025-12-16T00:00:00.000Z", dependencyAvailableAt: "2025-12-12T03:00:00.000Z", selection: { kind: "development_mse", protocolHash: "a".repeat(64), developmentDataHash: "b".repeat(64) } };
  return {
    accepted, context: { ...FIXTURE_TARGET, inputCutoffAt: FIXTURE_CLOCK, features, sources: [source], limitations: ["synthetic_pipeline_only"] },
    episode: { ...FIXTURE_TARGET, id: "episode-fixture", horizon: scope.horizon, episode: 1, enteredAt: FIXTURE_CLOCK, exitedAt: null, scheduleRevision: scope.scheduleRevision, affiliationRevision: scope.affiliationRevision },
    lock: { id: "lock-fixture", gameId: scope.gameId, adoptedAt: FIXTURE_CLOCK, lockAt: scope.scheduledStartAt, scheduleRevision: scope.scheduleRevision, predecessorId: null, reopened: false, actualStartAt: null, playBegun: false, timingStatus: "provisional" },
    model, participationModel: { algorithm: "appearance-kernel-bin-calibration-v1", version: "synthetic-appearance-v1", recipe: model.recipe, training, bins: [{ lower: 0, upper: 1, probability: 0.75, count: 4 }], evidence: "development_only", fittedAt: model.fittedAt, availableAt: model.availableAt, dependencyAvailableAt: model.dependencyAvailableAt, protocolHash: "a".repeat(64), calibrationDataHash: "c".repeat(64) },
    calibration: null, scoring: DEFAULT_SCORING, featureVersion: "synthetic-features-v1", codeVersion: "synthetic-code-v1", cohort: "synthetic-skater", evidenceClass: "fixture", predecessorId: null,
  };
}
async function environment() {
  const directory = await mkdtemp(join(tmpdir(), "forge-v2-pipeline-")); roots.push(directory);
  let current = later(FIXTURE_CLOCK, 1000);
  const clock = () => current, store = new DurableStore(clock), artifacts = new FileArtifactStore(join(directory, "online"), join(directory, "archive"));
  const data = prepared();
  return { clock, store, artifacts, data, setClock: (value: string) => { current = value; } };
}
async function queue(env: Awaited<ReturnType<typeof environment>>) {
  await env.store.saveQueue("queue", 0, enqueueRefresh(createRefreshState(), [plan], FIXTURE_CLOCK, bounds));
  return { queueId: "queue", store: env.store, artifacts: env.artifacts, clock: env.clock, bounds, prepared: new Map([[plan.issuanceKey, env.data]]) };
}

describe("prepared local issuance", () => {
  it("retains original episode and lock lineage across same-horizon trade and schedule revisions", async () => {
    const env = await environment(), observedAt = later(FIXTURE_CLOCK, 300000);
    const game = { ...fixtureSchedule(1)[0], gameId: FIXTURE_TARGET.gameId };
    const firstScope = buildOpportunities({ affiliations: [fixtureAffiliation()], schedule: [game], asOf: FIXTURE_CLOCK, seasonId: scope.seasonId, scheduleComplete: true }).opportunities[0];
    const firstEpisodes = observeHorizonEpisodes([], [firstScope], FIXTURE_CLOCK), firstLock = advanceLock(null, game, FIXTURE_CLOCK).epoch!;
    const changedSource = fixtureSource({ observedAt, publishedAt: observedAt, firstReceivedAt: observedAt });
    const revisedGame = { ...game, revision: "schedule-r2", source: changedSource };
    const traded = fixtureAffiliation({ teamId: 2, revision: "trade-r2", effectiveAt: observedAt, source: changedSource });
    const currentScope = buildOpportunities({ affiliations: [traded], schedule: [revisedGame], asOf: observedAt, seasonId: scope.seasonId, scheduleComplete: true }).opportunities[0];
    const episodes = observeHorizonEpisodes(firstEpisodes, [currentScope], observedAt), lock = advanceLock(firstLock, revisedGame, observedAt).epoch!;
    expect(episodes[0]).toEqual(firstEpisodes[0]); expect(lock).toEqual(firstLock);
    expect(currentScope.scheduleRevision).not.toBe(lock.scheduleRevision);
    expect(currentScope.affiliationRevision).not.toBe(episodes[0].affiliationRevision);
    if (env.data.accepted.state !== "available") throw new Error("fixture normalization failed");
    const originalRecord = env.data.accepted.records[0];
    const record = { ...originalRecord, identity: { ...originalRecord.identity, teamId: currentScope.teamId, mappingRevision: "trade-map-r2" } };
    env.data.accepted = normalizeSourceBatch({ complete: true, expectedCount: 1, pages: [{ index: 0, records: [record] }] }, { cutoffAt: observedAt, maximumAgeMs: 600000, maximumRecords: 1, maximumPages: 1, intendedUse: "local_fixture", approvals: [{ source: "fixture", evidenceId: "fixture-only", approvedAt: FIXTURE_CLOCK, intendedUse: "local_fixture" }] }, payload => !!payload.features);
    env.data.context.inputCutoffAt = observedAt; env.data.episode = episodes[0]; env.data.lock = lock;
    env.setClock(later(observedAt, 1000));
    const result = await runPreparedIssuance({ ...env, plan: planScheduledRefresh([currentScope], observedAt)[0], prepared: env.data });
    expect(result.state).toBe("published");
    if (result.state === "published") expect(result.publication.vintage).toMatchObject({ teamId: 2, scheduleRevision: "schedule-r2", affiliationRevision: "trade-r2", episodeId: firstEpisodes[0].id, lockEpochId: firstLock.id });
  });
  it("connects normalized inputs, actual math, pinned files and immutable publication", async () => {
    const env = await environment();
    const result = await runPreparedIssuance({ ...env, plan, prepared: env.data });
    expect(result.state).toBe("published");
    if (result.state !== "published") return;
    const vintage = result.publication.vintage;
    expect(vintage.means).toEqual(predictConditional(env.data.model!, env.data.context).means);
    expect(vintage.participation.probability).toEqual(available(0.75));
    expect(vintage.calibration).toEqual({ state: "unavailable", reason: "not_calibrated" });
    expect(vintage.qualificationId).toBeNull(); expect(vintage.evidenceClass).toBe("fixture");
    expect([...env.store.records.values()].map(r => r.kind)).toEqual(["opportunity", "horizon_episode", "lock_epoch"]);
    expect(vintage.distribution.state).toBe("available");
    if (vintage.distribution.state === "available") {
      const artifact = await env.artifacts.read(vintage.distribution.value);
      expect(artifact.state).toBe("available");
      if (artifact.state === "available") expect(JSON.parse(artifact.bytes)).toMatchObject({ inputCutoffAt: vintage.inputCutoffAt, modelVersion: vintage.modelVersion, modelArtifactHash: contentHash(env.data.model) });
    }
  });
  it("retains observations across source failures and refuses development authority escalation", async () => {
    for (const change of [{ accepted: { state: "unavailable", reasons: ["source_gap"] } }, { evidenceClass: "public_serving" }, { evidenceClass: "prospective_shadow" }, { context: { ...prepared().context, features: { opponent: available(999) } } }]) {
      const env = await environment();
      const result = await runPreparedIssuance({ ...env, plan, prepared: { ...env.data, ...change } as PreparedIssuance });
      expect(result.state).toBe("unavailable"); expect(env.store.records.get(preparedLedgerRecordId("opportunity", scope))?.kind).toBe("opportunity"); expect(env.store.drafts.size).toBe(0);
    }
  });
  it("publishes explicit unavailable heads when no candidate model exists", async () => {
    const env = await environment();
    const result = await runPreparedIssuance({ ...env, plan, prepared: { ...env.data, model: null, participationModel: null } });
    expect(result.state).toBe("published");
    if (result.state === "published") {
      expect(Object.values(result.publication.vintage.means).every(m => m.state === "unavailable")).toBe(true);
      expect(result.publication.vintage.participation.probability.state).toBe("unavailable");
    }
  });
  it.each([false, true])("retains only a compatible calibration artifact (late=%s)", async late => {
    const env = await environment();
    const payload: CalibrationArtifact = { schemaVersion: "profile-tail-padding-v1", calculationVersion: INTERVAL_CALCULATION, modelVersion: env.data.model!.version, profileId: env.data.scoring.id, horizon: scope.horizon, cohort: env.data.cohort, fittedAt: "2025-12-20T00:00:00.000Z", dependencyAvailableAt: "2025-12-19T00:00:00.000Z", availableAt: late ? "2026-01-02T00:00:00.000Z" : "2025-12-21T00:00:00.000Z", protocolId: "synthetic-protocol", sampleIds: ["synthetic-calibration-only"], evidence: "development_only", padding: [{ level: 0.5, lower: 0, upper: 0 }, { level: 0.9, lower: 1, upper: 1 }] };
    env.data.calibration = { payload, reference: { id: "synthetic-calibration", version: "v1", sha256: contentHash(payload), kind: "calibration", schemaVersion: payload.schemaVersion, decoderVersion: JOINT_DECODER, calculationVersion: INTERVAL_CALCULATION, categories: [...CATEGORIES], horizons: [scope.horizon], cohorts: [env.data.cohort], profileIds: [env.data.scoring.id], targetVersion: scope.targetVersion, conditioning: scope.conditioning } };
    const result = await runPreparedIssuance({ ...env, plan, prepared: env.data });
    expect(result.state).toBe("published");
    if (result.state === "published") {
      expect(result.publication.vintage.calibration.state).toBe(late ? "unavailable" : "available");
      expect(result.publication.vintage.qualificationId).toBeNull();
      if (!late) expect((await env.artifacts.read(env.data.calibration.reference)).state).toBe("available");
    }
  });
  it("reuses exact stored clocks and sequence after lost publication acknowledgement", async () => {
    const env = await environment(); env.store.lostAcknowledgement = true;
    await expect(runPreparedIssuance({ ...env, plan, prepared: env.data })).rejects.toThrow(/acknowledgement/);
    const original = await env.store.getDraft(plan.issuanceKey);
    env.setClock(later(env.clock(), 2000));
    const result = await runPreparedIssuance({ ...env, plan, prepared: null });
    expect(result.state).toBe("published");
    if (result.state === "published") { expect(result.reusedDraft).toBe(true); expect(result.publication.vintage).toEqual(original); }
    expect(env.store.sequence).toBe(1); expect(env.store.drafts.size).toBe(1);
  });
});

describe("append-only prepared ledger capture", () => {
  it("persists entry, closure and reentry snapshots with deterministic predecessor links", async () => {
    const env = await environment(), closedAt = later(FIXTURE_CLOCK, 1000), returnedAt = later(FIXTURE_CLOCK, 2000);
    const entry = observeHorizonEpisodes([], [scope], FIXTURE_CLOCK)[0];
    const closed = observeHorizonEpisodes([entry], [], closedAt)[0];
    const returned = { ...scope, id: "opportunity-reentered", observedAt: returnedAt };
    const reentry = observeHorizonEpisodes([closed], [returned], returnedAt).find(row => row.exitedAt === null)!;
    const first = await capturePreparedLedger({ store: env.store, opportunities: [{ value: scope, predecessor: null }], episodes: [{ value: entry, predecessor: null }], locks: [{ value: env.data.lock, predecessor: null }], events: [] });
    const secondInput = { store: env.store, opportunities: [{ value: returned, predecessor: scope }], episodes: [{ value: closed, predecessor: entry }, { value: reentry, predecessor: closed }], locks: [], events: [] };
    const second = await capturePreparedLedger(secondInput), count = env.store.records.size;
    expect(await capturePreparedLedger(secondInput)).toEqual(second);
    expect(env.store.records.size).toBe(count);
    const entryId = first.find(row => row.kind === "horizon_episode")!.id;
    const [closureRecord, reentryRecord] = second.filter(row => row.kind === "horizon_episode");
    expect(closureRecord.scientificId).toBe(entry.id); expect(closureRecord.id).not.toBe(entryId);
    expect(closureRecord.predecessorId).toBe(entryId); expect(reentryRecord.predecessorId).toBe(closureRecord.id);
    expect(env.store.records.get(entryId)!.payload).toEqual(entry);
    expect(env.store.records.get(closureRecord.id)!.payload).toEqual(closed);
    expect(reentryRecord.scientificId).not.toBe(entry.id);
    const revisedLock = { ...env.data.lock, id: "revised-lock", adoptedAt: returnedAt, predecessorId: env.data.lock.id, scheduleRevision: "r2" };
    const lockRows = await capturePreparedLedger({ store: env.store, opportunities: [], episodes: [], locks: [{ value: revisedLock, predecessor: env.data.lock }], events: [] });
    expect(lockRows[0].predecessorId).toBe(first.find(row => row.kind === "lock_epoch")!.id);
  });
  it("rejects entry mutation and broken predecessor identity before writing", async () => {
    const env = await environment(), entry = observeHorizonEpisodes([], [scope], FIXTURE_CLOCK)[0];
    const closed = { ...entry, exitedAt: later(FIXTURE_CLOCK, 1000), scheduleRevision: "rewritten-entry" };
    await expect(capturePreparedLedger({ store: env.store, opportunities: [], episodes: [{ value: closed, predecessor: entry }], locks: [], events: [] })).rejects.toThrow("episode_closure_changes_entry");
    await expect(capturePreparedLedger({ store: env.store, opportunities: [], episodes: [], locks: [{ value: { ...env.data.lock, predecessorId: "missing" }, predecessor: env.data.lock }], events: [] })).rejects.toThrow("invalid_ledger_lock_predecessor");
    const sameIdLock = { ...env.data.lock, lockAt: later(env.data.lock.lockAt, 1000), adoptedAt: later(env.data.lock.adoptedAt, 1000), predecessorId: env.data.lock.id };
    await expect(capturePreparedLedger({ store: env.store, opportunities: [], episodes: [], locks: [{ value: sameIdLock, predecessor: env.data.lock }], events: [] })).rejects.toThrow("invalid_ledger_lock_predecessor");
    const priorEvent: HistoryEvent = { ...FIXTURE_TARGET, id: "event-fixed-id", at: FIXTURE_CLOCK, kind: "technical_correction", reason: "fixture-only", vintageId: null, predecessorId: null };
    await expect(capturePreparedLedger({ store: env.store, opportunities: [], episodes: [], locks: [], events: [{ value: { ...priorEvent, at: later(FIXTURE_CLOCK, 1000), reason: "rewritten-event", predecessorId: priorEvent.id }, predecessor: priorEvent }] })).rejects.toThrow("invalid_ledger_event_predecessor");
    expect(env.store.records.size).toBe(0);
  });
});

describe("prepared scope reconciliation", () => {
  it("fences obsolete work before capture, preserves same-horizon trade lineage, then closes and reopens once", async () => {
    const env = await environment(), batch = await queue(env);
    const first = await runPreparedQueueBatch(batch);
    expect(first.jobs[0].result.state).toBe("published");
    const original = structuredClone([...env.store.publications.values()][0]);
    const queuedAt = later(FIXTURE_CLOCK, 2000), changedAt = later(FIXTURE_CLOCK, 300000);
    const before = (await env.store.loadQueue("queue"))!;
    const extra = { ...plan, issuanceKey: `${plan.issuanceKey}:in-flight`, trigger: "material" as const, readyAt: queuedAt };
    const claimed = claimRefreshBatch(enqueueRefresh(before.state as RefreshState, [extra], queuedAt, bounds), queuedAt, bounds);
    await env.store.saveQueue("queue", before.revision, claimed.state);
    const oldClaim = claimed.jobs[0];
    const changed = { ...scope, id: "trade-observation", observedAt: changedAt, teamId: 2, opponentId: 1, home: false, scheduleRevision: "schedule-r2", affiliationRevision: "trade-r2" };
    const locks = [{ value: env.data.lock, predecessor: null }];
    let checkedFence = false;
    env.store.beforeAppend = () => {
      const job = (env.store.queues.get("queue")!.state as RefreshState).jobs.find(j => j.id === oldClaim.id)!;
      expect(job.status).toBe("expired"); expect(job.leaseUntil).toBeNull(); checkedFence = true;
    };
    const transition = { store: env.store, queueId: "queue", previous: [{ value: scope, predecessor: null }], current: [changed], episodes: [env.data.episode], locks, acceptedAt: changedAt, bounds };
    const reconciled = await reconcilePreparedQueueScopes(transition);
    expect(reconciled.state).toBe("captured"); expect(checkedFence).toBe(true);
    if (reconciled.state !== "captured") return;
    expect(reconciled.episodes).toEqual([env.data.episode]);
    expect(reconciled.events.filter(event => event.kind === "team_change")).toHaveLength(2);
    expect((await reconcilePreparedQueueScopes(transition)).state).toBe("captured");
    env.store.beforeAppend = null;
    env.setClock(later(changedAt, 1000));
    await expect(runPreparedIssuance({ ...env, plan: oldClaim, prepared: env.data, claim: { queueId: "queue", job: oldClaim, bounds } })).rejects.toThrow("stale_refresh_claim");
    if (env.data.accepted.state !== "available") throw new Error("fixture normalization failed");
    const record = { ...env.data.accepted.records[0], identity: { ...env.data.accepted.records[0].identity, teamId: 2, mappingRevision: "trade-map-r2" } };
    const accepted = normalizeSourceBatch({ complete: true, expectedCount: 1, pages: [{ index: 0, records: [record] }] }, { cutoffAt: changedAt, maximumAgeMs: 600000, maximumRecords: 1, maximumPages: 1, intendedUse: "local_fixture", approvals: [{ source: "fixture", evidenceId: "fixture-only", approvedAt: FIXTURE_CLOCK, intendedUse: "local_fixture" }] }, payload => !!payload.features);
    const changedPrepared = { ...env.data, accepted, context: { ...env.data.context, inputCutoffAt: changedAt }, opportunityPredecessor: scope };
    const changedPlan = reconciled.plans.find(row => row.trigger === "daily")!;
    const second = await runPreparedQueueBatch({ ...batch, prepared: new Map([[changedPlan.issuanceKey, changedPrepared]]) });
    expect(second.jobs[0].result.state).toBe("published");
    const removedAt = later(changedAt, 60000);
    const removed = await reconcilePreparedQueueScopes({ ...transition, previous: reconciled.opportunities, current: [], episodes: reconciled.episodes, acceptedAt: removedAt });
    expect(removed.state).toBe("captured");
    if (removed.state !== "captured") return;
    expect(removed.episodes[0].exitedAt).toBe(removedAt);
    const reenteredAt = later(removedAt, 60000), returned = { ...changed, id: "returned-observation", observedAt: reenteredAt };
    const reopened = await reconcilePreparedQueueScopes({ ...transition, previous: [], current: [returned], episodes: removed.episodes, acceptedAt: reenteredAt });
    expect(reopened.state).toBe("captured");
    if (reopened.state !== "captured") return;
    const active = reopened.episodes.find(row => row.exitedAt === null)!;
    expect(active.episode).toBe(2); expect(active.horizon).toBe(scope.horizon);
    const newPlan = reopened.plans.find(row => row.trigger === "daily")!;
    expect(newPlan.issuanceKey).not.toBe(changedPlan.issuanceKey);
    env.setClock(later(reenteredAt, 1000));
    const returnedPrepared: PreparedIssuance = { ...changedPrepared, context: { ...changedPrepared.context, inputCutoffAt: reenteredAt }, episode: active, episodePredecessor: removed.episodes[0], opportunityPredecessor: undefined };
    const third = await runPreparedQueueBatch({ ...batch, prepared: new Map([[newPlan.issuanceKey, returnedPrepared]]) });
    expect(third.jobs[0].result.state).toBe("published");
    expect(env.store.publications.get(original.vintage.id)).toEqual(original);
    expect(env.store.publications.size).toBe(3);
  });
  it("captures nothing when reconciliation loses queue CAS", async () => {
    const env = await environment(); await queue(env);
    env.store.onSave = () => { env.store.queues.get("queue")!.revision++; };
    const result = await reconcilePreparedQueueScopes({ store: env.store, queueId: "queue", previous: [{ value: scope, predecessor: null }], current: [], episodes: [env.data.episode], locks: [], acceptedAt: later(FIXTURE_CLOCK, 1000), bounds });
    expect(result).toEqual({ state: "revision_conflict" }); expect(env.store.records.size).toBe(0);
  });
});

describe("durable prepared queue execution", () => {
  it("does no work when the durable claim CAS loses a revision race", async () => {
    const env = await environment(), input = await queue(env);
    env.store.onSave = () => { const current = env.store.queues.get("queue")!; current.revision++; };
    expect(await runPreparedQueueBatch(input)).toEqual({ state: "claim_conflict", jobs: [] });
    expect(env.store.sequence).toBe(0); expect(env.store.records.size).toBe(0);
  });
  it("merges acknowledgement into fresh queue state without losing a concurrent follow-up", async () => {
    const env = await environment(), input = await queue(env);
    let injected = false;
    env.store.onSave = (_revision, next) => {
      if (injected || !(next as RefreshState).jobs.some(j => j.status === "published")) return;
      injected = true;
      const current = env.store.queues.get("queue")!;
      current.state = enqueueMaterialEvent(current.state as RefreshState, { id: "during-run", kind: "role", receivedAt: env.clock(), acceptedAt: env.clock(), payloadHash: "d".repeat(64), affected: { playerIds: [scope.playerId] } }, [scope], env.clock(), bounds);
      current.revision++;
    };
    const result = await runPreparedQueueBatch(input);
    expect(result.jobs[0].acknowledgement).toBe("saved");
    const state = restoreRefreshState((await env.store.loadQueue("queue"))!.state, bounds);
    expect(state.jobs.map(j => j.status)).toEqual(["published", "pending"]);
    expect(state.jobs[1].eventIds).toEqual(["during-run"]); expect(state.seenEvents).toHaveLength(1);
  });
  it("rejects an attempt replaced after claim before any model/storage work", async () => {
    const env = await environment(), input = await queue(env);
    env.store.afterSave = () => {
      env.store.afterSave = null;
      const current = env.store.queues.get("queue")!, state = current.state as RefreshState;
      state.jobs[0].attempts++; current.revision++;
    };
    const result = await runPreparedQueueBatch(input);
    expect(result.jobs[0]).toMatchObject({ result: { state: "failed", reason: "stale_refresh_claim" }, acknowledgement: "stale_claim" });
    expect(env.store.sequence).toBe(0); expect(env.store.records.size).toBe(0);
  });
  it("fences a claim replacement between the last read and publication write", async () => {
    const env = await environment(), input = await queue(env);
    env.store.beforePublish = () => { env.store.beforePublish = null; const current = env.store.queues.get("queue")!; (current.state as RefreshState).jobs[0].attempts++; current.revision++; };
    const result = await runPreparedQueueBatch(input);
    expect(result.jobs[0]).toMatchObject({ result: { state: "failed", reason: "stale_publication_claim" }, acknowledgement: "stale_claim" });
    expect(env.store.drafts.size).toBe(0); expect(env.store.publications.size).toBe(0);
  });
  it("recovers a genuine earlier receipt under a later claim without recomputing its draft", async () => {
    const env = await environment(), input = await queue(env); env.store.lostAcknowledgement = true;
    const first = await runPreparedQueueBatch(input);
    expect(first.jobs[0]).toMatchObject({ result: { state: "failed" }, acknowledgement: "saved" });
    const original = [...env.store.publications.values()][0];
    await expect(runPreparedIssuance({ ...env, plan, prepared: null })).rejects.toThrow("queued_draft_requires_current_claim");
    env.setClock(later(env.clock(), 2000));
    const recovered = await runPreparedQueueBatch({ ...input, prepared: new Map() });
    expect(recovered.jobs[0]).toMatchObject({ result: { state: "published", reusedDraft: true }, acknowledgement: "saved" });
    if (recovered.jobs[0].result.state === "published") expect(recovered.jobs[0].result.publication).toEqual(original);
    const state = restoreRefreshState((await env.store.loadQueue("queue"))!.state, bounds);
    expect(state.jobs[0].attempts).toBe(2); expect(state.jobs[0].confirmedAt).toBe(original.receipt.confirmedAt);
    expect(Date.parse(state.jobs[0].confirmedAt!)).toBeLessThan(Date.parse(state.jobs[0].startedAt!));
    expect(env.store.sequence).toBe(1);
  });
});
