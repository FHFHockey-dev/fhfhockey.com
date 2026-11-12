// components/GameGrid/PDHC/Tooltip.tsx

import React, {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "styles/pdhcTooltip.module.scss";
import { teamsInfo } from "lib/teamsInfo";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  teamId?: number; // Optional prop to specify the team
  label?: string;
  dialogLabel?: string;
  triggerClassName?: string;
  dialogClassName?: string;
  portal?: boolean;
};

const Tooltip: React.FC<TooltipProps> = ({ content, children, teamId, label, dialogLabel = "Game probability details", triggerClassName = "", dialogClassName = "", portal = false }) => {
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const dialogId = useId();

  const closeTooltip = useCallback((restoreFocus = true) => {
    setVisible(false);
    if (restoreFocus) {
      requestAnimationFrame(() => targetRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeTooltip();
        return;
      }

      if (event.key !== "Tab" || !tooltipRef.current) return;

      const focusableElements =
        tooltipRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), summary, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement) {
        event.preventDefault();
        tooltipRef.current.focus();
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeTooltip, visible]);

  useEffect(() => {
    if (visible && tooltipRef.current) {
      const firstFocusable = tooltipRef.current.querySelector<HTMLElement>(
        "button:not([disabled])",
      );
      (firstFocusable ?? tooltipRef.current).focus();
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
      "--alt-color": teamInfo.alt,
    }),
  } as React.CSSProperties;

  const overlay = visible ? (
        <>
          {/* Backdrop to darken and blur the background */}
          <div
            className={`${styles.backdrop} ${
              visible ? styles.visible : styles.hidden
            }`}
            onClick={() => closeTooltip()}
            aria-hidden="true"
          ></div>
          <div
            className={`${styles.tooltipContent} ${dialogClassName} ${
              visible ? styles.visible : styles.hidden
            }`}
            ref={tooltipRef}
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            id={dialogId}
            tabIndex={-1}
            style={tooltipStyles}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => closeTooltip()}
              aria-label={`Close ${dialogLabel.toLowerCase()}`}
            >
              ×
            </button>
            {content}
          </div>
        </>
      ) : null;

  return (
    <>
      {overlay && (portal ? createPortal(overlay, document.body) : overlay)}
      <div
        className={`${styles.tooltipWrapper} ${triggerClassName}`}
        onClick={() => setVisible((previous) => !previous)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!event.repeat) setVisible((previous) => !previous);
          }
        }}
        ref={targetRef}
        role="button"
        aria-label={label}
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={visible}
        aria-controls={dialogId}
      >
        {children}
      </div>
    </>
  );
};

export default Tooltip;
