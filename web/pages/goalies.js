// /Users/tim/Desktop/fhfhockey.com/web/pages/goalies.js

import React, { useEffect, useMemo, useState } from "react";
import Fetch from "lib/cors-fetch";
import supabase from "lib/supabase";
import GoalieList from "components/GoaliePage/GoalieList";
import GoalieTable from "components/GoaliePage/GoalieTable";
import GoalieLeaderboard from "components/GoaliePage/GoalieLeaderboard";
import GoalieAdvancedMetricsTable from "components/GoaliePage/GoalieAdvancedMetricsTable";
import { calculateGoalieRankings as calculateRichGoalieRankings } from "components/GoaliePage/goalieCalculations";
import { parseMinimumGamesPlayedInput } from "components/Variance/varianceFilters";
import {
  GOALIE_ADVANCED_METRICS_SELECT,
  GOALIE_ADVANCED_STRENGTH_OPTIONS,
  applyGoalieValueTiers,
  buildGoalieAdvancedMetricsRows
} from "components/GoaliePage/goalieMetrics";

import styles from "styles/Goalies.module.scss";
import {
  parseISO,
  eachWeekOfInterval,
  endOfWeek,
  addDays,
  format,
  startOfWeek
} from "date-fns";

const statColumns = [
  { label: "GP", value: "gamesPlayed" },
  { label: "GS", value: "gamesStarted" },
  { label: "W", value: "wins" },
  { label: "L", value: "losses" },
  { label: "OTL", value: "otLosses" },
  { label: "SV", value: "saves" },
  { label: "SA", value: "shotsAgainst" },
  { label: "GA", value: "goalsAgainst" },
  { label: "SV%", value: "savePct" },
  { label: "GAA", value: "goalsAgainstAverage" },
  { label: "SO", value: "shutouts" },
  { label: "TOI", value: "timeOnIce" }
];

const defaultSelectedStats = ["saves", "savePct", "wins"];

const leaderboardStatColumns = [
  {
    label: "GP",
    value: "gamesPlayed",
    dbFieldGoalie: "weekly_gp",
    dbFieldAverage: "avg_league_weekly_gp"
  },
  {
    label: "GS",
    value: "gamesStarted",
    dbFieldGoalie: "weekly_gs",
    dbFieldAverage: "avg_league_weekly_gs"
  },
  {
    label: "W",
    value: "wins",
    dbFieldGoalie: "weekly_wins",
    dbFieldAverage: "avg_league_weekly_wins",
    fantasyStatKey: "win"
  },
  {
    label: "L",
    value: "losses",
    dbFieldGoalie: "weekly_losses",
    dbFieldAverage: "avg_league_weekly_losses"
  },
  {
    label: "OTL",
    value: "otLosses",
    dbFieldGoalie: "weekly_ot_losses",
    dbFieldAverage: "avg_league_weekly_ot_losses"
  },
  {
    label: "SV",
    value: "saves",
    dbFieldGoalie: "weekly_saves",
    dbFieldAverage: "avg_league_weekly_saves",
    fantasyStatKey: "save"
  },
  {
    label: "SA",
    value: "shotsAgainst",
    dbFieldGoalie: "weekly_sa",
    dbFieldAverage: "avg_league_weekly_sa"
  },
  {
    label: "GA",
    value: "goalsAgainst",
    dbFieldGoalie: "weekly_ga",
    dbFieldAverage: "avg_league_weekly_ga",
    fantasyStatKey: "goalAgainst"
  },
  {
    label: "SV%",
    value: "savePct",
    dbFieldGoalie: "weekly_sv_pct",
    dbFieldAverage: "avg_league_weekly_sv_pct",
    dbFieldRate: true
  },
  {
    label: "GAA",
    value: "goalsAgainstAverage",
    dbFieldGoalie: "weekly_gaa",
    dbFieldAverage: "avg_league_weekly_gaa",
    dbFieldRate: true
  },
  {
    label: "SO",
    value: "shutouts",
    dbFieldGoalie: "weekly_so",
    dbFieldAverage: "avg_league_weekly_so",
    fantasyStatKey: "shutout"
  },
  {
    label: "TOI",
    value: "timeOnIce",
    dbFieldGoalie: "weekly_toi_seconds",
    dbFieldAverage: "avg_league_weekly_toi_seconds"
  }
];

const DEFAULT_FANTASY_SETTINGS = {
  goalAgainst: -1,
  save: 0.2,
  shutout: 3,
  win: 4
};

const NHL_PAGE_SIZE = 100;

const fetchNhlData = async (url) => {
  const payload = await Fetch(url).then((res) => res.json());

  if (payload?.success === false) {
    throw new Error(payload.message || "NHL request failed");
  }

  if (!Array.isArray(payload?.data)) {
    throw new Error("Unexpected NHL response payload");
  }

  return payload.data;
};

const fetchAllNhlPages = async (buildUrl) => {
  let start = 0;
  let allRows = [];

  while (true) {
    const pageRows = await fetchNhlData(buildUrl(start, NHL_PAGE_SIZE));
    allRows = allRows.concat(pageRows);

    if (pageRows.length < NHL_PAGE_SIZE) {
      break;
    }

    start += NHL_PAGE_SIZE;
  }

  return allRows;
};

const formatApiDateTime = (value) =>
  format(new Date(value), "yyyy-MM-dd HH:mm:ss");

