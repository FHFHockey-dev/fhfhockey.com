import { useEffect, useMemo, useState, type CSSProperties } from "react";

import styles from "styles/ForgeDashboard.module.scss";
import { teamsInfo } from "lib/teamsInfo";
import { normalizeStartChartResponse } from "lib/dashboard/normalizers";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";

type GoalieInfo = { player_id: number; name: string; start_probability: number | null };
type GameRow = {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeGoalies: GoalieInfo[];
  awayGoalies: GoalieInfo[];
};

type SlateStripCardProps = {
  date: string;
  team: string;
  onResolvedDate?: (resolvedDate: string | null) => void;
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

export default function SlateStripCard({
  date,
  team,
  onResolvedDate
}: SlateStripCardProps) {
  const [games, setGames] = useState<GameRow[]>([]);
  const [dateUsed, setDateUsed] = useState<string>(date);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchCachedJson<unknown>(`/api/v1/start-chart?date=${encodeURIComponent(date)}`, {
      ttlMs: 60_000
    })
      .then((payload) => normalizeStartChartResponse(payload))
      .then((payload) => {
        if (!active) return;
        setGames(payload.games);
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

  useEffect(() => {
    onResolvedDate?.(dateUsed);
  }, [dateUsed, onResolvedDate]);

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
        <div className={styles.slateRail}>
          {displayGames.map((game) => {
            const away = findTeamById(game.awayTeamId);
            const home = findTeamById(game.homeTeamId);
            return (
              <article
                key={game.id}
                className={styles.slateRailCard}
                style={
                  {
                    "--away-color": away?.primaryColor ?? "#1f2937",
                    "--home-color": home?.primaryColor ?? "#0f172a"
                  } as CSSProperties
                }
              >
                <div className={styles.slateRailTeams}>
                  <div className={styles.slateRailTeam}>
                    {away?.abbrev && (
                      <img
                        src={`/teamLogos/${away.abbrev}.png`}
                        alt={away.abbrev}
                        className={styles.slateRailLogo}
                      />
                    )}
                    <span>{away?.abbrev ?? "AWY"}</span>
                  </div>
                  <span className={styles.slateVs}>@</span>
                  <div className={styles.slateRailTeam}>
                    {home?.abbrev && (
                      <img
                        src={`/teamLogos/${home.abbrev}.png`}
                        alt={home.abbrev}
                        className={styles.slateRailLogo}
                      />
                    )}
                    <span>{home?.abbrev ?? "HME"}</span>
                  </div>
                </div>

                <div className={styles.slateRailMeta}>
                  <GoalieBar goalies={game.awayGoalies} />
                  <GoalieBar goalies={game.homeGoalies} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </article>
  );
}
