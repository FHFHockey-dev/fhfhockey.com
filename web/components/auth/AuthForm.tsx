import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import supabase from "lib/supabase/client";
import { resetSupabaseBrowserAuthState } from "lib/supabase/browser-auth";

import type { AuthModalMode } from "./AuthModal";
import styles from "./AuthForm.module.scss";

type AuthFormProps = {
  mode: AuthModalMode;
  onSuccess?: () => void;
};

type FormState = {
  email: string;
  password: string;
  confirmPassword: string;
};

type AuthFeedbackTone = "error" | "notice" | "success";

type AuthFeedback = {
  message: string;
  tone: AuthFeedbackTone;
};

function getAuthRedirectUrl(path: string) {
  let origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  if (!origin.startsWith("http")) {
    origin = `https://${origin}`;
  }

  const normalizedOrigin = origin.endsWith("/") ? origin : `${origin}/`;
  return new URL(path, normalizedOrigin).toString();
}

function getCurrentReturnPath() {
  if (typeof window === "undefined") {
    return "/";
  }

  const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return nextPath.startsWith("/") ? nextPath : "/";
}

function buildCallbackRedirectUrl() {
  return buildCallbackRedirectUrlForPath(getCurrentReturnPath());
}

function buildCallbackRedirectUrlForPath(nextPath: string) {
  const redirectUrl = new URL(getAuthRedirectUrl("/auth/callback"));
  redirectUrl.searchParams.set("next", nextPath);
  return redirectUrl.toString();
}

function buildPasswordResetRedirectUrl() {
  return getAuthRedirectUrl("/auth/reset-password");
}

function rememberPasswordResetReturnPath() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem("fhfh:post-password-reset-next", getCurrentReturnPath());
  } catch {
    // Ignore storage failures and fall back to default account routing later.
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutHandle);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

