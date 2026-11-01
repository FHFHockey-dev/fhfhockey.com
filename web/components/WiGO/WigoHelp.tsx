import React, { useEffect, useId, useRef } from "react";

import styles from "styles/wigoCharts.module.scss";

const VIEWPORT_MARGIN = 8;

// An ⓘ help note. It opens in the browser's top layer, so a panel's overflow can't clip it, and is placed inside the
// viewport beside its button. Escape and clicking elsewhere close it.
export default function WigoHelp({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const place = (event: Event) => {
      if ((event as ToggleEvent).newState !== "open" || !buttonRef.current) return;
      const button = buttonRef.current.getBoundingClientRect();
      const { width, height } = panel.getBoundingClientRect();
      const below = button.bottom + 4;
      const fitsBelow = below + height <= window.innerHeight - VIEWPORT_MARGIN;
      panel.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(button.right - width, window.innerWidth - width - VIEWPORT_MARGIN))}px`;
      panel.style.top = `${fitsBelow ? below : Math.max(VIEWPORT_MARGIN, button.top - 4 - height)}px`;
    };
    panel.addEventListener("toggle", place);
    return () => panel.removeEventListener("toggle", place);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.helpButton}
        aria-label={label}
        {...{ popovertarget: id }}
      >
        ⓘ
      </button>
      <div ref={panelRef} id={id} className={styles.helpPanel} {...{ popover: "auto" }}>
        {children}
      </div>
    </>
  );
}
