import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import Tooltip from "./PDHC/Tooltip";
import styles from "./MetricInfoDisclosure.module.scss";

type MetricInfoDisclosureProps = {
  label: string;
  warnings?: string[];
  warningTarget?: HTMLElement | null;
  /** Control that shares the Info row (left side) instead of taking its own row. */
  action?: ReactNode;
  overlay?: boolean;
  children: ReactNode;
};

export default function MetricInfoDisclosure({ label, warnings = [], warningTarget, action, overlay = false, children }: MetricInfoDisclosureProps) {
  const warning = <div className={styles.warning} role="status" aria-atomic="true">{warnings.join(" ")}</div>;
  return (
    <div className={styles.wrapper}>
      {warningTarget === undefined ? warning : warningTarget && warnings.length > 0 ? createPortal(warning, warningTarget) : null}
      {action && <div className={styles.action}>{action}</div>}
      {overlay ? <div className={`${styles.info} ${styles.overlayInfo}`}>
        <Tooltip portal label={`Info about ${label}`} dialogLabel={label}
          triggerClassName={styles.overlayTrigger} dialogClassName={styles.overlayDialog}
          content={<div className={styles.overlayContent}><h2>{label}</h2>{children}</div>}>
          <span aria-hidden="true">ⓘ</span> Info
        </Tooltip>
      </div> : <details className={styles.info}>
        <summary aria-label={`Info about ${label}`}>
          <span aria-hidden="true">ⓘ</span> Info
        </summary>
        <div className={styles.content}>{children}</div>
      </details>}
    </div>
  );
}
