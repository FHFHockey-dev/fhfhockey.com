import type Stripe from "stripe";

const id = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;

/** Complete, freshly retrieved lists from the verified account; never issues refunds. */
export function paymentAdjustmentSnapshot(charge: Stripe.Charge, refunds: Stripe.ApiList<Stripe.Refund>, disputes: Stripe.ApiList<Stripe.Dispute>) {
  if (charge.livemode !== false || !charge.paid || !charge.captured || charge.currency !== "usd" || refunds.has_more || disputes.has_more) throw new Error("Payment adjustment inventory is incomplete.");
  const seen = new Set<string>();
  let refunded = 0;
  const refundFacts = refunds.data.map((refund) => {
    if (!refund.id || seen.has(refund.id) || id(refund.charge) !== charge.id || id(refund.payment_intent) !== id(charge.payment_intent)
      || refund.currency !== charge.currency || !Number.isSafeInteger(refund.amount) || refund.amount <= 0
      || !["succeeded", "pending", "requires_action", "failed", "canceled"].includes(refund.status ?? "")) throw new Error("Refund is not verified for this payment.");
    seen.add(refund.id);
    if (refund.status === "succeeded") refunded += refund.amount;
    return { id: refund.id, amount: refund.amount, status: refund.status };
  });
  const disputeFacts = disputes.data.map((dispute) => {
    if (!dispute.id || seen.has(dispute.id) || dispute.livemode !== false || id(dispute.charge) !== charge.id
      || id(dispute.payment_intent) !== id(charge.payment_intent) || dispute.currency !== charge.currency
      || !["needs_response", "under_review", "won", "lost"].includes(dispute.status)) throw new Error("Dispute is not verified for this payment.");
    seen.add(dispute.id);
    return { id: dispute.id, status: dispute.status };
  });
  if (refunded > charge.amount || (charge.disputed && !disputes.data.length) || (charge.amount_refunded > 0 && !refunds.data.length)) throw new Error("Payment adjustments require reconciliation.");
  return { active: refunded < charge.amount && disputeFacts.every((dispute) => dispute.status === "won"),
    snapshot: { chargeId: charge.id, paymentIntentId: id(charge.payment_intent), amount: charge.amount, refunded, refunds: refundFacts, disputes: disputeFacts } };
}
