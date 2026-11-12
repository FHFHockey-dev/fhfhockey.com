import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  formatPlayerStatsToi,
  formatPlayerStatsValue,
} from "lib/underlying-stats/playerStatsFormatting";
import { buildGoalieStatsLandingChartApiPath } from "lib/underlying-stats/goalieStatsQueries";
import {
  buildPlayerStatsLandingChartApiPath,
  type PlayerStatsLandingChartPoint,
  type PlayerStatsLandingChartResponse,
} from "lib/underlying-stats/playerStatsQueries";
import type { PlayerStatsLandingFilterState } from "lib/underlying-stats/playerStatsTypes";
import { CHART_COLORS, WIGO_COLORS, addAlpha } from "styles/wigoColors";

import type { PlayerStatsColumnDefinition } from "./playerStatsColumns";
import styles from "./PlayerStatsExpandedRowChart.module.scss";

type PlayerStatsExpandedRowChartProps = {
  playerId: number;
  splitTeamId?: number | null;
  viewportWidth?: number | null;
  state: PlayerStatsLandingFilterState;
  variant?: "player" | "goalie";
  metricColumns: readonly PlayerStatsColumnDefinition[];
  selectedMetricKey: string;
  onMetricChange: (metricKey: string) => void;
};

type ChartPoint = PlayerStatsLandingChartPoint & {
  label: string;
  value: number | null;
  rolling5: number | null;
  rolling10: number | null;
  seasonAverage: number | null;
};

export default function PlayerStatsExpandedRowChart({
  playerId,
  splitTeamId = null,
  viewportWidth = null,
  state,
  variant = "player",
  metricColumns,
  selectedMetricKey,
  onMetricChange
}: PlayerStatsExpandedRowChartProps) {
  const [data, setData] = useState<PlayerStatsLandingChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMetric = useMemo(
    () =>
      metricColumns.find((column) => column.key === selectedMetricKey) ??
      metricColumns[0] ??
      null,
    [metricColumns, selectedMetricKey]
  );

  useEffect(() => {
    if (!selectedMetric && metricColumns[0]) {
      onMetricChange(metricColumns[0].key);
    }
  }, [metricColumns, onMetricChange, selectedMetric]);

  useEffect(() => {
    const controller = new AbortController();
    const requestPath =
      variant === "goalie"
        ? buildGoalieStatsLandingChartApiPath({
            playerId,
            state,
            splitTeamId
          })
        : buildPlayerStatsLandingChartApiPath({
            playerId,
            state,
            splitTeamId
          });

    setIsLoading(true);
    setError(null);

    void fetch(requestPath, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as
          | PlayerStatsLandingChartResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : variant === "goalie"
                ? "Unable to load goalie chart data."
                : "Unable to load player chart data."
          );
        }

        setData((payload as PlayerStatsLandingChartResponse).rows);
      })
      .catch((fetchError: unknown) => {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : variant === "goalie"
              ? "Unable to load goalie chart data."
              : "Unable to load player chart data."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [playerId, splitTeamId, state, variant]);

  const chartData = useMemo<ChartPoint[]>(
    () =>
      selectedMetric ? buildExpandedRowChartData(data, selectedMetric.key) : [],
    [data, selectedMetric]
  );
  const summaryLabels = getExpandedRowChartSummaryLabels(selectedMetric?.key ?? null);

  const chartWidth = useMemo(() => {
    if (viewportWidth == null || !Number.isFinite(viewportWidth)) {
      return null;
    }

    return Math.max(Math.floor(viewportWidth - 32), 320);
  }, [viewportWidth]);

  if (!selectedMetric) {
    return <div className={styles.status}>No chartable metrics available.</div>;
  }

  if (isLoading) {
    return (
      <div className={styles.status}>
        {variant === "goalie"
          ? "Loading goalie trend..."
          : "Loading player trend..."}
      </div>
    );
  }

  if (error) {
    return <div className={styles.status}>{error}</div>;
  }

  if (chartData.length === 0) {
    return <div className={styles.status}>No chart rows for this slice.</div>;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        {metricColumns.map((column) => (
          <button
            key={column.key}
            type="button"
            className={styles.metricButton}
            data-active={column.key === selectedMetric.key ? "true" : "false"}
            onClick={() => onMetricChange(column.key)}
          >
            {column.label}
          </button>
        ))}
      </div>

      <div
        className={styles.chartShell}
        style={
          chartWidth != null
            ? {
                width: `${chartWidth}px`,
                minWidth: `${chartWidth}px`,
                maxWidth: `${chartWidth}px`
              }
            : undefined
        }
      >
        <ComposedChart
          width={chartWidth ?? 960}
          height={150}
          data={chartData}
          margin={{ top: 10, right: 12, bottom: 0, left: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.GRID_LINE}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: CHART_COLORS.TICK_LABEL, fontSize: 10 }}
            axisLine={{ stroke: CHART_COLORS.AXIS_BORDER }}
            tickLine={{ stroke: CHART_COLORS.AXIS_BORDER }}
            minTickGap={18}
          />
          <YAxis
            width={48}
            tick={{ fill: CHART_COLORS.TICK_LABEL, fontSize: 10 }}
            axisLine={{ stroke: CHART_COLORS.AXIS_BORDER }}
            tickLine={{ stroke: CHART_COLORS.AXIS_BORDER }}
            tickFormatter={(value) =>
              formatAxisValue(value, selectedMetric.format)
            }
          />
          <Tooltip
            cursor={{ stroke: addAlpha(WIGO_COLORS.YELLOW, 0.5) }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }

              const point = payload[0]?.payload as ChartPoint | undefined;
              if (!point) {
                return null;
              }

              return (
                <div className={styles.tooltip}>
                  <p className={styles.tooltipLabel}>
                    {formatLongDate(point.gameDate)}
                  </p>
                  <p className={styles.tooltipValue}>
                    {selectedMetric.label}:{" "}
                    {formatPlayerStatsValue(point.value, selectedMetric.format)}
                  </p>
                  <p className={styles.tooltipMeta}>
                    {summaryLabels.rolling5}:{" "}
                    {formatPlayerStatsValue(
                      point.rolling5,
                      selectedMetric.format
                    )}
                  </p>
                  <p className={styles.tooltipMeta}>
                    {summaryLabels.rolling10}:{" "}
                    {formatPlayerStatsValue(
                      point.rolling10,
                      selectedMetric.format
                    )}
                  </p>
                  <p className={styles.tooltipMeta}>
                    {summaryLabels.season}:{" "}
                    {formatPlayerStatsValue(
                      point.seasonAverage,
                      selectedMetric.format
                    )}
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="value"
            barSize={12}
            radius={[2, 2, 0, 0]}
            fill={addAlpha(CHART_COLORS.BAR_PRIMARY, 0.72)}
            stroke={CHART_COLORS.BAR_PRIMARY}
            strokeWidth={1}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="rolling5"
            stroke="none"
            fill={addAlpha(CHART_COLORS.LINE_PRIMARY, 0.12)}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="rolling5"
            stroke={CHART_COLORS.LINE_PRIMARY}
            strokeWidth={2.25}
            dot={false}
            activeDot={{
              r: 4,
              fill: CHART_COLORS.LINE_PRIMARY,
              strokeWidth: 0
            }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="rolling10"
            stroke={CHART_COLORS.PP_TOI}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: CHART_COLORS.PP_TOI,
              strokeWidth: 0
            }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="seasonAverage"
            stroke={CHART_COLORS.AVG_LINE_PRIMARY}
            strokeWidth={1.75}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Brush
            dataKey="label"
            height={24}
            stroke={CHART_COLORS.LINE_PRIMARY}
            fill={addAlpha(WIGO_COLORS.BG_DARK_2, 0.95)}
            travellerWidth={10}
          />
        </ComposedChart>
      </div>
    </div>
  );
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatShortDate(value: string): string {
  const parsedDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsedDate);
}

