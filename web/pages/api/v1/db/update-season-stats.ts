// pages/api/v1/db/update-stats-by-season.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import { buildNhlGameSummaryReportUrl } from "lib/NHL/htmlReports";
import {
  assertCompletePlayerGameStatsBatches,
  assertCompletePlayerGameStatsSource,
  assertCompleteTeamGameStatsSource,
  assertMatchingGameIdentity,
  getGameStatsCompletenessFailureDetails,
  type GameStatsCompletenessFailureDetails,
} from "lib/cron/gameStatsCompleteness";
import {
  getTransactionalGameStatsFailureDetails,
  persistCompleteGameStatsTransaction,
  type TransactionalGameStatsFailureDetails,
} from "lib/cron/transactionalGameStatsPersistence";
import {
  StatsPreWriteQuarantineError,
  getStatsPreWriteQuarantineFailureDetails,
  sanitizeCronDiagnostic,
  type StatsPreWriteQuarantineFailureDetails,
} from "lib/cron/statsUpdateSafety";
import { tryFinalizeScheduleNotRealizedGameStats } from "lib/cron/nonRealizedGameStats";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getCurrentSeason } from "lib/NHL/server";
import { HTMLElement, parse } from "node-html-parser";
import { get } from "lib/NHL/base";
import { updatePlayer } from "./update-player/[playerId]";
import fetchWithCache from "lib/fetchWithCache";
import adminOnly from "utils/adminOnlyMiddleware";

/**
 * Query params:
 * - seasonId: optional YYYYYYYY season id; defaults to the current NHL season.
 * - runMode: optional `incremental` or `full`; defaults to incremental when no other mode is given.
 * - full / all: optional truthy flag for a full-season replay.
 *
 * Cron-safe default:
 * - no params => current-season incremental refresh from the latest fully processed game forward
 *
 * Cron-safe static URL:
 * - /api/v1/db/update-season-stats
 */

type GameState = "OFF" | "FINAL" | "FUT";
type Category =
  | "sog"
  | "faceoffWinningPctg"
  | "powerPlay"
  | "powerPlayPctg"
  | "pim"
  | "hits"
  | "blockedShots"
  | "giveaways"
  | "takeaways";

type TeamGameStat = {
  category: Category;
  awayValue: string | number;
  homeValue: string | number;
};

type Forward = {
  playerId: number;
  gameId: number;
  position: "C" | "L" | "R";
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  blockedShots: number;
  powerPlayGoals: number;
  powerPlayPoints: number; // Calculated: PPG + PPA
  shorthandedGoals: number;
  shPoints: number; // Calculated: SHG + SHA
  shots: number;
  faceoffs: string;
  faceoffWinningPctg: number;
  toi: string;
  powerPlayToi: string;
  shorthandedToi: string;
};

type Defense = {
  playerId: number;
  gameId: number;
  position: "D";
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  blockedShots: number;
  powerPlayGoals: number;
  powerPlayPoints: number; // Calculated: PPG + PPA
  shorthandedGoals: number;
  shPoints: number; // Calculated: SHG + SHA
  shots: number;
  faceoffs: string; // Requires PBP data
  faceoffWinningPctg: number;
  toi: string;
  powerPlayToi: string; // Requires PBP/HTML data
  shorthandedToi: string; // Requires PBP/HTML data
};

type Goalie = {
  playerId: number;
  gameId: number;
  position: "G";
  evenStrengthShotsAgainst?: string;
  powerPlayShotsAgainst?: string;
  shorthandedShotsAgainst?: string;
  saveShotsAgainst: string;
  savePctg?: number;
  evenStrengthGoalsAgainst?: number;
  powerPlayGoalsAgainst?: number;
  shorthandedGoalsAgainst?: number;
  pim: number;
  goalsAgainst: number;
  toi: string;
};

type Skater = Forward | Defense;

type ApiForwardData = {
  playerId: number;
  sweaterNumber: number;
  name: { default: string };
  position: "C" | "L" | "R";
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  powerPlayGoals: number;
  sog: number;
  faceoffWinningPctg: number;
  toi: string;
  blockedShots: number;
  shifts: number;
  giveaways: number;
  takeaways: number;
};

