/**
 * FORGE Full-NHL H1–H10 shadow producer, built from the existing v2 machinery: `observeHorizonEpisodes`,
 * `advanceLock`, `capturePreparedLedger`, `planScheduledRefresh` / `enqueueMaterialEvent`, `runPreparedQueueBatch`,
 * `runPreparedIssuance` and `PostgresHistoryStore`. Every step is idempotent. A run that stops (time budget, crash)
 * resumes where it was, and a rerun of the same cutoff writes no new vintage. Writes go only to `forge_v2_private`.
 * Means-only vintages write no artifacts. Goalie keys are counted here and issued by `runH10GoalieIssuance`, under the
 * goalie if-starts target, because the v2 skater target, scoring and table CHECK are skater-only.
 */
import { HorizonEpisode, Instant, LockEpoch, Opportunity, ScheduleGame, SourceReference, TARGET_VERSION, CONDITIONING, Horizon, instant } from "./contracts";
import { DenominatorKey, FrozenDenominator, ForecastRow, measureCoverage } from "./denominator";
import { FileArtifactStore } from "./artifacts.server";
import { contentHash } from "./hash.server";
import { PostgresHistoryStore, SqlConnection } from "./history.server";
import { DEFAULT_SCORING, targetKey } from "./identity";
import { capturePreparedLedger, PreparedHistoryStore, PreparedIssuance, preparedLedgerRecords, runPreparedQueueBatch } from "./pipeline.server";
import { H10Ledger, runH10QueueBatch } from "./h10Batch.server";
import { createRefreshState, easternDate, enqueueMaterialEvent, enqueueRefresh, MaterialEvent, planScheduledRefresh, RefreshBounds, RefreshState, restoreRefreshState } from "./refresh";
import { advanceLock, observeHorizonEpisodes } from "./schedule";
import { buildH10Model, buildH10Training, H10GameLog, H10PrepareConfig, H10RateState, prepareH10Issuance } from "./h10Features";

/** Three attempts per job: a thrown publish error is retryable (pipeline.server.ts) and is retried at least 60 s later,
 * i.e. at the next nightly tick, on the same issuance key, so the stored draft is republished, never re-issued. */
export const H10_BOUNDS: RefreshBounds = { maximumJobs: 5000, maximumEvents: 1000, concurrency: 25, batchSize: 25, maximumAttempts: 3, retryDelayMs: 60000, leaseMs: 10 * 60000 };
export const h10QueueId = (teamId: number, horizon: number) => `forge-h10:${teamId}:H${horizon}`;
export interface H10Gap { playerId: number; gameId: number; teamId: number; horizon: Horizon; playerClass: DenominatorKey["playerClass"]; reason: string }

/** Skater keys become v2 scopes; every other key is a named gap, never a row. */
export function h10Scopes(denominator: FrozenDenominator, games: ReadonlyMap<number, ScheduleGame>) {
  if (denominator.asOf === null) throw new Error("h10_requires_dated_denominator");
  const scopes: Opportunity[] = [], gaps: H10Gap[] = [];
  let goalieKeys = 0;
  for (const key of denominator.keys) {
    const game = games.get(key.gameId);
    const gap = (reason: string) => gaps.push({ playerId: key.playerId, gameId: key.gameId, teamId: key.teamId, horizon: key.horizon, playerClass: key.playerClass, reason });
    if (key.playerClass === "goalie") { goalieKeys += 1; continue; } // issued by runH10GoalieIssuance (goalie target)
    if (!game || key.opponentId === null || key.home === null || key.scheduledStartAt === null || !key.affiliationRevision || !key.scheduleRevision) { gap("schedule_fields_missing"); continue; }
    const target = { playerId: key.playerId, gameId: key.gameId, seasonId: key.seasonId, targetVersion: TARGET_VERSION, conditioning: CONDITIONING };
    scopes.push({ ...target, id: `opportunity:${targetKey(target)}:${denominator.asOf}`, teamId: key.teamId, opponentId: key.opponentId, home: key.home, horizon: key.horizon,
      observedAt: denominator.asOf, scheduleRevision: key.scheduleRevision, affiliationRevision: key.affiliationRevision, scheduledStartAt: key.scheduledStartAt, sourceGameDate: game.sourceGameDate });
  }
  return { scopes, gaps, goalieKeys };
}

