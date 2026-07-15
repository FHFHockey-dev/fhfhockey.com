import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

import UnderlyingStatsNavBar from "components/underlying-stats/UnderlyingStatsNavBar";
import type { XgCalibrationAudit, XgBenchmarkSurface } from "lib/xg/hardeningAudit";
import type { XgOperationsAlert } from "lib/xg/operationsHealth";
import styles from "./operations.module.scss";

type OperationsPayload = {
  success: true;
  generatedAt: string;
  partial: boolean;
  notes: string[];
  counts: {
    featureCount: number | null;
    predictionCount: number | null;
    aggregateCounts: { team: number | null; player: number | null; goalie: number | null };
    aggregateReconciliation: { status: string; gamesChecked: number; issueCount: number; maximumAbsoluteDelta: number | null };
    flurryAggregateCoverage: Record<string, { total: number | null; adjusted: number | null }>;
    flurryAggregateReconciliation: { status: string; gamesChecked: number; issueCount: number; maximumAbsoluteDelta: number | null };
    registryModelVersion: string | null;
    predictionModelVersion: string | null;
    runningLeaseCount: number;
  };
  alerts: XgOperationsAlert[];
  calibration: XgCalibrationAudit;
  benchmarks: XgBenchmarkSurface[];
  featureCoverage: {
    status: "ok" | "warning" | "insufficient" | "unavailable";
    sampleRows: number;
    requiredRows: number | null;
    issues: Array<{ feature: string; trainingRate: number; scoringRate: number; message: string }>;
    scoringProfile: { features: Record<string, { nullRate: number }> } | null;
  };
  derivedLayers: {
    flurry: { shots: number; rawXg: number; flurryAdjustedXg: number; adjustment: number; rawPreserved: boolean };
    residual: { rows: number; shooterEffectsAvailable: number; goalieEffectsAvailable: number };
    reboundHeads: { rows: number; available: number };
  };
  registry: Array<Record<string, unknown>>;
  leases: Array<Record<string, unknown>>;
  externalTaxonomy: Array<{ provider: string; verification: string; comparisonRule: string }>;
};

function formatCount(value: number | null | undefined): string {
  return value == null ? "Unavailable" : value.toLocaleString();
}

function formatMetric(value: number | null | undefined, digits = 4): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

