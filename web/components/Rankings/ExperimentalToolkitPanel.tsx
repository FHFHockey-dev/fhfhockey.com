import styles from "./ExperimentalToolkitPanel.module.scss";

const BREAKOUT_METRICS = ["TOI", "SOG/60", "iSCF/60", "iXG/60", "iHDCF/60"];

export default function ExperimentalToolkitPanel() {
  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>
        <span>Player Evaluation Toolkit roadmap</span>
        <span className={styles.plannedBadge}>Experimental roadmap</span>
      </summary>
      <div className={styles.body}>
        <p className={styles.intro}>
          The live Rankings matrix and Player Snapshot are the first Player
          Evaluation Toolkit foundation. “PELT” remains an internal alias; the
          planned channels below are scope markers, not active ranking signals.
        </p>
        <div className={styles.grid}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Player Evaluation Toolkit</h3>
              <span className={styles.badge}>Live foundation</span>
            </div>
            <p className={styles.subtitle}>Percentile category coverage</p>
            <p className={styles.copy}>
              Use the current matrix and snapshot cards to compare strengths,
              weak spots, peer context, sample confidence, and source quality.
            </p>
          </article>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Breakout Barometer</h3>
              <span className={styles.plannedBadge}>Planned experiment</span>
            </div>
            <p className={styles.subtitle}>
              Opportunity and chance-growth channel
            </p>
            <ul
              className={styles.metricList}
              aria-label="Breakout metric scope"
            >
              {BREAKOUT_METRICS.map((metric) => (
                <li key={metric}>{metric}</li>
              ))}
            </ul>
            <p className={styles.destination}>
              Planned home: Rankings Trending. No standalone route or live score
              yet.
            </p>
          </article>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Value Cost Delta</h3>
              <span className={styles.plannedBadge}>Planned experiment</span>
            </div>
            <p className={styles.subtitle}>Projected value versus draft cost</p>
            <p className={styles.copy}>
              Compare projection/VORP rank with Yahoo ADP and next-pick
              availability. Keep league scoring and projection source visible;
              never treat missing ADP as zero cost.
            </p>
            <p className={styles.destination}>
              Planned home: Draft Dashboard. This is not a live draft
              recommendation.
            </p>
          </article>
        </div>
      </div>
    </details>
  );
}
