// calculateAverages.ts

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Initialize Supabase client
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_ANON_KEY as string
);

// Define Types for Clarity
type Player = {
  player_id: number;
  player_name: string;
  shoots_catches: string | null;
  position_code: string | null;
  birth_city: string | null;
  birth_date: string | null;
  current_team_abbreviation: string | null;
  current_team_name: string | null;
  draft_overall: number | null;
  draft_round: number | null;
  draft_year: number | null;
  first_season_for_game_type: number | null;
  nationality_code: string | null;
  weight: number | null;
  height: number | null;
  birth_country: string | null;
};

type SeasonStats = {
  season: string;
  games_played: number | null;
  points: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  plus_minus: number | null;
  ot_goals: number | null;
  gw_goals: number | null;
  pp_points: number | null;
  blocked_shots: number | null;
  empty_net_goals: number | null;
  empty_net_points: number | null;
  giveaways: number | null;
  hits: number | null;
  missed_shots: number | null;
  takeaways: number | null;
  d_zone_faceoffs: number | null;
  ev_faceoffs: number | null;
  n_zone_faceoffs: number | null;
  o_zone_faceoffs: number | null;
  pp_faceoffs: number | null;
  sh_faceoffs: number | null;
  total_faceoffs: number | null;
  d_zone_fol: number | null;
  d_zone_fow: number | null;
  ev_fol: number | null;
  ev_fow: number | null;
  n_zone_fol: number | null;
  n_zone_fow: number | null;
  o_zone_fol: number | null;
  o_zone_fow: number | null;
  pp_fol: number | null;
  pp_fow: number | null;
  sh_fol: number | null;
  sh_fow: number | null;
  total_fol: number | null;
  total_fow: number | null;
  es_goals_against: number | null;
  es_goals_for: number | null;
  pp_goals_against: number | null;
  pp_goals_for: number | null;
  sh_goals_against: number | null;
  sh_goals_for: number | null;
  game_misconduct_penalties: number | null;
  major_penalties: number | null;
  match_penalties: number | null;
  minor_penalties: number | null;
  misconduct_penalties: number | null;
  penalties: number | null;
  penalties_drawn: number | null;
  penalty_minutes: number | null;
  sh_assists: number | null;
  sh_goals: number | null;
  sh_points: number | null;
  sh_shots: number | null;
  sh_time_on_ice: number | null;
  pp_assists: number | null;
  pp_goals: number | null;
  sh_primary_assists: number | null;
  sh_individual_sat_for: number | null;
  sh_secondary_assists: number | null;
  pp_primary_assists: number | null;
  pp_secondary_assists: number | null;
  pp_shots: number | null;
  pp_toi: number | null;
  toi_per_game_5v5: number | null;
  sat_against: number | null;
  sat_ahead: number | null;
  sat_behind: number | null;
  sat_close: number | null;
  sat_for: number | null;
  sat_tied: number | null;
  sat_total: number | null;
  usat_against: number | null;
  usat_ahead: number | null;
  usat_behind: number | null;
  usat_close: number | null;
  usat_for: number | null;
  usat_tied: number | null;
  usat_total: number | null;
  assists_5v5: number | null;
  goals_5v5: number | null;
  points_5v5: number | null;
  total_primary_assists: number | null;
  total_secondary_assists: number | null;
  goals_backhand: number | null;
  goals_bat: number | null;
  goals_between_legs: number | null;
  goals_cradle: number | null;
  goals_deflected: number | null;
  goals_poke: number | null;
  goals_slap: number | null;
  goals_snap: number | null;
  goals_tip_in: number | null;
  goals_wrap_around: number | null;
  goals_wrist: number | null;
  shots_on_net_backhand: number | null;
  shots_on_net_bat: number | null;
  shots_on_net_between_legs: number | null;
  shots_on_net_cradle: number | null;
  shots_on_net_deflected: number | null;
  shots_on_net_poke: number | null;
  shots_on_net_slap: number | null;
  shots_on_net_snap: number | null;
  shots_on_net_tip_in: number | null;
  shots_on_net_wrap_around: number | null;
  shots_on_net_wrist: number | null;
  ev_time_on_ice: number | null;
  ot_time_on_ice: number | null;
  shifts: number | null;
  sat_percentage: number | null;
  sat_percentage_ahead: number | null;
  sat_percentage_behind: number | null;
  sat_percentage_close: number | null;
  sat_percentage_tied: number | null;
  usat_percentage: number | null;
  usat_percentage_ahead: number | null;
  usat_percentage_behind: number | null;
  usat_percentage_close: number | null;
  usat_percentage_tied: number | null;
  secondary_assists_5v5: number | null;
  primary_assists_5v5: number | null;
};

