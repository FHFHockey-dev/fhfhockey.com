// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { isWithinInterval } from "date-fns";
import { parse } from "node-html-parser";

import { fetchNHL } from "lib/NHL/NHL_API";
import fetchWithCache from "lib/fetchWithCache";

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
  const { PlayerId, Season, StartTime, EndTime } = req.body as Input;

  const toiData = await fetchNHL(
    `/people/${PlayerId}/stats?stats=gameLog&season=${Season}`
  );
  if (toiData.message === "Internal error occurred") {
    return res.status(404).json({
      message: "Player not found",
      success: false,
    });
  } else if (toiData.message?.includes("Invalid Request")) {
    return res.status(400).json({
      message: toiData.message,
      success: false,
    });
  }

  const games = toiData.stats[0].splits as {
    stat: { timeOnIce: string; powerPlayTimeOnIce: string };
    date: DateString;
    game: {
      gamePk: number;
    };
    isHome: boolean;
  }[];

  // filter dates
  let filteredGames;
  if (StartTime && EndTime) {
    const start = new Date(StartTime);
    const end = new Date(EndTime);

    filteredGames = games.filter((game) => {
      const date = new Date(game.date);
      return isWithinInterval(date, { start, end });
    });
  } else {
    filteredGames = games;
  }

  // Calculate TOI - convert time string into minutes (number)
  const TOI = filteredGames.map((game) => ({
    date: game.date,
    value: parseTime(game.stat.timeOnIce),
  }));

  // Calculate PPTOI
  const PPTOI = await Promise.all(
    filteredGames.map(async (game) => {
      // get game type and game number
      // e.g. "gamePk": 2021021276,
      const gameId = game.game.gamePk.toString().slice(4).toString();
      const individualPPTOI = parseTime(
        game.stat.powerPlayTimeOnIce ?? "00:00"
      );

      const teamPPTOI = parseTime(
        (await getPPTOI(Season, gameId, game.isHome)) ?? "00:00"
      );

      return {
        date: game.date,
        value: teamPPTOI === 0 ? 0 : (individualPPTOI / teamPPTOI) * 100,
      };
    })
  );

  res.status(200).json({
    success: true,
    message: "Success!",
    data: {
      TOI,
      PPTOI,
    },
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
    console.error(e);
    throw e;
  }
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
  // console.log(gameId, PPTOIs);

  return PPTOIs[isHome ? 1 : 0] as string;
}