const buildWeeklySummaryUrl = (weekRange, start, limit) =>
  `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${formatApiDateTime(
    weekRange.end
  )}%22%20and%20gameDate%3E=%22${formatApiDateTime(
    weekRange.start
  )}%22%20and%20gameTypeId=2`;

const buildGameSummaryUrl = (startDate, endDate, start, limit) =>
  `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22gameDate%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${formatApiDateTime(
    endDate
  )}%22%20and%20gameDate%3E=%22${formatApiDateTime(
    startDate
  )}%22%20and%20gameTypeId=2`;

const mapWeeklyApiRow = (row, weekRange, weekNumber, matchupSeason) => ({
  matchup_season: matchupSeason,
  week: weekNumber,
  week_start_date: format(new Date(weekRange.start), "yyyy-MM-dd"),
  week_end_date: format(new Date(weekRange.end), "yyyy-MM-dd"),
  goalie_id: row.playerId ?? null,
  goalie_name: row.goalieFullName ?? null,
  team: row.teamAbbrev ?? null,
  goalie_game_season: null,
  weekly_gp: row.gamesPlayed ?? null,
  weekly_gs: row.gamesStarted ?? null,
  weekly_wins: row.wins ?? null,
  weekly_losses: row.losses ?? null,
  weekly_ot_losses: row.otLosses ?? null,
  weekly_saves: row.saves ?? null,
  weekly_sa: row.shotsAgainst ?? null,
  weekly_ga: row.goalsAgainst ?? null,
  weekly_so: row.shutouts ?? null,
  weekly_toi_seconds: row.timeOnIce ?? null,
  weekly_sv_pct: row.savePct ?? null,
  weekly_gaa: row.goalsAgainstAverage ?? null,
  weekly_saves_per_60: null,
  weekly_sa_per_60: null
});

const buildLeagueWeeklyAverage = (rows, weekNumber, matchupSeason) => {
  if (!rows.length) {
    return null;
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.gamesPlayed += row.gamesPlayed ?? 0;
      acc.gamesStarted += row.gamesStarted ?? 0;
      acc.wins += row.wins ?? 0;
      acc.losses += row.losses ?? 0;
      acc.otLosses += row.otLosses ?? 0;
      acc.saves += row.saves ?? 0;
      acc.shotsAgainst += row.shotsAgainst ?? 0;
      acc.goalsAgainst += row.goalsAgainst ?? 0;
      acc.shutouts += row.shutouts ?? 0;
      acc.timeOnIce += row.timeOnIce ?? 0;
      return acc;
    },
    {
      gamesPlayed: 0,
      gamesStarted: 0,
      wins: 0,
      losses: 0,
      otLosses: 0,
      saves: 0,
      shotsAgainst: 0,
      goalsAgainst: 0,
      shutouts: 0,
      timeOnIce: 0
    }
  );

  const goalieCount = rows.length;

  return {
    matchup_season: matchupSeason,
    week: weekNumber,
    total_league_saves: totals.saves,
    total_league_sa: totals.shotsAgainst,
    total_league_ga: totals.goalsAgainst,
    total_league_toi_seconds: totals.timeOnIce,
    avg_league_weekly_gp:
      goalieCount > 0 ? totals.gamesPlayed / goalieCount : 0,
    avg_league_weekly_gs:
      goalieCount > 0 ? totals.gamesStarted / goalieCount : 0,
    avg_league_weekly_wins: goalieCount > 0 ? totals.wins / goalieCount : 0,
    avg_league_weekly_losses: goalieCount > 0 ? totals.losses / goalieCount : 0,
    avg_league_weekly_ot_losses:
      goalieCount > 0 ? totals.otLosses / goalieCount : 0,
    avg_league_weekly_saves: goalieCount > 0 ? totals.saves / goalieCount : 0,
    avg_league_weekly_sa:
      goalieCount > 0 ? totals.shotsAgainst / goalieCount : 0,
    avg_league_weekly_ga:
      goalieCount > 0 ? totals.goalsAgainst / goalieCount : 0,
    avg_league_weekly_so: goalieCount > 0 ? totals.shutouts / goalieCount : 0,
    avg_league_weekly_toi_seconds:
      goalieCount > 0 ? totals.timeOnIce / goalieCount : 0,
    avg_league_weekly_sv_pct:
      totals.shotsAgainst > 0 ? totals.saves / totals.shotsAgainst : 0,
    avg_league_weekly_gaa:
      totals.timeOnIce > 0
        ? (totals.goalsAgainst * 3600) / totals.timeOnIce
        : 0,
    avg_league_weekly_saves_per_60: 0,
    avg_league_weekly_sa_per_60: 0
  };
};

const mapGameApiRow = (row) => ({
  goalie_id: row.playerId,
  goalie_name: row.goalieFullName,
  team: row.teamAbbrev ?? null,
  date: row.gameDate,
  games_played: row.gamesPlayed ?? 1,
  games_started: row.gamesStarted ?? 0,
  wins: row.wins ?? 0,
  losses: row.losses ?? 0,
  ot_losses: row.otLosses ?? 0,
  save_pct: row.savePct ?? 0,
  saves: row.saves ?? 0,
  goals_against: row.goalsAgainst ?? 0,
  goals_against_avg: row.goalsAgainstAverage ?? 0,
  shots_against: row.shotsAgainst ?? 0,
  time_on_ice: row.timeOnIce ?? 0,
  shutouts: row.shutouts ?? 0,
  goals: row.goals ?? 0,
  assists: row.assists ?? 0
});

