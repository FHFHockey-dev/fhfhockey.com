import React from "react";
import styles from "./PanelStatus.module.scss";
import clsx from "clsx";

export type PanelStatusProps = {
  state: "loading" | "empty" | "error" | "info";
  message: string;
  className?: string;
};

const roleMap: Record<PanelStatusProps["state"], string | undefined> = {
  loading: "status",
  empty: undefined,
  error: "alert",
  info: undefined
};

export const PanelStatus: React.FC<PanelStatusProps> = ({
  state,
  message,
  className
}) => {
  return (
    <div
      className={clsx(styles.status, styles[state], className)}
      role={roleMap[state]}
      aria-live={state === "loading" ? "polite" : undefined}
    >
      {message}
    </div>
  );
};

export default PanelStatus;
