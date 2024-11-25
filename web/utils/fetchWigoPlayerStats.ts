// web/utils/fetchWigoPlayerStats.ts

import {
  SkaterStat,
  TableAggregateData,
  PlayerStats
} from "components/WiGO/types";
import { fetchCurrentSeason, SeasonInfo } from "./fetchCurrentSeason";
import supabase from "lib/supabase";

/**
 * Define a type that includes only the numeric keys of SkaterStat.
 */
type NumericSkaterStatKey =
  | "goals"
  | "assists"
  | "sog"
  | "ppa"
  | "ppg"
  | "ppp"
  | "hit"
  | "blk"
  | "pim"
  | "ixf"
  | "hdcf"
  | "scf";

/**
 * Fetches and aggregates player statistics for Counts and Rates.
 *
 * @param {number} playerId - The ID of the selected player.
 * @returns {Promise<PlayerStats>} - Aggregated counts and rates data.
 */
export async function fetchPlayerAggregatedStats(
  playerId: number
): Promise<PlayerStats> {
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

  // Fetch all games for the selected player, sorted by date descending
  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("*")
    .eq("player_id", playerId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching player stats:", error);
    throw new Error("Failed to fetch player statistics.");
  }

  if (!data || data.length === 0) {
    console.warn("No game data found for the selected player.");
    return { counts: [], rates: [] };
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

  // Define the stats to aggregate
  const stats: NumericSkaterStatKey[] = [
    "goals",
    "assists",
    "sog",
    "ppa",
    "ppg",
    "ppp",
    "hit",
    "blk",
    "pim",
    "ixf",
    "hdcf",
    "scf"
  ];

  // Initialize counts and rates data
  const countsData: TableAggregateData[] = [];
  const ratesData: TableAggregateData[] = [];

  // Compute 'Games Played' counts
  const gamesPlayedCounts: TableAggregateData = {
    label: "GP",
    CA: 0, // Initialize CA with default value
    threeYA: 0, // Initialize 3YA with default value
    LY: previousSeasonGames.length,
    L5: Math.min(5, currentSeasonGames.length),
    L10: Math.min(10, currentSeasonGames.length),
    L20: Math.min(20, currentSeasonGames.length),
    STD: currentSeasonGames.length
  };
  countsData.push(gamesPlayedCounts);

  // Compute 'Games Played' rates (even though it's a count, to include in Rates table)
  const gamesPlayedRates: TableAggregateData = {
    label: "GP",
    CA: 0, // You can decide how to handle CA for a count in Rates table
    threeYA: 0, // Similarly, handle threeYA
    LY: previousSeasonGames.length,
    L5: Math.min(5, currentSeasonGames.length),
    L10: Math.min(10, currentSeasonGames.length),
    L20: Math.min(20, currentSeasonGames.length),
    STD: currentSeasonGames.length
  };
  ratesData.push(gamesPlayedRates);

  // Aggregate counts for each stat
  stats.forEach((stat) => {
    const statAggregate: TableAggregateData = {
      label: capitalizeFirstLetter(stat),
      CA: 0, // Initialize CA with default value
      threeYA: 0, // Initialize 3YA with default value
      LY: sumStat(previousSeasonGames, stat),
      L5: sumStat(currentSeasonGames.slice(0, 5), stat),
      L10: sumStat(currentSeasonGames.slice(0, 10), stat),
      L20: sumStat(currentSeasonGames.slice(0, 20), stat),
      STD: sumStat(currentSeasonGames, stat)
    };
    countsData.push(statAggregate);
  });

  // Aggregate rates for each stat
  stats.forEach((stat) => {
    const rateAggregate: TableAggregateData = {
      label: `${capitalizeFirstLetter(stat)}/60`,
      CA: 0, // Initialize CA with default value
      threeYA: 0, // Initialize 3YA with default value
      LY: calculatePer60(previousSeasonGames, stat),
      L5: calculatePer60(currentSeasonGames.slice(0, 5), stat),
      L10: calculatePer60(currentSeasonGames.slice(0, 10), stat),
      L20: calculatePer60(currentSeasonGames.slice(0, 20), stat),
      STD: calculatePer60(currentSeasonGames, stat)
    };
    ratesData.push(rateAggregate);
  });

  // Logging aggregated data for debugging
  console.log("Counts Data:", countsData);
  console.log("Rates Data:", ratesData);

  return { counts: countsData, rates: ratesData };
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
 *
 * @param {SkaterStat[]} gamesSubset - The subset of games.
 * @param {NumericSkaterStatKey} stat - The stat to calculate.
 * @returns {number} - The per60 value, rounded to two decimal places.
 */
function calculatePer60(
  gamesSubset: SkaterStat[],
  stat: NumericSkaterStatKey
): number {
  const totalStat = sumStat(gamesSubset, stat);
  const totalToi = gamesSubset.reduce(
    (sum, game) => sum + (game.toi_per_game || 0),
    0
  );
  if (totalToi === 0) return 0;
  const per60 = (totalStat / totalToi) * 3600;
  return Math.round(per60 * 100) / 100; // Round to two decimal places
}

/**
 * Capitalizes the first letter of the given string.
 *
 * @param {string} str - The string to capitalize.
 * @returns {string} - The capitalized string.
 */
function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
