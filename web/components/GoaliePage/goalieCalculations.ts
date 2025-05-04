import type {
  GoalieBaseStats,
  GoalieAverages,
  NumericGoalieStatKey,
  Ranking,
  WeekCounts,
  AggregatedGoalieData,
  GoalieGameStat, // Changed from GoalieWeekStat
  GoalieRanking,
  WeekOption,
  Week,
  StatColumn,
  ApiGoalieData,
  GoalieInfo
} from "./goalieTypes";
import { parseISO, isWithinInterval, startOfWeek, endOfWeek } from "date-fns"; // For weekly aggregation

// --- Constants ---
// Defines which stats are better higher or lower
export const statMap: Record<NumericGoalieStatKey, "larger" | "smaller"> = {
  gamesPlayed: "larger", // Less relevant for game/week rank, but included
  gamesStarted: "larger", // Less relevant for game/week rank
  wins: "larger",
  losses: "smaller",
  otLosses: "smaller",
  saves: "larger",
  savesPer60: "larger", // Add derived stat
  shotsAgainst: "larger", // Could argue this is neutral or negative contextually
  shotsAgainstPer60: "larger", // Add derived stat
  goalsAgainst: "smaller",
  savePct: "larger",
  goalsAgainstAverage: "smaller",
  shutouts: "larger",
  timeOnIce: "larger" // More ice time generally means more trust/opportunity
};

// Points assigned to performance rankings (can be weekly or game)
export const rankingPoints: Record<Ranking, number> = {
  Elite: 20,
  Quality: 10,
  Average: 5, // Renamed from "Week"
  Bad: 3,
  "Really Bad": 1
};

// --- Helper Functions ---

/**
 * Calculates the standard deviation of a list of numbers.
 * Returns 0 if the list has fewer than 2 elements.
 */
export const calculateStandardDeviation = (numbers: number[]): number => {
  const n = numbers.length;
  if (n < 2) {
    return 0; // Cannot calculate variance/stddev for less than 2 samples
  }
  const mean = numbers.reduce((a, b) => a + b, 0) / n;
  const variance = numbers.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1); // Use n-1 for sample variance
  return Math.sqrt(variance);
};

/**
 * Safely calculates Save Percentage.
 */
const calculateSavePct = (saves: number, shotsAgainst: number): number => {
  return shotsAgainst > 0 ? saves / shotsAgainst : 0;
};

/**
 * Safely calculates Goals Against Average.
 */
const calculateGAA = (goalsAgainst: number, timeOnIce: number): number => {
  // timeOnIce assumed to be in minutes
  return timeOnIce > 0 ? (goalsAgainst * 60) / timeOnIce : 0;
};

/**
 * Safely calculates a rate stat per 60 minutes.
 */
const calculatePer60 = (stat: number, timeOnIce: number): number => {
  // timeOnIce assumed to be in minutes
  return timeOnIce > 0 ? (stat * 60) / timeOnIce : 0;
};

/**
 * Aggregates raw game stats into weekly summaries.
 * Requires gameDate to be present on GoalieGameStat.
 */
const aggregateGamesToWeeks = (
  games: GoalieGameStat[],
  weekOptions: WeekOption[]
): GoalieGameStat[] => {
  const weeklyAggregates: Record<
    string,
    Partial<GoalieGameStat> & { gameCount: number }
  > = {};

  games.forEach((game) => {
    const gameDate =
      typeof game.gameDate === "string"
        ? parseISO(game.gameDate)
        : game.gameDate;
    if (!gameDate || isNaN(gameDate.getTime())) return; // Skip games without valid dates

    // Find which week this game belongs to
    const weekOption = weekOptions.find((opt) =>
      isWithinInterval(gameDate, { start: opt.value.start, end: opt.value.end })
    );
    if (!weekOption) return; // Skip games outside defined weeks

    const weekLabel = weekOption.label; // Use the label like "Week 1 | 10/10 - 10/16/23" as the key

    if (!weeklyAggregates[weekLabel]) {
      weeklyAggregates[weekLabel] = {
        // Initialize base stats for the week
        playerId: game.playerId,
        goalieFullName: game.goalieFullName,
        team: game.team, // Could maybe list multiple teams if traded mid-week
        weekLabel: weekLabel.split(" | ")[0] || weekLabel, // Get "Week X" part
        gamesPlayed: 0,
        gamesStarted: 0,
        wins: 0,
        losses: 0,
        otLosses: 0,
        saves: 0,
        shotsAgainst: 0,
        goalsAgainst: 0,
        shutouts: 0,
        timeOnIce: 0,
        gameCount: 0
      };
    }

    const week = weeklyAggregates[weekLabel];
    week.gamesPlayed! += game.gamesPlayed ?? 0;
    week.gamesStarted! += game.gamesStarted ?? 0;
    week.wins! += game.wins ?? 0;
    week.losses! += game.losses ?? 0;
    week.otLosses! += game.otLosses ?? 0;
    week.saves! += game.saves ?? 0;
    week.shotsAgainst! += game.shotsAgainst ?? 0;
    week.goalsAgainst! += game.goalsAgainst ?? 0;
    week.shutouts! += game.shutouts ?? 0;
    week.timeOnIce! += game.timeOnIce ?? 0;
    week.gameCount! += 1;
  });

  // Calculate derived weekly stats (SV%, GAA)
  return Object.values(weeklyAggregates).map((week) => {
    const saves = week.saves ?? 0;
    const shotsAgainst = week.shotsAgainst ?? 0;
    const goalsAgainst = week.goalsAgainst ?? 0;
    const timeOnIce = week.timeOnIce ?? 0;
    week.savePct = calculateSavePct(saves, shotsAgainst);
    week.goalsAgainstAverage = calculateGAA(goalsAgainst, timeOnIce);
    // Add per 60 stats if needed for weekly ranking
    week.savesPer60 = calculatePer60(saves, timeOnIce);
    week.shotsAgainstPer60 = calculatePer60(shotsAgainst, timeOnIce);
    return week as GoalieGameStat; // Cast back, includes derived stats
  });
};

