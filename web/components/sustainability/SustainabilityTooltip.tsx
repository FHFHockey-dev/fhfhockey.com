import styles from "./SustainabilityUi.module.scss";

export type SustainabilityComponent = {
  metric: string;
  contrib: number;
  z_raw: number | null;
  z_soft: number | null;
  r: number | null;
  n: number | null;
};

const value = (input: number | null) =>
  input == null || !Number.isFinite(input) ? "—" : input.toFixed(2);

export default function SustainabilityTooltip({
  components
}: {
  components: SustainabilityComponent[];
}) {
  const sorted = [...components].sort(
    (left, right) => Math.abs(right.contrib) - Math.abs(left.contrib)
  );
  return (
    <details className={styles.tooltip}>
      <summary aria-label="Show sustainability component details">Why?</summary>
      <table>
        <caption>Sustainability component contributions</caption>
        <thead>
          <tr><th>Metric</th><th>Impact</th><th>Z raw</th><th>Z soft</th><th>R</th><th>N</th></tr>
        </thead>
        <tbody>
          {sorted.map((component) => (
            <tr key={component.metric}>
              <th scope="row">{component.metric}</th>
              <td>{value(component.contrib)}</td>
              <td>{value(component.z_raw)}</td>
              <td>{value(component.z_soft)}</td>
              <td>{value(component.r)}</td>
              <td>{value(component.n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
