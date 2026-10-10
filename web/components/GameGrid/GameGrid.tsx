// components/GameGrid/GameGrid.tsx

// TO-DO:
// Change Home/Away to use Home/Away Icons

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

import Header from "./Header";
import TeamRow from "./TeamRow";
import TeamDetails from "./TeamDetails";
import useTeamForecasts from "./utils/useTeamForecasts";
import TotalGamesPerDayRow from "./TotalGamesPerDayRow";
import FourWeekGrid from "./utils/FourWeekGrid";
import PlayerPickupTable from "components/PlayerPickupTable/PlayerPickupTable";

import { parseGameGridDateRange, startAndEndOfWeek } from "./utils/date-func";
import { getRegularGamesPerDay } from "./utils/helper";
import { getSelectedOpponentIds, getTeamScheduleSummary, getOpponentPointPct, getFourWeekAverages, getFourWeekScore } from "./utils/scheduleSummary";

import useSchedule from "./utils/useSchedule";
import useFourWeekSchedule from "./utils/useFourWeekSchedule"; // New import

import TransposedGrid from "./TransposedGrid";
import OpponentMetricsTable from "./OpponentMetricsTable";
import DesktopMasterTable from "./DesktopMasterTable";
import useOpponentMetricsData from "./utils/useOpponentMetricsData";

import styles from "./GameGrid.module.scss";
import Spinner from "components/Spinner";
import {
  nextMonday,
  nextSunday,
  previousSunday,
  previousMonday,
  format,
  isWithinInterval,
  endOfDay,
  addDays
} from "date-fns";
import {
  DAYS,
  EXTENDED_DAYS,
  EXTENDED_DAY_ABBREVIATION,
  ExtendedWeekData,
  WeekData,
  TeamDataWithTotals,
  FourWeekTotals
} from "lib/NHL/types"; // Ensure ExtendedWeekData and Totals are imported

import { useTeamsMap } from "hooks/useTeams"; // Import useTeamsMap
import useCurrentSeason from "hooks/useCurrentSeason";
import useTeamSummary from "hooks/useTeamSummary";
import useYahooCurrentMatchupWeek from "hooks/useYahooCurrentMatchupWeek";

import GameGridContext from "./contexts/GameGridContext";

type SortKey = {
  key: "teamName" | "totalOffNights" | "totalGamesPlayed" | "weekScore";
  ascending: boolean;
};

type TeamRowProps = {
  teamId: number;
  totalGamesPlayed: number;
  totalOffNights: number;
  weekScore: number;
  extended: boolean;
  excludedDays: EXTENDED_DAY_ABBREVIATION[];
  rowHighlightClass?: string;
  games: number[];
  rank: number; // Add rank property here
};

type TeamWeekData = {
  teamAbbreviation: string;
  gamesPlayed: number;
  offNights: number;
  avgOpponentPointPct: number;
};

export type GameGridMode = "7-Day-Forecast" | "10-Day-Forecast";
export const GAME_GRID_DESKTOP_BREAKPOINT = 1024;

export function isGameGridDesktopViewport(viewportWidth: number) {
  return viewportWidth >= GAME_GRID_DESKTOP_BREAKPOINT;
}

export function getGameGridLayout(
  isDesktop: boolean,
  orientation: "horizontal" | "vertical",
) {
  if (!isDesktop) return "stacked";
  return orientation === "horizontal" ? "master" : "legacy-vertical";
}

type GameGridProps = {
  mode: GameGridMode;
  setMode: (newMode: GameGridMode) => void;
};

type GameGridInternalProps = GameGridProps & {
  orientation: "horizontal" | "vertical";
  setOrientation: (newOrientation: "horizontal" | "vertical") => void;
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 480); // Adjust threshold if needed
    }
    handleResize(); // Check on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsDesktop(isGameGridDesktopViewport(window.innerWidth));
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isDesktop;
}

