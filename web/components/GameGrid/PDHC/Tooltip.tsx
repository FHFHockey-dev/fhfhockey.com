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

      // Position the tooltip above the target element
      const top = targetRect.top - tooltipRect.height - 8; // 8px gap
      const left =
        targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;

      setPosition({
        top: top > 0 ? top : targetRect.bottom + 8, // If not enough space above, place below
        left: Math.max(
          8,
          Math.min(left, window.innerWidth - tooltipRect.width - 8)
        ), // Prevent overflow
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
