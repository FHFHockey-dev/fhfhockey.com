// C7 controls for C2 NEWS-DUP: table scoping, multiple snapshots per event, no text equality.
import { describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (h: unknown) => h }));
vi.mock("lib/sources/playerIdentity", async (o) => ({ ...(await o<object>()), fetchPlayerIdentityDirectory: () => { throw new Error("unused"); } }));
vi.mock("lib/sources/linesCccIngestion", async (o) => ({ ...(await o<object>()), fetchLinesCccTweetOEmbedAttempt: () => { throw new Error("Network forbidden"); } }));
vi.mock("lib/projections/rosterEvents", () => ({ buildRosterEventsFromReviewedTweet: () => { throw new Error("No roster mutation"); } }));
import { syncTweetPatternReviewItems } from "pages/api/v1/db/tweet-pattern-review";
const OUT = process.env.C7_DUP_OUT; const observed: Record<string, unknown> = {};
const text = "Levi starts in net vs the Oilers tonight.";
const base: any = { source: "GameDayNewsNHL", source_label: "tweet", source_handle: "GameDayNewsNHL", author_name: null, snapshot_date: "2026-10-22", observed_at: "2026-10-22T16:57:27.000Z", tweet_id: null, tweet_url: null, source_url: null,
  quoted_tweet_id: null, quoted_tweet_url: null, quoted_author_handle: null, quoted_author_name: null, team_id: 22, team_abbreviation: "EDM", classification: "goalie_start", nhl_filter_status: "accepted", nhl_filter_reason: null,
  keyword_hits: [], raw_text: text, enriched_text: null, quoted_raw_text: null, quoted_enriched_text: null, raw_payload: {}, primary_text_source: "ifttt_text", tweet_posted_label: null, status: "observed", source_group: "gameday", source_key: "gamedaynewsnhl", source_account: "GameDayNewsNHL" };
const event = (id: string, extra: any = {}) => ({ id, source: "tweet", source_group: "gameday", source_key: "gamedaynewsnhl", source_account: "GameDayNewsNHL", username: "GameDayNewsNHL", text, link_to_tweet: null, tweet_id: null, tweet_created_at: null, created_at_label: null, processing_status: "processed", received_at: "2026-10-22T16:57:27.000Z", raw_payload: {}, ...extra });
const snap = (cap: string, eventId: string | null, extra: any = {}) => ({ ...base, capture_key: cap, metadata: eventId ? { iftttEventId: eventId } : {}, ...extra });
function db(tables: Record<string, any[]>) {
  const writes: any[] = [];
  return { writes, db: { from(table: string) { let cols: string[] = []; const q: any = { select(s: string) { cols = s.split(",").map(x => x.trim()); return q; }, order() { return q; }, limit() { return q; }, in() { return q; }, eq() { return q; }, gte() { return q; }, not() { return q; }, is() { return q; },
    upsert(rows: any[]) { writes.push(...rows); return q; }, then(r: any) {
      const pick = (row: any, c: string) => { const [alias, path = alias] = c.split(":"); const [col, ...keys] = path.split(/->>?/); return [alias, keys.reduce((v: any, k) => v?.[k], row[col]) ?? null]; };
      return Promise.resolve(r({ data: (tables[table] ?? []).map(row => Object.fromEntries(cols.map(c => pick(row, c)))), error: null })); } }; return q; } } };
}
const keys = async (t: Record<string, any[]>) => { const f = db(t); await syncTweetPatternReviewItems({ supabase: f.db as any, perSourceLimit: 10 }); return f.writes.map(w => `${w.source_table}|${w.dedupe_key}`); };
describe("C7 NEWS-DUP", () => {
  it("X1 table scoping: a lines_ccc snapshot naming 'evt-1' does not re-key a line_source_ifttt_events event 'evt-1'", async () => {
    const k = await keys({ lines_ccc: [snap("ccc-cap", "evt-1")], line_source_ifttt_events: [event("evt-1")] });
    observed.X1 = k; expect(k).toHaveLength(2);
  });
  it("X2 two snapshots naming one event: no third identity", async () => {
    const k = await keys({ line_source_snapshots: [snap("cap-a", "evt-9"), snap("cap-b", "evt-9")], line_source_ifttt_events: [event("evt-9")] });
    observed.X2 = k; expect(k.length).toBeLessThanOrEqual(2);
  });
  it("X3 identical text, no provenance link: stays separate (no text equality)", async () => {
    const k = await keys({ line_source_snapshots: [snap("cap-c", null)], line_source_ifttt_events: [event("evt-10")] });
    observed.X3 = k; expect(new Set(k.map(x => x.split("|")[1])).size).toBe(2);
  });
  it("X4 event with its own post ID equal to its snapshot's collapses through the normal key", async () => {
    const k = await keys({ line_source_snapshots: [snap("cap-d", "evt-11", { tweet_id: "333" })], line_source_ifttt_events: [event("evt-11", { tweet_id: "333" })] });
    observed.X4 = k; expect(k).toHaveLength(1);
    if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2));
  });
});
