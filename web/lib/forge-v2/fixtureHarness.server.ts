/** Synthetic integration harness only. No provider, credentials, or qualification evidence. */
import { CATEGORIES, CategoryMeans, HorizonEpisode, LockEpoch, Opportunity, PublishedVintage, Vintage, available, assertVintage } from "./contracts";
import { fixtureAffiliation, fixtureOpportunity, fixtureOutcome, fixtureSchedule, fixtureSource, FIXTURE_TARGET } from "./fixtures";
import { FileArtifactStore } from "./artifacts.server";
import { PostgresHistoryStore, QueueHistoryRecord, RecordKind } from "./history.server";
import { contentHash } from "./hash.server";
import { DEFAULT_SCORING, scoringProfile, targetKey } from "./identity";
import { normalizeSourceBatch } from "./data";
import { CandidateModel, ModelExample, buildBaselines } from "./model";
import { PreparedIssuance, capturePreparedLedger, runPreparedQueueBatch } from "./pipeline.server";
import { RefreshState, createRefreshState, enqueueRefresh, planScheduledRefresh } from "./refresh";
import { advanceLock, buildOpportunities, observeHorizonEpisodes } from "./schedule";
import { PreparedPlayerContext, PreparedForgeReadRepository } from "./api.server";
import { PreparedBaseline, preparePlayerReadContext } from "./preparation.server";
import { CalibrationBundle, INTERVAL_CALCULATION, JOINT_DECODER } from "./uncertainty";

/** Durable-store double; native transaction behavior is tested against isolated PostgreSQL. */
export class FixtureHistoryStore {
  private sequence = 0;
  readonly ledger = new Map<string, { id: string; ordinal: number; kind: RecordKind; scope: string; payload: object; predecessorId: string | null }>();
  readonly issued = new Map<string, PublishedVintage>();
  private drafts = new Map<string, Vintage>();
  private queues = new Map<string, { revision: number; state: object }>();
  constructor(readonly clock: () => string) {}
  async reserveSequence() { return ++this.sequence; }
  async appendRecord(id: string, kind: RecordKind, scope: string, payload: object, predecessorId: string | null = null) {
    const prior = this.ledger.get(id), row = { id, ordinal: prior?.ordinal ?? this.ledger.size + 1, kind, scope, payload, predecessorId };
    if (prior && contentHash(prior) !== contentHash(row)) throw new Error("Immutable record identity conflict");
    if (predecessorId && !this.ledger.has(predecessorId)) throw new Error("Missing record predecessor");
    this.ledger.set(id, structuredClone(row));
  }
  async records(scope: string, kind: RecordKind, afterOrdinal = 0, limit = 100) {
    return [...this.ledger.values()].filter(row => row.scope === scope && row.kind === kind && row.ordinal > afterOrdinal).slice(0, limit).map(row => structuredClone({ id: row.id, ordinal: row.ordinal, payload: row.payload, predecessorId: row.predecessorId }));
  }
  async loadQueue(id: string) { return structuredClone(this.queues.get(id) ?? null); }
  async saveQueue(id: string, expectedRevision: number, state: object) {
    const revision = this.queues.get(id)?.revision ?? 0;
    if (revision !== expectedRevision) throw new Error("Queue revision conflict");
    this.queues.set(id, { revision: revision + 1, state: structuredClone(state) }); return revision + 1;
  }
  async saveQueueWithRecords(id: string, expectedRevision: number, state: object, records: QueueHistoryRecord[]) {
    if (this.queues.get(id)?.revision !== expectedRevision) throw new Error("Queue revision conflict");
    for (const row of records) {
      const prior = this.ledger.get(row.id);
      if (prior && (prior.kind !== row.kind || prior.scope !== row.scopeKey || prior.predecessorId !== row.predecessorId || contentHash(prior.payload) !== contentHash(row.payload))) throw new Error("Immutable record identity conflict");
    }
    // No awaits between validation and mutations: one atomic fixture operation.
    for (const row of records) this.ledger.set(row.id, structuredClone({ id: row.id, ordinal: this.ledger.get(row.id)?.ordinal ?? this.ledger.size + 1, kind: row.kind, scope: row.scopeKey, payload: row.payload, predecessorId: row.predecessorId }));
    this.queues.set(id, { revision: expectedRevision + 1, state: structuredClone(state) });
    return expectedRevision + 1;
  }
  async getDraft(key: string) { return structuredClone(this.drafts.get(key) ?? null); }
  async get(id: string) { return structuredClone(this.issued.get(id) ?? null); }
  async publish(vintage: Vintage) {
    assertVintage(vintage);
    const prior = this.drafts.get(vintage.issuanceKey);
    if (prior && contentHash(prior) !== contentHash(vintage)) throw new Error("Immutable vintage conflict");
    this.drafts.set(vintage.issuanceKey, structuredClone(vintage));
    if (!this.issued.has(vintage.id)) this.issued.set(vintage.id, { vintage: structuredClone(vintage), receipt: { id: `fixture-publication:${vintage.id}`, vintageId: vintage.id, outputHash: contentHash(vintage), confirmedAt: this.clock(), witness: "committed_readback", evidenceClass: "fixture" } });
    return structuredClone(this.issued.get(vintage.id)!);
  }
  async publishClaimed(vintage: Vintage, claim: { queueId: string; jobId: string; attempt: number }) {
    const state = this.queues.get(claim.queueId)?.state as RefreshState | undefined;
    const job = state?.jobs.find(row => row.id === claim.jobId);
    if (!job || job.status !== "running" || job.attempts !== claim.attempt || Date.parse(job.leaseUntil!) <= Date.parse(this.clock()) || job.issuanceKey !== vintage.issuanceKey) throw new Error("stale_refresh_claim");
    return this.publish(vintage);
  }
  async history(playerId: number, gameId: number, limit = 100, cursor?: string) {
    const rows = [...this.issued.values()].filter(row => row.vintage.playerId === playerId && row.vintage.gameId === gameId).sort((a, b) => Date.parse(a.receipt.confirmedAt) - Date.parse(b.receipt.confirmedAt) || a.vintage.sequence - b.vintage.sequence);
    const offset = cursor ? Number(cursor) : 0;
    return { revisions: structuredClone(rows.slice(offset, offset + limit)), nextCursor: offset + limit < rows.length ? String(offset + limit) : null };
  }
  asPostgresStore(): PostgresHistoryStore { return this as unknown as PostgresHistoryStore; }
}

