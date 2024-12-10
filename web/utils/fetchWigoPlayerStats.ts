// web/utils/fetchWigoPlayerStats.ts

import {
  SkaterStat,
  TableAggregateData,
  PlayerStats,
  ThreeYearAveragesResponse,
  ThreeYearCountsAverages,
  ThreeYearRatesAverages,
  CareerAverageCounts,
  CareerAverageRates
} from "components/WiGO/types";
import { fetchCurrentSeason, SeasonInfo } from "./fetchCurrentSeason";
import supabase from "lib/supabase";
import { fetchThreeYearAverages } from "../components/WiGO/fetchThreeYearAverages";

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
 * CombinedPlayerStats includes both Supabase data and ThreeYearAverages data.
 */
export interface CombinedPlayerStats extends PlayerStats {
  counts: TableAggregateData[];
  rates: TableAggregateData[];
  threeYearCountsAverages: ThreeYearCountsAverages;
  threeYearRatesAverages: ThreeYearRatesAverages;
  careerAverageCounts: CareerAverageCounts;
  careerAverageRates: CareerAverageRates;
}

/**
 * Fetches and aggregates player statistics for Counts and Rates from Supabase and ThreeYearAverages API.
 *
 * @param {number} playerId - The ID of the selected player.
 * @returns {Promise<CombinedPlayerStats>} - Aggregated counts and rates data combined from both sources.
 */
