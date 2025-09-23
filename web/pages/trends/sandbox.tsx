// sKO = sustainability K-Value Outlook
// =============================
// /web/pages/trends/sandbox.tsx
// =============================

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type {
  CorrelationRow,
  MetricOption,
  MetricSeries
} from "lib/trends/types";
import styles from "./sandbox.module.scss";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ComposedChart,
  Scatter,
  Line
} from "recharts";
import { linearRegression } from "lib/trends/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SandboxPage() {
  const [target, setTarget] = useState<"points" | "goals" | "assists">(
    "points"
  );
  const [seasons, setSeasons] = useState(4);
  const [source, setSource] = useState<string>("");
  const [strength, setStrength] = useState<string>("");
  const { data: metrics } = useSWR<MetricOption[]>(
    `/api/trends/players?action=metrics`,
    fetcher
  );

  const { data: rows, isLoading } = useSWR<CorrelationRow[]>(
    `/api/trends/players?action=correlations&target=${target}&seasons=${seasons}${source ? `&source=${source}` : ""}${strength ? `&strength=${strength}` : ""}`,
    fetcher
  );

  const top = useMemo(
    () => (rows ? [...rows].sort((a, b) => Math.abs(b.r) - Math.abs(a.r)) : []),
    [rows]
  );

  const filteredMetricIds = useMemo(
    () => (rows ? rows.map((r) => r.metricId) : []),
    [rows]
  );

  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (top.length && (!selected || !filteredMetricIds.includes(selected)))
      setSelected(top[0].metricId);
  }, [top, selected, filteredMetricIds]);

  const { data: series } = useSWR<MetricSeries | null>(
    selected
      ? `/api/trends/players?action=series&metricId=${selected}&target=${target}&seasons=${seasons}`
      : null,
    fetcher
  );

  const [sortX, setSortX] = useState(true);
  const [showTrend, setShowTrend] = useState(true);

  // Prepare scatter + optional trendline; ensure numeric axes with ascending X when desired
  const scatterData = useMemo(() => {
    if (!series) return [] as { x: number; y: number }[];
    const pts = series.x.map((xi, i) => ({
      x: Number(xi),
      y: Number(series.y[i])
    }));
    return sortX ? pts.sort((a, b) => a.x - b.x) : pts;
  }, [series, sortX]);

  const lineData = useMemo(() => {
    if (!series || scatterData.length < 2)
      return [] as { x: number; yhat: number }[];
    const xs = scatterData.map((p) => p.x);
    const ys = scatterData.map((p) => p.y);
    const { slope, intercept } = linearRegression(xs, ys);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    return [
      { x: x0, yhat: slope * x0 + intercept },
      { x: x1, yhat: slope * x1 + intercept }
    ];
  }, [series, scatterData]);

  const barData = useMemo(
    () => (rows ? rows.map((r) => ({ metric: r.metricLabel, r: r.r })) : []),
    [rows]
  );

  return (
    <div className={styles.wrapper}>
      <h1>Trends Sandbox</h1>

      <div className={styles.controls}>
        <label>
          Target:&nbsp;
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as any)}
          >
            <option value="points">Points</option>
            <option value="goals">Goals</option>
            <option value="assists">Assists</option>
          </select>
        </label>
        <label>
          Seasons:&nbsp;
          <input
            type="number"
            min={1}
            max={8}
            value={seasons}
            onChange={(e) => setSeasons(Number(e.target.value))}
          />
        </label>
        <label>
          Table:&nbsp;
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            <option value="wgo_skater_stats_totals">WGO Season Totals</option>
            <option value="wgo_skater_stats">WGO Game Logs</option>
            <option value="nst_counts">NST Counts (Indiv)</option>
            <option value="nst_counts_oi">NST Counts (On-Ice)</option>
            <option value="nst_rates">NST Rates (Indiv)</option>
            <option value="nst_rates_oi">NST Rates (On-Ice)</option>
          </select>
        </label>
        <label>
          Strength:&nbsp;
          <select
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
          >
            <option value="">All</option>
            <option value="AS">AS</option>
            <option value="ES">ES</option>
            <option value="PP">PP</option>
            <option value="PK">PK</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={sortX}
            onChange={(e) => setSortX(e.target.checked)}
          />{" "}
          Sort X ascending
        </label>
        <label>
          <input
            type="checkbox"
            checked={showTrend}
            onChange={(e) => setShowTrend(e.target.checked)}
          />{" "}
          Show trendline
        </label>
      </div>

      <div className={styles.grid}>
        <div>
          <h3>Top Correlates</h3>
          {isLoading && <div>Computing…</div>}
          {!isLoading && rows && (
            <>
              <div className={styles.chartSm}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData.slice(0, 25)}
                    layout="vertical"
                    margin={{ left: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      domain={[-1, 1]}
                      ticks={[-1, -0.5, 0, 0.5, 1]}
                    />
                    <YAxis type="category" dataKey="metric" width={160} />
                    <Tooltip />
                    <Bar dataKey="r" />
                    <ReferenceLine x={0} strokeDasharray="3 3" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>r</th>
                    <th>r²</th>
                    <th>Source</th>
                    <th>Strength</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.metricId}
                      className={
                        selected === r.metricId ? styles.activeRow : ""
                      }
                      onClick={() => setSelected(r.metricId)}
                    >
                      <td>{r.metricLabel}</td>
                      <td>{r.r.toFixed(3)}</td>
                      <td>{r.r2.toFixed(3)}</td>
                      <td>{r.source}</td>
                      <td>{r.strength || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div>
          <h3>
            Scatter: {selected || "—"} vs {target}
          </h3>
          <div className={styles.chart}>
            {series ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={scatterData}>
                  <CartesianGrid />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) => Number(v).toFixed(1)}
                    name={series.xLabel}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={["dataMin", "dataMax"]}
                    name={series.yLabel}
                  />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter name="observations" dataKey="y" />
                  {showTrend && lineData.length === 2 && (
                    <Line
                      name="trend"
                      type="linear"
                      data={lineData}
                      dataKey="yhat"
                      dot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.placeholder}>
                Select a metric to view its scatter against the target.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
