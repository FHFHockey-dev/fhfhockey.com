// pages/api/v1/db/update-stats-by-season.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import supabase from "lib/supabase";
import { HTMLElement, parse } from "node-html-parser";
import { get } from "lib/NHL/base";
import { updatePlayer } from "./update-player/[playerId]";
import fetchWithCache from "lib/fetchWithCache";

type GameState = "OFF" | "FINAL" | "FUT";
type Category =
  | "sog"
  | "faceoffWinningPctg"
  | "powerPlay"
  | "powerPlayPctg"
  | "pim"
  | "hits"
  | "blockedShots"
  | "giveaways"
  | "takeaways";

type TeamGameStat = {
  category: Category;
  awayValue: string | number;
  homeValue: string | number;
};

type Forward = {
  playerId: number;
  gameId: number;
  position: "C" | "L" | "R";
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  blockedShots: number;
  powerPlayGoals: number;
  powerPlayPoints: number; // Calculated: PPG + PPA
  shorthandedGoals: number;
  shPoints: number; // Calculated: SHG + SHA
  shots: number;
  faceoffs: string;
  faceoffWinningPctg: number;
  toi: string;
  powerPlayToi: string;
  shorthandedToi: string;
};

type Defense = {
  playerId: number;
  gameId: number;
  position: "D";
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  blockedShots: number;
  powerPlayGoals: number;
  powerPlayPoints: number; // Calculated: PPG + PPA
  shorthandedGoals: number;
  shPoints: number; // Calculated: SHG + SHA
  shots: number;
  faceoffs: string; // Requires PBP data
  faceoffWinningPctg: number;
  toi: string;
  powerPlayToi: string; // Requires PBP/HTML data
  shorthandedToi: string; // Requires PBP/HTML data
};

type Goalie = {
  playerId: number;
  gameId: number;
  position: "G";
  evenStrengthShotsAgainst?: string;
  powerPlayShotsAgainst?: string;
  shorthandedShotsAgainst?: string;
  saveShotsAgainst: string;
  savePctg?: number;
  evenStrengthGoalsAgainst?: number;
  powerPlayGoalsAgainst?: number;
  shorthandedGoalsAgainst?: number;
  pim: number;
  goalsAgainst: number;
  toi: string;
};

type Skater = Forward | Defense;

type ApiForwardData = {
  playerId: number;
  sweaterNumber: number;
  name: { default: string };
  position: "C" | "L" | "R";
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  powerPlayGoals: number;
  sog: number;
  faceoffWinningPctg: number;
  toi: string;
  blockedShots: number;
  shifts: number;
  giveaways: number;
  takeaways: number;
};

type ApiDefenseData = {
  playerId: number;
  sweaterNumber: number;
  name: { default: string };
  position: "D";
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  powerPlayGoals: number;
  sog: number;
  faceoffWinningPctg: number;
  toi: string;
  blockedShots: number;
  shifts: number;
  giveaways: number;
  takeaways: number;
};

type ApiGoalieData = {
  playerId: number;
  position: "G";
  evenStrengthShotsAgainst?: string;
  powerPlayShotsAgainst?: string;
  shorthandedShotsAgainst?: string;
  saveShotsAgainst: string;
  savePctg?: number;
  evenStrengthGoalsAgainst?: number;
  powerPlayGoalsAgainst?: number;
  shorthandedGoalsAgainst?: number;
  pim: number;
  goalsAgainst: number;
  toi: string;
  sweaterNumber?: number;
  name?: { default: string };
};

type ApiPlayerGameStatsData = {
  forwards: ApiForwardData[];
  defense: ApiDefenseData[];
  goalies: ApiGoalieData[];
};

type PlayerCounts = { [playerId: number]: number };

