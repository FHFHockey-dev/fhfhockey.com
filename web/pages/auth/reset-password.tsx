import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

import styles from "./ResetPassword.module.scss";

type PageState = "checking" | "ready" | "success" | "error";
const VALID_OTP_TYPES = new Set(["recovery"]);
const PASSWORD_UPDATE_TIMEOUT_MS = 15000;
const SAFE_DOCUMENT_TITLE = "Reset Password | FHFHockey";

function getStoredNextPath() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem("fhfh:post-password-reset-next");
  } catch {
    return null;
  }
}

function clearStoredNextPath() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem("fhfh:post-password-reset-next");
  } catch {
    // Ignore storage failures.
  }
}

async function updatePasswordWithRecoverySession(password: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error(
      "Your recovery session is missing or expired. Request a new password reset email and try again."
    );
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, PASSWORD_UPDATE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
      {
        method: "PUT",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY || "",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password }),
        signal: controller.signal
      }
    );

    const rawBody = await response.text();
    const parsedBody = rawBody ? JSON.parse(rawBody) : null;

    if (!response.ok) {
      const message =
        parsedBody?.msg ||
        parsedBody?.message ||
        `Failed to update password (${response.status}).`;
      throw new Error(message);
    }

    return parsedBody;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Password update timed out. Retry once, and if it keeps happening, request a new recovery email."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const replaceRoute = router.replace;
  const consumedCallbackRef = useRef<
    ReturnType<typeof consumeAuthCallbackLocation> | null
  >(null);
  const sessionLoadRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(false);
  const [pageState, setPageState] = useState<PageState>("checking");
  const [message, setMessage] = useState(
    "Checking your recovery session so you can choose a new password."
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [callbackNextPath, setCallbackNextPath] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const nextParam = router.query.next;
    return sanitizeAuthReturnPath(
      Array.isArray(nextParam)
        ? nextParam[0]
        : nextParam || getStoredNextPath() || "/account",
      "/account"
    );
  }, [router.query.next]);

  useEffect(() => {
    mountedRef.current = true;
    document.title = SAFE_DOCUMENT_TITLE;
    let callback: ReturnType<typeof consumeAuthCallbackLocation>;
    try {
      callback = consumedCallbackRef.current || consumeAuthCallbackLocation();
      consumedCallbackRef.current = callback;
    } catch {
      setPageState("error");
      setMessage(
        "FHFH could not safely clear this recovery response. Request a new password reset email and try again."
      );
      navigateToAuthFallback((url) => replaceRoute(url));
      return () => {
        mountedRef.current = false;
      };
    }

    if (callback.nextValue) {
      setCallbackNextPath(sanitizeAuthReturnPath(callback.nextValue, "/account"));
    }

    async function loadSession() {
      const {
        code,
        tokenHash,
        verificationType,
        accessToken,
        refreshToken
      } = callback;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!mountedRef.current) {
          return;
        }

        if (error) {
          setPageState("error");
          setMessage(
            "This recovery response could not be verified. Request a new password reset email and try again."
          );
          return;
        }

        setPageState("ready");
        setMessage("Choose a new password for your account.");
        return;
      }

      if (tokenHash && VALID_OTP_TYPES.has(verificationType)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery"
        });

        if (!mountedRef.current) {
          return;
        }

        if (error) {
          setPageState("error");
          setMessage(
            "This recovery response could not be verified. Request a new password reset email and try again."
          );
          return;
        }

        setPageState("ready");
        setMessage("Choose a new password for your account.");
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (!mountedRef.current) {
          return;
        }

        if (error) {
          setPageState("error");
          setMessage(
            "This recovery response could not be verified. Request a new password reset email and try again."
          );
          return;
        }

        setPageState("ready");
        setMessage("Choose a new password for your account.");
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (!mountedRef.current) {
        return;
      }

      if (error) {
        setPageState("error");
        setMessage(
          "FHFH could not read the recovery session. Request a new password reset email and try again."
        );
        return;
      }

      if (data.session) {
        setPageState("ready");
        setMessage("Choose a new password for your account.");
        return;
      }

      setPageState("error");
      setMessage(
        "Your recovery session is missing or expired. Request a new password reset email from the auth modal."
      );
    }

    if (!sessionLoadRef.current) {
      sessionLoadRef.current = loadSession().catch(() => {
        if (!mountedRef.current) {
          return;
        }

        setPageState("error");
        setMessage(
          "This recovery response could not be verified. Request a new password reset email and try again."
        );
      });
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (!mountedRef.current) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setPageState("ready");
        setMessage("Choose a new password for your account.");
      }
    });

    return () => {
      mountedRef.current = false;
      authListener.subscription.unsubscribe();
    };
  }, [replaceRoute]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setPageState("error");
      setMessage("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setPageState("error");
      setMessage("Your password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    setPageState("checking");
    setMessage("Updating your password now.");

    try {
      await updatePasswordWithRecoverySession(password);
    } catch (error) {
      setPageState("error");
      setMessage(error instanceof Error ? error.message : "Failed to update password.");
      setIsSubmitting(false);
      return;
    }

    setPageState("success");
    setMessage(
      "Your password has been updated successfully. You can continue into your account now."
    );
    clearStoredNextPath();
    setIsSubmitting(false);
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <>
      <Head>
        <title>{SAFE_DOCUMENT_TITLE}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <Container className={styles.container}>
        <PageTitle>Reset Password</PageTitle>
        <ClientOnly>
          <div className={styles.card}>
            <div className={styles.eyebrow}>Password Reset</div>
            <h1 className={styles.title}>Choose a new password</h1>
            <p className={styles.body}>
              This page completes the second half of the Supabase recovery flow
              after the email link returns to the site.
            </p>

            <div
              className={
                pageState === "error"
                  ? styles.errorNote
                  : pageState === "success"
                  ? styles.successNote
                  : styles.processingNote
              }
            >
              {message}
            </div>

            {pageState === "ready" ? (
              <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>New Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={styles.input}
                    autoComplete="new-password"
                    placeholder="Create a new password"
                    disabled={isSubmitting}
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Confirm Password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className={styles.input}
                    autoComplete="new-password"
                    placeholder="Confirm your new password"
                    disabled={isSubmitting}
                  />
                </label>

                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isSubmitting || !password || !confirmPassword}
                >
                  {isSubmitting ? "Updating..." : "Update Password"}
                </button>
              </form>
            ) : null}

            <div className={styles.actions}>
              <Link
                href={pageState === "success" ? callbackNextPath || nextPath : "/auth"}
                className={styles.primaryAction}
              >
                {pageState === "success" ? "Continue to Site" : "Open Auth"}
              </Link>
              <Link href="/" className={styles.secondaryAction}>
                Return Home
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
