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

type ToiPoint = {
  /** Player TOI in minutes; null when the game row has no TOI. */
  toi: number | null;
  /**
   * Observed PP minutes from a qualified, source-attributed PP clock
   * (decision 71). Null until that clock is qualified: FORGE's split is a
   * model input and is never served as observed PP time.
   */
  powerPlayToi: number | null;
  /** Player PP share from the same qualified clock; null until qualified. */
  powerPlayToiShare: number | null;
  date: DateString;
  /** FORGE's modelled PP split for this game, labelled as a model input. */
  modelPowerPlay: {
    source: "forge_player_game_strength.toi_pp_seconds";
    /** FORGE player PP minutes; null when FORGE has no row or no value. */
    playerPpMinutes: number | null;
    /** The team's official NHL PP clock in minutes; null when unknown. */
    teamPpClockMinutes: number | null;
    /**
     * True when the modelled player PP time exceeds the team clock: an
     * impossible share that is flagged for investigation, never capped.
     */
    exceedsTeamClock: boolean | null;
  };
};

type Data = ToiPoint[];

export const PP_SHARE_UNAVAILABLE_REASON =
  "PP share unavailable: no qualified PP clock yet. FORGE's PP split is a model input, not observed PP time.";

type Response = {
  message: string;
  success: boolean;
  data?: Data;
  /** Whether observed PP time/share can be served, and why not. */
  powerPlayStatus?: { available: boolean; reason: string | null };
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
    // skatersGameStats.powerPlayToi is absent (null) or a legacy "00:00"
    // placeholder (the NHL boxscore has no skater PP TOI). Observed PP time and
    // share need a qualified PP clock (decision 71); FORGE's split is returned
    // only as a labelled model input.
    const [forgeRows, teamData] = await Promise.all([
      getForgePowerPlayToi(PlayerId, gameIds),
      getTeamData(gameIds),
    ]);
    const result = buildToiSeries(playerData, forgeRows, teamData);

    res.status(200).json({
      success: true,
      message: "Success!",
      data: result,
      powerPlayStatus: { available: false, reason: PP_SHARE_UNAVAILABLE_REASON },
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
  powerPlayToi: string | null;
  gameId: number;
  teamId: number;
};

/**
 * One point per player game, in date order. Observed PP time and share stay
 * null until a qualified PP clock exists (decision 71). FORGE's PP seconds
 * are reported as a model input next to the official clock of the team the
 * player dressed for; a model value above that clock is flagged, not capped.
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
      const playerPpMinutes =
        forge?.toi_pp_seconds != null ? forge.toi_pp_seconds / 60 : null;
      const teamPp = forge
        ? teamPpByGameTeam.get(`${game.gameId}:${forge.team_id}`)
        : undefined;
      const teamPpClockMinutes = teamPp ? parseTime(teamPp) : null;
      return {
        toi: game.toi ? parseTime(game.toi) : null,
        powerPlayToi: null,
        powerPlayToiShare: null,
        date: game.date,
        modelPowerPlay: {
          source: "forge_player_game_strength.toi_pp_seconds",
          playerPpMinutes,
          teamPpClockMinutes,
          exceedsTeamClock:
            playerPpMinutes != null && teamPpClockMinutes != null
              ? playerPpMinutes > teamPpClockMinutes
              : null,
        },
      };
    });
}

/**
 * Convert a time string to minutes.
 * @param timeString mm:ss
 * @returns The number of minutes.
 */
function parseTime(timeString: string): number | null {
  if (!/^\d+:\d{2}$/.test(timeString.trim())) return null;
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
