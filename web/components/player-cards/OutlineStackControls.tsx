import React, { useId, useRef } from "react";
import { moveOutlineRing, outlineTotal, OUTLINE_LIMITS, readOutlineDraft, teamOutlineColors, type OutlineDraftRing } from "../../lib/player-cards/outlineStack";
import styles from "./OutlineStackControls.module.scss";

export default function OutlineStackControls({ team, draft, disabled = false, pending, onChange, onReset }: { team: string; draft: OutlineDraftRing[]; disabled?: boolean; pending: boolean; onChange: (draft: OutlineDraftRing[]) => void; onReset: () => void }) {
  const uid = useId().replace(/:/g, ""), nextId = useRef(0), presets = teamOutlineColors(team), parsed = readOutlineDraft(draft);
  const total = parsed.rings ? outlineTotal(parsed.rings) : null;
  const change = (id: string, fields: Partial<OutlineDraftRing>) => onChange(draft.map(ring => ring.id === id ? { ...ring, ...fields } : ring));
  function move(index: number, direction: -1 | 1) {
    const id = draft[index].id; onChange(moveOutlineRing(draft, index, direction));
    requestAnimationFrame(() => document.getElementById(`${uid}-${id}-color`)?.focus());
  }
  return <section className={styles.editor} aria-label="Outline stack editor">
    <div className={styles.heading}><h2>Outline stack</h2><button type="button" disabled={disabled} onClick={onReset}>Reset team stack</button></div>
    <p>Inside → outside · {total === null ? "Check widths" : `${total} px total`}. Up to 5 rings, 0.5–12 px each, 40 px total.</p>
    <p className={styles.hint}>Move buttons work with the keyboard. Empty stack means no outlines. Adjacent matching colors appear as one wider band.</p>
    {draft.map((ring, index) => <fieldset key={ring.id} disabled={disabled} className={styles.ring}>
      <legend>Ring {index + 1}{index === 0 ? " · innermost" : index === draft.length - 1 ? " · outermost" : ""}</legend>
      <div className={styles.fields}>
        <label htmlFor={`${uid}-${ring.id}-color`}>Color<select id={`${uid}-${ring.id}-color`} aria-label={`Ring ${index + 1} color`} value={ring.colorMode === "custom" ? "custom" : ring.color} onChange={event => change(ring.id, event.target.value === "custom" ? { colorMode: "custom" } : { colorMode: "preset", color: event.target.value })}>{presets.map(option => <option key={option.id} value={option.color}>{option.label}</option>)}<option value="custom">Custom color…</option></select></label>
        {ring.colorMode === "custom" && <label>Custom<input type="color" aria-label={`Ring ${index + 1} custom color`} value={ring.color} onChange={event => change(ring.id, { color: event.target.value })} /></label>}
        <label>Width (px)<input type="number" inputMode="decimal" min={OUTLINE_LIMITS.minWidth} max={OUTLINE_LIMITS.maxWidth} step="0.5" aria-label={`Ring ${index + 1} width`} aria-invalid={!!parsed.error} value={ring.width} onChange={event => change(ring.id, { width: event.target.value })} /></label>
        <div className={styles.moves}><button type="button" aria-label={`Move ring ${index + 1} inward`} disabled={disabled || index === 0} onClick={() => move(index, -1)}>← Inward</button><button type="button" aria-label={`Move ring ${index + 1} outward`} disabled={disabled || index === draft.length - 1} onClick={() => move(index, 1)}>Outward →</button><button type="button" aria-label={`Remove ring ${index + 1}`} onClick={() => onChange(draft.filter(item => item.id !== ring.id))}>Remove</button></div>
      </div>
    </fieldset>)}
    {!draft.length && <p>No outlines. Add a ring to start.</p>}
    <button type="button" disabled={disabled || draft.length >= OUTLINE_LIMITS.rings || total === null || total + 5 > OUTLINE_LIMITS.totalWidth} onClick={() => onChange([...draft, { id: `${uid}-added-${nextId.current++}`, color: "#FFFFFF", width: "5", colorMode: "preset" }])}>Add outline</button>
    {parsed.error ? <p role="alert">{parsed.error}</p> : <p role="status" aria-live="polite">{pending ? "Updating outline preview…" : "Outline stack applied."}</p>}
  </section>;
}
