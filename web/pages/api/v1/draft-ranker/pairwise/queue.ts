import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  assertDraftRankerRolloutAccess,
  DraftRankerApiError,
  draftRankerMethodNotAllowed,
  draftRankerRequestId,
  handleDraftRankerError,
  isDraftRankerEnabled,
  isDraftRankerHomepageEnabled,
  parseDraftRankerInput,
  sendDraftRankerData,
  sendDraftRankerError,
} from "lib/draft-ranker/api";
import { draftPairQueueSchema } from "lib/draft-ranker/contracts";
import { issueNextDraftPairPrompt } from "lib/draft-ranker/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const requestId = draftRankerRequestId(req);
  if (req.method !== "POST") {
    return draftRankerMethodNotAllowed(res, requestId, ["POST"]);
  }
  if (!isDraftRankerEnabled() || !isDraftRankerHomepageEnabled()) {
    return sendDraftRankerError(
      res,
      requestId,
      new DraftRankerApiError(
        503,
        "draft_ranker_disabled",
        "Pairwise Draft Ranker features are not currently available.",
      ),
    );
  }
  const user = await requireApiUser(req, res, {
    onUnauthorized: (message) =>
      sendDraftRankerError(
        res,
        requestId,
        new DraftRankerApiError(401, "authentication_required", message),
      ),
  });
  if (!user) return;

  try {
    assertDraftRankerRolloutAccess(user.id);
    const input = parseDraftRankerInput(draftPairQueueSchema, req.body);
    return sendDraftRankerData(
      res,
      requestId,
      await issueNextDraftPairPrompt(user.id, {
        ...input,
        mode: input.mode ?? "improve_ranking",
      }),
    );
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
