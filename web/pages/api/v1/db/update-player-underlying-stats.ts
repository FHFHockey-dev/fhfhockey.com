import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import {
  PlayerStatsSummaryWriteBusyError,
  refreshPlayerUnderlyingSummarySnapshotsForGameIds,
} from "lib/underlying-stats/playerStatsSummaryRefresh";
import { resolvePlayerStatsIncrementalSelection } from "lib/underlying-stats/playerStatsRefreshWindow";
import { refreshTeamUnderlyingSummaryRowsForGameIds } from "lib/underlying-stats/teamStatsSummaryRefresh";
import { resolveRequestedGameIds } from "lib/supabase/Upserts/nhlRawGamecenterRoute";
import { ingestNhlApiRawGamesBestEffort } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";
import { summarizeNhlRawGamecenterIngestResults } from "lib/supabase/Upserts/nhlRawGamecenterTelemetry";
import serviceRoleClient from "lib/supabase/server";
import adminOnly from "utils/adminOnlyMiddleware";

type RawIngestOutcome = Awaited<ReturnType<typeof ingestNhlApiRawGamesBestEffort>>;
type RawIngestFailure = RawIngestOutcome["failures"][number];

type UnderlyingStatsStage = "selection" | "raw_ingest" | "player_summary_refresh" | "team_summary_refresh";
type UnderlyingStatsSqlState = "57014" | "55P03" | "40P01" | "40001";
type UnderlyingStatsFailure = {
  stage: UnderlyingStatsStage;
  classification: "statement_timeout" | "query_canceled" | "lock_timeout" |
    "lock_unavailable" | "deadlock" | "serialization_failure" | "unexpected_failure";
  sqlState: UnderlyingStatsSqlState | null;
  writes: "not_started" | "may_have_committed";
};

