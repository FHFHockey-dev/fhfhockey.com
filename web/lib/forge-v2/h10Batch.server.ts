/**
 * Batched H1–H10 nightly skater issuance (THROUGHPUT-ANALYSIS.md §3, rows 1 and 2). The same work as
 * `capturePreparedLedger` + `runPreparedQueueBatch` / `runPreparedIssuance`, for one claimed queue batch (≤25 jobs) at a
 * time instead of one job, so a fresh queue costs about a dozen statements instead of 18 per key:
 *
 *   claim CAS · draft read · ledger insert + readback · sequence block · (A) fenced vintage insert · (B) committed
 *   bytes read · (C) fenced receipt insert · (D) receipt join read · acknowledgement CAS
 *
 * A–D are separate autocommit statements (a receipt needs a committed vintage). Every stage compares key sets, never row
 * counts or RETURNING. A key that fails a stage, or every unresolved key when a statement throws, gets its own result;
 * the existing finishRefresh retry and recovery rules then apply, so a retried key republishes its stored draft (same id,
 * sequence, bytes and claim stamp). Nightly path only: material triggers keep the scalar runner, and shared FORGE v2
 * code is reused unchanged. Means-only H10 issuances only (no calibration, no joint artifact): anything else fails closed.
 */
import { ArtifactReference, CATEGORIES, CategoryMeans, Component, PublishedVintage, Vintage, assertVintage, instant, unavailable } from "./contracts";
import { contentHash } from "./hash.server";
import { decoded, PostgresHistoryStore, PublicationClaim, QueueHistoryRecord, SqlConnection } from "./history.server";
import { canonicalJson, scoringProfile } from "./identity";
import { predictConditional } from "./model";
import { predictParticipation } from "./participation";
import { PreparedBatchInput, PreparedBatchResult, PreparedIssuance, PreparedRunResult, preparedLedgerRecords, refreshEventRecord, sameIssuedScope, validatePrepared, validPlan } from "./pipeline.server";
import { RefreshBounds, RefreshJob, RefreshResult, RefreshState, claimRefreshBatch, finishRefresh, recoverRefreshPublication, restoreRefreshState } from "./refresh";

const QUEUE = "forge_v2_private.forge_v2_work_queue", VINTAGES = "forge_v2_private.forge_v2_vintages", RECEIPTS = "forge_v2_private.forge_v2_publication_receipts", RECORDS = "forge_v2_private.forge_v2_records";
/** Rows per ledger write and keys per publication statement. */
export const H10_BATCH_ROWS = 25;
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const revisionConflict = (error: unknown) => error instanceof Error && error.message === "Queue revision conflict";

/** One statement in flight and at most `perSecond` statement starts per second, across every caller of this connection. */
export function pacedConnection(db: SqlConnection, perSecond = 30): SqlConnection & { statements(): number } {
  const spacing = Math.ceil(1000 / perSecond);
  let chain: Promise<unknown> = Promise.resolve(), last = -Infinity, count = 0;
  return {
    statements: () => count,
    query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]) {
      const run = chain.then(async () => {
        const wait = last + spacing - Date.now();
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        last = Date.now(); count += 1;
        return db.query<T>(text, values);
      });
      chain = run.catch(() => undefined);
      return run;
    },
  };
}

type LedgerRecord = ReturnType<typeof preparedLedgerRecords>[number];
type StoredTuple = { id: string; kind: string; scope_key: string; predecessor_id: string | null; content_hash: string };
const tupleOf = (row: StoredTuple) => JSON.stringify([row.id, row.kind, row.scope_key, row.predecessor_id, row.content_hash]);
const proposedTuple = (record: LedgerRecord) => tupleOf({ id: record.id, kind: record.kind, scope_key: record.scopeKey, predecessor_id: record.predecessorId, content_hash: contentHash(record.value) });

/** Immutable ledger capture in bounded sets: insert first-write-wins, then read every wanted id back and compare kind, scope,
 * predecessor and server hash. Only read-back (or head-read) tuples enter the call-local cache. */
