import type { NextApiRequest, NextApiResponse } from "next";

import { createClientWithToken } from "lib/supabase";
import {
  DraftRankerApiError,
  draftRankerMethodNotAllowed,
  draftRankerRequestId,
  handleDraftRankerError,
  isCommunityDraftRankingsEnabled,
  parseDraftRankerInput,
  sendDraftRankerData,
  sendDraftRankerError,
} from "lib/draft-ranker/api";
import { loadCommunityDraftRankings } from "lib/draft-ranker/communityReadServer";
import { communityDraftRankingsQuerySchema } from "lib/draft-ranker/contracts";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function optionalUserId(req: NextApiRequest) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
  if (!token) return null;
  const client = createClientWithToken(token);
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const requestId = draftRankerRequestId(req);
  if (req.method !== "GET") {
    return draftRankerMethodNotAllowed(res, requestId, ["GET"]);
  }
  if (!isCommunityDraftRankingsEnabled()) {
    return sendDraftRankerError(
      res,
      requestId,
      new DraftRankerApiError(
        503,
        "draft_ranker_disabled",
        "FHFH Community Rankings are not currently available.",
      ),
    );
  }
  try {
    const parsedQuery = parseDraftRankerInput(
      communityDraftRankingsQuerySchema,
      {
        page:
          req.query.page == null ? undefined : Number(first(req.query.page)),
        limit:
          req.query.limit == null ? undefined : Number(first(req.query.limit)),
      },
    );
    const query = {
      page: parsedQuery.page ?? 1,
      limit: parsedQuery.limit ?? 50,
    };
    return sendDraftRankerData(
      res,
      requestId,
      await loadCommunityDraftRankings({
        userId: await optionalUserId(req),
        query,
      }),
    );
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
