import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithFantraxError } from "lib/integrations/fantrax/http";
import { pollFantraxDraftSession } from "lib/integrations/fantrax/liveDraftServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const sessionId = Array.isArray(req.query.sessionId) ? req.query.sessionId[0] : req.query.sessionId;
    return res.status(200).json(await pollFantraxDraftSession({ userId: user.id, sessionId: sessionId ?? "" }));
  } catch (error) {
    return respondWithFantraxError(res, error, "Fantrax draft poll failed.");
  }
}
