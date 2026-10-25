import type { NextApiRequest, NextApiResponse } from "next";
import { getInSeasonSandboxStripe } from "lib/in-season/billingConfig";
import { inSeasonBillingStore } from "lib/in-season/billingStore";
import { fulfillInSeasonEvent } from "lib/in-season/billing";
import { fulfillMonthlyEvent } from "lib/in-season/monthlyWebhook";
import { monthlyBillingStore } from "lib/in-season/monthlyStore";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  let stripe;
  try { stripe = getInSeasonSandboxStripe(); }
  catch { return res.status(503).json({ error: "Sandbox billing is unavailable." }); }
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") return res.status(400).json({ error: "Signature required." });
  let event;
  try {
    const chunks: Uint8Array<ArrayBufferLike>[] = [];
    let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > 1024 * 1024) throw new Error("Payload too large.");
      chunks.push(Uint8Array.from(bytes));
    }
    event = stripe.webhooks.constructEvent(Buffer.concat(chunks), signature, process.env.IN_SEASON_STRIPE_WEBHOOK_SECRET!);
  } catch { return res.status(400).json({ error: "Signature could not be verified." }); }
  try {
    const monthly = await fulfillMonthlyEvent({ stripe, store: monthlyBillingStore(), event });
    const result = monthly.processed ? monthly : await fulfillInSeasonEvent({ stripe, store: inSeasonBillingStore(), event });
    return res.status(200).json({ received: true, ...result });
  } catch { return res.status(503).json({ error: "Payment verification failed." }); }
}
