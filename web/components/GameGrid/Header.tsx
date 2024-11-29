// components/GameGrid/Header.tsx

import { Dispatch, SetStateAction, useState } from "react";
import styles from "./GameGrid.module.scss";

import { addDays, formatDate, getDayStr } from "./utils/date-func";
import Switch from "./Switch";
import Toggle from "./Toggle";
import { DAY_ABBREVIATION } from "lib/NHL/types";

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
};

type SortKey = {
  key: "totalOffNights" | "totalGamesPlayed" | "weekScore";
  ascending: boolean;
};

function Header({
  start,
  end,
  extended,
  setSortKeys,
  excludedDays,
  setExcludedDays
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

  const columns = [
    { label: "Team", id: "teamName" },
    ...getDayColumns(start, excludedDays, setExcludedDays, extended),
    ...statsColumns
  ];

  return (
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column.id}>{column.label}</th>
        ))}
      </tr>
    </thead>
  );
}

function getDayColumns(
  start: string,
  excludedDays: DAY_ABBREVIATION[],
  setExcludedDays: React.Dispatch<React.SetStateAction<DAY_ABBREVIATION[]>>,
  extended: boolean
) {
  const startDate = new Date(start);

  // const days = dateDiffInDays(startDate, endDate);
  const numDays = extended ? 7 + 3 : 7;
  const columns = [] as { label: JSX.Element | string; id: string }[];
  let current = startDate;
  for (let i = 0; i < numDays; i++) {
    const day = getDayStr(startDate, current) as DAY_ABBREVIATION;
    // Only need this handler in basic mode
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
        <>
          {day}
          <br />
          <p
            className={styles.mobileFontStyle}
            style={{
              whiteSpace: "nowrap",
              fontFamily: "Tahoma, sans-serif",
              fontSize: "10px",
              marginBottom: "3px",
              marginTop: "3px"
            }}
          >
            {formatDate(current)}
          </p>
          {!extended && (
            <Toggle checked={excludedDays.includes(day)} onChange={onChange} />
          )}
        </>
      ),
      id: getDayStr(startDate, current)
    });
    current = addDays(current, 1);
  }

  return columns;
}

export default Header;
