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

export default Banner;