export const FIXTURE_BOUNDS = { maximumJobs: 100, maximumEvents: 100, concurrency: 1, batchSize: 1, maximumAttempts: 3, retryDelayMs: 1000, leaseMs: 60000 };
export function preparedFixture(scope: Opportunity, episode: HorizonEpisode, lock: LockEpoch, cutoff: string, previous: Opportunity | null = null): PreparedIssuance {
  const features = { opponent: available(1) }, payload = { features };
  const source = fixtureSource({ observedAt: cutoff, firstReceivedAt: cutoff, publishedAt: cutoff, sha256: contentHash(payload) });
  const accepted = normalizeSourceBatch({ complete: true, expectedCount: 1, pages: [{ index: 0, records: [{ identity: { playerId: scope.playerId, gameId: scope.gameId, seasonId: scope.seasonId, teamId: scope.teamId, mappingRevision: "fixture-map", verified: true }, source, payload }] }] }, { cutoffAt: cutoff, maximumAgeMs: 1000, maximumRecords: 1, maximumPages: 1, intendedUse: "local_fixture", approvals: [{ source: "fixture", evidenceId: "fixture-only", approvedAt: cutoff, intendedUse: "local_fixture" }] }, () => true);
  const training: ModelExample[] = Array.from({ length: 5 }, (_, i) => ({ ...FIXTURE_TARGET, id: `fixture-training-${i}`, gameId: 2099010001 + i, inputCutoffAt: `2025-12-${10 + i}T12:00:00.000Z`, gameStartAt: `2025-12-${10 + i}T23:00:00.000Z`, outcomeAvailableAt: `2025-12-${11 + i}T03:00:00.000Z`, appearance: "official_appearance", features: { opponent: available(i % 2) }, values: Object.fromEntries(CATEGORIES.map(c => [c, available(c === "PPP" ? 0 : i % 2)])) as CategoryMeans, sources: [fixtureSource({ observedAt: "2025-12-01T00:00:00.000Z", firstReceivedAt: "2025-12-01T00:00:00.000Z", publishedAt: null })], outcomeSource: fixtureSource({ observedAt: `2025-12-${11 + i}T03:00:00.000Z`, firstReceivedAt: `2025-12-${11 + i}T03:00:00.000Z`, publishedAt: null }) }));
  const model: CandidateModel = { algorithm: "official-appearance-kernel-means-v1", version: "fixture-kernel-v1", recipe: { id: "kernel", featureNames: ["opponent"], bandwidth: 1, minimumSupport: 1 }, training, evidence: "development_only", protocolId: "fixture-only", fittedAt: "2025-12-16T00:00:00.000Z", availableAt: "2025-12-16T00:00:01.000Z", dependencyAvailableAt: "2025-12-15T03:00:00.000Z", selection: { kind: "development_mse", protocolHash: "a".repeat(64), developmentDataHash: "b".repeat(64) } };
  const profiles = [DEFAULT_SCORING, scoringProfile({ ...DEFAULT_SCORING.weights, G: -3, PIM: -0.5 }), ...CATEGORIES.map(category => scoringProfile(Object.fromEntries(CATEGORIES.map(c => [c, Number(c === category)])) as typeof DEFAULT_SCORING.weights))];
  const calibration: CalibrationBundle = { schemaVersion: "profile-calibration-bundle-v1", profiles: Object.fromEntries(profiles.map(profile => [profile.id, { profile, calibration: { schemaVersion: "profile-tail-padding-v1", calculationVersion: INTERVAL_CALCULATION, modelVersion: model.version, profileId: profile.id, horizon: scope.horizon, cohort: "fixture-skater", protocolId: "fixture-only", fittedAt: "2025-12-20T00:00:00.000Z", availableAt: "2025-12-21T00:00:00.000Z", dependencyAvailableAt: model.dependencyAvailableAt, sampleIds: ["synthetic_calibration_not_evidence"], evidence: "development_only", padding: [{ level: 0.5, lower: 0, upper: 0 }, { level: 0.9, lower: 1, upper: 1 }] } }])) };
  const sha256 = contentHash(calibration);
  return { accepted, context: { ...scope, inputCutoffAt: cutoff, features, sources: [source], limitations: ["synthetic_integration_only"] }, episode, lock, model, participationModel: null, calibration: { payload: calibration, reference: { id: `fixture-calibration:${sha256}`, sha256, version: "fixture-v1", kind: "calibration", schemaVersion: calibration.schemaVersion, decoderVersion: JOINT_DECODER, calculationVersion: INTERVAL_CALCULATION, targetVersion: scope.targetVersion, conditioning: scope.conditioning, categories: [...CATEGORIES], horizons: [scope.horizon], cohorts: ["fixture-skater"], profileIds: profiles.map(profile => profile.id) } }, scoring: DEFAULT_SCORING, featureVersion: "fixture-features", codeVersion: "fixture-code", cohort: "fixture-skater", evidenceClass: "fixture", predecessorId: null, opportunityPredecessor: previous ?? undefined };
}

