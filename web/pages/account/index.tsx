import Link from "next/link";

import Container from "components/Layout/Container";
import ClientOnly from "components/ClientOnly";
import AccountSettingsPage from "components/account/AccountSettingsPage";
import { useAuth } from "contexts/AuthProviderContext";

import styles from "./AccountPage.module.scss";

export default function AccountPage() {
  const { user, isLoading } = useAuth();

  return (
    <Container contentVariant="full">
      <ClientOnly>
        {isLoading ? (
          <div className={styles.routeState} role="status">
            Loading account settings...
          </div>
        ) : !user ? (
          <section className={styles.routeState}>
            <h1>Account Settings</h1>
            <p>You need to sign in before accessing account settings.</p>
            <div className={styles.authActions}>
              <Link className={styles.primaryLink} href="/auth?mode=sign-in">
                Sign In
              </Link>
              <Link className={styles.secondaryLink} href="/auth?mode=sign-up">
                Create Account
              </Link>
            </div>
          </section>
        ) : (
          <AccountSettingsPage />
        )}
      </ClientOnly>
    </Container>
  );
}
