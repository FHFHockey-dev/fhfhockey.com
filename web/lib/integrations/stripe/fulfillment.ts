import type Stripe from "stripe";

import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";

import { DRAFT_PRO_SEASON } from "lib/draft-pro/contracts";

import { DRAFT_PRO_STRIPE_PRICE, getDraftProStripeCatalog } from "./config";

export type StripeFulfillmentResult = {
  purchaseId: string | null;
  processed: boolean;
};

function stripeStatus(event: Pick<Stripe.Event, "type">) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return "paid";
    default:
      return null;
  }
}

function checkoutDetails(session: Stripe.Checkout.Session) {
  const paymentIntent = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  const sessionId = session.object === "checkout.session" ? session.id : null;
  const userId = session.metadata?.draft_pro_user_id ?? null;
  return { paymentIntent, sessionId, userId };
}

export function isVerifiedDraftProCheckout(session: Stripe.Checkout.Session) {
  return session.mode === "payment"
    && session.payment_status === "paid"
    && session.amount_total === DRAFT_PRO_STRIPE_PRICE.unitAmount
    && session.currency === DRAFT_PRO_STRIPE_PRICE.currency
    && Boolean(session.metadata?.draft_pro_user_id)
    && Boolean(session.metadata?.draft_pro_purchase_id)
    && session.metadata?.draft_pro_season === DRAFT_PRO_SEASON
    && session.client_reference_id === session.metadata?.draft_pro_purchase_id;
}

export async function verifyDraftProCheckoutSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (!isVerifiedDraftProCheckout(session)) return false;
  const catalog = getDraftProStripeCatalog();
  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2, expand: ["data.price.product"] });
  const item = items.data[0];
  const product = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  return items.data.length === 1 && item.quantity === 1 && item.price?.id === catalog.priceId && product === catalog.productId && item.price.unit_amount === DRAFT_PRO_STRIPE_PRICE.unitAmount && item.price.currency === DRAFT_PRO_STRIPE_PRICE.currency;
}

/**
 * The database function is deliberately the only fulfillment writer. It owns
 * event de-duplication and entitlement mutation in one transaction.
 */
async function fulfillStripeEvent(
  event: Pick<Stripe.Event, "id" | "type" | "created">,
  session: Stripe.Checkout.Session,
  client: Pick<typeof serviceRoleClient, "rpc"> = serviceRoleClient,
): Promise<StripeFulfillmentResult> {
  const status = stripeStatus(event);
  if (!status) return { purchaseId: null, processed: false };
  if (!isVerifiedDraftProCheckout(session)) {
    return { purchaseId: null, processed: false };
  }
  const { paymentIntent, sessionId, userId } = checkoutDetails(session);
  const purchaseId = session.metadata?.draft_pro_purchase_id ?? null;
  if (!sessionId || !userId || !purchaseId || !Number.isFinite(event.created)) {
    return { purchaseId: null, processed: false };
  }
  const { data, error } = await client.rpc("record_draft_pro_stripe_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_checkout_session_id: sessionId,
    p_payment_intent_id: paymentIntent,
    p_user_id: userId,
    p_payment_state: status,
    p_payload: { event_id: event.id, event_type: event.type } as Json,
    p_occurred_at: new Date(event.created * 1000).toISOString(),
    p_purchase_id: purchaseId,
    p_full_refund: false,
    p_dispute_id: null,
    p_dispute_status: null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { purchaseId: row?.purchase_id ?? null, processed: Boolean(row?.processed) };
}

export async function fulfillStripeProviderEvent({
  event,
  stripe,
  client = serviceRoleClient,
}: {
  event: Stripe.Event;
  stripe: Stripe;
  client?: Pick<typeof serviceRoleClient, "rpc">;
}): Promise<StripeFulfillmentResult> {
  if (event.type.startsWith("checkout.session.")) {
    const eventSession = event.data.object as Stripe.Checkout.Session;
    const session = await stripe.checkout.sessions.retrieve(eventSession.id);
    if (!(await verifyDraftProCheckoutSession(stripe, session))) return { purchaseId: null, processed: false };
    return fulfillStripeEvent(event, session, client);
  }
  if (![
    "charge.refunded",
    "charge.dispute.created",
    "charge.dispute.closed",
  ].includes(event.type)) return { purchaseId: null, processed: false };

  const disputed = event.data.object as Stripe.Dispute;
  const chargeId = event.type.startsWith("charge.dispute.")
    ? typeof disputed.charge === "string" ? disputed.charge : disputed.charge.id
    : (event.data.object as Stripe.Charge).id;
  const charge = await stripe.charges.retrieve(chargeId);
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return { purchaseId: null, processed: false };
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const userId = paymentIntent.metadata.draft_pro_user_id;
  const purchaseId = paymentIntent.metadata.draft_pro_purchase_id;
  if (!userId || !purchaseId) return { purchaseId: null, processed: false };
  const isRefund = event.type === "charge.refunded";
  const disputeStatus = event.type === "charge.dispute.created" ? "open"
    : event.type === "charge.dispute.closed" ? disputed.status === "won" ? "won" : "lost" : null;
  const { data, error } = await client.rpc("record_draft_pro_stripe_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_occurred_at: new Date(event.created * 1000).toISOString(),
    p_checkout_session_id: null,
    p_payment_intent_id: paymentIntentId,
    p_user_id: userId,
    p_purchase_id: purchaseId,
    p_payment_state: disputeStatus === "won" ? "dispute_won" : isRefund ? "refunded" : "disputed",
    p_full_refund: isRefund && charge.amount_refunded >= charge.amount,
    p_dispute_id: isRefund ? null : disputed.id,
    p_dispute_status: disputeStatus,
    p_payload: event as unknown as Json,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { purchaseId: row?.purchase_id ?? null, processed: Boolean(row?.processed) };
}

export function checkoutUserId(session: Stripe.Checkout.Session) {
  return session.metadata?.draft_pro_user_id ?? null;
}

export async function verifyStripeCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  client: Pick<typeof serviceRoleClient, "rpc"> = serviceRoleClient,
) {
  if (!(await verifyDraftProCheckoutSession(stripe, session))) return { purchaseId: null, processed: false };
  const event = {
    id: `return:${session.id}`,
    created: session.created,
    type: "checkout.session.completed",
    data: { object: session },
  } as unknown as Stripe.Event;
  return fulfillStripeEvent(event, session, client);
}
