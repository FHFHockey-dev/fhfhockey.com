// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/Layout/Header/Header.tsx

import React, { useState } from "react";
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

import styles from "./Header.module.scss";
// import LOGO from "public/pictures/logo3.png";
// import LOGO from "public/pictures/fhfh-italic-2.png";
import LOGO from "public/pictures/FHFHonly.png";
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

  return (
    <nav className={styles.bottomNav}>
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
  const { navbarRef, isNavbarVisible } = useHideableNavbar();

  const onItemClick = () => {
    setTimeout(() => {
      setMenuOpen(false);
    }, 200);
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
        <Link href="/" className={styles.logo}>
          <Image
            src={LOGO}
            alt="FHFH logo"
            placeholder="blur"
            width={110}
            height={30}
            priority
          />
        </Link>

        {/* nav bar items */}
        <ClientOnly className={styles.nav}>
          <NavbarItems items={ITEMS_DATA} onItemClick={onItemClick} />
        </ClientOnly>

        {/* social medias */}
        <div className={styles.socials}>
          <SocialMedias />
        </div>

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
          <button onClick={() => setMenuOpen(false)}>
            <Image
              src="/pictures/close.svg"
              alt="close menu"
              width={22}
              height={22}
            />
          </button>
        )}
      </header>

      {/* Mobile Bottom Navigation */}
      <ClientOnly>
        <div className={styles.mobileNavWrapper}>
          <BottomNavigation onMoreClick={() => setMenuOpen(!menuOpen)} />
        </div>
      </ClientOnly>

      <ClientOnly>
        <MobileMenu visible={menuOpen} onItemClick={onItemClick} />
      </ClientOnly>
    </>
  );
}

export default Header;
