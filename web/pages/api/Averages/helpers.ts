// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/Averages/helpers.ts

import { HTMLElement, parse } from "node-html-parser";
import fetchWithCache from "lib/fetchWithCache";
import { YearlyCount, YearlyRate } from "./types";

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
    .map((th) => th.textContent?.trim() || "");
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

/**
 * Aggregates multiple team entries per season into a "TOT" row.
 * @param items - Array of items (counts or rates).
 * @param aggregateKeys - Keys to sum up.
 * @param calculateDerived - Function to calculate derived fields for "TOT".
 * @returns Aggregated array with "TOT" rows added.
 */
export function addTotalRows<T extends { season: number; team: string }>(
  items: T[],
  groupByKeys: (keyof T)[],
  aggregateKeys: (keyof T)[],
  calculateDerived: (tot: T) => void
): T[] {
  const seasonMap: { [season: number]: T[] } = {};

  // Group items by season
  items.forEach((item) => {
    const season = item.season;
    if (!seasonMap[season]) {
      seasonMap[season] = [];
    }
    seasonMap[season].push(item);
  });

  const aggregatedItems: T[] = [];

  Object.keys(seasonMap).forEach((seasonStr) => {
    const season = parseInt(seasonStr, 10);
    const teamItems = seasonMap[season];

    if (teamItems.length === 1) {
      // Only one team, no need to aggregate
      aggregatedItems.push(teamItems[0]);
    } else {
      // Multiple teams, aggregate stats for "TOT"
      const totItem = { ...teamItems[0] } as T;

      groupByKeys.forEach((key) => {
        // team becomes "TOT"
        if (key === "team") {
          (totItem as any)[key] = "TOT";
        }
      });

      aggregateKeys.forEach((key) => {
        (totItem as any)[key] = teamItems.reduce(
          (sum: number, it: any) =>
            sum + (typeof it[key] === "number" ? it[key] : 0),
          0
        );
      });

      // Calculate derived fields
      calculateDerived(totItem);

      aggregatedItems.push(totItem);
    }
  });

  return aggregatedItems;
}

/**
 * Parses Time on Ice (TOI) float and converts it to total seconds.
 * @param timeFloat - The TOI as a float (e.g., 1096.1666666667).
 * @returns The total time in seconds.
 */
export function parseTime(timeFloat: number): number {
  const minutes = Math.floor(timeFloat);
  const seconds = Math.round((timeFloat - minutes) * 60);
  return minutes * 60 + seconds;
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
  const URL = `https://naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=${rate}&v=p&playerid=${playerId}`;
  const html = (await fetchWithCache(URL, false)) as string;
  const document = parse(html);

  const individual = parseTable(document.getElementById("indreg"));
  const onIce = parseTable(document.getElementById("reg"));

  const individualRows = processRows(individual.data, individual.headers);
  const onIceRows = processRows(onIce.data, onIce.headers);

  return { individualRows, onIceRows };
}
