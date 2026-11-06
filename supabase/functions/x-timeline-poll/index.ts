// Polls FxTwitter's public profile feed for the tracked X accounts and stores new posts and reposts in
// x_timeline_shadow_posts. No X login and no Twitter API. Called by pg_cron (see schedule.sql) with the
// x-fhfh-poll-secret header, which must match Vault's x_timeline_poll_secret (checked by the
// x_timeline_poll_secret_matches RPC); every other caller gets 401. Accounts are read one at a time: 7 to 21
// requests a run.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.89.0";
import {
  type PolledAccount,
  type ShadowPostRow,
  fetchFxProfileFeed,
  fetchFxStatus,
  isRepostWrapper,
  mapFxProfileFeed,
  mapFxWrappedRepost,
  POLLED_ACCOUNTS,
  queueTableFor,
  rowsToEnqueue,
  toQueueRow,
} from "./fxtwitter.ts";

const RUN_BUDGET_MS = 100_000; // Well inside the edge runtime's wall-clock limit.
const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

Deno.serve(async (req) => {
  const secret = req.headers.get("x-fhfh-poll-secret");
  if (req.method !== "POST" || !secret || secret.length > 128) return unauthorized();

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const auth = await db.rpc("x_timeline_poll_secret_matches", { p_secret: secret });
  if (auth.error) return Response.json({ ok: false, error: "Auth check failed" }, { status: 500 });
  if (auth.data !== true) return unauthorized();
  const deadline = Date.now() + RUN_BUDGET_MS;
  // Cutover switch (migration tweet_intake_providers): accounts set to 'fxtwitter' also get pending rows in their live
  // queue. Unreadable or missing (before the migration is applied) means every account stays on IFTTT: shadow only.
  const providers = await db.from("tweet_intake_providers").select("source_key, provider, switched_at");
  const switchedAt = new Map<string, string>();
  for (const row of providers.error ? [] : providers.data ?? []) {
    if (row.provider === "fxtwitter") switchedAt.set(row.source_key, row.switched_at);
  }
  const results = [];
  for (const account of POLLED_ACCOUNTS) {
    const feed = await fetchFxProfileFeed(account, { deadline });
    if (!feed.body) {
      results.push({ sourceKey: account.sourceKey, ok: false, status: feed.status, attempts: feed.attempts });
      continue;
    }
    let rows = mapFxProfileFeed(account, feed.body);
    let hydrated = 0;
    const wrapperIds = rows.filter((row) => isRepostWrapper(account, row)).map((row) => row.tweet_id);
    if (wrapperIds.length) {
      // A wrapper repost stays on the page for hours: look up its original once, when it is new. Ids are digits only.
      const list = wrapperIds.join(",");
      const known = await db.from("x_timeline_shadow_posts").select("tweet_id, wrapper:raw_payload->>repost_wrapper_id")
        .eq("source_key", account.sourceKey).or(`tweet_id.in.(${list}),raw_payload->>repost_wrapper_id.in.(${list})`);
      const stored = new Set((known.data ?? []).flatMap((row) => [row.tweet_id, row.wrapper as string | null]));
      const next = [];
      for (const row of rows) {
        if (!isRepostWrapper(account, row)) next.push(row);
        else if (known.error || !stored.has(row.tweet_id)) {
          // On a failed lookup, store the wrapper as it is: truncated, but with the nested handle.
          const status = known.error ? null : await fetchFxStatus(row.tweet_id, { deadline });
          const original = status?.body ? mapFxWrappedRepost(account, row, status.body) : null;
          if (original) hydrated++;
          next.push(original ?? row);
        }
      }
      rows = next;
    }
    const { data, error } = rows.length
      ? await db.from("x_timeline_shadow_posts")
        .upsert(rows, { onConflict: "source_key,tweet_id", ignoreDuplicates: true })
        .select("tweet_id")
      : { data: [], error: null };
    if (error) {
      results.push({ sourceKey: account.sourceKey, ok: false, attempts: feed.attempts, seen: rows.length, error: error.code ?? "store_failed" });
      continue;
    }
    const queue = await enqueueSwitched(db, account, rows, switchedAt.get(account.sourceKey));
    results.push({ sourceKey: account.sourceKey, ok: !queue?.error, attempts: feed.attempts, seen: rows.length, hydrated,
      inserted: data?.length ?? 0, ...(queue ? { enqueued: queue.enqueued, ...(queue.error ? { enqueueError: queue.error } : {}) } : {}) });
  }
  // A missing switch table (migration not applied: 42P01 / PGRST205) is expected; any other failure to read it is
  // reported, because a switched account's IFTTT deliveries are being dropped while this run cannot enqueue for it.
  const providerState = !providers.error ? "ok"
    : ["42P01", "PGRST205"].includes(providers.error.code ?? "") ? "not_installed" : "unavailable";
  const ok = providerState !== "unavailable" && results.every((result) => result.ok);
  return Response.json({ ok, providers: providerState, results }, { status: ok ? 200 : 207 });
});

/**
 * For an account switched to fxtwitter, the page's posts first seen at or after the switch become pending rows in its
 * live queue (same shape as the IFTTT receiver). The whole due set is re-sent each run and the upsert ignores rows
 * already queued, so a failed run is retried while the post is still on the page. Null when the account is not switched.
 */
async function enqueueSwitched(
  db: SupabaseClient, account: PolledAccount, rows: ShadowPostRow[], switchedAt: string | undefined,
): Promise<{ enqueued: number; error?: string } | null> {
  const table = queueTableFor(account);
  if (!table || !switchedAt) return null;
  if (!rows.length) return { enqueued: 0 };
  const seen = await db.from("x_timeline_shadow_posts").select("tweet_id, first_seen_at")
    .eq("source_key", account.sourceKey).in("tweet_id", rows.map((row) => row.tweet_id));
  if (seen.error) return { enqueued: 0, error: seen.error.code ?? "first_seen_failed" };
  const due = rowsToEnqueue(rows, seen.data ?? [], switchedAt).map((row) => toQueueRow(row, table));
  if (!due.length) return { enqueued: 0 };
  const { data, error } = await db.from(table)
    .upsert(due, { onConflict: table === "lines_ccc_ifttt_events" ? "tweet_id" : "source_key,tweet_id", ignoreDuplicates: true })
    .select("id");
  return error ? { enqueued: 0, error: error.code ?? "enqueue_failed" } : { enqueued: data?.length ?? 0 };
}
