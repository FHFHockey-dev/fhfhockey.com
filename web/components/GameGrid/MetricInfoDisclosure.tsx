import type { ReactNode } from "react";
import styles from "./MetricInfoDisclosure.module.scss";

type MetricInfoDisclosureProps = {
  label: string;
  warnings?: string[];
  children: ReactNode;
};

export default function MetricInfoDisclosure({ label, warnings = [], children }: MetricInfoDisclosureProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.warning} role="status" aria-atomic="true">{warnings.join(" ")}</div>
      <details className={styles.info}>
        <summary aria-label={`Info about ${label}`}>
          <span aria-hidden="true">ⓘ</span> Info
        </summary>
        <div className={styles.content}>{children}</div>
      </details>
    </div>
  );
}
