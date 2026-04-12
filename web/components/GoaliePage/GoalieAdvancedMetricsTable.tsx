import React, { FC, useMemo, useState } from "react";
import styles from "styles/Goalies.module.scss";
import type {
  GoalieAdvancedMetricsRow,
  GoalieAdvancedStrength
} from "./goalieMetrics";
import { GOALIE_ADVANCED_STRENGTH_OPTIONS } from "./goalieMetrics";

type AdvancedMetricKey =
  | "goalieName"
  | "gamesPlayed"
  | "gamesStarted"
  | "qualityStartsPct"
  | "gsaa"
  | "xgAgainst"
  | "xgAgainstPer60"
  | "hdShotsAgainstPer60"
  | "shotsAgainstPer60"
  | "reboundAttemptsAgainstPer60"
  | "rushAttemptsAgainstPer60";

type SortDirection = "ascending" | "descending";

interface Column {
  label: string;
  sortKey: AdvancedMetricKey;
  title?: string;
  format?: (value: number | string | null) => string;
}

interface Props {
  rows: GoalieAdvancedMetricsRow[];
  strength?: GoalieAdvancedStrength;
}

export const formatAdvancedMetricNumber = (
  value: number | string | null,
  digits = 2
) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "N/A";

export const formatAdvancedMetricPercent = (value: number | string | null) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${(value * 100).toFixed(1)}%`
    : "N/A";

const columns: Column[] = [
  {
    label: "Goalie",
    sortKey: "goalieName"
  },
  {
    label: "GP",
    sortKey: "gamesPlayed",
    title: "Games played in the advanced metrics source."
  },
  {
    label: "GS",
    sortKey: "gamesStarted",
    title: "Games started in the advanced metrics source."
  },
  {
    label: "QS%",
    sortKey: "qualityStartsPct",
    title: "Quality starts divided by games started.",
    format: formatAdvancedMetricPercent
  },
  {
    label: "GSAA",
    sortKey: "gsaa",
    title: "Goals saved above average from Natural Stat Trick fields."
  },
  {
    label: "xGA",
    sortKey: "xgAgainst",
    title: "Expected goals against. This is workload/context, not a direct quality grade."
  },
  {
    label: "xGA/60",
    sortKey: "xgAgainstPer60",
    title: "Expected goals against per 60 minutes."
  },
  {
    label: "HDSA/60",
    sortKey: "hdShotsAgainstPer60",
    title: "High-danger shots against per 60 minutes."
  },
  {
    label: "SA/60",
    sortKey: "shotsAgainstPer60",
    title: "Shots against per 60 minutes."
  },
  {
    label: "RA/60",
    sortKey: "reboundAttemptsAgainstPer60",
    title: "Rebound attempts against per 60 minutes."
  },
  {
    label: "RushA/60",
    sortKey: "rushAttemptsAgainstPer60",
    title: "Rush attempts against per 60 minutes."
  }
];

const getValue = (
  row: GoalieAdvancedMetricsRow,
  key: AdvancedMetricKey,
  strength: GoalieAdvancedStrength
) => {
  if (
    key === "goalieName" ||
    key === "gamesPlayed" ||
    key === "gamesStarted" ||
    key === "qualityStartsPct"
  ) {
    return row[key];
  }

  return row.strengths[strength]?.[key] ?? null;
};

const isMissing = (value: number | string | null | undefined) =>
  value === null ||
  value === undefined ||
  (typeof value === "number" && !Number.isFinite(value));

export const sortAdvancedMetricRows = (
  rows: GoalieAdvancedMetricsRow[],
  key: AdvancedMetricKey,
  direction: SortDirection,
  strength: GoalieAdvancedStrength
) =>
  rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aValue = getValue(a.row, key, strength);
      const bValue = getValue(b.row, key, strength);
      const aMissing = isMissing(aValue);
      const bMissing = isMissing(bValue);

      if (aMissing && bMissing) {
        return a.index - b.index;
      }

      if (aMissing) {
        return 1;
      }

      if (bMissing) {
        return -1;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        const result = aValue.localeCompare(bValue);
        return direction === "ascending" ? result : -result;
      }

      const result = Number(aValue) - Number(bValue);
      return direction === "ascending" ? result : -result;
    })
    .map(({ row }) => row);

const GoalieAdvancedMetricsTable: FC<Props> = ({ rows, strength = "all" }) => {
  const [sortKey, setSortKey] =
    useState<AdvancedMetricKey>("qualityStartsPct");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("descending");

  const sortedRows = useMemo(
    () => sortAdvancedMetricRows(rows, sortKey, sortDirection, strength),
    [rows, sortDirection, sortKey, strength]
  );

  const requestSort = (nextKey: AdvancedMetricKey) => {
    if (nextKey === sortKey) {
      setSortDirection((current) =>
        current === "ascending" ? "descending" : "ascending"
      );
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "goalieName" ? "ascending" : "descending");
  };

  const getSortIndicator = (key: AdvancedMetricKey) => {
    if (key !== sortKey) {
      return "";
    }

    return sortDirection === "ascending" ? " ▲" : " ▼";
  };
  const strengthLabel =
    GOALIE_ADVANCED_STRENGTH_OPTIONS.find(
      (option) => option.value === strength
    )?.label ?? "All Situations";

  return (
    <>
      <h2 className={styles.goalieRankingLeaderboardHeader}>
        Advanced Goalie Metrics
      </h2>
      <div className={styles.tableScrollContainer}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.sortKey}
                  className={styles.sortableHeader}
                  onClick={() => requestSort(column.sortKey)}
                >
                  {column.label}
                  {column.title && (
                    <span className={styles.infoIcon} title={column.title}>
                      &#9432;
                    </span>
                  )}
                  <span className={styles.sortIndicator}>
                    {getSortIndicator(column.sortKey)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.playerId}>
                {columns.map((column) => {
                  const value = getValue(row, column.sortKey, strength);
                  const formattedValue = column.format
                    ? column.format(value)
                    : column.sortKey === "goalieName"
                      ? String(value ?? "N/A")
                      : formatAdvancedMetricNumber(value);

                  return <td key={column.sortKey}>{formattedValue}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.varianceNote}>
        Advanced metrics use season-level Supabase goalie rows. Current strength:
        {" "}{strengthLabel}. Context columns such as xGA, HDSA/60, SA/60, RA/60,
        and RushA/60 describe workload faced.
      </p>
    </>
  );
};

export default GoalieAdvancedMetricsTable;