type ApiDefenseData = {
  playerId: number;
  sweaterNumber: number;
  name: { default: string };
  position: "D";
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  powerPlayGoals: number;
  sog: number;
  faceoffWinningPctg: number;
  toi: string;
  blockedShots: number;
  shifts: number;
  giveaways: number;
  takeaways: number;
};

type ApiGoalieData = {
  playerId: number;
  position: "G";
  evenStrengthShotsAgainst?: string;
  powerPlayShotsAgainst?: string;
  shorthandedShotsAgainst?: string;
  saveShotsAgainst: string;
  savePctg?: number;
  evenStrengthGoalsAgainst?: number;
  powerPlayGoalsAgainst?: number;
  shorthandedGoalsAgainst?: number;
  pim: number;
  goalsAgainst: number;
  toi: string;
  sweaterNumber?: number;
  name?: { default: string };
};

type ApiPlayerGameStatsData = {
  forwards: ApiForwardData[];
  defense: ApiDefenseData[];
  goalies: ApiGoalieData[];
};

type PlayerCounts = { [playerId: number]: number };

/////////////// API Route Logic //////////////////

export function isTruthyQueryFlag(
  value: string | string[] | undefined,
): boolean {
  if (typeof value === "string") {
    return ["1", "true", "all", "full", "yes"].includes(value.toLowerCase());
  }

  if (Array.isArray(value)) {
    return value.some((entry) => isTruthyQueryFlag(entry));
  }

  return false;
}

export function resolveSeasonStatsRunMode({
  runMode,
  fullFlag,
}: {
  runMode?: string;
  fullFlag?: string | string[];
}): "incremental" | "full" {
  if (typeof runMode === "string" && runMode.toLowerCase() === "full") {
    return "full";
  }

  return isTruthyQueryFlag(fullFlag) ? "full" : "incremental";
}

type PersistedGameCompletenessRow = {
  id?: unknown;
  statsUpdateStatus?: unknown;
};

function embeddedRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is Record<string, unknown> =>
        typeof row === "object" && row !== null,
    );
  }
  return typeof value === "object" && value !== null
    ? [value as Record<string, unknown>]
    : [];
}

function isPersistedGameComplete(row: PersistedGameCompletenessRow): boolean {
  const statusRows = embeddedRows(row.statsUpdateStatus);
  if (statusRows.length !== 1) return false;

  const status = statusRows[0];
  const hasCompletionTimestamp =
    typeof status.completed_at === "string" &&
    status.completed_at.length > 0 &&
    Number.isFinite(Date.parse(status.completed_at));
  if (
    status.updated !== true ||
    status.contract_version !== 1 ||
    !hasCompletionTimestamp
  ) {
    return false;
  }

  if (status.outcome === "quarantined") {
    return (
      ["game_not_finished", "schedule_not_realized"].includes(
        String(status.reason),
      ) &&
      status.expected_team_rows === 0 &&
      status.observed_team_rows === 0 &&
      status.expected_skater_rows === 0 &&
      status.observed_skater_rows === 0 &&
      status.expected_goalie_rows === 0 &&
      status.observed_goalie_rows === 0
    );
  }

  return (
    status.outcome === "complete" &&
    status.reason == null &&
    status.expected_team_rows === 2 &&
    status.observed_team_rows === status.expected_team_rows &&
    typeof status.expected_skater_rows === "number" &&
    status.expected_skater_rows >= 1 &&
    status.expected_skater_rows <= 100 &&
    status.observed_skater_rows === status.expected_skater_rows &&
    typeof status.expected_goalie_rows === "number" &&
    status.expected_goalie_rows >= 1 &&
    status.expected_goalie_rows <= 100 &&
    status.observed_goalie_rows === status.expected_goalie_rows
  );
}

