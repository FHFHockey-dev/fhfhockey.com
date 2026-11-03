import React, { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { GameLogDataPoint } from "utils/fetchWigoPlayerStats";
import styles from "styles/wigoCharts.module.scss";
import { TableAggregateData } from "./types";
import { formatGameMeanLabel, gameLogMean } from "./gameLogMean";
import { WIGO_CHART_ROLES } from "styles/wigoColors";
import {
  formatWigoStatValue,
  isWigoPercentStat,
  isWigoTimeStat,
  shouldUseGpForDiff
} from "./statMetadata";

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
  height?: number;
  // Fill the parent's height with tighter axes (one-page dashboard panel).
  fill?: boolean;
  // The compared periods: their reference lines take the band's L and R colours.
  leftTimeframe?: string;
  rightTimeframe?: string;
}

type AverageKey = keyof GameLogChartProps["averages"];
const availableAverages: AverageKey[] = [
  "STD",
  "LY",
  "CA",
  "3YA",
  "L5",
  "L10",
  "L20"
];

// One meaning per colour (U8): the left period is blue and the right amber,
// as in the band; every other period is the same quiet grey.
const referenceColor = (key: AverageKey, left?: string, right?: string) =>
  key === left
    ? WIGO_CHART_ROLES.PRIMARY
    : key === right
      ? WIGO_CHART_ROLES.RIGHT
      : WIGO_CHART_ROLES.OTHER_PERIOD;

// Kept apart from the chart so the title line can show the mean without
// loading Recharts with the page (S8).
export { formatGameMeanLabel, gameLogMean };

// Round ticks from zero: about four steps of 1, 2, 2.5 or 5 times a power of
// ten, instead of quarters of the data maximum (3.40, 2.55, 1.70, 0.85).
export function niceGameLogTicks(max: number, wholeNumbers: boolean): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw)!;
  if (wholeNumbers) step = Math.max(1, Math.ceil(step));
  const count = Math.ceil(max / step - 1e-9);
  return Array.from({ length: count + 1 }, (_, index) => Number((index * step).toFixed(6)));
}

