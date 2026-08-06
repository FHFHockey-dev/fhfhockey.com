import styles from "./SustainabilityUi.module.scss";
import {
  formatSustainabilityScore,
  getSustainabilityTier,
  type SustainabilityThresholds
} from "./formatting";

export default function SustainabilityBadge({
  score,
  thresholds,
  status = "ready"
}: {
  score: number;
  thresholds: SustainabilityThresholds;
  status?: "ready" | "provisional";
}) {
  const tier = getSustainabilityTier(score, thresholds);
  const label = tier === "durable" ? "Durable" : tier === "volatile" ? "Volatile" : "Balanced";
  return (
    <span
      className={`${styles.badge} ${styles[tier]} ${status === "provisional" ? styles.provisional : ""}`}
      aria-label={`Sustainability ${label}, score ${formatSustainabilityScore(score)}${status === "provisional" ? ", provisional" : ""}`}
    >
      {label} {formatSustainabilityScore(score)}
      {status === "provisional" ? <em> provisional</em> : null}
    </span>
  );
}
