import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import styles from "styles/ForgeDashboard.module.scss";
import type {
  NormalizedCtpiTeamRow,
  NormalizedStartChartGameRow,
  NormalizedTeamRatingRow
} from "lib/dashboard/normalizers";
import {
  normalizeCtpiResponse,
  normalizeStartChartResponse,
  normalizeTeamRatings
} from "lib/dashboard/normalizers";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
import {
  buildSlateMatchupEdgeMap,
  computeCtpiDelta,
  computeTeamPowerScore
} from "lib/dashboard/teamContext";
import { getTeamMetaByAbbr } from "lib/dashboard/teamMetadata";

type TeamPowerCardProps = {
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

type TeamPowerRow = NormalizedTeamRatingRow & {
  powerScore: number;
  overallRank: number;
  ctpiScore: number | null;
  ctpiDelta: number | null;
  matchup: {
    opponentAbbr: string;
    edge: number;
  } | null;
};

type TeamPowerView = "top" | "bottom";
const MAX_TEAM_CONTEXT_SPARKS = 1;

const formatPower = (value: number): string => value.toFixed(1);
const formatMetric = (value: number | null | undefined): string =>
  value == null || Number.isNaN(value) ? "--" : value.toFixed(1);

const formatTrend = (value: number): string => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

const getTeamLabel = (abbr: string): string => {
  const meta = getTeamMetaByAbbr(abbr);
  return meta?.name ?? abbr;
};

const formatCtpi = (value: number | null | undefined): string =>
  value == null || Number.isNaN(value) ? "--" : value.toFixed(0);

const formatMatchupEdge = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

const buildSparkline = (values: number[]) => {
  if (values.length === 0) return null;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 38 - ((value - min) / range) * 30 - 2;
      return `${x},${y.toFixed(2)}`;
    })
    .join(" ");
};

