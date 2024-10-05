// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\api\v1\db\update-stats\[gameId].ts

import { SupabaseClient } from "@supabase/supabase-js";
import { parse } from "node-html-parser";
import { get } from "lib/NHL/base";
import adminOnly from "utils/adminOnlyMiddleware";
import { updatePlayer } from "../update-player/[playerId]";
import fetchWithCache from "lib/fetchWithCache";

// Type Definitions
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
  position: "C" | "L" | "R"; // Forward positions
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  blockedShots: number;
  powerPlayGoals: number;
  powerPlayPoints: number;
  shorthandedGoals: number;
  shPoints: number;
  shots: number;
  faceoffs: string;
  faceoffWinningPctg: number;
  toi: string;
  powerPlayToi: string;
  shorthandedToi: string;
};

type Defense = {
  playerId: number;
  position: "D"; // Defense position
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  blockedShots: number;
  powerPlayGoals: number;
  powerPlayPoints: number;
  shorthandedGoals: number;
  shPoints: number;
  shots: number;
  faceoffs: string;
  faceoffWinningPctg: number;
  toi: string;
  powerPlayToi: string;
  shorthandedToi: string;
};

type Goalie = {
  playerId: number;
  position: "G"; // Goalie position
  evenStrengthShotsAgainst: string;
  powerPlayShotsAgainst: string;
  shorthandedShotsAgainst: string;
  saveShotsAgainst: string;
  savePctg: number;
  evenStrengthGoalsAgainst: number;
  powerPlayGoalsAgainst: number;
  shorthandedGoalsAgainst: number;
  pim: number;
  goalsAgainst: number;
  toi: string;
};

type Skater = Forward | Defense; // Union type for skaters

type PlayerGameStats = {
  forwards: Forward[];
  defense: Defense[];
  goalies: Goalie[];
};

type BaseType = {
  supabase: SupabaseClient;
};

type UpdateGameStatsParams =
  | (BaseType & { playerType: "skaters"; players: Skater[] })
  | (BaseType & { playerType: "goalies"; players: Goalie[] });

// Middleware to protect the API route
export default adminOnly(async (req, res) => {
  const { supabase } = req;
  const gameId = Number(req.query.gameId);

  // Corrected NaN check
  if (isNaN(gameId)) {
    return res.status(400).json({
      message: "gameId is required and must be a number",
      success: false,
    });
  }

  try {
    await updateStats(gameId, supabase);
    return res.json({
      gameId,
      message: "Successfully updated the stats for game with id " + gameId,
      success: true,
    });
  } catch (e: any) {
    console.error(e);
    return res.status(400).json({
      message: `Failed to update stats for game ${gameId}. ${e.message}`,
      success: false,
    });
  }
});

// Helper to check if the game has finished
export const isGameFinished = (state: GameState) =>
  (["OFF", "FINAL"] as GameState[]).includes(state);

// Main function to update stats
export async function updateStats(gameId: number, supabase: SupabaseClient) {
  // Fetch landing data
  const landing = await get(`/gamecenter/${gameId}/landing`);
  console.log("Landing Data:", JSON.stringify(landing, null, 2));

  // Extract game state, season, and id
  const gameState: GameState = landing.gameState;
  const season: number = landing.season; // e.g., 20242025
  const gameIdentifier: number = landing.id;

  if (!isGameFinished(gameState)) {
    throw new Error("The gameState for the game is " + gameState);
  }

  // Fetch teamGameStats from /right-rail
  const rightRail = await get(`/gamecenter/${gameId}/right-rail`);
  console.log("Right-Rail Data:", JSON.stringify(rightRail, null, 2));

  const teamGameStats: TeamGameStat[] = rightRail.teamGameStats;
  if (!teamGameStats || !Array.isArray(teamGameStats)) {
    throw new Error(
      "teamGameStats is missing or invalid in the right-rail data"
    );
  }

  console.log("Processing teamGameStats...");

  // Process teamGameStats for home and away teams
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

  console.log(
    "Home Team Game Stats:",
    JSON.stringify(homeTeamGameStats, null, 2)
  );
  console.log(
    "Away Team Game Stats:",
    JSON.stringify(awayTeamGameStats, null, 2)
  );

  // Obtain powerPlayConversion from boxscore
  const boxscore = await get(`/gamecenter/${gameId}/boxscore`);
  console.log("Boxscore Data:", JSON.stringify(boxscore, null, 2));

  // Update teamGameStats table
  await supabase
    .from("teamGameStats")
    .upsert([homeTeamGameStats, awayTeamGameStats])
    .throwOnError();
  console.log("Successfully upserted team game stats for gameId:", gameId);

  // Extract player stats from boxscore
  const { skaters, goalies } = getPlayersGameStats(boxscore);
  console.log("Processed Skaters:", JSON.stringify(skaters, null, 2));
  console.log("Processed Goalies:", JSON.stringify(goalies, null, 2));

  // Update player stats in Supabase
  await Promise.all([
    updateGameStats({ playerType: "skaters", players: skaters, supabase }),
    updateGameStats({ playerType: "goalies", players: goalies, supabase }),
  ]);

  console.log("Successfully updated player stats for gameId:", gameId);
}