const buildLeaderboardRankings = async (weekRanges, selectedStats) => {
  if (!weekRanges.length) {
    return [];
  }

  const matchupSeason = String(new Date(weekRanges[0].start).getFullYear());
  const weeklyPayloads = await Promise.all(
    weekRanges.map((weekRange) =>
      fetchAllNhlPages((start, limit) =>
        buildWeeklySummaryUrl(weekRange, start, limit)
      )
    )
  );

  const goalieWeeklyData = [];
  const leagueWeeklyAverages = [];

  weeklyPayloads.forEach((rows, index) => {
    const weekRange = weekRanges[index];
    goalieWeeklyData.push(
      ...rows.map((row) =>
        mapWeeklyApiRow(row, weekRange, weekRange.week, matchupSeason)
      )
    );

    const averageRow = buildLeagueWeeklyAverage(
      rows,
      weekRange.week,
      matchupSeason
    );

    if (averageRow) {
      leagueWeeklyAverages.push(averageRow);
    }
  });

  const firstWeek = weekRanges[0];
  const lastWeek = weekRanges[weekRanges.length - 1];
  const goalieGameData = await fetchAllNhlPages((start, limit) =>
    buildGameSummaryUrl(firstWeek.start, lastWeek.end, start, limit)
  );

  return calculateRichGoalieRankings(
    goalieWeeklyData,
    leagueWeeklyAverages,
    goalieGameData.map(mapGameApiRow),
    selectedStats,
    leaderboardStatColumns,
    firstWeek.week,
    lastWeek.week,
    DEFAULT_FANTASY_SETTINGS
  );
};

const decorateGoalieRanking = (goalie) => ({
  ...goalie,
  eliteWeeks: goalie.weekCounts?.Elite ?? 0,
  qualityWeeks: goalie.weekCounts?.Quality ?? 0,
  averageWeeks: goalie.weekCounts?.Average ?? 0,
  badWeeks: goalie.weekCounts?.Bad ?? 0,
  reallyBadWeeks: goalie.weekCounts?.["Really Bad"] ?? 0,
  fantasyPointsAboveAverage:
    goalie.leagueAverageFantasyPointsPerGame !== undefined
      ? goalie.averageFantasyPointsPerGame -
        goalie.leagueAverageFantasyPointsPerGame
      : Number.NEGATIVE_INFINITY
});

const leaderboardSortAccessors = {
  totalPoints: (goalie) => goalie.totalPoints ?? 0,
  goalieFullName: (goalie) => goalie.goalieFullName ?? "",
  team: (goalie) => goalie.team ?? "",
  eliteWeeks: (goalie) => goalie.eliteWeeks ?? 0,
  qualityWeeks: (goalie) => goalie.qualityWeeks ?? 0,
  averageWeeks: (goalie) => goalie.averageWeeks ?? 0,
  badWeeks: (goalie) => goalie.badWeeks ?? 0,
  reallyBadWeeks: (goalie) => goalie.reallyBadWeeks ?? 0,
  percentAcceptableWeeks: (goalie) => goalie.percentAcceptableWeeks ?? 0,
  percentGoodWeeks: (goalie) => goalie.percentGoodWeeks ?? 0,
  wowVariance: (goalie) => goalie.wowVariance ?? Number.POSITIVE_INFINITY,
  gogVariance: (goalie) => goalie.gogVariance ?? Number.POSITIVE_INFINITY,
  valueTierScore: (goalie) => goalie.valueTierScore ?? Number.NEGATIVE_INFINITY,
  averageFantasyPointsPerGame: (goalie) =>
    goalie.averageFantasyPointsPerGame ?? 0,
  fantasyPointsAboveAverage: (goalie) =>
    goalie.fantasyPointsAboveAverage ?? Number.NEGATIVE_INFINITY,
  averagePercentileRank: (goalie) => goalie.averagePercentileRank ?? 0,
  totalGamesPlayed: (goalie) => goalie.totalGamesPlayed ?? 0,
  overallSavePct: (goalie) => goalie.overallSavePct ?? 0,
  overallGaa: (goalie) => goalie.overallGaa ?? Number.POSITIVE_INFINITY,
  gamesPlayed: (goalie) => goalie.totalGamesPlayed ?? 0,
  gamesStarted: (goalie) => goalie.totalGamesStarted ?? 0,
  wins: (goalie) => goalie.totalWins ?? 0,
  losses: (goalie) => goalie.totalLosses ?? 0,
  otLosses: (goalie) => goalie.totalOtLosses ?? 0,
  saves: (goalie) => goalie.totalSaves ?? 0,
  shotsAgainst: (goalie) => goalie.totalShotsAgainst ?? 0,
  goalsAgainst: (goalie) => goalie.totalGoalsAgainst ?? 0,
  shutouts: (goalie) => goalie.totalShutouts ?? 0,
  timeOnIce: (goalie) => goalie.totalTimeOnIce ?? 0,
  savePct: (goalie) => goalie.overallSavePct ?? 0,
  goalsAgainstAverage: (goalie) =>
    goalie.overallGaa ?? Number.POSITIVE_INFINITY,
  savesPer60: (goalie) =>
    goalie.totalTimeOnIce > 0
      ? ((goalie.totalSaves ?? 0) / goalie.totalTimeOnIce) * 60
      : 0,
  shotsAgainstPer60: (goalie) =>
    goalie.totalTimeOnIce > 0
      ? ((goalie.totalShotsAgainst ?? 0) / goalie.totalTimeOnIce) * 60
      : 0
};

