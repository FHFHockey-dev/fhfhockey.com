import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithFantraxError } from "lib/integrations/fantrax/http";
import {
  disconnectFantraxAccount,
  FantraxIntegrationError,
  updateFantraxConnection,
} from "lib/integrations/fantrax/server";

function accountId(req: NextApiRequest) {
  const value = Array.isArray(req.query.accountId)
    ? req.query.accountId[0]
    : req.query.accountId;
  if (!value?.trim()) {
    throw new FantraxIntegrationError(
      "Fantrax account is required.",
      400,
      "FANTRAX_ACCOUNT_REQUIRED",
    );
  }
  return value.trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const id = accountId(req);
    const result =
      req.method === "DELETE"
        ? await disconnectFantraxAccount({ userId: user.id, accountId: id })
        : await updateFantraxConnection({
            userId: user.id,
            accountId: id,
            accountLabel: req.body?.accountLabel,
            selectedLeagueKeys: req.body?.selectedLeagueKeys,
          });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondWithFantraxError(res, error, "Fantrax account update failed.");
  }
}
