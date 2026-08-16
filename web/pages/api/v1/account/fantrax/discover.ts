import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithFantraxError } from "lib/integrations/fantrax/http";
import {
  discoverFantraxLeagues,
  discoverLinkedFantraxLeagues,
} from "lib/integrations/fantrax/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const result = req.body?.accountId
      ? await discoverLinkedFantraxLeagues({
          userId: user.id,
          accountId: req.body.accountId,
          selectedLeagueKeys: req.body?.selectedLeagueKeys,
        })
      : await discoverFantraxLeagues({
          userId: user.id,
          secretId: req.body?.secretId,
          selectedLeagueKeys: req.body?.selectedLeagueKeys,
        });
    return res.status(200).json(result);
  } catch (error) {
    return respondWithFantraxError(res, error, "Fantrax discovery failed.");
  }
}
