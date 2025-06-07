import React, { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek
} from "date-fns";
import styles from "./PlayerStats.module.scss";
import { useMissedGames } from "hooks/useMissedGames";
import {
  PlayerPerformanceHeatmapProps,
  GameLogEntry,
  formatStatValue,
  STAT_DISPLAY_NAMES
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

export function PlayerPerformanceHeatmap({
  gameLog,
  playoffGameLog = [],
  selectedStats,
  playerId,
  playerTeamId,
  seasonId
}: PlayerPerformanceHeatmapProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [hoveredGame, setHoveredGame] = useState<GameLogEntry | null>(null);
  const [hoveredMissedGame, setHoveredMissedGame] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Fetch missed games using the existing hook
  const {
    missedGames,
    isLoading: missedGamesLoading,
    error: missedGamesError
  } = useMissedGames(playerId, playerTeamId, seasonId, gameLog, playoffGameLog);

  // Create calendar data combining regular season, playoff games, and missed games
  const calendarData = useMemo(() => {
    if (gameLog.length === 0 && playoffGameLog.length === 0) return [];

    // Combine all games and mark playoff games properly
    const allGames = [
      ...gameLog.map((game) => ({ ...game, isPlayoff: false })), // Mark regular season games
      ...playoffGameLog.map((game) => ({ ...game, isPlayoff: true })) // Mark playoff games
    ];

    // Create efficient maps for O(1) lookups
    const gamesByDate = new Map<string, GameLogEntry>();
    const missedGamesByDate = new Map<string, any>();

    allGames.forEach((game) => {
      const dateKey = format(new Date(game.date), "yyyy-MM-dd");
      gamesByDate.set(dateKey, game);
    });

    missedGames.forEach((missedGame) => {
      const dateKey = format(new Date(missedGame.date), "yyyy-MM-dd");
      missedGamesByDate.set(dateKey, missedGame);
    });

    // Optimized date range calculation
    const dates = allGames.map((game) => new Date(game.date));
    if (dates.length === 0) return [];

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

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
        const performanceLevel = game
          ? calculatePerformanceLevel(game, selectedStats)
          : "no-data";

        // Properly detect playoff games - use the isPlayoff property we set above
        const isPlayoff = game
          ? Boolean(game.isPlayoff)
          : missedGame
            ? Boolean(missedGame.isPlayoff)
            : false;

        return {
          date: day,
          game,
          missedGame,
          performanceLevel,
          isPlayoff,
          isMissedGame: Boolean(missedGame),
          isCurrentMonth: true,
          gridPosition: index === 0 ? startDayOfWeek + 1 : undefined // CSS grid position for first day
        };
      });

      months.push({ date: currentMonth, days });
      currentMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      );
    }

    return months;
  }, [gameLog, playoffGameLog, selectedStats, missedGames]);

  // Calculate calendar stats
  const calendarStats = useMemo(() => {
    const gamesWithData = gameLog.filter(
      (game) => game.games_played !== null && game.games_played > 0
    );
    if (gamesWithData.length === 0) return null;

    const performanceLevels = gamesWithData.map((game) =>
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
    const totalGames = gamesWithData.length;

    return {
      totalGames,
      eliteGames,
      goodOrBetterGames,
      elitePercentage: totalGames > 0 ? (eliteGames / totalGames) * 100 : 0,
      goodOrBetterPercentage:
        totalGames > 0 ? (goodOrBetterGames / totalGames) * 100 : 0,
      levelCounts
    };
  }, [gameLog, selectedStats]);

  // Event handlers
  const handleMouseEnter = (
    game: GameLogEntry | null,
    missedGame: any | null,
    event: React.MouseEvent
  ) => {
    if (game) {
      setHoveredGame(game);
      setHoveredMissedGame(null);
    } else if (missedGame) {
      setHoveredMissedGame(missedGame);
      setHoveredGame(null);
    }
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredGame(null);
    setHoveredMissedGame(null);
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

  if (gameLog.length === 0) {
    return (
      <div className={styles.performanceCalendar}>
        <div className={styles.noData}>
          No games available for performance calendar
        </div>
      </div>
    );
  }

  return (
    <div className={styles.performanceCalendar}>
      <div className={styles.calendarHeader}>
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
                  return (
                    <div
                      key={day.date.toISOString()}
                      className={`${styles.dayCell} ${!day.isCurrentMonth ? styles.otherMonth : ""} ${day.isMissedGame ? styles.missedGameDay : ""} ${day.isPlayoff && (day.game || day.missedGame) ? styles.playoffGame : ""}`}
                      style={{
                        backgroundColor: day.isMissedGame
                          ? "#333"
                          : day.game && day.isCurrentMonth
                            ? getPerformanceColor(day.performanceLevel)
                            : "transparent",
                        opacity: day.isCurrentMonth ? 1 : 0.3, // Dim padding days
                        gridColumnStart: day.gridPosition // Position first day in correct column
                      }}
                      onMouseEnter={(e) =>
                        handleMouseEnter(day.game, day.missedGame, e)
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
              compared to NHL averages using shared formatting standards.
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
