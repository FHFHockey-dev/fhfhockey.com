// IFTTT → FxTwitter cutover, phase P1 (see tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/
// IFTTT-TO-FXTWITTER-CUTOVER/DEBRIEF.md §7). Read-only: pairs each x_timeline_shadow_posts row with the IFTTT queue row
// for the same post, runs the same parser on both inputs (production's interpretation path), and reports where the
// scraper's input changes the result: type/category, players, line slots, repost attribution and quotes. Writes nothing
// to the database.
//
//   NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
//     scripts/x-timeline-parity-replay.ts [--since=2026-11-06T01:30:00Z] [--output=path.json]
import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "node:fs";

import {
  POLLED_ACCOUNTS,
  queueTableFor,
  toQueueRow,
  type ShadowPostRow,
} from "../../supabase/functions/x-timeline-poll/fxtwitter";
import { pairShadowWithIfttt, type PairableIfttt, type PairableShadow } from "../lib/sources/xTimelinePairing";

loadEnvConfig(process.cwd());
process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED = "true"; // Production's parse path.
const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const SINCE = argument("since") ?? "2026-11-06T01:30:00Z"; // The shadow's first run was 01:32 UTC.

type Row = Record<string, any>;

async function pages(query: (from: number) => PromiseLike<{ data: Row[] | null; error: unknown }>) {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function main() {
  const { getServiceRoleClient } = await import("../lib/supabase/server");
  const { parseTweetForTrainer, extractionFromParse, compareExtraction } = await import("../lib/sources/tweetSwipeTrainer");
  const { loadTrainerContext } = await import("../lib/sources/tweetSwipeTrainerServer");
  const { buildLinesCccSourceFromIftttEvent } = await import("../lib/sources/linesCccIngestion");
  const { tweetClaimAttribution } = await import("../lib/sources/tweetSourceDirectory");
  const { quotedTweetFromFxtwitterPayload } = await import("../lib/sources/fxtwitterQueuePayload");
  const db = getServiceRoleClient() as any;

  const queueAccounts = POLLED_ACCOUNTS.filter((account) => queueTableFor(account));
  const shadow = await pages((from) => db.from("x_timeline_shadow_posts").select("*")
    .in("source_key", queueAccounts.map((account) => account.sourceKey)).order("first_seen_at").range(from, from + 999));
  const lineSource = await pages((from) => db.from("line_source_ifttt_events")
    .select("id, source, source_group, source_key, source_account, username, text, link_to_tweet, tweet_id, tweet_created_at, created_at_label, raw_payload, received_at")
    .gte("received_at", SINCE).eq("source", "ifttt").order("received_at").range(from, from + 999));
  const ccc = await pages((from) => db.from("lines_ccc_ifttt_events")
    .select("id, source, source_account, username, text, link_to_tweet, tweet_id, tweet_created_at, created_at_label, raw_payload, received_at")
    .gte("received_at", SINCE).eq("source", "ifttt").order("received_at").range(from, from + 999));
  const ifttt: Row[] = [...lineSource, ...ccc.map((row): Row => ({ ...row, source_key: "ccc" }))];

  // Pair: own posts by tweet id; reposts (IFTTT keys them by the wrapper id) by RT handle and the start of the text.
  const { pairs, unpairedShadow, unpairedIfttt } = pairShadowWithIfttt(
    shadow as Array<Row & PairableShadow>, ifttt as Array<Row & PairableIfttt>);

  const results: Row[] = [];
  for (const pair of pairs) {
    const account = POLLED_ACCOUNTS.find((item) => item.sourceKey === pair.shadow.source_key)!;
    const queued = toQueueRow(pair.shadow as ShadowPostRow, queueTableFor(account)!) as Row;
    const publishedAt = pair.shadow.tweet_created_at ?? pair.ifttt.tweet_created_at ?? pair.ifttt.received_at;
    const context = await loadTrainerContext(db, publishedAt);
    const parse = (text: string) => parseTweetForTrainer({
      input: { text, handles: [account.handle, account.handle], publishedAt, hasMedia: Boolean(pair.shadow.has_media) },
      teams: context.teams, rosterByTeam: context.rosterByTeam,
    });
    const iftttParse = parse(pair.ifttt.text ?? "");
    const shadowParse = parse(queued.text ?? "");
    const comparison = compareExtraction(extractionFromParse(iftttParse), extractionFromParse(shadowParse));
    const attribution = (event: Row) => {
      const source = buildLinesCccSourceFromIftttEvent({ event: { ...event, id: event.id ?? "replay", received_at: event.received_at ?? publishedAt } as any,
        snapshotDate: String(publishedAt).slice(0, 10), teams: context.teams, rosterByTeam: context.rosterByTeam });
      const result = tweetClaimAttribution(source) as Row;
      return { relationship: result.relationship, original: result.original?.handle ?? null };
    };
    results.push({
      sourceKey: pair.shadow.source_key, postKind: pair.shadow.post_kind, pairedBy: pair.by,
      shadowTweetId: pair.shadow.tweet_id, iftttTweetId: pair.ifttt.tweet_id,
      iftttTextLength: (pair.ifttt.text ?? "").length, shadowTextLength: (queued.text ?? "").length,
      iftttTruncated: /…\s*(https?:\/\/\S+\s*)?$/.test(pair.ifttt.text ?? ""),
      ifttt: { type: iftttParse.type, category: iftttParse.category, subcategory: iftttParse.subcategory, team: iftttParse.teamAbbreviation,
        players: extractionFromParse(iftttParse).players.length, confidence: iftttParse.confidence.score },
      shadow: { type: shadowParse.type, category: shadowParse.category, subcategory: shadowParse.subcategory, team: shadowParse.teamAbbreviation,
        players: extractionFromParse(shadowParse).players.length, confidence: shadowParse.confidence.score },
      comparison,
      attribution: { ifttt: attribution(pair.ifttt), shadow: attribution({ ...queued, id: "shadow" }) },
      shadowQuote: Boolean(quotedTweetFromFxtwitterPayload(queued.raw_payload)),
      iftttText: (pair.ifttt.text ?? "").slice(0, 280), shadowText: (queued.text ?? "").slice(0, 280),
    });
  }

  const count = (predicate: (result: Row) => boolean) => results.filter(predicate).length;
  const summary = {
    since: SINCE,
    shadowRows: shadow.length, iftttRows: ifttt.length, pairs: results.length,
    pairedByTweetId: count((r) => r.pairedBy === "tweet_id"), pairedByRtText: count((r) => r.pairedBy === "rt_text"),
    unpairedShadow: unpairedShadow.length, unpairedIfttt: unpairedIfttt.length,
    identicalExtraction: count((r) => r.comparison.correct),
    typeDiffers: count((r) => !r.comparison.typeMatch), categoryDiffers: count((r) => !r.comparison.categoryMatch),
    playersDiffer: count((r) => !r.comparison.playersMatch), slotsDiffer: count((r) => !r.comparison.slotsMatch),
    iftttTruncated: count((r) => r.iftttTruncated),
    shadowMorePlayers: count((r) => r.shadow.players > r.ifttt.players), shadowFewerPlayers: count((r) => r.shadow.players < r.ifttt.players),
    repostsCreditedIfttt: count((r) => r.postKind === "repost" && r.attribution.ifttt.relationship === "retweet"),
    repostsCreditedShadow: count((r) => r.postKind === "repost" && r.attribution.shadow.relationship === "retweet"),
    reposts: count((r) => r.postKind === "repost"),
    quotes: count((r) => r.postKind === "quote"), quotesCarried: count((r) => r.postKind === "quote" && r.shadowQuote),
    byAccount: Object.fromEntries(queueAccounts.map((account) => [account.sourceKey, {
      pairs: count((r) => r.sourceKey === account.sourceKey),
      identical: count((r) => r.sourceKey === account.sourceKey && r.comparison.correct),
      unpairedShadow: unpairedShadow.filter((row) => row.source_key === account.sourceKey).length,
      unpairedIfttt: unpairedIfttt.filter((row) => row.source_key === account.sourceKey).length,
    }])),
  };
  console.log(JSON.stringify(summary, null, 2));
  const output = argument("output");
  if (output) {
    writeFileSync(output, JSON.stringify({
      generatedAt: new Date().toISOString(), summary, results,
      unpairedShadow: unpairedShadow.map((row) => ({ sourceKey: row.source_key, tweetId: row.tweet_id, postKind: row.post_kind,
        firstSeenAt: row.first_seen_at, createdAt: row.tweet_created_at, text: (row.text ?? "").slice(0, 200) })),
      unpairedIfttt: unpairedIfttt.map((row) => ({ sourceKey: row.source_key, tweetId: row.tweet_id, receivedAt: row.received_at,
        text: (row.text ?? "").slice(0, 200) })),
    }, null, 2));
    console.log(`Wrote ${output}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
