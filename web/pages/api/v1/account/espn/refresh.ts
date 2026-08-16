import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithEspnError } from "lib/integrations/espn/http";
import { refreshEspnLeague } from "lib/integrations/espn/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const result = await refreshEspnLeague({
      userId: user.id,
      externalLeagueId: req.body?.externalLeagueId,
    });
    return res.status(200).json({ success: true, result });
  } catch (error) {
    return respondWithEspnError(res, error, "ESPN refresh failed.");
  }
}
