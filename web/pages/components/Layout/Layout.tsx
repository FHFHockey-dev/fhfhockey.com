import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import classNames from "classnames";

import styles from "./Layout.module.css";

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

function Layout({ children }: LayoutProps) {
  const router = useRouter();
  console.log(router.pathname);

  return (
    <div className={styles.container}>
      <div className={styles.navBarLeftSide}>
        <nav>
          <ul>
            {/* Links in Nav Bar ("currentPage" on whichever page you're on) -----------*/}
            <li> Test </li>
            <li> Test </li>
            <li> Test </li>
          </ul>
        </nav>
      </div>
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <div id="branding">
              <h1>
                <span className={styles.highlight}>Five Hole</span> FANTASY
                HOCKeY
              </h1>
            </div>
          </div>
        </header>
        {children}
      </div>

      <div className={styles.navBarRightSide}>
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
      </div>
    </div>
  );
}

export default Layout;
