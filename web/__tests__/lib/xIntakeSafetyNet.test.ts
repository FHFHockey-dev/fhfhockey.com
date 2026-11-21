// @vitest-environment node
/// <reference types="vite/client" />
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchFxChain,
  fxSourcePlan,
  mirrorOrigin,
  profileStatusesPath,
  PUBLIC_FX_BASE,
  type FxStatusEvidence,
} from "../../../supabase/functions/_shared/fxSources";
import { nextPageCursor, pageReachesNoStoredPost, recoverGap } from "../../../supabase/functions/_shared/fxGapRecovery";
import {
  timelineId,
  toObservationRows,
  twscrapeFeedBody,
  twscrapeTimestamp,
  twscrapeToFxStatus,
  xCreatedAt,
} from "../../../supabase/functions/_shared/twscrapeStatus";
import { newestId, parseIngestRequest } from "../../../supabase/functions/_shared/xTimelineIngestRequest";
import { storeAndEnqueue, switchedAtFor } from "../../../supabase/functions/_shared/xTimelineStore";
import {
  handleIngest,
  OBSERVATIONS_TABLE,
  RETENTION_DAYS,
} from "../../../supabase/functions/x-timeline-ingest/handler";
import * as fx from "../../../supabase/functions/x-timeline-poll/fxtwitter";
import {
  mapFxProfileFeed,
  mapFxStatus,
  POLLED_ACCOUNTS,
  toQueueRow,
} from "../../../supabase/functions/x-timeline-poll/fxtwitter";
import { buildLinesCccSourceFromIftttEvent } from "lib/sources/linesCccIngestion";
import { tweetClaimAttribution } from "lib/sources/tweetSourceDirectory";

const { createPollClient } = vi.hoisted(() => ({ createPollClient: vi.fn() }));
vi.mock("npm:@supabase/supabase-js@2.89.0", () => ({ createClient: createPollClient }));

