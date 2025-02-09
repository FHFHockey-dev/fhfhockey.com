import React from "react";
import Image from "next/legacy/image";

import Header from "./Header";
import styles from "./Layout.module.scss";

type LayoutProps = {
  children: React.ReactNode;
};

function Layout({ children }: LayoutProps) {
  return (
    <div className={styles.container}>
      <Header />
      {children}
      <Footer />
    </div>
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

export default Layout;
