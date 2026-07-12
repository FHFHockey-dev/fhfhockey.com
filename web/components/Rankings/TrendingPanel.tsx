import type {
  TrendingMetricSummary,
  TrendingResponse,
  TrendingRow,
} from "lib/rankings/trending";
import {
  formatDeploymentLabel,
  formatToiClock,
} from "lib/rankings/rankingFormatters";

import styles from "styles/Rankings.module.scss";

type TrendingPanelProps = {
  payload: TrendingResponse | null;
  isLoading: boolean;
  errorMessage?: string;
};

function formatDelta(value: number | null, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}

function formatScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

function formatMetricValue(metric: TrendingMetricSummary, window: "last5" | "last20") {
  return metric[window]?.formattedValue ?? "-";
}

function primaryMetric(row: TrendingRow) {
  return row.metrics.find((metric) => metric.metricKey === row.primaryMetricKey) ??
    row.metrics[0] ??
    null;
}

function Row({ row }: { row: TrendingRow }) {
  const primary = primaryMetric(row);
  const supportingMetrics = row.metrics
    .filter((metric) => metric.metricKey !== row.primaryMetricKey)
    .slice(0, 3);

  return (
    <tr>
      <td className={styles.trendingPlayerCell}>
        <strong>{row.entity.name ?? `Player ${row.entity.id}`}</strong>
        <span>
          {row.entity.position ?? "-"} · {row.team.name ?? row.team.abbreviation ?? "Team unavailable"}
        </span>
      </td>
      <td>{row.team.abbreviation ?? "-"}</td>
      <td>{formatDeploymentLabel(row.deployment)}</td>
      <td>
        <strong className={row.trendScore != null && row.trendScore >= 0 ? styles.deltaPositive : styles.deltaNegative}>
          {formatScore(row.trendScore)}
        </strong>
      </td>
      <td>{primary?.label ?? row.primaryMetricKey}</td>
      <td>{primary ? formatMetricValue(primary, "last5") : "-"}</td>
      <td>{primary ? formatMetricValue(primary, "last20") : "-"}</td>
      <td>
        <strong className={row.primaryDeltaLast5VsLast20 != null && row.primaryDeltaLast5VsLast20 >= 0 ? styles.deltaPositive : styles.deltaNegative}>
          {formatDelta(row.primaryDeltaLast5VsLast20, " pct")}
        </strong>
      </td>
      <td>{formatToiClock(row.toiTrend.last5Seconds)}</td>
      <td>{formatDelta(row.toiTrend.deltaLast5VsLast20Seconds, "s")}</td>
      <td>
        <div className={styles.opportunitySignals}>
          {row.opportunitySignals.length ? (
            row.opportunitySignals.slice(0, 3).map((signal) => (
              <span
                key={signal.type}
                className={styles.opportunitySignal}
                title={signal.evidence}
              >
                {signal.label}
              </span>
            ))
          ) : (
            <span className={styles.opportunityEmpty}>-</span>
          )}
        </div>
      </td>
      <td>
        <div className={styles.trendingMiniMetrics}>
          {supportingMetrics.map((metric) => (
            <span key={metric.metricKey}>
              {metric.shortLabel}: {formatDelta(metric.deltaLast5VsLast20, " pct")}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function StateBody({ message }: { message: string }) {
  return (
    <tbody>
      <tr>
        <td className={styles.tableStateCell} colSpan={12}>
          {message}
        </td>
      </tr>
    </tbody>
  );
}

export default function TrendingPanel({
  payload,
  isLoading,
  errorMessage,
}: TrendingPanelProps) {
  return (
    <section className={styles.trendingPanel} aria-label="Trending players">
      <div className={styles.panelHeading}>
        <div>
          <h2>Trending Players</h2>
          <p>
            Last 5 vs last 20 movement across verified rolling metrics and opportunity signals.
          </p>
        </div>
        <span>
          Snapshot {payload?.meta.latestAvailableSnapshotDate ?? "-"}
        </span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.trendingTable}>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Team</th>
              <th scope="col">Deployment</th>
              <th scope="col">Trend</th>
              <th scope="col">Primary</th>
              <th scope="col">Last 5</th>
              <th scope="col">Last 20</th>
              <th scope="col">Delta</th>
              <th scope="col">TOI/G</th>
              <th scope="col">TOI Delta</th>
              <th scope="col">Opportunity</th>
              <th scope="col">Metric Deltas</th>
            </tr>
          </thead>
          {isLoading ? <StateBody message="Loading trends..." /> : null}
          {!isLoading && errorMessage ? (
            <StateBody message={errorMessage} />
          ) : null}
          {!isLoading && !errorMessage && payload && payload.rows.length === 0 ? (
            <StateBody message={payload.meta.message ?? "No trending rows matched these filters."} />
          ) : null}
          {!isLoading && !errorMessage && payload && payload.rows.length > 0 ? (
            <tbody>
              {payload.rows.map((row) => (
                <Row key={row.entity.id} row={row} />
              ))}
            </tbody>
          ) : null}
        </table>
      </div>
      {payload?.meta.opportunitySignalContracts.length ? (
        <div className={styles.inlineNotice}>
          Opportunity contracts:{" "}
          {payload.meta.opportunitySignalContracts
            .filter((contract) => contract.sourceState === "source_pending")
            .map((contract) => contract.label)
            .join(", ") || "all configured signals live"}
        </div>
      ) : null}
    </section>
  );
}