async function getEarliestIncompleteOrPendingGameIdForSeason(
  supabaseClient: SupabaseClient,
  seasonId: string,
): Promise<number | null> {
  const pageSize = 1000;
  const maxPages = 10;
  const seenPageSignatures = new Set<string>();
  let previousGameId = 0;

  for (let currentPage = 0; currentPage < maxPages; currentPage += 1) {
    const rangeFrom = currentPage * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;
    const { data, error } = await supabaseClient
      .from("games")
      .select(
        "id, statsUpdateStatus(updated,outcome,reason,contract_version,expected_team_rows,observed_team_rows,expected_skater_rows,observed_skater_rows,expected_goalie_rows,observed_goalie_rows,completed_at)",
      )
      .eq("seasonId", seasonId)
      .lte("startTime", new Date().toISOString())
      .order("id", { ascending: true })
      .limit(1, { foreignTable: "statsUpdateStatus" })
      .range(rangeFrom, rangeTo);

    if (error) {
      throw new Error(
        `Failed to determine incomplete stats games for season ${seasonId}: ${String(
          (error as { message?: unknown })?.message ?? error,
        )}`,
      );
    }
    if (!Array.isArray(data)) {
      throw new Error(
        "The persisted stats completeness query returned a non-array result.",
      );
    }

    const rows = data as PersistedGameCompletenessRow[];
    for (const row of rows) {
      const gameId = row.id;
      if (
        typeof gameId !== "number" ||
        !Number.isSafeInteger(gameId) ||
        gameId <= previousGameId
      ) {
        throw new Error(
          "The persisted stats completeness query returned invalid or non-increasing game IDs.",
        );
      }
      previousGameId = gameId;
      if (!isPersistedGameComplete(row)) return gameId;
    }

    if (rows.length < pageSize) return null;
    const signature = `${rows[0]?.id}:${rows[rows.length - 1]?.id}:${rows.length}`;
    if (seenPageSignatures.has(signature)) {
      throw new Error(
        "The persisted stats completeness query repeated a full page.",
      );
    }
    seenPageSignatures.add(signature);
  }

  throw new Error(
    `The persisted stats completeness query exceeded ${maxPages} pages for season ${seasonId}.`,
  );
}

