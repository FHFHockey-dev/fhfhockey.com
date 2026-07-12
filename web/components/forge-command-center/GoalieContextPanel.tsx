import Link from "next/link";
import { useMemo } from "react";

import {
  DenseList,
  DenseListRow,
  MetricPill,
  ModuleState,
  StatusChip
} from "components/forge-command-center/CommandCenterShell";
import type { CommandCenterData } from "lib/dashboard/commandCenterData";
import type { NormalizedGoalieProjectionRow } from "lib/dashboard/normalizers";
import styles from "styles/ForgeCommandCenter.module.scss";

type GoalieContextPanelProps = {
  module: CommandCenterData["modules"]["goalieContext"];
  selectedTeam: string;
  playerHref: (playerId: number | string) => string;
};

const formatPercent = (value: number | null | undefined, digits = 0) =>
  value == null || Number.isNaN(value) ? "--" : `${(value * 100).toFixed(digits)}%`;

const formatMetric = (value: number | null | undefined, digits = 1) =>
  value == null || Number.isNaN(value) ? "--" : value.toFixed(digits);

function recommendationTone(row: NormalizedGoalieProjectionRow): "good" | "warn" | "danger" {
  const recommendation = (row.recommendation ?? "").toLowerCase();
  if (recommendation.includes("sit") || (row.blowup_risk ?? 0) >= 0.45) return "danger";
  if (recommendation.includes("stream") || (row.starter_probability ?? 0) < 0.65) return "warn";
  return "good";
}

function volatilityLabel(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "Unknown";
  if (value <= 0.95) return "Steady";
  if (value <= 1.2) return "Moderate";
  return "Volatile";
}

export default function GoalieContextPanel({
  module,
  selectedTeam,
  playerHref
}: GoalieContextPanelProps) {
  const rows = useMemo(
    () =>
      module.data.data
        .filter((row) => {
          if (selectedTeam === "all") return true;
          return (row.team_abbreviation ?? "").toUpperCase() === selectedTeam.toUpperCase();
        })
        .sort((a, b) => (b.starter_probability ?? 0) - (a.starter_probability ?? 0))
        .slice(0, 8),
    [module.data.data, selectedTeam]
  );
  const startCount = rows.filter(
    (row) => recommendationTone(row) === "good" && (row.starter_probability ?? 0) >= 0.65
  ).length;
  const streamCount = rows.filter((row) => recommendationTone(row) === "warn").length;
  const sitCount = rows.filter((row) => recommendationTone(row) === "danger").length;
  const renderedModule =
    module.status === "ready" && rows.length === 0
      ? { ...module, status: "empty" as const }
      : module;

  return (
    <ModuleState module={renderedModule}>
      <div className={styles.goalieContextPanel}>
        <div className={styles.metricStrip}>
          <MetricPill label="Start" value={startCount} tone="good" />
          <MetricPill label="Stream" value={streamCount} tone="warn" />
          <MetricPill label="Sit" value={sitCount} tone="danger" />
        </div>
        <p className={styles.uncertaintyNote}>
          Starter probabilities are model confidence bands, not confirmations. Use the
          recommendation with volatility and blow-up risk before treating a goalie as locked in.
        </p>

        <DenseList
          columns="minmax(0, 1.15fr) 54px 58px 58px 58px 72px 64px"
          aria-label="Goalie probability and risk context"
        >
          {rows.map((row) => (
            <DenseListRow key={row.goalie_id}>
              <Link href={playerHref(row.goalie_id)} className={styles.playerListLink}>
                <span>
                  <strong>{row.goalie_name}</strong>
                  <small>
                    {(row.team_abbreviation ?? row.team_name) || "--"} vs{" "}
                    {(row.opponent_team_abbreviation ?? row.opponent_team_name) || "--"}
                  </small>
                </span>
              </Link>
              <span>{formatPercent(row.starter_probability)}</span>
              <span>{formatMetric(row.proj_shots_against)}</span>
              <span>{formatMetric(row.proj_saves)}</span>
              <span>{formatMetric(row.proj_goals_allowed)}</span>
              <span>{volatilityLabel(row.volatility_index)}</span>
              <StatusChip tone={recommendationTone(row)}>
                {row.recommendation ?? row.confidence_tier ?? "Watch"}
              </StatusChip>
            </DenseListRow>
          ))}
        </DenseList>

        <div className={styles.goalieRiskGrid}>
          {rows.slice(0, 3).map((row) => (
            <div key={`goalie-risk-${row.goalie_id}`}>
              <strong>{row.goalie_name}</strong>
              <span>Win {formatPercent(row.proj_win_prob)}</span>
              <span>SO {formatPercent(row.proj_shutout_prob, 1)}</span>
              <span>Blow-up {formatPercent(row.blowup_risk)}</span>
              <span>Save% {formatPercent(row.modeled_save_pct, 1)}</span>
            </div>
          ))}
        </div>
      </div>
    </ModuleState>
  );
}
