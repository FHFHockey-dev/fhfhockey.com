import React, { forwardRef } from "react";
import classNames from "classnames";

import styles from "./Container.module.scss";

type ContainerProps = {
  className?: string;
  children: React.ReactNode;
};

const Container = forwardRef<HTMLElement, ContainerProps>(
  ({ children, className }, ref) => {
    return (
      <main ref={ref} className={classNames(styles.pageContent, className)}>
        {children}
      </main>
    );
  }
);

Container.displayName = "Container";

export default Container;
