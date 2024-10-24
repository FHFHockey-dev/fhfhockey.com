// components/GameGrid/PDHC/Tooltip.tsx

import React, { ReactNode, useState, useRef, useEffect } from "react";
import styles from "styles/pdhcTooltip.module.scss";

type TooltipProps = {
  content: ReactNode; // The content to display inside the tooltip
  children: ReactNode; // The target element that triggers the tooltip
};

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);

  // Handle mouse events to toggle tooltip visibility
  const showTooltip = () => setVisible(true);
  const hideTooltip = () => setVisible(false);

  // Calculate tooltip position based on target element
  useEffect(() => {
    if (visible && targetRef.current && tooltipRef.current) {
      const targetRect = targetRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Position the tooltip to the left of the target element
      const top =
        targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
      const left = targetRect.left - tooltipRect.width - 8; // 8px gap

      setPosition({
        top: Math.max(
          8,
          Math.min(top, window.innerHeight - tooltipRect.height - 8)
        ), // Prevent overflow
        left: left > 0 ? left : targetRect.right + 8, // If not enough space on the left, place to the right
      });
    }
  }, [visible]);

  return (
    <div
      className={styles.tooltipWrapper}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip} // For keyboard navigation
      onBlur={hideTooltip} // For keyboard navigation
      ref={targetRef}
      style={{ position: "relative", display: "inline-block" }}
      tabIndex={0} // Make the div focusable
      aria-describedby="tooltip-content"
    >
      {children}
      {visible && (
        <div
          className={styles.tooltipContent}
          ref={tooltipRef}
          role="tooltip"
          id="tooltip-content"
          style={{
            top: position.top,
            left: position.left,
            position: "fixed",
            zIndex: 1000,
          }}
        >
          {content}
          <div className={styles.tooltipArrow} />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