// Function to process teamGameStats for a specific team
async function processTeamGameStats(
  gameId: number,
  teamGameStats: TeamGameStat[],
  isHomeTeam: boolean,
  landing: any,
  season: string,
  rightRail: any
) {
  // Helper to extract specific stat
  const getStat = (category: Category): string | number | undefined => {
    const statObj = teamGameStats.find((stat) => stat.category === category);
    if (statObj) {
      return isHomeTeam ? statObj.homeValue : statObj.awayValue;
    }
    return undefined;
  };

  // Extract relevant stats
  const sog = Number(getStat("sog") || 0);
  const faceoffPctg = Number(getStat("faceoffWinningPctg") || 0);
  const pim = Number(getStat("pim") || 0);
  const hits = Number(getStat("hits") || 0);
  const blockedShots = Number(getStat("blockedShots") || 0);
  const giveaways = Number(getStat("giveaways") || 0);
  const takeaways = Number(getStat("takeaways") || 0);
  const powerPlay = getStat("powerPlay") || "0/0"; // Format: "Goals/Opportunities"
  const powerPlayConversion = getStat("powerPlayPctg") || "0/0"; // Format: "Goals/Opportunities"

  // Extract powerPlayToi from rightRail if available; else parse from HTML
  let powerPlayToi = "00:00"; // Default value
  if (isHomeTeam && rightRail.homeTeam && rightRail.homeTeam.powerPlayToi) {
    powerPlayToi = rightRail.homeTeam.powerPlayToi;
  } else if (
    !isHomeTeam &&
    rightRail.awayTeam &&
    rightRail.awayTeam.powerPlayToi
  ) {
    powerPlayToi = rightRail.awayTeam.powerPlayToi;
  } else {
    // Fallback: parse from HTML
    try {
      powerPlayToi = await getPPTOI(season, gameId.toString(), isHomeTeam);
    } catch (e) {
      console.warn(
        `Failed to fetch powerPlayToi for ${
          isHomeTeam ? "home" : "away"
        } team. Defaulting to "00:00".`
      );
    }
  }

  // Access team details from landing
  const team = isHomeTeam ? landing.homeTeam : landing.awayTeam;

  return {
    gameId: gameId,
    teamId: team.id,
    score: team.score,
    sog,
    faceoffPctg,
    pim,
    hits,
    blockedShots,
    giveaways,
    takeaways,
    powerPlay,
    powerPlayConversion,
    powerPlayToi,
  };
}

/**
 * Retrieve the PPTOI report as an HTML string.
 * @param season The season (e.g., "20242025")
 * @param gameId The game identifier as a string (e.g., "2024010028")
 * @param isHome Indicates if it's the home team
 * @returns team PPTOI in mm:ss format
 */
async function getPPTOI(
  season: string,
  gameId: string,
  isHome: boolean
): Promise<string> {
  // Slice the first four characters to get the game number
  const slicedGameId = gameId.slice(4); // "2024010028" -> "010028"
  const content = await getReportContent(season, slicedGameId);

  const document = parse(content);
  const table = document.querySelectorAll("#PenaltySummary td");

  const PPTOIs: string[] = [];
  for (const node of table) {
    if (node.textContent === "Power Plays (Goals-Opp./PPTime)") {
      // Navigate up to the appropriate row
      const parentRow = node.parentNode.parentNode.parentNode; // Adjusted to match old logic
      const cells = parentRow.querySelectorAll("td");
      if (cells.length >= 2) {
        // Ensure there are enough cells
        const value = cells[1].textContent.trim(); // Get the second cell
        PPTOIs.push(value.split("/")[1]); // Extract PPTOI
      }
    }
  }

  if (PPTOIs.length !== 2) {
    throw new Error("Failed to get team powerPlayToi for game: " + gameId);
  }

  return PPTOIs[isHome ? 1 : 0] as string;
}

