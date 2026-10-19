import { isDeepStrictEqual } from "node:util";
import { timestampMicros } from "lib/projections/evidenceTime";
import { getPrimaryTextForSource, type ParsedLinesCccSource } from "./linesCccIngestion";
import { sourceClaimTextVersionId } from "./tweetSourceClaimRegistry";
import { tweetClaimAttribution } from "./tweetSourceDirectory";
import type { TweetClaimEnvelope } from "./tweetClaimExtraction";

export const TWEET_REVIEW_PACKET_VERSION = "ifttt-review-sidecar-v1";
export type TweetReviewReceipt = {
  id: string;
  eventTable: "line_source_ifttt_events" | "lines_ccc_ifttt_events";
  eventId: string;
  inputRow: Record<string, unknown>;
  receivedAt: string;
};
type Span = { start: number; end: number; text: string };

function sameClock(left: unknown, right: unknown) {
  if (left == null || right == null) return left == null && right == null;
  return typeof left === "string" && typeof right === "string" && timestampMicros(left) !== null
    && timestampMicros(left) === timestampMicros(right);
}

function exactSpan(text: string, span: Span) {
  const boundary = (at: number) => at <= 0 || at >= text.length
    || !(text.charCodeAt(at - 1) >= 0xd800 && text.charCodeAt(at - 1) <= 0xdbff
      && text.charCodeAt(at) >= 0xdc00 && text.charCodeAt(at) <= 0xdfff);
  return Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0
    && span.end > span.start && span.end <= text.length && boundary(span.start) && boundary(span.end)
    && text.slice(span.start, span.end) === span.text;
}

function sameRetainedPostUrl(value: unknown, retained: unknown) {
  const identity = (url: unknown) => {
    if (typeof url !== "string") return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !/^(?:www\.)?(?:x|twitter)\.com$/i.test(parsed.hostname)) return null;
      const match = parsed.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/(?:web\/)?status\/(\d+)\/?$/);
      return match ? `${match[1]!.toLowerCase()}:${match[2]}` : null;
    } catch { return null; }
  };
  const original = identity(value);
  return original !== null && original === identity(retained);
}

/** Internal review input, not a provider wire format or a publication decision.
 * Existing IDs/spans are copied; no parser/report/event/effect identity changes.
 */
