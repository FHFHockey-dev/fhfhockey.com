import type { ParsedLinesCccSource, TweetSourceProvenance } from "lib/sources/linesCccIngestion";
import type { AuthorityTier } from "./types";

/**
 * Relay accounts (TJ sourcing rule, 2026-11-06): never a source or original author, never shown. The source is the
 * nested or quoted original; a relay post with no identified original is evidence at the lowest weight only.
 */
export const RELAY_ACCOUNTS = ["dfofantasy", "dfo_fantasy", "nhl_rosters", "cccmiddleton", "gamedaylines", "gamedaynewsnhl", "gamedaygoalies"];
const RELAYS = new Set(RELAY_ACCOUNTS);
/** Authors whose own posts count as evidence but never as confirmation unless they quote an original. */
export const NO_CONFIRMATION_AUTHORS = ["fhfhockey"];
/** Below every tier: an unattributed relay post fills a unit only when nothing better applies. */
export const RELAY_ONLY_WEIGHT = 0.5;

/**
 * Official NHL club accounts (lowercase handles), one per club, each checked live on 2026-11-07:
 * see fixtures/clubHandles.ledger.json. Re-check the ledger when a club rebrands.
 */
export const TEAM_ACCOUNTS = ["njdevils", "nyislanders", "nyrangers", "nhlflyers", "penguins", "nhlbruins", "buffalosabres", "canadiensmtl", "senators",
  "mapleleafs", "canes", "flapanthers", "tblightning", "capitals", "nhlblackhawks", "detroitredwings", "predsnhl", "stlouisblues", "nhlflames",
  "avalanche", "edmontonoilers", "canucks", "anaheimducks", "dallasstars", "lakings", "sanjosesharks", "bluejacketsnhl", "minnesotawild", "nhljets",
  "utahmammoth", "goldenknights", "seattlekraken"];

/**
 * Seed tiers keyed by lowercase original-author handle, approved by TJ (pop-up, 2026-11-06):
 * team = official club accounts, beat starts empty. Relay rule (2026-11-06): the six relay accounts are never
 * authors; FHFHockey is "aggregator". Every other author is "unknown" at aggregator weight.
 */
export const AUTHORITY_SEED_APPROVED = true;
export const AUTHORITY_SEED: Record<string, Exclude<AuthorityTier, "unknown" | "excluded">> = {
  ...Object.fromEntries(TEAM_ACCOUNTS.map((handle) => [handle, "team" as const])),
  fhfhockey: "aggregator",
};

const WEIGHT: Record<AuthorityTier, number> = { team: 3, beat: 2, aggregator: 1, unknown: 1, excluded: 0 };
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const normal = (value: unknown) => typeof value === "string" && HANDLE.test(value.replace(/^@/, "")) ? value.replace(/^@/, "").toLowerCase() : null;

export function isRelayAccount(handle: string | null | undefined): boolean { return !!handle && RELAYS.has(handle.replace(/^@/, "").toLowerCase()); }

const RELAY_PATTERN = RELAY_ACCOUNTS.join("|");
const RELAY_RT = new RegExp(`^\\s*RT @(?:${RELAY_PATTERN}):\\s*`, "i");
const RELAY_URL = new RegExp(`https?://(?:www\\.)?(?:x|twitter)\\.com/(?:${RELAY_PATTERN})/status/\\d+\\S*`, "gi");
const RELAY_WORD = new RegExp(`\\b(?:${RELAY_PATTERN})\\b`, "gi");
const RELAY_MENTION = new RegExp(`(^|[^A-Za-z0-9_])@(?:${RELAY_PATTERN})\\b:?`, "gi");
/** Public strings: drop a relay's "RT @relay:" prefix, relay status links, @relay mentions and bare relay handles. */
export function scrubRelayHandles(text: string): string {
  return text.replace(RELAY_RT, "").replace(RELAY_URL, "").replace(RELAY_MENTION, "$1").replace(RELAY_WORD, "").trim();
}

/** A relay handle never confers a tier: it is "unknown" like a missing author. */
export function authorityTier(originalAuthor: string | null | undefined): AuthorityTier {
  const handle = normal(originalAuthor);
  if (!handle || RELAYS.has(handle)) return "unknown";
  return AUTHORITY_SEED_APPROVED ? AUTHORITY_SEED[handle] ?? "unknown" : "unknown";
}
export function authorityWeight(tier: AuthorityTier): number { return WEIGHT[tier]; }

export type SourceAttribution = {
  originalAuthor: string | null; relayAccount: string | null;
  originalTweetId: string | null; relayTweetId: string | null;
  /** True only when the provider timestamp is the original post's own clock. */
  timestampIsOriginal: boolean; evidence: string[];
  /** A relay account's post whose original is not identified: lowest weight, never confirmation. */
  relayOnly: boolean;
  /** The post quotes an identified original (lets an FHFHockey post confirm). */
  quotesOriginal: boolean;
};
type RawAttribution = Omit<SourceAttribution, "relayOnly" | "quotesOriginal">;

