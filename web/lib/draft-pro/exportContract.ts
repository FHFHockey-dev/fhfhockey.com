import { z } from "zod";

const finite = z.number().finite();
const cell = z.union([z.string().max(200), finite, z.null()]);

export const draftProExportInputSchema = z.object({
  season: z.string().trim().min(1).max(32),
  sourceWeights: z.record(finite).refine((value) => Object.keys(value).length <= 64),
  scoring: z.record(finite).refine((value) => Object.keys(value).length <= 64),
  rows: z.array(z.record(cell)).min(1).max(5000),
}).strict().refine(
  (value) => new Set(value.rows.flatMap((row) => Object.keys(row))).size <= 77,
  { message: "Export contains too many stat columns." },
);

export type DraftProExportInput = z.infer<typeof draftProExportInputSchema>;

function neutralizeFormula(value: string) {
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: unknown) {
  if (value == null) return "";
  const text = typeof value === "string" ? neutralizeFormula(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function formatDraftProExportCsv(input: DraftProExportInput) {
  const columns = Array.from(new Set([
    "projectionSeason", "sourceWeights", "scoring",
    ...input.rows.flatMap((row) => Object.keys(row)),
  ])).slice(0, 80);
  const provenance = [
    ["projectionSeason", input.season],
    ["sourceWeights", JSON.stringify(input.sourceWeights)],
    ["scoring", JSON.stringify(input.scoring)],
  ];
  const lines = [columns.map(csvCell).join(","), ...provenance.map((row) => columns.map((column) => csvCell(row[0] === column ? row[1] : "")).join(","))];
  for (const row of input.rows) lines.push(columns.map((column) => csvCell(row[column] ?? "")).join(","));
  return lines.join("\r\n") + "\r\n";
}
