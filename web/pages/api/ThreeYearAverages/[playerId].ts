// https://github.com/FHFHockey-dev/fhfhockey.com/pull/15#issuecomment-1208254068
// https://naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=n&v=p&playerid=8473512
import type { NextApiRequest, NextApiResponse } from "next";
import { HTMLElement, parse } from "node-html-parser";

import fetchWithCache from "lib/fetchWithCache";
import { parseTime } from "lib/NHL/TOI";

// TOI
// S% - DONE
// PPTOI% -
// SOG/60 - DONE
// IPP - DONE
// iSCF - DONE
// oiSH% - DONE
// iHDCF - DONE
// A1:A2 - DONE
// oZS% - DONE
// cf/60
// scf/60
// gp% szn
// Team Games : Indiv Games
// primary pts
// goals + A1 - DONE
// pts/60
// xG - done

// NEED:
// PPTOI% - from Supabase
// GP% SZN - GP from Supabase - Team GP from API
// PTs/60

export type Data = {
  IPP: number | null;
  "S%": number | null;
  "xS%": number | null;
  "SOG/60": number | null;
  "oZS%": number | null;
  "oiSH%": number | null;
  "secA%": number | null;
  iHDCF: number | null;
  iSCF: number | null;
  ixG: number | null;
  goals: number | null;
};

export type RatesData = {
  "CF/60": number | null;
  "CA/60": number | null;
  "SCF/60": number | null;
  "SCA/60": number | null;
  "PTS/60": number | null;
};

type Response = {
  message: string;
  success: boolean;
  data?: Data;
  ratesData?: RatesData;
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
    const rates = await GetThreeYearRates(playerId as string);

    res.json({
      success: true,
      message:
        "Successfully fetch the career averages stats for player: " + playerId,
      data: stats,
      ratesData: rates,
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
    iHDCF: number;
    iSCF: number;
    ixG: number;
    goals: number;
    "SOG/60": number;
    IPP: number;
    "oZS%": number;
  };
}

interface YearlyRates {
  [key: string]: {
    "CF/60": number;
    "CA/60": number;
    "SCF/60": number;
    "SCA/60": number;
    "PTS/60": number;
  };
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
  const individualRowsToConsider = individual.data.slice(
    Math.max(individual.data.length - 3, 0)
  );
  const onIceRowsToConsider = onIce.data.slice(
    Math.max(onIce.data.length - 3, 0)
  );

  // Initialize the object to hold yearly data
  const yearData: YearlyStats = {};

  // Loop through the last 3 seasons to capture individual season data
  individualRows.forEach((row, index) => {
    const season = row[0]; // we want the last 3 rows

    yearData[season] = {
      "S%": Number(row[individual.headers.indexOf("S%")]) / 100,
      "oiSH%":
        Number(onIceRows[index][onIce.headers.indexOf("On-Ice SH%")]) / 100,
      "secA%":
        Number(row[individual.headers.indexOf("Second Assists")]) /
        Number(row[individual.headers.indexOf("Total Assists")]),
      iHDCF: Number(row[individual.headers.indexOf("iHDCF")]),
      iSCF: Number(row[individual.headers.indexOf("iSCF")]),
      ixG: Number(row[individual.headers.indexOf("ixG")]),
      goals: Number(row[individual.headers.indexOf("Goals")]),
      "SOG/60":
        (Number(row[individual.headers.indexOf("Shots")]) /
          parseTime(row[individual.headers.indexOf("TOI")])) *
        60,
      IPP: Number(row[individual.headers.indexOf("IPP")]) / 100,
      "oZS%":
        Number(onIceRows[index][onIce.headers.indexOf("Off. Zone Start %")]) /
        100,
    };
  });

  const data: Data = {
    "S%":
      individualRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[individual.headers.indexOf("S%")]),
        0
      ) /
      individualRowsToConsider.length /
      100,

    "xS%":
      individualRowsToConsider.reduce(
        (prev, current) =>
          prev +
          Number(current[individual.headers.indexOf("ixG")]) /
            Number(current[individual.headers.indexOf("Shots")]),
        0
      ) / individualRowsToConsider.length,

    IPP:
      individualRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[individual.headers.indexOf("IPP")]) || 0,
        0
      ) /
      individualRowsToConsider.length /
      100,

    "oiSH%":
      onIceRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[onIce.headers.indexOf("On-Ice SH%")]) || 0,
        0
      ) /
      onIceRowsToConsider.length /
      100,

    "oZS%":
      onIceRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[onIce.headers.indexOf("Off. Zone Start %")]) ||
          0,
        0
      ) /
      onIceRowsToConsider.length /
      100,

    "secA%":
      individualRowsToConsider.reduce(
        (prev, current) =>
          prev +
            Number(current[individual.headers.indexOf("Second Assists")]) /
              Number(current[individual.headers.indexOf("Total Assists")]) || 0,
        0
      ) / individualRowsToConsider.length,

    "SOG/60":
      individualRowsToConsider.reduce(
        (prev, current) =>
          prev +
            (Number(current[individual.headers.indexOf("Shots")]) /
              parseTime(current[individual.headers.indexOf("TOI")])) *
              60 || 0,
        0
      ) / individualRowsToConsider.length,

    iHDCF:
      individualRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[individual.headers.indexOf("iHDCF")]) || 0,
        0
      ) / individualRowsToConsider.length,

    iSCF:
      individualRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[individual.headers.indexOf("iSCF")]) || 0,
        0
      ) / individualRowsToConsider.length,

    ixG:
      individualRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[individual.headers.indexOf("ixG")]) || 0,
        0
      ) / individualRowsToConsider.length,

    goals:
      individualRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[individual.headers.indexOf("Goals")]) || 0,
        0
      ) / individualRowsToConsider.length,
  };
  return { ...data, ...yearData };
}