const mapRankingToGoalieTableRow = (goalie) => {
  const totalTimeOnIce = goalie.totalTimeOnIce ?? 0;

  return {
    playerId: goalie.playerId,
    goalieFullName: goalie.goalieFullName ?? "Unknown Goalie",
    team: goalie.team,
    gamesPlayed: goalie.totalGamesPlayed ?? 0,
    gamesStarted: goalie.totalGamesStarted ?? 0,
    wins: goalie.totalWins ?? 0,
    losses: goalie.totalLosses ?? 0,
    otLosses: goalie.totalOtLosses ?? 0,
    saves: goalie.totalSaves ?? 0,
    shotsAgainst: goalie.totalShotsAgainst ?? 0,
    goalsAgainst: goalie.totalGoalsAgainst ?? 0,
    shutouts: goalie.totalShutouts ?? 0,
    timeOnIce: totalTimeOnIce,
    savePct: goalie.overallSavePct,
    goalsAgainstAverage: goalie.overallGaa,
    savesPer60:
      totalTimeOnIce > 0 ? ((goalie.totalSaves ?? 0) / totalTimeOnIce) * 60 : 0,
    shotsAgainstPer60:
      totalTimeOnIce > 0
        ? ((goalie.totalShotsAgainst ?? 0) / totalTimeOnIce) * 60
        : 0
  };
};

const buildRangeGoalieAverages = (goalies) => {
  const totals = goalies.reduce(
    (acc, goalie) => {
      acc.gamesPlayed += goalie.totalGamesPlayed ?? 0;
      acc.gamesStarted += goalie.totalGamesStarted ?? 0;
      acc.wins += goalie.totalWins ?? 0;
      acc.losses += goalie.totalLosses ?? 0;
      acc.otLosses += goalie.totalOtLosses ?? 0;
      acc.saves += goalie.totalSaves ?? 0;
      acc.shotsAgainst += goalie.totalShotsAgainst ?? 0;
      acc.goalsAgainst += goalie.totalGoalsAgainst ?? 0;
      acc.shutouts += goalie.totalShutouts ?? 0;
      acc.timeOnIce += goalie.totalTimeOnIce ?? 0;
      return acc;
    },
    {
      gamesPlayed: 0,
      gamesStarted: 0,
      wins: 0,
      losses: 0,
      otLosses: 0,
      saves: 0,
      shotsAgainst: 0,
      goalsAgainst: 0,
      shutouts: 0,
      timeOnIce: 0
    }
  );
  const goalieCount = goalies.length || 1;
  const average = (value) => value / goalieCount;

  return {
    gamesPlayed: average(totals.gamesPlayed).toFixed(1),
    gamesStarted: average(totals.gamesStarted).toFixed(1),
    wins: average(totals.wins).toFixed(1),
    losses: average(totals.losses).toFixed(1),
    otLosses: average(totals.otLosses).toFixed(1),
    saves: average(totals.saves).toFixed(1),
    shotsAgainst: average(totals.shotsAgainst).toFixed(1),
    goalsAgainst: average(totals.goalsAgainst).toFixed(1),
    shutouts: average(totals.shutouts).toFixed(1),
    timeOnIce: average(totals.timeOnIce).toFixed(1),
    savePct:
      totals.shotsAgainst > 0
        ? (totals.saves / totals.shotsAgainst).toFixed(3)
        : "N/A",
    goalsAgainstAverage:
      totals.timeOnIce > 0
        ? ((totals.goalsAgainst / totals.timeOnIce) * 60).toFixed(2)
        : "N/A",
    savesPer60:
      totals.timeOnIce > 0
        ? ((totals.saves / totals.timeOnIce) * 60).toFixed(2)
        : "N/A",
    shotsAgainstPer60:
      totals.timeOnIce > 0
        ? ((totals.shotsAgainst / totals.timeOnIce) * 60).toFixed(2)
        : "N/A"
  };
};

