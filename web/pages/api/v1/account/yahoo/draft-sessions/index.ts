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
} from "lib/integrations/yahoo/liveDraftApi";
import {
  createYahooDraftSession,
  listYahooDraftLeagues,
} from "lib/integrations/yahoo/liveDraftServer";
import { YahooLiveDraftError } from "lib/integrations/yahoo/liveDraft";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  setYahooLiveDraftNoStore(res);
  if (req.method !== "GET" && req.method !== "POST") {
    return sendYahooLiveDraftMethodNotAllowed(res, ["GET", "POST"]);
  }
  if (!isYahooLiveDraftEnabled()) return sendYahooLiveDraftDisabled(res);

  const user = await requireApiUser(req, res);
  if (!user) return;
  if (!isYahooLiveDraftUserEntitled(user.id)) {
    return sendYahooLiveDraftForbidden(res);
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json(await listYahooDraftLeagues(user.id));
    }
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    const allowedBodyKeys = new Set(["externalLeagueId", "draftRankingId"]);
    if (
      typeof body.externalLeagueId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        body.externalLeagueId,
      ) ||
      (body.draftRankingId != null &&
        (typeof body.draftRankingId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
            body.draftRankingId,
          ))) ||
      Object.keys(body).some((key) => !allowedBodyKeys.has(key))
    ) {
      throw new YahooLiveDraftError(
        "Request body must contain only an owned externalLeagueId and optional draftRankingId.",
        400,
        "validation_error",
      );
    }
    return res.status(201).json(
      await createYahooDraftSession(user.id, {
        externalLeagueId: body.externalLeagueId,
        draftRankingId: body.draftRankingId,
      }),
    );
  } catch (error) {
    return sendYahooLiveDraftError(res, error);
  }
}