function formatLongDate(value: string): string {
  const parsedDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

function formatAxisValue(
  value: number | string,
  format: PlayerStatsColumnDefinition["format"]
): string {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "";
  }

  if (format === "toi" || format === "toiPerGame") {
    return formatPlayerStatsToi(numericValue);
  }

  if (format === "percentage") {
    return `${(numericValue * 100).toFixed(0)}%`;
  }

  if (format === "integer") {
    return `${Math.round(numericValue)}`;
  }

  return numericValue.toFixed(format === "per60" ? 1 : 2);
}

type PooledRatioSpec = {
  numerator: (row: PlayerStatsLandingChartPoint) => number | null;
  denominator: (row: PlayerStatsLandingChartPoint) => number | null;
  scale: number;
};

function readNumber(row: PlayerStatsLandingChartPoint, key: string): number | null {
  return toFiniteNumber(row[key]);
}

function share(forKey: string, againstKey: string): PooledRatioSpec {
  return {
    numerator: (row) => readNumber(row, forKey),
    denominator: (row) => {
      const forValue = readNumber(row, forKey);
      const againstValue = readNumber(row, againstKey);
      return forValue == null || againstValue == null ? null : forValue + againstValue;
    },
    scale: 1,
  };
}

function ratio(numeratorKey: string, denominatorKey: string, scale = 1): PooledRatioSpec {
  return {
    numerator: (row) => readNumber(row, numeratorKey),
    denominator: (row) => readNumber(row, denominatorKey),
    scale,
  };
}

