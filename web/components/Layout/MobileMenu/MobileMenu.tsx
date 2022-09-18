import React, { useEffect } from "react";

import { Footer } from "components/Layout/Layout";
import SocialMedias from "components/SocialMedias";
import NavbarItems from "../NavbarItems";
import ITEMS_DATA from "components/Layout/navbarItems";

import styles from "./MobileMenu.module.scss";

type MobileMenuProps = {
  onItemClick: () => void;
};

function MobileMenu({ onItemClick }: MobileMenuProps) {
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
      <NavbarItems items={ITEMS_DATA} onItemClick={onItemClick} />

      <div>
        {/* social medias */}
        <div className={styles.socialMediasWrapper}>
          <SocialMedias />
        </div>
        {/* join button */}
        <button className={styles.join}>JOIN COMMUNITY</button>
        <Footer />
      </div>
    </div>
  );
}

export default MobileMenu;
