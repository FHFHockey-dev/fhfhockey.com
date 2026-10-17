import { isDeepStrictEqual } from "node:util";
import { timestampMicros } from "lib/projections/evidenceTime";
import type { IftttIntakePolicy, IftttIntakeScope } from "./iftttIntakePolicy";
import { boundedIftttRpc, IFTTT_RPC_DEADLINES, IftttIntakeOutcomeUnknown, type IftttRpcClient } from "./iftttRpcDeadline";

type ReceiptArguments = {
  db: IftttRpcClient;
  table: "line_source_ifttt_events" | "lines_ccc_ifttt_events";
  row: Record<string, unknown>;
  policy: IftttIntakePolicy;
  scope: IftttIntakeScope;
};
class IntakeRefused extends Error {}

/** One mutation only. Any uncertain reply permits one bounded read, never a write retry. */
export async function retainIftttRawReceipt(args: ReceiptArguments) {
  try {
    const result = await boundedIftttRpc(args.db, "retain_bounded_ifttt_raw_receipt", {
      p_policy: args.policy, p_scope: args.scope, p_row: args.row,
    }, IFTTT_RPC_DEADLINES.writeMs);
    if (result.error) throw result.error;
    if (result.data?.version !== "ifttt-intake-v1" || result.data.policyId !== args.policy.id) throw new IftttIntakeOutcomeUnknown();
    if (result.data.status !== "retained") {
      const status = result.data.status;
      if (["invalid_policy", "missing_policy", "policy_mismatch", "scope_denied", "stopped",
        "not_started", "expired", "attempt_cap", "receipt_cap", "storage_failed"].includes(status)) {
        throw new IntakeRefused(`IFTTT intake was not admitted: ${status}`);
      }
      throw new IftttIntakeOutcomeUnknown();
    }
    return validateReceipt(args, result.data.receipt);
  } catch (error) {
    if (error instanceof IntakeRefused) throw error;
    return reconcileIftttRawReceipt(args);
  }
}

/** Also available for later operator-authorized reconciliation; this never mutates. */
export async function reconcileIftttRawReceipt(args: ReceiptArguments) {
  try {
    const result = await boundedIftttRpc(args.db, "reconcile_ifttt_raw_receipt", {
      p_policy: args.policy, p_scope: args.scope, p_row: args.row,
    }, IFTTT_RPC_DEADLINES.readMs);
    if (result.error || result.data?.version !== "ifttt-intake-reconciliation-v1"
      || result.data.policyId !== args.policy.id || result.data.status !== "committed") throw new IftttIntakeOutcomeUnknown();
    return { ...validateReceipt(args, result.data.receipt), reconciled: true as const };
  } catch { throw new IftttIntakeOutcomeUnknown(); }
}

function validateReceipt(args: ReceiptArguments, receipt: any) {
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
