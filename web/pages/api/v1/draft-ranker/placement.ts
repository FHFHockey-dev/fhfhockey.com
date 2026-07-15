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
import {
  draftPlacementMutationSchema,
  draftPlacementQuerySchema,
} from "lib/draft-ranker/contracts";
import {
  loadDraftPlacement,
  mutateDraftPlacement,
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
    if (req.method === "GET") {
      const input = parseDraftRankerInput(draftPlacementQuerySchema, {
        rankingId: first(req.query.rankingId),
        sessionId: first(req.query.sessionId),
      });
      return sendDraftRankerData(
        res,
        requestId,
        await loadDraftPlacement(user.id, input),
      );
    }

    const input = parseDraftRankerInput(
      draftPlacementMutationSchema,
      req.body,
    );
    return sendDraftRankerData(
      res,
      requestId,
      await mutateDraftPlacement(user.id, input),
    );
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
