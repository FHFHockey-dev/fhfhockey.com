// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-wgo-goalies.ts

// Import necessary modules from Next.js, Supabase, and other utilities
import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import {
  format,
  parseISO,
  addDays,
  isBefore,
  isAfter,
  subDays
} from "date-fns";
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

interface SeasonInfo {
  id: number; // Assuming 'id' in your 'seasons' table is the numeric season ID like 20232024
  startDate: string; // 'YYYY-MM-DD'
  regularSeasonEndDate: string; // 'YYYY-MM-DD'
}

/**
 * Fetches season details from Supabase based on a specific date.
 * @param dateString - The date string in 'YYYY-MM-DD' format.
 * @returns A Promise resolving to the SeasonInfo object or null if not found/error.
 */
async function getSeasonFromDate(
  dateString: string
): Promise<SeasonInfo | null> {
  try {
    const { data, error } = await supabase
      .from("seasons")
      .select("id, startDate, regularSeasonEndDate") // Select needed columns
      .lte("startDate", dateString) // Date is on or after season start
      .gte("regularSeasonEndDate", dateString) // Date is on or before regular season end
      .single(); // Expect only one season for a given regular season date

    if (error) {
      // Handle cases where a date might fall outside any defined season (e.g., offseason)
      if (error.code === "PGRST116") {
        // PGRST116 = 'The result contains 0 rows'
        console.warn(
          `No season found in 'seasons' table for date: ${dateString}`
        );
        return null;
      }
      // Log other errors
      console.error(
        `Error fetching season for date ${dateString}:`,
        error.message
      );
      return null;
    }

    if (data) {
      // Ensure the id is treated as a number if it comes back differently
      return {
        ...data,
        id: Number(data.id)
      };
    }

    return null;
  } catch (err: any) {
    console.error(
      `Unexpected error in getSeasonFromDate for ${dateString}:`,
      err.message
    );
    return null;
  }
}

/**
 * Fetches season details from Supabase based on a season ID.
 * @param seasonId - The numeric season ID (e.g., 20232024).
 * @returns A Promise resolving to the SeasonInfo object or null if not found/error.
 */
async function getSeasonDetailsById(
  seasonId: number
): Promise<SeasonInfo | null> {
  try {
    const { data, error } = await supabase
      .from("seasons")
      .select("id, startDate, regularSeasonEndDate") // Select needed columns
      .eq("id", seasonId)
      .single(); // Expect only one season for a given ID

    if (error) {
      console.error(
        `Error fetching season details for ID ${seasonId}:`,
        error.message
      );
      return null;
    }
    if (data) {
      // Ensure the id is treated as a number
      return {
        ...data,
        id: Number(data.id)
      };
    }
    return null;
  } catch (err: any) {
    console.error(
      `Unexpected error in getSeasonDetailsById for ${seasonId}:`,
      err.message
    );
    return null;
  }
}

/**
 * Fetch aggregate statistics for a specific goalie up to a given date *within its season*.
 * @param playerId - The ID of the goalie.
 * @param playerName - The full name of the goalie.
 * @param date - The target date up to which to fetch statistics.
 * @returns An object containing goalieStats and advancedGoalieStats arrays.
 */
export async function fetchDataForPlayer(
  playerId: string,
  playerName: string,
  date: string // Expects 'YYYY-MM-DD'
): Promise<{
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
  daysLeftStats: WGODaysLeftStat[];
} | null> {
  // Return null if season context is missing
  let start = 0;
  let moreDataAvailable = true;
  let goalieStats: WGOGoalieStat[] = [];
  let advancedGoalieStats: WGOAdvancedGoalieStat[] = [];
  let daysLeftStats: WGODaysLeftStat[] = [];

  const limit = 100;
  const formattedEndDate = date; // Already should be 'YYYY-MM-DD'

  // *** Determine the season based on the end date ***
  const season = await getSeasonFromDate(formattedEndDate);
  if (!season) {
    console.error(
      `Could not determine season for date ${formattedEndDate} in fetchDataForPlayer.`
    );
    return null; // Indicate failure due to missing season context
  }
  const formattedSeasonStartDate = season.startDate; // Use start date from Supabase

  while (moreDataAvailable) {
    const encodedPlayerName = encodeURIComponent(`%${playerName}%`);

    // Update the URL to fetch aggregate data up to the specified date within the determined season
    const goalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=false&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedSeasonStartDate}%22%20and%20gameTypeId=2%20and%20playerId=%22${playerId}%22`;
    const advancedGoalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=true&isGame=false&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedSeasonStartDate}%22%20and%20gameTypeId=2%20and%20playerId=%22${playerId}%22`;
    // Note: The daysRestUrl logic might need adjustment depending on its intended use (single date vs aggregate)
    const daysRestUrl = `https://api.nhle.com/stats/rest/en/goalie/daysrest?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedEndDate}%22`; // This still looks like single date

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
      daysLeftStats = daysLeftStats.concat(
        daysRestResponse.data as WGODaysLeftStat[]
      );

      moreDataAvailable =
        (goalieStatsResponse.data?.length || 0) === limit ||
        (advancedGoalieStatsResponse.data?.length || 0) === limit ||
        (daysRestResponse.data?.length || 0) === limit; // Adjust check for potentially empty data arrays
      start += limit;
    } catch (fetchError: any) {
      console.error(
        `Error fetching player data for ${playerId} on ${formattedEndDate}:`,
        fetchError.message
      );
      moreDataAvailable = false; // Stop fetching on error
      return null; // Indicate failure
    }
  }

  return {
    goalieStats,
    advancedGoalieStats,
    daysLeftStats
  };
}

