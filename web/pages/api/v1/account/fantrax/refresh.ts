import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithFantraxError } from "lib/integrations/fantrax/http";
import { refreshFantrax } from "lib/integrations/fantrax/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const results = await refreshFantrax({
      userId: user.id,
      accountId: req.body?.accountId,
      externalLeagueId: req.body?.externalLeagueId,
    });
    return res.status(200).json({ success: true, results });
  } catch (error) {
    return respondWithFantraxError(res, error, "Fantrax refresh failed.");
  }
}
