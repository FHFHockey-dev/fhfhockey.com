import { useMemo, useState } from "react";

import type { SkaterAdvancedMetricsRow } from "./skaterTypes";

import styles from "pages/variance/variance.module.scss";

type SortDirection = "ascending" | "descending";
type SortKey = keyof SkaterAdvancedMetricsRow;

interface Column {
  key: SortKey;
  label: string;
  format?: (value: SkaterAdvancedMetricsRow[SortKey]) => string;
}

interface SkaterAdvancedMetricsTableProps {
  rows: SkaterAdvancedMetricsRow[];
}

const formatNumber = (value: unknown, digits = 2) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "N/A";

const formatPercent = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(1)}%`
    : "N/A";

const columns: Column[] = [
  { key: "playerName", label: "Name" },
  { key: "team", label: "Team" },
  {
    key: "valuation",
    label: "OWN%/ADP",
    format: (value) => formatNumber(value, 1)
  },
  { key: "gamesPlayed", label: "GP", format: (value) => formatNumber(value, 0) },
  { key: "goalsPer60", label: "G/60", format: formatNumber },
  { key: "assistsPer60", label: "A/60", format: formatNumber },
  { key: "pointsPer60", label: "PT/60", format: formatNumber },
  { key: "shotsPer60", label: "SOG/60", format: formatNumber },
  { key: "powerPlayGoalsPer60", label: "PPG/60", format: formatNumber },
  { key: "powerPlayAssistsPer60", label: "PPA/60", format: formatNumber },
  { key: "powerPlayPointsPer60", label: "PPP/60", format: formatNumber },
  { key: "hitsPer60", label: "HIT/60", format: formatNumber },
  { key: "blocksPer60", label: "BLK/60", format: formatNumber },
  { key: "penaltyMinutesPer60", label: "PIM/60", format: formatNumber },
  { key: "corsiForPer60", label: "CF/60", format: formatNumber },
  { key: "individualPointPercentage", label: "IPP", format: formatPercent },
  { key: "individualExpectedGoalsPer60", label: "iXG/60", format: formatNumber }
];

const compareValues = (
  aValue: unknown,
  bValue: unknown,
  direction: SortDirection
) => {
  const aMissing =
    aValue == null || (typeof aValue === "number" && !Number.isFinite(aValue));
  const bMissing =
    bValue == null || (typeof bValue === "number" && !Number.isFinite(bValue));

  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  if (typeof aValue === "string" && typeof bValue === "string") {
    const result = aValue.localeCompare(bValue);
    return direction === "ascending" ? result : -result;
  }

  const result = Number(aValue) - Number(bValue);
  return direction === "ascending" ? result : -result;
};

export default function SkaterAdvancedMetricsTable({
  rows
}: SkaterAdvancedMetricsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("pointsPer60");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("descending");

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        compareValues(a[sortKey], b[sortKey], sortDirection)
      ),
    [rows, sortDirection, sortKey]
  );

  const requestSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) =>
        current === "ascending" ? "descending" : "ascending"
      );
      return;
    }

    setSortKey(key);
    setSortDirection(
      key === "playerName" || key === "team" ? "ascending" : "descending"
    );
  };

  return (
    <div className={styles.tableScroller}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>Rank</th>
            {columns.map((column) => (
              <th key={column.key} onClick={() => requestSort(column.key)}>
                {column.label}
                {sortKey === column.key
                  ? sortDirection === "ascending"
                    ? " ▲"
                    : " ▼"
                  : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => (
            <tr key={`${row.playerId ?? row.bucket.key}-${index}`}>
              <td>{index + 1}</td>
              {columns.map((column) => {
                const value = row[column.key];
                const formatted = column.format
                  ? column.format(value)
                  : String(value ?? "N/A");

                return <td key={column.key}>{formatted}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

