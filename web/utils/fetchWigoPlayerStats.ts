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
import supabase from "lib/supabase"; // Ensure this points to your Supabase client instance
import { fetchThreeYearAverages } from "components/WiGO/fetchThreeYearAverages";

// --- Type for nst_gamelog_as_counts data ---
interface NstGameLog {
  ixg: number | null;
  date_scraped: string; // Assuming date is stored as string/text or fetched as string
  season: string; // Added season for filtering
  // Add other fields if needed later
}

// --- NumericSkaterStatKey only includes keys reliably from SkaterStat (wgo_skater_stats) ---
type NumericSkaterStatKey =
  | "goals"
  | "assists"
  | "shots"
  | "pp_assists"
  | "pp_goals"
  | "ppp" // This is derived
  | "hits"
  | "blocked_shots"
  | "penalty_minutes"
  | "toi_per_game"
  | "pp_toi_per_game"
  | "pp_toi_pct_per_game";

interface StatConfig {
  key: NumericSkaterStatKey | "ixG";
  countsLabel: string;
  ratesLabel: string;
  isDerived?: boolean;
  deriveKeys?: NumericSkaterStatKey[];
}
// ----------------------------------------------------

/**
 * Mapping for rate statistics' CA/3YA sources.
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
  "HIT/60": { source: "api" }
};

/**
 * Mapping for count statistics' CA/3YA sources (Supabase averages table).
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
  PPTOI: "pp_toi_per_game_avg",
  "PP%": "pp_toi_pct_per_game_avg"
};

/**
 * Mapping for count statistics' LY source (Supabase totals table).
 */
const supabaseLyMap: Record<string, string> = {
  G: "goals",
  A: "assists", // Assuming total assists
  SOG: "shots",
  BLK: "blocked_shots", // Make sure column name matches wgo_skater_stats_totals
  HIT: "hits",
  PIM: "penalty_minutes",
  PPP: "pp_points",
  PPG: "pp_goals",
  PPA: "pp_assists"
  // ixG LY source is API (handled in applyLastYearOverrides)
  // GP LY source is handled specially in applyLastYearOverrides
  // ATOI, PPTOI, PP% LY are calculated directly
};

// #region Helper Functions
// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Function to apply Career Averages (CA) and Three-Year Averages (3YA) to the table data.
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
      // Handle Rate Statistics CA/3YA
      if (rateCA3YAMap[label]) {
        const mapping = rateCA3YAMap[label];

        if (mapping.source === "supabase" && mapping.fields) {
          // Sum specified fields from Supabase career/3yr averages
          const caValue = mapping.fields.reduce((sum, field) => {
            const fieldValue = careerObj ? careerObj[field] : 0;
            return sum + (typeof fieldValue === "number" ? fieldValue : 0);
          }, 0);
          const threeYAValue = mapping.fields.reduce((sum, field) => {
            const fieldValue = threeObj ? threeObj[field] : 0;
            return sum + (typeof fieldValue === "number" ? fieldValue : 0);
          }, 0);
          row.CA = caValue;
          row["3YA"] = threeYAValue;
        } else if (mapping.source === "api") {
          // Assign CA and 3YA from the ThreeYearAverages API response
          if (threeYearApi) {
            if (label === "A/60") {
              // Special case for combined assists rate
              row.CA =
                (threeYearApi.careerAverageRates["A1/60"] || 0) +
                (threeYearApi.careerAverageRates["A2/60"] || 0);
              row["3YA"] =
                (threeYearApi.threeYearRatesAverages["A1/60"] || 0) +
                (threeYearApi.threeYearRatesAverages["A2/60"] || 0);
            } else {
              row.CA =
                threeYearApi.careerAverageRates[
                  label as keyof typeof threeYearApi.careerAverageRates // Ensure label is a valid key
                ] || 0;
              row["3YA"] =
                threeYearApi.threeYearRatesAverages[
                  label as keyof typeof threeYearApi.threeYearRatesAverages
                ] || 0;
            }
          } else {
            // Fallback if API data is missing
            console.warn(`API data missing for rate CA/3YA: ${label}`);
            row.CA = 0;
            row["3YA"] = 0;
          }
        }
      }
    } else if (tableType === "counts") {
      // Handle Count Statistics CA/3YA
      if (label === "ixG") {
        // ixG CA/3YA comes solely from the API data
        if (threeYearApi) {
          row.CA = threeYearApi.careerAverageCounts["ixG"] || 0;
          row["3YA"] = threeYearApi.threeYearCountsAverages["ixG"] || 0;
        } else {
          console.warn(`API data missing for count CA/3YA: ${label}`);
          row.CA = 0;
          row["3YA"] = 0;
        }
      } else if (supabaseLabelMap[label]) {
        // Other counts CA/3YA come from Supabase average tables
        const supaField = supabaseLabelMap[label];
        let caValue = careerObj ? careerObj[supaField] || 0 : 0;
        let threeYAValue = threeObj ? threeObj[supaField] || 0 : 0;

        // FIX FOR PP% FORMAT: Multiply DB value (0.xx) by 100
        if (label === "PP%") {
          if (typeof caValue === "number") caValue *= 100;
          if (typeof threeYAValue === "number") threeYAValue *= 100;
        }

        row.CA = caValue;
        row["3YA"] = threeYAValue;
      }
    }
  });
}