/////////////// API Route Logic //////////////////

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const seasonId = req.query.seasonId as string;

  // Validate seasonId format (basic check, adjust regex if needed)
  if (!seasonId || !/^\d{8}$/.test(seasonId)) {
    return res.status(400).json({
      message:
        "seasonId query parameter is required and must be in YYYYYYYY format (e.g., 20242025).",
      success: false
    });
  }

  console.log(`Received request to update stats for season: ${seasonId}`);

  try {
    // 1. Fetch ALL finished game IDs for the season using PAGINATION
    console.log(
      `Workspaceing all finished game IDs for season ${seasonId} with pagination...`
    );
    const pageSize = 1000; // Supabase default limit per request
    let currentPage = 0;
    let allGamesAccumulator: { id: number }[] = []; // To store games from all pages
    let keepFetching = true;

    while (keepFetching) {
      const rangeFrom = currentPage * pageSize;
      const rangeTo = rangeFrom + pageSize - 1;

      console.log(
        `Workspaceing games page ${currentPage} (Range: ${rangeFrom}-${rangeTo})`
      );

      try {
        const { data: gamesOnPage, error: gamesError } = await supabase
          .from("games")
          .select("id") // Only select the game ID
          .eq("seasonId", seasonId)
          .lte("startTime", new Date().toISOString()) // Filter for finished games
          .order("id", { ascending: true }) // Consistent ordering
          .range(rangeFrom, rangeTo); // Apply pagination range

        if (gamesError) {
          console.error(
            `Error fetching games page ${currentPage} for season ${seasonId}:`,
            gamesError
          );
          // Decide how to handle partial failure: stop or continue?
          // For now, let's stop the whole process if DB query fails.
          throw new Error(
            `Database error fetching games page ${currentPage}: ${gamesError.message}`
          );
        }

        // Add fetched games to the accumulator
        if (gamesOnPage && gamesOnPage.length > 0) {
          allGamesAccumulator = allGamesAccumulator.concat(gamesOnPage);
          console.log(
            `Workspaceed ${gamesOnPage.length} games on page ${currentPage}. Total accumulated: ${allGamesAccumulator.length}`
          );
        }

        // Check if this was the last page
        if (!gamesOnPage || gamesOnPage.length < pageSize) {
          console.log("Reached the last page of games.");
          keepFetching = false; // Stop the loop
        } else {
          // Prepare for the next page
          currentPage++;
        }
      } catch (loopError: any) {
        console.error(
          `Error during game fetch loop (page ${currentPage}):`,
          loopError
        );
        // Stop the process on unexpected errors within the loop
        throw new Error(
          `Failed during game ID pagination: ${loopError.message}`
        );
      }
    } // End of while loop

    // --- Processing starts here, using allGamesAccumulator ---

    if (allGamesAccumulator.length === 0) {
      console.log(
        `No finished games found for season ${seasonId} after pagination.`
      );
      return res.json({
        seasonId,
        message: `No finished games found to update for season ${seasonId}.`,
        success: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        failedGameIds: []
      });
    }

    console.log(
      `Found a total of ${allGamesAccumulator.length} finished games for season ${seasonId}. Starting update process...`
    );

    // 2. Iterate through each game ID (from the complete list) and update its stats
    let successCount = 0;
    let failureCount = 0;
    const failedGameIds: number[] = [];

    // Use the accumulated list of all games
    for (const game of allGamesAccumulator) {
      const gameId = game.id;
      console.log(`--- Processing Game ID: ${gameId} ---`);
      try {
        await updateStats(gameId, supabase); // Call the core logic function
        console.log(`Successfully updated stats for game ${gameId}.`);
        successCount++;
      } catch (e: any) {
        console.error(
          `Failed to update stats for game ${gameId}: ${e.message}`,
          e.stack ? `\nStack: ${e.stack}` : ""
        );
        failureCount++;
        failedGameIds.push(gameId);
        // Continue to the next game even if one fails
      }
      console.log(`--- Finished Processing Game ID: ${gameId} ---`);
      // Optional delay
      // await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(
      `Finished updating stats for season ${seasonId}. Success: ${successCount}, Failed: ${failureCount}`
    );

    // 3. Return summary response
    return res.json({
      seasonId,
      message: `Stats update process completed for season ${seasonId}. Processed: ${allGamesAccumulator.length}, Succeeded: ${successCount}, Failed: ${failureCount}.`,
      success: failureCount === 0,
      processed: allGamesAccumulator.length, // Use total count from accumulator
      succeeded: successCount,
      failed: failureCount,
      failedGameIds: failedGameIds
    });
  } catch (e: any) {
    // Catch errors from pagination loop
    console.error(
      `Unhandled error during season update for ${seasonId}: ${e.message}`,
      e.stack
    );
    return res.status(500).json({
      message: `An unexpected error occurred: ${e.message}`,
      success: false
    });
  }
}

