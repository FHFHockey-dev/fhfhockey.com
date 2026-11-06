import { describe, expect, it } from "vitest";
import {
  isRepostWrapper,
  mapFxProfileFeed,
  mapFxStatus,
  mapFxWrappedRepost,
  POLLED_ACCOUNTS,
  queueTableFor,
  rowsToEnqueue,
  toQueueRow,
  toV2Payload,
} from "../../../supabase/functions/x-timeline-poll/fxtwitter";
import { buildLinesCccSourceFromIftttEvent } from "lib/sources/linesCccIngestion";
import { tweetClaimAttribution } from "lib/sources/tweetSourceDirectory";
import { quotedTweetFromFxtwitterPayload } from "lib/sources/fxtwitterQueuePayload";

const gdl = POLLED_ACCOUNTS.find((account) => account.sourceKey === "gamedaylines")!;
const dfo = POLLED_ACCOUNTS.find((account) => account.sourceKey === "dfofantasy")!;

// Shapes follow FxTwitter's /2/profile/{handle}/statuses response as observed on 2026-11-05; text is invented.
const author = (screen_name: string) => ({ screen_name, id: "1", name: screen_name });
const status = (fields: Record<string, unknown>) => ({
  type: "status",
  created_at: "Fri Nov 06 00:17:35 +0000 2026",
  created_timestamp: 1793924255,
  media: {},
  quote: null,
  replying_to: null,
  reposted_by: null,
  ...fields,
});

describe("mapFxStatus", () => {
  it("maps a repost to the nested original with the original author's handle", () => {
    const row = mapFxStatus(gdl, status({
      id: "200",
      url: "https://x.com/BeatWriter/status/200",
      text: "Player A on the top line.",
      raw_text: { text: "Player A on the top line.", facets: [] },
      author: author("BeatWriter"),
      reposted_by: { screen_name: "GameDayLines", id: "9" },
    }));
    expect(row).toMatchObject({
      source_key: "gamedaylines",
      source_group: "gdl_suite",
      tweet_id: "200",
      post_kind: "repost",
      author_handle: "BeatWriter",
      original_author_handle: "BeatWriter",
      reposted_by_handle: "GameDayLines",
      full_text: "Player A on the top line.",
      text: "RT @BeatWriter: Player A on the top line.",
      tweet_created_at: "2026-11-06T00:17:35.000Z",
    });
  });

  it("keeps the quoted post's id, author and text, and puts its link in the compatible text", () => {
    const row = mapFxStatus(dfo, status({
      id: "300",
      url: "https://x.com/DFOFantasy/status/300",
      text: "Goalie B will start tonight.",
      author: author("DFOFantasy"),
      quote: status({ id: "299", url: "https://x.com/TeamReporter/status/299", text: "Goalie B confirmed.",
        author: author("TeamReporter") }),
    }));
    expect(row).toMatchObject({
      post_kind: "quote",
      quoted_tweet_id: "299",
      quoted_author_handle: "TeamReporter",
      quoted_text: "Goalie B confirmed.",
      original_author_handle: null,
      text: "Goalie B will start tonight. https://x.com/TeamReporter/status/299",
    });
  });

  it("decodes X's HTML escaping as IFTTT did", () => {
    const row = mapFxStatus(gdl, status({
      id: "201", url: "https://x.com/BeatWriter/status/201", author: author("BeatWriter"),
      text: "A &amp; B lead &lt;3 &gt; C &amp;amp;", reposted_by: { screen_name: "GameDayLines" },
    }));
    expect(row?.full_text).toBe("A & B lead <3 > C &amp;");
  });

  it("collects media alt text", () => {
    const fhfh = POLLED_ACCOUNTS.find((account) => account.sourceKey === "fhfhockey")!;
    const row = mapFxStatus(fhfh, status({
      id: "400", url: "https://x.com/FHFHockey/status/400", text: "New card", author: author("FHFHockey"),
      media: { all: [{ type: "photo", altText: "FHFH Start Chart" }, { type: "photo" }] },
    }));
    expect(row).toMatchObject({ has_media: true, media_alt_texts: ["FHFH Start Chart"] });
  });

  it("rejects posts by other accounts and malformed statuses", () => {
    expect(mapFxStatus(gdl, status({ id: "1", url: "https://x.com/Other/status/1", text: "x", author: author("Other") }))).toBeNull();
    expect(mapFxStatus(gdl, status({ id: "abc", url: "u", text: "x", author: author("GameDayLines") }))).toBeNull();
    expect(mapFxStatus(gdl, null as any)).toBeNull();
  });
});

