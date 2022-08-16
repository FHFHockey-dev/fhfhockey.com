import React from "react";
import ClientOnly from "components/ClientOnly";

import styles from "./Chart.module.scss";
import classNames from "classnames";

type ChartProps = {
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  header?: React.ReactNode;
  children?: React.ReactNode;
};

function Chart({
  className,
  headerClassName,
  bodyClassName,
  header,
  children,
}: ChartProps) {
  return (
    <section className={classNames(styles.container, className)}>
      <ClientOnly>
        <header className={classNames(styles.header, headerClassName)}>
          {header}
        </header>
      </ClientOnly>

      <div className={classNames(styles.body, bodyClassName)}>{children}</div>
    </section>
  );
}

export default Chart;