function GameGridInternal({
  mode,
  setMode,
  orientation,
  setOrientation
}: GameGridInternalProps) {
  const router = useRouter();

  // [startDate, endDate]
  const [dates, setDates] = useState<[string, string]>(() =>
    startAndEndOfWeek()
  );

  const [currentSortKey, setCurrentSortKey] = useState<SortKey | null>(null);

  const teams = useTeamsMap(); // Use the useTeamsMap hook

  // Existing useSchedule hook for current week
  const [currentSchedule, , currentLoading, selectedCalendar] = useSchedule(
    format(new Date(dates[0]), "yyyy-MM-dd"),
    mode === "10-Day-Forecast"
  );
  const scheduleDays = mode === "10-Day-Forecast" ? EXTENDED_DAYS : DAYS;
  const selectedScheduleReady = !currentLoading && !selectedCalendar.error &&
    selectedCalendar.coverage.known === selectedCalendar.coverage.expected;
  const teamForecasts = useTeamForecasts(currentSchedule, selectedScheduleReady,
    JSON.stringify(selectedCalendar.retrievedAtByDate ?? {}));
  const [expandedTeamIds, setExpandedTeamIds] = useState<ReadonlySet<number>>(new Set());
  const selectedWeekStart = dates[0];
  useEffect(() => { setExpandedTeamIds(new Set()); }, [selectedWeekStart]);
  const toggleTeamDetails = (teamId: number) => setExpandedTeamIds((previous) => {
    const next = new Set(previous);
    if (next.has(teamId)) next.delete(teamId); else next.add(teamId);
    return next;
  });

  const season = useCurrentSeason();
  const currentSeasonId = season?.seasonId ?? null;
  const currentSeasonYear = useMemo(() => {
    if (!currentSeasonId) return null;
    return currentSeasonId.toString().slice(0, 4);
  }, [currentSeasonId]);

  const { weekNumber: currentMatchupWeek } = useYahooCurrentMatchupWeek(
    currentSeasonYear,
    dates[0]
  );

  const {
    teamSummaries,
    loading: summaryLoading,
    error: summaryError
  } = useTeamSummary(currentSeasonId);

  const teamPointPctMap = useMemo(() => {
    const map: Record<number, number> = {};
    teamSummaries.forEach((summary) => {
      if (Number.isFinite(summary.gamesPlayed) && summary.gamesPlayed > 0 &&
          Number.isFinite(summary.pointPct) && summary.pointPct >= 0 && summary.pointPct <= 1) {
        map[summary.teamId] = summary.pointPct;
      }
    });
    return map;
  }, [teamSummaries]);

  // New useFourWeekSchedule hook for four weeks
  const [fourWeekSchedule, fourWeekNumGamesPerDay, fourWeekLoading, fourWeekCalendar] =
    useFourWeekSchedule(
      format(new Date(dates[0]), "yyyy-MM-dd")
    );

  const [excludedDays, setExcludedDays] = useState<EXTENDED_DAY_ABBREVIATION[]>([]);
  const [hidePreseason, setHidePreseason] = useState(false);
  const [sortKeys, setSortKeys] = useState<
    {
      key: "teamName" | "totalOffNights" | "totalGamesPlayed" | "weekScore";
      ascending: boolean;
    }[]
  >([]);

  // Define MODE_TO_LABEL mapping
  const MODE_TO_LABEL = {
    "7-Day-Forecast": "7-Day",
    "10-Day-Forecast": "10-Day"
  } as const;

  // Process the current schedule for Game Grid display
  // Compute league-wide per-day counts including ONLY regular-season games for calculations
  const regularNumGamesPerDay = useMemo(() => {
    return getRegularGamesPerDay(currentSchedule, scheduleDays);
  }, [currentSchedule, scheduleDays]);

  const filteredColumns = useMemo(() => {
    if (!selectedScheduleReady) return [];
    const copy: (WeekData & { teamId: number } & ReturnType<typeof getTeamScheduleSummary>)[] = [];
    // Helper to track seen teams and handle duplicates (e.g. UTA)
    // We key by abbreviation to catch cases where different teamIds map to the same team (e.g. moved franchises)
    const seenTeams = new Map<string, (typeof copy)[0]>();

    currentSchedule.forEach((row) => {
      const newRow = {
        ...row,
        ...getTeamScheduleSummary(row, regularNumGamesPerDay, excludedDays, scheduleDays,
          scheduleDays.map((_, i) => selectedCalendar.coveredDates.includes(
            format(addDays(new Date(dates[0]), i), "yyyy-MM-dd"))))
      };

      const abbr = teams[newRow.teamId]?.abbreviation;

      if (abbr) {
        if (seenTeams.has(abbr)) {
          const existing = seenTeams.get(abbr)!;
          // If existing has no games but new one does, replace it.
          // Also prefer the one with a higher ID if both have games (often newer franchise ID)
          if (
            (existing.totalGamesPlayed === 0 && newRow.totalGamesPlayed > 0) ||
            (existing.totalGamesPlayed === newRow.totalGamesPlayed &&
              newRow.teamId > existing.teamId)
          ) {
            seenTeams.set(abbr, newRow);
          }
        } else {
          seenTeams.set(abbr, newRow);
        }
      } else {
        // Fallback if no abbreviation found (shouldn't happen)
        seenTeams.set(String(newRow.teamId), newRow);
      }
    });

    return Array.from(seenTeams.values());
  }, [
    excludedDays,
    currentSchedule,
    regularNumGamesPerDay,
    scheduleDays,
    teams,
    selectedScheduleReady,
    selectedCalendar.coveredDates,
    dates
  ]);

  const renderTeamDetails = (teamId: number) => {
    const summary = filteredColumns.find((row) => row.teamId === teamId);
    return <>
    <TeamDetails
      teamId={teamId}
      schedule={currentSchedule.find((row) => row.teamId === teamId) ?? {}}
      startDate={format(new Date(dates[0]), "yyyy-MM-dd")}
      excludedDays={excludedDays}
      extended={mode === "10-Day-Forecast"}
      leagueSlateCounts={regularNumGamesPerDay}
      coveredDates={selectedCalendar.coveredDates}
      scheduleRetrievedAtByDate={selectedCalendar.retrievedAtByDate}
      asOf={teamForecasts.checkedAt}
      forecastRecords={teamForecasts.records}
      forecastContext={teamForecasts.contexts[teamId]}
      forecastReadStatus={teamForecasts.status === "loading" ? "Reading team forecasts…"
        : teamForecasts.status === "error" ? "Team forecast reader unavailable. Schedule details remain available."
        : `Team forecast reader inspected ${teamForecasts.inspected} records; ${teamForecasts.rejected} lack the required category admission contract.${teamForecasts.contexts[teamId] ? "" : " Schedule and roster admission context unavailable."}`}
      onRetryForecasts={teamForecasts.status === "error" ? teamForecasts.retry : undefined}
      scheduleCoverage={{ known: selectedCalendar.coveredDates.filter((date) =>
        date >= format(new Date(dates[0]), "yyyy-MM-dd") && date <= format(new Date(dates[1]), "yyyy-MM-dd")).length, expected: 7 }}
    />
    {summary && summary.weekScore !== -100 && <p className={styles.sourceStatus}>
      Week Score {summary.weekScore.toFixed(1)} for this selection: games {summary.scoreDecomposition.games.toFixed(2)},
      {" "}off nights {summary.scoreDecomposition.offNights.toFixed(2)}, matchup {summary.scoreDecomposition.matchup.toFixed(2)},
      {" "}crowding {summary.scoreDecomposition.crowding.toFixed(2)}
      {summary.crowding.status === "available" ? ` (${summary.crowding.knownGames}/${summary.crowding.expectedGames} games)` : " (neutral; slate evidence unavailable)"}.
      {" "}{summary.scoreDecomposition.version}; a schedule heuristic for the selected dates.
    </p>}
    </>;
  };
  const selectedScheduleStatus = (
    <p className={styles.sourceStatus} role="status">
      {currentLoading ? "Loading selected schedule…" : selectedCalendar.error
        ? `Selected schedule unavailable: ${selectedCalendar.error}`
        : `Selected schedule incomplete: ${selectedCalendar.coverage.known}/${selectedCalendar.coverage.expected} days covered. Totals and rankings are unavailable.`}
    </p>
  );

  // Detect if this week contains any preseason games
  const hasPreseason = useMemo(() => {
    return currentSchedule.some((row) =>
      scheduleDays.some((d) => row[d]?.gameType === 1)
    );
  }, [currentSchedule, scheduleDays]);

  // Sort teams based on sortKeys
  const sortedTeams = useMemo(() => {
    const sorted = [...filteredColumns];
    if (sortKeys.length > 0) {
      // Apply sorting based on sortKeys (assumes first key has highest priority)
      sorted.sort((a, b) => {
        for (let sortKey of sortKeys) {
          const { key, ascending } = sortKey;
          if (key === "teamName") {
            const teamA = teams[a.teamId]?.name.toUpperCase() || "";
            const teamB = teams[b.teamId]?.name.toUpperCase() || "";
            if (teamA < teamB) return ascending ? -1 : 1;
            if (teamA > teamB) return ascending ? 1 : -1;
            continue;
          }

          const valA = a[key];
          const valB = b[key];

          if (valA < valB) return ascending ? -1 : 1;
          if (valA > valB) return ascending ? 1 : -1;
          // If values are equal, continue to next sort key
        }
        // If all sort keys are equal, sort alphabetically by team name
        const teamA = teams[a.teamId]?.name.toUpperCase() || "";
        const teamB = teams[b.teamId]?.name.toUpperCase() || "";
        if (teamA < teamB) return -1;
        if (teamA > teamB) return 1;
        return 0;
      });
    } else {
      // Default sort: alphabetically
      sorted.sort((a, b) => {
        const teamA = teams[a.teamId]?.name.toUpperCase() || "";
        const teamB = teams[b.teamId]?.name.toUpperCase() || "";
        if (teamA < teamB) return -1;
        if (teamA > teamB) return 1;
        return 0;
      });
    }
    return sorted;
  }, [filteredColumns, teams, sortKeys]);

  // Modify this memoization
  const sortedByScoreDesc = useMemo(() => {
    return (
      [...filteredColumns]
        .sort((a, b) => b.weekScore - a.weekScore)
        // Add rank after sorting by score
        .map((team, index) => ({
          ...team,
          rank: index + 1 // Rank 1 is the best score
        }))
    );
  }, [filteredColumns]);

  const scoreRankMap = useMemo(() => {
    const map = new Map<number, number>(); // Map teamId to rank
    sortedByScoreDesc.forEach((team, index) => {
      map.set(team.teamId, index + 1);
    });
    return map;
  }, [sortedByScoreDesc]);

  // Build sets of top 10 & bottom 10
  const top10TeamIds = useMemo(() => {
    return new Set(sortedByScoreDesc.slice(0, 10).map((t) => t.teamId));
  }, [sortedByScoreDesc]);

  const bottom10TeamIds = useMemo(() => {
    // If fewer than 10 teams, slice won't break anything, but handle gracefully
    return new Set(sortedByScoreDesc.slice(-10).map((t) => t.teamId));
  }, [sortedByScoreDesc]);

  const handleOrientationToggle = () => {
    setOrientation(orientation === "horizontal" ? "vertical" : "horizontal");
  };
  const isDesktop = useIsDesktop();
  const gridLayout = getGameGridLayout(isDesktop, orientation);

  const handleSortToggle = (
    key: "totalOffNights" | "totalGamesPlayed" | "weekScore"
  ) => {
    setCurrentSortKey((prev) => {
      if (prev && prev.key === key) {
        // Toggle the ascending value
        const newSortKey = { key, ascending: !prev.ascending };
        setSortKeys([newSortKey]); // Replace sortKeys with the new sort key
        return newSortKey;
      } else {
        // Set to descending by default on first click
        const newSortKey = { key, ascending: false };
        setSortKeys([newSortKey]); // Replace sortKeys with the new sort key
        return newSortKey;
      }
    });
  };

  // PREV, NEXT button click
  const handleClick = (action: string) => () => {
    const start = new Date(dates[0]);
    const end = new Date(dates[1]);

    const newStart =
      action === "PREV" ? previousMonday(start) : nextMonday(start);

    const newEndBase =
      action === "PREV" ? previousSunday(end) : nextSunday(end);
    // Ensure the end date includes the full Sunday to keep interval inclusive all day
    const newEnd = endOfDay(newEndBase);

    // Only show yyyy-MM-dd on URL
    router.replace({
      query: {
        ...router.query,
        startDate: format(newStart, "yyyy-MM-dd"),
        endDate: format(newEnd, "yyyy-MM-dd")
      }
    });
    setDates([newStart.toISOString(), newEnd.toISOString()]);

    // check if today is within start and end
    const withinInterval = isWithinInterval(new Date(), {
      start: newStart,
      end: newEnd
    });

    // reset toggles to default
    if (!withinInterval) {
      setExcludedDays([]);
    }
  };

  // Sync dates with URL search params
  useEffect(() => {
    if (!router.isReady) return;
    const range = parseGameGridDateRange(router.query.startDate, router.query.endDate);
    if (range) setDates(range);
    else if (router.query.startDate === undefined && router.query.endDate === undefined) {
      setDates(startAndEndOfWeek());
    }
  }, [router.isReady, router.query.startDate, router.query.endDate]);

  // Toggle days off depending on what day of the week the grid is accessed
  useEffect(() => {
    const [start, end] = dates;
    // Check if today is within start and end
    const withinInterval = isWithinInterval(new Date(), {
      start: new Date(start),
      end: new Date(end)
    });

    if (withinInterval) {
      setExcludedDays(getDaysBeforeToday());
    } else {
      setExcludedDays([]);
    }
  }, [dates]);

  // *** BEGIN: Console Log weekData ***
  useEffect(() => {
    if (!fourWeekLoading && fourWeekSchedule.length > 0) {
      // Group data by team
      const teamMap: Record<number, TeamDataWithTotals> = {};

      fourWeekSchedule.forEach((teamData) => {
        const team = teams[teamData.teamId];
        if (!team) {
          console.warn(`Team data not found for teamId: ${teamData.teamId}`);
        }
        const teamAbbreviation = team?.abbreviation ?? String(teamData.teamId);
        const canonicalTeamId = team?.id ?? teamData.teamId;

        if (!teamMap[teamData.teamId]) {
          teamMap[teamData.teamId] = {
            teamAbbreviation,
            teamId: canonicalTeamId,
            weeks: [],
            totals: {
              opponents: [],
              gamesPlayed: 0,
              offNights: 0
            },
            avgOpponentPointPct: 0 // Initialize with a default value
          };
        }

        // Collect opponents for the week
        const opponents: { abbreviation: string; teamId: number }[] = [];

        DAYS.forEach((day) => {
          const matchUp = teamData[day];
          if (matchUp) {
            const opponentTeam =
              matchUp.homeTeam.id === teamData.teamId
                ? matchUp.awayTeam
                : matchUp.homeTeam;

            const opponent = teams[opponentTeam.id];
            opponents.push({
              abbreviation: opponent?.abbreviation ?? String(opponentTeam.id),
              teamId: opponentTeam.id
            });
          }
        });

        teamMap[teamData.teamId].weeks.push({
          weekNumber: teamData.weekNumber,
          opponents: opponents,
          gamesPlayed: teamData.totalGamesPlayed,
          offNights: teamData.totalOffNights
        });

        // **Aggregate Totals**
        teamMap[teamData.teamId].totals.opponents.push(...opponents);
        teamMap[teamData.teamId].totals.gamesPlayed +=
          teamData.totalGamesPlayed;
        teamMap[teamData.teamId].totals.offNights += teamData.totalOffNights;
      });

      // Convert teamMap to an array
      const weekDataArray: TeamDataWithTotals[] = Object.values(teamMap);

      // Log the JSON object only in development to avoid cluttering production logs
      if (process.env.NODE_ENV === "development") {
        console.log(JSON.stringify({ weekData: weekDataArray }, null, 2));
      }
    }
  }, [fourWeekSchedule, teams, fourWeekLoading]);
  // *** END: Console Log weekData ***

  // Prepare data for FourWeekGrid
  const teamDataWithTotals: TeamDataWithTotals[] = useMemo(() => {
    const teamMap: Record<number, TeamDataWithTotals> = {};

    fourWeekSchedule.forEach((teamData) => {
      const team = teams[teamData.teamId];
      if (!team) {
        console.warn(`Team data not found for teamId: ${teamData.teamId}`);
      }
      const teamAbbreviation = team?.abbreviation ?? String(teamData.teamId);
      const canonicalTeamId = team?.id ?? teamData.teamId;

      if (!teamMap[teamData.teamId]) {
        teamMap[teamData.teamId] = {
          teamAbbreviation,
          teamId: canonicalTeamId,
          weeks: [],
          totals: {
            opponents: [],
            gamesPlayed: 0,
            offNights: 0
          },
          avgOpponentPointPct: null
        };
      }

      // Collect opponents for the week
      const opponents: { abbreviation: string; teamId: number }[] = [];

      getSelectedOpponentIds(teamData).forEach((opponentId) => {
        const opponent = teams[opponentId];
        opponents.push({
          abbreviation: opponent?.abbreviation ?? String(opponentId),
          teamId: opponentId
        });
      });

      teamMap[teamData.teamId].weeks.push({
        weekNumber: teamData.weekNumber,
        opponents: opponents,
        gamesPlayed: teamData.totalGamesPlayed,
        offNights: teamData.totalOffNights,
        scheduleCoverage: teamData.scheduleCoverage
      });

      // **Aggregate Totals**
      teamMap[teamData.teamId].totals.opponents.push(...opponents);
      teamMap[teamData.teamId].totals.gamesPlayed += teamData.totalGamesPlayed;
      teamMap[teamData.teamId].totals.offNights += teamData.totalOffNights;
      const coverage = teamMap[teamData.teamId].totals.scheduleCoverage ?? { known: 0, expected: 0 };
      coverage.known += teamData.scheduleCoverage?.known ?? 7;
      coverage.expected += teamData.scheduleCoverage?.expected ?? 7;
      teamMap[teamData.teamId].totals.scheduleCoverage = coverage;
    });

    // Convert teamMap to an array and calculate avgOpponentPointPct
    return Object.values(teamMap).map((team) => {
      const opponentMetric = getOpponentPointPct(team.totals.opponents, teamPointPctMap);
      const completeSchedule = !team.totals.scheduleCoverage || team.totals.scheduleCoverage.known === team.totals.scheduleCoverage.expected;
      return {
        ...team,
        avgOpponentPointPct: completeSchedule ? opponentMetric.value : null,
        opponentCoverage: opponentMetric.coverage
      };
    });
  }, [fourWeekSchedule, teams, teamPointPctMap]);

  const teamDataWithAverages: TeamDataWithTotals[] = useMemo(() => {
    // Create a map of teamId -> index from sortedTeams
    const sortMap = new Map<number, number>();
    sortedTeams.forEach((team, index) => {
      sortMap.set(team.teamId, index);
    });

    // Sort teamDataWithTotals based on the map
    return [...teamDataWithTotals].sort((a, b) => {
      const indexA = sortMap.get(a.teamId) ?? 999;
      const indexB = sortMap.get(b.teamId) ?? 999;
      return indexA - indexB;
    });
  }, [teamDataWithTotals, sortedTeams]);

  // Weekly opponent/pickup context follows exactly the selected scoring period.
  // Four-week calendar totals remain independent of these day switches.
  const selectedPeriodTeamData = useMemo(() => filteredColumns.map((row) => {
    const opponents = getSelectedOpponentIds(row, excludedDays, scheduleDays)
      .map((teamId) => ({ abbreviation: teams[teamId]?.abbreviation ?? String(teamId), teamId }));
    const pointPcts = opponents.map((opponent) => teamPointPctMap[opponent.teamId])
      .filter((pct) => pct !== undefined);
    const totals = { opponents, gamesPlayed: row.totalGamesPlayed, offNights: row.totalOffNights };
    return {
      teamId: row.teamId,
      teamAbbreviation: teams[row.teamId]?.abbreviation ?? String(row.teamId),
      weeks: [{ weekNumber: 1, ...totals }],
      totals,
      avgOpponentPointPct: pointPcts.length
        ? pointPcts.reduce((a, b) => a + b, 0) / pointPcts.length : 0,
      weekScore: row.weekScore
    };
  }), [filteredColumns, scheduleDays, excludedDays, teams, teamPointPctMap]);

  const playerPickupWeekData = useMemo(() => selectedPeriodTeamData.map((team) => ({
    teamAbbreviation: team.teamAbbreviation,
    gamesPlayed: team.totals.gamesPlayed,
    offNights: team.totals.offNights,
    avgOpponentPointPct: team.avgOpponentPointPct,
    weekScore: team.weekScore
  })), [selectedPeriodTeamData]);

  const fourWeekAverages = useMemo(() => getFourWeekAverages(teamDataWithAverages), [teamDataWithAverages]);

  const fourWeekSummaryByTeamId = useMemo(() => {
    return teamDataWithAverages.reduce<
      Record<
        number,
        {
          gamesPlayed: number | null;
          offNights: number | null;
          avgOpponentPointPct: number | null;
          score: number | null;
          opponentCoverage?: { known: number; expected: number };
          scheduleCoverage?: { known: number; expected: number };
        }
      >
    >((acc, team) => {
      const completeSchedule = !team.totals.scheduleCoverage || team.totals.scheduleCoverage.known === team.totals.scheduleCoverage.expected;
      const gamesPlayed = completeSchedule ? team.totals.gamesPlayed : null;
      const offNights = completeSchedule ? team.totals.offNights : null;
      const avgOpponentPointPct = team.avgOpponentPointPct ?? null;

      acc[team.teamId] = {
        gamesPlayed,
        offNights,
        avgOpponentPointPct,
        score: getFourWeekScore(team, fourWeekAverages),
        opponentCoverage: team.opponentCoverage,
        scheduleCoverage: team.totals.scheduleCoverage
      };
      return acc;
    }, {});
  }, [fourWeekAverages, teamDataWithAverages]);

  const opponentMetricsData = useOpponentMetricsData(selectedPeriodTeamData, currentSeasonId);

  // Debugging: Log teamDataWithAverages
  useEffect(() => {
    if (!fourWeekLoading && process.env.NODE_ENV === "development") {
      console.log("Team Data with Averages:", teamDataWithAverages);
    }
  }, [fourWeekLoading, teamDataWithAverages]);

  const isMobile = useIsMobile();
  const [showMobileTips, setShowMobileTips] = useState(false);
  const [showWeekScoreHelp, setShowWeekScoreHelp] = useState(false);
  const [isBottomDrawerOpen, setIsBottomDrawerOpen] = useState(false);
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const weekScoreHelpRef = useRef<HTMLDivElement | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const controlsMenuRef = useRef<HTMLDivElement | null>(null);
  const controlsTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!controlsOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!controlsMenuRef.current?.contains(event.target as Node)) setControlsOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setControlsOpen(false);
        controlsTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [controlsOpen]);
  const [dateRangeDraft, setDateRangeDraft] = useState(() => ({
    start: format(new Date(dates[0]), "yyyy-MM-dd"),
    end: format(new Date(dates[1]), "yyyy-MM-dd")
  }));
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

  // UX: Close legend on Escape and lock body scroll while open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowMobileTips(false);
      }
    }
    if (showMobileTips) {
      document.addEventListener("keydown", onKeyDown);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [showMobileTips]);

  // UX: Close bottom drawer on Escape and lock body scroll while open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsBottomDrawerOpen(false);
      }
    }

    if (isBottomDrawerOpen) {
      document.addEventListener("keydown", onKeyDown);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isBottomDrawerOpen]);

  // UX: Close date range modal on Escape and lock body scroll while open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsDateRangeOpen(false);
      }
    }

    if (isDateRangeOpen) {
      document.addEventListener("keydown", onKeyDown);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isDateRangeOpen]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (
        showWeekScoreHelp &&
        weekScoreHelpRef.current &&
        !weekScoreHelpRef.current.contains(e.target as Node)
      ) {
        setShowWeekScoreHelp(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowWeekScoreHelp(false);
      }
    }

    if (!showWeekScoreHelp) {
      return;
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showWeekScoreHelp]);

  const openDateRange = () => {
    setDateRangeError(null);
    setDateRangeDraft({
      start: format(new Date(dates[0]), "yyyy-MM-dd"),
      end: format(new Date(dates[1]), "yyyy-MM-dd")
    });
    setIsDateRangeOpen(true);
  };

  const submitDateRange = () => {
    const start = dateRangeDraft.start;
    const end = dateRangeDraft.end;
    if (!start || !end) {
      setDateRangeError("Please select both a start and end date.");
      return;
    }
    if (new Date(start) > new Date(end)) {
      setDateRangeError("Start date must be before end date.");
      return;
    }
    setIsDateRangeOpen(false);
    router.push({
      pathname: "/game-grid/dateRange",
      query: { start, end }
    });
  };

  const legendBar = (
    <div className={styles.legendBar}>
      <div className={styles.legendMeta}>
        <ul>
          <li>
            <span
              className={styles.legendSwatch + " " + styles.legendOffNight}
            ></span>{" "}
            Off-night (≤8 GP)
          </li>
          <li>
            <span
              className={styles.legendSwatch + " " + styles.legendHeavy}
            ></span>{" "}
            Heavy (≥9 GP)
          </li>
          <li>
            <span
              className={styles.legendSwatch + " " + styles.legendBest}
            ></span>{" "}
            Top 10 score
          </li>
          <li>
            <span
              className={styles.legendSwatch + " " + styles.legendWorst}
            ></span>{" "}
            Bottom 10 score
          </li>
        </ul>
      </div>


    </div>
  );

  const weekScoreHelp = (
      <div className={styles.legendBarEnd} ref={weekScoreHelpRef}>
        <button
          type="button"
          className={styles.weekScoreHelpPill}
          aria-expanded={showWeekScoreHelp}
          aria-controls="gg-week-score-help"
          onClick={() => setShowWeekScoreHelp((v) => !v)}
        >
          Week Score <span className={styles.weekScoreHelpIcon}>i</span>
        </button>
        {showWeekScoreHelp && (
          <div
            id="gg-week-score-help"
            className={styles.weekScoreHelpPopover}
            role="dialog"
            aria-label="Week score formula"
          >
            <p>
              Week Score = (Adjusted Team Games × 6) + (Off-Night Games × 4)
              + Matchup Bonus + Slate Crowding.
            </p>
            <p>
              Slate crowding adds one adjustment from −0.25 to +0.25 across
              the entire selection: 0.25 × (2 × mean((16 − league games) / 15) − 1).
              Lighter slates earn more; missing slate coverage contributes
              neutral crowding. The binary off-night threshold stays at 8.
            </p>
            <p>
              GP and off nights take priority. Off-night games occur on days
              with 8 or fewer NHL regular-season games. Counts and league
              averages use the included days in the selected period.
            </p>
            <p>
              The matchup bonus is capped from −0.5 to +0.5, using current
              win odds (0–100%) with the existing back-to-back adjustment.
              Missing odds contribute a neutral bonus.
            </p>
            <p>
              This is an interim win-odds heuristic, not a calibrated fantasy
              projection or opponent-only scoring difficulty rating. Higher
              odds add a small edge when schedules match.
            </p>
            <p>
              Adjusted Team Games = Team Games – League Average Games. Teams
              with no games in the selected period display a dash.
            </p>
          </div>
        )}
      </div>
  );

  if (isMobile) {
    // *** MOBILE VIEW ***
    return (
      <>
        {/* Outer container for the entire mobile game grid section */}
        <div className={styles.mobileGameGridAll}>
          {/* Title remains at the top */}
          <div className={styles.titleRow}>
            <div className={styles.titleBar}>
              <h1 className={styles.gameGridTitle}>
                Game <span className={styles.spanColorBlue}>Grid</span>
              </h1>
              <button
                className={styles.helperToggle}
                onClick={() => setShowMobileTips((v) => !v)}
                aria-expanded={showMobileTips}
                aria-controls="gg-legend-sheet"
              >
                {showMobileTips ? "Hide tips" : "Tips"}
              </button>
            </div>
          </div>
          {/* NEW: This div now ONLY wraps the Nav Buttons and the Schedule Grid */}
          <div className={styles.navAndGrid}>
            {/* Mobile Header Actions (Buttons) */}
            <div className={styles.mobileHeaderActions}>
              <div className={styles.navButtonRow}>
                <button
                  className={styles.dateButtonPrev}
                  onClick={handleClick("PREV")}
                  aria-label="PREV"
                >
                  PREV
                </button>
                <button
                  className={styles.dateButtonMode}
                  onClick={() =>
                    setMode(
                      mode === "7-Day-Forecast"
                        ? "10-Day-Forecast"
                        : "7-Day-Forecast"
                    )
                  }
                >
                  {MODE_TO_LABEL[mode]}
                </button>
                <button
                  className={styles.orientationToggleButton}
                  onClick={openDateRange}
                >
                  DATE RANGE
                </button>
                <button
                  className={styles.dateButtonNext}
                  onClick={handleClick("NEXT")}
                  aria-label="NEXT"
                >
                  NEXT
                </button>
                {(currentLoading || fourWeekLoading) && (
                  <span className={styles.mobileNavSpinner} aria-hidden="true">
                    <Spinner />
                  </span>
                )}
              </div>
            </div>{" "}
            {/* End mobileHeaderActions */}
            {/* Schedule Grid section MOVED directly inside navAndGrid */}
            {/* Note: Removed the wrapping gameGridSection div as it might be redundant here */}
            <div className={styles.scheduleGridContainer}>
              {!selectedScheduleReady ? selectedScheduleStatus : <div className={styles.tableScrollWrapper}>
                <table
                  className={`${styles.scheduleGrid} ${styles.mobileCompactTable} ${styles.teamPreviewGrid}`}
                >
                  <colgroup>
                    <col className={styles.gridColFirst} />
                    <col span={7} className={styles.gridColMiddle} />
                    <col span={3} className={styles.gridColEnd} />
                  </colgroup>
                  <Header
                    start={dates[0]}
                    end={dates[1]}
                    extended={mode === "10-Day-Forecast"}
                    setSortKeys={setSortKeys}
                    excludedDays={excludedDays}
                    setExcludedDays={setExcludedDays}
                    weekData={teamDataWithAverages}
                    gamesPerDay={regularNumGamesPerDay}
                    hasPreseason={hasPreseason}
                    hidePreseason={hidePreseason}
                    setHidePreseason={setHidePreseason}
                  />
                  <tbody>
                    <TotalGamesPerDayRow
                      games={regularNumGamesPerDay}
                      excludedDays={excludedDays}
                      extended={mode === "10-Day-Forecast"}
                      weekData={teamDataWithAverages}
                    />
                    {sortedTeams.map(({ teamId, ...rest }) => {
                      const highlightClass = top10TeamIds.has(teamId)
                        ? styles.rowBest10
                        : bottom10TeamIds.has(teamId)
                          ? styles.rowWorst10
                          : "";
                      const rank = scoreRankMap.get(teamId) ?? 16;
                      return (
                        <TeamRow
                          key={teamId}
                          teamId={teamId}
                          expanded={expandedTeamIds.has(teamId)}
                          onToggle={() => toggleTeamDetails(teamId)}
                          details={renderTeamDetails(teamId)}
                          rank={rank}
                          extended={mode === "10-Day-Forecast"}
                          excludedDays={excludedDays}
                          rowHighlightClass={highlightClass}
                          games={regularNumGamesPerDay}
                          hidePreseason={hidePreseason}
                          {...rest}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>}
            </div>{" "}
          </div>{" "}
          {/* End navAndGrid */}
          {/* Container for the REST of the mobile content, now OUTSIDE navAndGrid */}
          <div className={styles.mobileContainer}>
            {/* OpponentMetricsTable section */}
            <div className={styles.opponentMetricsSection}>
              <OpponentMetricsTable
                teamData={selectedPeriodTeamData}
                metricsData={opponentMetricsData}
              />
            </div>

            {/* PlayerPickupTable section */}
            <div className={styles.playerPickupSection}>
              <PlayerPickupTable teamWeekData={playerPickupWeekData} />
            </div>

            {/* FourWeekGrid section */}
            <div className={styles.fourWeekSection}>
              <FourWeekGrid teamDataArray={teamDataWithAverages} calendar={fourWeekCalendar} />
            </div>
          </div>{" "}
          {/* End mobileContainer */}
        </div>{" "}
        {/* End mobileGameGridAll */}
        {/* Legend Bottom Sheet Overlay (mobile) */}
        {showMobileTips && (
          <div
            className={styles.legendOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gg-legend-title"
            onClick={() => setShowMobileTips(false)}
          >
            <div
              id="gg-legend-sheet"
              className={styles.legendSheet}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.legendGrabber} />
              <div className={styles.legendHeader}>
                <h2 id="gg-legend-title" className={styles.legendTitle}>
                  Game Grid Legend
                </h2>
                <button
                  className={styles.legendClose}
                  onClick={() => setShowMobileTips(false)}
                  aria-label="Close legend"
                >
                  Close
                </button>
              </div>
              <div className={styles.legendContent}>
                <section>
                  <h3>Matchups</h3>
                  <ul>
                    <li>
                      Opponent logo indicates who your team plays. A subtle icon
                      appears behind the logo:
                      <span className={styles.inlineChip}>
                        <span
                          className={
                            styles.homeAwayBadge +
                            " " +
                            styles.homeAwayBadgeHome
                          }
                        >
                          <picture>
                            <img
                              src="/pictures/homeIcon3.png"
                              alt="Home"
                              width={10}
                              height={10}
                              loading="lazy"
                            />
                          </picture>
                        </span>
                      </span>{" "}
                      = Home,{" "}
                      <span className={styles.inlineChip}>
                        <span
                          className={
                            styles.homeAwayBadge +
                            " " +
                            styles.homeAwayBadgeAway
                          }
                        >
                          <picture>
                            <img
                              src="/pictures/awayIcon3.png"
                              alt="Away"
                              width={10}
                              height={10}
                              loading="lazy"
                            />
                          </picture>
                        </span>
                      </span>{" "}
                      = Away.
                    </li>
                    <li>
                      Tap a matchup cell to view win odds and a quick Poisson
                      heatmap for that game.
                    </li>
                    <li>
                      Dimmed logos indicate excluded days (e.g., earlier days
                      this week on first visit).
                    </li>
                  </ul>
                </section>
                <section>
                  <h3>Day Types</h3>
                  <ul className={styles.legendChips}>
                    <li>
                      <span
                        className={styles.chip + " " + styles.offNight}
                      ></span>{" "}
                      Off‑night day (fewer NHL games, better streaming)
                    </li>
                    <li>
                      <span
                        className={styles.chip + " " + styles.mediumHeavy}
                      ></span>{" "}
                      Medium‑heavy day (7–8 NHL games)
                    </li>
                    <li>
                      <span className={styles.chip + " " + styles.heavy}></span>{" "}
                      Heavy day (9+ NHL games)
                    </li>
                  </ul>
                </section>
                <section>
                  <h3>Totals Row</h3>
                  <ul>
                    <li>
                      The bottom sticky row shows total NHL games per day,
                      color‑coded by intensity.
                    </li>
                  </ul>
                </section>
                <section>
                  <h3>Columns</h3>
                  <ul>
                    <li>
                      <strong>Total GP</strong>: Total games your team plays in
                      the selected window.
                    </li>
                    <li>
                      <strong>OFF</strong>: Number of off‑night games your team
                      has.
                    </li>
                    <li>
                      <strong>Week Score</strong>: Overall weekly value; cells
                      use a rank color scale (1 = best).
                    </li>
                  </ul>
                </section>
                <section>
                  <h3>Controls</h3>
                  <ul>
                    <li>
                      <strong>Prev/Next</strong> moves by week;{" "}
                      <strong>7/10‑Day</strong> switches the window size.
                    </li>
                    <li>
                      <strong>Orientation</strong> toggles horizontal/vertical
                      grid layout.
                    </li>
                    <li>Tap headers to sort where available.</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        )}
        {/* Loading and error overlays remain outside */}
        {(summaryLoading || fourWeekLoading) && (
          <div className={styles.overlaySpinner}>
            <Spinner />
          </div>
        )}
        {summaryError && (
          <div className={styles.error}>
            <p>Error loading team summaries. Please try again later.</p>
          </div>
        )}
        {isDateRangeOpen && (
          <div
            className={styles.dateRangeOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gg-date-range-title"
            onClick={() => setIsDateRangeOpen(false)}
          >
            <div
              className={styles.dateRangeModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.dateRangeHeader}>
                <h2 id="gg-date-range-title" className={styles.dateRangeTitle}>
                  Date Range
                </h2>
                <button
                  type="button"
                  className={styles.dateRangeClose}
                  onClick={() => setIsDateRangeOpen(false)}
                  aria-label="Close"
                >
                  Close
                </button>
              </div>
              <div className={styles.dateRangeBody}>
                <div className={styles.dateRangeField}>
                  <label
                    className={styles.dateRangeLabel}
                    htmlFor="gg-dr-start"
                  >
                    Start
                  </label>
                  <input
                    id="gg-dr-start"
                    type="date"
                    className={styles.dateRangeInput}
                    value={dateRangeDraft.start}
                    onChange={(e) =>
                      setDateRangeDraft((prev) => ({
                        ...prev,
                        start: e.target.value
                      }))
                    }
                  />
                </div>
                <div className={styles.dateRangeField}>
                  <label className={styles.dateRangeLabel} htmlFor="gg-dr-end">
                    End
                  </label>
                  <input
                    id="gg-dr-end"
                    type="date"
                    className={styles.dateRangeInput}
                    value={dateRangeDraft.end}
                    onChange={(e) =>
                      setDateRangeDraft((prev) => ({
                        ...prev,
                        end: e.target.value
                      }))
                    }
                  />
                </div>
                {dateRangeError && (
                  <div className={styles.dateRangeError} role="alert">
                    {dateRangeError}
                  </div>
                )}
              </div>
              <div className={styles.dateRangeActions}>
                <button
                  type="button"
                  className={styles.dateRangeCancel}
                  onClick={() => setIsDateRangeOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.dateRangeSubmit}
                  onClick={submitDateRange}
                >
                  View
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className={styles.mainGridContainer}>
        <div className={styles.dashboardHeader}>
          <div className={styles.gameGridHeaderContent}>
            <div className={styles.titleBlock}>
              <h1 className={styles.gameGridTitle}>
                Game <span className={styles.spanColorBlue}>Grid</span>
              </h1>
              <p className={styles.subTitle}>
                Weekly NHL schedule, off-nights & matchup maximizer
              </p>
            </div>
          </div>
        </div>

        <div className={styles.controlsBar}>
          <div className={styles.leftControls} ref={controlsMenuRef}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setControlsOpen(false);
            }}
          >
            <button
              type="button"
              ref={controlsTriggerRef}
              className={styles.controlsMenuTrigger}
              aria-label={controlsOpen ? "Close grid controls" : "Open grid controls"}
              aria-expanded={controlsOpen}
              aria-controls="gg-controls-menu"
              onClick={() => setControlsOpen((open) => !open)}
            >
              <span className={styles.hamburgerIcon} aria-hidden="true"><span /><span /><span /></span>
            </button>
            <div id="gg-controls-menu" role="group" aria-label="Grid controls"
              className={styles.controlsMenu} data-open={controlsOpen}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button")) {
                  setControlsOpen(false);
                  controlsTriggerRef.current?.focus();
                }
              }}
            >
              <div className={styles.viewToggleWrapper}>
                <button
                  type="button"
                  className={styles.panelControlButton}
                  onClick={() => setIsBottomDrawerOpen((v) => !v)}
                  aria-pressed={isBottomDrawerOpen}
                  aria-controls="gg-bottom-drawer"
                >
                  Pickups
                </button>
              </div>
              <div className={styles.viewToggleWrapper}>
                <button
                  type="button"
                  className={styles.panelControlButton}
                  onClick={openDateRange}
                >
                  Date Range
                </button>
              </div>
              <div className={styles.viewToggleWrapper}>
                <button
                  type="button"
                  aria-label="Toggle orientation"
                  className={styles.orientationToggleButton}
                  onClick={handleOrientationToggle}
                >
                  {isDesktop
                    ? orientation === "horizontal"
                      ? "Legacy Vertical"
                      : "Master Table"
                    : orientation === "horizontal"
                      ? "Vertical"
                      : "Horizontal"}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.badgeAndWeekNav}>
            {currentMatchupWeek != null && (
              <span
                className={styles.weekBadge}
                aria-label={`Yahoo matchup week ${currentMatchupWeek}`}
              >
                Week {currentMatchupWeek}
              </span>
            )}
            <div className={styles.dateCluster}>
              <div
                className={styles.dateNav}
                role="group"
                aria-label="Week navigation"
              >
                <button
                  type="button"
                  aria-label="Previous week"
                  className={styles.dateButtonPrev}
                  onClick={handleClick("PREV")}
                >
                  Prev
                </button>
                <span
                  className={styles.weekRange}
                  aria-live="polite"
                  aria-label="Selected week range"
                >
                  <span className={styles.weekRangeStart}>
                    {format(new Date(dates[0]), "MMM d")}
                  </span>
                  <span className={styles.weekRangeDash} aria-hidden="true">
                    –
                  </span>
                  <span className={styles.weekRangeEnd}>
                    {format(new Date(dates[1]), "MMM d")}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="Next week"
                  className={styles.dateButtonNext}
                  onClick={handleClick("NEXT")}
                >
                  Next
                </button>
                {(currentLoading || fourWeekLoading) && (
                  <Spinner className={styles.navSpinner} />
                )}
              </div>
            </div>
          </div>

          <div className={styles.rightControls}>
            <div className={styles.forecastControls}>
              <div
                className={styles.modeToggle}
                role="group"
                aria-label="Forecast span"
              >
                <button
                  type="button"
                  aria-pressed={mode === "7-Day-Forecast"}
                  className={
                    mode === "7-Day-Forecast"
                      ? styles.modeButtonActive
                      : styles.modeButton
                  }
                  onClick={() => setMode("7-Day-Forecast")}
                >
                  7-Day
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "10-Day-Forecast"}
                  className={
                    mode === "10-Day-Forecast"
                      ? styles.modeButtonActive
                      : styles.modeButton
                  }
                  onClick={() => setMode("10-Day-Forecast")}
                >
                  10-Day
                </button>
              </div>
              {weekScoreHelp}
            </div>
            {legendBar}
          </div>
        </div>

        {/* New 3-Column Dashboard Layout */}
        <div className={styles.dashboardLayout} data-grid-layout={gridLayout}>
          {!selectedScheduleReady ? (
            <div className={styles.desktopMasterSection}>
              {selectedScheduleStatus}
              <FourWeekGrid teamDataArray={teamDataWithAverages} calendar={fourWeekCalendar} />
            </div>
          ) : gridLayout === "master" ? (
            <div className={styles.desktopMasterSection}>
              <div className={styles.scheduleGridContainer}>
                <DesktopMasterTable
                  start={dates[0]}
                  extended={mode === "10-Day-Forecast"}
                  scheduleRows={filteredColumns}
                  gamesPerDay={regularNumGamesPerDay}
                  excludedDays={excludedDays}
                  setExcludedDays={setExcludedDays}
                  hidePreseason={hidePreseason}
                  opponentMetricsByTeamId={opponentMetricsData.metricsByTeamId}
                  opponentMetricColumns={opponentMetricsData.metricColumns}
                  opponentLeagueAverages={opponentMetricsData.leagueAverages}
                  opponentMetricsLoading={opponentMetricsData.statsLoading}
                  opponentMetricsError={opponentMetricsData.statsError}
                  opponentCoverageByTeamId={opponentMetricsData.coverageByTeamId}
                  opponentLeagueCoverage={opponentMetricsData.leagueCoverage}
                  opponentSourceLabel={opponentMetricsData.sourceLabel}
                  fourWeekSummaryByTeamId={fourWeekSummaryByTeamId}
                  fourWeekCalendar={fourWeekCalendar}
                  fourWeekAverages={fourWeekAverages}
                  expandedTeamIds={expandedTeamIds}
                  onToggleTeam={toggleTeamDetails}
                  renderTeamDetails={renderTeamDetails}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Left Rail: Opponent Metrics */}
              <div className={styles.leftRail}>
                <div className={styles.opponentMetricsContainer}>
                  <OpponentMetricsTable
                    teamData={selectedPeriodTeamData}
                    metricsData={opponentMetricsData}
                  />
                </div>
              </div>

              {/* Center: Main Game Grid */}
              <div className={styles.centerGrid}>
                <div className={styles.scheduleGridContainer}>
                    {orientation === "vertical" ? (
                    <TransposedGrid
                      sortedTeams={sortedTeams}
                      games={regularNumGamesPerDay}
                      excludedDays={excludedDays}
                      setExcludedDays={setExcludedDays}
                      extended={mode === "10-Day-Forecast"}
                      start={dates[0]}
                      expandedTeamIds={expandedTeamIds}
                      onToggleTeam={toggleTeamDetails}
                      renderTeamDetails={renderTeamDetails}
                      mode={
                        mode === "10-Day-Forecast" ? "10-Day-Forecast" : "7-Day"
                      }
                    />
                  ) : (
                    <div className={styles.gridScrollOuter}>
                      <table
                        className={`${styles.scheduleGrid} ${styles.condensed} ${styles.teamPreviewGrid}`}
                        aria-describedby="weekScoreDesc"
                      >
                        <colgroup>
                          <col className={styles.gridColFirst} />
                          <col span={7} className={styles.gridColMiddle} />
                          <col span={3} className={styles.gridColEnd} />
                        </colgroup>
                        <Header
                          start={dates[0]}
                          end={dates[1]}
                          extended={mode === "10-Day-Forecast"}
                          setSortKeys={setSortKeys}
                          excludedDays={excludedDays}
                          setExcludedDays={setExcludedDays}
                          weekData={teamDataWithAverages}
                          gamesPerDay={regularNumGamesPerDay}
                          hasPreseason={hasPreseason}
                          hidePreseason={hidePreseason}
                          setHidePreseason={setHidePreseason}
                        />
                        <tbody
                          key={dates[0]}
                          className={styles.fadeEnterActive}
                        >
                          <TotalGamesPerDayRow
                            games={regularNumGamesPerDay}
                            excludedDays={excludedDays}
                            extended={mode === "10-Day-Forecast"}
                            weekData={teamDataWithAverages}
                          />
                          {sortedTeams.map(({ teamId, ...rest }) => {
                            const highlightClass = top10TeamIds.has(teamId)
                              ? styles.rowBest10
                              : bottom10TeamIds.has(teamId)
                                ? styles.rowWorst10
                                : "";
                            const rank = scoreRankMap.get(teamId) ?? 16;
                            return (
                              <TeamRow
                                key={teamId}
                                teamId={teamId}
                                expanded={expandedTeamIds.has(teamId)}
                                onToggle={() => toggleTeamDetails(teamId)}
                                details={renderTeamDetails(teamId)}
                                extended={mode === "10-Day-Forecast"}
                                excludedDays={excludedDays}
                                rowHighlightClass={highlightClass}
                                games={regularNumGamesPerDay}
                                hidePreseason={hidePreseason}
                                rank={rank}
                                {...rest}
                              />
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Rail: Four Week Grid */}
              <div className={styles.rightRail}>
                <div className={styles.fourWeekGridContainerAll}>
                  <FourWeekGrid teamDataArray={teamDataWithAverages} calendar={fourWeekCalendar} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <section
        id="gg-bottom-drawer"
        className={[
          styles.bottomDrawer,
          isBottomDrawerOpen ? styles.bottomDrawerOpen : ""
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Player candidates"
      >
        <button
          type="button"
          className={styles.bottomDrawerHandle}
          onClick={() => setIsBottomDrawerOpen((v) => !v)}
          aria-expanded={isBottomDrawerOpen}
          aria-controls="gg-bottom-drawer-content"
        >
          <span className={styles.bottomDrawerTitle}>
            <span className={styles.bottomDrawerBadge} aria-hidden="true">
              POOL |
            </span>
            Player Candidates
          </span>
          <span className={styles.bottomDrawerHint}>
            {isBottomDrawerOpen ? "Close" : "Open"}
          </span>
        </button>
        <div
          id="gg-bottom-drawer-content"
          className={styles.bottomDrawerContent}
          hidden={!isBottomDrawerOpen}
        >
          <PlayerPickupTable
            teamWeekData={playerPickupWeekData}
            layoutVariant="full"
          />
        </div>
      </section>

      {/* Loading and error states */}
      {(summaryLoading || fourWeekLoading) && (
        <div className={styles.overlaySpinner}>
          <Spinner />
        </div>
      )}

      <p id="weekScoreDesc" className={styles.srOnly}>
        Week Score = (Adjusted Team Games × 6) + (Off-Night Games × 4) +
        Matchup Bonus + Slate Crowding. Adjusted Team Games = Team Games – League Average Games.
        GP and off nights take priority; off-night games occur on days with 8
        or fewer NHL regular-season games. Counts and averages use included
        days in the selected period. The matchup bonus ranges from −0.5 to
        +0.5 using current win odds (0–100%) with the existing back-to-back
        adjustment. Missing odds contribute a neutral bonus.
        One centered slate crowding adjustment is bounded to −0.25 through
        +0.25 across all included team games; missing coverage is neutral.
        Formula version schedule-v2-crowding-0.25.
        This is an interim heuristic, not a calibrated fantasy projection
        or opponent-only scoring difficulty rating. Higher odds add a small
        edge when schedules match. Teams with no games display a dash.
      </p>
      {summaryError && (
        <div className={styles.error}>
          <p>Error loading team summaries. Please try again later.</p>
        </div>
      )}

      {isDateRangeOpen && (
        <div
          className={styles.dateRangeOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gg-date-range-title"
          onClick={() => setIsDateRangeOpen(false)}
        >
          <div
            className={styles.dateRangeModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.dateRangeHeader}>
              <h2 id="gg-date-range-title" className={styles.dateRangeTitle}>
                Date Range
              </h2>
              <button
                type="button"
                className={styles.dateRangeClose}
                onClick={() => setIsDateRangeOpen(false)}
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <div className={styles.dateRangeBody}>
              <div className={styles.dateRangeField}>
                <label className={styles.dateRangeLabel} htmlFor="gg-dr-start">
                  Start
                </label>
                <input
                  id="gg-dr-start"
                  type="date"
                  className={styles.dateRangeInput}
                  value={dateRangeDraft.start}
                  onChange={(e) =>
                    setDateRangeDraft((prev) => ({
                      ...prev,
                      start: e.target.value
                    }))
                  }
                />
              </div>
              <div className={styles.dateRangeField}>
                <label className={styles.dateRangeLabel} htmlFor="gg-dr-end">
                  End
                </label>
                <input
                  id="gg-dr-end"
                  type="date"
                  className={styles.dateRangeInput}
                  value={dateRangeDraft.end}
                  onChange={(e) =>
                    setDateRangeDraft((prev) => ({
                      ...prev,
                      end: e.target.value
                    }))
                  }
                />
              </div>
              {dateRangeError && (
                <div className={styles.dateRangeError} role="alert">
                  {dateRangeError}
                </div>
              )}
            </div>
            <div className={styles.dateRangeActions}>
              <button
                type="button"
                className={styles.dateRangeCancel}
                onClick={() => setIsDateRangeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dateRangeSubmit}
                onClick={submitDateRange}
              >
                View
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const mod = (n: number, d: number) => ((n % d) + d) % d;

// Determine past days using LOCAL time so the default toggles reflect the user's timezone
function getDaysBeforeToday() {
  const today = new Date();
  // JS getDay(): 0=Sun,1=Mon,...6=Sat. Convert to Monday=0..Sunday=6
  const mondayBasedIndex = mod(today.getDay() - 1, 7);
  return DAYS.slice(0, mondayBasedIndex);
}

export default function GameGrid({ mode, setMode }: GameGridProps) {
  const router = useRouter();
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "horizontal"
  );

  if (router.isReady && (router.query.startDate !== undefined || router.query.endDate !== undefined) &&
      !parseGameGridDateRange(router.query.startDate, router.query.endDate)) {
    return <section aria-label="Game Grid date recovery" style={{ padding: 24 }}>
      <p role="alert">Invalid date range in URL. Choose valid start and end dates in order.</p>
      <Link href={`/game-grid/${mode}`}>Back to Game Grid</Link>
    </section>;
  }

  return (
    <GameGridContext>
      <GameGridInternal
        mode={mode}
        setMode={setMode}
        orientation={orientation}
        setOrientation={setOrientation}
      />
    </GameGridContext>
  );
}
