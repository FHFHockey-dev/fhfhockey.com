import React from "react";
import classNames from "classnames";

import styles from "./ChartTitle.module.scss";

type TextProps = {
  className?: string;
  children: React.ReactNode;
};

function TextBase({ className, children }: TextProps) {
  return <div className={classNames(className, styles.base)}>{children}</div>;
}

export default function ChartTitle({ children, className }: TextProps) {
  return (
    <TextBase className={classNames(styles.normal, className)}>
      {children}
    </TextBase>
  );
}

export function HightText({ children, className }: TextProps) {
  return (
    <TextBase className={classNames(styles.hightlight, className)}>
      {children}
    </TextBase>
  );
}
