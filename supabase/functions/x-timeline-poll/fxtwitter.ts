// Pure mapping from FxTwitter's public profile feed (GET api.fxtwitter.com/2/profile/{handle}/statuses) to
// x_timeline_shadow_posts rows. No Deno or npm imports, so web/ Vitest can test it.

export type PolledAccount = { handle: string; sourceKey: string; sourceGroup: string };

/** The accounts IFTTT tracks today, with the source keys its receivers use. */
export const POLLED_ACCOUNTS: PolledAccount[] = [
  { handle: "DFOFantasy", sourceKey: "dfofantasy", sourceGroup: "dfo" },
  { handle: "NHL_Rosters", sourceKey: "nhl_rosters", sourceGroup: "nhl_rosters" },
  { handle: "CcCMiddleton", sourceKey: "ccc", sourceGroup: "ccc" },
  { handle: "GameDayLines", sourceKey: "gamedaylines", sourceGroup: "gdl_suite" },
  { handle: "GameDayNewsNHL", sourceKey: "gamedaynewsnhl", sourceGroup: "gdl_suite" },
  { handle: "GameDayGoalies", sourceKey: "gamedaygoalies", sourceGroup: "gdl_suite" },
  { handle: "FHFHockey", sourceKey: "fhfhockey", sourceGroup: "social_share" },
];

export type ShadowPostRow = {
  source_group: string;
  source_key: string;
  source_account: string;
  tweet_id: string;
  post_kind: "post" | "repost" | "quote";
  author_handle: string;
  reposted_by_handle: string | null;
  original_author_handle: string | null;
  quoted_tweet_id: string | null;
  quoted_author_handle: string | null;
  quoted_text: string | null;
  replying_to_handle: string | null;
  full_text: string | null;
  text: string | null;
  link_to_tweet: string;
  tweet_created_at: string | null;
  has_media: boolean;
  media_alt_texts: string[];
  raw_payload: Record<string, unknown>;
};

type Status = Record<string, any>;

