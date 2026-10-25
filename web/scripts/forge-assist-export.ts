import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { estimatePositionPrior, type HistoricalCounts } from "../lib/projections/research/skater-candidates/priors";

export const ASSIST_EXPORT_SCOPE = {
  schema: "forge-assist-pilot-v1", projectRef: "fyhftlxokyjtpndbkfse", season: 20262027,
  fromInclusive: "2026-10-01", toExclusive: "2026-10-22", rowLimit: 10000, maxBytes: 16 * 1024 * 1024,
} as const;

type Json = Record<string, unknown>;
function object(value: unknown, fields: string[], label: string): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  const row = value as Json;
  if (Object.keys(row).some((key) => !fields.includes(key)) || fields.some((key) => !(key in row))) throw new Error(`Unexpected or missing ${label} fields`);
  return row;
}
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const id = (value: unknown): value is number => count(value) && value > 0;
function date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
const individualFields = ["id", "playerId", "season", "date", "gp", "toiSeconds", "goals", "assists", "points"];
const onIceFields = ["id", "playerId", "season", "date", "gp", "toiSeconds", "goalsFor"];

/** Current exports are known available at acquisition, never at their historical game time. */
export function validateAssistExport(input: unknown) {
  const envelope = object(input, ["schema", "projectRef", "season", "fromInclusive", "toExclusive", "rowLimit", "exportedAt", "evidence", "canonicalRowCount", "truncated", "rows"], "envelope");
  for (const key of ["schema", "season", "fromInclusive", "toExclusive", "rowLimit"] as const) {
    if (envelope[key] !== ASSIST_EXPORT_SCOPE[key]) throw new Error(`Export scope mismatch: ${key}`);
  }
  if (!["synthetic", "current_snapshot_not_historical_asof"].includes(String(envelope.evidence))) throw new Error("Unsupported export evidence");
  if (envelope.projectRef !== (envelope.evidence === "synthetic" ? "synthetic" : ASSIST_EXPORT_SCOPE.projectRef)) throw new Error("Export target mismatch");
  if (!timestamp(envelope.exportedAt) || envelope.exportedAt.slice(0, 10) < ASSIST_EXPORT_SCOPE.toExclusive) throw new Error("Invalid acquisition timestamp");
  if (envelope.truncated !== false) throw new Error("Truncated export cannot be fitted");
  if (!Array.isArray(envelope.rows) || envelope.rows.length > ASSIST_EXPORT_SCOPE.rowLimit || envelope.canonicalRowCount !== envelope.rows.length) throw new Error("Export row count/cap mismatch");
  const acquiredAt = new Date(envelope.exportedAt).toISOString();
  const normalized: HistoricalCounts[] = [];
  const excluded: Record<string, number> = {};
  const seenWgo = new Set<number>(), seenEvents = new Set<string>(), seenSources = new Set<string>();
  const reject = (reason: string, by = 1) => { excluded[reason] = (excluded[reason] ?? 0) + by; };
  let zeroOnIceGoals = 0;
  for (const value of envelope.rows) {
    const row = object(value, ["wgoId", "playerId", "gameId", "date", "season", "position", "gamesPlayed", "canonicalDate", "canonicalSeason", "gameType", "gameStart", "ES", "PP"], "player-game");
    if (!id(row.wgoId) || seenWgo.has(row.wgoId)) throw new Error("Invalid/duplicate WGO identity");
    seenWgo.add(row.wgoId);
    if (!id(row.playerId) || !date(row.date) || row.date < ASSIST_EXPORT_SCOPE.fromInclusive || row.date >= ASSIST_EXPORT_SCOPE.toExclusive || row.season !== ASSIST_EXPORT_SCOPE.season || row.gamesPlayed !== 1) throw new Error("Out-of-scope WGO row");
    if (!id(row.gameId) || row.canonicalDate !== row.date || row.canonicalSeason !== row.season || !timestamp(row.gameStart)
      || Date.parse(row.gameStart) >= Date.parse(acquiredAt)) { reject("unmatched_canonical_game", 2); continue; }
    if (row.gameType !== 2) { reject("not_regular_season", 2); continue; }
    const event = `${row.playerId}:${row.gameId}`;
    if (seenEvents.has(event)) throw new Error("Duplicate player-game; no arbitrary row selection");
    seenEvents.add(event);
    const position = row.position === "D" ? "D" : ["C", "L", "R", "F", "LW", "RW"].includes(String(row.position)) ? "F" : null;
    if (!position) { reject("unknown_position", 2); continue; }
    for (const strength of ["ES", "PP"] as const) {
      const sources = object(row[strength], ["individual", "onIce"], "strength sources");
      if (!Array.isArray(sources.individual) || !Array.isArray(sources.onIce) || sources.individual.length > 2 || sources.onIce.length > 2) throw new Error("Source sentinel/cap mismatch");
      // Validate allowlists even for duplicate-source sentinels; don't echo private fields.
      const individuals = sources.individual.map((source) => object(source, individualFields, "individual source"));
      const onIce = sources.onIce.map((source) => object(source, onIceFields, "on-ice source"));
      if (individuals.length !== 1 || onIce.length !== 1) { reject(individuals.length > 1 || onIce.length > 1 ? "ambiguous_source_pair" : "missing_source_pair"); continue; }
      const individual = individuals[0], oi = onIce[0];
      if (![individual, oi].every((source) => id(source.id) && source.playerId === row.playerId && source.season === row.season && source.date === row.date)) { reject("mismatched_source_identity"); continue; }
      for (const [kind, source] of [["individual", individual], ["onIce", oi]] as const) {
        const key = `${strength}:${kind}:${source.id}`;
        if (seenSources.has(key)) throw new Error("Reused source identity");
        seenSources.add(key);
      }
      if (individual.gp !== 1 || oi.gp !== 1) { reject("non_single_game_source"); continue; }
      if (![individual.toiSeconds, oi.toiSeconds, individual.goals, individual.assists, individual.points, oi.goalsFor].every(count)) { reject("missing_or_invalid_count_exposure"); continue; }
      const goals = individual.goals as number, assists = individual.assists as number, points = individual.points as number;
      const onIceGoals = oi.goalsFor as number, toiSeconds = individual.toiSeconds as number;
      if (individual.toiSeconds !== oi.toiSeconds) { reject("strength_exposure_mismatch"); continue; }
      if (goals + assists !== points || points > onIceGoals || (toiSeconds === 0 && (points > 0 || onIceGoals > 0))) { reject("inconsistent_point_accounting"); continue; }
      if (onIceGoals === 0) zeroOnIceGoals++;
      normalized.push({ playerId: row.playerId, gameId: row.gameId, season: String(row.season), position, strength,
        playedAt: row.gameStart, availableAt: acquiredAt, toiSeconds, goals, assists, onIceGoals, shots: null });
    }
  }
  // An explicit current-acquisition cutoff for descriptive pilot fitting only.
  const before = new Date(Date.parse(acquiredAt) + 1).toISOString();
  const priors = (["F", "D"] as const).flatMap((position) => (["ES", "PP"] as const).flatMap((strength) =>
    (["assistsPerOnIceGoal", "pointsPerOnIceGoal"] as const).map((metric) => estimatePositionPrior(normalized,
      { season: String(ASSIST_EXPORT_SCOPE.season), position, strength, metric, before }))));
  return { schema: "forge-assist-validated-v1", evidence: envelope.evidence, acquiredAt,
    availabilityPolicy: "Conservative acquisition timestamp; source created_at is not historical value availability.",
    eventBinding: "NST player/date/season joined to canonical WGO game; not independent NST event identity or finality proof.",
    canonicalRows: envelope.rows.length, expectedStrengthRows: envelope.rows.length * 2, acceptedStrengthRows: normalized.length,
    excluded, zeroOnIceGoals, normalized, descriptivePriors: priors,
    historicalAsOfQualified: false, coefficientsFitted: false, releaseQualified: false };
}

