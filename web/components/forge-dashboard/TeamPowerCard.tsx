import { useEffect, useMemo, useState } from "react";

import styles from "styles/ForgeDashboard.module.scss";
import { teamsInfo } from "lib/teamsInfo";
import type { NormalizedTeamRatingRow } from "lib/dashboard/normalizers";
import { normalizeTeamRatings } from "lib/dashboard/normalizers";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";

type TeamPowerCardProps = {
  date: string;
  team: string;
  onResolvedDate?: (resolvedDate: string | null) => void;
};

type TeamPowerRow = NormalizedTeamRatingRow & {
  powerScore: number;
  overallRank: number;
};

type TeamPowerView = "top" | "bottom";

const SPECIAL_TEAM_STEP = 1.5;

const computePowerScore = (team: NormalizedTeamRatingRow): number => {
  const base = (team.offRating + team.defRating + team.paceRating) / 3;
  const ppAdj = (3 - team.ppTier) * SPECIAL_TEAM_STEP;
  const pkAdj = (3 - team.pkTier) * SPECIAL_TEAM_STEP;
  return base + ppAdj + pkAdj;
};

const formatPower = (value: number): string => value.toFixed(1);
const formatMetric = (value: number | null | undefined): string =>
  value == null || Number.isNaN(value) ? "--" : value.toFixed(1);

const formatTrend = (value: number): string => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

const getTeamLabel = (abbr: string): string => {
  const meta = teamsInfo[abbr as keyof typeof teamsInfo];
  return meta?.name ?? abbr;
};

export default function TeamPowerCard({
  date,
  team,
  onResolvedDate
}: TeamPowerCardProps) {
  const [view, setView] = useState<TeamPowerView>("top");
  const [rows, setRows] = useState<NormalizedTeamRatingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchCachedJson<unknown>(
      `/api/team-ratings?date=${encodeURIComponent(date)}`,
      { ttlMs: 60_000 }
    )
      .then((payload) => {
        if (!active) return;
        setRows(normalizeTeamRatings(payload));
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load team power.";
        setError(message);
        setRows([]);
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

    return [...filtered]
      .map((row) => ({ ...row, powerScore: computePowerScore(row) }))
      .sort((a, b) => b.powerScore - a.powerScore)
      .map((row, index) => ({
        ...row,
        overallRank: index + 1
      }));
  }, [rows, team]);
  const visibleRows = useMemo<TeamPowerRow[]>(() => {
    if (team !== "all") return rankedRows;
    if (view === "bottom") {
      return [...rankedRows].slice(-16).reverse();
    }
    return rankedRows.slice(0, 16);
  }, [rankedRows, team, view]);
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
          <div className={styles.tableWrap}>
            <table className={styles.teamTable}>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Team</th>
                  <th scope="col">Power</th>
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
                      <td title={getTeamLabel(row.teamAbbr)}>{row.teamAbbr}</td>
                      <td>{formatPower(row.powerScore)}</td>
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