// --- Calculation Functions ---

/**
 * Calculates average stats across a list of goalie performances (can be games or weeks).
 */
export const calculateAverages = (
  performances: GoalieBaseStats[] // Accepts game or week stats
): GoalieAverages => {
  if (!performances || performances.length === 0) {
    const zeroAverage: Partial<GoalieAverages> = {};
    (Object.keys(statMap) as NumericGoalieStatKey[]).forEach((key) => {
      // Provide sensible defaults for string representation
      zeroAverage[key] =
        key === "savePct" || key === "goalsAgainstAverage" ? "0.000" : "0.00";
    });
    return zeroAverage as GoalieAverages;
  }

  // Use a Record for flexible summing, include potential derived stats
  const totals: Record<string, number> = {};
  const statKeys = Object.keys(statMap) as NumericGoalieStatKey[];
  statKeys.forEach((key) => (totals[key] = 0)); // Initialize all keys from statMap

  let totalTOI = 0;
  let totalSaves = 0;
  let totalShotsAgainst = 0;
  let totalGoalsAgainst = 0;
  let validEntries = 0; // Count entries with valid numeric data for averaging non-rate stats

  performances.forEach((p) => {
    let entryIsValid = true;
    // Sum base stats that contribute to overall rates
    totalSaves += p.saves ?? 0;
    totalShotsAgainst += p.shotsAgainst ?? 0;
    totalGoalsAgainst += p.goalsAgainst ?? 0;
    totalTOI += p.timeOnIce ?? 0;

    // Sum other stats directly, ensuring they are numbers
    statKeys.forEach((key) => {
      if (
        key !== "savePct" &&
        key !== "goalsAgainstAverage" &&
        key !== "savesPer60" &&
        key !== "shotsAgainstPer60"
      ) {
        const value = p[key];
        if (typeof value === "number" && !isNaN(value)) {
          totals[key] += value;
        } else if (
          key !== "timeOnIce" &&
          key !== "saves" &&
          key !== "shotsAgainst" &&
          key !== "goalsAgainst"
        ) {
          // Only mark entry invalid if a non-aggregate stat is missing/bad
          // We tolerate missing TOI/saves etc. for rate calculation, but not wins etc. for averages
          // entryIsValid = false; // Decide if missing wins etc. invalidates the entry for averaging those stats
        }
      }
    });
    // if (entryIsValid) { // Optionally only count entries with full data for non-rate averages
    validEntries++;
    // }
  });

  const numPerformances = validEntries > 0 ? validEntries : performances.length; // Avoid division by zero

  // Calculate overall derived stats from totals
  const averageSavePct = calculateSavePct(totalSaves, totalShotsAgainst);
  const averageGAA = calculateGAA(totalGoalsAgainst, totalTOI);
  const averageSavesPer60 = calculatePer60(totalSaves, totalTOI);
  const averageShotsAgainstPer60 = calculatePer60(totalShotsAgainst, totalTOI);

  const averages: Partial<GoalieAverages> = {};
  statKeys.forEach((key) => {
    if (key === "savePct") {
      averages[key] = averageSavePct.toFixed(3);
    } else if (key === "goalsAgainstAverage") {
      averages[key] = averageGAA.toFixed(2);
    } else if (key === "savesPer60") {
      averages[key] = averageSavesPer60.toFixed(2);
    } else if (key === "shotsAgainstPer60") {
      averages[key] = averageShotsAgainstPer60.toFixed(2);
    } else if (totals[key] !== undefined && numPerformances > 0) {
      // Average the directly summed stats
      averages[key] = (totals[key] / numPerformances).toFixed(2);
    } else {
      // Default if stat wasn't summed or no performances
      averages[key] = "0.00";
    }
  });

  return averages as GoalieAverages;
};