async function GetThreeYearRates(playerId: string) {
  const URL = `https://naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=y&v=p&playerid=${playerId}`;
  const html = (await fetchWithCache(URL, false)) as string;
  const document = parse(html);

  const individual = parseTable(document.getElementById("indreg"));
  const onIce = parseTable(document.getElementById("reg"));

  const individualRows = individual.data;
  const onIceRows = onIce.data;

  // Ensure only the last 3 years are considered
  const individualRowsToConsider = individual.data.slice(
    Math.max(individual.data.length - 3, 0)
  );
  const onIceRowsToConsider = onIce.data.slice(
    Math.max(onIce.data.length - 3, 0)
  );

  // Initialize the object to hold yearly data
  const yearData: YearlyRates = {};

  // Loop through the last 3 seasons to capture individual season data
  individualRows.forEach((row, index) => {
    const season = row[0]; // we want the last 3 rows

    yearData[season] = {
      "CF/60": Number(onIceRows[index][onIce.headers.indexOf("CF/60")]),
      "CA/60": Number(onIceRows[index][onIce.headers.indexOf("CA/60")]),
      "SCF/60": Number(onIceRows[index][onIce.headers.indexOf("SCF/60")]),
      "SCA/60": Number(onIceRows[index][onIce.headers.indexOf("SCA/60")]),
      "PTS/60": Number(onIceRows[index][individual.headers.indexOf("PTS/60")]),
    };
  });

  const data: RatesData = {
    "CF/60":
      onIceRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[onIce.headers.indexOf("CF/60")]) || 0,
        0
      ) / onIceRowsToConsider.length,

    "CA/60":
      onIceRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[onIce.headers.indexOf("CA/60")]) || 0,
        0
      ) / onIceRowsToConsider.length,

    "SCF/60":
      onIceRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[onIce.headers.indexOf("SCF/60")]) || 0,
        0
      ) / onIceRowsToConsider.length,

    "SCA/60":
      onIceRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[onIce.headers.indexOf("SCA/60")]) || 0,
        0
      ) / onIceRowsToConsider.length,

    "PTS/60":
      onIceRowsToConsider.reduce(
        (prev, current) =>
          prev + Number(current[onIce.headers.indexOf("PTS/60")]) || 0,
        0
      ) / onIceRowsToConsider.length,
  };
  return { ...data, ...yearData };
}