const STATUS_ID = /^\d+$/;
const id = (value: unknown) => typeof value === "string" && STATUS_ID.test(value) ? value : typeof value === "number" && Number.isSafeInteger(value) ? String(value) : null;
const urlId = (url: string | null | undefined) => url?.match(/\/status\/(\d+)/)?.[1] ?? null;
const urlHandle = (url: string | null | undefined) => normal(url?.match(/^https:\/\/(?:x|twitter)\.com\/([^/]+)\//i)?.[1]);

/**
 * Original author and relay of a queued source, from what intake already stores (read-only):
 * FxTwitter `rawPayload.fx` (author / reposted_by / repost_wrapper_id), an IFTTT "RT @x:" prefix,
 * or a resolved quoted original. The relaying poller account is never returned as the author.
 */
export function sourceAttribution(source: ParsedLinesCccSource, text: string): SourceAttribution {
  const found = rawAttribution(source, text);
  const mapped = source.metadata?.sourceProvenance as Partial<TweetSourceProvenance> | undefined;
  const quote = (source.rawPayload as { quote?: { id?: unknown; author_handle?: unknown } } | undefined)?.quote;
  const quotedAuthor = normal(mapped?.quotedAuthor) ?? normal(source.quotedAuthorHandle) ?? normal(quote?.author_handle) ?? urlHandle(source.quotedTweetUrl);
  const quotedTweetId = id(mapped?.quotedTweetId) ?? id(source.quotedTweetId) ?? id(quote?.id) ?? urlId(source.quotedTweetUrl);
  const quotesOriginal = !!quotedAuthor && !!quotedTweetId && !RELAYS.has(quotedAuthor);
  if (!found.originalAuthor || !RELAYS.has(found.originalAuthor)) return { ...found, relayOnly: false, quotesOriginal };
  const relayTweetId = found.relayTweetId ?? found.originalTweetId;
  const relayAccount = found.originalAuthor;
  // The relay's own post: the source is the quoted original when there is one, else attribution is pending.
  if (quotesOriginal) return { originalAuthor: quotedAuthor, relayAccount, originalTweetId: quotedTweetId, relayTweetId, timestampIsOriginal: false,
    evidence: [...found.evidence.filter((item) => item !== "direct_post"), "relay_quoted_original"], relayOnly: false, quotesOriginal };
  return { originalAuthor: null, relayAccount, originalTweetId: null, relayTweetId, timestampIsOriginal: false,
    evidence: [...found.evidence.filter((item) => item !== "direct_post"), "relay_original_unidentified"], relayOnly: true, quotesOriginal: false };
}

function rawAttribution(source: ParsedLinesCccSource, text: string): RawAttribution {
  // Lane D's intake mapping wins when present; the raw payload read below is the fallback for older rows.
  const mapped = source.metadata?.sourceProvenance as Partial<TweetSourceProvenance> | undefined;
  if (mapped && typeof mapped === "object" && (mapped.provider === "fxtwitter" || mapped.provider === "ifttt")) {
    return { originalAuthor: normal(mapped.originalAuthor), relayAccount: normal(mapped.relayAccount),
      originalTweetId: id(mapped.originalTweetId), relayTweetId: id(mapped.relayTweetId), timestampIsOriginal: mapped.timestampIsOriginal === true,
      evidence: [`source_provenance:${mapped.provider}:${mapped.postKind ?? "unknown"}`, ...(mapped.postKind === "post" ? ["direct_post"] : [])] };
  }
  const raw = (source.rawPayload ?? {}) as { provider?: unknown; fx?: Record<string, any> };
  const account = normal(source.metadata?.iftttSourceAccount) ?? normal(source.sourceHandle) ?? urlHandle(source.sourceUrl ?? source.tweetUrl);
  if (raw.provider === "fxtwitter" && raw.fx && typeof raw.fx === "object") {
    const fx = raw.fx;
    const author = normal(fx.author?.screen_name);
    const reposter = normal(fx.reposted_by?.screen_name);
    const wrapper = id(fx.repost_wrapper_id);
    const rt = (typeof fx.text === "string" ? fx.text : "").match(/^RT @([A-Za-z0-9_]{1,15}):/);
    if (author && author === account && rt) {
      // The wrapper itself: id, text and clock are the relay's.
      return { originalAuthor: normal(rt[1]), relayAccount: account, originalTweetId: null, relayTweetId: id(fx.id), timestampIsOriginal: false, evidence: ["fxtwitter:repost_wrapper"] };
    }
    if (author && (reposter || wrapper) && author !== account) {
      return { originalAuthor: author, relayAccount: reposter ?? account, originalTweetId: id(fx.id), relayTweetId: wrapper, timestampIsOriginal: true, evidence: ["fxtwitter:original_author", ...(wrapper ? [`fxtwitter:repost_wrapper_id:${wrapper}`] : [])] };
    }
    if (author) return { originalAuthor: author, relayAccount: null, originalTweetId: id(fx.id), relayTweetId: null, timestampIsOriginal: true, evidence: ["fxtwitter:author"] };
  }
  if (source.primaryTextSource === "quoted_oembed" && source.quotedTweetUrl) {
    return { originalAuthor: normal(source.quotedAuthorHandle) ?? urlHandle(source.quotedTweetUrl), relayAccount: account,
      originalTweetId: id(source.quotedTweetId) ?? urlId(source.quotedTweetUrl), relayTweetId: id(source.tweetId), timestampIsOriginal: false, evidence: ["quoted_original"] };
  }
  const rt = (source.rawText ?? text).match(/^\s*RT @([A-Za-z0-9_]{1,15}):/);
  if (rt) return { originalAuthor: normal(rt[1]), relayAccount: account, originalTweetId: null, relayTweetId: id(source.tweetId) ?? urlId(source.tweetUrl ?? source.sourceUrl), timestampIsOriginal: false, evidence: ["ifttt:rt_prefix"] };
  return { originalAuthor: account, relayAccount: null, originalTweetId: id(source.tweetId) ?? urlId(source.sourceUrl), relayTweetId: null, timestampIsOriginal: true, evidence: ["direct_post"] };
}