/**
 * Ranks a single performance (game or week) against averages based on selected stats.
 */
export const calculateRanking = (
  performanceStats: GoalieBaseStats & {
    savesPer60?: number;
    shotsAgainstPer60?: number;
  }, // Add derived stats if needed
  averages: GoalieAverages,
  selectedStats: NumericGoalieStatKey[]
): { points: number; ranking: Ranking } => {
  if (selectedStats.length === 0) {
    return { points: rankingPoints.Average, ranking: "Average" }; // Default if no stats selected
  }

  let betterStats = 0;
  selectedStats.forEach((stat) => {
    const comparisonType = statMap[stat];
    let value: number | undefined;

    // Handle potential derived stats that aren't directly on GoalieBaseStats
    if (stat === "savesPer60") {
      value =
        performanceStats.savesPer60 ??
        calculatePer60(performanceStats.saves, performanceStats.timeOnIce);
    } else if (stat === "shotsAgainstPer60") {
      value =
        performanceStats.shotsAgainstPer60 ??
        calculatePer60(
          performanceStats.shotsAgainst,
          performanceStats.timeOnIce
        );
    } else if (stat === "savePct") {
      value =
        performanceStats.savePct ??
        calculateSavePct(performanceStats.saves, performanceStats.shotsAgainst);
    } else if (stat === "goalsAgainstAverage") {
      value =
        performanceStats.goalsAgainstAverage ??
        calculateGAA(performanceStats.goalsAgainst, performanceStats.timeOnIce);
    } else {
      value = performanceStats[stat];
    }

    const averageValueStr = averages[stat];
    const averageValue =
      averageValueStr !== undefined ? parseFloat(averageValueStr) : NaN;

    // Ensure values are valid numbers for comparison
    if (value === undefined || isNaN(value) || isNaN(averageValue)) return;

    if (comparisonType === "larger" && value >= averageValue) {
      betterStats += 1;
    } else if (comparisonType === "smaller" && value <= averageValue) {
      betterStats += 1;
    }
  });

  const percentage = (betterStats / selectedStats.length) * 100;

  let ranking: Ranking;
  // Adjusted thresholds for the new ranking names
  if (percentage >= 80) ranking = "Elite";
  else if (percentage >= 60) ranking = "Quality";
  else if (percentage >= 45) ranking = "Average"; // Adjusted threshold
  else if (percentage >= 30) ranking = "Bad"; // Adjusted threshold
  else ranking = "Really Bad";

  const points = rankingPoints[ranking];

  return { points, ranking };
};

/**
 * Calculates overall goalie rankings, including WoW and GoG variance.
 * Assumes goaliesData contains aggregated game stats.
 * Requires weekOptions to aggregate games into weeks for WoW calculation.
 */
