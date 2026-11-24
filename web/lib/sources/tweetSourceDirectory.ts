import { tweetPublicationFromUrl } from "./tweetPublicationTime";
import { isNewsRelayAccount } from "lib/newsFeed";
import type { ParsedLinesCccSource } from "./linesCccIngestion";

export type SourceAccountReference = { accountKey: string; accountId: string | null; handle: string };
export type TweetClaimAttribution = {
  relay: SourceAccountReference | null;
  original: SourceAccountReference | null;
  quoted: SourceAccountReference | null;
  originalTweetId: string | null;
  originalUrl: string | null;
  originalPublishedAt: string | null;
  status: "resolved" | "pending";
  relationship: "direct" | "quote" | "retweet" | "unresolved";
  /** A quote relationship never asserts endorsement by the quoting account. */
  quoteEndorsement: "not_asserted";
};

export type TweetSourceCoverage = {
  id: string;
  account: SourceAccountReference;
  /** One row per dated handle interval; a stable account may have many handles. */
  handleValidFrom: string;
  handleValidUntil: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  knownAt: string;
  teamIds: number[];
  leagues: string[];
  scope: "team" | "multi_team" | "national";
  status: "verified" | "candidate" | "rejected";
  confidence: number;
  evidence: { url: string; excerpt: string; basis: string };
};

function account(handle: string, accountId: string | null = null): SourceAccountReference {
  return { accountKey: accountId ? `x:id:${accountId}` : `x:handle:${handle.toLowerCase()}`, accountId, handle: handle.toLowerCase() };
}

function post(url: string | null | undefined): { account: SourceAccountReference; id: string; url: string } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/(?:web\/)?status\/(\d+)\/?$/);
    if (parsed.protocol !== "https:" || !/^(?:www\.)?(?:x|twitter)\.com$/i.test(parsed.hostname) || !match || match[1]!.toLowerCase() === "i") return null;
    return { account: account(match[1]!), id: match[2]!, url: `https://x.com/${match[1]}/status/${match[2]}` };
  } catch { return null; }
}

type TweetAttributionSource = Pick<ParsedLinesCccSource, "primaryTextSource" | "rawPayload" | "metadata"
  | "tweetId" | "sourceUrl" | "tweetUrl" | "rawText" | "enrichedText" | "quotedTweetUrl" | "quotedTweetId"
  | "quotedAuthorHandle" | "sourceHandle" | "tweetPostedAt">;

