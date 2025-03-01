// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-wgo-goalie-totals.ts

import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { getCurrentSeason } from "lib/NHL/server";
import { WGOGoalieStat, WGOAdvancedGoalieStat } from "lib/NHL/types";

/**
 * Fetches aggregate goalie data for a given season by querying both the summary and advanced endpoints.
 * Uses pagination to ensure all data is collected.
 *
 * @param seasonId - The season identifier (e.g. "20242025")
 * @param limit - The maximum number of records to fetch per request (default is 100)
 * @returns An object containing arrays of goalieStats and advancedGoalieStats.
 */
async function fetchTotalsDataForSeason(
  seasonId: string,
  limit: number
): Promise<{
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
}> {
  let start = 0;
  let moreDataAvailable = true;
  let goalieStats: WGOGoalieStat[] = [];
  let advancedGoalieStats: WGOAdvancedGoalieStat[] = [];

  while (moreDataAvailable) {
    // Build the summary URL using seasonId filtering
    const summaryUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameTypeId=2%20and%20seasonId%3C%3D${seasonId}%20and%20seasonId%3E%3D${seasonId}`;

    // Build the advanced URL using seasonId filtering
    const advancedUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameTypeId=2%20and%20seasonId%3C%3D${seasonId}%20and%20seasonId%3E%3D${seasonId}`;

    // Fetch data concurrently from both endpoints
    const [summaryResponse, advancedResponse] = await Promise.all([
      Fetch(summaryUrl).then((res) => res.json()),
      Fetch(advancedUrl).then((res) => res.json())
    ]);

    // Append the fetched records
    goalieStats = goalieStats.concat(summaryResponse.data as WGOGoalieStat[]);
    advancedGoalieStats = advancedGoalieStats.concat(
      advancedResponse.data as WGOAdvancedGoalieStat[]
    );

    // If either response returns exactly the limit, there might be more data to fetch
    moreDataAvailable =
      summaryResponse.data.length === limit ||
      advancedResponse.data.length === limit;
    start += limit;
  }

  return { goalieStats, advancedGoalieStats };
}

/**
 * Updates season totals for each goalie by upserting aggregated data into the Supabase table.
 *
 * @param seasonId - The season identifier to update totals for.
 * @returns An object with the total number of upsert operations performed.
 */
async function updateGoalieTotals(
  seasonId: string
): Promise<{ totalUpdates: number }> {
  const limit = 100;
  const { goalieStats, advancedGoalieStats } = await fetchTotalsDataForSeason(
    seasonId,
    limit
  );

  let totalUpdates = 0;

  // Iterate through each goalie from the summary data and find matching advanced stats
  for (const stat of goalieStats) {
    const advStats = advancedGoalieStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    //what hapopened to vercel chacks

    // Upsert a combined record into the wgo_goalie_stats_totals table
    await supabase.from("wgo_goalie_stats_totals").upsert({
      goalie_id: stat.playerId,
      goalie_name: stat.goalieFullName,
      season_id: Number(seasonId),
      shoots_catches: stat.shootsCatches,
      games_played: stat.gamesPlayed,
      games_started: stat.gamesStarted,
      wins: stat.wins,
      losses: stat.losses,
      ot_losses: stat.otLosses,
      save_pct: stat.savePct,
      saves: stat.saves,
      goals_against: stat.goalsAgainst,
      goals_against_avg: stat.goalsAgainstAverage,
      shots_against: stat.shotsAgainst,
      time_on_ice: stat.timeOnIce,
      shutouts: stat.shutouts,
      goals: stat.goals,
      assists: stat.assists,
      // Map advanced stats if available
      complete_game_pct: advStats?.completeGamePct,
      complete_games: advStats?.completeGames,
      incomplete_games: advStats?.incompleteGames,
      quality_start: advStats?.qualityStart,
      quality_starts_pct: advStats?.qualityStartsPct,
      regulation_losses: advStats?.regulationLosses,
      regulation_wins: advStats?.regulationWins,
      shots_against_per_60: advStats?.shotsAgainstPer60
    });
    totalUpdates++;
  }

  return { totalUpdates };
}

/**
 * Fetches the list of all historical seasons from the NHL API.
 *
 * @returns An array of season objects.
 */
async function fetchAllSeasons(): Promise<any[]> {
  const seasonUrl =
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22ASC%22%7D%5D";
  const response = await Fetch(seasonUrl).then((res) => res.json());
  return response.data;
}

/**
 * Main API Route handler for updating season totals.
 *
 * If no data exists in the totals table, the script will loop through all historical seasons (up to the current season)
 * and populate the table with data. If data already exists, the script finds the most recent season_id,
 * deletes all rows with that season_id, and then refreshes that season's data.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check if there is existing data in the totals table
    const { data: existingData } = await supabase
      .from("wgo_goalie_stats_totals")
      .select("season_id");

    // If data already exists, refresh only the most recent season's data
    if (existingData && existingData.length > 0) {
      // Find the most recent season_id (assuming numeric values)
      const seasonIds = existingData.map((d) => Number(d.season_id));
      const mostRecentSeasonId = Math.max(...seasonIds);

      // Delete all rows matching that season_id to allow a fresh update
      await supabase
        .from("wgo_goalie_stats_totals")
        .delete()
        .match({ season_id: mostRecentSeasonId.toString() });

      const result = await updateGoalieTotals(mostRecentSeasonId.toString());
      return res.status(200).json({
        message: `Successfully refreshed goalie season totals for season ${mostRecentSeasonId}.`,
        success: true,
        data: result
      });
    } else {
      // No existing data found: fetch all historical seasons
      const seasons = await fetchAllSeasons();
      const currentSeason = await getCurrentSeason();

      // Filter seasons to process only those up to (and including) the current season
      const seasonsToProcess = seasons.filter(
        (season) => Number(season.id) <= Number(currentSeason.seasonId)
      );

      let totalUpdatesOverall = 0;
      // Loop through each season and update totals
      for (const season of seasonsToProcess) {
        const seasonIdStr = season.id.toString();
        // Ensure any stale data for the season is removed
        await supabase
          .from("wgo_goalie_stats_totals")
          .delete()
          .match({ season_id: seasonIdStr });

        const result = await updateGoalieTotals(seasonIdStr);
        totalUpdatesOverall += result.totalUpdates;
      }

      return res.status(200).json({
        message: `Successfully updated goalie season totals for all historical seasons up to season ${currentSeason.seasonId}.`,
        success: true,
        data: { totalUpdates: totalUpdatesOverall }
      });
    }
  } catch (e: any) {
    console.error("Update Totals Error:", e.message);
    return res.status(500).json({
      message: "Failed to update goalie season totals. Reason: " + e.message,
      success: false
    });
  }
}
