// Layer 3 of the X intake safety net (tasks/artifacts/x-intake-safety-net-design-2026-11-06.md §2.3): a twscrape
// Tweet (Python `tweet.dict()`, posted by TJ's Raspberry Pi to the x-timeline-ingest edge function) converted to the
// FxTwitter status shape, so the poller's own mapper (mapFxStatus) builds the shadow and queue rows. One mapping for
// every source. A repost becomes the original status with reposted_by set, as FxTwitter returns it.
// Field names follow twscrape/models.py (Tweet, User, UserRef, Media*), checked 2026-11-06. Pure, no imports.

type Json = Record<string, any>;

const digits = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return typeof value === "string" && /^\d{1,25}$/.test(value) ? value : null;
};
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** Seconds since the epoch from twscrape's `date`: an ISO string, or Python's str(datetime) "2026-11-06 19:06:38+00:00". */
export function twscrapeTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const iso = /^\d{4}-\d{2}-\d{2} \d/.test(value) ? value.replace(" ", "T") : value;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function author(user: unknown): Json | null {
  const record = user && typeof user === "object" ? (user as Json) : null;
  const screenName = text(record?.username);
  const id = digits(record?.id_str) ?? digits(record?.id);
  if (!record || !screenName || !id) return null;
  return { screen_name: screenName, id, name: text(record.displayname) ?? screenName };
}

function media(tweet: Json): Json {
  const groups = tweet.media && typeof tweet.media === "object" ? tweet.media : {};
  const all = ["photos", "videos", "animated"].flatMap((key) => (Array.isArray(groups[key]) ? groups[key] : []))
    .filter((item: unknown) => item && typeof item === "object")
    .map((item: Json) => ({ ...(typeof item.altText === "string" && item.altText.trim() ? { altText: item.altText } : {}) }));
  return all.length ? { all } : {};
}

/** One twscrape Tweet as a bare FxTwitter status (no reposted_by), or null when its identity is unusable. */
function status(tweet: unknown, depth = 0): Json | null {
  const record = tweet && typeof tweet === "object" ? (tweet as Json) : null;
  if (!record || depth > 2) return null;
  const id = digits(record.id_str) ?? digits(record.id);
  const who = author(record.user);
  const body = text(record.rawContent);
  if (!id || !who || body === null) return null;
  const quoted = record.quotedTweet ? status(record.quotedTweet, depth + 1) : null;
  const replyingTo = text(record.inReplyToUser?.username) ?? text(record.inReplyToScreenName);
  return {
    type: "status",
    id,
    url: `https://x.com/${who.screen_name}/status/${id}`,
    text: body,
    author: who,
    created_timestamp: twscrapeTimestamp(record.date),
    created_at: text(record.date),
    reposted_by: null,
    replying_to: replyingTo ? { screen_name: replyingTo } : null,
    quote: quoted,
    media: media(record),
    provider: "twscrape",
  };
}

/**
 * A tracked account's twscrape tweet as the FxTwitter status mapFxStatus expects. A retweet with its original attached
 * becomes the original, reposted_by the account; without it, the "RT @x: …" wrapper itself, which mapFxStatus already
 * reads as a wrapper repost.
 */
export function twscrapeToFxStatus(tweet: unknown, accountHandle: string): Json | null {
  const record = tweet && typeof tweet === "object" ? (tweet as Json) : null;
  if (!record) return null;
  if (record.retweetedTweet) {
    const original = status(record.retweetedTweet, 1);
    if (original) return { ...original, reposted_by: { screen_name: accountHandle } };
  }
  return status(record);
}

/** A page of twscrape tweets as an FxTwitter feed body, ready for mapFxProfileFeed. */
export function twscrapeFeedBody(tweets: unknown, accountHandle: string): { results: Json[] } {
  const list = Array.isArray(tweets) ? tweets : [];
  return { results: list.map((tweet) => twscrapeToFxStatus(tweet, accountHandle)).filter((s): s is Json => !!s) };
}
