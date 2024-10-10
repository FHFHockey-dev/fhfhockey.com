// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\powerPlayTimeFrame.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { get } from "lib/NHL/base";
import { getCurrentSeason } from "lib/NHL/server";
import supabase from "lib/supabase";
import adminOnly from "utils/adminOnlyMiddleware";
import getPowerPlayBlocks, { Block } from "utils/getPowerPlayBlocks"; // Adjust the import path as necessary
import { extractPowerPlayDetails, PowerPlay } from "utils/extractPPDetails"; // Import the new function

export default adminOnly(async (req, res) => {
  const { supabase } = req;

  // Correctly extract gameId from req.query
  const { gameId } = req.query;

  // Handle the case where gameId might be an array
  const gameIdParam = Array.isArray(gameId) ? gameId[0] : gameId;

  // Validate gameId
  if (!gameIdParam || (gameIdParam !== "all" && isNaN(Number(gameIdParam)))) {
    return res.status(400).json({
      message: "Invalid or missing gameId parameter.",
      success: false,
    });
  }

  let season = { seasonId: 0 };
  if (req.query.seasonId) {
    const seasonId = Number(req.query.seasonId);
    season.seasonId = seasonId;
  } else {
    season = await getCurrentSeason();
  }

  try {
    let gameIds: number[] = [];

    if (gameIdParam === "all") {
      // Step 1: Get the most recent game_date from pp_timeframes
      const { data: ppData, error: ppError } = await supabase
        .from("pp_timeframes")
        .select("game_date")
        .order("game_date", { ascending: false })
        .limit(1);

      if (ppError) throw ppError;

      let lastProcessedDate: string | null = null;

      if (ppData && ppData.length > 0) {
        lastProcessedDate = ppData[0].game_date;
      }

      // Step 2: Fetch games after the lastProcessedDate up to today
      const gamesQuery = supabase
        .from("games")
        .select("id, homeTeamId") // Corrected column names
        .eq("seasonId", season.seasonId)
        .eq("type", 2) // Regular season games only
        .lte("date", new Date().toISOString().split("T")[0]); // Correct date format

      if (lastProcessedDate) {
        gamesQuery.gt("date", lastProcessedDate);
      }

      const { data, error } = await gamesQuery;

      if (error) throw error;

      gameIds = data.map((game: any) => game.id);
    } else {
      // Single gameId
      gameIds = [Number(gameIdParam)];
    }

    if (gameIds.length === 0) {
      return res.status(200).json({
        message: "No game IDs found matching the criteria.",
        success: true,
      });
    }

    // Fetch play-by-play data in parallel
    const fetchPromises = gameIds.map((id) => fetchPlayByPlay(id));

    const results = await Promise.allSettled(fetchPromises);

    const successfulResults = results
      .filter(
        (result) => result.status === "fulfilled" && result.value !== null
      )
      .map((result) => (result as PromiseFulfilledResult<any>).value);

    const failedResults = results
      .filter((result) => result.status === "rejected")
      .map((result) => (result as PromiseRejectedResult).reason);

    // Upsert successful results into Supabase
    if (successfulResults.length > 0) {
      // Extract power play details for each game
      const gamesWithPP: any[] = await Promise.all(
        successfulResults.map(async (game: any) => {
          const blocks: Block[] = getPowerPlayBlocks(game.plays);
          const ppTimeframes: PowerPlay[] = extractPowerPlayDetails(
            blocks,
            game.plays,
            {
              home_team_id: game.home_team_id,
              home_side: determineHomeSide(game.plays),
            }
          );

          return {
            game_id: game.game_id,
            season_id: game.season_id,
            game_type: game.game_type,
            game_date: game.game_date,
            game_state: game.game_state,
            away_team_id: game.away_team_id,
            away_team_abbrev: game.away_team_abbrev,
            away_team_score: game.away_team_score,
            away_team_sog: game.away_team_sog,
            home_team_id: game.home_team_id,
            home_team_abbrev: game.home_team_abbrev,
            home_team_score: game.home_team_score,
            home_team_sog: game.home_team_sog,
            plays: game.plays,
            pp_timeframes: ppTimeframes,
          };
        })
      );

      await supabase
        .from("pp_timeframes")
        .upsert(gamesWithPP, { onConflict: "game_id" }) // Use 'game_id' for conflict
        .throwOnError();
    }

    // Handle failed results: log and retry
    if (failedResults.length > 0) {
      console.error("Failed to fetch some play-by-play data:", failedResults);
      // Implement retry logic if necessary
      // For simplicity, retries can be implemented with another set of fetchPromises
      // Here, we'll attempt one more retry for each failed gameId
      const retryPromises = failedResults.map((error: any) => {
        const failedGameId = error.gameId;
        return fetchPlayByPlay(failedGameId);
      });

      const retryResults = await Promise.allSettled(retryPromises);

      const successfulRetries = retryResults
        .filter(
          (result) => result.status === "fulfilled" && result.value !== null
        )
        .map((result) => (result as PromiseFulfilledResult<any>).value);

      const failedRetries = retryResults
        .filter((result) => result.status === "rejected")
        .map((result) => (result as PromiseRejectedResult).reason);

      if (successfulRetries.length > 0) {
        // Extract power play details for each retried game
        const retriedGamesWithPP: any[] = await Promise.all(
          successfulRetries.map(async (game: any) => {
            const blocks: Block[] = getPowerPlayBlocks(game.plays);
            const ppTimeframes: PowerPlay[] = extractPowerPlayDetails(
              blocks,
              game.plays,
              {
                home_team_id: game.home_team_id,
                home_side: determineHomeSide(game.plays),
              }
            );

            return {
              game_id: game.game_id,
              season_id: game.season_id,
              game_type: game.game_type,
              game_date: game.game_date,
              game_state: game.game_state,
              away_team_id: game.away_team_id,
              away_team_abbrev: game.away_team_abbrev,
              away_team_score: game.away_team_score,
              away_team_sog: game.away_team_sog,
              home_team_id: game.home_team_id,
              home_team_abbrev: game.home_team_abbrev,
              home_team_score: game.home_team_score,
              home_team_sog: game.home_team_sog,
              plays: game.plays,
              pp_timeframes: ppTimeframes,
            };
          })
        );

        await supabase
          .from("pp_timeframes")
          .upsert(retriedGamesWithPP, { onConflict: "game_id" }) // Use 'game_id' for conflict
          .throwOnError();
      }

      if (failedRetries.length > 0) {
        console.error("Failed to fetch after retrying:", failedRetries);
        // Optionally, send a warning to the client about partial failures
      }
    }

    res.status(200).json({
      message: `Successfully processed ${successfulResults.length} games.`,
      success: true,
      failed: failedResults.length,
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({
      message: e.message,
      success: false,
    });
  }
});

/**
 * Determines the home side ("left" or "right") based on play-by-play data.
 * Assumes that at least one play contains the home_side information.
 * @param plays Play-by-play data of the game.
 * @returns "left" or "right"
 */
function determineHomeSide(plays: any[]): "left" | "right" {
  const homeSidePlay = plays.find(
    (play) => play.typeDescKey === "penalty" && play.home_side // Ensure 'home_side' exists
  );
  return homeSidePlay ? homeSidePlay.home_side : "left"; // Default to "left" if not found
}

/**
 * Fetch play-by-play data for a given gameId and transform it.
 * @param gameId
 * @returns Transformed play-by-play data suitable for upserting into Supabase
 */
async function fetchPlayByPlay(gameId: number) {
  const endpoint = `/gamecenter/${gameId}/play-by-play`;

  try {
    const data = await get(endpoint);

    // Check if gameState is "OFF"
    if (data.gameState !== "OFF") {
      console.log(
        `Skipping gameId ${gameId} as gameState is ${data.gameState}`
      );
      return null; // Indicate that this game should not be processed
    }

    // Validate required fields
    if (!data.gameDate) {
      console.log(`Skipping gameId ${gameId} as gameDate is missing`);
      return null;
    }

    // Extract and transform the necessary fields
    const transformedData = {
      game_id: data.id, // Changed from 'id' to 'game_id' to match 'pp_timeframes' table
      season_id: data.season,
      game_type: data.gameType,
      game_date: data.gameDate, // Corrected mapping
      game_state: data.gameState,
      away_team_id: data.awayTeam.id,
      away_team_abbrev: data.awayTeam.abbrev,
      away_team_score: data.awayTeam.score,
      away_team_sog: data.awayTeam.sog,
      home_team_id: data.homeTeam.id,
      home_team_abbrev: data.homeTeam.abbrev,
      home_team_score: data.homeTeam.score,
      home_team_sog: data.homeTeam.sog,
      plays: data.plays,
    };

    return transformedData;
  } catch (error: any) {
    console.error(`Failed to fetch play-by-play for gameId ${gameId}:`, error);
    // Attach gameId to the error for retry purposes
    throw { gameId, message: error.message };
  }
}
