import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { consumeRecommendationRequest } from "lib/draft-pro/recommendationsRateLimit";
import { loadYahooStarterBoard } from "lib/integrations/yahoo/starterBoard";

const input = z.object({ teamId: z.string().uuid().optional(), category: z.string().max(64).optional() }).strict();
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const user = await requireApiUser(req, res);
  if (!user) return;
  if (!consumeRecommendationRequest(user.id)) return res.status(429).json({ error: "Too many requests" });
  try {
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true });
    requireDraftProServerCapability(access, "recommendations");
    const body = input.parse(req.body ?? {});
    return res.status(200).json({ data: await loadYahooStarterBoard({ ...body, userId: user.id }) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid team or category" });
    const status = typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 503;
    const safeStatus = status >= 400 && status < 500 ? status : 503;
    return res.status(safeStatus).json({ error: safeStatus === 403 ? "Draft Pro access is required." : safeStatus === 409 ? "Reconnect Yahoo or select a current-season team." : "Yahoo recommendations are unavailable. Please try again." });
  }
}