/** Preserve the provider's original public URL on the primary snapshot when all four witnesses agree. */
export function verifiedFxSnapshotUrl(source: TweetAttributionSource): string | null {
  if (source.primaryTextSource !== "ifttt_text" || source.rawPayload?.provider !== "fxtwitter") return null;
  const provided = typeof source.metadata?.providerPostUrl === "string" ? post(source.metadata.providerPostUrl) : null;
  const fx = source.rawPayload.fx as { id?: unknown; author?: { screen_name?: unknown }; reposted_by?: { screen_name?: unknown };
    raw_text?: { text?: unknown }; created_timestamp?: unknown } | undefined;
  const byline = fx?.author?.screen_name;
  const text = fx?.raw_text?.text;
  if (!provided || !fx || typeof byline !== "string" || isNewsRelayAccount(byline)
    || provided.id !== source.tweetId || fx.id !== provided.id || provided.account.handle !== byline.toLowerCase()
    || typeof text !== "string" || !text.trim() || /^\s*RT\s+@/i.test(text)) return null;
  const stored = [source.sourceUrl, source.tweetUrl].filter((value): value is string => Boolean(value));
  if (!stored.length || !stored.every(value =>
    /^https:\/\/(?:www\.)?(?:twitter|x)\.com\/i\/web\/status\/(\d+)\/?$/i.exec(value)?.[1] === provided.id
      || post(value)?.url.toLowerCase() === provided.url.toLowerCase())) return null;
  const selected = source.enrichedText ?? source.rawText;
  const wrapper = selected?.match(/^RT @([A-Za-z0-9_]{1,15}):\s*([\s\S]*)$/);
  if (wrapper && wrapper[1]!.toLowerCase() !== byline.toLowerCase()) return null;
  const body = wrapper ? wrapper[2] : selected;
  // x-timeline-poll unescapes the native text once before storing its compatibility wrapper.
  const deliveryText = text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  if (body !== text && body !== deliveryText) {
    // The poller appends the linked quote to its compatibility text. Only that
    // exact suffix can differ from the native status whose byline we credit.
    const quoted = post(source.quotedTweetUrl);
    if (!quoted || quoted.id === provided.id || quoted.id !== source.quotedTweetId ||
      quoted.account.handle !== source.quotedAuthorHandle?.toLowerCase() ||
      (body !== `${text} ${source.quotedTweetUrl}` && body !== `${deliveryText} ${source.quotedTweetUrl}`)) return null;
  }
  const handle = source.sourceHandle?.replace(/^@/, "").toLowerCase();
  const relay = fx.reposted_by?.screen_name;
  if (handle !== byline.toLowerCase() && (typeof relay !== "string" || relay.toLowerCase() !== handle || !wrapper)) return null;
  const clock = typeof fx.created_timestamp === "string" && /^\d+$/.test(fx.created_timestamp)
    ? Number(fx.created_timestamp) : fx.created_timestamp;
  if (typeof clock !== "number" || !Number.isSafeInteger(clock)
    || Math.floor(Date.parse(source.tweetPostedAt ?? "") / 1000) !== clock
    || Math.floor(Date.parse(tweetPublicationFromUrl(provided.url) ?? "") / 1000) !== clock) return null;
  if (source.rawPayload.data != null) {
    const expanded = source.rawPayload.data as { id?: unknown };
    let attribution: TweetClaimAttribution;
    try { attribution = tweetClaimAttribution(source); } catch { return null; }
    if (expanded.id !== provided.id || attribution.originalTweetId !== provided.id
      || attribution.original?.handle !== provided.account.handle
      || (attribution.originalPublishedAt != null && Math.floor(Date.parse(attribution.originalPublishedAt) / 1000) !== clock)) return null;
  }
  return provided.url;
}

