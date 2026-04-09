import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import Container from "components/Layout/Container";
import PageTitle from "components/PageTitle";
import ClientOnly from "components/ClientOnly";
import supabase from "lib/supabase/client";

import styles from "./Callback.module.scss";

type CallbackState = {
  heading: string;
  message: string;
  tone: "processing" | "success" | "error";
};

const VALID_OTP_TYPES = new Set(["email", "recovery", "invite", "email_change"]);

function sanitizeNextPath(nextValue?: string | null) {
  if (!nextValue || !nextValue.startsWith("/")) {
    return "/";
  }

  return nextValue;
}

function decodeMaybe(value?: string | null) {
  if (!value) return "";

  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

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
    return sanitizeNextPath(
      Array.isArray(nextParam) ? nextParam[0] : nextParam || "/"
    );
  }, [router.query.next]);

  useEffect(() => {
    if (!router.isReady || hasProcessedRef.current || typeof window === "undefined") {
      return;
    }

    hasProcessedRef.current = true;

    async function handleCallback() {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const nextPath = sanitizeNextPath(
        url.searchParams.get("next") || hashParams.get("next") || fallbackNext
      );
      const providerError =
        decodeMaybe(url.searchParams.get("error_description")) ||
        decodeMaybe(hashParams.get("error_description")) ||
        decodeMaybe(url.searchParams.get("error")) ||
        decodeMaybe(hashParams.get("error"));

      if (providerError) {
        setState({
          heading: "Authentication failed",
          message: providerError,
          tone: "error"
        });
        return;
      }

      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash") || hashParams.get("token_hash");
      const verificationType =
        url.searchParams.get("type") || hashParams.get("type") || "";
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

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
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown authentication error.";
        setState({
          heading: "Authentication failed",
          message,
          tone: "error"
        });
      }
    }

    void handleCallback();
  }, [fallbackNext, router, router.isReady]);

  return (
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
  );
}

export async function getServerSideProps() {
  return {
    props: {}
  };
}
