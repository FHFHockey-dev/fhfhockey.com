import type { ReactNode } from "react";
import type { PlayerContribution } from "lib/rosterScheduleOptimizer/contributionLedger";
import type { PlanningPlayer, RosterEntry } from "lib/rosterScheduleOptimizer/planningTypes";
import { retentionCaution, retentionCautionText } from "lib/rosterScheduleOptimizer/retention";
import RosterContribution from "./RosterContribution";
import styles from "./RosterScheduleOptimizer.module.scss";
import Image from "next/image";
import { getLocalTeamLogoPath, fallbackTeamLogo } from "lib/images";

export default function RosterPlayerRow({ player, entry, contribution, nameOf, slot, protectedPlayer, manual,
  select, protect, position, remove, children, dropCandidate = false, unprojected = false }: {
  player: PlanningPlayer; entry: RosterEntry; contribution?: PlayerContribution; nameOf: (id: string) => string;
  slot?: string; protectedPlayer: boolean; manual: boolean; select: () => void; protect: () => void;
  position: (value: RosterEntry["position"]) => void; remove: () => void; children?: ReactNode;
  /** The weakest droppable player in the no-move lineup. */
  dropCandidate?: boolean;
  /** Droppable, but with no projection: ranked last and never the suggested drop. */
  unprojected?: boolean;
}) {
  const caution = dropCandidate ? retentionCaution(player) : null;
  const cautionText = caution && retentionCautionText(caution);
  const injury = player.injury ? `${player.injury.label}${player.injury.note ? ` · ${player.injury.note}` : ""}` : null;
  return <div className={styles.rosterRow} data-dense-roster="" {...(injury ? { "data-injured": "" } : {})}>
    <button className={styles.playerButton} onClick={select} title={player.name}>
      <Image src={getLocalTeamLogoPath(player.teamAbbreviation)} alt="" width={24} height={24} onError={event => { event.currentTarget.src = fallbackTeamLogo; }} />
      <span><span>{player.name}{injury && <Image className={styles.injuryIcon} src="/pictures/injured.png" alt={injury} title={injury} width={12} height={12} />}{dropCandidate && <em className={styles.dropChip} title="Weakest droppable player this week">DROP</em>}{unprojected && <em className={styles.unprojectedChip} title="No projection for this player's games; not ranked as a drop">no projection</em>}{entry.position !== "active" && entry.position !== "bench" && <em className={styles.reserveChip}>{entry.position}</em>}</span><small>{player.teamAbbreviation ?? "—"} · {player.eligiblePositions.join("/") || "Positions unknown"}</small>{cautionText && <small className={styles.dropCaution} data-caution={caution!.level}>{cautionText}</small>}</span>
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
