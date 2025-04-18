// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTable.tsx

import React from "react";
import { TableAggregateData } from "./types";
import styles from "styles/wigoCharts.module.scss";

type DataColumnKey = keyof Omit<TableAggregateData, "label" | "GP" | "DIFF">;

interface StatsTableProps {
  title: string; // "COUNTS" or "RATES"
  data: TableAggregateData[];
  isLoading: boolean;
  error: string | null;
  // **** UPDATE THIS PROP SIGNATURE ****
  // formatCell: (label: string, value?: number) => string; // Old Signature
  formatCell: (row: TableAggregateData, columnKey: DataColumnKey) => string; // New Signature
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

  const colWidths = [
    "18%", // Stat
    "10%", // CA
    "10%", // 3YA
    "10%", // LY
    "10%", // L5
    "10%", // L10
    "10%", // L20
    "10%", // STD
    "12%" // DIFFLabel
  ];

  // /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTable.tsx
  // Minor update needed in getStatValue to pass the correct arguments to formatCell

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
            ? "rgb(18, 193, 126)"
            : "rgb(240, 85, 118)"
          : "#fff";
      const displayValue =
        diffValue !== undefined ? `${diffValue.toFixed(1)}%` : "-";
      return <td style={{ color }}>{displayValue}</td>;
    }

    // Check if the key is one of the actual data columns before calling formatCell
    const dataColumnKeys: DataColumnKey[] = [
      "CA",
      "3YA",
      "LY",
      "L5",
      "L10",
      "L20",
      "STD"
    ];
    if (dataColumnKeys.includes(key as DataColumnKey)) {
      // Now the call signature matches the updated prop type:
      // formatCell(row: TableAggregateData, columnKey: DataColumnKey)
      return <td>{formatCell(row, key as DataColumnKey)}</td>;
    }
    // If the key is not recognized, return a default cell
    return <td>-</td>;
  };

  return (
    <div
      className={title === "COUNTS" ? styles.countsTable : styles.ratesTable}
    >
      <table aria-label={`${title} Table`} className={styles.statsTableActual}>
        <colgroup>
          {colWidths.map((width, index) => (
            <col key={index} style={{ width: width }} />
          ))}
        </colgroup>
        <thead>
          {/* Title label row */}
          {/* <tr
            className={
              title === "COUNTS" ? styles.countsLabel : styles.ratesLabel
            }
          >
            <th colSpan={columnOrder.length}>{title}</th>
          </tr> */}
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
