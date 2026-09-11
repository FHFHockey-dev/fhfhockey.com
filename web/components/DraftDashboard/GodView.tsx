import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DraftProAccess } from "lib/draft-pro/contracts";
import { godViewRosterNeeds, godViewRosterProgress, type GodViewPick } from "lib/draftDashboard/godView";
import type { TeamDraftStats } from "./DraftDashboard";
import styles from "./GodView.module.scss";

import { rankTeamCategories, categoryRankBand } from "lib/draftDashboard/categoryStandings";
import { STATS_MASTER_LIST } from "lib/projectionsConfig/statsMasterList";

const OPEN_KEY = "draft.god-view.open";
type Props = {
  queue: GodViewPick[];
  categories: Record<string, number>;
  leagueType: "points" | "categories";
  playerNames: Map<string, string>;
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

export default function GodView({ queue, categories, leagueType, playerNames, teams, rosterConfig, myTeamId, selectedTeamId, round, currentPick, totalPicks, format, access, onSelectTeam, onExpandGraph, onSummary, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const allowed = Boolean(access?.eligible && access.capabilities.includes("god_view"));
  const teamRanks = useMemo(() => rankTeamCategories(teams, categories, leagueType), [teams, categories, leagueType]);
  const teamCards = useMemo(() => new Map(teams.map(team => {
    const progress = godViewRosterProgress(rosterConfig, team);
    return [team.teamId, { team, progress, needs: godViewRosterNeeds(progress) }];
  })), [teams, rosterConfig]);
  const categoryKeys = Object.keys(categories);
  const cardWidth = Math.max(224, Object.values(rosterConfig).filter(count => count > 0).length * 29 + 24, Math.ceil(categoryKeys.length / 2) * 42 + 24);
  const goToCurrent = useCallback(() => {
    const viewport = track.current;
    const card = viewport?.querySelector<HTMLElement>(`[data-pick="${Math.min(currentPick, totalPicks)}"]`);
    if (viewport && card) viewport.scrollLeft += card.getBoundingClientRect().left - viewport.getBoundingClientRect().left - 8;
  }, [currentPick, totalPicks]);
  useEffect(() => {
    let restored = false;
    try { restored = localStorage.getItem(OPEN_KEY) === "true"; } catch { /* Storage may be unavailable. */ }
    setOpen(restored);
    onOpenChange(restored);
  }, [onOpenChange]);
  useEffect(() => {
    if (!open || !allowed || !track.current) return;
    goToCurrent();
    const observer = new ResizeObserver(goToCurrent);
    observer.observe(track.current);
    return () => observer.disconnect();
  }, [open, allowed, goToCurrent, cardWidth]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    onOpenChange(next);
    try { localStorage.setItem(OPEN_KEY, String(next)); } catch { /* Keep the local UI usable. */ }
  };
  const card = (pick: GodViewPick) => {
    const { team, progress = [], needs = [] } = teamCards.get(pick.teamId) || {};
    const onClock = pick.pickNumber === currentPick;
    const selected = pick.status === "completed" || pick.status === "keeper";
    const playerName = pick.playerId ? playerNames.get(pick.playerId) || "Player unavailable" : "Player unavailable";
    return <button type="button" key={pick.pickNumber} className={styles.card} data-pick={pick.pickNumber} data-status={pick.status} data-on-clock={onClock} aria-pressed={selectedTeamId === pick.teamId} onClick={() => { onSelectTeam(pick.teamId); }} aria-label={`View ${team?.teamName || pick.teamId} roster, pick ${pick.pickNumber}${onClock ? ", on the clock" : ""}`}>
      {onClock && <span className={styles.onClock}>ON THE CLOCK</span>}
      <span className={styles.identity}>
        <span className={styles.order} title={`Overall pick ${pick.pickNumber}`}>{pick.pickNumber}</span>
        <span className={styles.teamIdentity}>
          <strong className={styles.name} title={selected ? playerName : team?.teamName || pick.teamId}>{selected ? playerName : pick.status === "skipped" ? "Skipped pick" : team?.teamName || pick.teamId}</strong>
          <span className={styles.details}><span className={styles.name} title={team?.owner}>{selected || pick.status === "skipped" ? `${team?.teamName || pick.teamId}${pick.status === "keeper" ? " · Keeper" : ""}` : team?.owner && team.owner !== team.teamId ? team.owner : (pick.teamId === myTeamId ? "Your team" : "")}</span><span>R{pick.round} · P{pick.pickInRound}</span></span>
        </span>
      </span>
      {selected ? <span className={styles.categoryRanks} style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(categoryKeys.length / 2))}, minmax(0, 1fr))` }} aria-label="Live team category ranks">
        {categoryKeys.map(key => {
          const definition = STATS_MASTER_LIST.find(stat => stat.key === key);
          const rank = teamRanks[pick.teamId]?.[key];
          return <span key={key} data-category={key} data-rank={rank} data-band={categoryRankBand(rank ?? teams.length, teams.length)} title={`${definition?.displayName || key}: team rank ${rank ?? "unavailable"} of ${teams.length}`}><span>{definition?.shortDisplayName || definition?.displayName || key}</span><strong>{rank ? `#${rank}` : "—"}</strong></span>;
        })}
        {!categoryKeys.length && <span>No scoring categories configured</span>}
      </span> : pick.status === "skipped" ? <span className={styles.needs}>No player selected</span> : <>
      <span className={styles.slots}>{progress.map((slot) => <span className={styles.slot} key={slot.position} data-position={slot.position} title={`${slot.label}: ${slot.filled} occupied of ${slot.capacity}${slot.over ? `, ${slot.over} over capacity` : ""}`}>
        <span>{slot.label}</span>
        <span className={styles.track} aria-hidden="true"><span style={{ height: `${slot.fraction * 100}%` }} /></span>
        <span>{slot.filled}/{slot.capacity}</span>
      </span>)}</span>
      <span className={styles.needs}>Needs: {needs.length ? needs.map((slot) => <span key={slot.position} data-position={slot.position} title={`${slot.open} open ${slot.label} slots`}>{slot.label}</span>) : <span>Filled</span>}</span>
      </>}
    </button>;
  };
  return <section ref={root} className={styles.root} aria-label="Draft Order">
    <header className={styles.header}>
      <button type="button" className={styles.toggle} onClick={toggle} aria-label={`${open ? "Collapse" : "Expand"} God View - Pro`} aria-expanded={open} aria-controls="god-view-content"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 5h13M8 12h13M8 19h13M3 4v2M3 11v2M3 18v2"/></svg> God View - Pro <span aria-hidden="true">{open ? "⌃" : "⌄"}</span></button>
      <span className={styles.context}>Round {round} · {format.charAt(0).toUpperCase() + format.slice(1)}</span>
      <span className={styles.pickProgress}>Pick {Math.min(currentPick, totalPicks)} of {totalPicks}</span>
      {open && allowed && <button type="button" onClick={goToCurrent} className={styles.currentPick}>Current pick</button>}
      {currentPick > totalPicks && <button type="button" onClick={onSummary}>Draft summary</button>}
      <button type="button" className={styles.graph} onClick={onExpandGraph} aria-haspopup="dialog" aria-controls="draft-graph"><span aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12h4v9H3zM10 3h4v18h-4zM17 8h4v13h-4z"/></svg></span> Expand Draft Graph <span aria-hidden="true">⌄</span></button>
    </header>
    <div id="god-view-content" hidden={!open}>
      {!allowed ? <p className={styles.explanation}>{access?.eligible ? "God View is not available yet. It is included in your season pass when enabled." : "Explore upcoming picks and each team’s open roster slots with Draft Pro."} {!access?.eligible && <a href="/account?section=draft-pro">Explore Draft Pro</a>}</p> : queue.length === 0 ? <p className={styles.explanation}>Draft complete. <button type="button" onClick={onSummary}>View draft summary</button></p> : <>
        <div ref={track} className={styles.cards} role="region" aria-label="All draft picks" tabIndex={0} style={{ "--pick-card-width": `${cardWidth}px` } as React.CSSProperties}>
          {queue.map(pick => <React.Fragment key={pick.pickNumber}>
            {pick.pickInRound === 1 && <span className={styles.roundBreak} aria-label={`Round ${pick.round}`}>Round {pick.round}</span>}
            {card(pick)}
          </React.Fragment>)}
        </div>
      </>}
    </div>
  </section>;
}
