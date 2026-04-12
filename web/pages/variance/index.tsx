import Head from "next/head";
import Link from "next/link";

import styles from "./variance.module.scss";

export default function VarianceLandingPage() {
  return (
    <>
      <Head>
        <title>Variance | FHFHockey</title>
        <meta
          name="description"
          content="Variance analysis hub for goalie and skater decision surfaces."
        />
      </Head>

      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Variance</p>
          <h1 className={styles.title}>Goalie and Skater Variance Hub</h1>
          <p className={styles.description}>
            Use this section to move into goalie variance analysis or the first
            live skater variance MVP.
          </p>
        </header>

        <div className={styles.buttonRow} aria-label="Variance routes">
          <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/variance/goalies">
            Goalies
          </Link>
          <Link className={`${styles.button} ${styles.buttonSecondary}`} href="/variance/skaters">
            Skaters
          </Link>
        </div>
      </main>
    </>
  );
}
