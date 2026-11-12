import { withNstJobLifecycle } from "lib/nst/jobLifecycle.server";
// https://github.com/FHFHockey-dev/fhfhockey.com/pull/15#issuecomment-1208254068
//
// Legacy compatibility route.
// Despite the file name, this handler still behaves like a player-report endpoint.
// It remains in scope only to preserve existing behavior until cleanup task 7.0
// resolves the route identity mismatch explicitly.

// IDEA TO creat NST team datapoints for api
// 1. Get all team abbreviations
// 2. Loop through each team

import type { NextApiRequest, NextApiResponse } from "next";
import { HTMLElement, parse } from "node-html-parser";

import { buildNstUrlString, fetchNstTextWithCacheByUrl } from "lib/nst/client";
import { parseTime } from "lib/NHL/TOI";

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

type Response = {
  message: string;
  success: boolean;
  data?: Data;
};

async function handler(
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

const knownCount = (text: string | undefined) => {
  const trimmed = String(text ?? "").trim();
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : null;
};

type NstTable = { headers: string[]; data: string[][] };

/** Σ of one column over every season row; null if the column or any value is unknown. */
const columnTotal = (table: NstTable, header: string) => {
  const idx = table.headers.indexOf(header);
  if (idx < 0 || table.data.length === 0) {
    return null;
  }
  let total = 0;
  for (const row of table.data) {
    const value = knownCount(row[idx]);
    if (value === null) {
      return null;
    }
    total += value;
  }
  return total;
};

/** Σ numerator ÷ Σ denominator (Σ of several columns when given a list). */
export function pooledRatio(
  table: NstTable,
  numerator: string,
  denominator: string | string[],
): number | null {
  const top = columnTotal(table, numerator);
  let bottom = 0;
  for (const header of Array.isArray(denominator) ? denominator : [denominator]) {
    const total = columnTotal(table, header);
    if (total === null) {
      return null;
    }
    bottom += total;
  }
  return top === null || bottom <= 0 ? null : top / bottom;
}

/** Season rows keyed by Season + Team; null when the key is missing or repeated. */
const keyedRows = (table: NstTable) => {
  const seasonIdx = table.headers.indexOf("Season");
  const teamIdx = table.headers.indexOf("Team");
  if (seasonIdx < 0) {
    return null;
  }
  const rows = new Map<string, Record<string, string>>();
  for (const row of table.data) {
    const key = `${String(row[seasonIdx] ?? "").trim()}|${
      teamIdx < 0 ? "" : String(row[teamIdx] ?? "").trim()
    }`;
    if (rows.has(key)) {
      return null;
    }
    rows.set(
      key,
      Object.fromEntries(table.headers.map((header, i) => [header, row[i]])),
    );
  }
  return rows;
};

/**
 * IPP = Σ total points ÷ Σ on-ice GF over the same season rows (all
 * situations, same NST report). Null when a season is missing from either
 * table or any component is unknown.
 */
const pooledIpp = (
  individualRows: Map<string, Record<string, string>> | null,
  onIceRows: Map<string, Record<string, string>> | null,
) => {
  if (!individualRows || !onIceRows || individualRows.size === 0) {
    return null;
  }
  let points = 0;
  let goalsFor = 0;
  for (const [key, row] of individualRows) {
    const seasonPoints = knownCount(row["Total Points"]);
    const seasonGoalsFor = knownCount(onIceRows.get(key)?.GF);
    if (seasonPoints === null || seasonGoalsFor === null) {
      return null;
    }
    points += seasonPoints;
    goalsFor += seasonGoalsFor;
  }
  return goalsFor > 0 ? points / goalsFor : null;
};

/**
 * Career SOG/60 from NST's per-season rows: Σ shots ÷ Σ TOI minutes × 60.
 * Never a mean of season rates; null when any season lacks shots or TOI, or
 * the pooled TOI is zero.
 */
export function pooledShotsPerSixty(table: {
  headers: string[];
  data: string[][];
}): number | null {
  const shotsIdx = table.headers.indexOf("Shots");
  const toiIdx = table.headers.indexOf("TOI");
  if (shotsIdx < 0 || toiIdx < 0 || table.data.length === 0) {
    return null;
  }
  let shots = 0;
  let minutes = 0;
  for (const row of table.data) {
    const seasonShots = knownCount(row[shotsIdx]);
    const seasonMinutes = parseTime(row[toiIdx]);
    if (seasonShots === null || !Number.isFinite(seasonMinutes)) {
      return null;
    }
    shots += seasonShots;
    minutes += seasonMinutes;
  }
  return minutes > 0 ? (shots / minutes) * 60 : null;
}

async function getStats(playerId: string) {
  const URL = buildNstUrlString("playerreport.php", {
    stype: 2,
    sit: "all",
    stdoi: "std",
    rate: "n",
    v: "p",
    playerid: playerId
  });
  const { text: html } = await fetchNstTextWithCacheByUrl(URL);
  const document = parse(html);
  const individual = parseTable(document.getElementById("indreg"));
  const onIce = parseTable(document.getElementById("reg"));

  // Career rates pool each value's own components across NST season rows
  // (rule 26): never a mean of season rates, and null when any component is
  // unknown (rule 5). Fractions, 0-1.
  // S% = goals / shots; xS% = ixG / shots
  const shootingPct = pooledRatio(individual, "Goals", "Shots");
  const xSPct = pooledRatio(individual, "ixG", "Shots");
  // secA% = second assists / total assists
  const secAPct = pooledRatio(individual, "Second Assists", "Total Assists");
  // On-ice SH% = on-ice GF / on-ice SF
  const oiSHPct = pooledRatio(onIce, "GF", "SF");
  // oZS% = OZ starts / (OZ + DZ starts) (decision 9)
  const oZSPct = pooledRatio(onIce, "Off. Zone Starts", [
    "Off. Zone Starts",
    "Def. Zone Starts",
  ]);
  // IPP = points / on-ice GF, season rows joined on Season + Team
  const IPP = pooledIpp(keyedRows(individual), keyedRows(onIce));

  // SOG/60: pooled shots over pooled TOI minutes (W2-3 A5).
  const SOGPerSixty = pooledShotsPerSixty(individual);

  // Per-season averages of counts; unknown when any season is unknown.
  const seasonMean = (header: string) => {
    const total = columnTotal(individual, header);
    return total === null ? null : total / individual.data.length;
  };

  const data = {
    "S%": shootingPct,
    "xS%": xSPct,
    IPP,
    "oiSH%": oiSHPct,
    "secA%": secAPct,
    "SOG/60": SOGPerSixty,
    "oZS%": oZSPct,
    iHDCF: seasonMean("iHDCF"),
    iSCF: seasonMean("iSCF"),
    ixG: seasonMean("ixG"),
    goals: seasonMean("Goals"),
  };
  return data;
}

export default withNstJobLifecycle(handler, "Teams/[teamAbbreviation]", undefined, { lazy: true });
