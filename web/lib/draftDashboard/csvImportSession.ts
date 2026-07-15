export const CUSTOM_CSV_SESSION_KEY = "draft.customCsvList.v3";
export const LEGACY_CUSTOM_CSV_SESSION_KEYS = [
  "draft.customCsvList.v2",
  "draft.customCsv.v1"
] as const;

export type SessionCsvEntry = {
  id: string;
  label: string;
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

export function saveCustomCsvSession(
  entries: SessionCsvEntry[],
  storage: Pick<Storage, "setItem"> = window.sessionStorage
) {
  storage.setItem(CUSTOM_CSV_SESSION_KEY, JSON.stringify(entries));
}

export function loadCustomCsvSession(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> =
    window.sessionStorage
): SessionCsvEntry[] {
  const current = parseList(storage.getItem(CUSTOM_CSV_SESSION_KEY));
  if (current.length) return current;

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

  if (migrated.length) saveCustomCsvSession(migrated, storage);
  for (const key of LEGACY_CUSTOM_CSV_SESSION_KEYS) storage.removeItem(key);
  return migrated;
}

export function clearCustomCsvSession(
  storage: Pick<Storage, "removeItem"> = window.sessionStorage
) {
  storage.removeItem(CUSTOM_CSV_SESSION_KEY);
  for (const key of LEGACY_CUSTOM_CSV_SESSION_KEYS) storage.removeItem(key);
}
