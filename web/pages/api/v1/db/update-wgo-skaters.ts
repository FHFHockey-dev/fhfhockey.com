/**
 * This API route fetches, processes, and stores daily skater statistics from the official NHL API.
 * It is designed to be called by a cron job or manually to populate and maintain a database
 * of player game-by-game stats. The script can perform several types of updates, from
 * incremental daily updates to full historical backfills, controlled by URL query parameters.
 *
 * --- How It Works ---
 * 1.  **Parameter Parsing**: The handler determines the requested operation by parsing query parameters
 *     like `action`, `date`, `fullRefresh`, etc.
 * 2.  **Date & Season Logic**: It intelligently determines the date range to process and identifies which
 *     season(s) those dates belong to, correctly distinguishing between regular season and playoffs.
 * 3.  **Data Fetching**: It calls up to 16 different NHL API endpoints for each game date to gather a
 *     comprehensive set of stats (summary, bio, time on ice, puck possession, etc.).
 * 4.  **Data Aggregation**: The data from all endpoints is aggregated into a single, unified record for each player for that day.
 * 5.  **Database Upsert**: The aggregated records are "upserted" into the Supabase database, either into
 *     `wgo_skater_stats` (regular season) or `wgo_skater_stats_playoffs`.
 * 6.  **Error Handling & Retries**: The script includes a robust retry mechanism. If fetching data for a
 *     specific date fails, it will attempt a few more times before marking it as a failed date and
 *     moving on. A final retry pass is attempted at the end of the run.
 * 7.  **Logging**: The entire process is logged to the console and the results are recorded in the
 *     `cron_job_audit` table in Supabase for monitoring.
 *
 * --- Query Parameters ---
 *
 * The script's behavior is controlled by the following query parameters:
 *
 * 1.  `action`: The primary parameter to define the script's operation.
 *
 *     - `action=all` (Most Common):
 *       Triggers an update for the current season. By default, it runs incrementally, starting from the
 *       day after the most recent date found in the database. Can be modified by `fullRefresh` and `startDate`.
 *       - **Incremental Update (Default)**:
 *         `/api/v1/db/update-wgo-skaters?action=all`
 *       - **Full Refresh of Current Season**:
 *         `/api/v1/db/update-wgo-skaters?action=all&fullRefresh=true`
 *
 *     - `action=all_seasons_full_refresh`:
 *       Triggers a comprehensive backfill of all statistics for every date of every season stored in the
 *       `seasons` table. This is a very long-running and data-intensive operation.
 *       - **Example**:
 *         `/api/v1/db/update-wgo-skaters?action=all_seasons_full_refresh`
 *
 *     - `action=season&season=YYYYYYYY`:
 *       Rebuilds one season, including playoffs, and skips calendar dates that
 *       the official NHL game index does not mark complete. Seven calendar days
 *       are fetched per NHL request batch, and optional `startDate`/`endDate`
 *       parameters make the run resumable.
 *       - **Example**:
 *         `/api/v1/db/update-wgo-skaters?action=season&season=20252026`
 *       - **Resume example**:
 *         `/api/v1/db/update-wgo-skaters?action=season&season=20252026&startDate=2026-01-19`
 *
 * 2.  `date`: Fetches and updates data for a single, specific date.
 *     - **Format**: YYYY-MM-DD
 *     - **Example**:
 *       `/api/v1/db/update-wgo-skaters?date=2023-10-25`
 *
 * 3.  `playerId`: Fetches a specific player's career stats for the current and previous season.
 *     This is primarily for debugging or targeted updates and does not write to the daily stats tables.
 *     - **Example**:
 *       `/api/v1/db/update-wgo-skaters?playerId=8478402&playerFullName=Connor%20McDavid`
 *
 * 4.  `fullRefresh` (Optional, Boolean): Modifies `action=all`.
 *     If `true` or `1`, the script ignores the most recent date in the database and re-fetches all data
 *     from the beginning of the current season.
 *     - **Example**:
 *       `/api/v1/db/update-wgo-skaters?action=all&fullRefresh=true`
 *
 * 5.  `startDate` (Optional, Date String): Modifies `action=all` or `action=season`.
 *     Overrides the automatic start date (which is either the day after the last record or the season start)
 *     with a specific date.
 *     - **Format**: YYYY-MM-DD
 *     - **Example**:
 *       `/api/v1/db/update-wgo-skaters?action=season&season=20252026&startDate=2026-01-19`
 *
 * 6.  `endDate` (Optional, Date String): Restricts `action=season` to a final
 *     date, allowing a season rebuild to be split into independently resumable
 *     ranges.
 *
 * 7.  `playerFullName` (Optional, String): Used for logging when `playerId` is specified.
 *     - **Example**:
 *       `/api/v1/db/update-wgo-skaters?playerId=8478402&playerFullName=Connor%20McDavid`
 */

