import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LocalCardInput } from "./adapter";
import { EVIDENCE_ADMISSIONS, type Admission, type VerifiedClaim } from "./evidenceAdmissions";
import { validateEvidenceBundle, type EvidenceBundle, type EvidenceIssue, type EvidenceResult, type RetainedReceipt } from "./evidenceBundle";
import { METRICS } from "./registry";
import { instant, validDate } from "./windows";

type Origin = Admission["origin"];
type Kind = RetainedReceipt["kind"];
type Check = (value: unknown) => boolean;
export type LoadIssue = { code: string; reason: string; receiptId: string; path: string };
declare const admitted: unique symbol;
/** Opaque, frozen loader output. Only `loadAdmittedEvidence` creates one; structural copies are not admitted. */
export type AdmittedEvidence = { readonly origin: Origin; readonly receipts: readonly RetainedReceipt[]; readonly issues: readonly LoadIssue[]; readonly [admitted]: true };
const issued = new WeakSet<object>();

const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const shaped = (value: unknown, checks: Record<string, Check>, optional: readonly string[] = []) => record(value)
  && Object.keys(checks).every(key => own(value, key) && checks[key](value[key])) && Object.keys(value).every(key => own(checks, key) || optional.includes(key));
const id: Check = value => Number.isSafeInteger(value) && (value as number) > 0;
const count: Check = value => Number.isSafeInteger(value) && (value as number) >= 0;
const text: Check = value => typeof value === "string" && !!value.trim();
const time: Check = value => typeof value === "string" && instant(value) !== null;
const day: Check = value => typeof value === "string" && validDate(value);
const regular: Check = value => value === "regular";
const metricId: Check = value => METRICS.some(metric => metric.id === value);
const period: Check = value => shaped(value, { mode: mode => mode === "appearances", count: n => n === 5 || n === 10 || n === 20 })
  || shaped(value, { mode: mode => mode === "calendar", start: day, end: day, timezone: zone => zone === "UTC" });

/** Facts a receipt subject carries; parsed from the hashed bytes and bound by the admission's pinned hash. */
const FACTS: Record<Kind, Record<string, Check>> = {
  "appearance-history": { playerId: id, season: id, gameType: regular, through: time, appearances: value => Array.isArray(value) && value.every(game => shaped(game, { gameId: id, date: day, played: played => typeof played === "boolean" })) },
  "game-finality": { gameId: id, season: id, date: day, endedAt: time },
  "metric-definition": { metricId, registryVersion: text, sourceDefinition: text, sourceVersion: text, definitionVersion: text },
  "population-membership": { metricId, scope: scope => scope === "all-nhl" || scope === "synthetic-all-values", definitionVersion: text, season: id, gameType: regular, strength: strength => strength === "all" || strength === "5v5" || strength === "pp", period, cutoff: time, memberIds: value => Array.isArray(value) && value.every(id) },
};
/** Authority labels: written only from a verified admission claim. A file may carry them, but they never count as proof. */
const LABELS: Record<Kind, Record<string, readonly string[]>> = {
  "appearance-history": { sourceClass: ["complete-official-log", "latest-n", "row-count"], dateBasis: ["UTC", "provider-game-date"] },
  "game-finality": { sourceClass: ["official-game-end", "ingestion-completion", "scheduled-start"] },
  "metric-definition": { zeroSemantics: ["verified-distinct", "placeholder-coerced", "unknown"] },
  "population-membership": { sourceClass: ["metric-population-inventory", "roster-snapshot", "ingestion-position-filter"] },
};
const AUTHORITATIVE = new Set(["complete-official-log", "UTC", "official-game-end", "verified-distinct", "metric-population-inventory"]);
/** The most each retained format can establish, whatever its admission claims. */
const CEILING: Record<Admission["format"], (claim: VerifiedClaim) => boolean> = {
  "receipt-v1": () => true,
  "completion-read-rows-v1": claim => claim.kind === "game-finality" && claim.sourceClass === "ingestion-completion",
};

type Candidate = { kind: Kind; receiptId: string; origin?: unknown; capturedAt: string; facts: Record<string, unknown>; asserted: Record<string, unknown> };

function receiptV1(json: unknown): Candidate[] | string {
  if (!shaped(json, { kind: kind => typeof kind === "string" && own(FACTS, kind), receiptId: text, origin: origin => origin === "synthetic" || origin === "local-observed", capturedAt: time, subject: record })) return "Receipt envelope is malformed or carries unrecognised fields";
  const envelope = json as Record<string, unknown>, kind = envelope.kind as Kind, subject = envelope.subject as Record<string, unknown>, labels = Object.keys(LABELS[kind]);
  if (!shaped(subject, FACTS[kind], labels)) return `Receipt subject does not match the ${kind} schema`;
  return [{
    kind, receiptId: envelope.receiptId as string, origin: envelope.origin, capturedAt: envelope.capturedAt as string,
    facts: Object.fromEntries(Object.keys(FACTS[kind]).map(key => [key, subject[key]])),
    asserted: Object.fromEntries(labels.filter(key => own(subject, key)).map(key => [key, subject[key]])),
  }];
}