const GoalieTrends = () => {
  const [season, setSeason] = useState(null);
  const [seasonId, setSeasonId] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedStats, setSelectedStats] = useState(defaultSelectedStats);
  const [goalieRankings, setGoalieRankings] = useState([]);
  const [singleWeekGoalieData, setSingleWeekGoalieData] = useState([]);
  const [singleWeekLeagueAverage, setSingleWeekLeagueAverage] = useState(null);
  const [view, setView] = useState("leaderboard");
  const [selectedRange, setSelectedRange] = useState({ start: 0, end: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useSingleWeek, setUseSingleWeek] = useState(false); // Set default to date range
  const [fetchData, setFetchData] = useState(false); // Control data fetch
  const [pendingWeeklyView, setPendingWeeklyView] = useState(null);
  const [minimumGamesPlayed, setMinimumGamesPlayed] = useState(0);
  const [minimumGamesPlayedInput, setMinimumGamesPlayedInput] = useState("0");
  const [minimumGamesPlayedError, setMinimumGamesPlayedError] =
    useState(null);
  const [metricsView, setMetricsView] = useState("standard");
  const [advancedGoalieMetrics, setAdvancedGoalieMetrics] = useState([]);
  const [advancedGoalieMetricsLoading, setAdvancedGoalieMetricsLoading] =
    useState(false);
  const [advancedGoalieMetricsError, setAdvancedGoalieMetricsError] =
    useState(null);
  const [varianceDisplayMode, setVarianceDisplayMode] = useState("raw");
  const [advancedMetricsStrength, setAdvancedMetricsStrength] =
    useState("all");
  const [leaderboardSortConfig, setLeaderboardSortConfig] = useState({
    key: "totalPoints",
    direction: "descending"
  });

  const viewTabs = [
    { id: "leaderboard", label: "Value Overview" },
    { id: "week", label: "Metrics" }
  ];

  useEffect(() => {
    const fetchSeasonData = async () => {
      try {
        const response = await Fetch(
          "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D"
        ).then((res) => res.json());
        let seasonData = response.data[0];
        let seasonStart = parseISO(seasonData.startDate);
        let seasonEnd = parseISO(seasonData.regularSeasonEndDate);
        const today = new Date();

        if (today < seasonStart) {
          seasonData = response.data[1];
          seasonStart = parseISO(seasonData.startDate);
          seasonEnd = parseISO(seasonData.regularSeasonEndDate);
        }

        setSeason({ start: seasonStart, end: seasonEnd });
        setSeasonId(seasonData.id);

        const firstSunday = endOfWeek(seasonStart, { weekStartsOn: 1 });
        const firstWeek = {
          start: seasonStart,
          end: firstSunday
        };

        const remainingWeeks = eachWeekOfInterval({
          start: addDays(firstSunday, 7),
          end: seasonEnd
        }).map((weekStart) => ({
          start: startOfWeek(weekStart, { weekStartsOn: 1 }),
          end: endOfWeek(weekStart, { weekStartsOn: 1 })
        }));

        const allWeeks = [firstWeek, ...remainingWeeks];

        setWeeks(
          allWeeks.map((week, index) => ({
            label: `Week ${index + 1} || ${format(
              week.start,
              "MM/dd/yyyy"
            )} - ${format(week.end, "MM/dd/yyyy")}`,
            value: week
          }))
        );
        setSelectedWeek(allWeeks[0]);
        setSelectedRange({ start: 0, end: allWeeks.length - 1 });

        const goalieRankings = await buildLeaderboardRankings(
          allWeeks.map((week, index) => ({ ...week, week: index + 1 })),
          selectedStats
        );
        setGoalieRankings(goalieRankings.map(decorateGoalieRanking));
      } catch (error) {
        console.error("Error fetching season data:", error);
      }
    };

    fetchSeasonData();
  }, [selectedStats]); // Include selectedStats so rankings recompute if user changes stat set

  useEffect(() => {
    if (!seasonId) {
      return;
    }

    const fetchAdvancedGoalieMetrics = async () => {
      setAdvancedGoalieMetricsLoading(true);
      setAdvancedGoalieMetricsError(null);

      try {
        // Advanced metrics use Supabase season rows only; leaderboard rankings
        // still come from the NHL API game-log flow below.
        const { data, error } = await supabase
          .from("goalie_stats_unified")
          .select(GOALIE_ADVANCED_METRICS_SELECT)
          .eq("season_id", seasonId);

        if (error) {
          throw error;
        }

        setAdvancedGoalieMetrics(buildGoalieAdvancedMetricsRows(data ?? []));
      } catch (error) {
        console.error("Error fetching advanced goalie metrics:", error);
        setAdvancedGoalieMetrics([]);
        setAdvancedGoalieMetricsError("Advanced goalie metrics unavailable.");
      } finally {
        setAdvancedGoalieMetricsLoading(false);
      }
    };

    fetchAdvancedGoalieMetrics();
  }, [seasonId]);

  useEffect(() => {
    if (!fetchData || !selectedWeek) return;

    const fetchGoalies = async () => {
      setLoading(true);
      try {
        const weekIndex = weeks.findIndex(
          (week) =>
            week.value.start.getTime() === selectedWeek.start.getTime() &&
            week.value.end.getTime() === selectedWeek.end.getTime()
        );
        const weekNumber = weekIndex >= 0 ? weekIndex + 1 : 1;
        const responseRows = await fetchAllNhlPages((start, limit) =>
          buildWeeklySummaryUrl(
            {
              start: selectedWeek.start,
              end: selectedWeek.end,
              week: weekNumber
            },
            start,
            limit
          )
        );

        setSingleWeekGoalieData(
          responseRows.map((row) =>
            mapWeeklyApiRow(
              row,
              { start: selectedWeek.start, end: selectedWeek.end },
              weekNumber,
              String(new Date(selectedWeek.start).getFullYear())
            )
          )
        );
        setSingleWeekLeagueAverage(
          buildLeagueWeeklyAverage(
            responseRows,
            weekNumber,
            String(new Date(selectedWeek.start).getFullYear())
          )
        );
        const targetView = pendingWeeklyView ?? "week";
        setView(targetView);
        setPendingWeeklyView(null);
      } catch (error) {
        console.error("Error fetching goalie data:", error);
        setError("Error fetching data");
      } finally {
        setLoading(false);
        setFetchData(false);
      }
    };

    fetchGoalies();
  }, [fetchData, pendingWeeklyView, selectedStats, selectedWeek, view, weeks]);

  const handleSurfaceTabClick = (tabId) => {
    if (tabId === "leaderboard") {
      setPendingWeeklyView(null);
      setView("leaderboard");
      return;
    }

    if (useSingleWeek) {
      setPendingWeeklyView(tabId);

      if (!selectedWeek && weeks.length > 0) {
        setSelectedWeek(weeks[0].value);
      }

      setFetchData(true);
      return;
    }

    if (goalieRankings.length === 0) {
      handleRangeSubmit(tabId);
      return;
    }

    setView(tabId);
  };

  const handleWeekChange = (event) => {
    setSelectedWeek(weeks[event.target.value].value);
  };

  const handleMinimumGamesChange = (event) => {
    const nextValue = event.target.value;
    setMinimumGamesPlayedInput(nextValue);
    const parsed = parseMinimumGamesPlayedInput(
      nextValue,
      minimumGamesPlayed
    );
    setMinimumGamesPlayed(parsed.minimumGamesPlayed);
    setMinimumGamesPlayedError(parsed.error);
  };

  const handleStatChange = (event) => {
    const { value, checked } = event.target;
    setSelectedStats((prevSelectedStats) =>
      checked
        ? [...prevSelectedStats, value]
        : prevSelectedStats.filter((stat) => stat !== value)
    );
    setFetchData(true);
  };

  const handleRangeChange = (start, end) => {
    setSelectedRange({ start, end });
  };

  const handleSingleWeekSubmit = async (targetView = view) => {
    const activeWeek = selectedWeek ?? weeks[0]?.value;

    if (!activeWeek) {
      return;
    }

    setSelectedWeek(activeWeek);
    setLoading(true);

    try {
      const weekIndex = weeks.findIndex(
        (week) =>
          week.value.start.getTime() === activeWeek.start.getTime() &&
          week.value.end.getTime() === activeWeek.end.getTime()
      );
      const weekNumber = weekIndex >= 0 ? weekIndex + 1 : 1;
      const goalieRankings = await buildLeaderboardRankings(
        [
          {
            start: activeWeek.start,
            end: activeWeek.end,
            week: weekNumber
          }
        ],
        selectedStats
      );

      setGoalieRankings(goalieRankings.map(decorateGoalieRanking));

      if (targetView === "week") {
        setPendingWeeklyView("week");
        setFetchData(true);
      } else {
        setPendingWeeklyView(null);
        setView("leaderboard");
      }
    } catch (error) {
      console.error("Error fetching goalie data:", error);
      setError("Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleRangeSubmit = async (targetView = "leaderboard") => {
    setLoading(true);
    try {
      const selectedWeeks = weeks.slice(
        selectedRange.start,
        selectedRange.end + 1
      );

      const goalieRankings = await buildLeaderboardRankings(
        selectedWeeks.map((week, index) => ({
          start: week.value.start,
          end: week.value.end,
          week: selectedRange.start + index + 1
        })),
        selectedStats
      );
      setGoalieRankings(goalieRankings.map(decorateGoalieRanking));
      setPendingWeeklyView(null);
      setView(targetView);
    } catch (error) {
      console.error("Error fetching goalie data:", error);
      setError("Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaderboardSort = (key) => {
    setLeaderboardSortConfig((currentConfig) => {
      if (currentConfig.key === key) {
        return {
          key,
          direction:
            currentConfig.direction === "ascending" ? "descending" : "ascending"
        };
      }

      return {
        key,
        direction:
          key === "goalieFullName" || key === "team"
            ? "ascending"
            : "descending"
      };
    });
  };

  const thresholdFilteredGoalieRankings = useMemo(
    () =>
      goalieRankings.filter(
        (goalie) => (goalie.totalGamesPlayed ?? 0) >= minimumGamesPlayed
      ),
    [goalieRankings, minimumGamesPlayed]
  );

  const valueTierGoalieRankings = useMemo(
    () =>
      applyGoalieValueTiers(
        thresholdFilteredGoalieRankings,
        advancedGoalieMetrics
      ),
    [advancedGoalieMetrics, thresholdFilteredGoalieRankings]
  );

  const filteredGoalieRankings = useMemo(() => {
    const accessor = leaderboardSortAccessors[leaderboardSortConfig.key];

    if (!accessor) {
      return valueTierGoalieRankings;
    }

    return [...valueTierGoalieRankings].sort((a, b) => {
      const aValue = accessor(a);
      const bValue = accessor(b);

      if (typeof aValue === "string" && typeof bValue === "string") {
        const result = aValue.localeCompare(bValue);
        return leaderboardSortConfig.direction === "ascending"
          ? result
          : -result;
      }

      if (aValue < bValue) {
        return leaderboardSortConfig.direction === "ascending" ? -1 : 1;
      }

      if (aValue > bValue) {
        return leaderboardSortConfig.direction === "ascending" ? 1 : -1;
      }

      return 0;
    });
  }, [leaderboardSortConfig, valueTierGoalieRankings]);

  const filteredSingleWeekGoalieData = useMemo(
    () =>
      singleWeekGoalieData.filter(
        (goalie) => (goalie.weekly_gp ?? 0) >= minimumGamesPlayed
      ),
    [minimumGamesPlayed, singleWeekGoalieData]
  );

  const filteredAdvancedGoalieMetrics = useMemo(
    () =>
      advancedGoalieMetrics.filter(
        (goalie) => goalie.gamesPlayed >= minimumGamesPlayed
      ),
    [advancedGoalieMetrics, minimumGamesPlayed]
  );

  const rangeGoaliesForMetrics = useMemo(
    () => filteredGoalieRankings.map(mapRankingToGoalieTableRow),
    [filteredGoalieRankings]
  );

  const rangeGoalieAverages = useMemo(
    () => buildRangeGoalieAverages(filteredGoalieRankings),
    [filteredGoalieRankings]
  );

  const selectedRangeWindow = useMemo(() => {
    const selectedWeeks = weeks.slice(selectedRange.start, selectedRange.end + 1);
    return {
      startDate:
        selectedWeeks[0]?.value.start.toLocaleDateString() ?? "N/A",
      endDate:
        selectedWeeks.at(-1)?.value.end.toLocaleDateString() ?? "N/A"
    };
  }, [selectedRange.end, selectedRange.start, weeks]);

  const canShowWeeklyViews = Boolean(
    selectedWeek && singleWeekGoalieData.length > 0 && singleWeekLeagueAverage
  );

  const canShowMetricsView = useSingleWeek
    ? canShowWeeklyViews
    : rangeGoaliesForMetrics.length > 0;

  const activeView = view === "week" && !canShowMetricsView ? "leaderboard" : view;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerWrapper}>
        <h1 className={styles.pageTitle}>
          NHL <span className={styles.spanColorBlue}>Goalie</span> Stats
        </h1>
      </div>

      <div className={styles.controlsWrapper}>
        <section className={styles.controlsSection}>
          <div className={styles.sectionTitle}>Timeframe Filters</div>
          <div className={styles.timeframePanel}>
            <div className={styles.segmentRail}>
              <button
                type="button"
                className={`${styles.segment} ${
                  !useSingleWeek ? styles.segmentActive : ""
                }`}
                onClick={() => setUseSingleWeek(false)}
              >
                Date Range
              </button>
              <button
                type="button"
                className={`${styles.segment} ${
                  useSingleWeek ? styles.segmentActive : ""
                }`}
                onClick={() => setUseSingleWeek(true)}
              >
                Single Week
              </button>
            </div>

            {useSingleWeek ? (
              <div className={styles.dateSelectorContainer}>
                {weeks.length > 0 && (
                  <div className={styles.dropdownGroup}>
                    <label
                      className={styles.selectLabel}
                      htmlFor="goalies-single-week"
                    >
                      Week
                    </label>
                    <select
                      id="goalies-single-week"
                      className={styles.customSelect}
                      onChange={handleWeekChange}
                    >
                      {weeks.map((week, index) => (
                        <option key={index} value={index}>
                          {week.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  className={styles.buttonPrimary}
                  onClick={() => handleSingleWeekSubmit(activeView)}
                >
                  Apply Week
                </button>
                <p className={styles.selectorNote}>
                  Adapted from the
                  <a
                    href="https://dobberhockey.com/2024/05/19/geek-of-the-week-true-goalie-value-season-recap/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.hyperlink}
                  >
                    True Goalie Value
                  </a>
                  rankings and constructs by
                  <a
                    href="https://twitter.com/fantasycheddar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.hyperlink}
                  >
                    @TopCheddarFantasy
                  </a>
                </p>
              </div>
            ) : (
              <div className={styles.dateSelectorContainer}>
                <div className={styles.rangeSelectContainer}>
                  <div className={styles.dropdownGroup}>
                    <label
                      className={styles.selectLabel}
                      htmlFor="goalies-range-start"
                    >
                      Start
                    </label>
                    <select
                      id="goalies-range-start"
                      className={styles.customSelect}
                      value={selectedRange.start}
                      onChange={(e) =>
                        handleRangeChange(
                          parseInt(e.target.value),
                          selectedRange.end
                        )
                      }
                    >
                      {weeks.map((week, index) => (
                        <option key={index} value={index}>
                          {week.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.dropdownGroup}>
                    <label
                      className={styles.selectLabel}
                      htmlFor="goalies-range-end"
                    >
                      End
                    </label>
                    <select
                      id="goalies-range-end"
                      className={styles.customSelect}
                      value={selectedRange.end}
                      onChange={(e) =>
                        handleRangeChange(
                          selectedRange.start,
                          parseInt(e.target.value)
                        )
                      }
                    >
                      {weeks.map((week, index) => (
                        <option key={index} value={index}>
                          {week.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.buttonPrimary}
                  onClick={() => handleRangeSubmit(activeView)}
                >
                  Apply Range
                </button>
              </div>
            )}
          </div>
        </section>

        <section className={styles.controlsSection}>
          <div className={styles.sectionTitle}>Filters & Stats</div>
          <div className={styles.filtersPanel}>
            <div className={styles.dropdownGroup}>
              <label className={styles.selectLabel} htmlFor="goalies-min-games">
                Minimum GP
              </label>
              <div className={styles.inputStack}>
                <input
                  id="goalies-min-games"
                  className={styles.textInput}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={minimumGamesPlayedInput}
                  onChange={handleMinimumGamesChange}
                  placeholder="0"
                  aria-invalid={Boolean(minimumGamesPlayedError)}
                />
                {minimumGamesPlayedError ? (
                  <p className={styles.fieldError}>{minimumGamesPlayedError}</p>
                ) : (
                  <p className={styles.fieldHint}>
                    Empty input shows all goalies.
                  </p>
                )}
              </div>
            </div>

            <div className={styles.checkboxContainer}>
              {statColumns.map((stat) => (
                <div key={stat.value} className={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    id={`checkbox-${stat.value}`}
                    value={stat.value}
                    checked={selectedStats.includes(stat.value)}
                    onChange={handleStatChange}
                  />
                  <label htmlFor={`checkbox-${stat.value}`}>{stat.label}</label>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className={styles.contentWrapper}>
        <div className={styles.surfaceShell}>
          <div
            className={styles.surfaceTabs}
            role="tablist"
            aria-label="Goalie data views"
          >
            {viewTabs.map((tab) => {
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeView === tab.id}
                  className={`${styles.surfaceTab} ${
                    activeView === tab.id ? styles.surfaceTabActive : ""
                  }`}
                  onClick={() => handleSurfaceTabClick(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className={styles.surfaceBody} role="tabpanel">
            {error && <p className={styles.errorText}>{error}</p>}

            {activeView === "leaderboard" && (
              <>
                <div className={styles.metricsToolbar}>
                  <div className={styles.metricsToolbarLabel}>Variance Mode</div>
                  <div className={styles.metricsSegmentRail}>
                    <button
                      type="button"
                      className={`${styles.metricsSegment} ${
                        varianceDisplayMode === "raw"
                          ? styles.metricsSegmentActive
                          : ""
                      }`}
                      onClick={() => setVarianceDisplayMode("raw")}
                    >
                      Raw
                    </button>
                    <button
                      type="button"
                      className={`${styles.metricsSegment} ${
                        varianceDisplayMode === "relative"
                          ? styles.metricsSegmentActive
                          : ""
                      }`}
                      onClick={() => setVarianceDisplayMode("relative")}
                    >
                      Relative
                    </button>
                  </div>
                </div>

                <GoalieLeaderboard
                  goalieRankings={filteredGoalieRankings}
                  sortConfig={leaderboardSortConfig}
                  requestSort={handleLeaderboardSort}
                  varianceDisplayMode={varianceDisplayMode}
                />
              </>
            )}

            {activeView === "week" && canShowMetricsView && (
              <>
                <div className={styles.metricsToolbar}>
                  <div className={styles.metricsToolbarLabel}>Metrics View</div>
                  <div className={styles.metricsSegmentRail}>
                    <button
                      type="button"
                      className={`${styles.metricsSegment} ${
                        metricsView === "standard" ? styles.metricsSegmentActive : ""
                      }`}
                      onClick={() => setMetricsView("standard")}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      className={`${styles.metricsSegment} ${
                        metricsView === "advanced" ? styles.metricsSegmentActive : ""
                      }`}
                      onClick={() => setMetricsView("advanced")}
                    >
                      Advanced Analytics
                    </button>
                  </div>
                </div>

                {metricsView === "standard" ? (
                  useSingleWeek ? (
                  <GoalieList
                    goalieAggregates={filteredSingleWeekGoalieData}
                    leagueAverage={singleWeekLeagueAverage}
                    week={selectedWeek}
                    selectedStats={selectedStats}
                    statColumns={leaderboardStatColumns}
                    loading={loading}
                    onBackToLeaderboard={() => setView("leaderboard")}
                    showBackButton={false}
                  />
                  ) : (
                    <GoalieTable
                      goalies={rangeGoaliesForMetrics}
                      averages={rangeGoalieAverages}
                      selectedStats={selectedStats}
                      statColumns={leaderboardStatColumns}
                      startDate={selectedRangeWindow.startDate}
                      endDate={selectedRangeWindow.endDate}
                      isSingleWeek={false}
                      onBackToLeaderboard={() => setView("leaderboard")}
                      showBackButton={false}
                      requestSort={handleLeaderboardSort}
                      sortConfig={leaderboardSortConfig}
                      tableTitle="Date Range Goalie Metrics"
                      averagesLabel="Range Metrics Averages:"
                    />
                  )
                ) : (
                  advancedGoalieMetricsLoading ? (
                    <p className={styles.loadingMessage}>
                      Loading advanced goalie metrics...
                    </p>
                  ) : advancedGoalieMetricsError ? (
                    <p className={styles.errorText}>
                      {advancedGoalieMetricsError}
                    </p>
                  ) : advancedGoalieMetrics.length === 0 ? (
                    <p className={styles.standoutNote}>
                      No advanced goalie metrics available for the current
                      season.
                    </p>
                  ) : filteredAdvancedGoalieMetrics.length > 0 ? (
                    <>
                      <div className={styles.metricsToolbar}>
                        <div className={styles.metricsToolbarLabel}>
                          Strength
                        </div>
                        <div className={styles.metricsSegmentRail}>
                          {GOALIE_ADVANCED_STRENGTH_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`${styles.metricsSegment} ${
                                advancedMetricsStrength === option.value
                                  ? styles.metricsSegmentActive
                                  : ""
                              }`}
                              onClick={() =>
                                setAdvancedMetricsStrength(option.value)
                              }
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <GoalieAdvancedMetricsTable
                        rows={filteredAdvancedGoalieMetrics}
                        strength={advancedMetricsStrength}
                      />
                    </>
                  ) : (
                    <p className={styles.standoutNote}>
                      No goalie metrics available for the current filter.
                    </p>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalieTrends;

export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/variance/goalies",
      permanent: false
    }
  };
}
