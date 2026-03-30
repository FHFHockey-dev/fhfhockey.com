import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  normalizeStartChartResponse,
  type NormalizedStartChartGameRow
} from "lib/dashboard/normalizers";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
import { getGamePowerEdge } from "lib/dashboard/teamContext";
import { getTeamMetaById } from "lib/dashboard/teamMetadata";
import styles from "styles/ForgeDashboard.module.scss";

type GoalieInfo = NormalizedStartChartGameRow["homeGoalies"][number];
type GameRow = NormalizedStartChartGameRow;

type SlateStripCardProps = {
  date: string;
  team: string;
  onResolvedDate?: (resolvedDate: string | null) => void;
  onStatusChange?: (status: {
    loading: boolean;
    error: string | null;
    staleMessage: string | null;
    empty: boolean;
  }) => void;
};

const formatPct = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(0)}%`;
};

const formatRating = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(0);
};

const formatSigned = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

const formatGsaa = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
};

const formatPowerEdge = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

function GoalieBar({
  goalies,
  emphasis = "compact"
}: {
  goalies?: GoalieInfo[];
  emphasis?: "compact" | "hero";
}) {
  if (!goalies || goalies.length === 0) {
    return <span className={styles.slateGoalieEmpty}>No goalie probabilities</span>;
  }

  const top = goalies[0];
  const prob = Math.max(0, Math.min(1, top.start_probability ?? 0));

  return (
    <div
      className={
        emphasis === "hero"
          ? styles.slateGoalieHeroBlock
          : styles.slateGoalieBlock
      }
    >
      <div className={styles.slateGoalieText}>
        <span>{top.name}</span>
        <span>{formatPct(top.start_probability)}</span>
      </div>
      <div className={styles.slateGoalieTrack}>
        <div className={styles.slateGoalieFill} style={{ width: `${prob * 100}%` }} />
      </div>
      {emphasis === "hero" && (
        <div className={styles.slateGoalieHeroMeta}>
          <span>
            GSAA/60 <strong>{formatGsaa(top.projected_gsaa_per_60)}</strong>
          </span>
          <span>
            Own{" "}
            <strong>
              {top.percent_ownership == null
                ? "--"
                : `${top.percent_ownership.toFixed(0)}%`}
            </strong>
          </span>
          <span>{top.confirmed_status ? "Confirmed" : "Projected"}</span>
        </div>
      )}
    </div>
  );
}

function TeamSnapshot({
  teamAbbr,
  side,
  rating
}: {
  teamAbbr: string | null | undefined;
  side: "away" | "home";
  rating: GameRow["homeRating"];
}) {
  return (
    <div className={styles.slateTeamSnapshot}>
      <div className={styles.slateTeamHeader}>
        {teamAbbr && (
          <img
            src={`/teamLogos/${teamAbbr}.png`}
            alt={teamAbbr}
            className={styles.slateFocusLogo}
          />
        )}
        <div className={styles.slateTeamLabel}>
          <span className={styles.slateFocusSide}>
            {side === "away" ? "Away" : "Home"}
          </span>
          <strong>{teamAbbr ?? "--"}</strong>
        </div>
      </div>
      <div className={styles.slateRatingGrid}>
        <span>OFF {formatRating(rating?.offRating)}</span>
        <span>DEF {formatRating(rating?.defRating)}</span>
        <span>PACE {formatRating(rating?.paceRating)}</span>
        <span>TREND {formatSigned(rating?.trend10)}</span>
      </div>
    </div>
  );
}

export default function SlateStripCard({
  date,
  team,
  onResolvedDate,
  onStatusChange
}: SlateStripCardProps) {
  const [games, setGames] = useState<GameRow[]>([]);
  const [dateUsed, setDateUsed] = useState<string>(date);
  const [servingMessage, setServingMessage] = useState<string | null>(null);
  const [servingSeverity, setServingSeverity] = useState<"none" | "warn" | "error">("none");
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchCachedJson<unknown>(
      `/api/v1/start-chart?date=${encodeURIComponent(date)}`,
      {
        ttlMs: 60_000
      }
    )
      .then((payload) => normalizeStartChartResponse(payload))
      .then((payload) => {
        if (!active) return;
        setGames(payload.games);
        setDateUsed(payload.dateUsed ?? date);
        setServingMessage(payload.serving?.message ?? null);
        setServingSeverity(payload.serving?.severity ?? "none");
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load slate strip.";
        setError(message);
        setGames([]);
        setServingMessage(null);
        setServingSeverity("none");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  const filteredGames = useMemo(
    () =>
      games
        .filter((game) => {
          if (team === "all") return true;
          const home = getTeamMetaById(game.homeTeamId)?.abbr ?? "";
          const away = getTeamMetaById(game.awayTeamId)?.abbr ?? "";
          const target = team.toUpperCase();
          return home === target || away === target;
        }),
    [games, team]
  );

  const displayGames = useMemo(
    () => filteredGames.slice(0, 8),
    [filteredGames]
  );

  useEffect(() => {
    if (displayGames.length === 0) {
      setSelectedGameId(null);
      return;
    }

    setSelectedGameId((current) => {
      if (current && displayGames.some((game) => game.id === current)) {
        return current;
      }
      return displayGames[0]?.id ?? null;
    });
  }, [displayGames]);

  const selectedGame = useMemo(() => {
    if (displayGames.length === 0) return null;
    return (
      displayGames.find((game) => game.id === selectedGameId) ?? displayGames[0]
    );
  }, [displayGames, selectedGameId]);

  useEffect(() => {
    onResolvedDate?.(dateUsed);
  }, [dateUsed, onResolvedDate]);

  useEffect(() => {
    onStatusChange?.({
      loading,
      error,
      staleMessage:
        !loading && !error
          ? servingMessage ??
            (dateUsed && dateUsed !== date ? `Slate using ${dateUsed}` : null)
          : null,
      empty: !loading && !error && filteredGames.length === 0
    });
  }, [date, dateUsed, error, filteredGames.length, loading, onStatusChange, servingMessage]);

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
          {servingMessage
            ? servingSeverity === "error"
              ? servingMessage
              : servingMessage
            : `Showing nearest available slate date (${dateUsed}).`}
        </p>
      )}

      {!loading && !error && displayGames.length > 0 && selectedGame && (
        <>
          <div className={styles.slateHeroSummary}>
            <div className={styles.slateSummaryChip}>
              <span className={styles.slateSummaryLabel}>
                {filteredGames.length > displayGames.length ? "Visible games" : "Games"}
              </span>
              <strong>
                {filteredGames.length > displayGames.length
                  ? `${displayGames.length} of ${filteredGames.length}`
                  : displayGames.length}
              </strong>
            </div>
            <div className={styles.slateSummaryChip}>
              <span className={styles.slateSummaryLabel}>Focus</span>
              <strong>
                {(getTeamMetaById(selectedGame.awayTeamId)?.abbr ?? "AWY")} @{" "}
                {(getTeamMetaById(selectedGame.homeTeamId)?.abbr ?? "HME")}
              </strong>
            </div>
            <div className={styles.slateSummaryChip}>
              <span className={styles.slateSummaryLabel}>Mode</span>
              <strong>
                {team === "all"
                  ? filteredGames.length > displayGames.length
                    ? "Focused subset"
                    : "Full slate"
                  : `${team} filtered`}
              </strong>
            </div>
            <div className={styles.slateSummaryChip}>
              <span className={styles.slateSummaryLabel}>Power Edge</span>
              <strong>{formatPowerEdge(getGamePowerEdge(selectedGame))}</strong>
            </div>
            <div className={styles.slateSummaryLinks}>
              <Link
                href={`/start-chart?date=${dateUsed}`}
                className={styles.slateActionLink}
              >
                Open Start Chart
              </Link>
            </div>
          </div>

          <div className={styles.slateHeroFocus}>
            <div className={styles.slateHeroTeams}>
              <TeamSnapshot
                side="away"
                teamAbbr={getTeamMetaById(selectedGame.awayTeamId)?.abbr}
                rating={selectedGame.awayRating}
              />
              <div className={styles.slateHeroVersus}>
                <span className={styles.slateHeroEyebrow}>Focused Matchup</span>
                <strong>
                  {(getTeamMetaById(selectedGame.awayTeamId)?.abbr ?? "AWY")} @{" "}
                  {(getTeamMetaById(selectedGame.homeTeamId)?.abbr ?? "HME")}
                </strong>
                <span className={styles.slateHeroSubcopy}>
                  Starter confidence and team-power context stay visible in one
                  slate-first panel.
                </span>
                <span className={styles.slateHeroSubcopy}>
                  Home-side edge: <strong>{formatPowerEdge(getGamePowerEdge(selectedGame))}</strong>
                </span>
              </div>
              <TeamSnapshot
                side="home"
                teamAbbr={getTeamMetaById(selectedGame.homeTeamId)?.abbr}
                rating={selectedGame.homeRating}
              />
            </div>

            <div className={styles.slateHeroGoalies}>
              <div className={styles.slateGoalieColumn}>
                <span className={styles.slateGoalieColumnLabel}>
                  {(getTeamMetaById(selectedGame.awayTeamId)?.abbr ?? "AWY")} starter
                  lane
                </span>
                <GoalieBar goalies={selectedGame.awayGoalies} emphasis="hero" />
              </div>
              <div className={styles.slateGoalieColumn}>
                <span className={styles.slateGoalieColumnLabel}>
                  {(getTeamMetaById(selectedGame.homeTeamId)?.abbr ?? "HME")} starter
                  lane
                </span>
                <GoalieBar goalies={selectedGame.homeGoalies} emphasis="hero" />
              </div>
            </div>
          </div>

          <div className={styles.slateRail}>
            {displayGames.map((game) => {
              const away = getTeamMetaById(game.awayTeamId);
              const home = getTeamMetaById(game.homeTeamId);
              const isActive = game.id === selectedGame.id;

              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => setSelectedGameId(game.id)}
                  className={`${styles.slateRailCard} ${isActive ? styles.slateRailCardActive : ""}`}
                  aria-pressed={isActive}
                  aria-label={`Focus ${away?.abbr ?? "AWY"} at ${home?.abbr ?? "HME"}`}
                  style={
                    {
                      "--away-color": away?.colors.primary ?? "#1f2937",
                      "--home-color": home?.colors.primary ?? "#0f172a"
                    } as CSSProperties
                  }
                >
                  <div className={styles.slateRailTeams}>
                    <div className={styles.slateRailTeam}>
                      {away?.abbr && (
                        <img
                          src={away.logo}
                          alt={away.abbr}
                          className={styles.slateRailLogo}
                        />
                      )}
                      <span>{away?.abbr ?? "AWY"}</span>
                    </div>
                    <span className={styles.slateVs}>@</span>
                    <div className={styles.slateRailTeam}>
                      {home?.abbr && (
                        <img
                          src={home.logo}
                          alt={home.abbr}
                          className={styles.slateRailLogo}
                        />
                      )}
                      <span>{home?.abbr ?? "HME"}</span>
                    </div>
                  </div>

                  <div className={styles.slateRailMeta}>
                    <GoalieBar goalies={game.awayGoalies} />
                    <GoalieBar goalies={game.homeGoalies} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}
