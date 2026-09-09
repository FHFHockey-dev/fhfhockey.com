import styles from "./ArticleNewsletter.module.scss";

/** The publication currently manages subscriptions on its Substack page. */
export default function ArticleNewsletter({ variant = "library" }: { variant?: "library" | "reader" }) {
  return (
    <section className={`${styles.panel} ${variant === "reader" ? styles.reader : ""}`} aria-label="FHFH newsletter">
      <div className={styles.introduction}>
        <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="1" />
          <path d="m3 5 9 7 9-7" />
        </svg>
        <div>
          <p className={styles.eyebrow}>The FHFH newsletter</p>
          <h2>{variant === "reader" ? "Get the next FHFH article." : "Stay in the loop."}</h2>
          <p>Fresh analysis and fantasy hockey perspective, delivered to your inbox.</p>
        </div>
      </div>
      <div className={styles.action}>
        <a href="https://fhfhockey.substack.com/subscribe">Subscribe on Substack <span aria-hidden="true">↗</span></a>
        <p>Continue to Substack to choose your subscription.</p>
      </div>
    </section>
  );
}
