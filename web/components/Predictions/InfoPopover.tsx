import { useEffect, useRef, useState } from "react";
import styles from "../../pages/trends/index.module.scss";
import SkoExplainer from "./SkoExplainer";

export default function InfoPopover() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.infoWrapper} ref={wrapperRef}>
      <button
        type="button"
        aria-label="About sKO"
        aria-expanded={open}
        className={styles.infoButton}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.infoGlyph}>i</span>
      </button>
      {open ? (
        <div className={styles.infoPanel} role="dialog" aria-label="sKO explanation">
          <div className={styles.infoPanelHeader}>
            <span>What is sKO?</span>
            <button className={styles.infoClose} type="button" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <SkoExplainer />
        </div>
      ) : null}
    </div>
  );
}
