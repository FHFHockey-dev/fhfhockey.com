import type Stripe from "stripe";

import serviceRoleClient from "lib/supabase/server";
import { DRAFT_PRO_EXPIRATION, DRAFT_PRO_SEASON } from "lib/draft-pro/contracts";

import { DRAFT_PRO_STRIPE_PRICE } from "./config";

type CheckoutClient = Pick<typeof serviceRoleClient, "from">;

export async function createDraftProCheckout({
  stripe,
  userId,
  origin,
  client = serviceRoleClient,
}: {
  stripe: Stripe;
  userId: string;
  origin: string;
  client?: CheckoutClient;
}) {
  const { data: existing, error: existingError } = await client
    .from("draft_pro_purchases")
    .select("id,status,provider_checkout_session_id")
    .eq("user_id", userId)
    .eq("season", DRAFT_PRO_SEASON)
    .eq("provider", "stripe")
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "active") return { alreadyPurchased: true as const, url: null, purchaseId: existing.id };
  if (existing?.provider_checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(existing.provider_checkout_session_id);
    if (session.status === "open" && session.url) return { alreadyPurchased: false as const, url: session.url, purchaseId: existing.id };
  }

  const { data: purchase, error: purchaseError } = await client
    .from("draft_pro_purchases")
    .insert({ user_id: userId, metadata: { checkout_attempt: true } })
    .select("id")
    .single();
  if (purchaseError || !purchase) throw purchaseError ?? new Error("Could not record checkout attempt.");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price_data: { currency: DRAFT_PRO_STRIPE_PRICE.currency, product_data: { name: DRAFT_PRO_STRIPE_PRICE.productName }, unit_amount: DRAFT_PRO_STRIPE_PRICE.unitAmount }, quantity: 1 }],
    client_reference_id: purchase.id,
    metadata: { draft_pro_user_id: userId, draft_pro_purchase_id: purchase.id, draft_pro_season: DRAFT_PRO_SEASON },
    payment_intent_data: { metadata: { draft_pro_user_id: userId, draft_pro_purchase_id: purchase.id, draft_pro_season: DRAFT_PRO_SEASON } },
    success_url: `${origin}/account?draft_pro_checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account?draft_pro_checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  const { error: updateError } = await client.from("draft_pro_purchases").update({ provider_checkout_session_id: session.id, metadata: { checkout_attempt: true, checkout_created_at: new Date().toISOString(), expires_at: DRAFT_PRO_EXPIRATION } }).eq("id", purchase.id);
  if (updateError) throw updateError;
  return { alreadyPurchased: false as const, url: session.url, purchaseId: purchase.id };
}