describe("repost wrappers", () => {
  // Seen 2026-11-05: FxTwitter returned GameDayGoalies' repost as the wrapper, with truncated "RT @…" text.
  const wrapperStatus = status({
    id: "500", url: "https://x.com/GameDayGoalies/status/500", author: author("GameDayGoalies"),
    text: "RT @BeatWriter: Goalie C in net.\nSkater D in for Skater E…", reposted_by: { screen_name: "GameDayGoalies" },
  });
  const gdg = POLLED_ACCOUNTS.find((account) => account.sourceKey === "gamedaygoalies")!;

  it("keeps the nested handle when the feed returns the wrapper", () => {
    const row = mapFxStatus(gdg, wrapperStatus)!;
    expect(row).toMatchObject({
      tweet_id: "500",
      post_kind: "repost",
      author_handle: "BeatWriter",
      original_author_handle: "BeatWriter",
      reposted_by_handle: "GameDayGoalies",
      full_text: "Goalie C in net.\nSkater D in for Skater E…",
      text: "RT @BeatWriter: Goalie C in net.\nSkater D in for Skater E…",
    });
    expect(isRepostWrapper(gdg, row)).toBe(true);
  });

  it("swaps in the full original from the status endpoint, keyed by the original's id", () => {
    const wrapper = mapFxStatus(gdg, wrapperStatus)!;
    const original = status({
      id: "499", url: "https://x.com/BeatWriter/status/499", author: author("BeatWriter"),
      text: "Goalie C in net.\nSkater D in for Skater E at left D.", reposted_by: { screen_name: "GameDayGoalies" },
    });
    const row = mapFxWrappedRepost(gdg, wrapper, { code: 200, status: original })!;
    expect(row).toMatchObject({
      tweet_id: "499",
      post_kind: "repost",
      original_author_handle: "BeatWriter",
      full_text: "Goalie C in net.\nSkater D in for Skater E at left D.",
      raw_payload: { repost_wrapper_id: "500" },
    });
    expect(isRepostWrapper(gdg, row)).toBe(false);
    // A body that is the wrapper again, another author's post or junk is not a usable original.
    expect(mapFxWrappedRepost(gdg, wrapper, { code: 200, status: wrapperStatus })).toBeNull();
    expect(mapFxWrappedRepost(gdg, wrapper, { status: { ...original, author: author("Other") } })).toBeNull();
    expect(mapFxWrappedRepost(gdg, wrapper, { code: 404 })).toBeNull();
  });

  it("does not treat a normal repost or own post as a wrapper", () => {
    const own = mapFxStatus(gdg, status({ id: "6", url: "https://x.com/GameDayGoalies/status/6", text: "Starts",
      author: author("GameDayGoalies") }))!;
    expect(own.post_kind).toBe("post");
    expect(isRepostWrapper(gdg, own)).toBe(false);
  });
});

