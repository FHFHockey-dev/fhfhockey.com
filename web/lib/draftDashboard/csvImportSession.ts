export const CUSTOM_CSV_SESSION_KEY = "draft.customCsvList.v3";
export const LEGACY_CUSTOM_CSV_SESSION_KEYS = [
  "draft.customCsvList.v2",
  "draft.customCsv.v1"
] as const;

export type SessionCsvEntry = {
  id: string;
  label: string;
  playerType?: "skater" | "goalie" | "both";
  headers?: { original: string; standardized: string; selected: boolean }[];
  rows?: Record<string, unknown>[];
  resolution?: {
    totalRows: number;
    idMatched: number;
    nameMatched: number;
    fuzzyMatched?: number;
    manualOverrides?: number;
    invalidIds?: number;
    unresolved: number;
    coverage: number;
    lastUpdated: number;
    unresolvedNames: string[];
  };
};

function isSessionCsvEntry(value: unknown): value is SessionCsvEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<SessionCsvEntry>;
  return (
    typeof entry.id === "string" &&
    entry.id.startsWith("custom_csv_") &&
    typeof entry.label === "string" &&
    Array.isArray(entry.rows)
  );
}

function parseList(raw: string | null): SessionCsvEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSessionCsvEntry) : [];
  } catch {
    return [];
  }
}

export function findDuplicateCustomCsvId(entries: readonly Pick<SessionCsvEntry, "id">[]) {
  const ids = new Set<string>();
  for (const { id } of entries) {
    if (ids.has(id)) return id;
    ids.add(id);
  }
}

export function createCustomCsvId(
  entries: readonly Pick<SessionCsvEntry, "id">[],
  randomId: () => string = () =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
): string {
  const existingIds = new Set(entries.map((entry) => entry.id));
  let id = `custom_csv_${randomId()}`;
  while (existingIds.has(id)) id = `custom_csv_${randomId()}`;
  return id;
}

export function saveCustomCsvSession(
  entries: SessionCsvEntry[],
  storage: Pick<Storage, "setItem"> = window.sessionStorage
) {
  const duplicateId = findDuplicateCustomCsvId(entries);
  if (duplicateId) throw new Error(`Duplicate projection CSV source ID "${duplicateId}".`);
  storage.setItem(CUSTOM_CSV_SESSION_KEY, JSON.stringify(entries));
}

export function loadCustomCsvSession(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> =
    window.sessionStorage
): SessionCsvEntry[] {
  const result = loadCustomCsvSessionResult(storage);
  if ("duplicateId" in result) {
    throw new Error(`Duplicate projection CSV source ID "${result.duplicateId}".`);
  }
  return result.entries;
}

export function loadCustomCsvSessionResult(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> =
    window.sessionStorage
): { entries: SessionCsvEntry[] } | { duplicateId: string } {
  const currentRaw = storage.getItem(CUSTOM_CSV_SESSION_KEY);
  const current = parseList(currentRaw);
  const currentDuplicateId = findDuplicateCustomCsvId(current);
  if (currentDuplicateId) return { duplicateId: currentDuplicateId };
  // An explicitly emptied current list supersedes legacy data.
  if (current.length || currentRaw === "[]") return { entries: current };

  const legacyList = parseList(storage.getItem("draft.customCsvList.v2"));
  let migrated = legacyList;

  if (!migrated.length) {
    const legacySingleRaw = storage.getItem("draft.customCsv.v1");
    if (legacySingleRaw) {
      try {
        const legacySingle = JSON.parse(legacySingleRaw);
        const candidate = {
          ...legacySingle,
          id: "custom_csv_1",
          label: legacySingle?.label || "Custom CSV"
        };
        if (isSessionCsvEntry(candidate)) migrated = [candidate];
      } catch {
        migrated = [];
      }
    }
  }

  const migratedDuplicateId = findDuplicateCustomCsvId(migrated);
  if (migratedDuplicateId) return { duplicateId: migratedDuplicateId };
  if (migrated.length) saveCustomCsvSession(migrated, storage);
  for (const key of LEGACY_CUSTOM_CSV_SESSION_KEYS) storage.removeItem(key);
  return { entries: migrated };
}

export function clearCustomCsvSession(
  storage: Pick<Storage, "removeItem"> = window.sessionStorage
) {
  storage.removeItem(CUSTOM_CSV_SESSION_KEY);
  for (const key of LEGACY_CUSTOM_CSV_SESSION_KEYS) storage.removeItem(key);
}
