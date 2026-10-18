import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { PatreonApiError } from "lib/integrations/patreon/oauth";
import { refreshPatreonAccount } from "lib/integrations/patreon/sync";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const result = await refreshPatreonAccount({ userId: user.id });
    return res.status(200).json({
      success: true,
      entitlementStatus: result.snapshot.isEligibleSupporter
        ? "active"
        : "inactive",
      cooldownUntil: result.cooldownUntil,
    });
  } catch (error) {
    if (error instanceof PatreonApiError && error.retryAfterSeconds) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    }
    // Patreon's own 4xx text is safe to show; anything else stays in logs.
    if (error instanceof PatreonApiError && error.statusCode < 500) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Patreon refresh failed", error);
    return res
      .status(error instanceof PatreonApiError ? error.statusCode : 500)
      .json({
        error: "Patreon membership could not be refreshed.",
        code: "PATREON_REFRESH_UNAVAILABLE",
      });
  }
}
