import React, { useEffect } from "react";

import { Footer } from "components/Layout/Layout";
import SocialMedias from "components/SocialMedias";
import NavbarItems from "../NavbarItems";
import ITEMS_DATA from "components/Layout/navbarItems";

import styles from "./MobileMenu.module.scss";

type MobileMenuProps = {
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

function MobileMenu({ setMenuOpen }: MobileMenuProps) {
  // prevent scroll penetration
  useEffect(() => {
    document
      .getElementsByTagName("body")[0]
      .setAttribute("style", "overflow: hidden;");
    return () => {
      document
        .getElementsByTagName("body")[0]
        .setAttribute("style", "overflow: visible;");
    };
  });
  return (
    <div className={styles.menu}>
      <NavbarItems
        items={ITEMS_DATA}
        onItemClick={() => {
          setTimeout(() => {
            setMenuOpen(false);
          }, 200);
        }}
      />

      <div>
        {/* social medias */}
        <SocialMedias />
        {/* join button */}
        <button className={styles.join}>JOIN COMMUNITY</button>
        <Footer />
      </div>
    </div>
  );
}

export default MobileMenu;
