// upsertGoalieData.js

require("dotenv").config({ path: "../../.env.local" });
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client with Service Role Key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // Use Service Role Key
);

/**
 * Upsert goalie stats and league averages for a given week.
 * @param {number} weekId - The week identifier.
 * @param {Object} weekData - The data object containing goalies and averages.
 */
async function upsertWeekData(weekId, weekData) {
  try {
    // Map averages to match Supabase column names
    const averages = weekData.averages;
    const mappedAverages = {
      week_id: weekId,
      games_played: averages.gamesPlayed,
      games_started: averages.gamesStarted,
      wins: averages.wins,
      losses: averages.losses,
      ot_losses: averages.otLosses,
      saves: averages.saves,
      shots_against: averages.shotsAgainst,
      goals_against: averages.goalsAgainst,
      shutouts: averages.shutouts,
      time_on_ice: averages.timeOnIce, // Already in minutes
      save_pct: averages.savePct,
      goals_against_average: averages.goalsAgainstAverage,
    };

    // Log mapped data for debugging
    console.log("Mapped Averages:", mappedAverages);
    console.log(
      "Mapped Goalie Data:",
      weekData.goalies.map((goalie) => ({
        player_id: goalie.playerId,
        week_id: weekId,
        games_played: goalie.gamesPlayed,
        games_started: goalie.gamesStarted,
        wins: goalie.wins,
        losses: goalie.losses,
        ot_losses: goalie.otLosses,
        saves: goalie.saves,
        shots_against: goalie.shotsAgainst,
        goals_against: goalie.goalsAgainst,
        shutouts: goalie.shutouts,
        time_on_ice: goalie.timeOnIce, // Already in minutes
        save_pct: goalie.savePct,
        goals_against_average: goalie.goalsAgainstAverage,
        team: goalie.team,
        goalie_full_name: goalie.goalieFullName,
      }))
    );

    // Upsert goalie stats with correct field mappings
    const { data: goalieData, error: goalieError } = await supabase
      .from("goalie_page_stats")
      .upsert(
        weekData.goalies.map((goalie) => ({
          player_id: goalie.playerId,
          week_id: weekId,
          games_played: goalie.gamesPlayed,
          games_started: goalie.gamesStarted,
          wins: goalie.wins,
          losses: goalie.losses,
          ot_losses: goalie.otLosses,
          saves: goalie.saves,
          shots_against: goalie.shotsAgainst,
          goals_against: goalie.goalsAgainst,
          shutouts: goalie.shutouts,
          time_on_ice: goalie.timeOnIce, // Already in minutes
          save_pct: goalie.savePct,
          goals_against_average: goalie.goalsAgainstAverage,
          team: goalie.team,
          goalie_full_name: goalie.goalieFullName,
        })),
        { onConflict: "player_id, week_id" }
      );

    if (goalieError) {
      console.error("Error upserting goalie stats:", goalieError.message);
      console.error("Details:", goalieError.details);
      console.error("Hint:", goalieError.hint);
      console.error("Full Error Object:", goalieError);
      throw goalieError;
    }

    // Upsert league averages with correct table name
    const { data: avgData, error: avgError } = await supabase
      .from("league_averages_goalies") // Correct table name
      .upsert(mappedAverages, { onConflict: "week_id" });

    if (avgError) {
      console.error("Error upserting league averages:", avgError.message);
      console.error("Details:", avgError.details);
      console.error("Hint:", avgError.hint);
      console.error("Full Error Object:", avgError);
      throw avgError;
    } else {
      console.log("League averages upserted:", avgData);
    }
  } catch (err) {
    console.error("Unexpected error during upsertWeekData:", err);
    throw err;
  }
}

module.exports = {
  upsertWeekData,
};
