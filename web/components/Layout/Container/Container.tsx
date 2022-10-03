import React from "react";
import classNames from "classnames";

import styles from "./Container.module.scss";

type ContainerProps = {
  className?: string;
  children: React.ReactNode;
};

function Container({ children, className }: ContainerProps) {
  return (
    <main className={classNames(styles.pageContent, className)}>
      {children}
    </main>
  );
}

export default Container;
