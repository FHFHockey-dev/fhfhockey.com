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

/** Uses verified post relationships, never the first @mention or a relay byline. */
export function tweetClaimAttribution(source: ParsedLinesCccSource): TweetClaimAttribution {
  const wrapper = post(source.tweetUrl ?? source.sourceUrl);
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
  if (!usesQuote && payload?.data?.id === source.tweetId) {
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
  return { relay: validWrapper?.account ?? null, original: original?.account ?? null, quoted: validQuote?.account ?? null,
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
