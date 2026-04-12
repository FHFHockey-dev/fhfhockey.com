import React from "react";
import clsx from "clsx";

import styles from "styles/wigoCharts.module.scss";

interface WigoSectionCardProps {
  title: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

const WigoSectionCard: React.FC<WigoSectionCardProps> = ({
  title,
  toolbar,
  className,
  bodyClassName,
  children
}) => {
  return (
    <div className={clsx(styles.chartContainer, className)}>
      <div className={styles.chartHeader}>
        <h3>{title}</h3>
        {toolbar ? <div className={styles.chartToolbar}>{toolbar}</div> : null}
      </div>
      <div className={clsx(styles.chartCanvasContainer, bodyClassName)}>
        {children}
      </div>
    </div>
  );
};

export default WigoSectionCard;
