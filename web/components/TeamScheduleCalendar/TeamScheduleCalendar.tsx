import React, { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfDay,
  isAfter,
  isSameMonth,
  parseISO
} from "date-fns";
import styles from "./TeamScheduleCalendar.module.scss";
import { ScheduleGame, TeamRecord } from "hooks/useTeamSchedule";
import {
  useTeamStatsFromDb,
  useTeamGameStats,
  TeamStatsRecord,
  TeamGameStats
} from "hooks/useTeamStatsFromDb";

interface TeamScheduleCalendarProps {
  games: ScheduleGame[];
  teamId: number | string;
  teamAbbreviation: string;
  seasonId: string;
  loading?: boolean;
  error?: string | null;
  record?: TeamRecord | null;
}

// TO DO: Calendar similar to the PlayerPerformanceHeatmap, but for team schedule and results.
// Sidebar with team stats, current streak, and game results, rich with statistics and details.
// highlighting for win streaks and losing streaks
// line chart for xGF/xGA differential
// color coding for opponent strength // SOS strength of schedule
// color coding for game results (win/loss/OT loss/future)

type GameResult = "win" | "loss" | "otLoss" | "future" | null;

export function TeamScheduleCalendar({
  games,
  teamId,
  teamAbbreviation,
  seasonId,
  loading = false,
  error = null,
  record
}: TeamScheduleCalendarProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [hoveredGame, setHoveredGame] = useState<ScheduleGame | null>(null);
  const [selectedGame, setSelectedGame] = useState<ScheduleGame | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Use Supabase data for accurate team stats
  const {
    teamStats,
    record: dbRecord,
    loading: statsLoading
  } = useTeamStatsFromDb(teamId, seasonId);
  const { gameStats, loading: gameStatsLoading } = useTeamGameStats(
    selectedGame?.id || null
  );

  const today = startOfDay(new Date());

  // Use database record if available, fallback to NHL API record
  const finalRecord = dbRecord || record;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <h3>Loading Schedule</h3>
          <p>Fetching team schedule data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>Error Loading Schedule</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!games || games.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>No Schedule Data</h3>
          <p>No games found for this team and season.</p>
        </div>
      </div>
    );
  }

  // Enhanced team statistics using database data
  const teamStatsEnhanced = useMemo(() => {
    const playedGames = games.filter(
      (game) =>
        game.gameState === "OFF" ||
        game.gameState === "FINAL" ||
        (game.homeTeamScore !== undefined && game.awayTeamScore !== undefined)
    );
    const upcomingGames = games.filter(
      (game) => game.gameState === "FUT" || game.gameScheduleState === "OK"
    );
    const playoffGames = games.filter((game) => game.gameType === 3);

    // Get win/loss breakdown from database if available
    let winBreakdown = { regulation: 0, overtime: 0, shootout: 0 };
    if (teamStats.length > 0) {
      const latestStats = teamStats[teamStats.length - 1];
      winBreakdown = {
        regulation: latestStats.wins_in_regulation || 0,
        overtime:
          (latestStats.regulation_and_ot_wins || 0) -
          (latestStats.wins_in_regulation || 0),
        shootout: latestStats.wins_in_shootout || 0
      };
    }

    return {
      totalGames: games.length,
      gamesPlayed: playedGames.length,
      upcomingGames: upcomingGames.length,
      playoffGames: playoffGames.length,
      winBreakdown
    };
  }, [games, teamStats]);

  // Enhanced game result determination using database data
  const getGameResult = (game: ScheduleGame): GameResult => {
    if (game.gameState === "FUT" || game.gameScheduleState === "OK")
      return "future";
    if (game.homeTeamScore === undefined || game.awayTeamScore === undefined)
      return "future";

    const isHomeTeam = game.homeTeam.id.toString() === teamId.toString();
    const teamScore = isHomeTeam ? game.homeTeamScore : game.awayTeamScore;
    const opponentScore = isHomeTeam ? game.awayTeamScore : game.homeTeamScore;

    if (teamScore > opponentScore) {
      return "win";
    } else {
      // Check if it was an OT/SO loss by looking at the game periods or database
      const gameDate = format(new Date(game.gameDate), "yyyy-MM-dd");

      // Try to get result from database first for more accurate OT loss detection
      if (teamStats.length > 0) {
        const statsForDate = teamStats.find((stat) => stat.date === gameDate);

        if (statsForDate) {
          // Look at the next day's stats to see if OT losses increased
          const nextDayStats = teamStats.find((stat) => {
            const nextDate = new Date(gameDate);
            nextDate.setDate(nextDate.getDate() + 1);
            return stat.date === format(nextDate, "yyyy-MM-dd");
          });

          if (nextDayStats && nextDayStats.ot_losses > statsForDate.ot_losses) {
            return "otLoss";
          }
        }
      }

      // Fallback: check if game went to overtime/shootout based on game properties
      // This is a heuristic - NHL API sometimes includes period info
      if (
        game.periodDescriptor &&
        (game.periodDescriptor.periodType === "OT" ||
          game.periodDescriptor.periodType === "SO" ||
          game.periodDescriptor.number > 3)
      ) {
        return "otLoss";
      }

      // Additional check: if the game has overtime or shootout info in the game object
      if (game.clock && (game.clock.inIntermission || game.clock.running)) {
        // Game is still in progress or was in OT
        return "otLoss";
      }

      return "loss";
    }
  };

  // Get opponent information
  const getOpponent = (game: ScheduleGame) => {
    const isHomeTeam = game.homeTeam.id.toString() === teamId.toString();
    const opponent = isHomeTeam ? game.awayTeam : game.homeTeam;
    const homeAway = isHomeTeam ? "vs" : "@";
    return { opponent, homeAway };
  };

  // Enhanced streak calculation using database data
  const calculateStreaks = useMemo(() => {
    if (teamStats.length === 0) {
      // Fallback to NHL API data
      const recentGames = games
        .filter(
          (game) =>
            game.gameState === "OFF" ||
            game.gameState === "FINAL" ||
            (game.homeTeamScore !== undefined &&
              game.awayTeamScore !== undefined)
        )
        .sort(
          (a, b) =>
            new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()
        )
        .slice(0, 10);

      let currentStreakCount = 0;
      let currentStreakType: "win" | "loss" | null = null;

      for (const game of recentGames) {
        const result = getGameResult(game);
        if (result === null || result === "future") continue;

        const streakType = result === "win" ? "win" : "loss";

        if (currentStreakType === null) {
          currentStreakType = streakType;
          currentStreakCount = 1;
        } else if (currentStreakType === streakType) {
          currentStreakCount++;
        } else {
          break;
        }
      }

      return {
        type: currentStreakType,
        count: currentStreakCount
      };
    }

    // Use database data for more accurate streak calculation
    const sortedStats = [...teamStats].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let currentStreakCount = 0;
    let currentStreakType: "win" | "loss" | null = null;

    for (let i = 0; i < sortedStats.length - 1; i++) {
      const current = sortedStats[i];
      const previous = sortedStats[i + 1];

      const winsChange = current.wins - previous.wins;
      const lossesChange = current.losses - previous.losses;
      const otLossesChange = current.ot_losses - previous.ot_losses;

      let gameResult: "win" | "loss" | null = null;
      if (winsChange > 0) gameResult = "win";
      else if (lossesChange > 0 || otLossesChange > 0) gameResult = "loss";

      if (gameResult === null) continue;

      if (currentStreakType === null) {
        currentStreakType = gameResult;
        currentStreakCount = 1;
      } else if (currentStreakType === gameResult) {
        currentStreakCount++;
      } else {
        break;
      }
    }

    return {
      type: currentStreakType,
      count: currentStreakCount
    };
  }, [teamStats, games, teamId]);

  // Create calendar data
  const calendarData = useMemo(() => {
    if (games.length === 0) return [];

    const dates = games.map((game) => new Date(game.gameDate));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Hockey season boundaries (October to June)
    const seasonStartYear =
      minDate.getMonth() >= 6
        ? minDate.getFullYear()
        : minDate.getFullYear() - 1;
    const startDate = new Date(seasonStartYear, 9, 1);
    const seasonEndYear =
      maxDate.getMonth() >= 6
        ? maxDate.getFullYear() + 1
        : maxDate.getFullYear();
    let endDate = new Date(seasonEndYear, 5, 30);

    // Don't extend too far past actual data
    const oneMonthAfterLastGame = new Date(
      maxDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    if (endDate > oneMonthAfterLastGame) {
      endDate = oneMonthAfterLastGame;
    }

    // Create games lookup map
    const gamesByDate = new Map<string, ScheduleGame>();
    games.forEach((game) => {
      const dateKey = format(new Date(game.gameDate), "yyyy-MM-dd");
      gamesByDate.set(dateKey, game);
    });

    // Generate calendar months
    const months = [];
    let currentMonth = startOfMonth(startDate);
    const lastMonth = endOfMonth(endDate);

    while (currentMonth <= lastMonth) {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      // Get the start of the calendar week (Sunday before the first day of the month)
      const calendarStart = new Date(monthStart);
      calendarStart.setDate(calendarStart.getDate() - monthStart.getDay());

      // Get the end of the calendar week (Saturday after the last day of the month)
      const calendarEnd = new Date(monthEnd);
      calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay()));

      // Generate all days in the calendar grid (including padding days)
      const calendarDays = eachDayOfInterval({
        start: calendarStart,
        end: calendarEnd
      });

      const days = calendarDays.map((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const game = gamesByDate.get(dateKey);
        const result = game ? getGameResult(game) : null;

        return {
          date: day,
          day: day.getDate(),
          isCurrentMonth: isSameMonth(day, currentMonth),
          game,
          result,
          isToday: format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
        };
      });

      months.push({
        date: currentMonth,
        days
      });

      currentMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      );
    }

    return months;
  }, [games, teamId, today]);

  // Enhanced event handlers
  const handleGameClick = (game: ScheduleGame | null) => {
    setSelectedGame(game);
  };

  const handleMouseEnter = (
    game: ScheduleGame | null,
    event: React.MouseEvent
  ) => {
    if (!game) return;

    setHoveredGame(game);
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const handleMouseLeave = () => {
    setHoveredGame(null);
  };

  // New game stats sidebar component
  const renderGameStatsSidebar = () => {
    if (!selectedGame) return null;

    const { opponent, homeAway } = getOpponent(selectedGame);
    const result = getGameResult(selectedGame);
    const gameDate = new Date(selectedGame.gameDate);

    const teamGameStat = gameStats.find(
      (stat) => stat.teamId.toString() === teamId.toString()
    );
    const opponentGameStat = gameStats.find(
      (stat) => stat.teamId.toString() !== teamId.toString()
    );

    return (
      <div className={styles.gameStatsSidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Game Details</h3>
          <button
            className={styles.closeSidebar}
            onClick={() => setSelectedGame(null)}
            aria-label="Close game details"
          >
            ×
          </button>
        </div>

        <div className={styles.gameOverview}>
          <div className={styles.matchup}>
            <strong>
              {homeAway} {opponent.abbrev}
            </strong>
          </div>
          <div className={styles.gameDate}>
            {format(gameDate, "EEEE, MMMM d, yyyy")}
          </div>
          <div className={styles.gameTime}>{format(gameDate, "h:mm a")}</div>
          {selectedGame.gameType === 3 && (
            <div className={styles.playoffBadge}>Playoff Game</div>
          )}
        </div>

        {teamGameStat && opponentGameStat && (
          <div className={styles.gameStatsGrid}>
            <div className={styles.statsHeader}>
              <span>{teamAbbreviation}</span>
              <span>Stats</span>
              <span>{opponent.abbrev}</span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.teamStat}>{teamGameStat.score}</span>
              <span className={styles.statLabel}>Goals</span>
              <span className={styles.opponentStat}>
                {opponentGameStat.score}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.teamStat}>{teamGameStat.sog}</span>
              <span className={styles.statLabel}>Shots</span>
              <span className={styles.opponentStat}>
                {opponentGameStat.sog}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.teamStat}>
                {(teamGameStat.faceoffPctg * 100).toFixed(1)}%
              </span>
              <span className={styles.statLabel}>Faceoff %</span>
              <span className={styles.opponentStat}>
                {(opponentGameStat.faceoffPctg * 100).toFixed(1)}%
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.teamStat}>{teamGameStat.powerPlay}</span>
              <span className={styles.statLabel}>Power Play</span>
              <span className={styles.opponentStat}>
                {opponentGameStat.powerPlay}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.teamStat}>{teamGameStat.pim}</span>
              <span className={styles.statLabel}>PIM</span>
              <span className={styles.opponentStat}>
                {opponentGameStat.pim}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.teamStat}>{teamGameStat.hits}</span>
              <span className={styles.statLabel}>Hits</span>
              <span className={styles.opponentStat}>
                {opponentGameStat.hits}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.teamStat}>
                {teamGameStat.blockedShots}
              </span>
              <span className={styles.statLabel}>Blocks</span>
              <span className={styles.opponentStat}>
                {opponentGameStat.blockedShots}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.teamStat}>{teamGameStat.giveaways}</span>
              <span className={styles.statLabel}>Giveaways</span>
              <span className={styles.opponentStat}>
                {opponentGameStat.giveaways}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.teamStat}>{teamGameStat.takeaways}</span>
              <span className={styles.statLabel}>Takeaways</span>
              <span className={styles.opponentStat}>
                {opponentGameStat.takeaways}
              </span>
            </div>
          </div>
        )}

        {gameStatsLoading && (
          <div className={styles.statsLoading}>
            <div className={styles.spinner}></div>
            <p>Loading game stats...</p>
          </div>
        )}
      </div>
    );
  };

  // Render tooltip
  const renderGameTooltip = (game: ScheduleGame) => {
    const { opponent, homeAway } = getOpponent(game);
    const result = getGameResult(game);
    const gameDate = new Date(game.gameDate);
    const isCompleted =
      game.gameState === "OFF" ||
      game.gameState === "FINAL" ||
      (game.homeTeamScore !== undefined && game.awayTeamScore !== undefined);

    return (
      <div
        className={styles.gameTooltip}
        style={{
          position: "fixed",
          left: tooltipPosition.x,
          top: tooltipPosition.y,
          transform: "translate(-50%, -100%)",
          zIndex: 1000,
          pointerEvents: "none"
        }}
      >
        <div className={styles.tooltipHeader}>
          <strong>
            {homeAway} {opponent.abbrev}
          </strong>
          {game.gameType === 3 && (
            <div className={styles.playoffLabel}>Playoff</div>
          )}
        </div>

        <div className={styles.tooltipStats}>
          <div className={styles.tooltipStat}>
            <div className={styles.statHeader}>
              <span className={styles.statName}>Date</span>
              <span className={styles.statValue}>
                {format(gameDate, "EEEE, MMMM d, yyyy")}
              </span>
            </div>
          </div>

          <div className={styles.tooltipStat}>
            <div className={styles.statHeader}>
              <span className={styles.statName}>Time</span>
              <span className={styles.statValue}>
                {format(gameDate, "h:mm a")}
              </span>
            </div>
          </div>

          {isCompleted &&
            game.homeTeamScore !== undefined &&
            game.awayTeamScore !== undefined && (
              <div className={styles.tooltipStat}>
                <div className={styles.statHeader}>
                  <span className={styles.statName}>Score</span>
                  <span className={styles.statValue}>
                    {teamAbbreviation}{" "}
                    {game.homeTeam.id.toString() === teamId.toString()
                      ? game.homeTeamScore
                      : game.awayTeamScore}{" "}
                    - {opponent.abbrev}{" "}
                    {game.homeTeam.id.toString() === teamId.toString()
                      ? game.awayTeamScore
                      : game.homeTeamScore}
                  </span>
                </div>
              </div>
            )}

          {game.venue && (
            <div className={styles.tooltipStat}>
              <div className={styles.statHeader}>
                <span className={styles.statName}>Venue</span>
                <span className={styles.statValue}>{game.venue.default}</span>
              </div>
            </div>
          )}

          {game.tvBroadcasts && game.tvBroadcasts.length > 0 && (
            <div className={styles.tooltipStat}>
              <div className={styles.statHeader}>
                <span className={styles.statName}>TV</span>
                <span className={styles.statValue}>
                  {game.tvBroadcasts.map((b: any) => b.network).join(", ")}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.tooltipFooter}>
          <em>
            {result === "future"
              ? "Upcoming game"
              : result === "win"
                ? "Team won"
                : result === "loss"
                  ? "Team lost"
                  : "Game completed"}
          </em>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.calendarHeader}>
        <div className={styles.titleWithInfo}>
          <h3>Schedule & Results</h3>
          <button
            className={styles.infoButton}
            onClick={() => setShowInfo(!showInfo)}
            aria-label="Show calendar information"
          >
            ?
          </button>
          {showInfo && (
            <div className={styles.infoTooltip}>
              <h4>Team Schedule & Results Calendar</h4>
              <p>
                This calendar shows all games for the {teamAbbreviation}{" "}
                throughout the season, with color-coded results and detailed
                game information.
              </p>

              <h5>Color Legend:</h5>
              <ul>
                <li>
                  <strong>Green:</strong> Wins
                </li>
                <li>
                  <strong>Red:</strong> Losses
                </li>
                <li>
                  <strong>Orange:</strong> Overtime Losses (1 point)
                </li>
                <li>
                  <strong>Blue:</strong> Upcoming Games
                </li>
                <li>
                  <strong>Gold Border:</strong> Playoff Games
                </li>
              </ul>

              <p>
                Hover over any game date for detailed information including
                score, venue, broadcast details, and more.
              </p>

              <em>Click on games for additional details</em>
            </div>
          )}
        </div>

        <div className={styles.teamSummary}>
          <div className={styles.summaryCard}>
            <h4>Record</h4>
            <div className={styles.record}>
              {finalRecord
                ? `${finalRecord.wins}-${finalRecord.losses}-${finalRecord.otLosses}`
                : "N/A"}
            </div>
            <p className={styles.points}>
              {finalRecord ? `${finalRecord.points} points` : "No record data"}
            </p>
          </div>

          <div className={`${styles.summaryCard} ${styles.streakCard}`}>
            <h4>Current Streak</h4>
            <div
              className={`${styles.streak} ${styles[calculateStreaks.type || "neutral"]}`}
            >
              {calculateStreaks.type
                ? `${calculateStreaks.count}${calculateStreaks.type === "win" ? "W" : "L"}`
                : "N/A"}
            </div>
          </div>

          <div className={styles.summaryCard}>
            <h4>Games Played</h4>
            <div className={styles.record}>{teamStatsEnhanced.gamesPlayed}</div>
            <p className={styles.points}>
              of {teamStatsEnhanced.totalGames} total
            </p>
          </div>

          <div className={styles.summaryCard}>
            <h4>Upcoming</h4>
            <div className={styles.record}>
              {teamStatsEnhanced.upcomingGames}
            </div>
            <p className={styles.points}>games remaining</p>
          </div>

          {teamStatsEnhanced.playoffGames > 0 && (
            <div className={styles.summaryCard}>
              <h4>Playoff Games</h4>
              <div className={styles.record}>
                {teamStatsEnhanced.playoffGames}
              </div>
              <p className={styles.points}>postseason</p>
            </div>
          )}

          {finalRecord && (
            <div className={styles.summaryCard}>
              <h4>Win Breakdown</h4>
              <div className={styles.winBreakdown}>
                <div className={styles.winType}>
                  <span>Regulation:</span>
                  <span>{finalRecord.regulationWins || 0}</span>
                </div>
                <div className={styles.winType}>
                  <span>Overtime:</span>
                  <span>{finalRecord.overtimeWins || 0}</span>
                </div>
                <div className={styles.winType}>
                  <span>Shootout:</span>
                  <span>{finalRecord.shootoutWins || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.calendarLegend}>
          <span className={styles.legendLabel}>Legend:</span>
          <div className={styles.legendItems}>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.win}`}></div>
              <span>Win</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.loss}`}></div>
              <span>Loss</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.otLoss}`}></div>
              <span>OT/SO Loss</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.future}`}></div>
              <span>Upcoming</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.playoff}`}></div>
              <span>Playoff Game</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.calendarContent}>
        <div className={styles.calendarMain}>
          <div className={styles.calendarGrid}>
            {calendarData.map((month, monthIndex) => (
              <div key={monthIndex} className={styles.calendarMonth}>
                <div className={styles.monthHeader}>
                  {format(month.date, "MMMM yyyy")}
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
                    {month.days.map((day, dayIndex) => {
                      const { opponent, homeAway } = day.game
                        ? getOpponent(day.game)
                        : { opponent: null, homeAway: null };

                      return (
                        <div
                          key={dayIndex}
                          className={`
                            ${styles.dayCell}
                            ${!day.isCurrentMonth ? styles.otherMonth : ""}
                            ${day.result === "win" ? styles.winDay : ""}
                            ${day.result === "loss" ? styles.lossDay : ""}
                            ${day.result === "otLoss" ? styles.otLossDay : ""}
                            ${day.result === "future" ? styles.futureGameDay : ""}
                            ${day.game?.gameType === 3 ? styles.playoffGame : ""}
                            ${selectedGame?.id === day.game?.id ? styles.selectedGame : ""}
                          `}
                          onMouseEnter={(e) =>
                            handleMouseEnter(day.game || null, e)
                          }
                          onMouseLeave={handleMouseLeave}
                          onClick={() => handleGameClick(day.game || null)}
                        >
                          <div className={styles.dayNumber}>{day.day}</div>
                          {day.game && opponent && (
                            <div className={styles.gameInfo}>
                              <div className={styles.opponent}>
                                {homeAway} {opponent.abbrev}
                              </div>
                              {day.game.homeTeamScore !== undefined &&
                                day.game.awayTeamScore !== undefined && (
                                  <div className={styles.score}>
                                    {day.game.homeTeam.id.toString() ===
                                    teamId.toString()
                                      ? `${day.game.homeTeamScore}-${day.game.awayTeamScore}`
                                      : `${day.game.awayTeamScore}-${day.game.homeTeamScore}`}
                                  </div>
                                )}
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
        </div>

        {selectedGame && (
          <div className={styles.sidebarContainer}>
            {renderGameStatsSidebar()}
          </div>
        )}
      </div>

      {hoveredGame && renderGameTooltip(hoveredGame)}
    </div>
  );
}
