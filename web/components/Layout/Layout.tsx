import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import classNames from "classnames";
import { slide as Menu } from "react-burger-menu";

import styles from "./Layout.module.scss";
import BurgerButton from "components/BurgerButton";

type LayoutProps = {
  children: React.ReactNode;
};

const links: { label: string; link: string }[] = [
  { label: "Home", link: "/" },
  { label: "Podcast", link: "/podfeed" },
  { label: "Lines", link: "/lines" },
  { label: "Game Grid", link: "/game-grid" },
  { label: "Stats", link: "/stats" },
  { label: "Charts", link: "/charts" },
  { label: "Blog", link: "/blog" },
];

type BurgerMenuProps = {
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pathname: string;
};

function BurgerMenu({ menuOpen, setMenuOpen, pathname }: BurgerMenuProps) {
  const bmStyles = {
    bmCrossButton: {
      height: "30px",
      width: "30px",
    },
    bmCross: {
      background: "#297FB0",
      width: "7px",
      height: "25px",
    },
    bmMenuWrap: {
      position: "fixed",
      height: "100%",
      width: "125px",
    },
    bmOverlay: {
      background: "rgba(0, 0, 0, 0.3)",
    },
  };
  return (
    <Menu
      isOpen={menuOpen}
      onStateChange={(state) => setMenuOpen(state.isOpen)}
      styles={bmStyles}
      menuClassName={styles.burgerMenu}
      burgerButtonClassName={styles.burgerButton}
      right
    >
      <aside className={styles.navBarRightSide}>
        <nav>
          <ul>
            {links.map(({ label, link }) => (
              <li
                key={link}
                // Links in Nav Bar ("currentPage" on whichever page you're on)
                className={classNames({
                  [styles.currentPage]: pathname === link,
                })}
              >
                <Link href={link}>
                  <a onClick={() => setMenuOpen(false)}>{label}</a>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.fhfhLogo}>
          <Image
            src="/pictures/circle.png"
            width={100}
            height={100}
            alt="FHFH"
          />
        </div>
      </aside>
    </Menu>
  );
}

function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.container}>
      {/* Main Content */}
      <div className={styles.content}>
        <BurgerMenu
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          pathname={router.pathname}
        />
        <header className={styles.header}>
          <div className={styles.branding}>
            <h1>
              <span className={styles.highlight}>Five Hole</span> Fantasy Hockey
            </h1>
          </div>
          <BurgerButton
            className={styles.realBurgerButton}
            onClick={() => {
              setMenuOpen(true);
            }}
          />
        </header>
        <main className={styles.pageContent}>{children}</main>
      </div>
      {/* Right Nav Bar */}
      <aside className={styles.navBarRightSide}>
        <nav>
          <ul>
            {links.map(({ label, link }) => (
              <li
                key={link}
                // Links in Nav Bar ("currentPage" on whichever page you're on)
                className={classNames({
                  [styles.currentPage]: router.pathname === link,
                })}
              >
                <Link href={link}>
                  <a>{label}</a>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.fhfhLogo}>
          <Image
            src="/pictures/circle.png"
            width={100}
            height={100}
            alt="FHFH"
          />
        </div>
      </aside>
    </div>
  );
}

export default Layout;
