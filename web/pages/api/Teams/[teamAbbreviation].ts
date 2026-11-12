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

  // SOG/60: pooled shots over pooled TOI minutes (rule 26), unknown when any
  // season's shots or TOI is unknown (W2-3 A5).
  const SOGPerSixty = pooledShotsPerSixty(individual);

  // oZS% is offensive zone start % - Off. Zone Start %
  const oZSPct =
    onIce.data.reduce(
      (prev, current) =>
        prev + Number(current[onIce.headers.indexOf("Off. Zone Start %")]) || 0,
      0
    ) / onIce.data.length;

  const iHDCF =
    individual.data.reduce(
      (prev, current) =>
        prev + Number(current[individual.headers.indexOf("iHDCF")]) || 0,
      0
    ) / individual.data.length;

  const iSCF =
    individual.data.reduce(
      (prev, current) =>
        prev + Number(current[individual.headers.indexOf("iSCF")]) || 0,
      0
    ) / individual.data.length;

  const ixG =
    individual.data.reduce(
      (prev, current) =>
        prev + Number(current[individual.headers.indexOf("ixG")]) || 0,
      0
    ) / individual.data.length;

  const goals =
    individual.data.reduce(
      (prev, current) =>
        prev + Number(current[individual.headers.indexOf("Goals")]) || 0,
      0
    ) / individual.data.length;

  const data = {
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
  return data;
}

export default withNstJobLifecycle(handler, "Teams/[teamAbbreviation]", undefined, { lazy: true });
