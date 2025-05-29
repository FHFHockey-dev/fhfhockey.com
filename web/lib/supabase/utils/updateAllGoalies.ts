// lib/updateAllGoalies.ts

import supabase from "lib/supabase";
import { format, parseISO, addDays, isBefore, isAfter } from "date-fns";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import {
  WGOGoalieStat,
  WGOAdvancedGoalieStat,
  WGODaysLeftStat
} from "lib/NHL/types";
import Fetch from "lib/cors-fetch";

interface UpdateResult {
  totalUpdates: number;
  totalErrors: number;
}

// Define the structure of the NHL API response for goalie stats
interface NHLApiResponse {
  data: WGOGoalieStat[] | WGOAdvancedGoalieStat[] | WGODaysLeftStat[];
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

  // Loop through pages of data from the API
  while (moreDataAvailable) {
    // Include both regular season (gameTypeId=2) and playoff games (gameTypeId=3)
    const goalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=0&cayenneExp=gameDate%3C%3D%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E%3D%22${formattedDate}%22%20and%20(gameTypeId%3D2%20or%20gameTypeId%3D3)`;
    const advancedGoalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=0&cayenneExp=gameDate%3C%3D%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E%3D%22${formattedDate}%22%20and%20(gameTypeId%3D2%20or%20gameTypeId%3D3)`;
    const daysRestUrl = `https://api.nhle.com/stats/rest/en/goalie/daysrest?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C%3D%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E%3D%22${formattedDate}%22%20and%20(gameTypeId%3D2%20or%20gameTypeId%3D3)`;

    try {
      const [
        goalieStatsResponse,
        advancedGoalieStatsResponse,
        daysRestResponse
      ] = await Promise.all([
        Fetch(goalieStatsUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(advancedGoalieStatsUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(daysRestUrl).then((res) => res.json() as Promise<NHLApiResponse>)
      ]);

      goalieStats = goalieStats.concat(
        goalieStatsResponse.data as WGOGoalieStat[]
      );
      advancedGoalieStats = advancedGoalieStats.concat(
        advancedGoalieStatsResponse.data as WGOAdvancedGoalieStat[]
      );
      daysRestStats = daysRestStats.concat(
        daysRestResponse.data as WGODaysLeftStat[]
      );

      // Check if the length of any response data equals the limit
      const gsLen = goalieStatsResponse.data?.length ?? 0;
      const agsLen = advancedGoalieStatsResponse.data?.length ?? 0;
      const drLen = daysRestResponse.data?.length ?? 0;

      moreDataAvailable =
        gsLen === limit || agsLen === limit || drLen === limit;

      start += limit;
    } catch (fetchError: any) {
      console.error(
        `Error fetching data for date ${formattedDate}:`,
        fetchError.message
      );
      moreDataAvailable = false; // Stop fetching for this date on error
      // Return potentially partial data collected so far or empty arrays
      return { goalieStats, advancedGoalieStats, daysRestStats };
    }
  }

  return {
    goalieStats,
    advancedGoalieStats,
    daysRestStats
  };
}

export async function updateAllGoaliesStats(): Promise<UpdateResult> {
  try {
    const currentSeason = await fetchCurrentSeason();
    const endDate = parseISO(currentSeason.regularSeasonEndDate);
    const today = new Date();

    // Determine the final end date: today or regularSeasonEndDate, whichever is earlier
    const finalEndDate = isBefore(today, endDate) ? today : endDate;

    // Preliminary Check: Get the most recent date from wgo_goalie_stats
    const { data: latestData, error: latestError } = await supabase
      .from("wgo_goalie_stats")
      .select("date")
      .order("date", { ascending: false })
      .limit(1);

    if (latestError) {
      throw new Error(
        `Failed to fetch the latest date: ${latestError.message}`
      );
    }

    let currentDate: Date;

    if (latestData && latestData.length > 0 && latestData[0].date) {
      // Start from the day after the latest date in the database
      currentDate = addDays(parseISO(latestData[0].date), 1);
    } else {
      // If no data exists, start from the season's start date
      currentDate = parseISO(currentSeason.startDate);
    }

    console.log(
      "Starting update from date:",
      format(currentDate, "yyyy-MM-dd")
    );
    console.log("Ending update at date:", format(finalEndDate, "yyyy-MM-dd"));

    let totalUpdates = 0; // To track the total number of updates made
    let totalErrors = 0; // To track the total number of errors

    // Loop through each day of the season starting from currentDate
    while (!isAfter(currentDate, finalEndDate)) {
      const formattedDate = format(currentDate, "yyyy-MM-dd");
      console.log(`Processing data for date: ${formattedDate}`);

      try {
        // Fetch all goalies who actually played on this date (much more efficient)
        const dailyData = await fetchAllDataForDate(formattedDate, 100);

        const { goalieStats, advancedGoalieStats, daysRestStats } = dailyData;

        if (goalieStats.length === 0) {
          console.log(`No goalies played on ${formattedDate}`);
          currentDate = addDays(currentDate, 1);
          continue;
        }

        console.log(
          `Found ${goalieStats.length} goalies who played on ${formattedDate}`
        );

        // Prepare data for batch upsert - only for goalies who actually played
        const upsertData = goalieStats.map((stat: WGOGoalieStat) => {
          const advStats = advancedGoalieStats.find(
            (aStat: WGOAdvancedGoalieStat) => aStat.playerId === stat.playerId
          );
          const daysRestStat = daysRestStats.find(
            (dStat: WGODaysLeftStat) => dStat.playerId === stat.playerId
          );

          return {
            goalie_id: stat.playerId,
            goalie_name: stat.goalieFullName,
            date: formattedDate,
            season_id: currentSeason.id,
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
            // Advanced stats
            complete_game_pct: advStats?.completeGamePct,
            complete_games: advStats?.completeGames,
            incomplete_games: advStats?.incompleteGames,
            quality_start: advStats?.qualityStart,
            quality_starts_pct: advStats?.qualityStartsPct,
            regulation_losses: advStats?.regulationLosses,
            regulation_wins: advStats?.regulationWins,
            shots_against_per_60: advStats?.shotsAgainstPer60,
            // Days rest stats
            games_played_days_rest_0: daysRestStat?.gamesPlayedDaysRest0,
            games_played_days_rest_1: daysRestStat?.gamesPlayedDaysRest1,
            games_played_days_rest_2: daysRestStat?.gamesPlayedDaysRest2,
            games_played_days_rest_3: daysRestStat?.gamesPlayedDaysRest3,
            games_played_days_rest_4_plus:
              daysRestStat?.gamesPlayedDaysRest4Plus,
            save_pct_days_rest_0: daysRestStat?.savePctDaysRest0,
            save_pct_days_rest_1: daysRestStat?.savePctDaysRest1,
            save_pct_days_rest_2: daysRestStat?.savePctDaysRest2,
            save_pct_days_rest_3: daysRestStat?.savePctDaysRest3,
            save_pct_days_rest_4_plus: daysRestStat?.savePctDaysRest4Plus
          };
        });

        // Batch upsert for efficiency - all goalies for this date in one operation
        const { error } = await supabase
          .from("wgo_goalie_stats")
          .upsert(upsertData);

        if (error) {
          totalErrors++;
          console.error(
            `Upsert failed for date ${formattedDate}:`,
            error.message
          );
        } else {
          totalUpdates += upsertData.length;
          console.log(
            `Successfully updated ${upsertData.length} goalies for ${formattedDate}`
          );
        }
      } catch (error: any) {
        totalErrors++;
        console.error(
          `Failed to process date ${formattedDate}. Reason: ${error.message}`
        );
      }

      // Move to the next day
      currentDate = addDays(currentDate, 1);
    }

    console.log(
      `Finished updating goalie stats for the season. Total updates: ${totalUpdates}, Total errors: ${totalErrors}`
    );

    return { totalUpdates, totalErrors };
  } catch (error: any) {
    console.error(`Error in updateAllGoaliesStats: ${error.message}`);
    throw error;
  }
}
