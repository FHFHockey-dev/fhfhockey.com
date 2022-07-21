import React, { useEffect, useState } from "react";
import styles from "./Tooltip.module.scss";

type TooltipProps = {
  onHoverText: string;
  onClickText?: string;
  children: React.ReactNode;
};

function Tooltip({ onHoverText, onClickText, children }: TooltipProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(onHoverText);
  }, [onHoverText]);

  return (
    <div
      className={styles.tooltip}
      onPointerEnter={() => setText(onHoverText)}
      onPointerLeave={() => setText(onHoverText)}
      onClick={() => onClickText && setText(onClickText)}
    >
      <span className={styles.tooltipText}>{text}</span>
      {children}
    </div>
  );
}

export default Tooltip;
