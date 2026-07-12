import type { ContextualRankingComparisonResponse } from "lib/rankings/comparison";
import { formatPercentile, formatToiClock } from "lib/rankings/rankingFormatters";
import type { TrendingResponse } from "lib/rankings/trending";

import styles from "styles/Rankings.module.scss";

type ComparisonSubject = ContextualRankingComparisonResponse["subjects"][number];
type ComparisonRow = NonNullable<ComparisonSubject["row"]>;
type ComparisonMetricCell = {
  formattedValue?: string | null;
  rank?: number | null;
  percentile?: number | null;
  qualifiedPeerCount?: number | null;
  sampleConfidence?: string | null;
  sourceQualityFlags?: string[];
};

type ComparisonSummaryPanelProps = {
  payload: ContextualRankingComparisonResponse | null;
  isLoading: boolean;
  errorMessage?: string;
  opportunityRows?: TrendingResponse["rows"];
};

function metricsFor(row: ComparisonRow | null) {
  if (!row || !("metrics" in row)) return {};
  return row.metrics as Record<string, ComparisonMetricCell | undefined>;
}

function subjectMeta(row: ComparisonRow | null) {
  if (!row) return "Unavailable in this context";

  if ("entity" in row) {
    const team = row.team.abbreviation ?? "No team";
    if ("role" in row) {
      return `${team} - ${row.role.deploymentLabel}`;
    }
    return `${team} - EV ${row.deployment.ev ?? "N/A"} / PP ${row.deployment.pp ?? "N/A"}`;
  }

  return `${row.team.abbreviation} - ${row.style.displayLabel}`;
}

function sampleLabel(row: ComparisonRow | null) {
  if (!row) return "No qualified sample";

  if ("sample" in row) {
    const sample = row.sample;
    const starts = "gamesStarted" in sample ? `, ${sample.gamesStarted} starts` : "";
    const shots = "shotsAgainst" in sample ? `, ${sample.shotsAgainst} shots` : "";
    const toiPerGameSeconds =
      "toiPerGameSeconds" in sample
        ? sample.toiPerGameSeconds
        : sample.gamesPlayed > 0
          ? Math.round(sample.toiSeconds / sample.gamesPlayed)
          : null;
    return `${sample.gamesPlayed} GP${starts}${shots}, ${formatToiClock(toiPerGameSeconds)} TOI/G, ${sample.confidence} confidence`;
  }

  return `${row.context.games} game-context games, style sample ${row.record.styleGames} games`;
}

function caveatLabel(subject: ComparisonSubject, row: ComparisonRow | null) {
  const caveats = new Set(subject.caveats);
  if (row && "warnings" in row) {
    row.warnings.forEach((warning) => caveats.add(warning));
  }
  if (row && "sample" in row && !row.sample.minimumSampleMet) {
    caveats.add("minimum sample not met");
  }
  if (caveats.size === 0) return "Clean source context";
  return Array.from(caveats).slice(0, 3).join("; ");
}

function metricLabel(cell: ComparisonMetricCell | undefined) {
  if (!cell) return "Metric unavailable";
  const value = cell.formattedValue ?? "N/A";
  const percentile =
    cell.percentile == null ? "no percentile" : `${formatPercentile(cell.percentile)} percentile`;
  const rank =
    cell.rank == null
      ? "unranked"
      : `rank ${cell.rank} of ${cell.qualifiedPeerCount ?? "unknown"}`;
  return `${value} - ${percentile}, ${rank}`;
}

function sourceLabel(cell: ComparisonMetricCell | undefined) {
  if (!cell) return "Source pending or not in visible metric contract";
  const flags = cell.sourceQualityFlags ?? [];
  const confidence = cell.sampleConfidence ? `${cell.sampleConfidence} sample` : "sample tracked";
  if (flags.length === 0) return `${confidence}, no metric source flags`;
  return `${confidence}, ${flags.slice(0, 2).join("; ")}`;
}

function opportunityLabel(
  subject: ComparisonSubject,
  opportunityRows: TrendingResponse["rows"],
) {
  const row = subject.row;
  if (!row || !("entity" in row) || row.entity.position === "G") {
    return "Opportunity-change signals are source-pending for this entity type.";
  }
  const opportunityRow = opportunityRows.find(
    (entry) => entry.entity.id === row.entity.id,
  );
  if (!opportunityRow) {
    return "No live opportunity-change signal in the current trending sample.";
  }
  const signal = opportunityRow.opportunitySignals[0];
  if (!signal) {
    return "Trending sample found, but no material opportunity-change signal.";
  }
  return `${signal.label}: ${signal.evidence}`;
}

export default function ComparisonSummaryPanel({
  payload,
  isLoading,
  errorMessage,
  opportunityRows = [],
}: ComparisonSummaryPanelProps) {
  const primaryMetricKey = payload?.request.metric ?? null;
  const primaryColumn = payload?.metricColumns.find(
    (column) => column.metricKey === primaryMetricKey,
  );

  return (
    <aside className={styles.comparisonPanel} aria-label="Comparison context">
      <header>
        <h2>Comparison Context</h2>
        <p>
          {payload
            ? `${payload.request.subjectCount} subject${payload.request.subjectCount === 1 ? "" : "s"} against the same filters`
            : "Selected row against the current filters"}
        </p>
      </header>

      {isLoading ? <p className={styles.snapshotMuted}>Loading comparison...</p> : null}
      {errorMessage ? <p className={styles.snapshotMuted}>{errorMessage}</p> : null}
      {!isLoading && !errorMessage && !payload ? (
        <p className={styles.snapshotMuted}>Select a row to load comparison context.</p>
      ) : null}

      {payload ? (
        <>
          <div className={styles.comparisonMeta}>
            <span>{payload.status}</span>
            <span>{primaryColumn?.label ?? payload.request.metric}</span>
            <span>{payload.source?.snapshotDate ?? "No snapshot"}</span>
          </div>
          <div className={styles.comparisonRows}>
            {payload.subjects.map((subject) => {
              const metrics = metricsFor(subject.row);
              const cell = primaryMetricKey ? metrics[primaryMetricKey] : undefined;
              return (
                <article key={subject.key}>
                  <h3>{subject.label}</h3>
                  <dl>
                    <div>
                      <dt>Peer Context</dt>
                      <dd>{subjectMeta(subject.row)}</dd>
                    </div>
                    <div>
                      <dt>Metric</dt>
                      <dd>{metricLabel(cell)}</dd>
                    </div>
                    <div>
                      <dt>Sample</dt>
                      <dd>{sampleLabel(subject.row)}</dd>
                    </div>
                    <div>
                      <dt>Source Quality</dt>
                      <dd>{sourceLabel(cell)}</dd>
                    </div>
                    <div>
                      <dt>Opportunity Evidence</dt>
                      <dd>{opportunityLabel(subject, opportunityRows)}</dd>
                    </div>
                    <div>
                      <dt>Caveats</dt>
                      <dd>{subject.reason ?? caveatLabel(subject, subject.row)}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
          {payload.caveats.length > 0 ? (
            <section className={styles.comparisonCaveats}>
              <h3>Source Notes</h3>
              <ul>
                {payload.caveats.slice(0, 4).map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
