import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";

import styles from "styles/ForgeDashboard.module.scss";

const SkoChartsPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Legacy sKO Charts | FHFHockey</title>
        <meta
          name="description"
          content="Legacy sKO charts are quarantined from the live runtime because the calculations and data joins are no longer trusted."
        />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className={styles.page}>
        <div className={styles.container}>
          <section className={styles.header}>
            <div className={styles.headerTopline}>
              <div className={styles.titleBlock}>
                <h1 className={styles.title}>LEGACY SKO CHARTS</h1>
                <p className={styles.titleExpansion}>
                  <span className={styles.titleExpansionText}>
                    Quarantined legacy analysis surface
                  </span>
                </p>
              </div>
            </div>
          </section>

          <section className={styles.sectionBand} aria-label="Legacy sKO quarantine notice">
            <div className={styles.bandHeader}>
              <div className={styles.bandHeaderMain}>
                <div className={styles.bandIntro}>
                  <p className={styles.bandEyebrow}>Legacy Route</p>
                  <h2 className={styles.bandTitle}>This Page Is Quarantined</h2>
                  <p className={styles.bandSummary}>
                    The old sKO charts are not part of the live FORGE pipeline and no
                    longer run in production-facing form.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.sectionBandBody}>
              <p className={`${styles.panelState} ${styles.panelStateStale}`}>
                This route previously depended on legacy `sko_*` tables, direct
                client-side Supabase reads, exact timestamp joins, and formula
                assumptions that failed the pass-4 audit.
              </p>

              <div className={styles.insightLegend}>
                <div className={styles.insightLegendItem}>
                  <span className={`${styles.insightContextPill} ${styles.insightContextRisk}`}>
                    Not trusted
                  </span>
                  <span className={styles.insightLegendText}>
                    The legacy sKO runtime is quarantined so it cannot present stale or
                    misleading player scores as if they were current FORGE outputs.
                  </span>
                </div>
                <div className={styles.insightLegendItem}>
                  <span className={`${styles.insightContextPill} ${styles.insightRoutePill}`}>
                    Kept for lineage
                  </span>
                  <span className={styles.insightLegendText}>
                    Useful ideas from this route were reviewed separately and only
                    adapted into FORGE where they survived the audit.
                  </span>
                </div>
              </div>

              <div className={styles.previewActions}>
                <Link href="/forge/dashboard" className={styles.navLink}>
                  Back to FORGE Dashboard
                </Link>
                <Link href="/trends" className={styles.navLink}>
                  Open Trends
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default SkoChartsPage;
