import React from "react";
import OutlineStackControls from "./OutlineStackControls";
import type { PlayerArtworkController } from "./usePlayerArtwork";
import { isPortraitStyle, PORTRAIT_STYLES, PORTRAIT_LABELS } from "../../lib/player-cards/portraitTreatment";
import { type OutlineInk } from "../../lib/player-cards/alphaOutline";
export default function PlayerArtworkControls({ artwork, team, busy, onChange, editor = false }: { artwork: PlayerArtworkController; team: string; busy: boolean; onChange: () => void; editor?: boolean }) {
  const { portraitStyle, setPortraitStyle, ink, inks, selectedInk, appliedRings, setOutlineInk, treating, outlineDraft, setOutlineDraft, customPending, resetOutline } = artwork;
  if (editor) return <>    {ink === "custom" && <OutlineStackControls team={team} draft={outlineDraft} disabled={busy} pending={customPending || treating} onChange={draft => { onChange(); setOutlineDraft(draft); }} onReset={() => { onChange(); resetOutline(); }} />}
</>;
  return <>      <label>Portrait style<select aria-label="Portrait style" value={portraitStyle} disabled={busy || treating} onChange={e => {
        const value = e.target.value; if (!isPortraitStyle(value)) return;
        onChange(); setPortraitStyle(value);
      }}>{PORTRAIT_STYLES.map(style => <option key={style} value={style}>{PORTRAIT_LABELS[style]}</option>)}</select></label>
      <label><span>Outline <span aria-hidden="true" style={{ display: "inline-block", width: 18, height: 12, background: ink === "custom" ? appliedRings.length ? `linear-gradient(to right, ${appliedRings.map(r => r.color).join(",")})` : "transparent" : selectedInk.bands ? `linear-gradient(to right, ${selectedInk.bands.join(",")})` : selectedInk.color, border: "1px solid #b6b9bc" }} /></span><select aria-label="Outline color" value={ink} disabled={busy || treating} onChange={event => { if (!inks.some(option => option.id === event.target.value)) return; onChange(); setOutlineInk(event.target.value as OutlineInk); }}>{inks.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
</>;
}
