import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import Container from "components/Layout/Container";
import PageTitle from "components/PageTitle";
import ClientOnly from "components/ClientOnly";
import {
  consumeAuthCallbackLocation,
  navigateToAuthFallback,
  sanitizeAuthReturnPath
} from "lib/supabase/auth-callback-location";
import supabase from "lib/supabase/client";

import styles from "./Callback.module.scss";

type CallbackState = {
  heading: string;
  message: string;
  tone: "processing" | "success" | "error";
};

const VALID_OTP_TYPES = new Set(["email", "recovery", "invite", "email_change"]);
const SAFE_DOCUMENT_TITLE = "Sign in | FHFHockey";

async function replaceAfterAuth(
  replaceRoute: (url: string) => unknown,
  nextPath: string,
  currentWindow: Window = window
) {
  const hardNavigate = () => {
    try {
      currentWindow.location.replace(nextPath);
    } catch {
      // The authenticated state is already established; retain the success UI
      // if the browser refuses a second navigation attempt.
    }
  };

  try {
    const didNavigate = await replaceRoute(nextPath);
    if (didNavigate === false) {
      hardNavigate();
    }
  } catch {
    hardNavigate();
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const hasProcessedRef = useRef(false);
  const [state, setState] = useState<CallbackState>({
    heading: "Signing you in",
    message:
      "One moment while we finish signing you in.",
    tone: "processing"
  });

  const fallbackNext = useMemo(() => {
    const nextParam = router.query.next;
    return sanitizeAuthReturnPath(
      Array.isArray(nextParam) ? nextParam[0] : nextParam || "/"
    );
  }, [router.query.next]);

  useEffect(() => {
    if (hasProcessedRef.current || typeof window === "undefined") {
      return;
    }

    hasProcessedRef.current = true;
    document.title = SAFE_DOCUMENT_TITLE;
    let callback: ReturnType<typeof consumeAuthCallbackLocation>;
    try {
      callback = consumeAuthCallbackLocation();
    } catch {
      setState({
        heading: "Let's try that again",
        message:
          "We couldn't finish signing you in. Sign in again.",
        tone: "error"
      });
      navigateToAuthFallback((url) => router.replace(url));
      return;
    }

    const nextPath = sanitizeAuthReturnPath(callback.nextValue || fallbackNext);

    if (callback.hasProviderError) {
      setState({
        heading: "Let's try that again",
        message:
          "Your sign-in provider couldn't complete the request. Sign in again.",
        tone: "error"
      });
      return;
    }

    async function handleCallback() {
      const {
        code,
        tokenHash,
        verificationType,
        accessToken,
        refreshToken
      } = callback;

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }

          if (verificationType === "recovery") {
            setState({
              heading: "Reset link accepted",
              message:
                "Reset link accepted. Taking you to choose a new password.",
              tone: "success"
            });
            await replaceAfterAuth(
              router.replace,
              `/auth/reset-password?next=${encodeURIComponent(nextPath)}`
            );
            return;
          }

          setState({
            heading: "You're signed in",
            message: "You're signed in with Google. Taking you back now.",
            tone: "success"
          });
          await replaceAfterAuth(router.replace, nextPath);
          return;
        }

        if (tokenHash && VALID_OTP_TYPES.has(verificationType)) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: verificationType as "email" | "recovery" | "invite" | "email_change"
          });

          if (error) {
            throw error;
          }

          if (verificationType === "recovery") {
            setState({
              heading: "Reset link accepted",
              message:
                "Reset link accepted. Taking you to choose a new password.",
              tone: "success"
            });
            await replaceAfterAuth(
              router.replace,
              `/auth/reset-password?next=${encodeURIComponent(nextPath)}`
            );
            return;
          }

          setState({
            heading: "Email verified",
            message:
              "Your email is verified. Taking you back now.",
            tone: "success"
          });
          await replaceAfterAuth(router.replace, nextPath);
          return;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            throw error;
          }

          if (verificationType === "recovery") {
            setState({
              heading: "Reset link accepted",
              message:
                "Reset link accepted. Taking you to choose a new password.",
              tone: "success"
            });
            await replaceAfterAuth(
              router.replace,
              `/auth/reset-password?next=${encodeURIComponent(nextPath)}`
            );
            return;
          }

          setState({
            heading: "You're signed in",
            message: "You're signed in. Taking you back now.",
            tone: "success"
          });
          await replaceAfterAuth(router.replace, nextPath);
          return;
        }

        setState({
          heading: "Let's try that again",
          message:
            "This sign-in link is incomplete or has already been used. Sign in again.",
          tone: "error"
        });
      } catch {
        setState({
          heading: "Let's try that again",
          message:
            "We couldn't finish signing you in. Sign in again.",
          tone: "error"
        });
      }
    }

    void handleCallback();
  }, [fallbackNext, router]);

  return (
    <>
      <Head>
        <title>{SAFE_DOCUMENT_TITLE}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <Container className={styles.container}>
        <PageTitle className={styles.pageTitle}>Sign in</PageTitle>
        <ClientOnly>
          <div className={styles.card}>
            <h2 className={styles.title}>{state.heading}</h2>
            <div
              className={
                state.tone === "error"
                  ? styles.errorNote
                  : state.tone === "success"
                  ? styles.successNote
                  : styles.processingNote
              }
            >
              {state.message}
            </div>

            <div className={styles.actions}>
              {state.tone === "error" ? (
                <>
                  <Link href="/auth" className={styles.primaryAction}>
                    Sign in again
                  </Link>
                  <Link href={fallbackNext} className={styles.secondaryAction}>
                    Return to site
                  </Link>
                </>
              ) : (
                <>
                  <Link href={fallbackNext} className={styles.primaryAction}>
                    Return to site
                  </Link>
                  <Link href="/auth" className={styles.secondaryAction}>
                    Sign in again
                  </Link>
                </>
              )}
            </div>
          </div>
        </ClientOnly>
      </Container>
    </>
  );
}

export async function getServerSideProps() {
  return {
    props: {}
  };
}
