import styles from "../../pages/trends/index.module.scss";

export default function SkoExplainer() {
  return (
    <div className={styles.metricCard} style={{ marginTop: 8 }}>
      <div className={styles.metricTitle}>
        Volatility-Discounted Points Pace (VDP)
      </div>
      <div className={styles.metricDetail}>
        A legacy compatibility number, not sKO: a skater’s recent points pace
        with a discount when the last 10 games swung more than the last 20. It
        is unvalidated and is not a sustainability rating or a forecast.
      </div>
      <div className={styles.metricDetail}>
        <strong>Formula:</strong> <code>VDP = Pace × Appearances × Volatility</code>
      </div>
      <ul
        className={styles.metricDetail}
        style={{ margin: "6px 0 0 0", paddingLeft: 16 }}
      >
        <li>
          <b>Pace</b>: unshrunk points per appearance, 0.6 × last-10 mean + 0.4 ×
          last-5 mean, current regular season only.
        </li>
        <li>
          <b>Appearances</b>: 5 player appearances (not team games).
        </li>
        <li>
          <b>Volatility</b>: 0.8–1.0 from last-10 vs last-20 points SD; every
          series of 10 or fewer games gets 0.9.
        </li>
      </ul>
      <div className={styles.metricDetail} style={{ marginTop: 6 }}>
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          <span>
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 3,
                background: "#2b7cff",
                marginRight: 6
              }}
            />
            VDP history
          </span>
          <span>
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 3,
                background: "#666",
                marginRight: 6
              }}
            />
            Volatility × (0.8–1.0)
          </span>
        </span>
      </div>
      <div className={styles.metricDetail} style={{ marginTop: 6 }}>
        <em>Limits:</em> discounting volatility is a presentation choice, not
        evidence that steadier players are better; no out-of-sample test
        supports it.
      </div>
    </div>
  );
}
