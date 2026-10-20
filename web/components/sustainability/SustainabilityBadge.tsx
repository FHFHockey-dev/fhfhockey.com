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
  score?: number | null;
  thresholds: SustainabilityThresholds;
  status?: "ready" | "provisional";
}) {
  const hasScore = typeof score === "number" && Number.isFinite(score);
  const tier = hasScore ? getSustainabilityTier(score, thresholds) : null;
  const label = tier === "durable" ? "High index" : tier === "volatile" ? "Low index" : tier === "balanced" ? "Mid index" : "Index unavailable";
  const displayScore = hasScore ? formatSustainabilityScore(score) : null;
  return (
    <span
      className={`${styles.badge} ${tier ? styles[tier] : ""} ${status === "provisional" ? styles.provisional : ""}`}
      aria-label={`Sustainability ${label}${displayScore != null ? `, score ${displayScore}` : ""}${status === "provisional" ? ", provisional" : ""}`}
      title={hasScore ? "Descriptive process support index grouped by the supplied score thresholds." : "Process support index unavailable because the score is missing or nonfinite."}
    >
      {label}{displayScore != null ? ` ${displayScore}` : ""}
      {status === "provisional" ? <em> provisional</em> : null}
    </span>
  );
}
