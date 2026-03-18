/**
 * Update Rolling Player Averages Endpoint
 *
 * This endpoint calculates and updates rolling averages for player statistics.
 * It supports various query parameters to control the scope and behavior of the update.
 *
 * Query Parameters:
 * 
 * Scope & Filtering:
 * - playerId (number, optional): Specific player ID to process. If omitted, processes all players (subject to other filters).
 * - season (number, optional): Filter games by season ID (e.g., 20232024).
 * - startDate (string, optional): Filter games starting from this date (YYYY-MM-DD).
 * - endDate (string, optional): Filter games up to this date (YYYY-MM-DD).
 * - resumeFrom (number, optional): Resume processing from a specific player ID (exclusive). Useful for continuing interrupted batch jobs.
 *   Implicit auto-resume is intentionally disabled; broad runs process the full player set unless `resumeFrom` is provided explicitly.
 * - maxPlayers (number, optional): Cap the number of players processed in a single run. Useful for bounded serverless invocations.
 * 
 * Refresh Strategy:
 * - fullRefresh (boolean, optional): If true, clears existing data for the target scope and reprocesses everything. Defaults to false.
 * - fullRefreshMode (string, optional): Strategy for full refresh clear step.
 *   - "rpc_truncate" (default): DB-side RPC truncates table quickly. Best for complete wipes.
 *   - "overwrite_only": Skip pre-delete and rely on upsert overwrite. Good for targeted recalculation.
 *   - "delete": Legacy chunked delete by player_id range.
 * 
 * Performance Tuning:
 * - deleteChunkSize (number, optional): Batch size for deleting rows during a full refresh (legacy delete mode). Defaults to 50000.
 * - playerConcurrency (number, optional): Number of players to process in parallel. Defaults to 1 (4 in full refresh mode).
 * - upsertBatchSize (number, optional): Batch size for upserts into rolling_player_game_metrics. Defaults to 500 (800 in full refresh mode).
 * - upsertConcurrency (number, optional): Number of concurrent upsert requests per batch. Defaults to 1.
 * - skipDiagnostics (boolean, optional): If true, skips coverage/source-tracking/suspicious-output diagnostics to reduce log volume and CPU overhead.
 * - dryRunUpsert (boolean, optional): If true, derives rows and logs per-batch payload summaries without writing to Supabase.
 * - debugUpsertPayload (boolean, optional): If true, logs per-batch payload summaries and structured upsert failure details.
 * - fastMode (boolean, optional): Applies speed-oriented defaults when explicit tuning params are omitted:
 *   playerConcurrency=4, upsertConcurrency=4, skipDiagnostics=true.
 *
 * Example URLs:
 * - Process a single player: /api/v1/db/update-rolling-player-averages?playerId=8478402
 * - Process a specific season: /api/v1/db/update-rolling-player-averages?season=20232024
 * - Full refresh for all players: /api/v1/db/update-rolling-player-averages?fullRefresh=true
 * - Full refresh with concurrency limit: /api/v1/db/update-rolling-player-averages?fullRefresh=true&playerConcurrency=2&upsertBatchSize=1000
 * - Resume from a player ID: /api/v1/db/update-rolling-player-averages?resumeFrom=8477000
 * - Date range: /api/v1/db/update-rolling-player-averages?startDate=2023-10-01&endDate=2023-11-01
 * - Faster current-season sweep: /api/v1/db/update-rolling-player-averages?season=20252026&fastMode=true
 *
 * Notes:
 * - Do not combine `playerId` with `fullRefresh=true`; full refresh modes operate on the entire table.
 * - For targeted backfills or corrections, prefer `playerId`, `season`, or an explicit `resumeFrom` without `fullRefresh=true`.
 */
// /api/v1/db/update-rolling-player-averages

// 8473548

import {
  parseQueryBoolean,
  parseQueryNumber,
  parseQueryPositiveInt,
  parseQueryString
} from "lib/api/queryParams";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  inferRollingExecutionProfile,
  isRollingExecutionProfile,
  ROLLING_EXECUTION_PROFILE_BUDGETS_MS,
  ROLLING_EXECUTION_PROFILE_DEFAULTS,
  type RollingExecutionProfile
} from "lib/rollingPlayerOperationalPolicy";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseBody = {
  message: string;
  executionProfile?: RollingExecutionProfile;
  runtimeBudget?: {
    budgetMs: number;
    budgetLabel: string;
    durationMs: number;
    durationLabel: string;
    withinBudget: boolean;
  };
  appliedPlayerLimit?: number;
};

