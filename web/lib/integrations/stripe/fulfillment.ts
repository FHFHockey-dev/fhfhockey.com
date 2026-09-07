import type Stripe from "stripe";

import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";

import { DRAFT_PRO_EXPIRATION, DRAFT_PRO_SEASON } from "lib/draft-pro/contracts";

export type StripeFulfillmentResult = {
  purchaseId: string | null;
  processed: boolean;
};

function stripeStatus(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return "active";
    case "charge.refunded":
      return "refunded";
    case "charge.dispute.created":
      return "disputed";
    case "charge.dispute.closed":
      return event.data.object.status === "won" ? "active" : "disputed";
    default:
      return null;
  }
}

function checkoutDetails(event: Stripe.Event) {
  const object = event.data.object as Stripe.Checkout.Session;
  const paymentIntent = typeof object.payment_intent === "string"
    ? object.payment_intent
    : object.payment_intent?.id ?? null;
  const sessionId = object.object === "checkout.session" ? object.id : null;
  const userId = object.metadata?.draft_pro_user_id ?? null;
  return { paymentIntent, sessionId, userId };
}

/**
 * The database function is deliberately the only fulfillment writer. It owns
 * event de-duplication and entitlement mutation in one transaction.
 */
export async function fulfillStripeEvent(
  event: Stripe.Event,
  client: Pick<typeof serviceRoleClient, "rpc"> = serviceRoleClient,
): Promise<StripeFulfillmentResult> {
  const status = stripeStatus(event);
  if (!status) return { purchaseId: null, processed: false };
  const { paymentIntent, sessionId, userId } = checkoutDetails(event);
  const { data, error } = await (client.rpc as any)("fulfill_draft_pro_stripe_purchase", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_session_id: sessionId,
    p_payment_intent_id: paymentIntent,
    p_user_id: userId,
    p_status: status,
    p_payload: event as unknown as Json,
    p_season: DRAFT_PRO_SEASON,
    p_expires_at: DRAFT_PRO_EXPIRATION,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { purchaseId: row?.purchase_id ?? null, processed: Boolean(row?.processed) };
}

export function checkoutUserId(session: Stripe.Checkout.Session) {
  return session.metadata?.draft_pro_user_id ?? null;
}

export async function verifyStripeCheckoutSession(
  session: Stripe.Checkout.Session,
  client: Pick<typeof serviceRoleClient, "rpc"> = serviceRoleClient,
) {
  if (session.payment_status !== "paid") return { purchaseId: null, processed: false };
  const event = {
    id: `return:${session.id}`,
    type: "checkout.session.completed",
    data: { object: session },
  } as unknown as Stripe.Event;
  return fulfillStripeEvent(event, client);
}
