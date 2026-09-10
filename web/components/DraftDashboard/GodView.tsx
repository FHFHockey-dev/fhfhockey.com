import React, { useEffect, useRef, useState } from "react";
import type { DraftProAccess } from "lib/draft-pro/contracts";
import { godViewRosterProgress, type GodViewPick } from "lib/draftDashboard/godView";
import type { TeamDraftStats } from "./DraftDashboard";
import styles from "./GodView.module.scss";

const OPEN_KEY = "draft.god-view.open";
type Props = {
  queue: GodViewPick[];
  teams: TeamDraftStats[];
  rosterConfig: Record<string, number>;
  myTeamId: string;
  round: number;
  format: string;
  access: DraftProAccess | null;
  onSelectTeam: (teamId: string) => void;
  onExpandGraph: () => void;
  onSummary: () => void;
  onOpenChange: (open: boolean) => void;
};

export default function GodView({ queue, teams, rosterConfig, myTeamId, round, format, access, onSelectTeam, onExpandGraph, onSummary, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const allowed = Boolean(access?.eligible && access.capabilities.includes("god_view"));
  const firstPick = queue[0]?.pickNumber;
  const pages = Math.ceil(queue.length / 12);
  useEffect(() => {
    let restored = false;
    try { restored = localStorage.getItem(OPEN_KEY) === "true"; } catch { /* Storage may be unavailable. */ }
    setOpen(restored);
    onOpenChange(restored);
  }, [onOpenChange]);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => setMobile(entry.contentRect.width < 1024));
    observer.observe(root.current.parentElement ?? root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPage(0);
    viewport.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [firstPick, queue.length, mobile, allowed, open]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    onOpenChange(next);
    try { localStorage.setItem(OPEN_KEY, String(next)); } catch { /* Keep the local UI usable. */ }
  };
  const move = (next: number) => {
    const view = viewport.current;
    if (!view) return;
    view.scrollTo({ left: next * view.clientWidth, behavior: "instant" });
    setPage(next);
  };
  const card = (pick: GodViewPick, index: number) => {
    const team = teams.find((item) => item.teamId === pick.teamId);
    const progress = godViewRosterProgress(rosterConfig, team);
    return <button type="button" key={pick.pickNumber} className={styles.card} data-on-clock={index === 0} onClick={() => onSelectTeam(pick.teamId)} aria-label={`View ${team?.teamName || pick.teamId} roster, pick ${pick.pickNumber}${index === 0 ? ", on the clock" : ""}`}>
      <span className={styles.badges}>{index === 0 ? "On the clock" : `Upcoming ${index + 1}`}{pick.teamId === myTeamId && <span>You</span>}</span>
      <strong className={styles.name}>{team?.teamName || pick.teamId}</strong>
      <span className={styles.coordinate}>#{pick.pickNumber} · R{pick.round} / P{pick.pickInRound}</span>
      <span className={styles.slots}>{progress.map((slot) => <span className={styles.slot} key={slot.position} data-position={slot.position}>
        <span>{slot.label}</span>
        <span className={styles.track} aria-hidden="true"><span style={{ width: `${slot.fraction * 100}%` }} /></span>
        <span>{slot.filled}/{slot.capacity}</span>
        <span className={styles.openCount}>{slot.over ? `${slot.over} over capacity` : `${slot.open} open`}</span>
      </span>)}</span>
    </button>;
  };
  return <section ref={root} className={styles.root} aria-label="God View">
    <header className={styles.header}>
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls="god-view-content">{open ? "▾" : "▸"} God View · Pro</button>
      <span>Round {round} · {format}</span>
      <button type="button" className={styles.graph} onClick={onExpandGraph}>Expand draft graph</button>
    </header>
    {open && <div id="god-view-content">
      {!allowed ? <p className={styles.explanation}>{access?.eligible ? "God View is not available yet. It is included in your season pass when enabled." : "Explore upcoming picks and each team’s open roster slots with Draft Pro."} {!access?.eligible && <a href="/account?section=draft-pro">Explore Draft Pro</a>}</p> : queue.length === 0 ? <p className={styles.explanation}>Draft complete. <button type="button" onClick={onSummary}>View draft summary</button></p> : <>
        <p className={styles.explanation}>Current open slots · repeated teams own multiple upcoming picks. Select a card to view its roster.</p>
        <div ref={viewport} className={styles.viewport} tabIndex={0} aria-label="Upcoming pick cards" onKeyDown={(event) => {
          if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
          event.preventDefault();
          const direction = event.key === "ArrowRight" ? 1 : -1;
          if (mobile) viewport.current?.scrollBy({ left: direction * 198, behavior: "instant" });
          else move(Math.max(0, Math.min(pages - 1, page + direction)));
        }} onScroll={() => {
          const view = viewport.current;
          if (view && !mobile) setPage(Math.round(view.scrollLeft / view.clientWidth));
        }}>
          {mobile ? queue.map(card) : Array.from({ length: pages }, (_, index) => <div className={styles.page} key={index}>{queue.slice(index * 12, index * 12 + 12).map((pick, offset) => card(pick, index * 12 + offset))}</div>)}
        </div>
        {!mobile && pages > 1 && <nav className={styles.pagination} aria-label="God View pages">
          <button type="button" disabled={page === 0} onClick={() => move(page - 1)}>Previous</button>
          <span aria-live="polite">{page * 12 + 1}–{Math.min((page + 1) * 12, queue.length)} of {queue.length} picks</span>
          <button type="button" disabled={page >= pages - 1} onClick={() => move(page + 1)}>Next</button>
        </nav>}
        {mobile && <p className={styles.explanation}>{queue.length} upcoming picks · swipe or use arrow keys to scroll</p>}
      </>}
    </div>}
  </section>;
}
