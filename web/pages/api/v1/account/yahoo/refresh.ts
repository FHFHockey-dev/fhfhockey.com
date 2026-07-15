import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { buildYahooCallbackUrl } from "lib/integrations/yahoo/oauth";
import {
  runYahooManualRefresh,
  YahooRefreshError,
} from "lib/integrations/yahoo/refresh";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }

  try {
    const result = await runYahooManualRefresh({
      userId: user.id,
      redirectUri: buildYahooCallbackUrl(req),
    });

    return res.status(200).json({
      success: true,
      message: `Yahoo refreshed ${result.teamCount} team${result.teamCount === 1 ? "" : "s"} across ${result.leagueCount} league${result.leagueCount === 1 ? "" : "s"}.`,
      ...result,
    });
  } catch (error) {
    if (error instanceof YahooRefreshError) {
      if (error.retryAfterSeconds) {
        res.setHeader("Retry-After", String(error.retryAfterSeconds));
      }
      return res.status(error.statusCode).json({
        error: error.message,
        retryAfterSeconds: error.retryAfterSeconds ?? null,
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Yahoo refresh failed.",
    });
  }
}
