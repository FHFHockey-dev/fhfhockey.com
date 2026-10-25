import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./MetricInfoDisclosure.module.scss";

type MetricInfoDisclosureProps = {
  label: string;
  warnings?: string[];
  warningTarget?: HTMLElement | null;
  children: ReactNode;
};

export default function MetricInfoDisclosure({ label, warnings = [], warningTarget, children }: MetricInfoDisclosureProps) {
  const warning = <div className={styles.warning} role="status" aria-atomic="true">{warnings.join(" ")}</div>;
  return (
    <div className={styles.wrapper}>
      {warningTarget === undefined ? warning : warningTarget && warnings.length > 0 ? createPortal(warning, warningTarget) : null}
      <details className={styles.info}>
        <summary aria-label={`Info about ${label}`}>
          <span aria-hidden="true">ⓘ</span> Info
        </summary>
        <div className={styles.content}>{children}</div>
      </details>
    </div>
  );
}
