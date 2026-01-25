// components/GameGrid/Header.tsx

import { Dispatch, JSX, SetStateAction, useState, useEffect } from "react";
import styles from "./GameGrid.module.scss";

import { addDays, formatDate, getDayStr } from "./utils/date-func";
import Switch from "./Switch";
import Toggle from "./Toggle";
import { DAY_ABBREVIATION, TeamDataWithTotals } from "lib/NHL/types";

// Simple hook to detect mobile (<=480px)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

type HeaderProps = {
  start: string;
  end: string;
  extended: boolean;
  setSortKeys: Dispatch<
    SetStateAction<
      {
        key: "teamName" | "totalOffNights" | "totalGamesPlayed" | "weekScore";
        ascending: boolean;
      }[]
    >
  >;
  excludedDays: DAY_ABBREVIATION[];
  setExcludedDays: React.Dispatch<React.SetStateAction<DAY_ABBREVIATION[]>>;
  weekData: TeamDataWithTotals[];
  gamesPerDay: number[];
  hasPreseason?: boolean;
  hidePreseason?: boolean;
  setHidePreseason?: Dispatch<SetStateAction<boolean>>;
};

type SortKey = {
  key: "teamName" | "totalOffNights" | "totalGamesPlayed" | "weekScore";
  ascending: boolean;
};

// Function to determine intensity based on game count
const getIntensity = (numGames: number): string => {
  if (numGames <= 7) return "high"; // Green (Fewest games = highest intensity day for streaming)
  if (numGames <= 8) return "medium-high"; // Yellow
  if (numGames <= 9) return "low"; // red
  return "low"; // Red (Most games = lowest intensity day for streaming)
};

// Add a mapping for mobile day abbreviations
const MOBILE_DAY_ABBR: Record<string, string> = {
  MON: "M",
  TUE: "T",
  WED: "W",
  THU: "Th",
  FRI: "F",
  SAT: "S",
  SUN: "Su"
};

function Header({
  start,
  end,
  extended,
  setSortKeys,
  excludedDays,
  setExcludedDays,
  weekData,
  gamesPerDay,
  hasPreseason,
  hidePreseason,
  setHidePreseason
}: HeaderProps) {
  const [currentSortKey, setCurrentSortKey] = useState<SortKey | null>(null);
  const isMobile = useIsMobile();

  const handleSortToggle = (
    key: "teamName" | "totalOffNights" | "totalGamesPlayed" | "weekScore",
    defaultAscending: boolean
  ) => {
    setCurrentSortKey((prev) => {
      if (prev && prev.key === key) {
        // Toggle the ascending value
        const newSortKey = { key, ascending: !prev.ascending };
        setSortKeys([newSortKey]); // Replace sortKeys with the new sort key
        return newSortKey;
      } else {
        const newSortKey = { key, ascending: defaultAscending };
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
            <div className={styles.headerLabel}>
              <span className={styles.desktopText}>GP</span>

              <span className={styles.switchContainer}>
                <Switch
                  checked={
                    currentSortKey?.key === "totalGamesPlayed" &&
                    currentSortKey.ascending
                  }
                />
              </span>
            </div>
          ),
          id: "totalGamesPlayed"
        },
        {
          label: (
            <div className={styles.headerLabel}>
              <span className={styles.desktopText}>Off</span>
              <span className={styles.switchContainer}>
                <Switch
                  checked={
                    currentSortKey?.key === "totalOffNights" &&
                    currentSortKey.ascending
                  }
                />
              </span>
            </div>
          ),
          id: "totalOffNights"
        },
        {
          label: (
            <div className={styles.headerLabel}>
              <span
                className={`${styles.desktopText} ${styles.scoreHeaderText}`}
              >
                Score
              </span>
              <span className={styles.switchContainer}>
                <Switch
                  checked={
                    currentSortKey?.key === "weekScore" &&
                    currentSortKey.ascending
                  }
                />
              </span>
            </div>
          ),
          id: "weekScore"
        }
      ];

  const dayColumns = getDayColumns(
    start,
    excludedDays,
    setExcludedDays,
    extended,
    gamesPerDay,
    isMobile
  );

  return (
    <thead>
      <tr>
        <th
          scope="col"
          aria-label="Team"
          role="button"
          tabIndex={0}
          aria-sort={
            currentSortKey?.key === "teamName"
              ? currentSortKey.ascending
                ? "ascending"
                : "descending"
              : undefined
          }
          className={styles.sortableHeader}
          onClick={() => handleSortToggle("teamName", true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSortToggle("teamName", true);
            }
          }}
        >
          <div className={styles.teamHeaderContent}>
            {!extended && hasPreseason && setHidePreseason && (
              <span
                className={styles.preseasonToggle}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <span>Pre</span>
                <Toggle
                  size="small"
                  checked={!!hidePreseason}
                  onChange={() => setHidePreseason((v) => !v)}
                />
              </span>
            )}
            <span>Team</span>
            <div className={styles.teamSortSwitch}>
              <Switch
                checked={
                  currentSortKey?.key === "teamName" && currentSortKey.ascending
                }
                aria-label="Sort by team"
              />
            </div>
          </div>
        </th>
        {dayColumns.map((col) => (
          <th
            key={col.id}
            data-intensity={col.intensity}
            scope="col"
            aria-label={`${col.id} games column`}
          >
            {col.label}
          </th>
        ))}
        {statsColumns.map((col) => {
          const isSorted = currentSortKey?.key === (col.id as any);
          const ariaSort = isSorted
            ? currentSortKey?.ascending
              ? "ascending"
              : "descending"
            : undefined;
          return (
            <th
              key={col.id}
              scope="col"
              aria-sort={ariaSort}
              className={
                [
                  styles.sortableHeader,
                  col.id === "totalGamesPlayed" ? styles.statsStart : undefined
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              role="button"
              tabIndex={0}
              onClick={() =>
                handleSortToggle(col.id as SortKey["key"], false)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSortToggle(col.id as SortKey["key"], false);
                }
              }}
            >
              {col.label}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

function getDayColumns(
  start: string,
  excludedDays: DAY_ABBREVIATION[],
  setExcludedDays: React.Dispatch<React.SetStateAction<DAY_ABBREVIATION[]>>,
  extended: boolean,
  gamesPerDay: number[],
  isMobile?: boolean
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
        <div className={styles.dayHeaderLabel}>
          <div className={styles.dayAndDate}>
            <span className={styles.dayAbbreviation}>
              {isMobile ? MOBILE_DAY_ABBR[day] || day : day}
            </span>
            <span className={styles.dayDate}>{formatDate(current)}</span>
          </div>
          {!extended && (
            <div className={styles.dayToggle}>
              <Toggle
                size="small"
                checked={!excludedDays.includes(day)}
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
