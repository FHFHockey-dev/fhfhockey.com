import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  chunkGameIds,
  parsePositiveInteger,
  runRawIngestAndRefreshBatches,
} from "lib/underlying-stats/adminRouteHelpers";
import { resolveTeamStatsIncrementalSelection } from "lib/underlying-stats/teamStatsRefreshWindow";
import { refreshTeamUnderlyingSummaryRowsForGameIds } from "lib/underlying-stats/teamStatsSummaryRefresh";
import adminOnly from "utils/adminOnlyMiddleware";

type CatchUpResponse =
  | {
      success: true;
      route: string;
      mode: "incremental";
      seasonId: number;
      startDate: string | null;
      endDate: string | null;
      latestCoveredDate: string | null;
      requestedGameCount: number;
      processedGameCount: number;
      failedGameCount: number;
      failedGameIds?: number[];
      failures?: Array<{ gameId: number; message: string }>;
      batchSize: number;
      batchesProcessed: number;
      rawRowsUpserted: number;
      summaryRowsUpserted: number;
      rowsUpserted: number;
      warmedLandingCache: boolean;
      results: Array<{
        gameId?: number;
        rosterCount: number;
        eventCount: number;
        shiftCount: number;
        rawEndpointsStored: number;
      }>;
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

async function handler(req: NextApiRequest, res: NextApiResponse<CatchUpResponse>) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  let stage = "parse-request";

  try {
    const batchSize = parsePositiveInteger(req.query.batchSize) ?? 5;
    stage = "resolve-incremental-selection";
    const selection = await resolveTeamStatsIncrementalSelection({
      seasonId: parsePositiveInteger(req.query.seasonId),
      requestedGameType: parsePositiveInteger(req.query.gameType),
    });

    console.info("[catch-up-team-underlying] selection", {
      seasonId: selection.seasonId,
      requestedGameType: selection.requestedGameType,
      latestCoveredDate: selection.latestCoveredDate,
      startDate: selection.startDate,
      endDate: selection.endDate,
      requestedGameCount: selection.gameIds.length,
      batchSize,
    });

    if (selection.gameIds.length === 0) {
      return res.status(200).json({
        success: true,
        route: "/api/v1/db/catch-up-team-underlying",
        mode: "incremental",
        seasonId: selection.seasonId,
        startDate: selection.startDate,
        endDate: selection.endDate,
        latestCoveredDate: selection.latestCoveredDate,
        requestedGameCount: 0,
        processedGameCount: 0,
        failedGameCount: 0,
        batchSize,
        batchesProcessed: 0,
        rawRowsUpserted: 0,
        summaryRowsUpserted: 0,
        rowsUpserted: 0,
        warmedLandingCache: false,
        results: [],
        message: "Team underlying catch-up is already current for the selected season.",
      });
    }

    const gameIdBatches = chunkGameIds(selection.gameIds, batchSize);
    stage = "run-raw-ingest-and-summary-refresh";
    const batchResult = await runRawIngestAndRefreshBatches({
      gameIdBatches,
      seasonId: selection.seasonId,
      requestedGameType: selection.requestedGameType,
      shouldWarmLandingCache: true,
      refreshSummaries: async (args) =>
        refreshTeamUnderlyingSummaryRowsForGameIds({
          gameIds: args.gameIds,
          seasonId: args.seasonId,
          requestedGameType: args.requestedGameType,
          shouldWarmLandingCache: args.shouldWarmLandingCache,
        }),
    });

    console.info("[catch-up-team-underlying] complete", {
      seasonId: selection.seasonId,
      requestedGameCount: selection.gameIds.length,
      processedGameCount: batchResult.processedGameIds.length,
      failedGameCount: batchResult.failures.length,
      rawRowsUpserted: batchResult.rawRowsUpserted,
      summaryRowsUpserted: batchResult.summaryRowsUpserted,
    });

    if (batchResult.processedGameIds.length === 0 && batchResult.failures.length > 0) {
      return res.status(502).json({
        success: false,
        error: "Team underlying catch-up failed for every requested game.",
        issues: batchResult.failures.map((failure) => `${failure.gameId}: ${failure.message}`),
      });
    }

    return res.status(200).json({
      success: true,
      route: "/api/v1/db/catch-up-team-underlying",
      mode: "incremental",
      seasonId: selection.seasonId,
      startDate: selection.startDate,
      endDate: selection.endDate,
      latestCoveredDate: selection.latestCoveredDate,
      requestedGameCount: selection.gameIds.length,
      processedGameCount: batchResult.processedGameIds.length,
      failedGameCount: batchResult.failures.length,
      ...(batchResult.failures.length > 0
        ? {
            failedGameIds: batchResult.failures.map((failure) => failure.gameId),
            failures: batchResult.failures,
          }
        : {}),
      batchSize,
      batchesProcessed: gameIdBatches.length,
      rawRowsUpserted: batchResult.rawRowsUpserted,
      summaryRowsUpserted: batchResult.summaryRowsUpserted,
      rowsUpserted: batchResult.rawRowsUpserted + batchResult.summaryRowsUpserted,
      warmedLandingCache: batchResult.failures.length === 0,
      results: batchResult.aggregatedResults,
      message:
        batchResult.failures.length === 0
          ? "Team underlying catch-up completed through the latest finished games."
          : "Team underlying catch-up completed with partial failures.",
    });
  } catch (error) {
    const { message, stack } = formatUnknownError(error);
    const failureStage = typeof stage === "string" ? stage : "unknown";

    console.error("[catch-up-team-underlying] failed", {
      stage: failureStage,
      query: req.query,
      error: message,
      stack,
    });

    return res.status(500).json({
      success: false,
      error: `Team underlying catch-up failed during ${failureStage}: ${message}`,
      issues: [`stage=${failureStage}`, message],
      stage: failureStage,
    });
  }
}

export default withCronJobAudit(adminOnly(handler), {
  jobName: "/api/v1/db/catch-up-team-underlying",
});