import styles from "styles/Rankings.module.scss";

export function formatPercentileScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

export function getScoreTileTone(percentile: number | null) {
  if (percentile == null || !Number.isFinite(percentile)) return styles.scoreToneMuted;
  if (percentile >= 95) return styles.scoreTonePeak;
  if (percentile >= 90) return styles.scoreToneElite;
  if (percentile >= 80) return styles.scoreToneStrong;
  if (percentile >= 60) return styles.scoreTonePositive;
  if (percentile >= 40) return styles.scoreToneNeutral;
  if (percentile >= 20) return styles.scoreToneWeak;
  return styles.scoreTonePoor;
}
