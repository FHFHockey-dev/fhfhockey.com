import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithFantraxError } from "lib/integrations/fantrax/http";
import { applyFantraxSettings } from "lib/integrations/fantrax/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const settings = await applyFantraxSettings({
      userId: user.id,
      externalLeagueId: req.body?.externalLeagueId,
      externalTeamId: req.body?.externalTeamId,
      settingsHash: req.body?.settingsHash,
      acknowledgeWarnings: req.body?.acknowledgeWarnings,
    });
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    return respondWithFantraxError(res, error, "Fantrax settings could not be applied.");
  }
}
