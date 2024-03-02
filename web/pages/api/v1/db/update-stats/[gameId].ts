import { SupabaseClient } from "@supabase/supabase-js";
import { parse } from "node-html-parser";
import { get } from "lib/NHL/base";
import adminOnly from "utils/adminOnlyMiddleware";
import { updatePlayer } from "../update-player/[playerId]";
import fetchWithCache from "lib/fetchWithCache";

export default adminOnly(async (req, res) => {
  const { supabase } = req;
  const gameId = Number(req.query.gameId);
  if (gameId === Number.NaN) {
    return res.status(400).json({
      message: "gameId is required",
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

type GameState = "OFF" | "FINAL" | "FUT";
export const isGameFinished = (state: GameState) =>
  (["OFF", "FINAL"] as GameState[]).includes(state);
export async function updateStats(gameId: number, supabase: SupabaseClient) {
  const landing = await get(`/gamecenter/${gameId}/landing`);
  if (!isGameFinished(landing.gameState)) {
    throw new Error("The gameState for the game is " + landing.gameState);
  }
  const homeTeamGameStats = await getTeamStats(landing, true);
  const awayTeamGameStats = await getTeamStats(landing, false);

  // obtain powerPlayConversion
  const boxscore = await get(`/gamecenter/${gameId}/boxscore`);
  const homeTeamPowerPlayConversion = boxscore.homeTeam.powerPlayConversion;
  const awayTeamPowerPlayConversion = boxscore.awayTeam.powerPlayConversion;

  homeTeamGameStats.powerPlayConversion = homeTeamPowerPlayConversion;
  awayTeamGameStats.powerPlayConversion = awayTeamPowerPlayConversion;

  // update teamGameStats table
  await supabase
    .from("teamGameStats")
    .upsert([homeTeamGameStats, awayTeamGameStats])
    .throwOnError();
  const { skaters, goalies } = getPlayersGameStats(boxscore);

  await Promise.all([
    updateGameStats({ playerType: "skaters", players: skaters, supabase }),
    updateGameStats({ playerType: "goalies", players: goalies, supabase }),
  ]);
}

type Category =
  | "sog"
  | "faceoffPctg"
  | "powerPlay"
  | "pim"
  | "hits"
  | "blockedShots"
  | "giveaways"
  | "takeaways";

type TeamGameStat = {
  category: Category;
  awayValue: string;
  homeValue: string;
};

async function getTeamStats(landing: any, isHomeTeam: boolean) {
  const getStat = (key: Category) => {
    const stats: TeamGameStat[] = landing.summary.teamGameStats;
    return stats.find((stat) => stat.category === key)?.[
      isHomeTeam ? "homeValue" : "awayValue"
    ];
  };
  // get team power play time
  const powerPlayToi = await getPPTOI(
    landing.season,
    landing.id,
    isHomeTeam
  ).catch((e) => {
    console.error(e);
    return "00:00";
  });

  return {
    gameId: landing.id,
    teamId: isHomeTeam ? landing.homeTeam.id : landing.awayTeam.id,
    score: isHomeTeam ? landing.homeTeam.score : landing.awayTeam.score,
    sog: Number(getStat("sog")),
    faceoffPctg: Number(getStat("faceoffPctg")),
    pim: Number(getStat("pim")),
    hits: Number(getStat("hits")),
    blockedShots: Number(getStat("blockedShots")),
    giveaways: Number(getStat("giveaways")),
    takeaways: Number(getStat("takeaways")),
    powerPlay: getStat("powerPlay"),
    powerPlayConversion: "0/0", // will be populated later
    powerPlayToi,
  };
}

/**
 * Retrieve the PPTOI report as html string.
 * @param season The season
 * @param gameId The first two digits give the type of the game, the final 4 digits identify the specific game number.
 */
const getReportContent = (season: string, gameId: string) => {
  const PPTOI_REPORT_URL = `https://www.nhl.com/scores/htmlreports/${season}/GS${gameId}.HTM`;

  return fetchWithCache(PPTOI_REPORT_URL, false);
};

/**
 * Get the team PPTOI in mm:ss format
 * @param season
 * @param gameId
 * @param isHome
 * @returns team PPTOI
 */
async function getPPTOI(season: string, gameId: string, isHome: boolean) {
  gameId = gameId.toString().slice(4);
  const content = await getReportContent(season, gameId);

  const document = parse(content);
  const table = document.querySelectorAll("#PenaltySummary td");

  const PPTOIs = [];
  for (const node of table) {
    if (node.textContent === "Power Plays (Goals-Opp./PPTime)") {
      PPTOIs.push(
        [...node.parentNode.parentNode.parentNode.childNodes]
          .filter((n) => n.nodeType !== 3)
          .map((n) => n.rawText)[1]
          .split("/")[1]
      );
    }
  }
  if (PPTOIs.length !== 2)
    throw new Error("Failed to get team powerPlayToi for game: " + gameId);
  return PPTOIs[isHome ? 1 : 0] as string;
}

type Forward = {
  playerId: number;
  position: "C" | "L" | "R"; // Assuming these are the only positions for forwards
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
  position: "D"; // Assuming 'D' is the only position for defense
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
  position: "G"; // Assuming 'G' is the only position for goalies
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

type PlayerGameStats = {
  forwards: Forward[];
  defense: Defense[];
  goalies: Goalie[];
};

function getPlayersGameStats(boxscore: any) {
  const gameId = boxscore.id;
  const {
    homeTeam,
    awayTeam,
  }: { homeTeam: PlayerGameStats; awayTeam: PlayerGameStats } =
    boxscore.boxscore.playerByGameStats;
  const skaters = [
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

  const goalies = [...homeTeam.goalies, ...awayTeam.goalies].map((player) => ({
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
  }));

  return {
    skaters,
    goalies,
  };
}

type BaseType = {
  supabase: SupabaseClient;
};

type UpdateGameStatsParams =
  | (BaseType & { playerType: "skaters"; players: (Defense | Forward)[] })
  | (BaseType & { playerType: "goalies"; players: Goalie[] });

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
        console.log(`try to update the missing player ${player.playerId}`);
        await updatePlayer(player.playerId, supabase);
        await supabase
          .from(`${playerType}GameStats`)
          .upsert(player)
          .throwOnError();
      } else {
        console.error("player " + JSON.stringify(player));
        throw error;
      }
    }
  });

  await Promise.all(promises);
}
