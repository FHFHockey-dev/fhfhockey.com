// web/components/GoaliePage/goalieCalculations.ts
import type {
  NumericGoalieStatKey,
  Ranking,
  WeekCounts,
  GoalieRanking, // Output type for leaderboard
  StatColumn,
  GoalieInfo,
  GoalieWeeklyAggregate,
  LeagueWeeklyAverage,
  GoalieGameStat,
  FantasyPointSettings, // Import new type
  FantasyCountStatKey // Import new type
} from "./goalieTypes";

// --- Constants ---
// Defines which stats are better higher or lower (using UI keys like 'savePct')
// Keep this for WoW ranking and percentile ranking direction
export const statMap: Record<NumericGoalieStatKey, "larger" | "smaller"> = {
  gamesPlayed: "larger",
  gamesStarted: "larger",
  wins: "larger",
  losses: "smaller",
  otLosses: "smaller",
  saves: "larger",
  savesPer60: "larger",
  shotsAgainst: "larger", // Note: Not typically ranked, but needed for direction
  shotsAgainstPer60: "larger", // Note: Not typically ranked, but needed for direction
  goalsAgainst: "smaller",
  savePct: "larger",
  goalsAgainstAverage: "smaller",
  shutouts: "larger",
  timeOnIce: "larger" // Note: Not typically ranked directly
};

