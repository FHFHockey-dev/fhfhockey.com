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

function SocialMedias() {
  return (
    <div className={styles.socialMedias}>
      <a
        href="https://www.twitter.com/fhfhockey"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/white-twitter.png"
          alt="Twitter"
          width={32}
          height={28}
        />
      </a>
      <a
        href="https://discord.gg/kfnyrn7"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/white-discord.png"
          alt="Discord"
          width={38}
          height={28}
        />
      </a>
      <a
        href="https://www.patreon.com/FHFHRadio"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/white-patreon.png"
          alt="Patreon"
          width={28}
          height={28}
        />
      </a>
      <a
        href="https://www.youtube.com/fiveholefantasyhockey"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/white-youtube.png"
          alt="Youtube"
          width={28}
          height={28}
        />
      </a>
      <a
        href="https://open.spotify.com/show/0tcyfS62ZHdLYA3Xf3QgSQ?si=HtfgMe8_QD6KfwiOw2fC1g"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/white-spotify.png"
          alt="Spotify"
          width={28}
          height={28}
        />
      </a>
    </div>
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
              <span
                className={styles.highlight}
                onClick={() => router.push("/")}
              >
                Five Hole
              </span>{" "}
              Fantasy Hockey
            </h1>
          </div>

          <SocialMedias />
          {/* Only show the buger button in small screen */}
          <BurgerButton
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
