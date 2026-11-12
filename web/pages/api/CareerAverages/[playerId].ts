import { withNstJobLifecycle } from "lib/nst/jobLifecycle.server";
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
      success: false
    });
  }

  try {
    const stats = await getStats(playerId as string);

    res.json({
      success: true,
      message:
        "Successfully fetch the career averages stats for player: " + playerId,
      data: stats
    });
  } catch (e: any) {
    res.json({
      success: false,
      message: "Unable to fetch the data. " + e.message
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

/** A numeric NST cell; "-", blanks and other non-numbers are unknown. */
export function nstNumber(value: string | null | undefined): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** NST TOI cell in minutes; unknown (NaN from parseTime) stays null. */
function nstMinutes(value: string | null | undefined): number | null {
  const minutes = parseTime(value);
  return Number.isFinite(minutes) ? minutes : null;
}

/** Header lookup that treats NST's non-breaking spaces as spaces. */
export function nstHeaderIndex(headers: string[], header: string): number {
  return headers.findIndex(
    (candidate) => candidate.replace(/\u00a0/g, " ").trim() === header
  );
}

/** Start year of an NST season label ("20252026" or "2025-26"). */
function seasonStartYear(value: string | null | undefined): number | null {
  const match = /^(\d{4})\D?\d{2,4}$/.exec(String(value ?? "").trim());
  return match ? Number(match[1]) : null;
}

/** Start year of the season in progress (or about to start) on `asOf`. */
export function currentSeasonStartYear(asOf: Date): number {
  const year = asOf.getUTCFullYear();
  return asOf.getUTCMonth() >= 6 ? year : year - 1;
}

type ParsedTable = { headers: string[]; data: string[][] };

type SeasonRow = {
  get: (header: string) => number | null;
  minutes: number | null;
  onIce: ((header: string) => number | null) | null;
};

/**
 * Pools a ratio over seasons where both parts are known (rule 26):
 * sum(numerator) / sum(denominator). Unknown seasons are skipped, never
 * zeroed; no known season or a zero denominator gives null.
 */
function pooled(
  rows: SeasonRow[],
  numerator: (row: SeasonRow) => number | null,
  denominator: (row: SeasonRow) => number | null
): number | null {
  let num = 0;
  let den = 0;
  rows.forEach((row) => {
    const n = numerator(row);
    const d = denominator(row);
    if (n == null || d == null) return;
    num += n;
    den += d;
  });
  return den > 0 ? num / den : null;
}

/** Mean of a per-season count over seasons where it is known. */
function seasonMean(
  rows: SeasonRow[],
  value: (row: SeasonRow) => number | null
): number | null {
  const known = rows
    .map(value)
    .filter((entry): entry is number => entry != null);
  return known.length
    ? known.reduce((sum, entry) => sum + entry, 0) / known.length
    : null;
}

/**
 * Career averages from NST's per-season player report, pooled from matched
 * components (W1 P0 #25): completed seasons only (the season in progress is
 * the window being judged, decision 34), on-ice rows matched to individual
 * rows by season and team, xS% = ixG / iFF (decision 17).
 * Assumes NST lists disjoint season (or season-team) rows with no total row;
 * that layout is not re-verified here (no provider call in the fix).
 */
export function computeCareerAverages(
  individual: ParsedTable,
  onIce: ParsedTable,
  asOf: Date = new Date()
) {
  const currentStart = currentSeasonStartYear(asOf);
  const column = (table: ParsedTable, header: string) =>
    nstHeaderIndex(table.headers, header);
  const key = (table: ParsedTable, cells: string[]) =>
    `${cells[column(table, "Season")] ?? ""}|${cells[column(table, "Team")] ?? ""}`;

  const onIceByKey = new Map<string, string[]>();
  onIce.data.forEach((cells) => onIceByKey.set(key(onIce, cells), cells));

  const rows: SeasonRow[] = individual.data
    .filter((cells) => {
      const start = seasonStartYear(cells[column(individual, "Season")]);
      return start != null && start < currentStart;
    })
    .map((cells) => {
      const onIceCells = onIceByKey.get(key(individual, cells)) ?? null;
      const cell = (table: ParsedTable, source: string[], header: string) => {
        const idx = column(table, header);
        return idx === -1 ? null : nstNumber(source[idx]);
      };
      return {
        get: (header: string) => cell(individual, cells, header),
        minutes: nstMinutes(cells[column(individual, "TOI")]),
        onIce: onIceCells
          ? (header: string) => cell(onIce, onIceCells, header)
          : null
      };
    });

  const onIceValue = (row: SeasonRow, header: string) =>
    row.onIce ? row.onIce(header) : null;
  const sum = (...parts: Array<number | null>) =>
    parts.some((part) => part == null)
      ? null
      : parts.reduce<number>((total, part) => total + (part as number), 0);
  const asPercentScale = (value: number | null) =>
    value == null ? null : value * 100;

  return {
    "S%": pooled(rows, (r) => r.get("Goals"), (r) => r.get("Shots")),
    "xS%": pooled(rows, (r) => r.get("ixG"), (r) => r.get("iFF")),
    IPP: pooled(
      rows,
      (r) => r.get("Total Points"),
      (r) => onIceValue(r, "GF")
    ),
    "oiSH%": pooled(
      rows,
      (r) => onIceValue(r, "GF"),
      (r) => onIceValue(r, "SF")
    ),
    "secA%": pooled(
      rows,
      (r) => r.get("Second Assists"),
      (r) => r.get("Total Assists")
    ),
    "Primary Assists": seasonMean(rows, (r) => r.get("First Assists")),
    "Secondary Assists": seasonMean(rows, (r) => r.get("Second Assists")),
    "Total Points": seasonMean(rows, (r) => r.get("Total Points")),
    "SOG/60": (() => {
      const rate = pooled(rows, (r) => r.get("Shots"), (r) => r.minutes);
      return rate == null ? null : rate * 60;
    })(),
    // OZS% = OZ / (OZ + DZ) (decision 9).
    "oZS%": pooled(
      rows,
      (r) => onIceValue(r, "Off. Zone Starts"),
      (r) =>
        sum(onIceValue(r, "Off. Zone Starts"), onIceValue(r, "Def. Zone Starts"))
    ),
    iHDCF: seasonMean(rows, (r) => r.get("iHDCF")),
    iSCF: seasonMean(rows, (r) => r.get("iSCF")),
    ixG: seasonMean(rows, (r) => r.get("ixG")),
    // On-ice shares keep their 0-100 scale.
    ixGpct: asPercentScale(
      pooled(
        rows,
        (r) => onIceValue(r, "xGF"),
        (r) => sum(onIceValue(r, "xGF"), onIceValue(r, "xGA"))
      )
    ),
    goals: seasonMean(rows, (r) => r.get("Goals")),
    iCFpct: asPercentScale(
      pooled(
        rows,
        (r) => onIceValue(r, "CF"),
        (r) => sum(onIceValue(r, "CF"), onIceValue(r, "CA"))
      )
    ),
    seasons: rows.length
  };
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
  return computeCareerAverages(individual, onIce);
}

export default withNstJobLifecycle(handler, "CareerAverages/[playerId]", undefined, { lazy: true });