/**
 * Update goalie stats for a specific date in the Supabase database, using the correct season ID.
 * @param date - The date string 'YYYY-MM-DD' for which to update the stats.
 * @returns An object indicating whether the update was successful along with the fetched stats.
 */
async function updateGoalieStats(date: string): Promise<{
  // date is 'YYYY-MM-DD'
  updated: boolean;
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
  daysRestStats: WGODaysLeftStat[];
  processedDate: string;
}> {
  const formattedDate = date; // Assume input is 'YYYY-MM-DD'
  let updateCount = 0;

  // *** Determine the season ID for the given date ***
  const season = await getSeasonFromDate(formattedDate);
  if (!season) {
    console.warn(
      `Skipping update for ${formattedDate}: Could not find season.`
    );
    return {
      updated: false,
      goalieStats: [],
      advancedGoalieStats: [],
      daysRestStats: [],
      processedDate: formattedDate
    };
  }
  const seasonId = season.id; // Use the ID from the 'seasons' table

  // Fetch data specifically for this date
  const dataForDate = await fetchAllDataForDate(formattedDate, 100); // Use the existing fetchAllDataForDate
  const goalieStats = dataForDate.goalieStats;
  const advancedGoalieStats = dataForDate.advancedGoalieStats;
  const daysRestStats = dataForDate.daysRestStats;

  // Iterate over each goalie stat and upsert into the Supabase table
  for (const stat of goalieStats) {
    const advStats = advancedGoalieStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const daysRestStat = daysRestStats.find(
      (dStat) => dStat.playerId === stat.playerId
    );
    try {
      await supabase.from("wgo_goalie_stats").upsert({
        // Mapping fields from fetched data to Supabase table columns
        goalie_id: stat.playerId,
        goalie_name: stat.goalieFullName,
        date: formattedDate,
        season_id: seasonId, // *** Use the correct season ID ***
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
        complete_game_pct: advStats?.completeGamePct,
        complete_games: advStats?.completeGames,
        incomplete_games: advStats?.incompleteGames,
        quality_start: advStats?.qualityStart,
        quality_starts_pct: advStats?.qualityStartsPct,
        regulation_losses: advStats?.regulationLosses,
        regulation_wins: advStats?.regulationWins,
        shots_against_per_60: advStats?.shotsAgainstPer60,
        games_played_days_rest_0: daysRestStat?.gamesPlayedDaysRest0,
        games_played_days_rest_1: daysRestStat?.gamesPlayedDaysRest1,
        games_played_days_rest_2: daysRestStat?.gamesPlayedDaysRest2,
        games_played_days_rest_3: daysRestStat?.gamesPlayedDaysRest3,
        games_played_days_rest_4_plus: daysRestStat?.gamesPlayedDaysRest4Plus,
        save_pct_days_rest_0: daysRestStat?.savePctDaysRest0,
        save_pct_days_rest_1: daysRestStat?.savePctDaysRest1,
        save_pct_days_rest_2: daysRestStat?.savePctDaysRest2,
        save_pct_days_rest_3: daysRestStat?.savePctDaysRest3,
        save_pct_days_rest_4_plus: daysRestStat?.savePctDaysRest4Plus
      });
      updateCount++;
    } catch (upsertError: any) {
      console.error(
        `Upsert failed for goalie ${stat.playerId} on ${formattedDate} (Season ${seasonId}):`,
        upsertError.message
      );
      // Decide if you want to stop or continue on upsert error
    }
  }
  console.log(
    `Updated ${updateCount} goalie stats for ${formattedDate} (Season ${seasonId})`
  );
  return {
    updated: updateCount > 0,
    goalieStats,
    advancedGoalieStats,
    daysRestStats,
    processedDate: formattedDate
  };
}

