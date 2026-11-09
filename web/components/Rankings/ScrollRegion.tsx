import type { ReactNode } from "react";

import styles from "styles/Rankings.module.scss";

// A horizontally scrollable table area that keyboard users can focus and scroll (WCAG 2.1.1).
// The arrow-key hint shows only while the region has keyboard focus.
export default function ScrollRegion({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.scrollFrame}>
      <div className={className} role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
      <span className={styles.scrollHint} aria-hidden="true">
        ← → to scroll
      </span>
    </div>
  );
}
