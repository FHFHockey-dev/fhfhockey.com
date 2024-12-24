// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/Averages/statsService.ts

import {
  YearlyCounts,
  YearlyRates,
  Data,
  RatesData,
  YearlyCount,
  YearlyRate
} from "./types";
import { fetchPlayerData, addTotalRows, parseTime } from "./helpers";

/**
 * Gets three-year or career aggregated counting data and averages.
 * @param playerId - Player ID
 * @param isThreeYear - true for three-year averages, false for career averages
 */
export async function getAggregatedCountsData(
  playerId: string,
  isThreeYear: boolean
): Promise<{ yearlyData: YearlyCounts; averages: Data }> {
  const { individualRows, onIceRows } = await fetchPlayerData(playerId, "n");

  const yearData: YearlyCounts = { counts: [] };

  // Build yearlyCounts
  individualRows.forEach((individualRow) => {
    const season = Number(individualRow["Season"]);
    const team = individualRow["Team"];

    const onIceRow = onIceRows.find(
      (row) => Number(row["Season"]) === season && row["Team"] === team
    );

    if (!onIceRow) {
      throw new Error(
        `Missing on-ice data for Season ${season} and Team ${team}.`
      );
    }

    yearData.counts.push({
      season: season,
      team: team,
      SOG: Number(individualRow["Shots"]) || 0,
      TOI: parseTime(Number(individualRow["TOI"])),
      SF: Number(onIceRow["SF"]) || 0,
      SA: Number(onIceRow["SA"]) || 0,
      "SF%": (Number(onIceRow["SF%"]) || 0) / 100,
      GF: Number(onIceRow["GF"]) || 0,
      GA: Number(onIceRow["GA"]) || 0,
      "GF%": (Number(onIceRow["GF%"]) || 0) / 100,
      SCF: Number(onIceRow["SCF"]) || 0,
      SCA: Number(onIceRow["SCA"]) || 0,
      "SCF%": (Number(onIceRow["SCF%"]) || 0) / 100,
      "S%": (Number(individualRow["S%"]) || 0) / 100,
      "oiSH%": (Number(onIceRow["On-Ice SH%"]) || 0) / 100,
      "secA%":
        Number(individualRow["Total Assists"]) > 0
          ? (Number(individualRow["Second Assists"]) || 0) /
            Number(individualRow["Total Assists"])
          : 0,
      iHDCF: Number(individualRow["iHDCF"]) || 0,
      goals: Number(individualRow["Goals"]) || 0,
      "SOG/60":
        parseTime(Number(individualRow["TOI"])) > 0
          ? ((Number(individualRow["Shots"]) || 0) /
              parseTime(Number(individualRow["TOI"]))) *
            60
          : 0,
      IPP:
        Number(individualRow["IPP"]) > 0
          ? Number(individualRow["IPP"]) / 100
          : 0,
      "oZS%":
        Number(onIceRow["Off. Zone Start %"]) > 0
          ? Number(onIceRow["Off. Zone Start %"]) / 100
          : 0,
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

  // Aggregate "TOT" rows for counts
  yearData.counts = addTotalRows<YearlyCount>(
    yearData.counts,
    ["season", "team"],
    [
      "TOI",
      "iHDCF",
      "iSCF",
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
      "HDCF",
      "HDGF",
      "MDCF",
      "MDGF",
      "LDCF",
      "LDGF",
      "oZS",
      "dZS"
    ],
    (tot: YearlyCount) => {
      // Recalculate derived fields for TOT
      tot["S%"] = tot.SOG > 0 ? tot.goals / tot.SOG : 0;
      tot["secA%"] = tot.assists > 0 ? tot.A2 / tot.assists : 0;
      const ozsSum = tot.oZS + tot.dZS;
      tot["oZS%"] = ozsSum > 0 ? tot.oZS / ozsSum : 0;
      tot["SOG/60"] = tot.TOI > 0 ? (tot.SOG / tot.TOI) * 60 : 0;
      tot["oiSH%"] = tot.SF > 0 ? tot.oiGF / tot.SF : 0;
      tot["IPP"] = tot.oiGF > 0 ? (tot.goals + tot.assists) / tot.oiGF : 0;
      const gfSum = tot.GF + tot.GA;
      tot["GF%"] = gfSum > 0 ? tot.GF / gfSum : 0;
      const cfSum = tot.CF + tot.CA;
      tot["CF%"] = cfSum > 0 ? tot.CF / cfSum : 0;
      const ffSum = tot.FF + tot.FA;
      tot["FF%"] = ffSum > 0 ? tot.FF / ffSum : 0;
      const sfSum = tot.SF + tot.SA;
      tot["SF%"] = sfSum > 0 ? tot.SF / sfSum : 0;
      const scfSum = tot.SCF + tot.SCA;
      tot["SCF%"] = scfSum > 0 ? tot.SCF / scfSum : 0;
      const xgfSum = tot.xGF + tot.xGA;
      tot["xGF%"] = xgfSum > 0 ? tot.xGF / xgfSum : 0;
    }
  );

  // Determine seasons
  const allSeasons = Array.from(
    new Set(yearData.counts.map((c) => c.season))
  ).sort((a, b) => b - a);
  const currentSeason = allSeasons[0];
  const seasonsToAverage = isThreeYear
    ? allSeasons.filter((season) => season !== currentSeason).slice(0, 3)
    : allSeasons.filter((season) => season !== currentSeason);

  if (isThreeYear && seasonsToAverage.length < 3) {
    throw new Error(
      "Not enough prior seasons to calculate three-year averages."
    );
  }

  if (!isThreeYear && seasonsToAverage.length < 1) {
    throw new Error("Not enough seasons to calculate career averages.");
  }

  // Select the rows (TOT if available, else single team) for averaging
  const countsForAverages: YearlyCount[] = seasonsToAverage.map((season) => {
    const totRow = yearData.counts.find(
      (count) => count.season === season && count.team === "TOT"
    );
    if (totRow) return totRow;
    const singleRow = yearData.counts.find(
      (count) => count.season === season && count.team !== "TOT"
    );
    if (singleRow) return singleRow;
    throw new Error(
      `No data available for Season ${season} to calculate averages.`
    );
  });

  // Sum only raw counting stats
  const rawStats: (keyof YearlyCount)[] = [
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
  ];

  const aggregatedCounts: { [key: string]: number } = {};
  rawStats.forEach((stat) => {
    aggregatedCounts[stat] = 0;
  });

  countsForAverages.forEach((count) => {
    rawStats.forEach((stat) => {
      aggregatedCounts[stat] += Number(count[stat]);
    });
  });

  const divisor = isThreeYear ? 3 : seasonsToAverage.length;
  rawStats.forEach((stat) => {
    aggregatedCounts[stat] /= divisor;
  });

  // Compute derived fields
  const data: Data = {
    toi: aggregatedCounts.TOI,
    iHDCF: aggregatedCounts.iHDCF,
    iSCF: aggregatedCounts.iSCF,
    ixG: aggregatedCounts.ixG,
    oiGF: aggregatedCounts.oiGF,
    goals: aggregatedCounts.goals,
    GF: aggregatedCounts.GF,
    GA: aggregatedCounts.GA,
    assists: aggregatedCounts.assists,
    GP: aggregatedCounts.GP,
    A1: aggregatedCounts.A1,
    A2: aggregatedCounts.A2,
    SOG: aggregatedCounts.SOG,
    PIM: aggregatedCounts.PIM,
    HIT: aggregatedCounts.HIT,
    BLK: aggregatedCounts.BLK,
    iCF: aggregatedCounts.iCF,
    iFF: aggregatedCounts.iFF,
    CF: aggregatedCounts.CF,
    CA: aggregatedCounts.CA,
    FF: aggregatedCounts.FF,
    FA: aggregatedCounts.FA,
    SF: aggregatedCounts.SF,
    SA: aggregatedCounts.SA,
    xGF: aggregatedCounts.xGF,
    xGA: aggregatedCounts.xGA,
    HDCF: aggregatedCounts.HDCF,
    HDGF: aggregatedCounts.HDGF,
    MDCF: aggregatedCounts.MDCF,
    MDGF: aggregatedCounts.MDGF,
    LDCF: aggregatedCounts.LDCF,
    LDGF: aggregatedCounts.LDGF,
    oZS: aggregatedCounts.oZS,
    dZS: aggregatedCounts.dZS,

    // Derived stats:
    IPP:
      aggregatedCounts.oiGF > 0
        ? (aggregatedCounts.goals + aggregatedCounts.assists) /
          aggregatedCounts.oiGF
        : 0,
    "S%":
      aggregatedCounts.SOG > 0
        ? aggregatedCounts.goals / aggregatedCounts.SOG
        : 0,
    "xS%":
      aggregatedCounts.SOG > 0
        ? aggregatedCounts.ixG / aggregatedCounts.SOG
        : 0,
    "SOG/60":
      aggregatedCounts.TOI > 0
        ? (aggregatedCounts.SOG / aggregatedCounts.TOI) * 60
        : 0,
    "oZS%":
      aggregatedCounts.oZS + aggregatedCounts.dZS > 0
        ? aggregatedCounts.oZS / (aggregatedCounts.oZS + aggregatedCounts.dZS)
        : 0,
    "oiSH%":
      aggregatedCounts.SF > 0 ? aggregatedCounts.oiGF / aggregatedCounts.SF : 0,
    "secA%":
      aggregatedCounts.assists > 0
        ? aggregatedCounts.A2 / aggregatedCounts.assists
        : 0,

    "GF%":
      aggregatedCounts.GF + aggregatedCounts.GA > 0
        ? aggregatedCounts.GF / (aggregatedCounts.GF + aggregatedCounts.GA)
        : 0,
    "CF%":
      aggregatedCounts.CF + aggregatedCounts.CA > 0
        ? aggregatedCounts.CF / (aggregatedCounts.CF + aggregatedCounts.CA)
        : 0,
    "FF%":
      aggregatedCounts.FF + aggregatedCounts.FA > 0
        ? aggregatedCounts.FF / (aggregatedCounts.FF + aggregatedCounts.FA)
        : 0,
    "SF%":
      aggregatedCounts.SF + aggregatedCounts.SA > 0
        ? aggregatedCounts.SF / (aggregatedCounts.SF + aggregatedCounts.SA)
        : 0,
    "SCF%":
      aggregatedCounts.SCF + aggregatedCounts.SCA > 0
        ? aggregatedCounts.SCF / (aggregatedCounts.SCF + aggregatedCounts.SCA)
        : 0,
    "xGF%":
      aggregatedCounts.xGF + aggregatedCounts.xGA > 0
        ? aggregatedCounts.xGF / (aggregatedCounts.xGF + aggregatedCounts.xGA)
        : 0,
    SCF: aggregatedCounts.SCF,
    SCA: aggregatedCounts.SCA
  };

  return {
    yearlyData: yearData,
    averages: data
  };
}

/**
 * Gets three-year or career aggregated rate data and averages.
 * @param playerId - Player ID
 * @param isThreeYear - true for three-year averages, false for career averages
 */
export async function getAggregatedRatesData(
  playerId: string,
  isThreeYear: boolean
): Promise<{ yearlyData: YearlyRates; averages: RatesData }> {
  const { individualRows, onIceRows } = await fetchPlayerData(playerId, "y");

  const rateData: YearlyRates = { rates: [] };

  // Build yearlyRates
  individualRows.forEach((individualRow) => {
    const season = Number(individualRow["Season"]);
    const team = individualRow["Team"];

    const onIceRow = onIceRows.find(
      (row) => Number(row["Season"]) === season && row["Team"] === team
    );

    if (!onIceRow) {
      throw new Error(
        `Missing on-ice data for Season ${season} and Team ${team}.`
      );
    }

    rateData.rates.push({
      season: season,
      team: team,
      TOI: parseTime(Number(onIceRow["TOI"])),
      "CF/60": Number(onIceRow["CF/60"]) || 0,
      "CA/60": Number(onIceRow["CA/60"]) || 0,
      "CF%": Number(onIceRow["CF%"]) || 0,
      "iSCF/60": Number(individualRow["iSCF/60"]) || 0,
      "PTS/60": Number(individualRow["Total Points/60"]) || 0,
      "SOG/60": Number(individualRow["Shots/60"]) || 0,
      "A/60": Number(individualRow["Total Assists/60"]) || 0,
      "G/60": Number(individualRow["Goals/60"]) || 0,
      "GF/60": Number(onIceRow["GF/60"]) || 0,
      "GA/60": Number(onIceRow["GA/60"]) || 0,
      "GF%": Number(onIceRow["GF%"]) || 0,
      "A1/60": Number(individualRow["First Assists/60"]) || 0,
      "A2/60": Number(individualRow["Second Assists/60"]) || 0,
      "SF/60": Number(onIceRow["SF/60"]) || 0,
      "SA/60": Number(onIceRow["SA/60"]) || 0,
      "SF%": Number(onIceRow["SF%"]) || 0,
      "SCF/60": Number(onIceRow["SCF/60"]) || 0,
      "SCA/60": Number(onIceRow["SCA/60"]) || 0,
      "SCF%": Number(onIceRow["SCF%"]) || 0,
      "iCF/60": Number(individualRow["iCF/60"]) || 0,
      "iFF/60": Number(individualRow["iFF/60"]) || 0,
      "FF/60": Number(onIceRow["FF/60"]) || 0,
      "FA/60": Number(onIceRow["FA/60"]) || 0,
      "FF%": Number(onIceRow["FF%"]) || 0,
      "ixG/60": Number(individualRow["ixG/60"]) || 0,
      "xGF/60": Number(onIceRow["xGF/60"]) || 0,
      "xGA/60": Number(onIceRow["xGA/60"]) || 0,
      "xGF%": Number(onIceRow["xG%"]) || 0,
      "HDCF/60": Number(onIceRow["HDCF/60"]) || 0,
      "HDGF/60": Number(onIceRow["HDGF/60"]) || 0,
      "MDCF/60": Number(onIceRow["MDCF/60"]) || 0,
      "MDGF/60": Number(onIceRow["MDGF/60"]) || 0,
      "LDCF/60": Number(onIceRow["LDCF/60"]) || 0,
      "LDGF/60": Number(onIceRow["LDGF/60"]) || 0,
      "PIM/60": Number(individualRow["PIM/60"]) || 0,
      "HIT/60": Number(individualRow["Hits/60"]) || 0,
      "BLK/60": Number(individualRow["Shots Blocked/60"]) || 0
    });
  });

  // Use same addTotalRows for rates
  rateData.rates = addTotalRows<YearlyRate>(
    rateData.rates,
    ["season", "team"],
    [
      "TOI",
      "CF/60",
      "CA/60",
      "CF%",
      "iSCF/60",
      "PTS/60",
      "SOG/60",
      "A/60",
      "G/60",
      "GF/60",
      "GA/60",
      "GF%",
      "A1/60",
      "A2/60",
      "SF/60",
      "SA/60",
      "SF%",
      "SCF/60",
      "SCA/60",
      "SCF%",
      "iCF/60",
      "iFF/60",
      "FF/60",
      "FA/60",
      "FF%",
      "ixG/60",
      "xGF/60",
      "xGA/60",
      "xGF%",
      "HDCF/60",
      "HDGF/60",
      "MDCF/60",
      "MDGF/60",
      "LDCF/60",
      "LDGF/60",
      "PIM/60",
      "HIT/60",
      "BLK/60"
    ],
    (tot: YearlyRate) => {
      const totalTOI = tot.TOI;
      if (totalTOI > 0) {
        // Recompute /60 stats
        Object.keys(tot).forEach((key) => {
          if (key.endsWith("/60")) {
            const val = (tot as any)[key];
            (tot as any)[key] = (val / totalTOI) * 3600;
          }
        });
      }

      // Compute percentages
      tot["GF%"] =
        tot["GF/60"] + tot["GA/60"] > 0
          ? tot["GF/60"] / (tot["GF/60"] + tot["GA/60"])
          : 0;
      tot["CF%"] =
        tot["CF/60"] + tot["CA/60"] > 0
          ? tot["CF/60"] / (tot["CF/60"] + tot["CA/60"])
          : 0;
      tot["SF%"] =
        tot["SF/60"] + tot["SA/60"] > 0
          ? tot["SF/60"] / (tot["SF/60"] + tot["SA/60"])
          : 0;
      tot["FF%"] =
        tot["FF/60"] + tot["FA/60"] > 0
          ? tot["FF/60"] / (tot["FF/60"] + tot["FA/60"])
          : 0;
      tot["xGF%"] =
        tot["xGF/60"] + tot["xGA/60"] > 0
          ? tot["xGF/60"] / (tot["xGF/60"] + tot["xGA/60"])
          : 0;
      tot["SCF%"] =
        tot["SCF/60"] + tot["SCA/60"] > 0
          ? tot["SCF/60"] / (tot["SCF/60"] + tot["SCA/60"])
          : 0;
    }
  );

  const allSeasons = Array.from(
    new Set(rateData.rates.map((r) => r.season))
  ).sort((a, b) => b - a);
  const currentSeason = allSeasons[0];
  const seasonsToAverage = isThreeYear
    ? allSeasons.filter((s) => s !== currentSeason).slice(0, 3)
    : allSeasons.filter((s) => s !== currentSeason);

  if (isThreeYear && seasonsToAverage.length < 3) {
    throw new Error(
      "Not enough prior seasons to calculate three-year averages."
    );
  }
  if (!isThreeYear && seasonsToAverage.length < 1) {
    throw new Error("Not enough seasons to calculate career averages.");
  }

  const ratesForAverages: YearlyRate[] = seasonsToAverage.map((season) => {
    const totRow = rateData.rates.find(
      (rate) => rate.season === season && rate.team === "TOT"
    );
    if (totRow) return totRow;
    const singleRow = rateData.rates.find(
      (rate) => rate.season === season && rate.team !== "TOT"
    );
    if (singleRow) return singleRow;
    throw new Error(
      `No rate data available for Season ${season} to calculate averages.`
    );
  });

  const rateStats: (keyof YearlyRate)[] = [
    "CF/60",
    "CA/60",
    "iSCF/60",
    "PTS/60",
    "SOG/60",
    "A/60",
    "G/60",
    "GF/60",
    "GA/60",
    "A1/60",
    "A2/60",
    "SF/60",
    "SA/60",
    "SCF/60",
    "SCA/60",
    "iCF/60",
    "iFF/60",
    "FF/60",
    "FA/60",
    "ixG/60",
    "xGF/60",
    "xGA/60",
    "HDCF/60",
    "HDGF/60",
    "MDCF/60",
    "MDGF/60",
    "LDCF/60",
    "LDGF/60",
    "PIM/60",
    "HIT/60",
    "BLK/60"
  ];

  const aggregatedRates: { [key: string]: number } = {};
  rateStats.forEach((stat) => {
    aggregatedRates[stat] = 0;
  });

  ratesForAverages.forEach((rate) => {
    rateStats.forEach((stat) => {
      aggregatedRates[stat] += Number(rate[stat]);
    });
  });

  const divisor = isThreeYear ? 3 : seasonsToAverage.length;
  rateStats.forEach((stat) => {
    aggregatedRates[stat] /= divisor;
  });

  // Compute derived percentages for RatesData
  const ratesData: RatesData = {
    "CF/60": aggregatedRates["CF/60"],
    "CA/60": aggregatedRates["CA/60"],
    "iSCF/60": aggregatedRates["iSCF/60"],
    "PTS/60": aggregatedRates["PTS/60"],
    "SOG/60": aggregatedRates["SOG/60"],
    "A/60": aggregatedRates["A/60"],
    "G/60": aggregatedRates["G/60"],
    "GF/60": aggregatedRates["GF/60"],
    "GA/60": aggregatedRates["GA/60"],
    "A1/60": aggregatedRates["A1/60"],
    "A2/60": aggregatedRates["A2/60"],
    "SF/60": aggregatedRates["SF/60"],
    "SA/60": aggregatedRates["SA/60"],
    "SCF/60": aggregatedRates["SCF/60"],
    "SCA/60": aggregatedRates["SCA/60"],
    "iCF/60": aggregatedRates["iCF/60"],
    "iFF/60": aggregatedRates["iFF/60"],
    "FF/60": aggregatedRates["FF/60"],
    "FA/60": aggregatedRates["FA/60"],
    "ixG/60": aggregatedRates["ixG/60"],
    "xGF/60": aggregatedRates["xGF/60"],
    "xGA/60": aggregatedRates["xGA/60"],
    "HDCF/60": aggregatedRates["HDCF/60"],
    "HDGF/60": aggregatedRates["HDGF/60"],
    "MDCF/60": aggregatedRates["MDCF/60"],
    "MDGF/60": aggregatedRates["MDGF/60"],
    "LDCF/60": aggregatedRates["LDCF/60"],
    "LDGF/60": aggregatedRates["LDGF/60"],
    "PIM/60": aggregatedRates["PIM/60"],
    "HIT/60": aggregatedRates["HIT/60"],
    "BLK/60": aggregatedRates["BLK/60"],

    // Derived fields:
    "CF%":
      aggregatedRates["CF/60"] + aggregatedRates["CA/60"] > 0
        ? aggregatedRates["CF/60"] /
          (aggregatedRates["CF/60"] + aggregatedRates["CA/60"])
        : 0,
    "GF%":
      aggregatedRates["GF/60"] + aggregatedRates["GA/60"] > 0
        ? aggregatedRates["GF/60"] /
          (aggregatedRates["GF/60"] + aggregatedRates["GA/60"])
        : 0,
    "SF%":
      aggregatedRates["SF/60"] + aggregatedRates["SA/60"] > 0
        ? aggregatedRates["SF/60"] /
          (aggregatedRates["SF/60"] + aggregatedRates["SA/60"])
        : 0,
    "FF%":
      aggregatedRates["FF/60"] + aggregatedRates["FA/60"] > 0
        ? aggregatedRates["FF/60"] /
          (aggregatedRates["FF/60"] + aggregatedRates["FA/60"])
        : 0,
    "xGF%":
      aggregatedRates["xGF/60"] + aggregatedRates["xGA/60"] > 0
        ? aggregatedRates["xGF/60"] /
          (aggregatedRates["xGF/60"] + aggregatedRates["xGA/60"])
        : 0,
    "SCF%":
      aggregatedRates["SCF/60"] + aggregatedRates["SCA/60"] > 0
        ? aggregatedRates["SCF/60"] /
          (aggregatedRates["SCF/60"] + aggregatedRates["SCA/60"])
        : 0
  };

  return {
    yearlyData: rateData,
    averages: ratesData
  };
}
