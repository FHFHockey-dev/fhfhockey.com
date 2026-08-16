import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithEspnError } from "lib/integrations/espn/http";
import { addEspnLeague, EspnIntegrationError } from "lib/integrations/espn/server";

function accountId(req: NextApiRequest) {
  const value = Array.isArray(req.query.accountId)
    ? req.query.accountId[0]
    : req.query.accountId;
  if (!value?.trim()) {
    throw new EspnIntegrationError(
      "ESPN account is required.",
      400,
      "ESPN_ACCOUNT_REQUIRED",
    );
  }
  return value.trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const result = await addEspnLeague({
      userId: user.id,
      accountId: accountId(req),
      leagueRef: req.body?.leagueRef,
      season: req.body?.season,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondWithEspnError(res, error, "ESPN league could not be added.");
  }
}
