import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  refreshPlayerUnderlyingSummarySnapshotsForGameIds,
} from "lib/underlying-stats/playerStatsSummaryRefresh";
import { resolvePlayerStatsIncrementalSelection } from "lib/underlying-stats/playerStatsRefreshWindow";
import { resolveRequestedGameIds } from "lib/supabase/Upserts/nhlRawGamecenterRoute";
import { ingestNhlApiRawGamesBestEffort } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";
import serviceRoleClient from "lib/supabase/server";
import adminOnly from "utils/adminOnlyMiddleware";

type UpdatePlayerUnderlyingStatsResponse =
  | {
      success: true;
      route: string;
      mode: "game" | "date_range" | "backfill_batch" | "incremental";
      seasonId: number;
      startDate?: string | null;
      endDate?: string | null;
      latestCoveredDate?: string | null;
      catchUpCompleted?: boolean;
      batchSize?: number;
      batchesProcessed?: number;
      processedGameCount?: number;
      failedGameCount?: number;
      failedGameIds?: number[];
      failures?: Array<{ gameId: number; message: string }>;
      requestedGameCount: number;
      gameIds: number[];
      rawRowsUpserted: number;
      summaryRowsUpserted: number;
      rowsUpserted: number;
      warmedLandingCache: boolean;
      results: Array<{
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
    };

type QueryValue = string | string[] | undefined;

function getSingleQueryValue(value: QueryValue): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function isTruthyQueryFlag(value: QueryValue): boolean {
  const normalized = getSingleQueryValue(value)?.toLowerCase();
  return normalized != null && ["1", "true", "yes", "y", "all", "full"].includes(normalized);
}

function parsePositiveInteger(value: QueryValue): number | null {
  const normalized = getSingleQueryValue(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function chunkGameIds(gameIds: readonly number[], batchSize: number) {
  const normalizedBatchSize = Math.max(1, batchSize);
  const chunks: number[][] = [];

  for (let index = 0; index < gameIds.length; index += normalizedBatchSize) {
    chunks.push(gameIds.slice(index, index + normalizedBatchSize));
  }

  return chunks;
}

function inferRequestedGameType(args: {
  explicitGameType: QueryValue;
  gameIds: readonly number[];
}) {
  const explicit = Number(getSingleQueryValue(args.explicitGameType));
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.trunc(explicit);
  }

  const inferredGameTypes = new Set(
    args.gameIds
      .map((gameId) => String(gameId).slice(4, 6))
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
  );

  if (inferredGameTypes.size !== 1) {
    return null;
  }

  return [...inferredGameTypes][0] ?? null;
}

function sumRowsAffected(results: Array<{
  rosterCount: number;
  eventCount: number;
  shiftCount: number;
  rawEndpointsStored: number;
}>) {
  return results.reduce(
    (total, result) =>
      total +
      result.rosterCount +
      result.eventCount +
      result.shiftCount +
      result.rawEndpointsStored,
    0
  );
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdatePlayerUnderlyingStatsResponse>
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const incrementalSelectionRequested = isTruthyQueryFlag(req.query.incremental);
    const catchUpRequested =
      incrementalSelectionRequested && isTruthyQueryFlag(req.query.catchUp);
    const batchSize = parsePositiveInteger(req.query.batchSize) ?? 5;
    const selection = incrementalSelectionRequested
      ? await resolvePlayerStatsIncrementalSelection({
          seasonId: parsePositiveInteger(req.query.seasonId),
          requestedGameType: parsePositiveInteger(req.query.gameType),
          supabase: serviceRoleClient,
        })
      : await resolveRequestedGameIds(req.query, serviceRoleClient);
    const shouldWarmLandingCache =
      isTruthyQueryFlag(req.query.warmLandingCache) || selection.mode === "game";
    const requestedGameType =
      selection.mode === "incremental"
        ? selection.requestedGameType
        : inferRequestedGameType({
            explicitGameType: req.query.gameType,
            gameIds: selection.gameIds,
          });

    if (selection.gameIds.length === 0) {
      return res.status(200).json({
        success: true,
        route: "/api/v1/db/update-player-underlying-stats",
        mode: selection.mode,
        seasonId: selection.seasonId,
        ...(selection.mode === "incremental"
          ? {
              startDate: selection.startDate,
              endDate: selection.endDate,
              latestCoveredDate: selection.latestCoveredDate,
            }
          : {}),
        ...(catchUpRequested
          ? {
              catchUpCompleted: true,
              batchSize,
              batchesProcessed: 0,
            }
          : {}),
        requestedGameCount: 0,
        gameIds: [],
        rawRowsUpserted: 0,
        summaryRowsUpserted: 0,
        rowsUpserted: 0,
        warmedLandingCache: false,
        results: [],
        message: "No matching games found for the requested selection.",
      });
    }

    const gameIdBatches = catchUpRequested
      ? chunkGameIds(selection.gameIds, batchSize)
      : [selection.gameIds];
    const aggregatedResults: Array<{
      gameId?: number;
      rosterCount: number;
      eventCount: number;
      shiftCount: number;
      rawEndpointsStored: number;
    }> = [];
    const failures: Array<{ gameId: number; message: string }> = [];
    const processedGameIds: number[] = [];
    let rawRowsUpserted = 0;
    let summaryRowsUpserted = 0;

    for (let batchIndex = 0; batchIndex < gameIdBatches.length; batchIndex += 1) {
      const batchGameIds = gameIdBatches[batchIndex] ?? [];
      const rawIngest = await ingestNhlApiRawGamesBestEffort(serviceRoleClient, batchGameIds);
      const rawResults = rawIngest.results;
      aggregatedResults.push(...rawResults);
      rawRowsUpserted += sumRowsAffected(rawResults);
      failures.push(...rawIngest.failures);

      const successfulGameIds = rawResults
        .map((result) => Number(result.gameId))
        .filter((gameId) => Number.isFinite(gameId));
      processedGameIds.push(...successfulGameIds);

      if (successfulGameIds.length === 0) {
        continue;
      }

      const summaryRefresh = await refreshPlayerUnderlyingSummarySnapshotsForGameIds({
        gameIds: successfulGameIds,
        seasonId: selection.seasonId,
        requestedGameType,
        shouldWarmLandingCache:
          shouldWarmLandingCache &&
          batchIndex === gameIdBatches.length - 1 &&
          failures.length === 0,
        shouldMigrateLegacySummaries: false,
        supabase: serviceRoleClient,
      });

      summaryRowsUpserted += summaryRefresh.rowsUpserted;
    }

    if (processedGameIds.length === 0 && failures.length > 0) {
      return res.status(502).json({
        success: false,
        error: "Player underlying stats ingest failed for every requested game.",
        issues: failures.map((failure) => `${failure.gameId}: ${failure.message}`),
      });
    }

    return res.status(200).json({
      success: true,
      route: "/api/v1/db/update-player-underlying-stats",
      mode: selection.mode,
      seasonId: selection.seasonId,
      ...(selection.mode === "incremental"
        ? {
            startDate: selection.startDate,
            endDate: selection.endDate,
            latestCoveredDate: selection.latestCoveredDate,
          }
        : {}),
      ...(catchUpRequested
        ? {
            catchUpCompleted: failures.length === 0,
            batchSize,
            batchesProcessed: gameIdBatches.length,
          }
        : {}),
      processedGameCount: processedGameIds.length,
      failedGameCount: failures.length,
      ...(failures.length > 0
        ? {
            failedGameIds: failures.map((failure) => failure.gameId),
            failures,
          }
        : {}),
      requestedGameCount: selection.gameIds.length,
      gameIds: selection.gameIds,
      rawRowsUpserted,
      summaryRowsUpserted,
      rowsUpserted: rawRowsUpserted + summaryRowsUpserted,
      warmedLandingCache: shouldWarmLandingCache && failures.length === 0,
      results: aggregatedResults,
      message:
        failures.length === 0
          ? "Player underlying stats ingest completed. Raw NHL gamecenter payloads were refreshed first, then per-game player underlying summaries were rebuilt."
          : "Player underlying stats ingest completed with partial failures. Successful games were refreshed and summarized; failed games can be retried with the same URL.",
    });
  } catch (error) {
    const message = (() => {
      if (error instanceof Error) {
        return error.message;
      }

      if (error && typeof error === "object") {
        try {
          return JSON.stringify(error);
        } catch {}
      }

      if (typeof error === "string") {
        return error;
      }

      return "Unable to update player underlying stats.";
    })();

    return res.status(500).json({
      success: false,
      error: message,
      issues: [message],
    });
  }
}

export default withCronJobAudit(adminOnly(handler), {
  jobName: "/api/v1/db/update-player-underlying-stats",
});
