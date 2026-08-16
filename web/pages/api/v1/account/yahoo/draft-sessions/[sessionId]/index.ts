import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  isYahooLiveDraftEnabled,
  isYahooLiveDraftUserEntitled,
  sendYahooLiveDraftDisabled,
  sendYahooLiveDraftError,
  sendYahooLiveDraftForbidden,
  sendYahooLiveDraftMethodNotAllowed,
  setYahooLiveDraftNoStore,
  yahooLiveDraftSessionId,
} from "lib/integrations/yahoo/liveDraftApi";
import { loadYahooDraftSession } from "lib/integrations/yahoo/liveDraftServer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  setYahooLiveDraftNoStore(res);
  if (req.method !== "GET") {
    return sendYahooLiveDraftMethodNotAllowed(res, ["GET"]);
  }
  if (!isYahooLiveDraftEnabled()) return sendYahooLiveDraftDisabled(res);
  const user = await requireApiUser(req, res);
  if (!user) return;
  if (!isYahooLiveDraftUserEntitled(user.id)) {
    return sendYahooLiveDraftForbidden(res);
  }
  try {
    return res
      .status(200)
      .json(await loadYahooDraftSession(user.id, yahooLiveDraftSessionId(req)));
  } catch (error) {
    return sendYahooLiveDraftError(res, error);
  }
}