export default function TeamPowerCard({
  date,
  team,
  onResolvedDate,
  onStatusChange
}: TeamPowerCardProps) {
  const [view, setView] = useState<TeamPowerView>("top");
  const [rows, setRows] = useState<NormalizedTeamRatingRow[]>([]);
  const [ctpiRows, setCtpiRows] = useState<NormalizedCtpiTeamRow[]>([]);
  const [slateGames, setSlateGames] = useState<NormalizedStartChartGameRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondaryWarnings, setSecondaryWarnings] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSecondaryWarnings([]);

    Promise.allSettled([
      fetchCachedJson<unknown>(
        `/api/team-ratings?date=${encodeURIComponent(date)}`,
        { ttlMs: 60_000 }
      ),
      fetchCachedJson<unknown>("/api/v1/trends/team-ctpi", { ttlMs: 60_000 }),
      fetchCachedJson<unknown>(
        `/api/v1/start-chart?date=${encodeURIComponent(date)}`,
        { ttlMs: 60_000 }
      )
    ])
      .then(([teamRatingsResult, ctpiResult, startChartResult]) => {
        if (!active) return;

        if (teamRatingsResult.status === "rejected") {
          const message =
            teamRatingsResult.reason instanceof Error
              ? teamRatingsResult.reason.message
              : "Failed to load team power.";
          setError(message);
          setRows([]);
          setCtpiRows([]);
          setSlateGames([]);
          return;
        }

        setRows(normalizeTeamRatings(teamRatingsResult.value));

        const warnings: string[] = [];

        if (ctpiResult.status === "fulfilled") {
          setCtpiRows(normalizeCtpiResponse(ctpiResult.value).teams);
        } else {
          setCtpiRows([]);
          warnings.push("CTPI pulse unavailable");
        }

        if (startChartResult.status === "fulfilled") {
          setSlateGames(normalizeStartChartResponse(startChartResult.value).games);
        } else {
          setSlateGames([]);
          warnings.push("Slate matchup context unavailable");
        }

        setSecondaryWarnings(warnings);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load team context.";
        setError(message);
        setRows([]);
        setCtpiRows([]);
        setSlateGames([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  const rankedRows = useMemo<TeamPowerRow[]>(() => {
    const filtered = rows.filter((row) =>
      team === "all" ? true : row.teamAbbr.toUpperCase() === team.toUpperCase()
    );
    const ctpiByTeam = new Map(
      ctpiRows.map((row) => [
        row.team.toUpperCase(),
        {
          score: row.ctpi_0_to_100,
          delta: computeCtpiDelta(row)
        }
      ])
    );
    const matchupByTeam = buildSlateMatchupEdgeMap(slateGames);

    return [...filtered]
      .map((row) => ({
        ...row,
        powerScore: computeTeamPowerScore(row),
        ctpiScore: ctpiByTeam.get(row.teamAbbr.toUpperCase())?.score ?? null,
        ctpiDelta: ctpiByTeam.get(row.teamAbbr.toUpperCase())?.delta ?? null,
        matchup: matchupByTeam.get(row.teamAbbr.toUpperCase()) ?? null
      }))
      .sort((a, b) => b.powerScore - a.powerScore)
      .map((row, index) => ({
        ...row,
        overallRank: index + 1
      }));
  }, [ctpiRows, date, rows, slateGames, team]);
  const visibleRows = useMemo<TeamPowerRow[]>(() => {
    if (team !== "all") return rankedRows;
    if (view === "bottom") {
      return [...rankedRows].slice(-16).reverse();
    }
    return rankedRows.slice(0, 16);
  }, [rankedRows, team, view]);
  const spotlightRows = useMemo(() => visibleRows.slice(0, Math.min(4, visibleRows.length)), [visibleRows]);
  const allTrendsFlat = useMemo(
    () => rankedRows.length > 0 && rankedRows.every((row) => Math.abs(row.trend10) < 0.01),
    [rankedRows]
  );
  const resolvedDate = rows[0]?.date ?? null;
  const isStale = Boolean(resolvedDate && resolvedDate !== date);
  const metaDate = resolvedDate ?? date;

  useEffect(() => {
    onResolvedDate?.(resolvedDate);
  }, [onResolvedDate, resolvedDate]);

  useEffect(() => {
    onStatusChange?.({
      loading,
      error,
      staleMessage:
        !loading && !error && isStale && resolvedDate
          ? `Team context using ${resolvedDate}`
          : null,
      empty: !loading && !error && rankedRows.length === 0
    });
  }, [error, isStale, loading, onStatusChange, rankedRows.length, resolvedDate]);

  return (
    <article className={styles.teamPowerCard} aria-label="Team power rankings">
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Team Power Rankings</h3>
        <span className={styles.panelMeta}>Snapshot {metaDate}</span>
      </header>

      {loading && <p className={styles.panelState}>Loading team power...</p>}
      {!loading && error && <p className={styles.panelState}>Error: {error}</p>}

      {!loading && !error && rankedRows.length === 0 && (
        <p className={styles.panelState}>No team power data for this date.</p>
      )}

      {!loading && !error && rankedRows.length > 0 && (
        <>
          {isStale && (
            <p className={`${styles.panelState} ${styles.panelStateStale}`}>
              Showing nearest available snapshot ({resolvedDate}).
            </p>
          )}
          {allTrendsFlat && (
            <p className={`${styles.panelState} ${styles.panelStateStale}`}>
              Trend feed is currently flat in the source snapshot; all teams are reporting 0.0.
            </p>
          )}
          {secondaryWarnings.length > 0 && (
            <p className={`${styles.panelState} ${styles.panelStateStale}`}>
              {secondaryWarnings.join(" • ")}
            </p>
          )}
          {team === "all" && rankedRows.length > 16 && (
            <div className={styles.teamPowerControls}>
              <div className={styles.segmentedToggle} aria-label="Team power ranking range">
                <button
                  type="button"
                  className={`${styles.segmentedToggleBtn} ${
                    view === "top" ? styles.segmentedToggleBtnActive : ""
                  }`}
                  onClick={() => setView("top")}
                >
                  Top 16
                </button>
                <button
                  type="button"
                  className={`${styles.segmentedToggleBtn} ${
                    view === "bottom" ? styles.segmentedToggleBtnActive : ""
                  }`}
                  onClick={() => setView("bottom")}
                >
                  Bottom 16
                </button>
              </div>
              <span className={styles.teamPowerControlMeta}>
                {view === "top" ? "Highest-rated teams" : "Lowest-rated teams"}
              </span>
            </div>
          )}
          {spotlightRows.length > 0 && (
            <div className={styles.teamContextSpotlightGrid}>
              <p className={styles.compactChartNote}>
                Compact CTPI traces stay on the lead spotlight card only.
              </p>
              {spotlightRows.map((row, index) => {
                const sparkPoints = buildSparkline(
                  ctpiRows
                    .find((candidate) => candidate.team.toUpperCase() === row.teamAbbr.toUpperCase())
                    ?.sparkSeries.map((point) => point.value) ?? []
                );
                const matchupClass =
                  row.matchup == null
                    ? styles.trendFlat
                    : row.matchup.edge > 1
                      ? styles.trendUp
                      : row.matchup.edge < -1
                        ? styles.trendDown
                        : styles.trendFlat;

                return (
                  <Link
                    key={`spotlight-${row.teamAbbr}`}
                    href={`/forge/team/${row.teamAbbr}`}
                    className={styles.teamContextSpotlightCard}
                  >
                    <div className={styles.teamContextSpotlightHeader}>
                      <div className={styles.teamContextSpotlightIdentity}>
                        <img
                          src={`/teamLogos/${row.teamAbbr}.png`}
                          alt=""
                          className={styles.teamContextSpotlightLogo}
                        />
                        <div>
                          <strong>{row.teamAbbr}</strong>
                          <span>{getTeamLabel(row.teamAbbr)}</span>
                        </div>
                      </div>
                      <span className={styles.teamContextSpotlightRank}>
                        #{row.overallRank}
                      </span>
                    </div>
                    <div className={styles.teamContextSpotlightStats}>
                      <span>Power {formatPower(row.powerScore)}</span>
                      <span>CTPI {formatCtpi(row.ctpiScore)}</span>
                      <span>
                        Matchup{" "}
                        <strong className={`${styles.trendChip} ${matchupClass}`}>
                          {row.matchup ? `${row.matchup.opponentAbbr} ${formatMatchupEdge(row.matchup.edge)}` : "Off slate"}
                        </strong>
                      </span>
                      <span>
                        Variance{" "}
                        <strong>{row.varianceFlag === 1 ? "High" : "Stable"}</strong>
                      </span>
                    </div>
                    <div className={styles.teamContextSpotlightFooter}>
                      <span>
                        Momentum {row.ctpiDelta == null ? "--" : formatTrend(row.ctpiDelta)}
                      </span>
                      {index < MAX_TEAM_CONTEXT_SPARKS && sparkPoints ? (
                        <svg
                          className={styles.sparkSvg}
                          viewBox="0 0 100 40"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <polyline
                            className={`${styles.sparkPath} ${
                              (row.ctpiDelta ?? 0) >= 0 ? styles.sparkRise : styles.sparkFall
                            }`}
                            points={sparkPoints}
                          />
                        </svg>
                      ) : (
                        <span className={styles.compactChartNote}>Text-first card</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.teamTable}>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Team</th>
                  <th scope="col">Power</th>
                  <th scope="col">CTPI</th>
                  <th scope="col">Matchup</th>
                  <th scope="col">Off</th>
                  <th scope="col">Def</th>
                  <th scope="col">Pace</th>
                  <th scope="col">Trend</th>
                  <th scope="col">Finish</th>
                  <th scope="col">Goalie</th>
                  <th scope="col">Var</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const trendClass =
                    row.trend10 > 0.5
                      ? styles.trendUp
                      : row.trend10 < -0.5
                        ? styles.trendDown
                        : styles.trendFlat;

                  return (
                    <tr key={`${row.teamAbbr}-${row.overallRank}`}>
                      <td>{row.overallRank}</td>
                      <td title={getTeamLabel(row.teamAbbr)}>
                        <Link
                          href={`/forge/team/${row.teamAbbr}`}
                          className={styles.teamTableLink}
                        >
                          {row.teamAbbr}
                        </Link>
                      </td>
                      <td>{formatPower(row.powerScore)}</td>
                      <td>{formatCtpi(row.ctpiScore)}</td>
                      <td>
                        {row.matchup ? (
                          <span
                            className={`${styles.trendChip} ${
                              row.matchup.edge > 1
                                ? styles.trendUp
                                : row.matchup.edge < -1
                                  ? styles.trendDown
                                  : styles.trendFlat
                            }`}
                          >
                            {row.matchup.opponentAbbr} {formatMatchupEdge(row.matchup.edge)}
                          </span>
                        ) : (
                          <span className={`${styles.trendChip} ${styles.trendFlat}`}>
                            Off
                          </span>
                        )}
                      </td>
                      <td>{formatMetric(row.offRating)}</td>
                      <td>{formatMetric(row.defRating)}</td>
                      <td>{formatMetric(row.paceRating)}</td>
                      <td>
                        <span className={`${styles.trendChip} ${trendClass}`}>
                          {formatTrend(row.trend10)}
                        </span>
                      </td>
                      <td>{formatMetric(row.finishingRating)}</td>
                      <td>{formatMetric(row.goalieRating)}</td>
                      <td>{row.varianceFlag === 1 ? "High" : "Stable"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </article>
  );
}
