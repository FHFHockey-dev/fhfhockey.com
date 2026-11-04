import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./MetricInfoDisclosure.module.scss";

type MetricInfoDisclosureProps = {
  label: string;
  warnings?: string[];
  warningTarget?: HTMLElement | null;
  /** Control that shares the Info row (left side) instead of taking its own row. */
  action?: ReactNode;
  children: ReactNode;
};

export default function MetricInfoDisclosure({ label, warnings = [], warningTarget, action, children }: MetricInfoDisclosureProps) {
  const warning = <div className={styles.warning} role="status" aria-atomic="true">{warnings.join(" ")}</div>;
  return (
    <div className={styles.wrapper}>
      {warningTarget === undefined ? warning : warningTarget && warnings.length > 0 ? createPortal(warning, warningTarget) : null}
      {action && <div className={styles.action}>{action}</div>}
      <details className={styles.info}>
        <summary aria-label={`Info about ${label}`}>
          <span aria-hidden="true">ⓘ</span> Info
        </summary>
        <div className={styles.content}>{children}</div>
      </details>
    </div>
  );
}
