import type { NextApiRequest, NextApiResponse } from "next";

import {
  operationalRouteContracts,
  withOperationalRouteAuth,
} from "lib/cron/withOperationalRouteAuth";
import serviceRoleClient from "lib/supabase/server";
import {
  fetchTeamSummaryRebuildGameIds,
  refreshTeamUnderlyingSummaryRowsForGameIds,
} from "lib/underlying-stats/teamStatsSummaryRefresh";

// Rebuilds team_underlying_stats_summary for games that already have rows, inside an explicit
// date window or for an explicit gameIds list. Dry run by default; stale keys are reported, never
// deleted. diff=true (dry run only) also returns each stored row's field-level changes.
export const MAX_REBUILD_WINDOW_DAYS = 14;
export const MAX_REBUILD_GAMES = 120;
export const MAX_REBUILD_GAME_IDS = 10;
const MAX_DIFFS_RETURNED = 400;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isIsoDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function windowDays(startDate: string, endDate: string) {
  return (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000 + 1;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const seasonId = Number(single(req.query.seasonId));
  const startDate = single(req.query.startDate);
  const endDate = single(req.query.endDate);
  const gameTypeValue = single(req.query.gameType);
  const gameType = gameTypeValue ? Number(gameTypeValue) : null;
  const dryRun = single(req.query.dryRun)?.toLowerCase() !== "false";
  const diff = single(req.query.diff)?.toLowerCase() === "true";
  const gameIdsValue = single(req.query.gameIds);
  const requestedGameIds = gameIdsValue?.split(",").map((value) => Number(value.trim()));

  const issues: string[] = [];
  if (!Number.isInteger(seasonId) || seasonId <= 0) issues.push("seasonId is required.");
  if (requestedGameIds) {
    if (startDate != null || endDate != null) {
      issues.push("Pass gameIds or startDate+endDate, not both.");
    } else if (
      requestedGameIds.length === 0 ||
      requestedGameIds.length > MAX_REBUILD_GAME_IDS ||
      requestedGameIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(requestedGameIds).size !== requestedGameIds.length
    ) {
      issues.push(`gameIds must be 1-${MAX_REBUILD_GAME_IDS} distinct positive game ids.`);
    }
  } else if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    issues.push("startDate and endDate are required (YYYY-MM-DD).");
  } else if (endDate < startDate) {
    issues.push("endDate must be on or after startDate.");
  } else if (windowDays(startDate, endDate) > MAX_REBUILD_WINDOW_DAYS) {
    issues.push(`The date window may span at most ${MAX_REBUILD_WINDOW_DAYS} days.`);
  }
  if (gameType != null && (!Number.isInteger(gameType) || gameType <= 0)) {
    issues.push("gameType must be a positive integer.");
  }
  if (diff && !dryRun) issues.push("diff=true is read-only: it cannot be combined with dryRun=false.");
  if (issues.length > 0) {
    return res.status(400).json({ success: false, error: issues[0], issues });
  }

  const gameIds = await fetchTeamSummaryRebuildGameIds({
    seasonId,
    ...(requestedGameIds ? { gameIds: requestedGameIds } : { startDate: startDate!, endDate: endDate! }),
    gameType,
    supabase: serviceRoleClient,
  });
  if (requestedGameIds && gameIds.length !== requestedGameIds.length) {
    const missing = requestedGameIds.filter((id) => !gameIds.includes(id));
    return res.status(400).json({
      success: false,
      error: `Not final games of season ${seasonId}: ${missing.join(",")}.`,
    });
  }
  if (gameIds.length > MAX_REBUILD_GAMES) {
    return res.status(400).json({
      success: false,
      error: `The window selects ${gameIds.length} games; the limit is ${MAX_REBUILD_GAMES}.`,
    });
  }

  const result = await refreshTeamUnderlyingSummaryRowsForGameIds({
    gameIds,
    seasonId,
    requestedGameType: gameType,
    shouldWarmLandingCache: false,
    supabase: serviceRoleClient,
    dryRun,
    reportStaleKeys: true,
    reportDiffs: diff,
  });

  return res.status(200).json({
    success: true,
    route: "/api/v1/db/rebuild-team-underlying-summaries",
    dryRun,
    seasonId,
    startDate,
    endDate,
    gameType,
    requestedGameCount: gameIds.length,
    gameIds: result.gameIdsProcessed,
    rowsGenerated: result.rowsGenerated,
    rowsUpserted: result.rowsUpserted,
    staleKeyCount: result.staleKeys.length,
    staleKeys: result.staleKeys.slice(0, 200),
    ...(diff
      ? {
          diffRowCount: result.diffs.length,
          diffsTruncated: result.diffs.length > MAX_DIFFS_RETURNED,
          diffs: result.diffs.slice(0, MAX_DIFFS_RETURNED),
        }
      : {}),
  });
}

export default withOperationalRouteAuth(
  handler,
  operationalRouteContracts.rebuildTeamUnderlyingSummaries,
);
