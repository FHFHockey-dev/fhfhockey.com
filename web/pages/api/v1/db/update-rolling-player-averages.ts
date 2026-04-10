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
 * - A bare GET/POST call with no scope params uses the `daily_incremental` profile plus an implicit recent lookback window for maintenance convenience; that default is not a one-day smoke test.
 * - For a true one-day operational probe, pass explicit `startDate` and `endDate` with the same YYYY-MM-DD value.
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
import { getRollingForgeStageDependencyContract } from "lib/rollingForgePipeline";
import type { RollingPlayerRunSummary } from "lib/supabase/Upserts/fetchRollingPlayerAverages";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseBody = {
  message: string;
  success?: boolean;
  operationStatus?: "success" | "warning" | "blocked";
  warning?: string | null;
  executionProfile?: RollingExecutionProfile;
  executionScope?: {
    startDate: string | null;
    endDate: string | null;
    implicitDailyWindowApplied: boolean;
    windowDays: number | null;
    smokeTestComparable: boolean;
    smokeTestGuidance: string | null;
  };
  runtimeBudget?: {
    budgetMs: number;
    budgetLabel: string;
    durationMs: number;
    durationLabel: string;
    withinBudget: boolean;
  };
  appliedPlayerLimit?: number;
  dependencyContract?: ReturnType<typeof getRollingForgeStageDependencyContract>;
  runSummary?: RollingPlayerRunSummary;
  freshnessGate?: {
    status: "PASS" | "FAIL";
    blockerCount: number;
    bypassed: boolean;
    action: string;
  };
};

type FullRefreshMode = "rpc_truncate" | "overwrite_only" | "delete";
type EndpointPhase = "request" | "execute" | "response";
const DEFAULT_INCREMENTAL_LOOKBACK_DAYS = 14;

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

function getRequestParam(
  req: NextApiRequest,
  key: string
): string | string[] | undefined {
  const queryValue = req.query[key];
  if (queryValue !== undefined) {
    return queryValue;
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];
  if (typeof value === "string") return value;
  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  ) {
    return value as string[];
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveImplicitDailyWindow(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - DEFAULT_INCREMENTAL_LOOKBACK_DAYS);
  return {
    startDate: isoDateOnly(start),
    endDate: isoDateOnly(end)
  };
}