/**
 * Fetch a single row from wgo_skater_stats_totals for the given player & season.
 */
async function fetchPreviousSeasonTotalsRow(
  playerId: number,
  previousSeasonId: number
) {
  const { data, error } = await supabase
    .from("wgo_skater_stats_totals")
    .select("*") // Consider selecting specific columns if table is wide
    .eq("player_id", playerId)
    .eq("season", previousSeasonId.toString()) // Ensure season is string for text column match
    .limit(1)
    .maybeSingle(); // Use maybeSingle for potentially null result

  if (error) {
    console.error(
      "Error fetching previous season totals from Supabase:",
      error
    );
    return null;
  }
  if (!data) {
    console.warn(
      `No row found in wgo_skater_stats_totals for player=${playerId}, season=${previousSeasonId}.`
    );
  }
  return data; // Can be null if no row found
}

/**
 * Find the matching YearlyCount object in threeYearApiData for previousSeasonId.
 */
function findPreviousSeasonCounts(
  threeYearApiData: ThreeYearAveragesResponse | null,
  previousSeasonId: number | undefined
): YearlyCount | null {
  if (!threeYearApiData?.yearlyCounts?.counts || !previousSeasonId) return null;
  return (
    threeYearApiData.yearlyCounts.counts.find(
      (c) => c.season === previousSeasonId
    ) || null
  );
}

/**
 * Find the matching YearlyRate object in threeYearApiData for previousSeasonId.
 */
function findPreviousSeasonRates(
  threeYearApiData: ThreeYearAveragesResponse | null,
  previousSeasonId: number | undefined
): YearlyRate | null {
  if (!threeYearApiData?.yearlyRates?.rates || !previousSeasonId) return null;
  return (
    threeYearApiData.yearlyRates.rates.find(
      (r) => r.season === previousSeasonId
    ) || null
  );
}

/**
 * Final pass to override the .LY column in each row with data from correct sources.
 */
