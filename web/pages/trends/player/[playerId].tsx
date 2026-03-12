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

const BASELINE_OPTIONS = [
  { key: "avg_season", label: "Season" },
  { key: "avg_3ya", label: "3-Year" },
  { key: "avg_career", label: "Career" },
  { key: "avg_all", label: "Cumulative" }
] as const;

const ROLLING_WINDOW_OPTIONS = [
  { key: "avg_last3", label: "3" },
  { key: "avg_last5", label: "5" },
  { key: "avg_last10", label: "10" },
  { key: "avg_last20", label: "20" },
  { key: "avg_all", label: "Cumulative" }
] as const;

type BaselineMode = (typeof BASELINE_OPTIONS)[number]["key"];
type RollingWindowMode = (typeof ROLLING_WINDOW_OPTIONS)[number]["key"];

const METRIC_GROUPS = [
  {
    id: "surface",
    label: "Surface",
    metrics: [
      {
        key: "goals",
        label: "Goals",
        color: "#ff9f40"
      },
      {
        key: "assists",
        label: "Assists",
        color: "#3b82f6"
      },
      {
        key: "points",
        label: "Points",
        color: "#9b59b6"
      },
      {
        key: "shots",
        label: "Shots",
        color: "#4bc0c0"
      },
      {
        key: "hits",
        label: "Hits",
        color: "#ef4444"
      },
      {
        key: "blocks",
        label: "Blocks",
        color: "#facc15"
      },
      {
        key: "pp_points",
        label: "PP Points",
        color: "#14b8a6"
      }
    ]
  },
  {
    id: "rates",
    label: "Rates",
    metrics: [
      {
        key: "goals_per_60",
        label: "Goals / 60",
        color: "#f97316"
      },
      {
        key: "assists_per_60",
        label: "Assists / 60",
        color: "#38bdf8"
      },
      {
        key: "primary_assists_per_60",
        label: "1A / 60",
        color: "#8b5cf6"
      },
      {
        key: "secondary_assists_per_60",
        label: "2A / 60",
        color: "#ec4899"
      },
      {
        key: "sog_per_60",
        label: "Shots / 60",
        color: "#06b6d4"
      },
      {
        key: "ixg_per_60",
        label: "ixG / 60",
        color: "#10b981"
      },
      {
        key: "hits_per_60",
        label: "Hits / 60",
        color: "#fb7185"
      },
      {
        key: "blocks_per_60",
        label: "Blocks / 60",
        color: "#f59e0b"
      }
    ]
  },
  {
    id: "finishing",
    label: "Finishing",
    metrics: [
      {
        key: "shooting_pct",
        label: "Shooting %",
        color: "#22c55e"
      },
      {
        key: "expected_sh_pct",
        label: "Expected SH%",
        color: "#84cc16"
      },
      {
        key: "on_ice_sh_pct",
        label: "On-Ice SH%",
        color: "#38bdf8"
      },
      {
        key: "on_ice_sv_pct",
        label: "On-Ice SV%",
        color: "#0ea5e9"
      },
      {
        key: "pdo",
        label: "PDO",
        color: "#f97316"
      },
      {
        key: "ipp",
        label: "IPP",
        color: "#8b5cf6"
      },
      {
        key: "primary_points_pct",
        label: "Primary Points %",
        color: "#ec4899"
      }
    ]
  },
  {
    id: "usage",
    label: "Usage",
    metrics: [
      {
        key: "toi_seconds",
        label: "TOI Seconds",
        color: "#eab308"
      },
      {
        key: "pp_share_pct",
        label: "PP Share %",
        color: "#0ea5e9"
      },
      {
        key: "oz_start_pct",
        label: "OZ Start %",
        color: "#6366f1"
      },
      {
        key: "oz_starts",
        label: "OZ Starts",
        color: "#4f46e5"
      },
      {
        key: "dz_starts",
        label: "DZ Starts",
        color: "#ef4444"
      },
      {
        key: "nz_starts",
        label: "NZ Starts",
        color: "#14b8a6"
      }
    ]
  },
  {
    id: "chance",
    label: "Chance Profile",
    metrics: [
      {
        key: "ixg",
        label: "ixG",
        color: "#00ff99"
      },
      {
        key: "iscf",
        label: "iSCF",
        color: "#22d3ee"
      },
      {
        key: "ihdcf",
        label: "iHDCF",
        color: "#f43f5e"
      },
      {
        key: "cf",
        label: "CF",
        color: "#a855f7"
      },
      {
        key: "ca",
        label: "CA",
        color: "#f87171"
      },
      {
        key: "cf_pct",
        label: "CF%",
        color: "#60a5fa"
      },
      {
        key: "ff",
        label: "FF",
        color: "#2dd4bf"
      },
      {
        key: "fa",
        label: "FA",
        color: "#fb7185"
      },
      {
        key: "ff_pct",
        label: "FF%",
        color: "#818cf8"
      },
      {
        key: "oi_gf",
        label: "On-Ice GF",
        color: "#22c55e"
      },
      {
        key: "oi_ga",
        label: "On-Ice GA",
        color: "#f87171"
      },
      {
        key: "oi_sf",
        label: "On-Ice SF",
        color: "#0ea5e9"
      },
      {
        key: "oi_sa",
        label: "On-Ice SA",
        color: "#f59e0b"
      }
    ]
  }
] as const;

