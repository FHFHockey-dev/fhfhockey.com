import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  DraftRankerApiError,
  draftRankerMethodNotAllowed,
  draftRankerRequestId,
  handleDraftRankerError,
  isDraftRankerEnabled,
  parseDraftRankerInput,
  sendDraftRankerData,
  sendDraftRankerError,
} from "lib/draft-ranker/api";
import { initializeDraftRankingSchema } from "lib/draft-ranker/contracts";
import { initializeDraftRanking } from "lib/draft-ranker/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const requestId = draftRankerRequestId(req);
  if (req.method !== "POST") {
    return draftRankerMethodNotAllowed(res, requestId, ["POST"]);
  }
  if (!isDraftRankerEnabled()) {
    return sendDraftRankerError(
      res,
      requestId,
      new DraftRankerApiError(
        503,
        "draft_ranker_disabled",
        "The Draft Ranker is not currently available.",
      ),
    );
  }

  const user = await requireApiUser(req, res, {
    onUnauthorized: (message) => {
      sendDraftRankerError(
        res,
        requestId,
        new DraftRankerApiError(
          401,
          "authentication_required",
          message,
        ),
      );
    },
  });
  if (!user) {
    return;
  }

  try {
    const parsedInput = parseDraftRankerInput(
      initializeDraftRankingSchema,
      req.body ?? {},
    );
    const input = {
      operationId: parsedInput.operationId,
      scoringProfile: parsedInput.scoringProfile ?? {},
    };
    const result = await initializeDraftRanking(user.id, input);
    return sendDraftRankerData(
      res,
      requestId,
      result,
      result.idempotentReplay ? 200 : 201,
    );
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
