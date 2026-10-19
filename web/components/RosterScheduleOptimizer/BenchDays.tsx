import { useState } from "react";
import type { ContributionDay, PlayerContribution } from "lib/rosterScheduleOptimizer/contributionLedger";
import type { PlanningPlayer, RosterEntry } from "lib/rosterScheduleOptimizer/planningTypes";
import InfoTooltip from "./InfoTooltip";
import styles from "./BenchDays.module.scss";

type Props = {
  roster: RosterEntry[];
  players: PlanningPlayer[];
  contributions: Map<string, PlayerContribution>;
  /** League-local date; earlier days are already decided and are left out. */
  today: string;
  onSelect?: (playerId: string) => void;
  /** Rows shown before "All players". */
  visible?: number;
};

type Kind = "active" | "sat" | "off" | "unknown";
const kindOf = (state: ContributionDay["state"]): Kind | null => state === "elapsed" ? null
  : state === "active" ? "active" : state === "bench" || state === "ineligible" ? "sat" : state === "unknown" ? "unknown" : "off";
const label: Record<Kind, string> = { active: "in the lineup", sat: "game on the bench", off: "no game", unknown: "unknown" };
const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

/** Days left this week when each lineup player doesn't count: no game (off) plus games he sits (DUST). Most first. */
export default function BenchDays({ roster, players, contributions, today, onSelect, visible = 5 }: Props) {
  const [showAll, setShowAll] = useState(false);
  const rows = roster.filter(entry => entry.position === "active" || entry.position === "bench").flatMap(entry => {
    const player = players.find(row => row.id === entry.playerId), contribution = contributions.get(entry.playerId);
    if (!player || !contribution) return [];
    const days = contribution.days.filter(row => row.date >= today).flatMap(row => {
      const kind = kindOf(row.state);
      return kind ? [{ date: row.date, kind }] : [];
    });
    const count = (kind: Kind) => days.filter(row => row.kind === kind).length;
    return [{ player, days, off: count("off"), sat: count("sat"), active: count("active") }];
  }).sort((a, b) => b.off + b.sat - (a.off + a.sat) || a.active - b.active || a.player.name.localeCompare(b.player.name));
  if (!rows.length) return null;
  const item = (row: typeof rows[number]) => <li key={row.player.id}>
    {onSelect ? <button type="button" className={styles.name} aria-label={`Bench days: ${row.player.name}`} onClick={() => onSelect(row.player.id)}>{row.player.name}</button>
      : <span className={styles.name}>{row.player.name}</span>}
    <span className={styles.strip} role="img" aria-label={row.days.map(entry => `${day(entry.date)} ${label[entry.kind]}`).join(", ")}>
      {row.days.map(entry => <i key={entry.date} data-kind={entry.kind} title={`${day(entry.date)}: ${label[entry.kind]}`} />)}
    </span>
    <strong className={styles.count} title={`${row.off + row.sat} of ${row.days.length} days not counting`}>{row.off + row.sat}<small>/{row.days.length}</small></strong>
    <small className={styles.split}>{row.off} off · {row.sat} sat</small>
  </li>;
  // The whole section folds from its header; a long list expands and shrinks from a button at its end.
  return <section className={styles.benchDays} aria-label="Bench days">
    <details open>
      <summary><strong>Bench days</strong><span className={styles.lead}>{rows[0].player.name} counts least</span></summary>
      <p className={styles.help}>Days left this week when a player doesn&apos;t count: no game (off) plus games on your bench (sat). <InfoTooltip label="About bench days">Most first, so the top name contributes least this week. Green: in the lineup · amber: game on the bench · grey: no game.</InfoTooltip></p>
      <ol>{(showAll ? rows : rows.slice(0, visible)).map(item)}</ol>
      {rows.length > visible && <button type="button" className={styles.more} aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>
        {showAll ? "Show fewer" : `Show all (${rows.length})`}</button>}
    </details>
  </section>;
}
