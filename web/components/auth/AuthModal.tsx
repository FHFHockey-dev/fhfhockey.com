import { useEffect } from "react";
import Link from "next/link";

import styles from "./AuthModal.module.scss";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function AuthModal({ open, onClose }: AuthModalProps) {
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
            <div className={styles.eyebrow}>Account Access</div>
            <h2 className={styles.title}>Sign in or create an account</h2>
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
          <p className={styles.body}>
            The header auth flow is being rolled into the site now. Continue to
            the current auth page while the in-modal Google and email flows are
            being wired up.
          </p>

          <div className={styles.actions}>
            <Link href="/auth" className={styles.primaryAction} onClick={onClose}>
              Continue to Auth
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
