// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTable.tsx
<<<<<<< HEAD
<<<<<<< HEAD
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from "react";
<<<<<<< HEAD
<<<<<<< HEAD

=======
>>>>>>> 74d6d08 (some edits to wigochart)
=======
>>>>>>> 5d11cb6 (some edits to wigochart)
=======
import React, { useState, useEffect, useCallback, useRef } from "react";
>>>>>>> e3cc089 (some edits to wigochart)
=======
import React, { useState, useEffect, useCallback, useRef } from "react";
=======
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from "react";

>>>>>>> 683a2bc (some edits to wigochart)
>>>>>>> dd002b4 (some edits to wigochart)
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
  tableTitle = "",
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
  );
  const [gameLogData, setGameLogData] = useState<GameLogDataPoint[]>([]);
  const [isLoadingGameLog, setIsLoadingGameLog] = useState<boolean>(false);
  const [gameLogError, setGameLogError] = useState<string | null>(null);
  const [hoveredStatLabel, setHoveredStatLabel] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(
    null
  );

  // Extract stat labels (columns) from the combined data
<<<<<<< HEAD
  const statLabels = useMemo(
    () => data.filter((d) => d.label !== "GP").map((d) => d.label),
    [data]
  );
  const gpRowData = useMemo(() => data.find((d) => d.label === "GP"), [data]);
<<<<<<< HEAD
=======

<<<<<<< HEAD
  // Initialize column order
  useEffect(() => {
    if (statLabels.length > 0) {
      setColumnOrder(statLabels);
    }
  }, [statLabels]);

  // Scroll table to show selected column in position 2
  useEffect(() => {
    if (selectedColumnIndex !== null && tableRef.current) {
      const table = tableRef.current;
      const column = table.querySelector(
        `th:nth-child(${selectedColumnIndex + 2})`
      );
      if (column) {
        const columnRect = column.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        const scrollLeft = columnRect.left - tableRect.left - 100; // 100px offset for timeframe column
        table.scrollTo({
          left: scrollLeft,
          behavior: "smooth"
        });
      }
    }
  }, [selectedColumnIndex, columnOrder]);
>>>>>>> 5d11cb6 (some edits to wigochart)
=======
  const statLabels = data.filter((d) => d.label !== "GP").map((d) => d.label);
  const gpRowData = data.find((d) => d.label === "GP");
>>>>>>> e3cc089 (some edits to wigochart)

  // Initialize column order
  useEffect(() => {
    if (statLabels.length > 0) {
      setColumnOrder(statLabels);
    }
  }, [statLabels]);

  // Scroll table to show selected column in position 2
  useEffect(() => {
    if (selectedColumnIndex !== null && tableRef.current) {
      const table = tableRef.current;
      const column = table.querySelector(
        `th:nth-child(${selectedColumnIndex + 2})`
      );
      if (column) {
        const columnRect = column.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        const scrollLeft = columnRect.left - tableRect.left - 100; // 100px offset for timeframe column
        table.scrollTo({
          left: scrollLeft,
          behavior: "smooth"
        });
      }
    }
  }, [selectedColumnIndex, columnOrder]);

