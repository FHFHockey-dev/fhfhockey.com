import type Stripe from "stripe";
import { IN_SEASON_COMMERCE, canStartInSeasonPurchase } from "./commerce";
import { IN_SEASON_SANDBOX_CATALOG as catalog, MONTHLY_CHECKOUT_BLOCKER, verifyInSeasonSandboxAccount } from "./billingConfig";
import type { InSeasonAttempt, InSeasonBillingStore } from "./billingStore";
import { paymentAdjustmentSnapshot } from "./paymentAdjustments";

const cutoffSeconds = Date.parse(IN_SEASON_COMMERCE.accessEndsAt) / 1000;
const objectId = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;
const metadata = (attempt: InSeasonAttempt) => ({ in_season_attempt_id: attempt.id, in_season_user_id: attempt.user_id, in_season_plan: "season_pass", in_season: IN_SEASON_COMMERCE.season });

function verifySessionOwner(session: Stripe.Checkout.Session, attempt: InSeasonAttempt) {
  if (session.livemode !== false || session.mode !== "payment" || session.client_reference_id !== attempt.id
    || Object.entries(metadata(attempt)).some(([key, value]) => session.metadata?.[key] !== value)
    || (attempt.checkout_session_id && attempt.checkout_session_id !== session.id)) throw new Error("Checkout ownership or plan mismatch.");
}

export async function createInSeasonCheckout({ stripe, store, userId, origin, plan, now: suppliedNow }: {
  stripe: Stripe; store: InSeasonBillingStore; userId: string; origin: string; plan: string; now?: Date;
}) {
  const now = suppliedNow ?? new Date();
  if (plan === "monthly") throw new Error(MONTHLY_CHECKOUT_BLOCKER);
  if (plan !== "season_pass") throw new Error("Unknown in-season plan.");
  // Checkout requires at least 30 minutes before expiration. Never leave a
  // session purchasable after the season cutoff.
  if (!canStartInSeasonPurchase(now) || now.getTime() / 1000 + 31 * 60 >= cutoffSeconds) throw new Error("Season-pass checkout has closed.");
  await verifyInSeasonSandboxAccount(stripe);
  const price = await stripe.prices.retrieve(catalog.seasonPassPriceId);
  if (price.livemode !== false || !price.active || price.type !== "one_time" || price.recurring
    || price.unit_amount !== 2499 || price.currency !== "usd" || objectId(price.product) !== catalog.productId) throw new Error("Invalid season-pass price.");
  const attempt = await store.begin(userId);
  if (attempt.user_id !== userId) throw new Error("Checkout account mismatch.");
  if (attempt.status === "paid") return { state: "confirmed", url: null };
  if (attempt.status !== "pending") throw new Error("Checkout attempt is not pending.");
  if (attempt.checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(attempt.checkout_session_id);
    verifySessionOwner(session, attempt);
    if (session.status === "open" && session.expires_at <= cutoffSeconds && session.url) return { state: "checkout", url: session.url };
    if (session.status === "complete") return { state: "confirming", url: null };
    if (session.status === "expired") { await store.expire(attempt.id, session.id); return { state: "expired", url: null }; }
    throw new Error("Checkout state needs review.");
  }
  const created = Date.parse(attempt.created_at);
  // The database creates new attempts after this request starts. Compare after
  // the RPC and allow only a small server clock skew, never a client timestamp.
  const checkedAt = suppliedNow ?? new Date();
  if (!Number.isFinite(created) || created > checkedAt.getTime() + 5_000 || checkedAt.getTime() - created >= 23 * 60 * 60 * 1000) throw new Error("Unattached checkout needs review before retrying.");
  // Stable arguments and a durable key make retries safe even if Stripe
  // succeeded but attaching the session failed or its response was lost.
  const expiresAt = Math.min(Math.floor(created / 1000) + 24 * 60 * 60, cutoffSeconds);
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card", "link"],
    line_items: [{ price: catalog.seasonPassPriceId, quantity: 1 }],
    allow_promotion_codes: false, automatic_tax: { enabled: false },
    client_reference_id: attempt.id, metadata: metadata(attempt),
    payment_intent_data: { metadata: metadata(attempt) }, expires_at: expiresAt,
    success_url: `${origin}/account?section=in-season&in_season_checkout=confirming`,
    cancel_url: `${origin}/account?section=in-season&in_season_checkout=cancelled`,
  }, { idempotencyKey: `in-season-sandbox:${attempt.id}` });
  verifySessionOwner(session, attempt);
  if (!session.url || session.expires_at !== expiresAt) throw new Error("Invalid checkout response.");
  await store.attach(attempt.id, session.id);
  return { state: "checkout", url: session.url };
}

