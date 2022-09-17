import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import classNames from "classnames";
import useHideableNavbar from "hooks/useHideableNavbar";

import styles from "./Layout.module.scss";
import MobileMenu from "components/MobileMenu";

type LayoutProps = {
  children: React.ReactNode;
};

function BurgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.burgerButton} onClick={onClick}>
      <Image src="/pictures/burgerMenu.svg" alt="menu" width={24} height={16} />
    </button>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Image
        src="/pictures/logo-fhfh.svg"
        alt="FHFH logo"
        width={80}
        height={24}
      />
    </footer>
  );
}

function Layout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { navbarRef, isNavbarVisible } = useHideableNavbar();

  return (
    <div className={styles.container}>
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
      <main className={styles.pageContent}>{children}</main>

      <Footer />
    </div>
  );
}
export default Layout;
