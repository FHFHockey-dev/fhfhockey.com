import { useEffect, useMemo, useState } from "react";

import styles from "styles/ForgeDashboard.module.scss";

type SustainabilityDirection = "hot" | "cold";
type ApiRow = {
  player_id: number;
  player_name: string | null;
  position_group: string;
  position_code: string | null;
  window_code: string;
  s_100: number;
  luck_pressure: number;
};

type ApiResponse = {
  success: boolean;
  snapshot_date: string;
  window_code: string;
  direction: SustainabilityDirection;
  rows: ApiRow[];
};

type SustainabilityCardProps = {
  date: string;
  position: "all" | "f" | "d" | "g";
};

const toPosParam = (position: SustainabilityCardProps["position"]): "all" | "F" | "D" => {
  if (position === "f") return "F";
  if (position === "d") return "D";
  return "all";
};

const formatScore = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(1);
};

const formatSigned = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
};

const confidenceLabel = (pressure: number): string => {
  const abs = Math.abs(pressure);
  if (abs >= 1.25) return "High";
  if (abs >= 0.75) return "Medium";
  return "Low";
};

async function fetchDirection(params: {
  date: string;
  pos: "all" | "F" | "D";
  direction: SustainabilityDirection;
  limit: number;
}): Promise<ApiResponse> {
  const query = new URLSearchParams({
    snapshot_date: params.date,
    window_code: "l10",
    pos: params.pos,
    direction: params.direction,
    limit: String(params.limit)
  });

  const response = await fetch(`/api/v1/sustainability/trends?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Unable to load sustainability (${response.status})`);
  }

  return (await response.json()) as ApiResponse;
}

export default function SustainabilityCard({ date, position }: SustainabilityCardProps) {
  const [hotRows, setHotRows] = useState<ApiRow[]>([]);
  const [coldRows, setColdRows] = useState<ApiRow[]>([]);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const pos = toPosParam(position);

    Promise.all([
      fetchDirection({ date, pos, direction: "hot", limit: 8 }),
      fetchDirection({ date, pos, direction: "cold", limit: 8 })
    ])
      .then(([hot, cold]) => {
        if (!active) return;
        setHotRows(hot.rows ?? []);
        setColdRows(cold.rows ?? []);
        setSnapshotDate(hot.snapshot_date ?? cold.snapshot_date ?? null);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load sustainability data.";
        setError(message);
        setHotRows([]);
        setColdRows([]);
        setSnapshotDate(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, position]);

  const sustainableRows = useMemo(() => coldRows.slice(0, 5), [coldRows]);
  const riskRows = useMemo(() => hotRows.slice(0, 5), [hotRows]);
  const isStale = Boolean(snapshotDate && snapshotDate !== date);

  return (
    <article className={styles.sustainabilityCard} aria-label="Sustainable versus unsustainable performances">
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Sustainable vs Unsustainable</h3>
        <span className={styles.panelMeta}>Window L10</span>
      </header>

      {loading && <p className={styles.panelState}>Loading sustainability signals...</p>}
      {!loading && error && <p className={styles.panelState}>Error: {error}</p>}

      {!loading && !error && sustainableRows.length === 0 && riskRows.length === 0 && (
        <p className={styles.panelState}>No sustainability signals available for this date.</p>
      )}
      {!loading && !error && isStale && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          Showing nearest available snapshot ({snapshotDate}).
        </p>
      )}

      {!loading && !error && (sustainableRows.length > 0 || riskRows.length > 0) && (
        <div className={styles.sustainabilityColumns}>
          <div className={styles.susColumn}>
            <p className={styles.susColumnTitle}>Most Sustainable</p>
            <ul className={styles.susList}>
              {sustainableRows.map((row) => (
                <li key={`sustain-${row.player_id}`} className={styles.susRow}>
                  <span className={styles.susName}>{row.player_name ?? `Player ${row.player_id}`}</span>
                  <span className={styles.susMeta}>
                    S {formatScore(row.s_100)} | L {formatSigned(row.luck_pressure)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.susColumn}>
            <p className={styles.susColumnTitle}>Highest Regression Risk</p>
            <ul className={styles.susList}>
              {riskRows.map((row) => (
                <li key={`risk-${row.player_id}`} className={styles.susRow}>
                  <span className={styles.susName}>{row.player_name ?? `Player ${row.player_id}`}</span>
                  <span className={styles.susMeta}>
                    S {formatScore(row.s_100)} | L {formatSigned(row.luck_pressure)} | {" "}
                    {confidenceLabel(row.luck_pressure)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}
