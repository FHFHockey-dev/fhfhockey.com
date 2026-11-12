// Shared averages API service (/api/Averages and /api/ThreeYearAverages).
//
// One contract (AVERAGES_SCALE_CONTRACT, W3-3 D3/A2): TOI in seconds through
// the declared NST adapter; per-60 = count × 3600 ÷ seconds; traded-season
// (TOT) and multi-season values pooled by their own exposure or denominators
// (rule 26), never sums or means of rates or shares; every share on 0-100
// points; unknown cells and zero denominators stay null (rule 5).

import {
  AVERAGES_SCALE_CONTRACT,
  AveragesScaleContract,
  YearlyCounts,
  YearlyRates,
  Data,
  RatesData,
  YearlyCount,
  YearlyRate
} from "./types";
import {
  fetchPlayerData,
  nstNumber,
  nstToiSeconds,
  perSixty,
  seasonsForAverages,
  sharePoints,
  sumKnown
} from "./helpers";

type NstRow = { [key: string]: string };

// ---------------------------------------------------------------------------
// Counting report (rate=n)
// ---------------------------------------------------------------------------

const INDIVIDUAL_COUNTS = {
  GP: "GP",
  goals: "Goals",
  assists: "Total Assists",
  A1: "First Assists",
  A2: "Second Assists",
  SOG: "Shots",
  ixG: "ixG",
  iCF: "iCF",
  iFF: "iFF",
  iSCF: "iSCF",
  iHDCF: "iHDCF",
  PIM: "PIM",
  HIT: "Hits",
  BLK: "Shots Blocked"
} as const;

const ON_ICE_COUNTS = {
  oiGF: "GF",
  GF: "GF",
  GA: "GA",
  CF: "CF",
  CA: "CA",
  FF: "FF",
  FA: "FA",
  SF: "SF",
  SA: "SA",
  xGF: "xGF",
  xGA: "xGA",
  SCF: "SCF",
  SCA: "SCA",
  HDCF: "HDCF",
  HDGF: "HDGF",
  MDCF: "MDCF",
  MDGF: "MDGF",
  LDCF: "LDCF",
  LDGF: "LDGF",
  oZS: "Off. Zone Starts",
  dZS: "Def. Zone Starts"
} as const;

type CountKey =
  | keyof typeof INDIVIDUAL_COUNTS
  | keyof typeof ON_ICE_COUNTS
  | "TOI";
type Counts = Record<CountKey, number | null>;

const COUNT_KEYS = [
  "TOI",
  ...Object.keys(INDIVIDUAL_COUNTS),
  ...Object.keys(ON_ICE_COUNTS)
] as CountKey[];

type CountShares = Pick<
  YearlyCount,
  | "S%"
  | "oiSH%"
  | "secA%"
  | "IPP"
  | "oZS%"
  | "SOG/60"
  | "GF%"
  | "CF%"
  | "FF%"
  | "SF%"
  | "SCF%"
  | "xGF%"
>;

function readCounts(individual: NstRow, onIce: NstRow): Counts {
  const counts = { TOI: nstToiSeconds(individual["TOI"]) } as Counts;
  for (const [key, header] of Object.entries(INDIVIDUAL_COUNTS)) {
    counts[key as CountKey] = nstNumber(individual[header]);
  }
  for (const [key, header] of Object.entries(ON_ICE_COUNTS)) {
    counts[key as CountKey] = nstNumber(onIce[header]);
  }
  return counts;
}

/** Counts add: each key summed, null when any row's value is unknown. */
function sumCounts(rows: Counts[]): Counts {
  const total = {} as Counts;
  for (const key of COUNT_KEYS) {
    total[key] = sumKnown(...rows.map((row) => row[key]));
  }
  return total;
}

/** Every rate and share from its own components (0-100 points). */
function countShares(c: Counts): CountShares {
  const share = (forKey: CountKey, againstKey: CountKey) =>
    sharePoints(c[forKey], sumKnown(c[forKey], c[againstKey]));
  return {
    "S%": sharePoints(c.goals, c.SOG),
    "oiSH%": sharePoints(c.oiGF, c.SF),
    "secA%": sharePoints(c.A2, c.assists),
    IPP: sharePoints(sumKnown(c.goals, c.assists), c.oiGF),
    // OZS% = OZ / (OZ + DZ) (decision 9).
    "oZS%": share("oZS", "dZS"),
    "SOG/60": perSixty(c.SOG, c.TOI),
    "GF%": share("GF", "GA"),
    "CF%": share("CF", "CA"),
    "FF%": share("FF", "FA"),
    "SF%": share("SF", "SA"),
    "SCF%": share("SCF", "SCA"),
    "xGF%": share("xGF", "xGA")
  };
}

