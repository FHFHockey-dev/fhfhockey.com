import React from "react";
import ClientOnly from "components/ClientOnly";

import styles from "./Chart.module.scss";
import classNames from "classnames";

type ChartProps = {
  className?: string;
  bodyClassName?: string;
  header?: React.ReactNode;
  children?: React.ReactNode;
};

function Chart({ className, bodyClassName, header, children }: ChartProps) {
  return (
    <section className={classNames(styles.container, className)}>
      <ClientOnly>
        <header className={styles.header}>{header}</header>
      </ClientOnly>

      <div className={classNames(styles.body, bodyClassName)}>{children}</div>
    </section>
  );
}

export default Chart;
