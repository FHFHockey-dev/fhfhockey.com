import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import Container from "components/Layout/Container";
import PageTitle from "components/PageTitle";
import ClientOnly from "components/ClientOnly";
import AuthForm from "components/auth/AuthForm";
import type { AuthModalMode } from "components/auth/AuthModal";
import { useAuth } from "contexts/AuthProviderContext";

import styles from "./Auth.module.scss";

const MODE_LABELS: Record<AuthModalMode, string> = {
  "sign-in": "Sign In",
  "sign-up": "Sign Up",
  "forgot-password": "Forgot Password"
};

function resolveMode(modeValue: string | string[] | undefined): AuthModalMode {
  const rawMode = Array.isArray(modeValue) ? modeValue[0] : modeValue;
  if (
    rawMode === "sign-in" ||
    rawMode === "sign-up" ||
    rawMode === "forgot-password"
  ) {
    return rawMode;
  }

  return "sign-in";
}

export default function AuthPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const mode = useMemo(() => resolveMode(router.query.mode), [router.query.mode]);
  const status = useMemo(() => {
    const rawStatus = router.query.status;
    return Array.isArray(rawStatus) ? rawStatus[0] : rawStatus || "";
  }, [router.query.status]);

  function updateMode(nextMode: AuthModalMode) {
    void router.replace(
      {
        pathname: "/auth",
        query: { ...(status ? { status } : {}), mode: nextMode }
      },
      undefined,
      { shallow: true }
    );
  }

  return (
    <Container className={styles.container}>
      <PageTitle className={styles.pageTitle}>Account</PageTitle>
      <ClientOnly>
        <section className={styles.card}>
          {user ? <h2 className={styles.title}>You are already signed in</h2> : null}

          {status ? (
            <div className={styles.notice}>
              Status: <strong>{status}</strong>
            </div>
          ) : null}

          {user ? (
            <div className={styles.sessionPanel}>
              <div className={styles.sessionCopy}>
                Signed in as <strong>{user.displayName || user.email || user.name}</strong>
                {user.email ? ` (${user.email})` : ""}
              </div>
              <div className={styles.actions}>
                <Link href="/account" className={styles.primaryAction}>
                  Go to Account Settings
                </Link>
                <Link href="/" className={styles.secondaryAction}>
                  Return Home
                </Link>
                <button
                  type="button"
                  className={styles.signOutAction}
                  onClick={() => void signOut()}
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  className={styles.resetAction}
                  onClick={() => void signOut()}
                >
                  Reset Local Auth
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={styles.modeSwitch}
                role="tablist"
                aria-label="Fallback authentication modes"
              >
                {(Object.keys(MODE_LABELS) as AuthModalMode[]).map((modeKey) => (
                  <button
                    key={modeKey}
                    type="button"
                    role="tab"
                    aria-selected={mode === modeKey}
                    className={`${styles.modeButton} ${mode === modeKey ? styles.modeButtonActive : ""}`}
                    onClick={() => updateMode(modeKey)}
                  >
                    {MODE_LABELS[modeKey]}
                  </button>
                ))}
              </div>

              <div className={styles.formShell}>
                <AuthForm mode={mode} showFallbackLink={false} />
              </div>
            </>
          )}
        </section>
      </ClientOnly>
    </Container>
  );
}
