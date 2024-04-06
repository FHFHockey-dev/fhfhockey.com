import type { NextApiRequest, NextApiResponse } from "next";
import { parse } from "node-html-parser";

import fetchWithCache from "lib/fetchWithCache";
import { Data, parseTable } from "../CareerAverages/[playerId]";
import { Input } from "../toi";
import { parseTime } from "lib/NHL/TOI";
import { getPlayer } from "lib/NHL/server";

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
  const player = await getPlayer(Number(playerId));

  if (!player?.teamName) {
    throw new Error("The player is not active " + JSON.stringify(player));
  }
  // NST's team abbreviation
  const team = player?.teamId ? NST_TEAM_ABBREVATION[player.teamName] : "";

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

  // iHDCF - Individual High Danger Chances For
  const iHDCF = Number(individual.data[individual.headers.indexOf("iHDCF")]);

  // iSCF - Individual Scoring Chances For
  const iSCF = Number(individual.data[individual.headers.indexOf("iSCF")]);

  // ixG - Individual Expected Goals
  const ixG = Number(individual.data[individual.headers.indexOf("ixG")]);

  // goals - Goals
  const goals = Number(individual.data[individual.headers.indexOf("Goals")]);

  return {
    "S%": shootsPct / 100,
    "xS%": xSPct,
    IPP: IPP / 100,
    "oiSH%": oiSHPct / 100,
    "secA%": secAPct,
    "SOG/60": SOGPerSixty,
    "oZS%": oZSPct / 100,
    iHDCF: iHDCF,
    iSCF: iSCF,
    ixG: ixG,
    goals: goals,
  };
}

const NST_TEAM_ABBREVATION: { [key: string]: string } = {
  "Anaheim Ducks": "ANA",
  "Arizona Coyotes": "ARI",
  "Boston Bruins": "BOS",
  "Buffalo Sabres": "BUF",
  "Carolina Hurricanes": "CAR",
  "Columbus Blue Jackets": "CBJ",
  "Calgary Flames": "CGY",
  "Chicago Blackhawks": "CHI",
  "Colorado Avalanche": "COL",
  "Dallas Stars": "DAL",
  "Detroit Red Wings": "DET",
  "Edmonton Oilers": "EDM",
  "Florida Panthers": "FLA",
  "Los Angeles Kings": "L.A",
  "Minnesota Wild": "MIN",
  "Montreal Canadiens": "MTL",
  "New Jersey Devils": "N.J",
  "Nashville Predators": "NSH",
  "New York Islanders": "NYI",
  "New York Rangers": "NYR",
  "Ottawa Senators": "OTT",
  "Philadelphia Flyers": "PHI",
  "Pittsburgh Penguins": "PIT",
  "San Jose Sharks": "S.J",
  "Seattle Kraken": "SEA",
  "St Louis Blues": "STL",
  "Tampa Bay Lightning": "T.B",
  "Toronto Maple Leafs": "TOR",
  "Vancouver Canucks": "VAN",
  "Vegas Golden Knights": "VGK",
  "Winnipeg Jets": "WPG",
  "Washington Capitals": "WSH",
};
