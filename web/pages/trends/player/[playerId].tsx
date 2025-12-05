import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Brush
} from "recharts";
import supabase from "lib/supabase";
import styles from "./playerTrendPage.module.scss";

const METRIC_CONFIG = [
  {
    key: "goals",
    rollingKey: "goals_avg_last5",
    baselineKey: "goals_avg_all",
    label: "Goals (L5 Avg)",
    color: "#ff9f40" // Orange
  },
  {
    key: "assists",
    rollingKey: "assists_avg_last5",
    baselineKey: "assists_avg_all",
    label: "Assists (L5 Avg)",
    color: "#3b82f6" // Blue
  },
  {
    key: "points",
    rollingKey: "points_avg_last5",
    baselineKey: "points_avg_all",
    label: "Points (L5 Avg)",
    color: "#9b59b6" // Purple
  },
  {
    key: "sog_per_60",
    rollingKey: "sog_per_60_avg_last5",
    baselineKey: "sog_per_60_avg_all",
    label: "Shots/60 (L5 Avg)",
    color: "#4bc0c0" // Teal
  },
  {
    key: "ixg_per_60",
    rollingKey: "ixg_per_60_avg_last5",
    baselineKey: "ixg_per_60_avg_all",
    label: "ixG/60 (L5 Avg)",
    color: "#00ff99" // Green
  },
  {
    key: "toi_seconds",
    rollingKey: "toi_seconds_avg_last5",
    baselineKey: "toi_seconds_avg_all",
    label: "TOI Seconds (L5 Avg)",
    color: "#ffcc33" // Yellow
  }
] as const;

type MetricConfig = (typeof METRIC_CONFIG)[number];
type MetricKey = MetricConfig["key"];
type DeltaKey = `${MetricKey}_delta`;

type RollingMetricRow = {
  game_date: string;
  goals_avg_last5: number | null;
  goals_avg_all: number | null;
  assists_avg_last5: number | null;
  assists_avg_all: number | null;
  points_avg_last5: number | null;
  points_avg_all: number | null;
  sog_per_60_avg_last5: number | null;
  sog_per_60_avg_all: number | null;
  ixg_per_60_avg_last5: number | null;
  ixg_per_60_avg_all: number | null;
  toi_seconds_avg_last5: number | null;
  toi_seconds_avg_all: number | null;
};

