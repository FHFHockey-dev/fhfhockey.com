import Link from "next/link";
import { NextSeo } from "next-seo";
import Container from "components/Layout/Container";
import styles from "styles/InfoPage.module.scss";

export default function Privacy() {
  return (
    <Container>
      <article className={styles.page}>
        <NextSeo
          title="Privacy policy draft | Five Hole Fantasy Hockey"
          description="Draft sitewide privacy information for Five Hole Fantasy Hockey."
          noindex
        />
        <header>
          <p className={styles.eyebrow}>Five Hole Fantasy Hockey · Draft for review</p>
          <h1>Privacy policy</h1>
          <p>This sitewide notice is incomplete and has not been finalized. The sections below describe features currently implemented on FHFH; retention periods and the sitewide privacy request process still need confirmation.</p>
        </header>
        <section className={styles.panel}>
          <h2>Operator and contact</h2>
          <p>The existing <Link href="/draft-pro/policies#privacy">Draft Pro privacy notice</Link> covers account and purchase workflows. Its <Link href="/draft-pro/policies">policy page</Link> lists the operator and support contact. Those details still need confirmation for this sitewide notice.</p>
        </section>
        <section className={styles.panel}>
          <h2>Accounts and profiles</h2>
          <p>FHFH supports email and password sign-in, plus Google and GitHub sign-in. Account features use an account identifier, email address, profile display name, avatar, and timezone. Supabase provides authentication, database, and account storage services.</p>
        </section>
        <section className={styles.panel}>
          <h2>Draft tools and connected leagues</h2>
          <p>Draft tools save working data and preferences in your browser. When you choose to save work to your account, the service receives the draft settings, snapshots, projection imports, scenarios, or reports you save.</p>
          <p>Connecting Yahoo uses authorization credentials and imports linked account, league, team, and roster information. Manual league imports process the data you submit. Available features and access can depend on your account.</p>
        </section>
        <section className={styles.panel}>
          <h2>Purchases and support</h2>
          <p>Draft Pro uses Stripe checkout, payment references and status, entitlement records, and refund-request answers. Patreon connections support membership verification, and Resend delivers service emails. Details for these workflows are in the <Link href="/draft-pro/policies">Draft Pro policies</Link>.</p>
        </section>
        <section className={styles.panel}>
          <h2>Browser storage and measurement</h2>
          <p>Browser storage supports sign-in sessions, draft work, preferences, and favorites. The Yahoo connection flow uses a cookie to associate the authorization response with the browser that started it.</p>
          <p>The site includes Vercel Analytics and Speed Insights for usage and performance measurement. Provider settings, retention periods, and any consent requirements still need review before this notice is finalized.</p>
        </section>
        <section className={styles.panel}>
          <h2>Comments and third-party content</h2>
          <p>Article comments submit the display name and comment you enter to the site’s Sanity content service. Comments are intended for display alongside articles.</p>
          <p>The site loads fonts from Google Fonts, and some pages load embedded X posts. Newsletter subscriptions and other external links lead to third-party services. Those providers handle information under their own policies; their use of cookies and similar technologies still needs review for this notice.</p>
        </section>
        <section className={styles.panel}>
          <h2>Retention and privacy requests</h2>
          <p>Account, purchase, saved-work, connection, comment, and analytics retention periods have not yet been confirmed for this sitewide notice. Disconnecting an integration or removing browser data should not be assumed to delete all server records.</p>
          <p>The final notice still needs a confirmed contact and process for access, correction, and deletion requests, including any records that must be retained. It also needs confirmation of any other data sharing, advertising, audience restrictions, or international processing arrangements.</p>
        </section>
        <div className={styles.actions}>
          <Link className={styles.action} href="/">Return to home</Link>
        </div>
      </article>
    </Container>
  );
}
