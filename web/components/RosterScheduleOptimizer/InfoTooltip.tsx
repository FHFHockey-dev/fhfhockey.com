import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./InfoTooltip.module.scss";

/** Routine guidance only. Errors and decisions that block planning stay in the workspace. */
export default function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const dismissed = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const close = () => { pinned.current = false; dismissed.current = true; setOpen(false); };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !content.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const box = content.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(anchor.right - box.width, window.innerWidth - box.width - 8));
      const top = anchor.bottom + box.height + 8 <= window.innerHeight
        ? anchor.bottom : Math.max(8, anchor.top - box.height);
      setPosition({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !content.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [open]);

  const leave = (target: EventTarget | null) => {
    if (target instanceof Node && (content.current?.contains(target) || trigger.current?.contains(target))) return;
    dismissed.current = false;
    if (!pinned.current && document.activeElement !== trigger.current) setOpen(false);
  };
  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={label}
      aria-expanded={open} aria-describedby={open ? id : undefined}
      onMouseEnter={() => { if (!dismissed.current) setOpen(true); }}
      onMouseLeave={event => leave(event.relatedTarget)}
      onFocus={() => { dismissed.current = false; setOpen(true); }}
      onBlur={() => { pinned.current = false; dismissed.current = false; setOpen(false); }}
      onClick={() => { if (pinned.current) close(); else { pinned.current = true; dismissed.current = false; setOpen(true); } }}>
      <span aria-hidden="true">ⓘ</span>
    </button>
    {open && createPortal(<div ref={content} id={id} role="tooltip" className={styles.tooltip}
      style={position} onMouseLeave={event => leave(event.relatedTarget)}>{children}</div>, document.body)}
  </>;
}
