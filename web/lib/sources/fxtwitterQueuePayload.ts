import { timestampMicros } from "lib/projections/evidenceTime";
import { isNewsRelayAccount } from "../newsFeed";
import { teamsInfo } from "../teamsInfo";
import type { LinesCccResolvedQuotedTweet, ParsedLinesCccSource, TweetSourceProvenance } from "./linesCccIngestion";
import { tweetPublicationFromUrl } from "./tweetPublicationTime";

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

function nativePostTime(url: unknown, author: string | null, id: string | null | undefined, providerTime: string | null | undefined) {
  if (typeof url !== "string" || !providerTime) return null;
  const named = /^https:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)$/.exec(url);
  if (!named || named[1]!.toLowerCase() !== author?.toLowerCase() || named[2] !== id) return null;
  const clock = tweetPublicationFromUrl(url);
  return clock && Math.floor(Date.parse(clock) / 1000) === Math.floor(Date.parse(providerTime) / 1000) ? clock : null;
}

type NativeQuoteStatus = { id?: string; url?: string; author?: { screen_name?: string }; created_timestamp?: number;
  raw_text?: { text?: string }; text?: string; reposted_by?: { screen_name?: string }; repost_wrapper_id?: string };

/** Prove whose words the selected quote contains, using the two native statuses carried by the poller. */
export function verifiedFxRelayQuoteClocks(source: ParsedLinesCccSource, selectedText: string) {
  const quote = quotedTweetFromFxtwitterPayload(source.rawPayload);
  const carrier = source.rawPayload?.fx as (NativeQuoteStatus & { quote?: NativeQuoteStatus }) | undefined;
  const original = carrier?.quote;
  const byline = quote?.quotedAuthorHandle, relay = text(source.sourceHandle);
  if (source.primaryTextSource !== "quoted_oembed" || source.metadata?.quotedRetrievalStatus !== "fxtwitter_payload"
    || !quote || !original || !carrier || !byline || !relay || !isNewsRelayAccount(relay) || isNewsRelayAccount(byline)
    || carrier.reposted_by?.screen_name || carrier.repost_wrapper_id || original.reposted_by?.screen_name || original.repost_wrapper_id
    || !source.tweetId || carrier.id !== source.tweetId || original.id === carrier.id || original.id !== quote.quotedTweetId
    || source.quotedTweetId !== original.id || original.url !== quote.quotedTweetUrl || source.quotedTweetUrl !== original.url
    || source.metadata.providerPostUrl !== carrier.url || text(carrier.author?.screen_name)?.toLowerCase() !== relay.toLowerCase()
    || text(original.author?.screen_name)?.toLowerCase() !== byline.toLowerCase() || text(source.quotedAuthorHandle)?.toLowerCase() !== byline.toLowerCase()) return null;
  const deliveredText = (status: NativeQuoteStatus) => {
    const value = status.raw_text?.text ?? status.text;
    return typeof value === "string" ? value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : null;
  };
  const wrapper = deliveredText(carrier);
  if (!selectedText.trim() || !wrapper || /^\s*RT\s+@/i.test(selectedText) || /^\s*RT\s+@/i.test(wrapper)
    || source.rawText !== `${wrapper} ${original.url}` || selectedText !== deliveredText(original)
    || selectedText !== quote.quotedText || selectedText !== source.quotedRawText) return null;
  const wrapperAt = text(source.metadata.wrapperPostedAt);
  const quoteTime = nativePostTime(original.url, byline, original.id, quote.quotedPostedAt);
  const relayTime = nativePostTime(carrier.url, relay, carrier.id, wrapperAt);
  const seen = timestampMicros(text(source.rawPayload?.first_seen_at) ?? ""), received = timestampMicros(source.observedAt ?? "");
  if (!quoteTime || !relayTime || seen == null || received == null || !quote.quotedPostedAt || !wrapperAt
    || !Number.isSafeInteger(original.created_timestamp) || original.created_timestamp !== Date.parse(quote.quotedPostedAt) / 1000
    || !Number.isSafeInteger(carrier.created_timestamp) || carrier.created_timestamp !== Date.parse(wrapperAt) / 1000
    || Date.parse(quoteTime) > Date.parse(relayTime) || timestampMicros(relayTime)! > seen || seen > received) return null;
  return { originalIdentity: quote.quotedTweetId, originalAuthor: byline, originalPublishedAt: quote.quotedPostedAt, relayPublishedAt: wrapperAt,
    evidence: [`fxtwitter:quoted_status:${original.id}`, `fxtwitter:carrier_status:${carrier.id}`] };
}