export const isGameFinished = (state: GameState) =>
  (["OFF", "FINAL"] as GameState[]).includes(state);

export async function updateStats(gameId: number, supabase: SupabaseClient) {
  console.log(`Starting updateStats for gameId: ${gameId}`);

  const landing = await get(`/gamecenter/${gameId}/landing`);

  const gameState: GameState = landing?.gameState;
  const season: number | undefined = landing?.season;
  const gameIdentifier: number = landing?.id;

  if (!gameState || !season || !gameIdentifier) {
    throw new Error(
      `Essential game data (gameState, season, id) missing from landing endpoint for game ${gameId}`
    );
  }
  if (gameIdentifier !== gameId) {
    console.warn(
      `Mismatch between requested gameId (${gameId}) and landing data gameId (${gameIdentifier}). Using landing data ID.`
    );
    // gameId = gameIdentifier; // Uncomment to use the API's ID strictly
  }

  console.log(`Game ${gameIdentifier}: State=${gameState}, Season=${season}`);

  if (!isGameFinished(gameState)) {
    console.warn(
      `Game ${gameIdentifier} state is '${gameState}', not considered finished by API. Skipping update.`
    );
    throw new Error(
      `Game ${gameIdentifier} is not finished. gameState: ${gameState}`
    );
  }

  const rightRail = await get(`/gamecenter/${gameIdentifier}/right-rail`);
  const teamGameStats: TeamGameStat[] = rightRail?.teamGameStats;
  if (!teamGameStats || !Array.isArray(teamGameStats)) {
    console.warn(
      `teamGameStats missing or invalid in right-rail for game ${gameIdentifier}. Skipping team stats update.`
    );
  } else {
    console.log(`Processing teamGameStats for game ${gameIdentifier}...`);
    try {
      const homeTeamGameStats = await processTeamGameStats(
        gameIdentifier,
        teamGameStats,
        true,
        landing,
        season.toString(),
        rightRail
      );
      const awayTeamGameStats = await processTeamGameStats(
        gameIdentifier,
        teamGameStats,
        false,
        landing,
        season.toString(),
        rightRail
      );

      console.log(`Upserting teamGameStats for game ${gameIdentifier}...`);
      await supabase
        .from("teamGameStats")
        .upsert([homeTeamGameStats, awayTeamGameStats])
        .throwOnError();
      console.log(
        `Successfully upserted team game stats for game ${gameIdentifier}`
      );
    } catch (teamStatError: any) {
      console.error(
        `Error processing/upserting team stats for game ${gameIdentifier}:`,
        teamStatError
      );
      // throw teamStatError; // Uncomment to make the whole game update fail
    }
  }

  console.log(
    `Workspaceing boxscore for game ${gameIdentifier} (needed for playerByGameStats)...`
  );
  const boxscore = await get(`/gamecenter/${gameIdentifier}/boxscore`);

  const powerPlayAssistsCount: PlayerCounts = {};
  const shorthandedGoalsCount: PlayerCounts = {};
  const shorthandedAssistsCount: PlayerCounts = {};

  const scoringPeriods = landing?.summary?.scoring;
  if (scoringPeriods && Array.isArray(scoringPeriods)) {
    console.log(
      `Processing scoring summary from LANDING data for game ${gameIdentifier}...`
    );
    for (const period of scoringPeriods) {
      const goalsInPeriod = period?.goals;
      if (goalsInPeriod && Array.isArray(goalsInPeriod)) {
        for (const goal of goalsInPeriod) {
          const strength = goal?.strength?.toLowerCase();
          const scorerId = goal?.playerId;
          const assists = goal?.assists;

          if (!scorerId) continue;

          if (strength === "pp" && Array.isArray(assists)) {
            for (const assist of assists) {
              if (assist?.playerId) {
                powerPlayAssistsCount[assist.playerId] =
                  (powerPlayAssistsCount[assist.playerId] || 0) + 1;
              }
            }
          } else if (strength === "sh") {
            shorthandedGoalsCount[scorerId] =
              (shorthandedGoalsCount[scorerId] || 0) + 1;
            if (Array.isArray(assists)) {
              for (const assist of assists) {
                if (assist?.playerId) {
                  shorthandedAssistsCount[assist.playerId] =
                    (shorthandedAssistsCount[assist.playerId] || 0) + 1;
                }
              }
            }
          }
        }
      }
    }
    console.log(
      `Finished processing scoring summary for game ${gameIdentifier}.`
    );
  } else {
    console.warn(
      `Scoring summary not found or invalid in LANDING data for game ${gameIdentifier}. PPP/SHP calculations may be incomplete.`
    );
  }

  console.log(`Counts for game ${gameIdentifier}:`);
  console.log("PPA Counts:", JSON.stringify(powerPlayAssistsCount));
  console.log("SHG Counts:", JSON.stringify(shorthandedGoalsCount));
  console.log("SHA Counts:", JSON.stringify(shorthandedAssistsCount));

  console.log(
    `Extracting player stats using BOXSCORE data for game ${gameIdentifier}...`
  );
  const { skaters, goalies } = getPlayersGameStats(
    boxscore,
    gameIdentifier,
    powerPlayAssistsCount,
    shorthandedGoalsCount,
    shorthandedAssistsCount
  );

  console.log(
    `Upserting player stats for game ${gameIdentifier} in batches...`
  );

  ///////////////// Skaters Upsert (with fallback) ///////////////
  if (skaters && skaters.length > 0) {
    console.log(
      `Attempting batch upsert for ${skaters.length} skaters for game ${gameIdentifier}...`
    );
    try {
      const { error: skaterBatchError } = await supabase
        .from("skatersGameStats")
        .upsert(skaters);
      if (skaterBatchError) throw skaterBatchError;
      console.log(
        `Successfully batch upserted ${skaters.length} skaters for game ${gameIdentifier}.`
      );
    } catch (batchError: any) {
      if (batchError.code === "23503") {
        // Foreign Key Violation
        console.warn(
          `Batch skater upsert failed (FK violation '23503') for game ${gameIdentifier}. Falling back to individual upserts with player updates...`
        );
        await upsertPlayersIndividually(
          supabase,
          skaters,
          "skaters",
          gameIdentifier
        );
      } else {
        console.error(
          `Error batch upserting skaters for game ${gameIdentifier} (Code: ${batchError.code}):`,
          batchError
        );
        if (skaters.length > 0) {
          console.error(
            "Sample failed skater data (batch):",
            JSON.stringify(skaters[0])
          );
        }
        // Decide if this failure should stop the entire game update
        throw new Error(
          `Failed to batch upsert skaters: ${batchError.message}`
        );
      }
    }
  } else {
    console.log(`No skaters to upsert for game ${gameIdentifier}.`);
  }

  ///////////////// Goalies Upsert (with fallback) ///////////////
  if (goalies && goalies.length > 0) {
    console.log(
      `Attempting batch upsert for ${goalies.length} goalies for game ${gameIdentifier}...`
    );
    try {
      const { error: goalieBatchError } = await supabase
        .from("goaliesGameStats")
        .upsert(goalies);
      if (goalieBatchError) throw goalieBatchError;
      console.log(
        `Successfully batch upserted ${goalies.length} goalies for game ${gameIdentifier}.`
      );
    } catch (batchError: any) {
      if (batchError.code === "23503") {
        // Foreign Key Violation
        console.warn(
          `Batch goalie upsert failed (FK violation '23503') for game ${gameIdentifier}. Falling back to individual upserts with player updates...`
        );
        await upsertPlayersIndividually(
          supabase,
          goalies,
          "goalies",
          gameIdentifier
        );
      } else {
        console.error(
          `Error batch upserting goalies for game ${gameIdentifier} (Code: ${batchError.code}):`,
          batchError
        );
        if (goalies.length > 0) {
          console.error(
            "Sample failed goalie data (batch):",
            JSON.stringify(goalies[0])
          );
        }
        // Decide if this failure should stop the entire game update
        throw new Error(
          `Failed to batch upsert goalies: ${batchError.message}`
        );
      }
    }
  } else {
    console.log(`No goalies to upsert for game ${gameIdentifier}.`);
  }

  console.log(`Finished updateStats execution for gameId: ${gameIdentifier}`);
  // Optional: Add/Update a timestamp in the 'games' table to mark successful update
  // await supabase.from('games').update({ stats_updated_at: new Date().toISOString() }).eq('id', gameIdentifier);
}

