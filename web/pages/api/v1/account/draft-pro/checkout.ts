import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { createDraftProCheckout } from "lib/integrations/stripe/checkout";
import { getStripeClient, isStripeConfigured } from "lib/integrations/stripe/config";

function requestOrigin(req: NextApiRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = req.headers.host;
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) throw new Error("A valid application origin is required.");
  return `${req.headers["x-forwarded-proto"] === "https" ? "https" : "http"}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  if (!isStripeConfigured()) return res.status(503).json({ error: "Stripe checkout is not configured." });
  try {
    const result = await createDraftProCheckout({ stripe: getStripeClient(), userId: user.id, origin: requestOrigin(req) });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Checkout could not be started." });
  }
}
