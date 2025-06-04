import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";

interface GameLogEntry {
  date: string;
  [key: string]: any;
}

interface PlayerPerformanceHeatmapProps {
  gameLog: GameLogEntry[];
  selectedStats: string[];
}

export function PlayerPerformanceHeatmap({
  gameLog,
  selectedStats
}: PlayerPerformanceHeatmapProps) {
  const calendarData = useMemo(() => {
    if (gameLog.length === 0 || selectedStats.length === 0) return null;

    // Calculate composite performance score for each game
    const gamesWithScores = gameLog.map((game) => {
      let totalScore = 0;
      let validStats = 0;

      selectedStats.forEach((stat) => {
        const value = Number(game[stat]);
        if (!isNaN(value)) {
          // Normalize different stat types to 0-100 scale
          let normalizedScore = 0;

          if (stat === "points") {
            normalizedScore = Math.min(value * 25, 100); // 4 points = 100%
          } else if (stat === "goals") {
            normalizedScore = Math.min(value * 33, 100); // 3 goals = 100%
          } else if (stat === "assists") {
            normalizedScore = Math.min(value * 25, 100); // 4 assists = 100%
          } else if (stat === "save_pct") {
            normalizedScore = Math.max(0, (value - 0.85) * 667); // .850-.950 = 0-100%
          } else if (stat === "goals_against_avg") {
            normalizedScore = Math.max(0, 100 - (value - 1.5) * 40); // 1.5-4.0 GAA = 100-0%
          } else if (stat === "shooting_percentage") {
            normalizedScore = Math.min(value * 5, 100); // 20% = 100%
          } else if (stat === "shots") {
            normalizedScore = Math.min(value * 12.5, 100); // 8 shots = 100%
          } else if (stat === "hits") {
            normalizedScore = Math.min(value * 12.5, 100); // 8 hits = 100%
          } else if (stat === "blocked_shots") {
            normalizedScore = Math.min(value * 16.7, 100); // 6 blocks = 100%
          } else if (stat === "wins" && value > 0) {
            normalizedScore = 100; // Win = 100%
          } else if (stat === "saves") {
            normalizedScore = Math.min((value - 15) * 2.86, 100); // 15-50 saves = 0-100%
          } else {
            // Default: use value directly up to 10
            normalizedScore = Math.min(value * 10, 100);
          }

          totalScore += normalizedScore;
          validStats++;
        }
      });

      const averageScore = validStats > 0 ? totalScore / validStats : 0;

      return {
        ...game,
        performanceScore: averageScore,
        date: new Date(game.date)
      };
    });

    // Create a game lookup by date string
    const gamesByDate: { [key: string]: (typeof gamesWithScores)[0] } = {};
    gamesWithScores.forEach((game) => {
      const dateKey = game.date.toISOString().split("T")[0];
      gamesByDate[dateKey] = game;
    });

    // Generate calendar months
    const allDates = gamesWithScores.map((g) => g.date);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    const months = [];
    const currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

    while (currentDate <= maxDate) {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();

      // Get first day of month and calculate starting position
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDay = firstDay.getDay(); // 0 = Sunday

      // Generate all days for this month
      const days = [];

      // Add empty cells for days before the first day of month
      for (let i = 0; i < startDay; i++) {
        days.push({ isEmpty: true, date: null, game: null });
      }

      // Add all days of the month
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayDate = new Date(year, month, day);
        const dateKey = dayDate.toISOString().split("T")[0];
        const game = gamesByDate[dateKey] || null;

        days.push({
          isEmpty: false,
          date: dayDate,
          game: game,
          dayNumber: day
        });
      }

      months.push({
        month,
        year,
        monthName: firstDay.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric"
        }),
        days
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return {
      months,
      gamesByDate,
      maxScore: Math.max(...gamesWithScores.map((g) => g.performanceScore)),
      minScore: Math.min(...gamesWithScores.map((g) => g.performanceScore)),
      totalGames: gamesWithScores.length
    };
  }, [gameLog, selectedStats]);

  const getPerformanceColor = (score: number): string => {
    if (score === 0) return "transparent";

    // Use your color variables for performance levels
    if (score >= 80) return "#10b981"; // Excellent - Success green
    if (score >= 60) return "#3b82f6"; // Good - Primary blue
    if (score >= 40) return "#f59e0b"; // Average - Warning amber
    if (score >= 20) return "#ef4444"; // Poor - Danger red
    return "#6b7280"; // Very poor - Gray
  };

  const getPerformanceIntensity = (score: number): number => {
    return Math.min(score / 100, 1);
  };

  if (!calendarData || gameLog.length === 0) {
    return (
      <div className={styles.performanceCalendar}>
        <div className={styles.calendarHeader}>
          <h3>Performance Calendar</h3>
          <div className={styles.noData}>No games available to display</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.performanceCalendar}>
      <div className={styles.calendarHeader}>
        <h3>Performance Calendar</h3>
        <div className={styles.calendarLegend}>
          <span className={styles.legendLabel}>Performance Level:</span>
          <div className={styles.legendItems}>
            {[
              { label: "Excellent", color: "#10b981", range: "80+" },
              { label: "Good", color: "#3b82f6", range: "60-79" },
              { label: "Average", color: "#f59e0b", range: "40-59" },
              { label: "Poor", color: "#ef4444", range: "20-39" },
              { label: "Very Poor", color: "#6b7280", range: "<20" }
            ].map((item) => (
              <div key={item.label} className={styles.legendItem}>
                <div
                  className={styles.legendColorSwatch}
                  style={{ backgroundColor: item.color }}
                />
                <span className={styles.legendText}>
                  {item.label} ({item.range})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.calendarGrid}>
        {calendarData.months.map((monthData, monthIndex) => (
          <div
            key={`${monthData.year}-${monthData.month}`}
            className={styles.calendarMonth}
          >
            <div className={styles.monthHeader}>
              <h4 className={styles.monthTitle}>{monthData.monthName}</h4>
            </div>

            <div className={styles.calendarTable}>
              {/* Days of week header */}
              <div className={styles.weekdaysHeader}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div key={day} className={styles.weekdayLabel}>
                      {day}
                    </div>
                  )
                )}
              </div>

              {/* Calendar days grid */}
              <div className={styles.daysGrid}>
                {monthData.days.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={`${styles.calendarDay} ${
                      day.isEmpty ? styles.emptyDay : ""
                    } ${day.game ? styles.gameDay : styles.noGameDay}`}
                    style={{
                      backgroundColor: day.game
                        ? getPerformanceColor(day.game.performanceScore)
                        : "transparent",
                      opacity: day.game
                        ? 0.3 +
                          getPerformanceIntensity(day.game.performanceScore) *
                            0.7
                        : 1
                    }}
                    title={
                      day.game
                        ? `${day.date?.toLocaleDateString()}: Performance Score ${day.game.performanceScore.toFixed(1)}`
                        : day.date
                          ? `${day.date.toLocaleDateString()}: No Game`
                          : ""
                    }
                  >
                    {!day.isEmpty && (
                      <>
                        <div className={styles.dayNumber}>{day.dayNumber}</div>
                        {day.game && (
                          <div className={styles.gameIndicator}>
                            <div className={styles.performanceScore}>
                              {Math.round(day.game.performanceScore)}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.calendarFooter}>
        <div className={styles.calendarStats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Games:</span>
            <span className={styles.statValue}>{calendarData.totalGames}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Best Performance:</span>
            <span className={styles.statValue}>
              {calendarData.maxScore.toFixed(1)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Average Performance:</span>
            <span className={styles.statValue}>
              {(
                gameLog.reduce((sum, game) => {
                  const gameData =
                    calendarData.gamesByDate[
                      new Date(game.date).toISOString().split("T")[0]
                    ];
                  return sum + (gameData?.performanceScore || 0);
                }, 0) / calendarData.totalGames
              ).toFixed(1)}
            </span>
          </div>
        </div>
        <div className={styles.calendarNote}>
          <p>
            Each date shows the player's composite performance score based on
            selected statistics. Hover over game days for detailed performance
            information.
          </p>
        </div>
      </div>
    </div>
  );
}
