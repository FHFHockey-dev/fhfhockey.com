import React, { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay
} from "date-fns";
import styles from "./PlayerStats.module.scss";
import { GameLogEntry } from "pages/stats/player/[playerId]";
import { useMissedGames } from "hooks/useMissedGames";

interface PlayerPerformanceHeatmapProps {
  gameLog: GameLogEntry[];
  playoffGameLog?: GameLogEntry[];
  selectedStats: string[];
  playerId?: string | number;
  playerTeamId?: number;
  seasonId?: string | number | null;
}

// Performance thresholds based on NHL averages (per game)
const PERFORMANCE_THRESHOLDS = {
  // Basic counting stats
  goals: { elite: 0.75, good: 0.55, average: 0.35, poor: 0.15 },
  assists: { elite: 1.2, good: 0.85, average: 0.55, poor: 0.25 },
  points: { elite: 1.9, good: 1.35, average: 0.85, poor: 0.4 },
  shots: { elite: 4.5, good: 3.2, average: 2.2, poor: 1.2 },
  hits: { elite: 3.8, good: 2.5, average: 1.5, poor: 0.8 },
  blocked_shots: { elite: 2.2, good: 1.5, average: 0.9, poor: 0.4 },
  takeaways: { elite: 1.8, good: 1.2, average: 0.7, poor: 0.3 },
  giveaways: { elite: 0.8, good: 1.2, average: 1.8, poor: 2.5 }, // Inverted - lower is better
  toi_per_game: { elite: 22, good: 18, average: 14, poor: 10 },

  // NST Advanced Stats - Possession Metrics (percentages)
  cf_pct: { elite: 55, good: 52, average: 48, poor: 45 },
  ff_pct: { elite: 55, good: 52, average: 48, poor: 45 },
  sf_pct: { elite: 55, good: 52, average: 48, poor: 45 },
  gf_pct: { elite: 60, good: 55, average: 45, poor: 40 },
  xgf_pct: { elite: 55, good: 52, average: 48, poor: 45 },
  scf_pct: { elite: 55, good: 52, average: 48, poor: 45 },
  hdcf_pct: { elite: 55, good: 52, average: 48, poor: 45 },

  // NST Advanced Stats - Individual Per 60
  ixg_per_60: { elite: 2.5, good: 2.0, average: 1.2, poor: 0.6 },
  icf_per_60: { elite: 12, good: 9, average: 6, poor: 3 },
  iff_per_60: { elite: 10, good: 8, average: 5, poor: 2.5 },
  hdcf_per_60: { elite: 6, good: 4, average: 2.5, poor: 1 },
  shots_per_60: { elite: 12, good: 9, average: 6, poor: 3 },
  goals_per_60: { elite: 2.0, good: 1.5, average: 0.8, poor: 0.3 },
  total_assists_per_60: { elite: 2.5, good: 1.8, average: 1.0, poor: 0.4 },
  total_points_per_60: { elite: 4.0, good: 3.0, average: 1.8, poor: 0.8 },
  rush_attempts_per_60: { elite: 3.0, good: 2.0, average: 1.0, poor: 0.4 },

  // NST Advanced Stats - Defensive Per 60 (lower is better for most)
  hdca_per_60: { elite: 4.0, good: 5.5, average: 7.0, poor: 9.0 }, // Inverted
  sca_per_60: { elite: 8.0, good: 10.0, average: 12.0, poor: 15.0 }, // Inverted
  shots_blocked_per_60: { elite: 4.0, good: 3.0, average: 2.0, poor: 1.0 },
  xga_per_60: { elite: 2.0, good: 2.5, average: 3.0, poor: 4.0 }, // Inverted

  // NST Advanced Stats - Zone Usage (context-dependent)
  off_zone_start_pct: { elite: 65, good: 55, average: 45, poor: 35 },
  def_zone_start_pct: { elite: 35, good: 45, average: 55, poor: 65 }, // Inverted for forwards

  // NST Advanced Stats - On-Ice Impact
  on_ice_sh_pct: { elite: 10.5, good: 9.0, average: 7.5, poor: 6.0 },
  on_ice_sv_pct: { elite: 92.5, good: 91.0, average: 89.5, poor: 88.0 },
  pdo: { elite: 102, good: 100.5, average: 99.0, poor: 97.5 },

  // NST Advanced Stats - Discipline Per 60
  pim_per_60: { elite: 0.5, good: 1.0, average: 1.8, poor: 3.0 }, // Inverted
  total_penalties_per_60: { elite: 0.3, good: 0.6, average: 1.0, poor: 1.5 }, // Inverted
  penalties_drawn_per_60: { elite: 1.5, good: 1.0, average: 0.6, poor: 0.3 },
  giveaways_per_60: { elite: 1.5, good: 2.5, average: 4.0, poor: 6.0 }, // Inverted
  takeaways_per_60: { elite: 2.0, good: 1.5, average: 1.0, poor: 0.5 },
  hits_per_60: { elite: 6.0, good: 4.0, average: 2.5, poor: 1.0 }
};