function applyLastYearOverrides(
  tableData: TableAggregateData[],
  tableType: "counts" | "rates",
  previousSeasonTotalsRow: any | null, // Can be null
  previousSeasonCounts: YearlyCount | null, // From API
  previousSeasonRates: YearlyRate | null // From API
) {
  tableData.forEach((row) => {
    const { label } = row;

    if (tableType === "counts") {
      if (label === "ixG") {
        // LY ixG comes from API YearlyCounts
        row.LY = previousSeasonCounts?.ixG ?? row.LY; // Use existing value as fallback
      } else if (label === "GP") {
        // LY GP: Trust Supabase totals first, then API counts
        if (previousSeasonTotalsRow?.games_played != null) {
          row.LY = previousSeasonTotalsRow.games_played;
        } else if (previousSeasonCounts?.GP != null) {
          row.LY = previousSeasonCounts.GP;
        }
        // else keep calculated value if both sources fail
      } else if (label === "ATOI" || label === "PPTOI" || label === "PP%") {
        // These were calculated directly from previousSeasonGames, no override needed
      } else if (label in supabaseLyMap) {
        // Other counts: Use Supabase totals table if available
        const rawStatKey = supabaseLyMap[label];
        if (
          previousSeasonTotalsRow &&
          rawStatKey in previousSeasonTotalsRow &&
          previousSeasonTotalsRow[rawStatKey] != null
        ) {
          row.LY = previousSeasonTotalsRow[rawStatKey];
        }
        // else keep calculated value from prevSeasonGames sum (or API if needed)
      }
    } else {
      // tableType === "rates"
      if (rateCA3YAMap[label]) {
        // Only override rates defined in the map
        // LY Rates primarily come from API YearlyRates
        if (previousSeasonRates) {
          const val = previousSeasonRates[label as keyof YearlyRate];
          if (typeof val === "number") {
            row.LY = val;
          }
          // else keep calculated value
        }
        // Could add Supabase totals rate columns as fallback if needed
      }
    }
  });
}

/**
 * Helper to sum a specific numeric key from SkaterStat objects (wgo_skater_stats data).
 */
function sumStat(gs: SkaterStat[], stat: NumericSkaterStatKey): number {
  return gs.reduce((sum, g) => {
    const value = g[stat];
    // Ensure value is a number, otherwise add 0
    return sum + (typeof value === "number" && !isNaN(value) ? value : 0);
  }, 0);
}

/**
 * Helper to sum 'ixg' from NstGameLog objects.
 */
function sumNstStat(
  logs: NstGameLog[],
  statKey: keyof NstGameLog = "ixg"
): number {
  return logs.reduce((sum, log) => {
    const value = log[statKey];
    // Ensure value is a number, otherwise add 0
    return sum + (typeof value === "number" && !isNaN(value) ? value : 0);
  }, 0);
}

/**
 * Helper to calculate per-60 rates for standard stats from wgo_skater_stats data.
 */
function calculatePer60Rate(
  gs: SkaterStat[],
  stat: NumericSkaterStatKey
): number {
  const totalStat = sumStat(gs, stat);
  // Determine TOI basis (PP TOI for PP stats, overall TOI otherwise)
  const powerPlayStats: NumericSkaterStatKey[] = [
    "pp_assists",
    "pp_goals",
    "ppp"
  ];
  const toiStat = powerPlayStats.includes(stat)
    ? "pp_toi_per_game"
    : "toi_per_game";
  const totalTOI = sumStat(gs, toiStat);

  if (totalTOI <= 0) return 0; // Avoid division by zero
  const rate = (totalStat / totalTOI) * 3600; // 60 minutes * 60 seconds
  return Math.round(rate * 100) / 100; // Round to 2 decimal places
}

/**
 * Helper to calculate average TOI per game (in seconds).
 */
function averageToiPerGame(gs: SkaterStat[]): number {
  if (gs.length === 0) return 0;
  const totalTOI = sumStat(gs, "toi_per_game");
  return Math.round(totalTOI / gs.length);
}

/**
 * Helper to calculate average PP TOI per game (in seconds).
 */
function averagePPToiPerGame(gs: SkaterStat[]): number {
  if (gs.length === 0) return 0;
  const totalPPTOI = sumStat(gs, "pp_toi_per_game");
  // Average PP TOI might be low, maybe don't round aggressively?
  return totalPPTOI / gs.length; // Return raw average
}

