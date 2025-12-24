import React, { forwardRef } from "react";
import classNames from "classnames";

import styles from "./Container.module.scss";

type ContainerProps = {
  className?: string;
  contentVariant?: "default" | "full";
  children: React.ReactNode;
};

const Container = forwardRef<HTMLElement, ContainerProps>(
  ({ children, className, contentVariant = "default" }, ref) => {
    return (
      <main
        ref={ref}
        className={classNames(
          contentVariant === "full"
            ? styles.pageContentFull
            : styles.pageContent,
          className
        )}
      >
        {children}
      </main>
    );
  }
);

Container.displayName = "Container";

export default Container;
