import { PublishedVintage, PublicationReceipt, Vintage, assertId, assertVintage, instant } from "./contracts";
import { canonicalJson, scoringProfile } from "./identity";
import { contentHash } from "./hash.server";

export interface SqlConnection {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}
export type RecordKind = "opportunity" | "schedule" | "affiliation" | "horizon_episode" | "lock_epoch" | "history_event" | "qualification" | "outcome" | "evaluation" | "integrity_incident" | "exposure_receipt" | "read_context";
interface StoredVintage extends Record<string, unknown> { payload: string; output_hash: string; confirmed_at: Date | string | null; snapshot?: string }
interface HistoryCursor { playerId: number; gameId: number; snapshot: string; upper: [string, number, string]; after: [string, number, string] }
export interface HistoryPage { revisions: PublishedVintage[]; nextCursor: string | null }
export interface PublicationClaim { queueId: string; jobId: string; attempt: number }

function decoded(row: StoredVintage): PublishedVintage {
  const vintage = JSON.parse(row.payload) as Vintage;
  assertVintage(vintage);
  if (contentHash(vintage) !== row.output_hash || !row.confirmed_at) throw new Error("Corrupt or unpublished vintage");
  const confirmedAt = new Date(row.confirmed_at).toISOString();
  if (instant(confirmedAt) < instant(vintage.generatedAt)) throw new Error("Invalid publication clock");
  const receipt: PublicationReceipt = { id: `publication:${vintage.id}`, vintageId: vintage.id, outputHash: row.output_hash, confirmedAt, witness: "committed_readback", evidenceClass: vintage.evidenceClass };
  return { vintage, receipt };
}
function tuple(record: PublishedVintage): [string, number, string] { return [record.receipt.confirmedAt, record.vintage.sequence, record.vintage.id]; }
function parseCursor(cursor: string, playerId: number, gameId: number): HistoryCursor {
  if (cursor.length > 16384 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("Invalid history cursor");
  let value: HistoryCursor;
  try { value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")); } catch { throw new Error("Invalid history cursor"); }
  if (value.playerId !== playerId || value.gameId !== gameId) throw new Error("Cursor scope mismatch");
  if (typeof value.snapshot !== "string" || value.snapshot.length > 8192 || !/^\d+:\d+:(\d+(,\d+)*)?$/.test(value.snapshot)) throw new Error("Invalid history snapshot");
  for (const boundary of [value.upper, value.after]) {
    if (!Array.isArray(boundary) || boundary.length !== 3 || !Number.isSafeInteger(boundary[1]) || boundary[1] < 1 || typeof boundary[2] !== "string" || boundary[2].length > 200) throw new Error("Invalid cursor boundary");
    instant(boundary[0]);
  }
  return value;
}

/** Inject a server connection explicitly; this module never discovers credentials or opens a network. */
export class PostgresHistoryStore {
  constructor(private readonly db: SqlConnection) {}

  async reserveSequence(): Promise<number> {
    const { rows } = await this.db.query<{ sequence: string }>("select nextval('forge_v2_private.forge_v2_issuance_sequence')::text as sequence");
    const sequence = Number(rows[0]?.sequence);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("Issuance sequence exhausted");
    return sequence;
  }

  async publish(vintage: Vintage): Promise<PublishedVintage> {
    if (vintage.issuanceAttempt) throw new Error("Queue-stamped publication requires a current claim");
    return this.publishInternal(vintage);
  }
  async publishClaimed(vintage: Vintage, claim: PublicationClaim): Promise<PublishedVintage> {
    if (!claim.queueId || !claim.jobId || !Number.isSafeInteger(claim.attempt) || claim.attempt < 1) throw new Error("Invalid publication claim");
    if (!vintage.issuanceAttempt || vintage.issuanceAttempt.queueId !== claim.queueId || vintage.issuanceAttempt.jobId !== claim.jobId || vintage.issuanceAttempt.attempt > claim.attempt) throw new Error("Missing original issuance attempt");
    return this.publishInternal(vintage, claim);
  }
  private async publishInternal(vintage: Vintage, claim?: PublicationClaim): Promise<PublishedVintage> {
    assertVintage(vintage);
    if (canonicalJson(scoringProfile(vintage.scoring.weights)) !== canonicalJson(vintage.scoring)) throw new Error("Scoring identity mismatch");
    const payload = canonicalJson(vintage), hash = contentHash(vintage);
    // Each query must finish before the next. The DB also rejects same-transaction receipts.
    const guard = `with locked as (select state from forge_v2_private.forge_v2_work_queue where id=$7 for update),
      admitted as (select job from locked,jsonb_array_elements(state->'jobs') job where job->>'id'=$8 and (job->>'attempts')::int=$9
      and job->>'status'='running' and (job->>'leaseUntil')::timestamptz>clock_timestamp() and job->>'issuanceKey'=$2
      and (job->'scope'->>'playerId')::bigint=$4 and (job->'scope'->>'gameId')::bigint=$5)`;
    const values = [vintage.id, vintage.issuanceKey, vintage.sequence, vintage.playerId, vintage.gameId, payload, ...(claim ? [claim.queueId, claim.jobId, claim.attempt] : [])];
    const insertion = await this.db.query<{ admitted: number }>(claim
      ? `${guard}, inserted as (insert into forge_v2_private.forge_v2_vintages (id,issuance_key,issuance_sequence,player_id,game_id,payload)
        select $1,$2,$3,$4,$5,$6::text from admitted where ($6::text::jsonb->'issuanceAttempt'->>'attempt')::int=$9
        and $6::text::jsonb->'issuanceAttempt'->>'startedAt'=job->>'startedAt'
        on conflict do nothing returning id) select count(*)::int as admitted from admitted`
      : `insert into forge_v2_private.forge_v2_vintages (id,issuance_key,issuance_sequence,player_id,game_id,payload) values ($1,$2,$3,$4,$5,$6) on conflict do nothing`, values);
    if (claim && insertion.rows[0]?.admitted !== 1) throw new Error("Refresh publication claim lost");
    const committed = await this.db.query<{ id: string; output_hash: string }>("select id,output_hash from forge_v2_private.forge_v2_vintages where issuance_key=$1", [vintage.issuanceKey]);
    if (committed.rows[0]?.id !== vintage.id || committed.rows[0]?.output_hash !== hash) throw new Error("Idempotency conflict: issuance bytes changed");
    const receipt = claim ? await this.db.query<{ admitted: number }>(`${guard}, inserted as (
      insert into forge_v2_private.forge_v2_publication_receipts (vintage_id,output_hash,confirmed_at,witness)
      select $1,$10,clock_timestamp(),'committed_readback' from admitted where $3::bigint>0 and $6::text::jsonb->>'id'=$1 on conflict (vintage_id) do nothing returning vintage_id)
      select count(*)::int as admitted from admitted`, [...values, hash])
      : await this.db.query("insert into forge_v2_private.forge_v2_publication_receipts (vintage_id,output_hash,confirmed_at,witness) values ($1,$2,clock_timestamp(),'committed_readback') on conflict (vintage_id) do nothing", [vintage.id, hash]);
    if (claim && receipt.rows[0]?.admitted !== 1) throw new Error("Refresh publication claim lost");
    const result = await this.get(vintage.id);
    if (!result) throw new Error("Publication acknowledgement unavailable");
    return result;
  }

  async get(id: string): Promise<PublishedVintage | null> {
    const { rows } = await this.db.query<StoredVintage>(`select v.payload,v.output_hash,r.confirmed_at from forge_v2_private.forge_v2_vintages v
      join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id=v.id and r.output_hash=v.output_hash where v.id=$1`, [id]);
    return rows[0] ? decoded(rows[0]) : null;
  }

  async getDraft(issuanceKey: string): Promise<Vintage | null> {
    const { rows } = await this.db.query<{ payload: string; output_hash: string }>("select payload,output_hash from forge_v2_private.forge_v2_vintages where issuance_key=$1", [issuanceKey]);
    if (!rows[0]) return null;
    const vintage = JSON.parse(rows[0].payload) as Vintage;
    assertVintage(vintage);
    if (contentHash(vintage) !== rows[0].output_hash) throw new Error("Corrupt stored draft");
    return vintage;
  }

  async history(playerId: number, gameId: number, limit = 100, cursor?: string): Promise<HistoryPage> {
    assertId(playerId); assertId(gameId);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new Error("History page must contain 1–200 rows");
    let upper: HistoryCursor["upper"], snapshot: string, after: HistoryCursor["after"] | null = null;
    if (cursor) ({ upper, after, snapshot } = parseCursor(cursor, playerId, gameId));
    else {
      const { rows } = await this.db.query<StoredVintage>(`select v.payload,v.output_hash,r.confirmed_at,pg_current_snapshot()::text as snapshot from forge_v2_private.forge_v2_vintages v
        join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id=v.id where v.player_id=$1 and v.game_id=$2
        order by r.confirmed_at desc,v.issuance_sequence desc,v.id desc limit 1`, [playerId, gameId]);
      if (!rows.length) return { revisions: [], nextCursor: null };
      upper = tuple(decoded(rows[0]));
      snapshot = rows[0].snapshot!;
      if (snapshot.length > 8192) throw new Error("History snapshot capacity exceeded");
    }
    const { rows } = await this.db.query<StoredVintage>(`select v.payload,v.output_hash,r.confirmed_at from forge_v2_private.forge_v2_vintages v
      join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id=v.id and r.output_hash=v.output_hash
      where v.player_id=$1 and v.game_id=$2 and (r.confirmed_at,v.issuance_sequence,v.id)<=($3::timestamptz,$4::bigint,$5)
      and pg_visible_in_snapshot(r.receipt_transaction,$7::pg_snapshot)
      ${after ? "and (r.confirmed_at,v.issuance_sequence,v.id)>($8::timestamptz,$9::bigint,$10)" : ""}
      order by r.confirmed_at,v.issuance_sequence,v.id limit $6`, [playerId, gameId, ...upper, limit + 1, snapshot, ...(after ?? [])]);
    const revisions = rows.slice(0, limit).map(decoded);
    return { revisions, nextCursor: rows.length > limit ? Buffer.from(canonicalJson({ playerId, gameId, snapshot, upper, after: tuple(revisions[revisions.length - 1]) })).toString("base64url") : null };
  }

  async appendRecord(id: string, kind: RecordKind, scopeKey: string, payload: object, predecessorId: string | null = null): Promise<void> {
    if (!id.trim() || !scopeKey.trim()) throw new Error("Record identity required");
    const bytes = canonicalJson(payload);
    await this.db.query(`insert into forge_v2_private.forge_v2_records (id,kind,scope_key,predecessor_id,payload) values ($1,$2,$3,$4,$5) on conflict (id) do nothing`, [id, kind, scopeKey, predecessorId, bytes]);
    const { rows } = await this.db.query<{ kind: string; scope_key: string; predecessor_id: string | null; content_hash: string }>("select kind,scope_key,predecessor_id,content_hash from forge_v2_private.forge_v2_records where id=$1", [id]);
    if (rows[0]?.content_hash !== contentHash(payload) || rows[0]?.kind !== kind || rows[0]?.scope_key !== scopeKey || rows[0]?.predecessor_id !== predecessorId) throw new Error("Immutable record identity conflict");
  }

  async records(scopeKey: string, kind: RecordKind, afterOrdinal = 0, limit = 100): Promise<Array<{ id: string; ordinal: number; payload: object; predecessorId: string | null }>> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(afterOrdinal) || afterOrdinal < 0) throw new Error("Invalid record page");
    const { rows } = await this.db.query<{ id: string; ordinal: string; payload: string; predecessor_id: string | null; content_hash: string }>("select id,ordinal::text,payload,predecessor_id,content_hash from forge_v2_private.forge_v2_records where scope_key=$1 and kind=$2 and ordinal>$3 order by ordinal limit $4", [scopeKey, kind, afterOrdinal, limit]);
    return rows.map(row => {
      const payload = JSON.parse(row.payload), ordinal = Number(row.ordinal);
      if (contentHash(payload) !== row.content_hash || !Number.isSafeInteger(ordinal)) throw new Error("Corrupt scientific record");
      return { id: row.id, ordinal, payload, predecessorId: row.predecessor_id };
    });
  }

  async saveQueue(id: string, expectedRevision: number, state: object): Promise<number> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("Invalid queue revision");
    const { rows } = expectedRevision === 0
      ? await this.db.query<{ revision: string }>("insert into forge_v2_private.forge_v2_work_queue (id,state) values ($1,$2::jsonb) on conflict (id) do nothing returning revision::text", [id, canonicalJson(state)])
      : await this.db.query<{ revision: string }>("update forge_v2_private.forge_v2_work_queue set state=$3::jsonb,revision=revision+1,updated_at=clock_timestamp() where id=$1 and revision=$2 returning revision::text", [id, expectedRevision, canonicalJson(state)]);
    if (!rows[0]) throw new Error("Queue revision conflict");
    return Number(rows[0].revision);
  }
  async loadQueue(id: string): Promise<{ revision: number; state: object } | null> {
    const { rows } = await this.db.query<{ revision: string; state: object }>("select revision::text,state from forge_v2_private.forge_v2_work_queue where id=$1", [id]);
    return rows[0] ? { revision: Number(rows[0].revision), state: rows[0].state } : null;
  }
}
