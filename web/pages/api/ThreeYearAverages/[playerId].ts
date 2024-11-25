// Import statements remain unchanged
import type { NextApiRequest, NextApiResponse } from "next";
import { HTMLElement, parse } from "node-html-parser";

import fetchWithCache from "lib/fetchWithCache";

// DATA TO BE CONSIDERED FOR 3 YEAR STATS AVERAGE
export type Data = {
  // Existing counting stats
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
  GP: number | null;
  A1: number | null;
  A2: number | null;
  SOG: number | null;
  PIM: number | null;
  HIT: number | null;
  BLK: number | null;
  iCF: number | null;
  CF: number | null;
  iFF: number | null;

  // **New Counting Stats**
  toi: number | null;
  GF: number | null;
  GA: number | null;
  "GF%": number | null;
  SCF: number | null;
  SCA: number | null;
  "SCF%": number | null;
  oiGF: number | null;
  assists: number | null;
  CA: number | null;
  "CF%": number | null;
  FF: number | null;
  FA: number | null;
  "FF%": number | null;
  SF: number | null;
  SA: number | null;
  "SF%": number | null;
  xGF: number | null;
  xGA: number | null;
  "xGF%": number | null;
  HDCF: number | null;
  HDGF: number | null;
  MDCF: number | null;
  MDGF: number | null;
  LDCF: number | null;
  LDGF: number | null;
  oZS: number | null;
  dZS: number | null;
};

export type RatesData = {
  "CF/60": number | null;
  "CA/60": number | null;
  "CF%": number | null;
  "iSCF/60": number | null;
  "PTS/60": number | null;
  "SOG/60": number | null;
  "A/60": number | null;
  "G/60": number | null;
  "GF/60": number | null;
  "GA/60": number | null;
  "GF%": number | null;
  "A1/60": number | null;
  "A2/60": number | null;
  "SF/60": number | null;
  "SA/60": number | null;
  "SF%": number | null;
  "SCF/60": number | null;
  "SCA/60": number | null;
  "SCF%": number | null;
  "iCF/60": number | null;
  "iFF/60": number | null;
  "FF/60": number | null;
  "FA/60": number | null;
  "FF%": number | null;
  "ixG/60": number | null;
  "xGF/60": number | null;
  "xGA/60": number | null;
  "xGF%": number | null;
  "HDCF/60": number | null;
  "HDGF/60": number | null;
  "MDCF/60": number | null;
  "MDGF/60": number | null;
  "LDCF/60": number | null;
  "LDGF/60": number | null;
  "PIM/60": number | null;
  "HIT/60": number | null;
  "BLK/60": number | null;
};

// ALL STRENGTHS INDIVIDUAL COUNTS
interface YearlyCount {
  season: number;
  team: string;
  TOI: number; // Total seconds
  GF: number; // Goals For
  GA: number; // Goals Against
  "GF%": number; // Goals For Percentage
  "S%": number;
  "oiSH%": number;
  "secA%": number;
  iHDCF: number;
  goals: number;
  "SOG/60": number;
  IPP: number;
  "oZS%": number;
  GP: number;
  oiGF: number;
  assists: number;
  A1: number;
  A2: number;
  SOG: number;
  PIM: number;
  HIT: number;
  BLK: number;
  iCF: number;
  CF: number;
  CA: number;
  "CF%": number;
  iFF: number;
  FF: number;
  FA: number;
  "FF%": number;
  SF: number;
  SA: number;
  "SF%": number;
  ixG: number;
  xGF: number;
  xGA: number;
  "xGF%": number;
  iSCF: number;
  SCF: number;
  SCA: number;
  "SCF%": number;
  HDCF: number;
  HDGF: number;
  MDCF: number;
  MDGF: number;
  LDCF: number;
  LDGF: number;
  oZS: number;
  dZS: number;
}

interface YearlyCounts {
  counts: YearlyCount[];
}

interface YearlyRate {
  season: number;
  team: string;
  TOI: number; // Total seconds
  "CF/60": number;
  "CA/60": number;
  "CF%": number;
  "iSCF/60": number;
  "PTS/60": number;
  "G/60": number;
  "GF/60": number;
  "GA/60": number;
  "GF%": number;
  "A/60": number;
  "A1/60": number;
  "A2/60": number;
  "SOG/60": number;
  "SF/60": number;
  "SA/60": number;
  "SF%": number;
  "SCF/60": number;
  "SCA/60": number;
  "SCF%": number;
  "iCF/60": number;
  "iFF/60": number;
  "FF/60": number;
  "FA/60": number;
  "FF%": number;
  "ixG/60": number;
  "xGF/60": number;
  "xGA/60": number;
  "xGF%": number;
  "HDCF/60": number;
  "HDGF/60": number;
  "MDCF/60": number;
  "MDGF/60": number;
  "LDCF/60": number;
  "LDGF/60": number;
  "PIM/60": number;
  "HIT/60": number;
  "BLK/60": number;
}

interface YearlyRates {
  rates: YearlyRate[];
}

// Extend the Response type to include career averages
type Response = {
  message: string;
  success: boolean;
  yearlyCounts?: YearlyCounts;
  threeYearCountsAverages?: Data;
  careerAverageCounts?: Data;

  yearlyRates?: YearlyRates;
  threeYearRatesAverages?: RatesData;
  careerAverageRates?: RatesData;
};

/**
 * Parses a Time on Ice (TOI) float and converts it to total seconds.
 * @param timeFloat - The TOI as a float (e.g., 1096.1666666667).
 * @returns The total time in seconds.
 */
export function parseTime(timeFloat: number): number {
  const minutes = Math.floor(timeFloat);
  const seconds = Math.round((timeFloat - minutes) * 60);
  return minutes * 60 + seconds;
}