export function initialFixtureScope() {
  const scope = fixtureOpportunity();
  const episode: HorizonEpisode = { ...scope, id: "fixture-H10-1", episode: 1, enteredAt: scope.observedAt, exitedAt: null };
  const lock: LockEpoch = { id: "fixture-lock", gameId: scope.gameId, adoptedAt: scope.observedAt, lockAt: scope.scheduledStartAt, scheduleRevision: scope.scheduleRevision, predecessorId: null, reopened: false, actualStartAt: null, playBegun: false, timingStatus: "provisional" };
  return { scope, episode, lock };
}
export function fixtureArtifacts(root: string) { return new FileArtifactStore(`${root}/online`, `${root}/archive`); }

/** Real production functions over synthetic input and a persistence double; no hand-built publications. */
export async function issuedLifecycleFixture(root: string) {
  const day = (n: number, time = "12:00:00.000") => `2026-01-${String(n).padStart(2, "0")}T${time}Z`;
  let now = day(1), previousScope: Opportunity | null = null, context: PreparedPlayerContext | null = null;
  const clock = () => now, store = new FixtureHistoryStore(clock), artifacts = fixtureArtifacts(root);
  const schedule = fixtureSchedule(12).map((game, i) => ({ ...game, scheduledStartAt: day(i + 1, "23:00:00.000"), sourceGameDate: day(i + 1).slice(0, 10) }));
  const targetGame = schedule.find(game => game.gameId === FIXTURE_TARGET.gameId)!;
  let episodes: HorizonEpisode[] = [], locks: LockEpoch[] = [];
  const episodePredecessors = new Map<string, HorizonEpisode | null>(), lockPredecessors = new Map<string, LockEpoch | null>();
  const baselines: PreparedBaseline[] = [], profiles = [DEFAULT_SCORING, scoringProfile({ ...DEFAULT_SCORING.weights, G: -3, PIM: -0.5 })];
  const materialize = async (at: string) => {
    now = at;
    context = await preparePlayerReadContext({ store, artifacts, player: { id: FIXTURE_TARGET.playerId, name: "Issued Synthetic Skater" }, targets: [FIXTURE_TARGET], asOf: at, evidenceClass: "fixture", profiles, qualifications: [], excluded: [], baselines, previous: context, maximumRecordsPerKind: 5000, maximumPublicationsPerGame: 200, visibility: "local_fixture", intervalProtocolId: "fixture-only" });
    return context;
  };
  const issue = async (at: string, trigger: "daily" | "material" | "pregame" = "daily", fail = false) => {
    now = at;
    const scope = buildOpportunities({ affiliations: [fixtureAffiliation()], schedule, asOf: at, seasonId: FIXTURE_TARGET.seasonId, scheduleComplete: true }).opportunities.find(row => row.gameId === FIXTURE_TARGET.gameId)!;
    const observed = observeHorizonEpisodes(episodes, [scope], at);
    const changed = observed.filter(row => !episodes.some(old => contentHash(old) === contentHash(row)));
    const observations = changed.map(value => {
      const predecessor = episodes.find(row => row.id === value.id) ?? [...observed, ...episodes].filter(row => row.horizon === value.horizon && row.episode === value.episode - 1 && row.exitedAt !== null).at(-1) ?? null;
      episodePredecessors.set(value.id, predecessor);
      return { value, predecessor };
    });
    const lock = advanceLock(locks.at(-1) ?? null, targetGame, at).epoch!;
    if (!locks.some(row => row.id === lock.id)) {
      lockPredecessors.set(lock.id, locks.at(-1) ?? null); locks.push(lock);
      await capturePreparedLedger({ store, opportunities: [], episodes: observations, locks: [{ value: lock, predecessor: lockPredecessors.get(lock.id)! }], events: [] });
    } else await capturePreparedLedger({ store, opportunities: [], episodes: observations, locks: [], events: [] });
    episodes = observed;
    const episode = episodes.find(row => row.exitedAt === null)!;
    const prepared = preparedFixture(scope, episode, lock, at, previousScope);
    prepared.episodePredecessor = episodePredecessors.get(episode.id) ?? undefined;
    prepared.lockPredecessor = lockPredecessors.get(lock.id) ?? undefined;
    prepared.predecessorId = [...store.issued.values()].at(-1)?.vintage.id ?? null;
    if (fail) prepared.accepted = { state: "unavailable", reasons: ["synthetic_missing_input"] } as PreparedIssuance["accepted"];
    const daily = planScheduledRefresh([scope], at)[0];
    const plan = { ...daily, trigger, issuanceKey: `integrated:${at}:${trigger}`, readyAt: at };
    const oldQueue = await store.loadQueue("integrated");
    await store.saveQueue("integrated", oldQueue?.revision ?? 0, enqueueRefresh(oldQueue?.state as RefreshState ?? createRefreshState(), [plan], at, FIXTURE_BOUNDS));
    now = new Date(Date.parse(at) + 1000).toISOString();
    const result = await runPreparedQueueBatch({ store, artifacts, queueId: "integrated", prepared: new Map([[plan.issuanceKey, prepared]]), bounds: FIXTURE_BOUNDS, clock });
    previousScope = scope;
    const publication = result.jobs.find(row => row.result.state === "published")?.result;
    if (publication?.state === "published") {
      const baseline = buildBaselines(prepared.model!.training, prepared.context);
      baselines.push({ target: FIXTURE_TARGET, vintageId: publication.publication.vintage.id, inputCutoffAt: at, lastFive: baseline.lastFive, seasonRate: baseline.seasonRate });
    }
    await materialize(new Date(Date.parse(now) + 1000).toISOString());
    return result;
  };
  await issue(day(1)); await issue(day(1, "12:06:00.000"), "material");
  await issue(day(2)); await issue(day(3), "daily", true);
  const gapContext = context!;
  Object.assign(targetGame, { scheduledStartAt: day(13, "23:00:00.000"), sourceGameDate: day(13).slice(0, 10), status: "postponed", revision: "postponed", source: fixtureSource({ observedAt: day(3, "13:00:00.000"), firstReceivedAt: day(3, "13:00:00.000"), publishedAt: null }) });
  await issue(day(3, "13:00:00.000"), "material");
  Object.assign(targetGame, { scheduledStartAt: day(10, "23:00:00.000"), sourceGameDate: day(10).slice(0, 10), status: "scheduled", revision: "rescheduled", source: fixtureSource({ observedAt: day(3, "14:00:00.000"), firstReceivedAt: day(3, "14:00:00.000"), publishedAt: null }) });
  await issue(day(3, "14:00:00.000"), "material");
  for (let d = 4; d <= 10; d++) await issue(day(d));
  await issue(day(10, "22:30:00.000"), "pregame");
  const last = [...store.issued.values()].at(-1)!;
  now = day(10, "23:00:01.000");
  const queue = await store.loadQueue("integrated");
  const latePlan = { scope: previousScope!, trigger: "pregame" as const, issuanceKey: "late-attempt", readyAt: day(10, "22:59:00.000"), deadlineAt: day(10, "23:00:00.000"), lockAt: day(10, "23:00:00.000"), eventIds: [] };
  await store.saveQueue("integrated", queue!.revision, enqueueRefresh(queue!.state as RefreshState, [latePlan], day(10, "22:59:00.000"), FIXTURE_BOUNDS));
  await runPreparedQueueBatch({ store, artifacts, queueId: "integrated", prepared: new Map(), bounds: FIXTURE_BOUNDS, clock });
  const outcome = fixtureOutcome({ id: "integrated-outcome", recordedAt: day(11, "03:02:00.000"), source: fixtureSource({ observedAt: day(11, "03:01:00.000"), firstReceivedAt: day(11, "03:01:00.000"), publishedAt: null }) });
  await store.appendRecord(outcome.id, "outcome", targetKey(outcome), outcome);
  const originalContext = await materialize(day(11, "04:00:00.000"));
  const corrected = { ...outcome, id: "integrated-corrected-outcome", predecessorId: outcome.id, status: "corrected" as const, values: { ...outcome.values, PIM: available(4) }, recordedAt: day(12, "03:02:00.000"), reason: "synthetic_official_correction" };
  await store.appendRecord(corrected.id, "outcome", targetKey(outcome), corrected, outcome.id);
  const finalContext = await materialize(day(12, "04:00:00.000"));
  const contexts = {
    players: async () => [finalContext.player],
    read: async (_id: number, id?: string) => id ? [...store.ledger.values()].find(row => row.id === id)?.payload as PreparedPlayerContext ?? null : finalContext,
    readGame: async (_id: number, _game: number, id?: string) => id ? [...store.ledger.values()].find(row => row.id === id)?.payload as PreparedPlayerContext ?? null : finalContext,
  };
  const repository = new PreparedForgeReadRepository(contexts, store.asPostgresStore(), artifacts);
  return { store, artifacts, context: finalContext, originalContext, gapContext, repository, profiles, last, materialize, clock };
}
