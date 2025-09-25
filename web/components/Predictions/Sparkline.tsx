import { useMemo } from "react";
import type { SparklinePoint } from "lib/trends/skoTypes";
import { buildSparklinePath } from "lib/trends/skoUtils";
import styles from "./Predictions.module.scss";

type Props = { data: SparklinePoint[] };

export default function Sparkline({ data }: Props) {
  const paths = useMemo(() => buildSparklinePath(data), [data]);

  if (!paths) {
    return <div className={styles.placeholder}>—</div>;
  }

  return (
    <svg
      className={styles.sparklineSvg}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
    >
      <polyline
        className={styles.sparklineBaseline}
        points={`0,${paths.baselineY} 100,${paths.baselineY}`}
      />
      <polygon className={styles.sparklineShade} points={paths.area} />
      <polyline className={styles.sparklinePath} points={paths.line} />
    </svg>
  );
}
