import { withNstJobLifecycle } from "lib/nst/jobLifecycle.server";
import type { NextApiRequest, NextApiResponse } from "next";
import { parse } from "node-html-parser";

import { fetchNstTextWithCacheByUrl } from "lib/nst/client";
import {
  Data,
  nstHeaderIndex,
  nstNumber,
  parseTable
} from "../CareerAverages/[playerId]";
import { Input } from "../toi";
import { parseTime } from "lib/NHL/TOI";
import { getPlayer } from "lib/NHL/server";

type Response = {
  message: string;
  success: boolean;
  data?: Data;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response>
) {
  const { Season, StartTime, EndTime } = req.body as Input;

  const { playerId } = req.query;
  if (!playerId) {
    return res.json({
      message: "Player Id is required",
      success: false
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
      data: stats
    });
  } catch (e: any) {
    res.json({
      success: false,
      message: "Unable to fetch the data. " + e.message
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
    "https://data.naturalstattrick.com/playerteams.php?stype=2&sit=all&score=all&rate=n&pos=S&loc=B&toi=0&gpfilt=gpdate&tgp=410&lines=single&draftteam=ALL"
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

  const [{ text: individualHtml }, { text: onIceHtml }] = await Promise.all([
    fetchNstTextWithCacheByUrl(individualURL),
    fetchNstTextWithCacheByUrl(onIceURL)
  ]);
  const individualDocument = parse(individualHtml);

  const onIceDocument = parse(onIceHtml);
  // NST identity here is matched by player name within the team table
  // (BC W1-9 D12): a name collision or spelling difference finds the wrong
  // or no player. Kept as-is; flagged for an id-based lookup.
  const onIces = parseTable(onIceDocument.getElementById("players"));
  const onIce = {
    headers: onIces.headers,
    data: onIces.data.find((person) => person[1] === player.fullName)
  };

  const individuals = parseTable(individualDocument.getElementById("indreg"));
  const individual = {
    headers: individuals.headers,
    data: individuals.data.find((person) => person[1] === player.fullName)
  };

  if (!individual.data || !onIce.data) {
    throw new Error(
      `Unable to find player: ${
        player.fullName
      } in team: ${team}. URL: ${url.toString()}`
    );
  }

  const ind = (header: string) => {
    const idx = nstHeaderIndex(individual.headers, header);
    return idx === -1 ? null : nstNumber(individual.data![idx]);
  };
  const oi = (header: string) => {
    const idx = nstHeaderIndex(onIce.headers, header);
    return idx === -1 ? null : nstNumber(onIce.data![idx]);
  };
  const ratio = (num: number | null, den: number | null) =>
    num == null || den == null || den <= 0 ? null : num / den;
  const fraction = (percent: number | null) =>
    percent == null ? null : percent / 100;
  const toiIdx = nstHeaderIndex(individual.headers, "TOI");
  const toiMinutes = toiIdx === -1 ? Number.NaN : parseTime(individual.data[toiIdx]);
  const shotsPer60 = ratio(
    ind("Shots"),
    Number.isFinite(toiMinutes) ? toiMinutes : null
  );

  const parts = (
    numerator: number | null,
    denominator: number | null
  ) => ({ numerator, denominator });
  const oz = oi("Off. Zone Starts");
  const dz = oi("Def. Zone Starts");

  return {
    "S%": fraction(ind("SH%")),
    // Decision 17: xS% = ixG / unblocked attempts (iFF).
    "xS%": ratio(ind("ixG"), ind("iFF")),
    IPP: fraction(ind("IPP")),
    "oiSH%": fraction(oi("On-Ice SH%")),
    "secA%": ratio(ind("Second Assists"), ind("Total Assists")),
    // Unknown or zero TOI is unknown, never 0 SOG/60 (L3 parseTime ticket).
    "SOG/60": shotsPer60 == null ? null : shotsPer60 * 60,
    "oZS%": fraction(oi("Off. Zone Start %")),
    iHDCF: ind("iHDCF"),
    iSCF: ind("iSCF"),
    ixG: ind("ixG"),
    goals: ind("Goals"),
    // Window numerators and denominators for the sample-aware comparison.
    components: {
      "S%": parts(ind("Goals"), ind("Shots")),
      "xS%": parts(ind("ixG"), ind("iFF")),
      IPP: parts(ind("Total Points"), oi("GF")),
      "oiSH%": parts(oi("GF"), oi("SF")),
      "secA%": parts(ind("Second Assists"), ind("Total Assists")),
      "SOG/60": parts(
        ind("Shots"),
        Number.isFinite(toiMinutes) ? toiMinutes : null
      ),
      "oZS%": parts(oz, oz != null && dz != null ? oz + dz : null)
    }
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
  "Washington Capitals": "WSH"
};

export default withNstJobLifecycle(handler, "SustainabilityStats/[playerId]", undefined, { lazy: true });
