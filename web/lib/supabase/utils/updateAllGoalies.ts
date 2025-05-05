// lib/updateAllGoalies.ts

import { fetchAllGoalies } from "./fetchAllGoalies";
import { fetchDataForPlayer } from "pages/api/v1/db/update-wgo-goalies";
import supabase from "lib/supabase";
import { format, parseISO, addDays, isBefore, isAfter } from "date-fns";
import { getCurrentSeason } from "lib/NHL/server"; // Adjust the import path as needed
import pLimit from "p-limit";
import { to } from "@react-spring/web";

interface UpdateResult {
  totalUpdates: number;
  totalErrors: number;
}

export async function updateAllGoaliesStats(): Promise<UpdateResult> {
  try {
    const currentSeason = await getCurrentSeason();
    const endDate = parseISO(currentSeason.regularSeasonEndDate);
    const today = new Date();

    // Determine the final end date: today or regularSeasonEndDate, whichever is earlier
    const finalEndDate = isBefore(today, endDate) ? today : endDate;

    // **Preliminary Check: Get the most recent date from wgo_goalie_stats**
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
      currentDate = parseISO(currentSeason.regularSeasonStartDate);
    }

    console.log(
      "Starting update from date:",
      format(currentDate, "yyyy-MM-dd")
    );
    console.log("Ending update at date:", format(finalEndDate, "yyyy-MM-dd"));

    let totalUpdates = 0; // To track the total number of updates made
    let totalErrors = 0; // To track the total number of errors

    // Initialize concurrency limiter (adjust concurrency as needed)
    const limit = pLimit(5);

    // Fetch all goalies once before the loop
    const goalies = await fetchAllGoalies();
    console.log(`Fetched ${goalies.length} goalies.`);

    // Loop through each day of the season starting from currentDate
    while (!isAfter(currentDate, finalEndDate)) {
      const formattedDate = format(currentDate, "yyyy-MM-dd");
      console.log(`Processing data for date: ${formattedDate}`);

      // Create an array of promises for each goalie
      const updatePromises = goalies.map((goalie) =>
        limit(async () => {
          const playerId = goalie.id.toString();
          const goalieFullName = goalie.fullName;

          try {
            const fetchedData = await fetchDataForPlayer(
              playerId,
              goalieFullName,
              formattedDate
            );

            // Check if fetchedData is null before destructuring
            if (!fetchedData) {
              console.log(
                `No data returned for goalie ID: ${playerId} on date: ${formattedDate}`
              );
              return; // Skip this goalie for this date
            }

            const { goalieStats, advancedGoalieStats } = fetchedData;

            if (goalieStats.length === 0) {
              console.log(
                `No stats found for goalie ID: ${playerId} on date: ${formattedDate}`
              );
              return;
            }

            // Prepare data for upsert
            const upsertData = goalieStats.map((stat) => {
              const advStats = advancedGoalieStats.find(
                (aStat) => aStat.playerId === stat.playerId
              );

              return {
                goalie_id: stat.playerId,
                goalie_name: goalieFullName,
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
                // Advanced stats
                complete_game_pct: advStats?.completeGamePct,
                complete_games: advStats?.completeGames,
                incomplete_games: advStats?.incompleteGames,
                quality_start: advStats?.qualityStart,
                quality_starts_pct: advStats?.qualityStartsPct,
                regulation_losses: advStats?.regulationLosses,
                regulation_wins: advStats?.regulationWins,
                shots_against_per_60: advStats?.shotsAgainstPer60
              };
            });

            // Batch upsert for efficiency
            const { error } = await supabase
              .from("wgo_goalie_stats")
              .upsert(upsertData);

            if (error) {
              totalErrors++;
              throw error;
            }

            totalUpdates += upsertData.length;

            console.log(
              `Successfully updated stats for goalie ID: ${playerId} on date: ${formattedDate}`
            );
          } catch (error: any) {
            totalErrors++;
            console.error(
              `Failed to update stats for goalie ID: ${playerId} on date: ${formattedDate}. Reason: ${error.message}`
            );
          }
        })
      );

      // Await all goalie updates for the current date
      await Promise.all(updatePromises);

      // Move to the next day
      currentDate = addDays(currentDate, 1);
    }

    console.log(
      `Finished updating goalie stats for the season. Total updates: ${totalUpdates}`
    );

    return { totalUpdates, totalErrors };
  } catch (error: any) {
    console.error(`Error in updateAllGoaliesStats: ${error.message}`);
    throw error;
  }
}
