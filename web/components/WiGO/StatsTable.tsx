// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTable.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { TableAggregateData } from "./types";
import styles from "styles/wigoCharts.module.scss";
import GameLogChart from "./StatsTableRowChart";
import {
  fetchPlayerGameLogForStat,
  GameLogDataPoint
} from "utils/fetchWigoPlayerStats";

// Define which stats are generally treated as 'COUNTS' for chart purposes
// (This list might need refinement based on your specific data)
const countStatLabels = [
  "Goals",
  "Assists",
  "Points",
  "SOG",
  "ixG",
  "PPG",
  "PPA",
  "PPP",
  "HIT",
  "BLK",
  "PIM",
  "iCF",
  "ATOI", // Even though time, it's often aggregated like a count total
  "PPTOI" // Same as ATOI
  // Add any other stat labels that should be treated as counts
];

interface StatsTableProps {
  // title?: "COUNTS" | "RATES"; // Title is now optional or removed
  tableTitle?: string; // Optional generic title for the combined table header
  data: TableAggregateData[]; // Combined counts and rates data
  isLoading: boolean;
  error: string | null;
  formatCell: (
    row: TableAggregateData,
    columnKey: DataColumnKey
  ) => string | React.ReactNode; // Allow ReactNode for DIFF span
  playerId: number;
  currentSeasonId: number;
  leftTimeframe: keyof TableAggregateData;
  rightTimeframe: keyof TableAggregateData;
}

type DataColumnKey = keyof Omit<TableAggregateData, "label" | "GP" | "DIFF">;

const rowKeys: (DataColumnKey | "DIFFLabel")[] = [
  "CA",
  "3YA",
  "LY",
  "L5",
  "L10",
  "L20",
  "STD",
  "DIFFLabel"
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
  tableTitle = "", // Default title if needed
  data,
  isLoading,
  error,
  formatCell,
  playerId,
  currentSeasonId,
  leftTimeframe,
  rightTimeframe
}) => {
  const [expandedStatLabel, setExpandedStatLabel] = useState<string | null>(
    null
  );
  const [expandedStatType, setExpandedStatType] = useState<"COUNTS" | "RATES">(
    "RATES"
  ); // Default, will be set on expand
  const [gameLogData, setGameLogData] = useState<GameLogDataPoint[]>([]);
  const [isLoadingGameLog, setIsLoadingGameLog] = useState<boolean>(false);
  const [gameLogError, setGameLogError] = useState<string | null>(null);
  const [hoveredStatLabel, setHoveredStatLabel] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Extract stat labels (columns) from the combined data
  const statLabels = data.filter((d) => d.label !== "GP").map((d) => d.label);
  const gpRowData = data.find((d) => d.label === "GP");

  const handleExpandClick = useCallback(
    (statLabel: string) => {
      const newLabel = expandedStatLabel === statLabel ? null : statLabel;
      setExpandedStatLabel(newLabel);
      setGameLogData([]);
      setGameLogError(null);

      if (newLabel !== null) {
        // Determine if the expanded stat is a count or rate for the chart
        const isCountStat = countStatLabels.includes(newLabel);
        const typeForChart: "COUNTS" | "RATES" = isCountStat
          ? "COUNTS"
          : "RATES";
        setExpandedStatType(typeForChart); // Store the type

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
    [expandedStatLabel, playerId, currentSeasonId] // Removed data dependency here - not needed for triggering fetch
  );

  const getCellValue = (
    rowKey: DataColumnKey | "DIFFLabel",
    statLabel: string
  ) => {
    const statData = data.find((d) => d.label === statLabel);
    if (!statData) return "-";

    if (rowKey === "DIFFLabel") {
      // DIFF calculation likely happens in the parent before data is passed
      const diffValue = statData.DIFF;
      const color =
        diffValue !== undefined && diffValue !== null
          ? diffValue >= 0
            ? "rgb(18, 193, 126)"
            : "rgb(240, 85, 118)"
          : "#fff";
      const displayValue =
        diffValue !== undefined && diffValue !== null
          ? `${diffValue.toFixed(1)}%`
          : "-";
      return <span style={{ color }}>{displayValue}</span>;
    } else {
      // Use the original formatCell, assuming it handles both counts/rates formatting
      return formatCell(statData, rowKey as DataColumnKey);
    }
  };

  const getAveragesForChart = (statLabel: string) => {
    const statData = data.find((d) => d.label === statLabel);
    if (!statData) return {};
    // Return all potential average keys
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

  const getGpDataForChart = () => {
    return gpRowData?.GP;
  };

  const expandedStatData = expandedStatLabel
    ? data.find((d) => d.label === expandedStatLabel)
    : null;

  const handleColumnHeaderMouseEnter = (statLabel: string) => {
    setHoveredStatLabel(statLabel);
  };

  const handleColumnHeaderMouseLeave = () => {
    setHoveredStatLabel(null);
  };

  const totalColumns = statLabels.length + 1;

  return (
    // Remove conditional class, maybe add a generic one if needed
    <div className={`${styles.transposedTableContainer}`}>
      <table
        ref={tableRef}
        aria-label={`${tableTitle} Table`} // Use generic title
        className={`${styles.statsTableActual} ${styles.transposedTable}`}
      >
        <thead>
          <tr>
            <th className={styles.timeframeHeader}>
              {tableTitle} {/* Display generic title */}
            </th>
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
                    // Unique ID based on label (no title needed)
                    aria-controls={`chart-${label}`}
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
              <td colSpan={totalColumns}>Loading stats data...</td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={totalColumns} style={{ color: "red" }}>
                {error}
              </td>
            </tr>
          ) : data.length > 0 && statLabels.length > 0 ? (
            rowKeys.map((rowKey) => (
              <tr key={rowKey}>
                <td className={styles.timeframeCell}>{rowHeaders[rowKey]}</td>
                {statLabels.map((statLabel) => (
                  <td
                    key={`${rowKey}-${statLabel}`}
                    className={
                      hoveredStatLabel === statLabel ? styles.columnHover : ""
                    }
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

      {/* Chart container - ID uses only label */}
      {expandedStatLabel && expandedStatData && (
        <div
          id={`chart-${expandedStatLabel}`} // Unique ID based on label
          className={styles.chartRowExpanded}
        >
          <GameLogChart
            playerId={playerId}
            seasonId={currentSeasonId}
            statLabel={expandedStatLabel}
            gameLogData={gameLogData}
            averages={getAveragesForChart(expandedStatLabel)}
            gpData={getGpDataForChart()}
            isLoading={isLoadingGameLog}
            error={gameLogError}
            // Pass the determined type
            tableType={expandedStatType}
          />
        </div>
      )}
    </div>
  );
};

export default StatsTable;
