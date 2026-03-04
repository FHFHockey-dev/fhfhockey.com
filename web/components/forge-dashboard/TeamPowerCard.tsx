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
};

const SPECIAL_TEAM_STEP = 1.5;

const computePowerScore = (team: NormalizedTeamRatingRow): number => {
  const base = (team.offRating + team.defRating + team.paceRating) / 3;
  const ppAdj = (3 - team.ppTier) * SPECIAL_TEAM_STEP;
  const pkAdj = (3 - team.pkTier) * SPECIAL_TEAM_STEP;
  return base + ppAdj + pkAdj;
};

const formatPower = (value: number): string => value.toFixed(1);

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
      .slice(0, 8);
  }, [rows, team]);
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
          <div className={styles.tableWrap}>
            <table className={styles.teamTable}>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Team</th>
                  <th scope="col">Power</th>
                  <th scope="col">Trend</th>
                </tr>
              </thead>
              <tbody>
                {rankedRows.map((row, index) => {
                  const trendClass =
                    row.trend10 > 0.5
                      ? styles.trendUp
                      : row.trend10 < -0.5
                        ? styles.trendDown
                        : styles.trendFlat;

                  return (
                    <tr key={`${row.teamAbbr}-${index}`}>
                      <td>{index + 1}</td>
                      <td title={getTeamLabel(row.teamAbbr)}>{row.teamAbbr}</td>
                      <td>{formatPower(row.powerScore)}</td>
                      <td>
                        <span className={`${styles.trendChip} ${trendClass}`}>
                          {formatTrend(row.trend10)}
                        </span>
                      </td>
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