/** Postgres `YYYY-MM-DD HH:MM:SS[.ffffff]+00` to the validator's millisecond ISO instant. */
function pgInstant(value: unknown): string | null {
  const match = typeof value === "string" ? /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?\+00$/.exec(value) : null;
  const iso = match && `${match[1]}T${match[2]}${match[3] ? `.${match[3].slice(0, 3).padEnd(3, "0")}` : ""}Z`;
  return iso && instant(iso) !== null ? iso : null;
}
const pgTime: Check = value => pgInstant(value) !== null;
const ROW: Record<string, Check> = {
  captured_at: pgTime, requested_game_id: id, matched_game_id: id, date: day, season_id: id, game_type: id, scheduled_start: pgTime,
  updated: value => typeof value === "boolean", outcome: text, reason: value => value === null || typeof value === "string", contract_version: id,
  expected_team_rows: count, observed_team_rows: count, expected_skater_rows: count, observed_skater_rows: count, expected_goalie_rows: count, observed_goalie_rows: count,
  ingestion_completed_at: value => value === null || pgTime(value),
};

/** Ingestion-manifest rows: at most an ingestion-completion observation per fully ingested regular-season game. */
function completionRows(json: unknown, file: string): Candidate[] | string {
  if (!Array.isArray(json) || !json.length || !json.every(row => shaped(row, ROW))) return "Completion-read rows are malformed or carry unrecognised fields";
  const rows = json as Record<string, unknown>[];
  if (new Set(rows.map(row => row.requested_game_id)).size !== rows.length) return "Completion-read rows repeat a requested game";
  return rows.filter(row => row.matched_game_id === row.requested_game_id && row.game_type === 2 && row.updated === true && row.outcome === "complete" && row.ingestion_completed_at !== null
    && row.observed_team_rows === row.expected_team_rows && row.observed_skater_rows === row.expected_skater_rows && row.observed_goalie_rows === row.expected_goalie_rows)
    .map(row => ({
      kind: "game-finality" as const, receiptId: `${file}#game-${row.matched_game_id}`, capturedAt: pgInstant(row.captured_at)!,
      facts: { gameId: row.matched_game_id, season: row.season_id, date: row.date, endedAt: pgInstant(row.ingestion_completed_at)! }, asserted: {},
    }));
}

async function admit(root: string, admission: Admission): Promise<{ receipts: RetainedReceipt[]; issues: LoadIssue[] }> {
  const receipts: RetainedReceipt[] = [], issues: LoadIssue[] = [];
  const note = (receiptId: string, code: string, reason: string) => { issues.push({ code, reason, receiptId, path: admission.path }); };
  const none = (code: string, reason: string) => { admission.claims.forEach(claim => note(claim.receiptId, code, reason)); return { receipts, issues }; };
  const recorded = admission.origin === "synthetic" ? admission.authority === "SYNTHETIC" : /^(CODEX|CLAUDE)-\d{8}-\d{3}$/.test(admission.authority);
  if (!recorded) return none("admission-authority", `Authority "${admission.authority}" is not a recorded review decision for ${admission.origin} evidence`);
  if (!/^[0-9a-f]{64}$/.test(admission.sha256)) return none("admission-hash", "Admission does not pin a SHA-256 of the retained bytes");
  const segments = admission.path.split(/[\\/]/);
  if (path.isAbsolute(admission.path) || segments.some(segment => !segment || segment === "." || segment === "..")) return none("admission-path", "Admission path must stay inside the retained-evidence root");

  // Plain Uint8Array copy: @types/node 18's Buffer does not satisfy TS 5.7's generic Uint8Array in the full project.
  const bytes = await readFile(path.join(root, ...segments)).then(buffer => new Uint8Array(buffer)).catch(() => null);
  if (!bytes) return none("retained-file-missing", `Retained file ${admission.path} is absent; an admission without its bytes is not evidence`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== admission.sha256) return none("retained-bytes-mismatch", `Retained bytes hash to ${sha256}, not the reviewed ${admission.sha256}`);
  let json: unknown;
  try { json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return none("retained-parse", "Retained bytes are not UTF-8 JSON"); }
  const candidates = admission.format === "receipt-v1" ? receiptV1(json) : completionRows(json, admission.path);
  if (typeof candidates === "string") return none("retained-schema", candidates);

  for (const claim of admission.claims) {
    const at = (code: string, reason: string) => note(claim.receiptId, code, reason);
    const found = candidates.filter(candidate => candidate.receiptId === claim.receiptId);
    if (found.length !== 1) { at("claim-absent", `Claim ${claim.receiptId} is not parsed exactly once from the retained bytes`); continue; }
    const candidate = found[0];
    if (candidate.kind !== claim.kind || (candidate.origin ?? admission.origin) !== admission.origin) { at("claim-identity", `Retained ${candidate.kind} receipt kind or origin does not match the admitted ${claim.kind} claim`); continue; }
    const labels: Record<string, string> = Object.fromEntries(Object.entries(claim).filter(([key]) => key !== "receiptId" && key !== "kind"));
    const allowed = LABELS[claim.kind];
    if (Object.keys(labels).length !== Object.keys(allowed).length || !Object.entries(labels).every(([key, value]) => own(allowed, key) && allowed[key].includes(value))) { at("claim-label", `Admitted ${claim.kind} claim carries unknown authority labels`); continue; }
    if (!CEILING[admission.format](claim)) { at("authority-exceeds-format", `A ${admission.format} file cannot establish ${Object.values(labels).join("/")} ${claim.kind}`); continue; }
    const differing = Object.entries(candidate.asserted).filter(([key, value]) => labels[key] !== value);
    if (differing.some(([key]) => AUTHORITATIVE.has(labels[key]))) { at("self-label-conflict", "Retained bytes contradict the authority their admission verified"); continue; }
    for (const [key, value] of differing) at("self-label-unverified", `File asserts ${key} "${String(value)}"; review verified only "${labels[key]}"`);
    receipts.push({ kind: claim.kind, receiptId: claim.receiptId, sha256, retainedPath: admission.path, origin: admission.origin, capturedAt: candidate.capturedAt, subject: { ...candidate.facts, ...labels } } as RetainedReceipt);
  }
  return { receipts, issues };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
}

