import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./PlanFromSlider.module.scss";

export type PlanFrom = {
  /** First planned date; earlier columns are greyed out. */
  from: string;
  /** Earliest date the plan can start: today, or the week's first day while it is still ahead. */
  min: string;
  /** Last date of the planning range. */
  max: string;
  onChange: (date: string) => void;
  disabled?: boolean;
};

/** Each new start date re-plans (one schedule read), so a drag commits once on release and the keyboard once it settles. */
export const PLAN_FROM_SETTLE_MS = 600;
const weekday = (date: string | undefined) => !date ? "" : `${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${Number(date.slice(8, 10))}`;
const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** A slider over a view's day columns that snaps above a day and re-plans from it. */
export default function PlanFromSlider({ days, from, min, max, onChange, disabled }: PlanFrom & { days: string[] }) {
  const first = days.findIndex(day => day >= min), last = days.reduce((found, day, index) => day <= max ? index : found, -1);
  const clamp = (index: number) => Math.min(Math.max(index, first), last);
  const position = clamp(days.findIndex(day => day >= from) < 0 ? last : days.findIndex(day => day >= from));
  const [value, setValue] = useState(position);
  const dragging = useRef(false), timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { setValue(position); }, [position]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (first < 0 || last < first) return null;
  const commit = (index: number) => {
    clearTimeout(timer.current);
    if (days[index] !== from) onChange(days[index]);
  };
  const move = (raw: number) => {
    const index = clamp(raw);
    setValue(index);
    clearTimeout(timer.current);
    if (!dragging.current) timer.current = setTimeout(() => commit(index), PLAN_FROM_SETTLE_MS);
  };
  const release = () => { if (!dragging.current) return; dragging.current = false; commit(value); };
  // The caption sits at the track's right end; for a start on the last three days it moves left, clear of the handle.
  return <div className={styles.planFrom} data-plan-from={days[value]} data-late={days.length > 3 && value >= days.length - 3 ? "" : undefined}
    style={{ "--slider-day-count": days.length, "--slider-value": value, "--greyed": days.length > 1 ? value / (days.length - 1) : 0 } as CSSProperties}>
    {/* The handle reads as a gap in the track over the chosen day's column, naming the day (TJ 2026-11-23). */}
    <span className={styles.window} aria-hidden="true">{weekday(days[value])}</span>
    {/* Visible caption: the bare thumb didn't say what it moves. */}
    <span className={styles.caption} aria-hidden="true">Plan from {dayLabel(days[value])}{disabled ? "" : " · drag to change"}</span>
    <input type="range" aria-label="Plan from day" min={0} max={days.length - 1} step={1} value={value} disabled={disabled}
      aria-valuetext={`Plan from ${dayLabel(days[value])}`}
      onPointerDown={() => { dragging.current = true; }} onPointerUp={release} onPointerCancel={release}
      onChange={event => move(Number(event.target.value))} />
  </div>;
}