async function fetchFinishedGamesForSeason(
  supabaseClient: SupabaseClient,
  seasonId: string,
  minimumGameIdInclusive: number | null,
  maximumGames: number | null,
): Promise<Array<{ id: number }>> {
  console.log(
    `Workspaceing finished game IDs for season ${seasonId}${
      minimumGameIdInclusive
        ? ` from pending ledger game ${minimumGameIdInclusive}`
        : " from season start"
    } with pagination...`,
  );

  const pageSize = Math.min(1000, maximumGames ?? 1000);
  let currentPage = 0;
  let allGamesAccumulator: Array<{ id: number }> = [];
  let keepFetching = true;

  while (keepFetching) {
    const rangeFrom = currentPage * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    let query = supabaseClient
      .from("games")
      .select("id")
      .eq("seasonId", seasonId)
      .lte("startTime", new Date().toISOString())
      .order("id", { ascending: true });

    if (typeof minimumGameIdInclusive === "number") {
      query = query.gte("id", minimumGameIdInclusive);
    }

    const { data: gamesOnPage, error: gamesError } = await query.range(
      rangeFrom,
      rangeTo,
    );

    if (gamesError) {
      throw new Error(
        `Database error fetching games page ${currentPage} for season ${seasonId}: ${gamesError.message}`,
      );
    }

    if (gamesOnPage && gamesOnPage.length > 0) {
      const remaining =
        maximumGames == null
          ? gamesOnPage.length
          : Math.max(0, maximumGames - allGamesAccumulator.length);
      allGamesAccumulator = allGamesAccumulator.concat(
        gamesOnPage.slice(0, remaining),
      );
    }

    if (
      !gamesOnPage ||
      gamesOnPage.length < pageSize ||
      (maximumGames != null && allGamesAccumulator.length >= maximumGames)
    ) {
      keepFetching = false;
    } else {
      currentPage += 1;
    }
  }

  return allGamesAccumulator;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  );

  const requestedSeasonId = Array.isArray(req.query.seasonId)
    ? req.query.seasonId[0]
    : req.query.seasonId;
  const runModeParam = Array.isArray(req.query.runMode)
    ? req.query.runMode[0]
    : req.query.runMode;
  const fullParam = req.query.full ?? req.query.all;
  const seasonId =
    typeof requestedSeasonId === "string" && requestedSeasonId.trim()
      ? requestedSeasonId.trim()
      : String((await getCurrentSeason()).seasonId);
  const runMode = resolveSeasonStatsRunMode({
    runMode: typeof runModeParam === "string" ? runModeParam : undefined,
    fullFlag: fullParam,
  });

  // Validate seasonId format (basic check, adjust regex if needed)
  if (!/^\d{8}$/.test(seasonId)) {
    return res.status(400).json({
      message: "seasonId must be in YYYYYYYY format (e.g., 20242025).",
      success: false,
    });
  }

  if (!requestedSeasonId) {
    console.log(
      `No seasonId provided; defaulting to current season ${seasonId}.`,
    );
  }

  console.log(
    `Received request to update stats for season ${seasonId} in ${runMode} mode.`,
  );

  try {
    const incrementalStartGameId =
      runMode === "incremental"
        ? await getEarliestIncompleteOrPendingGameIdForSeason(
            supabase,
            seasonId,
          )
        : null;
    const allGamesAccumulator =
      runMode === "incremental" && incrementalStartGameId === null
        ? []
        : await fetchFinishedGamesForSeason(
            supabase,
            seasonId,
            incrementalStartGameId,
            runMode === "incremental" ? 10 : null,
          );

    if (allGamesAccumulator.length === 0) {
      console.log(
        `No finished games found for season ${seasonId} after pagination.`,
      );
      return res.json({
        seasonId,
        mode: runMode,
        incrementalStartGameId,
        message:
          runMode === "incremental"
            ? `No new finished games found to update for season ${seasonId}.`
            : `No finished games found to update for season ${seasonId}.`,
        success: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        failedGameIds: [],
        nonRealizedGameIds: [],
      });
    }

    console.log(
      `Found ${allGamesAccumulator.length} finished game(s) to process for season ${seasonId}. Starting update process...`,
    );

    // 2. Iterate through each game ID (from the complete list) and update its stats
    let successCount = 0;
    let failureCount = 0;
    let attemptedCount = 0;
    const failedGameIds: number[] = [];
    const nonRealizedGameIds: number[] = [];
    const failures: Array<
      | TransactionalGameStatsFailureDetails
      | GameStatsCompletenessFailureDetails
      | StatsPreWriteQuarantineFailureDetails
      | {
          kind: "stats_update_failure";
          code: "STATS_UPDATE_FAILED";
          gameId: number;
          message: string;
        }
    > = [];

    // Use the accumulated list of all games
    for (const game of allGamesAccumulator) {
      const gameId = game.id;
      attemptedCount++;
      console.log(`--- Processing Game ID: ${gameId} ---`);
      try {
        await updateStats(gameId, supabase);
        console.log(`Successfully updated stats for game ${gameId}.`);
        successCount++;
      } catch (e: any) {
        let terminalError = e;
        try {
          const receipt = await tryFinalizeScheduleNotRealizedGameStats({
            supabase,
            gameId,
            landingError: e,
          });
          if (receipt) {
            nonRealizedGameIds.push(receipt.gameId);
            successCount++;
            console.warn(
              `Game ${gameId} was terminalized as schedule_not_realized.`,
            );
            continue;
          }
        } catch (finalizationError) {
          terminalError = finalizationError;
        }

        failureCount++;
        failedGameIds.push(gameId);
        const failure = getGameStatsCompletenessFailureDetails(terminalError) ??
          getTransactionalGameStatsFailureDetails(terminalError) ??
          getStatsPreWriteQuarantineFailureDetails(terminalError) ?? {
            kind: "stats_update_failure",
            code: "STATS_UPDATE_FAILED",
            gameId,
            message: sanitizeCronDiagnostic(terminalError),
          };
        failures.push(failure);
        console.error("Season stats game update failed.", {
          gameId,
          kind: failure.kind,
          code: failure.code,
          message:
            failure.kind === "stats_update_failure"
              ? failure.message
              : undefined,
        });
        console.log(
          `Stopping the season run at failed game ${gameId} so the incremental cursor cannot advance past the gap.`,
        );
        break;
      }
      console.log(`--- Finished Processing Game ID: ${gameId} ---`);
      // Optional delay
      // await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(
      `Finished updating stats for season ${seasonId}. Success: ${successCount}, Failed: ${failureCount}`,
    );
    const failedRows = failures.reduce(
      (total, failure) =>
        total +
        (failure.kind === "stats_update_failure" ? 1 : failure.requestedRows),
      0,
    );
    const deferredGameIds = allGamesAccumulator
      .slice(attemptedCount)
      .map((game) => game.id);

    // 3. Return summary response
    const response = {
      seasonId,
      mode: runMode,
      incrementalStartGameId,
      message: `Stats update process completed for season ${seasonId}. Processed: ${attemptedCount}, Succeeded: ${successCount}, Failed: ${failureCount}.`,
      success: failureCount === 0,
      processed: attemptedCount,
      selected: allGamesAccumulator.length,
      succeeded: successCount,
      failed: failureCount,
      failedRows,
      failedGameIds: failedGameIds,
      nonRealizedGameIds,
      deferredGameIds,
      failures,
    };

    return failureCount > 0
      ? res.status(500).json(response)
      : res.json(response);
  } catch (e: any) {
    // Catch errors from pagination loop
    const dependencyError = normalizeDependencyError(e);
    console.error(
      `Unhandled error during season update for ${seasonId}: ${dependencyError.message}`,
    );
    return res.status(500).json({
      message: `An unexpected error occurred: ${dependencyError.message}`,
      success: false,
      dependencyError,
    });
  }
}

