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

function MobileMenu({ onItemClick, visible }: MobileMenuProps) {
  const transitions = useTransition(visible, {
    from: {
      opacity: 0,
      transform: "translateY(300px)"
    },
    enter: {
      opacity: 1,
      transform: "translateY(0px)"
    },
    leave: {
      opacity: 0,
      transform: "translateY(300px)"
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
      {
        transitions((style, show) =>
          show ? (
            <animated.div className={styles.menu} style={style}>
              … contents …
            </animated.div>
          ) : null
        ) as React.ReactNode
      }
    </>
  );
}

export default MobileMenu;