function formatDurationLabel(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function computeInclusiveWindowDays(
  startDate: string | undefined,
  endDate: string | undefined
): number | null {
  if (!startDate || !endDate) return null;
  const startMs = Date.parse(`${startDate}T00:00:00.000Z`);
  const endMs = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

function buildExecutionScopeSummary(args: {
  startDate: string | undefined;
  endDate: string | undefined;
  implicitDailyWindowApplied: boolean;
}) {
  const windowDays = computeInclusiveWindowDays(args.startDate, args.endDate);
  const smokeTestComparable = windowDays === 1;
  return {
    startDate: args.startDate ?? null,
    endDate: args.endDate ?? null,
    implicitDailyWindowApplied: args.implicitDailyWindowApplied,
    windowDays,
    smokeTestComparable,
    smokeTestGuidance: smokeTestComparable
      ? null
      : "This run is not a one-day smoke test. Use explicit startDate=endDate for a true one-day operational probe."
  };
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
  const dependencyContract = getRollingForgeStageDependencyContract(
    "rolling_player_recompute"
  );
  let runSummary: RollingPlayerRunSummary | undefined;
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
    const playerId = parseQueryNumber(getRequestParam(req, "playerId"));
    const season = parseQueryNumber(getRequestParam(req, "season"));
    const requestedStartDate = parseQueryString(getRequestParam(req, "startDate"));
    const requestedEndDate = parseQueryString(getRequestParam(req, "endDate"));
    const resumeFrom = parseQueryNumber(getRequestParam(req, "resumeFrom"));
    const maxPlayers = parseQueryPositiveInt(getRequestParam(req, "maxPlayers"));
    const fullRefresh = parseQueryBoolean(getRequestParam(req, "fullRefresh"));
    const fullRefreshMode = parseFullRefreshMode(getRequestParam(req, "fullRefreshMode"));
    const deleteChunkSize = parseQueryPositiveInt(getRequestParam(req, "deleteChunkSize"));
    const playerConcurrency = parseQueryPositiveInt(getRequestParam(req, "playerConcurrency"));
    const upsertBatchSize = parseQueryPositiveInt(getRequestParam(req, "upsertBatchSize"));
    const upsertConcurrency = parseQueryPositiveInt(getRequestParam(req, "upsertConcurrency"));
    const skipDiagnostics = parseQueryBoolean(getRequestParam(req, "skipDiagnostics"));
    const dryRunUpsert = parseQueryBoolean(getRequestParam(req, "dryRunUpsert"));
    const debugUpsertPayload = parseQueryBoolean(getRequestParam(req, "debugUpsertPayload"));
    const fastMode = parseQueryBoolean(getRequestParam(req, "fastMode"));
    const bypassFreshnessBlockers = parseQueryBoolean(
      getRequestParam(req, "bypassFreshnessBlockers")
    );
    const explicitExecutionProfile = parseExecutionProfile(
      getRequestParam(req, "executionProfile")
    );
    const shouldApplyImplicitDailyWindow =
      playerId === undefined &&
      season === undefined &&
      requestedStartDate === undefined &&
      requestedEndDate === undefined &&
      resumeFrom === undefined &&
      !fullRefresh &&
      explicitExecutionProfile == null;
    const implicitDailyWindow = shouldApplyImplicitDailyWindow
      ? resolveImplicitDailyWindow()
      : null;
    const startDate = requestedStartDate ?? implicitDailyWindow?.startDate;
    const endDate = requestedEndDate ?? implicitDailyWindow?.endDate;
    const executionProfile =
      explicitExecutionProfile ??
      (playerId === undefined &&
      season === undefined &&
      requestedStartDate === undefined &&
      requestedEndDate === undefined &&
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
    const allowImplicitDailyFreshnessWarning =
      implicitDailyWindow != null &&
      executionProfile === "daily_incremental" &&
      !bypassFreshnessBlockers;
    const profileDefaults = executionProfile
      ? ROLLING_EXECUTION_PROFILE_DEFAULTS[executionProfile]
      : undefined;
    const executionScope = buildExecutionScopeSummary({
      startDate,
      endDate,
      implicitDailyWindowApplied: implicitDailyWindow != null
    });

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
        implicitDailyWindowApplied: implicitDailyWindow != null,
        implicitDailyWindow,
        executionScope,
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
        implicitDailyWindowApplied: implicitDailyWindow != null,
        implicitDailyWindow,
        executionScope,
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
      runSummary = await main({
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
        statusCode:
          (runSummary?.freshnessBlockers ?? 0) > 0 &&
          !bypassFreshnessBlockers &&
          !allowImplicitDailyFreshnessWarning
            ? 422
            : 200,
        freshnessBlockers: runSummary?.freshnessBlockers ?? 0,
        bypassFreshnessBlockers: bypassFreshnessBlockers ?? false
      }
    });
    if ((runSummary?.freshnessBlockers ?? 0) > 0 && !bypassFreshnessBlockers) {
      if (allowImplicitDailyFreshnessWarning) {
        console.warn(
          "[update-rolling-player-averages] freshness blockers tolerated for implicit daily window",
          JSON.stringify({
            blockerCount: runSummary?.freshnessBlockers ?? 0,
            executionProfile: executionProfile ?? "daily_incremental",
            executionScope
          })
        );
      } else {
        return res.status(422).json({
          message:
            "Freshness dependency checks failed. Refresh stale upstream sources or use bypassFreshnessBlockers=true to override.",
          success: false,
          operationStatus: "blocked",
          warning:
            "Rolling player averages were blocked because required upstream freshness checks failed.",
          executionProfile,
          executionScope,
          runtimeBudget,
          appliedPlayerLimit: maxPlayers,
          dependencyContract,
          runSummary,
          freshnessGate: {
            status: "FAIL",
            blockerCount: runSummary?.freshnessBlockers ?? 0,
            bypassed: false,
            action:
              "Refresh stale upstream sources or use bypassFreshnessBlockers=true to override."
          }
        });
      }
    }
    const freshnessWarningOnly =
      (runSummary?.freshnessBlockers ?? 0) > 0 &&
      (Boolean(bypassFreshnessBlockers) || allowImplicitDailyFreshnessWarning);
    if (freshnessWarningOnly) {
      console.warn(
        "[update-rolling-player-averages] freshness blockers treated as warning",
        JSON.stringify({
          blockerCount: runSummary?.freshnessBlockers ?? 0,
          executionProfile,
          executionScope
        })
      );
    }
    res.status(200).json({
      message: freshnessWarningOnly
        ? allowImplicitDailyFreshnessWarning
          ? "Rolling player averages processed with freshness warnings on the implicit daily window."
          : "Rolling player averages processed with freshness blockers bypassed."
        : "Rolling player averages processed successfully.",
      success: true,
      operationStatus: freshnessWarningOnly ? "warning" : "success",
      warning: freshnessWarningOnly
        ? allowImplicitDailyFreshnessWarning
          ? "Implicit daily maintenance tolerated upstream freshness blockers. Treat this recompute as degraded until stale sources are refreshed."
          : "Upstream freshness blockers were bypassed. Treat this recompute as degraded until stale sources are refreshed."
        : null,
      executionProfile,
      executionScope,
      runtimeBudget,
      appliedPlayerLimit: maxPlayers,
      dependencyContract,
      runSummary,
      freshnessGate: {
        status:
          (runSummary?.freshnessBlockers ?? 0) > 0 ? "FAIL" : "PASS",
        blockerCount: runSummary?.freshnessBlockers ?? 0,
        bypassed:
          (bypassFreshnessBlockers ?? false) || allowImplicitDailyFreshnessWarning,
        action:
          (runSummary?.freshnessBlockers ?? 0) > 0
            ? "Refresh stale upstream sources or use bypassFreshnessBlockers=true to override."
            : "None."
      }
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
        error?.message ?? "Unknown error updating rolling player averages.",
      dependencyContract,
      runSummary
    });
  }
}

export default withCronJobAudit(handler);