export const isGameFinished = (state: GameState) =>
  (["OFF", "FINAL"] as GameState[]).includes(state);

export async function updateStats(gameId: number, supabase: SupabaseClient) {
  console.log(`Starting updateStats for gameId: ${gameId}`);

  const landing = await get(`/gamecenter/${gameId}/landing`);

  const gameState: GameState = landing?.gameState;
  const season: number | undefined = landing?.season;
  const gameIdentifier: number = landing?.id;

  assertMatchingGameIdentity({
    requestedGameId: gameId,
    landingGameId: gameIdentifier,
  });

  if (!gameState || !season) {
    throw new Error(
      `Essential game data (gameState or season) missing from landing endpoint for game ${gameId}`,
    );
  }

  console.log(`Game ${gameIdentifier}: State=${gameState}, Season=${season}`);

  if (!isGameFinished(gameState)) {
    console.warn(
      `Game ${gameIdentifier} state is '${gameState}', not considered finished by API. Skipping update.`,
    );
    throw new StatsPreWriteQuarantineError({
      kind: "stats_pre_write_quarantine_failure",
      code: "STATS_PRE_WRITE_QUARANTINE_ELIGIBLE",
      phase: "pre_write_validation",
      gameId: gameIdentifier,
      requestedRows: 1,
      reason: "game_not_finished",
      message: `Game ${gameIdentifier} is not finished. gameState: ${gameState}`,
    });
  }

  const rightRail = await get(`/gamecenter/${gameIdentifier}/right-rail`);
  const rawTeamGameStats: unknown = rightRail?.teamGameStats;
  assertCompleteTeamGameStatsSource({
    gameId: gameIdentifier,
    teamGameStats: rawTeamGameStats,
    teamIds: [landing?.homeTeam?.id, landing?.awayTeam?.id],
  });
  const teamGameStats = rawTeamGameStats as TeamGameStat[];
  console.log(`Processing teamGameStats for game ${gameIdentifier}...`);
  const homeTeamGameStats = await processTeamGameStats(
    gameIdentifier,
    teamGameStats,
    true,
    landing,
    season.toString(),
    rightRail,
  );
  const awayTeamGameStats = await processTeamGameStats(
    gameIdentifier,
    teamGameStats,
    false,
    landing,
    season.toString(),
    rightRail,
  );

  console.log(
    `Workspaceing boxscore for game ${gameIdentifier} (needed for playerByGameStats)...`,
  );
  const boxscore = await get(`/gamecenter/${gameIdentifier}/boxscore`);
  assertCompletePlayerGameStatsSource({
    gameId: gameIdentifier,
    boxscore,
  });

  const powerPlayAssistsCount: PlayerCounts = {};
  const shorthandedGoalsCount: PlayerCounts = {};
  const shorthandedAssistsCount: PlayerCounts = {};

  const scoringPeriods = landing?.summary?.scoring;
  if (scoringPeriods && Array.isArray(scoringPeriods)) {
    console.log(
      `Processing scoring summary from LANDING data for game ${gameIdentifier}...`,
    );
    for (const period of scoringPeriods) {
      const goalsInPeriod = period?.goals;
      if (goalsInPeriod && Array.isArray(goalsInPeriod)) {
        for (const goal of goalsInPeriod) {
          const strength = goal?.strength?.toLowerCase();
          const scorerId = goal?.playerId;
          const assists = goal?.assists;

          if (!scorerId) continue;

          if (strength === "pp" && Array.isArray(assists)) {
            for (const assist of assists) {
              if (assist?.playerId) {
                powerPlayAssistsCount[assist.playerId] =
                  (powerPlayAssistsCount[assist.playerId] || 0) + 1;
              }
            }
          } else if (strength === "sh") {
            shorthandedGoalsCount[scorerId] =
              (shorthandedGoalsCount[scorerId] || 0) + 1;
            if (Array.isArray(assists)) {
              for (const assist of assists) {
                if (assist?.playerId) {
                  shorthandedAssistsCount[assist.playerId] =
                    (shorthandedAssistsCount[assist.playerId] || 0) + 1;
                }
              }
            }
          }
        }
      }
    }
    console.log(
      `Finished processing scoring summary for game ${gameIdentifier}.`,
    );
  } else {
    console.warn(
      `Scoring summary not found or invalid in LANDING data for game ${gameIdentifier}. PPP/SHP calculations may be incomplete.`,
    );
  }

  console.log(`Counts for game ${gameIdentifier}:`);
  console.log("PPA Counts:", JSON.stringify(powerPlayAssistsCount));
  console.log("SHG Counts:", JSON.stringify(shorthandedGoalsCount));
  console.log("SHA Counts:", JSON.stringify(shorthandedAssistsCount));

  console.log(
    `Extracting player stats using BOXSCORE data for game ${gameIdentifier}...`,
  );
  const { skaters, goalies } = getPlayersGameStats(
    boxscore,
    gameIdentifier,
    powerPlayAssistsCount,
    shorthandedGoalsCount,
    shorthandedAssistsCount,
  );
  assertCompletePlayerGameStatsBatches({
    gameId: gameIdentifier,
    skaters,
    goalies,
  });

  console.log(
    `Persisting the complete transactional game-stat manifest for game ${gameIdentifier}...`,
  );
  const manifest = await persistCompleteGameStatsTransaction({
    supabase,
    gameId: gameIdentifier,
    teamRows: [homeTeamGameStats, awayTeamGameStats],
    skaterRows: skaters,
    goalieRows: goalies,
    repairMissingPlayer: (playerId) => updatePlayer(playerId, supabase),
  });

  console.log(`Finished updateStats execution for gameId: ${gameIdentifier}`);
  return manifest;
}

