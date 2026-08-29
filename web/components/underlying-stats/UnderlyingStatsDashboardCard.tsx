import type { ReactNode } from "react";

import styles from "./UnderlyingStatsDashboardCard.module.scss";

type UnderlyingStatsDashboardCardProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  info?: string;
  kicker?: string;
  title: string;
};

export default function UnderlyingStatsDashboardCard({
  actions = null,
  children,
  className,
  description,
  info,
  kicker,
  title
}: UnderlyingStatsDashboardCardProps) {
  return (
    <section
      className={[styles.card, className].filter(Boolean).join(" ")}
      aria-label={title}
    >
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          {kicker ? <span className={styles.kicker}>{kicker}</span> : null}
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{title}</h2>
            {info ? (
              <span
                className={styles.info}
                aria-label={info}
                tabIndex={0}
                title={info}
              >
                i
              </span>
            ) : null}
          </div>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
