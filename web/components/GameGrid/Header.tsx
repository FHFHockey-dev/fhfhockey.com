// components/GameGrid/Header.tsx

import { Dispatch, JSX, SetStateAction, useState, useEffect } from "react";
import styles from "./GameGrid.module.scss";
import switchStyles from "./Switch/Switch.module.scss";

import { addDays, formatDate, getDayStr } from "./utils/date-func";
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

function SortIndicator({ ascending }: { ascending: boolean }) {
  return (
    <span
      className={`${switchStyles.switch} ${
        ascending ? switchStyles.unchecked : switchStyles.checked
      }`}
      data-sort-direction={ascending ? "ascending" : "descending"}
      aria-hidden="true"
    >
      <span className={switchStyles.arrow} />
    </span>
  );
}

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
  SUN: "Su",
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
  setHidePreseason,
}: HeaderProps) {
  const [currentSortKey, setCurrentSortKey] = useState<SortKey | null>(null);
  const isMobile = useIsMobile();

  const handleSortToggle = (
    key: "teamName" | "totalOffNights" | "totalGamesPlayed" | "weekScore",
    defaultAscending: boolean,
  ) => {
    const nextSortKey: SortKey =
      currentSortKey?.key === key
        ? { key, ascending: !currentSortKey.ascending }
        : { key, ascending: defaultAscending };

    setCurrentSortKey(nextSortKey);
    setSortKeys([nextSortKey]);
  };

  const handleSortKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    key: SortKey["key"],
    defaultAscending: boolean,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (event.repeat) return;
      handleSortToggle(key, defaultAscending);
    }
  };

  const statsColumns = extended
    ? []
    : [
        {
          label: (
            <div className={styles.headerLabel}>
              <span className={styles.desktopText}>GP</span>

              <span className={styles.switchContainer}>
                <SortIndicator
                  ascending={
                    currentSortKey?.key === "totalGamesPlayed"
                      ? currentSortKey.ascending
                      : false
                  }
                />
              </span>
            </div>
          ),
          id: "totalGamesPlayed",
          sortLabel: "games played",
        },
        {
          label: (
            <div className={styles.headerLabel}>
              <span className={styles.desktopText}>Off</span>
              <span className={styles.switchContainer}>
                <SortIndicator
                  ascending={
                    currentSortKey?.key === "totalOffNights"
                      ? currentSortKey.ascending
                      : false
                  }
                />
              </span>
            </div>
          ),
          id: "totalOffNights",
          sortLabel: "off-night games",
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
                <SortIndicator
                  ascending={
                    currentSortKey?.key === "weekScore"
                      ? currentSortKey.ascending
                      : false
                  }
                />
              </span>
            </div>
          ),
          id: "weekScore",
          sortLabel: "week score",
        },
      ];

  const dayColumns = getDayColumns(
    start,
    excludedDays,
    setExcludedDays,
    extended,
    gamesPerDay,
    isMobile,
  );

  return (
    <thead>
      <tr>
        <th
          scope="col"
          aria-label="Team"
          aria-sort={
            currentSortKey?.key === "teamName"
              ? currentSortKey.ascending
                ? "ascending"
                : "descending"
              : undefined
          }
          className={styles.sortableHeader}
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
                  aria-label="Hide preseason games"
                  onChange={() => setHidePreseason((v) => !v)}
                />
              </span>
            )}
            <button
              type="button"
              className={`${styles.sortAction} ${styles.teamSortAction}`}
              aria-label="Sort by team"
              onClick={() => handleSortToggle("teamName", true)}
              onKeyDown={(event) => handleSortKeyDown(event, "teamName", true)}
            >
              <span>Team</span>
              <span className={styles.teamSortSwitch}>
                <SortIndicator
                  ascending={
                    currentSortKey?.key === "teamName"
                      ? currentSortKey.ascending
                      : true
                  }
                />
              </span>
            </button>
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
                  col.id === "totalGamesPlayed" ? styles.statsStart : undefined,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            >
              <button
                type="button"
                className={styles.sortAction}
                aria-label={`Sort by ${col.sortLabel}`}
                onClick={() =>
                  handleSortToggle(col.id as SortKey["key"], false)
                }
                onKeyDown={(event) =>
                  handleSortKeyDown(event, col.id as SortKey["key"], false)
                }
              >
                {col.label}
              </button>
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
  isMobile?: boolean,
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
                aria-label={`Include ${String(day)} games`}
                onChange={onChange}
              />
            </div>
          )}
        </div>
      ),
      id: day, // Use day abbreviation as ID
      intensity: intensity, // Include intensity
    });
    current = addDays(current, 1);
  }

  return columns;
}

export default Header;