export default function XgOperationsRoute() {
  const [data, setData] = useState<OperationsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch("/api/v1/xg/operations", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error ?? (response.status === 401 ? "Admin authorization is required." : "Unable to load xG operations."));
        }
        return payload as OperationsPayload;
      })
      .then((payload) => setData(payload))
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load xG operations.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  const coverageCards = data ? [
    ["Feature rows", data.counts.featureCount],
    ["Approved predictions", data.counts.predictionCount],
    ["Team aggregates", data.counts.aggregateCounts.team],
    ["Player aggregates", data.counts.aggregateCounts.player],
    ["Goalie aggregates", data.counts.aggregateCounts.goalie],
    ["Running leases", data.counts.runningLeaseCount],
  ] as const : [];
  const flurrySurfaceRows = data ? Object.entries(data.counts.flurryAggregateCoverage) : [];

  return (
    <>
      <Head><title>xG Operations | FHFH</title></Head>
      <main className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.toolbar}>
            <UnderlyingStatsNavBar />
            <div className={styles.actions}>
              <Link href="/underlying-stats/xg" className={styles.secondaryButton}>Model Lab</Link>
              <button type="button" className={styles.button} onClick={() => setRefreshKey((value) => value + 1)}>Refresh</button>
            </div>
          </div>

          <header className={styles.header}>
            <p className={styles.eyebrow}>Admin Operations</p>
            <h1>xG Pipeline Health</h1>
            <p>Read-only model-contract, coverage, calibration, aggregate, and execution-coordination telemetry.</p>
            {data && <p className={styles.timestamp}>Generated {new Date(data.generatedAt).toLocaleString()}</p>}
          </header>

          {loading && <section className={styles.state} aria-live="polite">Loading xG operations telemetry…</section>}
          {error && <section className={styles.state} data-tone="error" role="alert">{error}</section>}

          {data && !loading && (
            <>
              {data.partial && <section className={styles.state} data-tone="warn" role="status">Partial telemetry: unavailable sources remain visible below.</section>}

              <section className={styles.grid} aria-label="xG coverage counts">
                {coverageCards.map(([label, value]) => <article className={styles.card} key={label}><span>{label}</span><strong>{formatCount(value)}</strong></article>)}
              </section>

              <section className={styles.panel}>
                <h2>Health alerts</h2>
                <div className={styles.alerts}>{data.alerts.map((alert) => <div className={styles.alert} data-tone={alert.severity} key={alert.key}><strong>{alert.severity}</strong><span>{alert.message}</span></div>)}</div>
              </section>

              <section className={styles.twoColumn}>
                <article className={styles.panel}>
                  <h2>Artifact contract</h2>
                  <dl className={styles.definitionList}>
                    <div><dt>Registry model</dt><dd>{data.counts.registryModelVersion ?? "Unavailable"}</dd></div>
                    <div><dt>Prediction model</dt><dd>{data.counts.predictionModelVersion ?? "Unavailable"}</dd></div>
                    <div><dt>Feature drift</dt><dd>{data.featureCoverage.status}</dd></div>
                    <div><dt>Drift sample</dt><dd>{formatCount(data.featureCoverage.sampleRows)} / {formatCount(data.featureCoverage.requiredRows)}</dd></div>
                  </dl>
                  {data.featureCoverage.issues.map((issue) => <p className={styles.issue} key={issue.feature}>{issue.message}</p>)}
                </article>
                <article className={styles.panel}>
                  <h2>Derived layers</h2>
                  <dl className={styles.definitionList}>
                    <div><dt>Raw / flurry xG</dt><dd>{formatMetric(data.derivedLayers.flurry.rawXg)} / {formatMetric(data.derivedLayers.flurry.flurryAdjustedXg)}</dd></div>
                    <div><dt>Flurry adjustment</dt><dd>{formatMetric(data.derivedLayers.flurry.adjustment)}</dd></div>
                    <div><dt>Flurry surfaces complete</dt><dd>{formatCount(flurrySurfaceRows.filter(([, value]) => value.total != null && value.adjusted === value.total).length)} / {formatCount(flurrySurfaceRows.length)}</dd></div>
                    <div><dt>Flurry aggregate symmetry</dt><dd>{data.counts.flurryAggregateReconciliation.status} · {formatCount(data.counts.flurryAggregateReconciliation.gamesChecked)} games</dd></div>
                    <div><dt>Shooter residuals</dt><dd>{formatCount(data.derivedLayers.residual.shooterEffectsAvailable)}</dd></div>
                    <div><dt>Goalie residuals</dt><dd>{formatCount(data.derivedLayers.residual.goalieEffectsAvailable)}</dd></div>
                    <div><dt>Rebound heads available</dt><dd>{formatCount(data.derivedLayers.reboundHeads.available)} / {formatCount(data.derivedLayers.reboundHeads.rows)}</dd></div>
                    <div><dt>Aggregate symmetry</dt><dd>{data.counts.aggregateReconciliation.status} · {formatCount(data.counts.aggregateReconciliation.gamesChecked)} games</dd></div>
                  </dl>
                </article>
              </section>

              <section className={styles.panel}>
                <h2>Benchmark surfaces</h2>
                <div className={styles.grid}>{data.benchmarks.map((benchmark) => <article className={styles.card} key={benchmark.key}><span>{benchmark.label}</span><strong>{formatCount(benchmark.metrics.exampleCount)} shots</strong><small>Brier {formatMetric(benchmark.metrics.brierScore)} · Log loss {formatMetric(benchmark.metrics.logLoss)}</small></article>)}</div>
              </section>

              <section className={styles.panel}>
                <h2>Calibration segments</h2>
                <div className={styles.tableWrap}><table><thead><tr><th>Axis</th><th>Segment</th><th>Status</th><th>Shots</th><th>Goal rate</th><th>Avg xG</th><th>Brier</th><th>ECE</th></tr></thead><tbody>{data.calibration.segments.map((row) => <tr key={`${row.axis}:${row.value}`}><td>{row.axis}</td><td>{row.value}</td><td>{row.status}</td><td>{formatCount(row.metrics.exampleCount)}</td><td>{formatMetric(row.metrics.goalRate)}</td><td>{formatMetric(row.metrics.averagePrediction)}</td><td>{formatMetric(row.metrics.brierScore)}</td><td>{formatMetric(row.expectedCalibrationError)}</td></tr>)}</tbody></table></div>
              </section>

              <section className={styles.twoColumn}>
                <article className={styles.panel}><h2>Execution leases</h2>{data.leases.length ? <pre>{JSON.stringify(data.leases, null, 2)}</pre> : <p className={styles.muted}>No lease telemetry is available.</p>}</article>
                <article className={styles.panel}><h2>Provider taxonomy</h2>{data.externalTaxonomy.map((source) => <div className={styles.source} key={source.provider}><strong>{source.provider}</strong><span>{source.verification}</span><small>{source.comparisonRule}</small></div>)}</article>
              </section>

              {data.notes.length > 0 && <section className={styles.panel}><h2>Partial / unavailable notes</h2><ul>{data.notes.map((note) => <li key={note}>{note}</li>)}</ul></section>}
            </>
          )}
        </div>
      </main>
    </>
  );
}
