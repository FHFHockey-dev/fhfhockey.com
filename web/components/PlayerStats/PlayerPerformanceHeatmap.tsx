import React, { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isAfter,
  startOfDay,
  getDay,
  addDays,
  startOfYear,
  endOfYear
} from "date-fns";
import styles from "./PlayerStats.module.scss";
import { useMissedGames } from "hooks/useMissedGames";
import {
  PlayerPerformanceHeatmapProps,
  GameLogEntry,
  formatStatValue,
  STAT_DISPLAY_NAMES,
  MissedGame
} from "./types";

type PerformanceLevel =
  | "elite"
  | "excellent"
  | "good"
  | "average"
  | "below-average"
  | "poor"
  | "very-poor"
  | "no-data";

// Enhanced performance calculation using percentile-based approach
const calculatePercentile = (value: number, stat: string): number => {
  // Enhanced thresholds based on NHL data
  const thresholds: {
    [key: string]: {
      p90: number;
      p75: number;
      p50: number;
      p25: number;
      p10: number;
      isInverted?: boolean;
    };
  } = {
    // Basic offensive stats
    points: { p90: 1.4, p75: 1.0, p50: 0.6, p25: 0.35, p10: 0.2 },
    goals: { p90: 0.7, p75: 0.5, p50: 0.3, p25: 0.2, p10: 0.1 },
    assists: { p90: 1.0, p75: 0.7, p50: 0.4, p25: 0.25, p10: 0.15 },

    // Shot metrics
    shots: { p90: 4.0, p75: 3.2, p50: 2.4, p25: 1.8, p10: 1.2 },
    shooting_percentage: { p90: 16, p75: 13, p50: 10, p25: 8, p10: 6 },

    // Advanced metrics
    cf_pct: { p90: 56, p75: 53, p50: 50, p25: 47, p10: 44 },
    xgf_pct: { p90: 56, p75: 53, p50: 50, p25: 47, p10: 44 },
    hdcf_pct: { p90: 56, p75: 53, p50: 50, p25: 47, p10: 44 },

    // Per-60 stats
    ixg_per_60: { p90: 2.8, p75: 2.2, p50: 1.5, p25: 1.0, p10: 0.6 },
    shots_per_60: { p90: 14, p75: 11, p50: 8, p25: 6, p10: 4 },
    goals_per_60: { p90: 2.2, p75: 1.7, p50: 1.0, p25: 0.6, p10: 0.3 },
    total_points_per_60: { p90: 4.5, p75: 3.5, p50: 2.2, p25: 1.4, p10: 0.8 },

    // Two-way play
    hits: { p90: 4.5, p75: 3.0, p50: 1.8, p25: 1.0, p10: 0.5 },
    blocked_shots: { p90: 2.5, p75: 1.8, p50: 1.1, p25: 0.7, p10: 0.3 },
    takeaways: { p90: 2.0, p75: 1.4, p50: 0.9, p25: 0.5, p10: 0.2 },
    giveaways: {
      p90: 0.8,
      p75: 1.2,
      p50: 1.8,
      p25: 2.5,
      p10: 3.5,
      isInverted: true
    },

    // Ice time
    toi_per_game: { p90: 22, p75: 19, p50: 16, p25: 13, p10: 10 },

    // Faceoffs
    fow_percentage: { p90: 58, p75: 54, p50: 50, p25: 46, p10: 42 }
  };

  const threshold = thresholds[stat];
  if (!threshold) return 50; // Default to 50th percentile if no threshold

  const { p90, p75, p50, p25, p10, isInverted = false } = threshold;

  if (isInverted) {
    // For stats where lower is better (like giveaways)
    if (value <= p90) return 95;
    if (value <= p75) return 85;
    if (value <= p50) return 60;
    if (value <= p25) return 35;
    if (value <= p10) return 15;
    return 5;
  } else {
    // For stats where higher is better
    if (value >= p90) return 95;
    if (value >= p75) return 85;
    if (value >= p50) return 60;
    if (value >= p25) return 35;
    if (value >= p10) return 15;
    return 5;
  }
};

const calculatePerformanceLevel = (
  game: GameLogEntry,
  selectedStats: string[]
): PerformanceLevel => {
  if (!game.games_played || game.games_played === 0) return "no-data";

  // Enhanced weighting system
  const weights = {
    points: 2.0,
    goals: 1.8,
    assists: 1.6,
    shots: 1.2,
    shooting_percentage: 1.4,
    toi_per_game: 1.6,
    hits: 1.0,
    blocked_shots: 1.1,
    takeaways: 1.3,
    giveaways: 1.5,
    fow_percentage: 1.4,
    cf_pct: 1.3,
    xgf_pct: 1.4,
    hdcf_pct: 1.3,
    ixg_per_60: 1.5,
    shots_per_60: 1.2,
    goals_per_60: 1.7,
    total_points_per_60: 1.8
  };

  let totalScore = 0;
  let totalWeight = 0;

  selectedStats.forEach((stat) => {
    const value = game[stat];
    if (value === null || value === undefined) return;

    const weight = weights[stat as keyof typeof weights] || 1;
    const percentile = calculatePercentile(Number(value), stat);

    totalScore += percentile * weight;
    totalWeight += weight;
  });

  if (totalWeight === 0) return "no-data";

  const averagePercentile = totalScore / totalWeight;

  if (averagePercentile >= 90) return "elite";
  if (averagePercentile >= 75) return "excellent";
  if (averagePercentile >= 60) return "good";
  if (averagePercentile >= 40) return "average";
  if (averagePercentile >= 25) return "below-average";
  if (averagePercentile >= 10) return "poor";
  return "very-poor";
};

