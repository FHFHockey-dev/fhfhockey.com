import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  refreshPlayerUnderlyingSummarySnapshotsForGameIds,
} from "lib/underlying-stats/playerStatsSummaryRefresh";
import { resolveRequestedGameIds } from "lib/supabase/Upserts/nhlRawGamecenterRoute";
import { ingestNhlApiRawGames } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";
import serviceRoleClient from "lib/supabase/server";
import adminOnly from "utils/adminOnlyMiddleware";

type UpdatePlayerUnderlyingStatsResponse =
  | {
      success: true;
      route: string;
      mode: "game" | "date_range" | "backfill_batch";
      seasonId: number;
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
    const selection = await resolveRequestedGameIds(req.query, serviceRoleClient);
    const shouldWarmLandingCache =
      isTruthyQueryFlag(req.query.warmLandingCache) || selection.mode === "game";
    const requestedGameType = inferRequestedGameType({
      explicitGameType: req.query.gameType,
      gameIds: selection.gameIds,
    });

    if (selection.gameIds.length === 0) {
      return res.status(200).json({
        success: true,
        route: "/api/v1/db/update-player-underlying-stats",
        mode: selection.mode,
        seasonId: selection.seasonId,
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

    const rawResults = await ingestNhlApiRawGames(serviceRoleClient, selection.gameIds);
    const rawRowsUpserted = sumRowsAffected(rawResults);
    const summaryRefresh = await refreshPlayerUnderlyingSummarySnapshotsForGameIds({
      gameIds: selection.gameIds,
      seasonId: selection.seasonId,
      requestedGameType,
      shouldWarmLandingCache,
      shouldMigrateLegacySummaries: false,
      supabase: serviceRoleClient,
    });

    return res.status(200).json({
      success: true,
      route: "/api/v1/db/update-player-underlying-stats",
      mode: selection.mode,
      seasonId: selection.seasonId,
      requestedGameCount: selection.gameIds.length,
      gameIds: selection.gameIds,
      rawRowsUpserted,
      summaryRowsUpserted: summaryRefresh.rowsUpserted,
      rowsUpserted: rawRowsUpserted + summaryRefresh.rowsUpserted,
      warmedLandingCache: shouldWarmLandingCache,
      results: rawResults,
      message:
        "Player underlying stats ingest completed. Raw NHL gamecenter payloads were refreshed first, then per-game player underlying summaries were rebuilt.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unable to update player underlying stats.";

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
