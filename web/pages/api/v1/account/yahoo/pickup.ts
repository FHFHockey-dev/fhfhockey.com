import { ProviderSyncAccessError, requireProviderSyncAccess } from "lib/integrations/providerSyncAccessServer";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { consumeRecommendationRequest } from "lib/draft-pro/recommendationsRateLimit";
import { loadYahooPickupContext } from "lib/integrations/yahoo/pickupServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const user = await requireApiUser(req, res);
  if (!user) return;
  if (!consumeRecommendationRequest(user.id)) return res.status(429).json({ error: "Too many requests. Try again shortly." });
  try {
    await requireProviderSyncAccess(user.id);
    return res.status(200).json({ data: await loadYahooPickupContext(user.id) });
  } catch (error) {
    if (error instanceof ProviderSyncAccessError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    const status = error && typeof error === "object" && "statusCode" in error && error.statusCode === 409 ? 409 : 503;
    return res.status(status).json({ error: status === 409
      ? "Select a current-season Yahoo team in account settings, or reconnect Yahoo."
      : "Yahoo rosters could not be synced. Please try again." });
  }
}