// Helper function to safely divide two numbers
const safeDivide = (numerator: number, denominator: number): number => {
  return denominator !== 0 ? numerator / denominator : 0;
};

// Function to calculate summed stats and averages
const calculateAveragedStats = (
  seasons: SeasonStats[],
  isCareer: boolean
): { averages: any; numberOfSeasons: number } => {
  const numberOfSeasons = seasons.length;

  if (numberOfSeasons === 0) {
    return { averages: {}, numberOfSeasons };
  }

  // Initialize accumulators
  const totals: { [key: string]: number } = {};

  // Sum up all relevant stats
  seasons.forEach((season) => {
    for (const [key, value] of Object.entries(season)) {
      if (typeof value === "number" && !isNaN(value)) {
        totals[key] = (totals[key] || 0) + value;
      }
    }
  });

  // Initialize the averages object
  const averages: { [key: string]: number | null } = {};

  // 1. Sum Total divided by Number of Seasons
  const sumDividedBySeasonsStats = [
    "games_played",
    "points",
    "goals",
    "assists",
    "shots",
    "plus_minus",
    "ot_goals",
    "gw_goals",
    "pp_points",
    "blocked_shots",
    "empty_net_goals",
    "empty_net_points",
    "giveaways",
    "hits",
    "missed_shots",
    "takeaways",
    "d_zone_faceoffs",
    "ev_faceoffs",
    "n_zone_faceoffs",
    "o_zone_faceoffs",
    "pp_faceoffs",
    "sh_faceoffs",
    "total_faceoffs",
    "d_zone_fol",
    "d_zone_fow",
    "ev_fol",
    "ev_fow",
    "n_zone_fol",
    "n_zone_fow",
    "o_zone_fol",
    "o_zone_fow",
    "pp_fol",
    "pp_fow",
    "sh_fol",
    "sh_fow",
    "total_fol",
    "total_fow",
    "es_goals_against",
    "es_goals_for",
    "pp_goals_against",
    "pp_goals_for",
    "sh_goals_against",
    "sh_goals_for",
    "game_misconduct_penalties",
    "major_penalties",
    "match_penalties",
    "minor_penalties",
    "misconduct_penalties",
    "penalties",
    "penalties_drawn",
    "penalty_minutes",
    "sh_assists",
    "sh_goals",
    "sh_points",
    "sh_shots",
    "sh_time_on_ice",
    "pp_assists",
    "pp_goals",
    "sh_primary_assists",
    "sh_individual_sat_for",
    "sh_secondary_assists",
    "pp_primary_assists",
    "pp_secondary_assists",
    "pp_shots",
    "pp_toi",
    "toi_per_game_5v5",
    "sat_against",
    "sat_ahead",
    "sat_behind",
    "sat_close",
    "sat_for",
    "sat_tied",
    "sat_total",
    "usat_against",
    "usat_ahead",
    "usat_behind",
    "usat_close",
    "usat_for",
    "usat_tied",
    "usat_total",
    "assists_5v5",
    "goals_5v5",
    "points_5v5",
    "total_primary_assists",
    "total_secondary_assists",
    "goals_backhand",
    "goals_bat",
    "goals_between_legs",
    "goals_cradle",
    "goals_deflected",
    "goals_poke",
    "goals_slap",
    "goals_snap",
    "goals_tip_in",
    "goals_wrap_around",
    "goals_wrist",
    "shots_on_net_backhand",
    "shots_on_net_bat",
    "shots_on_net_between_legs",
    "shots_on_net_cradle",
    "shots_on_net_deflected",
    "shots_on_net_poke",
    "shots_on_net_slap",
    "shots_on_net_snap",
    "shots_on_net_tip_in",
    "shots_on_net_wrap_around",
    "shots_on_net_wrist",
    "ev_time_on_ice",
    "ot_time_on_ice",
    "shifts",
    "sat_percentage",
    "sat_percentage_ahead",
    "sat_percentage_behind",
    "sat_percentage_close",
    "sat_percentage_tied",
    "usat_percentage",
    "usat_percentage_ahead",
    "usat_percentage_behind",
    "usat_percentage_close",
    "usat_percentage_tied",
    "secondary_assists_5v5",
    "primary_assists_5v5"
  ];

  sumDividedBySeasonsStats.forEach((stat) => {
    averages[`${stat}_avg`] = safeDivide(totals[stat] || 0, numberOfSeasons);
  });

  // 2. Per Game Stats: total stat divided by total games played
  const perGameStats = [
    "ev_time_on_ice",
    "ot_time_on_ice",
    "shifts",
    "toi_per_game",
    "es_toi_per_game",
    "points_per_game",
    "pp_toi_per_game",
    "sh_toi_per_game",
    "penalty_seconds_per_game",
    "sh_time_on_ice_pct_per_game",
    "pp_toi_pct_per_game"
  ];

  const totalGamesPlayed = totals["games_played"] || 1; // Prevent division by zero

  perGameStats.forEach((stat) => {
    averages[`${stat}_avg`] = safeDivide(totals[stat] || 0, totalGamesPlayed);
  });

  // 3. Per Shift Stats: total stat divided by total shifts
  const perShiftStats = ["time_on_ice_per_shift"];

  const totalShifts = totals["shifts"] || 1; // Prevent division by zero

  perShiftStats.forEach((stat) => {
    averages[`${stat}_avg`] = safeDivide(totals[stat] || 0, totalShifts);
  });

  // 4. Per TOI Stats: stat divided by total TOI in seconds
  const perToiStats = ["penalty_minutes"];

  const totalToiSeconds = totals["pp_toi"] || 1; // Prevent division by zero

  perToiStats.forEach((stat) => {
    if (stat === "penalty_minutes") {
      averages["penalty_minutes_per_toi_avg"] = safeDivide(
        totals[stat] || 0,
        totalToiSeconds
      );
    }
  });

  // 5. Percentage Stats
  const percentageCalculations: { [key: string]: () => number } = {
    shooting_percentage: () =>
      safeDivide(totals["goals"] || 0, totals["shots"] || 1),
    fow_percentage: () =>
      safeDivide(
        totals["fow"] || 0,
        (totals["fow"] || 0) + (totals["fol"] || 0)
      ),
    d_zone_fo_percentage: () =>
      safeDivide(
        totals["d_zone_fow"] || 0,
        (totals["d_zone_fow"] || 0) + (totals["d_zone_fol"] || 0)
      ),
    ev_faceoff_percentage: () =>
      safeDivide(totals["ev_fow"] || 0, totals["ev_faceoffs"] || 1),
    n_zone_fo_percentage: () =>
      safeDivide(totals["n_zone_fow"] || 0, totals["n_zone_faceoffs"] || 1),
    o_zone_fo_percentage: () =>
      safeDivide(totals["o_zone_fow"] || 0, totals["o_zone_faceoffs"] || 1),
    pp_faceoff_percentage: () =>
      safeDivide(totals["pp_fow"] || 0, totals["pp_faceoffs"] || 1),
    sh_faceoff_percentage: () =>
      safeDivide(totals["sh_fow"] || 0, totals["sh_faceoffs"] || 1),
    es_goals_for_percentage: () =>
      safeDivide(
        totals["es_goals_for"] || 0,
        (totals["es_goals_for"] || 0) + (totals["es_goals_against"] || 0)
      ),
    sh_shooting_percentage: () =>
      safeDivide(totals["sh_goals"] || 0, totals["sh_shots"] || 1),
    pp_shooting_percentage: () =>
      safeDivide(totals["pp_goals"] || 0, totals["pp_shots"] || 1),
    goals_pct: () =>
      safeDivide(
        (totals["es_goals_for"] || 0) +
          (totals["pp_goals_for"] || 0) +
          (totals["sh_goals_for"] || 0),
        (totals["es_goals_for"] || 0) +
          (totals["pp_goals_for"] || 0) +
          (totals["sh_goals_for"] || 0) +
          (totals["es_goals_against"] || 0) +
          (totals["pp_goals_against"] || 0) +
          (totals["sh_goals_against"] || 0)
      ),
    on_ice_shooting_pct: () =>
      safeDivide(totals["sat_for"] || 0, totals["goals_for"] || 1),
    faceoff_pct_5v5: () =>
      safeDivide(totals["ev_fow"] || 0, totals["ev_faceoffs"] || 1),
    sat_pct: () =>
      safeDivide(
        totals["sat_for"] || 0,
        (totals["sat_for"] || 0) + (totals["sat_against"] || 0)
      )
  };

  for (const [key, value] of Object.entries(percentageCalculations)) {
    averages[`${key}_avg`] = value();
  }

  // 6. Additional Percentage Stats from User Instructions
  // Assuming 'zone_start_pct', 'shooting_percentage_5v5', etc., are also to be computed similarly
  const additionalPercentageStats = [
    "zone_start_pct",
    "shooting_percentage_5v5",
    "skater_save_pct_5v5",
    "skater_shooting_plus_save_pct_5v5",
    "o_zone_start_pct_5v5",
    "on_ice_shooting_pct_5v5",
    "zone_start_pct_5v5"
  ];

  additionalPercentageStats.forEach((stat) => {
    // Placeholder calculation; adjust based on actual definitions
    averages[`${stat}_avg`] = null; // Set to null or implement actual calculation
  });

  // 7. Per 60 Stats: (stat / total TOI in seconds) * 3600
  const per60Stats = [
    "blocks",
    "giveaways",
    "hits",
    "takeaways",
    "penalties_drawn",
    "penalties_taken",
    "pp_goals_against",
    "sh_goals",
    "sh_individual_sat_for",
    "sh_points",
    "sh_primary_assists",
    "sh_secondary_assists",
    "sh_shots",
    "pp_goals_for",
    "pp_goals",
    "pp_individual_sat_for",
    "pp_points",
    "pp_primary_assists",
    "pp_secondary_assists",
    "pp_shots",
    "individual_sat_for",
    "individual_shots_for",
    "assists_5v5",
    "goals_5v5",
    "points_5v5",
    "primary_assists_5v5",
    "secondary_assists_5v5"
  ];

  per60Stats.forEach((stat) => {
    const statValue = totals[stat] || 0;
    averages[`${stat}_per_60_avg`] =
      safeDivide(statValue, totalToiSeconds) * 3600;
  });

  // 8. Relative Stats: Set to null as per user instructions
  const relativeStats = ["sat_relative", "usat_relative", "sat_relative_5v5"];

  relativeStats.forEach((stat) => {
    averages[`${stat}_avg`] = null; // Placeholder for future implementation
  });

  return { averages, numberOfSeasons };
};

