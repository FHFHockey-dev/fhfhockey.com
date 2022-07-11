import classNames from "classnames";
import React from "react";

import styles from "./Banner.module.css";

type BannderProps = {
  className?: string;
  children: React.ReactNode;
};

function Banner({ children, className }: BannderProps) {
  return (
    <section className={classNames(styles.banner, className)}>
      {children}
    </section>
  );
}
type TextBannerProps = {
  text: string;
};
export function TextBanner({ text }: TextBannerProps) {
  return (
    <section className={styles.textBanner}>
      <h1>{text}</h1>
    </section>
  );
}

export default Banner;
