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
import { nudgeYahooDraftSession } from "lib/integrations/yahoo/liveDraftServer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  setYahooLiveDraftNoStore(res);
  if (req.method !== "POST") {
    return sendYahooLiveDraftMethodNotAllowed(res, ["POST"]);
  }
  if (!isYahooLiveDraftEnabled()) return sendYahooLiveDraftDisabled(res);
  const user = await requireApiUser(req, res);
  if (!user) return;
  if (!isYahooLiveDraftUserEntitled(user.id)) {
    return sendYahooLiveDraftForbidden(res);
  }
  try {
    const result = await nudgeYahooDraftSession(
      user.id,
      yahooLiveDraftSessionId(req),
    );
    if (result.poll.retryAfterSeconds > 0) {
      res.setHeader("Retry-After", String(result.poll.retryAfterSeconds));
    }
    return res.status(200).json(result);
  } catch (error) {
    return sendYahooLiveDraftError(res, error);
  }
}
