// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { fetchNHL } from "lib/NHL/NHL_API";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * A date in the format of yyyy-mm-dd.
 */
type DateString = string;

type Input = {
  /**
   * Start time point in the format of yyyy-mm-dd.
   */
  StartTime: DateString;
  /**
   * End time point in the format of yyyy-mm-dd.
   */
  EndTime: DateString;
  /**
   * Player Id.
   */
  PlayerId: number;
};

type Data = {
  TOI: {
    date: DateString;
    value: number;
  }[];

  PPTOI: {
    date: DateString;
    value: number;
  }[];
};

type Response = {
  message: string;
  success: boolean;
  data?: Data;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response>
) {
  const { PlayerId, StartTime, EndTime } = req.body as Input;

  const toiData = await fetchNHL(`/people/${PlayerId}/stats?stats=gameLog`);
  if (toiData.message === "Internal error occurred") {
    return res.status(404).json({
      message: "Player not found",
      success: false,
    });
  }

  const games = toiData.stats[0].splits as {
    stat: { timeOnIce: string; powerPlayTimeOnIce: string };
    date: DateString;
  }[];

  // filter dates
  const start = new Date(StartTime);
  const end = new Date(EndTime);

  const filteredGames = games.filter((game) => {
    const date = new Date(game.date);
    const inRange = start <= date && date <= end;
    return inRange;
  });

  // Calculate TOI - convert time string into minutes (number)
  const TOI = filteredGames.map((game) => ({
    date: game.date,
    value: parseTime(game.stat.timeOnIce),
  }));

  // Calculate PPTOI

  res.status(200).json({
    success: true,
    message: "Success!",
    data: {
      TOI,
      PPTOI: [],
    },
  });
}

/**
 * Convert a time string to minutes.
 * @param timeString mm:ss
 * @returns The number of minutes.
 */
function parseTime(timeString: string) {
  const arr = timeString.split(":");
  const minutes = Number.parseInt(arr[0]) + Number.parseInt(arr[1]) / 60; // converting

  return minutes;
}