/**
 * Fetch all goalie data for a specific date with a limit on the number of records.
 * (This function remains largely the same, as it fetches based on a single date)
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
  // console.log("Fetching data for date:", formattedDate); // Keep if useful

  // Loop to fetch all pages of data from the API
  while (moreDataAvailable) {
    const goalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=0&cayenneExp=gameDate%3C%3D%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E%3D%22${formattedDate}%22%20and%20gameTypeId%3D2`; // isAggregate=false, gamesPlayed >= 0 for single day
    const advancedGoalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=0&cayenneExp=gameDate%3C%3D%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E%3D%22${formattedDate}%22%20and%20gameTypeId%3D2`; // isAggregate=false, gamesPlayed >= 0
    const daysRestUrl = `https://api.nhle.com/stats/rest/en/goalie/daysrest?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C%3D%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E%3D%22${formattedDate}%22`; // isAggregate=false

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

      // Check if the length of *any* response data equals the limit
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

/**
 * Update goalie stats for an entire specified season by iterating through each day.
 * @param targetSeasonId - The numeric ID of the season to process (e.g., 20232024).
 * @returns An object containing a success message and the total number of updates made.
 */
async function updateAllGoalieStatsForSeason(targetSeasonId: number) {
  console.log(`Starting full season update for Season ID: ${targetSeasonId}`);

  // *** Fetch the specific season's details ***
  const seasonDetails = await getSeasonDetailsById(targetSeasonId);
  if (!seasonDetails) {
    console.error(
      `Could not find season details for ID ${targetSeasonId}. Aborting.`
    );
    return {
      message: `Failed to find season details for ID ${targetSeasonId}.`,
      success: false,
      totalUpdates: 0,
      totalErrors: 1 // Count this as an error
    };
  }

  // Use dates from the fetched season details
  // Add one day to start date for iteration start because parseISO might handle timezones unexpectedly
  let currentDate = addDays(parseISO(seasonDetails.startDate), 0); // Start from the exact start date
  const endDate = parseISO(seasonDetails.regularSeasonEndDate);

  let totalUpdates = 0;
  let totalErrors = 0;

  // Iterate from season start date up to and including the regular season end date
  while (isBefore(currentDate, addDays(endDate, 1))) {
    // Loop until *after* the end date
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    try {
      // Use the already refactored updateGoalieStats which handles fetching and upserting for a single date
      const dailyResult = await updateGoalieStats(formattedDate);
      if (dailyResult.updated) {
        // Count updates based on how many were actually performed in updateGoalieStats
        // Note: updateGoalieStats doesn't return count, so we estimate based on goalieStats length. Refine if needed.
        totalUpdates += dailyResult.goalieStats.length;
      } else if (
        !dailyResult.updated &&
        dailyResult.goalieStats.length === 0 &&
        !(await getSeasonFromDate(formattedDate))
      ) {
        // If not updated AND no season found for the date (e.g., mid-season break?), don't count as error
        console.log(
          `Skipping ${formattedDate} as it falls outside a season definition.`
        );
      } else if (!dailyResult.updated) {
        // Potentially log non-update scenarios if needed, but maybe not errors unless fetch failed
        // console.log(`No updates performed for ${formattedDate}`);
      }
    } catch (e: any) {
      console.error(`Critical error processing ${formattedDate}:`, e.message);
      totalErrors++;
    }
    currentDate = addDays(currentDate, 1); // Move to the next day
  }

  console.log(
    `Season ${targetSeasonId} update finished. Total Estimated Updates: ${totalUpdates}, Errors: ${totalErrors}`
  );
  return {
    message: `Season ${targetSeasonId} data update finished.`,
    success: totalErrors === 0,
    totalUpdates,
    totalErrors
  };
}

/**
 * Updates goalie stats for ALL seasons found in the 'seasons' table.
 * This is a potentially long-running operation.
 */
