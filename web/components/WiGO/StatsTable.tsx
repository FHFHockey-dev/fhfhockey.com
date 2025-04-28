// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTable.tsx
import React, { useState, useCallback, useMemo } from "react"; // Removed useEffect if not used
import { TableAggregateData } from "./types";
import styles from "styles/wigoCharts.module.scss";
import GameLogChart from "./StatsTableRowChart";
import {
  fetchPlayerGameLogForStat,
  GameLogDataPoint
} from "utils/fetchWigoPlayerStats";
import clsx from "clsx";

// Define which stats are generally treated as 'COUNTS' for chart purposes
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
  "ATOI",
  "PPTOI"
];

interface StatsTableProps {
  tableTitle?: string;
  data: TableAggregateData[];
  isLoading: boolean;
  error: string | null;
  // Update formatCell's type definition to reflect its actual usage
  formatCell: (
    row: TableAggregateData,
    columnKey: keyof Omit<TableAggregateData, "label" | "GP" | "DIFF"> // Keep Omit here
  ) => string; // It returns string based on its implementation
  playerId: number;
  currentSeasonId: number;
  leftTimeframe: keyof TableAggregateData;
  rightTimeframe: keyof TableAggregateData;
}

// These are the keys for the standard data COLUMNS
type DataColumnKey = keyof Omit<TableAggregateData, "label" | "GP" | "DIFF">;

// Define Column Keys and Headers
const columnKeys: DataColumnKey[] = [
  "STD", // Moved to first position after Stat Label
  "LY",
  "CA",
  "3YA",
  "L5",
  "L10",
  "L20"
];

const columnHeaders: { [key in DataColumnKey | "DIFF"]: string } = {
  STD: "STD",
  CA: "CA",
  "3YA": "3YA",
  LY: "LY",
  L20: "L20",
  L10: "L10",
  L5: "L5",
  DIFF: "DIFF"
};

