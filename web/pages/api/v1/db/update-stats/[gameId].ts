import { SupabaseClient } from "@supabase/supabase-js";
import { get } from "lib/NHL/base";
import adminOnly from "utils/adminOnlyMiddleware";
import { updatePlayer } from "../update-player/[playerId]";

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
      message: "Successfully updated the stats for game with id of " + gameId,
      success: true,
    });
  } catch (e: any) {
    return res.status(400).json({
      message: `Failed to update stats for game ${gameId}. ${e.message}`,
      success: false,
    });
  }
});

export async function updateStats(gameId: number, supabase: SupabaseClient) {
  const landing = await get(`/gamecenter/${gameId}/landing`);
  if (landing.gameState !== "OFF") {
    throw new Error("The gameState for the game is " + landing.gameState);
  }
  const homeTeamGameStats = getTeamStats(landing, true);
  const awayTeamGameStats = getTeamStats(landing, false);

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

  // update forwardsGameStats table
  const { forwards, defense, goalies } = getPlayersGameStats(boxscore);
  for (const p of forwards) {
    const { error } = await supabase.from("forwardsGameStats").upsert(p);
    if (error === null) continue;
    if (error.details === 'Key is not present in table "players".') {
      // add the missing player
      console.log("try to update the missing player " + p.playerId);
      await updatePlayer(p.playerId, supabase);
      await supabase.from("forwardsGameStats").upsert(p).throwOnError();
    } else {
      throw error;
    }
  }
  // update defenseGameStats table
  for (const p of defense) {
    const { error } = await supabase.from("defenseGameStats").upsert(p);
    if (error === null) continue;
    if (error.details === 'Key is not present in table "players".') {
      // add the missing player
      console.log("try to update the missing player " + p.playerId);
      await updatePlayer(p.playerId, supabase);
      await supabase.from("defenseGameStats").upsert(p).throwOnError();
    } else {
      throw error;
    }
  }
  // update goaliesGameStats table
  for (const p of goalies) {
    const { error } = await supabase.from("goaliesGameStats").upsert(p);
    if (error === null) continue;
    if (error.details === 'Key is not present in table "players".') {
      // add the missing player
      console.log("try to update the missing player " + p.playerId);
      await updatePlayer(p.playerId, supabase);
      await supabase.from("goaliesGameStats").upsert(p).throwOnError();
    } else {
      throw error;
    }
  }
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

function getTeamStats(landing: any, isHomeTeam: boolean) {
  const getStat = (key: Category) => {
    const stats: TeamGameStat[] = landing.summary.teamGameStats;
    return stats.find((stat) => stat.category === key)?.[
      isHomeTeam ? "homeValue" : "awayValue"
    ];
  };
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
  };
}

type PlayerName = {
  default: string;
};

type Forward = {
  playerId: number;
  sweaterNumber: number;
  name: PlayerName;
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
  sweaterNumber: number;
  name: PlayerName;
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
  sweaterNumber: number;
  name: PlayerName;
  position: "G"; // Assuming 'G' is the only position for goalies
  evenStrengthShotsAgainst: string;
  powerPlayShotsAgainst: string;
  shorthandedShotsAgainst: string;
  saveShotsAgainst: string;
  savePctg: string;
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
  const forwards = [...homeTeam.forwards, ...awayTeam.forwards].map(
    (player) => ({
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
    })
  );

  const defense = [...homeTeam.defense, ...awayTeam.defense].map((player) => ({
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
    forwards,
    defense,
    goalies,
  };
}
