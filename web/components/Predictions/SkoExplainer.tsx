import styles from "../../pages/trends/index.module.scss";

export default function SkoExplainer() {
  return (
    <div className={styles.metricCard} style={{ marginTop: 8 }}>
      <div className={styles.metricTitle}>sKO — what it means</div>
      <div className={styles.metricDetail}>
        sKO (Sustainability K‑Value Outlook) estimates how a skater will perform next by
        combining a projection with how steady they’ve been lately.
      </div>
      <div className={styles.metricDetail}>
        <strong>Formula:</strong> <code>sKO = Prediction × Stability</code>
      </div>
      <ul className={styles.metricDetail} style={{ margin: "6px 0 0 0", paddingLeft: 16 }}>
        <li>
          <b>Prediction</b>: expected points for the horizon (e.g., next 5 games).
        </li>
        <li>
          <b>Stability</b>: a 0.8–1.0 multiplier from recent consistency (steadier → closer to 1.0).
        </li>
      </ul>
      <div className={styles.metricDetail} style={{ marginTop: 6 }}>
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          <span>
            <span
              aria-hidden
              style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#2b7cff", marginRight: 6 }}
            />
            sKO trend sparkline
          </span>
          <span>
            <span
              aria-hidden
              style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#666", marginRight: 6 }}
            />
            Stability × (0.8–1.0)
          </span>
        </span>
      </div>
      <div className={styles.metricDetail} style={{ marginTop: 6 }}>
        <em>Why it’s useful:</em> it tempers hot streaks and lifts steady producers, making rankings more trustworthy.
      </div>
    </div>
  );
}
