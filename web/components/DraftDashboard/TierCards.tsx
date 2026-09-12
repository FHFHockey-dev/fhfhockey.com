import { advisePosition, remainingBands, type PositionTiers, type TierPlayer } from "lib/draftDashboard/positionalTiers";
import type { SelectionHorizon } from "lib/draftDashboard/availability";
import styles from "./SuggestedPicks.module.scss";

type Props = {
  positions: PositionTiers[]; available: ReadonlySet<string>; filter: string;
  selectedPositions: ReadonlySet<string>; horizon: SelectionHorizon | null;
  spread: number; onClock: boolean; contextReady: boolean;
  rosterProgress?: { pos: string; filled: number; total: number }[];
  leagueType: "points" | "categories";
  onExplore: (position: string) => void; onSelect: (id: string) => void;
  selectedId: string | null; onDraft?: (id: string) => void; canDraft: boolean;
};

export function TierCards({ positions, available, filter, selectedPositions, horizon, spread, onClock, contextReady, rosterProgress, leagueType, onExplore, onSelect, selectedId, onDraft, canDraft }: Props) {
  const visible = positions.filter(({ position }) => selectedPositions.size
    ? selectedPositions.has(position)
    : filter === "ALL" || (filter === "Skater" && position !== "G") || (filter === "Goalie" && position === "G") || filter === position);
  const detail = visible.length === 1;
  const unit = leagueType === "categories" ? "category score" : "FP";
  const playerRow = (player: TierPlayer) => <div className={styles.tierPlayer} key={player.id} data-player-id={available.has(player.id) ? player.id : undefined}>
    <button type="button" onClick={() => onSelect(player.id)} aria-pressed={selectedId === player.id} title={player.name}>{player.name}</button>
    <span>{player.value === null ? "Insufficient projection data" : player.value.toFixed(1)}</span>
    {available.has(player.id) ? onDraft && <button type="button" disabled={!canDraft} onClick={() => onDraft(player.id)} aria-label={`Draft ${player.name}`} title={!canDraft ? "Drafting is unavailable in the current draft state" : undefined}>Draft</button> : <span>Drafted / keeper</span>}
  </div>;
  return <>
    {visible.flatMap(tiers => {
      const slot = rosterProgress?.find(item => item.pos === tiers.position);
      const utility = tiers.position !== "G" && rosterProgress?.some(item => ["UTIL", "UTILITY", "FWD"].includes(item.pos) && (item.pos !== "FWD" || ["C", "LW", "RW", "FWD"].includes(tiers.position)) && item.filled < item.total);
      const advice = advisePosition(tiers, available, horizon, spread, onClock, Boolean((slot && slot.filled < slot.total) || utility), contextReady);
      const bands = remainingBands(tiers, available);
      const shown = detail ? bands : advice.band ? [advice.band] : bands.slice(0, 1);
      const availableMissing = tiers.missing.filter(player => available.has(player.id));
      return [<article key={`${tiers.position}-summary`} className={styles.tierCard} role="listitem">
        <h3>{tiers.position} · {advice.label}</h3>
        <p>{advice.expected === null ? "Depletion estimate unavailable" : `${advice.expected.toFixed(1)} comparable players estimated to remain`}{advice.targetPick !== null ? ` at pick #${advice.targetPick}` : ""}.</p>
        {!onClock && horizon && <p>Preview for your upcoming turn.</p>}
        {advice.band?.gap != null && <p>{advice.band.gap.toFixed(1)} {unit} to the next available band · {advice.band.meaningfulBreak ? "Meaningful break" : "Value band"}</p>}
        <p className={styles.tierCaveat}>ADP estimate; a particular player may not survive. Similar value can mean different category strengths.</p>
        {!detail && <button type="button" onClick={() => onExplore(tiers.position === "G" ? "Goalie" : tiers.position)}>Explore {tiers.position} tiers</button>}
        {!detail && shown.map(band => <div key={band.tier ?? "values"}>
          <strong>{tiers.position} · {band.tier === null ? "Values only" : `Tier ${band.tier}`}</strong>
          <p>{band.remaining.length} / {band.players.length} available · {band.min.toFixed(1)}–{band.max.toFixed(1)} {unit}</p>
        </div>)}
        {!bands.length && <p>No scored players for this position.</p>}
        {availableMissing.length > 0 && <p>{availableMissing.length} players: insufficient projection data. Advice is uncertain.</p>}
      </article>, ...(detail ? shown.map(band => <article key={`${tiers.position}-${band.tier ?? "values"}`} className={styles.tierCard} role="listitem">
        <h3>{tiers.position} · {band.tier === null ? "Values only — too few players" : `Tier ${band.tier}`}</h3>
        <p>{band.remaining.length} / {band.players.length} available · {band.min.toFixed(1)}–{band.max.toFixed(1)} {unit}</p>
        <p>{band.gap === null ? "No lower available band" : `${band.gap.toFixed(1)} ${unit} drop · ${band.meaningfulBreak ? "Meaningful break" : "Value band"}`}</p>
        {band.players.map(playerRow)}
      </article>) : []), ...(detail && tiers.missing.length ? [<article key={`${tiers.position}-missing`} className={styles.tierCard} role="listitem"><h3>Insufficient projection data</h3>{tiers.missing.map(playerRow)}</article>] : [])];
    })}
    {!visible.length && <p role="status">No positional tiers match this filter.</p>}
  </>;
}
