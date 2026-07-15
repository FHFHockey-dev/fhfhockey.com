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
import {
  draftPlayerActionSchema,
  draftPlayerActionsQuerySchema,
} from "lib/draft-ranker/contracts";
import {
  applyDraftPlayerAction,
  loadDraftPlayerActions,
} from "lib/draft-ranker/server";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const requestId = draftRankerRequestId(req);
  if (req.method !== "GET" && req.method !== "POST") {
    return draftRankerMethodNotAllowed(res, requestId, ["GET", "POST"]);
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
    if (req.method === "GET") {
      const input = parseDraftRankerInput(draftPlayerActionsQuerySchema, {
        rankingId: first(req.query.rankingId),
      });
      return sendDraftRankerData(
        res,
        requestId,
        await loadDraftPlayerActions(user.id, input.rankingId),
      );
    }

    const input = parseDraftRankerInput(draftPlayerActionSchema, req.body);
    return sendDraftRankerData(
      res,
      requestId,
      await applyDraftPlayerAction(user.id, input),
    );
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
