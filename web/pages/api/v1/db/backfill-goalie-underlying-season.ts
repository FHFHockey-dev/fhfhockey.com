import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  chunkGameIds,
  parsePositiveInteger,
  runRawIngestAndRefreshBatches,
  selectMissingGoalieSummaryGameIds,
} from "lib/underlying-stats/adminRouteHelpers";
import {
  refreshGoalieUnderlyingSummarySnapshotsForGameIds,
  warmGoalieStatsLandingSeasonAggregateCache,
} from "lib/underlying-stats/goalieStatsSummaryRefresh";
import { resolveRequestedGameIds } from "lib/supabase/Upserts/nhlRawGamecenterRoute";
import serviceRoleClient from "lib/supabase/server";
import adminOnly from "utils/adminOnlyMiddleware";

type SeasonBackfillResponse =
  | {
      success: true;
      route: string;
      seasonId: number;
      requestedGameType: number;
      rawBackfillBatchesProcessed: number;
      summaryBackfillBatchesProcessed: number;
      processedGameCount: number;
      failedGameCount: number;
      failedGameIds?: number[];
      failures?: Array<{ gameId: number; message: string }>;
      rawRowsUpserted: number;
      summaryRowsUpserted: number;
      rowsUpserted: number;
      warmedLandingCache: boolean;
      message: string;
    }
  | {
      success: false;
      error: string;
      issues?: string[];
      stage?: string;
    };

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  try {
    return {
      message: JSON.stringify(error),
      stack: undefined,
    };
  } catch {
    return {
      message: String(error),
      stack: undefined,
    };
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse<SeasonBackfillResponse>) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  let stage = "parse-request";

  try {
    const seasonId = parsePositiveInteger(req.query.seasonId);
    if (seasonId == null) {
      return res.status(400).json({
        success: false,
        error: "seasonId is required.",
        issues: ["seasonId is required."],
      });
    }

    const requestedGameType = parsePositiveInteger(req.query.gameType) ?? 2;
    const batchSize = parsePositiveInteger(req.query.batchSize) ?? 5;
    const rawSelectionLimit = parsePositiveInteger(req.query.limit) ?? 25;
    const summaryLimit = parsePositiveInteger(req.query.summaryLimit) ?? 25;
    let rawBackfillBatchesProcessed = 0;
    let summaryBackfillBatchesProcessed = 0;
    let processedGameCount = 0;
    let rawRowsUpserted = 0;
    let summaryRowsUpserted = 0;
    const failures: Array<{ gameId: number; message: string }> = [];

    console.info("[backfill-goalie-underlying-season] start", {
      seasonId,
      requestedGameType,
      batchSize,
      rawSelectionLimit,
      summaryLimit,
    });

    for (;;) {
      stage = "resolve-raw-backfill-selection";
      const selection = await resolveRequestedGameIds(
        {
          backfill: "true",
          seasonId: String(seasonId),
          gameType: String(requestedGameType),
          limit: String(rawSelectionLimit),
        },
        serviceRoleClient
      );

      if (selection.gameIds.length === 0) {
        break;
      }

      console.info("[backfill-goalie-underlying-season] raw-backfill-batch", {
        rawBackfillBatchNumber: rawBackfillBatchesProcessed + 1,
        selectedGameCount: selection.gameIds.length,
        firstGameId: selection.gameIds[0] ?? null,
        lastGameId: selection.gameIds[selection.gameIds.length - 1] ?? null,
      });

      rawBackfillBatchesProcessed += 1;
      stage = "run-raw-ingest-and-summary-refresh";
      const batchResult = await runRawIngestAndRefreshBatches({
        gameIdBatches: chunkGameIds(selection.gameIds, batchSize),
        seasonId,
        requestedGameType,
        shouldWarmLandingCache: false,
        refreshSummaries: async (args) =>
          refreshGoalieUnderlyingSummarySnapshotsForGameIds({
            gameIds: args.gameIds,
            seasonId: args.seasonId,
            requestedGameType: args.requestedGameType,
            shouldWarmLandingCache: false,
            preferSharedSnapshotSeed: false,
          }),
      });

      processedGameCount += batchResult.processedGameIds.length;
      rawRowsUpserted += batchResult.rawRowsUpserted;
      summaryRowsUpserted += batchResult.summaryRowsUpserted;
      failures.push(...batchResult.failures);

      console.info("[backfill-goalie-underlying-season] raw-backfill-batch-complete", {
        rawBackfillBatchesProcessed,
        processedGameCount,
        failedGameCount: failures.length,
        rawRowsUpserted,
        summaryRowsUpserted,
      });

      if (batchResult.processedGameIds.length === 0 && batchResult.failures.length > 0) {
        break;
      }
    }

    for (;;) {
      stage = "resolve-missing-summary-game-ids";
      const gameIds = await selectMissingGoalieSummaryGameIds({
        seasonId,
        requestedGameType,
        limit: summaryLimit,
        supabase: serviceRoleClient,
      });

      if (gameIds.length === 0) {
        break;
      }

      summaryBackfillBatchesProcessed += 1;
      console.info("[backfill-goalie-underlying-season] summary-backfill-batch", {
        summaryBackfillBatchesProcessed,
        selectedGameCount: gameIds.length,
        firstGameId: gameIds[0] ?? null,
        lastGameId: gameIds[gameIds.length - 1] ?? null,
      });

      stage = "refresh-summary-only-backfill";
      const summaryRefresh = await refreshGoalieUnderlyingSummarySnapshotsForGameIds({
        gameIds,
        seasonId,
        requestedGameType,
        shouldWarmLandingCache: false,
        preferSharedSnapshotSeed: true,
        supabase: serviceRoleClient,
      });

      summaryRowsUpserted += summaryRefresh.rowsUpserted;

      console.info("[backfill-goalie-underlying-season] summary-backfill-batch-complete", {
        summaryBackfillBatchesProcessed,
        summaryRowsUpserted,
      });

      if (summaryRefresh.rowsUpserted === 0) {
        break;
      }
    }

    stage = "warm-landing-cache";
    await warmGoalieStatsLandingSeasonAggregateCache({
      seasonId,
      gameType: requestedGameType,
      supabase: serviceRoleClient,
    });

    console.info("[backfill-goalie-underlying-season] complete", {
      seasonId,
      requestedGameType,
      rawBackfillBatchesProcessed,
      summaryBackfillBatchesProcessed,
      processedGameCount,
      failedGameCount: failures.length,
      rawRowsUpserted,
      summaryRowsUpserted,
    });

    return res.status(200).json({
      success: true,
      route: "/api/v1/db/backfill-goalie-underlying-season",
      seasonId,
      requestedGameType,
      rawBackfillBatchesProcessed,
      summaryBackfillBatchesProcessed,
      processedGameCount,
      failedGameCount: failures.length,
      ...(failures.length > 0
        ? {
            failedGameIds: failures.map((failure) => failure.gameId),
            failures,
          }
        : {}),
      rawRowsUpserted,
      summaryRowsUpserted,
      rowsUpserted: rawRowsUpserted + summaryRowsUpserted,
      warmedLandingCache: true,
      message:
        failures.length === 0
          ? "Goalie underlying season backfill completed."
          : "Goalie underlying season backfill completed with partial failures.",
    });
  } catch (error) {
    const { message, stack } = formatUnknownError(error);
    const failureStage = typeof stage === "string" ? stage : "unknown";
    console.error("[backfill-goalie-underlying-season] failed", {
      stage: failureStage,
      query: req.query,
      error: message,
      stack,
    });
    return res.status(500).json({
      success: false,
      error: `Goalie underlying season backfill failed during ${failureStage}: ${message}`,
      issues: [
        `stage=${failureStage}`,
        message,
      ],
      stage: failureStage,
    });
  }
}

export default withCronJobAudit(adminOnly(handler), {
  jobName: "/api/v1/db/backfill-goalie-underlying-season",
});