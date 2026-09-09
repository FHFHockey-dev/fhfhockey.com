import Head from "next/head";
import Link from "next/link";
import Container from "components/Layout/Container";
import styles from "./Policies.module.scss";

export default function DraftProPolicies() {
  return <Container contentVariant="full">
    <Head><title>Draft Pro policies | Five Hole Fantasy Hockey</title><meta name="robots" content="noindex" /></Head>
    <article className={styles.policies}>
      <h1>Draft Pro policies</h1>
      <p>Last updated September 9, 2026.</p>
      <p>Draft Pro is offered by Tim Branson, operating Five Hole Fantasy Hockey in Pennsylvania, United States. Contact <a href="mailto:tim@fhfhockey.com">tim@fhfhockey.com</a> for payment, access, privacy, and support requests.</p>
      <nav aria-label="Policy sections"><a href="#terms">Terms</a><a href="#refunds">Refund requests</a><a href="#privacy">Privacy</a></nav>
      <section id="terms">
        <h2>Draft Pro terms</h2>
        <p>The 2026–27 pass costs US$5.99 plus applicable tax, shown before payment. It is a one-time purchase with no automatic renewal. Access ends July 1, 2027 at 12:00 a.m. America/New_York, covering all of June 30. Buying later in the season does not extend that date.</p>
        <p>Sign in to your FHFH account before purchasing. Stripe hosts checkout and processes card and eligible Link payments. Access activates after successful server verification; a return from checkout alone does not confirm payment.</p>
        <p>Review the available capabilities in your Draft Pro account panel before purchasing. Planned features, including Yahoo sync, have no guaranteed release date. Features released within the pass period are included in the same pass. Projections and draft analysis are estimates, not guarantees of results.</p>
        <p>Verified active paid supporters of the configured FHFH Patreon campaign can also qualify. Canceling renewal does not remove benefits while paid membership remains eligible. Membership must be reverified, and a provider failure may temporarily prevent premium access. A valid purchased pass remains independent of Patreon eligibility.</p>
        <p>Your account access is personal. Upload only data you are entitled to use, and respect each projection provider’s restrictions. Purchasing Draft Pro does not transfer ownership of third-party projections or grant redistribution rights.</p>
        <p>When eligibility ends, premium work remains stored but locked. Owned saved-item names remain visible, and renewed eligibility restores access. Existing free local drafting remains available. A full refund revokes the affected purchase grant; a partial refund does not. An open dispute suspends that grant, and a favorable resolution restores it within the pass period.</p>
        <p>These terms do not limit rights or remedies that applicable law does not allow us to exclude.</p>
      </section>
      <section id="refunds">
        <h2>Refund requests</h2>
        <p>Request review in <Link href="/account?section=draft-pro">Account → Draft Pro</Link> within 7 days of the purchase’s first successful server-recorded activation. Submission time determines eligibility; review may occur later. Requests are reviewed case by case, and approval is not guaranteed.</p>
        <p>Select a reason and provide an explanation of 10–2,000 characters. Improvement feedback and whether you used Pro in a live draft are optional. One open request is allowed per purchase. Submitting a request does not automatically refund payment or remove access.</p>
        <p>If a technical issue prevents submission, contact <a href="mailto:tim@fhfhockey.com">tim@fhfhockey.com</a> promptly with the account email and purchase reference. Do not send card numbers, passwords, or private projection files. Patreon payment refunds are handled through Patreon.</p>
      </section>
      <section id="privacy">
        <h2>Draft Pro privacy information</h2>
        <p>This notice describes the Draft Pro account and purchase workflow. We process account identifiers and email, payment references and statuses, entitlement history, refund-request answers, and the settings and data you choose to save to your account. These records support access, account restoration, refunds, security, and customer support.</p>
        <p>Stripe processes payment details on its hosted checkout. FHFH’s Draft Pro application stores payment references and status rather than card numbers. When you connect Patreon, we process the linked identity, membership information, and protected authorization credentials needed to verify benefits.</p>
        <p>Local draft autosave uses your browser. Private projection imports are uploaded to account storage only when you choose to save them to your account. Saved Drafts and associated imports are private account content; access is restricted by ownership and current eligibility.</p>
        <p>Supabase provides account/database/storage services, Vercel hosts the website and provides analytics and performance measurement, Stripe processes payments, Patreon verifies linked membership, and Resend delivers service emails. Refund notices sent to support include your account email, purchase reference, and form answers, not private projection files.</p>
        <p>Expiry or membership cancellation does not automatically delete your purchase history or saved work. Disconnecting Patreon removes its stored credentials while retaining relevant benefit history. You may contact support to request access, correction, or deletion of personal information; records needed for legal obligations, payment disputes, or security may need to be retained. Identity verification may be required.</p>
        <p>For provider handling, see <a href="https://stripe.com/privacy">Stripe</a>, <a href="https://supabase.com/privacy">Supabase</a>, <a href="https://vercel.com/legal/privacy-policy">Vercel</a>, <a href="https://www.patreon.com/policy/privacy">Patreon</a>, and <a href="https://resend.com/legal/privacy-policy">Resend</a>.</p>
      </section>
      <p><Link href="/account?section=draft-pro">Return to Draft Pro</Link></p>
    </article>
  </Container>;
}