export class H10Ledger {
  private readonly verified = new Map<string, string>();
  constructor(private readonly db: SqlConnection) {}
  /** Stored rows read from the database (chain heads): durable tuples. */
  seed(rows: readonly StoredTuple[]) { for (const row of rows) this.verified.set(row.id, tupleOf(row)); }
  /** Errors by record id (absent: verified). Records keep their order, so a predecessor is in the same or an earlier
   * statement. A statement that throws is retried one record at a time, in order, so only a bad record fails.
   * `stopAfterMs` is checked before each write after the first (every call makes progress); the records not attempted
   * come back as `stopped`. */
  async capture(records: readonly LedgerRecord[], stopAfterMs?: number): Promise<{ errors: Map<string, string>; stopped: boolean }> {
    const errors = new Map<string, string>(), pending: LedgerRecord[] = [], wanted = new Map<string, string>();
    for (const record of records) {
      const tuple = proposedTuple(record), seen = wanted.get(record.id) ?? this.verified.get(record.id);
      if (seen !== undefined && seen !== tuple) { errors.set(record.id, "Immutable record identity conflict"); continue; }
      if (wanted.has(record.id) || this.verified.get(record.id) === tuple) continue;
      wanted.set(record.id, tuple); pending.push(record);
    }
    const write = async (chunk: LedgerRecord[]) => {
        await this.db.query(`insert into ${RECORDS} (id,kind,scope_key,predecessor_id,payload)
          select id,kind,scope_key,predecessor_id,payload from unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::text[]) with ordinality as t(id,kind,scope_key,predecessor_id,payload,ord)
          order by ord on conflict do nothing`,
          [chunk.map(r => r.id), chunk.map(r => r.kind), chunk.map(r => r.scopeKey), chunk.map(r => r.predecessorId), chunk.map(r => canonicalJson(r.value))]);
        const { rows } = await this.db.query<StoredTuple>(`select id,kind,scope_key,predecessor_id,content_hash from ${RECORDS} where id = any($1::text[])`, [chunk.map(r => r.id)]);
        const stored = new Map(rows.map(row => [row.id, tupleOf(row)]));
        for (const record of chunk) {
          if (stored.get(record.id) === wanted.get(record.id)) this.verified.set(record.id, wanted.get(record.id)!);
          else errors.set(record.id, "Immutable record identity conflict");
        }
    };
    for (let i = 0; i < pending.length; i += H10_BATCH_ROWS) {
      if (i > 0 && stopAfterMs !== undefined && Date.now() > stopAfterMs) return { errors, stopped: true };
      const chunk = pending.slice(i, i + H10_BATCH_ROWS);
      try { await write(chunk); }
      catch (error) {
        if (chunk.length === 1) { errors.set(chunk[0].id, message(error, "ledger_capture_failed")); continue; }
        for (const record of chunk) {
          try { await write([record]); } catch (single) { errors.set(record.id, message(single, "ledger_capture_failed")); }
        }
      }
    }
    return { errors, stopped: false };
  }
}

type Outcome = PreparedBatchResult["jobs"][number]["result"];
interface Work {
  job: RefreshJob; prepared: PreparedIssuance | null; result?: Outcome; ack?: PreparedBatchResult["jobs"][number]["acknowledgement"];
  issuance?: PreparedIssuance; draft?: Vintage; reused?: boolean; payload?: string; hash?: string;
}
export interface H10BatchInput extends Omit<PreparedBatchInput, "store" | "artifacts"> {
  db: SqlConnection; store: PostgresHistoryStore; ledger: H10Ledger;
  /** The queue as the caller last wrote it; skips the first read. */
  snapshot?: { revision: number; state: object };
}
export interface H10BatchResult extends PreparedBatchResult {
  /** The queue as this batch wrote it, when its last write was the acknowledgement CAS. */
  final?: { revision: number; state: RefreshState };
}

