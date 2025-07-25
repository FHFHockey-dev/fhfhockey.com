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

  // Calculate SVG position to align the center of the SVG cutout with the active icon
  // SVG is 1154.16px wide, navbar is 100% of screen width
  // We need to center the SVG and then shift it based on icon position
  const svgWidth = 1154.16; // SVG width in pixels
  const screenWidth = 375; // Approximate mobile screen width in pixels

  // Calculate the percentage difference between SVG width and screen width
  const svgWidthPercentage = (svgWidth / screenWidth) * 100; // ~308%
  const screenWidthPercentage = 100; // 100%
  const widthDifference = svgWidthPercentage - screenWidthPercentage; // ~208%

  // Calculate how much to shift the SVG based on the active icon position
  // POSITIONS: [10, 30, 50, 70, 90] - HOME is at 50% (center)
  const iconOffsetFromCenter = (POSITIONS[activeIndex] || 50) - 50; // How far from center
  const shiftPercentage = (iconOffsetFromCenter / 100) * widthDifference;

  // Start with SVG centered (50% - 50% of SVG width), then apply shift
  const svgCenterOffset = svgWidthPercentage / 2 - 50; // How much to offset to center SVG
  const cutoutPosition = 50 - svgCenterOffset + shiftPercentage;

  // Calculate label positioning
  // For first 2 items (0,1), label appears to the right of cutout
  // For center item (2), label appears centered
  // For last 2 items (3,4), label appears to the left of cutout
  const isLabelOnLeft = activeIndex >= 3;
  const isLabelCentered = activeIndex === 2;
  const labelPosition = isLabelCentered
    ? `${cutoutPosition}%` // Centered
    : isLabelOnLeft
      ? `calc(${cutoutPosition}% - 32.5px - 60px)` // Left of cutout
      : `calc(${cutoutPosition}% + 32.5px + 50px)`; // Right of cutout + extra offset

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
      {/* Page label */}
      <div
        className={styles.pageLabel}
        data-label={BOTTOM_NAV_ITEMS[activeIndex]?.label || "Home"}
      />

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
      >
        {/* Blue background path */}
        <path
          fill="#07AAE2"
          opacity="1.000000"
          stroke="none"
          d="
M1.000000,119.000000 
	C1.000000,79.684402 1.000000,40.368801 1.000000,1.000000 
	C269.028046,1.000000 537.056091,1.000000 805.201660,1.267194 
	C805.780457,1.986147 806.163025,2.667813 806.714233,2.856088 
	C820.753357,7.651394 830.048096,17.559589 836.107422,30.661118 
	C838.656860,36.173618 840.040466,42.215935 842.439453,47.809181 
	C848.814209,62.671787 860.526306,71.816513 875.449097,76.916573 
	C888.167175,81.263161 901.173767,81.273674 914.067017,77.429115 
	C924.446838,74.334007 933.622864,68.876457 940.558594,60.624645 
	C946.362549,53.719479 950.413574,45.735004 952.872559,36.738556 
	C957.316223,20.481138 967.936035,9.258551 983.651001,2.936553 
	C984.261536,2.690965 984.557495,1.663263 985.000000,0.999997 
	C1253.212402,1.000000 1521.424683,1.000000 1790.000000,1.000000 
	C1790.000000,40.027279 1790.000000,79.055687 1789.822754,118.210938 
	C1789.250000,118.781006 1788.691650,119.158913 1788.483765,119.677345 
	C1785.412354,127.338448 1781.302490,134.025589 1773.226685,137.469757 
	C1771.892090,138.039017 1771.062866,139.793381 1770.000000,141.000031 
	C1188.305298,141.000000 606.610596,141.000000 24.798695,140.725876 
	C24.359175,140.071457 24.100630,139.450836 23.705250,139.345932 
	C13.056134,136.520355 6.132089,129.832504 2.721788,119.387680 
	C2.628369,119.101562 1.595038,119.122337 1.000000,119.000000 
z"
        />
      </svg>

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