function describeStageFailure(stage: UnderlyingStatsStage, error: unknown): UnderlyingStatsFailure {
  const value = error !== null && typeof error === "object" ? error as Record<string, unknown> : null;
  const code = value?.code;
  const sqlState = code === "57014" || code === "55P03" || code === "40P01" || code === "40001" ? code : null;
  const message = typeof value?.message === "string" ? value.message : typeof error === "string" ? error : "";
  // A SQLSTATE can cover several causes. Infer timeout only from the canonical
  // server phrase, and never copy the provider message itself into the receipt.
  const classification = (code == null || sqlState === "57014") && /\bcanceling statement due to statement timeout\b/i.test(message) ? "statement_timeout"
    : (code == null || sqlState === "55P03") && /\bcanceling statement due to lock timeout\b/i.test(message) ? "lock_timeout"
    : sqlState === "57014" ? "query_canceled"
    : sqlState === "55P03" ? "lock_unavailable"
    : sqlState === "40P01" ? "deadlock"
    : sqlState === "40001" ? "serialization_failure"
    : "unexpected_failure";
  // Selection is read-only. Once raw ingest starts, a thrown call or later
  // failure cannot establish that this invocation or earlier batches wrote zero.
  return { stage, classification, sqlState, writes: stage === "selection" ? "not_started" : "may_have_committed" };
}

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
      failures?: RawIngestFailure[];
      requestedGameCount: number;
      gameIds: number[];
      rawRowsUpserted: number;
      summaryRowsUpserted: number;
      teamSummaryRowsUpserted: number;
      summaryWriteBusyRetries?: number;
      rowsUpserted: number;
      warmedLandingCache: boolean;
      results: Array<{
        rosterCount: number;
        eventCount: number;
        shiftCount: number;
        rawEndpointsStored: number;
        idempotent: boolean;
      }>;
      message: string;
    }
  | {
      success: false;
      error: string;
      issues?: string[];
      failures?: RawIngestFailure[];
      stageFailure?: UnderlyingStatsFailure;
      summaryFailure?: {
        code: string;
        stage: string;
        endpoint: string;
        gameIds: number[];
        attempts: number;
      };
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

  let stage: UnderlyingStatsStage = "selection";
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
        teamSummaryRowsUpserted: 0,
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
      idempotent: boolean;
    }> = [];
    const failures: RawIngestFailure[] = [];
    const processedGameIds: number[] = [];
    let rawRowsUpserted = 0;
    let summaryRowsUpserted = 0;
    let teamSummaryRowsUpserted = 0;
    let summaryWriteBusyRetries = 0;

    for (let batchIndex = 0; batchIndex < gameIdBatches.length; batchIndex += 1) {
      const batchGameIds = gameIdBatches[batchIndex] ?? [];
      stage = "raw_ingest";
      const rawIngest = await ingestNhlApiRawGamesBestEffort(serviceRoleClient, batchGameIds);
      const rawResults = rawIngest.results;
      aggregatedResults.push(...rawResults);
      rawRowsUpserted +=
        summarizeNhlRawGamecenterIngestResults(rawResults).rowsUpserted;
      failures.push(...rawIngest.failures);

      const successfulGameIds = rawResults
        .map((result) => Number(result.gameId))
        .filter((gameId) => Number.isFinite(gameId));
      processedGameIds.push(...successfulGameIds);

      if (successfulGameIds.length === 0) {
        continue;
      }

      const shouldWarmBatchCache =
        shouldWarmLandingCache &&
        batchIndex === gameIdBatches.length - 1 &&
        failures.length === 0;
      stage = "player_summary_refresh";
      const summaryRefresh = await refreshPlayerUnderlyingSummarySnapshotsForGameIds({
        gameIds: successfulGameIds,
        seasonId: selection.seasonId,
        requestedGameType,
        shouldWarmLandingCache: shouldWarmBatchCache,
        shouldMigrateLegacySummaries: false,
        supabase: serviceRoleClient,
      });

      summaryRowsUpserted += summaryRefresh.rowsUpserted;
      summaryWriteBusyRetries += summaryRefresh.summaryWriteBusyRetries ?? 0;

      // Team Explorer summaries are built from the same native inputs; no
      // other scheduled job writes them.
      stage = "team_summary_refresh";
      const teamSummaryRefresh = await refreshTeamUnderlyingSummaryRowsForGameIds({
        gameIds: successfulGameIds,
        seasonId: selection.seasonId,
        requestedGameType,
        shouldWarmLandingCache: shouldWarmBatchCache,
        supabase: serviceRoleClient,
      });

      teamSummaryRowsUpserted += teamSummaryRefresh.rowsUpserted;
    }

    if (processedGameIds.length === 0 && failures.length > 0) {
      return res.status(502).json({
        success: false,
        error: "Player underlying stats ingest failed for every requested game.",
        issues: failures.map((failure) => `${failure.gameId}: ${failure.message}`),
        failures,
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
      teamSummaryRowsUpserted,
      ...(summaryWriteBusyRetries > 0 ? { summaryWriteBusyRetries } : {}),
      rowsUpserted: rawRowsUpserted + summaryRowsUpserted + teamSummaryRowsUpserted,
      warmedLandingCache: shouldWarmLandingCache && failures.length === 0,
      results: aggregatedResults,
      message:
        failures.length === 0
          ? "Player underlying stats ingest completed. Raw NHL gamecenter payloads were refreshed first, then per-game player and team underlying summaries were rebuilt."
          : "Player underlying stats ingest completed with partial failures. Successful games were refreshed and summarized; failed games can be retried with the same URL.",
    });
  } catch (error) {
    if (error instanceof PlayerStatsSummaryWriteBusyError) {
      return res.status(500).json({
        success: false,
        error: error.message,
        issues: [error.message],
        summaryFailure: {
          code: error.code,
          stage: error.stage,
          endpoint: error.endpoint,
          gameIds: error.gameIds,
          attempts: error.attempts,
        },
      });
    }
    const stageFailure = describeStageFailure(stage, error);
    const sqlStateSuffix = stageFailure.sqlState ? `; SQLSTATE ${stageFailure.sqlState}` : "";
    const writeContext = stageFailure.writes === "not_started"
      ? "Writes were not started." : "Writes may have committed; verify before retry.";
    const message = `Underlying stats ${stageFailure.stage} failed (${stageFailure.classification}${sqlStateSuffix}). ${writeContext}`;

    return res.status(500).json({
      success: false,
      error: message,
      issues: [message],
      stageFailure,
    });
  }
}

export default adminOnly(withCronJobAudit(withNhlOffSeasonSkip(handler), {
  jobName: "/api/v1/db/update-player-underlying-stats",
}));
