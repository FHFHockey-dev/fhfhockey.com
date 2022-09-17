import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import classNames from "classnames";

import useHideableNavbar from "hooks/useHideableNavbar";
import MobileMenu from "components/Layout/MobileMenu";
import styles from "./Header.module.scss";

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
  return (
    <>
      <header
        ref={navbarRef}
        className={classNames(styles.header, {
          // don't hide the nav bar when the menu is open
          [styles.hidden]: menuOpen ? false : !isNavbarVisible,
        })}
      >
        <Link href="/">
          <a>
            <Image
              src="/pictures/logo.svg"
              alt="FHFH logo"
              width={182}
              height={24}
            />
          </a>
        </Link>

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
      {menuOpen && <MobileMenu setMenuOpen={setMenuOpen} />}
    </>
  );
}

export default Header;
