import { scenarioFingerprint } from "lib/draft-pro/scenarios";
import { CUSTOM_CSV_SESSION_KEY, LEGACY_CUSTOM_CSV_SESSION_KEYS, findDuplicateCustomCsvId, type SessionCsvEntry } from "./csvImportSession";
import type { ProjectionSourceControls } from "./sourceControlPreferences";
import type { DraftCustomSourceMetadata } from "./summaryConfiguration";

export const LEGACY_DRAFT_TAB_KEY = "draft.snapshot.v4";

export function isLegacyDraftV4(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).v === 4;
}

// Map the old writer's names onto the current bookmark validator and restore boundary.
export function normalizeLegacyDraftV4(data: Record<string, unknown>) {
  const draftHistory = data.draftHistory === undefined ? [] : data.draftHistory;
  if (!Array.isArray(draftHistory) ||
    (data.prorate84 !== undefined && typeof data.prorate84 !== "boolean") ||
    (data.riskSd !== undefined && (typeof data.riskSd !== "number" || !Number.isFinite(data.riskSd)))) {
    throw new Error("Invalid legacy draft history or analysis preferences.");
  }
  const attachments = data.customCsvEntries === undefined ? data.customCsvList : data.customCsvEntries;
  const sources = data.csvMetadata === undefined
    ? data.customSourceMetadata ?? attachments ?? []
    : data.csvMetadata;
  if (!Array.isArray(sources) || sources.some((source) =>
    !source || typeof source !== "object" ||
    typeof source.id !== "string" || !source.id.startsWith("custom_csv_") ||
    typeof source.label !== "string"
  ) || new Set(sources.map(({ id }) => id)).size !== sources.length) {
    throw new Error("Invalid or duplicate projection source metadata in the legacy draft.");
  }
  return {
    ...data, v: 3,
    settings: data.settings ?? data.draftSettings,
    goalieScoringCategories: data.goalieScoringCategories ?? data.goaliePointValues,
    customSourceMetadata: sources, customCsvList: attachments, draftHistory,
  };
}

export type BookmarkImportResult = {
  status: "accepted" | "missing_resources" | "failed";
  message: string;
};

export type DraftTabCsvMetadata = DraftCustomSourceMetadata & {
  contentFingerprint?: string;
  playerType?: SessionCsvEntry["playerType"];
};

// Match the stored JSON shape, including rows, without putting it in each draft save.
function csvEntryFingerprint(entry: SessionCsvEntry) {
  return scenarioFingerprint(JSON.stringify(entry));
}

export function toDraftTabCsvMetadata(entries: readonly SessionCsvEntry[]): DraftTabCsvMetadata[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    playerType: entry.playerType,
    ...(entry.rows?.length ? { contentFingerprint: csvEntryFingerprint(entry) } : { missing: true }),
  }));
}

export function recoverCustomCsvEntries(
  saved: {
    customCsvList?: SessionCsvEntry[];
    customSourceMetadata?: DraftTabCsvMetadata[];
    tabCsvSidecar?: true;
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
  const availableRows = available.filter((entry) => {
    if (!ids.has(entry.id)) return false;
    if (!saved.tabCsvSidecar) return true;
    const source = metadata.find(({ id }) => id === entry.id);
    return source?.contentFingerprint === csvEntryFingerprint(entry);
  });
  const entries = [...(saved.customCsvList ?? availableRows)];
  for (const id of ids) {
    if (entries.some((entry) => entry.id === id)) continue;
    const source = metadata.find((source) => source.id === id);
    entries.push({
      id,
      label: source?.label ?? id,
      playerType: source?.playerType ?? (saved.sourceControls?.[id] && saved.goalieSourceControls?.[id]
        ? "both" : saved.goalieSourceControls?.[id] ? "goalie" : "skater"),
      rows: [],
    });
  }
  return entries;
}

function storedProjectionRowsMatch(previous: string | null, entries: SessionCsvEntry[]) {
  const withRows = (entry: SessionCsvEntry) => Array.isArray(entry?.rows) && entry.rows.length > 0;
  try {
    const priorEntries = JSON.parse(previous ?? "[]");
    return Array.isArray(priorEntries) &&
      JSON.stringify(priorEntries.filter(withRows)) === JSON.stringify(entries.filter(withRows));
  } catch {
    return false;
  }
}

// Persist replacement rows before a replacement snapshot. State is applied only
// after this succeeds; a failed snapshot write restores the previous row payload.
export function persistRecoveredDraft(
  entries: SessionCsvEntry[],
  snapshot?: string,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = window.sessionStorage,
  { writeEmptyCsvList = false, onlyChangedRows = false } = {},
) {
  if (findDuplicateCustomCsvId(entries)) return false;
  let previousCsv: string | null = null;
  let csvWritten = false;
  try {
    previousCsv = storage.getItem(CUSTOM_CSV_SESSION_KEY);
    const csv = JSON.stringify(entries);
    // Do not leave a stale legacy list authoritative after an explicit recovery.
    const maskLegacy = writeEmptyCsvList && previousCsv === null && (
      !onlyChangedRows || LEGACY_CUSTOM_CSV_SESSION_KEYS.some((key) => storage.getItem(key) !== null)
    );
    const csvChanged = maskLegacy || (onlyChangedRows
      ? !storedProjectionRowsMatch(previousCsv, entries)
      : csv !== (previousCsv ?? "[]"));
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
