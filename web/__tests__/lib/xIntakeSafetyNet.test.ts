// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  fetchFxChain,
  fxSourcePlan,
  mirrorOrigin,
  profileStatusesPath,
  PUBLIC_FX_BASE,
} from "../../../supabase/functions/_shared/fxSources";
import { nextPageCursor, pageReachesNoStoredPost, recoverGap } from "../../../supabase/functions/_shared/fxGapRecovery";
import { twscrapeFeedBody, twscrapeTimestamp, twscrapeToFxStatus } from "../../../supabase/functions/_shared/twscrapeStatus";
import { parseIngestRequest } from "../../../supabase/functions/_shared/xTimelineIngestRequest";
import { storeAndEnqueue } from "../../../supabase/functions/_shared/xTimelineStore";
import * as fx from "../../../supabase/functions/x-timeline-poll/fxtwitter";
import {
  mapFxProfileFeed,
  mapFxStatus,
  POLLED_ACCOUNTS,
  toQueueRow,
} from "../../../supabase/functions/x-timeline-poll/fxtwitter";
import { buildLinesCccSourceFromIftttEvent } from "lib/sources/linesCccIngestion";
import { tweetClaimAttribution } from "lib/sources/tweetSourceDirectory";

const gdl = POLLED_ACCOUNTS.find((account) => account.sourceKey === "gamedaylines")!;
const rosters = POLLED_ACCOUNTS.find((account) => account.sourceKey === "nhl_rosters")!;
const fhfh = POLLED_ACCOUNTS.find((account) => account.sourceKey === "fhfhockey")!;

// FxTwitter /2/profile/{handle}/statuses shapes as observed 2026-11-05/06; text is invented.
const fxPost = (id: string, handle = "NHL_Rosters") => ({
  type: "status", id, url: `https://x.com/${handle}/status/${id}`, text: `Post ${id}`,
  author: { screen_name: handle, id: "77", name: handle }, created_timestamp: 1793924255, media: {},
  quote: null, replying_to: null, reposted_by: null,
});
const page = (ids: string[], bottom: string | null = `cursor-after-${ids.at(-1)}`) => ({
  code: 200, results: ids.map((id) => fxPost(id)), cursor: { top: "t", bottom },
});
const response = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, body: { cancel: async () => {} } }) as unknown as Response;
const noSleep = async () => {};

describe("fxSources: public FxTwitter, then the self-hosted mirror", () => {
  it("accepts only a plain https origin as the mirror", () => {
    expect(mirrorOrigin("https://fx.example.workers.dev")).toBe("https://fx.example.workers.dev");
    expect(mirrorOrigin(" https://fx.example.workers.dev/ ")).toBe("https://fx.example.workers.dev");
    for (const bad of ["http://fx.example.dev", "https://u:p@fx.example.dev", "https://fx.example.dev/api",
      "https://fx.example.dev?x=1", "not a url", "", null, undefined, PUBLIC_FX_BASE]) {
      expect(mirrorOrigin(bad as string | null | undefined)).toBeNull();
    }
  });

  it("keeps today's three public attempts without a mirror, and public 1 / mirror 3 / public 1 with one", () => {
    expect(fxSourcePlan(undefined)).toEqual([{ via: "public", base: PUBLIC_FX_BASE, attempts: 3 }]);
    expect(fxSourcePlan("https://fx.example.dev").map((step) => [step.via, step.attempts]))
      .toEqual([["public", 1], ["mirror", 3], ["public", 1]]);
  });

  it("takes over on the first public miss and reports which source answered", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      return url.startsWith(PUBLIC_FX_BASE) ? response(404) : response(200, { results: [] });
    }) as unknown as typeof fetch;
    const result = await fetchFxChain("/2/status/1", fxSourcePlan("https://fx.example.dev"), { fetchImpl, sleep: noSleep });
    expect(result).toMatchObject({ status: 200, attempts: 2, via: "mirror" });
    expect(urls).toEqual([`${PUBLIC_FX_BASE}/2/status/1`, "https://fx.example.dev/2/status/1"]);
  });

  it("hands back: every request starts with the public API, which wins when it answers", async () => {
    const fetchImpl = vi.fn(async () => response(200, { ok: 1 })) as unknown as typeof fetch;
    const result = await fetchFxChain("/x", fxSourcePlan("https://fx.example.dev"), { fetchImpl, sleep: noSleep });
    expect(result).toMatchObject({ via: "public", attempts: 1 });
  });

  it("tries the public API once more after the mirror fails, then gives up", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url.startsWith(PUBLIC_FX_BASE) ? "public" : "mirror");
      if (urls.length === 5) return response(200, { late: true });
      return response(urls.length % 2 ? 503 : 404);
    }) as unknown as typeof fetch;
    const result = await fetchFxChain("/x", fxSourcePlan("https://fx.example.dev"), { fetchImpl, sleep: noSleep });
    expect(urls).toEqual(["public", "mirror", "mirror", "mirror", "public"]);
    expect(result).toMatchObject({ via: "public", attempts: 5, body: { late: true } });

    const down = vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await fetchFxChain("/x", fxSourcePlan("https://fx.example.dev"), { fetchImpl: down, sleep: noSleep }))
      .toEqual({ status: 0, attempts: 5, body: null, via: null });
  });

  it("stops at a non-retryable status and at the run deadline", async () => {
    const forbidden = vi.fn(async () => response(403)) as unknown as typeof fetch;
    expect(await fetchFxChain("/x", fxSourcePlan("https://fx.example.dev"), { fetchImpl: forbidden, sleep: noSleep }))
      .toMatchObject({ status: 403, attempts: 1, via: null });
    const missing = vi.fn(async () => response(404)) as unknown as typeof fetch;
    expect(await fetchFxChain("/x", fxSourcePlan(null), { fetchImpl: missing, sleep: noSleep, deadline: Date.now() + 100 }))
      .toMatchObject({ attempts: 1, via: null });
  });

  it("builds the profile path with an encoded cursor and reads cursor.bottom", () => {
    expect(profileStatusesPath("NHL_Rosters")).toBe("/2/profile/NHL_Rosters/statuses?count=20");
    expect(profileStatusesPath("NHL_Rosters", "DAAH+/=")).toBe("/2/profile/NHL_Rosters/statuses?count=20&cursor=DAAH%2B%2F%3D");
    expect(nextPageCursor(page(["1"]))).toBe("cursor-after-1");
    expect(nextPageCursor({ results: [] })).toBeNull();
    expect(nextPageCursor({ cursor: { bottom: "" } })).toBeNull();
  });
});

