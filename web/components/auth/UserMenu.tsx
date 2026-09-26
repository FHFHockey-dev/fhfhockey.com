import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

import { useAuth } from "contexts/AuthProviderContext";

import styles from "./UserMenu.module.scss";

function getUserInitials(label?: string | null) {
  const trimmed = (label || "").trim();
  if (!trimmed) return "U";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!user) {
    return null;
  }

  const title = user.displayName || user.email || "Account";

  async function handleSignOut() {
    setSigningOut(true);
    setError("");
    try { await signOut(); setOpen(false); }
    catch { setError("Unable to sign out. Please try again."); }
    finally { setSigningOut(false); }
  }

  return (
    <div ref={rootRef} className={styles.userMenu} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.userTrigger}
        aria-label="Open account menu"
        aria-expanded={open}
        aria-controls={panelId}
        title={title}
        onClick={() => setOpen((current) => !current)}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={title}
            className={styles.userAvatarImage}
          />
        ) : (
          <span className={styles.userAvatarFallback}>
            {getUserInitials(user.displayName || user.email || user.name)}
          </span>
        )}
      </button>

      {open ? (
        <div id={panelId} className={styles.menuPanel}>
          <div className={styles.menuHeader}>
            <div className={styles.menuName}>{title}</div>
            {user.email ? <div className={styles.menuEmail}>{user.email}</div> : null}
          </div>

          <div className={styles.menuActions}>
            <Link
              href="/account"
              className={styles.menuLink}
              onClick={() => setOpen(false)}
            >
              Account Settings
            </Link>
            <Link
              href="/account?section=league-settings"
              className={styles.menuLink}
              onClick={() => setOpen(false)}
            >
              League Settings
            </Link>
            <button
              type="button"
              className={`${styles.menuButton} ${styles.menuButtonDanger}`}
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
