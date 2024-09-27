// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\GameGrid.tsx

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";

import Header from "./Header";
import TeamRow from "./TeamRow";
import TotalGamesPerDayRow, { calcTotalGP } from "./TotalGamesPerDayRow";

import { parseDateStr, startAndEndOfWeek } from "./utils/date-func";
import { calcTotalOffNights, getTotalGamePlayed } from "./utils/helper";
import useSchedule from "./utils/useSchedule";
import calcWeekScore from "./utils/calcWeekScore";
import {
  adjustBackToBackGames,
  convertTeamRowToWinOddsList,
} from "./utils/calcWinOdds";

import styles from "./GameGrid.module.scss";
import Spinner from "components/Spinner";
import {
  nextMonday,
  nextSunday,
  previousSunday,
  previousMonday,
  format,
  isWithinInterval,
} from "date-fns";
import { DAYS, DAY_ABBREVIATION, WeekData } from "lib/NHL/types";

import { useTeamsMap } from "hooks/useTeams";

import GameGridContext from "./contexts/GameGridContext";

function GameGridInternal({ mode, setMode }: GameGridProps) {
  const router = useRouter();
  // [startDate, endDate]
  const [dates, setDates] = useState<[string, string]>(() =>
    startAndEndOfWeek()
  );
  const teams = useTeamsMap();

  const [schedule, numGamesPerDay, loading] = useSchedule(
    format(new Date(dates[0]), "yyyy-MM-dd"),
    mode === "10-Day-Forecast"
  );

  const [excludedDays, setExcludedDays] = useState<DAY_ABBREVIATION[]>([]);
  const [sortKeys, setSortKeys] = useState<
    {
      key: "totalOffNights" | "totalGamesPlayed" | "weekScore";
      ascending: boolean;
    }[]
  >([]);

  // calculate new total GP and total off-nights based on excluded days.
  const filteredColumns = useMemo(() => {
    const adjustedSchedule = [...schedule];
    adjustBackToBackGames(adjustedSchedule);

    const copy: (WeekData & {
      teamId: number;
      totalGamesPlayed: number;
      totalOffNights: number;
      weekScore: number;
    })[] = [];
    const totalGP = calcTotalGP(numGamesPerDay, excludedDays);
    adjustedSchedule.forEach((row) => {
      // add Total GP for each team
      const totalGamesPlayed = getTotalGamePlayed(row, excludedDays);

      // add Total Off-Nights
      const totalOffNights = calcTotalOffNights(
        row,
        numGamesPerDay,
        excludedDays
      );

      // add Week Score
      const winOddsList = convertTeamRowToWinOddsList(row);

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
        weekScore,
      };
      copy.push(newRow);
    });
    return copy;
  }, [excludedDays, schedule, numGamesPerDay]);

  const sortedTeams = useMemo(() => {
    return [...filteredColumns].sort((a, b) => {
      for (let i = 0; i < sortKeys.length; i++) {
        const { key, ascending } = sortKeys[i];
        if (a[key] - b[key] !== 0) {
          return ascending ? a[key] - b[key] : b[key] - a[key];
        }
      }

      // UNCOMMENT WHEN NHL API HAS 20242025 data
      // return teams[a.teamId].name.localeCompare(teams[b.teamId].name);

      const teamA = teams[a.teamId];
      const teamB = teams[b.teamId];

      if (!teamA && !teamB) {
        return 0; // Both teams are undefined, consider them equal
      } else if (!teamA) {
        return 1; // teamA is undefined, place it after teamB
      } else if (!teamB) {
        return -1; // teamB is undefined, place it after teamA
      }

      return teamA.name.localeCompare(teamB.name);
    });
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
        endDate: format(newEnd, "yyyy-MM-dd"),
      },
    });
    // setSearchParams({ startDate: newStart, endDate: newEnd });
    setDates([newStart.toISOString(), newEnd.toISOString()]);

    // check if today is within start and end
    const withinInterval = isWithinInterval(new Date(), {
      start: newStart,
      end: newEnd,
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

  // toggle days off depending on what day of the week the grid is accessed
  useEffect(() => {
    const [start, end] = dates;
    // check if today is within start and end
    const withinInterval = isWithinInterval(new Date(), {
      start: new Date(start),
      end: new Date(end),
    });

    if (withinInterval) {
      setExcludedDays(getDaysBeforeToday());
    }
  }, [dates]);

  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.gameGridTitle}>
          Game <span className={styles.spanColorBlue}>Grid</span>
        </h1>
        <div className={styles.prevNextButtons}>
          <button
            className={styles.dateButtonMode}
            onClick={() => {
              setMode(
                mode === "7-Day-Forecast" ? "10-Day-Forecast" : "7-Day-Forecast"
              );
            }}
          >
            {mode}
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
            {loading && <Spinner className={styles.spinner} center />}
          </button>
        </div>
      </div>

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
              games={numGamesPerDay}
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