const id = (value: unknown) => (typeof value === "string" && /^\d+$/.test(value) ? value : null);
const handle = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9_]{1,15}$/.test(value) ? value : null;
const same = (a: string | null, b: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
// X escapes only these three in post text; FxTwitter passes them through, IFTTT delivered them decoded.
const unescape = (text: string) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const RT_PREFIX = /^RT @([A-Za-z0-9_]{1,15}): /;
const bodyText = (status: Status): string | null => {
  const text = status.raw_text?.text ?? status.text;
  return typeof text === "string" ? unescape(text) : null;
};

function postedAt(status: Status): string | null {
  if (Number.isFinite(status.created_timestamp)) return new Date(status.created_timestamp * 1000).toISOString();
  const parsed = typeof status.created_at === "string" ? Date.parse(status.created_at) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function altTexts(status: Status): string[] {
  const items = Array.isArray(status.media?.all) ? status.media.all : [];
  return items
    .map((item: any) => item?.altText ?? item?.alt_text)
    .filter((alt: unknown): alt is string => typeof alt === "string" && alt.trim() !== "");
}

/**
 * One feed status as a shadow row, or null when it is not a post or repost by the tracked account. A repost arrives
 * as the original post with reposted_by set to the account, so tweet_id and the time are the original's.
 */
export function mapFxStatus(account: PolledAccount, status: Status): ShadowPostRow | null {
  if (!status || typeof status !== "object") return null;
  const tweetId = id(status.id);
  const author = handle(status.author?.screen_name);
  const url = typeof status.url === "string" ? status.url : null;
  if (!tweetId || !author || !url) return null;

  const repostedBy = handle(status.reposted_by?.screen_name);
  const isRepost = same(repostedBy, account.handle) && !same(author, account.handle);
  if (!isRepost && !same(author, account.handle)) return null;

  const quote = status.quote && typeof status.quote === "object" ? (status.quote as Status) : null;
  const quotedId = quote ? id(quote.id) : null;
  const quotedUrl = quote && typeof quote.url === "string" ? quote.url : null;
  const text = bodyText(status);
  // Sometimes FxTwitter returns the repost wrapper itself: authored by the account, text "RT @author: …" cut at about
  // 140 characters, id the wrapper's. Keep the nested handle; mapFxWrappedRepost swaps in the full original.
  const wrapped = !isRepost ? text?.match(RT_PREFIX) ?? null : null;
  const fullText = wrapped && text ? text.slice(wrapped[0].length) : text;
  const originalAuthor = isRepost ? author : wrapped ? wrapped[1] : null;
  // IFTTT's shape: reposts carry "RT @author: " and a quote's link sits in the text. A direct status URL lets the
  // existing quote resolver find the quoted post.
  const compatText = fullText === null ? null
    : `${originalAuthor ? `RT @${originalAuthor}: ` : ""}${fullText}${quotedUrl ? ` ${quotedUrl}` : ""}`;
  const alts = altTexts(status);

  return {
    source_group: account.sourceGroup,
    source_key: account.sourceKey,
    source_account: account.handle,
    tweet_id: tweetId,
    post_kind: originalAuthor ? "repost" : quote ? "quote" : "post",
    author_handle: originalAuthor ?? author,
    reposted_by_handle: isRepost ? repostedBy : wrapped ? author : null,
    original_author_handle: originalAuthor,
    quoted_tweet_id: quotedId,
    quoted_author_handle: quote ? handle(quote.author?.screen_name) : null,
    quoted_text: quote ? bodyText(quote) : null,
    replying_to_handle: handle(status.replying_to?.screen_name ?? status.replying_to),
    full_text: fullText,
    text: compatText,
    link_to_tweet: url,
    tweet_created_at: postedAt(status),
    has_media: alts.length > 0 || (Array.isArray(status.media?.all) && status.media.all.length > 0),
    media_alt_texts: alts,
    raw_payload: status,
  };
}

const FEED_URL = (handle: string) => `https://api.fxtwitter.com/2/profile/${handle}/statuses?count=20`; // 20 is the cap.
const STATUS_URL = (tweetId: string) => `https://api.fxtwitter.com/2/status/${tweetId}`;
const USER_AGENT = "fhfhockey-timeline-poller (+https://fhfhockey.com)";

type FetchOptions = { attempts?: number; delayMs?: number; timeoutMs?: number; deadline?: number };
type FetchResult = { status: number; attempts: number; body: unknown };

/**
 * One account's latest page. On 2026-11-05 FxTwitter answered about 40% of profile requests with a 404 at random
 * (an upstream failure, not a missing account), so a 404 or 5xx is retried up to `attempts` times. A miss is
 * recovered by the next run: the 20-post page covers more than an hour of DFO's busiest lineup window.
 */
export function fetchFxProfileFeed(account: PolledAccount, options: FetchOptions = {}): Promise<FetchResult> {
  return fetchFx(FEED_URL(account.handle), options);
}

/** One status by id. For a repost wrapper's id it returns the full original, with reposted_by set. */
export function fetchFxStatus(tweetId: string, options: FetchOptions = {}): Promise<FetchResult> {
  return fetchFx(STATUS_URL(tweetId), options);
}

async function fetchFx(url: string, options: FetchOptions): Promise<FetchResult> {
  const { attempts = 3, delayMs = 1500, timeoutMs = 8000, deadline = Infinity } = options;
  let status = 0;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(timeoutMs),
      });
      status = response.status;
      if (response.ok) return { status, attempts: attempt, body: await response.json() };
      await response.body?.cancel();
    } catch {
      status = 0;
    }
    const retryable = status === 0 || status === 404 || status === 429 || status >= 500;
    if (!retryable || attempt >= attempts || Date.now() + delayMs + timeoutMs > deadline) {
      return { status, attempts: attempt, body: null };
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

/** Every usable row in one feed page; a page that is not FxTwitter's shape yields none. */
export function mapFxProfileFeed(account: PolledAccount, body: unknown): ShadowPostRow[] {
  const results = (body as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  const rows = results.map((status) => mapFxStatus(account, status)).filter((row): row is ShadowPostRow => !!row);
  // A page can list a post twice (pinned); keep the first.
  return rows.filter((row, index) => rows.findIndex((other) => other.tweet_id === row.tweet_id) === index);
}

// --- Cutover: feeding the live queues (see handoffs/IFTTT-TO-FXTWITTER-CUTOVER/DEBRIEF.md) ---

export type QueueTable = "line_source_ifttt_events" | "lines_ccc_ifttt_events";

/** The live queue an account's posts go to; null for accounts that do not feed one (FHFHockey). */
export function queueTableFor(account: PolledAccount): QueueTable | null {
  if (account.sourceGroup === "ccc") return "lines_ccc_ifttt_events";
  return account.sourceGroup === "social_share" ? null : "line_source_ifttt_events";
}

/**
 * The X API v2 shape web/lib/sources/tweetSourceDirectory.ts (tweetClaimAttribution) reads to credit a repost to its
 * original author. Only for a full original (not an unhydrated wrapper, whose author is the reposting account).
 */
export function toV2Payload(row: ShadowPostRow): Record<string, unknown> {
  const fx = row.raw_payload as Status;
  const authorId = id(fx.author?.id);
  if (row.post_kind !== "repost" || !authorId || row.full_text === null
    || !same(handle(fx.author?.screen_name), row.original_author_handle)) return {};
  return {
    data: { id: row.tweet_id, referenced_tweets: [{ type: "retweeted", id: row.tweet_id }] },
    includes: {
      tweets: [{ id: row.tweet_id, text: row.full_text, author_id: authorId, created_at: row.tweet_created_at }],
      users: [{ id: authorId, username: row.original_author_handle }],
    },
  };
}

/** The quoted post as the processors' quote resolver would return it, so they can skip the t.co/oEmbed lookup. */
function quoteSummary(row: ShadowPostRow): Record<string, unknown> | null {
  const quote = (row.raw_payload as Status).quote as Status | null | undefined;
  const url = typeof quote?.url === "string" ? quote.url : null;
  if (!quote || !row.quoted_tweet_id || !url) return null;
  return {
    id: row.quoted_tweet_id, url, text: row.quoted_text, author_handle: row.quoted_author_handle,
    author_name: typeof quote.author?.name === "string" ? quote.author.name : null, created_at: postedAt(quote),
  };
}

/**
 * A pending row for the live queue, in the shape the IFTTT receiver writes (lineSourceIftttReceiver.ts). `firstSeenAt`
 * is the shadow row's first_seen_at, kept as raw_payload.first_seen_at so the Lines engine can date the post by when
 * the scraper first saw it rather than by the queue insert (received_at).
 */
export function toQueueRow(row: ShadowPostRow, table: QueueTable, firstSeenAt: string | null = null): Record<string, unknown> {
  return {
    source: "fxtwitter",
    ...(table === "lines_ccc_ifttt_events" ? {} : { source_group: row.source_group, source_key: row.source_key }),
    source_account: row.source_account,
    username: row.source_account,
    text: row.text,
    link_to_tweet: row.link_to_tweet,
    tweet_id: row.tweet_id,
    tweet_embed_code: null,
    tweet_created_at: row.tweet_created_at,
    created_at_label: row.tweet_created_at,
    processing_status: "pending",
    raw_payload: { provider: "fxtwitter", fx: row.raw_payload, quote: quoteSummary(row), ...toV2Payload(row),
      ...(firstSeenAt ? { first_seen_at: firstSeenAt } : {}) },
  };
}

/**
 * Rows to enqueue for an account switched to fxtwitter at `switchedAt`: those first seen at or after the switch.
 * Earlier sightings came in through IFTTT. Re-sending a row is harmless (the queue upsert ignores duplicates), so a
 * failed enqueue is retried on the next run while the post is still on the page.
 */
export function rowsToEnqueue(
  rows: ShadowPostRow[], firstSeen: Array<{ tweet_id: string; first_seen_at: string }>, switchedAt: string,
): ShadowPostRow[] {
  const since = Date.parse(switchedAt);
  if (!Number.isFinite(since)) return [];
  const seenAt = new Map(firstSeen.map((entry) => [entry.tweet_id, Date.parse(entry.first_seen_at)]));
  return rows.filter((row) => (seenAt.get(row.tweet_id) ?? -Infinity) >= since);
}

/**
 * A social_share_x_posts row for one of @FHFHockey's own posts, replacing the IFTTT trigger "New photo or video by you"
 * (web/pages/api/v1/sources/ifttt/FHFHockey-post.ts): own posts and quotes that carry media; reposts never. posted_at is
 * the post's own X timestamp. alt_text is the first media alt text that starts with "FHFH " (the one the card matcher
 * reads), else the first alt text; matched_card comes from `matchCard`, the shared copy of postedWeek's matcher. The
 * caller upserts on tweet_id ignoring duplicates, so a post IFTTT already stored keeps its row. Null when not eligible.
 */
export function toSocialShareRow(
  account: PolledAccount, row: ShadowPostRow, matchCard: (altText: string | null) => string | null,
): Record<string, unknown> | null {
  if (account.sourceGroup !== "social_share" || !same(row.source_account, account.handle)) return null;
  if ((row.post_kind !== "post" && row.post_kind !== "quote") || !row.has_media) return null;
  if (!same(handle((row.raw_payload as Status).author?.screen_name), account.handle)) return null;
  const altText = row.media_alt_texts.find((alt) => /^\s*FHFH\s/.test(alt)) ?? row.media_alt_texts[0] ?? null;
  return {
    tweet_id: row.tweet_id,
    post_link: row.link_to_tweet,
    username: account.handle,
    posted_at: row.tweet_created_at,
    created_at_label: row.tweet_created_at,
    post_text: row.full_text,
    alt_text: altText,
    matched_card: matchCard(altText),
    raw_payload: { provider: "fxtwitter", fx: row.raw_payload },
  };
}

/** True for a repost that arrived as the wrapper (see mapFxStatus): its id and text are the wrapper's. */
export function isRepostWrapper(account: PolledAccount, row: ShadowPostRow): boolean {
  return row.post_kind === "repost" && same(handle((row.raw_payload as Status).author?.screen_name), account.handle);
}

/**
 * The full original behind a repost wrapper, from fetchFxStatus(wrapper id): keyed by the original's id like every
 * other repost, with the wrapper's id kept as raw_payload.repost_wrapper_id. Null when the body is not that repost.
 */
export function mapFxWrappedRepost(account: PolledAccount, wrapper: ShadowPostRow, body: unknown): ShadowPostRow | null {
  const row = mapFxStatus(account, (body as { status?: Status })?.status as Status);
  if (!row || row.post_kind !== "repost" || isRepostWrapper(account, row)) return null;
  if (!same(row.original_author_handle, wrapper.original_author_handle)) return null;
  return { ...row, raw_payload: { ...row.raw_payload, repost_wrapper_id: wrapper.tweet_id } };
}
