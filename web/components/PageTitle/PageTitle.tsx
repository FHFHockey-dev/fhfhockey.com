import classNames from "classnames";
import React from "react";

import styles from "./PageTitle.module.scss";

type Props = {
  className?: string;
  children: React.ReactNode;
};

function PageTitle({ children, className }: Props) {
  return <h1 className={classNames(styles.title, className)}>{children}</h1>;
}

const Highlight = ({ children }: Props) => {
  return <span className={styles.blue}>{children}</span>;
};

PageTitle.Highlight = Highlight;

export default PageTitle;