/**
 * Helper to calculate average PP TOI percentage per game.
 */
function averagePpToiPctPerGame(gs: SkaterStat[]): number {
  if (gs.length === 0) return 0;
  // Fetch the sum of potentially decimal values (e.g., 0.616)
  const totalDecimalPct = sumStat(gs, "pp_toi_pct_per_game");
  const averageDecimal = totalDecimalPct / gs.length;

  // Convert the average decimal to percentage format (multiply by 100)
  const averagePercent = averageDecimal * 100;

  // Round the percentage value to one decimal place
  return Math.round(averagePercent * 10) / 10;
}

/**
 * Aggregates stats for different timeframes (L5, L10, L20, STD, LY).
 * Handles ixG calculation separately using NST data.
 */
function aggregateStats(
  configs: StatConfig[],
  currentWgoGames: SkaterStat[],
  prevWgoGames: SkaterStat[],
  currentNstLogs: NstGameLog[], // NST data for current season L5-STD
  prevNstLogs: NstGameLog[], // NST data for previous season (if needed for LY Rate)
  isRate: boolean
): TableAggregateData[] {
  return configs.map((conf) => {
    const { key, countsLabel, ratesLabel, isDerived, deriveKeys } = conf;
    const label = isRate ? ratesLabel : countsLabel;

    let LYVal = 0,
      L5Val = 0,
      L10Val = 0,
      L20Val = 0,
      STDVal = 0;

    if (key === "ixG") {
      // --- Special handling for ixG ---
      if (!isRate) {
        // Counts Table ('ixG' row)
        L5Val = sumNstStat(currentNstLogs.slice(0, 5));
        L10Val = sumNstStat(currentNstLogs.slice(0, 10));
        L20Val = sumNstStat(currentNstLogs.slice(0, 20));
        STDVal = sumNstStat(currentNstLogs);
        LYVal = 0; // LY ixG count comes from API via applyLastYearOverrides
      } else {
        // Rates Table ('ixG/60' row)
        // Function to calculate ixG rate for a slice
        const calculateIxGRate = (
          nstSlice: NstGameLog[],
          wgoSlice: SkaterStat[]
        ): number => {
          const totalIxG = sumNstStat(nstSlice);
          const totalTOI = sumStat(wgoSlice, "toi_per_game");
          if (totalTOI <= 0) return 0;
          const rate = (totalIxG / totalTOI) * 3600;
          return Math.round(rate * 100) / 100;
        };
        // Calculate rates for L5, L10, L20, STD
        L5Val = calculateIxGRate(
          currentNstLogs.slice(0, 5),
          currentWgoGames.slice(0, 5)
        );
        L10Val = calculateIxGRate(
          currentNstLogs.slice(0, 10),
          currentWgoGames.slice(0, 10)
        );
        L20Val = calculateIxGRate(
          currentNstLogs.slice(0, 20),
          currentWgoGames.slice(0, 20)
        );
        STDVal = calculateIxGRate(currentNstLogs, currentWgoGames);
        // LYVal for rate comes from API via applyLastYearOverrides
        LYVal = 0; // Placeholder, overridden later
      }
    } else {
      // Use original logic for non-ixG stats based on wgo_skater_stats
      const currentKey = key as NumericSkaterStatKey; // Cast key safely

      // Calculate LY, L5, L10, L20, STD based on whether it's a rate or count
      if (!isRate) {
        // Counts
        LYVal =
          isDerived && deriveKeys
            ? deriveKeys.reduce((sum, k) => sum + sumStat(prevWgoGames, k), 0)
            : sumStat(prevWgoGames, currentKey);
        L5Val =
          isDerived && deriveKeys
            ? deriveKeys.reduce(
                (sum, k) => sum + sumStat(currentWgoGames.slice(0, 5), k),
                0
              )
            : sumStat(currentWgoGames.slice(0, 5), currentKey);
        L10Val =
          isDerived && deriveKeys
            ? deriveKeys.reduce(
                (sum, k) => sum + sumStat(currentWgoGames.slice(0, 10), k),
                0
              )
            : sumStat(currentWgoGames.slice(0, 10), currentKey);
        L20Val =
          isDerived && deriveKeys
            ? deriveKeys.reduce(
                (sum, k) => sum + sumStat(currentWgoGames.slice(0, 20), k),
                0
              )
            : sumStat(currentWgoGames.slice(0, 20), currentKey);
        STDVal =
          isDerived && deriveKeys
            ? deriveKeys.reduce(
                (sum, k) => sum + sumStat(currentWgoGames, k),
                0
              )
            : sumStat(currentWgoGames, currentKey);
      } else {
        // Rates
        LYVal = calculatePer60Rate(prevWgoGames, currentKey);
        L5Val = calculatePer60Rate(currentWgoGames.slice(0, 5), currentKey);
        L10Val = calculatePer60Rate(currentWgoGames.slice(0, 10), currentKey);
        L20Val = calculatePer60Rate(currentWgoGames.slice(0, 20), currentKey);
        STDVal = calculatePer60Rate(currentWgoGames, currentKey);
      }
    }

    return {
      label,
      CA: 0,
      "3YA": 0,
      LY: LYVal,
      L5: L5Val,
      L10: L10Val,
      L20: L20Val,
      STD: STDVal
    };
  });
}

