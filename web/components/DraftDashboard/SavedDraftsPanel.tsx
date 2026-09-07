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
  onDuplicate(id: string, name: string): void;
  onDelete(id: string, expectedVersion: number): void;
};

/** Focused, lazy-mountable composition surface; dashboard ownership stays W07. */
export function SavedDraftsPanel({ eligible, drafts, status, error, onOpen, onSave, onRename, onDuplicate, onDelete }: Props) {
  const [name, setName] = useState("");
  if (!eligible) return <section className={styles.panel} aria-label="Saved Drafts"><h2>Saved Drafts</h2><p>Draft Pro access is required. Your draft continues saving locally in this browser.</p></section>;
  return <section className={styles.panel} aria-label="Saved Drafts">
    <div className={styles.heading}><h2>Saved Drafts</h2><button type="button" onClick={onSave} disabled={status === "saving"}>Save to account</button></div>
    <p className={styles.status} role="status">{status === "saving" ? "Saving to account…" : status === "saved" ? "Saved to account." : "Cloud autosave waits two seconds after changes. Local saving remains immediate."}</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <ul className={styles.list}>{drafts.map((draft) => <li key={draft.id}>
      <button type="button" onClick={() => onOpen(draft.id)}>{draft.name}</button><span>{new Date(draft.updatedAt).toLocaleString()}</span>
      <input aria-label={`Rename ${draft.name}`} value={name} onChange={(event) => setName(event.target.value)} placeholder="New name" />
      <button type="button" onClick={() => name.trim() && onRename(draft.id, name.trim(), draft.lockVersion)}>Rename</button>
      <button type="button" onClick={() => onDuplicate(draft.id, `${draft.name} copy`)}>Duplicate</button>
      <button type="button" onClick={() => window.confirm(`Delete ${draft.name}?`) && onDelete(draft.id, draft.lockVersion)}>Delete</button>
    </li>)}</ul>
  </section>;
}
