import React from "react";
import classNames from "classnames";

import styles from "./CategoryTitle.module.scss";

function CategoryTitle({
  className,
  children,
  type,
}: {
  className?: string;
  children: React.ReactNode;
  type: "small" | "large";
}) {
  return (
    <div
      className={classNames(styles.categoryTitle, className, {
        [styles.large]: type === "large",
        [styles.small]: type === "small",
      })}
    >
      <div className={styles.line} />
      <h2 className={styles.content}>{children}</h2>
      <div className={styles.line} />
    </div>
  );
}

export default CategoryTitle;
