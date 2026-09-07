import type { NextApiRequest, NextApiResponse } from "next";

import { getStripeClient, getStripeWebhookSecret, isStripeConfigured } from "lib/integrations/stripe/config";
import { fulfillStripeProviderEvent, verifyDraftProCheckoutSession } from "lib/integrations/stripe/fulfillment";

export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  if (!isStripeConfigured()) return res.status(503).json({ error: "Stripe webhooks are not configured." });
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") return res.status(400).json({ error: "Stripe signature is required." });
  try {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(await readRawBody(req), signature, getStripeWebhookSecret());
    const eventSession = event.data.object as import("stripe").default.Checkout.Session;
    const normalizedEvent = event.type.startsWith("checkout.session.")
      ? { ...event, data: { ...event.data, object: await stripe.checkout.sessions.retrieve(eventSession.id) } }
      : event;
    if (event.type.startsWith("checkout.session.") && !(await verifyDraftProCheckoutSession(stripe, normalizedEvent.data.object as import("stripe").default.Checkout.Session))) {
      return res.status(200).json({ received: true, processed: false });
    }
    const result = await fulfillStripeProviderEvent({ event: normalizedEvent, stripe });
    return res.status(200).json({ received: true, processed: result.processed });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Webhook could not be verified." });
  }
}
