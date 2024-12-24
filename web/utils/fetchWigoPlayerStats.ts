// web/utils/fetchWigoPlayerStats.ts

import {
  SkaterStat,
  TableAggregateData,
  CombinedPlayerStats,
  ThreeYearAveragesResponse,
  YearlyCount,
  YearlyRate
} from "components/WiGO/types";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import supabase from "lib/supabase";
import { fetchThreeYearAverages } from "components/WiGO/fetchThreeYearAverages";

/**
 * Define a type that includes only the numeric keys of SkaterStat.
 */
type NumericSkaterStatKey =
  | "goals"
  | "assists"
  | "shots"
  | "pp_assists"
  | "pp_goals"
  | "ppp"
  | "hits"
  | "blocked_shots"
  | "penalty_minutes"
  | "ixG"
  | "toi_per_game"
  | "pp_toi_per_game"
  | "pp_toi_pct_per_game";

/**
 * Configuration for each statistic, defining labels and aggregation methods.
 */
interface StatConfig {
  key: NumericSkaterStatKey;
  countsLabel: string;
  ratesLabel: string;
  isDerived?: boolean; // Indicates if the stat is derived from other stats
  deriveKeys?: NumericSkaterStatKey[]; // Keys to sum if derived
}

/**
 * Mapping for rate statistics to determine their data sources and relevant fields.
 */
const rateCA3YAMap: Record<
  string,
  { source: "api" | "supabase"; fields?: string[] }
> = {
  "G/60": { source: "api" },
  "A/60": { source: "api", fields: ["A1/60", "A2/60"] },
  "SOG/60": { source: "api" },
  "PPA/60": {
    source: "supabase",
    fields: ["pp_primary_assists_per_60_avg", "pp_secondary_assists_per_60_avg"]
  },
  "PPG/60": { source: "supabase", fields: ["pp_goals_per_60_avg"] },
  "PPP/60": { source: "supabase", fields: ["pp_points_per_60_avg"] },
  "BLK/60": { source: "api" },
  "PIM/60": { source: "api" },
  "ixG/60": { source: "api" },
  "HIT/60": { source: "api" } // Ensured inclusion
};

/**
 * Mapping from row.label to Supabase column names for rate statistics that derive CA and 3YA from Supabase.
 */
const supabaseLabelMap: Record<string, string> = {
  GP: "games_played_avg",
  G: "goals_avg",
  A: "assists_avg",
  SOG: "shots_avg",
  BLK: "blocked_shots_avg",
  HIT: "hits_avg",
  PIM: "penalty_minutes_avg",
  PPP: "pp_points_avg",
  PPG: "pp_goals_avg",
  PPA: "pp_assists_avg",
  ATOI: "toi_per_game_avg",
  "PPTOI/GM": "pp_toi_per_game_avg",
  "PP%": "pp_toi_pct_per_game_avg"
  // Rates handled separately by rateCA3YAMap
};

// e.g. a new map for LY usage
const supabaseLyMap: Record<string, string> = {
  G: "goals",
  A: "assists",
  SOG: "shots",
  BLK: "blocked_shots",
  HIT: "hits",
  PIM: "penalty_minutes",
  PPP: "pp_points",
  PPG: "pp_goals",
  PPA: "pp_assists",
  ixG: "ixG"
};

/**
 * Function to apply Career Averages (CA) and Three-Year Averages (3YA) to the table data.
 *
 * @param {TableAggregateData[]} tableData - The data rows to update.
 * @param {any} careerObj - The career averages object from Supabase.
 * @param {any} threeObj - The three-year averages object from Supabase.
 * @param {"counts" | "rates"} tableType - Indicates whether the table is Counts or Rates.
 * @param {ThreeYearAveragesResponse | undefined} threeYearApi - (Optional) The three-year averages from the API.
 */