// Keep existing color and label functions (they work well)
const getPerformanceColor = (level: PerformanceLevel): string => {
  const colorMap = {
    elite: "#1a5d1a",
    excellent: "#2d8f2d",
    good: "#4fb84f",
    average: "#85c985",
    "below-average": "#ffd700",
    poor: "#ff8c42",
    "very-poor": "#d32f2f",
    "no-data": "#2a2a2a"
  };
  return colorMap[level];
};

const getPerformanceLevelLabel = (level: PerformanceLevel): string => {
  const labelMap = {
    elite: "Elite (90th+ percentile)",
    excellent: "Excellent (75-89th percentile)",
    good: "Good (60-74th percentile)",
    average: "Average (40-59th percentile)",
    "below-average": "Below Average (25-39th percentile)",
    poor: "Poor (10-24th percentile)",
    "very-poor": "Very Poor (0-9th percentile)",
    "no-data": "No Game Data"
  };
  return labelMap[level];
};

// GitHub-style Contribution Graph Component
interface ContributionGraphProps {
  gameLog: GameLogEntry[];
  playoffGameLog: GameLogEntry[];
  missedGames: any[];
  futureGames: any[];
  selectedStats: string[];
  onDayHover: (
    game: GameLogEntry | null,
    missedGame: any | null,
    futureGame: any | null,
    event: React.MouseEvent
  ) => void;
  onDayLeave: () => void;
}