// Points assigned to performance rankings (weekly vs league average) - KEEP FOR WoW
export const rankingPoints: Record<Ranking, number> = {
  Elite: 20,
  Quality: 10,
  Average: 5,
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

// Calculate overall stats (Keep)
const calculateOverallSavePct = (
  totalSaves: number,
  totalShotsAgainst: number
): number => {
  return totalShotsAgainst > 0 ? totalSaves / totalShotsAgainst : 0;
};
const calculateOverallGAA = (
  totalGoalsAgainst: number,
  totalTimeOnIceSeconds: number
): number => {
  return totalTimeOnIceSeconds > 0
    ? (totalGoalsAgainst * 3600) / totalTimeOnIceSeconds
    : 0;
};

// --- NEW: Fantasy Point Calculation ---
/**
 * Calculates fantasy points for a single game based on settings.
 */
export const calculateGameFantasyPoints = (
  gameStat: GoalieGameStat,
  settings: FantasyPointSettings
): number => {
  let fPts = 0;
  // Access settings using the FantasyCountStatKey type
  fPts += (gameStat.goals_against ?? 0) * settings.goalAgainst;
  fPts += (gameStat.saves ?? 0) * settings.save;
  fPts += (gameStat.shutouts ?? 0) * settings.shutout;
  fPts += (gameStat.wins ?? 0) * settings.win;
  // Add other counting stats here if they are added to FantasyCountStatKey and settings
  return fPts;
};

// Calculate Weekly Ranking (vs League Average) - Keep for WoW
export const calculateWeeklyRanking = (
  goalieWeekStat: GoalieWeeklyAggregate,
  leagueAverage: LeagueWeeklyAverage,
  selectedStatKeys: NumericGoalieStatKey[], // e.g., ['saves', 'savePct']
  statColumns: StatColumn[] // Pass the mapping info
): { ranking: Ranking; percentage: number; points: number } => {
  if (selectedStatKeys.length === 0) {
    return { ranking: "Average", percentage: 0, points: rankingPoints.Average };
  }

  const getMapping = (key: NumericGoalieStatKey) =>
    statColumns.find((c) => c.value === key);

  let betterStats = 0;
  let comparableStats = 0; // Count how many stats were actually compared

  selectedStatKeys.forEach((key) => {
    const mapping = getMapping(key);
    if (!mapping?.dbFieldGoalie || !mapping?.dbFieldAverage) {
      console.warn(`No DB field mapping found for selected stat: ${key}`);
      return;
    }

    const comparisonType = statMap[key];
    if (!comparisonType) return;

    const goalieValue = goalieWeekStat[
      mapping.dbFieldGoalie as keyof GoalieWeeklyAggregate
    ] as number | null;
    const averageValue = leagueAverage[
      mapping.dbFieldAverage as keyof LeagueWeeklyAverage
    ] as number | null;

    if (
      goalieValue === null ||
      averageValue === null ||
      isNaN(goalieValue) ||
      isNaN(averageValue) ||
      averageValue === 0 // Avoid division by zero or meaningless comparison with 0 average
    ) {
      // console.warn(
      //   `Skipping comparison for stat ${key} due to null/NaN/zero values`
      // );
      return; // Skip this stat for comparison
    }

    comparableStats++; // Increment count of stats we could compare

    if (comparisonType === "larger" && goalieValue >= averageValue) {
      betterStats++;
    } else if (comparisonType === "smaller" && goalieValue <= averageValue) {
      betterStats++;
    }
  });

  // Base percentage on comparable stats
  const percentage =
    comparableStats > 0 ? (betterStats / comparableStats) * 100 : 0;
  let ranking: Ranking;

  if (percentage >= 80) ranking = "Elite";
  else if (percentage >= 60) ranking = "Quality";
  else if (percentage >= 45) ranking = "Average";
  else if (percentage >= 30) ranking = "Bad";
  else ranking = "Really Bad";

  const points = rankingPoints[ranking];

  return { ranking, percentage, points };
};

// --- NEW: Percentile Calculation Helper ---
/**
 * Calculates the percentile rank of a value within a sorted array.
 * Handles "larger is better" and "smaller is better".
 */
const calculatePercentile = (
  value: number,
  sortedValues: number[],
  direction: "larger" | "smaller"
): number => {
  if (sortedValues.length === 0 || isNaN(value)) {
    return 0; // Or handle as undefined/null
  }

  // Find the rank (position) of the value
  // For "larger is better", rank is the number of values less than or equal to it
  // For "smaller is better", rank is the number of values greater than or equal to it
  let rank = 0;
  if (direction === "larger") {
    // Find first index strictly greater than value
    const firstGreaterIndex = sortedValues.findIndex((v) => v > value);
    rank = firstGreaterIndex === -1 ? sortedValues.length : firstGreaterIndex; // If all <= value, rank is max
  } else {
    // Find first index strictly less than value
    const firstLessIndex = sortedValues.findIndex((v) => v < value);
    rank = firstLessIndex === -1 ? sortedValues.length : firstLessIndex; // If all >= value, rank is max
  }

  // Percentile formula: (rank / N) * 100
  // We use rank directly because findIndex gives 0-based index of *next* element
  // So, the count of elements <= (or >=) is `index`.
  // Example: [10, 20, 30, 40]. Value 20. Larger is better. findIndex(v > 20) -> index 2 (value 30). Rank is 2.
  // There are 2 values (10, 20) <= 20. Percentile = (2/4)*100 = 50th. Seems correct.

  // Refined Percentile Calculation (Common definition: % of scores *below* this score)
  let countBelow = 0;
  let countEqual = 0;
  for (const v of sortedValues) {
    if (v < value) {
      countBelow++;
    } else if (v === value) {
      countEqual++;
    }
  }

  // Standard percentile rank formula: (countBelow + 0.5 * countEqual) / totalCount
  let percentileRank =
    sortedValues.length > 0
      ? ((countBelow + 0.5 * countEqual) / sortedValues.length) * 100
      : 0;

  // Adjust for "smaller is better" - invert the percentile
  if (direction === "smaller") {
    percentileRank = 100 - percentileRank;
  }

  return percentileRank;
};

// --- OPTIMIZED CALCULATION CACHE ---
const calculationCache = new Map<string, any>();

// Generate cache key for goalie rankings calculation
const generateRankingCacheKey = (
  weeklyDataLength: number,
  gameDataLength: number,
  selectedStats: NumericGoalieStatKey[],
  startWeek: number,
  endWeek: number,
  fantasySettings: FantasyPointSettings
): string => {
  return `rankings_${weeklyDataLength}_${gameDataLength}_${selectedStats.sort().join(",")}_${startWeek}_${endWeek}_${JSON.stringify(fantasySettings)}`;
};

// --- Main Calculation Function (Enhanced with Caching) ---
export const calculateGoalieRankings = (
  goalieWeeklyData: GoalieWeeklyAggregate[],
  leagueWeeklyAverages: LeagueWeeklyAverage[],
  goalieGameData: GoalieGameStat[],
  selectedStatKeys: NumericGoalieStatKey[],
  statColumns: StatColumn[],
  startWeek: number,
  endWeek: number,
  fantasyPointSettings: FantasyPointSettings
): GoalieRanking[] => {
  // Generate cache key
  const cacheKey = generateRankingCacheKey(
    goalieWeeklyData.length,
    goalieGameData.length,
    selectedStatKeys,
    startWeek,
    endWeek,
    fantasyPointSettings
  );

  // Check cache first
  if (calculationCache.has(cacheKey)) {
    console.log(
      `🚀 Cache hit for ranking calculation: ${cacheKey.substring(0, 50)}...`
    );
    return calculationCache.get(cacheKey);
  }

  console.log(
    `🔄 Computing new ranking calculation: ${cacheKey.substring(0, 50)}...`
  );
  const startTime = performance.now();

  // ...existing validation code...
  if (
    !goalieWeeklyData ||
    !leagueWeeklyAverages ||
    !goalieGameData ||
    leagueWeeklyAverages.length === 0 ||
    goalieGameData.length === 0
  ) {
    return [];
  }

  // --- Prepare Weekly Lookups (Averages by Week for WoW) ---
  const averagesByWeek = new Map<number, LeagueWeeklyAverage>();
  leagueWeeklyAverages.forEach((avg) => {
    if (avg.week != null) {
      averagesByWeek.set(avg.week, avg);
    }
  });

  // --- OPTIMIZED: Batch calculate fantasy points for all games ---
  const gamesByGoalie = new Map<number, GoalieGameStat[]>();
  let totalLeagueFantasyPoints = 0;
  let totalLeagueGames = 0;

  // Process all game data in a single pass
  const gamesWithFantasyPoints = goalieGameData.map((game) => {
    const fPts = calculateGameFantasyPoints(game, fantasyPointSettings);
    totalLeagueFantasyPoints += fPts;
    totalLeagueGames++;

    const gameWithFPts = { ...game, fantasyPoints: fPts };

    if (game.goalie_id !== null) {
      if (!gamesByGoalie.has(game.goalie_id)) {
        gamesByGoalie.set(game.goalie_id, []);
      }
      gamesByGoalie.get(game.goalie_id)!.push(gameWithFPts);
    }

    return gameWithFPts;
  });

  // Calculate overall league average fPts per game for the period
  const leagueAvgFantasyPointsPerGame =
    totalLeagueGames > 0 ? totalLeagueFantasyPoints / totalLeagueGames : 0;

  // --- OPTIMIZED: Process Weekly Data & Initialize Results ---
  const goalieResults = new Map<
    number,
    {
      info: GoalieInfo;
      weekCounts: WeekCounts;
      weeklyStatsList: GoalieWeeklyAggregate[];
      weeklyPoints: number[];
      gameFantasyPoints: number[];
      gamesInPeriod: GoalieGameStat[];
    }
  >();

  // Initialize results structure using goalies from game data
  gamesByGoalie.forEach((games, goalieId) => {
    const firstGame = games[0];
    goalieResults.set(goalieId, {
      info: {
        playerId: goalieId,
        goalieFullName: firstGame?.goalie_name ?? "Unknown Goalie",
        team: undefined
      },
      weekCounts: { Elite: 0, Quality: 0, Average: 0, Bad: 0, "Really Bad": 0 },
      weeklyStatsList: [],
      weeklyPoints: [],
      gameFantasyPoints: games.map((g) => g.fantasyPoints ?? 0),
      gamesInPeriod: games
    });
  });

  // --- OPTIMIZED: Group weekly data by week for efficient processing ---
  const weeklyDataByWeek = new Map<number, GoalieWeeklyAggregate[]>();
  goalieWeeklyData.forEach((aggregate) => {
    if (aggregate.week !== null) {
      if (!weeklyDataByWeek.has(aggregate.week)) {
        weeklyDataByWeek.set(aggregate.week, []);
      }
      weeklyDataByWeek.get(aggregate.week)!.push(aggregate);
    }
  });

  // Process weekly aggregates efficiently
  for (let week = startWeek; week <= endWeek; week++) {
    const leagueAverage = averagesByWeek.get(week);
    const weeklyAggregatesThisWeek = weeklyDataByWeek.get(week) || [];

    weeklyAggregatesThisWeek.forEach((goalieStat) => {
      const goalieId = goalieStat.goalie_id;
      if (goalieId !== null && goalieResults.has(goalieId)) {
        const currentResult = goalieResults.get(goalieId)!;

        if (leagueAverage) {
          const { ranking, points } = calculateWeeklyRanking(
            goalieStat,
            leagueAverage,
            selectedStatKeys,
            statColumns
          );
          currentResult.weekCounts[ranking]++;
          currentResult.weeklyPoints.push(points);
        }

        currentResult.weeklyStatsList.push(goalieStat);
        currentResult.info.team = goalieStat.team ?? currentResult.info.team;
        if (
          currentResult.info.goalieFullName === "Unknown Goalie" &&
          goalieStat.goalie_name
        ) {
          currentResult.info.goalieFullName = goalieStat.goalie_name;
        }
      }
    });
  }

  // --- OPTIMIZED: Finalize GoalieRanking Output with batch processing ---
  let finalRankings: GoalieRanking[] = [];

  goalieResults.forEach((result, goalieId) => {
    const totalRankedWeeks = result.weeklyPoints.length;
    const totalGames = result.gamesInPeriod.length;

    if (totalGames === 0) return;

    // Calculate variances efficiently
    const wowVariance = calculateStandardDeviation(result.weeklyPoints);
    const gogVariance =
      totalGames >= 2
        ? calculateStandardDeviation(result.gameFantasyPoints)
        : 0;

    // Calculate percentage metrics
    const acceptableWeeks =
      result.weekCounts.Elite +
      result.weekCounts.Quality +
      result.weekCounts.Average;
    const goodWeeks = result.weekCounts.Elite + result.weekCounts.Quality;
    const percentAcceptableWeeks =
      totalRankedWeeks > 0 ? (acceptableWeeks / totalRankedWeeks) * 100 : 0;
    const percentGoodWeeks =
      totalRankedWeeks > 0 ? (goodWeeks / totalRankedWeeks) * 100 : 0;

    // --- OPTIMIZED: Aggregate overall stats efficiently ---
    const aggregatedStats = result.gamesInPeriod.reduce(
      (acc, game) => ({
        GP: acc.GP + 1,
        GS: acc.GS + (game.games_started ?? 0),
        wins: acc.wins + (game.wins ?? 0),
        losses: acc.losses + (game.losses ?? 0),
        otLosses: acc.otLosses + (game.ot_losses ?? 0),
        saves: acc.saves + (game.saves ?? 0),
        shotsAgainst: acc.shotsAgainst + (game.shots_against ?? 0),
        goalsAgainst: acc.goalsAgainst + (game.goals_against ?? 0),
        shutouts: acc.shutouts + (game.shutouts ?? 0),
        timeOnIce: acc.timeOnIce + (game.time_on_ice ?? 0),
        fantasyPoints: acc.fantasyPoints + (game.fantasyPoints ?? 0)
      }),
      {
        GP: 0,
        GS: 0,
        wins: 0,
        losses: 0,
        otLosses: 0,
        saves: 0,
        shotsAgainst: 0,
        goalsAgainst: 0,
        shutouts: 0,
        timeOnIce: 0,
        fantasyPoints: 0
      }
    );

    const overallSavePct = calculateOverallSavePct(
      aggregatedStats.saves,
      aggregatedStats.shotsAgainst
    );
    const overallGaa = calculateOverallGAA(
      aggregatedStats.goalsAgainst,
      aggregatedStats.timeOnIce
    );
    const averageFantasyPointsPerGame =
      totalGames > 0 ? aggregatedStats.fantasyPoints / totalGames : 0;
    const totalWowPoints = result.weeklyPoints.reduce(
      (sum, pts) => sum + pts,
      0
    );

    finalRankings.push({
      playerId: result.info.playerId,
      goalieFullName: result.info.goalieFullName,
      team: result.info.team,
      totalPoints: totalWowPoints,
      weekCounts: result.weekCounts,
      percentAcceptableWeeks,
      percentGoodWeeks,
      wowVariance,
      gogVariance,
      totalGamesPlayed: aggregatedStats.GP,
      totalWins: aggregatedStats.wins,
      totalLosses: aggregatedStats.losses,
      totalOtLosses: aggregatedStats.otLosses,
      totalSaves: aggregatedStats.saves,
      totalShotsAgainst: aggregatedStats.shotsAgainst,
      totalGoalsAgainst: aggregatedStats.goalsAgainst,
      totalShutouts: aggregatedStats.shutouts,
      totalTimeOnIce:
        aggregatedStats.timeOnIce > 0 ? aggregatedStats.timeOnIce / 60 : 0,
      overallSavePct,
      overallGaa,
      averageFantasyPointsPerGame,
      leagueAverageFantasyPointsPerGame: leagueAvgFantasyPointsPerGame, // Fix: use the correct variable name
      percentiles: {},
      averagePercentileRank: 0
    });
  });

  // --- OPTIMIZED: Batch calculate percentiles ---
  if (finalRankings.length > 0) {
    const percentileStatKeys = statColumns
      .map((c) => c.value)
      .filter((key) => statMap[key] !== undefined) as NumericGoalieStatKey[];

    // Pre-calculate all stat value arrays to avoid repeated mapping
    const statValueMaps = new Map<NumericGoalieStatKey, number[]>();

    percentileStatKeys.forEach((key) => {
      const values = finalRankings
        .map((r) => {
          switch (key) {
            case "gamesPlayed":
              return r.totalGamesPlayed;
            case "wins":
              return r.totalWins;
            case "losses":
              return r.totalLosses;
            case "otLosses":
              return r.totalOtLosses;
            case "saves":
              return r.totalSaves;
            case "shotsAgainst":
              return r.totalShotsAgainst;
            case "goalsAgainst":
              return r.totalGoalsAgainst;
            case "shutouts":
              return r.totalShutouts;
            case "timeOnIce":
              return r.totalTimeOnIce;
            case "savePct":
              return r.overallSavePct;
            case "goalsAgainstAverage":
              return r.overallGaa;
            default:
              return null;
          }
        })
        .filter((v): v is number => v !== null && !isNaN(v));

      if (values.length > 0) {
        statValueMaps.set(
          key,
          [...values].sort((a, b) => a - b)
        );
      }
    });

    // Calculate percentiles for each goalie efficiently
    finalRankings.forEach((goalie) => {
      const percentiles: Partial<Record<NumericGoalieStatKey, number>> = {};
      let validPercentileCount = 0;
      let percentileSum = 0;

      statValueMaps.forEach((sortedValues, key) => {
        const direction = statMap[key];
        const goalieValue = (() => {
          switch (key) {
            case "gamesPlayed":
              return goalie.totalGamesPlayed;
            case "wins":
              return goalie.totalWins;
            case "losses":
              return goalie.totalLosses;
            case "otLosses":
              return goalie.totalOtLosses;
            case "saves":
              return goalie.totalSaves;
            case "shotsAgainst":
              return goalie.totalShotsAgainst;
            case "goalsAgainst":
              return goalie.totalGoalsAgainst;
            case "shutouts":
              return goalie.totalShutouts;
            case "timeOnIce":
              return goalie.totalTimeOnIce;
            case "savePct":
              return goalie.overallSavePct;
            case "goalsAgainstAverage":
              return goalie.overallGaa;
            default:
              return null;
          }
        })();

        if (goalieValue !== null && !isNaN(goalieValue)) {
          const percentile = calculatePercentile(
            goalieValue,
            sortedValues,
            direction
          );
          percentiles[key] = percentile;
          percentileSum += percentile;
          validPercentileCount++;
        }
      });

      goalie.percentiles = percentiles;
      goalie.averagePercentileRank =
        validPercentileCount > 0 ? percentileSum / validPercentileCount : 0;
    });
  }

  // Sort by total WoW points
  const sortedRankings = finalRankings.sort(
    (a, b) => b.totalPoints - a.totalPoints
  );

  const endTime = performance.now();
  console.log(
    `✅ Ranking calculation completed in ${(endTime - startTime).toFixed(2)}ms`
  );

  // Cache the result
  calculationCache.set(cacheKey, sortedRankings);

  return sortedRankings;
};
