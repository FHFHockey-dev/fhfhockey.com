import Link from "next/link";
import type { ReactNode } from "react";

import type { SiteSurfaceLink } from "lib/navigation/siteSurfaceLinks";

import styles from "./DashboardPillarHero.module.scss";

type DashboardPillarHeroProps = {
  actions?: ReactNode;
  className?: string;
  defers: string[];
  description: ReactNode;
  /** Optional side box; /trends dropped it as a repeat of the description. */
  emphasis?: string;
  eyebrow: string;
  owns: string[];
  surfaceLinks?: SiteSurfaceLink[];
  title: string;
};

export default function DashboardPillarHero({
  actions = null,
  className,
  defers,
  description,
  emphasis,
  eyebrow,
  owns,
  surfaceLinks = [],
  title
}: DashboardPillarHeroProps) {
  return (
    <section className={[styles.hero, className].filter(Boolean).join(" ")}>
      <div className={`${styles.topRow} ${emphasis || actions ? "" : styles.topRowSolo}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.description}>{description}</div>
        </div>

        {emphasis || actions ? (
          <div className={styles.sideRail}>
            {emphasis ? (
              <>
                <span className={styles.sideLabel}>Primary lens</span>
                <span className={styles.emphasis}>{emphasis}</span>
              </>
            ) : null}
            {actions ? <div className={styles.actions}>{actions}</div> : null}
          </div>
        ) : null}
      </div>

      <div className={styles.metaRow}>

      {/* Page scope stays one click away so the first viewport goes to trend data. */}
      <details className={styles.about}>
        <summary>About this dashboard</summary>
        <div className={styles.identityGrid}>
        <article className={styles.identityCard}>
          <span className={styles.identityLabel}>On this page</span>
          <ul className={styles.identityList}>
            {owns.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className={styles.identityCard}>
          <span className={styles.identityLabel}>Elsewhere</span>
          <ul className={styles.identityList}>
            {defers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        </div>
      </details>

      {surfaceLinks.length ? (
        <nav className={styles.linkRow} aria-label="Related pages">
          {surfaceLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.linkPill}
              title={link.description}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
      </div>
    </section>
  );
}
