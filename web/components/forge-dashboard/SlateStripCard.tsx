import { useEffect, useMemo, useState } from "react";

import styles from "styles/ForgeDashboard.module.scss";
import { teamsInfo } from "lib/teamsInfo";

type GoalieInfo = {
  player_id: number;
  name: string;
  start_probability: number | null;
};

type GameRow = {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeGoalies?: GoalieInfo[];
  awayGoalies?: GoalieInfo[];
};

type StartChartResponse = {
  dateUsed: string;
  games: GameRow[];
};

type SlateStripCardProps = {
  date: string;
  team: string;
};

const findTeamById = (id: number) =>
  Object.values(teamsInfo).find((team) => team.id === id);

const formatPct = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(0)}%`;
};

function GoalieBar({ goalies }: { goalies?: GoalieInfo[] }) {
  if (!goalies || goalies.length === 0) {
    return <span className={styles.slateGoalieEmpty}>No goalie probabilities</span>;
  }

  const top = goalies[0];
  const prob = Math.max(0, Math.min(1, top.start_probability ?? 0));

  return (
    <div className={styles.slateGoalieBlock}>
      <div className={styles.slateGoalieText}>
        <span>{top.name}</span>
        <span>{formatPct(top.start_probability)}</span>
      </div>
      <div className={styles.slateGoalieTrack}>
        <div className={styles.slateGoalieFill} style={{ width: `${prob * 100}%` }} />
      </div>
    </div>
  );
}

export default function SlateStripCard({ date, team }: SlateStripCardProps) {
  const [games, setGames] = useState<GameRow[]>([]);
  const [dateUsed, setDateUsed] = useState<string>(date);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/v1/start-chart?date=${encodeURIComponent(date)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load slate strip (${response.status})`);
        }
        return (await response.json()) as StartChartResponse;
      })
      .then((payload) => {
        if (!active) return;
        setGames(payload.games ?? []);
        setDateUsed(payload.dateUsed ?? date);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load slate strip.";
        setError(message);
        setGames([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  const displayGames = useMemo(() => {
    return games
      .filter((game) => {
        if (team === "all") return true;
        const home = findTeamById(game.homeTeamId)?.abbrev ?? "";
        const away = findTeamById(game.awayTeamId)?.abbrev ?? "";
        const target = team.toUpperCase();
        return home === target || away === target;
      })
      .slice(0, 8);
  }, [games, team]);

  return (
    <article className={styles.slateStripCard} aria-label="Start-chart slate strip">
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Tonight&apos;s Slate</h3>
        <span className={styles.panelMeta}>{dateUsed}</span>
      </header>

      {loading && <p className={styles.panelState}>Loading game slate...</p>}
      {!loading && error && <p className={styles.panelState}>Error: {error}</p>}

      {!loading && !error && displayGames.length === 0 && (
        <p className={styles.panelState}>No games match this filter/date.</p>
      )}
      {!loading && !error && dateUsed && dateUsed !== date && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          Showing nearest available slate date ({dateUsed}).
        </p>
      )}

      {!loading && !error && displayGames.length > 0 && (
        <div className={styles.slateList}>
          {displayGames.map((game) => {
            const away = findTeamById(game.awayTeamId);
            const home = findTeamById(game.homeTeamId);
            return (
              <div key={game.id} className={styles.slateRow}>
                <div className={styles.slateTeams}>
                  <span>{away?.abbrev ?? "AWY"}</span>
                  <span className={styles.slateVs}>@</span>
                  <span>{home?.abbrev ?? "HME"}</span>
                </div>

                <div className={styles.slateGoalies}>
                  <GoalieBar goalies={game.awayGoalies} />
                  <GoalieBar goalies={game.homeGoalies} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
