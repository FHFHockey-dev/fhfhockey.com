// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\api\v1\db\update-stats\[gameId].ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { SupabaseClient } from "@supabase/supabase-js";
import { HTMLElement, parse } from "node-html-parser";
import { get } from "lib/NHL/base"; // Assuming 'get' fetches and parses JSON
import adminOnly from "utils/adminOnlyMiddleware";
import { updatePlayer } from "../update-player/[playerId]"; // Assuming this function exists and works
import fetchWithCache from "lib/fetchWithCache"; // Assuming this function exists and works

// --- Type Definitions ---

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

// --- Internal/Database Types ---

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
  shorthandedGoals: number; // Calculated: SHG
  shPoints: number; // Calculated: SHG + SHA
  shots: number; // Database field name, mapped from API 'sog'
  faceoffs: string; // Requires PBP data (e.g., "W/L") - Defaulted
  faceoffWinningPctg: number;
  toi: string;
  powerPlayToi: string; // Requires PBP/HTML data - Defaulted
  shorthandedToi: string; // Requires PBP/HTML data - Defaulted
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
  shorthandedGoals: number; // Calculated: SHG
  shPoints: number; // Calculated: SHG + SHA
  shots: number; // Database field name, mapped from API 'sog'
  faceoffs: string; // Requires PBP data (usually "0/0") - Defaulted
  faceoffWinningPctg: number;
  toi: string;
  powerPlayToi: string; // Requires PBP/HTML data - Defaulted
  shorthandedToi: string; // Requires PBP/HTML data - Defaulted
};

type Goalie = {
  playerId: number;
  gameId: number;
  position: "G";
  evenStrengthShotsAgainst?: string; // Make optional if not always present
  powerPlayShotsAgainst?: string;
  shorthandedShotsAgainst?: string;
  saveShotsAgainst: string; // Typically "Saves-ShotsAgainst" format
  savePctg?: number; // Made optional, handle undefined below
  evenStrengthGoalsAgainst?: number;
  powerPlayGoalsAgainst?: number;
  shorthandedGoalsAgainst?: number;
  pim: number;
  goalsAgainst: number;
  toi: string;
};

// Union type for internal skater data structure
type Skater = Forward | Defense;

// --- NHL API Structure Types ---