const gdl = POLLED_ACCOUNTS.find((account) => account.sourceKey === "gamedaylines")!;
const rosters = POLLED_ACCOUNTS.find((account) => account.sourceKey === "nhl_rosters")!;
const fhfh = POLLED_ACCOUNTS.find((account) => account.sourceKey === "fhfhockey")!;
const ccc = POLLED_ACCOUNTS.find((account) => account.sourceKey === "ccc")!;

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
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

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
    const body = `\ufeff {"status":${JSON.stringify(fxPost("1"))}}\n`;
    const capture = new WeakMap<object, FxStatusEvidence>();
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      return url.startsWith(PUBLIC_FX_BASE) ? response(404) : new Response(body);
    }) as unknown as typeof fetch;
    const result = await fetchFxChain("/2/status/1", fxSourcePlan("https://fx.example.dev"), { fetchImpl, sleep: noSleep, capture });
    expect(result).toMatchObject({ status: 200, attempts: 2, via: "mirror" });
    expect(urls).toEqual([`${PUBLIC_FX_BASE}/2/status/1`, "https://fx.example.dev/2/status/1"]);
    const payloadJson = JSON.stringify(fxPost("1"));
    expect(capture.get((result.body as { status: object }).status)).toEqual({
      tweetId: "1", via: "mirror", responseSha256: sha256(body), payloadJson, payloadSha256: sha256(payloadJson),
    });
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
const user = (username: string, id: number | string) => ({ id, id_str: String(id), username, displayname: `${username} name` });
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

  it("keeps media as FxTwitter has it: type, id, size, original-size photo URL, best video variant, gifs as videos", () => {
    const status = twscrapeToFxStatus(tweet({
      id_str: "910", user: user("FHFHockey", 42), rawContent: "Clips https://t.co/m1",
      media: {
        photos: [{ url: "https://pbs.twimg.com/media/A.jpg", id_str: "71", width: 1080, height: 1440, altText: "FHFH card" }],
        videos: [{ id_str: "72", thumbnailUrl: "https://pbs.twimg.com/t.jpg", duration: 12500, width: 1280, height: 720,
          variants: [{ contentType: "video/mp4", bitrate: 256000, url: "low.mp4" }, { contentType: "video/mp4", bitrate: 2176000, url: "high.mp4" }] }],
        animated: [{ id_str: "73", thumbnailUrl: "g.jpg", videoUrl: "g.mp4" }],
      },
    }), "FHFHockey")!;
    expect(status.media.all).toEqual([
      { id: "71", width: 1080, height: 1440, altText: "FHFH card", type: "photo", url: "https://pbs.twimg.com/media/A.jpg?name=orig" },
      { id: "72", width: 1280, height: 720, type: "video", url: "high.mp4", thumbnail_url: "https://pbs.twimg.com/t.jpg",
        format: "video/mp4", duration: 12.5 },
      { id: "73", type: "gif", url: "g.mp4", thumbnail_url: "g.jpg", format: "video/mp4" },
    ]);
    expect(status.media.photos).toHaveLength(1);
    expect(status.media.videos.map((item: { type: string }) => item.type)).toEqual(["video", "gif"]);
    expect(mapFxStatus(fhfh, status)).toMatchObject({ has_media: true, media_alt_texts: ["FHFH card"] });
    // A video without alt text still counts as media, as FxTwitter's media.all does.
    expect(mapFxStatus(fhfh, twscrapeToFxStatus(tweet({ id_str: "911", user: user("FHFHockey", 42), rawContent: "v",
      media: { photos: [], videos: [{ variants: [{ url: "v.mp4", bitrate: 1 }] }], animated: [] } }), "FHFHockey")!))
      .toMatchObject({ has_media: true, media_alt_texts: [] });
  });

  it("gives FxTwitter's two texts: raw_text with t.co links (what the row stores), text expanded and trimmed", () => {
    const status = twscrapeToFxStatus(tweet({
      id_str: "912", user: user("CcCMiddleton", 3), rawContent: "Lines 📺 https://t.co/aa https://t.co/media",
      displayTextRange: [0, 23], links: [{ url: "https://flosports.link/x", text: "flosports.link/x", tcourl: "https://t.co/aa" }],
    }), "CcCMiddleton")!;
    expect(status.raw_text).toEqual({ text: "Lines 📺 https://t.co/aa https://t.co/media", display_text_range: [0, 23] });
    expect(status.text).toBe("Lines 📺 https://flosports.link/x");
    expect(mapFxStatus(ccc, status)!.full_text).toBe("Lines 📺 https://t.co/aa https://t.co/media");
  });

  it("keeps a repost wrapper's identity and time, and X's created_at format", () => {
    const status = twscrapeToFxStatus(tweet({
      id_str: "2118930000000000000", date: "2026-11-07 05:00:00+00:00", user: user("CcCMiddleton", "825802740362121216"),
      rawContent: "RT @SDGullsAHL: Tonight…",
      retweetedTweet: tweet({ id_str: "2118897727937359955", date: "2026-11-07 02:46:00+00:00", user: user("SDGullsAHL", "3033984587"),
        rawContent: "Tonight's lineup" }),
    }), "CcCMiddleton")!;
    expect(status).toMatchObject({
      id: "2118897727937359955", created_timestamp: 1794019560, created_at: "Sat Nov 07 02:46:00 +0000 2026",
      reposted_by: { screen_name: "CcCMiddleton", id: "825802740362121216", name: "CcCMiddleton name" },
      repost_wrapper_id: "2118930000000000000", reposted_timestamp: Date.parse("2026-11-07T05:00:00Z") / 1000,
    });
    expect(timelineId(status)).toBe("2118930000000000000");
    expect(xCreatedAt(null)).toBeNull();
    const row = mapFxStatus(ccc, status)!;
    expect(row).toMatchObject({ tweet_id: "2118897727937359955", tweet_created_at: "2026-11-07T02:46:00.000Z" });
    const [observation] = toObservationRows([row], "123-1");
    expect(observation).toMatchObject({ tweet_id: "2118897727937359955", timeline_id: "2118930000000000000", run_id: "123-1" });
  });

  it("builds the same row as Layer 1 for a repost FxTwitter served (CCC, 2026-11-07)", () => {
    // FxTwitter's status as stored in x_timeline_shadow_posts, trimmed to the fields the mapper reads.
    const photo = { id: "2118887212050010112", url: "https://pbs.twimg.com/media/HWfMsWlb0AApqFY.jpg?name=orig", type: "photo",
      width: 1080, height: 1440 };
    const fxStatus = {
      type: "status", id: "2118897727937359955", url: "https://x.com/SDGullsAHL/status/2118897727937359955",
      text: "Tonight's lineup", raw_text: { text: "Tonight's lineup https://t.co/p", display_text_range: [0, 16] },
      author: { id: "3033984587", name: "San Diego Gulls", screen_name: "SDGullsAHL" },
      created_at: "Sat Nov 07 02:46:00 +0000 2026", created_timestamp: 1794019560, replying_to: null, quote: null,
      reposted_by: { id: "825802740362121216", name: "LinesLinesLines", screen_name: "CcCMiddleton" },
      media: { all: [photo], photos: [photo] },
    };
    const twscrape = twscrapeToFxStatus(tweet({
      id_str: "2118900000000000000", user: { ...user("CcCMiddleton", "825802740362121216"), displayname: "LinesLinesLines" },
      rawContent: "RT @SDGullsAHL: Tonight's lineup https://t.co/p",
      retweetedTweet: tweet({
        id_str: "2118897727937359955", date: "2026-11-07 02:46:00+00:00", rawContent: "Tonight's lineup https://t.co/p",
        user: { ...user("SDGullsAHL", "3033984587"), displayname: "San Diego Gulls" }, displayTextRange: [0, 16],
        media: { photos: [{ url: "https://pbs.twimg.com/media/HWfMsWlb0AApqFY.jpg", id_str: "2118887212050010112", width: 1080, height: 1440 }], videos: [], animated: [] },
      }),
    }), "CcCMiddleton")!;
    const { raw_payload: fxRaw, ...fromFx } = mapFxStatus(ccc, fxStatus)!;
    const { raw_payload: twRaw, ...fromTwscrape } = mapFxStatus(ccc, twscrape)!;
    expect(fromTwscrape).toEqual(fromFx);
    for (const key of ["id", "url", "text", "raw_text", "author", "created_at", "created_timestamp", "reposted_by", "media"]) {
      expect(twRaw[key as keyof typeof twRaw]).toEqual((fxRaw as Record<string, unknown>)[key]);
    }
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

  it("accepts shadow observe requests with a run id, and anchors", () => {
    expect(parseIngestRequest('{"mode":"anchors"}', keys)).toEqual({ mode: "anchors" });
    expect(parseIngestRequest('{"mode":"observe","sourceKey":"ccc","runId":"19123-1","tweets":[]}', keys))
      .toEqual({ mode: "observe", sourceKey: "ccc", runId: "19123-1", tweets: [] });
    for (const runId of [undefined, "", "a b", "x".repeat(65), 7]) {
      expect(parseIngestRequest(JSON.stringify({ mode: "observe", sourceKey: "ccc", runId, tweets: [] }), keys))
        .toHaveProperty("error");
    }
  });

  it("picks the newest X id as an integer, not as text", () => {
    expect(newestId(["999", "2118897727937359955", "2118897727937359956", null, "x"])).toBe("2118897727937359956");
    expect(newestId([])).toBeNull();
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

describe("x-timeline-poll receipt capture", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const pollerPath = "../../../supabase/functions/x-timeline-poll/index.ts";
  const pollerModules = import.meta.glob("../../../supabase/functions/x-timeline-poll/index.ts");

  async function bindPoller(db: unknown, captureSources: string | undefined, fetchImpl: typeof fetch) {
    vi.resetModules();
    createPollClient.mockReturnValue(db);
    const serve = vi.fn<(handler: (req: Request) => Promise<Response>) => void>();
    vi.stubGlobal("Deno", { env: { get: (key: string) => key === "LUNA_FXTWITTER_CAPTURE_SOURCE_KEYS" ? captureSources : undefined }, serve });
    vi.stubGlobal("fetch", fetchImpl);
    await pollerModules[pollerPath]();
    return (secret?: string) => serve.mock.calls[0][0](new Request("https://poller.test", {
      method: "POST", headers: secret ? { "x-fhfh-poll-secret": secret } : {},
    }));
  }

  const captureRpc = "luna_store_fxtwitter_rows_v1";
  const firstSeen = "2026-11-06T20:00:00Z";
  const switched = "2026-11-06T19:00:00Z";
  const scope = " nhl_rosters, ";
  const wrapper = { ...fxPost("91"), text: "RT @BeatWriter: Truncated…" };
  const original = { ...fxPost("89", "BeatWriter"), text: "Full status", reposted_by: { screen_name: "NHL_Rosters" } };
  const firstPage = `\ufeff ${JSON.stringify({ ...page(["91", "90"]), results: [wrapper, fxPost("90")] }, null, 2)}\n`;
  const olderPage = JSON.stringify({ ...page(["90", "89", "87", "88"]), results: [
    { ...fxPost("90"), text: "Older page copy of 90" }, { ...original, text: "Older page copy of 89" }, fxPost("87"), fxPost("88"),
  ] });
  const hydratedStatus = ` {"status":${JSON.stringify(original)}}\n`;

  function pollerFetch(redelivered = false) {
    return vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      expect(url.origin).toBe(PUBLIC_FX_BASE);
      if (url.pathname === "/2/status/91") return new Response(hydratedStatus);
      if (url.pathname === "/2/profile/NHL_Rosters/statuses") {
        if (url.searchParams.get("cursor") === "cursor-after-90") return new Response(olderPage);
        if (!redelivered) return new Response(firstPage);
        return Response.json({ ...page(["91", "90"]), results: [wrapper, { ...fxPost("90"), text: "Later copy of 90" }] });
      }
      if (url.pathname === "/2/profile/CcCMiddleton/statuses") return Response.json({ results: [fxPost("86", "CcCMiddleton")] });
      return Response.json({ results: [] });
    });
  }

  function pollerDb(loseCaptureAcknowledgement = false) {
    const shadow = new Map<string, fx.ShadowPostRow>();
    const receipts = new Map<string, FxStatusEvidence>();
    const queue = new Map<string, Record<string, unknown>>();
    const store = (rows: fx.ShadowPostRow[]) => rows.flatMap((row) => {
      const key = `${row.source_key}:${row.tweet_id}`;
      if (shadow.has(key)) return [];
      shadow.set(key, row);
      return [{ tweet_id: row.tweet_id }];
    });
    store(mapFxProfileFeed(rosters, page(["88"])));
    const shadowUpsert = vi.fn(store);
    const rpc = vi.fn(async (fn: string, args: { p_rows?: fx.ShadowPostRow[]; p_evidence?: FxStatusEvidence[] }) => {
      if (fn === "x_timeline_poll_secret_matches") return { data: true, error: null };
      expect(fn).toBe(captureRpc);
      const data = store(args.p_rows!);
      for (const { tweet_id } of data) {
        const evidence = args.p_evidence!.find((item) => item.tweetId === tweet_id);
        if (evidence) receipts.set(tweet_id, evidence);
      }
      if (loseCaptureAcknowledgement) throw new Error("Connection closed");
      return { data, error: null };
    });
    const from = (table: string) => {
      let sourceKey: string;
      let ids: string[] | undefined;
      let pending: any[] | undefined;
      const chain = {
        select: () => chain, limit: () => chain,
        eq: (_name: string, key: string) => { sourceKey = key; return chain; },
        in: (_name: string, keys: string[]) => { ids = keys; return chain; },
        or: (clause: string) => { ids = clause.match(/^tweet_id\.in\.\(([^)]+)\)/)?.[1].split(","); return chain; },
        upsert: (rows: any[]) => { pending = rows; return chain; },
        then: (resolve: (value: unknown) => void) => {
          if (table === "tweet_intake_providers") {
            return resolve({ data: [{ source_key: rosters.sourceKey, provider: "fxtwitter", switched_at: switched }] });
          }
          if (table === "x_timeline_shadow_posts") {
            if (pending) return resolve({ data: shadowUpsert(pending) });
            const data = [...shadow.values()].filter((row) => row.source_key === sourceKey).flatMap((row) => {
              const wrapper = row.raw_payload.repost_wrapper_id as string | undefined;
              if (ids && !ids.includes(row.tweet_id) && !(wrapper && ids.includes(wrapper))) return [];
              return [{ tweet_id: row.tweet_id, first_seen_at: firstSeen, wrapper }];
            });
            return resolve({ data });
          }
          expect(table).toBe("line_source_ifttt_events");
          return resolve({ data: pending!.flatMap((row) => {
            if (queue.has(row.tweet_id)) return [];
            queue.set(row.tweet_id, row);
            return [{ id: row.tweet_id }];
          }) });
        },
      };
      return chain;
    };
    return { rpc, from, receipts, shadow, queue, shadowUpsert };
  }

  async function pollRosters(poll: Awaited<ReturnType<typeof bindPoller>>) {
    const result = await poll("authenticated");
    expect(result.status).toBe(200);
    const body = await result.json();
    return body.results.find((row: { sourceKey: string }) => row.sourceKey === rosters.sourceKey);
  }

  it("requires poll-secret authentication before any source reads", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const rpc = vi.fn(async () => ({ data: false, error: null }));
    const poll = await bindPoller({ rpc }, "nhl_rosters", fetchImpl);
    expect((await poll()).status).toBe(401);
    expect((await poll("bad")).status).toBe(401);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("x_timeline_poll_secret_matches", { p_secret: "bad" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("binds receipt evidence to the selected response across profile, gap and hydration while preserving old intake", async () => {
    const active = pollerDb();
    const activeFetch = pollerFetch();
    const activeResult = await pollRosters(await bindPoller(active, scope, activeFetch));
    expect(activeResult).toMatchObject({ gap: "recovered", gapPages: 1, hydrated: 1, seen: 4, inserted: 3, enqueued: 3 });
    const captures = active.rpc.mock.calls.filter(([name]) => name === captureRpc);
    expect(captures).toHaveLength(1);
    const evidenceFor = (tweetId: string, response: string, raw: object) => {
      const payloadJson = JSON.stringify(raw);
      return { tweetId, via: "public", responseSha256: sha256(response), payloadJson, payloadSha256: sha256(payloadJson) };
    };
    expect(captures[0][1].p_evidence).toEqual([
      evidenceFor("89", hydratedStatus, original), evidenceFor("90", firstPage, fxPost("90")), evidenceFor("87", olderPage, fxPost("87")),
    ]);
    expect(captures[0][1].p_rows?.map((row) => row.tweet_id)).toEqual(["89", "90", "87"]);
    expect(captures[0][1].p_rows?.[0].raw_payload).toEqual({ ...original, repost_wrapper_id: "91" });
    expect(active.shadow.get("ccc:86")).toBeDefined();

    const inactive = pollerDb();
    const inactiveFetch = pollerFetch();
    const inactiveResult = await pollRosters(await bindPoller(inactive, undefined, inactiveFetch));
    expect(inactiveResult).toEqual(activeResult);
    expect(inactiveFetch.mock.calls.map(([url]) => url)).toEqual(activeFetch.mock.calls.map(([url]) => url));
    expect(inactive.shadow).toEqual(active.shadow);
    expect(inactive.queue).toEqual(active.queue);
    expect(inactive.rpc.mock.calls.map(([name]) => name)).toEqual(["x_timeline_poll_secret_matches"]);

    const before = active.receipts.get("90");
    const repeatFetch = pollerFetch(true);
    const repeatResult = await pollRosters(await bindPoller(active, scope, repeatFetch));
    expect(repeatResult).toMatchObject({ hydrated: 0, inserted: 0, enqueued: 0 });
    expect(repeatFetch.mock.calls.some(([url]) => String(url).includes("/2/status/91"))).toBe(false);
    expect(active.receipts.get("90")).toEqual(before);
    const redelivery = active.rpc.mock.calls.filter(([name]) => name === captureRpc).at(-1);
    expect(redelivery?.[1].p_evidence?.[0].tweetId).toBe("90");
    expect(redelivery?.[1].p_evidence?.[0].payloadSha256).not.toBe(before!.payloadSha256);
  });

  it("continues intake and reports missing evidence without substituting another status", async () => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, "digest").mockImplementation((algorithm, data) =>
      new TextDecoder().decode(data) === JSON.stringify(original)
        ? Promise.reject(new Error("Digest unavailable")) : digest(algorithm, data));
    const db = pollerDb();
    const result = await pollRosters(await bindPoller(db, scope, pollerFetch()));
    expect(result).toMatchObject({ inserted: 3, enqueued: 3, captureError: "capture_evidence_missing" });
    // The older gap page's different status with id 89 cannot substitute for the hydrated payload's missing hash.
    expect([...db.receipts.keys()]).toEqual(["90", "87"]);
    expect(db.shadow.get("nhl_rosters:89")?.raw_payload).toEqual({ ...original, repost_wrapper_id: "91" });
  });

  it("reports capture uncertainty and attempts normal intake after the RPC acknowledgement is lost", async () => {
    const db = pollerDb(true);
    const result = await pollRosters(await bindPoller(db, scope, pollerFetch()));
    expect(result).toMatchObject({ inserted: 0, enqueued: 3, captureError: "capture_rpc_unacknowledged", captureFallback: true });
    expect(db.rpc.mock.calls.filter(([name]) => name === captureRpc)).toHaveLength(1);
    expect(db.shadowUpsert.mock.calls.find(([rows]) => rows[0].source_key === rosters.sourceKey)?.[0])
      .toHaveLength(4);
  });
});

describe("xTimelineStore: the poller's store-and-enqueue, shared with the ingest function", () => {
  const rows = mapFxProfileFeed(rosters, page(["9", "8"]));
  const evidenceFor = (row: fx.ShadowPostRow) => ({ tweetId: row.tweet_id });

  it.each([
    { shape: "row objects", data: [{ tweet_id: "9" }] },
    { shape: "scalar IDs", data: ["9"] },
  ])("accepts RPC acknowledgements as $shape", async ({ data }) => {
    const { db, calls } = fakeDb({});
    const rpc = vi.fn(async () => ({ data, error: null }));
    expect(await storeAndEnqueue({ ...db, rpc }, fx, rosters, rows, null, evidenceFor))
      .toEqual({ ok: true, seen: 2, inserted: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it.each([
    { shape: "duplicate scalar IDs", data: ["9", "9"] },
    { shape: "duplicate row IDs", data: [{ tweet_id: "8" }, { tweet_id: "8" }] },
    { shape: "an unknown ID", data: ["7"] },
    { shape: "a malformed row", data: [{ tweet_id: 9 }] },
    { shape: "mixed return formats", data: ["8", { tweet_id: "9" }] },
  ])("falls back when the RPC acknowledges $shape", async ({ data }) => {
    const { db, calls } = fakeDb({ x_timeline_shadow_posts: [{ data: [{ tweet_id: "8" }] }] });
    const rpc = vi.fn(async () => ({ data, error: null }));
    expect(await storeAndEnqueue({ ...db, rpc }, fx, rosters, rows, null, evidenceFor)).toEqual({
      ok: true, seen: 2, inserted: 1, captureError: "capture_rpc_unacknowledged", captureFallback: true,
    });
    expect(calls.filter((call) => call.op === "upsert")).toHaveLength(1);
  });

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

/**
 * A supabase-js stand-in that throws on any write to a table other than the shadow observations table, and records
 * every table and RPC touched. Reads answer from `answers`, in turn.
 */
function guardedDb(answers: Record<string, Array<{ data?: unknown; error?: unknown }>> = {}) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
  const rpcs: Array<{ fn: string; args: unknown }> = [];
  const from = (table: string) => {
    const chain: any = {};
    for (const op of ["select", "eq", "in", "order", "limit", "maybeSingle", "upsert", "insert", "update", "delete"]) {
      chain[op] = (...args: unknown[]) => {
        if (["upsert", "insert", "update", "delete"].includes(op) && table !== OBSERVATIONS_TABLE) {
          throw new Error(`shadow wrote ${table}`);
        }
        calls.push({ table, op, args });
        return chain;
      };
    }
    chain.then = (resolve: (value: unknown) => void) =>
      resolve({ error: null, ...(answers[table]?.shift() ?? { data: [] }) });
    return chain;
  };
  const rpc = async (fn: string, args: unknown) => {
    rpcs.push({ fn, args });
    return fn === "x_timeline_twscrape_observations_prune" ? { data: 3, error: null } : { data: null, error: null };
  };
  return { db: { from, rpc }, calls, rpcs };
}

const ingestDeps = (db: ReturnType<typeof guardedDb>["db"], liveEnabled = false) => ({
  db, accounts: POLLED_ACCOUNTS, liveEnabled, mapFeed: mapFxProfileFeed, feedBody: twscrapeFeedBody, toObservationRows,
  newestId, switchedAtFor,
  storeAndEnqueue: (client: any, account: any, rows: any[], switchedAt: string | null) =>
    storeAndEnqueue(client, fx, account, rows, switchedAt),
});
const PRODUCTION_TABLES = ["x_timeline_shadow_posts", "line_source_ifttt_events", "lines_ccc_ifttt_events",
  "social_share_x_posts", "tweet_intake_providers"];

describe("x-timeline-ingest handler: shadow mode cannot write production", () => {
  // A card post with media, a repost and a quote, as twscrape would send them, for each kind of account.
  const tweetsFor = (handle: string) => [
    tweet({ id_str: "2118900000000000010", user: user(handle, "11"), rawContent: "Card https://t.co/c",
      media: { photos: [{ url: "https://pbs.twimg.com/media/C.jpg", altText: "FHFH card: Player" }], videos: [], animated: [] } }),
    tweet({ id_str: "2118900000000000009", date: "2026-11-07 05:00:00+00:00", user: user(handle, "11"),
      rawContent: "RT @BeatWriter: Lines…",
      retweetedTweet: tweet({ id_str: "2118800000000000001", user: user("BeatWriter", "12"), rawContent: "Lines" }) }),
    tweet({ id_str: "2118900000000000008", user: user(handle, "11"), rawContent: "Quote",
      quotedTweet: tweet({ id_str: "2118700000000000001", user: user("TeamX", "13"), rawContent: "Recalled" }) }),
  ];

  for (const account of POLLED_ACCOUNTS) {
    it(`observe writes only the observations table for ${account.handle}`, async () => {
      const { db, calls, rpcs } = guardedDb({ [OBSERVATIONS_TABLE]: [{ data: [{ tweet_id: "x" }] }] });
      const request = parseIngestRequest(JSON.stringify({ mode: "observe", sourceKey: account.sourceKey, runId: "1-1",
        tweets: tweetsFor(account.handle) }), POLLED_ACCOUNTS.map((candidate) => candidate.sourceKey));
      expect(request).toMatchObject({ mode: "observe" });
      const result = await handleIngest(request as any, ingestDeps(db));
      expect(result).toMatchObject({ status: 200, body: { ok: true, mode: "observe", received: 3, mapped: 3 } });
      expect(new Set(calls.map((call) => call.table))).toEqual(new Set([OBSERVATIONS_TABLE]));
      expect(calls.map((call) => call.op)).toEqual(["upsert", "select"]);
      expect(rpcs).toEqual([]);
    });
  }

  it("dedupes: one row per (source_key, tweet_id), first observation wins, with the X and repost times", async () => {
    const { db, calls } = guardedDb();
    const tweets = [...tweetsFor("GameDayLines"), ...tweetsFor("GameDayLines")];
    await handleIngest({ mode: "observe", sourceKey: "gamedaylines", runId: "2-1", tweets }, ingestDeps(db));
    const upsert = calls.find((call) => call.op === "upsert")!;
    const rows = upsert.args[0] as Array<Record<string, unknown>>;
    expect(rows.map((row) => row.tweet_id)).toEqual(["2118900000000000010", "2118800000000000001", "2118900000000000008"]);
    expect(upsert.args[1]).toEqual({ onConflict: "source_key,tweet_id", ignoreDuplicates: true });
    expect(rows[1]).toMatchObject({
      post_kind: "repost", timeline_id: "2118900000000000009", tweet_created_at: "2026-11-06T19:06:38.000Z",
      reposted_at: "2026-11-07T05:00:00.000Z", run_id: "2-1",
    });
    expect(rows[0]).toMatchObject({ reposted_at: null, tweet_created_at: "2026-11-06T19:06:38.000Z" });
    expect(rows.every((row) => !("first_observed_at" in row))).toBe(true); // the database's clock, not the job's
  });

  it("anchors prunes to the retention window and reads only the observations table", async () => {
    const { db, calls, rpcs } = guardedDb({
      [OBSERVATIONS_TABLE]: [{ data: [{ timeline_id: "2118897727937359955" }, { timeline_id: "999" }] }],
    });
    const result = await handleIngest({ mode: "anchors" }, ingestDeps(db));
    expect(RETENTION_DAYS).toBe(14);
    expect(rpcs).toEqual([{ fn: "x_timeline_twscrape_observations_prune", args: { p_days: 14 } }]);
    expect(result.body).toMatchObject({ ok: true, pruned: 3, anchors: { dfofantasy: "2118897727937359955", ccc: null } });
    expect(new Set(calls.map((call) => call.table))).toEqual(new Set([OBSERVATIONS_TABLE]));
    expect(calls.some((call) => ["upsert", "insert", "update", "delete"].includes(call.op))).toBe(false);
  });

  it("refuses live ingest while shadow, before touching any table", async () => {
    const { db, calls, rpcs } = guardedDb();
    for (const sourceKey of ["dfofantasy", "ccc", "fhfhockey"]) {
      const request = parseIngestRequest(JSON.stringify({ mode: "ingest", sourceKey, tweets: tweetsFor("DFOFantasy") }),
        POLLED_ACCOUNTS.map((account) => account.sourceKey));
      expect(await handleIngest(request as any, ingestDeps(db))).toEqual({
        status: 403, body: { ok: false, error: "Live ingest is disabled (shadow mode)" },
      });
    }
    expect(calls).toEqual([]);
    expect(rpcs).toEqual([]);
  });

  it("ignores anything in an observe body that names a production table or asks for live", () => {
    const keys = POLLED_ACCOUNTS.map((account) => account.sourceKey);
    const parsed = parseIngestRequest(JSON.stringify({ mode: "observe", sourceKey: "ccc", runId: "3-1", tweets: [],
      live: true, table: "lines_ccc_ifttt_events", queue: "line_source_ifttt_events", socialShare: true }), keys);
    expect(parsed).toEqual({ mode: "observe", sourceKey: "ccc", runId: "3-1", tweets: [] });
    for (const table of PRODUCTION_TABLES) {
      expect(parseIngestRequest(JSON.stringify({ mode: table, sourceKey: "ccc", tweets: [] }), keys)).toHaveProperty("error");
    }
  });

  it("the guard is real: live ingest for a switched account would write the shadow table and is caught", async () => {
    const { db } = guardedDb({ tweet_intake_providers: [{ data: { provider: "fxtwitter", switched_at: "2026-11-01T00:00:00Z" } }] });
    await expect(handleIngest({ mode: "ingest", sourceKey: "dfofantasy", tweets: tweetsFor("DFOFantasy") },
      ingestDeps(db, true))).rejects.toThrow("shadow wrote x_timeline_shadow_posts");
  });
});
