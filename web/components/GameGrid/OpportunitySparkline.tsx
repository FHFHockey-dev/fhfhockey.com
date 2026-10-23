import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatOpportunity, MATCHUP_LABELS, type OpportunityWeek, type TeamOpportunity } from "./utils/scheduleOpportunity";
import styles from "./OpportunitySparkline.module.scss";

const WIDTH = 72;
const HEIGHT = 24;
const PAD = 3;
const CARD_WIDTH = 236;

type Trend = "Rising" | "Falling" | "Flat";
const TREND_GLYPH: Record<Trend, string> = { Rising: "▲", Falling: "▼", Flat: "▬" };

function getTrend(weeks: OpportunityWeek[]): Trend | null {
  const first = weeks[0]?.opportunity;
  const last = weeks[weeks.length - 1]?.opportunity;
  if (first == null || last == null) return null;
  return last > first ? "Rising" : last < first ? "Falling" : "Flat";
}

function formatWeekStart(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function OpportunitySparkline({ value, scale, team }: { value?: TeamOpportunity; scale: number; team: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const pointerType = useRef("");
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const cardId = `opportunity-card-${id}`;

  // Follow the trigger while the page or table scrolls; close once it leaves the viewport.
  const place = () => {
    const box = trigger.current?.getBoundingClientRect();
    if (!box) return;
    if (box.bottom < 0 || box.top > window.innerHeight) { setOpen(false); return; }
    const height = card.current?.offsetHeight ?? 150;
    const left = Math.max(8, Math.min(box.left + box.width / 2 - CARD_WIDTH / 2, window.innerWidth - CARD_WIDTH - 8));
    const top = window.innerHeight - box.bottom >= height + 12 ? box.bottom + 6 : Math.max(8, box.top - height - 6);
    setPosition({ left, top });
  };

  useLayoutEffect(() => {
    if (open) place(); else setPosition(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const onPointer = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node)) close(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const weeks = value?.weeks ?? [];
  const trend = getTrend(weeks);
  const x = (index: number) => PAD + index * (WIDTH - 2 * PAD) / Math.max(1, weeks.length - 1);
  const y = (v: number) => HEIGHT - PAD - (HEIGHT - 2 * PAD) * Math.min(v, scale) / scale;
  const line = weeks.map((w, i) => w.opportunity == null ? "" : `${i > 0 && weeks[i - 1].opportunity != null ? "L" : "M"} ${x(i).toFixed(2)} ${y(w.opportunity).toFixed(2)}`).join(" ").trim();
  const complete = weeks.length > 0 && weeks.every((w) => w.opportunity != null);
  const area = complete ? `${line} L ${x(weeks.length - 1).toFixed(2)} ${HEIGHT} L ${x(0).toFixed(2)} ${HEIGHT} Z` : null;
  const lastKnown = weeks.reduce((last, w, i) => w.opportunity == null ? last : i, -1);
  const label = `${team} 4-week value ${formatOpportunity(value?.opportunity)}${trend ? `, ${trend.toLowerCase()}` : ""}; weekly games ${weeks.map((w) => w.gamesPlayed ?? "unknown").join(", ") || "unavailable"}`;

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={label} aria-describedby={open ? cardId : undefined}
      onPointerDown={(event) => { pointerType.current = event.pointerType; }}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") show(); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") hide(); }}
      onFocus={(event) => {
        let keyboard = true;
        try { keyboard = event.currentTarget.matches(":focus-visible"); } catch { /* older engines */ }
        if (keyboard) show();
      }}
      onBlur={hide}
      onClick={() => { if (pointerType.current === "mouse") show(); else setOpen((v) => !v); pointerType.current = ""; }}>
      {lastKnown < 0 ? <span className={styles.empty} aria-hidden="true" /> : (
        <svg className={styles.spark} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" data-shared-scale={scale}>
          <defs>
            <linearGradient id={`${id}-stroke`} gradientUnits="userSpaceOnUse" x1={x(0)} y1="0" x2={x(weeks.length - 1)} y2="0">
              {weeks.map((w, i) => <stop key={w.weekNumber} className={styles.stop} data-matchup={w.skaterMatchup} offset={weeks.length > 1 ? i / (weeks.length - 1) : 0} />)}
            </linearGradient>
            <filter id={`${id}-glow`} x="-20%" y="-60%" width="140%" height="220%">
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
          </defs>
          {area && <path className={styles.area} d={area} fill={`url(#${id}-stroke)`} />}
          <path className={styles.glow} d={line} stroke={`url(#${id}-stroke)`} filter={`url(#${id}-glow)`} />
          <path className={styles.line} d={line} stroke={`url(#${id}-stroke)`} />
          {weeks.map((w, i) => w.opportunity == null ? null : (
            <circle key={w.weekNumber} className={i === lastKnown ? styles.lastDot : styles.dot} data-matchup={w.skaterMatchup}
              cx={x(i)} cy={y(w.opportunity)} r={i === lastKnown ? 2.3 : 1.5} />
          ))}
        </svg>
      )}
    </button>
    {open && createPortal(
      <div ref={card} id={cardId} role="tooltip" className={styles.card}
        style={position ? { left: position.left, top: position.top } : { left: -9999, top: 0 }}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTeam}>{team}</span>
          <span className={styles.cardTotal}>4WK {formatOpportunity(value?.opportunity)}</span>
          {trend && <span className={styles.cardTrend} data-trend={trend}><span aria-hidden="true">{TREND_GLYPH[trend]}</span> {trend}</span>}
        </div>
        <ul className={styles.cardWeeks}>
          {weeks.map((w) => (
            <li key={w.weekNumber} className={styles.cardWeek}>
              <span className={styles.cardDate}>{formatWeekStart(w.start)}</span>
              {w.gamesPlayed == null
                ? <span className={styles.cardPending}>Schedule pending</span>
                : <>
                  <span className={styles.cardCounts}>{w.gamesPlayed} GP · {w.offNights} OFF</span>
                  <span className={styles.cardMatchup} data-matchup={w.skaterMatchup}>{MATCHUP_LABELS[w.skaterMatchup]}</span>
                </>}
            </li>
          ))}
        </ul>
      </div>,
      document.body,
    )}
  </>;
}
