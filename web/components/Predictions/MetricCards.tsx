import { formatNumber, formatPercent } from "lib/trends/skoUtils";
import type { MetricSummary } from "lib/trends/skoTypes";
import styles from "../../pages/trends/index.module.scss";

const ORDER = [
  "GOALS",
  "ASSISTS",
  "POINTS",
  "PP_POINTS",
  "SHOTS",
  "BLOCKED_SHOTS",
  "HITS"
];

function label(key: string) {
  switch (key.toUpperCase()) {
    case "PP_POINTS":
      return "PPP";
    case "BLOCKED_SHOTS":
      return "BLOCKS";
    default:
      return key.toUpperCase();
  }
}

export default function MetricCards({ metrics }: { metrics: MetricSummary[] }) {
  if (!metrics?.length) return null;

  const map = Object.fromEntries(
    metrics.map((m) => [m.statKey.toUpperCase(), m])
  );
  const list: MetricSummary[] = ORDER.filter((k) => map[k]).map((k) => map[k]);

  const totalSamples = list.reduce((s, m) => s + (m.sampleSize || 0), 0);
  const overallHit = totalSamples
    ? list.reduce((acc, m) => acc + (m.hitRate || 0) * (m.sampleSize || 0), 0) /
      totalSamples
    : 0;

  return (
    <div className={styles.metricsWrapper}>
      <div className={styles.metricComposite}>
        <div className={styles.metricCompositeHeader}>Overall Accuracy</div>
        <div className={styles.metricCompositeValue}>
          {formatPercent(overallHit)}
          <span className={styles.metricCompositeSub}>
            Weighted hit rate inside MoE
          </span>
        </div>
        <div
          className={styles.metricBars}
          role="group"
          aria-label="Accuracy by stat"
        >
          {list.map((m) => {
            const pct = (m.hitRate || 0) * 100;
            return (
              <div className={styles.metricBar} key={m.statKey}>
                <div className={styles.metricBarLabel}>{label(m.statKey)}</div>
                <div
                  className={styles.metricBarTrack}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(pct)}
                  aria-label={`${label(m.statKey)} accuracy ${pct.toFixed(1)}%`}
                >
                  <div
                    className={styles.metricBarFill}
                    style={{ width: `${pct.toFixed(1)}%` }}
                  />
                </div>
                <div className={styles.metricBarValue}>{pct.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={styles.metrics}>
        {list.map((metric) => (
          <div key={metric.statKey} className={styles.metricCard}>
            <div className={styles.metricTitle}>{label(metric.statKey)}</div>
            <div className={styles.metricValue}>
              <abbr title="MAE (Mean Absolute Error): on average, how far predictions are from actual results. Lower is better.">
                {formatNumber(metric.mae, 2)} MAE
              </abbr>
            </div>
            <div className={styles.metricDetail}>
              <abbr title="Hit rate inside margin of error (MoE).">
                {formatPercent(metric.hitRate)} inside MoE
              </abbr>
              ·
              <abbr title="Margin of Error (MoE).">
                MoE ±{formatNumber(metric.marginOfError, 2)}
              </abbr>
            </div>
            <div className={styles.metricDetail}>
              <abbr title="MAPE (Mean Absolute Percentage Error).">
                MAPE {formatNumber(metric.mape, 1)}%
              </abbr>
              · {metric.sampleSize} samples
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
