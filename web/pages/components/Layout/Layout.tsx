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

  return (
    <div className={styles.container}>
      {/* Main Content */}
      <main className={styles.content}>
        <header className={styles.header}>
          <div className={styles.branding}>
            <h1>
              <span className={styles.highlight}>Five Hole</span> Fantasy Hockey
            </h1>
          </div>
        </header>
        {children}
      </main>
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
