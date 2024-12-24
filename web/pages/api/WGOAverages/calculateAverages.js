/*******************************************************************************
 * /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/WGOAverages/calculateAverages.js
 *
 * Full script preserving original functionality, but with corrected perGameStats
 * logic to ensure all previously upserted stats remain intact, plus improved
 * calculations for "toi_per_game", "points_per_game", "es_toi_per_game", etc.
 ******************************************************************************/

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: "/Users/tim/Desktop/FHFH/fhfhockey.com/web/.env.local" });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY
);

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY
) {
  console.error("Supabase URL or Key is missing in environment variables.");
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 1) Fetch the current season from your /season endpoint
// -----------------------------------------------------------------------------
async function fetchCurrentSeason() {
  const currentSeason = "20242025"; // Example placeholder
  console.log(currentSeason);
  return currentSeason;
}

console.log(fetchCurrentSeason());

// -----------------------------------------------------------------------------
// Helper function to safely divide two numbers
// -----------------------------------------------------------------------------
const safeDivide = (numerator, denominator) => {
  return denominator !== 0 ? numerator / denominator : 0;
};

// -----------------------------------------------------------------------------
// Function to calculate summed stats and averages
// -----------------------------------------------------------------------------
const calculateAveragedStats = (seasons, isCareer) => {
  const numberOfSeasons = seasons.length;

  if (numberOfSeasons === 0) {
    return { averages: {}, numberOfSeasons };
  }

  // Initialize accumulators
  const totals = {};

  // Sum up all relevant stats from the given seasons
  seasons.forEach((season) => {
    for (const [key, value] of Object.entries(season)) {
      if (typeof value === "number" && !isNaN(value)) {
        totals[key] = (totals[key] || 0) + value;
      }
    }
  });

  // Initialize the averages object to store final results
  const averages = {};

  // ---------------------------------------------------------------------------
  // Basic counts
  // ---------------------------------------------------------------------------
  const totalGamesPlayed = totals["games_played"] || 1;
  const totalShifts = totals["shifts"] || 1;

  // Compute total TOI in seconds for per-60 calculations
  const totalToiSeconds =
    (totals["ev_time_on_ice"] || 0) +
    (totals["ot_time_on_ice"] || 0) +
    (totals["pp_toi"] || 0) +
    (totals["sh_time_on_ice"] || 0);

  // ---------------------------------------------------------------------------
  // 1. Sum Total divided by Number of Seasons
  // ---------------------------------------------------------------------------
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
    "primary_assists_5v5",
    "pp_toi_pct_per_game",
    "sh_time_on_ice_pct_per_game"
  ];

  sumDividedBySeasonsStats.forEach((stat) => {
    averages[`${stat}_avg`] = safeDivide(totals[stat] || 0, numberOfSeasons);
  });

  // ---------------------------------------------------------------------------
  // 2. Per Game Stats (Refined)
  // ---------------------------------------------------------------------------
  //
  // totalGamesPlayed can be 0 if the data is incomplete, so always safeDivide.

  // Example: "toi_per_game_avg" from totalToiSeconds / totalGamesPlayed
  averages["toi_per_game_avg"] = safeDivide(totalToiSeconds, totalGamesPlayed);

  // Example: "es_toi_per_game_avg" from just ev_time_on_ice / totalGamesPlayed
  averages["es_toi_per_game_avg"] = safeDivide(
    totals["ev_time_on_ice"] || 0,
    totalGamesPlayed
  );

  // Example: "points_per_game_avg" from totals["points"] / totalGamesPlayed
  // If "points_per_game" is already in the table, you can also do
  // safeDivide(totals["points_per_game"], totalGamesPlayed) if you prefer.
  // But typically "points" / "games_played" is more direct:
  averages["points_per_game_avg"] = safeDivide(
    totals["points"] || 0,
    totalGamesPlayed
  );

  // Example: "pp_toi_per_game_avg" from totals["pp_toi"] / totalGamesPlayed
  averages["pp_toi_per_game_avg"] = safeDivide(
    totals["pp_toi"] || 0,
    totalGamesPlayed
  );

  // Example: "sh_toi_per_game_avg" from totals["sh_time_on_ice"] / totalGamesPlayed
  averages["sh_toi_per_game_avg"] = safeDivide(
    totals["sh_time_on_ice"] || 0,
    totalGamesPlayed
  );

  // If "penalty_seconds_per_game" is stored, we can do an improved approach:
  // e.g. from "penalty_minutes" * 60 / totalGamesPlayed if "penalty_seconds_per_game" doesn't exist.
  averages["penalty_seconds_per_game_avg"] = safeDivide(
    totals["penalty_minutes"] ? totals["penalty_minutes"] * 60 : 0,
    totalGamesPlayed
  );

  // Additional per-game calculations that existed:
  averages["ev_time_on_ice_per_game_avg"] = safeDivide(
    totals["ev_time_on_ice"] || 0,
    totalGamesPlayed
  );
  averages["ot_time_on_ice_per_game_avg"] = safeDivide(
    totals["ot_time_on_ice"] || 0,
    totalGamesPlayed
  );
  averages["shifts_per_game_avg"] = safeDivide(
    totals["shifts"] || 0,
    totalGamesPlayed
  );

  // ---------------------------------------------------------------------------
  // 3. Per Shift Stats
  // ---------------------------------------------------------------------------
  const perShiftStats = ["time_on_ice_per_shift"];
  perShiftStats.forEach((stat) => {
    // e.g. "time_on_ice_per_shift_avg"
    // Divide the sum of "time_on_ice_per_shift" by totalShifts
    averages[`${stat}_avg`] = safeDivide(totals[stat] || 0, totalShifts);
  });

  // ---------------------------------------------------------------------------
  // 4. Per TOI Stats (example: penalty_minutes)
  // ---------------------------------------------------------------------------
  if (totals["penalty_minutes"]) {
    averages["penalty_minutes_per_toi_avg"] =
      totalToiSeconds > 0 ? totals["penalty_minutes"] / totalToiSeconds : 0;
  } else {
    averages["penalty_minutes_per_toi_avg"] = 0;
  }

  // ---------------------------------------------------------------------------
  // 5. Percentage Stats
  // ---------------------------------------------------------------------------
  const percentageCalculations = {
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

  // ---------------------------------------------------------------------------
  // 6. Additional Percentage Stats
  // ---------------------------------------------------------------------------
  // Example: zone_start_pct
  averages["zone_start_pct_avg"] = safeDivide(
    totals["o_zone_faceoffs"] || 0,
    (totals["o_zone_faceoffs"] || 0) +
      (totals["n_zone_faceoffs"] || 0) +
      (totals["d_zone_faceoffs"] || 0)
  );

  // If you don't have a formula for these yet, set them to 0 (rather than null)
  averages["shooting_percentage_5v5_avg"] = 0;
  averages["skater_save_pct_5v5_avg"] = 0;
  averages["skater_shooting_plus_save_pct_5v5_avg"] = 0;
  averages["o_zone_start_pct_5v5_avg"] = 0;
  averages["on_ice_shooting_pct_5v5_avg"] = 0;
  averages["zone_start_pct_5v5_avg"] = 0;

  // ---------------------------------------------------------------------------
  // 7. Per 60 Stats
  // ---------------------------------------------------------------------------
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
      totalToiSeconds > 0 ? (statValue / totalToiSeconds) * 3600 : 0;
  });

  // ---------------------------------------------------------------------------
  // 8. Relative Stats: If no formula, default to 0
  // ---------------------------------------------------------------------------
  averages["sat_relative_avg"] = totals["sat_relative"] || 0;
  averages["usat_relative_avg"] = totals["usat_relative"] || 0;
  averages["sat_relative_5v5_avg"] = totals["sat_relative_5v5"] || 0;

  return { averages, numberOfSeasons };
};

