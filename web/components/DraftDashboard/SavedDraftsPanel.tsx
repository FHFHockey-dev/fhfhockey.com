import { useState } from "react";

import type { SavedDraftSummary } from "hooks/useSavedDrafts";
import styles from "./SavedDraftsPanel.module.scss";

type Props = {
  eligible: boolean;
  drafts: SavedDraftSummary[];
  status: "idle" | "loading" | "saving" | "saved" | "error";
  error: string | null;
  onOpen(id: string): void;
  onSave(): void;
  onRename(id: string, name: string, expectedVersion: number): void;
  onDuplicate(id: string, name: string, expectedVersion: number): void;
  onDelete(id: string, expectedVersion: number): void;
  onReloadConflict?(): void;
  onSaveAsAnother?(): void;
};

/** Focused, lazy-mountable composition surface; dashboard ownership stays W07. */
export function SavedDraftsPanel({ eligible, drafts, status, error, onOpen, onSave, onRename, onDuplicate, onDelete, onReloadConflict, onSaveAsAnother }: Props) {
  const [name, setName] = useState("");
  return <section className={styles.panel} aria-label="Saved Drafts">
    <div className={styles.heading}><h2>Saved Drafts</h2>{eligible ? <button type="button" onClick={onSave} disabled={status === "saving"}>Save to account</button> : null}</div>
    <p className={styles.status} role="status">{!eligible ? "Draft Pro is inactive. Your retained draft names are shown below; local saving continues in this browser." : status === "saving" ? "Saving to account…" : status === "saved" ? "Saved to account." : "Cloud autosave waits two seconds after changes. Local saving remains immediate."}</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {error && onReloadConflict && onSaveAsAnother ? <p><button type="button" onClick={onReloadConflict}>Reload saved version</button><button type="button" onClick={onSaveAsAnother}>Save as another draft</button></p> : null}
    <ul className={styles.list}>{drafts.map((draft) => <li key={draft.id}>
      <button type="button" onClick={() => onOpen(draft.id)} disabled={!eligible}>{draft.name}</button><span>{new Date(draft.updatedAt).toLocaleString()}</span>
      {eligible ? <><input aria-label={`Rename ${draft.name}`} value={name} onChange={(event) => setName(event.target.value)} placeholder="New name" />
      <button type="button" onClick={() => name.trim() && onRename(draft.id, name.trim(), draft.lockVersion)}>Rename</button>
      <button type="button" onClick={() => onDuplicate(draft.id, `${draft.name} copy`, draft.lockVersion)}>Duplicate</button>
      <button type="button" onClick={() => window.confirm(`Delete ${draft.name}?`) && onDelete(draft.id, draft.lockVersion)}>Delete</button></> : null}
    </li>)}</ul>
  </section>;
}
