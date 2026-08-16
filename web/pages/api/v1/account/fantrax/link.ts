import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithFantraxError } from "lib/integrations/fantrax/http";
import { linkFantraxAccount } from "lib/integrations/fantrax/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const result = await linkFantraxAccount({
      userId: user.id,
      secretId: req.body?.secretId,
      accountLabel: req.body?.accountLabel,
      selectedLeagueKeys: req.body?.selectedLeagueKeys,
      consentVersion: req.body?.consentVersion,
      targetAccountId: req.body?.targetAccountId,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondWithFantraxError(res, error, "Fantrax linking failed.");
  }
}