/** Individual and on-ice rows for one season-team stint, matched by key. */
function pairRows(individualRows: NstRow[], onIceRows: NstRow[]) {
  return individualRows.map((individual) => {
    const season = Number(individual["Season"]);
    const team = individual["Team"];
    const onIce = onIceRows.find(
      (row) => Number(row["Season"]) === season && row["Team"] === team
    );
    if (!onIce) {
      throw new Error(
        `Missing on-ice data for Season ${season} and Team ${team}.`
      );
    }
    return { season, team, individual, onIce };
  });
}

/** Seasons ascending; a traded season becomes one pooled "TOT" row. */
function bySeason<T extends { season: number }>(stints: T[]) {
  const seasons = new Map<number, T[]>();
  for (const stint of stints) {
    seasons.set(stint.season, [...(seasons.get(stint.season) ?? []), stint]);
  }
  return Array.from(seasons.entries()).sort(([a], [b]) => a - b);
}

/**
 * Gets three-year or career aggregated counting data and averages.
 * @param playerId - Player ID
 * @param isThreeYear - true for three-year averages, false for career averages
 * @param asOf - date that decides which season is still in progress
 */
export async function getAggregatedCountsData(
  playerId: string,
  isThreeYear: boolean,
  asOf: Date = new Date()
): Promise<{
  yearlyData: YearlyCounts;
  averages: Data;
  scaleContract: AveragesScaleContract;
}> {
  const { individualRows, onIceRows } = await fetchPlayerData(playerId, "n");
  const stints = pairRows(individualRows, onIceRows).map((stint) => ({
    season: stint.season,
    team: stint.team,
    counts: readCounts(stint.individual, stint.onIce)
  }));

  const yearData: YearlyCounts = {
    counts: bySeason(stints).map(([season, teams]) => {
      const counts =
        teams.length === 1
          ? teams[0].counts
          : sumCounts(teams.map((t) => t.counts));
      return {
        season,
        team: teams.length === 1 ? teams[0].team : "TOT",
        ...counts,
        ...countShares(counts)
      } as YearlyCount;
    })
  };

  const seasons = seasonsForAverages(
    stints.map((s) => s.season),
    isThreeYear,
    asOf
  );
  const pooled = sumCounts(
    stints.filter((s) => seasons.includes(s.season)).map((s) => s.counts)
  );
  const perSeason = (value: number | null) =>
    value == null ? null : value / seasons.length;
  const { TOI, ...counts } = pooled;
  const meanCounts = Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, perSeason(value)])
  ) as Omit<Counts, "TOI">;
  const shares = countShares(pooled);

  const averages: Data = {
    toi: perSeason(TOI),
    ...meanCounts,
    IPP: shares.IPP,
    "S%": shares["S%"],
    // Expected shooting % = ixG ÷ unblocked attempts (decision 17).
    "xS%": sharePoints(pooled.ixG, pooled.iFF),
    "SOG/60": shares["SOG/60"],
    "oZS%": shares["oZS%"],
    "oiSH%": shares["oiSH%"],
    "secA%": shares["secA%"],
    "GF%": shares["GF%"],
    "CF%": shares["CF%"],
    "FF%": shares["FF%"],
    "SF%": shares["SF%"],
    "SCF%": shares["SCF%"],
    "xGF%": shares["xGF%"]
  };

  return {
    yearlyData: yearData,
    averages,
    scaleContract: AVERAGES_SCALE_CONTRACT
  };
}

// ---------------------------------------------------------------------------
// Rate report (rate=y)
// ---------------------------------------------------------------------------

const INDIVIDUAL_RATES = {
  "iSCF/60": "iSCF/60",
  "PTS/60": "Total Points/60",
  "SOG/60": "Shots/60",
  "A/60": "Total Assists/60",
  "G/60": "Goals/60",
  "A1/60": "First Assists/60",
  "A2/60": "Second Assists/60",
  "iCF/60": "iCF/60",
  "iFF/60": "iFF/60",
  "ixG/60": "ixG/60",
  "PIM/60": "PIM/60",
  "HIT/60": "Hits/60",
  "BLK/60": "Shots Blocked/60"
} as const;