/** A relay's pointer or tentative activation summary can introduce the named reporter's own update. */
export function isVerifiedRelayQuoteSummary(source: ParsedLinesCccSource, quote: LinesCccResolvedQuotedTweet): boolean {
  const provenance = source.metadata?.sourceProvenance as TweetSourceProvenance | undefined;
  if (quote.retrievalStatus !== "fxtwitter_payload" || provenance?.provider !== "fxtwitter" || provenance.postKind !== "quote"
    || !isNewsRelayAccount(provenance.originalAuthor) || provenance.originalAuthor?.toLowerCase() !== source.sourceHandle?.toLowerCase()
    || provenance.originalTweetId !== source.tweetId || !quote.quotedAuthorHandle || isNewsRelayAccount(quote.quotedAuthorHandle)
    || quote.quotedTweetId === source.tweetId || provenance.quotedTweetId !== quote.quotedTweetId
    || provenance.quotedAuthor?.toLowerCase() !== quote.quotedAuthorHandle.toLowerCase() || provenance.quotedText !== quote.quotedText) return false;
  const quoteTime = nativePostTime(quote.quotedTweetUrl, quote.quotedAuthorHandle, quote.quotedTweetId, quote.quotedPostedAt);
  const wrapperTime = nativePostTime(source.metadata?.providerPostUrl, provenance.originalAuthor, source.tweetId, source.tweetPostedAt);
  const evidence = quote.quotedText?.trim();
  if (!evidence || /^RT\s+@/i.test(evidence) || !quoteTime || !wrapperTime || Date.parse(quoteTime) > Date.parse(wrapperTime)) return false;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
  if (day.format(new Date(quoteTime)) !== day.format(new Date(wrapperTime))) return false;
  const fx = source.rawPayload?.fx as { id?: unknown; raw_text?: { text?: unknown } } | undefined;
  const body = fx?.raw_text?.text;
  if (fx?.id !== source.tweetId || typeof body !== "string" || (source.enrichedText ?? source.rawText) !== `${body} ${quote.quotedTweetUrl}`) return false;
  const pointer = /^(?:#?([\p{L} ]+?) (?:injury )?updates?|(?:significant )?injury news out of ([\p{L} ]+))\.?(?:\s+#[\p{L}\d_]+)*$/iu.exec(body);
  const label = (pointer?.[1] ?? pointer?.[2])?.toLowerCase();
  if (label) {
    const club = Object.values(teamsInfo).find(team => [team.name, team.location, team.shortName, team.abbrev, team.shortName.split(" ").at(-1)]
      .some(value => value?.toLowerCase() === label));
    if (!club) return false;
    const labels = [club.name, club.location, club.shortName, club.abbrev, label];
    // The archived Colorado pointer introduces a report explicitly attributed to the Avs coach.
    if (club.abbrev === "COL") labels.push("Avs coach");
    return labels.some(name => name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "iu").test(evidence));
  }
  const activation = /^([\p{L} ]+) is expected to activate ([\p{L}.'’ -]+?) today\.?(?:\s+#[\p{L}\d_]+)*$/iu.exec(body);
  const club = source.team && teamsInfo[source.team.abbreviation];
  if (!activation || !club || club.location !== activation[1] || !source.matchedNames?.includes(activation[2]!)
    || !evidence.startsWith(activation[2]! + " is expected to return to ")) return false;
  const rest = evidence.slice((activation[2]! + " is expected to return to ").length);
  const target = /^(?:the |#)?([\p{L} ]+?) line[ -]?up tonight[.!](?:\s|$)/iu.exec(rest);
  return Boolean(target && [club.abbrev, club.shortName, club.name].some(name => name.toLowerCase() === target[1]!.toLowerCase()));
}
