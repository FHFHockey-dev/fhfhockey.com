// components/GameGrid/GameGrid.tsx

// TO-DO:
// Change Home/Away to use Home/Away Icons

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import Header from "./Header";
import TeamRow from "./TeamRow";
import TotalGamesPerDayRow, { calcTotalGP } from "./TotalGamesPerDayRow";
import FourWeekGrid from "./utils/FourWeekGrid";
import PlayerPickupTable from "components/PlayerPickupTable/PlayerPickupTable";

import { parseDateStr, startAndEndOfWeek } from "./utils/date-func";
import {
  calcTotalOffNights,
  calcWeightedOffNights,
  getTotalGamePlayed
} from "./utils/helper";

import useSchedule from "./utils/useSchedule";
import useFourWeekSchedule from "./utils/useFourWeekSchedule"; // New import

import calcWeekScore from "./utils/calcWeekScore";
import {
  adjustBackToBackGames,
  convertTeamRowToWinOddsList
} from "./utils/calcWinOdds";

import TransposedGrid from "./TransposedGrid";
import OpponentMetricsTable from "./OpponentMetricsTable";

import styles from "./GameGrid.module.scss";
import Spinner from "components/Spinner";
import {
  nextMonday,
  nextSunday,
  previousSunday,
  previousMonday,
  format,
  isWithinInterval,
  endOfDay
} from "date-fns";
import {
  DAYS,
  DAY_ABBREVIATION,
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
  key: "totalOffNights" | "totalGamesPlayed" | "weekScore";
  ascending: boolean;
};

