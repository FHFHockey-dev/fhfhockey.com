// Layer 3 of the X intake safety net (tasks/artifacts/x-intake-safety-net-design-2026-11-06.md §2.3): a twscrape
// Tweet (Python `json.loads(tweet.json())`, posted by the GitHub Actions job to the x-timeline-ingest edge function)
// converted to the FxTwitter status shape, so the poller's own mapper (mapFxStatus) builds the rows. One mapping for
// every source. A repost becomes the original status with reposted_by set, as FxTwitter returns it, and keeps the
// wrapper's identity and time (repost_wrapper_id, reposted_timestamp), which FxTwitter does not carry.
// Field names follow twscrape 0.21.0 models.py (Tweet, User, UserRef, TextLink, Media*), checked 2026-11-07, and the
// FxTwitter shapes stored in x_timeline_shadow_posts on 2026-11-07. Pure, no imports.

type Json = Record<string, any>;

const digits = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return typeof value === "string" && /^\d{1,25}$/.test(value) ? value : null;
};
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const list = (value: unknown): Json[] =>
  Array.isArray(value) ? value.filter((item): item is Json => !!item && typeof item === "object") : [];

/** Seconds since the epoch from twscrape's `date`: an ISO string, or Python's str(datetime) "2026-11-06 19:06:38+00:00". */
export function twscrapeTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const iso = /^\d{4}-\d{2}-\d{2} \d/.test(value) ? value.replace(" ", "T") : value;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** X's created_at format, as FxTwitter passes it through: "Sat Nov 07 04:15:20 +0000 2026". */
export function xCreatedAt(seconds: number | null): string | null {
  if (seconds === null) return null;
  const d = new Date(seconds * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${two(d.getUTCDate())} ${two(d.getUTCHours())}:`
    + `${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} +0000 ${d.getUTCFullYear()}`;
}

function author(user: unknown): Json | null {
  const record = user && typeof user === "object" ? (user as Json) : null;
  const screenName = text(record?.username);
  const id = digits(record?.id_str) ?? digits(record?.id);
  if (!record || !screenName || !id) return null;
  return { screen_name: screenName, id, name: text(record.displayname) ?? screenName };
}

// FxTwitter serves photos at their original size.
const photoUrl = (url: string) => (/^https:\/\/pbs\.twimg\.com\/media\/[^?]+$/.test(url) ? `${url}?name=orig` : url);
const shared = (item: Json): Json => ({
  ...(digits(item.id_str) ?? digits(item.id) ? { id: digits(item.id_str) ?? digits(item.id) } : {}),
  ...(num(item.width) !== null ? { width: item.width } : {}),
  ...(num(item.height) !== null ? { height: item.height } : {}),
  ...(typeof item.altText === "string" && item.altText.trim() ? { altText: item.altText } : {}),
});

/** twscrape's Media as FxTwitter's media: all, photos and videos (FxTwitter lists gifs as videos with type "gif"). */
function media(tweet: Json): Json {
  const groups = tweet.media && typeof tweet.media === "object" ? tweet.media : {};
  const photos = list(groups.photos).filter((item) => text(item.url))
    .map((item) => ({ ...shared(item), type: "photo", url: photoUrl(item.url) }));
  const videos = list(groups.videos).map((item) => {
    const best = list(item.variants).filter((variant) => text(variant.url))
      .sort((a, b) => (num(b.bitrate) ?? 0) - (num(a.bitrate) ?? 0))[0];
    return {
      ...shared(item), type: "video", url: best?.url ?? null, thumbnail_url: text(item.thumbnailUrl),
      format: text(best?.contentType), ...(num(item.duration) !== null ? { duration: item.duration / 1000 } : {}),
    };
  });
  const gifs = list(groups.animated).map((item) => ({
    ...shared(item), type: "gif", url: text(item.videoUrl), thumbnail_url: text(item.thumbnailUrl), format: "video/mp4",
  }));
  const all = [...photos, ...videos, ...gifs];
  if (!all.length) return {};
  return { all, ...(photos.length ? { photos } : {}), ...(videos.length || gifs.length ? { videos: [...videos, ...gifs] } : {}) };
}

/**
 * FxTwitter's two texts: raw_text keeps X's t.co links (mapFxStatus reads it first), text is the displayed part with the
 * links expanded and the trailing media link dropped.
 */
function texts(record: Json, body: string): Json {
  const range = Array.isArray(record.displayTextRange) && num(record.displayTextRange[1]) !== null
    ? [num(record.displayTextRange[0]) ?? 0, record.displayTextRange[1] as number] : null;
  // display_text_range counts code points.
  let shown = range ? Array.from(body).slice(0, range[1]).join("") : body;
  for (const link of list(record.links)) {
    if (text(link.tcourl) && text(link.url)) shown = shown.split(link.tcourl).join(link.url);
  }
  return { text: shown, raw_text: { text: body, ...(range ? { display_text_range: range } : {}) } };
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
  const replyStatus = digits(record.inReplyToTweetIdStr) ?? digits(record.inReplyToTweetId);
  const created = twscrapeTimestamp(record.date);
  return {
    type: "status",
    id,
    url: `https://x.com/${who.screen_name}/status/${id}`,
    ...texts(record, body),
    author: who,
    created_timestamp: created,
    created_at: xCreatedAt(created),
    reposted_by: null,
    replying_to: replyingTo
      ? { screen_name: replyingTo, ...(replyStatus ? { status: replyStatus } : {}) }
      : null,
    quote: quoted,
    media: media(record),
    provider: "twscrape",
  };
}

