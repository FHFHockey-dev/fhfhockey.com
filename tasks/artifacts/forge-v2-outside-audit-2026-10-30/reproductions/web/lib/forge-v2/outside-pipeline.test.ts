// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CATEGORIES, CategoryMeans, HistoryEvent, PublishedVintage, Vintage, assertVintage, available, unavailable } from "./contracts";
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


import { predictJoint } from "./uncertainty";

describe("outside audit: pipeline contract seams", () => {
  it("records a terminal missing-input refresh in immutable history", async () => {
    const env = await environment(), input = await queue(env);
    input.prepared.clear();
    const result = await runPreparedQueueBatch(input);
    expect(result.jobs[0].result).toMatchObject({state:"unavailable",reason:"prepared_inputs_missing"});
    const snapshot = await env.store.loadQueue("queue");
    expect((snapshot!.state as RefreshState).jobs[0].status).toBe("failed");
    const gaps = [...env.store.records.values()].filter(r => r.kind === "history_event");
    expect(gaps.length, "Failure is only in mutable queue; immutable history/UI receives no gap").toBeGreaterThan(0);
  });
  it("does not let missing zero-weight PIM suppress an otherwise complete default joint", async () => {
    const env = await environment();
    env.data.model!.training[1].values.PIM = unavailable("PIM_source_incomplete");
    const contributing = CATEGORIES.filter(c => DEFAULT_SCORING.weights[c] !== 0);
    const compatible = predictJoint(env.data.model!,env.data.context,contributing);
    expect(compatible.state).toBe("available");
    const result = await runPreparedIssuance({store:env.store,artifacts:env.artifacts,plan,prepared:env.data,clock:env.clock});
    expect(result.state).toBe("published");
    if(result.state!=="published") throw new Error("no publication");
    expect(result.publication.vintage.distribution, "All six contributing categories have complete data; only PIM is incomplete").toMatchObject({state:"available"});
  });
});
