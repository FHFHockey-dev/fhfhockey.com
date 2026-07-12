// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-line-combinations\[id].ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  TOIData,
  fetchGamecenterJson,
  getKey,
  isDefense,
  isForward,
  simpleGetTOIData,
  sortByLineCombination,
} from "components/LinemateMatrix";
import adminOnly from "utils/adminOnlyMiddleware";

export default withCronJobAudit(
  adminOnly(async (req, res) => {
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
  }),
);

export async function updateLineCombos(id: number, supabase: SupabaseClient) {
  const lineCombos = await getLineCombos(id);
  const observedAt = new Date().toISOString();
  const sourceUrl = `https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`;
  await Promise.all([
    supabase
      .rpc("upsert_line_combinations_from_source", {
        p_game_id: id,
        p_team_id: lineCombos.homeTeam.id,
        p_source_kind: "gamecenter",
        p_source_key: "nhl_gamecenter",
        p_source_url: sourceUrl,
        p_source_capture_key: null,
        p_observed_at: observedAt,
        ...toRpcPlayerArrays(splitPlayers(lineCombos.homeTeam.players)),
      })
      .throwOnError(),
    supabase
      .rpc("upsert_line_combinations_from_source", {
        p_game_id: id,
        p_team_id: lineCombos.awayTeam.id,
        p_source_kind: "gamecenter",
        p_source_key: "nhl_gamecenter",
        p_source_url: sourceUrl,
        p_source_capture_key: null,
        p_observed_at: observedAt,
        ...toRpcPlayerArrays(splitPlayers(lineCombos.awayTeam.players)),
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
  const boxscore = await fetchGamecenterJson<any>(id, "boxscore");
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

function toRpcPlayerArrays(arrays: ReturnType<typeof splitPlayers>) {
  return {
    p_forwards: arrays.forwards,
    p_defensemen: arrays.defensemen,
    p_goalies: arrays.goalies,
  };
}
