import { ProviderSyncAccessError, requireProviderSyncAccess } from "lib/integrations/providerSyncAccessServer";
import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  createYahooAuthorizationRequest,
  sanitizeYahooNextPath,
} from "lib/integrations/yahoo/oauth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const user = await requireApiUser(req, res);
    if (!user) {
      return;
    }

    await requireProviderSyncAccess(user.id);
    const next = sanitizeYahooNextPath(req.body?.next);
    const { authorizationUrl, browserCookie } =
      await createYahooAuthorizationRequest({ next, userId: user.id });

    res.setHeader("Set-Cookie", browserCookie);
    return res.status(200).json({ authorizationUrl });
  } catch (error) {
    if (error instanceof ProviderSyncAccessError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    console.error("Yahoo connect failed", error);
    return res.status(500).json({
      error: "Yahoo authorization could not be started.",
      code: "YAHOO_CONNECT_UNAVAILABLE",
    });
  }
}