import { NextApiRequest, NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";
import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import Fetch from "lib/cors-fetch";
import {
  format,
  parseISO,
  addDays,
  isBefore,
  formatISO,
  differenceInDays,
} from "date-fns"; // Added differenceInDays
import { getCurrentSeason } from "lib/NHL/server"; // Assuming this is your helper
import {
  createWgoDateFailure,
  createWgoDateOutcome,
  summarizeWgoDateOutcomes,
  WgoDateOutcome,
  WgoDateProcessingError,
} from "lib/cron/wgoDateOutcome";
import {
  fetchCompletedWgoSeasonGameDates,
  mapWgoRowsByPlayerId,
  mapWgoRowsByPlayerGame,
  parseWgoSeasonId,
  resolveWgoGameIdentity,
  wgoPlayerGameKey,
} from "lib/cron/wgoIngestion";
import {
  WGOSummarySkaterStat,
  WGOSkatersBio,
  WGORealtimeSkaterStat,
  WGOFaceoffSkaterStat,
  WGOFaceOffWinLossSkaterStat,
  WGOGoalsForAgainstSkaterStat,
  WGOPenaltySkaterStat,
  WGOPenaltyKillSkaterStat,
  WGOPowerPlaySkaterStat,
  WGOPuckPossessionSkaterStat,
  WGOSatCountSkaterStat,
  WGOSatPercentageSkaterStat,
  WGOScoringRatesSkaterStat,
  WGOScoringCountsSkaterStat,
  WGOShotTypeSkaterStat,
  WGOToiSkaterStat,
} from "lib/NHL/types";

// Types
interface NHLApiResponse {
  data: any[];
  total: number;
}

type RegularSeasonSkaterInsert =
  Database["public"]["Tables"]["wgo_skater_stats"]["Insert"];
type PlayoffSkaterInsert =
  Database["public"]["Tables"]["wgo_skater_stats_playoffs"]["Insert"];
type SkaterStatsTable = "wgo_skater_stats" | "wgo_skater_stats_playoffs";
type SkaterWriteBatch =
  | {
      tableName: "wgo_skater_stats";
      records: RegularSeasonSkaterInsert[];
    }
  | {
      tableName: "wgo_skater_stats_playoffs";
      records: PlayoffSkaterInsert[];
    };

type MaybeGameScoped<T> = T & { gameDate?: string; gameId?: number };

export type AllSkaterStats = {
  skaterStats: WGOSummarySkaterStat[];
  skatersBio: WGOSkatersBio[];
  miscSkaterStats: MaybeGameScoped<WGORealtimeSkaterStat>[];
  faceOffStats: MaybeGameScoped<WGOFaceoffSkaterStat>[];
  faceoffWinLossStats: MaybeGameScoped<WGOFaceOffWinLossSkaterStat>[];
  goalsForAgainstStats: MaybeGameScoped<WGOGoalsForAgainstSkaterStat>[];
  penaltiesStats: MaybeGameScoped<WGOPenaltySkaterStat>[];
  penaltyKillStats: MaybeGameScoped<WGOPenaltyKillSkaterStat>[];
  powerPlayStats: MaybeGameScoped<WGOPowerPlaySkaterStat>[];
  puckPossessionStats: MaybeGameScoped<WGOPuckPossessionSkaterStat>[];
  satCountsStats: MaybeGameScoped<WGOSatCountSkaterStat>[];
  satPercentagesStats: MaybeGameScoped<WGOSatPercentageSkaterStat>[];
  scoringRatesStats: MaybeGameScoped<WGOScoringRatesSkaterStat>[];
  scoringPerGameStats: MaybeGameScoped<WGOScoringCountsSkaterStat>[];
  shotTypeStats: MaybeGameScoped<WGOShotTypeSkaterStat>[];
  timeOnIceStats: MaybeGameScoped<WGOToiSkaterStat>[];
};

type GameScoped<T> = T & { gameDate?: string; gameId: number };

type DataMaps = {
  bioMap: Map<number, WGOSkatersBio>;
  miscMap: Map<string, GameScoped<WGORealtimeSkaterStat>>;
  faceOffMap: Map<string, GameScoped<WGOFaceoffSkaterStat>>;
  faceoffWinLossMap: Map<string, GameScoped<WGOFaceOffWinLossSkaterStat>>;
  goalsForAgainstMap: Map<string, GameScoped<WGOGoalsForAgainstSkaterStat>>;
  penaltiesMap: Map<string, GameScoped<WGOPenaltySkaterStat>>;
  penaltyKillMap: Map<string, GameScoped<WGOPenaltyKillSkaterStat>>;
  powerPlayMap: Map<string, GameScoped<WGOPowerPlaySkaterStat>>;
  puckPossessionMap: Map<string, GameScoped<WGOPuckPossessionSkaterStat>>;
  satCountsMap: Map<string, GameScoped<WGOSatCountSkaterStat>>;
  satPercentagesMap: Map<string, GameScoped<WGOSatPercentageSkaterStat>>;
  scoringRatesMap: Map<string, GameScoped<WGOScoringRatesSkaterStat>>;
  scoringPerGameMap: Map<string, GameScoped<WGOScoringCountsSkaterStat>>;
  shotTypeMap: Map<string, GameScoped<WGOShotTypeSkaterStat>>;
  timeOnIceMap: Map<string, GameScoped<WGOToiSkaterStat>>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseOptionalWgoDate(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return undefined;
  }
  const parsed = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === raw
    ? raw
    : undefined;
}

/**
 * Fetches season details from Supabase based on a specific date.
 * Correctly identifies if a date falls within regular season or playoffs of a given season.
 * @param dateString - The date string in 'YYYY-MM-DD' format.
 * @returns A Promise resolving to the season info object or null if not found/error.
 */
async function getSeasonFromDate(dateString: string): Promise<{
  seasonId: number;
  startDate: string;
  endDate: string;
  regularSeasonEndDate: string;
} | null> {
  try {
    const targetDate = parseISO(dateString);

    // First, try to find a season where the targetDate falls within its overall period (start to end, including playoffs)
    const { data: containingSeason, error: containingSeasonError } =
      await supabase
        .from("seasons")
        .select("id, startDate, endDate, regularSeasonEndDate")
        .lte("startDate", dateString)
        .gte("endDate", dateString) // Check against season's actual end date (includes playoffs)
        .single();

    if (containingSeason && !containingSeasonError) {
      // Found a direct match - date falls within a season's full duration (regular or playoffs)
      return {
        seasonId: Number(containingSeason.id),
        startDate: containingSeason.startDate,
        endDate: containingSeason.endDate,
        regularSeasonEndDate: containingSeason.regularSeasonEndDate,
      };
    }

    // If no direct match (likely offseason or date before first season/after last season), use smart logic
    console.log(
      `Date ${dateString} does not directly fall within a known season's active period. Using smart season detection...`,
    );

    // Fetch all seasons to determine which one this date most likely belongs to
    const { data: allSeasons, error: seasonsError } = await supabase
      .from("seasons")
      .select("id, startDate, endDate, regularSeasonEndDate")
      .order("id", { ascending: false }); // Most recent first

    if (seasonsError || !allSeasons || allSeasons.length === 0) {
      console.error(
        "Could not fetch seasons for smart detection:",
        seasonsError?.message,
      );
      return null;
    }

    for (let i = 0; i < allSeasons.length; i++) {
      const currentSeason = allSeasons[i];
      const nextSeason = allSeasons[i - 1]; // Next season (more recent) if exists

      const seasonStart = parseISO(currentSeason.startDate);
      const seasonEnd = parseISO(currentSeason.endDate); // Use seasonEndDate for overall season boundary

      // If targetDate is after the current season's overall end date, it might be in the offseason before this season
      // or we need to consider the next season.
      if (isBefore(targetDate, seasonStart)) {
        // If the date is before this season starts, it must belong to an earlier period. Continue iterating.
        // Unless it's before the *first* season we have, in which case there's no data.
        continue;
      }

      // If targetDate is within the bounds of this season (including playoffs)
      if (
        isBefore(targetDate, seasonEnd) ||
        targetDate.toDateString() === seasonEnd.toDateString()
      ) {
        console.log(
          `Smart detection: Date ${dateString} falls within season ${currentSeason.id} (including playoffs).`,
        );
        return {
          seasonId: Number(currentSeason.id),
          startDate: currentSeason.startDate,
          endDate: currentSeason.endDate,
          regularSeasonEndDate: currentSeason.regularSeasonEndDate,
        };
      }

      // If targetDate is after the current season's overall end date (seasonEnd)
      if (isBefore(seasonEnd, targetDate)) {
        if (nextSeason) {
          const nextSeasonStart = parseISO(nextSeason.startDate);
          // If date is between current season's end and next season's start (true offseason)
          if (isBefore(targetDate, nextSeasonStart)) {
            console.log(
              `Smart detection: Date ${dateString} is in offseason between season ${currentSeason.id} and ${nextSeason.id}. Using upcoming season ${nextSeason.id} for context.`,
            );
            return {
              seasonId: Number(nextSeason.id),
              startDate: nextSeason.startDate,
              endDate: nextSeason.endDate,
              regularSeasonEndDate: nextSeason.regularSeasonEndDate,
            };
          }
        } else {
          const monthsAfterSeason =
            (targetDate.getTime() - seasonEnd.getTime()) /
            (1000 * 60 * 60 * 24 * 30.44);
          if (monthsAfterSeason <= 6) {
            // Within 6 months after the last season ended
            console.log(
              `Smart detection: Date ${dateString} is in recent offseason after latest season ${currentSeason.id}. Using completed season ${currentSeason.id} for context.`,
            );
            return {
              seasonId: Number(currentSeason.id),
              startDate: currentSeason.startDate,
              endDate: currentSeason.endDate,
              regularSeasonEndDate: currentSeason.regularSeasonEndDate,
            };
          }
        }
      }
    }

    // If we get here, we couldn't determine an appropriate season
    console.warn(
      `Could not determine appropriate season for date: ${dateString}`,
    );
    return null;
  } catch (err: any) {
    console.error(
      `Unexpected error in getSeasonFromDate for ${dateString}:`,
      err.message,
    );
    return null;
  }
}

function removeUndefinedProperties<T extends object>(record: T): T {
  for (const key in record) {
    if (record[key] === undefined) {
      delete record[key];
    }
  }
  return record;
}

function toOptionalText(
  value: number | null | undefined,
): string | null | undefined {
  return value == null ? value : String(value);
}

function mapApiDataToDbRecord(
  stat: WGOSummarySkaterStat,
  allData: DataMaps,
  formattedDate: string,
  seasonId: number | undefined,
  tableName: "wgo_skater_stats",
): RegularSeasonSkaterInsert;
function mapApiDataToDbRecord(
  stat: WGOSummarySkaterStat,
  allData: DataMaps,
  formattedDate: string,
  seasonId: number | undefined,
  tableName: "wgo_skater_stats_playoffs",
): PlayoffSkaterInsert;
function mapApiDataToDbRecord(
  stat: WGOSummarySkaterStat,
  allData: DataMaps,
  formattedDate: string,
  seasonId?: number,
  tableName: SkaterStatsTable = "wgo_skater_stats",
): RegularSeasonSkaterInsert | PlayoffSkaterInsert {
  if (!seasonId) {
    throw new Error("A season ID is required for a WGO skater game row.");
  }
  const expectedGameType = tableName === "wgo_skater_stats" ? 2 : 3;
  const gameIdentity = resolveWgoGameIdentity({
    row: stat,
    expectedDate: formattedDate,
    expectedSeasonId: seasonId,
    allowedGameTypes: [expectedGameType],
    source: "skater summary",
  });
  const playerGameKey = wgoPlayerGameKey(stat, "skater summary");
  const bioStats = allData.bioMap.get(stat.playerId);
  const miscStats = allData.miscMap.get(playerGameKey);
  const faceOffStat = allData.faceOffMap.get(playerGameKey);
  const faceoffWinLossStat = allData.faceoffWinLossMap.get(playerGameKey);
  const goalsForAgainstStat = allData.goalsForAgainstMap.get(playerGameKey);
  const penaltiesStat = allData.penaltiesMap.get(playerGameKey);
  const penaltyKillStat = allData.penaltyKillMap.get(playerGameKey);
  const powerPlayStat = allData.powerPlayMap.get(playerGameKey);
  const puckPossessionStat = allData.puckPossessionMap.get(playerGameKey);
  const satCountsStat = allData.satCountsMap.get(playerGameKey);
  const satPercentagesStat = allData.satPercentagesMap.get(playerGameKey);
  const scoringRatesStat = allData.scoringRatesMap.get(playerGameKey);
  const scoringPerGameStat = allData.scoringPerGameMap.get(playerGameKey);
  const shotTypeStat = allData.shotTypeMap.get(playerGameKey);
  const timeOnIceStat = allData.timeOnIceMap.get(playerGameKey);

  const regularSeasonRecord = {
    player_id: stat.playerId,
    player_name: stat.skaterFullName,
    date: formattedDate,
    shoots_catches: stat.shootsCatches,
    position_code: stat.positionCode,
    games_played: stat.gamesPlayed,
    points: stat.points,
    points_per_game: stat.pointsPerGame,
    goals: stat.goals,
    assists: stat.assists,
    shots: stat.shots,
    shooting_percentage: stat.shootingPct,
    plus_minus: stat.plusMinus,
    ot_goals: stat.otGoals,
    gw_goals: stat.gameWinningGoals,
    pp_points: stat.ppPoints,
    fow_percentage: stat.faceoffWinPct,
    toi_per_game: stat.timeOnIcePerGame,
    team_abbrev: stat.teamAbbrev,
    game_id: gameIdentity.gameId,
    opponent_team_abbrev: stat.opponentTeamAbbrev,
    home_road: stat.homeRoad,
    ev_goals: stat.evGoals,
    ev_points: stat.evPoints,
    birth_date: bioStats?.birthDate,
    current_team_abbreviation: bioStats?.currentTeamAbbrev,
    current_team_name: bioStats?.currentTeamName,
    birth_city: bioStats?.birthCity,
    birth_country: bioStats?.birthCountryCode,
    height: bioStats?.height,
    weight: bioStats?.weight,
    draft_year: bioStats?.draftYear,
    draft_round: bioStats?.draftRound,
    draft_overall: bioStats?.draftOverall,
    first_season_for_game_type: bioStats?.firstSeasonForGameType,
    nationality_code: bioStats?.nationalityCode,
    blocked_shots: miscStats?.blockedShots,
    blocks_per_60: miscStats?.blockedShotsPer60,
    empty_net_assists: miscStats?.emptyNetAssists,
    empty_net_goals: miscStats?.emptyNetGoals,
    empty_net_points: miscStats?.emptyNetPoints,
    first_goals: miscStats?.firstGoals,
    giveaways: miscStats?.giveaways,
    giveaways_per_60: miscStats?.giveawaysPer60,
    hits: miscStats?.hits,
    hits_per_60: miscStats?.hitsPer60,
    missed_shot_crossbar: miscStats?.missedShotCrossbar,
    missed_shot_goal_post: miscStats?.missedShotGoalpost,
    missed_shot_over_net: miscStats?.missedShotOverNet,
    missed_shot_short_side: miscStats?.missedShotShort,
    missed_shot_wide_of_net: miscStats?.missedShotWideOfNet,
    missed_shots: miscStats?.missedShots,
    takeaways: miscStats?.takeaways,
    takeaways_per_60: miscStats?.takeawaysPer60,
    d_zone_fo_percentage: faceOffStat?.defensiveZoneFaceoffPct,
    d_zone_faceoffs: faceOffStat?.defensiveZoneFaceoffs,
    ev_faceoff_percentage: faceOffStat?.evFaceoffPct,
    ev_faceoffs: faceOffStat?.evFaceoffs,
    n_zone_fo_percentage: faceOffStat?.neutralZoneFaceoffPct,
    n_zone_faceoffs: faceOffStat?.neutralZoneFaceoffs,
    o_zone_fo_percentage: faceOffStat?.offensiveZoneFaceoffPct,
    o_zone_faceoffs: faceOffStat?.offensiveZoneFaceoffs,
    pp_faceoff_percentage: faceOffStat?.ppFaceoffPct,
    pp_faceoffs: faceOffStat?.ppFaceoffs,
    sh_faceoff_percentage: faceOffStat?.shFaceoffPct,
    sh_faceoffs: faceOffStat?.shFaceoffs,
    total_faceoffs: faceOffStat?.totalFaceoffs,
    d_zone_fol: faceoffWinLossStat?.defensiveZoneFaceoffLosses,
    d_zone_fow: faceoffWinLossStat?.defensiveZoneFaceoffWins,
    ev_fol: faceoffWinLossStat?.evFaceoffsLost,
    ev_fow: faceoffWinLossStat?.evFaceoffsWon,
    n_zone_fol: faceoffWinLossStat?.neutralZoneFaceoffLosses,
    n_zone_fow: faceoffWinLossStat?.neutralZoneFaceoffWins,
    o_zone_fol: faceoffWinLossStat?.offensiveZoneFaceoffLosses,
    o_zone_fow: faceoffWinLossStat?.offensiveZoneFaceoffWins,
    pp_fol: faceoffWinLossStat?.ppFaceoffsLost,
    pp_fow: faceoffWinLossStat?.ppFaceoffsWon,
    sh_fol: faceoffWinLossStat?.shFaceoffsLost,
    sh_fow: faceoffWinLossStat?.shFaceoffsWon,
    total_fol: faceoffWinLossStat?.totalFaceoffLosses,
    total_fow: faceoffWinLossStat?.totalFaceoffWins,
    es_goal_diff: goalsForAgainstStat?.evenStrengthGoalDifference,
    es_goals_against: goalsForAgainstStat?.evenStrengthGoalsAgainst,
    es_goals_for: goalsForAgainstStat?.evenStrengthGoalsFor,
    es_goals_for_percentage: goalsForAgainstStat?.evenStrengthGoalsForPct,
    es_toi_per_game: goalsForAgainstStat?.evenStrengthTimeOnIcePerGame,
    pp_goals_against: goalsForAgainstStat?.powerPlayGoalsAgainst,
    pp_goals_for: goalsForAgainstStat?.powerPlayGoalFor,
    pp_toi_per_game: goalsForAgainstStat?.powerPlayTimeOnIcePerGame,
    sh_goals_against: goalsForAgainstStat?.shortHandedGoalsAgainst,
    sh_goals_for: goalsForAgainstStat?.shortHandedGoalsFor,
    sh_toi_per_game: goalsForAgainstStat?.shortHandedTimeOnIcePerGame,
    game_misconduct_penalties: penaltiesStat?.gameMisconductPenalties,
    major_penalties: penaltiesStat?.majorPenalties,
    match_penalties: penaltiesStat?.matchPenalties,
    minor_penalties: penaltiesStat?.minorPenalties,
    misconduct_penalties: penaltiesStat?.misconductPenalties,
    net_penalties: penaltiesStat?.netPenalties,
    net_penalties_per_60: penaltiesStat?.netPenaltiesPer60,
    penalties: penaltiesStat?.penalties,
    penalties_drawn: penaltiesStat?.penaltiesDrawn,
    penalties_drawn_per_60: penaltiesStat?.penaltiesDrawnPer60,
    penalties_taken_per_60: penaltiesStat?.penaltiesTakenPer60,
    penalty_minutes: penaltiesStat?.penaltyMinutes,
    penalty_minutes_per_toi: penaltiesStat?.penaltyMinutesPerTimeOnIce,
    penalty_seconds_per_game: penaltiesStat?.penaltySecondsPerGame,
    pp_goals_against_per_60: penaltyKillStat?.ppGoalsAgainstPer60,
    sh_assists: penaltyKillStat?.shAssists,
    sh_goals: penaltyKillStat?.shGoals,
    sh_points: penaltyKillStat?.shPoints,
    sh_goals_per_60: penaltyKillStat?.shGoalsPer60,
    sh_individual_sat_for: penaltyKillStat?.shIndividualSatFor,
    sh_individual_sat_per_60: penaltyKillStat?.shIndividualSatForPer60,
    sh_points_per_60: penaltyKillStat?.shPointsPer60,
    sh_primary_assists: penaltyKillStat?.shPrimaryAssists,
    sh_primary_assists_per_60: penaltyKillStat?.shPrimaryAssistsPer60,
    sh_secondary_assists: penaltyKillStat?.shSecondaryAssists,
    sh_secondary_assists_per_60: penaltyKillStat?.shSecondaryAssistsPer60,
    sh_shooting_percentage: penaltyKillStat?.shShootingPct,
    sh_shots: penaltyKillStat?.shShots,
    sh_shots_per_60: penaltyKillStat?.shShotsPer60,
    sh_time_on_ice: penaltyKillStat?.shTimeOnIce,
    sh_time_on_ice_pct_per_game: penaltyKillStat?.shTimeOnIcePctPerGame,
    pp_assists: powerPlayStat?.ppAssists,
    pp_goals: powerPlayStat?.ppGoals,
    pp_goals_for_per_60: powerPlayStat?.ppGoalsForPer60,
    pp_goals_per_60: powerPlayStat?.ppGoalsPer60,
    pp_individual_sat_for: powerPlayStat?.ppIndividualSatFor,
    pp_individual_sat_per_60: powerPlayStat?.ppIndividualSatForPer60, // ppIndividualSatForPer60 fix, misspelled. Was ppIndividualSatPer60
    pp_points_per_60: powerPlayStat?.ppPointsPer60,
    pp_primary_assists: powerPlayStat?.ppPrimaryAssists,
    pp_primary_assists_per_60: powerPlayStat?.ppPrimaryAssistsPer60,
    pp_secondary_assists: powerPlayStat?.ppSecondaryAssists,
    pp_secondary_assists_per_60: powerPlayStat?.ppSecondaryAssistsPer60,
    pp_shooting_percentage: powerPlayStat?.ppShootingPct,
    pp_shots: powerPlayStat?.ppShots,
    pp_shots_per_60: powerPlayStat?.ppShotsPer60,
    pp_toi: powerPlayStat?.ppTimeOnIce,
    pp_toi_pct_per_game: powerPlayStat?.ppTimeOnIcePctPerGame,
    goals_pct: puckPossessionStat?.goalsPct,
    faceoff_pct_5v5: puckPossessionStat?.faceoffPct5v5,
    individual_sat_for_per_60: puckPossessionStat?.individualSatForPer60,
    individual_shots_for_per_60: puckPossessionStat?.individualShotsForPer60,
    on_ice_shooting_pct: puckPossessionStat?.onIceShootingPct,
    sat_pct: puckPossessionStat?.satPct,
    toi_per_game_5v5: puckPossessionStat?.timeOnIcePerGame5v5,
    usat_pct: puckPossessionStat?.usatPct,
    zone_start_pct:
      puckPossessionStat?.offensiveZoneStartRatio ??
      puckPossessionStat?.zoneStartPct,
    sat_against: satCountsStat?.satAgainst,
    sat_ahead: satCountsStat?.satAhead,
    sat_behind: satCountsStat?.satBehind,
    sat_close: satCountsStat?.satClose,
    sat_for: satCountsStat?.satFor,
    sat_tied: satCountsStat?.satTied,
    sat_total: satCountsStat?.satTotal,
    usat_against: satCountsStat?.usatAgainst,
    usat_ahead: satCountsStat?.usatAhead,
    usat_behind: satCountsStat?.usatBehind,
    usat_close: satCountsStat?.usatClose,
    usat_for: satCountsStat?.usatFor,
    usat_tied: satCountsStat?.usatTied,
    usat_total: satCountsStat?.usatTotal,
    sat_percentage: satPercentagesStat?.satPercentage,
    sat_percentage_ahead: satPercentagesStat?.satPercentageAhead,
    sat_percentage_behind: satPercentagesStat?.satPercentageBehind,
    sat_percentage_close: satPercentagesStat?.satPercentageClose,
    sat_percentage_tied: satPercentagesStat?.satPercentageTied,
    sat_relative: satPercentagesStat?.satRelative,
    shooting_percentage_5v5: satPercentagesStat?.shootingPct5v5,
    skater_save_pct_5v5: satPercentagesStat?.skaterSavePct5v5,
    skater_shooting_plus_save_pct_5v5:
      satPercentagesStat?.skaterShootingPlusSavePct5v5,
    usat_percentage: satPercentagesStat?.usatPercentage,
    usat_percentage_ahead: satPercentagesStat?.usatPercentageAhead,
    usat_percentage_behind: satPercentagesStat?.usatPercentageBehind,
    usat_percentage_close: satPercentagesStat?.usatPrecentageClose,
    usat_percentage_tied: satPercentagesStat?.usatPercentageTied,
    usat_relative: satPercentagesStat?.usatRelative,
    zone_start_pct_5v5: satPercentagesStat?.zoneStartPct5v5,
    assists_5v5: scoringRatesStat?.assists5v5,
    assists_per_60_5v5: scoringRatesStat?.assistsPer605v5,
    goals_5v5: scoringRatesStat?.goals5v5,
    goals_per_60_5v5: scoringRatesStat?.goalsPer605v5,
    net_minor_penalties_per_60: scoringRatesStat?.netMinorPenaltiesPer60,
    o_zone_start_pct_5v5: scoringRatesStat?.offensiveZoneStartPct5v5,
    on_ice_shooting_pct_5v5: scoringRatesStat?.onIceShootingPct5v5,
    points_5v5: scoringRatesStat?.points5v5,
    points_per_60_5v5: scoringRatesStat?.pointsPer605v5,
    primary_assists_5v5: scoringRatesStat?.primaryAssists5v5,
    primary_assists_per_60_5v5: scoringRatesStat?.primaryAssistsPer605v5,
    sat_relative_5v5: scoringRatesStat?.satRelative5v5,
    secondary_assists_5v5: scoringRatesStat?.secondaryAssists5v5,
    secondary_assists_per_60_5v5: scoringRatesStat?.secondaryAssistsPer605v5,
    assists_per_game: scoringPerGameStat?.assistsPerGame,
    blocks_per_game: scoringPerGameStat?.blocksPerGame,
    goals_per_game: scoringPerGameStat?.goalsPerGame,
    hits_per_game: scoringPerGameStat?.hitsPerGame,
    penalty_minutes_per_game: scoringPerGameStat?.penaltyMinutesPerGame,
    primary_assists_per_game: scoringPerGameStat?.primaryAssistsPerGame,
    secondary_assists_per_game: scoringPerGameStat?.secondaryAssistsPerGame,
    shots_per_game: scoringPerGameStat?.shotsPerGame,
    total_primary_assists: scoringPerGameStat?.totalPrimaryAssists,
    total_secondary_assists: scoringPerGameStat?.totalSecondaryAssists,
    goals_backhand: shotTypeStat?.goalsBackhand,
    goals_bat: shotTypeStat?.goalsBat,
    goals_between_legs: shotTypeStat?.goalsBetweenLegs,
    goals_cradle: shotTypeStat?.goalsCradle,
    goals_deflected: shotTypeStat?.goalsDeflected,
    goals_poke: shotTypeStat?.goalsPoke,
    goals_slap: shotTypeStat?.goalsSlap,
    goals_snap: shotTypeStat?.goalsSnap,
    goals_tip_in: shotTypeStat?.goalsTipIn,
    goals_wrap_around: shotTypeStat?.goalsWrapAround,
    goals_wrist: shotTypeStat?.goalsWrist,
    shooting_pct_backhand: shotTypeStat?.shootingPctBackhand,
    shooting_pct_bat: shotTypeStat?.shootingPctBat,
    shooting_pct_between_legs: shotTypeStat?.shootingPctBetweenLegs,
    shooting_pct_cradle: shotTypeStat?.shootingPctCradle,
    shooting_pct_deflected: shotTypeStat?.shootingPctDeflected,
    shooting_pct_poke: shotTypeStat?.shootingPctPoke,
    shooting_pct_slap: shotTypeStat?.shootingPctSlap,
    shooting_pct_snap: shotTypeStat?.shootingPctSnap,
    shooting_pct_tip_in: shotTypeStat?.shootingPctTipIn,
    shooting_pct_wrap_around: shotTypeStat?.shootingPctWrapAround,
    shooting_pct_wrist: shotTypeStat?.shootingPctWrist,
    shots_on_net_backhand: shotTypeStat?.shotsOnNetBackhand,
    shots_on_net_bat: shotTypeStat?.shotsOnNetBat,
    shots_on_net_between_legs: shotTypeStat?.shotsOnNetBetweenLegs,
    shots_on_net_cradle: shotTypeStat?.shotsOnNetCradle,
    shots_on_net_deflected: shotTypeStat?.shotsOnNetDeflected,
    shots_on_net_poke: shotTypeStat?.shotsOnNetPoke,
    shots_on_net_slap: shotTypeStat?.shotsOnNetSlap,
    shots_on_net_snap: shotTypeStat?.shotsOnNetSnap,
    shots_on_net_tip_in: shotTypeStat?.shotsOnNetTipIn,
    shots_on_net_wrap_around: shotTypeStat?.shotsOnNetWrapAround,
    shots_on_net_wrist: shotTypeStat?.shotsOnNetWrist,
    ev_time_on_ice: timeOnIceStat?.evTimeOnIce,
    ev_time_on_ice_per_game: timeOnIceStat?.evTimeOnIcePerGame,
    ot_time_on_ice: timeOnIceStat?.otTimeOnIce,
    ot_time_on_ice_per_game: timeOnIceStat?.otTimeOnIcePerOtGame,
    shifts: timeOnIceStat?.shifts,
    shifts_per_game: timeOnIceStat?.shiftsPerGame,
    time_on_ice_per_shift: timeOnIceStat?.timeOnIcePerShift,
    season_id: gameIdentity.seasonId,
  } satisfies RegularSeasonSkaterInsert;

  if (tableName === "wgo_skater_stats") {
    return removeUndefinedProperties(regularSeasonRecord);
  }

  const playoffRecord = {
    ...regularSeasonRecord,
    es_toi_per_game: toOptionalText(regularSeasonRecord.es_toi_per_game),
    ev_time_on_ice: toOptionalText(regularSeasonRecord.ev_time_on_ice),
    ev_time_on_ice_per_game: toOptionalText(
      regularSeasonRecord.ev_time_on_ice_per_game,
    ),
    ot_time_on_ice: toOptionalText(regularSeasonRecord.ot_time_on_ice),
    ot_time_on_ice_per_game: toOptionalText(
      regularSeasonRecord.ot_time_on_ice_per_game,
    ),
    pp_toi: toOptionalText(regularSeasonRecord.pp_toi),
    pp_toi_per_game: toOptionalText(regularSeasonRecord.pp_toi_per_game),
    sh_time_on_ice: toOptionalText(regularSeasonRecord.sh_time_on_ice),
    sh_toi_per_game: toOptionalText(regularSeasonRecord.sh_toi_per_game),
    time_on_ice_per_shift: toOptionalText(
      regularSeasonRecord.time_on_ice_per_shift,
    ),
    toi_per_game_5v5: toOptionalText(regularSeasonRecord.toi_per_game_5v5),
  } satisfies PlayoffSkaterInsert;

  return removeUndefinedProperties(playoffRecord);
}

export async function fetchDataForGameType(
  gameTypeId: number,
  formattedEndDate: string,
  limit: number = -1,
  formattedStartDate: string = formattedEndDate,
): Promise<AllSkaterStats> {
  const fetchJsonWithDiagnostics = async (
    url: string,
    label: string,
  ): Promise<NHLApiResponse> => {
    const response = await Fetch(url);
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok || !contentType.includes("application/json")) {
      const bodyPreview = (await response.text()).slice(0, 200);
      throw new WgoDateProcessingError(
        "source_failure",
        `NHL API non-JSON response for ${label} (${response.status} ${response.statusText}). ` +
          `content-type=${contentType}. body="${bodyPreview}"`,
      );
    }

    const payload = (await response.json()) as Partial<NHLApiResponse>;
    if (!Array.isArray(payload.data) || !Number.isSafeInteger(payload.total)) {
      throw new WgoDateProcessingError(
        "source_failure",
        `NHL API returned an invalid response contract for ${label}.`,
      );
    }
    return payload as NHLApiResponse;
  };
  const fetchJsonWithRetry = async (
    url: string,
    label: string,
    maxRetries: number = 3,
  ): Promise<NHLApiResponse> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fetchJsonWithDiagnostics(url, label);
      } catch (error: any) {
        const message = String(error?.message || "");
        const isRateLimit =
          message.includes(" 429 ") ||
          message.includes("429 Too Many Requests");
        if (!isRateLimit || attempt === maxRetries) {
          if (error instanceof WgoDateProcessingError) {
            throw error;
          }
          throw new WgoDateProcessingError(
            "source_failure",
            `NHL API request failed for ${label}: ${message || String(error)}`,
            { cause: error },
          );
        }
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await sleep(backoffMs);
      }
    }
    throw new WgoDateProcessingError(
      "source_failure",
      `NHL API retry exhausted for ${label}`,
    );
  };
  let start = 0;
  let moreDataAvailable = true;
  const allData: AllSkaterStats = {
    skaterStats: [],
    skatersBio: [],
    miscSkaterStats: [],
    faceOffStats: [],
    faceoffWinLossStats: [],
    goalsForAgainstStats: [],
    penaltiesStats: [],
    penaltyKillStats: [],
    powerPlayStats: [],
    puckPossessionStats: [],
    satCountsStats: [],
    satPercentagesStats: [],
    scoringRatesStats: [],
    scoringPerGameStats: [],
    shotTypeStats: [],
    timeOnIceStats: [],
  };
  const getUrl = (
    reportName: string,
    sort: string,
    factCayenneExp: string = "gamesPlayed>=1",
  ) =>
    `https://api.nhle.com/stats/rest/en/skater/${reportName}?isAggregate=false&isGame=true&sort=${encodeURIComponent(sort)}&start=${start}&limit=${limit}&factCayenneExp=${factCayenneExp}&cayenneExp=gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedStartDate}%22%20and%20gameTypeId=${gameTypeId}`;
  while (moreDataAvailable) {
    const urls = {
      skaterStats: getUrl(
        "summary",
        '[{"property":"points","direction":"DESC"},{"property":"goals","direction":"DESC"},{"property":"assists","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      skatersBio: getUrl(
        "bios",
        '[{"property":"lastName","direction":"ASC_CI"},{"property":"skaterFullName","direction":"ASC_CI"},{"property":"playerId","direction":"ASC"}]',
        "",
      ),
      miscSkaterStats: getUrl(
        "realtime",
        '[{"property":"hits","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      faceOffStats: getUrl(
        "faceoffpercentages",
        '[{"property":"totalFaceoffs","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      faceoffWinLossStats: getUrl(
        "faceoffwins",
        '[{"property":"totalFaceoffWins","direction":"DESC"},{"property":"faceoffWinPct","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      goalsForAgainstStats: getUrl(
        "goalsForAgainst",
        '[{"property":"evenStrengthGoalDifference","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      penaltiesStats: getUrl(
        "penalties",
        '[{"property":"penaltyMinutes","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      penaltyKillStats: getUrl(
        "penaltykill",
        '[{"property":"shTimeOnIce","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      powerPlayStats: getUrl(
        "powerplay",
        '[{"property":"ppTimeOnIce","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      puckPossessionStats: getUrl(
        "puckPossessions",
        '[{"property":"satPct","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      satCountsStats: getUrl(
        "summaryshooting",
        '[{"property":"satTotal","direction":"DESC"},{"property":"usatTotal","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      satPercentagesStats: getUrl(
        "percentages",
        '[{"property":"satPercentage","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      scoringRatesStats: getUrl(
        "scoringRates",
        '[{"property":"pointsPer605v5","direction":"DESC"},{"property":"goalsPer605v5","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      scoringPerGameStats: getUrl(
        "scoringpergame",
        '[{"property":"pointsPerGame","direction":"DESC"},{"property":"goalsPerGame","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      shotTypeStats: getUrl(
        "shottype",
        '[{"property":"shootingPct","direction":"DESC"},{"property":"shootingPctBat","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
      timeOnIceStats: getUrl(
        "timeonice",
        '[{"property":"timeOnIce","direction":"DESC"},{"property":"playerId","direction":"ASC"}]',
      ),
    };
    const NHL_REQUEST_CONCURRENCY = 4;
    const NHL_BATCH_DELAY_MS = 250;
    const entries = Object.entries(urls);
    const responses: NHLApiResponse[] = [];
    for (let i = 0; i < entries.length; i += NHL_REQUEST_CONCURRENCY) {
      const batch = entries.slice(i, i + NHL_REQUEST_CONCURRENCY);
      const batchResponses = await Promise.all(
        batch.map(([label, url]) => fetchJsonWithRetry(url, label)),
      );
      responses.push(...batchResponses);
      if (i + NHL_REQUEST_CONCURRENCY < entries.length) {
        await sleep(NHL_BATCH_DELAY_MS);
      }
    }
    const [
      skaterStatsResponse,
      bioStatsResponse,
      miscSkaterStatsResponse,
      faceOffStatsResponse,
      faceoffWinLossResponse,
      goalsForAgainstResponse,
      penaltiesResponse,
      penaltyKillResponse,
      powerPlayResponse,
      puckPossessionResponse,
      satCountsResponse,
      satPercentagesResponse,
      scoringRatesResponse,
      scoringPerGameResponse,
      shotTypeResponse,
      timeOnIceResponse,
    ] = responses;
    if (limit <= 0) {
      for (let index = 0; index < responses.length; index++) {
        const [label] = entries[index];
        const response = responses[index];
        if (response.total >= 9_000) {
          throw new WgoDateProcessingError(
            "source_failure",
            `NHL API returned ${response.total} ${label} rows for ${formattedStartDate} through ${formattedEndDate}; refusing a potentially capped response.`,
          );
        }
        if (response.data.length !== response.total) {
          throw new WgoDateProcessingError(
            "source_failure",
            `NHL API returned ${response.data.length}/${response.total} ${label} rows for ${formattedStartDate} through ${formattedEndDate}.`,
          );
        }
      }
    }
    allData.skaterStats.push(...skaterStatsResponse.data);
    allData.skatersBio.push(...bioStatsResponse.data);
    allData.miscSkaterStats.push(...miscSkaterStatsResponse.data);
    allData.faceOffStats.push(...faceOffStatsResponse.data);
    allData.faceoffWinLossStats.push(...faceoffWinLossResponse.data);
    allData.goalsForAgainstStats.push(...goalsForAgainstResponse.data);
    allData.penaltiesStats.push(...penaltiesResponse.data);
    allData.penaltyKillStats.push(...penaltyKillResponse.data);
    allData.powerPlayStats.push(...powerPlayResponse.data);
    allData.puckPossessionStats.push(...puckPossessionResponse.data);
    allData.satCountsStats.push(...satCountsResponse.data);
    allData.satPercentagesStats.push(...satPercentagesResponse.data);
    allData.scoringRatesStats.push(...scoringRatesResponse.data);
    allData.scoringPerGameStats.push(...scoringPerGameResponse.data);
    allData.shotTypeStats.push(...shotTypeResponse.data);
    allData.timeOnIceStats.push(...timeOnIceResponse.data);
    moreDataAvailable =
      limit > 0 && responses.some((res) => res.data.length === limit);
    if (limit > 0) {
      start += limit;
    }
  }
  return allData;
}

