import { formatNumber, formatPercent } from "lib/trends/skoUtils";
import type { MetricSummary } from "lib/trends/skoTypes";
import styles from "./Predictions.module.scss";

export default function MetricCards({ metrics }: { metrics: MetricSummary[] }) {
  if (!metrics?.length) return null;
  return (
    <div className={styles.metrics}>
      {metrics.map((metric) => (
        <div key={metric.statKey} className={styles.metricCard}>
          <div className={styles.metricTitle}>
            {metric.statKey.toUpperCase()}
          </div>
          <div className={styles.metricValue}>
            <abbr title="MAE (Mean Absolute Error): on average, how far predictions are from actual results. Lower is better.">
              {formatNumber(metric.mae, 2)} MAE
            </abbr>
          </div>
          <div className={styles.metricDetail}>
            <abbr title="Hit rate inside margin of error (MoE): the share of predictions that landed within ±MoE of the actual outcome.">
              {formatPercent(metric.hitRate)} inside MoE
            </abbr>
            ·
            <abbr title="Margin of Error (MoE): a typical wiggle room around predictions. We expect roughly this much deviation. Lower is tighter.">
              MoE ±{formatNumber(metric.marginOfError, 2)}
            </abbr>
          </div>
          <div className={styles.metricDetail}>
            <abbr title="MAPE (Mean Absolute Percentage Error): average percentage error relative to actuals. Lower is better.">
              MAPE {formatNumber(metric.mape, 1)}%
            </abbr>
            · {metric.sampleSize} samples
          </div>
        </div>
      ))}
    </div>
  );
}
