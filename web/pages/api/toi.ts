// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { compareAsc } from "date-fns";

import { getCurrentSeason, getPlayer } from "lib/NHL/server";
import supabase from "lib/supabase";

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

const positionMap = {
  L: "forwards",
  R: "forwards",
  D: "defense",
  C: "forwards",
} as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response>
) {
  let { PlayerId, Season, StartTime, EndTime } = req.body as Input;
  try {
    if (StartTime === null || EndTime === null) {
      if (Season) {
        const { data } = await supabase
          .from("seasons")
          .select("startDate, regularSeasonEndDate")
          .eq("id", Season)
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
    const player = await getPlayer(PlayerId);
    if (player.position === "G")
      throw new Error("This endpoint is not for goalies.");

    const teamData = player.teamId
      ? await getTeamData(player.teamId, StartTime, EndTime)
      : [];
    const playerData = await getData(
      PlayerId,
      StartTime,
      EndTime,
      positionMap[player.position]
    );

    const temp: Record<
      DateString,
      {
        toi?: string;
        powerPlayToi?: string;
        teamPowerPlayToi: string;
        date: DateString;
      }
    > = {};
    teamData.forEach((item) => {
      const date = item.date;
      temp[date] = { teamPowerPlayToi: item.powerPlayToi, date };
    });
    playerData.forEach((item) => {
      const date = item.date;
      temp[date].toi = item.toi;
      temp[date].powerPlayToi = item.powerPlayToi;
    });
    const result: {
      toi: number;
      powerPlayToi: number;
      powerPlayToiShare: number;
      date: DateString;
    }[] = Object.values(temp).map((item) => ({
      toi: item.toi ? parseTime(item.toi) : 0,
      powerPlayToi: item.powerPlayToi ? parseTime(item.powerPlayToi) : 0,
      powerPlayToiShare: item.powerPlayToi
        ? parseTime(item.teamPowerPlayToi) === 0
          ? 0
          : (parseTime(item.powerPlayToi) / parseTime(item.teamPowerPlayToi)) *
            100
        : 0,
      date: item.date,
    }));

    res.status(200).json({
      success: true,
      message: "Success!",
      data: result,
    });
  } catch (e: any) {
    res.status(400).json({ message: e.message, success: false });
  }
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
  playerType: "defense" | "forwards"
) {
  const { data } = await supabase
    .from(`${playerType}GameStats`)
    .select("toi, powerPlayToi, games!inner(date,id)")
    .eq("playerId", PlayerId)
    .gte("games.date", StartTime)
    .lte("games.date", EndTime)
    .throwOnError();
  const result = data!
    .map((item) => ({
      toi: item.toi,
      powerPlayToi: item.powerPlayToi,
      date: item.games!.date,
      gameId: item.games!.id,
    }))
    .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));

  return result;
}

async function getTeamData(teamId: number, StartTime: string, EndTime: string) {
  const { data } = await supabase
    .from("teamGameStats")
    .select("teamId, powerPlayToi, games!inner(date,id)")
    .eq("teamId", teamId)
    .gte("games.date", StartTime)
    .lte("games.date", EndTime)
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
