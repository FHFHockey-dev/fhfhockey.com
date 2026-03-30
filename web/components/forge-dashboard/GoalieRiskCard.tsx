import { useEffect, useMemo, useState } from "react";

import styles from "styles/ForgeDashboard.module.scss";
import type { NormalizedGoalieProjectionRow } from "lib/dashboard/normalizers";
import { normalizeGoalieResponse } from "lib/dashboard/normalizers";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";

type GoalieRiskCardProps = {
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

const formatPercent = (value: number | null | undefined, digits = 0): string => {
  if (value == null || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
};

const formatSignedPercent = (value: number | null | undefined, digits = 1): string => {
  if (value == null || Number.isNaN(value)) return "--";
  const scaled = value * 100;
  const sign = scaled > 0 ? "+" : "";
  return `${sign}${scaled.toFixed(digits)}%`;
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

const getConfidenceClass = (tier: string | null | undefined) => {
  const normalized = (tier ?? "").toUpperCase();
  if (normalized === "HIGH") return styles.susBadgeStable;
  if (normalized === "LOW") return styles.susBadgeRisk;
  return styles.susBadge;
};

const getVolatilityLabel = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "Unknown";
  if (value <= 0.95) return "Stable";
  if (value <= 1.2) return "Moderate";
  return "Volatile";
};

const getRiskLabel = (value: number | null | undefined) => {
  const tone = riskTone(value);
  if (tone === "low") return "Low risk";
  if (tone === "high") return "High risk";
  return "Watch risk";
};

const buildConfidenceDrivers = (row: NormalizedGoalieProjectionRow): string[] => {
  const drivers: string[] = [];
  const selection = row.starter_selection;

  if (selection?.days_since_last_played != null) {
    drivers.push(`Recency ${selection.days_since_last_played}d`);
  }
  if (selection?.l10_starts != null) {
    drivers.push(`L10 starts ${selection.l10_starts}/10`);
  }
  if (selection?.is_back_to_back != null) {
    drivers.push(selection.is_back_to_back ? "Back-to-back pressure" : "Rest edge");
  }
  if (selection?.opponent_is_weak != null) {
    drivers.push(selection.opponent_is_weak ? "Soft opponent" : "Opponent pushback");
  }
  if (selection?.opponent_context_adjustment_pct != null) {
    drivers.push(
      `Opp ctx ${formatSignedPercent(selection.opponent_context_adjustment_pct)}`
    );
  }

  return drivers.slice(0, 3);
};

export default function GoalieRiskCard({
  date,
  team,
  onResolvedDate,
  onStatusChange
}: GoalieRiskCardProps) {
  const [rows, setRows] = useState<NormalizedGoalieProjectionRow[]>([]);
  const [asOfDate, setAsOfDate] = useState<string | null>(null);
  const [servingMessage, setServingMessage] = useState<string | null>(null);
  const [servingSeverity, setServingSeverity] = useState<"none" | "warn" | "error">("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const query = new URLSearchParams({ date, horizon: "1" });

    fetchCachedJson<unknown>(`/api/v1/forge/goalies?${query.toString()}`, {
      ttlMs: 60_000
    })
      .then((payload) => normalizeGoalieResponse(payload))
      .then((payload) => {
        if (!active) return;
        setRows(payload.data);
        setAsOfDate(payload.asOfDate);
        setServingMessage(payload.serving?.message ?? null);
        setServingSeverity(payload.serving?.severity ?? "none");
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load goalie risk.";
        setError(message);
        setRows([]);
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

  const displayRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (team === "all") return true;
      const abbr = (row.team_abbreviation ?? "").toUpperCase();
      return abbr === team.toUpperCase();
    });

    return filtered.sort((a, b) => (b.starter_probability ?? 0) - (a.starter_probability ?? 0));
  }, [rows, team]);

  const spotlightRows = useMemo(() => displayRows.slice(0, 2), [displayRows]);
  const tableRows = useMemo(() => displayRows.slice(0, 8), [displayRows]);

  useEffect(() => {
    onResolvedDate?.(asOfDate);
  }, [asOfDate, onResolvedDate]);

  useEffect(() => {
    onStatusChange?.({
      loading,
      error,
      staleMessage:
        !loading && !error
          ? servingMessage ??
            (asOfDate && asOfDate !== date ? `Goalies using ${asOfDate}` : null)
          : null,
      empty: !loading && !error && tableRows.length === 0
    });
  }, [asOfDate, date, error, loading, onStatusChange, servingMessage, tableRows.length]);

  return (
    <article className={styles.goalieRiskCard} aria-label="Goalie start and risk projections">
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Goalie Start + Risk</h3>
        <span className={styles.panelMeta}>As of {asOfDate ?? date}</span>
      </header>

      {loading && <p className={styles.panelState}>Loading goalie projections...</p>}
      {!loading && error && <p className={styles.panelState}>Error: {error}</p>}

      {!loading && !error && tableRows.length === 0 && (
        <p className={styles.panelState}>No goalie projections for this filter/date.</p>
      )}
      {!loading && !error && asOfDate && asOfDate !== date && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          {servingMessage
            ? servingSeverity === "error"
              ? `${servingMessage}`
              : servingMessage
            : `Showing nearest available projection date (${asOfDate}).`}
        </p>
      )}

      {!loading && !error && tableRows.length > 0 && (
        <>
          <div className={styles.insightLegend} aria-label="Goalie risk guide">
            <div className={styles.insightLegendItem}>
              <span className={`${styles.susBadge} ${styles.susBadgeStable}`}>Starter trust</span>
              <span className={styles.insightLegendText}>
                Lead cards combine starter probability, matchup context, volatility, and model recommendation.
              </span>
            </div>
          </div>

          {spotlightRows.length > 0 && (
            <div className={styles.goalieSpotlightGrid}>
              {spotlightRows.map((row) => {
                const drivers = buildConfidenceDrivers(row);
                const risk = riskTone(row.blowup_risk);
                return (
                  <article key={`goalie-spotlight-${row.goalie_id}`} className={styles.goalieSpotlightCard}>
                    <div className={styles.goalieSpotlightHeader}>
                      <div>
                        <p className={styles.hotColdName}>{row.goalie_name}</p>
                        <p className={styles.hotColdReason}>
                          {(row.team_abbreviation ?? row.team_name) || "--"} vs{" "}
                          {(row.opponent_team_abbreviation ?? row.opponent_team_name) || "--"}
                        </p>
                      </div>
                      <span
                        className={`${styles.trendChip} ${
                          risk === "low"
                            ? styles.trendUp
                            : risk === "high"
                              ? styles.trendDown
                              : styles.trendFlat
                        }`}
                      >
                        {getRiskLabel(row.blowup_risk)}
                      </span>
                    </div>

                    <div className={styles.susBadgeRow}>
                      <span className={`${styles.susBadge} ${getConfidenceClass(row.confidence_tier)}`}>
                        Confidence {row.confidence_tier ?? "--"}
                      </span>
                      <span className={styles.susBadge}>Vol {getVolatilityLabel(row.volatility_index)}</span>
                      <span className={styles.susBadge}>
                        Call {row.recommendation ?? "--"}
                      </span>
                    </div>

                    <div className={styles.goalieSpotlightMetrics}>
                      <span>Starter <strong>{formatPercent(row.starter_probability)}</strong></span>
                      <span>Win <strong>{formatPercent(row.proj_win_prob)}</strong></span>
                      <span>SO <strong>{formatPercent(row.proj_shutout_prob, 1)}</strong></span>
                      <span>Sv% <strong>{formatPercent(row.modeled_save_pct, 1)}</strong></span>
                    </div>

                    {drivers.length > 0 && (
                      <div className={styles.goalieDriverList}>
                        {drivers.map((driver) => (
                          <span key={`${row.goalie_id}-${driver}`} className={styles.susBadge}>
                            {driver}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.teamTable}>
              <thead>
                <tr>
                  <th scope="col">Goalie</th>
                  <th scope="col">Matchup</th>
                  <th scope="col">Start</th>
                  <th scope="col">Win</th>
                  <th scope="col">SO</th>
                  <th scope="col">Vol</th>
                  <th scope="col">Risk</th>
                  <th scope="col">Call</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => {
                  const tone = riskTone(row.blowup_risk);
                  return (
                    <tr key={row.goalie_id}>
                      <td title={`${row.team_abbreviation ?? row.team_name} vs ${row.opponent_team_abbreviation ?? row.opponent_team_name}`}>
                        {row.goalie_name}
                      </td>
                      <td>{row.opponent_team_abbreviation ?? row.opponent_team_name ?? "--"}</td>
                      <td>{formatPercent(row.starter_probability)}</td>
                      <td>{formatPercent(row.proj_win_prob)}</td>
                      <td>{formatPercent(row.proj_shutout_prob, 1)}</td>
                      <td>{getVolatilityLabel(row.volatility_index)}</td>
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
                      <td>{row.recommendation ?? "--"}</td>
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
