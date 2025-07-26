// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/Layout/Header/Header.tsx

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import classNames from "classnames";

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

// Modern Bottom Navigation Icons
const BOTTOM_NAV_ITEMS = [
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
  { id: "home", label: "Home", href: "/", icon: "/pictures/homeNavIcon.png" },
  {
    id: "lines",
    label: "Lines",
    href: "/lines",
    icon: "/pictures/lineCombosIcon.png"
  },
  { id: "more", label: "More", href: "#", icon: "/pictures/hamburgerMenu.png" }
];

// Position percentages for 10%, 30%, 50%, 70%, 90%
const POSITIONS = [10, 30, 50, 70, 90];

function ModernBottomNav({ onMoreClick }: { onMoreClick: () => void }) {
  const [activeItem, setActiveItem] = useState("home"); // Default to Home (center position)
  const [showIndicatorIcon, setShowIndicatorIcon] = useState(true);
  const { navbarRef, isNavbarVisible } = useHideableNavbar();

  const handleItemClick = (itemId: string) => {
    // Hide indicator icon during transition
    setShowIndicatorIcon(false);

    // Small delay then change active item
    setTimeout(() => {
      setActiveItem(itemId);
      if (itemId === "more") {
        onMoreClick();
      }
    }, 100);

    // Show indicator icon after transition completes
    setTimeout(() => {
      setShowIndicatorIcon(true);
    }, 400);
  };

  const activeIndex = BOTTOM_NAV_ITEMS.findIndex(
    (item) => item.id === activeItem
  );

  // Calculate positions - indicator should align with the actual icon position
  const indicatorPosition = POSITIONS[activeIndex] || 50;

  // Calculate SVG positioning for proper cutout alignment
  // The SVG cutout is at approximately x=895 in a 1789px wide viewBox (50%)
  // When home icon (index 2, 50% position) is active, SVG should be perfectly centered

  // Calculate the offset from center position (50%)
  const iconOffsetFromCenter = indicatorPosition - 50; // -40, -20, 0, 20, 40 for positions 10,30,50,70,90

  // The SVG needs to move in the SAME direction as the icon to keep cutout aligned
  // When home (50%) is active, offset = 0, so SVG stays centered
  // When left icons are active (negative offset), SVG moves left (negative translation)
  // When right icons are active (positive offset), SVG moves right (positive translation)
  const svgTranslateX = iconOffsetFromCenter * 0.4; // Split the difference: (0.3 + 0.5) / 2 = 0.4

  const cutoutPosition = 50 + svgTranslateX; // Start from center (50%) and adjust

  // Calculate label positioning - should be offset from indicator to the side
  // For center position (home), offset the label slightly to avoid being directly behind indicator
  let labelOffset = 0;
  if (activeIndex === 0) {
    // Game Grid (leftmost)
    labelOffset = 15; // Move closer to center
  } else if (activeIndex === 1) {
    // Stats
    labelOffset = 0; // Good position
  } else if (activeIndex === 2) {
    // Home (center)
    labelOffset = -25; // Move to the left to avoid being behind indicator
  } else if (activeIndex === 3) {
    // Lines
    labelOffset = 0; // Good position
  } else if (activeIndex === 4) {
    // More (rightmost)
    labelOffset = -15; // Move closer to center
  }

  const labelPosition = `${indicatorPosition + labelOffset}%`;

  return (
    <div
      ref={navbarRef}
      className={classNames(styles.bottomNav, {
        [styles.hidden]: !isNavbarVisible
      })}
      style={
        {
          "--indicator-position": `${indicatorPosition}%`,
          "--cutout-position": `${cutoutPosition}%`,
          "--label-position": labelPosition
        } as React.CSSProperties
      }
    >
      {/* White strip at top */}

      {/* Blue curved section */}
      <div className={styles.ribbonContainer} />

      {/* SVG for the complex shape */}
      <svg
        className={styles.navbarShape}
        viewBox="0 0 1789 140"
        preserveAspectRatio="none"
        style={
          {
            "--cutout-position": `${cutoutPosition}%`
          } as React.CSSProperties
        }
        shapeRendering="geometricPrecision"
      >
        {/* Blue background path with completely smooth curves */}
        <path
          fill="#07AAE2"
          opacity="1.000000"
          stroke="none"
          d="
M 1,119
C 1,80 1,40 1,1
L 800,1
C 805,1 810,3 815,8
C 825,18 832,32 838,47
C 845,65 858,78 875,82
C 892,86 909,84 924,78
C 935,73 944,65 950,54
C 955,45 958,35 962,25
C 968,10 978,2 990,1
L 1790,1
L 1790,119
C 1785,130 1775,138 1760,140
L 30,140
C 15,138 5,130 1,119
Z"
        />

        {/* White border with smooth curves */}
        <path
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="
M 1,1
L 800,1
C 805,1 810,3 815,8
C 825,18 832,32 838,47
C 845,65 858,78 875,82
C 892,86 909,84 924,78
C 935,73 944,65 950,54
C 955,45 958,35 962,25
C 968,10 978,2 990,1
L 1790,1"
        />

        {/* Additional thick top border for flat sections extending upward */}
        <rect x="1" y="-2" width="799" height="4" fill="white" />
        <rect x="990" y="-2" width="800" height="4" fill="white" />
      </svg>

      {/* Page label - now positioned underneath the indicator */}
      <div
        className={styles.pageLabel}
        style={{
          left: `calc(${indicatorPosition}% - 50px)`
        }}
      >
        {BOTTOM_NAV_ITEMS[activeIndex]?.label || "Home"}
      </div>

      {/* Navigation items */}
      <ul>
        {BOTTOM_NAV_ITEMS.map((item, index) => (
          <li
            key={item.id}
            className={classNames(styles.navItem, {
              [styles.active]: activeItem === item.id
            })}
          >
            {item.id === "more" ? (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleItemClick(item.id);
                }}
              >
                <span className={styles.icon}>
                  <Image
                    src={item.icon}
                    alt={item.label}
                    width={24}
                    height={24}
                  />
                </span>
                <span className={styles.text}>{item.label}</span>
              </a>
            ) : (
              <Link href={item.href} onClick={() => handleItemClick(item.id)}>
                <span className={styles.icon}>
                  <Image
                    src={item.icon}
                    alt={item.label}
                    width={24}
                    height={24}
                  />
                </span>
                <span className={styles.text}>{item.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>

      {/* Floating indicator circle */}
      <div
        className={classNames(styles.indicator, {
          [styles.showIcon]: showIndicatorIcon
        })}
      >
        {BOTTOM_NAV_ITEMS[activeIndex] && (
          <Image
            className={styles.indicatorIcon}
            src={BOTTOM_NAV_ITEMS[activeIndex].icon}
            alt={BOTTOM_NAV_ITEMS[activeIndex].label}
            width={26}
            height={26}
          />
        )}
      </div>
    </div>
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

      {/* Modern Mobile Bottom Navigation */}
      <ClientOnly>
        <div className={styles.mobileNavWrapper}>
          <ModernBottomNav onMoreClick={() => setMenuOpen(!menuOpen)} />
        </div>
      </ClientOnly>

      <ClientOnly>
        <MobileMenu visible={menuOpen} onItemClick={onItemClick} />
      </ClientOnly>
    </>
  );
}

export default Header;
