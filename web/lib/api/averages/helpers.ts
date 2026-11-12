import { requireNstJob } from "lib/nst/jobLifecycle.server";
// Shared averages API parsing helpers.

import { HTMLElement, parse } from "node-html-parser";
import { buildNstUrlString, fetchNstTextWithCacheByUrl } from "lib/nst/client";
import { parseTime } from "lib/NHL/TOI";

/**
 * Parses an HTML table and returns headers and data.
 * @param table - The HTML table element.
 * @returns An object containing headers and data rows.
 */
export function parseTable(table: HTMLElement) {
  const data: string[][] = [];
  const rows = table.getElementsByTagName("tr");

  if (rows.length <= 2) {
    throw new Error("Cannot find the player.");
  }

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const cols = [...row.childNodes]
      .filter((n) => n.nodeType !== 3)
      .map((td) => td.textContent?.trim() || "");
    data.push(cols);
  }

  const headers = [...rows[0].childNodes]
    .filter((n) => n.nodeType !== 3)
    .map((th) => (th.textContent || "").replace(/\u00a0/g, " ").trim());
  return { headers, data };
}

/**
 * Processes rows by mapping headers to row data.
 * @param rows - Array of data rows.
 * @param headers - Array of header names.
 * @returns Array of objects mapping header names to row data.
 */
export function processRows(
  rows: string[][],
  headers: string[]
): Array<{ [key: string]: string }> {
  return rows.map((row) => {
    const rowData: { [key: string]: string } = {};
    headers.forEach((header, idx) => {
      rowData[header] = row[idx];
    });
    return rowData;
  });
}

/** A numeric NST cell; "-", blanks and other non-numbers are unknown (null). */
export function nstNumber(value: string | null | undefined): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Declared TOI adapter (nst-playerreport-toi-v1): NST's player report prints
 * TOI as decimal minutes ("1400.5"); this returns seconds, or null when the
 * cell is unknown. Every per-60 in this service divides by these seconds.
 */
export function nstToiSeconds(value: string | null | undefined): number | null {
  const minutes = parseTime(value);
  return Number.isFinite(minutes) ? minutes * 60 : null;
}

/** count × 3600 ÷ seconds; null when either is unknown or seconds ≤ 0. */
export function perSixty(
  count: number | null,
  seconds: number | null
): number | null {
  return count == null || seconds == null || seconds <= 0
    ? null
    : (count * 3600) / seconds;
}

/** numerator ÷ denominator on 0-100 points; null when unknown or denominator ≤ 0. */
export function sharePoints(
  numerator: number | null,
  denominator: number | null
): number | null {
  return numerator == null || denominator == null || denominator <= 0
    ? null
    : (numerator / denominator) * 100;
}

/** Sum of parts; null when any part is unknown. */
export function sumKnown(...parts: Array<number | null>): number | null {
  let total = 0;
  for (const part of parts) {
    if (part == null) return null;
    total += part;
  }
  return total;
}

/** Start year of the season in progress (or about to start) on `asOf`. */
export function currentSeasonStartYear(asOf: Date): number {
  const year = asOf.getUTCFullYear();
  return asOf.getUTCMonth() >= 6 ? year : year - 1;
}

/**
 * Seasons the averages use: completed regular seasons (NST "20232024"
 * labels) before the season in progress on `asOf`, newest first; the newest
 * three for three-year averages. The newest season in the data is kept when
 * it is complete (a player with no current-season row).
 */
export function seasonsForAverages(
  seasons: number[],
  isThreeYear: boolean,
  asOf: Date
): number[] {
  const current = currentSeasonStartYear(asOf);
  const completed = Array.from(new Set(seasons))
    .filter((season) => Math.floor(season / 10000) < current)
    .sort((a, b) => b - a);
  const chosen = isThreeYear ? completed.slice(0, 3) : completed;
  if (isThreeYear && chosen.length < 3) {
    throw new Error(
      "Not enough completed seasons to calculate three-year averages."
    );
  }
  if (!isThreeYear && chosen.length < 1) {
    throw new Error("Not enough seasons to calculate career averages.");
  }
  return chosen;
}

/**
 * Fetches and parses player data.
 * @param playerId - The player's unique identifier.
 * @param rate - Whether to fetch rate data (`y`) or count data (`n`).
 * @returns Parsed individual and on-ice rows.
 */
export async function fetchPlayerData(
  playerId: string,
  rate: string
): Promise<{
  individualRows: Array<{ [key: string]: string }>;
  onIceRows: Array<{ [key: string]: string }>;
}> {
  requireNstJob();
  const URL = buildNstUrlString("playerreport.php", {
    stype: 2,
    sit: "all",
    stdoi: "std",
    rate,
    v: "p",
    playerid: playerId
  });
  const { text: html } = await fetchNstTextWithCacheByUrl(URL);
  const document = parse(html);

  const individual = parseTable(document.getElementById("indreg"));
  const onIce = parseTable(document.getElementById("reg"));

  const individualRows = processRows(individual.data, individual.headers);
  const onIceRows = processRows(onIce.data, onIce.headers);

  return { individualRows, onIceRows };
}
