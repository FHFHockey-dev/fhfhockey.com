import { timestampMicros } from "lib/projections/evidenceTime";
import { makeArchiveReviewReceipt, type ArchiveRecord, type ArchiveSourceReview } from "./archiveReceipt";
import { prepareHostedLunaDraft } from "./prepareDraft";

type DraftMaterial = NonNullable<Parameters<typeof prepareHostedLunaDraft>[0]["material"]>;
type Context = Omit<DraftMaterial, "receipt" | "source">;
/** Pure, default-off bridge from exact owner-loaded archive bytes and separately
 * reviewed original-source evidence. No receipt loading, staging or provider I/O.
 * A prepared draft still needs exact owner approval and owner-only SQL staging.
 */
export function prepareArchivedLunaDraft(args: { enabled?: boolean; archive?: ArchiveRecord;
  sourceReview?: ArchiveSourceReview | null; context?: Context }) {
  if (args.enabled !== true) return prepareHostedLunaDraft({});
  try {
    if (!args.archive || !args.context) throw new Error();
    const receipt = makeArchiveReviewReceipt(args.archive, args.sourceReview ?? null);
    const prepared = timestampMicros(args.context.preparedAt);
    if (receipt.sourceReview && (prepared === null || prepared < timestampMicros(receipt.sourceReview.reviewedAt)!)) throw new Error();
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
