import styles from "styles/Rankings.module.scss";

// Percentile label with the % sign in its own span: the compact heatmap hides it
// (the band key already says the cells are percentiles); detailed tiles keep it.
export default function ScoreText({ label }: { label: string }) {
  if (!label.endsWith("%")) return <>{label}</>;
  return (
    <>
      {label.slice(0, -1)}
      <span className={styles.pctSign}>%</span>
    </>
  );
}
