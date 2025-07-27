import React, { useEffect } from "react";
import { animated, useTransition } from "@react-spring/web";

import { Footer } from "components/Layout/Layout";
import SocialMedias from "components/SocialMedias";
import NavbarItems from "../NavbarItems";
import ITEMS_DATA from "components/Layout/NavbarItems/NavbarItemsData";

import styles from "./MobileMenu.module.scss";

type MobileMenuProps = {
  onItemClick: () => void;
  visible: boolean;
};

// Filter out main nav items that are now in the FAB bubbles
const MENU_ITEMS = ITEMS_DATA.filter((item) => {
  if (item.type === "link") {
    return !["/", "/game-grid", "/stats", "/lines"].includes(item.href);
  }
  return true; // Keep categories
});

function MobileMenu({ onItemClick, visible }: MobileMenuProps) {
  const transitions = useTransition(visible, {
    from: {
      opacity: 0,
      transform: "translateY(100%)"
    },
    enter: {
      opacity: 1,
      transform: "translateY(0%)"
    },
    leave: {
      opacity: 0,
      transform: "translateY(100%)"
    },
    config: {
      tension: 280,
      friction: 60
    }
  });

  // Prevent scroll when menu is open
  useEffect(() => {
    const body = document.getElementsByTagName("body")[0];
    if (visible) {
      body.style.overflow = "hidden";
    } else {
      body.style.overflow = "visible";
    }
    return () => {
      body.style.overflow = "visible";
    };
  }, [visible]);

  return (
    <>
      {transitions((style, show) =>
        show ? (
          <animated.div className={styles.menu} style={style}>
            <div className={styles.menuHeader}>
              <h2 className={styles.menuTitle}>Advanced Options</h2>
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
