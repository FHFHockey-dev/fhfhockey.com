import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import publicSupabase from "lib/supabase/public-client";
import SocialMedias from "components/SocialMedias";
import {
  isNavigationLinkActive,
  MOBILE_NAVIGATION_GROUPS,
  NAVIGATION_LINKS,
  SUPPORT_URL,
} from "components/Layout/NavbarItems/NavbarItemsData";
import NavigationIcon from "../NavigationIcon";
import LOGO from "public/pictures/FHFHonly.png";
import styles from "./MobileMenu.module.scss";

type MobileMenuProps = {
  accountUser?: {
    avatarUrl?: string | null;
    displayName?: string | null;
    email?: string | null;
    name?: string | null;
  } | null;
  onItemClick: () => void;
  onAuthClick?: () => void;
  onSignOut?: () => void | Promise<void>;
  showAuthButton?: boolean;
  showAccountControls?: boolean;
  visible: boolean;
  entryPoint?: "default" | "tools" | "search";
};
interface PlayerResult {
  id: number;
  fullName: string;
  image_url: string | null;
}

function MobileMenu({
  accountUser,
  onItemClick,
  onAuthClick,
  onSignOut,
  showAccountControls = false,
  showAuthButton = false,
  visible,
  entryPoint = "default",
}: MobileMenuProps) {
  const { pathname } = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState<string | null>("analytics");
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [retry, setRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    setSearchMode(entryPoint === "search");
    setSearchQuery("");
    setAccountError("");
    const currentGroup = MOBILE_NAVIGATION_GROUPS.find((category) =>
      category.groups.some((group) =>
        group.items.some((item) => isNavigationLinkActive(pathname, item.href)),
      ),
    );
    setExpanded(
      entryPoint === "tools" ? "tools" : (currentGroup?.id ?? "analytics"),
    );
    dialog.showModal();
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      if (entryPoint === "search") searchInputRef.current?.focus();
      else if (entryPoint === "tools") {
        toolsRef.current?.focus({ preventScroll: true });
        toolsRef.current?.scrollIntoView({ block: "start" });
      } else
        dialog
          .querySelector<HTMLButtonElement>('button[aria-label="Close menu"]')
          ?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [visible, entryPoint, pathname]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!visible || query.length < 2) {
      setSearchResults([]);
      setSearchStatus("idle");
      return;
    }
    let stale = false;
    setSearchResults([]);
    setSearchStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await publicSupabase
          .from("players")
          .select("id, fullName, image_url")
          .ilike("fullName", `%${query}%`)
          .limit(8);
        if (stale) return;
        if (error) throw error;
        setSearchResults((data as PlayerResult[]) ?? []);
        setSearchStatus("done");
      } catch {
        if (!stale) setSearchStatus("error");
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [searchQuery, retry, visible]);

  const accountTitle =
    accountUser?.displayName ||
    accountUser?.name ||
    accountUser?.email ||
    "Account";
  const initials = accountTitle
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const leaveSearch = () => {
    if (entryPoint === "search") {
      onItemClick();
      return;
    }
    setSearchMode(false);
    setSearchQuery("");
    searchInputRef.current?.blur();
  };
  const handleSignOut = async () => {
    setSigningOut(true);
    setAccountError("");
    try {
      await onSignOut?.();
      onItemClick();
    } catch {
      setAccountError("Unable to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  if (!visible) return null;
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={entryPoint === "search" ? "Player search" : "Site menu"}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input, summary, [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onItemClick();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onItemClick();
      }}
    >
      <div className={styles.shell}>
        <div className={styles.header}>
          <Image src={LOGO} alt="FHFH" width={88} height={28} />
          <span>{entryPoint === "search" ? "Player search" : "Menu"}</span>
          <button type="button" onClick={onItemClick} aria-label="Close menu">
            <NavigationIcon name="close" />
          </button>
        </div>
        <div className={styles.body}>
          {!searchMode && showAccountControls && accountUser && (
            <details className={styles.account}>
              <summary>
                <span className={styles.avatar}>
                  {accountUser.avatarUrl ? (
                    <img src={accountUser.avatarUrl} alt="" />
                  ) : (
                    initials
                  )}
                </span>
                <span className={styles.accountMeta}>
                  <strong>{accountTitle}</strong>
                  <small>Account & league settings</small>
                </span>
                <NavigationIcon name="chevron" />
              </summary>
              <div className={styles.accountActions}>
                <Link href="/account" onClick={onItemClick}>
                  Account Settings
                </Link>
                <Link
                  href="/account?section=league-settings"
                  onClick={onItemClick}
                >
                  League Settings
                </Link>
                <button
                  type="button"
                  className={styles.signOut}
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                >
                  {signingOut ? "Signing out…" : "Sign Out"}
                </button>
                {accountError && <p role="alert">{accountError}</p>}
              </div>
            </details>
          )}
          {!searchMode && showAuthButton && (
            <button
              type="button"
              className={styles.authButton}
              onClick={onAuthClick}
            >
              <NavigationIcon name="account" />
              Sign In / Sign Up
            </button>
          )}
          <div className={styles.searchSection}>
            <label htmlFor="navigation-player-search">Search players</label>
            <div className={styles.searchRow}>
              <div className={styles.inputWrap}>
                <NavigationIcon name="search" />
                <input
                  id="navigation-player-search"
                  ref={searchInputRef}
                  type="search"
                  autoComplete="off"
                  placeholder="Player name…"
                  value={searchQuery}
                  onFocus={() => setSearchMode(true)}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  aria-describedby="navigation-search-status"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear player search"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                  >
                    <NavigationIcon name="close" />
                  </button>
                )}
              </div>
              {searchMode && (
                <button
                  type="button"
                  className={styles.cancel}
                  onClick={leaveSearch}
                >
                  Cancel
                </button>
              )}
            </div>
            <p
              id="navigation-search-status"
              role="status"
              className={styles.searchStatus}
            >
              {searchMode &&
                (searchStatus === "loading"
                  ? "Searching…"
                  : searchStatus === "error"
                    ? "Unable to search players. Try again."
                    : searchStatus === "done"
                      ? searchResults.length
                        ? `${searchResults.length} players found`
                        : `No players found for “${searchQuery.trim()}”. Try another name.`
                      : "Enter at least two characters.")}
            </p>
            {searchMode && searchStatus === "error" && (
              <button
                type="button"
                className={styles.retry}
                onClick={() => setRetry((value) => value + 1)}
              >
                Try again
              </button>
            )}
            {searchMode && (
              <ul className={styles.results}>
                {searchResults.map((player) => (
                  <li key={player.id}>
                    <Link
                      href={`/stats/player/${player.id}`}
                      onClick={onItemClick}
                    >
                      {player.image_url ? (
                        <img src={player.image_url} alt="" />
                      ) : (
                        <NavigationIcon name="account" />
                      )}
                      <span>{player.fullName}</span>
                      <span aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!searchMode && (
            <nav aria-label="All destinations">
              <Link
                className={styles.home}
                href="/"
                aria-current={pathname === "/" ? "page" : undefined}
                onClick={onItemClick}
              >
                <NavigationIcon name="home" />
                {NAVIGATION_LINKS.home.label}
              </Link>
              {MOBILE_NAVIGATION_GROUPS.map((category) => (
                <section key={category.id} className={styles.category}>
                  <button
                    type="button"
                    ref={category.id === "tools" ? toolsRef : undefined}
                    className={styles.groupTrigger}
                    aria-expanded={expanded === category.id}
                    aria-controls={`mobile-${category.id}`}
                    onClick={() =>
                      setExpanded(expanded === category.id ? null : category.id)
                    }
                  >
                    <NavigationIcon name={category.icon} />
                    <span>
                      {category.label}
                      {expanded !== category.id && (
                        <small>{category.description}</small>
                      )}
                    </span>
                    <NavigationIcon name="chevron" />
                  </button>
                  <div
                    id={`mobile-${category.id}`}
                    hidden={expanded !== category.id}
                  >
                    <ul className={styles.links}>
                      {category.groups
                        .flatMap((group) => group.items)
                        .map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={onItemClick}
                              aria-current={
                                isNavigationLinkActive(pathname, item.href)
                                  ? "page"
                                  : undefined
                              }
                            >
                              <NavigationIcon name={item.icon} />
                              <span>{item.label}</span>
                              {isNavigationLinkActive(pathname, item.href) && (
                                <small>Current</small>
                              )}
                            </Link>
                          </li>
                        ))}
                    </ul>
                    {category.id === "community" && (
                      <div className={styles.community}>
                        <p>Follow & connect</p>
                        <SocialMedias labeled />
                        <a
                          className={styles.support}
                          href={SUPPORT_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <NavigationIcon name="heart" />
                          Support FHFH
                        </a>
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </nav>
          )}
        </div>
      </div>
    </dialog>
  );
}
export default MobileMenu;
