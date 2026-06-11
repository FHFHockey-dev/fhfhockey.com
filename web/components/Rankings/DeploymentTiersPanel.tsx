import type {
  DeploymentTierBucket,
  DeploymentTiersResponse,
} from "lib/rankings/deploymentTiers";

import styles from "styles/Rankings.module.scss";

type DeploymentTiersPanelProps = {
  payload: DeploymentTiersResponse | null;
  isLoading: boolean;
  errorMessage?: string;
};

function formatPercentile(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function sourceLabel(bucket: DeploymentTierBucket) {
  if (bucket.sourceState === "available") return "Live";
  if (bucket.sourceState === "partial") return "Partial";
  return "Unavailable";
}

function BucketCard({ bucket }: { bucket: DeploymentTierBucket }) {
  const topMetrics = bucket.metricAverages
    .filter((metric) => metric.averagePercentile != null)
    .sort((left, right) => {
      return (right.averagePercentile ?? -1) - (left.averagePercentile ?? -1);
    })
    .slice(0, 4);

  return (
    <article className={styles.deploymentTierBucket}>
      <header>
        <div>
          <span>{sourceLabel(bucket)}</span>
          <h3>{bucket.label}</h3>
        </div>
        <strong>{formatPercentile(bucket.averagePercentile)}</strong>
      </header>
      <dl>
        <div>
          <dt>Players</dt>
          <dd>{bucket.playerCount}</dd>
        </div>
        <div>
          <dt>Best metric</dt>
          <dd>{bucket.topMetricLabel ?? "-"}</dd>
        </div>
        <div>
          <dt>Top player</dt>
          <dd>
            {bucket.topPlayer
              ? `${bucket.topPlayer.name ?? `Player ${bucket.topPlayer.id}`}${
                  bucket.topPlayer.team ? ` (${bucket.topPlayer.team})` : ""
                }`
              : "-"}
          </dd>
        </div>
      </dl>
      {topMetrics.length > 0 ? (
        <ul>
          {topMetrics.map((metric) => (
            <li key={metric.metricKey}>
              <span>{metric.label}</span>
              <strong>{formatPercentile(metric.averagePercentile)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>{bucket.message ?? "No percentile metrics are available."}</p>
      )}
    </article>
  );
}

export default function DeploymentTiersPanel({
  payload,
  isLoading,
  errorMessage,
}: DeploymentTiersPanelProps) {
  if (isLoading) {
    return (
      <section className={styles.statePanel} aria-label="Deployment Tiers status">
        <h2>Deployment Tiers</h2>
        <p>Loading deployment summaries...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className={styles.statePanel} aria-label="Deployment Tiers status">
        <h2>Deployment Tiers</h2>
        <p>{errorMessage}</p>
      </section>
    );
  }

  if (!payload || payload.sections.length === 0) {
    return (
      <section className={styles.statePanel} aria-label="Deployment Tiers status">
        <h2>Deployment Tiers</h2>
        <p>No deployment tier summaries matched the current filters.</p>
      </section>
    );
  }

  return (
    <section className={styles.deploymentTiersPanel} aria-label="Deployment Tiers">
      <header className={styles.deploymentTiersHeader}>
        <div>
          <h2>Deployment Tiers</h2>
          <p>
            Percentile rollups by verified EV, PP, and PK deployment buckets.
          </p>
        </div>
        <span>
          {payload.meta.snapshotDates.length > 0
            ? `Snapshots ${payload.meta.snapshotDates.join(", ")}`
            : "Live API"}
        </span>
      </header>
      {payload.sections.map((section) => (
        <section key={section.key} className={styles.deploymentTierSection}>
          <header>
            <div>
              <h3>{section.label}</h3>
              <p>{section.description}</p>
            </div>
            <span>{section.strength.toUpperCase()}</span>
          </header>
          <div className={styles.deploymentTierGrid}>
            {section.buckets.map((bucket) => (
              <BucketCard key={bucket.key} bucket={bucket} />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
