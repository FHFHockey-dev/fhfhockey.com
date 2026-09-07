import { useState } from "react";

import type { SavedDraftSummary } from "hooks/useSavedDrafts";
import styles from "./SavedDraftsPanel.module.scss";

type Props = {
  eligible: boolean;
  drafts: SavedDraftSummary[];
  status: "idle" | "loading" | "saving" | "saved" | "error";
  error: string | null;
  onOpen(id: string): void;
  onSave(name: string): void;
  onRename(id: string, name: string, expectedVersion: number): void;
  onDuplicate(id: string, name: string, expectedVersion: number): void;
  onDelete(id: string, expectedVersion: number): void;
  onReloadConflict?(): void;
  onSaveAsAnother?(): void;
  /** Optional controlled workspace annotations surface for W07 integration. */
  players?: readonly SavedDraftAnnotationPlayer[];
  annotationPlayers?: readonly SavedDraftAnnotationPlayer[];
  annotations?: SavedDraftAnnotations;
  openedWorkspaceAnnotations?: SavedDraftAnnotations;
  onAnnotationsChange?(next: SavedDraftAnnotations): void;
};

export type SavedDraftAnnotationPlayer = Readonly<{ id: string; name: string }>;
export type SavedDraftAnnotationNote = Readonly<{ id: string; text: string }>;
export type SavedDraftAnnotations = Readonly<{
  selectedPlayerId: string | null;
  notes: readonly SavedDraftAnnotationNote[];
  tiers: Readonly<Record<string, string>>;
}>;

const MAX_NAME_LENGTH = 120;

/** Focused, lazy-mountable composition surface; dashboard ownership stays W07. */
export function SavedDraftsPanel({ eligible, drafts, status, error, onOpen, onSave, onRename, onDuplicate, onDelete, onReloadConflict, onSaveAsAnother, players, annotationPlayers, annotations, openedWorkspaceAnnotations, onAnnotationsChange }: Props) {
  const [name, setName] = useState("");
  const [renameNames, setRenameNames] = useState<Record<string, string>>({});
  const [tierDraft, setTierDraft] = useState("");
  const saveName = name.trim();
  const annotationPlayersList = annotationPlayers ?? players;
  const controlledAnnotations = openedWorkspaceAnnotations ?? annotations;
  const canEditAnnotations = Boolean(eligible && annotationPlayersList && controlledAnnotations && onAnnotationsChange);
  const updateAnnotations = (next: SavedDraftAnnotations) => onAnnotationsChange?.(next);
  const duplicateName = (draft: SavedDraftSummary) => `${draft.name} copy`.slice(0, MAX_NAME_LENGTH);
  return <section className={styles.panel} aria-label="Saved Drafts">
    <div className={styles.heading}><h2>Saved Drafts</h2>{eligible ? <div className={styles.saveControls}><label htmlFor="new-saved-draft-name">Name</label><input id="new-saved-draft-name" value={name} maxLength={MAX_NAME_LENGTH} onChange={(event) => setName(event.target.value)} placeholder="Draft name" /><button type="button" onClick={() => { onSave(saveName); setName(""); }} disabled={status === "saving" || !saveName}>Save to account</button><span className={styles.privateImportHint}>Private imports upload only when you explicitly save to your account.</span></div> : null}</div>
    <p className={styles.status} role="status">{!eligible ? "Draft Pro is inactive. Saved draft names remain available below, but account actions are locked; local saving continues in this browser." : status === "saving" ? "Saving to account…" : status === "saved" ? "Saved to account." : "Cloud autosave waits two seconds after changes. Local saving remains immediate."}</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {error && onReloadConflict && onSaveAsAnother ? <p><button type="button" onClick={onReloadConflict} disabled={!eligible || status === "saving"}>Reload saved version</button><button type="button" onClick={onSaveAsAnother} disabled={!eligible || status === "saving"}>Save as another draft</button></p> : null}
    <ul className={styles.list}>{drafts.map((draft) => <li key={draft.id}>
      <button type="button" onClick={() => onOpen(draft.id)} disabled={!eligible}>{draft.name}</button><span>{new Date(draft.updatedAt).toLocaleString()}</span>
      {eligible ? <><input aria-label={`Rename ${draft.name}`} value={renameNames[draft.id] ?? ""} maxLength={MAX_NAME_LENGTH} onChange={(event) => setRenameNames((current) => ({ ...current, [draft.id]: event.target.value }))} placeholder="New name" />
      <button type="button" onClick={() => { const next = (renameNames[draft.id] ?? "").trim(); if (next) onRename(draft.id, next, draft.lockVersion); }} disabled={status === "saving" || !(renameNames[draft.id] ?? "").trim()}>Rename</button>
      <button type="button" onClick={() => onDuplicate(draft.id, duplicateName(draft), draft.lockVersion)} disabled={status === "saving"}>Duplicate</button>
      <button type="button" onClick={() => window.confirm(`Delete ${draft.name}?`) && onDelete(draft.id, draft.lockVersion)} disabled={status === "saving"}>Delete</button></> : <span className={styles.locked}>Account actions locked while Draft Pro is inactive.</span>}
    </li>)}</ul>
    {canEditAnnotations && controlledAnnotations && annotationPlayersList ? <fieldset className={styles.annotations}><legend>Workspace notes and tiers</legend><label htmlFor="annotation-player">Player</label><select id="annotation-player" value={controlledAnnotations.selectedPlayerId ?? ""} onChange={(event) => updateAnnotations({ ...controlledAnnotations, selectedPlayerId: event.target.value || null })}><option value="">Select a player</option>{annotationPlayersList.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><div className={styles.annotationRows}><strong>Notes</strong>{controlledAnnotations.notes.map((note, index) => <div className={styles.annotationRow} key={note.id}><textarea aria-label={`Note ${index + 1}`} maxLength={5000} value={note.text} onChange={(event) => updateAnnotations({ ...controlledAnnotations, notes: controlledAnnotations.notes.map((current) => current.id === note.id ? { ...current, text: event.target.value } : current) })} /><button type="button" onClick={() => updateAnnotations({ ...controlledAnnotations, notes: controlledAnnotations.notes.filter((current) => current.id !== note.id) })}>Remove note</button></div>)}<button type="button" onClick={() => updateAnnotations({ ...controlledAnnotations, notes: [...controlledAnnotations.notes, { id: `note-${Date.now()}`, text: "" }] })}>Add note</button><strong>Tiers</strong>{Object.entries(controlledAnnotations.tiers).map(([label, value]) => <div className={styles.annotationRow} key={label}><input aria-label={`Tier label ${label}`} maxLength={80} value={label} onChange={(event) => { const next = { ...controlledAnnotations.tiers }; delete next[label]; next[event.target.value.slice(0, 80)] = value; updateAnnotations({ ...controlledAnnotations, tiers: next }); }} /><input aria-label={`Tier value ${label}`} value={value} onChange={(event) => updateAnnotations({ ...controlledAnnotations, tiers: { ...controlledAnnotations.tiers, [label]: event.target.value } })} /></div>)}<div className={styles.annotationRow}><input aria-label="New tier label" maxLength={80} value={tierDraft} onChange={(event) => setTierDraft(event.target.value)} placeholder="Tier label" /><button type="button" onClick={() => { const label = tierDraft.trim().slice(0, 80); if (!label || label in controlledAnnotations.tiers) return; updateAnnotations({ ...controlledAnnotations, tiers: { ...controlledAnnotations.tiers, [label]: "" } }); setTierDraft(""); }} disabled={!tierDraft.trim()}>Add tier</button></div></div></fieldset> : null}
  </section>;
}
