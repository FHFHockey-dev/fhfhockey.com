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

// --- Main Calculation Function ---
export const calculateGoalieRankings = (
  goalieWeeklyData: GoalieWeeklyAggregate[],
  leagueWeeklyAverages: LeagueWeeklyAverage[], // Still needed for WoW
  goalieGameData: GoalieGameStat[], // Uses data from wgo_goalie_stats
  selectedStatKeys: NumericGoalieStatKey[], // UI Keys for WoW ranking
  statColumns: StatColumn[],
  startWeek: number,
  endWeek: number,
  fantasyPointSettings: FantasyPointSettings // Pass in the settings
): GoalieRanking[] => {
  if (
    !goalieWeeklyData ||
    !leagueWeeklyAverages ||
    !goalieGameData ||
    // goalieWeeklyData.length === 0 || // Allow processing even with no weekly data if game data exists
    leagueWeeklyAverages.length === 0 || // Needed for WoW
    goalieGameData.length === 0 // Need game data for fPts and GoG
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

  // --- Prepare Game Data & Calculate Fantasy Points ---
  const gamesByGoalie = new Map<number, GoalieGameStat[]>();
  let totalLeagueFantasyPoints = 0;
  let totalLeagueGames = 0;

  goalieGameData.forEach((game) => {
    if (game.goalie_id !== null) {
      // Calculate fantasy points for this game
      const fPts = calculateGameFantasyPoints(game, fantasyPointSettings);
      const gameWithFPts = { ...game, fantasyPoints: fPts }; // Add fPts to the game object

      totalLeagueFantasyPoints += fPts;
      totalLeagueGames++;

      if (!gamesByGoalie.has(game.goalie_id)) {
        gamesByGoalie.set(game.goalie_id, []);
      }
      gamesByGoalie.get(game.goalie_id)!.push(gameWithFPts); // Store game with fPts
    }
  });

  // Calculate overall league average fPts per game for the period
  const leagueAvgFantasyPointsPerGame =
    totalLeagueGames > 0 ? totalLeagueFantasyPoints / totalLeagueGames : 0;

  // --- Process Weekly Data & Initialize Results ---
  const goalieResults = new Map<
    number,
    {
      info: GoalieInfo;
      weekCounts: WeekCounts;
      weeklyStatsList: GoalieWeeklyAggregate[]; // Keep for overall stats calc & WoW
      weeklyPoints: number[]; // For WoW variance (based on weekly ranking vs league avg)
      gameFantasyPoints: number[]; // For GoG variance (based on fPts per game)
      gamesInPeriod: GoalieGameStat[]; // Store games (now including fPts)
    }
  >();

  // Initialize results structure using goalies from game data
  gamesByGoalie.forEach((games, goalieId) => {
    const firstGame = games[0];
    goalieResults.set(goalieId, {
      info: {
        playerId: goalieId,
        goalieFullName: firstGame?.goalie_name ?? "Unknown Goalie",
        team: undefined // Will get updated from weekly data if available
      },
      weekCounts: { Elite: 0, Quality: 0, Average: 0, Bad: 0, "Really Bad": 0 },
      weeklyStatsList: [],
      weeklyPoints: [],
      gameFantasyPoints: games.map((g) => g.fantasyPoints ?? 0), // Store calculated fPts
      gamesInPeriod: games // Store the games associated with this goalie
    });
  });

  // Process weekly aggregates (for WoW variance and enriching goalie info like team)
  for (let week = startWeek; week <= endWeek; week++) {
    const leagueAverage = averagesByWeek.get(week);
    const weeklyAggregatesThisWeek = goalieWeeklyData.filter(
      (agg) => agg.week === week
    );

    weeklyAggregatesThisWeek.forEach((goalieStat) => {
      const goalieId = goalieStat.goalie_id;
      // Only process if the goalie exists in our results map (meaning they had games)
      if (goalieId !== null && goalieResults.has(goalieId)) {
        const currentResult = goalieResults.get(goalieId)!;

        // Calculate weekly rank/points for WoW
        if (leagueAverage) {
          const { ranking, points } = calculateWeeklyRanking(
            goalieStat,
            leagueAverage,
            selectedStatKeys, // Use UI selected stats for WoW ranking
            statColumns
          );
          currentResult.weekCounts[ranking]++;
          currentResult.weeklyPoints.push(points);
        }

        // Store weekly stats & update info
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
  } // End week loop

  // --- Finalize GoalieRanking Output ---
  let finalRankings: GoalieRanking[] = [];
  goalieResults.forEach((result, goalieId) => {
    const totalRankedWeeks = result.weeklyPoints.length;
    const totalGames = result.gamesInPeriod.length;

    if (totalGames === 0) return; // Skip goalies with no games in the period

    // Calculate WoW Variance (based on weekly points vs league avg ranking)
    const wowVariance = calculateStandardDeviation(result.weeklyPoints);

    // Calculate GoG Variance (based on game fantasy points)
    // Requires at least 2 games to calculate StdDev
    const gogVariance =
      totalGames >= 2
        ? calculateStandardDeviation(result.gameFantasyPoints)
        : 0;

    // Calculate percentage metrics (based on weekly points/ranks)
    const acceptableWeeks =
      result.weekCounts.Elite +
      result.weekCounts.Quality +
      result.weekCounts.Average;
    const goodWeeks = result.weekCounts.Elite + result.weekCounts.Quality;
    const percentAcceptableWeeks =
      totalRankedWeeks > 0 ? (acceptableWeeks / totalRankedWeeks) * 100 : 0;
    const percentGoodWeeks =
      totalRankedWeeks > 0 ? (goodWeeks / totalRankedWeeks) * 100 : 0;

    // Aggregate overall stats (use game data for accuracy over the period)
    let totalGP = 0,
      totalGS = 0,
      totalWins = 0,
      totalLosses = 0,
      totalOTL = 0,
      totalSaves = 0,
      totalSA = 0,
      totalGA = 0,
      totalSO = 0,
      totalTOI = 0, // seconds
      totalFPts = 0;

    result.gamesInPeriod.forEach((game) => {
      totalGP++; // Each game row counts as 1 GP? Assuming wgo_goalie_stats is per game played.
      totalGS += game.games_started ?? 0; // Sum GS if available
      totalWins += game.wins ?? 0;
      totalLosses += game.losses ?? 0;
      totalOTL += game.ot_losses ?? 0;
      totalSaves += game.saves ?? 0;
      totalSA += game.shots_against ?? 0;
      totalGA += game.goals_against ?? 0;
      totalSO += game.shutouts ?? 0;
      totalTOI += game.time_on_ice ?? 0; // Should be in seconds from DB
      totalFPts += game.fantasyPoints ?? 0;
    });

    const overallSavePct = calculateOverallSavePct(totalSaves, totalSA);
    const overallGaa = calculateOverallGAA(totalGA, totalTOI);
    const averageFantasyPointsPerGame =
      totalGames > 0 ? totalFPts / totalGames : 0;

    const totalWowPoints = result.weeklyPoints.reduce(
      (sum, pts) => sum + pts,
      0
    );

    finalRankings.push({
      playerId: result.info.playerId,
      goalieFullName: result.info.goalieFullName,
      team: result.info.team,
      totalPoints: totalWowPoints, // Keep total points based on WoW ranking for now
      weekCounts: result.weekCounts,
      percentAcceptableWeeks: percentAcceptableWeeks,
      percentGoodWeeks: percentGoodWeeks,
      wowVariance: wowVariance, // WoW based on weekly ranking points
      gogVariance: gogVariance, // GoG based on std dev of fantasy points per game
      totalGamesPlayed: totalGP,
      // totalGamesStarted: totalGS, // Can add if needed
      totalWins: totalWins,
      totalLosses: totalLosses,
      totalOtLosses: totalOTL,
      totalSaves: totalSaves,
      totalShotsAgainst: totalSA,
      totalGoalsAgainst: totalGA,
      totalShutouts: totalSO,
      totalTimeOnIce: totalTOI > 0 ? totalTOI / 60 : 0, // Convert seconds to minutes
      overallSavePct: overallSavePct,
      overallGaa: overallGaa,
      // Add fPts averages
      averageFantasyPointsPerGame: averageFantasyPointsPerGame,
      leagueAverageFantasyPointsPerGame: leagueAvgFantasyPointsPerGame,
      // Percentiles added later
      percentiles: {},
      averagePercentileRank: 0
    });
  });

  // --- Calculate Percentile Ranks ---
  // Only calculate if there are rankings to process
  if (finalRankings.length > 0) {
    // Get all available numeric stat keys from the StatColumn definition that have a defined direction
    const percentileStatKeys = statColumns
      .map((c) => c.value)
      .filter((key) => statMap[key] !== undefined) as NumericGoalieStatKey[];

    percentileStatKeys.forEach((key) => {
      const direction = statMap[key];
      // Extract all non-null, valid numeric values for this stat from the finalRankings
      const values: number[] = finalRankings
        .map((r) => {
          // Map UI key to the calculated overall stat key in GoalieRanking
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
              return r.totalTimeOnIce; // Minutes
            case "savePct":
              return r.overallSavePct;
            case "goalsAgainstAverage":
              return r.overallGaa;
            // Add savesPer60, shotsAgainstPer60 if calculated and stored in GoalieRanking
            // case "savesPer60": return r.overallSavesPer60 ?? null;
            // case "shotsAgainstPer60": return r.overallShotsAgainstPer60 ?? null;
            default:
              return null; // Ignore stats not directly available as overall numbers
          }
        })
        .filter((v): v is number => v !== null && !isNaN(v)); // Ensure it's a valid number

      if (values.length > 0) {
        const sortedValues = [...values].sort((a, b) => a - b);
        // Calculate percentile for each goalie
        finalRankings.forEach((goalie) => {
          const goalieValue = ((): number | null => {
            switch (key) {
              case "gamesPlayed":
                return goalie.totalGamesPlayed;
              case "wins":
                return goalie.totalWins;
              // ... map other keys similarly ...
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
            if (!goalie.percentiles) goalie.percentiles = {};
            goalie.percentiles[key] = percentile;
          }
        });
      }
    });

    // Calculate Average Percentile Rank
    finalRankings.forEach((goalie) => {
      if (goalie.percentiles) {
        const validPercentiles = Object.values(goalie.percentiles).filter(
          (p): p is number => p !== undefined && !isNaN(p)
        );
        goalie.averagePercentileRank =
          validPercentiles.length > 0
            ? validPercentiles.reduce((sum, p) => sum + p, 0) /
              validPercentiles.length
            : 0;
      } else {
        goalie.averagePercentileRank = 0;
      }
    });
  } // End percentile calculation

  // Sort by total WoW points (or maybe average percentile rank now?)
  // Let's keep sorting by WoW points for now.
  return finalRankings.sort((a, b) => b.totalPoints - a.totalPoints);
};
