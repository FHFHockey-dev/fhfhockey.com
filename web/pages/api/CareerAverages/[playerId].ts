// https://github.com/FHFHockey-dev/fhfhockey.com/pull/15#issuecomment-1208254068
// https://naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=n&v=p&playerid=8473512
import type { NextApiRequest, NextApiResponse } from "next";
import { HTMLElement, parse } from "node-html-parser";

import fetchWithCache from "lib/fetchWithCache";
import { parseTime } from "lib/NHL/TOI";

export type Data = {
  IPP: number | null;
  "S%": number | null;
  "xS%": number | null;
  "SOG/60": number | null;
  "oZS%": number | null;
  "oiSH%": number | null;
  "secA%": number | null;
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
  const { playerId } = req.query;
  if (!playerId) {
    return res.json({
      message: "Player Id is required",
      success: false,
    });
  }

  try {
    const stats = await getStats(playerId as string);

    res.json({
      success: true,
      message:
        "Successfully fetch the career averages stats for player: " + playerId,
      data: stats,
    });
  } catch (e: any) {
    res.json({
      success: false,
      message: "Unable to fetch the data. " + e.message,
    });
  }
}

export function parseTable(table: HTMLElement) {
  const data = [];
  const rows = table.getElementsByTagName("tr");

  if (rows.length <= 2) {
    throw new Error("Cannot find the player.");
  }
  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const cols = [...row.childNodes]
      .filter((n) => n.nodeType !== 3)
      .map((td) => td.textContent);
    data.push(cols);
  }

  const headers = [...rows[0].childNodes]
    .filter((n) => n.nodeType !== 3)
    .map((th) => th.textContent);
  return { headers, data };
}

async function getStats(playerId: string) {
  const URL = `https://naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=n&v=p&playerid=${playerId}`;

  const html = (await fetchWithCache(URL, false)) as string;
  const document = parse(html);
  const individual = parseTable(document.getElementById("indreg"));
  const onIce = parseTable(document.getElementById("reg"));

  // S%
  const shootsPctIdx = individual.headers.indexOf("S%");
  const shootsPct =
    individual.data.reduce(
      (prev, current) => prev + Number(current[shootsPctIdx]),
      0
    ) / individual.data.length;

  // xS% (ixG/shots)
  const xSPct =
    individual.data.reduce(
      (prev, current) =>
        prev +
        Number(current[individual.headers.indexOf("ixG")]) /
          Number(current[individual.headers.indexOf("Shots")]),
      0
    ) / individual.data.length;

  // IPP
  const IPP =
    individual.data.reduce(
      (prev, current) =>
        prev + Number(current[individual.headers.indexOf("IPP")]) || 0,
      0
    ) / individual.data.length;

  // oiSH% - "On-Ice SH%"
  const oiSHPct =
    onIce.data.reduce(
      (prev, current) =>
        prev + Number(current[onIce.headers.indexOf("On-Ice SH%")]) || 0,
      0
    ) / onIce.data.length;

  // sec A% (Secondary assist %) - second assists/total Assists
  const secAPct =
    individual.data.reduce(
      (prev, current) =>
        prev +
          Number(current[individual.headers.indexOf("Second Assists")]) /
            Number(current[individual.headers.indexOf("Total Assists")]) || 0,
      0
    ) / individual.data.length;

  // SOG/60 - (shots/toi)*60
  const SOGPerSixty =
    individual.data.reduce((prev, current) => {
      return (
        prev +
        (Number(current[individual.headers.indexOf("Shots")]) /
          parseTime(current[individual.headers.indexOf("TOI")]) || 0) *
          60
      );
    }, 0) / individual.data.length;

  // oZS% is offensive zone start % - Off. Zone Start %
  const oZSPct =
    onIce.data.reduce(
      (prev, current) =>
        prev + Number(current[onIce.headers.indexOf("Off. Zone Start %")]) || 0,
      0
    ) / onIce.data.length;

  const data = {
    "S%": shootsPct / 100,
    "xS%": xSPct,
    IPP: IPP / 100,
    "oiSH%": oiSHPct / 100,
    "secA%": secAPct,
    "SOG/60": SOGPerSixty,
    "oZS%": oZSPct / 100,
  };
  return data;
}
