import { useMemo, useState } from "react";
import type { SparklinePoint } from "lib/trends/skoTypes";
import { buildSparklinePath } from "lib/trends/skoUtils";
import styles from "./Predictions.module.scss";

type Props = { data: SparklinePoint[] };

export default function Sparkline({ data }: Props) {
  const [gradientId] = useState(
    () => `sparkline-gradient-${Math.random().toString(36).slice(2, 9)}`
  );
  const paths = useMemo(() => buildSparklinePath(data), [data]);
  // Identify divider index: last point considered "historical".
  const lastHistoricalIndex = useMemo(() => {
    for (let i = data.length - 1; i >= 0; i -= 1) {
      const p = data[i];
      if (p.value != null) return i;
    }
    return -1;
  }, [data]);

  if (!paths) {
    return <div className={styles.placeholder}>—</div>;
  }

  return (
    <svg
      className={styles.sparklineSvg}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
    >
      {paths.band ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(79, 195, 247, 0.35)" />
            <stop offset="100%" stopColor="rgba(79, 195, 247, 0.02)" />
          </linearGradient>
        </defs>
      ) : null}
      {paths.band ? (
        <polygon
          className={styles.sparklineBand}
          points={paths.band}
          fill={`url(#${gradientId})`}
        />
      ) : null}
      <polyline
        className={styles.sparklineBaseline}
        points={`0,${paths.baselineY} 100,${paths.baselineY}`}
      />
      <polygon className={styles.sparklineShade} points={paths.area} />
      <polyline className={styles.sparklinePath} points={paths.line} />
      {lastHistoricalIndex >= 0 && lastHistoricalIndex < data.length - 1 ? (
        <line
          x1={(lastHistoricalIndex / (data.length - 1)) * 100}
          x2={(lastHistoricalIndex / (data.length - 1)) * 100}
          y1={0}
          y2={40}
          stroke="rgba(255,255,255,0.5)"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
      ) : null}
    </svg>
  );
}
