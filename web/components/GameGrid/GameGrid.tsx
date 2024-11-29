// components/GameGrid/GameGridInternal.tsx

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import Header from "./Header";
import TeamRow from "./TeamRow";
import TotalGamesPerDayRow, { calcTotalGP } from "./TotalGamesPerDayRow";
import FourWeekGrid from "./utils/FourWeekGrid";

import { parseDateStr, startAndEndOfWeek } from "./utils/date-func";
import { calcTotalOffNights, getTotalGamePlayed } from "./utils/helper";

import useSchedule from "./utils/useSchedule";
import useFourWeekSchedule from "./utils/useFourWeekSchedule"; // New import

import calcWeekScore from "./utils/calcWeekScore";
import {
  adjustBackToBackGames,
  convertTeamRowToWinOddsList
} from "./utils/calcWinOdds";

import styles from "./GameGrid.module.scss";
import Spinner from "components/Spinner";
import {
  nextMonday,
  nextSunday,
  previousSunday,
  previousMonday,
  format,
  isWithinInterval
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

import GameGridContext from "./contexts/GameGridContext";

function GameGridInternal({ mode, setMode }: GameGridProps) {
  const router = useRouter();

  // [startDate, endDate]
  const [dates, setDates] = useState<[string, string]>(() =>
    startAndEndOfWeek()
  );

  const teams = useTeamsMap(); // Use the useTeamsMap hook

  // Existing useSchedule hook for current week
  const [currentSchedule, currentNumGamesPerDay, currentLoading] = useSchedule(
    format(new Date(dates[0]), "yyyy-MM-dd"),
    mode === "10-Day-Forecast"
  );

  const season = useCurrentSeason();
  const currentSeasonId = season?.seasonId ?? null;

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
  const filteredColumns = useMemo(() => {
    const adjustedSchedule = [...currentSchedule];
    adjustBackToBackGames(adjustedSchedule);

    const copy: (WeekData & {
      teamId: number;
      totalGamesPlayed: number;
      totalOffNights: number;
      weekScore: number;
    })[] = [];
    const totalGP = calcTotalGP(currentNumGamesPerDay, excludedDays);
    adjustedSchedule.forEach((row) => {
      // add Total GP for each team
      const totalGamesPlayed = getTotalGamePlayed(row, excludedDays);

      // add Total Off-Nights
      const totalOffNights = calcTotalOffNights(
        row,
        currentNumGamesPerDay,
        excludedDays
      );

      // add Week Score
      const winOddsList = convertTeamRowToWinOddsList({
        ...row,
        weekNumber: 1
      });

      const weekScore = calcWeekScore(
        winOddsList,
        totalOffNights,
        totalGP,
        totalGamesPlayed
      );
      const newRow = {
        ...row,
        totalGamesPlayed,
        totalOffNights,
        weekScore
      };
      copy.push(newRow);
    });
    return copy;
  }, [excludedDays, currentSchedule, currentNumGamesPerDay]);

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

  // PREV, NEXT button click
  const handleClick = (action: string) => () => {
    const start = new Date(dates[0]);
    const end = new Date(dates[1]);

    const newStart =
      action === "PREV" ? previousMonday(start) : nextMonday(start);

    const newEnd = action === "PREV" ? previousSunday(end) : nextSunday(end);

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
        start = parseDateStr(start).toISOString();
        end = parseDateStr(end).toISOString();

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
          return;
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
            if (opponent) {
              opponents.push({
                abbreviation: opponent.abbreviation,
                teamId: opponent.id
              });
            } else {
              console.warn(
                `Opponent team data not found for teamId: ${opponentTeam.id}`
              );
            }
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
        return;
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
          if (opponent) {
            opponents.push({
              abbreviation: opponent.abbreviation,
              teamId: opponent.id
            });
          } else {
            console.warn(
              `Opponent team data not found for teamId: ${opponentTeam.id}`
            );
          }
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
    return teamDataWithTotals;
  }, [teamDataWithTotals]);

  // Debugging: Log teamDataWithAverages
  useEffect(() => {
    if (!fourWeekLoading) {
      console.log("Team Data with Averages:", teamDataWithAverages);
    }
  }, [fourWeekLoading, teamDataWithAverages]);

  return (
    <>
      <div className={styles.actions}>
        <div className={styles.gameGridHeader}>
          <div className={styles.gameGridHeaderContent}>
            <h1 className={styles.gameGridTitle}>
              Game <span className={styles.spanColorBlue}>Grid</span>
            </h1>
            <div className={styles.prevNextButtons}>
              <button
                className={styles.dateButtonMode}
                onClick={() => {
                  setMode(
                    mode === "7-Day-Forecast"
                      ? "10-Day-Forecast"
                      : "7-Day-Forecast"
                  );
                }}
              >
                {MODE_TO_LABEL[mode]}
              </button>

              <button
                className={styles.dateButtonPrev}
                onClick={handleClick("PREV")}
              >
                Prev
              </button>

              <button
                className={styles.dateButtonNext}
                onClick={handleClick("NEXT")}
              >
                Next
                {(currentLoading || fourWeekLoading) && (
                  <Spinner className={styles.spinner} center />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className={styles.fourWeekLabel}>
          <h2 className={styles.fourWeekTitle}>
            Four Week <span className={styles.spanColorBlue}>Forecast</span>
          </h2>
        </div>
      </div>

      {/* FourWeekGrid Component */}
      <div className={styles.mainGridContainer}>
        <div className={styles.gridWrapper}>
          <table className={styles.scheduleGrid}>
            <Header
              start={dates[0]}
              end={dates[1]}
              extended={mode === "10-Day-Forecast"}
              setSortKeys={setSortKeys}
              excludedDays={excludedDays}
              setExcludedDays={setExcludedDays}
            />
            <tbody>
              {/* Total Games Per Day */}
              <TotalGamesPerDayRow
                games={currentNumGamesPerDay}
                excludedDays={excludedDays}
                extended={mode === "10-Day-Forecast"}
              />
              {/* Teams */}
              {sortedTeams.map(({ teamId, ...rest }) => {
                return (
                  <TeamRow
                    key={teamId}
                    teamId={teamId}
                    extended={mode === "10-Day-Forecast"}
                    excludedDays={excludedDays}
                    {...rest}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
        <FourWeekGrid teamDataArray={teamDataWithAverages} />
      </div>

      {/* Conditional Rendering for Loading and Error States */}
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

const mod = (n: number, d: number) => ((n % d) + d) % d;

function getDaysBeforeToday() {
  const today = new Date();
  const todayIndex = mod(today.getUTCDay() - 1, 7);
  return DAYS.slice(0, todayIndex);
}

export type GameGridMode = "7-Day-Forecast" | "10-Day-Forecast";

type GameGridProps = {
  mode: GameGridMode;
  setMode: (newMode: GameGridMode) => void;
};

export default function GameGrid({ mode, setMode }: GameGridProps) {
  return (
    <GameGridContext>
      <GameGridInternal mode={mode} setMode={setMode} />
    </GameGridContext>
  );
}
