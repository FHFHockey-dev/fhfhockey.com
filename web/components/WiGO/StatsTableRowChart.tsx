// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTableRowChart.tsx
import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area
} from "recharts";
import { GameLogDataPoint } from "utils/fetchWigoPlayerStats";
import { formatSecondsToMMSS } from "./tableUtils";
import styles from "styles/wigoCharts.module.scss";
import useCurrentSeason from "hooks/useCurrentSeason";
import { TableAggregateData } from "./types";
// Removed unused imports: letterSpacing, textTransform, useState (if not used elsewhere now)

interface GameLogChartProps {
  playerId: number;
  seasonId: number;
  statLabel: string;
  gameLogData: GameLogDataPoint[];
  averages: {
    STD?: number | null;
    LY?: number | null;
    "3YA"?: number | null;
    CA?: number | null;
    L5?: number | null;
    L10?: number | null;
    L20?: number | null;
  };
  gpData?: TableAggregateData["GP"];
  isLoading: boolean;
  error: string | null;
  tableType: "COUNTS" | "RATES";
}

type AverageKey = keyof GameLogChartProps["averages"];
const availableAverages: AverageKey[] = [
  "STD",
  "LY",
  "3YA",
  "CA",
  "L5",
  "L10",
  "L20"
];

const convertibleCountStats: string[] = [
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
  "iCF"
];

const averageColors: Record<AverageKey, string> = {
  STD: "#ff6b6b", // Red #ff6b6b
  LY: "#98d8a8", // Green #98d8a8
  "3YA": "#ff9f40", // Orange #ff9f40
  CA: "#14a2d2", // Blue #14a2d2
  L5: "#9b59b6", // Purple  #9b59b6
  L10: "#ffcc33", // Yellow   #ffcc33
  L20: "#cccccc" // Light Grey #cccccc
};

