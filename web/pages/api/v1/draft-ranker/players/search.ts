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
import { draftPlayerSearchQuerySchema } from "lib/draft-ranker/contracts";
import { searchDraftPlayers } from "lib/draft-ranker/server";

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
    const includeArchivedValue = first(req.query.includeArchived);
    const limitValue = first(req.query.limit);
    const input = parseDraftRankerInput(draftPlayerSearchQuerySchema, {
      query: first(req.query.q),
      includeArchived:
        includeArchivedValue === undefined
          ? undefined
          : includeArchivedValue === "true"
            ? true
            : includeArchivedValue === "false"
              ? false
              : includeArchivedValue,
      limit: limitValue === undefined ? undefined : Number(limitValue),
    });
    return sendDraftRankerData(
      res,
      requestId,
      await searchDraftPlayers({
        ...input,
        includeArchived: input.includeArchived ?? false,
        limit: input.limit ?? 20,
      }),
    );
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
