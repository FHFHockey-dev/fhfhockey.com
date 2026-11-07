// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { compareAsc } from "date-fns";

import { getCurrentSeason, getPlayer } from "lib/NHL/server";
import supabase from "lib/supabase/public-client";
import { Player } from "lib/NHL/types";

/**
 * A date in the format of yyyy-mm-dd.
 */
export type DateString = string;

export type Input = {
  /**
   * Start time point in the format of yyyy-mm-dd.
   */
  StartTime: DateString | null;
  /**
   * End time point in the format of yyyy-mm-dd.
   */
  EndTime: DateString | null;

  Season: string;
  /**
   * Player Id.
   */
  PlayerId: number;
};

type Data = {
  toi: number;
  powerPlayToi: number;
  powerPlayToiShare: number;
  date: DateString;
}[];

type Response = {
  message: string;
  success: boolean;
  data?: Data;
};
export async function getInterval(
  Season: string,
  StartTime: string | null,
  EndTime: string | null
) {
  if (!StartTime || !EndTime) {
    if (Season) {
      const { data } = await supabase
        .from("seasons")
        .select("startDate, regularSeasonEndDate")
        .eq("id", Number.parseInt(Season, 10))
        .single()
        .throwOnError();
      if (data === null) throw new Error("Invalid Season");
      StartTime = data.startDate;
      EndTime = data.regularSeasonEndDate;
    } else {
      const season = await getCurrentSeason();
      StartTime = season.regularSeasonStartDate;
      EndTime = season.regularSeasonEndDate;
    }
  }

  return [StartTime, EndTime];
}
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response>
) {
  let { PlayerId, Season, StartTime, EndTime } = req.body as Input;
  try {
    if (!Number.isFinite(PlayerId)) {
      throw new Error("PlayerId is required.");
    }
    [StartTime, EndTime] = await getInterval(Season, StartTime, EndTime);
    const player = await getPlayer(PlayerId);
    if (player.position === "G")
      throw new Error("This endpoint is not for goalies.");

    const playerData = await getData(
      PlayerId,
      StartTime,
      EndTime,
      player.position
    );
    const gameIds = playerData.map((data) => data.gameId);
    // skatersGameStats.powerPlayToi is a "00:00" placeholder (the NHL boxscore
    // has no PP TOI), so PP TOI comes from the FORGE shift-chart split.
    const [forgeRows, teamData] = await Promise.all([
      getForgePowerPlayToi(PlayerId, gameIds),
      getTeamData(gameIds),
    ]);
    const result = buildToiSeries(playerData, forgeRows, teamData);

    res.status(200).json({
      success: true,
      message: "Success!",
      data: result,
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ message: e.message, success: false });
  }
}

export type ToiPlayerGame = { toi: string; date: DateString; gameId: number };
export type ToiForgeGame = {
  game_id: number;
  team_id: number;
  toi_pp_seconds: number | null;
};
export type ToiTeamGame = {
  powerPlayToi: string;
  gameId: number;
  teamId: number;
};

/**
 * One point per player game, in date order. PP TOI is the player's FORGE
 * `toi_pp_seconds`; the share divides it by the PP TOI of the team the player
 * dressed for in that game (not the opponent's row for the same game).
 */
export function buildToiSeries(
  playerGames: ToiPlayerGame[],
  forgeGames: ToiForgeGame[],
  teamGames: ToiTeamGame[]
): Data {
  const forgeByGame = new Map(forgeGames.map((row) => [row.game_id, row]));
  const teamPpByGameTeam = new Map(
    teamGames.map((row) => [`${row.gameId}:${row.teamId}`, row.powerPlayToi])
  );
  return [...playerGames]
    .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)))
    .map((game) => {
      const forge = forgeByGame.get(game.gameId);
      const powerPlayToi =
        forge?.toi_pp_seconds != null && forge.toi_pp_seconds > 0
          ? forge.toi_pp_seconds / 60
          : 0;
      const teamPp = forge
        ? teamPpByGameTeam.get(`${game.gameId}:${forge.team_id}`)
        : undefined;
      const teamPowerPlayToi = teamPp ? parseTime(teamPp) : 0;
      return {
        toi: game.toi ? parseTime(game.toi) : 0,
        powerPlayToi,
        powerPlayToiShare:
          teamPowerPlayToi > 0
            ? Math.min((powerPlayToi / teamPowerPlayToi) * 100, 100)
            : 0,
        date: game.date,
      };
    });
}

/**
 * Convert a time string to minutes.
 * @param timeString mm:ss
 * @returns The number of minutes.
 */
function parseTime(timeString: string) {
  try {
    const arr = timeString.split(":");
    const minutes = Number.parseInt(arr[0]) + Number(arr[1]) / 60; // converting

    return minutes;
  } catch (e) {
    console.error(e, { timeString });
    throw e;
  }
}

async function getData(
  PlayerId: number,
  StartTime: string,
  EndTime: string,
  position: Player["position"]
) {
  const { data } = await supabase
    .from("skatersGameStats")
    .select("toi, games!inner(date,id)")
    .eq("playerId", PlayerId)
    .eq("position", position)
    .gte("games.date", StartTime)
    .lte("games.date", EndTime)
    .throwOnError();

  const result = data!
    .map((item) => ({
      toi: item.toi,
      date: item.games!.date,
      gameId: item.games!.id,
    }))
    .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));

  return result;
}

async function getForgePowerPlayToi(
  PlayerId: number,
  gameIds: number[]
): Promise<ToiForgeGame[]> {
  if (gameIds.length === 0) return [];
  const { data } = await supabase
    .from("forge_player_game_strength")
    .select("game_id, team_id, toi_pp_seconds")
    .eq("player_id", PlayerId)
    .in("game_id", gameIds)
    .throwOnError();
  return data ?? [];
}

async function getTeamData(gameIds: number[]) {
  if (gameIds.length === 0) return [];
  const { data } = await supabase
    .from("teamGameStats")
    .select("teamId, powerPlayToi, games!inner(date,id)")
    .in("games.id", gameIds)
    .throwOnError();
  const result = data!
    .map((item) => ({
      powerPlayToi: item.powerPlayToi,
      date: item.games!.date,
      gameId: item.games!.id,
      teamId: item.teamId,
    }))
    .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));

  return result;
}