function applyAverages(
  tableData: TableAggregateData[],
  careerObj: any,
  threeObj: any,
  tableType: "counts" | "rates",
  threeYearApi?: ThreeYearAveragesResponse
) {
  tableData.forEach((row) => {
    const label = row.label;

    if (tableType === "rates") {
      // **Handle Rate Statistics as before**
      if (rateCA3YAMap[label]) {
        const mapping = rateCA3YAMap[label];

        if (mapping.source === "supabase" && mapping.fields) {
          // Sum specified fields from Supabase career averages
          const caValue = mapping.fields.reduce((sum, field) => {
            const fieldValue = careerObj ? careerObj[field] : 0;
            return sum + (typeof fieldValue === "number" ? fieldValue : 0);
          }, 0);

          const threeYAValue = mapping.fields.reduce((sum, field) => {
            const fieldValue = threeObj ? threeObj[field] : 0;
            return sum + (typeof fieldValue === "number" ? fieldValue : 0);
          }, 0);

          row.CA = caValue;
          row.threeYA = threeYAValue;
        } else if (mapping.source === "api") {
          // Assign CA and 3YA from the ThreeYearAverages API
          if (threeYearApi) {
            if (label === "A/60") {
              row.CA =
                (threeYearApi.careerAverageRates["A1/60"] || 0) +
                (threeYearApi.careerAverageRates["A2/60"] || 0);
              row.threeYA =
                (threeYearApi.threeYearRatesAverages["A1/60"] || 0) +
                (threeYearApi.threeYearRatesAverages["A2/60"] || 0);
            } else {
              row.CA =
                threeYearApi.careerAverageRates[
                  label as keyof typeof threeYearApi.careerAverageRates
                ] || 0;
              row.threeYA =
                threeYearApi.threeYearRatesAverages[
                  label as keyof typeof threeYearApi.threeYearRatesAverages
                ] || 0;
            }
          } else {
            console.warn(
              `API data unavailable for rate statistic: ${label}. Setting CA and 3YA to 0.`
            );
            row.CA = 0;
            row.threeYA = 0;
          }
        }
      }
    } else if (tableType === "counts") {
      // **Handling Counts Statistics**
      if (label === "ixG") {
        // **Special Case: ixG in Counts Table**
        if (threeYearApi && careerObj && threeObj) {
          // Assign ixG from the API data
          row.CA = threeYearApi.careerAverageCounts["ixG"] || 0; // careerAverageCounts.ixG
          row.threeYA = threeYearApi.threeYearCountsAverages["ixG"] || 0; // threeYearCountsAverages.ixG
          console.log(`Assigned ixG: CA=${row.CA}, 3YA=${row.threeYA}`);
        } else {
          console.warn(
            `API data unavailable for ixG in Counts table. Setting CA and 3YA to 0.`
          );
          row.CA = 0;
          row.threeYA = 0;
        }
      } else if (supabaseLabelMap[label]) {
        // Handle other counts statistics via supabaseLabelMap
        const supaField = supabaseLabelMap[label];
        const caValue = careerObj ? careerObj[supaField] || 0 : 0;
        const threeYAValue = threeObj ? threeObj[supaField] || 0 : 0;

        row.CA = caValue;
        row.threeYA = threeYAValue;
      }
    }

    // Handle Other Labels (if any)
    else {
      // No action needed for other labels
    }
  });
}

/** -------------------------------------------------------------------------- */
/** HELPER FUNCTIONS FOR LY OVERRIDES                                          */
/** -------------------------------------------------------------------------- */

/**
 * Fetch a single row from wgo_skater_stats_totals for the given player & season.
 */
async function fetchPreviousSeasonTotalsRow(
  playerId: number,
  previousSeasonId: number
) {
  const { data, error } = await supabase
    .from("wgo_skater_stats_totals")
    .select("*")
    .eq("player_id", playerId)
    .eq("season", previousSeasonId.toString()) // <-- Convert to string // season is TEXT in the supabase
    .limit(1);

  if (error) {
    console.error(
      "Error fetching previous season totals from Supabase:",
      error
    );
    return null;
  }
  if (!data || data.length === 0) {
    console.warn(
      `No row found in wgo_skater_stats_totals for player=${playerId}, season=${previousSeasonId}.`
    );
    return null;
  }
  return data[0];
}

/**
 * Find the matching YearlyCount object in threeYearApiData for previousSeasonId.
 */
function findPreviousSeasonCounts(
  threeYearApiData: ThreeYearAveragesResponse | null,
  previousSeasonId: number | undefined
): YearlyCount | null {
  if (!threeYearApiData || !previousSeasonId) return null;
  const found = threeYearApiData.yearlyCounts.counts.find(
    (c) => c.season === previousSeasonId
  );
  return found || null;
}

