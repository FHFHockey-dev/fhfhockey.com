// C7 controls for C2 NEWS R1: the unsanitized player-flags path and an end-to-end writer → automation → flags run.
import { describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (h: unknown) => h }));
vi.mock("lib/sources/playerIdentity", async (o) => ({ ...(await o<object>()), fetchPlayerIdentityDirectory: () => { throw new Error("unused"); } }));
vi.mock("lib/sources/linesCccIngestion", () => ({ fetchLinesCccTweetOEmbedAttempt: () => { throw new Error("Network forbidden"); } }));
vi.mock("lib/projections/rosterEvents", () => ({ buildRosterEventsFromReviewedTweet: () => { throw new Error("No roster mutation"); } }));
import { fetchLatestPlayerNewsFlags, fetchNewsFeedItems } from "lib/newsFeed";
import { syncTweetPatternReviewItems } from "pages/api/v1/db/tweet-pattern-review";
import { buildTweetNewsAutomationCandidate } from "lib/sources/tweetNewsAutomation";

const OUT = process.env.C7_NEWS_OUT; const observed: Record<string, unknown> = {};
const text = "Victor Hedman will not play tonight.";
const interpretation = { version: "2026-10-13.1", units: [], unresolved: [], events: [{ playerId: 8475167, playerName: "Victor Hedman", kind: "injury", state: "unknown", availability: "out", modality: "affirmative", evidence: { text, start: 0, end: text.length } }] };
const db = (rows: Record<string, any[]>) => ({ from(table: string) { const q: any = { select() { return q; }, order() { return q; }, limit() { return q; }, eq() { return q; }, in() { return q; },
  then(r: any) { return Promise.resolve(r({ data: rows[table] ?? [], error: null })); } }; return q; } });
const item = (metadata: any) => ({ id: "n1", category: "injury", subcategory: "out", headline: "Hedman update", blurb: text, metadata, source_url: "https://x.com/a/status/1", published_at: "2026-10-22T12:00:00Z", created_at: "2026-10-22T12:00:00Z", card_status: "published" });
const flags = async (metadata: any) => fetchLatestPlayerNewsFlags({ supabase: db({ news_feed_item_players: [{ news_item_id: "n1", player_id: 8475167 }], news_feed_items: [item(metadata)] }), playerIds: [8475167] });

describe("C7 NEWS R1", () => {
  it("N1 raw (unsanitized) player-flags path: retainedInterpretation yields no flag; the same object under interpretation does (sensitivity)", async () => {
    const retained = await flags({ retainedInterpretation: interpretation }), live = await flags({ interpretation });
    observed.N1 = { retainedFlags: retained.size, interpretationFlags: live.size };
    expect(retained.size).toBe(0); expect(live.size).toBe(1);
  });
  it.each(["lines_ccc", "line_source_snapshots"])("N2 real writer → automation candidate → news item: %s retains for review, produces no player flag and no public key", async table => {
    const writes: any[] = [];
    const src = { capture_key: "c7-row", source: "GameDayNewsNHL", source_label: "tweet", source_handle: "KnownWrapper", author_name: null, snapshot_date: "2026-10-22", observed_at: "2026-10-22T11:00:00Z",
      tweet_id: "1900000000000000001", tweet_url: "https://x.com/KnownWrapper/status/1900000000000000001", source_url: "https://x.com/KnownWrapper/status/1900000000000000001", quoted_tweet_id: null, quoted_tweet_url: null,
      quoted_author_handle: null, quoted_author_name: null, team_id: 14, team_abbreviation: "TBL", classification: "injury", nhl_filter_status: "accepted", nhl_filter_reason: null, keyword_hits: [], raw_text: text,
      enriched_text: null, quoted_raw_text: null, quoted_enriched_text: null, raw_payload: {}, primary_text_source: "ifttt_text", tweet_posted_label: null, status: "observed", source_group: "x", source_key: "k", source_account: "KnownWrapper",
      metadata: { interpretation, rawLineageMarker: "not-public" } };
    const fake = { from(t: string) { let cols: string[] = []; const q: any = { select(s: string) { cols = s.split(",").map(x => x.trim()); return q; }, order() { return q; }, limit() { return q; }, in() { return q; }, eq() { return q; },
      upsert(rows: any[]) { writes.push(...rows); return q; }, then(r: any) {
        const pick = (row: any, c: string) => { const [alias, path = alias] = c.split(":"); const [col, ...keys] = path.split("->"); return [alias, keys.reduce((v: any, k) => v?.[k], row[col]) ?? null]; };
        return Promise.resolve(r({ data: t === table ? [Object.fromEntries(cols.map(c => pick(src, c)))] : [], error: null })); } }; return q; } };
    await syncTweetPatternReviewItems({ supabase: fake as any, perSourceLimit: 1 });
    const review = { ...writes[0], id: "rv" };
    const cand = buildTweetNewsAutomationCandidate({ row: review, players: [{ id: 8475167, fullName: "Victor Hedman", position: "D", team_id: 14 }], nowIso: "2026-10-22T12:00:00.000Z" } as any)!;
    const f = await flags(cand.metadata);
    const loaded = await fetchNewsFeedItems({ supabase: db({ news_feed_items: [{ ...item(cand.metadata), id: "n1" }], news_feed_item_players: [], tweet_pattern_review_items: [review] }), status: "published" } as any);
    const pub = JSON.stringify(loaded);
    observed[`N2 ${table}`] = { reviewHasRetained: !!review.metadata?.retainedInterpretation, candidateMetaKeys: Object.keys(cand.metadata ?? {}), flags: f.size, publicHasRetained: pub.includes("retainedInterpretation"), publicHasHedmanClaim: pub.includes("affirmative") };
    expect(review.metadata.retainedInterpretation).toBeTruthy();
    expect(f.size).toBe(0); expect(pub).not.toContain("retainedInterpretation"); expect(pub).not.toContain("rawLineageMarker");
    if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2));
  });
});
