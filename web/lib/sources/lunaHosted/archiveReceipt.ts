import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { isNewsRelayAccount } from "lib/newsFeed";
import { timestampMicros } from "lib/projections/evidenceTime";
import { prepareCaptureEnvelope, validateCaptureResult, type CaptureEnvelope, type CaptureReceipt } from "./capture";

export type ArchiveRecord = { receipt: CaptureReceipt; envelope: CaptureEnvelope };
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const reviewSchema = z.object({ basis: z.literal("owner-reviewed-direct-source"), receiptId: z.string().uuid(),
  payloadSha256: z.string().regex(/^[a-f0-9]{64}$/), textSha256: z.string().regex(/^[a-f0-9]{64}$/),
  postId: z.string(), author: z.string(), url: z.string(), publishedAt: z.string().datetime(),
  reviewedAt: z.string().datetime(), reviewerRef: z.string().min(1).max(200),
  evidenceRef: z.string().min(1).max(500), permissionRef: z.string().min(1).max(500),
}).strict();
export type ArchiveSourceReview = z.infer<typeof reviewSchema>;
export type ArchiveReviewReceipt = {
  kind: "luna-isolated-review-receipt-v1";
  id: string; eventTable: "luna_capture.receipts"; eventId: string;
  inputRow: Record<string, unknown>; receivedAt: string;
  archive: ArchiveRecord; sourceReview: ArchiveSourceReview | null;
};

/** Consistency validation of an owner-loaded archive export. It is not a proof
 * that arbitrary caller-supplied bytes came from storage or an authentic source.
 */
export function validateArchiveRecord(value: ArchiveRecord): ArchiveRecord {
  const v = structuredClone(value);
  const e = prepareCaptureEnvelope(Buffer.from(v.envelope.rawBody, "utf8"), v.envelope.scope, v.envelope.receivedAt);
  if (!isDeepStrictEqual(e, v.envelope) || v.receipt.firstReceivedAt !== e.receivedAt) throw new Error("invalid_archive_record");
  const result = validateCaptureResult({ status: "duplicate", receipt: v.receipt }, e);
  if (result.status === "refused") throw new Error("invalid_archive_record");
  return { receipt: result.receipt, envelope: e };
}
function sourceReview(record: ArchiveRecord, value: ArchiveSourceReview | null) {
  if (value === null) return null;
  const review = reviewSchema.parse(value), e = record.envelope, r = record.receipt;
  const published = timestampMicros(review.publishedAt), received = timestampMicros(e.receivedAt), reviewed = timestampMicros(review.reviewedAt);
  const canonicalUrl = `https://x.com/${e.scope.sourceAccount.toLowerCase()}/status/${e.submitted.postId}`;
  // Only a directly retained original is supported here; relays/quotes require
  // separately retained original evidence and remain out of this first bridge.
  if (review.receiptId !== r.id || review.payloadSha256 !== r.payloadSha256 || review.textSha256 !== hash(e.submitted.text)
    || review.postId !== e.submitted.postId || review.author.toLowerCase() !== e.scope.sourceAccount.toLowerCase()
    || review.url !== canonicalUrl || isNewsRelayAccount(review.author) || /^\s*RT\s+@/i.test(e.submitted.text)
    || published === null || received === null || reviewed === null || published > received || reviewed < received) {
    throw new Error("unbound_archive_source_review");
  }
  return review;
}
export function makeArchiveReviewReceipt(record: ArchiveRecord, review: ArchiveSourceReview | null): ArchiveReviewReceipt {
  const archive = validateArchiveRecord(record), checked = sourceReview(archive, review);
  const e = archive.envelope, r = archive.receipt;
  return { kind: "luna-isolated-review-receipt-v1", id: r.id, eventTable: "luna_capture.receipts", eventId: r.id,
    receivedAt: r.firstReceivedAt, archive, sourceReview: checked,
    // Explicit normalized projection of archive bytes and separate owner evidence;
    // this is not a row in either legacy intake table.
    inputRow: { tweet_id: e.submitted.postId, text: e.submitted.text, link_to_tweet: e.submitted.link,
      raw_payload: JSON.parse(e.rawBody), tweet_created_at: checked?.publishedAt ?? null } };
}

export function reviewReceiptLineage(value: unknown): { retainedSourceId: string; holds: string[] } {
  if (!value || typeof value !== "object") throw new Error("invalid_retained_receipt");
  const r = value as Record<string, unknown>;
  if (r.eventTable === "luna_capture.receipts") {
    if (r.kind !== "luna-isolated-review-receipt-v1") throw new Error("invalid_archive_kind");
    const rebuilt = makeArchiveReviewReceipt(r.archive as ArchiveRecord, r.sourceReview as ArchiveSourceReview | null);
    if (!isDeepStrictEqual(rebuilt, r)) throw new Error("invalid_archive_projection");
    return { retainedSourceId: `luna_capture.receipts:${rebuilt.id}`,
      holds: [...(rebuilt.archive.receipt.classification === "variant" ? ["archive_variant_requires_review"] : []),
        ...(rebuilt.sourceReview === null ? ["archive_original_source_review_required"] : [])] };
  }
  if (r.kind !== undefined || !["line_source_ifttt_events", "lines_ccc_ifttt_events"].includes(String(r.eventTable))
    || typeof r.id !== "string" || !r.id.trim() || typeof r.eventId !== "string" || !r.eventId.trim()) throw new Error("invalid_legacy_receipt");
  return { retainedSourceId: `${r.eventTable}:${r.eventId}`, holds: [] };
}