/**
 * A tracked account's twscrape tweet as the FxTwitter status mapFxStatus expects. A retweet with its original attached
 * becomes the original, reposted_by the account (id and name too, as FxTwitter has them), with the wrapper's id and time
 * kept as repost_wrapper_id and reposted_timestamp; without it, the "RT @x: …" wrapper itself, which mapFxStatus already
 * reads as a wrapper repost.
 */
export function twscrapeToFxStatus(tweet: unknown, accountHandle: string): Json | null {
  const record = tweet && typeof tweet === "object" ? (tweet as Json) : null;
  if (!record) return null;
  if (record.retweetedTweet) {
    const original = status(record.retweetedTweet, 1);
    const wrapperId = digits(record.id_str) ?? digits(record.id);
    const by = author(record.user);
    if (original && wrapperId) {
      return {
        ...original,
        reposted_by: by && by.screen_name.toLowerCase() === accountHandle.toLowerCase()
          ? by : { screen_name: accountHandle },
        repost_wrapper_id: wrapperId,
        reposted_timestamp: twscrapeTimestamp(record.date),
      };
    }
  }
  return status(record);
}

/** A page of twscrape tweets as an FxTwitter feed body, ready for mapFxProfileFeed. */
export function twscrapeFeedBody(tweets: unknown, accountHandle: string): { results: Json[] } {
  const items = Array.isArray(tweets) ? tweets : [];
  return { results: items.map((tweet) => twscrapeToFxStatus(tweet, accountHandle)).filter((s): s is Json => !!s) };
}

/** Where a status sits on the account's timeline: a repost by its wrapper's id (the repost time), else its own id. */
export function timelineId(status: Json): string | null {
  return digits(status?.repost_wrapper_id) ?? digits(status?.id);
}

/**
 * Shadow mode: mapped rows as x_timeline_twscrape_observations rows. Same columns as x_timeline_shadow_posts (the
 * post's own X time, to the second, is tweet_created_at), plus the timeline position (for paging back to an overlap),
 * the repost time when the row is a repost, and the GitHub run that first saw it. first_observed_at is the database's.
 */
export function toObservationRows<R extends { tweet_id: string; raw_payload: Json }>(rows: R[], runId: string) {
  return rows.map((row) => {
    const repostedAt = num(row.raw_payload?.reposted_timestamp);
    return {
      ...row,
      timeline_id: timelineId(row.raw_payload) ?? row.tweet_id,
      reposted_at: repostedAt === null ? null : new Date(repostedAt * 1000).toISOString(),
      run_id: runId,
    };
  });
}
