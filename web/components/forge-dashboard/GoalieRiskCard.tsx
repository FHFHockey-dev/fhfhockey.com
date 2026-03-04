import { useEffect, useMemo, useState } from "react";

import styles from "styles/ForgeDashboard.module.scss";

type GoalieProjection = {
  goalie_id: number;
  goalie_name: string;
  team_abbreviation: string | null;
  team_name: string;
  opponent_team_abbreviation: string | null;
  opponent_team_name: string;
  starter_probability: number | null;
  proj_win_prob: number | null;
  proj_shutout_prob: number | null;
  volatility_index: number | null;
  blowup_risk: number | null;
  recommendation: string | null;
};

type GoalieResponse = {
  asOfDate?: string;
  data: GoalieProjection[];
};

type GoalieRiskCardProps = {
  date: string;
  team: string;
};

const formatPercent = (value: number | null | undefined, digits = 0): string => {
  if (value == null || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(2);
};

const riskTone = (risk: number | null | undefined): "low" | "med" | "high" => {
  if (risk == null || Number.isNaN(risk)) return "med";
  if (risk < 0.28) return "low";
  if (risk < 0.44) return "med";
  return "high";
};

export default function GoalieRiskCard({ date, team }: GoalieRiskCardProps) {
  const [rows, setRows] = useState<GoalieProjection[]>([]);
  const [asOfDate, setAsOfDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const query = new URLSearchParams({ date, horizon: "1" });

    fetch(`/api/v1/forge/goalies?${query.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load goalie risk (${response.status})`);
        }
        return (await response.json()) as GoalieResponse;
      })
      .then((payload) => {
        if (!active) return;
        setRows(payload.data ?? []);
        setAsOfDate(payload.asOfDate ?? null);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load goalie risk.";
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

  const displayRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (team === "all") return true;
      const abbr = (row.team_abbreviation ?? "").toUpperCase();
      return abbr === team.toUpperCase();
    });

    return filtered
      .sort((a, b) => (b.starter_probability ?? 0) - (a.starter_probability ?? 0))
      .slice(0, 8);
  }, [rows, team]);

  return (
    <article className={styles.goalieRiskCard} aria-label="Goalie start and risk projections">
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Goalie Start + Risk</h3>
        <span className={styles.panelMeta}>As of {asOfDate ?? date}</span>
      </header>

      {loading && <p className={styles.panelState}>Loading goalie projections...</p>}
      {!loading && error && <p className={styles.panelState}>Error: {error}</p>}

      {!loading && !error && displayRows.length === 0 && (
        <p className={styles.panelState}>No goalie projections for this filter/date.</p>
      )}
      {!loading && !error && asOfDate && asOfDate !== date && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          Showing nearest available projection date ({asOfDate}).
        </p>
      )}

      {!loading && !error && displayRows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.teamTable}>
            <thead>
              <tr>
                <th scope="col">Goalie</th>
                <th scope="col">Start</th>
                <th scope="col">Win</th>
                <th scope="col">SO</th>
                <th scope="col">Vol</th>
                <th scope="col">Risk</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const tone = riskTone(row.blowup_risk);
                return (
                  <tr key={row.goalie_id}>
                    <td title={`${row.team_abbreviation ?? row.team_name} vs ${row.opponent_team_abbreviation ?? row.opponent_team_name}`}>
                      {row.goalie_name}
                    </td>
                    <td>{formatPercent(row.starter_probability)}</td>
                    <td>{formatPercent(row.proj_win_prob)}</td>
                    <td>{formatPercent(row.proj_shutout_prob, 1)}</td>
                    <td>{formatNumber(row.volatility_index)}</td>
                    <td>
                      <span
                        className={`${styles.trendChip} ${
                          tone === "low"
                            ? styles.trendUp
                            : tone === "high"
                              ? styles.trendDown
                              : styles.trendFlat
                        }`}
                      >
                        {formatPercent(row.blowup_risk)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