/**
 * Find the matching YearlyRate object in threeYearApiData for previousSeasonId.
 */
function findPreviousSeasonRates(
  threeYearApiData: ThreeYearAveragesResponse | null,
  previousSeasonId: number | undefined
): YearlyRate | null {
  if (!threeYearApiData || !previousSeasonId) return null;
  const found = threeYearApiData.yearlyRates.rates.find(
    (r) => r.season === previousSeasonId
  );
  return found || null;
}

/**
 * Final pass to override the .LY column in each row with data from:
 *  1. wgo_skater_stats_totals => previousSeasonTotalsRow
 *  2. threeYearAverages API => previousSeasonCounts or previousSeasonRates
 */
function applyLastYearOverrides(
  tableData: TableAggregateData[],
  tableType: "counts" | "rates",
  previousSeasonTotalsRow: any,
  previousSeasonCounts: YearlyCount | null,
  previousSeasonRates: YearlyRate | null
) {
  tableData.forEach((row) => {
    const { label } = row;

    if (tableType === "counts") {
      if (label === "ixG") {
        // Example: 'ixG' is from the API in your code
        if (previousSeasonCounts) {
          row.LY = previousSeasonCounts.ixG || 0;
        }
      } else if (label === "GP") {
        // 'GP' can come from Supabase or from the API; choose whichever is correct
        // Suppose we trust Supabase first
        if (
          previousSeasonTotalsRow &&
          "games_played" in previousSeasonTotalsRow
        ) {
          row.LY = previousSeasonTotalsRow.games_played;
        } else if (previousSeasonCounts) {
          row.LY = previousSeasonCounts.GP || row.LY;
        }
      } else if (label in supabaseLyMap) {
        const rawStatKey = supabaseLyMap[label]; // e.g. "goals"
        if (previousSeasonTotalsRow && rawStatKey in previousSeasonTotalsRow) {
          row.LY = previousSeasonTotalsRow[rawStatKey];
        }
      } else {
        // If some other label is from the API, you could handle it here
        // e.g., if label === "PPP" and you store that in yearlyCounts => PPP?
        // if (previousSeasonCounts) { row.LY = previousSeasonCounts.ppp; }
      }
    } else {
      // tableType === "rates"
      if (rateCA3YAMap[label]) {
        const mapping = rateCA3YAMap[label];
        if (mapping.source === "supabase") {
          // If you store per-60 stats in wgo_skater_stats_totals, fetch them here
          // e.g. "goals_per_60" if label === "G/60"
          // row.LY = ...
        } else if (mapping.source === "api") {
          // Then we use previousSeasonRates
          if (previousSeasonRates) {
            const val = previousSeasonRates[label];

            if (typeof val === "number") {
              row.LY = val; // safe assignment
            }
            // else do nothing => row.LY stays as is
          }
        }
      }
    }
  });
}

/**
 * Fetches and aggregates player statistics for Counts and Rates from Supabase,
 * then merges in Career Averages (CA) and Three-Year Averages (3YA) from
 * wgo_career_averages, wgo_three_year_averages, and the ThreeYearAverages API.
 *
 * @param {number} playerId - The ID of the selected player.
 * @returns {Promise<CombinedPlayerStats>} - Aggregated counts and rates data combined from all sources.
 */
