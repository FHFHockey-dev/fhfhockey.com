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
  "iHDCF": number | null;
  "iSCF": number | null;
  "ixG": number | null;
  "goals": number | null;
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
    const stats = await GetThreeYearStats(playerId as string);

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

interface YearlyStats {
    [key: string]: {
        "S%": number;
        "oiSH%": number;
        "secA%": number;
        "iHDCF": number;
        "iSCF": number;
        "ixG": number;
        "goals": number;
        "SOG/60": number;
        "IPP": number;
        "oZS%": number;
    }
}

async function GetThreeYearStats(playerId: string) {
    const URL = `https://naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=n&v=p&playerid=${playerId}`;
    const html = (await fetchWithCache(URL, false)) as string;
    const document = parse(html);
    
    const individual = parseTable(document.getElementById("indreg"));
    const onIce = parseTable(document.getElementById("reg")); 

    const individualRows = individual.data;
    const onIceRows = onIce.data;

    // Ensure only the last 3 years are considered
    const individualRowsToConsider = individual.data.slice(Math.max(individual.data.length - 3, 0));
    const onIceRowsToConsider = onIce.data.slice(Math.max(onIce.data.length - 3, 0));

    // Initialize the object to hold yearly data
    const yearData: YearlyStats = {};

    // Loop through the last 3 seasons to capture individual season data
    individualRows.forEach((row, index) => {
        const season = row[0]; // we want the last 3 rows

        yearData[season] = {
            "S%": Number(row[individual.headers.indexOf("S%")]) / 100,
            "oiSH%": Number(onIceRows[index][onIce.headers.indexOf("On-Ice SH%")]) / 100,
            "secA%": Number(row[individual.headers.indexOf("Second Assists")]) / Number(row[individual.headers.indexOf("Total Assists")]),
            "iHDCF": Number(row[individual.headers.indexOf("iHDCF")]),
            "iSCF": Number(row[individual.headers.indexOf("iSCF")]),
            "ixG": Number(row[individual.headers.indexOf("ixG")]),
            "goals": Number(row[individual.headers.indexOf("Goals")]),
            "SOG/60": (Number(row[individual.headers.indexOf("Shots")]) / parseTime(row[individual.headers.indexOf("TOI")])) * 60,
            "IPP": Number(row[individual.headers.indexOf("IPP")]) / 100,
            "oZS%": Number(onIceRows[index][onIce.headers.indexOf("Off. Zone Start %")]) / 100,
        };
    });


        const data: Data = {
            "S%": individualRowsToConsider.reduce(
                (prev, current) => prev + Number(current[individual.headers.indexOf("S%")]), 0
            ) / individualRowsToConsider.length / 100,
            "xS%": individualRowsToConsider.reduce(
                (prev, current) => prev + Number(current[individual.headers.indexOf("ixG")]) / Number(current[individual.headers.indexOf("Shots")]), 0
            ) / individualRowsToConsider.length,
            IPP: individualRowsToConsider.reduce(
                (prev, current) => prev + Number(current[individual.headers.indexOf("IPP")]) || 0, 0
            ) / individualRowsToConsider.length / 100,
            "oiSH%": onIceRowsToConsider.reduce(
                (prev, current) => prev + Number(current[onIce.headers.indexOf("On-Ice SH%")]) || 0, 0
            ) / onIceRowsToConsider.length / 100,
            "oZS%": onIceRowsToConsider.reduce(
                (prev, current) => prev + Number(current[onIce.headers.indexOf("Off. Zone Start %")]) || 0, 0
            ) / onIceRowsToConsider.length / 100,
            "secA%": individualRowsToConsider.reduce(
                (prev, current) => prev + Number(current[individual.headers.indexOf("Second Assists")]) / Number(current[individual.headers.indexOf("Total Assists")]) || 0, 0
            ) / individualRowsToConsider.length,
            "SOG/60": individualRowsToConsider.reduce(
                (prev, current) => prev + Number(current[individual.headers.indexOf("Shots")]) / parseTime(current[individual.headers.indexOf("TOI")]) * 60 || 0, 0
            ) / individualRowsToConsider.length,
            "iHDCF": individualRowsToConsider.reduce(
                (prev, current) => prev + Number(current[individual.headers.indexOf("iHDCF")]) || 0, 0
            ) / individualRowsToConsider.length,
            "iSCF": individualRowsToConsider.reduce(
                (prev, current) => prev + Number(current[individual.headers.indexOf("iSCF")]) || 0, 0
            ) / individualRowsToConsider.length,
            "ixG": individualRowsToConsider.reduce(
                (prev, current) => prev + Number(current[individual.headers.indexOf("ixG")]) || 0, 0
            ) / individualRowsToConsider.length,
            "goals": individualRowsToConsider.reduce(
                (prev, current) => prev + Number(current[individual.headers.indexOf("Goals")]) || 0, 0
            ) / individualRowsToConsider.length
        };
        return {...data, ...yearData};
}