type TeamRowProps = {
  teamId: number;
  totalGamesPlayed: number;
  totalOffNights: number;
  weekScore: number;
  extended: boolean;
  excludedDays: DAY_ABBREVIATION[];
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
  const [currentSchedule, currentNumGamesPerDay, currentLoading] = useSchedule(
    format(new Date(dates[0]), "yyyy-MM-dd"),
    mode === "10-Day-Forecast"
  );

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

  console.log("Current Season ID:", currentSeasonId); // Debugging line

  const {
    teamSummaries,
    loading: summaryLoading,
    error: summaryError
  } = useTeamSummary(currentSeasonId);

  const teamPointPctMap = useMemo(() => {
    const map: Record<number, number> = {};
    teamSummaries.forEach((summary) => {
      map[summary.teamId] = summary.pointPct;
    });
    return map;
  }, [teamSummaries]);

  // New useFourWeekSchedule hook for four weeks
  const [fourWeekSchedule, fourWeekNumGamesPerDay, fourWeekLoading] =
    useFourWeekSchedule(
      format(new Date(dates[0]), "yyyy-MM-dd"),
      false // Set to true if you want extended data
    );

  const [excludedDays, setExcludedDays] = useState<DAY_ABBREVIATION[]>([]);
  const [hidePreseason, setHidePreseason] = useState(false);
  const [sortKeys, setSortKeys] = useState<
    {
      key: "totalOffNights" | "totalGamesPlayed" | "weekScore";
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
    const baseDays =
      mode === "10-Day-Forecast"
        ? ([...DAYS, "nMON", "nTUE", "nWED"] as const)
        : DAYS;
    const idSets: Array<Set<number>> = baseDays.map(() => new Set<number>());
    currentSchedule.forEach((row) => {
      baseDays.forEach((d, i) => {
        const g = (row as any)[d];
        if (g && g.gameType === 2 && g.id) {
          idSets[i].add(g.id);
        }
      });
    });
    return idSets.map((s) => s.size);
  }, [currentSchedule, mode]);

  const filteredColumns = useMemo(() => {
    const adjustedSchedule = [...currentSchedule];
    adjustBackToBackGames(adjustedSchedule);

    const copy: (WeekData & {
      teamId: number;
      totalGamesPlayed: number;
      totalOffNights: number;
      weekScore: number;
    })[] = [];
    const totalGP = calcTotalGP(regularNumGamesPerDay, excludedDays);

    // Helper to track seen teams and handle duplicates (e.g. UTA)
    // We key by abbreviation to catch cases where different teamIds map to the same team (e.g. moved franchises)
    const seenTeams = new Map<string, (typeof copy)[0]>();

    adjustedSchedule.forEach((row) => {
      // add Total GP for each team
      const totalGamesPlayed = getTotalGamePlayed(row, excludedDays);

      // add Total Off-Nights
      const totalOffNights = calcTotalOffNights(
        row,
        regularNumGamesPerDay,
        excludedDays
      );
      const weightedOffNights = calcWeightedOffNights(
        row,
        regularNumGamesPerDay,
        excludedDays
      );

      // add Week Score
      const winOddsList = convertTeamRowToWinOddsList({
        ...row,
        weekNumber: 1
      });

      const weekScore = calcWeekScore(
        winOddsList,
        weightedOffNights, // use weighted off‑nights for scoring
        totalGP,
        totalGamesPlayed
      );
      const newRow = {
        ...row,
        totalGamesPlayed,
        totalOffNights,
        weekScore
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
    currentNumGamesPerDay,
    regularNumGamesPerDay
  ]);

  // Detect if this week contains any preseason games
  const hasPreseason = useMemo(() => {
    return currentSchedule.some((row) =>
      DAYS.some((d) => (row[d as DAY_ABBREVIATION] as any)?.gameType === 1)
    );
  }, [currentSchedule]);

  // Sort teams based on sortKeys
  const sortedTeams = useMemo(() => {
    const sorted = [...filteredColumns];
    if (sortKeys.length > 0) {
      // Apply sorting based on sortKeys (assumes first key has highest priority)
      sorted.sort((a, b) => {
        for (let sortKey of sortKeys) {
          const { key, ascending } = sortKey;
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
    let ignore = false;
    let start = router.query.startDate as string;
    let end = router.query.endDate as string;

    if (start && end) {
      if (!ignore) {
        // search params only contain yyyy-MM-dd
        const startObj = parseDateStr(start);
        const endObj = endOfDay(parseDateStr(end));

        start = startObj.toISOString();
        end = endObj.toISOString();

        setDates([start, end]);
      }
    }
    return () => {
      ignore = true;
    };
  }, [router.query]);

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

        if (!teamMap[teamData.teamId]) {
          teamMap[teamData.teamId] = {
            teamAbbreviation: team.abbreviation,
            teamId: team.id,
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

      if (!teamMap[teamData.teamId]) {
        teamMap[teamData.teamId] = {
          teamAbbreviation: team.abbreviation,
          teamId: team.id,
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
      teamMap[teamData.teamId].totals.gamesPlayed += teamData.totalGamesPlayed;
      teamMap[teamData.teamId].totals.offNights += teamData.totalOffNights;
    });

    // Convert teamMap to an array and calculate avgOpponentPointPct
    return Object.values(teamMap).map((team) => {
      const opponentPointPcts = team.totals.opponents
        .map((opponent) => teamPointPctMap[opponent.teamId])
        .filter((pct) => pct !== undefined);

      const avgPointPct =
        opponentPointPcts.length > 0
          ? opponentPointPcts.reduce((a, b) => a + b, 0) /
            opponentPointPcts.length
          : 0;
      return {
        ...team,
        avgOpponentPointPct: avgPointPct // Keep it as number
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

  // Map current weekScore by team abbreviation for quick lookup
  const weekScoreByAbbreviation = useMemo(() => {
    const map: Record<string, number> = {};
    filteredColumns.forEach((row) => {
      const abbr = teams[row.teamId]?.abbreviation;
      if (abbr != null) {
        map[abbr] = row.weekScore;
      }
    });
    return map;
  }, [filteredColumns, teams]);

  const playerPickupWeekData = useMemo(() => {
    return teamDataWithAverages.map((team) => {
      const week1 = team.weeks.find((w) => w.weekNumber === 1);
      return {
        teamAbbreviation: team.teamAbbreviation,
        gamesPlayed: week1 ? week1.gamesPlayed : team.totals.gamesPlayed,
        offNights: week1 ? week1.offNights : team.totals.offNights,
        avgOpponentPointPct: team.avgOpponentPointPct,
        weekScore: weekScoreByAbbreviation[team.teamAbbreviation] ?? 0
      };
    });
  }, [teamDataWithAverages, weekScoreByAbbreviation]);

  // Debugging: Log teamDataWithAverages
  useEffect(() => {
    if (!fourWeekLoading) {
      console.log("Team Data with Averages:", teamDataWithAverages);
    }
  }, [fourWeekLoading, teamDataWithAverages]);

  const isMobile = useIsMobile();
  const [showMobileTips, setShowMobileTips] = useState(false);
  const [isBottomDrawerOpen, setIsBottomDrawerOpen] = useState(false);

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
                  onClick={handleOrientationToggle}
                >
                  {orientation === "horizontal" ? "Vertical" : "Horizontal"}
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
              <div className={styles.tableScrollWrapper}>
                {orientation === "vertical" ? (
                  <TransposedGrid
                    sortedTeams={sortedTeams}
                    games={currentNumGamesPerDay}
                    excludedDays={excludedDays}
                    setExcludedDays={setExcludedDays}
                    extended={mode === "10-Day-Forecast"}
                    start={dates[0]}
                    mode={
                      mode === "10-Day-Forecast" ? "10-Day-Forecast" : "7-Day"
                    }
                  />
                ) : (
                  <table
                    className={`${styles.scheduleGrid} ${styles.mobileCompactTable}`}
                  >
                    <colgroup>
                      <col className={styles.gridColFirst} />
                      <col span={10} className={styles.gridColOther} />
                    </colgroup>
                    <Header
                      start={dates[0]}
                      end={dates[1]}
                      extended={mode === "10-Day-Forecast"}
                      setSortKeys={setSortKeys}
                      excludedDays={excludedDays}
                      setExcludedDays={setExcludedDays}
                      weekData={teamDataWithAverages}
                      gamesPerDay={currentNumGamesPerDay}
                      hasPreseason={hasPreseason}
                      hidePreseason={hidePreseason}
                      setHidePreseason={setHidePreseason}
                    />
                    <tbody>
                      <TotalGamesPerDayRow
                        games={currentNumGamesPerDay}
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
                            rank={rank}
                            extended={mode === "10-Day-Forecast"}
                            excludedDays={excludedDays}
                            rowHighlightClass={highlightClass}
                            games={currentNumGamesPerDay}
                            hidePreseason={hidePreseason}
                            {...rest}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>{" "}
          </div>{" "}
          {/* End navAndGrid */}
          {/* Container for the REST of the mobile content, now OUTSIDE navAndGrid */}
          <div className={styles.mobileContainer}>
            {/* OpponentMetricsTable section */}
            <div className={styles.opponentMetricsSection}>
              <OpponentMetricsTable teamData={teamDataWithAverages} />
            </div>

            {/* PlayerPickupTable section */}
            <div className={styles.playerPickupSection}>
              <PlayerPickupTable teamWeekData={playerPickupWeekData} />
            </div>

            {/* FourWeekGrid section */}
            <div className={styles.fourWeekSection}>
              <FourWeekGrid teamDataArray={teamDataWithAverages} />
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
      </>
    );
  }

  return (
    <>
      <div className={styles.mainGridContainer}>
        <div className={styles.dashboardHeader}>
          <div className={styles.gameGridHeaderContent}>
            {currentMatchupWeek != null && (
              <span
                className={styles.weekBadge}
                aria-label={`Yahoo matchup week ${currentMatchupWeek}`}
              >
                Week {currentMatchupWeek}
              </span>
            )}
            <div className={styles.titleBlock}>
              <h1 className={styles.gameGridTitle}>
                Game <span className={styles.spanColorBlue}>Grid</span>
              </h1>
              <p className={styles.subTitle}>
                Weekly NHL schedule, off-nights & matchup maximizer
              </p>
            </div>
            <div className={styles.controlsBar}>
              <div className={styles.leftControls}>
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
                    aria-label="Toggle orientation"
                    className={styles.orientationToggleButton}
                    onClick={handleOrientationToggle}
                  >
                    {orientation === "horizontal" ? "Vertical" : "Horizontal"}
                  </button>
                </div>
              </div>

              <div className={styles.badgeAndWeekNav}>
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
                      {format(new Date(dates[0]), "MMM d")} –{" "}
                      {format(new Date(dates[1]), "MMM d")}
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
            </div>
          </div>
        </div>

        {/* New 3-Column Dashboard Layout */}
        <div className={styles.dashboardLayout}>
          {/* Left Rail: Opponent Metrics */}
          <div className={styles.leftRail}>
            <div className={styles.opponentMetricsContainer}>
              <OpponentMetricsTable teamData={teamDataWithAverages} />
            </div>
          </div>

          {/* Center: Main Game Grid */}
          <div className={styles.centerGrid}>
            <div className={styles.scheduleGridContainer}>
              <div className={styles.legendBar}>
                <ul>
                  <li>
                    <span
                      className={
                        styles.legendSwatch + " " + styles.legendOffNight
                      }
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
                  <li>
                    <span
                      className={styles.weekScoreHelpPill}
                      title="Week Score = (Adjusted Team Games × 6) + (Weighted Off‑Nights × 4) + (Average Win Odds × 0.15). Adjusted Team Games = (Team Games – League Average Games). Weighted Off‑Nights gives larger credit on lighter NHL nights."
                    >
                      Week Score{" "}
                      <span className={styles.weekScoreHelpIcon}>i</span>
                    </span>
                  </li>
                </ul>
              </div>
              {orientation === "vertical" ? (
                <TransposedGrid
                  sortedTeams={sortedTeams}
                  games={currentNumGamesPerDay}
                  excludedDays={excludedDays}
                  setExcludedDays={setExcludedDays}
                  extended={mode === "10-Day-Forecast"}
                  start={dates[0]}
                  mode={
                    mode === "10-Day-Forecast" ? "10-Day-Forecast" : "7-Day"
                  }
                />
              ) : (
                <div className={styles.gridScrollOuter}>
                  <table
                    className={`${styles.scheduleGrid} ${styles.condensed}`}
                    aria-describedby="weekScoreDesc"
                  >
                    <colgroup>
                      <col className={styles.gridColFirst} />
                      <col span={10} className={styles.gridColOther} />
                    </colgroup>
                    <Header
                      start={dates[0]}
                      end={dates[1]}
                      extended={mode === "10-Day-Forecast"}
                      setSortKeys={setSortKeys}
                      excludedDays={excludedDays}
                      setExcludedDays={setExcludedDays}
                      weekData={teamDataWithAverages}
                      gamesPerDay={currentNumGamesPerDay}
                      hasPreseason={hasPreseason}
                      hidePreseason={hidePreseason}
                      setHidePreseason={setHidePreseason}
                    />
                    <tbody key={dates[0]} className={styles.fadeEnterActive}>
                      <TotalGamesPerDayRow
                        games={currentNumGamesPerDay}
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
                            extended={mode === "10-Day-Forecast"}
                            excludedDays={excludedDays}
                            rowHighlightClass={highlightClass}
                            games={currentNumGamesPerDay}
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
              <FourWeekGrid teamDataArray={teamDataWithAverages} />
            </div>
          </div>
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
        aria-label="Best available players"
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
              BPA |
            </span>
            Best Players Available
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
        Week Score = (Adjusted Team Games × 6) + (Weighted Off‑Nights × 4) +
        (Average Win Odds × 0.15). Adjusted Team Games = (Team Games – League
        Average Games). Weighted Off‑Nights gives larger credit on lighter NHL
        nights (for example, 2‑game nights count more than 7‑game nights). A
        score of -100 indicates no games this period.
      </p>
      {summaryError && (
        <div className={styles.error}>
          <p>Error loading team summaries. Please try again later.</p>
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
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "horizontal"
  );

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
