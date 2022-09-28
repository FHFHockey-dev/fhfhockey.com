import { Dispatch, SetStateAction, useState } from "react";

import {
  addDays,
  dateDiffInDays,
  formatDate,
  getDayStr,
} from "./utils/date-func";
import Switch from "./Switch";
import Toggle from "./Toggle";
import { Day } from "./GameGrid";

type HeaderProps = {
  start: string;
  end: string;
  setSortKeys: Dispatch<SetStateAction<{ key: string; ascending: boolean }[]>>;
  excludedDays: Day[];
  setExcludedDays: React.Dispatch<React.SetStateAction<Day[]>>;
};

function Header({
  start,
  end,
  setSortKeys,
  excludedDays,
  setExcludedDays,
}: HeaderProps) {
  const [totalGamesPlayed, setTotalGamesPlayed] = useState(false);
  const [totalOffNights, setTotalOffNights] = useState(false);
  const [weekScore, setWeekScore] = useState(false);

  const columns = [
    { label: "Team Name", id: "teamName" },
    ...getDayColumns(start, end, excludedDays, setExcludedDays),
    {
      label: (
        <>
          Total GP
          <Switch
            style={{ marginLeft: "2px" }}
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
          Total Off-Nights
          <Switch
            style={{ marginLeft: "2px" }}
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
          Week Score
          <Switch
            style={{ marginLeft: "2px" }}
            checked={totalOffNights}
            onClick={() => {
              setWeekScore((prev) => !prev);
              setSortKeys((prev) => {
                const keys = [...prev];
                keys.pop();
                return [{ key: "weekScore", ascending: weekScore }, ...keys];
              });
            }}
          />
        </>
      ),
      id: "weekScore",
    },
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

/**
 * Parse a date string as a Date obj. Ignore current hh-mm-ss
 * @param dateStr e.g., "2022-06-13"
 */
export function parseDateStr(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function getDayColumns(
  start: string,
  end: string,
  excludedDays: Day[],
  setExcludedDays: React.Dispatch<React.SetStateAction<Day[]>>
) {
  // "2022-06-20", "2022-06-20"
  const startDate = parseDateStr(start);
  const endDate = parseDateStr(end);

  const days = dateDiffInDays(startDate, endDate);
  const columns = [] as { label: JSX.Element | string; id: string }[];
  let current = startDate;
  for (let i = 0; i <= days; i++) {
    const day = getDayStr(current);
    const onChange = () => {
      setExcludedDays((prev) => {
        const set = new Set(prev);
        if (set.has(day)) {
          set.delete(day);
        } else {
          set.add(day);
        }
        i = i;
        return Array.from(set);
      });
    };

    columns.push({
      label: (
        <>
          {day}
          <br />
          <p
            style={{
              whiteSpace: "nowrap",
              fontSize: "14px",
              marginBottom: "3px",
            }}
          >
            {formatDate(current)}
          </p>
          <Toggle checked={excludedDays.includes(day)} onChange={onChange} />
        </>
      ),
      id: getDayStr(current),
    });
    current = addDays(current, 1);
  }

  return columns;
}

export default Header;
