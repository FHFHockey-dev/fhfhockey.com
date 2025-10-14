import React, { useEffect, useMemo, useState } from "react";
import styles from "./TransactionTrends.module.scss";

// Local minimal sparkline rather than depending on predictions code

type OwnershipPoint = { date: string; value: number };
type TrendPlayer = {
  playerKey: string;
  name: string;
  headshot: string | null;
  displayPosition?: string | null;
  teamFullName?: string | null;
  latest: number;
  previous: number;
  delta: number;
  deltaPct: number;
  sparkline: OwnershipPoint[];
};

interface ApiResponse {
  success: boolean;
  windowDays: number;
  risers: TrendPlayer[];
  fallers: TrendPlayer[];
  error?: string;
}

const WINDOWS = [1, 3, 5, 10];

function Spark({
  points,
  variant
}: {
  points: OwnershipPoint[];
  variant: "rise" | "fall";
}) {
  const pathData = useMemo(() => {
    if (!points.length) return null;
    const pts = points.filter((p) => typeof p.value === "number");
    if (!pts.length) return null;
    const series = pts.slice(-Math.min(pts.length, 20));
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
    const baseVal = series[0].value;
    const baselineY = 38 - ((baseVal - min) / range) * 30 - 2;
    return { line, area, baselineY: Math.min(38, Math.max(2, baselineY)) };
  }, [points]);

  if (!pathData) return <div>—</div>;
  return (
    <svg
      className={styles.sparkSvg}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
    >
      <polyline
        className={styles.sparkBaseline}
        points={`0,${pathData.baselineY} 100,${pathData.baselineY}`}
      />
      <polygon
        className={`${styles.sparkArea} ${variant === "rise" ? styles.rise : styles.fall}`}
        points={pathData.area}
      />
      <polyline
        className={`${styles.sparkPath} ${variant === "rise" ? styles.rise : styles.fall}`}
        points={pathData.line}
      />
    </svg>
  );
}

export default function TransactionTrends() {
  // Default to 3-day window per request
  const [windowDays, setWindowDays] = useState(3);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/transactions/ownership-trends?window=${windowDays}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        if (!active) return;
        if (!json.success) throw new Error(json.error || "Unknown error");
        setData(json);
      } catch (e: any) {
        if (active) setError(e.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [windowDays]);

  return (
    <section
      className={styles.transactionTrends}
      aria-labelledby="trends-heading"
    >
      <div className={styles.headerRow}>
        <h2 id="trends-heading" className={styles.title}>
          Transaction <span>Trends</span>
        </h2>
        <div
          className={styles.timeframeButtons}
          role="group"
          aria-label="Time windows"
        >
          {WINDOWS.map((w) => (
            <button
              key={w}
              className={w === windowDays ? "active" : ""}
              onClick={() => setWindowDays(w)}
            >
              {w}D
            </button>
          ))}
        </div>
      </div>
      {loading && !data && (
        <div className={styles.loading}>Loading ownership movement…</div>
      )}
      {error && <div className={styles.errorMsg}>{error}</div>}
      {data && (
        <div className={styles.tablesWrapper}>
          <div className={`${styles.panel} ${styles.risersPanel}`}>
            <h3 className={styles.tableTitle}>
              Top Risers (Δ {data.windowDays}D)
            </h3>
            <table
              className={styles.dataTable}
              aria-label="Top ownership risers"
            >
              <thead>
                <tr>
                  <th scope="col" className={styles.rankCell}>
                    #
                  </th>
                  <th scope="col">Player</th>
                  <th scope="col" className={styles.ownCellHeader}>
                    Own
                  </th>
                  <th scope="col" className={styles.sparkCell}>
                    Trend
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Δ
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.risers.slice(0, 10).map((p, idx) => (
                  <tr key={p.playerKey} className={styles.riseRow}>
                    <th scope="row" className={styles.rankCell}>
                      {idx + 1}
                    </th>
                    <td className={styles.playerCell}>
                      {p.headshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.headshot}
                          alt=""
                          className={styles.headshot}
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className={styles.headshot}
                          style={{ background: "#333" }}
                        />
                      )}
                      <span className={styles.playerText}>
                        <span className={styles.playerName}>{p.name}</span>
                        {(p.displayPosition || p.teamFullName) && (
                          <span className={styles.playerMeta}>
                            {p.displayPosition ? `${p.displayPosition}` : ""}
                            {p.displayPosition && p.teamFullName ? " • " : ""}
                            {p.teamFullName ? `${p.teamFullName}` : ""}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={styles.ownCell}>
                      <div className={`${styles.neonBox} ${styles.rise}`}>
                        {p.latest.toFixed(1)}%
                      </div>
                    </td>
                    <td className={styles.sparkCell}>
                      <div className={`${styles.neonBox} ${styles.rise}`}>
                        <Spark points={p.sparkline} variant="rise" />
                      </div>
                    </td>
                    <td className={styles.deltaCell}>
                      <div className={`${styles.neonBox} ${styles.rise}`}>
                        {p.delta > 0
                          ? `+${p.delta.toFixed(1)}%`
                          : `${p.delta.toFixed(1)}%`}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`${styles.panel} ${styles.fallersPanel}`}>
            <h3 className={styles.tableTitle}>
              Top Fallers (Δ {data.windowDays}D)
            </h3>
            <table
              className={styles.dataTable}
              aria-label="Top ownership fallers"
            >
              <thead>
                <tr>
                  <th scope="col" className={styles.rankCell}>
                    #
                  </th>
                  <th scope="col">Player</th>
                  <th scope="col" className={styles.ownCellHeader}>
                    Own
                  </th>
                  <th scope="col" className={styles.sparkCell}>
                    Trend
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Δ
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.fallers.slice(0, 10).map((p, idx) => (
                  <tr key={p.playerKey} className={styles.fallRow}>
                    <th scope="row" className={styles.rankCell}>
                      {idx + 1}
                    </th>
                    <td className={styles.playerCell}>
                      {p.headshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.headshot}
                          alt=""
                          className={styles.headshot}
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className={styles.headshot}
                          style={{ background: "#333" }}
                        />
                      )}
                      <span className={styles.playerText}>
                        <span className={styles.playerName}>{p.name}</span>
                        {(p.displayPosition || p.teamFullName) && (
                          <span className={styles.playerMeta}>
                            {p.displayPosition ? `${p.displayPosition}` : ""}
                            {p.displayPosition && p.teamFullName ? " • " : ""}
                            {p.teamFullName ? `${p.teamFullName}` : ""}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={styles.ownCell}>
                      <div className={`${styles.neonBox} ${styles.fall}`}>
                        {p.latest.toFixed(1)}%
                      </div>
                    </td>
                    <td className={styles.sparkCell}>
                      <div className={`${styles.neonBox} ${styles.fall}`}>
                        <Spark points={p.sparkline} variant="fall" />
                      </div>
                    </td>
                    <td className={styles.deltaCell}>
                      <div className={`${styles.neonBox} ${styles.fall}`}>
                        {p.delta.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className={styles.footNote}>
        Δ = change in Yahoo! percent ownership (percentage points) over selected
        window. Sparkline shows recent daily trajectory.
      </p>
    </section>
  );
}
