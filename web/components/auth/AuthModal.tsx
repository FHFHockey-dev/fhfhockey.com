import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AuthForm from "./AuthForm";
import styles from "./AuthModal.module.scss";

export type AuthModalMode = "sign-in" | "sign-up" | "forgot-password";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  initialMode?: AuthModalMode;
};

const MODE_COPY: Record<
  AuthModalMode,
  {
    eyebrow: string;
    title: string;
    description: string;
    primaryLabel: string;
    secondaryLabel: string;
    helperPrompt: string;
    helperActionLabel: string;
    helperActionMode: AuthModalMode;
  }
> = {
  "sign-in": {
    eyebrow: "Account Access",
    title: "Sign in to your account",
    description:
      "Use Google or your email and password to get back into your profile, league defaults, and saved teams. Password reset stays in this same modal flow.",
    primaryLabel: "Continue to Sign In",
    secondaryLabel: "Need an account?",
    helperPrompt: "Forgot your password?",
    helperActionLabel: "Reset it here",
    helperActionMode: "forgot-password"
  },
  "sign-up": {
    eyebrow: "Create Account",
    title: "Create your account",
    description:
      "Start with Google or email and password. New email/password accounts should expect verification before protected settings and connected-account actions are available.",
    primaryLabel: "Continue to Sign Up",
    secondaryLabel: "Already have an account?",
    helperPrompt: "Want to sign in instead?",
    helperActionLabel: "Use sign in",
    helperActionMode: "sign-in"
  },
  "forgot-password": {
    eyebrow: "Password Recovery",
    title: "Reset your password",
    description:
      "Keep recovery separate from Google sign-in and from future connected fantasy accounts. The dedicated reset-email destination page is the next auth slice, so this mode is present now without the final recovery submit path yet.",
    primaryLabel: "Use Auth Fallback",
    secondaryLabel: "Remembered it?",
    helperPrompt: "Need to create an account instead?",
    helperActionLabel: "Start sign-up",
    helperActionMode: "sign-up"
  }
};

const MODE_LABELS: Record<AuthModalMode, string> = {
  "sign-in": "Sign In",
  "sign-up": "Sign Up",
  "forgot-password": "Forgot Password"
};

export default function AuthModal({
  open,
  onClose,
  initialMode = "sign-in"
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
  }, [initialMode, open]);

  const copy = useMemo(() => MODE_COPY[mode], [mode]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Authentication"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <div className={styles.eyebrow}>{copy.eyebrow}</div>
            <h2 className={styles.title}>{copy.title}</h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close authentication modal"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div
            className={styles.modeSwitch}
            role="tablist"
            aria-label="Authentication modes"
          >
            {(Object.keys(MODE_LABELS) as AuthModalMode[]).map((modeKey) => (
              <button
                key={modeKey}
                type="button"
                role="tab"
                aria-selected={mode === modeKey}
                className={`${styles.modeButton} ${mode === modeKey ? styles.modeButtonActive : ""}`}
                onClick={() => setMode(modeKey)}
              >
                {MODE_LABELS[modeKey]}
              </button>
            ))}
          </div>

          <p className={styles.body}>{copy.description}</p>

          <AuthForm mode={mode} onSuccess={onClose} />

          <div className={styles.inlineSwitch}>
            <span className={styles.inlineSwitchLabel}>{copy.secondaryLabel}</span>
            <button
              type="button"
              className={styles.inlineSwitchButton}
              onClick={() =>
                setMode(mode === "sign-up" ? "sign-in" : "sign-up")
              }
            >
              {mode === "sign-up" ? "Go to Sign In" : "Go to Sign Up"}
            </button>
          </div>

          <div className={styles.inlineSwitch}>
            <span className={styles.inlineSwitchLabel}>{copy.helperPrompt}</span>
            <button
              type="button"
              className={styles.inlineSwitchButton}
              onClick={() => setMode(copy.helperActionMode)}
            >
              {copy.helperActionLabel}
            </button>
          </div>

          <div className={styles.actions}>
            <Link
              href={`/auth?mode=${mode}`}
              className={styles.primaryAction}
              onClick={onClose}
            >
              {copy.primaryLabel}
            </Link>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
