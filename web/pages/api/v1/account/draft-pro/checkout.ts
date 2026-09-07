import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { loadDraftProAccess } from "lib/draft-pro/server";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { createDraftProCheckout } from "lib/integrations/stripe/checkout";
import { getStripeClient, isStripeConfigured } from "lib/integrations/stripe/config";

function requestOrigin(req: NextApiRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("The canonical application origin is not configured.");
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
  const flags = getDraftProFeatureFlags();
  if (!flags.checkout) return res.status(403).json({ error: "Draft Pro checkout is unavailable." });
  if (!isStripeConfigured()) return res.status(503).json({ error: "Stripe checkout is unavailable." });
  try {
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags, patreonVerificationAvailable: true });
    if (access.eligible) return res.status(409).json({ error: "Draft Pro is already active for this account." });
    const result = await createDraftProCheckout({ stripe: getStripeClient(), userId: user.id, origin: requestOrigin(req) });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: "Checkout could not be started." });
  }
}