export async function processAndUpsertGameTypeData(
  allData: AllSkaterStats,
  tableName: SkaterStatsTable,
  formattedDate: string,
  seasonId: number,
): Promise<number> {
  // Early exit if no skater stats data
  if (allData.skaterStats.length === 0) {
    console.log(
      `No skater stats data found for ${formattedDate} in ${tableName}, skipping...`,
    );
    return 0;
  }

  mapWgoRowsByPlayerGame(
    allData.skaterStats as GameScoped<WGOSummarySkaterStat>[],
    "skater summary",
  );

  const dataMaps: DataMaps = {
    bioMap: mapWgoRowsByPlayerId(allData.skatersBio, "skater bios"),
    miscMap: mapWgoRowsByPlayerGame(
      allData.miscSkaterStats as GameScoped<WGORealtimeSkaterStat>[],
      "skater realtime",
    ),
    faceOffMap: mapWgoRowsByPlayerGame(
      allData.faceOffStats as GameScoped<WGOFaceoffSkaterStat>[],
      "skater faceoff percentages",
    ),
    faceoffWinLossMap: mapWgoRowsByPlayerGame(
      allData.faceoffWinLossStats as GameScoped<WGOFaceOffWinLossSkaterStat>[],
      "skater faceoff wins",
    ),
    goalsForAgainstMap: mapWgoRowsByPlayerGame(
      allData.goalsForAgainstStats as GameScoped<WGOGoalsForAgainstSkaterStat>[],
      "skater goals for/against",
    ),
    penaltiesMap: mapWgoRowsByPlayerGame(
      allData.penaltiesStats as GameScoped<WGOPenaltySkaterStat>[],
      "skater penalties",
    ),
    penaltyKillMap: mapWgoRowsByPlayerGame(
      allData.penaltyKillStats as GameScoped<WGOPenaltyKillSkaterStat>[],
      "skater penalty kill",
    ),
    powerPlayMap: mapWgoRowsByPlayerGame(
      allData.powerPlayStats as GameScoped<WGOPowerPlaySkaterStat>[],
      "skater power play",
    ),
    puckPossessionMap: mapWgoRowsByPlayerGame(
      allData.puckPossessionStats as GameScoped<WGOPuckPossessionSkaterStat>[],
      "skater puck possessions",
    ),
    satCountsMap: mapWgoRowsByPlayerGame(
      allData.satCountsStats as GameScoped<WGOSatCountSkaterStat>[],
      "skater shooting counts",
    ),
    satPercentagesMap: mapWgoRowsByPlayerGame(
      allData.satPercentagesStats as GameScoped<WGOSatPercentageSkaterStat>[],
      "skater percentages",
    ),
    scoringRatesMap: mapWgoRowsByPlayerGame(
      allData.scoringRatesStats as GameScoped<WGOScoringRatesSkaterStat>[],
      "skater scoring rates",
    ),
    scoringPerGameMap: mapWgoRowsByPlayerGame(
      allData.scoringPerGameStats as GameScoped<WGOScoringCountsSkaterStat>[],
      "skater scoring per game",
    ),
    shotTypeMap: mapWgoRowsByPlayerGame(
      allData.shotTypeStats as GameScoped<WGOShotTypeSkaterStat>[],
      "skater shot type",
    ),
    timeOnIceMap: mapWgoRowsByPlayerGame(
      allData.timeOnIceStats as GameScoped<WGOToiSkaterStat>[],
      "skater time on ice",
    ),
  };

  let writeBatch: SkaterWriteBatch;
  try {
    writeBatch =
      tableName === "wgo_skater_stats"
        ? {
            tableName,
            records: allData.skaterStats.map((stat) =>
              mapApiDataToDbRecord(
                stat,
                dataMaps,
                formattedDate,
                seasonId,
                tableName,
              ),
            ),
          }
        : {
            tableName,
            records: allData.skaterStats.map((stat) =>
              mapApiDataToDbRecord(
                stat,
                dataMaps,
                formattedDate,
                seasonId,
                tableName,
              ),
            ),
          };
  } catch (error) {
    throw new WgoDateProcessingError(
      "transform_failure",
      `Could not transform ${tableName} rows for ${formattedDate}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  if (writeBatch.records.length > 0) {
    const CHUNK_SIZE = 500;
    for (let i = 0; i < writeBatch.records.length; i += CHUNK_SIZE) {
      const { error } =
        writeBatch.tableName === "wgo_skater_stats"
          ? await supabase
              .from("wgo_skater_stats")
              .upsert(writeBatch.records.slice(i, i + CHUNK_SIZE), {
                onConflict: "player_id, date",
              })
          : await supabase
              .from("wgo_skater_stats_playoffs")
              .upsert(writeBatch.records.slice(i, i + CHUNK_SIZE), {
                onConflict: "player_id, date",
              });

      if (error) {
        console.error(
          `Error upserting chunk to ${tableName} for date ${formattedDate}:`,
          error,
        );
        throw new WgoDateProcessingError(
          "write_failure",
          `Supabase upsert failed for ${tableName} (chunk starting at index ${i}): ${error.message}`,
        );
      }
    }
    console.log(
      `Successfully upserted ${writeBatch.records.length} records to ${tableName} for ${formattedDate}`,
    );
  }
  return writeBatch.records.length;
}

/**
 * Determine which game type(s) to fetch based on the date and season info
 * Now uses regularSeasonEndDate and seasonEndDate to correctly identify playoffs.
 */
function determineGameTypesToFetch(
  date: string,
  regularSeasonEndDate: string,
  seasonEndDate: string,
): { fetchRegularSeason: boolean; fetchPlayoffs: boolean } {
  const dateObj = parseISO(date);
  const regularSeasonEnd = parseISO(regularSeasonEndDate);
  const seasonEnd = parseISO(seasonEndDate);

  // If date is during the regular season
  if (
    isBefore(dateObj, regularSeasonEnd) ||
    dateObj.toDateString() === regularSeasonEnd.toDateString()
  ) {
    return { fetchRegularSeason: true, fetchPlayoffs: false };
  }
  // If date is after regular season end but on or before the overall season end (playoffs)
  else if (
    isBefore(regularSeasonEnd, dateObj) &&
    (isBefore(dateObj, seasonEnd) ||
      dateObj.toDateString() === seasonEnd.toDateString())
  ) {
    return { fetchRegularSeason: false, fetchPlayoffs: true };
  }
  // If date is outside both regular season and playoffs of the identified season
  else {
    return { fetchRegularSeason: false, fetchPlayoffs: false };
  }
}

async function updateSkaterStats(
  date: string,
  seasonId: number,
  regularSeasonEndDate: string,
  seasonEndDate: string, // Pass the overall season end date
): Promise<{
  message: string;
  success: boolean;
  totalUpdates: number;
  rowsFetched: number;
  errors: number;
  outcome: WgoDateOutcome;
}> {
  // Add rowsFetched and errors to return type
  // No direct console.log here, as processDate will handle the detailed logging
  // for individual dates. This function primarily orchestrates fetching and upserting.

  const { fetchRegularSeason, fetchPlayoffs } = determineGameTypesToFetch(
    date,
    regularSeasonEndDate,
    seasonEndDate, // Pass to determineGameTypesToFetch
  );

  let regularSeasonUpdates = 0;
  let playoffUpdates = 0;
  let regularSeasonFetched = 0;
  let playoffFetched = 0;
  let gameTypeMessage = "None"; // Default in case no relevant game type is found

  if (fetchRegularSeason) {
    console.log(`  > Fetching Regular Season data...`);
    const regularSeasonData = await fetchDataForGameType(2, date);
    regularSeasonFetched = regularSeasonData.skaterStats.length;
    regularSeasonUpdates = await processAndUpsertGameTypeData(
      regularSeasonData,
      "wgo_skater_stats",
      date,
      seasonId,
    );
    gameTypeMessage = "Regular Season";
  }

  if (fetchPlayoffs) {
    console.log(`  > Fetching Playoff data...`);
    const playoffData = await fetchDataForGameType(3, date);
    playoffFetched = playoffData.skaterStats.length;
    playoffUpdates = await processAndUpsertGameTypeData(
      playoffData,
      "wgo_skater_stats_playoffs",
      date,
      seasonId,
    );
    if (gameTypeMessage === "Regular Season") {
      gameTypeMessage += " & Playoffs";
    } else {
      gameTypeMessage = "Playoffs";
    }
  }

  const totalUpdates = regularSeasonUpdates + playoffUpdates;
  const totalFetched = regularSeasonFetched + playoffFetched;
  const outcome = createWgoDateOutcome({
    date,
    totalUpdates,
    rowsFetched: totalFetched,
  });

  return {
    message: `Skater stats processed for ${date} (${gameTypeMessage}).`,
    success: true,
    totalUpdates,
    rowsFetched: totalFetched,
    errors: 0,
    outcome,
  };
}

async function getMostRecentDateFromDB(): Promise<string | null> {
  // Check both regular season and playoff tables for the most recent date
  const [regularSeasonResult, playoffResult] = await Promise.all([
    supabase
      .from("wgo_skater_stats")
      .select("date")
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("wgo_skater_stats_playoffs")
      .select("date")
      .order("date", { ascending: false })
      .limit(1),
  ]);

  if (regularSeasonResult.error && playoffResult.error) {
    console.error("Error fetching most recent dates:", {
      regularError: regularSeasonResult.error,
      playoffError: playoffResult.error,
    });
    return null;
  }

  const regularDate = regularSeasonResult.data?.[0]?.date || null;
  const playoffDate = playoffResult.data?.[0]?.date || null;

  if (!regularDate && !playoffDate) return null;
  if (!regularDate) return playoffDate;
  if (!playoffDate) return regularDate;

  // Return the later date
  return isBefore(parseISO(regularDate), parseISO(playoffDate))
    ? playoffDate
    : regularDate;
}

async function updateAllSkatersFromMostRecentDate(
  arg?: boolean | { fullRefresh?: boolean; startDate?: string },
) {
  // Support both boolean and options object to remain backwards compatible
  const opts = typeof arg === "boolean" ? { fullRefresh: arg } : arg ? arg : {};
  const fullRefresh = opts.fullRefresh ?? false;
  const providedStartDate = opts.startDate;

  let startDate: Date;
  const currentSeason = await getCurrentSeason();

  const endDate = parseISO(currentSeason.seasonEndDate);
  const today = new Date();
  const finalEndDate = isBefore(endDate, today) ? endDate : today;

  if (providedStartDate) {
    startDate = parseISO(providedStartDate);
    console.log(
      "Starting from provided start date:",
      formatISO(startDate, { representation: "date" }),
    );
  } else if (fullRefresh) {
    startDate = parseISO(currentSeason.regularSeasonStartDate);
    console.log(
      "Full refresh: Starting from season start date:",
      formatISO(startDate, { representation: "date" }),
    );
  } else {
    const mostRecentDate = await getMostRecentDateFromDB();
    if (mostRecentDate) {
      startDate = addDays(parseISO(mostRecentDate), 1);
      console.log(
        "Incremental update: Starting from",
        formatISO(startDate, { representation: "date" }),
      );
    } else {
      startDate = parseISO(currentSeason.regularSeasonStartDate);
      console.log(
        "No existing data: Starting from season start date:",
        formatISO(startDate, { representation: "date" }),
      );
    }
  }

  let totalUpdates = 0;
  const datesProcessed: string[] = [];
  let failedOutcomes: WgoDateOutcome[] = [];
  const skippedOutcomes: WgoDateOutcome[] = [];
  let currentDate = startDate;

  const MAX_RETRIES = 3;
  if (isBefore(finalEndDate, startDate)) {
    console.log(
      "Database is already up to date, or target date is before start date.",
    );
    return {
      message: "Database is already up to date.",
      success: true,
      totalUpdates: 0,
      datesProcessed: [],
      failedDates: [],
      failedDatesCount: 0,
      failures: [],
      skippedDates: [],
      skippedDatesCount: 0,
      skips: [],
    };
  }

  const totalDaysToProcess = differenceInDays(finalEndDate, startDate) + 1; // +1 to include the end date
  let daysProcessedCount = 0; // Initialize counter for progress

  console.log(
    `Initiating update for dates from ${formatISO(startDate, {
      representation: "date",
    })} to ${formatISO(finalEndDate, { representation: "date" })} (Current Season End: ${formatISO(currentSeason.seasonEndDate, { representation: "date" })})`,
  );

  while (
    isBefore(currentDate, finalEndDate) ||
    currentDate.toDateString() === finalEndDate.toDateString()
  ) {
    const formattedDate = formatISO(currentDate, { representation: "date" });
    let success = false;
    let lastOutcome: WgoDateOutcome | null = null;

    const seasonInfo = await getSeasonFromDate(formattedDate);
    if (!seasonInfo) {
      console.error(
        `|------------------------------------------------------------|`,
      );
      console.error(
        `Could not determine season for date ${formattedDate}, skipping...`,
      );
      console.error(
        `|------------------------------------------------------------|`,
      );
      failedOutcomes.push(
        createWgoDateFailure(
          formattedDate,
          `Could not determine a season for ${formattedDate}.`,
          "season_mapping_failure",
        ),
      );
      currentDate = addDays(currentDate, 1);
      daysProcessedCount++; // Increment counter even if skipped
      continue;
    }

    // Calculate progress for the current date
    const progressPercent =
      totalDaysToProcess > 0
        ? Math.min(
            100,
            Math.round((daysProcessedCount / totalDaysToProcess) * 100),
          )
        : 100; // Handle division by zero if start and end are the same or range is invalid

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // CORRECTED The call to processDate now passes the actual progress count
        const result = await processDate(
          formattedDate,
          seasonInfo,
          attempt,
          `${daysProcessedCount + 1}/${totalDaysToProcess}`, // Pass calculated progress
          `${progressPercent}%`, // Pass percentage
        );
        lastOutcome = result;

        if (result.status === "processed") {
          totalUpdates += result.totalUpdates;
          if (!datesProcessed.includes(formattedDate)) {
            datesProcessed.push(formattedDate);
          }
          success = true;
          break;
        }
        if (result.status === "skipped") {
          skippedOutcomes.push(result);
          success = true;
          break;
        }
      } catch (error: any) {
        lastOutcome = createWgoDateFailure(formattedDate, error);
      }
    }

    if (!success && lastOutcome) {
      failedOutcomes.push(lastOutcome);
    }
    daysProcessedCount++; // Increment counter after processing a date
    currentDate = addDays(currentDate, 1);
  }

  if (failedOutcomes.length > 0) {
    console.log(`\n--- RETRYING ${failedOutcomes.length} FAILED DATES ---`);
    const retryFailedOutcomes: WgoDateOutcome[] = [];
    const totalRetries = failedOutcomes.length;
    let retriesCompleted = 0;

    for (const failedOutcome of failedOutcomes) {
      const failedDate = failedOutcome.date;
      let retrySuccess = false;
      let lastOutcome = failedOutcome;
      const seasonInfo = await getSeasonFromDate(failedDate);
      if (!seasonInfo) {
        console.error(
          `Could not determine season for failed date ${failedDate} during retry, skipping.`,
        );
        retryFailedOutcomes.push(
          createWgoDateFailure(
            failedDate,
            `Could not determine a season for ${failedDate} during retry.`,
            "season_mapping_failure",
          ),
        );
        retriesCompleted++;
        continue;
      }

      const progressPercent =
        totalRetries > 0
          ? Math.min(100, Math.round((retriesCompleted / totalRetries) * 100))
          : 100;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await processDate(
            failedDate,
            seasonInfo,
            attempt,
            `RETRY ${retriesCompleted + 1}/${totalRetries}`, // Updated X/Y for retries
            `${progressPercent}%`,
          );
          lastOutcome = result;
          if (result.status === "processed") {
            totalUpdates += result.totalUpdates;
            if (!datesProcessed.includes(failedDate)) {
              datesProcessed.push(failedDate);
            }
            retrySuccess = true;
            break;
          }
          if (result.status === "skipped") {
            skippedOutcomes.push(result);
            retrySuccess = true;
            break;
          }
        } catch (error: any) {
          lastOutcome = createWgoDateFailure(failedDate, error);
        }
      }

      if (!retrySuccess) {
        retryFailedOutcomes.push(lastOutcome);
      }
      retriesCompleted++;
    }

    failedOutcomes = retryFailedOutcomes;
  }

  if (failedOutcomes.length > 0) {
    console.error(
      `\n--- FINAL RESULT: ${failedOutcomes.length} dates could not be processed after all retries: ${failedOutcomes.map((outcome) => outcome.date).join(", ")} ---`,
    );
  }

  const outcomeSummary = summarizeWgoDateOutcomes([
    ...failedOutcomes,
    ...skippedOutcomes,
  ]);

  return {
    message:
      failedOutcomes.length === 0
        ? `All skater stats updated successfully. Processed ${datesProcessed.length} distinct dates with ${totalUpdates} total updates.`
        : `Skater stats update completed with ${failedOutcomes.length} failed dates after retries.`,
    success: failedOutcomes.length === 0,
    totalUpdates,
    datesProcessed,
    ...outcomeSummary,
  };
}

async function getAllSeasonsFromDB(): Promise<
  {
    seasonId: number;
    startDate: string;
    endDate: string;
    regularSeasonEndDate: string;
  }[]
> {
  console.log("Fetching all seasons from the 'seasons' database table...");

  const { data, error } = await supabase
    .from("seasons")
    .select("id, startDate, endDate, regularSeasonEndDate")
    .order("startDate", { ascending: true });

  if (error) {
    console.error("Error fetching seasons from database:", error);
    throw new Error(`Failed to fetch seasons from Supabase: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn("No seasons found in the 'seasons' table.");
    return [];
  }

  console.log(`Found ${data.length} seasons to process.`);

  return data.map((season) => ({
    seasonId: season.id,
    startDate: season.startDate,
    endDate: season.endDate,
    regularSeasonEndDate: season.regularSeasonEndDate,
  }));
}

/**
 * Processes all data for a single date with intelligent game type fetching.
 * Returns a typed outcome so callers retain skip and failure reasons through retries.
 */
// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/update-wgo-skaters.ts

async function processDate(
  formattedDate: string,
  seasonInfo: {
    seasonId: number;
    startDate: string; // Season start date
    endDate: string; // Season end date (including playoffs)
    regularSeasonEndDate: string;
  },
  attempt: number, // Add attempt parameter for logging
  progressXY: string = "", // New parameter for X/Y progress
  progressPercent: string = "", // New parameter for % progress
): Promise<WgoDateOutcome> {
  // Return object with more details
  const { seasonId, startDate, endDate, regularSeasonEndDate } = seasonInfo;

  // Use a consistent padding length for labels
  const LABEL_PAD = 30; // Padding for the first column of the log
  const VALUE_PAD = 15; // Padding for values

  console.log(`|------------------------------------------------------------|`);

  // CORRECTED PADDING LOGIC
  if (progressXY && progressPercent) {
    const urlLabel = `URL: ${progressXY}`;
    console.log(`${urlLabel.padEnd(LABEL_PAD)} % Complete: ${progressPercent}`);
  }
  const processingLabel = `Processing ${formattedDate}`;
  console.log(`${processingLabel.padEnd(LABEL_PAD)}ATTEMPT ${attempt}`);

  console.log(``); // Blank line for spacing
  console.log(
    `Date:`.padEnd(LABEL_PAD) + `${formattedDate}`.padStart(VALUE_PAD),
  );
  console.log(
    `Season ID:`.padEnd(LABEL_PAD) + `${seasonId}`.padStart(VALUE_PAD),
  );

  const dateObj = parseISO(formattedDate);
  const regularSeasonEnd = parseISO(regularSeasonEndDate);
  const seasonEnd = parseISO(endDate); // Overall season end
  const seasonStart = parseISO(startDate); // Overall season start

  // Determine playoff start date for display
  const playoffsStartDate = addDays(regularSeasonEnd, 1);

  let seasonTypeMessage = "Offseason"; // Default
  if (
    isBefore(dateObj, regularSeasonEnd) ||
    dateObj.toDateString() === regularSeasonEnd.toDateString()
  ) {
    seasonTypeMessage = "Regular Season";
  } else if (
    isBefore(regularSeasonEnd, dateObj) &&
    (isBefore(dateObj, seasonEnd) ||
      dateObj.toDateString() === seasonEnd.toDateString())
  ) {
    seasonTypeMessage = "Playoffs";
  }
  console.log(
    `Season Type:`.padEnd(LABEL_PAD) +
      `${seasonTypeMessage}`.padStart(VALUE_PAD),
  );
  console.log(``); // Blank line for spacing

  console.log(
    `Season Start Date:`.padEnd(LABEL_PAD) +
      `${formatISO(seasonStart, { representation: "date" })}`.padStart(
        VALUE_PAD,
      ),
  );
  console.log(
    `Regular Season End Date:`.padEnd(LABEL_PAD) +
      `${formatISO(regularSeasonEnd, { representation: "date" })}`.padStart(
        VALUE_PAD,
      ),
  );
  console.log(
    `Playoffs Start Date:`.padEnd(LABEL_PAD) +
      `${formatISO(playoffsStartDate, { representation: "date" })}`.padStart(
        VALUE_PAD,
      ),
  );
  console.log(
    `Season End Date:`.padEnd(LABEL_PAD) +
      `${formatISO(seasonEnd, { representation: "date" })}`.padStart(VALUE_PAD),
  );
  console.log(``); // Blank line for spacing

  let totalUpdates = 0;
  let rowsFetched = 0;
  let errors = 0;
  let outcome: WgoDateOutcome;

  try {
    const result = await updateSkaterStats(
      formattedDate,
      seasonId,
      regularSeasonEndDate,
      endDate, // Pass the overall season end date
    );

    totalUpdates = result.totalUpdates;
    rowsFetched = result.rowsFetched;
    errors = result.errors;
    outcome = result.outcome;

    console.log(
      `Rows Fetched:`.padEnd(LABEL_PAD) +
        `${String(rowsFetched)}`.padStart(VALUE_PAD),
    );
    console.log(
      `Rows Upserted:`.padEnd(LABEL_PAD) +
        `${String(totalUpdates)}`.padStart(VALUE_PAD),
    );
    console.log(
      `Errors:`.padEnd(LABEL_PAD) + `${String(errors)}`.padStart(VALUE_PAD),
    );
  } catch (error: any) {
    console.error(
      `Error during processDate for ${formattedDate}: ${error.message}`,
    );
    errors = 1; // Mark as error
    outcome = createWgoDateFailure(formattedDate, error);
    console.log(
      `Rows Fetched:`.padEnd(LABEL_PAD) +
        `${String(rowsFetched)}`.padStart(VALUE_PAD),
    );
    console.log(
      `Rows Upserted:`.padEnd(LABEL_PAD) +
        `${String(totalUpdates)}`.padStart(VALUE_PAD),
    );
    console.log(
      `Errors:`.padEnd(LABEL_PAD) + `${String(errors)}`.padStart(VALUE_PAD),
    );
  } finally {
    console.log(``); // Blank line for spacing
    console.log(
      `Finished processing Date:`.padEnd(LABEL_PAD) +
        `${formattedDate}`.padStart(VALUE_PAD),
    );
    console.log(
      `|------------------------------------------------------------|`,
    );
    console.log(`\n`); // New line to differentiate dates
  }

  return outcome!;
}

const WGO_SKATER_WINDOW_DAYS = 7;

async function processCompletedDateWindow(options: {
  completedDates: string[];
  endDate: string;
  seasonInfo: {
    seasonId: number;
    startDate: string;
    endDate: string;
    regularSeasonEndDate: string;
  };
  startDate: string;
}): Promise<WgoDateOutcome[]> {
  const { completedDates, endDate, seasonInfo, startDate } = options;
  if (completedDates.length === 0) return [];

  const startsInRegularSeason = startDate <= seasonInfo.regularSeasonEndDate;
  const endsInRegularSeason = endDate <= seasonInfo.regularSeasonEndDate;
  if (startsInRegularSeason !== endsInRegularSeason) {
    throw new WgoDateProcessingError(
      "transform_failure",
      `WGO skater window ${startDate} through ${endDate} crosses the regular-season/playoff boundary.`,
    );
  }

  const gameTypeId = startsInRegularSeason ? 2 : 3;
  const tableName: SkaterStatsTable = startsInRegularSeason
    ? "wgo_skater_stats"
    : "wgo_skater_stats_playoffs";
  const allData = await fetchDataForGameType(
    gameTypeId,
    endDate,
    -1,
    startDate,
  );
  const expectedDates = new Set(completedDates);
  const summariesByDate = new Map<string, WGOSummarySkaterStat[]>();

  for (const stat of allData.skaterStats) {
    const gameDate = stat.gameDate;
    if (typeof gameDate !== "string" || !expectedDates.has(gameDate)) {
      throw new WgoDateProcessingError(
        "source_failure",
        `NHL skater summary returned unexpected gameDate ${String(gameDate)} for ${startDate} through ${endDate}.`,
      );
    }
    const rows = summariesByDate.get(gameDate) ?? [];
    rows.push(stat);
    summariesByDate.set(gameDate, rows);
  }

  const outcomes: WgoDateOutcome[] = [];
  for (const date of completedDates) {
    const skaterStats = summariesByDate.get(date) ?? [];
    if (skaterStats.length === 0) {
      throw new WgoDateProcessingError(
        "source_failure",
        `NHL game index marks ${date} complete, but the skater summary returned no rows.`,
      );
    }
    const totalUpdates = await processAndUpsertGameTypeData(
      { ...allData, skaterStats },
      tableName,
      date,
      seasonInfo.seasonId,
    );
    outcomes.push(
      createWgoDateOutcome({
        date,
        rowsFetched: skaterStats.length,
        totalUpdates,
      }),
    );
  }

  return outcomes;
}

// Affected portion: updateAllStatsForAllSeasons function
async function updateAllStatsForAllSeasons(
  targetSeasonId?: number,
  requestedRange: { endDate?: string; startDate?: string } = {},
) {
  const availableSeasons = await getAllSeasonsFromDB();
  const allSeasons = targetSeasonId
    ? availableSeasons.filter((season) => season.seasonId === targetSeasonId)
    : availableSeasons;
  let totalUpdates = 0;
  let failedOutcomes: Array<WgoDateOutcome & { seasonId: number }> = [];
  const skippedOutcomes: WgoDateOutcome[] = [];

  if (allSeasons.length === 0) {
    return {
      message: "No seasons found in the database to refresh.",
      success: true,
      seasonsProcessed: 0,
      totalUpdates: 0,
      failedDates: [],
      failedDatesCount: 0,
      failures: [],
      skippedDates: [],
      skippedDatesCount: 0,
      skips: [],
    };
  }

  if (targetSeasonId) {
    const targetSeason = allSeasons[0];
    for (const [label, value] of [
      ["startDate", requestedRange.startDate],
      ["endDate", requestedRange.endDate],
    ] as const) {
      if (
        value &&
        (value < targetSeason.startDate || value > targetSeason.endDate)
      ) {
        throw new Error(
          `${label} ${value} is outside season ${targetSeasonId} (${targetSeason.startDate} through ${targetSeason.endDate}).`,
        );
      }
    }
  }

  console.log(`Starting full refresh for ${allSeasons.length} seasons.`);

  const MAX_RETRIES = 3;
  const seasonRanges = allSeasons
    .map((season) => ({
      endDate:
        requestedRange.endDate && requestedRange.endDate < season.endDate
          ? requestedRange.endDate
          : season.endDate,
      season,
      startDate:
        requestedRange.startDate && requestedRange.startDate > season.startDate
          ? requestedRange.startDate
          : season.startDate,
    }))
    .filter(({ endDate, startDate }) => startDate <= endDate);
  const totalDaysAcrossAllSeasons = seasonRanges.reduce(
    (total, range) =>
      total +
      differenceInDays(parseISO(range.endDate), parseISO(range.startDate)) +
      1,
    0,
  );
  let globalDaysProcessedCount = 0;

  for (const {
    endDate: rangeEndDate,
    season,
    startDate: rangeStartDate,
  } of seasonRanges) {
    console.log(
      `\n--- Processing Season: ${season.seasonId} (${rangeStartDate} to ${rangeEndDate}) ---`,
    );
    let currentDate = parseISO(rangeStartDate);
    const endDate = parseISO(rangeEndDate);
    const completedGameDates = await fetchCompletedWgoSeasonGameDates({
      endDate: rangeEndDate,
      seasonId: season.seasonId,
      startDate: rangeStartDate,
    });
    const today = formatISO(new Date(), { representation: "date" });
    if (completedGameDates.length === 0 && rangeEndDate < today) {
      throw new Error(
        `No completed NHL game dates were returned for completed season ${season.seasonId}.`,
      );
    }

    while (
      isBefore(currentDate, endDate) ||
      currentDate.toDateString() === endDate.toDateString()
    ) {
      let windowEnd = addDays(currentDate, WGO_SKATER_WINDOW_DAYS - 1);
      if (isBefore(endDate, windowEnd)) {
        windowEnd = endDate;
      }
      const regularSeasonEnd = parseISO(season.regularSeasonEndDate);
      if (
        !isBefore(regularSeasonEnd, currentDate) &&
        isBefore(regularSeasonEnd, windowEnd)
      ) {
        windowEnd = regularSeasonEnd;
      }
      const windowStartDate = formatISO(currentDate, {
        representation: "date",
      });
      const windowEndDate = formatISO(windowEnd, { representation: "date" });
      const windowCompletedDates = completedGameDates.filter(
        (date) => date >= windowStartDate && date <= windowEndDate,
      );
      const windowDays = differenceInDays(windowEnd, currentDate) + 1;

      if (windowCompletedDates.length === 0) {
        globalDaysProcessedCount += windowDays;
        currentDate = addDays(windowEnd, 1);
        continue;
      }

      const seasonInfoForDate = {
        seasonId: season.seasonId,
        startDate: season.startDate,
        endDate: season.endDate,
        regularSeasonEndDate: season.regularSeasonEndDate,
      };

      const globalProgressPercent =
        totalDaysAcrossAllSeasons > 0
          ? Math.min(
              100,
              Math.round(
                (globalDaysProcessedCount / totalDaysAcrossAllSeasons) * 100,
              ),
            )
          : 100;

      console.log(
        `Processing ${windowStartDate} through ${windowEndDate} (${windowCompletedDates.length} completed game dates, ${globalProgressPercent}% complete)`,
      );
      let success = false;
      let lastError: unknown = new Error("WGO skater window did not run.");
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const outcomes = await processCompletedDateWindow({
            completedDates: windowCompletedDates,
            endDate: windowEndDate,
            seasonInfo: seasonInfoForDate,
            startDate: windowStartDate,
          });
          for (const outcome of outcomes) {
            if (outcome.status === "processed") {
              totalUpdates += outcome.totalUpdates;
            } else if (outcome.status === "skipped") {
              skippedOutcomes.push(outcome);
            }
          }
          success = true;
          break;
        } catch (error: unknown) {
          lastError = error;
          console.warn(
            `WGO skater window ${windowStartDate} through ${windowEndDate} failed on attempt ${attempt}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      if (!success) {
        failedOutcomes.push(
          ...windowCompletedDates.map((date) => ({
            ...createWgoDateFailure(date, lastError),
            seasonId: season.seasonId,
          })),
        );
      }
      globalDaysProcessedCount += windowDays;
      currentDate = addDays(windowEnd, 1);
    }
  }

  if (failedOutcomes.length > 0) {
    console.log(`\n--- RETRYING ${failedOutcomes.length} FAILED DATES ---`);
    const retryFailedOutcomes: Array<WgoDateOutcome & { seasonId: number }> =
      [];
    const totalRetries = failedOutcomes.length;
    let retriesCompleted = 0;

    for (const failedOutcome of failedOutcomes) {
      const { date: failedDate, seasonId } = failedOutcome;
      const season = allSeasons.find((s) => s.seasonId === seasonId);
      if (!season) {
        console.error(
          `Season ${seasonId} not found for failed date ${failedDate} during retry, skipping.`,
        );
        retryFailedOutcomes.push({
          ...createWgoDateFailure(
            failedDate,
            `Season ${seasonId} was not found during retry.`,
            "season_mapping_failure",
          ),
          seasonId,
        });
        retriesCompleted++;
        continue;
      }

      let retrySuccess = false;
      let lastOutcome: WgoDateOutcome = failedOutcome;
      const seasonInfoForFailedDate = {
        seasonId: season.seasonId,
        startDate: season.startDate,
        endDate: season.endDate,
        regularSeasonEndDate: season.regularSeasonEndDate,
      };

      const retryProgressPercent =
        totalRetries > 0
          ? Math.min(100, Math.round((retriesCompleted / totalRetries) * 100))
          : 100;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await processDate(
            failedDate,
            seasonInfoForFailedDate, // Pass the season info object
            attempt, // Pass the attempt number
            `RETRY ${retriesCompleted + 1}/${totalRetries}`, // Updated X/Y for retries
            `${retryProgressPercent}%`,
          );
          lastOutcome = result;
          if (result.status === "processed") {
            totalUpdates += result.totalUpdates;
            retrySuccess = true;
            break;
          }
          if (result.status === "skipped") {
            skippedOutcomes.push(result);
            retrySuccess = true;
            break;
          }
        } catch (error: any) {
          lastOutcome = createWgoDateFailure(failedDate, error);
        }
      }

      if (!retrySuccess) {
        retryFailedOutcomes.push({ ...lastOutcome, seasonId });
      }
      retriesCompleted++;
    }

    failedOutcomes = retryFailedOutcomes;
  }

  if (failedOutcomes.length > 0) {
    console.error(
      `\n--- FINAL RESULT: ${failedOutcomes.length} dates could not be processed after all retries: ${failedOutcomes.map((outcome) => outcome.date).join(", ")} ---\n`,
    );
  }

  const message = `All-time refresh complete. Processed ${allSeasons.length} seasons with a total of ${totalUpdates} updates.`;
  console.log(message);
  const outcomeSummary = summarizeWgoDateOutcomes([
    ...failedOutcomes,
    ...skippedOutcomes,
  ]);
  return {
    message,
    success: failedOutcomes.length === 0,
    seasonsProcessed: allSeasons.length,
    totalUpdates,
    ...outcomeSummary,
  };
}

async function fetchDataForPlayer(playerId: string, playerName: string) {
  console.log(`Fetching data for player ${playerName} (${playerId})`);
  const today = new Date();
  const formattedDate = formatISO(today, { representation: "date" });
  const currentSeason = await getCurrentSeason();

  // Use the earliest date from the current season and its last season to cover potentially long player careers or trades
  const seasonStartDate = currentSeason.lastRegularSeasonStartDate
    ? currentSeason.lastRegularSeasonStartDate
    : currentSeason.regularSeasonStartDate;

  const fetchPlayerDataForGameType = async (gameTypeId: number) => {
    const cayenneExp = `gameDate<="${formattedDate} 23:59:59" and gameDate>="${seasonStartDate}" and gameTypeId=${gameTypeId} and playerId=${playerId}`;
    const url = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=[{"property":"points","direction":"DESC"}]&factCayenneExp=gamesPlayed>=1&cayenneExp=${encodeURIComponent(cayenneExp)}`;
    const response = await Fetch(url).then(
      (res) => res.json() as Promise<NHLApiResponse>,
    );
    return response.data;
  };
  const regularSeasonData = await fetchPlayerDataForGameType(2);
  const playoffData = await fetchPlayerDataForGameType(3);
  return { regularSeasonData, playoffData };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const startTime = Date.now();
  const actionParam =
    typeof req.query.action === "string" ? req.query.action : undefined;
  const jobName =
    actionParam === "all" || actionParam === "all_seasons_full_refresh"
      ? "update-all-wgo-skaters"
      : "/api/v1/db/update-wgo-skaters";
  let status: "success" | "failure" = "success";
  let details: any = {};
  let totalUpdates = 0;
  let responseBody: any = null;

  try {
    const {
      date,
      playerId,
      action,
      season: rawSeason,
      fullRefresh: fullRefreshParam,
      startDate: startDateParam, // Accept startDate
      endDate: endDateParam,
      playerFullName: rawPlayerFullName,
    } = req.query;
    const fullRefresh = fullRefreshParam === "true" || fullRefreshParam === "1";
    const startDate =
      typeof startDateParam === "string" ? startDateParam : undefined;
    const playerFullName = Array.isArray(rawPlayerFullName)
      ? rawPlayerFullName[0]
      : rawPlayerFullName;
    const seasonParam = Array.isArray(rawSeason) ? rawSeason[0] : rawSeason;
    let result: any;

    if (action === "all_seasons_full_refresh") {
      console.log("Action 'all_seasons_full_refresh' triggered.");
      result = await updateAllStatsForAllSeasons();
      totalUpdates = result.totalUpdates;
      status = result.success ? "success" : "failure";
      details = {
        message: result.message,
        failedDates: result.failedDates,
        failedDatesCount: result.failedDatesCount,
        failures: result.failures,
        skippedDatesCount: result.skippedDatesCount,
        skips: result.skips,
      };
      responseBody = { ...result, failedRows: 0 };
      res.status(result.success ? 200 : 207).json(responseBody);
    } else if (action === "season") {
      const targetSeasonId = parseWgoSeasonId(seasonParam);
      if (!targetSeasonId) {
        throw new Error(
          "action=season requires season=YYYYYYYY for a consecutive two-year NHL season.",
        );
      }
      const rangeStartDate = parseOptionalWgoDate(startDateParam);
      const rangeEndDate = parseOptionalWgoDate(endDateParam);
      if (startDateParam !== undefined && !rangeStartDate) {
        throw new Error("Invalid startDate. Expected YYYY-MM-DD.");
      }
      if (endDateParam !== undefined && !rangeEndDate) {
        throw new Error("Invalid endDate. Expected YYYY-MM-DD.");
      }
      if (rangeStartDate && rangeEndDate && rangeStartDate > rangeEndDate) {
        throw new Error("startDate must be on or before endDate.");
      }
      result = await updateAllStatsForAllSeasons(targetSeasonId, {
        endDate: rangeEndDate,
        startDate: rangeStartDate,
      });
      if (result.seasonsProcessed === 0) {
        throw new Error(`Season ${targetSeasonId} was not found in the seasons table.`);
      }
      totalUpdates = result.totalUpdates;
      status = result.success ? "success" : "failure";
      details = {
        message: result.message,
        season: targetSeasonId,
        startDate: rangeStartDate,
        endDate: rangeEndDate,
        failedDates: result.failedDates,
        failedDatesCount: result.failedDatesCount,
        failures: result.failures,
        skippedDatesCount: result.skippedDatesCount,
        skips: result.skips,
      };
      responseBody = {
        ...result,
        season: targetSeasonId,
        startDate: rangeStartDate,
        endDate: rangeEndDate,
        failedRows: 0,
      };
      res.status(result.success ? 200 : 207).json(responseBody);
    } else if (action === "all") {
      console.log(
        `Action 'all' triggered. Full refresh: ${fullRefresh}, Start date: ${startDate}`,
      );
      result = await updateAllSkatersFromMostRecentDate({
        fullRefresh,
        startDate,
      });
      totalUpdates = result.totalUpdates;
      status = result.success ? "success" : "failure";
      details = {
        message: result.message,
        datesProcessed: result.datesProcessed,
        failedDates: result.failedDates,
        failedDatesCount: result.failedDatesCount,
        failures: result.failures,
        skippedDates: result.skippedDates,
        skippedDatesCount: result.skippedDatesCount,
        skips: result.skips,
        fullRefresh,
        startDate,
      };
      responseBody = {
        ...result,
        failedRows: 0,
        fullRefresh,
        startDate,
      };
      res.status(result.success ? 200 : 207).json(responseBody);
    } else if (date && typeof date === "string") {
      console.log(`Date parameter found: ${date}`);
      const seasonInfo = await getSeasonFromDate(date);
      if (!seasonInfo) {
        status = "failure";
        details = { message: `Could not determine season for date: ${date}` };
        res.status(400).json(details);
        return;
      }
      // Note: For a single date, progress doesn't make as much sense,
      // but passing empty strings to maintain function signature.
      result = await updateSkaterStats(
        date,
        seasonInfo.seasonId,
        seasonInfo.regularSeasonEndDate,
        seasonInfo.endDate, // Pass season's actual end date
      );
      totalUpdates = result.totalUpdates;
      details = { message: result.message };
      responseBody = result;
      res.status(200).json(responseBody);
    } else if (playerId && typeof playerId === "string") {
      console.log(`Player ID parameter found: ${playerId}`);
      const name = playerFullName || `PlayerID ${playerId}`;
      const resultData = await fetchDataForPlayer(playerId, name);
      result = {
        message: `Data fetched successfully for player ${name}.`,
        success: true,
        data: resultData,
      };
      details = { message: result.message, playerId };
      responseBody = result;
      res.status(200).json(responseBody);
    } else {
      status = "failure";
      details = {
        message:
          "Missing or invalid parameters. Provide 'action=all_seasons_full_refresh', 'action=season&season=YYYYYYYY', 'action=all', 'date', or 'playerId'.",
      };
      responseBody = details;
      res.status(400).json(responseBody);
    }
  } catch (e: any) {
    console.error("Handler error:", e);
    status = "failure";
    details = { error: e.message };
    responseBody = details;
    res.status(500).json(responseBody);
  } finally {
    if (req.query.action) {
      // Only log cron jobs for actions
      await supabase.from("cron_job_audit").insert({
        job_name: jobName,
        status: status,
        rows_affected: totalUpdates,
        details: {
          method: req.method ?? null,
          url: req.url ?? null,
          statusCode: res.statusCode,
          durationMs: Date.now() - startTime,
          rowsUpserted: totalUpdates,
          failedRows: responseBody?.failedRows ?? 0,
          error:
            status === "failure"
              ? (details?.error ?? details?.message ?? "Unknown error")
              : null,
          response: responseBody,
          context: details,
        },
      });
    }
  }
}

export default adminOnly(handler as any);