async function readDrafts(db: SqlConnection, keys: string[]): Promise<Map<string, Vintage | Error>> {
  const out = new Map<string, Vintage | Error>();
  if (!keys.length) return out;
  const { rows } = await db.query<{ issuance_key: string; payload: string; output_hash: string }>(`select issuance_key,payload,output_hash from ${VINTAGES} where issuance_key = any($1::text[])`, [keys]);
  for (const row of rows) {
    try {
      const vintage = JSON.parse(row.payload) as Vintage;
      assertVintage(vintage);
      if (contentHash(vintage) !== row.output_hash) throw new Error("Corrupt stored draft");
      out.set(row.issuance_key, vintage);
    } catch (error) { out.set(row.issuance_key, error instanceof Error ? error : new Error("Corrupt stored draft")); }
  }
  return out;
}
async function readPublications(db: SqlConnection, ids: string[]): Promise<Map<string, PublishedVintage | Error>> {
  const out = new Map<string, PublishedVintage | Error>();
  if (!ids.length) return out;
  const { rows } = await db.query<{ id: string; payload: string; output_hash: string; confirmed_at: Date | string | null }>(`select v.id,v.payload,v.output_hash,r.confirmed_at from ${VINTAGES} v
    join ${RECEIPTS} r on r.vintage_id=v.id and r.output_hash=v.output_hash where v.id = any($1::text[])`, [ids]);
  for (const row of rows) {
    try { out.set(row.id, decoded(row)); } catch (error) { out.set(row.id, error instanceof Error ? error : new Error("Corrupt or unpublished vintage")); }
  }
  return out;
}

/** Every original claim predicate, rechecked by the database under the queue row lock (the same fence as
 * `publishClaimed`, plus start time and the whole scope). */
const ADMITTED = `locked as (select revision,state from ${QUEUE} where id=$1 for update),
  entries as (select * from jsonb_to_recordset($2::jsonb) as e(id text,issuance_key text,sequence bigint,player_id bigint,game_id bigint,payload text,output_hash text,job_id text,attempt int,started_at text,scope jsonb)),
  admitted as (select e.* from locked,entries e where exists (select 1 from jsonb_array_elements(locked.state->'jobs') job
    where job->>'id'=e.job_id and (job->>'attempts')::int=e.attempt and job->>'status'='running' and (job->>'leaseUntil')::timestamptz>clock_timestamp()
    and job->>'issuanceKey'=e.issuance_key and job->>'startedAt'=e.started_at and job->'scope'=e.scope
    and (job->'scope'->>'playerId')::bigint=e.player_id and (job->'scope'->>'gameId')::bigint=e.game_id))`;