/** Uses verified post relationships, never the first @mention or a relay byline. */
export function tweetClaimAttribution(source: TweetAttributionSource): TweetClaimAttribution {
  const storedUrl = source.tweetUrl ?? source.sourceUrl;
  const provided = typeof source.metadata?.providerPostUrl === "string" ? post(source.metadata.providerPostUrl) : null;
  // Intake normalizes a named provider link to /i/web/status/<id>. Recover the supplied
  // author only for that same status, never from an embedded link to another reporter.
  const wrapper = post(storedUrl) ?? (provided && source.tweetId === provided.id
    && storedUrl === `https://twitter.com/i/web/status/${provided.id}`
    && provided.account.handle === source.sourceHandle?.replace(/^@/, "").toLowerCase() ? provided : null);
  const quote = post(source.quotedTweetUrl);
  const validWrapper = wrapper && (!source.tweetId || wrapper.id === source.tweetId) ? wrapper : null;
  const validQuote = quote && (!source.quotedTweetId || quote.id === source.quotedTweetId)
    && source.quotedAuthorHandle?.replace(/^@/, "").toLowerCase() === quote.account.handle ? quote : null;
  const usesQuote = source.primaryTextSource === "quoted_oembed";
  let original = usesQuote ? validQuote : validWrapper;
  if (original && isNewsRelayAccount(original.account.handle)) original = null;
  // Unexpanded RT wrappers do not establish an original, even on a non-relay account.
  if (!usesQuote && /^\s*RT\s+@/i.test(source.enrichedText ?? source.rawText ?? "")) original = null;
  let relationship: TweetClaimAttribution["relationship"] = usesQuote ? "quote" : original ? "direct" : "unresolved";
  let originalPublishedAt = original ? source.tweetPostedAt ?? null : null;
  const payload = source.rawPayload as any;
  if (!usesQuote && source.tweetId && payload?.data?.id === source.tweetId) {
    const reference = payload.data.referenced_tweets?.find((entry: any) => entry.type === "retweeted");
    const tweet = payload.includes?.tweets?.find((entry: any) => entry.id === reference?.id);
    const author = payload.includes?.users?.find((entry: any) => entry.id === tweet?.author_id);
    const text = source.enrichedText ?? source.rawText ?? "";
    const comparable = (value: string) => value.replace(/^\s*RT\s+@\w+:\s*/i, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
    if (tweet && author && typeof tweet.text === "string" && comparable(tweet.text) === comparable(text)
      && typeof author.id === "string" && /^\d+$/.test(author.id) && typeof author.username === "string"
      && /^[A-Za-z0-9_]{1,15}$/.test(author.username) && !isNewsRelayAccount(author.username)) {
      original = { account: account(author.username, author.id), id: tweet.id, url: `https://x.com/${author.username}/status/${tweet.id}` };
      originalPublishedAt = typeof tweet.created_at === "string" ? tweet.created_at : null;
      relationship = "retweet";
    } else if (reference) original = null;
  }
  let relay = validWrapper?.account ?? null;
  if (!original && !usesQuote && payload?.provider === "fxtwitter" && payload.data == null) {
    // The poller can retain both the native status and its delivery wrapper without an expanded X API record.
    const native = post(verifiedFxSnapshotUrl(source));
    if (native) {
      const delivery = source.sourceHandle?.replace(/^@/, "").toLowerCase();
      const repost = delivery && delivery !== native.account.handle && payload.fx?.reposted_by?.screen_name?.toLowerCase() === delivery;
      original = native;
      originalPublishedAt = source.tweetPostedAt ?? null;
      relationship = repost ? "retweet" : "direct";
      relay = repost ? account(delivery) : null;
    }
  }
  return { relay, original: original?.account ?? null, quoted: validQuote?.account ?? null,
    originalTweetId: original?.id ?? null, originalUrl: original?.url ?? null, status: original ? "resolved" : "pending",
    originalPublishedAt: original ? originalPublishedAt : null,
    relationship: original ? relationship : "unresolved", quoteEndorsement: "not_asserted" };
}

/** Coverage supplies a dated prior or a conflict, never a team/game binding. */
export function crossCheckTweetSourceCoverage(args: {
  attribution: TweetClaimAttribution; publishedAt: string | null; asOf: string; teamIds: number[]; league: string | null;
  entries: readonly TweetSourceCoverage[];
}) {
  const origin = args.attribution.original, published = Date.parse(args.publishedAt ?? ""), cutoff = Date.parse(args.asOf);
  const active = args.entries.filter(entry => origin && Number.isFinite(published) && Number.isFinite(cutoff)
    && (origin.accountId ? entry.account.accountId === origin.accountId : entry.account.handle === origin.handle)
    && entry.account.handle === origin.handle && entry.status === "verified" && entry.confidence > 0 && entry.confidence <= 1
    && entry.evidence.url.startsWith("https://") && entry.evidence.excerpt.trim() && entry.evidence.basis.trim()
    && Date.parse(entry.knownAt) <= cutoff && Date.parse(entry.handleValidFrom) <= published
    && (!entry.handleValidUntil || Date.parse(entry.handleValidUntil) > published)
    && Date.parse(entry.effectiveFrom) <= published && (!entry.effectiveUntil || Date.parse(entry.effectiveUntil) > published));
  const accounts = new Set(active.map(entry => entry.account.accountKey));
  const teamIds = [...new Set(active.flatMap(entry => entry.teamIds))].sort((a, b) => a - b);
  const leagues = [...new Set(active.flatMap(entry => entry.leagues))];
  const national = active.some(entry => entry.scope === "national");
  const conflict = accounts.size > 1 || (Boolean(args.league) && leagues.length > 0 && !leagues.includes(args.league!))
    || (!national && args.teamIds.some(id => !teamIds.includes(id)));
  return { status: !active.length ? "unresolved" as const : conflict ? "conflict" as const : "consistent_prior" as const,
    teamIds, leagues, entryIds: active.map(entry => entry.id), bindingAuthority: false as const };
}
