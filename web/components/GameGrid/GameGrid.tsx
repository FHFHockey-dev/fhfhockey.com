import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";

import Header from "./Header";
import TeamRow from "./TeamRow";
import TotalGamesPerDayRow, { calcTotalGP } from "./TotalGamesPerDayRow";

import { parseDateStr, startAndEndOfWeek } from "./utils/date-func";
import { calcTotalOffNights, getTotalGamePlayed } from "./utils/NHL-API";
import useTeams from "./utils/useTeams";
import calcWeekScore from "./utils/calcWeekScore";
import { convertTeamRowToWinOddsList } from "./utils/calcWinOdds";

import styles from "./GameGrid.module.scss";
import Spinner from "components/Spinner";
import {
  nextMonday,
  nextSunday,
  previousSunday,
  previousMonday,
  format,
} from "date-fns";

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export default function GameGrid() {
  const router = useRouter();
  // [startDate, endDate]
  const [dates, setDates] = useState<[string, string]>(() =>
    startAndEndOfWeek()
  );
  const [teams, totalGamesPerDay, loading] = useTeams(
    format(new Date(dates[0]), "yyyy-MM-dd"),
    format(new Date(dates[1]), "yyyy-MM-dd")
  );
  const [excludedDays, setExcludedDays] = useState<Day[]>([]);
  const [sortKeys, setSortKeys] = useState<
    { key: string; ascending: boolean }[]
  >([]);

  // calculate new total GP and total off-nights based on excluded days.
  const filteredColumns = useMemo(() => {
    const copy = [...teams];
    const totalGP = calcTotalGP(totalGamesPerDay, excludedDays);
    copy.forEach((row) => {
      // add Total GP for each team
      const totalGamesPlayed = getTotalGamePlayed(row, excludedDays);

      // add Total Off-Nights
      const totalOffNights = calcTotalOffNights(row, excludedDays);

      row.totalGamesPlayed = totalGamesPlayed;
      row.totalOffNights = totalOffNights;

      // add Week Score
      const winOddsList = convertTeamRowToWinOddsList(row);

      row.weekScore = calcWeekScore(
        winOddsList,
        totalOffNights,
        totalGP,
        totalGamesPlayed
      );
    });
    return copy;
  }, [excludedDays, teams, totalGamesPerDay]);

  const sortedTeams = useMemo(() => {
    return [...filteredColumns].sort((a, b) => {
      for (let i = 0; i < sortKeys.length; i++) {
        const { key, ascending } = sortKeys[i];
        if (a[key] - b[key] !== 0) {
          return ascending ? a[key] - b[key] : b[key] - a[key];
        }
      }
      return a.teamName.localeCompare(b.teamName);
    });
  }, [sortKeys, filteredColumns]);

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
              games={totalGamesPerDay}
              excludedDays={excludedDays}
            />
            {/* Teams */}
            {sortedTeams.map((row) => {
              return <TeamRow key={row.teamName} {...row} />;
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