// Helper for individual upserts on batch FK failure
async function upsertPlayersIndividually(
  supabase: SupabaseClient,
  players: (Skater | Goalie)[],
  playerType: "skaters" | "goalies",
  gameId: number
) {
  let individualSuccess = 0;
  let individualFailed = 0;
  const tableName = `${playerType}GameStats`;
  console.log(
    `Starting individual fallback upserts for ${players.length} ${playerType} in game ${gameId}...`
  );

  for (const player of players) {
    if (!player?.playerId || !player?.gameId) {
      console.warn(
        `Skipping update for invalid ${playerType} object in fallback:`,
        player
      );
      individualFailed++;
      continue;
    }
    try {
      await supabase.from(tableName).upsert(player).throwOnError();
      individualSuccess++;
    } catch (individualError: any) {
      if (individualError.code === "23503") {
        console.warn(
          `Individual ${playerType} FK violation for ${player.playerId}, game ${gameId}. Attempting player update...`
        );
        try {
          await updatePlayer(player.playerId, supabase); // Attempt to add player to 'players' table
          console.log(
            `Retrying individual upsert for ${playerType} ${player.playerId}, game ${gameId}...`
          );
          await supabase.from(tableName).upsert(player).throwOnError(); // Retry upsert
          individualSuccess++;
        } catch (retryError: any) {
          console.error(
            `Failed individual retry for ${playerType} ${player.playerId}, game ${gameId} after player update attempt:`,
            retryError
          );
          individualFailed++;
        }
      } else {
        console.error(
          `Error during individual ${playerType} upsert fallback for ${player.playerId}, game ${gameId}:`,
          individualError
        );
        console.error("Fallback Player data:", JSON.stringify(player));
        individualFailed++;
      }
    }
  }
  console.log(
    `Finished individual fallback for ${playerType} in game ${gameId}. Success: ${individualSuccess}, Failed: ${individualFailed}.`
  );
  // Decide if individual failures should cause the overall game update to fail
  // if (individualFailed > 0) {
  //    throw new Error(`Failed to upsert ${individualFailed} ${playerType} individually.`);
  // }
}

