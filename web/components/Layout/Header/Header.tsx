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

function BurgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.burgerButton} onClick={onClick}>
      <Image src="/pictures/burgerMenu.svg" alt="menu" width={24} height={16} />
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
      <header
        ref={navbarRef}
        className={classNames(styles.header, {
          // don't hide the nav bar when the menu is open
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

        {/* burger menu - mobile only */}
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
      <ClientOnly>
        <MobileMenu visible={menuOpen} onItemClick={onItemClick} />
      </ClientOnly>
    </>
  );
}

export default Header;
