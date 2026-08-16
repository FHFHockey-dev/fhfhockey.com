import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithEspnError } from "lib/integrations/espn/http";
import { linkEspnAccount } from "lib/integrations/espn/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const result = await linkEspnAccount({
      userId: user.id,
      accountLabel: req.body?.accountLabel,
      swid: req.body?.swid,
      espnS2: req.body?.espnS2,
      leagueRef: req.body?.leagueRef,
      season: req.body?.season,
      consentVersion: req.body?.consentVersion,
      targetAccountId: req.body?.targetAccountId,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondWithEspnError(res, error, "ESPN linking failed.");
  }
}
