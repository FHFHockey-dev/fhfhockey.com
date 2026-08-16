import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithEspnError } from "lib/integrations/espn/http";
import { applyEspnSettings } from "lib/integrations/espn/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const settings = await applyEspnSettings({
      userId: user.id,
      externalLeagueId: req.body?.externalLeagueId,
      externalTeamId: req.body?.externalTeamId,
      settingsHash: req.body?.settingsHash,
      acknowledgeWarnings: req.body?.acknowledgeWarnings,
    });
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    return respondWithEspnError(res, error, "ESPN settings could not be applied.");
  }
}