/** One bounded batch of one queue. Same claim, retry and acknowledgement rules as `runPreparedQueueBatch`. */
export async function runH10QueueBatch(input: H10BatchInput): Promise<H10BatchResult> {
  const { db, store, queueId, bounds } = input, mergeLimit = input.maximumMergeAttempts ?? 3;
  if (!queueId.trim() || !Number.isInteger(mergeLimit) || mergeLimit < 1 || mergeLimit > 5) throw new Error("invalid_prepared_batch_bounds");
  const snapshot = input.snapshot ?? await store.loadQueue(queueId);
  if (!snapshot) return { state: "queue_missing", jobs: [] };
  let prior = restoreRefreshState(snapshot.state, bounds);
  const claimedAt = input.clock();
  const transitioning = prior.jobs.filter(job => job.status === "failed" || job.status === "expired" || job.status === "running" && instant(job.leaseUntil!) <= instant(claimedAt) || job.status === "pending" && instant(job.lockAt) <= instant(claimedAt));
  const recovery = transitioning.filter(job => job.attempts > 0);
  if (recovery.length > 100 || transitioning.length > 100) throw new Error("prepared_receipt_recovery_capacity_exceeded");
  if (recovery.length) {
    const drafts = await readDrafts(db, recovery.map(job => job.issuanceKey));
    const ids = [...drafts.values()].map(draft => { if (draft instanceof Error) throw draft; return draft.id; });
    const publications = await readPublications(db, ids);
    for (const job of recovery) {
      const draft = drafts.get(job.issuanceKey) as Vintage | undefined;
      if (!draft) continue;
      const publication = publications.get(draft.id);
      if (!publication) continue;
      if (publication instanceof Error) throw publication;
      if (contentHash(draft) !== contentHash(publication.vintage)) throw new Error("recovery_draft_receipt_mismatch");
      prior = recoverRefreshPublication(prior, job.id, publication, claimedAt, bounds, queueId);
    }
  }
  const claimed = claimRefreshBatch(prior, claimedAt, bounds);
  if (claimed.jobs.length > 100) throw new Error("prepared_receipt_recovery_capacity_exceeded");
  const eventSource = { queueId } as PreparedBatchInput;
  const claimEvents: QueueHistoryRecord[] = [];
  for (const job of prior.jobs) {
    if (job.status === "running" && instant(job.leaseUntil!) <= instant(claimedAt)) claimEvents.push(refreshEventRecord(eventSource, job, "failed_attempt", "worker_lease_expired", job.leaseUntil!));
    if ((job.status === "pending" || job.status === "running" && instant(job.leaseUntil!) <= instant(claimedAt)) && instant(job.lockAt) <= instant(claimedAt)) claimEvents.push(refreshEventRecord(eventSource, job, "missing_refresh", "missing_refresh:lock_passed", job.lockAt));
    if ((job.status === "failed" || job.status === "expired") && job.reason && job.finishedAt) claimEvents.push(refreshEventRecord(eventSource, job, "missing_refresh", job.reason, job.reason === "missing_refresh:lock_passed" ? job.lockAt : job.finishedAt));
  }
  // Nothing to claim and nothing to record: the CAS would rewrite identical state.
  if (!claimed.jobs.length && !claimEvents.length && contentHash(claimed.state) === contentHash(restoreRefreshState(snapshot.state, bounds))) return { state: "completed", jobs: [] };
  let knownRevision: number | undefined, claimRevision: number | undefined;
  try { knownRevision = await store.saveQueueWithRecords(queueId, snapshot.revision, claimed.state, claimEvents); }
  catch (error) { if (revisionConflict(error)) return { state: "claim_conflict", jobs: [] }; throw error; }
  claimRevision = knownRevision;

  const work: Work[] = claimed.jobs.map(job => ({ job, prepared: input.prepared.get(job.issuanceKey) ?? null }));
  const fail = (w: Work, reason: string) => { w.result = { state: "failed", reason }; };
  const unresolved = (filter: (w: Work) => boolean = () => true) => work.filter(w => !w.result && filter(w));
  for (const w of work) try { validPlan(w.job); } catch (error) { fail(w, message(error, "prepared_issuance_failed")); }

  // Stored drafts: a retried job republishes its original draft, never re-issues.
  // A read that throws is retried one key at a time, so only a key whose own read fails is failed.
  const draftKeys = unresolved().map(w => w.job.issuanceKey);
  let drafts: Map<string, Vintage | Error>;
  try { drafts = await readDrafts(db, draftKeys); }
  catch {
    drafts = new Map();
    for (const key of draftKeys) {
      try { for (const [k, v] of await readDrafts(db, [key])) drafts.set(k, v); }
      catch (error) { drafts.set(key, error instanceof Error ? error : new Error("prepared_issuance_failed")); }
    }
  }
  {
    for (const w of unresolved()) {
      const existing = drafts.get(w.job.issuanceKey);
      if (existing instanceof Error) fail(w, existing.message);
      else if (existing) {
        if (!sameIssuedScope(existing, w.job) || !["fixture", "retrospective_reconstruction", "prospective_shadow"].includes(existing.evidenceClass)
          || existing.evidenceClass === "prospective_shadow" && w.prepared?.evidenceClass !== "prospective_shadow") fail(w, "stored_draft_scope_or_authority_mismatch");
        else { w.draft = existing; w.reused = true; }
      }
    }
  }

  // Ledger observations, per job and in the scalar order: the opportunity first (it survives missing or invalid inputs),
  // then, for valid inputs, the episode and lock. A job whose observation is not verified fails with that reason.
  const capture = async (records: Map<Work, LedgerRecord[]>) => {
    try {
      const { errors } = await input.ledger.capture([...records.values()].flat());
      for (const [w, rows] of records) { const error = rows.map(row => errors.get(row.id)).find(Boolean); if (error) fail(w, error); }
    } catch (error) { for (const w of records.keys()) fail(w, message(error, "ledger_capture_failed")); }
  };
  const opportunities = new Map<Work, LedgerRecord[]>();
  for (const w of unresolved(w => !w.draft)) {
    try { opportunities.set(w, preparedLedgerRecords({ opportunities: [{ value: w.job.scope, predecessor: w.prepared?.opportunityPredecessor ?? null }], episodes: [], locks: [], events: [] })); }
    catch (error) { fail(w, message(error, "prepared_issuance_failed")); }
  }
  await capture(opportunities);
  const checkedAt = input.clock(), lineage = new Map<Work, LedgerRecord[]>();
  for (const w of unresolved(w => !w.draft)) {
    if (!w.prepared) { w.result = { state: "unavailable", reason: "prepared_inputs_missing", retryable: false }; continue; }
    if (w.prepared.calibration || !w.prepared.shadow?.omitJointDistribution && w.prepared.model) { fail(w, "h10_batch_requires_means_only_issuance"); continue; }
    // The model is shared, read-only, across the call; every other input is the job's own copy (as in the scalar path).
    const prepared: PreparedIssuance = { ...structuredClone({ ...w.prepared, model: null }), model: w.prepared.model };
    try { validatePrepared(w.job, prepared); } catch (error) { w.result = { state: "unavailable", reason: message(error, "invalid_prepared_inputs"), retryable: false }; continue; }
    if (instant(checkedAt) < instant(prepared.context.inputCutoffAt) || instant(checkedAt) >= instant(w.job.lockAt)) { w.result = { state: "unavailable", reason: "issuance_clock_outside_cutoff_or_lock", retryable: false }; continue; }
    try { lineage.set(w, preparedLedgerRecords({ opportunities: [], episodes: [{ value: prepared.episode, predecessor: prepared.episodePredecessor ?? null }], locks: [{ value: prepared.lock, predecessor: prepared.lockPredecessor ?? null }], events: [] })); }
    catch (error) { fail(w, message(error, "prepared_issuance_failed")); continue; }
    w.issuance = prepared;
  }
  await capture(lineage);

  // Immutable compute, then one sequence value per new draft, bound in claim order.
  const predicted: Array<{ w: Work; means: CategoryMeans; limitations: string[] }> = [];
  for (const w of unresolved(w => !!w.issuance && !w.draft)) {
    const prepared = w.issuance!;
    try {
      const prediction = prepared.model ? predictConditional(prepared.model, prepared.context) : { means: Object.fromEntries(CATEGORIES.map(c => [c, unavailable("conditional_model_unavailable")])) as CategoryMeans, limitations: prepared.context.limitations };
      predicted.push({ w, means: prediction.means, limitations: [...prediction.limitations, prepared.evidenceClass === "prospective_shadow" ? "prospective_shadow_unqualified" : "private_development_unqualified"] });
    } catch { w.result = { state: "unavailable", reason: "conditional_model_generation_failed", retryable: false }; }
  }
  if (predicted.length) {
    let sequences: number[] = [];
    try {
      const { rows } = await db.query<{ sequence: string }>("select nextval('forge_v2_private.forge_v2_issuance_sequence')::text as sequence from generate_series(1,$1::int)", [predicted.length]);
      sequences = rows.map(row => Number(row.sequence)).sort((a, b) => a - b);
      if (sequences.length !== predicted.length || sequences.some(s => !Number.isSafeInteger(s) || s < 1)) throw new Error("Issuance sequence exhausted");
    } catch {
      // One value per key, in claim order (the scalar reservation), so only a key whose own reservation fails is failed.
      sequences = [];
      for (const [index, { w }] of predicted.entries()) {
        try { sequences[index] = await store.reserveSequence(); } catch (error) { fail(w, message(error, "prepared_issuance_failed")); }
      }
    }
    predicted.forEach(({ w, means, limitations }, index) => {
      if (w.result) return;
      const prepared = w.issuance!, plan = w.job, scope = plan.scope, generatedAt = input.clock();
      if (instant(generatedAt) >= instant(plan.lockAt)) { w.result = { state: "unavailable", reason: "generation_crossed_lock", retryable: false }; return; }
      const participation = predictParticipation(prepared.participationModel, prepared.context);
      const calibration: Component<ArtifactReference> = unavailable("not_calibrated");
      const distribution: Component<ArtifactReference> = unavailable(prepared.shadow?.omitJointDistribution ? "joint_distribution_omitted_in_shadow" : "joint_model_unavailable");
      const draft: Vintage = {
        playerId: scope.playerId, gameId: scope.gameId, seasonId: scope.seasonId, targetVersion: scope.targetVersion, conditioning: scope.conditioning,
        id: `vintage:${contentHash(plan.issuanceKey)}`, issuanceKey: plan.issuanceKey, sequence: sequences[index],
        teamId: scope.teamId, opponentId: scope.opponentId, home: scope.home, horizon: scope.horizon, episodeId: prepared.episode.id, lockEpochId: prepared.lock.id,
        scheduleRevision: scope.scheduleRevision, affiliationRevision: scope.affiliationRevision, sourceGameDate: scope.sourceGameDate, scheduledStartAt: scope.scheduledStartAt,
        inputCutoffAt: prepared.context.inputCutoffAt, generatedAt, means, participation, distribution, calibration, scoring: prepared.scoring,
        modelVersion: prepared.model?.version ?? "unavailable-model-v1", featureVersion: prepared.featureVersion, codeVersion: prepared.codeVersion, cohort: prepared.cohort,
        qualificationId: null, sourceManifest: prepared.context.sources, trigger: plan.trigger, predecessorId: prepared.predecessorId, evidenceClass: prepared.evidenceClass, limitations,
        issuanceAttempt: { queueId, jobId: plan.id, attempt: plan.attempts, startedAt: plan.startedAt! },
      };
      try { assertVintage(draft); w.draft = draft; w.reused = false; } catch (error) { fail(w, message(error, "prepared_issuance_failed")); }
    });
  }

  // Publication: the checks `publishClaimed` makes before its first statement.
  for (const w of unresolved(w => !!w.draft)) {
    const draft = w.draft!, stamp = draft.issuanceAttempt;
    if (!stamp || stamp.queueId !== queueId || stamp.jobId !== w.job.id || stamp.attempt > w.job.attempts) { fail(w, "Missing original issuance attempt"); continue; }
    try {
      assertVintage(draft);
      if (canonicalJson(scoringProfile(draft.scoring.weights)) !== canonicalJson(draft.scoring)) throw new Error("Scoring identity mismatch");
    } catch (error) { fail(w, message(error, "prepared_issuance_failed")); continue; }
    w.payload = canonicalJson(draft); w.hash = contentHash(draft);
  }
  const entry = (w: Work, withPayload: boolean) => ({ id: w.draft!.id, issuance_key: w.draft!.issuanceKey, sequence: w.draft!.sequence, player_id: w.draft!.playerId, game_id: w.draft!.gameId,
    payload: withPayload ? w.payload! : null, output_hash: w.hash!, job_id: w.job.id, attempt: w.job.attempts, started_at: w.job.startedAt, scope: w.job.scope });
  const admittedIds = (rows: Array<{ job_id: string }>) => new Set(rows.map(row => row.job_id));
  let receiptRevision: number | undefined;
  /** Stages A–D for one group. A key-specific outcome resolves that key; a statement that throws propagates, leaving the
   * keys it had not resolved unresolved (its effect is unknown: it may have committed). */
  const publishGroup = async (group: Work[]) => {
    const live = () => group.filter(w => !w.result);
    // (A) First-write-wins vintage insert, admitted under the queue fence. A prior attempt's draft is not rewritten.
    let members = live();
    if (!members.length) return;
    const inserted = await db.query<{ job_id: string }>(`with ${ADMITTED}, inserted as (insert into ${VINTAGES} (id,issuance_key,issuance_sequence,player_id,game_id,payload)
      select a.id,a.issuance_key,a.sequence,a.player_id,a.game_id,a.payload from admitted a
      where (a.payload::jsonb->'issuanceAttempt'->>'attempt')::int=a.attempt and a.payload::jsonb->'issuanceAttempt'->>'startedAt'=a.started_at
      on conflict do nothing returning id) select job_id from admitted`, [queueId, JSON.stringify(members.map(w => entry(w, true)))]);
    const admittedA = admittedIds(inserted.rows);
    for (const w of members) if (!admittedA.has(w.job.id)) fail(w, "Refresh publication claim lost");
    // (B) A new statement: the committed draft for every wanted issuance key must be these exact bytes.
    members = live();
    if (!members.length) return;
    const committed = await db.query<{ issuance_key: string; id: string; output_hash: string; payload: string }>(`select issuance_key,id,output_hash,payload from ${VINTAGES} where issuance_key = any($1::text[])`,
      [members.map(w => w.draft!.issuanceKey)]);
    const stored = new Map(committed.rows.map(row => [row.issuance_key, row]));
    for (const w of members) {
      const row = stored.get(w.draft!.issuanceKey);
      if (row?.id !== w.draft!.id || row.output_hash !== w.hash || row.payload !== w.payload) fail(w, "Idempotency conflict: issuance bytes changed");
    }
    // (C) Receipts for the verified drafts only, under the same fence; a new receipt advances the queue revision.
    members = live();
    if (!members.length) return;
    const receipts = await db.query<{ job_id: string; locked_revision: string; fenced_revision: string | null }>(`with ${ADMITTED}, inserted as (
      insert into ${RECEIPTS} (vintage_id,output_hash,confirmed_at,witness) select a.id,a.output_hash,clock_timestamp(),'committed_readback' from admitted a where a.sequence>0
      on conflict do nothing returning vintage_id), fenced as (
      update ${QUEUE} set revision=revision+1,updated_at=clock_timestamp() where id=$1 and exists(select 1 from inserted) returning revision)
      select a.job_id,(select revision from locked)::text as locked_revision,(select revision from fenced)::text as fenced_revision from admitted a`, [queueId, JSON.stringify(members.map(w => entry(w, false)))]);
    const admittedC = admittedIds(receipts.rows);
    for (const w of members) if (!admittedC.has(w.job.id)) fail(w, "Refresh publication claim lost");
    // The claimed state is still the queue's state only if nobody wrote it since the claim CAS (our fence aside).
    const row = receipts.rows[0];
    receiptRevision = row && Number(row.locked_revision) === claimRevision ? Number(row.fenced_revision ?? row.locked_revision) : undefined;
    // (D) The receipt join, read back and checked as `publishDraft` checks it.
    members = live();
    if (!members.length) return;
    const publications = await readPublications(db, members.map(w => w.draft!.id));
    for (const w of members) {
      const publication = publications.get(w.draft!.id), draft = w.draft!;
      if (!publication) fail(w, "Publication acknowledgement unavailable");
      else if (publication instanceof Error) fail(w, publication.message);
      else if (contentHash(publication.vintage) !== contentHash(draft) || publication.receipt.vintageId !== draft.id || publication.receipt.outputHash !== contentHash(draft) || publication.receipt.witness !== "committed_readback"
        || publication.receipt.evidenceClass !== draft.evidenceClass || instant(publication.receipt.confirmedAt) < instant(draft.generatedAt)) fail(w, "publication_readback_mismatch");
      else w.result = { state: "published", publication, reusedDraft: w.reused === true } as PreparedRunResult;
    }
  };
  const publishing = unresolved(w => !!w.payload);
  let uncertain = false;
  try { await publishGroup(publishing); }
  catch {
    // A statement error (or a lost response) never decides a peer's outcome: every unresolved key restarts at (A) on its
    // own, from the durable draft and receipt state, so one bad key fails alone and a committed write is recognised.
    uncertain = true;
    for (const w of unresolved(w => !!w.payload)) {
      try { await publishGroup([w]); } catch (error) { if (!w.result) fail(w, message(error, "prepared_issuance_failed")); }
    }
  }
  // After an uncertain statement the queue revision is unknown (a receipt may have fenced it): read it before the CAS.
  if (publishing.length) knownRevision = uncertain ? undefined : receiptRevision;

  // Acknowledgement: every job's outcome merged into one revision-checked queue save with its completion events.
  const completedAt = input.clock();
  let final: H10BatchResult["final"];
  for (let merge = 0; merge < mergeLimit; merge++) {
    const current = merge === 0 && knownRevision !== undefined ? { revision: knownRevision, state: claimed.state as object } : await store.loadQueue(queueId);
    const now = input.clock(), state = current && restoreRefreshState(current.state, bounds);
    let merged = state;
    const events: QueueHistoryRecord[] = [], acking: Work[] = [];
    for (const w of work) {
      const job = w.job, result = w.result!, live = state?.jobs.find(row => row.id === job.id);
      if (!current || !state || !merged || !live || live.status !== "running" || live.attempts !== job.attempts || live.startedAt !== job.startedAt || live.leaseUntil !== job.leaseUntil || instant(live.leaseUntil!) <= instant(now)
        || live.issuanceKey !== job.issuanceKey || live.lockAt !== job.lockAt || live.trigger !== job.trigger || contentHash(live.scope) !== contentHash(job.scope)) { w.ack = "stale_claim"; continue; }
      let completion: RefreshResult;
      if (result.state === "published") {
        const publication = result.publication;
        completion = { state: "published", vintageId: publication.vintage.id, confirmedAt: publication.receipt.confirmedAt,
          ...(instant(publication.receipt.confirmedAt) < instant(job.startedAt!) ? { recoveredPublication: publication } : {}) };
      } else completion = { state: result.state, reason: result.reason, retryable: result.state === "unavailable" ? result.retryable : true };
      const before = merged;
      merged = finishRefresh(merged, job.id, job.attempts, completion, completedAt, bounds, queueId);
      // A terminal acknowledgement failure is not evidence that publication was absent.
      if (result.state !== "published" && merged.jobs.find(row => row.id === job.id)!.status === "failed") {
        const draft = await store.getDraft(job.issuanceKey);
        const publication = draft && await store.get(draft.id);
        if (draft && publication) {
          if (contentHash(draft) !== contentHash(publication.vintage)) throw new Error("recovery_draft_receipt_mismatch");
          merged = recoverRefreshPublication(before, job.id, publication, now, bounds, queueId);
        }
      }
      if (result.state !== "published") {
        events.push(refreshEventRecord(eventSource, job, result.state === "unavailable" ? "unavailable" : "failed_attempt", result.reason, completedAt));
        const finished = merged.jobs.find(row => row.id === job.id)!;
        if (finished.status === "failed") events.push(refreshEventRecord(eventSource, job, "missing_refresh", finished.reason!, completedAt));
      }
      acking.push(w);
    }
    if (!acking.length || !current || !merged) break;
    try {
      const revision = await store.saveQueueWithRecords(queueId, current.revision, merged, events);
      for (const w of acking) w.ack = "saved";
      final = { revision, state: merged };
      break;
    } catch (error) {
      if (!revisionConflict(error)) throw error;
      for (const w of acking) w.ack = "revision_conflict";
    }
  }
  const results: PreparedBatchResult["jobs"] = [];
  for (const w of work) {
    const result = w.result!, acknowledgement = w.ack ?? "revision_conflict";
    // An executed failure remains an attempt fact even if its lease was subsequently lost.
    if (acknowledgement !== "saved" && result.state !== "published" && !["stale_refresh_claim", "stale_publication_claim", "Refresh publication claim lost"].includes(result.reason)) {
      const record = refreshEventRecord(eventSource, w.job, "failed_attempt", result.reason, completedAt);
      await store.appendRecord(record.id, record.kind, record.scopeKey, record.payload, record.predecessorId);
    }
    results.push({ jobId: w.job.id, attempt: w.job.attempts, result, acknowledgement });
  }
  return { state: "completed", jobs: results, ...(final ? { final } : {}) };
}