// Player stats structure from playerByGameStats
type ApiForwardData = {
  playerId: number;
  sweaterNumber: number;
  name: { default: string };
  position: "C" | "L" | "R";
  goals: number;
  assists: number; // Total assists
  points: number; // Total points
  plusMinus: number;
  pim: number;
  hits: number;
  powerPlayGoals: number; // Specific PPG count
  sog: number; // API uses 'sog'
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
  assists: number; // Total assists
  points: number; // Total points
  plusMinus: number;
  pim: number;
  hits: number;
  powerPlayGoals: number; // Specific PPG count
  sog: number; // API uses 'sog'
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

// Type for the player stats structure within boxscore API response
type ApiPlayerGameStatsData = {
  forwards: ApiForwardData[];
  defense: ApiDefenseData[];
  goalies: ApiGoalieData[];
};

// --- Utility/Parameter Types ---

type BaseType = {
  supabase: SupabaseClient;
};

// Define a simple type for the player counts maps used for PPP/SHP calculation
type PlayerCounts = { [playerId: number]: number };

// --- API Route Logic ---

export default withCronJobAudit(adminOnly(async (req, res) => {
  const { supabase } = req;
  const gameId = Number(req.query.gameId);

  // Corrected NaN check
  if (isNaN(gameId) || gameId <= 0) {
    return res.status(400).json({
      message: "gameId is required and must be a positive number",
      success: false
    });
  }

  try {
    await updateStats(gameId, supabase);
    return res.json({
      gameId,
      message: `Successfully updated stats for game ${gameId}`,
      success: true
    });
  } catch (e: any) {
    console.error(`Error in route handler for game ${gameId}:`, e);
    const errorMessage = e.message || "An unknown error occurred.";
    return res.status(400).json({
      message: `Failed to update stats for game ${gameId}. ${errorMessage}`,
      success: false
    });
  }
}));

// --- Core Stat Update Logic ---

export const isGameFinished = (state: GameState) =>
  (["OFF", "FINAL"] as GameState[]).includes(state);

export async function updateStats(gameId: number, supabase: SupabaseClient) {
  console.log(`Starting updateStats for gameId: ${gameId}`);

  // Fetch landing data - This often contains the summary.scoring needed
  const landing = await get(`/gamecenter/${gameId}/landing`);
  // Consider adding validation for the landing object structure

  const gameState: GameState = landing?.gameState;
  const season: number | undefined = landing?.season;
  const gameIdentifier: number = landing?.id;

  // Validate essential data from landing
  if (!gameState || !season || !gameIdentifier) {
    throw new Error(
      `Essential game data (gameState, season, id) missing from landing endpoint for game ${gameId}`
    );
  }
  if (gameIdentifier !== gameId) {
    console.warn(
      `Mismatch between requested gameId (${gameId}) and landing data gameId (${gameIdentifier}). Using landing data ID.`
    );
  }

  console.log(`Game ${gameIdentifier}: State=${gameState}, Season=${season}`);

  if (!isGameFinished(gameState)) {
    throw new Error(
      `Game ${gameIdentifier} is not finished. gameState: ${gameState}`
    );
  }

  // Fetch teamGameStats from /right-rail
  const rightRail = await get(`/gamecenter/${gameIdentifier}/right-rail`);
  // Consider adding validation for the rightRail object structure

  const teamGameStats: TeamGameStat[] = rightRail?.teamGameStats;
  if (!teamGameStats || !Array.isArray(teamGameStats)) {
    console.warn(
      `teamGameStats missing or invalid in right-rail for game ${gameIdentifier}. Skipping team stats update.`
    );
  } else {
    console.log(`Processing teamGameStats for game ${gameIdentifier}...`);
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
  }

  // Fetch boxscore - needed for playerByGameStats
  // (Verify if landing endpoint also contains playerByGameStats reliably)
  console.log(
    `Workspaceing boxscore for game ${gameIdentifier} (needed for playerByGameStats)...`
  );
  const boxscore = await get(`/gamecenter/${gameIdentifier}/boxscore`);
  // Add validation for boxscore if needed

  // *** Process Scoring Summary for PPA, SHG, SHA using LANDING data ***
  const powerPlayAssistsCount: PlayerCounts = {};
  const shorthandedGoalsCount: PlayerCounts = {};
  const shorthandedAssistsCount: PlayerCounts = {};

  // Safely access nested data FROM THE 'landing' OBJECT
  const scoringPeriods = landing?.summary?.scoring; // <--- CHANGE: Read from landing
  if (scoringPeriods && Array.isArray(scoringPeriods)) {
    console.log(
      `Processing scoring summary from LANDING data for game ${gameIdentifier}...`
    ); // Updated log
    for (const period of scoringPeriods) {
      const goalsInPeriod = period?.goals;
      if (goalsInPeriod && Array.isArray(goalsInPeriod)) {
        for (const goal of goalsInPeriod) {
          const strength = goal?.strength?.toLowerCase();
          const scorerId = goal?.playerId;
          const assists = goal?.assists;

          if (!scorerId) continue; // Skip if goal has no scorer ID

          // Count Power Play Assists
          if (strength === "pp" && Array.isArray(assists)) {
            for (const assist of assists) {
              if (assist?.playerId) {
                powerPlayAssistsCount[assist.playerId] =
                  (powerPlayAssistsCount[assist.playerId] || 0) + 1;
              }
            }
          }
          // Count Shorthanded Goals and Assists (confirm 'sh' is correct strength code if used)
          else if (strength === "sh") {
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
        } // end goals loop
      }
    } // end periods loop
    console.log(
      `Finished processing scoring summary for game ${gameIdentifier}.`
    );
  } else {
    // This warning now means LANDING data didn't have summary.scoring
    console.warn(
      `Scoring summary not found or invalid in LANDING data for game ${gameIdentifier}. PPP/SHP calculations may be incomplete.`
    );
  }

  // Log the counts derived from landing data
  console.log(`Counts for game ${gameIdentifier}:`);
  console.log("PPA Counts:", JSON.stringify(powerPlayAssistsCount));
  console.log("SHG Counts:", JSON.stringify(shorthandedGoalsCount));
  console.log("SHA Counts:", JSON.stringify(shorthandedAssistsCount));

  // Extract player stats using BOXSCORE data (which contains playerByGameStats)
  console.log(
    `Extracting player stats using BOXSCORE data for game ${gameIdentifier}...`
  );
  const { skaters, goalies } = getPlayersGameStats(
    boxscore, // Pass boxscore object
    gameIdentifier, // Pass gameId
    powerPlayAssistsCount, // Pass counts derived from landing
    shorthandedGoalsCount,
    shorthandedAssistsCount
  );

  // Batch upsert player stats
  console.log(
    `Upserting player stats for game ${gameIdentifier} in batches...`
  );

  // Skaters
  if (skaters && skaters.length > 0) {
    console.log(
      `Attempting batch upsert for ${skaters.length} skaters for game ${gameIdentifier}...`
    );
    try {
      // Attempt efficient batch upsert first
      const { error: skaterBatchError } = await supabase
        .from("skatersGameStats")
        .upsert(skaters);
      if (skaterBatchError) throw skaterBatchError; // Throw error to be caught below
      console.log(`Successfully batch upserted ${skaters.length} skaters.`);
    } catch (batchError: any) {
      // Check if the batch failed specifically due to a foreign key violation
      if (batchError.code === "23503") {
        console.warn(
          `Batch skater upsert failed (FK violation '23503') for game ${gameIdentifier}. Falling back to individual upserts...`
        );

        // Fallback: Iterate and upsert individually with the original retry logic
        for (const player of skaters) {
          if (!player?.playerId || !player?.gameId) {
            console.warn(
              `Skipping update for invalid player object in fallback:`,
              player
            );
            continue;
          }
          const playerType = "skaters"; // Define playerType for logging/table name
          try {
            // Attempt individual upsert
            await supabase
              .from(`${playerType}GameStats`)
              .upsert(player)
              .throwOnError();
          } catch (individualError: any) {
            // Check for FK violation on individual attempt
            if (individualError.code === "23503") {
              console.warn(
                `Individual skater FK violation for ${player.playerId}, game ${gameId}. Attempting player update...`
              );
              try {
                // Attempt to add/update player in the parent 'players' table
                await updatePlayer(player.playerId, supabase);
                console.log(
                  `Retrying individual upsert for skater ${player.playerId}, game ${gameId}...`
                );
                // Retry the individual upsert
                await supabase
                  .from(`${playerType}GameStats`)
                  .upsert(player)
                  .throwOnError();
              } catch (retryError: any) {
                // Log failure even after retry
                console.error(
                  `Failed individual retry for skater ${player.playerId}, game ${gameId} after player update attempt:`,
                  retryError
                );
              }
            } else {
              // Log other errors during individual fallback upsert
              console.error(
                `Error during individual skater upsert fallback for ${player.playerId}, game ${gameId}:`,
                individualError
              );
              console.error("Fallback Player data:", JSON.stringify(player));
            }
          }
        } // End individual fallback loop
        console.log(
          `Finished individual fallback upserts for skaters in game ${gameIdentifier}.`
        );
      } else {
        // Log other types of batch errors (timeouts, constraint violations, etc.)
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
      }
    } // End Catch Block for batch skaters
  } else {
    console.log(`No skaters to upsert for game ${gameIdentifier}.`);
  }

  // Goalies
  // --- Goalies ---
  if (goalies && goalies.length > 0) {
    console.log(
      `Attempting batch upsert for ${goalies.length} goalies for game ${gameIdentifier}...`
    );
    try {
      // Attempt efficient batch upsert first
      const { error: goalieBatchError } = await supabase
        .from("goaliesGameStats")
        .upsert(goalies);
      if (goalieBatchError) throw goalieBatchError;
      console.log(`Successfully batch upserted ${goalies.length} goalies.`);
    } catch (batchError: any) {
      // Check if the batch failed specifically due to a foreign key violation
      if (batchError.code === "23503") {
        console.warn(
          `Batch goalie upsert failed (FK violation '23503') for game ${gameIdentifier}. Falling back to individual upserts...`
        );

        // Fallback: Iterate and upsert individually with the original retry logic
        for (const player of goalies) {
          if (!player?.playerId || !player?.gameId) {
            console.warn(
              `Skipping update for invalid goalie object in fallback:`,
              player
            );
            continue;
          }
          const playerType = "goalies"; // Define playerType
          try {
            // Attempt individual upsert
            await supabase
              .from(`${playerType}GameStats`)
              .upsert(player)
              .throwOnError();
          } catch (individualError: any) {
            // Check for FK violation on individual attempt
            if (individualError.code === "23503") {
              console.warn(
                `Individual goalie FK violation for ${player.playerId}, game ${gameId}. Attempting player update...`
              );
              try {
                // Attempt to add/update player in the parent 'players' table
                await updatePlayer(player.playerId, supabase);
                console.log(
                  `Retrying individual upsert for goalie ${player.playerId}, game ${gameId}...`
                );
                // Retry the individual upsert
                await supabase
                  .from(`${playerType}GameStats`)
                  .upsert(player)
                  .throwOnError();
              } catch (retryError: any) {
                // Log failure even after retry
                console.error(
                  `Failed individual retry for goalie ${player.playerId}, game ${gameId} after player update attempt:`,
                  retryError
                );
              }
            } else {
              // Log other errors during individual fallback upsert
              console.error(
                `Error during individual goalie upsert fallback for ${player.playerId}, game ${gameId}:`,
                individualError
              );
              console.error("Fallback Goalie data:", JSON.stringify(player));
            }
          }
        } // End individual goalie fallback loop
        console.log(
          `Finished individual fallback upserts for goalies in game ${gameIdentifier}.`
        );
      } else {
        // Log other types of batch errors for goalies
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
      }
    } // End Catch Block for batch goalies
  } else {
    console.log(`No goalies to upsert for game ${gameIdentifier}.`);
  }

  console.log(`Finished updateStats execution for gameId: ${gameIdentifier}`);
}

// --- Helper Functions ---

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
    throw new Error(
      `Invalid team data in landing object for game ${gameId}. Home=${isHomeTeam}`
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
    }
  }

  return {
    gameId: gameId,
    teamId: team.id,
    score: team.score,
    sog: Number(getStat("sog") || 0),
    faceoffPctg: Number(getStat("faceoffWinningPctg") || 0),
    pim: Number(getStat("pim") || 0),
    hits: Number(getStat("hits") || 0),
    blockedShots: Number(getStat("blockedShots") || 0),
    giveaways: Number(getStat("giveaways") || 0),
    takeaways: Number(getStat("takeaways") || 0),
    powerPlay: powerPlayData,
    powerPlayConversion: powerPlayConversionData,
    powerPlayToi: powerPlayToi
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
    (n) => n instanceof HTMLElement
  ) as HTMLElement[];
}