type Head<T> = { id: string; scopeKey: string; value: T; predecessor: T | null; stored: { id: string; kind: string; scope_key: string; predecessor_id: string | null; content_hash: string } };
/** Chain heads (records with no successor) for the given scopes; served by the (scope_key, kind, ordinal) index. */
async function heads<T>(db: SqlConnection, kind: string, scopeKeys: string[]): Promise<Head<T>[]> {
  if (!scopeKeys.length) return [];
  const { rows } = await db.query<{ id: string; scope_key: string; payload: string; predecessor_payload: string | null; predecessor_id: string | null; content_hash: string }>(
    `select r.id, r.scope_key, r.payload, p.payload as predecessor_payload, r.predecessor_id, r.content_hash from forge_v2_private.forge_v2_records r
     left join forge_v2_private.forge_v2_records p on p.id = r.predecessor_id
     where r.kind = $1 and r.scope_key = any($2::text[])
       and not exists (select 1 from forge_v2_private.forge_v2_records s where s.scope_key = r.scope_key and s.kind = r.kind and s.predecessor_id = r.id)`, [kind, scopeKeys]);
  return rows.map(row => ({ id: row.id, scopeKey: row.scope_key, value: JSON.parse(row.payload) as T, predecessor: row.predecessor_payload ? JSON.parse(row.predecessor_payload) as T : null,
    stored: { id: row.id, kind, scope_key: row.scope_key, predecessor_id: row.predecessor_id, content_hash: row.content_hash } }));
}

async function latestVintages(db: SqlConnection, scopes: readonly Opportunity[]): Promise<Map<string, string>> {
  if (!scopes.length) return new Map();
  const { rows } = await db.query<{ player_id: string; game_id: string; id: string }>(
    `select distinct on (v.player_id, v.game_id) v.player_id::text, v.game_id::text, v.id from forge_v2_private.forge_v2_vintages v
     join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash
     join unnest($1::bigint[], $2::bigint[]) as t(player_id, game_id) on t.player_id = v.player_id and t.game_id = v.game_id
     order by v.player_id, v.game_id, v.issuance_sequence desc`, [scopes.map(s => s.playerId), scopes.map(s => s.gameId)]);
  return new Map(rows.map(row => [`${row.player_id}:${row.game_id}`, row.id]));
}

export interface H10RunInput {
  db: SqlConnection;
  store: PreparedHistoryStore;
  artifacts: Pick<FileArtifactStore, "put">;
  denominator: FrozenDenominator;
  schedule: readonly ScheduleGame[];
  logs: readonly H10GameLog[];
  clock: () => Instant;
  config: Omit<H10PrepareConfig, "denominatorSha256"> & { maximumTrainingExamples: number };
  trigger: "daily" | { material: MaterialEvent[] };
  /** Target keys of earlier frozen denominators (previous night, earlier material cutoffs today). */
  previousKeys?: readonly string[];
  /** Per-player evidence that caused a material revision (roster move, roster event), carried as accepted sources. */
  evidence?: ReadonlyMap<number, Array<{ source: SourceReference; payload: { features: Record<string, never> } & Record<string, unknown> }>>;
  /** Stop starting new queues after this wall-clock time (epoch ms); the next invocation resumes. */
  stopAfterMs?: number;
  /** Process at most this many queues in this invocation. */
  maximumQueues?: number;
  /** Parity tests only: run a nightly issuance through the scalar ledger and queue runners (the material path's). */
  scalarQueue?: boolean;
}

export interface H10RunReport {
  denominatorSha256: string; asOf: Instant; trigger: string; scopes: number; goalieKeys: number; gaps: H10Gap[];
  training: { examples: number; available: number; skipped: Record<string, number>; modelVersion: string | null };
  ledger: { episodeRecords: number; lockRecords: number };
  /** `finished`: every job terminal; `complete`: every job published (no failed or expired job). */
  queues: { total: number; processed: number; finished: number; complete: number; rotated: number };
  jobs: Record<string, number>;
  /** Every processed queue is terminal and nothing stopped early (a later call has nothing left to do). */
  finished: boolean;
  /** Finished, and every job published. A failed or expired job never counts as complete. */
  complete: boolean;
  /** Set when the run wrote nothing because its inputs cannot support an issuance. */
  refused?: string;
}

