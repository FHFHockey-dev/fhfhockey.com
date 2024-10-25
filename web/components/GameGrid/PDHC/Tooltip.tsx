// Tooltip.tsx
import React, { ReactNode, useState, useRef, useEffect } from "react";
import styles from "styles/pdhcTooltip.module.scss";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
};

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [visible, setVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const animationDuration = 300; // Must match the CSS transition duration in ms

  // Detect if device is mobile based on screen width
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;

  // Handle events to toggle tooltip visibility
  const showTooltip = () => {
    setVisible(true);
  };
  const hideTooltip = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setVisible(false);
      setIsAnimating(false);
    }, animationDuration);
  };

  // Calculate tooltip position based on target element
  useEffect(() => {
    if (visible && targetRef.current && tooltipRef.current) {
      if (isMobile) {
        // Center the tooltip on mobile devices
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const top = window.innerHeight / 2 - tooltipRect.height / 2;
        const left = window.innerWidth / 2 - tooltipRect.width / 2;
        setPosition({
          top: top > 8 ? top : 8,
          left: left > 8 ? left : 8,
        });
      } else {
        // Desktop positioning
        const targetRect = targetRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();

        // Position the tooltip to the left of the target element
        const top =
          targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        const left = targetRect.left - tooltipRect.width - 8;

        setPosition({
          top: Math.max(
            8,
            Math.min(top, window.innerHeight - tooltipRect.height - 8)
          ),
          left: left > 0 ? left : targetRect.right + 8,
        });
      }
    }
  }, [visible, isMobile]);

  // Add the useEffect hook to control body scroll
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = visible ? "hidden" : "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [visible, isMobile]);

  // Adjust event handlers for mobile devices
  const eventHandlers = isMobile
    ? {
        onClick: () => showTooltip(),
      }
    : {
        onMouseEnter: showTooltip,
        onMouseLeave: hideTooltip,
        onFocus: showTooltip,
        onBlur: hideTooltip,
      };

  // Click outside handler
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const tooltipElement = tooltipRef.current;
      const targetElement = targetRef.current;

      if (
        tooltipElement &&
        !tooltipElement.contains(event.target as Node) &&
        targetElement &&
        !targetElement.contains(event.target as Node)
      ) {
        hideTooltip();
      }
    };

    // Attach the event listeners
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    // Cleanup the event listeners on unmount or when tooltip hides
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [visible]);

  // Escape key handler for accessibility
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hideTooltip();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible]);

  // Focus management for accessibility
  useEffect(() => {
    if (visible && tooltipRef.current) {
      tooltipRef.current.focus();
    }
  }, [visible]);

  return (
    <div
      className={styles.tooltipWrapper}
      {...eventHandlers}
      ref={targetRef}
      style={{ position: "relative", display: "inline-block" }}
      tabIndex={0}
      aria-describedby="tooltip-content"
    >
      {children}
      {(visible || isAnimating) && (
        <>
          {/* Backdrop to darken and blur the background */}
          <div
            className={`${styles.backdrop} ${
              visible ? styles.visible : styles.hidden
            }`}
            onClick={hideTooltip}
            aria-hidden="true"
          ></div>
          {/* Tooltip content */}
          <div
            className={`${styles.tooltipContent} ${
              visible ? styles.visible : styles.hidden
            }`}
            ref={tooltipRef}
            role="tooltip"
            id="tooltip-content"
            tabIndex={-1} // Make it focusable
            style={{
              top: position.top,
              left: position.left,
              position: "fixed",
              zIndex: 10000, // Ensure it's above the backdrop
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button on mobile */}
            {isMobile && (
              <button
                className={styles.closeButton}
                onClick={hideTooltip}
                aria-label="Close"
              >
                ×
              </button>
            )}
            {content}
            {!isMobile && <div className={styles.tooltipArrow} />}
          </div>
        </>
      )}
    </div>
  );
};

export default Tooltip;
