import Head from "next/head";
import Link from "next/link";
import type { ReactNode } from "react";

import UnderlyingStatsNavBar from "./UnderlyingStatsNavBar";
import styles from "../../pages/underlying-stats/playerStats/playerStats.module.scss";

type UnderlyingStatsLandingShellProps = {
  title: string;
  description: string;
  breadcrumbLabel: string;
  heroTitle: ReactNode;
  heroLead: string;
  defaultSpanLabel: string;
  defaultSpanValue: string;
  activeFamilyLabel: string;
  activeFamilyValue: string;
  sectionAriaLabel: string;
  sectionHeader?: ReactNode;
  children: ReactNode;
  utilityLinkHref?: string;
  utilityLinkLabel?: string;
};

export default function UnderlyingStatsLandingShell({
  title,
  description,
  breadcrumbLabel,
  heroTitle,
  heroLead,
  defaultSpanLabel,
  defaultSpanValue,
  activeFamilyLabel,
  activeFamilyValue,
  sectionAriaLabel,
  sectionHeader,
  children,
  utilityLinkHref = "/trends",
  utilityLinkLabel = "View trends dashboard",
}: UnderlyingStatsLandingShellProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>

      <main className={styles.page}>
        <div className={styles.pageInner}>
          <div className={styles.utilityRow}>
            <div className={styles.breadcrumbs}>
              <Link href="/underlying-stats" className={styles.breadcrumbLink}>
                {breadcrumbLabel}
              </Link>
            </div>
            <Link href={utilityLinkHref} className={styles.breadcrumbLink}>
              {utilityLinkLabel}
            </Link>
          </div>

          <UnderlyingStatsNavBar />

          <header className={styles.hero}>
            <div className={styles.heroBody}>
              <div className={styles.heroCopy}>
                <h1 className={styles.title}>{heroTitle}</h1>
                <p className={styles.heroDescription}>{heroLead}</p>
              </div>

              <div className={styles.heroMeta}>
                <div className={styles.metaCard}>
                  <p className={styles.metaLabel}>{defaultSpanLabel}</p>
                  <p className={styles.metaValue}>{defaultSpanValue}</p>
                </div>
                <div className={styles.metaCard}>
                  <p className={styles.metaLabel}>{activeFamilyLabel}</p>
                  <p className={styles.metaValue}>{activeFamilyValue}</p>
                </div>
              </div>
            </div>
          </header>

          <section className={styles.section} aria-label={sectionAriaLabel}>
            {sectionHeader ? (
              <div className={styles.sectionHeader}>{sectionHeader}</div>
            ) : null}
            <div className={styles.tableSectionBody}>{children}</div>
          </section>
        </div>
      </main>
    </>
  );
}