function ContributionGraph({
  gameLog,
  playoffGameLog,
  missedGames,
  futureGames,
  selectedStats,
  onDayHover,
  onDayLeave
}: ContributionGraphProps) {
  const contributionData = useMemo(() => {
    // Combine all games
    const allGames = [
      ...gameLog.map((game) => ({ ...game, isPlayoff: false })),
      ...playoffGameLog.map((game) => ({ ...game, isPlayoff: true }))
    ];

    if (allGames.length === 0) return null;

    // Create maps for efficient lookups
    const gamesByDate = new Map<string, GameLogEntry>();
    const missedGamesByDate = new Map<string, any>();
    const futureGamesByDate = new Map<string, any>();

    allGames.forEach((game) => {
      const dateKey = format(new Date(game.date), "yyyy-MM-dd");
      gamesByDate.set(dateKey, game);
    });

    missedGames.forEach((missedGame) => {
      const dateKey = format(new Date(missedGame.date), "yyyy-MM-dd");
      missedGamesByDate.set(dateKey, missedGame);
    });

    futureGames.forEach((futureGame) => {
      const dateKey = format(new Date(futureGame.date), "yyyy-MM-dd");
      futureGamesByDate.set(dateKey, futureGame);
    });

    // Calculate the season range
    const dates = allGames.map((game) => new Date(game.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Start from the beginning of the season (Monday of the first week)
    const seasonStartYear =
      minDate.getMonth() >= 6
        ? minDate.getFullYear()
        : minDate.getFullYear() - 1;
    let startDate = new Date(seasonStartYear, 9, 1); // October 1st

    // Find the Monday of the week containing the start date
    const startDayOfWeek = getDay(startDate);
    const daysToMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // 0 = Sunday
    startDate = addDays(startDate, -daysToMonday);

    // End at the Sunday of the last week
    const seasonEndYear =
      maxDate.getMonth() >= 6
        ? maxDate.getFullYear() + 1
        : maxDate.getFullYear();
    let endDate = new Date(seasonEndYear, 5, 30); // June 30th

    // Don't extend too far past actual data
    const oneMonthAfterLastGame = new Date(
      maxDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    if (endDate > oneMonthAfterLastGame) {
      endDate = oneMonthAfterLastGame;
    }

    // Find the Sunday of the week containing the end date
    const endDayOfWeek = getDay(endDate);
    const daysToSunday = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
    endDate = addDays(endDate, daysToSunday);

    // Generate all days in the range
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Group days by weeks (Monday = start of week)
    const weeks: Array<{
      days: Array<{
        date: Date;
        game: GameLogEntry | null;
        missedGame: any | null;
        futureGame: any | null;
        performanceLevel: PerformanceLevel;
        isPlayoff: boolean;
        isMissedGame: boolean;
        isFutureGame: boolean;
        dayOfWeek: number; // 0 = Monday, 6 = Sunday
        isEmpty?: boolean; // Add flag for empty cells
      }>;
      monthName?: string;
      isFirstWeekOfMonth?: boolean;
    }> = [];

    // Process days into complete weeks (always 7 days each)
    for (let i = 0; i < allDays.length; i += 7) {
      const weekDays = allDays.slice(i, i + 7);

      // Always create exactly 7 days for each week
      const weekData = {
        days: Array.from({ length: 7 }, (_, dayIndex) => {
          const day = weekDays[dayIndex];

          // If we don't have a day for this position, create an empty placeholder
          if (!day) {
            return {
              date: new Date(), // Placeholder date
              game: null,
              missedGame: null,
              futureGame: null,
              performanceLevel: "no-data" as PerformanceLevel,
              isPlayoff: false,
              isMissedGame: false,
              isFutureGame: false,
              dayOfWeek: dayIndex, // Monday = 0, Sunday = 6
              isEmpty: true
            };
          }

          const dateKey = format(day, "yyyy-MM-dd");
          const game = gamesByDate.get(dateKey) || null;
          const missedGame = missedGamesByDate.get(dateKey) || null;
          const futureGame = futureGamesByDate.get(dateKey) || null;

          const performanceLevel = game
            ? calculatePerformanceLevel(game, selectedStats)
            : "no-data";
          const isPlayoff = game
            ? Boolean(game.isPlayoff)
            : missedGame
              ? Boolean(missedGame.isPlayoff)
              : futureGame
                ? Boolean(futureGame.isPlayoff)
                : false;

          // Calculate day of week where Monday = 0, Sunday = 6
          const dayOfWeek = (getDay(day) + 6) % 7;

          return {
            date: day,
            game,
            missedGame,
            futureGame,
            performanceLevel,
            isPlayoff,
            isMissedGame: Boolean(missedGame),
            isFutureGame: Boolean(futureGame),
            dayOfWeek,
            isEmpty: false
          };
        }),
        monthName: undefined as string | undefined,
        isFirstWeekOfMonth: false
      };

      // Determine if this week should show a month name
      const firstRealDay = weekDays.find((day) => day); // Find first non-empty day
      if (firstRealDay) {
        const monthName = format(firstRealDay, "MMM");

        // Show month name if this is the first week or if the month changed
        if (
          weeks.length === 0 ||
          (weeks.length > 0 && weeks[weeks.length - 1].monthName !== monthName)
        ) {
          weekData.monthName = monthName;
          weekData.isFirstWeekOfMonth = true;
        }
      }

      weeks.push(weekData);
    }

    return { weeks };
  }, [gameLog, playoffGameLog, missedGames, futureGames, selectedStats]);

  if (!contributionData) {
    return (
      <div className={styles.noContributionData}>
        No data available for contribution graph
      </div>
    );
  }

  return (
    <div className={styles.contributionGrid}>
      {/* Day labels (Mon-Sun) */}
      <div className={styles.daysLabels}>
        <div className={styles.dayLabelContainer}></div>{" "}
        {/* Space for month headers */}
        {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((day, index) => (
          <div
            key={index}
            className={`${styles.dayLabel} ${day === "" ? styles.hidden : ""}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Weeks container */}
      <div className={styles.weeksContainer}>
        {contributionData.weeks.map((week, weekIndex) => (
          <div key={weekIndex} className={styles.weekColumn}>
            {/* Month header */}
            <div className={styles.monthHeader}>
              {week.monthName && (
                <span className={styles.monthName}>{week.monthName}</span>
              )}
            </div>

            {/* Render exactly 7 days for each week */}
            {week.days.map((dayData, dayIndex) => {
              // Handle empty placeholder cells
              if (dayData.isEmpty) {
                return <div key={dayIndex} className={styles.emptyDay} />;
              }

              const {
                date,
                game,
                missedGame,
                futureGame,
                performanceLevel,
                isPlayoff,
                isMissedGame,
                isFutureGame
              } = dayData;

              let dayClasses = [styles.contributionDay];

              if (isMissedGame) {
                dayClasses.push(styles.missed);
              } else if (isFutureGame) {
                dayClasses.push(styles.future);
              } else if (game) {
                dayClasses.push(styles[performanceLevel]);
              } else {
                dayClasses.push(styles.noContributionData);
              }

              if (isPlayoff) {
                dayClasses.push(styles.playoff);
              }

              return (
                <div
                  key={dayIndex}
                  className={dayClasses.join(" ")}
                  onMouseEnter={(e) =>
                    onDayHover(game, missedGame, futureGame, e)
                  }
                  onMouseLeave={onDayLeave}
                  title={format(date, "MMM d, yyyy")}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlayerPerformanceHeatmap({
  gameLog,
  playoffGameLog = [],
  selectedStats,
  playerId,
  playerTeamId,
  seasonId,
  missedGames = [], // Accept missed games from props (server-side data)
  futureGames = [], // Accept future scheduled games
  availableSeasonsFormatted = [] // Add this prop
}: PlayerPerformanceHeatmapProps & {
  missedGames?: MissedGame[];
  futureGames?: any[];
  availableSeasonsFormatted?: {
    value: string | number;
    label: string;
    displayName: string;
  }[]; // Add this
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [hoveredGame, setHoveredGame] = useState<GameLogEntry | null>(null);
  const [hoveredMissedGame, setHoveredMissedGame] = useState<any>(null);
  const [hoveredFutureGame, setHoveredFutureGame] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Add season selection state
  const [selectedSeason, setSelectedSeason] = useState<string | number>(
    seasonId || "current"
  );

  // Get today's date for filtering future games
  const today = startOfDay(new Date());

  // Extract available seasons from props instead of calculating from game log
  const availableSeasons = useMemo(() => {
    // Use the formatted seasons passed from server-side props if available
    if (availableSeasonsFormatted && availableSeasonsFormatted.length > 0) {
      console.log(
        "[PlayerPerformanceHeatmap] Using seasons from props:",
        availableSeasonsFormatted
      );
      return availableSeasonsFormatted;
    }

    // Fallback: calculate from game log data (original logic)
    console.log(
      "[PlayerPerformanceHeatmap] Calculating seasons from game log data"
    );
    const seasons = new Set<string>();

    // Add seasons from regular season games
    gameLog.forEach((game) => {
      if (game.date) {
        const gameDate = new Date(game.date);
        const year = gameDate.getFullYear();
        // Hockey season spans two calendar years (e.g., 2024-25 season)
        const seasonStart = gameDate.getMonth() >= 9 ? year : year - 1;
        const seasonKey = `${seasonStart}${seasonStart + 1}`;
        seasons.add(seasonKey);
      }
    });

    // Add seasons from playoff games
    playoffGameLog.forEach((game) => {
      if (game.date) {
        const gameDate = new Date(game.date);
        const year = gameDate.getFullYear();
        // Playoffs are typically in the spring, so the season would have started the previous year
        const seasonStart = gameDate.getMonth() >= 9 ? year : year - 1;
        const seasonKey = `${seasonStart}${seasonStart + 1}`;
        seasons.add(seasonKey);
      }
    });

    // Convert to array and sort, most recent first
    const sortedSeasons = Array.from(seasons).sort((a, b) =>
      b.localeCompare(a)
    );

    return sortedSeasons.map((season) => ({
      value: season,
      label: `${season.slice(0, 4)}-${season.slice(4, 6)}`,
      displayName: `${season.slice(0, 4)}-${season.slice(6, 8)} Season`
    }));
  }, [gameLog, playoffGameLog, availableSeasonsFormatted]);

  // Get the most recent season if no season is selected
  const currentSeason = useMemo(() => {
    if (selectedSeason === "current" || !selectedSeason) {
      return availableSeasons[0]?.value || null;
    }
    return selectedSeason;
  }, [selectedSeason, availableSeasons]);

  // Filter game logs by selected season
  const filteredGameLog = useMemo(() => {
    if (!currentSeason) return gameLog;

    // Convert currentSeason to string for comparison
    const currentSeasonStr = String(currentSeason);

    return gameLog.filter((game) => {
      if (!game.date) return false;
      const gameDate = new Date(game.date);
      const year = gameDate.getFullYear();
      const seasonStart = gameDate.getMonth() >= 9 ? year : year - 1;
      const gameSeason = `${seasonStart}${seasonStart + 1}`;
      return gameSeason === currentSeasonStr;
    });
  }, [gameLog, currentSeason]);

  const filteredPlayoffGameLog = useMemo(() => {
    if (!currentSeason) return playoffGameLog;

    // Convert currentSeason to string for comparison
    const currentSeasonStr = String(currentSeason);

    return playoffGameLog.filter((game) => {
      if (!game.date) return false;
      const gameDate = new Date(game.date);
      const year = gameDate.getFullYear();
      const seasonStart = gameDate.getMonth() >= 9 ? year : year - 1;
      const gameSeason = `${seasonStart}${seasonStart + 1}`;
      return gameSeason === currentSeasonStr;
    });
  }, [playoffGameLog, currentSeason]);

  // Filter missed games by selected season
  const filteredMissedGamesForSeason = useMemo(() => {
    if (!currentSeason) return missedGames;

    // Convert currentSeason to string for comparison
    const currentSeasonStr = String(currentSeason);

    return missedGames.filter((game) => {
      if (!game.date) return false;
      const gameDate = new Date(game.date);
      const year = gameDate.getFullYear();
      const seasonStart = gameDate.getMonth() >= 9 ? year : year - 1;
      const gameSeason = `${seasonStart}${seasonStart + 1}`;
      return gameSeason === currentSeasonStr;
    });
  }, [missedGames, currentSeason]);

  // DEBUG: Enhanced logging
  console.log("[PlayerPerformanceHeatmap] Enhanced Debug data:", {
    selectedSeason: currentSeason,
    availableSeasons: availableSeasons.map((s) => s.label),
    regularSeasonGames: filteredGameLog.length,
    playoffGames: filteredPlayoffGameLog.length,
    missedGamesFromProps: filteredMissedGamesForSeason.length,
    playerId,
    playerTeamId,
    seasonId,
    firstRegularGame: filteredGameLog[0],
    firstPlayoffGame: filteredPlayoffGameLog[0]
  });

  // Use server-side missed games data instead of client-side hook
  // Still keep the hook for backward compatibility but prioritize props
  const {
    missedGames: hookMissedGames,
    isLoading: missedGamesLoading,
    error: missedGamesError
  } = useMissedGames(
    playerId,
    playerTeamId,
    seasonId,
    filteredGameLog,
    filteredPlayoffGameLog
  );

  // Get all games data (both missed and future) from either props or hook
  const allMissedGamesData =
    filteredMissedGamesForSeason.length > 0
      ? filteredMissedGamesForSeason
      : hookMissedGames;

  // Separate past missed games from future scheduled games
  const filteredMissedGames = allMissedGamesData.filter((game) => {
    const gameDate = startOfDay(new Date(game.date));
    return !isAfter(gameDate, today) && !game.isFuture;
  });

  const futureScheduledGames = allMissedGamesData.filter((game) => {
    const gameDate = startOfDay(new Date(game.date));
    return isAfter(gameDate, today) || game.isFuture;
  });

  // Create calendar data combining regular season, playoff games, missed games, and future games
  const calendarData = useMemo(() => {
    if (filteredGameLog.length === 0 && filteredPlayoffGameLog.length === 0) {
      console.log(
        "[PlayerPerformanceHeatmap] No game data available for selected season"
      );
      return [];
    }

    // Combine all games and mark playoff games properly
    const allGames = [
      ...filteredGameLog.map((game) => ({ ...game, isPlayoff: false })), // Mark regular season games
      ...filteredPlayoffGameLog.map((game) => ({ ...game, isPlayoff: true })) // Mark playoff games
    ];

    console.log("[PlayerPerformanceHeatmap] Combined games for season:", {
      season: currentSeason,
      totalGames: allGames.length,
      regularSeason: filteredGameLog.length,
      playoffs: filteredPlayoffGameLog.length,
      futureScheduledCount: futureScheduledGames.length
    });

    // Create efficient maps for O(1) lookups
    const gamesByDate = new Map<string, GameLogEntry>();
    const missedGamesByDate = new Map<string, any>();
    const futureGamesByDate = new Map<string, any>();

    allGames.forEach((game) => {
      const dateKey = format(new Date(game.date), "yyyy-MM-dd");
      gamesByDate.set(dateKey, game);
    });

    // Only include missed games that are not in the future
    filteredMissedGames.forEach((missedGame) => {
      const dateKey = format(new Date(missedGame.date), "yyyy-MM-dd");
      missedGamesByDate.set(dateKey, missedGame);
      console.log(
        `[PlayerPerformanceHeatmap] Added missed game: ${dateKey} (${missedGame.isPlayoff ? "playoff" : "regular"})`
      );
    });

    // Add future scheduled games from the hook data (not the unused futureGames prop)
    futureScheduledGames.forEach((futureGame) => {
      const dateKey = format(new Date(futureGame.date), "yyyy-MM-dd");
      futureGamesByDate.set(dateKey, futureGame);
      console.log(
        `[PlayerPerformanceHeatmap] Added future game: ${dateKey} (${futureGame.isPlayoff ? "playoff" : "regular"})`
      );
    });

    console.log("[PlayerPerformanceHeatmap] Maps created:", {
      games: gamesByDate.size,
      missedGames: missedGamesByDate.size,
      futureGames: futureGamesByDate.size
    });

    // Optimized date range calculation
    const dates = allGames.map((game) => new Date(game.date));
    if (dates.length === 0) return [];

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    console.log("[PlayerPerformanceHeatmap] Date range:", {
      minDate: format(minDate, "yyyy-MM-dd"),
      maxDate: format(maxDate, "yyyy-MM-dd")
    });

    // Hockey season boundaries (October to June)
    const seasonStartYear =
      minDate.getMonth() >= 6
        ? minDate.getFullYear()
        : minDate.getFullYear() - 1;
    const startDate = new Date(seasonStartYear, 9, 1); // October 1st

    const seasonEndYear =
      maxDate.getMonth() >= 6
        ? maxDate.getFullYear() + 1
        : maxDate.getFullYear();
    let endDate = new Date(seasonEndYear, 5, 30); // June 30th

    // Don't extend too far past actual data
    const oneMonthAfterLastGame = new Date(
      maxDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    if (endDate > oneMonthAfterLastGame) {
      endDate = oneMonthAfterLastGame;
    }

    console.log("[PlayerPerformanceHeatmap] Season boundaries:", {
      seasonStart: format(startDate, "yyyy-MM-dd"),
      seasonEnd: format(endDate, "yyyy-MM-dd")
    });

    // Generate calendar months efficiently
    const months = [];
    let currentMonth = startOfMonth(startDate);
    const lastMonth = endOfMonth(endDate);

    while (currentMonth <= lastMonth) {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      // Create calendar grid starting from the actual first day of the month
      const calendarDays = eachDayOfInterval({
        start: monthStart,
        end: monthEnd
      });

      // Calculate the starting day of the week for this month (0 = Sunday, 6 = Saturday)
      const startDayOfWeek = monthStart.getDay();

      const days = calendarDays.map((day, index) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const game = gamesByDate.get(dateKey) || null;
        const missedGame = missedGamesByDate.get(dateKey) || null;
        const futureGame = futureGamesByDate.get(dateKey) || null;
        const performanceLevel = game
          ? calculatePerformanceLevel(game, selectedStats)
          : "no-data";

        // Properly detect playoff games - use the isPlayoff property we set above
        const isPlayoff = game
          ? Boolean(game.isPlayoff)
          : missedGame
            ? Boolean(missedGame.isPlayoff)
            : futureGame
              ? Boolean(futureGame.isPlayoff)
              : false;

        const dayData = {
          date: day,
          game,
          missedGame,
          futureGame,
          performanceLevel,
          isPlayoff,
          isMissedGame: Boolean(missedGame),
          isFutureGame: Boolean(futureGame),
          isCurrentMonth: true,
          gridPosition: index === 0 ? startDayOfWeek + 1 : undefined // CSS grid position for first day
        };

        return dayData;
      });

      months.push({ date: currentMonth, days });
      currentMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      );
    }

    console.log(
      "[PlayerPerformanceHeatmap] Generated calendar months:",
      months.length
    );
    console.log(
      "[PlayerPerformanceHeatmap] Days with missed games:",
      months.reduce(
        (total, month) =>
          total + month.days.filter((day) => day.isMissedGame).length,
        0
      )
    );

    return months;
  }, [
    filteredGameLog,
    filteredPlayoffGameLog,
    selectedStats,
    filteredMissedGames,
    futureScheduledGames,
    currentSeason
  ]);

  // Calculate calendar stats
  const calendarStats = useMemo(() => {
    // Include BOTH regular season and playoff games in stats calculation
    const allGamesWithData = [
      ...filteredGameLog.filter(
        (game) => game.games_played !== null && game.games_played > 0
      ),
      ...filteredPlayoffGameLog.filter(
        (game) => game.games_played !== null && game.games_played > 0
      )
    ];

    if (allGamesWithData.length === 0) return null;

    const performanceLevels = allGamesWithData.map((game) =>
      calculatePerformanceLevel(game, selectedStats)
    );
    const levelCounts = performanceLevels.reduce(
      (acc, level) => {
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      },
      {} as Record<PerformanceLevel, number>
    );

    const eliteGames = (levelCounts.elite || 0) + (levelCounts.excellent || 0);
    const goodOrBetterGames = eliteGames + (levelCounts.good || 0);
    const totalGames = allGamesWithData.length;
    const regularSeasonGames = filteredGameLog.filter(
      (game) => game.games_played !== null && game.games_played > 0
    ).length;
    const playoffGames = filteredPlayoffGameLog.filter(
      (game) => game.games_played !== null && game.games_played > 0
    ).length;

    return {
      totalGames,
      regularSeasonGames,
      playoffGames,
      eliteGames,
      goodOrBetterGames,
      elitePercentage: totalGames > 0 ? (eliteGames / totalGames) * 100 : 0,
      goodOrBetterPercentage:
        totalGames > 0 ? (goodOrBetterGames / totalGames) * 100 : 0,
      levelCounts
    };
  }, [filteredGameLog, filteredPlayoffGameLog, selectedStats]);

  // Event handlers
  const handleMouseEnter = (
    game: GameLogEntry | null,
    missedGame: any | null,
    futureGame: any | null,
    event: React.MouseEvent
  ) => {
    if (game) {
      setHoveredGame(game);
      setHoveredMissedGame(null);
      setHoveredFutureGame(null);
    } else if (missedGame) {
      setHoveredMissedGame(missedGame);
      setHoveredGame(null);
      setHoveredFutureGame(null);
    } else if (futureGame) {
      setHoveredFutureGame(futureGame);
      setHoveredGame(null);
      setHoveredMissedGame(null);
    }
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredGame(null);
    setHoveredMissedGame(null);
    setHoveredFutureGame(null);
  };

  // Enhanced tooltip renderers using shared constants
  const renderInfoTooltip = () => (
    <div className={styles.infoTooltip}>
      <h4>Performance Calendar Explanation</h4>
      <p>
        This calendar shows daily performance levels based on a comprehensive
        scoring system that analyzes the selected statistics from each game.
      </p>

      <h5>Performance Levels:</h5>
      <ul>
        <li>
          <strong>Elite:</strong> 90th+ percentile performance
        </li>
        <li>
          <strong>Excellent:</strong> 75-89th percentile
        </li>
        <li>
          <strong>Good:</strong> 60-74th percentile
        </li>
        <li>
          <strong>Average:</strong> 40-59th percentile
        </li>
        <li>
          <strong>Below Average:</strong> 25-39th percentile
        </li>
        <li>
          <strong>Poor:</strong> 10-24th percentile
        </li>
        <li>
          <strong>Very Poor:</strong> 0-9th percentile
        </li>
      </ul>

      <h5>Scoring System:</h5>
      <p>
        Each game is scored using weighted percentile analysis across selected
        statistics, with higher weights for more impactful metrics like points,
        goals, and advanced possession stats.
      </p>

      <em>
        Performance is calculated relative to NHL averages and position-specific
        expectations.
      </em>
    </div>
  );

  const renderGameTooltip = (game: GameLogEntry) => {
    const performanceLevel = calculatePerformanceLevel(game, selectedStats);
    const performanceLevelLabel = getPerformanceLevelLabel(performanceLevel);

    return (
      <div
        className={styles.gameTooltip}
        style={{
          position: "fixed",
          left: tooltipPosition.x + 10,
          top: tooltipPosition.y - 10,
          zIndex: 1000
        }}
      >
        <div className={styles.tooltipHeader}>
          <strong>{format(new Date(game.date), "MMM d, yyyy")}</strong>
          {game.isPlayoff && (
            <span className={styles.playoffLabel}>PLAYOFF GAME</span>
          )}
          <span className={styles.performanceLevel}>
            {performanceLevelLabel}
          </span>
        </div>

        <div className={styles.tooltipStats}>
          {selectedStats.slice(0, 6).map((stat) => {
            const value = game[stat];
            if (value === null || value === undefined) return null;

            return (
              <div key={stat} className={styles.tooltipStat}>
                <div className={styles.statHeader}>
                  <span className={styles.statName}>
                    {STAT_DISPLAY_NAMES[stat] || stat}
                  </span>
                  <span className={styles.statValue}>
                    {formatStatValue(value, stat)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.tooltipFooter}>
          <em>Performance based on weighted multi-stat analysis</em>
        </div>
      </div>
    );
  };

  const renderMissedGameTooltip = (missedGame: any) => {
    return (
      <div
        className={styles.gameTooltip}
        style={{
          position: "fixed",
          left: tooltipPosition.x + 10,
          top: tooltipPosition.y - 10,
          zIndex: 1000
        }}
      >
        <div className={styles.tooltipHeader}>
          <strong>{format(new Date(missedGame.date), "MMM d, yyyy")}</strong>
          <span className={styles.missedGameLabel}>
            Missed Game{" "}
            {missedGame.isPlayoff ? "(Playoff)" : "(Regular Season)"}
          </span>
        </div>

        <div className={styles.tooltipStats}>
          <div className={styles.tooltipStat}>
            <span className={styles.statLabel}>Status:</span>
            <span className={styles.statValue}>Did not play</span>
          </div>
          <div className={styles.tooltipStat}>
            <span className={styles.statLabel}>Game ID:</span>
            <span className={styles.statValue}>{missedGame.gameId}</span>
          </div>
        </div>

        <div className={styles.tooltipFooter}>
          <em>Player was inactive - possible injury or healthy scratch</em>
        </div>
      </div>
    );
  };

  const renderFutureGameTooltip = (futureGame: any) => {
    return (
      <div
        className={styles.gameTooltip}
        style={{
          position: "fixed",
          left: tooltipPosition.x + 10,
          top: tooltipPosition.y - 10,
          zIndex: 1000
        }}
      >
        <div className={styles.tooltipHeader}>
          <strong>{format(new Date(futureGame.date), "MMM d, yyyy")}</strong>
          {futureGame.isPlayoff && (
            <span className={styles.playoffLabel}>PLAYOFF GAME</span>
          )}
          <span className={styles.performanceLevel}>Scheduled Game</span>
        </div>

        <div className={styles.tooltipStats}>
          <div className={styles.tooltipStat}>
            <span className={styles.statLabel}>Status:</span>
            <span className={styles.statValue}>Upcoming</span>
          </div>
          {futureGame.opponent && (
            <div className={styles.tooltipStat}>
              <span className={styles.statLabel}>Opponent:</span>
              <span className={styles.statValue}>{futureGame.opponent}</span>
            </div>
          )}
        </div>

        <div className={styles.tooltipFooter}>
          <em>Future scheduled game</em>
        </div>
      </div>
    );
  };

  const legendItems = [
    { level: "elite", label: "Elite", color: getPerformanceColor("elite") },
    {
      level: "excellent",
      label: "Excellent",
      color: getPerformanceColor("excellent")
    },
    { level: "good", label: "Good", color: getPerformanceColor("good") },
    {
      level: "average",
      label: "Average",
      color: getPerformanceColor("average")
    },
    {
      level: "below-average",
      label: "Below Avg",
      color: getPerformanceColor("below-average")
    },
    { level: "poor", label: "Poor", color: getPerformanceColor("poor") },
    {
      level: "very-poor",
      label: "Very Poor",
      color: getPerformanceColor("very-poor")
    },
    {
      level: "no-data",
      label: "No Game",
      color: getPerformanceColor("no-data")
    }
  ];

  // Handle season selection change
  const handleSeasonChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSeason(event.target.value);
  };

  if (filteredGameLog.length === 0 && filteredPlayoffGameLog.length === 0) {
    return (
      <div className={styles.performanceCalendar}>
        <div className={styles.calendarHeader}>
          <div className={styles.titleWithControls}>
            <h3>Performance Calendar</h3>
            {availableSeasons.length > 1 && (
              <div className={styles.seasonSelector}>
                <label htmlFor="season-select">Season:</label>
                <select
                  id="season-select"
                  value={selectedSeason}
                  onChange={handleSeasonChange}
                  className={styles.seasonDropdown}
                >
                  {availableSeasons.map((season) => (
                    <option key={season.value} value={season.value}>
                      {season.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className={styles.noData}>
          No games available for the{" "}
          {availableSeasons.find((s) => s.value === currentSeason)
            ?.displayName || "selected season"}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.performanceCalendar}>
      <div className={styles.calendarHeader}>
        <div className={styles.titleWithControls}>
          <div className={styles.titleWithInfo}>
            <h3>Performance Calendar</h3>
            <button
              className={styles.infoButton}
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
            >
              ?
            </button>
            {showInfo && renderInfoTooltip()}
          </div>

          {availableSeasons.length > 1 && (
            <div className={styles.seasonSelector}>
              <label htmlFor="season-select">Season:</label>
              <select
                id="season-select"
                value={selectedSeason}
                onChange={handleSeasonChange}
                className={styles.seasonDropdown}
              >
                {availableSeasons.map((season) => (
                  <option key={season.value} value={season.value}>
                    {season.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* GitHub-style Contribution Graph */}
        <div className={styles.contributionGraph}>
          <div className={styles.contributionHeader}>
            <h4>
              Season Activity Overview
              <span className={styles.contributionSubtitle}>
                {availableSeasons.find((s) => s.value === currentSeason)
                  ?.displayName || "Current Season"}{" "}
              </span>
            </h4>
          </div>

          <ContributionGraph
            gameLog={filteredGameLog}
            playoffGameLog={filteredPlayoffGameLog}
            missedGames={filteredMissedGames}
            futureGames={futureScheduledGames}
            selectedStats={selectedStats}
            onDayHover={handleMouseEnter}
            onDayLeave={handleMouseLeave}
          />

          <div className={styles.contributionLegend}>
            <div className={styles.legendSection}>
              <span className={styles.legendLabel}>Less</span>
              <div className={styles.legendScale}>
                <div
                  className={styles.scaleItem}
                  style={{ backgroundColor: "#2a2a2a" }}
                />
                <div
                  className={styles.scaleItem}
                  style={{ backgroundColor: "#ff8c42" }}
                />
                <div
                  className={styles.scaleItem}
                  style={{ backgroundColor: "#ffd700" }}
                />
                <div
                  className={styles.scaleItem}
                  style={{ backgroundColor: "#85c985" }}
                />
                <div
                  className={styles.scaleItem}
                  style={{ backgroundColor: "#4fb84f" }}
                />
                <div
                  className={styles.scaleItem}
                  style={{ backgroundColor: "#2d8f2d" }}
                />
                <div
                  className={styles.scaleItem}
                  style={{ backgroundColor: "#1a5d1a" }}
                />
              </div>
              <span className={styles.legendLabel}>More</span>
            </div>

            <div className={styles.legendSpecial}>
              <div className={styles.specialItem}>
                <div
                  className={`${styles.specialIndicator} ${styles.missed}`}
                />
                <span>Missed</span>
              </div>
              <div className={styles.specialItem}>
                <div
                  className={`${styles.specialIndicator} ${styles.future}`}
                />
                <span>Upcoming</span>
              </div>
              <div className={styles.specialItem}>
                <div
                  className={`${styles.specialIndicator} ${styles.playoff}`}
                />
                <span>Playoff</span>
              </div>
            </div>
          </div>

          {calendarStats && (
            <div className={styles.contributionStats}>
              <div className={styles.statGroup}>
                <div className={styles.statValue}>
                  {calendarStats.totalGames}
                </div>
                <div className={styles.statLabel}>Games Played</div>
              </div>
              <div className={styles.statGroup}>
                <div className={styles.statValue}>
                  {calendarStats.eliteGames}
                </div>
                <div className={styles.statLabel}>Elite Performances</div>
              </div>
              <div className={styles.statGroup}>
                <div className={styles.statValue}>
                  {calendarStats.elitePercentage.toFixed(1)}%
                </div>
                <div className={styles.statLabel}>Elite Rate</div>
              </div>
              <div className={styles.statGroup}>
                <div className={styles.statValue}>
                  {filteredMissedGames.length}
                </div>
                <div className={styles.statLabel}>Missed Games</div>
              </div>
              <div className={styles.statGroup}>
                <div className={styles.statValue}>
                  {futureScheduledGames.length}
                </div>
                <div className={styles.statLabel}>Upcoming Games</div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.calendarLegend}>
          <span className={styles.legendLabel}>Performance Level:</span>
          <div className={styles.legendItems}>
            {legendItems.map((item) => (
              <div key={item.level} className={styles.legendItem}>
                <div
                  className={styles.legendColor}
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </div>
            ))}
            <div className={styles.legendItem}>
              <img
                src="/pictures/injured.png"
                alt="Missed Game"
                className={styles.injuredIcon}
                style={{ width: 12, height: 12 }}
              />
              <span>Missed Game</span>
            </div>
            <div className={styles.legendItem}>
              <div
                className={styles.legendColor}
                style={{
                  backgroundColor: "transparent",
                  border: "2px solid #14a2d2",
                  width: 12,
                  height: 12
                }}
              />
              <span>Future Game</span>
            </div>
            <div className={styles.legendItem}>
              <div
                className={styles.legendColor}
                style={{
                  backgroundColor: "#4fb84f",
                  border: "2px solid #eab308",
                  width: 12,
                  height: 12
                }}
              />
              <span>Playoff Game</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.calendarGrid}>
        {calendarData.map((month) => (
          <div key={month.date.toISOString()} className={styles.calendarMonth}>
            <div className={styles.monthHeader}>
              {format(month.date, "MMM yyyy")}
            </div>
            <div className={styles.daysGrid}>
              <div className={styles.dayLabels}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div key={day} className={styles.dayLabel}>
                      {day}
                    </div>
                  )
                )}
              </div>
              <div className={styles.daysContainer}>
                {month.days.map((day) => {
                  const dayClasses = [
                    styles.dayCell,
                    !day.isCurrentMonth && styles.otherMonth,
                    day.isMissedGame && styles.missedGameDay,
                    day.isFutureGame && styles.futureGameDay,
                    day.isPlayoff &&
                      (day.game || day.missedGame || day.futureGame) &&
                      styles.playoffGame
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <div
                      key={day.date.toISOString()}
                      className={dayClasses}
                      style={{
                        backgroundColor: day.isMissedGame
                          ? "rgba(239, 68, 68, 0.15)"
                          : day.isFutureGame
                            ? "transparent"
                            : day.game && day.isCurrentMonth
                              ? getPerformanceColor(day.performanceLevel)
                              : "transparent",
                        opacity: day.isCurrentMonth ? 1 : 0.3,
                        gridColumnStart: day.gridPosition,
                        border: day.isMissedGame
                          ? "2px solid #ef4444"
                          : day.isFutureGame
                            ? "2px solid #14a2d2" // Using the actual primary color value
                            : day.isPlayoff && (day.game || day.missedGame)
                              ? "2px solid #eab308"
                              : "1px solid #505050" // Using border-secondary color value
                      }}
                      onMouseEnter={(e) =>
                        handleMouseEnter(
                          day.game,
                          day.missedGame,
                          day.futureGame,
                          e
                        )
                      }
                      onMouseLeave={handleMouseLeave}
                    >
                      <span className={styles.dayNumber}>
                        {day.date.getDate()}
                      </span>
                      {day.isMissedGame && day.isCurrentMonth && (
                        <div className={styles.missedGameIndicator}>
                          <img
                            src="/pictures/injured.png"
                            alt="Missed Game"
                            className={styles.injuredIcon}
                            style={{ width: 12, height: 12 }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hoveredGame && renderGameTooltip(hoveredGame)}
      {hoveredMissedGame && renderMissedGameTooltip(hoveredMissedGame)}
      {hoveredFutureGame && renderFutureGameTooltip(hoveredFutureGame)}

      {calendarStats && (
        <div className={styles.calendarFooter}>
          <div className={styles.calendarStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total Games</span>
              <span className={styles.statValue}>
                {calendarStats.totalGames}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Regular Season</span>
              <span className={styles.statValue}>
                {calendarStats.regularSeasonGames}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Playoff Games</span>
              <span className={styles.statValue}>
                {calendarStats.playoffGames}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Elite+ Games</span>
              <span className={styles.statValue}>
                {calendarStats.eliteGames}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Elite+ Rate</span>
              <span className={styles.statValue}>
                {calendarStats.elitePercentage.toFixed(1)}%
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Good+ Rate</span>
              <span className={styles.statValue}>
                {calendarStats.goodOrBetterPercentage.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className={styles.calendarNote}>
            <p>
              Performance levels are calculated based on weighted analysis of
              selected statistics. Colors represent relative performance
              compared to NHL averages using shared formatting standards. Yellow
              borders indicate playoff games.
            </p>
          </div>
        </div>
      )}

      {missedGamesError && (
        <div className={styles.errorMessage}>
          Error loading missed games: {missedGamesError}
        </div>
      )}
    </div>
  );
}
