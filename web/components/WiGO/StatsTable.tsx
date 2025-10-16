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
  "GP",
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
  formatCell: (
    row: TableAggregateData,
    columnKey: keyof Omit<TableAggregateData, "label" | "GP" | "DIFF"> // Keep Omit here
  ) => string; // It returns string based on its implementation
  playerId: number;
  currentSeasonId: number;
  leftTimeframe: keyof TableAggregateData;
  rightTimeframe: keyof TableAggregateData;
  // Optional: restrict which data columns are visible (e.g., for mobile)
  visibleColumns?: Array<keyof Omit<TableAggregateData, "label" | "GP" | "DIFF">>;
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
  formatCell,
  playerId,
  currentSeasonId,
  leftTimeframe,
  rightTimeframe,
  visibleColumns
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

  // const statRowsData = useMemo(
  //   () => data.filter((d) => d.label !== "GP"),
  //   [data]
  // );
  // const gpRowData = useMemo(() => data.find((d) => d.label === "GP"), [data]);

  // --- Calculate highlight indices ---
  // Determine which columns to render (allow caller to limit visible ones)
  const renderColumnKeys: DataColumnKey[] = useMemo(() => {
    if (!visibleColumns || visibleColumns.length === 0) return columnKeys;
    // Keep original order from columnKeys, include only those specified, ensure uniqueness
    const desired = new Set(
      visibleColumns as DataColumnKey[]
    );
    return columnKeys.filter((k) => desired.has(k));
  }, [visibleColumns]);

  const leftIndex = renderColumnKeys.indexOf(leftTimeframe as DataColumnKey);
  const rightIndex = renderColumnKeys.indexOf(rightTimeframe as DataColumnKey);

  // Determine the actual start and end index of the highlighted block
  const validIndices = [leftIndex, rightIndex].filter((index) => index !== -1);
  const minHighlightIndex =
    validIndices.length > 0 ? Math.min(...validIndices) : -1;
  const maxHighlightIndex =
    validIndices.length > 0 ? Math.max(...validIndices) : -1;

  const handleExpandClick = useCallback(
    (statLabel: string) => {
      // Don't allow expanding the GP row if it doesn't make sense
      if (statLabel === "GP") {
        setExpandedStatLabel(null); // Close any open chart
        return;
      }

      const newLabel = expandedStatLabel === statLabel ? null : statLabel;
      setExpandedStatLabel(newLabel);
      // ... (rest of handleExpandClick remains the same) ...
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
    [expandedStatLabel, playerId, currentSeasonId] // Removed dependency on statRowsData/gpRowData
  );

  const getAveragesForChart = useCallback(
    (statLabel: string) => {
      // Find the specific row from the main data array
      const statData = data.find((d) => d.label === statLabel);
      if (!statData) return {};
      // Return the values needed for the chart's average lines
      return {
        STD: statData.STD,
        LY: statData.LY,
        "3YA": statData["3YA"],
        CA: statData.CA,
        L5: statData.L5,
        L10: statData.L10,
        L20: statData.L20
      };
    },
    [data] // Depend on the main data array
  );

  const getGpMetadataForChart = useCallback(() => {
    const gpRow = data.find((d) => d.label === "GP");
    if (gpRow) {
      return {
        STD: gpRow.STD,
        LY: gpRow.LY,
        "3YA": gpRow["3YA"],
        CA: gpRow.CA,
        L5: gpRow.L5,
        L10: gpRow.L10,
        L20: gpRow.L20
      };
    }
    // If it has a nested GP object like other rows (less likely for the GP row itself):
    // return gpRow?.GP;
    return undefined; // Return undefined if GP row not found
  }, [data]);

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
            {renderColumnKeys.map((key, index) => {
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
          ) : data.length > 0 ? (
            data.map((statData, rowIndex) => {
              const isLastRow = rowIndex === data.length - 1; // <--- Use 'data.length'
              const isGpRow = statData.label === "GP"; // Check if it's the GP row

              return (
                <React.Fragment key={statData.label}>
                  {/* Stat Row */}
                  <tr>
                    {/* Stat Label Cell */}
                    <td className={styles.statLabelCell}>
                      <div className={styles.statLabelContent}>
                        <span>{statData.label}</span>
                        {/* Conditionally render expand button (e.g., hide for GP) */}
                        {!isGpRow && ( // <-- Don't show expand for GP row
                          <button
                            onClick={() => handleExpandClick(statData.label)}
                            className={styles.expandButton}
                            aria-expanded={expandedStatLabel === statData.label}
                            aria-controls={`chart-${statData.label}`}
                          >
                            {expandedStatLabel === statData.label ? "-" : "+"}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Data Cells */}
                    {renderColumnKeys.map((key, index) => {
                      // Get index from map
                      const isHighlighted =
                        key === leftTimeframe || key === rightTimeframe;
                      const isMin = index === minHighlightIndex;
                      const isMax = index === maxHighlightIndex;

                      // Combine classes using clsx
                      const tdClasses = clsx({
                        [styles.highlightedLeft]: key === leftTimeframe,
                        [styles.highlightedRight]: key === rightTimeframe,
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

                    {/* DIFF Cell */}
                    <td className={styles.diffCell}>
                      {(() => {
                        const diffValue = statData.DIFF; // Keep as is if % change in GP is desired

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
                          }${diffValue.toFixed(1)}%`; // Assuming DIFF is always percentage
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
                            // Pass averages for the *specific* stat being expanded
                            averages={getAveragesForChart(statData.label)}
                            // Pass GP metadata if chart needs it (e.g., for per-game calcs)
                            gpData={getGpMetadataForChart()} // <-- Use the updated helper
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