export const calculateGoalieRankings = (
  goaliesData: AggregatedGoalieData[], // Contains game data
  selectedStats: NumericGoalieStatKey[],
  weekOptions: WeekOption[] // Needed for weekly aggregation
): GoalieRanking[] => {
  if (!goaliesData || goaliesData.length === 0 || weekOptions.length === 0) {
    return [];
  }

  // --- Pre-calculate Averages ---
  // 1. Game Averages (across ALL games in the selected range)
  const allGameStats: GoalieGameStat[] = goaliesData.flatMap((g) => g.games);
  if (allGameStats.length === 0) return []; // No games to analyze
  const gameAverages = calculateAverages(allGameStats);

  // 2. Week Averages (aggregate games to weeks first, then calculate avg across all weeks)
  // We need to do this aggregation per goalie later, but calculate overall weekly averages first
  const allWeekSummaries = aggregateGamesToWeeks(allGameStats, weekOptions);
  const weekAverages = calculateAverages(allWeekSummaries); // Averages based on weekly performance

  // --- Process Each Goalie ---
  const goalieRankings = goaliesData
    .map((goalie): GoalieRanking | null => {
      const games = goalie.games;
      if (!games || games.length === 0) return null; // Skip goalies with no games in range

      // --- Aggregate Game Stats for Overall Display ---
      let totalGamesPlayed = 0,
        totalWins = 0,
        totalLosses = 0,
        totalOtLosses = 0;
      let totalSaves = 0,
        totalShotsAgainst = 0,
        totalGoalsAgainst = 0,
        totalShutouts = 0,
        totalTimeOnIce = 0;

      games.forEach((g) => {
        totalGamesPlayed += g.gamesPlayed ?? 0;
        totalWins += g.wins ?? 0;
        totalLosses += g.losses ?? 0;
        totalOtLosses += g.otLosses ?? 0;
        totalSaves += g.saves ?? 0;
        totalShotsAgainst += g.shotsAgainst ?? 0;
        totalGoalsAgainst += g.goalsAgainst ?? 0;
        totalShutouts += g.shutouts ?? 0;
        totalTimeOnIce += g.timeOnIce ?? 0;
      });
      const overallSavePct = calculateSavePct(totalSaves, totalShotsAgainst);
      const overallGaa = calculateGAA(totalGoalsAgainst, totalTimeOnIce);

      // --- Calculate Game-over-Game (GoG) Variance ---
      const gamePoints: number[] = games.map((game) => {
        const { points } = calculateRanking(game, gameAverages, selectedStats);
        return points;
      });
      const gogVariance = calculateStandardDeviation(gamePoints);

      // --- Aggregate Games to Weeks for WoW Calculation ---
      const weeklySummaries = aggregateGamesToWeeks(games, weekOptions);
      if (weeklySummaries.length === 0) {
        // Handle cases where a goalie played games but they didn't fall into defined weeks?
        // Or if week aggregation fails. Set WoW variance to 0 or undefined.
        // For now, return null or a partial object if weekly analysis is impossible.
        // Let's return the goalie but with 0 points and variance if weekly summary fails.
        return {
          ...goalie,
          totalPoints: 0,
          weekCounts: {
            Elite: 0,
            Quality: 0,
            Average: 0,
            Bad: 0,
            "Really Bad": 0
          },
          percentAcceptableWeeks: 0,
          percentGoodWeeks: 0,
          wowVariance: 0, // Indicate variance couldn't be calculated
          gogVariance: gogVariance, // Still provide GoG
          totalGamesPlayed,
          totalWins,
          totalLosses,
          totalOtLosses,
          totalSaves,
          totalShotsAgainst,
          totalGoalsAgainst,
          totalShutouts,
          totalTimeOnIce,
          overallSavePct,
          overallGaa
        };
      }

      // --- Calculate Weekly Points and WoW Variance ---
      let totalPoints = 0;
      const weekCounts: WeekCounts = {
        Elite: 0,
        Quality: 0,
        Average: 0,
        Bad: 0,
        "Really Bad": 0
      };
      const weeklyPoints: number[] = [];

      weeklySummaries.forEach((weekStat) => {
        // Rank the WEEKLY summary against the overall WEEKLY averages
        const { points, ranking } = calculateRanking(
          weekStat,
          weekAverages,
          selectedStats
        );
        weekCounts[ranking]++;
        totalPoints += points;
        weeklyPoints.push(points);
      });
      const wowVariance = calculateStandardDeviation(weeklyPoints);

      // --- Calculate Percentage Metrics ---
      const totalRankedWeeks = weeklySummaries.length;
      const acceptableWeeks =
        weekCounts["Elite"] + weekCounts["Quality"] + weekCounts["Average"];
      const goodWeeks = weekCounts["Elite"] + weekCounts["Quality"];

      const percentAcceptableWeeks =
        totalRankedWeeks > 0 ? (acceptableWeeks / totalRankedWeeks) * 100 : 0;
      const percentGoodWeeks =
        totalRankedWeeks > 0 ? (goodWeeks / totalRankedWeeks) * 100 : 0;

      return {
        ...goalie, // Includes playerId, goalieFullName, potentially team
        totalPoints,
        weekCounts,
        percentAcceptableWeeks,
        percentGoodWeeks,
        wowVariance,
        gogVariance,
        // Include aggregated stats
        totalGamesPlayed,
        totalWins,
        totalLosses,
        totalOtLosses,
        totalSaves,
        totalShotsAgainst,
        totalGoalsAgainst,
        totalShutouts,
        totalTimeOnIce,
        overallSavePct,
        overallGaa
        // games: games // Optionally include raw game data
      };
    })
    .filter((g) => g !== null) as GoalieRanking[]; // Filter out nulls and assert type

  // Sort by total points (descending)
  return goalieRankings.sort((a, b) => b.totalPoints - a.totalPoints);
};