export default function PlayerTrendPage() {
  const router = useRouter();
  const { playerId } = router.query;

  const [playerName, setPlayerName] = useState<string>("");
  const [data, setData] = useState<RollingMetricRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(
    METRIC_CONFIG.map((metric) => metric.key)
  );

  useEffect(() => {
    if (!router.isReady || !playerId) return;
    const idNumber = Number(playerId);
    if (!Number.isFinite(idNumber)) {
      setError("Invalid player id.");
      return;
    }

    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [{ data: playerRow, error: playerError }, metricRows] =
          await Promise.all([
            supabase
              .from("players")
              .select("fullName")
              .eq("id", idNumber)
              .maybeSingle(),
            (async () => {
              const pageSize = 1000;
              let from = 0;
              const rows: RollingMetricRow[] = [];
              while (true) {
                const { data, error } = await supabase
                  .from("rolling_player_game_metrics")
                  .select(
                    "game_date, goals_avg_last5, goals_avg_all, assists_avg_last5, assists_avg_all, points_avg_last5, points_avg_all, sog_per_60_avg_last5, sog_per_60_avg_all, ixg_per_60_avg_last5, ixg_per_60_avg_all, toi_seconds_avg_last5, toi_seconds_avg_all"
                  )
                  .eq("player_id", idNumber)
                  .eq("strength_state", "all")
                  .order("game_date", { ascending: true })
                  .range(from, from + pageSize - 1);
                if (error) throw error;
                if (!data || data.length === 0) break;
                rows.push(...(data as RollingMetricRow[]));
                if (data.length < pageSize) break;
                from += pageSize;
              }
              return rows;
            })()
          ]);

        if (!mounted) return;

        if (playerError) throw playerError;

        console.debug(
          "[player trends] fetched player",
          idNumber,
          "name:",
          playerRow?.fullName
        );
        console.debug(
          "[player trends] rolling rows",
          metricRows.length,
          metricRows.slice(0, 3)
        );

        setPlayerName(playerRow?.fullName ?? `Player #${idNumber}`);
        setData(metricRows);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load player metrics.");
      } finally {
        mounted && setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [playerId, router.isReady]);

  const chartDatasets = useMemo(() => {
    const filtered = METRIC_CONFIG.filter((metric) =>
      selectedMetrics.includes(metric.key)
    );
    console.debug(
      "[player trends] active metrics",
      filtered.map((metric) => metric.key)
    );
    return filtered;
  }, [selectedMetrics]);

  const rechartsData = useMemo(() => {
    if (!data.length) return [];
    const transformed: Record<string, number | null | string>[] = [];

    data.forEach((row) => {
      const base: Record<string, number | null | string> = {
        gameDate: row.game_date
      };

      METRIC_CONFIG.forEach((metric) => {
        const rollingRaw = row[metric.rollingKey as keyof RollingMetricRow];
        const baselineRaw = row[metric.baselineKey as keyof RollingMetricRow];

        const rolling =
          rollingRaw === null || rollingRaw === undefined
            ? null
            : Number(rollingRaw);
        const baseline =
          baselineRaw === null || baselineRaw === undefined
            ? null
            : Number(baselineRaw);

        base[metric.rollingKey] = rolling;
        base[metric.baselineKey] = baseline;

        let delta: number | null = null;
        if (rolling !== null && baseline !== null && baseline !== 0) {
          delta = ((rolling - baseline) / Math.abs(baseline)) * 100;
        }
        base[`${metric.key}_delta` as DeltaKey] = delta;
      });

      transformed.push(base);
    });

    console.debug(
      "[player trends] baseline delta sample",
      transformed.slice(0, 3)
    );
    return transformed;
  }, [data]);

  const handleMetricToggle = (metricKey: MetricKey) => {
    setSelectedMetrics((prev) =>
      prev.includes(metricKey)
        ? prev.filter((key) => key !== metricKey)
        : [...prev, metricKey]
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <button
          type="button"
          onClick={() => router.push("/trends")}
          className={styles.backButton}
        >
          <span aria-hidden>←</span>
          Back to Trends
        </button>

        <header className={styles.headerCard}>
          <div>
            <h1 className={styles.title}>{playerName || "Player Trends"}</h1>
            <p className={styles.subtitle}>
              Rolling 5-game averages compared against this season&apos;s
              baseline. Watch how far each metric deviates above or below the
              player&apos;s normal level of play.
            </p>
          </div>
          <div className={styles.datasetBadge}>
            <p className={styles.datasetLabel}>Dataset health</p>
            <p className={styles.datasetValue}>
              {data.length ? `${data.length} games loaded` : "Awaiting data…"}
            </p>
          </div>
        </header>

        <section className={styles.toggleGroup}>
          {METRIC_CONFIG.map((metric) => {
            const active = selectedMetrics.includes(metric.key);
            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => handleMetricToggle(metric.key)}
                className={`${styles.metricChip} ${
                  active ? styles.metricChipActive : ""
                }`}
              >
                <span
                  className={styles.metricChipDot}
                  style={{ backgroundColor: metric.color }}
                />
                {metric.label}
              </button>
            );
          })}
        </section>

        <div className={styles.chartCard}>
          <div className={styles.chartInner}>
            {loading ? (
              <div className={styles.chartPlaceholder}>
                Loading rolling metrics…
              </div>
            ) : error ? (
              <div className={`${styles.chartPlaceholder} ${styles.error}`}>
                {error}
              </div>
            ) : !data.length ? (
              <div className={styles.chartPlaceholder}>
                No rolling metrics found for this player yet.
              </div>
            ) : !chartDatasets.length ? (
              <div className={styles.chartPlaceholder}>
                Enable at least one metric to render the chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rechartsData}
                  margin={{ top: 24, right: 32, left: 8, bottom: 48 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.1)"
                  />
                  <XAxis
                    dataKey="gameDate"
                    tickFormatter={(value) =>
                      new Date(value as string).toLocaleDateString()
                    }
                    minTickGap={16}
                    stroke="#aaaaaa"
                    tick={{
                      fill: "#aaaaaa",
                      fontSize: 12,
                      fontFamily: "'Martian Mono', monospace"
                    }}
                  />
                  <YAxis
                    stroke="#aaaaaa"
                    tickFormatter={(value) => `${value}%`}
                    tick={{
                      fill: "#aaaaaa",
                      fontSize: 12,
                      fontFamily: "'Martian Mono', monospace"
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(26, 29, 33, 0.95)",
                      border: "1px solid #505050",
                      borderRadius: "8px",
                      color: "#cccccc",
                      padding: "12px",
                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)"
                    }}
                    itemStyle={{
                      fontFamily: "'Martian Mono', monospace",
                      fontSize: "12px"
                    }}
                    labelStyle={{
                      color: "#ffffff",
                      fontFamily: "'Train One', sans-serif",
                      marginBottom: "8px",
                      letterSpacing: "0.05em"
                    }}
                    labelFormatter={(value) =>
                      new Date(value as string).toLocaleString()
                    }
                    formatter={(value: any, name: string, props: any) => {
                      if (value === null || value === undefined) {
                        return ["N/A", name];
                      }
                      const percentValue = Number(value).toFixed(2);
                      const deltaKey = props.dataKey as string;
                      const metricKey = deltaKey.replace(/_delta$/, "");
                      const config = METRIC_CONFIG.find(
                        (m) => m.key === metricKey
                      );
                      const rollingValue =
                        config && props.payload
                          ? props.payload[config.rollingKey]
                          : undefined;
                      const baselineValue =
                        config && props.payload
                          ? props.payload[config.baselineKey]
                          : undefined;
                      const rawDisplay =
                        rollingValue === null || rollingValue === undefined
                          ? ""
                          : ` (rolling ${Number(rollingValue).toFixed(
                              3
                            )}, baseline ${
                              baselineValue === null ||
                              baselineValue === undefined
                                ? "N/A"
                                : Number(baselineValue).toFixed(3)
                            })`;
                      return [`${percentValue}%${rawDisplay}`, name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: 12
                    }}
                    formatter={(value) => (
                      <span className={styles.legendLabel}>{value}</span>
                    )}
                  />
                  {chartDatasets.map((metric) => (
                    <Line
                      key={metric.key}
                      type="monotone"
                      dataKey={`${metric.key}_delta`}
                      name={`${metric.label} vs Season % Δ`}
                      stroke={metric.color}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 6,
                        strokeWidth: 0,
                        fill: metric.color,
                        filter: `drop-shadow(0 0 6px ${metric.color})`
                      }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                  <Brush
                    dataKey="gameDate"
                    height={34}
                    stroke="#14a2d2"
                    fill="#24282e"
                    travellerWidth={12}
                    tickFormatter={(value) =>
                      new Date(value as string).toLocaleDateString()
                    }
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
