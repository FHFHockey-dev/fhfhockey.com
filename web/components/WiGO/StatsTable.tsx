// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTable.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { TableAggregateData } from "./types";
import styles from "styles/wigoCharts.module.scss";
import GameLogChart from "./StatsTableRowChart"; // Keep using this, but triggered differently
import {
  fetchPlayerGameLogForStat,
  GameLogDataPoint
} from "utils/fetchWigoPlayerStats";

interface StatsTableProps {
  title: "COUNTS" | "RATES"; // Use literal types
  data: TableAggregateData[]; // This structure remains the same input
  isLoading: boolean;
  error: string | null;
  formatCell: (
    row: TableAggregateData, // The original row data for a stat
    columnKey: DataColumnKey // The original column key (e.g., 'CA', 'LY')
  ) => string;
  playerId: number;
  currentSeasonId: number;
  leftTimeframe: keyof TableAggregateData; // Needed for DIFF calculation context
  rightTimeframe: keyof TableAggregateData; // Needed for DIFF calculation context
}

// Original column keys (now represent rows)
type DataColumnKey = keyof Omit<TableAggregateData, "label" | "GP" | "DIFF">;

// Keys for the rows in the transposed table
const rowKeys: (DataColumnKey | "DIFFLabel")[] = [
  "CA",
  "3YA",
  "LY",
  "L5",
  "L10",
  "L20",
  "STD",
  "DIFFLabel" // Add DIFF row key
];

const rowHeaders: { [key: string]: string } = {
  CA: "CA",
  "3YA": "3YA",
  LY: "LY",
  L5: "L5",
  L10: "L10",
  L20: "L20",
  STD: "STD",
  DIFFLabel: "DIFF"
};