type PerformanceLevel =
  | "elite"
  | "excellent"
  | "good"
  | "average"
  | "below-average"
  | "poor"
  | "very-poor"
  | "no-data";

// Calculate performance level based on weighted stats
const calculatePerformanceLevel = (
  game: GameLogEntry,
  selectedStats: string[]
): PerformanceLevel => {
  if (!game.games_played || game.games_played === 0) return "no-data";

  const weights = {
    goals: 1.5,
    assists: 1.3,
    points: 1.8, // Highest weight for overall offensive production
    shots: 1.0,
    hits: 0.8,
    blocked_shots: 0.9,
    takeaways: 1.1,
    giveaways: 1.2, // Higher weight for turnovers (negative impact)
    toi_per_game: 1.4 // High weight for ice time
  };

  let totalScore = 0;
  let totalWeight = 0;

  selectedStats.forEach((stat) => {
    const value = game[stat];
    if (
      value === null ||
      value === undefined ||
      !PERFORMANCE_THRESHOLDS[stat as keyof typeof PERFORMANCE_THRESHOLDS]
    )
      return;

    const thresholds =
      PERFORMANCE_THRESHOLDS[stat as keyof typeof PERFORMANCE_THRESHOLDS];
    const weight = weights[stat as keyof typeof weights] || 1;
    const isInverted = stat === "giveaways";

    let score = 0;

    if (isInverted) {
      // For inverted stats (lower is better)
      if (value <= thresholds.elite) score = 100;
      else if (value <= thresholds.good)
        score =
          75 +
          (25 * (thresholds.good - value)) /
            (thresholds.good - thresholds.elite);
      else if (value <= thresholds.average)
        score =
          50 +
          (25 * (thresholds.average - value)) /
            (thresholds.average - thresholds.good);
      else if (value <= thresholds.poor)
        score =
          25 +
          (25 * (thresholds.poor - value)) /
            (thresholds.poor - thresholds.average);
      else
        score = Math.max(
          0,
          25 * (1 - (value - thresholds.poor) / thresholds.poor)
        );
    } else {
      // For normal stats (higher is better)
      if (value >= thresholds.elite) score = 100;
      else if (value >= thresholds.good)
        score =
          75 +
          (25 * (value - thresholds.good)) /
            (thresholds.elite - thresholds.good);
      else if (value >= thresholds.average)
        score =
          50 +
          (25 * (value - thresholds.average)) /
            (thresholds.good - thresholds.average);
      else if (value >= thresholds.poor)
        score =
          25 +
          (25 * (value - thresholds.poor)) /
            (thresholds.average - thresholds.poor);
      else score = Math.max(0, (25 * value) / thresholds.poor);
    }

    totalScore += score * weight;
    totalWeight += weight;
  });

  if (totalWeight === 0) return "no-data";

  const averageScore = totalScore / totalWeight;

  if (averageScore >= 85) return "elite";
  if (averageScore >= 70) return "excellent";
  if (averageScore >= 55) return "good";
  if (averageScore >= 40) return "average";
  if (averageScore >= 25) return "below-average";
  if (averageScore >= 10) return "poor";
  return "very-poor";
};

// Get color for performance level
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