// -----------------------------------------------------------------------------
// Paginate all players from wgo_skater_stats_totals
// -----------------------------------------------------------------------------
const fetchAllPlayers = async () => {
  const limit = 1000; // Supabase limit
  let from = 0;
  let to = limit - 1;
  let allPlayers = [];
  let fetchMore = true;

  while (fetchMore) {
    const { data: players, error } = await supabase
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
      .not("player_id", "is", null)
      .order("player_id", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Error fetching players:", error);
      break;
    }

    if (!players || players.length === 0) {
      fetchMore = false;
    } else {
      allPlayers = allPlayers.concat(players);
      from += limit;
      to += limit;
    }
  }

  return allPlayers;
};

// -----------------------------------------------------------------------------
// Process and upsert averages into a specified table
// -----------------------------------------------------------------------------
const processAndUpsertAverages = async (isCareer, currentSeason) => {
  console.log(
    `\nStarting ${isCareer ? "Career" : "Three-Year"} Averages Calculation...`
  );

  // Fetch all players
  const players = await fetchAllPlayers();
  if (!players || players.length === 0) {
    console.log("No players found.");
    return;
  }
  console.log(`Fetched ${players.length} players.`);

  // For each player, fetch all seasons and compute averages
  for (const player of players) {
    // Grab all seasons for the player
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
          pp_toi_pct_per_game,
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
          primary_assists_5v5,
          sh_time_on_ice_pct_per_game
        `
      )
      .eq("player_id", player.player_id);

    if (seasonsError) {
      console.error(
        `Error fetching seasons for player ${player.player_id}:`,
        seasonsError
      );
      continue;
    }
    if (!seasons || seasons.length === 0) {
      console.log(`No seasons found for player ${player.player_id}`);
      continue;
    }

    // Filter out current season for both Career and 3-Year
    const filteredSeasons = seasons.filter(
      (row) => row.season !== currentSeason
    );

    // For a career: all filtered seasons (no current season)
    // For 3-year: last 3 seasons
    let relevantSeasons = [];
    if (isCareer) {
      relevantSeasons = filteredSeasons;
    } else {
      const sorted = filteredSeasons.sort(
        (a, b) => parseInt(a.season) - parseInt(b.season)
      );
      relevantSeasons = sorted.slice(-3);
    }

    // Calculate the averages
    const { averages, numberOfSeasons } = calculateAveragedStats(
      relevantSeasons,
      isCareer
    );

    // Prepare data for upsert
    const upsertData = {
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

    // Use the correct target table
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

// -----------------------------------------------------------------------------
// Main Execution
// -----------------------------------------------------------------------------
const main = async () => {
  console.log("Starting Averages Calculations...");

  // 1) Fetch the current season
  const currentSeason = await fetchCurrentSeason();

  // 2) Calculate Career Averages (exclude current season)
  await processAndUpsertAverages(true, currentSeason);

  // 3) Calculate Three-Year Averages (exclude current season, then take last 3)
  await processAndUpsertAverages(false, currentSeason);

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