const ON_ICE_RATES = [
  "CF/60",
  "CA/60",
  "GF/60",
  "GA/60",
  "SF/60",
  "SA/60",
  "SCF/60",
  "SCA/60",
  "FF/60",
  "FA/60",
  "xGF/60",
  "xGA/60",
  "HDCF/60",
  "HDGF/60",
  "MDCF/60",
  "MDGF/60",
  "LDCF/60",
  "LDGF/60"
] as const;

type RateKey = keyof typeof INDIVIDUAL_RATES | (typeof ON_ICE_RATES)[number];
type Rates = Record<RateKey, number | null> & { TOI: number | null };

const RATE_KEYS = [
  ...Object.keys(INDIVIDUAL_RATES),
  ...ON_ICE_RATES
] as RateKey[];

const RATE_SHARES = {
  "CF%": ["CF/60", "CA/60"],
  "GF%": ["GF/60", "GA/60"],
  "SF%": ["SF/60", "SA/60"],
  "SCF%": ["SCF/60", "SCA/60"],
  "FF%": ["FF/60", "FA/60"],
  "xGF%": ["xGF/60", "xGA/60"]
} as const satisfies Record<string, readonly [RateKey, RateKey]>;

type RateShareKey = keyof typeof RATE_SHARES;

function readRates(individual: NstRow, onIce: NstRow): Rates {
  // The player's TOI; NST prints the same TOI in both tables.
  const rates = { TOI: nstToiSeconds(onIce["TOI"]) } as Rates;
  for (const [key, header] of Object.entries(INDIVIDUAL_RATES)) {
    rates[key as RateKey] = nstNumber(individual[header]);
  }
  for (const key of ON_ICE_RATES) {
    rates[key] = nstNumber(onIce[key]);
  }
  return rates;
}

/**
 * Rates pool by TOI: Σ(rate × TOI) ÷ Σ TOI, i.e. the implied counts over the
 * pooled exposure. Null when any row's rate or TOI is unknown.
 */
function poolRates(rows: Rates[]): Rates {
  const TOI = sumKnown(...rows.map((row) => row.TOI));
  const pooled = { TOI } as Rates;
  for (const key of RATE_KEYS) {
    const implied = sumKnown(
      ...rows.map((row) =>
        row[key] == null || row.TOI == null ? null : row[key]! * row.TOI
      )
    );
    pooled[key] = TOI == null || TOI <= 0 || implied == null ? null : implied / TOI;
  }
  return pooled;
}

/** On-ice shares from pooled rates (the common TOI cancels), 0-100 points. */
function rateShares(r: Rates): Record<RateShareKey, number | null> {
  return Object.fromEntries(
    Object.entries(RATE_SHARES).map(([share, [forKey, againstKey]]) => [
      share,
      sharePoints(r[forKey], sumKnown(r[forKey], r[againstKey]))
    ])
  ) as Record<RateShareKey, number | null>;
}

/**
 * Gets three-year or career aggregated rate data and averages.
 * @param playerId - Player ID
 * @param isThreeYear - true for three-year averages, false for career averages
 * @param asOf - date that decides which season is still in progress
 */
export async function getAggregatedRatesData(
  playerId: string,
  isThreeYear: boolean,
  asOf: Date = new Date()
): Promise<{
  yearlyData: YearlyRates;
  averages: RatesData;
  scaleContract: AveragesScaleContract;
}> {
  const { individualRows, onIceRows } = await fetchPlayerData(playerId, "y");
  const stints = pairRows(individualRows, onIceRows).map((stint) => ({
    season: stint.season,
    team: stint.team,
    rates: readRates(stint.individual, stint.onIce)
  }));

  const rateData: YearlyRates = {
    rates: bySeason(stints).map(([season, teams]) => {
      const rates =
        teams.length === 1 ? teams[0].rates : poolRates(teams.map((t) => t.rates));
      return {
        season,
        team: teams.length === 1 ? teams[0].team : "TOT",
        ...rates,
        ...rateShares(rates)
      } as YearlyRate;
    })
  };

  const seasons = seasonsForAverages(
    stints.map((s) => s.season),
    isThreeYear,
    asOf
  );
  const { TOI: _toi, ...pooled } = poolRates(
    stints.filter((s) => seasons.includes(s.season)).map((s) => s.rates)
  );

  return {
    yearlyData: rateData,
    averages: { ...pooled, ...rateShares({ TOI: _toi, ...pooled }) },
    scaleContract: AVERAGES_SCALE_CONTRACT
  };
}