export async function fetchPlayerAggregatedStats(
  playerId: number
): Promise<CombinedPlayerStats> {
  // 1) Fetch current season information
  const currentSeasonInfo = await fetchCurrentSeason();
  console.log("Current Season Info:", currentSeasonInfo);
  const currentSeasonId = currentSeasonInfo.id;
  let previousSeasonId: number | undefined;

  // Determine previous season ID (custom logic)
  if ("idPrev" in currentSeasonInfo && currentSeasonInfo.idPrev) {
    previousSeasonId = currentSeasonInfo.idPrev;
  } else if (
    "previousSeason" in currentSeasonInfo &&
    currentSeasonInfo.previousSeason
  ) {
    previousSeasonId = currentSeasonInfo.previousSeason.id;
  } else {
    previousSeasonId = currentSeasonInfo.idTwo;
  }

  console.log("Current Season ID:", currentSeasonId);
  console.log("Previous Season ID:", previousSeasonId);

  // 2) Fetch all games for the selected player from wgo_skater_stats
  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("*, pp_toi_pct_per_game")
    .eq("player_id", playerId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching player stats from Supabase:", error);
    throw new Error("Failed to fetch player statistics from Supabase.");
  }

  if (!data || data.length === 0) {
    console.warn("No game data found for the selected player in Supabase.");
    // We can still proceed to fetch CA/3YA if needed
  }

  const games = data as SkaterStat[];

  // Filter and sort games for current and previous seasons
  const currentSeasonGames = games
    .filter((g) => g.season_id === currentSeasonId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const previousSeasonGames = previousSeasonId
    ? games
        .filter((g) => g.season_id === previousSeasonId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  console.log(`Player ID: ${playerId}`);
  console.log(
    `Current Season Games (Total: ${currentSeasonGames.length}):`,
    currentSeasonGames
  );
  console.log(
    `Previous Season Games (Total: ${previousSeasonGames.length}):`,
    previousSeasonGames
  );

  // *** Fetch the single row from wgo_skater_stats_totals for previous season
  let previousSeasonTotalsRow: any = null;
  if (previousSeasonId) {
    previousSeasonTotalsRow = await fetchPreviousSeasonTotalsRow(
      playerId,
      previousSeasonId
    );
  }

  // 3) Define stats to aggregate
  const statConfigs: StatConfig[] = [
    { key: "goals", countsLabel: "G", ratesLabel: "G/60" },
    { key: "assists", countsLabel: "A", ratesLabel: "A/60" },
    { key: "shots", countsLabel: "SOG", ratesLabel: "SOG/60" },
    { key: "pp_assists", countsLabel: "PPA", ratesLabel: "PPA/60" },
    { key: "pp_goals", countsLabel: "PPG", ratesLabel: "PPG/60" },
    {
      key: "ppp",
      countsLabel: "PPP",
      ratesLabel: "PPP/60",
      isDerived: true,
      deriveKeys: ["pp_assists", "pp_goals"]
    },
    { key: "hits", countsLabel: "HIT", ratesLabel: "HIT/60" },
    { key: "blocked_shots", countsLabel: "BLK", ratesLabel: "BLK/60" },
    { key: "penalty_minutes", countsLabel: "PIM", ratesLabel: "PIM/60" },
    { key: "ixG", countsLabel: "ixG", ratesLabel: "ixG/60" }
  ];

  // 4) Initialize countsData & ratesData with separate initializations
  const initializeCountsData = (): TableAggregateData[] => [
    {
      label: "GP",
      CA: 0,
      threeYA: 0,
      LY: previousSeasonGames.length,
      L5: Math.min(5, currentSeasonGames.length),
      L10: Math.min(10, currentSeasonGames.length),
      L20: Math.min(20, currentSeasonGames.length),
      STD: currentSeasonGames.length
    }
  ];

  const initializeRatesData = (): TableAggregateData[] => [];

  const countsData: TableAggregateData[] = initializeCountsData();
  const ratesData: TableAggregateData[] = initializeRatesData();

  // Helpers to sum stats or compute per60
  function sumStat(gs: SkaterStat[], stat: NumericSkaterStatKey) {
    return gs.reduce((sum, g) => sum + (g[stat] || 0), 0);
  }

  function calculatePer60(gs: SkaterStat[], stat: NumericSkaterStatKey) {
    const total = sumStat(gs, stat);
    // For power play stats, use pp_toi_per_game; otherwise toi_per_game
    const powerPlayStats: NumericSkaterStatKey[] = [
      "pp_assists",
      "pp_goals",
      "ppp"
    ];
    const toiStat = powerPlayStats.includes(stat)
      ? "pp_toi_per_game"
      : "toi_per_game";

    const totalTOI = sumStat(gs, toiStat);
    if (totalTOI <= 0) return 0;

    const val = (total / totalTOI) * 3600;
    return Math.round(val * 100) / 100;
  }

  // More helper functions for ATOI, PPTOI, etc.
  function averageToiPerGame(gs: SkaterStat[]) {
    if (gs.length === 0) return 0;
    const totalTOI = sumStat(gs, "toi_per_game");
    return Math.round(totalTOI / gs.length);
  }

  function averagePPToiPerGame(gs: SkaterStat[]) {
    if (gs.length === 0) return 0;
    const totalPP = sumStat(gs, "pp_toi_per_game");
    return Math.round((totalPP / gs.length) * 100) / 100;
  }

  function averagePpToiPctPerGame(gs: SkaterStat[]) {
    if (gs.length === 0) return 0;
    const totalPct = sumStat(gs, "pp_toi_pct_per_game");
    return Math.round((totalPct / gs.length) * 1000) / 10; // e.g., 61.6
  }

  // Rows for ATOI, PPTOI/GM, PP%
  function createATOIRow(
    gs: SkaterStat[],
    prev: SkaterStat[]
  ): TableAggregateData {
    return {
      label: "ATOI",
      CA: 0,
      threeYA: 0,
      LY: averageToiPerGame(prev),
      L5: averageToiPerGame(gs.slice(0, 5)),
      L10: averageToiPerGame(gs.slice(0, 10)),
      L20: averageToiPerGame(gs.slice(0, 20)),
      STD: sumStat(gs, "toi_per_game") // or averageToiPerGame(gs), your choice
    };
  }

  function createPPToiRow(gs: SkaterStat[], prev: SkaterStat[]) {
    return {
      label: "PPTOI/GM",
      CA: 0,
      threeYA: 0,
      LY: averagePPToiPerGame(prev),
      L5: averagePPToiPerGame(gs.slice(0, 5)),
      L10: averagePPToiPerGame(gs.slice(0, 10)),
      L20: averagePPToiPerGame(gs.slice(0, 20)),
      STD: averagePPToiPerGame(gs)
    };
  }

  function createPPPctRow(gs: SkaterStat[], prev: SkaterStat[]) {
    return {
      label: "PP%",
      CA: 0,
      threeYA: 0,
      LY: averagePpToiPctPerGame(prev),
      L5: averagePpToiPctPerGame(gs.slice(0, 5)),
      L10: averagePpToiPctPerGame(gs.slice(0, 10)),
      L20: averagePpToiPctPerGame(gs.slice(0, 20)),
      STD: averagePpToiPctPerGame(gs)
    };
  }

  // Insert these special rows into countsData
  countsData.splice(
    1,
    0,
    createATOIRow(currentSeasonGames, previousSeasonGames)
  );
  countsData.splice(
    6,
    0,
    createPPToiRow(currentSeasonGames, previousSeasonGames)
  );
  countsData.splice(
    7,
    0,
    createPPPctRow(currentSeasonGames, previousSeasonGames)
  );

  // Aggregation for counts & rates
  function aggregateStats(
    configs: StatConfig[],
    currentGames: SkaterStat[],
    prevGames: SkaterStat[],
    isRate: boolean
  ): TableAggregateData[] {
    return configs.map((conf) => {
      const { key, countsLabel, ratesLabel, isDerived, deriveKeys } = conf;
      const label = isRate ? ratesLabel : countsLabel;

      // Summations
      const LYVal =
        isDerived && deriveKeys
          ? deriveKeys.reduce((sum, k) => sum + sumStat(prevGames, k), 0)
          : sumStat(prevGames, key);

      const L5Val =
        isDerived && deriveKeys
          ? deriveKeys.reduce(
              (sum, k) => sum + sumStat(currentGames.slice(0, 5), k),
              0
            )
          : sumStat(currentGames.slice(0, 5), key);

      const L10Val =
        isDerived && deriveKeys
          ? deriveKeys.reduce(
              (sum, k) => sum + sumStat(currentGames.slice(0, 10), k),
              0
            )
          : sumStat(currentGames.slice(0, 10), key);

      const L20Val =
        isDerived && deriveKeys
          ? deriveKeys.reduce(
              (sum, k) => sum + sumStat(currentGames.slice(0, 20), k),
              0
            )
          : sumStat(currentGames.slice(0, 20), key);

      const STDVal =
        isDerived && deriveKeys
          ? deriveKeys.reduce((sum, k) => sum + sumStat(currentGames, k), 0)
          : sumStat(currentGames, key);

      // For rates, calculate per-60
      const LY_Rate = isRate ? calculatePer60(prevGames, key) : LYVal;
      const L5_Rate = isRate
        ? calculatePer60(currentGames.slice(0, 5), key)
        : L5Val;
      const L10_Rate = isRate
        ? calculatePer60(currentGames.slice(0, 10), key)
        : L10Val;
      const L20_Rate = isRate
        ? calculatePer60(currentGames.slice(0, 20), key)
        : L20Val;
      const STD_Rate = isRate ? calculatePer60(currentGames, key) : STDVal;

      return {
        label,
        CA: 0, // to be filled from career table or API
        threeYA: 0, // to be filled from 3-year table or API
        LY: isRate ? LY_Rate : LYVal,
        L5: isRate ? L5_Rate : L5Val,
        L10: isRate ? L10_Rate : L10Val,
        L20: isRate ? L20_Rate : L20Val,
        STD: isRate ? STD_Rate : STDVal
      };
    });
  }

  const aggregatedCounts = aggregateStats(
    statConfigs,
    currentSeasonGames,
    previousSeasonGames,
    false
  );
  const aggregatedRates = aggregateStats(
    statConfigs,
    currentSeasonGames,
    previousSeasonGames,
    true
  );

  countsData.push(...aggregatedCounts);
  ratesData.push(...aggregatedRates);

  // 15) Fetch Career Averages and 3-Year Averages from Supabase
  const { data: careerRows, error: careerError } = await supabase
    .from("wgo_career_averages")
    .select("*")
    .eq("player_id", playerId)
    .limit(1);

  if (careerError) {
    console.error("Error fetching career averages:", careerError);
  }
  const careerAvg = careerRows && careerRows.length > 0 ? careerRows[0] : null;

  const { data: threeYearRows, error: threeYearError } = await supabase
    .from("wgo_three_year_averages")
    .select("*")
    .eq("player_id", playerId)
    .limit(1);

  if (threeYearError) {
    console.error("Error fetching 3-year averages:", threeYearError);
  }
  const threeYearAvg =
    threeYearRows && threeYearRows.length > 0 ? threeYearRows[0] : null;

  // 16) Fetch Three-Year Averages from API
  let threeYearApiData: ThreeYearAveragesResponse | null = null;
  try {
    threeYearApiData = await fetchThreeYearAverages(playerId);
    console.log("ThreeYearAverages API Data:", threeYearApiData); // For debugging
  } catch (apiError) {
    console.error("Error fetching Three-Year Averages from API:", apiError);
  }

  // 17) Apply Career Averages and Three-Year Averages to Counts and Rates
  if (careerAvg || threeYearAvg || threeYearApiData) {
    applyAverages(
      countsData,
      careerAvg,
      threeYearAvg,
      "counts", // Indicate counts table
      threeYearApiData || undefined // Optional parameter
    );
    applyAverages(
      ratesData,
      careerAvg,
      threeYearAvg,
      "rates", // Indicate rates table
      threeYearApiData || undefined // Optional parameter
    );
  }

  // ---------------------------------------------
  // NEW LOGIC: Find the matching objects in the API for the previousSeason
  // ---------------------------------------------
  const previousSeasonCountsObj = findPreviousSeasonCounts(
    threeYearApiData,
    previousSeasonId
  );
  const previousSeasonRatesObj = findPreviousSeasonRates(
    threeYearApiData,
    previousSeasonId
  );

  // 19) Override the LY column from the correct source
  applyLastYearOverrides(
    countsData,
    "counts",
    previousSeasonTotalsRow,
    previousSeasonCountsObj,
    null // Not needed for counts
  );
  applyLastYearOverrides(
    ratesData,
    "rates",
    previousSeasonTotalsRow,
    null, // Not needed for rates
    previousSeasonRatesObj
  );

  // 18) Return the final result
  return {
    counts: countsData,
    rates: ratesData,

    threeYearCountsAverages: threeYearAvg ?? {},
    threeYearRatesAverages: threeYearAvg ?? {},
    careerAverageCounts: careerAvg ?? {},
    careerAverageRates: careerAvg ?? {},

    threeYearApiData: threeYearApiData ?? undefined
  };
}