// #endregion Helper Functions

// ==========================================================================
// Main Exported Function
// ==========================================================================
export async function fetchPlayerAggregatedStats(
  playerId: number
): Promise<CombinedPlayerStats> {
  console.log(`Workspaceing aggregated stats for Player ID: ${playerId}`);

  // 1) Fetch current season information
  const currentSeasonInfo = await fetchCurrentSeason();
  const currentSeasonId = currentSeasonInfo.id;
  const currentSeasonString = currentSeasonId.toString(); // For text column matching
  let previousSeasonId: number | undefined;
  if ("idPrev" in currentSeasonInfo && currentSeasonInfo.idPrev)
    previousSeasonId = currentSeasonInfo.idPrev;
  else if (
    "previousSeason" in currentSeasonInfo &&
    currentSeasonInfo.previousSeason
  )
    previousSeasonId = currentSeasonInfo.previousSeason.id;
  else previousSeasonId = currentSeasonInfo.idTwo; // Fallback
  const previousSeasonString = previousSeasonId?.toString();

  console.log(
    `Current Season: ${currentSeasonString}, Previous Season: ${previousSeasonString}`
  );

  // 2a) Fetch base stats from wgo_skater_stats (parallel fetch with NST)
  const wgoGamesPromise = supabase
    .from("wgo_skater_stats")
    .select("*, pp_toi_pct_per_game") // Select needed columns explicitly
    .eq("player_id", playerId)
    .order("date", { ascending: false })
    .then((response) => {
      if (response.error) {
        console.error("Error fetching wgo_skater_stats:", response.error);
        throw new Error("Failed to fetch base player statistics.");
      }
      return (response.data || []) as SkaterStat[];
    });

  // 2b) Fetch ixG stats from nst_gamelog_as_counts (parallel fetch with WGO)
  const nstLogsPromise = supabase
    .from("nst_gamelog_as_counts")
    .select("ixg, date_scraped, season") // Fetch required columns
    .eq("player_id", playerId)
    .order("date_scraped", { ascending: false }) // Order by date
    .then((response) => {
      if (response.error) {
        console.error("Error fetching nst_gamelog_as_counts:", response.error);
        // Non-fatal, allow proceeding without NST data if fetch fails
        return [];
      }
      return (response.data || []) as NstGameLog[];
    });

  // 2c) Fetch previous season totals (can run in parallel too)
  const previousTotalsPromise = previousSeasonId
    ? fetchPreviousSeasonTotalsRow(playerId, previousSeasonId)
    : Promise.resolve(null);

  // 2d) Fetch 3-Year/Career API data (can run in parallel)
  const threeYearApiPromise = fetchThreeYearAverages(playerId).catch(
    (apiError) => {
      console.error("Error fetching Three-Year Averages from API:", apiError);
      return null; // Handle API error gracefully
    }
  );

  // 2e) Fetch Supabase Averages (can run in parallel)
  const careerAvgPromise = supabase
    .from("wgo_career_averages")
    .select("*")
    .eq("player_id", playerId)
    .limit(1)
    .maybeSingle();
  const threeYearAvgPromise = supabase
    .from("wgo_three_year_averages")
    .select("*")
    .eq("player_id", playerId)
    .limit(1)
    .maybeSingle();

  // --- Wait for all parallel fetches ---
  const [
    allWgoGames,
    allNstLogs,
    previousSeasonTotalsRow,
    threeYearApiData, // Can be null if API fetch failed
    careerAvgResult,
    threeYearAvgResult
  ] = await Promise.all([
    wgoGamesPromise,
    nstLogsPromise,
    previousTotalsPromise,
    threeYearApiPromise,
    careerAvgPromise,
    threeYearAvgPromise
  ]);

  const careerAvg = careerAvgResult?.data || null;
  const threeYearAvg = threeYearAvgResult?.data || null;
  if (careerAvgResult?.error)
    console.error("Error fetching career averages:", careerAvgResult.error);
  if (threeYearAvgResult?.error)
    console.error("Error fetching 3-year averages:", threeYearAvgResult.error);

  // --- Filter games/logs for current and previous seasons ---
  const currentSeasonGames = allWgoGames.filter(
    (g) => g.season_id === currentSeasonId
  );
  const previousSeasonGames = previousSeasonId
    ? allWgoGames.filter((g) => g.season_id === previousSeasonId)
    : [];

  // Filter NST logs for current season
  const currentNstLogs = allNstLogs.filter(
    (log) => log.season === currentSeasonString
  );
  if (currentNstLogs.length === 0 && allNstLogs.length > 0) {
    console.warn(
      `No NST game logs matched season ${currentSeasonString}. Check season format in nst_gamelog_as_counts.`
    );
  }

  // Filter NST logs for previous season (needed for LY ixG Rate - currently not used but fetched)
  const previousNstLogs = previousSeasonString
    ? allNstLogs.filter((log) => log.season === previousSeasonString)
    : [];

  // --- Define Stat Configurations ---
  const statConfigs: StatConfig[] = [
    // Order matters for display
    { key: "goals", countsLabel: "G", ratesLabel: "G/60" },
    { key: "assists", countsLabel: "A", ratesLabel: "A/60" },
    { key: "shots", countsLabel: "SOG", ratesLabel: "SOG/60" },
    { key: "ixG", countsLabel: "ixG", ratesLabel: "ixG/60" }, // Position ixG
    { key: "pp_goals", countsLabel: "PPG", ratesLabel: "PPG/60" },
    { key: "pp_assists", countsLabel: "PPA", ratesLabel: "PPA/60" },
    {
      key: "ppp",
      countsLabel: "PPP",
      ratesLabel: "PPP/60",
      isDerived: true,
      deriveKeys: ["pp_assists", "pp_goals"]
    },
    { key: "hits", countsLabel: "HIT", ratesLabel: "HIT/60" },
    { key: "blocked_shots", countsLabel: "BLK", ratesLabel: "BLK/60" },
    { key: "penalty_minutes", countsLabel: "PIM", ratesLabel: "PIM/60" }
  ];

  // --- Initialize Data Structures ---
  const countsData: TableAggregateData[] = [
    // GP Row (calculated from WGO stats length)
    {
      label: "GP",
      CA: 0,
      "3YA": 0,
      LY: previousSeasonGames.length,
      L5: Math.min(5, currentSeasonGames.length),
      L10: Math.min(10, currentSeasonGames.length),
      L20: Math.min(20, currentSeasonGames.length),
      STD: currentSeasonGames.length
    }
  ];
  const ratesData: TableAggregateData[] = [];

  // --- Calculate and Add Special Count Rows (ATOI, PPTOI, PP%) ---
  countsData.splice(1, 0, {
    label: "ATOI",
    CA: 0,
    "3YA": 0,
    LY: averageToiPerGame(previousSeasonGames),
    L5: averageToiPerGame(currentSeasonGames.slice(0, 5)),
    L10: averageToiPerGame(currentSeasonGames.slice(0, 10)),
    L20: averageToiPerGame(currentSeasonGames.slice(0, 20)),
    STD: averageToiPerGame(currentSeasonGames)
  });
  countsData.splice(6, 0, {
    label: "PPTOI",
    CA: 0,
    "3YA": 0,
    LY: averagePPToiPerGame(previousSeasonGames),
    L5: averagePPToiPerGame(currentSeasonGames.slice(0, 5)),
    L10: averagePPToiPerGame(currentSeasonGames.slice(0, 10)),
    L20: averagePPToiPerGame(currentSeasonGames.slice(0, 20)),
    STD: averagePPToiPerGame(currentSeasonGames)
  });
  countsData.splice(7, 0, {
    label: "PP%",
    CA: 0,
    "3YA": 0,
    LY: averagePpToiPctPerGame(previousSeasonGames),
    L5: averagePpToiPctPerGame(currentSeasonGames.slice(0, 5)),
    L10: averagePpToiPctPerGame(currentSeasonGames.slice(0, 10)),
    L20: averagePpToiPctPerGame(currentSeasonGames.slice(0, 20)),
    STD: averagePpToiPctPerGame(currentSeasonGames)
  });

  // --- Aggregate Stats for L5, L10, L20, STD, LY ---
  const aggregatedCounts = aggregateStats(
    statConfigs,
    currentSeasonGames,
    previousSeasonGames,
    currentNstLogs,
    previousNstLogs,
    false
  );
  const aggregatedRates = aggregateStats(
    statConfigs,
    currentSeasonGames,
    previousSeasonGames,
    currentNstLogs,
    previousNstLogs,
    true
  );

  // --- Combine Special Rows with Aggregated Rows ---
  countsData.push(...aggregatedCounts);
  ratesData.push(...aggregatedRates);

  // --- Apply Career and 3-Year Averages ---
  if (careerAvg || threeYearAvg || threeYearApiData) {
    applyAverages(
      countsData,
      careerAvg,
      threeYearAvg,
      "counts",
      threeYearApiData || undefined
    );
    applyAverages(
      ratesData,
      careerAvg,
      threeYearAvg,
      "rates",
      threeYearApiData || undefined
    );
  }

  // --- Apply Last Year Overrides ---
  const previousSeasonCountsObj = findPreviousSeasonCounts(
    threeYearApiData,
    previousSeasonId
  );
  const previousSeasonRatesObj = findPreviousSeasonRates(
    threeYearApiData,
    previousSeasonId
  );

  applyLastYearOverrides(
    countsData,
    "counts",
    previousSeasonTotalsRow,
    previousSeasonCountsObj,
    null
  );
  applyLastYearOverrides(
    ratesData,
    "rates",
    previousSeasonTotalsRow,
    null,
    previousSeasonRatesObj
  );

  // --- Final Return ---
  return {
    counts: countsData,
    rates: ratesData,
    // Include fetched average data if needed elsewhere, ensure null safety
    threeYearCountsAverages: threeYearAvg ?? {},
    threeYearRatesAverages: threeYearAvg ?? {},
    careerAverageCounts: careerAvg ?? {},
    careerAverageRates: careerAvg ?? {},
    threeYearApiData: threeYearApiData ?? undefined
  };
}
