import { useEffect, useMemo, useState } from "react";

import styles from "styles/ForgeDashboard.module.scss";

type SparkPoint = { date: string; value: number };

type CtpiTeamRow = {
  team: string;
  ctpi_0_to_100: number;
  offense: number;
  defense: number;
  luck: number;
  sparkSeries?: SparkPoint[];
};

type CtpiResponse = {
  seasonId: number;
  generatedAt: string;
  teams: CtpiTeamRow[];
};

type HotColdCardProps = {
  team: string;
};

type MomentumRow = CtpiTeamRow & {
  momentum: number;
  spark: SparkPoint[];
};

const formatSigned = (value: number): string => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

const shortReason = (row: CtpiTeamRow): string => {
  const drivers: string[] = [];
  if (row.offense >= 60) drivers.push("offense surge");
  if (row.defense >= 60) drivers.push("defensive control");
  if (row.luck >= 60) drivers.push("puck luck");
  if (drivers.length === 0) {
    if (row.offense <= 40) drivers.push("offense cooling");
    if (row.defense <= 40) drivers.push("defense leaking");
    if (row.luck <= 40) drivers.push("unlucky stretch");
  }
  return drivers.slice(0, 2).join(" · ") || "balanced form";
};

function SparkMini({ points, variant }: { points: SparkPoint[]; variant: "hot" | "cold" }) {
  const shape = useMemo(() => {
    if (!points || points.length === 0) return null;
    const series = points.slice(-10);
    const values = series.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 0.5;
      max += 0.5;
    }
    const range = max - min || 1;
    const norm = series.map((p, i) => ({
      x: series.length === 1 ? 0 : (i / (series.length - 1)) * 100,
      y: 38 - ((p.value - min) / range) * 30 - 2
    }));

    const line = norm.map((n) => `${n.x},${n.y.toFixed(2)}`).join(" ");
    const area = `0,40 ${line} 100,40`;
    return { line, area };
  }, [points]);

  if (!shape) return <div className={styles.sparkEmpty}>—</div>;

  return (
    <svg className={styles.sparkSvg} viewBox="0 0 100 40" preserveAspectRatio="none">
      <polygon
        className={`${styles.sparkArea} ${variant === "hot" ? styles.sparkRise : styles.sparkFall}`}
        points={shape.area}
      />
      <polyline
        className={`${styles.sparkPath} ${variant === "hot" ? styles.sparkRise : styles.sparkFall}`}
        points={shape.line}
      />
    </svg>
  );
}

export default function HotColdCard({ team }: HotColdCardProps) {
  const [rows, setRows] = useState<CtpiTeamRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/v1/trends/team-ctpi")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load hot/cold trends (${response.status})`);
        }
        return (await response.json()) as CtpiResponse;
      })
      .then((payload) => {
        if (!active) return;
        setRows(payload.teams ?? []);
        setGeneratedAt(payload.generatedAt ?? null);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load hot/cold trends.";
        setError(message);
        setRows([]);
        setGeneratedAt(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const ranked = useMemo<MomentumRow[]>(() => {
    return rows
      .filter((row) => (team === "all" ? true : row.team === team.toUpperCase()))
      .map((row) => {
        const spark = row.sparkSeries?.slice(-10) ?? [];
        const first = spark[0]?.value ?? row.ctpi_0_to_100;
        const last = spark[spark.length - 1]?.value ?? row.ctpi_0_to_100;
        return {
          ...row,
          spark,
          momentum: last - first
        };
      })
      .sort((a, b) => b.momentum - a.momentum);
  }, [rows, team]);

  const hotRows = useMemo(() => ranked.slice(0, 3), [ranked]);
  const coldRows = useMemo(() => [...ranked].reverse().slice(0, 3), [ranked]);
  const isStale = useMemo(() => {
    if (!generatedAt) return false;
    const ts = new Date(generatedAt).getTime();
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts > 36 * 60 * 60 * 1000;
  }, [generatedAt]);

  return (
    <article className={styles.hotColdCard} aria-label="Team hot and cold streaks">
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Hot / Cold Streaks</h3>
        <span className={styles.panelMeta}>Momentum (last 10)</span>
      </header>

      {loading && <p className={styles.panelState}>Loading hot/cold streaks...</p>}
      {!loading && error && <p className={styles.panelState}>Error: {error}</p>}

      {!loading && !error && ranked.length === 0 && (
        <p className={styles.panelState}>No trend streak data available.</p>
      )}
      {!loading && !error && isStale && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          Trend feed may be stale (last update {generatedAt}).
        </p>
      )}

      {!loading && !error && ranked.length > 0 && (
        <div className={styles.hotColdColumns}>
          <div className={styles.hotColdColumn}>
            <p className={styles.susColumnTitle}>Hot Teams</p>
            <ul className={styles.susList}>
              {hotRows.map((row) => (
                <li key={`hot-${row.team}`} className={styles.hotColdRow}>
                  <div>
                    <p className={styles.hotColdName}>{row.team}</p>
                    <p className={styles.hotColdReason}>{shortReason(row)}</p>
                  </div>
                  <div className={styles.hotColdStats}>
                    <span className={styles.hotColdDelta}>{formatSigned(row.momentum)}</span>
                    <SparkMini points={row.spark} variant="hot" />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.hotColdColumn}>
            <p className={styles.susColumnTitle}>Cold Teams</p>
            <ul className={styles.susList}>
              {coldRows.map((row) => (
                <li key={`cold-${row.team}`} className={styles.hotColdRow}>
                  <div>
                    <p className={styles.hotColdName}>{row.team}</p>
                    <p className={styles.hotColdReason}>{shortReason(row)}</p>
                  </div>
                  <div className={styles.hotColdStats}>
                    <span className={`${styles.hotColdDelta} ${styles.hotColdDeltaDown}`}>
                      {formatSigned(row.momentum)}
                    </span>
                    <SparkMini points={row.spark} variant="cold" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}
