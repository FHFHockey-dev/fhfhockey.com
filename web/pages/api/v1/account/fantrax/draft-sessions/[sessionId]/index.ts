import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithFantraxError } from "lib/integrations/fantrax/http";
import { getFantraxDraftSession } from "lib/integrations/fantrax/liveDraftServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const sessionId = Array.isArray(req.query.sessionId) ? req.query.sessionId[0] : req.query.sessionId;
    return res.status(200).json(await getFantraxDraftSession({ userId: user.id, sessionId: sessionId ?? "" }));
  } catch (error) {
    return respondWithFantraxError(res, error, "Fantrax draft session could not be loaded.");
  }
}
