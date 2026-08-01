import styles from "./SustainabilityUi.module.scss";

export type SustainabilitySparkPoint = {
  snapshot_date: string;
  s_100: number;
};

export default function SustainabilitySparkline({
  points
}: {
  points: SustainabilitySparkPoint[];
}) {
  if (points.length < 2) {
    return (
      <span className={styles.sparkFallback} role="status">
        Trend pending
      </span>
    );
  }
  const width = 84;
  const height = 24;
  const min = Math.min(...points.map((point) => point.s_100));
  const max = Math.max(...points.map((point) => point.s_100));
  const range = Math.max(1, max - min);
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.s_100 - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      className={styles.sparkline}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Sustainability trend from ${points[0].s_100.toFixed(1)} to ${points.at(-1)!.s_100.toFixed(1)}`}
    >
      <polyline points={path} />
    </svg>
  );
}