export default function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const [formState, setFormState] = useState<FormState>({
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);

  useEffect(() => {
    setFeedback(null);
    setFormState((current) => ({
      email: current.email,
      password: "",
      confirmPassword: ""
    }));
  }, [mode]);

  const isForgotPasswordMode = mode === "forgot-password";
  const isSignUpMode = mode === "sign-up";

  const submitLabel = useMemo(() => {
    if (mode === "sign-up") return "Create Account";
    if (mode === "forgot-password") return "Reset Flow Coming Next";
    return "Sign In";
  }, [mode]);

  function updateField(field: keyof FormState, value: string) {
    setFormState((current) => ({
      ...current,
      [field]: value
    }));
  }

  function setError(message: string) {
    setFeedback({ tone: "error", message });
  }

  function setNotice(message: string) {
    setFeedback({ tone: "notice", message });
  }

  function setSuccess(message: string) {
    setFeedback({ tone: "success", message });
  }

  async function handleResetLocalSession() {
    setIsSubmitting(true);
    setFeedback(null);

    await resetSupabaseBrowserAuthState(supabase);

    setSuccess(
      "Local FHFH auth storage was reset. Try signing in again without clearing your full browser history."
    );
    setIsSubmitting(false);
  }

  function normalizeAuthErrorMessage(message: string, activeMode: AuthModalMode) {
    const normalized = message.toLowerCase();

    if (
      normalized.includes("invalid login credentials") ||
      normalized.includes("invalid credentials")
    ) {
      return "That email/password combination did not match an active account.";
    }

    if (
      normalized.includes("email not confirmed") ||
      normalized.includes("email not confirmed")
    ) {
      return "Your email is not verified yet. Check your inbox and confirm your account before signing in.";
    }

    if (normalized.includes("user already registered")) {
      return activeMode === "sign-up"
        ? "An account with that email already exists. Use Sign In or Google instead."
        : "That account already exists. Try signing in instead of creating a new account.";
    }

    if (normalized.includes("provider is not enabled")) {
      return "This sign-in provider is not enabled yet in Supabase. Finish the provider setup first.";
    }

    if (normalized.includes("popup") || normalized.includes("redirect")) {
      return "The authentication redirect could not be started. Check your provider and redirect URL configuration.";
    }

    return message;
  }

  async function handleOAuthAuth(provider: "google" | "github") {
    setIsSubmitting(true);
    setFeedback(null);

    await resetSupabaseBrowserAuthState(supabase);

    const providerLabel = provider === "github" ? "GitHub" : "Google";
    const { error } = await withTimeout(
      supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: buildCallbackRedirectUrl()
        }
      }),
      12000,
      `${providerLabel} sign-in did not start cleanly. Reset the local auth session and try again.`
    );

    if (error) {
      setError(
        normalizeAuthErrorMessage(
          error.message.replace(/^provider/i, providerLabel),
          mode
        )
      );
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isForgotPasswordMode) {
      const normalizedEmail = formState.email.trim();
      if (!normalizedEmail) {
        setError("Enter the email address attached to your account.");
        return;
      }

      setIsSubmitting(true);
      setFeedback(null);

      rememberPasswordResetReturnPath();

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: buildPasswordResetRedirectUrl()
      });

      if (error) {
        setError(normalizeAuthErrorMessage(error.message, mode));
        setIsSubmitting(false);
        return;
      }

      setSuccess(
        "Password reset email sent. Open the recovery link from your inbox to choose a new password."
      );
      setIsSubmitting(false);
      return;
    }

    const normalizedEmail = formState.email.trim();
    if (!normalizedEmail || !formState.password) {
      setError("Enter both your email and password.");
      return;
    }

    if (isSignUpMode && formState.password !== formState.confirmPassword) {
      setError("Your password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    if (mode === "sign-in") {
      await resetSupabaseBrowserAuthState(supabase);

      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: formState.password
        }),
        12000,
        "Sign-in timed out while reusing stale local auth state. Reset the local auth session and try again."
      );

      if (error) {
        setError(normalizeAuthErrorMessage(error.message, mode));
        setIsSubmitting(false);
        return;
      }

      onSuccess?.();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: formState.password,
      options: {
        emailRedirectTo: buildCallbackRedirectUrl()
      }
    });

    if (error) {
      setError(normalizeAuthErrorMessage(error.message, mode));
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      onSuccess?.();
      return;
    }

    if (data.user && !data.session) {
      setSuccess(
        "Check your email to verify your account before using protected settings."
      );
      setIsSubmitting(false);
      return;
    }

    setNotice(
      "Account creation was accepted, but the auth state still needs confirmation. Check your inbox before trying to sign in."
    );
    setIsSubmitting(false);
  }

  return (
    <div className={styles.authFormWrap}>
      {!isForgotPasswordMode ? (
        <>
          <div className={styles.oauthButtonStack}>
            <button
              type="button"
              className={`${styles.oauthButton} ${styles.googleButton}`}
              onClick={() => void handleOAuthAuth("google")}
              disabled={isSubmitting}
            >
              {mode === "sign-up" ? "Sign Up with Google" : "Continue with Google"}
            </button>
            <button
              type="button"
              className={`${styles.oauthButton} ${styles.githubButton}`}
              onClick={() => void handleOAuthAuth("github")}
              disabled={isSubmitting}
            >
              {mode === "sign-up" ? "Sign Up with GitHub" : "Continue with GitHub"}
            </button>
          </div>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerLabel}>or use email and password</span>
            <span className={styles.dividerLine} />
          </div>
        </>
      ) : null}

      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <input
            type="email"
            value={formState.email}
            onChange={(event) => updateField("email", event.target.value)}
            className={styles.input}
            autoComplete="email"
            placeholder="you@example.com"
            disabled={isSubmitting}
          />
        </label>

        {!isForgotPasswordMode ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Password</span>
            <input
              type="password"
              value={formState.password}
              onChange={(event) => updateField("password", event.target.value)}
              className={styles.input}
              autoComplete={isSignUpMode ? "new-password" : "current-password"}
              placeholder={
                isSignUpMode ? "Create a password" : "Enter your password"
              }
              disabled={isSubmitting}
            />
          </label>
        ) : null}

        {isSignUpMode ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Confirm Password</span>
            <input
              type="password"
              value={formState.confirmPassword}
              onChange={(event) =>
                updateField("confirmPassword", event.target.value)
              }
              className={styles.input}
              autoComplete="new-password"
              placeholder="Confirm your password"
              disabled={isSubmitting}
            />
          </label>
        ) : null}

        {isForgotPasswordMode ? (
          <div className={styles.pendingState}>
            Send a recovery email to the address on your account. The recovery
            link will land on the dedicated password reset screen before you are
            returned to the rest of the site.
          </div>
        ) : null}

        {feedback ? (
          <div
            className={
              feedback.tone === "error"
                ? styles.errorMessage
                : feedback.tone === "success"
                ? styles.successMessage
                : styles.noticeMessage
            }
            role={feedback.tone === "error" ? "alert" : undefined}
            aria-live={feedback.tone === "error" ? undefined : "polite"}
          >
            {feedback.message}
          </div>
        ) : null}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={
            isSubmitting ||
            !formState.email.trim() ||
            (!isForgotPasswordMode && !formState.password)
          }
        >
          {isSubmitting ? "Working..." : submitLabel}
        </button>
      </form>

      <div className={styles.fallbackRow}>
        <span className={styles.fallbackLabel}>Need the full fallback page?</span>
        <Link href={`/auth?mode=${mode}`} className={styles.fallbackLink}>
          Open /auth
        </Link>
        <button
          type="button"
          className={styles.resetSessionButton}
          onClick={() => void handleResetLocalSession()}
          disabled={isSubmitting}
        >
          Reset Local Auth
        </button>
      </div>
    </div>
  );
}
