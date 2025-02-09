// PATH: /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/update-standings-details/index.ts

import { NextApiRequest, NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";
import { format, parseISO, addDays } from "date-fns";
import { getCurrentSeason } from "lib/NHL/server";
import { SupabaseClient } from "@supabase/supabase-js";

export default adminOnly(async function handler(
  req: NextApiRequest & { supabase?: SupabaseClient },
  res: NextApiResponse
) {
  if (!req.supabase) {
    return res.status(500).json({
      success: false,
      message:
        "Supabase client not found on request. Ensure adminOnly middleware is used."
    });
  }

  const supabase = req.supabase;
  const { date } = req.query;

  try {
    // 1) Fetch current season info
    const seasonInfo = await getCurrentSeason();
    if (!seasonInfo) {
      return res.status(500).json({
        success: false,
        message: "Failed to get current season."
      });
    }

    const seasonId = seasonInfo.seasonId;
    const seasonStartDate = parseISO(seasonInfo.regularSeasonStartDate);
    const todayDate = new Date();

    // 2) Determine processing mode based on the query parameter ?date
    if (typeof date === "string") {
      if (date.toLowerCase() === "all") {
        // Process the entire season from season start to today
        await updateStandingsDateRange(
          supabase,
          seasonId,
          seasonStartDate,
          todayDate
        );
        return res.json({
          success: true,
          message: "Updated ALL dates for the current season."
        });
      } else {
        // Process a specific date provided in the query parameter
        const specificDate = parseISO(date);
        if (isNaN(specificDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid date format. Use YYYY-MM-DD."
          });
        }
        await updateStandingsForDate(supabase, seasonId, specificDate);
        return res.json({
          success: true,
          message: `Updated standings for ${date}.`
        });
      }
    } else {
      // No date param provided: do an incremental update.
      // Here we query the most recent date in nhl_standings_details.
      const { data: maxDateRow, error } = await supabase
        .from("nhl_standings_details")
        .select("date")
        .eq("season_id", seasonId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error querying max date:", error);
        return res.status(500).json({
          success: false,
          message: "Database error."
        });
      }

      // Change: Instead of starting from the next day,
      // we start from the most recent date (to overwrite it) if it exists.
      let start = maxDateRow?.date
        ? parseISO(maxDateRow.date)
        : seasonStartDate;

      // If the start date is in the future, nothing to update.
      if (start > todayDate) {
        return res.json({
          success: true,
          message: "Database already up-to-date."
        });
      }

      await updateStandingsDateRange(supabase, seasonId, start, todayDate);
      return res.json({
        success: true,
        message: `Updated standings from ${format(
          start,
          "yyyy-MM-dd"
        )} to ${format(todayDate, "yyyy-MM-dd")}`
      });
    }
  } catch (error: any) {
    console.error("Update failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Iterate from startDate to endDate (inclusive), updating each day
async function updateStandingsDateRange(
  supabase: SupabaseClient,
  seasonId: number,
  startDate: Date,
  endDate: Date
) {
  let current = startDate;
  while (current <= endDate) {
    await updateStandingsForDate(supabase, seasonId, current);
    current = addDays(current, 1);
  }
}

// Fetch the standings data from the NHL API for one date and upsert it into Supabase.
async function updateStandingsForDate(
  supabase: SupabaseClient,
  seasonId: number,
  dateObj: Date
) {
  const dateString = format(dateObj, "yyyy-MM-dd");
  const url = `https://api-web.nhle.com/v1/standings/${dateString}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NHL API error: ${response.status} for ${dateString}`);
  }

  const { standings } = await response.json();
  if (!standings?.length) {
    console.warn(`No standings data for ${dateString}`);
    return;
  }

  const rows = standings.map((item: any) => ({
    season_id: seasonId,
    date: dateString,
    team_abbrev: item.teamAbbrev.default,
    // Fields you confirmed
    conference_abbrev: item.conferenceAbbrev,
    conference_home_sequence: item.conferenceHomeSequence,
    conference_l10_sequence: item.conferenceL10Sequence,
    conference_name: item.conferenceName,
    conference_road_sequence: item.conferenceRoadSequence,
    conference_sequence: item.conferenceSequence,
    division_abbrev: item.divisionAbbrev,
    division_home_sequence: item.divisionHomeSequence,
    division_l10_sequence: item.divisionL10Sequence,
    division_name: item.divisionName,
    division_road_sequence: item.divisionRoadSequence,
    division_sequence: item.divisionSequence,
    game_type_id: item.gameTypeId,
    games_played: item.gamesPlayed,
    goal_differential: item.goalDifferential,
    goal_differential_pctg: item.goalDifferentialPctg,
    goal_against: item.goalAgainst,
    goal_for: item.goalFor,
    goals_for_pctg: item.goalsForPctg,
    // Home fields
    home_games_played: item.homeGamesPlayed,
    home_goal_differential: item.homeGoalDifferential,
    home_goals_against: item.homeGoalsAgainst,
    home_goals_for: item.homeGoalsFor,
    home_losses: item.homeLosses,
    home_ot_losses: item.homeOtLosses,
    home_points: item.homePoints,
    home_regulation_plus_ot_wins: item.homeRegulationPlusOtWins,
    home_regulation_wins: item.homeRegulationWins,
    home_wins: item.homeWins,
    // L10 fields
    l10_games_played: item.l10GamesPlayed,
    l10_goal_differential: item.l10GoalDifferential,
    l10_goals_against: item.l10GoalsAgainst,
    l10_goals_for: item.l10GoalsFor,
    l10_losses: item.l10Losses,
    l10_ot_losses: item.l10OtLosses,
    l10_points: item.l10Points,
    l10_regulation_plus_ot_wins: item.l10RegulationPlusOtWins,
    l10_regulation_wins: item.l10RegulationWins,
    l10_wins: item.l10Wins,
    // League
    league_home_sequence: item.leagueHomeSequence,
    league_l10_sequence: item.leagueL10Sequence,
    league_road_sequence: item.leagueRoadSequence,
    league_sequence: item.leagueSequence,
    // General
    losses: item.losses,
    ot_losses: item.otLosses,
    place_name: item.placeName?.default ?? "",
    point_pctg: item.pointPctg,
    points: item.points,
    regulation_plus_ot_win_pctg: item.regulationPlusOtWinPctg,
    regulation_plus_ot_wins: item.regulationPlusOtWins,
    regulation_win_pctg: item.regulationWinPctg,
    regulation_wins: item.regulationWins,
    // Road
    road_games_played: item.roadGamesPlayed,
    road_goal_differential: item.roadGoalDifferential,
    road_goals_against: item.roadGoalsAgainst,
    road_goals_for: item.roadGoalsFor,
    road_losses: item.roadLosses,
    road_ot_losses: item.roadOtLosses,
    road_points: item.roadPoints,
    road_regulation_plus_ot_wins: item.roadRegulationPlusOtWins,
    road_regulation_wins: item.roadRegulationWins,
    road_wins: item.roadWins,
    // Additional info
    shootout_losses: item.shootoutLosses,
    shootout_wins: item.shootoutWins,
    streak_code: item.streakCode,
    streak_count: item.streakCount,
    team_name_default: item.teamName.default,
    team_name_fr: item.teamName.fr,
    team_common_name: item.teamCommonName.default,
    waivers_sequence: item.waiversSequence,
    wildcard_sequence: item.wildcardSequence,
    win_pctg: item.winPctg,
    wins: item.wins
  }));

  // Upsert the rows into the database with error propagation
  const { error } = await supabase
    .from("nhl_standings_details")
    .upsert(rows)
    .throwOnError();

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}