export function prepareTweetReviewPacket(args: {
  receipt: TweetReviewReceipt; source: ParsedLinesCccSource; claims: readonly TweetClaimEnvelope[];
}) {
  const { receipt, source, claims } = args;
  if (source.tweetId !== receipt.inputRow.tweet_id || !isDeepStrictEqual(source.rawPayload, receipt.inputRow.raw_payload)
    || source.rawText !== receipt.inputRow.text || !sameClock(source.tweetPostedAt, receipt.inputRow.tweet_created_at)
    || !source.observedAt || timestampMicros(source.observedAt) !== timestampMicros(receipt.receivedAt)
    || timestampMicros(receipt.receivedAt) === null) throw new Error("Review source does not match the retained receipt");
  const text = getPrimaryTextForSource(source);
  const attribution = tweetClaimAttribution(source);
  const wrapperBound = sameRetainedPostUrl(source.tweetUrl ?? source.sourceUrl, receipt.inputRow.link_to_tweet);
  // This first seam has only the immutable raw receipt, not an authenticated
  // enrichment record. Keep enriched/quote text held until that proof is wired.
  const rawTextBound = text === receipt.inputRow.text && source.primaryTextSource !== "quoted_oembed";
  const originalResolved = wrapperBound && rawTextBound && attribution.status === "resolved";
  const publishedAt = originalResolved ? attribution.originalPublishedAt : null;
  const sourceHolds: string[] = [];
  if (!text) sourceHolds.push("source_text_missing");
  if (!wrapperBound) sourceHolds.push("retained_wrapper_url_mismatch_or_missing");
  if (!rawTextBound) sourceHolds.push("selected_text_requires_retained_enrichment_proof");
  if (!originalResolved) sourceHolds.push("original_reporter_unresolved");
  if (publishedAt === null) sourceHolds.push("publication_time_missing");
  else if (timestampMicros(publishedAt) === null) sourceHolds.push("publication_time_invalid");
  else if (timestampMicros(publishedAt)! > timestampMicros(receipt.receivedAt)!) sourceHolds.push("publication_after_ingestion");

  const retainedSourceId = `${receipt.eventTable}:${receipt.eventId}`;
  const sourceTextVersionId = sourceClaimTextVersionId(retainedSourceId, text);
  const overflow = claims.length > 99;
  const seen = new Set<string>();
  const candidates = overflow ? [] : claims.map((claim) => {
    const holds: string[] = [];
    if (seen.has(claim.semantic.id)) holds.push("duplicate_observation_id");
    seen.add(claim.semantic.id);
    if (!claim.semantic.id || !claim.extractionVersion) holds.push("retained_claim_identity_missing");
    if (getPrimaryTextForSource(claim.source) !== text || claim.source.tweetId !== source.tweetId
      || !isDeepStrictEqual(claim.source.rawPayload, receipt.inputRow.raw_payload)) holds.push("claim_source_mismatch");
    if (!exactSpan(text, claim.semantic.evidence)) holds.push("invalid_evidence_utf16_span");
    if (!claim.claimAnchor) holds.push("claim_anchor_missing");
    if (claim.claimAnchor && (!exactSpan(text, claim.claimAnchor.subjectSpan)
      || !exactSpan(text, claim.claimAnchor.predicateSpan))) holds.push("invalid_anchor_utf16_span");
    if (claim.semantic.original.tweetId !== attribution.originalTweetId
      || claim.semantic.original.author?.toLowerCase() !== attribution.original?.handle.toLowerCase()
      || !sameClock(claim.semantic.original.publishedAt, publishedAt)) holds.push("claim_original_identity_mismatch");
    const fact = claim.semantic.fact;
    const playerIds = fact?.kind === "lineup" ? fact.units.flatMap((unit) => unit.playerIds)
      : fact && "playerId" in fact ? [fact.playerId] : [];
    if (!playerIds.length || playerIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) holds.push("canonical_player_binding_missing");
    if (claim.semantic.support.status !== "supported") holds.push("deterministic_support_unresolved");
    if (!claim.semantic.scope) holds.push("scope_unresolved");
    return {
      observationId: claim.semantic.id, extractionVersion: claim.extractionVersion,
      canonicalPlayerIds: [...new Set(playerIds)],
      evidence: structuredClone(claim.semantic.evidence), anchor: structuredClone(claim.claimAnchor ?? null),
      scope: structuredClone(claim.semantic.scope), effectiveAt: claim.semantic.effectiveAt,
      modality: claim.semantic.modality, fact: structuredClone(fact),
      // These are evidence checks only; a supported result cannot promote state.
      proposedChecks: ["source_support", "wording"] as const, holds,
    };
  });
  return {
    version: TWEET_REVIEW_PACKET_VERSION,
    mode: "review_only" as const, canPublish: false as const, canChangeStatus: false as const,
    receiptSnapshot: structuredClone(receipt),
    source: {
      retainedSourceId, sourceTextVersionId, originalPostId: originalResolved ? attribution.originalTweetId : null,
      text, author: originalResolved ? attribution.original?.handle ?? null : null,
      url: originalResolved ? attribution.originalUrl : null,
      publishedAt, ingestedAt: receipt.receivedAt, sourceTextIsUntrustedData: true as const,
      provenance: { attribution: structuredClone(attribution), primaryTextSource: source.primaryTextSource ?? null },
    },
    // Whole-post relevance exists even when deterministic extraction found zero claims.
    wholePost: { proposedChecks: ["relevance"] as const, holds: sourceHolds },
    candidateCount: claims.length, candidatesOmitted: overflow ? "overflow" as const : null,
    candidates, holds: [...sourceHolds, ...(overflow ? ["candidate_overflow"] : [])],
    providerDispatchEnabled: false as const,
  };
}

export type TweetReviewPacket = ReturnType<typeof prepareTweetReviewPacket>;
