import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";

import Header from "./Header";
import TeamRow from "./TeamRow";
import TotalGamesPerDayRow, { calcTotalGP } from "./TotalGamesPerDayRow";

import { parseDateStr, startAndEndOfWeek } from "./utils/date-func";
import { calcTotalOffNights, getTotalGamePlayed } from "./utils/NHL-API";
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
} from "date-fns";
import { DAY_ABBREVIATION, WeekData } from "pages/api/v1/schedule/[startDate]";
import { useTeamsMap } from "hooks/useTeams";
import GameGridContext from "./contexts/GameGridContext";

function GameGridInteral() {
  const router = useRouter();
  // [startDate, endDate]
  const [dates, setDates] = useState<[string, string]>(() =>
    startAndEndOfWeek()
  );
  const teams = useTeamsMap();
  const [schedule, numGamesPerDay, loading] = useSchedule(
    format(new Date(dates[0]), "yyyy-MM-dd")
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
      return teams[a.teamId].name.localeCompare(teams[b.teamId].name);
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

  return (
    <>
      <div className={styles.actions}>
        <button className={styles.dateButtonPrev} onClick={handleClick("PREV")}>
          Prev
        </button>
        <button className={styles.dateButtonNext} onClick={handleClick("NEXT")}>
          Next
          {loading && <Spinner className={styles.spinner} center />}
        </button>
      </div>

      <div className={styles.gridWrapper}>
        <table className={styles.scheduleGrid}>
          <Header
            start={dates[0]}
            end={dates[1]}
            setSortKeys={setSortKeys}
            excludedDays={excludedDays}
            setExcludedDays={setExcludedDays}
          />
          <tbody>
            {/* Total Games Per Day */}
            <TotalGamesPerDayRow
              games={numGamesPerDay}
              excludedDays={excludedDays}
            />
            {/* Teams */}
            {sortedTeams.map(({ teamId, ...rest }) => {
              return <TeamRow key={teamId} teamId={teamId} {...rest} />;
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function GameGrid() {
  return (
    <GameGridContext>
      <GameGridInteral />
    </GameGridContext>
  );
}
