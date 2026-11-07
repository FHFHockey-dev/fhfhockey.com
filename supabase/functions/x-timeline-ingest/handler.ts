// The x-timeline-ingest request handler, after auth and validation (index.ts). Import-free (Deno needs .ts import
// paths, web's tsc rejects them): index.ts passes the poller's mapper, the twscrape converter and the shared store, so
// web/ Vitest can run this exact code path against a fake database.
//
// Shadow ("observe", and "anchors") writes only x_timeline_twscrape_observations and calls its prune RPC. It never
// touches x_timeline_shadow_posts, the line queues or social_share_x_posts. Live "ingest" is refused unless liveEnabled.

// deno-lint-ignore no-explicit-any
type Db = { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };
type Account = { sourceKey: string; handle: string };
type Row = { tweet_id: string; raw_payload: Record<string, unknown> };
type Request =
  | { mode: "health" }
  | { mode: "anchors" }
  | { mode: "ingest"; sourceKey: string; tweets: unknown[] }
  | { mode: "observe"; sourceKey: string; tweets: unknown[]; runId: string };

export const OBSERVATIONS_TABLE = "x_timeline_twscrape_observations";
export const RETENTION_DAYS = 14; // TJ pop-up 2026-11-07.

export type IngestDeps<A extends Account, R extends Row> = {
  db: Db;
  accounts: A[];
  liveEnabled: boolean;
  mapFeed: (account: A, body: unknown) => R[];
  feedBody: (tweets: unknown, handle: string) => unknown;
  toObservationRows: (rows: R[], runId: string) => Record<string, unknown>[];
  newestId: (ids: Array<string | null | undefined>) => string | null;
  // deno-lint-ignore no-explicit-any
  switchedAtFor: (db: Db, sourceKey: string) => Promise<{ switchedAt: string | null; error?: string }>;
  // deno-lint-ignore no-explicit-any
  storeAndEnqueue: (db: Db, account: A, rows: R[], switchedAt: string | null) => Promise<Record<string, any>>;
};

export type IngestResponse = { status: number; body: Record<string, unknown> };

export async function handleIngest<A extends Account, R extends Row>(
  request: Request, deps: IngestDeps<A, R>,
): Promise<IngestResponse> {
  const { db } = deps;

  if (request.mode === "health") {
    const health = await db.rpc("x_timeline_account_health", {});
    if (health.error) return { status: 500, body: { ok: false, error: "Health check failed" } };
    return { status: 200, body: { ok: true, accounts: health.data ?? [] } };
  }

  if (request.mode === "anchors") {
    // Retention runs here, once per job run: rows older than RETENTION_DAYS, at most 1,000 a call (the RPC bounds it).
    const pruned = await db.rpc("x_timeline_twscrape_observations_prune", { p_days: RETENTION_DAYS });
    // The newest timeline entries are first observed in the latest runs, so the 100 most recent observations hold it.
    const anchors: Record<string, string | null> = {};
    for (const account of deps.accounts) {
      const recent = await db.from(OBSERVATIONS_TABLE).select("timeline_id").eq("source_key", account.sourceKey)
        .order("first_observed_at", { ascending: false }).limit(100);
      if (recent.error) return { status: 500, body: { ok: false, error: recent.error.code ?? "anchors_failed" } };
      anchors[account.sourceKey] = deps.newestId((recent.data ?? []).map((row: { timeline_id: string }) => row.timeline_id));
    }
    return pruned.error
      ? { status: 500, body: { ok: false, anchors, error: pruned.error.code ?? "prune_failed" } }
      : { status: 200, body: { ok: true, anchors, pruned: pruned.data ?? 0 } };
  }

  const account = deps.accounts.find((candidate) => candidate.sourceKey === request.sourceKey);
  if (!account) return { status: 400, body: { ok: false, error: "Unknown sourceKey" } };

  if (request.mode === "observe") {
    const rows = deps.mapFeed(account, deps.feedBody(request.tweets, account.handle));
    // One row per (source_key, tweet_id): the mapper drops repeats within a page, the primary key and
    // ignoreDuplicates drop repeats across runs and the paging overlap. First observation wins.
    const stored = rows.length
      ? await db.from(OBSERVATIONS_TABLE)
        .upsert(deps.toObservationRows(rows, request.runId), { onConflict: "source_key,tweet_id", ignoreDuplicates: true })
        .select("tweet_id")
      : { data: [], error: null };
    const summary = { sourceKey: account.sourceKey, via: "twscrape", mode: "observe", received: request.tweets.length,
      mapped: rows.length };
    return stored.error
      ? { status: 500, body: { ok: false, ...summary, inserted: 0, error: stored.error.code ?? "observe_failed" } }
      : { status: 200, body: { ok: true, ...summary, inserted: stored.data?.length ?? 0 } };
  }

  if (!deps.liveEnabled) return { status: 403, body: { ok: false, error: "Live ingest is disabled (shadow mode)" } };
  const rows = deps.mapFeed(account, deps.feedBody(request.tweets, account.handle));
  const provider = await deps.switchedAtFor(db, account.sourceKey);
  if (provider.error) {
    // As in the poller: without the switch we cannot tell whether to queue, so store only and report it.
    const stored = await deps.storeAndEnqueue(db, account, rows, null);
    return { status: 207, body: { sourceKey: account.sourceKey, providers: "unavailable", ...stored, ok: false } };
  }
  const result = await deps.storeAndEnqueue(db, account, rows, provider.switchedAt);
  return { status: result.ok ? 200 : 207,
    body: { sourceKey: account.sourceKey, via: "twscrape", received: request.tweets.length, ...result } };
}