export default async function handler(
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
    // Fetch three-year counting stats
    const { yearlyCounts, threeYearCountsAverages } = await GetThreeYearStats(
      playerId as string
    );

    // Fetch three-year rate stats
    const { yearlyRates, threeYearRatesAverages } = await GetThreeYearRates(
      playerId as string
    );

    // Fetch career counting stats
    const { yearlyCounts: careerYearlyCounts, careerAverageCounts } =
      await GetCareerStats(playerId as string);

    // Fetch career rate stats
    const { yearlyRates: careerYearlyRates, careerAverageRates } =
      await GetCareerRates(playerId as string);

    res.json({
      success: true,
      message:
        "Successfully fetched the career and three-year averages stats for player: " +
        playerId,
      yearlyCounts,
      threeYearCountsAverages,
      yearlyRates,
      threeYearRatesAverages,

      // **Include the Career Averages**
      careerAverageCounts,
      careerAverageRates
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
      .map((td) => td.textContent?.trim() || "");
    data.push(cols);
  }

  const headers = [...rows[0].childNodes]
    .filter((n) => n.nodeType !== 3)
    .map((th) => th.textContent?.trim() || "");
  return { headers, data };
}

/**
 * Processes rows without grouping, ensuring each row is unique by Season and Team.
 * @param rows - Array of data rows.
 * @param headers - Array of header names corresponding to each column.
 * @returns An array of processed rows with Season and Team.
 */
function processRows(
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
 * Aggregates multiple team entries per season into a "TOT" row for yearlyCounts.
 * @param counts - Array of YearlyCount objects.
 * @returns Array with "TOT" rows added.
 */
function addTotalRows(counts: YearlyCount[]): YearlyCount[] {
  const seasonMap: { [season: number]: YearlyCount[] } = {};

  // Group counts by season
  counts.forEach((count) => {
    if (!seasonMap[count.season]) {
      seasonMap[count.season] = [];
    }
    seasonMap[count.season].push(count);
  });

  const aggregatedCounts: YearlyCount[] = [];

  Object.keys(seasonMap).forEach((seasonStr) => {
    const season = parseInt(seasonStr, 10);
    const teamCounts = seasonMap[season];

    if (teamCounts.length === 1) {
      // Only one team, no need to aggregate
      aggregatedCounts.push(teamCounts[0]);
    } else {
      // Multiple teams, aggregate stats for "TOT"
      const totCount: YearlyCount = {
        season: season,
        team: "TOT",
        TOI: 0,
        GF: 0,
        GA: 0,
        "GF%": 0,
        SCF: 0,
        SCA: 0,
        "SCF%": 0,
        "S%": 0,
        "oiSH%": 0,
        "secA%": 0,
        iHDCF: 0,
        goals: 0,
        SOG: 0,
        "SOG/60": 0,
        IPP: 0,
        "oZS%": 0,
        GP: 0,
        oiGF: 0,
        assists: 0,
        A1: 0,
        A2: 0,
        PIM: 0,
        HIT: 0,
        BLK: 0,
        iCF: 0,
        CF: 0,
        CA: 0,
        "CF%": 0,
        iFF: 0,
        FF: 0,
        FA: 0,
        "FF%": 0,
        SF: 0,
        SA: 0,
        "SF%": 0,
        ixG: 0,
        xGF: 0,
        xGA: 0,
        "xGF%": 0,
        iSCF: 0,
        HDCF: 0,
        HDGF: 0,
        MDCF: 0,
        MDGF: 0,
        LDCF: 0,
        LDGF: 0,
        oZS: 0,
        dZS: 0
      };

      teamCounts.forEach((count) => {
        // Summing statistics
        totCount.TOI += count.TOI;

        totCount.iHDCF += count.iHDCF;
        totCount.goals += count.goals;
        totCount.SOG += count.SOG;

        totCount.assists += count.assists;
        totCount.oiGF += count.oiGF;

        totCount.GP += count.GP;
        totCount.A1 += count.A1;
        totCount.A2 += count.A2;
        totCount.SOG += count.SOG;
        totCount.PIM += count.PIM;
        totCount.HIT += count.HIT;
        totCount.BLK += count.BLK;
        totCount.iCF += count.iCF;
        totCount.CF += count.CF;
        totCount.CA += count.CA;
        totCount.iFF += count.iFF;
        totCount.FF += count.FF;
        totCount.FA += count.FA;
        totCount.SF += count.SF;
        totCount.SA += count.SA;
        totCount.GF += count.GF;
        totCount.GA += count.GA;
        totCount.ixG += count.ixG;
        totCount.xGF += count.xGF;
        totCount.xGA += count.xGA;
        totCount.iSCF += count.iSCF;
        totCount.SCF += count.SCF;
        totCount.SCA += count.SCA;
        totCount.HDCF += count.HDCF;
        totCount.HDGF += count.HDGF;
        totCount.MDCF += count.MDCF;
        totCount.MDGF += count.MDGF;
        totCount.LDCF += count.LDCF;
        totCount.LDGF += count.LDGF;
        totCount.oZS += count.oZS;
        totCount.dZS += count.dZS;
      });

      // Recalculate summary statistics for "TOT"
      totCount["S%"] = totCount.goals / (totCount.SOG || 1);
      totCount["secA%"] = totCount.A2 / (totCount.assists || 1);
      totCount["oZS%"] = totCount.oZS / (totCount.oZS + totCount.dZS || 1);
      totCount["SOG/60"] = (totCount.SOG / totCount.TOI) * 60 || 0;
      totCount["oiSH%"] = totCount.oiGF / (totCount.SF || 1);
      totCount["IPP"] =
        (totCount.goals + totCount.assists) / (totCount.oiGF || 1);
      totCount["GF%"] = totCount.GF / (totCount.GF + totCount.GA || 1);
      totCount["CF%"] = totCount.CF / (totCount.CF + totCount.CA || 1);
      totCount["FF%"] = totCount.FF / (totCount.FF + totCount.FA || 1);
      totCount["SF%"] = totCount.SF / (totCount.SF + totCount.SA || 1);
      totCount["SCF%"] = totCount.SCF / (totCount.SCF + totCount.SCA || 1);
      totCount["xGF%"] = totCount.xGF / (totCount.xGF + totCount.xGA || 1);

      // **Optional**: Recalculate other dependent stats if necessary

      // Add the "TOT" row to aggregated counts
      aggregatedCounts.push(totCount);
    }
  });

  return aggregatedCounts;
}

/**
 * Aggregates multiple team entries per season into a "TOT" row for yearlyRates.
 * Computes percentages using specified formulas instead of averaging.
 * @param rates - Array of YearlyRate objects.
 * @returns Array with "TOT" rows added.
 */
function addTotalRateRows(rates: YearlyRate[]): YearlyRate[] {
  const seasonMap: { [season: number]: YearlyRate[] } = {};

  // Group rates by season
  rates.forEach((rate) => {
    if (!seasonMap[rate.season]) {
      seasonMap[rate.season] = [];
    }
    seasonMap[rate.season].push(rate);
  });

  const aggregatedRates: YearlyRate[] = [];

  Object.keys(seasonMap).forEach((seasonStr) => {
    const season = parseInt(seasonStr, 10);
    const teamRates = seasonMap[season];

    if (teamRates.length === 1) {
      // Only one team, no need to aggregate
      aggregatedRates.push(teamRates[0]);
    } else {
      // Multiple teams, aggregate stats for "TOT"
      const totRate: YearlyRate = {
        season: season,
        team: "TOT",
        TOI: 0,
        "CF/60": 0,
        "CA/60": 0,
        "CF%": 0,
        "iSCF/60": 0,
        "PTS/60": 0,
        "G/60": 0,
        "GF/60": 0,
        "GA/60": 0,
        "GF%": 0,
        "A/60": 0,
        "A1/60": 0,
        "A2/60": 0,
        "SOG/60": 0,
        "SF/60": 0,
        "SA/60": 0,
        "SF%": 0,
        "SCF/60": 0,
        "SCA/60": 0,
        "SCF%": 0,
        "iCF/60": 0,
        "iFF/60": 0,
        "FF/60": 0,
        "FA/60": 0,
        "FF%": 0,
        "ixG/60": 0,
        "xGF/60": 0,
        "xGA/60": 0,
        "xGF%": 0,
        "HDCF/60": 0,
        "HDGF/60": 0,
        "MDCF/60": 0,
        "MDGF/60": 0,
        "LDCF/60": 0,
        "LDGF/60": 0,
        "PIM/60": 0,
        "HIT/60": 0,
        "BLK/60": 0
      };

      // Aggregate raw counts and TOI
      teamRates.forEach((rate) => {
        totRate.TOI += rate.TOI;

        // Sum raw counts corresponding to each "/60" stat
        totRate["CF/60"] += (rate["CF/60"] * rate.TOI) / 3600;
        totRate["CA/60"] += (rate["CA/60"] * rate.TOI) / 3600;
        totRate["iSCF/60"] += (rate["iSCF/60"] * rate.TOI) / 3600;
        totRate["PTS/60"] += (rate["PTS/60"] * rate.TOI) / 3600;
        totRate["G/60"] += (rate["G/60"] * rate.TOI) / 3600;
        totRate["GF/60"] += (rate["GF/60"] * rate.TOI) / 3600;
        totRate["GA/60"] += (rate["GA/60"] * rate.TOI) / 3600;
        totRate["A/60"] += (rate["A/60"] * rate.TOI) / 3600;
        totRate["A1/60"] += (rate["A1/60"] * rate.TOI) / 3600;
        totRate["A2/60"] += (rate["A2/60"] * rate.TOI) / 3600;
        totRate["SOG/60"] += (rate["SOG/60"] * rate.TOI) / 3600;
        totRate["SF/60"] += (rate["SF/60"] * rate.TOI) / 3600;
        totRate["SA/60"] += (rate["SA/60"] * rate.TOI) / 3600;
        totRate["SCF/60"] += (rate["SCF/60"] * rate.TOI) / 3600;
        totRate["SCA/60"] += (rate["SCA/60"] * rate.TOI) / 3600;
        totRate["iCF/60"] += (rate["iCF/60"] * rate.TOI) / 3600;
        totRate["iFF/60"] += (rate["iFF/60"] * rate.TOI) / 3600;
        totRate["FF/60"] += (rate["FF/60"] * rate.TOI) / 3600;
        totRate["FA/60"] += (rate["FA/60"] * rate.TOI) / 3600;
        totRate["ixG/60"] += (rate["ixG/60"] * rate.TOI) / 3600;
        totRate["xGF/60"] += (rate["xGF/60"] * rate.TOI) / 3600;
        totRate["xGA/60"] += (rate["xGA/60"] * rate.TOI) / 3600;
        totRate["HDCF/60"] += (rate["HDCF/60"] * rate.TOI) / 3600;
        totRate["HDGF/60"] += (rate["HDGF/60"] * rate.TOI) / 3600;
        totRate["MDCF/60"] += (rate["MDCF/60"] * rate.TOI) / 3600;
        totRate["MDGF/60"] += (rate["MDGF/60"] * rate.TOI) / 3600;
        totRate["LDCF/60"] += (rate["LDCF/60"] * rate.TOI) / 3600;
        totRate["LDGF/60"] += (rate["LDGF/60"] * rate.TOI) / 3600;
        totRate["PIM/60"] += (rate["PIM/60"] * rate.TOI) / 3600;
        totRate["HIT/60"] += (rate["HIT/60"] * rate.TOI) / 3600;
        totRate["BLK/60"] += (rate["BLK/60"] * rate.TOI) / 3600;
      });

      // Recompute "/60" stats based on aggregated TOI
      if (totRate.TOI > 0) {
        totRate["CF/60"] = (totRate["CF/60"] / totRate.TOI) * 3600;
        totRate["CA/60"] = (totRate["CA/60"] / totRate.TOI) * 3600;
        totRate["iSCF/60"] = (totRate["iSCF/60"] / totRate.TOI) * 3600;
        totRate["PTS/60"] = (totRate["PTS/60"] / totRate.TOI) * 3600;
        totRate["G/60"] = (totRate["G/60"] / totRate.TOI) * 3600;
        totRate["GF/60"] = (totRate["GF/60"] / totRate.TOI) * 3600;
        totRate["GA/60"] = (totRate["GA/60"] / totRate.TOI) * 3600;
        totRate["A/60"] = (totRate["A/60"] / totRate.TOI) * 3600;
        totRate["A1/60"] = (totRate["A1/60"] / totRate.TOI) * 3600;
        totRate["A2/60"] = (totRate["A2/60"] / totRate.TOI) * 3600;
        totRate["SOG/60"] = (totRate["SOG/60"] / totRate.TOI) * 3600;
        totRate["SF/60"] = (totRate["SF/60"] / totRate.TOI) * 3600;
        totRate["SA/60"] = (totRate["SA/60"] / totRate.TOI) * 3600;
        totRate["SCF/60"] = (totRate["SCF/60"] / totRate.TOI) * 3600;
        totRate["SCA/60"] = (totRate["SCA/60"] / totRate.TOI) * 3600;
        totRate["iCF/60"] = (totRate["iCF/60"] / totRate.TOI) * 3600;
        totRate["iFF/60"] = (totRate["iFF/60"] / totRate.TOI) * 3600;
        totRate["FF/60"] = (totRate["FF/60"] / totRate.TOI) * 3600;
        totRate["FA/60"] = (totRate["FA/60"] / totRate.TOI) * 3600;
        totRate["ixG/60"] = (totRate["ixG/60"] / totRate.TOI) * 3600;
        totRate["xGF/60"] = (totRate["xGF/60"] / totRate.TOI) * 3600;
        totRate["xGA/60"] = (totRate["xGA/60"] / totRate.TOI) * 3600;
        totRate["HDCF/60"] = (totRate["HDCF/60"] / totRate.TOI) * 3600;
        totRate["HDGF/60"] = (totRate["HDGF/60"] / totRate.TOI) * 3600;
        totRate["MDCF/60"] = (totRate["MDCF/60"] / totRate.TOI) * 3600;
        totRate["MDGF/60"] = (totRate["MDGF/60"] / totRate.TOI) * 3600;
        totRate["LDCF/60"] = (totRate["LDCF/60"] / totRate.TOI) * 3600;
        totRate["LDGF/60"] = (totRate["LDGF/60"] / totRate.TOI) * 3600;
        totRate["PIM/60"] = (totRate["PIM/60"] / totRate.TOI) * 3600;
        totRate["HIT/60"] = (totRate["HIT/60"] / totRate.TOI) * 3600;
        totRate["BLK/60"] = (totRate["BLK/60"] / totRate.TOI) * 3600;
      }

      // Now compute the percentages using the provided formulas
      // Ensure that denominators are not zero to avoid division by zero errors

      totRate["GF%"] =
        totRate["GF/60"] / (totRate["GF/60"] + totRate["GA/60"]) || 0;

      totRate["CF%"] =
        totRate["CF/60"] / (totRate["CF/60"] + totRate["CA/60"]) || 0;

      totRate["SF%"] =
        totRate["SF/60"] / (totRate["SF/60"] + (totRate["SA/60"] || 0)) || 0;

      totRate["FF%"] =
        totRate["FF/60"] / (totRate["FF/60"] + (totRate["FA/60"] || 0)) || 0;

      totRate["xGF%"] =
        totRate["xGF/60"] / (totRate["xGF/60"] + (totRate["xGA/60"] || 0)) || 0;

      totRate["SCF%"] =
        totRate["SCF/60"] / (totRate["SCF/60"] + totRate["SCA/60"]) || 0;

      // Add the "TOT" row to aggregated rates
      aggregatedRates.push(totRate);
    }
  });

  return aggregatedRates;
}

/**
 * Computes three-year averages for counting stats without strictly requiring "TOT" rows.
 * Uses "TOT" if available; otherwise, uses the single team row.
 * @param playerId - The player's unique identifier.
 * @returns An object containing yearly counts and three-year averages.
 */
async function GetThreeYearStats(playerId: string): Promise<{
  yearlyCounts: YearlyCounts;
  threeYearCountsAverages: Data;
}> {
  const URL = `https://naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=n&v=p&playerid=${playerId}`;
  const html = (await fetchWithCache(URL, false)) as string;
  const document = parse(html);

  const individual = parseTable(document.getElementById("indreg"));
  const onIce = parseTable(document.getElementById("reg"));

  const individualRows = processRows(individual.data, individual.headers);
  const onIceRows = processRows(onIce.data, onIce.headers);

  // Initialize the object to hold all yearly data
  let yearData: YearlyCounts = { counts: [] };

  // Populate yearlyCounts with all rows
  individualRows.forEach((individualRow) => {
    const season = Number(individualRow["Season"]);
    const team = individualRow["Team"]; // Ensure "Team" column exists

    // Find corresponding on-ice row
    const onIceRow = onIceRows.find(
      (row) => Number(row["Season"]) === season && row["Team"] === team
    );

    if (!onIceRow) {
      // Handle missing on-ice data if necessary
      throw new Error(
        `Missing on-ice data for Season ${season} and Team ${team}.`
      );
    }

    yearData.counts.push({
      // Individual Table
      // Counts
      season: season,
      team: team,
      SOG: Number(individualRow["Shots"]) || 0,
      TOI: parseTime(Number(individualRow["TOI"])), // Total seconds
      SF: Number(onIceRow["SF"]) || 0, // Shots For
      SA: Number(onIceRow["SA"]) || 0, // Shots Against
      "SF%": Number(onIceRow["SF%"]) / 100, // Shots For Percentage
      GF: Number(onIceRow["GF"]) || 0, // Goals For
      GA: Number(onIceRow["GA"]) || 0, // Goals Against
      "GF%": Number(onIceRow["GF%"]) / 100, // Goals For Percentage
      SCF: Number(onIceRow["SCF"]) || 0, // Shot Contributions For
      SCA: Number(onIceRow["SCA"]) || 0, // Shot-Creating Actions
      "SCF%": Number(onIceRow["SCF%"]) / 100,
      "S%": Number(individualRow["S%"]) / 100,
      "oiSH%": Number(onIceRow["On-Ice SH%"]) / 100,
      "secA%":
        Number(individualRow["Second Assists"]) /
          Number(individualRow["Total Assists"]) || 0,
      iHDCF: Number(individualRow["iHDCF"]) || 0,
      goals: Number(individualRow["Goals"]) || 0,
      "SOG/60":
        (Number(individualRow["Shots"]) /
          parseTime(Number(individualRow["TOI"]))) *
          60 || 0,
      IPP: Number(individualRow["IPP"]) / 100 || 0,
      "oZS%": Number(onIceRow["Off. Zone Start %"]) / 100 || 0,
      GP: Number(individualRow["GP"]) || 0,
      oiGF: Number(onIceRow["GF"]) || 0,
      assists: Number(individualRow["Total Assists"]) || 0,
      A1: Number(individualRow["First Assists"]) || 0,
      A2: Number(individualRow["Second Assists"]) || 0,
      PIM: Number(individualRow["PIM"]) || 0,
      HIT: Number(individualRow["Hits"]) || 0,
      BLK: Number(individualRow["Shots Blocked"]) || 0,
      iCF: Number(individualRow["iCF"]) || 0,
      CF: Number(onIceRow["CF"]) || 0,
      CA: Number(onIceRow["CA"]) || 0,
      "CF%": Number(onIceRow["CF%"]) || 0,
      iFF: Number(individualRow["iFF"]) || 0,
      FF: Number(onIceRow["FF"]) || 0,
      FA: Number(onIceRow["FA"]) || 0,
      "FF%": Number(onIceRow["FF%"]) || 0,
      ixG: Number(individualRow["ixG"]) || 0,
      xGF: Number(onIceRow["xGF"]) || 0,
      xGA: Number(onIceRow["xGA"]) || 0,
      "xGF%": Number(onIceRow["xG%"]) || 0,
      iSCF: Number(individualRow["iSCF"]) || 0,
      HDCF: Number(onIceRow["HDCF"]) || 0,
      HDGF: Number(onIceRow["HDGF"]) || 0,
      MDCF: Number(onIceRow["MDCF"]) || 0,
      MDGF: Number(onIceRow["MDGF"]) || 0,
      LDCF: Number(onIceRow["LDCF"]) || 0,
      LDGF: Number(onIceRow["LDGF"]) || 0,
      oZS: Number(onIceRow["Off. Zone Starts"]) || 0,
      dZS: Number(onIceRow["Def. Zone Starts"]) || 0
    });
  });

  // Aggregate "TOT" rows
  yearData.counts = addTotalRows(yearData.counts);

  // Identify all unique seasons and sort them in descending order
  const allSeasons = Array.from(
    new Set(yearData.counts.map((count) => count.season))
  ).sort((a, b) => b - a);
  const currentSeason = allSeasons[0];

  // Select the last three seasons prior to the current season
  const seasonsToAverage = allSeasons
    .filter((season) => season !== currentSeason)
    .slice(0, 3);

  if (seasonsToAverage.length < 3) {
    throw new Error(
      "Not enough prior seasons to calculate three-year averages."
    );
  }

  // **Updated Selection Logic**
  // For each season to average, select "TOT" row if exists; otherwise, use the single team row.
  const countsForAverages: YearlyCount[] = seasonsToAverage.map((season) => {
    const totRow = yearData.counts.find(
      (count) => count.season === season && count.team === "TOT"
    );
    if (totRow) {
      return totRow;
    } else {
      // Find the single team row for the season
      const singleRow = yearData.counts.find(
        (count) => count.season === season && count.team !== "TOT"
      );
      if (singleRow) {
        return singleRow;
      } else {
        throw new Error(
          `No data available for Season ${season} to calculate three-year averages.`
        );
      }
    }
  });

  // **Aggregate Counting Stats**
  const countingStats = [
    "iHDCF",
    "ixG",
    "goals",
    "GP",
    "A1",
    "A2",
    "SOG",
    "PIM",
    "HIT",
    "BLK",
    "iCF",
    "CF",
    "CA",
    "iFF",
    "FF",
    "FA",
    "TOI",
    "SF",
    "SA",
    "GF",
    "GA",
    "SCF",
    "SCA",
    "oiGF",
    "assists",
    "xGF",
    "xGA",
    "iSCF",
    "HDCF",
    "HDGF",
    "MDCF",
    "MDGF",
    "LDCF",
    "LDGF",
    "oZS",
    "dZS"
  ] as const;

  const aggregatedCountingStats: {
    [key in
      | typeof countingStats[number]
      | "IPP"
      | "S%"
      | "xS%"
      | "SOG/60"
      | "oZS%"
      | "oiSH%"
      | "secA%"]: number;
  } = {
    iHDCF: 0,
    ixG: 0,
    goals: 0,
    GP: 0,
    A1: 0,
    A2: 0,
    SOG: 0,
    PIM: 0,
    HIT: 0,
    BLK: 0,
    iCF: 0,
    CF: 0,
    CA: 0,
    iFF: 0,
    FF: 0,
    FA: 0,
    TOI: 0,
    SF: 0,
    SA: 0,
    GF: 0,
    GA: 0,
    SCF: 0,
    SCA: 0,
    oiGF: 0,
    assists: 0,
    xGF: 0,
    xGA: 0,
    iSCF: 0,
    HDCF: 0,
    HDGF: 0,
    MDCF: 0,
    MDGF: 0,
    LDCF: 0,
    LDGF: 0,
    oZS: 0,
    dZS: 0,
    IPP: 0,

    // **Add the Missing Properties Below**
    "S%": 0,
    "xS%": 0,
    "SOG/60": 0,
    "oZS%": 0,
    "oiSH%": 0,
    "secA%": 0
  };

  countingStats.forEach((stat) => {
    countsForAverages.forEach((count) => {
      aggregatedCountingStats[stat] += count[stat];
    });
    // Calculate the average by dividing by 3
    aggregatedCountingStats[stat] /= 3;
  });

  // **Calculate Rate Stats Based on Aggregated Totals**

  // For accurate rate stats, we need the total counts across the 3 seasons
  const totalCounts: { [key: string]: number } = {
    goals: countsForAverages.reduce((sum, count) => sum + count.goals, 0),
    GP: countsForAverages.reduce((sum, count) => sum + count.GP, 0),
    SOG: countsForAverages.reduce((sum, count) => sum + count.SOG, 0),
    ixG: countsForAverages.reduce((sum, count) => sum + count.ixG, 0),
    assists: countsForAverages.reduce((sum, count) => sum + count.assists, 0),
    oiGF: countsForAverages.reduce((sum, count) => sum + count.oiGF, 0),
    GF: countsForAverages.reduce((sum, count) => sum + count.GF, 0),
    GA: countsForAverages.reduce((sum, count) => sum + count.GA, 0),
    A1: countsForAverages.reduce((sum, count) => sum + count.A1, 0),
    A2: countsForAverages.reduce((sum, count) => sum + count.A2, 0),
    SF: countsForAverages.reduce((sum, count) => sum + count.SF, 0),
    SA: countsForAverages.reduce((sum, count) => sum + count.SA, 0),
    oZS: countsForAverages.reduce((sum, count) => sum + count.oZS, 0),
    dZS: countsForAverages.reduce((sum, count) => sum + count.dZS, 0),
    SCF: countsForAverages.reduce((sum, count) => sum + count.SCF, 0),
    SCA: countsForAverages.reduce((sum, count) => sum + count.SCA, 0),
    FF: countsForAverages.reduce((sum, count) => sum + count.FF, 0),
    FA: countsForAverages.reduce((sum, count) => sum + count.FA, 0),
    xGF: countsForAverages.reduce((sum, count) => sum + count.xGF, 0),
    xGA: countsForAverages.reduce((sum, count) => sum + count.xGA, 0)
  };

  // Prevent division by zero by using conditional checks
  const rateAverages: { [key in keyof Data]?: number } = {};

  // **Rate Stat Calculations**
  rateAverages["S%"] = totalCounts.goals / (totalCounts.SOG || 1);
  rateAverages["xS%"] = totalCounts.ixG / (totalCounts.SOG || 1);
  rateAverages["IPP"] =
    (totalCounts.goals + totalCounts.assists) / (totalCounts.oiGF || 1);
  rateAverages["oiSH%"] = totalCounts.oiGF / (aggregatedCountingStats.SF || 1);
  rateAverages["oZS%"] =
    totalCounts.oZS / (totalCounts.oZS + totalCounts.dZS || 1);
  rateAverages["secA%"] = totalCounts.A2 / (totalCounts.assists || 1);
  rateAverages["SOG/60"] =
    (totalCounts.SOG / aggregatedCountingStats.TOI) * 60 || 0;
  rateAverages["FF%"] =
    totalCounts.FF / (totalCounts.FF + totalCounts.FA || 1) || 0;
  rateAverages["SF%"] =
    totalCounts.SF / (totalCounts.SF + totalCounts.SA || 1) || 0;
  rateAverages["GF%"] =
    totalCounts.GF / (totalCounts.GF + totalCounts.GA || 1) || 0;
  rateAverages["xGF%"] =
    totalCounts.xGF / (totalCounts.xGF + totalCounts.xGA || 1) || 0;
  rateAverages["SCF%"] =
    totalCounts.SCF / (totalCounts.SCF + totalCounts.SCA || 1) || 0;

  // **Populate the Data Object**
  const data: Data = {
    // **Counting Stats Averages**
    toi: aggregatedCountingStats.TOI,
    iHDCF: aggregatedCountingStats.iHDCF,
    iSCF: aggregatedCountingStats.iSCF,
    ixG: aggregatedCountingStats.ixG,
    oiGF: aggregatedCountingStats.oiGF,
    goals: aggregatedCountingStats.goals,
    assists: aggregatedCountingStats.assists,
    GP: aggregatedCountingStats.GP,
    A1: aggregatedCountingStats.A1,
    A2: aggregatedCountingStats.A2,
    SOG: aggregatedCountingStats.SOG,
    PIM: aggregatedCountingStats.PIM,
    HIT: aggregatedCountingStats.HIT,
    BLK: aggregatedCountingStats.BLK,
    iCF: aggregatedCountingStats.iCF,
    iFF: aggregatedCountingStats.iFF,

    // **New Counting Stats Averages**
    GF: aggregatedCountingStats.GF,
    GA: aggregatedCountingStats.GA,
    SCF: aggregatedCountingStats.SCF,
    SCA: aggregatedCountingStats.SCA,
    CF: aggregatedCountingStats.CF,
    CA: aggregatedCountingStats.CA,
    FF: aggregatedCountingStats.FF,
    FA: aggregatedCountingStats.FA,
    SF: aggregatedCountingStats.SF,
    SA: aggregatedCountingStats.SA,
    xGF: aggregatedCountingStats.xGF,
    xGA: aggregatedCountingStats.xGA,
    HDCF: aggregatedCountingStats.HDCF,
    HDGF: aggregatedCountingStats.HDGF,
    MDCF: aggregatedCountingStats.MDCF,
    MDGF: aggregatedCountingStats.MDGF,
    LDCF: aggregatedCountingStats.LDCF,
    LDGF: aggregatedCountingStats.LDGF,
    oZS: aggregatedCountingStats.oZS,
    dZS: aggregatedCountingStats.dZS,

    // **New Rate Stats Calculated from Aggregated Totals**
    "CF%":
      aggregatedCountingStats.CF /
      (aggregatedCountingStats.CF + aggregatedCountingStats.CA || 1),
    "FF%":
      aggregatedCountingStats.FF /
      (aggregatedCountingStats.FF + aggregatedCountingStats.FA || 1),
    "SF%":
      aggregatedCountingStats.SF /
      (aggregatedCountingStats.SF + aggregatedCountingStats.SA || 1),
    "GF%":
      aggregatedCountingStats.GF /
      (aggregatedCountingStats.GF + aggregatedCountingStats.GA || 1),
    "xGF%":
      aggregatedCountingStats.xGF /
      (aggregatedCountingStats.xGF + aggregatedCountingStats.xGA || 1),
    "SCF%":
      aggregatedCountingStats.SCF /
      (aggregatedCountingStats.SCF + aggregatedCountingStats.SCA || 1),

    IPP:
      aggregatedCountingStats.goals +
        aggregatedCountingStats.assists / aggregatedCountingStats.oiGF || 0,
    "S%": aggregatedCountingStats.goals / aggregatedCountingStats.SOG || 0,
    "xS%": aggregatedCountingStats.ixG / aggregatedCountingStats.SOG || 0,
    "SOG/60":
      (aggregatedCountingStats.SOG / aggregatedCountingStats.TOI) * 60 || 0,
    "oZS%":
      aggregatedCountingStats.oZS /
        (aggregatedCountingStats.oZS + aggregatedCountingStats.dZS) || 0,
    "oiSH%": aggregatedCountingStats.oiGF / aggregatedCountingStats.SF || 0,
    "secA%": aggregatedCountingStats.A2 / aggregatedCountingStats.assists || 0
  };

  return {
    yearlyCounts: yearData,
    threeYearCountsAverages: data
  };
}

/**
 * Computes three-year rate averages without strictly requiring "TOT" rows.
 * Uses "TOT" if available; otherwise, uses the single team row.
 * @param playerId - The player's unique identifier.
 * @returns An object containing yearly rates and three-year rate averages.
 */
async function GetThreeYearRates(playerId: string): Promise<{
  yearlyRates: YearlyRates;
  threeYearRatesAverages: RatesData;
}> {
  const URL = `https://naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=y&v=p&playerid=${playerId}`;
  const html = (await fetchWithCache(URL, false)) as string;
  const document = parse(html);

  const individual = parseTable(document.getElementById("indreg"));
  const onIce = parseTable(document.getElementById("reg"));

  const individualRows = processRows(individual.data, individual.headers);
  const onIceRows = processRows(onIce.data, onIce.headers);

  // Initialize the object to hold all yearly rates data
  let rateData: YearlyRates = { rates: [] };

  // Populate yearlyRates with all rows
  individualRows.forEach((individualRow) => {
    const season = Number(individualRow["Season"]);
    const team = individualRow["Team"]; // Ensure "Team" column exists

    // Find corresponding on-ice row
    const onIceRow = onIceRows.find(
      (row) => Number(row["Season"]) === season && row["Team"] === team
    );

    if (!onIceRow) {
      // Handle missing on-ice data if necessary
      throw new Error(
        `Missing on-ice data for Season ${season} and Team ${team}.`
      );
    }

    rateData.rates.push({
      // On Ice Table
      // Rates
      season: season,
      team: team,
      TOI: parseTime(Number(onIceRow["TOI"])), // Convert TOI to total seconds
      "CF/60": Number(onIceRow["CF/60"]),
      "CA/60": Number(onIceRow["CA/60"]),
      "CF%": Number(onIceRow["CF%"]),
      "iSCF/60": Number(individualRow["iSCF/60"]),
      "PTS/60": Number(individualRow["Total Points/60"]),
      "G/60": Number(individualRow["Goals/60"]),
      "GF/60": Number(onIceRow["GF/60"]),
      "GA/60": Number(onIceRow["GA/60"]),
      "GF%": Number(onIceRow["GF%"]),
      "A/60": Number(individualRow["Total Assists/60"]),
      "A1/60": Number(individualRow["First Assists/60"]),
      "A2/60": Number(individualRow["Second Assists/60"]),
      "SOG/60": Number(individualRow["Shots/60"]),
      "SF/60": Number(onIceRow["SF/60"]),
      "SA/60": Number(onIceRow["SA/60"]),
      "SF%": Number(onIceRow["SF%"]),
      "SCF/60": Number(onIceRow["SCF/60"]),
      "SCA/60": Number(onIceRow["SCA/60"]),
      "SCF%": Number(onIceRow["SCF%"]),
      "iCF/60": Number(individualRow["iCF/60"]),
      "iFF/60": Number(individualRow["iFF/60"]),
      "FF/60": Number(onIceRow["FF/60"]),
      "FA/60": Number(onIceRow["FA/60"]),
      "FF%": Number(onIceRow["FF%"]),
      "ixG/60": Number(individualRow["ixG/60"]),
      "xGF/60": Number(onIceRow["xGF/60"]),
      "xGA/60": Number(onIceRow["xGA/60"]),
      "xGF%": Number(onIceRow["xG%"]),
      "HDCF/60": Number(onIceRow["HDCF/60"]),
      "HDGF/60": Number(onIceRow["HDGF/60"]),
      "MDCF/60": Number(onIceRow["MDCF/60"]),
      "MDGF/60": Number(onIceRow["MDGF/60"]),
      "LDCF/60": Number(onIceRow["LDCF/60"]),
      "LDGF/60": Number(onIceRow["LDGF/60"]),
      "PIM/60": Number(individualRow["PIM/60"]),
      "HIT/60": Number(individualRow["Hits/60"]),
      "BLK/60": Number(individualRow["Shots Blocked/60"])
    });
  });

  // Aggregate "TOT" rows
  rateData.rates = addTotalRateRows(rateData.rates);

  // Identify all unique seasons and sort them in descending order
  const allSeasons = Array.from(
    new Set(rateData.rates.map((rate) => rate.season))
  ).sort((a, b) => b - a);
  const currentSeason = allSeasons[0];

  // Select the last three seasons prior to the current season
  const seasonsToAverage = allSeasons
    .filter((season) => season !== currentSeason)
    .slice(0, 3);

  if (seasonsToAverage.length < 3) {
    throw new Error(
      "Not enough prior seasons to calculate three-year averages."
    );
  }

  // **Updated Selection Logic**
  // For each season to average, select "TOT" row if exists; otherwise, use the single team row.
  const ratesForAverages: YearlyRate[] = seasonsToAverage.map((season) => {
    const totRow = rateData.rates.find(
      (rate) => rate.season === season && rate.team === "TOT"
    );
    if (totRow) {
      return totRow;
    } else {
      // Find the single team row for the season
      const singleRow = rateData.rates.find(
        (rate) => rate.season === season && rate.team !== "TOT"
      );
      if (singleRow) {
        return singleRow;
      } else {
        throw new Error(
          `No rate data available for Season ${season} to calculate three-year averages.`
        );
      }
    }
  });

  // **Aggregate Counting Stats for Rate Calculations**
  const totalCounts = {
    FF: ratesForAverages.reduce((sum, rate) => sum + rate["FF/60"], 0),
    FA: ratesForAverages.reduce((sum, rate) => sum + rate["FA/60"], 0),
    SF: ratesForAverages.reduce((sum, rate) => sum + (rate["SF/60"] || 0), 0),
    SA: ratesForAverages.reduce((sum, rate) => sum + (rate["SA/60"] || 0), 0),
    GF: ratesForAverages.reduce((sum, rate) => sum + rate["GF/60"], 0),
    GA: ratesForAverages.reduce((sum, rate) => sum + (rate["GA/60"] || 0), 0),
    CF: ratesForAverages.reduce((sum, rate) => sum + rate["CF/60"], 0),
    CA: ratesForAverages.reduce((sum, rate) => sum + rate["CA/60"], 0),
    iSCF: ratesForAverages.reduce((sum, rate) => sum + rate["iSCF/60"], 0),
    xGF: ratesForAverages.reduce((sum, rate) => sum + rate["xGF/60"], 0),
    xGA: ratesForAverages.reduce((sum, rate) => sum + (rate["xGA/60"] || 0), 0),
    SCF: ratesForAverages.reduce((sum, rate) => sum + rate["SCF/60"], 0),
    SCA: ratesForAverages.reduce((sum, rate) => sum + rate["SCA/60"], 0),

    // Additional counts needed for other rate stats
    goals: ratesForAverages.reduce((sum, rate) => sum + rate["G/60"], 0),
    SOG: ratesForAverages.reduce((sum, rate) => sum + rate["SOG/60"], 0),
    assists: ratesForAverages.reduce((sum, rate) => sum + rate["A/60"], 0),
    oiGF: ratesForAverages.reduce((sum, rate) => sum + rate["GF/60"], 0),
    TOI: ratesForAverages.reduce((sum, rate) => sum + rate.TOI, 0)
  };

  // **Calculate Rate Stats Based on Aggregated Totals**
  const rateAverages: { [key in keyof RatesData]?: number } = {};

  // Apply the provided formulas
  rateAverages["CF%"] =
    totalCounts.CF / (totalCounts.CF + totalCounts.CA || 1) || 0;
  rateAverages["FF%"] =
    totalCounts.FF / (totalCounts.FF + totalCounts.FA || 1) || 0;
  rateAverages["SF%"] =
    totalCounts.SF / (totalCounts.SF + totalCounts.SA || 1) || 0;
  rateAverages["GF%"] =
    totalCounts.GF / (totalCounts.GF + totalCounts.GA || 1) || 0;
  rateAverages["xGF%"] =
    totalCounts.xGF / (totalCounts.xGF + totalCounts.xGA || 1) || 0;
  rateAverages["SCF%"] =
    totalCounts.SCF / (totalCounts.SCF + totalCounts.SCA || 1) || 0;

  // **Populate the RatesData Object**
  const data: RatesData = {
    // **Existing Rates**

    "CF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["CF/60"], 0) /
      ratesForAverages.length,

    "CA/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["CA/60"], 0) /
      ratesForAverages.length,

    "CF%": rateAverages["CF%"] || 0,

    "iSCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["iSCF/60"], 0) /
      ratesForAverages.length,

    "PTS/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["PTS/60"], 0) /
      ratesForAverages.length,

    "SOG/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["SOG/60"], 0) /
      ratesForAverages.length,

    "A/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["A/60"], 0) /
      ratesForAverages.length,

    "G/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["G/60"], 0) /
      ratesForAverages.length,

    "GF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["GF/60"], 0) /
      ratesForAverages.length,

    "GA/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["GA/60"], 0) /
      ratesForAverages.length,

    "GF%": rateAverages["GF%"] || 0,

    "SF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["SF/60"], 0) /
      ratesForAverages.length,

    "SA/60":
      ratesForAverages.reduce((prev, rate) => prev + (rate["SA/60"] || 0), 0) /
      ratesForAverages.length,

    "SF%": rateAverages["SF%"] || 0,

    "A1/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["A1/60"], 0) /
      ratesForAverages.length,

    "A2/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["A2/60"], 0) /
      ratesForAverages.length,

    "SCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["SCF/60"], 0) /
      ratesForAverages.length,

    "SCA/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["SCA/60"], 0) /
      ratesForAverages.length,

    "SCF%": rateAverages["SCF%"] || 0,

    "iCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["iCF/60"], 0) /
      ratesForAverages.length,

    "iFF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["iFF/60"], 0) /
      ratesForAverages.length,

    "FF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["FF/60"], 0) /
      ratesForAverages.length,

    "FA/60":
      ratesForAverages.reduce((prev, rate) => prev + (rate["FA/60"] || 0), 0) /
      ratesForAverages.length,

    "FF%": rateAverages["FF%"] || 0,

    "ixG/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["ixG/60"], 0) /
      ratesForAverages.length,

    "xGF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["xGF/60"], 0) /
      ratesForAverages.length,

    "xGA/60":
      ratesForAverages.reduce((prev, rate) => prev + (rate["xGA/60"] || 0), 0) /
      ratesForAverages.length,

    "xGF%": rateAverages["xGF%"] || 0,

    "HDCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["HDCF/60"], 0) /
      ratesForAverages.length,

    "HDGF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["HDGF/60"], 0) /
      ratesForAverages.length,

    "MDCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["MDCF/60"], 0) /
      ratesForAverages.length,

    "MDGF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["MDGF/60"], 0) /
      ratesForAverages.length,

    "LDCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["LDCF/60"], 0) /
      ratesForAverages.length,

    "LDGF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["LDGF/60"], 0) /
      ratesForAverages.length,

    "PIM/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["PIM/60"], 0) /
      ratesForAverages.length,

    "HIT/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["HIT/60"], 0) /
      ratesForAverages.length,

    "BLK/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["BLK/60"], 0) /
      ratesForAverages.length
  };

  return {
    yearlyRates: rateData,
    threeYearRatesAverages: data
  };
}

/**
 * Computes career averages for counting stats by aggregating all available seasons.
 * Uses "TOT" if available; otherwise, uses the single team row.
 * @param playerId - The player's unique identifier.
 * @returns An object containing yearly counts and career averages.
 */
async function GetCareerStats(playerId: string): Promise<{
  yearlyCounts: YearlyCounts;
  careerAverageCounts: Data;
}> {
  const URL = `https://naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=n&v=p&playerid=${playerId}`;
  const html = (await fetchWithCache(URL, false)) as string;
  const document = parse(html);

  const individual = parseTable(document.getElementById("indreg"));
  const onIce = parseTable(document.getElementById("reg"));

  const individualRows = processRows(individual.data, individual.headers);
  const onIceRows = processRows(onIce.data, onIce.headers);

  // Initialize the object to hold all yearly data
  let yearData: YearlyCounts = { counts: [] };

  // Populate yearlyCounts with all rows
  individualRows.forEach((individualRow) => {
    const season = Number(individualRow["Season"]);
    const team = individualRow["Team"]; // Ensure "Team" column exists

    // Find corresponding on-ice row
    const onIceRow = onIceRows.find(
      (row) => Number(row["Season"]) === season && row["Team"] === team
    );

    if (!onIceRow) {
      // Handle missing on-ice data if necessary
      throw new Error(
        `Missing on-ice data for Season ${season} and Team ${team}.`
      );
    }

    yearData.counts.push({
      // Individual Table
      // Counts
      season: season,
      team: team,
      SOG: Number(individualRow["Shots"]) || 0,
      TOI: parseTime(Number(individualRow["TOI"])), // Total seconds
      SF: Number(onIceRow["SF"]) || 0, // Shots For
      SA: Number(onIceRow["SA"]) || 0, // Shots Against
      "SF%": Number(individualRow["SF%"]) / 100, // Shots For Percentage
      GF: Number(onIceRow["GF"]) || 0, // Goals For
      GA: Number(onIceRow["GA"]) || 0, // Goals Against
      "GF%": Number(onIceRow["GF%"]) / 100, // Goals For Percentage
      SCF: Number(onIceRow["SCF"]) || 0, // Shot Contributions For
      SCA: Number(onIceRow["SCA"]) || 0, // Shot-Creating Actions
      "SCF%": Number(individualRow["SCF%"]) / 100,
      "S%": Number(individualRow["S%"]) / 100,
      "oiSH%": Number(onIceRow["On-Ice SH%"]) / 100,
      "secA%":
        Number(individualRow["Second Assists"]) /
          Number(individualRow["Total Assists"]) || 0,
      iHDCF: Number(individualRow["iHDCF"]) || 0,
      goals: Number(individualRow["Goals"]) || 0,
      "SOG/60":
        (Number(individualRow["Shots"]) /
          parseTime(Number(individualRow["TOI"]))) *
          60 || 0,
      IPP: Number(individualRow["IPP"]) / 100 || 0,
      "oZS%": Number(onIceRow["Off. Zone Start %"]) / 100 || 0,
      GP: Number(individualRow["GP"]) || 0,
      oiGF: Number(onIceRow["GF"]) || 0,
      assists: Number(individualRow["Total Assists"]) || 0,
      A1: Number(individualRow["First Assists"]) || 0,
      A2: Number(individualRow["Second Assists"]) || 0,
      PIM: Number(individualRow["PIM"]) || 0,
      HIT: Number(individualRow["Hits"]) || 0,
      BLK: Number(individualRow["Shots Blocked"]) || 0,
      iCF: Number(individualRow["iCF"]) || 0,
      CF: Number(onIceRow["CF"]) || 0,
      CA: Number(onIceRow["CA"]) || 0,
      "CF%": Number(onIceRow["CF%"]) || 0,
      iFF: Number(individualRow["iFF"]) || 0,
      FF: Number(onIceRow["FF"]) || 0,
      FA: Number(onIceRow["FA"]) || 0,
      "FF%": Number(onIceRow["FF%"]) || 0,
      ixG: Number(individualRow["ixG"]) || 0,
      xGF: Number(onIceRow["xGF"]) || 0,
      xGA: Number(onIceRow["xGA"]) || 0,
      "xGF%": Number(onIceRow["xG%"]) || 0,
      iSCF: Number(individualRow["iSCF"]) || 0,
      HDCF: Number(onIceRow["HDCF"]) || 0,
      HDGF: Number(onIceRow["HDGF"]) || 0,
      MDCF: Number(onIceRow["MDCF"]) || 0,
      MDGF: Number(onIceRow["MDGF"]) || 0,
      LDCF: Number(onIceRow["LDCF"]) || 0,
      LDGF: Number(onIceRow["LDGF"]) || 0,
      oZS: Number(onIceRow["Off. Zone Starts"]) || 0,
      dZS: Number(onIceRow["Def. Zone Starts"]) || 0
    });
  });

  // Aggregate "TOT" rows
  yearData.counts = addTotalRows(yearData.counts);

  // Identify all unique seasons and sort them in descending order
  const allSeasons = Array.from(
    new Set(yearData.counts.map((count) => count.season))
  ).sort((a, b) => b - a);
  const currentSeason = allSeasons[0];

  // Select all seasons prior to the current season
  const seasonsToAverage = allSeasons.filter(
    (season) => season !== currentSeason
  );

  if (seasonsToAverage.length < 1) {
    throw new Error("Not enough seasons to calculate career averages.");
  }

  // **Selection Logic for Career Averages**
  // For each season to average, select "TOT" row if exists; otherwise, use the single team row.
  const countsForAverages: YearlyCount[] = seasonsToAverage.map((season) => {
    const totRow = yearData.counts.find(
      (count) => count.season === season && count.team === "TOT"
    );
    if (totRow) {
      return totRow;
    } else {
      // Find the single team row for the season
      const singleRow = yearData.counts.find(
        (count) => count.season === season && count.team !== "TOT"
      );
      if (singleRow) {
        return singleRow;
      } else {
        throw new Error(
          `No data available for Season ${season} to calculate career averages.`
        );
      }
    }
  });

  // **Aggregate Counting Stats**
  const countingStats = [
    "iHDCF",
    "ixG",
    "goals",
    "GP",
    "A1",
    "A2",
    "SOG",
    "PIM",
    "HIT",
    "BLK",
    "iCF",
    "CF",
    "CA",
    "iFF",
    "FF",
    "FA",
    "TOI",
    "SF",
    "SA",
    "GF",
    "GA",
    "SCF",
    "SCA",
    "oiGF",
    "assists",
    "xGF",
    "xGA",
    "iSCF",
    "HDCF",
    "HDGF",
    "MDCF",
    "MDGF",
    "LDCF",
    "LDGF",
    "oZS",
    "dZS"
  ] as const;

  const aggregatedCountingStats: {
    [key in
      | typeof countingStats[number]
      | "IPP"
      | "S%"
      | "xS%"
      | "SOG/60"
      | "oZS%"
      | "oiSH%"
      | "secA%"]: number;
  } = {
    iHDCF: 0,
    ixG: 0,
    goals: 0,
    GP: 0,
    A1: 0,
    A2: 0,
    SOG: 0,
    PIM: 0,
    HIT: 0,
    BLK: 0,
    iCF: 0,
    CF: 0,
    CA: 0,
    iFF: 0,
    FF: 0,
    FA: 0,
    TOI: 0,
    SF: 0,
    SA: 0,
    GF: 0,
    GA: 0,
    SCF: 0,
    SCA: 0,
    oiGF: 0,
    assists: 0,
    xGF: 0,
    xGA: 0,
    iSCF: 0,
    HDCF: 0,
    HDGF: 0,
    MDCF: 0,
    MDGF: 0,
    LDCF: 0,
    LDGF: 0,
    oZS: 0,
    dZS: 0,
    IPP: 0,

    // **Add the Missing Properties Below**
    "S%": 0,
    "xS%": 0,
    "SOG/60": 0,
    "oZS%": 0,
    "oiSH%": 0,
    "secA%": 0
  };

  countingStats.forEach((stat) => {
    countsForAverages.forEach((count) => {
      aggregatedCountingStats[stat] += count[stat];
    });
    // Calculate the average by dividing by number of seasons
    aggregatedCountingStats[stat] /= seasonsToAverage.length;
  });

  // **Calculate Rate Stats Based on Aggregated Totals**

  // For accurate rate stats, we need the total counts across the seasons
  const totalCounts: { [key: string]: number } = {
    goals: countsForAverages.reduce((sum, count) => sum + count.goals, 0),
    GP: countsForAverages.reduce((sum, count) => sum + count.GP, 0),
    SOG: countsForAverages.reduce((sum, count) => sum + count.SOG, 0),
    ixG: countsForAverages.reduce((sum, count) => sum + count.ixG, 0),
    assists: countsForAverages.reduce((sum, count) => sum + count.assists, 0),
    oiGF: countsForAverages.reduce((sum, count) => sum + count.oiGF, 0),
    GF: countsForAverages.reduce((sum, count) => sum + count.GF, 0),
    GA: countsForAverages.reduce((sum, count) => sum + count.GA, 0),
    A1: countsForAverages.reduce((sum, count) => sum + count.A1, 0),
    A2: countsForAverages.reduce((sum, count) => sum + count.A2, 0),
    SF: countsForAverages.reduce((sum, count) => sum + count.SF, 0),
    SA: countsForAverages.reduce((sum, count) => sum + count.SA, 0),
    oZS: countsForAverages.reduce((sum, count) => sum + count.oZS, 0),
    dZS: countsForAverages.reduce((sum, count) => sum + count.dZS, 0),
    SCF: countsForAverages.reduce((sum, count) => sum + count.SCF, 0),
    SCA: countsForAverages.reduce((sum, count) => sum + count.SCA, 0),
    FF: countsForAverages.reduce((sum, count) => sum + count.FF, 0),
    FA: countsForAverages.reduce((sum, count) => sum + count.FA, 0),
    xGF: countsForAverages.reduce((sum, count) => sum + count.xGF, 0),
    xGA: countsForAverages.reduce((sum, count) => sum + count.xGA, 0)
  };

  // Prevent division by zero by using conditional checks
  const rateAverages: { [key in keyof Data]?: number } = {};

  // **Rate Stat Calculations**
  rateAverages["S%"] = totalCounts.goals / (totalCounts.SOG || 1);
  rateAverages["xS%"] = totalCounts.ixG / (totalCounts.SOG || 1);
  rateAverages["IPP"] =
    (totalCounts.goals + totalCounts.assists) / (totalCounts.oiGF || 1);
  rateAverages["oiSH%"] = totalCounts.oiGF / (aggregatedCountingStats.SF || 1);
  rateAverages["oZS%"] =
    totalCounts.oZS / (totalCounts.oZS + totalCounts.dZS || 1);
  rateAverages["secA%"] = totalCounts.A2 / (totalCounts.assists || 1);
  rateAverages["SOG/60"] =
    (totalCounts.SOG / aggregatedCountingStats.TOI) * 60 || 0;
  rateAverages["FF%"] =
    totalCounts.FF / (totalCounts.FF + totalCounts.FA || 1) || 0;
  rateAverages["SF%"] =
    totalCounts.SF / (totalCounts.SF + totalCounts.SA || 1) || 0;
  rateAverages["GF%"] =
    totalCounts.GF / (totalCounts.GF + totalCounts.GA || 1) || 0;
  rateAverages["xGF%"] =
    totalCounts.xGF / (totalCounts.xGF + totalCounts.xGA || 1) || 0;
  rateAverages["SCF%"] =
    totalCounts.SCF / (totalCounts.SCF + totalCounts.SCA || 1) || 0;

  // **Populate the Data Object**
  const data: Data = {
    // **Counting Stats Averages**
    toi: aggregatedCountingStats.TOI,
    iHDCF: aggregatedCountingStats.iHDCF,
    iSCF: aggregatedCountingStats.iSCF,
    ixG: aggregatedCountingStats.ixG,
    oiGF: aggregatedCountingStats.oiGF,
    goals: aggregatedCountingStats.goals,
    assists: aggregatedCountingStats.assists,
    GP: aggregatedCountingStats.GP,
    A1: aggregatedCountingStats.A1,
    A2: aggregatedCountingStats.A2,
    SOG: aggregatedCountingStats.SOG,
    PIM: aggregatedCountingStats.PIM,
    HIT: aggregatedCountingStats.HIT,
    BLK: aggregatedCountingStats.BLK,
    iCF: aggregatedCountingStats.iCF,
    iFF: aggregatedCountingStats.iFF,

    // **New Counting Stats Averages**
    GF: aggregatedCountingStats.GF,
    GA: aggregatedCountingStats.GA,
    SCF: aggregatedCountingStats.SCF,
    SCA: aggregatedCountingStats.SCA,
    CF: aggregatedCountingStats.CF,
    CA: aggregatedCountingStats.CA,
    FF: aggregatedCountingStats.FF,
    FA: aggregatedCountingStats.FA,
    SF: aggregatedCountingStats.SF,
    SA: aggregatedCountingStats.SA,
    xGF: aggregatedCountingStats.xGF,
    xGA: aggregatedCountingStats.xGA,
    HDCF: aggregatedCountingStats.HDCF,
    HDGF: aggregatedCountingStats.HDGF,
    MDCF: aggregatedCountingStats.MDCF,
    MDGF: aggregatedCountingStats.MDGF,
    LDCF: aggregatedCountingStats.LDCF,
    LDGF: aggregatedCountingStats.LDGF,
    oZS: aggregatedCountingStats.oZS,
    dZS: aggregatedCountingStats.dZS,

    // **New Rate Stats Calculated from Aggregated Totals**
    "CF%":
      aggregatedCountingStats.CF /
      (aggregatedCountingStats.CF + aggregatedCountingStats.CA || 1),
    "FF%":
      aggregatedCountingStats.FF /
      (aggregatedCountingStats.FF + aggregatedCountingStats.FA || 1),
    "SF%":
      aggregatedCountingStats.SF /
      (aggregatedCountingStats.SF + aggregatedCountingStats.SA || 1),
    "GF%":
      aggregatedCountingStats.GF /
      (aggregatedCountingStats.GF + aggregatedCountingStats.GA || 1),
    "xGF%":
      aggregatedCountingStats.xGF /
      (aggregatedCountingStats.xGF + aggregatedCountingStats.xGA || 1),
    "SCF%":
      aggregatedCountingStats.SCF /
      (aggregatedCountingStats.SCF + aggregatedCountingStats.SCA || 1),

    IPP:
      aggregatedCountingStats.goals +
        aggregatedCountingStats.assists / aggregatedCountingStats.oiGF || 0,
    "S%": aggregatedCountingStats.goals / aggregatedCountingStats.SOG || 0,
    "xS%": aggregatedCountingStats.ixG / aggregatedCountingStats.SOG || 0,
    "SOG/60":
      (aggregatedCountingStats.SOG / aggregatedCountingStats.TOI) * 60 || 0,
    "oZS%":
      aggregatedCountingStats.oZS /
        (aggregatedCountingStats.oZS + aggregatedCountingStats.dZS) || 0,
    "oiSH%": aggregatedCountingStats.oiGF / aggregatedCountingStats.SF || 0,
    "secA%": aggregatedCountingStats.A2 / aggregatedCountingStats.assists || 0
  };

  return {
    yearlyCounts: yearData,
    careerAverageCounts: data
  };
}

/**
 * Computes career rate averages by aggregating all available seasons.
 * Uses "TOT" if available; otherwise, uses the single team row.
 * @param playerId - The player's unique identifier.
 * @returns An object containing yearly rates and career rate averages.
 */
async function GetCareerRates(playerId: string): Promise<{
  yearlyRates: YearlyRates;
  careerAverageRates: RatesData;
}> {
  const URL = `https://naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=y&v=p&playerid=${playerId}`;
  const html = (await fetchWithCache(URL, false)) as string;
  const document = parse(html);

  const individual = parseTable(document.getElementById("indreg"));
  const onIce = parseTable(document.getElementById("reg"));

  const individualRows = processRows(individual.data, individual.headers);
  const onIceRows = processRows(onIce.data, onIce.headers);

  // Initialize the object to hold all yearly rates data
  let rateData: YearlyRates = { rates: [] };

  // Populate yearlyRates with all rows
  individualRows.forEach((individualRow) => {
    const season = Number(individualRow["Season"]);
    const team = individualRow["Team"]; // Ensure "Team" column exists

    // Find corresponding on-ice row
    const onIceRow = onIceRows.find(
      (row) => Number(row["Season"]) === season && row["Team"] === team
    );

    if (!onIceRow) {
      // Handle missing on-ice data if necessary
      throw new Error(
        `Missing on-ice data for Season ${season} and Team ${team}.`
      );
    }

    rateData.rates.push({
      // On Ice Table
      // Rates
      season: season,
      team: team,
      TOI: parseTime(Number(onIceRow["TOI"])), // Convert TOI to total seconds
      "CF/60": Number(onIceRow["CF/60"]),
      "CA/60": Number(onIceRow["CA/60"]),
      "CF%": Number(onIceRow["CF%"]),
      "iSCF/60": Number(individualRow["iSCF/60"]),
      "PTS/60": Number(individualRow["Total Points/60"]),
      "G/60": Number(individualRow["Goals/60"]),
      "GF/60": Number(onIceRow["GF/60"]),
      "GA/60": Number(onIceRow["GA/60"]),
      "GF%": Number(onIceRow["GF%"]),
      "A/60": Number(individualRow["Total Assists/60"]),
      "A1/60": Number(individualRow["First Assists/60"]),
      "A2/60": Number(individualRow["Second Assists/60"]),
      "SOG/60": Number(individualRow["Shots/60"]),
      "SF/60": Number(onIceRow["SF/60"]),
      "SA/60": Number(onIceRow["SA/60"]),
      "SF%": Number(onIceRow["SF%"]),
      "SCF/60": Number(onIceRow["SCF/60"]),
      "SCA/60": Number(onIceRow["SCA/60"]),
      "SCF%": Number(onIceRow["SCF%"]),
      "iCF/60": Number(individualRow["iCF/60"]),
      "iFF/60": Number(individualRow["iFF/60"]),
      "FF/60": Number(onIceRow["FF/60"]),
      "FA/60": Number(onIceRow["FA/60"]),
      "FF%": Number(onIceRow["FF%"]),
      "ixG/60": Number(individualRow["ixG/60"]),
      "xGF/60": Number(onIceRow["xGF/60"]),
      "xGA/60": Number(onIceRow["xGA/60"]),
      "xGF%": Number(onIceRow["xG%"]),
      "HDCF/60": Number(onIceRow["HDCF/60"]),
      "HDGF/60": Number(onIceRow["HDGF/60"]),
      "MDCF/60": Number(onIceRow["MDCF/60"]),
      "MDGF/60": Number(onIceRow["MDGF/60"]),
      "LDCF/60": Number(onIceRow["LDCF/60"]),
      "LDGF/60": Number(onIceRow["LDGF/60"]),
      "PIM/60": Number(individualRow["PIM/60"]),
      "HIT/60": Number(individualRow["Hits/60"]),
      "BLK/60": Number(individualRow["Shots Blocked/60"])
    });
  });

  // Aggregate "TOT" rows
  rateData.rates = addTotalRateRows(rateData.rates);

  // Identify all unique seasons and sort them in descending order
  const allSeasons = Array.from(
    new Set(rateData.rates.map((rate) => rate.season))
  ).sort((a, b) => b - a);
  const currentSeason = allSeasons[0];

  // Select all seasons prior to the current season
  const seasonsToAverage = allSeasons.filter(
    (season) => season !== currentSeason
  );

  if (seasonsToAverage.length < 1) {
    throw new Error("Not enough seasons to calculate career averages.");
  }

  // **Selection Logic for Career Averages**
  // For each season to average, select "TOT" row if exists; otherwise, use the single team row.
  const ratesForAverages: YearlyRate[] = seasonsToAverage.map((season) => {
    const totRow = rateData.rates.find(
      (rate) => rate.season === season && rate.team === "TOT"
    );
    if (totRow) {
      return totRow;
    } else {
      // Find the single team row for the season
      const singleRow = rateData.rates.find(
        (rate) => rate.season === season && rate.team !== "TOT"
      );
      if (singleRow) {
        return singleRow;
      } else {
        throw new Error(
          `No rate data available for Season ${season} to calculate career averages.`
        );
      }
    }
  });

  // **Aggregate Counting Stats for Rate Calculations**
  const totalCounts = {
    FF: ratesForAverages.reduce((sum, rate) => sum + rate["FF/60"], 0),
    FA: ratesForAverages.reduce((sum, rate) => sum + rate["FA/60"], 0),
    SF: ratesForAverages.reduce((sum, rate) => sum + (rate["SF/60"] || 0), 0),
    SA: ratesForAverages.reduce((sum, rate) => sum + (rate["SA/60"] || 0), 0),
    GF: ratesForAverages.reduce((sum, rate) => sum + rate["GF/60"], 0),
    GA: ratesForAverages.reduce((sum, rate) => sum + (rate["GA/60"] || 0), 0),
    CF: ratesForAverages.reduce((sum, rate) => sum + rate["CF/60"], 0),
    CA: ratesForAverages.reduce((sum, rate) => sum + rate["CA/60"], 0),
    iSCF: ratesForAverages.reduce((sum, rate) => sum + rate["iSCF/60"], 0),
    xGF: ratesForAverages.reduce((sum, rate) => sum + rate["xGF/60"], 0),
    xGA: ratesForAverages.reduce((sum, rate) => sum + (rate["xGA/60"] || 0), 0),
    SCF: ratesForAverages.reduce((sum, rate) => sum + rate["SCF/60"], 0),
    SCA: ratesForAverages.reduce((sum, rate) => sum + rate["SCA/60"], 0),

    // Additional counts needed for other rate stats
    goals: ratesForAverages.reduce((sum, rate) => sum + rate["G/60"], 0),
    SOG: ratesForAverages.reduce((sum, rate) => sum + rate["SOG/60"], 0),
    assists: ratesForAverages.reduce((sum, rate) => sum + rate["A/60"], 0),
    oiGF: ratesForAverages.reduce((sum, rate) => sum + rate["GF/60"], 0),
    TOI: ratesForAverages.reduce((sum, rate) => sum + rate.TOI, 0)
  };

  // **Calculate Rate Stats Based on Aggregated Totals**
  const rateAverages: { [key in keyof RatesData]?: number } = {};

  // Apply the provided formulas
  rateAverages["CF%"] =
    totalCounts.CF / (totalCounts.CF + totalCounts.CA || 1) || 0;
  rateAverages["FF%"] =
    totalCounts.FF / (totalCounts.FF + totalCounts.FA || 1) || 0;
  rateAverages["SF%"] =
    totalCounts.SF / (totalCounts.SF + totalCounts.SA || 1) || 0;
  rateAverages["GF%"] =
    totalCounts.GF / (totalCounts.GF + totalCounts.GA || 1) || 0;
  rateAverages["xGF%"] =
    totalCounts.xGF / (totalCounts.xGF + totalCounts.xGA || 1) || 0;
  rateAverages["SCF%"] =
    totalCounts.SCF / (totalCounts.SCF + totalCounts.SCA || 1) || 0;

  // **Populate the RatesData Object**
  const data: RatesData = {
    // **Existing Rates**

    "CF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["CF/60"], 0) /
      ratesForAverages.length,

    "CA/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["CA/60"], 0) /
      ratesForAverages.length,

    "CF%": rateAverages["CF%"] || 0,

    "iSCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["iSCF/60"], 0) /
      ratesForAverages.length,

    "PTS/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["PTS/60"], 0) /
      ratesForAverages.length,

    "SOG/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["SOG/60"], 0) /
      ratesForAverages.length,

    "A/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["A/60"], 0) /
      ratesForAverages.length,

    "G/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["G/60"], 0) /
      ratesForAverages.length,

    "GF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["GF/60"], 0) /
      ratesForAverages.length,

    "GA/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["GA/60"], 0) /
      ratesForAverages.length,

    "GF%": rateAverages["GF%"] || 0,

    "SF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["SF/60"], 0) /
      ratesForAverages.length,

    "SA/60":
      ratesForAverages.reduce((prev, rate) => prev + (rate["SA/60"] || 0), 0) /
      ratesForAverages.length,

    "SF%": rateAverages["SF%"] || 0,

    "A1/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["A1/60"], 0) /
      ratesForAverages.length,

    "A2/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["A2/60"], 0) /
      ratesForAverages.length,

    "SCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["SCF/60"], 0) /
      ratesForAverages.length,

    "SCA/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["SCA/60"], 0) /
      ratesForAverages.length,

    "SCF%": rateAverages["SCF%"] || 0,

    "iCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["iCF/60"], 0) /
      ratesForAverages.length,

    "iFF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["iFF/60"], 0) /
      ratesForAverages.length,

    "FF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["FF/60"], 0) /
      ratesForAverages.length,

    "FA/60":
      ratesForAverages.reduce((prev, rate) => prev + (rate["FA/60"] || 0), 0) /
      ratesForAverages.length,

    "FF%": rateAverages["FF%"] || 0,

    "ixG/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["ixG/60"], 0) /
      ratesForAverages.length,

    "xGF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["xGF/60"], 0) /
      ratesForAverages.length,

    "xGA/60":
      ratesForAverages.reduce((prev, rate) => prev + (rate["xGA/60"] || 0), 0) /
      ratesForAverages.length,

    "xGF%": rateAverages["xGF%"] || 0,

    "HDCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["HDCF/60"], 0) /
      ratesForAverages.length,

    "HDGF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["HDGF/60"], 0) /
      ratesForAverages.length,

    "MDCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["MDCF/60"], 0) /
      ratesForAverages.length,

    "MDGF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["MDGF/60"], 0) /
      ratesForAverages.length,

    "LDCF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["LDCF/60"], 0) /
      ratesForAverages.length,

    "LDGF/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["LDGF/60"], 0) /
      ratesForAverages.length,

    "PIM/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["PIM/60"], 0) /
      ratesForAverages.length,

    "HIT/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["HIT/60"], 0) /
      ratesForAverages.length,

    "BLK/60":
      ratesForAverages.reduce((prev, rate) => prev + rate["BLK/60"], 0) /
      ratesForAverages.length
  };

  return {
    yearlyRates: rateData,
    careerAverageRates: data
  };
}