/** Signed completion/adjustment events only. Browser redirects grant nothing. */
export async function fulfillInSeasonEvent({ stripe, store, event, now = new Date() }: {
  stripe: Stripe; store: InSeasonBillingStore; event: Stripe.Event; now?: Date;
}) {
  if (event.livemode !== false) throw new Error("Live events are prohibited.");
  const completion = event.type === "checkout.session.completed";
  const adjustment = ["refund.created", "refund.updated", "refund.failed", "charge.refunded", "charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed"].includes(event.type);
  if (!completion && !adjustment) return { processed: false };
  if (!event.id || !Number.isInteger(event.created) || event.created <= 0 || event.created > now.getTime() / 1000) throw new Error("Invalid payment event time.");
  let attemptId: string | undefined;
  let sessionId: string | null;
  let adjustedPaymentId: string | null = null;
  if (completion) {
    const object = event.data.object as Stripe.Checkout.Session;
    attemptId = object.metadata?.in_season_attempt_id;
    sessionId = object.id;
    if (!attemptId) return { processed: false };
    await verifyInSeasonSandboxAccount(stripe);
  } else {
    await verifyInSeasonSandboxAccount(stripe);
    const object = event.data.object as Stripe.Refund | Stripe.Dispute | Stripe.Charge;
    const intentId = objectId(object.payment_intent);
    if (!intentId) return { processed: false };
    adjustedPaymentId = intentId;
    const discovery = await stripe.paymentIntents.retrieve(intentId);
    if (discovery.livemode !== false) throw new Error("Live payment prohibited.");
    if (discovery.metadata.in_season_plan !== "season_pass") return { processed: false };
    attemptId = discovery.metadata.in_season_attempt_id;
    if (!attemptId) throw new Error("Missing adjustment purchase binding.");
    sessionId = null;
  }
  const attempt = await store.get(attemptId);
  if (adjustedPaymentId && attempt.payment_intent_id && adjustedPaymentId !== attempt.payment_intent_id) throw new Error("Adjustment payment ownership mismatch.");
  if (!completion && (attempt.status !== "paid" || !attempt.paid_at || !attempt.payment_intent_id || !attempt.checkout_session_id)) throw new Error("Payment completion must be recorded before adjustment reconciliation.");
  sessionId ??= attempt.checkout_session_id;
  if (!sessionId) throw new Error("Checkout binding unavailable.");
  // Fenced lease serializes fresh snapshots. A previously committed delivery is
  // acknowledged before fetching again; a failed/expired holder cannot commit.
  const claim = await store.claim(attempt.id, event.id);
  if ("duplicate" in claim) return { processed: true, duplicate: true };
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  verifySessionOwner(session, attempt);
  const paidAt = completion ? new Date(event.created * 1000).toISOString() : attempt.paid_at!;
  if (Date.parse(paidAt) < Math.floor(Date.parse(attempt.created_at) / 1000) * 1000 || session.status !== "complete" || session.payment_status !== "paid"
    || session.amount_subtotal !== 2499 || session.amount_total !== 2499 || session.currency !== "usd"
    || session.total_details?.amount_discount !== 0 || session.total_details?.amount_shipping !== 0 || session.total_details?.amount_tax !== 0) throw new Error("Payment has not been verified.");
  const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
  const line = lines.data[0];
  if (lines.has_more || lines.data.length !== 1 || line.quantity !== 1 || line.amount_total !== 2499
    || line.price?.id !== catalog.seasonPassPriceId || objectId(line.price.product) !== catalog.productId) throw new Error("Paid line item mismatch.");
  const paymentIntentId = objectId(session.payment_intent);
  if (!paymentIntentId || (attempt.payment_intent_id && attempt.payment_intent_id !== paymentIntentId)) throw new Error("Payment binding mismatch.");
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
  const charge = intent.latest_charge;
  if (intent.livemode !== false || intent.status !== "succeeded" || intent.amount !== 2499 || intent.amount_received !== 2499 || intent.currency !== "usd"
    || Object.entries(metadata(attempt)).some(([key, value]) => intent.metadata[key] !== value)
    || !charge || typeof charge === "string" || charge.livemode !== false || charge.amount !== 2499 || objectId(charge.payment_intent) !== paymentIntentId || !charge.paid || !charge.captured) throw new Error("Payment intent is not a verified purchase.");
  const refunds = await stripe.refunds.list({ charge: charge.id, limit: 100 });
  const disputes = await stripe.disputes.list({ charge: charge.id, limit: 100 });
  const facts = paymentAdjustmentSnapshot(charge, refunds, disputes);
  await store.reconcile({ attemptId: attempt.id, userId: attempt.user_id, eventId: event.id, token: claim.token,
    sessionId: session.id, paymentIntentId, paidAt, active: facts.active && Date.parse(paidAt) < cutoffSeconds * 1000,
    snapshot: facts.snapshot });
  return { processed: true };
}
