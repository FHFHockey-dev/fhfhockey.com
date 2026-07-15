import { CSV_IDENTITY_COLUMNS } from "./csvImportContract";

export type CsvImportRow = Record<string, string | number | null | unknown>;

export type CsvImportValidationResult = {
  acceptedRows: CsvImportRow[];
  parsedRows: number;
  accepted: number;
  skipped: number;
  duplicates: number;
  invalid: number;
  issues: string[];
};

function coerceSafeNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    return null;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedIdentity(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function validateCsvProjectionRows(
  rows: CsvImportRow[],
  requiredColumns: string[]
): CsvImportValidationResult {
  const acceptedRows: CsvImportRow[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  const numericColumns = requiredColumns.filter(
    (column) => !(CSV_IDENTITY_COLUMNS as readonly string[]).includes(column)
  );
  let duplicates = 0;
  let invalid = 0;

  rows.forEach((sourceRow, index) => {
    const rowNumber = index + 2; // header is row 1
    const row = { ...sourceRow };
    const missingIdentity = (CSV_IDENTITY_COLUMNS as readonly string[]).filter(
      (column) => !String(row[column] ?? "").trim()
    );
    if (missingIdentity.length) {
      invalid += 1;
      issues.push(
        `Row ${rowNumber}: missing ${missingIdentity.join(", ")}.`
      );
      return;
    }

    const invalidNumeric: string[] = [];
    for (const column of numericColumns) {
      const numeric = coerceSafeNumber(row[column]);
      if (numeric == null) invalidNumeric.push(column);
      else row[column] = numeric;
    }
    if (invalidNumeric.length) {
      invalid += 1;
      issues.push(
        `Row ${rowNumber}: invalid or missing numeric value for ${invalidNumeric.join(", ")}.`
      );
      return;
    }

    const playerId = Number(row.player_id);
    const identityKey = Number.isFinite(playerId)
      ? `id:${playerId}`
      : ["Player_Name", "Team_Abbreviation", "Position"]
          .map((column) => normalizedIdentity(row[column]))
          .join("|");
    if (seen.has(identityKey)) {
      duplicates += 1;
      issues.push(`Row ${rowNumber}: duplicate player projection.`);
      return;
    }
    seen.add(identityKey);
    acceptedRows.push(row);
  });

  return {
    acceptedRows,
    parsedRows: rows.length,
    accepted: acceptedRows.length,
    skipped: rows.length - acceptedRows.length,
    duplicates,
    invalid,
    issues
  };
}