const StatsTable: React.FC<StatsTableProps> = ({
  title,
  data,
  isLoading,
  error,
  formatCell,
  playerId,
  currentSeasonId,
  leftTimeframe, // Receive timeframes
  rightTimeframe
}) => {
  const [expandedStatLabel, setExpandedStatLabel] = useState<string | null>(
    null
  );
  const [gameLogData, setGameLogData] = useState<GameLogDataPoint[]>([]);
  const [isLoadingGameLog, setIsLoadingGameLog] = useState<boolean>(false);
  const [gameLogError, setGameLogError] = useState<string | null>(null);
  const [hoveredStatLabel, setHoveredStatLabel] = useState<string | null>(null); // For column hover
  const tableRef = useRef<HTMLTableElement>(null); // Ref for table element

  // Extract stat labels to use as column headers (filter out GP if present)
  const statLabels = data.filter((d) => d.label !== "GP").map((d) => d.label);
  // Find GP data if it exists
  const gpRowData = data.find((d) => d.label === "GP");

  const handleExpandClick = useCallback(
    (statLabel: string) => {
      const newLabel = expandedStatLabel === statLabel ? null : statLabel;
      setExpandedStatLabel(newLabel);
      setGameLogData([]); // Clear previous data
      setGameLogError(null); // Clear previous error

      if (newLabel !== null) {
        // Only fetch if expanding a new column
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
    [expandedStatLabel, playerId, currentSeasonId] // Dependencies
  );

  // Function to get the data for a specific cell in the transposed table
  const getCellValue = (
    rowKey: DataColumnKey | "DIFFLabel",
    statLabel: string
  ) => {
    const statData = data.find((d) => d.label === statLabel);
    if (!statData) return "-"; // Should not happen if statLabels derived correctly

    if (rowKey === "DIFFLabel") {
      const diffValue = statData.DIFF; // DIFF is pre-calculated on the data object
      const color =
        diffValue !== undefined && diffValue !== null
          ? diffValue >= 0
            ? "rgb(18, 193, 126)" // Green for positive/zero
            : "rgb(240, 85, 118)" // Red for negative
          : "#fff"; // Default color if undefined/null
      const displayValue =
        diffValue !== undefined && diffValue !== null
          ? `${diffValue.toFixed(1)}%` // Format as percentage
          : "-";
      return <span style={{ color }}>{displayValue}</span>;
    } else {
      // Use the original formatCell for regular data points
      // Note: formatCell expects the *original* row structure (the statData)
      // and the *original* column key (which is now our rowKey)
      return formatCell(statData, rowKey as DataColumnKey);
    }
  };

  // Helper to get averages for the chart (needs the data for the specific stat)
  const getAveragesForChart = (statLabel: string) => {
    const statData = data.find((d) => d.label === statLabel);
    if (!statData) return {}; // Return empty object if not found
    return {
      STD: statData.STD,
      LY: statData.LY,
      "3YA": statData["3YA"],
      CA: statData.CA,
      L5: statData.L5,
      L10: statData.L10,
      L20: statData.L20
    };
  };

  // **** Helper to get GP data for the chart ****
  const getGpDataForChart = () => {
    // GP data is now separate, not tied to a specific stat row in the original sense
    // Pass the entire GP data object if available
    return gpRowData?.GP; // Return the GP object (or undefined)
  };

  // Find the data for the currently expanded stat
  const expandedStatData = expandedStatLabel
    ? data.find((d) => d.label === expandedStatLabel)
    : null;

  // Column Hover Handlers
  const handleColumnHeaderMouseEnter = (statLabel: string) => {
    setHoveredStatLabel(statLabel);
  };

  const handleColumnHeaderMouseLeave = () => {
    setHoveredStatLabel(null);
  };

  // Calculate total columns for colSpan
  const totalColumns = statLabels.length + 1; // +1 for the timeframe header column

  return (
    <div
      className={`${styles.transposedTableContainer} ${
        title === "COUNTS" ? styles.countsTable : styles.ratesTable
      }`}
    >
      <table
        ref={tableRef}
        aria-label={`${title} Transposed Table`}
        className={`${styles.statsTableActual} ${styles.transposedTable}`} // Add transposedTable class for specific styling
      >
        {/* No colgroup needed as width is less predictable */}
        <thead>
          <tr>
            {/* First header cell is for Timeframes */}
            <th className={styles.timeframeHeader}>
              {title} {/* Or maybe leave empty */}
            </th>
            {/* Map stat labels to column headers */}
            {statLabels.map((label) => (
              <th
                key={label}
                className={hoveredStatLabel === label ? styles.columnHover : ""}
                onMouseEnter={() => handleColumnHeaderMouseEnter(label)}
                onMouseLeave={handleColumnHeaderMouseLeave}
              >
                <div className={styles.headerContent}>
                  <span>{label}</span>
                  <button
                    onClick={() => handleExpandClick(label)}
                    className={styles.expandButton}
                    aria-expanded={expandedStatLabel === label}
                    aria-controls={`chart-${title.toLowerCase()}-${label}`} // Use label for unique ID
                  >
                    {expandedStatLabel === label ? "-" : "+"}
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              {/* Loading message spans all columns */}
              <td colSpan={totalColumns}>
                Loading {title.toLowerCase()} data...
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={totalColumns} style={{ color: "red" }}>
                {error}
              </td>
            </tr>
          ) : data.length > 0 && statLabels.length > 0 ? (
            // Map row keys (CA, 3YA, ..., DIFF) to table rows
            rowKeys.map((rowKey) => (
              <tr key={rowKey}>
                {/* First cell is the row header (Timeframe/DIFF) */}
                <td className={styles.timeframeCell}>{rowHeaders[rowKey]}</td>
                {/* Map stat labels to data cells within this row */}
                {statLabels.map((statLabel) => (
                  <td
                    key={`${rowKey}-${statLabel}`}
                    className={
                      hoveredStatLabel === statLabel ? styles.columnHover : ""
                    }
                    // Add mouse enter/leave here too if needed for full column hover persistence
                    onMouseEnter={() => handleColumnHeaderMouseEnter(statLabel)}
                    onMouseLeave={handleColumnHeaderMouseLeave}
                  >
                    {getCellValue(rowKey, statLabel)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={totalColumns}>No data available.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Conditionally rendered chart container - Rendered *after* the main table */}
      {expandedStatLabel && expandedStatData && (
        <div
          id={`chart-${title.toLowerCase()}-${expandedStatLabel}`}
          className={styles.chartRowExpanded} // Use a class for styling the container
          // Style this div to visually connect it if desired
        >
          <GameLogChart
            playerId={playerId}
            seasonId={currentSeasonId}
            statLabel={expandedStatLabel} // The stat label of the expanded column
            gameLogData={gameLogData}
            // Pass averages and GP data relevant to the *expanded stat*
            averages={getAveragesForChart(expandedStatLabel)}
            gpData={getGpDataForChart()} // Pass the general GP data
            isLoading={isLoadingGameLog}
            error={gameLogError}
            tableType={title}
          />
        </div>
      )}
    </div>
  );
};

export default StatsTable;
