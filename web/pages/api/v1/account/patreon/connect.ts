import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  buildPatreonAuthorizationUrl,
  sanitizePatreonNextPath,
} from "lib/integrations/patreon/oauth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const next = sanitizePatreonNextPath(req.body?.next);
    return res.status(200).json({
      authorizationUrl: buildPatreonAuthorizationUrl(req, user.id, next),
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Patreon authorization could not be started.",
    });
  }
}
