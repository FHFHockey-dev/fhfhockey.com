import { Dispatch, SetStateAction, useState } from "react";
import styles from "./GameGrid.module.scss";

import { addDays, formatDate, getDayStr } from "./utils/date-func";
import Switch from "./Switch";
import Toggle from "./Toggle";
import { DAY_ABBREVIATION } from "pages/api/v1/schedule/[startDate]";

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

function Header({
  start,
  end,
  extended,
  setSortKeys,
  excludedDays,
  setExcludedDays,
}: HeaderProps) {
  const [totalGamesPlayed, setTotalGamesPlayed] = useState(false);
  const [totalOffNights, setTotalOffNights] = useState(false);
  const [weekScore, setWeekScore] = useState(false);
  const statsColumns = extended
    ? []
    : [
        {
          label: (
            <>
              GP
              <Switch
                checked={totalGamesPlayed}
                onClick={() => {
                  setTotalGamesPlayed((prev) => !prev);
                  setSortKeys((prev) => {
                    const keys = [...prev];
                    keys.pop();
                    return [
                      { key: "totalGamesPlayed", ascending: totalGamesPlayed },
                      ...keys,
                    ];
                  });
                }}
              />
            </>
          ),
          id: "totalGamesPlayed",
        },
        {
          label: (
            <>
              Off
              <Switch
                checked={totalOffNights}
                onClick={() => {
                  setTotalOffNights((prev) => !prev);
                  setSortKeys((prev) => {
                    const keys = [...prev];
                    keys.pop();
                    return [
                      { key: "totalOffNights", ascending: totalOffNights },
                      ...keys,
                    ];
                  });
                }}
              />
            </>
          ),
          id: "totalOffNights",
        },
        {
          label: (
            <>
              Score
              <Switch
                checked={weekScore}
                onClick={() => {
                  setWeekScore((prev) => !prev);
                  setSortKeys((prev) => {
                    const keys = [...prev];
                    keys.pop();
                    return [
                      { key: "weekScore", ascending: weekScore },
                      ...keys,
                    ];
                  });
                }}
              />
            </>
          ),
          id: "weekScore",
        },
      ];
  const columns = [
    { label: "Team", id: "teamName" },
    ...getDayColumns(start, excludedDays, setExcludedDays, extended),
    ...statsColumns,
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
              marginTop: "3px",
            }}
          >
            {formatDate(current)}
          </p>
          {!extended && (
            <Toggle checked={!excludedDays.includes(day)} onChange={onChange} />
          )}
        </>
      ),
      id: getDayStr(startDate, current),
    });
    current = addDays(current, 1);
  }

  return columns;
}

export default Header;