type FullRefreshMode = "rpc_truncate" | "overwrite_only" | "delete";
type EndpointPhase = "request" | "execute" | "response";

function logEndpointPhase(args: {
  phase: EndpointPhase;
  status: "start" | "complete" | "failed";
  durationMs?: number;
  details?: Record<string, unknown>;
}) {
  console.info(
    "[update-rolling-player-averages] phase",
    JSON.stringify({
      phase: args.phase,
      status: args.status,
      ...(typeof args.durationMs === "number"
        ? { durationMs: args.durationMs }
        : {}),
      ...(args.details ?? {})
    })
  );
}

function parseFullRefreshMode(
  param: string | string[] | undefined
): FullRefreshMode | undefined {
  const value = parseQueryString(param);
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (
    normalized === "rpc_truncate" ||
    normalized === "overwrite_only" ||
    normalized === "delete"
  ) {
    return normalized;
  }
  return undefined;
}

function parseExecutionProfile(
  param: string | string[] | undefined
) : RollingExecutionProfile | undefined {
  const value = parseQueryString(param);
  if (isRollingExecutionProfile(value)) return value;
  return undefined;
}

function formatDurationLabel(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function buildRuntimeBudgetSummary(
  executionProfile: RollingExecutionProfile,
  durationMs: number
) {
  const budgetMs = ROLLING_EXECUTION_PROFILE_BUDGETS_MS[executionProfile];
  return {
    budgetMs,
    budgetLabel: formatDurationLabel(budgetMs),
    durationMs,
    durationLabel: formatDurationLabel(durationMs),
    withinBudget: durationMs <= budgetMs
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  logEndpointPhase({
    phase: "request",
    status: "start",
    details: {
      method: req.method ?? null
    }
  });
  if (req.method === "HEAD") {
    res.setHeader("Allow", "GET, POST, HEAD");
    logEndpointPhase({
      phase: "response",
      status: "complete",
      details: {
        method: req.method ?? null,
        statusCode: 200
      }
    });
    res.status(200).json({ message: "Rolling player averages endpoint OK." });
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, HEAD");
    logEndpointPhase({
      phase: "response",
      status: "complete",
      details: {
        method: req.method ?? null,
        statusCode: 405
      }
    });
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const playerId = parseQueryNumber(req.query.playerId);
    const season = parseQueryNumber(req.query.season);
    const startDate = parseQueryString(req.query.startDate);
    const endDate = parseQueryString(req.query.endDate);
    const resumeFrom = parseQueryNumber(req.query.resumeFrom);
    const maxPlayers = parseQueryPositiveInt(req.query.maxPlayers);
    const fullRefresh = parseQueryBoolean(req.query.fullRefresh);
    const fullRefreshMode = parseFullRefreshMode(req.query.fullRefreshMode);
    const deleteChunkSize = parseQueryPositiveInt(req.query.deleteChunkSize);
    const playerConcurrency = parseQueryPositiveInt(req.query.playerConcurrency);
    const upsertBatchSize = parseQueryPositiveInt(req.query.upsertBatchSize);
    const upsertConcurrency = parseQueryPositiveInt(req.query.upsertConcurrency);
    const skipDiagnostics = parseQueryBoolean(req.query.skipDiagnostics);
    const dryRunUpsert = parseQueryBoolean(req.query.dryRunUpsert);
    const debugUpsertPayload = parseQueryBoolean(req.query.debugUpsertPayload);
    const fastMode = parseQueryBoolean(req.query.fastMode);
    const executionProfile =
      parseExecutionProfile(req.query.executionProfile) ??
      (playerId === undefined &&
      season === undefined &&
      startDate === undefined &&
      endDate === undefined &&
      !fullRefresh
        ? "daily_incremental"
        : fastMode
          ? inferRollingExecutionProfile({
              playerId,
              season,
              startDate,
              endDate,
              fullRefresh
            })
          : undefined);
    const profileDefaults = executionProfile
      ? ROLLING_EXECUTION_PROFILE_DEFAULTS[executionProfile]
      : undefined;

    const resolvedPlayerConcurrency =
      playerConcurrency ??
      profileDefaults?.playerConcurrency ??
      (fastMode ? 4 : undefined);
    const resolvedUpsertBatchSize =
      upsertBatchSize ?? profileDefaults?.upsertBatchSize;
    const resolvedUpsertConcurrency =
      upsertConcurrency ??
      profileDefaults?.upsertConcurrency ??
      (fastMode ? 4 : undefined);
    const resolvedSkipDiagnostics =
      skipDiagnostics ??
      profileDefaults?.skipDiagnostics ??
      (fastMode ? true : undefined);
    logEndpointPhase({
      phase: "request",
      status: "complete",
      details: {
        playerId,
        season,
        startDate,
        endDate,
        resumeFrom,
        maxPlayers,
        fullRefresh,
        fullRefreshMode,
        executionProfile,
        playerConcurrency: resolvedPlayerConcurrency,
        upsertBatchSize: resolvedUpsertBatchSize,
        upsertConcurrency: resolvedUpsertConcurrency,
        skipDiagnostics: resolvedSkipDiagnostics,
        dryRunUpsert,
        debugUpsertPayload,
        fastMode
      }
    });

    const { main } = await import(
      "lib/supabase/Upserts/fetchRollingPlayerAverages"
    );

    console.info(
      "[update-rolling-player-averages] Triggered",
      JSON.stringify({
        playerId,
        season,
        startDate,
        endDate,
        fullRefresh,
        fullRefreshMode,
        executionProfile,
        playerConcurrency: resolvedPlayerConcurrency,
        upsertBatchSize: resolvedUpsertBatchSize,
        upsertConcurrency: resolvedUpsertConcurrency,
        skipDiagnostics: resolvedSkipDiagnostics,
        dryRunUpsert,
        debugUpsertPayload,
        fastMode
      })
    );
    const timerLabel = `[update-rolling-player-averages] total ${Date.now()}`;
    console.time(timerLabel);
    const executeStartedAt = Date.now();
    logEndpointPhase({
      phase: "execute",
      status: "start",
      details: {
        playerId,
        season,
        fullRefresh,
        fastMode
      }
    });

    let runtimeBudget:
      | ResponseBody["runtimeBudget"]
      | undefined;
    try {
      await main({
        playerId,
        season,
        startDate,
        endDate,
        resumePlayerId: resumeFrom,
        maxPlayers,
        forceFullRefresh: fullRefresh,
        fullRefreshMode,
        fullRefreshDeleteChunkSize: deleteChunkSize,
        playerConcurrency: resolvedPlayerConcurrency,
        upsertBatchSize: resolvedUpsertBatchSize,
        upsertConcurrency: resolvedUpsertConcurrency,
        skipDiagnostics: resolvedSkipDiagnostics,
        dryRunUpsert,
        debugUpsertPayload
      });
      const executeDurationMs = Date.now() - executeStartedAt;
      runtimeBudget = executionProfile
        ? buildRuntimeBudgetSummary(executionProfile, executeDurationMs)
        : undefined;
      logEndpointPhase({
        phase: "execute",
        status: "complete",
        durationMs: executeDurationMs,
        details: {
          playerId,
          season,
          fullRefresh,
          executionProfile,
          fastMode,
          runtimeBudget
        }
      });
    } finally {
      console.timeEnd(timerLabel);
    }

    logEndpointPhase({
      phase: "response",
      status: "complete",
      details: {
        statusCode: 200
      }
    });
    res.status(200).json({
      message: "Rolling player averages processed successfully.",
      executionProfile,
      runtimeBudget,
      appliedPlayerLimit: maxPlayers
    });
  } catch (error: any) {
    logEndpointPhase({
      phase: "execute",
      status: "failed",
      details: {
        error: error?.message ?? String(error)
      }
    });
    console.error("Error updating rolling player averages:", error);
    logEndpointPhase({
      phase: "response",
      status: "complete",
      details: {
        statusCode: 500
      }
    });
    res.status(500).json({
      message:
        error?.message ?? "Unknown error updating rolling player averages."
    });
  }
}

export default withCronJobAudit(handler);