///////////////// Helper Functions //////////////////////////////

async function processTeamGameStats(
  gameId: number,
  teamGameStats: TeamGameStat[],
  isHomeTeam: boolean,
  landing: any,
  season: string,
  rightRail: any
) {
  const getStat = (category: Category): string | number | undefined => {
    const statObj = teamGameStats.find((stat) => stat.category === category);
    return statObj
      ? isHomeTeam
        ? statObj.homeValue
        : statObj.awayValue
      : undefined;
  };

  const team = isHomeTeam ? landing?.homeTeam : landing?.awayTeam;
  if (
    !team ||
    typeof team.id === "undefined" ||
    typeof team.score === "undefined"
  ) {
    // Log specific missing fields if possible
    console.error(
      `Invalid team data in landing object for game ${gameId}. Home=${isHomeTeam}. Data:`,
      JSON.stringify(team)
    );
    throw new Error(
      `Invalid team data (missing id or score) in landing object for game ${gameId}. Home=${isHomeTeam}`
    );
  }

  const powerPlayData = getStat("powerPlay")?.toString() || "0/0";
  const powerPlayConversionData = getStat("powerPlayPctg")?.toString() || "0.0";

  let powerPlayToi = "00:00";
  const teamKey = isHomeTeam ? "homeTeam" : "awayTeam";
  if (rightRail?.[teamKey]?.powerPlayToi) {
    powerPlayToi = rightRail[teamKey].powerPlayToi;
  } else {
    console.warn(
      `PP TOI not found directly in rightRail for ${teamKey}, game ${gameId}. Trying HTML fallback.`
    );
    try {
      powerPlayToi = await getPPTOI(season, gameId.toString(), isHomeTeam);
    } catch (e: any) {
      console.error(
        `Failed to fetch/parse PP TOI from HTML for ${teamKey}, game ${gameId}. Defaulting to "00:00". Error: ${e.message}`
      );
      // Do not throw here, default is acceptable
    }
  }

  // Ensure numeric conversions handle potential errors or NaN
  const safeNumber = (val: any, defaultVal: number = 0): number => {
    const num = Number(val);
    return isNaN(num) ? defaultVal : num;
  };

  return {
    gameId: gameId,
    teamId: team.id,
    score: team.score,
    sog: safeNumber(getStat("sog")),
    faceoffPctg: safeNumber(getStat("faceoffWinningPctg")),
    pim: safeNumber(getStat("pim")),
    hits: safeNumber(getStat("hits")),
    blockedShots: safeNumber(getStat("blockedShots")),
    giveaways: safeNumber(getStat("giveaways")),
    takeaways: safeNumber(getStat("takeaways")),
    powerPlay: powerPlayData,
    powerPlayConversion: powerPlayConversionData,
    powerPlayToi: powerPlayToi // Keep as string "MM:SS"
    // Add updated_at timestamp if  table has it
    // updated_at: new Date().toISOString(),
  };
}

