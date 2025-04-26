// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/StatsTableRowChart.tsx
import React, { useState, useMemo, useEffect } from "react";
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
  ComposedChart,
  Bar
} from "recharts";
import { GameLogDataPoint } from "utils/fetchWigoPlayerStats";
import { formatSecondsToMMSS } from "./tableUtils";
import styles from "styles/wigoCharts.module.scss";
import useCurrentSeason from "hooks/useCurrentSeason";
import { TableAggregateData } from "./types";
import { letterSpacing, textTransform } from "@mui/system";

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

// **** Define Color Map for Averages ****
const averageColors: Record<AverageKey, string> = {
  STD: "#e60000", // Red
  LY: "#00b300", // Green
  "3YA": "#ff9900", // Orange
  CA: "#0099cc", // Blue
  L5: "#cc33ff", // Purple
  L10: "#ffcc00", // Yellow
  L20: "#cccccc" // Light Grey
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

  const currentSeasonData = useCurrentSeason();
  const seasonId = currentSeasonData?.seasonId || 0;

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
    // Renamed for clarity
    if (!gameLogData || gameLogData.length === 0) return null;
    const validValues = gameLogData
      .map((d) => d.value)
      .filter((v) => typeof v === "number") as number[];
    if (validValues.length === 0) return null;
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return sum / validValues.length; // Return raw average (seconds for TOI)
  }, [gameLogData]);

  const seasonAverageReference = useMemo(() => {
    // Value for ReferenceLine
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
        return formatSecondsToMMSS(value); // Expects seconds
      case "Percent":
        return `${(value * 100).toFixed(1)}%`; // Expects 0-1 decimal
      case "CountPerGame":
        return value.toFixed(2); // Show 2 decimal places
      case "Other":
      default:
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = chartData.find((d) => d.game === label);
      if (!dataPoint) return null;

      const rawValue = payload[0].value; // This value is potentially scaled (minutes for TOI)
      let formattedValue = "N/A";

      if (typeof rawValue === "number") {
        if (isTOIStat) {
          // Convert axis value (minutes) back to seconds for formatting
          formattedValue = formatDisplayValue(rawValue * 60, "TOI");
        } else if (isPercentStat) {
          formattedValue = formatDisplayValue(rawValue, "Percent");
        } else {
          // Attempt to determine if it's a count - difficult here, default to 'Other'
          formattedValue = formatDisplayValue(rawValue, "Other");
        }
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

  // Modify chart dimensions for column layout

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
          const avgValue = averages[key]; // This is the raw average value (e.g., total minutes for TOI)
          const gpValue = gpData?.[key];
          let valueForButton = avgValue; // Start with the raw average
          let formattingType: "TOI" | "Percent" | "CountPerGame" | "Other" =
            "Other";
          let suffix = "";

          if (avgValue != null) {
            if (isTOIStat) {
              // Convert average minutes to seconds for formatting
              valueForButton = avgValue * 60;
              formattingType = "TOI";
            } else if (isPercentStat) {
              formattingType = "Percent"; // Assume avgValue is already 0-1 decimal
            } else if (
              tableType === "COUNTS" &&
              convertibleCountStats.includes(statLabel) &&
              typeof gpValue === "number" &&
              gpValue > 0
            ) {
              valueForButton = avgValue / gpValue; // Calculate per-game average
              formattingType = "CountPerGame";
              suffix = "/GP";
            } else if (tableType === "RATES") {
              formattingType = "Other"; // Rates usually need toFixed(2)
            }
          }

          // Get the color for this average key
          const buttonColor = averageColors[key];
          const isActive = visibleAverages[key];

          // Render button only if we have a valid value to display
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
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="game"
            label={{
              value: "Game",
              position: "insideBottom",
              offset: -10,
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
          <YAxis
            tickFormatter={(tick) =>
              formatDisplayValue(
                isTOIStat ? tick * 60 : tick,
                isTOIStat ? "TOI" : "Other"
              )
            }
            tick={{ fontSize: 9, fill: "#aaa" }}
            width={40}
            label={{
              value: statLabel,
              angle: -90,
              position: "insideLeft",
              offset: 10,
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
          <Legend
            verticalAlign="bottom"
            align="right"
            formatter={(value, entry) => {
              const color = entry.color;
              return <span style={{ color, fontSize: "10px" }}>{value}</span>;
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={statLabel}
            stroke="#8884d8"
            strokeWidth={2}
            activeDot={{ r: 8 }}
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
                position: "insideTopRight",
                fill: "#ff7300",
                fontSize: 9
              }}
              stroke="#ff7300"
              strokeDasharray="3 3"
              strokeWidth={1.5}
            />
          )}

          {/* Toggleable Average Lines */}
          {availableAverages.map((key) => {
            const avgValue = averages[key]; // Raw average value (minutes for TOI)
            const gpValue = gpData?.[key];
            let referenceValue = null;

            // Calculate referenceValue (scaled for axis)
            if (avgValue != null) {
              if (
                tableType === "COUNTS" &&
                convertibleCountStats.includes(statLabel) &&
                typeof gpValue === "number" &&
                gpValue > 0
              ) {
                referenceValue = avgValue / gpValue; // Per-game value for counts
              } else if (isTOIStat) {
                // **** FIX: Use avgValue directly (it's already average minutes) ****
                referenceValue = avgValue;
              } else if (tableType === "RATES" || isPercentStat) {
                referenceValue = avgValue; // Raw value for rates/percentages
              } else if (
                tableType === "COUNTS" &&
                !convertibleCountStats.includes(statLabel) &&
                !isTOIStat &&
                !isPercentStat
              ) {
                referenceValue = avgValue; // Raw value for other counts
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
                /> // Thinner reference lines
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