async function updateAllHistoricalGoalieStats(): Promise<{
  message: string;
  success: boolean;
  totalUpdates: number;
  totalErrors: number;
  seasonsProcessed: number;
}> {
  console.log("Starting full historical refresh for ALL seasons...");
  let grandTotalUpdates = 0;
  let grandTotalErrors = 0;
  let seasonsProcessed = 0;

  // 1. Fetch all season IDs
  const { data: seasons, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .order("id", { ascending: true }); // Process chronologically

  if (seasonError) {
    console.error("Failed to fetch season list:", seasonError.message);
    return {
      message: `Failed to fetch season list: ${seasonError.message}`,
      success: false,
      totalUpdates: 0,
      totalErrors: 1,
      seasonsProcessed: 0
    };
  }

  if (!seasons || seasons.length === 0) {
    const msg =
      "No seasons found in the 'seasons' table. Cannot perform full historical refresh.";
    console.error(msg);
    return {
      message: msg,
      success: false,
      totalUpdates: 0,
      totalErrors: 1,
      seasonsProcessed: 0
    };
  }

  console.log(`Found ${seasons.length} seasons to process.`);

  // 2. Loop through each season and update
  for (const season of seasons) {
    const targetSeasonId = Number(season.id);
    if (isNaN(targetSeasonId)) {
      console.warn(`Skipping invalid season ID: ${season.id}`);
      grandTotalErrors++;
      continue;
    }

    console.log(`--- Processing Season ${targetSeasonId} ---`);
    try {
      // Call the function that processes a single full season
      const seasonResult = await updateAllGoalieStatsForSeason(targetSeasonId);
      grandTotalUpdates += seasonResult.totalUpdates;
      grandTotalErrors += seasonResult.totalErrors;
      seasonsProcessed++;
      console.log(
        `--- Finished Season ${targetSeasonId}. Updates: ${seasonResult.totalUpdates}, Errors: ${seasonResult.totalErrors} ---`
      );
      // Optional: Add a small delay between seasons if needed to avoid rate limits
      // await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    } catch (e: any) {
      console.error(
        `Critical error during processing of season ${targetSeasonId}:`,
        e.message
      );
      grandTotalErrors++; // Increment error count for the season that failed critically
    }
  }

  const finalMessage = `Full historical refresh finished processing ${seasonsProcessed} seasons.`;
  console.log(
    `${finalMessage} Grand Total Updates: ${grandTotalUpdates}, Grand Total Errors: ${grandTotalErrors}`
  );
  return {
    message: finalMessage,
    success: grandTotalErrors === 0,
    totalUpdates: grandTotalUpdates,
    totalErrors: grandTotalErrors,
    seasonsProcessed: seasonsProcessed
  };
}

/**
 * Updates goalie stats incrementally from the day after the most recent
 * record in the database up to yesterday.
 */
async function updateRecentGoalieStats(): Promise<{
  message: string;
  success: boolean;
  totalUpdates: number;
  totalErrors: number;
  startDate: string | null;
  endDate: string;
}> {
  console.log("Starting incremental update (action=all)...");
  let totalUpdates = 0;
  let totalErrors = 0;

  // 1. Find the most recent date in wgo_goalie_stats
  const { data: latestEntry, error: latestEntryError } = await supabase
    .from("wgo_goalie_stats")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle(); // Use maybeSingle to handle empty table gracefully

  if (latestEntryError) {
    console.error("Error fetching latest date:", latestEntryError.message);
    return {
      message: `Failed to fetch latest date: ${latestEntryError.message}`,
      success: false,
      totalUpdates: 0,
      totalErrors: 1,
      startDate: null,
      endDate: format(subDays(new Date(), 1), "yyyy-MM-dd") // Yesterday
    };
  }

  // 2. Determine the start date for fetching
  let startDateToProcess: Date;
  if (latestEntry?.date) {
    startDateToProcess = addDays(parseISO(latestEntry.date), 1); // Day after the last record
    console.log(
      `Last record found on: ${latestEntry.date}. Starting update from: ${format(startDateToProcess, "yyyy-MM-dd")}`
    );
  } else {
    // Table is empty - decide behaviour. Let's default to starting from the beginning of the *current* season.
    console.warn(
      "No existing data found. Starting incremental update from the beginning of the current season."
    );
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const currentSeasonInfo = await getSeasonFromDate(todayStr); // Assumes today is within a season
    if (currentSeasonInfo) {
      startDateToProcess = parseISO(currentSeasonInfo.startDate);
      console.log(
        `Determined current season start date: ${currentSeasonInfo.startDate}`
      );
    } else {
      // Still couldn't find current season (e.g., deep offseason) - maybe start from a fixed historical date or fail?
      // Let's try fetching the absolute earliest season start date as a last resort
      const { data: earliestSeason, error: earliestError } = await supabase
        .from("seasons")
        .select("startDate")
        .order("startDate", { ascending: true })
        .limit(1)
        .single();
      if (earliestSeason && !earliestError) {
        startDateToProcess = parseISO(earliestSeason.startDate);
        console.warn(
          `Could not determine current season, starting from earliest known season: ${earliestSeason.startDate}`
        );
      } else {
        const msg =
          "Table is empty and could not determine a start date (current or earliest season not found). Run 'action=fullRefresh' first.";
        console.error(msg);
        return {
          message: msg,
          success: false,
          totalUpdates: 0,
          totalErrors: 1,
          startDate: null,
          endDate: format(subDays(new Date(), 1), "yyyy-MM-dd")
        };
      }
    }
  }

  // 3. Determine the end date (yesterday)
  const endDateToProcess = subDays(new Date(), 1); // Process up to yesterday
  const formattedEndDate = format(endDateToProcess, "yyyy-MM-dd");

  // 4. Check if start date is already after end date
  if (isAfter(startDateToProcess, endDateToProcess)) {
    const msg = `Database is already up-to-date (Last record: ${latestEntry?.date ?? "N/A"}, Target end date: ${formattedEndDate}). No incremental update needed.`;
    console.log(msg);
    return {
      message: msg,
      success: true,
      totalUpdates: 0,
      totalErrors: 0,
      startDate: format(startDateToProcess, "yyyy-MM-dd"),
      endDate: formattedEndDate
    };
  }

  const loopStartDateStr = format(startDateToProcess, "yyyy-MM-dd");
  console.log(
    `Processing dates from ${loopStartDateStr} to ${formattedEndDate}`
  );

  // 5. Loop through dates and update
  let currentDate = startDateToProcess;
  while (isBefore(currentDate, addDays(endDateToProcess, 1))) {
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    try {
      // Use the existing updateGoalieStats for single-day processing
      const dailyResult = await updateGoalieStats(formattedDate);
      if (dailyResult.updated) {
        // Estimate updates based on stats length - refine if updateGoalieStats returns actual count
        totalUpdates += dailyResult.goalieStats.length;
      } else if (!dailyResult.updated && dailyResult.goalieStats.length === 0) {
        // Don't count as error if no data for the day or outside season definition
        // console.log(`No data or season found for ${formattedDate}. Skipping.`);
      }
    } catch (e: any) {
      console.error(
        `Critical error processing ${formattedDate} during incremental update:`,
        e.message
      );
      totalErrors++;
      // Optional: Decide whether to stop the whole process on critical error
    }
    currentDate = addDays(currentDate, 1);
  }

  const finalMessage = `Incremental update finished. Processed dates: ${loopStartDateStr} to ${formattedEndDate}.`;
  console.log(
    `${finalMessage} Estimated Updates: ${totalUpdates}, Errors: ${totalErrors}`
  );
  return {
    message: finalMessage,
    success: totalErrors === 0,
    totalUpdates,
    totalErrors,
    startDate: loopStartDateStr,
    endDate: formattedEndDate
  };
}

// --- API Handler ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const jobName = "update-all-wgo-goalies";
  const startTime = Date.now();

  let status: "success" | "error" = "success";
  let rowsAffected = 0; // Note: This becomes an aggregate or estimate for multi-day/season actions
  let totalErrors = 0;
  let details: any = {};
  let responseMessage = "";
  let responseData: any = {};

  try {
    const actionParam = req.query.action as string | undefined;
    const dateParam = req.query.date as string | undefined;
    const playerIdParam = req.query.playerId as string | undefined;
    const goalieFullName =
      (req.query.goalieFullName as string | undefined) || "Unknown Goalie";
    const seasonParam = req.query.season as string | undefined; // Expects format like '20232024'

    // --- Action: all (Incremental Update) ---
    if (actionParam === "all") {
      details.action = "incremental_update";
      const result = await updateRecentGoalieStats();
      rowsAffected = result.totalUpdates; // Aggregate
      totalErrors = result.totalErrors;
      status = result.success ? "success" : "error";
      responseMessage = result.message;
      details = { ...details, ...result }; // Merge result details
      responseData = result;
    }

    // --- Action: fullRefresh (Specific Season or All History) ---
    else if (actionParam === "fullRefresh") {
      if (seasonParam) {
        // Process Specific Season
        details.action = "full_refresh_single_season";
        const targetSeasonId = parseInt(seasonParam, 10);
        if (isNaN(targetSeasonId)) {
          throw new Error(
            `Invalid season parameter format: ${seasonParam}. Expected numeric ID like 20232024.`
          );
        }
        console.log(`Received request for specific season: ${targetSeasonId}`);
        details.targetSeasonId = targetSeasonId;

        const result = await updateAllGoalieStatsForSeason(targetSeasonId);
        rowsAffected = result.totalUpdates;
        totalErrors = result.totalErrors;
        status = result.success ? "success" : "error";
        responseMessage = result.message;
        details = {
          ...details,
          totalUpdates: result.totalUpdates,
          totalErrors: result.totalErrors
        };
        responseData = result;
      } else {
        // Process All Historical Seasons
        details.action = "full_refresh_all_history";
        const result = await updateAllHistoricalGoalieStats();
        rowsAffected = result.totalUpdates; // Aggregate
        totalErrors = result.totalErrors;
        status = result.success ? "success" : "error";
        responseMessage = result.message;
        details = { ...details, ...result }; // Merge result details
        responseData = result;
      }
    }

    // --- Action: date (Update Single Date) ---
    else if (dateParam && !actionParam && !playerIdParam) {
      // Check it's *only* dateParam
      details.action = "single_date_update";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        throw new Error(
          `Invalid date format: ${dateParam}. Expected YYYY-MM-DD.`
        );
      }
      const result = await updateGoalieStats(dateParam);
      rowsAffected = result.goalieStats.length; // Estimate for the day
      // We consider the API call successful even if no stats found, unless underlying fetch fails
      status = "success"; // Assume success unless updateGoalieStats throws
      responseMessage = `Processed goalie stats update request for date ${dateParam}.`;
      details = {
        ...details,
        processedDate: result.processedDate,
        updated: result.updated,
        statsFetched: rowsAffected
      };
      responseData = result;
    }

    // --- Action: Fetch Single Player (requires date) ---
    else if (playerIdParam && dateParam && !actionParam) {
      // Check it's player and date only
      details.action = "fetch_single_player";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        throw new Error(
          `Invalid date format: ${dateParam}. Expected YYYY-MM-DD.`
        );
      }
      const result = await fetchDataForPlayer(
        playerIdParam,
        goalieFullName,
        dateParam
      );

      if (result === null) {
        throw new Error(
          `Failed to fetch player data for ${playerIdParam} on ${dateParam}, possibly missing season context.`
        );
      }

      rowsAffected = result.goalieStats.length; // Count fetched stats
      status = "success";
      responseMessage = `Successfully fetched goalie stats for player ${goalieFullName} up to ${dateParam}.`;
      details = {
        ...details,
        fetched: rowsAffected > 0,
        dateContext: dateParam,
        playerId: playerIdParam
      };
      responseData = result;
    }

    // --- No valid action or parameter combination ---
    else {
      throw new Error(
        "Missing or invalid required parameters. Valid combinations: 'action=all', 'action=fullRefresh' (optional '&season=YYYYYYYY'), 'date=YYYY-MM-DD', or 'playerId=<id>&date=YYYY-MM-DD'."
      );
    }

    // --- Send successful response ---
    return res.status(status === "success" ? 200 : 500).json({
      // Use 500 if process finished with errors
      message: responseMessage,
      success: status === "success",
      data: responseData // Include detailed result object
    });
  } catch (err: any) {
    console.error("Error in handler:", err);
    status = "error";
    // Add error message to details ONLY if not already set by specific actions
    details = { error: err.message, ...details };
    if (!res.headersSent) {
      const statusCode =
        err.message.includes("Invalid") || err.message.includes("Missing")
          ? 400
          : 500;
      res.status(statusCode).json({ message: err.message, success: false });
    }
  } finally {
    const elapsedMs = Date.now() - startTime;
    details = { ...details, processingTimeMs: elapsedMs };

    try {
      await supabase.from("cron_job_audit").insert([
        {
          job_name: jobName,
          status,
          rows_affected: rowsAffected,
          details // Contains more context including action type
        }
      ]);
    } catch (auditErr: any) {
      console.error("Failed to write audit row:", auditErr.message);
    }
  }
}
