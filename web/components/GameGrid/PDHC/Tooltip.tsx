// components/GameGrid/PDHC/Tooltip.tsx

import React, { ReactNode, useState, useRef, useEffect } from "react";
import styles from "styles/pdhcTooltip.module.scss";
import { teamsInfo } from "lib/teamsInfo";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  teamId?: number; // Optional prop to specify the team
};

const Tooltip: React.FC<TooltipProps> = ({ content, children, teamId }) => {
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);

  // Detect if device is mobile based on screen width
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;

  // Toggle tooltip visibility on click
  const toggleTooltip = () => {
    setVisible((prev) => !prev);
  };

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const tooltipElement = tooltipRef.current;

      if (tooltipElement && !tooltipElement.contains(event.target as Node)) {
        setVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

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
        setVisible(false);
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

  // Helper function to get team info by ID
  const getTeamInfoById = (teamId: number) => {
    return Object.values(teamsInfo).find((team) => team.id === teamId);
  };

  // Get team colors
  const teamInfo = teamId ? getTeamInfoById(teamId) : null;

  // Set CSS variables dynamically based on team colors
  const tooltipStyles: React.CSSProperties = {
    ...(teamInfo && {
      "--primary-color": teamInfo.primaryColor,
      "--secondary-color": teamInfo.secondaryColor,
      "--accent-color": teamInfo.accent,
      "--alt-color": teamInfo.alt
    })
  } as React.CSSProperties;

  return (
    <>
      {visible && (
        <>
          {/* Backdrop to darken and blur the background */}
          <div
            className={`${styles.backdrop} ${
              visible ? styles.visible : styles.hidden
            }`}
            onClick={() => setVisible(false)} // Close on backdrop click
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
            style={tooltipStyles}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            {/* Close button on mobile */}
            {isMobile && (
              <button
                className={styles.closeButton}
                onClick={() => setVisible(false)}
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
      <div
        className={styles.tooltipWrapper}
        onClick={toggleTooltip} // Toggle on click
        ref={targetRef}
        tabIndex={0}
        aria-describedby="tooltip-content"
      >
        {children}
      </div>
    </>
  );
};

export default Tooltip;
