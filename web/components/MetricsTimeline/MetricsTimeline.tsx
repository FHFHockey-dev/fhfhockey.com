import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import {
  buildMetricsTimelineRows,
  calculateTimelineDelta,
  MetricsTimelineMetricKey,
  MetricsTimelinePoint,
} from "./metricsTimelineData";
import styles from "./MetricsTimeline.module.scss";

interface MetricsTimelineProps {
  teamId: string;
  teamAbbrev: string;
  seasonId?: string;
}

type MetricOption = {
  key: MetricsTimelineMetricKey;
  label: string;
  shortLabel: string;
  isPercent?: boolean;
  lowerIsBetter?: boolean;
  referenceValue?: number;
};

const metricOptions: MetricOption[] = [
  {
    key: "pointPct",
    label: "Points %",
    shortLabel: "Pts %",
    isPercent: true,
    referenceValue: 0.5,
  },
  {
    key: "goalsForPerGame",
    label: "Goals For/Game",
    shortLabel: "GF/G",
  },
  {
    key: "goalsAgainstPerGame",
    label: "Goals Against/Game",
    shortLabel: "GA/G",
    lowerIsBetter: true,
  },
  {
    key: "powerPlayPct",
    label: "Power Play %",
    shortLabel: "PP%",
    isPercent: true,
    referenceValue: 0.2,
  },
  {
    key: "shotsForPerGame",
    label: "Shots For/Game",
    shortLabel: "SF/G",
  },
  {
    key: "xgf",
    label: "Expected Goals For",
    shortLabel: "xGF",
  },
  {
    key: "xga",
    label: "Expected Goals Against",
    shortLabel: "xGA",
    lowerIsBetter: true,
  },
];

const getMetricOption = (key: MetricsTimelineMetricKey) =>
  metricOptions.find((option) => option.key === key) ?? metricOptions[0];

const getMetricValue = (
  row: MetricsTimelinePoint,
  key: MetricsTimelineMetricKey
) => row[key];

const formatValue = (
  value: number | null | undefined,
  option: MetricOption
): string => {
  if (value == null || Number.isNaN(value)) return "N/A";
  if (option.isPercent) return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
};

const formatDelta = (
  delta: number | null,
  option: MetricOption
): string => {
  if (delta == null) return "N/A";
  const sign = delta > 0 ? "+" : "";
  if (option.isPercent) return `${sign}${(delta * 100).toFixed(1)} pts`;
  return `${sign}${delta.toFixed(2)}`;
};

