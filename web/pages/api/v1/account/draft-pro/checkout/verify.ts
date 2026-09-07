import type { NextApiRequest, NextApiResponse } from "next";

import { z } from "zod";

import { requireApiUser } from "lib/api/requireApiUser";
import { getStripeClient, isStripeConfigured } from "lib/integrations/stripe/config";
import { checkoutUserId, verifyStripeCheckoutSession } from "lib/integrations/stripe/fulfillment";

const inputSchema = z.object({ sessionId: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/) }).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    return res.status(200).json({ state: result.purchaseId ? "confirmed" : session.payment_status === "paid" ? "confirming" : "ineligible", purchaseId: result.purchaseId });
  } catch (error) {
    return res.status(500).json({ error: "Checkout verification failed." });
  }
}
