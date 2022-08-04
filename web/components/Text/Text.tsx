import React from "react";
import classNames from "classnames";

import styles from "./Text.module.scss";

type TextProps = {
  className?: string;
  children: React.ReactNode;
};

function TextBase({ className, children }: TextProps) {
  return <div className={classNames(className, styles.base)}>{children}</div>;
}

export default function Text({ children }: TextProps) {
  return <TextBase className={styles.normal}>{children}</TextBase>;
}

export function HightText({ children }: TextProps) {
  return <TextBase className={styles.hightlight}>{children}</TextBase>;
}
