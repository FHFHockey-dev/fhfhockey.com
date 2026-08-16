import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithEspnError } from "lib/integrations/espn/http";
import {
  listEspnDraftLeagues,
  startEspnDraftSession,
} from "lib/integrations/espn/liveDraftServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    if (req.method === "GET") {
      return res.status(200).json(await listEspnDraftLeagues({ userId: user.id }));
    }
    return res.status(200).json(
      await startEspnDraftSession({
        userId: user.id,
        externalLeagueId: req.body?.externalLeagueId,
        externalTeamId: req.body?.externalTeamId,
      }),
    );
  } catch (error) {
    return respondWithEspnError(res, error, "ESPN draft session could not start.");
  }
}
