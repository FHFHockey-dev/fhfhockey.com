import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  sendYahooLiveDraftError,
  sendYahooLiveDraftMethodNotAllowed,
  setYahooLiveDraftNoStore,
  yahooLiveDraftSessionId,
} from "lib/integrations/yahoo/liveDraftApi";
import { stopYahooDraftSession } from "lib/integrations/yahoo/liveDraftServer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  setYahooLiveDraftNoStore(res);
  if (req.method !== "POST") {
    return sendYahooLiveDraftMethodNotAllowed(res, ["POST"]);
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    return res
      .status(200)
      .json(await stopYahooDraftSession(user.id, yahooLiveDraftSessionId(req)));
  } catch (error) {
    return sendYahooLiveDraftError(res, error);
  }
}
