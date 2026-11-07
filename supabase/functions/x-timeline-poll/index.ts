// Polls FxTwitter's public profile feed for the tracked X accounts and stores new posts and reposts in
// x_timeline_shadow_posts. No X login and no Twitter API. Called by pg_cron (see schedule.sql) with the
// x-fhfh-poll-secret header, which must match Vault's x_timeline_poll_secret (checked by the
// x_timeline_poll_secret_matches RPC); every other caller gets 401. Accounts are read one at a time: 7 to 21
// requests a run.
// Safety net (tasks/artifacts/x-intake-safety-net-design-2026-11-06.md): a miss on public FxTwitter goes to TJ's
// self-hosted FxEmbed mirror when the FXTWITTER_MIRROR_BASE secret is set (layer 2), and after an outage older pages are
// read back to the last stored post (gap recovery). Layer 3 (twscrape on TJ's Pi) writes through x-timeline-ingest.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.89.0";
import * as fx from "./fxtwitter.ts";
import {
  isRepostWrapper,
  mapFxProfileFeed,
  mapFxWrappedRepost,
  POLLED_ACCOUNTS,
} from "./fxtwitter.ts";
import { fetchFxChain, fxSourcePlan, profileStatusesPath, statusPath } from "../_shared/fxSources.ts";
import { recoverGap } from "../_shared/fxGapRecovery.ts";
import { storeAndEnqueue } from "../_shared/xTimelineStore.ts";
import { matchPostedCard } from "../_shared/socialShareCard.ts";

const RUN_BUDGET_MS = 100_000; // Well inside the edge runtime's wall-clock limit.
const GAP_PAGES_PER_RUN = 16; // Older pages a run may read across all accounts, so one outage cannot use the budget.
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
  const plan = fxSourcePlan(Deno.env.get("FXTWITTER_MIRROR_BASE"));
  // Cutover switch (migration tweet_intake_providers): accounts set to 'fxtwitter' also get pending rows in their live
  // queue. Unreadable or missing (before the migration is applied) means every account stays on IFTTT: shadow only.
  const providers = await db.from("tweet_intake_providers").select("source_key, provider, switched_at");
  const switchedAt = new Map<string, string>();
  for (const row of providers.error ? [] : providers.data ?? []) {
    if (row.provider === "fxtwitter") switchedAt.set(row.source_key, row.switched_at);
  }
  const results = [];
  let gapPagesLeft = GAP_PAGES_PER_RUN;
  for (const account of POLLED_ACCOUNTS) {
    const feed = await fetchFxChain(profileStatusesPath(account.handle), plan, { deadline });
    if (!feed.body) {
      results.push({ sourceKey: account.sourceKey, ok: false, status: feed.status, attempts: feed.attempts });
      continue;
    }
    // After an outage the page may not reach the last stored post: read older pages back to it.
    const gap = await recoverGap({
      firstBody: feed.body, firstRows: mapFxProfileFeed(account, feed.body),
      mapPage: (body) => mapFxProfileFeed(account, body),
      lookupStored: (ids) => lookupStored(db, account.sourceKey, ids),
      fetchPage: async (cursor) =>
        (await fetchFxChain(profileStatusesPath(account.handle, cursor), plan, { deadline })).body,
      // Past half the run budget, stop paging (the gap is abandoned, page 1 still stored): later accounts get their reads.
      pageBudget: Date.now() > deadline - RUN_BUDGET_MS / 2 ? 0 : gapPagesLeft,
    });
    gapPagesLeft = Math.max(0, gapPagesLeft - gap.extraPages);
    let rows = gap.rows;
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
          const status = known.error ? null : await fetchFxChain(statusPath(row.tweet_id), plan, { deadline });
          const original = status?.body ? mapFxWrappedRepost(account, row, status.body) : null;
          if (original) hydrated++;
          next.push(original ?? row);
        }
      }
      rows = next;
    }
    const stored = await storeAndEnqueue(db, fx, account, rows, switchedAt.get(account.sourceKey));
    // FHFHockey switched to the scraper: its own media posts go to social_share_x_posts, as IFTTT's "New photo or video
    // by you" did. tweet_id is the key and the first write wins, so posts IFTTT already stored keep their rows.
    const social = stored.ok && switchedAt.has(account.sourceKey)
      ? await storeSocialShare(db, rows.map((row) => fx.toSocialShareRow(account, row, matchPostedCard))
        .filter((row): row is Record<string, unknown> => row !== null))
      : null;
    results.push({ sourceKey: account.sourceKey, attempts: feed.attempts, via: feed.via, hydrated, ...stored,
      ...(social ? { socialWritten: social.written, ...(social.error ? { ok: false, socialError: social.error } : {}) } : {}),
      ...(gap.state === "none" ? {} : { gap: gap.state, gapPages: gap.extraPages }) });
  }
  // A missing switch table (migration not applied: 42P01 / PGRST205) is expected; any other failure to read it is
  // reported, because a switched account's IFTTT deliveries are being dropped while this run cannot enqueue for it.
  const providerState = !providers.error ? "ok"
    : ["42P01", "PGRST205"].includes(providers.error.code ?? "") ? "not_installed" : "unavailable";
  const ok = providerState !== "unavailable" && results.every((result) => result.ok);
  return Response.json({ ok, providers: providerState, results }, { status: ok ? 200 : 207 });
});

/** Upsert social-share rows on tweet_id, ignoring ones already stored; `written` counts only new rows. */
async function storeSocialShare(db: SupabaseClient, rows: Record<string, unknown>[]) {
  if (!rows.length) return { written: 0 };
  const { data, error } = await db.from("social_share_x_posts")
    .upsert(rows, { onConflict: "tweet_id", ignoreDuplicates: true }).select("tweet_id");
  return error ? { written: 0, error: error.code ?? "social_store_failed" } : { written: data?.length ?? 0 };
}

/** Which of these ids (post ids or wrapper ids) are stored for the account, and whether it has any stored post. */
async function lookupStored(db: SupabaseClient, sourceKey: string, ids: string[]) {
  const stored = new Set<string>();
  const list = ids.filter((id) => /^\d+$/.test(id)).join(",");
  if (list) {
    const known = await db.from("x_timeline_shadow_posts").select("tweet_id, wrapper:raw_payload->>repost_wrapper_id")
      .eq("source_key", sourceKey).or(`tweet_id.in.(${list}),raw_payload->>repost_wrapper_id.in.(${list})`);
    if (known.error) return null;
    for (const row of known.data ?? []) {
      stored.add(row.tweet_id);
      if (typeof row.wrapper === "string") stored.add(row.wrapper);
    }
  }
  if (stored.size) return { stored, hasHistory: true };
  const any = await db.from("x_timeline_shadow_posts").select("tweet_id").eq("source_key", sourceKey).limit(1);
  return any.error ? null : { stored, hasHistory: (any.data ?? []).length > 0 };
}
