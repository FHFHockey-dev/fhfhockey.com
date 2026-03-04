import { useEffect, useMemo, useState } from "react";

import TopMovers from "components/TopMovers/TopMovers";
import styles from "styles/ForgeDashboard.module.scss";

type Lens = "team" | "skater";

type TeamCtpiRow = {
  team: string;
  ctpi_0_to_100: number;
  sparkSeries?: Array<{ date: string; value: number }>;
};

type TeamCtpiResponse = {
  generatedAt?: string;
  teams: TeamCtpiRow[];
};

type SkaterRankingRow = {
  playerId: number;
  delta: number;
};

type SkaterMetadata = {
  fullName: string;
  imageUrl: string | null;
};

type SkaterCategory = {
  rankings?: SkaterRankingRow[];
};

type SkaterPowerResponse = {
  generatedAt?: string;
  categories?: Record<string, SkaterCategory>;
  playerMetadata?: Record<string, SkaterMetadata>;
};

type Mover = {
  id: string;
  name: string;
  logo?: string;
  delta: number;
  current?: number;
};

type TopMoversCardProps = {
  position: "all" | "f" | "d" | "g";
};

const DEFAULT_TEAM_LOGO = "/teamLogos/default.png";

const mapPosition = (position: TopMoversCardProps["position"]): "forward" | "defense" | "all" => {
  if (position === "d") return "defense";
  if (position === "f") return "forward";
  return "all";
};

export default function TopMoversCard({ position }: TopMoversCardProps) {
  const [lens, setLens] = useState<Lens>("team");
  const [teamMovers, setTeamMovers] = useState<{ improved: Mover[]; degraded: Mover[] }>({
    improved: [],
    degraded: []
  });
  const [skaterMovers, setSkaterMovers] = useState<{ improved: Mover[]; degraded: Mover[] }>({
    improved: [],
    degraded: []
  });
  const [teamGeneratedAt, setTeamGeneratedAt] = useState<string | null>(null);
  const [skaterGeneratedAt, setSkaterGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const skaterParams = new URLSearchParams({
      position: mapPosition(position),
      window: "3",
      limit: "60"
    });

    Promise.all([
      fetch("/api/v1/trends/team-ctpi").then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load team movers (${response.status})`);
        }
        return (await response.json()) as TeamCtpiResponse;
      }),
      fetch(`/api/v1/trends/skater-power?${skaterParams.toString()}`).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load skater movers (${response.status})`);
        }
        return (await response.json()) as SkaterPowerResponse;
      })
    ])
      .then(([teamPayload, skaterPayload]) => {
        if (!active) return;
        setTeamGeneratedAt(teamPayload.generatedAt ?? null);
        setSkaterGeneratedAt(skaterPayload.generatedAt ?? null);

        const teamDeltas = (teamPayload.teams ?? [])
          .map((teamRow) => {
            const spark = teamRow.sparkSeries ?? [];
            if (spark.length < 2) return null;
            const window = spark.slice(-5);
            if (window.length < 2) return null;
            const delta = window[window.length - 1].value - window[0].value;
            return {
              id: teamRow.team,
              name: teamRow.team,
              logo: `/teamLogos/${teamRow.team}.png`,
              delta,
              current: teamRow.ctpi_0_to_100
            } as Mover;
          })
          .filter((row): row is Mover => Boolean(row));

        setTeamMovers({
          improved: [...teamDeltas].sort((a, b) => b.delta - a.delta).slice(0, 5),
          degraded: [...teamDeltas].sort((a, b) => a.delta - b.delta).slice(0, 5)
        });

        const categories = skaterPayload.categories ?? {};
        const firstCategory = Object.values(categories)[0];
        const rankings = firstCategory?.rankings ?? [];
        const metadata = skaterPayload.playerMetadata ?? {};

        const skaterList = rankings
          .map((row) => {
            const meta = metadata[String(row.playerId)];
            return {
              id: String(row.playerId),
              name: meta?.fullName ?? `Player ${row.playerId}`,
              logo: meta?.imageUrl ?? DEFAULT_TEAM_LOGO,
              delta: Number(row.delta ?? 0),
              current: undefined
            } as Mover;
          })
          .filter((row) => Number.isFinite(row.delta));

        setSkaterMovers({
          improved: [...skaterList].sort((a, b) => b.delta - a.delta).slice(0, 5),
          degraded: [...skaterList].sort((a, b) => a.delta - b.delta).slice(0, 5)
        });
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load movers.";
        setError(message);
        setTeamMovers({ improved: [], degraded: [] });
        setSkaterMovers({ improved: [], degraded: [] });
        setTeamGeneratedAt(null);
        setSkaterGeneratedAt(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [position]);

  const activeMovers = useMemo(
    () => (lens === "team" ? teamMovers : skaterMovers),
    [lens, teamMovers, skaterMovers]
  );
  const activeGeneratedAt = lens === "team" ? teamGeneratedAt : skaterGeneratedAt;
  const isStale = useMemo(() => {
    if (!activeGeneratedAt) return false;
    const ts = new Date(activeGeneratedAt).getTime();
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts > 36 * 60 * 60 * 1000;
  }, [activeGeneratedAt]);

  return (
    <article className={styles.moversCard} aria-label="Top movers">
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Top Movers</h3>
        <div className={styles.moversToggle}>
          <button
            type="button"
            onClick={() => setLens("team")}
            className={`${styles.moversToggleBtn} ${lens === "team" ? styles.moversToggleBtnActive : ""}`}
          >
            Team
          </button>
          <button
            type="button"
            onClick={() => setLens("skater")}
            className={`${styles.moversToggleBtn} ${lens === "skater" ? styles.moversToggleBtnActive : ""}`}
          >
            Skater
          </button>
        </div>
      </header>

      {loading && <p className={styles.panelState}>Loading movers...</p>}
      {!loading && error && <p className={styles.panelState}>Error: {error}</p>}

      {!loading && !error && activeMovers.improved.length === 0 && activeMovers.degraded.length === 0 && (
        <p className={styles.panelState}>No mover data available.</p>
      )}
      {!loading && !error && isStale && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          {lens === "team" ? "Team" : "Skater"} mover feed may be stale (last update {activeGeneratedAt}).
        </p>
      )}

      {!loading && !error && (activeMovers.improved.length > 0 || activeMovers.degraded.length > 0) && (
        <div className={styles.moversWrap}>
          <TopMovers improved={activeMovers.improved} degraded={activeMovers.degraded} />
        </div>
      )}
    </article>
  );
}
