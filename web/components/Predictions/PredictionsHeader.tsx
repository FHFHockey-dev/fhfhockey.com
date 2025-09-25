import { format } from "date-fns";
import styles from "./Predictions.module.scss";

type Props = {
  latestRunDate?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export default function PredictionsHeader({
  latestRunDate,
  refreshing,
  onRefresh
}: Props) {
  return (
    <div className={styles.header}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>
          Trends — Sustainability K-Value Outlook
        </h1>
        <p className={styles.subtitle}>
          Expected production blended with recent steadiness. Higher sKO values
          reflect both strong projection and stability over the past few weeks.
          Hover for more detail and use the sparkline to see trajectory.
          <abbr title="We multiply a player’s prediction by a stability factor based on recent consistency. This keeps hot streaks in check and rewards steady performance.">
            {" "}
            sKO help
          </abbr>
        </p>
      </div>
      <div className={styles.metaBlock}>
        <span className={styles.asOf}>
          {latestRunDate
            ? `Latest run: ${format(new Date(latestRunDate), "MMM d, yyyy")}`
            : ""}
        </span>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={!!refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}