const GameLogChart: React.FC<GameLogChartProps> = ({
  playerId,
  statLabel,
  gameLogData,
  averages,
  gpData,
  isLoading,
  error,
  tableType,
  height = 230,
  fill = false,
  leftTimeframe = "STD",
  rightTimeframe
}) => {
  const [visibleAverages, setVisibleAverages] = useState<
    Record<AverageKey, boolean>
  >(() => ({
    STD: false,
    LY: false,
    "3YA": false,
    CA: false,
    L5: false,
    L10: false,
    L20: false,
    // The left comparison period starts on, as STD did.
    ...(availableAverages.includes(leftTimeframe as AverageKey) ? { [leftTimeframe]: true } : { STD: true })
  }));

  const handleAverageToggle = (key: AverageKey) => {
    setVisibleAverages((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isTOIStat = isWigoTimeStat(statLabel);
  const isPercentStat = isWigoPercentStat(statLabel);
  const isCountStat = tableType === "COUNTS";

  const chartData = useMemo(() => {
    return gameLogData.map((d, index) => ({
      game: index + 1,
      date: d.date,
      value: isTOIStat && typeof d.value === "number" ? d.value / 60 : d.value
    }));
  }, [gameLogData, isTOIStat]);

  const seasonAverageValue = useMemo(() => gameLogMean(gameLogData), [gameLogData]);

  // A one-line text alternative for the plot (E, a11y #7): sample, range, mean.
  const gameLogSummary = useMemo(() => {
    const values = gameLogData
      .map((d) => d.value)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (values.length === 0) return `${statLabel} by game: no values`;
    const fmt = (v: number) => formatWigoStatValue(statLabel, v);
    return `${statLabel} by game: ${values.length} of ${gameLogData.length} games with a value, from ${fmt(Math.min(...values))} to ${fmt(Math.max(...values))}; ${formatGameMeanLabel(statLabel, gameLogMean(gameLogData)!).toLowerCase()}`;
  }, [gameLogData, statLabel]);
  const yTicks = useMemo(() => {
    const plotted = chartData
      .map((d) => d.value)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return niceGameLogTicks(Math.max(0, ...plotted), isCountStat);
  }, [chartData, isCountStat]);
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
        return formatWigoStatValue(statLabel, value);
      case "Percent":
        return formatWigoStatValue(statLabel, value);
      case "CountPerGame":
        return value.toFixed(2);
      case "Other":
      default:
        return formatWigoStatValue(statLabel, value);
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
  const chartHeight = fill ? "100%" : height; // Increased height slightly for better visibility in a row

  const status = isLoading ? "Loading game log..." : error || (!playerId ? "Select a player" : gameLogData.length === 0 ? "No game log data available for this season." : null);

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
              valueForButton = avgValue;
              formattingType = "TOI";
            } else if (isPercentStat) {
              formattingType = "Percent";
            } else if (
              shouldUseGpForDiff(statLabel) &&
              typeof gpValue === "number" &&
              gpValue > 0
            ) {
              valueForButton = avgValue / gpValue;
              formattingType = "CountPerGame";
              suffix = "/GP";
            } else if (shouldUseGpForDiff(statLabel)) {
              valueForButton = null;
            } else if (tableType === "RATES") {
              formattingType = "Other";
            }
          }
          const buttonColor = referenceColor(key, leftTimeframe, rightTimeframe);
          const isActive = visibleAverages[key];
          {
            return (
              <button
                key={key}
                aria-pressed={isActive}
                aria-label={`Toggle ${key} reference`}
                // The value is in the band already; the chip names the line only.
                title={`${key}: ${formatDisplayValue(valueForButton, formattingType)}${suffix ? ` ${suffix}` : ""}`}
                onClick={() => handleAverageToggle(key)}
                className={`${styles.avgButton} ${
                  isActive ? styles.active : ""
                }`}
                style={
                  isActive
                    ? { backgroundColor: "#1a1d21", borderColor: buttonColor, color: "#fff", fontWeight: 700 }
                    : {}
                }
              >
                {key}
              </button>
            );
          }
        })}
      </div>
      {status ? <div className={styles.chartStatus} role="status">{status}</div> : <div className={fill ? styles.gameLogChartPlot : undefined} role="img" aria-label={gameLogSummary}><ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart
          data={chartData}
          margin={fill ? { top: 4, right: 6, left: 0, bottom: 0 } : { top: 5, right: 10, left: 0, bottom: 16 }}
        >
          {" "}
          {/* Adjusted margins */}
          {/* Solid hairline grid, as on the other three charts (U6). */}
          <CartesianGrid stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
          <XAxis
            dataKey="game"
            minTickGap={40}
            tickFormatter={(game) => chartData[Number(game) - 1]?.date.slice(5).replace("-", "/") ?? String(game)}
            label={fill ? undefined : {
              value: "Game date",
              position: "insideBottom",
              offset: -15,
              style: {
                textAnchor: "middle",
                fontSize: "12px",
                fill: "#ccc",
                fontWeight: "bold",
                letterSpacing: "0",
                textTransform: "uppercase"
              }
            }}
            tick={{ fontSize: 12, fill: "#ccc" }}
            height={fill ? 18 : 40} // Increased height for label
          />
          <YAxis
            tickFormatter={(tick) =>
              formatDisplayValue(
                isTOIStat ? tick * 60 : tick,
                isTOIStat ? "TOI" : isPercentStat ? "Percent" : "Other"
              )
            }
            tick={{ fontSize: 12, fill: "#ccc" }}
            width={fill ? 48 : 65} // Slightly increased width
            // Round ticks from zero; counts take whole numbers only.
            domain={[0, yTicks[yTicks.length - 1]]}
            ticks={yTicks}
            allowDataOverflow={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Counts are discrete games, so bars; rates are straight segments
              with a dot per game. A missing game stays a gap (E-08). */}
          {isCountStat ? (
            <Bar
              dataKey="value"
              name={statLabel}
              fill={WIGO_CHART_ROLES.BAR}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          ) : (
            <Line
              type="linear"
              dataKey="value"
              name={statLabel}
              // Ink, so blue and amber stay free for the L and R references.
              stroke={WIGO_CHART_ROLES.SERIES_INK}
              strokeWidth={2}
              dot={{ r: 2, strokeWidth: 0, fill: WIGO_CHART_ROLES.SERIES_INK }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          {/* Season Average Line */}
          {seasonAverageValue !== null && seasonAverageReference !== null && (
            <ReferenceLine
              y={seasonAverageReference}
              // In the one-page panel the mean is in the title line, never over the marks.
              label={fill ? undefined : {
                value: formatGameMeanLabel(statLabel, seasonAverageValue),
                position: "insideBottomRight",
                fill: "#FFF", // #ff7300
                fontSize: 11
              }}
              stroke={WIGO_CHART_ROLES.AVERAGE}
              strokeOpacity={0.6}
              strokeDasharray="2 3"
              strokeWidth={1}
            />
          )}
          {/* Toggleable Average Lines */}
          {availableAverages.map((key) => {
            const avgValue = averages[key];
            const gpValue = gpData?.[key];
            let referenceValue = null;
            if (avgValue != null) {
              if (shouldUseGpForDiff(statLabel) && typeof gpValue === "number" && gpValue > 0) {
                referenceValue = avgValue / gpValue;
              } else if (isTOIStat) {
                referenceValue = avgValue / 60;
              } // Aggregate times are seconds; the chart axis uses minutes.
              else if (tableType === "RATES" || isPercentStat) {
                referenceValue = avgValue;
              } else if (
                tableType === "COUNTS" &&
                !shouldUseGpForDiff(statLabel) &&
                !isTOIStat &&
                !isPercentStat
              ) {
                referenceValue = avgValue;
              }
            }
            const strokeColor = referenceColor(key, leftTimeframe, rightTimeframe);
            if (visibleAverages[key] && referenceValue != null) {
              return (
                <ReferenceLine
                  key={key}
                  y={referenceValue}
                  stroke={strokeColor}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                />
              );
            }
            return null;
          })}
        </ComposedChart>
      </ResponsiveContainer></div>}
    </div>
  );
};

export default GameLogChart;
