import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import classNames from "classnames";
import useHideableNavbar from "hooks/useHideableNavbar";

import styles from "./Layout.module.scss";

type LayoutProps = {
  children: React.ReactNode;
};

// const links: { label: string; link: string }[] = [
//   { label: "Home", link: "/" },
//   { label: "Podcast", link: "/podfeed" },
//   { label: "Lines", link: "/lines" },
//   { label: "Game Grid", link: "/game-grid" },
//   { label: "Stats", link: "/stats" },
//   { label: "Charts", link: "/charts" },
//   { label: "Blog", link: "/blog" },
// ];

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

function BurgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.burgerButton} onClick={onClick}>
      <Image src="/pictures/burgerMenu.svg" alt="menu" width={24} height={16} />
    </button>
  );
}

function Footer() {
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

type MobileMenuProps = {
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
};
function MobileMenu({ setMenuOpen }: MobileMenuProps) {
  return (
    <div className={styles.menu} onClick={() => setMenuOpen(false)}>
      <nav>
        {/* links */}
        <ul>
          <li>HOME</li>
          <li>PODCAST</li>
        </ul>
      </nav>

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
