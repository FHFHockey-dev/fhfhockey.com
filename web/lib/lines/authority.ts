import type { ParsedLinesCccSource } from "lib/sources/linesCccIngestion";
import type { AuthorityTier } from "./types";

/** Accounts the poller and IFTTT relay through. Relaying never confers authority. */
export const RELAY_ACCOUNTS = ["dfofantasy", "nhl_rosters", "cccmiddleton", "gamedaylines", "gamedaynewsnhl", "gamedaygoalies"];
/** Excluded from both lanes (TJ decision 2). */
export const EXCLUDED_AUTHORS = ["fhfhockey"];

/**
 * Seed tiers keyed by lowercase original-author handle. Proposed to TJ by pop-up; until
 * AUTHORITY_SEED_APPROVED is true every non-excluded author is "unknown".
 */
export const AUTHORITY_SEED_APPROVED = false;
export const AUTHORITY_SEED: Record<string, Exclude<AuthorityTier, "unknown" | "excluded">> = {};

const WEIGHT: Record<AuthorityTier, number> = { team: 3, beat: 2, aggregator: 1, unknown: 1, excluded: 0 };
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const normal = (value: unknown) => typeof value === "string" && HANDLE.test(value.replace(/^@/, "")) ? value.replace(/^@/, "").toLowerCase() : null;

export function authorityTier(originalAuthor: string | null | undefined): AuthorityTier {
  const handle = normal(originalAuthor);
  if (!handle) return "unknown";
  if (EXCLUDED_AUTHORS.includes(handle)) return "excluded";
  return AUTHORITY_SEED_APPROVED ? AUTHORITY_SEED[handle] ?? "unknown" : "unknown";
}
export function authorityWeight(tier: AuthorityTier): number { return WEIGHT[tier]; }

export type SourceAttribution = {
  originalAuthor: string | null; relayAccount: string | null;
  originalTweetId: string | null; relayTweetId: string | null;
  /** True only when the provider timestamp is the original post's own clock. */
  timestampIsOriginal: boolean; evidence: string[];
};

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
