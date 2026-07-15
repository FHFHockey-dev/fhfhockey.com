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
  sendDraftRankerError,
} from "lib/draft-ranker/api";
import {
  draftRankingExportQuerySchema,
  type DraftRankingExportQuery,
} from "lib/draft-ranker/contracts";
import {
  draftRankingExportFilename,
  serializeDraftRankingCsv,
} from "lib/draft-ranker/export";
import { enforceDraftRankingExportRateLimit } from "lib/draft-ranker/exportRateLimit";
import { loadDraftRankingExport } from "lib/draft-ranker/exportServer";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function queryBoolean(value: string | string[] | undefined): unknown {
  const candidate = first(value);
  if (candidate === undefined) return undefined;
  if (candidate === "true") return true;
  if (candidate === "false") return false;
  return candidate;
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
    assertDraftRankerRolloutAccess(user.id);
    const parsed = parseDraftRankerInput(draftRankingExportQuerySchema, {
      rankingId: first(req.query.rankingId),
      format: first(req.query.format),
      includeCandidates: queryBoolean(req.query.includeCandidates),
      includeWatchlist: queryBoolean(req.query.includeWatchlist),
      includeEventSummary: queryBoolean(req.query.includeEventSummary),
    });
    const input: DraftRankingExportQuery = {
      rankingId: parsed.rankingId,
      format: parsed.format ?? "csv",
      includeCandidates: parsed.includeCandidates ?? false,
      includeWatchlist: parsed.includeWatchlist ?? false,
      includeEventSummary: parsed.includeEventSummary ?? false,
    };
    const rate = await enforceDraftRankingExportRateLimit(user.id);
    const document = await loadDraftRankingExport(user.id, input);
    const filename = draftRankingExportFilename(
      document.ranking.targetSeason,
      input.format,
    );
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-RateLimit-Remaining", String(rate.remainingPoints));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (input.format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      return res.status(200).send(serializeDraftRankingCsv(document));
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(JSON.stringify(document, null, 2));
  } catch (error) {
    return handleDraftRankerError(res, requestId, error);
  }
}