///////////////// Helper Functions //////////////////////////////

async function processTeamGameStats(
  gameId: number,
  teamGameStats: TeamGameStat[],
  isHomeTeam: boolean,
  landing: any,
  season: string,
  rightRail: any,
) {
  const getStat = (category: Category): string | number | undefined => {
    const statObj = teamGameStats.find((stat) => stat.category === category);
    return statObj
      ? isHomeTeam
        ? statObj.homeValue
        : statObj.awayValue
      : undefined;
  };

  const team = isHomeTeam ? landing?.homeTeam : landing?.awayTeam;
  if (
    !team ||
    typeof team.id === "undefined" ||
    typeof team.score === "undefined"
  ) {
    // Log specific missing fields if possible
    console.error(
      `Invalid team data in landing object for game ${gameId}. Home=${isHomeTeam}. Data:`,
      JSON.stringify(team),
    );
    throw new Error(
      `Invalid team data (missing id or score) in landing object for game ${gameId}. Home=${isHomeTeam}`,
    );
  }

  const powerPlayData = getStat("powerPlay")?.toString() || "0/0";
  const powerPlayConversionData = getStat("powerPlayPctg")?.toString() || "0.0";

  let powerPlayToi = "00:00";
  const teamKey = isHomeTeam ? "homeTeam" : "awayTeam";
  if (rightRail?.[teamKey]?.powerPlayToi) {
    powerPlayToi = rightRail[teamKey].powerPlayToi;
  } else {
    console.warn(
      `PP TOI not found directly in rightRail for ${teamKey}, game ${gameId}. Trying HTML fallback.`,
    );
    try {
      powerPlayToi = await getPPTOI(season, gameId.toString(), isHomeTeam);
    } catch (e: any) {
      console.error(
        `Failed to fetch/parse PP TOI from HTML for ${teamKey}, game ${gameId}. Defaulting to "00:00". Error: ${sanitizeCronDiagnostic(e)}`,
      );
      // Do not throw here, default is acceptable
    }
  }

  // Ensure numeric conversions handle potential errors or NaN
  const safeNumber = (val: any, defaultVal: number = 0): number => {
    const num = Number(val);
    return isNaN(num) ? defaultVal : num;
  };

  return {
    gameId: gameId,
    teamId: team.id,
    score: team.score,
    sog: safeNumber(getStat("sog")),
    faceoffPctg: safeNumber(getStat("faceoffWinningPctg")),
    pim: safeNumber(getStat("pim")),
    hits: safeNumber(getStat("hits")),
    blockedShots: safeNumber(getStat("blockedShots")),
    giveaways: safeNumber(getStat("giveaways")),
    takeaways: safeNumber(getStat("takeaways")),
    powerPlay: powerPlayData,
    powerPlayConversion: powerPlayConversionData,
    powerPlayToi: powerPlayToi, // Keep as string "MM:SS"
    // Add updated_at timestamp if  table has it
    // updated_at: new Date().toISOString(),
  };
}

