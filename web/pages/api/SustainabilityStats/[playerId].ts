import type { NextApiRequest, NextApiResponse } from "next";
import { HTMLElement, parse } from "node-html-parser";

import fetchWithCache from "lib/fetchWithCache";
import { Data, parseTable } from "../CareerAverages/[playerId]";
import { Input } from "../toi";
import { fetchNHL } from "lib/NHL/NHL_API";
import { parseTime } from "lib/NHL/TOI";

type Response = {
  message: string;
  success: boolean;
  data?: Data;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response>
) {
  const { Season, StartTime, EndTime } = req.body as Input;

  const { playerId } = req.query;
  if (!playerId) {
    return res.json({
      message: "Player Id is required",
      success: false,
    });
  }

  try {
    const stats = await getStats(
      playerId as string,
      Season,
      StartTime,
      EndTime
    );

    res.json({
      success: true,
      message:
        "Successfully fetch the sustainability stats for player: " + playerId,
      data: stats,
    });
  } catch (e: any) {
    res.json({
      success: false,
      message: "Unable to fetch the data. " + e.message,
    });
  }
}

async function getStats(
  playerId: string,
  Season: string,
  StartTime: string | null,
  EndTime: string | null
): Promise<Data> {
  const player = await fetchNHL(`/people/${playerId}`).then(
    ({ people }) => people[0]
  );

  // team abbreviation
  const team = player.active
    ? await fetchNHL(`/teams/${player.currentTeam.id}`).then(({ teams }) => {
        const { abbreviation } = teams[0];
        return abbreviation as string;
      })
    : "";

  if (!player.active) {
    throw new Error("The player is not active " + JSON.stringify(player));
  }

  const url = new URL(
    "https://www.naturalstattrick.com/playerteams.php?stype=2&sit=all&score=all&rate=n&pos=S&loc=B&toi=0&gpfilt=gpdate&tgp=410&lines=single&draftteam=ALL"
  );

  // set the season
  url.searchParams.set("fromseason", Season);
  url.searchParams.set("thruseason", Season);

  // set the start and end time
  if (StartTime && EndTime) {
    url.searchParams.set("fd", StartTime);
    url.searchParams.set("td", EndTime);
  }

  // filter by the team
  url.searchParams.set("team", team);

  // get on-ice and individual URLs
  url.searchParams.set("stdoi", "std");
  const individualURL = url.toString();

  url.searchParams.set("stdoi", "oi");
  const onIceURL = url.toString();

  const [individualHtml, onIceHtml] = (await Promise.all([
    fetchWithCache(individualURL, false),
    fetchWithCache(onIceURL, false),
  ])) as string[];
  const individualDocument = parse(individualHtml);
  const onIceDocument = parse(onIceHtml);
  const onIces = parseTable(onIceDocument.getElementById("players"));
  const onIce = {
    headers: onIces.headers,
    data: onIces.data.find((person) => person[1] === player.fullName),
  };

  const individuals = parseTable(individualDocument.getElementById("indreg"));
  const individual = {
    headers: individuals.headers,
    data: individuals.data.find((person) => person[1] === player.fullName),
  };

  if (!individual.data || !onIce.data) {
    throw new Error(
      `Unable to find player: ${
        player.fullName
      } in team: ${team}. URL: ${url.toString()}`
    );
  }

  // S%
  const shootsPctIdx = individual.headers.indexOf("SH%");
  const shootsPct = Number(individual.data[shootsPctIdx]);

  // xS% (ixG/shots)
  const xSPct =
    Number(individual.data[individual.headers.indexOf("ixG")]) /
    Number(individual.data[individual.headers.indexOf("Shots")]);

  // IPP
  const IPP = Number(individual.data[individual.headers.indexOf("IPP")]);

  // oiSH% - "On-Ice SH%"
  const oiSHPct = Number(onIce.data[onIce.headers.indexOf("On-Ice SH%")]);

  // sec A% (Secondary assist %) - second assists/total Assists
  const secAPct =
    Number(individual.data[individual.headers.indexOf("Second Assists")]) /
      Number(individual.data[individual.headers.indexOf("Total Assists")]) || 0;

  // SOG/60 - (shots/toi)*60
  const SOGPerSixty =
    (Number(individual.data[individual.headers.indexOf("Shots")]) /
      parseTime(individual.data[individual.headers.indexOf("TOI")]) || 0) * 60;

  // oZS% is offensive zone start % - Off. Zone Start %
  const oZSPct = Number(onIce.data[onIce.headers.indexOf("Off. Zone Start %")]);

  return {
    "S%": shootsPct / 100,
    "xS%": xSPct,
    IPP: IPP / 100,
    "oiSH%": oiSHPct / 100,
    "secA%": secAPct,
    "SOG/60": SOGPerSixty,
    "oZS%": oZSPct / 100,
  };
}
