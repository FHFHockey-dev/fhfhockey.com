import type { LinesCccResolvedQuotedTweet } from "./linesCccIngestion";

const STATUS_ID = /^\d+$/;
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const text = (value: unknown) => (typeof value === "string" ? value : null);

/**
 * The quoted post carried by a queue row the x-timeline-poll scraper wrote (raw_payload.provider "fxtwitter";
 * see supabase/functions/x-timeline-poll/fxtwitter.ts toQueueRow). FxTwitter text has no t.co links, so the
 * processors' t.co-gated quote lookup would never fire; this hands them the quote they would have resolved.
 * Null for IFTTT rows and for rows without a usable quote.
 */
export function quotedTweetFromFxtwitterPayload(rawPayload: unknown): LinesCccResolvedQuotedTweet | null {
  const payload = rawPayload as { provider?: unknown; quote?: Record<string, unknown> | null } | null;
  if (payload?.provider !== "fxtwitter" || !payload.quote) return null;
  const { id, url, author_handle: authorHandle } = payload.quote;
  if (typeof id !== "string" || !STATUS_ID.test(id) || typeof url !== "string") return null;
  return {
    quotedTweetId: id,
    quotedTweetUrl: url,
    quotedText: text(payload.quote.text),
    quotedPostedAt: text(payload.quote.created_at),
    quotedPostedLabel: null,
    quotedSourceTweetUrl: url,
    quotedAuthorName: text(payload.quote.author_name),
    quotedAuthorHandle: typeof authorHandle === "string" && HANDLE.test(authorHandle) ? authorHandle : null,
    resolvedUrl: url,
    shortUrl: null,
    retrievalStatus: "fxtwitter_payload",
  };
}
