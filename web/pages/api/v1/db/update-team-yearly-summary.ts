import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  try {
    // 1. Get all seasons from the Supabase seasons table.
    const { data: seasons, error: seasonsError } = await supabase
      .from("seasons")
      .select("*");
    if (seasonsError) throw seasonsError;
    if (!seasons || seasons.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No seasons found" });
    }

    let totalUpserts = 0;

    // 2. Loop through each season.
    for (const season of seasons) {
      // Assume the season's "id" is used as the season identifier.
      const seasonId = season.id;
      console.log(`Fetching team summary for season ${seasonId}`);

      // 3. Build the team summary URL using the season id.
      const url = `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&cayenneExp=gameTypeId=2%20and%20seasonId%3C%3D${seasonId}%20and%20seasonId%3E%3D${seasonId}`;
      console.log(`Requesting URL: ${url}`);
      const response = await Fetch(url);
      const json = await response.json();

      // 4. Extract the data array.
      const teamData = json.data;
      if (!teamData) {
        console.log(`No data returned for season ${seasonId}, skipping.`);
        continue; // Skip to the next season if no data is found
      }
      console.log(`Fetched ${teamData.length} records for season ${seasonId}`);

      // 5. Map the data to the shape of your Supabase table.
      const records = teamData.map((team: any) => ({
        season_id: seasonId,
        team_id: team.teamId,
        team_full_name: team.teamFullName,
        games_played: team.gamesPlayed,
        wins: team.wins,
        losses: team.losses,
        ot_losses: team.otLosses,
        points: team.points,
        goals_for: team.goalsFor,
        goals_against: team.goalsAgainst,
        goals_for_per_game: team.goalsForPerGame,
        goals_against_per_game: team.goalsAgainstPerGame,
        shots_for_per_game: team.shotsForPerGame,
        shots_against_per_game: team.shotsAgainstPerGame,
        faceoff_win_pct: team.faceoffWinPct,
        penalty_kill_pct: team.penaltyKillPct,
        penalty_kill_net_pct: team.penaltyKillNetPct,
        power_play_pct: team.powerPlayPct,
        power_play_net_pct: team.powerPlayNetPct,
        regulation_and_ot_wins: team.regulationAndOtWins,
        point_pct: team.pointPct,
        updated_at: new Date().toISOString()
      }));

      // 6. Upsert the team records into the Supabase table.
      // The `onConflict` option tells Supabase which columns to check for a conflict.
      // If a row with the same `season_id` and `team_id` exists, it will be updated.
      // Otherwise, a new row will be inserted.
      const { error: upsertError } = await supabase
        .from("team_summary_years")
        .upsert(records, {
          onConflict: "season_id,team_id"
        });

      if (upsertError) {
        console.error(`Error upserting season ${seasonId}:`, upsertError);
        throw upsertError;
      }

      totalUpserts += records.length;
      console.log(`Upserted ${records.length} records for season ${seasonId}`);
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    return res.status(200).json({
      success: true,
      message: `Successfully upserted team summary data for ${seasons.length} seasons.`,
      totalUpserts,
      duration: `${durationSec} s`
    });
  } catch (error: any) {
    console.error("Error updating team summary data:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
