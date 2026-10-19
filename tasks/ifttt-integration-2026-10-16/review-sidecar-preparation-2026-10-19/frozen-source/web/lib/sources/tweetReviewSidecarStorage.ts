import { boundedIftttRpc, IFTTT_RPC_DEADLINES, type IftttRpcClient } from "./iftttRpcDeadline";
import { prepareTweetReviewPacket, type TweetReviewReceipt } from "./tweetReviewSidecar";
import type { ParsedLinesCccSource } from "./linesCccIngestion";
import type { TweetClaimEnvelope } from "./tweetClaimExtraction";

/** Explicit post-commit polling seam. No webhook/model/provider/scheduler hook.
 * The immutable receipt log is the durable work source; a missed preparation
 * is rediscovered on the next bounded invocation, not a fire-and-forget task.
 */
export async function prepareRetainedTweetReviewSidecars(args: {
  db: IftttRpcClient; policyId: string; enabled?: boolean; limit?: number;
  resolveRetainedContext: (receipt: TweetReviewReceipt) => {
    source: ParsedLinesCccSource; claims: readonly TweetClaimEnvelope[];
  };
}) {
  if (!args.enabled || !args.limit) return { status: "disabled" as const, prepared: 0, unresolved: 0 };
  if (!Number.isSafeInteger(args.limit) || args.limit < 1 || args.limit > 25) throw new Error("Explicit bounded review preparation limit required");
  const listed = await boundedIftttRpc(args.db, "list_ifttt_review_receipts", {
    p_policy_id: args.policyId, p_limit: args.limit,
  }, IFTTT_RPC_DEADLINES.readMs);
  if (listed.error) throw listed.error;
  if (!Array.isArray(listed.data) || listed.data.length > args.limit) throw new Error("Invalid retained review batch");
  let prepared = 0, unresolved = 0;
  for (const receipt of listed.data as TweetReviewReceipt[]) {
    try {
      // Pure mapping of already-retained context, never an async model/fetch hook.
      const context = args.resolveRetainedContext(receipt);
      const packet = prepareTweetReviewPacket({ receipt, ...context });
      const result = await boundedIftttRpc(args.db, "prepare_ifttt_review_sidecar", {
        p_policy_id: args.policyId, p_receipt_id: receipt.id, p_input: packet,
      }, IFTTT_RPC_DEADLINES.writeMs);
      if (result.error || result.data?.status !== "prepared" || result.data.receiptId !== receipt.id
        || result.data.jobKey !== `ifttt-review-v1:${args.policyId}:${receipt.id}`
        || typeof result.data.duplicate !== "boolean") throw new Error("Review preparation is unconfirmed");
      prepared++;
    } catch {
      // No write retry. A committed job is excluded by the next read; an
      // uncommitted/missing job remains discoverable from the retained log.
      unresolved++;
    }
  }
  return { status: "review_only" as const, prepared, unresolved };
}
