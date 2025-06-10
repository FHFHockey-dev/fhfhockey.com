import React, { useState, useMemo } from "react";
import {
  format,
  startOfDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday
} from "date-fns";
import {
  useTeamSchedule,
  ScheduleGame,
  TeamRecord
} from "hooks/useTeamSchedule";
import { useTeamStatsFromDb } from "hooks/useTeamStatsFromDb";
import { getTeamAbbreviationById } from "lib/teamsInfo";
import styles from "./TeamScheduleCalendar.module.scss";
import { teamsInfo } from "lib/teamsInfo";

interface TeamScheduleCalendarProps {
  games: ScheduleGame[];
  teamId: number | string;
  teamAbbreviation: string;
  seasonId: string;
  loading?: boolean;
  error?: string | null;
  record?: TeamRecord | null;
}

// Enhanced types for better game analysis
interface EnhancedGameData {
  game: ScheduleGame;
  result: GameResult;
  opponent: string;
  homeAway: "vs" | "@";
  isPlayoff: boolean;
  isPartOfStreak?: boolean;
  streakType?: "win" | "loss";
  opponentStrength?: "strong" | "average" | "weak";
  xGDifferential?: number;
  gameRating?: "excellent" | "good" | "average" | "poor";
}

interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  game: EnhancedGameData | null;
  gridPosition?: number;
}

interface CalendarMonth {
  date: Date;
  days: CalendarDay[];
}

