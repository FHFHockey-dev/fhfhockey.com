import Link from "next/link";

import Container from "components/Layout/Container";
import PageTitle from "components/PageTitle";
import ClientOnly from "components/ClientOnly";
import AccountSettingsPage from "components/account/AccountSettingsPage";
import { useAuth } from "contexts/AuthProviderContext";

export default function AccountPage() {
  const { user, isLoading } = useAuth();

  return (
    <Container contentVariant="full">
      <PageTitle>Account Settings</PageTitle>
      <ClientOnly>
        {isLoading ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            Loading account settings...
          </div>
        ) : !user ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <p>You need to sign in before accessing account settings.</p>
            <p>Protected settings are only available to authenticated accounts.</p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                flexWrap: "wrap"
              }}
            >
              <Link href="/auth?mode=sign-in">Open Sign In</Link>
              <Link href="/auth?mode=sign-up">Create Account</Link>
            </div>
          </div>
        ) : (
          <AccountSettingsPage />
        )}
      </ClientOnly>
    </Container>
  );
}
