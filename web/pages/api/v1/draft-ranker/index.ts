import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  DraftRankerApiError,
  draftRankerMethodNotAllowed,
  draftRankerRequestId,
  handleDraftRankerError,
  isDraftRankerEnabled,
  isDraftRankerHomepageEnabled,
  sendDraftRankerData,
  sendDraftRankerError,
} from "lib/draft-ranker/api";
import { loadDraftRankerBootstrap } from "lib/draft-ranker/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const requestId = draftRankerRequestId(req);

  if (req.method !== "GET") {
    return draftRankerMethodNotAllowed(res, requestId, ["GET"]);
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
    const bootstrap = await loadDraftRankerBootstrap(user.id);
    return sendDraftRankerData(res, requestId, {
      ...bootstrap,
      pairwiseEnabled: isDraftRankerHomepageEnabled(),
    });
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
