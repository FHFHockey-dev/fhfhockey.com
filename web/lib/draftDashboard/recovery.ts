import { CUSTOM_CSV_SESSION_KEY, type SessionCsvEntry } from "./csvImportSession";
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
) {
  let previousCsv: string | null = null;
  let csvWritten = false;
  try {
    previousCsv = storage.getItem(CUSTOM_CSV_SESSION_KEY);
    const csv = JSON.stringify(entries);
    const csvChanged = csv !== (previousCsv ?? "[]");
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