// --- Component Start ---
const StatsTable: React.FC<StatsTableProps> = ({
  tableTitle = "Stat",
  data,
  isLoading,
  error,
  formatCell, // Keep the prop
  playerId,
  currentSeasonId,
  leftTimeframe,
  rightTimeframe
}) => {
  const [expandedStatLabel, setExpandedStatLabel] = useState<string | null>(
    null
  );
  const [gameLogData, setGameLogData] = useState<GameLogDataPoint[]>([]);
  const [isLoadingGameLog, setIsLoadingGameLog] = useState<boolean>(false);
  const [gameLogError, setGameLogError] = useState<string | null>(null);
  const [expandedStatType, setExpandedStatType] = useState<"COUNTS" | "RATES">(
    "RATES"
  );

  const statRowsData = useMemo(
    () => data.filter((d) => d.label !== "GP"),
    [data]
  );
  const gpRowData = useMemo(() => data.find((d) => d.label === "GP"), [data]);

  // --- Calculate highlight indices ---
  const leftIndex = columnKeys.indexOf(leftTimeframe as DataColumnKey);
  const rightIndex = columnKeys.indexOf(rightTimeframe as DataColumnKey);

  // Determine the actual start and end index of the highlighted block
  const validIndices = [leftIndex, rightIndex].filter((index) => index !== -1);
  const minHighlightIndex =
    validIndices.length > 0 ? Math.min(...validIndices) : -1;
  const maxHighlightIndex =
    validIndices.length > 0 ? Math.max(...validIndices) : -1;

  const handleExpandClick = useCallback(
    (statLabel: string) => {
      const newLabel = expandedStatLabel === statLabel ? null : statLabel;
      setExpandedStatLabel(newLabel);
      setGameLogData([]);
      setGameLogError(null);

      if (newLabel !== null) {
        const isCountStat = countStatLabels.includes(newLabel);
        const typeForChart: "COUNTS" | "RATES" = isCountStat
          ? "COUNTS"
          : "RATES";
        setExpandedStatType(typeForChart);

        setIsLoadingGameLog(true);
        fetchPlayerGameLogForStat(playerId, currentSeasonId, statLabel)
          .then((fetchedData) => {
            setGameLogData(fetchedData);
            setIsLoadingGameLog(false);
          })
          .catch((err) => {
            console.error("Error fetching game log:", err);
            setGameLogError(`Failed to load game log for ${statLabel}.`);
            setIsLoadingGameLog(false);
          });
      }
    },
    [expandedStatLabel, playerId, currentSeasonId]
  );

  const getAveragesForChart = /* ... same as before ... */ (
    statLabel: string
  ) => {
    const statData = statRowsData.find((d) => d.label === statLabel);
    if (!statData) return {};
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

  const getGpDataForChart = /* ... same as before ... */ () => {
    return gpRowData?.GP;
  };

  const totalColumns = columnKeys.length + 2;

  return (
    <div className={styles.statsTableContainer}>
      <table className={styles.statsTable}>
        <thead>
          <tr>
            {/* Stat Header (No Highlight) */}
            <th>
              <div className={styles.headerContent}>
                <span>{tableTitle}</span>
              </div>
            </th>

            {/* Data Column Headers */}
            {columnKeys.map((key, index) => {
              // Get index from map
              const isHighlighted =
                key === leftTimeframe || key === rightTimeframe;
              const isMin = index === minHighlightIndex;
              const isMax = index === maxHighlightIndex;

              // Combine classes using clsx
              const thClasses = clsx({
                [styles.highlightedLeft]: key === leftTimeframe,
                [styles.highlightedRight]: key === rightTimeframe,
                // Apply corner class if this cell is highlighted AND is the min/max index
                [styles.highlightCornerTopLeft]: isHighlighted && isMin,
                [styles.highlightCornerTopRight]: isHighlighted && isMax
              });

              return (
                <th key={key} className={thClasses}>
                  {columnHeaders[key]}
                </th>
              );
            })}

            {/* DIFF Header (No Highlight) */}
            <th>{columnHeaders["DIFF"]}</th>
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
          ) : statRowsData.length > 0 ? (
            // vvvvv CORRECT: No extra curly brace here vvvvv
            statRowsData.map((statData, rowIndex) => {
              // Get rowIndex from map
              // Determine if this is the last data row being rendered
              const isLastRow = rowIndex === statRowsData.length - 1;

              return (
                <React.Fragment key={statData.label}>
                  {/* Stat Row */}
                  <tr>
                    {/* Stat Label Cell (No Highlight) */}
                    <td className={styles.statLabelCell}>
                      <div className={styles.statLabelContent}>
                        <span>{statData.label}</span>
                        <button
                          onClick={() => handleExpandClick(statData.label)}
                          className={styles.expandButton}
                          aria-expanded={expandedStatLabel === statData.label}
                          aria-controls={`chart-${statData.label}`}
                        >
                          {expandedStatLabel === statData.label ? "-" : "+"}
                        </button>
                      </div>
                    </td>

                    {/* Data Cells */}
                    {columnKeys.map((key, index) => {
                      // Get index from map
                      const isHighlighted =
                        key === leftTimeframe || key === rightTimeframe;
                      const isMin = index === minHighlightIndex;
                      const isMax = index === maxHighlightIndex;

                      // Combine classes using clsx
                      const tdClasses = clsx({
                        [styles.highlightedLeft]: key === leftTimeframe,
                        [styles.highlightedRight]: key === rightTimeframe,
                        // Apply bottom corners ONLY if highlighted, the min/max AND it's the last row
                        [styles.highlightCornerBottomLeft]:
                          isLastRow && isHighlighted && isMin,
                        [styles.highlightCornerBottomRight]:
                          isLastRow && isHighlighted && isMax
                      });

                      return (
                        <td key={key} className={tdClasses}>
                          {formatCell(statData, key)}
                        </td>
                      );
                    })}

                    {/* DIFF Cell - Handle formatting and coloring directly */}
                    <td className={styles.diffCell}>
                      {(() => {
                        const diffValue = statData.DIFF;
                        if (
                          diffValue !== undefined &&
                          diffValue !== null &&
                          !isNaN(diffValue)
                        ) {
                          const isPositive = diffValue > 0;
                          const isNegative = diffValue < 0;
                          const colorClass = isPositive
                            ? styles.diffPositive
                            : isNegative
                            ? styles.diffNegative
                            : styles.diffNeutral;
                          const displayValue = `${
                            isPositive ? "+" : ""
                          }${diffValue.toFixed(1)}%`;
                          return (
                            <span className={colorClass}>{displayValue}</span>
                          );
                        } else {
                          return "-";
                        }
                      })()}
                    </td>
                  </tr>

                  {/* Chart Row (Conditionally Rendered) */}
                  {expandedStatLabel === statData.label && (
                    <tr
                      className={styles.chartRowExpanded}
                      id={`chart-${statData.label}`}
                    >
                      <td colSpan={totalColumns}>
                        <div className={styles.chartWrapper}>
                          <h4>{`${statData.label} Per Game - ${currentSeasonId
                            .toString()
                            .slice(0, 4)}-${currentSeasonId
                            .toString()
                            .slice(6, 8)}`}</h4>
                          <GameLogChart
                            playerId={playerId}
                            seasonId={currentSeasonId}
                            statLabel={statData.label}
                            gameLogData={gameLogData}
                            averages={getAveragesForChart(statData.label)}
                            gpData={getGpDataForChart()}
                            isLoading={isLoadingGameLog}
                            error={gameLogError}
                            tableType={expandedStatType}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            }) // <--- Correct closing parenthesis for map
          ) : (
            // ^^^^^ CORRECT: No extra curly brace here ^^^^^
            <tr>
              <td colSpan={totalColumns}>No data available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StatsTable;
