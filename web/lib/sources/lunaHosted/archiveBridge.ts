import { timestampMicros } from "lib/projections/evidenceTime";
import { makeArchiveReviewReceipt, makeFxReviewReceipt, type ArchiveRecord, type ArchiveSourceReview } from "./archiveReceipt";
import type { FxTwitterSeal } from "./fxTwitterReceipt";
import { prepareHostedLunaDraft } from "./prepareDraft";

type DraftMaterial = NonNullable<Parameters<typeof prepareHostedLunaDraft>[0]["material"]>;
type Context = Omit<DraftMaterial, "receipt" | "source">;
type ArchiveInput = { provider?: "ifttt"; archive?: ArchiveRecord; sourceReview?: ArchiveSourceReview | null }
  | { provider: "fxtwitter"; archive: FxTwitterSeal; originalArchive: FxTwitterSeal | null; sourceReview: ArchiveSourceReview };

/** Pure draft preparation from owner-loaded archive records. Enrollment is a separate owner operation. */
export function prepareArchivedLunaDraft(args: ArchiveInput & { enabled?: boolean; context?: Context }) {
  if (args.enabled !== true) return prepareHostedLunaDraft({});
  try {
    if (!args.archive || !args.context) throw new Error();
    const receipt = args.provider === "fxtwitter"
      ? makeFxReviewReceipt(args.archive, args.originalArchive, args.sourceReview)
      : makeArchiveReviewReceipt(args.archive, args.sourceReview ?? null);
    const prepared = timestampMicros(args.context.preparedAt);
    if (receipt.sourceReview && (prepared === null || prepared < timestampMicros(receipt.sourceReview.reviewedAt)!)) throw new Error();
    if (receipt.kind === "luna-fxtwitter-review-receipt-v1" && (prepared === null ||
      prepared >= timestampMicros(receipt.archive.expiresAt)! ||
      (receipt.originalArchive && prepared >= timestampMicros(receipt.originalArchive.expiresAt)!))) throw new Error();
    const source = { tweetId: receipt.inputRow.tweet_id, sourceUrl: receipt.inputRow.link_to_tweet,
      rawText: receipt.inputRow.text, rawPayload: receipt.inputRow.raw_payload,
      tweetPostedAt: receipt.inputRow.tweet_created_at, observedAt: receipt.receivedAt } as DraftMaterial["source"];
    return prepareHostedLunaDraft({ enabled: true, material: { ...args.context, receipt, source } });
  } catch {
    return { status: "held" as const, reason: "invalid_or_unresolved_archive_bridge", draft: null,
      canEnqueue: false, providerDispatchEnabled: false, canPublish: false,
      canChangeStatus: false, canWriteAliases: false, sourceAuthenticated: false };
  }
}
