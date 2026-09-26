import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import classNames from "classnames";
import { useRouter } from "next/router";
import MobileMenu from "components/Layout/MobileMenu";
import NavbarItems from "components/Layout/NavbarItems";
import ITEMS_DATA, {
  isNavigationLinkActive,
  MOBILE_NAVIGATION_GROUPS,
  NAVIGATION_LINKS,
  SUPPORT_URL,
} from "components/Layout/NavbarItems/NavbarItemsData";
import AuthModal from "components/auth/AuthModal";
import UserMenu from "components/auth/UserMenu";
import { useAuth } from "contexts/AuthProviderContext";
import NavigationIcon from "../NavigationIcon";
import styles from "./Header.module.scss";
import LOGO from "public/pictures/FHFHonly.png";
import UNDERLYING_STATS_LOGO from "public/pictures/ULSlogo.png";

function BottomNavigation({
  onToolsClick,
  onMoreClick,
}: {
  onToolsClick: () => void;
  onMoreClick: () => void;
}) {
  const { pathname } = useRouter();
  const [hidden, setHidden] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setHidden(false);
    let previous = window.scrollY;
    const onScroll = () => {
      const next = Math.max(0, window.scrollY);
      if (next <= 24) setHidden(false);
      else if (Math.abs(next - previous) < 8) return;
      else
        setHidden(
          next > previous && !navRef.current?.contains(document.activeElement),
        );
      previous = next;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);
  const toolsActive = MOBILE_NAVIGATION_GROUPS.find(
    (group) => group.id === "tools",
  )!.groups.some((group) =>
    group.items.some(
      (link) =>
        link.href !== "/game-grid" &&
        isNavigationLinkActive(pathname, link.href),
    ),
  );
  return (
    <nav
      ref={navRef}
      aria-label="Primary mobile navigation"
      className={classNames(styles.bottomNav, {
        [styles.bottomNavHidden]: hidden,
      })}
      onFocus={() => setHidden(false)}
    >
      {[
        NAVIGATION_LINKS.home,
        NAVIGATION_LINKS.gameGrid,
        NAVIGATION_LINKS.stats,
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={styles.bottomNavButton}
          aria-current={
            isNavigationLinkActive(pathname, item.href) ? "page" : undefined
          }
        >
          <NavigationIcon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
      <button
        type="button"
        className={classNames(styles.bottomNavButton, {
          [styles.active]: toolsActive,
        })}
        onClick={onToolsClick}
        aria-haspopup="dialog"
      >
        <NavigationIcon name="tools" />
        <span>Tools</span>
      </button>
      <button
        type="button"
        className={styles.bottomNavButton}
        onClick={onMoreClick}
        aria-haspopup="dialog"
      >
        <NavigationIcon name="menu" />
        <span>Menu</span>
      </button>
    </nav>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuEntryPoint, setMenuEntryPoint] = useState<
    "default" | "tools" | "search"
  >("default");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const isUnderlyingStatsRoute =
    router.pathname.startsWith("/underlying-stats");
  const rawScreenshot =
    router.query?.isScreenshot ||
    router.query?.screenshot ||
    router.query?.capture;
  const screenshot = Array.isArray(rawScreenshot)
    ? rawScreenshot[0]
    : rawScreenshot;
  const isScreenshot = screenshot === "1" || screenshot === "true";
  const onItemClick = useCallback(() => setMenuOpen(false), []);
  const openMobileMenu = (entryPoint: "default" | "tools" | "search") => {
    setMenuEntryPoint(entryPoint);
    setMenuOpen(true);
  };
  const handleMobileAuthClick = () => {
    setMenuOpen(false);
    setAuthModalOpen(true);
  };
  const handleMobileSignOut = async () => {
    await signOut();
    setMenuOpen(false);
  };

  return (
    <>
      <header
        className={classNames(styles.desktopHeader, {
          [styles.underlyingStats]: isUnderlyingStatsRoute,
        })}
      >
        <Link href="/" className={styles.logo} aria-label="FHFH home">
          <Image
            src={isUnderlyingStatsRoute ? UNDERLYING_STATS_LOGO : LOGO}
            alt={isUnderlyingStatsRoute ? "Underlying Stats" : "FHFH"}
            width={isUnderlyingStatsRoute ? 154 : 106}
            height={32}
            priority
          />
          {!isUnderlyingStatsRoute && <span>Hockey Analytics</span>}
        </Link>
        <NavbarItems items={ITEMS_DATA} onItemClick={onItemClick} />
        <div className={styles.utilities}>
          <button
            type="button"
            className={styles.utility}
            onClick={() => openMobileMenu("search")}
            aria-label="Search players"
            aria-haspopup="dialog"
          >
            <NavigationIcon name="search" />
            <span>Search players</span>
          </button>
          <a
            className={styles.utility}
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support FHFH"
          >
            <NavigationIcon name="heart" />
            <span>Support</span>
          </a>
          {!user && !isLoading ? (
            <button
              type="button"
              className={styles.authCta}
              onClick={() => setAuthModalOpen(true)}
            >
              Sign In / Sign Up
            </button>
          ) : user ? (
            <UserMenu />
          ) : (
            <div className={styles.authPlaceholder} aria-hidden="true" />
          )}
        </div>
      </header>
      <header className={styles.mobileHeader}>
        <button
          type="button"
          className={styles.mobileHeaderAction}
          onClick={() => openMobileMenu("default")}
          aria-label="Open menu"
          aria-haspopup="dialog"
        >
          <NavigationIcon name="menu" />
        </button>
        <Link href="/" className={styles.mobileLogo} aria-label="FHFH home">
          <Image src={LOGO} alt="FHFH" width={88} height={28} priority />
        </Link>
        <button
          type="button"
          className={styles.mobileHeaderAction}
          onClick={() => openMobileMenu("search")}
          aria-label="Search players"
          aria-haspopup="dialog"
        >
          <NavigationIcon name="search" />
        </button>
      </header>
      {!isScreenshot && (
        <BottomNavigation
          onToolsClick={() => openMobileMenu("tools")}
          onMoreClick={() => openMobileMenu("default")}
        />
      )}
      <MobileMenu
        visible={menuOpen}
        entryPoint={menuEntryPoint}
        onItemClick={onItemClick}
        onAuthClick={handleMobileAuthClick}
        onSignOut={handleMobileSignOut}
        accountUser={user}
        showAccountControls={Boolean(user) && !isLoading}
        showAuthButton={!user && !isLoading}
      />
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
export default Header;
