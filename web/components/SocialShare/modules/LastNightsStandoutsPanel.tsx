import { useMemo, useState } from "react";
import type { SharePostPanelProps } from "lib/socialShare/modules/contract";
import { isHandBuilt, parsePicks, percentLabel, slateLabel, sortStandouts, STANDOUT_MAX_ROWS, STANDOUT_SORT_OPTIONS, standoutPool, standoutRows, standoutsCurrent, statText, togglePick, viewTitle, type LastNightsStandoutsData, type LastNightsStandoutsSettings, type StandoutSortKey, type StandoutSortMode } from "lib/socialShare/modules/lastNightsStandouts";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { StandoutChips } from "./LastNightsStandoutsCard";
import styles from "./LastNightsStandoutsCard.module.scss";

/** Everyone who meets the view, sortable by the night's value or by the jump against the player's own season. Clicks set the `picks` field only. */
export default function LastNightsStandoutsPanel({ data, settings, change, disabled }: SharePostPanelProps<LastNightsStandoutsSettings, LastNightsStandoutsData>) {
  const [key, setKey] = useState<StandoutSortKey>("points");
  const [mode, setMode] = useState<StandoutSortMode>("value");
  const pool = useMemo(() => standoutPool(data, settings), [data, settings]);
  const sorted = useMemo(() => sortStandouts(pool, key, mode), [pool, key, mode]);
  if (!standoutsCurrent(data, settings)) return <p className={styles.panelNote}>Refresh this post to build from these settings.</p>;
  if (!isHandBuilt(settings.view)) return <p className={styles.panelNote} data-testid="standouts-auto-note">{viewTitle(settings)} ranks itself. Change the ranking in the settings above. Only the two roster views are built by hand.</p>;
  const onCard = standoutRows(data, settings), order = onCard.map(row => row.playerId), atMax = order.length >= STANDOUT_MAX_ROWS;
  const hidden = parsePicks(settings.picks).length - order.length;
  const chooseMode = (next: StandoutSortMode) => { setMode(next); if (next === "jump" && key === "points") setKey("sog"); };
  return <div className={styles.panel}>
    <p className={styles.panelCount} data-testid="standouts-count"><b>{order.length} of {STANDOUT_MAX_ROWS}</b> on the card. The card holds {STANDOUT_MAX_ROWS}, in the order you click.{order.length > 0 && <button type="button" disabled={disabled} onClick={() => change("picks", "")}>Clear</button>}</p>
    {hidden > 0 && <p className={styles.panelNote} data-testid="standouts-hidden">{hidden} {hidden === 1 ? "pick no longer meets" : "picks no longer meet"} this view and {hidden === 1 ? "is" : "are"} off the card.</p>}
    <div className={styles.panelSort}>
      <label>Sort by<select value={key} data-testid="standouts-sort" onChange={event => setKey(event.target.value as StandoutSortKey)}>{STANDOUT_SORT_OPTIONS.map(option => <option key={option.value} value={option.value} disabled={mode === "jump" && option.value === "points"}>{option.label}</option>)}</select></label>
      <span role="group" aria-label="Sort mode">{(["value", "jump"] as const).map(option => <button key={option} type="button" aria-pressed={mode === option} data-active={mode === option || undefined} onClick={() => chooseMode(option)}>{option === "value" ? "Value" : "Jump vs STD"}</button>)}</span>
    </div>
    <p className={styles.panelNote}>{sorted.length} {viewTitle(settings).toLowerCase()} on {slateLabel(data.slate)}. % is against season per game before it.</p>
    <div className={styles.panelList} data-testid="standouts-list">
      {sorted.map(row => {
        const position = order.indexOf(row.playerId), picked = position >= 0;
        return <button key={row.playerId} type="button" className={styles.option} data-testid="standout-option" data-player={row.playerId} aria-pressed={picked} data-picked={picked || undefined} disabled={disabled || (atMax && !picked)} onClick={() => change("picks", togglePick(order.join(","), row.playerId))}>
          <span className={styles.optionHead}>
            <span className={styles.optionOrder} data-testid="pick-order">{picked ? position + 1 : "+"}</span>
            <b>{row.name ?? `Player ${row.playerId}`}</b>
            <small>{[row.team, row.position, ownershipLabel(row.ownership)].filter(Boolean).join(" · ")}</small>
          </span>
          <span className={styles.optionHead}><strong>{row.goalLine}</strong><StandoutChips row={row} /></span>
          <span className={styles.optionStats}>{row.stats.map(stat => <span key={stat.id}><small>{stat.label}</small> {statText(stat)} <i>{percentLabel(stat.change)}</i></span>)}</span>
        </button>;
      })}
      {!sorted.length && <p className={styles.panelNote}>No skater on this slate meets this view.</p>}
    </div>
  </div>;
}
