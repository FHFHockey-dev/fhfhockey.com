import { describe, expect, it, vi } from "vitest";
import { fetchNewsFeedItems, getPublicNewsClaimPresentation, sanitizePublicNewsFeedItem } from "./newsFeed";
import { syncTweetPatternReviewItems } from "../pages/api/v1/db/tweet-pattern-review";
import { buildTweetNewsAutomationCandidate } from "./sources/tweetNewsAutomation";
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
const passage = "Victor Hedman will not play tonight.";
const interpretation = { version: "2026-10-13.1", units: [], unresolved: [], events: [{ playerId: 8475167, playerName: "Victor Hedman", kind: "injury", state: "unknown", availability: "out", modality: "affirmative", evidence: { text: passage, start: 0, end: passage.length } }], reviewOnlyMarker: "REVIEW_ONLY_SENTINEL" };
function sourceDb(table: string, retained: unknown) {
  const writes: any[] = [], selects: Record<string, string> = {};
  const row = { capture_key: "fixture-source", source: "GameDayNewsNHL", source_group: "gamedaynewsnhl", source_key: "gamedaynewsnhl", source_account: "GameDayNewsNHL", source_label: "tweet", source_handle: "FixtureReporter", author_name: "Fixture Reporter", snapshot_date: "2026-10-22", observed_at: "2026-10-22T12:00:00Z", tweet_id: "100", tweet_url: "https://x.com/FixtureReporter/status/100", source_url: "https://x.com/FixtureReporter/status/100", team_id: 14, team_abbreviation: "TBL", classification: "injury", nhl_filter_status: "accepted", keyword_hits: [], raw_text: passage, raw_payload: {}, primary_text_source: "ifttt_text", status: "observed", metadata: { interpretation: retained, rawLineageMarker: "NOT_PUBLIC" } };
  const db = { from(name: string) { let columns: string[] = []; const q: any = { select(text: string) { selects[name] = text; columns = text.split(",").map(x => x.trim()); return q; }, order() { return q; }, limit() { return q; }, in() { return q; }, upsert(rows: unknown[]) { writes.push(...rows); return q; }, then(resolve: any) { const data = name === table ? [Object.fromEntries(columns.map(c => { const [alias, path = alias] = c.split(":"); const [column, ...keys] = path.split("->"); return [alias, keys.reduce((v: any, k) => v?.[k], (row as any)[column]) ?? null]; }))] : []; return Promise.resolve(resolve({ data, error: null })); } }; return q; } };
  return { db, writes, selects };
}
async function publicProjection(table: string, retained: unknown) {
  const f = sourceDb(table, retained); await syncTweetPatternReviewItems({ supabase: f.db as any, perSourceLimit: 1 });
  expect(f.writes).toHaveLength(1); const review = { ...f.writes[0], id: "review-fixture" };
  const candidate = buildTweetNewsAutomationCandidate({ row: review, players: [{ id: 8475167, fullName: "Victor Hedman", position: "D", team_id: 14 }], nowIso: "2026-10-22T12:00:00Z" }); expect(candidate).not.toBeNull();
  const item = { id: "news-fixture", source_review_item_id: review.id, source_tweet_id: candidate!.sourceTweetId, source_url: candidate!.sourceUrl, tweet_url: candidate!.tweetUrl, source_label: candidate!.sourceLabel, source_account: candidate!.sourceAccount, headline: candidate!.headline, blurb: candidate!.blurb, category: candidate!.category, subcategory: candidate!.subcategory, metadata: candidate!.metadata, team_id: 14, team_abbreviation: "TBL", card_status: "published", observed_at: candidate!.observedAt };
  const rows: Record<string, any[]> = { news_feed_items: [item], tweet_pattern_review_items: [review], news_feed_item_players: [] };
  const db = { from(name: string) { const q: any = { select() { return q; }, order() { return q; }, limit() { return q; }, eq() { return q; }, in() { return q; }, then(resolve: any) { return Promise.resolve(resolve({ data: rows[name] ?? [], error: null })); } }; return q; } };
  const loaded = (await fetchNewsFeedItems({ supabase: db, status: "published" }))[0]; return { ...f, review, loaded };
}
describe("review storage stays outside the public news DTO", () => {
  it.each(["lines_ccc", "line_source_snapshots"])("retains %s interpretation in storage without public disclosure or new claims", async table => {
    const f = await publicProjection(table, interpretation);
    expect(f.review.metadata.retainedInterpretation).toEqual(interpretation);
    expect(f.selects[table]).toContain("interpretation:metadata->interpretation");
    expect(f.selects[table].split(",").map(x => x.trim())).not.toContain("metadata");
    const serialized = JSON.stringify(f.loaded); expect(serialized).not.toContain("retainedInterpretation"); expect(serialized).not.toContain("REVIEW_ONLY_SENTINEL"); expect(serialized).not.toContain("NOT_PUBLIC");
    expect(getPublicNewsClaimPresentation(f.loaded).claims).toEqual([]);
    const baseline = await publicProjection(table, null); expect(JSON.stringify(f.loaded)).toBe(JSON.stringify(baseline.loaded));
    expect(sanitizePublicNewsFeedItem(f.loaded)).toEqual(f.loaded);
  });
  it("allowlists known public metadata while excluding lineage and review fields", () => {
    const item: any = { id: "fixture", headline: "Fixture", blurb: "Source passage", source_label: "Reporter", source_account: "FixtureReporter", source_url: "https://x.com/FixtureReporter/status/100", tweet_url: null, metadata: { interpretation: { events: [] }, lineupCard: { lines: [] }, retainedInterpretation: interpretation, temporalReview: { marker: "PRIVATE" }, rawLineageMarker: "PRIVATE", automation: { summary: "Public summary", autoPublish: false, internalReview: "PRIVATE" } } };
    expect(sanitizePublicNewsFeedItem(item).metadata).toEqual({ interpretation: { events: [] }, lineupCard: { lines: [] }, automation: { summary: "Public summary" } });
  });
});
