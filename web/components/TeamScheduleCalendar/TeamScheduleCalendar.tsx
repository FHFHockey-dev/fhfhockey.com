import React, { useState, useMemo, useEffect } from "react";
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
import supabase from "lib/supabase";

interface TeamScheduleCalendarProps {
  games: ScheduleGame[];
  teamId: number | string;
  teamAbbreviation: string;
  seasonId: string;
  loading?: boolean;
  error?: string | null;
  record?: TeamRecord | null;
}

// Enhanced types for comprehensive game analysis
interface WGOTeamStat {
  id: number;
  team_id: number;
  franchise_name: string;
  date: string;
  games_played: number;
  wins: number;
  losses: number;
  ot_losses: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goals_for_per_game: number;
  goals_against_per_game: number;
  shots_for_per_game: number;
  shots_against_per_game: number;
  faceoff_win_pct: number;
  penalty_kill_pct: number;
  power_play_pct: number;
  hits: number;
  blocked_shots: number;
  takeaways: number;
  giveaways: number;
  penalty_minutes: number;
  pp_opportunities: number;
  game_id: number;
  opponent_id: number;
  // Advanced analytics fields
  sat_pct?: number;
  shooting_pct_5v5?: number;
  save_pct_5v5?: number;
  zone_start_pct_5v5?: number;
}

interface EnhancedGameData {
  game: ScheduleGame;
  result: GameResult;
  opponent: string;
  homeAway: "vs" | "@";
  isPlayoff: boolean;
  isPartOfStreak?: boolean;
  streakType?: "win" | "loss";
  streakPosition?: "start" | "middle" | "end" | "single";
  opponentStrength?: "strong" | "average" | "weak";
  // Enhanced analytics from wgo_team_stats
  gameStats?: WGOTeamStat;
  performance?: {
    goalsFor: number;
    goalsAgainst: number;
    goalDifferential: number;
    shotsFor: number;
    shotsAgainst: number;
    shotDifferential: number;
    faceoffPct: number;
    powerPlayPct: number;
    penaltyKillPct: number;
    hits: number;
    blockedShots: number;
    takeaways: number;
    giveaways: number;
    penaltyMinutes: number;
    // Advanced metrics
    expectedGoals?: number;
    corsiFor?: number;
    fenwickFor?: number;
    gameScore?: number;
  } | null; // Allow null for when performance data is unavailable
  gameRating?: "excellent" | "good" | "average" | "poor";
  xGDifferential?: number; // Add missing xGDifferential property
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
  points: number;
  pointPercentage: number;
  winPercentage: number;
  recentForm: {
    wins: number;
    losses: number;
    otLosses: number;
  };
  homeRecord: {
    wins: number;
    losses: number;
    otLosses: number;
  };
  awayRecord: {
    wins: number;
    losses: number;
    otLosses: number;
  };
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  avgShotsFor: number;
  avgShotsAgainst: number;
  homePerformance: {
    avgGoalsFor: number;
    avgGoalsAgainst: number;
  };
  awayPerformance: {
    avgGoalsFor: number;
    avgGoalsAgainst: number;
  };
}

type GameResult = "win" | "loss" | "otLoss" | "future" | null;

// New: Type for nhl_standings_details
interface NHLStandingsDetails {
  season_id: number;
  date: string;
  team_abbrev: string;
  home_wins: number;
  home_losses: number;
  home_ot_losses: number;
  home_games_played: number;
  road_wins: number;
  road_losses: number;
  road_ot_losses: number;
  road_games_played: number;
  wins: number;
  losses: number;
  ot_losses: number;
  points: number;
  games_played: number;
  goal_differential: number;
  goal_for: number;
  goal_against: number;
  streak_code: string | null;
  streak_count: number | null;
  l10_wins: number | null;
  l10_losses: number | null;
  l10_ot_losses: number | null;
  l10_games_played: number | null;
  l10_points: number | null;
  l10_goal_differential: number | null;
  home_goals_for: number | null;
  home_goals_against: number | null;
  road_goals_for: number | null;
  road_goals_against: number | null;
  league_sequence: number | null;
}

