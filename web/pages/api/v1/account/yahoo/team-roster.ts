import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { buildYahooCallbackUrl } from "lib/integrations/yahoo/oauth";
import {
  loadYahooTeamRoster,
  YahooTeamRosterError,
} from "lib/integrations/yahoo/teamRoster";

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

  const externalTeamId =
    typeof req.body?.externalTeamId === "string"
      ? req.body.externalTeamId.trim()
      : "";
  if (!externalTeamId) {
    return res.status(400).json({ error: "A Yahoo team is required." });
  }

  try {
    const result = await loadYahooTeamRoster({
      userId: user.id,
      externalTeamId,
      redirectUri: buildYahooCallbackUrl(),
    });

    return res.status(200).json({
      success: true,
      message: result.cached
        ? `Loaded the cached roster for ${result.teamName || "Yahoo team"}.`
        : `Loaded and cached the roster for ${result.teamName || "Yahoo team"}.`,
      ...result,
    });
  } catch (error) {
    if (error instanceof YahooTeamRosterError && error.statusCode < 500) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Yahoo team roster load failed", error);
    return res
      .status(error instanceof YahooTeamRosterError ? error.statusCode : 500)
      .json({
        error: "Unable to load Yahoo team roster.",
        code: "YAHOO_TEAM_ROSTER_UNAVAILABLE",
      });
  }
}
