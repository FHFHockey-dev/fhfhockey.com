// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/update-wgo-skaters.ts

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// URL Paths and Query Parameters:
///////////////////
//// Full refresh of all seasons:
////    Path: /api/v1/db/update-wgo-skaters?action=all_seasons_full_refresh
////
////    Parameters:
////      - action: "all_seasons_full_refresh" (string, required) - Triggers a full re-fetch and upsert for all dates across all seasons present in the 'seasons' table.
////
///////////////////
//// Incremental or full refresh from most recent date:
////    Path: /api/v1/db/update-wgo-skaters?action=all&fullRefresh=true|false
////    Path: /api/v1/db/update-wgo-skaters?action=all will simply start from the most recent date found in `wgo_skater_stats` or `wgo_skater_stats_playoffs`
////
////    Parameters:
////      - action: "all" (string, required) - Triggers an update from the most recent date found in `wgo_skater_stats` or `wgo_skater_stats_playoffs`.
////      - fullRefresh: "true" | "1" (string, optional) - If "true" or "1", forces the update to start from the current season's `regularSeasonStartDate`.
////          Otherwise, it starts from the day after the most recent date in the database.
////
///////////////////
//// Update for a specific date:
////    Path: /api/v1/db/update-wgo-skaters?date=YYYY-MM-DD
///
////    Parameters:
////      - date: "YYYY-MM-DD" (string, required) - Specifies a single date for which skater statistics should be fetched and upserted.
////
///////////////////
//// Fetch data for a specific player:
////    Path: /api/v1/db/update-wgo-skaters?playerId=XXX&playerFullName=YYY
////
////    Parameters:
////      - playerId: "XXX" (string, required) - The unique ID of the player whose data needs to be fetched.
////      - playerFullName: "YYY" (string, optional) - The full name of the player, used for logging and context.
////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import {
  format,
  parseISO,
  addDays,
  isBefore,
  formatISO,
  differenceInDays
} from "date-fns"; // Added differenceInDays
import { getCurrentSeason } from "lib/NHL/server"; // Assuming this is your helper
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
  WGOToiSkaterStat
} from "lib/NHL/types";

// Types
interface NHLApiResponse {
  data: any[];
}

type SkaterDbRecord = {
  [key: string]: any;
  player_id: number;
  player_name: string;
  date: string;
};

type AllSkaterStats = {
  skaterStats: WGOSummarySkaterStat[];
  skatersBio: WGOSkatersBio[];
  miscSkaterStats: WGORealtimeSkaterStat[];
  faceOffStats: WGOFaceoffSkaterStat[];
  faceoffWinLossStats: WGOFaceOffWinLossSkaterStat[];
  goalsForAgainstStats: WGOGoalsForAgainstSkaterStat[];
  penaltiesStats: WGOPenaltySkaterStat[];
  penaltyKillStats: WGOPenaltyKillSkaterStat[];
  powerPlayStats: WGOPowerPlaySkaterStat[];
  puckPossessionStats: WGOPuckPossessionSkaterStat[];
  satCountsStats: WGOSatCountSkaterStat[];
  satPercentagesStats: WGOSatPercentageSkaterStat[];
  scoringRatesStats: WGOScoringRatesSkaterStat[];
  scoringPerGameStats: WGOScoringCountsSkaterStat[];
  shotTypeStats: WGOShotTypeSkaterStat[];
  timeOnIceStats: WGOToiSkaterStat[];
};

