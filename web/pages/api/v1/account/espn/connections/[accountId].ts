import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithEspnError } from "lib/integrations/espn/http";
import {
  disconnectEspnAccount,
  EspnIntegrationError,
  updateEspnConnection,
} from "lib/integrations/espn/server";

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
        ? await disconnectEspnAccount({ userId: user.id, accountId: id })
        : await updateEspnConnection({
            userId: user.id,
            accountId: id,
            accountLabel: req.body?.accountLabel,
            swid: req.body?.swid,
            espnS2: req.body?.espnS2,
          });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondWithEspnError(res, error, "ESPN account update failed.");
  }
}
