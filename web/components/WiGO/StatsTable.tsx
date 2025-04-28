// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTable.tsx
import React, { useState, useCallback, useMemo } from "react"; // Removed useEffect if not used
import { TableAggregateData } from "./types";
import styles from "styles/wigoCharts.module.scss";
import GameLogChart from "./StatsTableRowChart";
import {
  fetchPlayerGameLogForStat,
  GameLogDataPoint
} from "utils/fetchWigoPlayerStats";

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
  "CA",
  "3YA",
  "LY",
  "STD",
  "L20",
  "L10",
  "L5"
];

const columnHeaders: { [key in DataColumnKey | "DIFF"]: string } = {
  CA: "CA",
  "3YA": "3YA",
  LY: "LY",
  STD: "STD",
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
  currentSeasonId
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

  const handleExpandClick = useCallback(
    /* ... same as before ... */ (statLabel: string) => {
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
            <th>
              <div className={styles.headerContent}>
                <span>{tableTitle}</span>
              </div>
            </th>
            {columnKeys.map((key) => (
              <th key={key}>{columnHeaders[key]}</th>
            ))}
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
            statRowsData.map((statData) => (
              <React.Fragment key={statData.label}>
                {/* Stat Row */}
                <tr>
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
                  {/* Timeframe Data Cells - Use formatCell here */}
                  {columnKeys.map((key) => (
                    <td key={key}>{formatCell(statData, key)}</td>
                  ))}

                  {/* DIFF Cell - Handle formatting and coloring directly */}
                  <td className={styles.diffCell}>
                    {(() => {
                      // IIFE to allow conditional logic
                      const diffValue = statData.DIFF; // Get the pre-calculated DIFF value
                      if (
                        diffValue !== undefined &&
                        diffValue !== null &&
                        !isNaN(diffValue)
                      ) {
                        // 1. Determine if positive or negative
                        const isPositive = diffValue > 0;
                        const isNegative = diffValue < 0;

                        // 2. Select the CSS class based on the sign <--- COLOR LOGIC HERE
                        const colorClass = isPositive
                          ? styles.diffPositive // Use green class if positive
                          : isNegative
                          ? styles.diffNegative // Use red class if negative
                          : styles.diffNeutral; // Use neutral class if zero

                        // 3. Format the display value
                        const displayValue = `${
                          isPositive ? "+" : ""
                        }${diffValue.toFixed(1)}%`;

                        // 4. Render a span WITH THE CORRECT CSS CLASS
                        return (
                          <span className={colorClass}>{displayValue}</span>
                        );
                      } else {
                        return "-"; // Render hyphen if DIFF is not a valid number
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
            ))
          ) : (
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
