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
  eyebrow?: string;
  owns: string[];
  /** Shorter title shown on phones instead of `title` (e.g. "Trends"). */
  shortTitle?: string;
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
  shortTitle,
  surfaceLinks = [],
  title
}: DashboardPillarHeroProps) {
  return (
    <section className={[styles.hero, className].filter(Boolean).join(" ")}>
      <div className={`${styles.topRow} ${emphasis || actions ? "" : styles.topRowSolo}`}>
        <div className={styles.copy}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              {shortTitle ? (
                <>
                  <span className={styles.titleFull}>{title}</span>
                  <span className={styles.titleShort}>{shortTitle}</span>
                </>
              ) : (
                title
              )}
            </h1>
            {/* Page scope stays one click away so the first viewport goes to trend data. */}
            <details
              className={styles.about}
              // The notes overlay the page, so Escape closes them and returns focus.
              onKeyDown={(event) => {
                if (event.key !== "Escape" || !event.currentTarget.open) return;
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }}
            >
              <summary title="About this dashboard">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5.5" />
                  <circle cx="12" cy="7.75" r="1" fill="currentColor" stroke="none" />
                </svg>
                <span className={styles.srOnly}>About this dashboard</span>
              </summary>
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
          </div>
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