const MetricsTimeline: React.FC<MetricsTimelineProps> = ({
  teamId,
  teamAbbrev,
  seasonId,
}) => {
  const [rows, setRows] = useState<MetricsTimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] =
    useState<MetricsTimelineMetricKey>("pointPct");

  const teamInfo = teamsInfo[teamAbbrev];
  const selectedOption = getMetricOption(selectedMetric);
  const strokeColor = teamInfo?.primaryColor || "#07aae2";

  useEffect(() => {
    if (!teamId || !seasonId) return;

    const teamIdNumber = Number(teamId);
    const seasonIdNumber = Number(seasonId);

    if (!Number.isFinite(teamIdNumber) || !Number.isFinite(seasonIdNumber)) {
      setError("Invalid team or season selection.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setSourceWarnings([]);

    const fetchMetrics = async () => {
      const [wgoResult, xgResult] = await Promise.allSettled([
        supabase
          .from("wgo_team_stats")
          .select(`
            date,
            points,
            games_played,
            goals_for_per_game,
            goals_against_per_game,
            power_play_pct,
            shots_for_per_game
          `)
          .eq("team_id", teamIdNumber)
          .eq("season_id", seasonIdNumber)
          .order("date", { ascending: true }),
        supabase
          .from("nhl_xg_team_game_aggregates")
          .select("game_date, game_id, xg_for, xg_against, source_model_approved, source_prediction_type")
          .eq("team_id", teamIdNumber)
          .eq("season_id", seasonIdNumber)
          .eq("source_model_approved", true)
          .eq("source_prediction_type", "shot_goal")
          .order("game_date", { ascending: true })
          .order("feature_version", { ascending: false })
          .order("updated_at", { ascending: false }),
      ]);

      if (!isMounted) return;

      const wgoUnavailable = wgoResult.status === "rejected" || !!wgoResult.value.error;
      const xgUnavailable = xgResult.status === "rejected" || !!xgResult.value.error;
      if (wgoUnavailable && xgUnavailable) throw new Error("Performance data could not be loaded.");
      setSourceWarnings([
        ...(wgoUnavailable ? ["WGO metrics could not be loaded."] : []),
        ...(xgUnavailable ? ["Expected goals could not be loaded."] : []),
      ]);
      setRows(
        buildMetricsTimelineRows({
          wgoRows: wgoResult.status === "fulfilled" && !wgoUnavailable ? wgoResult.value.data ?? [] : [],
          xgRows: xgResult.status === "fulfilled" && !xgUnavailable ? xgResult.value.data ?? [] : [],
        })
      );
    };

    fetchMetrics()
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "An error occurred");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [teamId, seasonId]);

  const rowsWithMetric = useMemo(
    () => rows.filter((row) => getMetricValue(row, selectedMetric) != null),
    [rows, selectedMetric]
  );

  const latestRow = rowsWithMetric.at(-1);
  const bestRow = useMemo(() => {
    return rowsWithMetric.reduce<MetricsTimelinePoint | null>((best, row) => {
      if (!best) return row;
      const rowValue = getMetricValue(row, selectedMetric);
      const bestValue = getMetricValue(best, selectedMetric);

      if (rowValue == null || bestValue == null) return best;
      return selectedOption.lowerIsBetter
        ? rowValue < bestValue
          ? row
          : best
        : rowValue > bestValue
          ? row
          : best;
    }, null);
  }, [rowsWithMetric, selectedMetric, selectedOption.lowerIsBetter]);
  const recentRows = rowsWithMetric.slice(-8).reverse();
  const delta = calculateTimelineDelta({
    rows,
    metric: selectedMetric,
    lookback: 5,
  });
  const isPositiveTrend =
    delta != null &&
    (selectedOption.lowerIsBetter ? delta < 0 : delta > 0);

  const tooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ payload?: MetricsTimelinePoint; value?: unknown }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload;
    const value =
      typeof payload[0].value === "number" ? payload[0].value : null;

    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipDate}>{point?.date ?? label}</div>
        <div className={styles.tooltipMetric}>
          {selectedOption.label}: {formatValue(value, selectedOption)}
        </div>
        <div className={styles.tooltipMeta}>
          GF/G {formatValue(point?.goalsForPerGame, getMetricOption("goalsForPerGame"))}
          {" · "}
          GA/G{" "}
          {formatValue(
            point?.goalsAgainstPerGame,
            getMetricOption("goalsAgainstPerGame")
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading performance timeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>Error Loading Timeline</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>No Data Available</h3>
          <p>No performance data found for this team.</p>
          {sourceWarnings.map((warning) => <p key={warning} role="status">{warning}</p>)}
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      style={
        {
          "--team-primary-color": strokeColor,
          "--team-secondary-color": teamInfo?.secondaryColor || "#424242",
          "--team-accent-color": teamInfo?.accent || "#d7b645",
        } as React.CSSProperties
      }
    >
      <div className={styles.header}>
        <h2>Performance Timeline</h2>
        <p>Track {teamAbbrev} performance metrics over time</p>
        <p>WGO values describe each dated source sample; expected goals are approved per-game totals.</p>
        {sourceWarnings.map((warning) => <p key={warning} role="status">{warning}</p>)}
      </div>

      <div className={styles.controls}>
        <label htmlFor="metric-select">Select Metric:</label>
        <select
          id="metric-select"
          value={selectedMetric}
          onChange={(event) =>
            setSelectedMetric(event.target.value as MetricsTimelineMetricKey)
          }
          className={styles.metricSelect}
        >
          {metricOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.timeline}>
        <div className={styles.timelineHeader}>
          <h3>{selectedOption.label}</h3>
          <span>{rowsWithMetric.length} {rowsWithMetric.length === 1 ? "observation" : "observations"} with data</span>
        </div>

        {rowsWithMetric.length > 1 ? (
          <div className={styles.chartShell}>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart
                data={rows}
                margin={{ top: 16, right: 28, bottom: 8, left: 4 }}
              >
                <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" />
                <XAxis
                  dataKey="label"
                  minTickGap={26}
                  tick={{ fill: "#bdbdbd", fontSize: 12 }}
                  tickLine={{ stroke: "rgba(255, 255, 255, 0.2)" }}
                />
                <YAxis
                  domain={selectedMetric === "pointPct" ? [0, 1] : ["auto", "auto"]}
                  tickFormatter={(value) =>
                    formatValue(Number(value), selectedOption)
                  }
                  tick={{ fill: "#bdbdbd", fontSize: 12 }}
                  tickLine={{ stroke: "rgba(255, 255, 255, 0.2)" }}
                  width={56}
                />
                <Tooltip content={tooltip} />
                <Legend
                  wrapperStyle={{ color: "#d8d8d8", paddingTop: 8 }}
                  formatter={() => selectedOption.label}
                />
                {selectedOption.referenceValue != null ? (
                  <ReferenceLine
                    y={selectedOption.referenceValue}
                    stroke="rgba(255, 255, 255, 0.28)"
                    strokeDasharray="4 4"
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey={selectedMetric}
                  name={selectedOption.label}
                  stroke={strokeColor}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: strokeColor, stroke: "#ffffff" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.noData}>Not enough data to chart this metric.</div>
        )}

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Latest</span>
            <strong className={styles.summaryValue}>
              {formatValue(
                latestRow ? getMetricValue(latestRow, selectedMetric) : null,
                selectedOption
              )}
            </strong>
            <span className={styles.summaryMeta}>{latestRow?.date ?? "N/A"}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Last 5</span>
            <strong
              className={`${styles.summaryValue} ${
                delta == null
                  ? styles.muted
                  : isPositiveTrend
                    ? styles.positive
                    : styles.negative
              }`}
            >
              {formatDelta(delta, selectedOption)}
            </strong>
            <span className={styles.summaryMeta}>Change vs 5 available observations ago</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Best Observation</span>
            <strong className={styles.summaryValue}>
              {formatValue(
                bestRow ? getMetricValue(bestRow, selectedMetric) : null,
                selectedOption
              )}
            </strong>
            <span className={styles.summaryMeta}>{bestRow?.date ?? "N/A"}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Coverage</span>
            <strong className={styles.summaryValue}>{rowsWithMetric.length}</strong>
            <span className={styles.summaryMeta}>Available observations</span>
          </div>
        </div>
      </div>

      <div className={styles.tableShell}>
        <div className={styles.tableHeader}>
          <h3>Recent Observations</h3>
          <span>{selectedOption.shortLabel} trend sample</span>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.recentTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>WGO sample (games)</th>
                <th>{selectedOption.shortLabel}</th>
                <th>GF/G</th>
                <th>GA/G</th>
                <th>PP%</th>
                <th>SF/G</th>
                <th>xGF (game)</th>
                <th>xGA (game)</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{row.wgoGamesPlayed ?? "N/A"}</td>
                  <td>{formatValue(getMetricValue(row, selectedMetric), selectedOption)}</td>
                  <td>
                    {formatValue(
                      row.goalsForPerGame,
                      getMetricOption("goalsForPerGame")
                    )}
                  </td>
                  <td>
                    {formatValue(
                      row.goalsAgainstPerGame,
                      getMetricOption("goalsAgainstPerGame")
                    )}
                  </td>
                  <td>{formatValue(row.powerPlayPct, getMetricOption("powerPlayPct"))}</td>
                  <td>
                    {formatValue(
                      row.shotsForPerGame,
                      getMetricOption("shotsForPerGame")
                    )}
                  </td>
                  <td>{formatValue(row.xgf, getMetricOption("xgf"))}</td>
                  <td>{formatValue(row.xga, getMetricOption("xga"))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MetricsTimeline;
