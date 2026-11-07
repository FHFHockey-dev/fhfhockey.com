// Store a batch of shadow rows and queue the due ones for a switched account: the poller's upsert plus
// enqueueSwitched (x-timeline-poll/index.ts), shared so the layer-3 ingest function (x-timeline-ingest) writes exactly
// what the poller writes. Import-free (Deno needs .ts import paths, web's tsc rejects them): the caller passes the
// poller's queue mapping from fxtwitter.ts (`import * as fx from "../x-timeline-poll/fxtwitter.ts"`), and `db` is a
// supabase-js client typed structurally, so web/ Vitest can load it.

// deno-lint-ignore no-explicit-any
type Db = { from: (table: string) => any };
type Account = { sourceKey: string };
type Row = { tweet_id: string };
type QueueTable = "line_source_ifttt_events" | "lines_ccc_ifttt_events";

/** The three fxtwitter.ts functions the store needs. */
export type QueueMapping<A extends Account, R extends Row> = {
  queueTableFor: (account: A) => QueueTable | null;
  rowsToEnqueue: (rows: R[], firstSeen: Array<{ tweet_id: string; first_seen_at: string }>, switchedAt: string) => R[];
  toQueueRow: (row: R, table: QueueTable, firstSeenAt?: string | null) => Record<string, unknown>;
};

export type StoreResult = {
  ok: boolean;
  seen: number;
  inserted: number;
  enqueued?: number;
  error?: string;
  enqueueError?: string;
};

/** The account's provider switch time when it is set to 'fxtwitter', from tweet_intake_providers; null otherwise. */
export async function switchedAtFor(db: Db, sourceKey: string): Promise<{ switchedAt: string | null; error?: string }> {
  const { data, error } = await db.from("tweet_intake_providers").select("provider, switched_at")
    .eq("source_key", sourceKey).maybeSingle();
  if (error) return { switchedAt: null, error: error.code ?? "providers_failed" };
  return { switchedAt: data?.provider === "fxtwitter" ? data.switched_at : null };
}

/**
 * Upsert rows into x_timeline_shadow_posts (first sighting wins), then, for an account switched at `switchedAt`, put
 * the rows first seen at or after the switch into its live queue (the queue upsert ignores rows already queued).
 */
export async function storeAndEnqueue<A extends Account, R extends Row>(
  db: Db, fx: QueueMapping<A, R>, account: A, rows: R[], switchedAt: string | null | undefined,
): Promise<StoreResult> {
  const table = fx.queueTableFor(account);
  if (!rows.length) return { ok: true, seen: 0, inserted: 0, ...(table && switchedAt ? { enqueued: 0 } : {}) };
  const stored = await db.from("x_timeline_shadow_posts")
    .upsert(rows, { onConflict: "source_key,tweet_id", ignoreDuplicates: true })
    .select("tweet_id");
  if (stored.error) return { ok: false, seen: rows.length, inserted: 0, error: stored.error.code ?? "store_failed" };
  const inserted = stored.data?.length ?? 0;

  if (!table || !switchedAt) return { ok: true, seen: rows.length, inserted };
  const seen = await db.from("x_timeline_shadow_posts").select("tweet_id, first_seen_at")
    .eq("source_key", account.sourceKey).in("tweet_id", rows.map((row) => row.tweet_id));
  if (seen.error) {
    return { ok: false, seen: rows.length, inserted, enqueued: 0, enqueueError: seen.error.code ?? "first_seen_failed" };
  }
  // Carry each post's first sighting into the queue row (raw_payload.first_seen_at) for the Lines engine.
  const firstSeen = new Map<string, string>((seen.data ?? []).map((entry: { tweet_id: string; first_seen_at: string }) =>
    [entry.tweet_id, entry.first_seen_at]));
  const due = fx.rowsToEnqueue(rows, seen.data ?? [], switchedAt)
    .map((row) => fx.toQueueRow(row, table, firstSeen.get(row.tweet_id) ?? null));
  if (!due.length) return { ok: true, seen: rows.length, inserted, enqueued: 0 };
  const queued = await db.from(table)
    .upsert(due, { onConflict: table === "lines_ccc_ifttt_events" ? "tweet_id" : "source_key,tweet_id", ignoreDuplicates: true })
    .select("id");
  return queued.error
    ? { ok: false, seen: rows.length, inserted, enqueued: 0, enqueueError: queued.error.code ?? "enqueue_failed" }
    : { ok: true, seen: rows.length, inserted, enqueued: queued.data?.length ?? 0 };
}
