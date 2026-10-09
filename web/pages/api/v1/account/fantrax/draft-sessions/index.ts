import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithFantraxError } from "lib/integrations/fantrax/http";
import { listFantraxDraftSessions, startFantraxDraftSession } from "lib/integrations/fantrax/liveDraftServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    return res.status(200).json(req.method === "GET"
      ? await listFantraxDraftSessions({ userId: user.id })
      : await startFantraxDraftSession({
          userId: user.id,
          externalLeagueId: req.body?.externalLeagueId,
          externalTeamId: req.body?.externalTeamId,
        }));
  } catch (error) {
    return respondWithFantraxError(res, error, "Fantrax draft sync is unavailable.");
  }
}
