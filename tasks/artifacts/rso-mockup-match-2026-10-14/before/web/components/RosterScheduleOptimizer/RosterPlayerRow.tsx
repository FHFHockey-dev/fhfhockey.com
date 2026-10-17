import type { ReactNode } from "react";
import type { PlayerContribution } from "lib/rosterScheduleOptimizer/contributionLedger";
import type { PlanningPlayer, RosterEntry } from "lib/rosterScheduleOptimizer/planningTypes";
import RosterContribution from "./RosterContribution";
import styles from "./RosterScheduleOptimizer.module.scss";

export default function RosterPlayerRow({ player, entry, contribution, nameOf, slot, protectedPlayer, manual,
  select, protect, position, remove, children }: {
  player: PlanningPlayer; entry: RosterEntry; contribution?: PlayerContribution; nameOf: (id: string) => string;
  slot?: string; protectedPlayer: boolean; manual: boolean; select: () => void; protect: () => void;
  position: (value: RosterEntry["position"]) => void; remove: () => void; children?: ReactNode;
}) {
  return <div className={styles.rosterRow} data-dense-roster="">
    <button className={styles.playerButton} onClick={select} title={player.name}>
      <span>{player.name}</span><small>{player.teamAbbreviation ?? "—"} · {player.eligiblePositions.join("/") || "Eligibility unknown"}</small>
    </button>
    <RosterContribution name={player.name} contribution={contribution} nameOf={nameOf} />
    <label className={styles.rosterProtection} title={protectedPlayer ? "Protected from drops" : "Protect from drops"}>
      <input type="checkbox" checked={protectedPlayer} onChange={protect} aria-label={`Protect ${player.name}`} />
      <span className={styles.scheduleSrOnly}>Protect {player.name}</span>
    </label>
    <details className={styles.rosterManagement}>
      <summary aria-label={`Manage ${player.name}`}>⋯</summary>
      <div>
        <strong>{player.name}</strong>
        <span className={styles.currentSlot}>Selected-day local slot: {slot ?? (entry.position === "active" ? "Slot unknown" : entry.position === "bench" ? "BN" : entry.position)}</span>
        {manual ? <label>Roster position<select aria-label={`${player.name} roster position`} value={entry.position}
          onChange={event => position(event.target.value as RosterEntry["position"])}>
          <option value="active">Active</option><option value="bench">Bench</option><option value="IR">IR</option><option value="IR+">IR+</option><option value="NA">NA</option>
        </select></label> : <span>Imported position: {entry.position}</span>}
        {children}
        {manual && <button aria-label={`Remove ${player.name}`} onClick={remove}>Remove from roster</button>}
      </div>
    </details>
  </div>;
}
