import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  assertDraftRankerRolloutAccess,
  DraftRankerApiError,
  draftRankerMethodNotAllowed,
  draftRankerRequestId,
  handleDraftRankerError,
  isDraftRankerEnabled,
  parseDraftRankerInput,
  sendDraftRankerData,
  sendDraftRankerError,
} from "lib/draft-ranker/api";
import { requestDraftPlayerAdditionSchema } from "lib/draft-ranker/contracts";
import { requestDraftPlayerAddition } from "lib/draft-ranker/server";

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
        new DraftRankerApiError(401, "authentication_required", message),
      );
    },
  });
  if (!user) return;

  try {
    assertDraftRankerRolloutAccess(user.id);
    const input = parseDraftRankerInput(
      requestDraftPlayerAdditionSchema,
      req.body,
    );
    const result = await requestDraftPlayerAddition(user.id, {
      ...input,
      candidatePlayerIds: input.candidatePlayerIds ?? [],
    });
    return sendDraftRankerData(
      res,
      requestId,
      result,
      result.created ? 201 : 200,
    );
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
