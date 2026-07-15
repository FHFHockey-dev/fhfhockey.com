import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
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
import { draftContributionPreferenceSchema } from "lib/draft-ranker/contracts";
import {
  loadDraftContributionPreference,
  setDraftContributionPreference,
} from "lib/draft-ranker/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const requestId = draftRankerRequestId(req);
  if (req.method !== "GET" && req.method !== "POST") {
    return draftRankerMethodNotAllowed(res, requestId, ["GET", "POST"]);
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
    const data =
      req.method === "GET"
        ? await loadDraftContributionPreference(user.id)
        : await setDraftContributionPreference(
            user.id,
            parseDraftRankerInput(draftContributionPreferenceSchema, req.body),
          );
    return sendDraftRankerData(res, requestId, data);
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