/**
 * Trusted retained-evidence loader (server-side, offline). Reads each reviewed admission's bytes under `root`,
 * hashes them, parses subjects from those same bytes, checks schema, identity and authority, and admits only the
 * claims its review verified. Files without an admission are never read; failures leave the claim unadmitted.
 */
export async function loadAdmittedEvidence(options: { root: string; origin: Origin }): Promise<AdmittedEvidence> {
  const admissions = EVIDENCE_ADMISSIONS.filter(admission => admission.origin === options.origin);
  const loaded = await Promise.all(admissions.map(admission => admit(options.root, admission)));
  const issues = loaded.flatMap(result => result.issues);
  const claimed = admissions.flatMap(admission => admission.claims.map(claim => claim.receiptId));
  const repeated = new Set(claimed.filter((receiptId, index) => claimed.indexOf(receiptId) !== index));
  repeated.forEach(receiptId => issues.push({ code: "admission-duplicate", reason: `Receipt ${receiptId} is admitted more than once`, receiptId, path: admissions.filter(admission => admission.claims.some(claim => claim.receiptId === receiptId)).map(admission => admission.path).join(", ") }));
  const receipts = loaded.flatMap(result => result.receipts).filter(receipt => !repeated.has(receipt.receiptId));
  const evidence = deepFreeze({ origin: options.origin, receipts, issues }) as unknown as AdmittedEvidence;
  issued.add(evidence);
  return evidence;
}

/** The validator entry for wiring: admits receipts only from a loader-issued handle; any caller-built index is rejected. */
export function validateAdmittedEvidence(input: LocalCardInput, bundle: EvidenceBundle, evidence: AdmittedEvidence): EvidenceResult {
  if (!issued.has(evidence)) {
    const issue: EvidenceIssue = { severity: "rejected", code: "untrusted-evidence", reason: "Evidence did not come from the retained-evidence loader; a caller-built index is never admitted" };
    const result = validateEvidenceBundle(input, bundle, []);
    const metrics = Object.fromEntries(Object.entries(result.metrics).map(([metric, value]) => [metric, { state: "rejected", reasons: [issue.reason, ...value.reasons] }])) as EvidenceResult["metrics"];
    return { ...result, state: "rejected", issues: [issue, ...result.issues], metrics, card: null };
  }
  const result = validateEvidenceBundle(input, bundle, evidence.receipts);
  const referenced = new Set([...bundle.history, ...bundle.finality, ...bundle.definitions, ...bundle.populations].map(entry => entry.receipt.receiptId));
  const loadIssues = evidence.issues.filter(issue => referenced.has(issue.receiptId)).map(({ code, reason, receiptId }): EvidenceIssue => ({ severity: "incomplete", code, reason, receiptId }));
  return loadIssues.length ? { ...result, issues: [...result.issues, ...loadIssues], state: result.state === "eligible" ? "incomplete" : result.state } : result;
}
