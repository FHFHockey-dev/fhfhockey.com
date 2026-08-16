import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithEspnError } from "lib/integrations/espn/http";
import { deleteEspnLeague, EspnIntegrationError } from "lib/integrations/espn/server";

function requiredQuery(req: NextApiRequest, key: "accountId" | "leagueId") {
  const raw = req.query[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.trim()) {
    throw new EspnIntegrationError(
      `ESPN ${key === "accountId" ? "account" : "league"} is required.`,
      400,
      key === "accountId" ? "ESPN_ACCOUNT_REQUIRED" : "ESPN_LEAGUE_REQUIRED",
    );
  }
  return value.trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const result = await deleteEspnLeague({
      userId: user.id,
      accountId: requiredQuery(req, "accountId"),
      externalLeagueId: requiredQuery(req, "leagueId"),
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondWithEspnError(res, error, "ESPN league could not be removed.");
  }
}