export async function fetchPlayerAggregatedStats(
  playerId: number
): Promise<CombinedPlayerStats> {
  // Fetch current season information
  const currentSeasonInfo: SeasonInfo = await fetchCurrentSeason();
  const currentSeasonId = currentSeasonInfo.id;
  let previousSeasonId: number | undefined;

  // Determine previous season ID based on the structure of currentSeasonInfo
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

  // Fetch all games for the selected player from Supabase, sorted by date descending
  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("*")
    .eq("player_id", playerId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching player stats from Supabase:", error);
    throw new Error("Failed to fetch player statistics from Supabase.");
  }

  if (!data || data.length === 0) {
    console.warn("No game data found for the selected player in Supabase.");
    // Proceeding to fetch supplemental data even if Supabase has no data
  }

  const games = data as SkaterStat[];

  // Filter and sort games for current and previous seasons
  const currentSeasonGames = games
    .filter((game) => game.season_id === currentSeasonId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const previousSeasonGames = previousSeasonId
    ? games
        .filter((game) => game.season_id === previousSeasonId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  // Logging for debugging
  console.log(`Player ID: ${playerId}`);
  console.log(
    `Current Season Games (Total: ${currentSeasonGames.length}):`,
    currentSeasonGames
  );
  console.log(
    `Previous Season Games (Total: ${previousSeasonGames.length}):`,
    previousSeasonGames
  );

  // Define the stats to aggregate with their configurations
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

  // Initialize counts and rates data with 'Games Played' (GP)
  const initializeTableData = (): TableAggregateData[] => [
    {
      label: "GP",
      CA: 0, // Career Average
      threeYA: 0, // Three-Year Average
      LY: previousSeasonGames.length,
      L5: Math.min(5, currentSeasonGames.length),
      L10: Math.min(10, currentSeasonGames.length),
      L20: Math.min(20, currentSeasonGames.length),
      STD: currentSeasonGames.length // Total games played in the current season
    }
  ];

  const countsData: TableAggregateData[] = initializeTableData();
  const ratesData: TableAggregateData[] = initializeTableData();

  // Helper function to aggregate stats
  const aggregateStats = (
    configs: StatConfig[],
    currentSeasonGames: SkaterStat[],
    previousSeasonGames: SkaterStat[],
    isRate: boolean
  ): TableAggregateData[] => {
    return configs.map((config) => {
      const { key, countsLabel, ratesLabel, isDerived, deriveKeys } = config;

      // Determine the label based on counts or rates
      const label = isRate ? ratesLabel : countsLabel;

      // Calculate values for different timeframes
      const LY =
        isDerived && deriveKeys
          ? deriveKeys.reduce(
              (sum, k) => sum + sumStat(previousSeasonGames, k),
              0
            )
          : sumStat(previousSeasonGames, key);

      const L5 =
        isDerived && deriveKeys
          ? deriveKeys.reduce(
              (sum, k) => sum + sumStat(currentSeasonGames.slice(0, 5), k),
              0
            )
          : sumStat(currentSeasonGames.slice(0, 5), key);

      const L10 =
        isDerived && deriveKeys
          ? deriveKeys.reduce(
              (sum, k) => sum + sumStat(currentSeasonGames.slice(0, 10), k),
              0
            )
          : sumStat(currentSeasonGames.slice(0, 10), key);

      const L20 =
        isDerived && deriveKeys
          ? deriveKeys.reduce(
              (sum, k) => sum + sumStat(currentSeasonGames.slice(0, 20), k),
              0
            )
          : sumStat(currentSeasonGames.slice(0, 20), key);

      // STD should aggregate all games in the current season
      const STD = isRate
        ? calculatePer60(currentSeasonGames, key) // For rates, per60 over all games
        : isDerived && deriveKeys
        ? deriveKeys.reduce((sum, k) => sum + sumStat(currentSeasonGames, k), 0) // Sum of derived keys
        : sumStat(currentSeasonGames, key); // Total sum

      // For rates, calculate per60 values
      const LY_Rate = isRate ? calculatePer60(previousSeasonGames, key) : LY;
      const L5_Rate = isRate
        ? calculatePer60(currentSeasonGames.slice(0, 5), key)
        : L5;
      const L10_Rate = isRate
        ? calculatePer60(currentSeasonGames.slice(0, 10), key)
        : L10;
      const L20_Rate = isRate
        ? calculatePer60(currentSeasonGames.slice(0, 20), key)
        : L20;
      const STD_Rate = isRate ? calculatePer60(currentSeasonGames, key) : STD;

      return {
        label: label,
        CA: 0, // To be updated from Career Averages
        threeYA: 0, // To be updated from Three-Year Averages
        LY: isRate ? LY_Rate : LY,
        L5: isRate ? L5_Rate : L5,
        L10: isRate ? L10_Rate : L10,
        L20: isRate ? L20_Rate : L20,
        STD: isRate ? STD_Rate : STD // Aggregated over all games
      };
    });
  };

  // Create ATOI and PPTOI/GM rows
  const aToiCounts = createATOIRow(currentSeasonGames, previousSeasonGames);
  const aToiRates = createATOIRow(currentSeasonGames, previousSeasonGames);
  countsData.splice(1, 0, aToiCounts);
  ratesData.splice(1, 0, aToiRates);

  const ppToiCounts = createPPToiRow(currentSeasonGames, previousSeasonGames);
  const ppToiRates = createPPToiRow(currentSeasonGames, previousSeasonGames);
  countsData.splice(6, 0, ppToiCounts);
  ratesData.splice(6, 0, ppToiRates);

  const ppPctCounts = createPPPctRow(currentSeasonGames, previousSeasonGames);
  const ppPctRates = createPPPctRow(currentSeasonGames, previousSeasonGames);
  countsData.splice(7, 0, ppPctCounts);
  ratesData.splice(7, 0, ppPctRates);

  // Aggregate Counts and Rates
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

  // Push aggregated stats into countsData and ratesData
  countsData.push(...aggregatedCounts);
  ratesData.push(...aggregatedRates);

  // Fetch supplemental data from ThreeYearAverages API
  let supplementalData: ThreeYearAveragesResponse | null = null;
  try {
    supplementalData = await fetchThreeYearAverages(playerId);
  } catch (apiError) {
    console.error("Error fetching supplemental data:", apiError);
    // Proceed without supplemental data
  }

  if (supplementalData && supplementalData.success) {
    const {
      threeYearCountsAverages,
      threeYearRatesAverages,
      careerAverageCounts,
      careerAverageRates
    } = supplementalData;

    // Logging received supplemental data
    console.log("Three-Year Counts Averages:", threeYearCountsAverages);
    console.log("Three-Year Rates Averages:", threeYearRatesAverages);
    console.log("Career Average Counts:", careerAverageCounts);
    console.log("Career Average Rates:", careerAverageRates);

    // Update 'threeYA' in countsData from threeYearCountsAverages
    countsData.forEach((row) => {
      const key = row.label as keyof ThreeYearCountsAverages;
      if (key in threeYearCountsAverages) {
        row.threeYA = threeYearCountsAverages[key] ?? 0;
      } else {
        row.threeYA = 0; // Default value if key doesn't exist
      }
    });

    // Update 'threeYA' in ratesData from threeYearRatesAverages
    ratesData.forEach((row) => {
      // Remove "/60" from label to match key
      const key = row.label.replace("/60", "") as keyof ThreeYearRatesAverages;
      if (key in threeYearRatesAverages) {
        row.threeYA = threeYearRatesAverages[key] ?? 0;
      } else {
        row.threeYA = 0; // Default value if key doesn't exist
      }
    });

    // Update 'CA' in countsData from careerAverageCounts
    countsData.forEach((row) => {
      const key = row.label as keyof CareerAverageCounts;
      if (key in careerAverageCounts) {
        row.CA = careerAverageCounts[key] ?? 0;
      } else {
        row.CA = 0; // Default value if key doesn't exist
      }
    });

    // Update 'CA' in ratesData from careerAverageRates
    ratesData.forEach((row) => {
      // Remove "/60" from label to match key
      const key = row.label.replace("/60", "") as keyof CareerAverageRates;
      if (key in careerAverageRates) {
        row.CA = careerAverageRates[key] ?? 0;
      } else {
        row.CA = 0; // Default value if key doesn't exist
      }
    });
  }

  // Logging aggregated data for debugging
  console.log("Counts Data:", countsData);
  console.log("Rates Data:", ratesData);
  console.log("Supplemental Data:", supplementalData);

  // Return combined data along with supplemental averages
  return {
    counts: countsData,
    rates: ratesData,
    threeYearCountsAverages:
      supplementalData?.threeYearCountsAverages ||
      ({} as ThreeYearCountsAverages),
    threeYearRatesAverages:
      supplementalData?.threeYearRatesAverages ||
      ({} as ThreeYearRatesAverages),
    careerAverageCounts:
      supplementalData?.careerAverageCounts || ({} as CareerAverageCounts),
    careerAverageRates:
      supplementalData?.careerAverageRates || ({} as CareerAverageRates)
  };
}

/**
 * Sums the specified stat over the given games.
 *
 * @param {SkaterStat[]} gamesSubset - The subset of games.
 * @param {NumericSkaterStatKey} stat - The stat to sum.
 * @returns {number} - The sum of the stat.
 */
function sumStat(
  gamesSubset: SkaterStat[],
  stat: NumericSkaterStatKey
): number {
  return gamesSubset.reduce((sum, game) => sum + (game[stat] || 0), 0);
}

/**
 * Calculates the per60 value for the specified stat over the given games.
 * For PPA/60, PPG/60, and PPP/60, it uses Power Play Time on Ice (pp_toi_per_game).
 *
 * @param {SkaterStat[]} gamesSubset - The subset of games.
 * @param {NumericSkaterStatKey} stat - The stat to calculate.
 * @returns {number} - The per60 value, rounded to two decimal places.
 */
function calculatePer60(
  gamesSubset: SkaterStat[],
  stat: NumericSkaterStatKey
): number {
  let totalStat = sumStat(gamesSubset, stat);
  let totalPpToi = 0;

  // Determine if the stat is a power play stat
  const powerPlayStats: NumericSkaterStatKey[] = [
    "pp_assists",
    "pp_goals",
    "ppp"
  ];

  if (powerPlayStats.includes(stat)) {
    // Use pp_toi_per_game for power play stats
    totalPpToi = sumStat(gamesSubset, "pp_toi_per_game");
  } else {
    // Use toi_per_game for all other stats
    totalPpToi = sumStat(gamesSubset, "toi_per_game");
  }

  if (totalPpToi === 0) return 0;

  const per60 = (totalStat / totalPpToi) * 3600;
  return Math.round(per60 * 100) / 100; // Round to two decimal places
}

/**
 * Calculates the average pp_toi_pct_per_game for a subset of games, converted to percentage and rounded to one decimal place.
 *
 * @param {SkaterStat[]} gamesSubset - The subset of games.
 * @returns {number} - The average pp_toi_pct_per_game as a percentage, rounded to one decimal place.
 */
function averagePpToiPctPerGame(gamesSubset: SkaterStat[]): number {
  if (gamesSubset.length === 0) return 0;
  const totalPpToiPct = sumStat(gamesSubset, "pp_toi_pct_per_game");
  return Math.round((totalPpToiPct / gamesSubset.length) * 1000) / 10; // e.g., 0.616 * 1000 / 10 = 61.6
}

/**
 * Calculates the average pp_toi_per_game for a subset of games, rounded to two decimal places.
 *
 * @param {SkaterStat[]} gamesSubset - The subset of games.
 * @returns {number} - The average pp_toi_per_game, rounded to two decimal places.
 */
function averagePPToiPerGame(gamesSubset: SkaterStat[]): number {
  if (gamesSubset.length === 0) return 0;
  const totalPPToi = sumStat(gamesSubset, "pp_toi_per_game");
  return Math.round((totalPPToi / gamesSubset.length) * 100) / 100; // Rounded to two decimal places
}

/**
 * Calculates the average toi_per_game for a subset of games, rounded to the nearest second.
 *
 * @param {SkaterStat[]} gamesSubset - The subset of games.
 * @returns {number} - The average toi_per_game, rounded to the nearest second.
 */
function averageToiPerGame(gamesSubset: SkaterStat[]): number {
  if (gamesSubset.length === 0) return 0;
  const totalToi = sumStat(gamesSubset, "toi_per_game");
  return Math.round(totalToi / gamesSubset.length); // Rounded to nearest second
}

/**
 * Creates an ATOI row.
 *
 * @param {SkaterStat[]} gamesData - The subset of games.
 * @param {SkaterStat[]} previousSeasonGames - Games from the previous season.
 * @returns {TableAggregateData} - The ATOI row.
 */
function createATOIRow(
  gamesData: SkaterStat[],
  previousSeasonGames: SkaterStat[]
): TableAggregateData {
  return {
    label: "ATOI",
    CA: 0, // Career Average
    threeYA: 0, // Three-Year Average
    LY: averageToiPerGame(previousSeasonGames), // Last year's average
    L5: averageToiPerGame(gamesData.slice(0, 5)),
    L10: averageToiPerGame(gamesData.slice(0, 10)),
    L20: averageToiPerGame(gamesData.slice(0, 20)),
    STD: sumStat(gamesData, "toi_per_game") // Season To Date: total toi
  };
}

/**
 * Creates a PPTOI/GM row.
 *
 * @param {SkaterStat[]} gamesData - The subset of games.
 * @param {SkaterStat[]} previousSeasonGames - Games from the previous season.
 * @returns {TableAggregateData} - The PPTOI/GM row.
 */
function createPPToiRow(
  gamesData: SkaterStat[],
  previousSeasonGames: SkaterStat[]
): TableAggregateData {
  return {
    label: "PPTOI/GM",
    CA: 0, // Career Average
    threeYA: 0, // Three-Year Average
    LY: averagePPToiPerGame(previousSeasonGames), // Last year's average
    L5: averagePPToiPerGame(gamesData.slice(0, 5)),
    L10: averagePPToiPerGame(gamesData.slice(0, 10)),
    L20: averagePPToiPerGame(gamesData.slice(0, 20)),
    STD: averagePPToiPerGame(gamesData) // Season To Date: all games
  };
}

/**
 * Creates a PP% row.
 *
 * @param {SkaterStat[]} gamesData - The subset of games.
 * @param {SkaterStat[]} previousSeasonGames - Games from the previous season.
 * @returns {TableAggregateData} - The PP% row.
 */
function createPPPctRow(
  gamesData: SkaterStat[],
  previousSeasonGames: SkaterStat[]
): TableAggregateData {
  return {
    label: "PP%",
    CA: 0, // Career Average
    threeYA: 0, // Three-Year Average
    LY: averagePpToiPctPerGame(previousSeasonGames), // Last year's average
    L5: averagePpToiPctPerGame(gamesData.slice(0, 5)),
    L10: averagePpToiPctPerGame(gamesData.slice(0, 10)),
    L20: averagePpToiPctPerGame(gamesData.slice(0, 20)),
    STD: averagePpToiPctPerGame(gamesData) // Season To Date: all games
  };
}
