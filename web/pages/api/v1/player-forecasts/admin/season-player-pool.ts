import type { NextApiResponse } from "next";

import {
  fetchOfficialNhlPlayerEvidence,
  loadPendingSeasonPlayerPoolReview,
  persistSeasonIdentityResolution,
  searchSeasonIdentityCandidates,
  SEASON_IDENTITY_LIFECYCLE_STATUSES,
  type SeasonIdentityLifecycleStatus,
} from "lib/fantasy-projections/identityResolution";
import { NhlApiHttpError } from "lib/NHL/base";
import { playerForecastErrorMessage } from "lib/player-forecasts/runtimeSafety";
import playerForecastSeasonEditorOnly, {
  type PlayerForecastSeasonEditorRequest,
} from "utils/playerForecastSeasonEditorOnlyMiddleware";

export default playerForecastSeasonEditorOnly(
  async (req: PlayerForecastSeasonEditorRequest, res: NextApiResponse) => {
    if (!["GET", "POST"].includes(req.method ?? "")) {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ success: false, message: "Method not allowed." });
    }

    try {
      if (req.method === "GET") {
        const reviewId = Array.isArray(req.query.reviewId)
          ? req.query.reviewId[0]
          : req.query.reviewId;
        const query = Array.isArray(req.query.query)
          ? req.query.query[0]
          : req.query.query;
        if (typeof reviewId !== "string" || typeof query !== "string") {
          return res.status(400).json({
            success: false,
            message: "reviewId and query are required.",
          });
        }
        const review = await loadPendingSeasonPlayerPoolReview({
          supabase: req.supabase,
          reviewId,
        });
        const candidates = await searchSeasonIdentityCandidates({
          supabase: req.supabase,
          query,
          reviewNhlPlayerId: review.nhlPlayerId,
        });
        return res.json({ success: true, review, candidates });
      }

      const legacyResolutionStatus = req.body?.resolutionStatus;
      const action =
        req.body?.action ??
        (legacyResolutionStatus === "mapped"
          ? "map_existing"
          : legacyResolutionStatus === "excluded"
            ? "exclude"
            : null);
      if (
        typeof req.body?.reviewId !== "string" ||
        !["map_existing", "create_new", "exclude"].includes(action) ||
        typeof req.body?.reason !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid player-pool resolution.",
        });
      }
      const lifecycleStatus = req.body?.lifecycleStatus ?? null;
      if (
        lifecycleStatus != null &&
        !SEASON_IDENTITY_LIFECYCLE_STATUSES.includes(
          lifecycleStatus as SeasonIdentityLifecycleStatus,
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid identity lifecycle.",
        });
      }
      const pendingReview = await loadPendingSeasonPlayerPoolReview({
        supabase: req.supabase,
        reviewId: req.body.reviewId,
      });
      const officialPlayer =
        action === "exclude"
          ? null
          : pendingReview.nhlPlayerId == null
            ? null
            : await fetchOfficialNhlPlayerEvidence(pendingReview.nhlPlayerId);
      const review = await persistSeasonIdentityResolution({
        supabase: req.supabase,
        editorUserId: req.editorUserId,
        reviewId: req.body.reviewId,
        action,
        fhfhPlayerId:
          req.body.fhfhPlayerId ?? req.body.mappedFhfhPlayerId ?? null,
        lifecycleStatus,
        reason: req.body.reason,
        officialPlayer,
      });
      return res.json({ success: true, review });
    } catch (error) {
      return res.status(error instanceof NhlApiHttpError ? 502 : 400).json({
        success: false,
        message: playerForecastErrorMessage(error),
      });
    }
  },
);