// New: Hook to fetch latest nhl_standings_details for a team/season
function useNHLStandingsDetails(teamAbbr: string, seasonId: string) {
  const [details, setDetails] = useState<NHLStandingsDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamAbbr || !seasonId) return;
    setLoading(true);
    setError(null);
    const fetchDetails = async () => {
      try {
        const { data, error } = await supabase
          .from("nhl_standings_details")
          .select("*")
          .eq("team_abbrev", teamAbbr)
          .eq("season_id", Number(seasonId))
          .order("date", { ascending: false })
          .limit(1)
          .single();
        if (error) throw error;
        setDetails(data as NHLStandingsDetails);
      } catch (err: any) {
        setError(err.message || "Failed to fetch standings details");
        setDetails(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [teamAbbr, seasonId]);

  return { details, loading, error };
}

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
  const [debug] = useState(true); // Enable debug mode to diagnose streak issue
  const [wgoStats, setWgoStats] = useState<WGOTeamStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Add state for games table data
  const [gamesTableData, setGamesTableData] = useState<any[]>([]);
  const [gamesTableLoading, setGamesTableLoading] = useState(false);

  // Get team abbreviation from ID if not provided
  const teamAbbr =
    teamAbbreviation || getTeamAbbreviationById(Number(teamId)) || `T${teamId}`;

  const teamInfo = teamsInfo[teamAbbreviation];

  // Use Supabase data for accurate team stats
  const {
    teamStats,
    record: dbRecord,
    loading: teamStatsLoading
  } = useTeamStatsFromDb(teamId, seasonId);

  const today = startOfDay(new Date());

  // Use database record if available, fallback to NHL API record
  const finalRecord = dbRecord || record;

  // New: Fetch nhl_standings_details
  const {
    details: standingsDetails,
    loading: standingsLoading,
    error: standingsError
  } = useNHLStandingsDetails(teamAbbr, seasonId);

  // Helper function to determine home/away from WGO stats using games table
  const getHomeAwayFromWGOStat = (wgoStat: WGOTeamStat): "vs" | "@" | null => {
    if (!wgoStat.game_id) return null;

    const gameTableEntry = gamesTableData.find(
      (game) => game.id === wgoStat.game_id
    );

    if (!gameTableEntry) return null;

    const isHomeTeam = gameTableEntry.homeTeamId === Number(teamId);
    return isHomeTeam ? "vs" : "@";
  };

  // Enhanced: Fetch comprehensive wgo_team_stats data
  React.useEffect(() => {
    const fetchWGOStats = async () => {
      if (!teamId || !seasonId) return;

      setStatsLoading(true);
      try {
        const { data, error } = await supabase
          .from("wgo_team_stats")
          .select(
            `
            *
          `
          )
          .eq("team_id", Number(teamId))
          .eq("season_id", Number(seasonId))
          .order("date", { ascending: true });

        if (error) {
          console.error("Error fetching WGO stats:", error);
          return;
        }

        if (data) {
          setWgoStats(data as WGOTeamStat[]);
        }
      } catch (err) {
        console.error("Error in WGO stats fetch:", err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchWGOStats();
  }, [teamId, seasonId]);

  // Add useEffect to fetch games table data for home/away mapping
  useEffect(() => {
    const fetchGamesTableData = async () => {
      if (!teamId || !seasonId) return;

      setGamesTableLoading(true);
      try {
        const { data, error } = await supabase
          .from("games")
          .select("id, homeTeamId, awayTeamId, date")
          .eq("seasonId", Number(seasonId))
          .or(`homeTeamId.eq.${Number(teamId)},awayTeamId.eq.${Number(teamId)}`)
          .order("date", { ascending: true });

        if (error) {
          console.error("Error fetching games table data:", error);
          return;
        }

        if (data) {
          setGamesTableData(data);
        }
      } catch (err) {
        console.error("Error in games table fetch:", err);
      } finally {
        setGamesTableLoading(false);
      }
    };

    fetchGamesTableData();
  }, [teamId, seasonId]);

  // Enhanced game result determination with WGO stats integration
  const getGameResult = (game: ScheduleGame): GameResult => {
    const gameDate = new Date(game.gameDate);
    const isGameInFuture = gameDate > today;

    if (isGameInFuture) {
      return "future";
    }

    // Primary: Use wgo_team_stats for accurate game-by-game results
    const gameDate_YYYY_MM_DD = format(gameDate, "yyyy-MM-dd");
    const gameDayWGOStat = wgoStats.find(
      (stat) => stat.date === gameDate_YYYY_MM_DD
    );

    if (gameDayWGOStat) {
      // Determine result based on points: 2 = win, 1 = OT loss, 0 = loss
      // We need to compare with previous game to see point change
      const statIndex = wgoStats.findIndex(
        (stat) => stat.date === gameDate_YYYY_MM_DD
      );
      if (statIndex > 0) {
        const prevStat = wgoStats[statIndex - 1];
        const pointsGained = gameDayWGOStat.points - prevStat.points;

        if (pointsGained === 2) return "win";
        if (pointsGained === 1) return "otLoss";
        if (pointsGained === 0) return "loss";
      }
    }

    // Fallback: Use existing teamStats logic
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

    // Final fallback to API data for completed games
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

  // Enhanced home/away determination using game_id mapping
  const determineHomeAway = async (game: ScheduleGame): Promise<"vs" | "@"> => {
    // First, try to determine from team IDs
    const isHomeTeam = game.homeTeam.id.toString() === teamId.toString();
    return isHomeTeam ? "vs" : "@";
  };

  // Enhanced opponent strength analysis using WGO stats
  const calculateOpponentStrength = (
    opponentId: number,
    gameDate: string
  ): "strong" | "average" | "weak" => {
    // This would ideally fetch opponent's stats up to the game date
    // For now, using a simplified approach based on known strong/weak teams
    const strongTeams = [1, 2, 3, 6, 8, 12, 13, 16, 17, 19, 20, 21, 25, 28];
    const weakTeams = [4, 5, 7, 11, 14, 15, 18, 22, 23, 26, 27, 29, 30];

    if (strongTeams.includes(opponentId)) return "strong";
    if (weakTeams.includes(opponentId)) return "weak";
    return "average";
  };

  // Enhanced game performance analysis
  const analyzeGamePerformance = (wgoStat: WGOTeamStat, result: GameResult) => {
    if (!wgoStat) return null;

    // Calculate game-specific stats (differential from previous game)
    const statIndex = wgoStats.findIndex((stat) => stat.date === wgoStat.date);
    const prevStat = statIndex > 0 ? wgoStats[statIndex - 1] : null;

    if (!prevStat) return null;

    const goalsFor = wgoStat.goals_for - prevStat.goals_for;
    const goalsAgainst = wgoStat.goals_against - prevStat.goals_against;
    const shotsFor = Math.round(
      wgoStat.shots_for_per_game * wgoStat.games_played -
        prevStat.shots_for_per_game * prevStat.games_played
    );
    const shotsAgainst = Math.round(
      wgoStat.shots_against_per_game * wgoStat.games_played -
        prevStat.shots_against_per_game * prevStat.games_played
    );

    return {
      goalsFor,
      goalsAgainst,
      goalDifferential: goalsFor - goalsAgainst,
      shotsFor,
      shotsAgainst,
      shotDifferential: shotsFor - shotsAgainst,
      faceoffPct: wgoStat.faceoff_win_pct || 0,
      powerPlayPct: wgoStat.power_play_pct || 0,
      penaltyKillPct: wgoStat.penalty_kill_pct || 0,
      hits: wgoStat.hits || 0,
      blockedShots: wgoStat.blocked_shots || 0,
      takeaways: wgoStat.takeaways || 0,
      giveaways: wgoStat.giveaways || 0,
      penaltyMinutes: wgoStat.penalty_minutes || 0
    };
  };

  // Enhanced game rating calculation
  const calculateGameRating = (
    result: GameResult,
    performance: any,
    opponentStrength: "strong" | "average" | "weak"
  ): "excellent" | "good" | "average" | "poor" => {
    if (result === "future") return "average";

    let score = 0;

    // Base score from result
    if (result === "win") score += 3;
    else if (result === "otLoss") score += 1;
    else score += 0;

    // Adjust for opponent strength
    if (opponentStrength === "strong") score += 1;
    else if (opponentStrength === "weak") score -= 1;

    // Performance factors
    if (performance) {
      if (performance.goalDifferential > 2) score += 1;
      else if (performance.goalDifferential < -2) score -= 1;

      if (performance.shotDifferential > 5) score += 0.5;
      else if (performance.shotDifferential < -5) score -= 0.5;
    }

    if (score >= 4) return "excellent";
    if (score >= 2.5) return "good";
    if (score >= 1) return "average";
    return "poor";
  };

  // Enhanced game processing with comprehensive analytics
  const gamesWithResults: EnhancedGameData[] = useMemo(() => {
    const results: EnhancedGameData[] = games.map((game) => {
      const result = getGameResult(game);
      const isHomeTeam = game.homeTeam.id.toString() === teamId.toString();
      const opponent = isHomeTeam ? game.awayTeam : game.homeTeam;
      const homeAway: "vs" | "@" = isHomeTeam ? "vs" : "@";
      const opponentAbbr =
        getTeamAbbreviationById(opponent.id) ||
        opponent.abbrev ||
        `T${opponent.id}`;

      const gameDate = format(new Date(game.gameDate), "yyyy-MM-dd");
      const gameDayWGOStat = wgoStats.find((stat) => stat.date === gameDate);
      const opponentStrength = calculateOpponentStrength(opponent.id, gameDate);

      // For completed games, try to get home/away from WGO stats for accuracy
      let finalHomeAway = homeAway;
      if (gameDayWGOStat && result !== "future") {
        const wgoHomeAway = getHomeAwayFromWGOStat(gameDayWGOStat);
        if (wgoHomeAway) {
          finalHomeAway = wgoHomeAway;
        }
      }

      const performance = gameDayWGOStat
        ? analyzeGamePerformance(gameDayWGOStat, result)
        : undefined;
      const gameRating = calculateGameRating(
        result,
        performance,
        opponentStrength
      );

      return {
        game,
        result,
        opponent: opponentAbbr,
        homeAway: finalHomeAway,
        isPlayoff: game.gameType === 3,
        opponentStrength,
        gameStats: gameDayWGOStat,
        performance,
        gameRating
      };
    });

    // Enhanced streak detection remains the same but now uses accurate results
    const completedGames = results
      .filter(({ result }) => result && result !== "future")
      .sort(
        (a, b) =>
          new Date(a.game.gameDate).getTime() -
          new Date(b.game.gameDate).getTime()
      );

    // Find all streaks of 3+ consecutive wins or losses
    const streaks: Array<{
      type: "win" | "loss";
      games: EnhancedGameData[];
      startIndex: number;
      endIndex: number;
    }> = [];

    let currentStreakGames: EnhancedGameData[] = [];
    let currentStreakType: "win" | "loss" | null = null;

    completedGames.forEach((gameData, index) => {
      const { result } = gameData;
      const isWin = result === "win";
      const isLoss = result === "loss" || result === "otLoss";

      // Determine what type of result this game is
      let gameType: "win" | "loss" | null = null;
      if (isWin) {
        gameType = "win";
      } else if (isLoss) {
        gameType = "loss";
      }

      // Check if this game continues the current streak
      if (gameType === currentStreakType && gameType !== null) {
        // Continue the current streak
        currentStreakGames.push(gameData);
      } else {
        // End current streak if it's 3+ games
        if (currentStreakGames.length >= 3 && currentStreakType) {
          streaks.push({
            type: currentStreakType,
            games: [...currentStreakGames],
            startIndex: index - currentStreakGames.length,
            endIndex: index - 1
          });
        }

        // Start new streak if this game is a win or loss
        if (gameType !== null) {
          currentStreakType = gameType;
          currentStreakGames = [gameData];
        } else {
          // Game is neither win nor loss (shouldn't happen with our filtering, but safety check)
          currentStreakType = null;
          currentStreakGames = [];
        }
      }
    });

    // Check final streak
    if (currentStreakGames.length >= 3 && currentStreakType) {
      streaks.push({
        type: currentStreakType,
        games: [...currentStreakGames],
        startIndex: completedGames.length - currentStreakGames.length,
        endIndex: completedGames.length - 1
      });
    }

    // Apply streak information to games
    streaks.forEach((streak) => {
      streak.games.forEach((streakGame, gameIndex) => {
        const resultIndex = results.findIndex(
          ({ game }) => game.id === streakGame.game.id
        );
        if (resultIndex !== -1) {
          let streakPosition: "start" | "middle" | "end" | "single" = "middle";

          if (streak.games.length === 1) {
            streakPosition = "single";
          } else if (gameIndex === 0) {
            streakPosition = "start";
          } else if (gameIndex === streak.games.length - 1) {
            streakPosition = "end";
          }

          results[resultIndex] = {
            ...results[resultIndex],
            isPartOfStreak: true,
            streakType: streak.type,
            streakPosition
          };
        }
      });
    });

    return results;
  }, [games, wgoStats, teamId, gamesTableData]);

  // Enhanced calendar data generation with comprehensive analytics
  const calendarData = useMemo(() => {
    if (!gamesWithResults || gamesWithResults.length === 0) {
      return null;
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

    const seasonStart = new Date(seasonStartYear, 9, 1);
    const seasonEnd = new Date(seasonStartYear + 1, 5, 30);

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

    // Enhanced stats calculation using WGO data with accurate home/away splits
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

    // Enhanced Home/Away splits using WGO stats with proper game table mapping
    const homeGames = completedGames.filter(({ homeAway, gameStats }) => {
      // For games with WGO stats, use the mapped home/away determination
      if (gameStats) {
        const wgoHomeAway = getHomeAwayFromWGOStat(gameStats);
        return wgoHomeAway === "vs";
      }
      // Fallback to schedule-based determination
      return homeAway === "vs";
    });

    const awayGames = completedGames.filter(({ homeAway, gameStats }) => {
      // For games with WGO stats, use the mapped home/away determination
      if (gameStats) {
        const wgoHomeAway = getHomeAwayFromWGOStat(gameStats);
        return wgoHomeAway === "@";
      }
      // Fallback to schedule-based determination
      return homeAway === "@";
    });

    // Calculate home record using WGO stats points system with accurate home/away mapping
    const homeRecord = standingsDetails
      ? {
          wins: standingsDetails.home_wins,
          losses: standingsDetails.home_losses,
          otLosses: standingsDetails.home_ot_losses
        }
      : {
          wins: homeGames.filter(({ result }) => result === "win").length,
          losses: homeGames.filter(({ result }) => result === "loss").length,
          otLosses: homeGames.filter(({ result }) => result === "otLoss").length
        };
    const awayRecord = standingsDetails
      ? {
          wins: standingsDetails.road_wins,
          losses: standingsDetails.road_losses,
          otLosses: standingsDetails.road_ot_losses
        }
      : {
          wins: awayGames.filter(({ result }) => result === "win").length,
          losses: awayGames.filter(({ result }) => result === "loss").length,
          otLosses: awayGames.filter(({ result }) => result === "otLoss").length
        };

    // Calculate vs Strong teams record using WGO stats and opponent strength analysis
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

    // Enhanced analytics using WGO performance data
    const gamesWithPerformance = completedGames.filter(
      (game) => game.performance
    );

    const avgGoalsFor =
      gamesWithPerformance.length > 0
        ? gamesWithPerformance.reduce(
            (sum, game) => sum + game.performance!.goalsFor,
            0
          ) / gamesWithPerformance.length
        : 0;

    const avgGoalsAgainst =
      gamesWithPerformance.length > 0
        ? gamesWithPerformance.reduce(
            (sum, game) => sum + game.performance!.goalsAgainst,
            0
          ) / gamesWithPerformance.length
        : 0;

    const avgShotsFor =
      gamesWithPerformance.length > 0
        ? gamesWithPerformance.reduce(
            (sum, game) => sum + game.performance!.shotsFor,
            0
          ) / gamesWithPerformance.length
        : 0;

    const avgShotsAgainst =
      gamesWithPerformance.length > 0
        ? gamesWithPerformance.reduce(
            (sum, game) => sum + game.performance!.shotsAgainst,
            0
          ) / gamesWithPerformance.length
        : 0;

    // Home vs Away performance analytics
    const homeGamesWithPerf = homeGames.filter((game) => game.performance);
    const awayGamesWithPerf = awayGames.filter((game) => game.performance);

    const homePerformance = {
      avgGoalsFor:
        homeGamesWithPerf.length > 0
          ? homeGamesWithPerf.reduce(
              (sum, game) => sum + game.performance!.goalsFor,
              0
            ) / homeGamesWithPerf.length
          : 0,
      avgGoalsAgainst:
        homeGamesWithPerf.length > 0
          ? homeGamesWithPerf.reduce(
              (sum, game) => sum + game.performance!.goalsAgainst,
              0
            ) / homeGamesWithPerf.length
          : 0,
      avgShotsFor:
        homeGamesWithPerf.length > 0
          ? homeGamesWithPerf.reduce(
              (sum, game) => sum + game.performance!.shotsFor,
              0
            ) / homeGamesWithPerf.length
          : 0,
      faceoffPct:
        homeGamesWithPerf.length > 0
          ? homeGamesWithPerf.reduce(
              (sum, game) => sum + game.performance!.faceoffPct,
              0
            ) / homeGamesWithPerf.length
          : 0,
      powerPlayPct:
        homeGamesWithPerf.length > 0
          ? homeGamesWithPerf.reduce(
              (sum, game) => sum + game.performance!.powerPlayPct,
              0
            ) / homeGamesWithPerf.length
          : 0
    };

    const awayPerformance = {
      avgGoalsFor:
        awayGamesWithPerf.length > 0
          ? awayGamesWithPerf.reduce(
              (sum, game) => sum + game.performance!.goalsFor,
              0
            ) / awayGamesWithPerf.length
          : 0,
      avgGoalsAgainst:
        awayGamesWithPerf.length > 0
          ? awayGamesWithPerf.reduce(
              (sum, game) => sum + game.performance!.goalsAgainst,
              0
            ) / awayGamesWithPerf.length
          : 0,
      avgShotsFor:
        awayGamesWithPerf.length > 0
          ? awayGamesWithPerf.reduce(
              (sum, game) => sum + game.performance!.shotsFor,
              0
            ) / awayGamesWithPerf.length
          : 0,
      faceoffPct:
        awayGamesWithPerf.length > 0
          ? awayGamesWithPerf.reduce(
              (sum, game) => sum + game.performance!.faceoffPct,
              0
            ) / awayGamesWithPerf.length
          : 0,
      powerPlayPct:
        awayGamesWithPerf.length > 0
          ? awayGamesWithPerf.reduce(
              (sum, game) => sum + game.performance!.powerPlayPct,
              0
            ) / awayGamesWithPerf.length
          : 0
    };

    const stats: CalendarStats = {
      wins,
      losses,
      otLosses,
      points: totalPlayed > 0 ? (wins * 2 + otLosses) / 2 : 0,
      pointPercentage:
        totalPlayed > 0 ? ((wins * 2 + otLosses) / (totalPlayed * 2)) * 100 : 0,
      winPercentage: totalPlayed > 0 ? (wins / totalPlayed) * 100 : 0,
      recentForm,
      homeRecord,
      awayRecord,
      avgGoalsFor,
      avgGoalsAgainst,
      avgShotsFor,
      avgShotsAgainst,
      homePerformance,
      awayPerformance
    };

    return { months, stats };
  }, [gamesWithResults, wgoStats, teamId, standingsDetails]);

  // Create seamless overlay style for a streak
  const createStreakOverlay = (
    streakGames: EnhancedGameData[],
    streakType: "win" | "loss",
    monthDays: CalendarDay[]
  ) => {
    if (streakGames.length < 3) return null;

    // Find positions of streak games in the calendar grid
    const positions = streakGames
      .map((gameData) => {
        const dayIndex = monthDays.findIndex(
          (day) => day.game?.game.id === gameData.game.id
        );
        if (dayIndex === -1) return null;

        // Calculate the actual grid position accounting for the starting day of the month
        const firstDayOfMonth = monthDays[0].date;
        const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // The actual grid position includes the offset for days before the month starts
        const actualGridIndex = dayIndex + startDayOfWeek;
        const row = Math.floor(actualGridIndex / 7);
        const col = actualGridIndex % 7;

        return { row, col, dayIndex, actualGridIndex, gameData };
      })
      .filter((pos) => pos !== null);

    if (positions.length === 0) return null;

    // Calculate the total number of rows needed for this month
    const totalDays = monthDays.length;
    const firstDayOfMonth = monthDays[0].date;
    const startDayOfWeek = firstDayOfMonth.getDay();
    const totalGridCells = totalDays + startDayOfWeek;
    const totalRows = Math.ceil(totalGridCells / 7);

    // Group positions by week row and enhance with streak continuity
    const positionsByRow = positions.reduce(
      (acc, pos) => {
        if (!acc[pos!.row]) {
          acc[pos!.row] = [];
        }
        acc[pos!.row].push(pos!);
        return acc;
      },
      {} as Record<number, (typeof positions)[0][]>
    );

    // Create overlays for each row with enhanced continuity logic
    const overlays: Array<{
      type: "winStreak" | "lossStreak";
      style: React.CSSProperties;
      games: EnhancedGameData[];
      isExtended?: boolean;
      isTruncatedLeft?: boolean;
      isTruncatedRight?: boolean;
    }> = [];

    const rowNumbers = Object.keys(positionsByRow)
      .map((r) => parseInt(r))
      .sort((a, b) => a - b);

    rowNumbers.forEach((row, rowIndex) => {
      const rowPositions = positionsByRow[row];
      if (!rowPositions || rowPositions.length === 0) return;

      // Sort positions by column to ensure proper left-to-right order
      const sortedPositions = rowPositions.sort((a, b) => a!.col - b!.col);

      const firstPos = sortedPositions[0]!;
      const lastPos = sortedPositions[sortedPositions.length - 1]!;

      // Determine if this row needs extension for streak continuity
      const isFirstRow = rowIndex === 0;
      const isLastRow = rowIndex === rowNumbers.length - 1;
      const hasNextRow = rowIndex < rowNumbers.length - 1;
      const hasPrevRow = rowIndex > 0;

      // Check if we need to extend to Saturday (col 6) for multi-week continuity
      const needsRightExtension = !isLastRow && hasNextRow && lastPos.col < 6;

      // Check if we need to extend from Sunday (col 0) for multi-week continuity
      const needsLeftExtension = !isFirstRow && hasPrevRow && firstPos.col > 0;

      // Calculate the actual span including extensions
      let spanStartCol = firstPos.col;
      let spanEndCol = lastPos.col;

      if (needsLeftExtension) {
        spanStartCol = 0; // Extend from Sunday
      }
      if (needsRightExtension) {
        spanEndCol = 6; // Extend to Saturday
      }

      // Use CSS Grid fractional units and calc() for responsive positioning
      // This ensures the overlay matches the actual grid cell dimensions
      const style: React.CSSProperties = {
        position: "absolute",
        left: `calc(${spanStartCol} * (100% / 7))`,
        top: `calc(${row} * (100% / ${totalRows}))`,
        width: `calc(${spanEndCol - spanStartCol + 1} * (100% / 7) - 2px)`,
        height: `calc(100% / ${totalRows})`, // Remove the -2px to match exact cell height
        zIndex: 5,
        pointerEvents: "none"
      };

      overlays.push({
        type:
          streakType === "win"
            ? ("winStreak" as const)
            : ("lossStreak" as const),
        style,
        games: sortedPositions.map((pos) => pos!.gameData),
        isExtended: needsLeftExtension || needsRightExtension,
        isTruncatedLeft: needsLeftExtension,
        isTruncatedRight: needsRightExtension
      });
    });

    return overlays;
  };

  // Calculate streak overlays for seamless borders
  const calculateStreakOverlays = (monthDays: CalendarDay[]) => {
    const overlays: Array<{
      type: "winStreak" | "lossStreak";
      style: React.CSSProperties;
      games: EnhancedGameData[];
      isExtended?: boolean;
      isTruncatedLeft?: boolean;
      isTruncatedRight?: boolean;
    }> = [];

    // Find ALL games within this month (not just pre-marked streak games)
    const monthGames = monthDays
      .filter(
        (day) => day.game && day.game.result && day.game.result !== "future"
      )
      .map((day) => day.game!)
      .sort(
        (a, b) =>
          new Date(a.game.gameDate).getTime() -
          new Date(b.game.gameDate).getTime()
      );

    if (monthGames.length === 0) return overlays;

    // Re-analyze streaks within this month using actual game results
    let currentStreak: EnhancedGameData[] = [];
    let currentStreakType: "win" | "loss" | null = null;

    monthGames.forEach((gameData, index) => {
      const { result } = gameData;

      // Determine the actual game type from the result
      let gameType: "win" | "loss" | null = null;
      if (result === "win") {
        gameType = "win";
      } else if (result === "loss" || result === "otLoss") {
        gameType = "loss";
      }

      // Check if this game continues the current streak
      if (gameType === currentStreakType && gameType !== null) {
        // Continue the current streak
        currentStreak.push(gameData);
      } else {
        // Process previous streak if it's 3+ games
        if (currentStreak.length >= 3 && currentStreakType) {
          const streakOverlays = createStreakOverlay(
            currentStreak,
            currentStreakType,
            monthDays
          );
          if (streakOverlays && Array.isArray(streakOverlays)) {
            overlays.push(...streakOverlays);
          }
        }

        // Start new streak if this game is a win or loss
        if (gameType !== null) {
          currentStreakType = gameType;
          currentStreak = [gameData];
        } else {
          currentStreakType = null;
          currentStreak = [];
        }
      }

      // Process final streak
      if (
        index === monthGames.length - 1 &&
        currentStreak.length >= 3 &&
        currentStreakType
      ) {
        const streakOverlays = createStreakOverlay(
          currentStreak,
          currentStreakType,
          monthDays
        );
        if (streakOverlays && Array.isArray(streakOverlays)) {
          overlays.push(...streakOverlays);
        }
      }
    });

    return overlays;
  };

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
      gameRating,
      isPlayoff,
      performance,
      gameStats
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

            {/* Enhanced WGO Performance Analytics */}
            {performance && result !== "future" && (
              <>
                <div className={styles.analyticItem}>
                  <span className={styles.label}>Goal Diff:</span>
                  <span
                    className={`${styles.value} ${performance.goalDifferential > 0 ? styles.positive : performance.goalDifferential < 0 ? styles.negative : styles.neutral}`}
                  >
                    {performance.goalDifferential > 0 ? "+" : ""}
                    {performance.goalDifferential}
                  </span>
                </div>

                <div className={styles.analyticItem}>
                  <span className={styles.label}>Shots:</span>
                  <span className={styles.value}>
                    {performance.shotsFor}-{performance.shotsAgainst}
                  </span>
                </div>

                <div className={styles.analyticItem}>
                  <span className={styles.label}>Faceoffs:</span>
                  <span
                    className={`${styles.value} ${performance.faceoffPct > 50 ? styles.positive : styles.negative}`}
                  >
                    {performance.faceoffPct.toFixed(1)}%
                  </span>
                </div>

                {performance.powerPlayPct > 0 && (
                  <div className={styles.analyticItem}>
                    <span className={styles.label}>PP%:</span>
                    <span
                      className={`${styles.value} ${performance.powerPlayPct > 20 ? styles.good : styles.average}`}
                    >
                      {performance.powerPlayPct.toFixed(1)}%
                    </span>
                  </div>
                )}

                <div className={styles.analyticItem}>
                  <span className={styles.label}>Hits:</span>
                  <span className={styles.value}>{performance.hits}</span>
                </div>

                <div className={styles.analyticItem}>
                  <span className={styles.label}>Blocks:</span>
                  <span className={styles.value}>
                    {performance.blockedShots}
                  </span>
                </div>

                <div className={styles.analyticItem}>
                  <span className={styles.label}>T/G Ratio:</span>
                  <span
                    className={`${styles.value} ${performance.takeaways > performance.giveaways ? styles.positive : styles.negative}`}
                  >
                    {performance.takeaways}/{performance.giveaways}
                  </span>
                </div>
              </>
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
            {result === "future"
              ? "Click for more details"
              : `Game ID: ${gameStats?.game_id || "N/A"}`}
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

  if (!calendarData) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <h3>Processing Calendar Data...</h3>
          <p>Analyzing game results and statistics</p>
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
              <h4>Enhanced Team Schedule Calendar</h4>
              <p>
                This calendar integrates comprehensive analytics to provide deep
                insights into team performance throughout the season.
              </p>
              <h5>Features:</h5>
              <ul>
                <li>
                  <strong>Advanced Analytics:</strong> WGO-based game results
                  with accurate home/away mapping
                </li>
                <li>
                  <strong>Streak Detection:</strong> Visual highlighting of
                  win/loss streaks (3+ games)
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

        {/* Enhanced Team Summary with Color-Coded Elements */}
        <div className={styles.teamSummary}>
          <div className={`${styles.summaryCard} ${styles.seasonRecord}`}>
            <h4>Season Record</h4>
            <div className={styles.record}>
              {calendarData.stats.wins}-{calendarData.stats.losses}-
              {calendarData.stats.otLosses}
            </div>
            <div
              className={`${styles.points} ${getLeagueRankingClass(
                standingsDetails?.league_sequence || 16,
                32
              )}`}
              data-rank={standingsDetails?.league_sequence || "?"}
            >
              {calendarData.stats.points} pts
            </div>
            <div
              className={`${styles.percentage} ${getPointsPercentageClass(
                calendarData.stats.pointPercentage / 100
              )}`}
            >
              {calendarData.stats.pointPercentage.toFixed(1)}%
            </div>
          </div>

          <div className={`${styles.summaryCard} ${styles.currentStreak}`}>
            <h4>Current Streak</h4>
            <div
              className={`${styles.streak} ${
                streakType === "win"
                  ? styles.win
                  : streakType === "loss"
                    ? styles.loss
                    : styles.neutral
              }`}
            >
              {currentStreak}
              {streakType === "win" ? "W" : streakType === "loss" ? "L" : ""}
            </div>
            <div
              className={`${styles.recentForm} ${getRecentFormClass(
                calendarData.stats.recentForm.wins,
                calendarData.stats.recentForm.wins +
                  calendarData.stats.recentForm.losses +
                  calendarData.stats.recentForm.otLosses
              )}`}
            >
              Last 10: {calendarData.stats.recentForm.wins}-
              {calendarData.stats.recentForm.losses}-
              {calendarData.stats.recentForm.otLosses}
            </div>
          </div>

          <div className={`${styles.summaryCard}`}>
            <h4>Home Record</h4>
            <div className={styles.record}>
              {calendarData.stats.homeRecord.wins}-
              {calendarData.stats.homeRecord.losses}-
              {calendarData.stats.homeRecord.otLosses}
            </div>
            <div
              className={`${styles.points} ${getDifferentialClass(
                (standingsDetails?.home_goals_for || 0) -
                  (standingsDetails?.home_goals_against || 0)
              )}`}
            >
              {standingsDetails?.home_goals_for ||
                calendarData.stats.homePerformance.avgGoalsFor.toFixed(1)}{" "}
              GF
            </div>
            <div
              className={`${styles.points} ${getDifferentialClass(
                -(
                  (standingsDetails?.home_goals_against || 0) -
                  (standingsDetails?.home_goals_for || 0)
                )
              )}`}
            >
              {standingsDetails?.home_goals_against ||
                calendarData.stats.homePerformance.avgGoalsAgainst.toFixed(
                  1
                )}{" "}
              GA
            </div>
          </div>

          <div className={`${styles.summaryCard}`}>
            <h4>Away Record</h4>
            <div className={styles.record}>
              {calendarData.stats.awayRecord.wins}-
              {calendarData.stats.awayRecord.losses}-
              {calendarData.stats.awayRecord.otLosses}
            </div>
            <div
              className={`${styles.points} ${getDifferentialClass(
                (standingsDetails?.road_goals_for || 0) -
                  (standingsDetails?.road_goals_against || 0)
              )}`}
            >
              {standingsDetails?.road_goals_for ||
                calendarData.stats.awayPerformance.avgGoalsFor.toFixed(1)}{" "}
              GF
            </div>
            <div
              className={`${styles.points} ${getDifferentialClass(
                -(
                  (standingsDetails?.road_goals_against || 0) -
                  (standingsDetails?.road_goals_for || 0)
                )
              )}`}
            >
              {standingsDetails?.road_goals_against ||
                calendarData.stats.awayPerformance.avgGoalsAgainst.toFixed(
                  1
                )}{" "}
              GA
            </div>
          </div>

          <div className={`${styles.summaryCard} ${styles.goalDifferential}`}>
            <h4>Goal Differential</h4>
            <div className={styles.record}>
              {standingsDetails?.goal_for ||
                Math.round(
                  calendarData.stats.avgGoalsFor *
                    (calendarData.stats.wins +
                      calendarData.stats.losses +
                      calendarData.stats.otLosses)
                )}{" "}
              -{" "}
              {standingsDetails?.goal_against ||
                Math.round(
                  calendarData.stats.avgGoalsAgainst *
                    (calendarData.stats.wins +
                      calendarData.stats.losses +
                      calendarData.stats.otLosses)
                )}
            </div>
            <div
              className={`${styles.points} ${getDifferentialClass(
                standingsDetails?.goal_differential ||
                  calendarData.stats.avgGoalsFor -
                    calendarData.stats.avgGoalsAgainst
              )}`}
            >
              {standingsDetails?.goal_differential !== undefined
                ? (standingsDetails.goal_differential > 0 ? "+" : "") +
                  standingsDetails.goal_differential
                : (calendarData.stats.avgGoalsFor -
                    calendarData.stats.avgGoalsAgainst >
                  0
                    ? "+"
                    : "") +
                  (
                    calendarData.stats.avgGoalsFor -
                    calendarData.stats.avgGoalsAgainst
                  ).toFixed(1)}
            </div>
            {/* Enhanced differential breakdown */}
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              <div
                className={`${styles.points} ${getDifferentialClass(
                  (standingsDetails?.home_goals_for || 0) -
                    (standingsDetails?.home_goals_against || 0)
                )}`}
                style={{ fontSize: "10px", padding: "2px 4px" }}
              >
                H:{" "}
                {standingsDetails
                  ? ((standingsDetails.home_goals_for || 0) -
                      (standingsDetails.home_goals_against || 0) >
                    0
                      ? "+"
                      : "") +
                    ((standingsDetails.home_goals_for || 0) -
                      (standingsDetails.home_goals_against || 0))
                  : "N/A"}
              </div>
              <div
                className={`${styles.points} ${getDifferentialClass(
                  (standingsDetails?.road_goals_for || 0) -
                    (standingsDetails?.road_goals_against || 0)
                )}`}
                style={{ fontSize: "10px", padding: "2px 4px" }}
              >
                A:{" "}
                {standingsDetails
                  ? ((standingsDetails.road_goals_for || 0) -
                      (standingsDetails.road_goals_against || 0) >
                    0
                      ? "+"
                      : "") +
                    ((standingsDetails.road_goals_for || 0) -
                      (standingsDetails.road_goals_against || 0))
                  : "N/A"}
              </div>
            </div>
          </div>
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
                    {/* Render streak overlays first (behind the cells) */}
                    {calculateStreakOverlays(month.days).map(
                      (overlay, overlayIndex) => {
                        const overlayClasses = [
                          styles.streakOverlay,
                          styles[overlay.type]
                        ];

                        // Add truncation classes for special border styling
                        if (overlay.isExtended) {
                          overlayClasses.push(styles.streakExtended);
                        }
                        if (overlay.isTruncatedLeft) {
                          overlayClasses.push(styles.streakTruncatedLeft);
                        }
                        if (overlay.isTruncatedRight) {
                          overlayClasses.push(styles.streakTruncatedRight);
                        }

                        return (
                          <div
                            key={`overlay-${overlayIndex}`}
                            className={overlayClasses.join(" ")}
                            style={overlay.style}
                            title={`${overlay.type === "winStreak" ? "Win" : "Loss"} Streak: ${overlay.games.length} games${overlay.isExtended ? " (extended)" : ""}`}
                          />
                        );
                      }
                    )}

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

                          // Streak highlighting - now just subtle background tinting
                          if (isPartOfStreak && streakType) {
                            if (streakType === "win") {
                              classes.push(styles.streakWin);
                            } else if (streakType === "loss") {
                              classes.push(styles.streakLoss);
                            }
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

        {/* Enhanced Sidebar Container - Always Present */}
        <div className={styles.sidebarContainer}>
          {/* Game Stats Sidebar - Shows at top when game selected */}
          {selectedGame && (
            <EnhancedGameStatsSidebar
              game={selectedGame}
              gameData={gamesWithResults.find(
                (g) => g.game.id === selectedGame.id
              )}
              onClose={() => setSelectedGame(null)}
              teamId={teamId}
              teamAbbr={teamAbbr}
            />
          )}

          {/* Calendar Sidebar - Always present, slides down when game selected */}
          {calendarData.stats && (
            <div
              className={`${styles.calendarSidebar} ${selectedGame ? styles.withGameStats : ""}`}
            >
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
                      <span
                        className={`${styles.statValue} ${getPercentageClass(calendarData.stats.winPercentage)}`}
                      >
                        {calendarData.stats.winPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Point %</span>
                      <span
                        className={`${styles.statValue} ${getPercentageClass(calendarData.stats.pointPercentage)}`}
                      >
                        {calendarData.stats.pointPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Enhanced WGO Performance Analytics */}
                <div className={styles.statGroup}>
                  <h4>Performance Metrics</h4>
                  <div className={styles.statItems}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Goals For/Game</span>
                      <span
                        className={`${styles.statValue} ${getGoalDiffClass(calendarData.stats.avgGoalsFor)}`}
                      >
                        {calendarData.stats.avgGoalsFor.toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>
                        Goals Against/Game
                      </span>
                      <span
                        className={`${styles.statValue} ${getGoalDiffClass(-calendarData.stats.avgGoalsAgainst)}`}
                      >
                        {calendarData.stats.avgGoalsAgainst.toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Shot Diff/Game</span>
                      <span
                        className={`${styles.statValue} ${getGoalDiffClass(calendarData.stats.avgShotsFor - calendarData.stats.avgShotsAgainst)}`}
                      >
                        {calendarData.stats.avgShotsFor -
                          calendarData.stats.avgShotsAgainst >
                        0
                          ? "+"
                          : ""}
                        {(
                          calendarData.stats.avgShotsFor -
                          calendarData.stats.avgShotsAgainst
                        ).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Enhanced: Add standings details if available */}
                {standingsDetails && (
                  <>
                    <div className={styles.statGroup}>
                      <h4>Standings Snapshot</h4>
                      <div className={styles.statItems}>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Games Played</span>
                          <span className={styles.statValue}>
                            {standingsDetails.games_played ?? "-"}
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Points</span>
                          <span className={styles.statValue}>
                            {standingsDetails.points ?? "-"}
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Goal Diff</span>
                          <span className={styles.statValue}>
                            {standingsDetails.goal_differential !== undefined &&
                            standingsDetails.goal_differential !== null &&
                            standingsDetails.goal_differential > 0
                              ? "+"
                              : ""}
                            {standingsDetails.goal_differential ?? "-"}
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Streak</span>
                          <span className={styles.statValue}>
                            {standingsDetails.streak_count ?? ""}
                            {standingsDetails.streak_code ?? ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.statGroup}>
                      <h4>Last 10 Games</h4>
                      <div className={styles.statItems}>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Record</span>
                          <span className={styles.statValue}>
                            {standingsDetails.l10_wins ?? "-"}-
                            {standingsDetails.l10_losses ?? "-"}-
                            {standingsDetails.l10_ot_losses ?? "-"}
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Points</span>
                          <span className={styles.statValue}>
                            {standingsDetails.l10_points ?? "-"}
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Goal Diff</span>
                          <span className={styles.statValue}>
                            {standingsDetails.l10_goal_differential !== null &&
                            standingsDetails.l10_goal_differential !== undefined
                              ? (standingsDetails.l10_goal_differential > 0
                                  ? "+"
                                  : "") + standingsDetails.l10_goal_differential
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Tooltip */}
      {hoveredGame && renderGameTooltip()}
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

// Add helper functions for determining color classes based on league rankings, goal differential, recent form, and points percentage.
const getPointsClass = (points: number) => {
  if (points >= 100) return "excellent";
  if (points >= 90) return "good";
  if (points >= 80) return "average";
  return "poor";
};

const getPercentageClass = (percentage: number) => {
  if (percentage >= 60) return "excellent";
  if (percentage >= 50) return "good";
  if (percentage >= 40) return "average";
  return "poor";
};

const getRecentFormClass = (wins: number, total: number = 10): string => {
  const winRate = wins / total;
  if (winRate >= 0.7) return "hotStreak topTier";
  if (winRate >= 0.6) return "upperTier";
  if (winRate >= 0.4) return "middleTier";
  if (winRate >= 0.3) return "lowerTier";
  return "coldStreak bottomTier";
};

const getGoalDiffClass = (diff: number) => {
  if (diff > 0.5) return "positive";
  if (diff < -0.5) return "negative";
  return "neutral";
};

// Helper function to get league ranking color class based on standings
const getLeagueRankingClass = (rank: number, total: number = 32): string => {
  if (!rank || !total) return "middleTier";

  const percentile = (rank / total) * 100;

  if (percentile <= 15) return "topTier"; // Top 5 teams
  if (percentile <= 35) return "upperTier"; // Top 11 teams
  if (percentile <= 65) return "middleTier"; // Middle teams
  if (percentile <= 85) return "lowerTier"; // Lower teams
  return "bottomTier"; // Bottom 5 teams
};

// Helper function to get differential class for goal differential
const getDifferentialClass = (differential: number): string => {
  if (differential >= 20) return "strongPositive";
  if (differential >= 10) return "positive";
  if (differential >= 5) return "slightlyPositive";
  if (differential <= -20) return "strongNegative";
  if (differential <= -10) return "negative";
  if (differential <= -5) return "slightlyNegative";
  return "neutral";
};

// Helper function to get points percentage class
const getPointsPercentageClass = (pointPct: number): string => {
  if (pointPct >= 0.65) return "topTier";
  if (pointPct >= 0.55) return "upperTier";
  if (pointPct >= 0.45) return "middleTier";
  if (pointPct >= 0.35) return "lowerTier";
  return "bottomTier";
};