async function getPPTOI(
  season: string,
  gameIdString: string,
  isHome: boolean
): Promise<string> {
  const slicedGameId = gameIdString.slice(4);
  if (!slicedGameId || slicedGameId.length !== 6) {
    console.error(`Invalid gameId format for HTML report: ${gameIdString}`);
    return "00:00";
  }

  let content = "";
  try {
    content = await getReportContent(season, slicedGameId);
    if (!content) {
      console.error(`HTML report content empty for game ${gameIdString}.`);
      return "00:00";
    }
  } catch (fetchError) {
    console.error(
      `Failed to fetch HTML report for game ${gameIdString}:`,
      fetchError
    );
    return "00:00";
  }

  let document;
  try {
    document = parse(content);
  } catch (parseError) {
    console.error(
      `Failed to parse HTML report for game ${gameIdString}:`,
      parseError
    );
    return "00:00";
  }

  const rows = document.querySelectorAll(
    "#PenaltySummary tr.oddColor, #PenaltySummary tr.evenColor"
  );

  const PPTOIs: string[] = [];
  for (const row of rows) {
    const rowText = row.textContent || "";
    if (rowText.includes("Power Plays (Goals-Opp./PPTime)")) {
      const cells = getChildren(row);
      if (cells.length > 1) {
        const timeText = cells[1].textContent?.split("/").pop()?.trim();
        if (timeText && /^\d{1,2}:\d{2}$/.test(timeText)) {
          PPTOIs.push(timeText);
        } else {
          console.warn(
            `Could not parse valid PPTOI time from '${cells[1].textContent}' in game ${gameIdString}`
          );
        }
      } else {
        console.warn(
          `Found PPTOI row but unexpected cell structure in game ${gameIdString}`
        );
      }
    }
  }

  if (PPTOIs.length !== 2) {
    console.error(
      `Expected 2 PPTOIs from HTML report, found ${PPTOIs.length} for game ${gameIdString}.`
    );
    return "00:00";
  }

  return PPTOIs[isHome ? 1 : 0];
}

function getChildren(node: HTMLElement): HTMLElement[] {
  return node.childNodes.filter(
    (n): n is HTMLElement => n instanceof HTMLElement && n.nodeType === 1 // Ensure it's an Element node
  );
}

// Updated URL format for HTML reports
const getReportContent = (
  reportSeasonYear: string, // e.g., "2024"
  gameIdSuffix: string // e.g., "020001"
): Promise<string> => {
  // Example URL: https://www.nhl.com/scores/htmlreports/20232024/GS020001.HTM
  // Use the *full* season string (YYYYYYYY) for the folder name
  const fullSeasonString = `${reportSeasonYear}${
    parseInt(reportSeasonYear, 10) + 1
  }`;
  const reportUrl = `https://www.nhl.com/scores/htmlreports/${fullSeasonString}/GS${gameIdSuffix}.HTM`;
  console.log(`Workspaceing HTML Report: ${reportUrl}`);
  try {
    return fetchWithCache(reportUrl, false); // Set cache to false if stats should always be fresh
  } catch (error) {
    console.error(`Error initiating fetchWithCache for ${reportUrl}:`, error);
    return Promise.resolve(""); // Return empty string on error to prevent downstream crashes
  }
};

