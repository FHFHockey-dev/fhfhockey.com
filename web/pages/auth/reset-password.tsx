import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import Container from "components/Layout/Container";
import PageTitle from "components/PageTitle";
import ClientOnly from "components/ClientOnly";
import supabase from "lib/supabase/client";

import styles from "./ResetPassword.module.scss";

type PageState = "checking" | "ready" | "success" | "error";

function sanitizeNextPath(nextValue?: string | null) {
  if (!nextValue || !nextValue.startsWith("/")) {
    return "/";
  }

  return nextValue;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("checking");
  const [message, setMessage] = useState(
    "Checking your recovery session so you can choose a new password."
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(() => {
    const nextParam = router.query.next;
    return sanitizeNextPath(
      Array.isArray(nextParam) ? nextParam[0] : nextParam || "/account"
    );
  }, [router.query.next]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        setPageState("error");
        setMessage(error.message);
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

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setPageState("ready");
        setMessage("Choose a new password for your account.");
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router.isReady]);

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

    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      setPageState("error");
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setPageState("success");
    setMessage(
      "Your password has been updated successfully. You can continue into your account now."
    );
    setIsSubmitting(false);
    setPassword("");
    setConfirmPassword("");
  }

  return (
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
              href={pageState === "success" ? nextPath : "/auth"}
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
  );
}