/** No network, environment, Supabase client, automatic fitting or database access. */
export function runAssistExportValidation(argv: string[]) {
  if (argv.length !== 4 || argv[0] !== "--input" || argv[2] !== "--output") throw new Error("Usage: --input EXPORT.json --output VALIDATED.json");
  const input = resolve(argv[1]), output = resolve(argv[3]);
  if (input === output) throw new Error("Refusing to overwrite input");
  if (statSync(input).size > ASSIST_EXPORT_SCOPE.maxBytes) throw new Error("Export exceeds 16 MiB");
  const bytes = readFileSync(input);
  if (bytes.byteLength > ASSIST_EXPORT_SCOPE.maxBytes) throw new Error("Export exceeds 16 MiB");
  const result = { inputSha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"), ...validateAssistExport(JSON.parse(bytes.toString("utf8"))) };
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  return result;
}

/** Bounded receive path for a separately authorized client's bare-JSON stdout. */
export async function validateAssistExportStream(chunks: AsyncIterable<Uint8Array>) {
  let size = 0;
  const parts: Uint8Array[] = [];
  for await (const chunk of chunks) {
    size += chunk.byteLength;
    if (size > ASSIST_EXPORT_SCOPE.maxBytes) throw new Error("Export exceeds 16 MiB");
    parts.push(new Uint8Array(chunk));
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return { inputSha256: createHash("sha256").update(bytes).digest("hex"),
    ...validateAssistExport(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))) };
}

export async function captureAssistExportStdin(argv: string[], chunks: AsyncIterable<Uint8Array>) {
  if (argv.length !== 3 || argv[0] !== "--stdin" || argv[1] !== "--output") throw new Error("Usage: --stdin --output VALIDATED.json");
  const output = resolve(argv[2]);
  if (existsSync(output)) throw new Error("Refusing to replace existing evidence");
  const result = await validateAssistExportStream(chunks);
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  return result;
}
if (require.main === module) {
  const argv = process.argv.slice(2);
  const result = argv[0] === "--stdin" ? captureAssistExportStdin(argv, process.stdin)
    : Promise.resolve().then(() => runAssistExportValidation(argv));
  result.then((value) => console.log(JSON.stringify({ accepted: value.acceptedStrengthRows, excluded: value.excluded, evidence: value.evidence })))
    .catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