function getPlayersGameStats(
  boxscore: any,
  gameId: number,
  powerPlayAssistsCount: PlayerCounts,
  shorthandedGoalsCount: PlayerCounts,
  shorthandedAssistsCount: PlayerCounts
): {
  skaters: Skater[];
  goalies: Goalie[];
} {
  const homeTeamStats: ApiPlayerGameStatsData | undefined =
    boxscore?.playerByGameStats?.homeTeam;
  const awayTeamStats: ApiPlayerGameStatsData | undefined =
    boxscore?.playerByGameStats?.awayTeam;

  const apiSkaters: (ApiForwardData | ApiDefenseData)[] = [
    ...(homeTeamStats?.forwards || []),
    ...(awayTeamStats?.forwards || []),
    ...(homeTeamStats?.defense || []),
    ...(awayTeamStats?.defense || [])
  ];

  if (apiSkaters.length === 0) {
    console.warn(
      `No skater data found in boxscore.playerByGameStats for game ${gameId}.`
    );
    // throw new Error(`No skater data found for game ${gameId}`);
  }

  const skaters: Skater[] = apiSkaters
    .map((player) => {
      const pId = player.playerId;
      const ppg = player.powerPlayGoals ?? 0;
      const ppa = powerPlayAssistsCount[pId] ?? 0;
      const shg = shorthandedGoalsCount[pId] ?? 0;
      const sha = shorthandedAssistsCount[pId] ?? 0;

      // Explicitly handle Forward vs Defense specific fields if needed,
      const skaterData: Skater = {
        playerId: pId,
        gameId: gameId,
        position: player.position, // C, L, R, or D
        goals: player.goals ?? 0,
        assists: player.assists ?? 0,
        points: player.points ?? 0,
        plusMinus: player.plusMinus ?? 0,
        pim: player.pim ?? 0,
        hits: player.hits ?? 0,
        blockedShots: player.blockedShots ?? 0,
        powerPlayGoals: ppg,
        shots: player.sog ?? 0, // Map sog to shots
        faceoffWinningPctg: player.faceoffWinningPctg ?? 0,
        toi: player.toi || "00:00",

        // Calculated values
        powerPlayPoints: ppg + ppa,
        shorthandedGoals: shg,
        shPoints: shg + sha,

        // Defaults - Consider if these can be fetched from elsewhere (PBP data)
        faceoffs: "0/0",
        powerPlayToi: "00:00",
        shorthandedToi: "00:00"

        // Add updated_at timestamp if table has it
        // updated_at: new Date().toISOString(),
      };
      return skaterData;
    })
    .filter((player) => player.playerId); // Filter out any potential invalid entries

  const apiGoalies: ApiGoalieData[] = [
    ...(homeTeamStats?.goalies || []),
    ...(awayTeamStats?.goalies || [])
  ];

  if (apiGoalies.length === 0) {
    console.warn(
      `No goalie data found in boxscore.playerByGameStats for game ${gameId}.`
    );
    // Depending on requirements, decide if this is an error or just a warning
    // throw new Error(`No goalie data found for game ${gameId}`);
  }

  const goalies: Goalie[] = apiGoalies
    .map((player) => {
      if (!player.playerId) {
        console.warn(
          `Skipping goalie entry due to missing playerId in game ${gameId}`,
          player
        );
        return null; // Return null to filter out later
      }

      const goalieData: Goalie = {
        playerId: player.playerId,
        gameId: gameId,
        position: "G", // Always 'G' for goalies
        saveShotsAgainst: player.saveShotsAgainst || "0-0",
        pim: player.pim ?? 0,
        goalsAgainst: player.goalsAgainst ?? 0,
        toi: player.toi || "00:00",
        savePctg: player.savePctg ?? 0.0,
        // Optional fields - pass through if they exist, otherwise undefined
        evenStrengthShotsAgainst: player.evenStrengthShotsAgainst,
        powerPlayShotsAgainst: player.powerPlayShotsAgainst,
        shorthandedShotsAgainst: player.shorthandedShotsAgainst,
        evenStrengthGoalsAgainst: player.evenStrengthGoalsAgainst,
        powerPlayGoalsAgainst: player.powerPlayGoalsAgainst,
        shorthandedGoalsAgainst: player.shorthandedGoalsAgainst

        // Add updated_at timestamp if your table has it
        // updated_at: new Date().toISOString(),
      };
      return goalieData;
    })
    .filter((g): g is Goalie => g !== null); // Filter out any null entries from validation

  console.log(
    `Extracted ${skaters.length} skaters and ${goalies.length} goalies for game ${gameId}.`
  );
  return {
    skaters,
    goalies
  };
}
