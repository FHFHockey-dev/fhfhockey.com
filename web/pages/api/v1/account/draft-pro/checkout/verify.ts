import type { NextApiRequest, NextApiResponse } from "next";

import { z } from "zod";

import { requireApiUser } from "lib/api/requireApiUser";
import serviceRoleClient from "lib/supabase/server";
import { loadDraftProAccess } from "lib/draft-pro/server";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { getStripeClient, isStripeConfigured } from "lib/integrations/stripe/config";
import { checkoutUserId, verifyStripeCheckoutSession } from "lib/integrations/stripe/fulfillment";

const inputSchema = z.object({ sessionId: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/) }).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid Checkout session is required." });
  if (!isStripeConfigured()) return res.status(503).json({ error: "Stripe checkout is not configured." });
  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId);
    if (checkoutUserId(session) !== user.id) return res.status(403).json({ error: "This Checkout session belongs to another account." });
    const result = await verifyStripeCheckoutSession(stripe, session);
    const purchaseId = result.purchaseId ?? session.metadata?.draft_pro_purchase_id ?? null;
    const { data: purchase, error: purchaseError } = purchaseId
      ? await serviceRoleClient.from("draft_pro_purchases").select("id,status").eq("id", purchaseId).eq("user_id", user.id).maybeSingle()
      : { data: null };
    if (purchaseError) throw purchaseError;
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true });
    const state = access.eligible && purchase?.status === "active"
      ? "confirmed"
      : purchase?.status === "pending" && session.payment_status === "paid"
        ? (session.payment_status === "paid" ? "confirming" : "waiting")
        : "ineligible";
    return res.status(200).json({ state, purchaseId });
  } catch (error) {
    return res.status(500).json({ error: "Checkout verification failed." });
  }
}
