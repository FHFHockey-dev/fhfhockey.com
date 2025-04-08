// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTable.tsx

import React from "react";
import { TableAggregateData } from "./types";
import styles from "styles/wigoCharts.module.scss";

interface StatsTableProps {
  title: string; // "COUNTS" or "RATES"
  data: TableAggregateData[];
  isLoading: boolean;
  error: string | null;
  formatCell: (label: string, value?: number) => string; // Pass the formatter
}

const StatsTable: React.FC<StatsTableProps> = ({
  title,
  data,
  isLoading,
  error,
  formatCell
}) => {
  // Define the order of columns
  const columnOrder: (keyof TableAggregateData | "Stat" | "DIFFLabel")[] = [
    "Stat",
    "CA",
    "3YA",
    "LY",
    "L5",
    "L10",
    "L20",
    "STD",
    "DIFFLabel" // Use a label for the DIFF header
  ];
  const columnHeaders: { [key: string]: string } = {
    Stat: "Stat",
    CA: "CA",
    "3YA": "3YA",
    LY: "LY",
    L5: "L5",
    L10: "L10",
    L20: "L20",
    STD: "STD",
    DIFFLabel: "DIFF" // Display header for the DIFF column
  };

  const getStatValue = (
    row: TableAggregateData,
    key: keyof TableAggregateData | "Stat" | "DIFFLabel"
  ) => {
    if (key === "Stat")
      return <td className={styles.statLabel}>{row.label}</td>;
    if (key === "DIFFLabel") {
      const diffValue = row.DIFF;
      const color =
        diffValue !== undefined
          ? diffValue >= 0
            ? "limegreen"
            : "red"
          : "#fff";
      const displayValue =
        diffValue !== undefined ? `${diffValue.toFixed(1)}%` : "-";
      return <td style={{ color }}>{displayValue}</td>;
    }
    // For other keys which are keys of TableAggregateData
    const value = row[key as keyof TableAggregateData];
    const numberValue = typeof value === "number" ? value : undefined;
    return <td>{formatCell(row.label, numberValue)}</td>;
  };

  return (
    <div
      className={title === "COUNTS" ? styles.countsTable : styles.ratesTable}
    >
      <table aria-label={`${title} Table`}>
        <thead>
          {/* Title label row */}
          <tr
            className={
              title === "COUNTS" ? styles.countsLabel : styles.ratesLabel
            }
          >
            <th colSpan={columnOrder.length}>{title}</th>
          </tr>
          {/* Column headers */}
          <tr>
            {columnOrder.map((key) => (
              <th key={String(key)}>{columnHeaders[String(key)]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columnOrder.length}>
                Loading {title.toLowerCase()} data...
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={columnOrder.length}>{error}</td>
            </tr>
          ) : data.length > 0 ? (
            data.map((row, rowIndex) => (
              <tr
                key={`${title.toLowerCase()}-row-${rowIndex}`}
                className={row.label === "GP" ? styles.gpRow : ""}
              >
                {columnOrder.map((key) => (
                  <React.Fragment key={`${String(key)}-${rowIndex}`}>
                    {getStatValue(row, key)}
                  </React.Fragment>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columnOrder.length}>No data available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StatsTable;