type DataMaps = {
  bioMap: Map<number, WGOSkatersBio>;
  miscMap: Map<number, WGORealtimeSkaterStat>;
  faceOffMap: Map<number, WGOFaceoffSkaterStat>;
  faceoffWinLossMap: Map<number, WGOFaceOffWinLossSkaterStat>;
  goalsForAgainstMap: Map<number, WGOGoalsForAgainstSkaterStat>;
  penaltiesMap: Map<number, WGOPenaltySkaterStat>;
  penaltyKillMap: Map<number, WGOPenaltyKillSkaterStat>;
  powerPlayMap: Map<number, WGOPowerPlaySkaterStat>;
  puckPossessionMap: Map<number, WGOPuckPossessionSkaterStat>;
  satCountsMap: Map<number, WGOSatCountSkaterStat>;
  satPercentagesMap: Map<number, WGOSatPercentageSkaterStat>;
  scoringRatesMap: Map<number, WGOScoringRatesSkaterStat>;
  scoringPerGameMap: Map<number, WGOScoringCountsSkaterStat>;
  shotTypeMap: Map<number, WGOShotTypeSkaterStat>;
  timeOnIceMap: Map<number, WGOToiSkaterStat>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
        regularSeasonEndDate: containingSeason.regularSeasonEndDate
      };
    }

    // If no direct match (likely offseason or date before first season/after last season), use smart logic
    console.log(
      `Date ${dateString} does not directly fall within a known season's active period. Using smart season detection...`
    );

    // Fetch all seasons to determine which one this date most likely belongs to
    const { data: allSeasons, error: seasonsError } = await supabase
      .from("seasons")
      .select("id, startDate, endDate, regularSeasonEndDate")
      .order("id", { ascending: false }); // Most recent first

    if (seasonsError || !allSeasons || allSeasons.length === 0) {
      console.error(
        "Could not fetch seasons for smart detection:",
        seasonsError?.message
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
          `Smart detection: Date ${dateString} falls within season ${currentSeason.id} (including playoffs).`
        );
        return {
          seasonId: Number(currentSeason.id),
          startDate: currentSeason.startDate,
          endDate: currentSeason.endDate,
          regularSeasonEndDate: currentSeason.regularSeasonEndDate
        };
      }

      // If targetDate is after the current season's overall end date (seasonEnd)
      if (isBefore(seasonEnd, targetDate)) {
        if (nextSeason) {
          const nextSeasonStart = parseISO(nextSeason.startDate);
          // If date is between current season's end and next season's start (true offseason)
          if (isBefore(targetDate, nextSeasonStart)) {
            console.log(
              `Smart detection: Date ${dateString} is in offseason between season ${currentSeason.id} and ${nextSeason.id}. Using upcoming season ${nextSeason.id} for context.`
            );
            return {
              seasonId: Number(nextSeason.id),
              startDate: nextSeason.startDate,
              endDate: nextSeason.endDate,
              regularSeasonEndDate: nextSeason.regularSeasonEndDate
            };
          }
        } else {
          const monthsAfterSeason =
            (targetDate.getTime() - seasonEnd.getTime()) /
            (1000 * 60 * 60 * 24 * 30.44);
          if (monthsAfterSeason <= 6) {
            // Within 6 months after the last season ended
            console.log(
              `Smart detection: Date ${dateString} is in recent offseason after latest season ${currentSeason.id}. Using completed season ${currentSeason.id} for context.`
            );
            return {
              seasonId: Number(currentSeason.id),
              startDate: currentSeason.startDate,
              endDate: currentSeason.endDate,
              regularSeasonEndDate: currentSeason.regularSeasonEndDate
            };
          }
        }
      }
    }

    // If we get here, we couldn't determine an appropriate season
    console.warn(
      `Could not determine appropriate season for date: ${dateString}`
    );
    return null;
  } catch (err: any) {
    console.error(
      `Unexpected error in getSeasonFromDate for ${dateString}:`,
      err.message
    );
    return null;
  }
}

function mapApiDataToDbRecord(
  stat: WGOSummarySkaterStat,
  allData: DataMaps,
  formattedDate: string,
  seasonId?: number
): SkaterDbRecord {
  const bioStats = allData.bioMap.get(stat.playerId);
  const miscStats = allData.miscMap.get(stat.playerId);
  const faceOffStat = allData.faceOffMap.get(stat.playerId);
  const faceoffWinLossStat = allData.faceoffWinLossMap.get(stat.playerId);
  const goalsForAgainstStat = allData.goalsForAgainstMap.get(stat.playerId);
  const penaltiesStat = allData.penaltiesMap.get(stat.playerId);
  const penaltyKillStat = allData.penaltyKillMap.get(stat.playerId);
  const powerPlayStat = allData.powerPlayMap.get(stat.playerId);
  const puckPossessionStat = allData.puckPossessionMap.get(stat.playerId);
  const satCountsStat = allData.satCountsMap.get(stat.playerId);
  const satPercentagesStat = allData.satPercentagesMap.get(stat.playerId);
  const scoringRatesStat = allData.scoringRatesMap.get(stat.playerId);
  const scoringPerGameStat = allData.scoringPerGameMap.get(stat.playerId);
  const shotTypeStat = allData.shotTypeMap.get(stat.playerId);
  const timeOnIceStat = allData.timeOnIceMap.get(stat.playerId);

  const record: SkaterDbRecord = {
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
    game_id: stat.gameId,
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
    zone_start_pct: puckPossessionStat?.zoneStartPct,
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
    shooting_pct_slap: shotTypeStat?.goalsSlap,
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
    time_on_ice_per_shift: timeOnIceStat?.timeOnIcePerShift
  };
  if (seasonId) {
    record.season_id = seasonId;
  }
  Object.keys(record).forEach(
    (key) => record[key] === undefined && delete record[key]
  );
  return record;
}