const POOLED_RATIO_SPECS: Record<string, PooledRatioSpec> = {
  savePct: ratio("saves", "shotsAgainst"),
  hdSavePct: ratio("hdSaves", "hdShotsAgainst"),
  mdSavePct: ratio("mdSaves", "mdShotsAgainst"),
  ldSavePct: ratio("ldSaves", "ldShotsAgainst"),
  gaa: ratio("goalsAgainst", "toiSeconds", 3600),
  hdGaa: ratio("hdGoalsAgainst", "toiSeconds", 3600),
  mdGaa: ratio("mdGoalsAgainst", "toiSeconds", 3600),
  ldGaa: ratio("ldGoalsAgainst", "toiSeconds", 3600),
  shootingPct: ratio("goals", "shots"),
  faceoffPct: share("faceoffsWon", "faceoffsLost"),
  cfPct: share("cf", "ca"),
  ffPct: share("ff", "fa"),
  sfPct: share("sf", "sa"),
  gfPct: share("gf", "ga"),
  scfPct: share("scf", "sca"),
  hdcfPct: share("hdcf", "hdca"),
  hdgfPct: share("hdgf", "hdga"),
  mdcfPct: share("mdcf", "mdca"),
  mdgfPct: share("mdgf", "mdga"),
};

/**
 * Ratio metrics are pooled over the window (Σ numerator ÷ Σ denominator,
 * W2-2 D19): SV% over two games of 1/1 and 5/10 is 6/11, not the mean of
 * 100% and 50%. Per-60 metrics pool their count over TOI. Other metrics are a
 * mean per game and are labelled that way.
 */
function resolvePooledRatioSpec(metricKey: string): PooledRatioSpec | null {
  const explicit = POOLED_RATIO_SPECS[metricKey];
  if (explicit) {
    return explicit;
  }

  if (metricKey.endsWith("Per60")) {
    return ratio(metricKey.slice(0, -"Per60".length), "toiSeconds", 3600);
  }

  return null;
}

function poolRatio(
  rows: readonly PlayerStatsLandingChartPoint[],
  spec: PooledRatioSpec
): number | null {
  let numerator = 0;
  let denominator = 0;

  for (const row of rows) {
    const rowNumerator = spec.numerator(row);
    const rowDenominator = spec.denominator(row);
    // A game with an unknown count or exposure leaves the pooled value unknown.
    if (rowNumerator == null || rowDenominator == null) {
      return null;
    }
    numerator += rowNumerator;
    denominator += rowDenominator;
  }

  return denominator > 0 ? (numerator / denominator) * spec.scale : null;
}

export function getExpandedRowChartSummaryLabels(metricKey: string | null) {
  const pooled = metricKey != null && resolvePooledRatioSpec(metricKey) != null;
  return pooled
    ? { rolling5: "Last 5 GP (pooled)", rolling10: "Last 10 GP (pooled)", season: "Window (pooled)" }
    : { rolling5: "5G mean per game", rolling10: "10G mean per game", season: "Mean per game" };
}

export function buildExpandedRowChartData(
  data: readonly PlayerStatsLandingChartPoint[],
  metricKey: string
): ChartPoint[] {
  const numericValues = data.map((row) => toFiniteNumber(row[metricKey]));
  const spec = resolvePooledRatioSpec(metricKey);
  const window = (end: number, size: number) => data.slice(Math.max(0, end - size + 1), end + 1);
  const seasonAverage = spec ? poolRatio(data, spec) : calculateAverage(numericValues);
  const rolling5 = spec
    ? data.map((_, index) => poolRatio(window(index, 5), spec))
    : calculateRollingAverage(numericValues, 5);
  const rolling10 = spec
    ? data.map((_, index) => poolRatio(window(index, 10), spec))
    : calculateRollingAverage(numericValues, 10);

  return data.map((row, index) => ({
    ...row,
    label: formatShortDate(row.gameDate),
    value: numericValues[index] ?? null,
    rolling5: rolling5[index] ?? null,
    rolling10: rolling10[index] ?? null,
    seasonAverage,
  }));
}

function calculateRollingAverage(
  values: readonly (number | null)[],
  windowSize: number
): Array<number | null> {
  return values.map((_, index) => {
    const windowValues = values
      .slice(Math.max(0, index - windowSize + 1), index + 1)
      .filter((value): value is number => value != null && Number.isFinite(value));

    if (windowValues.length === 0) {
      return null;
    }

    return calculateAverage(windowValues);
  });
}

function calculateAverage(values: readonly (number | null)[]): number | null {
  const numericValues = values.filter(
    (value): value is number => value != null && Number.isFinite(value)
  );

  if (numericValues.length === 0) {
    return null;
  }

  return (
    numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
  );
}
