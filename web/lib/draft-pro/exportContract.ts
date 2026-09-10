import { z } from "zod";

const finite = z.number().finite();
const cell = z.union([z.string().max(200), finite, z.null()]);
const reservedColumns = ["projectionSeason", "leagueType", "sourceWeights", "scoring", "goalieScoring", "adjustments"] as const;
const hasSafeKeys = (value: Record<string, unknown>, max = 64) =>
  Object.keys(value).length <= max && Object.keys(value).every((key) => key.length > 0 && key.length <= 64 && !/[\u0000-\u001f]/.test(key));

export const draftProExportInputSchema = z.object({
  season: z.string().trim().min(1).max(32),
  leagueType: z.enum(["points", "categories"]),
  sourceWeights: z.record(finite).refine((value) => hasSafeKeys(value)),
  scoring: z.record(finite).refine((value) => hasSafeKeys(value)),
  goalieScoring: z.record(finite).refine((value) => hasSafeKeys(value)),
  adjustments: z.record(z.union([finite, z.boolean()])).refine((value) => hasSafeKeys(value)),
  rows: z.array(z.record(cell).refine((row) => hasSafeKeys(row, 74) && !Object.keys(row).some((key) => reservedColumns.includes(key as typeof reservedColumns[number])))).min(1).max(5000),
}).strict().refine(
  (value) => new Set(value.rows.flatMap((row) => Object.keys(row))).size <= 74,
  { message: "Export contains too many stat columns." },
);

export type DraftProExportInput = z.infer<typeof draftProExportInputSchema>;

export const RESTRICTED_EXPORT_MESSAGE = "This export contains a retired LineupExperts source. Reload the dashboard to recalculate with the current sources, then export again. Your draft picks will stay in place.";

/** Blocks declared sources, including blends and zero-weight selections (which may use fallback weights). */
export function hasRestrictedExportSource(sourceWeights: Record<string, number>) {
  return Object.keys(sourceWeights).some((id) =>
    id.toLowerCase().replace(/[^a-z0-9]/g, "").includes("lineupexperts"),
  );
}


function neutralizeFormula(value: string) {
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: unknown) {
  if (value == null) return "";
  const text = typeof value === "string" ? neutralizeFormula(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function formatDraftProExportCsv(input: DraftProExportInput) {
  if (hasRestrictedExportSource(input.sourceWeights)) throw new Error(RESTRICTED_EXPORT_MESSAGE);
  const columns = [...reservedColumns, ...Array.from(new Set(input.rows.flatMap((row) => Object.keys(row))))];
  const provenance = {
    projectionSeason: input.season,
    leagueType: input.leagueType,
    sourceWeights: JSON.stringify(input.sourceWeights),
    scoring: JSON.stringify(input.scoring),
    goalieScoring: JSON.stringify(input.goalieScoring),
    adjustments: JSON.stringify(input.adjustments),
  };
  const lines = [columns.map(csvCell).join(",")];
  for (const row of input.rows) {
    lines.push(columns.map((column) => csvCell(column in provenance ? provenance[column as keyof typeof provenance] : row[column] ?? "")).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
