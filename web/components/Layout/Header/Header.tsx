// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/Layout/Header/Header.tsx

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import classNames from "classnames";
import { useRouter } from "next/router";

import useHideableNavbar from "hooks/useHideableNavbar";
import MobileMenu from "components/Layout/MobileMenu";
import NavbarItems from "components/Layout/NavbarItems";
import ITEMS_DATA from "components/Layout/NavbarItems/NavbarItemsData";
import ClientOnly from "components/ClientOnly";
import SocialMedias from "components/SocialMedias";
import AuthModal from "components/auth/AuthModal";
import UserMenu from "components/auth/UserMenu";
import { useAuth } from "contexts/AuthProviderContext";
import supabase from "lib/supabase/client";

import styles from "./Header.module.scss";
// import LOGO from "public/pictures/logo3.png";
// import LOGO from "public/pictures/fhfh-italic-2.png";
import LOGO from "public/pictures/FHFHonly.png";
import UNDERLYING_STATS_LOGO from "public/pictures/ULSlogo.png";
//         src="/pictures/logo-fhfh.svg"

// Bottom Navigation Items
const BOTTOM_NAV_ITEMS = [
  {
    id: "home",
    label: "Home",
    href: "/",
    icon: "/pictures/homeNavIcon.png"
  },
  {
    id: "gameGrid",
    label: "Game Grid",
    href: "/game-grid",
    icon: "/pictures/gameGrid.png"
  },
  {
    id: "stats",
    label: "Stats",
    href: "/stats",
    icon: "/pictures/statsIcon.png"
  },
  {
    id: "lines",
    label: "Lines",
    href: "/lines",
    icon: "/pictures/lineCombosIcon.png"
  },
  {
    id: "more",
    label: "More",
    href: "#",
    icon: "/pictures/hamburgerMenu.png"
  }
];

