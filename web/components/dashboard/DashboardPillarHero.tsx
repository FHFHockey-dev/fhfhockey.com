import Link from "next/link";
import type { ReactNode } from "react";

import type { SiteSurfaceLink } from "lib/navigation/siteSurfaceLinks";

import styles from "./DashboardPillarHero.module.scss";

type DashboardPillarHeroProps = {
  actions?: ReactNode;
  className?: string;
  defers: string[];
  description: ReactNode;
  emphasis: string;
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
      <div className={styles.topRow}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.description}>{description}</div>
        </div>

        <div className={styles.sideRail}>
          <span className={styles.sideLabel}>Primary lens</span>
          <span className={styles.emphasis}>{emphasis}</span>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      </div>

      <div className={styles.identityGrid}>
        <article className={styles.identityCard}>
          <span className={styles.identityLabel}>What lives here</span>
          <ul className={styles.identityList}>
            {owns.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className={styles.identityCard}>
          <span className={styles.identityLabel}>Use another surface for</span>
          <ul className={styles.identityList}>
            {defers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      {surfaceLinks.length ? (
        <div className={styles.linkGrid}>
          {surfaceLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.linkCard}
            >
              <span className={styles.linkLabel}>{link.label}</span>
              <span className={styles.linkDescription}>
                {link.description}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