describe("fxGapRecovery: page back after an outage", () => {
  const rows = (ids: string[]) => mapFxProfileFeed(rosters, page(ids));
  const mapPage = (body: unknown) => mapFxProfileFeed(rosters, body);

  it("asks for more only when no post below the first (maybe pinned) one is stored", () => {
    expect(pageReachesNoStoredPost(rows(["9", "8", "7"]), new Set(["7"]))).toBe(false);
    expect(pageReachesNoStoredPost(rows(["9", "8", "7"]), new Set(["9"]))).toBe(true); // a stored pinned post at the top
    expect(pageReachesNoStoredPost(rows(["9"]), new Set())).toBe(false);
    expect(pageReachesNoStoredPost([], new Set())).toBe(false);
  });

  it("counts a hydrated wrapper repost as stored by its wrapper id", () => {
    const wrapper = { ...rows(["50"])[0], raw_payload: { repost_wrapper_id: "51" } };
    expect(pageReachesNoStoredPost([rows(["60"])[0], wrapper], new Set(["51"]))).toBe(false);
  });

  it("does nothing in steady state, with one stored-post lookup", async () => {
    const lookupStored = vi.fn(async () => ({ stored: new Set(["8", "7"]), hasHistory: true }));
    const fetchPage = vi.fn();
    const result = await recoverGap({ mapPage, firstBody: page(["9", "8", "7"]), firstRows: rows(["9", "8", "7"]),
      lookupStored, fetchPage });
    expect(result).toMatchObject({ state: "none", extraPages: 0 });
    expect(result.rows.map((row) => row.tweet_id)).toEqual(["9", "8", "7"]);
    expect(lookupStored).toHaveBeenCalledTimes(1);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("reads older pages back to a stored post and adds only the missed posts", async () => {
    const stored = new Set(["4", "3"]);
    const older: Record<string, unknown> = { "cursor-after-7": page(["6", "5"]), "cursor-after-5": page(["4", "3"]) };
    const result = await recoverGap({
      mapPage, firstBody: page(["9", "8", "7"]), firstRows: rows(["9", "8", "7"]),
      lookupStored: async (ids) => ({ stored: new Set(ids.filter((id) => stored.has(id))), hasHistory: true }),
      fetchPage: async (cursor) => older[cursor] ?? null,
    });
    expect(result).toMatchObject({ state: "recovered", extraPages: 2 });
    expect(result.rows.map((row) => row.tweet_id)).toEqual(["9", "8", "7", "6", "5"]);
  });

  it("adds only the rows above the first stored post on the boundary page, never older ones", async () => {
    const stored = new Set(["500"]);
    const result = await recoverGap({
      mapPage, firstBody: page(["9", "8", "7"]), firstRows: rows(["9", "8", "7"]),
      lookupStored: async (ids) => ({ stored: new Set(ids.filter((id) => stored.has(id))), hasHistory: true }),
      fetchPage: async () => page(["6", "5", "500", "40", "30"]),
    });
    expect(result).toMatchObject({ state: "recovered", extraPages: 1 });
    expect(result.rows.map((row) => row.tweet_id)).toEqual(["9", "8", "7", "6", "5"]);
  });

  it("reports an unrecovered gap after the page limit, or when there is no cursor to go further", async () => {
    let next = 100;
    const unrecovered = await recoverGap({
      mapPage, firstBody: page(["9", "8"]), firstRows: rows(["9", "8"]),
      lookupStored: async () => ({ stored: new Set<string>(), hasHistory: true }),
      fetchPage: async () => { next -= 2; return page([String(next + 1), String(next)]); },
    });
    expect(unrecovered).toMatchObject({ state: "unrecovered", extraPages: 4 });
    expect(unrecovered.rows).toHaveLength(10);

    const noCursor = await recoverGap({
      mapPage, firstBody: page(["9", "8"], null), firstRows: rows(["9", "8"]),
      lookupStored: async () => ({ stored: new Set<string>(), hasHistory: true }), fetchPage: vi.fn(),
    });
    expect(noCursor).toMatchObject({ state: "unrecovered", extraPages: 0 });
    expect(noCursor.rows.map((row) => row.tweet_id)).toEqual(["9", "8"]);
  });

  it("never holds fresh posts back: a failed page, lookup or exhausted budget abandons the rest of the gap", async () => {
    const base = { mapPage, firstBody: page(["9", "8"]), firstRows: rows(["9", "8"]),
      lookupStored: async () => ({ stored: new Set<string>(), hasHistory: true }) };
    // Older pages that always fail: page 1 is stored in this same run.
    expect(await recoverGap({ ...base, fetchPage: async () => null }))
      .toMatchObject({ state: "abandoned", extraPages: 1, rows: [{ tweet_id: "9" }, { tweet_id: "8" }] });
    // Budget of one older page: that page's rows are kept, the rest is abandoned.
    const fetchPage = vi.fn(async () => page(["7", "6"]));
    const capped = await recoverGap({ ...base, fetchPage, pageBudget: 1 });
    expect(capped).toMatchObject({ state: "abandoned", extraPages: 1 });
    expect(capped.rows.map((row) => row.tweet_id)).toEqual(["9", "8", "7", "6"]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(await recoverGap({ ...base, fetchPage, pageBudget: 0 }))
      .toMatchObject({ state: "abandoned", extraPages: 0, rows: [{ tweet_id: "9" }, { tweet_id: "8" }] });
    // A lookup that fails on an older page keeps what was read before it.
    let calls = 0;
    expect(await recoverGap({ ...base, fetchPage, lookupStored: async () => (++calls === 1
      ? { stored: new Set<string>(), hasHistory: true } : null) }))
      .toMatchObject({ state: "abandoned", extraPages: 1, rows: [{ tweet_id: "9" }, { tweet_id: "8" }] });
  });

  it("skips an account with no stored posts, and a failed lookup", async () => {
    const base = { mapPage, firstBody: page(["9", "8"]), firstRows: rows(["9", "8"]), fetchPage: vi.fn() };
    expect(await recoverGap({ ...base, lookupStored: async () => ({ stored: new Set<string>(), hasHistory: false }) }))
      .toMatchObject({ state: "skipped" });
    expect(await recoverGap({ ...base, lookupStored: async () => null })).toMatchObject({ state: "skipped" });
    expect(base.fetchPage).not.toHaveBeenCalled();
  });
});

// twscrape Tweet.json() shapes (twscrape/models.py, checked 2026-11-06); text is invented.
const user = (username: string, id: number) => ({ id, id_str: String(id), username, displayname: `${username} name` });
const tweet = (fields: Record<string, unknown>) => ({
  id: 1, id_str: "1", url: "https://x.com/x/status/1", date: "2026-11-06 19:06:38+00:00", lang: "en",
  rawContent: "", media: { photos: [], videos: [], animated: [] }, retweetedTweet: null, quotedTweet: null,
  inReplyToUser: null, ...fields,
});

describe("twscrapeStatus: layer-3 tweets in FxTwitter's shape", () => {
  it("parses Python's str(datetime) and ISO dates", () => {
    expect(twscrapeTimestamp("2026-11-06 19:06:38+00:00")).toBe(Date.parse("2026-11-06T19:06:38Z") / 1000);
    expect(twscrapeTimestamp("2026-11-06T19:06:38Z")).toBe(Date.parse("2026-11-06T19:06:38Z") / 1000);
    expect(twscrapeTimestamp("soon")).toBeNull();
  });

  it("maps an own post with alt text exactly as the poller maps FxTwitter's", () => {
    const status = twscrapeToFxStatus(tweet({
      id: "2118782124648226986", id_str: "2118782124648226986", user: user("FHFHockey", 42),
      rawContent: "Card of the week &amp; more", media: { photos: [{ url: "p", altText: "FHFH card: Player" }], videos: [], animated: [] },
    }), "FHFHockey");
    const row = mapFxStatus(fhfh, status!);
    expect(row).toMatchObject({
      tweet_id: "2118782124648226986", post_kind: "post", author_handle: "FHFHockey",
      link_to_tweet: "https://x.com/FHFHockey/status/2118782124648226986", full_text: "Card of the week & more",
      tweet_created_at: "2026-11-06T19:06:38.000Z", has_media: true, media_alt_texts: ["FHFH card: Player"],
    });
    expect(row!.raw_payload).toMatchObject({ provider: "twscrape" });
  });

  it("maps a retweet to the original, keyed by the original's id, and credits its author", () => {
    const status = twscrapeToFxStatus(tweet({
      id_str: "900", user: user("GameDayLines", 5), rawContent: "RT @BeatWriter: Player A on the top…",
      retweetedTweet: tweet({ id_str: "800", user: user("BeatWriter", 1234), rawContent: "Player A on the top line tonight." }),
    }), "GameDayLines");
    const row = mapFxStatus(gdl, status!)!;
    expect(row).toMatchObject({
      tweet_id: "800", post_kind: "repost", original_author_handle: "BeatWriter", reposted_by_handle: "GameDayLines",
      text: "RT @BeatWriter: Player A on the top line tonight.",
    });
    const queued = toQueueRow(row, "line_source_ifttt_events");
    const source = buildLinesCccSourceFromIftttEvent({
      event: { ...(queued as any), id: "q1", received_at: "2026-11-06T19:10:00.000Z" },
      snapshotDate: "2026-11-06", teams: [], rosterByTeam: new Map(),
    });
    expect(tweetClaimAttribution(source)).toMatchObject({
      relationship: "retweet", original: { handle: "beatwriter", accountId: "1234" },
    });
  });

  it("keeps a retweet without its original as the wrapper, and quotes and replies", () => {
    const wrapper = mapFxStatus(gdl, twscrapeToFxStatus(tweet({
      id_str: "901", user: user("GameDayLines", 5), rawContent: "RT @BeatWriter: Player A on the top…",
    }), "GameDayLines")!);
    expect(wrapper).toMatchObject({ tweet_id: "901", post_kind: "repost", original_author_handle: "BeatWriter" });

    const quote = mapFxStatus(rosters, twscrapeToFxStatus(tweet({
      id_str: "902", user: user("NHL_Rosters", 6), rawContent: "Recalled.", inReplyToUser: user("TeamX", 7),
      quotedTweet: tweet({ id_str: "880", user: user("TeamX", 7), rawContent: "We have recalled Player C." }),
    }), "NHL_Rosters")!);
    expect(quote).toMatchObject({
      post_kind: "quote", quoted_tweet_id: "880", quoted_author_handle: "TeamX", replying_to_handle: "TeamX",
      text: "Recalled. https://x.com/TeamX/status/880",
    });
  });

  it("drops tweets without a usable identity and other accounts' posts", () => {
    const body = twscrapeFeedBody([
      tweet({ id: "x", id_str: "x", user: user("NHL_Rosters", 6) }),
      tweet({ id: "903", id_str: "903", user: { username: "NHL_Rosters" } }),
      tweet({ id_str: "904", user: user("Someone", 8), rawContent: "Not ours" }),
      tweet({ id_str: "905", user: user("NHL_Rosters", 6), rawContent: "Ours" }),
      "junk",
    ], "NHL_Rosters");
    expect(mapFxProfileFeed(rosters, body).map((row) => row.tweet_id)).toEqual(["905"]);
    expect(twscrapeFeedBody("nope", "NHL_Rosters")).toEqual({ results: [] });
  });
});

describe("x-timeline-ingest request validation", () => {
  const keys = POLLED_ACCOUNTS.map((account) => account.sourceKey);
  it("accepts health and tracked-account ingest requests only", () => {
    expect(parseIngestRequest('{"mode":"health"}', keys)).toEqual({ mode: "health" });
    expect(parseIngestRequest('{"mode":"ingest","sourceKey":"nhl_rosters","tweets":[]}', keys))
      .toEqual({ mode: "ingest", sourceKey: "nhl_rosters", tweets: [] });
    expect(parseIngestRequest("not json", keys)).toHaveProperty("error");
    expect(parseIngestRequest("[]", keys)).toHaveProperty("error");
    expect(parseIngestRequest('{"mode":"delete"}', keys)).toHaveProperty("error");
    expect(parseIngestRequest('{"mode":"ingest","sourceKey":"elonmusk","tweets":[]}', keys)).toHaveProperty("error");
    expect(parseIngestRequest('{"mode":"ingest","sourceKey":"ccc","tweets":{}}', keys)).toHaveProperty("error");
    expect(parseIngestRequest(JSON.stringify({ mode: "ingest", sourceKey: "ccc", tweets: Array(101).fill({}) }), keys))
      .toHaveProperty("error");
  });
});

/** A minimal supabase-js stand-in that records calls and answers each table's query in turn. */
function fakeDb(answers: Record<string, Array<{ data?: unknown; error?: unknown }>>) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
  const from = (table: string) => {
    const answer = () => answers[table]?.shift() ?? { data: [], error: null };
    const chain: any = {};
    for (const op of ["select", "upsert", "eq", "in"]) {
      chain[op] = (...args: unknown[]) => { calls.push({ table, op, args }); return chain; };
    }
    chain.then = (resolve: (value: unknown) => void) => resolve({ error: null, ...answer() });
    return chain;
  };
  return { db: { from }, calls };
}

describe("xTimelineStore: the poller's store-and-enqueue, shared with the ingest function", () => {
  const rows = mapFxProfileFeed(rosters, page(["9", "8"]));

  it("stores only, for an account that is not switched", async () => {
    const { db, calls } = fakeDb({ x_timeline_shadow_posts: [{ data: [{ tweet_id: "9" }] }] });
    expect(await storeAndEnqueue(db, fx, rosters, rows, null)).toEqual({ ok: true, seen: 2, inserted: 1 });
    expect(calls.filter((call) => call.op === "upsert")).toHaveLength(1);
  });

  it("queues the posts first seen at or after the switch, ignoring duplicates", async () => {
    const { db, calls } = fakeDb({
      x_timeline_shadow_posts: [
        { data: [{ tweet_id: "9" }] },
        { data: [{ tweet_id: "9", first_seen_at: "2026-11-06T20:00:00Z" }, { tweet_id: "8", first_seen_at: "2026-11-06T18:00:00Z" }] },
      ],
      line_source_ifttt_events: [{ data: [{ id: "q1" }] }],
    });
    expect(await storeAndEnqueue(db, fx, rosters, rows, "2026-11-06T18:50:10Z"))
      .toEqual({ ok: true, seen: 2, inserted: 1, enqueued: 1 });
    const queued = calls.find((call) => call.table === "line_source_ifttt_events" && call.op === "upsert")!;
    expect((queued.args[0] as Array<{ tweet_id: string; source: string }>).map((row) => [row.tweet_id, row.source]))
      .toEqual([["9", "fxtwitter"]]);
    expect(queued.args[1]).toEqual({ onConflict: "source_key,tweet_id", ignoreDuplicates: true });
    // The Lines engine dates the post by its first sighting, carried in the queue row.
    expect((queued.args[0] as Array<{ raw_payload: Record<string, unknown> }>)[0].raw_payload.first_seen_at)
      .toBe("2026-11-06T20:00:00Z");
  });

  it("reports store and enqueue failures without throwing", async () => {
    const storeFails = fakeDb({ x_timeline_shadow_posts: [{ data: null, error: { code: "57014" } }] });
    expect(await storeAndEnqueue(storeFails.db, fx, rosters, rows, "2026-11-06T18:50:10Z"))
      .toEqual({ ok: false, seen: 2, inserted: 0, error: "57014" });
    const queueFails = fakeDb({
      x_timeline_shadow_posts: [{ data: [] }, { data: [{ tweet_id: "9", first_seen_at: "2026-11-06T20:00:00Z" }] }],
      line_source_ifttt_events: [{ data: null, error: { code: "23514" } }],
    });
    expect(await storeAndEnqueue(queueFails.db, fx, rosters, rows, "2026-11-06T18:50:10Z"))
      .toMatchObject({ ok: false, enqueued: 0, enqueueError: "23514" });
  });
});