const GameLogChart: React.FC<GameLogChartProps> = ({
  statLabel,
  gameLogData,
  averages,
  gpData,
  isLoading,
  error,
  tableType
}) => {
  const [visibleAverages, setVisibleAverages] = useState<
    Record<AverageKey, boolean>
  >({
    STD: true,
    LY: false,
    "3YA": false,
    CA: false,
    L5: false,
    L10: false,
    L20: false
  });

  // Removed unused useCurrentSeason hook as seasonId is passed via props now
  // const currentSeasonData = useCurrentSeason();
  // const seasonId = currentSeasonData?.seasonId || 0;

  const handleAverageToggle = (key: AverageKey) => {
    setVisibleAverages((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isTOIStat = statLabel === "ATOI" || statLabel === "PPTOI";
  const isPercentStat = statLabel.includes("%") || statLabel === "IPP";

  const chartData = useMemo(() => {
    return gameLogData.map((d, index) => ({
      game: index + 1,
      date: d.date,
      value: isTOIStat && typeof d.value === "number" ? d.value / 60 : d.value
    }));
  }, [gameLogData, isTOIStat]);

  const seasonAverageValue = useMemo(() => {
    if (!gameLogData || gameLogData.length === 0) return null;
    const validValues = gameLogData
      .map((d) => d.value)
      .filter((v) => typeof v === "number") as number[];
    if (validValues.length === 0) return null;
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return sum / validValues.length;
  }, [gameLogData]);

  const seasonAverageReference = useMemo(() => {
    if (seasonAverageValue === null) return null;
    return isTOIStat ? seasonAverageValue / 60 : seasonAverageValue;
  }, [seasonAverageValue, isTOIStat]);

  const formatDisplayValue = (
    value: number | null | undefined,
    statType: "TOI" | "Percent" | "CountPerGame" | "Other"
  ): string => {
    if (value == null || isNaN(value)) return "-";
    switch (statType) {
      case "TOI":
        return formatSecondsToMMSS(value);
      case "Percent":
        return `${(value * 100).toFixed(1)}%`;
      case "CountPerGame":
        return value.toFixed(2);
      case "Other":
      default:
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = chartData.find((d) => d.game === label);
      if (!dataPoint) return null;
      const rawValue = payload[0].value;
      let formattedValue = "N/A";
      if (typeof rawValue === "number") {
        if (isTOIStat)
          formattedValue = formatDisplayValue(rawValue * 60, "TOI");
        else if (isPercentStat)
          formattedValue = formatDisplayValue(rawValue, "Percent");
        else formattedValue = formatDisplayValue(rawValue, "Other");
      }
      return (
        <div className={styles.chartTooltip}>
          <p>{`Game ${label} (${dataPoint.date})`}</p>
          <p>{`${statLabel}: ${formattedValue}`}</p>
        </div>
      );
    }
    return null;
  };

  // Adjust chart height if needed for row layout, REMOVE fixed width
  const chartHeight = 220; // Increased height slightly for better visibility in a row

  // **** RENDER LOGIC ****
  if (isLoading)
    return <div className={styles.chartStatus}>Loading game log...</div>;
  if (error)
    return (
      <div className={styles.chartStatus} style={{ color: "red" }}>
        {error}
      </div>
    );
  if (gameLogData.length === 0)
    return (
      <div className={styles.chartStatus}>
        No game log data available for this season.
      </div>
    );

  return (
    <div className={styles.gameLogChartContainer}>
      <div className={styles.averageToggleButtons}>
        {availableAverages.map((key) => {
          const avgValue = averages[key];
          const gpValue = gpData?.[key];
          let valueForButton = avgValue;
          let formattingType: "TOI" | "Percent" | "CountPerGame" | "Other" =
            "Other";
          let suffix = "";
          if (avgValue != null) {
            if (isTOIStat) {
              valueForButton = avgValue * 60;
              formattingType = "TOI";
            } else if (isPercentStat) {
              formattingType = "Percent";
            } else if (
              tableType === "COUNTS" &&
              convertibleCountStats.includes(statLabel) &&
              typeof gpValue === "number" &&
              gpValue > 0
            ) {
              valueForButton = avgValue / gpValue;
              formattingType = "CountPerGame";
              suffix = "/GP";
            } else if (tableType === "RATES") {
              formattingType = "Other";
            }
          }
          const buttonColor = averageColors[key];
          const isActive = visibleAverages[key];
          if (valueForButton != null) {
            return (
              <button
                key={key}
                onClick={() => handleAverageToggle(key)}
                className={`${styles.avgButton} ${
                  isActive ? styles.active : ""
                }`}
                style={
                  isActive
                    ? { backgroundColor: buttonColor, borderColor: buttonColor }
                    : {}
                }
              >
                {key}: {formatDisplayValue(valueForButton, formattingType)}{" "}
                {suffix}
              </button>
            );
          }
          return null;
        })}
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 0, bottom: 20 }}
        >
          {" "}
          {/* Adjusted margins */}
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="game"
            label={{
              value: "Game",
              position: "insideBottom",
              offset: -15,
              style: {
                textAnchor: "middle",
                fontSize: "10px",
                fill: "#ccc",
                fontWeight: "bold",
                letterSpacing: "2px",
                textTransform: "uppercase"
              }
            }}
            tick={{ fontSize: 9, fill: "#aaa" }}
            height={35} // Increased height for label
          />
          <YAxis
            tickFormatter={(tick) =>
              formatDisplayValue(
                isTOIStat ? tick * 60 : tick,
                isTOIStat ? "TOI" : "Other"
              )
            }
            tick={{ fontSize: 9, fill: "#aaa" }}
            width={85} // Slightly increased width
            label={{
              value: statLabel,
              angle: -90,
              position: "insideLeft",
              offset: -5,
              style: {
                textAnchor: "middle",
                fontSize: "10px",
                fill: "#ccc",
                fontWeight: "bold",
                letterSpacing: "2px",
                textTransform: "uppercase"
              }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone" // Match the line's curve type
            dataKey="value" // Use the same data
            fill="#14a2d2" // The base blue color for the fill
            fillOpacity={0.9} // Set the desired opacity
            stroke="none" // No border needed for the area itself
            connectNulls // Handle gaps consistently with the line
          />
          <Line
            type="monotone"
            dataKey="value"
            name={statLabel}
            stroke="#14a2d2" // #8884d8
            strokeWidth={2}
            activeDot={{ r: 6 }}
            dot={false}
            connectNulls
          />
          {/* Season Average Line */}
          {seasonAverageValue !== null && seasonAverageReference !== null && (
            <ReferenceLine
              y={seasonAverageReference}
              label={{
                value: `Avg: ${formatDisplayValue(
                  seasonAverageValue,
                  isTOIStat ? "TOI" : "CountPerGame"
                )}`,
                position: "insideBottomRight",
                fill: "#FFF", // #ff7300
                fontSize: 16,
                fontWeight: "bolder"
              }}
              stroke="#ff6b6b" // #ff7300
              strokeDasharray="3 3"
              strokeWidth={1.5}
            />
          )}
          {/* Toggleable Average Lines */}
          {availableAverages.map((key) => {
            const avgValue = averages[key];
            const gpValue = gpData?.[key];
            let referenceValue = null;
            if (avgValue != null) {
              if (
                tableType === "COUNTS" &&
                convertibleCountStats.includes(statLabel) &&
                typeof gpValue === "number" &&
                gpValue > 0
              ) {
                referenceValue = avgValue / gpValue;
              } else if (isTOIStat) {
                referenceValue = avgValue;
              } // Already average minutes
              else if (tableType === "RATES" || isPercentStat) {
                referenceValue = avgValue;
              } else if (
                tableType === "COUNTS" &&
                !convertibleCountStats.includes(statLabel) &&
                !isTOIStat &&
                !isPercentStat
              ) {
                referenceValue = avgValue;
              }
            }
            const strokeColor = averageColors[key];
            if (visibleAverages[key] && referenceValue != null) {
              return (
                <ReferenceLine
                  key={key}
                  y={referenceValue}
                  stroke={strokeColor}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              );
            }
            return null;
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GameLogChart;