const METRIC_CONFIG = METRIC_GROUPS.flatMap((group) =>
  group.metrics.map((metric) => ({
    ...metric,
    groupId: group.id,
    groupLabel: group.label
  }))
);

type MetricConfig = (typeof METRIC_CONFIG)[number];
type MetricKey = MetricConfig["key"];
type RollingMetricRow = {
  game_date: string;
} & Record<string, number | null | string>;
type StreakSummary = {
  metricKey: MetricKey;
  label: string;
  direction: "hot" | "cold" | "steady";
  games: number;
  latestDelta: number;
  averageDelta: number;
};

function getMetricField(metricKey: MetricKey, mode: RollingWindowMode | BaselineMode) {
  return `${metricKey}_${mode}`;
}

function buildSelectClause() {
  const fields = new Set<string>(["game_date"]);
  METRIC_CONFIG.forEach((metric) => {
    ROLLING_WINDOW_OPTIONS.forEach((option) =>
      fields.add(getMetricField(metric.key, option.key))
    );
    BASELINE_OPTIONS.forEach((option) =>
      fields.add(getMetricField(metric.key, option.key))
    );
  });
  return Array.from(fields).join(", ");
}

const SELECT_CLAUSE = buildSelectClause();

export default function PlayerTrendPage() {
  const router = useRouter();
  const { playerId } = router.query;

  const [playerName, setPlayerName] = useState<string>("");
  const [data, setData] = useState<RollingMetricRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(
    METRIC_GROUPS[0].metrics.map((metric) => metric.key)
  );
  const [baselineMode, setBaselineMode] = useState<BaselineMode>("avg_season");
  const [rollingWindowMode, setRollingWindowMode] =
    useState<RollingWindowMode>("avg_last5");
  const [activeGroup, setActiveGroup] = useState<(typeof METRIC_GROUPS)[number]["id"]>(
    "surface"
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
                  .select(SELECT_CLAUSE)
                  .eq("player_id", idNumber)
                  .eq("strength_state", "all")
                  .order("game_date", { ascending: true })
                  .range(from, from + pageSize - 1);
                if (error) throw error;
                if (!data || data.length === 0) break;
                rows.push(...(data as unknown as RollingMetricRow[]));
                if (data.length < pageSize) break;
                from += pageSize;
              }
              return rows;
            })()
          ]);

        if (!mounted) return;
        if (playerError) throw playerError;

        setPlayerName(playerRow?.fullName ?? `Player #${idNumber}`);
        setData(metricRows);
      } catch (err: any) {
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

  const visibleMetricOptions = useMemo(
    () => METRIC_CONFIG.filter((metric) => metric.groupId === activeGroup),
    [activeGroup]
  );

  const chartDatasets = useMemo(
    () =>
      METRIC_CONFIG.filter(
        (metric) =>
          metric.groupId === activeGroup && selectedMetrics.includes(metric.key)
      ),
    [activeGroup, selectedMetrics]
  );

  const rechartsData = useMemo(() => {
    if (!data.length) return [];
    return data.map((row) => {
      const base: Record<string, number | null | string> = {
        gameDate: row.game_date
      };

      METRIC_CONFIG.forEach((metric) => {
        const rollingField = getMetricField(metric.key, rollingWindowMode);
        const baselineField = getMetricField(metric.key, baselineMode);
        const rollingRaw = row[rollingField];
        const baselineRaw = row[baselineField];

        const rolling =
          rollingRaw === null || rollingRaw === undefined
            ? null
            : Number(rollingRaw);
        const baseline =
          baselineRaw === null || baselineRaw === undefined
            ? null
            : Number(baselineRaw);

        base[rollingField] = rolling;
        base[baselineField] = baseline;
        base[`${metric.key}_absolute`] =
          rolling !== null && baseline !== null ? rolling - baseline : null;
        base[`${metric.key}_delta`] =
          rolling !== null && baseline !== null && baseline !== 0
            ? ((rolling - baseline) / Math.abs(baseline)) * 100
            : null;
      });

      return base;
    });
  }, [baselineMode, data, rollingWindowMode]);

  const streakSummaries = useMemo(() => {
    if (!rechartsData.length) return [] as StreakSummary[];

    return chartDatasets
      .map((metric) => {
        const deltas = rechartsData
          .map((row) => row[`${metric.key}_delta`])
          .filter(
            (value): value is number =>
              typeof value === "number" && Number.isFinite(value)
          );

        if (!deltas.length) {
          return {
            metricKey: metric.key,
            label: metric.label,
            direction: "steady",
            games: 0,
            latestDelta: 0,
            averageDelta: 0
          } satisfies StreakSummary;
        }

        const latestDelta = deltas[deltas.length - 1] ?? 0;
        const direction =
          latestDelta >= 8 ? "hot" : latestDelta <= -8 ? "cold" : "steady";
        let games = 0;

        if (direction === "hot") {
          for (let index = deltas.length - 1; index >= 0; index -= 1) {
            if ((deltas[index] ?? 0) < 0) break;
            games += 1;
          }
        } else if (direction === "cold") {
          for (let index = deltas.length - 1; index >= 0; index -= 1) {
            if ((deltas[index] ?? 0) > 0) break;
            games += 1;
          }
        }

        const averageDelta =
          deltas.reduce((sum, value) => sum + value, 0) / deltas.length;

        return {
          metricKey: metric.key,
          label: metric.label,
          direction,
          games,
          latestDelta,
          averageDelta
        } satisfies StreakSummary;
      })
      .sort((left, right) => Math.abs(right.latestDelta) - Math.abs(left.latestDelta));
  }, [chartDatasets, rechartsData]);

  const handleMetricToggle = (metricKey: MetricKey) => {
    setSelectedMetrics((prev) =>
      prev.includes(metricKey)
        ? prev.filter((key) => key !== metricKey)
        : [...prev, metricKey]
    );
  };

  const activeGroupMeta = METRIC_GROUPS.find((group) => group.id === activeGroup);

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
              Plot rolling historical averages from
              <span className={styles.inlineMono}> rolling_player_game_metrics </span>
              across surface stats, rates, finishing, usage, and chance profile
              metrics. Switch the recent window and baseline to inspect how a
              player is moving against different historical anchors.
            </p>
          </div>
          <div className={styles.datasetBadge}>
            <p className={styles.datasetLabel}>Dataset health</p>
            <p className={styles.datasetValue}>
              {data.length ? `${data.length} games loaded` : "Awaiting data…"}
            </p>
          </div>
        </header>

        <section className={styles.groupPanel}>
          <div>
            <p className={styles.baselineLabel}>Metric group</p>
            <p className={styles.baselineCopy}>
              Focus the chart on a specific family of tracked rolling metrics.
            </p>
          </div>
          <div className={styles.baselineToggleGroup}>
            {METRIC_GROUPS.map((group) => {
              const active = activeGroup === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroup(group.id)}
                  className={`${styles.baselineToggle} ${
                    active ? styles.baselineToggleActive : ""
                  }`}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.toggleGroup}>
          {visibleMetricOptions.map((metric) => {
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

        <section className={styles.controlsGrid}>
          <section className={styles.baselinePanel}>
            <div>
              <p className={styles.baselineLabel}>Recent rolling window</p>
              <p className={styles.baselineCopy}>
                Plot 3/5/10/20-game or cumulative rolling values.
              </p>
            </div>
            <div className={styles.baselineToggleGroup}>
              {ROLLING_WINDOW_OPTIONS.map((option) => {
                const active = rollingWindowMode === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setRollingWindowMode(option.key)}
                    className={`${styles.baselineToggle} ${
                      active ? styles.baselineToggleActive : ""
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.baselinePanel}>
            <div>
              <p className={styles.baselineLabel}>Baseline reference</p>
              <p className={styles.baselineCopy}>
                Compare the chosen rolling window against season-to-date,
                3-year, career, or cumulative historical averages.
              </p>
            </div>
            <div className={styles.baselineToggleGroup}>
              {BASELINE_OPTIONS.map((option) => {
                const active = baselineMode === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setBaselineMode(option.key)}
                    className={`${styles.baselineToggle} ${
                      active ? styles.baselineToggleActive : ""
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        </section>

        <section className={styles.summaryStrip}>
          <div className={styles.summaryCell}>
            <span className={styles.summaryLabel}>Active group</span>
            <strong>{activeGroupMeta?.label ?? "Unknown"}</strong>
          </div>
          <div className={styles.summaryCell}>
            <span className={styles.summaryLabel}>Visible metrics</span>
            <strong>{chartDatasets.length}</strong>
          </div>
          <div className={styles.summaryCell}>
            <span className={styles.summaryLabel}>Rolling window</span>
            <strong>
              {ROLLING_WINDOW_OPTIONS.find((option) => option.key === rollingWindowMode)
                ?.label ?? "—"}
            </strong>
          </div>
          <div className={styles.summaryCell}>
            <span className={styles.summaryLabel}>Baseline</span>
            <strong>
              {BASELINE_OPTIONS.find((option) => option.key === baselineMode)?.label ??
                "—"}
            </strong>
          </div>
        </section>

        <section className={styles.streakPanel}>
          <div className={styles.streakHeader}>
            <div>
              <p className={styles.baselineLabel}>Sustained streaks</p>
              <p className={styles.baselineCopy}>
                These cards react to the active baseline toggle so you can see
                which metrics stay above or below the chosen historical anchor.
              </p>
            </div>
          </div>
          <div className={styles.streakGrid}>
            {streakSummaries.slice(0, 4).map((summary) => (
              <article
                key={summary.metricKey}
                className={`${styles.streakCard} ${
                  summary.direction === "hot"
                    ? styles.streakHot
                    : summary.direction === "cold"
                      ? styles.streakCold
                      : styles.streakNeutral
                }`}
              >
                <span className={styles.summaryLabel}>{summary.label}</span>
                <strong className={styles.streakValue}>
                  {summary.latestDelta >= 0 ? "+" : ""}
                  {summary.latestDelta.toFixed(1)}%
                </strong>
                <p className={styles.streakMeta}>
                  {summary.direction === "steady"
                    ? `steady vs ${BASELINE_OPTIONS.find((option) => option.key === baselineMode)?.label ?? "baseline"}`
                    : `${summary.games} straight games ${summary.direction === "hot" ? "above" : "below"} ${BASELINE_OPTIONS.find((option) => option.key === baselineMode)?.label ?? "baseline"}`}
                </p>
                <p className={styles.streakMeta}>
                  Avg delta {summary.averageDelta >= 0 ? "+" : ""}
                  {summary.averageDelta.toFixed(1)}%
                </p>
              </article>
            ))}
          </div>
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
                    formatter={(value: unknown, name: string, props: any) => {
                      if (value === null || value === undefined) {
                        return ["N/A", name];
                      }
                      const percentValue = Number(value).toFixed(2);
                      const deltaKey = props.dataKey as string;
                      const metricKey = deltaKey.replace(/_delta$/, "");
                      const config = METRIC_CONFIG.find(
                        (metric) => metric.key === metricKey
                      );
                      const rollingField = config
                        ? getMetricField(config.key, rollingWindowMode)
                        : null;
                      const baselineField = config
                        ? getMetricField(config.key, baselineMode)
                        : null;
                      const rollingValue =
                        rollingField && props.payload
                          ? props.payload[rollingField]
                          : undefined;
                      const baselineValue =
                        baselineField && props.payload
                          ? props.payload[baselineField]
                          : undefined;
                      const rawDisplay =
                        rollingValue === null || rollingValue === undefined
                          ? ""
                          : ` (recent ${Number(rollingValue).toFixed(3)}, baseline ${
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
                      name={`${metric.label} vs ${
                        BASELINE_OPTIONS.find((option) => option.key === baselineMode)
                          ?.label ?? "Baseline"
                      } % Δ`}
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