/**
 * Retrieve the PPTOI report URL and fetch its content.
 * @param season The season (e.g., "20242025")
 * @param gameId The game identifier as a string (e.g., "010028")
 * @returns HTML content of the PPTOI report
 */
const getReportContent = (season: string, gameId: string) => {
  const PPTOI_REPORT_URL = `https://www.nhl.com/scores/htmlreports/${season}/GS${gameId}.HTM`;

  return fetchWithCache(PPTOI_REPORT_URL, false);
};

// Function to extract player stats from boxscore
function getPlayersGameStats(boxscore: any): {
  skaters: Skater[];
  goalies: Goalie[];
} {
  const gameId = boxscore.id || boxscore.gameId;

  // Adjust based on new boxscore structure
  const homeTeam: PlayerGameStats =
    boxscore.playerByGameStats?.homeTeam || boxscore.homeTeam?.playerStats;
  const awayTeam: PlayerGameStats =
    boxscore.playerByGameStats?.awayTeam || boxscore.awayTeam?.playerStats;

  if (!homeTeam || !awayTeam) {
    throw new Error("Missing player game stats for home or away team");
  }

  const skaters: Skater[] = [
    ...homeTeam.forwards,
    ...awayTeam.forwards,
    ...homeTeam.defense,
    ...awayTeam.defense,
  ].map((player) => ({
    playerId: player.playerId,
    gameId: gameId,
    position: player.position,
    goals: player.goals,
    assists: player.assists,
    points: player.points,
    plusMinus: player.plusMinus,
    pim: player.pim,
    hits: player.hits,
    blockedShots: player.blockedShots,
    powerPlayGoals: player.powerPlayGoals,
    powerPlayPoints: player.powerPlayPoints,
    shorthandedGoals: player.shorthandedGoals,
    shPoints: player.shPoints,
    shots: player.shots,
    faceoffs: player.faceoffs,
    faceoffWinningPctg: player.faceoffWinningPctg,
    toi: player.toi,
    powerPlayToi: player.powerPlayToi,
    shorthandedToi: player.shorthandedToi,
  }));

  const goalies: Goalie[] = [...homeTeam.goalies, ...awayTeam.goalies].map(
    (player) => ({
      playerId: player.playerId,
      gameId: gameId,
      position: player.position,
      evenStrengthShotsAgainst: player.evenStrengthShotsAgainst,
      powerPlayShotsAgainst: player.powerPlayShotsAgainst,
      shorthandedShotsAgainst: player.shorthandedShotsAgainst,
      saveShotsAgainst: player.saveShotsAgainst,
      evenStrengthGoalsAgainst: player.evenStrengthGoalsAgainst,
      powerPlayGoalsAgainst: player.powerPlayGoalsAgainst,
      shorthandedGoalsAgainst: player.shorthandedGoalsAgainst,
      pim: player.pim,
      goalsAgainst: player.goalsAgainst,
      toi: player.toi,
      savePctg: player.savePctg === undefined ? 0 : Number(player.savePctg),
    })
  );

  return {
    skaters,
    goalies,
  };
}

// Function to update player stats in Supabase
async function updateGameStats({
  playerType,
  players,
  supabase,
}: UpdateGameStatsParams) {
  const promises = players.map(async (player) => {
    if (!player) return;
    try {
      await supabase
        .from(`${playerType}GameStats`)
        .upsert(player)
        .throwOnError();
    } catch (error: any) {
      if (error.code === "23503") {
        console.log(`Attempting to update missing player ${player.playerId}`);
        await updatePlayer(player.playerId, supabase);
        await supabase
          .from(`${playerType}GameStats`)
          .upsert(player)
          .throwOnError();
      } else {
        console.error("Error updating player:", JSON.stringify(player));
        throw error;
      }
    }
  });

  await Promise.all(promises);
}
