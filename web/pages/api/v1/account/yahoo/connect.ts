import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  buildYahooAuthorizationUrl,
  sanitizeYahooNextPath,
} from "lib/integrations/yahoo/oauth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }

  const next = sanitizeYahooNextPath(req.body?.next);
  const authorizationUrl = buildYahooAuthorizationUrl(req, user.id, next);

  return res.status(200).json({ authorizationUrl });
}