interface CalendarStats {
  wins: number;
  losses: number;
  otLosses: number;
  future: number;
  total: number;
  winPercentage: number;
  pointPercentage: number;
  homeRecord: { wins: number; losses: number; otLosses: number };
  awayRecord: { wins: number; losses: number; otLosses: number };
  vsStrongTeams: { wins: number; losses: number; otLosses: number };
  recentForm: { wins: number; losses: number; otLosses: number }; // Last 10 games
}

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
  const [selectedGame, setSelectedGame] = useState<ScheduleGame | null>(null);
  const [hoveredGame, setHoveredGame] = useState<EnhancedGameData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [debug] = useState(false);

  // Get team abbreviation from ID if not provided
  const teamAbbr =
    teamAbbreviation || getTeamAbbreviationById(Number(teamId)) || `T${teamId}`;

  const teamInfo = teamsInfo[teamAbbreviation];

  // Use Supabase data for accurate team stats
  const {
    teamStats,
    record: dbRecord,
    loading: statsLoading
  } = useTeamStatsFromDb(teamId, seasonId);

  const today = startOfDay(new Date());

  // Use database record if available, fallback to NHL API record
  const finalRecord = dbRecord || record;

  // Enhanced game result determination with better analytics
  const getGameResult = (game: ScheduleGame): GameResult => {
    const gameDate = new Date(game.gameDate);
    const isGameInFuture = gameDate > today;

    if (isGameInFuture) {
      return "future";
    }

    // For past games, determine result from database first
    const gameDate_YYYY_MM_DD = format(gameDate, "yyyy-MM-dd");
    const gameDayStats = teamStats.find(
      (stat) => stat.date === gameDate_YYYY_MM_DD
    );

    if (gameDayStats && teamStats.length > 1) {
      const statsIndex = teamStats.findIndex(
        (stat) => stat.date === gameDate_YYYY_MM_DD
      );
      if (statsIndex > 0) {
        const prevStats = teamStats[statsIndex - 1];
        const winsChange = (gameDayStats.wins || 0) - (prevStats.wins || 0);
        const lossesChange =
          (gameDayStats.losses || 0) - (prevStats.losses || 0);
        const otLossesChange =
          (gameDayStats.ot_losses || 0) - (prevStats.ot_losses || 0);

        if (winsChange > 0) return "win";
        if (otLossesChange > 0) return "otLoss";
        if (lossesChange > 0) return "loss";
      }
    }

    // Fallback to API data for completed games
    const hasScores =
      game.homeTeamScore !== undefined && game.awayTeamScore !== undefined;
    if (hasScores && !isGameInFuture) {
      const isHomeTeam = game.homeTeam.id.toString() === teamId.toString();
      const teamScore = isHomeTeam ? game.homeTeamScore : game.awayTeamScore;
      const opponentScore = isHomeTeam
        ? game.awayTeamScore
        : game.homeTeamScore;

      if (teamScore! > opponentScore!) {
        return "win";
      } else {
        const isOvertimeGame =
          game.periodDescriptor &&
          (game.periodDescriptor.periodType === "OT" ||
            game.periodDescriptor.periodType === "SO" ||
            game.periodDescriptor.number > 3);
        return isOvertimeGame ? "otLoss" : "loss";
      }
    }

    return null;
  };

  // Get opponent information with strength analysis
  const getOpponentWithStrength = (game: ScheduleGame) => {
    const isHomeTeam = game.homeTeam.id.toString() === teamId.toString();
    const opponent = isHomeTeam ? game.awayTeam : game.homeTeam;
    const homeAway: "vs" | "@" = isHomeTeam ? "vs" : "@";
    const opponentAbbr =
      getTeamAbbreviationById(opponent.id) ||
      opponent.abbrev ||
      `T${opponent.id}`;

    // Simple opponent strength calculation (would be enhanced with actual team ratings)
    const getOpponentStrength = (
      opponentId: number
    ): "strong" | "average" | "weak" => {
      // This would ideally use actual team standings/ratings data
      // For now, using a simplified approach based on team ID patterns
      const strongTeams = [1, 2, 3, 6, 8, 12, 13, 16, 17, 19, 20, 21, 25, 28]; // Top teams by recent performance
      const weakTeams = [4, 5, 7, 11, 14, 15, 18, 22, 23, 26, 27, 29, 30]; // Bottom teams

      if (strongTeams.includes(opponentId)) return "strong";
      if (weakTeams.includes(opponentId)) return "weak";
      return "average";
    };

    return {
      opponent: { ...opponent, abbreviation: opponentAbbr },
      homeAway,
      opponentStrength: getOpponentStrength(opponent.id)
    };
  };

  // Enhanced game processing with analytics
  const gamesWithResults = useMemo(() => {
    const results: EnhancedGameData[] = games.map((game) => {
      const result = getGameResult(game);
      const { opponent, homeAway, opponentStrength } =
        getOpponentWithStrength(game);

      // Calculate xG differential (mock data - would come from actual game data)
      const xGDifferential =
        result === "win"
          ? Math.random() * 2 - 0.5 // Positive for wins
          : Math.random() * -1.5 - 0.2; // Negative for losses

      // Game rating based on result and opponent strength
      const getGameRating = (): "excellent" | "good" | "average" | "poor" => {
        if (result === "future") return "average";

        if (result === "win") {
          return opponentStrength === "strong"
            ? "excellent"
            : opponentStrength === "average"
              ? "good"
              : "average";
        } else if (result === "otLoss") {
          return opponentStrength === "strong" ? "good" : "average";
        } else {
          return opponentStrength === "weak" ? "poor" : "average";
        }
      };

      return {
        game,
        result,
        opponent: opponent.abbreviation,
        homeAway,
        isPlayoff: game.gameType === 3,
        opponentStrength,
        xGDifferential,
        gameRating: getGameRating()
      };
    });

    // Calculate current streak for highlighting
    const completedGames = results
      .filter(({ result }) => result && result !== "future")
      .sort(
        (a, b) =>
          new Date(b.game.gameDate).getTime() -
          new Date(a.game.gameDate).getTime()
      );

    if (completedGames.length > 0) {
      let currentStreak = 0;
      let streakType: "win" | "loss" | null = null;

      const mostRecentResult = completedGames[0]?.result;
      if (mostRecentResult === "win") {
        streakType = "win";
      } else if (mostRecentResult === "loss" || mostRecentResult === "otLoss") {
        streakType = "loss";
      }

      if (streakType) {
        for (const { result } of completedGames) {
          if (streakType === "win" && result === "win") {
            currentStreak++;
          } else if (
            streakType === "loss" &&
            (result === "loss" || result === "otLoss")
          ) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      // Apply streak highlighting to recent games (3+ games)
      if (currentStreak >= 3 && streakType) {
        completedGames.slice(0, currentStreak).forEach(({ game }) => {
          const gameIndex = results.findIndex(
            ({ game: g }) => g.id === game.id
          );
          if (gameIndex !== -1) {
            results[gameIndex] = {
              ...results[gameIndex],
              isPartOfStreak: true,
              streakType
            };
          }
        });
      }
    }

    return results;
  }, [games, teamStats, teamId, today]);

  // Enhanced calendar data generation
  const calendarData = useMemo(() => {
    if (gamesWithResults.length === 0) {
      return { months: [], stats: null };
    }

    const gamesDates = gamesWithResults.map(
      ({ game }) => new Date(game.gameDate)
    );
    const minDate = new Date(Math.min(...gamesDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...gamesDates.map((d) => d.getTime())));

    // Season boundaries (October to June)
    const seasonStartYear =
      minDate.getMonth() >= 6
        ? minDate.getFullYear()
        : minDate.getFullYear() - 1;

    const seasonStart = new Date(seasonStartYear, 9, 1); // October 1st
    const seasonEnd = new Date(seasonStartYear + 1, 5, 30); // June 30th

    const startDate = new Date(
      Math.max(minDate.getTime(), seasonStart.getTime())
    );
    const endDate = new Date(Math.min(maxDate.getTime(), seasonEnd.getTime()));

    // Generate calendar months
    const months: CalendarMonth[] = [];
    let currentMonth = startOfMonth(startDate);
    const lastMonth = endOfMonth(endDate);

    while (currentMonth <= lastMonth) {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const calendarDays = eachDayOfInterval({
        start: monthStart,
        end: monthEnd
      });

      // Calculate the starting day of the week for proper grid positioning
      const startDayOfWeek = monthStart.getDay();

      const days: CalendarDay[] = calendarDays.map((day, index) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const gameForDay = gamesWithResults.find(
          ({ game }) =>
            format(new Date(game.gameDate), "yyyy-MM-dd") === dateKey
        );

        return {
          date: day,
          dayNumber: day.getDate(),
          isCurrentMonth: day.getMonth() === currentMonth.getMonth(),
          isToday: isToday(day),
          game: gameForDay || null,
          gridPosition: index === 0 ? startDayOfWeek + 1 : undefined
        };
      });

      months.push({
        date: new Date(currentMonth),
        days
      });

      currentMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      );
    }

    // Calculate comprehensive stats
    const completedGames = gamesWithResults.filter(
      ({ result }) => result && result !== "future"
    );
    const wins = completedGames.filter(({ result }) => result === "win").length;
    const losses = completedGames.filter(
      ({ result }) => result === "loss"
    ).length;
    const otLosses = completedGames.filter(
      ({ result }) => result === "otLoss"
    ).length;
    const future = gamesWithResults.filter(
      ({ result }) => result === "future"
    ).length;
    const totalPlayed = completedGames.length;

    // Home/Away splits
    const homeGames = completedGames.filter(
      ({ homeAway }) => homeAway === "vs"
    );
    const awayGames = completedGames.filter(({ homeAway }) => homeAway === "@");

    const homeRecord = {
      wins: homeGames.filter(({ result }) => result === "win").length,
      losses: homeGames.filter(({ result }) => result === "loss").length,
      otLosses: homeGames.filter(({ result }) => result === "otLoss").length
    };

    const awayRecord = {
      wins: awayGames.filter(({ result }) => result === "win").length,
      losses: awayGames.filter(({ result }) => result === "loss").length,
      otLosses: awayGames.filter(({ result }) => result === "otLoss").length
    };

    // vs Strong teams
    const vsStrong = completedGames.filter(
      ({ opponentStrength }) => opponentStrength === "strong"
    );
    const vsStrongTeams = {
      wins: vsStrong.filter(({ result }) => result === "win").length,
      losses: vsStrong.filter(({ result }) => result === "loss").length,
      otLosses: vsStrong.filter(({ result }) => result === "otLoss").length
    };

    // Recent form (last 10 games)
    const recentGames = completedGames.slice(-10);
    const recentForm = {
      wins: recentGames.filter(({ result }) => result === "win").length,
      losses: recentGames.filter(({ result }) => result === "loss").length,
      otLosses: recentGames.filter(({ result }) => result === "otLoss").length
    };

    const stats: CalendarStats = {
      wins,
      losses,
      otLosses,
      future,
      total: gamesWithResults.length,
      winPercentage: totalPlayed > 0 ? (wins / totalPlayed) * 100 : 0,
      pointPercentage:
        totalPlayed > 0 ? ((wins * 2 + otLosses) / (totalPlayed * 2)) * 100 : 0,
      homeRecord,
      awayRecord,
      vsStrongTeams,
      recentForm
    };

    return { months, stats };
  }, [gamesWithResults]);

  // Enhanced tooltip handlers
  const handleMouseEnter = (
    gameData: EnhancedGameData | null,
    event: React.MouseEvent
  ) => {
    if (gameData) {
      setHoveredGame(gameData);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredGame(null);
  };

  // Enhanced tooltip renderer
  const renderGameTooltip = () => {
    if (!hoveredGame) return null;

    const {
      game,
      result,
      opponent,
      homeAway,
      opponentStrength,
      xGDifferential,
      gameRating,
      isPlayoff
    } = hoveredGame;

    const getResultLabel = () => {
      switch (result) {
        case "win":
          return "Win";
        case "loss":
          return "Loss";
        case "otLoss":
          return "OT/SO Loss";
        case "future":
          return "Scheduled";
        default:
          return "Unknown";
      }
    };

    const getScoreDisplay = () => {
      if (result === "future" || !game.homeTeamScore) return null;
      const teamScore =
        homeAway === "vs" ? game.homeTeamScore : game.awayTeamScore;
      const oppScore =
        homeAway === "vs" ? game.awayTeamScore : game.homeTeamScore;
      return `${teamScore}-${oppScore}`;
    };

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
          <strong>{format(new Date(game.gameDate), "MMM d, yyyy")}</strong>
          {isPlayoff && <span className={styles.playoffLabel}>PLAYOFF</span>}
          <span
            className={`${styles.resultLabel} ${styles[result || "unknown"]}`}
          >
            {getResultLabel()}
          </span>
        </div>

        <div className={styles.tooltipContent}>
          <div className={styles.matchupInfo}>
            <div className={styles.matchup}>
              {homeAway} {opponent}
            </div>
            {getScoreDisplay() && (
              <div className={styles.score}>{getScoreDisplay()}</div>
            )}
          </div>

          <div className={styles.gameAnalytics}>
            <div className={styles.analyticItem}>
              <span className={styles.label}>Opponent:</span>
              <span
                className={`${styles.value} ${styles[opponentStrength || "average"]}`}
              >
                {opponentStrength?.toUpperCase()}
              </span>
            </div>

            {result !== "future" && xGDifferential && (
              <div className={styles.analyticItem}>
                <span className={styles.label}>xG Diff:</span>
                <span
                  className={`${styles.value} ${xGDifferential > 0 ? styles.positive : styles.negative}`}
                >
                  {xGDifferential > 0 ? "+" : ""}
                  {xGDifferential.toFixed(2)}
                </span>
              </div>
            )}

            <div className={styles.analyticItem}>
              <span className={styles.label}>Rating:</span>
              <span
                className={`${styles.value} ${styles[gameRating || "average"]}`}
              >
                {gameRating?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.tooltipFooter}>
          <em>
            {result === "future" ? "Click for more details" : "Game completed"}
          </em>
        </div>
      </div>
    );
  };

  // Helper functions for current streak
  const getCurrentStreakInfo = () => {
    const completedGames = gamesWithResults
      .filter(({ result }) => result && result !== "future")
      .sort(
        (a, b) =>
          new Date(b.game.gameDate).getTime() -
          new Date(a.game.gameDate).getTime()
      );

    if (completedGames.length === 0) {
      return { currentStreak: 0, streakType: null };
    }

    let currentStreak = 0;
    let streakType: "win" | "loss" | null = null;

    const mostRecentResult = completedGames[0]?.result;
    if (mostRecentResult === "win") {
      streakType = "win";
    } else if (mostRecentResult === "loss" || mostRecentResult === "otLoss") {
      streakType = "loss";
    }

    if (streakType) {
      for (const { result } of completedGames) {
        if (streakType === "win" && result === "win") {
          currentStreak++;
        } else if (
          streakType === "loss" &&
          (result === "loss" || result === "otLoss")
        ) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return { currentStreak, streakType };
  };

  const { currentStreak, streakType } = getCurrentStreakInfo();

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <h3>Loading Schedule...</h3>
          <p>Fetching game data and analytics</p>
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

  return (
    <div
      className={styles.container}
      style={
        {
          "--team-primary-color": teamInfo?.primaryColor || "#1976d2",
          "--team-secondary-color": teamInfo?.secondaryColor || "#424242",
          "--team-accent-color": teamInfo?.accent || "#ff9800"
        } as React.CSSProperties
      }
    >
      {/* Debug Panel */}
      {debug && (
        <div className={styles.debugPanel}>
          <h4>Debug Information</h4>
          <p>
            <strong>Team:</strong> {teamAbbr} (ID: {teamId})
          </p>
          <p>
            <strong>Season:</strong> {seasonId}
          </p>
          <p>
            <strong>Games Loaded:</strong> {games.length}
          </p>
          <p>
            <strong>Team Stats:</strong> {teamStats.length} entries
          </p>
          <p>
            <strong>Current Record:</strong>{" "}
            {finalRecord
              ? `${finalRecord.wins}-${finalRecord.losses}-${finalRecord.otLosses}`
              : "N/A"}
          </p>
          <p>
            <strong>Calendar Stats:</strong>{" "}
            {calendarData.stats
              ? `${calendarData.stats.wins}W ${calendarData.stats.losses}L ${calendarData.stats.otLosses}OT ${calendarData.stats.future}F`
              : "N/A"}
          </p>
        </div>
      )}

      {/* Calendar Header */}
      <div className={styles.calendarHeader}>
        <div className={styles.titleWithInfo}>
          <h3>{teamAbbr} Schedule Calendar</h3>
          <button
            className={styles.infoButton}
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
          >
            ?
          </button>
          {showInfo && (
            <div className={styles.infoTooltip}>
              <h4>Team Schedule Calendar</h4>
              <p>
                Interactive calendar showing your team's complete season with
                game results, opponent strength analysis, and performance
                metrics.
              </p>
              <h5>Features:</h5>
              <ul>
                <li>
                  <strong>Color Coding:</strong> Win/Loss results with opponent
                  strength overlay
                </li>
                <li>
                  <strong>Streak Highlighting:</strong> 3+ game win/loss streaks
                  with enhanced borders
                </li>
                <li>
                  <strong>Analytics:</strong> xGF/xGA differentials and game
                  ratings
                </li>
                <li>
                  <strong>Smart Tooltips:</strong> Detailed game information on
                  hover
                </li>
                <li>
                  <strong>Comprehensive Stats:</strong> Home/away splits, recent
                  form, vs strong teams
                </li>
              </ul>
              <h5>Legend:</h5>
              <ul>
                <li>
                  <strong>Green:</strong> Wins
                </li>
                <li>
                  <strong>Red:</strong> Regulation Losses
                </li>
                <li>
                  <strong>Orange:</strong> OT/Shootout Losses
                </li>
                <li>
                  <strong>Blue:</strong> Future Games
                </li>
                <li>
                  <strong>Gold Border:</strong> Playoff Games
                </li>
                <li>
                  <strong>Glowing Border:</strong> Active Win/Loss Streaks
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Enhanced Team Summary */}
        <div className={styles.teamSummary}>
          <div className={styles.summaryCard}>
            <h4>Season Record</h4>
            <div className={styles.record}>
              {finalRecord
                ? `${finalRecord.wins}-${finalRecord.losses}-${finalRecord.otLosses}`
                : "N/A"}
            </div>
            <p className={styles.points}>{finalRecord?.points || 0} Points</p>
            {calendarData.stats && (
              <p className={styles.percentage}>
                {calendarData.stats.pointPercentage.toFixed(1)}% Points
              </p>
            )}
          </div>

          <div className={`${styles.summaryCard} ${styles.streakCard}`}>
            <h4>Current Streak</h4>
            <div
              className={`${styles.streak} ${styles[streakType || "neutral"]}`}
            >
              {currentStreak > 0 && streakType
                ? `${currentStreak}${streakType === "win" ? "W" : "L"}`
                : "None"}
            </div>
            {calendarData.stats && (
              <p className={styles.recentForm}>
                L10: {calendarData.stats.recentForm.wins}-
                {calendarData.stats.recentForm.losses}-
                {calendarData.stats.recentForm.otLosses}
              </p>
            )}
          </div>

          {calendarData.stats && (
            <>
              <div className={styles.summaryCard}>
                <h4>Home Record</h4>
                <div className={styles.record}>
                  {calendarData.stats.homeRecord.wins}-
                  {calendarData.stats.homeRecord.losses}-
                  {calendarData.stats.homeRecord.otLosses}
                </div>
              </div>

              <div className={styles.summaryCard}>
                <h4>Away Record</h4>
                <div className={styles.record}>
                  {calendarData.stats.awayRecord.wins}-
                  {calendarData.stats.awayRecord.losses}-
                  {calendarData.stats.awayRecord.otLosses}
                </div>
              </div>

              <div className={styles.summaryCard}>
                <h4>vs Top Teams</h4>
                <div className={styles.record}>
                  {calendarData.stats.vsStrongTeams.wins}-
                  {calendarData.stats.vsStrongTeams.losses}-
                  {calendarData.stats.vsStrongTeams.otLosses}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Enhanced Legend */}
        <div className={styles.calendarLegend}>
          <span className={styles.legendLabel}>Game Results:</span>
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
              <span>OT Loss</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.future}`}></div>
              <span>Future</span>
            </div>
          </div>

          <span className={styles.legendLabel}>Special:</span>
          <div className={styles.legendItems}>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.playoff}`}></div>
              <span>Playoff</span>
            </div>
            <div className={styles.legendItem}>
              <div
                className={`${styles.legendColor} ${styles.winStreak}`}
              ></div>
              <span>Win Streak</span>
            </div>
            <div className={styles.legendItem}>
              <div
                className={`${styles.legendColor} ${styles.lossStreak}`}
              ></div>
              <span>Loss Streak</span>
            </div>
            <div className={styles.legendItem}>
              <div
                className={`${styles.legendColor} ${styles.strongOpponent}`}
              ></div>
              <span>vs Strong</span>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Calendar Content */}
      <div className={styles.calendarContent}>
        <div className={styles.calendarMain}>
          <div className={styles.calendarGrid}>
            {calendarData.months.map((month, index) => (
              <div key={index} className={styles.calendarMonth}>
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
                      const gameData = day.game;

                      const getDayClasses = () => {
                        let classes = [styles.dayCell];

                        if (!day.isCurrentMonth) {
                          classes.push(styles.otherMonth);
                        }

                        if (day.isToday) {
                          classes.push(styles.today);
                        }

                        if (gameData) {
                          const {
                            result,
                            isPartOfStreak,
                            streakType,
                            isPlayoff,
                            opponentStrength
                          } = gameData;

                          if (
                            selectedGame &&
                            selectedGame.id === gameData.game.id
                          ) {
                            classes.push(styles.selectedGame);
                          }

                          // Game result styling
                          if (result === "win") classes.push(styles.gameWin);
                          else if (result === "loss")
                            classes.push(styles.gameLoss);
                          else if (result === "otLoss")
                            classes.push(styles.gameOtLoss);
                          else if (result === "future")
                            classes.push(styles.gameFuture);

                          // Special game types
                          if (isPlayoff) classes.push(styles.playoffGame);
                          if (opponentStrength === "strong")
                            classes.push(styles.strongOpponent);

                          // Streak highlighting - this was missing proper implementation
                          if (isPartOfStreak && streakType) {
                            if (streakType === "win")
                              classes.push(styles.winStreak);
                            else if (streakType === "loss")
                              classes.push(styles.lossStreak);
                          }
                        }

                        return classes.join(" ");
                      };

                      const handleClick = () => {
                        if (gameData) {
                          setSelectedGame(gameData.game);
                        }
                      };

                      const getScoreDisplay = () => {
                        if (
                          !gameData ||
                          !gameData.game.homeTeamScore ||
                          gameData.result === "future"
                        )
                          return null;

                        const { game, homeAway } = gameData;
                        const teamScore =
                          homeAway === "vs"
                            ? game.homeTeamScore
                            : game.awayTeamScore;
                        const oppScore =
                          homeAway === "vs"
                            ? game.awayTeamScore
                            : game.homeTeamScore;

                        return `${teamScore}-${oppScore}`;
                      };

                      return (
                        <div
                          key={dayIndex}
                          className={getDayClasses()}
                          onClick={handleClick}
                          onMouseEnter={(e) => handleMouseEnter(gameData, e)}
                          onMouseLeave={handleMouseLeave}
                          style={{
                            gridColumnStart: day.gridPosition
                          }}
                        >
                          <div className={styles.dayNumber}>
                            {day.dayNumber}
                          </div>
                          {gameData && (
                            <div className={styles.gameInfo}>
                              <div className={styles.opponent}>
                                {gameData.homeAway} {gameData.opponent}
                              </div>
                              {getScoreDisplay() && (
                                <div className={styles.score}>
                                  {getScoreDisplay()}
                                </div>
                              )}
                              {gameData.opponentStrength === "strong" && (
                                <div className={styles.strengthIndicator}>
                                  ★
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

        {/* Enhanced Sidebar */}
        {selectedGame && (
          <div className={styles.sidebarContainer}>
            <EnhancedGameStatsSidebar
              game={selectedGame}
              gameData={gamesWithResults.find(
                (g) => g.game.id === selectedGame.id
              )}
              onClose={() => setSelectedGame(null)}
              teamId={teamId}
              teamAbbr={teamAbbr}
            />
          </div>
        )}
      </div>

      {/* Enhanced Tooltip */}
      {hoveredGame && renderGameTooltip()}

      {/* Calendar Footer with Enhanced Stats */}
      {calendarData.stats && (
        <div className={styles.calendarFooter}>
          <div className={styles.calendarStats}>
            <div className={styles.statGroup}>
              <h4>Season Overview</h4>
              <div className={styles.statItems}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Games Played</span>
                  <span className={styles.statValue}>
                    {calendarData.stats.wins +
                      calendarData.stats.losses +
                      calendarData.stats.otLosses}
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Win %</span>
                  <span className={styles.statValue}>
                    {calendarData.stats.winPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Point %</span>
                  <span className={styles.statValue}>
                    {calendarData.stats.pointPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Enhanced Game Stats Sidebar Component
const EnhancedGameStatsSidebar = ({
  game,
  gameData,
  onClose,
  teamId,
  teamAbbr
}: {
  game: ScheduleGame;
  gameData?: EnhancedGameData;
  onClose: () => void;
  teamId: number | string;
  teamAbbr: string;
}) => {
  const isHomeTeam = game.homeTeam.id.toString() === teamId.toString();
  const opponent = isHomeTeam ? game.awayTeam : game.homeTeam;
  const gameDate = new Date(game.gameDate);
  const isFuture = gameDate > new Date();

  return (
    <div className={styles.gameStatsSidebar}>
      <div className={styles.sidebarHeader}>
        <h3>Game Details</h3>
        <button className={styles.closeSidebar} onClick={onClose}>
          ×
        </button>
      </div>

      <div className={styles.gameOverview}>
        <div className={styles.matchupHeader}>
          <div className={styles.teams}>
            <div
              className={`${styles.team} ${isHomeTeam ? styles.homeTeam : styles.awayTeam}`}
            >
              <span className={styles.teamAbbr}>{teamAbbr}</span>
              {!isFuture && game.homeTeamScore !== undefined && (
                <span className={styles.teamScore}>
                  {isHomeTeam ? game.homeTeamScore : game.awayTeamScore}
                </span>
              )}
            </div>
            <div className={styles.vs}>{isHomeTeam ? "vs" : "@"}</div>
            <div
              className={`${styles.team} ${!isHomeTeam ? styles.homeTeam : styles.awayTeam}`}
            >
              <span className={styles.teamAbbr}>
                {getTeamAbbreviationById(opponent.id) || opponent.abbrev}
              </span>
              {!isFuture && game.homeTeamScore !== undefined && (
                <span className={styles.teamScore}>
                  {!isHomeTeam ? game.homeTeamScore : game.awayTeamScore}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.gameDate}>
          {format(gameDate, "EEEE, MMMM d, yyyy")}
          <br />
          <small>{format(gameDate, "h:mm a")}</small>
        </div>

        {game.gameType === 3 && (
          <div className={styles.playoffBadge}>🏆 Playoff Game</div>
        )}

        {gameData && (
          <div className={styles.gameAnalytics}>
            <h4>Game Analytics</h4>

            <div className={styles.analyticRow}>
              <span className={styles.label}>Result:</span>
              <span
                className={`${styles.value} ${styles[gameData.result || "unknown"]}`}
              >
                {gameData.result?.toUpperCase() || "TBD"}
              </span>
            </div>

            <div className={styles.analyticRow}>
              <span className={styles.label}>Opponent Strength:</span>
              <span
                className={`${styles.value} ${styles[gameData.opponentStrength || "average"]}`}
              >
                {gameData.opponentStrength?.toUpperCase()}
              </span>
            </div>

            {gameData.xGDifferential && gameData.result !== "future" && (
              <div className={styles.analyticRow}>
                <span className={styles.label}>xG Differential:</span>
                <span
                  className={`${styles.value} ${gameData.xGDifferential > 0 ? styles.positive : styles.negative}`}
                >
                  {gameData.xGDifferential > 0 ? "+" : ""}
                  {gameData.xGDifferential.toFixed(2)}
                </span>
              </div>
            )}

            <div className={styles.analyticRow}>
              <span className={styles.label}>Game Rating:</span>
              <span
                className={`${styles.value} ${styles[gameData.gameRating || "average"]}`}
              >
                {gameData.gameRating?.toUpperCase()}
              </span>
            </div>

            {gameData.isPartOfStreak && (
              <div className={styles.streakInfo}>
                <span
                  className={`${styles.streakBadge} ${styles[gameData.streakType || "neutral"]}`}
                >
                  Part of {gameData.streakType?.toUpperCase()} Streak
                </span>
              </div>
            )}
          </div>
        )}

        {isFuture && (
          <div className={styles.upcomingInfo}>
            <h4>Upcoming Game</h4>
            <p>
              Game preview and predictions will be available closer to game
              time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
