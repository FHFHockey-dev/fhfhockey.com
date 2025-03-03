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

    // Upsert a combined record into the wgo_goalie_stats_totals table.
    // With upsert, if a record already exists (based on the table's unique or primary key), it will be updated.
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
      team_abbrevs: stat.teamAbbrevs,

      // Map advanced stats if available
      complete_game_pct: advStats?.completeGamePct,
      complete_games: advStats?.completeGames,
      incomplete_games: advStats?.incompleteGames,
      quality_start: advStats?.qualityStart,
      quality_starts_pct: advStats?.qualityStartsPct,
      regulation_losses: advStats?.regulationLosses,
      regulation_wins: advStats?.regulationWins,
      shots_against_per_60: advStats?.shotsAgainstPer60,

      // Update Timestamp Column
      updated_at: new Date().toISOString()
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
 * This handler will:
 * 1. Retrieve all seasons (up to the current season).
 * 2. Check if any goalie totals already exist in the table.
 *    - If data exists, it finds the most recent season in the database and then updates all seasons from that season
 *      up to the current season.
 *    - If no data exists, it updates all available seasons (starting from the first season).
 * 3. It also times the entire operation.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  try {
    const seasonParam = req.query.seasonId;
    const currentSeason = await getCurrentSeason();
    const allSeasons = await fetchAllSeasons();

    // Filter seasons to only include those up to (and including) the current season
    const validSeasons = allSeasons.filter(
      (season) => Number(season.id) <= Number(currentSeason.seasonId)
    );

    let seasonsToProcess;
    if (seasonParam === "all") {
      // If seasonId=all, update every season up to the current season.
      seasonsToProcess = validSeasons;
    } else {
      // Otherwise, check if data exists in the table.
      const { data: existingData } = await supabase
        .from("wgo_goalie_stats_totals")
        .select("season_id");

      if (existingData && existingData.length > 0) {
        // Data exists: get the most recent season in the table
        const seasonIds = existingData.map((d) => Number(d.season_id));
        const mostRecentSeasonId = Math.max(...seasonIds);

        // Update all seasons from the most recent season in the DB up to the current season
        seasonsToProcess = validSeasons.filter(
          (season) => Number(season.id) >= mostRecentSeasonId
        );
      } else {
        // No data exists: update all available seasons (starting from the first season)
        seasonsToProcess = validSeasons;
      }
    }

    let totalUpdatesOverall = 0;
    for (const season of seasonsToProcess) {
      const seasonIdStr = season.id.toString();
      // Upsert data for this season
      const result = await updateGoalieTotals(seasonIdStr);
      totalUpdatesOverall += result.totalUpdates;
    }
    const durationMs = Date.now() - startTime;
    return res.status(200).json({
      message: `Successfully upserted goalie season totals for seasons: ${seasonsToProcess
        .map((s) => s.id)
        .join(", ")}`,
      success: true,
      data: { totalUpdates: totalUpdatesOverall },
      duration: `${durationMs} ms`
    });
  } catch (e: any) {
    console.error("Update Totals Error:", e.message);
    return res.status(500).json({
      message: "Failed to update goalie season totals. Reason: " + e.message,
      success: false
    });
  }
}
