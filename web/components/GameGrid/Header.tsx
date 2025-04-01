// components/GameGrid/Header.tsx

import { Dispatch, JSX, SetStateAction, useState } from "react";
import styles from "./GameGrid.module.scss";

import { addDays, formatDate, getDayStr } from "./utils/date-func";
import Switch from "./Switch";
import Toggle from "./Toggle";
import { DAY_ABBREVIATION, TeamDataWithTotals } from "lib/NHL/types";
import clsx from "clsx";

type HeaderProps = {
  start: string;
  end: string;
  extended: boolean;
  setSortKeys: Dispatch<
    SetStateAction<
      {
        key: "totalOffNights" | "totalGamesPlayed" | "weekScore";
        ascending: boolean;
      }[]
    >
  >;
  excludedDays: DAY_ABBREVIATION[];
  setExcludedDays: React.Dispatch<React.SetStateAction<DAY_ABBREVIATION[]>>;
  weekData: TeamDataWithTotals[];
  gamesPerDay: number[];
};

type SortKey = {
  key: "totalOffNights" | "totalGamesPlayed" | "weekScore";
  ascending: boolean;
};

const getIntensity = (numGames: number): string => {
  if (numGames <= 3) return "high";
  if (numGames <= 6) return "medium-high";
  if (numGames <= 9) return "medium-low";
  return "low";
};

function Header({
  start,
  end,
  extended,
  setSortKeys,
  excludedDays,
  setExcludedDays,
  weekData,
  gamesPerDay
}: HeaderProps) {
  const [currentSortKey, setCurrentSortKey] = useState<SortKey | null>(null);

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

  const statsColumns = extended
    ? []
    : [
        {
          label: (
            <>
              GP
              <Switch
                checked={
                  currentSortKey?.key === "totalGamesPlayed" &&
                  currentSortKey.ascending
                }
                onClick={() => handleSortToggle("totalGamesPlayed")}
              />
            </>
          ),
          id: "totalGamesPlayed"
        },
        {
          label: (
            <>
              Off
              <Switch
                checked={
                  currentSortKey?.key === "totalOffNights" &&
                  currentSortKey.ascending
                }
                onClick={() => handleSortToggle("totalOffNights")}
              />
            </>
          ),
          id: "totalOffNights"
        },
        {
          label: (
            <>
              Score
              <Switch
                checked={
                  currentSortKey?.key === "weekScore" &&
                  currentSortKey.ascending
                }
                onClick={() => handleSortToggle("weekScore")}
              />
            </>
          ),
          id: "weekScore"
        }
      ];

  const dayColumns = getDayColumns(
    start,
    excludedDays,
    setExcludedDays,
    extended,
    gamesPerDay
  );

  return (
    <thead>
      <tr>
        {/* Team column */}
        <th>Team</th>
        {/* Day columns */}
        {dayColumns.map((col) => (
          // *** Pass data-intensity to the th ***
          <th key={col.id} data-intensity={col.intensity}>
            {col.label}
          </th>
        ))}
        {/* Stat columns */}
        {statsColumns.map((col) => (
          <th key={col.id}>{col.label}</th>
        ))}
      </tr>
    </thead>
  );
}

function getDayColumns(
  start: string,
  excludedDays: DAY_ABBREVIATION[],
  setExcludedDays: React.Dispatch<React.SetStateAction<DAY_ABBREVIATION[]>>,
  extended: boolean,
  gamesPerDay: number[]
): { label: JSX.Element | string; id: string; intensity?: string }[] {
  const startDate = new Date(start);

  // const days = dateDiffInDays(startDate, endDate);
  const numDays = extended ? 7 + 3 : 7;
  const columns = [] as {
    label: JSX.Element | string;
    id: string;
    intensity: string;
  }[];
  let current = startDate;

  for (let i = 0; i < numDays; i++) {
    const day = getDayStr(startDate, current) as DAY_ABBREVIATION;
    const numGames = gamesPerDay[i] ?? 0;
    const intensity = getIntensity(numGames);

    const onChange = () => {
      setExcludedDays((prev) => {
        const set = new Set(prev);
        if (set.has(day)) {
          set.delete(day);
        } else {
          set.add(day);
        }
        return Array.from(set);
      });
    };

    columns.push({
      label: (
        <div>
          {" "}
          {/* Wrap label content */}
          <span className={styles.dayAbbreviation}>{day}</span>{" "}
          {/* Use spans for better control */}
          <br />
          <span className={styles.dayDate}>{formatDate(current)}</span>
          {!extended && (
            <div className={styles.dayToggle}>
              {" "}
              {/* Wrap toggle */}
              <Toggle
                checked={excludedDays.includes(day)}
                onChange={onChange}
              />
            </div>
          )}
        </div>
      ),
      id: day, // Use day abbreviation as ID
      intensity: intensity // Include intensity
    });
    current = addDays(current, 1);
  }

  return columns;
}

export default Header;
