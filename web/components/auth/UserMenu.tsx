import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { useUser } from "contexts/AuthProviderContext";
import supabase from "lib/supabase/client";

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
  const user = useUser();
  const [open, setOpen] = useState(false);
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
    setOpen(false);
    await supabase.auth.signOut();
  }

  return (
    <div ref={rootRef} className={styles.userMenu}>
      <button
        type="button"
        className={styles.userTrigger}
        aria-label="Open account menu"
        aria-expanded={open}
        aria-haspopup="menu"
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
        <div className={styles.menuPanel} role="menu" aria-label="Account menu">
          <div className={styles.menuHeader}>
            <div className={styles.menuName}>{title}</div>
            {user.email ? <div className={styles.menuEmail}>{user.email}</div> : null}
          </div>

          <div className={styles.menuActions}>
            <Link
              href="/account"
              className={styles.menuLink}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Account Settings
            </Link>
            <Link
              href="/account?section=league-settings"
              className={styles.menuLink}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              League Settings
            </Link>
            <button
              type="button"
              className={`${styles.menuButton} ${styles.menuButtonDanger}`}
              role="menuitem"
              onClick={() => void handleSignOut()}
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
