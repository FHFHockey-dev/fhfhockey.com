import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  assertDraftRankerRolloutAccess,
  DraftRankerApiError,
  draftRankerMethodNotAllowed,
  draftRankerRequestId,
  handleDraftRankerError,
  isDraftRankerDiscoveryEnabled,
  isDraftRankerEnabled,
  parseDraftRankerInput,
  sendDraftRankerData,
  sendDraftRankerError,
} from "lib/draft-ranker/api";
import { draftDiscoveryQuerySchema } from "lib/draft-ranker/contracts";
import { loadDraftRankerDiscovery } from "lib/draft-ranker/discoveryReadServer";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const requestId = draftRankerRequestId(req);
  if (req.method !== "GET") {
    return draftRankerMethodNotAllowed(res, requestId, ["GET"]);
  }
  if (!isDraftRankerEnabled() || !isDraftRankerDiscoveryEnabled()) {
    return sendDraftRankerError(
      res,
      requestId,
      new DraftRankerApiError(
        503,
        "draft_ranker_disabled",
        "Draft Ranker discovery is not currently available.",
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
    const input = parseDraftRankerInput(draftDiscoveryQuerySchema, {
      rankingId: first(req.query.rankingId),
      limit:
        req.query.limit == null ? undefined : Number(first(req.query.limit)),
    });
    return sendDraftRankerData(
      res,
      requestId,
      await loadDraftRankerDiscovery(user.id, {
        ...input,
        limit: input.limit ?? 12,
      }),
    );
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