async function fetchDataForGameType(
  gameTypeId: number,
  formattedDate: string,
  limit: number = 100
): Promise<AllSkaterStats> {
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
    timeOnIceStats: []
  };
  const getUrl = (
    reportName: string,
    sort: string,
    factCayenneExp: string = "gamesPlayed>=1"
  ) =>
    `https://api.nhle.com/stats/rest/en/skater/${reportName}?isAggregate=false&isGame=true&sort=${encodeURIComponent(sort)}&start=${start}&limit=${limit}&factCayenneExp=${factCayenneExp}&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
  while (moreDataAvailable) {
    const urls = {
      skaterStats: getUrl(
        "summary",
        '[{"property":"points","direction":"DESC"},{"property":"goals","direction":"DESC"},{"property":"assists","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      skatersBio: getUrl(
        "bios",
        '[{"property":"lastName","direction":"ASC_CI"},{"property":"skaterFullName","direction":"ASC_CI"},{"property":"playerId","direction":"ASC"}]',
        ""
      ),
      miscSkaterStats: getUrl(
        "realtime",
        '[{"property":"hits","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      faceOffStats: getUrl(
        "faceoffpercentages",
        '[{"property":"totalFaceoffs","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      faceoffWinLossStats: getUrl(
        "faceoffwins",
        '[{"property":"totalFaceoffWins","direction":"DESC"},{"property":"faceoffWinPct","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      goalsForAgainstStats: getUrl(
        "goalsForAgainst",
        '[{"property":"evenStrengthGoalDifference","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      penaltiesStats: getUrl(
        "penalties",
        '[{"property":"penaltyMinutes","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      penaltyKillStats: getUrl(
        "penaltykill",
        '[{"property":"shTimeOnIce","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      powerPlayStats: getUrl(
        "powerplay",
        '[{"property":"ppTimeOnIce","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      puckPossessionStats: getUrl(
        "puckPossessions",
        '[{"property":"satPct","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      satCountsStats: getUrl(
        "summaryshooting",
        '[{"property":"satTotal","direction":"DESC"},{"property":"usatTotal","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      satPercentagesStats: getUrl(
        "percentages",
        '[{"property":"satPercentage","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      scoringRatesStats: getUrl(
        "scoringRates",
        '[{"property":"pointsPer605v5","direction":"DESC"},{"property":"goalsPer605v5","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      scoringPerGameStats: getUrl(
        "scoringpergame",
        '[{"property":"pointsPerGame","direction":"DESC"},{"property":"goalsPerGame","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      shotTypeStats: getUrl(
        "shottype",
        '[{"property":"shootingPct","direction":"DESC"},{"property":"shootingPctBat","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      timeOnIceStats: getUrl(
        "timeonice",
        '[{"property":"timeOnIce","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      )
    };
    const responses = await Promise.all(
      Object.values(urls).map((url) =>
        Fetch(url).then((res) => res.json() as Promise<NHLApiResponse>)
      )
    );
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
      timeOnIceResponse
    ] = responses;
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
    moreDataAvailable = responses.some((res) => res.data.length === limit);
    start += limit;
  }
  return allData;
}

async function processAndUpsertGameTypeData(
  allData: AllSkaterStats,
  tableName: "wgo_skater_stats" | "wgo_skater_stats_playoffs",
  formattedDate: string,
  seasonId?: number
): Promise<number> {
  // Early exit if no skater stats data
  if (allData.skaterStats.length === 0) {
    console.log(
      `No skater stats data found for ${formattedDate} in ${tableName}, skipping...`
    );
    return 0;
  }

  const dataMaps: DataMaps = {
    bioMap: new Map(allData.skatersBio.map((s) => [s.playerId, s])),
    miscMap: new Map(allData.miscSkaterStats.map((s) => [s.playerId, s])),
    faceOffMap: new Map(allData.faceOffStats.map((s) => [s.playerId, s])),
    faceoffWinLossMap: new Map(
      allData.faceoffWinLossStats.map((s) => [s.playerId, s])
    ),
    goalsForAgainstMap: new Map(
      allData.goalsForAgainstStats.map((s) => [s.playerId, s])
    ),
    penaltiesMap: new Map(allData.penaltiesStats.map((s) => [s.playerId, s])),
    penaltyKillMap: new Map(
      allData.penaltyKillStats.map((s) => [s.playerId, s])
    ),
    powerPlayMap: new Map(allData.powerPlayStats.map((s) => [s.playerId, s])),
    puckPossessionMap: new Map(
      allData.puckPossessionStats.map((s) => [s.playerId, s])
    ),
    satCountsMap: new Map(allData.satCountsStats.map((s) => [s.playerId, s])),
    satPercentagesMap: new Map(
      allData.satPercentagesStats.map((s) => [s.playerId, s])
    ),
    scoringRatesMap: new Map(
      allData.scoringRatesStats.map((s) => [s.playerId, s])
    ),
    scoringPerGameMap: new Map(
      allData.scoringPerGameStats.map((s) => [s.playerId, s])
    ),
    shotTypeMap: new Map(allData.shotTypeStats.map((s) => [s.playerId, s])),
    timeOnIceMap: new Map(allData.timeOnIceStats.map((s) => [s.playerId, s]))
  };

  const recordsToUpsert: SkaterDbRecord[] = allData.skaterStats.map((stat) =>
    mapApiDataToDbRecord(stat, dataMaps, formattedDate, seasonId)
  );

  if (recordsToUpsert.length > 0) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < recordsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = recordsToUpsert.slice(i, i + CHUNK_SIZE);

      const { error } = await supabase.from(tableName).upsert(chunk, {
        onConflict: "player_id, date"
      });

      if (error) {
        console.error(
          `Error upserting chunk to ${tableName} for date ${formattedDate}:`,
          error
        );
        throw new Error(
          `Supabase upsert failed for ${tableName} (chunk starting at index ${i}): ${error.message}`
        );
      }
    }
    console.log(
      `Successfully upserted ${recordsToUpsert.length} records to ${tableName} for ${formattedDate}`
    );
  }
  return recordsToUpsert.length;
}

/**
 * Determine which game type(s) to fetch based on the date and season info
 * Now uses regularSeasonEndDate and seasonEndDate to correctly identify playoffs.
 */
function determineGameTypesToFetch(
  date: string,
  regularSeasonEndDate: string,
  seasonEndDate: string
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
  seasonEndDate: string // Pass the overall season end date
): Promise<{
  message: string;
  success: boolean;
  totalUpdates: number;
  rowsFetched: number;
  errors: number;
}> {
  // Add rowsFetched and errors to return type
  // No direct console.log here, as processDate will handle the detailed logging
  // for individual dates. This function primarily orchestrates fetching and upserting.

  const { fetchRegularSeason, fetchPlayoffs } = determineGameTypesToFetch(
    date,
    regularSeasonEndDate,
    seasonEndDate // Pass to determineGameTypesToFetch
  );

  let regularSeasonUpdates = 0;
  let playoffUpdates = 0;
  let regularSeasonFetched = 0;
  let playoffFetched = 0;
  let errorsEncountered = 0;
  let gameTypeMessage = "None"; // Default in case no relevant game type is found

  try {
    if (fetchRegularSeason) {
      console.log(`  > Fetching Regular Season data...`);
      const regularSeasonData = await fetchDataForGameType(2, date);
      regularSeasonFetched = regularSeasonData.skaterStats.length;
      regularSeasonUpdates = await processAndUpsertGameTypeData(
        regularSeasonData,
        "wgo_skater_stats",
        date,
        seasonId
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
        seasonId
      );
      if (gameTypeMessage === "Regular Season") {
        // Should not happen with current logic, but for robustness
        gameTypeMessage += " & Playoffs";
      } else {
        gameTypeMessage = "Playoffs";
      }
    }
  } catch (error: any) {
    console.error(
      `  > Error during data fetching/upserting for ${date}: ${error.message}`
    );
    errorsEncountered = 1; // Mark as having encountered an error for the date
    // Re-throw if it's a critical error that should stop the overall process
    // For now, let it be caught by the calling function's retry logic.
  }

  const totalUpdates = regularSeasonUpdates + playoffUpdates;
  const totalFetched = regularSeasonFetched + playoffFetched;

  return {
    message: `Skater stats processed for ${date} (${gameTypeMessage}).`,
    success: errorsEncountered === 0, // Success if no errors encountered during this date's processing
    totalUpdates,
    rowsFetched: totalFetched,
    errors: errorsEncountered
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
      .limit(1)
  ]);

  if (regularSeasonResult.error && playoffResult.error) {
    console.error("Error fetching most recent dates:", {
      regularError: regularSeasonResult.error,
      playoffError: playoffResult.error
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
  arg?: boolean | { fullRefresh?: boolean; startDate?: string }
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
      formatISO(startDate, { representation: "date" })
    );
  } else if (fullRefresh) {
    startDate = parseISO(currentSeason.regularSeasonStartDate);
    console.log(
      "Full refresh: Starting from season start date:",
      formatISO(startDate, { representation: "date" })
    );
  } else {
    const mostRecentDate = await getMostRecentDateFromDB();
    if (mostRecentDate) {
      startDate = addDays(parseISO(mostRecentDate), 1);
      console.log(
        "Incremental update: Starting from",
        formatISO(startDate, { representation: "date" })
      );
    } else {
      startDate = parseISO(currentSeason.regularSeasonStartDate);
      console.log(
        "No existing data: Starting from season start date:",
        formatISO(startDate, { representation: "date" })
      );
    }
  }

  let totalUpdates = 0;
  const datesProcessed: string[] = [];
  const failedDates: string[] = [];
  let currentDate = startDate;

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  if (isBefore(finalEndDate, startDate)) {
    console.log(
      "Database is already up to date, or target date is before start date."
    );
    return {
      message: "Database is already up to date.",
      success: true,
      totalUpdates: 0,
      datesProcessed: [],
      failedDates: []
    };
  }

  const totalDaysToProcess = differenceInDays(finalEndDate, startDate) + 1; // +1 to include the end date
  let daysProcessedCount = 0; // Initialize counter for progress

  console.log(
    `Initiating update for dates from ${formatISO(startDate, {
      representation: "date"
    })} to ${formatISO(finalEndDate, { representation: "date" })} (Current Season End: ${formatISO(currentSeason.seasonEndDate, { representation: "date" })})`
  );

  while (
    isBefore(currentDate, finalEndDate) ||
    currentDate.toDateString() === finalEndDate.toDateString()
  ) {
    const formattedDate = formatISO(currentDate, { representation: "date" });
    let success = false;
    let currentTotalUpdates = 0; // Track updates for the current date's attempts
    let currentRowsFetched = 0; // Track fetched rows for current date
    let currentErrors = 0; // Track errors for current date

    const seasonInfo = await getSeasonFromDate(formattedDate);
    if (!seasonInfo) {
      console.error(
        `|------------------------------------------------------------|`
      );
      console.error(
        `Could not determine season for date ${formattedDate}, skipping...`
      );
      console.error(
        `|------------------------------------------------------------|`
      );
      failedDates.push(formattedDate);
      currentDate = addDays(currentDate, 1);
      daysProcessedCount++; // Increment counter even if skipped
      continue;
    }

    // Calculate progress for the current date
    const progressPercent =
      totalDaysToProcess > 0
        ? Math.min(
            100,
            Math.round((daysProcessedCount / totalDaysToProcess) * 100)
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
          `${progressPercent}%` // Pass percentage
        );
        currentTotalUpdates = result.totalUpdates;
        currentRowsFetched = result.rowsFetched;
        currentErrors = result.errors;

        if (currentErrors === 0) {
          // Only consider successful if no errors occurred in processDate
          totalUpdates += currentTotalUpdates;
          if (!datesProcessed.includes(formattedDate)) {
            // Prevent duplicates if retried successfully
            datesProcessed.push(formattedDate);
          }
          success = true;
          break;
        }
      } catch (error: any) {
        // Error already logged by processDate, just indicate failure for retry loop
        currentErrors = 1;
      }
    }

    if (!success) {
      // This means all attempts for this date failed or resulted in errors
      if (!failedDates.includes(formattedDate)) {
        // Prevent duplicates
        failedDates.push(formattedDate);
      }
    }
    daysProcessedCount++; // Increment counter after processing a date
    currentDate = addDays(currentDate, 1);
  }

  if (failedDates.length > 0) {
    console.log(`\n--- RETRYING ${failedDates.length} FAILED DATES ---`);
    const retryFailedDates: string[] = [];
    const totalRetries = failedDates.length;
    let retriesCompleted = 0;

    for (const failedDate of failedDates) {
      let retrySuccess = false;
      const seasonInfo = await getSeasonFromDate(failedDate);
      if (!seasonInfo) {
        console.error(
          `Could not determine season for failed date ${failedDate} during retry, skipping.`
        );
        retryFailedDates.push(failedDate);
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
            `${progressPercent}%`
          );
          if (result.errors === 0) {
            totalUpdates += result.totalUpdates;
            if (!datesProcessed.includes(failedDate)) {
              datesProcessed.push(failedDate);
            }
            retrySuccess = true;
            break;
          }
        } catch (error: any) {
          // Error already logged by processDate
        }
      }

      if (!retrySuccess) {
        retryFailedDates.push(failedDate);
      }
      retriesCompleted++;
    }

    failedDates.length = 0;
    failedDates.push(...retryFailedDates);
  }

  if (failedDates.length > 0) {
    console.error(
      `\n--- FINAL RESULT: ${failedDates.length} dates could not be processed after all retries: ${failedDates.join(", ")} ---`
    );
  }

  return {
    message: `All skater stats updated successfully. Processed ${datesProcessed.length} distinct dates with ${totalUpdates} total updates.`,
    success: failedDates.length === 0,
    totalUpdates,
    datesProcessed,
    failedDates
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
    regularSeasonEndDate: season.regularSeasonEndDate
  }));
}

/**
 * Processes all data for a single date with intelligent game type fetching.
 * Throws an error on failure, which is caught by the calling function.
 * @returns The total number of player records updated for the date.
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
  progressPercent: string = "" // New parameter for % progress
): Promise<{ totalUpdates: number; rowsFetched: number; errors: number }> {
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
    `Date:`.padEnd(LABEL_PAD) + `${formattedDate}`.padStart(VALUE_PAD)
  );
  console.log(
    `Season ID:`.padEnd(LABEL_PAD) + `${seasonId}`.padStart(VALUE_PAD)
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
      `${seasonTypeMessage}`.padStart(VALUE_PAD)
  );
  console.log(``); // Blank line for spacing

  console.log(
    `Season Start Date:`.padEnd(LABEL_PAD) +
      `${formatISO(seasonStart, { representation: "date" })}`.padStart(
        VALUE_PAD
      )
  );
  console.log(
    `Regular Season End Date:`.padEnd(LABEL_PAD) +
      `${formatISO(regularSeasonEnd, { representation: "date" })}`.padStart(
        VALUE_PAD
      )
  );
  console.log(
    `Playoffs Start Date:`.padEnd(LABEL_PAD) +
      `${formatISO(playoffsStartDate, { representation: "date" })}`.padStart(
        VALUE_PAD
      )
  );
  console.log(
    `Season End Date:`.padEnd(LABEL_PAD) +
      `${formatISO(seasonEnd, { representation: "date" })}`.padStart(VALUE_PAD)
  );
  console.log(``); // Blank line for spacing

  let totalUpdates = 0;
  let rowsFetched = 0;
  let errors = 0;

  try {
    const result = await updateSkaterStats(
      formattedDate,
      seasonId,
      regularSeasonEndDate,
      endDate // Pass the overall season end date
    );

    totalUpdates = result.totalUpdates;
    rowsFetched = result.rowsFetched;
    errors = result.errors;

    console.log(
      `Rows Fetched:`.padEnd(LABEL_PAD) +
        `${String(rowsFetched)}`.padStart(VALUE_PAD)
    );
    console.log(
      `Rows Upserted:`.padEnd(LABEL_PAD) +
        `${String(totalUpdates)}`.padStart(VALUE_PAD)
    );
    console.log(
      `Errors:`.padEnd(LABEL_PAD) + `${String(errors)}`.padStart(VALUE_PAD)
    );
  } catch (error: any) {
    console.error(
      `Error during processDate for ${formattedDate}: ${error.message}`
    );
    errors = 1; // Mark as error
    console.log(
      `Rows Fetched:`.padEnd(LABEL_PAD) +
        `${String(rowsFetched)}`.padStart(VALUE_PAD)
    );
    console.log(
      `Rows Upserted:`.padEnd(LABEL_PAD) +
        `${String(totalUpdates)}`.padStart(VALUE_PAD)
    );
    console.log(
      `Errors:`.padEnd(LABEL_PAD) + `${String(errors)}`.padStart(VALUE_PAD)
    );
    throw error; // Re-throw to be caught by the retry logic in calling function
  } finally {
    console.log(``); // Blank line for spacing
    console.log(
      `Finished processing Date:`.padEnd(LABEL_PAD) +
        `${formattedDate}`.padStart(VALUE_PAD)
    );
    console.log(
      `|------------------------------------------------------------|`
    );
    console.log(`\n`); // New line to differentiate dates
  }

  return { totalUpdates, rowsFetched, errors };
}
// Affected portion: updateAllStatsForAllSeasons function
async function updateAllStatsForAllSeasons() {
  const allSeasons = await getAllSeasonsFromDB();
  let totalUpdates = 0;
  const failedDates: { date: string; seasonId: number }[] = [];

  if (allSeasons.length === 0) {
    return {
      message: "No seasons found in the database to refresh.",
      success: true,
      totalUpdates: 0
    };
  }

  console.log(`Starting full refresh for ${allSeasons.length} seasons.`);

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  let totalDaysAcrossAllSeasons = 0;
  for (const season of allSeasons) {
    totalDaysAcrossAllSeasons +=
      differenceInDays(parseISO(season.endDate), parseISO(season.startDate)) +
      1;
  }
  let globalDaysProcessedCount = 0;

  for (const season of allSeasons) {
    console.log(
      `\n--- Processing Season: ${season.seasonId} (${season.startDate} to ${season.endDate}) ---`
    );
    let currentDate = parseISO(season.startDate);
    const endDate = parseISO(season.endDate);
    const seasonDaysToProcess = differenceInDays(endDate, currentDate) + 1;
    let seasonDaysProcessedCount = 0;

    while (
      isBefore(currentDate, endDate) ||
      currentDate.toDateString() === endDate.toDateString()
    ) {
      const formattedDate = formatISO(currentDate, { representation: "date" });
      let success = false;
      let currentErrors = 0;

      // Use the seasonInfo directly as it's iterated per season
      const seasonInfoForDate = {
        seasonId: season.seasonId,
        startDate: season.startDate,
        endDate: season.endDate,
        regularSeasonEndDate: season.regularSeasonEndDate
      };

      const globalProgressPercent =
        totalDaysAcrossAllSeasons > 0
          ? Math.min(
              100,
              Math.round(
                (globalDaysProcessedCount / totalDaysAcrossAllSeasons) * 100
              )
            )
          : 100;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await processDate(
            formattedDate,
            seasonInfoForDate, // Pass the season info object
            attempt, // Pass the attempt number
            `${globalDaysProcessedCount + 1}/${totalDaysAcrossAllSeasons}`, // X/Y for global progress
            `${globalProgressPercent}%` // % for global progress
          );
          currentErrors = result.errors;
          if (currentErrors === 0) {
            totalUpdates += result.totalUpdates;
            success = true;
            break;
          }
        } catch (error: any) {
          currentErrors = 1; // Mark as error
        }
      }

      if (!success) {
        failedDates.push({ date: formattedDate, seasonId: season.seasonId });
      }
      globalDaysProcessedCount++;
      seasonDaysProcessedCount++;
      currentDate = addDays(currentDate, 1);
    }
  }

  if (failedDates.length > 0) {
    console.log(`\n--- RETRYING ${failedDates.length} FAILED DATES ---`);
    const retryFailedDates: { date: string; seasonId: number }[] = [];
    const totalRetries = failedDates.length;
    let retriesCompleted = 0;

    for (const { date: failedDate, seasonId } of failedDates) {
      const season = allSeasons.find((s) => s.seasonId === seasonId);
      if (!season) {
        console.error(
          `Season ${seasonId} not found for failed date ${failedDate} during retry, skipping.`
        );
        retryFailedDates.push({ date: failedDate, seasonId });
        retriesCompleted++;
        continue;
      }

      let retrySuccess = false;
      const seasonInfoForFailedDate = {
        seasonId: season.seasonId,
        startDate: season.startDate,
        endDate: season.endDate,
        regularSeasonEndDate: season.regularSeasonEndDate
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
            `${retryProgressPercent}%`
          );
          if (result.errors === 0) {
            totalUpdates += result.totalUpdates;
            retrySuccess = true;
            break;
          }
        } catch (error: any) {
          // Error already logged by processDate
        }
      }

      if (!retrySuccess) {
        retryFailedDates.push({ date: failedDate, seasonId });
      }
      retriesCompleted++;
    }

    failedDates.length = 0;
    failedDates.push(...retryFailedDates);
  }

  if (failedDates.length > 0) {
    console.error(
      `\n--- FINAL RESULT: ${failedDates.length} dates could not be processed after all retries: ${failedDates.map((f) => f.date).join(", ")} ---\n`
    );
  }

  const message = `All-time refresh complete. Processed ${allSeasons.length} seasons with a total of ${totalUpdates} updates.`;
  console.log(message);
  return {
    message,
    success: failedDates.length === 0,
    totalUpdates,
    failedDates: failedDates.map((f) => f.date)
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
      (res) => res.json() as Promise<NHLApiResponse>
    );
    return response.data;
  };
  const regularSeasonData = await fetchPlayerDataForGameType(2);
  const playoffData = await fetchPlayerDataForGameType(3);
  return { regularSeasonData, playoffData };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const jobName = "update-wgo-skaters";
  let status: "success" | "failure" = "success";
  let details: any = {};
  let totalUpdates = 0;

  try {
    const {
      date,
      playerId,
      action,
      fullRefresh: fullRefreshParam,
      startDate: startDateParam, // Accept startDate
      playerFullName: rawPlayerFullName
    } = req.query;
    const fullRefresh = fullRefreshParam === "true" || fullRefreshParam === "1";
    const startDate =
      typeof startDateParam === "string" ? startDateParam : undefined;
    const playerFullName = Array.isArray(rawPlayerFullName)
      ? rawPlayerFullName[0]
      : rawPlayerFullName;
    let result: any;

    if (action === "all_seasons_full_refresh") {
      console.log("Action 'all_seasons_full_refresh' triggered.");
      result = await updateAllStatsForAllSeasons();
      totalUpdates = result.totalUpdates;
      details = { message: result.message, failedDates: result.failedDates };
      res.status(200).json(result);
    } else if (action === "all") {
      console.log(
        `Action 'all' triggered. Full refresh: ${fullRefresh}, Start date: ${startDate}`
      );
      result = await updateAllSkatersFromMostRecentDate({
        fullRefresh,
        startDate
      });
      totalUpdates = result.totalUpdates;
      details = {
        message: result.message,
        datesProcessed: result.datesProcessed,
        failedDates: result.failedDates,
        fullRefresh,
        startDate
      };
      res.status(200).json({ ...result, fullRefresh, startDate });
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
        seasonInfo.endDate // Pass season's actual end date
      );
      totalUpdates = result.totalUpdates;
      details = { message: result.message };
      res.status(200).json(result);
    } else if (playerId && typeof playerId === "string") {
      console.log(`Player ID parameter found: ${playerId}`);
      const name = playerFullName || `PlayerID ${playerId}`;
      const resultData = await fetchDataForPlayer(playerId, name);
      result = {
        message: `Data fetched successfully for player ${name}.`,
        success: true,
        data: resultData
      };
      details = { message: result.message, playerId };
      res.status(200).json(result);
    } else {
      status = "failure";
      details = {
        message:
          "Missing or invalid parameters. Provide 'action=all_seasons_full_refresh', 'action=all', 'date', or 'playerId'."
      };
      res.status(400).json(details);
    }
  } catch (e: any) {
    console.error("Handler error:", e);
    status = "failure";
    details = { error: e.message, stack: e.stack };
    res.status(500).json(details);
  } finally {
    if (req.query.action) {
      // Only log cron jobs for actions
      await supabase.from("cron_job_audit").insert({
        job_name: jobName,
        status: status,
        rows_affected: totalUpdates,
        details: details
      });
    }
  }
}