const affects = (event: MaterialEvent, scope: Opportunity) => (!event.affected.playerIds || event.affected.playerIds.includes(scope.playerId))
  && (!event.affected.gameIds || event.affected.gameIds.includes(scope.gameId))
  && (!event.affected.teamIds || event.affected.teamIds.includes(scope.teamId) || event.affected.teamIds.includes(scope.opponentId));
const terminal = (status: string) => ["published", "failed", "expired"].includes(status);

export async function runH10Issuance(input: H10RunInput): Promise<H10RunReport> {
  const { denominator, db, store } = input, asOf = denominator.asOf!;
  const games = new Map(input.schedule.map(game => [game.gameId, game]));
  const { scopes, gaps, goalieKeys } = h10Scopes(denominator, games);
  const config: H10PrepareConfig = { ...input.config, denominatorSha256: denominator.denominatorSha256 };
  // Shared model and rate state, built once from logs received by the cutoff.
  const training = buildH10Training(input.logs, denominator.seasonId, asOf, input.config.maximumTrainingExamples);
  const model = buildH10Model(training.training, asOf), rates = H10RateState.from(input.logs, denominator.seasonId, asOf);
  // A short or empty lines read must not take tonight's issuance keys with permanently empty vintages.
  if (!model) return { denominatorSha256: denominator.denominatorSha256, asOf, trigger: input.trigger === "daily" ? "daily" : "material", scopes: scopes.length, goalieKeys,
    gaps: scopes.map(s => ({ playerId: s.playerId, gameId: s.gameId, teamId: s.teamId, horizon: s.horizon, playerClass: "skater" as const, reason: "training_below_minimum_support" })),
    training: { examples: training.training.length, available: training.available, skipped: training.skipped, modelVersion: null }, ledger: { episodeRecords: 0, lockRecords: 0 },
    queues: { total: 0, processed: 0, finished: 0, complete: 0, rotated: 0 }, jobs: {}, finished: false, complete: false, refused: "training_below_minimum_support" };

  // 1. Ledger: one observation over the full denominator, captured before any queue work (idempotent).
  const keys = scopes.map(targetKey);
  // Earlier cutoffs' targets are read too, so their open episodes close when they leave the population.
  const episodeHeads = await heads<HorizonEpisode>(db, "horizon_episode", [...new Set([...keys, ...(input.previousKeys ?? [])])]);
  const history = episodeHeads.map(row => row.value);
  const observed = observeHorizonEpisodes(history, scopes, asOf);
  const known = new Set(history.map(row => contentHash(row)));
  const episodeObservations = observed.filter(row => !known.has(contentHash(row))).map(value => ({
    value,
    predecessor: history.find(row => row.id === value.id && row.exitedAt === null)
      ?? (value.episode > 1 ? history.filter(row => targetKey(row) === targetKey(value) && row.horizon === value.horizon && row.episode === value.episode - 1 && row.exitedAt !== null).at(-1) ?? null : null),
  }));
  const lockHeadRows = await heads<LockEpoch>(db, "lock_epoch", [...new Set(scopes.map(s => String(s.gameId)))]);
  const lockHeads = new Map(lockHeadRows.map(row => [row.value.gameId, row.value]));
  const locks = new Map<number, LockEpoch>(), lockObservations: Array<{ value: LockEpoch; predecessor: LockEpoch | null }> = [];
  for (const gameId of new Set(scopes.map(s => s.gameId))) {
    const previous = lockHeads.get(gameId) ?? null, transition = advanceLock(previous, games.get(gameId)!, asOf);
    if (!transition.epoch || !transition.issuanceOpen) continue;
    locks.set(gameId, transition.epoch);
    if (transition.epoch.id !== previous?.id) lockObservations.push({ value: transition.epoch, predecessor: previous });
  }
  // Nightly: the same observations, validated in full first, then written and read back 25 at a time (h10Batch.server.ts).
  // Material keeps the scalar capture.
  const daily = input.trigger === "daily" && !input.scalarQueue, ledger = new H10Ledger(db);
  let ledgerStopped = false;
  if (daily) {
    const records = [];
    for (let i = 0; i < lockObservations.length; i += 200) records.push(...preparedLedgerRecords({ opportunities: [], episodes: [], locks: lockObservations.slice(i, i + 200), events: [] }));
    for (let i = 0; i < episodeObservations.length; i += 200) records.push(...preparedLedgerRecords({ opportunities: [], episodes: episodeObservations.slice(i, i + 200), locks: [], events: [] }));
    ledger.seed([...episodeHeads, ...lockHeadRows].map(row => row.stored));
    const captured = await ledger.capture(records, input.stopAfterMs);
    const failed = [...captured.errors.values()][0];
    if (failed) throw new Error(failed);
    ledgerStopped = captured.stopped;
  } else {
    for (let i = 0; i < lockObservations.length; i += 200) await capturePreparedLedger({ store, opportunities: [], episodes: [], locks: lockObservations.slice(i, i + 200), events: [] });
    for (let i = 0; i < episodeObservations.length; i += 200) await capturePreparedLedger({ store, opportunities: [], episodes: episodeObservations.slice(i, i + 200), locks: [], events: [] });
  }
  const openEpisodes = new Map(observed.filter(row => row.exitedAt === null).map(row => [targetKey(row), row]));

  // 2. Queues, one per team × horizon; each is enqueued, claimed and published through the v2 batch runner.
  const groups = new Map<string, Opportunity[]>();
  for (const scope of scopes) {
    if (!locks.has(scope.gameId)) { gaps.push({ playerId: scope.playerId, gameId: scope.gameId, teamId: scope.teamId, horizon: scope.horizon, playerClass: "skater", reason: "issuance_lock_closed" }); continue; }
    const id = h10QueueId(scope.teamId, scope.horizon); groups.set(id, [...(groups.get(id) ?? []), scope]);
  }
  const opportunityHeadRows = ledgerStopped ? [] : await heads<Opportunity>(db, "opportunity", keys);
  ledger.seed(opportunityHeadRows.map(row => row.stored));
  const opportunityHeads = new Map(opportunityHeadRows.map(row => [row.scopeKey, row]));
  const report: H10RunReport = { denominatorSha256: denominator.denominatorSha256, asOf, trigger: input.trigger === "daily" ? "daily" : `material:${input.trigger.material.map(event => event.id).join(",")}`,
    scopes: scopes.length, goalieKeys, gaps: [], training: { examples: training.training.length, available: training.available, skipped: training.skipped, modelVersion: model?.version ?? null },
    ledger: { episodeRecords: episodeObservations.length, lockRecords: lockObservations.length }, queues: { total: groups.size, processed: 0, finished: 0, complete: 0, rotated: 0 }, jobs: {}, finished: false, complete: false };
  const today = easternDate(asOf);
  // A ledger pass interrupted by the budget starts no job; the next call resumes it against the durable heads.
  let stoppedEarly = ledgerStopped;
  for (const [queueId, queueScopes] of ledgerStopped ? [] : [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    // Every invocation makes progress on at least one queue before the time budget applies.
    if (input.maximumQueues !== undefined && report.queues.processed >= input.maximumQueues
      || input.stopAfterMs !== undefined && report.queues.processed > 0 && Date.now() > input.stopAfterMs) { stoppedEarly = true; break; }
    let current = await store.loadQueue(queueId);
    // A material event only touches queues holding an affected scope or still-open work.
    const events = input.trigger === "daily" ? [] : input.trigger.material;
    if (input.trigger !== "daily" && !queueScopes.some(scope => events.some(event => affects(event, scope)))
      && !(current && restoreRefreshState(current.state, H10_BOUNDS).jobs.some(job => !terminal(job.status)))) continue;
    report.queues.processed += 1;
    let state: RefreshState = current ? restoreRefreshState(current.state, H10_BOUNDS) : createRefreshState();
    // Operational state rotates nightly once every job is terminal; history lives in vintages and records.
    if (state.jobs.length && state.jobs.every(job => terminal(job.status) && easternDate(job.firstQueuedAt) < today)) { state = createRefreshState(); report.queues.rotated += 1; }
    const now = input.clock(), lockMap = Object.fromEntries([...locks].map(([gameId, lock]) => [gameId, lock.lockAt]));
    let next = input.trigger === "daily"
      ? enqueueRefresh(state, planScheduledRefresh(queueScopes, asOf, lockMap).filter(plan => plan.trigger === "daily"), now, H10_BOUNDS)
      : events.reduce((acc, event) => enqueueMaterialEvent(acc, event, queueScopes, now, H10_BOUNDS, lockMap), state);
    const changed = contentHash(next) !== contentHash(current?.state ?? null);
    const savedRevision = changed ? await store.saveQueue(queueId, current?.revision ?? 0, next) : current!.revision;
    // Prepared inputs for every open job whose scope is in this denominator.
    const byKey = new Map(queueScopes.map(scope => [targetKey(scope), scope]));
    // Nightly: a queue whose every job published has nothing to claim, prepare, record or acknowledge. A failed or
    // expired job (including one enqueued after its lock) still goes through the claim, which records its
    // missing_refresh event exactly as the scalar runner does.
    if (daily && next.jobs.every(job => job.status === "published")) {
      for (const job of next.jobs) report.jobs[job.status] = (report.jobs[job.status] ?? 0) + 1;
      report.queues.finished += 1;
      report.queues.complete += 1;
      continue;
    }
    const open = !daily || next.jobs.some(job => !terminal(job.status));
    const predecessors = open ? await latestVintages(db, queueScopes) : new Map<string, string>();
    const prepared = new Map<string, PreparedIssuance>();
    for (const job of next.jobs) {
      if (terminal(job.status) || !byKey.has(targetKey(job.scope))) continue;
      const episode = openEpisodes.get(targetKey(job.scope)), lock = locks.get(job.scope.gameId);
      if (!episode || !lock || episode.horizon !== job.scope.horizon) continue;
      const head = opportunityHeads.get(targetKey(job.scope));
      const opportunityPredecessor = !head ? null : instant(head.value.observedAt) < instant(job.scope.observedAt) ? head.value : head.predecessor;
      prepared.set(job.issuanceKey, prepareH10Issuance({ scope: job.scope, episode, lock, asOf, state: rates, model, config,
        predecessorId: predecessors.get(`${job.scope.playerId}:${job.scope.gameId}`) ?? null, opportunityPredecessor,
        evidence: job.trigger === "material" ? input.evidence?.get(job.scope.playerId) ?? [] : [] }));
    }
    let final: RefreshState | null = null;
    if (daily) {
      for (let round = 0; round < Math.ceil(next.jobs.length / H10_BOUNDS.batchSize) + 4; round++) {
        // Budget: a later batch of a long queue waits for the next call.
        if (round > 0 && input.stopAfterMs !== undefined && Date.now() > input.stopAfterMs) { stoppedEarly = true; break; }
        const result = await runH10QueueBatch({ db, store: store as PostgresHistoryStore, ledger, queueId, prepared, bounds: H10_BOUNDS, clock: input.clock,
          snapshot: round === 0 ? { revision: savedRevision, state: next } : undefined });
        final = result.final?.state ?? null;
        if (result.state !== "completed" || !result.jobs.length) { final = null; break; }
        // Nothing left to claim now (a retry waits for its readiness time): skip the empty claim read.
        if (final && !final.jobs.some(job => job.status === "running" || job.status === "pending" && instant(job.readyAt) <= instant(input.clock()))) break;
        final = null;
      }
    } else {
      for (let round = 0; round < Math.ceil(next.jobs.length / H10_BOUNDS.batchSize) + 4; round++) {
        const result = await runPreparedQueueBatch({ store, artifacts: input.artifacts, queueId, prepared, bounds: H10_BOUNDS, clock: input.clock });
        if (result.state !== "completed" || !result.jobs.length) break;
      }
    }
    if (final) next = final;
    else {
      current = await store.loadQueue(queueId);
      next = restoreRefreshState(current!.state, H10_BOUNDS);
    }
    for (const job of next.jobs) report.jobs[job.status] = (report.jobs[job.status] ?? 0) + 1;
    if (next.jobs.every(job => terminal(job.status))) report.queues.finished += 1;
    if (next.jobs.every(job => job.status === "published")) report.queues.complete += 1;
  }
  report.gaps = gaps.sort((a, b) => a.teamId - b.teamId || a.horizon - b.horizon || a.playerId - b.playerId);
  report.finished = !stoppedEarly && report.queues.finished === report.queues.processed;
  report.complete = report.finished && report.queues.complete === report.queues.processed;
  return report;
}

/** A separate read-only reader: published vintages naming this denominator, with receipts, scored by coverage. */
/** A separate read-only reader. It reads, through the (player_id, game_id) index, every vintage for this denominator's
 * keys and for the keys of `alsoRead` (earlier cutoffs), then keeps vintages naming one of those denominators. The
 * latest vintage per key wins. A vintage for a key absent from this denominator (an old team after a trade) is stray,
 * never coverage. */
export async function readbackH10(db: SqlConnection, denominator: FrozenDenominator, alsoRead: readonly FrozenDenominator[] = []) {
  const all = [denominator, ...alsoRead], shas = new Set(all.map(d => `forge-h10-denominator:${d.denominatorSha256}`));
  const pairs = [...new Map(all.flatMap(d => d.keys).map(k => [`${k.playerId}:${k.gameId}`, k])).values()];
  const { rows } = await db.query<{ payload: string; output_hash: string; receipt_hash: string | null; confirmed_at: Date | string | null }>(
    `select v.payload, v.output_hash, r.output_hash as receipt_hash, r.confirmed_at from forge_v2_private.forge_v2_vintages v
     join unnest($1::bigint[], $2::bigint[]) as t(player_id, game_id) on t.player_id = v.player_id and t.game_id = v.game_id
     left join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id`, [pairs.map(k => k.playerId), pairs.map(k => k.gameId)]);
  const vintages = rows.map(row => ({ vintage: JSON.parse(row.payload), receiptMatches: row.receipt_hash === row.output_hash && row.confirmed_at !== null, confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null }))
    .filter(row => (row.vintage.sourceManifest as Array<{ id: string }>).some(source => shas.has(source.id)));
  const latest = new Map<string, typeof vintages[number]>();
  for (const row of vintages) {
    const key = `${row.vintage.playerId}:${row.vintage.gameId}`, prior = latest.get(key);
    if (!prior || row.vintage.sequence > prior.vintage.sequence) latest.set(key, row);
  }
  const forecasts: ForecastRow[] = [...latest.values()].filter(row => row.receiptMatches).map(row => ({
    playerId: row.vintage.playerId, gameId: row.vintage.gameId, teamId: row.vintage.teamId, issuedAt: row.confirmedAt!, runId: row.vintage.issuanceKey,
    values: Object.fromEntries(Object.entries(row.vintage.means as Record<string, { state: string; value?: number }>).map(([k, v]) => [k, v.state === "available" ? v.value! : null])) }));
  const coverage = measureCoverage(denominator, forecasts);
  // Matchup spread: how many different forecasts a skater's ten games get, and how far apart their default scores are.
  const inDenominator = new Set(denominator.keys.map(k => `${k.playerId}:${k.gameId}:${k.teamId}`));
  const perPlayer = new Map<number, { vectors: Set<string>; scores: number[] }>();
  for (const row of forecasts) {
    if (!inDenominator.has(`${row.playerId}:${row.gameId}:${row.teamId}`) || Object.values(row.values).some(v => v === null)) continue;
    const entry = perPlayer.get(row.playerId) ?? { vectors: new Set<string>(), scores: [] };
    entry.vectors.add(Object.entries(row.values).sort().map(([k, v]) => `${k}=${(v as number).toFixed(6)}`).join(";"));
    entry.scores.push(Object.entries(DEFAULT_SCORING.weights).reduce((sum, [k, w]) => sum + w * (row.values[k] as number), 0));
    perPlayer.set(row.playerId, entry);
  }
  const distinct = [...perPlayer.values()].map(p => p.vectors.size), ranges = [...perPlayer.values()].map(p => Math.max(...p.scores) - Math.min(...p.scores)).sort((a, b) => a - b);
  return {
    vintages: vintages.length, latestTargets: latest.size, receiptMismatches: vintages.filter(row => !row.receiptMatches).length, coverage,
    skaterPlayers: new Set(denominator.keys.filter(k => k.playerClass === "skater").map(k => k.playerId)).size,
    spread: {
      players: perPlayer.size,
      distinctForecastsPerPlayer: Object.fromEntries([...new Set(distinct)].sort((a, b) => a - b).map(n => [n, distinct.filter(d => d === n).length])),
      playersAtMostTwoDistinct: distinct.filter(d => d <= 2).length,
      scoreRange: ranges.length ? { min: ranges[0], median: ranges[Math.floor(ranges.length / 2)], max: ranges[ranges.length - 1] } : null,
    },
    reasons: Object.fromEntries([...latest.values()].flatMap(row => Object.values(row.vintage.means as Record<string, { state: string; reason?: string }>).filter(v => v.state !== "available").map(v => v.reason!))
      .reduce((map, reason) => map.set(reason, (map.get(reason) ?? 0) + 1), new Map<string, number>())),
  };
}
