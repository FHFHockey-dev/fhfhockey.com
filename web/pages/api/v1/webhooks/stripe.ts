import type { NextApiRequest, NextApiResponse } from "next";

import { getStripeClient, getStripeWebhookSecret, isStripeConfigured } from "lib/integrations/stripe/config";
import { fulfillStripeProviderEvent } from "lib/integrations/stripe/fulfillment";

export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest) {
  const chunks: Uint8Array<ArrayBufferLike>[] = [];
  let size = 0;
  for await (const chunk of req) {
    const source = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const value = Uint8Array.from(source);
    size += value.length;
    if (size > 1024 * 1024) throw new Error("Webhook body too large");
    chunks.push(value);
  }
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
  const stripe = getStripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(await readRawBody(req), signature, getStripeWebhookSecret());
  } catch {
    return res.status(400).json({ error: "Webhook signature could not be verified." });
  }
  try {
    const result = await fulfillStripeProviderEvent({ event, stripe });
    return res.status(200).json({ received: true, processed: result.processed });
  } catch (error) {
    return res.status(500).json({ error: "Webhook processing failed." });
  }
}