// Function to process and upsert averages into a specified table
const processAndUpsertAverages = async (isCareer: boolean) => {
  console.log(
    `\nStarting ${isCareer ? "Career" : "Three-Year"} Averages Calculation...`
  );

  // Fetch all players
  const { data: players, error: playersError } = await supabase
    .from("wgo_skater_stats_totals")
    .select(
      `
      player_id,
      player_name,
      shoots_catches,
      position_code,
      birth_city,
      birth_date,
      current_team_abbreviation,
      current_team_name,
      draft_overall,
      draft_round,
      draft_year,
      first_season_for_game_type,
      nationality_code,
      weight,
      height,
      birth_country
    `
    )
    .neq("player_id", null)
    .order("player_id", { ascending: true });

  if (playersError) {
    console.error("Error fetching players:", playersError);
    return;
  }

  console.log(`Fetched ${players!.length} players.`);

  for (const player of players!) {
    // Fetch all seasons for the player, ordered descending by season
    const { data: seasons, error: seasonsError } = await supabase
      .from("wgo_skater_stats_totals")
      .select(
        `
        season,
        games_played,
        points,
        goals,
        assists,
        shots,
        plus_minus,
        ot_goals,
        gw_goals,
        pp_points,
        blocked_shots,
        empty_net_goals,
        empty_net_points,
        giveaways,
        hits,
        missed_shots,
        takeaways,
        d_zone_faceoffs,
        ev_faceoffs,
        n_zone_faceoffs,
        o_zone_faceoffs,
        pp_faceoffs,
        sh_faceoffs,
        total_faceoffs,
        d_zone_fol,
        d_zone_fow,
        ev_fol,
        ev_fow,
        n_zone_fol,
        n_zone_fow,
        o_zone_fol,
        o_zone_fow,
        pp_fol,
        pp_fow,
        sh_fol,
        sh_fow,
        total_fol,
        total_fow,
        es_goals_against,
        es_goals_for,
        pp_goals_against,
        pp_goals_for,
        sh_goals_against,
        sh_goals_for,
        game_misconduct_penalties,
        major_penalties,
        match_penalties,
        minor_penalties,
        misconduct_penalties,
        penalties,
        penalties_drawn,
        penalty_minutes,
        sh_assists,
        sh_goals,
        sh_points,
        sh_shots,
        sh_time_on_ice,
        pp_assists,
        pp_goals,
        sh_primary_assists,
        sh_individual_sat_for,
        sh_secondary_assists,
        pp_primary_assists,
        pp_secondary_assists,
        pp_shots,
        pp_toi,
        toi_per_game_5v5,
        sat_against,
        sat_ahead,
        sat_behind,
        sat_close,
        sat_for,
        sat_tied,
        sat_total,
        usat_against,
        usat_ahead,
        usat_behind,
        usat_close,
        usat_for,
        usat_tied,
        usat_total,
        assists_5v5,
        goals_5v5,
        points_5v5,
        total_primary_assists,
        total_secondary_assists,
        goals_backhand,
        goals_bat,
        goals_between_legs,
        goals_cradle,
        goals_deflected,
        goals_poke,
        goals_slap,
        goals_snap,
        goals_tip_in,
        goals_wrap_around,
        goals_wrist,
        shots_on_net_backhand,
        shots_on_net_bat,
        shots_on_net_between_legs,
        shots_on_net_cradle,
        shots_on_net_deflected,
        shots_on_net_poke,
        shots_on_net_slap,
        shots_on_net_snap,
        shots_on_net_tip_in,
        shots_on_net_wrap_around,
        shots_on_net_wrist,
        ev_time_on_ice,
        ot_time_on_ice,
        shifts,
        sat_percentage,
        sat_percentage_ahead,
        sat_percentage_behind,
        sat_percentage_close,
        sat_percentage_tied,
        usat_percentage,
        usat_percentage_ahead,
        usat_percentage_behind,
        usat_percentage_close,
        usat_percentage_tied,
        secondary_assists_5v5,
        primary_assists_5v5
      `
      )
      .eq("player_id", player.player_id)
      .order("season", { ascending: false });

    if (seasonsError) {
      console.error(
        `Error fetching seasons for player ${player.player_id}:`,
        seasonsError
      );
      continue;
    }

    // Determine relevant seasons based on the type of averages
    let relevantSeasons: SeasonStats[] = [];

    if (isCareer) {
      relevantSeasons = seasons!;
    } else {
      // Last 3 seasons excluding the current season
      if (seasons!.length > 1) {
        relevantSeasons = seasons!.slice(1, 4); // Exclude the first (current) season
      } else {
        relevantSeasons = []; // No previous seasons
      }
    }

    // Calculate averages
    const { averages, numberOfSeasons } = calculateAveragedStats(
      relevantSeasons,
      isCareer
    );

    // Prepare data for upsert
    const upsertData: any = {
      player_id: player.player_id,
      player_name: player.player_name,
      shoots_catches: player.shoots_catches,
      position_code: player.position_code,
      birth_city: player.birth_city,
      birth_date: player.birth_date,
      current_team_abbreviation: player.current_team_abbreviation,
      current_team_name: player.current_team_name,
      draft_overall: player.draft_overall,
      draft_round: player.draft_round,
      draft_year: player.draft_year,
      first_season_for_game_type: player.first_season_for_game_type,
      nationality_code: player.nationality_code,
      weight: player.weight,
      height: player.height,
      birth_country: player.birth_country,
      number_of_seasons: numberOfSeasons,
      ...averages
    };

    // Determine target table
    const targetTable = isCareer
      ? "wgo_career_averages"
      : "wgo_three_year_averages";

    // Upsert into the target table
    const { error: upsertError } = await supabase
      .from(targetTable)
      .upsert(upsertData, { onConflict: "player_id" });

    if (upsertError) {
      console.error(
        `Error upserting data for player ${player.player_id} in ${targetTable}:`,
        upsertError
      );
    } else {
      console.log(
        `Successfully upserted data for player ${player.player_id} in ${targetTable}`
      );
    }
  }

  console.log(
    `\n${isCareer ? "Career" : "Three-Year"} Averages Calculation Completed.`
  );
};

// Main Execution Function
const main = async () => {
  console.log("Starting Averages Calculations...");

  // Calculate Career Averages
  await processAndUpsertAverages(true);

  // Calculate Three-Year Averages
  await processAndUpsertAverages(false);

  console.log("\nAll calculations completed successfully.");
};

// Run the script
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error during calculations:", error);
    process.exit(1);
  });