function BottomNavigation({ onMoreClick }: { onMoreClick: () => void }) {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [supportsDynamicVH, setSupportsDynamicVH] = useState(false);

  // Fallback for browsers that don't fully support CSS dynamic viewport units
  // Listen to visualViewport changes and adjust translateY so the nav clamps
  // to the visible bottom when URL bars expand/collapse.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supports =
      typeof CSS !== "undefined" && CSS.supports?.("height: 100dvh");
    setSupportsDynamicVH(!!supports);
    // Use visualViewport (when available) to compute a tiny runtime offset that
    // nudges the bar exactly flush with the visible bottom. We do this even when
    // dvh is supported, as Safari sometimes leaves a fractional gap due to rounding.
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;

    const handler = () => {
      const bottomInset =
        (window as any).innerHeight - vv.height - vv.offsetTop;
      // ceil to avoid tiny fractional gaps from subpixel rounding
      setOffset(Math.max(0, Math.ceil(bottomInset)));
    };
    handler();
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
      window.removeEventListener("orientationchange", handler);
    };
  }, []);

  const handleNavClick = (item: (typeof BOTTOM_NAV_ITEMS)[0]) => {
    if (item.id === "more") {
      onMoreClick();
    }
    // For other items, Link component handles navigation
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return router.pathname === "/";
    }
    return router.pathname.startsWith(href);
  };

  // Inline style drives a CSS custom property used by the CSS transform when dvh is supported.
  const navStyle: React.CSSProperties | undefined = supportsDynamicVH
    ? // dvh path: expose --vv-offset to CSS so it can add a tiny nudge if needed
      ({ ["--vv-offset" as any]: `${Math.max(0, offset)}px` } as any)
    : // no-dvh path: directly translate by the computed offset
      offset
      ? { transform: `translateY(-${offset}px)` }
      : undefined;

  return (
    <nav className={styles.bottomNav} style={navStyle}>
      <div className={styles.bottomNavContainer}>
        {BOTTOM_NAV_ITEMS.map((item) => (
          <div key={item.id} className={styles.bottomNavItem}>
            {item.id === "more" ? (
              <button
                onClick={() => handleNavClick(item)}
                className={classNames(
                  styles.bottomNavButton,
                  styles.moreButton
                )}
                aria-label={item.label}
              >
                <div className={styles.bottomNavIcon}>
                  <Image
                    src={item.icon}
                    alt={item.label}
                    width={20}
                    height={20}
                  />
                </div>
                <span className={styles.bottomNavLabel}>{item.label}</span>
              </button>
            ) : (
              <Link
                href={item.href}
                className={classNames(styles.bottomNavButton, {
                  [styles.active]: isActive(item.href)
                })}
              >
                <div className={styles.bottomNavIcon}>
                  <Image
                    src={item.icon}
                    alt={item.label}
                    width={20}
                    height={20}
                  />
                </div>
                <span className={styles.bottomNavLabel}>{item.label}</span>
              </Link>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

function BurgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.burgerButton} onClick={onClick}>
      <Image
        src="/pictures/hamburgerMenu.svg"
        alt="menu"
        width={24}
        height={16}
      />
    </button>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { navbarRef, isNavbarVisible } = useHideableNavbar();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isUnderlyingStatsRoute =
    router.pathname.startsWith("/underlying-stats");

  // When taking automated screenshots, append ?isScreenshot=1 to the URL
  // to hide mobile-only UI like the bottom nav. This avoids layout overlays
  // regardless of viewport size the screenshot tool uses.
  const isScreenshot = (() => {
    const q = router?.query ?? {};
    const raw = (q.isScreenshot || q.screenshot || q.capture) as
      | string
      | string[]
      | undefined;
    const val = Array.isArray(raw) ? raw[0] : raw;
    return val === "1" || val === "true";
  })();

  const onItemClick = () => {
    setTimeout(() => {
      setMenuOpen(false);
    }, 200);
  };

  const handleMobileAuthClick = () => {
    setMenuOpen(false);
    setAuthModalOpen(true);
  };

  const handleMobileSignOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  return (
    <>
      {/* Desktop Header */}
      <header
        ref={navbarRef}
        className={classNames(styles.header, styles.desktopHeader, {
          [styles.hidden]: menuOpen ? false : !isNavbarVisible
        })}
      >
        {/* logo */}
        <Link
          href="/"
          className={classNames(styles.logo, {
            [styles.underlyingStatsLogo]: isUnderlyingStatsRoute
          })}
        >
          {/* Main Logo Image */}
          <Image
            src={isUnderlyingStatsRoute ? UNDERLYING_STATS_LOGO : LOGO}
            alt="FHFH logo"
            placeholder="blur"
            width={isUnderlyingStatsRoute ? 270 : 110}
            height={isUnderlyingStatsRoute ? 35 : 30}
            priority
          />
        </Link>

        {/* nav bar items */}
        <ClientOnly className={styles.nav}>
          <NavbarItems
            items={ITEMS_DATA}
            onItemClick={onItemClick}
            className={
              isUnderlyingStatsRoute ? styles.underlyingStatsNavTheme : undefined
            }
          />
        </ClientOnly>

        {/* social medias */}
        <div className={styles.socials}>
          <SocialMedias
            className={
              isUnderlyingStatsRoute ? styles.underlyingStatsSocialsTheme : undefined
            }
          />
        </div>

        {/* Buy Me a Coffee */}
        <div
          className={classNames(styles.bmcWrap, {
            [styles.underlyingStatsBmcWrap]: isUnderlyingStatsRoute
          })}
        >
          <a
            href="https://www.buymeacoffee.com/tjsusername"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buy me a coffee"
          >
            <img
              src={`https://img.buymeacoffee.com/button-api/?text=Support&emoji=%F0%9F%A5%83&slug=tjsusername&button_colour=${
                isUnderlyingStatsRoute ? "DBA507" : "07aae2"
              }&font_colour=000000&font_family=Poppins&outline_colour=000000&coffee_colour=FFDD00`}
              alt="Buy me a coffee"
            />
          </a>
        </div>

        {!user && !isLoading ? (
          <button
            type="button"
            className={classNames(styles.authCta, {
              [styles.underlyingStatsAuthCta]: isUnderlyingStatsRoute
            })}
            onClick={() => setAuthModalOpen(true)}
          >
            Sign-in / Sign-up
          </button>
        ) : user ? (
          <UserMenu />
        ) : (
          <div className={styles.authCtaPlaceholder} aria-hidden="true" />
        )}

        {/* join button */}
        <button className={styles.join}>JOIN COMMUNITY</button>

        {/* burger menu - mobile only (fallback) */}
        {!menuOpen ? (
          <BurgerButton
            onClick={() => {
              setMenuOpen(true);
            }}
          />
        ) : (
          <button
            type="button"
            className={styles.menuToggleButton}
            onClick={() => setMenuOpen(false)}
          >
            <Image
              src="/pictures/close.svg"
              alt="close menu"
              width={22}
              height={22}
            />
          </button>
        )}
      </header>

      {/* Mobile Bottom Navigation (hidden during screenshots via ?isScreenshot=1) */}
      {!isScreenshot && (
        <ClientOnly>
          <div className={styles.mobileNavWrapper}>
            <BottomNavigation onMoreClick={() => setMenuOpen(!menuOpen)} />
          </div>
        </ClientOnly>
      )}

      <ClientOnly>
        <MobileMenu
          visible={menuOpen}
          onItemClick={onItemClick}
          onAuthClick={handleMobileAuthClick}
          onSignOut={handleMobileSignOut}
          accountUser={user}
          showAccountControls={Boolean(user) && !isLoading}
          showAuthButton={!user && !isLoading}
        />
      </ClientOnly>

      <ClientOnly>
        <AuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
        />
      </ClientOnly>
    </>
  );
}

export default Header;