// Get performance level label
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
  playoffGameLog = [], // Add default empty array
  selectedStats,
  playerId,
  playerTeamId,
  seasonId
}: PlayerPerformanceHeatmapProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [hoveredGame, setHoveredGame] = useState<GameLogEntry | null>(null);
  const [hoveredMissedGame, setHoveredMissedGame] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Fetch missed games using the new hook
  const {
    missedGames,
    isLoading: missedGamesLoading,
    error: missedGamesError
  } = useMissedGames(playerId, playerTeamId, seasonId, gameLog, playoffGameLog);

  // Create calendar data combining regular season, playoff games, and missed games
  const calendarData = useMemo(() => {
    if (gameLog.length === 0 && playoffGameLog.length === 0) return [];

    // Combine regular season and playoff games
    const allGames = [...gameLog, ...playoffGameLog];

    // Group games by date
    const gamesByDate = new Map<string, GameLogEntry>();
    allGames.forEach((game) => {
      const dateKey = format(new Date(game.date), "yyyy-MM-dd");
      gamesByDate.set(dateKey, game);
    });

    // Create missed games map by date
    const missedGamesByDate = new Map<string, any>();
    missedGames.forEach((missedGame) => {
      const dateKey = format(new Date(missedGame.date), "yyyy-MM-dd");
      missedGamesByDate.set(dateKey, missedGame);
    });

    // Get date range - ensure we cover the full hockey season including playoffs
    const dates = allGames.map((game) => new Date(game.date));
    let startDate: Date;
    let endDate: Date;

    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

      // For hockey seasons, ensure we start from October and go through June
      // to capture the full season including playoffs
      const seasonStartYear =
        minDate.getMonth() >= 6
          ? minDate.getFullYear()
          : minDate.getFullYear() - 1;
      startDate = new Date(seasonStartYear, 9, 1); // October 1st

      // Ensure we go at least through June for playoffs
      const seasonEndYear =
        maxDate.getMonth() >= 6
          ? maxDate.getFullYear() + 1
          : maxDate.getFullYear();
      endDate = new Date(seasonEndYear, 5, 30); // June 30th

      // But don't go past the actual latest game date by more than a month
      const oneMonthAfterLastGame = new Date(
        maxDate.getTime() + 30 * 24 * 60 * 60 * 1000
      );
      if (endDate > oneMonthAfterLastGame) {
        endDate = oneMonthAfterLastGame;
      }
    } else {
      // Fallback if no games
      const currentDate = new Date();
      startDate = new Date(currentDate.getFullYear(), 9, 1);
      endDate = new Date(currentDate.getFullYear() + 1, 5, 30);
    }

    // Create months array
    const months: Array<{
      date: Date;
      days: Array<{
        date: Date;
        game: GameLogEntry | null;
        missedGame: any | null;
        performanceLevel: PerformanceLevel;
        isPlayoff: boolean;
        isMissedGame: boolean;
      }>;
    }> = [];

    let currentMonth = startOfMonth(startDate);
    const lastMonth = endOfMonth(endDate);

    while (currentMonth <= lastMonth) {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

      const days = monthDays.map((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const game = gamesByDate.get(dateKey) || null;
        const missedGame = missedGamesByDate.get(dateKey) || null;
        const performanceLevel = game
          ? calculatePerformanceLevel(game, selectedStats)
          : "no-data";
        const isPlayoff = game ? Boolean(game.isPlayoff) : false;
        const isMissedGame = Boolean(missedGame);

        return {
          date: day,
          game,
          missedGame,
          performanceLevel,
          isPlayoff,
          isMissedGame
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
    const totalGames = gamesWithData.length;

    return {
      totalGames,
      eliteGames,
      elitePercentage: totalGames > 0 ? (eliteGames / totalGames) * 100 : 0,
      levelCounts
    };
  }, [gameLog, selectedStats]);

  const handleMouseEnter = (
    game: GameLogEntry | null,
    missedGame: any | null,
    event: React.MouseEvent
  ) => {
    if (game) {
      setHoveredGame(game);
      setHoveredMissedGame(null);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    } else if (missedGame) {
      setHoveredMissedGame(missedGame);
      setHoveredGame(null);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredGame(null);
    setHoveredMissedGame(null);
  };

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
        Each game is scored based on weighted performance across selected
        statistics:
      </p>

      <div className={styles.thresholdBreakdown}>
        {Object.entries(PERFORMANCE_THRESHOLDS).map(([stat, thresholds]) => (
          <div key={stat} className={styles.thresholdStat}>
            <strong>{stat.replace(/_/g, " ")}:</strong>
            <span>
              Elite: {thresholds.elite} | Good: {thresholds.good} | Average:{" "}
              {thresholds.average} | Poor: {thresholds.poor}
            </span>
          </div>
        ))}
      </div>

      <em>* Giveaways are inverted (lower values = better performance)</em>
    </div>
  );

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
          {selectedStats.map((stat) => {
            const value = game[stat];
            if (value === null || value === undefined) return null;

            const thresholds =
              PERFORMANCE_THRESHOLDS[
                stat as keyof typeof PERFORMANCE_THRESHOLDS
              ];
            if (!thresholds) return null;

            return (
              <div key={stat} className={styles.tooltipStat}>
                <div className={styles.statHeader}>
                  <span className={styles.statName}>
                    {stat.replace(/_/g, " ")}
                  </span>
                  <span className={styles.statValue}>
                    {typeof value === "number"
                      ? value.toFixed(stat === "toi_per_game" ? 1 : 0)
                      : value}
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
                  const isCurrentMonth =
                    day.date.getMonth() === month.date.getMonth();

                  return (
                    <div
                      key={day.date.toISOString()}
                      className={`${styles.dayCell} ${!isCurrentMonth ? styles.otherMonth : ""} ${day.isMissedGame ? styles.missedGameDay : ""} ${day.isPlayoff && day.game ? styles.playoffGame : ""}`}
                      style={{
                        backgroundColor: day.isMissedGame
                          ? "#333"
                          : day.game
                            ? getPerformanceColor(day.performanceLevel)
                            : "transparent"
                      }}
                      onMouseEnter={(e) =>
                        handleMouseEnter(day.game, day.missedGame, e)
                      }
                      onMouseLeave={handleMouseLeave}
                    >
                      <span className={styles.dayNumber}>
                        {day.date.getDate()}
                      </span>
                      {day.isMissedGame && (
                        <div className={styles.missedGameIndicator}>
                          <img
                            src="/pictures/injured.png"
                            alt="Missed Game"
                            className={styles.injuredIcon}
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
          </div>

          <div className={styles.calendarNote}>
            <p>
              Performance levels are calculated based on weighted analysis of
              selected statistics. Colors represent relative performance
              compared to NHL averages.
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
