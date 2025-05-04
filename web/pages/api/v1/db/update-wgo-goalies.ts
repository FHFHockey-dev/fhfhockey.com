// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-wgo-goalies.ts

// Import necessary modules from Next.js, Supabase, and other utilities
import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { format, parseISO, addDays, isBefore, isAfter } from "date-fns";
import { getCurrentSeason } from "lib/NHL/server";
import {
  WGOGoalieStat,
  WGOAdvancedGoalieStat,
  WGODaysLeftStat
} from "lib/NHL/types";
import { updateAllGoaliesStats } from "lib/supabase/utils/updateAllGoalies";

// TO DO - Got more stats from NHL API including the days rest statistics.

// Define the structure of the NHL API response for goalie stats
interface NHLApiResponse {
  data: WGOGoalieStat[] | WGOAdvancedGoalieStat[] | WGODaysLeftStat[];
}

/**
 * Fetch aggregate statistics for a specific goalie up to a given date.
 * @param playerId - The ID of the goalie.
 * @param playerName - The full name of the goalie.
 * @param date - The target date up to which to fetch statistics.
 * @returns An object containing goalieStats and advancedGoalieStats arrays.
 */
export async function fetchDataForPlayer(
  playerId: string,
  playerName: string,
  date: string
): Promise<{
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
  daysLeftStats: WGODaysLeftStat[];
}> {
  let start = 0;
  let moreDataAvailable = true;
  let goalieStats: WGOGoalieStat[] = [];
  let advancedGoalieStats: WGOAdvancedGoalieStat[] = [];
  let daysLeftStats: WGODaysLeftStat[] = [];

  const limit = 100; // Adjust as needed

  while (moreDataAvailable) {
    const encodedPlayerName = encodeURIComponent(`%${playerName}%`);
    const currentSeason = await getCurrentSeason();
    const formattedSeasonStartDate = format(
      parseISO(currentSeason.regularSeasonStartDate),
      "yyyy-MM-dd"
    );
    const formattedEndDate = format(parseISO(date), "yyyy-MM-dd");

    // Update the URL to fetch aggregate data up to the specified date
    const goalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=false&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedSeasonStartDate}%22%20and%20gameTypeId=2%20and%20playerId=%22${playerId}%22`;
    const advancedGoalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=true&isGame=false&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedSeasonStartDate}%22%20and%20gameTypeId=2%20and%20playerId=%22${playerId}%22`;
    const daysRestUrl = `https://api.nhle.com/stats/rest/en/goalie/daysrest?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedEndDate}%22`;

    // Fetch data from both URLs in parallel using Promise.all
    const [goalieStatsResponse, advancedGoalieStatsResponse, daysRestResponse] =
      await Promise.all([
        Fetch(goalieStatsUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(advancedGoalieStatsUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(daysRestUrl).then((res) => res.json() as Promise<NHLApiResponse>)
      ]);

    // Concatenate the fetched data to the accumulated arrays
    goalieStats = goalieStats.concat(
      goalieStatsResponse.data as WGOGoalieStat[]
    );
    advancedGoalieStats = advancedGoalieStats.concat(
      advancedGoalieStatsResponse.data as WGOAdvancedGoalieStat[]
    );
    daysLeftStats = daysLeftStats.concat(
      daysRestResponse.data as WGODaysLeftStat[]
    );

    // Determine if more data is available to fetch in the next iteration
    moreDataAvailable =
      goalieStatsResponse.data.length === limit ||
      advancedGoalieStatsResponse.data.length === limit ||
      daysRestResponse.data.length === limit;
    start += limit; // Increment the start index for the next fetch
  }

  return {
    goalieStats,
    advancedGoalieStats,
    daysLeftStats
  };
}

/**
 * Update goalie stats for a specific date in the Supabase database.
 * @param date - The date for which to update the stats.
 * @returns An object indicating whether the update was successful along with the fetched stats.
 */
async function updateGoalieStats(date: string): Promise<{
  updated: boolean;
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
  daysRestStats: WGODaysLeftStat[];
}> {
  const formattedDate = format(parseISO(date), "yyyy-MM-dd");
  const { goalieStats, advancedGoalieStats, daysRestStats } =
    await fetchAllDataForDate(formattedDate, 100);

  // Iterate over each goalie stat and upsert into the Supabase table
  for (const stat of goalieStats) {
    const advStats = advancedGoalieStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const daysRestStat = daysRestStats.find(
      (dStat) => dStat.playerId === stat.playerId
    );
    await supabase.from("wgo_goalie_stats").upsert({
      // Mapping fields from fetched data to Supabase table columns
      goalie_id: stat.playerId,
      goalie_name: stat.goalieFullName,
      date: formattedDate,
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
      // Advanced stats from advancedGoalieStatsResponse (advStats)
      complete_game_pct: advStats?.completeGamePct, // float
      complete_games: advStats?.completeGames, // int
      incomplete_games: advStats?.incompleteGames, // int
      quality_start: advStats?.qualityStart, // int
      quality_starts_pct: advStats?.qualityStartsPct, // float
      regulation_losses: advStats?.regulationLosses, // int
      regulation_wins: advStats?.regulationWins, // int
      shots_against_per_60: advStats?.shotsAgainstPer60, // float
      // Days left stats
      games_played_days_rest_0: daysRestStat?.gamesPlayedDaysRest0, // int
      games_played_days_rest_1: daysRestStat?.gamesPlayedDaysRest1, // int
      games_played_days_rest_2: daysRestStat?.gamesPlayedDaysRest2, // int
      games_played_days_rest_3: daysRestStat?.gamesPlayedDaysRest3, // int
      games_played_days_rest_4_plus: daysRestStat?.gamesPlayedDaysRest4Plus, // int
      save_pct_days_rest_0: daysRestStat?.savePctDaysRest0, // float
      save_pct_days_rest_1: daysRestStat?.savePctDaysRest1, // float
      save_pct_days_rest_2: daysRestStat?.savePctDaysRest2, // float
      save_pct_days_rest_3: daysRestStat?.savePctDaysRest3, // float
      save_pct_days_rest_4_plus: daysRestStat?.savePctDaysRest4Plus // float
    });
  }

  return { updated: true, goalieStats, advancedGoalieStats, daysRestStats };
}

/**
 * Fetch all goalie data for a specific date with a limit on the number of records.
 * @param formattedDate - The date in 'yyyy-MM-dd' format.
 * @param limit - The maximum number of records to fetch per request.
 * @returns An object containing goalieStats and advancedGoalieStats arrays.
 */
async function fetchAllDataForDate(
  formattedDate: string,
  limit: number
): Promise<{
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
  daysRestStats: WGODaysLeftStat[];
}> {
  let start = 0;
  let moreDataAvailable = true;
  let goalieStats: WGOGoalieStat[] = [];
  let advancedGoalieStats: WGOAdvancedGoalieStat[] = [];
  let daysRestStats: WGODaysLeftStat[] = [];
  console.log("Fetching data for date:", formattedDate);

  // Loop to fetch all pages of data from the API
  while (moreDataAvailable) {
    // Construct the URLs for fetching goalie stats and advanced stats
    const goalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const advancedGoalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const daysRestUrl = `https://api.nhle.com/stats/rest/en/goalie/daysrest?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`;

    // Fetch data from both URLs in parallel using Promise.all
    const [goalieStatsResponse, advancedGoalieStatsResponse, daysRestResponse] =
      await Promise.all([
        Fetch(goalieStatsUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(advancedGoalieStatsUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(daysRestUrl).then((res) => res.json() as Promise<NHLApiResponse>)
      ]);

    // Concatenate the fetched data to the accumulated arrays
    goalieStats = goalieStats.concat(
      goalieStatsResponse.data as WGOGoalieStat[]
    );
    advancedGoalieStats = advancedGoalieStats.concat(
      advancedGoalieStatsResponse.data as WGOAdvancedGoalieStat[]
    );
    daysRestStats = daysRestStats.concat(
      daysRestResponse.data as WGODaysLeftStat[]
    );

    // Determine if more data is available to fetch in the next iteration
    moreDataAvailable =
      goalieStatsResponse.data.length === limit ||
      advancedGoalieStatsResponse.data.length === limit ||
      daysRestResponse.data.length === limit;

    start += limit; // Increment the start index for the next fetch
  }

  return {
    goalieStats,
    advancedGoalieStats,
    daysRestStats // Placeholder for days left stats, if needed
  };
}

/**
 * Update goalie stats for the entire season by iterating through each day.
 * @returns An object containing a success message and the total number of updates made.
 */
async function updateAllGoalieStatsForSeason() {
  const currentSeason = await getCurrentSeason();
  let currentDate = parseISO(currentSeason.regularSeasonStartDate);
  console.log("Current Date:", currentDate);
  const endDate = parseISO(currentSeason.regularSeasonEndDate);
  console.log("End Date:", endDate);
  let totalUpdates = 0; // To track the total number of updates made

  // Iterate through each day of the season and update stats
  while (isBefore(currentDate, endDate)) {
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    console.log(`Processing data for date: ${formattedDate}`);

    const { goalieStats, advancedGoalieStats, daysRestStats } =
      await fetchAllDataForDate(formattedDate, 100);

    for (const stat of goalieStats) {
      const advStats = advancedGoalieStats.find(
        (aStat) => aStat.playerId === stat.playerId
      );
      const daysLeftStat = daysRestStats.find(
        (dStat) => dStat.playerId === stat.playerId
      );
      await supabase.from("wgo_goalie_stats").upsert({
        // Mapping fields from fetched data to Supabase table columns
        goalie_id: stat.playerId,
        goalie_name: stat.goalieFullName,
        date: formattedDate,
        shoots_catches: stat.shootsCatches,
        position_code: "G",
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
        // Advanced stats from advancedGoalieStatsResponse (advStats)
        complete_game_pct: advStats?.completeGamePct, // float
        complete_games: advStats?.completeGames, // int
        incomplete_games: advStats?.incompleteGames, // int
        quality_start: advStats?.qualityStart, // int
        quality_starts_pct: advStats?.qualityStartsPct, // float
        regulation_losses: advStats?.regulationLosses, // int
        regulation_wins: advStats?.regulationWins, // int
        shots_against_per_60: advStats?.shotsAgainstPer60, // float
        // Days left stats
        games_played_days_rest_0: daysLeftStat?.gamesPlayedDaysRest0, // int
        games_played_days_rest_1: daysLeftStat?.gamesPlayedDaysRest1, // int
        games_played_days_rest_2: daysLeftStat?.gamesPlayedDaysRest2, // int
        games_played_days_rest_3: daysLeftStat?.gamesPlayedDaysRest3, // int
        games_played_days_rest_4_plus: daysLeftStat?.gamesPlayedDaysRest4Plus, // int
        save_pct_days_rest_0: daysLeftStat?.savePctDaysRest0, // float
        save_pct_days_rest_1: daysLeftStat?.savePctDaysRest1, // float
        save_pct_days_rest_2: daysLeftStat?.savePctDaysRest2, // float
        save_pct_days_rest_3: daysLeftStat?.savePctDaysRest3, // float
        save_pct_days_rest_4_plus: daysLeftStat?.savePctDaysRest4Plus // float
      });
      totalUpdates += 1;
    }

    currentDate = addDays(currentDate, 1);
  }

  console.log("Finished updating goalie stats for the season");
  return {
    message: `Season data updated successfully. Total updates: ${totalUpdates}`,
    success: true,
    totalUpdates: totalUpdates
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const actionParam = req.query.action;
    const dateParam = req.query.date;
    const playerIdParam = req.query.playerId;
    const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
    const playerId = Array.isArray(playerIdParam)
      ? playerIdParam[0]
      : playerIdParam;
    const goalieFullName = Array.isArray(req.query.goalieFullName)
      ? req.query.goalieFullName[0]
      : req.query.goalieFullName || "Unknown Goalie";

    // **Action: Bulk Update for All Goalies**
    if (actionParam === "all") {
      // Trigger bulk update for all goalies
      const result = await updateAllGoaliesStats();
      return res.status(200).json({
        message: `Successfully updated all goalie stats.`,
        success: true,
        data: result
      });
    }

    if (actionParam === "fullRefresh") {
      const result = await updateAllGoalieStatsForSeason();
      return res.status(200).json({
        message: `Successfully updated all goalie stats for the season.`,
        success: true,
        data: result
      });
    }

    // **Action: Update Goalie Stats for a Specific Date**
    if (date) {
      const result = await updateGoalieStats(date);
      return res.status(200).json({
        message: `Successfully updated goalie stats for date ${date}.`,
        success: true,
        data: result
      });
    }

    // **Action: Fetch Data for a Specific Player**
    if (playerId && goalieFullName) {
      // **Ensure that 'date' is provided when fetching data for a specific player**
      if (!date) {
        return res.status(400).json({
          message:
            "Missing required query parameter: date. Please provide a date when fetching data for a specific player.",
          success: false
        });
      }

      // **Optional: Validate the date format here if necessary**

      const result = await fetchDataForPlayer(playerId, goalieFullName, date);
      return res.status(200).json({
        message: `Successfully fetched goalie stats for player ID ${playerId} up to date ${date}.`,
        success: true,
        data: result
      });
    }

    // **Invalid Request: Missing Required Parameters**
    return res.status(400).json({
      message:
        "Missing required query parameters. Please provide an action, date, or a player ID and goalie full name.",
      success: false
    });
  } catch (e: any) {
    console.error(`Handler Error: ${e.message}`);
    return res.status(500).json({
      message: "Failed to process request. Reason: " + e.message,
      success: false
    });
  }
}
