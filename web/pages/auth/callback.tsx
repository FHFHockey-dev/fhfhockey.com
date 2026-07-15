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
const SAFE_DOCUMENT_TITLE = "Completing Authentication | FHFHockey";

export default function AuthCallbackPage() {
  const router = useRouter();
  const hasProcessedRef = useRef(false);
  const [state, setState] = useState<CallbackState>({
    heading: "Finishing authentication",
    message:
      "Your sign-in or verification response is being processed now. This page will forward you once the session is ready.",
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
        heading: "Authentication failed",
        message:
          "FHFH could not safely clear this authentication response. Return to sign in and try again.",
        tone: "error"
      });
      navigateToAuthFallback((url) => router.replace(url));
      return;
    }

    const nextPath = sanitizeAuthReturnPath(callback.nextValue || fallbackNext);

    if (callback.hasProviderError) {
      setState({
        heading: "Authentication failed",
        message:
          "The authentication provider could not complete this request. Return to sign in and try again.",
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
              heading: "Recovery verified",
              message:
                "Your recovery link was accepted. Redirecting you to the password reset screen now.",
              tone: "success"
            });
            await router.replace(`/auth/reset-password?next=${encodeURIComponent(nextPath)}`);
            return;
          }

          setState({
            heading: "Authentication complete",
            message: "Your Google sign-in is complete. Redirecting you back now.",
            tone: "success"
          });
          await router.replace(nextPath);
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
              heading: "Recovery verified",
              message:
                "Your recovery link was accepted. Redirecting you to the password reset screen now.",
              tone: "success"
            });
            await router.replace(`/auth/reset-password?next=${encodeURIComponent(nextPath)}`);
            return;
          }

          setState({
            heading: "Email verified",
            message:
              "Your email verification completed successfully. Redirecting you back into the site now.",
            tone: "success"
          });
          await router.replace(nextPath);
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
              heading: "Recovery verified",
              message:
                "Your recovery link was accepted. Redirecting you to the password reset screen now.",
              tone: "success"
            });
            await router.replace(`/auth/reset-password?next=${encodeURIComponent(nextPath)}`);
            return;
          }

          setState({
            heading: "Authentication complete",
            message: "Your session is ready. Redirecting you back now.",
            tone: "success"
          });
          await router.replace(nextPath);
          return;
        }

        setState({
          heading: "Missing callback data",
          message:
            "This callback did not include a usable auth code, token hash, or session payload. Retry the sign-in flow from the header auth modal.",
          tone: "error"
        });
      } catch {
        setState({
          heading: "Authentication failed",
          message:
            "FHFH could not finish this authentication response. Return to sign in and try again.",
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
        <PageTitle>Auth Callback</PageTitle>
        <ClientOnly>
          <div className={styles.card}>
            <div className={styles.eyebrow}>Auth Callback</div>
            <h1 className={styles.title}>{state.heading}</h1>
            <p className={styles.body}>
              This route handles Google OAuth completion and email-link verification
              handoff for Supabase Auth.
            </p>

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
              <Link href={fallbackNext} className={styles.primaryAction}>
                Return to Site
              </Link>
              <Link href="/auth" className={styles.secondaryAction}>
                Open Auth Fallback
              </Link>
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