=======
>>>>>>> dd002b4 (some edits to wigochart)
  const handleExpandClick = useCallback(
    (statLabel: string) => {
      const newLabel = expandedStatLabel === statLabel ? null : statLabel;
      setExpandedStatLabel(newLabel);
      setGameLogData([]);
      setGameLogError(null);

      if (newLabel !== null) {
        // Find the index of the selected column
        const index = columnOrder.indexOf(statLabel);
        setSelectedColumnIndex(index);

        // Determine if the expanded stat is a count or rate for the chart
        const isCountStat = countStatLabels.includes(newLabel);
        const typeForChart: "COUNTS" | "RATES" = isCountStat
          ? "COUNTS"
          : "RATES";
        setExpandedStatType(typeForChart);

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
      } else {
        setSelectedColumnIndex(null);
      }
    },
    [expandedStatLabel, playerId, currentSeasonId, columnOrder]
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

  return (
    <div
      className={`${styles.transposedTableContainer} ${
        expandedStatLabel ? styles.hasExpandedChart : ""
      }`}
    >
      {/* Timeframe Table */}
      <table className={styles.timeframeTable}>
        <thead>
          <tr>
            <th>Stat</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td>Loading...</td>
            </tr>
          ) : error ? (
            <tr>
              <td style={{ color: "red" }}>{error}</td>
            </tr>
          ) : data.length > 0 && statLabels.length > 0 ? (
            rowKeys.map((rowKey) => (
              <tr key={rowKey}>
                <td>{rowHeaders[rowKey]}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td>No data</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Stats Table */}
      <table className={styles.statsTable}>
        <thead>
          <tr>
            {columnOrder.map((label, index) => (
              <React.Fragment key={label}>
                <th
                  className={`${
                    hoveredStatLabel === label ? styles.columnHover : ""
                  }`}
                  onMouseEnter={() => handleColumnHeaderMouseEnter(label)}
                  onMouseLeave={handleColumnHeaderMouseLeave}
                >
                  <div className={styles.headerContent}>
                    <span>{label}</span>
                    <button
                      onClick={() => handleExpandClick(label)}
                      className={styles.expandButton}
                      aria-expanded={expandedStatLabel === label}
                      aria-controls={`chart-${label}`}
                    >
                      {expandedStatLabel === label ? "-" : "+"}
                    </button>
                  </div>
                </th>
                <th
                  className={`${styles.chartColumn} ${
                    expandedStatLabel === label ? styles.visible : ""
                  }`}
                >
                  {expandedStatLabel === label && (
                    <div className={styles.chartColumnHeader}>
                      {`${label} Per Game - ${currentSeasonId
                        .toString()
                        .slice(0, 4)}-${currentSeasonId
                        .toString()
                        .slice(6, 8)}`}
                    </div>
                  )}
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columnOrder.length * 2}>Loading stats data...</td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={columnOrder.length * 2} style={{ color: "red" }}>
                {error}
              </td>
            </tr>
          ) : data.length > 0 && statLabels.length > 0 ? (
            <>
              <tr>
                {columnOrder.map((statLabel) => (
                  <React.Fragment key={statLabel}>
                    <td
                      className={`${
                        hoveredStatLabel === statLabel ? styles.columnHover : ""
                      }`}
                      onMouseEnter={() =>
                        handleColumnHeaderMouseEnter(statLabel)
                      }
                      onMouseLeave={handleColumnHeaderMouseLeave}
                    >
                      {getCellValue(rowKeys[0], statLabel)}
                    </td>
                    <td
                      className={`${styles.chartColumn} ${
                        expandedStatLabel === statLabel ? styles.visible : ""
                      }`}
                      rowSpan={rowKeys.length}
                    >
                      {expandedStatLabel === statLabel && (
                        <div
                          id={`chart-${statLabel}`}
                          className={`${styles.chartColumnContent} ${
                            gameLogData.length > 0 ? styles.visible : ""
                          }`}
                        >
                          <GameLogChart
                            playerId={playerId}
                            seasonId={currentSeasonId}
                            statLabel={statLabel}
                            gameLogData={gameLogData}
                            averages={getAveragesForChart(statLabel)}
                            gpData={getGpDataForChart()}
                            isLoading={isLoadingGameLog}
                            error={gameLogError}
                            tableType={expandedStatType}
                          />
                        </div>
                      )}
                    </td>
                  </React.Fragment>
                ))}
              </tr>
              {rowKeys.slice(1).map((rowKey) => (
                <tr key={rowKey}>
                  {columnOrder.map((statLabel) => (
                    <td
                      key={statLabel}
                      className={`${
                        hoveredStatLabel === statLabel ? styles.columnHover : ""
                      }`}
                      onMouseEnter={() =>
                        handleColumnHeaderMouseEnter(statLabel)
                      }
                      onMouseLeave={handleColumnHeaderMouseLeave}
                    >
                      {getCellValue(rowKey, statLabel)}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ) : (
            <tr>
              <td colSpan={columnOrder.length * 2}>No data available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StatsTable;
