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
export function SavedDraftsPanel({ eligible, drafts, status, error, onOpen, onSave, onRename, onDuplicate, onDelete, onReloadConflict, onSaveAsAnother, players, openedWorkspaceAnnotations, onAnnotationsChange }: Props) {
  const [name, setName] = useState("");
  const [renameNames, setRenameNames] = useState<Record<string, string>>({});
  const saveName = name.trim();
  const controlledAnnotations = openedWorkspaceAnnotations;
  const selectedPlayer = players?.find((player) => player.id === controlledAnnotations?.selectedPlayerId);
  const selectedNote = selectedPlayer ? controlledAnnotations?.notes.find((note) => note.id === selectedPlayer.id) : undefined;
  const canEditAnnotations = Boolean(eligible && players && controlledAnnotations && onAnnotationsChange);
  const updateAnnotations = (next: SavedDraftAnnotations) => onAnnotationsChange?.(next);
  const duplicateName = (draft: SavedDraftSummary) => `${draft.name} copy`.slice(0, MAX_NAME_LENGTH);
  return <section className={styles.panel} aria-label="Saved Drafts">
    <div className={styles.heading}><h2>Saved Drafts</h2>{eligible ? <div className={styles.saveControls}><label htmlFor="new-saved-draft-name">Name</label><input id="new-saved-draft-name" value={name} maxLength={MAX_NAME_LENGTH} onChange={(event) => setName(event.target.value)} placeholder="Draft name" /><button type="button" onClick={() => onSave(saveName)} disabled={status === "saving" || !saveName}>Save to account</button><span className={styles.privateImportHint}>Private imports upload only when you explicitly save to your account.</span></div> : null}</div>
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
    {canEditAnnotations && controlledAnnotations && players ? <fieldset className={styles.annotations}><legend>Workspace notes and tiers</legend><label htmlFor="annotation-player">Player</label><select id="annotation-player" value={controlledAnnotations.selectedPlayerId ?? ""} onChange={(event) => updateAnnotations({ ...controlledAnnotations, selectedPlayerId: event.target.value || null })}><option value="">Select a player</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>{selectedPlayer ? <div className={styles.annotationRows}><label htmlFor="player-note">Note for {selectedPlayer.name}</label><textarea id="player-note" maxLength={5000} value={selectedNote?.text ?? ""} onChange={(event) => { const notes = controlledAnnotations.notes.filter((note) => note.id !== selectedPlayer.id); if (event.target.value) notes.push({ id: selectedPlayer.id, text: event.target.value }); updateAnnotations({ ...controlledAnnotations, notes }); }} /><label htmlFor="player-tier">Tier for {selectedPlayer.name}</label><input id="player-tier" maxLength={80} value={controlledAnnotations.tiers[selectedPlayer.id] ?? ""} onChange={(event) => { const tiers = { ...controlledAnnotations.tiers }; if (event.target.value) tiers[selectedPlayer.id] = event.target.value; else delete tiers[selectedPlayer.id]; updateAnnotations({ ...controlledAnnotations, tiers }); }} /></div> : <p>Select a player to edit their note and tier.</p>}</fieldset> : null}
  </section>;
}