describe("cutover queue rows", () => {
  const ccc = POLLED_ACCOUNTS.find((account) => account.sourceKey === "ccc")!;
  const fhfh = POLLED_ACCOUNTS.find((account) => account.sourceKey === "fhfhockey")!;
  const repost = () => mapFxStatus(gdl, status({
    id: "700", url: "https://x.com/BeatWriter/status/700", author: { screen_name: "BeatWriter", id: "4242", name: "Beat" },
    text: "Lines at practice:\nPlayer A - Player B - Player C", reposted_by: { screen_name: "GameDayLines" },
  }))!;

  it("routes accounts to their live queue, and none for FHFHockey", () => {
    expect(queueTableFor(gdl)).toBe("line_source_ifttt_events");
    expect(queueTableFor(ccc)).toBe("lines_ccc_ifttt_events");
    expect(queueTableFor(fhfh)).toBeNull();
  });

  it("writes the receiver's row shape, with an X v2 payload for a repost", () => {
    const row = toQueueRow(repost(), "line_source_ifttt_events");
    expect(row).toMatchObject({
      source: "fxtwitter", source_group: "gdl_suite", source_key: "gamedaylines", source_account: "GameDayLines",
      username: "GameDayLines", tweet_id: "700", link_to_tweet: "https://x.com/BeatWriter/status/700",
      text: "RT @BeatWriter: Lines at practice:\nPlayer A - Player B - Player C", processing_status: "pending",
      tweet_created_at: "2026-11-06T00:17:35.000Z",
      raw_payload: {
        provider: "fxtwitter", quote: null,
        data: { id: "700", referenced_tweets: [{ type: "retweeted", id: "700" }] },
        includes: { users: [{ id: "4242", username: "BeatWriter" }] },
      },
    });
    // The CCC queue has no source_key/source_group columns.
    expect(toQueueRow(repost(), "lines_ccc_ifttt_events")).not.toHaveProperty("source_key");
  });

  it("gives no v2 payload for own posts or unhydrated wrappers", () => {
    const own = mapFxStatus(gdl, status({ id: "8", url: "https://x.com/GameDayLines/status/8", text: "Lines",
      author: { screen_name: "GameDayLines", id: "9" } }))!;
    const wrapper = mapFxStatus(gdl, status({ id: "9", url: "https://x.com/GameDayLines/status/9",
      author: { screen_name: "GameDayLines", id: "9" }, text: "RT @BeatWriter: Lines…" }))!;
    expect(toV2Payload(own)).toEqual({});
    expect(toV2Payload(wrapper)).toEqual({});
  });

  it("carries the quoted post so the processors can skip the t.co lookup", () => {
    const row = mapFxStatus(dfo, status({
      id: "300", url: "https://x.com/DFOFantasy/status/300", text: "Goalie B starts", author: author("DFOFantasy"),
      quote: status({ id: "299", url: "https://x.com/TeamReporter/status/299", text: "B &amp; C confirmed.",
        author: { screen_name: "TeamReporter", id: "5", name: "Team Reporter" } }),
    }))!;
    const payload = toQueueRow(row, "line_source_ifttt_events").raw_payload;
    expect(payload).toMatchObject({
      quote: { id: "299", url: "https://x.com/TeamReporter/status/299", text: "B & C confirmed.",
        author_handle: "TeamReporter", author_name: "Team Reporter", created_at: "2026-11-06T00:17:35.000Z" },
    });
    // What the processors read back in place of the t.co lookup.
    expect(quotedTweetFromFxtwitterPayload(payload)).toEqual({
      quotedTweetId: "299", quotedTweetUrl: "https://x.com/TeamReporter/status/299", quotedText: "B & C confirmed.",
      quotedPostedAt: "2026-11-06T00:17:35.000Z", quotedPostedLabel: null,
      quotedSourceTweetUrl: "https://x.com/TeamReporter/status/299", quotedAuthorName: "Team Reporter",
      quotedAuthorHandle: "TeamReporter", resolvedUrl: "https://x.com/TeamReporter/status/299", shortUrl: null,
      retrievalStatus: "fxtwitter_payload",
    });
    expect(quotedTweetFromFxtwitterPayload({ quote: { id: "299", url: "u" } })).toBeNull(); // not a scraper row
    expect(quotedTweetFromFxtwitterPayload(toQueueRow(repost(), "line_source_ifttt_events").raw_payload)).toBeNull();
  });

  it("enqueues only rows first seen at or after the switch", () => {
    const a = repost();
    const b = { ...a, tweet_id: "701" };
    const c = { ...a, tweet_id: "702" };
    const seen = [
      { tweet_id: "700", first_seen_at: "2026-11-07T11:59:59Z" },
      { tweet_id: "701", first_seen_at: "2026-11-07T12:00:00Z" },
    ];
    expect(rowsToEnqueue([a, b, c], seen, "2026-11-07T12:00:00Z").map((row) => row.tweet_id)).toEqual(["701"]);
    expect(rowsToEnqueue([a, b], seen, "not a date")).toEqual([]);
  });

  it("is credited to the original author by the processors' attribution", () => {
    const queued = toQueueRow(repost(), "line_source_ifttt_events");
    const source = buildLinesCccSourceFromIftttEvent({
      event: { ...(queued as any), id: "q1", received_at: "2026-11-06T00:18:00.000Z" },
      snapshotDate: "2026-11-05", teams: [], rosterByTeam: new Map(),
    });
    expect(tweetClaimAttribution(source)).toMatchObject({
      relationship: "retweet",
      original: { handle: "beatwriter", accountId: "4242", accountKey: "x:id:4242" },
    });
  });
});

describe("mapFxProfileFeed", () => {
  it("drops duplicates and tolerates an unexpected body", () => {
    const own = status({ id: "5", url: "https://x.com/GameDayLines/status/5", text: "Lines", author: author("GameDayLines") });
    expect(mapFxProfileFeed(gdl, { code: 200, results: [own, own] })).toHaveLength(1);
    expect(mapFxProfileFeed(gdl, { code: 404, results: [] })).toEqual([]);
    expect(mapFxProfileFeed(gdl, "nope")).toEqual([]);
  });
});
