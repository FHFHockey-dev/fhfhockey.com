import { isDeepStrictEqual } from "node:util";
import { timestampMicros } from "lib/projections/evidenceTime";

/** Evidence retention only. Same-post variants never become another queue item. */
export async function retainIftttRawReceipt(args: {
  db: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }> };
  table: "line_source_ifttt_events" | "lines_ccc_ifttt_events";
  row: Record<string, unknown>;
}) {
  const result = await args.db.rpc("retain_ifttt_raw_receipt", { p_table: args.table, p_row: args.row });
  if (result.error) throw result.error;
  const receipt = result.data;
  const { updated_at: _updatedAt, processing_status: _status, ...expected } = args.row;
  const normalized = (input: Record<string, unknown>) => {
    const postedAt = input.tweet_created_at;
    if (postedAt != null && (typeof postedAt !== "string" || timestampMicros(postedAt) === null)) {
      throw new Error("Invalid retained IFTTT publication clock");
    }
    return { ...input, tweet_created_at: postedAt == null ? null : timestampMicros(postedAt as string) };
  };
  const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
  const variant = receipt?.classification === "same_post_variant";
  if (receipt?.version !== "ifttt-receipt-v1" || receipt.table !== args.table
    || !uuid(receipt.eventId) || !uuid(receipt.receiptId)
    || !["canonical", "same_post_variant"].includes(receipt.classification)
    || !["retained", "duplicate"].includes(receipt.outcome)
    || receipt.requiresReview !== variant || (variant ? !uuid(receipt.baselineId) || receipt.baselineId === receipt.receiptId : receipt.baselineId !== null)
    || timestampMicros(receipt.receivedAt) === null
    || !receipt.inputRow || !isDeepStrictEqual(normalized(receipt.inputRow), normalized(expected))) {
    throw new Error("Retained IFTTT receipt does not match this request");
  }
  return { id: receipt.receiptId as string, classification: receipt.classification as "canonical" | "same_post_variant",
    outcome: receipt.outcome as "retained" | "duplicate", requiresReview: variant };
}
