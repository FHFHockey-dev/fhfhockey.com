import { CUSTOM_CSV_SESSION_KEY, findDuplicateCustomCsvId, type SessionCsvEntry } from "./csvImportSession";
import type { ProjectionSourceControls } from "./sourceControlPreferences";
import type { DraftCustomSourceMetadata } from "./summaryConfiguration";

export type BookmarkImportResult = {
  status: "accepted" | "missing_resources" | "failed";
  message: string;
};

export function recoverCustomCsvEntries(
  saved: {
    customCsvList?: SessionCsvEntry[];
    customSourceMetadata?: DraftCustomSourceMetadata[];
    sourceControls?: ProjectionSourceControls;
    goalieSourceControls?: ProjectionSourceControls;
  },
  available: SessionCsvEntry[],
) {
  const metadata = saved.customSourceMetadata ?? [];
  const ids = new Set([
    ...metadata.map((source) => source.id),
    ...Object.keys(saved.sourceControls ?? {}),
    ...Object.keys(saved.goalieSourceControls ?? {}),
  ].filter((id) => id.startsWith("custom_csv_")));
  const entries = [...(saved.customCsvList ?? available.filter((entry) => ids.has(entry.id)))];
  for (const id of ids) {
    if (entries.some((entry) => entry.id === id)) continue;
    entries.push({
      id,
      label: metadata.find((source) => source.id === id)?.label ?? id,
      playerType: saved.sourceControls?.[id] && saved.goalieSourceControls?.[id]
        ? "both" : saved.goalieSourceControls?.[id] ? "goalie" : "skater",
      rows: [],
    });
  }
  return entries;
}

// Persist replacement rows before a replacement snapshot. State is applied only
// after this succeeds; a failed snapshot write restores the previous row payload.
export function persistRecoveredDraft(
  entries: SessionCsvEntry[],
  snapshot?: string,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = window.sessionStorage,
  replaceDuplicateCsv = false,
) {
  if (findDuplicateCustomCsvId(entries)) return false;
  let previousCsv: string | null = null;
  let csvWritten = false;
  try {
    previousCsv = storage.getItem(CUSTOM_CSV_SESSION_KEY);
    const csv = JSON.stringify(entries);
    const csvChanged = csv !== (previousCsv ?? "[]") || (replaceDuplicateCsv && previousCsv === null);
    if (csvChanged) {
      storage.setItem(CUSTOM_CSV_SESSION_KEY, csv);
      csvWritten = true;
    }
    if (snapshot !== undefined) storage.setItem("draft.snapshot.v2", snapshot);
    return true;
  } catch {
    if (csvWritten) {
      try {
        if (previousCsv === null) storage.removeItem(CUSTOM_CSV_SESSION_KEY);
        else storage.setItem(CUSTOM_CSV_SESSION_KEY, previousCsv);
      } catch {}
    }
    return false;
  }
}

export function clearDraftStorage(
  targets: ReadonlyArray<readonly [Pick<Storage, "getItem" | "setItem" | "removeItem">, readonly string[]]>,
) {
  const saved = targets.flatMap(([storage, keys]) =>
    keys.map((key) => ({ storage, key, value: storage.getItem(key) })),
  );
  const removed: typeof saved = [];
  try {
    for (const entry of saved) {
      entry.storage.removeItem(entry.key);
      if (entry.value !== null) removed.push(entry);
    }
  } catch (error) {
    for (const { storage, key, value } of removed) {
      try {
        if (value !== null) storage.setItem(key, value);
      } catch {}
    }
    throw error;
  }
}