async function getPPTOI(
  season: string,
  gameIdString: string,
  isHome: boolean,
): Promise<string> {
  const slicedGameId = gameIdString.slice(4);
  if (!slicedGameId || slicedGameId.length !== 6) {
    console.error(`Invalid gameId format for HTML report: ${gameIdString}`);
    return "00:00";
  }

  let content = "";
  try {
    content = await getReportContent(season, slicedGameId);
    if (!content) {
      console.error(`HTML report content empty for game ${gameIdString}.`);
      return "00:00";
    }
  } catch (fetchError) {
    console.error(
      `Failed to fetch HTML report for game ${gameIdString}: ${sanitizeCronDiagnostic(fetchError)}`,
    );
    return "00:00";
  }

  let document;
  try {
    document = parse(content);
  } catch (parseError) {
    console.error(
      `Failed to parse HTML report for game ${gameIdString}: ${sanitizeCronDiagnostic(parseError)}`,
    );
    return "00:00";
  }

  const rows = document.querySelectorAll(
    "#PenaltySummary tr.oddColor, #PenaltySummary tr.evenColor",
  );

  const PPTOIs: string[] = [];
  for (const row of rows) {
    const rowText = row.textContent || "";
    if (rowText.includes("Power Plays (Goals-Opp./PPTime)")) {
      const cells = getChildren(row);
      if (cells.length > 1) {
        const timeText = cells[1].textContent?.split("/").pop()?.trim();
        if (timeText && /^\d{1,2}:\d{2}$/.test(timeText)) {
          PPTOIs.push(timeText);
        } else {
          console.warn(
            `Could not parse valid PPTOI time from '${sanitizeCronDiagnostic(cells[1].textContent)}' in game ${gameIdString}`,
          );
        }
      } else {
        console.warn(
          `Found PPTOI row but unexpected cell structure in game ${gameIdString}`,
        );
      }
    }
  }

  if (PPTOIs.length !== 2) {
    console.error(
      `Expected 2 PPTOIs from HTML report, found ${PPTOIs.length} for game ${gameIdString}.`,
    );
    return "00:00";
  }

  return PPTOIs[isHome ? 1 : 0];
}

function getChildren(node: HTMLElement): HTMLElement[] {
  return node.childNodes.filter(
    (n): n is HTMLElement => n instanceof HTMLElement && n.nodeType === 1, // Ensure it's an Element node
  );
}

const getReportContent = (
  season: string,
  gameIdSuffix: string,
): Promise<string> => {
  const reportUrl = buildNhlGameSummaryReportUrl(season, gameIdSuffix);
  console.log(`Workspaceing HTML Report: ${reportUrl}`);
  try {
    return fetchWithCache(reportUrl, false); // Set cache to false if stats should always be fresh
  } catch (error) {
    console.error(
      `Error initiating fetchWithCache for ${reportUrl}: ${sanitizeCronDiagnostic(error)}`,
    );
    return Promise.resolve(""); // Return empty string on error to prevent downstream crashes
  }
};

