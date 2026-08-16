import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithEspnError } from "lib/integrations/espn/http";
import { stopEspnDraftSession } from "lib/integrations/espn/liveDraftServer";
import { EspnIntegrationError } from "lib/integrations/espn/server";

function sessionId(req: NextApiRequest) {
  const value = Array.isArray(req.query.sessionId)
    ? req.query.sessionId[0]
    : req.query.sessionId;
  if (!value?.trim()) {
    throw new EspnIntegrationError(
      "ESPN draft session is required.",
      400,
      "ESPN_DRAFT_REQUEST_INVALID",
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
    return res.status(200).json(
      await stopEspnDraftSession({ userId: user.id, sessionId: sessionId(req) }),
    );
  } catch (error) {
    return respondWithEspnError(res, error, "ESPN draft session could not stop.");
  }
}
