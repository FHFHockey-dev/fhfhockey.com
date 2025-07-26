import React, { useEffect } from "react";
import { animated, useTransition, useSpring } from "@react-spring/web";

import { Footer } from "components/Layout/Layout";
import SocialMedias from "components/SocialMedias";
import NavbarItems from "../NavbarItems";
import ITEMS_DATA from "components/Layout/NavbarItems/NavbarItemsData";

import styles from "./MobileMenu.module.scss";

type MobileMenuProps = {
  onItemClick: () => void;
  visible: boolean;
};

// Filter out main nav items that are already in bottom nav
const MENU_ITEMS = ITEMS_DATA.filter((item) => {
  if (item.type === "link") {
    return !["/", "/game-grid", "/stats"].includes(item.href);
  }
  return true; // Keep categories
});

function MobileMenu({ onItemClick, visible }: MobileMenuProps) {
  const transitions = useTransition(visible, {
    from: {
      opacity: 0,
      transform: "translateY(100%)",
      backdropFilter: "blur(0px)"
    },
    enter: {
      opacity: 1,
      transform: "translateY(0%)",
      backdropFilter: "blur(10px)"
    },
    leave: {
      opacity: 0,
      transform: "translateY(100%)",
      backdropFilter: "blur(0px)"
    },
    config: {
      tension: 300,
      friction: 30
    }
  });

  // Submenu circle animation
  const circleSpring = useSpring({
    scale: visible ? 1 : 0,
    opacity: visible ? 1 : 0,
    config: {
      tension: 400,
      friction: 25
    }
  });

  // prevent scroll penetration
  useEffect(() => {
    const body = document.getElementsByTagName("body")[0];
    if (visible) {
      body.setAttribute("style", "overflow: hidden;");
    } else {
      body.setAttribute("style", "overflow: visible;");
    }
    return () => {
      body.setAttribute("style", "overflow: visible;");
    };
  }, [visible]);

  return (
    <>
      {transitions((style, show) =>
        show ? (
          <animated.div className={styles.menu} style={style}>
            {/* Submenu circle effect */}
            <animated.div
              className={styles.submenuCircle}
              style={{
                ...circleSpring,
                transform: circleSpring.scale.to((s) => `scale(${s})`)
              }}
            />

            <div className={styles.menuHeader}>
              <h2 className={styles.menuTitle}>More Options</h2>
              <button
                className={styles.closeButton}
                onClick={onItemClick}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <div className={styles.menuContent}>
              <NavbarItems items={MENU_ITEMS} onItemClick={onItemClick} />
            </div>

            <div className={styles.menuFooter}>
              <div className={styles.socialWrapper}>
                <SocialMedias />
              </div>
              <button className={styles.joinButton}>JOIN COMMUNITY</button>
              <Footer />
            </div>
          </animated.div>
        ) : null
      )}
    </>
  );
}

export default MobileMenu;
