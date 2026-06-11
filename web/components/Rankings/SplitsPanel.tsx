import type {
  RankingsSplitComparison,
  RankingsSplitRow,
  RankingsSplitsResponse,
} from "lib/rankings/splits";
import { formatDeploymentLabel } from "lib/rankings/rankingFormatters";

import styles from "styles/Rankings.module.scss";

type SplitsPanelProps = {
  payload: RankingsSplitsResponse | null;
  isLoading: boolean;
  errorMessage?: string;
};

function formatPercentile(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatRank(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return String(value);
}

function SplitMetricCell({
  value,
}: {
  value: RankingsSplitRow["base"] | null;
}) {
  return (
    <span className={styles.splitMetricPill}>
      <strong>{value?.formattedValue ?? "-"}</strong>
      <span>
        {formatPercentile(value?.percentile ?? null)} · Rk{" "}
        {formatRank(value?.rank ?? null)}
      </span>
    </span>
  );
}

function PlayerCell({ row }: { row: RankingsSplitRow }) {
  return (
    <td className={styles.trendingPlayerCell}>
      <strong>{row.entity.name ?? `Player ${row.entity.id}`}</strong>
      <span>
        {row.entity.position ?? "-"} · {row.team.name ?? row.team.abbreviation ?? "Team unavailable"} ·{" "}
        {formatDeploymentLabel(row.deployment)}
      </span>
    </td>
  );
}

function SectionTable({
  rows,
  comparisons,
}: {
  rows: RankingsSplitRow[];
  comparisons: RankingsSplitComparison[];
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.splitsTable}>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Team</th>
            <th scope="col">Base</th>
            {comparisons.map((comparison) => (
              <th key={comparison.key} scope="col">
                {comparison.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.entity.id}>
              <PlayerCell row={row} />
              <td>{row.team.abbreviation ?? "-"}</td>
              <td>
                <SplitMetricCell value={row.base} />
              </td>
              {comparisons.map((comparison) => (
                <td key={comparison.key}>
                  <SplitMetricCell value={row.splits[comparison.key] ?? null} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StateBody({ message }: { message: string }) {
  return (
    <section className={styles.statePanel} aria-label="Ranking splits status">
      <h2>Splits</h2>
      <p>{message}</p>
    </section>
  );
}

export default function SplitsPanel({
  payload,
  isLoading,
  errorMessage,
}: SplitsPanelProps) {
  if (isLoading) return <StateBody message="Loading ranking splits..." />;
  if (errorMessage) return <StateBody message={errorMessage} />;
  if (!payload || payload.rows.length === 0) {
    return (
      <StateBody
        message={payload?.meta.message ?? "No split rows matched these filters."}
      />
    );
  }

  return (
    <section className={styles.splitsPanel} aria-label="Ranking splits">
      <div className={styles.panelHeading}>
        <div>
          <h2>Splits</h2>
          <p>
            {payload.meta.metric.displayName} for selected players across verified
            ranking contexts.
          </p>
        </div>
        <span>
          Snapshot {payload.meta.baseSnapshotDate ?? "-"} · {payload.meta.rowCount} rows
        </span>
      </div>

      {payload.sections.map((section) => (
        <article key={section.key} className={styles.splitSection}>
          <div className={styles.splitSectionHeader}>
            <div>
              <h3>{section.label}</h3>
              <p>{section.description}</p>
            </div>
            <span>{section.sourceState}</span>
          </div>
          <SectionTable rows={payload.rows} comparisons={section.comparisons} />
        </article>
      ))}

      {payload.meta.unsupportedSplits.length > 0 ? (
        <div className={styles.splitCaveats}>
          {payload.meta.unsupportedSplits.map((split) => (
            <span key={split.key}>{split.reason}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