function getPlayersGameStats(
  boxscore: any,
  gameId: number,
  powerPlayAssistsCount: PlayerCounts,
  shorthandedGoalsCount: PlayerCounts,
  shorthandedAssistsCount: PlayerCounts,
): {
  skaters: Skater[];
  goalies: Goalie[];
} {
  const homeTeamStats: ApiPlayerGameStatsData | undefined =
    boxscore?.playerByGameStats?.homeTeam;
  const awayTeamStats: ApiPlayerGameStatsData | undefined =
    boxscore?.playerByGameStats?.awayTeam;

  const apiSkaters: (ApiForwardData | ApiDefenseData)[] = [
    ...(homeTeamStats?.forwards || []),
    ...(awayTeamStats?.forwards || []),
    ...(homeTeamStats?.defense || []),
    ...(awayTeamStats?.defense || []),
  ];

  if (apiSkaters.length === 0) {
    console.warn(
      `No skater data found in boxscore.playerByGameStats for game ${gameId}.`,
    );
    // throw new Error(`No skater data found for game ${gameId}`);
  }

  const skaters: Skater[] = apiSkaters
    .map((player) => {
      const pId = player.playerId;
      const ppg = player.powerPlayGoals ?? 0;
      const ppa = powerPlayAssistsCount[pId] ?? 0;
      const shg = shorthandedGoalsCount[pId] ?? 0;
      const sha = shorthandedAssistsCount[pId] ?? 0;

      // Explicitly handle Forward vs Defense specific fields if needed,
      const skaterData: Skater = {
        playerId: pId,
        gameId: gameId,
        position: player.position, // C, L, R, or D
        goals: player.goals ?? 0,
        assists: player.assists ?? 0,
        points: player.points ?? 0,
        plusMinus: player.plusMinus ?? 0,
        pim: player.pim ?? 0,
        hits: player.hits ?? 0,
        blockedShots: player.blockedShots ?? 0,
        powerPlayGoals: ppg,
        shots: player.sog ?? 0, // Map sog to shots
        faceoffWinningPctg: player.faceoffWinningPctg ?? 0,
        toi: player.toi || "00:00",

        // Calculated values
        powerPlayPoints: ppg + ppa,
        shorthandedGoals: shg,
        shPoints: shg + sha,

        // Defaults - Consider if these can be fetched from elsewhere (PBP data)
        faceoffs: "0/0",
        powerPlayToi: "00:00",
        shorthandedToi: "00:00",

        // Add updated_at timestamp if table has it
        // updated_at: new Date().toISOString(),
      };
      return skaterData;
    })
    .filter((player) => player.playerId); // Filter out any potential invalid entries

  const apiGoalies: ApiGoalieData[] = [
    ...(homeTeamStats?.goalies || []),
    ...(awayTeamStats?.goalies || []),
  ];

  if (apiGoalies.length === 0) {
    console.warn(
      `No goalie data found in boxscore.playerByGameStats for game ${gameId}.`,
    );
    // Depending on requirements, decide if this is an error or just a warning
    // throw new Error(`No goalie data found for game ${gameId}`);
  }

  const goalies: Goalie[] = apiGoalies
    .map((player) => {
      if (!player.playerId) {
        console.warn(
          `Skipping goalie entry due to missing playerId in game ${gameId}`,
          player,
        );
        return null; // Return null to filter out later
      }

      const goalieData: Goalie = {
        playerId: player.playerId,
        gameId: gameId,
        position: "G", // Always 'G' for goalies
        saveShotsAgainst: player.saveShotsAgainst || "0-0",
        pim: player.pim ?? 0,
        goalsAgainst: player.goalsAgainst ?? 0,
        toi: player.toi || "00:00",
        savePctg: player.savePctg ?? 0.0,
        // Optional fields - pass through if they exist, otherwise undefined
        evenStrengthShotsAgainst: player.evenStrengthShotsAgainst,
        powerPlayShotsAgainst: player.powerPlayShotsAgainst,
        shorthandedShotsAgainst: player.shorthandedShotsAgainst,
        evenStrengthGoalsAgainst: player.evenStrengthGoalsAgainst,
        powerPlayGoalsAgainst: player.powerPlayGoalsAgainst,
        shorthandedGoalsAgainst: player.shorthandedGoalsAgainst,

        // Add updated_at timestamp if your table has it
        // updated_at: new Date().toISOString(),
      };
      return goalieData;
    })
    .filter((g): g is Goalie => g !== null); // Filter out any null entries from validation

  console.log(
    `Extracted ${skaters.length} skaters and ${goalies.length} goalies for game ${gameId}.`,
  );
  return {
    skaters,
    goalies,
  };
}

export default withCronJobAudit(adminOnly(handler));
