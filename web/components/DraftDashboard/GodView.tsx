import React, { useEffect, useRef, useState } from "react";
import type { DraftProAccess } from "lib/draft-pro/contracts";
import { godViewRosterNeeds, godViewRosterProgress, type GodViewPick } from "lib/draftDashboard/godView";
import type { TeamDraftStats } from "./DraftDashboard";
import styles from "./GodView.module.scss";

const OPEN_KEY = "draft.god-view.open";
type Props = {
  queue: GodViewPick[];
  teams: TeamDraftStats[];
  rosterConfig: Record<string, number>;
  myTeamId: string;
  selectedTeamId: string;
  round: number;
  currentPick: number;
  totalPicks: number;
  format: string;
  access: DraftProAccess | null;
  onSelectTeam: (teamId: string) => void;
  onExpandGraph: () => void;
  onSummary: () => void;
  onOpenChange: (open: boolean) => void;
};

export default function GodView({ queue, teams, rosterConfig, myTeamId, selectedTeamId, round, currentPick, totalPicks, format, access, onSelectTeam, onExpandGraph, onSummary, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [visibleCount, setVisibleCount] = useState(6);
  const root = useRef<HTMLElement>(null);
  const allowed = Boolean(access?.eligible && access.capabilities.includes("god_view"));
  const firstPick = queue[0]?.pickNumber;
  const pages = Math.ceil(queue.length / visibleCount);
  useEffect(() => {
    let restored = false;
    try { restored = localStorage.getItem(OPEN_KEY) === "true"; } catch { /* Storage may be unavailable. */ }
    setOpen(restored);
    onOpenChange(restored);
  }, [onOpenChange]);
  useEffect(() => {
    if (!root.current) return;
    const positions = Object.values(rosterConfig).filter((capacity) => capacity > 0).length;
    const minimumCardWidth = Math.max(210, positions * 29 + 20);
    const observer = new ResizeObserver(([entry]) => setVisibleCount(Math.max(1, Math.floor((entry.contentRect.width - 16) / (minimumCardWidth + 8)))));
    observer.observe(root.current.parentElement ?? root.current);
    return () => observer.disconnect();
  }, [rosterConfig]);
  useEffect(() => {
    setPage(0);
  }, [firstPick, queue.length, visibleCount]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    onOpenChange(next);
    try { localStorage.setItem(OPEN_KEY, String(next)); } catch { /* Keep the local UI usable. */ }
  };
  const card = (pick: GodViewPick, index: number) => {
    const team = teams.find((item) => item.teamId === pick.teamId);
    const progress = godViewRosterProgress(rosterConfig, team);
    const needs = godViewRosterNeeds(progress);
    return <button type="button" key={pick.pickNumber} className={styles.card} data-on-clock={index === 0} aria-pressed={selectedTeamId === pick.teamId} onClick={() => { onSelectTeam(pick.teamId); }} aria-label={`View ${team?.teamName || pick.teamId} roster, pick ${pick.pickNumber}${index === 0 ? ", on the clock" : ""}`}>
      {index === 0 && <span className={styles.onClock}>ON THE CLOCK</span>}
      <span className={styles.identity}>
        <span className={styles.order} title={`Overall pick ${pick.pickNumber}`}>{pick.pickNumber}</span>
        <span className={styles.teamIdentity}>
          <strong className={styles.name} title={team?.teamName || pick.teamId}>{team?.teamName || pick.teamId}</strong>
          <span className={styles.details}><span className={styles.name} title={team?.owner}>{team?.owner && team.owner !== team.teamId ? team.owner : (pick.teamId === myTeamId ? "Your team" : "")}</span><span>R{pick.round} · P{pick.pickInRound}</span></span>
        </span>
      </span>
      <span className={styles.slots}>{progress.map((slot) => <span className={styles.slot} key={slot.position} data-position={slot.position} title={`${slot.label}: ${slot.filled} occupied of ${slot.capacity}${slot.over ? `, ${slot.over} over capacity` : ""}`}>
        <span>{slot.label}</span>
        <span className={styles.track} aria-hidden="true"><span style={{ height: `${slot.fraction * 100}%` }} /></span>
        <span>{slot.filled}/{slot.capacity}</span>
      </span>)}</span>
      <span className={styles.needs}>Needs: {needs.length ? needs.map((slot) => <span key={slot.position} data-position={slot.position} title={`${slot.open} open ${slot.label} slots`}>{slot.label}</span>) : <span>Filled</span>}</span>
    </button>;
  };
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  return <section ref={root} className={styles.root} aria-label="Draft Order">
    <header className={styles.header}>
      <button type="button" className={styles.toggle} onClick={toggle} aria-label={`${open ? "Collapse" : "Expand"} God View - Pro`} aria-expanded={open} aria-controls="god-view-content"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 5h13M8 12h13M8 19h13M3 4v2M3 11v2M3 18v2"/></svg> God View - Pro <span aria-hidden="true">{open ? "⌃" : "⌄"}</span></button>
      <span className={styles.context}>Round {round} · {format.charAt(0).toUpperCase() + format.slice(1)}</span>
      <span className={styles.pickProgress}>Pick {Math.min(currentPick, totalPicks)} of {totalPicks}</span>
      {open && allowed && queue.length > 0 && <nav className={styles.pagination} aria-label="Draft Order pages">
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span aria-live="polite">{currentPage * visibleCount + 1}–{Math.min((currentPage + 1) * visibleCount, queue.length)} of {queue.length} picks</span>
          <button type="button" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>Next</button>
        </nav>}
      <button type="button" className={styles.graph} onClick={onExpandGraph} aria-haspopup="dialog" aria-controls="draft-graph"><span aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12h4v9H3zM10 3h4v18h-4zM17 8h4v13h-4z"/></svg></span> Expand Draft Graph <span aria-hidden="true">⌄</span></button>
    </header>
    <div id="god-view-content" hidden={!open}>
      {!allowed ? <p className={styles.explanation}>{access?.eligible ? "God View is not available yet. It is included in your season pass when enabled." : "Explore upcoming picks and each team’s open roster slots with Draft Pro."} {!access?.eligible && <a href="/account?section=draft-pro">Explore Draft Pro</a>}</p> : queue.length === 0 ? <p className={styles.explanation}>Draft complete. <button type="button" onClick={onSummary}>View draft summary</button></p> : <>
        <div className={styles.cards} style={{ gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` }}>
          {queue.slice(currentPage * visibleCount, (currentPage + 1) * visibleCount).map((pick, offset) => card(pick, currentPage * visibleCount + offset))}
        </div>
      </>}
    </div>
  </section>;
}
