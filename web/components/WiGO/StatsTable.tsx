// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTable.tsx
import React, { useState, useEffect, useCallback } from "react";
import { TableAggregateData } from "./types";
import styles from "styles/wigoCharts.module.scss";
import GameLogChart from "./StatsTableRowChart"; // Import the new chart component
import {
  fetchPlayerGameLogForStat,
  GameLogDataPoint
} from "utils/fetchWigoPlayerStats";

interface StatsTableProps {
  title: "COUNTS" | "RATES"; // Use literal types
  data: TableAggregateData[];
  isLoading: boolean;
  error: string | null;
  formatCell: (row: TableAggregateData, columnKey: DataColumnKey) => string;
  playerId: number;
  currentSeasonId: number; //
}

type DataColumnKey = keyof Omit<TableAggregateData, "label" | "GP" | "DIFF">;

const StatsTable: React.FC<StatsTableProps> = ({
  title,
  data,
  isLoading,
  error,
  formatCell,
  playerId, // Get playerId
  currentSeasonId // Get currentSeasonId
}) => {
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);
  const [gameLogData, setGameLogData] = useState<GameLogDataPoint[]>([]);
  const [isLoadingGameLog, setIsLoadingGameLog] = useState<boolean>(false);
  const [gameLogError, setGameLogError] = useState<string | null>(null);

  // Define the order of columns - ADDING EXPANDER COLUMN
  const columnOrder: (
    | keyof TableAggregateData
    | "Expander"
    | "Stat"
    | "DIFFLabel"
  )[] = [
    "Expander", // New column for the +/- button
    "Stat",
    "CA",
    "3YA",
    "LY",
    "L5",
    "L10",
    "L20",
    "STD",
    "DIFFLabel"
  ];
  const columnHeaders: { [key: string]: string } = {
    Expander: "", // No header text needed
    Stat: "Stat",
    CA: "CA",
    "3YA": "3YA",
    LY: "LY",
    L5: "L5",
    L10: "L10",
    L20: "L20",
    STD: "STD",
    DIFFLabel: "DIFF"
  };

  // Adjust widths to accommodate the new Expander column
  const colWidths = [
    "5%", // Expander
    "15%", // Stat (Reduced slightly)
    "10%", // CA
    "10%", // 3YA
    "10%", // LY
    "10%", // L5
    "10%", // L10
    "10%", // L20
    "8%", // STD (Reduced slightly)
    "12%" // DIFFLabel
  ];

  const handleExpandClick = useCallback(
    (rowIndex: number, statLabel: string) => {
      const newIndex = expandedRowIndex === rowIndex ? null : rowIndex;
      setExpandedRowIndex(newIndex);
      setGameLogData([]); // Clear previous data
      setGameLogError(null); // Clear previous error

      if (newIndex !== null) {
        // Only fetch if expanding a new row
        setIsLoadingGameLog(true);
        fetchPlayerGameLogForStat(playerId, currentSeasonId, statLabel)
          .then((data) => {
            setGameLogData(data);
            setIsLoadingGameLog(false);
          })
          .catch((err) => {
            console.error("Error fetching game log:", err);
            setGameLogError(`Failed to load game log for ${statLabel}.`);
            setIsLoadingGameLog(false);
          });
      }
    },
    [expandedRowIndex, playerId, currentSeasonId]
  ); // Dependencies for the callback

  const getStatValue = (
    row: TableAggregateData,
    key: keyof TableAggregateData | "Expander" | "Stat" | "DIFFLabel",
    rowIndex: number // Need rowIndex for the click handler
  ) => {
    // Handle the new Expander column
    if (key === "Expander") {
      // Don't show expander for GP row or if data is empty/loading/error
      if (row.label === "GP" || isLoading || error || data.length === 0) {
        return <td className={styles.expanderCell}></td>; // Empty cell
      }
      return (
        <td className={styles.expanderCell}>
          <button
            onClick={() => handleExpandClick(rowIndex, row.label)}
            className={styles.expandButton}
            aria-expanded={expandedRowIndex === rowIndex}
            aria-controls={`chart-${title.toLowerCase()}-${rowIndex}`}
          >
            {expandedRowIndex === rowIndex ? "-" : "+"}
          </button>
        </td>
      );
    }

    // --- Rest of the getStatValue logic remains the same ---
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
      return <td>{formatCell(row, key as DataColumnKey)}</td>;
    }
    return <td>-</td>;
  };

  // Helper to get averages for the chart
  const getAveragesForChart = (rowData: TableAggregateData) => {
    return {
      STD: rowData.STD,
      LY: rowData.LY,
      "3YA": rowData["3YA"],
      CA: rowData.CA,
      L5: rowData.L5,
      L10: rowData.L10,
      L20: rowData.L20
    };
  };

  // **** Helper to get GP data for the chart ****
  const getGpDataForChart = (rowData: TableAggregateData) => {
    return rowData.GP; // Return the whole GP object (or null/undefined if it doesn't exist)
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
              <React.Fragment key={`${title.toLowerCase()}-row-${rowIndex}`}>
                {/* The main data row */}
                <tr className={row.label === "GP" ? styles.gpRow : ""}>
                  {columnOrder.map((key) =>
                    // Pass rowIndex to getStatValue
                    getStatValue(row, key, rowIndex)
                  )}
                </tr>
                {/* Conditionally rendered chart row */}
                {expandedRowIndex === rowIndex && (
                  <tr
                    className={styles.chartRow}
                    id={`chart-${title.toLowerCase()}-${rowIndex}`}
                  >
                    <td
                      colSpan={columnOrder.length}
                      className={styles.chartCell}
                    >
                      <GameLogChart
                        playerId={playerId}
                        seasonId={currentSeasonId}
                        statLabel={row.label}
                        gameLogData={gameLogData}
                        averages={getAveragesForChart(row)}
                        gpData={getGpDataForChart(row)}
                        isLoading={isLoadingGameLog}
                        error={gameLogError}
                        tableType={title}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
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