const getReportContent = (
  season: string,
  gameIdSuffix: string
): Promise<string> => {
  const reportUrl = `https://www.nhl.com/scores/htmlreports/${season}/GS${gameIdSuffix}.HTM`;
  console.log(`Workspaceing HTML Report: ${reportUrl}`); // Corrected log typo
  try {
    return fetchWithCache(reportUrl, false);
  } catch (error) {
    console.error(`Error during fetchWithCache for ${reportUrl}:`, error);
    return Promise.resolve(""); // Return empty string on error to prevent crashes
  }
};

function getPlayersGameStats(
  boxscore: any, // Contains playerByGameStats
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
  }

  const skaters: Skater[] = apiSkaters.map((player) => {
    const pId = player.playerId;
    const ppg = player.powerPlayGoals ?? 0;
    const ppa = powerPlayAssistsCount[pId] ?? 0; // Use counts derived from landing data
    const shg = shorthandedGoalsCount[pId] ?? 0; // Use counts derived from landing data
    const sha = shorthandedAssistsCount[pId] ?? 0; // Use counts derived from landing data

    const skaterData: Skater = {
      playerId: pId,
      gameId: gameId,
      position: player.position,
      goals: player.goals ?? 0,
      assists: player.assists ?? 0, // Total assists from player stats
      points: player.points ?? 0, // Total points from player stats
      plusMinus: player.plusMinus ?? 0,
      pim: player.pim ?? 0,
      hits: player.hits ?? 0,
      blockedShots: player.blockedShots ?? 0,
      powerPlayGoals: ppg, // PPG from player stats
      shots: player.sog ?? 0, // Map sog to shots
      faceoffWinningPctg: player.faceoffWinningPctg ?? 0,
      toi: player.toi || "00:00",

      // Calculated values using counts from landing data
      powerPlayPoints: ppg + ppa,
      shorthandedGoals: shg,
      shPoints: shg + sha,

      // Defaults for stats needing other data sources
      faceoffs: "0/0",
      powerPlayToi: "00:00",
      shorthandedToi: "00:00"
    };
    return skaterData;
  });

  const apiGoalies: ApiGoalieData[] = [
    ...(homeTeamStats?.goalies || []),
    ...(awayTeamStats?.goalies || [])
  ];

  if (apiGoalies.length === 0) {
    console.warn(
      `No goalie data found in boxscore.playerByGameStats for game ${gameId}.`
    );
  }

  const goalies: Goalie[] = apiGoalies.map((player) => {
    const goalieData: Goalie = {
      playerId: player.playerId,
      gameId: gameId,
      position: player.position,
      saveShotsAgainst: player.saveShotsAgainst || "0-0",
      pim: player.pim ?? 0,
      goalsAgainst: player.goalsAgainst ?? 0,
      toi: player.toi || "00:00",
      savePctg: player.savePctg ?? 0,
      evenStrengthShotsAgainst: player.evenStrengthShotsAgainst,
      powerPlayShotsAgainst: player.powerPlayShotsAgainst,
      shorthandedShotsAgainst: player.shorthandedShotsAgainst,
      evenStrengthGoalsAgainst: player.evenStrengthGoalsAgainst,
      powerPlayGoalsAgainst: player.powerPlayGoalsAgainst,
      shorthandedGoalsAgainst: player.shorthandedGoalsAgainst
    };
    return goalieData;
  });

  console.log(
    `Extracted ${skaters.length} skaters and ${goalies.length} goalies for game ${gameId}.`
  );
  return {
    skaters,
    goalies
  };
}

// Removed the old updateGameStats helper function as batch upserts are now inline
