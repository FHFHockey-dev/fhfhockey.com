// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-line-combinations\[id].ts

import { SupabaseClient } from "@supabase/supabase-js";
import {
  TOIData,
  getKey,
  isDefense,
  isForward,
  simpleGetTOIData,
  sortByLineCombination,
} from "components/LinemateMatrix";
import adminOnly from "utils/adminOnlyMiddleware";

export default adminOnly(async (req, res) => {
  const supabase = req.supabase;
  const gameId = Number(req.query.id);
  try {
    const data = await updateLineCombos(gameId, supabase);
    res.json({
      message: `Successfully updated the line combinations for game ${gameId}`,
      success: true,
      data: {
        homeTeam: data[0],
        awayTeam: data[1],
      },
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ message: e.message, success: false });
  }
});

export async function updateLineCombos(id: number, supabase: SupabaseClient) {
  const lineCombos = await getLineCombos(id);
  await Promise.all([
    supabase
      .from("lineCombinations")
      .upsert({
        gameId: id,
        teamId: lineCombos.homeTeam.id,
        ...splitPlayers(lineCombos.homeTeam.players),
      })
      .throwOnError(),
    supabase
      .from("lineCombinations")
      .upsert({
        gameId: id,
        teamId: lineCombos.awayTeam.id,
        ...splitPlayers(lineCombos.awayTeam.players),
      })
      .throwOnError(),
  ]);

  const { data } = await supabase
    .from("lineCombinations")
    .select("*")
    .eq("gameId", id)
    .throwOnError();
  if (!data) {
    throw new Error("Cannot find the line combination for game " + id);
  }

  return data;
}

async function getLineCombos(id: number) {
  const { toi, rosters, teams } = await simpleGetTOIData(id);
  const goalies = await getGoalies(id);

  const [homeTeam, awayTeam] = teams;
  const result = {
    homeTeam: {
      id: homeTeam.id,
      players: [] as { id: number; position: string }[],
    },
    awayTeam: {
      id: awayTeam.id,
      players: [] as { id: number; position: string }[],
    },
  };
  teams.forEach((team) => {
    const roster = rosters[team.id];
    const table: Record<string, TOIData> = {};
    toi[team.id].forEach((item) => {
      const key = getKey(item.p1.id, item.p2.id);
      table[key] = item;
    });
    const players = sortByLineCombination(table, roster).map((item) => ({
      id: item.id,
      position: item.position,
    }));
    const currentTeam = team.id === homeTeam.id ? "homeTeam" : "awayTeam";
    players.push(...goalies[currentTeam]);
    result[currentTeam].players = players;
  });

  return result;
}

async function getGoalies(id: number) {
  const result: Record<
    "homeTeam" | "awayTeam",
    { id: number; position: string }[]
  > = { homeTeam: [], awayTeam: [] };
  const boxscore = await fetch(
    `https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`
  ).then((res) => res.json());
  const playerByGameStats = boxscore.playerByGameStats;

  result.homeTeam = playerByGameStats.homeTeam.goalies.map((item: any) => ({
    id: item.playerId,
    position: item.position,
  }));
  result.awayTeam = playerByGameStats.awayTeam.goalies.map((item: any) => ({
    id: item.playerId,
    position: item.position,
  }));
  return result;
}

function splitPlayers(players: { id: number; position: string }[]) {
  const forwards = players
    .filter((player) => isForward(player.position))
    .map((p) => p.id);
  const defensemen = players
    .filter((player) => isDefense(player.position))
    .map((p) => p.id);
  const goalies = players
    .filter((player) => player.position === "G")
    .map((p) => p.id);

  return { forwards, defensemen, goalies };
}
